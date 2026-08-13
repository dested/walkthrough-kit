# walkthrough-kit — cliffnotes

Narrated Remotion walkthrough videos of web apps, driven by the `walkthrough`
Claude Code skill. Monorepo: a copy-into-target template + the skill that
orchestrates it. No app of its own — nothing to run here except typecheck.

## Map

```
package.json                 bun workspace root; `bun run install-skill`
scripts/install-skill.ts     copies skill/ -> ~/.claude/skills/walkthrough
skill/
  SKILL.md                   main-thread dispatcher: scaffold, config, ask tone/key, spawn Opus agent
  references/playbook.md     the builder agent's working loop (recon -> script -> capture -> audio -> verify -> render)
  references/writing.md      scene/VO grammar + tone deltas (sizzle/demo/sales/tutorial)
  references/capture.md      capture kit API + framing tricks
template/                    copied into a target repo as walkthroughs/
  walkthrough.config.json    product, baseUrl, tone, voiceId, captions, brand colors
  src/engine/                the film: types, tones, shots (ken-burns/click/pan math),
                             timeline, Film/ScreenScene/Cursor/Cards/Captions/Backdrop
  src/videos.ts              walkthrough registry (marker-maintained by new-walkthrough)
  src/Root.tsx               one Composition per walkthrough; calculateMetadata loads timings/manifest
  capture/kit.ts             Puppeteer harness: go/save/saveTall/point/clickFound/recordClip/signIn/…
  scripts/                   doctor.ts (preflight: server/creds/key/voice), voices.ts (voice
                             listing + out/voices.html audition page), voiceover.ts
                             (eleven_v3 takes → scribe_v1 score → promote + synthetic align,
                             chains durations), align.ts (LCS/STT alignment), durations.ts (timings.json:
                             measured or estimated durations, trigger cues, caption pages),
                             music.ts (ElevenLabs music bed), new-walkthrough.ts (scaffold + register)
  videos/example/            reference walkthrough: every shot move, kit usage patterns
```

## Data flow (inside a target repo's walkthroughs/)

script.ts (VO + shots + triggers) → capture.ts → public/<slug>/captures/*.png|webm
+ capture-manifest.json (dims + cursor points) → voiceover.ts → vo/*.mp3 +
*.align.json → durations.ts → timings.json (drives the whole timeline; captions
mode when no ElevenLabs key) → remotion render <slug> out/<slug>.mp4.

## Verify

- `cd template && bun install && bun run typecheck`
- `cd template && bunx remotion still example out/check.png --frame=120` — engine
  boots, renders placeholder frames without captures.
