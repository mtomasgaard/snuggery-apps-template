# Flow — what was measured, and what was rejected

The research behind `../DESIGN.md` (the Flow package: the particle layer, the scrub, focus mode, SI,
the tools). Every number below names the command that printed it. The scripts are throwaway and live
in `tools/.work/` (ignored by `../.gitignore`, never committed, never shipped); each one is described
here well enough to be rewritten. If the lead wants them kept, they move to `tools/bench/` as
Warming World's did (about 46 KB, outside the ZIP).

**What these numbers are not.** Headless Chromium on this Mac (Chromium 153.0.8010.12, Playwright
1.63.0) rasterises Canvas 2D on the CPU; Playwright's WebKit 26.6 build (`playwright webkit v2359`,
installed for this research with `node_modules/.bin/playwright install webkit`) is macOS WebKit on
the Mac's own GPU. **Neither is an iPhone.** WKWebView on the owner's phone is the only evidence for
frame rate, battery and memory, and none of it is known until the owner's check (DESIGN §7.3).

Environment for every command: `cd Template/global-weather`, `PLAYWRIGHT_MODULE` set to the
scratchpad Playwright (`…/scratchpad/pw/node_modules/playwright/index.mjs`), Node v26.7.0, a
390 × 844 CSS px viewport at DPR 2 with touch, dark scheme unless stated. The map canvas is then
780 × 1 318 device px (`breakdown.mjs` prints it).

---

## R1. The snapshot, decoded in Node

`node tools/.work/inspect.mjs` — decodes every plane with Node's own `zlib` and the delta rule,
builds u and v exactly as `app.js` `values()` does (u = −s·sin dir, v = −s·cos dir), and prints:

```
grid 180×91, 41 steps, hours 0…120, planes wind.speed wind.dir temp.v rain.v cloud.v pressure.v
speed m/s: p10 2 p50 5.75 p90 11.5 p99 17.75 max 49; area-weighted mean 6.18; share < 0.5 m/s 0.45 %
RMS change of the wind vector between consecutive 3 h steps: 2.51 m/s
row 0 (lat 90): 1 distinct speed bytes, 180 distinct dir bytes across 180 columns; mean (u, v) -0.00, 0.00
row 90 (lat -90): 1 distinct speed bytes, 180 distinct dir bytes across 180 columns; mean (u, v) -0.00, 0.00
ask rows: 60; recomputed from the app's u, v: worst speed difference 0.00 m/s, worst from-direction difference 0°
Reykjavík Tue 22 Sep: 10.7 m/s from 232° (SW) → the air moves toward 52°, i.e. u 8.43 (east +), v 6.59 (north +)
zonal-mean u at 50°: 2.19 m/s
zonal-mean u at 15°: -1.51 m/s
zonal-mean u at 0°: -1.20 m/s
zonal-mean u at -15°: -4.41 m/s
zonal-mean u at -50°: 3.77 m/s
at 5.75 m/s: 62 km in 3 h (0.28 grid cells at the equator), 497 km a day
at 17.75 m/s: 192 km in 3 h (0.86 grid cells at the equator), 1534 km a day
```

What it settles:
- **The direction convention, end to end.** The puller writes `dir = atan2(−u, −v)` (where the wind
  comes FROM, `scripts/global_weather.py` `_wind_planes`) and its ask rows from bilinear u, v.
  Recomputing all 60 ask rows from the app's own u, v gives the same speed to 0.0 m/s and the same
  from-direction to the degree. So the app's (u, v) is the vector the air moves along, and a particle
  must move along +u east, +v north. The trade winds come out with u < 0 (toward the west) and the
  westerlies with u > 0, as they must. `test_flow.mjs` pins this (DESIGN §5.3).
- **The poles are one vector in 180 local frames.** Rows 0 and 90 hold one speed and 180 directions
  whose (u, v) average to zero: the same polar wind seen from each meridian. An advection that works
  in degrees of longitude divides by cos φ there; one that steps on the sphere does not (R5).
- **The field is smooth at the scale the flow draws.** A step moves the wind vector 2.51 m/s RMS, and
  a strong wind crosses less than one 2° cell in 3 h — so interpolating u and v linearly between steps
  during play is faithful to what the file says, and nothing finer exists to show.
