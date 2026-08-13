// Scaffolds videos/<slug>/{script.ts,capture.ts} and registers the walkthrough
// in src/videos.ts.
//
// Run: bun scripts/new-walkthrough.ts <slug> "Title of the walkthrough"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib'

const slug = process.argv[2]
const title = process.argv.slice(3).join(' ')
if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
  throw new Error('usage: bun scripts/new-walkthrough.ts <slug> "Title" — slug must be lowercase kebab-case')
}
if (!title) throw new Error('give the walkthrough a title: bun scripts/new-walkthrough.ts <slug> "Title"')

const dir = join(ROOT, 'videos', slug)
if (existsSync(dir)) throw new Error(`videos/${slug} already exists`)
mkdirSync(dir, { recursive: true })
mkdirSync(join(ROOT, 'public', slug, 'captures'), { recursive: true })

const camel = slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

writeFileSync(
  join(dir, 'script.ts'),
  `// ${title} — single source of truth: VO text, shot order, word-cue triggers,
// focus targets. See videos/example/script.ts and the skill's writing guide.
//
// Pipeline: edit here -> bun videos/${slug}/capture.ts -> bun scripts/voiceover.ts ${slug}
// -> bun scripts/durations.ts ${slug} -> bunx remotion render ${slug} out/${slug}.mp4
import type { Walkthrough } from '../../src/engine/types'

export const WALKTHROUGH: Walkthrough = {
  id: '${slug}',
  title: '${title.replace(/'/g, "\\'")}',
  tagline: '',
  outro: { headline: 'Come see it live.' },
  scenes: [
    {
      id: 's01-opening',
      eyebrow: 'OVERVIEW',
      title: 'The first screen',
      vo: \`Write the narration here — plain and spoken. Each shot below starts on a trigger word from this text.\`,
      shots: [{ img: 'home.png' }],
    },
    {
      id: 's99-outro',
      eyebrow: '',
      title: '',
      vo: \`One closing line.\`,
      shots: [],
      card: 'outro',
      leadSeconds: 0.8,
      tailSeconds: 2.4,
    },
  ],
}
`,
)

writeFileSync(
  join(dir, 'capture.ts'),
  `// Captures for "${title}". Every img:/clip: in script.ts must be produced
// here, and every cursorKey: recorded with kit.point(). See videos/example/capture.ts.
//
// Run from the walkthroughs root, with the app up: bun videos/${slug}/capture.ts
// Partial re-runs: ONLY=stage1 bun videos/${slug}/capture.ts
import { createCapture, readEnv, sleep } from '../../capture/kit'

const kit = await createCapture('${slug}')

try {
  // const email = readEnv('CAPTURE_EMAIL')
  // const password = readEnv('CAPTURE_PASSWORD')
  // if (!email || !password) throw new Error('set CAPTURE_EMAIL / CAPTURE_PASSWORD in .env')
  // await kit.signIn({ email, password })

  if (kit.stage('home')) {
    await kit.go('/', null, 2800)
    await kit.save('home.png')
  }
} finally {
  await kit.finish()
}
void sleep
`,
)

// Register in src/videos.ts between the markers.
const videosPath = join(ROOT, 'src', 'videos.ts')
let videos = readFileSync(videosPath, 'utf8')
videos = videos.replace(
  '// </walkthrough-imports>',
  `import { WALKTHROUGH as ${camel} } from '../videos/${slug}/script'\n// </walkthrough-imports>`,
)
videos = videos.replace('  // </walkthrough-list>', `  ${camel},\n  // </walkthrough-list>`)
writeFileSync(videosPath, videos)

console.log(`created videos/${slug}/script.ts + capture.ts, registered in src/videos.ts`)
console.log(`next: write the scenes, then bun videos/${slug}/capture.ts`)
