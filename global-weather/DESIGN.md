# Global Weather — Flow: design

What Global Weather does, carried into Global Wind by copy: the wind drawn as a moving field of
streaks, a time slider whose drawn step is always the one under the finger, a focus mode, SI notation
throughout, and the test tools that prove each of them. The look — palette, type, the keys' marks,
motion — belongs to `ART.md`; §8 lists what it must respect. The pipeline, the snapshot's shape, the
`ask` rows, the map's data files and the three credits are not this design's to change. Choices
marked *owner call* are listed in `tools/DECISIONS.md` of the template repository (not shipped),
beside the record of how this was built and reviewed.

Numbers marked *measured* name the script in `tools/RESEARCH.md` that printed them. Headless
Chromium and desktop WebKit are not a phone: every frame time here is a trend, and the phone's
numbers are unknown until the owner's check (§7.3).

---

## 0. What changes, and what does not

**Unchanged:** `data/snapshot.json` and its validation, decoding and staleness rules; the `ask`
rows (never read by the app); `assets/`; the credit line's three credits — *NOAA GFS, sampled*,
*Natural Earth*, *GeoNames CC BY 4.0* — on screen under the map in every mode; About's full
statement; the map (Web Mercator, Path2D coastlines) and the globe (orthographic per-pixel raster);
the tapped readout and its numbers; the units cycle with SI first; play at 5 h a second;
`visibilitychange` re-reading the snapshot; the security rules in `app.js`'s header (no value
reaches `innerHTML`, nothing fetched but `./data/…` and `./assets/…`).

**Kept for the marketing camera:** the visible word *Updated* in the stamp once the forecast is
unpacked; the tabs whose text is *Map* and *Globe*; buttons whose accessible names are *Zoom in*
and *Zoom out*; the `gwe.*` storage keys (`gw.*` in Global Wind), with new keys only added.

**New:** the flow layer (§1), the app's own time track (§2), focus mode (§3), one number formatter
(§4), the tools (§5), vendored fonts and the look (`ART.md`).

---

## 1. The flow layer

### 1.1 The rule it obeys

The animation is the measured field moving, never decoration. A streak sits where the snapshot's
wind is, moves in the direction that wind blows **toward**, at that wind's speed, at the hour on
the slider — times one printed constant, the rate (§1.5). Nothing about a streak is invented: not
its direction, nor its speed, nor its color (§8). Where streaks gather is *not* a measurement: they
bunch where the air converges, but also where the projection shrinks the ground (on the flat map the
screen divergence of a wind is the sphere's plus 2·v·tan φ / R, so air running toward the equator
bunches there; on the globe, air running toward the limb), and otherwise their spacing is the
seeding's. The app says so in About and `NOTES.md`.

### 1.2 The field

- The vector is the one the app already builds: `WeatherField.values('wind', k)` gives
  u = −s·sin(dir) (east positive) and v = −s·cos(dir) (north positive), because `dir` is where the
  wind blows **from**, clockwise from north. *Measured* (RESEARCH R1): all 60 `ask` rows
  recomputed from these u, v agree with the puller's speed to 0.0 m/s and its from-direction to the
  degree, so +u, +v is the way the air moves.
- A particle samples exactly what a tap samples: `field.sample('wind', t, lon, lat)` — bilinear on
  the 2° grid, longitude wrapping (column 179 blends into column 0), latitude clamped at the poles,
  and linear in time **on u and v** (never on speed and angle: 350° and 10° average to 0°, not
  180°). The flow and the readout cannot disagree because they are the same call.
- **Decode-ahead.** After the byte planes are unpacked at boot, u and v for every step are built
  once and kept (41 × 16 380 × 2 × 4 B = 5.4 MB), the shown step first, then outward from it, in
  idle chunks. A step change is then a lookup. The color layer keeps today's 16-entry cache (its
  conversion is cheap and per layer).

### 1.3 The kernel: a step on the sphere

Each particle is a unit vector **p** = (cos φ cos λ, cos φ sin λ, sin φ), kept in a `Float64Array`.
With local east **e** = (−sin λ, cos λ, 0) and north **n** = (−sin φ cos λ, −sin φ sin λ, cos φ),
all read off **p** without trigonometry, one frame is

    p ← normalize( p + (u·e + v·n) · Δt_wind / R ),   R = 6 371 008.8 m,
    Δt_wind = Δt_screen × rate,   Δt_screen = min(frame interval, 50 ms)

λ and φ for the sample come from two `atan2`s. There is no division by cos φ, so the poles need no
case of their own; the snapshot's polar rows (one vector seen from 180 meridians, R1) interpolate
like any other. *Measured* (RESEARCH R5): over every from-direction at 0–89.9°, one frame's bearing
is the opposite of the from-direction to 7 × 10⁻¹² ° and its length the wind's to 2 × 10⁻⁶;
Reykjavík's first ask row (10.7 m/s from 232°) moves 15 408 m toward 52° in a 60 Hz frame at
24 h a second. The 50 ms clamp means a stalled frame slows the flow rather than throwing it.

### 1.4 Projection

- **Map.** Screen x from λ; screen y from Mercator's y = atanh(sin φ), which is `atanh(p.z)` — one
  logarithm. The map's own stretch follows: the same wind moves sec φ as far on screen at latitude φ
  (*measured* 1.414 at 45°, 2.000 at 60°, 5.758 at 80°). That is the correction the brief asks for —
  a degree of longitude is shorter near the poles, so the particle stays on the coast it is over —
  and it is also a trap: on the flat map a 70° N streak runs 2.9 times faster than the same wind at
  the equator. The flow key says so on the map (§1.13), `NOTES.md` explains it, and nothing about a
  streak's length or speed is ever used to encode the wind's strength (§8).
  Particles beyond ±85.05° (where Web Mercator ends) are respawned; a segment that crosses a world
  copy's seam (screen jump > W/2) is not drawn.
