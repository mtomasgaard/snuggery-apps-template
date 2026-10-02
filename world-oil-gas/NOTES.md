# World Oil & Gas: what it shows, what it must say on screen, and what changes

Every country's oil and gas production from 1900 to the latest Energy Institute year, annual
or cumulative, as a choropleth with a year player; under the map, the year's world output as
shares (the Ledger, below); and 7 055 fields from Global Energy Monitor's Global Oil and Gas
Extraction Tracker that follow the same player (a ring from discovery, filled from first
production), sized by the reported rate, by an estimate that moves with the country's series, or
by remaining reserves. Find fields, companies, basins and countries; light up a company's or a
basin's fields; the tracker's own outlines appear at high zoom; a country's details list its
units against the national figure.

The sources and the reasoning are in **`shelf-atlas/RESEARCH.md`** sections 2.5 and 2.6 (the two
apps share one pipeline) and the running of it in **`shelf-atlas/HANDOFF.md`**; the data contract
is `scripts/shelf_atlas/SCHEMA.md` and its summary heads `js/data.js`. This file is the short
version. How the app looks, and why, is **`ART.md`**.

## What the app must print, and does

| Source | License | What the app prints |
| --- | --- | --- |
| Our World in Data, energy dataset (carrying the Energy Institute Statistical Review and The Shift Data Portal) | CC BY 4.0 | "Country production: Energy Institute Statistical Review of World Energy, via Our World in Data (CC BY 4.0)" |
| Global Energy Monitor, Global Oil and Gas Extraction Tracker, March 2026 | CC BY 4.0 | "Fields: Global Energy Monitor, Global Oil and Gas Extraction Tracker (CC BY 4.0)" |
| Natural Earth (1:10m countries, 1:10m bathymetry, Natural Earth I shaded relief) | public domain | "Basemap: Natural Earth" |

The credit line under the map is built from the same sources (`creditLine()` in `js/data.js`)
and is shown whole, in every mode, focus mode included:
`Sources: Energy Institute via Our World in Data · Natural Earth · Global Energy Monitor`.
About gives every source in full: its statement, its license with the license's address, the
changes made, and every address printed without its scheme. Keep both if you change the app.

The face: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.

## The files, and which ones change

```
data/snapshot.json   annual oil and gas by country, 1900 on, plus ask rows   0.15 MB   yearly build (1 July, 1 September)
data/world.json      countries, bathymetry bands, the relief block           1.2 MB    yearly build, rarely differs
data/relief.jpg      Natural Earth I shaded relief, 4096 × 2048 plate carrée 0.8 MB    yearly build, never differs
data/fields.json     the tracker's units, production, reserves, outlines     2.5 MB    by hand, when a new tracker release is dropped in
index.html, style.css, app.js   the page, the house look, the map, the Ledger and the player
js/data.js           the data contract, the shape checks, the series, the Ledger's partition, the field years and estimate (pure)
js/units.js          every number, unit and date the app writes (pure)
js/track.js          the year track, the app's own slider
fonts/               the house face, ysabeau-office-gw.woff2, and its OFL.txt
tools/               check.mjs, test_decode.mjs, shoot.mjs, the palette script and DECISIONS.md; not shipped
```

**The phone's refresh loop replaces `data/snapshot.json` only.** That is the yearly country
data, so a phone that refreshes at all sees each new Statistical Review. The fields, the
basemap and the relief travel in the ZIP and change when you replace the app (see
`PROMPT.md`). The tracker sits behind a form on GEM's site, so no job can fetch it: the March
2026 workbook is committed under `raw/manual/`, and the manual step for a newer release is in
`raw/manual/README.md`. The stamp says `Stale.` when `data/snapshot.json` is more than 400 days
old (`STALE_DAYS` in `app.js`; the build is yearly).

## The Ledger

Under the map, the full width of the caption band, one strip of ink: the world's oil and gas
(or oil, or gas) for the year on the player, one 10 px block per producing country, widest
first, each as wide as its figure over the world's (the snapshot's `world` series, OWID_WRL), and
every producer under 1 % together in a hatched end. In Cumulative each block is the country's
total from its first figure to the year shown. `ledgerAt()` in `js/data.js` computes it. A former
state (the USSR, Czechoslovakia, Yugoslavia) is replaced by its members in any year its largest
member (Russia, Czechia, Serbia) has a figure ("rule B"), so no barrel is counted twice; in
Cumulative its block is what it produced until then, labeled `USSR to 1984`. The counted sum is
98.14 % to 100.64 % of the world in every year and mode (after 2016 the source lists fewer
countries, so the hatched end also holds those it stopped listing); the strip is scaled to the
larger of the world's figure and that sum, so it never runs past its end. A chosen country's
block is traced under the strip. The Ledger says nothing about reserves, consumption or who
owns the fields. `tools/test_decode.mjs` checks it against a partition written in the test.

