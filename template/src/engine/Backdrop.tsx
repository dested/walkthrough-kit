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

// There is deliberately no film-level finish (grain, vignette, sheen) layered
// over the composition. Anything above a screen capture greys white UI into a
// blown-out center bloom; screens render pixel-clean, and atmosphere lives
// only here, underneath them.
