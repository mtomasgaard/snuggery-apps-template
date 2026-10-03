# Running Dashboard: art direction

`NOTES.md` says where the data comes from and how the pieces fit; `PROMPT.md` sets a copy up. This
file says how the app looks, moves and speaks under the template's house system
(`Template/HOUSE.md`, the brief; Global Weather is the reference). It is the first of HOUSE 4.0's
*panes from a pull* to take the house, so what it settles for a pane app (the frame that scrolls
inside itself, the caption band that closes each pane, the readout card inside a chart, the plan drawn
in outline, a finger that scrolls without opening cards) is the pattern the pane apps after it follow.

The record of the pass (the lead's rulings, the owner calls, the departures as built, the QA, review and
follow-up answers) is in `tools/DECISIONS.md`, which does not ship (section 8).

**Every figure here was measured on 2026-10-02** and names the command that printed it. The commands
run from `Template/running-dashboard/` unless they say `Template/`. `python3
running-dashboard/tools/art/palette.py` (from `Template/`) prints every color and contrast and ends
`ALL CHECKS PASS`. Pictures from `tools/shoot.mjs` (headless Chromium, 390 × 844, DPR 2, real touch,
both themes) are evidence of what the page draws, never of how a phone feels. The screen's words quoted
here were read in that browser with the clock where `shoot.mjs` fixes it, 1 Oct 2026, 12:00 in
Copenhagen, the morning after the demo's pull, unless the text names the evening of the pull (30 Sep,
21:00).

---

## The look: the house, with one bold thing of its own

- **Panes on a page, not cards.** Each pane is one column on `--page`: sections separated by 1 px
  `--line` rules, headed in the house face at 13.5 px 650, each chart with its legend, a one-line
  caption that says what one bar is, and a `How to read it` disclosure holding the longer text. No
  card, no shadow, no radius but the house's roles.
- **Color only where it is a category.** Garmin's zone hues, the sports, the shoes and Garmin's
  training statuses keep their identities, fitted into a lightness band per theme (section 2). A chart
  of one quantity (weekly kilometers, sleep, steps, floors, calories, HRV, VO₂ max, weight) wears no hue
  of its own: it is drawn in `--amount`, a quiet slate, so Training and Health read as instrument
  plates and every average line is ink on a casing.
- **The plan is drawn in outline, everywhere.** What was done is filled; what the plan asks is a
  1.5 px outline of the same shape. The Block (section 1) is where that rule is born; the day charts,
  the load chart and the plan's zone bars follow it, so a reader learns it once.
- **One bold thing: the Block** (section 1), the training block as a coach's sheet, weeks of running
  in ink with the weeks still to run as empty outlines up to race day. It is the only drawing in ink at
  full strength; everything else is quiet.
- **Honesty is the coaching text's provenance and the data's age.** Every number is the watch's or is
  computed here by a method About names. The evaluation, the plan and the race forecast are text the
  coaching routine wrote on a date the screen prints. The data's age is a sentence in the stamp, never
  a color, and whatever counts back from today stops at the day the data was updated and says so
  (section 3, "When the phone has moved past the data").

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
| Snug Kart | the Lap Chart | race distance, in timing lines | each racer's place at each line | the results sheet | eight crossing lines |
| **Running Dashboard** | **the Block** | **weeks, twelve back to race day** | **each run's kilometers, and the plan's target per week** | **the head of Now and Plan** | **ink columns cut into runs, then empty outlines** |

The one family resemblance is Shelf Atlas's Peaks, where an outline is a reference and the fill is
now. There the reference is a record behind the disc (the field's best month); here it is an
intention ahead of the ink (the week the plan asks for), and the outline is empty until the runner
fills it. It is the only signature in the template that draws the future as something a person is
going to do rather than something that will happen to them.

---

## 1. The signature: the Block

**What it is, in one paragraph a stranger would get.** A coach plans a race as a *block*: sixteen
weeks or so of running drawn up on one sheet, the weekly distance climbing through a build with an
easier week every few, peaking, then tapering into race day. Runners pin that sheet to the fridge and
fill it in. Running Dashboard draws the sheet at the top of its first pane. Each week is a column.
The weeks already run are solid ink, cut into one block per run, so a week of six runs shows six
pieces with the long run the tallest. The weeks still to come are empty outlines as tall as the plan
asks, ending at the race, named over its week. This week is both: an outline of what the plan wants,
with this week's runs filling it from the bottom, a block at a time. A glance says how far into the
block you are, what the shape of it has been, how much of this week is left, and how many weeks
until the start line.

**What a stranger remembers** is the empty boxes. The demo's Block (`node tools/test_block.mjs`
decodes `data/snapshot.json` with its own code and prints these): twelve weeks back from the week of
28 Sep, from 49.8 km (13 Jul, five runs) through two peaks of 73.9 and 77.8 km (7 and 14 Sep, six runs
each, the long runs 23.0 and 24.0 km) and two down weeks (40.0 km on 24 Aug, 45.9 km on 21 Sep), then
this week, 24.0 km in two runs inside an outline of 62 km, then four outlines, 76, 62, 48 and 49 km,
the last carrying Copenhagen Half Marathon on Sunday 1 Nov. The build, the peak and the taper are
visible without a word. The figures are running kilometers, walk breaks out; the sessions' whole
distances are 49.9, 74.0, 78.0 and 46.0 km.

**How it was found** (HOUSE 5.1):

1. *What does a specialist call the picture of this data?* A coach's training block (periodization)
   sheet: weeks across, volume up, the race at the end. Also the training log (a diary of days), the
   fitness and fatigue chart (Banister's two curves, which Garmin's acute and chronic load already
   are), the intensity distribution (time in zone) and the route map. Only the block sheet holds the
   plan and the runs on one axis.
2. *What does a person do most here?* Opens it in the morning on Now, the pane the app opens on and
   the marketing camera photographs: did the week go to plan, what is next, how long to the race. The
   Block sits where the eyes land and answers all three.
