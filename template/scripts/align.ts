// Voiceover alignment machinery for the eleven_v3 pipeline. v3 has no native
// timestamp alignment, so: scribe_v1 word timestamps + an LCS word match
// produce a synthetic ElevenLabs-shaped character alignment — which is all
// durations.ts needs for trigger cues and caption pages.
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

export const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** A script word that remembers its character span in the VO text. */
export type ScriptWord = { w: string; from: number; to: number }
/** A transcribed word with clip-second timestamps. */
export type SttWord = { w: string; start: number; end: number }

export type Align = {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

/** Tokenize script text into words that remember their character span. */
export function scriptWords(vo: string): ScriptWord[] {
  const out: ScriptWord[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(vo))) {
    const w = norm(m[0])
    if (w) out.push({ w, from: m.index, to: m.index + m[0].length })
  }
  return out
}

/** LCS over normalized words -> monotonic index pairs [scriptIdx, sttIdx]. */
export function matchWords(a: readonly { w: string }[], b: readonly { w: string }[]): [number, number][] {
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i].w === b[j].w ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i].w === b[j].w) {
      pairs.push([i, j])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return pairs
}

/**
 * ElevenLabs-shaped alignment for `vo` from matched word anchors: piecewise
 * linear (charIndex -> seconds). Word starts come straight from the STT, which
 * is all trigger-cue resolution needs.
 */
export function syntheticAlign(
  vo: string,
  sWords: ScriptWord[],
  tWords: SttWord[],
  pairs: [number, number][],
  clipDur: number,
): Align {
  const anchors: [number, number][] = [[0, 0]]
  for (const [si, ti] of pairs) {
    anchors.push([sWords[si].from, tWords[ti].start])
    anchors.push([sWords[si].to, tWords[ti].end])
  }
  anchors.push([vo.length, clipDur])
  const clean: [number, number][] = [anchors[0]]
  for (const a of anchors.slice(1)) {
    const p = clean[clean.length - 1]
    if (a[0] >= p[0] && a[1] >= p[1]) clean.push(a)
  }
  const timeAt = (ci: number): number => {
    let lo = clean[0]
    let hi = clean[clean.length - 1]
    for (const a of clean) {
      if (a[0] <= ci) lo = a
      if (a[0] >= ci) {
        hi = a
        break
      }
    }
    if (hi[0] === lo[0]) return lo[1]
    return lo[1] + ((ci - lo[0]) / (hi[0] - lo[0])) * (hi[1] - lo[1])
  }
  const characters = vo.split('')
  const starts = characters.map((_, i) => Number(timeAt(i).toFixed(3)))
  const ends = characters.map((_, i) => Number(timeAt(i + 1).toFixed(3)))
  return { characters, character_start_times_seconds: starts, character_end_times_seconds: ends }
}

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
}

/** scribe_v1 word timestamps for an audio file, in clip seconds. */
export async function sttWords(file: string, key: string): Promise<{ words: SttWord[]; text: string }> {
  const form = new FormData()
  form.append('model_id', 'scribe_v1')
  const type = MIME[extname(file).toLowerCase()] ?? 'audio/mpeg'
  form.append('file', new Blob([readFileSync(file)], { type }), `audio${extname(file)}`)
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  })
  if (!res.ok) throw new Error(`STT ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { text?: string; words?: { type?: string; text: string; start: number; end: number }[] }
  const words = (json.words ?? [])
    .filter((w) => w.type !== 'spacing' && norm(w.text))
    .map((w) => ({ w: norm(w.text), start: w.start, end: w.end }))
  return { words, text: json.text ?? '' }
}
