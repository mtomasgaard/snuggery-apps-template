# Shelf Atlas — what it shows, what it must say on screen, and what changes

The North Sea and the Norwegian shelf, field by field: every outline the four regulators
publish, the platforms and subsea structures, the pipelines, the maritime boundaries and the
seabed depth, with a monthly player from 1971 to the newest reported month. Circle area and
colour carry each field's rate (liquids, gas or oil equivalent) or, in cumulative mode, its
volume to date; outlines carry status only. Tap a field for its operator, discovery year,
status history, peak and a sparkline of its whole life.

The decisions behind it are in **`RESEARCH.md`** (every source, its licence, what failed) and
the running of it in **`HANDOFF.md`** (file list, the build, the gaps). The data contract is
`scripts/shelf_atlas/SCHEMA.md` in the repository root. Read those before changing the
pipeline; this file is the short version.

## What the app must print, and does

The regulators' terms ask for attribution and, in one case, forbid a use. The credits line on
the map and the About screen carry these strings; keep them if you change the app.

| Source | Licence | The attribution string the snapshot carries and the app prints |
| --- | --- | --- |
| Sodir (Norwegian Offshore Directorate) FactPages and FactMaps | NLOD 2.0 | "Contains data under the Norwegian licence for Open Government data (NLOD) distributed by the Norwegian Offshore Directorate" |
| NSTA (UK North Sea Transition Authority) Open Data | NSTA Open User Licence — **commercial exploitation is not granted** | "Contains information provided by the North Sea Transition Authority and/or other third parties" |
| Danish Energy Agency and GEUS | no licence stated; Danish public-sector information under the PSI Act | "Danish field data: Danish Energy Agency (ens.dk); installations via GEUS" |
| NLOG (TNO, Netherlands) | public information; NLOG claims no rights | "Dutch field data: NLOG (nlog.nl), TNO – Geological Survey of the Netherlands" |
| Marine Regions, Maritime Boundaries v12 | CC BY 4.0 | "Maritime boundaries: Flanders Marine Institute (2023), Maritime Boundaries Geodatabase v12, marineregions.org (CC BY 4.0)" |
| EMODnet Human Activities and EMODnet Bathymetry | CC BY 4.0 | "Danish and Dutch pipelines: EMODnet Human Activities" and "Bathymetry: EMODnet Bathymetry Consortium, EMODnet Digital Bathymetry (DTM)" |
| Natural Earth | public domain | "Basemap: Natural Earth" |

These strings live in `snapshot.sources` (written by the build) and the app prints them as
they are; change them in the fetchers under `scripts/shelf_atlas/`, not in the app.

The UK term is the one that matters: this app and its data may not be used commercially. The
repository's `LICENSE` carries the same carve-out.

## The files, and which ones change

```
data/geo.json        basemap, boundaries, field outlines, pipelines, facilities   1.4 MB   weekly build, rarely differs
data/snapshot.json   fields, monthly series, groups, sources, ask rows           1.7 MB   weekly build, differs every month
data/bathy.png       EMODnet depth raster, 8-bit grey in Web Mercator rows       0.5 MB   weekly build, almost never differs
```

The weekly build (`.github/workflows/build-shelf-atlas.yml`, Mondays, and on demand) commits
these three only when their content changed; a build whose sources did not move commits
nothing. **The phone's refresh loop replaces `data/snapshot.json` only**, like every other app
here. That is the file with the figures, so a phone that refreshes weekly sees each new month.
`geo.json` changes when a regulator adds or redraws a field, a few times a year: the app draws
the field as a point until the next ZIP replace brings the outline (see `PROMPT.md`).

## Honesty notes the app carries

- The newest month is uneven: Denmark reports about a month earlier than Norway, the UK and
  the Netherlands about two months later. The player opens on the newest month every country
  has reported and says which countries are missing beyond it.
- Danish field outlines are the Energy Agency's legal delineations drawn on block corners, not
  reservoir shapes; they are drawn dashed and unfilled and the sheet says so.
- Before 2018 the Danish monthly figures are annual totals spread evenly; the Dutch series
  start in 2003 and the UK series in June 1975. In cumulative mode the sheet says where each
  sum starts and flags fields whose earlier production is missing.
- Cross-border fields are grouped only where the split is published (`CROSS_BORDER` in
  `scripts/shelf_atlas/build_north_sea.py`); every other same-name match is listed in
  `snapshot.matching` and drawn separately.

## Size

The ZIP is about 1.9 MB; the app parses 3.6 MB of JSON and decodes one PNG on open, in well
under a second on a recent iPhone. The budgets (`geo.json` ≤ 2 MB, `snapshot.json` ≤ 2.5 MB,
app code ≤ 150 KB) are enforced by the build, which fails rather than ship a bigger file.
