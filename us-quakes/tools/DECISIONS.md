# US Quakes — decisions (tools/, not shipped)

The record of each pass's calls. `ART.md`, `NOTES.md` and `DESIGN.md` ship in the ZIP and say only what
is true of the app; the reasoning and the measurements behind a change live here.

## 2026-10-06 — plan 0012, package 3.1: the pan lag, then the text cut (1.0 → 1.1)

The owner: *"Us quakes: moving around the map does not really work - way too laggy."*

### How it was measured

`tools/frametime.mjs` (new; `PLAYWRIGHT_MODULE=… node tools/frametime.mjs`). 390 × 844 CSS px, DPR 2,
Playwright 1.63, Chromium (SwiftShader) and WebKit, light. Three states: Live Month and History All
at M 2.5+ (403 421 rows), both on the Lower 48 at twice the chip's scale, and California at twice its
chip (the densest faults). The Lower 48 is zoomed in because at the chip's own scale the view meets the
edge it is held inside about 70 px east, and a clamped pan follows no finger. Four gestures:

- a one-finger pan, three sweeps of 290 px in 3 s, at 60 Hz;
- the same finger "locked" to the frames, one event after each drawn frame, as a phone delivers touches;
- a fling (220 px in 100 ms);
- a two-finger pinch (60 → 300 px apart in 1 s, and back).

Chromium is driven by CDP touches. WebKit is driven by the mouse for one finger, and by synthetic touch
PointerEvents for the pinch, because Playwright's WebKit has no touch input but a tap. For each gesture
it records the rAF intervals; the app's own frames split by part; time inside layout and style reads;
long tasks (Chromium only); a Chromium trace summary; and the map's travel against the finger's.
Headless engines are not a phone. This machine's WebKit rasterizes on its GPU, and Chromium
rasterizes on SwiftShader, on the CPU. **The phone is unmeasured** (matrix row for the owner, below).

### What it found (before)

1. **The map did not follow the finger.** `map.js` read each pointer against `#over`'s
   `getBoundingClientRect()`. During a move, `#over` is the canvas being moved by a CSS transform, so a
   finger was measured against the drawing it was dragging. Each frame the transform had moved took
   that movement back off the next delta, until the 250 ms redraw reset the transform and the map
   jumped. In WebKit, the phone's engine, the map/finger ratio was 0.82–0.85 for the 3 s pan, 0.875–0.925
   for the frame-locked pan and 0.50–0.67 for the fling. In a probe at the California chip with a frame
   between every event, the map moved 52 px for a 160 px drag, and moved backward between some steps.
   This is the "does not really work".
2. **Every 250 ms of a move, all four static layers were drawn in one frame** (`base`, `relief`,
   `lines`, `over`). On top of that, `#gl` drew all its points every frame. The lines are the cost.
   Over California's faults, one `#lines` draw is about 65–90 ms of raster in WebKit (faults off: none;
   dashes and joins make no difference), and about 600 ms in SwiftShader (whose 2D raster is pathological
   here). WebKit, California pan: 13 of 162 frames over 33 ms, p95 62 ms. Chromium: p95 250–600 ms in
   every state. At 400 000 points, the per-frame points draw alone cost SwiftShader 50 ms a frame.
3. Not the cause: layout and style forced by reads were 1–8 ms in a whole gesture. There are no
   per-frame buffer uploads: `gl.js` uploads only in `setData` (`bufferSubData`, and `bufferData` for the
   draw order), when the data changes. The points are projected in the vertex shader, on the GPU. The 2D
   projection and decimation are inside `trace()`, so their cost is inside the base and lines timings. The record strip, the
   A–A′ plot and the sheet are not drawn during a map move. History's sheet is drawn once, at the
   settle.

### What changed (`js/map.js`, `js/app.js`, `js/gl.js`, `js/util.js`, `style.css`)

- **Pointers are read on `#map`**, the panel, which never moves. Its rect is read once when each finger
  lands, before any write. A pointerdown counts only on `#map` itself or one of its five canvases, so
  the chips, keys, foot and the legend button's ramp canvas keep their own clicks. `touch-action: none`
  is now on `#map` and its canvases, so a second finger that lands where a moved canvas has left still
  pinches the map, not the page. The capture listener that closes a chip mark, Layers or the legend card
  moved to `#map` with the same filter.
