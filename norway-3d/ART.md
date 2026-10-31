# Norway in 3D: art direction

`NOTES.md` says what the app does and where every number comes from. This file says how it looks,
moves and speaks under the template's house system (`Template/HOUSE.md`). Every figure names the
command that printed it; the scripts are in `tools/`, which the ZIP leaves out. Frame and load
times are headless Chromium (SwiftShader) on the build Mac: a trend, never phone evidence.

---

## The look: the house, with one bold thing of its own

Norway in 3D takes the house chrome whole: one face, gray chrome, the caption band, the player and
the app's own track, focus mode, SI and the no-tells rules. What is its own is the plate and one
signature.

- **The plate keeps its daylight in both themes.** The plate is Kartverket's map (or the relief,
  or the elevation table) lit by the real sun for the hour shown. A dark-theme negative would turn
  the lit faces dark and drown the shadows, which are the data, so the plate is drawn one way in
  both themes and the chrome around it follows the phone. The sky behind the terrain is a gradient
  from the haze at the horizon up, colored by the sun's altitude: day, low sun, twilight, night.
- **One bold thing: the skyline** (section 1). Everything else on the chrome is quiet.
- **Honesty is the app's point**: the heights say which model they are read from (the 1 m laser
  model, at what spacing, or the 10 m model), the snow says it is modeled and by whom, steepness
  says it is not avalanche advice, and the skyline says it is terrain only.

**How it differs from the apps before it** (it copies none of them):

| | Global Weather | Besseggen | Milky Way | Norway in 3D |
| --- | --- | --- | --- | --- |
| Signature | the streak field on the plate | the Burn: the day's sun burned into the track where it reaches the marker | the Reach, a log ruler of distance | **the skyline: the terrain's horizon from the marker, unrolled along the sun's path, the sun's line over it** |
| What it encodes | the wind's path | direct sun at one point, by ink under the arc | presence | **the horizon's altitude in the sun's direction, minute by minute, and where the sun clears it** |
| Shape | streaks | an arch with bites out of it | a bar with gaps | **a mountain silhouette across the day, a thin arc over it, bold where the sun is out** |
| Its place | anywhere in the world, 2° grid | one fixed 20 km box | the sky | **anywhere in Norway the camera goes, from a 60 km horizon** |

The Burn and the skyline answer the same question, when the sun reaches a point, from opposite
sides: the Burn inks the sun's reach under its arc; the skyline draws what is in the way, the
mountains themselves, so a person sees which ridge takes the morning. Moved to Besseggen it would
need a horizon Besseggen's 53 km box cannot give; moved here the Burn would hide the very
silhouette this app's 60 km of streamed terrain makes.

---

## 1. The signature: the skyline

**What it is.** A solar site survey draws the horizon around a point and the sun's paths over it.
The skyline draws that horizon on the player's time track, unrolled along the day: for each
device-pixel column, the minute under it, the altitude of the terrain's horizon from the marker in
the direction the sun is at that minute, filled up from the level line in the signature's ink; and
the sun's apparent altitude at the same scale, a line over it. Where the sun's line stands above
the skyline, the marker is in direct sun, and the line is drawn bold; where a mountain stands in
front of the sun, the line goes under the ink. While the sun is below the horizon the skyline is
the same horizon, drawn faint, so the day stands out of the night.

**Drawn exactly so** (`js/track.js`):

- The track canvas is 58 px tall; the level line (0°) at y = 32, 2 px above the house's 1 px
  `--line-strong` baseline at y = 34; 0.55 px a degree, so a June noon at 58° N (55.5°) is 31 px
  and a 30° tick at the left end prints the scale. The scale is fixed and never stretched.
- The skyline: the horizon's altitude at the sun's azimuth, from 0° up, in `--sky` while the sun's
  apparent altitude is above 0, in `--sky-night` while it is not.
- The sun: its apparent altitude, a 2 px line in `--sky` where it clears the skyline, a 0.75 px
  `--ink-3` hairline where the terrain hides it.
- The graduation: a 3 px `--ink-3` tick under the baseline every hour, a 7 px `--ink-2` tick with a
  10.5 px label at 06:00, 12:00 and 18:00. The thumb is the house's tracer head, never gliding.
- The marker: a place tapped, a cabin or a name; else the middle of the view. It is drawn on the
  plate as a ring on a pale casing.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears*: the horizon is marched over the heights the app holds; with
   none held there is no skyline, only the sun's line.
