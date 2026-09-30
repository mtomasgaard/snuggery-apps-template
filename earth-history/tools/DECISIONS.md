# Earth's History — build decisions and measurements

These are sections 15–18 of `DESIGN.md`, kept here with the build tools so they do not ship in the
app's ZIP: the measurements the design's numbers came from, the notes left for whoever publishes the
app, and the decisions made where the design was silent or had to bend while the core and the
polish were built. Section numbers are unchanged, so "§17.14" still means item 14 below. §1–§14 and
§19 of `DESIGN.md` (the design and its art direction) ship with the app.

## 15. Decisions and the measurements behind them

Commands were run from `Template/earth-history/tools/` with `.venv/bin/python` on scratch scripts in
the session's scratchpad; nothing was written into `data/`.

- **E1 Polygon valid times.** pygplates over `PALEOMAP_PlatePolygons.gpml`: 471 features, 505
  geometries, 26,433 vertices — 503 `PolygonOnSphere` (26,374 vertices, none with holes) and 2
  `PolylineOnSphere` (59 vertices; plates 201 and 714, valid 600 Ma to the future); 78 polygons of
  at least 1,000,000 km², the smallest 0.9 km²; valid-time pairs (0, 0) × 196, (4500, −∞) × 46, (245, −∞) × 40,
  (600, −∞) × 29, (0, −∞) × 21, (+∞, 600) × 17, …; begins include 48.1 and 79.1, so they are float32;
  453 features valid at 0 Ma; by area the 0–0 rings are 62.6 % of the sphere (largest: plate 901,
  15.3 %), the others valid at 0 Ma 37.6 %. **Decision:** honour valid time for outlines; points take
  the begin time of the polygon they fall in (§7.2) — chosen over "points valid forever" (Scotese's
  PaleoData workflow copies only the plate id), because drawing a Pacific island on a 200 Ma map would
  put crust the model does not reconstruct onto a painted map.
- **E2 Rotations.** 241 plate ids (incl. 0) × 90 times × {T, T + 1}: int16 quaternions 347,040 bytes,
  zlib-9 156,240; float32 694,080 / 275,838; 16,328 distinct quaternions of 43,380; int16 worst
  position error 0.36 km. **Decision:** int16, renormalised in the app (§CONTRACT 3). T + 1 rather than
  T − 1 for the arrows (§7.3).
- **E3 Climate.** All 1,090 member files read with h5py, annual means over 12 equal months (360-day
  calendar) and the five 20-year means: temperature −55.68 to 42.47 °C; rain 0 to 16.165 mm/day;
  0 Ma global means 14.74 °C and 2.961 mm/day with the node-bound area weights of §CONTRACT 6 (the
  research probe, method not stated, printed 14.79 °C). Encoding temperature `−60 + 0.5·b` (bytes
  9–205, error ≤ 0.25 °C); rain `0.0003·b²` (max byte 232, error ≤ 0.06 mm/day). Field-major layout
  deflates to 780,559, slice-major to 812,974 → field-major.
- **E4 Maps.** Pillow 12.3.0, LANCZOS, WebP method 6: 1024 × 512 q65 all 90 = 4,747,276 bytes
  (q75 5,352,450; 1536 × 768 q65 9,914,936); proxy 2560 × 1152 q60 388,972, q70 435,250, q80
  556,630 → q70.
- **E5 Coasts and places.** `ne_50m_coastline`: 1,429 lines, 60,416 vertices;
  `pygplates.partition_into_plates(..., partition_method=PartitionMethod.split_into_plates)` with the
  453 polygons valid at 0 Ma → 2,121 pieces, 61,800 vertices, 151 plates; int16 247,200 bytes, zlib
  230,426 (delta-coded 144,628 — not taken: 85 KB is not worth a second decoder). Places: 1,251 in
  the file; the first 300 by (scalerank, −pop_max, name) include 36 US cities; names carry double
  spaces ("Washington,  D.C.") that step 20 collapses.
- **E6 ICS.** `chart.ttl` read with rdflib: Quaternary 2.58–0, Neogene 23.04, Paleogene 66.0,
  Cretaceous 143.1 ± 0.6, Jurassic 201.4 ± 0.2, Triassic 251.902 ± 0.024, Permian 298.9 ± 0.15,
  Carboniferous 358.86 ± 0.19 (Pennsylvanian from 323.4 ± 0.4), Devonian 419.62 ± 1.36, Silurian
  443.1 ± 1.0, Ordovician 486.85 ± 1.5, Cambrian 538.8 ± 0.6, Ediacaran 635.0, Cryogenian 720.0,
  Tonian 1000.0; 102 Ages and 37 Epochs younger than 750 Ma.
