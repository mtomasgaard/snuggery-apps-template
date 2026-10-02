# Snug Kart — notes

## What it is

An original arcade kart racer for a phone held upright, running offline inside Snuggery. Eight
racers from an imaginary seaside-and-mountain town race three laps of one of three tracks: **Harbour Loop**
 (flat, wide, one narrow gate), **Pinewood Pass** (a 26 m climb through banked sweepers and a
rock cut to the summit hairpins, then a long fast descent) and **Lantern Night** (a figure of eight
at night that crosses over its own start straight on a bridge). Throttle is automatic: one thumb
steers, the other drifts and throws household items picked up from floating parcels — a Kettle
(boost), a Quilt (shield), a Yarn Snare (dropped behind), a Paper Plane (thrown at the racer ahead)
and a Honey Puddle (dropped behind). Everything — the karts, the drivers' faces, the tracks, the
trees, houses and lanterns, every sound — is generated in code at start-up; the only third-party code
is three.js.

`DESIGN.md` is the design the game was built from, kept in step with the code: where the build
changed a number, `DESIGN.md` has the built number. This file records what was built, how to run,
test and change it, and — under Decisions — every place the build moved away from the first design
or decided something the design left open, and why.

### What a player can do

Title screen (the tracks as words, or a sideways swipe on the scene; the track's blurb, length and
rise; the racers' painted faces; the best lap and race per track; the settings Sound, Tilt, Quality,
Controls and Pace as words; About), a 3-2-1-Go countdown with beeps, and
three-lap races against seven rubber-banded AI racers that drift, pass, dodge hazards and use items.
Parcels in rows of four at three places a lap (a double row at the first, so the whole grid can
get one on the opening straight) respawn after 1.5 s; the item button shuffles for 0.8 s and then
holds one of the five items. Drifting charges gold then mint sparks and fires a mini-boost; the
first two races show one line on how.
Verges slow you, walls scrape or stop you, karts bump. A track map, the race card (place, lap, time, last lap and your
own line on the Lap Chart as it is written), a reticle on the racer ahead while a Paper Plane is in
hand, a "Paper plane behind you" warning when one is aimed at you, "Final lap" and "Finished 3rd of
8" banners with a side-on finish camera (a tap skips the wait for the rest of the field), and a
results sheet that opens on the race's Lap Chart, with projected times for stragglers ("about
1:54") and a sentence when a record falls. Sound is Web Audio synthesis (engine,
drift screech, pickups, every item, countdown, laps, finish), off by default. Tilt steering sits
behind iOS's motion permission, off by default. Pause from the button, Escape/P or the page being
hidden; rotation, WebGL context loss and adaptive resolution are handled; Reduce Motion is honored.

**The look** is the template's house system (`Template/HOUSE.md`), set out for this game in
`ART.md`: one face (Ysabeau Office, in `fonts/`), gray chrome in a light and a dark theme, every
sentence over the scene on a plate, and one bold thing, the **Lap Chart**: the race kept the way race
officials kept it on paper, one line per racer through the order at ten timing lines a lap, drawn
from the race just run, yours in ink. The scene keeps each track's own light in both themes.

## The folder

```
snug-kart/
  index.html        the page: canvas, touch layer, the race's plates, the title, results, pause, About,
                    the live region, the five item <symbol>s, one module script
  style.css         the house look: the chrome tokens in both themes, the plates, the keys, About
  miniapp.json      Snuggery's manifest
  NOTES.md          this file
  DESIGN.md         the design, with the built numbers
  ART.md            the look: the Lap Chart, the palette with its contrast figures, the chrome
  fonts/            ysabeau-office-gw.woff2 (the house face, byte-identical to Global Weather's) and
                    OFL.txt, its license
  data/
    tracks.json     the three tracks: control points, sections, parcels, palette, prop counts
    racers.json     the eight racers: names, colors, faces, AI personality
  js/               see "Code map"
  vendor/           three.js r186 (three.module.js, three.core.js, three-LICENSE.txt), byte-identical
                    to ../anatomy/vendor/
  screenshots/      app.png (the README's picture), and title, race, results, about and paused, each
                    -light and -dark (written by SCREENSHOTS=1 node tools/shoot.mjs); left out of the ZIP
  tools/            check.mjs, sim.mjs, items.mjs, test_chart.mjs, shoot.mjs, art/ (palette.py,
                    measure_lapchart.mjs) and DECISIONS.md (the record of the look's pass); left out
                    of the ZIP
```

## Editing the data

The tracks and the racers are data: a person can edit `data/tracks.json` or `data/racers.json`
(in Snuggery, or with an agent). Both are validated on every load — the track checks of
`DESIGN.md` §5.2, and the shape and ranges of each racer — and a bad edit shows a sentence naming
the file and the problem instead of an empty race. Run `node tools/check.mjs` after an edit: it
prints each track's length, radius, grade and corridor table.

**`data/racers.json`** — `{ "schemaVersion": 1, "racers": [ … ] }`, exactly eight entries:

| Field | What it is |
| --- | --- |
| `id`, `name` | a unique short id and the full name (the first word is shown under the face) |
| `line` | the one-line personality shown on the title screen |
| `body`, `trim` | kart colors, `#RRGGBB` |
| `face.skin`, `face.hair` | `#RRGGBB` |
| `face.style` | one of `fringe`, `bun`, `bald`, `goggles`, `cap`, `curls`, `sunhat`, `crop` (anything else paints no hair or hat) |
| `face.expression` | one of `grin`, `calm`, `flat`, `whee`, `smile`, `smirk`, `bigsmile`, `focused` (anything else is a plain smile) |
| `ai.lane` | −0.6 … 0.6, the share of the usable half-width it drives on (+ = right) |
| `ai.skill` | 0.8 … 1.1, a pace multiplier |
| `ai.drift`, `ai.aggression`, `ai.awareness` | 0 … 1: the chance to drift a qualifying bend, item eagerness, the chance to dodge a hazard |

