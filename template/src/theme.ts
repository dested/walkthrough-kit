import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono'
import config from '../walkthrough.config.json'

const grotesk = loadSpaceGrotesk('normal', { weights: ['500', '700'], subsets: ['latin'] })
const inter = loadInter('normal', { weights: ['400', '500', '600'], subsets: ['latin'] })
const mono = loadJetBrainsMono('normal', { weights: ['500', '700'], subsets: ['latin'] })

export const CONFIG = config

export const F = {
  display: grotesk.fontFamily,
  body: inter.fontFamily,
  mono: mono.fontFamily,
}

function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Palette — the film runs dark so light app screenshots glow. Brand colors come
// from walkthrough.config.json.
export const C = {
  night: config.brand.night,
  nightSoft: config.brand.nightSoft,
  paper: config.brand.paper,
  paperMute: alpha(config.brand.paper, 0.62),
  paperFaint: alpha(config.brand.paper, 0.38),
  accent: config.brand.accent,
  accent2: config.brand.accent2,
  rim: 'rgba(255,255,255,0.09)',
  glass: 'rgba(12,13,17,0.88)',
}
