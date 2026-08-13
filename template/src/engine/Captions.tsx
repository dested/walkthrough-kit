import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, F } from '../theme'
import type { CaptionPage } from './types'

/**
 * Chunked narration text, bottom-center, in the glass style. Used when there is
 * no voice track (captions mode) or when captions are forced on in config.
 * Pages come pre-timed out of scripts/durations.ts — seconds relative to the
 * scene's VO start.
 */
export const Captions: React.FC<{ pages: CaptionPage[]; voStart: number }> = ({ pages, voStart }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = (frame - voStart) / fps

  const page = pages.find((p) => t >= p.from && t < p.to)
  if (!page) return null

  const inP = interpolate(t, [page.from, page.from + 0.18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const outP = interpolate(t, [page.to - 0.14, page.to], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = Math.min(inP, outP)

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 64,
        transform: `translateX(-50%) translateY(${(1 - inP) * 14}px)`,
        maxWidth: 1240,
        padding: '20px 34px 22px',
        borderRadius: 16,
        background: C.glass,
        border: `1px solid ${C.rim}`,
        boxShadow: '0 22px 60px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        opacity,
      }}
    >
      <span
        style={{
          fontFamily: F.body,
          fontWeight: 500,
          fontSize: 34,
          lineHeight: 1.35,
          color: C.paper,
          textAlign: 'center',
          display: 'block',
        }}
      >
        {page.text}
      </span>
    </div>
  )
}
