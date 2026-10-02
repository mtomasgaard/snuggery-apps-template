# Besseggen: art direction

`NOTES.md` says what the app does and where every number comes from. This file says how it looks,
moves and speaks under the template's house system (`Template/HOUSE.md`, the brief this pass
follows; Global Weather is the reference, Milky Way the pass before this one). Every figure names
the command that printed it. The scripts are in `tools/`, which the ZIP leaves out. Owner calls are
listed at the end (section 9) and, as the build settles them, in `tools/DECISIONS.md`.

**Measured on 2026-10-01**, before the pass, on the working tree. Commands run from
`Template/besseggen/` unless they say `Template/`. Frame times and load times below are headless
Chromium (SwiftShader) on the build Mac: a trend, never phone evidence.

---

## The look: the house, with one bold thing of its own

Besseggen takes the house chrome whole: one face, gray chrome, the caption band, the player and the
app's own track, focus mode, SI and the no-tells rules. What is its own is the plate and one
signature.

- **The plate keeps its daylight in both themes.** A terrain under the real sun has one true
  appearance (HOUSE 3.2 names exactly this case). The shading is the data: where the light falls and
  where the ridge throws its shadow at the hour shown. Printing that as a dark-theme negative
  darkens the lit faces and drowns the shadows; the stock dark theme showed it (below). So the
  plate is drawn from `data/colors.json`'s light block in both themes, and the chrome around it
  follows the phone.
- **One bold thing: the Burn** (section 1). Everything else on the chrome is quiet.
- **Honesty is already the app's point.** Bandet not visible from Veslfjellet, the smoothed ascent
  stated with what the smoothing did, the boat timetable left out rather than guessed. The pass
  keeps every word of that, adds the house's rules for numbers and words, and fixes the two places
  where the app says something its data does not (section 8, items B4 and B5).

**What a stranger sees today** (`node tools/.work/look.mjs`, a throwaway Playwright script, light
and dark at 390 x 844, DPR 2, touch; pictures in `tools/.work/look/`): a 25 px Newsreader serif
title floating over the sky, a cream panel (`#f3f1ec`), a terracotta accent (`#b3492f`) on every
slider thumb, chip, the trail's marker pill and the compass needle, frosted round buttons with
`backdrop-filter`, uppercase tracked section heads (`SUN AND SHADOW`), iOS-style toggle switches
in the accent, middle dots in every meta line and an arrow in the direction chip. That is HOUSE 9's
tell 1 almost word for word (a warm cream ground, a serif display face, a terracotta accent), with
tells 4, 5, 6, 9 and 10 beside it. In the dark theme the 100 m contours, white at half opacity,
turn the mountain into a wireframe, the sky is a tinted near-black (`#0d1218`, tell 8), and the
north face seen from the boat at 07:00 is a black wall with white lines on it
(`tools/.work/look/dark-7-boat.png`).

**How it differs from the apps before it** (it copies none of them):

| | Global Weather, Global Wind | Earth's History | US Quakes | Warming World | Milky Way | Besseggen |
| --- | --- | --- | --- | --- | --- | --- |
| Signature | the streak field on the plate | the time control as a stratigraphic column | the record strip, one stem per quake | the stripes as an instrument | the Reach: a log ruler of distance, inked where the catalogs reach | **the Burn: the time track as a sunshine recorder's card, the sun's arc burned in where it reaches the marker** |
| Axis | the map | time (Ma) | time (days) | time (years) | distance from the Sun | **the hours of one day at one point on the mountain** |
| What it encodes | the wind's path at a printed rate | period colors | magnitude by stem height | anomaly by color | presence only | **the sun's altitude by height; direct sun at the marker by ink** |
| Shape | streaks | a banded column | stems | stripes | a flat bar with gaps | **an arch with bites taken out of it by the ridges** |
| Plate | film base / print | night in both themes | drum paper | gray card | space in both themes | **daylight terrain in both themes** |

---

## 1. The signature: the Burn

**What it is.** A sunshine recorder (the Campbell-Stokes ball, still the reference instrument for
sunshine duration) burns a trace into a card graduated in hours wherever the sun shines on it. The
Burn draws the player's time track as that card, for the point on the mountain where the marker
stands, on the date shown. Above the track's baseline runs the sun's arc for the day: its height at
each hour is the sun's apparent altitude, at a fixed and printed scale. Where the terrain model
leaves the marker in direct sun, the area under the arc is burned in ink. Where the sun is up but a
ridge stands between it and the marker, only the arc's thin outline is drawn, so the bites the
mountains take out of the day are visible as gaps in the burn. Below the horizon there is nothing.
The thumb, the house's tracer head, stands on the baseline at the hour shown, and its rule rises
through the arc.

**What a stranger remembers is the bite.** Measured through the app's own direct-sun code
(`window.__besseggen.runTool('firstsun', …)`, `node tools/.work/measure.mjs`, 2026 dates): on
14 June the sun rises at 03:43 and sets at 23:08, but direct sun reaches the quay at Gjendesheim only
from 06:42 to 20:22 (13 h 40 min), while Veslfjellet, 742 m higher, has it from 03:47 to 22:27
(18 h 40 min). On 20 September Bandet's sun ends at 16:53, 2 h 27 min before Veslfjellet's. On
21 December the sun climbs to 5.1° and Bandet, Bjørnbøltjønne and Memurubu get none at all;
Veslfjellet gets 4 h 39 min. Drag the walk's profile and the arc's bites change under your finger:
the valley loses its mornings, the ridge keeps them. No other app in the template has a number like
that, and the Burn shows it without a word.

**How it was found** (HOUSE 5.1):

1. *What does a specialist call the picture of this data?* For "how much sun does this spot get" the
   field's own document is the sunshine recorder's burned card (and its cousin, the horizon chart of a
   solar site survey). The card is graduated in hours, which is the axis the player already has.
2. *What does a person do most here?* Turn the mountain, move along the walk, and drag the sun's
   hour to watch the shadows sweep the ridge (the marketing clip does exactly that). The Burn sits
   on the hour track, where the hands are, and answers the walk's cursor too.
3. *What does this data have that no other app has?* Real cast shadows over a 1 m lidar terrain, and
   a 16 km horizon ring that exists precisely so the skyline is right (`NOTES.md`: without it 85 of
   180 azimuths from Veslfjellet lost skyline). The Burn is that skyline turned into hours. Moved to
   another app it would mean nothing.
4. *Can it be drawn with the house's means?* One ink at the far end of the tonal budget, the house's
   track, ticks and labels, no motion of its own.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears.* The burn is computed from the loaded terrain grids and the
   sun's position. With the terrain missing the app shows its notice and the track carries only its
   graduation; with the marker gone there is no burn.
2. *Every property that varies is measured.* The arc's height is the sun's apparent altitude
   (`js/sun.js`, NOAA's algorithm with refraction) at a fixed 0.4 px per degree, printed by a
   `30°` tick at the track's left end. The ink is the marker's direct-sun samples, every 2 minutes,
   from `directSunWindow` (the same ray march the app's tool has always used, 6 m to 42 km toward
   the sun over the 16 m and 64 m grids, the eye 0.5 m above the ground). Length along the track is
   clock time, linear; nothing is projected.
3. *It is captioned.* The caption line says how to read it, with its numbers:
   `The burn: direct sun at the marker, Gjendesheim, 06:42 to 20:22 (13 h 40 min). Terrain shadow only; no cloud.`
   (The place is named when the marker stands on a waypoint; elsewhere the sentence says `the marker`.)
   With more than one spell: `… 05:47 to 09:12 and 10:40 to 21:38 (14 h 23 min) …`; three or more:
   `… in 3 spells from 05:47 to 21:38 (12 h 10 min) …`. With none: `No direct sun reaches the
   marker at Bandet on 21 Dec: the sun climbs to 5.1° and the terrain hides it.` Every figure comes from the
   same computation the burn draws.
4. *It reads.* The burn on the player's page: 15.84:1 (light), 15.46:1 (dark); the thumb's ring on
   the burn the same; the arc's outline (`--ink-3`) 4.78:1 and 5.88:1 (`python3
   besseggen/tools/art/palette.py`, from `Template/`).
5. *It survives Reduce Motion.* It has no motion of its own. It changes only when the date or the
   marker does.
6. *About says what it shows and what it does not.* It is direct sun as the terrain model allows
   it: no cloud, haze, trees, buildings or snow cornices; the sun treated as a point (its disc's
   half degree is not modeled, so "first sun" is the moment the sun's center clears the ridge); the
   terrain at 16 m in the detailed box and 64 m beyond it, so a boulder or a cliff edge finer than
   that is not in it. It is not a forecast of sunshine hours.
7. *It is the only bold element* on the chrome. The rest passes section 7.

**Drawn exactly so** (in `js/track.js`, on the track's canvas; the data from `js/sun.js`):

- The track canvas is 58 px tall, the house's. Baseline at y = 34: a 1 px `--line-strong` line,
  inset 10 px from each end, 00:00 at the left inset and 24:00 at the right.
- The arc: for each device-pixel column, the minute under it, the sun's apparent altitude from the
  day's 1-minute table `dayEvents()` already builds (1 441 samples; it stores the geometric
  altitude as `alt` today, so it gains an `altApparent` array from the same `sunAt()` calls, the
  value the burn's lit test already uses), drawn
  upward from y = 32 (a 2 px `--page` gap above the baseline, so the house's "exposure so far" line
  on the baseline stays its own mark) at 0.4 px per degree: 52° (the June noon) is 21 px, 5° (the
  December noon) is 2 px. The scale is fixed and never stretched to the day.
- The burn: the columns whose minute falls in a lit 2-minute sample are filled from y = 32 up to
  the arc, in the signature ink (light `#1b110b`, dark `#fcf2e5`). Columns where the sun is up and
  the marker is not lit get only the arc's outline: one 1 px `--ink-3` pixel row at the arc's
  height. Below the horizon (apparent altitude ≤ 0), nothing.
- The scale: at the left end, a 3 px `--ink-3` tick at the 30° height (12 px above y = 32) with
  `30°` in 10.5 px `--ink-3` just above it. The arc never reaches that corner: at this latitude the
  sun is below the horizon at midnight all year (its highest midnight altitude is −5.24°, on
  14 June, `NOTES.md`). When the day's arc stays under 30° (from about 20 September to late March;
  the noon sun is 29.5° on 20 September, `node tools/.work/measure.mjs`) the tick stays, so a low
  winter arc reads as low.
- The graduation: a 3 px `--ink-3` tick under the baseline every hour (about 11 px apart at 390 px:
  no per-step ticks, the 288 five-minute steps would be under 1 px apart, a stated departure), a
  7 px `--ink-2` tick with a 10.5 px label at `06:00`, `12:00` and `18:00`, labels that would
  collide skipped.
