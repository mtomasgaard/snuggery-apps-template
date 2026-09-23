# Norne reservoir viewer

An offline 3D viewer for the Norne oil field simulation model (Norwegian Sea), built as a Snuggery miniapp. Plain HTML, CSS and JavaScript with WebGL 2: no libraries, no build step, no network.

What it does:

- Shows the 44,431-cell corner-point grid coloured by oil, water or gas saturation, pressure, porosity, permeability, net-to-gross, depth, formation, region or layer.
- Plays the production history from 6 Nov 1997 to 1 Dec 2006 in 110 monthly frames.
- Draws the 36 wells, coloured by what they are doing at that date: green producer, blue water injector, red gas injector, grey shut. Wells stay hidden until they are first opened.
- Explodes the model by formation (Garn, Ile, Tofte, Tilje), by layer or by segment.
- Cuts the grid by I, J and K ranges and filters cells by value.
- Tap a cell for its details; double-tap to fly to it and orbit around it; double-tap empty space or use the frame button to see the whole field again.
- Charts field or per-well oil, water and gas rates, with a cursor at the current date.
- Optional **topside layers**, all off by default: the sea surface and the seabed at true depth, the Norne FPSO, the seven subsea templates on their own in-service dates, the schematic flowlines and risers, the schematic legs from the wells up to their templates, the 16-inch gas export line, the oil offloading leg, the flat **export network map** out to Emden, the field's **reported production** beside the simulated rates, and **animated flow** for oil, gas, produced water, injected water and injected gas.
- Saved viewpoints: *Along the field*, *Overview* and *Show the field*, defined in `config.json` and re-read on focus.
- Remembers the view, date and settings in `localStorage`. Supports light and dark mode and works from 390 px wide.

## Folder layout

```
norne-reservoir/
  index.html, app.js, style.css   the app
  topside.js                      the optional topside layer (stage 1: sea, platform, templates, pipelines, flow)
  topside-network.js              the export network map (stage 2), imported the first time that row is switched on
  config.json                     editable settings: property list, colour maps and ranges, well colours,
                                  formations, explode distances, playback speed (re-read when the app regains focus)
  miniapp.json                    Snuggery display name, entry point and version
  data/                           model data built by pipeline/ (binary, do not edit by hand)
    topside.json                  the topside layer's own data, model-relative metres (about 13 KB)
    topside-network.json          the network map's lon/lat copy (about 160 KB), fetched on first open
    ATTRIBUTION.txt               source, licence and exact file formats
  pipeline/                       rebuilds data/ from the public model (not shipped to Snuggery)
  scripts/package.sh              builds the Snuggery import ZIP in dist/
```

## Run it locally

Serve the folder; do not open `index.html` as a file, because browsers block `fetch()` of the data files from `file://`.

```
cd norne-reservoir
python3 -m http.server 8000
# open http://localhost:8000
```

## Build the Snuggery archive

```
scripts/package.sh        # writes dist/norne-reservoir.zip (about 15 MB)
```

The script copies only the runtime files into one wrapping folder, refuses to build if any runtime file contains an `http://` or `https://` URL, and checks the data files exist. Import `dist/norne-reservoir.zip` into Snuggery.

## Snuggery runtime rules this app follows

- Runs completely offline in a sandboxed web view. No CDNs, web fonts, API calls or analytics; every asset is in the folder.
- Plain HTML, CSS and JavaScript (ES modules allowed). No server, no build step, no service workers, no cross-origin iframes.
- Data is loaded with `fetch('./…')` from files in the folder. Reads are always fresh, so the app re-reads `config.json` on focus.
- `localStorage` persists between launches; `sessionStorage` is cleared on close.
- Archive: one ZIP with `index.html` (one wrapping folder is fine), relative paths only, no `..`, symlinks or drive letters, at most 10,000 files, 512 MB total, 128 MB per file, 16 folder levels, no encryption.
- Optional `miniapp.json` at the top level sets name, entry point, description and version.
- Must work on a phone screen and in light and dark mode.

## Where the data comes from

