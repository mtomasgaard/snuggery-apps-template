# Hello Live: art direction

How the app looks, moves and speaks under the template's house system (`Template/HOUSE.md`; Power
Hours, Outdoor Window, World News, Finances and Running Dashboard are the loop apps before it). Hello
Live is the one app of HOUSE 4.0's last kind, *one live card*: a header, a card of data, a caption
band, nothing to tap but the stamp. It is the loop's proof (`Template/README.md`, "Install Hello Live
first"), and this pass keeps it that: the file it reads, the job that writes it and the Shortcut that
carries it do not change.

The record of the pass (owner calls, as-built notes, phone checks) is in `tools/DECISIONS.md`, which
does not ship.

Figures were measured on 2026-10-03 on the data as committed: `data/snapshot.json` (sha256
`db50d9add6f0d940671235ee12a3fbe7f2a4f7e90e9620e3f6899539f04333a8`, 545 B, made 1 Oct 2026, 01:59:56
UTC; a headline `01:59 UTC`, a caption, three rows and an `ask` table of three rows). `python3
hello-live/tools/art/palette.py` (from `Template/`) prints every color figure, 54 checks `ok`, and ends
`ALL CHECKS PASS` (exit 0). The stock app was read in headless Chromium at 390 × 844, DPR 2, touch,
both themes, with the clock at Sat 3 Oct 2026, 10:00 UTC (12:00 in Oslo: the ran-out state a fresh
install and the marketing camera see on the committed file), and at 320 × 568 and 844 × 390
(`tools/.work/stock.mjs`, a throwaway; its log is `tools/.work/stock-run.txt`). Text widths were
measured on a canvas in the house face (`tools/.work/measure.mjs`). What the page draws, never how a
phone feels.

---

## 1. The signature: the Time Card

**In one paragraph.** A time clock stamps a card with the minute an employee clocks in, one row per
day, and a week of punches down the card is the proof that somebody turned up. Hello Live's file is
written about every hour by a job on a server and carried to the phone by a Shortcut, and the only
thing the app can prove is that files keep arriving. So under the headline it draws a **time card**:
seven rows, today at the top, each row the day's 24 hours on one printed scale; in each row one punch
of ink at the minute a file this app has read was written, and from the punch a tail of ink running to
the minute this app first read it, which is the earliest the phone can be known to have had it. A
`now` notch stands in today's row. On a fresh install the card holds one punch with its tail; after a
week of the owner's loop it holds a column of punches at the hour the Shortcut runs, each with a short
tail, and a gap where a day's hop did not happen. On the committed file at 12:00 Oslo on 3 Oct the
card shows one punch in Thursday's row at 03:59, its tail running off the row's right end and along
Friday's and Saturday's rows to `now`: a file first read two days after it was written, which is
exactly what a stranger with that install should see. A file written before the card's seven days and
first read inside them (the starter pack's file, once it is more than a week old) draws no punch and
the part of its tail that lies inside: through every row from the oldest row's left edge to `now`, and
the card's name says its writing lies before the seven days. A stranger remembers the punches down the card:
when each file was written, and how long each took to get here.

**How it was found** (HOUSE 5.1):

1. *The specialist's picture.* A monitoring desk draws a scheduled job as a heartbeat: a strip of time
   with a mark at every check-in, and the proof of life is that the marks keep coming at the period
   promised. The older document for the same fact is the time clock's card, a row per day and a punch
   at the minute. This data is a check-in: `generatedAt` is the one measured quantity in the file (the
   headline and the three rows are that instant written four ways: `01:59 UTC`, day 274, week 40,
   minute 119), and the app itself measures a second one, the minute it first read each file. The
   Time Card is those two instants per file, laid on the clock the card is ruled by.
2. *What a person does most.* Opens the app, reads the time at the top, and asks whether it changed
   since the last time: "if it updates, your loop works" (`README.md`). The card answers at a glance,
   without remembering yesterday's number: the punches are the updates, and the tails are how long
   each took.
3. *What this data has that no other app has.* Nothing but its own timestamp, hourly, from a job that
   fetches nothing: no quantity to chart, no place, no series. Every other loop app draws what its
   file holds; this one can only draw the fact of the file. Moved to any other app a time card of
   arrivals would be a footnote; here it is the whole subject. Set aside: a 24-hour strip of the last
   day only (a daily Shortcut puts one punch on it and the rhythm never shows); a year ruler and a day
   ruler with the headline's instant marked (true to the three rows, but a progress bar that says
   nothing about the loop); a ring of the day (Power Hours set it aside, and it has no room for days);
   a lag figure alone in words (the stamp already says it).
