# Decisions

- **Engine is a port, not a rewrite.** `template/src/engine/` is the proven
  Frozone overview-reel engine (frozenropes/videos/remotion-reel/src/overview/)
  generalized: theme/brand from walkthrough.config.json, per-walkthrough asset
  namespacing, clips + captions added. Don't "improve" the ken-burns/cursor/pan
  math without a rendered-frame comparison. (v4 changed it on purpose, with
  frame-by-frame evidence: zoom cap, focus boxes, no drift on unfocused
  shots; see the framing decisions below.)
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
  check), every credential set signs in, key live, voice answers a real
  eleven_v4_turbo ping. The skill
  runs it before spawning the builder agent; exit code = failed checks.
- **Credentials are role-suffixed env sets**, not a single principal:
  CAPTURE_EMAIL[__ROLE]/CAPTURE_PASSWORD[__ROLE], consumed via
  `kit.signIn({ as: 'role' })` — one film can switch principals (staff portal
  scene, then client portal scene).
- **Ports**: Remotion Studio 7811, renderer server 7812 (remotion.config.ts).
  Portless not used — Remotion's own tooling owns the server; uncommon ports per
  the no-3000 policy.
- **TTS is eleven_v4_turbo** (v4; v3 and multilingual_v2 are retired, the
  owner's rule since 2026-10). voiceover.ts keeps the takes harness built for
  v3: N takes per scene (Natural + one looser roll on expressive tones),
  scribe_v1 STT scoring (match %, trailing-silence and pace guards), best take
  promoted with a synthetic character alignment (scripts/align.ts).
  durations.ts is model-agnostic. The voice list's model flags
  (`high_quality_base_model_ids`) are unreliable, so voices aren't filtered by
  them; the doctor proves the chosen voice with a real v4 Turbo request.
- **Voice is always user-chosen.** The skill lists the account's voices
  (`scripts/voices.ts`), recommends 2–3 fits for the tone, and asks — it never
  silently uses a default. "Brian" (`nPczCjzI2devNBz1zQrb`) in the shipped
  config is only the pre-question placeholder. Tone presets
  (sizzle/demo/sales/tutorial) carry voice settings, wpm, lead/tail, music duck
  levels, and music prompts in `src/engine/tones.ts`.
- **Nothing is drawn over a screen capture.** No vignette, bloom, grain,
  glow, sheen or badge above the UI (v3's `Finish` vignette greyed white UI
  into a center bloom; its top-right badge covered values). Atmosphere lives
  only in the Backdrop under the title cards. Chips (scene title, captions)
  carry a tight shadow and no backdrop blur.
- **Framing is enforced by code, not advice.** `MAX_ZOOM` = 1.4 clamps every
  focus in the engine; `focus: { box }` is fitted whole; `scripts/render.ts`
  won't render while `scripts/framecheck.ts` finds a held frame whose edge
  slices text or a control (luminance scan for ink straddling each crop line),
  a chip over UI, or a bad click point. Zoom transitions (the 26-frame ease)
  are exempt: edges sweeping across the UI mid-move is motion, not framing.
- **Unfocused shots hold at 1.0x.** The old 1.02→1.05 drift trimmed the nav
  rail and right-aligned buttons on every wide shot. Motion comes from zooms,
  clicks and cuts.
- **Films never address a named viewer.** No "<Name>, this one's yours":
  the film gets forwarded and the owner won't ship one that talks to one
  person. Rule lives in playbook.md "Never" and writing.md.
- **Pronunciation is a respelling map, not SSML or a dictionary.** `say`
  on the walkthrough (film-wide) and on a scene (override) maps a written
  word to what the voice reads (`Gusto` → `Gust-oh`). Only the TTS text
  changes; captions, trigger cues and take scoring stay on the written `vo`,
  so the screen still reads the brand name. Chosen over ElevenLabs
  pronunciation dictionaries (account state outside the repo; phoneme rules
  aren't supported on every model) and inline respellings in `vo` (they leak
  into captions). Scribe normalizes near-misses to the dictionary word, so its
  "heard" line catches a garbled read, not a wrong stress: a human listens.
