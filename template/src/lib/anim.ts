import { interpolate, spring } from 'remotion'

export const SMOOTH = { damping: 200 } as const
export const SNAPPY = { damping: 22, stiffness: 210 } as const
export const RISE = { damping: 26, stiffness: 120 } as const

export function enter(frame: number, fps: number, delay = 0, config: object = SNAPPY) {
  return spring({ frame: frame - delay, fps, config })
}

/** 0→1 over `len` frames starting at `from`, clamped. */
export function easeIn(frame: number, from: number, len: number) {
  return interpolate(frame, [from, from + len], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

/** Scene-content fade: in over `overlap`, out over `overlap` at the end. */
export function sceneFade(frame: number, dur: number, overlap: number) {
  return interpolate(frame, [0, overlap, dur - overlap, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}
