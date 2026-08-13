// Lists the voices available on the configured ElevenLabs account so a
// narrator can be chosen deliberately — the kit never picks one silently.
// Includes preview URLs; labels (use case, age, accent, tone) are the raw
// material for recommendations.
//
// Run: bun scripts/voices.ts
import { elevenKey } from './lib'

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

console.log(`${voices.length} voices on this account (kit renders with eleven_v3 — prefer v3-ready):\n`)
for (const v of [...voices].sort((a, b) => Number(v3Ready(b)) - Number(v3Ready(a)))) {
  const labels = Object.entries(v.labels ?? {})
    .map(([k, val]) => `${k}=${val}`)
    .join(' ')
  console.log(`${v.voice_id}  ${v.name}${v.category ? `  [${v.category}]` : ''}  ${v3Ready(v) ? 'v3-ready' : '(NOT flagged v3)'}`)
  if (labels) console.log(`  ${labels}`)
  if (v.description) console.log(`  ${v.description.slice(0, 160)}`)
  if (v.preview_url) console.log(`  preview: ${v.preview_url}`)
  console.log()
}
console.log('Set the pick as "voiceId" in walkthrough.config.json (or per-film in script.ts).')
