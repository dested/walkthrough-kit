// Render a film. framecheck runs first and a failing frame blocks the render:
// fix the framing in script.ts (or the capture), don't route around it.
//
// Run: bun scripts/render.ts <slug> [out.mp4] [...extra remotion render flags]
import { spawnSync } from 'node:child_process'
import { describe, framecheck } from './framecheck'
import { ROOT, findWalkthrough } from './lib'

const [slug, ...rest] = process.argv.slice(2)
const wt = findWalkthrough(slug)
const out = rest[0] && !rest[0].startsWith('-') ? rest[0] : `out/${wt.id}.mp4`
const flags = rest[0] === out ? rest.slice(1) : rest

const problems = framecheck(wt)
if (problems.length) {
  for (const p of problems) console.log(describe(p, wt.fps ?? 30))
  console.error(`\nframecheck found ${problems.length} problem(s), not rendering. Details: bun scripts/framecheck.ts ${wt.id}`)
  process.exit(1)
}
console.log(`framecheck clean, rendering ${wt.id} -> ${out}`)

// process.execPath is bun itself: `bun x remotion render …`.
const r = spawnSync(process.execPath, ['x', 'remotion', 'render', wt.id, out, ...flags], { cwd: ROOT, stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status ?? 1)

// A full-range (yuvj420p / pc) mp4 plays blown out: players read H.264 as limited range,
// so whites clip and light greys wash out. remotion.config.ts sets bt709; this catches a
// config that lost it.
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt,color_range', '-of', 'default=nw=1', out], { encoding: 'utf8' })
if (probe.status === 0 && /pix_fmt=yuvj|color_range=pc/.test(probe.stdout)) {
  console.error(`\n${out} is full-range video (${probe.stdout.trim().replace(/\n/g, ', ')}) and will look blown out. Put Config.setColorSpace('bt709') back in remotion.config.ts and render again.`)
  process.exit(1)
}
