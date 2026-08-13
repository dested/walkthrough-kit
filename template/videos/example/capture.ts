// EXAMPLE capture script — the reference for kit usage. It expects a generic
// app at walkthrough.config.json baseUrl and will happily fail on yours; write
// real finders against the real DOM.
//
// Run from the walkthroughs root, with the app up: bun videos/example/capture.ts
// Partial re-runs: ONLY=dashboard bun videos/example/capture.ts
import { createCapture, readEnv, sleep } from '../../capture/kit'

const kit = await createCapture('example')

try {
  // ── sign in (if the app needs it) ─────────────────────────────────────
  const email = readEnv('CAPTURE_EMAIL')
  const password = readEnv('CAPTURE_PASSWORD')
  if (email && password) {
    await kit.signIn({ email, password })
  }

  // ── s01: dashboard ────────────────────────────────────────────────────
  if (kit.stage('dashboard')) {
    await kit.go('/', 'Dashboard', 2800)
    // Report what's actually on screen so the VO can match reality.
    kit.fact('headline', await kit.readText(() => document.querySelector('h1')))
    await kit.save('dashboard.png')
  }

  // ── s02: list -> detail (click), tall detail (pan) ────────────────────
  if (kit.stage('detail')) {
    await kit.go('/items', null, 2600)
    // Record where the click lands BEFORE taking the still it lands on.
    await kit.point('list-row', 'list.png', () => document.querySelector('main a, main tbody tr'))
    await kit.save('list.png')

    await kit.clickFound(() => document.querySelector<HTMLElement>('main a, main tbody tr'))
    await sleep(2200)
    await kit.waitForSkeletons()
    await kit.save('detail.png')

    // Tall capture for a pan shot: fire lazy loads first.
    await kit.fullyLoad()
    await kit.saveTall('detail-tall.png')
  }

  // ── s03: a live clip ──────────────────────────────────────────────────
  if (kit.stage('live')) {
    await kit.go('/', null, 2000)
    await kit.recordClip('search-live.webm', async (p) => {
      await p.click('input[type="search"]')
      await p.type('input[type="search"]', 'quarterly report', { delay: 90 })
      await sleep(2400)
    })
  }
} finally {
  // Writes capture-manifest.json + prints facts, even when a stage throws.
  await kit.finish()
}
