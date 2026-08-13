// Lists the voices available on the configured ElevenLabs account so a
// narrator can be chosen deliberately — the kit never picks one silently.
// Prints a terminal listing AND writes out/voices.html — a picker page with
// audio players and click-to-copy voice ids, because nobody can audition a
// preview URL from a terminal. Send the html to the user before asking.
//
// Run: bun scripts/voices.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, elevenKey, readConfig } from './lib'

const KEY = elevenKey()
if (!KEY) {
  console.log('No ELEVENLABS_API_KEY — captions mode, no voice to choose.')
  process.exit(0)
}

type Voice = {
  voice_id: string
  name: string
  category?: string
  description?: string | null
  labels?: Record<string, string>
  preview_url?: string
  high_quality_base_model_ids?: string[]
}

const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } })
if (!res.ok) throw new Error(`voices ${res.status}: ${await res.text()}`)
const { voices } = (await res.json()) as { voices: Voice[] }

// TTS is always eleven_v3 in this kit — a voice not optimized for v3 will read
// noticeably worse, so the pick should come from the v3-ready list.
const v3Ready = (v: Voice) => (v.high_quality_base_model_ids ?? []).some((m) => m.startsWith('eleven_v3'))

const sorted = [...voices].sort((a, b) => Number(v3Ready(b)) - Number(v3Ready(a)))

console.log(`${voices.length} voices on this account (kit renders with eleven_v3 — prefer v3-ready):\n`)
for (const v of sorted) {
  const labels = Object.entries(v.labels ?? {})
    .map(([k, val]) => `${k}=${val}`)
    .join(' ')
  console.log(`${v.voice_id}  ${v.name}${v.category ? `  [${v.category}]` : ''}  ${v3Ready(v) ? 'v3-ready' : '(NOT flagged v3)'}`)
  if (labels) console.log(`  ${labels}`)
  if (v.description) console.log(`  ${v.description.slice(0, 160)}`)
  console.log()
}

// ── the audible picker page ───────────────────────────────────────────────
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const current = readConfig().voiceId
const cards = sorted
  .map((v) => {
    const labels = Object.entries(v.labels ?? {})
      .map(([k, val]) => `<span class="tag">${esc(k)}: ${esc(val)}</span>`)
      .join(' ')
    return `<div class="card${v3Ready(v) ? '' : ' dim'}">
  <div class="head">
    <strong>${esc(v.name)}</strong>
    ${v.voice_id === current ? '<span class="badge current">current</span>' : ''}
    ${v3Ready(v) ? '<span class="badge v3">v3-ready</span>' : '<span class="badge no">not v3</span>'}
    ${v.category ? `<span class="tag">${esc(v.category)}</span>` : ''}
  </div>
  ${labels ? `<div class="tags">${labels}</div>` : ''}
  ${v.description ? `<p>${esc(v.description.slice(0, 240))}</p>` : ''}
  ${v.preview_url ? `<audio controls preload="none" src="${esc(v.preview_url)}"></audio>` : '<em>no preview</em>'}
  <button onclick="navigator.clipboard.writeText('${esc(v.voice_id)}');this.textContent='copied!'">copy ${esc(v.voice_id)}</button>
</div>`
  })
  .join('\n')

const html = `<!doctype html><meta charset="utf-8"><title>Pick a narrator</title>
<style>
  body{font-family:ui-sans-serif,system-ui;background:#0d0e12;color:#eee;max-width:860px;margin:24px auto;padding:0 16px}
  .card{background:#16181f;border:1px solid #2a2d38;border-radius:12px;padding:14px 16px;margin:12px 0}
  .card.dim{opacity:.45}
  .head{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:17px}
  .badge{font-size:11px;padding:2px 8px;border-radius:99px}
  .badge.v3{background:#123b2a;color:#4ade80}.badge.no{background:#3b1212;color:#f87171}.badge.current{background:#1e2a4a;color:#93c5fd}
  .tag{font-size:11px;color:#9aa;background:#20232d;padding:2px 8px;border-radius:99px}
  .tags{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
  p{color:#aab;font-size:13px;margin:8px 0}
  audio{width:100%;margin:8px 0 6px}
  button{background:#242836;color:#cdf;border:0;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px}
  h1{font-size:20px} .note{color:#889;font-size:13px}
</style>
<h1>Pick a narrator (${sorted.length} voices)</h1>
<p class="note">The kit renders with <b>eleven_v3</b> — pick a v3-ready voice. Copy its id into walkthrough.config.json ("voiceId") or tell the agent.</p>
${cards}`

const outFile = join(ROOT, 'out', 'voices.html')
mkdirSync(join(ROOT, 'out'), { recursive: true })
writeFileSync(outFile, html)
console.log(`wrote ${outFile} — open it to audition voices (audio players + copy buttons)`)
console.log('Set the pick as "voiceId" in walkthrough.config.json (or per-film in script.ts).')
