# Warming World — notes

What the app does today, how to run it, where the code is, what was measured and how, and what it
cannot claim. `DESIGN.md` is the specification, `ART.md` the look, `tools/CONTRACT.md` the data file.
This file is the builder's record. Every "measured" figure names the command that printed it.
Chromium's figures are SwiftShader's (a CPU emulation of a GPU): correctness and a trend, never phone
evidence.

## What it does (the core and polish passes, 2026-10-01)

- A WebGL2 globe (orthographic) and an Equal Earth map of GISS's 2° anomaly cells, one frame a year
  from 1880 to the newest complete year, the partial year last, and the 24 newest months. Every cell
  is drawn as one flat patch (nearest cell, never interpolated). No data is a screen-fixed hatch, a
  little darker than the gray card. The ramp is ART's, fixed at ±4 °C and the same in both themes.
- All 171 frames are decoded once at boot into one `Uint8Array` and uploaded into one `R8` array
  texture, the step to be shown first. A step change is one uniform and one draw. Scrubbing and play
  never load anything.
- The stripes track is the scrubber: GISS's global means on their own ±1.5 °C scale, framed, with
  decade graduations, the `1951–1980 = 0` bracket (the base period read from the snapshot), the labels,
  the partial year's open stripe and a reading index that steps and never glides. ‹ › step, and hold
  to repeat at 8 a second after 400 ms. ▶ plays at 8 years a second, or 4 months a second, every step
  in order. The year's digits roll during play only. Annual | Last 24 months switches the list.
- The year row prints the step's name, GISS's global mean (`Global mean so far +1.20 °C (7 months)`
  for the partial year) and the area the data cover, all from the snapshot.
- The legend prints, under its row of Difference | Absolute and the Base key (plan 0012), the ±4 °C
  bar (81 steps of 0.1 °C with pointed ends) or Absolute's −60 … +40 °C bar (101 steps of 1 °C), the
  hatch key, the step's count of cells beyond the scale, and the caption on one line ("anomaly, not
  temperature", naming the baseline; or "Estimated temperature"). The credit is in About (plan 0012,
  HOUSE §4.15): About's first line under "Sources and citations". The data's newest month and a
  research build's "archived copy" are in the top bar's one-line stamp (DESIGN §20 Q-5, §21 R-14).
- Drag turns the globe or pans the map, a fling coasts, pinch and the wheel zoom 1–4× about the
  fingers, a double-tap zooms in 2× at zoom 1 and goes home when zoomed, a tap selects a cell (marked, with its card). The mark never covers
  the cell: a frame drawn outside a cell at least 4 px across, an open 9 px ring around a smaller one
  (every cell from about 51° poleward on the phone globe at zoom 1, and every cell on the map at zoom
  1). Place labels: tier 1 only below zoom 1.5 on a phone-sized Earth, tier 2 from 1.5, tier 3 from 2. The view
  carries across Globe | Map. Keyboard: the track is a slider (← → PageUp PageDown Home End Space);
  the Earth turns with the arrows, zooms with + −, selects under its crosshair with Enter; Escape
  clears the selection.
- Missing, unreadable, wrong-shape and stale snapshots, no WebGL 2, a lost context, and a snapshot
  replaced while the app is open each say so in a sentence (DESIGN §3.7, §12.3, §12.4).

- **The tap card** (DESIGN §8): the cell's bounds and a place phrase (`, with Fairbanks`, `, near …`),
  its value for the drawn step against its own 1951–1980 average (or "No estimate for this cell in
  1880." and its first year with data), a note when it is beyond ±4 °C, and its chart from 1880: the
  base band, the zero line and GISS's global mean at once, then the cell's line drawn over 480 ms at a
  constant rate with its own stripes on the ±4 °C scale (whole at once under Reduce Motion). The hollow
  partial point and open partial stripe, a hatched strip for missing years, the rule at the step on
  screen, the global mean's key in the labels row; in Last 24 months the cell's 24 months as bars. The
  footnote gives the rule behind the value on screen (a year, the partial year, a month) and a clause
  true over land and open water. The card follows the step without drawing again, the pin stays on the
  cell, a horizontal drag on the chart scrubs the year (a tap does nothing), and a covered cell is
  turned into view in 240 ms. Paper with a hairline edge, no shadow or blur.
- **Arctic and Antarctic** turn the globe to 72° over 600 ms on ART's curve (a jump under Reduce
  Motion; from the map they switch to the globe). While on, a chip reads the cap's mean for the drawn
  step (`Map mean north of 64° N: +2.97 °C`, with the share that has data when it is under 100 %),
  said to VoiceOver when the turn lands. It is rounded half away from zero, exact ties included (the
  Antarctic in 1888, one row of 40 cells, reads +0.18 °C), and it is the number Snuggery's Ask reads in
  the snapshot's ask rows (`north64AnomalyC`, `south64AnomalyC`; DESIGN §22 L-2, L-3).