2. *Every property that varies is measured*: the horizon's altitude (720 half-degree rays to 60 km,
   curvature and refraction, k = 0.13), the sun's apparent altitude (NOAA, with refraction), both at
   0.55 px a degree; length along the track is clock time.
3. *It is captioned*: `Skyline at Gjendebu: direct sun 07:35 to 18:45 (11 h 10 min).`, or `no
   direct sun on 16 Oct; the sun climbs to 19.5° and the terrain hides it.`, or `The sun stays
   below the horizon`, or `direct sun all day and all night (24 h)` in the midnight sun.
4. *It reads*: section 2's figures.
5. *It survives Reduce Motion*: it has no motion of its own.
6. *About says what it shows and what it does not*: terrain only, no cloud, the horizon to 60 km;
   not a forecast of sunshine.
7. *It is the only bold element* on the chrome.

## 2. Palette

`tools/art/palette.py` holds every value below and ends `ALL CHECKS PASS` (`python3
norway-3d/tools/art/palette.py`, from `Template/`); `tools/check.mjs` fails while the code's values
differ from its `--json`.

### The chrome tokens

The house tokens of HOUSE 3.1, exactly, in both themes. Measured by the same run: `--ink`, `--ink-2`
and `--ink-3` on `--page` 14.80, 6.61, 4.78 (light) and 14.43, 7.76, 5.88 (dark); on `--sheet` 16.40,
7.32, 5.29 and 12.87, 6.92, 5.25; `--line-strong` on `--page` 3.27 and 3.56; highest chroma 0.0239.

### The signature

| | Light | Dark |
| --- | --- | --- |
| Ground | the player's `--page` `#e8eef0` | `--page` `#141d21` |
| The skyline, `--sky` | `#13151a`, OKLCh (0.196, 0.011, 268): a cold near-black, beyond `--ink` (0.218) | `#f4efe6`, OKLCh (0.954, 0.013, 82): snow paper, beyond `--ink` (0.941) |
| On the page, on the sheet | 15.58, 17.26 | 14.94, 13.33 |
| The night skyline, `--sky-night` | `#b9c3c8`, 1.53 on the page (a faint context, on purpose) | `#3a474d`, 1.78 |
| The skyline against the night | 10.18 | 8.38 |
| The hidden sun's hairline (`--ink-3`) over the skyline | 3.26 | 2.54 |

It is close in color to Global Weather's streak and Besseggen's burn (ΔE 0.014 to 0.030, printed by
the palette script): the house's signatures are near-neutrals at the far end of the range, and
this one is a different mark in a different shape. Its hue is not a hue of any data color.

### The plate's marks, one style in both themes

