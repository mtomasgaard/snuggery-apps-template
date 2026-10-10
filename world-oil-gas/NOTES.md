# World Oil & Gas: what it shows, what it must say on screen, and what changes

Every country's oil and gas production from 1900 to the latest Energy Institute year, annual
or cumulative, as a choropleth with a year player; under the map, the year's world output as
shares (the Ledger, below); and 7 055 fields from Global Energy Monitor's Global Oil and Gas
Extraction Tracker as the tracker records them: a ring from discovery, filled from first
production, an unsized dot in every year, and sized only in Annual at the newest year, by the one
output figure the tracker reports for each (below). Find fields, companies, basins and countries; light up a company's or a
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
| Natural Earth (1:10m countries, Natural Earth I shaded relief) | public domain | "Basemap: Natural Earth" |
| GEBCO_2026 Grid (the sea floor of Depth shading) | public domain, with acknowledgement | "GEBCO Bathymetric Compilation Group 2026(2026). The GEBCO_2026 Grid - a continuous terrain model for oceans and land at 15 arc-second intervals. NERC EDS British Oceanographic Data Centre NOC. doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa" |

The credit line is built from the same sources (`creditLine()` in `js/data.js`) and is in About,
first under *Sources and credits*, one tap from the stamp in every mode, focus mode included:
`Sources: Energy Institute via Our World in Data · Natural Earth · Global Energy Monitor` (with
` · GEBCO` while Depth shading is on). About gives every source in full: its statement, its
license with the license's address, the changes made, and every address printed without its
scheme. Keep both if you change the app.

GEBCO's terms (www.gebco.net/data-products/gridded-bathymetry/terms-of-use, read on 2026-10-06),
word for word: *"The GEBCO Grid is placed in the public domain and may be used free of charge."*
Users are free to *"Commercially exploit The GEBCO Grid, by, for example, combining it with other
information, or by including it in their own product or application."* Users must *"Acknowledge
the source of The GEBCO Grid. A suitable form of attribution is given in the documentation that
accompanies The GEBCO Grid."*, *"Not use The GEBCO Grid in a way that suggests any official status
or that GEBCO, or the IHO or IOC, endorses any particular application of The GEBCO Grid."* and
*"Not mislead others or misrepresent The GEBCO Grid or its source."* The disclaimer: *"The GEBCO
Grid should NOT be used for navigation or for any other purpose involving safety at sea."* About
prints the attribution above, the first sentence of the terms, the changes this app made, that
GEBCO does not endorse it, and the disclaimer.

The face: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.

## The files, and which ones change

```
data/snapshot.json   annual oil and gas by country, 1900 on, plus ask rows   0.15 MB   yearly build (1 July, 1 September)
data/world.json      countries                                               1.0 MB    yearly build, rarely differs
data/shade.webp      the sea floor, 4096 × 2048 plate carrée, gray (GEBCO)   0.4 MB    tools/build_shade.py, by hand
data/shade/land.webp the relief on land, the same grid (Natural Earth I)     0.3 MB    tools/build_shade.py, by hand
data/shade/*.webp    the sea floor at 30 arc seconds, 17 tiles over seven    0.6 MB    tools/build_shade.py, by hand
                     oil and gas regions; data/shade.json names them         (3 kB)
data/fields.json     the tracker's units, production, reserves, outlines     2.5 MB    by hand, when a new tracker release is dropped in
index.html, style.css, app.js   the page, the house look, the map, the Ledger and the player
js/data.js           the data contract, the shape checks, the series, the Ledger's partition, the field years and the size rule (pure)
js/units.js          every number, unit and date the app writes (pure)
js/track.js          the year track, the app's own slider
fonts/               the house face, ysabeau-office-gw.woff2, and its OFL.txt
tools/               check.mjs, test_decode.mjs, shoot.mjs, build_shade.py, the palette script and DECISIONS.md; not shipped
```

