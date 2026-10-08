# Milky Way

An offline 3D view of where we are: the Sun and its planets on any date from 1900 to 2099, the stars
around the Sun in three dimensions, and the Milky Way seen from outside, in one continuous zoom from
a few hundred kilometers above a moon to half a megaparsec out, built entirely from real,
attributed data and running inside Snuggery's sandboxed web view.

**Only real data.** Every position, size, color, map and name in the app comes from a file the
pipeline in `tools/` downloaded from a pinned source and traced to a catalog, a paper or a space
agency product. Where a published *fit* stands in for a measurement (an ephemeris, a spiral arm, a
bar) the app says it is a fit. Where nothing real could be found, the app shows nothing rather than
something invented, and About says what is missing and why.

The look follows the template's house system (`Template/HOUSE.md`); `ART.md` is this app's
direction: the chrome, the palette with its measured contrast, and the one bold thing, the Reach.

---

## What is in the folder

```
index.html, app.js, styles.css     the app; index.html at the folder root
js/                                the app's ES modules
miniapp.json                       Snuggery's name, entry point and version
ART.md                             how the app looks, moves and speaks, and why
CREDITS.txt                        every dataset, its owner, license and the adaptations made
data/                              ephemerides, orbits, maps, star catalogs, the galaxy layers
vendor/                            three.js r186 (MIT), byte for byte the copy Anatomy and Besseggen ship
fonts/                             Ysabeau Office (the house subset), its OFL.txt, and a supplement
tools/                             the data pipeline, the checks and the art scripts (not in the ZIP)
tools/CONTRACT.md                  the byte-level format of every file in data/
NOTES.md, .gitignore, .gitattributes
```

**The face.** `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256 `fdf1a28c…cdb262`) and
`fonts/OFL.txt` (sha256 `d1adfffd…be6269`) are byte-for-byte copies of Global Weather's, the
template's house face. Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.
The data writes 32 characters that cut lacks: the Greek small letters of the Bayer designations
(U+03B1–03C9), the superscript figures 4 to 9 of indices such as α¹ Cen (U+2074–2079), and the
ʻokina of ʻOumuamua (U+02BB). They come from `fonts/ysabeau-office-milky-way-extra.woff2` (5 620 B,
sha256 `efdeac3fc405906974460b62b3e3b0c606da4f87c80346b1c7d0c32ca068e42f`), a second subset of the
same face cut by `tools/art/font_extra.py` with the house recipe from the same pinned upstream
(google/fonts commit `9710da1e…`, `YsabeauOffice[wght].ttf`, sha256 `0f305c84…`), weight 400–650,
and declared as a second `@font-face` of the family with a `unicode-range` of exactly those code
points. Built twice with fonttools 4.60.2: byte-identical. The OFL.txt above covers both files.

It has to be served over HTTP. Opening `index.html` from disk looks broken, because a browser
blocks `fetch()` of `file://` addresses and every byte of data arrives that way.

```
python3 -m http.server 8000          # then open localhost:8000 in a browser
```

---

## Using it

- **Drag** to turn, **pinch** to zoom, **two fingers** to move. One pinch goes from a moon's surface
  to the Local Group; nothing switches modes on the way. A touch during a flight lands it at once.
  **Zoom in** and **Zoom out**, the first two keys at the right, do the same with one finger or a
  keyboard: about 2.8 times a press.
- **The three scale words** under the name, **Solar System**, **Neighborhood** and **Milky Way**,
  fly to a good view of each scale; the word for the scale you are at carries the selection mark.
- **Tap** a planet, moon, asteroid, star, cluster, satellite galaxy, stream or any label (the arm
  fits and the disk-and-bar model too) for a card: what it is, its distance from the Sun as the one
  large figure, the rows that are known about it and where the numbers come from; **double-tap** to
  fly to it. When the camera is aimed at what the card describes (Fly there, a double-tap, Find),
  the picture shifts so it sits in the part of the plate the card leaves free; otherwise the card
  moves to the foot of the picture when it would cover what it describes.
