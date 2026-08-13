import type { Scene, Timings, Walkthrough } from './types'
import { toneById, type Tone } from './tones'
import { CONFIG } from '../theme'

// Stand-in VO length until the durations run — keeps Studio usable on day one.
const VO_FALLBACK = 6

/** Consecutive scenes crossfade over this many frames. */
export const OVERLAP = 14

/** The brand cold open that runs ahead of the first screen scene. */
export const COLD_OPEN_SECONDS = 3.2

export function coldOpenFrames(fps: number): number {
  return Math.round(COLD_OPEN_SECONDS * fps)
}

export function toneOf(wt: Walkthrough): Tone {
  return toneById(wt.tone ?? CONFIG.tone, 'demo')
}

export type Beat = {
  scene: Scene
  from: number // scene start frame, relative to the first scene (add the cold-open offset)
  dur: number // scene length in frames
  voStart: number // frames from scene start where VO begins
  voDur: number // frames of VO audio
}

export type Timeline = { beats: Beat[]; total: number }

export function buildTimeline(wt: Walkthrough, durations: Record<string, number>, fps: number): Timeline {
  const tone = toneOf(wt)
  const beats: Beat[] = []
  let cursor = 0
  wt.scenes.forEach((scene, i) => {
    const lead = scene.leadSeconds ?? tone.leadSeconds
    const vo = durations[scene.id] ?? VO_FALLBACK
    const tail = scene.tailSeconds ?? tone.tailSeconds
    const dur = Math.round((lead + vo + tail) * fps)
    beats.push({
      scene,
      from: cursor,
      dur,
      voStart: Math.round(lead * fps),
      voDur: Math.round(vo * fps),
    })
    cursor += dur - (i < wt.scenes.length - 1 ? OVERLAP : 0)
  })
  const last = beats[beats.length - 1]
  return { beats, total: last.from + last.dur }
}

/** Frames from composition start to the first scene — the cold open, less its crossfade. */
export function sceneOffset(fps: number): number {
  return coldOpenFrames(fps) - OVERLAP
}

/** Full composition length: cold open + every scene. */
export function totalFrames(wt: Walkthrough, timings: Timings, fps: number): number {
  return sceneOffset(fps) + buildTimeline(wt, timings.durations ?? {}, fps).total
}