4. *The house's means.* `--ink` punches and tails on `--page`, `--line` hairlines for the rows and the
   quarter days, `--line-strong` for the axis, `--ink-2` and `--ink-3` for the labels and `now`, the
   house face at 10.5 px, no motion. No second accent, no glow, no face.

**Against the apps before it.** World News' Datelines are ticks of age on a logarithmic scale at the
file's making, an index of how fresh six desks are; Outdoor Window's Shutters are rows of ruled-out
hours across a forecast still to come; US Quakes' record is stems by magnitude over thirty days;
Running Dashboard's Block and Finances' Balance stack blocks by quantity; Power Hours' Landing is an
answer drawn into a price. The Time Card is the only signature made of the loop itself, rows of days
on a clock axis with a punch per arrival, and the only one that records something the app measured on
the phone (the first reading) beside something the file says (the writing). Snug Kart's Lap Chart
records what the person did; this records what the loop did.

**The rule it is drawn by** (`js/card.js`, pure; `tools/test_card.mjs` proves it against an
implementation written in the test):

- **The record.** Each file this app parses adds one entry, `[written, firstRead]` in milliseconds:
  `written` is the file's `generatedAt`; `firstRead` is the phone's clock at the first successful parse
  of a file with that `generatedAt`. Entries are kept in `localStorage` under `hello-live.card`
  (JSON, newest last, at most 400 entries, one per distinct `generatedAt`), every read and write in
  `try`/`catch`; when storage is unavailable the record is this page's life, so the card holds the
  current file's punch with a tail to this reading. A stored value that does not parse is an empty
  record, and storage is not called unavailable for it. A file whose `generatedAt` does not parse adds no
  entry and no punch (the stamp says `Undated file.`). The `ask` rows and the data file are never
  written.
- **The rows.** Seven, today's at the top, each labeled at the left in 10.5 px `--ink-2` in the house's
  tick form (`Sat 3`, `Fri 2`, `Wed 30`), the label column 40 px wide (`Wed 30` measures 33.5 px in
  the face). Rows take the pane's free height, in whole pixels from 14 px to 40 (`rowFor()`: the
  pane's height less everything else on the page, less 38, over seven): 40 at 390 × 844, 35 at
  375 × 667, 16 at 320 × 568, 14 on a phone on its side, where there is no free height. So the one
  card fills the screen it has instead of leaving half of it blank. Rows are parted by 1 px `--line`
  hairlines at each row's foot; today's row
  carries `--ink` at 4 % over the page behind it (`#dfe6e8` / `#1c2529`). Above the rows a 16 px row
  for `now`; under them a 22 px axis row. The drawing is 16 + 7 × the row + 22 px tall: 136 at
  14 px rows, 318 at 40. The day labels sit at the row's middle.
