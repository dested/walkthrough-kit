import React from 'react'
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Audio as MediaAudio } from '@remotion/media'
import { C, CONFIG } from '../theme'
import { sceneFade } from '../lib/anim'
import { Backdrop, Finish } from './Backdrop'
import { Captions } from './Captions'
import { ColdOpen, OutroCard, Wordmark } from './Cards'
import { ScreenScene } from './ScreenScene'
import { EMPTY_MANIFEST, EMPTY_TIMINGS, type CaptureManifest, type Timings, type Walkthrough } from './types'
import { OVERLAP, buildTimeline, coldOpenFrames, sceneOffset, toneOf } from './timeline'

export type FilmProps = {
  walkthrough: Walkthrough
  timings: Timings
  manifest: CaptureManifest
}

const FadeWrap: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame()
  return <AbsoluteFill style={{ opacity: sceneFade(frame, dur, OVERLAP) }}>{children}</AbsoluteFill>
}

/**
 * Quiet brand mark, top-right, in a dark chip so it survives light screenshots.
 * On once the cold open clears, off for the outro card.
 */
const BrandBadge: React.FC<{ from: number; until: number }> = ({ from, until }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [from, from + 24, until - 20, until], [0, 0.92, 0.92, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  if (opacity <= 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        top: 42,
        right: 54,
        padding: '13px 22px 14px',
        borderRadius: 14,
        background: C.glass,
        border: `1px solid ${C.rim}`,
        boxShadow: '0 18px 46px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        opacity,
      }}
    >
      <Wordmark fontSize={22} color={C.paper} />
    </div>
  )
}

/** The final settle to black. */
const FadeOut: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [total - 44, total - 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  if (opacity <= 0) return null
  return <AbsoluteFill style={{ backgroundColor: '#000', opacity, pointerEvents: 'none' }} />
}

export const WalkthroughFilm: React.FC<FilmProps> = ({
  walkthrough,
  timings = EMPTY_TIMINGS,
  manifest = EMPTY_MANIFEST,
}) => {
  const { fps } = useVideoConfig()
  const wt = walkthrough
  const durations = timings.durations ?? {}
  const cold = coldOpenFrames(fps)
  const offset = sceneOffset(fps)
  const { beats, total } = buildTimeline(wt, durations, fps)
  const end = offset + total

  const voiced = timings.mode === 'voiced'
  const showCaptions = !voiced || CONFIG.captions === 'always'

  // Composition-absolute windows where a voice track is actually playing.
  const voSpans: [number, number][] = voiced
    ? beats
        .filter((b) => durations[b.scene.id] != null)
        .map((b) => [offset + b.from + b.voStart, offset + b.from + b.voStart + b.voDur])
    : []

  const outro = beats.find((b) => b.scene.card === 'outro')

  return (
    <AbsoluteFill style={{ backgroundColor: C.night }}>
      <Backdrop />

      <Sequence from={0} durationInFrames={cold} name="cold-open" premountFor={30}>
        <ColdOpen wt={wt} dur={cold} />
      </Sequence>

      {beats.map((b) => (
        <Sequence
          key={b.scene.id}
          from={offset + b.from}
          durationInFrames={b.dur}
          name={b.scene.id}
          premountFor={45}
        >
          <FadeWrap dur={b.dur}>
            {b.scene.card === 'outro' ? (
              <OutroCard wt={wt} />
            ) : (
              <ScreenScene
                scene={b.scene}
                voStart={b.voStart}
                voDur={b.voDur}
                dur={b.dur}
                manifest={manifest}
                cues={timings.cues?.[b.scene.id]}
                assetBase={`${wt.id}/captures`}
                captionsOn={showCaptions}
              />
            )}
            {showCaptions ? (
              <Captions pages={timings.captionPages?.[b.scene.id] ?? []} voStart={b.voStart} />
            ) : null}
          </FadeWrap>
          {voiced && durations[b.scene.id] != null ? (
            <Sequence from={b.voStart} name={`vo:${b.scene.id}`}>
              <Audio src={staticFile(`${wt.id}/vo/${b.scene.id}.mp3`)} volume={0.98} />
            </Sequence>
          ) : null}
        </Sequence>
      ))}

      {timings.bedSeconds > 0 ? (
        <MusicBed wt={wt} bedSeconds={timings.bedSeconds} spans={voSpans} total={end} />
      ) : null}

      <BrandBadge from={cold - 18} until={outro ? offset + outro.from + OVERLAP : end} />

      <Finish />
      <FadeOut total={end} />
    </AbsoluteFill>
  )
}

// Music sits under the whole runtime. The bed is usually shorter than the film,
// so extra passes crossfade in at each seam, and the whole thing ducks out of
// the way whenever the narrator is talking.
const BED_XFADE = 60 // frames of tail→head crossfade at each loop seam
const DUCK_RAMP = 20

const MusicBed: React.FC<{ wt: Walkthrough; bedSeconds: number; spans: [number, number][]; total: number }> = ({
  wt,
  bedSeconds,
  spans,
  total,
}) => {
  const { fps } = useVideoConfig()
  const tone = toneOf(wt)
  const bedFrames = Math.max(BED_XFADE * 2, Math.floor(bedSeconds * fps))

  // Global music volume at composition frame `f`.
  const volumeAt = (f: number) => {
    const env = interpolate(f, [0, 50, total - 96, total - 8], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
    let duck = tone.duckOpen
    for (const [s, e] of spans) {
      const d = interpolate(
        f,
        [s - DUCK_RAMP, s, e, e + DUCK_RAMP],
        [tone.duckOpen, tone.duckVo, tone.duckVo, tone.duckOpen],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      )
      if (d < duck) duck = d
    }
    return env * duck
  }

  const stride = bedFrames - BED_XFADE
  const passes = Math.max(1, Math.ceil(total / stride))
  return (
    <>
      {Array.from({ length: passes }, (_, i) => {
        const from = i * stride
        if (from >= total) return null
        const last = i === passes - 1
        return (
          <Sequence key={`bed-${i}`} from={from} durationInFrames={bedFrames}>
            <MediaAudio
              src={staticFile(`${wt.id}/music.mp3`)}
              volume={(f) => {
                // f is relative to this pass; fade across the loop seams
                const fadeIn =
                  i === 0
                    ? 1
                    : interpolate(f, [0, BED_XFADE], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                      })
                const fadeOut = last
                  ? 1
                  : interpolate(f, [bedFrames - BED_XFADE, bedFrames], [1, 0], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    })
                return volumeAt(from + f) * fadeIn * fadeOut
              }}
            />
          </Sequence>
        )
      })}
    </>
  )
}
