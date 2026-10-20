# walkthroughs/

Remotion walkthrough videos for this app, scaffolded from
[dested/walkthrough-kit](https://github.com/dested/walkthrough-kit). The engine
(ken-burns stills, cursor clicks, pans, clips, word-synced shot cues, VO, music,
captions) is prebaked — a new walkthrough is just a `script.ts` + a `capture.ts`.

## Pipeline

```bash
bun install
bun scripts/doctor.ts                       # preflight: server, creds, key, voice — fix FAILs first
bun scripts/new-walkthrough.ts admin-portal "The admin portal"

# 1. Write videos/admin-portal/script.ts   (scenes: VO + shots)
# 2. Write videos/admin-portal/capture.ts  (produce every img/clip + cursor point)
bun videos/admin-portal/capture.ts          # app must be running at config baseUrl

# 3. Voiceover (drops to captions mode without ELEVENLABS_API_KEY; runs durations itself)
bun scripts/voices.ts                       # prints voices + writes out/voices.html to audition (any voice; doctor pings it)
bun scripts/voiceover.ts admin-portal       # eleven_v4_turbo: N takes/scene, STT-scored, best kept
#   out/vo-takes/<slug>/report.json holds every take; --pick=<sceneId>:<takeN> to overrule
bun scripts/music.ts admin-portal           # optional bed; re-run durations after
bun scripts/durations.ts admin-portal       # standalone re-time (no re-TTS) after script/music edits

# 4. Preview / render
bun run dev                                 # Remotion Studio (port 7811)
bun scripts/framecheck.ts admin-portal      # framing preflight (zoom cap, cut text at edges, chip over UI, bad clicks)
bun scripts/render.ts admin-portal          # framecheck, then render out/admin-portal.mp4; refuses on any FAIL
```

## Where things live

- `walkthrough.config.json` — product name, baseUrl, tone, voice, brand colors.
- `videos/<slug>/script.ts` — THE film: per-scene VO, shots, triggers, focus targets.
- `videos/<slug>/capture.ts` — Puppeteer run producing `public/<slug>/captures/`.
- `capture/kit.ts` — the capture harness (go/save/saveTall/point/recordClip/…).
- `src/engine/` — the film engine. You should not need to touch it.
- `public/<slug>/` — captures, vo mp3s + alignment, timings.json, music.mp3.
- `out/<slug>.mp4` — the render.

Framing is enforced, not advised: the engine caps zoom at 1.4x (`MAX_ZOOM`), a
`focus: { box }` is fitted so the whole box stays on screen, nothing film-level
(grain, vignette, badge) is drawn over a capture, and `scripts/render.ts` won't
render while `framecheck` reports a problem.

Changing a VO line: edit `script.ts`, `bun scripts/voiceover.ts <slug> --only=<sceneId>`,
`bun scripts/durations.ts <slug>`, re-render. The timeline adapts to the new audio.

Mispronounced name: add `say: { Gusto: 'Gust-oh' }` to the walkthrough (or one
scene), then re-TTS each scene that says it with `--only=<sceneId>`. Only the
audio changes; captions and triggers keep the written word. The run prints
`say Gusto: heard '…'` for every respelled word.

Tones: `sizzle` (fast demo) · `demo` (confident walkthrough) · `sales` (warm pitch) ·
`tutorial` (calm explainer). Set in config or per-walkthrough (`tone:` in script.ts).