- **Globe.** **p** rotated into the view frame (nine multiplications): the same orthographic
  projection as `GLOBE_VIEW.project`. Particles with view-z < 0.11 — behind the horizon or on the
  rim the arrows also skip (r² > 0.988) — are respawned. Near the limb, foreshortening slows the
  streaks on screen, which is what the sphere looks like. On screen, a particle's direction must
  agree with the arrow drawn at the same point by `drawGlobeArrows`'s east/north rotation;
  `test_flow.mjs` checks the two against each other.

### 1.5 The rate: what one second of motion means

A streak's on-screen speed is (wind speed) × (rate in hours of wind per second) × 3 600 × (screen
pixels per meter at that place). The rate is chosen from a fixed ladder so that a typical wind
reads, and it is **printed**:

| Rung | 48 h | 24 h | 12 h | 6 h | 3 h | 1.5 h | 45 min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Key text | 1 s = 2 days of wind | 1 s = 24 h of wind | 12 h | 6 h | 3 h | 90 min | 45 min |

- Pixels per meter at the view center: map `map.scale / (2πR) × sec φ_centre`; globe `globe.r / R`.
- The ideal rate puts a 6 m/s wind (the field's area-weighted mean is 6.18 m/s, median 5.75 —
  *measured*, R1) at 18 CSS px a second at the center: `rate* = 18 / (6 × 3 600 × px_per_m)`. The
  rung nearest `rate*` on a log scale is used, and the rung changes only when `rate*` is more than
  1.6 times away from the current one, so a pinch does not make the key flicker.
- Worked: the phone's opening map (`map.scale` ≈ 1 193 px for 360°, center on the equator) gives
  2.98 × 10⁻⁵ px/m and rate* = 28 h → **24 h**; the opening globe (r ≈ 187 px) gives 28.4 h →
  **24 h**; the deepest map zoom (80 px a degree) gives 1.2 h → **1.5 h** (45 min at 60°). At 24 h a
  second a median wind moves about 15 px a second at the equator and a p99 wind (17.75 m/s) about
  46 px.
- A rung change clears and prewarms the trails (§1.10), because a streak's length would otherwise
  mix two rates.

The rate is a property of the drawing, not of the forecast: the streaks trace **the wind at the hour
shown**, as if it held still while they move. During play that hour advances at 5 h a second while
the streaks travel at the rung's rate; the caption's wording (*of wind at the hour shown*) leaves no doubt which clock
the streaks run on.

### 1.6 Trails

- Trails are drawn on canvases of their own, over the base, and **faded each frame**: a
  `destination-in` fill at alpha f = 2^(−Δt / 0.18 s) — a half-life of 0.18 s whatever the frame
  rate (0.938 a frame at 60 Hz, 0.880 at 30 Hz) — then this frame's segments, old position to new,
  in as few `stroke()` calls as the alpha bins need (§1.12). A trail is visible for about 0.6 s,
  which at 24 h a second is about 14 h of the air's travel.
- *Measured* (RESEARCH R4): a multiplicative fade never reaches zero on 8-bit alpha; it stalls at
  12, 6 and 3 (of 255) for f = 0.96, 0.92 and 0.85, identically in Chromium and WebKit. At 0.938 the
  floor is 8. Left alone, every pixel a trail has crossed keeps a faint veil — a drawn thing the step
  does not say. So there are **two trail canvases, A and B**. Both receive every segment and every
  fade; each is cleared outright every 4 s, B 2 s after A; the one cleared longer ago is the one
  shown (`visibility`). A trail lives 0.6 s and the shown canvas is always at least 2 s old, so the
  swap cannot be seen, and no residue is ever older than 4 s. *Measured* cost at 2 600 particles:
  4.9 ms a frame in headless Chromium, 2 ms in WebKit, against 2.5 and 1 for one canvas.
- Polyline trails re-projected from history were measured and rejected (3–5 times the raster cost,
  RESEARCH R3).
- Trail canvases run at DPR ≤ 2 even on a DPR-3 phone: a 1 px streak gains nothing from a third
  sample, and each canvas at DPR 3 is 9.3 MB.

### 1.7 Particles

- **Count:** `N = clamp(round(A / 100), 400, 4 000)` where A is the drawable area in CSS px² — the
  map's canvas, or the globe's disc clipped to the canvas. On a 390 × 844 phone: map 2 570, globe
  1 100, the map in focus mode about 2 900. Recomputed on resize, tab switch and focus change.
- **Seeding:** a uniform random point on the drawable screen, inverse-projected; so the density is
  even on screen and encodes nothing. A seeded PRNG (mulberry32) so that a test can fix it.
- **Life:** each particle lives a uniform random 1.5–3.5 s of animation, then respawns. Tracers
  bunch where winds converge (and where the projection shrinks the ground, §1.1), and a finite life
  keeps the screen evenly covered and stops a convergence line from becoming a solid stroke.
- **Respawn** also when it leaves the screen by more than 8 px, crosses the globe's horizon (§1.4),
  passes ±85.05° on the map, or its segment would cross a world seam.
- **Calm** (< 0.5 m/s, 0.45 % of the field) moves as slowly as it is; no minimum speed is imposed.

### 1.8 The frame loop and the step-down

- **One loop.** While the flow is on and visible, one `requestAnimationFrame` loop runs: if the
  base is dirty (a step, play, a gesture, a resize), draw the base and the top layer first (§1.9);
  then advance and draw the flow. Today's `requestRender()` and play `tick()` become requests to
  that loop, so two chains never race. With the flow off, rendering returns to on-demand: no frame
  is drawn that nothing asked for.
- **Measuring.** The loop records each frame's interval and the flow's own script time; the display
  period P is the 10th-percentile interval over the last 2 s (so a 120 Hz display is recognized; a
  30 Hz Low Power Mode cap, if WKWebView applies one, simply halves the frames, and Δt keeps the
  speed true).
- **Stepping down**, judged once a second, never while playing, and only over intervals between two
  consecutive frames in which the base was **not** redrawn (an interval that ends a frame after a base
  draw carries that draw's cost, so play's own cost is never blamed on the flow): if the median
  interval exceeds 1.5 P, take one rung
  down — (1) N × 0.75, repeatedly, to a floor of max(400, 0.35 N_target); (2) one trail canvas
  instead of the pair, with a 4-sub-step prewarm rebuild every 4 s (4.4 ms once, *measured*); (3)
  the flow at half rate (advance and draw every second frame with Δt doubled). After five
  consecutive seconds at ≤ 1.1 P, take one rung back up (N × 1.15 to the target).
