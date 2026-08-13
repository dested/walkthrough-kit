# walkthroughs/

Remotion walkthrough videos for this app, scaffolded from
[dested/walkthrough-kit](https://github.com/dested/walkthrough-kit). The engine
(ken-burns stills, cursor clicks, pans, clips, word-synced shot cues, VO, music,
captions) is prebaked — a new walkthrough is just a `script.ts` + a `capture.ts`.

## Pipeline

```bash
bun install
bun scripts/new-walkthrough.ts admin-portal "The admin portal"

# 1. Write videos/admin-portal/script.ts   (scenes: VO + shots)
# 2. Write videos/admin-portal/capture.ts  (produce every img/clip + cursor point)
bun videos/admin-portal/capture.ts          # app must be running at config baseUrl

# 3. Voiceover + timings (skips TTS gracefully without ELEVENLABS_API_KEY → captions mode)
bun scripts/voices.ts                       # list account voices — pick voiceId in config first
bun scripts/voiceover.ts admin-portal
bun scripts/durations.ts admin-portal
bun scripts/music.ts admin-portal           # optional bed; re-run durations after

# 4. Preview / render
bun run dev                                 # Remotion Studio (port 7811)
bunx remotion render admin-portal out/admin-portal.mp4
```

## Where things live

- `walkthrough.config.json` — product name, baseUrl, tone, voice, brand colors.
- `videos/<slug>/script.ts` — THE film: per-scene VO, shots, triggers, focus targets.
- `videos/<slug>/capture.ts` — Puppeteer run producing `public/<slug>/captures/`.
- `capture/kit.ts` — the capture harness (go/save/saveTall/point/recordClip/…).
- `src/engine/` — the film engine. You should not need to touch it.
- `public/<slug>/` — captures, vo mp3s + alignment, timings.json, music.mp3.
- `out/<slug>.mp4` — the render.

Changing a VO line: edit `script.ts`, `bun scripts/voiceover.ts <slug> --only=<sceneId>`,
`bun scripts/durations.ts <slug>`, re-render. The timeline adapts to the new audio.

Tones: `sizzle` (fast demo) · `demo` (confident walkthrough) · `sales` (warm pitch) ·
`tutorial` (calm explainer). Set in config or per-walkthrough (`tone:` in script.ts).