- The demo's own `ask` table and `snapshot.sha256` are what `check.mjs` uses to prove the data
  untouched: `shasum -a 256 data/snapshot.json` prints `31c6fc84…a6ade2`, equal to the file's line.

## R2. What a frame of today's app costs

`node tools/.work/probe.mjs` (and `BROWSER=webkit …`, and `GPU=1 …` for Chromium's SwiftShader GPU
raster) calls `window.__weather.render()` and then `getImageData(0, 0, 1, 1)` on the map canvas,
which forces the browser to finish rasterising before the clock stops. Without that readback the
timer measures only the recording of draw commands (0.4–0.6 ms), which says nothing.

| Browser | Map: render + raster | Globe: render + raster | JS alone |
| --- | --: | --: | --: |
| Chromium, CPU raster (default headless) | 31.7 ms median (p90 32.7) | 20.7 ms (p90 21.1) | 0.4 ms |
| Chromium, `GPU=1` (SwiftShader) | 439 ms | 374 ms | 0.6 ms |
| WebKit 26.6, Apple GPU | 11 ms (p90 12) | 6 ms | 4 ms map, 1 ms globe |

A new step costs the same as the same step (Chromium 31.8 against 31.7 ms on the map): the step's
values are a cached lookup; the raster is the price. Chromium's JS-only loop also showed one render
of 1 046.9 ms (map, step 33): back-pressure, the canvas refusing new work until the raster queue
drains. A loop that renders faster than it rasterises stalls this way, which is why the flow must
never redraw the base (DESIGN §1.9).

`node tools/.work/breakdown.mjs` (same readback, median of 15):

```
canvas 780×1318 device px
map: everything 32.1 ms; arrows off 29.6; arrows and night off 24.9
globe: everything 20.5 ms; arrows off 19.3; arrows and night off 19.0
one full-canvas drawImage + flush: 0.2 ms
```
(WebKit: map 10 / 10 / 11 ms, globe 9 / 6 / 6 ms, the copy 1 ms; WebKit's `performance.now()` is
coarsened to 1 ms, so its rows are whole milliseconds.) The script's label says "CPU raster"; that
is true of the Chromium run only.

`bench/flow.html`'s first three numbers split the map's base (`node tools/.work/flowbench.mjs`): the
land fill, borders and coast of `assets/world.json` at the default view, three world copies, **13 ms**
(WebKit 14); the colour sheet's `putImageData` and smoothed upscale **5 ms** (WebKit 1); the same
base copied from a cached bitmap **0.2 ms** (WebKit 1). The geography is most of the map's cost and
it only changes when the view does: hence DESIGN §1.9's cached geography.

`node tools/.work/measure.mjs` — play for 5 s per tab, every `requestAnimationFrame` callback timed:

```
play map: 165 frames in 5 s; rAF work per frame median 0.60 p95 0.90 max 1.90 ms (n 165); frame interval median 33.30 p95 33.40 max 50.00 ms (n 164)
play globe: 245 frames in 5 s; rAF work per frame median 0.60 p95 0.70 max 1.80 ms (n 245); frame interval median 16.70 p95 33.40 max 33.40 ms (n 244)
```
Headless Chromium plays the map at 30 frames a second: the 31 ms raster, not the 0.6 ms of script.
Global Wind is the same (`node tools/.work/measure.mjs ../global-wind`: map 33.3 ms, globe 16.7 ms
median intervals; WebKit `probe.mjs ../global-wind`: map 11 ms, globe 6 ms render + raster).

**The budget that follows.** On the slowest engine measured, the base already uses two display
frames on the map. A flow layer drawn on its own canvas over a base that is **not** redrawn costs
only its own raster (R3). During play the base is redrawn every frame, so the flow there adds to
~32 ms (Chromium) or ~11 ms (WebKit) unless the geography is cached. The flow's own budget is
therefore set at **≤ 4 ms a frame in headless Chromium at the default particle count**, with the
phone's figure unknown.

## R3. What a flow layer costs: two ways to draw trails

`bench/flow.html` (served by `flowbench.mjs`, `flowbench2.mjs`) stacks a base canvas and a flow
canvas at 780 × 1 318 device px, seeds N particles uniformly on the screen, advects them with the
sphere-step kernel of R5 through a synthetic 180 × 91 field of realistic size (3–20 m/s), projects
them on the default Mercator view at "1 s = 24 h", and draws one of:

- **A — a trail canvas faded each frame**: `destination-in` with alpha f over the whole canvas, then
  this frame's N segments in one path.
- **B — polylines from history**: clear, then each particle's last M positions as M alpha groups (so
  a trail could be re-projected after a pan).

Median of 15, script + forced raster (`getImageData` of one pixel):

| N | A: fade | B: M = 8 | B: M = 12 | Kernel alone |
| --: | --: | --: | --: | --: |
| 1 000 | 1.5 ms (WebKit 1) | 3.6 (1) | 5.6 (2) | 0.1 ms |
| 2 000 | 2.2 (1) | 7.8 (2) | 11.9 (3) | 0.1 |
| 4 000 | 3.5 (1) | 16.1 (4) | 25.2 (6) | 0.2 |
| 8 000 | 6.0 (2) | 33.1 (7) | 51.6 (10) | 0.4 |

`flowbench2.mjs` (both canvases read back):

| N = 2 600 | Chromium | WebKit |
| --- | --: | --: |
| one faded canvas | 2.5 ms | 1 ms |
| the ping-pong pair (two faded canvases, every segment drawn twice) | 4.9 | 2 |
| a prewarm of 4 sub-steps (clear, 4 segment sets at f^k alpha, no full-canvas fade) | 4.4 | 3 |
| a prewarm of 6 sub-steps | 9.4 | 4 |
| the trail bitmap copied onto itself, shifted (a map pan) | 0.4 | 1 |

(N = 4 000: pair 6.5, prewarm 4 7.0, prewarm 6 14.9, shift 0.4 ms in Chromium.)

The live loops in the same file (3 s each, base static) held 16.7 ms intervals in Chromium for every
strategy up to 4 000 particles, and 20 ms in headless WebKit for every strategy — WebKit's headless
cadence, the same for the cheapest and the dearest, so not a load signal.

**Decision: A, the faded canvas, as the brief asks**, because it is 3–5 times cheaper to rasterise
than B at the same count, and a map pan or pinch can carry its pixels exactly (a Mercator pan is a
translation of the screen, a pinch a scaling about a point; the shift costs 0.4 ms). **B is
rejected**: its one advantage — trails that survive a globe rotation — costs 7.8 ms at 2 000
particles, and the globe can simply cut its trails while it is turned (DESIGN §1.11).

## R4. The fade leaves a residue — in both engines

A multiplicative fade on 8-bit alpha rounds: a pixel at alpha a becomes round(a·f), which stops
falling once a·(1 − f) < ½. The bench filled a square with white, faded it 300 times, and read the
alpha back:

| f per frame | predicted floor (< 0.5 / (1 − f)) | Chromium | WebKit |
| --: | --: | --: | --: |
| 0.96 | < 12.5 | **12** (4.7 %) | **12** |
| 0.92 | < 6.25 | **6** (2.4 %) | **6** |
| 0.85 | < 3.33 | **3** (1.2 %) | **3** |

Every pixel a trail has ever crossed keeps that floor for ever: after a few seconds the whole canvas
wears a faint veil of old streaks — something drawn that the current step does not say. Rejected
fixes: a shorter fade (f = 0.85 halves the floor but halves the trails); a threshold pass
(`getImageData` per frame, far too slow; an SVG alpha-threshold filter on the canvas, untestable cost
in WebKit); accepting the veil (rule 4). **Chosen: the ping-pong pair** — two trail canvases receive
every segment, each is cleared outright every 4 s on a 2 s stagger, and the one with the longer
history is shown. A trail's visible life (~0.6 s, DESIGN §1.6) is far shorter than the 2 s since the
shown canvas was cleared, so the swap is invisible and no residue is ever older than 4 s. It costs
twice the segments: 4.9 ms against 2.5 in Chromium at 2 600 (R3). The single canvas with a prewarm
rebuild every 4 s (4.4 ms once) is kept as a rung of the step-down ladder (DESIGN §1.8).

## R5. The kernel: a step on the sphere