| Mark | Value | Worst measured, over the map's land, forest, glacier, water and rock and the relief, lit from 0.45 to 1.15 |
| --- | --- | --- |
| Floating names | `#0f1c23` on a 3 px halo `#f6f9fa` at 0.88; heights `#45555d`; lakes `#1f5f8a` and glaciers `#3d5866` in italic | 14.49; 6.47; 5.73 and 6.30 (text, ≥ 4.5) |
| Cabins | the house glyph in `#0f1c23` on a `#f6f9fa` casing at 0.92 | 15.13 (mark, ≥ 3) |
| Ghost key | Besseggen's: a 1.4 px `#0f1c23` stroke on a 3.4 px halo at 0.60 | 10.57 (≥ 3) |
| Steepness | `#fff200`, `#f29a1f`, `#e0382d`, `#8a3d9e`, `#3a3a3a` at 0.72 over the ground | adjacent classes ΔE ≥ 0.10 in all four visions (lowest 0.138, yellow and orange); the yellow 0.11 from the bare relief |
| Snow key | `#f6f9fb` at 0.5, 0.78 and 1 over `#9aa7ae` | ΔE 0.071 and 0.055 between steps |
| Viewshed | seen: `#3fa7a0` at 0.5; hidden: veiled toward `#f6f9fa` at 0.4 (Besseggen's pair) | ΔE 0.110, worst over every ground and vision |
| Relief | ground `#c2bdb2`, water `#a9cfe0` | mid-tone, so white snow and the steepness classes stand on it |

The steepness colors follow Norway's avalanche-terrain maps (yellow to purple and black), so a
reader who knows those maps reads these; the yellow was lifted from the first build's `#f1dc3a`,
which stood 0.092 from the orange under deutan and 0.077 from the relief.

### Data colors the app does not own

Kartverket's map, Turrutebasen's trail colors (the key copies the service's legend:
`#00984a`, `#0063ff`, `#ed1c24`, black, `#ff7f7f`), seNorge's eight classes (read back into white,
never shown as blue), and the elevation tables (Crameri's batlow and oleron, viridis), which are
perceptually uniform by their makers' measure and are not refitted.

## 3. The chrome, object by object

The kind is HOUSE 4.0's *map with time and a 3D view*: the time is the sun's hours over one day.

| Object | Here |
| --- | --- |
| Header | `Norway in 3D` 15/650; the stamp under it is the streaming status, one line: `Loading 14 tiles…` or `Every tile in view has loaded.`; `About`, a framed text key at the right |
| Row of tabs and words | `Trails`, `Cabins`, `Sun`, `Names`, `Steepness`, `Snow` as words with the tracer; a divider; the tools `Viewshed` and `Profile` |
| Key column | `Zoom in`, `Zoom out`, `Show all of Norway` (four corner brackets around the country's outline) / `Map style and date` / `Hide the controls` |
| View switch | `2D` and `3D` (1.1): a radio group on one `--sheet` plate, 38 px tall with a 1 px `--line` edge and a 6 px radius, at the plate's foot, right, inset 8 px; 13.5/560 `--ink-2`, the chosen one 650 `--ink` on a 12 % ink fill; each a 46 × 44 hit. It stays in focus mode; the low card and a notice stand above it |
| Caption band | north and the scale bar with where it is true; the keys of the layers that are on (trails, cabins, steepness, the elevation bar, snow, the viewshed), the snow line slider, the caption line (the skyline's sentence, or a tool's instruction), and the credits beside the map that §4.15 allows: OpenStreetMap's while names or cabins are shown, seNorge's while its snow is |
| Player | the valid time `16 Oct, 16:50` with `CEST`, the lead `Sun 7.8° up, SW (235°)`; the day keys, Play, and the track with the skyline |
| Card | a cabin, a name, a tapped point, a viewshed or a profile; the one figure is the height (or the area seen, or the length) |
| About | not a navigation tool; what the picture is; this data; sources and credits, the credit line first; how the data gets here |
| Focus mode | the header, the key column and the keys leave; the plate, the view switch, the instrument line, the caption, the credits and the player stay; the ghost key `Show the controls` |

## 4. Type

The house file, byte for byte (`fonts/ysabeau-office-gw.woff2`, sha256 `fdf1a28c…cdb262`, and
`fonts/OFL.txt`, `d1adfffd…be6269`), pinned by `tools/check.mjs`. The floating names are 11.5/560
over a 3 px halo, cities and towns 12.5/620, heights 10.5/400, lakes and glaciers in the face's
italic. Credit line, word for word (About, `NOTES.md`, `CREDITS.txt`): `Ysabeau Office by Christian
Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.`

## 5. Budgets

`node tools/check.mjs` prints them: app code 224 459 B (the cap here is 300 000 B: this app is a
streaming engine, a decoder, five layers and two tools in one; the house's 200 000 B was set for
apps without an engine of their own, and the lead rules on it), fonts 40 075 B, data 3 323 627 B,
the ZIP about 1.1 MB (the brief's cap is 60 MB).

## 6. The generated-page tells, answered

| Tell | Norway in 3D |
| --- | --- |
| 1. Warm cream, serif display, terracotta | The house film base; one Renaissance sans; no accent: warm hues are data (the map, the steepness classes) |
| 2. Near-black with one acid accent | The dark page is the house slate; the plate stays daylight |
| 3. Broadsheet hairlines | One column; hairlines only between About's sections, the key plates and the bands |
| 4. SaaS cards | One card (the tapped thing), no shadows, no glass; the only gradients are data scales, the sky and the tracer |
| 5. All-caps eyebrows | None; sentence case, letter-spacing 0 |
| 6. Middle dots | None but none needed: commas and sentences |
| 7. Spaced em dash labels | None |
| 8. A tinted near-black for black | The skyline's `#13151a` is a stated ink, measured |
| 9. Monospace labels | None |
| 10. Arrows on buttons | None; `check.mjs` fails on one |
| 11. One accented word | None |
| 12. Labels above content | The keys name their quantity; nothing else is labeled from above |
| 13. Numbered markers | None |
| 14. Big number, small label, gradient | One large figure, the valid time; the card's height |
| 15. Fade-and-slide entrances | None; the one continuous motion is the light moving over the mountains |
