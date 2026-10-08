# Snug Kart: art direction

`NOTES.md` says what the game does and how it is built; `DESIGN.md` is the design it was built
from. This file says how it looks, moves and speaks under the template's house system
(`Template/HOUSE.md`, the brief; Global Weather is the reference, and Milky Way, Besseggen, Norne
Reservoir, Anatomy, Shelf Atlas and World Oil & Gas took it before this one). It holds the look, its
rules and its measured figures, corrected in place to what was built. The change list, the owner
calls, the bugs B1 to B15 this file cites and the record of the pass are in `tools/DECISIONS.md`,
which does not ship (HOUSE.md, "What ships and what does not").

**Measured on 2026-10-02** on the working tree, as built. Every figure names the command that
printed it; the commands run from `Template/snug-kart/` unless they say `Template/`, and their
scripts are in `tools/`, which the ZIP leaves out: `node tools/check.mjs` (static),
`node tools/sim.mjs` and `node tools/items.mjs` (the race and the items in Node),
`node tools/art/measure_lapchart.mjs` (what a lap chart of these races holds),
`python3 snug-kart/tools/art/palette.py` (from `Template/`: every color and contrast) and
`PLAYWRIGHT_MODULE=… node tools/shoot.mjs` (the game driven). Rendered pixels and times from
headless Chromium (SwiftShader on the build Mac) are a trend, never phone evidence.

---

## The look: the house, with one bold thing of its own

Snug Kart is HOUSE 4.0's *game*: racers and tracks as words, no key column, no player, no readout
card in the house's sense, no focus mode (the race is already the view), and the credits in About.
It takes the rest of the house whole: one face, the house chrome on a white ground in the light
theme (HOUSE 12, plan 0012 D6), the tracer under what is chosen, the
caption band, notices on plates, About, SI and the no-tells rules. What is its own is the scene,
which keeps each track's one appearance in both themes, and one signature.

- **The scene keeps its colors in both themes.** A race has one appearance, as Anatomy's body and
  Earth's History's night do (HOUSE 3.2): Harbour Loop's noon, Pinewood Pass's dusk and Lantern
  Night's night are drawn from `data/tracks.json`'s palettes exactly as today, in the light theme
  and the dark one alike. Only the chrome follows the theme. The game's world keeps its palette:
  karts, faces, parcels, the item art, the drift sparks' gold and mint.
- **One bold thing: the Lap Chart** (section 1), the race kept the way race officials keep it, one
  line per racer through the order at every timing line, drawn from the race just run, with your own
  line in ink. Everything else is quiet.
- **Honesty is about what the race is.** Every place, time and line comes from the race the code
  simulated from the two data files. A time the race did not measure (a rival still out when you
  skip the wait) is printed as the estimate it is, to the second and after the word *about*.

**How it differs from the apps before it** (it copies none of them):

| | Signature | Axis | What it encodes | Where | Shape |
| --- | --- | --- | --- | --- | --- |
| Global Weather, Global Wind | the streak field | the map | the wind's path | on the plate | streaks |
| Earth's History | the stratigraphic column | time (Ma) | period colors | the time track | a banded column |
| US Quakes | the record strip | time (days) | magnitude by stem height | the time track | stems |
| Warming World | the stripes as an instrument | time (years) | anomaly by color | the scrubber | stripes |
| Milky Way | the Reach | distance from the Sun | presence | under the header | a log ruler with gaps |
| Besseggen | the Burn | the hours of one day | the sun's altitude, direct sun | the time track | one arch with bites |
| Norne Reservoir | the Cut | the production history | liquid per day, oil and water | the time track | a two-tone skyline |
| Anatomy | the Levels | height in the body | the selection's span in levels | the plate's left edge | a column of blocks |
| Shelf Atlas | the Peaks | the map | each field's best month so far | around the discs | rings |
| World Oil & Gas | the Ledger | the world's output in one year | each country's share | a strip under the plate | one strip of blocks |
| **Snug Kart** | **the Lap Chart** | **race distance, in timing lines** | **each racer's place at each line** | **the results sheet, and your own line in the race card** | **eight lines that cross where places change** |

It is the only signature in the template that is a record of something the person just did. The
others print data that existed before the app opened; this one is written by the race, and differs
every race.

---

## 1. The signature: the Lap Chart

**What it is, in one paragraph a stranger would get.** Before timing screens, every race had a lap
scorer: a person at the line with a sheet of squared paper who wrote down, each time the field came
past, the order the cars crossed in. Joined up, those columns of numbers became a *lap chart*: one
line per driver, running left to right through the race, crossing another line wherever one passed
the other. Snug Kart keeps that sheet for every race. There are ten timing lines on every lap, one at
each tenth of the way round, so thirty in a race, and at each the chart notes the place every racer
crossed it in. When the race ends, the results open on it: eight lines from the grid on the left to
the finish on the right, first place at the top, each named at its end, the seven rivals in their
karts' colors and yours in ink on a clean edge of paper, so it can be followed through every crossing.
During the race the card under your place draws your own line as it is written, the head of it
moving right as you go round, so a glance says how far through the race you are and whether you have
been climbing or falling.

**What a stranger remembers is that it tells the race back to them.** The place they started (5th,
always: the grid puts the player in the third row), the first lap's scramble where the lines tangle,
the long stretch where theirs ran flat, the pass on the last lap that lifted it one row, and the
rival whose dotted end says the race was cut short and their time is a guess. Measured over 15 races
(3 tracks × 5 seeds at Standard pace, items on, the player's kart driven by the even AI;
`node tools/art/measure_lapchart.mjs`): the order changes 49.3 times a race, and 38.5 of those land
in the chart as crossings at ten lines a lap; the player's place changes 14.1 times a race, and the
chart sees 8.1 of them (the rest are a pass and a pass back inside one tenth of a lap). With the wait
skipped two seconds after the player's finish, 12 racers in 15 races finish on a projected time.

**How it was found** (HOUSE 5.1):

1. *What does a specialist call the picture of this data?* A race's own documents are the timing
   sheet (every lap time, which the results list already is), the circuit map, the telemetry trace
   and the lap chart. The lap chart is the one that shows the race rather than the clock: who passed
   whom, and when.
2. *What does a person do most here?* Race, then read the results, then race again. The chart sits
   at the hinge between two races, the moment a person looks back, and its live half rides in the
   race card where the eyes already go for the place.
