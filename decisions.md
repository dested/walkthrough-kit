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
- **Fable orchestrates, Opus builds.** SKILL.md keeps scaffold/config/questions
  in the main thread and hands the film to a single `model: "opus"` agent.
- **strict TS, but no `noUncheckedIndexedAccess`** in the template tsconfig —
  the ported engine math is index-heavy and was shipped/proven as-is.
- **Ports**: Remotion Studio 7811, renderer server 7812 (remotion.config.ts).
  Portless not used — Remotion's own tooling owns the server; uncommon ports per
  the no-3000 policy.
- **Voice is always user-chosen.** The skill lists the account's voices
  (`scripts/voices.ts`), recommends 2–3 fits for the tone, and asks — it never
  silently uses a default. "Brian" (`nPczCjzI2devNBz1zQrb`) in the shipped
  config is only the pre-question placeholder. Tone presets
  (sizzle/demo/sales/tutorial) carry voice settings, wpm, lead/tail, music duck
  levels, and music prompts in `src/engine/tones.ts`.
