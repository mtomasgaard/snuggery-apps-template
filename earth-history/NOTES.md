# Earth's History — notes

An offline globe and map of the Earth at 90 moments from 750 million years ago to today, one per
painted map in C. R. Scotese's PALEOMAP PaleoAtlas, running inside Snuggery's sandboxed web view.
Today's coastlines and the pieces of today's crust are carried back with Scotese's own plate model,
and a tap on the Earth says what was there and where that rock is now.

**One reconstruction, said out loud.** Every map, outline, rotation and elevation class comes from
Scotese's PALEOMAP model; the temperature and rain come from one climate model (HadCM3L) run on his
geography. Other reconstructions put the continents elsewhere, especially before about 200 million
years ago. The app shows the 90 maps and nothing between them: a cross-fade is a display effect,
not a morph.

`DESIGN.md` is the specification; `tools/CONTRACT.md` is the byte layout of every data file;
`CREDITS.txt` names every source, its owner, license and what was changed; `ART.md` is the art
direction ("Deep Field Atlas") and what it changed.

**How it looks, and why.** The Earth hangs in a night field in both themes, framed by a neatline as
an atlas plate is, with a thin scattering rim on its lit side. The page under it is survey paper (light) or deep
navy (dark). Ages and names are set in Newsreader, the rest in Atkinson Hyperlegible, both
vendored in `fonts/`. The time slider is a stratigraphic column on its side: the chart's period
colors are the track and the era colors band above them. The night, the frame, the rim, the glow
and the shading are display choices, not data, and About says so. The painted maps are never altered.

---

## What a person can do

- **The first launch** opens with a small globe fading in at 750 million years ago and the 90 maps
  playing to today in about five seconds, the globe growing into place at the end. It happens once. Skip, or any touch or key, ends it, and it never
  runs under Reduce Motion.
