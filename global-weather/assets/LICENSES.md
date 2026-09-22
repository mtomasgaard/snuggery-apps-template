# The two files in this folder, and what their licences require

These travel inside the app so the map can draw without going online. Neither is
ever rewritten by the refresh job — coastlines and cities do not change daily.
The app's *About this data* panel prints both credits, and the line under the
map carries the short form. Keep them: one of the two makes attribution a
condition, not a courtesy.

## `world.json` — coastlines and country borders

**Natural Earth, public domain.** Derived from Natural Earth 1:50 m cultural and
physical vectors, simplified and delta-encoded to a few hundred kilobytes.
Natural Earth's terms of use say:

> All versions of Natural Earth raster + vector map data found on this website
> are in the public domain. […] No permission is needed to use Natural Earth.
> Crediting the authors is unnecessary.

Credit is given anyway, in the form Natural Earth suggests — *Made with Natural
Earth* — because a map should say where its coastlines came from.

## `places.json` — about 1,600 city labels

**GeoNames, Creative Commons Attribution 4.0 International (CC BY 4.0).** The
GeoNames geographical database is published under that licence, and attribution
is a **condition** of using it:

> This work is licensed under a Creative Commons Attribution 4.0 License.

Source: <https://www.geonames.org/>. The licence itself:
<https://creativecommons.org/licenses/by/4.0/>. Both addresses are printed as
plain text in the app's *About this data* panel, because CC BY asks for the URI
of the licence where it is reasonable to give one — and are text only: a
mini-app cannot reach the network, and this one never tries.

CC BY 4.0 also disclaims warranties, and that travels with the data:

> Unless otherwise separately undertaken by the Licensor, to the extent
> possible, the Licensor offers the Licensed Material as-is and as-available,
> and makes no representations or warranties of any kind concerning the
> Licensed Material.

So: the coordinates are good enough to put a dot on a world map and nothing is
promised beyond that. Do not navigate by them.

The app satisfies the attribution condition in two places, and both should stay:

- the credit line at the bottom of the map — *GeoNames CC BY 4.0*;
- the *About this data* panel — *City labels: © GeoNames, CC BY 4.0*, with the
  two addresses above.

### Which places, and why these

The file is **not** all of GeoNames, and the tiers are not GeoNames' own. About
1,600 places were hand-picked for a wind map — capitals, big coastal cities,
island stations, the places a moving weather system gets talked about — and each
was given a tier by the author of this app, not by the source. The list leans
towards where the author looks; a map made by somebody in São Paulo or Lagos
would tier it differently, and should.

The file itself is a plain list of `{"n", "lon", "lat", "r"}` objects, where `r`
is the label tier (1 is shown first at world scale, 4 only when zoomed right
in). **Edit it freely** — add the places you look for, delete the ones you never
do, move a tier because your weather comes from a different direction. A
modified list is still GeoNames-derived data under the same licence, so the
credits stay either way.

## Nothing else is bundled

There is no font, no image, no map tile and no third-party JavaScript in this
app. The snapshot's compressed planes are unpacked with the browser's own
`DecompressionStream`, with a small decoder written out in full in `app.js` for
anything older — no minified blob, nothing to take on trust.

The wind itself is NOAA's, and its terms are in `../NOTES.md`.