- **During play**, if intervals exceed 1.5 P, the base (the interpolated color layer) is redrawn on
  alternate frames before the flow is touched; the time row and track still show the step the base
  last drew (§2).
- Every decision and the current rung are in `__weather.perf()` (§1.16); nothing about it is on
  the main screen.

### 1.9 The canvas stack, and the geography drawn once

Bottom to top, all the size of `#map-wrap`, all `pointer-events: none` but the base:

1. **`#map`, the base**: ocean, land, the color layer, the night wash, graticule, borders, coast.
2. **Flow A and flow B** (§1.6).
3. **`#top`**: arrows, place labels, the tapped marker — moved off the base so that arrows and
   labels sit over the streaks, and redrawn only when the view, the step or the marker changes —
   during play, only when it carries arrows (the place names do not move with the hour). Place names
   are not drawn under the key column, the ghost key or the readout card, nor clipped by an edge.

*Measured* (RESEARCH R2): the map's base costs 31.7 ms in headless Chromium and 11 ms in WebKit, of
which the land fill, borders and coast are 13–14 ms and the color sheet 1–5 ms; copying a cached
full-canvas bitmap costs 0.2–1 ms. The geography only changes with the view, so the map keeps two
off-screen bitmaps per view — *ground* (ocean and land) and *lines* (graticule, borders, coast) —
and a base frame becomes blit, color sheet, night, blit. The globe keeps its *lines* bitmap per
rotation (its surface is already a per-pixel raster). The keys include W, H, DPR and the theme;
a pan or pinch rebuilds them at the end of the gesture and draws paths directly while it moves.
Without this, play on the map stays where it is today: 30 frames a second in headless Chromium
(*measured*, R2), with the flow added on top.

Memory at DPR 2 (780 × 1 318 px, 4.1 MB a canvas): base, top, A, B and two bitmaps, about 25 MB of
canvas backing; at DPR 3 with the flow capped at 2, about 45 MB. A phone check (§7.3).

### 1.10 Time: paused, playing, and a step change

- **Paused** (an integer step): the flow reads that step alone.
- **Playing**: the flow reads the same k0, k1 and fraction as the color layer (`frame()`), so the
  streaks ride the interpolated field. Trails carry on: across 0.6 s of play the field moves by
  3 h, one step's interpolation.
- **A step change** — the track, ‹ ›, the keyboard, play stopping and rounding `t`, a new snapshot,
  a tab switch, a rung change: the flow switches to the new field **in the same frame** the base
  draws the new step, and both trail canvases are cleared and **prewarmed**: four sub-steps of the
  new field, each covering a quarter of a trail's 0.6 s, drawn at the alpha the fade would have left
  them (no full-canvas fade). Every streak on screen then belongs to the drawn step — no smear of the
  old field into the new, which is the flow's version of a blurred scrub. *Measured*: 4.4 ms in
  headless Chromium and 3 ms in WebKit at 2 600 particles. A drag that crosses several steps in one
  frame prewarms only the last; at most one prewarm a frame.

### 1.11 Gestures and zoom

- **Map pan**: the trail canvases' pixels are shifted by the pan, a `drawImage` of each onto itself
  with `globalCompositeOperation = 'copy'` (*measured* 0.4 ms Chromium, 1 ms WebKit). A Mercator pan
  is a pure translation of the screen, so the shifted trails are exactly where they would be.
- **Map pinch, double-tap and the zoom keys**: the same copy, scaled about the gesture's anchor by
  the ratio of `map.scale` before and after — exact, because a Mercator zoom is a similarity of the
  screen. The offset is computed from the view before and after, so the clamp at the top and bottom
  of the world stays exact. If the rung changes, clear and prewarm.
- **Globe drag, pinch and fling**: a rotation is not a similarity of the screen, so no trail can be
  carried. While the globe moves both trail canvases are **cleared and nothing is drawn** (one-frame
  dashes read as speckle, not as wind); the particles stay on the ground, and the first frame after
  the globe stops prewarms the new view (§1.10).
- **Resize, tab switch, theme change, focus mode**: recompute N, reseed, prewarm.
- The tapped readout is unaffected: a tap is a tap with the flow on.

### 1.12 Night

When the night shading is on, the base's wash darkens the ground but not the streaks above it, and a
bright streak over the night side would contradict the terminator underneath. Each particle's alpha
is therefore multiplied by `1 − κ · nightFade(p · s)`, where **s** is the sun's unit vector from
`sunAt()` at the shown valid time and `nightFade` is the base's own twilight ramp — one dot product a
particle, since **p** is already a vector. Alphas are quantized to four bins, so a frame is at most
four strokes a canvas. κ is **0.30 in the dark theme and 0 in the light one** (ART.md): the light
theme's night wash already darkens the pale ground under an ink streak, and dimming the streak too
would take the night worst case to 1.86:1 (`palette.py`).

### 1.13 The control

- **Two keys** in the map's key column, both toggles with `aria-pressed`: **Flow** (new, `btn-flow`,
  accessible name *Show the wind's flow*) and **Arrows** (today's `btn-arrows`). Two toggles give all
  four states — Flow, Arrows, Both, Off — without a menu, and each says its own state.
- **Defaults**: Flow on; Arrows off for a viewer who never chose (no `gwe.arrows` stored); a stored
  `'1'` keeps the arrows (Both). Stored: `gwe.flow` (`'1'`/`'0'`), `gwe.arrows` as today.
- **The flow key** is the caption band's exposure line (ART.md): the rung's text (§1.5), for example
  *Streaks: 1 s = 24 h of wind at the hour shown*, and on the map, once the view reaches 45° of
  latitude, a second clause, *faster toward the poles, where the map stretches*. Under Reduce Motion
  or with the flow off it reads *Arrows: length and weight grow with wind speed up to 25 m/s* (in
  the unit on screen, a whole number printed whole; both stop growing there) when arrows are drawn, or nothing. It stays in focus
  mode. Its numbers go through the formatter (§4).
