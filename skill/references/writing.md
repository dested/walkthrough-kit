# Writing the film — scenes, VO, shot grammar

`script.ts` is the single source of truth: VO text, shot order, word-cue
triggers, focus targets. The timeline adapts to the measured audio; you never
touch frame numbers.

## Scene shape
- 6–18 scenes. Each scene = one idea, 25–80 spoken words, 1–4 shots.
- Scene 1 orients (what is this, what will we see). Last scene is the outro
  card (`card: 'outro'`, empty shots, `leadSeconds: 0.8, tailSeconds: 2.4`).
- `eyebrow` groups scenes into chapters (THE FLOOR / BACK OFFICE / …) — use the
  app's own top-level structure. Empty eyebrow = no lower-third chip.
- Target runtime: sizzle 60–100s, demo 2–4 min, sales 90s–2.5 min, tutorial
  as long as it needs. ~150 words ≈ 1 minute.

## Shots
- Shot 1 of a scene has no trigger — it opens with the scene.
- Every later shot needs `trigger`: an **exact substring of that scene's vo**
  (case-insensitive, punctuation included). Pick a short distinctive phrase that
  occurs once. `durations.ts` tells you if one doesn't resolve.
- Moves: `cut` (crossfade, default) between different screens; `zoom` (ken-burns
  push) onto a region of the SAME capture — supply `focus`; `click` when the VO
  says the action ("click the slot…") — supply `cursorKey` measured on the
  capture you're leaving. `pan: true` for tall fullPage captures.
- Zoom focus values: prefer `kit.point()`-measured coordinates over guesses.
  Scale 1.25–1.4 reads well; 1.55+ only for small UI like a docked panel.
- Consecutive shots on the same image become one continuous camera move — use
  that: establish wide, then zoom to the detail as the VO names it.

## VO voice — read notes that survive contact with TTS
- Plain and spoken, short sentences, land them. Contractions everywhere.
- Write numbers as words as you want them spoken ("thirteen hundred bucks",
  "thirty seconds") and make them match the screen exactly.
- Concrete beats abstract: "click the slot, pick the lesson, take the card.
  Thirty seconds." not "streamlined booking workflow".
- Point at the screen with words — "look down the left side", "it's right
  there" — those phrases are also your best triggers.
- No marketing filler ("seamless", "powerful", "robust"). No feature-list
  monotone: vary rhythm, ask a question occasionally, answer it.

## Tone deltas
- **sizzle**: clipped fragments allowed. One idea per breath. Hard cuts, more
  zooms, fewer pans. Open with the strongest screen, not a welcome.
- **demo**: confident guide showing a colleague around. "Now the floor." /
  "Over to the storefront." as chapter turns.
- **sales**: sell outcomes, not controls — every scene ends on what the user
  gets ("…and you find out because the money's in your account"). Warmer outro
  with an explicit CTA.
- **tutorial**: number the steps out loud, one action per sentence, pause after
  each ("Then save. That's it."). Prefer clicks over zooms so the viewer sees
  the real path. No hype at all.
