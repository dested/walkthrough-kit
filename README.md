# walkthrough-kit

Narrated product walkthrough videos of any web app, made by Claude Code with as
little token spend as possible. Everything hard is prebaked; a new film is two
small files.

Two halves:

- **`template/`** — a self-contained Remotion project that gets copied into a
  target repo as `walkthroughs/`. Ships the film engine (full-bleed screenshot
  scenes with ken-burns moves, animated cursor clicks, page pans, live webm
  clips, word-synced shot cues from ElevenLabs alignment, music ducking,
  captions fallback), a Puppeteer capture harness, and the TTS/timings/music
  pipeline scripts. See `template/README.md`.
- **`skill/`** — the `walkthrough` Claude Code skill. Scaffolds `walkthroughs/`
  on first use (asks about gitignoring it, tone, ElevenLabs key), then spawns an
  Opus agent that writes `script.ts` + `capture.ts`, shoots the app, generates
  VO, verifies frames by looking at them, and renders the mp4.

## Install the skill

```bash
bun scripts/install-skill.ts   # copies skill/ -> ~/.claude/skills/walkthrough
```

Then in any repo: *"use the walkthrough skill to make a walkthrough of the admin
portal"*.

## Provenance

The engine is a generalized port of the Frozone Academy overview reel
(`frozenropes/videos/remotion-reel/src/overview/`), which shipped a ~6-minute
word-synced product film with this exact grammar.
