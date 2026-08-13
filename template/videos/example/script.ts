// EXAMPLE walkthrough — the reference for the shot grammar. It renders with
// placeholder frames until videos/example/capture.ts has run against a real app.
// Copy the patterns, then delete this walkthrough (remove it from src/videos.ts).
//
// The VO is the single source of truth: every shot after the first starts on a
// `trigger` — an exact substring of the scene's vo. After the voiceover run,
// triggers resolve to the spoken second, so visuals stay word-synced no matter
// how the read lands.
import type { Walkthrough } from '../../src/engine/types'

export const WALKTHROUGH: Walkthrough = {
  id: 'example',
  title: 'The example walkthrough',
  tagline: 'What a finished script.ts looks like — three scenes, every shot move.',
  // tone: 'sizzle',            // override walkthrough.config.json per-film
  // voiceId: '…',              // override the configured ElevenLabs voice
  outro: { headline: 'Come see it live.' },
  scenes: [
    {
      id: 's01-dashboard',
      eyebrow: 'OVERVIEW',
      title: 'The morning screen',
      vo: `This is the dashboard — everything the day needs on one screen. Look at the numbers across the top: live, not yesterday's export. And down the left side, the whole product in one rail.`,
      shots: [
        // Shot 1 always opens with the scene — no trigger.
        { img: 'dashboard.png' },
        // Zoom pushes onto a focus target while the same capture stays up.
        // focus = normalized (x, y) center + scale; measure real values with kit.point().
        { img: 'dashboard.png', trigger: 'numbers across the top', move: 'zoom', focus: { x: 0.5, y: 0.22, scale: 1.3 } },
        { img: 'dashboard.png', trigger: 'left side', move: 'zoom', focus: { x: 0.09, y: 0.5, scale: 1.32 } },
      ],
    },
    {
      id: 's02-detail',
      eyebrow: 'THE WORK',
      title: 'Click into anything',
      vo: `Click any row and the full record opens — history, activity, everything in one place. And the long pages? They just keep going.`,
      shots: [
        { img: 'list.png' },
        // A click flies the cursor to the manifest point 'list-row' (recorded by
        // capture.ts) and presses exactly when the trigger word is spoken.
        { img: 'detail.png', trigger: 'full record opens', move: 'click', cursorKey: 'list-row' },
        // pan: true on a tall (fullPage) capture scrolls it top-to-bottom.
        { img: 'detail-tall.png', trigger: 'keep going', move: 'cut', pan: true },
      ],
    },
    {
      id: 's03-live',
      eyebrow: 'IN MOTION',
      title: 'Watch it happen',
      vo: `And here it is live — type, and the whole screen answers.`,
      shots: [
        // A recorded clip (kit.recordClip) plays full-bleed instead of a still.
        { clip: 'search-live.webm' },
      ],
    },
    {
      id: 's99-outro',
      eyebrow: '',
      title: '',
      vo: `That's the tour. One system, already set up. Come see it live.`,
      shots: [],
      card: 'outro',
      leadSeconds: 0.8,
      tailSeconds: 2.4,
    },
  ],
}
