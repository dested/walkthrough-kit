import React from 'react'
import { Easing, interpolate, useCurrentFrame } from 'remotion'
import { C } from '../theme'
import { CURSOR_ARRIVE, CURSOR_FLY } from './shots'

// The arrow is drawn in a 24x32 box with its tip at (5, 2.2), so the rendered
// glyph is offset by that tip to make the point the actual hotspot.
const GLYPH_W = 34
const GLYPH_H = 45
const TIP_X = (5 / 24) * GLYPH_W
const TIP_Y = (2.2 / 32) * GLYPH_H

/** A clean white mouse pointer, tip at (x, y). */
export const Cursor: React.FC<{ x: number; y: number; scale?: number; opacity?: number }> = ({
  x,
  y,
  scale = 1,
  opacity = 1,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x - TIP_X,
      top: y - TIP_Y,
      width: GLYPH_W,
      height: GLYPH_H,
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: `${TIP_X}px ${TIP_Y}px`,
      // Two shadows: a tight one so the glyph separates from light UI, a soft one for depth.
      filter: 'drop-shadow(0 1px 2px rgba(10,11,14,0.5)) drop-shadow(0 8px 18px rgba(10,11,14,0.45))',
    }}
  >
    <svg width={GLYPH_W} height={GLYPH_H} viewBox="0 0 24 32" fill="none">
      <path
        d="M5 2.2 L5 27.4 L11.1 21.4 L14.9 29.8 L18.7 28.0 L14.8 19.9 L22.4 19.3 Z"
        fill="#FFFFFF"
        stroke="rgba(10,11,14,0.92)"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </svg>
  </div>
)

/** The soft accent ring that expands out of a click. */
export const Ripple: React.FC<{ x: number; y: number; cue: number }> = ({ x, y, cue }) => {
  const frame = useCurrentFrame()
  if (frame < cue) return null
  const r = interpolate(frame, [cue, cue + 26], [10, 96], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const opacity = interpolate(frame, [cue, cue + 26], [0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  if (opacity <= 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        border: `3px solid ${C.accent}`,
        boxShadow: `0 0 0 1px rgba(10,11,14,${opacity * 0.28}), 0 6px 22px rgba(10,11,14,${opacity * 0.3})`,
        opacity,
      }}
    />
  )
}

/**
 * A full click: the pointer arcs in, settles a beat before the cue, presses
 * exactly on the cue frame, ripples, then fades out over the new screen.
 */
export const ClickCursor: React.FC<{ cue: number; target: { x: number; y: number }; earliest?: number }> = ({
  cue,
  target,
  earliest = 0,
}) => {
  const frame = useCurrentFrame()

  const arrive = Math.max(earliest + 6, cue - CURSOR_ARRIVE)
  const start = Math.max(earliest, arrive - CURSOR_FLY)
  if (frame < start) return null

  // Comes in low and to the left, along a shallow arc.
  const from = { x: target.x - 300, y: target.y + 240 }
  const ctrl = { x: (from.x + target.x) / 2 + 76, y: (from.y + target.y) / 2 - 118 }
  const t = interpolate(frame, [start, arrive], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const inv = 1 - t
  const x = inv * inv * from.x + 2 * inv * t * ctrl.x + t * t * target.x
  const y = inv * inv * from.y + 2 * inv * t * ctrl.y + t * t * target.y

  const press = interpolate(frame, [cue - 4, cue, cue + 7], [1, 0.84, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  })
  const opacity = interpolate(frame, [start, start + 9, cue + 16, cue + 30], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  if (opacity <= 0) return null

  return (
    <>
      <Ripple x={target.x} y={target.y} cue={cue} />
      <Cursor x={x} y={y} scale={press} opacity={opacity} />
    </>
  )
}
