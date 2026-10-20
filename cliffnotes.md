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
  src/engine/                the film: types, tones, shots (ken-burns/click/pan math,
                             MAX_ZOOM cap, focus-box fit, chip window), timeline (FRAME_W/H),
                             Film/ScreenScene/Cursor/Cards/Captions/Backdrop (nothing over UI)
  src/videos.ts              walkthrough registry (marker-maintained by new-walkthrough)
  src/Root.tsx               one Composition per walkthrough; calculateMetadata loads timings/manifest
  capture/kit.ts             Puppeteer harness: go/save/saveTall/point/clickFound/recordClip/signIn/…
  scripts/                   doctor.ts (preflight: server/creds/key/voice v4 ping), voices.ts (voice
                             listing + out/voices.html audition page), voiceover.ts
                             (eleven_v4_turbo takes → scribe_v1 score → promote + synthetic align,
                             chains durations), align.ts (LCS/STT alignment), durations.ts (timings.json:
                             measured or estimated durations, trigger cues, caption pages),
                             music.ts (ElevenLabs music bed), new-walkthrough.ts (scaffold + register),
                             framecheck.ts (framing gate: zoom cap, cut text at crop lines via
                             pngjs ink scan, chip over UI, click points; suggests a clean focus),
                             render.ts (framecheck, then remotion render; refuses on FAIL)
  videos/example/            reference walkthrough: every shot move, kit usage patterns
```

## Versioning (bump protocol — every template-changing commit)

`template/.kit-version` is a bare integer stamped into every scaffold; SKILL.md
step 0 compares it against the skill's stated current version and routes stale
repos through `skill/references/upgrades.md`. When you change the template:
bump `template/.kit-version`, update the number in SKILL.md ("kit version N"),
and add a changelog + migration entry to upgrades.md. The upgrade ownership
map lives in upgrades.md — keep it true (user-owned: .env, config,
src/videos.ts, videos/, public/, out/; everything else upstream-owned).

## Data flow (inside a target repo's walkthroughs/)

script.ts (VO + shots + triggers) → capture.ts → public/<slug>/captures/*.png|webm
+ capture-manifest.json (dims + cursor points) → voiceover.ts → vo/*.mp3 +
*.align.json → durations.ts → timings.json (drives the whole timeline; captions
mode when no ElevenLabs key) → framecheck.ts → render.ts → out/<slug>.mp4.

## Verify

- `cd template && bun install && bun run typecheck`
- In a scaffolded repo with captures: `bun scripts/framecheck.ts <slug>` exits 0
- `cd template && bunx remotion still example out/check.png --frame=120` — engine
  boots, renders placeholder frames without captures.
