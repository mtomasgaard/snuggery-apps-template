# Volve

An offline 3D viewer for the Volve oil field's reservoir simulation model (North Sea, block 15/9), with the field's seismic along a section through it, built as a Snuggery mini-app. It is Norne Reservoir's app carried to a second field, and its look follows the template's house system: `ART.md` says how it looks and why, this file what it does and where every number comes from. Plain HTML, CSS and JavaScript with WebGL 2: no libraries, no build step, no network.

What it does:

- Shows the 183 545-cell corner-point grid colored by oil, water or gas saturation, pressure, porosity, horizontal or vertical permeability, depth, fluid-in-place region or layer, with the property's scale under the picture. (The deck has no net to gross and names no formations, so neither is offered.) Pressure is drawn in plasma and the rock (porosity, both permeabilities, depth) in viridis, the same in both themes; the saturations keep their green, blue and red.
- Shows a compass at the plate's top left that turns with the model: its needle points where north lies in the view, shortening as north leans away, and VoiceOver says which way that is.
- Plays the run from 31 Dec 2007 to 1 Oct 2016 in 37 report dates: an 11-day first step, then a quarter apart (86 to 100 days). Every word for a period (the cut's, the cards', About's) is read from the dates themselves.
- Draws the field's water cut on the player's track (the signature, "the cut"): each report date a column as wide as its interval and as tall as the liquid the field's wells lifted per day over it, oil in ink at the foot and water as a paler ink stacked on it, at 1.5 px per 1 000 Sm³/d.
- Draws the wells by what they are doing at the date shown: a producer a solid line, an injector a dashed one, a shut well thin and faint. A well's card gives the simulated rates, the rates the field reported over the same interval, and the rates the deck sets from that date; the rates chart under More controls draws the simulated rates and, dotted, the reported ones.
- Explodes the model by layer or by region; cuts the grid by I, J and K ranges and filters cells by value.
- Shows a vertical section A–A′ under the model (beside it on a wide screen or a phone on its side), from the Section key: along an **inline** or a **crossline** of the seismic survey (its own traces, 25 m apart), **along** or **across** the field through the grid, or along a line **drawn** on the model. On it, the seismic at its own depths and the cells the plane cuts as blocks in the shown property and report date, with the Hugin Formation's top and base as interpreted, the wells within 150 m and the inactive gaps hatched, on one depth axis in meters below mean sea level. Under More controls, Section chooses what it shows (the seismic, the model or both), the seismic's gain and ramp (gray, or red and blue), and how strongly the cells cover the seismic.
- Sweeps that line across the field with the slider under the section (‹ › one step at a time): through every inline or crossline of the survey, from Along or Across through the grid's rows or columns, or a drawn line parallel to itself; the line moves on the model, and the section follows the slider, the newest place first.
- Makes the section taller (beside the model, wider) by dragging the pane's edge or double-tapping it; a taller pane stretches the section to fill it and says by how much (the stretch is held while the edge is dragged and set when it is let go).
- Zooms the section: a pinch about the fingers, one finger to move it once zoomed in, a double tap to zoom in where it lands, a mouse wheel or trackpad about the pointer, and the keys in a strip beside the plot, never over the data (Zoom in, Zoom out, Fit; where the plot is under 89 px tall they step aside, still reached by the keyboard and VoiceOver); in as far as the field's thin cells drawn 24 px tall, at the stretch the pane states. The seismic and the cells zoom together on the one axis: while a finger moves, the last full drawing is laid on the newest view (the seismic's own samples and the whole view's cells under it where the drawing did not reach), and at rest the seismic is drawn in full for the part of the line in view. The scales stand at the plot's edges and follow the view. Unlocked, a zoom holds until the section changes. Lock the axes holds the window on the whole field (every active cell's depths with 150 m of seismic above and below, and the full length of the line's family, at one scale), so a step of the slider moves the section and never the scale; only a hand moves a locked window.
- Under More controls, the grip's third raise shows all of Cells and view, its heading scrolled under the grip, the 3D view keeping a 104 px strip (254 px with the section open: the strip and the pane at 150).
- Tap a cell or a well's name for its values on a card; double-tap a cell to fly to it; the zoom keys zoom without a pinch.
- Switches every quantity between SI and US units with the key at the top right.
- Hides its controls (focus mode; the model keeps its compass), remembers the view, date, property, units, the section (its line, where it was swept, the pane's size and the axes' lock), its display and the sheet's stop in `localStorage`, and has light and dark themes. Works from 320 px wide and on a phone on its side.

## The seismic, and how it is drawn

Survey ST0202, the 2002 baseline (ocean-bottom cable), as the PS PSDM full-offset stack in depth from the 2008 processing: the only depth stack anyone can reach without a Databricks account. It is cut to the model (500 m above its shallowest cell to 500 m below its deepest, 250 m past its edge), low-pass filtered across the inlines and crosslines and decimated from 12.5 m to 25 m traces, and quantized to 8 bits with zero at code 128 and a symmetric clip at the 99.9th percentile of |amplitude|. Depth keeps its 5 m samples at their original depths. `data/seismic.json` holds the grid, the clip, the filter, the polarity line and its note.

On the section (`js/seismic.js`, tested by `tools/test_seismic_display.mjs`):

- Across the survey the display is bilinear between the four traces around each point; on an inline or a crossline that is the line's own traces and the blend between neighbors. Where the screen's columns lie farther apart than half a trace, each column averages points across its width first.
- In depth it is a windowed sinc (Kaiser, six samples either side), widened to the rows' own Nyquist where the screen's rows lie farther apart than the samples, so nothing aliases.
- That is the section at rest, at the screen's own pixels. While the view is dragged, resized or scrubbed, the seismic is drawn from its own samples (a column every 25 m along the line, a row every 5 m) or from its last full image laid on the new plot, scaled and smoothed by the screen; 150 ms after the finger is up it is resampled as above again. About says so.
- The amplitude is multiplied by the gain and drawn through a ramp symmetric about zero; no automatic gain control. The key under the section prints the signed amplitude at each end of the ramp, negative at the left. In gray, positive is dark on a light page and bright on a dark one; in red and blue, positive is red. About says so beside the polarity line.
- The model's cells are not samples: each is the block it is, never interpolated. Seismic and model each sit at their own depths on the one axis: nothing is shifted, stretched or tied.

What the test measures: zero kept at code 128 exactly; the samples returned exactly at their own depths and, between them, within −46 dB of the trace's own band-limited interpolation (linear interpolation: −30 dB); the depth kernel flat within 0.1 dB to wavelengths of 14 m; a 20° dipping event drawn with the rows three times the samples' spacing with −22 dB of its energy off its dip, against −13 dB drawn without the band limit and −8 dB by nearest trace and sample; a spike at its own depth to 0.04 m.

## Folder layout

```
volve/
  index.html, app.js, style.css   the app
  js/units.js                     every number, unit and date the app writes
  js/data.js                      the model decoded: frames, values, scales, regions, the report dates' spacing, the cut
  js/track.js                     the player's track and the cut drawn on it
  js/section.js                   the section A–A′: the cut through the grid, the field's lines and top, the sweep, the axis
  js/seismic.js                   the seismic on the section: the survey's grid and lines, the interpolation, the ramps, the horizons
  js/pane.js                      the section pane's edge
  js/gesture.js                   the section's gestures: tap, double tap, pinch, move and wheel
  fonts/                          Ysabeau Office (the house face, a subset) and its license
  config.json                     editable settings: properties, color scales per theme, well colors, explode distances,
                                  playback speed, the section's display defaults (re-read when the app comes back)
  miniapp.json                    Snuggery display name, entry point and version
  ART.md                          the look
  data/                           built by pipeline/ (binary, do not edit by hand); ATTRIBUTION.txt and Equinor's terms
  pipeline/                       rebuilds data/ (not shipped)
  scripts/package.sh              builds the Snuggery import ZIP in dist/
  tools/                          checks, tests, the palette script and the pipeline's own tools (not shipped)
```

## Run it locally

Serve the folder (browsers block `fetch()` from `file://`, and the app says so):

```
cd volve
python3 -m http.server 8000
```

## Build the Snuggery archive

```
scripts/package.sh        # writes dist/volve.zip (about 33 MB)
```

The template's own workflow zips the folder instead, leaving out `tools/`, `pipeline/`, `scripts/` and `screenshots/`; `tools/check.mjs` builds the ZIP that way and checks its size.

## Where the data comes from

Equinor and the former Volve license partners released the Volve field's data in 2018 under Equinor's own terms: CC BY 4.0 with "you may not sell the Licensed Material" added (`data/TERMS-Volve-2026-10-07.txt`). This folder uses:

- **The simulation model**: Equinor's Eclipse deck `VOLVE_2016.DATA` (108 × 100 × 63 cells, 183 545 active; black oil; 31 Dec 2007 to 1 Oct 2016 on the field's well history), run by the folder's workflow in OPM Flow 2026.04 and checked against Equinor's own Eclipse 2015.1 results (`data/validation.json`): field oil −0.5 %, water +0.5 %, gas −0.6 % at the end, water injected exact, field pressure within 0.31 bar on average and 0.84 bar at most, every well within tolerance.
- **The seismic**: as above.
- **Hugin Fm top and base horizons** (interpreted on survey ST10010, 2011 processing, and adjusted to the wells), **21 well paths** with Equinor's formation picks, and the **monthly production** per wellbore.

