# Norway in 3D

All of Norway from Kartverket's open data, in 2D and 3D, inside Snuggery's sandboxed web view:
the topographic map, the marked foot routes graded by difficulty, 980 mountain cabins, the
terrain at up to 1 m near the view, the real sun with the shadows the mountains cast, a viewshed
from any point and an elevation profile along any line.

**It is an online app.** Unlike Besseggen, nothing of the map or the terrain travels inside it: the
tiles are pictures from five sites, which Snuggery shows only after the person allows them
(ADR-0027). Offline, the app opens and says it cannot reach the map.

**It is not a navigation tool.** It has no position fix, no compass and no live weather.

---

## What is in the folder

```
index.html, app.js, styles.css     the app; index.html at the folder root
js/                                the app's ES modules, and the height decoder's worker
miniapp.json                       name, entry point, version, and network.resourceHosts
CREDITS.txt                        every source, its license and its attribution
data/cabins.geojson                the cabins, from OpenStreetMap (ODbL)
data/labels.geojson                the floating names, from OpenStreetMap (ODbL)
vendor/                            three.js r186 (MIT), byte for byte Besseggen's copy (OrbitControls left out)
fonts/                             the template's house face, Ysabeau Office, with fonts/OFL.txt
tools/                             serve.mjs (the online CSP), shoot.mjs, probe.mjs, build_cabins.py,
                                   build_labels.py, build_ramps.py
                                   (the ZIP leaves tools/ out)
ART.md                             the look: the house system and this app's signature, the skyline
```

Run it the way Snuggery runs it, under the online Content-Security-Policy:

```
node tools/serve.mjs              # http://127.0.0.1:8017/, every response with the online CSP
```

## The hosts

`miniapp.json` → `network.resourceHosts`, five of the eight allowed, images only:

| Host | What | License |
| --- | --- | --- |
| `cache.kartverket.no` | the topographic map, WMTS, 256 px tiles to z 17 | CC BY 4.0, © Kartverket |
| `wms.geonorge.no` | the foot routes (Turrutebasen), WMS GetMap as 256 px tiles from z 10 | open data, no conditions |
| `hoydedata.no` | DTM1, the 1 m terrain model, packed into PNG, z 12 to 15 at 512 px | NLOD 2.0 / CC BY 4.0 |
| `elevation-tiles-prod.s3.amazonaws.com` | Terrarium heights for the far field, z 0 to 12 | Kartverket's 10 m model over Norway; Mapzen's attribution list |
| `kart.nve.no` | seNorge snow depth for a day, WMS `seNorgeGrid_png`, layer `sd`, 256 px to z 9 | NLOD (compatible with CC BY 4.0), © NVE and MET Norway |

The bucket host, never `s3.amazonaws.com`, which would approve every bucket (research 0019 §6).
Every tile is an `<img crossOrigin="anonymous">`; nothing is fetched (`connect-src 'self'`). The
heights are read back through a canvas (the owner's decision of 2026-10-16: CORS pixel reads are
allowed for online apps).

## Code map

| File | Owns |
| --- | --- |
| `app.js` | wiring, the render scheduler, taps, the card, the dialogs, the test hook |
| `js/geo.js` | Web Mercator, tiles, the scene frame and its moving origin |
| `js/sources.js` | the five hosts, and the address of every kind of tile but the snow (`js/snow.js`) |
| `js/loader.js` | the request queue: priorities, caps, drops, retries, the two lanes kept for the view |
| `js/heights.js` | the height store: decode, fill, sample, LRU |
| `js/hcore.js` | the decoders and the normal maps, shared by the worker and the main thread |
| `js/worker.js` | the decoder off the main thread |
| `js/terrain.js` | the quadtree, the tile meshes, the textures and their GPU budget, the tiles loaded ahead of the view |
| `js/material.js` | the terrain shader |
| `js/camera.js` | the map and 3D camera and the hands that move it (no OrbitControls since 1.1), and where a moving view will be |
| `js/cabins.js` | the cabins as one point cloud, and picking |
| `js/labels.js` | the floating names: buckets, ranking, placement without overlap, occlusion |
| `js/sun.js` | Besseggen's solar position, day events and shadow sweep |
| `js/shade.js` | the two shadow grids, their rebuilds and sweeps |
| `js/analysis.js` | the tangent-plane grids, the viewshed, the profile, the skyline |
| `js/track.js` | the player's track, drawn as the skyline |
| `js/snow.js` | the seNorge snow tiles and their legend decode |
| `js/ramps.js` | the elevation color tables (written by `tools/build_ramps.py`) |
| `js/focus.js` | focus mode |
| `js/units.js` | every number, unit and date the app writes |
| `js/util.js` | small helpers and the `localStorage` wrapper (`norway3d:`) |

