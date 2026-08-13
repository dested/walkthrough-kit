// The reusable Puppeteer capture harness. A walkthrough's capture script
// (videos/<slug>/capture.ts) composes these helpers; the kit owns the browser,
// the output paths, and the capture-manifest bookkeeping.
//
// Contract with videos/<slug>/script.ts: every `img:`/`clip:` in a Shot must be
// produced here, and every `cursorKey:` must be recorded with `point()`.
//
// Idempotent by design: re-running overwrites PNGs and merges the manifest.
// Partial re-runs: ONLY=stage1,stage2 or SKIP=stage3 (comma-separated stage
// names, matched against the name passed to `stage()`).
import puppeteer, { type Browser, type Page } from 'puppeteer'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export type KitConfigFile = { baseUrl?: string }

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** process.env first, then the template root .env file. */
export function readEnv(key: string): string | undefined {
  const fromEnv = process.env[key]
  if (fromEnv) return fromEnv
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) return undefined
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return undefined
}

function configBaseUrl(): string {
  const raw: unknown = JSON.parse(readFileSync(join(ROOT, 'walkthrough.config.json'), 'utf8'))
  if (raw && typeof raw === 'object' && 'baseUrl' in raw && typeof raw.baseUrl === 'string') return raw.baseUrl
  throw new Error('walkthrough.config.json is missing baseUrl')
}

