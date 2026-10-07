# Norne Reservoir

An offline 3D viewer for the Norne oil field's reservoir simulation model (Norwegian Sea), built as a Snuggery mini-app. Plain HTML, CSS and JavaScript with WebGL 2: no libraries, no build step, no network. Its look follows the template's house system; `ART.md` says how it looks and why, this file what it does and where every number comes from.

What it does:

- Shows the 44 431-cell corner-point grid colored by oil, water or gas saturation, pressure, porosity, horizontal or vertical permeability, net to gross, depth, formation, fault segment or layer, with the property's scale under the picture.
- Plays the production history from 6 Nov 1997 to 1 Dec 2006 in 110 report dates (monthly after the first), and scrubs it by finger on the player's track.
- Draws the field's water cut on that track (the signature, "the cut"): each month a column as tall as the liquid the field's wells lifted per day, oil in ink at the foot and water as a paler ink stacked on it, at a fixed 0.5 px per 1 000 Sm³/d. A key under the picture says which is which; the track's value gives the shown month's figures to VoiceOver, and the rates chart draws them.
- Draws the 36 wells by what they are doing at the date shown: a producer a solid line, a water or gas injector a dashed one, a shut well thin and faint; their roles are also in the key under the picture. Wells stay hidden until they first open.
- Explodes the model by formation (Garn, Ile, Tofte, Tilje), by layer or by fault segment; cuts the grid by I, J and K ranges and filters cells by value.
- Shows a vertical section A–A′ through the grid under the model (beside it on a wide screen or a phone on its side), from the Section key: along the field's long line, across it, or along a line drawn on the model; the cells it cuts as blocks in the shown property and month, never blended, with the formations, the wells within 150 m of it and the inactive gaps hatched, on the model's own depths (TVD) stretched as the 3D view is. A tap on a block opens that cell's card.
- Sweeps that line across the field with the slider under the section (‹ › one step at a time): from Along through the grid's columns, from Across through its rows, each drawn as the grid's own cells along the slice's path, the line moving on the model; a drawn line moves parallel to itself.
- Makes the section taller (beside the model, wider) by dragging the pane's edge or double-tapping it, up to the point where the 3D view keeps a strip of 120 px (160 px beside it); a taller pane stretches the section to fill it and says by how much. The arrow keys and VoiceOver move the edge too.
- Tap a cell or a well's name for its values on a card; double-tap a cell to fly to it, double-tap empty space or use Show the whole field to see it all again; the zoom keys zoom without a pinch.
- Charts the field's or one well's oil, water and gas rates, produced and injected, with a cursor at the date shown (in the controls sheet).
- Switches every quantity between SI and US units with the key at the top right (bar or psi, meters or feet, Sm³/d or bbl/d for liquids, Sm³/d or Mscf/d for gas; permeability stays mD).
- Hides its controls (focus mode, Hide the controls; back with Show the controls or Escape), leaving the model, the section when it is open, the scale and the keys under them, the About key and the player.
- Remembers the view, date, property, units, the section (its line, where it was swept and the pane's size) and focus mode in `localStorage`. Light and dark themes: the light theme prints the model on white as a negative (more of a quantity darker), the dark theme as a print (more of it brighter). Works from 320 px wide and on a phone on its side.

## Folder layout

```
norne-reservoir/
  index.html, app.js, style.css   the app
  js/units.js                     every number, unit and date the app writes (SI notation, both unit systems)
  js/data.js                      the data decoded: frames, values, scales and their open ends, the cut's series
  js/track.js                     the player's track and the cut drawn on it
  js/section.js                   the section A–A′: the cut through the grid, the field's lines and top, the sweep, its layers
  js/pane.js                      the section pane's edge: drag, double tap, keys and VoiceOver resize it
  fonts/                          Ysabeau Office (the house face, a subset) and its license, OFL.txt
  config.json                     editable settings: property list, color scales per theme and ranges, well
                                  colors, formations, explode distances, playback speed (re-read when the
                                  app comes back to the screen)
  miniapp.json                    Snuggery display name, entry point and version
  ART.md                          the look: the house system as this app takes it, the palette, the signature
  data/                           model data built by pipeline/ (binary, do not edit by hand)
    ATTRIBUTION.txt               source, license and exact file formats
  pipeline/                       rebuilds data/ from the public model (not shipped to Snuggery)
  scripts/package.sh              builds the Snuggery import ZIP in dist/
  tools/                          checks, tests and the palette script (not shipped)
```

`config.json`'s color fields (`colormaps` for the light theme, `colormapsDark`, `wellColors`) are written from `tools/art/palette.py --json`, which checks every scale's contrast and color-vision separation; `tools/check.mjs` fails while the two differ. A copy may edit them by hand, and the app keeps reading a `config.json` written before the house pass (one scale for both themes, the explode distances under their older key names).

## Run it locally

Serve the folder; do not open `index.html` as a file, because browsers block `fetch()` of the data files from `file://` (the app says so on screen).

```
cd norne-reservoir
python3 -m http.server 8000
# open http://localhost:8000
```

## Build the Snuggery archive

```
scripts/package.sh        # writes dist/norne-reservoir.zip (about 15 MB)
```

The script copies only the runtime files into one wrapping folder, refuses to build if any runtime file contains an `http://` or `https://` URL, and checks the data files exist. Import `dist/norne-reservoir.zip` into Snuggery. The template's own workflow (`build-zips.yml`) zips the folder instead, leaving out `tools/`, `pipeline/`, `scripts/` and `screenshots/`; `tools/check.mjs` builds the ZIP that way and checks its size.

## Snuggery runtime rules this app follows

- Runs completely offline in a sandboxed web view. No CDNs, web fonts from elsewhere, API calls or analytics; every asset, the face included, is in the folder.
- Plain HTML, CSS and JavaScript (ES modules). No server, no build step, no service workers, no cross-origin iframes.
- Data is loaded with `fetch()` from files in the folder. Reads are always fresh, so the app re-reads `config.json` when it comes back to the screen; a broken one keeps the settings already loaded and says so.
- `localStorage` persists between launches (every access in try/catch); `sessionStorage` is cleared on close.
- Archive: one ZIP with `index.html` (one wrapping folder is fine), relative paths only, no `..`, symlinks or drive letters, at most 10 000 files, 512 MB total, 128 MB per file, 16 folder levels, no encryption.
- Optional `miniapp.json` at the top level sets name, entry point, description and version.
- Works on a phone screen and in light and dark mode.

## Where the data comes from

`data/` is derived from the Norne benchmark case, published by Equinor and the Norne partners through the Open Porous Media (OPM) initiative in [OPM/opm-data](https://github.com/OPM/opm-data). The 3D saturations and pressures come from our own run of that public deck with OPM Flow 2026.04. The deck was used as published except for report settings, changed so results are written monthly to the end of the schedule.

The run was checked against the Eclipse 2014.2 results OPM publishes for the same deck in [OPM/opm-tests](https://github.com/OPM/opm-tests) (`norne/ECL.2014.2`, summaries only). At 1 Dec 2006 cumulative oil differs by −0.2 %, water +0.4 %, gas −0.1 %, and field pressure by 0.06 bar on average. Against the field's observed history the model produces about 7 % less oil and 43 % more water, which reflects the model's history match, not the run.

**The cut** (on the track) is computed in `js/data.js` from `model.json`'s `summary.field.oil` and `summary.field.water`, the simulation's field rates averaged over the month to each report date. Its figures, which `tools/test_decode.mjs` reproduces from the file: the liquid peaks at 37 144 Sm³/d in the month to 1 Nov 2000 (4 % water); water passes oil in the month to 1 Jul 2004 and stays above it in all 30 months from there; the last month is 69 % water; over the 3 312 days the monthly averages sum to 67.20 million Sm³ of oil and 23.29 million of water. It is the simulation's production, not the field's reported production, and it leaves out gas (measured at the surface in volumes about 220 times the oil's, 218 over the run's report dates) and injection, which are in the rates chart.

**Scales that the data goes past** print their ends open: pressure is colored from 200 to 450 bar while the cells span 56.4 to 612.5 bar over the history, gas saturation reaches 0.922 against a scale to 0.90, and 13 cells sit under 1 mD of horizontal permeability, 101 under 0.1 mD and 5 over 2 000 mD of vertical permeability. Those cells take the end's color, and the legend shows `≤` or `≥`.

The 16 fluid-in-place regions are the four formations crossed with four fault segments (FIPNUM 1 to 4 in Garn, 5 to 8 in Ile, 9 to 12 in Tofte, 13 to 16 in Tilje), so the app colors the fault segment (FIPNUM − 1, modulo 4) and names the region on the cell's card.

## Rebuild the data

Only needed to change what goes into `data/` (other properties, frame spacing, a newer OPM). The OPM Python packages only exist for Linux x86_64, so on a Mac use the GitHub Actions workflow `Rebuild Norne reservoir data` (manual run; download the artifact) or a Linux x86_64 machine or container.

```
norne-reservoir/pipeline/build_data.sh
```

This creates a virtualenv in `pipeline/work/`, installs `pipeline/requirements.txt`, downloads the deck at a pinned commit, runs the simulation (about 8 to 10 minutes on one core), checks it against the Eclipse reference (fails above 1 % difference), and rewrites `data/`. Extracting from the original run reproduces the committed files byte for byte; a fresh simulation on another machine can differ in the last digits. The steps can also be run one at a time; each script has `--help`.

## Code map

- Loading (`app.js`): `main()` fetches `config.json`, `data/model.json` and the binary files, checking each binary's size, and counts them in the stamp's line, which hides once they are in (About's first row names the edition); a problem is a sentence on the plate in the file's terms.
- Decoding (`js/data.js`, pure): `fillValues()` and `cellValue()` read a property at a report date; `propRange()`, `norm()` and `openEnds()` place values on their scale; `cutSeries()` and `cutFacts()` build the cut.
- Color (`app.js`): `updateColors()` writes each cell's color for the shown date into a data texture, through the theme's 256-entry scale (`lut()`).
- The frame (`app.js`, `loop()`): input records only the wanted report date; each animation frame draws the newest wanted date, then writes everything that carries a date (the time row, the card, the section pane, the chart's cursor, the track's thumb) from it. The loop asks for frames only while something changed, a flight runs or play is on.
- Geometry: `rebuildFaces()` emits only faces that are open to the outside, cut away, across a fault, or split by the explode setting, using the precomputed `neighbours.bin`.
- Explode: `computeExplode()` groups cells by formation, layer or segment and offsets each group; `buildWellBuffer()` moves well paths with their cells.
- Wells: screen-space ribbons in `WELL_VS`, a faint see-through pass, a dark casing and the role's core; injectors dashed in the fragment shader, a shut well narrower and faint.
- Picking: `pickAt()` renders cell ids to an offscreen framebuffer and reads one pixel; a tap on a well name's own text (padded to 24 px tall) selects the well, and its 44 px box, grown upward from the name, does where no cell is under the finger.
- The card (`placeCard()`): a corner of the room the keys leave, never over the tapped cell's ring or a chosen well's head and name; in its compact form (the place line with its keys, then the figure and the rows scrolling as one) where the plate is too short for the full one, with the sheet raised or the phone on its side.
- Framing: `fitCam()` fits the field's projected box to the plate, left of the key column or below the key row, with a lens shift to center it there; a camera at the fit is fitted again when the plate changes size.
- Camera: orbit around `S.cam.target`; `flyTo()` moves on the house's `--draw` curve, ends at its destination on any touch, and is a cut under Reduce Motion; world space is x east, y up (depth times vertical exaggeration), z south.
- The section (`js/section.js`, drawn by `drawSection()` in `app.js`): `cutGrid()` cuts the plane along A–A′ through each active cell's twelve edges into one polygon per cell; `fieldLines()` finds Along and Across from the grid's columns; `surfaces()` keeps the field's top and base as height fields, where `mapPoint()` meets a finger and the line is laid on the model; `sectionAxis()` is the one scale (distance and depth in meters, depth stretched as the 3D view is) every layer draws on: the gaps (`gapLayer()`), the cells (`drawCells()`, in the 3D view's texture colors), the formation tops, the wells (`wellsNear()`), the frame. The section is drawn in the frame that draws the date, its pane's height set before the 3D view draws (`fitSection()`), so neither canvas is shown stretched. The sweep: `columns()` and `slices()` list the grid's columns and rows, `sliceSection()` draws one as its own cells along its path (`wellsNearPath()` for its wells), `shifts()` steps a drawn line parallel to itself; `ownExag()` is the stretch of a pane made taller. Nothing is new data: it is all cut from `geometry.bin` as loaded.
- The pane's edge (`js/pane.js`, `paneEdge()`): a drag, a double tap, the keys and VoiceOver set one fraction from compact to tall, kept in the saved state; the pane takes it as `--pane` with the class `grown`.
- The track (`js/track.js`): the cut drawn once per size, theme and unit system into a cached canvas; each frame copies it and draws the thumb.
- Numbers (`js/units.js`): U+202F between a number and its unit and in thousands, U+2212 for negatives, dates by hand (`1 Dec 2006`), both unit systems, the spoken forms VoiceOver hears.
- Test hook: `window.__norne`, which nothing in the app calls; `tools/shoot.mjs` reads the app through it.

## Tools (not shipped)

```
node tools/check.mjs                                           # static: budgets, the ZIP, the face, the data's hashes, SI, US spelling, the camera's strings
node tools/test_decode.mjs                                     # js/data.js and js/units.js against the test's own decode of data/
node tools/test_section.mjs                                    # js/section.js's cut, lines, wells, axis, sweep and stretch against data/
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs   # the app driven at 390 × 844 in both themes
python3 norne-reservoir/tools/art/palette.py [--json]          # from Template/: every color and contrast in ART.md
```

Budgets (`tools/check.mjs` prints the truth): app code at most 256 000 bytes, the lead's ruling for 2.3's edge and sweep (2026-10-07; 2.3 measures 255 443), 222 000 for 2.2's section (plan 0012 3.4; 200 000 before it, about 162 000 after the house pass and its follow-up). Fonts at most 160 000 (40 075), the ZIP at most 19 110 591 bytes (about 15.4 MB).

## Credits and license

The data in `data/` is a derived database of the Norne benchmark and stays under the Open Database License (ODbL) 1.0; keep `data/ATTRIBUTION.txt` with it. About credits it as `Data: Norne benchmark, Equinor and the Norne partners via the Open Porous Media initiative, ODbL 1.0`, the first line under Sources and credits, one tap from every screen and from focus mode by the About key, and carries the model's own source sentence in full after it.

Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.

The code can be licensed separately.
