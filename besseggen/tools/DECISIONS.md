# Besseggen: decisions, as built, and the record of the house pass

Not shipped (`tools/` is left out of the ZIP). `ART.md` is the direction; this file holds what the
build settled, what it could not, and the owner calls still open. Plan 0011 package B, D1 to D5.

## The owner calls (ART.md section 9), as the build left them

| # | Call | As built |
| --- | --- | --- |
| 1 | **The code cap** | **Ruled: 227 000 B** (plan 0011 D11, the lead's ruling below), set in `tools/check.mjs`'s `CODE_CAP`. Held at 215 934 B (D5 (2)) until the build measured **226 148 B** after ART.md's five trims (the app's own stylesheet, About from a table, the walk slider dropped, the unused hooks dropped, the `now` notch dropped), the stock camera tween removed as dead code (`frameBox` always passed `animate = false`), and this pass's own long comments shortened. Nothing was minified and no stock comment stripped (HOUSE.md section 8). After QA's fix the code measures **226 205 B**, 795 under the cap; after the review **226 656 B** (344 to spare), and after the follow-up **226 787 B** (213 to spare). If the owner prefers cuts: Play (about 1 200 B), the legend rows (about 2 000 B with their markup and CSS), saving and clearing your own viewpoints (about 900 B), the line-of-sight cross-section (about 900 B), Free orbit (about 400 B). |
| 2 | The plate keeps its daylight in both themes | Built. The dark block of `colors.json` is read only for the profile's steep red. |
| 3 | The signature is the Burn | Built as ART.md section 1 draws it. |
| 4 | `First and last sun` folds into the marker | Built: the tool, its chip and its panel are gone; the card's sun rows and the Burn carry it. |
| 5 | The debug readout leaves | Built; `besseggen:debug` retired. |
| 6 | The gesture card and the `?` key go | Built; `besseggen:focusHintSeen` retired. The gestures are in the canvas's description and About. |
| 7 | Focus mode is remembered | Built (`besseggen:focus`). |
| 8 | The on-screen credit line | `Terrain, trail, lakes and names: Kartverket, CC BY 4.0`, as proposed. The trail data's own terms are "no conditions"; CC BY 4.0 is the strictest of the four and every source in full is in About. |
| 9 | A units key (feet and miles) | Not built. |
| 10 | The data-owned colors | **Settled by the follow-up** (below): the 40° slope class `#8e1f4f` (the dark block's `#b64770`), the middle bands `#908862` and `#b3a99a`, every pair over the 0.10 target and checked by `palette.py`. Through the pass the 40° class and the trail shared `#c0392b` and the middle pair was dE 0.063. |
| 11 | British spellings and em dashes in About from `data/about.json` | **Settled by the follow-up** (below): `tools/06_editable.py`'s prose swept and the pipeline rebuilt; `about.json` holds none, and `check.mjs` fails if one returns. Through the pass it printed the count (5 British spellings, 5 em dashes). |
| 12 | The instrument line stays in focus mode | Built. |
| 13 | The walk slider goes | Built (trim 3): the profile's drag walks the first-person camera. |
| 14 | Day keys step a day, Play plays the day at an hour a second | Built. |
| 15 | The trail on a pale casing | Built, in the line shader (below). |

## As built, where the build departed from ART.md or settled what it left open

- **The casing is drawn in the line's own shader**, not by a second mesh: the line is drawn wider by
  the casing on each side and the outer part of its width takes the casing's color and alpha (a
  varying across the width). Same pixels, no second geometry to keep in step when the marker moves.
- **The Burn's eye stands 0.5 m above the higher of the 2 m point and the 16 m surface** the march
  runs over. The stock tool started from the 2 m height; at a col the 16 m grid stands above it and
  shaded the point (Bandet on 20 September: first sun 08:26 against 08:16 from an independent march;
  `node tools/test_decode.mjs` now agrees within 3 minutes at Veslfjellet and Bandet on three dates).
  ART.md's figures were the stock computation's (Gjendesheim 06:43 to 20:22 on 14 June) until QA;
  since QA and the review they are the app's own (06:42 to 20:22, 13 h 40 min).
- **About holds play still and play goes on when it closes** (HOUSE.md section 4.6); ART.md said
  About stops play. Layers does the same.
- **The double-tap is timed by the pointer events' own timestamps**, not the handler's clock, so a
  slow frame cannot stretch it past its 300 ms window.
- **The steep red's key** is on screen as "Red: 25 % or steeper." in the totals line, and in full
  (over 100 m, and the walk's gradient over 150 m) in About; there was no room for the window in the
  stop-0 row.
- **The `now` notch** is not drawn (trim 5): any day can be shown, and the present is not data here.
- **Notices** sit at the plate's foot (since the review) with `pointer-events: none`, so a broken
  `pace.json` does not stop the view from turning. A failure to start hides the keys, the sheet and
  the player.
- **The labels' and the card's text is built with `innerHTML`** in 6 places, down from 11; every
  value goes through `escapeHtml` or `row()`, which escapes.
- **Landscape**: the caption is two lines (the Burn's sentence does not fit one at 844 × 390 beside
  the sheet column); the plate measures 227 px, and 255 px in focus mode since the review. After QA
  the credit line there wraps to two lines
  (150 px wide, 12 px leading) beside the instrument line, so the scale's words are whole at
  844 x 390 and the row stays 24 px; at 667 x 375 they still end in an ellipsis (no room in the row).

## The camera (MarketingCameraCase.swift, MarketingShotsUITests.swift, MarketingClipsUITests.swift)

Every string kept, with its role: `CEST`/`CET` (now in the player's time row, written only once the
terrain is in), the grip's three names, `From the boat on Gjende`, `Fit the route` (now a key in the
key column, still one button so named), `Fly the route`, `Stop`, the double-tap at (0.5, 0.42).
`waitForBesseggen()` already ends with `showControlsIfHidden()` (MarketingCameraCase.swift 418-423 on
2026-10-01), so the remembered focus mode needs no camera change. The comment in
MarketingShotsUITests.swift (649-662) that said the app "has no home control" was the lead's to
correct after the pass, and now names `Fit the route`.

## Tools

