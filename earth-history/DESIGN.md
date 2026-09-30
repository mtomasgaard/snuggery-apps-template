# Earth's History — design

The design Earth's History is built from. It was written before any app code, from a one-page
brief ("Earth's history on a globe") and the pinned sources in `tools/RESEARCH.md`. Where the build changes a number, the number here is updated and `NOTES.md`
says what it was and why. The byte layout of every data file is in `tools/CONTRACT.md`; this file
says what the app does with them.

Every size and count below marked **measured** was measured on 2026-09-30 in `tools/` with
`.venv/bin/python` (Python 3.12.14, numpy 2.5.3, Pillow 12.3.0, h5py 3.16.0, pygplates 1.0.0) over the
pinned files in `tools/.cache/`, by throwaway scripts that write nothing into `data/`. The command and
what it printed are in §15 (`tools/DECISIONS.md`). Numbers marked *estimate* become measured when the pipeline writes the
file, and the pipeline asserts the cap next to each one.

This file ships inside the app's ZIP, as Snug Kart's `DESIGN.md` does (the template's ZIP workflow
excludes `tools/`, `screenshots/` and dotfiles, not root Markdown). It carries no URLs.

---

## 1. What it is

An offline globe and map of the Earth at 90 moments from 750 million years ago to today, one per
painted map in C. R. Scotese's PALEOMAP PaleoAtlas. A slider moves through them; the Earth can be
seen as its painted surface or through a climate model's temperature and rain; the pieces of
today's crust can be outlined with the direction and speed they were moving; today's coastlines and
~300 cities can be carried back to where they were; a card explains the period, and small curves
show carbon dioxide, sea level and the model's global temperature on the same time axis.

It is static: nothing refreshes, nothing is fetched from outside the app's own folder.

## 2. Ground rules

- **Snuggery's runtime** (the text Snuggery's Create tab gives an agent, `PromptBuilderService`
  and `RuntimeCapabilities`): one ZIP with `index.html` at the top or inside one wrapping folder;
  relative paths only, no `..`, no symlinks, no drive letters; ≤ 10,000 files, ≤ 512 MB in total,
  ≤ 128 MB per file, folders ≤ 16 deep, no encryption; **no network of any kind** and no
  `http(s)://` in any `.html`, `.css` or `.js` file; no JavaScript-to-native bridge; ES modules and
  `fetch()` of the app's own files work; `localStorage` persists, `sessionStorage` does not; must
  work on a phone screen in light and dark mode. It is tested served over HTTP, never from `file://`.
- **One reconstruction, said on screen.** Every map, polygon, rotation and elevation comes from
  Scotese's PALEOMAP model; the climate fields come from one climate model (HadCM3L) run on
  Scotese's geography. The app says "a reconstruction" and "a climate model" where it shows them.