`node tools/.work/kernel.mjs` — a particle is a unit vector p; with local east
e = (−sin λ, cos λ, 0) and north n = (−sin φ cos λ, −sin φ sin λ, cos φ), one step is
p ← normalise(p + (u·e + v·n)·Δt / R), R = 6 371 008.8 m. Checked against great-circle formulas
written separately in the same file:

```
Reykjavík: moved 15408.0 m (want 15408.0), bearing 52.00° (want 52°)
all from-directions at 0–89.9° N/S, 10 m/s, one frame: worst bearing error 6.88e-12°, worst relative distance error 1.70e-6
2000 frames due north from 89.99° N: |p| 1.000000000000, now 0.00, 89.99 (finite: true)
φ 0°: east step on the map 1.0000 × the equator's (sec φ 1.0000), north step 1.0000
φ 45°: east step on the map 1.4142 × the equator's (sec φ 1.4142), north step 1.4158
φ 60°: east step on the map 2.0000 × the equator's (sec φ 2.0000), north step 2.0039
φ 80°: east step on the map 5.7584 × the equator's (sec φ 5.7588), north step 5.7960
kernel + lon/lat back: 0.287 ms a frame for 3000 particles (Node, allocation-heavy prototype)
```

- Reykjavík's ask row (10.7 m/s from 232°) moves the particle 15 408 m toward 52° in one 60 Hz
  frame at 24 h a second: the speed and the opposite of the from-direction, exactly.
- The Mercator correction comes for free: the same wind moves sec φ times as far across the map at
  φ, which is the map's own stretch (the north row differs from sec φ at 80° only by the curvature of
  one 21.6 km step). The particle stays on the geography it is over. The flip side is a hazard
  DESIGN §1.4 handles in words: on the flat map a 70° N streak moves 2.9 times as fast on screen as
  the same wind at the equator.
- No division by cos φ anywhere, so the poles need no special case. The due-north run is a constant
  wind in the *local* frame, which turns round at the pole and oscillates about it — non-physical,
  but finite and unit-length, which is what the test is for.
- Rejected: **advection in degrees** (Δλ = u·Δt / (R cos φ)), which blows up at the poles and needs
  clamps; and the **screen-space field** of the classic web wind maps (a velocity grid every few
  pixels, rebuilt on every pan, zoom and play frame — about 17 000 inverse projections and samples a
  frame on a phone screen at 4 px spacing during play, and particles that reset on every pan).

## R6. The scrub, measured by real touch

`node tools/.work/measure.mjs` drags the native `<input type="range">` with CDP
`Input.dispatchTouchEvent` from step 0 to step 40 at 2, 8 and 20 steps a second. An init script wraps
`requestAnimationFrame` (every callback timed and grouped by frame) and `fillRect` (render() fills the
whole canvas first, so that call records the `t` the frame was drawn with); the finger's x is set
from the test before each move. The step under the finger is estimated with a 16 px thumb.

```
scrub map  2 steps/s: 551 touch moves, 38 frames; drawn ≠ slider value on 0, drawn ≠ step under the finger (thumb 16 px) on 0, slider value ≠ finger estimate on 0; 38 of 41 steps drawn (missing 0 1 2; first frame finger→step 3, drawn 3); rAF work median 3.30 p95 4.60 max 5.00 ms (n 38)
scrub map  8 steps/s: 114 touch moves, 38 frames; drawn ≠ slider value on 0, drawn ≠ step under the finger (thumb 16 px) on 0, slider value ≠ finger estimate on 0; 38 of 41 steps drawn (missing 0 1 2; first frame finger→step 3, drawn 3)
scrub map 20 steps/s: 34 touch moves, 29 frames; drawn ≠ slider value on 0, drawn ≠ step under the finger (thumb 16 px) on 2, slider value ≠ finger estimate on 2; 29 of 41 steps drawn (missing 0 1 2 5 9 12 17 20 25 29 33 37)
scrub globe  2 steps/s: 562 touch moves, 38 frames; drawn ≠ slider value on 0, drawn ≠ step under the finger (thumb 16 px) on 0, slider value ≠ finger estimate on 0; 38 of 41 steps drawn (missing 0 1 2)
scrub globe  8 steps/s: 122 touch moves, 38 frames; drawn ≠ slider value on 0, …; 38 of 41 steps drawn (missing 0 1 2)
scrub globe 20 steps/s: 42 touch moves, 38 frames; drawn ≠ slider value on 0, drawn ≠ step under the finger (thumb 16 px) on 1, slider value ≠ finger estimate on 1; 38 of 41 steps drawn (missing 0 1 2)
```

