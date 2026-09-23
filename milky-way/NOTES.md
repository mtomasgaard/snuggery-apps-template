# Milky Way

An offline 3D view of where we are: the Sun and its planets on any date from 1900 to 2100, the stars
around the Sun in three dimensions, and the Milky Way seen from outside — one continuous zoom, from
a few hundred kilometres above a moon to half a megaparsec out, built entirely from real,
attributed data and running inside Snuggery's sandboxed web view.

**Only real data.** Every position, size, colour, map and name in the app comes from a file the
pipeline in `tools/` downloaded from a pinned source and traced to a catalogue, a paper or a space
agency product. Where a published *fit* stands in for a measurement — an ephemeris, a spiral arm, a
bar — the app says it is a fit. Where nothing real could be found, the app shows nothing rather
than something invented, and the About panel says what is missing and why.

---

## What is in the folder

```
index.html, app.js, styles.css     the app; index.html at the folder root
js/                                the app's ES modules
miniapp.json                       Snuggery's name, entry point and version
CREDITS.txt                        every dataset, its owner, licence and the adaptations made
data/                              ephemerides, orbits, maps, star catalogues, the galaxy layers
vendor/                            three.js r186 (MIT), byte for byte the copy Anatomy and Besseggen ship
fonts/                             Atkinson Hyperlegible and Newsreader, with fonts/OFL.txt
tools/                             the data pipeline: build_all.sh, one script per step, verify scripts
tools/CONTRACT.md                  the byte-level format of every file in data/
NOTES.md, .gitignore, .gitattributes
```

It has to be served over HTTP. Opening `index.html` from disk looks broken, because a browser
blocks `fetch()` of `file://` URLs and every byte of data arrives that way.

```
python3 -m http.server 8000          # then open http://localhost:8000/
```

---

## Using it

- **Drag** to turn, **pinch** to zoom, **two fingers** to move. One pinch goes from a moon's surface
  to the Local Group; nothing switches modes on the way.
- **Tap** a planet, moon, asteroid, star, cluster, satellite galaxy or stream for a card with what
  is known about it and where the numbers come from; **double-tap** to fly to it.
- The three buttons at the bottom — **Solar System**, **Neighbourhood**, **Milky Way** — fly to a
  good view of each scale.
- In the Solar System the **time bar** plays the planets and moons through the year: play/pause,
  a speed from an hour to a year per second, a scrubber across the year with ‹ › to change year,
  and **Now**. Each planet trails its real path over the last part of its orbit, so a few seconds of
  playing shows who moves how fast. Outside the Solar System the bar hides: at those scales nothing
  visibly moves in a human lifetime, and the app does not pretend otherwise.
- **Find** (the magnifier) searches every named object; **Layers** switches each dataset on and off;
  **i** is the About panel with every source, licence and accuracy note.

---

## Code map

`app.js` wires the pieces together and owns the render scheduler — a frame is drawn when something
changed, and the loop stops as soon as nothing is moving (a flight, inertia or time playback keeps
it running). Everything else is in `js/`:

| File | Owns |
| --- | --- |
| `view.js` | the camera rig: target, distance and direction in float64 AU; gestures, inertia, fly-to |
| `solar.js` | the Sun, planets, moons, rings, orbits, trails and small bodies, at true size |
| `stars.js` | the stars in 3D by absolute magnitude, constellation figures, exoplanet hosts, the Gaia sky |
| `galaxy.js` | the galaxy's measured tracers and fitted models, in the Galactocentric frame |
| `ephem.js` | decodes the DE430 Chebyshev table and the satellite fits; UTC ↔ TDB |
| `rotation.js` | the IAU rotation model of every globe (pole, prime meridian, periodic terms) |
| `smallbodies.js` | asteroid and comet orbits, propagated on the CPU in float64 |
| `labels.js` | screen labels: priority, overlap culling, a pool of elements |
| `gfx.js` | the shaders: magnitude-true stars, lit globes, rings with shadows, the sky sphere, ribbons |
| `util.js` | units, formatting, float64 vector helpers, the `localStorage` wrapper |

### One zoom across fifteen orders of magnitude

The camera lives in float64, in astronomical units, heliocentric, on ICRF axes (`view.js`). Nothing
on the GPU ever sees those numbers. Each frame the scene is drawn in three passes that share the
camera's orientation but each has its own units and its own camera:

