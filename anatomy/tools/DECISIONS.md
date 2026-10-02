# Anatomy: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look as built; this file
holds the record: the stock app as a stranger found it, the plan the art pass wrote (its sections 8 and
9, moved here word for word as its step 21 asked), what the build did differently and why, the tools as
run, the owner calls left open, the phone checks, and what the lead owes outside this folder. Plan 0011
package B, D1 to D5 and HOUSE.md are the brief. The follow-up after the final review, with the data's
text, is its own section below the review's.

## The build, 2026-10-01

### What was built

Every step of the change list below (section 8, steps 1 to 21) was applied. In short: the house face
vendored byte for byte and the two stock faces gone with their credits, their `@fontsource` packages
and their copy lines; `miniapp.json` at 149 characters and version 4.0; `js/units.js` and
`js/levels.js`; `index.html`, `styles.css` and most of `app.js` rewritten on the house's pattern
(Global Weather's and Norne Reservoir's); the Levels drawn; the selection's ink outline; the depth
words; focus mode; the card, the status plate, the notices, About and Find as the art direction says;
`CREDITS.txt` and `NOTES.md` in US English with the type credit; `tools/check.mjs`,
`tools/test_decode.mjs` and `tools/shoot.mjs` written and passing. The data, `vendor/`, the pipeline
and `screenshots/app.png` are byte for byte what they were (`check.mjs` pins all of them, `shoot.mjs`
re-hashes `app.png`).

All nineteen bugs on record (B1 to B19, section 8) are fixed in the app as built, each checked by a
tool where a tool can see it: B1 to B4 and B18 by `shoot.mjs`'s hit targets in both modes and at five
widths; B5 by the bands (the plate is its own grid row); B6 by `check.mjs` (the step keys' words begin
their names) and `shoot.mjs` (the visibility boxes' names); B7 by `shoot.mjs`'s outline on a vein in
both themes; B8 by `check.mjs` (149 characters); B9 and B15 by `check.mjs`'s SI and spelling scans and
`shoot.mjs`'s SI scan of every visible text node; B10 by the opening's absence (the camera's put-back
test compares the opening frame); B11 by `shoot.mjs`'s Reduce Motion switched while open; B12 by
`shoot.mjs`'s loop at rest; B13 by `check.mjs` (About prints only the data's first two source
paragraphs) and `shoot.mjs` (About never shows the third); B16 by `check.mjs` (the viewport and
`lang`); B17 by the view words; B19 by the card's markup (no `aria-live` on it; one sentence a tap in
the live region). B14 and the data's own British words are data, left for owner call 1.

### Departures from the art direction, as built

1. **The Levels when pulled apart.** By part or by group, the thoracic vertebrae rise past C7 (T1 sits
   2 mm above C7 at 45 % by part, measured through the test hook's offsets). A column drawn strictly
   through the projected centers would then fold back on itself, and the first build hid the column
   whenever the centers were out of order, which hid it for every explode by part. As built, the column
   keeps the spine's order: each projected center is held at or below the one above it, so the block
   between two vertebrae that passed each other flattens. `shoot.mjs` applies the same rule in its own
   projection and holds every drawn edge within 1 px (0.000 measured). ART.md section 1 says so.
2. **The camera's fit.** The art direction kept the stock fit (a 10 % margin plus the box's depth);
   as built `frame()` finds the nearest distance at which all eight corners of the box project inside
   the room with 4 % to spare, by bisection. The whole body is larger on the plate (its spine 192 px
   tall at the first-run view, 204 px from the front, at 390 x 844), so the Levels have more room.
   The card counts in the room only when the selection itself is framed; with the card in the room for
   every fit, `Show the whole body` and the views squeezed the body into the lower half of the plate
   and the column disappeared under 120 px.
3. **On a phone on its side** the plate is 263 px tall and the whole body's spine projects under
   120 px, so the opening view there shows no column; the caption says `Levels: turn the body upright,
   or come closer, to read its vertebrae beside it.` until the reader zooms in. The threshold is the
   art direction's and was kept; lowering it to about 90 px would put a column of 3.6 px blocks beside
   the whole body on its side. An owner call (below).
4. **The Layers sheet** sits between the caption band and the dissection band, not over the dissection
   band, so the step keys stay under it and a person can remove a layer and watch the sheet's words
   change. The plate keeps its 260 px (measured).
5. **The explode track** is a 48 px box with 2 px taken back above and below: at 44 px the hit test
   measured 43.25 px at 360 and 375 px wide (sub-pixel row positions). Its width at 320 px is 86 px,
   not the 100 px the plan asked for, because the explode key and the three words take the rest; the
   camera's taps still land on 44 or 45 and on 0 at every width `shoot.mjs` runs.
6. **The caption on a phone on its side** runs on one line across the band with the credits under it,
   not beside them: beside the credits the line had about 65 characters and the sentences run to 107.
7. **The tree in Find.** A layer's whole row is its toggle; a group has a 44 px chevron key of its own
   just before its name, and the name selects the group (as the stock's group heading did); a group's
   parts are built the first time it opens. Part rows are 46 px (44 measured 43 at some widths).
8. **The card's compact form** applies on any plate under 300 px (on its side, and under the Layers
   sheet): the name at 15 px, the Latin and the Layer row left out, the rest scrolling, at most 80 % of
   the plate.
9. **Sentences.** A span that starts above C1 reads `The selection runs from above C1 to …` (the plan
   only wrote `spans`, which reads badly before `above`); one band reads `lies at T12`; with no column
   the sentence ends `; turn the body upright, or come closer, to see its bar.` The apostrophes the app
   writes are U+2019.
10. **A dialog bug found by the test.** Find's and About's bodies did not scroll in the first build
    (a flex child without `min-height: 0` grows to its content); `shoot.mjs` caught it when a result
    below the fold could not be tapped, and now asserts that About scrolls.
11. **The live region** fills 50 ms after it is cleared (a timer), not on the next animation frame, so
    a sentence is never held back behind a frame the loop does not ask for.
12. **The fit follows the explode.** In the house's shorter plate (587 px, the stock had the whole
    screen) the body pulled apart 45 % from the opening's fit ran off the plate's top and foot, which is
    the camera's README picture (`MarketingShotsUITests.swift`: "At 45 % the whole body stays in
    frame"). As built, while the camera stays where a fit put it (turned, but not pinched or panned),
    the explode fits the body again when it settles (a 750 ms flight on `--draw`'s curve, a cut under
    Reduce Motion), and a new plate size fits it again at once. A fit frames every part that is not
    hidden, whatever its layer's mode, so the camera's put-back (remove, 45 %, 0, bring back) ends on
    the opening frame pixel for pixel (`shoot.mjs`: 0 pixels differ), and the body at 45 % leaves the
    plate's top and foot bare (100.0 %). The camera's fit is stored with it (`fit` in
    `skeleton-viewer:camera`, a field added to the stored object; every field read before is read).
13. **Code.** 104 843 B as built against the plan's estimate of about 96 000 B; fonts 40 075 B; the
    ZIP 24 547 427 B, under the 24 554 062 B it was before the pass.

### The tools, as run (the builder's last run, 2026-10-01)

- `node tools/check.mjs`: 47 checks `ok`, none failing, `all checks pass`. It prints app code 104,843 bytes, fonts/
  40,075 bytes, the ZIP 24,547,427 bytes (budget 30,692,577), and counts the data's own British words
  (13 kinds, 19 occurrences) without failing.
- `node tools/test_decode.mjs`: 23 checks `ok`, `all checks pass` (45 parts and 142 510 vertices decoded
  within 0.000 of a quantization step; all 1 752 spans and 1 721 heights 1 mm apart equal the test's own
  formulas; the table of ART.md section 1; 869 structures wholly within the spine's range).
- `python3 anatomy/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`, exit 0.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: 72 checks `ok`, `all checks pass`, in about
  7.5 minutes, light and dark, Reduce Motion, broken data, five widths; `screenshots/app.png` untouched
  (`27f89f092307…`). It wrote `screenshots/{open,explode,kidney}-{light,dark}.png`, `layers-{light,dark}`,
  `about-light`, `bone-light`, `find-light`, `focus-light` and `peeled-explode-light`, for the README panes
  and the before/after pair; the stock app's pictures for the "before" are `tools/.work/look/` (ignored). Headless Chromium with
  SwiftShader: its load times (1.8 to 2.9 s) and frame times (over a second a frame with the whole body)
  are not phone evidence.

### Incidents

- The art pass reported running one read-only git command (`git check-ignore`), against the no-git rule.
- The build ran one too: `git -C . diff --stat`, read-only, its output discarded, folded by mistake
  into a command that rewrote the tool manifests. It changed nothing. Both are disclosed to the lead.

### For the lead, outside this folder

- **The camera's comments** (no string changes): `MarketingCameraCase.swift`'s note on
  `webControl(prefixed:)` says the peel key reads "Peel skin" on screen; it now reads `Remove the skin`.
  The same file's `waitForAnatomy()` comment says "27 MB of geometry" and "934 structures"; the data
  holds 32.0 MB in 8 files and 1 752 structures (shot 16's comment in `MarketingShotsUITests.swift` says
  934 as well).
- **The README's entry** for Anatomy already names the Levels and no longer names the stock faces (the
  art pass's note that it says "two SIL OFL fonts" is out of date); it still groups `1,752` with a
  comma, which is the README's own style and the lead's call.
- **The camera's explode tap now starts a flight.** Setting `Explode amount` by a tap (0.45, then
  0.01) fits the body again over 750 ms when the camera is still at its fit; `setWebSlider` sleeps
  1.5 s and the clip pauses 2.5 s after it, so no wait needs changing, but the README picture and the
  clip now show the whole body pulled apart rather than a body cut at the plate's edges.