**`data/tracks.json`** — `{ "schemaVersion": 1, "tracks": [ … ] }`; each track:

| Field | What it is |
| --- | --- |
| `id`, `name`, `blurb` | id, name and the title card's line |
| `points` | the closed loop in driving order, each `[x, z, y, width, bank]`: meters, +x east, +z south, y up; road width 8–30 m; bank 0–20°, its sign worked out (always down toward the inside). Point 0 is on the start line, and the 40 m before it must be nearly straight — the grid stands there |
| `verge` | grass or sand each side before the wall, meters (4) |
| `sections` | `{ "from", "to", "kind", "verge" }` stretches by distance along the lap: `kind` `rockcut` (cliff faces for walls) or `bridge` (railings); `verge` overrides the width there |
| `parcels` | distances along the lap of each row of four parcels (two rows 10 m apart make a double row) |
| `ground` | `terrain` (a heightfield that follows the road — use this for a new track), `harbour` or `lantern` |
| `palette` | the colors: `skyTop`, `skyHorizon`, `fog`, `fogNear`, `fogFar`, `asphalt`, `verge`, `ground`, `stone`, `wall`, `accent`, `sun`, `hemiSky`, `hemiGround`, plus per-ground keys (`water`, `houses`, `roof`; `rock`, `snow`, `pines`, `timber`; `lanterns`, `windows`, `trees`, `night`) |
| `props` | counts and spacings: Harbour Loop's `houses`, `lampEvery`, `bollardEvery`, `boats`, `crates`; Pinewood `pines`, `rocks`; Lantern `lanternEvery`, `strings`, `buildings`, `trees` |

