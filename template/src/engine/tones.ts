import type { ToneId } from './types'

export type Tone = {
  id: ToneId
  label: string
  /** Read-rate used to ESTIMATE scene durations when no mp3 exists (captions mode). */
  wpm: number
  /** Silence before the VO starts, so the screen settles before the narrator talks. */
  leadSeconds: number
  /** Hold after the VO ends, so the shot lands before we move on. */
  tailSeconds: number
  /**
   * TTS is always eleven_v3, whose stability is discrete (0.0 creative /
   * 0.5 natural / 1.0 robust). Expressive tones roll one Creative take for
   * upside; measured tones stay Natural-only.
   */
  expressive: boolean
  /** Music volume while the narrator is talking / between lines. */
  duckVo: number
  duckOpen: number
  /** Default prompt for scripts/music.ts. */
  musicPrompt: string
}

export const TONES: Record<ToneId, Tone> = {
  sizzle: {
    id: 'sizzle',
    label: 'Sizzle — fast, punchy tech demo',
    wpm: 175,
    leadSeconds: 0.35,
    tailSeconds: 0.25,
    expressive: true,
    duckVo: 0.3,
    duckOpen: 0.55,
    musicPrompt:
      'Confident, modern electronic instrumental for a fast software sizzle reel. Driving but clean pulse, warm synth bass, bright plucks, subtle risers. No vocals, no drops that compete with a narrator. Consistent tempo around 112 BPM, single key. Loopable: clean downbeat start and end.',
  },
  demo: {
    id: 'demo',
    label: 'Demo — confident product walkthrough',
    wpm: 155,
    leadSeconds: 0.55,
    tailSeconds: 0.4,
    expressive: true,
    duckVo: 0.28,
    duckOpen: 0.5,
    musicPrompt:
      'Calm, warm, understated instrumental background for a software product walkthrough. Soft felt piano and warm analog pads, light steady pulse holding gentle forward motion. Optimistic but restrained and professional. No vocals, no big drops, no lead melody that competes with speech. Even dynamics, consistent tempo around 95 BPM, single key. Loopable: clean downbeat start and end.',
  },
  sales: {
    id: 'sales',
    label: 'Sales — warm, persuasive pitch',
    wpm: 140,
    leadSeconds: 0.7,
    tailSeconds: 0.5,
    expressive: true,
    duckVo: 0.26,
    duckOpen: 0.48,
    musicPrompt:
      'Warm, inspiring, cinematic-lite instrumental for a product pitch video. Felt piano, soft strings, gentle build of warmth without a drop. Emotive but professional, always behind a narrator. No vocals, no drum fills. Even dynamics, around 88 BPM, single key. Loopable: clean downbeat start and end.',
  },
  tutorial: {
    id: 'tutorial',
    label: 'Tutorial — calm, unhurried explainer',
    wpm: 135,
    leadSeconds: 0.8,
    tailSeconds: 0.6,
    expressive: false,
    duckVo: 0.22,
    duckOpen: 0.4,
    musicPrompt:
      'Minimal, neutral ambient instrumental for a software tutorial. Soft pads and sparse piano, barely-there pulse. Unobtrusive and even — a texture, not a track. No vocals, no melody hooks, no builds. Consistent quiet dynamics, around 80 BPM, single key. Loopable: clean start and end.',
  },
}

export const TONE_IDS = Object.keys(TONES) as ToneId[]

export function toneById(id: string | undefined, fallback: ToneId): Tone {
  if (id && id in TONES) return TONES[id as ToneId]
  return TONES[fallback]
}
