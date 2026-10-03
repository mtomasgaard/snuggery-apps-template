# Power Hours: art direction

How the app looks, moves and speaks under the template's house system (`Template/HOUSE.md`; Running
Dashboard, Finances, World News and Outdoor Window are the pane apps before it, whose frame this one
follows). `NOTES.md` says where the prices come from and on what terms; `PROMPT.md` sets a copy up.

This file holds the look as built (HOUSE, "What ships and what does not"). The record of the pass
(the change list and the eighteen faults it fixed, the owner calls, the builder's as-built notes, the
measured budget and the phone checks) is `tools/DECISIONS.md`, which does not ship.

Figures were measured on 2026-10-03 on the data as committed: `data/snapshot.json` (sha256
`cd7b0f7da4b92fd7ecbc732afd6ab81dbdbd149d3eba4c6ee0f98c2d7237e6d0`, made 1 Oct 2026, 04:01 UTC, 96
quarter hours for NO2 on Thu 1 Oct, Europe/Oslo, UTC+2; tomorrow `pending`) and `data/appliances.json`
(sha256 `f308ce89d63af77f3cbc197df84e4cc2adf1c86543af1429b48b0db966063fe1`). `python3
power-hours/tools/art/palette.py` (from `Template/`) prints every color figure, 72 checks `ok`, and
ends `ALL CHECKS PASS` (exit 0). The stock app was read in headless Chromium at 390 × 844, DPR 2,
touch, both themes, with the clock at Thu 1 Oct 2026, 08:20 UTC (10:20 in Oslo, inside the file), at
Sat 3 Oct 2026, 10:00 UTC (the file run out: what a fresh install and the marketing camera see), and
with a two-day fixture (the shipped day plus a made-up Fri 2 Oct with a trough below zero, served by
the throwaway script in `tools/.work/`) at 23:30 and the next morning: what the page draws, never how
a phone feels. Corrected after the review (2026-10-03) to the look as it was then built; the record is
`tools/DECISIONS.md`, "After review".

---

## 1. The signature: the Landing

**In one paragraph.** The market settles electricity a quarter of an hour at a time, so a day's price
is a staircase: 96 treads, each as high as that quarter's price. Power Hours draws exactly that
staircase, in blue, across every quarter the file holds, today and (after the afternoon auction)
tomorrow. Into it, the app lays the answer to the question it exists for: the chosen appliance's run,
as a **landing**, a solid ink level as long as the run (2 hours for the dishwasher), placed where the
staircase sits lowest for that long, at the height of the mean price over it, standing on two ink
posts with its times bracketed under the axis. A dashed line across the same stretch is the mean of
everything ahead, so the drop from the dashes to the landing is the saving, printed in words beside
it. On the shipped file at 10:20 the dishwasher's landing lies across 13:30 to 15:30 at 14.19 c/kWh,
35 px under the mean ahead (15.36, 8 % lower); seen as history, the cheapest two hours in the file
were 00:30 to 02:30 at 13.65. A stranger remembers the ink level lying in the trough of the blue
stairs: when, and how much lower.

**How it was found** (HOUSE 5.1):

1. *The specialist's picture.* A power exchange publishes the day-ahead result as a price per
   delivery interval, drawn as a step profile, and prices a *block* (a run of consecutive intervals,
   such as the day's base or peak) at the mean of its intervals, drawn as one level across them. A
   household's dishwasher run is a block of its own length. The Landing is that block level, laid
   where the block is cheapest, over the profile at the market's own resolution.
2. *What a person does most.* Opens the app to ask when to run the dishwasher or charge the car, and
   glances at the price now. The landing answers the first where the eyes land, on the drawing the
   camera photographs; a tap on another appliance moves it.
3. *What this data has that no other app has.* Prices per quarter hour that a reader can only take or
   leave by moving a load in time, and the reader's own run lengths. Moved to any other app, a level
   at the mean of the cheapest contiguous run has nothing to lie in. Set aside: the stock's hourly
   bars with the window's bars in blue (hourly means hide quarter-hour spreads of up to 1.42 c/kWh in
   the shipped file, and a bar was highlighted whole when only its last quarter was in the window); a
   price-duration curve (the day sorted cheapest first: a specialist's picture, but it throws away
   *when*, which is the whole question); a clock face of the day (no room for tomorrow); a heat strip
   of hours by price (color would carry the meaning, and the Shutters and the Datelines already own
   strips of time).
4. *The house's means.* One data hue for the price, ink for the answer, 10.5 px labels on a 3 px
   `--page` halo, `--line` hairlines at midnight, the house track's `now` and tracer head, no motion.

