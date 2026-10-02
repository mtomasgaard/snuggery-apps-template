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
