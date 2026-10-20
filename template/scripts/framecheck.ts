// Framing preflight. Walks every frame a still is on screen (every few frames,
// exactly as the engine will place it) and fails when any of them would:
//   - ask for a zoom past MAX_ZOOM (the engine clamps it, so the shot isn't what you wrote)
//   - leave part of a focus box off screen
//   - cut through text or a control at a frame edge — a pixel scan of the capture
//     along each crop line: ink on both sides of the line means something is sliced
//   - park the scene-title chip over app content
//   - fly a click cursor at a missing, (0,0) or off-screen point, or one measured
//     on a different capture than the one it lands on
// scripts/render.ts runs this first and refuses to render on a failure.
//
// Run: bun scripts/framecheck.ts <slug> [--frames]
//   --frames  also print start/mid/end composition frames of every zoomed shot,
//             for pulling verification stills out of the render.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import {
  HOLD_CREEP,
  MAX_ZOOM,
  ZOOM_FRAMES,
  chipBox,
  chipWindow,
  fadeFrames,
  coverRect,
  focusView,
  groupShots,
  layerRect,
  pointOnScreen,
  resolveShotWindows,
  type KbState,
  type Rect,
  type ShotGroup,
  type ShotWindow,
} from '../src/engine/shots'
import { FRAME_H, FRAME_W, buildTimeline, sceneOffset } from '../src/engine/timeline'
import { EMPTY_MANIFEST, EMPTY_TIMINGS, type CaptureManifest, type Timings, type Walkthrough } from '../src/engine/types'
import { ROOT, findWalkthrough, readConfig } from './lib'

/** Image px scanned on each side of a crop line. */
const BAND = 10
/** Luminance distance from the local background that counts as ink (text, icons, controls). Hairlines and tints stay under it. */
const INK = 56
/** A cut = at least HITS straddling rows/columns inside any WINDOW-px stretch of the line. */
const WINDOW = 40
const HITS = 10
/** Fraction of the chip's footprint (plus margin) that may be ink before it counts as covering content. */
const CHIP_INK = 0.002
const CHIP_PAD = 16
const STEP = 3

export type Problem = {
  scene: string
  shot: number
  img: string
  kind: string
  /** The first offending frame's finding. */
  detail: string
  /** First and last offending composition frame, and how many sampled frames failed. */
  frames: [number, number]
  hits: number
}

/** One line per problem, shared by framecheck and render. */
export function describe(p: Problem, fps = 30): string {
  const ts = (f: number) => `${Math.floor(f / fps / 60)}:${(f / fps % 60).toFixed(1).padStart(4, '0')}`
  return `FAIL ${p.scene} shot ${p.shot} (${p.img}) [${p.kind}] ${ts(p.frames[0])}-${ts(p.frames[1])} f${p.frames[0]}-${p.frames[1]} (${p.hits} sampled frame${p.hits === 1 ? '' : 's'}): ${p.detail}`
}

type Gray = { w: number; h: number; px: Uint8Array }

const grays = new Map<string, Gray>()
function loadGray(file: string): Gray {
  const hit = grays.get(file)
  if (hit) return hit
  const png = PNG.sync.read(readFileSync(file))
  const px = new Uint8Array(png.width * png.height)
  for (let i = 0, j = 0; i < px.length; i++, j += 4) {
    px[i] = (png.data[j] * 299 + png.data[j + 1] * 587 + png.data[j + 2] * 114) / 1000
  }
  const g = { w: png.width, h: png.height, px }
  grays.set(file, g)
  return g
}

function median(values: number[]): number {
  values.sort((a, b) => a - b)
  return values[values.length >> 1] ?? 0
}

/**
 * Scan a crop line for content sliced in two. `along` runs the length of the line,
 * `at` is its position across. Returns the offending stretch (image px along the
 * line) or null.
 */
