# US Quakes — design

The design US Quakes is built from, written before any app code from the plan's brief ("US maps
from USGS open data") and the pinned sources in `tools/RESEARCH.md`. The byte layout of every data
file is in `tools/CONTRACT.md`; this file says what the app does with them. Where the build changes a
number, the number here is updated and `NOTES.md` says what it was and why.

How it looks, moves and speaks is `ART.md` (the look is called **Drum Record**); where this file
states a color, size, typeface or motion, it is ART.md's, and the two are kept in agreement.

Every size and count marked **measured** was measured on 2026-09-30 over the pipeline's cache
(`Template/scripts/us_quakes/cache/`) by `tools/design_measure.py`, which writes nothing; the command
and everything it printed are in `tools/CONTRACT.md` §12. Numbers marked *estimate* become measured
when the pipeline writes the file, and the pipeline asserts the cap next to each one.

This file ships inside the app's ZIP, as Earth's History's does (the ZIP leaves out `tools/`,
`screenshots/` and dotfiles, not root Markdown). It carries no web links; the one address pattern
(§8.3) is text the app prints.

---

## 1. What it is

A map of every cataloged earthquake in four boxes around the United States — the Lower 48, Alaska
with the Aleutians, Hawaii, and Puerto Rico with the Virgin Islands — from the first one on record
(1638) to the last hour. Two ways in:

- **Live**: the last day, week or month, straight from the U.S. Geological Survey's feed, refreshed
  hourly by a job and carried to the phone by a Shortcut. Every size, including the small ones.
- **History**: a timeline from 1900 to now, with a stub for the 625 earthquakes recorded before 1900,
  a window of a month, a year, a decade or everything, a magnitude floor, play, and seven stories to
  jump to.

A tap on a dot says what it was; a line dragged across the map turns into a cross-section of depth
against distance at true scale, which is how the Pacific plate diving under Alaska becomes visible.
Faults, volcanoes with their live alert color, shaded relief, depth bands of the sea, and state
lines sit under the dots.

It is not a warning service, and it says so where a person looks first (§10).

## 2. Ground rules

- **Snuggery's runtime**: one ZIP with `index.html` at the top or inside one wrapping folder;
  relative paths only, no `..`, no symlinks, no encryption; ≤ 10,000 files, ≤ 512 MB, ≤ 128 MB per
  file, folders ≤ 16 deep; **no network of any kind** and no `http(s)://` in any `.html`, `.css` or
  `.js`; no JavaScript-to-native bridge; ES modules and `fetch()` of the app's own files work;
  `localStorage` persists (every access in try/catch); must work on a phone screen in light and dark
  mode. Tested served over HTTP, never from `file://`.
- **The only file that changes after install is `data/snapshot.json`.** Everything else — the
  history to the cutoff, the map, the faults, the relief, the text — ships in `assets/` and changes
  only when a new ZIP is installed.
- **A drawn thing is a measured thing.** Every dot is a catalog row, placed, sized and colored
  from that row's own values after the rounding `tools/CONTRACT.md` §1 states. No smoothing, heat map,
  interpolation, animation between positions, or invented event. Where the catalog has no value
  (no depth, no magnitude), the app draws that absence (§6) instead of a default.
- **Display choices are named as such.** The relief's level stretch and shading, the color ramps,
  the fade of older dots, the rims and the dot-size rule are presentation; About says so in as many
  words.
- **No number without a source.** Every value on screen comes from a shipped data file, and every
  sentence that explains a USGS field or makes a claim about an earthquake is quoted from a USGS page
  saved under `scripts/us_quakes/credits/` before it ships (§10.3 lists the ones still owed). Nothing
  is typed in from memory.
- **Licenses.** Everything is public domain: USGS works (ComCat, the feeds, 3DEP, the fault database,
  the volcano API) and Natural Earth by its authors' dedication. USGS asks for credit, and gets it on
  screen, in About and in `CREDITS.txt`. License text and every web address are printed as text,
  never as links.
- **Language and units.** English for a US audience, US spelling. **SI by default** (km, m; depth and
  distance in km, elevation in m), thousands grouped with a narrow no-break space (U+202F), never a
  comma, so "1 882" cannot be read as a decimal; a US-units switch (mi, ft) sits one tap away in
  Layers and About. Dates in the scientific form `1964-03-28 03:36 UTC`; live events add the phone's
  own local time. No text names any AI vendor or product.
- **Targets.** 390 × 844 CSS px portrait, DPR 2–3, the iOS 18 WKWebView. ZIP ≤ 8,000,000 bytes, about
  6.5 MB expected (§13).

---

## 3. The screen at 390 × 844

```
┌──────────────────────────────────────┐  safe-area top inset
│ US Quakes         [Live|History]   ⓘ │  top bar                         44
├──────────────────────────────────────┤
│ (Lower 48)(California)(Pacific NW)(… │  region chips, scrolls sideways   (over the map)
│                                   ▤  │  Layers
│                                   ⟋  │  Section
│            the map                   │
│   (base canvas · WebGL · overlay)    │  map panel                      ~648 (flex)
│                                      │
│ ├──100 km──┤ at 38° N      ▬▬▬ depth │  scale bar · compact legend
│   Not a warning service · USGS · NE  │  credit line
├──────────────────────────────────────┤
│ ────  (grip)                         │
│ USGS feed 14:05 UTC · 2 h ago [D|W|M]│  Live peek                        152
│ ┊┊│┊┊┊┊│┊┊┊┊┊●┊┊┊┊┊┊│┊┊┊┊┊┊┊┊┊┊┊┊//// │  the record strip (56 px)
│ M 4.9  48 km S of Sand Point, AK  ›  │
└──────────────────────────────────────┘  safe-area bottom inset
```

The page is one CSS grid, `grid-template-rows: auto 1fr auto` over `100dvh`, with
`env(safe-area-inset-*)` padding and a 16 px side gutter for the sheet (the map runs edge to edge).
Only the map is flexible. At peek the map panel is 844 − 44 − 152 = **648 px** before insets
(about 556 px on a notched phone).

Numbers in the sketches and example strings of §3 are layout, not data; a value quoted as data is
marked **measured** and says where it came from.

### 3.1 Top bar (44 px)
"US Quakes" in Atkinson 700 at 15 px on the left; a two-segment control **Live | History** (28 px
tall, 44 px hit area; a radio group; ART.md "Designed objects") in the middle-right; **About** (ⓘ,
44 × 44) on the right. Nothing else. A 1 px `--line` under it.

### 3.2 The map panel
Five stacked canvases (§5) and a few HTML controls on `--glass` (a flat 90 % fill, no blur) over them:

- **Region chips**, a row 8 px under the panel's top edge: *Lower 48 · California · Pacific
  Northwest · Alaska · Hawaii · New Madrid · Oklahoma · Yellowstone · Puerto Rico* (§4.4).
  Square-ended tabs, 26 px tall with a 44 px hit area, a 4 px radius, 11.5 px Atkinson, scrolling
  sideways with a fade mask at both ends. A tap eases the view to the region (450 ms; a jump under
  Reduce Motion) and marks the chip (`--ink` fill) until the view is moved.
- **Tools**, a column on the right edge under the chips: **Layers** (§10.1) and **Section** (§9),
  36 px glass squares with ink line icons (Section's is `A—A′` in mono), 44 px hit,
  `aria-pressed` on Section, `--ink` filled when on.
- **Scale bar**, bottom left (§4.5), in 10.5 px mono.
- **Compact legend**, bottom right: a glass tab with "Depth", the depth ramp as a 112 × 6 px bar and
  "0 · 35 · 300 km" in mono ("0 · 22 · 186 mi" with US units, §25); a tap opens the full legend, "Reading the map" (dot sizes for M 3, 5, 7,
  9; the ramp with all six stops; hollow = automatic; gray = no depth; × = no magnitude; three fault
  weights; the volcano triangles; the play trace), as a card above it. Every key is drawn by the
  app's own renderer.
- **Credit line**, one 10.5 px line under the legend: "**Not a warning service** · USGS · Natural
  Earth", the first clause in `--ink` 700; a button to About's sources. It is on screen at every
  sheet height where the map is.
- **Notices**, one line each on glass, centered above the scale bar when they apply: "Restoring the
  map…" (context loss); "`A—A′` Drag across the map to draw a section" (Section on, no line yet);
  "This copy is 3 days old. It shows nothing newer than {feed time}." (feed older than 48 h).

If WebGL 2 is missing the panel says "This map needs WebGL 2, which this device does not offer." and
draws no map at all — never half a map: no base, lines, volcanoes or labels, and no chips, keys,
legend or scale bar; only the sentence and the credit line — while the sheet still lists the events
(§11.3, §24).

### 3.3 The bottom sheet — three heights
A grip at the top; tap it to cycle heights, drag it (44 px per step), or ↑/↓ on the focused grip.
The height is remembered.

| Height | Sheet (px at 844) | Map at 844 |
| --- | --- | --- |
| **Peek** (default) | 152 | 648 |
| **Half** | 400 | 400 |
| **Full** | everything under the top bar | 0 |

The sheet is `--panel` with a 1 px `--line` top edge, a 6 px top radius, a 34 × 4 px grip and no
shadow over the map. It has a **fixed head** (the mode's controls: Live's stamp and window, or History's label,
timeline and chips) that never scrolls away, and a **body** that scrolls under it. Selecting an event
lifts the sheet to Half if it is at Peek and puts the event card (§8) at the top of the body; its ×
returns the body to what it showed. A long press and a drag along the Live strip lift it only when the
finger leaves (§24), so nothing moves under a held finger.

### 3.4 Live (the default mode)
**Head** (peek, 136 px under the grip):
1. The stamp: "USGS feed **14:05 UTC** · 2 h ago" (Atkinson, the time in mono) — the feed's own
   generation time, and its age by the phone's clock. **No amber, no red** (amber is a depth on this
   map): from 3 h it reads "· 5 h ago, not refreshed since" with the age in `--ink` 700; from 48 h
   the map's notice (§3.2) and the first line of the body say "This copy is 3 days old…". On the
   right, **Day | Week | Month** (segmented, 28 px).
2. **The record strip** (56 px, ART.md "The signature control"): one ink stem per earthquake in the
   window at its time and magnitude, heads in the depth color from M 4.5, the largest labeled, the
   count on its label line ("1 882 earthquakes · 44 hollow"), and a hatched tail for the time since
   the feed. A tap or drag on it selects the nearest stem's event.
3. The largest event of the window as one row: "M 4.9 · 48 km S of Sand Point, Alaska · 3 h ago ›",
   magnitude and age in mono.

After a refresh brings new rows, a line "12 new since 13:05 UTC" replaces row 3's right-hand age until
the next window change or ten minutes pass (ART.md, "The live feed").

**Body** (Half and Full): the not-a-warning line first (§10.2); the ten largest events of the window,
one row each (the event's own dot at its map size, capped at 14 px; magnitude in mono; place; time;
depth), a tap selects and flies to it; per-box counts ("Lower 48 612 · Alaska 988 · Hawaii 201 ·
Puerto Rico 81"); an **All sizes | M 2.5+** toggle (default All sizes); the volcano line ("3
volcanoes above Normal: Great Sitkin (Watch, Orange), …", with "as of" when the reading is older
than the feed); the credit block.

The default window is **Month** (the richest honest picture, and the one the opening replays,
ART.md "Signature moments" 1). The window is measured back from the **feed's time**, not the phone's
clock: Day is the 24 h before the feed was generated. A phone with a wrong clock shows the same
events; only the stamp's "ago" and the strip's tail move.

### 3.5 History
**Head** (peek, 136 px under the grip):
1. The label row: "**1964** · M 4+ · 203 earthquakes · {k} in view", the year in Atkinson 700 and
   the rest in mono (203 is **measured**: M 4+ in the four boxes in 1964, `tools/art/study_data.py`) and a round **Play** key on the right (32 px, 44 px hit, a 1.5 px ink ring).