**Against the apps before it.** World News' Datelines are ticks of age on a log scale; Outdoor
Window's Shutters are rows of ink blocks over hours, the window the gap between them; Running
Dashboard's Block and Finances' Balance stack blocks of ink by quantity; Norne's Cut and US Quakes'
record stand columns and stems on a baseline; World Oil & Gas' Ledger is a strip of shares. The
Landing is the only signature that is an *answer drawn in the data's own coordinates*: one level whose
length is the reader's run, whose place is the search's result and whose height is the price paid.

**The rule it is drawn by** (`js/prices.js` and `js/staircase.js`, pure; `tools/test_prices.mjs`
proves them against an implementation written in the test):

- **The intervals.** Every entry of `hours[]` (or `lastGood.hours` when the run fetched nothing), in
  order of its instant, indexed by position, never by wall-clock hour, so a day of 92 or 100 quarters
  (daylight saving) draws and searches correctly. The step is the file's median gap (15 min here, 60
  for an hourly zone). A gap longer than one step breaks the staircase (no riser is drawn across it)
  and no run is searched across it.
- **The plot.** Left-aligned under the pane's gutter: a tick column as wide as the widest tick label
  in the face plus 6 px (about 20 px), then the plot over the rest of the width (338 px at 390 px
  wide), each interval `plot width / intervals` wide, edges rounded to whole pixels. 96 quarters:
  3.5 px each; a two-day file: 1.8 px. The plot is 120 px tall upright (96 px on a phone on its side),
  with a 16 px row above it for `now` and a 22 px axis row below.
- **The scale**, one for the whole file, fixed while the reader taps and scrubs, printed: the
  smallest step of 1, 2 or 5 times a power of ten that labels the file's lowest to highest price in
  at most six ticks, from the step at or below the lowest price to the step at or above the highest
  (shipped file: 13.62 to 16.12, so 13 to 17 in steps of 1, 30 px a cent). Tick labels 10.5 px
  `--ink-2` at the left, negatives with U+2212, a 1 px `--line` hairline across the plot at each. Zero,
  when inside the scale, is a 1 px `--line-strong` rule labeled `0`. **The scale need not start at
  zero**: the staircase is a line, its height read against printed ticks, never a bar's length, and
  starting at zero would flatten a day that moves 18 % into an 18 px wiggle; About says so.
