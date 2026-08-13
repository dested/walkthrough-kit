# Decisions

- **Engine is a port, not a rewrite.** `template/src/engine/` is the proven
  Frozone overview-reel engine (frozenropes/videos/remotion-reel/src/overview/)
  generalized: theme/brand from walkthrough.config.json, per-walkthrough asset
  namespacing, clips + captions added. Don't "improve" the ken-burns/cursor/pan
  math without a rendered-frame comparison.
- **Stills-first.** Both scene types exist (`img` stills with ken-burns, `clip`
  webm recordings), but stills are the recommended default — faster to render,
  deterministic, retryable per shot. The skill's writing guide steers that way.
- **Template is copied, not depended on.** Target repos get a full standalone
  copy as `walkthroughs/` (scaffolded via `gh repo clone` + `cp template/.`).
  No npm package, no auto-propagating updates — accepted so the builder agent
  can patch anything locally without a release cycle.
- **Captions fallback.** No ELEVENLABS_API_KEY → durations are estimated from
  tone wpm and narration renders as bottom-center caption chips (lower-third
  moves top-left to make room). Voiced mode measures mp3s and word-syncs shots
  via the alignment JSON.
- **The film is always built by a spawned agent.** SKILL.md keeps
  scaffold/config/questions in the main thread and hands the film to a single
  `model: "opus"` agent (Opus 5 recommended) — regardless of which model the
  main thread runs. Fable never builds the film inline unless explicitly asked.
- **strict TS, but no `noUncheckedIndexedAccess`** in the template tsconfig —
  the ported engine math is index-heavy and was shipped/proven as-is.
- **Doctor before delegate.** `scripts/doctor.ts` is the deterministic
  "ready to film" gate: server answers (title printed — the who-owns-this-port
  check), every credential set signs in, key live, voice v3-ready. The skill
  runs it before spawning the builder agent; exit code = failed checks.
- **Credentials are role-suffixed env sets**, not a single principal:
  CAPTURE_EMAIL[__ROLE]/CAPTURE_PASSWORD[__ROLE], consumed via
  `kit.signIn({ as: 'role' })` — one film can switch principals (staff portal
  scene, then client portal scene).
- **Ports**: Remotion Studio 7811, renderer server 7812 (remotion.config.ts).
  Portless not used — Remotion's own tooling owns the server; uncommon ports per
  the no-3000 policy.
- **TTS is always eleven_v3.** v3 reads far better than multilingual_v2 but has
  no native timestamp alignment and rejects previous_text/next_text — so
  voiceover.ts is the frozone v3 harness, ported: N takes per scene (Natural +
  one Creative roll on expressive tones), scribe_v1 STT scoring (match %,
  trailing-silence and pace guards), best take promoted with a synthetic
  character alignment (scripts/align.ts). durations.ts is model-agnostic — the
  synthetic alignment has the same shape as native. Voice recommendations come
  only from voices flagged v3-ready (`high_quality_base_model_ids`).
- **Voice is always user-chosen.** The skill lists the account's voices
  (`scripts/voices.ts`), recommends 2–3 fits for the tone, and asks — it never
  silently uses a default. "Brian" (`nPczCjzI2devNBz1zQrb`) in the shipped
  config is only the pre-question placeholder. Tone presets
  (sizzle/demo/sales/tutorial) carry voice settings, wpm, lead/tail, music duck
  levels, and music prompts in `src/engine/tones.ts`.