- **The Reach**, under the picture, is a ruler of distance from the Sun from 0.001 AU to 10¹² AU,
  inked wherever these catalogs hold an object on the day shown, with a notch at your own
  distance. Its blank stretch, from the farthest small body (about 160 AU) to the nearest placed
  star (1.30 pc), is the reach of the catalogs, not empty space; About says so.
- **The caption** says how far you are from the Sun and how wide the screen is there. About names
  the Reach's gap with its numbers on the day shown. The credits are in About.
- In the Solar System **the player** plays the planets and moons through time: Play, a speed key
  written as an exposure (`1 s = 7 d`: one second of play is a week), the date as the one large
  figure in UTC, **Now**, Previous year and Next year, and the app's own track over the days of the
  shown year. A touch anywhere on the track lands on the day under the finger, and every frame of a
  scrub draws that day. Outside the Solar System the player hides: at those scales nothing visibly
  moves in a human lifetime, and the app does not pretend otherwise.
- **Find** (the lens) searches every named object; **Layers** switches each dataset on and off and
  says what the asteroids' and comets' four colors mean;
  the **About** key at the name's right opens About, with every source, license and accuracy note.
- **Hide the controls** (the last key) leaves the picture, the About key, the caption and the player;
  the corner key **Show the controls**, or Escape, brings the rest back. The choice is remembered.
- Reduce Motion: flights become cuts, play jumps one unit of its speed once a second, and every
  transition is instant.

---

## Code map

`app.js` wires the pieces together and owns the render scheduler: a frame is drawn when something
changed, and the loop stops as soon as nothing is moving (a flight, inertia or play keeps it
running; a hidden page or an open sheet stops it). Everything else is in `js/`:

| File | Owns |
| --- | --- |
| `view.js` | the camera rig: target, distance and direction in float64 AU; gestures, inertia, and flights that pull back while the target moves (van Wijk and Nuij's path) |
| `solar.js` | the Sun, planets, moons, rings, orbits, trails and small bodies, at true size |
| `stars.js` | the stars in 3D by absolute magnitude, constellation figures, exoplanet hosts, the Gaia sky |
| `galaxy.js` | the galaxy's measured tracers and fitted models, in the Galactocentric frame |
| `galaxydata.js` | decodes `galaxy.json` and the young-star and model PNGs: the frame matrix, pixels and kpc, map values |
| `ephem.js` | decodes the DE430 Chebyshev table and the satellite fits; UTC and TDB |
| `rotation.js` | the IAU rotation model of every globe (pole, prime meridian, periodic terms) |
| `smallbodies.js` | asteroid and comet orbits, propagated on the CPU in float64 |
| `rule.js` | the Reach: its census (pure, tested in Node) and its drawing |
| `track.js` | the time track: the days of the shown year, the scrub, the keys |
| `units.js` | every number, unit and date the app writes, in SI notation |
| `plate.js` | the plate's colors, pasted from `python3 milky-way/tools/art/palette.py --json` |
| `labels.js` | screen labels: priority, overlap culling, a pool of elements, widths in the face |
| `gfx.js` | the shaders: magnitude-true stars, lit globes, rings with shadows, the sky sphere, ribbons |
| `util.js` | unit constants, float64 vector helpers, the `localStorage` wrapper, fetches that fail in words |

### One zoom across fifteen powers of ten

The camera lives in float64, in astronomical units, heliocentric, on ICRF axes (`view.js`). Nothing
on the GPU ever sees those numbers. Each frame the scene is drawn in three passes that share the
camera's orientation but each has its own units and its own camera:

1. **Stars**, in parsecs, with the Sun at the origin: the Gaia sky sphere first, then the stars.
2. **The galaxy**, in kiloparsecs, in astropy's Galactocentric frame, carried into ICRS by the
   `to_icrs` matrix that the pipeline computed with astropy and shipped in `galaxy.json`.
3. After a depth clear, **the Solar System**, in AU relative to a *floating origin* at the camera's
   target, with the whole group scaled so the target is one unit from the camera. That is what lets
   a moon a few hundred kilometers away and Neptune four light-hours away share one frame: float32
   only ever holds offsets from the thing you are looking at, and the logarithmic depth buffer sees
   the nearest geometry at a distance of about one.

"Up" is not fixed. Close to the Sun it is the ecliptic north pole, so the planets lie flat; beyond
about a light-year it is the galactic north pole, so the disk does; in between it turns smoothly.
The view direction is kept continuous through the turn, so leaving the Solar System shows its plane
tilting by about 60° against the galaxy's, which is the real angle between them. The picture's
angular scale is held when only the plate's height changes (focus mode, the player leaving), so
the picture does not zoom by itself.

### Labels and picking

Labels and taps work in the same float64 AU space as the camera: every candidate is projected in
JavaScript, never read back from the GPU. Labels are placed highest priority first and skipped
when they would overlap one already placed, so a crowded view thins out instead of piling up. Each
label is set in the house face over a halo of space, so it reads on a star or the galaxy's glow.

---

## The data

Everything in `data/` is written by one pipeline step each (`tools/NN_*.py`), in the byte formats
`tools/CONTRACT.md` sets out. Every source is fetched from a pinned address and checked against its
sha256 before it is used. Every step writes a credits fragment (`tools/credits/*.json`), and
`90_about.py` turns those fragments into About (`data/about.json`) and `CREDITS.txt`, so the app,
the credits file and this table all name the same sources. The art pass of 2026-10-01 changed no
byte of `data/`; its follow-up the same day put the pipeline's prose into US English and ran it
again, and only prose changed: every binary, image and number is what it was (`tools/DECISIONS.md`
section 9 has the proof). About writes "Sizes and distances" and "Software and type" in its own
words, so it leaves out `about.json`'s blocks of those names.

| Files | What | From | Size |
| --- | --- | --- | --: |
| `ephem.bin`, `ephem.json` | the Sun, the planets, Pluto and the Moon, 1900–2099 | JPL DE430, refitted as float32 Chebyshev series | 1.32 MB |
| `moons.bin`, `moons.json` | 21 major moons of Mars, Jupiter, Saturn, Uranus and Neptune, 1950–2049 | JPL MAR097, JUP310, SAT425, URA111, NEP081, fitted as precessing ellipses | 454 KB |
| `physical.json` | radii, shapes, poles and rotation of 32 bodies; masses; Saturn's and Uranus's rings | NAIF `pck00011.tpc` and `gm_de440.tpc`; SAT425's ring radii; PDS Ring-Moon Systems Node | 23 KB |
| `smallbodies.bin`, `.json` | 9 989 asteroids, trans-Neptunian objects and comets | JPL Small-Body Database (every body with H < 12, plus named near-Earth asteroids), MPC CometEls, JPL Horizons, ESA NEOCC | 693 KB |
| `tex/` | global maps of the Sun, Mercury, Venus (radar), Earth by day and night, the Moon, Mars, Jupiter, Pluto, Io, Ganymede and Triton; disk colors of the gas giants | NASA, USGS Astrogeology, Cassini (JPL/SSI), SDO via Stellarium, LROC via Stellarium; Karkoschka (1998) spectra | 1.69 MB |
| `sky/` | the Milky Way as seen from the Sun, 2048 × 1024 | Gaia DR3 source counts (1.8 billion stars), STScI/MAST HATS | 109 KB |
| `stars/deep.bin` | 209 156 stars between 20 and 500 pc, positions and absolute magnitudes | AT-HYG v3.2; distances mostly Gaia DR3's (388 from Hipparcos 2007, 9 from Gaia DR2) | 1.67 MB |
| `stars/named.json` | 11 049 stars: all naked-eye stars, everything within 20 pc, every exoplanet host within 100 pc | AT-HYG v3.2 and HYG v4.1; IAU star names | 771 KB |
| `stars/exoplanets.json` | 1 259 confirmed planets of 892 stars | Open Exoplanet Catalogue | 69 KB |
| `stars/constellations.json` | 88 IAU constellation figures | Stellarium's `modern_iau` sky culture | 12 KB |
| `stars/colour.json` | star color by temperature (the file keeps its pipeline name) | Planck spectra × CIE 1931 observer; Mamajek's dwarf sequence | 12 KB |
| `galaxy/galaxy.json` | 194 globular clusters, 54 confirmed satellite galaxies and 11 candidates (LVDB has not confirmed them as galaxies; they could still be star clusters), at measured distances; 100 stellar streams; 7 + 4 spiral-arm fits; the frame | Local Volume Database; galstreams; SpiralMap (Reid+2019, Drimmel+2024); astropy | 402 KB |
| `galaxy/young-*.png` | where young stars crowd, within about 4 kpc of the Sun | Poggio+2021 (Gaia EDR3) and Gaia Collaboration, Drimmel+2023 (Gaia DR3), via SpiralMap | 16 KB |
| `galaxy/model.png` | the disk and bar glow: a *model* | McMillan 2017 disks + Portail 2017 bar (Sormani 2022 form), integrated with Agama | 17 KB |
| `about.json` | About | the credits fragments | 75 KB |

`node tools/check.mjs` prints the ZIP's size, built exactly as the repository's workflow builds it.

**Licenses.** Most of this is public domain (NASA, USGS, JPL/NAIF) or under open licenses
(CC0, MIT, BSD, CC BY-SA 4.0). Two groups carry conditions of their own:

- **Gaia-derived files are non-commercial.** `stars/deep.bin`, `stars/named.json`,
  `sky/gaia-dr3-counts.jpg` and `galaxy/young-*.png` carry values from ESA's Gaia mission, which ESA
  licenses under CC BY-NC 3.0 IGO. This app uses them non-commercially, as that license requires.
  The star files are also adapted from AT-HYG and HYG (CC BY-SA 4.0) and are shared under that
  license as well. Anyone who reuses them has to meet both sets of terms, so commercial use is
  ruled out. ESA's own license page could not be read from the build network; the license is
  quoted from a web-search summary and from other projects' license files, and `CREDITS.txt`
  says so.
- **The young-star maps** (`galaxy/young-gaiadr3-ob.png`, `galaxy/young-poggio2021-ums.png`) come
  from SpiralMap, which includes them with their authors' permission. That permission was given to
  SpiralMap; no separate grant to downstream redistributors was found. On top of that they are
  Gaia-derived, so non-commercial, as above.
- **CC BY-SA 4.0 files.** `tex/sun.jpg` and `tex/moon.jpg` (Stellarium's copies of the SDO HMI
  and LROC maps) and `stars/constellations.json` (Stellarium's `modern_iau`) are adapted under
  CC BY-SA 4.0 and shared under the same license.

A few sources state no license that could be read from here: the JPL Small-Body Database, ESA's
NEO Coordination Centre, and the New Horizons Pluto map. `CREDITS.txt` quotes what could be
found for each, and the root `LICENSE` lists every carve-out. The BSD and MIT licenses of the
galaxy sources whose numbers ship (galstreams, SpiralMap, Agama) are quoted in full at the end of
`CREDITS.txt`.

---

## Rebuilding

```
./tools/build_all.sh
```

This creates `tools/venv` from `tools/requirements.txt` if it is missing. It then runs the steps in
order (10 ephemeris, 11 moons, 12 physical, 20 small bodies, 30 textures, 31 sky, 40 stars,
50 galaxy, 90 about) and finishes with `tools/verify_data.py`, which runs every `verify_*.py` and
fails on any file in `data/` that no step claims.
The first run downloads about 6.3 GB into `tools/.cache/`, which is gitignored (measured on
2026-10-01: 6 299 504 269 B in 162 files): 2.4 GB of JPL satellite ephemerides and 3.7 GB of USGS
mosaics, Mercury's alone 1.9 GB. After that the build does not touch the network. A connection
reset during a download stops the build (`curl` error 56), and the next run starts that file over. `MILKYWAY_SEED=<folder>` hard-links earlier downloads instead of
fetching them again, and `OUT_DATA=<folder>` writes the `data/` files somewhere else. It redirects
`data/` only: `CREDITS.txt` and `tools/credits/*.json` are always rewritten in place, so check
`git status` after a trial rebuild.

The build is deterministic. From a warm cache a full rebuild takes about five minutes, and a
rebuild into a separate folder (`OUT_DATA`) produced every file byte-identical to the committed
`data/`, with `CREDITS.txt` and the credits fragments unchanged: JSON is written with fixed key
order and rounding, PNGs and JPEGs with fixed encoder settings, and nothing records the time of the
build. The retrieval date in the credits is a constant in `tools/common.py`. One known limit:
`galaxy.json` records the frame round-trip error, about 2 × 10⁻¹³ kpc. That value is
floating-point noise, so a build on a different CPU could differ in those few bytes. Measured on
2026-10-01 on an Apple M4 (numpy on Apple's BLAS), against `data/` as built in the original Linux
container: the two least-squares fits differed in their last bits (`ephem.bin` in 4 142 of 329 694
float32 values, `moons.bin` in 20 341 of 112 050; every error they print, and both JSON manifests,
identical), the three galaxy PNGs had identical pixels in a different deflate stream (and so other
byte counts in `galaxy.json`), and the round-trip error printed 2.17e-13 for 2.27e-13; everything
else was byte-identical, and a warm rebuild took 116 s. A rebuild on another machine is therefore
compared with that machine's own build of the unchanged scripts, not with `data/`
(`tools/DECISIONS.md` section 9).

After `verify_data.py`, run `for t in tools/test_*.mjs; do node "$t" || break; done`. The pipeline's
node tests (`test_ephem`, `test_rotation`, `test_smallbodies`, `test_galaxy`, `test_stars`) check
that the JavaScript decoders reproduce the reference values the build exports into `tools/.cache/`
(not shipped); each exits non-zero on a mismatch.

**The art pass's tools** need no cache and run from a fresh clone:

- `node tools/check.mjs`: the static checks of `Template/HOUSE.md` section 7.1 for this app (what
  the ZIP ships, no address with a scheme, every reference present, the faces' and every data
  file's sha256, the camera's strings, SI, the tells, the budgets, US spelling).
- `node tools/test_decode.mjs`: the decoders still give the positions recorded before the pass,
  and the Reach's census inks exactly the columns `tools/census.mjs` works out from the data with
  its own formulas.
- `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs`: the app driven in
  headless Chromium at 390 × 844, DPR 2, with real touch, light and dark (`SCHEMES=light`,
  `SCRUB=0`, `SCREENSHOTS=1` narrow or extend it). It fails on any console error or warning but
  headless Chromium's own "GPU stall due to ReadPixels", and never writes `screenshots/app.png`.
- `python3 milky-way/tools/art/palette.py` (from `Template/`): every chrome token, plate color and
  contrast figure in `ART.md`; `--json` prints `js/plate.js`'s object.
- `tools/art/font_extra.py`: the supplement's recipe (fonttools 4.60.2 and Brotli, any venv).

`python3 tools/package_snuggery.py` builds `dist/milky-way.zip` the way the repository's workflow
builds `zips/milky-way.zip`: the git-tracked files at the root of the ZIP, the `.md` files
included, without `tools/`, `screenshots/`, `dist/` or dotfiles. It reads tracked files from the
working tree, so uncommitted edits go in, and it refuses the ZIP if any app file contains an
address.

The workflow ("Build app ZIPs") runs on a push that changes app code, but its path filter leaves
out every `*/data/**` file, so that the hourly snapshot refreshes of the other apps do not rebuild
every ZIP. A commit that changes only `milky-way/data/` (a data rebuild, say) therefore does not
rebuild `zips/milky-way.zip`, and neither does a commit whose message says `[skip ci]`. After one,
run "Build app ZIPs" by hand (Actions, then Build app ZIPs, then Run workflow).

Measured in headless Chromium with software WebGL before the art pass, the JavaScript work per
frame while time plays was about 6 ms. That is a trend on a desktop, not phone evidence: the
phone's frame time is one of the owner's checks.

---

## Accuracy, honestly

Each number below was measured by a verify script against an independent computation, not
estimated.

**Planets and the Moon.** The shipped Chebyshev table was checked against DE430 itself at 25 000
random epochs from 1900 to 2099. Worst error: Mercury 20 km, Venus 9 km, Earth 12 km, Mars 26 km,
Jupiter 67 km, Saturn 99 km, Uranus 170 km, Neptune 285 km, Pluto 292 km, the Moon 2.6 km from
Earth's center. At the ends of the fitted intervals the error is up to about 12 % higher (Earth
12.3 km). DE430 itself is far better than that. The error is the price of float32 storage, and
at the sizes the app draws it is far below a pixel.

**Moons.** Each moon's JPL ephemeris is fitted, window by window, with an ellipse that precesses.
Worst error over 1950–2049: from 3 km for Phobos and Triton up to 900 km for Titania and Oberon
and 1 300 km for Hyperion. That is 0.001–0.2 % of each orbit. Where two fit windows meet, a moon
can jump by up to that much, about 0.09 % of Hyperion's orbit, which is too small to see.
Rebuilding each giant planet's center from its moons matches JPL's planet position to 0.2 km.
Outside 1950–2049 the moons are hidden, not extrapolated.

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

**Stars.** Distances are Gaia DR3's for 208 759 of the 209 156 deep stars, and Hipparcos's or
Gaia DR2's for the rest. Every named star's card says which. Six Gaia IDs appear twice in
AT-HYG within 500 pc; that is AT-HYG's own duplication, left as it is. `named.json` stores
positions to four significant digits. That moves a star's direction by up to 149″ (median 26″),
which cannot be seen at phone field of view. A very close pair, such as α Centauri A and B,
does land on one point. 76 named stars have no usable parallax (Alnilam, for example). They are
not placed in 3D: they are drawn on the sky as seen from near the Sun, at their V magnitudes, with
the 30 figure lines that join them, and fade out as the camera leaves the Solar System. They have
no distance, so the Reach leaves them out.

**Maps.** Each map was checked against known features and against its own mirror image and 180°
shift, to catch flipped or rotated maps: Olympus Mons, Tycho, Maxwell Montes, Sputnik Planitia,
Loki Patera, the Great Red Spot, and 12 of 12 land and sea test points on Earth. Jupiter's map is a
December 2000 snapshot. The Great Red Spot drifts in longitude, so on other dates it is right in
character but not in position. Pluto's map uses the New Horizons team's frame, while the app
turns Pluto with the IAU's `pck00011` model. The gazetteer puts Sputnik Planitia where the map
has it, but the New Horizons kernel could not be read here, so the offset between the two frames
is not proven. Earth's clouds are not drawn; the Blue Marble map is cloud-free by construction.

**The galaxy.** The frame matrix reproduces astropy's Galactocentric v4.0 transformation to
8 × 10⁻¹³ kpc. All 259 clusters and satellite galaxies map back to their cataloged RA and Dec
within the 0.1 pc rounding. Every stream point lies within its cataloged distance range. The Reid
arm fits pass a median 0.22–0.33 kpc from the masers they were fitted to (checked against
Reid+2014 at build time). The two arm models disagree by about 0.9 kpc near the Sun, and both are
drawn. 48 of the 100 streams have no measured distance track, or follow a constructed great
circle. They are drawn dashed and fainter, and their cards say "approximate".

**The plate's colors** are display choices, measured: orbits, trails and markers are one neutral,
the small bodies four groups by where their orbits lie (the card names each one's class), and the
galaxy's categories each one hue that every other category can be told from under the three
common color-vision deficiencies (`tools/art/palette.py` prints each figure). The stars keep their
colors by temperature, and the globes their maps and measured colors.

**What is left out on purpose** is listed in About under "What this app does not show". In short:
there is no picture of the galaxy from outside, only measurements and models. Venus has no true
color, and Saturn, Uranus and Neptune have no surface maps. 17 moons have no sourced map or color
and are drawn neutral gray; Saturn's rings are a uniform neutral gray; and Hyperion, which has no
rotation model, is drawn as a sphere of its mean radius. The colors of the galaxy model, the
young-star maps and the Gaia sky are display tints. Charon and Neptune's rings are not shown, and
Uranus's rings (about 2 to 96 km wide) are lines. The deep star catalog stops at 500 pc, though
the named naked-eye stars reach about 3.6 kpc; the 76 with no usable parallax are drawn only on the
sky from near the Sun. The 21 moons are shown only from 1950 to 2049. No body casts a shadow on
another (only Saturn and its rings shadow each other), so eclipses are not drawn. The asteroid list
is limited by brightness.
