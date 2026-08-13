---
name: walkthrough
description: Produce a narrated Remotion walkthrough video of a web app (screenshots via Puppeteer, ElevenLabs voiceover or captions, music bed). Use when the user asks to "make a walkthrough", "product video", "demo video", "sizzle reel", or "tour" of an app or a feature area. Scaffolds a walkthroughs/ directory from dested/walkthrough-kit on first use, then delegates the film-making to an Opus agent.
---

# walkthrough

Make a walkthrough video of the current repo's app. The heavy machinery is
prebaked in the `walkthroughs/` template (scaffolded from
`dested/walkthrough-kit`): a Remotion engine (ken-burns stills, animated cursor
clicks, page pans, live clips, word-synced shot cues, VO, music ducking,
captions), a Puppeteer capture harness, and the ElevenLabs pipeline. A new film
is only ever two files: `videos/<slug>/script.ts` and `videos/<slug>/capture.ts`.

You (the main thread) do setup and delegation only. The film-making ALWAYS
happens in a spawned agent — never inline in the main thread, no matter which
model the main thread is running. Spawn it with `model: "opus"` (Opus 5 is the
recommended builder). Fable never does the film work itself unless the user
explicitly asks for that.

## 0. Version check (whenever `walkthroughs/` already exists)

**This skill is kit version 3.** Read `walkthroughs/.kit-version` (a bare
integer; file missing = version 1). If the repo's copy is older, upgrade it
BEFORE any other work — old copies carry real bugs — by following
`~/.claude/skills/walkthrough/references/upgrades.md` (ownership map, exact
copy commands, per-version migration notes). If the repo's copy is NEWER than
3, the installed skill is stale: reinstall it from the walkthrough-kit repo
(`bun scripts/install-skill.ts`) and start over.

## 1. Scaffold (only if `walkthroughs/` doesn't exist at the repo root)

```bash
gh repo clone dested/walkthrough-kit "$SCRATCH/walkthrough-kit" -- --depth 1
cp -r "$SCRATCH/walkthrough-kit/template/." walkthroughs/     # includes dotfiles
cd walkthroughs && bun install
```

Then, **ask the user** (AskUserQuestion) how to handle git — they said walkthroughs
may be ignored, so ask, don't assume:
- **Ignore assets only (recommended)** — commit `walkthroughs/` code; the template's
  own `.gitignore` already excludes captures/vo/music/timings/out.
- **Ignore everything** — add `walkthroughs/` to the repo root `.gitignore`.
- **Commit everything** — remove the asset lines from `walkthroughs/.gitignore`.

## 2. Configure (first run, or when something is missing)

Fill `walkthroughs/walkthrough.config.json`:
- `product` / `productUrl` — from the repo (cliffnotes, package.json, README).
- `baseUrl` — the dev URL (portless `https://<name>.localhost`, or whatever the
  repo's cliffnotes say). The app must actually be running before capture —
  and check WHOSE server answers there before starting one (a stale process
  squatting the port responds too, and a fresh `bun dev` then dies with
  EADDRINUSE while everything still "works" against the wrong build).
- `brand` — pull accent colors from the app's Tailwind config / ui.md if easy.
- `tone` — if not already set and the user didn't say, **ask** (AskUserQuestion):
  `sizzle` (fast, punchy tech demo) · `demo` (confident product walkthrough) ·
  `sales` (warm, persuasive pitch) · `tutorial` (calm explainer).
- ElevenLabs: if `ELEVENLABS_API_KEY` isn't in env or `walkthroughs/.env`, **ask
  the user for their key** (they can paste it via Other). If they decline, that's
  fine — the pipeline runs in captions mode (on-screen text, no narration).
  Write the key to `walkthroughs/.env`, never commit it.
- **Voice — the user picks, you recommend. Never silently keep the default.**
  With a key in place, run `cd walkthroughs && bun scripts/voices.ts` — it
  prints the account's voices AND writes `out/voices.html`, a picker page with
  audio players and click-to-copy ids. **Send that file to the user
  (SendUserFile) so they can actually listen**, then AskUserQuestion. TTS is
  always **eleven_v3**, so recommend ONLY voices marked `v3-ready`. Pick the
  2–3 best fits for the chosen tone (sizzle → energetic/confident narration;
  demo → confident conversational; sales → warm/persuasive; tutorial →
  calm/measured), top pick first marked "(Recommended)", each option
  describing the voice in one line; Other lets them paste any voice_id. Write
  the choice to `voiceId` in `walkthrough.config.json`. Skip only in captions
  mode.
- Capture login(s): the default principal goes in `walkthroughs/.env` as
  `CAPTURE_EMAIL` / `CAPTURE_PASSWORD`. If the film needs more than one
  principal (staff portal + client portal, admin + member), add named sets —
  `CAPTURE_EMAIL__CLIENT` / `CAPTURE_PASSWORD__CLIENT` — which capture scripts
  use via `kit.signIn({ as: 'client' })`.

## 3. Preflight — run the doctor before delegating

```bash
cd walkthroughs && bun scripts/doctor.ts   # [--sign-in-path=/login]
```

It verifies: baseUrl answers (and prints the page title so you can confirm
it's the right server), every credential set signs in, the ElevenLabs key is
live (with character usage), and the configured voice is v3-ready. Fix every
FAIL before spawning the agent — it is the deterministic "ready to film"
signal.
- Capture login: if the app needs auth, put working credentials in
  `walkthroughs/.env` as `CAPTURE_EMAIL` / `CAPTURE_PASSWORD` (look for seed
  users in the repo; ask the user if unclear).

## 4. Delegate the film to an Opus agent

Spawn ONE agent with `model: "opus"` (Opus 5). Its prompt must include:
- The subject and any user direction (what to cover, target length, tone).
- Repo root, `walkthroughs/` path, config baseUrl, where credentials live.
- Instruction to read, before anything else:
  - `walkthroughs/README.md` and `walkthroughs/videos/example/` (script + capture)
  - `~/.claude/skills/walkthrough/references/playbook.md` (the working loop)
  - `~/.claude/skills/walkthrough/references/writing.md` (VO + scene grammar)
  - `~/.claude/skills/walkthrough/references/capture.md` (capture kit API + framing tricks)
- The definition of done: `out/<slug>.mp4` rendered, scene-midpoint stills
  verified by actually reading them, capture FACTS consistent with the VO.

While it runs, stay available to the user; relay progress when it completes.

## 5. Deliver

Send the user the mp4 (SendUserFile) with runtime + scene list. Offer the
follow-ups that are now cheap: change a VO line (`--only=<sceneId>` re-TTS +
re-render), add a music bed (`bun scripts/music.ts <slug>`), different tone.
