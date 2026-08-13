import React from 'react'
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Video } from '@remotion/media'
import { C, F } from '../theme'
import { SMOOTH } from '../lib/anim'
import { hasCaptures, imageDims } from './data'
import type { CaptureManifest, Scene } from './types'
import {
  fallbackDims,
  fadeFrames,
  groupOfShot,
  groupShots,
  layerRect,
  panDest,
  pointOnScreen,
  resolveShotWindows,
  settleFrame,
  type LayerOpts,
  type ShotGroup,
} from './shots'
import { ClickCursor } from './Cursor'

/** Stands in for a capture that has not been shot yet, so Studio still runs. */
const Placeholder: React.FC<{ name: string }> = ({ name }) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(160deg, ${C.nightSoft} 0%, #090A0D 100%)`,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <span
      style={{
        fontFamily: F.mono,
        fontWeight: 500,
        fontSize: 34,
        letterSpacing: '0.16em',
        color: C.paperFaint,
      }}
    >
      {name}
    </span>
  </AbsoluteFill>
)

/** One capture, full-bleed, carrying its own ken-burns move. */
const ShotLayer: React.FC<{
  group: ShotGroup
  opacity: number
  manifest: CaptureManifest
  move: LayerOpts
  assetBase: string
}> = ({ group, opacity, manifest, move, assetBase }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()

  // A recorded clip plays full-bleed from the moment its group lands — no
  // ken-burns; the motion is in the recording itself.
  if (group.shots[0].shot.clip) {
    return (
      <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
        <Sequence from={group.start} layout="none">
          <Video
            src={staticFile(`${assetBase}/${group.img}`)}
            muted
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Sequence>
      </AbsoluteFill>
    )
  }

  const dims = imageDims(manifest, group.img)

  // No manifest at all means the capture run hasn't happened — nothing to load.
  // A manifest that simply forgot to record this one still gets rendered, at the
  // size the capture kit is set to produce.
  if (!dims && !hasCaptures(manifest)) {
    return (
      <AbsoluteFill style={{ opacity }}>
        <Placeholder name={group.img} />
      </AbsoluteFill>
    )
  }

  const rect = layerRect(group, dims ?? fallbackDims(group.shots[0].shot.pan), width, height, frame, move)
  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      <Img
        src={staticFile(`${assetBase}/${group.img}`)}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: rect.w,
          height: rect.h,
          display: 'block',
          transform: `translate(${rect.x}px, ${rect.y}px)`,
        }}
      />
    </AbsoluteFill>
  )
}

/** Glass chip, bottom-left (top-left when captions own the bottom edge):
 * what we're looking at. Stays out of the screenshot's way. */
const LowerThird: React.FC<{ eyebrow: string; title: string; dur: number; top?: boolean }> = ({
  eyebrow,
  title,
  dur,
  top,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const p = spring({ frame: frame - 12, fps, config: SMOOTH })
  const out = interpolate(frame, [dur - 20, dur - 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = p * (1 - out)
  if (opacity <= 0.01) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: 74,
        ...(top ? { top: 74 } : { bottom: 74 }),
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
        padding: '22px 34px 24px',
        borderRadius: 18,
        background: C.glass,
        border: `1px solid ${C.rim}`,
        boxShadow: '0 26px 70px rgba(0,0,0,0.62)',
        backdropFilter: 'blur(10px)',
        opacity,
        transform: `translateX(${interpolate(p, [0, 1], [-46, 0]) - out * 70}px)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 26, height: 3, background: C.accent2, borderRadius: 2 }} />
        <span
          style={{
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 19,
            letterSpacing: '0.3em',
            color: C.accent,
          }}
        >
          {eyebrow}
        </span>
      </div>
      <span
        style={{
          fontFamily: F.display,
          fontWeight: 700,
          fontSize: 40,
          letterSpacing: '-0.012em',
          lineHeight: 1.1,
          color: C.paper,
        }}
      >
        {title}
      </span>
    </div>
  )
}

/**
 * The core beat of a walkthrough: a scene's captures presented full-bleed,
 * moving from shot to shot on the VO's word cues — cuts crossfade, zooms glide
 * onto a focus target, clicks fly a cursor in and press before the screen
 * changes.
 */
export const ScreenScene: React.FC<{
  scene: Scene
  voStart: number
  voDur: number
  dur: number
  manifest: CaptureManifest
  cues?: Record<string, number>
  assetBase: string
  captionsOn?: boolean
}> = ({ scene, voStart, voDur, dur, manifest, cues, assetBase, captionsOn }) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const windows = resolveShotWindows(scene, voStart, voDur, dur, fps, cues)
  const groups = groupShots(windows)
  const moveOf = (group: ShotGroup): LayerOpts => ({
    settleAt: settleFrame(windows, group),
    destY: panDest(windows, group, manifest),
    fps,
  })

  return (
    <AbsoluteFill style={{ backgroundColor: C.night, overflow: 'hidden' }}>
      {groups.map((group, gi) => {
        const next = groups[gi + 1]
        // Fully covered by the next layer — drop it so we never hold every capture at once.
        if (next && frame >= next.start + fadeFrames(next)) return null
        const opacity =
          gi === 0
            ? 1
            : interpolate(frame, [group.start, group.start + fadeFrames(group)], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
        if (opacity <= 0) return null
        return (
          <ShotLayer
            key={`${group.img}-${gi}`}
            group={group}
            opacity={opacity}
            manifest={manifest}
            move={moveOf(group)}
            assetBase={assetBase}
          />
        )
      })}

      {windows.map((win) => {
        if (win.shot.move !== 'click' || win.index === 0) return null
        // The click lands on the screen we're leaving, so the target is read off
        // the previous layer's live transform (it keeps drifting under the cursor).
        const prev = groupOfShot(groups, win.index - 1)
        const pt = win.shot.cursorKey ? manifest.points?.[win.shot.cursorKey] : undefined
        const dims = prev ? (imageDims(manifest, prev.img) ?? fallbackDims(prev.shots[0].shot.pan)) : null
        const target =
          prev && pt && dims
            ? pointOnScreen(layerRect(prev, dims, width, height, frame, moveOf(prev)), pt)
            : { x: width / 2, y: height / 2 }
        return <ClickCursor key={`click-${win.index}`} cue={win.start} target={target} earliest={prev?.start ?? 0} />
      })}

      {scene.eyebrow ? <LowerThird eyebrow={scene.eyebrow} title={scene.title} dur={dur} top={captionsOn} /> : null}
    </AbsoluteFill>
  )
}