- **Its height is fixed** (two lines below 640 px of width, one from 640 px), whatever it says. The
  words follow the view, and a line whose height followed the words would resize the plate above it,
  which moves the view, which changes the words: at rest near 45° that loop resized every canvas
  about 22 times a second. `shoot.mjs` pans across 45° by touch and counts the resizes (none), and
  checks the longest line fits at every width.
- With no wind layer in the snapshot (a puller edit, `NOTES.md` allows it), the Flow key is hidden
  and nothing else changes, as the arrows already behave.

### 1.14 When the flow does not run

- **Reduce Motion** (`prefers-reduced-motion: reduce`, read live with a `change` listener): the flow
  never animates and its canvases are cleared. If the viewer's stored choice is Flow without Arrows,
  the arrows are drawn instead, so the wind is still on the map; the stored choices are not
  rewritten, and return when Reduce Motion is turned off. The Flow key shows `aria-pressed="false"`,
  and a press says, in the polite live region and the key's title, *The flow is off while Reduce
  Motion is on.* Play still plays: it is content the viewer asked for, at the same 5 h a second, but
  as whole steps (one 3 h step every 0.6 s), so no frame is a blend of two steps and nothing moves
  between them. `shoot.mjs` reads every drawn frame of play under Reduce Motion: none at a fractional
  step.
- **Hidden** (`visibilitychange` to hidden, `pagehide`): the loop stops and the trails are cleared.
  On visible, today's `loadSnapshot()` runs as before and the loop restarts with a prewarm, so a
  return never shows streaks from before. Snuggery also sends `visibilitychange` when a Shortcut
  delivers data while the page is open; that path is the same.
- **About open**: the sheet covers the map, so the loop draws nothing and play waits until it
  closes; closing it shows the hour it was opened on, and play goes on from there.
- **No field yet** (unpacking) or **a broken snapshot with nothing loaded before**: no flow; the
  error says what is wrong, as today. A broken replacement keeps the previous field (today's
  behavior), so the flow keeps reading the forecast the error box says is still shown.

### 1.15 What does not change

The readout's numbers (the same `field.sample`), the legend's scale, the color layer and the arrows'
geometry, the stamp's staleness rules. `shoot.mjs` compares the readout with the flow on and off.

### 1.16 Hooks for the tests (inert unless called)

`window.__weather.flow`:
- `state()` → `{ on, suppressed: 'reduced' | 'hidden' | 'about' | null, n, nTarget, rung, rateHours,
  keyText, shown: 'A' | 'B', ladder }`;
- `probe(points, seed)` → replaces the particles with these `[lon, lat]` points (infinite life,
  no respawn) for a deterministic run; `step(frames, dt)` advances them synchronously with the real
  kernel and the real field; `positions()` → `[[lon, lat, x, y, visible], …]`;
- `perf()` → the last 120 frames: interval, flow script ms, base ms, the rung history.

`window.__weather.center(lon, lat)` moves the view's center there (a test puts the night side in
view at a known step, whatever time zone the test runs in).

`window.__weather.log(true | false)` records one entry a frame: `{ t, finger, wanted, shown, flowK0,
flowK1, flowF, label, pressed }` (§2.4). Global Wind's hook is `window.__gw`, with the same members.

---

## 2. The scrub

### 2.1 What was measured

By real touches at 2, 8 and 20 steps a second on both views (RESEARCH R6): today's drawn step
**always** equals the slider's value — 0 of 219 frames differ — because every step is decoded at
boot and the draw lands in the input's own frame. There is no blur and no lag to fix. Two things
are wrong all the same:
- **The first ~26 px of a touch drag do nothing**: steps 0–2 were never drawn at any speed, and the
  thumb jumped to step 3 once the drag passed Chromium's touch slop.
- **On iOS a native range input is dragged by its thumb only**, as far as this research knows — a
  touch elsewhere on the track does not move it. *Unverified here*; it is the first scrub item in
  the phone check.
And the flow brings a new way to blur: streaks drawn under the old step smearing into the new one.

### 2.2 The design

- **The app's own track** replaces `<input type="range">`, as Earth's History and Warming World did.
  An element with `id="slider"` (kept), `role="slider"`, `tabindex="0"`, `aria-valuemin="0"`,
  `aria-valuemax` = steps − 1, `aria-valuenow` = the **shown** step, and `aria-valuetext` = the time
  row's words (*Tue 22 Sep 09:00, 3 h after the run*). Its hit area is at least 44 px tall.
- **Pointer**: `pointerdown` anywhere on the track captures the pointer, stops play, and jumps to
  the step under the finger — no slop, no thumb to find. `pointermove` sets
  `wanted = round(x_fraction × (steps − 1))` and asks the loop for a frame.
- **The frame draws `wanted`** (base and top) and sets `shown = wanted`; the flow switches field
  and prewarms in the same frame (§1.10). The thumb, the time row, `aria-valuenow` and the readout
  all read `shown` — the step whose pixels are on screen — so for no frame can the label and the
  picture disagree. The draw is rAF-aligned rather than inside the handler: *measured*, it already
  lands in the input's frame, and drawing in the handler would draw twice whenever two moves arrive
  in one frame.
- **Decode-ahead** (§1.2): every step's u and v are resident, so a step change is a lookup; *measured*
  today, a new step costs no more to draw than the same step (R2).
- **No transition** on the thumb, the label or the time row (`transition: none`, checked by
  `check.mjs`); nothing that carries a step is ever animated.
- **Keys**: ← → one step, Page Up / Page Down eight steps (a day at 3 h), Home / End.
- **Ticks**: today's day labels, measured against the track's width as now.

### 2.3 With the flow

A drag at any speed: each frame draws the step under the finger, and every streak on screen was
drawn in that step's field (the prewarm). A flick crossing three steps in a frame draws the third and
never the two it skipped, which no frame could have shown.

### 2.4 How it is proved

