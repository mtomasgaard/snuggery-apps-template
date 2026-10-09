# Running Dashboard: art direction

`NOTES.md` says where the data comes from and how the pieces fit; `PROMPT.md` sets a copy up. This
file says how the app looks, moves and speaks under the template's house system
(`Template/HOUSE.md`, the brief; Global Weather is the reference) and its pane-app register (HOUSE 11,
plan 0012: the week's kilometers as the key number, sections on plates, the tone in its color, tiles, a
key in place of a how-to-read sentence, method sentences in folds, credits in About; Finances is the
register's reference). It was the first of HOUSE 4.0's *panes from a pull* to take the house, so what it
settled for a pane app (the frame that scrolls inside itself, the readout card inside a chart, the plan
drawn in outline around a light fill, a finger that scrolls without opening cards, the filters held
under the tabs) is the pattern the pane apps after it follow.

The record of the pass (the lead's rulings, the owner calls, the departures as built, the QA, review and
follow-up answers) is in `tools/DECISIONS.md`, which does not ship (section 8).

**Every figure here was measured on 2026-10-02, those of the owner's six on 2026-10-03 and those the
register changed on 2026-10-08,** and names the command that printed it. The commands
run from `Template/running-dashboard/` unless they say `Template/`. `python3
running-dashboard/tools/art/palette.py` (from `Template/`) prints every color and contrast and ends
`ALL CHECKS PASS`. Pictures from `tools/shoot.mjs` (headless Chromium, 390 × 844, DPR 2, real touch,
both themes) are evidence of what the page draws, never of how a phone feels. The screen's words quoted
here were read in that browser with the clock where `shoot.mjs` fixes it, 1 Oct 2026, 12:00 in
Copenhagen, the morning after the demo's pull, unless the text names the evening of the pull (30 Sep,
21:00).

---

## The look: the house, with one bold thing of its own

- **Sections on plates** (HOUSE 11.1 rule 4). Each pane is one column on `--page` whose sections sit on
  plates: `--sheet`, a 1 px `--line` edge, radius 8 px, padding 12 px, 12 px apart, headed in the house
  face at 15 px 650; each chart with its legend, at most one short label of one line that says what one
  bar is, and a `How to read it` disclosure holding every longer sentence. No shadow.
- **Color only where it is a category.** Garmin's zone hues, the sports, the shoes and Garmin's
  training statuses keep their identities, fitted into a lightness band per theme (section 2). A chart
  of one quantity (weekly kilometers, sleep, steps, floors, calories, HRV, VO₂ max, weight) wears no hue
  of its own: it is drawn in `--amount`, a quiet slate, so Training and Health read as instrument
  plates and every average line is ink on a casing.
- **The plan is drawn in outline, everywhere, around a light fill.** What was done is filled; what the
  plan asks is a 1.5 px outline of the same shape around a light fill (section 2, "The plan's tint"), so
  the plan can be seen and done still reads apart from planned. The Block (section 1) is where that rule
  is born; the running and time-in-zone charts on Plan, the day charts and the plan's zone bars follow it,
  so a reader learns it once.