## Honesty notes the app carries

- The country figures are energy-equivalent barrels (Energy Institute convention); the
  tracker's per-field barrels are volumes. The country details say the tracker's share is
  indicative for that reason, and it can exceed 100 % (Norway about 127 %).
- The tracker gives one rate per field, for one data year, and no series. A field that moves
  with the player is an **estimate**: the reported rate scaled by its country's series, summed
  since first production in Cumulative. The card and the details say so and keep the reported
  figure beside it.
- Fields with no discovery or start year (1 748; 1 628 of them operating) appear, filled, the
  year before their data year, where the estimate starts (or in the newest year without one),
  never in every year; the layers' counts name them apart. 618 units with no coordinates are left
  out by the pipeline, and 1 021 are marked approximate by the tracker.
- The dissolved states (USSR, Czechoslovakia, Yugoslavia) keep their series under codes of
  their own and have no outline; their successor states are plain before their own series
  begin. A country's card names the former state its figure is in.
- Plain is plain: zero and "no figure" are both drawn as plain land, and the card says which.
  The map hatches nothing.
- In Cumulative a series that has ended keeps its total: 156 series stop in 2016 (the source
  lists fewer countries from 2017) and three former states in 1991 and 1992; France's total to
  2024 is its total to 2016, and its card says `with no figures after 2016`.

## Units

SI first: a new library opens on TWh/yr (PWh to date), the source's own unit, and the fields in
standard cubic meters (`Sm³/d` of oil or gas, `Sm³ o.e./d` together; 1 Sm³ = 6.2898 bbl, gas at
the tracker's 159 Sm³ per boe). One press on the units key gives kboe/d (Gboe to date) and the
tracker's barrels. A library that stored `kboe` keeps it. Every number, unit and date goes
through `js/units.js`: U+202F between a number and its unit and in thousands, the true minus,
dates built by hand, the same on every locale.

## Focus mode

`Hide the controls`, the last key on the map, leaves the plate, the Ledger, the caption line,
the credits, the stamp and the player; the header, the key column and the legend's bar go, hidden
and inert. `Show the controls` in the plate's top-right corner, or Escape, brings them back. It is
remembered as `wog.focus`.

## Size

Measured by `node tools/check.mjs`: the ZIP is about 2.15 MB (2 068 029 B before the house pass,
1 670 512 B before the 1:10m coast), against its cap of 2 622 870 B; the app parses 3.8 MB of JSON
on open, and decodes the relief only when Terrain shading is switched on. App code (the HTML, the
CSS, `app.js` and `js/`) is held to 200 000 B and `app.js` alone to 150 000 B, both enforced by
`tools/check.mjs`; `fields.json` (2.5 MB) to 2.6 MB and `world.json` (1 222 141 B) to 1.4 MB,
enforced by the build, which fails rather than ship over budget.

## The coast

The countries are Natural Earth **1:10m** (v5.1.2, pinned by commit and sha256 in
`scripts/shelf_atlas/build_world.py`), because the map zooms to 120 px a degree of longitude,
0.46 km a pixel at 60° N, where 1:50m had smoothed Norway's fjords into a few blunt inlets. They are
simplified for that zoom: a vertex is dropped while its triangle is under 4 square CSS pixels in Web
Mercator at the deepest zoom (`WORLD_MIN_PX2`), so the line moves by a pixel or two there and by
nothing visible anywhere else; 269 237 vertices in 4 240 rings. Holes are dropped, as before. 1:10m
has sixteen small features 1:50m did not, and `NE10_EXTRA` says what became of each: the leases,
the sovereign base areas, the U.N. buffer zone, Bir Tawil and Brazilian Island join Kazakhstan, Cuba,
Cyprus, Sudan and Brazil (the country that painted that ground at 1:50m, or the one Natural Earth's
own ISO code names); eight open-sea specks and
Gibraltar are left out, as they were at 1:50m; and the Southern Patagonian Ice Field, which 1:50m
split between Argentina and Chile, is its own plain outline (About lists it under "Outlines with no
series"). The shaded relief is still Natural Earth I at 1:50m, so with the relief on, its own water
edge does not follow the vector fjords. Label points are each country's centroid, so most moved a
little with the finer outline.