- **The staircase**: a 1.5 px `--price` line, one tread per interval at its price, a riser between
  neighbors. Below zero, the area between the zero rule and the line is `--price` at 16 %. Intervals
  that have ended are drawn at 40 % opacity: still data, no longer a choice (section 2's figures).
- **The landing.** For the chosen appliance (the list's pressed row; the first row by default), its
  cheapest run of `ceil(hours × 60 / step)` contiguous intervals in the stretch searched (below): a
  2 px `--ink` level from the run's first interval's left edge to its last one's right edge, at the
  mean of its prices; a 1 px `--ink` post down from each end of the level to the plot's foot; under
  the axis a 2 px `--ink` bracket spanning the run, and its times centered under it in 10.5 px
  `--ink` (`13:30–15:30`; `23:00 to Fri 03:00` across midnight; `now to 12:15` when it starts in the
  current interval; a day prefix, `Fri 00:30–02:30`, when the run is not on the zone's current day;
  on a clock-change night both ends with their offsets, `Sun 02:30 (UTC+2) to 02:30 (UTC+1)`, since
  the autumn's repeated hour can start and end a run at one wall-clock time). The level, posts and
  bracket are drawn on whole device pixels (`shape-rendering: crispEdges`), so no edge row of ink is
  blended into a blue tread at the same height. On a halo, the appliance's name in 10.5 px `--ink-2`,
  with any other appliance whose run is the same intervals (`Dishwasher, Tumble dryer`), at the first
  of five spots the staircase, the zero rule, the dashed mean and the mean's label leave clear: at the
  level's right end level with it, over it or under it, then at its left end level with it or over it
  (a 3 px halo cannot hide a line that runs between the letters); with no clear spot it is left out,
  and the list names the run. Only the chosen run is drawn: on the shipped file the four
  cheapest runs lie within 0.06 c/kWh of each other in one trough, and four levels at nearly one
  height read as one.
- **The stretch searched, and the mean ahead.** From the current interval (the one holding the
  phone's present instant) to the end of the file, across midnight when tomorrow is published. When
  every interval has ended (the camera's case), the whole file, and the pane says it is history
  (section 3). The mean ahead is the mean of exactly that stretch, drawn as a 1 px `--ink-3` line
  dashed 3 on 3 across it, labeled in 10.5 px `--ink-2` on a halo, `mean 15.36`, at the first spot the
  staircase leaves clear: under its right end, over it, at its left end, then along the line from its
  right end leftwards 12 px a step, under then over. When the staircase runs through every spot on the
  line (a day whose prices swing through the mean all afternoon), the label stands in the row above the
  plot, the one row the staircase never enters, at the line's right end, or at the plot's left edge
  when `now` is there. Every placed label is checked against the staircase as computed
  (`tools/test_prices.mjs`) and as drawn (`tools/shoot.mjs`).
  The saving is the landing against this mean, the same stretch, so a run can never look dearer than
  the mean it is compared with because the cheap morning had passed (the stock compared a run from
  16:15 with the whole day's mean and printed `+4% vs mean`).
- **Now.** While the present falls inside the file: `now` in 10.5 px `--ink-3` in the row above the
  plot, at the present's x, with a 1 × 5 px `--ink-2` notch hanging to the plot's top (HOUSE 4.6's
  track). No `now` when the file has run out; the stamp says so in words.
- **The axis**, under the plot: a 1 px `--line-strong` baseline 9 px below the plot, so the tracer
  head's ring never covers a post; at each local midnight in the file a 7 px `--ink-2` tick, a `--line`
  hairline up through the plot and the day under it (`Fri 2`); 3 px `--ink-3` ticks at 50 % at 06:00,
  12:00 and 18:00 with `06:00`, `12:00`, `18:00` where room is measured. Labels are placed in order
  of priority: the landing's times, then each midnight's day, then the first day's at the left end,
  then the hours; one within 4 px of a placed label is left out (the stock printed `12` through
  `13:30–15:30`), except a midnight's day, which first moves right of its hairline, past whatever is
  placed, while it stays inside its own day (`Fri 02:45–04:45 Fri 2` at 23:30; a run `22:00–24:00`,
  centered 7 px from the midnight, no longer takes `Fri 2` with it and leaves Friday unnamed).
- **The chosen interval.** One interval is always chosen: the current one while the present is in
  the file, else the landing's first. Its column carries `--ink` at 7 % behind the plot's rows (never
  the `now` row), and the axis carries the house's tracer head under it: an 8 px `--ink` disc with a
  3 px `--page` ring and a 1.5 × 18 px `--ink` rule, an instant change, never a glide.
- **Input.** The drawing is one slider named `Time`: `role="slider"`, `tabindex="0"`,
  `aria-valuemin` 0, `aria-valuemax` the last interval's index, `aria-valuenow` the chosen one,
  `aria-valuetext` the readout in words (`Thursday 1 October, 14:15 to 14:30, 13.69 cents a kilowatt
  hour, lowest of the 55 quarter hours ahead`); arrows move one interval (up and down too),
  Page Up and Page Down four, Home and End to the ends. A tap picks the interval under the finger in
  the click after the lift; a drag that is mostly sideways scrubs (the readout and the head show the
  interval under the finger on every frame); a vertical swipe that starts on it scrolls the pane and
  picks nothing (`touch-action: pan-y pinch-zoom`; HOUSE 4.7); a second finger ends a scrub where it
  stood. Its hit is the whole drawing, about 160 px tall. Nothing in it is a `button`.
- **VoiceOver** hears the slider's value as a sentence, and once its description (a hidden paragraph
  built from the data): `96 quarter hours from Thursday 1 October, 00:00. Lowest 13.62 at 01:00,
  highest 16.12 at 08:15. Dishwasher: cheapest 2 hours ahead 13:30 to 15:30, mean 14.19 cents a
  kilowatt hour, 8 percent below the mean ahead.`
- **Caption** (the band's caption line, two lines below 640 px, one from 640, measured to fit two
  lines at 312 px): `c/kWh, spot price per 15 min, before grid rent, tax and VAT. Ink: the chosen run
  at its mean price.` (`per hour` for an hourly zone; the source's own unit, as `units()` returns it,
  in place of `c/kWh` for a source not in EUR/MWh.) Test hook: `window.__ph.staircase()` returns the
  geometry (intervals, scale, landing, mean, labels placed and dropped); `window.__ph.chosen()` the
  chosen interval.

**What About says it is not.** Not a bill: grid rent, energy tax and VAT come on top and are usually
the larger half of it, and a tariff may average the spot price over a month. Not a forecast: the
day-ahead price is fixed in one auction the afternoon before. The landing's height is the mean of the
run's quarter prices, not what an appliance pays, which depends on how its power draw varies through
the run. The scale starts near the lowest price, not at zero, and is the same for every day in the
file. A run is searched from the current quarter, so its first quarter may have begun.

---

## 2. Palette

One data color: the stock's `--accent`, `#2f6df6`, the one hue its chart spent (on the chosen
window's bars), moves to the price itself; hue 263 and chroma 0.216 kept, only lightness fitted per
theme (HOUSE 3.2). The stock's neutral price bar (`--bar`, which under the house would read as chrome),
its three semantic colors (`--good` for the cheap badge and the saving, `--warning` for the stale stamp
and the kept-curve bar, `--critical` for the dear badge and the problem card) and its shadow and ring
tokens go: words carry what they carried. `palette.py --json` prints `--price` per theme;
`tools/check.mjs` fails while `style.css` differs.

**Chrome**: HOUSE 3.1's tokens as they are, both themes (ink on page 14.80 / 14.43; ink-3 on page
4.78 / 5.88; the highest chroma 0.0239 light, 0.0223 dark).

| | Light (film base) | Dark (the print) |
| --- | --- | --- |
| Ground | `--page` `#e8eef0`, L 0.945; About and notices on `--sheet` | `--page` `#141d21`, L 0.224; `--sheet` |
| Data band | one point: `--price` `#2a67f0`, L 0.559, C 0.216, h 263 | `--price` `#3674fe`, L 0.599, C 0.216, h 263 |
| Signature | the landing, its posts and bracket: `--ink` `#0f1c23`, L 0.218, opaque | `--ink` `#e6edee`, L 0.941, opaque |
| Staircase on the page | 4.17 | 4.14 |
| Staircase on the chosen column (ink at 7 %) | 3.63 | 3.45 |
| Staircase on its fill below zero (price at 16 %: `#cad8f0` / `#192b44`) | 3.40 | 3.46 |
| Staircase across a midnight hairline | 3.23 | 2.97 |
| **The landing across the staircase** (ink against price) | **3.55** (the lowest signature figure); ΔE 0.374 to 0.416 under normal, deutan, protan and tritan vision | **3.48**; ΔE 0.336 to 0.414 |
| The landing across an ended quarter (40 %) / inside the fill below zero / on the chosen column | 8.70 / 12.05 / 12.89 | 8.53 / 12.05 / 12.03 |
| An ended quarter's staircase on the page (40 %) | 1.70, faint on purpose | 1.69 |

The band is one point because the app has one data color, inside the pane apps' family band (light L
0.400 to 0.625, dark 0.560 to 0.860). Four constraints pin it (a throwaway search in steps of 0.01,
recorded in `palette.py`): the staircase at 3:1 on the page and on the chosen column, the landing at
3:1 against the staircase it lies across, and the staircase at 3:1 against its own fill below zero.
Light passes from L 0.53 to 0.59 and takes 0.56, where ink-on-price and price-on-page are nearest
equal; dark passes from 0.57 to 0.63 and takes the middle, 0.60. In both themes "more" stands further
from the ground: the ink furthest, the blue between.

Text: tick, day and hour labels, the landing's and the mean's labels, the readout's values `--ink-2`
(6.61 / 7.76 on the page, 5.76 / 6.47 on the chosen column); `now` `--ink-3` (4.78 / 5.88), in its own
row because `--ink-3` on the chosen column is 4.16 in the light theme; values and the one large figure
`--ink`. The mean-ahead rule is `--ink-3` (4.78 / 5.88 on the page; against the landing 3.10 / 2.45,
told apart by weight, solid against dashed, and its label). Color never carries a meaning alone: the
landing is ink and level, the price is a line, below zero is under a labeled `0`, cheap and dear are
words.

**What the stock measured** (palette section 6): a price bar against the window's blue 1.23:1 light,
1.55 dark (the window told from the rest by hue alone); the muted 11 px words on their ground 4.36
(light); the stale stamp an amber with no word; the saving in green and the problem card in red.

---

## 3. The chrome, object by object

HOUSE 4.0's *panes from a pull*, with one pane: a header, a pane that scrolls inside the frame, a
fixed caption band. No units key, key column, player, focus mode or opening (the last item says why).

- **Header.** `<h1 translate="no">Power Hours</h1>`, 15 px 650, and the stamp: a `<button>` opening
  About (`aria-haspopup="dialog"`, described as *Opens About this data.*, a 44 px hit), built by hand
  in `js/units.js` from the phone's clock, the same on every locale: `Updated 06:01` (today),
  `Updated 1 Oct, 06:01`, the year when not this year. **Staleness is coverage, not age**: day-ahead
  prices are final once published, so a file is never stale while it holds the present (the stock
  turned the 16:30 UTC file amber every morning from 08:30 Oslo). Sentences in `--ink`, the rest
  `--ink-2`: `Prices ran out 36 h ago. Updated 1 Oct, 06:01` once every interval has ended (the camera's
  case); `Kept from the run before. Updated 30 Sep, 16:31` when `lastGood` is drawn (the stamp ages the
  kept prices, as the stock did); `Made after the phone's time. Updated …` when the file is more than
  an hour ahead of the clock; `Undated file.`; `Reading the prices…` while loading; `No usable prices`
  when the first file cannot be used. A problem with a later file never empties the stamp. **No row of
  tabs**: the stock's `Today` and `Tomorrow` tabs go (B1 to B3 in `tools/DECISIONS.md`); the header is two lines (HOUSE 4.3, *no
  views and no layers*).
- **The pane**, scrolling inside the frame under a still header (the stock's sticky, blurred header
  and its page scroll go; a vertical swipe scrolls the pane, section 1). Sections between `--line`
  hairlines, headed 13.5 px 650 in sentence case; rows on the page, no cards, no pills. In order:
  1. **The zone**: the heading is `zoneName` (`Norway south-west`), under it 11.5 px `--ink-2`:
     `Bidding zone NO2, day-ahead prices, Oslo time (UTC+2)` (the city from `timezone`, the offset
     from the intervals' own strings; both offsets when the file crosses a clock change).
  2. **Now**, only while the present is in the file: `Now`, then the pane's one large figure, the
     current interval's price `15.84` at 21 px 600 with `c/kWh` at 13.5 px `--ink-2` after U+202F, and
     the lead in 12.5 px `--ink-2`: `10:15–10:30, 68th lowest of today's 96 quarter hours, in the
     middle half`, (`in the day's cheapest quarter` at rank 24 or lower, `in the day's most
     expensive quarter` above 72, scaled to the day's count). Price and rank are the same interval's (the stock
     printed a quarter's price beside its hour's rank).
  3. **The Landing** (section 1) and under it **the readout**, a fixed block, not a floating card (a
     stated departure from HOUSE 4.7, as Outdoor Window's: a card over the staircase would hide what it
     explains): line one 12.5 px 620 `--ink`, `Thu 1 Oct, 14:15–14:30` (`, now` for the current
     interval); line two 11.5 px `--ink-2`, `13.69 c/kWh, lowest of the 55 quarter hours ahead`,
     or `already past` for an ended interval, `5th lowest of the file's 96 quarter hours` in history mode, `inside
     the run for Dishwasher` appended when it is; on a clock-change day each time with its offset,
     `Sun 25 Oct, 02:00–02:15 (UTC+1)`; the day's last quarter ends at `24:00`. The block's height is held at the tallest its two lines get
     for any interval at the current width (Outdoor Window's `holdReadout()` lesson), so nothing under
     it moves while scrubbing: every interval's two strings are measured on a canvas in the face and
     only the three widest of each line are laid out. Text updated in place, never rebuilt.
  4. **Cheapest runs ahead** (or `Cheapest runs in this file` in history mode), under it 11.5 px
     `--ink-2`: `Searched from 10:15 to 24:00; mean 15.36 c/kWh`. One row per appliance,
     each a `<button aria-pressed>` at least 44 px tall: the name 13.5 px 560 left, the run's times
     13.5 px 600 right (the landing's words); second line 11.5 px `--ink-2`: `2 h run, 14.19 c/kWh,
     8 % below the mean ahead` (`1 % above` when so; `paid to run it, −3.31 c/kWh` when the run's mean is
     below zero; the percentage left out when the mean ahead is zero or below, as the stock did);
     in history mode `9 % below the file's mean`; `not enough prices left` (in history, `no unbroken run
     that long in the file`) or `longer than the file` with no run. The pressed row's name at 620 in
     `--ink` with a 2 px `--ink` rule in the left gutter: the landing's level turned on its side, in
     place of the house's tracer (HOUSE 4.3), a stated departure, since a list row is not a word in a
     tabs row and the rule ties the mark to the signature. Each row's accessible name begins with its
     visible name and goes on in words, `Dishwasher, 13:30 to 15:30, 2 hours run, 14.19 cents a
     kilowatt hour, 8 percent below the mean ahead`, so VoiceOver neither spells `c/kWh` nor guesses
     the dash (HOUSE 6.1) and the camera's `label CONTAINS` match holds. Pressing a row moves the
     landing and says once through the live region `Dishwasher: 13:30 to 15:30, 14.19 cents a kilowatt
     hour.`
  5. **Statements**, sentences on the page, 13.5 px `--ink`, the first words at 620, never a box, a
     colored edge or a dot, each only when true: in history mode `These prices have all ended, so this
     is a past day, not a plan. The refresh after each day's auction brings the next.`; with no prices
     after today, from the file's own `days[]` note: `Fri 2 Oct: no prices yet when this file was made
     at 06:01. The auction publishes them about 13:00 Central European time; the refresh after that brings
     them.` (the auction's hour is Central European wherever the zone is, so the zone's city is not named)`;
     `lastGood`: `The last refresh could not reach the price service, so these are the prices it kept
     from the run made 30 Sep, 16:31.`; `carried`: `Fri 2 Oct's prices were kept from an earlier run;
     the last refresh did not get them.`; the appliance file's three cases (skipped rows, no usable
     rows, unreadable), as the stock's sentences without backticks; then always, 11.5 px `--ink-2`
     under a hairline: `The appliances are data/appliances.json: in Snuggery, Options, then App Files.
     Add a row or change a run length; the app reads it again when it comes back to the screen.`
- **Caption band** (fixed, on `--page`, 16 px gutters): the caption line (section 1), then the
  credits, 10.5 px / 15 px `--ink-2`: `source.attribution` and `source.licenceInfo` (or `licence`)
  from the snapshot, byte for byte, joined by `. ` (the stock joined them with a spaced em dash):
  `Day-ahead prices: Energy-Charts (Fraunhofer ISE). CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  from Bundesnetzagentur | SMARD.de.` Static markup holds the fallback, `Day-ahead prices:
  Energy-Charts (Fraunhofer ISE).`, so a broken snapshot cannot take the attribution down; the data's
  words replace it once parsed. When `source.publishable` is `false`, a second line in `--ink`:
  `These prices are licensed for private and internal use only. Do not republish them.` (both lines on
  screen in every state). The stock footer's auction sentence moves to About.
- **About** (HOUSE 4.8), opened by the stamp: *What the Landing is* (section 1's reading and what it is
  not); *This data*, `label: value` lines: `Zone: NO2, Norway south-west`, `Time zone: Europe/Oslo,
  UTC+2`, `Prices: Thu 1 Oct 2026, 00:00 to Fri 2 Oct 2026, 00:00, 96 quarter hours`, `Updated: Thu 1
  Oct 2026, 06:01 (UTC+2)`, `Source unit: EUR/MWh, shown divided by 10 as c/kWh, euro-cents per kWh,
  the unit a household tariff is written in`, `Scale: 13 to 17 c/kWh for the whole file`, `Next day:
  Fri 2 Oct, not in this file (no prices published for 2026-10-02)` (the day in the house's words first,
  the file's own note after it), `Appliances: data/appliances.json, 4 rows`,
  `Ask table: 32 rows`; *Sources and credits*: the two credit sentences, `api.energy-charts.info` and
  `creativecommons.org/licenses/by/4.0` printed without a scheme, which 16 zones are CC BY and that
  the rest are private use (from `NOTES.md`, one sentence), then `Type: ` and the face's credit line;
  *How the data gets here*: in the template, a job refreshes the file after each day's auction (13:30
  and 16:30 UTC), and a Shortcut carries it to the phone; nothing here goes online; the stock's ask
  sentence (the table written when the prices were fetched carries the whole day and the stretch then
  ahead); `Day-ahead prices are set once a day, in an auction, for every interval of the following
  day.`
- **Notices** (`role="alert"`, `--sheet`, 1 px `--line-strong` edge, 8 px radius, 13.5 px `--ink`, at
  most 300 px, centered) only for a file that cannot be used, each of `readJson()`'s and
  `validate()`'s cases in plain words, field names without backticks: `data/snapshot.json could not be
  read (HTTP 404).`; `… is not valid JSON; it looks like an error page was written over it, which a
  Shortcut does without noticing.`; `… has no prices: hours is empty and there is no lastGood to fall
  back on.`; `… says schema 2; this app reads schema 1.`; `12 of 96 prices have no number or no
  time.`; then `In Snuggery, Options, then App Files shows what the file holds.` The stock's
  "opened straight from the filesystem" hint goes. A broken replacement while open keeps the drawing,
  the pane and the stamp, and says so in a notice with `Close`: `A new data/snapshot.json arrived and
  cannot be used. …. Still showing the prices updated 06:01.`; when the file could not be read at all,
  `data/snapshot.json could not be read (HTTP 404). Nothing new arrived. Still showing the prices
  updated 06:01.` One polite live region; `<main>` loses `aria-live`.
- **Return and the clock.** A return re-reads both files: the same files redraw only what the clock
  moves (the stamp, `now`, the faint quarters, Now, the stretch and the landing); a new snapshot
  re-renders in place, keeping the chosen appliance, the chosen interval when it is still in the file
  and the pane's scroll, and says `New prices, updated 16:31.` once. While visible, the same clock
  redraw runs at each step boundary (one timeout to the next quarter, cleared when hidden), so `now`
  and Now never show a quarter that has ended.
- **Motion.** About (220 ms in, out at once). Nothing else moves: the stock's color transitions on tabs
  and rows go, the landing and the head change instantly. Under Reduce Motion every duration is 0 s.
  Hidden: nothing runs.
- **Not here, and why.** No units key: the quantity is money per energy, not a unit with an SI and a
  US form; the source's EUR/MWh is printed in About, and a stored key would make the camera's
  `c/kWh` wait depend on a setting (a stated departure from HOUSE 4.2; owner call 1 in `tools/DECISIONS.md`). No key column, no
  player (time is the staircase's axis; the slider is the one control on it), no focus mode (the hero
  is a pane of answers, not a view, as for the four pane apps before it), no opening (HOUSE 4.11's
  default).
- **A phone on its side** (HOUSE 4.13): a 46 px header row (name over stamp), a one-line caption, the
  plot 96 px tall over the width; the pane left-aligned, 20 px gutters from 700 px wide. Safe areas
  as HOUSE 4.14.

---

## 4. Type

The house face byte for byte: `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
`fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
`d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copied from
`global-weather/fonts/`, the one `@font-face` rule word for word, the family only through `--face`.
**No supplement**: the app writes digits, U+2212, U+202F, the en dash, `…`, the curly quotes and
`|`, all in the cut; the stock's midline ellipsis (`⋯`, not in the cut) and arrow (`→`, a tell) leave
its help sentences for words (`in Snuggery, Options, then App Files`), in `app.js` and `PROMPT.md`
(the data file's own `_comment` keeps them: data is not the pass's). **No face is removed**: the
stock shipped none; its system stack (`-apple-system`, `SF Pro Text`, `Segoe UI`) and its `code` face
(`ui-monospace`, `SFMono-Regular`, `Menlo`) go, and file names are set in the house face with
`translate="no"`. Scale 10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 / 21 px (the stock's 32 px price becomes
21; its 8.5 to 9.5 px chart text, scaled further by the SVG's `viewBox` to about 7.6 px at 320 px
wide, becomes 10.5 px drawn in CSS pixels), weights 400, 560, 600, 620, 650 (the stock's 640 and 660
go), no capitals, no letter-spacing (the stock's uppercase eyebrows at 0.04 em and the h1's −0.012 em
go). The drawing's SVG text takes the page's face; the tick column and every label's room are measured
after `document.fonts.load('400 10.5px "Ysabeau Office"')`. The credit line word for word in About
(`Type: `), `NOTES.md` and the template's `LICENSE` (the lead's).

---

## 5. The camera's strings

HOUSE 7.4 (plan 0011 D39): the camera waits for **visible text containing `c/kWh`**
(`MarketingShotsUITests.swift` 257 and 370, `webText`, a case-insensitive `CONTAINS` on any element's
label), photographs the pane in full screen (`14-power-hours`, `readme-power-hours-1`), then finds **the
button whose label contains `Car charging`** (line 373, `app.buttons.matching(label CONTAINS …)`), taps it, waits
1.5 s and photographs the pane again (`readme-power-hours-2`): the car's four-hour landing.
`MarketingClipsUITests.swift` and `MarketingCameraCase.swift` do not name the app.

| String or gesture | Where | Kept |
| --- | --- | --- |
| `c/kWh` in visible text | Now's unit, the readout, the runs' second lines, the caption line; written only after the snapshot parses, and **never in `index.html`**, so the wait still proves the data is in (`check.mjs` asserts the static markup holds none; `shoot.mjs` asserts none is in the DOM while the snapshot is held back) | kept |
| a tap on the button whose label contains `Car charging` | the runs list's third row, a `<button aria-pressed>` whose accessible name begins `Car charging, ` (its visible name, then its run in words); pressing it moves the landing | kept (`shoot.mjs` taps it at the camera's 440 × 956 in the run-out state: the level `Thu 00:00–04:00`, 32 px longer than the dishwasher's `Thu 00:30–02:30`, which is 33 px long) |

The app stores nothing, so the camera has nothing to put back. No string is British. The pane's room to
scroll, *measured* by `shoot.mjs` (`scrollHeight − clientHeight`): 69 px at 390 × 844 inside the file; 0
at 390 × 844 run out; 0 at the camera's 440 × 956, inside the file or run out. So the second pane is a
tap, not the stock's swipe, which moved nothing there. The washing machine, tapped first, lands
`Thu 01:00–02:30` in the run-out state, 8 px from the dishwasher's left end and on its right end: a
repeat of the first pane with another row pressed. The car's `Thu 00:00–04:00` is another landing.

---

## 6. Budget

*Measured* by `node tools/check.mjs`: code as every shipped `.html`, `.css` and `.js`; the ZIP by
`build-zips.yml`'s command (`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*'
'scripts/*' 'dist/*' 'raw/*'`), then its size on disk.

| | Before the pass | As built | Cap |
| --- | --: | --: | --- |
| App code | 46 466 (`index.html` 808, `style.css` 9 234, `app.js` 36 424) | about 84 500 (`index.html`, `style.css`, `app.js` and the three modules in `js/`; `check.mjs` prints each) | 200 000, the house's |
| Fonts | 0 | 40 075 (the house face and its `OFL.txt`) | 160 000 |
| ZIP | 25 977 (9 entries) | about 96 000 (14 entries; the face and license store 37 510; this file's own size moves the last digits) | 97 000, the lead's ruling (plan 0011 D39); 70 305 by D5 (25 977 × 1.25, rounded down, plus 37 834 for the face) could not fit an app smaller than the face it gains |
| Data | `data/snapshot.json` `cd7b0f7d…2d7237e6d0`; `data/appliances.json` `f308ce89…b966063fe1` | the same bytes | pinned by `check.mjs` |

**The ZIP cap: 97 000 B, the lead's ruling (plan 0011 D39), nothing cut.** The stock ZIP is smaller than
the face it gains, the case HOUSE 8 names for the loop apps (D27, D30, D34: Finances ruled 131 000,
World News 88 000, Outdoor Window 99 000). The build applied the whole list, cut nothing and never
minified or stripped a comment, and measured 93 754 B; the raise leaves about 3 000 B for the fix
stages, and `check.mjs` carries the cap as `ZIP_CAP` with `ZIP_RULED` set. **The data's hashes pin the private copy**: on the public repository the refresh
job rewrites `data/snapshot.json` twice a day, so the lead's mirror leaves the public `data/` in place,
as for World News.

---

## 7. The generated-page tells, answered

| Tell | Here |
| --- | --- |
| 1. Cream, serif display, terracotta | film base; one sans; no accent: the one hue is the price's blue |
| 2. Near-black with an acid accent | the stock's `#0b0e13` ground and electric-blue accent go for the slate print; the bright thing is the landing's ink |
| 3. Broadsheet | one column, hairlines between sections, radii by role |
| 4. The SaaS-card kit | the stock's four white cards at a 16 px radius with a two-layer shadow, and its pill badges, go; sections on the page |
| 5. Tracked capitals | none; `RIGHT NOW`, `CHEAPEST WINDOW · FROM 10:15` and `READING THESE NUMBERS` go |
| 6. Middle-dot joins | commas and lines; the stock's dots in the zone line, the readout, the runs' prices and the section heads go; the one `|` left is inside the license's own words |
| 7. Spaced em dash | none in the app's own text; the stock's in the credits join, the notes, the kept-curve bar and the problem hint become full stops, colons and commas |
| 8. Tinted near-black | ink `#0f1c23` as ink; no `#0b0e13` or `#151a22` ground |
| 9. Monospace labels | none; the `code` face goes |
| 10. Arrows on buttons | none; the stock's `⋯ menu → App Files` becomes words, in the app and `PROMPT.md` |
| 11. One accented word | none; the green `−6% vs mean`, the blue chosen name, the amber stamp and the red problem title go |
| 12. Labels above content | the eyebrows go; headings are the zone's name and the sections' subjects |
| 13. Numbered markers | none |
| 14. Big number, small label, gradient | the stock's 32 px price over a `RIGHT NOW` eyebrow with a colored badge becomes one 21 px figure with a lead in words |
| 15. Entrances, hover everywhere | none; the stock's color transitions go; hover only where the pointer can hover |

---

## 8. The record

The change list (twelve items), the eighteen faults the stranger's run found and how each is pinned,
the owner calls, the builder's as-built notes, the review's findings and what each changed, the
measured budget, the tools' output and the phone checks are in `tools/DECISIONS.md`, which does not
ship.