function cutAcross(g: Gray, vertical: boolean, at: number, from: number, to: number): [number, number] | null {
  const span = vertical ? g.w : g.h
  // At (or beyond) the capture's own edge there's nothing past the line to cut.
  if (at - BAND < 0 || at + BAND > span) return null
  const lo = Math.max(0, Math.floor(from))
  const hi = Math.min(vertical ? g.h : g.w, Math.ceil(to))
  const read = (along: number, across: number) => (vertical ? g.px[along * g.w + across] : g.px[across * g.w + along])
  const hit = new Uint8Array(Math.max(0, hi - lo))
  for (let a = lo; a < hi; a++) {
    const sample: number[] = []
    for (let c = Math.max(0, at - 48); c < Math.min(span, at + 48); c += 2) sample.push(read(a, c))
    const bg = median(sample)
    let before = false
    let after = false
    for (let c = at - BAND; c < at; c++) if (Math.abs(read(a, c) - bg) > INK) before = true
    for (let c = at; c < at + BAND; c++) if (Math.abs(read(a, c) - bg) > INK) after = true
    hit[a - lo] = before && after ? 1 : 0
  }
  let count = 0
  for (let i = 0; i < hit.length; i++) {
    count += hit[i]
    if (i >= WINDOW) count -= hit[i - WINDOW]
    if (count >= HITS) {
      // Report the stretch: back to the window start, forward while hits keep coming.
      let e = i
      while (e + 1 < hit.length && hit.subarray(e + 1, e + 4).some(Boolean)) e++
      return [lo + Math.max(0, i - WINDOW + 1), lo + e]
    }
  }
  return null
}

/** Ink fraction of an image region (relative to its own median background). */
function inkFraction(g: Gray, x0: number, y0: number, x1: number, y1: number): number {
  const ax = Math.max(0, Math.floor(x0))
  const ay = Math.max(0, Math.floor(y0))
  const bx = Math.min(g.w, Math.ceil(x1))
  const by = Math.min(g.h, Math.ceil(y1))
  if (bx <= ax || by <= ay) return 0
  const sample: number[] = []
  for (let y = ay; y < by; y += 3) for (let x = ax; x < bx; x += 3) sample.push(g.px[y * g.w + x])
  const bg = median(sample)
  let ink = 0
  let n = 0
  for (let y = ay; y < by; y++) {
    for (let x = ax; x < bx; x++) {
      n++
      if (Math.abs(g.px[y * g.w + x] - bg) > INK) ink++
    }
  }
  return n ? ink / n : 0
}

/** The part of the image on screen for a rendered rect, in image px. */
function visible(rect: Rect, iw: number, ih: number) {
  return {
    x0: (-rect.x * iw) / rect.w,
    x1: ((FRAME_W - rect.x) * iw) / rect.w,
    y0: (-rect.y * ih) / rect.h,
    y1: ((FRAME_H - rect.y) * ih) / rect.h,
  }
}

/** Every crop line of a rendered rect that slices content. A line on the capture's own edge is skipped inside cutAcross. */
function edgeCuts(g: Gray, rect: Rect): { edge: string; where: string }[] {
  const v = visible(rect, g.w, g.h)
  const edges: [string, boolean, number, number, number][] = [
    ['left', true, Math.round(v.x0), v.y0, v.y1],
    ['right', true, Math.round(v.x1), v.y0, v.y1],
    ['top', false, Math.round(v.y0), v.x0, v.x1],
    ['bottom', false, Math.round(v.y1), v.x0, v.x1],
  ]
  const out: { edge: string; where: string }[] = []
  for (const [edge, vertical, at, a, z] of edges) {
    const cut = cutAcross(g, vertical, at, a, z)
    if (cut) out.push({ edge, where: vertical ? `x=${at}, y ${cut[0]}-${cut[1]}` : `y=${at}, x ${cut[0]}-${cut[1]}` })
  }
  return out
}

/**
 * The nearest clean framing to a view that slices content: same zoom first,
 * nudged up/down (and a little sideways), then progressively wider. Clean at
 * every step of the hold creep. Null when even the full frame is the answer.
 */
function suggest(g: Gray, view: KbState): KbState | null {
  const fit = { vw: FRAME_W, vh: FRAME_H }
  // The hold creep sweeps every edge a few px, so check the whole creep, not just its ends.
  const clean = (k: KbState) =>
    Array.from({ length: 21 }, (_, i) => i / 20).every(
      (p) => edgeCuts(g, coverRect(g.w, g.h, fit.vw, fit.vh, { ...k, scale: k.scale * (1 + p * HOLD_CREEP) })).length === 0,
    )
  const dys: number[] = [0]
  for (let d = 0.005; d <= 0.2; d += 0.005) dys.push(d, -d)
  for (let ds = 0; ds <= 0.3; ds += 0.02) {
    const scale = Math.max(1.02, view.scale - ds)
    for (const dy of dys) {
      for (const dx of [0, 0.01, -0.01, 0.025, -0.025]) {
        const k = { x: view.x + dx, y: view.y + dy, scale }
        if (clean(k)) return k
      }
    }
    if (scale === 1.02) break
  }
  return null
}

function shotAt(group: ShotGroup, frame: number): ShotWindow {
  let cur = group.shots[0]
  for (const s of group.shots) if (frame >= s.start) cur = s
  return cur
}

