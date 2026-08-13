import { Easing, interpolate } from 'remotion'
import type { CaptureManifest, Scene, Shot } from './types'
import { shotKey } from './types'

/** Opacity crossfade when we land on a new screen. */
export const XFADE = 8
/**
 * Clicks land almost hard. A click usually swaps between two views of the same
 * page, and dissolving those over 8 frames doubles every line of text; a press
 * should snap the way the real app does.
 */
export const CLICK_XFADE = 3

/** How long this group takes to fade in over the one it replaces. */
export function fadeFrames(group: ShotGroup): number {
  return group.shots[0].shot.move === 'click' ? CLICK_XFADE : XFADE
}
/** Eased ken-burns move onto a new focus target. */
export const ZOOM_FRAMES = 26
/** Cursor settles this many frames before the click lands. */
export const CURSOR_ARRIVE = 18
/** Frames of cursor flight before it settles. */
export const CURSOR_FLY = 26
/** Two cues never collapse onto each other. */
const MIN_SHOT = 14

/** What the capture kit produces by default, used when the manifest didn't record a size. */
export function fallbackDims(pan?: boolean): { w: number; h: number } {
  const w = 2880
  return { w, h: pan ? ((w * 9) / 16) * 4 : (w * 9) / 16 }
}

export type ShotWindow = { shot: Shot; index: number; start: number; end: number }
/** Consecutive shots on the same capture — one image layer, one continuous move. */
export type ShotGroup = { img: string; start: number; end: number; shots: ShotWindow[] }
/** Normalized ken-burns view: centered on (x, y) of the image at `scale`. */
export type KbState = { x: number; y: number; scale: number }
/** Rendered image box in composition pixels. */
export type Rect = { w: number; h: number; x: number; y: number }

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

/**
 * Place each shot on the scene's local timeline. Shot 0 opens with the scene;
 * every other shot starts on its word cue, falling back to an even split of the
 * VO when the alignment has not been produced (or the word was not found).
 */
export function resolveShotWindows(
  scene: Scene,
  voStart: number,
  voDur: number,
  dur: number,
  fps: number,
  cues?: Record<string, number>,
): ShotWindow[] {
  const shots = scene.shots
  const n = shots.length
  if (n === 0) return []

  const starts: number[] = [0]
  for (let i = 1; i < n; i++) {
    const trigger = shots[i].trigger
    const cue = trigger ? cues?.[trigger] : undefined
    starts.push(cue != null ? voStart + Math.round(cue * fps) : voStart + Math.round((voDur * i) / n))
  }

  // Forward pass: strictly increasing, never before the scene opens.
  for (let i = 1; i < n; i++) {
    starts[i] = Math.max(starts[i], starts[i - 1] + MIN_SHOT)
  }
  // Backward pass: a late cue can't push a shot past the end of the scene.
  for (let i = n - 1; i >= 1; i--) {
    const cap = (i === n - 1 ? dur : starts[i + 1]) - MIN_SHOT
    if (starts[i] > cap) starts[i] = Math.max(starts[i - 1] + 1, cap)
  }

  return shots.map((shot, i) => ({
    shot,
    index: i,
    start: starts[i],
    end: i < n - 1 ? starts[i + 1] : dur,
  }))
}

/** Fold consecutive shots on the same image into one layer, so zooms stay continuous. */
export function groupShots(windows: ShotWindow[]): ShotGroup[] {
  const groups: ShotGroup[] = []
  for (const w of windows) {
    const last = groups[groups.length - 1]
    const key = shotKey(w.shot)
    if (last && last.img === key) {
      last.shots.push(w)
      last.end = w.end
    } else {
      groups.push({ img: key, start: w.start, end: w.end, shots: [w] })
    }
  }
  return groups
}

/** Which group a shot index lives in. */
export function groupOfShot(groups: ShotGroup[], index: number): ShotGroup | undefined {
  return groups.find((g) => g.shots.some((s) => s.index === index))
}

