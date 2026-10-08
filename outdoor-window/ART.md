# Outdoor Window: art direction

How the app looks, moves and speaks under the template's house system (`Template/HOUSE.md`) and its
pane-app register (HOUSE 11: the next window as the key number, sections on plates, tiles and a table,
a key in place of a how-to-read sentence, credits in About; Finances is the register's reference).
`NOTES.md` says where the forecast comes from and on what terms; `PROMPT.md` sets a copy up. This file
holds the look as built; the record of the pass (the change list, the owner calls, the lead's rulings,
the as-built departures, the phone checks) is `tools/DECISIONS.md`, which does not ship (HOUSE, "What
ships and what does not").

Figures were measured on 2026-10-03, and those the register and the demo's refresh changed on 2026-10-08,
on the data as committed: `data/snapshot.json` (sha256 `e2b09817…9dfa9da255`, the demo forecast fetched
on 8 Oct 2026, 12:47 UTC, 48 hours for Boston Common from Thu 8 Oct, 08:00 local, UTC−4) and
`data/rules.json` (sha256 `ac9e029f…afefc97a`; both full values are in section 6). `python3 outdoor-window/tools/art/palette.py` (from `Template/`) prints
every color figure and ends `ALL CHECKS PASS`. Screens were read in headless Chromium at 390 × 844,
DPR 2, touch, with the clock at Thu 8 Oct 2026, 16:20 UTC (12:20 in Boston, inside the file and its next
window) and at Tue 20 Oct 2026, 10:00 UTC (the file run out, which is what a fresh install and the
marketing camera see some days on): what the page draws, never how a phone feels.

---

## 1. The signature: the Shutters

**In one paragraph.** A window, in this app, is what is left when every rule the reader wrote has had
its say. The Shutters draw exactly that. Under the pane's heading, one row per rule (Rain chance,
Rainfall, Gusts, Temperature, Dew point, Daylight), the same 48 hours across each, and in each row a
block of ink over every hour that rule rules out, so each rule closes its own shutters over the two
days. Where no row has ink, light comes through: a clear vertical channel down the whole stack. When
that channel is a window it is drawn as one: lit, an ink jamb up the stack at each edge, an ink sill
under it. On the hours a rule lets through, a thin green bar says how much of that rule's allowance
the hour used, so a rule nearly broken stands almost as tall as a shutter. In the shipped file the
Daylight row is two slabs of night (24 hours), Gusts closes 18 hours (most of Thursday morning and of
Friday's daylight) and stands at 6 to 12 px of green on the rest (gusts of 16.6 to 34.6 km/h under a
35 km/h limit), Rainfall closes two hours on Thursday morning, and two short windows open: Thursday
12:00 to 14:00 and Friday 07:00 to 09:00. A stranger remembers the windows as framed openings in the ink, and which row's ink stood in
the way.

**How it was found** (HOUSE 5.1):

1. *The specialist's picture.* Marine operations plan by "weather windows": each limiting criterion
   (wave height, wind) checked hour by hour against the operation's limit, the hours where every
   criterion holds read off as the window (the go/no-go timeline of an operability study). The
   meteogram, the forecaster's own picture, stacks each variable over a shared time axis. The Shutters
   are the planner's timeline drawn with the meteogram's stack: one row per limit, the shared hours
   under them, and the answer is where nothing blocks.
2. *What a person does most.* Opens the app, reads when the next window is, and asks second which rule
   cost the hours (the stock app's own comment: "the question a person asks second, right after when
   can I go out, and the reason the rules are editable at all"). The Shutters answer both where the
   eyes land, and they head the pane the camera photographs. A finger on them picks an hour.
3. *What this data has that no other app has.* Rules the reader wrote, scored against a forecast with
   one shared clock: the only data in the template that is half the reader's own. Moved to any other
   app, six rows of rule failures have nothing to draw. Set aside: the stock's score bars (one number
   per hour, with the reasons hidden in a tooltip; a generic bar strip), a meteogram of the raw
   variables with limit lines (six sparklines: a dashboard pattern, and it makes the reader do the
   comparison the app exists to do), a clock face of the next 24 hours (half the file, and it hides the
   second night), a calendar grid of hours by rule colored pass or fail (a contribution-calendar
   pattern World News already set aside, and color would carry the meaning).
4. *The house's means.* `--ink` blocks and frames on `--page`, the openings in `--sheet`, one data
   color (the stock's green, fitted to the band) for the allowance used, 10.5 px labels, `--line`
   hairlines at midnight, the track's tracer head for the chosen hour, no motion.

**Against the apps before it.** World News' Datelines are ticks of age on a logarithmic scale; Running
Dashboard's Block and Finances' Balance count things in blocks of ink (runs, accounts); Norne's Cut and
US Quakes' record strip are columns and stems whose height is a quantity; Finances' hollow under the
debts is one remainder on one axis. The Shutters are the only signature drawn from rules the reader
wrote, where ink is an obstruction and the subject, the window, is the channel where several
independent rows all leave the page bare.

**The rule it is drawn by** (`js/shutters.js`, pure; `tools/test_shutters.mjs` proves it):

- **Rows**, one per rule in use, in the scorer's order: `Rain chance`, `Rainfall`, `Gusts`,
  `Temperature`, `Dew point`, then `Daylight` or `Golden hour` when `daylight` is `daylight` or
  `golden`. A rule left out of `rules.json` has no row (the scorer does not apply it). Rows are 16 px
  tall, 3 px apart. The label, 10.5 px `--ink-2`, sits in a left column as wide as the widest label in
  use in the face plus 8 px (`Temperature` is 55.7 px at 10.5 px, so 64 px); at the right of each row,
  in a 26 px column, the hours that rule rules out, 10.5 px `--ink-2`, `24 h`, or nothing when it rules
  out none.
- **Hours.** The plot holds the file's hours (`hourly.time.length`, 48) at a whole number of pixels
  each: `floor(plot room / hours)`, at least 4 and at most 12, so every edge is crisp. At 390 px wide:
  358 px of content, 64 + 26 px of columns, 5 px an hour, a 240 px plot. At 320 px: 4 px an hour, 192
  px. On a phone on its side: 12 px. A file too long for 4 px an hour (over about 60 hours at 390 px)
  takes the fraction that fits beside a 20 px count column. The plot is left-aligned after the label
  column; the count column follows it.
- **A block** is a run of consecutive hours one rule rules out, drawn as one solid `--ink` rectangle
  the full 16 px tall, from the first hour's left edge to the last hour's right edge less 1 px of page.
  An hour with no value in the file for that rule (the scorer's "no data is not a pass") is a hollow
  block: a 1 px `--ink` outline, so a missing number never looks like weather.
- **A bar** is drawn on an hour the rule lets through: `--used`, 2 px wide (4 px at 12 px an hour),
  centered on its hour, standing on the row's foot, `round(12 × used)` px tall, where `used = 1 −
  comfort` and comfort is the scorer's
  own number (HOW AN HOUR IS SCORED in the code): for a "no more than" rule the share of the limit the
  value takes, for a band the distance from the band's middle as a share of half its width, for
  daylight 0. A bar at 12 px is an hour exactly at its limit; a bar is never as tall as a block, so at
  the limit never reads as past it. A bar under half a pixel is not drawn. The shipped file: Gusts 42
  bars (8 of them 11 px, 2 at 12 px: 34.4 and 34.9 km/h on Wed 01:00 and 03:00), Dew point 47, up to 8
  px; Temperature 40, up to 5 px; Rain chance one bar of 1 px; Rainfall none. Thin, so a window's
  opening reads as light, not as green.
- **What the bars add up to.** An hour's score is 100 times the mean comfort of its rules, so it is
  100 minus the mean height of its column's marks, a block counting as a full 12 px. About prints that
  sentence; the readout prints the score.
- **The windows.** Each window (a run of passing hours at least `minWindowHours` long, the scorer's
  `findWindows`) is drawn as one: its opening `--sheet` from the stack's top to 4 px under the rows,
  a 1 px `--ink` jamb up the stack in the page's gap at each edge, and a 2 px `--ink` sill under it
  joining them. A jamb beside a block of ink runs into it, as a frame meets a shutter. A passing hour
  outside any window (a run too short) is a clear column on the page, unframed: open, but not
  offered.
- **The axis**, under the sills: a 1 px `--line-strong` baseline 9 px below them, so the tracer
  head's ring never covers a sill; at each local midnight of the forecast's place a 7 px `--ink-2`
  tick, a `--line` hairline up through every row, and the day under it in 10.5 px `--ink-2`
  (`Fri 9`); a 3 px `--ink-3` tick at 50 % at 06:00, 12:00 and 18:00. Labels in order of priority:
  every midnight's day, then the first day's at the left end, only where it ends 4 px before the first
  midnight, then `12:00`; one within 4 px of another is left out (HOUSE 4.6). A file fetched in the
  evening leaves its first hours unnamed, never named for the wrong day.
- **Now.** While the present falls inside the file, `now` in 10.5 px `--ink-3` over the stack at the
  present's place, in a 16 px row of its own, with a 1 × 5 px `--ink-2` notch under it hanging to the
  rows: the house track's `now` over its notch, where the tracer head, on the axis, never covers it and
  no day's label competes with it. The readout says `now` for that hour too. Every hour that has
  already ended is drawn at 40 % opacity: still the file's data, but no longer a choice. Windows start at the current
  hour, as the stock's scorer already counts them (it drops ended hours). When every hour has ended
  (the file has run out, as the shipped file has a few days after it was fetched), no `now` and no row
  for it, every hour at full ink, and the stamp says so in words on a reader's own file (section 3).
- **The chosen hour.** One hour is always chosen (by default the first hour of the next window, as
  the stock did; with no window, the best-scoring hour). Its column carries `--ink` at 7 % behind the
  rows, and the axis carries the house's tracer head under it: an 8 px `--ink` disc with a 3 px `--page`
  ring and a 1.5 × 18 px ink rule through it, an instant change, never a glide.
- **Input.** The Shutters are the hours' slider: `role="slider"`, named `Hour`, `tabindex="0"`,
  `aria-valuemin` 0, `aria-valuemax` the last hour's index, `aria-valuenow` the chosen hour,
  `aria-valuetext` the readout's sentence in words (`Thursday 8 October, 12:00: clears every rule,
  score 64`; `…, 12:00, now: …` for the present hour); the arrow keys move one hour (up and down too, which is how VoiceOver's swipes reach a
  slider), Page Up and Page Down six, Home and End to the ends. A tap picks the hour under the finger,
  taken in the click that follows the lift, so a table row that the tap scrolls under the finger never
  receives it, and a click with no tap before it (VoiceOver's press) picks nothing; a drag that is mostly sideways moves the chosen hour with the finger (the
  house scrub: the readout and the head show the hour under the finger on every frame); a vertical
  swipe that starts on them scrolls the pane and picks nothing (HOUSE 4.7, the tap-not-swipe rule);
  a pinch that starts on them zooms the page (`touch-action: pan-y pinch-zoom`), and a second finger
  ends a scrub where it stood.
  Its hit is the whole drawing, more than 44 px tall. Nothing in it is a `button`.
- **VoiceOver** hears the slider's value as a sentence, and its description (`aria-describedby`, a
  hidden paragraph built from the data) once: `48 hours from Thursday 8 October, 08:00. Daylight
  rules out 24 hours, gusts 18 and rainfall 2; rain chance, temperature and dew point none. Windows:
  Thursday 12:00 to 14:00, 2 hours; Friday 07:00 to 09:00, 2 hours.`
- **The key** (HOUSE 4.15, 11.1 rule 6), one row under the readout, in place of the band's sentence:
  each mark drawn small with its word, 11.5 px `--ink-2`: an ink block, `Ruled out`; a 3 px `--used`
  bar, `Share of the limit`; a 1 px ink outline, `No value` (only where a hollow block is drawn); a lit
  square with an ink jamb each side and a 2 px ink sill, `Window`. With no rule in use, `Window` alone
  (the pane's statement says no rule is in use). `js/shutters.js`'s `keyItems()` builds it. Test hook: `window.__ow.shutters()` returns the geometry, every
  block, bar and window with its hours; `window.__ow.chosen()` the chosen hour.

**What About says it is not.** Not a forecast of comfort beyond the rules the reader wrote: an hour no
rule blocks is open by those rules and no others. A bar's height does not say which side of a band an
hour is on (too warm and too cold stand the same height); the readout does. Daylight is counted by the
hour's start, as the forecast's `is_day` gives it, so a window's last hour can run past sunset (in the
shipped file the sun sets at 18:13 on Thursday): the readout of the hour that holds it prints the
sunset. The forecast is a forecast: the Shutters score what was predicted, not what happened.

---

## 2. Palette

One data color, the stock's green for an hour inside the rules (`--bar-good`, `#17916c`), keeps its
hue and chroma; only its lightness is fitted per theme (HOUSE 3.2). Everything else the stock colored
was chrome and goes: the accent green (`--accent`, `--accent-soft`: the chosen tab, the links, a good
hour's tint and pill), the two grays of failing hours (`--bar-near`, `--bar-bad`), the amber of a stale
stamp and of notices (`--warn`) and the red of a file that cannot be read (`--alarm`). `palette.py
--json` prints `--used` per theme; `tools/check.mjs` fails while `style.css` differs.

**Chrome**: HOUSE 3.1's tokens as they are, both themes (ink on page 14.80 / 14.43; ink-3 on page 4.78
/ 5.88; the highest chroma 0.0239 light, 0.0223 dark).

| | Light (film base) | Dark (the print) |
| --- | --- | --- |
| Ground | `--page` `#e8eef0`, L 0.945; a window's opening, the plates, About and notices on `--sheet` (L 0.980; 1.11 on the page) | `--page` `#141d21`, L 0.224; `--sheet` L 0.265 (1.12) |
| Data band | one point: `--used` `#0c8c68`, L 0.569, C 0.115, h 167 | `--used` `#209670`, L 0.601, C 0.116, h 166 |
| Signature | the Shutters' blocks and window frames, `--ink` `#0f1c23`, L 0.218, opaque | `--ink` `#e6edee`, L 0.941, opaque |
| `--used` on the page | 3.61 | 4.61 |
| `--used` on the chosen hour's column (ink at 7 %) | 3.14 (the lowest data figure) | 3.84 |
| `--used` in a window: on the lit opening; on the chosen column there | 4.00; 3.49 | 4.11; 3.39 (the lowest data figure) |
| A jamb or sill, ink on the opening | 16.40 | 12.87 |
| A block beside a full-height bar (ink against `--used`) | 4.10; ΔE 0.354 to 0.382 under normal, deutan, protan and tritan vision | 3.13 (the lowest signature figure); ΔE 0.312 to 0.358 |

The band is one point because the app has one data color, inside the pane apps' family band (light L
0.400 to 0.625, dark 0.560 to 0.860). Two constraints pin it (a throwaway search in steps of 0.01,
recorded in `palette.py`): the bar is a 3:1 mark on the page and on the chosen column, and a bar at
its full 12 px stands 3:1 from a block of ink beside it. Light passes from L 0.54 to 0.58 and takes the
middle; dark takes 0.60, the lightest step that holds 3:1 against the ink (0.61 gives 3.01, 0.62
fails). In both themes "more" stands further from the ground: the ink furthest, the green between.

The blocks and frames are ink on the page, 14.80 / 14.43; a block across a midnight hairline 11.47 /
10.36; a bar across one 2.80 / 3.31. Color never carries the meaning alone: a block is ink and full
height, a bar is short; a window is a lit gap in an ink frame and the words beside the next one. Text:
labels and counts `--ink-2` (6.61 / 7.76), `now` and the table's head `--ink-3` (4.78 / 5.88), a row
held down `--ink` at 7 % (ink-2 on it 5.76 / 6.47).

**What the stock measured** (palette section 6): a failing hour's bar on its white card 1.37:1 light,
1.33 dark, so the hours that answer "why not" were nearly invisible; a "near" bar 1.80 / 2.25; the
muted 11 px words on a good hour's green tint 4.16 (light); the stale stamp an amber color with no word.

---

## 3. The chrome, object by object

HOUSE 4.0's *panes from a pull*, in the register's frame (HOUSE 11.1): a header, a pane that scrolls
inside the frame, and under it one footer line, Open-Meteo's link (the one exception rule 1 allows). No
units key, key column, player, focus mode or opening.

- **Header.** `<h1 translate="no">Outdoor Window</h1>`, 15 px 650. The stamp, a `<button>` opening
  About (`aria-haspopup="dialog"`, its hint `hidden`, a 44 px hit), built by hand from the phone's clock
  in `js/units.js`, the same on every locale, in the three forms the code already distinguishes:
  `Updated 14:47` (the file's `generatedAt`), `Updated about 14:45` (the service's `current.time`,
  rounded to the quarter hour), `Forecast from 14:00` (only the first hour: a lower bound on the age);
  `8 Oct, ` before the time when not today, the year when not this year. **The example** (the file's
  `demoPlace`) leads with `Example data.` in `--ink`, the rest `--ink-2`, whatever the clock:
  `Example data. Updated 14:47` on its own day, `Example data. Updated 8 Oct, 14:47` after it (HOUSE
  11.1 rule 8: an example never refreshes, so it never says stale or ran out). On a reader's own file,
  staleness is a sentence in `--ink` at the front, the rest `--ink-2`: `Stale. Updated about 14:45` past
  6 hours (the stock's threshold, unchanged; owner call 1), and `Forecast ran out 9 d ago. Updated about
  8 Oct, 14:45` once every hour has ended. One line at 390 px in every state. `Undated file.` when the
  file has no time at all. While loading, `Reading the forecast…`; `No usable forecast` when the first file read cannot be
  used. A problem with a later file never empties the stamp once a file has been read. **No units key**: the numbers are in the units the file carries
  (`hourly_units`, °C and km/h from the shipped address), and `rules.json`'s limits are written in the
  same units under names that say so (`maxGustKmh`); a key that printed °F or m/s would print the
  reader's own limits in a unit their file does not use (a stated departure from HOUSE 4.2; owner
  call 4).
- **Tabs**: `Windows`, `Hours`, `Rules`, `<button role="tab">` words at 12.5 px with the house tracer,
  44 px hits, focus rings inset 2 px, **built after the forecast parses** (the stock built them before
  the read, so the camera's wait for `Hours` proved nothing; section 5). The left and right arrow keys move between tabs,
  Home and End to the ends. The pane is `role="tabpanel"` labeled by the chosen tab. The app opens on
  `Windows` and stores nothing, as today.
- **The pane** scrolls inside the frame under a still header (the stock's sticky, blurred header
  goes): a 760 px column, centered with the header and the footer line on a wide screen (their sides
  `max(16 px, 50 % − 364 px)`). Sections sit on plates (HOUSE 11.1 rule 4: `--sheet`, a 1 px `--line`
  edge, radius 8 px, padding 12 px, 12 px apart), headed 15 px 650 in sentence case. **The title and the
  Shutters stay on the page**: their lit windows are `--sheet`, and on a plate they would vanish. No
  pills. Every pane ends with one text key, `Sources, method and credits are in About.` (12.5 px
  `--ink-2`, underlined at a 3 px offset, 44 px tall, 14 px under what precedes it), which opens About.
- **Windows** pane, in order: the statements (below), none for the example file; the heading, the
  reader's own `activity` word for word (`A walk outside`, 15 px 650), with the place under it in 11.5 px
  `--ink-2`: `Boston Common, 42.37° N, 71.06° W` (from `demoPlace` when present, the coordinates always);
  the Shutters, the readout and the key; then **the key number** (HOUSE 11.1 rule 2) on its plate: the
  label `Next window, Thu 8 Oct` (12.5 px `--ink-2`, the pane's first heading), the window's hours at
  34 px 650, `12:00–14:00`, and under it at 13.5 px `--ink-2` `2 hours, best score 64`; then the window's
  facts as two-column tiles (rule 3: a label at 11.5 px `--ink-2`, the value at 19 px 650): `Warmest
  19.8 °C`, `Highest chance of rain 0 %`, `Most rainfall 0 mm` (B17), `Strongest gust 34.6 km/h`,
  `Highest dew point 14.8 °C`, and `Sunset` with its time when the window's last hour runs past it; then
  `After that` on its own plate, a table (`Day`, `Hours`, `Length`, `Best score`; the head 11.5 px 600
  over a `--line-strong` rule, rows parted by `--line`, the figures right-aligned): `Fri 9 Oct`,
  `07:00–09:00`, `2 hours`, `80`. A window that ends at midnight reads `20:00–24:00`, one that ends on a
  later day `10:00 to Sat 08:00`, never a backwards range. With no window, a plate: `No window in the
  next 44 hours` and the stock's sentences, the closest hour named. When the file has run out, the
  label is `First window in this file, …` (the stock said `Best window in this sample` over the first
  window, whichever scored best). The stock's *What ruled hours out* card goes:
  its counts are the Shutters' right-hand column, and its sentence (`An hour can fail more than one
  rule, so these add up to more than the hours lost.`) moves to About.
- **The readout** is not a floating card (a stated departure from HOUSE 4.7, as World News'): a card
  over the Shutters would hide the hours it explains. It is a fixed block under the Shutters, as the
  stock's readout line was: its first line is held at the tallest it gets for any hour of this file at this
  width (one line at 390 px; two at 320 and below, where `ruled out by gusts and daylight, score 57` wraps),
  measured once per draw by `holdReadout()` in `app.js`, and its values line is 32 px (48 below 360 px, where
  an hour with a sunrise, a sunset or `already past` needs a third line), so nothing under the block moves
  while scrubbing; always showing the chosen hour, its text updated in place and never rebuilt: `Thu 8 Oct, 12:00` (12.5 px 620 `--ink`) and its verdict (`clears every rule,
  score 64`, or `ruled out by rainfall and gusts, score 47`; `now, ` before it for the present hour), then 11.5 px `--ink-2` values joined by
  commas: `air 18.5 °C, rain chance 0 %, rainfall 0 mm, gusts 34.2 km/h, dew point 14.8 °C, cloud
  7 %, daylight` (or `golden hour`, `night`), `sunrise 06:49` or `sunset 18:13` for the hour that holds
  one, `already past` for an hour that has ended, `not in the file` for a value the file does not have. Every value at the
  data's own precision through `js/units.js` (the stock rounded gusts to whole km/h, so 35.5 km/h
  printed `36` and 34.9 printed `35`, against a 35 km/h limit). A tap announces the sentence once
  through the live region; the slider's arrow keys add nothing (it announces its own value).
- **Hours** pane: the title, then one short label (rule 9), `Times in Boston Common’s own time,
  UTC−4.` (`the forecast’s own time` when the file names no place; `UTC+2, then UTC+1` when the clocks
  change inside the file, D-DST), the Shutters, the readout and the key, then the table on the page (it
  is the pane's view, as the Shutters are), one row an hour from the current hour (the stock's span),
  grouped under a day heading (`Fri 9 Oct`, 13.5 px 650). Columns: the time,
  the light (`day`, `night`, `golden`), air, rain chance, rainfall (B17), gusts, dew point; the head in 11 px `--ink-3`,
  sentence case, two lines where needed, the words in full and the unit on the second line from
  `hourly_units`: `Air` / `°C`, `Rain chance` / `%`, `Rainfall` / `mm`, `Gusts` / `km/h`, `Dew point` / `°C`. Values tabular,
  right-aligned, at the data's precision, negatives with U+2212. A failing hour's rules on its own line,
  11 px `--ink-2`, in the readout's words (`ruled out by gusts and daylight`), so the line under `night`
  is never read as the hour's light. A passing hour's time at 620 in `--ink`; the
  hours of a window carry a 2 px `--ink` rule in the left gutter, the Shutters' sill turned on its
  side; the chosen hour's row `--ink` at 7 %. The rows are not controls (30 px tall, no key reaches
  them): the Shutters choose the hour, and a tap on them scrolls the table until the row is in view,
  instantly. Every column head carries its own unit, so no sentence repeats the units. The stock's
  *Reading this* card goes: its words are the key and About.
- **Rules** pane: the heading is the `activity` with one short label under it, `An hour must clear every
  rule.`; then, on a plate, one `dl` row per rule: the name 13.5 px 560, the
  limit 13.5 px 600 at the right (`≤ 30 %`, `≤ 0.2 mm`, `≤ 35 km/h`, `2 to 26 °C`, `−10 to 17 °C`,
  `Daylight only`, `Golden hour, 75 min`; `Shortest window` with `2 hours`), and under it in 11.5 px `--ink-2`
  the key and what it means, then what it did to this file: `maxGustKmh: gusts, not the average wind,
  because gusts are what you feel. Rules out 18 of 48 hours.` A rule left out says `Not used`. A band
  with one end missing says `Not used: needs both min and max` (the stock printed `2 to undefined°C`
  while the scorer did not apply it). The light rule is read the way the scorer reads it, ignoring case
  (the stock showed `any hour` for `"Golden"` while scoring golden hours). Then, on its own plate,
  `Changing them`, an ordered list (it is a sequence): `In Snuggery, Options, then App Files: data/rules.json.`, `Edit the
  numbers and save; a rule you leave out is not applied.`, `Come back here; the app reads both files
  again when it returns to the screen.` The stock's *Where the forecast comes from* and *Not built, on
  purpose* cards move to About.
- **Statements**, sentences at the pane's head, 13.5 px `--ink`, the first words at 620, never a box, a
  colored edge or a dot (the example has none: its stamp says `Example data.` and About's This data
  names its place and days); on a reader's own file that has run out, `Every hour in this file has
  ended, so this is history, not a forecast. Run the Shortcut that refreshes the app.`; when
  `rules.json` cannot be used, `data/rules.json could not be used: …. The built-in rules are in use;
  the Rules pane shows them.`; with no rule in use, `No rule is in use, so every hour clears and scores
  0. The Rules pane says how to add one.`
- **No caption band** (HOUSE 11.1 rule 1). How to read the Shutters is their key; the zone is the Hours
  pane's label; the rules' source is the first step of `Changing them`. **The footer keeps one line**
  (HOUSE 4.15 exception 1): `Weather data by Open-Meteo.com`, 10.5 px, an anchor to `open-meteo.com` in
  `--ink` with a 1 px underline and a 44 px hit by padding (6 px above the text, 23 px below; 4 and 25
  on a phone on its side), on `--page` under a `--line` rule, its sides on the pane's column, the bottom
  safe-area inset under it. The hit lies inside the footer, never under the screen's edge or over the
  pane and its About key: with a bottom inset the footer is as tall as the line, 4 px and the inset;
  without one it is the hit's 44 px and its rule. Open-Meteo's terms ask for
  that link *"next to any location Open-Meteo data are displayed"*; the rest of the credit, the license's
  link and the sentence that says what was changed are About's (the terms name no place for them).
  The footer stays among what About makes inert.
- **Pressed tints**: an empty, passive `touchstart` listener on the document lets iOS draw `:active` (a
  key pressed).
- **About** (HOUSE 4.8), opened by the stamp and by the key at each pane's foot: *What the Shutters are*,
  section 1's reading and what they are not, the score sentence, the overlap sentence; *This data*,
  `label: value` lines: `Example data: Boston Common, 8 to 10 Oct 2026` and `Place: Boston Common (an
  example)` for the example, `Grid point: 42.37° N, 71.06° W, 16 m`, `Time zone: America/New York, UTC−4`,
  `Forecast: Thu 8 Oct 2026, 08:00 to Sat 10 Oct 2026, 08:00, 48 hours`, `Updated: Thu 8 Oct 2026,
  14:47 (UTC+2), from the file's own time` (or `about …, the weather service's time to the quarter
  hour`, or `… at the earliest: the forecast's first hour`), `Stale after: 6 hours`, `Rules: data/rules.json` (or the
  built-in rules and why), `Ask table: 48 rows` or `none: the file came straight from the weather
  service`; *Sources and credits*: first the credit sentence word for word (`Weather data by Open-Meteo.com,
  under CC BY 4.0. The free API is for non-commercial use. The forecast is Open-Meteo's, unmodified; the
  scores and the ask table beside it are this app's.`), then `open-meteo.com` and
  `creativecommons.org/licenses/by/4.0/` printed without their scheme, the second an anchor to the deed
  (the license's link Open-Meteo's terms ask for; HOUSE 4.8 item 3), the upstream services sentence
  from `NOTES.md`, `Forecasts are forecasts: the app scores what was predicted, not what happened.`,
  then `Type: ` and the face's credit line; *How the data gets here*: first `Build the Shortcut in
  PROMPT.md and the app shows where you are.`, then a Shortcut on the phone asks for
  its location, fetches the forecast and writes it into this app; nothing here goes online and the
  location is never written to any repository; `PROMPT.md` has the recipe; the ask-table sentence; air
  quality left out so the app stays one fetch and one file.
- **Notices** (`role="alert"`, `--sheet`, 1 px `--line-strong` edge, 8 px radius, 13.5 px `--ink`, at
  most 300 px, centered) only for a forecast that cannot be used, each of `readJson()`'s and
  `validate()`'s cases in plain words, field names without backticks: `data/snapshot.json could not be
  read (HTTP 404).`; `… is not valid JSON; it looks like an error page was written over it, which a
  Shortcut does without noticing.`; `The weather service refused the request: …. Check the latitude and
  longitude the Shortcut passes.`; `… has no hourly.time, so it is not a forecast.`; `… is missing
  hourly.wind_gusts_10m: add it to the hourly list in the address the Shortcut fetches.`; then one
  sentence: `In Snuggery, Options, then App Files shows what the file holds.` The stock's
  "opened straight off the filesystem" hint goes (it cannot apply in Snuggery). A broken replacement
  while open keeps the Shutters, the panes and the stamp, and says so in a notice with `Close`: `A new
  data/snapshot.json arrived and cannot be used. …. Still showing the forecast updated 14:47.` One
  polite live region (`<main>` loses `aria-live`). A return re-reads both files: the same files redraw
  only the stamp (and the panes when an hour has ended since, so the faint hours and the table's first
  row follow the clock); a new one re-renders in place, keeping the pane, the scroll and the chosen hour when
  it is still in the file, and says `New forecast, updated 14:47.` once.
- **Motion.** The tracer under the tabs (160 ms, `clip-path`) and About (220 ms in, out at once).
  Nothing else moves: the stock's bar-height transition goes, the scroll to a row is instant, the
  readout and the head change instantly. Under Reduce Motion every duration is 0 s. Hidden: nothing
  runs.
- **Not here, and why**: no key column, no player (time is the Shutters' axis; the slider is the one
  control on it), no focus mode (the hero is a pane of answers, not a view), no opening (HOUSE 4.11's
  default).
- **A phone on its side** (HOUSE 4.13): a 46 px header row (name over stamp, tabs beside), the Shutters
  at 12 px an hour so 48 hours fill 576 px; the pane's column centered under the header. Safe areas as
  HOUSE 4.14: the pane's foot 28 px, the footer the bottom inset.

---

## 4. Type

The house face byte for byte: `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256 `fdf1a28c…cdb262`)
and `fonts/OFL.txt` (4 703 B, `d1adfffd…be6269`), copied from `global-weather/fonts/`, the one
`@font-face` rule word for word, the family only through `--face`. **No supplement**: the app's text
needs ≤, °, –, −, U+202F and the quotes, all in the cut; the stock's midline ellipsis (not in the cut) and arrow
(a tell) leave its help sentences for words (`In Snuggery, Options, then App Files`), in `app.js` and
`PROMPT.md`. The stock had no face: the system stack (`-apple-system`, `SF Pro Text`) and the `code`
face (`ui-monospace`, `SFMono-Regular`, `Menlo`) go; the key names in Rules are set in the house face.
Scale: the pane apps' (HOUSE 11.1 rule 2), of which this app uses 10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 /
19 / 34 px (the next window's hours the one 34 px key number; tile values 19), weights 400,
560, 600, 620, 650 (the stock's 640 and 660 go), no capitals, no letter-spacing (the stock's
uppercase eyebrows and the table head, and the h1's −0.01 em, go). The Shutters' SVG text takes the
page's face; the label column is measured after `document.fonts.load('400 10.5px "Ysabeau Office"')`.
The credit line word for word in About (`Type: `) and `NOTES.md`.

---

## 5. The camera's strings

HOUSE 7.4: the camera waits for **a button named `Hours`** and taps **`Windows` and `Hours`**
(`MarketingShotsUITests.swift` 355-360, `capturePane`; `selectPane`, `MarketingCameraCase.swift`
195-200, `app.buttons[name].firstMatch`).

| String | Role | Kept |
| --- | --- | --- |
| `Hours` | `<button role="tab">` | kept, now built after the forecast parses, so the wait proves the data is in |
| `Windows` | `<button role="tab">` | kept |

Nothing else on the page is a button named `Windows` or `Hours`: the Shutters are one slider named
`Hour` (not a button), the hours are table rows, the stamp is named by its words. The app stores no
pane, so the camera has nothing to put back. **The camera needs no change.** No string is British.

---

## 6. Budget

*Measured* on the folder as built, by `node tools/check.mjs`: code as every shipped `.html`, `.css` and
`.js`; the ZIP by `build-zips.yml`'s command (`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*'
'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`), then its size on disk.

| | Before the house pass | Before the register | As built | Cap |
| --- | --: | --: | --: | --- |
| App code | 50 637 | 89 621 | 93 772 | 200 000, the house's |
| Fonts | 0 | 40 075 | 40 075 (the house face and its `OFL.txt`) | 160 000 |
| ZIP | 29 939 | 98 907 | about 101 600 (this file's own figures move the last digits) | 123 633, the house rule for the register's pass (98 907 × 1.25, rounded down) |
| Data | | | `data/snapshot.json` `e2b09817656ae50edeae8f65cbe6f1da225e38b960a33b7a5b2de59dfa9da255` (the demo refreshed on 2026-10-08); `data/rules.json` `ac9e029fe5147af3c247d59a173135014b5ae8b3f83a119fc0db0cc7afefc97a` | pinned by `check.mjs` |

Stored in the ZIP: the face and its license 37 510, app code 33 142, this file about 15 400, `NOTES.md` and
`PROMPT.md` 11 071, the data 2 353, the rest in entries. Nothing was cut, minified or stripped of a
comment. App code is under half of its cap.

---

## 7. The generated-page tells, answered

| Tell | Here |
| --- | --- |
| 1. Cream, serif display, terracotta | film base; one sans; no accent: the one hue is the data's green |
| 2. Near-black with an acid accent | the stock's `#0c0f13` ground and mint accent go for the slate print; the bright thing is the Shutters' ink |
| 3. Broadsheet | one column, the Shutters on the page and the sections on plates, hairlines between hours, radii by role |
| 4. The SaaS-card kit | the stock's five white cards with 14 px radii and the pill went; the register's plates are `--sheet` with a 1 px edge, no shadow, one heading each |
| 5. Tracked capitals | none; `NEXT WINDOW`, `AFTER THAT`, `WHAT RULED HOURS OUT`, `CHANGING THEM` and the table's `TIME RAIN GUST DEW` go |
| 6. Middle-dot joins | commas and lines; the stock's dots in the place line, the readout (`good · 72`), the pill, the lists and the hours' reasons (`gusts · daylight`) go |
| 7. Spaced em dash | none in the app's own text; the stock's in notes, help lines and the Rules keys (`maxGustKmh — gusts…`) become colons and commas |
| 8. Tinted near-black | ink `#0f1c23` as ink; no `#0c0f13` or `#101520` ground |
| 9. Monospace labels | none; the `code` face goes |
| 10. Arrows on buttons | none; the stock's arrowed menu path becomes words, in the app and `PROMPT.md` |
| 11. One accented word | none; the green `good · 72` in the readout and the amber stamp go |
| 12. Labels above content | the eyebrows go; headings are the reader's activity and the section's subject; a tile's label sits above its value (the register's tiles) |
| 13. Numbered markers | none; `Changing them` is an ordered list because it is a sequence |
| 14. Big number, small label, gradient | one 34 px key number, the next window's hours, its label naming it (HOUSE 11.1 rule 2); the window's facts as tiles with their labels above (rule 3); no gradient |
| 15. Entrances, hover everywhere | none; the stock's bar-height transition goes; hover only where the pointer can hover |

---

## 8. Where the record is

The art pass's change list (bugs B1 to B17 and items 1 to 15), the owner calls it left open, the lead's
rulings, the as-built departures, the measured budget and the phone checks are in `tools/DECISIONS.md`,
which does not ship.
