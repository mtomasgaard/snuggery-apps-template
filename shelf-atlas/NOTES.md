# Shelf Atlas — what it shows, what it must say on screen, and what changes

The North Sea and the Norwegian shelf, field by field: every outline the four regulators
publish, the platforms and subsea structures, the pipelines, the maritime boundaries and the
seabed depth, with a monthly player from 1971 to the newest reported month. Circle area and
color carry each field's rate (liquids, gas or oil equivalent) or, in cumulative mode, its
volume to date; outlines carry status only. Around each circle, in Rate, a thin ink ring marks
the field's best month so far (the Peaks, below). Tap a field for its figure, its best month,
its operator and status; Details opens its history chart and, for a cross-border unit, each side.

The decisions behind the data are in **`RESEARCH.md`** (every source, its license, what failed)
and the running of it in **`HANDOFF.md`** (file list, the build, the gaps). The data contract is
`scripts/shelf_atlas/SCHEMA.md` in the repository root. Read those before changing the
pipeline; this file is the short version. How the app looks, and why, is **`ART.md`**.

## What the app must print, and does

The regulators' terms ask for attribution and, in one case, forbid a use. About carries these
strings, after the credit line; keep them if you change the app.

| Source | License | The attribution string the snapshot carries and the app prints |
| --- | --- | --- |
| Sodir (Norwegian Offshore Directorate) FactPages and FactMaps | NLOD 2.0 | "Contains data under the Norwegian licence for Open Government data (NLOD) distributed by the Norwegian Offshore Directorate" |
| NSTA (UK North Sea Transition Authority) Open Data | NSTA Open User Licence — **commercial exploitation is not granted** | "Contains information provided by the North Sea Transition Authority and/or other third parties" |
| Danish Energy Agency and GEUS | no license stated; Danish public-sector information under the PSI Act | "Danish field data: Danish Energy Agency (ens.dk); installations via GEUS" |
| NLOG (TNO, Netherlands) | public information; NLOG claims no rights | "Dutch field data: NLOG (nlog.nl), TNO – Geological Survey of the Netherlands" |
| Marine Regions, Maritime Boundaries v12 | CC BY 4.0 | "Maritime boundaries: Flanders Marine Institute (2023), Maritime Boundaries Geodatabase v12, marineregions.org (CC BY 4.0)" |
| EMODnet Human Activities and EMODnet Bathymetry | CC BY 4.0 | "Danish and Dutch pipelines: EMODnet Human Activities" and "Bathymetry: EMODnet Bathymetry Consortium, EMODnet Digital Bathymetry (DTM)" |
| Natural Earth | public domain | "Basemap: Natural Earth" |

These strings live in `snapshot.sources` (written by the build) and the app prints them as
they are; change them in the fetchers under `scripts/shelf_atlas/`, not in the app. The credit
line in About, its first paragraph under *Sources and credits*, is built from the same sources
(`creditLine()` in `js/data.js`) and is shown whole; About opens from the stamp on every screen,
focus mode included:
`Natural Earth · Marine Regions CC BY · EMODnet CC BY · Sodir NLOD · NSTA · Danish Energy Agency · NLOG`.

The face: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.

The UK term is the one that matters: this app and its data may not be used commercially. The
repository's `LICENSE` carries the same carve-out.

## The files, and which ones change

```
data/geo.json        basemap, boundaries, field outlines, pipelines, facilities   1.4 MB   weekly build, rarely differs
data/snapshot.json   fields, monthly series, groups, sources, ask rows           1.7 MB   weekly build, differs every month
data/bathy.png       EMODnet depth raster, 8-bit gray in Web Mercator rows       0.5 MB   weekly build, almost never differs
index.html, style.css, app.js   the page, the house look, the map and the player
js/data.js           the data contract, the decode and the shape checks, the Peaks' records (pure)
js/units.js          every number, unit and date the app writes (pure)
js/track.js          the month track, the app's own slider
fonts/               the house face, ysabeau-office-gw.woff2, and its OFL.txt
tools/               check.mjs, test_decode.mjs, shoot.mjs, the palette script and DECISIONS.md; not shipped
```

