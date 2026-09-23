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

PENDING: the tables of sources, sizes and measured accuracy are filled in from the build.

---

## Rebuilding

```
./tools/build_all.sh
```

PENDING: steps, download sizes, determinism proof and hashes.

---

## Accuracy, honestly

PENDING.
