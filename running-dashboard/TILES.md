# Map tiles and routes in this demo

Two parts of the demo data are not ours to license, and the MIT licence at the root of this
repository does not cover them. Both travel inside `zips/running-dashboard.zip`.

## The tiles: USGS The National Map (public domain)

The tiles under `data/tiles/` — 30 of them, 0.8 MB, at zoom 12–13 — are from the US
Geological Survey's *USGS Topo* basemap, downloaded unmodified from
`basemap.nationalmap.gov`. They are a work of the United States government and in the public
domain, with no restrictions on use or redistribution. The USGS asks for this acknowledgment,
which the app prints under every map it draws with them:

> Map services and data available from U.S. Geological Survey, National Geospatial Program.

They cover the three US course segments below. The other three sessions draw their route on a
plain background: no free basemap outside the United States and Norway may be redistributed
inside a downloadable archive (OpenStreetMap's tile policy covers live fetching only, and
Kartverket's cache at these zooms shows partner data that needs permission to copy), and the demo
would rather show the app drawing without one than ship a tile it has no right to. Your own
copy fetches its own tiles for your own runs — Kartverket in Norway, USGS in the US,
OpenStreetMap elsewhere — and the app credits whichever drew.

## The routes: segments of six marathon courses (OpenStreetMap, ODbL)

The six session streams are **not** anyone's GPS traces. Each follows a segment of a famous
marathon course, cut from `scripts/demo_courses.json`:

| Session | Course | Segment |
| --- | --- | --- |
| Tuesday's easy run | Chicago Marathon | km 0–12.8 — Grant Park, the Loop and north through Lincoln Park |
| Sunday's long run | Boston Marathon | km 16–32 — Wellesley, the Newton hills, into Boston |
| Last week's tempo | New York City Marathon | km 26–35 — Long Island City, the Queensboro Bridge, First Avenue |
| The 24 km long run | Berlin Marathon | km 0–24 — the whole first half |
| The 10 km tune-up | London Marathon | km 0–10 — Blackheath to the river |
| An intervals day | Tokyo Marathon | km 8–21.8 — Nihonbashi to Asakusa and back |

The course shapes were derived from OpenStreetMap: Boston from the OSM route relation of the
course (11680552), the other five routed along OSM streets through hand-placed waypoints with
OSRM, so they are approximate — the streets between the points, not the certified course.
Elevations at each point are bare-earth terrain heights read through OpenTopoData's public API
from the Mapzen terrain merge — USGS NED in the United States (public domain), EU-DEM in Europe
(Copernicus, free with attribution), SRTM elsewhere (public domain). `scripts/make_demo_courses.py`
is the script that produced the file and states this provenance again.

Because the shapes are derived from OpenStreetMap data, `scripts/demo_courses.json` and the
demo streams made from it (`data/streams/demo-*.json` and the `streams` embedded in
`data/snapshot.json`) are a derivative database, © OpenStreetMap contributors, made available
under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Nothing
else in this repository is affected, and the first real pull of your own runs replaces every one
of these files.