3. *What does this data have that no other app has?* Competitors and an order that changes. Eight
   racers from `data/racers.json` on a track from `data/tracks.json`, simulated at 120 steps a second.
   No other app in the template has a contest, and the chart moved to any of them would have nothing
   to draw. Set aside, with what they would have said:
   - *The circuit's plan and elevation profile on the title*: true and drawn from the data, but
     Harbour Loop's highest point is 4.1 m above its lowest (4.148 m from `js/track.js`'s validation;
     `node tools/check.mjs` prints `-0.1…4.1 m`),
     so for one track in three the profile is a flat line, and the track map already draws the plan.
   - *A speed trace* (speed against distance, the telemetry engineer's picture): honest, but it needs
     a sample per meter of every lap and a reader who reads telemetry; a phone game's results are not
     the place.
   - *A timing tower* (the broadcast column of gaps): every racing game and broadcast has one; it
     could move to any racing app unchanged.
   - *The track map as the signature*: the same objection, and it is a map of the track, not of the
     race.
4. *Can it be drawn with the house's means?* Yes: lines in the racers' fitted tones (section 2), one
   ink line on a casing of the sheet's own ground, the house face at 10.5 px for its labels, and no
   motion but the head of your line moving with you.

**The rule it is drawn by** (the builder implements exactly this; `tools/test_chart.mjs` proves it):

- **Recording** (`js/race.js`, pure). Every kart carries `gates`, a list of places. It starts as
  `[gridSlot + 1]`, the grid. After the places are updated in each step, for each kart not yet
  projected, `g = floor(max(0, dist) / (L / 10))`, capped at 30, and while `gates.length <= g`,
  `gates.push(place)`. The kart that crosses the line for the third time gets its finishing place
  in column 30. Nothing else in the race changes: the sim's output is identical before and after
  (`node tools/sim.mjs standard 3`, compared with the baseline in
  `tools/.work/sim-baseline-standard-3.txt` except the `in N ms` timings).
- **The results chart** (`js/chart.js`, a 2D canvas at the device pixel ratio on the results sheet).
  x: the timing line, 0 (the grid) to 30 (the finish), evenly spaced. y: the place, 1 at the top, 8
  at the bottom, evenly spaced. Each racer is a polyline through its recorded columns. Rivals:
  1.5 px in their tone (section 2), round joins, drawn first, in finishing order from last to first.
  The player: a 6 px stroke of `--sheet` (the casing), then a 2 px stroke of `--ink`, drawn last,
  with a 5 px `--ink` disc at the finish. A projected racer's line ends at its last recorded column,
  and a dotted segment (1.5 px, 2 px on and 3 px off, in its tone) joins it to its final place in
  column 30. Labels, 10.5 px in the house face: at the left, the places `1` and `8` in `--ink-3`; at
  the right, each racer's first name at its final row, `--ink-2` at 400, the player's in `--ink` at
  620; under the plot, `Grid`, `Lap 2`, `Lap 3` and `Finish` at columns 0, 10, 20 and 30 in
  `--ink-2`, with a 7 px `--ink-2` tick at 10 and 20 and 3 px `--ink-3` ticks at 50 % for the other
  timing lines. No grid lines, no frame, no fill. Plot height 8 rows × 16 px; the canvas is about
  152 px tall with its labels.
- **The race card's strip** (`js/chart.js`, a 2D canvas inside the race card, about 132 × 24 px).
  Only your line, 1.5 px `--ink` on the card's `--sheet`, x from 0 to 30 across the strip, y from
  place 1 to 8, with the head (a 5 px `--ink` disc) at your current distance, `dist / (L / 10)`, and
  your current place. Lap ticks: 3 px `--ink-3` at 50 % under columns 10 and 20. It is drawn only when
  the head's pixel or your place changes, never once per frame for nothing (HOUSE 4.6): about 150
  redraws a race (132 pixel steps and about 14 changes of place).
- **The caption** under the results chart, 11 px `--ink-2`, two fixed lines: `Places at every tenth
  of a lap, from the grid to the line. Your line is ink; a dotted end is a projected finish.`
- **The test hook**: `window.__sk.chart()` returns `{ gates: {id: [...]}, projected: [ids],
  points: {id: [[x, y], …]} }`, the drawn points in CSS px of the results canvas, so `shoot.mjs` can
  check the drawing against its own formula and sample the ink's pixels.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears.* No race, no chart: the results chart draws only `gates` the
   race recorded, the strip only the player's. Without `data/tracks.json` or `data/racers.json` there
   is no race at all, only the sentence that names the file. Nothing is seeded, animated or drawn
   ahead of the race.
2. *Every property that varies is measured.* x is the timing line (a fixed, printed division of the
   race), y is the place (a rank, monotone), the color is the racer's identity from the data (fitted
   in lightness only), the ink is you. Line widths are constant. Projected ends are dotted, which is
   what makes an estimate look different from a measurement.
3. *It is captioned.* The caption above, on screen under the chart; `Grid`, `Lap 2`, `Lap 3` and
   `Finish` under it; About's first section in full. The race card's strip has no caption of its own:
   it sits under `5th of 8` and `Lap 2 of 3`, which say what its y and x are, and the results caption
   it in full a minute later.
4. *It reads.* The ink on its casing is ink on `--sheet`: 16.40:1 in the light theme, 12.87:1 in the
   dark (`python3 snug-kart/tools/art/palette.py`, check 4), against a target of 3.0:1 for a mark.
   Without the casing it would fall to 1.74:1 over Ines's charcoal (light) and 1.30:1 over Wren's gold
   (dark), which is why the casing is there. `shoot.mjs` samples it on rendered pixels (its results scene).
5. *It survives Reduce Motion.* It has no motion. The strip's head moves only because you do.
6. *About says what it shows and what it does not*: a pass and a pass back between two timing lines
   leaves no mark; the straight segment between two lines is not where a pass happened; a dotted end
   is an estimate (About's text is in section 3).
7. *It is the only bold element.* On the results sheet it is the only drawing; in the race the card
   is a quiet plate and the bold thing is the race itself, which is the plate.

---

## 2. Palette

Every figure here is printed by `python3 snug-kart/tools/art/palette.py` (from `Template/`), which
reads `data/racers.json` and `data/tracks.json` rather than retyping them and ends `ALL CHECKS PASS`
(exit 0, run 2026-10-02). `--json` prints the racers' fitted tones in the shape `js/palette.js` takes.

### The chrome tokens

The house's, copied as they are, in both themes (HOUSE 3.1; Global Weather's `style.css` lines
17-43), with `--draw`, `--sheet-in` and `--face`. No `--outside`: the scene is the plate. The app
adds no token of its own to `:root`; its data colors live in `js/palette.js`, and the respawn fade's
color is the scene's (below).

| Token | Light | Dark | On `--page` | On `--sheet` |
| --- | --- | --- | --: | --: |
| `--ink` | `#0f1c23` | `#e6edee` | 17.35 / 14.43 | 16.40 / 12.87 |
| `--ink-2` | `#45555d` | `#a3b1b6` | 7.75 / 7.76 | 7.32 / 6.92 |
| `--ink-3` | `#5b6a72` | `#8b9a9f` | 5.60 / 5.88 | 5.29 / 5.25 |
| `--line-strong` | `#74858c` | `#64757b` | 3.83 / 3.56 | 3.62 / 3.18 |

`--page` is `#ffffff` in the light theme, every other token the house's (HOUSE 12).

