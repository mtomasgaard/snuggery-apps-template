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
- Remembers the view, date and settings in `localStorage`. Supports light and dark mode and works from 390 px wide.

## Folder layout

```
norne-reservoir/
  index.html, app.js, style.css   the app
  config.json                     editable settings: property list, colour maps and ranges, well colours,
                                  formations, explode distances, playback speed (re-read when the app regains focus)
  miniapp.json                    Snuggery display name, entry point and version
  data/                           model data built by pipeline/ (binary, do not edit by hand)
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

## Rebuild the data

Only needed to change what goes into `data/` (other properties, frame spacing, a newer OPM). The OPM Python packages only exist for Linux x86_64, so on a Mac use the GitHub Actions workflow `Rebuild Norne reservoir data` (manual run; download the artifact) or a Linux x86_64 machine or container.

```
norne-reservoir/pipeline/build_data.sh
```

This creates a virtualenv in `pipeline/work/`, installs `pipeline/requirements.txt`, downloads the deck at a pinned commit, runs the simulation (about 8 to 10 minutes on one core), checks it against the Eclipse reference (fails above 1% difference), and rewrites `data/`. Extracting from the original run reproduces the committed files byte for byte; a fresh simulation on another machine can differ in the last digits. The steps can also be run one at a time; each script has `--help`.

## Code map (app.js)

- Loading: `main()` fetches `config.json`, `data/model.json` and the binary files.
- Colour: `fillValues()` decodes a property for one frame; `updateColors()` writes per-cell colours into a data texture.
- Geometry: `rebuildFaces()` emits only faces that are open to the outside, cut away, across a fault, or split by the explode setting, using the precomputed `neighbours.bin`.
- Explode: `computeExplode()` groups cells by formation, layer or segment and offsets each group; `buildWellBuffer()` moves well paths with their cells.
- Wells: screen-space ribbons in `WELL_VS`, drawn as a faint see-through pass, a dark outline and a coloured pass.
- Picking: `pickAt()` renders cell ids to an offscreen framebuffer and reads one pixel.
- Camera: orbit around `S.cam.target`; `flyTo()` animates focus changes; world space is x east, y up (depth times vertical scale), z south.
- Updates: a render loop redraws only when a dirty flag in `R` is set.

## Licence

The data in `data/` is a derived database of the Norne benchmark and stays under the Open Database License (ODbL) 1.0; keep `data/ATTRIBUTION.txt` with it. The code can be licensed separately.
