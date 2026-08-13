/** Normalized ken-burns target: (x, y) center in 0..1 of the image, zoom scale. */
export type Focus = { x: number; y: number; scale: number }

export type Shot = {
  /** Still in public/<walkthrough>/captures/ (written by the capture run). */
  img?: string
  /** Recorded clip (webm/mp4) in public/<walkthrough>/captures/ — plays full-bleed instead of a still. */
  clip?: string
  /**
   * VO substring that starts this shot. First shot of a scene omits it (starts
   * with the scene). Matched case-insensitively against the alignment chars.
   */
  trigger?: string
  /** How we arrive: hard cut, animated cursor click, or smooth zoom. Default cut. */
  move?: 'cut' | 'click' | 'zoom'
  /** Key into capture-manifest.json points -> {x,y} where a click lands. */
  cursorKey?: string
  /** Ken-burns target while this shot is live. Omit = whole frame, gentle drift. */
  focus?: Focus
  /** Tall (fullPage) capture: pan top->bottom across this shot's duration. */
  pan?: boolean
}

export type Scene = {
  id: string
  /** Lower-third eyebrow (small caps) + title. Empty eyebrow = no lower-third. */
  eyebrow: string
  title: string
  vo: string
  shots: Shot[]
  /** 'outro' renders the brand card instead of shots. */
  card?: 'outro'
  leadSeconds?: number
  tailSeconds?: number
}

export type ToneId = 'sizzle' | 'demo' | 'sales' | 'tutorial'

export type Walkthrough = {
  /** Composition id + asset directory name. Lowercase slug. */
  id: string
  title: string
  /** One-line claim under the title on the cold open. */
  tagline?: string
  /** Overrides walkthrough.config.json. */
  tone?: ToneId
  voiceId?: string
  /** Closing card copy. Defaults: title + productUrl. */
  outro?: { headline: string; sub?: string }
  fps?: number
  scenes: Scene[]
}

/** One on-screen caption chunk, seconds relative to the scene's VO start. */
export type CaptionPage = { text: string; from: number; to: number }

/** public/<walkthrough>/timings.json — written by scripts/durations.ts. */
export type Timings = {
  /** Scene id -> VO length in seconds (measured, or estimated in captions mode). */
  durations: Record<string, number>
  /** Scene id -> trigger phrase -> seconds after that scene's VO starts. */
  cues: Record<string, Record<string, number>>
  /** Length of public/<walkthrough>/music.mp3. 0 = no bed. */
  bedSeconds: number
  /** voiced = mp3s exist; captions = estimated timings, show text instead of audio. */
  mode: 'voiced' | 'captions'
  captionPages: Record<string, CaptionPage[]>
}

/** public/<walkthrough>/captures/capture-manifest.json — what the capture run produced. */
export type CaptureManifest = {
  /** Image file name -> natural pixel dimensions. */
  images: Record<string, { w: number; h: number }>
  /** Cursor key -> the image it belongs to and a normalized 0..1 hit point. */
  points: Record<string, { img: string; x: number; y: number }>
}

export const EMPTY_TIMINGS: Timings = { durations: {}, cues: {}, bedSeconds: 0, mode: 'captions', captionPages: {} }
export const EMPTY_MANIFEST: CaptureManifest = { images: {}, points: {} }

/** The layer a shot draws: its clip if it has one, else its still. */
export function shotKey(shot: Shot): string {
  return shot.clip ?? shot.img ?? '(missing)'
}