Reading it:
- **Today the drawn step is always the slider's value** (0 of 219 rendered frames differ across the six runs). Every step's
  values are already decoded at boot and the render runs in the same frame as the input. Where the
  drawn step differs from the finger estimate, the slider's value differs by the same count: the
  16 px thumb guess, not the app.
- **The first ~26 px of a touch drag do nothing.** Steps 0–2 are never drawn at any speed; the first
  frame arrives with the finger already over step 3, and the slider jumps there. That is Chromium's
  touch slop on a range input. On iOS a native range is, as far as this research knows, dragged by
  its thumb only (a touch elsewhere on the track does not move it) — **unverified here; a phone
  check**. Either way the step under the finger is not always the drawn one.
- At 20 steps a second the harness sent only 34 moves in 2 s (two CDP round trips a move), so steps
  were skipped by the test, not by the app. The real `shoot.mjs` must log the finger inside the page
  (DESIGN §5.2) as Warming World's does.
- Blur: none — the app has no preview path. The flow brings the risk back in a new form: trails drawn
  under the previous step's field smearing into the new one (DESIGN §2.3).

`node tools/.work/focusbug.mjs` checked one suspicion in `syncTimeUI` (`if (document.activeElement
!== slider) slider.value = …`, which would freeze the thumb during play while the slider has focus):

```
after a mouse drag: {"t":11,"v":"11","focus":"slider"}; after clicking Play and 2 s: {"t":14.249833333333333,"v":"14","focus":"btn-play","playing":true}
three ArrowRight on the slider: {"t":18,"v":"18"}
```
Clicking Play takes the focus, so the thumb moves; there is no keyboard shortcut for play, so the
frozen-thumb case is unreachable today. Moot once the track is the app's own (DESIGN §2).

## R7. Sizes today

`wc -c index.html style.css app.js` and the ZIP built exactly as `build-zips.yml` builds it
(`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`,
read back with `unzip -v`):

| | Global Weather | Global Wind |
| --- | --: | --: |
| app code (html + css + js) | **127 558 B** (6 390 + 14 442 + 106 726) | **106 299 B** (6 310 + 12 523 + 87 466) |
| fonts | 0 | 0 |
| `data/snapshot.json` | 2 898 835 (2 181 686 in the ZIP) | 1 219 304 (912 539) |
| `assets/` (world, places, LICENSES) | 439 929 (147 188) | 439 929 (147 188) |
| root `*.md` (NOTES, PROMPT) | 33 090 (14 421) | 26 001 (11 638) |
| **ZIP** | **2 384 718 B** | **1 106 271 B** |
| ZIP budget / headroom | 2 800 000 / 415 282 | 1 600 000 / 493 729 |
| code budget / headroom | 200 000 / 72 442 | 200 000 / 93 701 |

The ZIP excludes the new `.gitignore` (a dotfile) and `tools/`, so this file and the scripts never
ship. `DESIGN.md` at the root does ship (DESIGN §6).

## R8. Rejected along the way

- **WebGL for the particles** (or the whole renderer, as Warming World did): the Canvas 2D flow
  measured 2.5 ms (Chromium) and 1 ms (WebKit) at the default count, and a GL layer would add a
  second rendering family, context-loss handling and a shader to a package whose brief is a layer and
  a look. Reconsider only if the phone check fails at the floor of the step-down ladder.
- **Drawing the flow into the base canvas**: every flow frame would redraw a base that costs
  11–32 ms (R2). The flow gets its own canvases.
- **A threshold filter for the fade residue**, **polyline trails**, **degree-space advection**, **the
  screen-space field**: R3–R5.
- **Synchronous drawing inside the input handler**: R6 shows the rAF-aligned draw already lands in
  the input's frame with zero lag; drawing in the handler would render twice in a frame whenever two
  moves arrive in one.
- **Colouring trails with the wind ramp by default**: over the temperature, rain or pressure ramps it
  would read as a second data layer in the same hues. Left to the art pass under DESIGN §8's rule.
