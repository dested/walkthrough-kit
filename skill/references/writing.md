# Writing the film — scenes, VO, shot grammar

`script.ts` is the single source of truth: VO text, shot order, word-cue
triggers, focus targets. The timeline adapts to the measured audio; you never
touch frame numbers.

## Scene shape
- 6–18 scenes. Each scene = one idea, 25–80 spoken words, 1–4 shots.
- Scene 1 orients (what is this, what will we see). Last scene is the outro
  card (`card: 'outro'`, empty shots, `leadSeconds: 0.8, tailSeconds: 2.4`).
- `eyebrow` groups scenes into chapters (THE FLOOR / BACK OFFICE / …) — use the
  app's own top-level structure. Empty eyebrow = no lower-third chip; a blank
  (' ') eyebrow = a title-only chip. The chip shows for ~4s, and framecheck
  fails a scene whose chip would sit over app content (most dense UI has no
  empty corner, so chips are often off).
- Never address a named viewer ("<Name>, this one's yours", "Hey <Name>"). Not
  in the VO, the captions, the cards or the script's header comment. The film
  gets forwarded; speak to whoever is watching.
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
- Zoom focus: prefer `focus: { box: { x0, y0, x1, y1 } }`, read off the PNG
  and sized to the whole row/table/card (labels AND values). Zoom never goes
  past 1.4x (the engine clamps; framecheck fails the ask). On full-width app
  UI a clean zoom is usually ~1.2x across the content column plus a vertical
  move. A detail you can't isolate without slicing its neighbours stays
  unzoomed: the VO points at it instead.
- Unfocused shots hold the whole capture still (no drift), so they never trim
  the nav rail or a right-aligned button.
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
- TTS is eleven_v4_turbo. Bracketed audio tags (`[sighs]`, `[laughs]`,
  `[whispers]`) were a v3 feature; don't count on v4 Turbo performing them.
  If you use one, check the take report that it wasn't read aloud, and keep
  it rare (a demo usually needs none). The pipeline strips tags
  from captions and duration estimates automatically. Never put a tag inside
  a trigger phrase, and never place a trigger's words straddling a tag.

## Pronunciation
- The voice reads `vo` as written, and it guesses at brand names. Keep the
  written name in `vo` (captions show it) and put the respelling in `say`:
  `say: { Gusto: 'Gust-oh' }` on the walkthrough applies film-wide, a scene's
  own `say` overrides. Keys match whole words, case-insensitive,
  possessives included ("Gusto's").
- Respell with plain English chunks the voice can't misread: `Gust-oh`,
  `Kwik-books`, `Coterie` → `Coh-tuh-ree`. Never capitalized letters
  (`GUST-oh` may be spelled out).

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
