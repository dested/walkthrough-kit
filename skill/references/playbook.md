# Walkthrough builder playbook

You are making a narrated product walkthrough video with the prebaked kit in
`walkthroughs/`. The engine, capture harness, and audio pipeline already exist
and are known-good — **do not modify `src/engine/` or `capture/kit.ts`**. Your
entire job is two files plus verification:

- `videos/<slug>/script.ts` — scenes: VO text, shot order, triggers, focus targets
- `videos/<slug>/capture.ts` — Puppeteer run that produces every capture

Read first: `walkthroughs/README.md`, `videos/example/script.ts`,
`videos/example/capture.ts`, then `writing.md` and `capture.md` next to this file.

## The loop

### 0. Recon
- Read the repo's `cliffnotes.md` (routes section) or router files to learn the
  app's pages. Confirm the app responds at the config `baseUrl`.
- Scaffold the film: `bun scripts/new-walkthrough.ts <slug> "Title"`.
- Write a throwaway recon pass FIRST: a capture.ts that just signs in and
  `save()`s every candidate page. Run it, then **Read every PNG** (they are
  images — look at them). Decide the story from what actually looks good.
  What's seeded and full reads great; empty states are dead frames.

### 1. Script
- Write `script.ts` per `writing.md`: scene list, VO, shots with triggers.
- The VO must only claim things the screens will show. Numbers spoken in the VO
  must match on-screen numbers — the capture run reports FACTS for this.

### 2. Capture
- Rewrite `capture.ts` for real: every `img:`/`clip:` in script.ts produced,
  every `cursorKey:` recorded with `kit.point()`. Techniques in `capture.md`.
- Run `bun videos/<slug>/capture.ts`. Then **Read every PNG again** and fix
  framing until each shot is the subject, not a page header. Use
  `ONLY=<stage>` re-runs; they merge into the manifest.
- Reconcile: update VO lines to match the FACTS the run printed (or re-stage the
  data and re-shoot). Never ship a VO number the screen contradicts.

### 3. Audio + timings
- `bun scripts/voiceover.ts <slug>` (skips cleanly to captions mode without a key)
- `bun scripts/durations.ts <slug>` — fix any `TRIGGER NOT FOUND` by making the
  trigger an exact substring of the vo, then re-run. Unresolved triggers degrade
  to even splits; a finished film has zero.
- Optional: `bun scripts/music.ts <slug>` then re-run durations.

### 4. Verify by looking
- For each scene, render a midpoint still and read it:
  `bunx remotion still <slug> --frame=<N> out/check-<sceneId>.png`
  (frame math: timings.json durations + tone lead/tail + 3.2s cold open; rough
  midpoints are fine). Check: right screen, focus target actually framed,
  cursor lands on the control, lower-third not covering the subject, captions
  legible if in captions mode.
- Fix, re-capture/re-time, re-check. Iterate until every still is right.

### 5. Render + report
- `bunx remotion render <slug> out/<slug>.mp4`
- Report back: output path, runtime, scene list, mode (voiced/captions), any VO
  claims you changed to match reality, and anything that needs the user's eyes.

## Failure notes
- Studio/render works before captures exist (placeholder frames) — that's
  normal, not a bug.
- If puppeteer misbehaves under bun, run capture with
  `node --experimental-strip-types videos/<slug>/capture.ts`.
- Renders are CPU-heavy; a 3-minute film takes a few minutes. Don't parallelize
  renders.
