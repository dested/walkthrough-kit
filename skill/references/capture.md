# Capture — kit API + framing tricks

`capture/kit.ts` owns the browser (1440×810 @ 2x → 2880×1620 stills), output
paths (`public/<slug>/captures/`), and the manifest. Your `capture.ts` composes
its helpers. Re-runs are idempotent; `ONLY=stage1,stage2` / `SKIP=stage3` gate
the `kit.stage()` blocks and merge into the existing manifest.

## API (all page args default to the main page)

```ts
const kit = await createCapture('<slug>' /*, { baseUrl, viewportWidth, tallCap, … } */)

kit.stage('name')                    // gate a block for ONLY/SKIP partial re-runs
kit.go(path, waitText?, settle?)     // navigate + hide scrollbars + wait for anchor text + settle
kit.save('name.png', opts?)          // screenshot (dismisses toasts first), records dims
kit.saveTall('name.png')             // fullPage, clipped at tallCap (default 5400 CSS px)
kit.point(key, img, finder, space?)  // record normalized cursor/zoom target; space 'page' for talls
kit.clickFound(finder)               // click what a browser-side finder returns
kit.readText(finder)                 // element innerText, squashed — feed kit.fact()
kit.scrollTo(finder, offsetPx?)      // park an element offsetPx under the top edge
kit.signIn({ path?, emailSel?, … })  // default CAPTURE_EMAIL/_PASSWORD creds
kit.signIn({ as: 'client' })         // named set: CAPTURE_EMAIL__CLIENT/_PASSWORD__CLIENT
                                     // (or pass email/password explicitly)
kit.recordClip('name.webm', async (p) => { …drive the page… })
kit.newPage(viewport?, userAgent?)   // second tab: portal user, phone UA, …
kit.fullyLoad()                      // scroll-thru to fire lazy loads, freeze animations
kit.waitForSkeletons()               // block until .animate-pulse/[data-skeleton] gone
kit.fact(key, value)                 // report on-screen reality; printed by finish()
kit.finish()                         // ALWAYS last (try/finally): writes manifest, prints facts
readEnv('CAPTURE_EMAIL')             // process.env, then walkthroughs/.env
```

**Finders run in the browser** — they are stringified, so close over nothing.
To inject a resolved value, build the finder as a string:
`` kit.point('row', 'list.png', `() => [...document.querySelectorAll('a')].find(a => a.innerText.includes(${JSON.stringify(name)}))` ) ``

## Framing rules (learned the hard way)

- **The shot is the subject, not the page header.** Most app pages lead with a
  big heading that eats two-thirds of the frame. `kit.scrollTo(tabRow, 88)` to
  park the content under the sticky topbar before saving.
- **Empty states are dead frames.** Before shooting: put items in the cart, open
  the busiest day, pick the folder that has files, open a saved record — and if
  "today" is thin, walk forward until the screen is full. Draft state is fine;
  **never submit** anything you didn't intend to write.
- **Read-only discipline.** Open-and-abandon modals are fine, filling forms as
  drafts is fine; submitting/saving is not, unless the user approved that write.
- **`point()` before `save()`** when the point belongs to the still you're about
  to take, and measure clicks **on the capture you're leaving** (the cursor
  lands on the old screen). For talls, pass space `'page'`.
- **Lazy content**: `fullyLoad()` before `saveTall()`; decode images; then the
  kit freezes CSS animations so nothing is captured mid-fade.
- **Verify on-screen text** with `kit.fact()` (balances, counts, names) — the VO
  has to match; `finish()` prints the FACTS block for reconciliation.
- **Login roles matter**: shoot as the role that can see everything, or the
  sidebar/chrome changes between scenes and the film looks broken.
- **Assert the app version**: if the film depends on a UI structure (a nav, a
  tab set), check it's actually on screen and throw early — a stale build makes
  every downstream shot wrong.
- **Clips**: keep them short (3–8s), one interaction, typed with `delay: 80–120`
  so it reads human. The engine plays them full-bleed and muted.
- **Toasts**: `save()` removes live toast rails automatically; still avoid
  triggering ones that reflow the page mid-shot.

## Manifest contract

Every `img:`/`clip:` in `script.ts` must exist in `public/<slug>/captures/`, and
every `cursorKey:` must exist in the manifest points. The engine degrades
gracefully (placeholder frames, centered cursor) but a finished film has no
placeholders and no centered-fallback clicks.
