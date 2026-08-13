// Writes public/<slug>/timings.json — the file that drives the whole timeline:
//   { durations, cues, bedSeconds, mode, captionPages }
//
// voiced mode (mp3s exist): durations are measured with mediabunny; every shot
// trigger resolves to a spoken second via the ElevenLabs alignment JSON; caption
// pages are cut on sentence boundaries and timed from the alignment characters.
//
// captions mode (no mp3s): durations are estimated from word count at the
// tone's read rate, triggers resolve by character position, captions carry the
// narration on screen.
//
// Run: bun scripts/durations.ts <slug>
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CaptionPage, Timings } from '../src/engine/types'
import { ROOT, findWalkthrough, toneFor } from './lib'

const wt = findWalkthrough(process.argv[2])
const tone = toneFor(wt)
const VO = join(ROOT, 'public', wt.id, 'vo')
const BED = join(ROOT, 'public', wt.id, 'music.mp3')

type Align = {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

function readAlign(file: string): Align | null {
  if (!existsSync(file)) return null
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Partial<Align>
  if (!Array.isArray(a.characters) || !Array.isArray(a.character_start_times_seconds)) return null
  return {
    characters: a.characters,
    character_start_times_seconds: a.character_start_times_seconds,
    character_end_times_seconds: Array.isArray(a.character_end_times_seconds)
      ? a.character_end_times_seconds
      : a.character_start_times_seconds,
  }
}

async function measure(file: string): Promise<number> {
  const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(file) })
  return Number((await input.computeDuration()).toFixed(3))
}

function estimateSeconds(vo: string): number {
  const words = vo.split(/\s+/).filter(Boolean).length
  return Number(((words / tone.wpm) * 60 + 0.35).toFixed(3))
}

/** Sentence-ish chunks that remember their character span in the VO text. */
type Chunk = { text: string; fromChar: number; toChar: number }

function splitLong(text: string, base: number, out: Chunk[]) {
  if (text.length <= 90) {
    const trimmed = text.trim()
    if (trimmed) out.push({ text: trimmed, fromChar: base + text.indexOf(trimmed[0]), toChar: base + text.length })
    return
  }
  // Split near the middle at a clause boundary; fall back to the middle space.
  const mid = Math.floor(text.length / 2)
  let best = -1
  for (const sep of [' — ', '; ', ', ']) {
    let idx = text.indexOf(sep)
    while (idx !== -1) {
      if (best === -1 || Math.abs(idx - mid) < Math.abs(best - mid)) best = idx + sep.length
      idx = text.indexOf(sep, idx + 1)
    }
    if (best !== -1) break
  }
  if (best === -1) {
    const space = text.indexOf(' ', mid)
    best = space === -1 ? -1 : space + 1
  }
  if (best <= 0 || best >= text.length) {
    const trimmed = text.trim()
    if (trimmed) out.push({ text: trimmed, fromChar: base, toChar: base + text.length })
    return
  }
  splitLong(text.slice(0, best), base, out)
  splitLong(text.slice(best), base + best, out)
}

function chunkVo(vo: string): Chunk[] {
  const out: Chunk[] = []
  const re = /[^.!?…]+[.!?…]*\s*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(vo))) splitLong(m[0], m.index, out)
  return out
}

/** Time caption chunks off the alignment characters, or linearly when estimating. */
function pagesFor(vo: string, dur: number, align: Align | null): CaptionPage[] {
  const chunks = chunkVo(vo)
  const timeAt = (charIndex: number, edge: 'start' | 'end'): number => {
    if (!align) return (charIndex / Math.max(1, vo.length)) * dur
    const i = Math.max(0, Math.min(charIndex, align.characters.length - 1))
    const arr = edge === 'start' ? align.character_start_times_seconds : align.character_end_times_seconds
    return arr[i] ?? dur
  }
  const pages = chunks.map((c) => ({
    text: c.text,
    from: Number(timeAt(c.fromChar, 'start').toFixed(3)),
    to: Number(timeAt(c.toChar - 1, 'end').toFixed(3)),
  }))
  // Monotonic, gapless-ish, and never shorter than a beat.
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i].from < pages[i - 1].to) pages[i].from = pages[i - 1].to
    if (pages[i].to < pages[i].from + 0.5) pages[i].to = pages[i].from + 0.5
  }
  return pages
}

const durations: Record<string, number> = {}
const cues: Record<string, Record<string, number>> = {}
const captionPages: Record<string, CaptionPage[]> = {}
const unresolved: string[] = []
let missingAudio = 0

for (const s of wt.scenes) {
  const file = join(VO, `${s.id}.mp3`)
  const align = readAlign(join(VO, `${s.id}.align.json`))
  const hasAudio = existsSync(file)
  if (!hasAudio) missingAudio++

  const dur = hasAudio ? await measure(file) : estimateSeconds(s.vo)
  durations[s.id] = dur
  console.log(`${s.id}\t${dur}s${hasAudio ? '' : ' (estimated)'}`)

  captionPages[s.id] = pagesFor(s.vo, dur, align)

  const triggers = s.shots.map((sh) => sh.trigger).filter((t): t is string => Boolean(t))
  if (!triggers.length) continue

  const scene: Record<string, number> = {}
  const text = align ? align.characters.join('').toLowerCase() : s.vo.toLowerCase()
  for (const t of triggers) {
    const idx = text.indexOf(t.toLowerCase())
    if (idx === -1) {
      console.log(`  !! TRIGGER NOT FOUND in ${s.id}: "${t}" — omitted (shot falls back to an even split)`)
      unresolved.push(`${s.id}: ${t}`)
      continue
    }
    scene[t] = align
      ? Number((align.character_start_times_seconds[idx] ?? 0).toFixed(3))
      : Number(((idx / Math.max(1, s.vo.length)) * dur).toFixed(3))
  }
  cues[s.id] = scene
  console.log(`  cues: ${Object.entries(scene).map(([k, v]) => `${k}@${v}`).join(', ')}`)
}

let bedSeconds = 0
if (existsSync(BED)) {
  bedSeconds = await measure(BED)
  console.log(`music bed\t${bedSeconds}s`)
}

const mode: Timings['mode'] = missingAudio === 0 ? 'voiced' : 'captions'
if (mode === 'captions' && missingAudio < wt.scenes.length) {
  console.log(`! ${missingAudio} scene(s) missing mp3s — whole film falls back to captions mode`)
}

const total = Object.values(durations).reduce((a, b) => a + b, 0)
console.log(`mode: ${mode} — total VO ${total.toFixed(1)}s across ${Object.keys(durations).length} scenes`)
if (unresolved.length) console.log(`unresolved triggers: ${unresolved.length}\n  ${unresolved.join('\n  ')}`)

const timings: Timings = { durations, cues, bedSeconds, mode, captionPages }
mkdirSync(join(ROOT, 'public', wt.id), { recursive: true })
writeFileSync(join(ROOT, 'public', wt.id, 'timings.json'), JSON.stringify(timings, null, 2))
console.log(`wrote public/${wt.id}/timings.json`)
