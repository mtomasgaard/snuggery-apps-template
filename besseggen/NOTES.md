# Besseggen

An offline 3D terrain viewer for the Besseggen ridge in Jotunheimen, built from Kartverket's open
data and running entirely inside Snuggery's sandboxed web view. Real elevation, the marked trail,
real solar geometry and real terrain shadows, a walking-time profile, viewsheds and named peaks.

**It is not a navigation tool.** It has no position fix, no compass and no live weather. Besseggen
is exposed and the weather turns fast — carry a map and compass and check conditions before you go.

---

## What is in the folder

```
index.html, app.js, styles.css     the app; index.html at the folder root
js/                                the app's ES modules
miniapp.json                       Snuggery's name, entry point and version
CREDITS.txt                        every dataset, its license and its attribution
data/                              terrain binaries, the manifest, GeoJSON, editable JSON
vendor/                            three.js r186 (MIT)
fonts/                             the template's house face, Ysabeau Office, with fonts/OFL.txt
tools/                             the data pipeline (build_all.sh and six numbered steps), the art
                                   pass's palette script, and the checks: check.mjs, test_decode.mjs,
                                   shoot.mjs (the ZIP leaves tools/ out)
ART.md                             the look: the house system and this app's signature, the Burn
.gitignore, .gitattributes
```

It has to be served over HTTP. Opening `index.html` from disk looks broken, because a browser
blocks `fetch()` of `file://` URLs and every byte of terrain arrives that way.

```
python3 -m http.server 8000          # then open http://localhost:8000/
```

---

## Code map

`app.js` wires the pieces together and owns the render scheduler — a frame is scheduled when
something changed, and the scheduler stops as soon as nothing is animating. Everything else is in
`js/`:

| File | Owns |
| --- | --- |
| `terrain.js` | the tile store and the level-of-detail quadtree |
| `material.js` | the shading shader: hillshade, slope, elevation bands, contours |
| `sun.js` | solar position, the day's events, cast shadows, direct sun on a point through a day |
| `analysis.js` | viewshed, line of sight, visible peaks, measurement |
| `route.js` | the walk, both directions, and the walking-time models |
| `profile.js` | the elevation strip in the controls sheet, and the label layout that keeps it legible |
| `camera.js` | orbit, saved viewpoints, first person, the fly-through, the zoom step, `prefers-reduced-motion` |
| `focus.js` | focus mode: the chrome hidden and inert, the ghost key, remembered between launches |
| `track.js` | the player's time track, drawn as the Burn |
| `units.js` | every number, unit, date and time the app writes (SI, U+202F, the true minus, Norwegian time) |
| `plate.js` | the plate's marks and the Burn's ink, pasted from `tools/art/palette.py --json` |
| `overlays.js` | the trail, lakes, glaciers, rivers and the masks they are drawn with |
| `data.js` | loading, and re-reading the editable files when the app regains focus |
| `geo.js` | coordinates: the UTM inverse and the scene frame |
| `util.js` | the `localStorage` wrapper and small shared helpers |

---

## The look, and the Burn

The app is on the template's house system (`Template/HOUSE.md`); `ART.md` is its direction, and
`tools/DECISIONS.md` the owner calls and the record of the pass. One face (Ysabeau Office), gray
chrome, the caption band under the plate (north and the scale bar, a legend row for each layer read
through a color, the caption, the credits), the player with its own track, focus mode, SI.

**The plate keeps one daylight appearance in both themes.** The terrain is drawn from
`data/colors.json`'s light block whatever the phone's theme; a dark version turned the lit faces dark
and the contours into a white wireframe. The file's dark block is read for one thing: the profile's
steep red, which sits on the dark chrome. The trail, the marker's stick and the tool line are drawn
on a pale casing (the trail's red is 1.00:1 bare on the ground it falls to, 4.20:1 on the casing).

**The Burn** is the player's time track drawn as a sunshine recorder's card for the point under the
marker: the sun's arc for the day at 0.4 px a degree of apparent altitude (a 30° tick prints the
scale), inked wherever the terrain leaves the marker in direct sun, an outline only where the sun is
up but a ridge hides it. It comes from `directSunWindow` in `js/sun.js`: every 2 minutes a ray march
toward the sun over the 16 m grid and the 64 m horizon ring, from 0.5 m above the ground (never below
the 16 m surface, which at a col can stand above the 2 m point: at Bandet on 20 September that put
first sun ten minutes late). About 1 ms a point and day, so it is recomputed whenever the marker or
the date moves, never per hour. The caption says it in words, with its times. It is terrain shadow
only: no cloud, no haze, the sun a point.

**The time.** The track holds one day in 288 five-minute steps. Dragging it, the day keys and the
date slider only record what they want; the next frame computes the sun and sweeps the cast shadows
for that instant, then draws, so the light, the shadows and every word about the time always show
the same step (the stock app debounced the shadow sweep by 170 ms, so while dragging the light and
the shadows showed different times). Play runs the day at an hour a second, in whole hours under
Reduce Motion.

## Focus mode

