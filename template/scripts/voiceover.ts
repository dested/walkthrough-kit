// Generates per-scene narration MP3s with ElevenLabs into public/<slug>/vo/,
// plus <sceneId>.align.json (character-level timestamps) that drives word-cue
// shot timing and caption pages.
//
// Run: bun scripts/voiceover.ts <slug> [--force] [--only=<sceneId>]
// Then: bun scripts/durations.ts <slug>
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, argFlag, argValue, elevenKey, findWalkthrough, readConfig, toneFor } from './lib'

const wt = findWalkthrough(process.argv[2])
const config = readConfig()
const tone = toneFor(wt)
const VOICE_ID = wt.voiceId ?? config.voiceId

const KEY = elevenKey()
if (!KEY) {
  console.log('No ELEVENLABS_API_KEY (env or .env) — skipping TTS. The pipeline runs in captions mode;')
  console.log('run `bun scripts/durations.ts ' + wt.id + '` to write estimated timings.')
  process.exit(0)
}

const OUT = join(ROOT, 'public', wt.id, 'vo')
mkdirSync(OUT, { recursive: true })

const FORCE = argFlag('force')
const ONLY = argValue('only')

// Uses the with-timestamps endpoint so we also get character-level alignment.
// previous/next scene text is passed as prosody context so each per-scene clip
// flows into the next instead of restarting cold — reads noticeably more human.
async function tts(text: string, outPath: string, prevText?: string, nextText?: string) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_192`,
    {
      method: 'POST',
      headers: { 'xi-api-key': KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        ...(prevText ? { previous_text: prevText } : {}),
        ...(nextText ? { next_text: nextText } : {}),
        voice_settings: tone.voice,
      }),
    },
  )
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { audio_base64: string; alignment: unknown }
  const buf = Buffer.from(json.audio_base64, 'base64')
  writeFileSync(outPath, buf)
  writeFileSync(outPath.replace(/\.mp3$/, '.align.json'), JSON.stringify(json.alignment))
  return buf.length
}

console.log(`voice ${VOICE_ID}, tone ${tone.id} (${JSON.stringify(tone.voice)})`)
for (let i = 0; i < wt.scenes.length; i++) {
  const scene = wt.scenes[i]
  if (ONLY && scene.id !== ONLY) continue
  const out = join(OUT, `${scene.id}.mp3`)
  if (existsSync(out) && !FORCE && !ONLY) {
    console.log(`skip ${scene.id} (exists)`)
    continue
  }
  process.stdout.write(`tts ${scene.id} … `)
  const bytes = await tts(scene.vo, out, wt.scenes[i - 1]?.vo, wt.scenes[i + 1]?.vo)
  console.log(`${(bytes / 1024).toFixed(0)} KB`)
}
console.log(`voiceover done. Now run: bun scripts/durations.ts ${wt.id}`)