- **A move costs a transform of what is drawn.** During a pan, pinch, fling or eased move, every layer
  but the relief is moved by its CSS transform. The relief is four textured quads, so it is drawn again
  each frame. `#base`, `#lines` and `#gl` are drawn past the panel's edges by a margin `MG`:
  - `MG` is half the panel's short side, at most 196 px and at most 8 Mpx a canvas. At 390 × 844 it is
    189 px, so each canvas is 1 536 × 2 356 device px, 14.5 MB against 5.0 MB.
  - `MG` is a multiple of 7, so the 7 px diagonal hatching past the basemap's edge keeps its phase.
  - The margin canvases sit at (−MG, −MG). The draw functions get a view whose w and h include the
    margin, so they need no change.
- **A layer is drawn again during a move only when it must:**
  - when its drawing no longer covers the panel;
  - when it is shown at under ½ or over 2× the scale it was drawn at;
  - for `#over`, drawn to the panel's edge, only when its scale is off by half, so labels and triangles
    keep their size.

  At most one layer is drawn a frame, so the cost is spread. Everything is drawn whole once the move
  settles.
- **During a pan, `#base` and `#lines` shift instead of redrawing.** The layer moves on its own canvas
  by whole device pixels (`globalCompositeOperation = 'copy'`, the canvas drawn onto itself), and only
  the strips it uncovers are drawn. Each strip gets a view of its own, so the geometry is culled to it.
  The fraction of a pixel stays in the CSS transform. Checked against a whole redraw at the same view
  mid-pan: the composited picture differs in 897 pixels by at most 2/255 (WebKit), and in 30 seam
  pixels (Chromium).