1. **Stars**, in parsecs, with the Sun at the origin — the Gaia sky sphere first, then the stars.
2. **The galaxy**, in kiloparsecs, in astropy's Galactocentric frame, carried into ICRS by the
   `to_icrs` matrix that the pipeline computed with astropy and shipped in `galaxy.json`.
3. After a depth clear, **the Solar System**, in AU relative to a *floating origin* at the camera's
   target, with the whole group scaled so the target is one unit from the camera. That is what lets
   a moon a few hundred kilometres away and Neptune four light-hours away share one frame: float32
   only ever holds offsets from the thing you are looking at, and the logarithmic depth buffer sees
   the nearest geometry at a distance of about one.

"Up" is not fixed. Close to the Sun it is the ecliptic north pole, so the planets lie flat; beyond
about a light-year it is the galactic north pole, so the disc does; in between it turns smoothly.
The view direction is kept continuous through the turn, so leaving the Solar System shows its plane
tilting by about 60° against the galaxy's — which is the real angle between them.

### Labels and picking

Labels and taps work in the same float64 AU space as the camera: every candidate is projected in
JavaScript, never read back from the GPU. Labels are placed highest priority first and skipped
when they would overlap one already placed, so a crowded view thins out instead of piling up.

---

## The data

Everything in `data/` is written by one pipeline step each (`tools/NN_*.py`), in the byte formats
`tools/CONTRACT.md` sets out. Every source is fetched from a pinned URL and checked against its
sha256 before it is used. Every step writes a credits fragment (`tools/credits/*.json`), and
`90_about.py` turns those fragments into the About panel (`data/about.json`) and `CREDITS.txt`, so
the app, the credits file and this table all name the same sources.

| Files | What | From | Size |
| --- | --- | --- | --: |
| `ephem.bin`, `ephem.json` | the Sun, the planets, Pluto and the Moon, 1900–2100 | JPL DE430, refitted as float32 Chebyshev series | 1.32 MB |
| `moons.bin`, `moons.json` | 21 major moons of Mars, Jupiter, Saturn, Uranus and Neptune, 1950–2050 | JPL MAR097, JUP310, SAT425, URA111, NEP081, fitted as precessing ellipses | 454 KB |
| `physical.json` | radii, shapes, poles and rotation of 32 bodies; masses; Saturn's and Uranus's rings | NAIF `pck00011.tpc` and `gm_de440.tpc`; SAT425's ring radii; PDS Ring-Moon Systems Node | 23 KB |
| `smallbodies.bin`, `.json` | 9,989 asteroids, trans-Neptunian objects and comets | JPL Small-Body Database (every body with H < 12, plus named near-Earth asteroids), MPC CometEls, JPL Horizons, ESA NEOCC | 693 KB |
| `tex/` | global maps of the Sun, Mercury, Venus (radar), Earth by day and night, the Moon, Mars, Jupiter, Pluto, Io, Ganymede and Triton; disc colours of the gas giants | NASA, USGS Astrogeology, Cassini (JPL/SSI), SDO via Stellarium, LROC via Stellarium; Karkoschka (1998) spectra | 1.69 MB |
| `sky/` | the Milky Way as seen from the Sun, 2048 × 1024 | Gaia DR3 source counts (1.8 billion stars), STScI/MAST HATS | 109 KB |
| `stars/deep.bin` | 209,156 stars between 20 and 500 pc, positions and absolute magnitudes | AT-HYG v3.2, whose distances are Gaia DR3's | 1.67 MB |
| `stars/named.json` | 11,049 stars: all naked-eye stars, everything within 20 pc, every exoplanet host within 100 pc | AT-HYG v3.2 and HYG v4.1; IAU star names | 771 KB |
| `stars/exoplanets.json` | 1,259 confirmed planets of 892 stars | Open Exoplanet Catalogue | 69 KB |
| `stars/constellations.json` | 88 IAU constellation figures | Stellarium's `modern_iau` sky culture | 12 KB |
| `stars/colour.json` | star colour by temperature | Planck spectra × CIE 1931 observer; Mamajek's dwarf sequence | 12 KB |
| `galaxy/galaxy.json` | 194 globular clusters and 65 satellite galaxies at measured distances; 100 stellar streams; 7 + 4 spiral-arm fits; the frame | Local Volume Database; galstreams; SpiralMap (Reid+2019, Drimmel+2024); astropy | 402 KB |
| `galaxy/young-*.png` | where young stars crowd, within about 4 kpc of the Sun | Poggio+2021 (Gaia EDR3) and Gaia Collaboration, Drimmel+2023 (Gaia DR3), via SpiralMap | 16 KB |
| `galaxy/model.png` | the disc and bar glow: a *model* | McMillan 2017 discs + Portail 2017 bar (Sormani 2022 form), integrated with Agama | 17 KB |
| `about.json` | the About panel | the credits fragments | 75 KB |