- **Color with one meaning each** (HOUSE 11.1 rule 5, 11.3): `--done` a run done (the Block's runs, the
  week's bar on Now), and the tone of the coaching text in its word alone, `--up` on track, `--watch`
  watch, `--down` act now and stop. Never the only carrier: the word is always there.
- **The key number** (HOUSE 11.1 rule 2): Now opens on the week's running kilometers at 34 px against
  the plan; Plan on the days to race day; a session on its distance or time.
- **One bold thing: the Block** (section 1), the training block as a coach's sheet, weeks of running
  in `--done` with the weeks still to run as pale outlines up to race day.
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
| **Running Dashboard** | **the Block** | **weeks, twelve back to race day** | **each run's kilometers, and the plan's target per week** | **under Now's facts; the head of Plan** | **ink columns cut into runs, then pale outlines** |

The one family resemblance is Shelf Atlas's Peaks, where an outline is a reference and the fill is
now. There the reference is a record behind the disc (the field's best month); here it is an
intention ahead of the ink (the week the plan asks for), and the outline holds only a pale tint until
the runner fills it with ink. It is the only signature in the template that draws the future as something a person is
going to do rather than something that will happen to them.

---

## 1. The signature: the Block

**What it is, in one paragraph a stranger would get.** A coach plans a race as a *block*: sixteen
weeks or so of running drawn up on one sheet, the weekly distance climbing through a build with an
easier week every few, peaking, then tapering into race day. Runners pin that sheet to the fridge and
fill it in. Running Dashboard draws the sheet on its first pane, under the week's figure and the morning's
tiles. Each week is a column. The weeks already run are solid `--done` blue, cut into one block per run, so a week of six runs shows
six pieces with the long run the tallest. The weeks still to come are pale outlines as tall as the plan
asks, ending at the race, named over its week. This week is both: an outline of what the plan wants,
with this week's runs filling it from the bottom, a block at a time. A glance says how far into the
block you are, what the shape of it has been, how much of this week is left, and how many weeks
until the start line.

**What a stranger remembers** is the pale boxes. The demo's Block (`node tools/test_block.mjs`
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
   Block sits on the first scroll, under the week's figure and the tiles of the morning's figures the
   owner asked to read first (2026-10-03), and answers all three.
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
4. *Can it be drawn with the house's means?* Yes: `--done` blocks and 1.5 px `--ink-2` outlines around a
   14 % `--ink-2` fill on its plate, `--line` hairlines, 10.5 px labels in the house face, no motion at
   all.

**The rule it is drawn by** (`js/block.js`, pure; `tools/test_block.mjs` proves it):

- **The weeks.** Let `this` be the Monday of the last day the data saw: the phone's date, never earlier
  than `dataThrough` and never later than the day of the pull (`todayIso()` in `app.js`). The columns
  are the eleven Mondays before `this`, `this`, and every Monday after `this` in `plan.horizon[]` (in the
  demo four, to 26 Oct; up to 26 when a plan reaches further). Without a plan, or with a horizon that
  ends before `this`, the columns are the fifteen Mondays before `this` and `this`: runs only. So a stale
  snapshot never draws weeks the data has not seen as empty weeks of running.
- **The ink.** For each column up to and including `this`, every activity with `sport === 'run'` whose
  date falls in that week contributes one block of `runKm(a)` (the running inside the session, walk
  breaks out, as every running figure in the app is), stacked from the baseline in date order and,
  within a day, start-time order (`a.t`), in `--done`. Height = km × the scale; a 1 px gap of the plate
  separates blocks; a block under 1 px is drawn 1 px. No other sport is drawn: the Block is running
  kilometers, as its key says.
- **The outline.** For `this` and each later column, the plan's target: `horizon[i].km` for that Monday.
  Drawn as a 1.5 px `--ink-2` stroke inset by 0.75 px so its outer edge is the column's edge, square
  corners, around **the fill**: `--ink-2` at 14 % over the plate (HOUSE 11.1 rule 7; `#dde2e4` light,
  `#2f3a3f` dark),
  from the outline's top down to the ink, so only the part of a week still to run is tinted: a planned
  week whole, this week above its runs (31 px of the 50 px outline on Now in the demo, over 24.0 km), a
  week run past its target not at all (the owner asked to see the plan, 2026-10-03). Where `plan.weeks[]` gives the same week a range (`targetKm` like `26–30 km`), the
  outline runs to the upper value and a 1 px `--ink` tick crosses it at the lower value; the readout
  prints the range as written. A week before `this` never has an outline: past plans are not kept in
  the data, and the Block does not invent them (About says so).
- **The scale** is fixed and printed: **0.8 px per km on Now, 1.2 px per km on Plan**, from a
  baseline. The plot is as tall as the larger of 80 km and the tallest column (ink or outline) rounded
  up to 20 km; 1 px `--line` hairlines at every 20 km behind the columns, their values in a 30 px
  gutter at the right in 10.5 px `--ink-3` (`20`, `40`, `60 km`, the unit after the last only, U+202F
  before it). The demo's Block is 64 px of plot on Now, 96 on Plan.
- **The columns** share the plate's content width less the values' 30 px gutter (302 of 332 px at
  390 × 844: the pane's 16 px gutters, the plate's 12 px padding and 1 px edge): slot = width / columns,
  column = slot − 4 px, left-aligned in the slot, every edge on a whole pixel (16 columns: 18.9 px slots,
  columns of 14 and 15 px). Above the plot, one
  14 px label row; under it, a 3 px gap and one 14 px label row.
- **The labels.** Under the plot, in 10.5 px `--ink-2`, the month at the first column whose Monday
  begins it (`Jul`, `Aug`, `Sep`, `Oct`), the first label carrying the year (`Jul 2026`), and a later
  January carrying it again; a label that would collide with the one before it is skipped. Over the
  race's column, a 1 px `--ink` rule at the race day's x (the column's left + (weekday index + 0.5) / 7
  × column width) from the label row to the outline's top, and the race's name and date in 10.5 px
  `--ink-2` on a 3 px `--sheet` halo, `Copenhagen Half Marathon, 1 Nov`, anchored at its right end to
  the rule so it never runs off the chart.
- **`now`.** Over `this`, `now` in 10.5 px `--ink-3` with a 1 × 6 px `--ink-2` notch down to the plot's
  top. When the race's name covers that place, the notch is not drawn and the word moves to the month
  row under `this`, if it stands at least 4 px clear of every month's name there; otherwise neither is
  drawn, rather than a notch tucked under the name's letters. With sixteen columns at 390 px the demo's
  race name always covers `this` and the month row has `Oct` 2 px away (`now` is 18.7 px wide, centered at 234.5; `Oct` begins at 246), so on an upright phone the
  current week is told by its half-filled outline and by the key number over the Block; at 844 px (a phone
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
- **The key**, under it (HOUSE 11.1 rule 6), in place of a how-to-read sentence: a 10 px `--done`
  swatch `Run`, and an outline swatch holding the 14 % fill, `Planned week to Copenhagen Half Marathon`
  (`Planned week` without a race; `No plan in this snapshot` without a plan), 11.5 px `--ink-2`.
- **The test hook**: `window.__rd.block()` returns `{ columns: [{ week, runs: [km…], target, low,
  kind }], scale, now, topKm, base, points: [[x, y, w, h]…], outlines, tints }`, the drawn rectangles in
  CSS px, so `shoot.mjs` checks the drawing against its own decode and samples the ink's and the tint's
  pixels.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears.* No activities, no ink; no plan, no outlines; no race, no race
   mark. A broken snapshot is a sentence (section 3), never an empty sheet. Nothing is seeded or drawn
   ahead of the data, and nothing moves.
2. *Every property that varies is measured.* A block's height is a run's running kilometers at a
   printed rate; an outline's height is the plan's number for that week at the same rate; x is the
   week (an even division of time); the race rule's x is the race's date; the gaps are fixed. Color
   encodes one thing: `--done` is a run done, and the key says so.
3. *It is captioned.* The key under it, the hairlines' values, the month labels, `now` where it has
   room and the race's name; About's first section in full.
4. *It reads.* `--done` on its plate: 6.29:1 in the light theme, 7.68:1 in the dark (`python3
   running-dashboard/tools/art/palette.py`, check 4), against a target of 3.0:1 for a mark; the outline,
   `--ink-2`, 7.32:1 and 6.92:1. The 1 px gap between two runs is the plate itself, so it holds the same
   figure. `shoot.mjs` samples the drawn runs on rendered pixels: 2 079 samples in each theme, 99.5 % in
   `--done` and every one at 3:1 or more, the lowest 6.29 (light) and 6.92 (dark). The fill inside the
   outlines stands 1.23:1 (light) and 1.31:1 (dark) on the plate, HOUSE 11.2's figures, seen and light,
   and the runs 5.09:1 and 5.88:1 against it, so a run never reads as a plan (`palette.py`, checks 4 and
   9); `shoot.mjs` samples 462 points inside the fills in each theme, 95.2 % at the fill's exact color
   (the race's 1 px rule crosses one column), and `test_block.mjs` checks every fill's place against its
   own decode.
5. *It survives Reduce Motion.* It has no motion.
6. *About says what it shows and what it does not* (its first section): running only, walk breaks
   out; one block per run, not per day; the outline is the plan as the coaching routine wrote it on
   the date printed, and past weeks' plans are not kept, so a past week shows only what was run; a
   target given as a range is drawn to its top with a tick at its bottom; the scale; and that the
   weeks follow the phone's calendar (Monday to Sunday).
7. *It is the bold drawing.* On Now and Plan it is the only drawing at full strength; the charts below it
   are drawn in the fitted data tones and the `--amount` slate, and the key number over it is the week's
   own figure, the one the Block draws for this week.

---

## 2. Palette

Every figure here is printed by `python3 running-dashboard/tools/art/palette.py` (from `Template/`;
`ALL CHECKS PASS`). `--json` prints the fitted tokens and the route ramp per theme; they are pasted into
`style.css` (the zone, series and `--amount` tokens) and `js/palette.js` (the ramp), and
`tools/check.mjs` fails while either differs from `--json`; `--json` also carries the register's four
meaning colors (below), taken as HOUSE 11.2 measured them. The script's source colors are the app's
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

### The register's meaning colors (HOUSE 11.2, 11.3)

One meaning each, never on a control, a tab, a heading, a plate or the stamp, and never alone: the word
is always there (check 9 prints the figures).

| Token | Means | Light | Dark | As text on `--page` / `--sheet`, light | dark |
| --- | --- | --- | --- | --: | --: |
| `--done` | a run done: the Block's runs, the week's bar on Now and its key | `#1f5f99` | `#8cbcf0` | 5.68 / 6.29 | 8.61 / 7.68 |
| `--up` | on track: the tone word `On track.` | `#17723e` | `#6fd39a` | 5.10 / 5.65 | 9.34 / 8.33 |
| `--watch` | watch: `Watch.` | `#8a5a00` | `#e0a340` | 5.06 / 5.60 | 7.73 / 6.89 |
| `--down` | act now and stop: `Act now.`, `Stop.` | `#b42318` | `#ff9a8f` | 5.61 / 6.21 | 8.37 / 7.46 |

The three tone colors come closest under deutan vision (`--watch`/`--down` ΔE 0.003 light), which is
why the color never carries the tone: the sentence `Watch.` or `Act now.` does, and the color repeats it.

### The tonal budget

| | Light (film base) | Dark (the print) |
| --- | --- | --- |
| Ground | `--page` `#e8eef0` (L 0.945) under every pane and the filters; `--sheet` `#f6f9fa` (L 0.980) under every section's plate, the readout card, About and the route's casing (a plate on the page 1.11:1, its `--line` edge 1.29:1) | `--page` `#141d21` (L 0.224); `--sheet` `#1c272c` (L 0.265) (1.12:1, edge 1.39:1) |
| Data band (every data token) | L 0.400–0.625 | L 0.560–0.860 |
| Signature | the Block, `--done` `#1f5f99` on its plate 6.29, opaque | `--done` `#8cbcf0` 7.68, opaque |
| Worst measured case | the lowest data token on a ground 3.04 (zone 0 on `--page`) | the lowest 3.21 (series 4 on `--sheet`) |

The band sits below the grounds in the light theme and above them in the dark, and the ink keeps the
far end of the range in both (check 4: L 0.218 under 0.400; L 0.941 over 0.860). Every data token is
a mark at 3:1 or more on both grounds (check 2). The Block never sits over data, so its worst case is
its plate. Ink drawn *over* data (the four-week and seven-day averages, the planned average, the
cursor, the route's start and finish) goes on a 4 px `--sheet` casing, the plate's own color (2 px of
ink over it, 16.40:1 and 12.87:1): without the casing ink over the closest data token would be 1.83:1
(light, series 8) and 1.23:1 (dark, zone 3), which is why the casing is there (check 5).

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

### The plan's tint

Whatever the plan asks for is drawn as a 1.5 px outline around a light fill (the owner: "fill inside the
planned stuff (light) to make it possible to see", 2026-10-03), on its plate. Two strengths:

- **The Block and the week's bar on Now** take the register's planned fill (HOUSE 11.1 rule 7): `--ink-2`
  at 14 % over `--sheet`, `#dde2e4` light (1.23:1 on the plate) and `#2f3a3f` dark (1.31:1), inside a
  1.5 px `--ink-2` outline (7.32:1 and 6.92:1), the runs in `--done` 5.09:1 and 5.88:1 against it
  (check 9; its key's swatch the same).
- **The charts' planned bars** (the running, time-in-zone and day charts on Plan, the plan's zone bars in
  its week rows, and the legend's `Planned` swatch) keep **their own token at 20 % over the plate**, an
  outline of that token around it. In the SVG it is the segment's own fill under `.tint { fill-opacity:
  0.2; }`, the stroke at full strength over it; in HTML, `color-mix(in srgb, var(--c) 20%, transparent)`
  inside the 1.5 px border. One strength for both themes, in `palette.py` as `TINT` and in `--json` as
  `tint`; `check.mjs` holds the stylesheet's two forms to it.

**0.20 is the largest round strength at which every token ever drawn planned stands at 3:1 or more
against its own tint in both themes**, so done (solid) and planned (tinted, outlined) stay apart at the
mark's own target, and the outline reads on its tint as it does on the plate. Every tint stays under 2:1
on the plate: light. Check 8 prints each:

| Token | Light: tint | on the plate | token on it | Dark: tint | on the plate | token on it |
| --- | --- | --: | --: | --- | --: | --: |
| `--zone-1` | `#d8dcdd` | 1.31 | 4.18 | `#364045` | 1.44 | 4.23 |
| `--zone-2` (easy) | `#c5dbeb` | 1.35 | 4.42 | `#2b4256` | 1.47 | 4.53 |
| `--zone-3` (moderate) | `#c8d9c8` | 1.40 | 5.95 | `#334e3c` | 1.67 | 6.29 |
| `--zone-4` (hard) | `#e3d9c8` | 1.32 | 4.00 | `#423a24` | 1.35 | 4.00 |
| `--zone-5` | `#f0d2d1` | 1.34 | 3.34 | `#442d2f` | 1.21 | 3.14 |
| `--series-1` | `#c6d4f0` | 1.41 | 5.42 | `#364556` | 1.56 | 5.24 |
| `--series-3` | `#c5dfd8` | 1.33 | 4.02 | `#21463f` | 1.46 | 4.55 |
| `--series-6` | `#ddd9f1` | 1.30 | 3.65 | `#343753` | 1.32 | 3.36 |

`shoot.mjs` samples the inside of the tallest planned segment of each chart on Plan in both themes and
finds the tint within one step per channel of its token at 20 % over the plate (light `rgb(196,218,235)`
for easy's `rgb(197,219,235)`, 1.36:1 on the plate, the done easy segment 4.38:1 against it; dark
`rgb(42,66,86)` for `rgb(43,66,86)`, 1.46:1 and 4.54:1).

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
run reads steady. Both are display choices About and the map's How to read it name (`tools/DECISIONS.md`,
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
  on a 3 px `--sheet` halo at the top; the race's mark a solid 1 px `--ink` rule, its name in `--ink-2`.
  Words anchor inside the chart. The Block's rule holds here too: a word that would collide with the
  race's name is left out and its rule kept, and a rule that passes under another mark's word starts
  below its letters. Once the phone has moved past the data, the word is `updated` (section 3).
- The 24-hour charts' hours: a 1 × 3 px `--line-strong` tick under the baseline at every third hour,
  its label centered on it; a label within 38 px of the one before it, or that would run off the
  chart, is left out, never pushed off its tick.
- Hairlines behind a chart: `--line`; the baseline: `--line-strong`.
- The cursor on a chart (the column under the finger): `--ink` at 7 %; on a line chart a 1 px `--ink`
  rule at 50 % and a 7 px `--ink` disc with a 2 px `--sheet` ring.
- The route's start and finish: the start a 9 px `--ink` disc with a 2 px `--sheet` ring, the finish a
  12 px ring of 2 px `--ink` on `--sheet`. The route line: 4 px of ramp color on a 7 px `--sheet`
  casing; the part outside the distance window 2.5 px `--ink-3` at 45 %.
- The map tiles keep their own colors in the light theme and are inverted in the dark (`invert(1)
  hue-rotate(180deg) brightness(.82) contrast(.92)`): the basemap printed as its negative, which the
  house allows for a picture with one appearance (HOUSE 3.2); it is not chrome.

---

## 3. The chrome, object by object

HOUSE 4.0's row for *panes from a pull*, under the register (HOUSE 11.1): panes as tabs; no key column;
no caption band (rule 1: the front is the name, one stamp line, the tabs and the pane); no player (a
pane may plot time on an axis); a readout card for a tapped bar, hour or item; no focus mode. Every kind carries the header, About, notices and the live
region, the motion rules, landscape and safe areas.

### The frame

Now, at 390 × 844, on the evening of the pull (the clock at 30 Sep 2026, 21:00 in Copenhagen; heights
in CSS px, safe-area insets outside them, measured by a throwaway probe on 2026-10-08; from the next day
the stamp and the week's words read as "When the phone has moved past the data" says):

```
┌──────────────────────────────────────────┐
│ Running Dashboard                        │ 22  the name, 15/650
│ Example data. Updated 20:20, last …      │ 16  the stamp, 11.5, --ink-2 (opens About)
│ Now  Plan  Training  Health  Sessions    │ 44  the panes as tabs; the tracer under the chosen
├──────────────────────────────────────────┤ ── the pane scrolls from here down, inside the frame
│╭────────────────────────────────────────╮│239  the key number's plate: the week in words,
││This week, 28 Sep to 4 Oct              ││     24.0 km at 34/650 and its plan, a 10 px bar in
││24.0 km  of 62 km planned               ││     --done inside the planned fill, its key; then
││▓▓▓▓▓▓▓░░░░░░░░░░░  ■ Done  □ Planned    ││     the tone word in its color, 15/650, and the
││On track.                               ││     verdict's sentence under it
││Eleven weeks in, the block is doing …   ││
│╰────────────────────────────────────────╯│
│╭────────────────────────────────────────╮│324  the tiles: two columns, a label 11.5, a value
││Run, 7 days …      Run, 28 days …       ││     19/650, a note 11.5; eight tiles
││50.1 km            253.9 km             ││
││…                                       ││
│╰────────────────────────────────────────╯│
│╭────────────────────────────────────────╮│185  the Block's plate: the race's name over its day,
││ ▇ ▇ ▇ ▇ ▇ ▇ ▅ ▇ █ █ ▆ ▄ ┌┐ ┌┐ ┌┐ ┌┐      ││     the runs in --done, the outlines with their
││ Jul 2026    Aug      Sep        Oct     ││     fill, the months, the key and Show the table
│╰────────────────────────────────────────╯│
│  What to do next, the race predictions,  │     then the plan's pointer, the predictions and
│  the full evaluation; then the About key │     the evaluation, each on its plate; the About key
└──────────────────────────────────────────┘
```

The pane is 750 px tall under the header (94); with no band under it, it pads the home indicator itself
(28 px plus the bottom safe-area inset; HOUSE 4.14). Now's first screen holds the week, the verdict and
the tiles; the Block is the first scroll.

- **The frame.** `body` is a column of two: the header and the pane (`<main>`, `flex: 1 1 auto;
  min-height: 0; overflow-y: auto; overscroll-behavior: contain`); the page is `100dvh` and never scrolls
  itself (HOUSE 4.1: *a pane app scrolls its pane's content inside the frame, so the header stays put*).
  The pane switch, a same-pane re-render (which keeps the reader's place) and the session pick move the
  pane's own `scrollTop`. Content is one column, at most 760 px wide, centered on wide screens, and the
  header's sides follow it (`max(16 px, 50 % − 364 px)`), so the name starts where the plates do;
  gutters 16 px plus the safe-area inset. No rule under the header. The page never scrolls sideways at
  320 px or at 125 % text zoom. Every pane ends with one text key, `Sources, method and credits are in
  About.` (12.5 px `--ink-2`, underlined at a 3 px offset, 44 px tall, 14 px under the last plate), which
  opens About.
- **The header.** The name, `<h1 translate="no">Running Dashboard</h1>`, 15 px, 650, 22 px line. **The
  stamp** under it, a `<button>` with `aria-haspopup="dialog"`, described as *Opens About this data.*,
  its hit 44 px tall running up over the name, which is not a control, and down into the gap above the
  tabs (22 + 16 + 6 px; running further down would land on the tabs, which take the tap): `Updated
  20:20, last session 30 Sep` on the day of the pull, `Updated 30 Sep, 20:20, last session 30 Sep` on
  another day (`pulledAt` when the snapshot has it, else `generatedAt`; the clock built by hand in
  `js/units.js`, 24-hour, day before month, the same on every locale). **Example data** (HOUSE 11.1
  rule 8): while every session in the file is the generator's own (every id `demo-…`, the rule the
  routes' OpenStreetMap credit keys on), the stamp leads with `Example data.` in `--ink`, whatever the
  clock: `Example data. Updated 30 Sep, 20:20, last session 30 Sep`. A real pull's ids never show it.
  **Stale**, in place of it on a real copy, when the snapshot is more than 48 hours old (the threshold
  `NOTES.md` states as two days): the stamp leads with `Stale.` in `--ink` and the rest stays `--ink-2`:
  `Stale. Updated 30 Sep, 20:20, last session 30 Sep` two days on (`shoot.mjs` proves it on a copy whose
  ids are rewritten `real-`, the clock at 3 Oct, 12:00). One line in every state. The watch-sync time and the other instants are in About
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
- **The pane's own controls** (Training, Health, Sessions) are **held under the tabs** while the pane
  scrolls beneath them (the owner: "The sliders should be locked on top for relevant pages", 2026-10-03).
  They are one block at the top of the pane's scroller, `position: sticky; top: 0` on `--page` (z-index 4:
  over a chart's card, under a notice), in the flow, so at rest the pane's content begins at its foot and
  nothing is covered: 124 px on Training and Sessions, 76 on Health (`shoot.mjs` measures the content's
  top at the block's height). It counts against the pane as the header does: of the 750 px pane at
  390 × 844 it leaves 626 at rest and 674 once its first row has tucked; on a phone on its side, 220 and
  268 of 344. Its rows, from the top:
  - *Sport and equipment*: native `<select>`s set as word keys: 12.5 px `--ink` at 560 in a 1 px
    `--line-strong` frame, 6 px radius, 44 px tall, no chevron glyph and no fill, 4 px under the tabs.
    Named `Activity type` and `Equipment`. Whether iOS zooms the page when one is focused (its text is
    under 16 px) is a phone check (`tools/DECISIONS.md`). **This row tucks** (the owner: "can be hidden
    when moving down"; and in 1.2.1, "I do not want them to pop up until we are at the top"): a scroll
    down carries it up and out with the pane, pixel for pixel, gone after its 48 px, and a scroll up
    leaves it out until the pane is back within 48 px of its top, where it slides back in the same way.
    `tucked()` in `app.js` sets the block's `translateY` to the scroll itself, held between 0 and the
    row's height, so no gap opens at the top. It moves only with the pane, never on a timer: no
    transition, nothing for Reduce Motion to stop. A key that focuses a control in the row takes the pane
    back to its top, where the row is; a finger on a thumb does not, so the track never moves under a drag (`shoot.mjs` drags the window's end with the row tucked:
    the track holds at one height through all ten moves). A session picked on Sessions scrolls to 8 px
    under the block as it stands once tucked.
  - *The window*: `3 months`, `6 months`, `1 year`, `All` as words, `aria-pressed` buttons in a
    `role="group"` named `Time window`, 12.5 px, the tracer under the chosen, 44 px hits; at the row's
    right, the window in words, `12 Jan to 4 Oct 2026` (12.5 px, `--ink`).
  - *The window's track*: two native range inputs (accessible for free) in the house's slider
    language: a 1 px `--line-strong` baseline, the chosen window in 2 px `--ink`, a tracer head at each
    end of it (an 8 px `--ink` disc with a 3 px ring of its ground, `--page` here and `--sheet` on a plate,
    and a 1.5 × 18 px `--ink` tick through it,
    10 px while its thumb is pressed). **No plate behind a thumb** (the owner: "I do not like the squares
    around the sliders"): the inputs are drawn at opacity 0, still the 44 × 44 hits and the accessible
    sliders, so the phone paints nothing of its own there, and the heads are the fill's `::before` and
    `::after`, round, ringed in a 2 px `--ink` circle on a key's focus only. `shoot.mjs` finds nothing
    but the page in each thumb's 44 × 44 box outside its head and the track (0 of 5 616 samples) and each
    hit 44 × 44. Named `Start of window` and `End of window`. **The row is 32 px with the track 10 px
    down** (the owner: "moved slightly upwards to make it take up less space", 2026-10-03), so the heads
    sit close under the window words and the block is 12 px shorter than with a 44 px row; the inputs
    keep their 44 px and overhang the content's first line, a heading, which no tap is meant for. The
    route's distance window on Sessions is drawn the same way.
- **Sections on plates** (HOUSE 11.1 rule 4). Each chart and each group of facts is a section on a plate:
  `--sheet`, a 1 px `--line` edge, radius 8 px, padding 12 px, 12 px apart; its heading at 15 px 650 in
  sentence case. Halos, casings, the cursor's ring, the sports' dots and a slider head on a plate take
  `--sheet`. A pane's group heading (`Running`, `Load`, `Heart` on Training; `Today`, `Recovery and
  trends` on Health) is an `h2` at 15 px 650 above its plates, sentence case, and the sections under it
  are `h3`, so VoiceOver's heading rotor keeps the groups; on a pane without groups the sections are
  `h2`.
- **Under each chart**, in this order: the legend; at most one short label, one line at 390 px (11 px,
  15 px line, `--ink-2`, what one bar or point is, in the data's words: `One bar is one week, Monday to
  Sunday.`; HOUSE 11.1 rule 9; a label that would run longer is the fold's); `How to read it` and `Show
  the table` as text keys
  (12.5 px `--ink-2`, 44 px tall, sentence case). `How to read it` is a `<details>` whose `<summary>`
  is those words; its body is 13.5 px, line height 1.5, `--ink-2`, at most 62 characters wide, and
  holds every method sentence: the evaluation's and the plan's dates and how they are rewritten, the
  load chart's totals, VO₂ max's recomputes and its axis, Garmin's predictions' basis, the session
  curves' record and each curve's long note, the weigh-ins', the map's, how the Today group refreshes.
  `Show the table` turns to `Hide the table`.
- **The legend** of a chart: swatches 8 × 8 px, square, a line series 16 × 2 px, the planned swatch
  a 1.5 px outline around its color at 20 %, labels 10.5 px `--ink-2`, 12 px apart; the route ramp's legend is the bar described in section 2 with its ends
  printed (`slower ≥ 5:55 /km`, `faster ≤ 5:10 /km` for the demo's easy run of 29 Sep; `≤ 173`, `≥ 183
  spm` for its cadence: the ends are the session's 5th and 95th percentiles, or the minimum span around
  its median when those lie closer, as on this steady run; printed open because the colors clip there).
- **Charts.** Every axis and tick label 10.5 px, `--ink-2`; the unit caption above the plot 10.5 px
  `--ink-2` at 400; bars square-topped; ticks and numbers through `js/units.js`. Planned bars,
  wherever they are (the running, time-in-zone and day charts on Plan, the plan's zone bars), are drawn
  in outline around a light tint: each segment a 1.5 px stroke of its token, inset, around the token at
  20 % over its plate (section 2, "The plan's tint"), 1 px gaps between segments, a segment under 3 px drawn as a 1.5 px
  line. The planned four-week average is `--ink` dashed 5/4 on its casing, the actual one solid.
- **Plan's charts, in order** after the Block, the race-day key number with the plan's verdict on its
  plate, and the goal:
  - **Running volume, past and planned** (the owner: "a running plot similar to the time in zone plot
    with colors as it was", 2026-10-03), where the stock app had its weekly running chart, between the
    goal and the time in zone. The Block's sixteen weeks as kilometers of running per week, walk breaks
    out, each stacked from the baseline by the zone it was run in, in the stock chart's four colors fitted
    to the band: `Below Z1` (`--zone-0`), `Easy (Z1–2)` (`--zone-2`), `Moderate (Z3)` (`--zone-3`), `Hard
    (Z4–5)` (`--zone-4`), the kilometers by zone as the day charts take them (`kmByZone()`: the record
    stream, else the laps, else the time in zone). The plan's weeks are its targets split by its own
    shares of easy, moderate and hard (`horizon[].mix`), outlined and tinted; this week's are the rest of
    its target on top of what was run so far; the two four-week averages, actual (solid) and planned
    (dashed), meet at `now`, which is dashed over the plot after this week; the race's rule and name as on
    the time in zone. The plot keeps a tenth of headroom over its tallest week, so the race's name never
    meets a bar (`shoot.mjs`: clear of all 63). Its card is the Block's for the same week (`Week of 14 Sep
    2026`, `77.8 km`, `Runs 6`, `Longest 24.0 km`) with the zones under it (`Below Z1 5.1 km`, `Easy (Z1–2)
    40.7 km`, `Moderate (Z3) 20.1 km`, `Hard (Z4–5) 11.9 km`); its legend the four, `Planned` and the two
    averages; its label `One bar is one week, Monday to Sunday.`; `Show the table` lists every week:
    `Week`, `Run km`, `Easy`, `Moderate`, `Hard`, `Below Z1`, `Plan`.
  - **Time in zone, past and planned** with its four units, then **Day by day, planned and run** and
    **Day by day, as time in zone**, then the plan's weeks and `About this plan`.
- **Now opens on the week** (HOUSE 11.1 rule 2; the owner's D5): a plate holding the key number, the
  week in words over it at 12.5 px `--ink-2` (`Week of 28 Sep, data to 30 Sep`, or `This week, 28 Sep
  to 4 Oct` on the evening of the pull; it is the pane's first heading), this week's running kilometers
  at 34 px 650 (`24.0 km`, `blockWeeks()`'s column at now, the figure the Block draws), `of 62 km
  planned` at 13.5 px `--ink-2` beside it, a 10 px bar (the run in `--done` inside a 1.5 px `--ink-2`
  outline holding the 14 % fill, as far as the week's kilometers reach its target) and its key (`Done`,
  `Planned`); then, over a `--line` rule, the tone sentence at 15 px 650 in its color, the evaluation's
  verdict after it in ink when it says more than the tone, and the headline in prose under it.
- **Now's facts as tiles** (HOUSE 11.1 rule 3; the owner asked for the numbers first, 2026-10-03), on
  the next plate: the app's four (`Run, 7 days to 30 Sep`, `Run, 28 days to 30 Sep`, `Garmin status`,
  `VO₂ max`) and every metric of the evaluation that fits a line (its value and note 64 characters or
  fewer and one sentence: the demo's `Weeks done`, `Biggest week`, `10 km tune-up`, `Goal`), in two
  columns: a label 11.5 px `--ink-2`, the value 19 px 650, the note under it at 11.5 px `--ink-2`, parted
  by `--line` hairlines. A metric whose words run on (the owner's coaching routine writes them: `Share of
  the 2025 peak`, `The down week, as it closed`) goes on a plate of its own after the Block, a label over
  its prose: the label in `--ink-2`, then the value and note left-aligned at 12.5 px, line height 1.5, at
  most 62 characters wide (`shoot.mjs` serves one and finds it there, three lines of left-aligned prose,
  still eight tiles). The demo has none.
- **The facts** elsewhere (four on Today; six on Health; up to sixteen in a session, as on the easy run of
  29 Sep; the race day, distance and goal on Plan; a plan week's): a `<dl>` of rows, each a label at
  12.5 px `--ink-2` at the left and the value at 12.5 px `--ink` 560 right-aligned, with the note after
  the value in `--ink-2`, joined by a comma (a plan week's `So far`, then `24.0 km`, then `in 2 runs, 2
  other, 1 hard`; Health's `Weight`, `69.7 kg`, `−2.5 kg since 12 Jan`), or by a space when the note
  begins `per` (`7.7 h per night`); three cells of one row, wrapping under on a narrow screen, rows parted by 1 px
  `--line` hairlines; two columns of rows from 560 px. A label is the quantity in words, beside its
  value, never above it. A session's `Body battery change` is Garmin's change over the session, signed.
- **The key number** elsewhere (HOUSE 11.1 rule 2, at most one per pane): Plan, the days to the race
  (`31 days` at 34 px, its label `Race day` above, the lead `to Copenhagen Half Marathon, 1 Nov, 09:30`
  under it, on a plate with the plan's verdict); Sessions, the chosen session's distance, or its time when
  it has none (`11.2 km`, the label `Running`, the lead `56 min, 4:54 /km`). Training and Health have
  none: their charts are the subject.
- **The tone** (HOUSE 11.3): no pill, no gradient. The tone is a sentence (`On track.`, `Watch.`, `Act
  now.`, `Stop.`, `Note.`), and only it takes a color: `--up` for on track, `--watch` for watch, `--down`
  for act now and stop, a note in ink. On Now and in `What to do next` it is 15 px 650 over a `--line`
  rule, the headline in prose under it at 13.5 px, line height 1.45; on Plan, in the evaluation's folds
  and a session's note, it is 620 at 13.5 px leading the data's words, a session's own verdict before it
  in ink. The word carries the tone; the color repeats it.
- **The race predictions table**: 12.5 px, tabular; headers 11.5 px 600 `--ink-2` in sentence case
  (`Distance`, `Garmin`, `Agent`, `Difference`); the difference in `--ink` with its sign (`−0:15`,
  `+0:20`), in no color (not a change under a key number). Its one label, `A plus is the agent slower than
  Garmin.`; the method sentence opens `Why the numbers differ`.
- **The sessions list**: rows on its plate, at least 52 px tall, separated by `--line` hairlines; the
  chosen row on the on-plate; the date in 12.5 px `--ink-2` (`Wed 30 Sep`, the year under it only when
  it is not this year), the name 13.5 px `--ink` 600, under it `Run, 56 min, 157 bpm` in 12.5 px
  `--ink-2`, at the right the distance 12.5 px 560 with the training effect's word under it. The sport
  swatch (8 px square in its token) stands before the name; the word after it carries the sport. The
  list scrolls inside itself (at most 46 % of the screen's height).
- **The plan's week rows**: the day, the session's words at 13.5 px 600, the kind as a word in 11 px
  `--ink-2` (sentence case; `done` and `missed` in `--ink`), the stats in 12.5 px `--ink-2`, the kind's
  8 px dot in its token. A missed session says `missed` in `--ink`, at full opacity. A session after
  the last day the data saw is planned, never missed. Planned zone bars in outline around their tint.
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
- **The route map** (Sessions): its section's plate, 8 px radius, `--sheet` behind the tiles. Its modes
  (`Heart-rate zone`, `Pace`, `Speed`, `Cadence`, `Power`, `Elevation`) are words with the tracer. A
  vertical swipe across it scrolls the pane; a tap or a sideways slide reads points along the track.
  How the route is colored and read is in the section's `How to read it`. **Only OpenStreetMap's credit
  stays under the map** (HOUSE 4.15 exception 1, its attribution guidelines asking for the credit in the
  map's vicinity), one 10.5 px `--ink-2` line at the map's foot, and only when OpenStreetMap data drew
  it: `Route: © OpenStreetMap contributors, ODbL.` under a route drawn from the template's own courses,
  `Map: …` under OpenStreetMap tiles a copy fetched, `Route and map: …` for both, and no line otherwise.
  The other tile sources (USGS The National Map, Kartverket) are credited in About, whose terms ask for
  the credit, not a place on the map. The distance window's two thumbs take the house slider language; the elevation
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
- **No caption band** (HOUSE 11.1 rule 1). What the band's caption line said is elsewhere: the update and
  the evaluation's and plan's dates in the stamp and About's *This data*; the window and the filters on
  the filters themselves, held under the tabs. The credit line is About's first paragraph under *Sources
  and credits*, word for word: `Data: Garmin Connect. Coaching text: the coaching routine.` One verb
  names the instant the data was made, in the stamp, About and the notices: *Updated*.
- **Pressed tints**: an empty, passive `touchstart` listener on the document lets iOS draw `:active` (a
  key, a word, the About key).
- **The player: none.** No time to scrub. The session curves, the 24-hour charts and the route keep
  their slide-to-read readout.
- **About** (below), opened from the stamp and from the key at each pane's foot.
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
  name over the stamp at the left and the tabs at the right; the pane scrolls under it.
- **Safe areas**: the header `6 px + top` and `max(16 px, 50 % − 364 px) + left/right`; the pane's
  content `16 px + left/right` and its foot `28 px + bottom`; the readout card stays in the pane's
  column; About's head `top`, its body `16 px + bottom`.

### When the phone has moved past the data

A snapshot can stay unrefreshed for days (`NOTES.md`: a Garmin change breaks the pull until the
library catches up). Whatever counts back from today then stops at the last day the data saw, the
phone's date capped at the day of the pull (`todayIso()`), and says so: on Now the key number's words
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
it is open; focus returns to the stamp, or to the key at the pane's foot when it opened About;
`overscroll-behavior: contain`. Sections at 13.5 px 650
sentence case separated by 1 px `--line` rules; prose 13.5 px, line height 1.5, at most 62 characters
wide.

1. **What the Block is.** The Block in prose: one column a week from twelve weeks back to the race;
   one block per run's running, walk breaks out; an outline is the plan's week as the coaching
   routine wrote it on the plan's date, lightly tinted where it is still to run, a range drawn to its
   top with a tick at its bottom; this week
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
4. **Sources and credits.** First the credit line, `Data: Garmin Connect. Coaching text: the coaching
   routine.`, static and word for word (HOUSE 4.15); then Garmin Connect's data, the runner's own
   account, through the pull; each
   map's tile source and its terms (USGS public domain with its requested acknowledgment word for word
   from `TILES.md`; Kartverket CC BY 4.0 and OpenStreetMap's credit for a copy that fetches its own, the
   latter also printed under each map its tiles draw);
   any address printed without its scheme; where the snapshot's sessions follow the template's own
   courses (ids `demo-…`, the generator's rule), `Routes: © OpenStreetMap contributors, under the Open
   Database License 1.0 (opendatacommons.org/licenses/odbl/1-0); the route shapes in these sessions
   are derived from it.` (a license requirement; the stamp's `Example data.` keys on the same ids); then `Type:
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
- **The scale** (HOUSE 11.1 rule 2, the pane apps'): 10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 / 19 / 21 / 34
  px, weights 400, 560, 600, 620, 650; 34 px only for the key number, 21 px only for the readout card's
  value, 19 px for a tile's value; no capitals, no letter-spacing; sentence case for every label and
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
scroll the pane: at 844 px the drag starts at 633 px, inside the pane's scroller, so the pane, not the
page, scrolls, and no card opens even where the drag starts on a chart
(`shoot.mjs` drives it by real touch). The app remembers its pane (`running-dashboard.ui.v3`); the
camera selects `Now` first, so nothing has to be put back. No string is British; no remembered focus
mode exists. Since the register (plan 0012) Now opens on the week's key number and verdict, then the
tiles and the Block, so the camera's picture of Now leads with them; no string or role the camera reads
moved, and the drag still scrolls the pane in `shoot.mjs`.

---

## 6. Budget

*Measured* 2026-10-08, after the register (plan 0012 package 4), by `node tools/check.mjs`: the ZIP by
`build-zips.yml`'s own command, `zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*'
'scripts/*' 'dist/*' 'raw/*'`, then its size; code by the size of every shipped `.html`, `.css` and `.js`
outside `data/`.

| | As built | Cap | Rule |
| --- | --: | --: | --- |
| App code | 259 002 (`app.js` 212 316, `style.css` 25 491, `index.html` 7 709, `js/block.js` 7 101, `js/units.js` 5 956, `js/palette.js` 429) | **260 000** | the lead's ruling of 2026-10-08 for the register's pass, on its measured 259 002 (HOUSE 8); 252 000 before it, the lead's ruling for the owner's six (plan 0011 D32) |
| Fonts | 41 291 (the house's 40 075 and the supplement's 1 216) | 160 000 | |
| ZIP | about 1 085 700 (this file ships inside it, so its own figure moves the last digits; `check.mjs` prints the exact size) | **1 351 307** | the house rule for the register's pass: 1 081 046 before it × 1.25, rounded down |
| Data | 37 files, sha256 of the concatenation in sorted path order `871171cb856ae3da7ed869aa88a3cc335f7822ec01530fd47ae975d4eb13f0dc`; `data/snapshot.json` `d47c5c1c41fbc0243d59ec9fcabc38ed3803e27c269c994bec614008bbb36434` | pinned | `check.mjs` pins every file's own sha256 and the concatenation's; `scripts/make_demo_running_dashboard.py --check` rebuilds them byte for byte |

---

## 7. The generated-page tells, answered

| Tell | Here |
| --- | --- |
| 1. A warm cream ground, a serif display, a terracotta accent | the film base `#e8eef0`; one Renaissance sans; no accent: warm hues are zones, sports and the route's ramp only |
| 2. A near-black ground with one acid accent | the slate print `#141d21`; the register's four meaning colors, each one meaning (a run done, on track, watch, act now), never decoration |
| 3. Broadsheet hairlines, zero radius, dense columns | one column of plates, hairlines between rows inside them, radii by role (6, 8, 4, 0) |
| 4. The SaaS-card kit | plates as sections (`--sheet`, a 1 px edge, no shadow), each with one heading; the readout and About; no gradient but the route's legend; single-quantity charts in one quiet slate, not a kit of hues |
| 5. ALL-CAPS tracked eyebrow labels | none: sentence case, `letter-spacing` 0, no label above a value |
| 6. Meta strings joined with middle dots | commas and sentences; the credits constant has none |
| 7. "WORD — fragment" with a spaced em dash | none written by the app (`1.5, a spike`, `Road shoes A, 691 km`), and none in the demo's coaching text, which is data |
| 8. A tinted near-black standing in for black | ink `#0f1c23` used as ink; the dark page a slate at L 0.224 |
| 9. A monospace face for small data labels | none; the house face's figures are tabular |
| 10. An arrow appended to links and buttons | none anywhere; `check.mjs` fails on it |
| 11. One word accented in a headline | the tone sentence alone takes its color (`On track.` in `--up`), and its words say the same; nothing decorative |
| 12. Unnecessary labels above content | a tile's label above its value (the register's tiles, HOUSE 11.1 rule 3); elsewhere labels beside values in rows; group heads are headings, in sentence case |
| 13. Numbered markers | none |
| 14. A big number, a small label and a gradient accent | one 34 px key number per pane at most, the subject's own (the week's kilometers, the days to the race, a session's distance), its label naming it; no gradient |
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