3. *What does this data have that no other app has?* A plan: an intention written ahead by the
   coaching routine (`plan.horizon[]`, one target per week to the race; `plan.goal.race`, a dated race)
   set against what the watch recorded. No other app in the template has a future that a person will
   carry out. Moved to Finances it would need a budget per week and a race; moved to a weather app it
   would draw a forecast as if it were a promise. Set aside, with what they would have said:
   - *The fitness and fatigue chart*: true and already on Training (Garmin's acute and chronic load),
     but it is TrainingPeaks' and Garmin's own picture, and it says nothing about the plan.
   - *The training log as a calendar of days*: honest, but the calendar grid of dots sized by distance
     is a common product pattern and a contribution-graph look-alike; it could move to any app with
     dates.
   - *The route map*: the most visual thing in the app, and the least fitted: every running app has it,
     and the demo's routes are segments of famous courses, not the runner's own.
   - *The heart-rate zone trace* (every second of a run credited to a zone, `zk`): precise and rare, but
     a picture of one session, read on Sessions, not the thing a person opens the app for.
4. *Can it be drawn with the house's means?* Yes: `--ink` blocks and 1.5 px `--ink` outlines on
   `--page`, `--line` hairlines, 10.5 px labels in the house face, no motion at all.

**The rule it is drawn by** (`js/block.js`, pure; `tools/test_block.mjs` proves it):

- **The weeks.** Let `this` be the Monday of the last day the data saw: the phone's date, never earlier
  than `dataThrough` and never later than the day of the pull (`todayIso()` in `app.js`). The columns
  are the eleven Mondays before `this`, `this`, and every Monday after `this` in `plan.horizon[]` (in the
  demo four, to 26 Oct; up to 26 when a plan reaches further). Without a plan, or with a horizon that
  ends before `this`, the columns are the fifteen Mondays before `this` and `this`: ink only. So a stale
  snapshot never draws weeks the data has not seen as empty weeks of running.
- **The ink.** For each column up to and including `this`, every activity with `sport === 'run'` whose
  date falls in that week contributes one block of `runKm(a)` (the running inside the session, walk
  breaks out, as every running figure in the app is), stacked from the baseline in date order and,
  within a day, start-time order (`a.t`). Height = km × the scale; a 1 px gap of the ground separates
  blocks; a block under 1 px is drawn 1 px. No other sport is drawn: the Block is running kilometers,
  as its caption says.
- **The outline.** For `this` and each later column, the plan's target: `horizon[i].km` for that Monday.
  Drawn as a 1.5 px `--ink` stroke inset by 0.75 px so its outer edge is the column's edge, no fill,
  square corners. Where `plan.weeks[]` gives the same week a range (`targetKm` like `26–30 km`), the
  outline runs to the upper value and a 1 px `--ink` tick crosses it at the lower value; the readout
  prints the range as written. A week before `this` never has an outline: past plans are not kept in
  the data, and the Block does not invent them (About says so).
- **The scale** is fixed and printed: **0.8 px per km on Now, 1.2 px per km on Plan**, from a
  baseline. The plot is as tall as the larger of 80 km and the tallest column (ink or outline) rounded
  up to 20 km; 1 px `--line` hairlines at every 20 km behind the columns, their values in a 30 px
  gutter at the right in 10.5 px `--ink-3` (`20`, `40`, `60 km`, the unit after the last only, U+202F
  before it). The demo's Block is 64 px of plot on Now, 96 on Plan.
- **The columns** share the content width less the values' 30 px gutter (328 of 358 px at 390 × 844
  with 16 px gutters): slot = width / columns, column = slot − 4 px, left-aligned in the slot, every
  edge on a whole pixel (16 columns: 20.5 px slots, columns of 16 and 17 px). Above the plot, one
  14 px label row; under it, a 3 px gap and one 14 px label row.
- **The labels.** Under the plot, in 10.5 px `--ink-2`, the month at the first column whose Monday
  begins it (`Jul`, `Aug`, `Sep`, `Oct`), the first label carrying the year (`Jul 2026`), and a later
  January carrying it again; a label that would collide with the one before it is skipped. Over the
  race's column, a 1 px `--ink` rule at the race day's x (the column's left + (weekday index + 0.5) / 7
  × column width) from the label row to the outline's top, and the race's name and date in 10.5 px
  `--ink-2` on a 3 px `--page` halo, `Copenhagen Half Marathon, 1 Nov`, anchored at its right end to
  the rule so it never runs off the chart.
- **`now`.** Over `this`, `now` in 10.5 px `--ink-3` with a 1 × 6 px `--ink-2` notch down to the plot's
  top. When the race's name covers that place, the notch is not drawn and the word moves to the month
  row under `this`, if it stands at least 4 px clear of every month's name there; otherwise neither is
  drawn, rather than a notch tucked under the name's letters. With sixteen columns at 390 px the demo's
  race name always covers `this` and the month row has `Oct` 2 px away (`now` is 18.7 px wide, centered at 234.5; `Oct` begins at 246), so on an upright phone the
  current week is told by its half-filled outline and by the figure under the Block; at 844 px (a phone
  on its side) `now` and its notch stand over the column. When the phone's week is past the week of the
  last pull, the word is `updated` (HOUSE 4.6: a present outside the data is never marked `now`).
- **The readout.** A tap or a sideways slide on a column opens the house readout card (HOUSE 4.7;
  section 3) for that week: the place line `Week of 14 Sep 2026`, the value `77.8 km` (21 px, 600; the
  unit 13.5 px after U+202F), then the rows `Runs 6`, `Longest 24.0 km`. A planned week's card is `Week
  of 5 Oct 2026, planned`, `76 km`, then `Kind peak`, `Mix easy 78 %, moderate 12 %, hard 10 %`, `Note
  The last big week.` (from the data, as written), with a `Plan` row when the plan gives the week as a
  range. This week's card starts `So far 24.0 km of 62 km planned`. A tap announces it once in words
  (`Week of 14 September 2026. 77.8 kilometers in 6 runs, longest 24.0 kilometers.`).
- **Keyboard and VoiceOver.** The drawing is `role="img"` with an `aria-label` built from the data:
  `Weekly running, 13 July to the week of 26 October 2026: 12 weeks run, the latest 77.8, 45.9 and so
  far 24.0 kilometers; 4 weeks planned, 76, 62, 48 and 49 kilometers; Copenhagen Half Marathon on
  1 November.` The section's `Show the table` key lists every column (week, run km, runs, longest,
  plan) as the other charts' tables do.
- **The caption**, under it, 11 px `--ink-2`, wrapping in the pane (two lines on a phone held upright;
  it scrolls with the pane and moves nothing): `Weeks of running to Copenhagen Half Marathon: ink is a
  run, an outline the plan's week.` Without a race: `Weeks of running: ink is a run, an outline the
  plan's week.` Without a plan: `Weeks of running: each block is a run. No plan in this snapshot.`
- **The test hook**: `window.__rd.block()` returns `{ columns: [{ week, runs: [km…], target, low,
  kind }], scale, now, topKm, base, points: [[x, y, w, h]…], outlines }`, the drawn rectangles in CSS px,
  so `shoot.mjs` checks the drawing against its own decode and samples the ink's pixels.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears.* No activities, no ink; no plan, no outlines; no race, no race
   mark. A broken snapshot is a sentence (section 3), never an empty sheet. Nothing is seeded or drawn
   ahead of the data, and nothing moves.
2. *Every property that varies is measured.* A block's height is a run's running kilometers at a
   printed rate; an outline's height is the plan's number for that week at the same rate; x is the
   week (an even division of time); the race rule's x is the race's date; the gaps are fixed. Color
   encodes nothing: it is all ink.
3. *It is captioned.* The caption above, the hairlines' values, the month labels, `now` where it has
   room and the race's name; About's first section in full.
4. *It reads.* Ink on `--page`: 14.80:1 in the light theme, 14.43:1 in the dark (`python3
   running-dashboard/tools/art/palette.py`, check 4), against a target of 3.0:1 for a mark. The 1 px
   gap between two runs is the page itself, so it holds the same figure. `shoot.mjs` samples the drawn
   ink on rendered pixels: 2 257 samples in each theme, every one at 3:1 or more, the lowest 14.80
   (light) and 14.43 (dark).
5. *It survives Reduce Motion.* It has no motion.
6. *About says what it shows and what it does not* (its first section): running only, walk breaks
   out; one block per run, not per day; the outline is the plan as the coaching routine wrote it on
   the date printed, and past weeks' plans are not kept, so a past week shows only what was run; a
   target given as a range is drawn to its top with a tick at its bottom; the scale; and that the
   weeks follow the phone's calendar (Monday to Sunday).
7. *It is the only bold element.* On Now and Plan it is the only drawing in ink at full strength; the
   charts below it are drawn in the fitted data tones and the `--amount` slate, the text is quiet, and
   no tile or pill competes.

---

## 2. Palette