- **About** from `assets/about.json`, every placeholder filled from the snapshot, the credit line
  first under "Sources and citations" (then the climatology's attribution and source block), the count of cells beyond ±4 °C, the sources with citations and addresses as plain text,
  NASA's non-endorsement line, Natural Earth, Archivo's OFL, and "This copy" as label: value lines; five
  taps on the version line show the frame-time readout. The legend's caption and the top bar's stamp
  (`Data to July 2026, archived copy`, one line) are keys into it.
- **The opening** on the first launch: 1880 to the last complete year at 8 a second, the stripes
  written behind the index, one chip; any touch, key or wheel ends it and writes the rest (a touch on
  the Earth opens no card); stored before it starts; never under Reduce Motion, in focus mode, or
  twice. Then, once per install, one hint: `Tap any place for its own line since 1880.`
- **Focus mode** (DESIGN §10): the Earth, its legend (the bar and the caption: the owner, plan 0012,
  "Full screen should not remove scale"), the stripes track with ‹ ▶ › and the step's name; everything
  else hidden and inert, the legend's switch row included, back on the ghost key ("Show the controls
  and the color scale") or Escape; entered by ART's "what stays" key, left by the ghost key or Escape; focus
  moves only after a keyboard entry; remembered; the Earth glides to its new seat (radius 187.2 px).
- Hiding the page stops play and the opening; Escape closes About, else the cell, else focus mode.
- Every key has a pressed state (a 14 % plate of its own ink, the play ring filled; a pointer-set
  `.down` class, so a touch shows it at once) and, for a hovering pointer only, a hover state (full ink,
  or a 7 % plate behind an icon key); the track's frame goes `--ink-2` on hover and `--ink` pressed.
  All gray; `:focus-visible` stays the 2 px ring. The switches' underline moves by `transform`. The
  browser's bar takes `--page` (`theme-color` per scheme). GISS, GISTEMP, Archivo, Natural Earth and
  the card's place name are `translate="no"`.

## The screen at 390 × 844

Top bar 44 (the name, the release stamp in one line, About) · the Earth panel (the gray card: the top
strip 44, the canvases, notices and the pole chip, the tap card above the legend, the legend at its
foot, 65 px; 79 in Last 24 months) · the year row 56 · the stripes track 64 · the controls row 48 · the bottom inset. At 700 px
and wider the legend, year row, track and controls move to a 380 px right column and the Earth takes
the whole panel. The legend's height is measured per time list with its longest caption and its longest
beyond-count lead, so the globe never moves from step to step (a switch between Annual and Last 24
months moves its center by 7 px at 390). The card docks under the controls there. In landscape the side gutters,
About and the card clear a notched iPhone's sensor housing (`env(safe-area-inset-left/right)`), and a
docked card's foot clears the home indicator's inset. Focus mode: one column of the Earth
(732 px tall at 844), the track and the controls row.

## Run it locally

```bash
cd Template/warming-world
python3 -m http.server 8000         # then open localhost:8000 in a browser
```

The tools (Node 26, no dependencies, except Playwright for `shoot.mjs`):

```bash
node tools/check.mjs                 # the static checks and the ZIP, as build-zips.yml builds it
node tools/test_decode.mjs           # js/data.js against tools/ref/snapshot_ref.json and Node's zlib
node tools/test_proj.mjs             # the projections against the design's formulas
PLAYWRIGHT_MODULE=<playwright>/index.mjs node tools/shoot.mjs   # the scenes, both themes (≈ 9 min)
SCRUB=0 …                            # without the 100-second three-speed scrub
SCHEMES=none …                       # only the once-scenes
```

`shoot.mjs` writes every scene's picture to `tools/.work/shots/` (gitignored) and keeps `screenshots/card-{light,dark}.png`
(780 × 1 688, 2025 over the North Pacific with the Fairbanks card open, as ART's study; `screenshots/app.png` is the
README's two-pane composite, made in the private repository, and the script never writes it),
`focus-{light,dark}.png`, `arctic-dark.png`, `about-light.png` and `opening-light.png`. Snuggery's own copy has no
server: it serves the folder over its own scheme, and the app only ever `fetch()`es its own files.

## Code map

| File | Bytes | Holds |
| --- | --: | --- |
| `index.html` | 10 143 | the page; every control is a `<button>` with a label; the card, About and the ghost key; `theme-color` per scheme |
| `style.css` | 19 199 | ART's gray tokens (both themes), Archivo by `@font-face`, the grid, the switches, the legend, the card, About, focus mode, the pressed and hover plates |
| `js/app.js` | 62 850 | boot, state, the scheduler, play, turns and the focus glide, the poles, the opening, focus mode, About's wiring, persistence, gestures and keys, the pressed class, failure, refresh, `window.__ww` |
| `js/data.js` | 21 033 | validation (the first failure as a phrase), the indexes, inflate (native, else Global Weather's decoder), the decode queue, world.json, places.json, the polar cap's mean |
| `js/measure.js` | 7 878 | plan 0012: Difference or Absolute and the chosen baseline, in integer tenths; the climatology's check and decode (no DOM: `test_decode.mjs` imports it) |
| `js/card.js` | 20 230 | the tap card: place phrase, value, the chart drawing itself, the cell's stripes, the 24-month bars |
| `js/overlay.js` | 14 283 | the Canvas 2D layer: graticule, borders, coasts and lakes, limb or outline, places, the selected cell's frame or ring, the crosshair |
| `js/proj.js` | 12 818 | orthographic and Equal Earth forward and inverse, the view (with focus mode's glide offset), `attachGestures` (Earth's History's) |
| `js/readout.js` | 10 245 | the year row and its rolling twin, the legend and its one-line credit (plan 0012: no credit; both measures), notices, the error sentence |
| `js/track.js` | 7 843 | the stripes track: the cached instrument, the thumb, the finger, hover and the keys, the opening's written stripes |
| `js/about.js` | 9 063 | About from about.json with its placeholders filled; sources; "This copy"; the stamp's text |
| `js/earth.js` | 8 269 | WebGL2: the program, the array texture, the LUT, the draw, context loss |
| `js/util.js` | 4 708 | helpers, `richText` (proper names `translate="no"`), the `ww.*` localStorage wrapper, the two motion curves |
| `js/shaders.js` | 4 947 | the GLSL: both inverses, the cell lookup, the hatch |
| `js/ramp.js` | 4 872 | ART's nine stops, OKLab interpolation, the two scales, the LUT, the hatch grays |
| `js/units.js` | 3 746 | °C with U+2212 and U+202F, percentages, month names, cell bounds |
| **app code** | **222 127** | `check.mjs`'s budget is 223 000, the lead's ruling on the measured figure (plan 0012 3.3; 200 000 under B-2 and 192 954 B before the pass; `tools/DECISIONS.md`); over DESIGN §13's 160 000 cap, which B-2 replaced |

Copied, not imported: `inflateRaw`/`unzlib`/`inflateNative` from Global Weather's `app.js`; the
full-screen triangle, the orthographic formulas, `attachGestures` and the program helper from Earth's
History; the shape of `check.mjs` and `shoot.mjs` (and the AI-vendor list, the hit-target and contrast
samplers, the focus keys' keyboard rule) from US Quakes.

## The data, measured

`node tools/check.mjs` (sizes) and `node tools/test_decode.mjs` on 2026-10-01:

| File | Bytes | Stored in the ZIP | Note |
| --- | --: | --: | --- |
| `data/snapshot.json` | 1 151 893 | 813 476 | research build, release `2026-07/2026-08-10T06:37:42`; 171 frames, 1 056 400 B of base64; `ask` 58 976 B (V11's count), never read by the app |
| `assets/world.json` | 361 123 | | 1 420 land polygons (1 421 rings), 36 lakes (83 rings), 391 border lines; 59 389 vertices |
| `assets/places.json` | 59 509 | | 1 251 places, four tiers |
| `assets/about.json` | 6 510 | | About's prose; 8 placeholders, all filled from the snapshot |
| `fonts/` | 67 202 | 64 666 | Archivo (62 536) and its OFL |
| the frames in memory | 2 770 200 | | one `Uint8Array`, and the same bytes in the GPU's array texture |

The ZIP, built as `build-zips.yml` builds it (`node tools/check.mjs`, in the lead's pass of plan 0012
3.3): **1 263 108 B** before this file's last edit (a docs edit moves it by bytes; cap 2 000 000; the
plan's target about 1.3 MB). It stores data/ in 813 810 B, assets/ in 218 722 (with the climatology),
fonts/ in 64 666, the app code in 77 713 and the `.md` files in 80 469.

## Verified (2026-10-01, this Mac, Chromium 153 headless on SwiftShader)

- `node tools/test_decode.mjs`: all checks pass. 171 frames decode through the app's queue,
  byte-identical to Node's zlib; the copied inflater gives the same bytes; 66 reference cells (computed
  by the pipeline from GISS's integers) decode exactly, 0 differ; row 0 is the north (Fairbanks is row
  12, column 16, +2.5 in 2025); broken copies fail with their sentence ("1903 holds 16 199 cells,
  expected 16 200", "the grid is 181 × 90 cells, expected 180 × 90", "it is not valid JSON", …).
- `node tools/test_proj.mjs`: all checks pass. Orthographic round trip worst 6.84e−11 rad over 193 131
  points; Equal Earth round trip 2.66e−15 rad, forward equal to the design's formulas; extent x max
  2.7066300, y max 1.3173628; the shader's float32 6-step Newton within 1.53e−7 rad of float64; 0 of
  1 000 cell indexes differ.
- `node tools/check.mjs`: all checks pass (the ramp equals ART's table and meets DESIGN §7.1; the 20
  chrome tokens have chroma 0.00000; no URL, no vendor name). Run against a deliberately broken copy
  (a URL in a comment, a tinted gray, a moved hue, a vendor name, an extra asset) it failed all five.
- `tools/shoot.mjs`: all checks pass, both themes — the labels, means and coverage equal this file's
  own decode; 12 data pixels each in 2025 and 1880 equal its own ramp (worst channel off by 0) and 12
  no-data pixels each read a hatch gray; the open partial stripe; the fonts `loaded` before the first
  canvas text; a forced context loss restores the same pixel; play 1990 → 2000 steps by exactly one
  with the label the drawn step on all 76 frames; play 3 s gives 23 steps (24 ± 2); **the three-speed
  scrub by real touches across all 147 years — 2, 8 and 20 steps a second, 3 817, 963 and 386 frames —
  drew the step under the finger on every frame (0 differ) with its label (0 differ), all 147 steps
  drawn at each speed, and the first frame after the lift drew 2026.** Run against a copy whose drawn
  step lagged the finger by one frame, the same scrub reported 146 mismatches at each speed, so the
  check is not vacuous. Also: a tap and a real touch over Fairbanks; a replaced and a broken
  replacement snapshot; missing, HTML and wrong-`nx` snapshots and a 100-day-old one; 320, 360, 375
  and 844 × 390 without horizontal scroll.

**The polish pass** (2026-10-01; `node tools/shoot.mjs`, both themes and the scrub, exit 0, "all checks
pass", 135 checks):
- `test_decode.mjs` adds: the app's mean north of 64° N against the pipeline's `ask` rows, worst
  0.0100 °C over 171 steps (40 differ at the second decimal; the cells are rounded to 0.1 °C, the
  rows are not), 2025 +2.97 °C with the cap fully covered; About's 9 sections with every placeholder
  filled (0 unknown, and an unknown one is reported); the place phrase "with Fairbanks".
- The card on Fairbanks in 2025: "+2.5 °C" "in 2025, against this cell's 1951–1980 average"; the
  chart's name "… First year with data 1881. Lowest −3.3 °C in 1894, highest +3.6 °C in 2019.", each
  figure worked out in `shoot.mjs` from its own decode; 2025's stripe [188,92,85] equal to its ramp;
  1880 hatched; opaque `--sheet`, 1 px edge, radius 3 px, no shadow or blur; a step to 1990 updates it
  ("+0.1 °C") without drawing again. A no-data cell in 1880: "No estimate for this cell in 1880.
  First year with data: 1882." The chart drew part of its line on 3 frames, each within 0.019 of a
  constant 480 ms rate; under Reduce Motion every frame drew it whole.
- Arctic: mid-turn at 250 ms, then 72° N with the longitude kept, the key on, "Mean north of 64° N:
  +2.97 °C" (and 1880 "−0.96 °C, data cover 42 % of it"); Antarctic "+1.54 °C, data cover 93 % of it";
  a drag clears it; Arctic from the map switches to the globe; a jump under Reduce Motion.
- About: 0 placeholders left, coverage 82.7 / 89.9 / 95.1 / 99.0 / 99.2 %, 4 addresses as text and
  0 links, both citations, NASA's line, Natural Earth, Archivo's OFL, 846 of 16 019 cells above +4 °C,
  "Version: 1.0"; five taps show "frame … ms"; Escape closes it; the legend's caption opens it at
  "What the colors mean".
- Focus mode: five rows hidden, inert and `display: none`; the accessibility tree has the ghost key and
  the slider and none of the rest; panel 632 → 732 px, radius 183.3 → 187.2 px, gliding (center offset
  −37 px at 90 ms); ←, play and a tap work in it; Escape closes the card, then focus mode; by Enter the
  focus goes to the ghost key and back, ringed; a touch moves no focus; restored on reload; at once
  under Reduce Motion (0 animations); one column at 844 × 390.
- The opening: stored before it starts; at 1891, 12 stripes written and the one ahead of the index
  the page (alpha 0); a touch ends it at the year reached; waited out, 146 steps in order to 2025,
  0 jumps; not on a reload, not under Reduce Motion, not with focus stored.
- During play only the rolling year digits animate (0 other animations in 10 samples). Hidden: play
  stops and 0 frames run for 600 ms. A reload restores Last 24 months at Mar 2025 and the map at 30°,
  with nothing selected. No WebGL 2: the sentence, ‹ and play still step the year row. 125 % zoom
  (312 × 675 at DPR 2.5): no sideways scroll, the controls row on screen. Rotation keeps 1977.
- Text contrast: lowest **5.27:1** light (the stamp's second line, `--ink-3` on `--page`) and **4.62:1**
  dark (the card's footnote, `--ink-3` on `--sheet`, ART's floor) over 129–130 rendered texts in each
  theme; canvas pairs lowest the same; place labels on their halo 13.44. Hit targets: 35 controls in
  4 states, all ≥ 44 × 44 px.
- The three-speed scrub again: 2, 8 and 20 steps a second, 3 839, 945 and 381 frames, 0 frames where
  the drawn step was not the step under the finger, 0 where the label was not the drawn step, 147 of
  147 steps drawn at each speed.

`__ww.perf()` (SwiftShader, a trend only): a step change costs about 0.0–0.1 ms of main thread (earth
draw submit median 0 ms, p95 0.1; frame total p95 0.2–0.4 ms) and never touches the overlay; a globe
drag's overlay rebuild has a median of 0.7–0.8 ms, p95 0.9–1.1 ms (about 9 700 of 59 389 vertices
stroked). First boot in a cold page: ready in 717 ms, every frame resident after 336 ms; a warm page:
63 ms and 49 ms. GPU time is not in these numbers.

**The QA pass** (2026-10-01; DESIGN §20; `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs <scratch>`,
both themes and the scrub, exit 0, "all checks pass", 153 checks, 0 failed):
- The selected cell's mark, at 0°, 45°, 64° and 80°: on the globe at zoom 1 a frame for 0–2° (cell
  4.79 px) and 45–47° (4.52 px), a ring for 64–66° (2.7 px) and 80–82° (1.0 px); on the map at zoom 1 a
  ring for all four (2.08 to 0.71 px); on the map at zoom 3 frames for 0–2° (6.23 px) and 45–47° (5.34
  px). In every case the WebGL pixel at the center equals this file's ramp for the cell's value (worst
  channel off by 0), the overlay is empty at the center and out to the cell's edges, and the mark's
  opaque ink lies on all four rays (frames 3.0–5.0 px out for edges at 2.3–4.2 px; rings 8.5–8.75
  px). **Run against a copy drawing the old centered outline, the same check failed in all ten
  cases**, with the cell's center covered (overlay alpha 242–255) in six, so it is not vacuous.
- Pressed and hover, with a mouse, in both themes: About, Arctic, the stamp, Map, Last 24 months, the
  legend's caption, ‹, the focus key and ▶: every state a gray (light: rest `rgb(79, 79, 79)`, hover
  `rgb(22, 22, 22)`, pressed plate `color(srgb 0.086 0.086 0.086 / 0.14)`; ‹ hover plate at 0.07), hover
  ≠ rest, pressed ≠ hover, focus the `solid 2px` ring with no plate. The track's frame: rest
  `rgb(138, 138, 138)`, hover `rgb(79, 79, 79)`, pressed `rgb(22, 22, 22)` (light). A held touch
  (CDP) shows the 14 % plate on About, Arctic and ›. Chromium's emulated touch never sets `:active`
  (probed at 0–600 ms), which is why the pressed state is the pointer-set `.down` class.
- The legend: caption 13.6 px (one line), credit 13.6 px (one line; in About since plan 0012), legend
  65.3 px at 390 × 844 (was about 108); inside its reserve at 320 (65 ≤ 79, 79 ≤ 79, 79 ≤ 79 for a year, the partial year and a
  month), 360 (65 ≤ 65, 65 ≤ 65, 79 ≤ 79) and 375 (65 ≤ 79, 79 ≤ 79, 79 ≤ 79). Before the reserve took
  the beyond-count lead into account, the partial year's legend at 320 was 79 px over a 65 px reserve.
- The stamp: one line, 44 px tall, "July 2026 release, archived copy" (since the review pass "Data to
  July 2026, archived copy", DESIGN §21 R-14). `theme-color` light `#f5f5f5`,
  dark `#1f1f1f`, each that theme's `--page` (also `check.mjs`; a copy with `#1f1f20` failed it).
- The underline: `matrix(30, 0, 0, 1, 44, 0)` on Map, `transition-property: transform`, left 0, width 1 px.
- `translate="no"`: 0 proper names left bare in the card (the place), the legend (3) and About (37).
- Place labels at zoom 1, every 30° at 20° N: globe 5 4 4 6 8 10 9 10 15 12 8 7, map 11–13; over
  Europe 10 at zoom 1, 30 at zoom 1.5.
- Unchanged and still passing: the three-speed scrub (2, 8, 20 steps a second; 3 811, 962 and 382
  frames; 0 frames where the drawn step was not the step under the finger, 0 where the label was not
  the drawn step, 147 of 147 steps drawn at each speed); text contrast lowest 5.27:1 light and 4.62:1
  dark over 171 texts; 35 controls ≥ 44 × 44 px in 4 states; every scene of the core and polish passes.

**The review pass** (2026-10-01; DESIGN §21; two reviewers' findings after the QA pass):
- `build_all.sh --offline` (venv python) after the About prose edits in `build_static.py`: exit 0,
  `verify_static: all checks passed`, `verify_snapshot: all checks passed`; sha256 before and after
  differ for `assets/about.json` only (6 588 B); `places.json`, `world.json`, `CREDITS.txt`,
  `data/snapshot.json`, `tools/ref/snapshot_ref.json` and the four credits fragments are byte-identical.
- `node tools/check.mjs`: all checks pass, including the new SI-spacing check (15 files): app code
  192 328 B (budget 200 000), ZIP 1 166 445 B (cap 2 000 000).
- `node tools/test_decode.mjs`, `node tools/test_proj.mjs`: all checks pass.
- `SCREENSHOTS=1 node tools/shoot.mjs <scratch>` (both themes, the scrub): exit 0, "all checks pass",
  165 ok, 0 FAIL. New checks: the card's cell line unbroken at 426 points on 142 segments (Fairbanks),
  with the key in the labels row; the footnote for 2025, 2026 (`Mean of at least 6 of its 7 months
  (Jan–Jul).`) and July 2026; the ghost key 4 px from the panel's right edge and top, `absolute`,
  44 × 44; the pole reading in the live region once the turn lands; a real tap on the chart leaves
  2025 and a real drag across it scrubs to 1930; a real double-tap zooms 1 → 2.00, a second goes home
  (zoom 1, latitude 20°), neither selects; the touch that ends the opening opens no card, the hint
  follows and the next touch clears it and selects; the stamp `Data to July 2026, archived copy`; the
  notices `New data: to July 2026` and `The new data file could not be read: it is damaged. Still
  showing data to July 2026.`; About's rendered text has no plain space before °C, km or %. **Run
  against a copy with the old haloed label and the old ghost-key rule, the line check failed on 8
  segments (2001–2005, 2013, 2022, 2023) and the ghost check found it `relative`, 350 px from the
  right edge**, so neither is vacuous. Unchanged: the three-speed scrub (0 differ at 2, 8 and 20 steps
  a second, 147 of 147 steps), text contrast lowest 5.27:1 light and 4.62:1 dark (now the card's
  footnote), 35 controls ≥ 44 × 44 px in 4 states.
- Probes of my own (Chromium, not phone evidence): at DPR 3 the track and legend canvases are 1 074
  device px for 358 CSS px, the overlay 1 170 for 390, the chart 1 044 for 348, the WebGL canvas 780
  for 390 (capped at 2); the strip's ground is `--card` over a zoomed globe in both themes (pictures:
  zoom 3 over Europe); with two months doctored past ±1.5 °C the caption reads `…on a ±1.5 °C scale,
  2 beyond it`; switching to Last 24 months with a card on 8–10° S, 12–14° E leaves the cell at y 228,
  above the card's top at 322.

Declined from the review, then done in the lead's pass (below): the ask rows' clause for NASA's AI
guidance, `north64AnomalyC` from the displayed tenths, and the plain space in `CREDITS.txt` and the
snapshot's attribution. Still declined: "Estimates cover" in the year row
and "Data:" for About's first line (owner calls; §9 fixes the wording); "(read through the Internet
Archive)" after the citation (the next line in About says it); the cheaper resume check (correct as
is; added to the phone checks); a pointed end on the stripes for clipped steps (the caption counts
them; none clips today).

**The lead's pass** (2026-10-01; DESIGN §22; the final reviewer's should and nits, and the pipeline items
the builders could not reach):
- `./build_all.sh --offline --twice` (from `scripts/warming_world`, venv python): exit 0. V11 `ask 177 rows
  ≤ 200, 58,976 B ≤ 70,000`; V13 `769 strings NFC, no control characters, no AI vendor names, no
  statement attributed to NASA, U+202F before every °C, km and %`; `verify_static: all checks passed`,
  with `the area with data 0.3820 in 1955, 0.9266 in 1957 (prose: 38 % and 93 %, as the Antarctic reading
  prints them)` and `CREDITS.txt: the pinned attribution verbatim (U+202F before °C, …)`;
  `verify_snapshot: all checks passed`, with `ask pole means: all 342 north64AnomalyC and south64AnomalyC
  values (171 rows) equal the app's capMean recomputed from the shipped frames (0 null); 3 exact ties (a
  cap with values in one row) rounded away from zero; every other mean lies at least 3.46e-04 of a
  hundredth from a tie` and `ask notes: the source note carries NASA's AI clause and the newer table
  (2026-08)`; `byte-identical: 10 files`. Then `refresh.py --source research --ref`: exit 0, and
  `verify_snapshot.py`: `all checks passed`; the refresh left the snapshot, the reference and the
  fragment byte-identical.
- sha256 before and after: `assets/world.json` and `assets/places.json` byte-identical. Changed:
  `data/snapshot.json` (1 147 429 → 1 151 893 B: the U+202F before km and °C in `source.detail`, the
  attribution and the grid source's name; "Public domain" capitalized; the three notes; `north64AnomalyC`
  from the tenths, 40 rows moved by 0.01; `south64AnomalyC` in all 171 rows; `generatedAt`), `CREDITS.txt`
  (7 703 → 7 713 B: U+202F in five places, three licenses capitalized, the Archivo line rewrapped so
  `658 596 B` is no longer split), `assets/about.json` (6 588 → 6 510 B: the Antarctic sentence),
  `tools/ref/snapshot_ref.json` (its `generatedAt` only, now the demo's) and the four credits fragments.
- `node tools/check.mjs`: all checks pass; the SI check now reads 17 files (`CREDITS.txt` and the
  snapshot added; run on the old copies it flags four lines of `CREDITS.txt` and the snapshot); app code
  192 954 B (budget 200 000).
- `node tools/test_decode.mjs`: all checks pass. `the pole readings against the 171 ask rows: 342 means
  north and south of 64°, 0 differ at the second decimal`; `23 cap readings with values in one row only
  round as the integers do (0 differ); 3 of them are exact ties, rounded away from zero (1888 south of
  64°, 40 cells: +0.18 °C)`. The old `capMean` fails the second (1888 +0.17, 1894 0.00, 1896 +0.53), and
  the snapshot built before the tie rule fails the first (3 differ). `node tools/test_proj.mjs`: all
  checks pass.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs <scratch>` (both themes, the scrub): exit 0,
  "all checks pass", 167 ok, 0 FAIL. New: `844 × 390, the housing on the left (insets 59/0, bottom 21, by
  CDP): About's text 59–538 and ✕ 810–822, the docked card 480–828 with its foot at 369 (≤ 369), focus
  mode's card 59–836; 16 boxes inside 59–844`, the same on the right (About's ✕ 757–769, the card
  480–785, focus mode's card 8–785, inside 0–785), and `About, opened by a real tap, takes focus on its ✕
  without the keyboard ring`. Unchanged: the three-speed scrub (3 801, 955 and 382 frames, 0 differ, 147
  of 147 steps at each speed), text contrast lowest 5.27:1 light and 4.62:1 dark over 180 texts, 35
  controls ≥ 44 × 44 px in 4 states, the Arctic `+2.97 °C` and Antarctic `+1.54 °C, data cover 93 % of it`.
- Pictures: `screenshots/about-light.png` retaken (1 152 pixels differ from the old one, all in x
  672–775, y 0–95: the ring is gone from ✕); `opening-light.png` differs in 537 pixels of the rolling
  year digit (x 122–145, y 1387–1428), the moment of capture; `app.png`, `arctic-dark.png` and
  `focus-{light,dark}.png` are byte-identical.
- Probes of my own (Playwright, the CDP override, 844 × 390): before the CSS change, with the housing on
  the left About's title and text started at x 16 and focus mode's card at 8; with it on the right
  About's ✕ was drawn at 810–822 and the docked card ran to 828 (the housing starts at 785); with a
  bottom inset of 21 the docked card's foot was at 379.5 of 390, because the column's two spacer rows
  shared the free 21 px. After: 59, 59, 757–769, 785 and 369.

## Plan 0012, package 3.3 (2026-10-06): version 1.1

What changed (the reasons are in `tools/DECISIONS.md`, which does not ship):

- **Absolute** beside Difference (the legend's first row; remembered). Each cell is its 1951–1980
  average 2 m air temperature from ERA5 (`assets/climatology.json`, built by
  `tools/climatology/build_climatology.py` from WeatherBench 2's 1990–2019 climatology, moved to
  1951–1980 by GISTEMP's own anomalies) plus GISS's anomaly for the step: an estimate, printed to the
  whole degree on the card, on a fixed −60 … +40 °C sequential scale with its own legend. The year
  row gives the climatology's area mean plus GISS's global mean, with ±0.5 °C; the pole chip, the
  climatology's mean over the whole cap plus the cap's mean anomaly. The card's sentence adds GISS's
  own anomaly against 1951–1980, whatever Base says. A month uses its own month's average, the partial
  year the average of its months so far.
- **Base** in Difference: a sheet of two years (`From ‹ › to ‹ ›`) from the first to the last complete
  year, default GISS's 1951–1980. Each cell is re-expressed against its own mean over the span, where
  it has a value in two thirds of the years (else no data); GISS's global means and the stripes follow;
  the bracket under the stripes moves and names the span; every difference on screen says
  `vs. <span>`. Single months stay against 1951–1980 (the app holds only the last 24 months), so in
  Last 24 months the key reads `Base 1951–1980`; in Absolute the key's name and the sheet say the map
  does not use the span. A one-year span is named as one year.
- **Focus mode keeps the legend's bar and caption.** The switch row hides.
- **The credit left the legend** for About's "Sources and citations" (HOUSE §4.15; change list item 1).
- The shader adds the climatology (an R16I array texture, 14 layers) or subtracts the baseline (an R16I
  texture) in integer tenths, so the card, the counts and the pixels agree to the digit; a step change
  is still one uniform and one draw.

Measured (2026-10-06, this Mac):

| What | Before (1.0) | Now (1.1) | Command |
| --- | --: | --: | --- |
| App code (index.html, style.css, js/) | 192 954 B | 220 396 B, **over the 200 000 B budget** | `node tools/check.mjs` |
| `assets/climatology.json` | — | 101 349 B (cap 120 000) | `node tools/check.mjs` |
| `assets/about.json` | 6 510 B | 9 734 B | `ls -l` |
| The ZIP, as build-zips.yml builds it | 1 172 286 B | 1 260 516 B before this section (cap 2 000 000) | `node tools/check.mjs` |
| GPU, beyond the frames | 1 024 B (LUT) | + 486 000 B (climatology 453 600, baseline 32 400) + 4 096 B (Absolute's LUT) | `earth.js` `stats()` |
| CPU | the frames | + 453 600 B (the climatology in tenths) + 32 400 B (a baseline) | `measure.js` |

- `node tools/check.mjs`: every check passes but the app-code budget. `node tools/test_decode.mjs`: all
  pass, 33 checks, the new ones the climatology's decode against Node's zlib (0 cells differ), its
  global means against the build's, the partial plane, Absolute and a 1991–2020 baseline against sums
  written in the test. `node tools/test_proj.mjs`: all pass.
- `tools/shoot.mjs` (both themes; numbers in DECISIONS' record and the lead's run): Absolute's pixels in
  the test's own temperature ramp (0 wrong of 12 data cells, worst channel off by 0) in 2025 and in the
  newest month; a 1991–2020 baseline's pixels at the anomaly minus each cell's own mean (0 wrong); a
  month against 1951–1980 with a baseline chosen; the sheet by real touches; the scale in focus mode;
  a reload keeping Absolute and a baseline; real-touch scrubs at 8 steps a second in Absolute and
  against 1880–1900 with the drawn step under the finger on every frame (0 differ).
- Driven by hand, 390 × 844, DPR 2, light and dark: Chromium (CDP touches) and WebKit (Playwright's
  taps; its drags by mouse, the only drag it offers): Absolute, Fairbanks' card (`−2 °C`), Base by
  taps (1953–1977), scrubs in both measures with 0 frames off the finger, focus mode keeping the scale,
  no console errors. WebKit draws the integer textures (the same pixel as Chromium).

Phone checks owed (plan 0012): the R16I textures and the integer shader on iOS 18 WebKit (a GPU path no
earlier pass used); a scrub in Absolute and with a baseline at three speeds by a finger; the stepper
held to repeat, and lifted after the sheet has grown under the finger; the Base sheet over the globe in
landscape; Absolute's sand and violet ends on the phone's screen in both themes; memory after switching
measures and spans for 5 minutes.

## Honesty caveats

- In Difference every value is an anomaly against each place's 1951–1980 average, or against the span
  Base names, never a temperature; the legend's caption says so on every step and names the span. In
  Absolute every value is an estimate: an ERA5-based 1951–1980 average plus GISS's anomaly, never a measured
  temperature; the caption, the year row's ±0.5 °C, the card and About say so. A single month is
  always against 1951–1980, because the app holds only the last 24 months.
- The annual maps and their rounding are this app's (9 of 12 months; the partial year three quarters
  of its months). GISS publishes monthly maps only. The global means and the stripes are GISS's own.
- The partial year is labeled partial in the year row, its stripe is open, and the legend's caption
  names its months.
- The colors are fixed at ±4 °C (the map) and ±1.5 °C (the stripes) and printed; values beyond take the
  end colors, and the legend counts the cells beyond for the step on screen.
- The coverage is never printed as 100 % while a cell has no value (January 2025 reads 99.7 %).
- The demo snapshot is a live build: GISS's September 2026 release (data to August 2026), read by a
  GitHub runner on 2026-10-01 with `build-warming-world.yml`, which rebuilds it every January and on
  demand; the top bar's stamp says when it was made. A research build — the sha256-pinned Internet
  Archive copies, `./build_all.sh --source research`, used while data.giss.nasa.gov refused every
  connection from the build machine — says "archived copy" in the stamp at every width from 360 px
  (below it, the legend's caption ends "from an archived copy"), names the Internet Archive under
  About's "This copy", and says when its global means come from a newer table than its map. The
  monthly refresh replaces either.
- The stripes are clipped at ±1.5 °C like the map at ±4 °C; none is today, and the caption counts any
  that are. The pole readings are this app's area-weighted means of the map, said so on the chip and
  in About.
- Snuggery's Ask, an on-device model, reads the snapshot's ask rows. Their source note says answers
  drawn from them are this app's reading of GISS's published data, which NASA has not reviewed and is
  not responsible for (NASA's guidance for AI products), and no row attributes a statement to NASA.
  Their pole means are the chip's own numbers.
- The narrow no-break space is not in the Archivo subset and comes from the system face.

## Phone checks owed (device matrix)

Frame time while turning the globe at DPR 2 and DPR 3 (the WebGL canvas capped at 2, the 2D canvases
at 3 since R-9); play from 1880; the scrub at three
speeds by a real finger; first paint and every frame resident after a cold launch; memory after 5
minutes; background and return (context loss); a Shortcut refresh while open; the tap card's first
frame (SwiftShader delays it about 300 ms while it composites the new layer); the Arctic turn's frame
time (the overlay is rebuilt each frame); focus mode's glide; the opening's 18 s at 8 a second; whether `fontStretch`
(set through the canvas `font` shorthand) narrows canvas text on iOS 18 as it does in Chromium
(measured: 173.1 → 154.6 px for the stripes' caption).

Added by the QA pass: the pressed plate under a real finger on iOS 18 (the `.down` class is set on
`pointerdown`; Chromium's emulated touch showed it, WebKit's has not been seen); hover on an iPad with
a trackpad (none on a phone, by `(hover: hover)`); the selected cell's frame and ring at DPR 3 (the
overlay draws them at min(DPR, 3) since R-9) and whether the 9 px ring reads well under a fingertip's
last position; Safari's
toolbar taking `theme-color` in both schemes; Safari's page translation leaving the `translate="no"`
names alone; the 7 px move of the Earth's center on Annual ↔ Last 24 months.

Added by the review pass: the 2D canvases at DPR 3 (text beside DOM text, and the overlay's redraw
time while dragging the globe at zoom 2: it grew 2.25× in pixels; back to a cap of 2 if it drops
frames); landscape on a notched or Dynamic Island iPhone, both rotations: whether Snuggery's
WKWebView extends under the side insets at all (if it does not, `env(safe-area-inset-*)` reads 0 and
the plain gutters apply), and how the real housing sits against the gutters. Chromium does show the
insets: CDP's `Emulation.setSafeAreaInsetsOverride` sets `env(safe-area-inset-*)` once a page declares
`viewport-fit=cover`, as this one does, and `shoot.mjs`'s landscape scene checks 59/0 and 0/59 with a
bottom inset of 21 (DESIGN §22 L-1); a horizontal drag on the card's chart against a
vertical scroll of the card (`touch-action: pan-y`); double-tap zoom against iOS's own double-tap
handling (`touch-action: none` on the Earth); the resume check, which re-reads and parses the 1.1 MB
snapshot on every return to the app (jank on resume).

Added by the lead's pass: the Antarctic chip in 1888, 1894 and 1896 (+0.18, +0.01 and +0.54 °C, exact
ties) on iOS's JavaScript engine, whose cos may differ from V8's in the last bit (macOS's libm and V8
already differ in 6 of the 90 row weights, none in a cap); the tie rule and the 3.46e−4 margin of every
other mean should make that irrelevant, but no phone has shown it; the docked card's foot above the
home indicator in landscape.
