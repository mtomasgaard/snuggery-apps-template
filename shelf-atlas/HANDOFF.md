# Handoff: Shelf Atlas and World Oil & Gas

Two apps, one pipeline. Read `RESEARCH.md` for the sources and the reasoning; this file is how to
run and maintain them.

## What belongs to these apps

```
shelf-atlas/                    the North Sea app (index.html, app.js, style.css, miniapp.json)
  data/geo.json                 basemap, boundaries, field outlines, pipelines, facilities   (rebuilt weekly)
  data/snapshot.json            fields with monthly production series, sources, ask rows      (rebuilt weekly)
  data/bathy.png                EMODnet depth raster, 8-bit grey in Web Mercator rows          (rebuilt weekly, rarely changes)
  RESEARCH.md  HANDOFF.md       these documents
world-oil-gas/                  the world app
  data/world.json               Natural Earth 110m countries (rarely changes)
  data/snapshot.json            annual oil and gas by country, 1900 →                        (rebuilt yearly)
  data/fields.json              GOGET units: points, production, reserves, outlines            (manual)
  raw/manual/                   the GOGET workbook lives here (never shipped in the ZIP)
scripts/shelf_atlas/            the pipeline: common.py, fetch_*.py, nlog_production.py,
                                build_north_sea.py, build_world.py, probe.py, SCHEMA.md
.github/workflows/build-shelf-atlas.yml     weekly (Mondays) + on demand
.github/workflows/build-world-oil-gas.yml   1 July and 1 September + on demand
.github/workflows/probe-shelf-atlas.yml     diagnostic: prints what every source URL returns
```

Deleting the apps means deleting those folders, the three workflows, `scripts/shelf_atlas/`, the
two rows and entries in the README, and the carve-outs in `LICENSE`.

## Running the build

**On GitHub (the normal way).** Actions → *Build Shelf Atlas data* → Run workflow. Inputs:
`countries` (default `NO,UK,DK,NL`; use fewer to debug one regulator) and `refresh` (ignore the
week's download cache). The job fetches ~40 MB from the regulators, takes 5–15 minutes, and
commits `shelf-atlas/data/*.json` only if they changed. The same for *Build World Oil & Gas data*.
Schedules only fire from `main`.

**Locally.**

```bash
python3 -m pip install 'pyshp>=2.3' 'openpyxl>=3.1' 'pypdf>=4' 'numpy>=2' 'tifffile>=2024'
python3 -m scripts.shelf_atlas.build_north_sea --out shelf-atlas/data            # all four countries
python3 -m scripts.shelf_atlas.build_north_sea --countries NO --out /tmp/ns      # one country, elsewhere
python3 -m scripts.shelf_atlas.build_north_sea --basemap-only --offline --no-bathymetry   # coast/land only, no fetch
python3 -m scripts.shelf_atlas.build_world --out world-oil-gas/data
```

Downloads go to `scripts/shelf_atlas/cache/` (git-ignored) and are **never refetched** unless you
pass `--refresh` or delete the file; `--offline` fails instead of fetching. In Actions the cache is
restored from the previous run's `actions/cache` entry and refreshed by `refresh: true`.

**If a source breaks**, the build stops with a `BUILD FAILED:` line naming the table or layer and
what it found (columns, counts). It never writes a partial file. Run the probe workflow with the
failing URL in `scripts/shelf_atlas/probe-urls.txt` (or pasted into its `urls` input) to see what
the source serves now, then fix the fetcher.

## The manual GOGET update (world field points)

1. Download the newest release (March 2026 at the time of writing) from
   https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/download-data/ — an
   `.xlsx` behind a form.
2. Put it in `world-oil-gas/raw/manual/` (keep GEM's filename), remove older ones.
3. Run *Build World Oil & Gas data* (or `build_world.py` locally) and commit the workbook with the
   regenerated `world-oil-gas/data/fields.json`.
4. If the build stops with "GOGET main sheet lacks …", GEM renamed a column: add the new header to
   `GOGET_COLS` in `build_world.py`.

The March 2026 release is committed. Without a workbook `fields.json` carries `available: false`
and the world app shows only the country choropleth, with the reason on its layer menu and About screen.

## Known data gaps

| where | gap | why |
| --- | --- | --- |
| Denmark | no pipelines | the Energy Agency publishes none; GEUS has none; EMODnet's Danish lines are onshore heating pipes |
| Denmark | monthly per-field series only from January 2018; earlier years are the annual total spread evenly (flagged `monthlyFrom`) | the Agency's monthly reports start in 2018; before that only the yearly workbook |
| Netherlands | series start in 2003 | the NLOG datacenter holds 2003 → |
| Netherlands | production comes from an undocumented API | documented in `nlog_production.py`; if it moves, Dutch fields keep outlines and lose series, and the build fails loudly |
| UK | PPRS starts June 1975; subsea points thinned to manifolds/templates; pipelines limited to hydrocarbon fluids and ≥ 3 km | volume |
| UK | licence forbids commercial exploitation (NSTA Open User Licence) | see LICENSE |
| Norway | fields north of 73°N would fall outside the box (none today) | `BBOX` in `build_north_sea.py` |
| Cross-border | only the units listed in `CROSS_BORDER` (`build_north_sea.py`) are grouped; other same-name matches are listed in `snapshot.matching` and drawn separately | avoid silent bad merges |
| UK | one-month outliers exist in PPRS (Tern gas, September 2000, ~50× its usual level); the app's colour scale uses each field's second-highest month so one bad month cannot flatten it | source data, left as reported |
| All | the newest month is uneven: Denmark reports about a month earlier than Norway, and the UK and Netherlands about two months later; the app opens on the newest month every country has reported and says which countries are missing beyond it | source cadence |
| All | 23 UK production units and one Danish field (Ravn) have no outline and are drawn as a point at the regulator's field centre | source geometry |
| World fields | 618 GOGET units have no coordinates and are left out; 1,021 are marked approximate | source; the sheet says so |
| World fields | one production year per unit (mostly 2024, some 2022–2023, a few older); no series | GOGET ships one figure per unit |
| World countries | data year lags one year (EI June edition → OWID) | source cadence |

## Constraints summary (reuse in future prompts)

- Snuggery miniapp: self-contained folder, `index.html` + `app.js` + `style.css` + `miniapp.json`;
  **no network at runtime** — no fetch of anything outside the folder, no CDN, no web fonts, no tiles.
- iPhone Safari WebKit (iOS 18+), touch-first, safe areas via `env(safe-area-inset-*)`,
  light and dark via `prefers-color-scheme`, `localStorage` for UI state only, re-read data on
  `visibilitychange`, fail loudly on missing or malformed data, show `generatedAt`, carry an `ask` array.
- Data comes from a build pipeline in this repository (GitHub Actions), committed as files in
  `<app>/data/`; the ZIP builder packs the folder (minus `raw/`, `tools/`, `screenshots/`).
- Canvas 2D map, own Web Mercator, geometry packed as Google polylines (4 decimals North Sea,
  3 world), monthly series as base64 uint16 with a per-series scale; contract in
  `scripts/shelf_atlas/SCHEMA.md`.
- Budgets: `geo.json` ≤ 2 MB, `snapshot.json` ≤ 2.5 MB, app code ≤ 150 KB.
- Sources and licences are listed on the app's attribution screen and in `LICENSE`; attribution
  strings are the ones the licences require (NLOD, NSTA, CC BY 4.0).