- **One plate model.** Everything drawn over a Scotese map is rotated with Scotese's 2016 rotation
  file (`PALEOMAP_PlateModel.rot`). Geometry from any other plate model is never drawn on any lens.
  (`tools/CONTRACT.md` §0 states the rule; step 20's check enforces it.)
- **No number without a source.** Every value on screen comes from a pinned file or a cited
  formula; the source id travels with it into the sheet's sources line. Nothing is typed in from
  memory. Encyclopaedia text is never copied (no Wikipedia; its CC BY-SA would come with it).
- **Licenses.** Every source is CC BY 4.0 or public domain (`tools/RESEARCH.md` §2). The attribution
  each license asks for is in `CREDITS.txt` and in `data/about.json`, which the About panel renders.
  License URIs are printed as text, never as links.
- **Language.** User-facing text is English for a US audience, in US spelling, SI units by default (°C, m, km, mm; thousands grouped with a narrow no-break space), US units one tap away
  with metric one tap away. No text names any AI vendor or product.
- **Targets.** 390 × 844 CSS px portrait, DPR 2–3, iOS 18 WKWebView; ZIP about 7 MB (hard cap 8 MB,
  §10).

---

## 3. The screen at 390 × 844

```
┌──────────────────────────────────────┐  safe-area top inset
│ Earth's History              ⌕   ⓘ  │  top bar            44
├──────────────────────────────────────┤
│ [Globe|Map]          [Plates][Coasts]│
│                                      │
│               ╭──────╮               │
│             ╭╯ globe ╰╮              │  Earth panel      ~498 (flex)
│             ╰╮       ╭╯              │  (WebGL canvas + Canvas 2D overlay)
│               ╰──────╯               │
│ ▭▭▭ legend (climate lenses only)     │
│ (Surface)(Temperature)(Rain)         │
├──────────────────────────────────────┤
│ ■ 251 million years ago     ‹  ▶  › │  age row            48
│   Triassic · Lower Triassic · Induan │
├──────────────────────────────────────┤
│ |·|·|··≈·······|·····|·····●·····|  │  slider             58
│ ▔▔▔▔▔▔▔ period color strip ▔▔▔▔▔▔▔  │
│ 750       539         252     66 Now │
├──────────────────────────────────────┤
│ Temp  ~~~~~~~~~~~~~~~~~│~~~~~~~~~~~  │  curves strip       84
│ CO₂   ~~~~~~~~~~~~~~~~~│~~~~~~~~~~~  │
│ Sea   ~~~~~~~~~~~~~~~~~│~~~~~~~~~~~  │
├──────────────────────────────────────┤
│ ── (grip)                            │  bottom sheet, peek 112
│ Triassic · 251.9–201.4 million yrs   │
│ This map: Scotese map 49 …           │
└──────────────────────────────────────┘  safe-area bottom inset
```

The page is one CSS grid: `grid-template-rows: auto 1fr auto auto auto auto` over `100dvh`, with
`env(safe-area-inset-*)` padding and a 16 px side gutter. Only the Earth panel is flexible; the
rows under it have fixed heights so the slider never moves under a thumb. With the sheet at peek
the Earth panel is 844 − 44 − 48 − 58 − 84 − 112 = **498 px** tall (59 %) before safe-area insets.

### 3.1 Top bar (44 px)
"Earth's History" at 15 px semibold on the left. On the right two 44 × 44 icon buttons: **Find**
(magnifier) and **About** (ⓘ). Nothing else lives here.

### 3.2 The Earth panel
A `<canvas>` for WebGL2 (§5) with a second `<canvas>` for the Canvas 2D overlay (§6) stacked on it,
both filling the panel, and a few HTML controls floating over them.

- **Globe | Map**, top left: a two-segment control (radio group). Map is Mollweide, the projection
  Scotese's own atlases use. Switching carries the view center across: the globe's center longitude
  becomes the map's central meridian and back; latitude is kept by the globe, the map is always
  centered on the equator unless panned vertically when zoomed.
- **Plates** and **Coasts**, top right: two toggle buttons (`aria-pressed`). Plates draws the outlines
  of the pieces of today's crust that exist at this map's age and arrows for how they were moving
  (§7). Coasts ("Today's coasts" in its accessible name and legend) draws today's coastlines carried
  back with their plates. Defaults: Plates off, Coasts on.
- **Lens chips**, bottom: *Surface · Temperature · Rain*, a radio group of pill buttons, 32 px tall
  visually with a 44 px hit area. Surface is Scotese's painted map. Temperature and Rain color the
  Earth with the climate model's annual means over a dimmed Surface (§5.6).
- **Legend**, above the chips, only for Temperature and Rain: a 160 × 8 px color bar with 4–5 ticks
  in the current units and one line: "Annual mean air temperature 1.5 m (5 ft) above the ground ·
  climate model" or "Annual mean rain and snow · climate model". Tapping the legend switches US ↔
  metric units (the same setting as in About).
- **Notices** in the panel, one line each, centered above the chips when they apply:
  - on a climate lens at 600, 690 or 750 Ma: "The climate model starts at 540 million years ago —
    this map has no temperature or rain." (the Surface is drawn; the chip stays selected);
  - after a WebGL context loss: "Restoring the view…" (§5.9);
  - with Plates on: "Pieces of today's crust and how they moved · arrows: the million years before
    this map".
- **Tap readout** (§8): a card floating at the top of the panel, under the controls, at most 4 lines
  plus a close button; a pin marks the tapped spot.

Gestures: **drag** turns the globe (one CSS px at the center of the disc is 1/radius radians, as in
Global Weather) or slides the map's central meridian (horizontal, wrapping) and pans vertically
when zoomed; **pinch** zooms 1× to 3× (globe radius or map scale; the fit is 1×); a **tap** (up within
8 px and 300 ms of down) opens the readout. A fling keeps turning with friction (decay 0.92 per
16 ms frame, stops under 0.02 rad/s); under `prefers-reduced-motion` there is no fling.

Default view: globe, 1×, centered on 20° N and on the longitude the device's UTC offset implies
(15° per hour, Global Weather's rule) — nothing is asked of the device but the time.

### 3.3 Age row (48 px)
- A 14 × 14 px swatch in the **ICS color** of the period that contains the map's age.
- Line 1, 17 px semibold: the map's age as Scotese's Table 1 gives it — "Today" for map 1;
  "21,000 years ago" for map 2 (ages under 0.1 Ma are written in years, rounded to the thousand);
  otherwise "{age} million years ago" with the number exactly as in Table 1 (3.7, 35.6, 251,
  464.5).
- Line 2, 12 px, secondary ink: the ICS units that contain that age, "{Period} · {Epoch} · {Age}"
  (for map 49 at 251 Ma: "Triassic · Lower Triassic · Induan"), leaving out a rank ICS does not
  define there (the Tonian, Cryogenian and Ediacaran have no epochs or ages in the chart). Names come
  from `timescale.json`, never from Scotese's labels (§4.4). 21 epochs and ages in the pinned chart
  have no `skos:prefLabel` (e.g. `LowerTriassic`); their names are their identifiers split at the
  capitals ("Lower Triassic"), a rule in `CONTRACT.md` §9.
- On the right, three 40 × 44 buttons: **‹** (one map older), **▶/❚❚** (play/pause), **›** (one map
  newer).

### 3.4 Slider (58 px)
A custom `role="slider"` element (a native range input cannot draw a broken axis). The track is the
full content width (358 px at 390); under it a 6 px strip of ICS period colors; under that tick
labels at 10 px: "750", "539", "252", "66", "Now" (the ICS starts of the Paleozoic, Mesozoic and
Cenozoic, rounded, and today).

**The axis** runs from 750 Ma at the left to today at the right. It is linear from today back to
550 Ma over the right 85 % of the track; the 550–750 Ma stretch, which holds only three maps
(600, 690 and 750 Ma), is compressed into the left 15 %, behind a **break mark** (a white zigzag
across the track at the 550 Ma point). Map 88 (542 Ma by Table 1, 540 in its file name) is inside
the linear part. With `c = 0.15`, the position `x ∈ [0, 1]` of an age `a` (Ma) is

```
a ≤ 550:  x = c + (1 − c) · (1 − a / 550)
a > 550:  piecewise linear through the knots (750, 0), (690, c/3), (600, 2c/3), (550, c)
```

and the inverse is the same pieces solved for `a`. At 358 px the linear part (304 px) is 1.81 Myr per px,
so the 87 maps younger than 550 Ma sit about 3.5 px apart on average; the three deep maps are
about 18 px apart. Ticks: a 1 px mark per map above the track, 4 px tall (they read as a comb and
show where the maps are).

**Thumb:** a 22 px disc in the ICS color of the current map's period with a 2 px white ring.
Dragging (anywhere on the 44 px-tall hit area of the track, or on the curves strip below) moves the
thumb continuously with the finger and shows the **nearest map** by axis distance (§4.2); on release
the thumb snaps to that map's stop.

Keyboard and assistive tech: ← / → one map, PageUp / PageDown ten maps, Home the oldest (750 Ma),
End today. `aria-valuemin="0"`, `aria-valuemax="89"`, `aria-valuenow` the stop index,
`aria-valuetext` "251 million years ago, Triassic".

### 3.5 Curves strip (84 px)
Three rows of 28 px on the slider's x axis (same piecewise function, same left and right edges as
the track), each a sparkline 1.5 px wide with a faint band where the series has one:

| Row | Series (from `curves.json`) | Scale |
| --- | --- | --- |
| Temp | the climate model's global mean air temperature, 0–540 Ma | linear, °F or °C |
| CO₂ | Foster et al. 2017 LOESS, 0–419 Ma, with its 68 % band; 420–540 Ma the climate model's CO₂ input, dashed | log, ppm |
| Sea | van der Meer et al. 2022 sea level relative to today, 0–540 Ma, with its min–max band | linear, ft or m |

Each row prints its name and the value at the current map at the top left in 11 px ("Temp {t} °F",
"CO₂ {c} ppm", "Sea {±h} ft", filled from `curves.json`). A vertical line in the ink color marks the current map's age across
all three rows. The compressed 550–750 Ma stretch is drawn as a light hatch labeled once, "no curves
before 540 Ma". Dragging on the strip scrubs like the slider. The strip is a single 2D canvas drawn
only when the map, the units, the theme or the size changes.

### 3.6 Bottom sheet — three heights
Norne's sheet pattern: a grip at the top; tap the grip to cycle heights, drag it (44 px per step),
or ↑/↓ on the focused grip. The height is remembered.

| Height | Sheet (px) | What gives way | Earth panel at 844 |
| --- | --- | --- | --- |
| **Peek** (default) | 112 | nothing | 498 |
| **Half** | 380 | the curves strip hides (its three values are in the tiles) | 314 |
| **Full** | everything under the slider (694) | the Earth panel and the curves strip hide | 0 |

The age row and the slider never hide, so the sheet can be read while scrubbing and updates live.
Content, top to bottom:

1. **Period card.** Title row: the ICS color swatch, the period name, its range ("Triassic ·
   251.9–201.4 million years ago", ICS ages with ± where ICS gives an uncertainty, in the full
   view). Body: up to 90 words from `story.json`, and its source ids. For ages past 720 Ma the
   Tonian card; a short prologue card ("Before 750 million years ago") sits after it in Full.
2. **This map.** "Scotese map 49 · Permo-Triassic Boundary (251 Ma)" — Table 1's row text as
   Scotese wrote it — and, when the ICS chart puts the age elsewhere, one line computed by step 50
   (§4.4): "Scotese dates this boundary 251 Ma, on the 2008 timescale his atlas uses; today's chart
   puts it at 251.902 ± 0.024 Ma." or "By today's chart, 750 million years ago is in the Tonian."
   Then: "Overlays rotated to {rotation_ma} Ma · Climate: model run for {climate age} Ma ·
   Elevation: PaleoDEM for {DEM age} Ma" — each part only when present.
3. **Then vs now tiles**, a 2 × 2 grid plus one full-width tile:
   - *Temperature*: the model's global mean for this map's climate slice, and the difference from
     the model's own 0 Ma value ("{t} °F · {Δt} °F warmer than the model's today").
   - *CO₂*: ppm, and the multiple of the same series' 0 Ma value ("{c} ppm · {k} × this curve at
     0 Ma"); labeled "proxy fit" (Foster) or "climate model input" (older than 419.5 Ma).
   - *Sea level*: relative to today, with the min–max range ("{±h} ft ({±h} m) · range {lo}–{hi} m").
   - *Land*: percent of the surface above sea level in the PaleoDEM for this slice, and shallow sea
     (0–200 m deep) as a second line, each against the same model's 0 Ma value.
   - *The Sun* (full width): "The Sun shone at 97.9 % of today's brightness" (map 49, 251 Ma) from
     Gough (1981), §4.5.
   A tile with no value for this map (older than 540 Ma) says "No data this far back" rather than
   disappearing, so the grid does not jump.
4. **Around this time** — events from `story.json` whose age is within ±5 Myr of the map's age,
   oldest first: title, age ("251.9 million years ago"), up to 45 words, source ids.
5. **Look for** — bullets from `story.json` whose time window contains the map's age. Tapping one
   turns the Earth to its anchor, drops a labeled pin (the anchor rides its plate, §7) and brings
   the sheet down to Peek so the pin is visible.
6. **Sources** — the ids used in this sheet expanded to short citations (author, year, title,
   license), from `story.json.sources` and `about.json`. Plain text; license URIs as text.

### 3.7 Find
The magnifier opens a full-height overlay: a search field (autofocus, `enterkeyhint="search"`) and a
result list of up to 8 rows. Matching is prefix-then-substring on the place name, its ASCII name
and its country, case- and accent-insensitive, ranked by Natural Earth's `scalerank`. Each row:
"Chicago · United States of America" and "now 41.8° N 87.7° W". Choosing one closes the overlay,
turns the Earth to the city's position at this map (400 ms, instant under reduced motion), drops a
pin labeled with its name and opens the readout for it (§8). The pin **rides its plate** as the
slider moves and is remembered across launches. If the city's crust is not carried back to this age
by the model (§7.2) the pin hides and the readout says so. Cancel, Escape or a tap outside closes Find.

### 3.8 About
A full-height scrollable panel, from `data/about.json`: how to read the app, what is a painting,
what is a model, what is a measurement-based fit, what is not shown and why, then every source with
owner, license, adaptations and retrieval date, then a Units setting (US / Metric) and the app
version. The honesty points it must make (text written by the pipeline's `90_about.py`, checked
against its sources):

- The maps are **one reconstruction among several**: Scotese's PALEOMAP atlas (2016). Other plate
  models put the continents hundreds to thousands of kilometers elsewhere, especially before about
  200 Ma.
- The elevation behind the land and shallow-sea figures and the readout is Scotese & Wright's
  PaleoDEMs, which their report calls a "first draft" (report p. 7).
- Latitude is better constrained than longitude for old maps. Pinned by the text stage: van
  Hinsbergen et al. 2015, PLOS ONE 10, e0126946 (CC BY), "Paleomagnetic data, however, do not
  constrain paleolongitude" (E14).
- Temperature and rain are **a climate model**, not measurements: HadCM3L annual means, one run per
  5 million years, forced with a CO₂ history; the curves' temperature is that model's global mean.
- CO₂ before 420 Ma is the climate model's input, not a proxy fit. The band shown is Foster's 68 %
  band; his 95 % band's lower edge goes below zero from 247 to 419.5 Ma, which is why it is not drawn.
- Ages are Scotese's, on the 2008 timescale his atlas uses; the names and colors are today's ICS
  chart, so a few maps sit on the other side of a boundary from their own label.
- Arrows and readout speeds are the rotation model's motion over one million years; cross-fades
  between maps are a display effect, not a morph — the app shows only the 90 maps.
- Colors on the Temperature and Rain lenses, the globe's shading and its glow are display choices.

### 3.9 Wide screens
At a viewport width ≥ 700 px the grid becomes two columns: the Earth panel on the left
(full height), and on the right a 360 px column with the age row, slider, curves and the sheet
(always at Full inside the column; the grip hides). Nothing else changes.

---

## 4. The time model

### 4.1 Stops
**90 stops, one per map in the zip** (`tools/slices.csv`; Table 1 rows 20, 89 and 91 have no raster
and are not stops). Stop index 0 is today (map 1) and index 89 is 750 Ma (map 93): the manifest's
slice order, ascending age. The slider draws them left = old, right = new.

Every map has two ages (`tools/RESEARCH.md` §1): `age_ma` from Table 1, which the app **shows**, and
`rotation_ma`, the time the overlays are **rotated to** (the file-name age, the time Scotese's own
GPlates workflow pairs with the raster; step 20 confirms it by overlap, §13). They differ by at most
4.0 Myr (map 79).

### 4.2 An age between maps
The app never invents an Earth between two maps: no morphing, no interpolated climate. While a finger
drags, the thumb follows the finger; the map shown is the stop nearest the finger on the axis, and
the age row, the curves' line, the tiles and the overlays all switch to **that map's** age. On release
the thumb snaps to the stop. The only thing that is ever "between" is the 200 ms cross-fade (§5.5),
which About names as a display effect.

### 4.3 Play and step
- **▶** plays toward today at **1.5 maps per second** (one stop every 667 ms: a 200 ms cross-fade,
  then a hold). At today it stops; pressing ▶ at today restarts from 750 Ma. Any touch on the slider,
  ‹ or › pauses. While playing, the next two maps are prefetched; if the next full map is not ready
  on time, the proxy is shown and the full map fades in when ready (§5.7). Under reduced motion the
  cross-fade is 0 ms and the rate is the same.
- **‹ / ›** step one map older / newer, with the same 200 ms cross-fade.
- The age row's text is an `aria-live="polite"` region updated only when the slider settles (release,
  a step, or pause), never on every stop of a scrub or of play.