Every figure here is printed by `python3 running-dashboard/tools/art/palette.py` (from `Template/`;
`ALL CHECKS PASS`). `--json` prints the fitted tokens and the route ramp per theme; they are pasted into
`style.css` (the zone, series and `--amount` tokens) and `js/palette.js` (the ramp), and
`tools/check.mjs` fails while either differs from `--json`. The script's source colors are the app's
own data hues (`SOURCE` in the script; Garmin's zone convention among them): their hue and chroma are
what is kept, and only lightness is fitted.

### The chrome tokens

The house's, copied as they are, in both themes (HOUSE 3.1), with `--draw`, `--sheet-in` and
`--face`.

| Token | Light | Dark | On `--page` | On `--sheet` |
| --- | --- | --- | --: | --: |
| `--ink` | `#0f1c23` | `#e6edee` | 14.80 / 14.43 | 16.40 / 12.87 |
| `--ink-2` | `#45555d` | `#a3b1b6` | 6.61 / 7.76 | 7.32 / 6.92 |
| `--ink-3` | `#5b6a72` | `#8b9a9f` | 4.78 / 5.88 | 5.29 / 5.25 |
| `--line-strong` | `#74858c` | `#64757b` | 3.27 / 3.56 | 3.62 / 3.18 |

The on-plate (`--ink` at 12 % over `--sheet`: `#dadee0` / `#343f43`) marks the chosen session row and
a key that is on: `--ink` on it 12.81 / 9.14, `--ink-2` 5.72 / 4.91. The highest chroma of any chrome
token: 0.0239 (light), 0.0223 (dark).

### The tonal budget

| | Light (film base) | Dark (the print) |
| --- | --- | --- |
| Ground | `--page` `#e8eef0` (L 0.945) under every pane; `--sheet` `#f6f9fa` (L 0.980) under the readout card, About and the route's casing | `--page` `#141d21` (L 0.224); `--sheet` `#1c272c` (L 0.265) |
| Data band (every data token) | L 0.400–0.625 | L 0.560–0.860 |
| Signature | the Block, `--ink` `#0f1c23` (L 0.218, C 0.0228), opaque | `--ink` `#e6edee` (L 0.941, C 0.0076), opaque |
| Worst measured case | ink on page 14.80; the lowest data token on a ground 3.04 (zone 0 on `--page`) | ink on page 14.43; the lowest 3.21 (series 4 on `--sheet`) |

The band sits below the grounds in the light theme and above them in the dark, and the ink keeps the
far end of the range in both (check 4: L 0.218 under 0.400; L 0.941 over 0.860). Every data token is
a mark at 3:1 or more on both grounds (check 2). The Block never sits over data, so its worst case is
the page. Ink drawn *over* data (the four-week and seven-day averages, the planned average, the
cursor, the route's start and finish) goes on a 4 px `--page` casing (2 px of ink over it): without
the casing ink over the closest data token would be 1.83:1 (light, series 8) and 1.23:1 (dark,
zone 3), which is why the casing is there (check 5).

### The data tokens

`--zone-0` to `--zone-5`, `--series-1` to `--series-8` and `--amount`. Hue and chroma are the source
hue's (chroma lowered only where sRGB has none at the new lightness); lightness is fitted per theme.

| Token | Source | Light | L | On page | Dark | L | On page |
| --- | --- | --- | --: | --: | --- | --: | --: |
| `--zone-0` (no zone) | `#d7dbe3` | `#81898e` | 0.625 | 3.04 | `#6e767a` | 0.560 | 3.69 |
| `--zone-1` | `#a3a8b2` | `#5f676b` | 0.508 | 4.92 | `#9ca5a9` | 0.716 | 6.82 |
| `--zone-2` (blue) | `#3b8fe4` | `#0061af` | 0.490 | 5.38 | `#66affe` | 0.740 | 7.44 |
| `--zone-3` (green) | `#52b043` | `#115702` | 0.399 | 7.50 | `#8dec7e` | 0.859 | 11.76 |
| `--zone-4` (orange) | `#f59a23` | `#965a01` | 0.524 | 4.77 | `#dc8602` | 0.695 | 6.07 |
| `--zone-5` (red) | `#e5443b` | `#d7352f` | 0.580 | 4.04 | `#e5443b` | 0.619 | 4.25 |
| `--series-1` (running) | `#2f6df6` | `#0541c8` | 0.445 | 6.90 | `#9cbeff` | 0.801 | 9.14 |
| `--series-2` (ride) | `#f0663a` | `#ca430e` | 0.569 | 4.15 | `#e1592c` | 0.635 | 4.62 |
| `--series-3` (strength) | `#17b07c` | `#007651` | 0.500 | 4.83 | `#36c18c` | 0.725 | 7.47 |
| `--series-4` (elliptical) | `#efa400` | `#b47b06` | 0.626 | 3.10 | `#9b6901` | 0.559 | 3.60 |
| `--series-5` (other) | `#e97ba8` | `#a33c6a` | 0.513 | 5.25 | `#e678a5` | 0.710 | 6.19 |
| `--series-6` (hike or walk) | `#7f62d6` | `#785bce` | 0.558 | 4.28 | `#9377ed` | 0.650 | 4.97 |
| `--series-7` | `#16a9bd` | `#0b8d9e` | 0.590 | 3.37 | `#0092a4` | 0.605 | 4.60 |
| `--series-8` | `#a06c3d` | `#6a3a02` | 0.400 | 8.08 | `#fdc493` | 0.860 | 10.99 |
| `--amount` (one quantity) | (L, C, h) in the script | `#4a6588` | 0.500 | 5.11 | `#93aeca` | 0.740 | 7.45 |

**`--amount`** is the tone of every chart of one quantity: weekly running kilometers, runs per week,
longest run, the ramp ratio, sleep, HRV, steps, floors, calories, the efficiency index, the VO₂ max line,
the weight line, blood oxygen, body battery. A single quantity's hue encodes nothing, so it gets none:
a slate in the running series' hue family at chroma 0.065 (light, h 255) and 0.050 (dark, h 249), on
`--sheet` 5.66 and 6.65 (check 2, which also holds it at chroma 0.07 or less). The most saturated tokens
are kept for the categories, where hue is the meaning, and the Block stays the one bold thing on every
pane it heads. Where two quantities share a chart they keep two tokens (stress `--series-2` over the
body-battery band in `--amount`; moderate and vigorous intensity minutes `--zone-3` and `--zone-4`).

**The categories** (check 3), every pair at least ΔE 0.10 apart (OKLab) under normal vision: the six
zones (closest light zone 0 and zone 1, 0.117; dark zone 1 and zone 2, 0.128), the eight series
(closest light series 3 and 7, 0.123; dark series 2 and 4, 0.136), and Garmin's ten training
statuses, each drawn in one of the tokens (Detraining `series-8`, Recovery `series-1`, Maintaining
`series-4`, Productive `zone-3`, Peaking `series-6`, Unproductive `zone-4`, Strained `series-5`,
Overreaching `zone-5`, Paused `zone-1`, No status `zone-0`; closest light Maintaining and
Unproductive, 0.105; dark Recovery and Paused, 0.124). Easy, moderate and hard (zones 2, 3, 4) are
0.195 apart at the closest (light).

**A stated departure from HOUSE 3.3: color-vision deficiency.** HOUSE 3.3 asks every pair of
categories to stay ΔE 0.10 apart under simulated deutan, protan and tritan vision too. Here some do
not, and the script prints each as `dep`. Two of them are sets of five or fewer: easy, moderate and
hard under protan vision in the light theme (zone 3 against zone 4, 0.065), and the three sports in
the data under tritan vision (run against strength, 0.065 light, 0.089 dark; under deutan and protan
run against hike or walk, 0.100 and 0.066 light). The larger sets come closer still (the zones' 4
against 5 under protan, 0.034 light; the statuses' Detraining against Productive under deutan, 0.010
light). Separating them by lightness is not open: the band is 0.225 wide in the light theme, every
token must stay at 3:1 on both grounds, and the zones keep Garmin's hues, which the runner knows from
the watch. So identity never rests on color alone: every legend names its categories in words, the
time-in-zone and sport stacks keep one fixed order from the baseline (easy, moderate, hard; Z1 to Z5),
the status strip's legend carries each status's day count, every readout names the zone, sport, shoe
or status, and the planned-session rows name their kind.

**How the steps were chosen, and what was given up, plainly.** The two zone grays keep Garmin's order
(no zone nearest the ground, Z1 a step further), so they part by lightness. Every other token's place
in the band was found by a search over a grid of twentieths (20 000 draws) for the widest closest pair
across the zones, the series and the statuses in both themes with every token at 3:1 on both grounds;
the steps are in the script's `STEP`. They are not a salience order: Garmin's zones are categories
here, named in every legend, not a scale. **In the light theme Garmin's orange zone prints as a burnt
orange (`#965a01`) and its green as a forest green (`#115702`)**, because Garmin's orange (L 0.762) and
green (L 0.676) are too light to stand at 3:1 on the film-base page; in the dark theme both stay close
to Garmin's (`#dc8602`, `#8dec7e`).

### The route ramp

The Sessions pane colors a route by pace, speed, cadence, power or elevation: cool for low, warm for
high, on one path whose lightness runs one way (light theme L from 0.641 to 0.420, dark from 0.579 to
0.860: "more" stands further from the casing in both), printed twice, every point at 3:1 or more on
the route's `--sheet` casing (lowest 3.14 light, 3.59 dark), the ends apart by ΔE 0.26 or more under
normal, deutan, protan and tritan vision, every eighth stepping by at least 0.045 (check 6). Nine
stops per theme, from `--json`, interpolated in sRGB by the app, stay within ΔE 0.0084 of the OKLab
path:

- light: `#4493d0 #5c80d5 #756bd0 #8d55bb #9f3e99 #a72c6d #a61d3c #9b1b0f #7f3203`
- dark: `#3080bc #5c81d5 #877fe6 #b57ce6 #de79d7 #fe7dba #fe99a2 #ffaea0 #ffc1a6`

The legend under the map is that ramp as a 6 px bar (0 radius, a 1 px `--line-strong` frame at 60 %)
with its two ends printed as values (section 3). The ramp spans the session's own 5th to 95th
percentile, and never less than a minimum span centered on the session's median: 45 s/km of pace,
4 km/h of speed, 10 steps or turns a minute of cadence, 30 W of power, 20 m of elevation, so a steady
run reads steady. Both are display choices About and the map's caption name (`tools/DECISIONS.md`,
owner call 3, with how the floors were measured). The demo's easy run of 29 Sep, its 5th and 95th
percentiles of pace 12 s/km apart, draws 90 % of its route in three of the nine stops (`shoot.mjs`).

### Marks that are not data

- Thresholds a reader measures against (sleep `7 h`, intensity `150 min`, oxygen `95 %`, the step
  goal, the ramp ratio's `1.5`, the lactate threshold, the zone floors): 1 px `--ink-2`, dashed 3/3,
  their label in 10.5 px `--ink-2` at the line's right end. A label within 12 px of the one drawn
  before it is left out (the floors of zones 3 and 4 sit close on the 24-hour heart-rate chart; the
  readout names the zone). The ramp ratio's sustainable band (0.8 to 1.3) is `--ink` at 7 % with its
  words in the legend.
- Garmin's optimal-load band is data (Garmin's own range): `--amount` at 16 %.
- The column charts' week and day marks (`now` on the time-in-zone or load chart, `today` on the day
  charts): a 1 px `--line-strong` rule dashed 3/3 over the plot's height, its word in 10.5 px `--ink-3`
  on a 3 px `--page` halo at the top; the race's mark a solid 1 px `--ink` rule, its name in `--ink-2`.
  Words anchor inside the chart. The Block's rule holds here too: a word that would collide with the
  race's name is left out and its rule kept, and a rule that passes under another mark's word starts
  below its letters. Once the phone has moved past the data, the word is `updated` (section 3).