- `now`: when the date shown is today in Norway, a 1 x 6 px `--ink-2` notch under the baseline at
  the present Norwegian time, its `now` label in the label row in `--ink-3`, the colliding hour
  label skipped (a departure from the house's notch above the baseline, where the arc lives).
  Trim 5 in section 6 if the code needs the bytes: taken, so the notch is not drawn.
- The thumb: the house's tracer head on the baseline at the shown step, never gliding; its
  1.5 x 18 px `--ink` rule crosses the arc.
- Accessible: the track keeps `role="slider"`; `aria-valuetext` says the hour, the sun and the
  marker's state: `14 June, 07:00 Central European Summer Time. Sun 17 degrees up in the
  east-northeast. The marker is in direct sun.` The whole day's burn is its description
  (`aria-describedby` on a visually hidden sentence, rewritten when the date or the marker
  changes, never per frame): `Direct sun on the marker from 06:42 to 20:22, 13 hours 40 minutes.`
- Cost: about 1 ms per recomputation (`node tools/.work/measure.mjs`: 0.3 to 1.7 ms per point and
  day, eighteen cases; headless, a trend), so it is recomputed on every marker move and every date
  change, the walk's drag included. It is never recomputed when only the hour changes.

---

## 2. Palette

`tools/art/palette.py` (written in this pass; run from `Template/`, standard library only) holds
every value below and ended `ALL CHECKS PASS` (`python3 besseggen/tools/art/palette.py`, exit 0).
It reads `data/colors.json` itself, so every plate figure is measured on the shipped data, never on
a retyped copy. `--json` prints what `js/plate.js` takes; the builder pastes it, never retypes it,
and `tools/check.mjs` fails while the two differ.

### The chrome tokens

The house tokens of HOUSE 3.1, copied exactly, in both themes. Measured by the same run:

| Pair (WCAG 2) | Light | Dark |
| --- | --: | --: |
| `--ink` / `--ink-2` / `--ink-3` on `--page` | 14.80 / 6.61 / 4.78 | 14.43 / 7.76 / 5.88 |
| `--ink` / `--ink-2` / `--ink-3` on `--sheet` | 16.40 / 7.32 / 5.29 | 12.87 / 6.92 / 5.25 |
| `--line-strong` on `--page` | 3.27 | 3.56 |

Highest chroma of any chrome token: 0.0239. The stock look's `--stage`, `--panel`, `--panel-2`,
`--muted`, `--rule`, `--accent`, `--accent-ink`, `--glass`, `--warn`, `--ok`, `--serif` and `--r`
go, with every `backdrop-filter`, `box-shadow`, `text-shadow`, uppercase rule and letter-spacing.

### The signature, per theme

| | Light | Dark |
| --- | --- | --- |
| Ground | the player's `--page` `#e8eef0`, L 0.945 | `--page` `#141d21`, L 0.224 |
| The track's other marks | baseline `--line-strong`, ticks and outline `--ink-3`, labels `--ink-2`, thumb `--ink`: all between the page and the burn | the same |
| Signature | the burn `#1b110b`, OKLCh (0.189, 0.0205, 52): a scorch, alpha 1 | `#fcf2e5`, OKLCh (0.965, 0.0203, 75): sunlit paper, alpha 1 |
| Beyond `--ink`? | yes: L 0.189 against 0.218 | yes: L 0.965 against 0.941 |
| Worst measured | burn on page 15.84; thumb ring on burn 15.84; outline 4.78 | burn on page 15.46; ring 15.46; outline 5.88 |

A warm near-neutral (chroma ≤ 0.021), not `--ink`, not a hue of any data color. It is close in
color to Global Weather's dark-theme streak (dE 0.012) and far in hue from Milky Way's Reach (52°
and 75° against 258° and 253°); it is a different mark in a different place, and the palette script
prints all four distances.

### The plate: one appearance in both themes

The terrain shader (`js/material.js`) lights `colors.json`'s colors in linear light. The script
models that light math (the sky term with its 0.16 luminance floor, the sun term at 0, 0.5 and 1,
the hillshade at 0, 0.5 and 1, a 100 m contour, fog at 0.85, the glacier and lake mixes, and the
optional layers) and checks the plate's marks over every case. `tools/shoot.mjs` then samples the
rendered frames (section 8, item 21).

| | Value |
| --- | --- |
| Data colors | `data/colors.json`, light block, in both themes: sky `#dfe7ef` (L 0.924), terrain `#cfc6b4`, low terrain `#9db183`, water `#9fb9cf`, glacier `#e8eef2`, sunlit `#fffaf0`, shadow `#5a6b80`, contours black, the trail `#c0392b`, the marker `#111418`, viewshed `#3fa7a0`, slope `#e67e22` and `#8e1f4f`, bands `#4a6b3f`, `#908862`, `#b3a99a`, `#f2f2f4` (the 40° class and the middle bands since the pipeline follow-up; the pass left them `#c0392b`, `#8a8158` and `#9b9182`) |
| Data band | rendered terrain at L 0.309 to 1.000 over 137 cases of the default layers |
| Color logic kept | low ground green and high ground stone; snow and ice pale; lakes blue; the trail red, as Norway's marked trails are painted and mapped (the red T on the cairns); the hypsometric bands green to brown to gray to white |
| Far end | the marks on their own grounds: labels on halos, the trail and the marker on a casing |
| Labels | `#0f1c23` on a 3 px halo `#f6f9fa` at 0.85: worst 11.98 (text, ≥ 4.5); second line `#45555d`: worst 5.35 (both over the 40° class in shadow, once `palette.py` drew it over the 30° class as the shader does; 12.04 and 5.38 before the follow-up) |
| The trail | bare on the terrain it falls to **1.00** (over the third band in half sun with the follow-up's bands; the second band in full sun before); on a casing of `#f6f9fa` at 0.90, 1.25 px each side: worst **4.20** (mark, ≥ 3) |
| The marker | bare 1.02; on the same casing 14.25 (1.05 and 14.28 before the follow-up: its darker 40° class, and the 30° class modeled under it) |
| Ghost key | one style in both themes, since the plate is one appearance: a 1.4 px `#0f1c23` stroke at rest 0.72 over a 3.4 px halo `#f6f9fa` at 0.60: worst 3.89 over every base (≥ 3; 3.97 before the follow-up's darker 40° class) |

**The casing** is the cartographer's: a hard pale edge under a line, as the labels have their
halo. It is not a glow and has no blur. It is drawn under the trail, the marker's stick and the tool
line, and nowhere else (the connecting routes and the rivers are secondary lines and stay bare).

**The viewshed's two states are fixed in code.** The stock shader tinted visible ground toward the
viewshed color at 0.42 and turned hidden ground 22 % gray and 12 % darker; on sunlit ground the two
separated by dE 0.001 under simulated protan vision (the stock code's own comment measured the
light palette's weakness). This pass tints seen ground at 0.50 and veils hidden ground toward
`#f6f9fa` at 0.40, the way haze veils far ground: worst separation dE 0.117 in all four visions
(≥ 0.10).

**The measure and line-of-sight line** is the marker's ink on the casing (14.25), solid where the
sight is clear and dashed where the terrain blocks it, so no color carries "blocked". The stock line
was the viewshed teal (2.24 on that casing) turning to the trail's own red past the block, which
gave the trail's color a second meaning.

**The trail's red in the chrome.** The profile in the controls sheet marks its steep stretches in
the trail's red, on the chrome's page, so it reads each theme's own block of `colors.json`: light
`#c0392b` on the page 4.64, dark `#e8705f` on the page 5.63 (marks, ≥ 3). The light block's red on
the dark page would be 3.15. This is the one place the file's dark block is read (owner call 2).

**Data-owned pairs** (owner call 10). The pass measured and reported them and left `colors.json`
byte-identical; the pipeline follow-up changed the file in `tools/06_editable.py` and rebuilt it,
and `palette.py` now checks the first three:

- The slope classes `#e67e22` and `#8e1f4f` separate by dE 0.235 to 0.268 in the four visions,
  with the 40° class drawn over the 30° one as the shader mixes them. (The pass's `#c0392b`
  measured 0.134 to 0.157 with a model that left the 30° class out.)
- The 40° class is no longer the trail's color: `#8e1f4f`, a crimson, against the trail's
  `#c0392b` separates by 0.121 to 0.142 as named colors, where the pass had **the same color**. As
  rendered on a sunlit face (`#ab495a`) it is 0.062 from the trail's line color, reported: a red
  lit by the sun comes close to another red, and the trail stays a line on its casing (4.20). The
  dark block's 40° class, which the plate never draws, moved with it to `#b64770`.
- The elevation bands keep their hues and spread their lightness: `#4a6b3f`, `#908862`,
  `#b3a99a`, `#f2f2f4`. Every pair separates by at least 0.121 in full sun (the middle pair, which
  was 0.063; the green and olive pair, 0.124, was 0.098), 0.105 in half sun and 0.114 as the
  legend's flat swatches. In deep shadow the closest pairs come to 0.063 to 0.068, from 0.036; the
  legend's ticks at 1 400 m and 1 800 m carry the reading there.
- The lake tint against high ground in full sun: dE 0.076, reported. Lakes also have their surface
  mesh and their names.

### CSS custom properties this app adds (theme-independent unless stated)

`--burn: #1b110b` (redefined `#fcf2e5` in the dark block), `--plate-ink: #0f1c23`,
`--plate-ink-2: #45555d`, `--plate-halo: rgba(246, 249, 250, 0.85)`, and `--trail`, set at run
time from the current theme's `colors.json` block (the profile's red).

---

## 3. The chrome, object by object

Besseggen is HOUSE 4.0's *3D view with time*: the time is the sun's hours over one day. It also
keeps a sheet of controls (HOUSE 4.10's "any sheet of controls"), because the walk, the tools, the
pace and the saved viewpoints are the app, and because the marketing camera drives its three-stop
grip (section 5). The frame at 390 x 844 (CSS px, safe areas outside):

```
+------------------------------------------+
| Besseggen                                | 22  name 15/650
| Kartverket data, retrieved 22 Sep 2026   | 16  the stamp, 11.5 --ink-2, opens About
+------------------------------------------+
| [card]                              [+]  |
|                                     [-]  |     the plate: the terrain, daylight in
|                                     [F]  |     both themes, labels on halos; keys:
|                                     ---  |     Zoom in, Zoom out, Fit the route /
|                                     [L]  |     Layers /
|                                     ---  |     Hide the controls
|                                     [H]  |
+------------------------------------------+
| (N)  5 km |-------|  at 14.0 km, vertical x1.0 | 24  the instrument line: north, scale
| The burn: direct sun at the marker, Gjend… | 30  the caption: two lines, fixed
| 06:42 to 20:22 (13 h 40 min). Terrain sh… |
| Terrain, trail, lakes and names: Kartv…  | 15  the credit line (on its side: two lines beside the instrument line)
+------------------------------------------+
| 14 Jun, 07:00 CEST     Sun 17.4° up, ENE | 28  the time row
|  <  [>]  >   .:||||||||||:.   *--------  | 58  Previous day, Play, Next day; the track
|              06:00   12:00   18:00       |     with the Burn, its labels inside
+------------------------------------------+
|                ----                    ^ | 44  the grip: Show more controls
| 0 m walked, at 999 m, 9 % grade, 4 h 33… | 20  the walk's figures
| [profile, 88 px]                         | 88
| 0 m up and 0 m down so far …  [Gjendesh… | 44  totals; the direction key
+------------------------------------------+
```

That leaves about 423 px of plate with the sheet at its first stop and about 667 px in focus mode
(`shoot.mjs` measures both and holds them at ≥ 400 px and ≥ 640 px at 390 x 844). The page is a
column: header, plate, caption band, player, sheet; `100dvh`, `overscroll-behavior: none`; the
plate `flex: 1 1 auto; min-height: 180px`, the sheet `flex: 0 1 auto; min-height: 0` and scrolling
inside itself, so at the sheet's top stop the plate keeps at least 180 px instead of the stock 62 %
drawer leaving it 96. Wide screens (≥ 820 x 480) keep the sheet as a 372 px column at the right, as
today; a phone on its side, section 3's last rows.

| Object | Here | Notes |
| --- | --- | --- |
| **Header: name** | `h1` `Besseggen`, 15/650, `translate="no"` | The Library name; never renamed. The stock 25 px serif title, its text-shadow over the sky and its focus-mode shrink go. |
| **Header: stamp** | `<button>` opening About (`aria-haspopup="dialog"`, described *Opens About this data.*), 11.5 px `--ink-2`, a 44 px hit: `Kartverket data, retrieved 22 Sep 2026` | Data built once: the stamp names the edition. The date is `data/about.json`'s `terrain.retrieved`, written by `js/units.js`. While loading it counts: `Reading the terrain… 3 of 6` (the six level files), then `Reading the trail and the names…`. Nothing is refreshed, so no stale state. The stock subtitle (`Jotunheimen`, then the date line) goes: the date is in the player. |
| **Header: units key** | none | Owner call 9 (feet and miles). |
| **Row of tabs and words** | none | Thirteen layers belong in a sheet, as Milky Way's nineteen did; the camera's views (`Whole area`, `On the route`) are actions, not states, and stay in the sheet; `Fit the route` becomes a key. The header is two lines. |
| **Key column** | `--sheet` plates on the plate's right edge, inset 8 px: `Zoom in`, `Zoom out`, `Fit the route` / `Layers` / `Hide the controls` | 44 x 44 hits drawn 36 x 44, 16 px marks in 1.5 px strokes, `--ink-2` at rest. Zoom keys call the stock `rig.zoomBy()` (a dolly in orbit, a lens on the ground). `Fit the route`'s mark: four corner brackets around a short zigzag (the trail), not the house's Whole world circle. `Layers` carries `aria-haspopup="dialog"` and `aria-expanded`; its mark is three irregular contour lines, not the stock two-rhombus glyph. Where five keys do not fit the plate's height (the sheet at its top stop, a phone on its side), the keys run as a row along the plate's top. The stock round `Shading layers` and `i` buttons at the top right go, which also ends their overlap with Snuggery's full-screen exit control on iOS 18 (plan 0008 D8). |
| **Caption band: the instrument line** | in the legend slot, 24 px: the north mark, then the scale bar and its words | The stock compass and scale bar leave the plate (HOUSE 4.1: nothing on the plate but the keys, the card, a notice and the ghost key), which also ends their collision with place labels (B1). North: a 20 px drawn needle in `--ink` pointing to true north with the grid north arm dashed in `--ink-3` and an `N` in 10.5 px; its accessible name as today (`Compass: true north is …`). Scale: a 2 px `--ink` bar of the stated length with 4 px end ticks, its length label before it (`5 km`) and `at 14.0 km, vertical ×1.0` after it in 11 px `--ink-2`; in first person, `at 6 m`. Written by `units.js`, never transitioned. |
| **Caption band: the legend rows** | only while a colored layer is on, one 30 px row each, the plate giving up the rows once per toggle | `Slope angle`: a 6 px bar from 0° to 60° painted with the layer's own two classes at their angles, ticks at `30°` and `40°`. `Elevation`: the four bands as a bar from 950 m to 2 370 m, ticks at `1 000`, `1 400`, `1 800 m`. `Viewshed from 1 743 m`: the two states as a two-part bar with `seen` and `hidden`. Each title from the data's words (HOUSE 4.5); 1 px `--line-strong` frame at 60 %, square ends. |
| **Caption band: the caption line** | 11 px `--ink-2`, fixed height: two lines from 360 px, three below | The Burn's sentence (section 1, test 3). While a tool waits for points, the tool's instruction replaces it (`Tap two points to measure between them.`), and the stock red pick bar on the plate goes. With exaggeration on, the instrument line says so. `shoot.mjs` measures the longest sentence the data can produce (every waypoint and three-spell days) at 320 and 360 px. |
| **Caption band: credits** | the constant `CREDITS`, 10.5 px `--ink-2`, on screen in every mode | `Terrain, trail, lakes and names: Kartverket, CC BY 4.0`, as proposed and accepted (owner call 8). Commas, no middle dots. Every source, license and capture project stays in About. |
| **Player: time row** | the one large figure `14 Jun, 07:00` 600/21 px, then `CEST` (or `CET`) 12.5 px `--ink-2` after U+202F; at right the lead, `Sun 17.4° up, ENE (73°)`, 12.5 px `--ink-2`; below the horizon `Sun below the horizon (−5.2°)` | Dates by hand in `js/units.js`, day before month, 24-hour, Norwegian time from `js/sun.js`'s own rule (never the phone's zone, as today). VoiceOver hears `14 June, 07:00, Central European Summer Time`. No weekday: `Sun 14 Jun` would read as the sun. Below 360 px the lead drops its parenthesis. **Empty until the data is in**, so the camera's `CEST` wait cannot pass early. Nothing in the row transitions. |
| **Player: transport** | `Previous day`, `Play` / `Pause`, `Next day`, 44 x 44 | The track holds one day; the step keys step a day, the live region saying the new date in words, and the Burn recomputing. Play is the one solid control: a 32 x 32 `--ink` square, `--page` triangle, two bars while playing, its mark always its name; described *Plays the day, one hour a second*. |
| **Player: the track** | `js/track.js` on Global Weather's pattern: `id="slider"`, `role="slider"`, 288 steps of 5 minutes (the stock slider's step), `aria-valuetext` in words, the Burn drawn in it (section 1) | Left and Right move 5 minutes, Page Up and Page Down an hour (12 steps, a stated departure from the house's eight), Home and End to the day's ends. **The scrub rule holds** (B3): on every drawn frame the lighting, the cast shadows, the thumb, the time row, the lead and `aria-valuenow` are the same step. The frame takes the newest wanted step, recomputes the cast-shadow sweep for it (shell and core: `shadowMs` 14.8 and 15.2 in the two themes, printed by `node tools/.work/look.mjs`, headless), sets `shown`, and draws; stale wanted steps are dropped; the stock 170 ms debounce goes. There is no low-resolution preview: a slow phone draws fewer frames, each one whole. `shoot.mjs` counts frames drawn with a sun and a shadow raster from different steps (must be 0) and prints the sweep time as a trend. |
| **Play** | the day at 1 s = 1 h (12 steps a second) on the clock, from the shown step to 24:00, where it stops; Play at the day's end starts from 00:00 | Every frame is one whole step with its own shadows; if a frame cannot keep up, play skips steps rather than blending (the newest-request rule). Under Reduce Motion: one step of an hour each second. About and Layers hold it while they are open, and it goes on when they close; a touch on the track stops it and lands on the step under the finger. Hidden: stops. |
| **The date** | stays in the sheet's `Sun and shadow` section as a house-drawn slider (`Date, day of year`, 1 to 365), its value `14 Jun 2026`; the scrub rule applies to it too | The step keys move a day; the slider makes long jumps. The stock day-events sentence (sunrise, sunset, golden hours, twilight, the noon altitude) stays under it, rewritten as sentences without middle dots. |
| **Readout card** | the tapped point: `--sheet`, 1 px `--line-strong` edge, 8 px radius, top-left inset 8 px, at most 280 px wide and 34 % of the plate's height (scrolling inside), bottom-left when it would cover the tapped point | Kind line 12.5 px `--ink-2` with ✕ (SVG, 44 px hit, `Close`): `Tapped point`, or `On the trail, 5.03 km from Gjendesheim` when the tap snapped to the walk. The one figure: the height, `1 741 m` (21/600, unit 13.5 after U+202F). Rows (12.5 px, values 560): `Position 61° 29.665′ N, 8° 48.789′ E`; `Direct sun, 14 Jun 03:47 to 22:27`; `Total 18 h 40 min`; spells when more than one. **The tools' results live here too** (Measure, Line of sight, Viewshed, as their stock rows and the cross-section and peak list), with the tool's name as the kind line, so the stock jump of the sheet to its top stop goes. In: 120 ms fade and 4 px rise; out at once; text updated in place. A tap says it once in the live region: `Tapped point, 1 741 meters. Direct sun on 14 June from 03:47 to 22:27.` Closing the card leaves the marker where it is. |
| **The marker** | the stock 90 m stick in the marker's ink on the casing, its label on the house halo with the selection tracer under it: the waypoint's name and height when it stands on one (`Gjendesheim, 999 m`), the height alone elsewhere | The stock red pill goes. The Burn and the card follow the marker, whether the walk's cursor or a tap put it there. |
| **Labels on the plate** | the stock DOM labels, restyled: names 11.5/560 `--plate-ink`, their heights 10.5/400 `--plate-ink-2` on a second line; peaks 11/400; km marks 10.5/400; each over a 3 px halo (`paint-order: stroke fill; -webkit-text-stroke: 3px var(--plate-halo)`) | No pill, border or background. Waypoints carry a 4 px disc in the trail's red before the name (they are on the trail); peaks none. Widths measured in `"Ysabeau Office"` after the face has loaded (the stock estimate is 6.2 px a character). **Labels are kept out of the card's, the key column's and the ghost key's rectangles** (HOUSE 4.7; B1). If WebKit does not paint the stroke under the fill on HTML text (a phone check), the fallback is eight zero-blur `text-shadow` offsets of 1.5 px in the halo color, as Milky Way's. |
| **About** | a full-height `--sheet` sheet from the stamp: `role="dialog"`, `aria-modal`, slides up 220 ms on `--sheet-in`, closes at once, `Close` at the top right and the foot, Escape, focus held and returned | First, in `--ink` at 13.5/1.5: `Not a navigation tool.` (600) and about.json's `notNavigation` sentence: no colored bar, no box. Then the four house sections, headed 13.5/650 in sentence case, separated by 1 px `--line` rules: **1. What the picture is**: the terrain lit by the real sun for the date and hour shown, the cast shadows swept over the 16 m grid, the fixed hillshade lamp, the contours; the plate's daylight look in both themes as a display choice; the scale bar true at one distance; the Burn, what it shows and what it does not (section 1, test 6); the lake surfaces at the lidar's level. **2. This data**: `label: value` lines (source and model resolution, survey projects, elevation range, the walk's length, ascent as shipped with the unsmoothed and raw figures, sampling, the lakes' two levels). **3. Sources and credits**: the four Kartverket blocks field by field (`Owner:`, `License:`, `Retrieved:`, the values verbatim), three.js r186 (MIT), and `Type: Ysabeau Office by …` (section 4). **4. How the data gets here**: built once by `tools/build_all.sh`; nothing is fetched; no position, no sensor; the boat sentence; how the sun is computed; the projection; how to move around. The stock uppercase heads, the accent-bordered lead box and the right-hand sheet with its long shadow go. |
| **Layers** | the same sheet as About, opened from the key column | Thirteen rows, each a `<button aria-pressed>` drawn as the house's 28 x 28 key (on: `--ink` 12 % plate and a 1.5 px check; off: a 1 px `--line-strong` frame), the name 13.5 px, the description 11.5 px `--ink-2`. The stock accent toggle switches go. The lake note is corrected (B5). |
| **The controls sheet** | the stock three stops, on `--page` with a 1 px `--line` rule on top | **Grip**: a 36 x 4 px `--line-strong` bar centered and a drawn chevron 1.5 px `--ink-2` at the right, a 44 px hit, its accessible name exactly the stock three (section 5). **Stop 0, the walk**: one line of figures at 12.5 px (values 560 `--ink`, words `--ink-2`: `0 m walked, at 999 m, 9 % grade, 4 h 33 min left`), the profile (below), a 44 px row with the totals sentence and the direction key `Gjendesheim to Memurubu`. **Stop 1, sun and camera**: `Sun and shadow` (the date slider, the day-events sentence), the camera keys `Whole area` and `On the route` as words, `Fly the route` / `Stop` and `Free orbit` as text keys. **Stop 2, everything else**: `Terrain` (vertical exaggeration), `Tools` (`Measure`, `Line of sight`, `Viewshed` as words with the tracer, `aria-pressed`; `Clear`), eye height, `Walking pace` (`Tobler`, `Naismith and Langmuir` as words with the tracer, `role="radio"`; the pace slider; the model's sentence), `Saved viewpoints` (each a 44 px word key from `data/viewpoints.json`, wrapping; `Save this view`, `Clear mine`). Section heads 13.5/650 sentence case between 1 px `--line` rules. Sliders are the native range inputs drawn in the house's language by CSS alone (a 1 px `--line-strong` track, the value so far 2 px `--ink`, an 8 px `--ink` thumb with a 3 px `--page` ring), labels 12.5 px `--ink-2`, values 12.5 px tabular right-aligned. The stock pills, chips in the accent, the `select`, the uppercase heads and the `Debug readout` and duplicate `Place names` checkboxes go (owner calls 5 and 13). |
| **The profile** | the stock SVG, redrawn: the line 1.5 px `--ink-2`, from the start to the cursor 2 px `--ink` (the house's "so far"), no fill but a 6 % `--ink` wash under the line; steep stretches 3 px in `--trail`; gridlines 1 px `--line` with their heights 10.5 px `--ink-3`; km numbers 10.5 px `--ink-2`; waypoint dots `--ink` and names 10.5/560 `--ink` on a 3 px `--page` halo (`paint-order: stroke`); the cursor the house's tracer head with its rule the strip's height | The waypoint names are drawn over the line today (B2); the halo fixes it. The steep red gets its key in the figures line's description and in About: `Red: 25 % or steeper over 100 m` (B4). Its `aria-valuetext` through `units.js`, `5.03 kilometers, 1 740 meters`. |
| **Notices** | a `--sheet` plate at the plate's foot, centered, `role="alert"`, 13.5 px, at most 300 px, no icon | The stock warning box in the sheet's last stop and the loading overlay's `Could not start:` go. Sentences in the file's terms, no apology, no em dash: `data/pace.json could not be read (HTTP 404); the app's own copy is used.` (or, on a later re-read, `the copy read before is kept`) `data/terrain-L3.bin is 5 577 000 bytes; the manifest says 5 577 100.` WebGL refused: `This phone gave no 3D graphics just now. Close other apps and open Besseggen again.` |
| **Live region** | one `<p class="sr" aria-live="polite">` | A tap's sentence; a day step's new date; focus mode's two sentences; a tool's result headline. Never per frame. The track's arrow keys add none. The stock `aria-live` on the readout goes. |
| **Focus mode** | `Hide the controls` alone in the column's last plate; the ghost key `Show the controls` (`aria-keyshortcuts="Escape"`) top-right of the plate, 8 px under the top safe area; Escape; the double-tap on the terrain kept both ways (D5 (3), the camera uses it); the F key kept | Leaves (`hidden` and `inert`): the header, the key column, the legend rows, the controls sheet, an open card, any open dialog. Stays: the plate; the stamp, moved into the caption band as its first line; **the instrument line** (owner call 12); the caption; the credits; the player. A tap still opens the card. **Remembered** as `besseggen:focus` through the stock `store` (`true` / `false`), restored before the first draw (the house rule; the stock app deliberately forgot it, owner call 7). Sentences: `Controls hidden. Press Escape or the corner key to show them.` and `Controls shown.`; focus moves only when the keyboard did it. Fades: chrome out 160 ms, the ghost key in 200 ms, one resize. The double-tap still stands down while a tool waits for points, as today. The stock slim column of round buttons, the `?` key and the gesture card go (owner call 6). |
| **The opening** | none | The arrival is the terrain appearing as its tiles stream in, framed on the route as today. The stock loading overlay, its 30 px serif title and its accent progress bar go; the stamp counts. |
| **Motion** | HOUSE 4.12 | The sheet's stop changes are instant (the stock 280 ms slide resized the plate every frame of it); focus mode's chrome fades 160 ms. The fly-through keeps its 90 m/s along the trail and its `Stop`; under Reduce Motion it stays `Step to the next point`, as today. Viewpoints and `Fit the route` are cuts, as today. Hidden: play and the fly-through stop; a return re-reads the editable files, as today. Reduce Motion: every CSS duration 0 s, play in hour steps once a second. |
| **On its side** | HOUSE 4.13 with the sheet as a right column, `min(330px, 46%)`, as today | Header one 46 px row (name over stamp); the caption band's instrument line and the credits side by side (the credits in two lines, 150 px wide) over a two-line caption; the player one row (the time row stacked at left, the transport, the track); the key column a row along the plate's top. At 844 x 390: the plate 227 px, 255 px in focus mode (≥ 220, measured in `shoot.mjs`). Focus mode takes the sheet column away too, as today. |
| **Safe areas** | HOUSE 4.14 | Every band pads itself; the sheet pads the bottom inset; the card and the ghost key sit under the top inset in focus mode. Phone checks. |

**What does not apply, and why:** a units key (owner call 9); a row of tabs and words (no views
that are states; thirteen layers belong in a sheet); a color legend by default (no default layer is
read through a color scale; the legend rows appear with the layers that are).

---

## 4. Type

- **The house file, byte for byte.** `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
  `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
  sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copied from
  `global-weather/fonts/` (`shasum -a 256 ../global-weather/fonts/*` printed both). The one
  `@font-face` rule exactly as HOUSE 2.5 gives it.
- **No supplement.** Every character the app and its data write was read against the cut's
  character map (fontTools 4.60.2, `getBestCmap()` on the shipped file, over `index.html`,
  `styles.css`, `app.js` and `js/*.js` with comments stripped, the five editable JSON files and the
  string properties of the five GeoJSON files). The only miss is U+2192, the right arrow: once in
  `index.html` and twice in `app.js`, all of them the direction key, which becomes words
  (`Gjendesheim to Memurubu`). Every place name (å, æ, ø, the acute and grave accents of SSR's
  names) is in the cut.
- **Removed:** `atkinson-hyperlegible-latin-400-normal.woff2`, `…-700-normal.woff2`,
  `newsreader-latin-400-italic.woff2`, `newsreader-latin-500-normal.woff2` and their `OFL.txt`
  (87 680 B together, `cat fonts/* | wc -c`), the four `@font-face` rules, `--serif`, the monospace
  stack of the debug readout, and the credits naming the two faces in `CREDITS.txt` and `NOTES.md`.
  Fonts after the pass: 40 075 B.
- **The scale here:** name 15/650; stamp 11.5; caption 11; the instrument line 11; the legend
  titles 11.5/600; the track's, the legend's and the profile's labels 10.5; credits 10.5; the time
  21/600 (the one large figure in the bands) with `CEST` and the lead at 12.5; the walk's figures
  12.5 (values 560); keys and sheet rows 12.5; section heads in the sheet and About 13.5/650; About
  prose 13.5/1.5 within 62 ch; card kind 12.5, card figure 21/600 with its unit 13.5, rows 12.5;
  plate labels 11.5/560, 11/400, 10.5/400 over the halo; notices 13.5. The stock 25 px serif
  title, 30 px load title, 21 px serif sheet titles, 15 px bold stat figures, 9 to 9.5 px profile
  and label text, uppercase tracked heads and the slashed zero of Atkinson go.
- **Text waits for the face.** `document.fonts.load('560 11.5px "Ysabeau Office"')` before the first
  frame with labels and before the profile's labels are measured (`relayout()` measures with
  `getBBox`, so a fallback face would place every name wrong); labels and the profile relaid on
  `document.fonts`' `loadingdone`. Every font string in a script names `"Ysabeau Office"` first.
- **Credit line, word for word** (About, `NOTES.md`, `CREDITS.txt`): `Ysabeau Office by Christian
  Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.`
  `CREDITS.txt` also quotes the face's own copyright line, name ID 0 of the shipped file (read with
  fontTools): `Copyright 2023 The Ysabeau Project Authors` followed by the project's address in
  parentheses.

---

## 5. The camera's strings (HOUSE 7.4)

Searched in `Tests/SnuggeryUITests/MarketingCameraCase.swift` (`waitForBesseggen()`, lines
413-423), `MarketingShotsUITests.swift` (shot 19 at 469-476, the README panes at 649-687) and
`MarketingClipsUITests.swift` (clip 1 and its sheet helpers, 66-148).

| String | Role | Verdict |
| --- | --- | --- |
| `CEST` or `CET` in visible text (waited up to 240 s; matched case-insensitively as a substring) | the zone after the time row's figure | **kept**, moved from the header's subtitle to the player. The time row is empty until boot completes, so the wait still proves the terrain is in. No other visible text may contain either sequence before or after (About's text, which names both zones, is in a `hidden` dialog). |
| `Show more controls`, `Show all controls`, `Hide the extra controls` | the grip's accessible name at stops 0, 1 and 2 | **kept** exactly. The grip stays a `<button>`; the three stops and their order stay. |
| `From the boat on Gjende` | a saved-viewpoint key at stop 2, its words from `data/viewpoints.json` | **kept**: a `<button>` named by the data's own name. Still `display: none` below stop 2, as today (plan 0008 D7 taught the camera to raise the sheet first). |
| `Stop` | the fly key while flying | **kept**. No other control may be named `Stop` (the Play key says `Play` or `Pause`). |
| `Fit the route` | was a chip in the sheet's camera row; now a key in the key column | **kept** as the exact accessible name of a `<button>`, the only control so named. The camera finds it by label wherever it is; it is in the accessibility tree at every sheet stop (the key column turns into a row along the plate's top when the plate is short, it never hides). |
| `Fly the route` | the fly key at rest (`Step to the next point` under Reduce Motion, as today) | **kept**. |
| a double-tap on the terrain at (0.5, 0.42) of the web view | focus mode, in and out | **kept** both ways (D5 (3)). At 390 x 844 with the sheet at stop 0 that point is on the plate; the first tap of the pair opens the card for the tapped point, and focus mode closes it on the way in. |
| new: a remembered focus mode (`besseggen:focus`) | the ghost key `Show the controls` | **already guarded**: `waitForBesseggen()` ends with `showControlsIfHidden()` (`MarketingCameraCase.swift` 418-424), as `waitForGlobalWeather()` does, so the camera needed no change. |

Timings: nothing the camera waits out gets longer. Viewpoints and `Fit the route` stay cuts (the
stock `setOrbit` tween is never used: `frameBox` passes `animate = false`), loading gains no
opening. The comment in `MarketingShotsUITests.swift` (649-662) that said the app "has no home
control" now names `Fit the route` (the lead's correction after the pass).

---

## 6. Budgets

Measured on the working tree before the pass:

| | Today | Cap | Command |
| --- | --: | --: | --- |
| App code (every shipped `.html`, `.css`, `.js` outside `vendor/`, `data/`, `tools/`; 15 files) | 215 934 B | **227 000 B, ruled by the lead** (plan 0011 D11; held at 215 934 B by D5 (2) until the build measured 226 148 B after the five trims below). Owner call 1 | `find . -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.mjs' \) -not -path './vendor/*' -not -path './data/*' -not -path './tools/*' -print0 \| xargs -0 wc -c` |
| Fonts | 87 680 B | 160 000 B; planned 40 075 B | `cat fonts/* \| wc -c` |
| ZIP, as `build-zips.yml` packs it (49 entries today) | 16 871 005 B | **21 088 756 B** (today x 1.25; no face allowance, since the app swaps its faces: HOUSE 8) | `zip -q -r -X OUT . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`, then `wc -c` |

With the faces swapped and nothing else changed, the same command on a scratch copy gives
**16 823 249 B**. `ART.md` itself ships (root `*.md` files do): 30 092 B zipped alone (`zip -q -X
OUT ART.md`, then `wc -c`). The
ZIP has over 4 MB of headroom; the code cap is the one that binds, hard.

The data, pinned before step 1 (`check.mjs` checks them every run):
`find data -type f | sort | xargs shasum -a 256 | shasum -a 256` gives
`047cc6a16c1adad5d7bc34ab09b6fd51adf1a3b29d04bc07a83fa83a0b69a01e`, and each of the 17 files equals
the table in `NOTES.md` (`diff` against `NOTES.md` lines 367-383: identical). Since the pipeline
follow-up rebuilt `about.json` and `colors.json` the digest is `97d6b944…2cd3`, the figure `check.mjs`
pins now; the other fifteen files are byte for byte as before. `vendor/three.core.js`
`9edde002…`, `vendor/three.module.js` `9052042d…`, `vendor/OrbitControls.js` `30386f71…`,
`vendor/RoomEnvironment.js` `77d4d2be…`, `vendor/three-LICENSE.txt` `8b378ebe…` (`shasum -a 256
vendor/*`).

**The code ledger** (estimates for planning; the builder measures after every step and
`check.mjs` prints the truth):

| Change | Bytes |
| --- | --: |
| Freed: the stock stylesheet (18 297 B) replaced by the house stylesheet for this app: glass, pills, accent chips, toggle switches, the right-hand sheets' shadows, the hint card (754 B), the debug panel (596 B), the loading overlay (518 B), the four `@font-face` rules | −1 500 to −3 500 |
| Freed: the debug readout (`updateDebug` 853 B, the bench button's handler 670 B, its toggle's wiring, its markup) | −1 900 |
| Freed: the `First and last sun` tool (`runFirstSun` 1 199 B and its entries), less the card's sun rows | −900 |
| Freed: the gesture hint, its auto-show and the `?` key (about half of `js/focus.js`'s 4 274 B, and its markup), the loading overlay's markup and wiring, the pick bar, the duplicate `Place names` checkbox, the native time slider's markup and handlers | −2 700 |
| Added: `js/units.js` (less `util.js`'s `fmt` family, which moves in) | +2 600 |
| Added: `js/track.js` (Global Weather's 6 695 B adapted: no per-step ticks or day labels; the Burn) | +6 500 |
| Added: `js/plate.js` (`palette.py --json`, pasted) | +450 |
| Added: the player (wanted and shown, the per-frame shadow sweep, play on the clock, the day keys, the time row and lead, the live region) | +2 200 |
| Added: the caption band (the instrument line moved, the caption's sentences, the credit constant, the legend rows) | +1 200 |
| Added: About and Layers as dialogs, the card's rows and placement, labels' halo and exclusions, the face wait, the casings and the dashed tool line, focus mode's house version, the stamp's counter, the notices, the sheet's words | +5 400 |
| Added: `index.html` restructured (less the removed blocks) | +800 |

The middle of those ranges lands about **11 200 B over** the held cap, near 227 100 B. **The
builder trims, in this order, until the code is at or under 215 934 B, measuring after each:**
(1) write the stylesheet for this app only, nothing of Global Weather's map, globe or legend-gradient
rules (−1 000 beyond the row above); (2) build About's section 2 and 3 from one table of
`[label, value]` pairs (`buildAbout` is 7 282 B today; −1 000); (3) drop the walk slider in the
sheet's stop 1 (the profile's drag already walks the first-person camera; −700); (4) drop the
verification hooks `shoot.mjs` does not use, `bench`, `debugSelect`, `drawnLevels`,
`viewshedRings`, `profileLine` (3 063 B measured with `sed -n … app.js | wc -c`) and `gradientAt`,
with `NOTES.md`'s "What was checked" saying the numbers stand as measured on 2026-09-22 with hooks
since removed (−3 400); (5) drop the `now` notch (−400). That reaches about 221 000 B. **Never minify
and never strip comments.** If the code is still over after (5), the builder stops there and
reports the figure: owner call 1 names what the lead can rule (a cap, as Milky Way's 240 000 and
242 000 were ruled) or what the owner can cut instead.

---

## 7. The generated-page tells, answered

| Tell | Besseggen |
| --- | --- |
| 1. Warm cream ground, high-contrast serif display, terracotta accent | Today, exactly that: `--panel #f3f1ec`, a 25 px Newsreader title, `--accent #b3492f`. The chrome's ground becomes the house film base `#e8eef0` (cool, h 220); one Renaissance sans at every size; no accent. Warm hues on screen are data: the trail's red, the slope classes, the bands, the sunlit terrain. |
| 2. Near-black ground with one acid-green or vermilion accent | The dark page is the house slate (L 0.224). The plate stays daylight; the stock dark theme's near-black sky goes. No accent. |
| 3. Broadsheet hairlines, zero radius, dense columns | One column; hairlines only between the sheet's and About's sections, the key plates and the bands. Radii 6, 8 and 4 px by role; 0 only on the legend bars. |
| 4. SaaS-card kit, one radius, soft shadow, gradient washes | The stock frosted round buttons, the readout's glass, the 999 px pills, the hint card's and the side sheets' shadows go. One card (the tapped point), one sheet at a time. No gradient but the selection tracer. |
| 5. All-caps tracked eyebrow labels | The stock `SUN AND SHADOW`, `TERRAIN`, `TOOLS`, `WALKING PACE`, `SAVED VIEWPOINTS`, `DISPLAY`, About's `ELEVATION` … heads and the hint's `MOVING AROUND` (`letter-spacing: .06em`) go: sentence case, letter-spacing 0. |
| 6. Meta strings joined with middle dots | `14 June 2026 · 07:00 CEST`, `at 14.0 km · vertical ×1.0`, `+0 / −0 m so far · 13.7 km and 1083 m up in all`, `0 m · 999 m`, `Sunrise 03:43 · sunset 23:08` become commas, sentences or one value per line. The credit line uses commas. |
| 7. "WORD — fragment" with a spaced em dash | 77 em dashes in the shipped code (`grep -o '—' app.js js/*.js index.html \| wc -l`), most in comments; every one in a visible string becomes a sentence, a semicolon or a colon (`Civil twilight lasts all night; it never gets fully dark.`, `clear, but only just: the line grazes the ground at 1.13 km`). Data text kept its own until the pipeline follow-up swept it (owner call 11). |
| 8. A tinted near-black standing in for black | The stock dark sky `#0d1218` and panel `#171c21` go. The chrome's dark page is the house slate; the plate's darkest marks are the stated ink `#0f1c23` and the data's marker `#111418`. |
| 9. Monospace for small data labels | The debug readout's monospace panel goes with the readout. Tabular figures from the one face. |
| 10. An arrow appended to buttons | The direction chip's arrow between `Gjendesheim` and `Memurubu` becomes the word: `Gjendesheim to Memurubu`. Buttons say what they do: `Fit the route`, `Hide the controls`, `Save this view`. |
| 11. One accented word in a headline | None. The one emphasis is About's `Not a navigation tool.`, a safety sentence in `--ink` at 600. |
| 12. Unnecessary labels above content | The stock stat labels under each figure (`distance`, `elevation`, `gradient`) become one line of words and figures; the legend's titles are the quantities their bars measure. |
| 13. Numbered markers | None. |
| 14. Big number, small label, gradient accent | The time (21 px) and the card's height (21 px) only; the stock four 15 px bold stat figures with 10 px labels go. No gradient. |
| 15. Scattered fade-and-slide entrances, hover on every card | The stock overlay, the sheet's 280 ms slide, the side sheets' entrance and the hint's auto-show go; the house's three small transitions answer a touch. The one continuous motion is the sun's light moving over the mountain. |

The interface guidelines, where the house writes its own rule: sentence case (`Hide the
controls`); dates by hand, not `Intl`; `font-display: block`; `translate="no"` on the name, the place
names on the plate and the profile, and the source names; `…` never `...`; `<button>` for every
action (the stock `select` becomes two words); the viewport loses `user-scalable=no`;
`<html lang="en-US">`.

---

## 8. The change list (the builder applies these in order)

Nothing in `data/`, `vendor/`, the pipeline (`tools/01_…` to `06_…`, `geom.py`, `paths.py`,
`build_all.sh`, `verify_data.py`, `package_snuggery.py`) or `screenshots/app.png` changes. This
pass writes none of the pipeline's content files: `data/about.json` is pipeline output and stays
byte for byte (owner call 11). Before step 1, record the hashes of section 6; `check.mjs` pins them.

**The bugs on record, which this pass must fix.** Plan 0009 item 5 and `docs/review/` record none
for Besseggen; the app has no `DECISIONS.md`, and `NOTES.md` records fixes, not open bugs. Plan 0008
D8 records one (Snuggery's full-screen exit control over the `i` key on iOS 18). Reading the app as
a stranger found the rest. Each is a must, and each names its evidence:

- **B1. Place labels collide with the compass and scale bar**, and nothing keeps labels out of the
  readout's or a key's rectangle: `Maurvangen` under `10 km` (`tools/.work/look/light-2-stop2.png`).
  Fixed by items 8 and 11 (the instrument line leaves the plate; labels avoid the card, the keys and
  the ghost key).
- **B2. The profile's waypoint names are drawn through the profile line** (`Besseggen`, `Bandet`,
  `Gjendesheim`, `Memurubu` in `tools/.work/look/light-0-open.png`), so their text fails contrast
  where the line crosses it. Item 13.
- **B3. While the hour or the date is dragged, the light and the cast shadows show different
  times.** `updateSun(false)` moves the sun at once and debounces the shadow sweep by 170 ms
  (`scheduleShadow`, `app.js`). Measured (`node tools/.work/lag.mjs`, headless): straight after an
  input moving 20 Sep from 08:00 to 10:00, the sun reads 19.0° up at 126.3° while the shadow raster
  still holds 08:00 (396 of 800 sample points lit; 662 once it catches up), and one of the two
  animation frames in the following 160 ms ran with the old raster. During a drag the debounce keeps restarting, so every frame
  until the finger stops mixes two times. Item 9 (the scrub rule).
- **B4. The profile's red steep stretches have no key anywhere.** They mark `|gradient| ≥ 0.25` over
  a 100 m window (`profile.js` calls `gradientAt(i, 2)`: two 25 m samples each side). Item 13 says so
  on screen and in About. The walk's gradient figure is over 150 m (`gradientAt(cursor)`, window 3);
  the figures line's description says that too.
- **B5. The Layers note credits the lake levels to N50, but prints the lidar levels.** It reads
  `Lake surfaces are drawn flat at the level N50 states: Gjende 985 m, Bessvatnet 1373 m, Russvatnet
  1177 m, …`, while `data/water.geojson` gives N50's own figures as 1 372 m and 1 175 m and the
  planes sit at `levelM` (1 373.1 m, 1 176.7 m), as About already says correctly. Item 8 rewrites it
  from the same fields About uses: `Lake surfaces are drawn at the water level the lidar reads:
  Gjende 985.1 m, Bessvatnet 1 373.1 m (N50: 1 372 m), …`.
- **B6. Snuggery's full-screen exit control overlaps the app's own top-right key on iOS 18** (plan
  0008 D8). The top-right keys leave the header; in focus mode the ghost key takes that corner,
  which is D5 (3)'s phone check.
- **B7. The dark theme's plate**: a tinted near-black sky, 100 m contours as a white wireframe, a
  north face rendered black at 07:00 in June (`tools/.work/look/dark-0-open.png`,
  `dark-7-boat.png`). Item 8 (one appearance).
- **B8. The arrow in the direction key** is a character the house face lacks (HOUSE 2.3). Item 15.
- **B9. The viewshed's hidden ground is indistinguishable from its seen ground on sunlit terrain**
  for a protan reader (dE 0.001, `palette.py`'s stock line). Item 6.

**The steps:**

1. **`fonts/`**: delete the four Atkinson and Newsreader files and `fonts/OFL.txt`; copy
   `../global-weather/fonts/ysabeau-office-gw.woff2` and `../global-weather/fonts/OFL.txt` byte for
   byte (`cmp` both). No supplement.
2. **`js/plate.js`** (new): `export const PLATE = ` + `python3 besseggen/tools/art/palette.py
   --json` pasted, with a two-line comment naming the command.
3. **`js/units.js`** (new), the one writer of numbers, units and dates, on Global Weather's
   pattern: U+2212 for negatives (never −0); U+202F between number and unit and in thousands from
   four digits (`1 741 m`, `13.68 km`, `1 083 m`; years, clock times, EPSG codes and stedsnummer
   never grouped); `km` from 1 000 m with two decimals below 10 km and one above (the stock
   `fmtDist` rule); durations `4 h 33 min`, `38 min`; percentages `9 %`; angles `17.4°`; positions
   `61° 29.665′ N, 8° 48.789′ E` (degrees and decimal minutes, as a Norwegian paper map is gridded,
   kept; U+202F before the hemisphere; a comma between); dates `14 Jun`, `14 Jun 2026`, `22 Sep
   2026`; clock `07:00`; zones `CET` / `CEST`; spans `06:42 to 20:22`; the spoken forms (`meters`,
   `kilometers`, `degrees`, `14 June`, `Central European Summer Time`, `east-northeast`). The stock
   `fmt`, `fmtDist`, `fmtHM`, `fmtClock`, `fmtDate`, `fmtDateShort`, `MONTHS`, `compassPoint` move
   here from `util.js`, and `fmtLonLat` from `geo.js`. `toFixed` and `toLocaleString` appear nowhere
   else but the allow-list `check.mjs` names (the test hook's rounding, cache keys).
4. **`styles.css`**: rewritten as the house stylesheet for this app: the 3.1 tokens in both themes
   and `color-scheme`, `html, body { background: var(--page) }`, `--face` only, the one
   `@font-face`, this app's tokens (section 2), the column frame, header, key column and states,
   caption band (instrument line, legend rows, caption, credits), player, track, card, the
   controls sheet and its grip, rows, sliders, words with the tracer and text keys, the profile's
   classes, About and Layers as dialogs, notices, ghost key, labels on their halos, landscape at
   `(orientation: landscape) and (max-height: 500px)`, the wide column at `(min-width: 820px) and
   (min-height: 480px)`, gutters 20 px from 700 px, `@media (prefers-reduced-motion: reduce)` zeroing
   every duration, `@media (hover: hover)` hovers, `touch-action: manipulation` and
   `-webkit-tap-highlight-color: transparent` on controls. No `box-shadow`, `backdrop-filter`,
   `text-shadow` (but item 11's fallback, if needed), `transition: all`, uppercase or
   letter-spacing; `.valid, .lead, .track, .track canvas` carry `transition: none; animation: none`.
5. **`index.html`**: `lang="en-US"`; the viewport without `user-scalable=no`; `<meta
   name="color-scheme" content="light dark">`; two `theme-color` metas carrying each theme's
   `--page`; the column (header with `h1` and stamp; the plate with the canvas, the labels layer, the
   key column, the card, the notice and the ghost key; the caption band with the instrument line,
   the legend rows, the caption, the stamp's focus-mode slot and the credits; the player; the
   controls sheet with its grip and three stops); About and Layers as dialogs; the live region; the
   Burn's hidden description. The canvas's description keeps its substance (it names the gestures) in US
   English. The stock `#head`
   buttons, `#pickbar`, `#gauge`, `#focus-kit`, `#hint`, `#debug`, `#loading`, the time slider row,
   the walk slider row if trim 3 is taken, `#t-debug`, `#t-labels` and the `select` go.
6. **`js/material.js`**: the viewshed's two states from `PLATE.viewshed` (seen: mix toward
   `uViewshedCol` at 0.50; hidden: mix toward the veil color at 0.40, two new uniforms); nothing else
   in the shader changes. Comments in US English (`gray`, `normalized`, `color`, `meters`).
7. **`js/overlays.js`**: the casing: `makeLineMaterial` gains a casing pass (a second mesh sharing
   the geometry, `uWidth` plus `2 × PLATE.casing.px`, `PLATE.casing.color` at `.alpha`, drawn one
   render order below) for the trail, the marker's stick and the tool line; the tool line in the
   marker's color with a dash where `vT` is past `uSplit` (`if (vT > uSplit && fract(vT * 60.0) >
   0.5) discard;`). Comments in US English.
8. **`app.js`, the frame and the plate**: create the renderer and start loading as today; the
   stamp's counter from `DataSet.load`'s phases; `fail()` writes the notice; a `ResizeObserver` on
   the plate drives `onResize()` once per change; `applyScheme()` draws the plate from `colors.light`
   in both themes and sets `--trail` from the current theme's block (section 2); `scene.background`
   and the fog from the light block's sky; the Layers note rewritten (B5); the instrument line (the
   compass and scale code moved, not rewritten: `updateGauge()` writes into the caption band); the
   debug readout, the bench handler, the pick bar and the duplicate checkbox removed; `S.debug`
   removed (owner call 5); `window.__besseggen` keeps `stats`, `sunAt`, `dayEvents`, `heightAt`,
   `camera`, `setLayer`, `applyViewpoint`, `setDateTime`, `runTool`, `setEye`, `peaksFrom`, `los`,
   `viewshedVisible`, `shadowAt` and gains `shown()`, `wanted()`, `burn()` (the marker's lit samples
   and spans) and `focus()`; trim 4 removes the rest.
9. **`app.js` and `js/track.js` (new), the player**: Global Weather's track adapted (section 1 and
   3): the day of 288 steps, the Burn, the thumb, the keys, `role="slider"` with `aria-valuetext`.
   The scrub rule (B3): input handlers only record `wanted`; the frame recomputes `sunInfo` and the
   cast-shadow sweep for the newest `wanted`, sets `shown`, then renders; `scheduleShadow` and its
   170 ms timer go; the date slider follows the same path. Play on the clock at 1 s = 1 h, stopping
   at 24:00; Reduce Motion an hour a second; About, Layers and a touch stop it; hidden stops it. The
   day keys, with their live sentence. The time row and the lead (empty until boot completes).
10. **`js/sun.js`**: `directSunWindow` also returns its 2-minute `lit` samples (the spans are built
    from them already); `dayEvents` also returns `altApparent` (section 1); a `norwayNow()` helper (the present instant's Norwegian date and minute, from
    the stock CET/CEST rule) if the `now` notch stays. No change to the algorithm. Comments in US
    English.
11. **`app.js`, labels and the card**: the labels restyled (section 3), measured in the face after
    `document.fonts.load`, and kept out of the card's, the key column's and the ghost key's rectangles
    (B1); the marker's label with the selection tracer. The card for a tapped point (section 3), the
    tools' results moved into it (`runMeasure`, `runLos`, `runViewshed` write the card's body, each
    value through `row()`, which escapes), the placement rule, the live sentence. The `First and last
    sun` tool removed (owner call 4); its numbers are the card's sun rows and the Burn.
12. **`app.js`, the controls sheet**: the three stops and the grip's three names unchanged; the
    sections as section 3 says; tools and pace models as words with the tracer; viewpoints as word
    keys; `Fit the route` leaves the camera row for the key column; `S.tool`'s double-tap rule kept.
13. **`js/profile.js`**: the house drawing (section 3): line, so far, wash, steep stretches in
    `var(--trail)`, gridlines, km numbers, waypoint dots and names on a `--page` halo (B2), the
    cursor as the tracer head; the steep window stated (B4); `aria-valuetext` through `units.js`;
    `relayout()` after the face loads. Its `innerHTML` builds stay (HOUSE 7.1 item 13: no new uses;
    every value it touches escaped, as `escapeHtml` already does for names).
14. **`js/focus.js`**: rewritten to the house pattern (section 3): `Hide the controls` and the ghost
    key, `hidden` and `inert` on what leaves, the stamp moved into the caption band, `besseggen:focus`
    remembered and restored before the first draw, the two sentences, focus moving only for the
    keyboard, the double-tap and F kept, Escape leaving it when no dialog is open. The hint, its
    timer and `focusHintSeen` go (owner call 6).
15. **Words, everywhere shipped** (`index.html`, `app.js`, `js/*.js`, `CREDITS.txt`, `NOTES.md`,
    `ART.md`): US spelling, comments and identifiers included (the frame's center latitude and
    longitude fields and `serialize` take the US spelling; the stored `camera` JSON keeps its shape,
    so a saved camera still restores), except the data's own keys (about.json's British-spelled
    license key), proper names (the official English name of NLOD, the Norwegian open government data license,
    which keeps the British spelling, allow-listed in `check.mjs` by file and word) and text read from
    the data; `meters` in every spoken string (`profile.js` says the British form today); the
    direction key in words (B8); no middle dot, no spaced em dash, no `~` for "about" and no arrow
    character in a visible string or a comment; `Colors from data/colors.json`; `Civil twilight lasts
    all night; it never gets fully dark.`; the notices of `js/data.js` rewritten as section 3 says.
    `check.mjs`'s US list gains the British forms the stock code uses today, all of them found by
    the art pass's count over the shipped files: the British spellings of the meter family (meter,
    decimeter, centimeter, kilometer, millimeter), of centered and neighboring, the -ise and
    -isation forms of serialize, quantize, quantization, optimization, generalize and initialize,
    and the doubled-l modeled.
16. **About** (section 3): the safety sentence, the four sections, the Burn's and the plate's
    paragraphs, about.json's blocks rendered field by field with their values verbatim.
17. **`CREDITS.txt`**: US spelling in the file's own prose (`licenses`, `quantized`), proper names
    kept; the FONTS section replaced: the house credit line, the face's copyright line (section 4),
    and the sentence that `fonts/OFL.txt` is the house's file byte for byte; the RENDERING section
    unchanged. No address is added to a script (addresses stay in this `.txt`, which `check.mjs`'s
    scheme scan does not read, as today).
18. **`NOTES.md`**: the folder list (`fonts/`: the house face), the code map (`track.js`,
    `units.js`, `plate.js`), focus mode rewritten (the house's keys, remembered, the double-tap
    kept), the Burn (what it computes, at what cost), the plate's one appearance and what the dark
    block of `colors.json` is still read for, the budgets table re-measured, "What was checked"
    noting the removed hooks if trim 4 is taken, the credit line word for word, US spelling. The
    determinism table is unchanged, because the data is.
19. **`miniapp.json`**: the name unchanged; `version` `1.2`; the description may name the hours of
    sun (at most 200 characters), the lead's choice.
20. **`tools/check.mjs`** (new, Global Weather's pattern; every item of HOUSE 7.1): the ZIP's limits;
    no scheme address in shipped `.html`, `.css`, `.js`; references relative and present; the folder
    contract (`fonts/` exactly the two house files; `data/` exactly the 17 files); the face's and
    `OFL.txt`'s sha256; the 17 data hashes and the 5 vendor hashes; `miniapp.json`; the vendor-name
    list copied from `global-weather/tools/check.mjs` line 128 as it is (ROT13, never decoded); the
    credit constant word for word; the camera's strings of section 5 with their roles; every
    `localStorage` key read today still read with the `besseggen:` prefix (`camera`, `cursor`, `date`,
    `exag`, `eyeM`, `layers`, `marker`, `minutes`, `paceFit`, `paceModel`, `reversed`, `savedViews`,
    `sheet`), `focus` added, and `debug` and `focusHintSeen` listed as retired with this file's owner
    calls as the reason; SI; nothing that carries a step transitions; `innerHTML` assignments not
    `= ''` no more than the 11 counted today (`app.js` 10, `js/profile.js` 1), and none new; the
    palette (`js/plate.js` equals `--json`, the script exits 0); the tells and the house's three
    additions; the budgets (code at most the cap the lead rules, 227 000 B since plan 0011 D11; fonts; the ZIP
    built as `build-zips.yml` builds it, with `index.html` at its top); US spelling with the count of
    British words in `data/about.json` printed, not exempted silently.
21. **`tools/shoot.mjs`** (new; HOUSE 7.2 as the kind allows): boot (the camera's strings by role and
    name, `CEST` absent before boot completes and present after, the credits, the face loaded);
    text contrast both themes; the Burn sampler (the burn's drawn pixels against the page, 90 % of
    samples ≥ 3, the lowest printed) and, on the plate, the trail's pixels against their casing at
    the opening view and from the boat; the Burn against the script's own decode (its own sun
    formula and its own ray march over a 16 m grid it decodes from `terrain-L2.bin` and the shell,
    at Veslfjellet and Bandet on 14 Jun, 20 Sep and 21 Dec: first and last sun within 4 minutes,
    the spans' count equal); the card's height against the script's own decode at a tapped point;
    SI in every visible text node; the scrub by real touch at 2, 8 and 20 steps a second, with 0
    frames whose sun and shadow raster differ (B3) and the sweep time printed; play (no frame
    backwards, the Play key's mark, About holding play); the plate's height steady while the caption
    changes; the card clear of the tapped point; labels outside the card, keys and ghost key (B1);
    the profile's names outside the line's pixels (B2); focus mode (touch, Enter, F, the double-tap,
    Escape, the ghost key, a reload, the live sentences, hit targets, the plate's growth); the grip's
    three names at their stops; hidden; Reduce Motion (play in hour steps, `Step to the next point`);
    broken data (a missing level file, a bad `pace.json`, a missing `rivers.geojson`, which stays
    optional); widths 320, 360, 375, 844 x 390 and 125 % zoom; hit targets ≥ 44 x 44; pictures to
    `tools/.work/shots/`, never `screenshots/app.png`, whose hash the run checks unchanged; frame
    and sweep times printed as headless figures.
22. **`tools/test_decode.mjs`** (new; no dependencies): the terrain decode in this file per
    `NOTES.md` (integer decimeters, then meters; shared tile edges equal), checked against the
    manifest's tile ranges; `js/sun.js` against this file's own closed-form NOAA at the three dates
    `NOTES.md` tabulates (03:43 / 23:08, 07:04 / 19:32, 05:00 / 22:01); `js/units.js`'s output for a
    table of values (negatives, thousands, years, positions, durations); `js/route.js`'s walking time
    for the whole walk against this file's own Tobler sum.
23. **`tools/DECISIONS.md`** (new): the owner calls (section 9) as they settle, this change list,
    as-built notes and the review record.
24. **`.gitignore`**: already ignores `tools/.work/`, `dist/`, and now `tools/node_modules/` (added
    by this art pass).

---

## 9. Owner calls left open

1. **The code cap.** Ruled 227 000 B by the lead (plan 0011 D11; the build measured 226 148 B). Held at 215 934 B before that. Section 6's ledger lands near 221 000 B after its five
   trims. Either a ruled cap with its reason (the house player and track are what the owner asked
   every app to carry, as Milky Way's 240 000 and 242 000 were ruled) or features named to cut
   instead: Play (about 1 200 B), the legend rows (800), saving and clearing your own viewpoints
   (900), `Free orbit` (400).
2. **The plate keeps its daylight in both themes**, from `colors.json`'s light block. The file's
   dark block is then read only for the trail's red in the dark chrome; its other colors do nothing
   in this version, and the file's own note (one palette per color scheme) describes a file the app
   only half reads. The alternative is the dark block on the plate, with the wireframe contours and
   the black north face of B7.
3. **The signature is the Burn**, over the horizon chart (the skyline from the marker with the sun's
   path across it), which is as honest and more pictorial but needs a 360-ray horizon pass and
   room the bands do not have.
4. **The `First and last sun` tool folds into the marker**: a tap anywhere gives the card's sun rows
   and the Burn, so the tool's chip, its armed state and its result panel go.
5. **The debug readout leaves the screen** (its monospace panel, its toggle, the bench button). The
   test hook keeps the figures; the `debug` key is retired.
6. **The gesture card and the `?` key go.** The gestures stay in the canvas's description and in
   About's last section; the zoom keys and `Fit the route` give a way to move without a gesture;
   `focusHintSeen` is retired.
7. **Focus mode is remembered**, as the house says, against `NOTES.md`'s reason for forgetting it
   (a person returning after a month would not know where the controls went). The ghost key is the
   answer to that reason; the camera gains its guard.
8. **The on-screen credit line**: `Terrain, trail, lakes and names: Kartverket, CC BY 4.0`.
9. **A units key** (feet and miles) in the header. Not in this pass: every height, distance and
   speed is written in SI, as the trail signs and maps of the area are; about 1 500 B to add.
10. **The data-owned colors** (`colors.json`, byte-identical here): the 40° slope class and the trail
    are one color; the bands' middle pair separates by dE 0.063. A change needs `tools/06_editable.py`'s
    colors edited and the pipeline run, a follow-up like Milky Way's. **Settled by that follow-up**:
    the 40° class `#8e1f4f`, the middle bands `#908862` and `#b3a99a` (section 2).
11. **British spellings and em dashes in About from `data/about.json`**: three words (the British
    forms of decimeters, generalized and labeled) and the em dashes in four values stay verbatim on
    screen until a pipeline text pass rebuilds the file (`tools/06_editable.py`'s prose swept, the
    pipeline run, the other 16 data files proven byte-identical). This pass touches no pipeline file.
    **Settled by the follow-up**: the prose swept and the pipeline run; `about.json` holds no British
    spelling and no em dash, and `check.mjs` fails if one returns. (`check.mjs` had counted five
    spellings and five em dashes, in five values; this call first said three words and four values.)
12. **The instrument line stays in focus mode**: north and the scale are the caption of a
    perspective view, needed to read it. The house's legend leaves; the alternative hides them too.
13. **The walk slider** in the sheet's second stop goes as trim 3 if the bytes are needed: the
    profile's drag already walks the first-person camera.
14. **The day keys step a day and Play plays the day at an hour a second**; the date slider keeps
    long jumps.
15. **The trail on a pale casing**: a visible change to the plate, the cartographer's edge that
    lifts the trail's worst contrast from 1.00 to 4.20.

**Phone checks for the device matrix** (none claimed): frame time idle, scrubbing the hour (each
frame's shadow sweep), playing the day, flying the route and dragging the walk; memory after five
minutes; background and return; focus mode in Snuggery's full screen with the ghost key and
Snuggery's own exit control both reachable in the top-right corner (iOS 18 and iOS 26); the labels'
halo (`paint-order` on HTML text in WebKit); the casing's look at the 6.9" screen's DPR; VoiceOver on
the track (the hour, the sun, the marker's state; the Burn's description), on a tap, on the grip and
in the dialogs; the phone on its side with the sheet column; the safe areas of every band; the
camera's `CEST` wait and its clip 1 run end to end on the simulator, then the stills.

---

## After QA (2026-10-01)

What changed after the QA pass, and where this file was corrected to match the build:

- **The code cap is the lead's ruling, 227 000 B** (plan 0011 D11), in `tools/check.mjs`'s
  `CODE_CAP` and in section 6's table and section 9's call 1. The code measures **226 205 B** after
  the fix below (`node tools/check.mjs`: 795 to spare).
- **The phone on its side**: the scale's words (`at 14.0 km, vertical ×1.0`) ran into the credits
  at 844 x 390 and ended in an ellipsis. The credit line there now wraps to two lines, 150 px wide
  at a 12 px line height, so the instrument row stays 24 px and the plate keeps its 227 px; the
  instrument line's gaps went from 8 to 6 px, which also brings the words whole at 125 % zoom
  (312 x 675), where they were cut by 1 px. `tools/shoot.mjs` now checks the words whole at every
  width it opens. At 667 x 375 (the smallest phone on its side, not one of `shoot.mjs`'s widths)
  the row still has no room: the words are dropped to an ellipsis, as before the fix.
- **The Burn's worked numbers** in section 1, the caption and description examples, the wireframe
  and the units list were taken before the eye-height rule (0.5 m above the higher of the 2 m point
  and the 16 m surface; `NOTES.md`). Read again from the running app (`window.__besseggen.burn()`
  and the caption, headless, 2026 dates, `tools/.work/fix/probe.mjs --burn`): Gjendesheim on 14 June
  **06:42** to 20:22, 13 h 38 min (was 06:43; 13 h 40 min after review, below); Bandet's sun on 20 September ends at **16:53**,
  **2 h 27 min** before Veslfjellet's 19:20 (was 16:51 and 2 h 29 min). Veslfjellet's 03:47 to 22:27
  (18 h 40 min), its 4 h 38 min (4 h 39 min after review) on 21 December and no sun at Bandet, Bjørnbøltjønne and Memurubu
  that day are unchanged. The readout card's example row in section 3 now carries Veslfjellet's own
  span (its height is Veslfjellet's). The `firstsun` tool section 1 cites was folded into the marker
  (owner call 4); the figures above come from the Burn itself.

## After review (2026-10-01)

The final review's verdict was "fix": three musts, seven shoulds, six nits. What changed, and what
this file now says:

- **The Play key becomes Pause** (`app.js` `setPlaying`): an `<svg>` has no `hidden` property, so
  the attribute itself is toggled, as Global Weather does. `shoot.mjs` reads the attribute and the
  computed display now, never the expando that agreed with the bug.
- **Focus mode on its side and on a wide screen** (`styles.css`): the header, plate, caption band and
  player have fixed grid rows, so a hidden header leaves an empty auto row and the plate takes the
  height (844 x 390: 227 to 255 px; 1024 x 768: 551 to 583 px), with the stamp, the caption, the
  credits and the time on screen. `shoot.mjs` checks both sizes.
- **One sweep per instant** (`app.js`): `applyTime` returns at once when the instant is the one
  already shown, and play schedules its next frame at the next step boundary instead of on every
  display refresh (a frame an hour under Reduce Motion). `shoot.mjs` checks that the shadows are
  swept exactly when the instant changes, in the scrub at three speeds, in play and under Reduce
  Motion.
- **The Burn's figures add up** (`js/sun.js` `directSunWindow`): every edge of every spell is
  bisected to the minute, and the total is the sum of the spells as written. The caption's numbers
  in sections 1 and 3 changed with it: Gjendesheim on 14 June **13 h 40 min**, Veslfjellet on
  21 December **4 h 39 min**. `shoot.mjs` parses the caption and compares.
- **The marker is named** when it stands on a waypoint: its plate label reads `Gjendesheim, 999 m`
  and the caption `The burn: direct sun at the marker, Gjendesheim, …` (or `No direct sun reaches
  the marker at Bandet on …`); elsewhere both say `the marker` and its height.
- **The card** has no 144 px floor: at most 34 % of the plate (66 px at least), and never up into the
  key row when the keys run along the top (66 px of a 180 px plate at the sheet's top stop).
- **Loading**: the walk line, the profile, its foot, the instrument line, the sheet's sections and
  the transport carry `data-boot hidden` and appear when boot has filled them; a failed start
  leaves them hidden.
- **The words**: the walk line reads `0 m walked, at 999 m, 9 % grade, 4 h 33 min left`; the date
  slider is named `Date, day of year`; a whole hour prints `15 h`, and a duration's parts are joined
  by U+202F, so it never breaks across a line.
- **About and Layers** move focus to their Close on every open, as Global Weather's About does.
- **Nits taken**: the profile's `aria-valuemax` (the walk's length in meters); a notice sits at the
  plate's foot; a broken editable file read on return keeps the copy read before; the Layers mark
  is three irregular contour lines instead of nested rings; a 2 px gap under each slider row's note,
  because the face's glyphs stand taller than the note's line and took the slider's bottom pixel.
- **Nits declined**: per-frame layout reads and the Burn computed in the profile's pointer handler
  (the bytes are not there: 344 B under the cap; frames during play now come once per step; dragging
  the profile is on the phone list), and the credit line (owner call 8, as accepted).

## After the follow-up (2026-10-01)

One builder after the final review took the reviewer's two shoulds, the pipeline's text and colors
(owner calls 10 and 11) and this document's leftovers. Figures are the named tools' own output, or a
headless Chromium probe at phone size where a width is quoted: a trend, never phone evidence.

- **The profile's top label** (`js/profile.js`, `relayout()`): a meter label that would cross the
  strip's top edge now comes down inside it. The highest gridline, 1 900 m, sits 8 px under the
  top with no room above it, and its label was cut in half; it is whole at every width
  `tools/shoot.mjs` opens, which now checks every label the profile shows against all four edges.
- **The exaggeration's readout** says `True scale` at ×1.0, where `×1.0, true` read like a leaked
  boolean. The suggested `×1.0, true scale` widened the 64 px output to 78 px, so the slider's track
  would have jumped 14 px under the finger as the value left 1.0; `True scale` fits the 64 px.
  `shoot.mjs` reads the words and the slider's length at 1.0, 1.1 and 3.0 (141 px at each).
- **The data-owned colors** (owner call 10; section 2 has the figures): the 40° slope class is a
  crimson, `#8e1f4f`, no longer the trail's `#c0392b`; the middle elevation bands keep their hues
  and spread their lightness, `#908862` and `#b3a99a`. `tools/art/palette.py` now checks those pairs
  instead of reporting them, and models the 40° class over the 30° one as the shader does. Run on
  the old `colors.json`, it prints `LOW` on the collision and the bands and exits 1.
- **The words** (owner call 11): `tools/06_editable.py`'s prose is US English, and `about.json`'s
  five British spellings and five em dashes are gone (two new sentences, three colons).
  `tools/check.mjs` now fails if one returns, where it used to print the count.
- **The rebuild**: `tools/build_all.sh` with `OUT_DATA` in a scratch folder, twice. First with the
  scripts unchanged, from a cold cache: 367.4 MB downloaded in 40 files, plus the two N50 zips
  (36.7 MB), which the pipeline only checks for and which were ordered from the Geonorge download
  API by hand; 160 s. It reproduced 16 of the 17 shipped files byte for byte. The seventeenth,
  `places.geojson`, gained one name the register added after 22 September (Besstrond, a summer
  farm, stedsnummer 435855), so the shipped file was kept. Then with the swept script on the same
  cache, 8 s: only `about.json` and `colors.json` changed, in words and named colors, with the same
  keys and no number changed, and `tools/verify_data.py` passed. Those two files were copied into
  `data/`; the data's digest is now `97d6b944…2cd3`. `js/data.js`'s built-in copy of `colors.json`
  and the shader's defaults carry the new colors (same length, 0 bytes).
- **Left as they were**: the strings in `tools/06_editable.py` that become `waypoints.json`'s note
  (a British spelling of meters, `towards`, two em dashes) and `viewpoints.json`'s note (one em
  dash). The app shows neither, and sweeping them changes two more data files than this follow-up
  was given. With the cache warm, it is an 8 s rebuild.
- **Budgets** (`node tools/check.mjs`): app code 226 787 B of the 227 000 B cap, 213 to spare; fonts
  40 075 B; the ZIP 4.2 MB under its cap (`NOTES.md`'s budgets table has the bytes).
- **This document**: section 3's table now describes what was built: the Layers mark, the walk line,
  the marker named on a waypoint, notices at the plate's foot, play held while About or Layers is
  open, and a phone on its side. Section 5 records the camera guard as already in place. Sections 2,
  6 and 9 carry the new colors, the new digest, and calls 10 and 11 as settled.