/** Actual pixel dimensions straight out of a PNG's IHDR chunk. */
function pngSize(file: string): { w: number; h: number } {
  const buf = readFileSync(file)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

/** A browser-side element finder. Serialized with toString(), so it must be
 * self-contained — close over nothing. Pass a string to inject resolved values:
 * `` `() => document.querySelector(${JSON.stringify(sel)})` ``. */
export type Finder = (() => Element | null | undefined) | string

export type PointSpace = 'viewport' | 'page'

export type CaptureOptions = {
  baseUrl?: string
  viewportWidth?: number
  viewportHeight?: number
  deviceScaleFactor?: number
  /** Ceiling for fullPage captures, in CSS px (doubled by the device scale). */
  tallCap?: number
  headless?: boolean
}

export async function createCapture(slug: string, options: CaptureOptions = {}) {
  const BASE = options.baseUrl ?? process.env.BASE_URL ?? configBaseUrl()
  const VW = options.viewportWidth ?? 1440
  const VH = options.viewportHeight ?? 810
  const DSF = options.deviceScaleFactor ?? 2
  const TALL_CAP = options.tallCap ?? 5400

  const OUT = join(ROOT, 'public', slug, 'captures')
  mkdirSync(OUT, { recursive: true })

  const SKIP = new Set((process.env.SKIP ?? '').split(',').filter(Boolean))
  const ONLY = new Set((process.env.ONLY ?? '').split(',').filter(Boolean))

  // Merged so a partial re-run (ONLY=…) doesn't drop the points/images the
  // previous full run already measured.
  let images: Record<string, { w: number; h: number }> = {}
  let points: Record<string, { img: string; x: number; y: number }> = {}
  const manifestPath = join(OUT, 'capture-manifest.json')
  try {
    const prev: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if ((ONLY.size || SKIP.size) && prev && typeof prev === 'object') {
      const p = prev as { images?: typeof images; points?: typeof points }
      images = p.images ?? {}
      points = p.points ?? {}
    }
  } catch {
    /* first run */
  }

  const browser: Browser = await puppeteer.launch({
    headless: options.headless ?? true,
    defaultViewport: { width: VW, height: VH, deviceScaleFactor: DSF },
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
  })

  const page: Page = await browser.newPage()
  page.setDefaultNavigationTimeout(60000)

  /** Facts worth reporting back to whoever is writing the VO — on-screen
   * numbers, resolved names. Printed by finish(); the VO must match reality. */
  const facts: Record<string, unknown> = {}
  const fact = (key: string, value: unknown) => {
    facts[key] = value
    console.log(`  fact ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  }

  /** Gate a block of work: if (kit.stage('calendar')) { … } */
  const stage = (name: string) => (ONLY.size ? ONLY.has(name) : !SKIP.has(name))

  const finderBody = (find: Finder) => (typeof find === 'string' ? find : find.toString())

  /** Kill the toast rail (and any live toast) so nothing floats over a shot. */
  async function dismissToasts(p: Page = page) {
    await p.evaluate(() => {
      document.querySelectorAll('[role="region"][aria-live], [role="status"]').forEach((el) => {
        const rail = el.closest('[role="region"][aria-live]') ?? el
        rail.remove()
      })
    })
  }

  /** Block until no shimmer/skeleton placeholders are left on screen. */
  async function waitForSkeletons(p: Page = page) {
    await p
      .waitForFunction(() => !document.querySelector('.animate-pulse, [data-skeleton], .skeleton'), {
        timeout: 15000,
        polling: 400,
      })
      .catch(() => console.warn('  ! skeletons still present after 15s'))
  }

  /**
   * Scroll the page top-to-bottom so reveal-on-scroll sections fire and lazy
   * images decode, then return to the top and freeze transitions so nothing is
   * captured mid-fade.
   */
  async function fullyLoad(p: Page = page) {
    await p.evaluate(async () => {
      const nap = (ms: number) => new Promise((r) => setTimeout(r, ms))
      const step = Math.round(window.innerHeight * 0.8)
      for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y)
        await nap(260)
      }
      window.scrollTo(0, document.documentElement.scrollHeight)
      await nap(600)
      window.scrollTo(0, 0)
      await nap(500)
      const s = document.createElement('style')
      s.textContent = '*{animation-duration:0s!important;transition:none!important}'
      document.head.appendChild(s)
    })
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))))
    await sleep(700)
  }

  /** Navigate, hide scrollbars, optionally wait for a text anchor, settle. */
  async function go(path: string, waitText?: string | null, settle = 2200, p: Page = page) {
    await p
      .goto(path.startsWith('http') ? path : `${BASE}${path}`, { waitUntil: 'networkidle2' })
      .catch((e: Error) => console.warn(`  nav ${path}: ${e.message}`))
    await p.addStyleTag({ content: `::-webkit-scrollbar{display:none!important} *{scrollbar-width:none!important}` })
    if (waitText) {
      await p
        .waitForFunction((t: string) => document.body.innerText.includes(t), { timeout: 25000 }, waitText)
        .catch(() => console.warn(`  ! waitText "${waitText}" timed out on ${path}`))
    }
    await sleep(settle)
    await waitForSkeletons(p)
    await p.evaluate(() => window.scrollTo(0, 0))
    await sleep(300)
  }

  async function save(name: string, opts: Parameters<Page['screenshot']>[0] = {}, p: Page = page) {
    await dismissToasts(p)
    const file = join(OUT, name)
    if (!name.endsWith('.png')) throw new Error(`save: "${name}" must end in .png`)
    await p.screenshot({ path: file as `${string}.png`, type: 'png', ...opts })
    const { w, h } = pngSize(file)
    images[name] = { w, h }
    console.log(`  saved ${name}  ${w}x${h}`)
  }

  /**
   * fullPage, but bounded. A 200-card library page can be ~30 000 CSS px — a
   * 90 MB PNG nothing can composite. Past the cap we clip to the top of the
   * document, which still reads as "the whole page scrolling by".
   */
  async function saveTall(name: string, p: Page = page) {
    const h = await p.evaluate(() => document.documentElement.scrollHeight)
    if (h > TALL_CAP) {
      console.log(`  ${name}: page is ${h}px tall — clipping to ${TALL_CAP}px`)
      await save(name, { captureBeyondViewport: true, clip: { x: 0, y: 0, width: VW, height: TALL_CAP } }, p)
    } else {
      await save(name, { fullPage: true }, p)
    }
  }

  /**
   * Record a normalized 0..1 point for `key`, from the centre of the first
   * element `find` returns. `space: 'viewport'` normalizes against the viewport
   * frame; `space: 'page'` against the full document (for fullPage stills).
   */
  async function point(key: string, img: string, find: Finder, space: PointSpace = 'viewport', p: Page = page) {
    const box = await p.evaluate(
      (fnBody: string, sp: string, cap: number) => {
        const el = new Function(`return (${fnBody})()`)() as Element | null | undefined
        if (!el) return null
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        if (sp === 'page') {
          // Normalize against the frame that actually gets written out — which
          // is the clipped height when the document is taller than the cap.
          const pw = document.documentElement.scrollWidth
          const ph = Math.min(document.documentElement.scrollHeight, cap)
          return { x: (cx + window.scrollX) / pw, y: (cy + window.scrollY) / ph }
        }
        return { x: cx / window.innerWidth, y: cy / window.innerHeight }
      },
      finderBody(find),
      space,
      TALL_CAP,
    )
    if (!box) {
      console.warn(`  ! point "${key}" — element not found`)
      return null
    }
    points[key] = { img, x: Number(box.x.toFixed(4)), y: Number(box.y.toFixed(4)) }
    console.log(`  point ${key} -> ${points[key].x}, ${points[key].y}`)
    return points[key]
  }

  /** Click the element a browser-side finder returns. */
  const clickFound = (find: Finder, p: Page = page) =>
    p.evaluate((fnBody: string) => {
      const el = new Function(`return (${fnBody})()`)() as HTMLElement | null | undefined
      if (!el) return false
      el.click()
      return true
    }, finderBody(find))

  /** Pull an element's text (trimmed, single-spaced) — for facts. */
  const readText = (find: Finder, p: Page = page) =>
    p.evaluate((fnBody: string) => {
      const el = new Function(`return (${fnBody})()`)() as HTMLElement | null | undefined
      return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null
    }, finderBody(find))

  /** Scroll so the found element sits `offset` px under the top edge. */
  const scrollTo = (find: Finder, offset = 96, p: Page = page) =>
    p.evaluate(
      (fnBody: string, off: number) => {
        const el = new Function(`return (${fnBody})()`)() as Element | null | undefined
        if (!el) return false
        window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - off))
        return true
      },
      finderBody(find),
      offset,
    )

  /** Standard email+password sign-in. Throws if still on the sign-in page after. */
  async function signIn(
    opts: {
      path?: string
      email: string
      password: string
      emailSel?: string
      passwordSel?: string
      submitSel?: string
    },
    p: Page = page,
  ) {
    const path = opts.path ?? '/sign-in'
    await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })
    if (!p.url().includes(path)) {
      console.log('  already signed in ->', p.url())
      return
    }
    const emailSel = opts.emailSel ?? 'input[type="email"]'
    const passwordSel = opts.passwordSel ?? 'input[type="password"]'
    await p.waitForSelector(emailSel, { timeout: 25000 })
    await p.type(emailSel, opts.email, { delay: 8 })
    await p.type(passwordSel, opts.password, { delay: 8 })
    await Promise.all([
      p.click(opts.submitSel ?? 'button[type="submit"]'),
      p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    ])
    await sleep(3500)
    if (p.url().includes(path)) throw new Error(`sign-in failed at ${path} as ${opts.email}`)
    console.log('  signed in ->', p.url())
  }

  /**
   * Record a webm clip of live interactions: screencast starts, `fn` drives the
   * page, screencast stops. Use for Shots with `clip:` instead of `img:`.
   */
  async function recordClip(name: string, fn: (p: Page) => Promise<void>, p: Page = page) {
    if (!name.endsWith('.webm')) throw new Error(`recordClip: "${name}" must end in .webm`)
    const file = join(OUT, name)
    // Runtime-verified suffix; puppeteer's type wants the template-literal form.
    const recorder = await p.screencast({ path: file as `${string}.webm` })
    console.log(`  recording ${name}…`)
    try {
      await fn(p)
    } finally {
      await recorder.stop()
    }
    console.log(`  saved ${name}`)
  }

  /** A second tab (portal user, mobile UA, …) sharing the browser. */
  async function newPage(viewport?: { width: number; height: number; deviceScaleFactor?: number }, userAgent?: string) {
    const p = await browser.newPage()
    p.setDefaultNavigationTimeout(60000)
    if (userAgent) await p.setUserAgent(userAgent)
    await p.setViewport({
      width: viewport?.width ?? VW,
      height: viewport?.height ?? VH,
      deviceScaleFactor: viewport?.deviceScaleFactor ?? DSF,
    })
    return p
  }

  /** Write the manifest, print facts, close the browser. Always call last. */
  async function finish() {
    writeFileSync(manifestPath, JSON.stringify({ images, points }, null, 2))
    console.log(`\ndone — ${Object.keys(images).length} images, ${Object.keys(points).length} points`)
    console.log(`manifest: ${manifestPath}`)
    if (Object.keys(facts).length) {
      console.log('\n===== FACTS (make the VO match these) =====')
      for (const [k, v] of Object.entries(facts))
        console.log(`${k}: ${typeof v === 'string' ? v.slice(0, 900) : JSON.stringify(v)}`)
    }
    await browser.close()
  }

  return {
    browser,
    page,
    base: BASE,
    out: OUT,
    viewport: { width: VW, height: VH, deviceScaleFactor: DSF },
    stage,
    fact,
    go,
    save,
    saveTall,
    point,
    clickFound,
    readText,
    scrollTo,
    signIn,
    recordClip,
    newPage,
    fullyLoad,
    waitForSkeletons,
    dismissToasts,
    finish,
  }
}

export type Capture = Awaited<ReturnType<typeof createCapture>>
