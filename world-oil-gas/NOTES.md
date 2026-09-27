# World Oil & Gas — what it shows, what it must say on screen, and what changes

Every country's oil and gas production from 1900 to the latest Energy Institute year, annual
or cumulative, as a choropleth with a year player; and 7,055 fields from Global Energy
Monitor's Global Oil and Gas Extraction Tracker that follow the same player — a ring from
discovery, filled from first production — sized by the latest reported rate, by an estimate
that moves with the country's series, or by remaining reserves. Search fields, companies,
basins and countries; light up a company's or a basin's fields; the tracker's own outlines
appear at high zoom; a country's sheet lists its units against the national figure.

The sources and the reasoning are in **`shelf-atlas/RESEARCH.md`** §2.5–2.6 (the two apps share
one pipeline) and the running of it in **`shelf-atlas/HANDOFF.md`**; the data contract is
`scripts/shelf_atlas/SCHEMA.md`. This file is the short version.

## What the app must print, and does

| Source | Licence | What the app prints |
| --- | --- | --- |
| Our World in Data, energy dataset (carrying the Energy Institute Statistical Review and The Shift Data Portal) | CC BY 4.0 | "Country production: Energy Institute Statistical Review of World Energy, via Our World in Data (CC BY 4.0)" |
| Global Energy Monitor, Global Oil and Gas Extraction Tracker, March 2026 | CC BY 4.0 | "Fields: Global Energy Monitor, Global Oil and Gas Extraction Tracker (CC BY 4.0)" |
| Natural Earth (1:50m countries, 1:10m bathymetry, Natural Earth I shaded relief) | public domain | "Basemap: Natural Earth" |

The credits line on the map is one short line that opens the About screen, where the full
attributions, licence links and a "changes made" line live. Keep both if you change the app.

## The files, and which ones change

```
data/snapshot.json   annual oil and gas by country, 1900 →, plus ask rows   0.15 MB   yearly build (1 July, 1 September), differs once a year
data/world.json      countries, bathymetry bands, the relief block           0.6 MB    yearly build, rarely differs
data/relief.jpg      Natural Earth I shaded relief, 4096×2048 plate carrée   0.8 MB    yearly build, never differs
data/fields.json     the tracker's units, production, reserves, outlines     2.5 MB    by hand, when a new tracker release is dropped in
```

**The phone's refresh loop replaces `data/snapshot.json` only.** That is the yearly country
data, so a phone that refreshes at all sees each new Statistical Review. The fields, the
basemap and the relief travel in the ZIP and change when you replace the app (see
`PROMPT.md`). The tracker sits behind a form on GEM's site, so no job can fetch it: the March
2026 workbook is committed under `raw/manual/`, and the manual step for a newer release is in
`raw/manual/README.md`.

## Honesty notes the app carries

- The country figures are energy-equivalent barrels (Energy Institute convention); the
  tracker's per-field barrels are volumes. The country sheet says the tracker's share is
  indicative for that reason, and it can exceed 100 % (Norway ≈ 127 %).
- The tracker gives one rate per field, for one data year, and no series. A field that moves
  with the player is an **estimate**: the latest rate scaled by its country's series, summed
  since first production in cumulative mode. The legend and the field sheet say so and keep
  the reported figure beside it.
- Fields with no discovery or start year (1,748) are always drawn and left out of the
  "discovered by" count; 618 units with no coordinates are left out entirely, and 1,021 are
  marked approximate by the tracker.
- The dissolved states (USSR, Czechoslovakia, Yugoslavia) keep their series under codes of
  their own and have no outline; their successor states are plain before their own series
  begin.

## Size

The ZIP is about 1.7 MB; the app parses 3.3 MB of JSON and decodes one JPEG on open. `app.js`
is 130 KB against a 150 KB budget, `fields.json` 2.5 MB against 2.6 MB, `world.json` 0.6 MB
against 1.4 MB; the build fails rather than ship over budget.