`shoot.mjs` drags the track by real touch (CDP `Input.dispatchTouchEvent`, moves every 16 ms from a
loop in the page's own clock) at 2, 8 and 20 steps a second on the map and the globe, with the flow
on, and reads `__weather.log`, where `finger` is the x the app's own pointer handler saw. On every
frame: `shown === wanted === stepUnder(finger)`, `flowK0 === shown && flowF === 0`, the label's text
equals the label written for `shown` by the test's own formatter; at 2 steps a second every step is
drawn, in order; the first frame after the lift draws the last step.

---

## 3. Focus mode

Everything but the view and its time track, as the owner asked of every app whose hero is a view.

- **Entering**: a key at the foot of the map's key column, accessible name *Hide the controls*.
  **Leaving**: a ghost key in the canvas's top-right corner (where the column was), *Show the
  controls*, `aria-keyshortcuts="Escape"`, drawn with a halo so it reads over every layer and the
  streaks, inset below the top safe area (in Snuggery's full screen the plate starts under the status
  bar once the header has gone), with no arrow drawn under it; and **Escape** (when About is closed). Double-tap keeps zooming and never
  toggles focus mode.
- **What leaves** (each `hidden` and `inert`, so out of the accessibility tree and the tab order):
  the title, the units key, the Map | Globe tabs and the layer chips, the key column, the color
  legend's bar and ticks (owner call 3: Warming World's precedent); and an open readout card, which
  closes on the way in (a tap in focus mode opens it again).
