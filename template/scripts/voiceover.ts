// Per-scene narration with **eleven_v3** — always v3; multilingual_v2 is not
// used in this kit. v3 reads with far better prosody but has no native
// timestamp alignment and rejects previous_text/next_text, so every take is
// round-tripped through scribe_v1 STT and the winner gets a synthetic
// alignment (align.ts) — which is all durations.ts needs.
//
// Per scene: generate N takes (Natural stability, plus one Creative roll for
// expressive tones), transcribe, score, keep the best:
//   score    = matched-word % vs the script (misreads sink a take)
//   guards   = trailing silence < 1.5s; pace inside 1.5–3.8 words/sec
//   tiebreak = pace closest to the takes' own median, then Natural over Creative
// Every take (audio + scores) is kept in out/vo-takes/<slug>/<sceneId>/ so a
// human can overrule the machine per scene:
//   bun scripts/voiceover.ts <slug> --pick=<sceneId>:<takeN>
//
// Run: bun scripts/voiceover.ts <slug> [--takes=2] [--force] [--only=<sceneId>] [--pick=<id>:<n>]
// Then: bun scripts/durations.ts <slug>
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Scene } from '../src/engine/types'
import { matchWords, scriptWords, sttWords, syntheticAlign, type ScriptWord, type SttWord } from './align'
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
const TAKES_DIR = join(ROOT, 'out', 'vo-takes', wt.id)
mkdirSync(OUT, { recursive: true })

const TAKES = Number(argValue('takes') ?? '2')
const FORCE = argFlag('force')
const ONLY = argValue('only')
const PICK = argValue('pick')

const VOICED = wt.scenes.filter((s) => s.vo)

async function measure(file: string): Promise<number> {
  const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(file) })
  return Number((await input.computeDuration()).toFixed(3))
}

// v3 stability is discrete: 0.0 creative / 0.5 natural / 1.0 robust. Natural
// first (dependable); expressive tones roll one Creative take for upside.
const stabilityFor = (i: number): number => (tone.expressive && TAKES > 1 && i === TAKES - 1 ? 0.0 : 0.5)

async function tts(text: string, stability: number): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_192`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_v3',
      voice_settings: { stability, similarity_boost: 0.85, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`)
  return Buffer.from(await res.arrayBuffer())
}

type Score = {
  dur: number
  pct: number
  ws: number
  issues: string[]
  sWords: ScriptWord[]
  tWords: SttWord[]
  pairs: [number, number][]
}

/** Score one take: STT it, LCS-match against the script, apply guards. */
async function scoreTake(scene: Scene, file: string): Promise<Score> {
  const dur = await measure(file)
  const { words: tWords } = await sttWords(file, KEY!)
  const sWords = scriptWords(scene.vo)
  const pairs = matchWords(sWords, tWords)
  const pct = pairs.length / Math.max(1, sWords.length)

  const issues: string[] = []
  const lastEnd = tWords.length ? tWords[tWords.length - 1].end : 0
  if (dur - lastEnd > 1.5) issues.push(`trailing silence ${(dur - lastEnd).toFixed(1)}s`)
  // Band is wide on purpose — short scenes legitimately run fast; this only
  // catches genuinely broken reads.
  const ws = sWords.length / Math.max(0.1, lastEnd)
  if (ws < 1.5) issues.push(`slow ${ws.toFixed(2)} w/s`)
  if (ws > 3.8) issues.push(`fast ${ws.toFixed(2)} w/s`)

  return { dur, pct, ws, issues, sWords, tWords, pairs }
}

/** Write a take out as the scene's live clip + synthetic alignment. */
function promote(scene: Scene, takeFile: string, s: Score) {
  writeFileSync(join(OUT, `${scene.id}.mp3`), readFileSync(takeFile))
  const align = syntheticAlign(scene.vo, s.sWords, s.tWords, s.pairs, s.dur)
  writeFileSync(join(OUT, `${scene.id}.align.json`), JSON.stringify(align))
}

// ── manual override: promote a kept take and exit ───────────────────────────
if (PICK) {
  const [id, n] = PICK.split(':')
  const scene = VOICED.find((s) => s.id === id)
  if (!scene) throw new Error(`unknown scene ${id}`)
  const file = join(TAKES_DIR, id, `take-${n}.mp3`)
  const s = await scoreTake(scene, file)
  promote(scene, file, s)
  console.log(`promoted ${id} take ${n} (${s.dur.toFixed(1)}s, ${(s.pct * 100).toFixed(0)}% match)`)
  console.log(`next: bun scripts/durations.ts ${wt.id}  (then render)`)
  process.exit(0)
}

// ── main: generate, score, pick ─────────────────────────────────────────────
console.log(`voice ${VOICE_ID}, model eleven_v3, tone ${tone.id}, ${TAKES} take(s)/scene`)
type TakeRow = { t: number; stability: number; dur: number; pct: number; ws: number; issues: string[] }
const report: { scene: string; kept: number; takes: TakeRow[] }[] = []

for (const scene of VOICED) {
  if (ONLY && scene.id !== ONLY) continue
  if (existsSync(join(OUT, `${scene.id}.mp3`)) && !FORCE && !ONLY) {
    console.log(`skip ${scene.id} (exists)`)
    continue
  }
  const dir = join(TAKES_DIR, scene.id)
  mkdirSync(dir, { recursive: true })

  const takes: (Score & { t: number; stability: number; file: string })[] = []
  for (let t = 0; t < TAKES; t++) {
    const stability = stabilityFor(t)
    process.stdout.write(`${scene.id} take ${t} (${stability === 0 ? 'creative' : 'natural'}) … `)
    const buf = await tts(scene.vo, stability)
    const file = join(dir, `take-${t}.mp3`)
    writeFileSync(file, buf)
    const s = await scoreTake(scene, file)
    takes.push({ t, stability, file, ...s })
    console.log(
      `${s.dur.toFixed(1)}s  match ${(s.pct * 100).toFixed(0)}%  ${s.ws.toFixed(2)} w/s${s.issues.length ? '  [' + s.issues.join(', ') + ']' : ''}`,
    )
  }

  // Hard-fail guards first, then accuracy, then pace closest to the takes' own
  // median (self-normalizing — scenes have different natural paces), then
  // Natural over Creative.
  const med = takes.map((x) => x.ws).sort((a, b) => a - b)[Math.floor(takes.length / 2)]
  const ranked = [...takes].sort((a, b) => {
    if (a.issues.length !== b.issues.length) return a.issues.length - b.issues.length
    if (a.pct !== b.pct) return b.pct - a.pct
    const dp = Math.abs(a.ws - med) - Math.abs(b.ws - med)
    if (Math.abs(dp) > 0.01) return dp
    return b.stability - a.stability
  })
  const win = ranked[0]
  promote(scene, win.file, win)
  console.log(`  -> kept take ${win.t} (${win.stability === 0 ? 'creative' : 'natural'})`)
  report.push({
    scene: scene.id,
    kept: win.t,
    takes: takes.map(({ t, stability, dur, pct, ws, issues }) => ({
      t,
      stability,
      dur,
      pct: Number((pct * 100).toFixed(0)),
      ws: Number(ws.toFixed(2)),
      issues,
    })),
  })
}

if (report.length) {
  writeFileSync(join(TAKES_DIR, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`\nkept ${report.map((r) => `${r.scene}:${r.kept}`).join(' ')}`)
  console.log(`takes + report in out/vo-takes/${wt.id}/ — overrule with --pick=<sceneId>:<takeN>`)
}
console.log(`voiceover done. Now run: bun scripts/durations.ts ${wt.id}`)
