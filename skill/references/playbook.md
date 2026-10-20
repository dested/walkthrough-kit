# Walkthrough builder playbook

You are making a narrated product walkthrough video with the prebaked kit in
`walkthroughs/`. The engine, capture harness, and audio pipeline already exist
and are known-good — **do not modify `src/engine/` or `capture/kit.ts`**. Your
entire job is two files plus verification:

- `videos/<slug>/script.ts` — scenes: VO text, shot order, triggers, focus targets
- `videos/<slug>/capture.ts` — Puppeteer run that produces every capture

Read first: `walkthroughs/README.md`, `videos/example/script.ts`,
`videos/example/capture.ts`, then `writing.md` and `capture.md` next to this file.

## Never (each one has shipped and been sent back)

- **Never address a named viewer.** No "<Name>, this one's yours", no "Hey
  <Name>", no "made for <Name>": not in VO, captions, cards or the script header.
  The film gets forwarded; it talks to whoever is watching. Even when the
  user says who asked for it, that name stays out of the film.
- **Never crop a label or a value.** Zoom is capped at 1.4x (`MAX_ZOOM`, the
  engine clamps it). Frame with `focus: { box }` (the region that must stay
  whole) and size the box to the full row: labels AND values. On full-width
  app UI with a sidebar, that is usually the whole content column, so a zoom
  is a gentle push (~1.2x) plus a vertical move, not a punch-in on one cell.
  If you can't frame a detail without slicing its neighbours, don't zoom:
  hold the full frame and let the VO point at it.
- **Never draw over the app's screens.** No vignette, bloom, grain, glow,
  sheen, gradient or badge above a capture; the engine ships none and you
  don't add one. UI renders pixel-clean. Atmosphere lives only on the dark
  backdrop behind title cards.
- **Never render around a failing framecheck.** `bun scripts/render.ts`
  refuses while `bun scripts/framecheck.ts <slug>` reports anything. Fix the
  framing (it prints a clean nearby `focus` for each sliced shot), the
  capture, or the cursor point. Don't call `remotion render` directly to
  skip it.

## The loop

### 0. Recon
- `bun scripts/doctor.ts` — if anything FAILs (server, creds, key, voice),
  fix or escalate before doing anything else.
- Read the repo's `cliffnotes.md` (routes section) or router files to learn the
  app's pages.
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
- `bun scripts/voiceover.ts <slug>` (drops cleanly to captions mode without a
  key). TTS is **eleven_v4_turbo** (ElevenLabs v4 only; never v3 or older,
  whatever an old note says): each scene generates takes, STT-scores
  them against the script, and keeps the best; the take report lands in
  `out/vo-takes/<slug>/report.json`. If a kept take has issues (misread words,
  weird pace), regenerate with `--force --only=<sceneId>` or promote a
  different existing take with `--pick=<sceneId>:<takeN>`. It runs durations
  automatically at the end.
- In the durations output, fix any `TRIGGER NOT FOUND` by making the trigger an
  exact substring of the vo, then re-run (`bun scripts/durations.ts <slug>`
  standalone re-times without re-TTS). Unresolved triggers degrade to even
  splits; a finished film has zero.
- Optional: `bun scripts/music.ts <slug>` then re-run durations.

### 4. Framecheck, then verify by looking
- `bun scripts/framecheck.ts <slug>` — walks every held frame of every still
  exactly as the engine places it and FAILs on: a zoom past 1.4x, a focus box
  off screen, any frame edge that slices text or a control (pixel scan along
  each crop line), a title chip over app content, a click point that's
  missing / (0,0) / off screen / measured on the wrong capture. Each sliced
  shot gets a "clean nearby: focus { … }" you can paste. Iterate to clean.
- `bun scripts/framecheck.ts <slug> --frames` prints the start/middle/end
  frame of every zoomed shot. Render those stills
  (`bunx remotion still <slug> --frame=<N> out/check-<n>.png`) plus a
  midpoint per scene, and READ them. Check: right screen, the subject framed,
  every row label and value whole, cursor on the control, nothing drawn over
  the UI.
- Fix, re-capture/re-time, re-check. Iterate until every still is right.

### 5. Render + report
- `bun scripts/render.ts <slug>` (framecheck, then `remotion render` to
  `out/<slug>.mp4`; refuses on any FAIL). Afterwards pull a 1-frame-per-4s
  contact sheet from the mp4 and read it.
- Report back: output path, runtime, scene list, mode (voiced/captions), any VO
  claims you changed to match reality, and anything that needs the user's eyes.

## Failure notes
- Studio/render works before captures exist (placeholder frames) — that's
  normal, not a bug.
- If puppeteer misbehaves under bun, run capture with
  `node --experimental-strip-types videos/<slug>/capture.ts`.
- Renders are CPU-heavy; a 3-minute film takes a few minutes. Don't parallelize
  renders.