**The two fixed-coordinate grounds.** `harbour` and `lantern` carry scenery at fixed world positions
in `js/scenery.js`, laid out for those two tracks' points: Harbour Loop's sea south of z = 20, the canal at
x 45–75 (and the hump bridge's piers there), the crane at (250, −60), the bollards along z = 19.3 and
the lamps on the first 121 m and the last 171 m of the lap; Lantern's lake south of z = 110. Move
those tracks' points, or give a new track one of those grounds, and water or landmarks can end up
under or over the road — the validation does not catch it. A new track should use `terrain`.

**Publishing a data-only change.** The template's "Build app ZIPs" workflow skips commits that
touch only `*/data/**` (the live apps commit data hourly). After changing only `data/tracks.json` or
`data/racers.json`, run the workflow by hand (Actions → Build app ZIPs → Run workflow) so the ZIP
picks it up.

## Run it locally

ES modules and `fetch()` do not work from `file://`, so serve the folder:

```
cd snug-kart
python3 -m http.server 8000
```

and open `localhost:8000` in a browser (desktop keys: ← → or A D steer, Space or Shift drift,
↓ or S brake and reverse, X / E / Enter item, Escape or P pause). In Snuggery, import the ZIP.

## Tests

All five run from the app folder with Node 26 (`/opt/homebrew/bin/node`); `palette.py` with `python3`.

- **`node tools/check.mjs`** — HOUSE.md 7.1's checks with the game's own: the shipped files within
  Snuggery's limits; no external address outside `vendor/` (none at all in `.html`, `.css`, `.js`);
  `vendor/` byte-identical to `../anatomy/vendor/`; every import, `src`, `href`, `url(` and `fetch`
  target relative and present; `data/`, `fonts/` and `vendor/` holding exactly their files, the
  face's and `OFL.txt`'s sha256 the house's; both data files' sha256 unchanged; `miniapp.json`; the
  borrowed-names scan and the AI vendor and model names (both lists ROT13 in the script); the
  credits word for word in About, here and in `DESIGN.md`; the camera's `Race` button and the
  `snugkart:v1:` keys; SI in every string the game writes and `toFixed` only in `js/units.js`; no
  transition on anything that carries a number; no `innerHTML`; `js/palette.js` equal to
  `palette.py --json` and `palette.py` passing; the look (the house tokens in both themes, one
  `@font-face`, no other face, no shadows, no uppercase, no middle dots or em dashes, the
  `theme-color` metas, `lang="en-US"` and a viewport that allows zoom, one live region); the
  three tracks against §5.2 (the table is printed); the budgets (code at the held cap, fonts, the
  ZIP built exactly as the template's workflow builds it); US spelling; `screenshots/app.png`
  unchanged.
- **`node tools/sim.mjs [pace] [races]`** — full three-lap races in Node with no browser, eight AI
  drivers (the player's slot on autopilot), every track. Asserts every kart finishes, no NaN, at
  most two respawns per kart, lap times between 95 % of a lap at the AI's 31.5 m/s cap and 75 s, the
  field spread under 25 s at Standard pace, and that the AI drifts and earns mini-boosts. A race
  simulates in about 50 ms.
  Items are on: it also asserts that the AI uses all five items on every track, that items land, and
  that the median kart picks up at least three a race, and prints pickups, uses, hits and Quilt
  blocks. `NO_ITEMS=1` runs the races without them.
- **`node tools/items.mjs`** — each item's rule set up deterministically on the real race code: the
  distribution table, a parcel pickup with its four shuffle ticks and 0.8 s lock, the respawn, the
  Kettle's boost, a Yarn Snare spinning the kart behind (and an aware AI steering round it), the
  Quilt taking a hit and popping, a Paper Plane homing 4 m sideways onto the racer ahead, a leader's
  plane fading, Honey slowing (and not through a Quilt), and the AI firing what it holds.
- **`node tools/test_chart.mjs`** — the Lap Chart's record proved: 30 races on the real race code
  (half of them skipping the wait, so projected finishers are tested), each step ranked by the test's
  own rule with its own timing-line crossings, compared with every kart's `gates`; prints the figures
  `ART.md` section 1 quotes.
- **`python3 tools/art/palette.py`** (or from `Template/`, `python3 snug-kart/tools/art/palette.py`)
  — every token, the racers' fitted tones and every contrast figure in `ART.md`, read from the data
  files; ends `ALL CHECKS PASS`. `--json` prints the tones `js/palette.js` holds.
- **`PLAYWRIGHT_MODULE=… node tools/shoot.mjs [scene …]`** — serves the folder itself and drives
  the game in headless Chromium at 390 × 844 CSS px, DPR 2, real touch through CDP, through the
  `window.__sk` hook, in the light and the dark theme. It fails on any console error or warning,
  page error, failed request, HTTP ≥ 400 or request outside the app. The game's scenes (first
  theme): `title`, `countdown` (the rivals behind the player hidden through the swoop, the drift
  hint on a first race and gone at Go, the numerals on their plate with no animation),
  `race-harbour`, `race-pinewood`, `race-lantern` (each with draw calls and triangles checked
  against the High and Low budgets), `touch`, `keys`, `resize`, `hidden`, `context`, `results`
  (the finish banner, eight rows, measured times to the millisecond and projected ones "about" to
  the second, the record sentence), `skip`, `skip-tap` (decision 42's guard), `items`, `sound`,
  `tilt`, `face`, `journey` (a track picked by its word, a racer by its face, Race, three laps, the
  results, back with "Change track or racer", a swipe on the plate) and `reload` (the record row).
  The house's, in each theme: `look-title` (the camera's `Race` by role and name, the face loaded,
  the title's view centered in its plate, the tracer under exactly what is chosen, text contrast,
  SI and hit targets, About from its key with the loop stopped, the license and both credits,
  Escape and focus returned), `look-race` (the race card, the strip's redraw rule, the reticle and
  the steering ring sampled over Pinewood Pass), `look-results` (the Lap Chart drawn by the script's
  own formula, every column a ranking, the projected racers, the ink sampled against what is beside
  it, the rows named in words) and `look-pause` (a dialog, focus on Resume and back on Pause). Once: `live` (the live region's sentences, the results' one included), `reduced` (Reduce Motion,
  with no blink: the item shuffle and a kart recovering from a hit),
  `widths` (320, 320 × 568, 360, 375, 125 % zoom, 844 × 390, 667 × 375 and 932 × 430: the title with
  every control hit at 44 × 44 or more and About and the track words clear of Snuggery's
  exit-control corner, a first race's countdown with the hint and the countdown clear of every other
  plate, a race with the longest banner, and the results with the Lap Chart's caption whole) and
  `broken` (four kinds of bad data, each its sentence). `SCHEMES=light` narrows it to one theme;
  `SCREENSHOTS=1` copies the house scenes to `screenshots/*-{light,dark}.png`, never `app.png`.
  `TIMING=1` adds 11 s of a real-time race; `PROFILE=1` runs 240 real-time frames on Lantern Night
  and Pinewood Pass with every kind of item on the road. **Playwright:** `cd tools && npm install
  playwright && npx playwright install chromium` once (`tools/node_modules/` is git-ignored and
  never in the ZIP); or set `PLAYWRIGHT_MODULE` to another install's `playwright/index.mjs`. Without
  either, the script stops and says so.

### Results at the time of writing

- Run 2026-10-02, after the house look (plan 0011), its review and the follow-up to its final
  review. `check.mjs`: `all checks pass`; app code 242 655 B against the lead's 244 000 (`ART.md`
  section 6); fonts 40 075 B; ZIP about 619 000 B (cap 720 806; the game's own limit 3 MB); both data
  files byte-identical.
- `test_chart.mjs`: all pass; `kart.gates` equals the test's own record for 240 of 240 karts in 30
  races, 12 of them projected; the order changes 49.3 times a race, the chart shows 38.5 crossings;
  your place changes 14.1 times, the chart sees 8.1.
- `palette.py`: `ALL CHECKS PASS`.
- `items.mjs`: all pass.
- `sim.mjs`, 5 races per track at Standard with items (fastest–slowest lap, largest field spread,
  pickups per kart per race min / median / max): Harbour Loop 34.4–40.6 s, 6.5 s, 1 / 6 / 9; Pinewood
  43.0–48.3 s, 6.1 s, 2 / 5 / 10; Lantern 44.8–50.6 s, 5.0 s, 1 / 5 / 10. Across the 15 races the AI
  used 129 Kettles, 129 Quilts, 127 Snares, 143 Planes and 101 Honey Puddles; 92 Snares and 107
  Planes landed and 31 hits were taken by a Quilt. Also passes at Relaxed, at Fierce, and with
  `NO_ITEMS=1`.
- The first item: a human-like probe (the player starting 5th, driving a clean line without
  drifting, 10 seeds a track) picks up its first item 4–5 s after Go in 7 of 10 races on
  Harbour Loop, 6 of 10 on Pinewood Pass and 8 of 10 on Lantern Night (before the double row: 17–93 s, the
  first row always taken by the four karts ahead).
- `shoot.mjs` (both themes, `SCREENSHOTS=1`): 211 checks, no console errors, 451 requests, none
  outside the app; `skip-tap` fails (Race again restarts the race, Change goes to the title) with
  decision 42's guard taken out (seen before the house look). Text contrast lowest 6.61 (light) and
  6.92 (dark); the Lap Chart's ink against what is 4 px beside it, 10th percentile 16.40 (light) and
  12.87 (dark); the steering ring and the reticle against their halos over Pinewood Pass, 3:1 or more
  for 90 % of samples in both themes (the 10th percentile varies run to run with the simulated race,
  between about 3.0 and 7.0). Per frame on High / Low (budget ≤ 50 / 35 calls,
  ≤ 150k / 90k triangles): Harbour Loop 31 / 24 calls, 30k / 22k triangles; Pinewood 30 / 23 calls,
  105k / 88k; Lantern 31 / 26 calls, 64k / 47k; Lantern with every kart's snare, puddle, plane and
  Quilt on screen 36 / 30 calls, 67k / 50k (the chrome is DOM and 2D canvases: no draw call). (The
  counts follow the race at the moment of the shot, which karts are in view, so they move whenever
  the race does.) The five item meshes are instanced (one call each) and hidden while empty.
- Profile (before the house look), headless Chromium on SwiftShader, High at ×2, eight karts and a full item field:
  JavaScript (simulation + render submission) **0.43–0.44 ms a frame on Lantern Night, 0.41–0.43 ms
  on Pinewood Pass** over two runs (0.52 ms on both in a later run, after decision 42, which adds
  nothing per frame — the machine, not the code); the frame interval (50 ms median) is SwiftShader's software GPU. **Frame rates
  from headless Chromium are not evidence of phone performance**; the phone numbers are a device
  check (below).

### Device checks this build cannot do

Not done, and not claimed: 60 fps on High through a full Pinewood Pass race on an iPhone 16-class
phone, and what adaptive resolution settles on; the same on Low on the oldest phone available;
steering and drifting with two thumbs at once on glass; no text selection, callout, zoom or bounce on
long presses and fast double taps; the safe areas in Snuggery's full screen with the status bar
showing; leaving the app mid-race pauses it; bests survive closing and reopening. **Sound:** the
first tap starts it inside Snuggery's web view; whether it follows the silent switch; that it stops
when the app goes to the background and comes back with the next race. **Tilt:** whether the motion
permission prompt appears inside Snuggery at all (its `WKUIDelegate` does not implement WebKit's
orientation-permission callback, so WebKit may refuse without asking — Tilt then stays off, the note
says "Tilt isn’t available here." and the game is unaffected); if it does, how the 22° range and
3° dead zone feel, and the sign in landscape (worked out from the spec's axes, never seen on glass).
**Items:** whether 1.8 m pickups and the 14 px of slack around the item and drift buttons feel
forgiving or loose under a real thumb. **Snuggery's full screen on iOS 18:** its exit button sits
16 pt inside the safe area's top-right corner; the HUD keeps that corner clear, and on the title
About sits after the name and the track words stop 52 px short of the right edge (worked out from
Snuggery's source and emulated safe areas, never seen on a phone: tap About in full screen and see
it open).
**Reduce Motion and flashes:** under Reduce Motion a hit kart is a steady half form and nothing
blinks; with motion on its recovery blink is 3 Hz over 1 s (three flashes at most), never seen on
glass at the kart's real size. **VoiceOver:** pausing lands on Resume and resuming on Pause; the
results are announced in one sentence and their rows read in words; the race card's two times, the
title's record and the results' lead are read in words (each drawn time is `aria-hidden`, with a
visually hidden twin in words after it), never as symbols. **Low Power Mode:** WebKit may hold
`requestAnimationFrame` to 30 fps, which adaptive resolution would read as a slow GPU and answer
with a softer picture for nothing — see what it settles on. **The house look (plan 0011):** the race
card, the track map and the notices legible over all three tracks in daylight; the Lap Chart legible
on the results in both themes and its lines followable by eye; the drift key's two tiers seen under
a thumb; the steering ring and the reticle over Pinewood Pass's snow in the dark theme; Reduce
Motion (the still title, no swoop, no swing); a phone on its side (the title's column with its two
rows of faces under a thumb, the race); VoiceOver on the title's groups, the live region in a race
and the results' rows; frame time on High through a Pinewood Pass race against the build before the
pass (the strip's redraws and the DOM plates are the new cost). **Also:** a long race with sound on
(the engine's parameters update 20 times a second); how the dithered fade of a rival at the camera
looks on a Retina screen; a tap after the finish banner held on the spot where Race again then
appears leaves the results up (decision 42).

## How it was built

- **Tracks** (`js/track.js`): a closed centripetal Catmull-Rom spline through the control points,
  sampled every meter of arc length; width and bank are eased between points; curvature is measured
  over ±12 m; the bank always tilts toward the inside of the bend. Karts never raycast: each keeps its
  nearest sample, searched only ±30 samples around the last one, so the Lantern Night crossover
  resolves by continuity.
- **Physics** (`js/physics.js`): a fixed 1/120 s step, at most 8 a frame, the frame delta clamped to
  1/15 s. Automatic throttle, steering authority that falls with speed, grip that lets a kart slide
  sideways after a bump, walls that scrape or stop, and 1 m circles for bumps with restitution 0.4.
- **AI** (`js/ai.js`): steers at a point ahead on its personality's lane pulled toward the inside of
  the coming bend, brakes to a precomputed speed table, passes, eases apart when side by side, makes
  the odd mistake, and drifts. Rubber-banding scales its top speed by its gap to the player.
- **Karts** (`js/kart.js`): one merged mesh per kart (boxes, cylinders, a head sphere and a hair or
  hat), all sharing one material whose map is a 512 × 256 face atlas painted on a canvas; the 32
  wheels are one instanced mesh.
- **Scenery** (`js/scenery.js`): road, verges, walls, curbs and cliffs as triangle strips from the
  samples; each kind of prop one instanced mesh placed by a seeded RNG, so every race on a track
  looks the same. Pinewood Pass stands on a 160 × 160 heightfield that follows the road.
- **Items** (`js/items.js`, pure; `js/items-view.js`, three): parcels, held items, snares, puddles
  and planes are plain state stepped with the race, so the Node tools run them; the view draws each
  kind as one instanced mesh and drives the item button, the reticle and the warning. The AI decides
  per §4 of the design (hold times by aggression, straights for the Kettle, a kart close behind for a
  Snare, the racer ahead within 90 m for a Plane, a Quilt raised when a Plane is aimed at it), dodges
  hazards with probability `awareness`, and steers for a live parcel when its hands are empty.
- **Sound** (`js/audio.js`): one AudioContext made inside a tap, a compressor and master gain, a
  looping noise buffer; the engine is a sawtooth and a square an octave down through a low-pass
  that follows speed, the rest are short oscillator and filtered-noise envelopes.
- **Tilt** (`js/tilt.js`): `deviceorientation` readings, the permission asked inside the tap on the
  title's Tilt word, on only once a real reading arrives; the countdown's average is straight ahead.
- **Everything else**: a chase camera with speed-dependent field of view (80° → 90° → 96° boosting,
  portrait), a 400-particle pool (drift sparks, boost puffs, Kettle steam, Quilt pops, wall sparks),
  DOM plates for the race card, the keys and the notices, and 2D canvases for the track map (drawn in
  order of height), the race card's strip and the results' Lap Chart (`js/chart.js`). A rival between
  the camera and the player fades out by its depth in front of the camera (each kart has its own copy
  of the one material, dithered with three's `alphaHash`, so there is nothing to sort).
- **The Lap Chart** (`js/race.js`, `js/chart.js`): each kart's `gates` list starts with its grid
  place; after the places are updated in every step, a kart that has reached a new tenth of a lap
  (its race distance over a tenth of the lap, at most 30) appends its place, so the finish column
  holds its finishing place. A projected kart's list stops where it stood when the race ended. The
  race's simulation is unchanged by it (`tools/sim.mjs`'s output, timings aside, is identical before
  and after). `tools/test_chart.mjs` proves the record against its own.

## Code map

| File | Lines | What it does |
| --- | --- | --- |
| `js/main.js` | 778 | Boot and data validation, screens, the title from words (tracks, racers, settings, the record row), About, the loop, events and the live region's sentences, the drift hint, tap-to-skip after the finish and the results' input guard, the results sheet and its Lap Chart, pause/visibility/resize/context loss, Reduce Motion, the title's view centered in its plate, adaptive resolution, `window.__sk`, and the three optional modules in `hooks` |
| `js/track.js` | 248 | Spline, samples, banking, curvature, verge and wall lines, local projection, spatial hash, §5.2 validation (its sentences through `js/units.js`). Pure (three.core only) |
| `js/physics.js` | 245 | Kart state and step, drift and mini-boosts, walls, bumps, spin/tumble/boost. Pure |
| `js/ai.js` | 139 | Speed tables, target line, passing, drift decisions, rubber-banding. Pure |
| `js/race.js` | 201 | Grid, countdown, laps and checkpoints, stuck/wrong way, positions, the Lap Chart's `gates` record, finish, projected times. Pure |
| `js/items.js` | 349 | Parcels, the five items, hits and the Quilt, the distribution table, the AI's item use, dodging and parcel seeking. Pure |
| `js/items-view.js` | 207 | Parcel, snare, puddle, plane and Quilt-bubble meshes (instanced); the item key's icon, shuffle and `No item`; the reticle (its lock a shape); the "Paper plane behind you" warning |
| `js/audio.js` | 164 | Web Audio: context on a tap, engine and drift loops, every one-shot sound |
| `js/tilt.js` | 79 | Orientation permission, readings, calibration, the steer |
| `js/scenery.js` | 587 | Road and structures, ground and terrain, sky, lights, the props of each track |
| `js/kart.js` | 301 | Face painter and atlas, kart geometry, the field (placement, wheels, blob shadows, fading a rival at the camera, the grid behind the player hidden through the countdown) |
| `js/camera.js` | 104 | Chase rig, countdown swoop, title glide, finish view; their still forms under Reduce Motion |
| `js/hud.js` | 111 | The race card (its times also in words, for VoiceOver), its strip's redraw rule, the track map, the countdown, banners, the diagnostics line |
| `js/input.js` | 139 | Pad (floating), Sides, drift and item buttons, the drift zone, keyboard, the tilt hook |
| `js/fx.js` | 106 | Drift sparks by tier, boost puffs, Kettle steam, Quilt pops, wall sparks (one Points mesh) |
| `js/geo.js` | 78 | Geometry merging, canvas textures, a triangle-soup builder |
| `js/store.js` | 34 | `localStorage` with every access in try/catch; settings and bests |
| `js/rng.js` | 40 | mulberry32, string hash, value noise |
| `js/chart.js` | 93 | The Lap Chart on the results sheet and the race card's strip: 2D canvases in the house face |
| `js/units.js` | 50 | Every number, time and place the game writes: U+202F, the true minus, `about 1:54`, the words VoiceOver hears. Pure |
| `js/palette.js` | 16 | The racers' tones per theme (`tools/art/palette.py --json`, pasted) and the chrome tokens for the canvases |

The pure modules (`track`, `physics`, `ai`, `race`, `items`, `rng`, `units`) import nothing but `three.core.js`
and touch no DOM, so `tools/sim.mjs` and `tools/items.mjs` run the real race code in Node.

**How the modules plug in.** `hooks` in `js/main.js` holds `items` (`attach(race, scene)` returns the
race's item state, `frame(race, dt, camera)`, `give`, `detach`), `audio` (`unlock`, `setEnabled`,
`onEvent`, `frame`, `suspend`, `resume`) and `tilt` (`request`, `start`, `stop`, `calibrate`). Race
events (`race.events`, drained every frame) are `count`, `go`, `lap`, `wrongWay`, `finish`,
`results`, `respawn`, `wall`, `bump`, `driftStart`, `driftTier`, `miniBoost`, `stun`, and from the
items `pickup`, `roll`, `use`, `hit`, `shieldPop`, `honeyIn`, `incoming`, `planeGone`. The test hook
`window.__sk` adds `giveItem`, `giveAll` and `useAll` for the item scenes and `karts()` (each kart's
fade and visibility) for the countdown scene.

## Decisions

Where the design was silent, or where a number it gave did not survive the simulation. Each says
what was chosen, over what, and what would change it.

1. **The drift's outward range is 0.20×, not 0.50×** (`PHYS.driftBase 0.80`, `driftAmp 0.60`;
   fully into the bend is still 1.40×). At the design's 0.50× the widest drift at 28 m/s was a
   circle of about 36 m, so none of Lantern Night's bends (61–110 m) and few others could be drifted
   at all — by the AI or by a player. `tools/sim.mjs` now requires mini-boosts on every track. A
   phone test that finds drifts too loose would move `driftBase` back up.
2. **A drift steered outward still charges, at half rate.** The design charged nothing while
   σ·dir < −0.2, which on a wide bend means a drift can never be charged. Steering into the drift
   still charges fastest.
3. **The AI drifts at bends with |κ| > 1/90 for ≥ 25 m and lets go below 1/130** (the design:
   1/35, which only a handful of hairpins reach). While drifting, the AI aims by pure pursuit and
   turns the needed yaw rate back into a steer through the drift formula (the design's 2.4·α
   whipped the kart inside on entry), and lets go if it runs more than 4 m inside its line or once a
   tier is banked with the wheel hard over.
4. **AI karts ease apart when side by side** (within 3 m along and 2.4 m across). The design had
   only a passing rule; without this, karts in neighboring lanes ground against each other for
   whole laps (≈ 13,000 bump events a race, now ≈ 60).
5. **An AI mistake runs wide toward the outside of the coming bend** (design: "+0.4 to its lane",
   which on a right-hander would have run it inside).
6. **The sim's lap-time floor is physical**: 95 % of the lap at 31.5 m/s (31.0 s on Harbour Loop) instead
   of 35 s. Harbour Loop is flat out all the way round, so its honest laps run 33–40 s.
7. **Velocity follows the heading.** Turning carries the kart's forward speed with it; sideways
   speed comes only from bumps and walls, and a drift's slide is shown by the visual yaw offset
   (§6.1), not simulated. This keeps the AI's speed table (which assumes path curvature = yaw
   rate / speed) true.
8. **Reverse builds at 40 % of the brake rate** (the design gave one 26 m/s² for both).
9. **A section's verge is blended over 10 m** at its ends (the rock cut's 1.5 m, the bridge's 0 m),
   so the wall line never steps.
10. **The sky sphere's radius is 0.92 × the camera's far plane**, not 400 m: with far = fog far +
    10 m (≤ 270 m) a 400 m sphere is clipped away.
11. **Night lighting is brighter than the design's numbers** (hemisphere 1.7, moon 0.7): the
    design's 0.6 is in three's old light units; r186's are physical. The light pools are also a
    little stronger. Tuned by screenshot.
12. **The title screen shows the selected track at the selected quality**, rendered at pixel ratio
    1.25 — so tapping Race never rebuilds the track. (The design had the title always at Low.)
13. **The title's glide looks about 10° down, at the road 32 m ahead**, from the design's 6 m up, so
    that with the view centered in the plate between the title's bands (decision 43) the horizon sits
    near a third of the way down it and the track's own scenery fills it.
14. **Pinewood's terrain grid is 160 × 160 on Low too**: the design reduces props on Low, not the
    ground, and Low stays within its triangle budget (80k of 90k).
15. **Drift sparks, boost puffs and wall sparks live in `js/fx.js`** with the Kettle's steam and the
    Quilt's pop; the item models are in `js/items-view.js` (the design put both in `fx.js`).
16. **Landscape:** the item button moves beside the drift button so it does not cover the mini-map,
    and the title's column at the right holds the racers in two rows of four (eight 44 px hits need
    352 px, the column has 328), with Race in its own row under it, never scrolled away. After the
    player finishes, the drift and item buttons hide and the clock shows their own time.
17. **WebGL context restore rebuilds nothing.** three.js re-uploads everything after a restore; on
    loss, the stale dispose listeners three.js keeps on every geometry, material and texture are
    cleared, so a later track change does not delete buffers of the lost context.
18. **Bump events are emitted only above 1 m/s of closing speed**, so a sound can hang off them.
19. **`DESIGN.md` §5.4 first called the climb's sweepers "right-hand"**; with the given control
    points they turn left in the direction of travel. Nothing depended on it; the text now says
    left.
20. **`__sk.advance()` settles the camera without drawing** (19 camera-only frames and one drawn),
    because queuing 20 drawn frames per call left headless Chromium a minute behind. Extra hook
    functions beyond the design's list: `freeze`, `adaptive`, `setDrift`, `lookAtKart`, `camera`,
    `showTitle`.
21. **`tools/shoot.mjs` tolerates exactly one console message**: SwiftShader's "GPU stall due to
    ReadPixels", which Playwright's screenshot causes. The app never reads pixels back.

22. **A kart already holding an item drives through a parcel without breaking it.** The design had
    it break the parcel for nothing; in a tight pack the front runners then stripped every row and the
    midfield — often the player — went a minute without an item (seen in the headless `items` scene:
    no pickup in 60 s).
23. **Parcels respawn after 1.5 s, not 3.0 s**, and **pick up within 1.8 m, not 1.3 m.** A pack passes
    a row in about 2 s, so a 3 s respawn served at most four of eight karts; and at 1.3 m a kart on the
    center line passed between the two middle parcels (0.4 × half-width apart). Together with 22 and
    24 the median kart went from 2 pickups a race to 3–5, and the fewest from 0 to 1–2.
24. **The AI steers for a live parcel 10–45 m ahead when its hands are empty**, leaving one that a
    kart nearer to it has already claimed. The design said nothing about seeking; without it, lanes
    decided who got items.
25. **A Paper Plane lives 7 s, not 6 s** (the leader's still fades after 2 s): at 45 m/s against a
    30 m/s target, a plane thrown at the AI's full 90 m range needs 6 s just to arrive.
26. **A spin-out sheds speed at 40 m/s²** until the 8 m/s cap. The normal 12 m/s² over-speed easing
    left a kart at racing speed still above the cap when its 1 s spin ended, so a Snare cost little.
27. **Snare and puddle placement:** a Snare lands 2.5 m behind (design) and arms after 0.35 s; Honey
    is centered 4 m behind so its 3.2 m spread starts clear of the kart, and does not slow the kart
    that dropped it for 1.5 s. A Snare catches a kart within 0.9 m plus 0.7 m of the kart's radius;
    a recovering (blinking) kart passes through without setting it off. Hazards and planes only touch
    karts at their own height, so the Lantern Night bridge and underpass never interact.
28. **The AI's fall-backs:** a Kettle is used on a 60 m straight or after 15 s held; a Snare after
    8 s at a corner entry or after 12 s anywhere; a Quilt when a hazard it chose not to dodge is on
    its line within 15 m, after 12 s, or at once (with probability `awareness`) when a Plane is
    thrown at it. The design gave the first half of each rule.
29. **Quilt bubbles are one instanced mesh** (one draw call for all eight, hidden while none is up),
    mostly clear with pale patches and white stitching so a shielded kart stays visible. They blink
    for their last 2 s.
30. **A rival between the camera and the player fades out** by its depth in front of the camera:
    solid beyond 4 m, gone at 1.5 m (the player sits about 5 m in front of the chase camera); its
    Quilt bubble goes at the first sign of the fade, its wheels, blob and shadow at half-way. This
    replaced a hard hide within 3.3 m, which let a kart just behind the player fill the lower
    screen and then blink out. **During the countdown every rival behind the player on the grid is
    hidden:** the swoop starts 12 m back and 7 m up, right over the kart in the slot behind, which
    otherwise was the biggest thing on screen through "3" and "2". At Go that kart is under the
    camera, so it comes back already faded and nothing pops. Would change if a phone shows the
    dither as noise — a transparent (blended) fade is the alternative.
31. **Touch is more forgiving than the design's numbers:** the pad takes touches in the left 60 % below
    40 % of the height (design 58 % / 45 %); the pad floats — past the ring it follows the thumb, so
    steering back never needs a long drag; in Pad mode a thumb anywhere in the lower right below the
    item button drifts; the drift and item buttons are 88 and 76 px (design 84 and 72) with 14 px of
    extra hit area round each. Every control on the title hits at 44 × 44 px or more (Snuggery's own
    minimum target).
32. **Tilt turns on only when a real reading arrives within 1 s**, even after iOS grants permission,
    because recent Chromium also exposes `requestPermission` and desktops can grant it with no sensor.
    With Tilt saved on from an earlier visit, the Race tap asks again (iOS asks once per visit); a
    refusal turns the setting off and the pad steers. With no reading in the last 0.5 s tilt lets go.
33. **Things the design did not list:** a "Paper plane behind you" warning when a plane is aimed at the
    player; short banners when the player is hit ("Hit by a paper plane", "Caught in a yarn snare",
    "Stuck in honey"); a soft thud for
    kart bumps involving the player; a lit (emissive) finish on parcels, snares and planes so they read
    at night.
34. **Audio is resumed at every race start and when the page comes back on the title or results.**
    Otherwise a page hidden on the title left the context suspended and the next race silent (caught
    by the `sound` scene, which fails with the fix taken out).

35. **The first parcel station is a double row** (two rows of four, 10 m apart) on every track. The
    player starts 5th and the four karts ahead always took the first row, so the item button stayed
    dark for 17–93 s. With the double row a clean driver has an item 4–5 s after Go in 6–8 races of
    10. Keeping the AI off parcel-seeking for the first 8 s as well was tried and was worse (front
    runners that missed row one took row two). Holding karts drive through a parcel, so the second
    row serves the back of the grid.
36. **The HUD leaves the top-right corner to Snuggery.** On iOS 18 Snuggery's 44 pt exit-full-screen
    button sits 16 pt inside the safe area's top-right corner — over where the lap and the clock
    were. Place, lap, clock and last lap now stack at the top left; the mini-map starts 56 px lower
    on the right. (On iOS 26 the button sits in the status-bar band, clear of all of it.)
37. **Speed lines are an accent for a boost** (the Kettle or a drift's mini-boost), not for speed.
    The design's `(v − 26)/8` showed them 86–96 % of a race, re-drawn at random every frame, which
    read as rain. Now up to 18 streaks at most 25 % opaque, each living 0.2–0.35 s while it slides
    outward, kept to the left and right of a portrait screen. The field of view carries ordinary
    speed. **Removed with the house look (decision 43):** random streaks that no data drove.
38. **A tap after the finish banner skips the wait for the field.** It listens on the document (not
    the HUD, which takes no touches) and ignores buttons; the stragglers get projected times.
39. **Sides mode has no drift button.** In the lower-right corner it covered the right thumb's
    natural spot, so a thumb there drifted instead of steering right. Sides drifts with its own
    gesture (tap a side twice and hold); the Controls note and the first races' hint say so.
40. **The first two races show one line on drifting** under the countdown's plate
    ("Hold Drift through a bend. Let go for a boost.", or the Sides gesture), counted in
    `localStorage`; Go hides it.
41. **Smaller fixes from review:** a WebGL context loss suspends the sound too, and its panel sits
    above the results screen (it was underneath, so a loss there could not be dismissed); the item
    button's accessible label names the item ("Use the Paper Plane") and follows the end of the
    shuffle; keyboard keys are only captured while racing, so Space and Enter press title buttons;
    the title's tagline sat on a dark pill so it read over a pale sky (the house look removed the
    tagline, decision 43); the engine's audio
    parameters update 20 times a second instead of every frame; the per-step allocations in the race
    and item code and the HUD's per-frame text writes are gone (text is written only when it
    changes); `props.lampEvery` and `props.bollardEvery` are read from the data; unused helpers are
    gone.
42. **The tap that skips the wait is consumed; the results ignore input for a moment.** The results
    appear a frame (~16 ms) after the skipping finger goes down, while it is still down, and Chrome
    aims the tap's click at whatever is under the finger when it lifts — so a skip in the lower
    middle of the screen pressed Race again or Change before the results were ever seen (the
    `skip-tap` scene reproduced both in headless Chromium; iOS WebKit's tap-to-click is hit-tested
    at the lift as well, not yet seen on a phone). Now the skip calls `preventDefault`, and the results
    panel is out of hit-testing (`#results.settling`, `pointer-events: none`) while that finger is
    down, for 0.4 s after it lifts, and for 0.5 s after the panel appears — the last also covers a
    tap already under way when the race ends by itself. A capture-phase click listener drops any
    click that still reaches the panel in that window. A lost lift (another finger going down,
    the window losing focus) ends the guard rather than leaving the panel dead. Chosen over firing
    the skip on `pointerup` (a skip that waits for the lift feels late, and whether the lift's click
    lands before or after the frame that shows the panel is a browser detail the fix should not
    rest on) and over a fixed delay alone (a finger held longer than the delay would still press
    the button). Shorter windows would do on a phone; the numbers are well under the
    time it takes to read the results.
43. **The house look (plan 0011, 2026-10-02).** The game took the template's house system: the house
    face and chrome tokens, every sentence over the scene on a plate, the title rebuilt from words
    (tracks, racers, settings) with the scene showing through a plate between its bands and the
    camera's view centered in it, About, the live region, Reduce Motion, SI through `js/units.js`, US
    English, and one signature, the Lap Chart (`ART.md`). The speed lines over a boost are gone (the
    one effect no data drove). Fifteen bugs a stranger's run found (`tools/DECISIONS.md`, B1 to B15:
    a viewport that blocked zoom, a 40 px Pause key, projected times to the millisecond, comma
    thousands and middle dots, British spelling on screen, a place that VoiceOver read at every
    overtake, a red blinking warning and a spinning orange reticle, a blank item key, no Reduce
    Motion, em-dash separators, text held up by shadows, a title that hid the scene at 320 px, a
    monospace diagnostics line, one `innerHTML`, plain spaces before units) are fixed. The race, its
    numbers and both data files are unchanged. The record of the pass is in `tools/DECISIONS.md`.

## Licenses

- **three.js** r186, MIT, © 2010–2026 three.js authors; `vendor/three-LICENSE.txt`, unchanged.
- **Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.**
  The subset is the template's house file, byte-identical to `global-weather/fonts/`
  (`fonts/ysabeau-office-gw.woff2`, 35 372 B, sha256 `fdf1a28c…cdb262`; `fonts/OFL.txt`, sha256
  `d1adfffd…be6269`), cut from google/fonts at commit `9710da1e…` by
  `global-weather/tools/art/font_subset.py`; `tools/check.mjs` pins both.
- **Everything else** (the code, the tracks, the racers, the items and their symbols, every texture
  and every sound generated by the code) is original to this app and released under the MIT
  license in the repository's root `LICENSE`. No image, model, sound or data file from anywhere else
  is included.