**The phone's refresh loop replaces `data/snapshot.json` only.** That is the yearly country
data, so a phone that refreshes at all sees each new Statistical Review. The fields, the
basemap and the shading travel in the ZIP and change when you replace the app (see
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
- **No field estimates** (the owner's choice, plan 0012 D23, 2026-10-10). The tracker gives one
  output figure per field, for one data year (1975 to 2029 in the March 2026 release; 87 % of them
  2020 or later), and no series; open data measures only about 7 % of the world's oil and gas field
  by field, and the best estimate for the rest was still off by a factor of 1.8 for a typical
  field. So the year player moves the countries only. A field is sized only in Annual at the newest
  year, by its reported figure for the mode shown (`sizeOf()` in `js/data.js`); in every other year,
  and in Cumulative, it is a dot of one size, and the app draws no field history and no field
  total. The card gives the reported figure with its data year (`Reported for 2024: …`) whatever
  year the player shows; a data year from the release's own year on (6 units in the 2026 release,
  Wafra's 2028 among them) is a year not yet over when the figure was given, so its card says
  `Given for 2028, a year not yet over at the tracker's 2026 release: …`, and About counts them. Shelf Atlas is the place for the North Sea's fields measured through time.
- Fields with no discovery or start year (1 748; 1 628 of them operating) appear, filled, the
  year before their data year (or in the newest year without one),
  never in every year; the layers' counts name them apart. 618 units with no coordinates are left
  out by the pipeline, and 1 021 are marked approximate by the tracker.
- The dissolved states (USSR, Czechoslovakia, Yugoslavia) keep their series under codes of
  their own and have no outline of their own. In any year a former state has a figure and its
  largest member (Russia, Czechia, Serbia) has none, the map draws its successor states that
  report nothing of their own that year (no figure, or zero) together as one shape in its color,
  with no border inside it, named once by its own name; a tap there opens the former state's card
  (`The USSR`), in Annual and Cumulative alike. Once the largest member's series begins (Russia in
  1985, Czechia in 1993, Serbia in 1992) each successor is drawn by its own figure, so no year
  shows a former state over a member that reports. The Ledger keeps rule B (below), and a
  successor's own card names the former state it was drawn with. `formerUnions()` in `js/data.js`
  is the rule; `tools/test_decode.mjs` and `tools/shoot.mjs` check it in 1970 and 1995.
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

`Hide the controls`, the last key on the map, leaves the plate, the Ledger, the caption line
and its key, the stamp and the player; the header, the key column and the legend's bar go, hidden
and inert. `Show the controls` in the plate's top-right corner, or Escape, brings them back. It is
remembered as `wog.focus`.

## Size

Measured by `node tools/check.mjs`: the ZIP is about 2.46 MB (2 457 404 B at 1.2, 2 147 335 B before the shading,
2 068 029 B before the house pass, 1 670 512 B before the 1:10m coast), against its cap of
2 622 870 B; the app parses 3.6 MB of JSON on open, and reads the shading only when Terrain or
Depth shading is switched on, each image only for its own key: the whole-world level (32 MiB
decoded for each key that is on), then, for Depth shading past its detail, the tiles in view, at most four tiles' worth (16 MiB each) decoded at once. App code (the HTML, the
CSS, `app.js` and `js/`, 205 743 B at 1.3) is held to 207 000 B (the lead's ruling on the measured figure, plan 0012 3.2) and
`app.js` alone to 150 000 B, both enforced by
`tools/check.mjs`; `fields.json` (2.5 MB) to 2.6 MB and `world.json` (970 387 B) to 1.4 MB,
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
series"). Label points are each country's centroid, so most moved a little with the finer outline.

## The shading

`tools/build_shade.py` (run from `Template/` with numpy and Pillow) writes `data/shade.webp`,
`data/shade/` (the land's image and the tiles) and `data/shade.json`, and with `--strip-world` takes the old depth bands and relief
block out of `data/world.json`. Its inputs are pinned: the GEBCO_2026 subsets (fetched over
CEDA's THREDDS service) by the SHA-256 of their elevation values, Natural Earth I's zip by its own.
The land's image is Natural Earth I's relief at 1:50m as luminance, cut to the countries' 1:10m
rings; the sea's is GEBCO_2026, darker with depth (square root to 11 000 m) and hillshaded
(the sun in the northwest at 45°, the floor exaggerated eight times), at 4 096 × 2 048 for the
world and 30 arc seconds over the North Sea and the Norwegian shelf, the Gulf of Mexico, the
Persian Gulf, West Africa, Brazil's margin, the South China Sea and the Caspian. The Caspian's
depth is taken from sea level, so its tones run about 28 m deep; its shading is unaffected. Each
image carries its own half four pixels past the coast, so the browser's smoothing never blends the
land's luminance into the sea, and each tile's outer 128 pixels (about a degree) ramp into the
whole-world level's own values, so a region has no edge on the map (the build reports how far the
decoded edge strays: 0.4 of 255 on average, 10 at most).
`tools/check.mjs` pins the output; the same inputs and the same Pillow and libwebp (named in
`data/shade.json`) give the same bytes. The yearly data build (`build_world.py`) must not write
the depth bands or `data/relief.jpg` back: `check.mjs` fails if it does.
