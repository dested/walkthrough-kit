# Kit versions + upgrading a scaffolded walkthroughs/

The template stamps its version in `walkthroughs/.kit-version` (a bare
integer; missing file = version 1, pre-versioning). The skill's SKILL.md states
the CURRENT version. When a repo's copy is older, upgrade it before filming —
old copies have real bugs the current kit fixed (v1 hardcoded a TTS model v3
setups crash on; v2 lacks the doctor and multi-role creds).

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

### v3 (current)
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