- The 24-hour charts' hours: a 1 × 3 px `--line-strong` tick under the baseline at every third hour,
  its label centered on it; a label within 38 px of the one before it, or that would run off the
  chart, is left out, never pushed off its tick.
- Hairlines behind a chart: `--line`; the baseline: `--line-strong`.
- The cursor on a chart (the column under the finger): `--ink` at 7 %; on a line chart a 1 px `--ink`
  rule at 50 % and a 7 px `--ink` disc with a 2 px `--page` ring.
- The route's start and finish: the start a 9 px `--ink` disc with a 2 px `--sheet` ring, the finish a
  12 px ring of 2 px `--ink` on `--sheet`. The route line: 4 px of ramp color on a 7 px `--sheet`
  casing; the part outside the distance window 2.5 px `--ink-3` at 45 %.
- The map tiles keep their own colors in the light theme and are inverted in the dark (`invert(1)
  hue-rotate(180deg) brightness(.82) contrast(.92)`): the basemap printed as its negative, which the
  house allows for a picture with one appearance (HOUSE 3.2); it is not chrome.

---

## 3. The chrome, object by object

HOUSE 4.0's row for *panes from a pull*: panes as tabs; no key column; a caption band per pane
(legend, caption line, credits); no player (a pane may plot time on an axis); a readout card for a
tapped bar, hour or item; no focus mode. Every kind carries the header, About, notices and the live
region, the motion rules, landscape and safe areas.

### The frame

Now, at 390 × 844, on the evening of the pull (the clock at 30 Sep 2026, 21:00 in Copenhagen; heights
in CSS px, safe-area insets outside them; from the next day the stamp and the week's words read as
"When the phone has moved past the data" says):

```
┌──────────────────────────────────────────┐
│ Running Dashboard                        │ 22  the name, 15/650
│ Updated 20:20, last session 30 Sep       │ 16  the stamp, 11.5, --ink-2 (opens About)
│ Now  Plan  Training  Health  Sessions    │ 44  the panes as tabs; the tracer under the chosen
├──────────────────────────────────────────┤ ── the pane scrolls from here down, inside the frame
│                Copenhagen Half …, 1 Nov│ │ 14  the race's name over its day
│ ▇ ▇ ▇ ▇ ▇ ▇ ▅ ▇ █ █ ▆ ▄  ┌┐ ┌┐ ┌┐ ┌┐      │ 64  the Block: ink cut into runs, then outlines
│ Jul 2026     Aug       Sep          Oct  │ 14
│ Weeks of running to Copenhagen Half      │ 30  its caption, 11 px, two lines
│ Marathon: ink is a run, an outline the … │
│ This week, 28 Sep to 4 Oct       24.0 km │ 59  the one large figure 21/600, 14 px of air
│                         of 62 km planned │     above it; the week at its left
│ On track. Eleven weeks in, the block …   │     the verdict in --ink 620, the headline in prose
│ What to do next                          │     a section's heading, 13.5/650
│ On track. Sharpen this week, one last …  │     the plan's tone and headline
│ [Open the plan]                          │ 44  a framed text key
│ Run, last 7 days         50.1 km, 5 runs │     the facts as label: value rows
│ …                                        │
├──────────────────────────────────────────┤ ── fixed: the caption band
│ Updated 30 Sep, 20:20. Evaluation and    │ 30  the pane's caption line, two fixed lines
│ plan written 30 Sep.                     │
│ Data: Garmin Connect. Coaching text: …   │ 15  the credits, word for word
└──────────────────────────────────────────┘
```

