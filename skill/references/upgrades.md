# Kit versions + upgrading a scaffolded walkthroughs/

The template stamps its version in `walkthroughs/.kit-version` (a bare
integer; missing file = version 1, pre-versioning). The skill's SKILL.md states
the CURRENT version. When a repo's copy is older, upgrade it before filming —
old copies have real bugs the current kit fixed (v1 hardcoded a TTS model v3
setups crash on; v2 lacks the doctor and multi-role creds; v3 draws a
vignette + grain + badge over the UI, zooms without a cap and narrates with
eleven_v3).

## Ownership map — what an upgrade may touch

**Upstream-owned (overwrite freely):** `src/engine/`, `src/Root.tsx`,
`src/index.ts`, `src/theme.ts`, `src/lib/`, `capture/kit.ts`, `scripts/`,
`remotion.config.ts`, `tsconfig.json`, `package.json`, `README.md`,
`.gitignore`, `.env.example`, `.kit-version`.

**User-owned (NEVER overwrite):** `.env`, `walkthrough.config.json`,
`src/videos.ts` (the registry), `videos/`, `public/`, `out/`.

## Procedure

```bash
gh repo clone dested/walkthrough-kit "$SCRATCH/wk" -- --depth 1
cd walkthroughs
cp src/videos.ts "$SCRATCH/videos.ts.keep"                    # user-owned file inside an upstream dir
cp -r "$SCRATCH/wk/template/src" "$SCRATCH/wk/template/capture" "$SCRATCH/wk/template/scripts" .
cp "$SCRATCH/wk/template/remotion.config.ts" "$SCRATCH/wk/template/tsconfig.json" \
   "$SCRATCH/wk/template/package.json" "$SCRATCH/wk/template/README.md" \
   "$SCRATCH/wk/template/.gitignore" "$SCRATCH/wk/template/.env.example" \
   "$SCRATCH/wk/template/.kit-version" .
cp "$SCRATCH/videos.ts.keep" src/videos.ts
bun install && bunx tsc --noEmit && bun scripts/doctor.ts
```

If the repo deleted `videos/example/`, tsc stays green only because videos.ts
was preserved — do not re-add the example import. Then apply any migration
notes below for the versions you crossed, and re-render one still per film to
confirm nothing drifted.

If the repo's `.kit-version` is NEWER than the skill's stated version, the
installed skill is stale — from the walkthrough-kit repo run
`bun scripts/install-skill.ts` (or re-clone it) and start over.

## Changelog + migration notes

### v4 (current)
- **Nothing drawn over the screens.** `Finish` (film grain + radial vignette
  layered above everything, which read as a blown-out center bloom on white
  UI) is gone, and so is the top-right brand badge that covered UI. The title
  chip lost its backdrop blur and wide shadow and now shows for ~4s only.
  A blank (' ') eyebrow renders a title-only chip instead of a lone accent dash.
- **Zoom can't crop.** `MAX_ZOOM` (1.4) clamps every focus.
  `focus: { box: { x0, y0, x1, y1 } }` is fitted so the whole box (plus
  padding, after the hold creep) stays on screen. Unfocused shots hold at
  1.0x instead of drifting to 1.05x (the drift trimmed nav rails and
  right-aligned buttons).
- **`scripts/framecheck.ts`** (new, needs `pngjs`): walks every held frame
  of every still and FAILs on a zoom past the cap, a focus box off screen,
  any frame edge that slices text or a control (pixel scan along each crop
  line), a title chip over app content, or a bad click point. It prints a
  clean nearby `focus` for each sliced shot. `--frames` lists start/mid/end
  frames of each zoomed shot for verification stills.
- **`scripts/render.ts`** (new): framecheck, then `remotion render`;
  refuses on any FAIL. `bun run render` points at it.
- **TTS is eleven_v4_turbo** (`voiceover.ts`); `doctor.ts` proves the voice
  with a real v4 Turbo ping; `voices.ts` drops the unreliable `v3-ready`
  flag and lists every voice.
- `kit.point()` refuses zero-size elements (a hidden span recorded (0,0)
  and flew the cursor to the corner).
- `FRAME_W` / `FRAME_H` live in `src/engine/timeline.ts`; `Root.tsx` uses them.
- Migration:
  1. Copy upstream-owned files (procedure above), then `bun install` (adds
     `pngjs` + `@types/pngjs`). `bunx tsc --noEmit`: `Focus` is now a union,
     so film code that reads `shot.focus.x` directly must narrow with
     `'box' in focus` first. Plain `{ x, y, scale }` focuses in scripts still
     typecheck.
  2. `bun scripts/framecheck.ts <slug>` for every film you'll re-render, and
     fix each FAIL: scales above 1.4 → a box or a smaller scale (paste the
     suggested `focus`); zooms that split two columns → zoom the pair or drop
     the zoom; chips over UI → `eyebrow: ''`.
  3. Re-TTS every scene still on eleven_v3 (`voiceover.ts <slug> --force`) so
     the voice is consistent; run the doctor first.
  4. Remove any address to a named viewer from VO/cards and re-TTS those
     scenes (playbook.md "Never").
  5. Render with `bun scripts/render.ts <slug>`; read a 1-frame-per-4s contact
     sheet plus start/mid/end stills of each zoomed shot.

### v3
- `scripts/doctor.ts` preflight (server identity, all credential sets, key +
  character usage, v3-ready voice). Run it after upgrading.
- Multi-role credentials: `CAPTURE_EMAIL__ROLE` sets + `kit.signIn({ as })`.
- `voices.ts` writes `out/voices.html` (audio players + copy ids).
- `voiceover.ts` chains durations, logs character counts; TTS/STT retry with
  backoff; v3 audio tags stripped from captions/estimates.
- Migration: none for user files. Optionally add role credential sets to `.env`.

### v2
- TTS pinned to **eleven_v3** via the takes harness (`voiceover.ts` +
  `scripts/align.ts`): N takes/scene, scribe_v1 scoring, synthetic alignment,
  `--pick` override. v1's `eleven_multilingual_v2` + `with-timestamps` path is
  gone.
- Tones: `voice` settings object replaced by `expressive: boolean`.
- Migration: verify the configured `voiceId` is v3-ready
  (`bun scripts/voices.ts`) — a non-v3 voice reads noticeably worse; re-pick
  with the user if flagged. Regenerate any VO produced under v1 (`--force`) so
  every scene is a v3 read with a consistent voice.

### v1
- Initial scaffold: engine, capture kit, v2-model TTS, single credential pair.