2. **The timeline** (56 px, §7.3): the record strip in its History form.
3. Two segmented controls in one row: window **Month | Year | Decade | All** and floor **2.5+ | 4+
   | 5+ | 6+** (default Year and 4+, the plan's default floor). Each floor segment draws, before its
   number, a disc at the map size of that magnitude (2.2, 3.7, 5.2, 7.4 px).

**Body**: the **stories** (§7.6) as a list of seven rows (year, title, one line); the ten largest
events in the window; a line under the chart's meaning ("More dots in recent decades mostly means
more seismometers, not more earthquakes." — §10.2); the credit block. A story row opens its card at
the top of the body.

### 3.6 Wide screens and landscape
At a viewport width ≥ 700 px (a phone turned sideways included) the grid becomes two columns: the map
on the left at full height, the sheet as a 380 px column on the right, always at Full, grip hidden.
Nothing else changes.

---

## 4. The map

### 4.1 Projection and the axis
Web Mercator on a sphere, over one continuous longitude axis that runs **172° E → 296°**, i.e. from
the western Aleutians eastward across the date line to 64° W: any longitude west of 172° E (the
Americas at −180…−65) gains 360°, so Attu sits at 172.9 and San Juan at 293.9, and the Aleutians never
split. Latitude runs 17° N to 72° N. Every data file uses this axis (`tools/CONTRACT.md` §0); only the
basemap runs past it, on the same axis, to 168° E–55° W and 25° S–81° N (§4.2, §25).

World units: `X = (λ − 172°) / 360°`, `Y = (m(72°) − m(φ)) / 2π` with `m(φ) = ln tan(π/4 + φ/2)`, so X
and Y are fractions of the equator's circumference and a unit square is square on screen. The box is
0.3444 wide and 0.2454 tall. A view is `{cx, cy, s}` — the world point at the panel's center and CSS
px per world unit; screen = `(X − cx)·s + w/2`, `(Y − cy)·s + h/2`. Pan and zoom are similarity
transforms of the screen, which §5.4 relies on.

### 4.2 Limits
- **Out:** the whole box fits the panel (s ≈ 1,132 at 390 px wide: 1 CSS px ≈ 25 km at 45° N).
- **In:** 1 CSS px = 0.002° of longitude (s = 180,000), the history's longitude step (§CONTRACT 1), so
  a dot's stored position never claims more precision than a pixel. That is 159× the widest view.
- **Pan** is clamped so the map on screen (the panel above the sheet, the chips row included) stays
  inside the basemap, `geo.json.basemap` (168° E–55° W, 25° S–81° N): every region chip's framing on a
  phone, at every sheet height and in focus mode, lies inside it, so no view reaches past the map's
  edge. Where the panel is wider or taller than the basemap (the opening's whole arc, the widest zoom)
  the view holds all of it and the paper beyond is hatched, the strip's "no record" (§25).

### 4.3 Gestures
Pointer events on the top canvas, one handler:
- **drag** pans (a fling decays at 0.92 per 16 ms frame, stops under 0.02 px/ms; none under Reduce
  Motion);
- **pinch** zooms about the pinch center;
- **double-tap** zooms 2× about the tapped point (250 ms);
- **tap** (up within 8 px and 300 ms) selects (§8.1); **long press** (500 ms still) lists (§8.2);
- with **Section** on, a one-finger drag draws the section line and two fingers pan and zoom (§9.1).
Keyboard on the focused map: arrows pan 64 px, `+`/`−` zoom 2×, Enter selects the event nearest the
center.

### 4.4 Region chips
Each chip fits its box (west, south, east, north, degrees; stored in `geo.json.views`) into the part of
the panel that is free: below the chips row, above the foot's scale bar, legend and credit line, and
above the sheet at its current height, 8 px clear of each and 16 px from the sides. The key column
at the top right is kept clear (a 60 px right margin) only when the fitted box would reach its height
(§23).

| Chip | Box | Why this box |
| --- | --- | --- |
| Lower 48 | −125.0, 24.3, −66.9, 49.5 | the default first view |
| California | −124.5, 32.4, −114.0, 42.1 | |
| Pacific Northwest | −127.5, 41.8, −116.4, 49.3 | the Cascadia margin offshore included |
| Alaska | 172.0, 51.0, −129.5, 71.5 | the Aleutians to the Panhandle |
| Hawaii | −160.4, 18.8, −154.7, 22.3 | |
| New Madrid | −91.2, 35.0, −88.3, 37.8 | the seismic zone of 1811–12 |
| Oklahoma | −103.0, 33.6, −94.4, 37.0 | the story's box; takes in edges of Texas and Arkansas |
| Yellowstone | −111.6, 44.0, −109.7, 45.2 | |
| Puerto Rico | −67.95, 17.6, −64.5, 18.6 | the Virgin Islands included |

The chips are views, not the catalog's boxes: counts labeled "in the four map boxes" use the
catalog boxes of `RESEARCH.md` §1, and "in view" uses the panel.

### 4.5 Scale bar
Mercator's scale varies with latitude, so the bar is computed at the latitude of the panel's center:
km per CSS px = `2π · 6371.0088 · cos φ / s`. The bar's length is the largest of 1, 2 or 5 × 10ⁿ km
(mi with US units) that fits 120 px, drawn as a 1 px rule with end ticks, labeled "100 km · at
61° N" in 11 px. The "at" clause is the honest part: at the same zoom, 100 km at 61° N is twice as
long on screen as at 20° N, which is why Alaska looks huge (§10.2).

### 4.6 State kept between launches
`localStorage`, keys prefixed `uq.`, every access in try/catch: `mode`, `liveWindow`, `liveAll`,
`histWindow`, `histAt` (the thumb, minutes since the epoch), `floor`, `view` `{cx, cy, s}`, `layers`,
`units`, `sheet`, `section` `{a, b, hw, ve}`, `story`, `intro` (set before the opening starts, ART.md). A broken or missing value falls back to its
default; nothing else is stored.

---

## 5. Rendering

### 5.1 Five canvases, bottom to top
The order puts every line **under** the dots, so a fault never crosses out the earthquakes along it
(ART.md, "Layers").

1. **`#base`, Canvas 2D** — the sea, the eight depth bands, land, lakes. Theme-dependent colors.
2. **`#relief`, WebGL2** — the relief as a shading overlay (§5.2), alone in its context.
3. **`#lines`, Canvas 2D** — coastline, country and state lines, faults (§5.7 items 1–3).
4. **`#gl`, WebGL2** — every earthquake as a point, and the play trace (§7.5).
5. **`#over`, Canvas 2D** — volcanoes, labels, the selection ring, the section line and corridor,
   the story annotation (§5.7 items 4–7).

Both WebGL2 contexts: `getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias:
false, depth: false, stencil: false, preserveDrawingBuffer: false })`, cleared to transparent,
composited by the page. All five are panel size × `min(devicePixelRatio, 2)`, set in one
`ResizeObserver`. Plain WebGL2, no library, Norne Reservoir's shape: a `program()` helper that
compiles, links and collects uniform locations (shared by both contexts), and a dirty-flag scheduler
(§5.6) with flags `base`, `relief`, `lines`, `gl`, `over`, `sheet`, `timeline`.

### 5.2 The relief
Four textures, one per `relief-*.jpg` (§CONTRACT 5), uploaded as **`R8`** straight from the decoded
image (`texImage2D(TEXTURE_2D, 0, R8, w, h, 0, RED, UNSIGNED_BYTE, bitmap)`), `LINEAR_MIPMAP_LINEAR`
/ `LINEAR`, mipmapped, `CLAMP_TO_EDGE`. Each is a quad whose corners are its bounds on the axis in
world units; because 3DEP returned Web Mercator, a pixel row is a map row and the quad maps linearly.
Gray `v` (0–1) against the image's flat-ground value `n` (`geo.json.relief[].neutral`) becomes a
premultiplied overlay:

```
dark  = clamp((n − v) / n, 0, 1) · uDark        light = clamp((v − n) / (1 − n), 0, 1) · uLight
out   = v < n ? vec4(0, 0, 0, dark) : vec4(light, light, light, light)
```

Pixels at `n` change nothing, which is how the build's mask works: the sea inside a 3DEP tile, NoData
and Natural Earth's lakes are written as `n` (§CONTRACT 5), so only US land is shaded. `uDark` /
`uLight`: **0.50 / 0.20** light theme, **0.55 / 0.08** dark (ART.md: the land is a surface for dots,
not a picture of itself; tuned on the Lower 48 at the default view, never above 0.55 / 0.30; the light
theme's shade was raised from 0.40 in the QA pass, §23). Relief
covers what 3DEP returned: US land and, near the borders, parts of Canada and Mexico (the Bahamas have
none), as About says; the CONUS tile's edges fade over 0.5° (`uEdge`, §24), so its rectangle ends
softly over Mexico and British Columbia instead of in a hard line. It is not masked to US land: the
basemap runs on into Canada and Mexico (§25), and a relief that stopped at the border would read as a
cut there. The image is a hillshade with its levels stretched — a display transform of a measured
elevation product, labeled "shaded relief".

### 5.3 The earthquakes: one buffer, one draw
**The buffer.** One `ARRAY_BUFFER` laid out by column, allocated once with room for the history plus
**60,000** snapshot rows (grown by half, and re-uploaded, if a snapshot ever needs more): `t`
(uint32) × cap, then `x`, `y`, `d` (uint16) × cap each, then `m`, `f` (uint8) × cap each. The
history's columns are uploaded once with `bufferSubData` straight from the `.bin` (no transform, no
copy); a new snapshot writes its rows after them. Attributes point into the
column regions: `t` with `vertexAttribIPointer(UNSIGNED_INT)`, `x`, `y`, `d` as unnormalized
`UNSIGNED_SHORT`, `m`, `f` as `vertexAttribIPointer(UNSIGNED_BYTE)`. Time stays an integer on the
GPU: 224 million minutes would lose 16 minutes in a float.

**Draw order.** An index buffer (`Uint32Array`, one entry per row) sorted by magnitude code ascending,
then time, built with a counting sort over the 256 codes (O(n)); `drawElements(POINTS, n,
UNSIGNED_INT, 0)`. Large earthquakes draw on top of small ones; within a magnitude, newer on top.
Rebuilt when a snapshot arrives.

**Uniforms, not CPU.** The time window `uT0`, `uT1` (uint minutes), the floor `uMmin` (uint code), the
live boundary `uLive` (the snapshot's `liveFrom`), the view (`uCenter`, `uScale`, `uPx`), the fade mode,
the play trace's start `uTrace0` (§7.5), the section corridor `uSecA`, `uSecN`, `uSecHalf`, `uSecLen`
(§9.1), and the arrival fade `uNewFrom`, `uNewT` (§3.4). Playing the timeline changes two uniforms per
frame; nothing else moves. The rim is not a theme uniform: it follows the row's depth (§6).

**Vertex shader, per point:**
```
lon = 172 + x · 0.002        lat = 17 + y · 0.001          (degrees, the axis)
X = (lon − 172)/360          Y = (m(72°) − ln tan(π/4 + lat·π/360)) / 2π
visible = t ≥ uT0 && t < uT1 && (m ≥ uMmin || (m == 255 && uShowNoMag))
trace   = !visible && t ≥ uTrace0 && t < uT0 && m ≥ uMmin      (the play trace, §7.5)
if !visible && !trace → gl_Position = vec4(2, 2, 2, 1), gl_PointSize = 0
size, colour, alpha, hollow, rim  → §6; a trace point is 1.6 px of ink at α 0.14, no rim
```
The fragment shader draws a disc with a 1 device-px anti-aliased edge and rim, a ring when hollow, a
× for no magnitude; everything else is discarded.

`gl.getParameter(ALIASED_POINT_SIZE_RANGE)` is read at start; sizes clamp to its maximum (a real
device's value is recorded in the phone check, §13).

### 5.4 During a gesture
While a finger pans or pinches, **`#gl` redraws every frame** (a uniform change) and `#base`,
`#relief`, `#lines` and `#over` are **moved with a CSS transform** of their last rendering — exact,
because pan and zoom are similarity transforms of the screen (§4.1). They are redrawn when the
gesture settles, and at most every 250 ms during a long one. So the dots are always sharp, and the
basemap is briefly soft under a pinch. With Section on and a line drawn, `#gl` also redraws per
frame while the line's end is dragged (the corridor dimming, §9.1).

### 5.5 Context loss
Each WebGL2 context is handled on its own, through one shared path. `webglcontextlost`:
`preventDefault()`, stop the scheduler, forget that context's GL objects, show "Restoring the map…".
`webglcontextrestored`: rebuild that context's program and resources — for `#gl` the buffer (history
and snapshot re-uploaded from the kept `ArrayBuffer`s) and the index; for `#relief` the four
textures — then redraw. The notice clears when both contexts are live. `tools/shoot.mjs` forces a
loss of each with `WEBGL_lose_context` and fails on any console error. iOS drops contexts of
backgrounded pages; this path is what a person meets on return.

### 5.6 Redraw only on change
One `requestRender()` schedules at most one `requestAnimationFrame`; dirty flags `base`, `relief`,
`lines`, `gl`, `over`, `sheet`, `timeline` decide what that frame does. Only a fling, an eased move,
play, the opening, a new-snapshot arrival or a gesture keep frames coming; idle, nothing runs. A frame
where only the overlay changed does not touch WebGL, and the reverse.

### 5.7 The line layers
In CSS px on canvases scaled by the same factor, the same Mercator in JS (forward and inverse), paths
built per view from world-unit vertices decoded once. Colors and weights are ART.md's.

On **`#lines`**, under the dots:
1. Coastline (Natural Earth 1:50m), 0.9 px `--ink` at 55 %.
2. Country borders, 0.8 px at 45 %; state and province lines, 0.6 px dashed 3/2, at 30 %.
3. **Faults** by age (§10.1), in `--fault` (graphite in light, pencil in dark); a chain is drawn only
   when its screen extent is ≥ 2 px (the level of detail is the screen, not the data).

On **`#over`**, above the dots:
4. **Volcanoes** (§10.1): triangles sized by threat class, filled with the live aviation color code,
   a 1 px `--ink` outline over a 1 px `--panel` halo, empty when not monitored.
5. Labels: places from `geo.json.places` by rank and zoom, Atkinson 400 at 11 px in `--ink-2`, with a
   3 px `--bg` halo, sentence case, collision-tested in insertion order; volcano names at 10.5 px from
   8× the widest zoom.
6. The selection: a 1.5 px `--ink` ring 4 px outside the chosen dot over a 1 px `--panel` halo; for a
   fault, the chain in 2 px `--ink` over a 3 px `--panel` halo. Never a hue.
7. The section line, `A` / `A′`, its end handles and its corridor (§9.1).
8. A story's anchor annotation (§7.6).

Decimation: a vertex closer than 0.75 CSS px to the last one kept is skipped (the last vertex of each
line is always drawn), so stroke cost is bounded by the screen.

---

## 6. How an earthquake is drawn

Every rule is a function of the row's own stored values; the legend states each one.

- **Area by magnitude.** Diameter `d = clamp(2.2 · √2^(M − 2.5), 2, 40)` CSS px × `k`, where `k`
  grows gently with zoom (`k = clamp((s / s_L48)^0.2, 1, 2)`, `s_L48` the Lower 48 chip's scale).
  So **each whole magnitude doubles the dot's area**: M 2.5 is 2.2 px, M 4 3.7, M 5 5.2, M 6 7.4,
  M 7 10.4, M 8 14.8, M 9 20.9. The legend says it that way, and About adds that the energy released
  grows about 32-fold per magnitude, which no dot could show.
- **Color by depth**, one ramp for both themes, on the depth axis 0 · 10 · 35 · 70 · 150 · 300 km
  (clamped outside; above-datum negative depths take the 0 km color), interpolated in OKLab between
  ART.md's stops `#fde28d · #f5a231 · #dc6673 · #9a6299 · #5d47ad · #2a3b6b` — straw, amber, rose,
  mauve, violet, slate navy; shallow warm, deep cool, lightness falling monotonically (L* 90.4, 73.2,
  58.0, 49.4, 37.6, 25.8). **No stop is a signal red** (the design stage's `#e3665a` at 35 km was,
  and read as danger), and the deep end stays visible on the dark theme's sea. Under simulated
  protanopia, deuteranopia and tritanopia (Machado et al. 2009, full severity) L* still falls at every
  step and neighboring stops stay ≥ 11.7 apart in ΔE2000 (`design_measure.py ramp`, CONTRACT §12,
  output quoted in ART.md). `tools/check.mjs` repeats that check (monotonic, ≥ 10) on whatever stops
  ship, and checks `js/ramp.js`'s stops equal ART.md's. The legend calls it "Depth", never
  intensity.
- **The rim follows the depth, not the theme.** Every dot carries a **1 device-px rim**: dark,
  rgba(16, 20, 24, 0.55), for a depth under **60 km** and for no depth; light, rgba(255, 255, 255,
  0.50), from 60 km. So an earthquake's mark is identical in both themes, and whichever of fill and rim
  differs from the ground carries the contrast (ART.md, "Rims", with the figures). In the section plot
  the light rim is 0.30, because at 0.50 a dense cloud washes out.
- **No depth** in the catalog (1,492 rows, 607 of them before 1900, **measured**): a neutral gray fill
  `#8a9099`, never the shallow color. **No magnitude** (180 rows, all before 1900): a small × in ink
  at a fixed 6 px, drawn only while the window includes pre-1900 years, whatever the floor.
- **Section corridor** (§9.1): while a section line exists, rows whose great-circle cross-track
  distance exceeds the half-width, or whose along-track position is outside A–B, draw at α 0.25.
- **Arriving rows** (§3.4): rows with `t ≥ uNewFrom` fade from 0 to their own alpha as `uNewT` runs
  0 → 1 over 400 ms, staggered by time; size never changes.
- **Older events fade** within the window: `alpha = mix(0.30, 0.90, (t − t0) / (t1 − t0))` for
  Month, Year and Decade windows and for Live; the All window uses a flat 0.5, because 385,000 dots at
  full strength would be a solid mass. A display choice, named in the legend.
- **Hollow = an automatic solution in the live window**: `status` automatic and `t ≥ liveFrom` (the
  snapshot's 30 days). A ring of width max(0.9 px, 0.18 d) in the depth color, empty inside, never
  drawn smaller than an M 4 dot (3.70 px × `k`), so its hole shows at every magnitude (§24). Older
  rows flagged automatic are drawn solid — the catalog lists the 1964 M 9.2 itself as automatic
  (`RESEARCH.md` §1) — and the event card states the flag as USGS gives it.

---

## 7. The time model

### 7.1 Two sources, one boundary
- **`assets/history.bin`** holds every earthquake in the four boxes from 1600 to the **cutoff**
  (`history.json.cutoff`, 2026-01-01 in this build): every one before 1900, magnitude or not, and
  M 2.5 and up from 1900 — **385,076 rows, measured**. It ships in the ZIP and never changes on the
  phone.
- **`data/snapshot.json`** holds M 2.5 and up from **a year before the cutoff** (2025-01-01) to the
  feed's time, plus every magnitude for the last 30 days, in the same columns (§CONTRACT 1), so one
  decoder reads both.

**The rule:** rows with `t < cutoff` come from the history, rows with `t ≥ cutoff` from the
snapshot. Snapshot rows before the cutoff are skipped when the buffer is filled. No id matching is
needed, and no row can appear twice.

**The gap.** The year of overlap lets a phone skip one yearly ZIP without a hole. If the snapshot's
first row is later than the history's cutoff (an old ZIP with a new snapshot), the timeline hatches
the missing stretch and History says, under the timeline: "No data from 2026-01-01 to 2027-01-01 in
this copy: the app's history ends 2026-01-01, and the live data starts 2027-01-01. Install the app's
latest ZIP to fill it." If the snapshot ends before the cutoff (a stale snapshot under a new ZIP), Live
says "The live data here is older than the app's history (feed of 2025-11-03)" and History ends at
the cutoff. Neither is hidden, neither is filled.

**No snapshot, or a broken one** (§11.2): History works to the cutoff; Live shows the reason in words
and no dots.

### 7.2 Live windows
Day, Week, Month = the 1, 7 and 30 days before `feed.generated` (§3.4). With **All sizes**, every
row in the window; with **M 2.5+**, the floor code 45. The fade runs over the window.

### 7.3 The History timeline (56 px): the record strip
One custom `role="slider"` element over a canvas, full content width (358 px), drawn as ART.md's
record strip: `--rule` ruling, a 1 px `--ink` baseline, ink bars, hatching where there is no record.
Rows 0–10 are a 10 px mono label line, 12–44 the plot band (32 px), 44 the baseline, 47–56 the axis
labels.

- **The axis**: the left 25 px is the stub, 1600–1900, hatched, cut from the linear part by an
  axis-break mark `//` on the baseline; the rest is linear from 1900-01-01 to "now" — the snapshot's
  last minute, or the cutoff without a snapshot — about 2.6 px a year. Ticks: "1900", "1950", "2000",
  and the current year at the right edge, 10 px mono.
- **The bars**: earthquakes per calendar year at or above the current floor, 1900 → now, one `--ink`
  bar a year, 0.6 px apart, linear scale to the tallest year, 32 px tall at most, with its maximum
  in the label line ("max 910 · 2020" at 4+; "max 26 763 · 2018" at 2.5+ — both **measured**,
  `tools/art/study_data.py`). Bars inside the window at α 1, the rest at α 0.42 (0.7 once played,
  §7.5): emphasis by ink, never by color. The stub is hatched, with "625" above it. The current
  year's bar is hatched as partial. Counted in JS once per floor change (one pass over the rows,
  ~2 ms estimate) into four `Int32Array`s. The one-line note under the chart is §10.2's first note.
- **The window** is a bracket of two 1 px `--ink` verticals with 3 px feet at the top over a 7 %
  `--ink` wash, calendar-aligned: Month = the calendar month containing the thumb, Year = its
  calendar year, Decade = its calendar decade (1960–1969), All = 1600 to now; in the stub every width
  shows "Before 1900" (1600-01-01 to 1900-01-01). The label row says it: "March 1964", "1964",
  "1960s", "All, 1638–2026", "Before 1900"; a window that runs into the present says "2026 (to 30
  Sep)".
- **The thumb**, a 12 px ring (2 px `--ink`, `--panel` fill) on the baseline with a 44 × 44 px hit
  area, follows the finger; the window snaps to the unit under it as it moves. Keys: ←/→ one unit,
  PageUp/PageDown ten, Home the stub, End now. `aria-valuetext`: "1964, year window, magnitude 4 and
  up, 203 earthquakes".

### 7.4 Floors
2.5+, **4+** (default), 5+, 6+ — codes 45, 60, 70, 80. The chips' accessible names include
"magnitude … and up". A hint line under the chips when 2.5+ is chosen quotes USGS on completeness, shortened only with an
ellipsis: "Within the conterminous U.S., the level of completeness … is probably in the magnitude
3.0-3.5 range." (§10.2; the full sentence is in About).

### 7.5 Play
Play steps the window forward one unit at a time: Month every 400 ms, Year every 600 ms, Decade one
**year** every 600 ms (a sliding decade, labeled "1961–1970"); All does not play (the key is disabled
with "Choose a month, year or decade to play"). At now it stops; Play at now restarts at 1900. Each
step changes two uniforms and one label; the count comes from a binary search on the floor's sorted
time array (§11.4), not from a scan. Any touch on the timeline pauses. The label steps with no
rolling digits.

**The trace.** Play leaves the events it has passed on the map as faint `--ink` specks (1.6 px, α
0.14, no rim, no depth color): `uTrace0` is the play's first window start, and rows from it to the
current window draw as trace (§5.3). By the time play reaches now, a century of real events has drawn
the plate boundaries. The trace stays while paused, clears when the window is moved by hand or the
mode changes, and is named in the legend ("Faint specks: earlier in this play"). Bars already played
rise to α 0.7 on the strip.

### 7.6 Stories
Seven, from `assets/stories.json` (§CONTRACT 6), in time order: **1700 Cascadia · 1811–12 New
Madrid · 1906 San Francisco · 1964 Alaska · 2009–2017 Oklahoma · 2018 Kīlauea · 2019 Ridgecrest**.
A story sets the mode to History, the view to its box, the window and floor it names, selects its
anchor event and opens its card: a title, the date, at most 70 words, and its sources. Every number
in the text comes from the catalog rows it names or from a count the build made (§CONTRACT 6);
every claim beyond the catalog is quoted from a USGS page saved in `credits/`.

The anchor event is annotated on `#over`: its selection ring, and a leader line to a `--glass` tab
("M 9.2 · 1964-03-28", mono) placed in the emptiest quadrant around it. A story view eases in over
600 ms (a jump under Reduce Motion).

**Playing a sequence.** Three stories carry an optional `play` block (§CONTRACT 6): 1964 Alaska
(1964-03-27 → 1964-05-01, a day a step), 2018 Kīlauea (2018-04-30 → 2018-09-01, a week a step) and
2019 Ridgecrest (2019-07-01 → 2019-08-01, a day a step). Their card shows **Play the sequence**. It is
cumulative: the window is `[from, from + k·step)`, one step every 300 ms, the label saying exactly
what is drawn ("1964-03-27 to 1964-04-06"), and the strip's bracket following it. Stepping is a
state change, so it runs under Reduce Motion too.

| Story | Window, floor, view | Anchor (catalog id, from the cache — **measured**) |
| --- | --- | --- |
| 1700 Cascadia | Before 1900, Pacific Northwest | `official17000127050000000`, 1700-01-27 05:00, M 9 mw, no depth, position nominal (45°, −125°) |
| 1811–12 New Madrid | Before 1900, New Madrid | the four M 7s: `official18111216081500000` (7.5), `…131500000` (7.0), `official18120123150000000` (7.3), `official18120207094500000` (7.5); no depths |
| 1906 San Francisco | Year 1906, 2.5+, California | `official19060418131226300_12`, M 7.9 mw, 11.7 km |
| 1964 Alaska | Year 1964, 4+, Alaska | `official19640328033616_30`, M 9.2 mw, 25 km, flagged automatic in the catalog |
| 2009–2017 Oklahoma | Decade 2010s, 2.5+, Oklahoma, with the per-year M 3+ counts of the chip's box (4 in 2008, 888 in 2015, 6 in 2025) | `us10006jxs`, 2016-09-03, M 5.8 mww, near Pawnee |
| 2018 Kīlauea | Month 2018-05, 2.5+, Hawaii (12,565 M 2.5+ from 30 April to 31 August in the story's box) | `hv70116556`, 2018-05-04 22:32, M 6.9 mw, 5.81 km |
| 2019 Ridgecrest | Month 2019-07, 2.5+, California | `ci38443183` (M 6.4, July 4) and `ci38457511` (M 7.1, July 6, 8 km) |

The 2018 Anchorage M 7.1 at 46.7 km (`ak018fcnsk91`) is the Cook Inlet section's highlighted event
(§9.2) rather than a story.

---

## 8. Tap, long press and the event card

### 8.1 Tap
The nearest **visible** event (passing the window and the floor) within **22 CSS px** of the finger,
larger magnitude winning a tie within 4 px. Found through a grid index over the stored codes (cells of
256 × 256 codes, built once per data load), testing only the cells the 22 px circle covers. With no
event within 22 px, the nearest fault chain within 12 px is selected (§8.4); otherwise a tap clears
the selection.

### 8.2 Long press
Everything visible within 22 px, as a list in the sheet body ("14 earthquakes here"), largest first,
at most 50 rows with "and 12 more" beyond; a row selects its event. The list is built at 500 ms; the
sheet lifts on release, and the click that follows the release is swallowed (§24).

### 8.3 The card
Layout only; every `{…}` is filled from the data files:

```
M 7.1 · {type name} (mw)                                          ✕
2019-07-06 03:19 UTC
Depth 8.0 km · Ridgecrest Earthquake Sequence
Reviewed by USGS
Nearest mapped fault: {fault name}, {section}, {d} km · {age class}
Nearest volcano: {name}, {d} km · {alert level, colour code | not monitored}
earthquake.usgs.gov/earthquakes/eventpage/ci38457511
```

(The first, second, third and last lines are `ci38457511`'s own catalog values.)

As drawn (ART.md, "Designed objects"): a bulletin entry with a 1 px `--line` border, 6 px radius,
10 × 12 px padding, no shadow. The first line starts with **the event's own dot** at its map size,
then the magnitude in 17 px mono with the type code at 12 px `--ink-2`, and the ✕ (44 px hit) on the
right. The place is Atkinson 700 at 14 px; the time 12 px mono; the depth line ends in a **depth
gauge** — the ramp at 72 × 6 px with a 2 × 12 px `--ink` notch at the event's depth, a hatched gray
bar when there is none; the review, fault and volcano lines are 12 px `--ink-2`; the address is 11 px
mono, selectable, breaking anywhere.

- **Magnitude and type**: to one decimal as stored (§CONTRACT 1), with the catalog's type code and
  its plain name when a quoted definition exists (§10.3); an unnamed type shows its code only. No
  conversion between types, ever.
- **Time**: UTC to the minute (the history stores minutes); live events add "· 20:19 on your phone".
  Rows before 1900 add "(as the catalog lists it)"; About says why early times and places are
  nominal (§10.2).
- **Depth**: km to 0.1 (mi to 0.1 with US units). Exactly 10.0 km adds "— often the depth networks
  assign when it cannot be measured" (quote owed, §10.3). None: "Depth not given in the catalog".
  Negative: "0.8 km above sea-level datum".
- **Place**: the catalog's own place text, kept for every live event and for M 4.5 and up in
  history (§CONTRACT 1). Otherwise, computed and labeled so: "Near Tulsa (the map's place list),
  42 km NW" from the nearest of `geo.json.places` by great-circle distance.
- **Reviewed or not**: "Reviewed by USGS" / "Automatic — may change or be deleted" (live) /
  "Listed as automatic in the catalog" (older rows) / "Manual".
- **Live extras** (live rows only): felt reports ("412 felt reports"), the tsunami flag, the PAGER
  alert level, each with the quoted meaning (§10.3), each line only when present.
- **Nearest mapped fault** within 25 km: its name and section, distance, age class; with "Nearness
  is not cause: this does not say which fault moved." as the card's small print.
- **Nearest volcano** within 50 km: name, distance, alert level and color code or "not monitored".
- **The USGS event page, as text**: `earthquake.usgs.gov/earthquakes/eventpage/{id}` (the template is
  data, `about.json.eventPage`, and the page itself cannot open — the app has no network); selectable
  text (`user-select: text`). Rows without a stored id (below M 4.5, outside the last 30 days) say "The catalog id is
  kept in this app for M 4.5 and up."

A pin is not dropped; the selection ring marks the dot. On settle a short line is announced
(`aria-live="polite"`): "Magnitude 7.1, 2019-07-06, depth 8 km, Ridgecrest Earthquake Sequence".

### 8.4 Faults and volcanoes
A selected fault gets its own card: name, section, age class, slip-rate class, slip sense, line type
("well constrained", "moderately constrained", "inferred"), class A or B, last review year — from
`geo.json.faults` — and the small print "A fault in this database shows evidence of movement in the
Quaternary; it is not a hazard rating." (quote owed). A volcano is tapped like an event (its triangle
wins over dots within 12 px): name, elevation, threat class, observatory, alert level and color code
with the notice's date, or "Not monitored — no alert level is issued" (never "Normal").

---

## 9. The cross-section

### 9.1 Drawing it
**Section** in the tools column turns it on. The first one-finger drag draws a line from touch-down to
touch-up (two fingers still pan and zoom); afterwards the line has two round handles (18 px, 44 px
hit) that drag its ends, and a drag away from them draws a new line. The line is a **great-circle
segment** from A to B, labeled as geological maps label a section line: `A` at the start and `A′`
at the end, 11 px mono on `--glass` tabs. The corridor — everything within the chosen half-width of
the line — is two 0.75 px `--ink` edges with ticks every 50 km along the line over a 6 % `--ink` wash
(the great circle sampled every 5 px, offset perpendicular in km, projected). **While a line exists,
events outside the corridor dim to α 0.25** on the map (§6), by the same great-circle test in the
vertex shader in float32 (uniforms `uSecA`, `uSecN`, `uSecHalf`, `uSecLen`); the difference from the
float64 plot is under a meter. The plot redraws on every frame of a drag while its section takes
under 12 ms (§13's 40 ms budget is the worst case, ±100 km over All), and on release otherwise.

### 9.2 What it shows
The sheet goes to Half and its body becomes the plot, under chips **±25 | ±50 | ±100 km** (default
±50), the presets, and a stretch chip **1× | 2× | 5×** (default 1×).

- Events: every visible event (window, floor) whose cross-track distance from the great circle is at
  most the half-width and whose along-track position is between A and B, computed on the sphere
  (R = 6371.0088 km): `xt = asin(p·n)·R`, `at = atan2((a × p′)·n, p′·a)·R` with `n = a × b / |a × b|`
  and `p′` = p projected on the plane of the circle. Pre-filtered by the grid index to the corridor's
  bounding box.
- The plot: x = distance from A (km), y = depth (km, down), **true scale** — 1 km across is 1 km down
  — with the plot's height set by the width, its depth range from 0 to the deepest event rounded up to
  50 km. If that height would exceed 320 px the plot narrows to keep 1:1; if it is under 64 px it stays
  thin and true. At 2× or 5× the corner reads "Depth stretched 5×" in the ink color, always visible.
- Drawn on a 2D canvas on `--bg` (ART.md, "Signature moments" 3): `A` and `A′` over the top corners
  and distance labels every 100 km across the top, in 10 px mono; down the left edge a 5 px **rail of
  the depth ramp at the true depths** with the depth labels beside it, so the legend and the axis are
  one object; dotted `--rule` lines at 35, 70 and 150 km; sea level as a solid 1 px `--ink` line; a
  dashed `--ink-3` line at 10 km, named in a key **under** the plot ("– – 10 km: depth often fixed
  here", the quote of §10.3), never inside the cloud; dots in the depth ramp at 0.6 of their map
  size, largest on top, with the light rim at 0.30 (§6); the highlighted preset event ringed, with a
  mono callout ("M 7.1 · 2018 · 46.7 km") on a leader line into the emptier side over a 3 px `--bg`
  halo. A tap on a plotted dot selects that event. `tools/art/study-*.png` show the Cook Inlet plot
  from the cache.
- A line under the plot: "{n} earthquakes within ±50 km · {window} · M {floor}+ · {k} at exactly
  10 km · {j} without depth, not plotted".

### 9.3 Presets
Four across-strike lines, chosen to cross the structure; each sets its line and switches the window
to All and the floor to 2.5+ (the chips show it), because a slab needs every event:

| Preset | A → B (lat, lon) | Length | Events within ±50 km, M 2.5+, all years — **measured** |
| --- | --- | --- | --- |
| Cook Inlet | 59.0, −146.8 → 63.2, −154.2 | 613 km | 6,184; deepest 249.1 km; median 45.5, 90th percentile 90.0 km |
| Aleutians | 50.2, −176.6 → 53.8, −176.6 | 400 km | 5,122; deepest 274.0 km; 90th percentile 97.5 km |
| Cascadia | 47.3, −127.4 → 47.3, −120.6 | 513 km | 714; deepest 64.2 km |
| Hawaii | 18.7, −156.2 → 20.4, −154.4 | 267 km | 35,222; deepest 102.4 km; median 2.9 km |

Cook Inlet highlights the 2018 Anchorage M 7.1 at 46.7 km. At 1× (depth rounded up to 50 km), the
four plots are 358 × 146, 358 × 269, 358 × 70 and 358 × 201 px: Cascadia's slab is sparse and
shallow, and the plot shows it so.

---

## 10. Layers, About and the honesty notes

### 10.1 Layers
A small panel from the Layers tool: switches for **Shaded relief** (on), **Sea depth** (on),
**Faults** (on), **Volcanoes** (on), **State lines** (on), **Labels** (on), and **Units: SI | US**.

- **Faults**, in `--fault` (graphite `#3a4146` in light, pencil `#c3c9cd` in dark), on `#lines`
  under the dots, styled by the database's age class, most recent strongest: historic 1.4 px at 90 %;
  latest Quaternary 1.1 px at 75 %; late Quaternary 0.9 px at 60 %; middle and late Quaternary
  0.7 px at 45 %; undifferentiated Quaternary 0.6 px at 35 %. Class B (equivocal evidence) dotted
  1/3; line type "Inferred" dashed 3/3. The legend uses the database's own class names; numeric age
  bounds are printed only once quoted from a USGS source (§10.3). The slip-rate class and sense are in
  the fault card.
- **Volcanoes**: 148 in the boxes (`getUSVolcanoes`), the triangle's size by threat class (Very High
  11 px, High 10, Moderate 9, Low 8, Very Low 7, unassigned 7 hollow-dashed), filled by the aviation
  color code of the latest notice for the 63 monitored ones — GREEN `#4f9a5a`, YELLOW `#f2cc38`,
  ORANGE `#ee8a2a`, RED `#d0342c`, the app's only red, shown only when USGS issues it — each with a
  1 px `--ink` outline over a 1 px `--panel` halo; the other 85 empty, "not monitored".
  If the status has never been read, every triangle is hollow and the legend says "Volcano status not
  available in this copy".
- **Sea depth**: Natural Earth's bands at 200, 1 000, 2 000 … 7 000 m, eight tints of one blue-gray,
  deepest darkest, narrow in lightness so the sea never competes with the dots: light `#d0dbe2
  #cad6de #c4d1da #bfccd6 #b9c7d2 #b3c2ce #aebdca #a8b8c6`, dark `#0e1317 #0d1216 #0c1014 #0b0f12
  #0a0d10 #080b0e #07090c #05070a` (ART.md).

### 10.2 The honesty notes, and where each one is on screen
| Note | Where |
| --- | --- |
| **Not a warning service.** "This map is not an earthquake or tsunami warning service. This copy is only as new as its last refresh, shown above." | the map's credit line, always ("Not a warning service · USGS · Natural Earth"); Live body, first line; About, first paragraph |
| **More dots mostly means more seismometers.** USGS: "…not because there are more earthquakes, but because there are more seismic instruments…" | under the History chart, always; About |
| **What the catalog catches.** USGS, verbatim: "For much of the U.S., earthquakes of magnitude 2.5 or larger are located and cataloged…" and, within the conterminous U.S., completeness "is probably in the magnitude 3.0-3.5 range." | the 2.5+ hint (§7.4); About |
| **Magnitude types differ** and are not converted. | the card's type line; About |
| **Automatic solutions change or vanish.** | the legend's hollow entry; Live summary; the card |
| **Depths of 10 km are often assigned**, and line up in cross-sections. | the section plot; the card; About |
| **Mercator inflates the north**: at 61° N a kilometer is drawn about 1.6 times as long as at 40° N, so an area there looks 2.5 times as large. | the scale bar's "at" clause; About |
| **Boxes, not borders**: Canadian, Mexican and Virgin Islands events inside the boxes are shown. | About; the per-box counts say "map box" |
| **Before 1900**, positions and times are nominal (the 1700 rupture is one point). | the stub's caption line; story cards; About |
| **The history is a snapshot**: rows are as USGS listed them when retrieved; later revisions arrive only with a new ZIP. | About |
| **Only earthquakes**: explosions, quarry blasts and the catalog's 673 nuclear tests are left out. | About |
| **Faults are not a hazard map**; nearness is not cause. | the fault card; the event card's small print; About |
| **Not monitored ≠ Normal.** | the volcano card and legend |
| **Relief covers US land only**, and its shading is a display transform. | About |

The quoted USGS sentences come from `credits/usgs-statements.txt` verbatim; their sources are listed
in About.

### 10.3 Text owed a quote before it ships
The pipeline stage saves these from USGS pages into `credits/usgs-statements.txt` and the app's text
uses them; until then the app shows the field's value without the gloss, never a paraphrase from
memory:
the magnitude-type names; what `status` automatic/reviewed means; the 10 km assigned depth; what the
feed's `felt`, `tsunami` and `alert` (PAGER) fields mean — in particular what the tsunami flag does
**not** mean; the fault age classes' time bounds and what the database includes; the volcano alert
levels and aviation color codes; every claim in the seven stories beyond the catalog's numbers; and
that the event-page address pattern answers for a known id (a probe line).

### 10.4 About
A full-height scrollable panel from `assets/about.json` plus the snapshot's `sources`: how to read the
map (sizes, colors, hollow, gray, ×, fade), the honesty notes above in full, what is not shown and
why (§17), every source with owner, license, what this app changed, retrieval date — the history's
2026-09-30, and the live feed's and volcano status's times from the snapshot — the units setting, and
the app version. Five taps on the version line toggle the frame-time readout (§13).

---

## 11. Data at runtime

### 11.1 Loading order
1. `assets/geo.json` (the map can draw without quakes) and the four relief JPEGs.
2. `assets/history.bin` + `history.json`, validated against the contract (sizes, offsets, codes in
   range), uploaded.
3. `data/snapshot.json`, validated and decoded (§11.2), appended to the buffer.
4. `assets/stories.json`, `assets/about.json`, on first use.

A loading line in the sheet ("Loading the catalog…") until step 2 ends. First paint of land and relief
does not wait for the history.

### 11.2 The snapshot
Fetched with `cache: 'no-store'`, **re-read on `visibilitychange`** (Snuggery fires it when the
Shortcut delivers a new file while the app is open), re-rendered in place: mode, view, window,
selection (kept if its row is still there) and sheet survive. Validation, Global Weather's rule —
a plausible blank is worse than an error:

- not JSON, or a web page written over it → "data/snapshot.json is not valid JSON — it looks like a
  web page was written over it";
- a service's reply (`message` key) → "the file holds a service's reply (“…”) instead of earthquake
  data — check the token in the Shortcut";
- wrong `schema` or `app` → "it is not a US Quakes snapshot";
- any column's decoded length ≠ `rows.count` × its width, codes out of range, times not sorted,
  `generatedAt` or `feed.generated` missing → the reason, in words.

Decoding uses the inflate of Global Weather (native `DecompressionStream('deflate')` read into a
buffer of exactly the declared size, a hard cap before any allocation, and the small pure-JS decoder
as a fallback), copied into `js/data.js`, never imported.

### 11.3 Without WebGL 2
The map panel shows its sentence (§3.2), and the sheet works: Live lists and counts, History counts
and the timeline, the stories' text, About. Tap and section need the map and are hidden.

### 11.4 Indexes built once per load
- per floor, a sorted `Uint32Array` of the times of rows at or above it (and the stub's rows), for
  O(log n) window counts;
- the grid index for tap, long press, "in view" and the section's pre-filter;
- the magnitude-ordered draw index (§5.3);
- per-year counts per floor (§7.3).

### 11.5 Snuggery's Ask
The snapshot's top-level `ask` array (≤ 200 flat rows, §CONTRACT 3.6) is for reading, not drawing:
the largest events of the last 30 days, a count summary per box and window, and the volcanoes above
Normal, so a question in words ("anything big in Alaska this week?") has the facts in rows. The app
never reads it.

---

## 12. Accessibility and both themes

- **Chrome is ink; color is data.** Tokens on `:root`, redefined under `@media
  (prefers-color-scheme: dark)`. No chrome token carries a hue (the most chromatic, light `--ink-2`,
  has an OKLCh chroma of 0.0194): the only colors on screen are the depth ramp, the volcano color
  codes and the no-depth gray. The dots' marks — ramp, rims, gray, volcano codes — are the same in
  both themes; the basemap and the relief strength change. The tokens are ART.md's ("Palette"):

  | Token | Light (drum paper) | Dark (smoked paper) |
  | --- | --- | --- |
  | `--bg` | `#f1f3f4` | `#0c0e10` |
  | `--panel` (sheet, cards) | `#fafbfb` | `#15181b` |
  | `--ink` | `#15191c` | `#e7e9e7` |
  | `--ink-2` | `#4d5760` | `#9ba3a9` |
  | `--ink-3` | `#646e76` | `#848d94` |
  | `--on-ink` | `#fafbfb` | `#0c0e10` |
  | `--line` | `#d2d8dc` | `#272c31` |
  | `--line-strong` | `#aeb7be` | `#444c53` |
  | `--rule` (the drum ruling) | `#c5d0d8` | `#2b3238` |
  | `--hatch` | `rgba(21,25,28,.22)` | `rgba(231,233,231,.20)` |
  | `--glass` | `rgba(250,251,251,.90)` | `rgba(21,24,27,.90)` |
  | `--sea` | `#d5dfe5` | `#0f1418` |
  | `--land` | `#ebedeb` | `#1c2023` |
  | `--fault` | `#3a4146` | `#c3c9cd` |

  Text contrast ≥ 4.5:1 on its own background in both themes: the lowest token pair is `--ink-3` on
  `--bg` in light, 4.68:1, and `--ink-2` on glass over the relief's white extreme in dark, 5.26:1
  (`python3 tools/art/contrast.py`); `shoot.mjs` measures the rendered styles.
- **Type** (ART.md, "Type"): **Atkinson Hyperlegible** 400/700 for words and **Red Hat Mono** 500 for
  every measured value (magnitudes, times, depths, distances, strip and axis numbers, `A`/`A′`, the
  event page address), vendored in `fonts/` with `OFL.txt`. Scale 10 / 11 / 11.5 / 12 / 13.5 / 14 /
  15 / 17 px: 13.5 px body, 11.5 px controls, 10 px instrument labels, 17 px only for the event card's
  magnitude; `tabular-nums` on Atkinson wherever digits align.
- **Targets**: every control at least 44 × 44 CSS px of hit area, however small it looks.
- **Screen readers**: the map's top canvas (`#over`, a leaf) is `role="img"` with an `aria-label`
  rebuilt on settle ("Map of the Lower 48, History, 1964, magnitude 4 and up, 1 204 earthquakes, 318
  in view. Drag to pan, …"); `<main>` is a plain landmark, so its chips, keys and credit line stay
  reachable (§24). The Live record strip is `role="img"` named by its count and largest; every list, card,
  count and the timeline are DOM text; the ten largest events are a real list, so the map has a text
  equivalent. Nothing from a data file reaches `innerHTML`: `textContent` only.
- **Keyboard**: tab order top bar → chips → tools → map → sheet grip → head → body; §4.3 and §7.3
  keys. Visible focus rings.
- **Reduce Motion**: no opening, no fling, no eased moves (jumps), new stems and dots appear at once,
  the sheet and cards take their state at once; Play and a story's sequence still step (ART.md,
  "Motion and easing").
- **Motion** is one critically damped curve, `cubic-bezier(0.25, 0.8, 0.3, 1)`, never overshooting;
  nothing shakes, pulses, glows or bounces (ART.md, "Never").
- **Color**: never the only carrier. Depth is also a number on every card and in the plot's axis;
  alert levels are written out; hollow and × carry meaning by shape.

---

## 13. Performance budgets and what to measure

**Bytes.** "Raw" is the file on disk and in memory; "in the ZIP" is what `zip -r -X` (default level,
as `build-zips.yml`) stores. The plan's **assets ≤ 6 MB is read as the ZIP-stored bytes of
`assets/`**, because the history's columns deflate by a third and the raw bytes would not fit; raw
bytes carry their own caps.

| File | Raw | In the ZIP | Status | Cap (asserted) |
| --- | --: | --: | --- | --: |
| `history.bin` (columns 4,620,912 + text 711,058 incl. padding) | 5,331,970 | ≈ 3,209,000 | measured per section (§CONTRACT 12) | 5,800,000 raw |
| `history.json` | ≈ 6,000 | ≈ 2,000 | estimate | 16,000 |
| `relief-conus.jpg` 4096 × 2192, q75 | 942,611 | same | measured | 1,050,000 |
| `relief-ak.jpg` 3072 × 2482, q75 | 635,849 | same | measured | 720,000 |
| `relief-hi.jpg` 2048 × 1458, q75 | 43,668 | same | measured | 60,000 |
| `relief-pr.jpg` 2048 × 801, q75 | 84,413 | same | measured | 100,000 |
| `geo.json` (the basemap to 25° S–81° N, §25) | 1,851,803 | 987,085 | measured, `verify_static.py` (§25) | 1,900,000 raw |
| `stories.json` + `about.json` | ≈ 45,000 | ≈ 18,000 | estimate | 30,000 + 40,000 |
| **`assets/` total** | 8,945,829 | **5,851,793** | measured, `verify_static.py` (§25) | **6,000,000 in the ZIP** |
| `data/snapshot.json` | ≈ 560,000 | ≈ 480,000 | estimate from measured parts (§CONTRACT 3.8) | **1,500,000 raw** |
| app code (`index.html`, `style.css`, `js/*.js`) | ≈ 120,000 | ≈ 35,000 | estimate | **150,000 raw** |
| `fonts/` (five WOFF2 + `OFL.txt`) | 68,742 | ≈ 66,000 | measured raw (`wc -c`, ART.md); WOFF2 does not deflate further | 120,000 raw |
| `CREDITS.txt`, `NOTES.md`, `DESIGN.md`, `ART.md` | ≈ 155,000 | ≈ 52,000 | estimate (DESIGN 75,781 and ART 37,867 raw, `wc -c`, 2026-09-30) | |
| **The ZIP** | | **6,446,225** | measured, `check.mjs` (§25) | **8,000,000** |

The assets' headroom was about 230 KB at design time and is **148,207 B** after the lead's pass
(`verify_static.py`: 5,851,793 B of 6,000,000; the basemap past the axis took 149,533 B, §25), and the
history grows about 12,000 rows a year (2020–2025 averaged 12,300, `RESEARCH.md` §4; ≈ 100 KB in the ZIP
at 7.9 B a row): the January 2027 rebuild fits, and the 2028 one will need the first lever. The levers,
in order, when the yearly build's assertion fails: the Lower 48 relief at q70 (−86 KB, measured), fault
simplification at 200,000 m² (−44 KB), the basemap's coarse zones doubled (×20 north of 5° N, −22 KB,
measured in the lead's scratch run), then a decision for the owner (the floor, or dropping a bathymetry
band). The build fails rather than trims silently.

**Memory** (budgets; the phone numbers come from the phone):
- GPU: relief `R8` textures 9.0 + 7.6 + 3.0 + 1.6 MB, ×1.33 with mipmaps ≈ 28 MB; the event buffer
  (385,076 + 60,000 rows × 12 B) 5.3 MB; the draw index 1.8 MB. **≈ 35 MB.**
- JS heap: the history's `ArrayBuffer` 5.3 MB (kept for tap, counts, sections and context restore);
  the snapshot's columns ≤ 0.8 MB; decoded geometry ≈ 3.1 MB (faults 278,038 and the basemap 114,402
  vertices, **measured**, as `Float32Array` world units); the grid and floor indexes ≈ 4 MB.
  **Target < 30 MB** for the app's own data.
- Canvas backing stores: five layers (§5.1) at 780 × 1,296 device px for a 390 × 648 panel at DPR 2,
  4 B a pixel ≈ 4.0 MB each, **≈ 20 MB**; the second WebGL context (`#relief`) adds its own default
  framebuffer inside that. The phone check records the process's memory with both contexts live; if it
  presses, the fallback is ART.md's four-layer order (relief back into `#gl`, lines on `#over` at
  their stated alphas), noted in `NOTES.md`.

**Time** (targets on an iPhone 16-class phone, measured only on the phone):
- First paint of land and relief < 1.0 s; the first earthquakes < 2.0 s from launch.
- A pan or pinch frame: WebGL ≤ 6 ms for 445,000 points at ≤ 780 × 1,300 device px; no 2D redraw
  during the gesture (§5.4); the settle redraw of base + overlay ≤ 16 ms with faults on.
- Play: a step ≤ 2 ms of JS.
- A tap ≤ 5 ms; a section with ±100 km over All, 2.5+ ≤ 40 ms.
- A new snapshot: decode + append + index ≤ 150 ms, off the gesture path.

**How it is measured**: `window.__uq.perf()` (inert unless called) returns the last 120 frame times
split WebGL / base / overlay and the load timings; `tools/shoot.mjs` prints it after a scripted pan,
pinch and play (a trend only — headless numbers are not evidence of phone performance). On the phone,
five taps on the version line in About show a small frame-time readout, and the matrix row records
`ALIASED_POINT_SIZE_RANGE`, `MAX_TEXTURE_SIZE`, first-paint times, a 30 s pan and a background-and-
return (context loss) with the device and iOS version.

---

## 14. File layout

```
us-quakes/
  index.html              the whole page; <script type="module" src="js/app.js">
  style.css               ART.md's tokens, both themes, the @font-face rules, the grid, the sheet, the controls
  fonts/                  Atkinson Hyperlegible 400/700 (latin, latin-ext), Red Hat Mono 500, OFL.txt (ART.md)
  miniapp.json            {schemaVersion 1, name "US Quakes", entryPoint "index.html", description, version "1.0"}
  js/
    app.js                boot, state, the scheduler, persistence, wiring, window.__uq (inert)
    data.js               loading and validating every file against the contract; the shared column
                          decoder for history.bin and the snapshot; inflate (Global Weather's, copied)
    map.js                the axis, Mercator forward/inverse, the view, gestures, region fit, scale bar
    gl.js                 WebGL2: program, relief textures, the event buffer and index, draw, context loss
    shaders.js            the GLSL sources
    base.js               the Canvas 2D base: sea, depth bands, land, lakes
    overlay.js            the Canvas 2D overlay: lines, faults, volcanoes, labels, selection, corridor
    events.js             filters, floor indexes, per-year counts, the grid index, tap and long-press search
    timeline.js           the History timeline: axis, bars, window, thumb, keys, play
    sheet.js              the sheet: heights, Live and History heads and bodies, lists, the cards
    section.js            great-circle section maths and the plot
    about.js              the About panel, the credit line, the honesty notes
    ramp.js               the depth ramp (OKLab, ART.md's stops), the rim rule, the size rule, the legend's drawn keys
    strip.js              the record strip's Live form (stems, heads, the tail since the feed, arrivals);
                          timeline.js draws its History form and shares the ruling helpers
    units.js              SI / US, U+202F grouping, dates
    util.js               small helpers; the localStorage wrapper
  assets/                 written by Template/scripts/us_quakes/ — see tools/CONTRACT.md
    history.bin history.json geo.json stories.json about.json
    relief-conus.jpg relief-ak.jpg relief-hi.jpg relief-pr.jpg
  data/
    snapshot.json         the only file the phone's Shortcut replaces
  CREDITS.txt             written by the pipeline
  NOTES.md                running it, the code map, the size table, the caveats, decisions
  DESIGN.md               this file
  ART.md                  the art direction (Drum Record)
  screenshots/app.png     780 × 1688 (left out of the ZIP)
  tools/                  left out of the ZIP
    RESEARCH.md CONTRACT.md design_measure.py
    art/                  study.html, study_data.py, study-data.json, contrast.py, study-light.png, study-dark.png
    check.mjs shoot.mjs test_decode.mjs test_geo.mjs
    ref/                  history_ref.json, snapshot_ref.json, section_ref.json (written by the pipeline, committed)
    node_modules/ .work/  gitignored
```

The pipeline is **not** in this folder: it is `Template/scripts/us_quakes/`, beside the other live
apps' refresh scripts, because the hourly job runs from `Template/scripts/` on a runner.

---

## 15. Pipeline and workflows (summary; every layout is in `tools/CONTRACT.md`)

`Template/scripts/us_quakes/` (already there from the research stage: `sources.py`, `common.py`,
`paths.py`, `probe.py`, `probe-urls.txt`, `fetch_catalog.py`, `fetch_relief.py`,
`catalog-windows.json`, `credits/`, `samples/`, `requirements.txt`):

| Script | Needs | Writes |
| --- | --- | --- |
| `build_history.py` | the cached ComCat windows | `assets/history.bin`, `history.json`, `us-quakes/tools/ref/history_ref.json` |
| `build_relief.py --relief` | the pinned 3DEP PNG + TIFF pairs, NE lakes, the server's reported extents | `assets/relief-*.jpg` (committed; a deliberate act) |
| `build_geo.py` | pinned Natural Earth, the fault GDB (pyogrio), the committed `samples/volcano-getUSVolcanoes.json` | `assets/geo.json` |
| `build_about.py` | `content/about.yaml`, `content/stories.yaml`, `credits/`, `history.bin` | `assets/about.json`, `assets/stories.json`, `us-quakes/CREDITS.txt` |
| `refresh.py` | **standard library + requests only** | `data/snapshot.json`; `--ref` writes `tools/ref/snapshot_ref.json` |
| `verify.py` | everything above | nothing; exits non-zero on any failed check (§CONTRACT 11) |
| `build_all.sh` | | runs the static steps, `refresh.py`, `verify.py` |

**Refresh, hourly.** `refresh.py` reads `all_month.geojson` (worldwide; filtered to the four boxes and
`type == earthquake`) and the monitored volcanoes; takes the previous snapshot from the data branch;
keeps its M 2.5+ rows older than the new 30-day boundary, and once a day (when the previous FDSN read
is over 24 h old) replaces them with a fresh FDSN query per box from a year before the cutoff (per box
and calendar year where a box nears 20,000). The cutoff comes from `us-quakes/assets/history.json` on
`main`, so the refresh and the ZIP agree on it. It validates (§CONTRACT 11), then writes; on any
failure it writes nothing and the job fails, leaving the last good snapshot published.

**Workflows** (in `Template/.github/workflows/`):
- `refresh-us-quakes.yml` — "Refresh us-quakes": hourly (`cron: '23 * * * *'`, best effort), on
  dispatch, and on a push to `main` touching the refresh; installs `requests==2.34.2` only;
  force-pushes one parentless commit to the orphan branch **`data-us-quakes`** with Global Weather's
  branch-name guard, never `main`, so `build-zips.yml` is never tripped by data. About 720 runner-
  minutes a month: free on a public repository; a private copy should run every 3 h (a comment in the
  file says so).
- `build-us-quakes.yml` — "Build US Quakes data": each January and on dispatch, with the cutoff
  passed in as `--cutoff YYYY-01-01` (an input, not a clock read inside the build); restores the
  ComCat cache (actions/cache), fetches only the new windows, runs `build_all.sh`, commits the
  assets and the demo snapshot to `main`, then dispatches `build-zips.yml` itself (a push made with
  the job's token starts no workflow).
- `publish-web.yml` — `us-quakes` joins the loop that takes live data from a `data-<app>` branch, and
  "Refresh us-quakes" and "Build US Quakes data" join its `workflow_run` list. Added with the refresh
  workflow, so the loop never names a branch no job writes.
- `probe-us-quakes.yml` — already added by the research stage.

The Shortcut's data address for this app is the `data-us-quakes` branch's
`us-quakes/data/snapshot.json`; the owner adds that row to the Keep This Up To Date shortcut
(MANUAL_STEPS, when published).

---

## 16. Tests

- **`scripts/us_quakes/verify.py`** — every check in `tools/CONTRACT.md` §11, printing the measured
  numbers; `build_all.sh` fails on it.
- **`tools/check.mjs`** (Node, no dependencies; Earth's History's shape): files within Snuggery's
  limits with the ZIP's exclusions; no `http(s)://` in any `.html`, `.css`, `.js`; every `import`,
  `src`, `href`, `fetch(`, `url(` relative and inside the folder; `assets/` holds exactly the
  contract's names and `data/` only `snapshot.json`; `miniapp.json` valid; no AI vendor name in any
  shipped text file; the depth ramp's lightness and color-vision checks (§6); app code ≤ 200,000
  bytes (raised from 150,000 for the QA pass, §23); `data/snapshot.json` ≤ 1,500,000; the ZIP built as `build-zips.yml` builds it has
  `index.html` at its top, its `assets/` entries' stored sizes sum to ≤ 6,000,000, and the whole is ≤
  8,000,000 bytes — each size printed.
- **`tools/test_decode.mjs`** — loads `history.bin` and the committed demo snapshot with `js/data.js`
  and compares them with `tools/ref/history_ref.json` (1,000 rows chosen with a seeded generator plus
  the six known events, their raw CSV values) and `tools/ref/snapshot_ref.json`: time exact to the
  minute, longitude within 0.001°, latitude within 0.0005°, depth within 0.005 km, magnitude equal to
  the half-up tenth, status, type label, id and place exact. Also: the six known events found by id,
  with 1964's M 9.2 at 25 km and 2018 Anchorage at 46.7 km. (§25: the depth code compared exactly,
  1500 only for an exact 10, and code 1500 on exactly `counts.depth10km`'s 23,759 rows.)
- **`tools/test_geo.mjs`** — Mercator forward/inverse round-trips on a 0.5° grid of the axis to
  < 1e−9 (§25: of the basemap, 168–305 and 25° S–81° N; and the clamp over 5,070 requested views); the section's along- and cross-track distances for the four presets' first 200 events
  within 1 m of `tools/ref/section_ref.json` (float64 in Python); the scale bar's km per px against
  the haversine at five latitudes.
- **`tools/shoot.mjs`** (Playwright, headless Chromium, 390 × 844, DPR 2, touch, light and dark;
  `PLAYWRIGHT_MODULE` for a scratch install): serves the folder itself; fails on any console error or
  warning, page error, failed request or request outside the local server, `data:` or `blob:`.
  Scenes, each a screenshot: Live Lower 48 Week; Live Alaska Month; History 1964 Year 4+ on Alaska
  with the story card; History All 2.5+ Lower 48; the stub (Before 1900) with × and gray dots; each
  of the nine chips; the Cook Inlet section (asserts ≥ 1,000 plotted and the deepest ≥ 150 km) and a
  drawn section; a tap on Ridgecrest (card text checked) and a long press; Layers off and on; About;
  a forced context loss and restore; a **gap** (a copy of the demo snapshot with rows from a year
  after the cutoff served in its place: the gap sentence visible, the hatch drawn); a **broken**
  snapshot (HTML body: the error sentence, History still works); no snapshot; WebGL 2 disabled (the
  sentence, the lists). Then Play for 5 s in Year: the label and count change at each step, no errors.
  Driven through `window.__uq`, which the shipped build carries inert.
- **The art direction's checks** (ART.md, change list item 17). `check.mjs`: `fonts/` holds exactly
  the five WOFF2 files and `OFL.txt`; `js/ramp.js`'s stops equal ART.md's six. `shoot.mjs`: the
  opening watched (the label, the cursor, the ease to the Lower 48), then skipped by a touch, in each
  theme; never under Reduce Motion, never twice, never without a snapshot; the Live strip and the
  History strip as scenes; a new snapshot served while open (the "new since" line appears, and no
  element or canvas style animates anything but opacity); a section drawn by a drag with the
  outside-corridor dimming visible; a story's **Play the sequence** stepping three times, the label
  naming each span; text contrast ≥ 4.5:1 over every rendered text style in both themes; and **chrome
  is ink**: no computed `color`, `background-color` or `border-color` on a chrome element has an
  OKLCh chroma above 0.025.
- **The lead's pass** (§25) adds to `shoot.mjs`: the default framings inside the basemap (the Lower 48
  at Peek, the nine chips at Peek, the Lower 48, California and Alaska in focus mode); focus mode by a
  pointer (no focus moved, no ring) and by Enter (focus on the ghost key and back, ringed); a 2D hollow
  ring sampled at 0°, 5° and all round; the depth legend and the section's 10 km key in US units;
  Escape taking back a pending keyboard A, and a drag ending one; the Live pen's nib clear of the count
  label; no label ink under the foot after Peek → Half. Three were run with their fix removed and failed
  then (the ring, the labels, the nib; §25 gives the numbers).
- **Screenshots** read by eye in both themes; `screenshots/app.png` at 780 × 1688 is **Alaska with the
  Cook Inlet section open at Half** (the view no other phone app has), light theme; the scene list
  above adds Live Lower 48 Month as `screenshots/live-light.png` and its dark twin.
- **On the phone** (owner, a matrix row): import the ZIP, Live and History, play a decade, the Cook
  Inlet section, a tap, rotate, background and return, a Shortcut refresh while open — the only
  evidence for frame time, memory and context loss.

---

## 17. Cut from v1, and why

- **The globe and the worldwide catalog** — the story is the US; a globe adds a renderer for no US
  question.
- **A 3D Alaska slab** (a 3DEP + seafloor mesh with the quakes beneath) — the natural v2; the
  cross-section answers the same question in 2D, truly scaled.
- **The 2023 hazard model's grids** — a model, not a measurement, and a different app's honesty
  burden.
- **Sharper close-up relief** — the relief is about 1.3 km a pixel in the Lower 48; tiles would multiply
  the size.
- **Search**, **ShakeMap** and **"Did You Feel It?" maps** — the felt count is shown; the maps are
  products with their own models.
- **Guam and the Northern Marianas, American Samoa** — outside the four boxes (22 of the 170 US
  volcanoes, `RESEARCH.md` §2.5).
- **Explosions, quarry blasts and the 673 nuclear tests** — not earthquakes; a separate, labeled layer
  is a candidate for later, never mixed into the dots.
- **Energy-scaled dots** — true energy ratios (×32 per magnitude) would make M 9 a continent; area
  doubles per magnitude instead, and About says so.
- **Heat maps, clustering, interpolated rates** — each would draw something the catalog does not
  hold.
- **Links of any kind** — the app has no network; addresses are text.

---

## 18. Art direction

Done: `ART.md` ("Drum Record", 2026-09-30) owns palette, type, motion, the signature control and
moments, and the designed objects; its change list is applied in this file (§3, §5, §6, §7.3, §7.5,
§7.6, §8.3, §9, §10.1, §10.2, §12, §13, §14, §16). The constraints this section set for it hold: the
ramp is one ramp in both themes, lightness-monotonic, passing the color-vision checks at 11.7;
hollow, gray and × keep their meanings; every effect is a display choice About names (the fade, the
rims, the play trace, the corridor dimming, the relief's strength); no effect invents data; controls
are 26–28 px with 44 px hits and the type is compact; text contrast ≥ 4.5:1.

About's "Display choices" paragraph (`content/about.yaml`) names, in the app's words: the color
ramp and its stops, the rim, the fade of older dots, the play trace, the dimming outside a section,
the relief's shading and strength, the sea tints, and that the record strip's ink density is a
count of events.

---

## 19. Decisions taken where the plan was silent

- **One time boundary instead of id matching** (§7.1): history below the cutoff, snapshot from it.
  Chosen over de-duplicating by `ids`, which would need every history id (the file keeps ids only for
  M 4.5+) and could still double-count a relocated event. What would change it: a need to show USGS's
  revisions of pre-cutoff events live.
- **Minute resolution, 0.1 magnitude, 10 m depth, 0.002°/0.001° position** (§CONTRACT 1). The
  magnitude is rounded half-up on the catalog's decimal text, so the card shows what USGS's own
  one-decimal display shows. What would change it: a need for two-decimal magnitudes (one more byte a
  row, ≈ 385 KB raw).
- **Place text and ids kept for M 4.5+ and for every live event** — 15,490 history rows, 156,773 B in
  the ZIP with their row index (**measured**); the rest get a computed, labeled "near" line. M 4+
  would be 33,005 rows and about twice that.
- **"assets ≤ 6 MB" read as ZIP-stored bytes** (§13), with raw caps per file.
- **Alaska's relief at 3072 × 2482** (0.75 of the stitched 4096 × 3309): about 1.0 km a pixel at
  61° N, close to the Lower 48's 1.3 km at 40° N, for 412 KB and 5.9 MB of GPU memory less.
- **Faults grouped by (fault, section, age, slip rate, class, line type) into 5,816 multi-line
  records**, Visvalingam–Whyatt at 50,000 m², 3 decimals: 278,038 vertices, 929,231 B raw with the
  per-line counts, 1,140,969 B with the attribute tables, 513,053 B in the ZIP (**measured**). Chosen
  over one string per line, where each of the 113,301 lines pays for an absolute first point.
- **Base and overlay moved by CSS transform during gestures** (§5.4), over redrawing 2D paths every
  frame; the dots stay sharp because WebGL still redraws.
- **The relief as a translucent shading overlay** in WebGL over a 2D land fill, over triangulating
  land for WebGL (a dependency and a build step for no visible gain).
- **Stepped, calendar-aligned play** (§7.5) over a continuous slide: the label always names exactly
  what is drawn.
- **Presets set window All and floor 2.5+**: a slab needs every event; the chips show the change.
- **A dot's area doubles per magnitude** (§6).
- **Art direction, 2026-09-30** (ART.md; each item says what it was chosen over):
  - *Chrome is ink; color is data* — over an accent color: every color on screen is then a
    measurement. What would change it: a reviewer finding the controls hard to see as controls.
  - *A new depth ramp* — over the design stage's, whose 35 km stop was a signal red and whose deep
    end vanished on a dark sea; ΔE2000 floor 11.7 (was 10.5).
  - *The rim follows depth (60 km switch), not the theme* — over a theme rim: one mark in both
    themes, and contrast from whichever of fill and rim differs from the ground.
  - *Five canvases, lines under dots* — over lines on the overlay above the dots, which crossed out
    the earthquakes along each fault. Costs one WebGL context and ≈ 4 MB; the fallback is written in
    §13.
  - *Red Hat Mono for measured values* — over Atkinson alone (its slashed zero read as "Ø" in the
    study) and over IBM Plex Mono (a Reserved Font Name).
  - *Live defaults to Month, All sizes* — over Week: the richest honest picture, and the window the
    opening replays.
  - *Staleness in words, weight and the strip's hatched tail* — over amber text, because amber is a
    depth on this map.
  - *The play trace and story sequences* — over a play that forgets each step: the century draws the
    plate boundaries from real rows, at the cost of one uniform.

---

## 20. Builder's decisions (core)

What the core build (2026-09-30) decided where this file, ART.md and CONTRACT.md were silent or
disagreed. Each item says what was chosen, over what, and what would change it. Measurements name the
tool that printed them; headless Chromium numbers are trends, never phone evidence.

- **Numbers corrected by CONTRACT's builder's decisions** are the ones used: 385,071 history rows,
  15,664 text rows, the columns read from their own offsets (N is odd), no "32-fold" note. Two
  figures here differ for the same reason as the 15,664 (the decoded half-up tenth, so "3.95" is
  M 4.0): the app counts **205** M 4+ earthquakes in 1964 (§3.5 says 203) and the History strip's
  maximum at 4+ is **929 in 2020** (ART.md says 910). Both are what the shipped file holds.
- **Module names.** §14's `timeline.js` holds the time model (Live and History windows, labels,
  Play steps); `strip.js` draws both forms of the record strip, over splitting the History form into
  `timeline.js`. The brief that started this pass called the time module `time.js`; §14's name was
  kept.
- **The sheet lies over the map**, over making the map a grid row that resizes. The five canvases
  span the panel under the top bar and never resize when the sheet changes height (a resize every
  frame of the 240 ms move would clear and redraw five canvases); the region fit, the scale bar's
  latitude, the pan clamp, "in view" and the map's controls use the part above the sheet. Cost: the
  backing stores are 390 × 800 CSS px, not 390 × 648: about 5.0 MB each at DPR 2, not 4.0.
- **Five layers, not the four-layer fallback.** Measured in headless Chromium over nine region moves:
  the relief draw costs 0 ms of JS at the median and 29 ms at most (its first draw, with the texture
  upload); the second context adds one backing store (780 × 1,600 × 4 B = 5.0 MB). Nothing measured
  here argues for the fallback; the phone's memory reading is what would (§13).
- **Rows without a magnitude are counted apart.** They are drawn as × in any window reaching before
  1900 whatever the floor (§6), but the History label's count is the floor's: "All, 1638–2026 · M 4+ ·
  34 157 earthquakes · 180 × without magnitude · 11 597 in view". "In view" counts the floor's rows too.
- **Live windows** are `[to − k·1440, to]` in feed minutes, inclusive of the feed's minute (the same
  bound as the `ask` summaries); All sizes is every magnitude code (M −2.0 and up), M 2.5+ is code 45.
- **The Live strip's ruling**: hour lines for Day with every 6th hour at full strength (ART's "every
  7th" reads naturally only for days); day lines for Week, all at full strength; for Month every 7th
  day line from the window's first UTC midnight, labeled with its day and the month at the first.
- **No composed glosses on the card.** §8.3's "Reviewed by USGS", "Automatic — may change or be
  deleted", "0.8 km above sea-level datum" and "— often the depth networks assign…" are sentences of
  the app's own about USGS fields. The card prints the catalog's word ("Status: reviewed",
  "Status: automatic", "Status: automatic, as the catalog lists it" for older rows) and, where
  about.json holds one, USGS's quote prefixed "USGS:": the status meaning for live automatic rows, the
  10 km FAQ at a depth coded 10.00 km ("At 10 km, as the catalog lists it", §25), the depth reference for negative depths, and the meanings of felt,
  the tsunami flag and PAGER beside their values. "Nearness is not cause…" is taken from about.json's
  faults note. What would change it: a quote that says the shorter thing.
- **Selecting keeps the event in sight.** A tap on the map lifts a Peek sheet to Half and pans only if
  the event would sit under the sheet; a list row or a strip stem flies to it (at least 1.5 × the
  Lower 48 scale) and unmarks the region chip.
- **Relief strength stays at ART's starting values** (0.40 / 0.20 light, 0.55 / 0.08 dark). A first
  look at California blamed the relief for a harsh texture and lowered it; with faults switched off the
  relief read quietly, so the change was undone. The texture is the fault layer (next item).
- **The fault layer is the loudest thing on the map at regional zoom**, left as §10.1 specifies. In
  the Basin and Range and California at the California chip's scale, 0.6–1.4 px lines at 35–90 % in
  graphite (light) or pencil (dark) cover the land more than the dots do. Not restyled here, because
  the weights are specified; the next pass (Layers) should decide, e.g. alphas that fall with line
  density or a zoom threshold for undifferentiated Quaternary. The owner's eye is the test.
- **Volcano names** are placed after every triangle is drawn, so a name never lands on a later
  triangle, and nothing is named under the chips row.
- **Outside the axis box** the base shows paper (`--bg`): the data's edge, not a neatline. It shows
  above 72° N in the Alaska view and east of 64° W. (Superseded in §24: the paper past the edge is
  hatched, as the strip marks "no record"; and in §25: the basemap runs past the axis, and the hatching
  marks only where it ends.)
- **The first view** is stored only after `geo.json` is decoded; storing the pre-data default had
  overwritten the Lower 48 fit on a first launch.
- **No wheel zoom.** Pinch, double-tap and the keys (arrows, + / −, Enter) are the ways in; the wheel
  handler was removed for bytes (the app is a phone app).
- **The pure-JS inflate fallback is kept** as §11.2 asks, though iOS 18's WKWebView should always take
  the native `DecompressionStream('deflate')` path. It is 4.3 KB of the code budget (next item).
- **The code budget.** App code is 135,372 of 150,000 bytes (`check.mjs`), which leaves about
  14.6 KB for the next pass (section plot and drawing, stories, Layers, the legend card, the opening,
  arrivals, fault and volcano cards), estimated at about 25 KB. Levers, in order: tighten the
  modules' comments (about 14 KB of comments today); drop the inflate fallback after the phone
  confirms the native path; fold `about.js`'s interim render into the final one. The ZIP itself has
  room (6,248,645 of 8,000,000 before NOTES.md and this section).
- **About is an interim render** in the sheet body at Full (intro, units, reading, notes with quotes,
  what is not shown, sources with what this app changed, software); the next pass gives it its panel.
- **Tests.** `check.mjs`'s vendor-name scan reads `geo.json` with its encoded polylines left out: a run
  of polyline characters spelled a product name (in `faults.lines[23]`). It resolves `fetch()`,
  `src` and `href` against the page and `import` and `url()` against their own file. `shoot.mjs`
  computes every count and window it asserts from the shipped files with Node's own zlib, not with
  `js/data.js`, and records Play's steps inside the page (every 20 ms between frames) so a slow
  harness cannot skip one. Its text-contrast check composites glass over the page ground, not over
  the map beneath it; ART.md's figures over land, sea and relief stand for those.

---

## 21. Builder's decisions (polish)

What the polish pass (2026-09-30) decided: the section, stories, Layers, About, the opening, arrivals,
accessibility and the test harness. Each item says what was chosen, over what, and what would change
it. Every figure names the tool that printed it; headless Chromium (SwiftShader) numbers are trends,
never phone evidence.

- **The code budget was met by cutting, not by trimming features.** App code is 149,796 of 150,000
  bytes (`check.mjs`). Three levers, in §20's order: comments cut to one or two header lines per module
  and short section markers (about 12 KB; DESIGN and this section carry the reasoning); indentation
  changed from two spaces to a tab (about 2.9 KB); and **the pure-JS inflate fallback removed** (4.3 KB),
  so the snapshot is inflated only by `DecompressionStream('deflate')`, still into a buffer of exactly
  the declared size and refusing more. iOS 18's WebKit ships that API (Safari 16.4 and later), so the
  fallback never ran on a supported phone; a device without it gets the sentence "this device cannot
  decompress it (no DecompressionStream)" and History still works. `test_decode.mjs` now checks that
  refusal instead of the fallback. What would change it: the phone check failing to read the snapshot
  (then restore the fallback from git and find 4.3 KB elsewhere). The margin is 204 bytes: the next
  feature needs a cut first.
- **Module layout.** Two modules beyond §14: `js/stories.js` (the list, the card, the window a story
  names, the sequence windows) and `js/layers.js` (the Layers panel, the legend card and the drawn
  keys About reuses). `section.js` holds the maths, the corridor on `#over`, the corridor query and the
  plot. `about.js` renders a full-height panel (`#about`, over map and sheet, under the top bar)
  instead of the core's interim body.
- **The section.** One finger draws; a drag that starts within 22 px of an end moves that end only;
  two fingers still pan and zoom (map.js's `onDrag` hook consumes the one-finger drag). The corridor is
  sampled every 5 px of the line on screen (16 to 256 samples), its edges at ±half-width by rotation
  toward the circle's normal, ticks every 50 km drawn inward from both edges (at most a quarter of the
  corridor's width, so a narrow corridor is not hatched solid). The plot redraws live during a drag
  only while its last draw took under 12 ms; otherwise on release. Measured (`shoot.mjs`, SwiftShader):
  Cook Inlet 14–15 ms, Aleutians 8 ms, Cascadia 1 ms, Hawaii 53–55 ms (35 342 dots in Canvas 2D), so
  in the harness only Cascadia and Aleutians-sized sections follow the finger. The events are found
  through the grid index over the corridor's lon/lat box, then tested on the sphere in float64; the
  harness recounts every preset with its own float64 maths over all 403 366 rows and gets the same
  numbers (Cook Inlet 6 377 within ±50 km, 3 of them without depth; Aleutians 5 390; Cascadia 717;
  Hawaii 35 401). Rows without a magnitude (pre-1900 ×) are left out of the plot and its count.
- **The plot's key is USGS's words.** ART's key "– – 10 km: depth often fixed here" is the app's own
  gloss of a USGS practice; the key prints the dashed swatch, "10 km" and about.json's
  `fields.fixedDepth.more` quote ("Ten kilometers is a "fixed depth." …") instead, as §20 decided for
  the card. The depth labels follow the unit setting (km or mi at the ramp's stops); the distance
  labels are every 100 of the chosen unit. The callout avoids the rail and the right edge.
- **Presets** switch to History, All and 2.5+ (the chips show it), lift the sheet to Half, and move the
  view only when an end of the line is off the visible map; so Cook Inlet from the Alaska chip keeps
  the Alaska view (`screenshots/app.png`), and Hawaii from the Lower 48 flies to the island.
- **Dimming outside the corridor is α × 0.25 in the shader, as specified.** Over a dense cluster the
  stacked translucent dots still add up: off Cape Mendocino in the 2010s at M 2.5+, the layer's summed
  alpha falls to 55 % (7 440 → 4 112, `shoot.mjs` reading the WebGL canvas in the frame it was drawn),
  not to 25 %. Visible, but softer than the number suggests. What would change it: the owner asking
  for a stronger dim, e.g. 0.12.
- **Stories** open in History with the window, floor and view they name (a stub window is the Year
  window at the story's year, which the timeline labels "Before 1900"), select the largest anchor
  present in this copy, lift the sheet to Half before fitting the view, and put the story card first in
  the body with the anchor's event card under it. The annotation's tab goes to the quadrant around the
  anchor with the fewest drawn events among those that keep the tab on the visible map. **Play the
  sequence** steps cumulative windows every 300 ms (Reduce Motion too); the label names the last day
  included ("1964-03-27 to 1964-04-03"), so the final Kīlauea step reads "2018-04-30 to 2018-08-31",
  matching the story's text. Any hand-made change of window, floor, time or mode ends the sequence
  and returns to the calendar window; hiding the page pauses it where it is.
- **Taps: a volcano's triangle wins only when it is at least as close as the nearest dot.** §8.4 says
  the triangle "wins over dots within 12 px"; read literally, a tap squarely on Ridgecrest's M 7.1 at
  the California chip's scale selected Coso Volcanic Field, 11 px away. Now the volcano is chosen when
  it is within 12 px and no drawn event is closer; faults are still chosen only when no event is within
  22 px. Fault and volcano cards print the database's and the API's own labels, the class-A/B/C and
  alert-level quotes from about.json, and about.json's own notes ("Faults are not a hazard map", "Not
  monitored is not Normal"); a volcano without a status is "Not monitored", never Normal.
- **Layers** is a glass panel under the tools with six switches (`role="switch"`), the units and the
  volcano status's reading time (or "Volcano status not available in this copy"). It ends above the
  map's foot, so the credit line and its "Not a warning service" are never covered; it scrolls when the
  sheet is at Half. Choices persist in `uq.layers`.
- **The legend card** has seven rows of keys drawn with the app's own marks (sizes M 3/5/7/9, the ramp,
  hollow, gray and ×, three fault weights, the five threat triangles, the trace). Its words are the
  app's descriptions of its own display, never of a USGS field.
- **About** prints about.json in order (intro, reading with drawn keys, the notes each with its USGS
  quote and the quoted page's title), then **the Oklahoma statement from stories.json's two quoted
  sources** (about.json carries no Oklahoma note; the quotes are the pipeline's, so no text is typed
  here), what is not shown, the data's dates (the history's cutoff and retrieval, the feed's and the
  snapshot's times, the volcano status's), every source with owner, license, the license quote, what
  this app changed, citation, attribution line and address as text, every quoted page, the software
  and fonts notice, the units and the version line. Five taps within 3 s on the version toggle the
  frame-time readout (median of the last 30 frames: whole frame, map, base, overlay). The credit line
  opens About at its sources. The magnitude-type table was left out for bytes: each card already names
  its own type from the same table.
- **The opening** starts when the first snapshot is decoded, stored first (`uq.intro`), only without
  Reduce Motion, with a snapshot, visible and with WebGL 2. The whole axis box is fitted (on a portrait
  phone that leaves paper above and below, as the box is wide). The window's upper uniform runs from
  the window's start to the feed's minute in 3.0 s linear, with the strip's pen cut at the same time
  under a 1 px ink cursor and its label reading "The last 30 days, as recorded"; then a 600 ms ease to
  the Lower 48. Any pointer or key anywhere ends it at the final state; so does hiding the page.
- **Arrivals** compare the snapshot's last minute with the one seen before, in this session or stored
  from the last launch (`uq.feedTo`). Rows after it fade in over 600 ms in time order (each over 400 ms,
  staggered by a new `uNewSpan` uniform), the Live strip's pen writes their stems in step, and the
  largest row's right side reads "{n} new since {HH:MM} UTC" until the window changes or ten minutes
  pass. Under Reduce Motion all of it appears at once. Nothing changes size.
- **Hit targets.** Every control's hit area is at least 44 px where fingers go, measured by the harness
  as the span of points through the control's center that land on it (every 0.5 px; ≥ 43.5 passes). To
  get there: list rows are 44 px (ART says 40), chips carry −11/−13 px hit extensions inside a padded
  row, the tools −5 px, segments and buttons −10 px, the credit line is a 27 px tab, the map's foot
  sits 16 px above the sheet, and the grip's hit area reaches 5 px above the sheet and 23 px into it (so
  it never takes the credit line's). The top bar sits above About so its segments keep their full hit.
- **The sheet body scrolls to its top** when a selection, a list, a pick or a story opens, and keeps
  its scroll on every other redraw.
- **Spelling.** New strings use US spelling ("color code", "colors"); about.json, stories.json and
  CREDITS.txt, written by the pipeline, use "catalogue", "colour" and "licence" (listed as a concern
  in NOTES.md; the fix belongs in `scripts/us_quakes/content/`). *Fixed in the QA pass (§23).*
- **The harness** (`tools/shoot.mjs`) runs each theme on its own fresh profile with `uq.intro` preset
  (so only the opening scenes see a first launch), and asserts 133 checks across both themes: every
  count against its own decode, every section against its own float64 corridor, the dimming in pixels,
  hit targets, contrast over every rendered text style in six states, chrome chroma, reload, hiding,
  the landscape layout and the opening (watched in light, ended by a touch in dark, never twice, never
  under Reduce Motion, never without a snapshot).

---

## 22. Focus mode

The owner's rule for every app whose hero is a view: a way to see the view alone. Here the view is the
map, and the record strip is how it is read in time, so both stay; everything else steps aside. It is
designed in the Drum Record's voice: the working sheet trimmed to its record, the chrome gone, and the
one line of honesty left where it always is.

- **One state**, `st.focus`, persisted as `uq.focus` (a boolean; anything else reads as off), off by
  default. A reload restores it before the first draw. It needs WebGL 2: without it the key is not
  shown and a stored `true` is not applied.
- **What leaves**, each with `hidden` and `inert`, so out of the accessibility tree and the tab order
  and not merely transparent: the top bar (title, Live | History, About), the region chips, the key
  column (Layers, Section, the focus key itself), the compact legend and its card, the grip, the
  sheet's body, and in the Live head the window control and the largest row. An open Layers panel,
  legend card or About closes first.
- **What stays**: the map; the record strip in its current form as a band at the bottom (Live: the
  feed stamp and the stems; History: the window's label, the Play key, the year bars with the bracket
  and thumb, the window and floor controls) with the grip gone and 6 px of paper above the head; the
  scale bar; the notices ("Restoring the map…", the 48 h notice, the section hint); and the credit
  line, whose "Not a warning service" is on screen whenever the map is, here as everywhere. The Play
  key, the strip's scrub, tap and keys, the window and floor controls all work as they do in the sheet.
- **The map takes the freed space.** `#map` runs from the top of the screen to the band, the five
  canvases are resized once (not per frame), and the view is re-fitted: to the marked chip's box when
  a chip is marked, otherwise keeping the point at the center of the free map at the center of the new
  free map, at the same scale. Measured in the harness (California, Live, from Half): the free map goes
  from 358 to 730 px tall, `#base` from 1 600 to 1 688 device px; the band is 110 px in Live and 148 px
  in History (`shoot.mjs`). A box that is limited by the phone's width (the Lower 48, Alaska) keeps its
  scale, and the extra height shows more of the sea and of the land beyond it (the basemap past the
  data's edge, §25; before it, hatched paper); a tall box (California, the Pacific Northwest) grows.
- **Selecting in focus mode.** A tap on the map, a long press or a tap on the Live strip selects as
  usual, but the sheet does not lift: the card (or the long-press list, or a fault's or volcano's
  card) opens over the map as a `--glass` card above the scale bar, at most 45 % of the screen tall and
  scrolling, with its ✕. When the selected event would sit under that card (whose room is taken as
  the lesser of 260 px and 45 % of the map), the view pans it above. Leaving focus mode moves the
  card back into the sheet.
- **In and out.** In: a 36 px key at the foot of the map's key column, drawn as the other keys are
  (`--glass` square, 1.25 px ink line icon): four corner marks, the frame of the sheet, labeled
  "Hide the controls". Out: a ghost key in the map's top-right corner, the same size, with no fill, a
  1 px `--ink-2` outline and the corner marks turned inward in `--ink` over a 1 px `--bg` halo so it
  reads over land, sea and dots; labeled "Show the controls"; and Escape. Both keys have 46 px hit
  areas. From the keyboard (Enter or Space on a key, or an activation with no pointerdown on the key
  in the second before it) focus moves to the ghost key on the way in and back to the focus key on the
  way out, and Escape leaves with focus on the focus key. After a pointer it stays where it was:
  Chromium rings an element that script focuses after a pointer's click (the QA pass's
  `focus-history-light.png` showed a ring round the ghost key), and a ring round a key nobody reached by
  keys is noise on the map (§25). Place and volcano labels keep clear of the ghost key.
- **Motion.** On the app's curve: the controls fade out over 160 ms (the cards' duration), then the map
  and the band change at once and the view eases to its re-fit over 240 ms while the sheet's height
  follows over its own 240 ms; out, the controls are back at once and fade in over 160 ms. Nothing
  moves between positions but the view and the sheet's edge, as elsewhere. Under Reduce Motion the
  change is immediate, with no transition or animation running (asserted).
- **The opening never starts in focus mode.** A first launch cannot have it on, and a stored `true`
  skips the opening. The focus key ends a running opening, as any touch does.
- **Wide screens.** At ≥ 700 px the band runs the full width under the map instead of the 380 px
  column, and the map takes the full width.
- **Tests.** `shoot.mjs` scene 17, both themes: in by the key with a pointer (every hidden element
  `hidden`, `inert` and computed `display: none`; the accessibility snapshot without them and with "Show
  the controls"; focus not moved and nothing ringed; `uq.focus` stored); in and out by Enter (focus on
  the ghost key and back on the key, each ringed); the map grew and its canvases with it; the credit line
  on screen above the band; hit areas and text contrast in focus mode; the Live strip's largest stem
  tapped opens its card over the map with the band unchanged; out by Escape (every control back, focus
  on the key, the sheet at its height again); in History: the band's controls, a scrub of the strip
  (the label checked against the drawn window), Decade and a step back by the arrow key, a tap on the
  1964 M 9.2 opening its card over the map; out by the ghost key with a pointer (the card back in the
  sheet, focus not moved); a
  reload with focus on (restored, no opening); and a Reduce Motion profile (in and out at once, nothing
  running). Pictures: `screenshots/focus-live-{light,dark}.png` (California, Live) and
  `screenshots/focus-history-{light,dark}.png` (Alaska, 1964).

What would change it: the phone. A fast drag of the History thumb in the band, and the ghost key's
legibility over real relief under a thumb, are owed to the device (NOTES.md).

---

## 23. Builder's decisions (QA pass)

What the QA-and-review pass (2026-09-30) changed besides focus mode. Figures name the tool that printed
them; headless Chromium (SwiftShader) is correctness and pictures, never phone evidence.

- **`hidden` means hidden.** QA found that without WebGL 2 the Layers and Section keys stayed on screen:
  `#tools { display: grid }` outranks the browser's `[hidden] { display: none }`. A single rule,
  `[hidden] { display: none !important }`, now covers every element the app hides with the attribute
  (the key column, the ghost key, panels, heads). The harness's no-WebGL scene asserts the computed
  display (`tools none`, each key 0 px wide), not the DOM property; with the rule removed it fails
  ("tools grid 36, layers-btn grid 36, …"), with it it passes.
- **US spelling at the source.** `scripts/us_quakes/content/about.json` and `stories.json` now say
  "catalog", "Color", "Gray", "labeled", "kilometer", "center", "epicenter"; `build_about.py` writes
  "credits and licenses" and "License:" in CREDITS.txt and respells the two British words that reach it
  from the build steps' credits fragments ("the catalog's type" → "catalog's", "gray JPEG" → "gray"),
  because those scripts are outside this pass. Quotations, page and dataset titles, the license quotes
  and the JSON keys (`licence`, the reading ids `colours` and `grey`) are unchanged. `build_all.sh
  --offline` rebuilt about.json, stories.json and CREDITS.txt only; history.bin, history.json, geo.json,
  the four relief JPEGs and `tools/ref/*.json` hashed identical before and after (sha256), and
  `verify_static` passed. The app's own strings followed ("Loading the catalog…", "as the catalog lists
  it", "Gray: no depth"; miniapp.json's "cataloged").
- **The code budget is 200 000 bytes** (the lead raised it from 150 000 for this pass; `check.mjs`).
  With it the code is back in the repository's two-space indentation (it had been tabs for 2.8 KB),
  every module carries a two-to-four-line header saying what it owns, and focus mode fits.
- **The Lower 48 sat low.** The chips' fit centered the box in a band that reached 44 px into the foot
  (scale bar, legend, credit line), so the states sat 56 px below the free map's center, and it kept a
  60 px right margin for the key column the box never reached. The fit now uses the free band between
  the chips and the foot (§4.4) and keeps the key column clear only when the box would reach its
  height. Measured at Peek (a one-off Playwright reading of the view): the box's center is 4 px from the
  free band's center (was 56 px low) and its scale is 2 218 (was 1 946, 14 % larger); at Half, 4 px
  (was 56 px low, its foot under the scale bar). Canada still fills the top: the box is limited by the
  phone's width, so the only other lever would be cropping the states.
- **Volcanoes recede at wide zoom.** At the Lower 48's scale the triangles (7–11 px, a 3 px halo, a
  1 px outline) read louder than the earthquakes. Their size is now `(0.65 + 0.35 k)` of the threat
  class's and their halo and outline `1.5 + 1.5 k` and `0.75 + 0.25 k` px, where `k = clamp((z − 1) /
  2.25, 0, 1)` and `z = log2(s / sMin)` (the Lower 48 at z 1.03, Alaska 0.83, California 3.31, the
  Pacific Northwest 3.23, Yellowstone 5.77), so they are at 0.65 in the wide views and full size from
  the regional chips on. The hue rule is untouched: the fill is still USGS's color code and only it;
  the legend card's keys are drawn at full size.
- **The light relief was raised to 0.50** (uDark; uLight stays 0.20). The measurement (`shoot.mjs`
  scene 1, the western US at the Lower 48 view, #relief composited over `--land`): at 0.40 the shaded
  5th percentile was luminance 0.616 against bare land's 0.842 (1.34:1, L* 82.7 against 93.5), and the
  lit 95th percentile 0.849, so in light the relief shows only by its shade, lit slopes being nearly
  the land's own white. At 0.50: 0.567 (1.45:1, L* 80.0); at 0.55, DESIGN's ceiling, 0.544 (1.50:1). The
  dark theme reads 0.010 · 0.014 · 0.017 at 0.55 / 0.08, unchanged. The cost is a dot's dark rim over the
  darkest shade: 3.57:1 at 0.40, 3.48:1 at 0.50 (computed from the same figures), still above 3.
  0.50 over 0.55 keeps the land a surface for dots; the owner's eye may take it to 0.55. The relief is
  gray, so "chrome is ink" is untouched (the harness's chroma check: 0.0194, the light `--ink-2`).
- **The History label is two lines by design, three when × are drawn.** Line one names the window and
  the floor (Atkinson 700 14 px, then mono), line two the counts ("205 earthquakes · 44 in view"), and
  a third, in `--ink-2`, counts the × apart ("180 × without magnitude"), which are exactly the windows
  reaching before 1900. The lines are 16 + 13 + 13 px, inside the Play key's 44 px row, so the head is
  143 px in every window and never jumps. The breaks are " · " kept in the text (hidden on screen), so
  the label reads as one sentence to a screen reader and to the harness. Measured with the vendored
  fonts: the longest first line ("September 2026 (to Sep 30) · M 2.5+") is 255 px, the longest second
  ("34 157 earthquakes · 11 597 in view") 275 px, against the 312 px beside the Play key; the old one
  line needed 486 px with the × clause, which is why it wrapped.


## 24. Builder's decisions (second fix pass)

What the second review (QA, an honesty reviewer and a stranger's-phone reviewer, 2026-09-30) changed.
Every figure names the tool that printed it; headless Chromium 153 on SwiftShader is correctness and
pictures, never phone evidence. The harness gained the scenes that would have caught each defect
(`tools/shoot.mjs`, "20b"), driven through real CDP touches and keys rather than the app's own hooks.

- **Without WebGL 2 there is no map at all.** The base, lines and overlay were still drawn behind the
  sentence (QA: 12 866 / 527 / 209 painted pixels). The frame now draws no static layer without WebGL 2,
  and the chips, legend and scale bar are hidden with the keys; the sentence and the credit line stay.
  The harness reads back every pixel of `#base`, `#lines` and `#over`: "base 0, lines 0, over 0".
- **A hollow ring has a hole at every size.** The ring was `max(1.25 px, 0.18 d)` wide, so any dot of
  2.5 px or less was solid: 1 728 of 1 746 live automatic rows (honesty review). A hollow ring is now
  never drawn smaller than an **M 4 dot (3.70 px × k)**, with a ring `max(0.9 px, 0.18 d)` wide, in the
  shader and in `drawDot` alike; About and the legend say so ("never smaller than an M 4 dot"). This
  enlarges small automatic rows, a declared display floor like the 2 px floor all dots already have;
  the alternative, a legend saying small rows show no hole, would leave the status unreadable exactly
  where most automatic rows are. Measured on `#gl` at the California view: center / ring alpha
  0 / 81 and 0 / 186 for two isolated M 1.5–1.6 automatic rows (the old code on the same rows: 87 / 128
  and 172 / 187). The legend's hollow key is drawn at M 6 and at the floor.
- **The size rule is stated where it holds.** About: "Each whole step of magnitude doubles a dot's
  area, down to magnitude {sizeFloor}; smaller earthquakes share the smallest dot" (`sizeFloor` 2.2 is
  computed by `build_about.py` from the rule's constants); the legend: "M 3 · 5 · 7 · 9: each whole
  magnitude doubles the area; M 2.2 and below share the smallest dot".
- **No sentence of the app's own about negative depths.** The "Above the datum" note (and its claim
  that a negative depth "is not an error", which USGS's FAQ contradicts) is replaced by a count and
  what the app does: "11 448 rows in the history have a depth above 0 km. The map colors them as 0 km
  deep, and the cross-section plots them above its 0 km line", with the ComCat depth-reference quote.
  The FAQ's two sentences on negative depths would be better still; they are not in
  `credits/usgs-statements.txt`, which is the lead's to extend. "Color is depth below the surface"
  became "Color is depth as the catalog gives it". (Done in §25: the note quotes the FAQ and says "a
  negative depth".)
- **"10 km" means 10 km to the nearest 10 m.** The depth code 1500 holds the fixed 10 km and 203
  measured depths that round to it (CONTRACT §1), so the card says "At 10 km, to the nearest 10 m.
  USGS: …" and the section caption "at 10 km (to the nearest 10 m)"; neither says "exactly". Keeping
  the two apart needs a change to `build_history.py` and `refresh.py` (outside this pass; asked of the
  lead). (Done in §25: code 1500 is now the catalog's exact 10 and nothing else.)
- **The stories name the box they count.** "In this view" disagreed with the head's "in view", which
  counts the screen (6 against 8 for 1906; 2 516 against 2 538 for Ridgecrest). San Francisco,
  Ridgecrest, Oklahoma and New Madrid now say "between 32.4 and 42.1° N, 124.5 and 114° W" (computed
  from `geo.json`'s view by `build_about.py`). Oklahoma's card no longer prints an invented
  "2009-01-01": `when` is "2009", and the build refuses a `when` that is neither an anchor's catalog date
  nor a year or a span. New Madrid drops the unquoted "Before any seismograph"; it and Ridgecrest print
  their magnitude types ("(mw)"); story depths lose a trailing ".0" ("25 km deep", as the catalog gives
  it).
- **Other text**: the manifest no longer claims "every cataloged earthquake" ("USGS-cataloged
  earthquakes around the US since 1638 (M 2.5+ from 1900) …"); the magnitude-types note says "Each
  event's card shows the magnitude type", which is what the app does; "Boxes, not borders" names the
  countries the place table does (Canada, Mexico, Russia and the Dominican Republic, computed);
  ShakeMap and DYFI are "separate USGS products"; "shown above" became "shown on the Live sheet";
  CREDITS groups "112 944" with a narrow no-break space. `mw`'s magnitude-type "quote" was its own
  header and is now null (never displayed; the header line in `usgs-statements.txt` is the lead's, and
  went in §25).
- **An aged copy names its windows against the feed.** From 48 h, "the past 30 days" becomes "the 30
  days to 2024-09-30 16:51 UTC" in the Largest heading, the map's name and the section caption.
- **The volcano status never read** fills nothing, whatever `monitored` holds, and the legend reads
  "Volcanoes by threat class; volcano status not available in this copy" (§10.1).
- **Stories take their own window.** Opening a story after another's sequence kept the old window and
  its button paused the old sequence; `openStory` now ends any Play or sequence, and a story's button
  pauses only its own. Play and a sequence also wait for each step to be drawn before the next (a
  slow first frame once skipped a year on screen: traced with a `histAt` write log).
- **Rotation keeps the region.** `M.resize` no longer shifts the center; when the map's own size
  changes, a marked chip is fitted again and otherwise the place at the free map's center stays there.
  Harness: the California box inside the free map in portrait, landscape (464 × 346) and portrait again,
  the chip marked throughout.
- **The Live strip under the finger.** A touch or drag moves only the selection (the ring, the card
  and the pen on the strip); the sheet lifts and, if the event is off the free map, the view flies,
  once, on release. Harness: a 30-step CDP drag at Peek kept the strip at 745 px, selected 26–27 events (two runs) in
  turn and left the view unmoved until the release.
- **A long press lifts the sheet on release**, and the click that follows it is swallowed; `#map` sets
  `-webkit-touch-callout: none` and `user-select: none`. Tap and long-press timing use the events' own
  `timeStamp`, so a long frame before the handler never turns a tap into a press.
- **Past the data's edge the paper is hatched** (`--hatch-map`, 7 px) with a 1 px `--line-strong`
  edge, the strip's "no record" language, so the bands a phone-shaped view shows below 17° N or above
  72° N read as designed. Carrying Natural Earth's land and bathymetry past the axis would fill them
  with map instead; that is a `geo.json` change for the pipeline. (Done in §25: the basemap runs to
  25° S–81° N and 168° E–55° W, the view is held inside it, and the hatching marks only where it ends.)
- **Regional zoom**: faults are drawn at 0.55–1 of their class's alpha (1 from zoom 5; the California
  chip is 0.62); volcano names appear from zoom 4.5, or for a volcano above Normal or the one chosen,
  so cities are named first at the California and Pacific Northwest chips; no label runs off the right
  edge or under the foot's glass. GREEN triangles keep their fill at every zoom: drawn empty they would
  read as the legend's "empty: not monitored".
- **The CONUS relief ends softly**: its edges fade over 0.5° (`uEdge`), well clear of US land; the
  AK, HI and PR tiles, whose edges touch US islands, do not fade. Masking the tile to US land in
  `build_relief.py` is the better fix and the pipeline's. **Declined by the lead (§25):** the basemap
  now runs on into Canada and Mexico, and a relief that stopped at the border would read as a cut
  across their land; the 0.5° fade and About's note ("the United States and, near its borders, parts of
  Canada and Mexico") stand.
- **The relief keeps its JPEG bytes, not its pixels.** Each tile is fetched as a Blob, decoded to an
  ImageBitmap, uploaded and closed; a context loss decodes again. About 85 MB of decoded RGBA no longer
  sits beside the textures (the risk the phone must measure, §16). The harness's relief figures are
  unchanged: luminance p5 0.567 · p50 0.820 · p95 0.849.
- **Type**: numbers in mono and words in Atkinson in mixed lines (`nums()`: the legend card, the
  corridor controls, the History label's counts, the card's time and type, the largest row, a story's
  date); `tabular-nums` where Atkinson's digits line up (ART.md "Type"). (Carried further in §25: About,
  the stories, the section caption, the card's fault and volcano lines, the Live counts.)
- **Accessibility**: `<main>` is a plain landmark; the map's description moved to `#over` (a leaf,
  `role="img"`), so an engine that flattens `img` children cannot hide the chips, keys and credit line;
  the Live strip is `role="img"` named by its count and largest; the other canvases are `aria-hidden`.
  With Section on, Enter on the focused map places A at the center, the arrow keys move the map and
  Enter places A′ (harness: an 873 km section drawn from the keyboard). About has `overscroll-behavior:
  contain`, as the sheet body had.
- **US spelling in the shipped Markdown**: NOTES, ART and DESIGN are respelled (138 words) outside code
  spans, fenced blocks and quoted words; JSON keys (`licence`, `colours`, `grey`) keep the contract's.
- **Declined**: the grip's hit area still reaches over the Live stamp's top edge. A 44 px target needs
  23 px below the 16 px grip, because above it the credit line's own 44 px area begins 6 px over the
  sheet; tapping the stamp's text cycles the sheet height, which is what the grip does anyway.


## 25. The lead's pass

What the lead's pass (2026-09-30) changed after the final review found no must left: the reviewers'
shoulds, and the asks the builder's passes left to the pipeline. Every figure names the tool that
printed it; headless Chromium 153 on SwiftShader is correctness and pictures, never phone evidence.

- **The basemap runs past the axis.** `build_geo.py` clips land, lakes, coast, borders, state lines and
  the eight depth bands to 168° E–55° W and 25° S–81° N (`geo.json.basemap`), not to the axis box; the
  places, faults, volcanoes, views and presets stay on the axis. The brief said about 5° N and 76° N
  across the same 172° E–64° W width; measured from the app's own view on 390 × 844 (a Playwright sweep
  of the chips at Peek, Half and in focus mode), the framings need more: the Lower 48 shows 15.9° S to
  66.1° N at Peek and 23.6° S to 68.4° N in focus mode, and 232.0 to 304.2 on the axis at Half (its
  right 60 px kept for the key column, §4.4); Alaska 169.0 on the axis and 79.5° N at Peek; Hawaii and
  Puerto Rico 14.4° N in focus mode. With a basemap to 5° N the clamp below would have pushed the Lower
  48 130 px low at Peek (the defect §23 fixed), and with its east edge at 64° W 44 px under the key
  column at Half. The coast and state lines go with the land, or the land past the axis would have no
  shoreline and Mexico's state lines would stop in a straight line at 17° N.
- **Simplified by zone, one pass per ring.** The contract's thresholds (250 000 m²; 5 km² for the
  bands, whose rings under 50 km² are dropped) hold across the axis's width from 14° to 75° N, where the
  chips look closely; ten times them elsewhere from 5° N north (the width's extensions and the Arctic,
  seen at the Lower 48's and Alaska's scale, 4–18 km a pixel); eighty times south of 5° N, seen only at
  the Lower 48's. `common.simplify` ranks each vertex by its triangle over its own threshold, so a ring
  that crosses from one zone into another is simplified once and the zones meet without a seam; with no
  zones given it runs the original code, and `geo.json`'s faults, places, volcanoes, relief, views and
  presets came out identical to the file before (compared key by key).
  Measured (`build_all.sh --offline`, `verify_static.py`): land 458 pieces (192 reach past the axis
  box), coast 450 (182), lakes 232 (10), borders 38 (31), states 153 (13); the bands 4,894 rings (1,658
  past the axis box); the basemap's keys 673,536 B raw (468,073 before); `geo.json` 1,851,803 B raw (cap
  1,900,000) and 987,085 B as the ZIP stores it (837,552 before); `assets/` 5,851,793 B as the ZIP
  stores it, **148,207 B** under the 6,000,000 cap (§13 has what that means for the yearly rebuild).
