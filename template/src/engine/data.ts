import { staticFile } from 'remotion'
import type { CaptureManifest } from './types'

/**
 * Fetch a JSON file out of public/, merging it over `fallback` so a missing or
 * half-written file can never take the composition down.
 */
export async function loadJson<T extends object>(path: string, fallback: T, abortSignal?: AbortSignal): Promise<T> {
  try {
    const res = await fetch(staticFile(path), { signal: abortSignal })
    if (!res.ok) return fallback
    const data = (await res.json()) as Partial<T>
    return { ...fallback, ...data }
  } catch {
    return fallback
  }
}

/** Natural dimensions of a capture, tolerating manifest keys written without the extension. */
export function imageDims(manifest: CaptureManifest, img: string): { w: number; h: number } | null {
  const images = manifest.images ?? {}
  return images[img] ?? images[img.replace(/\.[a-z]+$/i, '')] ?? null
}

/** Whether a capture run has happened at all — if not, nothing is on disk to show. */
export function hasCaptures(manifest: CaptureManifest): boolean {
  return Object.keys(manifest.images ?? {}).length > 0
}