- **What stays**: the canvases with the flow and arrows as chosen; the player — the time row, ‹ ▶ ›
  and the track with its day ticks; **the stamp**, moved into the caption band as its first line with its
  words unchanged (*Updated 04:15, GFS 06Z 22 Sep*, or the *Stale* and *Forecast ran out* wording),
  because the forecast's age
  never hides; **the credit line** (a license condition, and NOAA's *sampled*); the
  flow key; the error box (a problem is never hidden). A tap still opens the readout; its ✕ closes it.
- **Remembered** between launches as `gwe.focus` (`'1'`), restored before the first draw: the house
  rule, and a phone reopened should look as it was left. The camera never enters it; §7.3 names the
  risk of a library left in focus mode.
- **VoiceOver**: a polite live region says *Controls hidden. Press Escape or the corner key to show
  them.* and *Controls shown.* Focus moves to the ghost key (and back to the entry key) only when the
  keyboard did it (`event.detail === 0`), as US Quakes learned; after a touch, nothing is ringed.
- **The canvases take the freed rows** through the normal resize path: the map keeps its center, the
  flow recomputes N and prewarms (§1.11). Under Reduce Motion every change is instant; otherwise
  the chrome fades out (160 ms) and the canvases resize once, never blank.
- `shoot.mjs`'s `focus` scene, both themes (§5.2).

---

## 4. SI notation

**Already right in both apps:** every unit cycle starts with SI — m/s, °C, mm/h, hPa (US units one
tap away: km/h, kt, mph, °F, in/h, inHg); the stamp's time is 24-hour; coordinates are decimal
degrees.

**Left to do**, all through one pure module, `js/units.js` (Warming World's and Earth's History's
rules, copied):
- **The true minus, U+2212**, for every negative number shown: the readout (−12.3 °C today prints
  `-12.3`), the legend's ticks (`-40`), About's ranges (`-69.4 to 47.4`).
- **U+202F between a number and its unit**, everywhere text is written: the readout's other rows
  (`${value} ${unit}` uses a plain space), the main value (number and unit are separate spans with
  no space at all in the accessible text — the unit's text gets the leading U+202F), the lead line
  (`+54 h`, `in 2 d`, `5 h ago`), About (`every 3 h`, `+120 h`, `2° apart`), the flow key (`1 s`,
  `24 h`).
- **Thousands grouped with U+202F**, never a comma: pressure `1 013 hPa` in the readout, the legend's
  `1 000`, About's `16 380 points`. (Four-digit pressures are owner call 5: meteorology
  writes 1013 hPa ungrouped.)
- **Coordinates** `51.5° N, 0.1° W` (U+202F before the hemisphere).
- **Dates and times** today mix the stamp's 24-hour `10:15` with the time row's locale format, which
  on a US phone is 12-hour. One fixed format, built by hand rather than by the locale: 24-hour, and
  day before month as the `ask` rows already write it (*Tue 22 Sep 09:00*). Owner call 4,
  recommended.
- `toFixed` and `toLocaleString` appear only in `js/units.js` and in non-text uses (cache keys, CSS
  percentages); `check.mjs` enforces it with an allow-list.
- **VoiceOver hears words, not symbols**: the track's `aria-valuetext` and the sentences the live
  region says spell the date (`Wednesday 23 September, 14:00`, `units.js` `spoken()`), the hours
  (`39 hours after the run`) and the unit (`meters a second`, from each unit's `say`).
- **The `ask` rows are not touched**: they are data for questions in words, written by the
  pipeline.

---

## 5. The tools

All three on Warming World's pattern: Node, no dependencies but Playwright for `shoot.mjs`, every
check printed as `ok`/`FAIL` with its number, exit 1 on any failure.

### 5.1 `tools/check.mjs` (static; `node tools/check.mjs`)

1. What the ZIP ships stays within Snuggery's limits: files, folder depth, symlinks, largest, total.
2. No `http://` or `https://` in any shipped `.html`, `.css` or `.js`, comments included.
3. Every `import`, `src`, `href`, `url(`, `fetch(` and data path is relative, inside the folder,
   and present.
4. `assets/` holds exactly `world.json`, `places.json`, `LICENSES.md`; `data/` exactly
   `snapshot.json` and `snapshot.sha256`; `fonts/` exactly the one subset and `OFL.txt`;
   `assets/LICENSES.md` credits the face and does not say that no font is bundled.
5. **The data is untouched**: the SHA-256 of `data/snapshot.json` equals the line in
   `data/snapshot.sha256` (`31c6fc84…a6ade2` today).
6. `miniapp.json` valid (name, entry point, description ≤ 200 characters, version).
7. No AI vendor or product name in any shipped text file, `DESIGN.md` and `ART.md` included —
   Warming World's list, stored ROT13, model family names included; the snapshot's planes skipped,
   its strings read.
8. **The three credits**, verbatim in the app code: `NOAA GFS, sampled`, `Natural Earth`,
   `GeoNames CC BY 4.0`.
9. **The camera's strings**: `Updated` written into the stamp; tab buttons whose text is `Map` and
   `Globe`; buttons with `aria-label="Zoom in"` and `"Zoom out"`; every `localStorage` key starts
   `gwe.` (Global Wind: `gw.`), and today's keys are all still read.
10. **SI**: no plain space between a digit and a unit (`°C`, `%`, `m/s`, `km/h`, `mm/h`, `hPa`, `h`,
    `d`, `km`) in strings the app writes; `toFixed`/`toLocaleString` only where the allow-list says.
11. No `transition` or `animation` on the track's thumb, the time row or the label.
12. Only `.innerHTML = ''` anywhere (the app's own security rule).
13. Budgets: app code (`index.html`, `style.css`, `app.js`, `js/*.js`) ≤ 200 000 B; `fonts/` ≤
    160 000 B; the ZIP built exactly as `build-zips.yml` builds it (`zip -r -X … -x '.*' '*/.*'
    'screenshots/*' 'tools/*' …`) has `index.html` at its top, holds exactly the shipped files (no
    `tools/`, `screenshots/` or dotfiles) and is ≤ 2 800 000 B (Global Wind 1 600 000). Every size
    printed.

### 5.2 `tools/shoot.mjs` (Playwright; `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`)

Headless Chromium, 390 × 844 CSS px, DPR 2, real touch, light and dark (`SCHEMES=`), Reduce Motion
where named. Fails on any console error or warning, page error, failed request, HTTP ≥ 400, or any
request outside the local server. Every figure it asserts is worked out in the script from the
shipped files with Node's own `zlib` and formulas written there, never by importing `js/`, so a bug
in the app cannot agree with itself.

- **Boot**: the stamp reads *Updated* once unpacked; the three credits are visible text; the camera's
  controls exist by role and name (`Map`, `Globe` tabs; `Zoom in`, `Zoom out` buttons).
- **The flow, in each theme**: on by default; its canvas changes between two reads 200 ms apart; the
  shown canvas alternates A/B every 2 s; the key's text names the rung. **Direction and speed end to
  end**: `flow.probe` places particles at the twelve `ask` cities, `flow.step` advances them, and
  their new positions equal the script's own integration of its own decode of the snapshot (bearing
  ± 0.5°, distance ± 1 %), on the map and on the globe; their screen positions equal the script's
  own projections (± 0.5 px).
- **Trails read**: at sampled trail pixels over each of the five layers and over the night side, the
  composite differs from the base under it by at least the contrast ART.md sets (§8), both themes.
- **Readout**: the same numbers with the flow on and off; the script's own bilinear sample matches.
- **SI**: in every visible text node, no hyphen-minus before a digit, U+202F before every unit,
  `1 013 hPa`; the units key cycles m/s → km/h → kt → mph and °C → °F (SI first).
- **The scrub**: §2.4, three speeds, both views, flow on.
- **Play**: across a day and for 3 s; on every frame the label is the drawn `t` and the flow's
  k0, k1, f equal the base's.
- **Gestures**: a map pan carries the trails (sampled trail pixels move by the pan ± 1 px); a globe
  drag clears them per frame and they regrow after the release; a zoom across a rung changes the key.
- **Focus mode**: entered by touch and by Enter; what leaves is `hidden`, `inert` and absent from the
  accessibility tree; the stamp, the credit line, the flow key and the player stay visible; the
  canvas grew; a scrub, play and a tap in focus; left by the ghost key and by Escape; a reload keeps
  it; the live region's sentences.
- **Reduce Motion**: the flow canvases never change over 1 s; arrows drawn when the stored choice was
  flow-only; the Flow key's sentence; play still steps.
- **Hidden**: `visibilityState` forced hidden stops the loop (`perf()`'s frame count frozen) and
  clears the trails; visible restarts with a prewarm.
- **Snapshots**: missing, not JSON, schema 1, a shortened plane, stale — each sentence as today;
  a replacement while open keeps the view, the step and the flow.
- **Widths** 320, 360, 375 and 844 × 390, 125 % text zoom: no horizontal scroll; hit targets ≥ 44 px.
- **The plate holds still**: a touch pan north across the 45° edge and back, then 2 s at rest, sees
  no resize of `#map-wrap` (a `ResizeObserver` counts them), nor do Flow off, on, Arrows on, off;
  the longest exposure lines fit the line's fixed height at every width.
- **The controls say what they do**: the Play key shows ‖ while playing and ▶ when not, by touch;
  About holds `t` still while it is open during play, and play goes on once it closes; the readout
  card moves to the bottom when a tap lands under it and stays at the top otherwise, never covering
  the marker; entering focus mode closes it.
- **VoiceOver**: a tap's live-region sentence (place, value, unit in words, the descriptive line);
  the Next step key's sentence; the track's `aria-valuetext` in words; the stamp a dialog button
  described *Opens About this data.*
- **The opening**: the map opens on the clock's longitude (`map.cx`); at 844 × 390 the plate is at
  least 220 px tall, the keys one row, and the globe's disc inside the plate.
- **Frame time**: `__weather.perf()` after 5 s of idle flow on each view and after the scrub and
  play — interval, flow script, base, the rung — printed as **headless Chromium, a trend only, not
  phone evidence**. Nothing fails on a frame time.
- **Pictures**, to `tools/.work/shots/` and copied to `screenshots/`: `map`, `globe`, `temp-flow`
  (the temperature layer under the streaks), `readout`, `focus`, each `-light` and `-dark`;
  `about-light`, `reduced-dark` (arrows under Reduce Motion), `zoomed-light` (the map at 8×, the
  rung changed). **Never `screenshots/app.png`**: that is the README's composite, made from the
  camera, and it must survive every run. The flow's PRNG is seeded for the pictures.

### 5.3 `tools/test_flow.mjs` (Node; `node tools/test_flow.mjs`)

The math alone, importing `js/flow-math.js` (pure: the kernel, the particle projections, the rate
ladder, the fade factor, the PRNG) and checking it against formulas written in the test:

1. **The direction convention**: for every direction byte 0–255 and speeds 0.25–40 m/s, u, v built
   as the app builds them give back `atan2(−u, −v)` = the byte's angle (1 × 10⁻⁹), and one kernel
   step's great-circle bearing is that angle **plus 180°** (1 × 10⁻⁶ °). This is the test that a
   streak moves toward where the wind goes, not where it comes from.
2. **The ask rows**: the snapshot decoded with Node's `zlib`, the 60 rows' speed (± 0.05 m/s) and
   from-direction (± 0.5° above 0.5 m/s) recomputed through the app's sampler at each city and lead
   time; then a particle stepped from each city moves toward `fromDegrees + 180` (± 0.5°) by
   `speed × Δt × rate` (± 10⁻⁵ relative).
3. **The kernel**: every from-direction at 0, 45, 60, 80, 89, 89.9° N and S — bearing error
   < 10⁻⁶ °, distance error < 10⁻⁵; unit length after 10 000 steps; a pole crossing stays finite.
4. **Bilinear and wrap**: at a grid node the sample is the node's value exactly; at 359.9° E it
   blends columns 179 and 0; −0.1° E equals 359.9° E; latitude clamps at ±90°.
5. **Time**: at t = k + f the sample is (1 − f)·A + f·B on u and v; a 350° and a 10° wind of equal
   speed interpolate to 0°, not 180°.
6. **Mercator**: the screen step of an east and a north wind at φ is sec φ times the equator's
   (± 0.5 % at a 1 px step); a particle crossing 180° keeps a continuous track and its seam segment is
   not drawn.
7. **Orthographic**: forward and inverse round-trip within 10⁻⁹ for six centers; view-z < 0.11 is
   hidden; a particle's screen direction equals the arrow's from `drawGlobeArrows`'s formula
   (± 0.5°) at 200 seeded points.
8. **The rate**: for a grid of zooms and centers, the rung is the one §1.5 picks, the 1.6×
   hysteresis holds, and a 10 m/s wind's screen speed equals 10 × rate × 3 600 × px/m (10⁻⁶); each
   rung's key text is the table's.
9. **The fade**: f(Δt₁)·f(Δt₂) = f(Δt₁ + Δt₂); 0.6 s takes alpha to ≤ 10 %.
10. **Seeding**: 10 000 seeded points are uniform on screen (χ² over 8 × 8 cells, p > 0.01) and inside
    the drawable area.

---

## 6. Budgets

| | Global Weather today | after (estimate) | cap |
| --- | --: | --: | --: |
| app code (html + css + js) | 127 558 B *measured* | ≈ 168 000 | 200 000 |
| `fonts/` | 0 | 40 075 (ART.md) | 160 000 |
| ZIP | 2 384 718 B *measured* | ≈ 2 590 000 | 2 800 000 |

| | Global Wind today | after (estimate) | cap |
| --- | --: | --: | --: |
| app code | 106 299 B *measured* | ≈ 147 000 | 200 000 |
| `fonts/` | 0 | ≤ 160 000 | 160 000 |
| ZIP | 1 106 271 B *measured* | ≈ 1 310 000 | 1 600 000 |

The estimates: flow ≈ 14 KB, `flow-math.js` ≈ 5 KB, `units.js` ≈ 3 KB, the track ≈ 5 KB, focus
≈ 3 KB, hooks ≈ 3 KB, the look's CSS ≈ +6 KB; in the ZIP a font is stored as it is, the code deflates
to about a third, and this file and `ART.md` add about 25 KB. Headroom today (*measured*): 415 282 B
of ZIP and 72 442 B of code in Global Weather; 493 729 B and 93 701 B in Global Wind. The ZIP ships
the committed demo snapshot, which only the pipeline changes.

**Frame time** (headless, a trend): the flow at the default count ≤ 5 ms a frame in headless
Chromium (*measured* 4.9 ms for the pair at 2 600 in the bench) and ≤ 2 ms in WebKit (*measured* 2);
the base, with the cached geography, about 18 ms in Chromium on the map against 31.7 today
(estimate: 31.7 less the 13 ms of geography). The phone has no number yet.

---

## 7. Cut, owner calls, risks

### 7.1 Cut

- **WebGL** for the flow or the base (RESEARCH R8): reconsidered only if the phone fails at the
  bottom of the step-down ladder.
- **Polyline trails, degree-space advection, the screen-space field, a threshold filter** (R3–R5).
- **Color by speed from the wind ramp** as a default (R8, §8).
- **An opening animation** and any motion that is not the field or an answer to a touch.
- **Still streaks under Reduce Motion** (one prewarm drawn and left still): honest, but the rule says
  arrows; listed as an owner call instead.
- **A rate control**: the rung is automatic and printed; a slider for "speed" would invite reading
  speed off a setting rather than the wind.
- **Gusts, other heights, hourly steps**: the snapshot does not hold them, and the pipeline is out of
  scope.

### 7.2 Owner calls

Listed, with what each was chosen over, in `tools/DECISIONS.md` (not shipped). The numbers this
file cites are that list's.

### 7.3 Risks, and the phone check

- **WebKit canvas performance on the phone** is unknown. Headless Chromium rasterizes on the CPU
  (the map's base 31.7 ms), desktop WebKit on the Mac's GPU (11 ms); an iPhone's WKWebView is
  neither. The step-down ladder exists so the flow degrades instead of stuttering, but whether it
  reaches its floor on an older phone is the first phone check. Recorded in the device matrix and
  `NOTES.md`: frame time on the map and the globe with the flow on, at rest and while playing; the
  three-speed scrub; the iOS thumb-grab behavior of today's slider (§2.1); memory after five minutes;
  background and return; a Shortcut delivery while open; focus mode in Snuggery's full screen (the
  ghost key below the status bar, and a tap on it); a VoiceOver swipe up and down on *Forecast time*
  (one step each) and a tap on the plate (the place and value read once); the phone on its side.
- **Battery**: a 60 Hz animation for as long as the page is open. It stops when hidden and while
  About is open; owner call 8 decides whether it also rests.
- **The terminator over the trails**: handled by §1.12; without it a bright streak would cross a dark
  night side.
- **The 2° grid near coasts**: a grid point is the 0.25° model's value at that one point, sampled
  every 2° (about 220 km; `scripts/global_weather.py` takes every eighth value, it does not average),
  so a point on a peak or a coast carries that spot's weather. The flow is smooth across coastlines,
  mountains and straits smaller than the sampled grid, and at the deepest zoom one cell spans 160 px
  of interpolated motion. About and `NOTES.md` say so.
- **Mercator speed**: a polar streak runs faster on the flat map (§1.4); stated on the map and in
  `NOTES.md`; speed is never encoded by length.
- **Memory**: 25–45 MB of canvas backing (§1.9) on top of the 5.4 MB of resident u, v.
- **The camera**: the strings in §0 are asserted by `check.mjs` and `shoot.mjs`; a library left in
  focus mode hides the *Globe* tab the camera taps (the camera could press *Show the controls* first;
  that guard belongs to `Tests/`, outside this folder); the map opens on the reader's longitude, so
  the simulator's time zone picks the camera's opening view; the flow makes the light and dark shots differ by their particles; a continuously
  animating web view has precedent in the camera (Milky Way, Snug Kart) but has not been run with
  these two apps.
- **The fade residue** if the pair is dropped to its single-canvas rung: a rebuild every 4 s, not
  a veil.

---

## 8. Constraints on the art direction

`ART.md` decides the look; whatever it decides must keep these:

- **The canvas is most of the screen.** Chrome is compact, type restrained, controls modest; hit
  areas ≥ 44 px even where the drawn key is smaller (today's 34 px map keys fall short).
- **The streaks must read in both themes** over all five layers' ramps, over the bare ground and the
  night side, at the contrast `ART.md` sets (3.0:1 by day and 2.5:1 at night, on the streak head)
  and `shoot.mjs` samples. They are not drawn in any hue of
  a data ramp. If any property of a streak — alpha, width, color — encodes speed, it encodes the
  **sampled speed**, monotonically, through the legend's scale, and the legend says so; never
  on-screen length or speed (§1.4).
- **The three credits** stay on screen in every mode, readable over any weather, words unchanged.
- **The forecast's age stays on screen** in every mode, with the stale and ran-out words.
- **The camera's strings** (§0) and the `gwe.*`/`gw.*` keys.
- **SI** formats only through `js/units.js`.
- **Fonts**: OFL, vendored as subsets under `fonts/` with `OFL.txt`, credited in About and
  `NOTES.md`, ≤ 160 000 B; loaded (`document.fonts.load`) before the canvas draws place names,
  which use the same face.
- **Nothing from the generated-page tell list** unless chosen for this brief: today's glass cards with
  one shared shadow, the blue accent, the pills, the system font and the middle-dot strings are the
  stock look this pass exists to replace.
- **Motion**: the flow is the one moving thing; the scrub's thumb and labels never transition;
  Reduce Motion removes every transition.
- **Both themes** as tokens on `:root`, redefined for dark; theme-color metas per scheme; the layout
  holds at 320 px with no horizontal scroll and at 125 % text zoom.
- **US English** in every word on screen; no AI vendor or model name anywhere shipped.

---

## 9. Global Wind, by copy

Global Wind gets the same layer and the same look, copied by hand — a mini-app is one folder and
must stay deletable on its own. What differs:
- The data half: schema 1 (`speed`/`dir` per step, `encoding.speedStep`), one field, no chips. Its
  `values()` builds the same u, v, so `flow-math.js` copies unchanged.
- Its arrows are always drawn today and its color layer has its own key (`btn-heat`): it gains the
  Arrows key (owner call 10) so Flow and Arrows give the same four states.
- Storage `gw.*` (`gw.flow`, `gw.arrows`, `gw.focus` added); the test hook `window.__gw`.
- The camera taps its *Zoom in* and *Zoom out* **buttons** by label and waits for *Updated*.
- Budgets: ZIP ≤ 1 600 000 B; the same 200 000 B of code and 160 000 B of fonts.
- Its own `DESIGN.md` (this file's §1–§6, schema 1's notes) and its own copies of the three tools.

## 10. Files

```
global-weather/
  index.html  style.css  app.js        the app; app.js imports the modules below
  js/flow-math.js                      pure: kernel, particle projections, rate ladder, fade, PRNG (test_flow imports it)
  js/flow.js                           the layer: canvases, loop, seeding, step-down, prewarm, gestures
  js/track.js                          the time track (§2)
  js/units.js                          every number and unit the app writes (§4)
  js/ramps.js                          the five ramps per theme, as tools/art/palette.py --json prints them
  fonts/                               ysabeau-office-gw.woff2 (the one face) and OFL.txt
  DESIGN.md  ART.md  NOTES.md  PROMPT.md   shipped (NOTES gains "What the streaks are")
  assets/  data/                       unchanged
  screenshots/                         app.png (the README composite) and the scenes; not shipped
  tools/                               not shipped: check.mjs  shoot.mjs  test_flow.mjs  RESEARCH.md  DECISIONS.md  art/  .work/ (ignored)
```

## After review (2026-10-01)

What two reviews changed in behavior, all checked by `tools/shoot.mjs`:
- The exposure line's height is fixed (§1.13), which ends a resize loop at 45°.
- The Play key shows Pause while playing.
- About holds play and drawing still (§1.14), and Reduce Motion plays whole steps (§1.14).
- The globe is not drawn with streaks while it turns (§1.11).
- The ladder is judged only on pairs of quiet frames and never during play (§1.8).
- `#top` is not redrawn during play unless it carries arrows (§1.9), the readout card is updated in
  place, and the track reads its colors once per theme.
- The readout card keeps clear of the tapped place, and focus mode closes it (§3). The ghost key
  and the card sit below the top safe area in focus mode.
- The map opens on the reader's longitude, both views refit to the plate until the reader zooms,
  and a phone on its side gets its own layout (`ART.md`).
- VoiceOver hears units and dates in words (§4).
- The coast is no longer stroked along the cut-off edge of Antarctica, and the graticule stops
  where the map does.

The record, finding by finding, is `tools/DECISIONS.md`.