### 4.4 Names and colors: ICS, with Scotese's labels kept as his
The age row, the swatch, the slider strip and the period card come from the ICS chart data
(`timescale.json`) for `age_ma`. A unit contains an age `a` when `end < a ≤ begin`, and `a = 0` belongs
to the units whose end is 0, so a boundary age belongs to the younger unit (66.0 Ma is Paleogene).
The "This map" line quotes Table 1 unchanged. Step 50 computes, for every map, whether the ICS period
differs from the period(s) named in Scotese's label, and for boundary maps both boundary ages; the
result is a field in the manifest (`CONTRACT.md` §1), printed in full by `verify_timescale.py`. From
the chart as pinned, this already includes at least maps 16 (65.5 Ma, Paleogene by ICS's 66.0),
32 (145.5 Ma, still Jurassic by ICS's 143.1 ± 0.6), 43 (199.6, Jurassic by 201.4), 49 (251,
Triassic by 251.902), 65 (359.2, Devonian by 358.86), 73 (419.5, Devonian by 419.62), 83 (488.3,
Cambrian by 486.85), 88 (542, Ediacaran by 538.8) and 93 (750, Tonian by 720). Step 50 computed the
full list: those nine plus map 14 (55.8 Ma, Scotese's Paleocene/Eocene boundary; the chart's Eocene
begins at 56.00) and map 61 (323.2 Ma, "Late Mississippian"; Pennsylvanian by the chart's
323.4 ± 0.4) — 11 notes, printed by `verify_timescale.py`.

### 4.5 The Sun
Computed in the app, not stored: Gough (1981), Solar Physics 74, eq. (1) p. 28, with t☉ = 4.7 Gyr
(p. 23) and `t = t☉ − age`:

```
L(age) / L☉ = 1 / (1 + (2/5) · (1 − t/t☉)) = 1 / (1 + 0.4 · age_Myr / 4700)
```

750 Ma → 94.0 %, 540 Ma → 95.6 %, 251 Ma → 97.9 %, today → 100 %. Shown to one decimal.

### 4.6 State kept between launches (`localStorage`, every access in try/catch)
Keys prefixed `eh.`: `stop`, `view` (globe/map), `globe` ({lon, lat, zoom}), `map` ({lon0, panY,
zoom}), `lens`, `plates`, `coasts`, `units`, `sheet`, `pin` ({kind: city|tap, id or lon/lat, plate}).
A broken or missing value falls back to the default; nothing else is stored.

---

## 5. Rendering: plain WebGL2, one triangle

No library. Norne Reservoir's pattern (`getContext('webgl2')`, a small `program()` helper that
compiles, links and collects uniform locations, a dirty-flag scheduler) without its geometry: the
whole Earth is one full-screen triangle whose fragment shader inverts the projection per pixel.
Globe and map are the same shader with a uniform switch, sharp at the canvas's own resolution.

### 5.1 Context and canvas
`canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false,
premultipliedAlpha: false, preserveDrawingBuffer: false })`. No WebGL2 → the panel shows "This view
needs WebGL 2, which this device does not offer." and the rest of the app still works.
Canvas size = panel CSS size × `min(devicePixelRatio, 2)`, set in a `ResizeObserver`; the overlay
canvas uses the same factor. The disc and ellipse edges are anti-aliased in the shader (1 device px
`smoothstep`), so MSAA is off.

### 5.2 The triangle
Vertex shader without buffers (an empty VAO, `drawArrays(TRIANGLES, 0, 3)`):
`gl_Position = vec4(vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2.0 - 1.0, 0.0, 1.0)`.

### 5.3 Inverse projections (fragment shader)
`p = (gl_FragCoord.xy − uCenter) / uScale`, y up, in units of the globe radius (globe) or of the
Mollweide scale (map). `(λ0, φ0)` is the view center in radians.

**Orthographic globe.** With `r² = p·p` and `z = sqrt(max(0, 1 − r²))`:

```
φ = asin( clamp( z·sin φ0 + p.y·cos φ0, −1, 1 ) )
λ = λ0 + atan( p.x, z·cos φ0 − p.y·sin φ0 )          // GLSL atan(y, x)
inside when r² ≤ 1;   coverage = clamp((1 − sqrt(r²)) · uScale + 0.5, 0, 1)
```

**Mollweide map** (unit sphere; the ellipse is 4√2 wide and 2√2 tall in these units). With
`q = (p.x, p.y + uPanY)`:

```
θ = asin( clamp(q.y / √2, −1, 1) )
φ = asin( clamp( (2θ + sin 2θ) / π, −1, 1 ) )
λ = λ0 + π · q.x / (2√2 · max(cos θ, 1e−6))
inside when (q.x / 2√2)² + (q.y / √2)² ≤ 1           // equivalent to |λ − λ0| ≤ π, |q.y| ≤ √2
coverage = 1 px smoothstep on that implicit function, using fwidth()
```

