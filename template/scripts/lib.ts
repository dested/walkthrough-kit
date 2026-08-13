// Shared plumbing for the pipeline scripts. Run everything with bun from the
// template root: `bun scripts/<name>.ts <walkthrough-slug> [flags]`.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ToneId, Walkthrough } from '../src/engine/types'
import { toneById, type Tone } from '../src/engine/tones'
import { WALKTHROUGHS } from '../src/videos'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export type KitConfig = {
  product: string
  productUrl: string
  baseUrl: string
  tone: ToneId
  voiceId: string
  captions: 'auto' | 'always'
}

export function readConfig(): KitConfig {
  const raw: unknown = JSON.parse(readFileSync(join(ROOT, 'walkthrough.config.json'), 'utf8'))
  if (!raw || typeof raw !== 'object') throw new Error('walkthrough.config.json is not an object')
  const o = raw as Record<string, unknown>
  const str = (k: string, fallback = ''): string => (typeof o[k] === 'string' ? (o[k] as string) : fallback)
  const toneId = str('tone', 'demo')
  return {
    product: str('product', 'Product'),
    productUrl: str('productUrl'),
    baseUrl: str('baseUrl'),
    tone: (['sizzle', 'demo', 'sales', 'tutorial'] as const).find((t) => t === toneId) ?? 'demo',
    voiceId: str('voiceId', 'nPczCjzI2devNBz1zQrb'),
    captions: o.captions === 'always' ? 'always' : 'auto',
  }
}

export function findWalkthrough(slug: string | undefined): Walkthrough {
  if (!slug) {
    throw new Error(`usage: bun scripts/<script>.ts <slug>\navailable: ${WALKTHROUGHS.map((w) => w.id).join(', ')}`)
  }
  const wt = WALKTHROUGHS.find((w) => w.id === slug)
  if (!wt) throw new Error(`walkthrough "${slug}" not in src/videos.ts (have: ${WALKTHROUGHS.map((w) => w.id).join(', ')})`)
  return wt
}

export function toneFor(wt: Walkthrough): Tone {
  return toneById(wt.tone ?? readConfig().tone, 'demo')
}

/** ELEVENLABS_API_KEY from env or the template root .env. Null = captions mode. */
export function elevenKey(): string | null {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY
  const envPath = join(ROOT, '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.*)$/)
      if (m) {
        const v = m[1].trim().replace(/^["']|["']$/g, '')
        if (v) return v
      }
    }
  }
  return null
}

/**
 * fetch with backoff on 429/5xx/network errors — one transient hiccup must not
 * kill an 18-scene batch. Non-retryable statuses return immediately.
 */
export async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let last: Response | Error = new Error('unreachable')
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init)
      if (res.ok || (res.status !== 429 && res.status < 500)) return res
      last = res
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e))
    }
    if (i < tries - 1) {
      const wait = 1500 * (i + 1) * (i + 1)
      console.warn(`  retry in ${wait / 1000}s (${last instanceof Response ? `HTTP ${last.status}` : last.message})`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  if (last instanceof Response) return last
  throw last
}

export function argFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

export function argValue(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}