- **Fewer reads and writes per frame.** CSS tokens are read once a color scheme (`cssVar` caches them
  and clears on the scheme's change event). The GL canvases write their CSS size only when it changes,
  and so do the scale bar's width and words. `moveStatics` writes a transform only when it changes.
- **The readout for the phone.** Five taps on About's version line show a second line: *last move N
  frames · X ms median · Y p95*. These are the intervals between the app's frames while the view moved.
  A frame more than 200 ms after the last is a finger at rest, not lag, and is left out. On the phone
  this is the figure to compare with the script's `raf` line.

### After (the same script, the same machine)

| engine | state | gesture | rAF median | rAF p95 | frames > 33 ms | map/finger |
| --- | --- | --- | --- | --- | --- | --- |
| WebKit | Live Month | pan | 20 → 20 | 22 → 22 | 0/186 → 1/183 | 0.817 → 1.000 |
| WebKit | Live Month | locked | 20 → 20 | 22 → 22 | 0/73 → 0/73 | 0.875 → 1.000 |
| WebKit | Live Month | fling | 20 → 20 | 22 → 22 | 0/116 → 0/115 | 0.668 → 1.000 |
| WebKit | Live Month | pinch | 20 → 20 | 22 → 22 | 0/138 → 2/130 | ×5 → ×5 |
| WebKit | History All | pan | 20 → 20 | 22 → 22 | 1/186 → 2/182 | 0.831 → 1.000 |
| WebKit | History All | locked | 20 → 20 | 22 → 22 | 0/73 → 1/73 | 0.875 → 1.000 |
| WebKit | History All | fling | 20 → 20 | 22 → 22 | 0/116 → 1/115 | 0.5 → 1.000 |
| WebKit | History All | pinch | 20 → 20 | 23 → 22 | 0/138 → 2/129 | ×5 → ×5 |
| WebKit | California | pan | 20 → 20 | 62 → 22 | 13/162 → 1/182 | 0.848 → 1.000 |
| WebKit | California | locked | 20 → 20 | 64 → 22 | 6/82 → 1/69 | 0.925 → 1.000 |
| WebKit | California | fling | 20 → 20 | 22 → 22 | 1/113 → 1/116 | 1.0 → 1.000 |
| WebKit | California | pinch | 20 → 20 | 23 → 27 | 3/130 → 6/124 | ×5 → ×5 |
| Chromium | Live Month | pan | 16.7 → 16.7 | 283 → 16.8 | 43/225 → 6/222 | 0.967 → 0.983 |
| Chromium | Live Month | locked | 16.7 → 16.7 | 250 → 16.8 | 18/137 → 0/129 | 0.925 → 0.975 |
| Chromium | Live Month | fling | 16.7 → 16.7 | 200 → 16.8 | 10/56 → 2/135 | 0.5 → 0.833 |
| Chromium | Live Month | pinch | 16.7 → 16.7 | 100 → 100 | 14/172 → 11/128 | ×4.93 → ×4.93 |
| Chromium | History All | pan | 16.8 → 16.7 | 300 → 16.8 | 61/236 → 8/221 | 0.983 → 0.983 |
| Chromium | History All | locked | 16.7 → 16.7 | 283 → 16.7 | 21/112 → 0/129 | 0.95 → 0.975 |
| Chromium | History All | fling | 16.7 → 16.7 | 233 → 16.8 | 9/72 → 2/133 | 0.5 → 0.833 |
| Chromium | History All | pinch | 16.7 → 16.7 | 133 → 100 | 23/162 → 11/126 | ×4.93 → ×4.93 |
| Chromium | California | pan | 16.7 → 16.7 | 600 → 16.8 | 60/218 → 7/222 | 0.983 → 0.983 |
| Chromium | California | locked | 16.7 → 16.7 | 583 → 16.7 | 19/102 → 0/129 | 0.525 → 0.975 |
| Chromium | California | fling | 16.7 → 16.7 | 550 → 16.8 | 9/33 → 2/123 | 0.5 → 0.833 |
| Chromium | California | pinch | 16.7 → 16.7 | 433 → 100 | 35/140 → 11/126 | ×4.93 → ×4.93 |

How to read the table:
- The *frames > 33 ms* after the fix include the settle frame, which ends every gesture's window.
- Chromium's map/finger falls short of 1 by its last move event. Chromium coalesces pointer moves to the
  next frame, and the reading is taken just before the lift.
- WebKit, which rasterizes on this Mac's GPU, already kept its frames before the fix. What it lacked was
  a map that followed the finger.
- **What is left:**
  - A pinch that doubles the scale draws `#lines` whole at the new scale, over the margin's 2.4× area.
    That is about 100 ms in WebKit over dense faults, and California's pinch went from 3 to 6 long frames.
  - In Chromium, each lines draw is SwiftShader's 600–900 ms of raster wherever it happens.

All runs are in `tools/.work/frametime/` (not shipped). The table is the `after` run. The `final` run,
on the shipped build (the legend's ramp canvas excluded from the map's pointer targets, and the
`touch-action` rule folded into `#map`'s), matched it within one frame per row: every WebKit pan, locked
pan and fling at map/finger 1.00, and WebKit's p95 at 22 ms everywhere but California's pinch (28).

### The same picture at rest

`tools/.work/exp/rest.mjs` (scratch) screenshots the original build and this one in the same eight states
(Live Lower 48, History All, Alaska, California at Half, Hawaii's 1960s, a view wide enough to show the
hatching; light, and Lower 48 and Alaska dark). It diffs them pixel by pixel:

- Chromium: 47–227 pixels of 1 316 640 differ. WebKit: 396–7 346 differ, by at most 1–16/255.
- The original against itself already differs by up to 54 pixels at 17/255 (Chromium) and 5 166
  pixels at 1/255 (WebKit).
- The only larger differences are on the panel's outermost device-pixel row or column, 5–81 pixels at up
  to 108/255. There, a stroke or the hatching that crosses the panel's edge is no longer cut by its
  canvas's edge, because the canvas now runs on past it. Nothing else the app shows changed.

### The text cut (docs/plans/0012-change-lists.md, US Quakes)

- Item 1: `#credit` keeps its safety statement and loses the credits. It reads `Not a warning service`,
  described by an `.sr` hint, `Opens the sources in About.`, and still opens About at its sources.
- Item 2: the stamp says `Feed 23:17 UTC · …`.
- Item 3: the stale notice stays.
- Item 5: version 1.1.
- Item 4 (prose): the lines the list names, plus the other shipped sentences that would have been false
  after the change. These are DESIGN's wireframe credit line (line 90) and its notes table (728), and
  ART's "Not a warning service" paragraph (405–406) and its change-list record (575–576). DESIGN §5.4,
  DESIGN's alternatives entry and ART's layer table now say how a move is drawn.

### Checks changed, and why

- `check.mjs`: the version pin is now `'1.1'` (the list).
- `shoot.mjs`:
  - The Live stamp check reads `Feed` (the list).
  - `glAlpha` and the hollow-ring check read `#gl`'s pixels moved by the canvas's offset, because `#gl`
    is now drawn past the panel by the margin.
  - The accessible-name check expected `the past 30 days`. From 48 h of age the app names the window
    against the feed (`the 30 days to 2026-09-30 23:17 UTC`), and the demo's feed was six days old on
    the day of this pass. The check failed on that date, not on this change, so it now works the words
    out from the feed's time and the clock.

### Owed, and the lead's

- **The phone is unmeasured.** The matrix row needs, on an iPhone:
  - a 3 s pan over the Lower 48 and over California, a fling and a pinch, in Live and History All;
  - the readout's *last move* line after each;
  - whether the map stays under the finger;
  - memory after the five canvases' new sizes (+29 MB at 390 × 844);
  - the seams of a shifted layer, looked for during a slow pan.
- **About's version line** was left at 1.0 by this pass; the fix pass below fixed it.

## 2026-10-06 — plan 0012, package 3.1: the fix pass (QA and the reviewer)

### Musts and shoulds, taken

- **About's version is the manifest's.** `app.js` reads `miniapp.json` at boot into `A.version`, and
  About prints `Version ${A.version}`. It falls back to `assets/about.json`'s `version` only if the
  manifest cannot be read. The pipeline's file still says `"version":"1.0"` (`assets/about.json`,
  `scripts/us_quakes/content/about.json`). It is committed data, and the brief forbids changing it, so it
  was left as it is. Nothing on screen reads it while the manifest loads. `shoot.mjs` now checks
  `/Version 1\.1/`. Driven in both engines and themes: About reads "Version 1.1".
- **Without WebGL 2, the blank panel takes no gesture again.** `createMap` has `M.off`. The `!gl` branch
  sets it, and `pointerdown` returns at once. The keys under `#map` (the credit, the notices) are their
  own elements and still work. `shoot.mjs`'s no-WebGL scene now drags 144 px and double-taps, and asserts
  that the view is unchanged (s 2218.24 → 2218.24). `tools/.work/fix/nogl.mjs` does the same by CDP touch
  (Chromium) and by mouse and tap (WebKit): unchanged in both. The 1.1 build before this fix went to s
  4436 (the reviewer's run).
- **`#over` follows a pan.** `stale()` now draws `#over` again once its drawing leaves 4 px of the panel
  bare, as well as when its scale is off by half. Before, triangles, labels, the ring and A–A′ were
  missing from the uncovered part until the lift. Measured with `STATES=california,live-month
  frametime.mjs` (`tools/.work/fix/ft.log`, against the reviewer's `ft-new.log` on the build before):
  - `#over` is now drawn 114–180 times in a 3 s pan, at 0–1 ms each (WebKit) and 0.1–0.2 ms (Chromium).
  - Layout reads per pan went from 6 to about 600 (`footRects()`, for label placement around the foot),
    2–7 ms in all in a whole gesture.
  - rAF p95 is unchanged: WebKit 21–23 ms, Chromium 16.8 ms. Frames over 33 ms are unchanged within one,
    and map/finger is 1.000 in every WebKit pan, locked pan and fling.
  - Screenshots of a held pan (`tools/.work/fix/shots/*-g1-heldpan.png`) now match the settle
    (`*-g2-settled.png`) in both engines and themes: the green triangles and labels are in the
    uncovered part.
- **The Live stamp is one line.** From 3 h it read `Feed 23:17 UTC · 6 days ago, not refreshed since`,
  two lines at 390 px beside Day/Week/Month (HOUSE §4.15's must). `, not refreshed since` is gone. The
  age stays in `--ink` 700, the strip's hatched tail still grows, and from 48 h the notice over the map
  says the copy's age in full. At 390 px the stamp is now 164 × 15 px, one line. `shoot.mjs` checks for
  one line in the state it is in. With today's demo data that is the stale form ("6 days ago"). The
  wording is a taste call for the lead. The reviewer offered `· 6 d old` as another option.
- **DESIGN §3.2's credit line** now says the button reads only "Not a warning service", has the hint
  "Opens the sources in About.", and leaves USGS and Natural Earth to About.
- **Prose for the changes:** the stamp in NOTES, ART and DESIGN §3.4. `#over`'s rule in DESIGN §5.4 and
  in ART's layer table. The readout's second line in DESIGN's About entry. The comment in `frametime.mjs`
  about how each engine rasterizes. The `perfReadout` comment, which now names the `raf` line.

### Nits left

- **The `.sr` hint is read twice by VoiceOver** (it is the button's description, and a stop of its own).
  Adding `hidden` to `#credit-hint` would fix it, but it departs from the change list's markup. Left for
  the lead's OK.
- **The hatching's phase in a pan's strips.** It is not free. The hatching is anchored to the canvas, not
  to the map. A shifted layer carries the old phase with it, so a strip would need the shift so far,
  not just its own offset. It shows only past the basemap's edge during a gesture, and the settle redraws
  it whole.
