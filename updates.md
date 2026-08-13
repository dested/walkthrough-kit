# Updates

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