Total 7.00 MiB. The ZIP is 6.2 MB, and 9.4 MB unpacked, of which three.js is 2.1 MB.

**Licences.** Most of this is public domain (NASA, USGS, JPL/NAIF) or under open licences
(CC0, MIT, BSD, CC BY-SA 4.0). Two groups carry conditions of their own:

- **Gaia-derived files are non-commercial.** `stars/deep.bin`, `stars/named.json`,
  `sky/gaia-dr3-counts.jpg` and `galaxy/young-*.png` carry values from ESA's Gaia mission, which ESA
  licenses under CC BY-NC 3.0 IGO. This app uses them non-commercially, as that licence requires.
  The star files are also adapted from AT-HYG and HYG (CC BY-SA 4.0) and are shared under that
  licence as well. Anyone who reuses them has to meet both sets of terms, so commercial use is
  ruled out. ESA's own licence page could not be read from the build network; the licence is
  quoted from a web-search summary and from other projects' licence files, and `CREDITS.txt`
  says so.
- **CC BY-SA 4.0 files.** `tex/sun.jpg` and `tex/moon.jpg` (Stellarium's copies of the SDO HMI
  and LROC maps) and `stars/constellations.json` (Stellarium's `modern_iau`) are adapted under
  CC BY-SA 4.0 and shared under the same licence.

A few sources state no licence that could be read from here: the JPL Small-Body Database, ESA's
NEO Coordination Centre, and the New Horizons Pluto map. `CREDITS.txt` quotes what could be
found for each, and the root `LICENSE` lists every carve-out.

---

## Rebuilding

```
./tools/build_all.sh
```

This creates `tools/venv` from `tools/requirements.txt` if it is missing. It then runs the steps in
order (10 ephemeris, 11 moons, 12 physical, 20 small bodies, 30 textures, 31 sky, 40 stars,
50 galaxy, 90 about) and finishes with `tools/verify_data.py`, which runs every `verify_*.py`.
The first run downloads a few gigabytes into `tools/.cache/`, which is gitignored: about 2.3 GB of
JPL satellite ephemerides and a USGS Mars mosaic that decodes to several more. After that the
build does not touch the network. `MILKYWAY_SEED=<folder>` hard-links earlier downloads instead of
fetching them again, and `OUT_DATA=<folder>` writes somewhere other than `data/`.

The build is deterministic. From a warm cache a full rebuild takes about five minutes, and a
rebuild into a separate folder (`OUT_DATA`) produced every file byte-identical to the committed
`data/`, with `CREDITS.txt` and the credits fragments unchanged: JSON is written with fixed key order and rounding, PNGs
and JPEGs with fixed encoder settings, and nothing records the time of the build. The retrieval
date in the credits is a constant in `tools/common.py`. One known limit: `galaxy.json` records
the frame round-trip error, about 2 × 10⁻¹³ kpc. That value is floating-point noise, so a build on
a different CPU could differ in those few bytes.

`node tools/shoot.mjs [outdir] [scene …]` loads the app in headless Chromium at 390 × 844 CSS px,
DPR 2. It fails on any console error, failed request or request outside the app, and saves a
screenshot of each scene (solar, inner, earth, moon, jupiter, saturn, mars, play, stars, orion,
galaxy, edge, search). `TIMING=1` also reports the JavaScript time per frame while time plays.
`python3 tools/package_snuggery.py` builds `dist/milky-way.zip` the same way the repository's
workflow does, and refuses it if any app file contains a URL.

Measured in headless Chromium with software WebGL, the JavaScript work per frame while time plays
is about 7 ms: about 4 ms updating positions, under 1 ms submitting draws and about 2 ms placing
labels. A phone GPU draws the frame itself far faster than the software renderer does. Loading
takes under a second from local disk.

---

## Accuracy, honestly

Each number below was measured by a verify script against an independent computation, not
estimated.

**Planets and the Moon.** The shipped Chebyshev table was checked against DE430 itself at 25,000
random epochs from 1900 to 2100. Worst error: Mercury 20 km, Venus 9 km, Earth 12 km, Mars 26 km,
Jupiter 67 km, Saturn 99 km, Uranus 170 km, Neptune 285 km, Pluto 292 km, the Moon 2.6 km from
Earth's centre. At the ends of the fitted intervals the error is up to about 12 % higher (Earth
12.3 km). DE430 itself is far better than that. The error is the price of float32 storage, and
at the sizes the app draws it is far below a pixel.

