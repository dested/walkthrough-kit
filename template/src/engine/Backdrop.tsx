import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C } from '../theme'

function glow(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/**
 * The film-level dark atmosphere: deep ink base with two slow-drifting brand
 * glows and a faint top light. Runs continuously under every scene so
 * crossfades never flash.
 */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  const t = frame / 30

  const x1 = Math.sin(t * 0.11) * 140
  const y1 = Math.cos(t * 0.09) * 90
  const x2 = Math.cos(t * 0.07) * 170
  const y2 = Math.sin(t * 0.1) * 110

  return (
    <AbsoluteFill style={{ backgroundColor: C.night, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${C.nightSoft} 0%, ${C.night} 46%, #08090C 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1600,
          height: 1600,
          right: -560 + x1,
          bottom: -820 + y1,
          background: `radial-gradient(circle, ${glow(C.accent2, 0.12)} 0%, ${glow(C.accent2, 0)} 62%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1500,
          height: 1500,
          left: -640 + x2,
          top: -760 + y2,
          background: `radial-gradient(circle, ${glow(C.accent, 0.1)} 0%, ${glow(C.accent, 0)} 60%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 2400,
          height: 900,
          left: '50%',
          top: -560,
          transform: 'translateX(-50%)',
          background: `radial-gradient(ellipse, ${glow(C.paper, 0.05)} 0%, ${glow(C.paper, 0)} 60%)`,
        }}
      />
    </AbsoluteFill>
  )
}

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/** Film grain + vignette, layered above everything. */
export const Finish: React.FC = () => {
  return (
    <>
      <AbsoluteFill
        style={{
          backgroundImage: NOISE,
          backgroundRepeat: 'repeat',
          opacity: 0.05,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 78% 68% at 50% 46%, transparent 58%, rgba(0,0,0,0.42) 100%)',
          pointerEvents: 'none',
        }}
      />
    </>
  )
}