- **E7 Elevation.** The 1° PaleoDEM zip: 109 grids `z(181 lat −90…90, 361 lon −180…180)`, two names
  with fractional ages (`…_385.2Ma.nc`, `…_390.5Ma.nc`, so step 35 keys grids by the Appendix CSV,
  not the name). Scotese's Table 2 classes (atlas PDF p. 42, after Ziegler et al. 1985): land (z > 0) 27.6 %
  and shallow sea (−200 < z ≤ 0) 5.8 % at 0 Ma (1° nodes, cos-latitude weights, the +180° column
  left out), land 14.3–36.5 %, shelf 1.3–13.9 %
  over the 109. Class codes at 2° deflate to ≈ 182 KB, at 1° to 532,572. **Decision:** ship a 2° class
  grid for the readout's "what was there" (a fingertip covers more than 2° on the globe) — an
  addition to the plan's file list, chosen over leaving "shallow sea" out of the readout.
- **E8 Axis break at 550 Ma**, not 540: map 88 is at 542 Ma by Table 1, and the break must sit
  beyond it so the linear part holds every map the curves can describe.
- **E9 Credits fragments** go to `tools/credits/fragments/`, not `tools/credits/` as in Milky Way,
  because `tools/credits/` already holds the research's licence evidence, including two Zenodo record
  JSONs that Milky Way's `90_about.py` would mistake for fragments.
- **E10 Units**: US by default (°F, ft, mi, in), metric one tap away; CO₂ in ppm and plate speeds in
  cm/yr are shown in both systems' conventional units (cm/yr with inches in the US setting).
- **E11 The two gates of §13, measured.** Step 10's classifier "water iff blue > max(red, green)" on
  map 1 at 1024 × 512 against Natural Earth land rasterised to the same grid, cos-latitude weights:
  agreement 0.9725 at zero shift, 0.9531 / 0.9509 at ∓3 px, 0.9066 / 0.9057 at ∓10 px — the peak is
  at zero, so column 0 is 180° W and row 0 is 90° N. Step 20's test: 24,830 points on a 1° grid of
  today's land (24,827 inside a polygon), rotated with pygplates to T = 66, 200, 300 Ma (points
  whose polygon begins after T left out: 23,581 / 23,115 / 21,288), on PaleoDEM z ≥ −200 m at the
  matching 65 / 200 / 300 Ma grid: **0.905 / 0.974 / 0.903**; rotated to T ± 20 Ma as controls:
  0.812–0.813 / 0.910–0.922 / 0.833–0.857. On the raster ("not water"): 0.743 / 0.943 / 0.695 at T,
  0.644–0.649 / 0.890–0.895 / 0.659–0.674 for the controls. The gates in `CONTRACT.md` §14 are set
  from these numbers.

- **E12 Steps 10 and 20, built.** `tools/CONTRACT.md` §15 lists the builder's decisions and the
  re-measured numbers: present-day is the model's 0 Ma reconstruction and rotations ship as
  R(t)·R(0)⁻¹ (plate 198 has a non-zero pole at 0 Ma); 25,881 ring vertices after dropping closing
  duplicates; 44 coast slivers no polygon claims, kept at 0 Ma only; the land sample redefined and the
  gates re-measured (0.926 / 0.982 / 0.911 on PaleoDEM at 66 / 200 / 300 Ma); registration 0.9731.