Fit: globe radius = 0.46 × min(panel width, panel height − 72); map scale so the ellipse is 92 % of
the panel width or fits the height, whichever is smaller. Zoom multiplies either by 1–3.

### 5.4 Texture coordinates and the seam
Every surface texture is equirectangular with column 0 at 180° W and row 0 at 90° N (uploaded
without `UNPACK_FLIP_Y`, so the image's top row is v = 0):

```
u = λ / 2π + 0.5        v = 0.5 − φ / π
```

`u` wraps at the antimeridian, and a mipmapped texture sampled with implicit derivatives shows a
one-pixel seam there (the derivative of `fract(u)` jumps). The fix, computed in **uniform control
flow** — every fragment, inside or outside the disc, before any branch or `discard` — so the
derivatives are valid:

```glsl
float u1 = fract(u);
float u2 = fract(u + 0.5) - 0.5;
float dux = abs(dFdx(u1)) < abs(dFdx(u2)) ? dFdx(u1) : dFdx(u2);
float duy = abs(dFdy(u1)) < abs(dFdy(u2)) ? dFdy(u1) : dFdy(u2);
vec2 gx = vec2(dux, dFdx(v)), gy = vec2(duy, dFdy(v));
vec3 surf = textureGrad(uTexA, vec2(u1, v), gx, gy).rgb;
```

Full maps: `RGBA8`, `LINEAR_MIPMAP_LINEAR` / `LINEAR`, `generateMipmap`, wrap S `REPEAT`, wrap T
`CLAMP_TO_EDGE` (1024 × 512 is power-of-two).

### 5.5 Blending two maps
Two sampling slots, A (the map being left) and B (the map arriving), each either a full texture or
a proxy cell (§5.7), and `uMix` from 0 to 1 over **200 ms** (ease-in-out). The result is
`mix(sample(A), sample(B), uMix)`. When `uMix` reaches 1, B becomes A and the loop stops. A change
arriving mid-blend starts a new blend from the current mix frozen into A (the previous A is dropped).

### 5.6 Climate lenses
One `R8` texture 96 × 73 (`UNPACK_ALIGNMENT 1`), holding the current slice's bytes for the chosen
field straight from `climate.bin` — no decode on the CPU. `LINEAR` filtering, no mipmaps, wrap S
`REPEAT`, wrap T `CLAMP_TO_EDGE`. The grid's values are at nodes (0°E, 3.75°E, … ; 90°N, 87.5°N, …),
so a node sits at a texel center:

```
uc = λ_deg / 360 + 0.5 / 96                   (λ_deg in [0, 360); REPEAT does the wrap)
vc = ((90 − φ_deg) / 2.5 + 0.5) / 73
b  = texture(uClim, vec2(uc, vc)).r * 255.0     // a fractional byte, interpolated
lens = texture(uLut, vec2((b + 0.5) / 256.0, 0.5))
```

`uLut` is a 256 × 1 `RGBA8` table built in JS for the lens and the theme-independent ramp: entry `k`
is the ramp's color at the value the byte `k` decodes to (`CONTRACT.md` §6), entry 255 transparent.
Interpolating bytes is interpolating values for temperature and the square root of the value for
rain — acceptable for color, and the tapped number is decoded from the four nodes exactly (§8). No
cell holds 255 (asserted by step 30), and a map without a climate slice gets no climate texture at
all (the notice in §3.2).

Over a dimmed Surface: `base = mix(surf, vec3(dot(surf, vec3(0.299, 0.587, 0.114))), 0.6) * 0.55`,
`colour = mix(base, lens.rgb, 0.72 * lens.a)`, so relief still reads through.

Ramps (display choices, drawn in the legend; not copied from any published palette):
- Temperature, °C value → color: −50 `#2b3a8f`, −30 `#3f6fb5`, −15 `#7fb0d8`, 0 `#eef0f0`,
  10 `#f5d08a`, 20 `#ec9a4c`, 30 `#d4552b`, 40 `#8f1d1d` (clamped outside). The white point at 0 °C
  is freezing, which is why the ramp is diverging there.
- Rain, mm/day → color: 0 `#f4efe4`, 0.5 `#d9e6c3`, 1 `#a8d2b0`, 2 `#6fb8b0`, 4 `#3f93b5`,
  8 `#2c63a3`, 16 `#28347a`.

### 5.7 While scrubbing: the proxy sheet
`surface/proxy.webp` holds all 90 maps at 256 × 128 in a 10 × 9 grid (2560 × 1152), uploaded once at
startup, `LINEAR`, no mipmaps, `CLAMP_TO_EDGE`. While a finger is on the slider or the curves, a stop
change shows the new stop's proxy cell at once (no network, no decode) unless its full texture is
already cached. Sampling clamps inside the cell by half a texel so neighbors never bleed:

```
cell = vec2(i % 10, i / 10);  h = 0.5 / vec2(256.0, 128.0)
uvp  = (cell + vec2(clamp(u1, h.x, 1.0 - h.x), clamp(v, h.y, 1.0 - h.y))) / vec2(10.0, 9.0)
```

(so a hairline at the antimeridian is possible on a proxy; it lasts only while scrubbing). When the
finger lifts, or rests for 150 ms, the full map is loaded and cross-faded in over 200 ms.

### 5.8 Loading and the cache
A full map is fetched as a blob and decoded with `createImageBitmap(blob, { imageOrientation:
'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })` (falling back to an `Image` and
`await img.decode()` where that throws), uploaded, mipmapped, and the bitmap closed. At most one
decode runs, one waits; a request for a stop that is no longer wanted is dropped before upload.
**Cache: 8 full-map textures, least recently used out** (`gl.deleteTexture`). After the view
settles the neighbors ±1 are prefetched; while playing, the next two in the play direction.

### 5.9 Shading, glow, background
Globe only, display effects: screen-space normal `n = (p.x, p.y, z)`, light
`L = normalize(−0.45, 0.55, 0.70)`, `shade = (0.80 + 0.20·max(dot(n, L), 0)) · (0.88 + 0.12·z)`.
Outside the disc a glow `0.55 · exp(−(sqrt(r²) − 1) / 0.035)` in `#9cc7ff`, over the panel's
background color (a theme token: the "space" color, §9). The map's ellipse gets a 1 px edge in
the overlay instead of a glow.

### 5.10 Context loss
`webglcontextlost`: `preventDefault()`, stop the scheduler, forget every GL object (the cache
becomes empty), show "Restoring the view…". `webglcontextrestored`: rebuild the program, the empty
VAO, the proxy sheet, the LUTs, the climate texture and the current map, then redraw. `tools/shoot.mjs`
forces this with `WEBGL_lose_context` and fails on any console error.

### 5.11 Redraw only on change
A `requestRender()` that schedules one `requestAnimationFrame` if none is pending; dirty flags
(`earth`, `overlay`, `curves`, `sheet`) decide what that frame does. Only a blend, a fling, a
turn-to animation or play keep scheduling frames; when all are idle nothing runs. A frame where
only the overlay changed does not redraw the WebGL canvas, and vice versa.

---

## 6. The Canvas 2D overlay

Drawn in CSS pixels on a canvas scaled by the same DPR factor. It uses the **same projection
formulas in JS** as the shader, forward:

**Orthographic** (unit vector `(x, y, z)` of a point, view rotation built from `(λ0, φ0)`):

```
X = cos φ · sin(λ − λ0)
Y = cos φ0 · sin φ − sin φ0 · cos φ · cos(λ − λ0)
Z = sin φ0 · sin φ + cos φ0 · cos φ · cos(λ − λ0)      // visible when Z ≥ 0
screen = center + radius · (X, −Y)
```

Computed as a 3 × 3 matrix times each point's cached unit vector (9 multiplies, no trig per frame).
Inverse (for a tap), as Global Weather has it:
`φ = asin(Z sin φ0 + Y cos φ0)`, `λ = λ0 + atan2(X, Z cos φ0 − Y sin φ0)` with `Z = sqrt(1 − X² − Y²)`.

**Mollweide** forward: solve `2θ + sin 2θ = π sin φ` by Newton,
`θ ← θ − (2θ + sin 2θ − π sin φ) / (2 + 2 cos 2θ)` from `θ = φ`, stopping at |Δθ| < 1e−9 or 10
steps, with `θ = ±π/2` when |φ| > π/2 − 1e−9; then `x = (2√2/π)·Δλ·cos θ`, `y = √2·sin θ`, where
`Δλ = λ − λ0` wrapped into (−π, π]. θ depends only on latitude, so it is cached per vertex when the
map (and so the rotated geometry) changes; panning the map changes only `Δλ`. Inverse (for a tap):
the shader's formulas in §5.3.

**Clipping.** On the globe a polyline is cut where it crosses the horizon: between a visible and a
hidden vertex the crossing is found on the great circle (interpolate the two view-space vectors to
Z = 0 and normalize) and the path ends or starts there. On the map a segment whose `Δλ` jumps by more
than π between two vertices is broken there. **Decimation:** a vertex closer than 0.75 CSS px to the
last one emitted is skipped (the last vertex of each line is always drawn), which bounds the stroke
cost by the screen, not by the data.

**Draw order and style** (fixed colors: the overlay sits on the maps, which do not change with the
theme):
1. Today's coasts: 1 px `rgba(255,255,255,0.8)` over a 2.5 px `rgba(0,0,0,0.45)` halo.
2. Plate outlines: 1.25 px `#ffc247` over a 3 px `rgba(0,0,0,0.5)` halo.
3. Motion arrows (§7.3): white shaft and head, 1.5 px, dark halo.
4. Pins: a 10 px circle, white ring, filled `#e8483b` for a tap or city, `#ffc247` for a Look-for.
5. Pin labels: 12 px semibold white with a 3 px dark halo (`strokeText` then `fillText`), placed
   right of the pin, flipped left near the edge.
6. The map ellipse's 1 px edge (map view only), `rgba(255,255,255,0.35)`.

No generic city labels are drawn (they would clutter a painted map and imply today's geography).

---

## 7. The plates model

### 7.1 Present-day geometry, rotated in the app
Everything the overlay carries is stored at its **present-day** position with a **plate index**, and
rotated in the app to the map's `rotation_ma` with that plate's rotation from the shipped table:
the 471 features of `PALEOMAP_PlatePolygons.gpml` (503 polygon rings; its 2 polylines, on plates 201 and 714, are not areas and are left out), today's coastlines (2,121
pieces after splitting at plate edges, 61,800 vertices, 151 plates — **measured**), ~300 cities
and the story's Look-for anchors. Plate ids come from partitioning at 0 Ma with the polygons valid at
0 Ma (453 features) — Scotese's own "cookie cutter" instruction in the atlas PDF, p. 14.

Rotations are **unit quaternions** `q = (w, x, y, z)`, `w ≥ 0`, stored as int16 (`CONTRACT.md` §3),
renormalized on load; a point `p` (unit vector, x → 0° N 0° E, y → 0° N 90° E, z → north pole)
rotates as

```
t  = 2 · (v × p)          with v = (x, y, z)
p' = p + w · t + v × t
```

For each map, on the stop change: every vertex's rotated unit vector is computed once into a
`Float32Array` (and its Mollweide θ), then projected per frame (§6). Plate index 0 is plate id 0,
the identity.

### 7.2 What exists at an age
- A **polygon ring** is drawn at `rotation_ma = T` when `end ≤ T ≤ begin` for its feature's valid
  time — the same test as pygplates' `is_valid_at_time`, which `verify_plates.py` reproduces for all
  90 times. Measured on the pinned file: 196 features (227 rings, **62.6 %** of the sphere, e.g. the
  Pacific plate's big ring) have valid time exactly 0–0: they are today's ocean floor, which this model
  does not carry back, so no outline is drawn there before today. 17 features are valid only from the
  distant past to 600 Ma (Precambrian blocks); they appear only on the 690 and 750 Ma maps.
- A **present-day point or coast piece** is drawn at `T` only when `T ≤ begin` of the polygon it
  was partitioned into ("this crust is carried back to {begin} Ma in this model"). So Honolulu (partitioned
  onto plate 901, valid time 0–0, checked with `PlatePartitioner.partition_point`) has no position
  on any past map, and its readout says so rather than guessing.

The overlay's wording is fixed: **"Pieces of today's crust and how they moved"**. The app never
calls an outline a plate boundary, and never names a plate (the rotation file's comments are codes
such as "NAM-NWA"; no sourced names ship). The readout gives the plate id only in its small print
("PALEOMAP plate 701").

### 7.3 Arrows: motion over the million years before the map
Each ring carries a present-day interior point (pygplates' `get_interior_centroid`, stored as its
anchor). At `T` the anchor is at `a = R(T)·p0` and one million years earlier at
`b = R(T + 1)·p0`, with both rotations shipped per plate per map (`CONTRACT.md` §3). The arrow
points from `b` to `a` (motion forward in time), and its speed is

```
speed (cm/yr) = angle(a, b) [rad] · 6371 km / 1 Myr · 0.1        (1 km/Myr = 0.1 cm/yr)
```

The second sample is **T + 1 Ma, not T − 1**: at 0 Ma, T − 1 would reach into the rotation file's
"future" rows (e.g. plate 101's `-100.0` and `-250.0` Ma poles), which are not a reconstruction.
Arrows are drawn for rings valid at `T` with area ≥ 1,000,000 km² (78 of the 503 at some age), at
most one per 24 CSS px (larger rings first); length `6 + 2.4 · speed` CSS px, capped at 36 px (15 cm/yr and faster draw the same
length — the readout gives the number). Measured over the rotation file at the 90 rotation times,
for plates with a valid polygon: median of the rigid-rotation speed bound (at 90° from the
rotation pole) 5.1 cm/yr, 99th percentile 17.8, maximum 154.5 cm/yr (plate 306 at 6 and 10 Ma) —
an upper bound per plate, not a speed at a point; `verify_plates.py` prints the real anchor speeds
and lists every one above 20 cm/yr.

### 7.4 Tap: "where is this rock today"
Tap at `(λ, φ)` on the map for `T`: for each ring valid at `T`, rotate the tapped unit vector back by
the inverse of its plate's rotation (`q*`) and test it against the ring's present-day polygon by the
spherical winding number (sum of the signed angles subtended at the point by successive edges;
|sum| > π means inside). If several rings contain it (rotated rings can overlap after collisions),
the smallest ring wins (area stored per ring). The present-day position is that back-rotated point.
Cost: at most the 503 rings' 25,881 vertices, only on a tap.

---

## 8. The tap readout and Find

The card (§3.2), US units shown; metric swaps every number. Layout only — every `{…}` is filled
from the data files, nothing is typed in:

```
Here, 251 million years ago                                                  ✕
{lat}° S {lon}° E · {elevation class}¹ · {t} °F, {r} in of rain a year²
This crust is now at {lat}° S {lon}° E, {d} mi from {city}. It was moving {v} in ({v} cm) a year toward the {compass point}.³
¹ PaleoDEM, {DEM age} Ma  ² climate model, {climate age} Ma  ³ PALEOMAP plate {id}
```

- **Where then:** the tapped latitude and longitude on this map, to whole degrees.
- **What was there:** the elevation class of the nearest node of `elevation.bin` for this map's
  PaleoDEM slice (Scotese's Table 2 classes, §CONTRACT 7), named by depth or height, not by
  environment; then the climate model's annual temperature and rain, bilinear over the four
  surrounding nodes, decoded from the bytes. Each part only when the map has that slice.
- **Where now:** §7.4. The nearest of the ~300 cities by great-circle distance names the place
  ("12 mi from Cape Town"); beyond 1,000 km it says "far from any city on the list" and gives only
  coordinates. Motion: speed and the compass point of the velocity projected on local east/north.
- **No crust:** when no ring contains the point: "No piece of today's crust sits here in this
  reconstruction." The first two lines still show.

**Find** (§3.7) searches `places.json`: ~300 cities chosen deterministically from Natural Earth's
1:50m populated places (§CONTRACT 5). A chosen city's pin shows the same card, headed with its name:
"Chicago, then: {lat} {lon} · …", or, when its crust is not carried back this far, e.g. Reykjavik
(partitioned onto plate 102, whose polygon begins at 15 Ma): "Reykjavik's crust is carried back only
to 15 million years ago in this model." The pin rides its plate: every stop
change re-rotates it with the rest of the geometry.

---

## 9. Accessibility and both themes

- **Chrome follows the theme; the maps never do.** Color tokens on `:root`, redefined under
  `@media (prefers-color-scheme: dark)`. The WebGL surface, the lens ramps, the overlay colors and
  the ICS colors are the same in both. Tokens:

  | Token | Light | Dark |
  | --- | --- | --- |
  | `--bg` | `#f6f5f1` | `#111418` |
  | `--panel` (sheet, cards) | `#ffffff` | `#1a1e24` |
  | `--ink` | `#1d2126` | `#e8eaed` |
  | `--ink-2` (secondary) | `#5a6270` | `#a3abb7` |
  | `--line` | `#d9dce1` | `#2c323b` |
  | `--accent` | `#2f6fdf` | `#7aa7ff` |
  | `--space` (behind the globe) | `#dfe5ec` | `#05070a` |

  Text contrast ≥ 4.5 : 1 on its background in both themes (`--ink-2` on `--panel` included);
  the check is part of `shoot.mjs`'s screenshots read by eye and of the review.
- **Type:** the system font stack (`-apple-system, system-ui, sans-serif`), compact: 15 px body,
  12–13 px labels, 17 px for the age; no web fonts ship.
- **Targets:** every control has a hit area of at least 44 × 44 CSS px.
- **Screen readers:** the Earth canvas is `role="img"` with an `aria-label` rebuilt on settle:
  "Globe of the Earth 251 million years ago, Surface lens, centered on 20° N, 30° E, today's coasts
  shown". The readout card, the sheet and Find are ordinary DOM text. The slider is described in §3.4.
- **Keyboard:** Tab order top bar → view control → toggles → lens chips → age buttons → slider →
  sheet grip → sheet content; arrow keys on the focused Earth turn it 10°; `+`/`−` zoom.
- **Reduced motion:** no fling, turn-to jumps, 0 ms cross-fade.
- **Color:** the temperature ramp is blue ↔ red with a pale center and the rain ramp one hue family
  in lightness steps, both readable without red–green discrimination; values are always also given
  as numbers (legend ticks, readout).
- **No value reaches `innerHTML`**: text from the data files is set with `textContent` (Global
  Weather's rule).

---

## 10. Performance budgets and what to measure

**Bytes** (per file, raw; the ZIP deflates the non-WebP files further):

| Files | Size | Status | Cap asserted by the pipeline |
| --- | --: | --- | --: |
| `surface/m*.webp` × 90 (1024 × 512, q65) | 4,747,276 | measured (21,078–94,800 each) | 5,000,000 total, 110,000 each |
| `surface/proxy.webp` (2560 × 1152, q70) | 435,250 | measured | 480,000 |
| `climate.bin` | 1,527,744 | exact by layout; deflates to 780,559 (measured) | exact |
| `elevation.bin` | 1,785,420 | exact by layout; ≈ 182,000 deflated (measured on a 91 × 181 variant) | exact |
| `plates.bin` | 463,644 | measured (step 20) | 520,000 |
| `coast.bin` | 276,896 | measured (step 20) | 300,000 |
| `manifest.json` | ≈ 45,000 | estimate | 60,000 |
| `curves.json` | ≈ 50,000 | estimate | 80,000 |
| `timescale.json` | ≈ 25,000 | estimate | 40,000 |
| `story.json` | 41,667 | measured (step 60) | 60,000 |
| `places.json` | 35,615 | measured (step 20) | 40,000 |
| `about.json` | 21,348 | measured (step 90) | 40,000 |
| `plates.json`, `coast.json`, `climate.json`, `elevation.json` | ≈ 40,000 together | estimate | 10,000 / 4,000 / 30,000 / 20,000 |
| `CREDITS.txt` | 24,058 | measured (step 90) | 40,000 |
| app code (`index.html`, `style.css`, `js/*.js`) | ≈ 150,000 | estimate | 250,000 |

**ZIP ≈ 7.0 MB** by the sum of the measured and estimated deflated sizes; `tools/check.mjs` builds
it exactly as the template's workflow does and fails above **8,000,000 bytes**. For comparison,
1536 × 768 maps measured 9,914,936 bytes for the 90, which is why the maps are 1024 wide (the plan's
call, confirmed).

**Memory** (budgets; the phone numbers are measured on the device, never inferred from the simulator):
- GPU textures: 8 cached maps × 2.67 MiB (1024 × 512 RGBA8 with mipmaps) = 21.3 MiB; the proxy sheet
  11.25 MiB; climate and LUT textures < 0.1 MiB. **≈ 33 MiB.**
- JS heap: rotated geometry (≈ 88,474 vertices × (3 + 1) float32) ≈ 1.4 MB; `climate.bin` and
  `elevation.bin` kept as `Uint8Array`s, 3.3 MB (loaded on first use of a climate lens and first tap);
  JSON < 1 MB. Target < 25 MB for the app's own data.

**Time** (targets on an iPhone 16-class phone; measured on a phone, never in a desktop browser):
- First paint (proxy of the saved stop, then its full map) < 1.5 s from launch.
- A drag frame: ≤ 4 ms GPU for the one triangle at ≤ 780 × 1,000 device px; ≤ 8 ms JS for the
  overlay with Plates and Coasts both on (≈ 88,474 vertices projected, fewer stroked after decimation).
- A stop change: rotating the geometry ≤ 3 ms; decode + upload of a full map off the gesture path.
- Scrubbing the full slider shows a map for every stop with no blank frame (proxies).
- Play holds 1.5 maps/s for the whole 750 Ma → today run.

**How it is measured:** `window.__eh.perf()` (inert unless called) returns the last 120 frame times
split GPU-submit / overlay / total and the cache state; `tools/shoot.mjs` prints it after a scripted
scrub (trend only — headless SwiftShader numbers are not evidence of phone performance). On the phone,
five taps on the version line in About toggle a small frame-time readout for that check.

---

## 11. File layout

```
earth-history/
  index.html              the whole page; <script type="module" src="js/app.js">
  style.css               tokens, both themes, the grid, the sheet, the controls
  miniapp.json            {schemaVersion 1, name "Earth's History", entryPoint "index.html", description, version "1.0"}
  js/
    app.js                boot, state, the scheduler, persistence, wiring
    data.js               loading and validating every data file against the contract; .bin decoders
    earth.js              WebGL2: program, textures, the cache, uniforms, draw, context loss
    shader.js             the GLSL source strings
    proj.js               forward/inverse orthographic and Mollweide; the view state; gestures
    plates.js             quaternions, rotating geometry per map, validity, arrows, tap lookup
    overlay.js            the Canvas 2D layer: coasts, outlines, arrows, pins, labels
    timeline.js           the axis function, the slider, the age row, play and step
    curves.js             the curves strip
    sheet.js              the bottom sheet and its content
    find.js               city search
    about.js              the About panel
    lut.js                the lens ramps and LUT building
    units.js              US / metric conversions and number formatting
    util.js               small helpers; the localStorage wrapper
  data/                   written by tools/ only — see tools/CONTRACT.md
    manifest.json  surface/m01.webp … m93.webp  surface/proxy.webp
    plates.bin plates.json  coast.bin coast.json  places.json
    climate.bin climate.json  elevation.bin elevation.json
    curves.json  timescale.json  story.json  about.json
  CREDITS.txt             written by tools/90_about.py
  NOTES.md                running it, the code map, the data table, the honesty caveats, decisions
  DESIGN.md               this file
  screenshots/app.png     780 × 1688 (excluded from the ZIP)
  tools/                  excluded from the ZIP
    RESEARCH.md CONTRACT.md sources.py common.py paths.py probe.py make_slices.py slices.csv
    requirements.txt build_all.sh
    10_surface.py 20_plates.py 30_climate.py 35_elevation.py 40_curves.py 50_timescale.py
    60_story.py 80_manifest.py 90_about.py
    verify_surface.py verify_plates.py verify_climate.py verify_elevation.py verify_curves.py
    verify_timescale.py verify_story.py verify_data.py
    content/story.yaml    the hand-written text (§CONTRACT 10)
    credits/              license evidence (kept) and credits/fragments/<step>.json (written)
    check.mjs shoot.mjs test_proj.mjs test_plates.mjs
    .cache/ work/ .venv/  gitignored
```

The `data/` names are fixed by the contract; `verify_data.py` fails on any file in `data/` no step
claims. `tools/` is excluded from the ZIP by the template's workflow, so the pipeline, the research
and the contract never reach a phone.

---

## 12. Pipeline (summary; `tools/CONTRACT.md` has every layout)

`tools/build_all.sh` runs, with `tools/.venv/bin/python`, from `tools/`:

| Step | Reads | Writes |
| --- | --- | --- |
| `10_surface.py` | the atlas zip's 90 JPEGs, `slices.csv` | `surface/m*.webp`, `surface/proxy.webp`, `work/surface.json` |
| `20_plates.py` | rotation file, plate polygons, Natural Earth coastline and places | `plates.bin/.json`, `coast.bin/.json`, `places.json`, `work/plates_ref.json` |
| `30_climate.py` | `ExperimentInfo.xlsx`, `scotese_07_tas.zip`, `scotese_07_pr.zip` | `climate.bin/.json` |
| `35_elevation.py` | the 1° PaleoDEM zip and its interval CSV | `elevation.bin/.json` (with land and shelf %) |
| `40_curves.py` | Foster SD2, van der Meer mmc1, `climate.json`, `elevation.json`, `slices.csv` | `curves.json`, `work/tiles.json` |
| `50_timescale.py` | `chart.ttl` at the pinned commit, `slices.csv` | `timescale.json`, `work/ics_slices.json` |
| `60_story.py` | `content/story.yaml`, `timescale.json`, plate polygons | `story.json` |
| `80_manifest.py` | `slices.csv` and every `work/*.json` above | `manifest.json` |
| `90_about.py` | `credits/fragments/*.json` | `about.json`, `../CREDITS.txt` |

then `verify_data.py`. Every download through `common.fetch()` with its sha256 pin
(`sources.py`); every output through `write_json()` / `write_bin()`; no dates except `RETRIEVED`;
two runs from the same cache give byte-identical `data/` and `CREDITS.txt`.

---

## 13. Tests

- **`tools/verify_*.py`** (Python, per step, printing measured numbers): the checks in
  `CONTRACT.md` §14 — the ones that catch real mistakes are step 10's land/sea overlap of the 0 Ma map
  against Natural Earth with a longitude-shift search (a wrong raster registration), step 20's
  rotated-land test at 66, 200 and 300 Ma at both `rotation_ma` and `age_ma` with a wrong-time
  control (a wrong rotation file or time), step 20's quaternion-vs-pygplates check, and step 50's
  mismatch list.
- **`tools/check.mjs`** (Node, no dependencies; Snug Kart's shape): files within Snuggery's limits
  with the ZIP's exclusions (count, depth, largest, no symlinks); no `http(s)://` in any `.html`,
  `.css`, `.js`; every `import`, `src`, `href`, `fetch(` and `url(` target relative and inside the
  folder; every file the manifest and the `.json` siblings name exists and nothing unnamed sits in
  `data/`; `miniapp.json` valid; no AI vendor name in any shipped text file; the ZIP built as
  `build-zips.yml` builds it (`zip -r -X … -x '.*' '*/.*' 'screenshots/*' 'tools/*' …`) has
  `index.html` at its top and is ≤ 8,000,000 bytes, printing its size.
- **`tools/test_proj.mjs`**: the JS forward and inverse of both projections round-trip on a 1° grid to
  < 1e−9 rad, and match the formulas in §5.3 evaluated in float64.
- **`tools/test_plates.mjs`**: loads `plates.bin/.json` with `js/data.js` and `js/plates.js` and rotates
  the 1,000 reference points in `tools/work/plates_ref.json` (written by step 20 with pygplates, not
  shipped) at 10 of the 90 times; max error ≤ 1 km (int16 quantization measured ≤ 0.36 km).
- **`tools/shoot.mjs`** (Playwright, headless Chromium, 390 × 844, DPR 2, touch, light and dark; the
  scratchpad install via `PLAYWRIGHT_MODULE`): serves the folder itself, fails on any console error or
  warning, page error, failed request or any request outside the local server, `data:` or `blob:`.
  Scenes, each a screenshot: globe today; globe at map 49 (251 Ma) Surface; map view at map 49;
  Temperature at map 14 (55.8 Ma); Rain at map 57 (301.2 Ma); Plates on at map 43 (199.6 Ma);
  Coasts at map 16 (65.5 Ma); Find "Chicago" at map 57 with its card; a tap readout; sheet Half and
  Full; map 93 (750 Ma) with the Temperature lens (the notice); About; a forced context loss and
  restore. Then a **full sweep**: all 90 stops by ›, asserting the age row's text
  equals the manifest's for each, and a scripted scrub across the slider. Driven through
  `window.__eh`, which the shipped build carries inert.
- **Screenshots** read by eye (both themes), and `screenshots/app.png` at 780 × 1688.
- **On the phone**: import the ZIP, scrub the whole slider, play to today, switch
  globe and map, each lens, Plates and Coasts on, Find a city, tap the Earth, rotate the phone,
  background and return — the only evidence for frame time and memory.

---

## 14. Cut from v1, and why

- **Plate boundaries** (ridges, trenches): no open boundary set exists for Scotese's model, and the
  EarthByte models that have them put the continents elsewhere; drawing theirs on his maps would break
  the one-model rule. A v2 lens with its own continents is the plan's route.
- **Anything before 750 Ma** beyond a text prologue card: no map exists.
- **Continents morphing between maps**: would be invented geography. Cross-fade only.
- **Seasons, sea-surface temperature and salinity**: v1 shows annual means of air temperature and
  rain; `tos` and `so` are not downloaded.
- **O₂ and biodiversity curves**: no source with an open license was found (the plan's research).
- **Ocean names**: oceans are not plates; there is nothing in the model to pin "Tethys" to.
- **3D relief, zoom beyond 3×**: 1024-wide maps do not hold more detail.
- **Plate names**: the rotation file names plates by codes ("NAM-NWA"); no sourced plain-English
  names ship, so the app gives plate ids in small print only.
- **Foster's 95 % band**: its lower edge goes negative (§3.8); the 68 % band is drawn.
- **Ocean-floor motion**: the model does not carry today's ocean floor back (§7.2).
- **Generic city labels on the map**, sharing and export, and any refresh loop.

## 15–18. Build decisions and measurements

The measurements behind the numbers above, and the decisions taken where this design was silent or
had to bend while the app was built, are kept with the build tools in `tools/DECISIONS.md`, which
does not ship. References such as "§17.14" or "§18.6" point there.

## 19. Art direction

The rule for the look is "fancier, never generic". `ART.md` holds the direction
("Deep Field Atlas") and its change log. This section records what changed against §3, §5, §6 and
§9, and why. Where §3–§18 say otherwise, this section wins. Every rule of §2 and every data rule is
unchanged: the painted maps, the climate fields and the geometry are drawn as before, and every
added effect is a display choice that About names.

**§3 The screen.**
- *The Earth panel is always night* (`--space` `#05070c` light, `#02040a` dark), with glass
  controls and chalk keys for "on" in both themes. It makes the Earth the object on the page. The
  §3.2 "flat light-grey field" read as a template.
- *Globe | Map, the lens chips and the toggles share one segmented style*: 30 px, 9 px radius,
  hairline border, 12.5 px Atkinson. The toggles carry a swatch of their own overlay line, so they
  double as its legend.
- *Notices are captions* (Newsreader italic, 12.5 px) set on the instruments' black glass, so they
  read over any paint, bright polar ice included; each clause is its own line, so a separator never
  starts one. The Plates notice is "Pieces of today's crust and how they moved" over "Arrows: the
  million years before this map".
- *The Earth is seated between the controls* (§3.2 centered it in the panel): centered between 44 px
  from the top and 96 px from the bottom, so a legend or a notice sits under the disc, not on it. At
  390 × 844 the disc spans 44–402 px of the 498 px panel. It never sits lower than the panel's middle,
  nor so high that its top runs under the controls (at the half sheet and sideways it sits nearly
  centered, as before).
- *The neatline*: the panel is framed like an atlas plate, a 1 px rule 5 px in and a 0.5 px rule
  inside it (CSS, over the canvas, under the controls). It replaces the star field (§5 below).
- *The view follows the continents* (§3.2's time-zone longitude is withdrawn after the first
  launch's opening; the double-tap reset now returns here). Its center is a point of today's Africa
  (Kinshasa, plate 701, Africa being the model's reference frame) rotated to each map, at that
  point's longitude and its latitude + 20°, held within ±40°. A stop change eases the view there
  (exponential, τ 180 ms; a jump under Reduce Motion); the map view follows the longitude only.
  Measured on the shipped maps (area-weighted land in the visible hemisphere, 90 maps): a fixed
  105° W view shows under 10 % land on 42 maps; the followed view on none, and under 20 % on none.
  A drag, the arrow keys, Find or a Look-for turn stop it (the view is the person's then); a
  double-tap starts it again. Stored as `eh.follow`.
- *The tap, city and Look-for card is a callout* (§3.2 "a card at the top of the panel"). It sits
  above its pin, or below when there is no room, with a pointer on the pin, and is 300 px wide at
  most. It shows the heading, two lines of "then" (three when there is no "now") and two of "now";
  a figure group ("29 °F, 27 in of rain a year", "42° N 88° W,") never breaks, so the clamp cuts
  between groups, never inside a number; the footnote marks hide until a chevron ("Show the whole
  card") opens the rest and the footnotes. The card is not a live region (it is rewritten at every
  stop); a short line, "Chicago, 301.2 million years ago: 2° S 21° W, lowland", is announced when a
  pin is set and when the slider settles. With no pin on screen it sits under the controls without
  a pointer. `shoot.mjs` checks that it sits above Chicago's pin, 104 px tall, clear of the pin.
- *Age row (§3.3)*: the swatch moves inline before the ICS line. The ICS line wraps to two lines
  instead of taking an ellipsis (core decision 14's cut). The buttons are 38 px wide with 44 px hit areas, and play is a
  round key. The age is Newsreader 21 px with its unit in italic. The sweep checks that both lines
  stay inside the 48 px row at all 90 stops.
- *Slider (§3.4)*: the ICS period strip is the track, 22 px, under a 3 px band of the four eras'
  chart colors (Neoproterozoic, Paleozoic, Mesozoic, Cenozoic). Their names are set above in
  Newsreader italic, the oldest named by its eon, "Proterozoic". The 750–550 Ma stretch is hatched,
  and the break mark becomes a wavy unconformity cut. The per-map ticks move under the bar, and the
  thumb is a 28 px ring with the period color showing through. The hit area, the axis, the keys
  and the ARIA are unchanged. The age row's live region is cleared 1.5 s after each announcement, so
  reading the page line by line does not meet the age a third time. The three step keys are 38 px
  wide (44 px hit areas).
- *Legend (§3.2, §18.6)*: US temperature ticks are −40, 0, 32, 60, 100 °F (70 sat 6 px from
  "100 °F"). Rain is 0, 10, 50, 200 in and 0, 250, 1,000, 5,000 mm ("100" and "200"
  collided as "100200"). The caption is one line: "Air temperature, yearly mean · climate model"; the full
  definition (1.5 m, 5 ft, above the surface, over land and sea) is in its accessible name and in
  About. The unit is set on the last number, and the labels are placed by measured
  width with a 5 px minimum gap, while hairline marks keep the true positions. The rain caption is
  "Rain and snow in an average year · climate model", because "a year" left the tick row. The
  accessible name spells the unit out. `shoot.mjs` asserts the label boxes do not touch, for both
  lenses in both unit systems.
- *The curves (§3.5)*: the current map has a hairline and a glowing dot on each curve's own 1-Myr
  point.
- *Sheet (§3.6)*: a height change glides (a FLIP, 280 ms). The grid changes at once, so every
  measured height is final immediately. The period name is in Newsreader, section labels are
  Atkinson small caps, tile values are Newsreader, and event titles are Newsreader. "Then and now"
  is a ruled ledger (hairline rules, no rounded cards). The body no longer repeats the head's range:
  it adds only the chart's boundary uncertainties ("Today's chart: start ± 0.024, end ± 0.2 million
  years"), and "This map" quotes the chart's Period · Epoch · Age only beside a note where the chart
  and Scotese's label disagree (the age row names them already).
- *Find and About* make the page behind inert while open, and Escape closes them wherever focus is.

**§4 Motion (new).**
- *The opening*: on a first launch only, when neither `eh.intro` nor `eh.stop` is stored, and never
  under Reduce Motion. It starts as soon as the proxy sheet is on the GPU, without waiting for the
  plates, so a first launch never shows an empty panel. The globe fades in over 700 ms at 750 Ma
  (`uFade`), then the stops play to today over 5 s, eased along the axis. Each stop shows its proxy
  cell (the scrubbing path, §5.7), so nothing between the 90 maps is invented; the globe runs at 0.6
  of its size, so a 256 × 128 preview is magnified about 3.4× at DPR 2 instead of 5.6×, and grows
  into place over the last fifth. The counter rolls. The view follows the continents as it always
  does (above; the followed point is held at its 600 Ma place for 690 and 750 Ma), from the moment
  the plates arrive. Today's full map then fades in and the controls appear. Skip, any pointer or key, and a hidden page all end it at once. `eh.intro` is stored
  before it starts. `__eh.skipIntro()` and `__eh.intro()` are its test hooks.
- *Play (§4.3)*: the thumb glides linearly between stops, and the age counts toward each map's age
  (time constant 70 ms), landing on the exact Table 1 text. It is clamped between the map's age and
  its neighbor's on the side it counts from, so a slow frame cannot pair a number with the wrong
  map. `shoot.mjs` asserts this during the opening. `#age` always holds the true text. The
  count is drawn in an aria-hidden twin, and `#age` goes to opacity 0 meanwhile, so it never leaves
  the accessibility tree.
- *Pins* drop and settle in 420 ms. Keys and chips cross-fade in 200 ms, and cards and overlays rise
  in as they appear.
- All of it stops when idle, is off under Reduce Motion, and stops when the page is hidden (§18.16).

**§5 Rendering.**
- *§5.9 is replaced.* Lambert shading is `(0.82 + 0.18·max(n·L, 0))·(0.90 + 0.10·z)`, a little
  shallower so the painting reads. The scattering rim adds `glow·(1 − z)⁴·0.30·lit` inside the disc,
  where `lit` runs 0.35–1 from the far to the lit side of the limb. The halo outside is
  `glow·(0.62·e^(−d/0.02)·lit + 0.07·e^(−d/0.14))`. Glow is `#8fc0ff` from `--glow`. There is no
  terminator and no night side.
- *The night field*: the space color, plus `(0.016, 0.028, 0.060)·e^(−1.4·max(r − 0.8, 0))`
  toward the Earth, and a ±½-level dither on top (Chris Wellons' `lowbias32` integer hash, released
  into the public domain), the same every frame. The star field of the first art pass is gone: a
  star field behind a glowing globe is the stock look of globe demos, and this is an atlas plate,
  framed by its neatline (§3 above). The map's ellipse sits on the same field. Its 1 px edge (§6 item 6) becomes a 0.75 px hairline at 42 % white.

**§6 The overlay.**
- *Coasts*: 0.8 px `rgba(255,255,255,0.88)` over 2.25 px `rgba(0,0,0,0.5)`.
- *Plate outlines, weighted by ring area* (km², `plates.bin`): ≥ 5,000,000 km² is 1.15 px at 86 %
  amber with a halo; 1,000,000–5,000,000 is 0.9 px at 66 % with a halo; 100,000–1,000,000 is 0.7 px
  at 46 %; smaller is 0.5 px at 28 %. At 200 Ma the continents read and the slivers recede.
- *Arrows*: at most 16, 46 px apart (was 24), 9 + 2.2 × speed px long (capped at 30 px), with a
  1.4 px white shaft, a filled head and one dark halo.
- *Pins*: 5 px with a 1.75 px white ring, a soft shadow and a ground shadow; labels are Atkinson
  700, 11.5 px.

**§9 Themes and type.**
- *Tokens*: the light theme is "survey paper" (`--bg` `#eceee9`, `--panel` `#f7f8f5`, `--ink`
  `#16201f`, `--ink-2` `#4e5a57`, `--accent` `#1d5a7e`), and the dark theme is deep navy (`#0a1120`
  / `#0f182b` / `#e8ebe6` / `#9ea9ba` / `#86b6e6`). Cream was considered and turned down, because
  warm cream with a serif display is the stock look of templated pages. The full table with every
  measured ratio is in `ART.md`. `shoot.mjs` measures 35 text styles: the lowest is 5.79:1 light and
  6.73:1 dark (§18.13's minimum was 4.71:1).
- *Type (§9's "no web fonts ship" is withdrawn)*: Atkinson Hyperlegible 400/700 and Newsreader
  500 and 400 italic ship in `fonts/` (82,696 bytes of WOFF2 plus OFL.txt), with a scale of 10 /
  11.5 / 13 / 14 / 17 / 21 px and tabular figures on every counter. The credit comes from
  `tools/90_about.py`, in CREDITS.txt and About. The subsets have no "₂", which falls back to the
  system face.
- *§11 file layout*: `fonts/` and `ART.md` are added. Both ship in the ZIP, and ART.md is root
  Markdown like this file.
- *§10 budgets*: app code is 203,817 bytes of the 250,000 cap, so the cap is unchanged. The ZIP
  size is in `NOTES.md`.
- *§13, §18.19 screenshots*: `SCREENSHOTS=1` writes `screenshots/app.png` (map 49, the light
  theme, the sheet at peek) and ten named scenes, now including the opening and the callout card.
  Each is taken at rest, after the sheet's glide and any CSS animation have finished.