The weekly build (`.github/workflows/build-shelf-atlas.yml`, Mondays, and on demand) commits
the three data files only when their content changed; a build whose sources did not move commits
nothing. **The phone's refresh loop replaces `data/snapshot.json` only**, like every other app
here. That is the file with the figures, so a phone that refreshes weekly sees each new month.
`geo.json` changes when a regulator adds or redraws a field, a few times a year: the app draws
the field as a point until the next ZIP replace brings the outline (see `PROMPT.md`). The stamp
says `Stale.` when `data/snapshot.json` is more than 10 days old (`STALE_DAYS` in `app.js`; the
build is weekly).

## The Peaks

In Rate, each field (or cross-border unit, as one) carries a 1 px ink ring at its best month
so far: the largest monthly rate the regulator reports for it, from its first month up to the
month on the player, drawn at the circles' own area scale (`17 px × √(best / top)`), so a
rising field fills its ring, a declining one sits small inside it and a stopped one leaves it
empty. The records are built once per data load, quantity and set of countries shown
(`bestRecords()` in `js/data.js`) and the month shown finds its record by binary search. What a
ring cannot show: a better month before its regulator's series starts (the Dutch series start
in January 2003, the UK series in June 1975); a Danish month before January 2018, which is the
year's total spread evenly; anything about reserves. Fields whose best month never reached
3.1 % of the scale's top get no ring (it would be under 3 px). A circle is never drawn under
3.2 px across so that a small producer stays in sight, except inside a ring, where it is drawn at
its true size however small, so a ring never looks fuller than the field is. A month a country has not
reported draws none of its fields' circles or rings, and a cross-border unit is never drawn
from one side. There is no ring in Cumulative. `tools/test_decode.mjs` checks every unit's
record against its own running maximum.

## Honesty notes the app carries

- The newest month is uneven: Denmark reports about a month earlier than Norway, the UK and
  the Netherlands about two months later. The player opens on the newest month every country
  has reported, play stops there, and the caption line names the countries missing beyond it.
- Danish field outlines are the Energy Agency's legal delineations drawn on block corners, not
  reservoir shapes; they are drawn dashed and unfilled and the details say so.
- Before 2018 the Danish monthly figures are annual totals spread evenly; the Dutch series
  start in 2003 and the UK series in June 1975. In cumulative mode the details say where each
  sum starts and flag fields whose earlier production is missing.
- Cross-border fields are grouped only where the split is published (`CROSS_BORDER` in
  `scripts/shelf_atlas/build_north_sea.py`); every other same-name match is listed in
  `snapshot.matching` and drawn separately.
- Norwegian names in `data/geo.json` (platforms, operators, pipelines) arrive as Sodir writes them,
  `ÅSGARD A`: the pipeline reads each shapefile's DBF in the encoding its `.cpg` declares (UTF-8 for
  Sodir's). Until 2026-10-02 it read every DBF as Latin-1, and 316 names arrived double-encoded,
  `Ã…SGARD A`. `repairText()` in `js/data.js` stays as a guard: it undoes that double encoding when
  the file is read, only for strings that carry the pattern and decode as UTF-8, and finds nothing to
  change in today's data (`tools/test_decode.mjs` checks both). The data file is not changed by the app.

## The look, the controls and the tests

The house system of the template (`ART.md`): one face, gray chrome, a caption band under the
map, the player with the app's own track, a focus mode (`Hide the controls` in the key column;
the corner key `Show the controls`, or Escape, brings them back; remembered as `sa.focus`),
SI first with the field units one press away on the units key, and Reduce Motion honored
(flights become cuts). Every stored key starts `sa.`.

`node tools/check.mjs` checks the rules and the budgets, `node tools/test_decode.mjs` the decode,
and `PLAYWRIGHT_MODULE=… node tools/shoot.mjs` drives the app in headless Chromium in both themes.

## Size

The ZIP is about 2.0 MB; the app parses 3.0 MB of JSON and decodes one PNG on open. The budgets:
`geo.json` and `snapshot.json` at most 2 500 000 B each and `bathy.png` at most 1 200 000 B,
enforced by the build, which fails rather than ship a bigger file; the app's code (`index.html`,
`style.css`, `app.js`, `js/`) at most 200 000 B, the fonts at most 160 000 B and the ZIP at most
2 413 130 B, enforced by `tools/check.mjs`.