- **HOUSE.md's budget row** for Anatomy: as built, code 104 843 B, fonts 40 075 B, ZIP 24 547 427 B.
- `tools/package-lock.json` was edited by hand (the two `@fontsource` entries removed), not by
  `npm install --package-lock-only`; a rerun of `npm ci` in `tools/` should be checked once online.

### Owner calls added by the build

- **The Levels on a phone on its side** (departure 3): keep 120 px (no column beside the whole body
  on its side until the reader zooms in), or lower the threshold for short plates.

## After QA, 2026-10-01

QA's verdict was `fix`: one must, one should, three nits it carried from the build's own disclosures.

### The must: Find's field showed the engine's blue clear button (fixed)

Typing into `Find a structure` drew the engine's own clear button (`::-webkit-search-cancel-button`) in
its accent blue in the light theme (QA sampled about RGB 58, 97, 163), against HOUSE.md section 3.1's
"no accent color, anywhere". No tool saw it: every screenshot showed the field empty, and the button is
a user-agent pseudo-element, not a color in `styles.css`.

- `styles.css`: `#search::-webkit-search-cancel-button` and `::-webkit-search-decoration` set to
  `appearance: none; display: none`; the field's right padding 44 px; `.find-field` positioned;
  `.find-clear`, a 44 x 44 key at the field's right end in `--ink-2`.
- `index.html`: `<button id="search-clear" class="find-clear" aria-label="Clear the search" hidden>`
  inside `.find-field`, holding the card's own drawn 12 px ✕ (the same SVG path as `#c-close`).
- `app.js`: the key shows only while the field holds text; a tap empties the field, rebuilds the tree
  and puts focus back in the field.
- `ART.md`, the Find row of the chrome table: the switched-off engine button and the house key, as built.
- `tools/shoot.mjs`: a new check per theme, after the contrast check. It opens Find, types `femur`,
  photographs the field and fails on any pixel whose widest channel spread is over 40 of 255; it also
  checks the key's hit target, and that it empties the field, hides itself, keeps focus and brings back
  the nine layers. **Shown to catch the fault**: a scratch script that served `styles.css` without the
  `::-webkit-search-cancel-button` line measured a channel spread of 123 in light (250 pixels over 24, the
  blue ✕ beside the house's own); with the line in place, 24 in light and 23 in dark, none over 40. In
  dark the engine's button is a near-gray, so the light run is the one that catches it.
- **Not checked on a phone.** WKWebView is WebKit, which honors `::-webkit-search-cancel-button`, but
  this was seen in headless Chromium only; added to the phone checks below.

### The should: ART.md's height from sole to crown (fixed)

ART.md said `1.66 m`; the app writes `1.68 m` (`U.meters(skin.hi - skin.lo)`), and QA recomputed
1.684 527 m from the four skin parts' boxes in `data/geometry.json`. The app was right and the
document wrong: ART.md's About row now says `1.68 m` with the unrounded figure, and `js/units.js`'s doc
comment, which used 1.66 as its example, says 1.68 too. The 1.66 in this file's section 8 (step 4) is
the art pass's plan, kept word for word.

### The nits

All three were the build's own disclosures and stay where they were: the data's 591 against 651 (owner
call 1), the hand-edited `tools/package-lock.json` (an `npm ci` once online), and the camera's stale
comments (for the lead, above).

### The phone check added

- Find a structure, type a few letters, on the owner's iPhone in light and dark: only the house's gray ✕
  at the field's right end, no blue engine button beside it; the ✕ empties the field.

### The tools after QA (2026-10-01)

- `node tools/check.mjs`: 47 `ok`, `all checks pass`. App code 105,772 bytes (budget 200,000): app.js
  62,213, index.html 12,855, js/levels.js 4,599, js/units.js 2,282, styles.css 23,823. fonts/ 40,075
  bytes. ZIP 24,547,801 bytes (budget 30,692,577), 26 files, `index.html` at its top.
- `node tools/test_decode.mjs`: 23 `ok`, `all checks pass`.
- `python3 anatomy/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`, exit 0.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: 74 `ok` (the 72 before, and the new Find
  check in each theme), no `FAIL`, `all checks pass`; `screenshots/app.png` untouched (`27f89f092307…`).
  Headless Chromium with SwiftShader: no number in it is phone evidence.
- **For the lead**: HOUSE.md's budget row for Anatomy, as built after QA: code 105 772 B, fonts
  40 075 B, ZIP 24 547 801 B. No string the camera reads changed; the Find dialog gains one button
  (`Clear the search`), present only while the field holds text.


## After review, 2026-10-02

The reviewer's verdict was `fix`: two musts, seven shoulds, six nits. Every must and should is applied
or declined below with its evidence; the nits likewise. No data file, `vendor/` file, pipeline file or
`screenshots/app.png` changed (`check.mjs` pins them; `shoot.mjs` re-hashes `app.png`). No git was run.

### Must 1: the outline scribbled inside the selection (fixed)

Cause, as the reviewer found it: the two back-face hulls lie at the surface's own depth and z-fought
with thin, double-sided soft tissue. Fix, the reviewer's: the renderer is created with
`stencil: true`; every part's material carries `stencilRef: 1`, `stencilFunc: AlwaysStencilFunc`,
`stencilZPass: ReplaceStencilOp`, and `applyLook()` switches `stencilWrite` on for the outlined
selection only; both hull materials carry `stencilWrite: true`, `stencilRef: 1`,
`stencilFunc: NotEqualStencilFunc` (their ops stay Keep). Checked in the vendored three.js r186
(`three.module.js` 10429-10437: the stencil test is enabled per material by `stencilWrite`).

New `shoot.mjs` check, both themes: a tap at the projected center of the Left external oblique at the
opening view selects it; its silhouette is measured by serving a copy of `anatomy.json` that colors it
pure green (read by the app's own refresh), eroded 4 px; inside it the selected frame must equal the
unselected one. **Shown to catch the fault**: `tools/.work/outline-proof.mjs` (git-ignored) serves
`app.js` with only the hulls' stencil line removed and measures the same way: `broken: … inside its
silhouette (4010 device pixels, eroded 4 px) 910 pixels change`; with the line, `fixed: … 0 pixels
change`. The final run: 0 inside in both themes, 576 (light) and 596 (dark) ink pixels around it.

### Must 2: Find flew to structures the plate cannot show (fixed)

`select()` now flies through `flyToSel()`: `frame()` returns its destination, and `blockerOf()` casts
rays from there to eight of the selection's vertices (spread over its parts) against the solid meshes;
the first ray that meets the selection before anything else settles it as seen; a solid part hit
nearer than the vertex is the blocker. When there is one, X-ray turns on, the card's `X-ray` key shows
pressed, and the tap's sentence gains `X-ray on, so it shows through the muscles.` (the blocker's layer,
its `short` lowercased). `Zoom to it` uses the same path and says the sentence alone. A double tap never
needs it (the tapped part is the front-most solid hit).

Departure from the suggestion (`S.ghost = true … stored as it is today`): X-ray turned on this way
belongs to that selection; it is not stored and goes off when the selection changes or ends
(`autoGhost`). Reason: a person who never pressed X-ray would otherwise find the whole body ghosted on
their next, unrelated tap. X-ray pressed by hand is stored and kept as before.

`shoot.mjs`: of the eleven structures found by name, ten turn X-ray on (all but the xiphoid process),
each saying so; the found right kidney changes 94 021 (light) and 104 260 (dark) sampled body pixels
against the same view with it let go. The vein check now also asserts X-ray stays off for the
superficial great saphenous vein (it does).

### Should 1: the Levels' hidden-state caption gave the wrong reason (fixed)

`LV_STATE.reason` is now `steep` or `small`, each with its own sentence (`HIDDEN_RULE.steep`,
`.small` in `js/levels.js`, and `spanSentence(…, why)`), the reviewer's words. The open call
(departure 3 above) is taken on the reviewer's recommendation but with the measured figure: the
whole body's spine on its side measured **88 px** (`shoot.mjs`, 844 x 390, a 263 px plate), not the
review's estimate of 105, so the threshold on a plate under 300 px is **80 px**, not 96. The column is
now in the side-on opening (`shoot.mjs`: 25 blocks, the caption the rule sentence). It is still listed
as an owner call below (the alternative: 120 px everywhere). `test_decode.mjs` checks all four new
sentences; `shoot.mjs` checks the top view (`steep`) and far away (`small`).

### Should 2: focus mode kept nine controls (fixed, with one departure)

Focus mode now hides and inerts the explode row (`#drow-explode`: `Explode`, the track, `Part`,
`Group`, `Region`) with the header, the keys and the Layers sheet. What stays of the controls is the
**step keys**, not the explode row the review suggested. Reason, in the camera's code:
`MarketingCameraCase.swift` `waitForAnatomy()` (lines 224-229) waits up to 240 s for
`webText("Every layer is showing")`, the bring-back key's name, and only then calls
`showControlsIfHidden()`. A library left in focus mode with the step keys hidden would never show that
name, and the camera would time out. Keeping the step keys keeps the camera unchanged and still gives
the house's one control (a pair of step keys, as a player's). Offered instead, needing a camera change
by the lead in the same commit: the explode track alone, with `waitForAnatomy()` tapping
`Show the controls` while it waits. `shoot.mjs` lists what is left (`Show the controls`, the stamp, the
two step keys) and holds the plate at 700 px or more (707 measured).