**Moons.** Each moon's JPL ephemeris is fitted, window by window, with an ellipse that precesses.
Worst error over 1950–2050: from 3 km for Phobos and Triton up to 900 km for Titania and Oberon
and 1,300 km for Hyperion. That is 0.001–0.2 % of each orbit. Where two fit windows meet, a moon
can jump by up to that much, about 0.09 % of Hyperion's orbit, which is too small to see.
Rebuilding each giant planet's centre from its moons matches JPL's planet position to 0.2 km.
Outside 1950–2050 the moons are hidden, not extrapolated.

**Rotation.** The IAU rotation model in `physical.json` was compared with NAIF's CSPICE `pxform`
for 30 bodies at 7 epochs. The worst disagreement was 1.7 × 10⁻⁵ arcseconds.

**Asteroids and comets** move on two-body Kepler orbits from each body's osculating elements, with
no planetary perturbations. This matches a universal-variable solver to 5 × 10⁻¹³ relative. Ceres,
Pallas, Juno and Vesta land within 8 × 10⁻⁶ AU of JPL Horizons 49 days from their epoch (late
2025 for most asteroids). Away from the epoch the error grows, because the planets' pull is left
out. Measured against Horizons for those four, it reaches up to 0.05 AU at 5–10 years, 0.12 AU at
10–25 years and 0.32 AU at 50–75 years. Halley's 2026 elements put its 1986 perihelion 13 days
late. Every small body's card gives its epoch and says the position gets less accurate further
from it. Storing the elements in float32 adds at most 1.3 × 10⁻⁴ of the distance.

**Stars.** Distances are Gaia DR3's for 208,759 of the 209,156 deep stars, and Hipparcos's or
Gaia DR2's for the rest. Every named star's card says which. Six Gaia IDs appear twice in
AT-HYG within 500 pc; that is AT-HYG's own duplication, left as it is. `named.json` stores
positions to four significant digits. That moves a star's direction by up to 149″ (median 26″),
which cannot be seen at phone field of view. A very close pair, such as α Centauri A and B,
does land on one point. 76 named stars have no usable parallax (Alnilam, for example). They are
kept for the constellation figures seen from the Sun, but they are not placed in 3D, and their
figure lines are drawn only on the sky.

**Maps.** Each map was checked against known features and against its own mirror image and 180°
shift, to catch flipped or rotated maps: Olympus Mons, Tycho, Maxwell Montes, Sputnik Planitia,
Loki Patera, the Great Red Spot, and 12 of 12 land/sea test points on Earth. Jupiter's map is a
December 2000 snapshot. The Great Red Spot drifts in longitude, so on other dates it is right in
character but not in position. Pluto's map uses the New Horizons team's frame, while the app
turns Pluto with the IAU's `pck00011` model. The gazetteer puts Sputnik Planitia where the map
has it, but the New Horizons kernel could not be read here, so the offset between the two frames
is not proven. Earth's clouds are not drawn; the Blue Marble map is cloud-free by construction.

**The galaxy.** The frame matrix reproduces astropy's Galactocentric v4.0 transformation to
8 × 10⁻¹³ kpc. All 259 clusters and satellite galaxies map back to their catalogue RA/Dec within
the 0.1 pc rounding. Every stream point lies within its catalogued distance range. The Reid arm
fits pass a median 0.22–0.33 kpc from the masers they were fitted to (checked against Reid+2014
at build time). The two arm models disagree by about 0.9 kpc near the Sun, and both are drawn.
48 of the 100 streams have no measured distance track, or follow a constructed great circle.
They are drawn dashed and fainter, and their cards say "approximate".

**What is left out on purpose** is listed in the About panel under "What this app does not
show". In short: there is no picture of the galaxy from outside, only measurements and models.
Venus has no true colour, and Saturn, Uranus and Neptune have no surface maps. Charon, Neptune's
rings and single stars beyond 500 pc are not shown. The asteroid list is limited by brightness.