## The heights

**Terrarium** (far field): `h = R·256 + G + B/256 − 32768` meters, 256 px tiles.

**DTM1** (near field): research 0019 found that hoydedata's ImageServer will pack heights into
an ordinary PNG with a raster function. Building the function showed something the research did
not say: the service **rounds** a value to a byte and **wraps** it (mod 256), and intermediate
pixel types inside a chain are ignored (a nested "truncate to U8" is not a truncation). So the app
asks for the height at three scales, with `v = 10 h + 1000` decimeters:

```
R = round(v / 256)       G = round(v / 16) mod 256       B = round(v) mod 256
```

`B` is `v` exactly modulo 256; `16 G` is within 8.5 of `v`, which places it modulo 4096; `256 R` is
within 128.5 of `v`, which places that. The result is `round(v)`, the height to the decimeter.
Measured on 2026-10-16 against the same service's own float output for the same chain, over
3 × 262 144 pixels at z 13 and 15: 0.06 to 0.08 % of pixels one decimeter off (rounding ties),
none more. The offset of 1000 keeps the lowest point in the model (−70 m) positive. Over the sea
the model reads 0 m; outside its coverage (Sweden, Finland, Russia) the pixel is the PNG's
transparent color, 253, 253, 253, and the app fills it from the Terrarium tiles.

The request is 1 307 characters long, inside the service's limit (a first form at 3 574 characters
was refused by IIS with a 404).

## The sun, the shadows, the skyline

- **The sun** is Besseggen's `js/sun.js` (NOAA's algorithm, written out; Norwegian time by the
  European rule), computed for the middle of the view: one sun for the light, since a view spans
  at most a few hundred kilometers.
- **The shadows** are cast, not guessed from the slope: Besseggen's line sweep over two nested
  grids around the view's center (`js/shade.js`), in a tangent plane at the center, so the earth's
  curvature is in the heights (d²/2R) and the sun's rays stay straight. The core grid is 2.4 × the
  camera's ground distance across (3 to 50 km) at 512 cells, the shell five times wider at 384
  cells, its shadows carried into the core by Besseggen's seed. The grids are rebuilt when the
  view rests somewhere new, and again as heights arrive (at most every 1.5 s); the sweep runs in
  the frame that shows a new instant, so the light and the shadows are always of one minute.
- **The skyline** (the signature, `ART.md`): the horizon from the marker, 720 half-degree rays
  marched to 60 km over the heights held (a step of 2 % of the distance, at least 10 m), with
  curvature and refraction (k = 0.13). Direct sun is the sun's apparent altitude above that
  horizon at its azimuth, minute by minute.
- **Far heights for all three**: the Terrarium tiles under a square of at least 120 km around the
  view are asked for with the nearest map tiles, so the mountains behind the camera cast shadows
  and stand on the skyline too. Where no height has arrived, the grids read 0 m and the skyline
  skips the sample; both are redone when the heights land.
