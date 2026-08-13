// Preflight: a deterministic "ready to film" signal before any capture or TTS
// run. Checks, in order:
//   1. baseUrl answers — and prints the page <title> so you can confirm it is
//      YOUR dev server (a stale process squatting the port answers too).
//   2. Every credential set in .env signs in (default + CAPTURE_EMAIL__ROLE sets).
//   3. The ElevenLabs key is live (prints character usage for cost visibility).
//   4. The configured voice exists on the account and is flagged v3-ready
//      (TTS is always eleven_v3 in this kit).
//
// Run: bun scripts/doctor.ts [--sign-in-path=/sign-in]
// Exit code = number of failed checks. Captions mode (no key) is a WARN, not a FAIL.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer'
import { credentialRoles, credentials } from '../capture/kit'
import { ROOT, argValue, elevenKey, readConfig } from './lib'

const config = readConfig()
const SIGN_IN_PATH = argValue('sign-in-path') ?? '/sign-in'

let kitVersion = '1 (pre-versioning)'
try {
  kitVersion = readFileSync(join(ROOT, '.kit-version'), 'utf8').trim()
} catch {
  /* scaffolded before versioning */
}

let fails = 0
const pass = (msg: string) => console.log(`  PASS  ${msg}`)
const warn = (msg: string) => console.log(`  WARN  ${msg}`)
const fail = (msg: string) => {
  fails++
  console.log(`  FAIL  ${msg}`)
}

console.log(
  `doctor — ${config.product} @ ${config.baseUrl} (kit v${kitVersion}, tone ${config.tone}, voice ${config.voiceId})\n`,
)

// ── 1. baseUrl ────────────────────────────────────────────────────────────
console.log('app server:')
try {
  const res = await fetch(config.baseUrl, { redirect: 'follow' })
  const html = await res.text()
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? '(no <title>)'
  if (res.ok) pass(`${config.baseUrl} -> ${res.status}, title: "${title}"`)
  else fail(`${config.baseUrl} -> ${res.status}, title: "${title}"`)
  console.log('        ^ confirm this is the app you mean to film — a different process on the same port answers too')
} catch (e) {
  fail(`${config.baseUrl} unreachable: ${e instanceof Error ? e.message : String(e)} — is the dev server running?`)
}

// ── 2. credentials ────────────────────────────────────────────────────────
const roles = credentialRoles()
console.log(`\ncredentials (${roles.length} set(s), sign-in path ${SIGN_IN_PATH}):`)
if (!roles.length) warn('no CAPTURE_EMAIL in env/.env — fine only if the app needs no login')
if (roles.length) {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 810 },
    args: ['--no-sandbox'],
  })
  try {
    for (const role of roles) {
      const label = role || 'default'
      const creds = credentials(role || undefined)
      if (!creds) {
        fail(`${label}: email present but password missing`)
        continue
      }
      const page = await browser.newPage()
      page.setDefaultNavigationTimeout(45000)
      try {
        await page.goto(`${config.baseUrl}${SIGN_IN_PATH}`, { waitUntil: 'networkidle2' })
        if (!page.url().includes(SIGN_IN_PATH)) {
          warn(`${label}: ${SIGN_IN_PATH} redirected away (already authed session? no auth?) — ${page.url()}`)
        } else {
          await page.waitForSelector('input[type="email"]', { timeout: 20000 })
          await page.type('input[type="email"]', creds.email, { delay: 5 })
          await page.type('input[type="password"]', creds.password, { delay: 5 })
          await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
          ])
          await new Promise((r) => setTimeout(r, 3000))
          if (page.url().includes(SIGN_IN_PATH)) fail(`${label}: still on sign-in as ${creds.email}`)
          else pass(`${label}: ${creds.email} -> ${page.url()}`)
        }
      } catch (e) {
        fail(`${label}: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }
}

// ── 3 + 4. ElevenLabs key + voice ─────────────────────────────────────────
console.log('\nelevenlabs:')
const KEY = elevenKey()
if (!KEY) {
  warn('no ELEVENLABS_API_KEY — pipeline will run in captions mode (no narration)')
} else {
  try {
    const sub = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': KEY } })
    if (!sub.ok) {
      fail(`key rejected: ${sub.status} ${await sub.text()}`)
    } else {
      const s = (await sub.json()) as { character_count?: number; character_limit?: number; tier?: string }
      pass(`key live (${s.tier ?? 'unknown tier'}, ${s.character_count ?? '?'}/${s.character_limit ?? '?'} characters used)`)

      const vs = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } })
      if (!vs.ok) {
        fail(`voices list failed: ${vs.status}`)
      } else {
        const { voices } = (await vs.json()) as {
          voices: { voice_id: string; name: string; high_quality_base_model_ids?: string[] }[]
        }
        const v = voices.find((x) => x.voice_id === config.voiceId)
        if (!v) fail(`voiceId ${config.voiceId} not on this account — run: bun scripts/voices.ts`)
        else if (!(v.high_quality_base_model_ids ?? []).some((m) => m.startsWith('eleven_v3')))
          fail(`voice "${v.name}" is not flagged v3-ready — TTS is always eleven_v3; pick another (bun scripts/voices.ts)`)
        else pass(`voice "${v.name}" is v3-ready`)
      }
    }
  } catch (e) {
    fail(`elevenlabs unreachable: ${e instanceof Error ? e.message : String(e)}`)
  }
}

console.log(fails === 0 ? '\nready to film.' : `\n${fails} check(s) failed — fix before filming.`)
process.exit(fails)
