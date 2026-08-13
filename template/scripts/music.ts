// Generates a loopable music bed via the ElevenLabs Music API into
// public/<slug>/music.mp3. The default prompt comes from the walkthrough's tone.
//
// Run: bun scripts/music.ts <slug> [--force] [--seconds=120] [--prompt="…"]
// Then re-run: bun scripts/durations.ts <slug>  (records bedSeconds)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ROOT, argFlag, argValue, elevenKey, findWalkthrough, toneFor } from './lib'

const wt = findWalkthrough(process.argv[2])
const tone = toneFor(wt)
const OUT = join(ROOT, 'public', wt.id, 'music.mp3')
mkdirSync(dirname(OUT), { recursive: true })

const KEY = elevenKey()
if (!KEY) {
  console.log('No ELEVENLABS_API_KEY — skipping music. The film simply runs without a bed.')
  process.exit(0)
}

if (existsSync(OUT) && !argFlag('force')) {
  console.log(`public/${wt.id}/music.mp3 exists (use --force to regenerate)`)
  process.exit(0)
}

const seconds = Number(argValue('seconds') ?? '120')
const prompt = argValue('prompt') ?? tone.musicPrompt

console.log(`music (${tone.id}, ${seconds}s): ${prompt.slice(0, 100)}…`)
const res = await fetch('https://api.elevenlabs.io/v1/music', {
  method: 'POST',
  headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, music_length_ms: Math.round(seconds * 1000) }),
})
if (!res.ok) throw new Error(`music ${res.status}: ${await res.text()}`)
const buf = Buffer.from(await res.arrayBuffer())
writeFileSync(OUT, buf)
console.log(`wrote public/${wt.id}/music.mp3 (${(buf.length / 1024).toFixed(0)} KB)`)
console.log(`now re-run: bun scripts/durations.ts ${wt.id}`)