export function framecheck(wt: Walkthrough, opts: { frames?: boolean } = {}): Problem[] {
  const fps = wt.fps ?? 30
  const dir = join(ROOT, 'public', wt.id)
  const timingsPath = join(dir, 'timings.json')
  const manifestPath = join(dir, 'captures', 'capture-manifest.json')
  const timings: Timings = existsSync(timingsPath) ? JSON.parse(readFileSync(timingsPath, 'utf8')) : EMPTY_TIMINGS
  const manifest: CaptureManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : EMPTY_MANIFEST
  const captionsOn = timings.mode !== 'voiced' || readConfig().captions === 'always'
  const { beats } = buildTimeline(wt, timings.durations ?? {}, fps)
  const offset = sceneOffset(fps)

  const found = new Map<string, Problem>()
  const report = (p: Omit<Problem, 'hits'>) => {
    const key = `${p.scene}|${p.shot}|${p.kind}`
    const prev = found.get(key)
    if (prev) {
      prev.frames[1] = Math.max(prev.frames[1], p.frames[1])
      prev.hits++
    } else found.set(key, { ...p, hits: 1 })
  }

  for (const b of beats) {
    const scene = b.scene
    if (scene.card || !scene.shots.length) continue
    const abs = (f: number) => offset + b.from + f
    const windows = resolveShotWindows(scene, b.voStart, b.voDur, b.dur, fps, timings.cues?.[scene.id])
    const groups = groupShots(windows)

    for (const win of windows) {
      const shot = win.shot
      const img = shot.clip ?? shot.img ?? '(missing)'
      const base = { scene: scene.id, shot: win.index, img }
      if (!shot.clip && !(shot.img && manifest.images[shot.img])) {
        report({ ...base, kind: 'missing-capture', detail: `${img} is not in the capture manifest`, frames: [abs(win.start), abs(win.end)] })
      }
      const focus = shot.focus
      if (focus && !('box' in focus) && focus.scale > MAX_ZOOM + 1e-9) {
        report({
          ...base,
          kind: 'zoom-cap',
          detail: `asks for ${focus.scale}x; the cap is ${MAX_ZOOM}x and the engine clamps it — use a focus box or scale <= ${MAX_ZOOM}`,
          frames: [abs(win.start), abs(win.end)],
        })
      }
      if (shot.move === 'click' && win.index > 0) {
        const prev = windows[win.index - 1].shot
        const prevImg = prev.img ?? prev.clip
        const pt = shot.cursorKey ? manifest.points[shot.cursorKey] : undefined
        if (!pt) {
          report({ ...base, kind: 'click-point', detail: `cursorKey "${shot.cursorKey ?? '(none)'}" not in the manifest`, frames: [abs(win.start), abs(win.start)] })
        } else if (pt.x < 0.005 && pt.y < 0.005) {
          report({ ...base, kind: 'click-point', detail: `"${shot.cursorKey}" is (0,0): its finder hit a zero-size element — re-measure it`, frames: [abs(win.start), abs(win.start)] })
        } else if (pt.img !== prevImg) {
          report({ ...base, kind: 'click-point', detail: `"${shot.cursorKey}" was measured on ${pt.img}, but the click lands on ${prevImg}`, frames: [abs(win.start), abs(win.start)] })
        } else {
          const prevGroup = groups.find((g) => g.shots.some((s) => s.index === win.index - 1))
          const dims = manifest.images[pt.img]
          if (prevGroup && dims) {
            const at = pointOnScreen(layerRect(prevGroup, dims, FRAME_W, FRAME_H, win.start), pt)
            if (at.x < 24 || at.y < 24 || at.x > FRAME_W - 24 || at.y > FRAME_H - 24) {
              report({ ...base, kind: 'click-point', detail: `"${shot.cursorKey}" lands off screen at (${at.x.toFixed(0)}, ${at.y.toFixed(0)})`, frames: [abs(win.start), abs(win.start)] })
            }
          }
        }
      }
    }

    groups.forEach((group, gi) => {
      const first = group.shots[0].shot
      if (first.clip || first.pan) return
      const dims = manifest.images[group.img]
      const file = join(dir, 'captures', group.img)
      if (!dims || !existsSync(file)) return
      const g = loadGray(file)
      const next = groups[gi + 1]
      const from = group.start + (gi === 0 ? 0 : fadeFrames(group))
      const to = Math.min(next ? next.start : b.dur, b.dur)
      const frames: number[] = []
      for (let f = from; f < to; f += STEP) frames.push(f)
      if (to - 1 > from) frames.push(to - 1)

      for (const f of frames) {
        const win = shotAt(group, f)
        // A zoom's edges sweep across the UI during its eased move; that's motion,
        // not framing. Every frame the camera holds on is checked.
        if (win.index !== group.shots[0].index && f < win.start + ZOOM_FRAMES) continue
        const base = { scene: scene.id, shot: win.index, img: group.img }
        const rect = layerRect(group, dims, FRAME_W, FRAME_H, f)
        const v = visible(rect, g.w, g.h)
        for (const { edge, where } of edgeCuts(g, rect)) {
          let detail = `${edge} frame edge slices content at image px ${where}`
          const focus = win.shot.focus
          if (focus && !found.has(`${scene.id}|${win.index}|cut-${edge}`)) {
            const k = suggest(g, focusView(focus, { iw: dims.w, ih: dims.h, vw: FRAME_W, vh: FRAME_H }))
            const r = (n: number) => Number(n.toFixed(3))
            detail += k
              ? ` — clean nearby: focus { x: ${r(k.x)}, y: ${r(k.y)}, scale: ${r(k.scale)} }`
              : ' — no clean zoom nearby; drop the focus (full frame)'
          }
          report({ ...base, kind: `cut-${edge}`, detail, frames: [abs(f), abs(f)] })
        }

        const focus = win.shot.focus
        if (focus && 'box' in focus && f >= win.start + ZOOM_FRAMES) {
          const bx = focus.box
          const pad = 2 // px of slack for rounding
          if (
            bx.x0 * g.w < v.x0 - pad ||
            bx.x1 * g.w > v.x1 + pad ||
            bx.y0 * g.h < v.y0 - pad ||
            bx.y1 * g.h > v.y1 + pad
          ) {
            const scale = focusView(focus, { iw: dims.w, ih: dims.h, vw: FRAME_W, vh: FRAME_H }).scale
            report({ ...base, kind: 'box-off-screen', detail: `focus box isn't fully on screen (zoom ${scale.toFixed(2)}x) — the box is bigger than the frame can hold`, frames: [abs(f), abs(f)] })
          }
        }
      }
    })

    // The title chip must sit over empty UI for its whole run.
    if (scene.eyebrow) {
      const [inAt, outAt] = chipWindow(b.dur, fps)
      const chip = chipBox(scene.eyebrow, scene.title, captionsOn, FRAME_H)
      for (let f = inAt; f <= outAt; f += STEP * 2) {
        const gi = groups.findIndex((g, i) => f >= g.start && (!groups[i + 1] || f < groups[i + 1].start))
        const group = groups[gi]
        if (!group || group.shots[0].shot.clip) continue
        const dims = manifest.images[group.img]
        const file = join(dir, 'captures', group.img)
        if (!dims || !existsSync(file)) continue
        const g = loadGray(file)
        const rect = layerRect(group, dims, FRAME_W, FRAME_H, f)
        const sx = g.w / rect.w
        const sy = g.h / rect.h
        const x0 = (chip.x - CHIP_PAD - rect.x) * sx
        const y0 = (chip.y - CHIP_PAD - rect.y) * sy
        const x1 = (chip.x + chip.w + CHIP_PAD - rect.x) * sx
        const y1 = (chip.y + chip.h + CHIP_PAD - rect.y) * sy
        const ink = inkFraction(g, x0, y0, x1, y1)
        if (ink > CHIP_INK) {
          const win = shotAt(group, f)
          report({
            scene: scene.id,
            shot: win.index,
            img: group.img,
            kind: 'chip-covers',
            detail: `title chip covers app content (${(ink * 100).toFixed(1)}% ink under it, image px ${x0.toFixed(0)},${y0.toFixed(0)}-${x1.toFixed(0)},${y1.toFixed(0)})`,
            frames: [abs(f), abs(f)],
          })
        }
      }
    }

    if (opts.frames) {
      for (const win of windows) {
        if (!win.shot.focus) continue
        const s = win.start + ZOOM_FRAMES
        const e = win.end - 2
        console.log(`  ${scene.id} shot ${win.index} (${win.shot.img}) frames ${abs(s)} ${abs(Math.round((s + e) / 2))} ${abs(e)}`)
      }
    }
  }
  return [...found.values()]
}

// Run directly (not imported by render.ts).
if (/scripts[\\/]framecheck\.ts$/.test(process.argv[1] ?? '')) {
  const wt = findWalkthrough(process.argv[2])
  const problems = framecheck(wt, { frames: process.argv.includes('--frames') })
  for (const p of problems) console.log(describe(p, wt.fps ?? 30))
  console.log(problems.length ? `framecheck: ${problems.length} problem(s) in ${wt.id}` : `framecheck: ${wt.id} clean`)
  process.exit(problems.length ? 1 : 0)
}
