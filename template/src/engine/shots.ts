import { Easing, interpolate } from 'remotion'
import type { CaptureManifest, Focus, Scene, Shot } from './types'
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
/**
 * Hard ceiling on a still's zoom. Captures are full-width app UI: past ~1.4x a
 * table loses its row labels off one edge and its values off the other. The
 * engine clamps to this whatever script.ts asks for, and scripts/framecheck.ts
 * fails any shot that asks for more.
 */
export const MAX_ZOOM = 1.4
/** Breathing room kept around a focus box, as a fraction of the frame per side. */
export const BOX_PAD = 0.04
/** A held focus creeps in by this much over its shot, so nothing is ever frozen. */
export const HOLD_CREEP = 0.018
/** The scene-title chip sits this far in from the frame's left and bottom (or top) edge. */
export const CHIP_MARGIN = 74
/** How long the scene-title chip stays up before it slides away. */
export const CHIP_HOLD_SECONDS = 4

/** Frames (scene-local) where the title chip starts in and has fully gone. */
export function chipWindow(dur: number, fps: number): [number, number] {
  const inAt = 12
  return [inAt, Math.min(dur - 4, inAt + Math.round(CHIP_HOLD_SECONDS * fps) + 16)]
}

/**
 * The title chip's footprint in composition pixels — a generous estimate from
 * the LowerThird styles (40px display title, 34px side padding), used by
 * scripts/framecheck.ts to prove the chip only ever sits over empty UI.
 */
export function chipBox(eyebrow: string, title: string, top: boolean, vh: number) {
  const w = 34 * 2 + Math.max(title.length * 23, eyebrow.trim() ? eyebrow.length * 18 + 40 : 0)
  const h = 22 + 24 + 44 + (eyebrow.trim() ? 34 : 0)
  const y = top ? CHIP_MARGIN : vh - CHIP_MARGIN - h
  return { x: CHIP_MARGIN, y, w, h }
}

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
/** Image size and frame size: what a focus box needs to pick its zoom. */
export type Fit = { iw: number; ih: number; vw: number; vh: number }

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

/**
 * The resting view for a focus. A box is centered and zoomed as tight as it can
 * go while the whole box (plus BOX_PAD, after the hold creep) stays on screen;
 * coverRect's edge clamp only ever slides the view toward the box, so it stays
 * in. Every path is capped at MAX_ZOOM.
 */
export function focusView(focus: Focus, fit: Fit): KbState {
  if ('box' in focus) {
    const { x0, y0, x1, y1 } = focus.box
    const cover = Math.max(fit.vw / fit.iw, fit.vh / fit.ih)
    // Fraction of the image's width / height on screen at scale 1.
    const fw = fit.vw / (fit.iw * cover)
    const fh = fit.vh / (fit.ih * cover)
    const room = (1 - 2 * BOX_PAD) / (1 + HOLD_CREEP)
    const fitScale = Math.min((fw * room) / Math.max(1e-3, x1 - x0), (fh * room) / Math.max(1e-3, y1 - y0))
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, scale: clamp(fitScale, 1, MAX_ZOOM) }
  }
  return { x: focus.x, y: focus.y, scale: clamp(focus.scale, 1, MAX_ZOOM) }
}

// A shot's view at `frame`. An unfocused shot shows the whole capture, edge to
// edge, and holds: any drift past 1.0x trims the app's outer columns (the nav
// rail, right-aligned buttons). A zoomed shot creeps in a hair while held; a
// box's fit already leaves room for that creep.
function shotState(win: ShotWindow, frame: number, fit: Fit): KbState {
  const focus = win.shot.focus
  if (!focus) return { x: 0.5, y: 0.5, scale: 1 }
  const view = focusView(focus, fit)
  if (view.scale <= 1) return view
  const p = interpolate(frame, [win.start, win.end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return { ...view, scale: view.scale * (1 + p * HOLD_CREEP) }
}

/** The layer's view at `frame`, easing between the group's focus targets. */
export function groupState(group: ShotGroup, frame: number, fit: Fit): KbState {
  const shots = group.shots
  let k = 0
  for (let i = 0; i < shots.length; i++) {
    if (frame >= shots[i].start) k = i
  }
  const cur = shotState(shots[k], frame, fit)
  if (k === 0) return cur
  const t = interpolate(frame, [shots[k].start, shots[k].start + ZOOM_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  })
  if (t >= 1) return cur
  const prev = shotState(shots[k - 1], frame, fit)
  return { x: lerp(prev.x, cur.x, t), y: lerp(prev.y, cur.y, t), scale: lerp(prev.scale, cur.scale, t) }
}

/** Scale the image to cover the frame at `scale`, centered on (x, y), never showing an edge. */
export function coverRect(iw: number, ih: number, vw: number, vh: number, view: KbState): Rect {
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
  return coverRect(dims.w, dims.h, vw, vh, groupState(group, frame, { iw: dims.w, ih: dims.h, vw, vh }))
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