The on-plate (`--ink` at 12 % over `--sheet`: `#dadee0` / `#343f43`) carries the player's row in the
results and a key that is on: `--ink` on it 12.81 / 9.14, `--ink-2` 5.72 / 4.91. A `--page` word on an
`--ink` key (Race, Resume, Race again, a charged Drift): 17.35 / 14.43. The highest chroma of any
chrome token: 0.0239 (light), 0.0223 (dark).

### The tonal budget

| | Light (white) | Dark (the print) |
| --- | --- | --- |
| Ground | `--sheet` `#f6f9fa` (L 0.980) under the chart, the race card, the track map and the keys; `--page` `#ffffff` (L 1.000) under the title's rings | `--sheet` `#1c272c` (L 0.265); `--page` `#141d21` (L 0.224) |
| Data band (the racers' tones) | L 0.380–0.620 | L 0.620–0.860 |
| Signature | your line, `--ink` `#0f1c23` (L 0.218, C 0.0228), opaque, on a 6 px `--sheet` casing | `--ink` `#e6edee` (L 0.941, C 0.0076), opaque, on its casing |
| Worst measured case | ink on its casing 16.40; the lowest tone on its ground 3.47 (Wren on `--sheet`) | ink on its casing 12.87; the lowest tone 4.22 (Ines on `--sheet`) |

The band sits below the grounds in the light theme and above them in the dark, and the ink keeps the
far end of the range in both (check 4: L 0.218 under 0.380; L 0.941 over 0.860).

### The scene

Unchanged, in both themes: each track's `palette` in `data/tracks.json` (sky, fog, asphalt, verge,
ground, walls, water, houses, pines, lanterns), lit as today. Lantern Night is night in the light
theme too. This is the HOUSE 3.2 road for a subject with one true appearance, chosen over a negative
because a race is a place in daylight or at night, and printing it as a negative would make every
kart's paint a different color from its face's ring and its line. Lighting moves the rendered colors,
so the base colors are what the palette script checks and `shoot.mjs` samples rendered frames.

The respawn fade (0.15 s, a scene cut; `#000` in the stock game) is `#141d21`, the dark page, in both
themes: a cut through the dark, not a black stand-in in the chrome, and under Reduce Motion no fade
at all.

### The racers' tones

The eight body colors in `data/racers.json` paint the karts in the scene unchanged. Where the chrome
draws a racer (its line in the Lap Chart, its dot on the track map, the 2 px ring around its face on
the title and in the results), it uses the racer's *tone*: the same OKLCh hue and, where sRGB allows,
the same chroma, at a lightness fitted into the theme's band.

| Racer | Data | Light tone | L | On `--page` / `--sheet` | Dark tone | L | On `--page` / `--sheet` |
| --- | --- | --- | --: | --: | --- | --: | --: |
| Ines | `#3A3F47` | `#3e434b` | 0.381 | 9.96 / 9.41 | `#818790` | 0.621 | 4.73 / 4.22 |
| Otto | `#7D3C98` | `#692883` | 0.414 | 9.41 / 8.89 | `#b370d0` | 0.654 | 5.01 / 4.47 |
| Pip | `#F28C28` | `#7f4302` | 0.448 | 7.76 / 7.33 | `#e27d0a` | 0.688 | 5.84 / 5.21 |
| Soren | `#4A6FA5` | `#3b5f94` | 0.484 | 6.46 / 6.11 | `#80a7e1` | 0.722 | 6.95 / 6.20 |
| Tuck | `#5B8C3A` | `#477724` | 0.517 | 5.34 / 5.05 | `#8ec26e` | 0.758 | 8.22 / 7.33 |
| Mabel | `#E0607E` | `#bb3e60` | 0.550 | 5.29 / 5.00 | `#ff98ac` | 0.792 | 8.42 / 7.51 |
| Juno | `#17A3A0` | `#088e8c` | 0.585 | 3.99 / 3.77 | `#65dcd8` | 0.825 | 10.41 / 9.29 |
| Wren | `#D9A21B` | `#ab7e09` | 0.621 | 3.67 / 3.47 | `#ffc854` | 0.861 | 11.11 / 9.91 |

Every tone stands at 3:1 or more on both grounds, the target for a mark (check 2). The tones are
marks, never text: a racer's name is always `--ink-2` or `--ink`.

**The categories** (check 3). Every pair of the 28 is at least ΔE 0.10 apart (OKLab) under normal
vision: the closest is Soren and Ines, 0.130 (light) and 0.129 (dark). Under simulated color-vision
deficiency (Machado, Oliveira and Fernandes 2009, severity 1.0) some pairs come closer: light,
deutan 5 pairs (closest Mabel and Tuck, 0.063), protan 3 (Wren and Tuck, 0.063), tritan 4 (Soren and
Tuck, 0.057); dark, deutan 5 (Juno and Mabel, 0.062), protan 2 (Wren and Tuck, 0.071), tritan 4
(Soren and Tuck, 0.062). Eight is more than five categories, so identity never rests on color (HOUSE
3.3): every line in the chart is named at its end, every row in the results is named, and the track
map's dots are the one place where color alone tells two rivals apart, which is why it is a map and
not a reading (your own dot is the tracer head, never a color).

**What was given up, plainly.** The lightness steps are the data's order at the ends (Ines's
charcoal the darkest, Wren's gold the lightest) and spread in between so that every pair stands
apart. The data's own orange and gold are only ΔE 0.067 apart (Pip `#F28C28`, Wren `#D9A21B`; the
script prints it), and a straight map of their lightness put them at 0.057, so **Pip's orange is
printed darker than its kart**: a rust `#7f4302` in the light theme, a full orange `#e27d0a` in the
dark. The step order (`ines 0, otto 1, pip 2, soren 3, tuck 4, mabel 5, juno 6, wren 7`) was found by
trying all 5 040 orders with Wren held at the top and keeping the one with the widest normal-vision
gap (0.129 against 0.117 for the next band tried); the script states it and its reason. A racer the
table does not name (someone's edited `racers.json`) is placed by its own lightness.

**When the data is edited.** `js/palette.js` holds the pasted `--json` output: the tones per theme
and, under `from`, the body color each was fitted from. `tone(racer, theme)` returns the fitted tone
while the racer's color in the loaded `racers.json` still equals `from`, and the data's own color
otherwise, so an edited racer is drawn in the color its file gives it, never in a stale tone.
`tools/check.mjs` fails while `js/palette.js` and `--json` differ.

### The track map, the keys and the marks over the scene

- **The track map** is a `--sheet` plate. The road: 4 px `--line-strong` (3.62 / 3.18 on the plate),
  each segment drawn in order of height over an 8 px `--sheet` casing with square-cut (butt) ends, so
  no segment's casing covers its neighbor's road, and Lantern Night's bridge
  reads over its underpass by a gap, as a cartographer draws it. The start: a 2 px `--ink-2` tick
  across the road. Rivals: 6 px discs in their tones on a 1 px `--sheet` ring (lowest 3.47, Wren,
  light; 4.22, Ines, dark). You: the tracer head, an 8 px `--ink` disc in a 3 px `--sheet` ring,
  drawn last (16.40 / 12.87).
- **Marks drawn straight over the scene** (the lock-on reticle, the steering ring): the house ghost
  key's recipe, a 1.5 px stroke over a 3.4 px halo (light: `#0f1c23` over `rgb(246,249,250)` at
  60 %; dark: `#f2f4f1` over `rgb(10,16,19)` at 45 %). Over all 43 base colors in the three tracks'
  palettes the stroke holds 6.41:1 against its halo at worst in the light theme (over Lantern
  Night's sky, `#0E1433`) and 3.02:1 in the dark (over Pinewood Pass's snow, `#F2F4F5`), against a
  target of 3 (check 6). The dark figure is the thinnest margin in this palette; `shoot.mjs`
  samples it on rendered frames on Pinewood Pass.
