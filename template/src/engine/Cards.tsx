import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, CONFIG, F } from '../theme'
import { RISE, SMOOTH } from '../lib/anim'
import type { Walkthrough } from './types'

/** The product name set in the brand type — the kit's stand-in for a logo. */
export const Wordmark: React.FC<{ fontSize: number; color: string }> = ({ fontSize, color }) => (
  <span
    style={{
      fontFamily: F.mono,
      fontWeight: 700,
      fontSize,
      letterSpacing: '0.26em',
      color,
      textTransform: 'uppercase',
    }}
  >
    {CONFIG.product}
  </span>
)

/** Cold open: the product mark, the walkthrough title, the one-line claim. */
export const ColdOpen: React.FC<{ wt: Walkthrough; dur: number }> = ({ wt, dur }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const pMark = spring({ frame: frame - 2, fps, config: RISE })
  const pTitle = spring({ frame: frame - 16, fps, config: SMOOTH })
  const pSub = spring({ frame: frame - 30, fps, config: SMOOTH })
  const out = interpolate(frame, [dur - 14, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const drift = interpolate(frame, [0, dur], [1, 1.03])

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
          transform: `scale(${drift})`,
        }}
      >
        <div style={{ opacity: pMark, transform: `translateY(${interpolate(pMark, [0, 1], [34, 0])}px)` }}>
          <Wordmark fontSize={40} color={C.paperMute} />
        </div>

        <div
          style={{
            fontFamily: F.display,
            fontWeight: 700,
            fontSize: 112,
            letterSpacing: '-0.025em',
            lineHeight: 1.04,
            maxWidth: 1500,
            textAlign: 'center',
            color: C.paper,
            opacity: pTitle,
            transform: `translateY(${interpolate(pTitle, [0, 1], [38, 0])}px)`,
          }}
        >
          {wt.title}
        </div>

        {wt.tagline ? (
          <div
            style={{
              maxWidth: 1180,
              textAlign: 'center',
              fontFamily: F.body,
              fontWeight: 500,
              fontSize: 37,
              lineHeight: 1.4,
              color: C.paperMute,
              opacity: pSub,
              transform: `translateY(${interpolate(pSub, [0, 1], [22, 0])}px)`,
            }}
          >
            {wt.tagline}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

/** Closing brand card — the last thing on screen before we fade out. */
export const OutroCard: React.FC<{ wt: Walkthrough }> = ({ wt }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const pMark = spring({ frame: frame - 6, fps, config: RISE })
  const pRule = spring({ frame: frame - 26, fps, config: SMOOTH })
  const pHead = spring({ frame: frame - 34, fps, config: SMOOTH })
  const pSub = spring({ frame: frame - 52, fps, config: SMOOTH })

  const headline = wt.outro?.headline ?? wt.title
  const sub = wt.outro?.sub ?? CONFIG.productUrl

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44 }}>
        <div style={{ opacity: pMark, transform: `translateY(${interpolate(pMark, [0, 1], [44, 0])}px)` }}>
          <Wordmark fontSize={64} color={C.paper} />
        </div>

        <div style={{ width: interpolate(pRule, [0, 1], [0, 92]), height: 3, background: C.accent, borderRadius: 2 }} />

        <div
          style={{
            fontFamily: F.display,
            fontWeight: 700,
            fontSize: 70,
            letterSpacing: '-0.02em',
            maxWidth: 1400,
            textAlign: 'center',
            color: C.paper,
            opacity: pHead,
            transform: `translateY(${interpolate(pHead, [0, 1], [26, 0])}px)`,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            fontFamily: F.mono,
            fontWeight: 500,
            fontSize: 36,
            letterSpacing: '0.22em',
            color: C.paperMute,
            opacity: pSub,
            transform: `translateY(${interpolate(pSub, [0, 1], [18, 0])}px)`,
          }}
        >
          {sub}
        </div>
      </div>
    </AbsoluteFill>
  )
}