No 4D: the 2010 monitor survey is only in Equinor's Databricks copy.

**Depths.** The model and the seismic share one map frame (ED50 / UTM zone 31N) and one depth axis (meters below mean sea level, positive down), each at its own original depths. Neither source states its datum: the model's is measured as sea level (its completed cells lie on the surveyed well paths below sea level; `tools/measure_datum.py`), the seismic's is inferred as sea level (tidal statics in its processing). The PS image is depth-converted with its own converted-wave velocities, so its reflectors may sit off the well-adjusted horizons and the model; `seismic.json` says so (`depthRelation`), and its polarity line is qualified for a PS image (`polarityNote`).

**The cut** is computed in `js/data.js` from `model.json`'s `summary.field.oil` and `summary.field.water`, the simulation's field rates averaged over the interval to each report date. Its figures, which `tools/test_decode.mjs` reproduces from the file: the liquid peaks at 10 779 Sm³/d in the quarter to 5 Jan 2011 (68 % water); water passes oil in the quarter to 9 Jul 2010 and stays above it in all 26 from there; the last quarter is 78 % water; over the 3 197 days the averages sum to 9.93 million Sm³ of oil and 15.62 million of water, the run's own totals. Gas (about 145 times the oil's volume at the surface) and injection are in the rates chart.