- **The view stays on the map.** `M.clampV` holds the panel above the sheet, the chips row included,
  inside `geo.json.basemap`; where the panel is wider or taller than the basemap (the opening's whole
  arc, the widest zoom) it holds all of it instead. The fit, the chips, `sMin` and the opening are
  unchanged, and on the reference phone the clamp moves none of the framings measured (the Lower 48,
  Alaska, Hawaii and Puerto Rico at Peek, Half and in focus mode show the same spans before and after).
  `test_geo.mjs` checks the clamp over 5,070 requested views on six panel shapes; `shoot.mjs` checks
  that the Lower 48 at Peek, the nine chips at Peek and the Lower 48, California and Alaska in focus mode
  each lie inside the basemap. A phone on its side does move: the Lower 48 (226.4 to 305 on the axis)
  is held 2° west, Alaska 16° east so its box sits left of center rather than beside 70 px of hatching,
  and in focus mode the 844 px map is wider than the basemap, so all of it is in view, the Lower 48
  right of center and 57 px hatched at the right edge. The scale bar says "° S" should the map's center
  pass the equator.
- **The hatching stays, where the map ends.** It was the interim answer for the axis's edge; it now
  marks the basemap's edge, which the phone's default framings never reach, and shows at the opening's
  whole arc and the widest zoom. About's display note says "the hatching where the map ends".