**Hide the controls** (the key column's last key), the **F key** or a **double-tap on the view**
hides the header, the keys, the legend rows and the controls sheet, each `hidden` and `inert`; the
plate, the stamp (moved into the caption band), north and the scale, the caption, the credits and
the player stay. The ghost key at the plate's top right, **Show the controls**, Escape, F or a
double-tap bring them back. It is remembered between launches (`besseggen:focus`); the ghost key is
the answer to the stock app's reason for forgetting it. While an analysis tool is waiting for points
the double-tap stands down: two quick taps near one spot is somebody correcting a pick. The double-tap
is timed by the events' own timestamps, so a busy frame does not stretch it.

On a wide screen, or a phone on its side, the sheet is a column at the right, and focus mode takes
it away.

---

## The data

Everything under `data/` is generated by `tools/`, from four Kartverket datasets. Licenses and
attribution are in `CREDITS.txt`; the same text, editable, is in `data/about.json`.

| Layer | Source | License |
| --- | --- | --- |
| Terrain | Nasjonal høydemodell DTM1 (1 m), through the `hoyde-dtm-nhm-25833` WCS | NLOD 2.0 / CC BY 4.0 |
| Trail | Turrutebasen (Tur- og friluftsruter), WFS | Open data, no conditions |
| Lakes, rivers, glaciers | N50 Kartdata, kommunes 3434 Lom and 3435 Vågå | CC BY 4.0 |
| Place names | SSR (Sentralt stedsnavnregister), REST | CC BY 4.0 |

All four were retrieved on 2026-09-22. Kartverket's topographic raster map tiles were **not** used:
nothing in the license records read that day says in terms that the tiles may be pre-cached for
offline use, so they were left out rather than shipped on a guess. The hillshade, slope shading,
elevation banding and contours are generated from the elevation data instead.

### Coordinates

Everything on disk is in **EPSG:25833** (ETRS89 / UTM zone 33N) — the projection the sources use —
in absolute meters. The app converts once at load into scene meters relative to
`manifest.origin` (166144, 6835072), in float64 before anything is written into a `Float32Array`:
northings here are 6.8 × 10⁶, which in float32 is a 0.5 m quantum, and subtracting the origin first
is the difference between a terrain that looks right and one that shimmers.

The GeoJSON files therefore carry **EPSG:25833 coordinates and the pre-RFC-7946 `crs` member**.
That is a deliberate deviation from RFC 7946, which requires WGS84: these files are read by one app
that works in 25833 throughout, and reprojecting on disk and back at load would be work with
nothing to show for it. It is one line in `tools/05_vectors.py` and a transform at load to change
it back.

`manifest.wgs84` carries the projection parameters and nine checkpoints computed with pyproj, so
the app's own thirty-line inverse can be checked at startup rather than trusted. Measured against
those checkpoints, the app's inverse is within **5.1 mm**.

### Two boxes

| Box | x (25833) | y (25833) | Size |
| --- | --- | --- | --- |
| **core** | 155904 … 176384 | 6826880 … 6843264 | 20480 × 16384 m |
| **shell** | 139520 … 192768 | 6810496 … 6859648 | 53248 × 49152 m |

The core is the brief's working box pushed out to the nearest clean tile boundary; the whole walk
sits inside it with about 5 km to spare at each end. The shell is a 16 km coarse ring around it,
and it exists because the horizon is a different problem from the route: from Veslfjellet, with the
core alone, 85 of 180 azimuths lose more than a quarter of a degree of skyline and the worst loses
3.7°. The shell costs 1.3 MB and brings the mean loss to 0.09°.

### Levels

A quadtree, **level 0 coarsest**. Every tile is 64 × 64 cells stored as **65 × 65 samples** — the
edge row and column are shared with the neighbor and stored in both, which is what lets the app
rebuild a flat analysis grid from the tiles it has already downloaded.

| Level | Cell | Tile span | Region | Tiles | Bytes |
| --- | --- | --- | --- | --- | --- |
| 0 | 64 m | 4096 m | shell, including over the core | 156 / 156 | 1 318 200 |
| 1 | 32 m | 2048 m | core | 80 / 80 | 676 000 |
| 2 | 16 m | 1024 m | core | 320 / 320 | 2 704 000 |
| 3 | 8 m | 512 m | route + 4 km, viewpoints + 4 km | 660 / 1280 | 5 577 000 |
| 4 | 4 m | 256 m | route + 800 m, viewpoints + 1 km | 526 / 5120 | 4 444 700 |
| 5 | 2 m | 128 m | route + 400 m, viewpoints + 600 m | 1048 / 20480 | 8 855 600 |
| | | | | **2790** | **23 575 500** |

A tile exists at level *n* if its square intersects that level's region **and** its parent exists.
The regions are the union of a buffer around the 25 m route samples and a buffer around each of the
six viewpoint anchors, and they are recorded in `manifest.corridor` so the app never recomputes
them.

### One master grid

Every level of the core is a local decimation of **one** fetched 2 m grid, 10241 × 8193 samples,
downloaded in 18 requests of about 1707 × 2731. This is not an optimization. Asking the service for
a coarser grid does not give a decimation of its finer one — it serves coarse requests from its own
pyramids, which differ from a local decimation by an RMSE of 1.6 m at 4 m and 4.6 m at 8 m, with
peaks over 60 m. Fetching each level at its own resolution would put a step of meters, and tens of
meters on the ridges, at every level-of-detail seam.

The decimation is a separable `[1,2,1]/4` binomial low-pass with edge clamping followed by taking
every second sample — the correct halving for a **point** grid, where a box mean would land half a
cell off the coarser grid. It is applied to the whole array before tiles are cut, which is what
makes a sample on a tile border come out bit-identical in both of the tiles that hold it. The 2 m
master is 84 million samples, so `tools/geom.py` does it in row bands with a one-row halo; the
banded result is bit-identical to halving the whole array, and `geom.halve_banded`'s docstring says
why.

Requesting the grid needs one piece of care that cost an hour to find: **format the bbox as plain
decimal, never `%g`**. A northing of 6 810 464 in `%g` becomes `6.81046e+06`, four meters away, and
the service cheerfully returns the wrong two rows of terrain with a georeference that admits it
only if you check. `tools/01_fetch_terrain.py` asserts the returned transform, size and CRS on
every block.

### The horizon ring, and the only blend

The shell is fetched separately at 64 m — there is no 2 m master 16 km out, and fetching one would
cost 3.4 GB. The core's own 64 m decimation is a subset of the shell's grid, so the pipeline
computes the difference over the core, extends it outward by nearest-edge replication, ramps it to
zero over 512 m and adds it. Inside the core the shell is then replaced by the core exactly, so
level 0 and level 1 agree to the decimeter at the boundary — the only place a level-0 tile is ever
drawn next to a finer one.

Measured on the real data: over the core the difference between our decimation and the service's
own 64 m product has an RMS of 1.74 m and a maximum of 43.5 m. **On the core boundary, which is
where the join is actually seen, the RMS is 3.34 m, the 95th percentile 6.72 m and the maximum
20.7 m** — spread over the 512 m ramp, a worst-case added slope of 4 %.

### Quantization

Heights live as **integer decimeters** from the moment they arrive until they are decoded, which is
what makes the whole pipeline exactly reproducible. Per tile:

```
dmin = min(d)   dmax = max(d)                          integers, decimeters
q    = round((d - dmin) * 65535 / (dmax - dmin))        0 if dmax == dmin
```

and the decode, which the app must do in this order:

```
scale    = (dmax - dmin) / 65535
z_dm     = dmin + round(q * scale)                      integer decimeters
z_metres = z_dm * 0.1
```

**Round to the integer decimeter before dividing.** Decoding as `zmin + q * scale_metres` looks
equivalent and is not: two tiles that share an edge have different `dmin`/`dmax`, so the un-rounded
value lands up to half a decimeter apart on each side, and the two properties the app relies on —
crack-free same-level joins, and a flat analysis grid that is bit-identical to what the pipeline
decimated — both become false. `tools/verify_data.py` decodes every tile the way the app does and
asserts a worst shared-edge difference of exactly **0**.

The round trip is lossless because no tile's relief approaches 65535 decimeters; the whole model
spans 18 965.

### The binary

No header. A level file is its tiles concatenated in the order the manifest lists them, each
exactly 8450 bytes: **uint16, little-endian, 65 × 65 samples, row-major, row 0 the tile's northern
edge and column 0 its western**. Offsets are multiples of 8450, so `new Uint16Array(buf, tile.o,
4225)` is always aligned. Sample `(r, c)` of tile `(tx, ty)` at a level with cell size `res` and
span `S = 64·res` is the height at `x = gridX0 + tx·S + c·res`, `y = gridY0 + (ty+1)·S − r·res`;
`ty` counts north, so tile `(0,0)` is the south-west one.

A tile entry in the manifest is five numbers — `tx`, `ty`, `o`, `dmin`, `dmax`. Bounds are derived
from one formula rather than repeated, so there is no way for two copies to disagree.

### The walk

The Besseggen route **is not labeled "Besseggen" in Turrutebasen**. The segments that make it up
carry `rutenavn` values of `Ukjent` and `Historisk vandrerute i Jotunheimen`, so the pipeline
assembles it by shortest path across a graph of the 84 marked foot-route segments in the box
(endpoints snapped to 2 m), from the node nearest Gjendesheim to the node nearest Memurubu. The
four connecting routes *are* named, and are taken by name.

Measured on the real data:

| | Value |
| --- | --- |
| Graph path Gjendesheim → Memurubu | **13.689 km**, 13 segments, 1661 raw vertices |
| Resampled at 25 m | 548 samples, last at 13.675 km |
| Start node from the SSR Gjendesheim point | 41 m |
| End node from the SSR Memurubu point | 14 m |
| High point | **1741 m at km 5.00** (Veslfjellet) |
| **Ascent, 25 m samples, 3-sample box** | **1083 m** (descent 1072 m) |
| Ascent, 25 m samples, no smoothing | 1154 m |
| Ascent, at the source's own 4.7 m vertex spacing | 1196 m |

The last two are in `route.geojson` and in the About panel on purpose. A 1 m elevation model read
at its own vertex spacing counts boulder noise as climbing; 25 m sampling with a three-tap smooth
is the honest figure, and presenting it without saying what the smoothing did would not be.

The chain through the 25 m samples measures 13.459 km, shorter than the 13.675 km of path it was
resampled from, because a chord cuts the corner an arc goes round. That is why `cumM` is shipped:
distances along the walk come from `cumM`, never from summing the coordinates.

### Files

| File | Bytes | What it is |
| --- | --- | --- |
| `manifest.json` | 171 839 | the terrain index: boxes, levels, 2790 tiles, corridor, projection |
| `terrain-L0.bin` | 1 318 200 | 156 tiles, 64 m, the horizon ring |
| `terrain-L1.bin` | 676 000 | 80 tiles, 32 m |
| `terrain-L2.bin` | 2 704 000 | 320 tiles, 16 m — also the app's 1281 × 1025 analysis grid |
| `terrain-L3.bin` | 5 577 000 | 660 tiles, 8 m |
| `terrain-L4.bin` | 4 444 700 | 526 tiles, 4 m |
| `terrain-L5.bin` | 8 855 600 | 1048 tiles, 2 m, the corridor along the route |
| `route.geojson` | 174 705 | the walk, four connectors, km marks, waypoint indices, `cumM` |
| `places.geojson` | 70 625 | 188 SSR names with kind, height and local relief over 1 and 2 km |
| `water.geojson` | 231 395 | 284 lakes at the water surface the lidar reads |
| `glaciers.geojson` | 52 286 | 29 snow and ice polygons |
| `rivers.geojson` | 435 267 | 812 watercourses |
| `waypoints.json` ✎ | 3 349 | the six named points, with a sentence each |
| `viewpoints.json` ✎ | 2 303 | seven saved cameras; six of them are the corridor anchors |
| `pace.json` ✎ | 580 | Tobler and Naismith-with-Langmuir, and a fitness factor |
| `colors.json` ✎ | 1 115 | the layer palette, light and dark, and the elevation bands |
| `about.json` ✎ | 3 199 | sources, licenses, dates and the honesty text |
| **data/** | **24 722 163** | **23.58 MiB** |

✎ = a person is expected to edit it. The app re-reads exactly those five when it regains focus,
so an edit made inside Snuggery shows up without a reload.

### The editable files

`waypoints.json` pins each waypoint to a point **on the route** — `x`, `y`, `elevM` and the index
`i` into `route.geojson` — so a marker always sits on the trail, and keeps the place-name
register's own point beside it as `ssrX`/`ssrY`. For Bandet the two are 263 m apart on the
ground and 267 m apart in height: SSR puts "Bandet" on the slope above Gjende at 1124 m, while
the path crosses the neck at 1391 m. The **corridor anchors follow the route, not the register**,
for the same reason — an earlier build put the saved camera called "From Bandet" on SSR's point,
263 m from and 268 m below the Bandet the app's own marker shows, and `verify_data.py` now fails
the build if an anchor named after a waypoint is more than 100 m from it.

`viewpoints.json` holds seven cameras. **Six of them are also the anchors the fine levels of
terrain are built around** (`manifest.corridor.anchors`), and `tools/verify_data.py` asserts the
two lists are identical — move one and the camera would stand outside its own high-resolution
patch. `headingDeg` is degrees clockwise from true north; `pitchDeg` is degrees above the horizon;
`aboveGround` decides whether `eyeM` is added to the terrain or is an absolute elevation.

**There is no boat timetable in this app, deliberately.** It is the one thing in the brief that
could not be built honestly: the MS Gjende timetable changes every season, has no open source with
a license and a date, and would have shipped as an unverified placeholder for a boat people plan a
mountain day around. No `data/` file holds one and nothing in the app shows a departure;
`about.json` carries one sentence saying most people take the boat one way and that the current
timetable should be checked with the operator. `tools/verify_data.py` fails the build if a
timetable file reappears or if that sentence ever grows a time or a link.

---

## Rebuilding

```
./tools/build_all.sh
```

Six steps, run in order, each of which can be run on its own:

| Step | Does |
| --- | --- |
| `01_fetch_terrain.py` | 19 requests to the DTM1 service; assembles the 2 m core and 64 m shell masters |
| `02_fetch_vectors.py` | the trail WFS, 20 SSR discs; checks the N50 zips are in the cache |
| `03_route.py` | the graph, the shortest path, the 25 m resample, the four connectors |
| `04_terrain.py` | the decimation chain, the shell blend, the tiles, `manifest.json` |
| `05_vectors.py` | the five GeoJSON layers, with heights sampled from the terrain |
| `06_editable.py` | the five editable files, with every number derived from the build |
| `verify_data.py` | 44 checks that the shipped data has the properties the app assumes |

The first run downloads about **365 MB** into a gitignored cache — 18 × 20 MB of 2 m terrain, a
3 MB shell, 466 kB of trail GML and 20 small SSR responses — and takes a few minutes, most of it
waiting on the elevation service. Every later run reads the cache and touches the network not at
all; a warm rebuild takes about fifteen seconds. The N50 downloads are ordered through the Geonorge
download API, whose order references expire; the exact request body is the pin, and
`02_fetch_vectors.py` says so if the zips are missing. The body that worked on 2026-10-01, without
an account (`POST https://nedlasting.geonorge.no/api/order`, JSON; the answer lists one download
address per zip, and both go in the cache's `n50/`):

```
{"email": null, "orderLines": [{"metadataUuid": "ea192681-d039-42ec-b1bc-f3ce04c189ac",
  "areas": [{"code": "3434", "type": "kommune", "name": "Lom"}, {"code": "3435", "type": "kommune", "name": "Vågå"}],
  "projections": [{"code": "25833"}], "formats": [{"name": "GML"}]}]}
```

That day the first run downloaded 367.4 MB in 40 files besides the two zips (36.7 MB) and took
160 s, the venv's own installation included; a warm rebuild took 8 s.

The face is Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a
subset is in fonts/ with its license. `fonts/ysabeau-office-gw.woff2` and `fonts/OFL.txt` are the
template's house files byte for byte (sha256 `fdf1a28c…cdb262` and `d1adfffd…be6269`, pinned by
`tools/check.mjs`); `OFL.txt` carries the face's copyright line and says how the subset was cut.

`tools/package_snuggery.py` writes `dist/besseggen.zip` for import into Snuggery. It checks the
import limits first, and it refuses to package if `http://` or `https://` appears anywhere in
`index.html`, `styles.css` or the app's own JavaScript — Snuggery blocks every network request, so
a URL there is a bug, not a nicety. License links live in `CREDITS.txt`, this README and
`data/about.json`, which are not scanned.

### Determinism

A clean rebuild reproduces every shipped file byte for byte. Proved, not asserted: `data/` and the
pipeline's intermediates were deleted and the whole thing rebuilt twice.

```
$ W=$(python -c 'import sys;sys.path.insert(0,"tools");from paths import WORK;print(WORK)')
$ rm -rf data "$W" && ./tools/build_all.sh && shasum -a 256 data/* | sort -k2 > /tmp/run1.sha
$ rm -rf data "$W" && ./tools/build_all.sh && shasum -a 256 data/* | sort -k2 > /tmp/run2.sha
$ diff -q /tmp/run1.sha /tmp/run2.sha && echo identical
identical
```

Run again on a later day, on a machine that had only the download cache and no `data/` at all, it
reproduced sixteen of the seventeen hashes below exactly; the seventeenth, `pace.json`, differed
because its source had been corrected in `tools/06_editable.py` between the runs. A third run with
`OUT_DATA` and `WORK_DIR` pointed somewhere else entirely reproduced all seventeen again. A warm
rebuild takes about eight seconds, so this is a check worth running rather than trusting.

```
df7368bc874a8e11b8d3eb33b0bad8f43f2df208ed6e57fefe4563d7f47d5813  data/about.json
66ef3f5566cd5093ec4f3ec465c58c250c19902983dbff7441b1442e6ab08d7c  data/colors.json
9f6dc7dc233c75f97b0dcaff3efc240ea15e8c79b9156114e5b005e272bb011b  data/glaciers.geojson
40e2807ecba4392d77669ed5a2fe959e160868fc2f8f8276a327bd64786dd751  data/manifest.json
9324bce7b911c37192be67bb2cbd2f9c00cf2059ce2ff7c2cf6c5eaecbc5cb7b  data/pace.json
110e0e2a47ac214e8828b23a60dc197bbd461ce2b9498eafc49b93ddd62f900e  data/places.geojson
211d4e6299ab61709a63c07526a250f830151760e3ec68af9095af97abb66dbd  data/rivers.geojson
86d5e9bf7852ec072c872ae6ebf9024fab7f82f2e17f2f5172b6c5553d64e6d5  data/route.geojson
6381f5e086b1c6618a8888edb13489f79ee63719deda201a354e66ca01cfc523  data/terrain-L0.bin
fe9afa39e5748f8091ee2d40634496b9a9e44f6a80fff5df470bce1d4a190f85  data/terrain-L1.bin
e4edc0757077a5aad6d44f77288855532861f527aaf7fdbc19fdb0c7793b4bea  data/terrain-L2.bin
da6f003063aeb1fbe9bca71df3105d387e9456a821bb6b86488733c2a97bfc4b  data/terrain-L3.bin
11db80a0d6c530792742600ced64d88a95d4ef8957045aa4f54c1f0c3d3af5c7  data/terrain-L4.bin
e731e50e6e6eaa89e3d6b3ab5d322605a4f59b177054383f45761c2a1ad5a944  data/terrain-L5.bin
7486141e889be676910a40edb639dee165cec9618213876cc99212af35283dee  data/viewpoints.json
7dfa09596aebcfdd60be9cc7771dd4c89b0cf19bcca1aafabcc0fef2ff8b5f16  data/water.geojson
d64cb0970a97093cdfe2a197f8091ae09c28ccc134ecccd86ff200889c57a77e  data/waypoints.json
```

Together, `find data -type f | sort | xargs shasum -a 256 | shasum -a 256` gives
`97d6b944924f5c1d557ffed80043554d5aa5cfeb0433d23bf78de1d024652cd3`, which `tools/check.mjs` pins
with each line above.

**The rebuild of 2026-10-01** (the house pass's follow-up) went through `build_all.sh` twice, with
`OUT_DATA` in a scratch folder. With the scripts as they were, from an empty cache, it reproduced
sixteen of the seventeen files above as they then stood; the seventeenth, `places.geojson`, gained
one name the register added after 22 September (Besstrond, a summer farm, stedsnummer 435855), so
the shipped file, built from the register as it was that day, was kept. Then `06_editable.py`'s
prose was swept to US English and two data colors changed (the 40° slope class, which had the
trail's own red, and the middle elevation bands, too close to tell apart), and the second run, on
the same cache, changed `about.json` and `colors.json` only, in those words and colors. They were
`1f5df03f…ef7d0` and `6ce67a90…f1ee`, and the seventeen together `047cc6a1…a01e`. A cold rebuild
from the live services is therefore exact only while the sources stand still; the cache is what
makes it repeatable.

What makes it hold: the elevation service returns byte-identical data for a repeated request (and
is cached anyway); every grid is integer decimeters with explicit rounding, never a float carried
between steps; every list that reaches a file is sorted by something stable; and `generated` and
`retrieved` in the manifest are fixed constants in `tools/geom.py`, not `today()`.

---

## Budgets

Measured after the art pass of 2026-10-01 and its follow-up (`node tools/check.mjs` prints every
figure; vendor and the triangle figures below are unchanged by them, and the data is 17 bytes
smaller, from the follow-up's rebuilt `about.json` and `colors.json`):

| | Bytes | Files |
| --- | --- | --- |
| `data/` | 24 722 163 | 17 |
| `vendor/` (three.js r186, OrbitControls, RoomEnvironment, license) | 2 167 705 | 5 |
| app code: `index.html`, `app.js`, `styles.css` and the fifteen modules in `js/` | 226 787 | 18 |
| `fonts/` (the house face and `OFL.txt`) | 40 075 | 2 |
| the ZIP, built as `build-zips.yml` builds it | about 16 854 390 (this file is inside the ZIP, so its own figure moves the last digit) | 46 |

The app code was 215 934 B before the pass, over the house's 200 000 B cap; HOUSE.md section 8 holds
such an app at its size until the lead rules another; the lead ruled 227 000 B for this pass (plan
0011 D11, owner call 1 in `tools/DECISIONS.md`), which `tools/check.mjs` enforces.

**Triangles.** 2 × 64 × 64 = 8192 per tile for the surface plus 4 × 64 × 2 = 512 for the skirt =
**8704**. The tile selector is capped at 160 tiles, so the most terrain that can be drawn at once
is **1 392 640 — 1.39 M**. The cap is a constant in `js/terrain.js`, not a hope.

Measured in headless Chrome by reading `renderer.info.render.triangles` out of the running app,
hunting for the worst case across three camera presets, seven saved viewpoints, four positions
along the walk, three exaggerations and three viewport sizes from 390 × 844 to 1920 × 1080:

| | Tiles | Terrain triangles | Drawn in all | Draw calls |
| --- | --- | --- | --- | --- |
| default view, 1280 × 860 | 159 | 1 383 936 | 1 419 866 | 164 |
| phone, 390 × 844, fitted to the route | 159 | 1 383 936 | 1 419 866 | 164 |
| **worst of 24 views tried** | **160** | **1 392 640** | **1 428 570** | **165** |
| budget | — | — | 1 500 000 | — |

The extra 35 930 triangles over the terrain are the lake surfaces (13 380) and the merged overlay
lines, which are fixed geometry — so 1 428 570 is a ceiling, not the worst case seen. A larger
window does not raise it: the cap binds first.

**Time to first paint**, same harness, cold load with no cache: first contentful paint **88 ms**,
36 requests, and the terrain drawn with the loading screen dismissed **1.2 s** after navigation.
(Those are this machine's headless Chrome. A control page with the module removed reports its own
first paint at 1.8–2.0 s in some runs of the same harness, so treat the paint figure as indicative
and the 36 requests and the load sequence as the hard part.)
The analysis passes that run while you drag a slider: cast shadows over both grids **15 ms**,
a viewshed of 1508 rays over 15.4 km **30 ms**, first and last sun on a point for a whole day
**1 ms**.

If the budget ever has to come down, in this order — outer terrain first, the 2 m corridor last:
drop `rivers.geojson` (0.44 MB); take the level-3 radius from 4000 m to 3000 m (about 1.6 MB);
simplify `water.geojson` to 10 m instead of 5 m; take the level-4 anchor discs from 1000 m to
800 m. Only after all of that, the level-5 route buffer.

---

## What was checked, and against what

Numbers read out of the running app in headless Chrome, compared against arithmetic done
separately from the app's own code. Not "it looks right". These stand as measured on 2026-09-22;
some of the read-only hooks they used (`bench`, `debugSelect`, `drawnLevels`, `viewshedRings`,
`profileLine`, `gradientAt`) were removed in the art pass of 2026-10-01 to pay for the house player.
Since that pass, `tools/test_decode.mjs` decodes the data and checks the sun, the Burn, the units and
the walking time against this folder's own `tools/decode.mjs`, and `tools/shoot.mjs` drives the app.

**The shape of the ground.** Sampling the terrain the app draws: Gjende's surface **984.5 m**,
Bessvatnet's **1373.0 m** — **388.5 m** apart, which is the whole point of the ridge. A
north–south section across the ridge at 166 750 E, every 10 m, rises from the lake at 984.4 m to
a crest of **1631.2 m** at 6 835 020 N and falls to Bessvatnet at 1372.3 m: Besseggen, 647 m above
one lake and 259 m above the other. Besshøe reads **2257.1 m**, standing **866 m** above Bandet
2.0 km away. The walk: 548 samples, **13 675 m**, **1083 m** of ascent, high point **1741 m**.

**The profile and the terrain agree in both directions.** Dragged with real pointer events to
5.00 km of 13.675, the strip reads 5.03 km, 1740 m, −1 %, and the marker's label on the terrain reads
the same 1740 m. Going the other way, a tap on the 3D view at the screen point computed
independently from the camera the app reports for Veslfjellet moved the cursor from 0 m to
**5.00 km / 1741 m**, with the terrain readout at 1742 m.

**The sun.** A second NOAA implementation, written for the check and sharing no code with
`js/sun.js`, using the closed-form hour angle where the app samples the day minute by minute and
bisects. 61.5044 °N 8.7207 °E, Norwegian local time:

| | independent | the app |
| --- | --- | --- |
| 14 June 2026 | 03:43 / 23:08 | **03:43 / 23:08** |
| 20 September 2026 | 07:04 / 19:32 | **07:04 / 19:32** |
| 3 August 2026 | 05:00 / 22:01 | **05:00 / 22:01** |

Position at four instants agreed to **0.001°** in both altitude and azimuth. On 14 June the app
reports that civil twilight lasts all night, which is correct here — the sun's lowest point that
night is −5.24°, never reaching the −6° the definition needs.

**Shadow on the north side of Gjende.** 130 sample points on the flank above the lake's south
shore, taken from the shipped lake polygon and kept only where they face north and are steeper
than 10°, against 141 facing south above the north shore. At **08:00 on 20 September** (sun 6.0°
up, azimuth 98.6° true) the app holds **112 of 130** north-facing points in cast shadow and only
**38 of 141** south-facing ones. An independent ray-march toward the sun — the app's height
sampler, everything else computed here — makes it 106, and the two agree on 122 of 130, every
disagreement but one being a graze of 0.0 m. The north flank still holds 95 in shadow at 10:00 and
93 at 13:00; the south flank is down to 1 by 09:00 and 0 by 10:00.

**The viewshed.** From Veslfjellet, over a 2090-point lattice from 200 m to 15 km, the app's
raster and an independent ray-march agree on **95 %** of points (17.4 % visible against 19.5 %),
the app being the more conservative of the two. All 28 named peaks it reports match the shipped
coordinates: distances to the meter, bearings within 0.5° of a true bearing computed here from the
grid convergence.

**Bandet is not visible from Veslfjellet, and should not be.** The brief's checklist says it is.
Three independent routes say otherwise: the app's viewshed raster, its line-of-sight tool
(blocked by 66.6 m) and arithmetic done here over a sampled profile (blocked by 65.0 m at 1157 m).
The cause is the Besseggen crest itself — 1628 m at 1.13 km, on the straight line between a
1743.5 m eye and Bandet at 1391.7 m 2.31 km away, where that line is only 1572 m. Raising the eye
height to 60 m still leaves it blocked by 37 m. Along the whole walk there is no point from which
Bandet is in view except Bandet. The eye-height slider is there for exactly this question, and the
panel says plainly that a viewpoint on a convex summit hides much of its own slope.

---

## Accuracy, honestly

* The elevation source is a 1 m lidar terrain model. This app holds it at 2 m along the route, 4 m
  for 800 m either side, 8 m out to 4 km, 16 m across the rest of the detailed box and 64 m for the
  horizon ring. A summit label can therefore sit a few meters above the drawn surface away from the
  route: `places.geojson` heights are sampled from the 2 m grid, and decimation lowers peaks —
  Surtningssue reads 2366.8 m from the 2 m grid and 2363.3 m from the 16 m tiles that are actually
  shipped there.
* Lidar reads the **water surface**, not the bed. The terrain under Gjende already sits at
  984.4 m and under Bessvatnet at 1373.0 m, so water is drawn as a translucent plane rather than
  filled into a basin. That plane is **not** at N50's stated height. N50 rounds a lake to a whole
  meter, and for most lakes here the lidar surface is a few decimeters above that integer, so a
  plane at the integer is drawn *under* its own lake: at 1372 m, 89 % of Bessvatnet's 4.69 km²
  was bare ground, and standing on the shore the near half of the lake rendered as rock.
  `05_vectors.py` therefore sets `levelM` to the 99th percentile of the 2 m model sampled inside
  the lake (shrunk 3 m first, so the bank is not counted), floored at N50's figure and lifted a
  decimeter — Gjende 985.1 m, Bessvatnet 1373.1 m — and ships N50's own number alongside as
  `n50Hoyde`. Measured with the app's own sampler over 1200 points in each lake, ground above the
  plane went from **88.9 % to 0.6 %** in Bessvatnet; what is left is its islands, which are
  supposed to stand above the water. Both figures are shown in the About panel.
* Trail geometry is generalized and largely contributed by clubs and individuals; Kartverket says
  so itself, and the sentence is quoted in `CREDITS.txt`.
* Veslfjellet is in the place-name register under the spelling **Veslefjell** (Fjell,
  stedsnummer 71966), 28 m from the walk's high point. A plain search for "Veslfjellet" misses it
  and turns up a different 1459 m top 10 km away, which is why the design notes recorded the summit
  as unnamed; the disc query the pipeline actually uses finds it. The marker sits at the highest
  point the trail crosses — 1741 m smoothed, 1742 m raw — rather than at the register's point, and
  `tools/03_route.py` fails the build if the two ever drift more than 100 m apart. The actual local
  summit, 8 m off the path, is 1745 m.
* The MS Gjende timetable changes every season and is not in this app at all — see above. The
  About panel says so in one sentence, with no times and no link.
* **The scale bar is true at one distance, and says which.** A single scale cannot hold across a
  perspective view, so the bar is measured at the ground in the middle of the screen and the line
  beside it names that distance: "5 km, at 14.0 km". In a first-person view tilted down, the
  middle of the screen can be the ground a few meters in front of you, and the bar then reads a
  few meters and says so. Checked against a projection computed outside the app: the two agree to
  better than 1 % wherever the reference ground is more than 300 m away.
* **"Clear" in the line-of-sight tool means clear to within half a meter.** The profile is sampled
  every 12 m, heights are stored in decimeters and interpolated between grid nodes, so a smaller
  encroachment than that is below what the model can resolve. Sighting the exact top of a summit
  would otherwise report "blocked by up to 0 m", because the last few meters of the summit cone
  poke centimeters above a line that ends on the summit itself. When the line passes within that
  tolerance the verdict says so rather than claiming a clean view.
* **The Langmuir descent rates in `data/pace.json` are the classic ones**: ten minutes per 300 m,
  written as 1800 m of descent per hour of correction in both fields. The app reads whatever is in
  the file literally and prints the correction in minutes per 300 m beside the classic figures, so
  an edited value shows up as an explained time rather than a wrong one.
* **Every dataset is attributed in the app's own UI, not only in `CREDITS.txt`.** All four blocks
  in the About panel now name Kartverket as the owner — CC BY 4.0 §3(a)(1)(A) wants the creator
  identified, and Kartverket's terms ask for their name in all contexts — and the elevation block
  names the five lidar capture projects (2009–2022) beside the download date, because for a lidar
  model the survey year is the date that matters. The app still creates no links: `CREDITS.txt`,
  this README and `data/about.json` carry the URLs, and none of them is fetched.
* **The profile's labels are drawn at their natural size, and a few give way.** The strip is an
  SVG stretched to whatever width it is given (`preserveAspectRatio="none"`), which on a 390 px
  phone squashes a user unit to a third of a pixel — "Bjørnbøltjønne" measured 23.4 px wide, 1.67 px
  per character. Every label is now translated to its anchor and counter-scaled there, so text comes
  out at its real size (64.6 px, 4.6 px per character) whatever the strip is stretched to;
  `js/profile.js` then measures the boxes and pulls any that hangs over the edge back inside, nudges
  a name off its neighbor, and hides a meter or kilometer axis label rather than draw it through a
  name. At 390 px that costs the "1100 m" gridline its number — the line is still drawn — and all
  six waypoint names fit. Measured at 320, 390 and 1280 px: no label overflows the strip and no two
  overlap.
* **`prefers-reduced-motion` is honored by the camera, not just by CSS.** With it set, "Fly the
  route" becomes "Step to the next point": one jump per press between the named waypoints, with
  nothing moving in between, and play runs the day in whole hours. Viewpoints and Fit the route are
  cuts either way.
* **The camera is saved as soon as a drag settles.** `beforeunload` is not enough — WebKit does not
  fire it in a `WKWebView`, and an app killed in the background fires nothing at all — so `app.js`
  also stores state on `pagehide`, on a hidden `visibilitychange`, and 400 ms after the orbit or
  look-around drag ends. Verified by driving a real pointer drag and reloading: the camera comes
  back to within 2 × 10⁻¹² m. **Not yet verified on a phone**; that belongs on a device.
* Nothing in the app is a position fix. There is no geolocation, no compass and no camera, by
  design as well as by Snuggery's rules.