- **The frame.** `body` is a column of three: the header, the pane (`<main>`, `flex: 1 1 auto;
  min-height: 0; overflow-y: auto; overscroll-behavior: contain`) and the caption band; the page is
  `100dvh` and never scrolls itself (HOUSE 4.1: *a pane app scrolls its pane's content inside the
  frame, so the header and the caption band stay put*). The pane switch, a same-pane re-render (which
  keeps the reader's place) and the session pick move the pane's own `scrollTop`. Content is one
  column, at most 760 px wide, centered on wide screens; gutters 16 px plus the safe-area inset,
  20 px from 700 px of width. No rule under the header; the caption band has a 1 px `--line` rule on
  top. The page never scrolls sideways at 320 px or at 125 % text zoom.
- **The header.** The name, `<h1 translate="no">Running Dashboard</h1>`, 15 px, 650, 22 px line. **The
  stamp** under it, a `<button>` with `aria-haspopup="dialog"`, described as *Opens About this data.*,
  its hit 44 px tall running up over the name, which is not a control, and down into the gap above the
  tabs (22 + 16 + 6 px; running further down would land on the tabs, which take the tap): `Updated
  20:20, last session 30 Sep` on the day of the pull, `Updated 30 Sep, 20:20, last session 30 Sep` on
  another day (`pulledAt` when the snapshot has it, else `generatedAt`; the clock built by hand in
  `js/units.js`, 24-hour, day before month, the same on every locale). **Stale** when the snapshot is
  more than 48 hours old (the threshold `NOTES.md` states as two days): the stamp leads with `Stale.`
  in `--ink` and the rest stays `--ink-2`: `Stale. Updated 30 Sep, 20:20, last session 30 Sep` two days
  on (`shoot.mjs`, the clock at 3 Oct, 12:00). The watch-sync time and the other instants are in About
  (`This data`). While loading: `Reading the data…`. **No units key**: everything is SI
  (`tools/DECISIONS.md`, owner call 1, with the cost of a US switch).
- **The row of tabs: the panes.** `Now`, `Plan`, `Training`, `Health`, `Sessions`, each a `<button
  role="tab" aria-selected>` in a `role="tablist"` named `Panes`, the arrow keys moving between them, 12.5 px,
  400 `--ink-2`, the chosen 620 `--ink` with the house tracer under it (a 2 px line as wide as the word
  plus 4 px, transparent to `--ink`, ending in a 4 px disc; drawn in over 160 ms on `--draw` by
  `clip-path`), each a 44 px-tall hit, 16 px apart, the row scrolling inside itself if it must. The
  pane is a `role="tabpanel"` labeled by the chosen tab. **The tabs are built by `buildTabs()` after
  the snapshot parses**, never in the static markup: the marketing camera waits for the button
  `Health` as its proof that the data loaded (section 5).
- **The pane's own controls** (Training, Health, Sessions): the first rows of the pane, scrolling with
  it, so the frame's fixed bands stay three:
  - *The window*: `3 months`, `6 months`, `1 year`, `All` as words, `aria-pressed` buttons in a
    `role="group"` named `Time window`, 12.5 px, the tracer under the chosen, 44 px hits; at the row's
    right, the window in words, `12 Jan to 4 Oct 2026` (12.5 px, `--ink`).
  - *The window's track*: two native range inputs (accessible for free) in the house's slider
    language: a 1 px `--line-strong` baseline, the chosen window in 2 px `--ink`, each thumb a tracer
    head (an 8 px `--ink` disc with a 3 px `--page` ring and a 1.5 × 18 px `--ink` rule through it,
    10 px while pressed), the input 44 px tall so the thumb's hit is 44 × 44; no accent, no shadow.
    Named `Start of window` and `End of window`.
  - *Sport and equipment*: native `<select>`s set as word keys: 12.5 px `--ink` at 560 in a 1 px
    `--line-strong` frame, 6 px radius, 44 px tall, no chevron glyph and no fill. Named `Activity
    type` and `Equipment`. Whether iOS zooms the page when one is focused (its text is under 16 px) is
    a phone check (`tools/DECISIONS.md`).
- **Sections, not cards.** Each chart is a section on `--page`: a 1 px `--line` rule above it (none
  above the first), 16 px padding top; its heading at 13.5 px 650 in sentence case. A pane's group
  heading (`Running`, `Load`, `Heart` on Training; `Today`, `Recovery and trends` on Health) is an `h2`
  at 15 px 650, sentence case, and the sections under it are `h3`, so VoiceOver's heading rotor keeps
  the groups; on a pane without groups the sections are `h2`.
- **Under each chart**, in this order: the legend; the caption line (11 px, 15 px line, `--ink-2`,
  what one bar or point is, in the data's words); `How to read it` and `Show the table` as text keys
  (12.5 px `--ink-2`, 44 px tall, sentence case). `How to read it` is a `<details>` whose `<summary>`
  is those words; its body is 13.5 px, line height 1.5, `--ink-2`, at most 62 characters wide. `Show
  the table` turns to `Hide the table`.
- **The legend** of a chart: swatches 8 × 8 px, square, a line series 16 × 2 px, labels 10.5 px
  `--ink-2`, 12 px apart; the route ramp's legend is the bar described in section 2 with its ends
  printed (`slower ≥ 5:55 /km`, `faster ≤ 5:10 /km` for the demo's easy run of 29 Sep; `≤ 173`, `≥ 183
  spm` for its cadence: the ends are the session's 5th and 95th percentiles, or the minimum span around
  its median when those lie closer, as on this steady run; printed open because the colors clip there).
- **Charts.** Every axis and tick label 10.5 px, `--ink-2`; the unit caption above the plot 10.5 px
  `--ink-2` at 400; bars square-topped; ticks and numbers through `js/units.js`. Planned bars,
  wherever they are (the day charts, the load chart, the plan's zone bars), are drawn in outline: each
  segment a 1.5 px stroke of its token, inset, no fill, 1 px gaps between segments, a segment under
  3 px drawn as a 1.5 px line. The planned four-week average is `--ink` dashed 5/4 on its casing, the
  actual one solid.
- **The facts** (eight on Now, the app's four and the evaluation's own four; four on Today; six on
  Health; up to sixteen in a session, as on the easy run of 29 Sep; the race day, distance and goal on
  Plan): a `<dl>` of rows, each a label at 12.5 px `--ink-2` at the left and the value at 12.5 px
  `--ink` 560 right-aligned, with the note after the value in `--ink-2`, joined by a comma (`Run, 28
  days to 30 Sep`, then `253.9 km`, then `12 % more than the 28 days before, 0.5 km walked`; on the
  evening of the pull the label is `Run, last 28 days`), or by a space when the note begins `per` (`7.7
  h per night`); three cells of one row, wrapping under on a narrow screen, rows parted by 1 px
  `--line` hairlines; two columns of rows from 560 px. A label is the quantity in words, beside its
  value, never above it. A session's `Body battery change` is Garmin's change over the session, signed.
- **The one large figure** (at most one per pane, 21 px, 600, tabular, set at the row's right): Now,
  this week's running kilometers (`24.0 km`, the lead `of 62 km planned` in 12.5 px `--ink-2`, and the
  week in words at the left, `Week of 28 Sep, data to 30 Sep`, or `This week, 28 Sep to 4 Oct` on the
  evening of the pull); Plan, the days to the race (`31 days`, the lead `to Copenhagen Half Marathon, 1
  Nov, 09:30`); Sessions, the chosen session's distance, or its time when it has none (`11.2 km`, the
  lead `56 min, 4:54 /km`). Training and Health have none: their charts are the subject. The readout
  card's value is the screen's figure while the card is open.
- **The verdict and the plan's headline**: no pill, no gradient. The tone is a word (`On track.`,
  `Watch.`, `Act now.`, `Stop.`, `Note.`) at 13.5 px, 620, `--ink`, leading the data's headline set as
  prose at 13.5 px, line height 1.5, `--ink`. The same for the plan's tone, a section's tone in the
  evaluation folds, and a session note's tone. The word carries the tone; color never does.
- **The race predictions table**: 12.5 px, tabular; headers 11.5 px 600 `--ink-2` in sentence case
  (`Distance`, `Garmin`, `Agent`, `Difference`); the difference in `--ink` with its sign (`−0:15`,
  `+0:20`), in no color.
- **The sessions list**: rows on `--page`, at least 52 px tall, separated by `--line` hairlines; the
  chosen row on the on-plate; the date in 12.5 px `--ink-2` (`Wed 30 Sep`, the year under it only when
  it is not this year), the name 13.5 px `--ink` 600, under it `Run, 56 min, 157 bpm` in 12.5 px
  `--ink-2`, at the right the distance 12.5 px 560 with the training effect's word under it. The sport
  swatch (8 px square in its token) stands before the name; the word after it carries the sport. The
  list scrolls inside itself (at most 46 % of the screen's height).
- **The plan's week rows**: the day, the session's words at 13.5 px 600, the kind as a word in 11 px
  `--ink-2` (sentence case; `done` and `missed` in `--ink`), the stats in 12.5 px `--ink-2`, the kind's
  8 px dot in its token. A missed session says `missed` in `--ink`, at full opacity. A session after
  the last day the data saw is planned, never missed. Planned zone bars in outline.
- **The readout card** (HOUSE 4.7). The one card on the screen: `--sheet`, a 1 px `--line-strong` edge,
  an 8 px radius, no shadow, at most 280 px wide, 10 px padding. It sits inside the chart's box,
  top-left, inset 8 px, and keeps 12 px clear of what was tapped, so the marker is never under its own
  card. When the tapped column or point is under it, it moves to the top-right: a column runs the
  plot's height, so only a move sideways clears it, and the card makes that move first on every chart.
  When the top-right would hold the point too (a card wider than half the chart: the route's is 222 to
  257 px of 358), it moves to the bottom-left, as the house's card does. Where no corner keeps it clear (a
  column under both top corners, a point near the middle of a plate less than twice the card's height),
  and where the chart is shorter than the card (the Block on Now, the status strip, a mini spark line),
  it hangs from the chart's foot over what follows, or over the chart's head when the pane has no room
  below it; the route's plate clips its tiles, not its card, so it hangs there too (`shoot.mjs` taps
  twenty points along the route of 29 Sep and fifteen columns of Training's first chart, and finds none
  under its card). Its first line, 12.5 px `--ink-2`, is the place (`Week of 14 Sep 2026`, `Wed 30 Sep
  2026`, `Lap 4`, `35:24 into the session, 6.4 km`), with ✕ at its right: an SVG drawn inside a 44 × 44
  button named `Close`. Then the value, 21 px 600, its unit at 13.5 px `--ink-2` after U+202F. Then a
  `<dl>` of rows at 12.5 px: labels `--ink-2` left, values `--ink` 560 right. Every chart hands it an
  object `{ place, value, unit, rows: [[label, value]…] }`, and one `showCard(wrap, card)` writes it as
  text nodes, **updated in place** while a finger slides, never rebuilt per move. In: 120 ms opacity
  and a 4 px rise on `--draw`; out: at once.
  - **How a chart answers a touch** (`readout()` in `app.js`). A mouse or a pen reads on the press, and
    a mouse hover shows the card when nothing is pinned. A finger waits to show what it is: lifted
    where it landed, it is a tap, which opens and pins the card and announces it once, in words
    (`spoken()`, below); slid sideways more than 8 px (and more across than down), it is a scrub, which
    opens the card and moves it with the finger, and says nothing; moved up or down, it is a scroll:
    the browser takes it (every chart is `touch-action: pan-y`), and no card opens and nothing is said.
    A tap elsewhere or ✕ closes a pinned card. Every chart fills the column, so a scroll that starts
    on one is the common case, not an edge.
- **The route map** (Sessions): a plate of its own, 8 px radius, `--sheet` behind the tiles. Its modes
  (`Heart-rate zone`, `Pace`, `Speed`, `Cadence`, `Power`, `Elevation`) are words with the tracer. A
  vertical swipe across it scrolls the pane; a tap or a sideways slide reads points along the track.
  The tile credit is in the map section's caption line, word for word from `TILE_CREDIT` (`USGS The
  National Map`, `© Kartverket`, `© OpenStreetMap contributors`), after the sentence that says how the
  route is colored, and, under a route drawn from the template's own courses, `Route: © OpenStreetMap
  contributors, ODbL.` The distance window's two thumbs take the house slider language; the elevation
  profile (also `pan-y`) draws the window as an `--amount` area at 16 % under a line in the route's own
  colors, so the profile and the map read as one, the rest in `--ink-3` at 60 %; its marker the house
  cursor disc. The range label: `Whole session, 12.8 km, up 21 m, down 20 m` (the easy run of 29 Sep,
  the newest session with a route).
- **Rows of words.** Every row of choices (the load unit `Zone time`, `Aerobic`, `Muscle`, `Sport
  time`; `Share of time`, `Minutes`; `Color by stroller`, `Color by shoe`; `By time`, `By distance`;
  `Every sample`, `Smoothed`; the map modes) is a row of words: 12.5 px, 400 `--ink-2`, the chosen
  620 `--ink` with the tracer under it, `aria-pressed` buttons in a named `role="group"`, as Global
  Weather's layer words, each its own tab stop; the one on/off word, `Pace by heart-rate zone`, is a
  lone `aria-pressed` button. 44 px hits, 16 px apart, scrolling inside themselves on a narrow screen.
- **Text keys** (`Open the plan`, `Open in Sessions`, `Show the table`, a notice's `Close`): 12.5 px
  `--ink`, 44 px tall, a 1 px `--line-strong` frame 28 px tall, 6 px radius, no fill; pressed,
  `currentColor` at 22 %; hover only under `@media (hover: hover)`, at 7 %. Every button is
  `type="button"`.
- **Disclosures** (the evaluation's sections, `About this plan`'s folds, `Why the numbers differ`, a
  session row): the `<summary>` at 13.5 px 600 `--ink`, a 1.5 px drawn chevron that turns at once, no
  transition.
- **The caption band** (fixed, at the foot; HOUSE 4.5, *a pane app: the band closes each pane*): on
  `--page`, a 1 px `--line` rule on top, 16 px gutters plus the safe area, padding-bottom the bottom
  inset. Two things: **the pane's caption line**, 11 px, 15 px line, `--ink-2`, **fixed at two lines**
  whatever it says, saying what the pane is showing: Now `Updated 30 Sep, 20:20. Evaluation and plan
  written 30 Sep.`; Plan `The plan the coaching routine wrote on 30 Sep, to Copenhagen Half Marathon
  on 1 Nov.`; Training `Weeks of 12 Jan to 4 Oct 2026, all sports, any equipment.`; Health `Weeks of
  12 Jan to 4 Oct 2026. Today is the last 24 hours the watch handed over.` (Health has no sport or
  equipment filter); Sessions `248 sessions in the window, all sports, any equipment, newest first.`
  The window and the filters are in words, so the scope is on screen while the controls have scrolled
  away. Then **the credits**, 10.5 px `--ink-2`, one constant, on screen on every pane: `Data: Garmin
  Connect. Coaching text: the coaching routine.` One verb names the instant the data was made, in the
  stamp, the caption, About and the notices: *Updated*.
- **The player: none.** No time to scrub. The session curves, the 24-hour charts and the route keep
  their slide-to-read readout.
- **About** (below), opened from the stamp.
- **Notices and the live region.** A problem with the data is a sentence on a `--sheet` plate, a 1 px
  `--line-strong` edge, 8 px radius, 13.5 px `--ink`, at most 300 px wide, centered in the pane, no
  icon, no colored frame, `role="alert"`. It says what is wrong in the file's terms:
  `data/snapshot.json could not be read (HTTP 404).`, `data/snapshot.json is not valid JSON; it looks
  like a web page was written over it.`, `data/snapshot.json is not the shape this app expects:` with
  the validator's lines under it at 12.5 px `--ink-2`, then `The file begins:` and its first 240
  characters in the house face, then the hint sentences (the dead token, the Shortcut). **A broken
  replacement keeps the data that was showing**: when a return to the app reads a new file that fails,
  the pane, its scroll and its card stay, and the plate, fixed over the pane, says `The new
  data/snapshot.json is not valid JSON; it looks like a web page was written over it. Still showing the
  data from 30 Sep, 20:20.` with a `Close` key that puts it away (a dead token can stay dead for days;
  the stamp keeps saying how old the data is). One polite live region, `<p class="sr"
  aria-live="polite">`, for sentences: a tapped card's words, a pane's name when a tab is chosen by
  keyboard. `<main>` is not a live region.
- **A return to the app** (`visibilitychange`) reads the snapshot again. The same file on the same day
  redraws nothing, so the pane, its scroll and every open fold stay as they were (only the stamp is
  rewritten, so `Stale.` appears on time); a new file, or a new day, re-renders the pane in place and
  keeps its scroll and its open folds, each known by its words and its place among folds with the same
  words (`shoot.mjs` serves the pull an hour later and finds three folds and the scroll kept). A
  filter, a unit or the theme re-renders the pane the same way.
- **Focus mode: none** (HOUSE 4.0). The panes are reading, not a view.
- **The opening: none.** No entrance on any pane.
- **Landscape** (`(orientation: landscape) and (max-height: 500px)`): the header is one 46 px row, the
  name over the stamp at the left and the tabs at the right; the caption band one line of caption and
  the credits beside it; the pane scrolls between them.
- **Safe areas**: the header `6 px + top` and `16 px + left/right`; the pane's content `16 px +
  left/right`; the caption band `16 px + left/right` and `bottom`; the readout card stays in the pane's
  column; About's head `top`, its body `16 px + bottom`.

### When the phone has moved past the data

A snapshot can stay unrefreshed for days (`NOTES.md`: a Garmin change breaks the pull until the
library catches up). Whatever counts back from today then stops at the last day the data saw, the
phone's date capped at the day of the pull (`todayIso()`), and says so: on Now the figure's words
become `Week of 28 Sep, data to 30 Sep` and the facts `Run, 7 days to 30 Sep` and `Run, 28 days to
30 Sep`; the Block's last ink column is the pull's week, the columns after it are the plan's; the
plan's day charts mark the pull's day `updated`, not `today`, and a session after it is planned, not
missed; Today's facts on Health carry their day (`at 30 Sep, 19:00`). Race day still counts from the
phone, because that is calendar arithmetic, as does a session's year in the list and `days ago`.
`shoot.mjs` drives the app with the phone 21 days past the data and checks each.

### Spoken forms

VoiceOver hears words, not symbols. `spoken(text)` in `js/units.js` expands the app's own unit and
date forms in a card's text before it reaches the live region: `km` kilometers, `/km` per kilometer,
`km/h` kilometers an hour, `m/s` meters a second, `bpm` beats a minute, `spm` steps a minute, `min`
minutes, `h` hours, `m` meters, `ms` milliseconds, `kJ/kg` kilojoules per kilogram, `W` watts, `kg`
kilograms, `%` percent, `°C` degrees Celsius, `22 Sep` 22 September, U+2212 minus, U+202F a space.
The sentence is the card's place, value and rows joined with periods. A session's wind is in m/s in
both places it is written (the weather and the headwind).

### About

A full-height `--sheet` panel that slides up over 220 ms on `--sheet-in` and closes at once:
`role="dialog"`, `aria-modal="true"`, labeled by its title `About Running Dashboard` (15 px, 650);
`Close` at the top right and again at the foot; Escape closes it; the rest of the page is inert while
it is open; focus returns to the stamp; `overscroll-behavior: contain`. Sections at 13.5 px 650
sentence case separated by 1 px `--line` rules; prose 13.5 px, line height 1.5, at most 62 characters
wide.

1. **What the Block is.** The Block in prose: one column a week from twelve weeks back to the race;
   one block of ink per run's running, walk breaks out; an outline is the plan's week as the coaching
   routine wrote it on the plan's date, a range drawn to its top with a tick at its bottom; this week
   both; past weeks without outlines because the data keeps only today's plan; the fixed scale (0.8
   pixels a kilometer on Now, 1.2 on Plan, a line every 20 kilometers); weeks Monday to Sunday by the
   phone's calendar; other sports on Training.
2. **This data.** `label: value` lines, no middle dots: `Updated: Wed 30 Sep 2026, 20:20 (UTC+2)`,
   `Snapshot built:` (only when the snapshot carries the pull's own time as well), `Watch last synced:` (the newest
   intraday sample), `Sessions: 248, 12 Jan to 30 Sep 2026`, `Full detail kept since:`, `Evaluation
   written:`, `Plan written:`, `Race forecast written:`, `Map tiles on this phone:`, `Stale after: 48
   hours`.
3. **How the numbers are made.** Running against walking (the watch's run/walk detection); zone load
   (Edwards' TRIMP, minutes in zones 1 to 5 weighted 1 to 5) and Garmin's own load beside it; muscle
   load (the method `app.js`'s `MUSCLE` comment states, its two judgment calls named); kilometers by
   zone (the record stream when present, else laps, else time in zone); the ramp ratio; the efficiency
   index; and the route's colors: *A route is colored between its own 5th and 95th percentile of the
   quantity chosen, so the colors compare stretches of this session with each other, never one session
   with another; the legend prints the two ends. Ends closer than 45 seconds a kilometer, 4 kilometers
   an hour, 10 steps or turns a minute, 30 watts or 20 meters are spread that far around the median, so
   a steady run reads steady.*
4. **Sources and credits.** Garmin Connect's data, the runner's own account, through the pull; each
   map's tile source and its terms (USGS public domain with its requested acknowledgment word for word
   from `TILES.md`; Kartverket CC BY 4.0 and OpenStreetMap's credit for a copy that fetches its own);
   any address printed without its scheme; where the snapshot's sessions follow the template's own
   courses (ids `demo-…`, the generator's rule), `Routes: © OpenStreetMap contributors, under the Open
   Database License 1.0 (opendatacommons.org/licenses/odbl/1-0); the route shapes in these sessions
   are derived from it.` (a license requirement; the word demo never appears on screen); then `Type:
   Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in
   fonts/ with its license.`
5. **How the data gets here.** The scheduled pull, the Shortcut that carries the snapshot in, the app
   reading it again whenever it comes back to the screen, the coaching routine that writes the
   evaluation, the plan, the race forecast and the session notes; and that the app itself reaches no
   network.

---

## 4. Type

- **The house face, byte for byte**: `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
  `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
  sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copies of
  `global-weather/fonts/`, never rebuilt or renamed. The one `@font-face` rule word for word (HOUSE
  2.5), `font-display: block`, the family used only through `--face`. The app carries no other face,
  no monospace stack and no serif.
- **One supplement, for ₂ alone** (HOUSE 2.3): `VO₂ max` (the Now facts, the VO₂ max chart's title and
  axis, the training-effect word, a table head) and `SpO₂` (the oxygen chart's axis) need U+2082, which
  the house cut lacks and the upstream draws. The file:
  `fonts/ysabeau-office-running-dashboard-extra.woff2`, **1 216 B, sha256
  `f9937497336f4bf70c2728bc020588ebdb2a952acdf7dc5e96f14b8377583268`**, built twice byte-identically on
  2026-10-02 (`cmp` silent) by Milky Way's recipe with only the code points changed:
  `tools/art/font_extra.py` is `milky-way/tools/art/font_extra.py` with `UNICODES = 'U+2082'` and `OUT =
  'fonts/ysabeau-office-running-dashboard-extra.woff2'`; run from `Template/` in a venv with fonttools
  4.60.2 and Brotli (`python running-dashboard/tools/art/font_extra.py`); it reads the pinned upstream
  from `global-weather/tools/.work/font/` when it is there (sha256 `0f305c84…5d360`, 401 964 B,
  google/fonts commit `9710da1eacb3be272583c3224dcb70f9da6eadbb`). Declared as a second rule of the same
  family: `@font-face { font-family: 'Ysabeau Office'; src:
  url(fonts/ysabeau-office-running-dashboard-extra.woff2) format('woff2'); font-weight: 400 650;
  font-display: block; unicode-range: U+2082; }`. `OFL.txt` covers both files and stays byte-identical;
  `NOTES.md` records the supplement's code point, command and sha256; `check.mjs` pins it.
- **Characters the cut lacks** are not written: no drawn-glyph chevrons, circled i, Greek capital delta, arrows or `≈` (a sentence says
  `about`; the race table's head says `Difference`; the route's climb says `up` and `down`). The data's
  strings use `—`, `–` and `×` only, all in the cut. `check.mjs` fails on any of them in shipped text.
- **The scale** (HOUSE 2.5): 10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 / 21 px, weights 400, 560, 600, 620,
  650; nothing larger than 21 px; no capitals, no letter-spacing; sentence case for every label and
  button. Body text 13.5 px / 1.35. `font-variant-numeric: tabular-nums lining-nums` on `body`. SVG text
  inherits the face from the page; there is no canvas text.
- **The credit line** word for word in About (prefixed `Type: `), in `NOTES.md` and in `TILES.md`.

---

## 5. The camera's strings

HOUSE 7.4's row for this app: the camera waits for **a button named `Health`** (the panes are built
after the data parses) and taps **the panes `Now` and `Health`, as buttons by name**
(`MarketingShotsUITests.swift` lines 288-299 and 327-332; `MarketingClipsUITests.swift` lines 241-242;
`selectPane` in `MarketingCameraCase.swift` lines 196-200).

| String | Role | Kept? |
| --- | --- | --- |
| `Health` | `<button role="tab">`, built by `buildTabs()` after the parse | kept, text and role and timing |
| `Now` | `<button role="tab">` | kept |

**The camera needs no change.** Two things must not break: the tabs stay out of the static markup
until the snapshot has parsed (the wait is the camera's proof of data), and the loop clip's slow drag
from 75 % to 35 % of the web view's height on Now (`MarketingClipsUITests.swift` lines 244-247) must
scroll the pane: at 844 px the drag starts at 633 px, inside the pane's scroller and above the caption
band, so the pane, not the page, scrolls, and no card opens even where the drag starts on a chart
(`shoot.mjs` drives it by real touch). The app remembers its pane (`running-dashboard.ui.v3`); the
camera selects `Now` first, so nothing has to be put back. No string is British; no remembered focus
mode exists.

---

## 6. Budget

*Measured* 2026-10-02 by `node tools/check.mjs`: the ZIP by `build-zips.yml`'s own command, `zip -q -r
-X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`, then its
size; code by the size of every shipped `.html`, `.css` and `.js` outside `data/`.

| | As built | Cap | Rule |
| --- | --: | --: | --- |
| App code | 244 937 (`app.js` 203 328, `style.css` 20 866, `index.html` 7 501, `js/block.js` 6 857, `js/units.js` 5 956, `js/palette.js` 429) | **245 000** | the lead's ruling (plan 0011 D24), the reasons in `tools/DECISIONS.md`; 63 B to spare, so anything the app gains, it pays for |
| Fonts | 41 291 (the house's 40 075 and the supplement's 1 216) | 160 000 | |
| ZIP | about 1 074 300 (this file ships inside it, so its own figure moves the last digits; `check.mjs` prints the exact size) | **1 340 193** | the size before the pass × 1.25, rounded down; no face allowance: an app that swaps its own face for the house's gets none |
| Data | 37 files, sha256 of the concatenation in sorted path order `37973fe9069081a8814e4621069ba84fa03820ac0efc6fa73406c6d04ecf180e`; `data/snapshot.json` `7c6084b9b216232ddd56def183fdf9b16301d1b5879e04c0ee8a0ef092eb849d` | byte-identical | `check.mjs` pins every file's own sha256 |

---

## 7. The generated-page tells, answered

| Tell | Here |
| --- | --- |
| 1. A warm cream ground, a serif display, a terracotta accent | the film base `#e8eef0`; one Renaissance sans; no accent: warm hues are zones, sports and the route's ramp only |
| 2. A near-black ground with one acid accent | the slate print `#141d21`; no accent; the bright thing is the Block's ink |
| 3. Broadsheet hairlines, zero radius, dense columns | one column, hairlines between sections only, radii by role (6, 8, 4, 0) |
| 4. The SaaS-card kit | no card but the readout and About; sections between hairlines; no shadow; no gradient but the route's legend; single-quantity charts in one quiet slate, not a kit of hues |
| 5. ALL-CAPS tracked eyebrow labels | none: sentence case, `letter-spacing` 0, no label above a value |
| 6. Meta strings joined with middle dots | commas and sentences; the credits constant has none |
| 7. "WORD — fragment" with a spaced em dash | none written by the app (`1.5, a spike`, `Road shoes A, 691 km`); the coaching text's own dashes are data and stay |
| 8. A tinted near-black standing in for black | ink `#0f1c23` used as ink; the dark page a slate at L 0.224 |
| 9. A monospace face for small data labels | none; the house face's figures are tabular |
| 10. An arrow appended to links and buttons | none anywhere; `check.mjs` fails on it |
| 11. One word accented in a headline | none; the tone word leads the headline in weight, not color |
| 12. Unnecessary labels above content | labels beside values in rows; group heads are headings, in sentence case |
| 13. Numbered markers | none |
| 14. A big number, a small label and a gradient accent | at most one 21 px figure per pane, the subject's own; no gradient |
| 15. Fade-and-slide entrances, hover on every card | no entrance; the card's 120 ms fade answers a touch; hover only on controls, only under `(hover: hover)` |

The web interface guidelines apply as written but for the house's own rules (HOUSE 9): sentence case,
dates by hand rather than `Intl`, `font-display: block` for the local face, `translate="no"` on the
app's name and on Garmin's status words as the data gives them.

---

## 8. Where the record is

The pass's working record is `tools/DECISIONS.md`, which does not ship: the lead's rulings, the change
list and the owner calls as the art direction left them, the departures as built with their reasons,
the QA, review and follow-up answers, the earlier text of this file word for word, and the phone checks
this app needs.