### Should 3: the selection tint competed with the signature (fixed)

Owner call 3's outline-only option is taken: a selection of up to 60 parts keeps its colors (no lerp,
no emissive). A larger group or region, which has no outline, takes the data's tint at 0.3 with no
emissive, so a region still shows; `palette.py` reports it (767 light, 808 dark parts move less than
dE 0.10; reported, not a check) and About names the outline and the tint as display choices.

### Should 4: British spelling in the data text on screen (declined in this pass; the lead's)

The data stays byte-identical in an art pass (HOUSE 6.5; `check.mjs` pins `anatomy.json`). The kidney
card still reads `180 litres`. The follow-up is owner call 1 below, as the reviewer says: a text-only
patch of `anatomy.json`'s strings (or a prose sweep of `build_extras.py`, `build_full.py`,
`build_anatomy.py`, `build_vessels.py`), the eight `.bin` files and `geometry.json` proven
byte-identical, 591 to 651 and the stale third source paragraph fixed in the same change, then
`anatomy.json` re-pinned in `check.mjs`. `check.mjs` still counts 13 words, 19 occurrences.

### Should 5: ART.md carried the pass's history and stale figures (fixed)

ART.md is rewritten as the look as built: no `stock`, no B-references, no owner-call history, no
`tools/.work/` citation. Its figures now cite `check.mjs`, `test_decode.mjs`, `palette.py` and
`shoot.mjs`, refreshed from the final runs (sampler 152 samples, lowest 4.04:1 and 5.70:1; spine 203
and 208 px, 88 px on its side; plate 587 and 707 px; code 112 859 B; ZIP 24 550 664 B). What moved out:
the comparisons with the app before the pass (its serif title and Latin, its cobalt actions and
frosted dock, card, panel and status pill, its circles and bevelled buttons, its loader and opening,
its `Side`, `Fit`, `Focus`, `Peel` and `Add`, its duplicate panel keys and segmented control, its
`aria-live` card, its `Visible` checkboxes, its once-read Reduce Motion and its never-resting loop, its
two faces and their files), which are recorded in "The stock app, as a stranger found it" and section
8 below. The body-lit factors' calibration is recorded here: `tools/.work/lit.py` over the stock app's
rendered bone (`tools/.work/look/*-3-skeleton.png`, headless Chromium, 390 x 844) printed p1 0.59 to
0.70, p10 0.82 to 0.85, median 1.04, p90 1.08, highest 1.15; `palette.py` states them as constants.
The two alternative grounds (owner call 2) were compared in `tools/.work/look/grounds-compare.png`
(ignored).

### Should 6: three poor pictures (fixed)

`shoot.mjs` blurs before the `open-*` shots and before `about-light`; About is opened from a fitted
front view and shot once its slide has no running animation; the focus picture is the whole body from
the front with nothing selected, taken before the tap test. Re-run with `SCREENSHOTS=1`.

### Should 7: the camera's fit ignored the safe areas (fixed; a phone check)

`index.html` gains `#safe-probe`, padded by `env(safe-area-inset-*)`; `resize()` reads its padding into
`SAFE`; `room()` adds the left inset always, the right one beside the keys and in focus mode, the top
one in focus mode; `placeCard()` adds the right one. `shoot.mjs` gives the probe a 47 px top inset by a
test style: in focus mode the body's top moves from 48.5 px to 92.5 px under the plate's top. Real
insets are a phone check.

### The nits

- **Short-plate card**: the compact form now applies under a 420 px plate; the Latin and the `Layer`
  row leave so `Levels` stands under the name; `Zoom to it` reads `Zoom` there (a hidden span, so the
  name is the visible word). `shoot.mjs` at 375 x 667: a 410 px plate, compact, one row of actions, the
  Levels row in view. Applied.
- **The explode words acted as well as set**: the auto-explode in `setLevel()` is gone; the words set
  only. Applied.
- **VoiceOver and dialogs**: the five view descriptions are `hidden` (read by `aria-describedby` only;
  `check.mjs` checks it); opening Find or About makes every other child of `body` inert and closing
  restores what each had (focus mode's own inert bands included). `shoot.mjs` checks both states.
  Applied.
- **`25 vertebrae` counted the sacrum as one**: the rule sentence reads `this body’s spine in 25
  levels`; About's row reads `Levels on the spine: 25, C1 to S1–S5, the sacrum as one`, and its
  paragraph says the sacrum's five fused vertebrae count as one level. Applied.
- **Per-frame cost in `drawLevels()`**: the two colors are read once per theme (`themeLevels()`), and
  the projection uses one scratch vector. Applied.
- **Single-pointer pan and keyboard orbit**: left to the owner's family-wide decision (D13; owner call
  6). Declined here.

### For the lead

- No string the camera reads changed; no camera change is needed. The README picture
  (`kidney-light.png`) now shows the kidney outlined through X-ray.
- HOUSE.md's budget row for Anatomy, after review: code 112 859 B, fonts 40 075 B, ZIP 24 550 664 B.
- `tools/.work/outline-proof.mjs` is the scratch proof above; it is git-ignored and may be dropped.

### Owner calls, as they stand after review

1. The data's text (spelling, 591, the third source paragraph): open, recommended as a text-only
   follow-up.
2. The light theme's plate: open (kept: the film base).
3. The selection's tint: **taken** on the review's recommendation, outline only up to 60 parts, the
   tint at 0.3 past that. Reversible in one constant (`TINT`) and one line of `applyLook()`.
4. What stays in focus mode: **decided** as above (the step keys); the explode track alone is the
   alternative, with a camera change.
5. The view words (atlas terms): open.
6. Single-pointer pan and keyboard orbit: open (D13).
7. `CREDITS.txt`'s two addresses: open.
8. The Levels on a phone on its side (departure 3): **taken** at 80 px on plates under 300 px; the
   alternative is 120 px everywhere.

### Phone checks added by the review (not claimed)

On the owner's iPhone, iOS 26.x, and the oldest supported phone on iOS 18.x: the outline on a muscle
(no speckles inside, light and dark); Find a structure, `right kidney`: X-ray on and the kidney
outlined; focus mode in Snuggery's full screen, the head clear of the status bar, the ghost key and
Snuggery's exit control both reachable; a tap on the explode track seeks (iOS 26); frame time turning
the whole body, with a 60-part outline and with X-ray; the explode drag; idle power; memory after five
minutes; VoiceOver on the depth words, the view words (each description read once), the card and a tap
(the X-ray sentence); the phone on its side (the Levels in the opening).

### The tools after review (2026-10-02)

- `node tools/check.mjs`: 48 `ok`, `all checks pass`. App code 112,859 bytes (budget 200,000):
  app.js 67,575, index.html 13,663, js/levels.js 5,064, js/units.js 2,282, styles.css 24,275. fonts/
  40,075 bytes. ZIP 24,550,664 bytes (budget 30,692,577).