`node tools/check.mjs`, `node tools/test_decode.mjs`, `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`,
`python3 besseggen/tools/art/palette.py` (from `Template/`). The data: `./tools/build_all.sh`, with
`OUT_DATA` pointed at a scratch folder until the result is verified; the two N50 zips are ordered
from the Geonorge download API by hand (`02_fetch_vectors.py` stops and says so when they are
missing). `tools/decode.mjs` is the independent
decode, sun and ray march the two tests share. Headless Chromium is never phone evidence.

## Phone checks for the device matrix (none claimed)

Frame time idle, scrubbing the hour (a new hour sweeps the cast shadows once: about 11 ms headless),
playing the day, flying the route and dragging the walk (each drag step computes the Burn in the
pointer handler); memory after five minutes; background and
return; focus mode in Snuggery's full screen with the ghost key and Snuggery's own exit control both
reachable in the top-right corner (iOS 18 and iOS 26); the labels' halo (`paint-order` on HTML text
in WebKit); the casing at the phone's DPR; VoiceOver on the track (the hour, the sun, the marker's
state; the Burn's description), on a tap, on the grip and in About and Layers (focus moves to their
Close on every open: whether VoiceOver's cursor follows); the double-tap on a
busy phone; the phone on its side with the sheet column; the safe areas of every band; the camera's
`CEST` wait and clip 1 end to end on the simulator, then the stills.

## The lead's ruling on the code cap (2026-10-01)

HOUSE.md §8 item 3 held Besseggen's app code at 215 934 B, its size when the pass started, until the
lead set another cap and recorded why. The build measures 226 148 B after all five of ART's trims,
the dead code removed and this pass's comments shortened, with nothing minified and no stock comment
stripped. **The cap is 227 000 B**, recorded here by the lead (plan 0011 D11): the house modules
(track.js, units.js, plate.js, focus.js, the player and the dialogs) are what the owner asked every
app to carry, and HOUSE.md §8 item 4 forbids stripping comments or minifying to fit; cutting Play,
the legend rows, the owner's own viewpoints, the line-of-sight cross-section or the free orbit would
remove function to meet a number set before the system existed. Set `CODE_CAP` in `tools/check.mjs`
to 227 000 and record the figure in ART.md's budget section. If the owner prefers features cut, the
five candidates above are the ones to take, in that order.

## After QA (2026-10-01)

QA's verdict was "fix": one must, three shoulds, two nits.

- **Must, the code cap**: `CODE_CAP` set to the lead's 227 000 B (plan 0011 D11); ART.md's budget
  table and call 1, NOTES.md's figures and this file's call 1 say so. 226 205 B after the fix below.