- **E13 Steps 30, 40 and 50, built.** `tools/CONTRACT.md` §16 lists the builder's decisions:
  `climate.bin` 1,527,744 and `climate.json` 25,615 bytes, 0 Ma global mean 14.7441 °C and
  2.9610 mm/day, re-read independently through PhanDA's own copies of the fields; `curves.json`
  53,394 bytes on a 0–750 Ma grid (751 points, null where a source has no value), with Foster's CO₂
  and the model's CO₂ input as two separate series; `timescale.json` 31,699 bytes from chart version
  2026-06, with two inconsistencies in the chart data shipped as given (the Ludlow epoch overlaps the
  Pridoli; the Aquitanian begins 23.03 Ma against the Neogene's 23.04) and 11 map notes.

- **E14 Steps 60 and 90, built.** `tools/CONTRACT.md` §17 lists the builder's decisions. The text:
  15 period cards and a prologue (68–83 words), 27 events, 17 pins, 46 sources (44 papers, each
  checked against Crossref, plus the ICS chart and the atlas). Every numeral in a text is mapped to a
  source the item cites, and 13 statements about what the maps show are re-measured on the shipped
  maps and the rotation file on every build. `story.json` 40,982 bytes, `about.json` 21,348,
  `CREDITS.txt` 24,058. The atlas's colour key (pp. 7–8) calls white "the highest peaks", not ice,
  so the cards say "painted white" and leave "ice" to the papers.

## 16. For the lead

1. The van der Meer supplement has no licence line of its own; it is treated as covered by the
   article's CC BY statement (`RESEARCH.md` §2.5). Flagged by the research.
2. The courtesy email to Scotese about the atlas stays on the owner's list.
3. `Template/LICENSE` needs the app's carve-out pointing at `earth-history/CREDITS.txt`, and the
   README its entry — the lead's steps after publishing.
4. The About's longitude caveat is pinned: van Hinsbergen et al. 2015 (E14). The text still needs
   the two Opus reviewers' fact-check against its sources (plan 0010, workflow 3).
5. `DESIGN.md` and `NOTES.md` ship in the ZIP (root Markdown is not excluded by `build-zips.yml`);
   together about 30 KB deflated.

## 17. Builder's decisions (core)

Where this design was silent or had to bend, the builder of the core (`index.html`, `style.css`,
`miniapp.json`, `js/util.js`, `units.js`, `data.js`, `proj.js`, `shader.js`, `earth.js`,
`timeline.js`, `plates.js`, `overlay.js`, `app.js`, and `tools/check.mjs`, `test_proj.mjs`,
`test_plates.mjs`, `shoot.mjs`) decided the following. Measurements are from the commands in
`NOTES.md` ("Results at the time of writing").

1. **The tap lookup's winding number needs a sign test (§7.4).** Seen from the tapped point, a ring
   that encircles the point's *antipode* also winds by ±2π, so "|sum| > π means inside" put Chicago
   on plate 801 (Australia) at 0 Ma in the first build. A point is now inside only when it winds
   with the same sign as the ring's own interior anchor. 20 of the 503 anchors do not wind after
   int16 quantisation; for those rings the point must also lie within 120° of the ring's first
   vertex. Checked: at 0 Ma the lookup puts all 300 places on the plate pygplates' partition gave
   them (`test_plates.mjs`).
2. **The slider's `aria-valuenow` is the position from the left** (0 = 750 Ma, 89 = today), not the
   stop index (§3.4 says the stop index, where 0 is today). With the stop index, the ARIA "increase"
   gesture and → would move toward the past while the thumb moved left; this way → , ↑, Page Up and
   "increase" all move toward today and to the right. `aria-valuetext` carries the age, so the
   number is never what is read out.
3. **"The current mix frozen into A" (§5.5) is a render to texture**: a second small program draws
   the equirectangular mix of A and B at the current `uMix` into one of two ping-pong 1024 × 512
   mipmapped textures, which becomes A. It costs 2 × 2.67 MiB of GPU memory over §10's ≈ 33 MiB
   (37.9 MiB by arithmetic with 8 maps, the proxy sheet and both). The 90-stop sweep by › froze 30–39
   blends and never showed a blank frame.
4. **`createImageBitmap(…, { imageOrientation: 'from-image' })`**, not `'none'` (§5.8). Chromium 153
   accepts both without a message (measured); which iOS 18's WebKit accepts is not verified here. A
   rejected value throws, and the loader then decodes through `Image.decode()` (§5.8's fallback),
   counted as `fallbackDecodes` in `__eh.perf()` — a line in the phone check.
5. **Mollweide λ and θ per vertex are cached lazily**: the rotation on a stop change computes only
   the unit vectors; λ and θ are computed for that stop the first time the map view draws it. This
   took one stop's rotation from about 9 ms to about 1 ms in headless Chromium on this machine
   (a trend only; §10's 3 ms target is for the phone).
6. **The Earth panel is full-bleed**; the 16 px gutter applies to the other rows. The globe's centre
   is the panel's centre; the map's vertical pan is limited to the room the zoomed ellipse leaves.
7. **Tap and double-tap**: a single tap waits 300 ms so a double-tap can be told apart; a double-tap
   resets the view (zoom 1, 20° N, the UTC-offset longitude) and opens no card.
8. **Pins from a tap**: a tap that finds crust stores the present-day point, its plate index and its
   ring; the pin rides the plate and shows while the ring is valid (`ring_end ≤ T ≤ ring_begin`, the
   outlines' rule; cities will use `from_ma`, §7.2). When the ring is not valid at a map the pin
   hides and the card says "The crust you tapped is not in this reconstruction at this age." A tap
   that finds no crust has nothing to ride: its pin and card close when the map changes.
9. **Readout numbers**: temperature to whole degrees; rain per year = the model's mean rate ×
   365.25 days, in inches (one decimal under 10 in) or whole millimetres; speeds to 0.1 in and 0.1 cm;
   distances to whole miles or kilometres. The motion sentence is left out below 0.05 cm/yr (plate 0,
   the model's fixed frame). The card uses the elevation class's bare `name` (CONTRACT §18.2).
10. **During a context loss** the WebGL canvas is hidden and the overlay not drawn, so the panel
    shows its background and "Restoring the view…" rather than a blank canvas with coastlines on it.
11. **Loading**: the loading screen stays until the first Earth frame (the proxy cell of the saved
    stop); the saved stop's full map then fades in. `curves.json`, `story.json` and `about.json`
    are fetched and checked at start-up although this pass draws none of them, so a bad file shows.
12. **A finger resting 150 ms** on the slider fetches that stop's full map and cross-fades it in
    over 200 ms (§5.7), even before the finger lifts.
13. **Keyboard**: with nothing focused, ← / → step and Space plays (desktop). The Earth sits after
    the view control, the toggles and the lens chips in the tab order, as §9 lists them.
14. **The age row's live region** is a separate, visually hidden element updated only on settle; the
    visible lines update with every stop. A long ICS line (e.g. "Jurassic · Lower Jurassic ·
    Hettangian") is cut with an ellipsis at 390 px beside the three 40 px buttons; the full text is
    in the live region and will be in the sheet.
15. **Arrow direction on screen**: the anchor and a point 0.005 rad further along its motion are both
    projected, so the arrow follows the projection's distortion on the map and near the globe's rim.
16. **Placeholders for the next pass**: the curves row and the sheet are reserved at their heights
    so the Earth panel is its final 498 px; the sheet shows "Scotese map N · {Table 1 row}" and the
    chart note (or the ICS line and the Sun's brightness); Find, About, Temperature and Rain are
    present and disabled; `earth.setClimate(bytes, lut)`, `data.js`'s climate and elevation decoders
    and the shader's lens path are in place.

## 18. Builder's decisions (polish)

Where this design was silent or had to bend, the builder of the polish pass (`js/sheet.js`,
`curves.js`, `lut.js`, `find.js`, `about.js`, the rest of `app.js`, `index.html`, `style.css`, and
`tools/shoot.mjs`'s added scenes) decided the following. Measurements are from the commands in
`NOTES.md` ("Results at the time of writing"). §3–§10 above are left as written; where a choice here
differs from them, this list says so.

1. **The sheet's heights are grid classes** on `#app` (`sheet-half`, `sheet-full`) with every row
   placed explicitly, so a hidden row never shifts the others. At Full the Earth panel keeps its
   WebGL context and is only `visibility: hidden` at 0 px; the curves strip is `display: none` at
   Half and Full and is redrawn when it comes back. Measured at 390 × 844: Earth 498 / 314 / 0 px,
   sheet 112 / 380 / 694 px.
2. **Peek shows two lines**: the period and its chart range ("Triassic · 251.902–201.4 million years
   ago", the chart's own numerals, not §3.6's rounded "251.9") and "This map: Scotese map 49 · {Table
   1 row}". The body opens with the range again with the chart's ± values. A tap on the two lines
   opens the sheet to Half; the body is `inert` at peek, so Tab never lands on a cut-off button.
3. **"This map" also carries "Today's chart: Period · Epoch · Age"**, the ICS line the age row cuts
   with an ellipsis at 390 px (e.g. "Jurassic · Lower Jurassic · Hettangian"; core decision 14).
4. **Tile wording and rounding.** Temperature to 0.1 °F / °C, compared with `units.today_temperature_c`
   ("the same as the model's today" within 0.05 °C). CO₂ in whole ppm, its multiple of the same kind's
   0 Ma value (`today_co2_fit_ppm` or `today_co2_model_ppm`) to 0.1, "proxy fit" or "climate model
   input, {age} Ma", and Foster's 68 % band as a line. Sea level in whole feet with a sign (metric:
   0.1 m); its range in the same unit, between the lower and the higher of `min_m` and `max_m`
   (§3.6 wrote the range in metres). Land to 0.1 %, with the second line labelled "Shelf seas (0–660 ft
   deep)" / "(0–200 m deep)" so it cannot be read as the readout's class-4 "shallow sea"
   (CONTRACT §18.13a). The Sun to 0.1 %. Percentages print without a space ("97.9%"), the US style.
5. **The curves' three values are the manifest's tiles**, not `curves.json` read at `age_ma`, so the
   strip and the sheet never show two numbers for one thing (Foster's tile is interpolated from his
   0.5-Myr rows, the strip's grid from 1-Myr points). The label sits on a backing chip at the top
   left of the drawn part (right of the hatch), over a sparkline that uses the row's full 28 px. Each
   row's vertical range is fixed from every value it draws (units only relabel). The model's CO₂
   input is drawn dashed from Foster's last grid point (419 Ma) to 540 Ma. Row colours are theme
   tokens (`--c-temp`, `--c-co2`, `--c-sea`).
6. **Legend ticks** (§3.2): temperature is placed linearly in °C over the ramp's −50…40; rain one
   equal step per knot (0, 0.5, 1, 2, 4, 8, 16 mm/day). Ticks: US −40, 0, 32, 70, 100 °F; metric
   −40…40 °C; rain as yearly totals (× 365.25, as the readout), US 0, 10, 50, 100, 200 in, metric 0,
   100, 500, 2,000, 5,000 mm — chosen so no two labels collide on 160 px. The unit prints once after
   the ticks. On a map without a climate slice the legend hides and the §3.2 notice shows.
7. **The climate texture follows the stop**, also while scrubbing (7,008 bytes per upload), keyed by
   lens and slice; `climate.bin` loads on the first climate lens, tap or city.
8. **Find ranks in three tiers** — a prefix of the whole name, ASCII name or country; a prefix of any
   word in them; a substring — then by `scalerank`, then file order. An empty field shows one line
   of help; Enter picks the first row. Focus is not trapped inside the overlay.
9. **A city's card**: "Chicago, 301.2 million years ago", "Then: {lat} {lon} · {class}¹ · …", "Chicago is
   now at 42° N 88° W. It was moving …". Not carried back (`rotation_ma > from_ma`): "Houston’s crust is
   carried back only to 155 million years ago in this model."; with `from_ma` 0: "… is not carried back
   before today in this model."
10. **One pin at a time**: a tap, a city or a Look-for replaces the last. A Look-for pin also opens a
    card — its label, its text, where it sits on this map and where it is now, its plate and source —
    so it has a close button and says what it marks (the design gave it only a pin). It rides its
    plate while `rotation_ma ≤ from_ma`. Stored as `{kind: 'look', id}`; a stored city pin must name
    the same place (`id` and `n`), or it is dropped.
11. **Turn-to** (Find, Look for) animates longitude the short way round and latitude over 400 ms
    (ease-in-out); on the map only the central meridian moves. Under reduced motion it jumps.
12. **About** is ordered: intro, how to read it, what to keep in mind (the ten caveats with their
    sources), what is not shown, data sources (owner, licence and URI, credit line, what this app
    changed, accuracy, file, address, retrieval date, cite — all as text), references for the text
    (story.json's 46 and the two caveat papers), software, units, and the version line "Earth’s
    History 1.0 · data retrieved 2026-09-30". Five taps on it within 3 s toggle the frame-time readout
    (frame median, p95, max; GL and overlay time; rotation; maps cached; fallback decodes), refreshed
    every 500 ms and not stored.
13. **Two tokens added for contrast** (§9): `--on-accent` (dark text on the dark theme's pressed
    toggles, where white on #7aa7ff was unreadable) and `--accent-text` (#2459c2 light, #8fb5ff dark)
    for Cancel and Done, because #2f6fdf on `--bg` measured 4.32:1. `--tile` gives the tiles a
    background. `shoot.mjs` measures 29 text styles in both themes; all are ≥ 4.5:1.
14. **Wide screens use a 400 px column**, not 360, so "145.5 million years ago" fits beside the three
    buttons.
15. **No link anywhere**: text goes in through `textContent`, there is no `<a>` in the page (checked
    by `shoot.mjs`), and `<meta name="format-detection">` keeps WebKit from making numbers into links.
16. **Hidden page**: `visibilitychange` pauses play and stops a fling or turn-to; the frame-time
    readout's timer stops with it.
17. **Loading**: `curves.json`, `story.json` and `about.json` are fetched alongside the manifest and
    never hold back the Earth; Find and About are disabled until their data has arrived.
18. **Short citations** ("Foster et al. 2017", "Bond & Grasby 2017") are derived from each cite's
    author list and year, never typed; `about.json`'s "Author, 2016." form is read the same way.
19. **Screenshots**: `SCREENSHOTS=1 node tools/shoot.mjs` writes `screenshots/app.png` (780 × 1688:
    map 49, the globe centred on 15° E 5° N, Coasts on, the sheet at peek) and nine named scenes beside
    it; without the variable nothing is written into the app folder.