- **The scale**, printed and the same in every row: hours of the day on the phone's clock, left to
  right from 00:00 to 24:00, at a whole number of pixels per hour, `min(24, floor((pane width − 40) /
  24))`: 13 px an hour at 390 px wide (a 312 px plot; 1 px is 4.6 min), 12 at 375, 10 at 320 and at the
  312 px of 125 % zoom, 14 at 430, 24 on a phone on its side. The axis: a 1 px `--line-strong`
  baseline; 1 × 3 px `--ink-3` ticks at 50 % at every hour; 7 px `--ink-2` ticks with 10.5 px `--ink-2`
  labels at `00:00`, `06:00`, `12:00`, `18:00` and `24:00` (24.4 px each in the face, so all five fit
  from 10 px an hour up; `24:00` ends at the plot's right edge); vertical 1 px `--line` hairlines up
  through the rows at 06:00, 12:00 and 18:00. On a clock-change day the row still runs 00:00 to 24:00
  by wall-clock hour, so the autumn's repeated hour draws on itself and the spring's missing hour is
  empty; About says so.
- **The punch**: for every entry whose `written` falls in the seven days, a 2 px `--ink` stem 4 px
  short of its row (2 × 10 at 14 px rows, 2 × 36 at 40), rising from its row's foot at `x = (local hour + minute / 60) × px per hour`, rounded to a whole
  pixel. Two punches under 2 px apart draw over each other and About's count still counts both.
- **A file written before the seven days** and first read inside them: no punch, and the part of its
  tail inside the card: every row older than the reading's whole, from the oldest row, then the
  reading's row from its left edge to `firstRead` — the starter pack ships committed data, which is
  more than seven days old on many first launches, so this is the card a fresh install often shows.
- **The tail**: from the punch's top, a 2 px `--ink` line at the row's top edge from `written` to
  `firstRead`; when `firstRead` falls on a later day the tail runs to the row's right end and continues
  from the left end of each later day's row (which lies above it) to `firstRead`; a tail shorter than
  1 px at the scale is not drawn (a file read within about five minutes of its writing shows a bare
  punch, which is the loop at its best). A `firstRead` before `written` (a phone whose clock is behind
  the server's) draws no tail and About names the count of such files.
- **`now`**: in today's row, a short 1 px `--ink-2` notch rising from the row's foot at the present
  minute, 9 px tall and never more than the row less 9 (5 px at 14 px rows, 7 at 16, 9 from 18), so it
  is never the shape of a punch and never reaches a tail at the row's top; a 1 px `--line` hairline
  runs from the row's top to the notch, under the ink, and `now` stands over it in 10.5 px `--ink-3` in
  the row above the card, centered on the notch and kept inside the plot. The notch is short on purpose: a
  notch the height of a punch would close a fresh import's tail into a bracket. The part of today's row right of `now` is empty by construction. Both move once a
  minute while the page is visible, instantly, never by an animation.
- **Days with nothing** draw as empty rows: the record has no entry there, and an empty row is the
  honest picture of a day the loop did not reach this phone (or the app was not opened: About says
  which it cannot tell).
- **Input.** None. The card is a `<svg role="img">` whose accessible name is built from the record:
  `Time card, 7 days: 5 files read; the latest written Thursday 1 October, 03:59, first read here
  Thursday 1 October, 09:12.`; for a file written before the seven days, `Time card, 7 days: 1 file
  read; the latest written Thursday 1 October, 03:59, before these 7 days, first read here Saturday 10
  October, 10:00.`; with a record but nothing in the seven days, `Time card, 7 days: no file read in
  these 7 days.`; `no file read` only for an empty record. Nothing in it is a control; a swipe over it scrolls the pane. Test hook:
  `window.__hl.card()` returns the geometry (the row height, px per hour, rows, punches, tails, labels placed and
  dropped), `window.__hl.record()` the record as read.
- **Caption** (the band's caption line, fixed at two lines below 640 px of width and one from 640;
  measured 495.9 px at 11 px in the face, inside two lines of 280 px at the 312 px zoom width):
  `A mark where each file was written, by day; its tail runs to its first reading here. Hours: this
  phone’s, UTC+2.` The offset is built from the phone's clock by `js/units.js` (`full()`'s zone word),
  so a phone in another zone prints its own.

**What About says it is not.** Not the job's log: the card holds only files this app parsed on this
phone, so an hourly job whose files a daily Shortcut carries shows one punch a day, and an empty day
can be a job that did not run, a Shortcut that did not run, or an app that was not opened. The tail
ends at the app's first reading, which is at or after the Shortcut's copy, never before it; it says
how long the file took to be seen here, not how long any one hop took. The record lives in this app's
storage on this phone, is at most 400 files long, and goes when the app is removed or its storage
cleared; what the card shows then starts again from the current file. The hours are the phone's clock,
while the headline is the file's own words in UTC.

---

## 2. Palette

**No data color.** The app's data is a clock time and three whole numbers; nothing in it is a quantity
that color could carry, and the picture of its loop is ink alone. So the data band of HOUSE 3.2 is
empty here, the signature keeps the whole lightness range to itself, and every hue of the stock look
goes: its green accent (`#2f6f4f` / `#7ec79b`, the `ago` words) and its red (`#8a3324` / `#e5907f`,
the `stale` words, the problem card's edge and title). Words carry what they carried: staleness is a
sentence in `--ink`, a problem is a notice. `palette.py --json` prints the chrome tokens themselves;
`tools/check.mjs` holds `style.css` to them in both themes. The stock's own system-font grays go with
its cards.

**Chrome**: HOUSE 3.1's tokens as they are, both themes (ink on page 14.80 / 14.43; ink-2 on page
6.61 / 7.76; ink-3 on page 4.78 / 5.88; the highest chroma 0.0239 light, 0.0223 dark; the page in
OKLCh L 0.945, C 0.007, h 220 light and L 0.224, C 0.015, h 227 dark).

| | Light (film base) | Dark (the print) |
| --- | --- | --- |
| Ground | `--page` `#e8eef0`, L 0.945; today's row `--ink` at 4 % over it, `#dfe6e8` (1.08 against the page); About and notices on `--sheet` | `--page` `#141d21`, L 0.224; today's row `#1c2529` (1.10); `--sheet` |
| Data band | empty: no quantity is carried by color | empty |
| Signature | the punches and tails: `--ink` `#0f1c23`, L 0.218, C 0.023, opaque | `--ink` `#e6edee`, L 0.941, C 0.008, opaque |
| A punch on the page | 14.80 | 14.43 |
| A punch on today's row | 13.73 | 13.16 |
| A punch across a row's or an hour's hairline (`--line`) | 11.47 | 10.36 |
| **A punch across the axis baseline (`--line-strong`)** | **4.52** (the lowest signature figure) | **4.05** |
| Ink against the page under normal, deutan, protan and tritan vision | ΔE 0.723 to 0.729 | 0.715 to 0.718 |
| The `now` notch (`--ink-2`, a mark) on the page / on today's row | 6.61 / 6.13 | 7.76 / 7.07 |
| An hour tick (`--ink-3` at 50 %) on the page | 1.98, faint on purpose, as the house track's step ticks | 2.48 |
| A row hairline on the page / on today's row | 1.29 / 1.20, a separator | 1.39 / 1.27 |

Text: the day labels, the axis hours, the stamp, the lead, the caption line and the credits in `--ink-2`
(6.61 / 7.76 on the page; today's label 6.13 / 7.07 on its row); `now` in `--ink-3` in its own row
(4.78 / 5.88); the headline, the row values and a stale sentence in `--ink` (14.80 / 14.43); About and
a notice on `--sheet` (ink 16.40 / 12.87, ink-2 7.32 / 6.92; a notice's edge 3.27 / 3.56 on the page).
Today's row is told from the others by its `now` notch and label as well as by its tone, so the 4 %
tint carries nothing alone.

**What the stock measured** (palette section 5): the green `ago` words 5.53 on the page (light) and
9.30 (dark); the red `stale` words 7.52 and 7.62; red against green 1.36 and 1.22, ΔE 0.062 and 0.041
under deutan vision, so the one thing the stock said in color was the thing a color-blind reader could
not see; the dim labels 5.28 on the white card; the card against the page 1.08 with a 1.19 edge.

---

## 3. The chrome, object by object

HOUSE 4.0's *one live card*: a header, one card that is the data, a fixed caption band. No row of tabs
and words, no key column, no player, no readout card, no focus mode, no units key, no opening (the
last item says why).

- **Header.** `<h1 translate="no">Hello Live</h1>`, 15 px 650 (the stock's 16.8 px 700), and the stamp:
  a `<button>` opening About (`aria-haspopup="dialog"`, described as *Opens About this data.*, a 44 px
  hit), built by hand in `js/units.js` from the phone's clock, the same on every locale: `Updated
  03:59` (today), `Updated 1 Oct, 03:59`, the year when not this year. A lead sentence in `--ink`, the
  rest `--ink-2`: `Stale. Updated 1 Oct, 03:59` when the file is 6 hours old or more (the stock's
  threshold, kept and now said in About: the job writes about hourly, so six hours without a new file
  means a hop has not run); `Made after the phone’s time. Updated 3 Oct, 11:59` when `generatedAt` is
  more than an hour ahead of the clock (the stock printed `just now`); `Undated file.` when it does not
  parse (the stock printed the raw string); `Reading the file…` while loading; `No usable file.` when
  the first file cannot be used. The words move once a minute while the page is visible. **No row of
  tabs**: the header is two lines (HOUSE 4.3, *no views and no layers*).
- **The pane**, scrolling inside the frame under a still header (the stock's page scroll goes; at
  390 × 844 and 844 × 390 nothing scrolls). Content on the page between hairlines, no cards, no pills,
  left-aligned, 16 px gutters (20 from 700 px). In order:
  1. **The headline**: the pane's one large figure, the file's `headline` string as the file gives it,
     21 px 600 `--ink` (`01:59 UTC`, 95.4 px; the stock's 41.6 px at 640 with −0.02 em of tracking
     becomes 21 at 600 and 0), `overflow-wrap: anywhere` so a long string can never widen the page;
     at its right on the same baseline the lead in 12.5 px `--ink-2`, the same instant on the phone's
     clock: `03:59 on this phone’s clock` (139.7 px; the two fit one line from 320 px). Under them the
     file's `caption`, 12.5 px `--ink-2`, as the file gives it (`Written by a GitHub Action, copied
     here by a Shortcut.`), left out when the file has none.
  2. **The Time Card** (section 1), under a 13.5 px 650 heading `Time card` and a hairline.
  3. **The rows**: a `dl` under a hairline, one row per entry of `runs[]`, 12.5 px, the label `--ink-2`
     at the left and the value `--ink` at 560 right-aligned and tabular, 28 px rows parted by `--line`
     hairlines; the values as the file gives them, passed through `si()` so a value with a known unit
     gets its U+202F (the committed values are bare numbers). The owner's rule for the pane apps (the
     short facts as a table) is met with the table after the card, since here the facts are the
     headline's instant three more ways (owner call 1).
  Nothing under the rows: the stamp (`Stale. Updated 1 Oct, 03:59`) and About (`Stale after: 6 h`)
  carry staleness, since a sentence there would only repeat the stamp, and the owner asked on
  2026-10-06 for less text on every app's front page (owner call 10).
- **Caption band** (fixed, on `--page`, 16 px gutters, a 1 px `--line` rule on top): the caption line
  (section 1), then the credits, 10.5 px / 15 px `--ink-2`, the app's constant, byte for byte, in
  static markup and compared by `check.mjs`: `Data: this repository’s own refresh job; no outside
  source.` (251.4 px at 10.5 px: one line at 320). The file names no source and fetches nothing, so the
  credit says exactly that; the font's credit is in About.
- **About** (HOUSE 4.8), opened by the stamp (220 ms up, closed at once; `Close` at the head and the foot,
  Escape, Tab held inside the sheet, focus back on the stamp): *What the Time Card is* (section 1's reading and what it
  is not); *This data*, `label: value` lines: `Written: Thu 1 Oct 2026, 03:59 (UTC+2)`, `In the file:
  01:59 UTC`, `Rows: 3`, `Ask table: 3 rows`, `Files read here: 1 file, since 3 Oct` (from the record; with storage
  refused it adds `; storage is unavailable, so the record is this page’s`), `Read before written: 1 file
  (a clock behind the server’s), drawn without a tail` (only when there is one), `Stale after: 6 h`,
  `Card: 7 days, 13 px an hour at this width`; *Sources and credits*: `The file is
  written by this repository’s own refresh job, scripts/refresh_hello_live.py, which fetches nothing;
  there is no outside source and nothing to license.`, then `Type: ` and the face's credit line word
  for word; *How the data gets here*: a workflow in the repository rewrites `data/snapshot.json` about
  every hour (never "at 7 past": the schedule is best-effort, as `README.md` says), a Shortcut carries
  it to the phone, the app reads it again whenever it comes back to the screen and adds the file to
  the card; the `ask` rows are the table a question about this app's data is answered from; what the
  card cannot tell (section 1).
- **Notices** (`role="alert"`, `--sheet`, 1 px `--line-strong` edge, 8 px radius, 13.5 px `--ink`, at
  most 300 px, centered on the plate) only for a file that cannot be used, in the file's terms, field
  names without backticks and no code face: `data/snapshot.json could not be read (HTTP 404).`;
  `data/snapshot.json is not valid JSON; it looks like an error page was written over it, which a
  Shortcut does without noticing when a web address answers with one.`; `data/snapshot.json parsed,
  but has no headline or no generatedAt. An error reply is valid JSON too.`; then `In Snuggery,
  Options, then App Files shows what the file holds.` The stock's hint for a page opened straight from
  disk stays, as words: `Opened from a file, a browser blocks the read: serve the folder with a local
  web server.` (owner call 2). The stock's `problem()` emptied the page: a broken replacement while
  open keeps the headline, the card, the rows and the stamp, and says so in a notice with `Close`: `A
  new data/snapshot.json arrived and cannot be used. It is not valid JSON. Still showing the file
  updated 03:59.`; a file missing on a return says `data/snapshot.json could not be read (HTTP 404).
  Nothing new arrived. Still showing the file updated 03:59.` Under either, as on the first-load
  plates, the next step: `In Snuggery, Options, then App Files shows what the file holds.` One polite live region; `<main>` loses
  `aria-live`.
- **Return and the clock.** A return (`visibilitychange`, and Snuggery fires it when a new file lands
  while the app is open) re-reads the file: the same file redraws only what the clock moves (the
  stamp, `now`); a new file updates the headline, the lead, the caption, the rows and
  the stamp in place, adds its punch, and says `New file, written 03:59.` once through the live
  region. While visible, one timeout to the next whole minute moves the stamp's words and `now`;
  cleared on `hidden` and `pagehide`.
- **Motion.** About (220 ms in on `--sheet-in`, out at once). Nothing else moves: the punches, `now`
  and the stamp change instantly. Under Reduce Motion every duration is 0 s. Hidden: nothing runs.
- **Not here, and why.** No units key: nothing to convert (the file's numbers are counts, and the one
  clock question, UTC against the phone's, is answered by the lead; owner call 9). No row of words, no
  key column, no readout card (nothing to tap: the card is a picture, HOUSE 4.7, *nothing to tap*), no
  player (there is no time to scrub: the card is the past as it happened), no focus mode (the hero is
  a card of numbers, not a view, as for the pane apps), no opening (HOUSE 4.11's default: the arrival
  is the data appearing, and the camera films the first four seconds after launch).
- **A phone on its side** (HOUSE 4.13): a 46 px header row (name over stamp), a one-line caption, the
  card at 24 px an hour (a 576 px plot); the pane scrolls if it must. Safe areas as HOUSE 4.14.

---

## 4. Type

The house face byte for byte: `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
`fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
`d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copied from
`global-weather/fonts/`, the one `@font-face` rule word for word, the family only through `--face`.
**No supplement**: the app writes digits, U+202F, U+2212, the en dash, `…`, the curly quotes and the
colon, all in the cut; the stock's midline ellipsis (U+22EF, not in the cut) and arrow (U+2192, a tell) leave
its help sentence for words (`In Snuggery, Options, then App Files`). **No face is removed**: the stock
shipped none; its system stack (`-apple-system`, `SF Pro Text`) and its `code` face (`ui-monospace`,
`SFMono-Regular`, `Menlo`) go, and file names are set in the house face with `translate="no"`. Scale
10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 / 21 px (the stock's 41.6 px headline becomes 21, its 16.8 px name
15, its 14.4 and 12.8 px prose 12.5 and 11.5), weights 400, 560, 600, 620, 650 (the stock's 640 and
700 go), no capitals, no letter-spacing (the stock's −0.02 em on the headline goes). The card's SVG
text takes the page's face; the label column and every label's room are measured after
`document.fonts.load('400 10.5px "Ysabeau Office"')`, and the card is drawn again on `loadingdone`.
The credit line word for word in About (`Type: `), in `NOTES.md` (new: the app had none) and in the
template's `LICENSE` carve-out (the lead's).

---

## 5. The camera's strings

HOUSE 7.4: the camera opens nothing inside this app. `MarketingShotsUITests.swift` line 238 asserts
that the Library row named **`Hello Live`** exists in *Live examples* (`10-live-examples` photographs
the list, not the app); `MarketingClipsUITests.swift` lines 353 to 402 download `hello-live.zip` from
the public repository in Safari, share it to Snuggery, tap the row named `Hello Live`, wait for
Snuggery's own `Mini-app options` button and pause four seconds with the app on screen, so the import
clip's last seconds show the app as it opens. `MarketingCameraCase.swift` does not name the app.

| String or gesture | Where | Kept |
| --- | --- | --- |
| the Library row `Hello Live` | `miniapp.json`'s `name`, unchanged | kept |
| four seconds on screen after launch | the app's first frame is the data: the face is local (`font-display: block`), the file is 545 B, no opening, no animation but none | kept: nothing lengthens the arrival |

The camera needs no change. The app stores one key (`hello-live.card`, section 1), which the camera
never reads or resets; the clip runs on a fresh import, so the card it films holds the current file's
one punch. No string is British.

---

## 6. Budget

*Measured* by `node tools/check.mjs` (2026-10-06): code as every shipped `.html`, `.css` and `.js`; the
ZIP built by `build-zips.yml`'s command (`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*'
'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`), then its size on disk.

| | Before the pass | As built | Cap |
| --- | --: | --: | --- |
| App code | 7 281 (`index.html` alone, its CSS and script inline) | 46 888: `index.html` 5 766, `style.css` 8 778, `app.js` 14 940, `js/units.js` 5 426, `js/card.js` 11 978 | 200 000, the house's |
| Fonts | 0 | 40 075 (the house face 35 372 and its `OFL.txt` 4 703) | 160 000 |
| ZIP | 3 730 (4 entries) | about 71 850, 11 files (this file's own size moves the last digits): stored, the face and its license 37 510, the code 17 846, this file about 12 900, `NOTES.md` 1 837, the data 231 | 74 000, the lead's ruling (plan 0011 D42); 42 496 by D5 (3 730 × 1.25, rounded down, plus 37 834 for the face) could not hold the face |
| Data | `data/snapshot.json` `db50d9ad…f04333a8` | the same bytes | pinned by `check.mjs` |

**The ZIP cap: 74 000 B, the lead's ruling (plan 0011 D42), nothing cut.** This is the smallest stock
ZIP in the template, a tenth of the face it gains, so D5's formula leaves no room even for the font;
like the four loop apps before it (Finances 131 000, World News 88 000, Outdoor Window 99 000, Power
Hours 97 000) it is ruled at the measured figure plus about 3 000 B for the fix stages. **As built it is within 5 % of
the cap**: about 2 100 B to spare (HOUSE 8, what to do near a cap), so any growth of this file or the
code needs the lead's eye. The build
applied the whole list, cut nothing, never minified and never stripped a comment. **The data's hash
pins the private copy only**: on the public repository the refresh job rewrites `data/snapshot.json`
about every hour, so the lead's mirror leaves the public `data/` in place and the live check hashes the
code files inside the downloaded ZIP, as World News' and Power Hours' do. Hello Live also ships inside
Snuggery's starter pack (`Tools/build-starter-pack.sh`, `live/hello-live.zip`): the pack is rebuilt in
the working tree for the camera and restored after, never committed with the pass (plan 0011 D25).

---

## 7. The generated-page tells, answered

| Tell | Here |
| --- | --- |
| 1. Cream, serif display, terracotta | film base; one sans; no accent: the stock's green goes, and the screen has no hue at all |
| 2. Near-black with an acid accent | the stock's `#131316` ground and mint accent go for the slate print; the bright thing is the card's ink |
| 3. Broadsheet | one column, hairlines between the headline, the card and the rows, radii by role (8 px on a notice, 6 on a text key) |
| 4. The SaaS-card kit | the stock's two white cards at a 14 px radius with hairline edges go; the data sits on the page |
| 5. Tracked capitals | none |
| 6. Middle-dot joins | none; commas and lines |
| 7. Spaced em dash | none; the stock's hint joined `Snuggery`, `Options` and `App Files` with spaced em dashes, a midline ellipsis and an arrow; it becomes words and commas |
| 8. Tinted near-black | ink `#0f1c23` as ink; no `#131316` or `#16161a` |
| 9. Monospace labels | none; the `code` chips in the stock's hints go |
| 10. Arrows on buttons | none; the stock's arrow (U+2192) becomes words |
| 11. One accented word | none; the green `ago` and the red `stale` go; a stale file is a sentence in `--ink` |
| 12. Labels above content | the card's heading names the thing under it; the rows' labels are the file's own, beside their values |
| 13. Numbered markers | none |
| 14. Big number, small label, gradient | the stock's 41.6 px headline becomes the one 21 px figure, with its lead in words and no gradient |
| 15. Entrances, hover everywhere | none; nothing animates but About; hover only on the stamp and the text keys, under `(hover: hover)` |

---

## 8. Where the record is

The art stage's change list, the owner calls it left open, the lead's rulings, the as-built departures,
the measured budget and the phone checks are in `tools/DECISIONS.md`, which does not ship.