- **The viewshed** (`js/analysis.js`, Besseggen's radial sweep): over its own 512-cell grid around
  the tapped point (2.4 × the camera distance, 4 to 40 km), eye and target 1.7 m above the ground,
  with curvature and refraction; redrawn as better heights arrive.
- **The profile**: up to 600 samples along the tapped line, from the finest heights held; the 1 m
  model is asked for under the line (at most 40 tiles). Up and down add every rise and fall at the
  sample spacing, which the card states, so a 1 m model on a long line counts some boulder noise.

Measured in the same headless run (desktop CPU, **not phone figures**): grids 17 to 19 ms, one
sweep of both 1.9 ms, a skyline 20 ms, a viewshed 16 ms. A real-touch scrub at 2, 8 and 20 steps a
second drew 34 to 37 frames in 3 s, every one the step under the finger, its label and its own
shadows (`tools/shoot.mjs`).

## The surfaces, the names, steepness and snow (the owner's additions of 2026-10-16)

- **Surface** (the style sheet): *Map*, Kartverket's topo; *Relief*, a neutral ground (`#c2bdb2`)
  shaded from the normals, the water read from the map tile's own blue (a hue test in the shader:
  blue at least 0.24 above red in linear light, the topo's lakes measure 0.40, its glacier white
  0.14) and from the sea's 0 m; *Elevation*, the ground colored by its height through one of three
  64-stop tables (`js/ramps.js`, written by `tools/build_ramps.py` from cmcrameri v1.9 and
  matplotlib 3.9.2) over the heights drawn (rounded out to 50 m) or over 0 to 2 500 m, with a key.
  The color comes from the vertex heights, smooth between them; the 1 m detail is in the shading.
  Every surface is remembered.
- **Names.** Kartverket publishes no topographic map without its names: the WMTS has `topo`,
  `topograatone`, `toporaster` and `sjokartraster`, all named (2026-10-16). So the label-free
  surfaces are Relief and Elevation, and the floating names are OpenStreetMap's:
  `tools/build_labels.py` keeps the named peaks (14 178), cities, towns and villages (1 898) and
  lakes and glaciers whose bounding box is at least 0.3 km² (3 953), 20 029 names, 3.1 MB, 475 KB
  gzipped (hamlets, 18 716 more, were left out). They stand on a stem over the ground in 3D, and on
  the map when the surface has no names of its own; ranked by importance and distance, placed
  without overlap, hidden where the terrain stands between them and the camera, at most 34.
- **Steepness**: the avalanche-terrain classes 27–30, 30–35, 35–40, 40–45 and over 45 degrees,
  from the slope of the normal map, 1.14 m a pixel near the view; coarser tiles read gentler.
  Not avalanche advice, and the app says so in About and in the word's description.
- **Snow, seNorge** (the owner's choice of source, 2026-10-16): NVE's `seNorgeGrid_png` WMS, layer
  `sd` (modeled snow depth), with `time=YYYY-MM-DD`, asked in EPSG:3857 (the capabilities list
  only UTM, and 3857 is served). The picture is in the legend's eight colors
  (`seNorgeGridLegend/sd.png`, read on 2026-10-16: bare ground `#ccf57a`, under 25 cm `#d9ffff`,
  25–50 `#b3ffff`, 50–100 `#80ebff`, 100–150 `#40ccff`, 150–200 `#0099ff`, 200–400 `#0019ff`, over
  400 `#000099`); each pixel goes to its nearest color, then to how white the ground is drawn (0,
  0.5, 0.78, 0.95, then 1). `swe` was left out: depth is what a walker reads. The default day is
  today (the service serves today); the day slider goes back a year. The credit beside the map is
  the line seNorge's terms ask for: data retrieved from www.senorge.no (their terms also ask for
  the seNorge logo beside a seNorge map; the house rules carry no agency emblem, and the owner
  decided on 2026-10-16 to keep the credit as text only, below).
- **Snow line** (offline, and an option beside seNorge): snow above the height set, 140 m lower on
  a north face and higher on a south face (scaled by how steep the face is, from 3 to 15°), shed
  from 48 to 62°, with a 60 m soft edge. It is a uniform: dragging the slider redraws in the next
  frame, nothing is recomputed.

## The hands and the 2D/3D switch (1.1, the owner's request of 2026-10-16)

The owner, on the phone with 1.0: *"Navigating the 3d view is not very intuitive and feels a bit
off. i prefer how it is done on the anatomy and milky way apps. Also i would like to be able to
switch between 2d and 3d."*

**What the two references do.**

