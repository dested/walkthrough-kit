# Updates

- 2026-10-23 — Kit v5: films rendered blown out (yuvj420p full range, players
  clip whites) → `Config.setColorSpace('bt709')` + render.ts fails on a
  full-range mp4; `kit.clickTrusted` for clicks needing user activation;
  `recordClip` remuxes (duration header) and fails on empty clips. Found on the
  clever-harness fix film.
- 2026-10-20 — Kit v4 (recut of a field film the owner sent back): no
  vignette/grain/badge over the UI (Finish + BrandBadge removed, chip shadow
  tightened, chip ~4s, blank eyebrow = title-only chip); zoom capped at 1.4x
  in the engine, `focus: { box }` fitted whole, unfocused shots hold at 1.0x;
  new scripts/framecheck.ts (pngjs ink scan along every crop line of every
  held frame + chip/click-point checks + clean-focus suggestions) and
  scripts/render.ts (refuses on FAIL); TTS migrated to eleven_v4_turbo
  (voiceover/doctor/voices); kit.point skips zero-size hits; skill docs gain
  playbook "Never" rules (named viewer, crop, overlays) + v4 migration notes.
- 2026-10-20 — Kit v4 pronunciation: `say` maps (walkthrough + scene,
  written word → respelling) feed only the TTS text (align.ts spokenText);
  voiceover logs what scribe heard at each respelled word; report.json
  merges across --only runs. Playbook rule: check brand names before TTS.

- 2026-08-12 — Kit versioning: template/.kit-version (integer, currently 3),
  SKILL.md step-0 version check routes stale scaffolds through the new
  skill/references/upgrades.md (ownership map + copy procedure + per-version
  migration notes); doctor prints the repo's kit version; bump protocol in
  cliffnotes.

- 2026-08-12 — First-field-test feedback round: scripts/doctor.ts preflight
  (server identity, all credential sets, key + character usage, v3-ready
  voice); multi-role credentials (CAPTURE_EMAIL__ROLE + kit.signIn({as}));
  voices.ts writes out/voices.html audition page (players + copy ids);
  voiceover.ts chains durations, logs per-scene/total character counts;
  fetchRetry backoff on TTS/STT; v3 audio tags stripped from captions and
  estimates, documented in writing.md.

- 2026-08-12 — TTS pinned to eleven_v3 everywhere: voiceover.ts rewritten as
  the takes → scribe_v1-score → promote harness (ported from frozone
  v3-vo.mjs) with synthetic alignment via new scripts/align.ts; tone presets
  swap v2 voice knobs for an `expressive` creative-roll flag; voices.ts marks
  v3-ready voices and SKILL.md recommends only those.

- 2026-08-12 — Repo made public. Voice selection reworked: new
  template/scripts/voices.ts lists account voices; SKILL.md now requires
  recommend-then-ask for the narrator (user always picks, never a silent
  default).

- 2026-08-12 — Initial build: template (Remotion engine ported from the frozone
  overview reel + capture kit + voiceover/durations/music/new-walkthrough
  scripts + example walkthrough), walkthrough skill (SKILL.md + playbook/
  writing/capture references), install-skill script. Verified: tsc green,
  placeholder + captions + cold-open stills rendered and eyeballed,
  new-walkthrough scaffold round-trip, durations captions-mode output.