- `node tools/test_decode.mjs`: 23 `ok`, `all checks pass`; the caption's 11 sentences, the longest 96
  characters.
- `python3 anatomy/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`, exit 0.
- `SCREENSHOTS=1 PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: 83 `ok`, 0 `FAIL`, `all checks pass`, exit 0 (log `tools/.work/shoot-r4.log`); `screenshots/app.png` untouched (`27f89f092307…`). Headless Chromium with
  SwiftShader: no number in it is phone evidence.



## The follow-up, 2026-10-02

The final review ended `fix` for one must, the card opening under the finger, with four shoulds
(focus mode's card under the ghost key on a phone 375 px wide; the structure found under X-ray read
only by its outline; two stale citations; the Layers pictures). Owner call 1, the data's text, and the
hand-edited lockfile came with them. One Opus agent; no git was run. Every figure below names the
command that printed it. The probes are scratch scripts outside the repository; every claim one of them
supports is also asserted by `tools/shoot.mjs` or `tools/check.mjs`, which ran as listed at the end.

### The must: the card opened under the finger (fixed)

**Cause.** `placeCard()` placed the card by the selection's projected center: top-left, unless that
center fell inside the card, then bottom-left. A structure reaching below the card (an abdominal muscle
tapped near its top, say) kept the card at the top, over the point the finger had just touched, and the
tap's own click, which the browser sends after the pointerup to whatever then stands at that point,
landed on the card's action row. **Reproduced** at 390 x 844 (DPR 2, touch through CDP) by a probe
tapping an 11 x 17 grid over the upper plate: of 82 taps that opened a card, 9 opened it over the
tapped point, and every one of those 9 clicks pressed a key: `X-ray` six times, `Isolate` twice, `Zoom to
it` once.

**Fix** (`app.js`):
- `pick()` hands the tapped point to `select()`, which keeps it (`tapAt`) until the camera is moved by
  hand (OrbitControls' `start`), the plate changes size, or anything else selects.
- `placeCard()` tries the top-left and the bottom-left places and keeps those whose rectangle stays
  24 px clear of the tapped point on every side (`FINGER`, half a fingertip). Of those it takes the one
  covering less of the selection's projected box (`selRect()`: the visible selection's world box through
  the camera), the top on a tie. Where neither clears the finger, the card narrows to end 8 px left of
  it when 180 px remain there, or else shrinks into the taller band above or below it.
- A capture-phase click listener on the card swallows the one click that may follow the opening tap. It
  is armed for 600 ms by `pick()` and disarmed by the next `pointerdown` or `keydown`, so a deliberate
  tap or key press on the card always counts.

**Both halves shown on their own** (the same probe, 187 taps): fixed, 94 cards, none over the tapped
point and no click reaching a card. `app.js` as it was with only the guard added: 9 cards still opened
over the finger and all 9 clicks reached the card, but none did anything (no X-ray, no Isolate, no
flight); as it was, all 9 did.

**`shoot.mjs`**, "the card and the finger", once, at the opening view: 171 taps across the plate, nine
columns over the body (x 0.34 to 0.66 of its width) and 19 rows, every 0.035 of its height from 0.03 to
0.45, where the card stands, then every 0.08 from 0.52 to 0.92. For every tap that selects a structure: the tapped
point lies 23 px or more outside the card, no click reaches the card (a capture listener on the document
records any), nothing changes but the selection (X-ray, the status plate, the camera past 0.1 mm, the
card shut), and wherever the top-left or the bottom-left place clears both the finger and the
structure's box, which the script projects itself from `geometry.json` through the hook's matrices, the
card covers none of that box. The same grid run by the probe: as it was, 78 cards, 9 under the finger
and all 9 clicks pressing a key; fixed, 80 cards and none. The final run: 171 taps, 80 of them on a
structure; every card 50 px or more clear of the tapped point, no click reached a card, nothing changed
but the selection, and 80 of the 80 cards with a place clear of both the finger and the box took one.

### Should (a): focus mode's card under the ghost key (fixed)

In focus mode the card sat level with the ghost key and as wide as the plate less 8 px, so at 375 px
wide it spanned x 58 to 338 against the ghost key's 323 to 367. As built, it ends 8 px before the ghost
key's hit area, and where that would leave it less than 180 px it sits 8 px under the key instead (at
320 px it still fits beside, 202 px wide). The probe in focus mode, 112 taps a size: as it was, at
375 x 812, 30 of 46 cards came within 8 px of the ghost key (the two overlapping by 15 px); fixed, 0 of
53 at 390 x 844, 0 of 53 at 375 x 812 and 0 of 41 at 320 x 568. `shoot.mjs` opens focus mode at the
three sizes and taps 15 points over the body: 11 cards at 390 x 844 (272 px wide, level with
the ghost key), 11 at 375 x 812 (257 px) and 9 at 320 x 568 (202 px), each 8 px or more from the ghost
key, clear of the finger, no click reaching it.

The probe's first focus runs flagged 2 and 5 taps as moving the camera. The largest change was
4.4e-16 m: OrbitControls rewrites the position through a spherical round trip every frame. The probe
compared positions as strings; `shoot.mjs` counts the camera as moved past 0.1 mm.

### Should (b): the structure found under X-ray read only by its outline (fixed)

**Cause.** X-ray draws every other part at 12 %, transparent, after the opaque pass; the selection,
opaque, was drawn first, so every see-through layer in front of it (the faded skin, both faces of the
muscle wall, the organs before it) blended over its color, and the found kidney showed as a red-gray
wash inside its ink outline. **Fix** (`applyLook()`): under X-ray a selected part goes into the
transparent list at render order 2, after the ghosted layers (1) and before the outline's hulls (10 and
11), still at alpha 1, writing depth and, outlined, the stencil, and still solid for picking and for the
blocker rays. three.js r186 sorts the transparent list by render order first, and the ghosted layers
write no depth, so the selection draws over them whole, in its own colors.

**Shown**: a probe finds the right kidney (X-ray turns on), photographs the plate, turns every layer but
the organs off through the Layers sheet's own words (no camera move) and photographs again; the
silhouette is measured from a copy of `anatomy.json` keying the kidney green, eroded 4 px. As it was,
the green kidney read as only 2 127 device px under the wash, and 1 910 of them changed when the layers
went off (median 44, p90 144, of 765); fixed, 29 462 px and none changed (mean difference 0.0).
`shoot.mjs` asserts the same in both themes: inside the silhouette, 32 842 device px (light) and
32 843 (dark), 0 changed; with the layers put back, 0 pixels differ from the found frame. `screenshots/kidney-{light,dark}.png`
show the kidney solid in its own color.

### Should (c): two nits (fixed)

- `app.js`'s About comment cited "ART.md section 8, B13", which moved to this file. It now says what is
  true after the data pass (the data's third paragraph is the app's own credit, which `index.html`
  writes under the first two, so it is not printed twice) and cites this file.
- `ART.md`'s budget table cited "plan 0011 D5", a private plan, for the ZIP cap's lack of a face
  allowance; the second citation the reviewer counted is `check.mjs`'s printed ZIP line. Both state the
  rule instead: an app that swaps its own faces for the house's gets no face allowance.

### Should (d): the Layers pictures (fixed)

`layers-light.png` came from the "once" block, after the kidney's flight had brought the camera close,
and `layers-dark.png` from the per-theme loop, the whole body; both were taken 300 ms after the sheet
opened, while SwiftShader's second-long frames held the tracer's 160 ms `clip-path` mid-draw. One block
per theme now takes both at the same scene, the whole body from the front with nothing selected, once
`document.getAnimations()` is empty and the plate has drawn, and asserts it: no animation running, the tracer's `clip-path` none,
nothing selected, in both themes. The row of words is first scrolled back to its start (tapping `Front`
had scrolled it), so the chosen depth word shows with its tracer. The once
block keeps its Layers hit-target check and takes no picture.

### Owner call 1: the data's text (taken)

**What the brief assumed and what the files say.** Of the 19 occurrences of 13 British words
`check.mjs` counted in `anatomy.json`, 10 (seven kinds) are written by `build_extras.py`; the other 9 by
`build_full.py` (the kidney's `180 litres`, `six metres`, `grey`, three `fibres` in type descriptions,
and the file's `_about`) and `build_anatomy.py` (`centre`, `recognised`). Reading every string of the
file, not only the counted list, found 14 more British forms: `faeces` twice, `humour`, `ploughshare`,
`specialise`, `oesophagus` in a description and `Oesophageal` in a vessel's name, `downwards` twice,
`outwards` twice, `inwards` twice and `backwards`; and `round` for `around` in five descriptions, two
of them from `build_vessels.py`. So the sweep covers the four scripts whose text reaches the file.

**The sweep**, prose only, each replacement counted (`build_anatomy.py` 5, `build_full.py` 13,
`build_vessels.py` 4, `build_extras.py` 17), comments and docstrings of the four files included:
`build_vessels.py` gains one `RENAME` entry, `oesophageal` to `esophageal`, so that vessel is now
`Esophageal branches of thoracic aorta` while its `source` keeps the dataset's spelling (Find still
finds it by `oesophageal`); `build_extras.py`'s docstring said eleven brain structures move, where the
run moves ten. Kept as they are: the Latin names (`Oesophagus` is the esophagus's `latin`), the `source`
names, and `geometry.json`'s `format` string (`metres, Y-up`), which `build_full.py` writes into a file
that must stay byte-identical and which never reaches the screen.

**The count.** The second source paragraph said the 4.0 structures were placed by a correction measured
from "591" shared structures; `tools/source/bodymap_pairs.json` holds 651, and `BodyMap` uses all of
them (its `report()` prints 651). `build_extras.py` now writes `len(BM.names)`, the measurement it
loaded, so the sentence cannot disagree with the file again.

**The third paragraph** named the two faces the house pass removed. It is replaced, not dropped, by the
credit About already writes, word for word (`Rendering: three.js r186, MIT License (its text is in
vendor/three-LICENSE.txt). Type: Ysabeau Office by …`). Replacing keeps the file's structure, so the
rebuilt file differs only in strings; About goes on printing its own two lines and the data's first two
paragraphs, and not this one a second time. `check.mjs` holds the two equal.

**The rebuild**, in a scratch copy of `tools/` (so the repository's `tools/source/` was never written),
with the 1.3 GB of BodyParts3D 3.0 STL and the 60 MB Human-Atlas package downloaded at their pinned
commits, Python 3.12.14 in a scratch venv with numpy 2.5.3 and fast-simplification 0.2.0, and Node
26.7.0 with meshoptimizer 1.2.0 from `npm ci`:
1. *Baseline, the scripts as committed*, steps 2 to 7 of `build_all.sh`: `geometry.bin` byte-identical;
   every soft-tissue `.bin`, `geometry.json` and the fresh `bodymap_pairs.json` different
   (fast-simplification decimated a few meshes differently: 3 448 956 triangles against the committed
   3 448 950); `anatomy.json` equal to the committed one in every field but the order of `groups`, the
   finer structures' eight groups after the vessel groups instead of before them.
2. That order is what a second `build_vessels.py` and `build_extras.py` make: the second vessels run
   appends the vessel groups again, after the finer structures' ones. Run once more on the baseline:
   `anatomy.json` byte-identical to the committed file (sha256 `01271c9f…c957a`). The committed file is
   `build_all.sh` followed by that second pair, and this machine reproduces it exactly although it does
   not reproduce the geometry.
3. *The swept scripts*, from the same snapshot after step 3, steps 4 to 7 and the second pair: every
   geometry file equal to the baseline's (`cmp`), and `anatomy.json` different from the committed file in
   34 strings and nothing else (a structural JSON diff: no value, key, key order, array length or type
   changed). Word by word the 34 strings change exactly the swept words, `591` to `651`, and the third
   paragraph.
4. Only that `anatomy.json` was copied into `data/`; the geometry in `data/` is the committed geometry.

**Verified** (`shasum -a 256 data/*`, before and after):
- `anatomy.json`: `01271c9f688c8f0caf3bb8ac995c0d041783053c30c13099ee6106470a7c957a` to
  `7f1106b79ffe0cea6df4707ce92e7c4584ee61cf3de7d0a90324c577f99c11a2` (496 365 to 496 457 B).
- Unchanged byte for byte: `geometry.bin`, `geometry.json`, `geometry-artery.bin`,
  `geometry-cartilage.bin`, `geometry-muscle.bin`, `geometry-nerve.bin`, `geometry-organ.bin`,
  `geometry-skin.bin`, `geometry-vein.bin`; `vendor/`'s five files; `screenshots/app.png`;
  `tools/source/*` and every pipeline file but the four swept scripts.
- `find data -type f | sort | xargs shasum -a 256 | shasum -a 256`: `de643cb0…8d9902` to
  `9b1358ab…66ce8c`.
- The data's characters beyond ASCII are unchanged (U+2013 50 times, U+2019 4, © 1): no supplement.

**`check.mjs`**: `anatomy.json` re-pinned. The British-word count is now a failing check over every
string of the file but the `latin` and `source` fields, its list widened by `humour`, `remodelled`, the
`-wards` adverbs, `specialise`, `faeces`, `plough` and `oesophag` (13 848 strings, 0 words). The second
paragraph's count must equal the measurement file's distinct structures (651); the third paragraph must
equal the two lines `index.html` writes; the removed faces must be gone from the data too. Run in a
scratch copy of the folder with the old `anatomy.json`, five checks fail: the pin, the faces, the third
paragraph, 591 against 651, and 33 British words.

`NOTES.md` said a clean rebuild reproduces every file in `data/` byte for byte; it now says what the
baseline showed, and that a change to text rebuilds `anatomy.json` alone. `ART.md`'s data hashes are
the new ones.

### The lockfile (consistent)

`npm ci` in `tools/` installs meshoptimizer 1.2.0 and three 0.186.0 from the hand-edited
`package-lock.json` and leaves it as it was (`cmp`). `npm install --package-lock-only --ignore-scripts`
in a clean scratch folder holding only `package.json` writes a lockfile byte-identical to it (sha256
`e6980dc4…019381`), so the hand edit is exactly what npm 11.19.0 writes. `update_vendor.sh`, run in a
scratch copy against these packages, reproduces `vendor/`'s five files byte for byte.
`tools/node_modules/` now exists; it is git-ignored.

### The tools after the follow-up (2026-10-02)

- `node tools/check.mjs`: 50 `ok`, `all checks pass`, exit 0. App code 116,467 bytes (budget 200,000):
  app.js 71,183, index.html 13,663, js/levels.js 5,064, js/units.js 2,282, styles.css 24,275. fonts/
  40,075 bytes. ZIP 24,552,764 bytes (budget 30,692,577), 26 files. The data's own text: 13 848 strings,
  0 British words.
- `node tools/test_decode.mjs`: 23 `ok`, `all checks pass`, exit 0.
- `python3 anatomy/tools/art/palette.py` (from `Template/`, run by `check.mjs`): `ALL CHECKS PASS`, exit 0.
- `SCREENSHOTS=1 PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: 94 `ok`, 0 `FAIL`, `all checks pass`, exit 0,
  in 16.6 minutes (log `tools/.work/shoot-followup.log`); `screenshots/app.png` untouched
  (`27f89f092307…`). It rewrote `screenshots/{open,explode,kidney,layers}-{light,dark}.png`,
  `peeled-explode-light`, `bone-light`, `find-light`, `focus-light` and `about-light`. Headless Chromium
  with SwiftShader: no number in it is phone evidence.

### For the lead

- No string the camera reads changed; no camera change is needed. The README's kidney picture
  (`kidney-light.png`) now shows the kidney solid in its own color, and the Layers pictures are one scene.
- Text on screen changed with the data: the kidney card reads `180 liters`, and one vessel is
  `Esophageal branches of thoracic aorta`.
- HOUSE.md's budget row for Anatomy: code 116 467 B, fonts 40 075 B, ZIP 24 552 764 B.

### Owner calls, as they stand after the follow-up

1. The data's text: **taken** (above).
2. to 8. As after the review: 2, 5, 6 and 7 open; 3 and 8 taken; 4 decided.

### Phone checks added by the follow-up (not claimed)

On the owner's iPhone (iOS 26.x) and the oldest supported phone (iOS 18.x): taps on structures from the
head to the feet, upright, on its side and in focus mode, never open the card under the finger and never
press a key on it (WebKit's click after a touch, which the guard answers, was seen in headless Chromium
only); focus mode on a phone 375 points wide, if one is at hand: the card beside the ghost key, and both
reachable with Snuggery's exit control; Find `right kidney`: the kidney solid in its own color under
X-ray, and the frame time with X-ray on.

---

## The stock app, as a stranger found it (moved from ART.md)

**What a stranger saw before the pass** (`PLAYWRIGHT_MODULE=… node tools/.work/look.mjs`, light and
dark at 390 x 844, DPR 2, touch, plus 844 x 390 and 320 x 640; pictures in `tools/.work/look/`): a
full-screen loader with a 34 px serif `Anatomy` and a cobalt progress bar, then, on every launch, the
body assembling itself from 85 % exploded over 1.5 s (`light-0-loaded.png`). Then a body standing on a
radial "plaster" gradient with the chrome floating over it: the word `Search` spilling out of a 36 px
circle at the top left, a 21 px serif title in the middle, an italic `i` in a circle at the right;
five native bevelled buttons (`Front`, `Side`, `Back`, `Top`, `Fit`) stacked down the right edge; a
frosted, shadowed dock with a cobalt-tinted `− Peel skin`, a disabled `+ Add`, `Layers`, an unstyled
19 px `Explode` button, a native slider with a cobalt fill and a shadowed thumb, and a `By part`
select (`light-1-open.png`). A tap gives a frosted card with a 19 px bold name, the Latin in an 18 px
serif italic, two chips, and four action words crammed into 36 px circles, `X-ray` broken over two
lines (`light-5-card.png`). At 45 % explode the head rises into the title (`dark-4-explode45.png`).
Two shipped faces, Atkinson Hyperlegible (with its slashed zero) and Newsreader. The selection paints the
structure cobalt, which on a vein is nearly nothing (section 2). Every control the run measured is
under 44 px in one dimension or both (B4).


## The art pass's budget ledger (moved from ART.md; estimates, superseded by the figures above)

**The code ledger** (estimates; the builder measures after every step, `check.mjs` prints the truth):

| Change | Bytes |
| --- | --: |
| Freed: the stock stylesheet (glass, pills, circles, the loader, the segmented control, the cobalt states) | −16 458 |
| Freed: the loader, the opening, the duplicate panel keys and their wiring | −2 000 |
| Added: the house stylesheet for this app (Global Weather's is 18 348 B; this one adds the dissection band, the Layers sheet, Find and the status plate) | +22 000 |
| Added: `index.html` restructured (the bands, the key column with its marks, the ghost key, the card, the three sheets, the live region) | +7 000 |
| Added: `js/units.js` (counts, percent, meters, megabytes, the spoken forms) | +3 000 |
| Added: `js/levels.js` (pure: the vertebrae from the data, the bands, the level of a height, the words, the height-to-column map) | +4 500 |
| Added in `app.js`: the Levels' drawing, the outline hulls, the depth words, focus mode, the zoom keys, the card in place and its placement, the framing for the plate, the notices, live Reduce Motion, the resting loop, the stamp's count, About rewritten, the test hook | +20 000 |

About **96 000 B** after the pass, 104 000 B under the cap; no trims are needed. Fonts 40 075 B. The
ZIP loses the stock faces (85 524 B zipped, `zip -q -X OUT fonts/*`), gains the face (37 834 B zipped,
HOUSE 2.2), this file (root `*.md` files ship: 79 032 B as the art pass wrote it, 30 621 B zipped alone
by `zip -q -X OUT ART.md`, and less once sections 8 and 9 move out) and the code's growth (about
12 000 B zipped): about 24.53 MB against the 30.69 MB cap, 6 MB of headroom.

## The art pass's note for the lead (moved from ART.md section 5)

**One change for the lead**, a comment only: `MarketingCameraCase.swift` lines 62 to 65 say the peel
key "reads "Peel skin" on screen"; after the pass it reads `Remove the skin`. The same file's
`waitForAnatomy()` comment says "27 MB" and "934 structures" (the data holds 1 752 structures and
32.0 MB of geometry); worth correcting in the same commit. No string the camera waits for or taps
changes.

---

## 8. The change list (the builder applies these in order)

Nothing in `data/`, `vendor/` or `screenshots/app.png` changes, and no file of the data pipeline
(`tools/build_*.py`, `tools/build_skeleton.mjs`, `tools/fetch_*.py`, `tools/atlaslib.py`,
`tools/paths.py`, `tools/source/`). The app's text that the pipeline generates is `anatomy.json`'s
`about` block and every part's name and description (written by `tools/build_extras.py`,
`build_full.py`, `build_anatomy.py` and `build_vessels.py`); this pass writes none of it, and prints it
verbatim, except the one paragraph B13 replaces. `tools/update_vendor.sh` and `tools/package.json` are
not the data pipeline; this pass removes their font lines (step 2). Before step 1, record the hashes of
section 6; `check.mjs` pins them.

**The bugs on record and found here, which this pass must fix.** Plan 0009 item 5 records none for
this app (its four are Norne's, World Oil & Gas's, Milky Way's and Global Weather's); `docs/review/`
records none (`grep -rn -i anatomy docs/review/` finds nothing); the device matrix's row 150 lists
Anatomy's phone checks, not bugs; the app has no `DECISIONS.md`, and `NOTES.md` records none open.
Reading the app as a stranger found these. Each is a must, and each names its evidence:

- **B1. The Explode key is an unstyled native button, 19 px tall.** `styles.css` lines 114 and 115
  read `body.has-panel` and then `.primary {`, so the rule applies only while the Layers panel is open
  (`look.mjs`: `btn-explode` 80 x 19). Step 8 (the stylesheet is rewritten).
- **B2. Text buttons are forced into 36 px circles.** `styles.css` line 78 gives `.pill`, `.round`,
  `.views button` and `.actions button` a 36 x 36 box with a 50 % radius: `Search` and `Done` spill out
  of their circles, and the card's `Focus`, `Isolate`, `X-ray` and `Hide` spill out of theirs, `X-ray`
  over two lines (`light-5-card.png`, `light-9-about.png`). Steps 7 and 8.
- **B3. No button reset**: the views, `Search`, `i` and `Done` draw the browser's own bevelled frame.
  Step 8.
- **B4. Controls under 44 x 44** (`look.mjs` at 390 x 844): `Search`, `About this model` and every
  `Close` 36 x 36 or 33 x 36; the five views 56 x 32; the card's four actions 36 x 36 and its chips
  21 px tall; the step keys, `Layers`, the slider and the select 38 px tall; `Explode` 19; the Layers
  panel's 27 mode buttons 30 px tall; `Turn every layer on` 28. Steps 7 to 14; `shoot.mjs` counts in
  both modes.
- **B5. The chrome floats over the model**: the title, the circles and the views are laid over the
  canvas, and at 45 % explode the head runs into the title (`dark-4-explode45.png`); the dock covers the
  plate's foot. Step 7 (the bands).
- **B6. Names that do not contain their visible words** (WCAG 2.5.3): `Peel skin` is named `Remove
  the skin and hair layer`, `Add skin` `Bring back the skin and hair layer`, `Add` `Every layer is
  showing`; and every visibility checkbox in the list is named `Visible`. Steps 11 and 13.
- **B7. A selected vein is barely marked**: the data's tint moves `#3e62b6` by dE 0.070 and
  `#4a6fbe` by 0.066 in the light theme, and cartilage by 0.067 and `#8fb7d6` by 0.063 in the dark;
  232 and 158 parts move by less than 0.10 (`palette.py`). Step 10 (the outline).
- **B8. `miniapp.json`'s description is 209 characters**, over the 200 Snuggery's manifest allows
  (HOUSE 7.1 item 7), and groups `1,750` with a comma. Step 3.
- **B9. Numbers and words outside the house's rules**: About's `3,448,950` (`toLocaleString('en-GB')`,
  `app.js` line 775) in a slashed-zero face; `colours` (`app.js` line 794); `Loading 32 MB` written by
  `toFixed` outside a units module. Steps 4 and 12.
- **B10. An opening that is not data**: the assembly from 85 % exploded on every launch
  (`app.js` lines 830 to 837), under the loader's overlay. Step 12.
- **B11. Reduce Motion is read once** (`app.js` line 25, a `const`): a change while the app is open is
  ignored. Step 12.
- **B12. The render loop never rests**: `loop()` asks for a frame every display frame and runs
  `controls.update()` even when nothing moves (`app.js` line 125). Step 12, and a phone check for idle
  power.
- **B13. About would credit faces the app no longer ships**: the data's third source paragraph reads
  `Rendering: three.js (MIT licence). Type: Atkinson Hyperlegible and Newsreader (SIL Open Font
  Licence).` (`about.sources[2]`, written by `tools/build_extras.py` line 221). The app writes its own
  rendering and type credit and does not print that paragraph; `check.mjs` asserts the paragraph it
  replaces still begins `Rendering:`, so a changed data file is noticed (step 12). The data itself is
  owner call 1.
- **B14. A count in the data's About disagrees with its own measurement**: the second source paragraph
  says the 4.0 structures were placed "by a correction measured from the 591 structures both releases
  share"; `tools/source/bodymap_pairs.json` holds 651 distinct structures, as `NOTES.md` says
  (`python3 -c` over the file). Data text, not fixed by this pass: owner call 1.
- **B15. US English in shipped files**: `CREDITS.txt` (`licences`, `millimetres`, `metres`,
  `quantised`), `NOTES.md` (`organised`, `metres`, `quantised`, `licences`, `modelled`, `colour`,
  `centres`, `centred`, `behaviour`) and `app.js` (`colours`). Steps 4, 12 and 15. The data's own
  text holds more (`fibres`, `colour`, `modelled`, `metres`, `millimetres`, `recognised`, `grey`,
  `centre`, `licence`; `oesophagus` is the Latin term and stays): owner call 1.
- **B16. The viewport blocks zoom** (`maximum-scale=1`, `index.html` line 5) and the page declares
  `lang="en"`. Step 7.
- **B17. `Side` shows a different view on alternate presses** (`sideFlip`, `app.js` lines 421 to
  425), so one word means two things. Step 7 (`Left` and `Right`).
- **B18. The landscape layout leaves the body small and the dock over the plate**
  (`light-844x390.png`). Steps 7 and 8.
- **B19. VoiceOver re-reads the whole card on every change**: `#card` carries `aria-live="polite"`
  (`index.html` line 32), and toggling X-ray re-renders it. Steps 7 and 11.

**The steps:**

1. **`.gitignore`**: already ignores `tools/.work/`, `tools/node_modules/` and `dist/` (checked by this
   art pass); nothing to do.
2. **`fonts/`**: delete the four stock woff2 files and the stock `OFL.txt`; copy
   `../global-weather/fonts/ysabeau-office-gw.woff2` and `../global-weather/fonts/OFL.txt` byte for
   byte (`cmp` both). No supplement. In `tools/package.json` remove the two `@fontsource` dependencies
   (and update `tools/package-lock.json` by `npm install --package-lock-only` in `tools/`, or by hand
   if offline); in `tools/update_vendor.sh` remove the font copy lines and the word "fonts" from its
   comment and echo, so a rerun touches `vendor/` only.
3. **`miniapp.json`**: name, entry point and schema unchanged; the description rewritten to at most
   200 characters in US English with U+202F grouping, for example `A human body in 3D: 1 752 real
   anatomical structures in nine layers to peel, fade, isolate and pull apart, each placed against
   the model's own spine.` (the builder counts it; `check.mjs` checks it); the version to `4.0`.
4. **`js/units.js`** (new), the one writer of numbers: `group()` (U+202F from four digits; never on
   labels, FDI numbers or versions), `pct()` (`45 %`), `meters()` (`1.66 m`), `megabytes()` (a million bytes,
   whole: `32 MB`), the counts with their nouns (`1 structure`, `12 structures`), and the spoken forms
   (`45 percent`, `1.66 meters`). `toFixed` and `toLocaleString` appear nowhere else but the allow-list
   `check.mjs` names.
5. **`js/levels.js`** (new, pure, no DOM, no WebGL): `vertebrae(anatomy, geometry)` (the labeled parts
   of the six spine types, sorted, with box centers, tops and bottoms), `bands(v)`, `levelOf(y)`,
   `spanWords(lo, hi)`, `toColumn(y, centers)` (the piecewise-linear map from a height to the
   vertebrae's centers, with its open ends), and the caption's four sentences as functions of their
   inputs. `app.js` imports it; `tools/test_decode.mjs` tests it.
6. **`styles.css` tokens**: the house tokens of HOUSE 3.1 exactly, in `:root` and the dark block; the
   four custom properties of section 2 pasted from `python3 anatomy/tools/art/palette.py --json`;
   `--draw`, `--sheet-in`, `--face`; `color-scheme`.
7. **`index.html`**: `lang="en-US"`; the viewport `width=device-width, initial-scale=1,
   viewport-fit=cover`; `<meta name="color-scheme" content="light dark">`; two `theme-color` metas
   carrying each theme's `--page`; `<title>Anatomy</title>`. The column: the header (`h1`, the
   `Layers` and `Find` word keys, the stamp button, the row of words with the depth radiogroup the app
   fills from the data and the five view buttons); the plate (the WebGL canvas with its description
   in US English naming the gestures, the Levels canvas `aria-hidden`, the key column with its four
   drawn marks, the card, the status plate, the notice, the ghost key); the caption band (the caption
   line, the credit line); the dissection band (the two step keys, `Explode`, the native range input
   `id="explode"` named `Explode amount`, the explode radiogroup); the Layers sheet; Find; About; one
   live region. No string the camera waits for appears in the markup. The stock `#stage`, `.bar`,
   `.views`, `#status` pill, `.dock`, `.panel`, the two `.sheet`s and `#loader` go. No `innerHTML`
   anywhere (the app holds Global Weather's rule today and keeps it: HOUSE 7.1 item 13).
8. **`styles.css`**, rewritten on Global Weather's `style.css`: the frame (HOUSE 4.1), the header,
   the row of words with the tracer, the key column and its states, the ghost key with section 2's
   dark halo, the card, the status plate, the notice, the caption band with its fixed heights, the
   dissection band and the explode track's CSS (HOUSE 4.6's slider language), the Layers sheet, Find,
   About, `.sr`, `@media (hover: hover)`, landscape (HOUSE 4.13), wide screens, and
   `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0s;
   animation-duration: 0s; } }`. `touch-action: manipulation` and `-webkit-tap-highlight-color:
   transparent` on every control; a button reset. Nothing from the stock stylesheet survives but
   what these name.
9. **`app.js`, the plate**: the renderer sized from the plate's box (a `ResizeObserver` on the plate);
   the clear color stays transparent over `--plate`; `frame()` and `uiInsets()` rewritten for the
   plate (section 3, "The camera's framing"); the zoom keys and `Show the whole body`; the five view
   words with `Left` and `Right` (B17); camera moves on `--draw`'s curve, ended at their destination by
   any touch.
10. **`app.js`, the selection's outline** (B7): for a selection of at most 60 parts, two back-face hull
    meshes per part sharing its geometry (a small `ShaderMaterial` that pushes each vertex along its
    normal by a constant number of screen pixels, 1.5 then 3, from the projected depth), the inner in
    `--ink`, the outer in `--select-halo`, drawn with the part, removed on deselection; rebuilt on a
    theme change. The data's tint stays as `applyLook()` applies it.
11. **`app.js`, the controls**: the depth words (section 3) beside `peel()` and `addBack()`, which keep
    their logic; the step keys' visible words and names (B6), the disabled forms `Only bone and teeth
    are left` and `Every layer is showing`; the explode words in place of the `select`, the native
    track's `--fill` and `aria-valuetext`; the Layers sheet rebuilt as section 3 says (no duplicate step
    keys); Find rebuilt with named toggles (B6) and DOM nodes only; the card rebuilt as section 3 says,
    its text updated in place, `aria-live` gone, its placement (top-left beside the Levels, bottom-left
    when it would cover the selection), `Zoom to it`, the tap's sentence in the live region; the status
    plate; the Escape order: an open sheet or dialog, then focus mode, then the selection.
12. **`app.js`, the rest**: the Levels (section 1) drawn on its canvas after each render that moved
    something, waiting for the face; the caption line's sentences from `js/levels.js`; the credit
    constant `CREDIT`; the stamp's edition, count and loading count (`js/units.js`); About rewritten
    (section 3), printing `about.sources[0]` and `[1]` and the `gaps` verbatim and its own rendering and
    type paragraph in place of `sources[2]` (B13), `colors` (B15); the notices in the file's terms;
    focus mode (section 3) with `skeleton-viewer:focus`; no opening (B10); Reduce Motion read live
    (B11); the loop that rests (B12); hidden stops the loop and lands tweens; `en-GB` gone (B9). Every
    `localStorage` key keeps the `skeleton-viewer:` prefix, and every key read today (`explode`,
    `level`, `layerModes`, `layerPrev`, `hidden`, `isolate`, `ghost`, `camera`, `defaultsApplied`) is
    still read. The test hook `window.__anatomy`, inert, exposes the camera's matrices, the drawn
    blocks' screen positions, the selection bar's ends, the Levels' redraw counter, the loop's frame
    counter, the render counter, the card's rows and the focus state; nothing in the app calls it.
13. **Accessible names**: every control 44 x 44 or more in normal and focus mode; every toggle with
    `aria-pressed` or a radio with `aria-checked`; every name contains its visible words (B6).
14. **The sheets and the card on a short plate** (a phone on its side): the compact card; the Layers
    sheet keeps the plate at 220 px or more.
15. **`CREDITS.txt`**: US spelling (B15); the fonts paragraph replaced by the house's credit line, word
    for word; the BodyParts3D attribution and the three.js line unchanged in substance; the clinical
    sentence kept. Its two license addresses keep their scheme (a text file, not a script), or lose it
    as the owner prefers.
16. **`NOTES.md`**: US spelling (B15); the folder map (`styles.css`, `js/units.js`, `js/levels.js`,
    `fonts/` with the house face, `ART.md`); the sections table (`levels`, `focus mode`, no opening);
    the persisted keys (`focus` added); the fonts paragraph and the license list with the house's credit
    line; the em dashes in prose replaced; a line that the data's About text still has British spelling,
    the 591, and the type paragraph the app replaces, until owner call 1 is decided.
17. **`tools/art/palette.py`**: written by this art pass; it stays and must end `ALL CHECKS PASS`.
18. **`tools/check.mjs`** (new, on Global Weather's and Norne's pattern, HOUSE 7.1): the ZIP's limits;
    no `http` scheme in shipped `.html`, `.css` or `.js` outside `vendor/`; relative references; the
    folder contract (`fonts/` holds exactly the two house files; `data/` exactly its ten files); the
    face's and `OFL.txt`'s sha256; the data's ten sha256 values and `vendor/`'s five; `miniapp.json`
    (name `Anatomy`, description at most 200 characters, version); the vendor-name list as ROT13, copied
    from Global Weather's `check.mjs` line 128; the credit constant, word for word, and the type credit
    in About, `NOTES.md` and `CREDITS.txt`; `about.sources[2]` still beginning `Rendering:` (B13); the
    camera's strings with their roles (`Explode amount` on a range input, `Remove the` and `Bring back
    the` built in `syncLayerUI()`, `Every layer is showing` not in `index.html`, `Show the controls`,
    `Hide the controls`); the `localStorage` keys; SI (no plain space between a digit and a unit in a
    string the app writes; `toFixed` and `toLocaleString` only in `js/units.js`); no `innerHTML`,
    `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval` or `new Function`; the palette (the
    four custom properties equal `--json`, and the script ends `ALL CHECKS PASS`); the tells (no
    `box-shadow`, `backdrop-filter`, `transition: all`, `text-transform: uppercase`, nonzero
    `letter-spacing`, `accent-color`; no middle dot in any string the app writes; no →, ➤ or `...`; both
    `theme-color` metas; the `@font-face` rule exactly; the chrome tokens exactly in both themes; one
    `font-family`, through `--face`; every script font string names `"Ysabeau Office"` first); the
    budgets of section 6 with every size printed; US spelling in every shipped file outside `data/`,
    with the data's British words counted and printed, not failed (owner call 1).
19. **`tools/test_decode.mjs`** (new, no dependencies): decodes every vertebra's and twenty named
    structures' positions from the `.bin` files with its own code (16-bit positions in each part's box,
    `geometry.json`'s offsets and counts) and checks that each part's decoded extent equals its box
    within one quantization step; computes the bands, the levels and the span words with its own
    formulas and compares them with `js/levels.js`'s, for every part (1 752 spans); and prints the
    table of section 1 (the kidneys, the celiac trunk, the renal arteries, the abdominal aorta, the
    hyoid, the cricoid, the trachea, the pancreas, the xiphoid, the scapula), which must read as
    section 1 says.
20. **`tools/shoot.mjs`** (new, HOUSE 7.2), both themes at 390 x 844, DPR 2, real touch: boot (the
    camera's strings by role and name; `Every layer is showing` only once the model is in; the credit;
    the face before the Levels' first draw); text contrast and the tracer under exactly the chosen
    words; **the Levels**: in the front view and at the first-run view, every drawn block's screen
    height within 1 px of the script's own projection of the data's box centers through the hook's
    matrices; the column hidden in the top view and when zoomed out under 120 px, with the caption's
    words; after `Find`ing the right kidney, the card's `Levels` row `T12 to L3`, the bar's ends against
    the script's own map, the caption's sentence; the same for ten structures of section 1; with the
    explode at 0.45 by part, the blocks following the drawn vertebrae; the signature sampler (90 % of
    sampled column pixels at 3:1 or more against their halo, the lowest printed); **the selection**:
    a vein chosen from Find shows its outline (ink pixels around its silhouette, both themes) and the
    pixels under it differ from the unselected frame; the card clear of the selection's projected
    center and of the Levels; **the camera's put-back**: remove the skin, tap the track at 0.45 (value
    42 to 46) and at 0.01 (value 0), bring the skin back, `Every layer is showing` again, the frame
    equal to the opening frame; the depth words (a tap on `Bone` leaves bone and teeth; a tap on `Skin`
    brings everything back in its mode); SI in every visible text node; the plate holding still while
    the caption's words change; focus mode end to end with the camera's way out; hidden; the loop
    resting (no frame callbacks over one idle second once damping ends); hit targets in both modes;
    About (opens from the stamp, carries the credits and the type line, never the data's `Rendering:`
    paragraph, closes on Escape); Reduce Motion live (switched while open: the explode key's move a
    cut); broken data (`geometry.json` missing, `anatomy.json` not JSON, a short `.bin`, opened as a
    file; each its sentence); widths 320, 360, 375, 844 x 390 (the plate at least 220 px) and 125 %
    zoom; pictures to `tools/.work/shots/`, never `screenshots/app.png`, whose hash the run checks
    unchanged. Load and frame times printed as headless Chromium figures, a trend only.
21. **Last: `tools/DECISIONS.md`** (new): sections 8 and 9 of this file moved there word for word
    (the build's departures, QA's and the review's notes go there too), and this file trimmed to
    sections 1 to 7 as built. The British words and the arrows this file quotes as evidence live only
    in sections 8 and 9, so the trimmed file passes `check.mjs`'s spelling and tell scans.

---

## 9. Owner calls left open

1. **The data's About text and spelling** (B13, B14, B15). The art pass leaves `anatomy.json` byte
   for byte and works around its stale type credit. A follow-up can fix the source of the text, as
   Milky Way's and Besseggen's passes did: `tools/build_extras.py` line 221 (the rendering and type
   paragraph, then printed as the data says), line 220 (`591` to `651`, or whatever the measurement
   says when rerun), and a US-English sweep of the prose in `build_extras.py`, `build_full.py`,
   `build_anatomy.py` and `build_vessels.py` (`fibres`, `colour`, `modelled`, `metres`, `millimetres`,
   `recognised`, `grey`, `centre`, `licence`; Latin terms such as `oesophagus` stay). That needs the
   pipeline rerun (about 1.6 GB of source once) or a text-only patch of `anatomy.json`'s strings, with
   the geometry files proven byte-identical either way. Recommended: yes, as a follow-up, text only.
2. **The light theme's plate.** Kept: the film base, the body's bone reading by its shading
   (section 2). Offered instead: the slate `#141d21` under the body in both themes (the chrome still
   follows the theme, as Earth's History keeps its night), which separates bone and teeth best; or a
   mid-gray plate at L 0.75 (no part within dE 0.06 of it). `tools/.work/look/grounds-compare.png`
   shows the three.
3. **The selection's tint.** Kept: the data's cobalt, with the house's ink outline added. Offered: the
   outline alone (no tint), which is the house's selection mark everywhere else and puts no accent hue
   on the body; `colors.selected` would then go unused, and About would say so.
4. **What stays in focus mode.** Planned: the plate, the Levels, the stamp, the caption, the credits,
   the status plate and the whole dissection band. Offered: only the explode track (the house's "one
   control"), the step keys leaving with the header.
5. **The view words.** Planned: `Front`, `Back`, `Left`, `Right`, `Top` in the row, after the depth
   words. Offered: the anatomical terms (`Anterior`, `Posterior`, `Left lateral`, `Right lateral`,
   `Superior`), which are what an atlas says but longer.
6. **Single-pointer pan and keyboard orbit** (plan 0011 D13's open accessibility call for every 3D
   app). The zoom keys give one-finger zoom and the view words give tap alternatives to turning; panning
   still needs two fingers, and the canvas takes no keys. Offered: the arrow keys orbit and Shift with
   the arrows pans when the canvas has focus.
7. **`CREDITS.txt`'s two addresses** keep their `https://` (a text file, not a script; HOUSE's rule is
   for scripts and About). Offered: printed without the scheme, as About prints addresses.

**Phone checks** (not claimed; for the device matrix, each on the newest phone and the oldest
supported, iOS 26.x and 18.x): frame time while idle, turning, exploding and with a 60-part outline;
memory after five minutes with the outline on and off; the loop at rest (power while idle); the Levels'
labels and halo on the phone's display in both themes; the search field not zooming the page on
focus; focus mode in Snuggery's full screen, with the ghost key and Snuggery's own exit control both
reachable; VoiceOver on the depth words, the step keys, the card and a tap; the phone on its side;
background and return (the loop stops, `anatomy.json` re-read).