`data/` is derived from the Norne benchmark case, published by Equinor and the Norne partners through the Open Porous Media (OPM) initiative in [OPM/opm-data](https://github.com/OPM/opm-data). The 3D saturations and pressures come from our own run of that public deck with OPM Flow 2026.04. The deck was used as published except for report settings, changed so results are written monthly to the end of the schedule.

The run was checked against the Eclipse 2014.2 results OPM publishes for the same deck in [OPM/opm-tests](https://github.com/OPM/opm-tests) (`norne/ECL.2014.2`, summaries only). At 1 Dec 2006 cumulative oil differs by −0.2%, water +0.4%, gas −0.1%, and field pressure by 0.06 bar on average. Against the field's observed history the model produces about 7% less oil and 43% more water, which reflects the model's history match, not the run.

## The topside layers

Everything topside is optional and **off by default**: with every row off the app draws, behaves and
persists exactly as it did before, and the render loop is as idle as ever. Open the control sheet to
its third stop and use the **Topside** group.

| Row | What it draws | Honesty |
| --- | --- | --- |
| Sea surface and seabed | Translucent planes at 0 m and 378 m over the grid footprint | The seabed range across the templates is 374–380 m; one plane is drawn at the vessel's 378 m |
| Norne FPSO | A ship marker at E 458,667 / N 7,323,438, 561 m from the model centre | The hull shape and heading are artwork; the position is published |
| Subsea templates | B C D E F K, each appearing on its own in-service date | Published positions; M (2010) is outside this history |
| Flowlines and risers — schematic | Straight dashed lines between real end points | No in-field route is published: tracks within 500 m of a facility are dropped from the public dataset |
| Wells up to their templates — schematic | A dashed leg from each drawn well top to the template the deck assigns it to | The drawn well path stops about 2 km below the seabed, at the top of its modelled completions |
| Gas export line | The published 16-inch route, 128.1 km to the Åsgard Transport tee, from March 2001 | The route is published; the depth is not, so it is drawn on the seabed plane |
| Oil offloading — schematic | A dashed arrow ending in a label | The crude leaves by shuttle tanker; no open dataset records where a cargo goes, so no line reaches any refinery |
| Later facilities (M, 2010) | Template M, hollow, with its date | It came after this history |
| Export network map | A flat Mercator map: 56 coastline lines, 77 published pipelines, 43 onshore terminals and the 7 offshore nodes of the gas chain, with Norne's own 816 km route highlighted. Opening it collapses the control sheet so the map gets the whole stage; closing it puts the sheet back | Lengths are measured along the real route, not off the map. The route ends at the Kalstø landfall; Kårstø is 19.7 km further inland with no published line between them. A refinery is drawn as a hollow ring with a short leader to its name, never as a filled dot on a line, and the route's own end points are labelled before any refinery is |
| Reported production (NOD) | The field's reported monthly oil, gas sold and water, as dotted lines in the chart | Reported gas is gas **sold** and is zero until February 2001; the simulation's gas is gas produced from the reservoir. In the chart key a solid swatch is a simulated rate, a dashed one an injected rate, a dotted one a reported one |
| Flow animation | Moving marks along the wells, the flowlines, the risers and the export line | Illustrative marks; the rates behind them are the simulation's own |

**Depth is drawn true, in one scale.** Sea level 0 m, seabed 378 m, reservoir 2,439–3,090 m.
Switching the topside on sets the vertical scale to ×1, because at the default ×5 the platform would
float 13.8 km above a field 3.3 km tall — and, the first time it is switched on, frames the whole
column the way the *Show the field* chip does, so the flattening does not leave the reservoir a
sliver in whatever view you had. Raise the slider again and the sea rises with everything else,
which is what exaggeration really means. While the sea row is on, the three numbers are printed
under the scale bar — *sea 0 m · seabed 378 m · reservoir 2,439–3,090 m* — because at the framings
the app picks for itself the two planes are only a few pixels apart and would otherwise read as one.

**Flow marks follow the rates.** A path runs at 0.6 marks a second at the first drop and 6 a second at
the 90th-percentile rate for that fluid (oil 5,300, produced water 2,600, gas 1,060,000, injected
water 10,000, injected gas 3,900,000 Sm³/d), spaced 34 px apart on screen. A shut well does not
animate. Both loops — the 3D one and the map's — are capped at 30 fps, stop when the page is hidden
and restart when it comes back, and are replaced by static direction arrows under
`prefers-reduced-motion`. The map animates one thing only, the gas export route, so it moves only
while **Gas** is one of the chosen fluids; with any other fluid alone it draws once and stops.

**What it costs.** The layer adds 271 KB to a 26 MB app — `data/topside.json` 13,736 B,
`data/topside-network.json` 163,534 B (fetched only when the map is first opened), `topside.js`
58,204 B and `topside-network.js` 21,034 B. With every row off nothing is drawn and nothing is
scheduled: the render loop stays render-on-change, and a five-second measurement with the topside
loaded and idle counts **zero** redraws. With every row and every flow toggle on, the frame time at
390 × 844 measured 1.05–1.12× the same app with the topside off (headless Chrome on a software
renderer — not a phone). Time to first paint is within a few milliseconds of the app without the
layer; the data file's fetch starts when the module is imported, so it overlaps the reservoir's 25 MB
of binaries and costs nothing on the path to first paint.

**What is in the data files but not on screen.** `data/topside-network.json` carries an `area` block —
ten tie-back satellites (Urd J/G/H, Alve, Alve Nord, Marulk, Fossekall P/R, Dompap S, Verdande) and
twelve neighbouring field outlines, in model-relative metres, about 29 KB. **This version draws none
of it**, on any row: the field view draws the nine facilities in `data/topside.json` and nothing
else. The block is the pulled-back *Area* step's input, built and shipped so that step needs no
pipeline change; three of those satellites (the Urd templates, on stream 8 November 2005) are inside
this history, so nothing in the app should be read as saying the tie-backs came after it.

**Positions are assumed to be ED50 / UTM 32N.** The simulation deck names no datum (`MAPAXES` is the
identity transform); every directorate record for Norne carries ED50, so ED50 is assumed and said to
be an assumption. The alternative reading would move everything 80 m east and 209 m north — less than
the 139–861 m scatter between a well and its own template, so no drawn claim depends on it.

**Saved viewpoints.** A *Views* row of chips sits above the Topside group: **Along the field** (low
and close along the field's long axis at ×1, oil saturation, November 1997), **Overview** (what the
frame button does) and **Show the field** (the Stage-1 rows on, sea surface and vessel above the
reservoir). A chip flies the camera with the app's own tween and sets only what its entry names. The
entry's `topside` list is the rows it turns on, and an empty list clears them all without switching
the layer off — which is why *Along the field* reproduces the owner's angle whether or not the
topside was showing. The entries live in `config.json` under `views`, which is re-read when the app
regains focus, so a new viewpoint is a few numbers in a file — `theta`, `phi`, `dist` or `distFactor`, `target`, and
optionally `exag`, `frame`, `prop`, `wells`, `labels`, `edges` and a `topside` list of rows to turn
on. Labels are stable English strings because they are also how a screenshot script reaches a view
by name.

## Rebuild the data

Only needed to change what goes into `data/` (other properties, frame spacing, a newer OPM). The OPM Python packages only exist for Linux x86_64, so on a Mac use the GitHub Actions workflow `Rebuild Norne reservoir data` (manual run; download the artifact) or a Linux x86_64 machine or container.

```
norne-reservoir/pipeline/build_data.sh
```

This creates a virtualenv in `pipeline/work/`, installs `pipeline/requirements.txt`, downloads the deck at a pinned commit, runs the simulation (about 8 to 10 minutes on one core), checks it against the Eclipse reference (fails above 1% difference), and rewrites `data/`. Extracting from the original run reproduces the committed files byte for byte; a fresh simulation on another machine can differ in the last digits. The steps can also be run one at a time; each script has `--help`.

### Rebuild the topside layers only

`pipeline/build_topside.py` is separate and much cheaper: **standard library only**, no simulator,
any platform, and it never touches the reservoir binaries.

```
cd norne-reservoir/pipeline
python3 build_topside.py --report     # both files, and every number it checked
python3 build_topside.py --no-network # stage 1 only
python3 validate.py --topside-only    # re-check the written files against model.json
```

It downloads only what its cache does not already hold (`--cache`, `--offline` to forbid
downloading) and refuses to write a file that fails its own checks. **It is deterministic**: two
runs from the same cache, and a run from an empty cache, produce the same bytes.

```
80f675f1f0a4f3cb202965ed1c0c0f810f91fadcc3ae656fc29cba5a0b3af3a9  data/topside.json          13,736 B
1831c0109c29c82e67a447d6053eda7f821b0e4fbb36774300093aa37d5d8255  data/topside-network.json 163,534 B
```

## Code map (app.js)

- Loading: `main()` fetches `config.json`, `data/model.json` and the binary files.
- Colour: `fillValues()` decodes a property for one frame; `updateColors()` writes per-cell colours into a data texture.
- Geometry: `rebuildFaces()` emits only faces that are open to the outside, cut away, across a fault, or split by the explode setting, using the precomputed `neighbours.bin`.
- Explode: `computeExplode()` groups cells by formation, layer or segment and offsets each group; `buildWellBuffer()` moves well paths with their cells.
- Wells: screen-space ribbons in `WELL_VS`, drawn as a faint see-through pass, a dark outline and a coloured pass.
- Picking: `pickAt()` renders cell ids to an offscreen framebuffer and reads one pixel.
- Camera: orbit around `S.cam.target`; `flyTo()` animates focus changes; world space is x east, y up (depth times vertical scale), z south.
- Updates: a render loop redraws only when a dirty flag in `R` is set.
- Topside: `topside.js` is a separate ES module. `app.js` calls it in eleven one-line hooks (each
  commented `topside:`) and hands it `{ gl, model, cfg, S, R, G, api }`; nothing in the reservoir code
  depends on it, and the only structural change is that the well pass moved out of `draw()` into
  `drawWells()`. It has three programs of its own — translucent planes, screen-space path ribbons
  with a dash or a moving mark, and billboarded facility markers with a minimum pixel size — and one
  buffer that carries both the drawn lines and the flow paths, gated per line by a uniform.
- `window.__norne` is an inert test surface the module writes: frame counters, drawn positions, flow
  state and `setView(id)`. It reads state and changes nothing the controls do not.

## Licence

The data in `data/` is a derived database of the Norne benchmark and stays under the Open Database License (ODbL) 1.0; keep `data/ATTRIBUTION.txt` with it. The code can be licensed separately.