- **Everything else over the scene sits on a plate** (`--sheet`, a 1 px edge): the race card, the
  track map, the Pause, Drift and Item keys, the countdown, the banners, the hint and the warning.
  No text is held up by a shadow.

---

## 3. The chrome, object by object

HOUSE 4.0's row for a game: racers and tracks as words; no key column; credits in About; no player;
no readout card; no focus mode. Every kind carries the header, About, notices and the live region,
the motion rules, landscape and safe areas. Here is what each becomes.

### The frames

The title, at 390 × 844 (heights in CSS px; safe-area insets outside them):

```
┌──────────────────────────────────────────┐
│ Snug Kart  About                         │ 22  the name 15/650; About, a text key after it
│ Harbour Loop  Pinewood Pass  Lantern Night│ 44  the tracks as words; the tracer under the chosen
├──────────────────────────────────────────┤
│                                          │
│   the plate: the chosen track, rendered  │     the title camera's glide (still under
│   edge to edge, the camera's view        │     Reduce Motion), 501 px tall
│   centered in it                         │
│                                          │
├──────────────────────────────────────────┤
│ The track's blurb. 1 028 m a lap,        │ 30  the caption line, 11 px, two fixed lines
│ rising 4.1 m.                            │
│ (◯)(◯)(◯)(◯)(◯)(◯)(◯)(◯)                 │ 52  the racers: eight faces; the tracer under the chosen
│ Pip Marlow                               │ 46  the name 12.5/620; the line 11 px, two fixed lines
│ A bike courier who has never once …      │
│ Sound  Tilt  Quality high  Controls pad  Pace standard │ 44 the settings as words (scrolls inside itself)
│ The note after a tap, two fixed lines    │ 30
├──────────────────────────────────────────┤
│ Best lap 0:36.527   best race …   [Race] │ 52  the record; Race, the one solid key
└──────────────────────────────────────────┘
```

The race (the scene full screen; plates over it):

```
┌──────────────────────────────────────────┐
│ ┌───────────────┐   [ ‖ ]     (Snuggery's│     the race card top left; Pause top center;
│ │ 5th of 8      │              exit)     │     the top-right corner left to Snuggery
│ │ Lap 2 of 3 1:02.415│        ┌────────┐ │
│ │ Last lap 0:36.527  │        │ track  │ │     the track map, 56 px below the top margin
│ │ ╱╲__╱‾‾●      │             │  map   │ │
│ └───────────────┘             └────────┘ │
│          [ notice: Final lap ]           │     notices on plates, centered
│                                          │
│                the race                  │
│                                ┌──────┐  │
│   (steering ring where the     │ Item │  │     76 px key plate
│    thumb lands)                └──────┘  │
│                               ┌───────┐  │
│                               │ Drift │  │     88 px key plate
│                               └───────┘  │
└──────────────────────────────────────────┘
```

The results: a `--sheet` panel over the finish camera's view, 8 px radius, a 1 px `--line-strong`
edge, at most 420 px wide, inset 8 px inside the safe area, scrolling inside itself:

```
│ Harbour Loop                             │ 22  the track, 15/650
│ 5th  of 8 in 1:52.985                    │ 28  the one large figure 21/600; the lead 12.5 --ink-2
│ [ the Lap Chart, about 152 px ]          │
│ Places at every tenth of a lap, from the │ 30  the caption, 11 px, two fixed lines
│ grid to the line. Your line is ink; …    │
│ 1 (◯) Ines Carvo         1:49.737        │ 36  eight rows; the player's on the on-plate
│                     best lap 0:36.534    │
│ …                                        │
│ New best lap on Harbour Loop.            │ 20  a sentence, only when a record fell
│ [ Race again ]   Change track or racer   │ 44  the solid key; a framed text key
```

### Object by object

- **The frame.** `body` is `--page`. On the title the canvas stays full screen behind opaque bands
  (header at the top, the bands at the bottom) and the camera's view is centered in the plate
  between them with `camera.setViewOffset`, cleared for the race, so the title camera aims at the
  middle of what shows. No rule under the header; the bottom band's record row has a 1 px `--line`
  rule on top, as the house player has. Gutters 16 px plus the safe-area inset. The page never
  scrolls sideways at 320 px or at 125 % text zoom; the title's bands scroll inside themselves when
  the screen is short (the plate is 501 px tall at 390 × 844, as `shoot.mjs`'s look-title prints,
  and keeps 272 px at 375 × 667, as its widths scene measures).
- **The header** (title only; the race, pause and results have none): the name, `<h1
  translate="no">Snug Kart</h1>`, 15 px, 650, 22 px line. No stamp: nothing in a game is dated
  (HOUSE 4.2, *No data to date*). About opens from a text key named `About` right after the name,
  12.5 px, 44 px tall, `aria-haspopup="dialog"`: not at the header's right, where HOUSE 4.2 puts a
  game's About, because in full screen on iOS 18 Snuggery's 44 pt exit control sits 16 pt inside the
  top-right corner (`NOTES.md` decision 36) and would cover half the key; the app's measured
  constraint wins over the house's placement. For the same reason the track words stop 52 px short
  of the right edge (the row scrolls inside itself sooner). `tools/shoot.mjs` checks both at every
  width. No units key: nothing converts (lengths are meters, times are times).
- **The row of words: the tracks.** `Harbour Loop`, `Pinewood Pass`, `Lantern Night`, from the data's
  names, in a `role="radiogroup"` named `Track`, each a `<button role="radio" aria-checked>`, 12.5 px,
  `--ink-2` at 400, the chosen one `--ink` at 620 with the house tracer under it (a 2 px line as wide
  as the word plus 4 px, transparent to `--ink`, ending in a 4 px disc; drawn in over 160 ms on
  `--draw` by `clip-path`). The row scrolls inside itself on a narrow screen. A sideways swipe on the
  plate still changes track, as the card's swipe did. The ‹ › keys and the track card go.