- **Should, the landscape scale words**: fixed (`styles.css`: the credits wrap to two lines beside
  the instrument line on a phone on its side; the instrument line's gaps 8 to 6 px). `shoot.mjs`
  gains a check that the words are whole at every width it opens.
- **Should, ART.md's stale numbers**: corrected from the running app; ART.md's "After QA" lists each.
- **Should, the camera test's comment** (`Tests/SnuggeryUITests/MarketingShotsUITests.swift`, the
  Besseggen still's comment that the app "has no home control"): outside this folder, so left for
  the lead to correct in the same commit. `Fit the route` is that control now; no camera string
  changed.
- **Nits, about.json's spellings and the data-owned colors**: owner calls 11 and 10, unchanged; the
  data is byte-identical.

## After review (2026-10-01)

The final review's verdict was "fix": three musts, seven shoulds and six nits. All three musts and
all seven shoulds are applied; ART.md's "After review" lists each with its file and the
`shoot.mjs` check that now pins it. Taken: four nits (aria-valuemax, notice at the foot, the copy
kept on a broken re-read, the Layers mark), plus a fifth found on the way (a 2 px gap under each
slider row's note). Declined: the per-frame layout reads and the profile drag's Burn (bytes; a
phone check above), and the credit line (owner call 8). No camera string changed.

## After the follow-up (2026-10-01)

One builder after the final review, on the lead's brief: the reviewer's two shoulds, owner calls 10
and 11 through the pipeline, and the documents' leftovers. `ART.md`'s "After the follow-up" has the
detail; this is the record.

- **The reviewer's shoulds, taken.** `js/profile.js`: a meter label that would cross the profile's
  top edge comes down inside it (`1 900 m` was cut in half at every width). `app.js`: the
  exaggeration's readout says `True scale` at ×1.0. Not `×1.0, true scale`, as suggested: that
  string widened the 64 px output to 78 px, so the slider's track would jump 14 px under the finger
  as the value left 1.0 (measured headless at 844 x 390). `tools/shoot.mjs` checks both at every width
  it opens (the readout on a phone on its side).
- **Owner call 10, settled**: the 40° class `#8e1f4f`, a crimson rather than the trail's `#c0392b`
  (a red, as the brief asked. Measured the same way, a plum `#8e2a7a` or a purple `#7b2d8e` would sit
  further from the trail once lit, 0.088 and 0.126 against the crimson's 0.062 on a sunlit face: the
  owner's choice if the crimson reads too close on the phone); the middle bands `#908862` and
  `#b3a99a`, the old hues and chroma at new lightness. The dark block's 40° class moved with the
  light one (`#b64770`), though the plate never draws it, so neither block gives the class its
  trail's red.
  `tools/art/palette.py` checks the pairs now and draws the 40° class over the 30° one, as the
  shader does.
- **Owner call 11, settled**: `tools/06_editable.py`'s docstring, comments and the strings that become
  `about.json` and `colors.json` are US English with no em dash; `check.mjs` fails on a British
  spelling or an em dash in `about.json`'s values.
- **The data**: rebuilt twice through `tools/build_all.sh` into a scratch folder. With the scripts
  unchanged, from a cold cache (367.4 MB in 40 files, plus the two N50 zips, 36.7 MB, ordered from
  the Geonorge download API by hand; 160 s), it reproduced 16 of the 17 files; `places.geojson`
  gained Besstrond (stedsnummer 435855), a name the register added after 22 September, and the
  shipped file was kept. With the swept script on the same cache (8 s), only `about.json` and
  `colors.json` changed, in words and named colors; `verify_data.py` passed. Those two were copied
  into `data/`; `check.mjs` and `NOTES.md` carry their sha256 and the digest `97d6b944…2cd3`.
- **The app's own copy**: `js/data.js`'s built-in `colors.json` (used when the file cannot be read)
  and `js/material.js`'s defaults carry the new colors, at the same length (0 bytes).
- **Open, for the lead**: the strings in `tools/06_editable.py` that become `waypoints.json`'s note (a
  British spelling of meters, `towards`, two em dashes) and `viewpoints.json`'s note (one em dash).
  The app shows neither; sweeping them changes two data files the brief kept fixed. It is an 8 s
  warm rebuild, then two more sha256 in `check.mjs` and `NOTES.md`. `manifest.json`, which
  `04_terrain.py` writes and the brief kept byte-identical as a terrain file, also carries the
  British meter family (its `units` value and its quantization block, key included); the app reads
  neither, so only someone opening the file sees them.
- **Phone checks** (none claimed): the crimson against the trail's red on a sunlit 40° face, and the
  middle bands at 1 400 m in low sun, on the phone's screen; `1 900 m` and `True scale` in VoiceOver.

---

## Moved from `ART.md` on 2026-10-02: its sections 8 and 9 and its after-QA, after-review and after-follow-up summaries, word for word

`ART.md` ships inside the ZIP, and the house rule (`Template/HOUSE.md`, "What ships and what does not")
keeps build history out of a shipped file, so the lead moved these here unchanged on 2026-10-02, as
Anatomy's pass did for its own. Inside the moved text, *this file*, *§N* and *section N* mean `ART.md`
as it stood on 2026-10-01, and a pointer to `tools/DECISIONS.md` section N means this file's own
section N above.

## 8. The change list (the builder applies these in order)

Nothing in `data/`, `vendor/`, the pipeline (`tools/01_…` to `06_…`, `geom.py`, `paths.py`,
`build_all.sh`, `verify_data.py`, `package_snuggery.py`) or `screenshots/app.png` changes. This
pass writes none of the pipeline's content files: `data/about.json` is pipeline output and stays
byte for byte (owner call 11). Before step 1, record the hashes of section 6; `check.mjs` pins them.

**The bugs on record, which this pass must fix.** Plan 0009 item 5 and `docs/review/` record none
for Besseggen; the app has no `DECISIONS.md`, and `NOTES.md` records fixes, not open bugs. Plan 0008
D8 records one (Snuggery's full-screen exit control over the `i` key on iOS 18). Reading the app as
a stranger found the rest. Each is a must, and each names its evidence:

- **B1. Place labels collide with the compass and scale bar**, and nothing keeps labels out of the
  readout's or a key's rectangle: `Maurvangen` under `10 km` (`tools/.work/look/light-2-stop2.png`).
  Fixed by items 8 and 11 (the instrument line leaves the plate; labels avoid the card, the keys and
  the ghost key).
- **B2. The profile's waypoint names are drawn through the profile line** (`Besseggen`, `Bandet`,
  `Gjendesheim`, `Memurubu` in `tools/.work/look/light-0-open.png`), so their text fails contrast
  where the line crosses it. Item 13.
- **B3. While the hour or the date is dragged, the light and the cast shadows show different
  times.** `updateSun(false)` moves the sun at once and debounces the shadow sweep by 170 ms
  (`scheduleShadow`, `app.js`). Measured (`node tools/.work/lag.mjs`, headless): straight after an
  input moving 20 Sep from 08:00 to 10:00, the sun reads 19.0° up at 126.3° while the shadow raster
  still holds 08:00 (396 of 800 sample points lit; 662 once it catches up), and one of the two
  animation frames in the following 160 ms ran with the old raster. During a drag the debounce keeps restarting, so every frame
  until the finger stops mixes two times. Item 9 (the scrub rule).
- **B4. The profile's red steep stretches have no key anywhere.** They mark `|gradient| ≥ 0.25` over
  a 100 m window (`profile.js` calls `gradientAt(i, 2)`: two 25 m samples each side). Item 13 says so
  on screen and in About. The walk's gradient figure is over 150 m (`gradientAt(cursor)`, window 3);
  the figures line's description says that too.
- **B5. The Layers note credits the lake levels to N50, but prints the lidar levels.** It reads
  `Lake surfaces are drawn flat at the level N50 states: Gjende 985 m, Bessvatnet 1373 m, Russvatnet
  1177 m, …`, while `data/water.geojson` gives N50's own figures as 1 372 m and 1 175 m and the
  planes sit at `levelM` (1 373.1 m, 1 176.7 m), as About already says correctly. Item 8 rewrites it
  from the same fields About uses: `Lake surfaces are drawn at the water level the lidar reads:
  Gjende 985.1 m, Bessvatnet 1 373.1 m (N50: 1 372 m), …`.
- **B6. Snuggery's full-screen exit control overlaps the app's own top-right key on iOS 18** (plan
  0008 D8). The top-right keys leave the header; in focus mode the ghost key takes that corner,
  which is D5 (3)'s phone check.
- **B7. The dark theme's plate**: a tinted near-black sky, 100 m contours as a white wireframe, a
  north face rendered black at 07:00 in June (`tools/.work/look/dark-0-open.png`,
  `dark-7-boat.png`). Item 8 (one appearance).
- **B8. The arrow in the direction key** is a character the house face lacks (HOUSE 2.3). Item 15.
- **B9. The viewshed's hidden ground is indistinguishable from its seen ground on sunlit terrain**
  for a protan reader (dE 0.001, `palette.py`'s stock line). Item 6.

**The steps:**

1. **`fonts/`**: delete the four Atkinson and Newsreader files and `fonts/OFL.txt`; copy
   `../global-weather/fonts/ysabeau-office-gw.woff2` and `../global-weather/fonts/OFL.txt` byte for
   byte (`cmp` both). No supplement.
2. **`js/plate.js`** (new): `export const PLATE = ` + `python3 besseggen/tools/art/palette.py
   --json` pasted, with a two-line comment naming the command.
3. **`js/units.js`** (new), the one writer of numbers, units and dates, on Global Weather's
   pattern: U+2212 for negatives (never −0); U+202F between number and unit and in thousands from
   four digits (`1 741 m`, `13.68 km`, `1 083 m`; years, clock times, EPSG codes and stedsnummer
   never grouped); `km` from 1 000 m with two decimals below 10 km and one above (the stock
   `fmtDist` rule); durations `4 h 33 min`, `38 min`; percentages `9 %`; angles `17.4°`; positions
   `61° 29.665′ N, 8° 48.789′ E` (degrees and decimal minutes, as a Norwegian paper map is gridded,
   kept; U+202F before the hemisphere; a comma between); dates `14 Jun`, `14 Jun 2026`, `22 Sep
   2026`; clock `07:00`; zones `CET` / `CEST`; spans `06:42 to 20:22`; the spoken forms (`meters`,
   `kilometers`, `degrees`, `14 June`, `Central European Summer Time`, `east-northeast`). The stock
   `fmt`, `fmtDist`, `fmtHM`, `fmtClock`, `fmtDate`, `fmtDateShort`, `MONTHS`, `compassPoint` move
   here from `util.js`, and `fmtLonLat` from `geo.js`. `toFixed` and `toLocaleString` appear nowhere
   else but the allow-list `check.mjs` names (the test hook's rounding, cache keys).
4. **`styles.css`**: rewritten as the house stylesheet for this app: the 3.1 tokens in both themes
   and `color-scheme`, `html, body { background: var(--page) }`, `--face` only, the one
   `@font-face`, this app's tokens (section 2), the column frame, header, key column and states,
   caption band (instrument line, legend rows, caption, credits), player, track, card, the
   controls sheet and its grip, rows, sliders, words with the tracer and text keys, the profile's
   classes, About and Layers as dialogs, notices, ghost key, labels on their halos, landscape at
   `(orientation: landscape) and (max-height: 500px)`, the wide column at `(min-width: 820px) and
   (min-height: 480px)`, gutters 20 px from 700 px, `@media (prefers-reduced-motion: reduce)` zeroing
   every duration, `@media (hover: hover)` hovers, `touch-action: manipulation` and
   `-webkit-tap-highlight-color: transparent` on controls. No `box-shadow`, `backdrop-filter`,
   `text-shadow` (but item 11's fallback, if needed), `transition: all`, uppercase or
   letter-spacing; `.valid, .lead, .track, .track canvas` carry `transition: none; animation: none`.
5. **`index.html`**: `lang="en-US"`; the viewport without `user-scalable=no`; `<meta
   name="color-scheme" content="light dark">`; two `theme-color` metas carrying each theme's
   `--page`; the column (header with `h1` and stamp; the plate with the canvas, the labels layer, the
   key column, the card, the notice and the ghost key; the caption band with the instrument line,
   the legend rows, the caption, the stamp's focus-mode slot and the credits; the player; the
   controls sheet with its grip and three stops); About and Layers as dialogs; the live region; the
   Burn's hidden description. The canvas's description keeps its substance (it names the gestures) in US
   English. The stock `#head`
   buttons, `#pickbar`, `#gauge`, `#focus-kit`, `#hint`, `#debug`, `#loading`, the time slider row,
   the walk slider row if trim 3 is taken, `#t-debug`, `#t-labels` and the `select` go.
6. **`js/material.js`**: the viewshed's two states from `PLATE.viewshed` (seen: mix toward
   `uViewshedCol` at 0.50; hidden: mix toward the veil color at 0.40, two new uniforms); nothing else
   in the shader changes. Comments in US English (`gray`, `normalized`, `color`, `meters`).
7. **`js/overlays.js`**: the casing: `makeLineMaterial` gains a casing pass (a second mesh sharing
   the geometry, `uWidth` plus `2 × PLATE.casing.px`, `PLATE.casing.color` at `.alpha`, drawn one
   render order below) for the trail, the marker's stick and the tool line; the tool line in the
   marker's color with a dash where `vT` is past `uSplit` (`if (vT > uSplit && fract(vT * 60.0) >
   0.5) discard;`). Comments in US English.
8. **`app.js`, the frame and the plate**: create the renderer and start loading as today; the
   stamp's counter from `DataSet.load`'s phases; `fail()` writes the notice; a `ResizeObserver` on
   the plate drives `onResize()` once per change; `applyScheme()` draws the plate from `colors.light`
   in both themes and sets `--trail` from the current theme's block (section 2); `scene.background`
   and the fog from the light block's sky; the Layers note rewritten (B5); the instrument line (the
   compass and scale code moved, not rewritten: `updateGauge()` writes into the caption band); the
   debug readout, the bench handler, the pick bar and the duplicate checkbox removed; `S.debug`
   removed (owner call 5); `window.__besseggen` keeps `stats`, `sunAt`, `dayEvents`, `heightAt`,
   `camera`, `setLayer`, `applyViewpoint`, `setDateTime`, `runTool`, `setEye`, `peaksFrom`, `los`,
   `viewshedVisible`, `shadowAt` and gains `shown()`, `wanted()`, `burn()` (the marker's lit samples
   and spans) and `focus()`; trim 4 removes the rest.
9. **`app.js` and `js/track.js` (new), the player**: Global Weather's track adapted (section 1 and
   3): the day of 288 steps, the Burn, the thumb, the keys, `role="slider"` with `aria-valuetext`.
   The scrub rule (B3): input handlers only record `wanted`; the frame recomputes `sunInfo` and the
   cast-shadow sweep for the newest `wanted`, sets `shown`, then renders; `scheduleShadow` and its
   170 ms timer go; the date slider follows the same path. Play on the clock at 1 s = 1 h, stopping
   at 24:00; Reduce Motion an hour a second; About, Layers and a touch stop it; hidden stops it. The
   day keys, with their live sentence. The time row and the lead (empty until boot completes).
10. **`js/sun.js`**: `directSunWindow` also returns its 2-minute `lit` samples (the spans are built
    from them already); `dayEvents` also returns `altApparent` (section 1); a `norwayNow()` helper (the present instant's Norwegian date and minute, from
    the stock CET/CEST rule) if the `now` notch stays. No change to the algorithm. Comments in US
    English.
11. **`app.js`, labels and the card**: the labels restyled (section 3), measured in the face after
    `document.fonts.load`, and kept out of the card's, the key column's and the ghost key's rectangles
    (B1); the marker's label with the selection tracer. The card for a tapped point (section 3), the
    tools' results moved into it (`runMeasure`, `runLos`, `runViewshed` write the card's body, each
    value through `row()`, which escapes), the placement rule, the live sentence. The `First and last
    sun` tool removed (owner call 4); its numbers are the card's sun rows and the Burn.
12. **`app.js`, the controls sheet**: the three stops and the grip's three names unchanged; the
    sections as section 3 says; tools and pace models as words with the tracer; viewpoints as word
    keys; `Fit the route` leaves the camera row for the key column; `S.tool`'s double-tap rule kept.
13. **`js/profile.js`**: the house drawing (section 3): line, so far, wash, steep stretches in
    `var(--trail)`, gridlines, km numbers, waypoint dots and names on a `--page` halo (B2), the
    cursor as the tracer head; the steep window stated (B4); `aria-valuetext` through `units.js`;
    `relayout()` after the face loads. Its `innerHTML` builds stay (HOUSE 7.1 item 13: no new uses;
    every value it touches escaped, as `escapeHtml` already does for names).
14. **`js/focus.js`**: rewritten to the house pattern (section 3): `Hide the controls` and the ghost
    key, `hidden` and `inert` on what leaves, the stamp moved into the caption band, `besseggen:focus`
    remembered and restored before the first draw, the two sentences, focus moving only for the
    keyboard, the double-tap and F kept, Escape leaving it when no dialog is open. The hint, its
    timer and `focusHintSeen` go (owner call 6).
15. **Words, everywhere shipped** (`index.html`, `app.js`, `js/*.js`, `CREDITS.txt`, `NOTES.md`,
    `ART.md`): US spelling, comments and identifiers included (the frame's center latitude and
    longitude fields and `serialize` take the US spelling; the stored `camera` JSON keeps its shape,
    so a saved camera still restores), except the data's own keys (about.json's British-spelled
    license key), proper names (the official English name of NLOD, the Norwegian open government data license,
    which keeps the British spelling, allow-listed in `check.mjs` by file and word) and text read from
    the data; `meters` in every spoken string (`profile.js` says the British form today); the
    direction key in words (B8); no middle dot, no spaced em dash, no `~` for "about" and no arrow
    character in a visible string or a comment; `Colors from data/colors.json`; `Civil twilight lasts
    all night; it never gets fully dark.`; the notices of `js/data.js` rewritten as section 3 says.
    `check.mjs`'s US list gains the British forms the stock code uses today, all of them found by
    the art pass's count over the shipped files: the British spellings of the meter family (meter,
    decimeter, centimeter, kilometer, millimeter), of centered and neighboring, the -ise and
    -isation forms of serialize, quantize, quantization, optimization, generalize and initialize,
    and the doubled-l modeled.
16. **About** (section 3): the safety sentence, the four sections, the Burn's and the plate's
    paragraphs, about.json's blocks rendered field by field with their values verbatim.
17. **`CREDITS.txt`**: US spelling in the file's own prose (`licenses`, `quantized`), proper names
    kept; the FONTS section replaced: the house credit line, the face's copyright line (section 4),
    and the sentence that `fonts/OFL.txt` is the house's file byte for byte; the RENDERING section
    unchanged. No address is added to a script (addresses stay in this `.txt`, which `check.mjs`'s
    scheme scan does not read, as today).
18. **`NOTES.md`**: the folder list (`fonts/`: the house face), the code map (`track.js`,
    `units.js`, `plate.js`), focus mode rewritten (the house's keys, remembered, the double-tap
    kept), the Burn (what it computes, at what cost), the plate's one appearance and what the dark
    block of `colors.json` is still read for, the budgets table re-measured, "What was checked"
    noting the removed hooks if trim 4 is taken, the credit line word for word, US spelling. The
    determinism table is unchanged, because the data is.
19. **`miniapp.json`**: the name unchanged; `version` `1.2`; the description may name the hours of
    sun (at most 200 characters), the lead's choice.
20. **`tools/check.mjs`** (new, Global Weather's pattern; every item of HOUSE 7.1): the ZIP's limits;
    no scheme address in shipped `.html`, `.css`, `.js`; references relative and present; the folder
    contract (`fonts/` exactly the two house files; `data/` exactly the 17 files); the face's and
    `OFL.txt`'s sha256; the 17 data hashes and the 5 vendor hashes; `miniapp.json`; the vendor-name
    list copied from `global-weather/tools/check.mjs` line 128 as it is (ROT13, never decoded); the
    credit constant word for word; the camera's strings of section 5 with their roles; every
    `localStorage` key read today still read with the `besseggen:` prefix (`camera`, `cursor`, `date`,
    `exag`, `eyeM`, `layers`, `marker`, `minutes`, `paceFit`, `paceModel`, `reversed`, `savedViews`,
    `sheet`), `focus` added, and `debug` and `focusHintSeen` listed as retired with this file's owner
    calls as the reason; SI; nothing that carries a step transitions; `innerHTML` assignments not
    `= ''` no more than the 11 counted today (`app.js` 10, `js/profile.js` 1), and none new; the
    palette (`js/plate.js` equals `--json`, the script exits 0); the tells and the house's three
    additions; the budgets (code at most the cap the lead rules, 227 000 B since plan 0011 D11; fonts; the ZIP
    built as `build-zips.yml` builds it, with `index.html` at its top); US spelling with the count of
    British words in `data/about.json` printed, not exempted silently.
21. **`tools/shoot.mjs`** (new; HOUSE 7.2 as the kind allows): boot (the camera's strings by role and
    name, `CEST` absent before boot completes and present after, the credits, the face loaded);
    text contrast both themes; the Burn sampler (the burn's drawn pixels against the page, 90 % of
    samples ≥ 3, the lowest printed) and, on the plate, the trail's pixels against their casing at
    the opening view and from the boat; the Burn against the script's own decode (its own sun
    formula and its own ray march over a 16 m grid it decodes from `terrain-L2.bin` and the shell,
    at Veslfjellet and Bandet on 14 Jun, 20 Sep and 21 Dec: first and last sun within 4 minutes,
    the spans' count equal); the card's height against the script's own decode at a tapped point;
    SI in every visible text node; the scrub by real touch at 2, 8 and 20 steps a second, with 0
    frames whose sun and shadow raster differ (B3) and the sweep time printed; play (no frame
    backwards, the Play key's mark, About holding play); the plate's height steady while the caption
    changes; the card clear of the tapped point; labels outside the card, keys and ghost key (B1);
    the profile's names outside the line's pixels (B2); focus mode (touch, Enter, F, the double-tap,
    Escape, the ghost key, a reload, the live sentences, hit targets, the plate's growth); the grip's
    three names at their stops; hidden; Reduce Motion (play in hour steps, `Step to the next point`);
    broken data (a missing level file, a bad `pace.json`, a missing `rivers.geojson`, which stays
    optional); widths 320, 360, 375, 844 x 390 and 125 % zoom; hit targets ≥ 44 x 44; pictures to
    `tools/.work/shots/`, never `screenshots/app.png`, whose hash the run checks unchanged; frame
    and sweep times printed as headless figures.
22. **`tools/test_decode.mjs`** (new; no dependencies): the terrain decode in this file per
    `NOTES.md` (integer decimeters, then meters; shared tile edges equal), checked against the
    manifest's tile ranges; `js/sun.js` against this file's own closed-form NOAA at the three dates
    `NOTES.md` tabulates (03:43 / 23:08, 07:04 / 19:32, 05:00 / 22:01); `js/units.js`'s output for a
    table of values (negatives, thousands, years, positions, durations); `js/route.js`'s walking time
    for the whole walk against this file's own Tobler sum.
23. **`tools/DECISIONS.md`** (new): the owner calls (section 9) as they settle, this change list,
    as-built notes and the review record.
24. **`.gitignore`**: already ignores `tools/.work/`, `dist/`, and now `tools/node_modules/` (added
    by this art pass).

---

## 9. Owner calls left open

1. **The code cap.** Ruled 227 000 B by the lead (plan 0011 D11; the build measured 226 148 B). Held at 215 934 B before that. Section 6's ledger lands near 221 000 B after its five
   trims. Either a ruled cap with its reason (the house player and track are what the owner asked
   every app to carry, as Milky Way's 240 000 and 242 000 were ruled) or features named to cut
   instead: Play (about 1 200 B), the legend rows (800), saving and clearing your own viewpoints
   (900), `Free orbit` (400).
2. **The plate keeps its daylight in both themes**, from `colors.json`'s light block. The file's
   dark block is then read only for the trail's red in the dark chrome; its other colors do nothing
   in this version, and the file's own note (one palette per color scheme) describes a file the app
   only half reads. The alternative is the dark block on the plate, with the wireframe contours and
   the black north face of B7.
3. **The signature is the Burn**, over the horizon chart (the skyline from the marker with the sun's
   path across it), which is as honest and more pictorial but needs a 360-ray horizon pass and
   room the bands do not have.
4. **The `First and last sun` tool folds into the marker**: a tap anywhere gives the card's sun rows
   and the Burn, so the tool's chip, its armed state and its result panel go.
5. **The debug readout leaves the screen** (its monospace panel, its toggle, the bench button). The
   test hook keeps the figures; the `debug` key is retired.
6. **The gesture card and the `?` key go.** The gestures stay in the canvas's description and in
   About's last section; the zoom keys and `Fit the route` give a way to move without a gesture;
   `focusHintSeen` is retired.
7. **Focus mode is remembered**, as the house says, against `NOTES.md`'s reason for forgetting it
   (a person returning after a month would not know where the controls went). The ghost key is the
   answer to that reason; the camera gains its guard.
8. **The on-screen credit line**: `Terrain, trail, lakes and names: Kartverket, CC BY 4.0`.
9. **A units key** (feet and miles) in the header. Not in this pass: every height, distance and
   speed is written in SI, as the trail signs and maps of the area are; about 1 500 B to add.
10. **The data-owned colors** (`colors.json`, byte-identical here): the 40° slope class and the trail
    are one color; the bands' middle pair separates by dE 0.063. A change needs `tools/06_editable.py`'s
    colors edited and the pipeline run, a follow-up like Milky Way's. **Settled by that follow-up**:
    the 40° class `#8e1f4f`, the middle bands `#908862` and `#b3a99a` (section 2).
11. **British spellings and em dashes in About from `data/about.json`**: three words (the British
    forms of decimeters, generalized and labeled) and the em dashes in four values stay verbatim on
    screen until a pipeline text pass rebuilds the file (`tools/06_editable.py`'s prose swept, the
    pipeline run, the other 16 data files proven byte-identical). This pass touches no pipeline file.
    **Settled by the follow-up**: the prose swept and the pipeline run; `about.json` holds no British
    spelling and no em dash, and `check.mjs` fails if one returns. (`check.mjs` had counted five
    spellings and five em dashes, in five values; this call first said three words and four values.)
12. **The instrument line stays in focus mode**: north and the scale are the caption of a
    perspective view, needed to read it. The house's legend leaves; the alternative hides them too.
13. **The walk slider** in the sheet's second stop goes as trim 3 if the bytes are needed: the
    profile's drag already walks the first-person camera.
14. **The day keys step a day and Play plays the day at an hour a second**; the date slider keeps
    long jumps.
15. **The trail on a pale casing**: a visible change to the plate, the cartographer's edge that
    lifts the trail's worst contrast from 1.00 to 4.20.

**Phone checks for the device matrix** (none claimed): frame time idle, scrubbing the hour (each
frame's shadow sweep), playing the day, flying the route and dragging the walk; memory after five
minutes; background and return; focus mode in Snuggery's full screen with the ghost key and
Snuggery's own exit control both reachable in the top-right corner (iOS 18 and iOS 26); the labels'
halo (`paint-order` on HTML text in WebKit); the casing's look at the 6.9" screen's DPR; VoiceOver on
the track (the hour, the sun, the marker's state; the Burn's description), on a tap, on the grip and
in the dialogs; the phone on its side with the sheet column; the safe areas of every band; the
camera's `CEST` wait and its clip 1 run end to end on the simulator, then the stills.

---

## After QA (2026-10-01)

What changed after the QA pass, and where this file was corrected to match the build:

- **The code cap is the lead's ruling, 227 000 B** (plan 0011 D11), in `tools/check.mjs`'s
  `CODE_CAP` and in section 6's table and section 9's call 1. The code measures **226 205 B** after
  the fix below (`node tools/check.mjs`: 795 to spare).
- **The phone on its side**: the scale's words (`at 14.0 km, vertical ×1.0`) ran into the credits
  at 844 x 390 and ended in an ellipsis. The credit line there now wraps to two lines, 150 px wide
  at a 12 px line height, so the instrument row stays 24 px and the plate keeps its 227 px; the
  instrument line's gaps went from 8 to 6 px, which also brings the words whole at 125 % zoom
  (312 x 675), where they were cut by 1 px. `tools/shoot.mjs` now checks the words whole at every
  width it opens. At 667 x 375 (the smallest phone on its side, not one of `shoot.mjs`'s widths)
  the row still has no room: the words are dropped to an ellipsis, as before the fix.
- **The Burn's worked numbers** in section 1, the caption and description examples, the wireframe
  and the units list were taken before the eye-height rule (0.5 m above the higher of the 2 m point
  and the 16 m surface; `NOTES.md`). Read again from the running app (`window.__besseggen.burn()`
  and the caption, headless, 2026 dates, `tools/.work/fix/probe.mjs --burn`): Gjendesheim on 14 June
  **06:42** to 20:22, 13 h 38 min (was 06:43; 13 h 40 min after review, below); Bandet's sun on 20 September ends at **16:53**,
  **2 h 27 min** before Veslfjellet's 19:20 (was 16:51 and 2 h 29 min). Veslfjellet's 03:47 to 22:27
  (18 h 40 min), its 4 h 38 min (4 h 39 min after review) on 21 December and no sun at Bandet, Bjørnbøltjønne and Memurubu
  that day are unchanged. The readout card's example row in section 3 now carries Veslfjellet's own
  span (its height is Veslfjellet's). The `firstsun` tool section 1 cites was folded into the marker
  (owner call 4); the figures above come from the Burn itself.

## After review (2026-10-01)

The final review's verdict was "fix": three musts, seven shoulds, six nits. What changed, and what
this file now says:

- **The Play key becomes Pause** (`app.js` `setPlaying`): an `<svg>` has no `hidden` property, so
  the attribute itself is toggled, as Global Weather does. `shoot.mjs` reads the attribute and the
  computed display now, never the expando that agreed with the bug.
- **Focus mode on its side and on a wide screen** (`styles.css`): the header, plate, caption band and
  player have fixed grid rows, so a hidden header leaves an empty auto row and the plate takes the
  height (844 x 390: 227 to 255 px; 1024 x 768: 551 to 583 px), with the stamp, the caption, the
  credits and the time on screen. `shoot.mjs` checks both sizes.
- **One sweep per instant** (`app.js`): `applyTime` returns at once when the instant is the one
  already shown, and play schedules its next frame at the next step boundary instead of on every
  display refresh (a frame an hour under Reduce Motion). `shoot.mjs` checks that the shadows are
  swept exactly when the instant changes, in the scrub at three speeds, in play and under Reduce
  Motion.
- **The Burn's figures add up** (`js/sun.js` `directSunWindow`): every edge of every spell is
  bisected to the minute, and the total is the sum of the spells as written. The caption's numbers
  in sections 1 and 3 changed with it: Gjendesheim on 14 June **13 h 40 min**, Veslfjellet on
  21 December **4 h 39 min**. `shoot.mjs` parses the caption and compares.
- **The marker is named** when it stands on a waypoint: its plate label reads `Gjendesheim, 999 m`
  and the caption `The burn: direct sun at the marker, Gjendesheim, …` (or `No direct sun reaches
  the marker at Bandet on …`); elsewhere both say `the marker` and its height.
- **The card** has no 144 px floor: at most 34 % of the plate (66 px at least), and never up into the
  key row when the keys run along the top (66 px of a 180 px plate at the sheet's top stop).
- **Loading**: the walk line, the profile, its foot, the instrument line, the sheet's sections and
  the transport carry `data-boot hidden` and appear when boot has filled them; a failed start
  leaves them hidden.
- **The words**: the walk line reads `0 m walked, at 999 m, 9 % grade, 4 h 33 min left`; the date
  slider is named `Date, day of year`; a whole hour prints `15 h`, and a duration's parts are joined
  by U+202F, so it never breaks across a line.
- **About and Layers** move focus to their Close on every open, as Global Weather's About does.
- **Nits taken**: the profile's `aria-valuemax` (the walk's length in meters); a notice sits at the
  plate's foot; a broken editable file read on return keeps the copy read before; the Layers mark
  is three irregular contour lines instead of nested rings; a 2 px gap under each slider row's note,
  because the face's glyphs stand taller than the note's line and took the slider's bottom pixel.
- **Nits declined**: per-frame layout reads and the Burn computed in the profile's pointer handler
  (the bytes are not there: 344 B under the cap; frames during play now come once per step; dragging
  the profile is on the phone list), and the credit line (owner call 8, as accepted).

## After the follow-up (2026-10-01)

One builder after the final review took the reviewer's two shoulds, the pipeline's text and colors
(owner calls 10 and 11) and this document's leftovers. Figures are the named tools' own output, or a
headless Chromium probe at phone size where a width is quoted: a trend, never phone evidence.

- **The profile's top label** (`js/profile.js`, `relayout()`): a meter label that would cross the
  strip's top edge now comes down inside it. The highest gridline, 1 900 m, sits 8 px under the
  top with no room above it, and its label was cut in half; it is whole at every width
  `tools/shoot.mjs` opens, which now checks every label the profile shows against all four edges.
- **The exaggeration's readout** says `True scale` at ×1.0, where `×1.0, true` read like a leaked
  boolean. The suggested `×1.0, true scale` widened the 64 px output to 78 px, so the slider's track
  would have jumped 14 px under the finger as the value left 1.0; `True scale` fits the 64 px.
  `shoot.mjs` reads the words and the slider's length at 1.0, 1.1 and 3.0 (141 px at each).
- **The data-owned colors** (owner call 10; section 2 has the figures): the 40° slope class is a
  crimson, `#8e1f4f`, no longer the trail's `#c0392b`; the middle elevation bands keep their hues
  and spread their lightness, `#908862` and `#b3a99a`. `tools/art/palette.py` now checks those pairs
  instead of reporting them, and models the 40° class over the 30° one as the shader does. Run on
  the old `colors.json`, it prints `LOW` on the collision and the bands and exits 1.
- **The words** (owner call 11): `tools/06_editable.py`'s prose is US English, and `about.json`'s
  five British spellings and five em dashes are gone (two new sentences, three colons).
  `tools/check.mjs` now fails if one returns, where it used to print the count.
- **The rebuild**: `tools/build_all.sh` with `OUT_DATA` in a scratch folder, twice. First with the
  scripts unchanged, from a cold cache: 367.4 MB downloaded in 40 files, plus the two N50 zips
  (36.7 MB), which the pipeline only checks for and which were ordered from the Geonorge download
  API by hand; 160 s. It reproduced 16 of the 17 shipped files byte for byte. The seventeenth,
  `places.geojson`, gained one name the register added after 22 September (Besstrond, a summer
  farm, stedsnummer 435855), so the shipped file was kept. Then with the swept script on the same
  cache, 8 s: only `about.json` and `colors.json` changed, in words and named colors, with the same
  keys and no number changed, and `tools/verify_data.py` passed. Those two files were copied into
  `data/`; the data's digest is now `97d6b944…2cd3`. `js/data.js`'s built-in copy of `colors.json`
  and the shader's defaults carry the new colors (same length, 0 bytes).
- **Left as they were**: the strings in `tools/06_editable.py` that become `waypoints.json`'s note
  (a British spelling of meters, `towards`, two em dashes) and `viewpoints.json`'s note (one em
  dash). The app shows neither, and sweeping them changes two more data files than this follow-up
  was given. With the cache warm, it is an 8 s rebuild.
- **Budgets** (`node tools/check.mjs`): app code 226 787 B of the 227 000 B cap, 213 to spare; fonts
  40 075 B; the ZIP 4.2 MB under its cap (`NOTES.md`'s budgets table has the bytes).
- **This document**: section 3's table now describes what was built: the Layers mark, the walk line,
  the marker named on a waypoint, notices at the plate's foot, play held while About or Layers is
  open, and a phone on its side. Section 5 records the camera guard as already in place. Sections 2,
  6 and 9 carry the new colors, the new digest, and calls 10 and 11 as settled.

## Plan 0012 package 3.7: the text cut, 1.3 (2026-10-07)

The change list in `docs/plans/0012-change-lists.md` (Besseggen), applied in full. The ground stays
gray (D6). The bugs on record: plan 0009 item 5, `docs/review/` and the matrix (rows 149, 159, 171)
name no open Besseggen bug this pass can fix in the app; row 149's overlap of Snuggery's exit control
with the app's top-right keys is Snuggery's (a 1.2 candidate), and row 159 is the owner's phone pass.

- **The stamp (F2).** Its line shows only while the data loads or when the start fails, and hides once
  the terrain is in. The edition, `Kartverket data, retrieved 22 Sep 2026`, from the same expression,
  is About's first *This data* row (`Edition`). `fail()` shows the line again with its words.
- **The About key (F2).** `#btn-about` in `.hkeys` at the header's right across its two rows, shown
  when the data is in (the guard: hidden before), opening About with the stamp's handler. **Departure
  from the list's markup:** it is `class="textkey framed"`, the app's own framed text key (the direction
  key's style: 12.5 px in a 28 px `--line-strong` frame, 44 px hit), not a new `.wordkey` class; same
  look, about 300 B less CSS under a cap with 142 B to spare. In focus mode it moves into `#caption`
  as its first child (`js/focus.js`), and back into `.hkeys`; the stamp no longer moves (it is hidden
  once the data is in, and focus mode is set up only after that).
- **The header** is a grid now: the name, the stamp's line under it while loading, the key at the right.
  Once the line hides, the name centers on the key: 40 px (6 + 28 + 6), was 50.
- **The credit line (F1).** `#credits` and its write are gone; `CREDITS` is unchanged and is written,
  escaped, as `<p id="about-credit-line" translate="no">` first under *Sources and credits* in
  `buildAbout()`. On a failed start About has no data section and no credit, and no data is drawn.
- **The burn's caption** drops ` Terrain shadow only; no cloud.` (About's *What the picture is* says it).
  `.capbox` is now 30 px (two lines) at every width: the longest caption the data writes (110
  characters) measures 30 px at 320 px (`shoot.mjs`), so HOUSE 4.15's "shrinks to what the longest
  form needs at 320" takes the 45 px it had below 360 px. Change list item 4 said keep two lines; this
  is two lines everywhere.
- **The steep key (F4)** follows the totals sentence inside the same paragraph (`#s-updown` is now a
  span): a 10 px swatch in `var(--trail)` (the profile's `.psteep` stroke, which `shoot.mjs` compares
  computed) and `25 % or steeper`, `nowrap`. Inline rather than a separate `div.key` row so the foot
  keeps its height: measured, the foot is 45 px (three lines) in a sheet 320 and 360 px wide and 30 at
  390, exactly what the old sentence `… Red: 25 % or steeper.` took (the change list's risk; the row's
  `min-height` is 44, so 1 px over, as before).
- **On its side** the caption band is plain flow (the credits' second column is gone).
- **Prose (F5):** `NOTES.md` (the look, focus mode); `CREDITS.txt` placed nothing on screen. `ART.md`
  made true: the wireframe, the header rows, the caption, the credits row, About, the steep key, focus
  mode, on its side, the plate figures.
- **Version (F6):** 1.3; `check.mjs` item 7 now pins it.

**Checks changed (F8).** `check.mjs` item 9: the constant unchanged, written as About's first
Sources-and-credits paragraph and nowhere else, no `#credits`, no `$('credits')`, and none of
`Kartverket`, `CC BY`, `License`, `retrieved`, `Ysabeau` in `index.html` outside About; item 7 pins
1.3. `shoot.mjs`: the zone observer records the stamp's line hidden and the About key shown at the
first CEST (was: the stamp read `Kartverket data, retrieved …`); the edition row; the stamp one line
(16 px) in each of its four states; `About` among the controls by role; the credit in About, word for
word, and no `#credits`; every tap that opened About taps `#btn-about`; focus mode's "stays" lists
(`btn-about` for `stamp` and `credits`, the key the caption's first child); the broken-data cases ask
for the stamp's line shown only when the app stops (was: the credits on screen); new, at every width:
the foot's height against the measured old one and the key one line in the profile's red.

**Measured** (headless Chromium, 390 × 844): the plate 422 → 447 px at the first stop (+25; the list
estimated 37: the header keeps 40 px for the key), 658 → 663 in focus mode; on its side 227 px, 244
in focus mode (255 before: the About key's line, 30 px, replaces the stamp's 18 and the credits that
sat beside the instrument line). App code 226 858 B of the 227 000 B cap (142 to spare; 226 794
before). ZIP 16 854 750 B.

**Taste calls for the owner:** the About key in Besseggen's framed-text style rather than the 600-weight
word key; the key's own line in focus mode costs 11 px of plate on a phone on its side.

**Camera strings:** none changed. `CEST`/`CET` still appear only once the terrain is in.