- **The relief is not masked to US land** (reviewer B's suggestion, declined by the lead): the basemap
  now runs on into Canada and Mexico, and a relief that stopped at the border would read as a cut
  across their land. The CONUS tile's 0.5° fade and About's note stand (§5.2, §24).
- **Code 1500 is the catalog's 10 km.** `common.depth_code` writes a depth that is not exactly 10 but
  rounds to 10.00 km as 1499 below 10 and 1501 above (the nearer), and `build_history.py` and
  `refresh.py` both code with it; `verify_static.py`, `verify_snapshot.py` and `test_decode.mjs` each
  repeat the rule on their own and compare every code exactly. Measured: 203 history rows moved (the
  catalog's 9.995–10.003 km), code 1500 on 23,759 rows = `counts.depth10km` (the file before held
  23,962, so `test_decode.mjs`'s new assertion fails on it); the demo snapshot 2,890 rows at 10 km and 2
  moved (`verify_snapshot.py`); the worst depth decode error 0.009 km, a moved row. So the card says "At
  10 km, as the catalog lists it. USGS: “Ten kilometers is a "fixed depth." …”" and the section caption
  "N listed at 10 km"; the fixed-depth quote is now printed only where the catalog says 10.
- **Negative depths are USGS's words.** The FAQ "What does it mean that the earthquake occurred at a
  depth of 0 km? …" (its address is `…-how-can-earthquake-have-a-negative-depth`; the brief's, ending
  `…-negative-depth-sometimes`, answers 404) gives two sentences now in `credits/usgs-statements.txt`
  and `content/quotes.json`; the note reads "11 448 rows in the history have a negative depth. The map
  colors them as 0 km deep, and the cross-section plots them above its 0 km line." with "USGS: “A
  negative depth can sometimes be an artifact of the poor resolution for a shallow event. … When the
  earthquake depth is very shallow, it can be reported as a negative depth.”" The app's own sentence on
  how it draws them is kept, because the quote does not say it. The `Mww … — Mww …` header-as-quote line
  is gone from the statements.
- **A hollow ring is whole in 2D.** `drawDot` drew each hole as an anticlockwise arc from 0 to 7 rad,
  which is not a full turn, joined to the outer circle: every Canvas-2D hollow ring (the legend's key,
  the section plot, list and card icons) had a notch at 3 o'clock. Each hole is now its own full
  subpath. `shoot.mjs` samples an 80 px ring: alpha 255 at 0°, 5°, 10°, 20°, 30°, 45°, 90°, 180°, 270°
  and 355°, the hole 0; the old code gave 0 at 0° and 5° and 224 at 10° on the same samples.
- **Numbers in mono, carried through.** `nums()` now sets About's intro, reading, notes, "not shown" and
  data lines, the story text (card and list), the section caption, the event card's fault and volcano
  lines, the volcano card's elevation and notice, and the Live sheet's counts and volcano line. In prose
  a bare year, "Lower 48" and whatever USGS says between “ ” stay in Atkinson, and a digit fused to
  letters (3DEP, BT2, 2010s) is a name; `.mono` does not wrap, so a number never leaves its unit.
  ART.md's claim that Red Hat Mono's zero is plain was wrong: the shipped file's `zero` has three
  contours, its counter split by a slash, like Atkinson's (fontTools, 2026-09-30); ART now says so.
- **Units reach the legend.** The compact legend's stops follow SI | US ("0 · 22 · 186 mi"), as its
  label and the legend card's ramp line do, and the catalog's fixed depth keeps its round number: the
  section key and caption, and the card, say "10 km (6 mi)" in US units.
- **Labels follow the foot.** A sheet height change slides the foot for 240 ms; the overlay was placed
  in the frame the change began, against the old foot, so after Peek → Half city names sat ghosted
  under the credit line until the next pan. The foot's `transitionend` now asks for the overlay again.
  `shoot.mjs` counts label pixels under the scale bar, legend and credit line after Peek → Half: 0, 0, 0
  (with the listener removed: 945, 1 382, 959).
- **Escape takes back a pending A** (the keyboard's section, §24), before it would leave focus mode, and
  a section drawn by a drag ends a pending A too. Panels close first, as before.
- **The Live pen's nib** starts 2 px lower (9 px, below the label's baseline at 7.7 px), and under the
  count label's words it drops to the plot band's top (12 px), clear of the descenders (9.8 px).
  `shoot.mjs` compares the strip with and without the selection: the nib's first inked row 24 device
  px, the label's last 14 (before: both 14).
- **Focus by keys only** (§22): a pointer's entry or exit moves no focus and draws no ring; Enter or
  Space (or an activation with no pointer before it) moves focus to the ghost key and back, ringed.
- **Checked where it reads**: "This copy is only as new as its last refresh, shown on the Live sheet"
  appears in About's intro, About's notes and the Live sheet's body, where the stamp above it shows the
  feed's time; it reads correctly in all three.

What would change it: the phone. The basemap past the axis, the coarse zones at Alaska's top and the
Lower 48's bottom, and VoiceOver's landing after focus mode is entered by a double tap (an activation
iOS may report with or without a pointer before it) are owed to the device (NOTES.md).