- **The racers.** A second choice, so a second group: `role="radiogroup"` named `Racer`, eight
  `role="radio"` buttons, each the racer's painted face (the game's own art, from `racers.json`'s
  skin, hair, style and expression) at 36 px in a 2 px ring of its tone, a 44 × 52 button,
  accessible name the full name. Eight across from 384 px of width (eight 44 px hits inside the
  16 px gutters); two rows of four below it, and in the column on a phone on its side. The chosen
  face has the tracer under it. Below the row, the chosen racer's full name (12.5 px, `--ink`, 620)
  and its line from the data, as written, 11 px `--ink-2`, two fixed lines: no separator between
  them, so no em dash.
- **The key column: none** (HOUSE 4.0). The game's controls in the race (below) are a controller,
  not a column of view keys.
- **The caption band.** On the title: the track's caption line, 11 px `--ink-2`, fixed at two lines:
  the data's blurb, then the track's length and rise from the loaded data (`t.L`,
  `t.validation.maxY − minY`), through `js/units.js`: `Flat and friendly, with one tight gate. 1 028 m
  a lap, rising 4.1 m.` (U+202F before each unit; Pinewood Pass `1 268 m a lap, rising 26.6 m.`,
  Lantern Night `1 315 m a lap, rising 9.1 m.`). On the results: the chart's caption (section 1).
  The credits live in About (HOUSE 4.5, *A game*).
- **The player: none, and what stands in its place.** There is no time to scrub. The bottom band of
  the title is built like the house player's time row: at the left the record, the one large figure,
  `Best lap` (12.5 px `--ink-2`) and the best lap (21 px, 600, tabular), and after it the lead,
  `best race 1:52.985, as Pip` (12.5 px `--ink-2`; the racer you drove when you set it, stored with
  the record; *as*, so it never reads as if a rival holds it); or `No best lap on this track yet.`
  in 12.5 px `--ink-2` when there is none. VoiceOver hears the row in words, `Best lap 36.527
  seconds, best race 1 minute 52.985 seconds, as Pip`: the drawn figures are `aria-hidden`, with a
  visually hidden twin after them. At the right, **`Race`, the one solid key in the app, the shutter
  release**: `--ink` with the word in `--page`, 15 px at 650, 44 px tall, at least 112 px wide, 8 px
  radius. Its text stays exactly `Race`: the marketing camera waits for it and taps it (section 5).
  The settings sit above it as words: `Sound` and `Tilt` are toggles (`aria-pressed`, the word in
  `--ink` at 620 with the tracer under it when on, `--ink-2` at 400 when off, the accessible name
  always the word); `Quality high`, `Controls pad` and `Pace standard` cycle, the setting's name in
  `--ink-2` and its value in `--ink` at 600, the accessible name the visible words. Under them the
  note the old chips wrote after a tap (`Uses your phone’s volume. …`, `Tilt isn’t available here.`,
  the Controls sentences), 11 px `--ink-2`, two fixed lines, so the band never jumps.