- **The view follows the continents**: at every map it eases to where today's Africa was carried
  (Africa is the model's reference frame), so land stays in view all the way back.
- **Turn the globe** with a finger (the view is then yours until a double-tap gives it back to the
  continents), **pinch** to zoom up to 3×; a flick keeps it turning and slows to a stop (not under
  Reduce Motion). **Globe | Map** switches to
  Scotese's Mollweide map, where a drag slides the central meridian; the view carries across.
- **Move through time**: drag the slider — or the curves strip under it — (the map under the finger
  shows at once from a small sheet of all 90 maps, then the full map fades in when the finger rests or
  lifts), tap **‹ ›** for one map older or newer, **▶** to play toward today at 1.5 maps a second (a
  time-lapse: the thumb glides and the age counts to each map's own age), or
  use the arrow keys, Page Up/Down, Home and End on the focused slider.
- The **age row** gives the map's age as Scotese's Table 1 does ("251 million years ago") and the
  period, epoch and age that contain it on today's international chart, with the period's chart
  color. The slider under it is the chart itself: period colors for the track, the eras above,
  one hairline per map below, and a wavy cut where the axis squeezes 750–550 million years.
- **Lenses**: *Surface* is Scotese's painting; *Temperature* and *Rain* color the Earth with the
  climate model's annual means over a dimmed Surface, with a legend (a tap on it switches US and
  metric units). The three oldest maps have no model run, and the panel says so.
- **Coasts** (on by default) draws today's coastlines where their crust was; **Plates** outlines the
  pieces of today's crust that exist at that map's age, with arrows for how each large piece moved over
  the million years before the map.
- The **curves strip** shows the model's global temperature, carbon dioxide (Foster's fit and its 68 %
  band; the model's input, dashed, before 419.5 million years ago) and sea level on the slider's own
  axis, with a line at the map and its three values.
- The **sheet** (tap or drag its grip: peek, half, full) holds the period card, "This map" in
  Scotese's own words with any disagreement with today's chart, then-and-now tiles (temperature, CO₂,
  sea level, land and shelf seas, the Sun's brightness), events within 5 million years, **Look for**
  pins (a tap turns the Earth to the spot, drops a pin that rides its plate and opens a card) and every
  source used.
- **Tap the Earth** for a card, anchored to the pin with a pointer; collapsed it never cuts inside a
  number, and its chevron opens the rest and the footnotes: the spot then (latitude, longitude, Scotese's elevation class, the
  climate model's temperature and yearly rain), where that crust is now and the nearest city on the
  list, and how fast and which way it was moving.
- **Find** a city among 300: the Earth turns to where it was, a pin rides its plate, and the card says
  what was there — or that the model does not carry that crust back so far.
- **About** explains how to read each part, what to keep in mind (one reconstruction, the weak
  longitude, a climate model not measurements, the elevations' "first draft"), what is not shown and
  why, every source with its license and what this app changed, and a Units setting.
- Wide screens (700 px and up, or a phone turned sideways) put the Earth on the left and a 400 px column
  on the right. Everything is remembered between launches; both themes follow the system.

---

## The folder

```
index.html, style.css      the page and its styles; index.html at the folder root
js/                        the app's ES modules (code map below)
miniapp.json               Snuggery's name, entry point, description and version
CREDITS.txt                every source, license and adaptation (written by tools/90_about.py)
fonts/                     Atkinson Hyperlegible 400/700, Newsreader 500 and 400 italic (WOFF2), OFL.txt
DESIGN.md, NOTES.md, ART.md  the specification, these notes and the art direction (all ship in the ZIP)
data/                      written by tools/ only; see the table below and tools/CONTRACT.md
tools/                     the data pipeline (Python), its contract, and the app's tests (Node)
```

`tools/` never ships: the template's ZIP workflow leaves out `tools/`, `screenshots/` and dotfiles.

## Run it locally

It has to be served over HTTP; opened from disk, the browser blocks `fetch()` of the app's own files.

```
cd Template/earth-history
python3 -m http.server 8000          # then open localhost:8000 in a browser
```

---

## Tests

```
node tools/check.mjs          # limits, no URLs in code, relative references, data/ exactly as claimed,
                              # miniapp.json, no AI vendor names, code budget, the ZIP as build-zips.yml builds it
node tools/test_proj.mjs      # both projections: round trips on a 1° grid, and agreement with the shader's formulas
node tools/test_plates.mjs    # 1,000 pygplates reference points at 10 of the 90 times; the tap lookup vs 300 places
PLAYWRIGHT_MODULE=…/playwright/index.mjs node tools/shoot.mjs [outdir] [scene …]
SCREENSHOTS=1 PLAYWRIGHT_MODULE=… node tools/shoot.mjs   # also writes screenshots/app.png and ten named scenes
```

`test_plates.mjs` needs `tools/work/plates_ref.json`, which `tools/build_all.sh` writes (step 20).
`shoot.mjs` needs Playwright (see its header); it serves the folder itself, runs at 390 × 844, DPR 2,
touch, in light and dark, and fails on any console error or warning, page error, failed request or
request outside its own server, `data:` or `blob:`. Each theme starts from a fresh profile, so the
first-launch opening runs. The driver watches it, takes the `opening` picture, then ends it with
`__eh.skipIntro()` before the other scenes.

### Results at the time of writing (2026-09-30; Node 26, Chromium 153 on SwiftShader)

- `node tools/check.mjs`: all 10 checks pass; 132 files ship; app code **203,817 bytes** of the
  250,000 budget; no AI vendor, product or model-family name in the 33 shipped text files; **ZIP 6,950,425 bytes** (cap 8,000,000; 6,953,185 after
  the art direction).
- `node tools/test_proj.mjs`: `test_proj: OK`. The orthographic round trip is at most 1.94e−13 rad
  over 192,961 points; the Mollweide round trip at most 4.22e−15 rad (latitude) and 1.99e−14 rad
  (longitude); the inverses match the §5.3 shader formulas to 1.13e−15 rad.
- `node tools/test_plates.mjs`: `test_plates: OK`, 10,000 rotations, max error 0.323 km, and the
  tap lookup puts 300 of 300 places on pygplates' plate.
- `tools/build_all.sh` from the cache, after the text corrections in `tools/content/story.yaml` and
  the credits changes: exit 0, `verify_data: OK`; step 60 reports 47 sources, 13 map claims all ok
  (the Paleogene claim now measures maps 13, 12, 11, 10 and 9: southern paint 0.0001, 0.0083,
  0.0131, 0.0258, 0.0360); a second run left all 105 `data/` files and `CREDITS.txt` byte-identical.
  `tools/.venv/bin/python tools/verify_data.py --cross-only`: `verify_data: OK`.
- `SCREENSHOTS=1 node tools/shoot.mjs`: `all checks pass`, **176 checks**, 0 console errors or
  warnings, 0 requests outside its server. New or changed since the art direction:
  - The view follows the continents: after a step to map 49 it sits exactly on the followed center
    (0.3°, −18.7°); a turn to a place stops it; a double-tap starts it again.
  - The opening is running when the loading screen lifts. (A separate Playwright probe, not part of
    `shoot.mjs`, held `plates.bin` back 1.5 s: the caption and Skip showed from its first sample and
    the opening ran before the plates arrived.)
  - The card sits above Chicago's pin, 104 px tall (two lines of "then", two of "now") and 300 px
    wide; "More" opens it to 151 px. The tap is made at the pin's projected spot.
  - The temperature legend reads "Air temperature, yearly mean · climate model" on one line, with
    "1.5 m (5 ft) above the surface" in its accessible name; its labels and rain's do not touch.
  - Text contrast is at least 4.5:1 for 35 text styles, the notices now on glass (lowest **5.79:1
    light, 6.73:1 dark**).
- The earlier scenes all still pass: the age row equals the manifest at 90 of 90 stops and stays
  inside its row, the scrub puts a map on screen at 121 of 121 finger positions, and the cache stays
  within 8 maps (37.9 MiB of textures by arithmetic).
- `__eh.perf()` after the scripted scrub (SwiftShader, a trend and never phone evidence): 101 frames,
  a WebGL submit median of 0 ms (p95 0.1), an overlay median of 0.6 ms (p95 0.7), and a frame total
  median of 0.8 ms (p95 0.9, max 1).
- Land in view, measured on the shipped maps (area-weighted land in the visible hemisphere, 90 maps):
  a fixed view on 105° W shows under 10 % land on 42 maps; the followed view shows under 20 % on none.

### On the phone (nothing above is evidence for these)

Import the ZIP; scrub the whole slider (a map at every stop, no blank frame); play to today; switch
globe and map; each lens; Plates and Coasts on; Find a city; tap the Earth; pinch; rotate the phone;
background and return; frame time (five taps on About's version line) and memory. For the art
direction: the first-launch opening (reinstall or clear the app's data) runs smoothly and the counter
keeps pace with the maps (it is clamped to the neighboring map's age, so under SwiftShader's slow
frames it trailed by at most one map); the sheet's glide between heights has no flash of paper; the fonts render (Atkinson's
slashed zero is expected); Reduce Motion turns off the opening, the glide and the pin drop. Also whether iOS 18's WebKit accepts `createImageBitmap(…, { imageOrientation:
'from-image' })`: if it does not, every map decodes through `Image.decode()` instead, which
`__eh.perf().cache.fallbackDecodes` counts.

Costs no desktop browser can show, each with what to do if it fails:

- **The glass over a live canvas.** The segmented controls, toggles, legend and notices use
  `backdrop-filter: blur(12px)` over a WebGL canvas that redraws every frame during a drag, a fling,
  play, the view's follow and the opening; that is compositor work `__eh.perf()` does not time. Drag
  the globe with Plates and Coasts on and a lens legend showing, and judge the smoothness. If it
  stutters, drop the blur and raise the glass to about 0.8 opacity (on night it looks nearly the same).
- **The opening's frame pacing** on the oldest phone at hand: about 18 stop changes a second, each
  rotating the coasts and outlines and rebuilding the sheet, the card and the curves (one stop change
  measured 1.3–1.4 ms median in desktop Chromium, a trend only). If it stutters, skip the sheet, card
  and curves updates during the opening and render them once at its end.
- **GPU memory after a full sweep**: the frame-time readout's MiB line (8 maps, the preview sheet
  and two frozen blends come to 37.9 MiB of textures by arithmetic, plus the canvases at the screen's
  scale). The app must not be reloaded by iOS when it returns from the background.
- **The follow** at play speed: the view should glide with the continents, not lurch; with a pin set,
  VoiceOver should read one short line when the slider settles, not the card at every map.

---

## Code map

| File | What it does |
| --- | --- |
| `js/app.js` | Boot and loading order, the state, the frame scheduler (one frame when something is dirty; only a blend, a fling, a turn-to, the view's follow, a pin drop or the opening keep going), the view that follows the continents, the first-launch opening, persistence, pins (tap, city, Look-for) and their callout card, the climate lens and legend, notices, units, the frame-time readout, the accessible description, `window.__eh` |
| `js/data.js` | Loads every data file and checks it against the contract; `.bin` decoders as typed-array views on one buffer; climate and elevation lookups; lazy loads |
| `js/earth.js` | WebGL2: the program, the proxy sheet, the 8-map cache (least recently used out), the loader (one decode running, one waiting), the 200 ms blend and its mid-blend freeze, the climate texture and its LUT, context loss |
| `js/shader.js` | The GLSL: one full-screen triangle; the inverse orthographic and Mollweide; the seam-free texture gradients; the blend; the lens; shading, the atmospheric rim and halo, and the night field |
| `js/proj.js` | Forward and inverse projections (pure, tested in Node), the view state and its fits (the Earth seated between the controls), gestures |
| `js/plates.js` | Quaternions, rotating today's rings and coasts to each map, validity, arrows, the tap lookup (winding number), distances |
| `js/overlay.js` | Canvas 2D: coasts, outlines weighted by area, arrows, pins that drop, and labels, the map ellipse's edge; horizon clipping and decimation |
| `js/timeline.js` | The broken axis, the stratigraphic slider (period track, era band and names, hatch, unconformity, ticks, labels, ring thumb, play glide), the age row and its rolling counter, play/step buttons; the curves strip scrubs through it |
| `js/curves.js` | The curves strip: three sparklines with bands on the slider's axis, the hatch before 540 Ma, the marker with a glowing dot per curve, and the three values (from the manifest's tiles) |
| `js/sheet.js` | The bottom sheet: its three heights, the glide between them, and its grip, the period card, This map, the tiles, events, Look for, sources; short citations |
| `js/lut.js` | The two lens ramps, the 256-entry LUTs built from climate.json's encoding, the legend's gradient and ticks |
| `js/find.js` | City search (three ranks, accents ignored) and its overlay |
| `js/about.js` | The About panel from about.json and story.json; the units setting; five taps on the version line |
| `js/units.js` | US and metric formats, ages as Table 1 writes them, chart ages, the Sun's brightness (Gough 1981) |
| `js/util.js` | Small helpers and the `localStorage` wrapper (`eh.` keys, every access in try/catch) |

`window.__eh` (inert unless called): `ready`, `settled`, `goto`, `step`, `play`, `pause`, `setView`,
`setLens`, `toggle`, `setUnits`, `setSheet`, `tap`, `look`, `lookFor`, `find`, `choose`, `about`,
`perfHud`, `cityAt`, `project`, `state`, `ageRow`, `readout`, `notice`, `legend`, `curvesLabel`,
`sheetHead`, `sheetText`, `perf`, `resetPerf`, `loseContext`, `restoreContext`, `intro`, `skipIntro`,
`card`, `legendBoxes`, `follow`.

## The data

Every file is written by `tools/build_all.sh` and described byte by byte in `tools/CONTRACT.md`.

| File | Bytes | What the app does with it |
| --- | --: | --- |
| `surface/m01.webp` … `m93.webp` | 4,747,276 (90) | The painted maps, 1024 × 512 equirectangular; one full map per stop, 8 kept on the GPU |
| `surface/proxy.webp` | 435,250 | All 90 maps at 256 × 128 in one sheet: shown at once while scrubbing |
| `manifest.json` | 59,665 | The 90 stops: ages, labels, ICS units and color, chart notes, climate and elevation slices, tiles |
| `timescale.json` | 31,699 | ICS names, ages and colors: the age row, the period strip, the tick labels |
| `plates.bin` / `plates.json` | 463,644 / 3,652 | 503 rings of today's crust, their valid times, anchors, and a quaternion per plate per map |
| `coast.bin` / `coast.json` | 276,896 / 910 | Today's coastlines in 2,121 pieces, each with its plate and how far back it is carried |
| `places.json` | 35,615 | 300 cities: Find, and the readout's nearest city |
| `climate.bin` / `climate.json` | 1,527,744 / 25,615 | Annual mean temperature and rain per 5 Myr slice: the lenses (one slice-field uploaded as a 96 × 73 texture) and the readout; loaded on the first lens, tap or city |
| `elevation.bin` / `elevation.json` | 1,785,420 / 17,113 | Scotese's elevation classes on a 2° grid: the readout; loaded on the first tap or city |
| `curves.json` | 53,394 | The curves strip's three series and bands on a 1-Myr grid, 0–750 Ma |
| `story.json` | 41,667 | The sheet: 15 period cards and a prologue, 27 events, 17 Look-for pins, 47 sources |
| `about.json` | 22,904 | The About panel: reading notes, 10 caveats, what is not shown, 8 data sources with licenses |

## What this app does not claim

- **One reconstruction.** Every map, outline, rotation and elevation class is Scotese's PALEOMAP
  model; other models put the continents elsewhere, more so the older the map. Longitude is the weak
  coordinate: rock magnetism records how far from the pole a rock formed, not its longitude.
- **A climate model, not measurements.** Temperature and rain are HadCM3L annual means, one run per
  5 million years on Scotese's geography; the tiles compare with the model's own pre-industrial run.
- **CO₂ before 419.5 million years ago is the model's input**, drawn dashed, not a fit to proxies;
  the band is Foster's 68 % band.
- **The elevations are a "first draft"** in their authors' words (report p. 7): the readout's class and
  the land and shelf-sea shares come from them.
- **Nothing between the maps.** A cross-fade is a display effect; the app never draws an Earth between
  two of the 90 maps, and today's ocean floor, which the model holds only for today, has no past here.
- **Nothing here is phone evidence.** Frame times and memory above are headless SwiftShader; a check
  on a phone is the only measure of performance.

## Decisions

Where the design was silent or had to bend, the choice and its reason are in `tools/DECISIONS.md`
§17 (the core) and §18 (the polish), with the measurements behind the design's numbers in §15; it
stays with the build tools and does not ship. The art direction's changes against §3, §5, §6 and §9
are in `DESIGN.md` §19, and its reasoning is in `ART.md`.