**Scales that the data goes past** print their ends open: 364 cells under 0.1 porosity, 1 299 under 1 mD and 1 746 over 10 000 mD of horizontal permeability, 1 164 under 0.1 mD of vertical permeability. Pressure (203.2 to 447.1 bar) and gas (to 0.518) stay inside their scales.

**Regions.** The eleven fluid-in-place regions (FIPNUM) are lateral blocks through every layer; they are colored with four colors so that no two regions whose columns touch share one, and each is named by its number on the card and in the legend.

## Files in data/

| File | What | Built by |
| --- | --- | --- |
| `seismic.bin`, `seismic.json` | 144 × 188 traces at 25 m × 352 samples at 5 m (2 295 to 4 050 m), 8 bits | `pipeline/seismic.py` |
| `horizons.bin` | Hugin Fm top and base on the seismic's grid | `pipeline/seismic.py` |
| `wellpaths.json`, `production.json` | well paths below sea level with picks; monthly production | `pipeline/wells.py` |
| `model.json`, `geometry.bin`, `neighbours.bin`, `ijk.bin`, `static.bin`, `dynamic.bin` | the model as the app reads it, in ED50 / UTM 31N, 37 report dates | `pipeline/extract.py` (the workflow) |
| `validation.json` | the run against Equinor's | `pipeline/validate.py` (the workflow) |
| `ATTRIBUTION.txt`, `TERMS-Volve-2026-10-07.txt` | the credit, every adaptation, and Equinor's terms | by hand |

Formats are in `data/ATTRIBUTION.txt` and `data/seismic.json`. The app reads `wellpaths.json` and `production.json` nowhere; they ship because they are part of the data set this folder shares.

## Rebuild the data

`pipeline/build_data.sh` (see `pipeline/README.md`), in three stages:

1. **prepare**: fetch every input pinned by commit or URL and sha256 (`pipeline/sources.json`); prove the deck is the one Equinor ran (its run log and its INIT); make the stated edits; check every keyword against OPM Flow 2026.04; cut the seismic by HTTP range requests; write the wells; run the seismic tests. Runs on Linux x86_64 or macOS arm64 (`brew install cjson fmt` first).
2. **simulate**: OPM Flow 2026.04 in the official Docker image pinned by digest, 4 MPI processes (`mpirun --oversubscribe --bind-to none`).
3. **finish**: validate against Equinor's run (fails loudly), then extract.

On GitHub the workflow `rebuild-volve.yml` runs all three (about 20 minutes on a 4-vCPU runner); download its artifact and copy the model files and `validation.json` into `data/`. A re-run from the pins gives byte-identical files for everything `prepare` writes and for `extract.py` on the same run.

The deck needs more than report-setting edits to run in OPM, and every one is stated in `data/ATTRIBUTION.txt`; `tools/DECISIONS.md` gives the evidence for each.

## Code map

As Norne Reservoir's (its `NOTES.md`), with these differences:

- Loading (`app.js`): `main()` also reads `data/seismic.json`, `seismic.bin`, `horizons.bin`, `validation.json` and `ATTRIBUTION.txt`, checking each binary's size against the grid it describes.
- The section's families (`secLine()`, `sweepOf()`): the survey's lines come from `surveyLine()` and `surveyNumbers()` in `js/seismic.js`; Along, Across, Draw and the grid's slices are Norne's.
- The seismic layer (`seisJob()`, `seisStep()`, `seisWork()`): one image at the plot's own device pixels (the screen's, up to three a point: `secDpr()`) from `colPlan()` (bilinear across), `rowPlan()` (the windowed sinc in depth) and `renderCols()`, made at rest a few columns a frame (about 6 ms of each), drawn 1:1 and kept while the line, plot, gain and ramp stay; a new report date redraws only the cells over it.
- While the view moves (`moving()`: the edge, the sweep, a line or its end), `drawSection()` never starts that render: it lays the last full image on the new plot by distance and depth (`relay()`), or on a new line draws `seisPreview()` (the seismic's own traces and 5 m samples, scaled by the canvas). The cells are drawn anew on a new line and laid on anew on the same one; the gaps and the outline are laid on anew on the same line and left off on a new one. The pane's stretch is held while its edge is dragged. 150 ms after the finger is up and nothing has changed (`SEC_REST`), everything is drawn in full again.
- The depth window (`secWindow()`): with the seismic shown, the cut's depths and 150 m above and below; with the model alone, Norne's padding.
- Zoom and the axes' lock (as Norne Reservoir 2.5's: `secAxis()`, `secZoom()`, `secFit()`, `secFamily()`, `writeSecKeys()`; the view's arithmetic `viewAxis()`, `zoomAt()`, `panBy()`, `keepIn()`, `fitWindow()`, `commonFrame()` in `js/section.js`; the gestures in `js/gesture.js`). A pinch, a move or a wheel counts as the view moving (`moving()`), so the 1.1 rule holds: the layers laid on anew, the seismic never rendered until rest. At rest the seismic's image covers only the part of the plot the line and the window show (`seisJob()`'s clip), at the screen's pixels as before. The locked window (`secLockWin()`): every active cell's corners and 150 m beyond, inside the cube, whatever the section shows. The family's common distance (`secFamily()`): every inline or crossline from the survey's edge, where they all start; Along's and Across's rows or columns each from its end nearer the family's first end, keeping its own length along its path, a slice whose path runs against the line laid the other way; a drawn line's own length. The tall stop (`measureTall()`, `shownStop()`, `applyStop()`): the sheet raised to the grip and Cells and view, its heading to Show all cells.
- Color: `config.json`'s `colormaps` and `colormapsDark`, which `tools/art/palette.py` writes; pressure and the rock from matplotlib's plasma and viridis tables, the same stops in both themes.
- The compass (`updateGauge()`, as Norne Reservoir 2.4's): north projected at the camera's target turns and shortens its needle, places its N and names the direction; the card and the well names keep off it.
- The horizons (`horizonRuns()`, `horizonAt()`): bilinear on the interpretation's grid, broken where a node around has no pick.
- About (`writeAbout()`, `writeChanges()`): every figure from `model.json`, `seismic.json`, `validation.json`, and ATTRIBUTION's own statement of the changes, word for word.
- Test hook: `window.__volve`.

## Tools (not shipped)

```
node tools/check.mjs                                           # static: budgets, the ZIP, the face, the data's hashes, the terms, SI, US spelling, the camera's strings
node tools/test_decode.mjs                                     # js/data.js and js/units.js against the test's own decode of data/
node tools/test_section.mjs                                    # js/section.js and the survey's lines and horizons against data/, with the zoom's and the lock's arithmetic
node tools/test_seismic_display.mjs                            # js/seismic.js measured: zero, the interpolation, aliasing, depths
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs   # the app driven at 390 × 844 in both themes; WebKit and Chromium load, memory, the section's speed, zoom, lock and tall stop
python3 volve/tools/art/palette.py [--json]                    # from Template/: every color and contrast in ART.md
```

Budgets (`tools/check.mjs` prints the truth): app code at most 322 500 bytes (321 958 measured in 1.1; 1.2 measures 369 523 with the zoom, the lock and the tall stop, over it, for the template's ruling), the ZIP at most 33 600 000 bytes (about 33.4 MB measured), fonts at most 160 000 bytes.

## Credits and license

The data in `data/` comes from the Volve field data set, © Equinor ASA and the former Volve license partners, under Equinor's "Terms and conditions for licence to data - Volve" (`data/TERMS-Volve-2026-10-07.txt`); keep `data/ATTRIBUTION.txt` with it. It is shared free, not for sale, and not connected with, sponsored or endorsed by Equinor or the partners. Their names belong in the app's About and in ATTRIBUTION only, never in anything that markets Snuggery (clause 4). About credits the data as its first line under Sources and credits, one tap from every screen and from focus mode by the About key, and states every adaptation as ATTRIBUTION does.

Plasma and viridis are the colormaps Nathaniel Smith and Stéfan van der Walt made for matplotlib (viridis with Eric Firing); `config.json`'s stops for pressure and the rock are sampled from matplotlib 3.9.4's tables.

Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.

The code can be licensed separately.