// A shot's view at `frame`. Nothing is ever frozen: unfocused shots drift wide
// to slightly tighter, focused shots creep in a hair while they're held.
function shotState(win: ShotWindow, frame: number): KbState {
  const p = interpolate(frame, [win.start, win.end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const focus = win.shot.focus
  if (focus) return { x: focus.x, y: focus.y, scale: focus.scale * (1 + p * 0.018) }
  return { x: 0.5, y: 0.5, scale: 1.02 + p * 0.03 }
}

/** The layer's view at `frame`, easing between the group's focus targets. */
export function groupState(group: ShotGroup, frame: number): KbState {
  const shots = group.shots
  let k = 0
  for (let i = 0; i < shots.length; i++) {
    if (frame >= shots[i].start) k = i
  }
  const cur = shotState(shots[k], frame)
  if (k === 0) return cur
  const t = interpolate(frame, [shots[k].start, shots[k].start + ZOOM_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  })
  if (t >= 1) return cur
  const prev = shotState(shots[k - 1], frame)
  return { x: lerp(prev.x, cur.x, t), y: lerp(prev.y, cur.y, t), scale: lerp(prev.scale, cur.scale, t) }
}

/** Scale the image to cover the frame at `scale`, centered on (x, y), never showing an edge. */
function coverRect(iw: number, ih: number, vw: number, vh: number, view: KbState): Rect {
  const base = Math.max(vw / iw, vh / ih) * view.scale
  const w = iw * base
  const h = ih * base
  return {
    w,
    h,
    x: clamp(vw / 2 - view.x * w, vw - w, 0),
    y: clamp(vh / 2 - view.y * h, vh - h, 0),
  }
}

/**
 * Ceiling on how fast a tall capture may scroll past the frame, in on-screen
 * pixels per second at 1080p. Captures run 6–11k px tall; travelling all of one
 * inside a shot would run 400–800 px/s, which is unwatchable.
 */
export const PAN_MAX_PX_PER_SEC = 170
/** Easing.inOut(Easing.sin) peaks at (π/2)× its average speed. */
const PAN_PEAK = Math.PI / 2

/** Scroll offsets a pan travels between, in on-screen pixels. */
type PanSpan = { from: number; to: number }

/**
 * How far down a tall capture we travel. Distance is capped to the speed limit,
 * so it is normal — and fine — to stop well short of the bottom. When a click
 * follows the pan, `destY` (normalized image y) must be on screen when the pan
 * lands, so we keep the destination and start further down rather than speed up.
 */
function panSpan(h: number, vh: number, frames: number, fps: number, destY?: number): PanSpan {
  const maxScroll = Math.max(0, h - vh)
  const cap = (PAN_MAX_PX_PER_SEC / PAN_PEAK) * (Math.max(1, frames) / fps)
  if (destY == null) return { from: 0, to: Math.min(maxScroll, cap) }
  const to = clamp(destY * h - vh / 2, 0, maxScroll)
  return { from: Math.max(0, to - cap), to }
}

export type LayerOpts = {
  /** Bring the move to rest by this frame — a cursor never chases a moving target. */
  settleAt?: number
  /** Normalized image y a pan has to leave on screen when it lands. */
  destY?: number
  fps?: number
}

/** Where this layer's image sits, in composition pixels, at `frame`. */
export function layerRect(
  group: ShotGroup,
  dims: { w: number; h: number },
  vw: number,
  vh: number,
  frame: number,
  { settleAt, destY, fps = 30 }: LayerOpts = {},
): Rect {
  if (group.shots[0].shot.pan) {
    // Hold at the top, glide down, settle — a readable scroll, never the whole page.
    const w = vw
    const h = (dims.h * vw) / dims.w
    const start = group.start + 8
    const end = Math.max(start + 24, settleAt ?? group.end - 12)
    const span = panSpan(h, vh, end - start, fps, destY)
    const t = interpolate(frame, [start, end], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.sin),
    })
    return { w, h, x: 0, y: -lerp(span.from, span.to, t) }
  }
  return coverRect(dims.w, dims.h, vw, vh, groupState(group, frame))
}

/**
 * A pan that a click follows has to end with the click target on screen. Returns
 * the normalized y of that target when the next shot clicks a point measured on
 * this same capture.
 */
export function panDest(
  windows: ShotWindow[],
  group: ShotGroup,
  manifest: CaptureManifest,
): number | undefined {
  if (!group.shots[0].shot.pan) return undefined
  const next = windows[group.shots[group.shots.length - 1].index + 1]
  const key = next?.shot.move === 'click' ? next.shot.cursorKey : undefined
  const pt = key ? manifest.points?.[key] : undefined
  return pt && pt.img === group.img ? pt.y : undefined
}

/** When a group's motion must be at rest: just before a cursor starts flying at it. */
export function settleFrame(windows: ShotWindow[], group: ShotGroup): number | undefined {
  const next = windows[group.shots[group.shots.length - 1].index + 1]
  if (!next || next.shot.move !== 'click') return undefined
  return next.start - CURSOR_ARRIVE - CURSOR_FLY
}

/** Turn a manifest point (normalized image coords) into a screen position. */
export function pointOnScreen(rect: Rect, pt: { x: number; y: number }) {
  return { x: rect.x + pt.x * rect.w, y: rect.y + pt.y * rect.h }
}