- **The readout card: the race card.** HOUSE 4.7's one card, holding the subject: your race. Top
  left at the safe margins, `--sheet`, a 1 px `--line-strong` edge, 8 px radius, 10 px padding, no
  shadow. Line one: `5th` at 21 px, 600 (the race's one large figure) and ` of 8` at 13.5 px
  `--ink-2`. Line two: `Lap 2 of 3` (12.5 px `--ink-2`) and the race time right-aligned (12.5 px,
  560, `--ink`, tabular; still the five-tap target for the diagnostics). Line three, reserved from
  the start so the card never resizes: `Last lap 0:36.527` (12.5 px `--ink-2`). VoiceOver hears both
  times in words, `Lap 2 of 3, 1 minute 2.415 seconds` and `Last lap 36.527 seconds`, the same way.
  Then the strip (section 1). Its text is set only when it changes, at most 30 times a second, as
  today.
- **About** (section below), opened from the title's header.
- **Notices and the live region.** Every sentence over the scene is a notice plate: `--sheet`, a 1 px
  `--line-strong` edge, 8 px radius, centered, at most 300 px wide, no icon, no colored bar, no
  transition in or out. The banners, at 15 px 650 in `--ink`, at the countdown's top (below): `Lap 2`, `Final
  lap`, `Wrong way`, `Finished 3rd of 8`, `Hit by a paper plane`, `Caught in a yarn snare`, `Stuck in
  honey`, for the times they have today. The first races' hint under the countdown's plate, 8 px below it (on its side
  too, clear of Pause), 13.5 px, one line on a 320 px phone, its words unchanged. The warning, `Paper plane behind you`, 13.5 px 600, under the race card at the left (a centered plate would cover the card on a phone under
  390 px wide), steady
  while a plane is aimed at you. The loading line, `Building the karts and the tracks…`, and a data
  problem as the file's own sentence (`data/tracks.json is not valid JSON. Check for a missing comma
  or bracket.`), `role="alert"`. `Building the track…` and `Graphics were reset. Tap to continue.`
  the same way. One polite live region (`<p class="sr" aria-live="polite">`) says, once each: the
  countdown's `Go`; at each new lap `Lap 2 of 3, 5th of 8.`; at the finish `Finished 3rd of 8 in 1
  minute 52.985 seconds.`; each hit's banner sentence; as the results appear, `Results: 3rd of 8.
  Race again or change track.`; and a setting's note when a tap writes one (`Tilt isn’t available
  here.`, the Sound and Controls sentences), so a refused press is heard. The place stops being a live
  region (B6).
- **Focus mode: none.** The race fills the screen with the controller; the title's plate is a
  preview, not a view to study.
- **The opening: none.** The loading line, then the title with its camera already gliding.
- **The controller** (the game's own objects over the race, kept at the sizes `NOTES.md` decision 31
  measured on the design: they are thumb targets, not chrome keys):
  - *Drift*: an 88 × 88 key plate, `--sheet`, a 1 px `--line-strong` edge, 8 px radius (a key's
    shape, not a game's round button), the word `Drift` at 13.5 px 600 `--ink`, the 14 px of extra
    hit around it kept. Held: the on-plate at 22 %. The drift's charge (a button turning gold then
    mint in the stock game) is said by the key in ink: at the first tier (0.8 s of drift,
    `PHYS.tier1`) its edge becomes 3 px `--ink`; at the second (1.7 s, `PHYS.tier2`) the key fills
    with `--ink` and the word turns `--page`. The sparks in the scene keep their gold and mint.
  - *Item*: a 76 × 76 key plate, same style. Holding an item: its art, 46 px (the five symbols are
    the game's world and keep their colors), and a 2 px `--ink` edge when it is ready. Shuffling: the
    art at 75 %, as today. Empty: the words `No item` at 11.5 px `--ink-3`, and the accessible name
    `No item` (B8). `Use the Paper Plane` and the rest are unchanged.
  - *Pause*: a 38 px key plate (`--sheet`, 1 px `--line`, 6 px radius) with the house's pause mark,
    two 2.5 px bars in `--ink-2`, a 44 × 44 hit (B2), top center, where it is today, or just right of the race card on a phone too narrow for both (`left:
    max(50%, inset + 184 px)`).
  - *The steering ring*: where the thumb lands, a 112 px ring drawn as a 1.5 px `--ink` stroke on the
    3.4 px halo of section 2; the knob the tracer head (a 14 px `--ink` disc in a 3 px `--sheet`
    ring). Before the first touch, the ring at 50 % with `Steer` on a small plate in its middle (the
    dashed ghost goes).
  - *Sides*: `Left` and `Right` in 12.5 px `--ink` on small plates at the bottom of each half,
    sentence case, no letter-spacing (in the stock game `LEFT` and `RIGHT`, tracked, at 35 % white);
    the dashed divider goes.
  - *The lock-on reticle*: the 40 px ring and four ticks in the halo recipe of section 2; locked onto
    a plane in flight, the ring closes to a 9 px radius around a 3 px dot, so the state is a shape,
    not orange (B7). No spin.
  - *The countdown*: `3`, `2`, `1`, `Go` are text in the scene (HOUSE 2.5): Ysabeau Office at 96 px,
    650, line height 1, `--ink`, on a 128 px `--sheet` plate with an 8 px radius (75 px on a 100 px
    plate on an upright phone 600 px tall or less, `calc(var(--ch) * 0.75)` in `style.css`, so the
    hint still fits above the steering ring), its top at 22 % of the screen or 8 px under the track
    map, whichever is lower (`--ct` in `style.css`: on a 320 or 360 px phone 22 % alone would run
    into the map and the card); 18 % on its side. The banners share that top. Each numeral replaces
    the last; no pop (B9). The beeps keep the beat.
- **The track map**: section 2; at the right edge, 104 × 104, 56 px below the top margin as decision
  36 put it, a plate with an 8 px radius.
- **Pause**: a `--sheet` panel, centered, 8 px radius, a 1 px `--line-strong` edge, no scrim, no
  blur: `Paused` (15 px, 650), then `Resume` (the solid `--ink` key, full width, 44 px), `Restart`
  and `Quit to title` (text keys in a 1 px `--line-strong` frame, 44 px). Escape and P still toggle it.
  It is a `role="dialog"` named by its `Paused`; pausing puts focus on `Resume`, resuming puts it back
  on the Pause key, so a keyboard or VoiceOver user is never left on a hidden key.
- **The results**: the frame above. The one large figure is your place; the lead is `of 8 in
  1:52.985`, said `of 8 in 1 minute 52.985 seconds`. Rows: place (12.5 px, 560, tabular), the face
  at 24 px in its tone's ring, the full name (12.5 px), the time (12.5 px, 560, tabular, right) and
  under it `best lap 0:36.534` or `no full lap` (11 px `--ink-2`). A projected time reads `about
  1:54`: whole seconds, after *about* (B3). Your row sits on the on-plate with your name at 620. The
  list keeps `role="list"` (WebKit drops a list's role when `list-style` is none), and each row is
  named in words, `2nd, Pip Marlow, 2 minutes 20.900 seconds, best lap 45.821 seconds` (`about …`
  for a projected time), so VoiceOver hears no colons. A record is a sentence in `--ink` above the
  keys: `New best lap on Harbour Loop.`, `New best race on Harbour Loop.` or `New best lap and best
  race on Harbour Loop.` (the yellow pills go). Keys: `Race again` (the solid key) and `Change track
  or racer` (a framed text key). The settle guard of decision 42 is unchanged and still tested.
- **The diagnostics line**: a `--sheet` plate, 11.5 px tabular in the house face (B13), its figures
  through `js/units.js`: `60 fps, 0.4 ms JS` / `31 calls, 30 120 triangles, ×2.00` / `built in 120
  ms` (U+202F before each unit; thousands grouped; no middle dots).

### About

A full-height `--sheet` panel that slides up over 220 ms on `--sheet-in` and closes at once:
`role="dialog"`, `aria-modal="true"`, labeled by its title `About Snug Kart` (15 px, 650); `Close`
at the top right and again at the foot; Escape closes it; Tab is held inside; focus returns to the
About key; `overscroll-behavior: contain`. While it is open the title's loop stops (nothing draws
under it), and it starts again on close. Sections, headed at 13.5 px 650 in sentence case, separated by
1 px `--line` rules; prose at 13.5 px, line height 1.5, at most 62 characters wide. The words, for the
builder to set as they are:

1. **What the lap chart is.** *A lap chart is how a race was kept on paper before timing screens:
   at each timing line, someone wrote down the order the cars crossed it in. This game keeps one for
   every race. There are ten timing lines on every lap, one at each tenth of the way round, so thirty
   in a race, and at each the chart notes the place every racer crossed it in. Read across, a line is
   one racer's race, from the grid on the left to the finish on the right, first place at the top.
   Yours is drawn in ink; the others are in their karts' colors and named at their ends. In the race,
   the card under your place draws your own line as it is written.* / *What it does not show: a pass
   and a pass back between two timing lines leaves no mark, and the straight stretch between two
   lines is not where a pass happened. A racer still out when the race ends gets a projected time,
   worked out from their average speed over their last ten seconds; their line is dotted from the last
   timing line they crossed to the place that time gives them, and their time reads "about".*
2. **This game**: `label: value` lines, written from the loaded data, so an edited file is described
   as it is: `Tracks: 3, from data/tracks.json`; one line per track, `Harbour Loop: 1 028 m a lap,
   rising 4.1 m`, with `, crossing itself 9.0 m apart` where `validation.crossover` is set (Lantern
   Night); `Racers: 8, from data/racers.json`; `Laps: 3`; `Timing lines: 10 a lap`; `Simulation:
   120 steps a second`.
3. **Sources and credits.** *Everything you see and hear (the karts, the racers' faces, the tracks,
   the scenery and every sound) is made by this app's code when it starts, from the two data files.
   The only work of others in it is the 3D library and the typeface.* / *3D: three.js r186, MIT
   License, as follows.* and then the text of `vendor/three-LICENSE.txt`, fetched from the app's own
   folder when About opens and set as text (13.5 px, `white-space: pre-wrap`), so the license is
   printed, never linked. Its single line breaks (the file's 80 columns) are joined into spaces and
   its blank lines kept, so at phone width it reads as paragraphs instead of ragged pairs; the words
   are the file's, verbatim. / `Type: Ysabeau Office by Christian Thalmann (Catharsis
   Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.`
4. **How the data gets here.** *The game reads data/tracks.json and data/racers.json from its own
   folder each time it opens, and checks them before it builds anything; a file it cannot use stops
   the game with a sentence naming the file and the problem. Edit them, in Snuggery or with an agent,
   and the next start races your tracks and your racers. Your settings and best times are kept on
   this phone, in this app's own storage. The app never goes online.*

### Motion and Reduce Motion

| What | How |
| --- | --- |
| The tracer under a chosen track, face or setting | draws in from tail to head, 160 ms, `--draw`, `clip-path` only |
| About | in: 220 ms `translateY` on `--sheet-in`; out: at once |
| The results, pause, notices, banners, the countdown, the warning, the reticle | appear and leave at once; nothing pops, blinks, spins or fades (B7, B9, B11) |
| The race card's numbers and strip, the record row, the caption lines | no transition, ever (`check.mjs` fails on one) |
| The title camera | glides along the centerline at 8 m/s, 6 m up, looking about 10° down at the road 32 m ahead (`js/camera.js` `glide()`), so with the view centered in the plate the horizon sits near a third of the way down it and the track's own scenery (the harbor, the pines, the lanterns and the bridge) fills it |
| The countdown swoop, the finish camera's swing, a boost's camera shake | as today |
| The scene (karts, parcels, sparks, steam, lanterns) | the game itself: its own motion is the race |
| The speed lines over a boost | removed (owner call 2): random streaks on a 2D canvas over the scene, the one effect no data drives; the field of view still carries speed |

**Reduce Motion** (`prefers-reduced-motion: reduce`, read live with a `change` listener): every CSS
duration 0 s (`*, *::before, *::after`); the title camera stands still at a fixed point 40 m past
the start line, 6 m up, looking 32 m ahead (its still form: the same track, shown); the countdown
starts at the chase position instead of swooping; the finish keeps the chase view instead of
swinging side on; no camera shake; the respawn is a cut with no fade; nothing blinks: a kart
recovering from a hit is a steady half form (opacity 0.5) instead of blinking, an expiring Quilt
shrinks once to 80 % instead of blinking, and the item key's shuffle shows the item it lands on at
75 % instead of cycling the icons. With motion on, those two blinks run at 3 Hz: a recovery lasts
1 s, so at most three flashes in any second (WCAG 2.3.1), and the shuffle cycles at 5 Hz. The race
itself runs as it does: it is the thing the person is doing. **Hidden** (`visibilitychange`,
`pagehide`): every loop stops, as today (a race pauses behind its panel).

### A phone on its side

At `(orientation: landscape) and (max-height: 500px)`: on the title the header is one 46 px row (the
name, About, the track words) and under it the plate takes the left and a 360 px column at the right
holds the caption, the racers in two rows of four (eight 44 px faces need 352 px; the column has 328
inside its gutters, less any safe-area inset), the name and line, the settings and the record with
`Race`, scrolling inside itself when it must. The plate is the screen's height less the 46 px header
and its width less the column: 484 × 344 px at 844 × 390, 307 × 329 at 667 × 375 and 572 × 384 at
932 × 430 (`shoot.mjs`'s widths scene measures each height), against the house's 220 px floor. The
race keeps today's landscape rule (the item key beside the drift key, clear of the track map). The
results and About are the same panels.

### Safe areas

`viewport-fit=cover`, and every band pads itself: the header `6 px + top` and `16 px + left/right`;
the title's bottom band `16 px + left/right` and `bottom`; the race card, the Pause key and the hint
keep today's `--mt` (the top inset plus 8 px, for a status bar Snuggery may leave showing); the track
map stays 56 px under it on the right, clear of Snuggery's exit control in the top-right corner
(decision 36); the drift and item keys keep `--mb` and `--mr`; About's head `top`, its body
`16 px + bottom`. Headless Chromium has no safe areas, so these are phone checks (`tools/DECISIONS.md`).

### Every string the house look changed

| The stock game | As built | Why |
| --- | --- | --- |
| `Snug Kart` (46 px wordmark with an orange shadow) | `Snug Kart`, the 15 px name | HOUSE 2.5 |
| `Three laps. Seven rivals. One …` (the last word in British spelling) | removed (owner call 4) | a slogan; British (B5) |
| `Warming up the engines…` | `Building the karts and the tracks…` | what it is doing |
| `1,028 m · No best yet` / `Best lap … · Best race …` | the caption line and the record row | B4, tell 6 |
| `Pip Marlow — A bike courier …` | the name and the line on two lines | B10 |
| `Sound Off`, `Tilt Off` | `Sound`, `Tilt` (toggles) | sentence case, a stable name |
| `Quality High`, `Controls Pad`, `Pace Standard` | `Quality high`, `Controls pad`, `Pace standard` | sentence case |
| `7th / 8`, `Lap 1/3`, `Last 0:36.527` | `7th of 8`, `Lap 1 of 3`, `Last lap 0:36.527` | words, not symbols |
| `Finished 3rd` | `Finished 3rd of 8` | the field's size |
| `Paper plane!`, `Tangled!`, `Sticky!` | `Hit by a paper plane`, `Caught in a yarn snare`, `Stuck in honey` | say what happened (owner call 3) |
| `Plane behind` | `Paper plane behind you` | the item's name |
| item key, empty (no word; name `Item`) | `No item` | B8 |
| `Harbour Loop — 5th` | `Harbour Loop`, then `5th of 8 in 1:52.985` | B10 |
| `New best lap`, `New best race` (pills) | one sentence | tell 4 |
| `1:54.056 est.` | `about 1:54` | B3 |
| `Graphics were reset — tap to continue.` | `Graphics were reset. Tap to continue.` | B10 |
| `… is not valid JSON — check for a missing comma or bracket.` | `… is not valid JSON. Check for a missing comma or bracket.` | B10 |
| the same sentence with *color* in British spelling | `"body" must be a color like #F28C28.` | B5 |
| `radius 12.0 m`, `8.9 %` in the track checks | the same with U+202F before the unit, through `js/units.js` | B15 |
| `60 fps · 0.4 ms JS` … `30.1k tris` | `60 fps, 0.4 ms JS` … `30 120 triangles` | SI, tell 6 |
| `Harbour Loop` (the data's name) | unchanged | it is data (`data/tracks.json`); owner call 6 |

---

## 4. Type

- **The house file, byte for byte**: `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
  `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
  sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copied from
  `global-weather/fonts/` (`shasum -a 256 ../global-weather/fonts/*` printed both on 2026-10-02).
  One `@font-face` rule, word for word as HOUSE 2.5 gives it; the family only through `--face`.
- **No supplement.** Every character the game will write is in the cut: the ASCII letters and
  figures of every name and sentence, U+202F, U+2013 (the `–:––.–––` of a time not yet set), the
  real ellipsis, © (in the three.js license text, U+00A9, which the cut holds), × (the diagnostics'
  pixel ratio). HOUSE 2.3 measured no character outside comments that the cut lacks; the pass adds
  none (→ is never written; ‹ › go with the track card).
- **The faces it replaces**: none shipped in the stock game. The stack it replaces is `ui-rounded,
  system-ui, -apple-system, "Segoe UI", sans-serif` (the system's rounded face on a phone) and the
  diagnostics' `ui-monospace, Menlo, monospace`. Both go.
- **The scale** is HOUSE 2.5's: 10.5 (the chart's labels), 11 (captions, the racer's line, the
  notes, the results' best laps), 11.5 (`No item`, the diagnostics), 12.5 (words, the race card's
  lines, rows, text keys), 13.5 (notices, the hint, the warning, About's prose, `Drift`, ` of 8`),
  15 (the name, the banners, `Race`, `Paused`, About's title), 21 (the one large figure: the best
  lap on the title, the place in the race card, the place on the results). **Text in the scene**:
  the countdown's numerals and `Go` at 96 px (75 px on an upright phone 600 px tall or less), 650,
  on their plate, the only text above 21 px. Weights 400, 560, 600, 620, 650. Nothing in capitals,
  no letter-spacing, sentence case.
- **Canvas text waits for the face**: `js/chart.js` awaits `document.fonts.load('560 10.5px "Ysabeau
  Office"')` before its first draw and redraws on `document.fonts`' `loadingdone`; every font string
  in a script starts with `"Ysabeau Office"`. The face is local, so `font-display: block` costs
  nothing and keeps the chart's labels out of a fallback face.
- **The credit line**, word for word, in About (`Type: …`), in `NOTES.md` (its Licenses section,
  in place of the stock game's "No font … is included" sentence) and in `DESIGN.md` §18:
  `Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in
  fonts/ with its license.`

---

## 5. The camera's strings (HOUSE 7.4)

| The camera | The string | Role | As built |
| --- | --- | --- | --- |
| waits for (`waitForSnugKart`, `MarketingCameraCase.swift` lines 270-276) | `Race` | a button, matched by its whole label, case-insensitive | **kept**: `<button id="btn-race">Race</button>`, the title's solid key, its text and its role unchanged |
| waits for, before the still `23-snug-kart` (`MarketingShotsUITests.swift` lines 508-513) | `Race` | the same button | **kept** |
| taps (`MarketingShotsUITests.swift` lines 774-786, the README panes) | `Race` | the same button | **kept** |

Nothing else in the game is waited for or tapped. No other control is named `Race` exactly (`Race
again` lives on the hidden results sheet and does not match a whole-label search). The README pane
waits nine seconds after the tap for a race in progress; the countdown stays three seconds and the
pass adds no wait, so the pane still lands after `Go`. **The camera needs no change.** The game
remembers the track, the racer and the settings, but the camera changes none of them.

---

## 6. Budgets

**The caps** (HOUSE 8, plan 0011 D5):

| | Cap | Why |
| --- | --: | --- |
| App code | **244 000 B, the lead's ruling (2026-10-02, plan 0011 D20)** | Tilt kept; the reasons are in `tools/DECISIONS.md` |
| Fonts | 160 000 B | the house's; this pass adds 40 075 B |
| ZIP | **720 806 B** | ⌊546 378 × 1.25⌋ + 37 834 for the face it gains (D5, point 1): the ZIP before the pass, 546 378 B, a quarter more, and the face |
| The game's own | ZIP under 3 MB (`tools/check.mjs` line 300, now the looser bound); per frame on High ≤ 50 draw calls and ≤ 150 000 triangles, on Low ≤ 35 and ≤ 90 000 (`DESIGN.md` §15.2, `tools/shoot.mjs`) | the tighter wins; the chrome adds no draw call (it is DOM and 2D canvases) |

**As built**, measured 2026-10-02 by `node tools/check.mjs` (its lines 16 and 4):

| | Measured | Cap |
| --- | --: | --: |
| App code | **242 655 B** | **244 000**, the lead's ruling (plan 0011 D20); 1 345 B left |
| Fonts | 40 075 B (the house face and its license) | 160 000 |
| ZIP | **about 619 000 B** (this file and the other documents ship, so their edits move the last digits; `check.mjs` prints the exact figure) | 720 806 |

Nothing is minified and no comment is stripped. The code is within 5 % of its cap, 1 345 B under it
(HOUSE 8), so anything the game gains, it pays for. `check.mjs` enforces 244 000.

---

## 7. The generated-page tells, answered

| Tell | Snug Kart |
| --- | --- |
| 1. Cream ground, high-contrast serif display, terracotta accent | White `#ffffff` (HOUSE 12) and the slate `#141d21`, one Renaissance sans at every size, no display face, no accent. Orange appears only as Pip's kart and Pip's tone. The stock game had exactly this tell: cream `#FFF8EC` panels, a 46 px rounded wordmark with an orange `#E0673A` drop, an orange Race button. |
| 2. Near-black ground with one acid accent | The loading screen's `#10131C` goes; the dark page is the house slate (L 0.224). The bright things are the scene and, on the results, your ink line. |
| 3. Broadsheet hairlines and zero radius | One column of bands; hairlines only above the record row and between About's sections; radii by role (6 keys' small plates, 8 the card, the panels, the notices and the large keys, 4 the on-plate). |
| 4. The SaaS card kit: one radius, soft shadow, gradient wash | Plates and panels with a 1 px edge and no shadow, no blur, no gradient but the tracer (the stock game: 22 px panels with a 40 px shadow and a backdrop blur, 999 px pills, a 3D button shadow). |
| 5. All-caps tracked eyebrow labels | None; sentence case; `letter-spacing` 0 everywhere (the stock game: `LEFT` / `RIGHT`, uppercase and tracked). |
| 6. Meta strings joined with middle dots | None; commas and sentences (the stock game: the track's meta and the diagnostics). |
| 7. "WORD — fragment" with a spaced em dash | None (the stock game: the results title, the racer line, two sentences). |
| 8. A tinted near-black standing in for black | The respawn fade's `#000` becomes the dark page `#141d21`; the ink is the house's stated `#0f1c23`. |
| 9. Monospace for small data labels | None; the face's figures are tabular (the stock game: the diagnostics). |
| 10. "→" on buttons | None; `check.mjs` fails on → and ➤. |
| 11. One word accented in a headline | None. |
| 12. Unnecessary labels above content | None; the setting words carry their own names, the chart's labels are its axes. |
| 13. Numbered markers 01 / 02 | Places in the results are places, a real sequence, in an ordered list (`role="list"` kept for WebKit). |
| 14. A big number, a small label, a gradient | One large figure per screen at 21 px (the best lap, your place), no gradient; the countdown's 96 px numerals are scene text, named in section 4. |
| 15. Scattered entrances, hover on every card | No entrances; hover only on controls under `(hover: hover)` (the stock game: the numerals pop, the banners slide, the reticle spins, the warning blinks). |

---

## Where the record is

The pass's record does not ship: the bugs B1 to B15 that this file cites and the stranger's run that
found them, the change list, the owner calls (the references to "owner call 2" to "owner call 6"
above point there), the as-built departures, the reviews and the follow-up, the history this file
once carried and the phone checks are in `tools/DECISIONS.md`, which the ZIP leaves out (HOUSE.md,
"What ships and what does not").