| | Anatomy | Milky Way |
| --- | --- | --- |
| Code | three.js OrbitControls, `enableDamping`, `dampingFactor` 0.09, `rotateSpeed` 0.85, screen-space pan | its own rig (`js/view.js`): target, distance, direction in float64 |
| One finger | turns (orbit) | turns, 0.0055 rad a pixel, from 4 px of movement |
| Pinch | zooms about the target | zooms about the target |
| Two-finger drag | pans | pans once the pinch's middle has moved 12 px beyond what the pinch itself moves it |
| Double tap | flies to the part (750 ms) | flies to the object (900 to 3 200 ms) |
| Momentum | OrbitControls' damping | inertia decaying as exp(−t / 260 ms); a finger resting 80 ms before lifting throws nothing |
| Limits | 0.08 to 12 m | 30 km to 580 kpc; 4° from the pole |
| Target | the box fitted, or the part flown to | the selected body, or a point fixed by a pan |
| Page scroll | `touch-action: none` on the canvas, `overscroll-behavior: none` | the same |
| A touch during a flight | lands it | lands it |

**What Norway in 3D does now** (`js/camera.js`). In 3D: one finger turns (sideways) and tilts (up
and down) about the ground in the middle of the view, 0.0062 rad a pixel after 5 px; a pinch zooms
toward the ground under the fingers; two fingers dragged together carry the land, the ground under
them staying under them (Milky Way's 12 px rule decides when a pinch also pans); a double tap flies
(600 ms) to the place tapped, which becomes the middle at half the distance; a flick coasts on Milky
Way's 260 ms inertia, never under Reduce Motion; a touch lands a flight. On the map (2D): one finger
drags, a pinch zooms toward the fingers, two fingers drag, a double tap zooms in on the place,
which stays under the finger. On a computer the left button is the finger, the right button or
Shift moves, the wheel zooms toward the pointer. A drag that starts on a floating name moves the
view too; a tap on a name still opens its card.

**Why one finger turns rather than moves.** The owner asked for the reference apps' feel, and in
both one finger turns. Moving across Norway stays easy three ways: two fingers carry the land at
the speed of the land under them (Google Earth's gesture, so far ground moves as fast as it looks);
the 2D key, one tap, gives a map where one finger moves; and the double tap flies to any place on
screen. The map keeps one-finger dragging because it has nothing to turn.

**Why OrbitControls felt off**, set up as a map control: no inertia, so a flick stopped dead; one
finger moved and turning lived on two fingers, where a pinch's drift also turned the view; its pan
moved a plane through a pivot that the app then snapped to the ground, so the land slid at a
different speed from the finger and the camera bobbed over every ridge; and its zoom toward the
pointer lifted the pivot off the ground, which the snap pulled back with a lurch. It is gone from
`vendor/`.

**The terrain rules.** After every move the pivot is found again where the line of sight meets the
ground, which changes nothing on screen, so a turn is always about the ground in the middle and
never about a point in the air (a turn keeps its pivot to its end). The eye stays 40 m over the
highest ground within 80 m of it, raised straight up when it would go lower, so it slides up a
mountain's face rather than into it. The tilt stops at 76° within 30 km and eases to 50° at 600 km,
so the horizon stays in the upper part of the view, and a zoom out eases a steeper tilt down.

**The switch.** `2D` and `3D`, one plate at the foot of the picture, right (it moved out of the
header row, where focus mode hid it); it stays in focus mode. 2D to 3D keeps the pivot and the
distance and tilts to 52° facing north, so the middle and the scale there are kept; 3D to 2D keeps
the pivot and the distance and turns north up. A card, the marker, a viewshed or a profile, the
surface, the layers and the snow stay as they are. The move is 420 ms on the house curve, a cut
under Reduce Motion.

**The floating names' heights** (the owner's phone, 2026-10-16: Galdhøpiggen read 2 242 m, its dot
in the col). A name kept the first terrain height it read, from whatever coarse tile had arrived,
and printed it: the label said that tile's smoothed summit, and the dot stood at that height, below
the summit, so it showed in front of it on the slope. Now a peak's name prints OpenStreetMap's
height (`e`), or the terrain's rounded to 10 m and marked `about` where OpenStreetMap has none, and
the dot's height is read again every frame from the finest heights held. The projection was the
same as the terrain's and the cabins' throughout (Mercator, the same curvature, pixel centers at
+0.5 in both decoders). Standing on their summits, names now sit where people tap, so while
Viewshed or Profile waits for a tap, a tap on a name is taken as a tap on its place.

## Moving stays sharp (1.2, the owner's request of 2026-10-16)

The owner, on the phone with 1.1: *"Is it possible to not reduce the resolution when moving
around?"* Their standing rule, from the time players: moving must look as sharp as standing still.

**What 1.1 did to quality while the view moved, and what became of it** (`app.js`, the frame loop;
every place was looked for: the pixel ratio, the tile choice, the normal maps, the shadows, the tile
requests):

| While moving, 1.1 | Why it was there | 1.2 |
| --- | --- | --- |
| Drew at a pixel ratio of 1, not the phone's 2: a quarter of the pixels | to keep the frame rate up during a gesture | removed: the phone's pixel ratio in every frame |
| Chose tiles as if a map pixel could cover 2 screen pixels, not 1.25: about one level coarser | fewer tiles and requests mid-gesture | removed: the same choice as at rest |
| Did not rebuild the shadow grids, nor ask for the far heights they need, until 220 ms after the view stopped: panned past the core's edge, the ground took the shell's 200 m shadows | a grid build costs 17 to 19 ms here | removed: rebuilt while moving too, at most every 400 ms, when the view has moved a sixth of the core |
| Normal maps, tile requests and refinement | — | were never held back: every frame already chose tiles and asked for them |

What remains held until the view rests is analysis, not picture: the skyline and a viewshed's
redraw as better heights arrive.

**Detail that went backwards for other reasons** (found while measuring, fixed in 1.2):

- *Eviction.* Textures and heights not drawn this frame or the last went least recently used
  first, with the drawn set alone near the 112 MB budget, so ground seen ten seconds earlier was
  gone: panning back 5 km, 1.1 drew 228 tile-frames coarser than it had drawn them on the way out.
  Now the order is: tiles loaded ahead that were never drawn and are no longer ahead; then the
  least recently drawn; tiles held for the ring ahead of the view only after all of those. Never
  one drawn this frame or the last. Both caches count what they evict from around the view
  (`evictedNear`), and the check below requires none.
- *Held finer detail.* A tile whose four children's maps are held stays split until its texels are
  half the size the threshold asks for (`STICK`), so backing away or panning past does not swap a
  finer map that has arrived for its parent; one level at most, inside the 150-tile cap.
- *The loader's priorities only ever fell*: a tile once wanted near the view kept that priority
  after the view left it. Now each frame sets it anew.
- *An evicted texture could come back outside the budget.* A drawn tile whose map, trails, snow or
  normals were off kept the last texture in its sampler, and when that texture had been evicted
  (disposed), three.js uploaded it again on the next draw, uncounted. Found when 1.2's normals,
  which keep no CPU copy, raised WebGL's "no pixels" warning; a sampler that is off now holds the
  shared one-pixel texture.

**Loading ahead** (`js/terrain.js`, `_ahead`; `js/camera.js`, `Rig.predict`). Each frame chooses
tiles for two more views with the same rule and asks for the ones not drawn: where the hands'
velocity will have carried the view 700 ms from now (a drag at its speed, a coast as it eases out,
Milky Way's 260 ms; the turn, the tilt, the pan and the pinch), and a ring around the view (the same
camera, its field of view 1.45 times wider). At most 32 tiles a frame, the predicted view's first,
each its map, its trails and its heights, at priorities after every tile in view; the loader keeps
two of its six lanes for the view, so a prefetch never makes a tile in view wait for a lane. The
ring is asked for at rest too, so the first pan already finds its edge loaded. Frames are kept
coming only while tiles **in view** are on their way (`loader.pendingView`, also the status line's
count); tiles ahead are pumped by their own arrivals and draw nothing.

**The budgets raised** (`Budgets` below): textures from 112 to 176 MB, heights from 64 to 72 MB,
248 MB in all (the brief's ceiling was about 250). Measured during the motion below, at the full
pixel ratio: the tiles drawn hold up to 121 to 127 MB of textures (over three runs) and those ahead up to 24 MB, which left
1.1's 112 MB no room for anything already seen; 176 MB keeps about 25 MB of ground just seen. The
heights were made smaller rather than given more: since 1.2 a tile's normal map is let go on the
CPU once the GPU has it (`Heights.dropNormals`; made again from the heights if its texture is
evicted, or after a lost GPU context), so a 1 m tile is 512 KB, and the drawn and ahead heights
measure up to 37 to 41 and 8 MB of the 72. Against the phone: iOS publishes no limit for a web content
process. 248 MB of caches plus the drawing buffers (about 1.3 million pixels at a pixel ratio of 2)
is judged to sit well inside what a current iPhone gives one web view, the same order as 1.1's
176 MB, but that is an estimate, not a measurement: the phone check is item 5 below.

**Save battery** (Map style and date, *While moving*; `S.saveBattery`, remembered, **off by
default**): on, it brings back exactly 1.1's way while the view moves (pixel ratio 1, the coarser
choice, no shadow grids until it stops) and loads nothing ahead. It is the one switch; nothing
else in the app trades sharpness for power.

**Measured** (`SCENES=motion node tools/shoot.mjs`, 2026-10-16; headless Chromium with SwiftShader
on the build Mac, 390 × 844 at DPR 2, live tiles over a US VM's network: **not phone figures**).
From Besseggen at 7 km: one finger turns 300 px in a second and flicks back in half a second; then
two fingers pan in strokes of a quarter of the picture in 0.45 s, thrown, 6 km out and back over the
same ground. The strokes run on the clock, so a hand moves at the same speed whatever the frame
rate. Every frame drawn is sampled in the page: its pixel ratio; the share of the ground on screen
(weighted by each tile's size on screen) at the finest detail held for it (its own map and its own
heights, a map texel at most 1.25 of the phone's physical pixels); the caches. The same scene, run
on 1.1's code (the sampler reads only what 1.1 has), gives the before.

| | 1.1, before | 1.2, after |
| --- | --: | --: |
| Pixel ratio while moving | 1 (2 between strokes) | 2 in every frame |
| Ground at finest detail: turn / pan out / pan back | 0 / 3 / 6 % | 57 / 71 / 85 % |
| Tiles with their own map: turn / pan out / pan back | 39 / 62 / 66 % | 66 / 82 / 94 % |
| Tiles with their own heights: turn / pan out / pan back | 23 / 44 / 54 % | 59 / 74 / 86 % |
| Panning back: tile-frames coarser than already drawn | 228 (all evicted) | 0 |
| Textures, most held (drawn, ahead) | 112 of 112 MB | 176 of 176 MB (121, 24) |
| Heights, most held (drawn, ahead) | 64 of 64 MB | 72 of 72 MB (37, 8) |
| Requests in flight, most | 6 | 6, ahead at most 4 |
| Frame interval, median while moving | 26 to 31 ms | 100 to 128 ms |
| Frame CPU (JavaScript), median | 1.1 to 1.5 ms | 2.2 to 2.5 ms |
| One frame of the view, waited out on the GPU | 67 ms at pixel ratio 1 | 98 ms at pixel ratio 2 |
| Ground speed of the pan | 1 219 m/s | 862 m/s |

The after column is the full run of 2026-10-16 in which all 147 checks passed; two earlier motion-only
runs gave 57 to 61, 78 to 89 and 87 to 94 % finest detail. At rest both end at 100 % finest detail. The turn is the hard case: 107° in a second shows ground
no prediction had time to load. The frame interval is SwiftShader rasterizing four times the
pixels and more tiles on the CPU; it says nothing about a phone's GPU, but it says the cost is real:
the phone's frame rate and heat while moving are **unverified**, and are items 4 and 12 of the
device list. (The pan's speed differs because a flick's speed is measured over the last moves, which
the slower frames sample differently; the strokes themselves take the same time.)

## Budgets

- At most **6 tile requests in flight**, at most 4 to `hoydedata.no` (`js/loader.js`); a request
  that has not answered in 25 s is given up and retried (twice), so a hung connection never holds
  a lane. Tiles wanted only ahead of the view take at most 4 lanes, and only after every tile in
  view has been sent (since 1.2).
- At most **150 tiles drawn** (`js/terrain.js`, `MAX_NODES`), 2 304 triangles each; at most **32
  tiles asked for ahead** of the view at once (`AHEAD_MAX`).
- **176 MB of textures** held on the GPU (`GPU_BUDGET`; 112 MB until 1.1), evicted in the order
  under *Moving stays sharp*, never one drawn this frame or the last.
- **72 MB of heights** held on the CPU (`js/heights.js`, `BUDGET`; 64 MB until 1.1, which counted
  each tile's normal map too: since 1.2 the normals live on the GPU only, so a 1 m tile holds 512 KB
  on the CPU, not 1 MB, and 72 MB holds about twice the tiles 64 MB did).
- **248 MB** of caches in all (176 + 72), against 176 MB in 1.1.
- Moving is drawn like standing still: the phone's pixel ratio (up to 2) and the same tile choice.
  Only **Save battery** (off by default) brings back 1.1's pixel ratio 1 and coarser choice while
  the view moves.
- In 3D the trails are asked for from z 12 only (a far tile's trails would be a pixel wide).
- **The ZIP** is about 1.1 MB: `tools/check.mjs` builds it as `build-zips.yml` does and prints its
  size against the 60 MB cap. This file travels inside the ZIP, so it cannot carry the ZIP's own
  SHA-256; the exact size and fingerprint of a ZIP someone tests with are written down beside that
  ZIP, outside it.

**Measured** (`tools/shoot.mjs`, 2026-10-16, after the art pass, headless Chromium with SwiftShader
on the build Mac over a US VM's network: **not phone figures**; the phone's are listed below as
unverified):

| 3D view, 390 × 844 at DPR 2 | Settled | Tiles drawn | Triangles | Textures held | Heights held | Requests (cumulative) | Frame (CPU raster) |
| --- | --: | --: | --: | --: | --: | --: | --: |
| The first view, Besseggen from the east | 24 to 49 s | 150 | 345 600 | 106 MB | 51 MB | 398 | — |
| Besseggen and Gjende, 9 km | 15 to 24 s | 102 | 235 008 | 110 MB | 59 MB | 470 | 98 ms |
| Romsdalen, 9 km | 36 s | 150 | 345 600 | 103 MB | 62 MB | 917 | 120 ms |
| Reine, Lofoten, 12 km | 33 s | 150 | 345 600 | 107 MB | 60 MB | 1 278 | 186 ms |
| Lyngen Alps, 22 km | 16 s | 112 | 258 048 | 109 MB | 60 MB | 1 558 | 111 ms |
| All of Norway (map) | 5 to 7 s | 12 to 32 | 27 648 to 73 728 | 107 to 111 MB | 58 MB | — | — |

The texture and height figures are what the caches hold, filled to their budgets by design; what
one view draws is less. A height tile decodes in 1 to 2 ms in the worker. Per request, averaged over
a run: map tiles 200 ms, trails 200 to 600 ms, Terrarium 350 to 600 ms, seNorge 0.4 to 1.5 s,
DTM1 0.5 s at its best and 5 to 9 s when the service was busy. The frame times grew from phase 2's
72 to 98 ms with the shadows, steepness and snow in the shader.

The table is 1.1's. With 1.2 (the same run as the motion table, 2026-10-16), settling now waits for
the ring ahead of the view too: Besseggen and Gjende 22 to 26 s, 122 tiles; Romsdalen 36 s and
Reine 30 s, 150 tiles; Lyngen 51 s, 116 tiles; textures held 160 to 174 MB of 176, of which the view
draws 72 to 102 MB, with 32 tiles ahead.

## The owner's decisions of 2026-10-16

- **Online at full resolution.** CORS pixel reads are allowed for online apps, so the 1 m heights
  come in stage one as packed PNGs (plan 0015; research 0019).
- **Workers allowed**, from package files only: Snuggery's online policy is `worker-src 'self'`
  (no `blob:`), and `tools/serve.mjs` serves exactly that.
- **Snow from NVE/MET seNorge only** (modeled snow depth, `kart.nve.no`); NASA GIBS was offered and
  left out. The snow line slider stays as the offline alternative.
- **The seNorge credit is text only, with no logo**, though seNorge's terms ask for the logo: the
  house carries no agency emblem.
- **Map stays the default surface in 3D** (and in 2D), with the floating names on. Kartverket has
  no topographic map without names, so draped names are on the Map surface; Relief and Elevation
  are the label-free ones, one tap away.

## What is unverified on a phone

None of this is claimed; each needs the owner's iPhone (iOS 26.x, the Snuggery build that carries
online apps), and the lead puts them in the device matrix:

1. **The heights decode exactly in WebKit**: a canvas read of the CORS PNGs leaves their bytes
   (research 0019 §10, risk 3). Check: tap a known summit (Galdhøpiggen, 2 469 m) in 3D; the card
   must read 2 468 or 2 469 m from the 1 m model.
2. **`hoydedata.no` and `kart.nve.no` answer the `snuggery-app://<uuid>` origin.** Both echo the
   Origin with credentials; curl with `Origin: snuggery-app://x` gets it back; a headless browser
   cannot send that origin. Check: the 3D view's near field sharpens (the card says "the 1 m
   model"), and Snow shows seNorge's white.
3. **The worker runs** under `worker-src 'self'` in WKWebView (module worker, OffscreenCanvas).
4. **Frame rate** while panning, tilting and scrubbing the sun, with shadows on (the app draws at
   a pixel ratio of at most 2). Since 1.2 this is at the full pixel ratio and the full tile choice
   while moving, four times 1.1's moving pixels: the headless figures below are SwiftShader's, and
   **neither the frame rate nor the heat on the phone is known**. Check: a one-finger turn and a
   two-finger pan across Jotunheimen for a minute; smooth, or stutters, and how warm the phone gets.
   Then the same with Save battery on, for the difference.
5. **Memory** after ten minutes of flying around Norway: the budgets are 176 MB of textures and
   72 MB of heights since 1.2 (112 and 64 before); measure the web content process, and whether
   Snuggery's web view is ever reloaded by iOS for memory (the page would start again).
6. **First-view latency** on a phone's network (the headless run: 16 to 23 s for a 3D view).
7. **The scrub stays sharp** on the phone: drag the track fast; every frame its own shadows.
8. **Focus mode in Snuggery's full screen**: the ghost key and Snuggery's exit both reachable.
9. **VoiceOver** on the track, the words and a tap on a cabin or a name.
10. **The rate of requests** to `hoydedata.no`, a dynamic service with no stated limit: ask
    Kartverket (`hoydedata@kartverket.no`) before the app ships to everyone (research 0019 §10).
11. **The hands**: one finger turns and tilts, a pinch zooms toward the fingers, two fingers move
    the land, a flick coasts and stops, a double tap flies; the camera never goes into a mountain
    (pinch in hard on a steep face); a drag that starts on a name still turns. The 2D/3D key works
    in focus mode and keeps the place.
12. **Moving stays sharp** (1.2): pan with two fingers and turn with one; the picture keeps its
    full sharpness while it moves (no soft frames that sharpen on stopping); land just beyond the
    edge is already there when it comes into view; panning back over ground just seen shows it
    sharp at once. Save battery (Map style and date, While moving) on: soft while moving, sharp at
    rest, as 1.1 was; off again after. With items 4 and 5, this is the change's phone check.
13. **The normal maps after the web view loses its GPU context** (1.2 keeps no CPU copy of them;
    `webglcontextrestored` makes them again from the heights): leave the app in the background
    under other heavy apps, come back; the relief shading must be right, not flat or striped.
