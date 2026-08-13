import React from 'react'
import { Composition, type CalculateMetadataFunction } from 'remotion'
import { WalkthroughFilm, type FilmProps } from './engine/Film'
import { EMPTY_MANIFEST, EMPTY_TIMINGS, type Walkthrough } from './engine/types'
import { loadJson } from './engine/data'
import { totalFrames } from './engine/timeline'
import { WALKTHROUGHS } from './videos'

const WIDTH = 1920
const HEIGHT = 1080

/**
 * Duration adapts to the measured (or estimated) VO lengths in
 * public/<id>/timings.json; both runtime files degrade to empty shapes so
 * Studio opens before any pipeline run has happened.
 */
const metadataFor =
  (wt: Walkthrough): CalculateMetadataFunction<FilmProps> =>
  async ({ abortSignal }) => {
    const timings = await loadJson(`${wt.id}/timings.json`, EMPTY_TIMINGS, abortSignal)
    const manifest = await loadJson(`${wt.id}/captures/capture-manifest.json`, EMPTY_MANIFEST, abortSignal)
    const fps = wt.fps ?? 30
    return {
      durationInFrames: totalFrames(wt, timings, fps),
      fps,
      props: { walkthrough: wt, timings, manifest },
      defaultOutName: wt.id,
    }
  }

export const RemotionRoot: React.FC = () => (
  <>
    {WALKTHROUGHS.map((wt) => (
      <Composition
        key={wt.id}
        id={wt.id}
        component={WalkthroughFilm}
        durationInFrames={300}
        fps={wt.fps ?? 30}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ walkthrough: wt, timings: EMPTY_TIMINGS, manifest: EMPTY_MANIFEST }}
        calculateMetadata={metadataFor(wt)}
      />
    ))}
  </>
)
