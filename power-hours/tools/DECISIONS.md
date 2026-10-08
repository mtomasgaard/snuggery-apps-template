# Power Hours: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look as built; this file
holds the record: the lead's rulings, the owner calls as the pass left them, the as-built departures,
the measured budget, what the tools printed, the phone checks. Plan 0011 package B, D1 to D5 and
HOUSE.md are the brief. ART.md's sections 8 and 9, as the art stage wrote them, are moved here word
for word, below the last `---`.

## The lead's ruling on the ZIP (2026-10-03, plan 0011 D39)

**The ZIP cap is 97 000 B, nothing cut** — the measured 93 754 plus about 3 000 B for the fix stages, as D27, D30 and D34 ruled; set as `ZIP_CAP` with `ZIP_RULED = true` in `tools/check.mjs`, and written here and in `ART.md` section 6 while QA ran. The builder's record of the measurement follows. The build measured the ZIP at **93 754 B** (14 entries) against D5's 70 305 B,
with nothing cut, minified or stripped: all eighteen faults fixed, the Landing, the house chrome,
About. Inside the ZIP the face and its license store 37 510 B, more than the whole stock ZIP
(25 977 B); the shipped `ART.md` stores 14 549 B. `tools/check.mjs` prints the ZIP line as `HOLD`
(not `FAIL`) while `ZIP_RULED` is `false`, and ends `all checks pass; 1 held for the lead's ruling`.
The lead sets `ZIP_CAP` and `ZIP_RULED = true` in `tools/check.mjs` and writes the ruling here and in
`ART.md` section 6. By the precedent of D27, D30 and D34 (the measured ZIP plus about 3 000 B for the
fix stages) the expected cap is about 97 000 B. The code is 81 309 B of the house's 200 000.

## As built (the builder, 2026-10-03)

**Files.** New: `js/units.js` (every number, unit and date), `js/prices.js` (the model: intervals by
instant, the step, gaps, the stretch searched, the cheapest unbroken run, ranks, the scale, the words for
runs and intervals), `js/staircase.js` (the Landing's geometry and labels as data, and `draw()`),
`fonts/ysabeau-office-gw.woff2` and `fonts/OFL.txt` (copied byte for byte from `global-weather/fonts/`),
`tools/test_prices.mjs`, `tools/check.mjs`, `tools/shoot.mjs`, this file. Rewritten: `index.html`,
`style.css`, `app.js`, `NOTES.md`, `PROMPT.md`; `ART.md` corrected to the look as built. Unchanged: both
data files (sha256 pinned by `check.mjs`), `miniapp.json`, `tools/art/palette.py`, `.gitignore`. No
pipeline or workflow file was touched. No face was removed (the stock shipped none).

**Departures from the art direction, and why** (each stands for the owner to reverse):

1. *The in-plot labels are placed by a measured rule.* ART said the appliance's name sits at the level's
   right end on a halo. On the shipped file at 10:20 the staircase runs through that spot's letters and a
   3 px halo cannot hide a line between letters, so each in-plot label takes the first of its candidate
   spots that the staircase, the zero rule, the dashed mean and the labels already placed leave clear:
   the name at the level's right end (level, over, under), then its left end (level, over), else left out
   (the list carries the run); the mean's under its line's right end, over it, then at its left end, else
   its first spot. `tools/test_prices.mjs` checks every placed label against the staircase it computes.
2. *The landing is drawn on whole device pixels* (`shape-rendering: crispEdges` on the level, posts and
   bracket). Without it Chrome's layer snapping half-covered the level's bottom row over a blue tread at
   the same height, and those edge pixels measured 2.94 (light) and 2.77 (dark); with it the lowest
   rendered sample is palette.py's own 3.55 / 3.48.
3. *Clock-change days carry offsets in the words.* The autumn night's repeated hour made a one-hour run
   read `02:30–02:30` and the readout `02:00–02:15` twice; a run whose ends sit on different offsets reads
   `Sun 02:30 (UTC+2) to 02:30 (UTC+1)`, and on a day with two offsets each interval names its own
   (`Sun 25 Oct, 02:00–02:15 (UTC+1)`).
4. *"most expensive quarter"*, not ART's "dearest quarter", in Now's lead: "dear" for "expensive" reads
   British; US English is the house rule. `check.mjs` lists `dearest` with the British spellings.
5. *"about 13:00 Central European time"*, not "about 13:00 Oslo time", in the statement about tomorrow's
   prices: the auction's hour is Central European wherever the zone is (13:00 CET is 14:00 in Helsinki),
   so naming the zone's city would be wrong outside the CET zones.
6. *The readout's run words* are `inside the run for Dishwasher` (ART: `inside the Dishwasher's run`), which
   reads for any appliance name (`inside the run for Car charging`).
7. *Spans follow the house's `span()`*: `Prices ran out 36 h ago.` (hours below two days, then days), where
   ART's example said `1 d`.
8. *The day's last interval ends at `24:00`* in the readout, as runs that end at midnight do.
9. *History's words*: `9 % below the file's mean` in the list, `no unbroken run that long in the file` for
   a run that does not fit, `Searched from Thu 1 Oct, 00:00 to 24:00`.
10. *An undated file is usable.* The stock refused a snapshot with no `generatedAt`; ART lists the stamp
    form `Undated file.`, so the prices are drawn and the stamp says it.
11. *A broken appliance file names its fault*: `data/appliances.json is not valid JSON, so this is the
    built-in list. A trailing comma or a missing quote will do it.` (the stock's catch said only that it
    could not be read).
12. *About's Sources and credits* paraphrase the 16-zone list (`Energy-Charts publishes 16 of the bidding
    zones it serves under CC BY 4.0, from Bundesnetzagentur and SMARD.de …`); the quoted terms stay in
    `NOTES.md` word for word. The private-use line is static markup shown when `publishable` is false.
13. *The swipe test runs at 390 × 700*: at 390 × 844 the pane has only 69 px to scroll inside the file, so
    the 100 px the art direction asks for cannot be met there (owner call 9 below).

**The eighteen faults, and what pins each** (all musts; `tools/test_prices.mjs` is "test", `tools/check.mjs`
"check", `tools/shoot.mjs` "shoot"):

| | Fixed by | Pinned by |
| --- | --- | --- |
| B1 morning opens on yesterday as "Today" | one drawing; no `days[].label` read; each interval's day from its own string | test (shipped file, two-day file next morning), check (no `.label` read), shoot (two-day file at Fri 08:00 in nb-NO: "Fri 2 Oct, 08:00–08:15, now", no "Today"/"Tomorrow") |
| B2 an ended day planned as ahead | history mode: `Cheapest runs in this file`, the statement, the day named | test (3 Oct), shoot (run out, both themes) |
| B3 runs never cross midnight | one search over the whole file, from the present | test and shoot (two-day file at 22:30: `23:00 to Fri 01:00`, `23:00 to Fri 03:00`) |
| B4 stale by age, in amber | coverage, not age; sentences in ink | check, shoot (the 16:31 file the next morning: `Updated 1 Oct, 18:31`, no lead) |
| B5 no date in the stamp; `toLocaleString` tooltip | `stampWhen()`; no tooltip | test, check, shoot |
| B6 dates follow the locale | dates by hand in `js/units.js` | check (no `toLocale*`/`Intl`), shoot (en-US, en-GB, nb-NO, ja-JP: the same 1 290 characters) |
| B7 `role="img"`, 13 px hour buttons | one slider named Time, its hit the whole drawing | check, shoot (6 controls, all 44 × 44 or more) |
| B8 `<main>` aria-live | one polite live region | check, shoot |
| B9 `12` printed through the run's times | axis labels by priority, a 4 px gap | test, check, shoot (`12:00` dropped at 10:20) |
| B10 hourly bars | one tread per interval | test (41 + 55 treads), check, shoot |
| B11 a quarter's price with its hour's rank | `rankDay()` of the same interval | test (68th of 96), shoot |
| B12 the autumn hour averaged into one bar | intervals by instant and index | test (100 quarters, offsets in the words) |
| B13 a broken replacement wipes the screen | the view kept, a notice with Close | check, shoot |
| B14 notices escaped, backticks, red, a filesystem hint | plain sentences as text; the house notice | check, shoot (six broken files) |
| B15 SI and one decimal | U+202F everywhere, two decimals | test (21 unit forms), check, shoot (every visible node) |
| B16 British spellings | US English; the data's keys and the API's quote kept | check |
| B17 `⋯`, `→`, a monospace face | words; one face | check |
| B18 runs across gaps | `joined[]`; no run spans a gap | test (14:00 missing: the run moves to 14:15–16:15, where a gap-blind search started at interval 53) |

**Measured** (the builder's runs, 2026-10-03, on this Mac):

- `node tools/check.mjs`: 41 `ok`, 1 `HOLD` (the ZIP, above), ends `all checks pass; 1 held for the lead's
  ruling (the ZIP's size, printed above)`. App code 81 309 B (`index.html` 5 816, `style.css` 10 818,
  `app.js` 31 447, `js/units.js` 7 185, `js/prices.js` 12 683, `js/staircase.js` 13 360); fonts 40 075 B;
  ZIP 93 754 B, 14 files; stored: data 2 151, fonts 37 510, code 29 878, ART.md 14 549, NOTES.md and
  PROMPT.md 7 823. Against the stock files (a scratch copy with this pass's tools) the same check fails 28
  of its 42.
- `node tools/test_prices.mjs`: `43 checks, all pass`.
- `python3 power-hours/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`, exit 0; `--json`
  gives `--price` `#2a67f0` / `#3674fe`, which `style.css` carries.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: 144 `ok`, ends `all checks pass` (both themes, the scrub
  included). The landing's level: 168 device pixels, 100 % at 3:1 or more against what lies under them,
  the lowest 3.55 (light) and 3.48 (dark); the staircase's treads ahead 4.17 / 4.14 on the page. The scrub
  at 2, 8 and 20 intervals a second: 0 frames differ. Headless Chromium's load to the drawing about
  335 ms and about 40 to 60 ms a scrub move including the harness: a trend on this Mac, never phone
  evidence. `screenshots/app.png` untouched. `SCREENSHOTS=1` wrote `screenshots/landing-{light,dark}.png`,
  `history-{light,dark}.png` and `about-light.png`.

**The camera** (HOUSE 7.4): the wait for visible text containing `c/kWh` is kept (written only after the
snapshot parses; never in `index.html`; shoot shows none in the page while the snapshot is held back); the
swipe up scrolls the pane, not the page. The pane's room to scroll, measured by shoot: 69 px at 390 × 844
inside the file; 0 px at the camera's 440 × 956 inside the file; 0 px at 390 × 844 and 440 × 956 run out
(the camera's state, since the committed file is from 1 Oct). So `readme-power-hours-2` equals
`readme-power-hours-1` (owner call 9). The camera's strings need no change. (Superseded the same day: the lead
resolved owner call 9 by changing the second pane's gesture; see "After QA" below.)

**Phone checks for the device matrix** (none claimed here; each on the owner's iPhone at its current iOS,
and the scrub and VoiceOver again on an iOS 18 device for the floor): the scrub on the drawing (a tap, a
sideways drag at speed, a vertical swipe that scrolls the pane and picks nothing, a pinch) in Snuggery's
web view; VoiceOver on the slider (its value and description), the runs and About; the clock redraw
across a quarter boundary while the app stays open; a Shortcut delivering a new file while open (the view
kept, "New prices, updated …" said once); full screen with Snuggery's exit control reachable; the phone on
its side (the 96 px plot); the pane's scroll at the camera's 6.9-inch size; frame time while idle and
while scrubbing.

## After QA (the builder, 2026-10-03)

QA's verdict: **pass, no findings** (no must, should or nit), from its own runs of all four tools and an
independent Playwright drive (first impression in both themes, a 25-step fast scrub by real touch,
844 × 390, Reduce Motion with About, About in dark, a tap on the drawing, a simulated `data/snapshot.json`
404: 0 unexpected console errors). So this stage changed no shipped file: `index.html`, `style.css`,
`app.js`, `js/`, `fonts/`, `ART.md`, `NOTES.md`, `PROMPT.md`, `miniapp.json` and both data files are as
the build stage and the lead's ruling left them. Only this file changed (this section and the pointer
above).

**Two things settled while QA ran, by the lead, not by this stage** — recorded here so the record is
whole:

1. **The ZIP cap** is 97 000 B (plan 0011 D39; the section at the top of this file). `check.mjs` carries
   `ZIP_CAP = 97000` with `ZIP_RULED = true`, so the `HOLD` the as-built record describes is gone and the
   check ends `all checks pass`. The as-built "Measured" paragraph below the fault table and item 10 of
   ART's moved change list still say `HOLD` and "against 70 305 until the lead rules": they are dated
   records of the build stage and the art stage and stay as written.
2. **Owner call 9, the README's second pane.** Shoot measured the pane's room to scroll at 0 px at the
   camera's 440 × 956 (and at 390 × 844 in the run-out state the camera photographs), so a swipe would have
   repeated the first frame. The lead changed `readme-power-hours-2` in
   `Tests/SnuggeryUITests/MarketingShotsUITests.swift` (lines 362 to 377): after `readme-power-hours-1`
   the camera finds the button whose label contains `Washing machine` (the appliance row `app.js` draws
   from `data/appliances.json`, "Washing machine", 1.5 h), taps it, waits 1.5 s and snaps. The wait for
   visible text containing `c/kWh` is unchanged on both shots (lines 257 and 368). QA drove the same tap
   with its own script and saw a distinct second frame. Nothing in the app was changed for this; the
   row existed from the build stage.

**Re-run after QA** (this stage, 2026-10-03, on this Mac; the exact commands and what they printed):

- `node tools/check.mjs` (from `Template/power-hours/`): 42 `ok`, 0 `HOLD`, ends `all checks pass`,
  exit 0. Printed: `app code 81,309 bytes (cap 200,000, the house's; 46,466 before the pass): index.html
  5,816, style.css 10,818, app.js 31,447, js/units.js 7,185, js/prices.js 12,683, js/staircase.js 13,360`;
  `fonts/ 40,075 bytes (cap 160,000; none before the pass)`; `ZIP has index.html at its top (14 files)`;
  `stored in the ZIP: data 2,151, fonts/ 37,510, app code 29,878, ART.md 14,615, NOTES.md and PROMPT.md
  7,823`; **`ZIP size 93,820 bytes (cap 97,000, the lead's ruling; 25,977 before the pass)`**. The 66 B
  over the build stage's 93 754 are `ART.md`'s own growth when the ruling was written into its section 6
  (stored 14 549 then, 14 615 now); no code byte moved.
- `node tools/test_prices.mjs`: `43 checks, all pass`.
- `python3 power-hours/tools/art/palette.py` (from `Template/`): ends `ALL CHECKS PASS`, exit 0.
- `shasum -a 256 data/snapshot.json data/appliances.json`: `cd7b0f7da4b92fd7ecbc732afd6ab81dbdbd149d3eba4c6ee0f98c2d7237e6d0`
  and `f308ce89d63af77f3cbc197df84e4cc2adf1c86543af1429b48b0db966063fe1`, the two hashes `check.mjs` pins
  as the files committed before the pass. (QA checked the same against `git log -1` on both files; this
  stage runs no git.)
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: 144 `ok`, 0 failures, ends `all checks pass`, exit 0, both
  themes. The camera's wait passes (`visible text containing "c/kWh"`); load to the drawing 337 ms and
  331 ms; the scrub at 2, 8 and 20 intervals a second, 0 frames differ and no animation runs on them
  (90, 50 and 50 moves at about 41, 44 and 61 ms each including the harness); a vertical swipe from the
  screen's center and one starting on the drawing scroll the pane 213 px at 390 × 700 and pick nothing;
  the pane's room to scroll printed for owner call 9 as 69 / 0 / 0 / 0 px (inside the file at 390 × 844
  and 440 × 956, run out at both). Headless Chromium 153.0.8010.12: every time is a trend on this Mac,
  never phone evidence.
- `… SCREENSHOTS=1 node tools/shoot.mjs`: the same 144 `ok`, `all checks pass`; `screenshots/app.png`
  untouched, sha256 `a7b8ca66dfa6b76b557c0737ebe37117fa112877e2cca03e1604fb37b2460d1a` before and after.

**Budget, as measured now.** Code 81 309 B of the house's 200 000 (46 466 before the pass). Fonts
40 075 B of 160 000. ZIP 93 820 B of the ruled 97 000, 14 entries (25 977 before the pass); 3 180 B of
room left for anything a later stage adds to `ART.md`, which is the only file whose size still moves.

**Phone checks** stand as the as-built record lists them above; none is claimed by this stage.

## After review (the builder, 2026-10-03)

The reviewer's verdict: **fix**, with no must, three shoulds and five nits, after its own runs of all four
tools and a 37-picture Playwright drive. Every should and every nit was taken; one was taken in a form
that differs from the suggestion, said below. What changed, finding by finding:

1. **(should) `ART.md` section 5 described the camera as it was before D39.** Rewritten to the camera as it
   is: the wait for visible text containing `c/kWh`, one still, a tap on the button whose label contains
   the second appliance's name, 1.5 s, the second still; the pane's room to scroll stated as the measured
   fact (69 / 0 / 0 / 0 px), not an open call. Section 3's pane bullet, which also said "the camera's
   swipe", corrected in the same pass.
2. **(should) The washing machine's landing almost coincides with the dishwasher's in the run-out state.**
   Measured here at the camera's 440 × 956, run out (`shoot.mjs`, new check): the dishwasher's level
   `Thu 00:30–02:30` is 33 px long; the washing machine's `Thu 01:00–02:30` moves 8 px at its left end and
   0 at its right; Car charging's `Thu 00:00–04:00` is 32 px longer. **Nothing in the app changed** for
   this: the row exists under its name from the build stage. The lead made the change while this stage
   ran: `HOUSE.md` 7.4's row names car charging (plan 0011 D39, "then … car charging"), and
   `Tests/SnuggeryUITests/MarketingShotsUITests.swift` now finds `label CONTAINS[c] "Car charging"` at
   line 373 (the `c/kWh` waits at 257 and 370); `ART.md` section 5 says the same. The row's accessible
   name (finding 4) begins `Car charging, `, so the match holds.
3. **(should) The mean's label printed across the staircase on a plausible file.** Reproduced first in
   Node on the review's own fixture (the shipped Thursday and a Friday whose daytime prices swing through
   the mean; `tools/.work/review/drive.mjs`'s generator, copied into `test_prices.mjs`): at Fri 08:00 the
   fallback box (y 41.9 to 51.9) sat inside the staircase's 39.5 to 71.7. `js/staircase.js` `layout()`
   now tries, after the four fixed spots, every 12 px along the line from its right end leftwards, under
   then over (`MEAN_STEP`), and with no clear spot on the line puts the label in the row above the plot at
   the line's right end (`NOW_Y`, the `now` label's own baseline), or at the plot's left edge when `now`
   stands at the right end; `draw()` draws it where the layout says. Pinned by `test_prices.mjs` (the
   review's fixture: the row, right of `now`; a sawtooth at 23:40: the row's left end; a band at both ends
   of the stretch with a flat middle: the walk lands over the flat 15:00 to 20:00, clear) and by a
   `shoot.mjs` check, run in every state that draws a landing (both themes at 10:20 and run out, the
   two-day file at 22:30 and the next morning, the review's fixture at Fri 08:00 and Thu 23:30), that
   parses the two staircase paths from the DOM and proves no in-plot label's box, by the layout's own
   rule and the rendered text length, meets a tread or a riser.
4. **(nit, taken) The run rows' accessible names.** Each `<button aria-pressed>` carries an `aria-label`
   that begins with its visible name and goes on in words: `Dishwasher, 13:30 to 15:30, 2 hours run,
   14.19 cents a kilowatt hour, 8 percent below the mean ahead` (`js/prices.js` `savingSpoken()`, the
   spoken twin of `savingWords()`, both from one `saving()`; `spokenLength` and `runWords(…, true)` as the
   slider already used them). WCAG 2.5.3 holds (the name starts with the visible words); HOUSE 6.1's
   "units by name" now holds on the main list, not only after a press. Reversible by deleting one
   `setAttribute` line in `runsSection()`. `shoot.mjs` asserts the first row's name letter for letter and
   that no name holds an en dash, U+202F, `%` or `c/kWh`.
5. **(nit, taken, in a different form) A midnight's day label dropped under a run's times.** The
   suggestion (retry anchored `start` at X(mid) + 4) would not have placed `Fri 2` in the case the review
   named, a `22:00–24:00` run centered 7 px from the midnight, because that label's right end is about 30
   px past the midnight. So a midnight's day label that collides moves right of its hairline and then
   past each label already placed (`a = blocker.b + LABEL_GAP`), while it stays inside its own day (a
   `stop` at the next midnight), and is dropped only if that fails. Pinned by `test_prices.mjs` (the
   22:00–24:00 run at 21:00 with Friday published: `Fri 2` anchored at its start 25 px right of the
   hairline; the review's 23:30 case: `Fri 2` at x 257 after `Fri 02:45–04:45`) and by the same two states
   in `shoot.mjs`. **Restricted to midnight labels** (`mid: true`), not the first day's label at the plot's
   left end: a first version slid that one too, and in the camera's run-out state it then read
   `Thu 00:00–04:00 Thu 1` and pushed `06:00` off the axis, a worse axis than the stock rule's for the
   README's own frame. `check.mjs`'s B9 regex (the 4 px rule) is unchanged and still matches.
6. **(nit, taken) `holdReadout()` laid out every interval on every draw.** Now every interval's two strings
   are measured on a canvas in the readout's own fonts (`WHEN_FONT` 620 12.5 px, `VALS_FONT` 400 11.5 px,
   as `style.css` sets them) and only the three widest of each line are laid out: at most six layouts in
   place of 96 or 192. The held heights are the ones the previous run measured, 59 px at the five phone
   widths and 43 px on a side, at 640 and on a tablet, with `held.size === 1` over all 96 intervals at
   every width (`shoot.mjs`, unchanged check). The three-widest hedge covers a narrower string that wraps
   worse at a word break. Not cached across draws, because the strings name the chosen appliance.
7. **(nit, taken) The pressed row's gutter rule is a departure from the tracer.** One sentence in
   `ART.md` section 3 says so and why (a list row is not a word in a tabs row; the rule ties the mark to
   the signature). The mark itself is unchanged.
8. **(nit, taken) Three wording and trimming points.** (a) `parseAppliances()`: `slice(0, 40).trim()`,
   so a name cut at a space has no trailing space (`shoot.mjs`: a 45-character name comes out as the
   39-character `Heat pump top-up for the whole upstairs`). (b) A file that cannot be read on a return:
   `parseSnapshot()` marks a read error `unread`, and `fail(problems, unread)` then says
   `data/snapshot.json could not be read (HTTP 404). Nothing new arrived. Still showing the prices updated
   06:01.` in place of "arrived and cannot be used" (`shoot.mjs`, new 404-on-a-return check; the B13 regex
   in `check.mjs` still matches). (c) About's `Next day` leads with the day in the house's words:
   `Fri 2 Oct, not in this file (no prices published for 2026-10-02)`, the file's own note kept after it
   (`shoot.mjs` About list updated).

**Files changed by this stage.** Shipped: `js/staircase.js` (the mean label's walk and row, the midnight
label's slide, `NOW_Y`), `js/prices.js` (`saving()`, `savingSpoken`), `app.js` (the rows' names, the
readout's measured hold, the unread notice, the trim, About's Next day), `ART.md` (sections 1, 3, 5, 6, 8
and the head). Not shipped: `tools/test_prices.mjs` (section 7, eight checks), `tools/shoot.mjs`
(`labelsClear`, the camera's second pane, the 404 on a return, the review's fixture at two clocks, the
rows' names, the longer appliance name, About's list), this file. Untouched: `index.html`, `style.css`,
`js/units.js`, `fonts/`, `NOTES.md`, `PROMPT.md`, `miniapp.json`, `tools/check.mjs`, `tools/art/`, both
data files, `screenshots/`.

**Re-run after the review** (this stage, 2026-10-03, on this Mac, from `Template/power-hours/`; the exact
commands and what they printed):

- `node tools/check.mjs`: 42 `ok`, 0 `HOLD`, ends `all checks pass`, exit 0. `app code 84,497 bytes (cap
  200,000, the house's; 46,466 before the pass): index.html 5,816, style.css 10,818, app.js 32,886,
  js/units.js 7,185, js/prices.js 12,980, js/staircase.js 14,812`; `fonts/ 40,075 bytes (cap 160,000)`;
  `ZIP has index.html at its top (14 files)`; `stored in the ZIP: data 2,151, fonts/ 37,510, app code
  30,919, ART.md 15,260, NOTES.md and PROMPT.md 7,823`; **`ZIP size 95,506 bytes (cap 97,000, the lead's
  ruling; 25,977 before the pass)`**. Against QA's 93 820: code +3 188 B raw (+1 041 stored), `ART.md`
  +1 885 B raw (+645 stored); 1 494 B of the ruled cap left.
- `node tools/test_prices.mjs`: `51 checks, all pass` (43 before; the eight of section 7).
- `python3 power-hours/tools/art/palette.py` (from `Template/`): ends `ALL CHECKS PASS`, exit 0; `--json`
  `--price` `#2a67f0` / `#3674fe`, as `style.css` carries.
- `shasum -a 256 data/snapshot.json data/appliances.json fonts/* screenshots/app.png`:
  `cd7b0f7d…37e6d0`, `f308ce89…063fe1`, `d1adfffd…be6269`, `fdf1a28c…cdb262`, `a7b8ca66…60d1a`: every
  one as pinned (this stage runs no git).
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: 161 `ok`, 0 failures, ends `all checks pass`, exit 0, both
  themes (144 before). Load to the drawing 335 and 330 ms; the scrub at 2, 8 and 20 intervals a second 0
  frames differ (90, 50 and 50 moves at about 40, 45 and 57 to 61 ms each including the harness); the
  room to scroll 69 / 0 / 0 / 0 px as before; the camera's second pane as in finding 2; the review's
  fixture at Fri 08:00 `"mean 12.11" in the row above the plot` with `now` at x 245 and the label at y 10,
  at Thu 23:30 `"Fri 2" at x 253, after the run's times ending at 249`; the readout held at 59 / 43 px as
  before. Headless Chromium 153.0.8010.12: every time is a trend on this Mac, never phone evidence. The
  pictures of the three new states are `tools/.work/shots/review-Fri-08-00-light.png`,
  `review-Thu-23-30-light.png` and `camera-car-440-light.png`, each looked at.

**Phone checks** stand as the as-built record lists them, with two added: a row press on a two-day file
(the readout's hold now measures 192 strings on a canvas and lays out six); VoiceOver on the run rows,
where the name is now a sentence in words and the pressed state should follow it. Each on the owner's
iPhone at its current iOS, and VoiceOver again on an iOS 18 device for the floor.

## Owner calls the build adds

The departures above (1 to 12) stand as built for the owner to reverse, and the review's eight items
above add three more: the run rows' spoken names (4), a midnight's day label kept after a run's times
that may already say its weekday (`Fri 02:45–04:45 Fri 2`; 5), and the mean's label in the row above the
plot when nothing on the line is clear (3). ART's owner calls 1 to 10, below, stand as the art stage
wrote them; call 9 was settled by the lead (plan 0011 D39): the second pane is a tap on car charging's
row, already in the camera (finding 2).

---

## ART.md's sections 8 and 9, as the art stage wrote them (moved word for word by the builder, item 12)

## 8. The change list (for the builder, in order; moves to `tools/DECISIONS.md` when built)

**Bugs on record.** None for this app in `docs/plans/0009-launch-1.1.md` item 5, `docs/review/` or
the app's own `NOTES.md` (it has no `DECISIONS.md`). The stranger's run found these, all **musts**,
each fixed by the items below and each pinned by a test that fails on the stock app:

- **B1** Day labels come from the data (`days[].label`, written `Today`/`Tomorrow` when the file was
  made), and the app opens on the first day with prices: every morning after midnight until the next
  refresh, it opens on *yesterday* labeled `Today`, plans every run over hours that have ended, shows
  no `Right now`, and puts today's real prices behind a tab called `Tomorrow` (driven: a two-day file
  made 1 Oct, 16:31 UTC, the clock at Fri 2 Oct, 08:00 Oslo, `nb-NO`).
- **B2** A day that has wholly ended is planned as if ahead: `plannable()` returns the whole day when
  no interval is current, so on 3 Oct the shipped file shows `Cheapest window · Today`, `Dishwasher
  00:30–02:30`, for 1 Oct.
- **B3** Runs never cross midnight: at 23:30 with tomorrow published (and below zero in the fixture),
  every appliance reads `—`; the overnight car charge, the commonest use, is never found.
- **B4** Staleness by age (over 14 h) although day-ahead prices are final: the 16:30 UTC file turns
  the stamp amber from 08:30 Oslo every morning; staleness shown by color alone.
- **B5** The stamp has no date (`Updated 18:31` the next afternoon) and its tooltip uses
  `toLocaleString()`.
- **B6** Dates follow the phone's locale (`toLocaleDateString(undefined, …)`: `Thu, Oct 1` in en-US,
  `tor. 1. okt.` in nb-NO).
- **B7** The chart is `role="img"`, which makes its 24 hour buttons presentational, so VoiceOver
  cannot reach them; and each hit is 13 px wide (24 controls under 44 px, measured).
- **B8** `<main aria-live="polite">`: every render, a tap on a row included, re-announces the pane.
- **B9** The run's label collides with an hour label (`12` printed through `13:30–15:30` in both
  themes; the guard compares centers within 22 px, the label is about 60 px wide).
- **B10** Hourly bars misstate the run: a bar is highlighted whole when only its last quarter is in
  the run (the 13:00 bar for a 13:45 start), and hourly means hide quarter spreads up to 1.42 c/kWh
  (15:00 to 16:00: 14.18, 14.43, 15.00, 15.60).
- **B11** `Right now` mixes resolutions: the figure is the quarter's price, the rank its hour's mean
  (`15.8 c/kWh, 15th cheapest hour of 24`).
- **B12** On the autumn clock change, `hourlyMeans()` buckets by wall-clock hour, so the repeated
  02:00 hour's eight quarters average into one bar and `posOf()` finds the first only (by reading; a
  100-interval fixture pins it).
- **B13** A broken replacement while open wipes the screen (`load()` falls through to
  `renderProblem()`, which empties `<main>`).
- **B14** Notices: messages passed through `esc()` and then set as `textContent` (a `<` shows as
  `&lt;`), field names in backticks, a red title and edge, a hint about opening the file from the
  filesystem that cannot apply in Snuggery.
- **B15** SI and figures: `−6%`, `2 h run`, `1 h 30 min` with plain spaces; `13.6–16.1` with no unit;
  one decimal prints 13.64 and 13.62 alike, hiding the quarter differences the drawing shows.
- **B16** British spellings in shipped text: `licence` (`NOTES.md` 5, `PROMPT.md` 2, `app.js`
  comments), `honours`, `honouring`, `colour(s)` (`style.css` comments), `labelled` (`app.js`).
- **B17** `⋯` and `→` in help sentences (`app.js`, `PROMPT.md`) and a monospace `code` face.
- **B18** A run is searched across missing intervals: `cheapestWindow()` slides over the array
  regardless of gaps, so a dropped quarter is bridged silently (by reading; a fixture pins it).

**The items** (each names its files):

1. `.gitignore` (done by this stage: `tools/.work/`, `tools/node_modules/`, `dist/`). Copy
   `fonts/ysabeau-office-gw.woff2` and `fonts/OFL.txt` from `global-weather/fonts/` byte for byte.
2. `js/units.js` (new, pure, from Global Weather's and Outdoor Window's): prices (`price(v, u)`, two
   decimals in c/kWh, the source's own unit and two decimals otherwise, U+2212, never `−0.00`), U+202F
   before every unit and `%`, run lengths (`2 h`, `1 h 30 min`), whole percentages, ordinals, spans
   (`1 d`), dates and times by hand with fixed English words (`Thu 1 Oct`, `Thu 1 Oct 2026, 06:01
   (UTC+2)`), the zone's wall clock read from each interval's own string, and the spoken forms
   (`cents a kilowatt hour`, `Thursday 1 October`). `toFixed` and `toLocaleString` nowhere else (B5,
   B6, B15).
3. `js/prices.js` (new, pure): the model (intervals in instant order, the step, contiguity, days by
   the zone's date, the current interval by instant, the zone's today from the present's offset),
   the stretch searched and its mean (section 1), the cheapest contiguous run across midnight and
   never across a gap, earliest on a tie, the rank and quarter of an interval within its day, the
   scale. No `days[].label` is read (B1–B3, B11, B12, B18).
4. `js/staircase.js` (new, pure): the geometry of section 1 (plot, scale ticks, treads and risers, the
   fill below zero, the faint ended part, the landing, posts, bracket and labels with the priority
   and the 4 px rule, the mean line and label, `now`, midnight hairlines, the tracer head), returned
   as data `app.js` draws into one SVG in CSS pixels (B9, B10).
5. `index.html`: `lang="en-US"`, `color-scheme` and the two `theme-color` metas, the header (name,
   stamp button, its hidden hint), `<main class="pane">` with the notice and the pane, the caption
   band with the static credit fallback, About's markup (static sections, `This data` filled by
   `app.js`), the live region, the slider's description; no `aria-live` on `<main>`; no `c/kWh`
   anywhere in the file (B8).
6. `style.css`, rewritten on Outdoor Window's: the house tokens in both themes exactly, `--price`
   pasted from `palette.py --json`, the one `@font-face`, the frame (`100dvh`, the pane scrolling
   inside, `overscroll-behavior`), the scale, the drawing's classes, the runs list, statements,
   notices, About, landscape, Reduce Motion; none of the stock's tokens, shadows, blur, radii, pills,
   uppercase, letter-spacing or transitions (section 7).
7. `app.js`: load and validate as the stock does (the path guard, `cache: 'no-store'`, `lastGood`);
   draw the pane in section 3's order; the slider and its input (tap after lift, sideways scrub,
   vertical yields, keys, second finger); the readout held at its tallest; the runs list as pressed
   buttons; statements; the stamp's forms; notices and the broken replacement that keeps the view
   (B13, B14); the return and the per-step clock redraw; About (dialog, focus held and returned,
   Escape); the test hook `window.__ph`; no `innerHTML` but `= ''` (the app holds Global Weather's rule
   today and keeps it); every font string naming `"Ysabeau Office"` first (B4, B7).
8. Words: every sentence of sections 1 and 3 in US English, sentence case, no middle dots, em dashes,
   `⋯` or `→`, in `app.js`, `index.html`, `NOTES.md` and `PROMPT.md` (`licence` to `license` in the
   app's own words; the API's quoted `honour` and the zone codes `IT-Centre-North` and
   `IT-Centre-South` stay, allow-listed in `check.mjs` by file and exact string; the data's
   `licence` and `licenceInfo` keys stay). `NOTES.md`: the chart paragraph (hourly means) rewritten
   for the staircase, the footer called the credits line, the no-network paragraph naming `js/`, the
   face's credit line. `PROMPT.md`: the unit pointer moved from `app.js` to `js/units.js`, the footer
   called the credits line, the Snuggery path in words (B16, B17).
9. `tools/test_prices.mjs` (new): decodes the shipped snapshot with its own code and compares the pure
   modules on it and on fixtures written in the test: the shipped file at 10:20 and as history (the
   runs and means of section 1 to the hundredth), the two-day file at 23:30 and the next morning,
   a day below zero, an hourly zone, the spring (92) and autumn (100) clock changes, a missing quarter,
   `lastGood`, every tick and label placement rule.
10. `tools/check.mjs` (new, on Outdoor Window's): HOUSE 7.1's seventeen, with this app's: the two
    data hashes; the credit fallback constant; `c/kWh` absent from `index.html` and written by
    `app.js`; the data's keys `licence` and `licenceInfo` allow-listed by exact string wherever a
    shipped file names them (this file, `NOTES.md`, `app.js`); `--price` equal to `palette.py --json`; the allow-list of item 8; the ZIP cap printed
    against 70 305 until the lead rules.
11. `tools/shoot.mjs` (new, on Outdoor Window's), both themes, the clock pinned: boot (no `c/kWh` while
    the snapshot is held back, then present; the face loaded), text contrast on every node, the SI
    scan, the signature sampler (the landing's pixels against what lies under them, 90 % of samples
    at 3.0 or more, the lowest printed), the readout and the runs against the script's own decode,
    B1 to B3 and B9 at their clocks and fixtures, the scrub by real touch at 2, 8 and 20 intervals a
    second with drawn = wanted on every frame, the vertical swipe from the screen's center that
    scrolls the pane at least 100 px and picks nothing, the readout block's height constant over every
    interval at 312, 360, 375, 390 and 430 px, the caption on two lines at 312 px, hit targets of
    44 px, About, Reduce Motion, hidden, the broken files and the broken replacement, the widths and
    844 × 390, the pane's scroll height at 440 × 956 (printed for owner call 9), pictures to
    `tools/.work/shots/`, and `screenshots/app.png`'s hash unchanged. Frame times printed as headless
    Chromium figures only.
12. This file corrected to the look as built, and sections 8 and 9 moved with the as-built notes, the
    measured budget and the phone checks (below) to `tools/DECISIONS.md`.

**Phone checks to list for the matrix** (not claimed here): the scrub and the vertical swipe on the
drawing in Snuggery's web view; VoiceOver on the slider, the runs and About; the clock redraw across a
quarter boundary while open; a Shortcut delivering a new file while open; full screen with Snuggery's
exit control; the phone on its side. Each names the device and iOS version it needs.

---

## 9. Owner calls left open

1. **No units key.** `c/kWh` only on screen, the source's EUR/MWh in About. Reversible: a key cycling
   `c/kWh` and `EUR/MWh`, which would need the camera's wait to stay on `c/kWh` by default.
2. **One drawing across both days, no day tabs.** The stock's `Today` and `Tomorrow` tabs go so a run
   can cross midnight (B3) and the morning cannot open on yesterday (B1). Reversible as two drawings,
   but a run across midnight would then be cut in two.
3. **Two decimals** for every price (`13.65`, where the stock printed `13.6`), because one decimal
   prints neighboring quarters alike.
4. **Only the chosen appliance's landing** on the drawing; the others in the list.
5. **The mean ahead** (the stretch searched) replaces the day's mean as what a saving is measured
   against.
6. **The credits joined by a full stop** instead of the stock's spaced em dash; both halves stay the
   data's words byte for byte.
7. **The blue moves from the window to the price**, and the stock's gray price bars, green saving and
   red and amber warnings go.
8. **History mode still draws a landing** on a file that has run out (`Cheapest runs in this file`),
   the state the camera and a fresh install photograph.
9. **The README's second pane** may equal the first if the compact pane does not scroll at the
   camera's width; then the lead either keeps one pane or changes `readme-power-hours-2`'s gesture in
   the same commit. The README sentence for the Landing is the lead's.
10. **The scale starts near the lowest price**, not at zero (zero drawn when inside); About says so.

---

## Plan 0012 package 4: the pane-app register, Power Hours 1.2 (the builder, 2026-10-08)

The brief is `docs/plans/0012-the-owners-brief-of-2026-10-06.md` (package 4), `Template/HOUSE.md` §4.15 (exception
2), §11, §12, §13, and `docs/plans/0012-change-lists.md` (F, P, *Power Hours* items 1 to 12). Finances 1.2 is the
reference. No git command was run by this pass's tools; nothing outside this folder was written. (One read-only
`git log` on `data/snapshot.json` was run by mistake while finding the fixed day; reported to the lead.)

### The data: a fixed day for the tools (the same fault World News had)

`check.mjs` item 5 pinned `data/snapshot.json` to `cd7b0f7d…` (the file of 1 Oct), and `test_prices.mjs` and
`shoot.mjs` worked their figures out from whatever the file held while asserting 1 Oct's literals. The refresh has
since rewritten the file (6 to 7 Oct, `d83e36…`), so check item 5 and `test_prices.mjs` failed **at HEAD**, before
this pass touched anything. Fix, the data unchanged: `tools/fixtures/snapshot.json` is the file of 1 Oct byte for
byte (fetched from the public template's commit `bd8f679`, sha256 `cd7b0f7da4b9…37e6d0`), pinned in check item 5;
`test_prices.mjs` reads it; `shoot.mjs` serves it as `data/snapshot.json` by default (a `BASE` the stages' overrides
replace) and adds one stage on the shipped file at its own clock (an hour after `generatedAt`), both themes. Check
item 5 now checks the shipped file's **shape** as `scripts/power_hours.py` writes it (schema 1, generatedAt, zone,
timezone, unit, resolution, source with attribution, license words and `publishable`, hours, days, lastGood, ask ≤ 60)
and keeps `data/appliances.json`'s pin.

### What changed, by the list

- **Item 1, P1.** The band, `#capline`, `#credits`, `#private` and their writes are gone; `credits()` writes only
  `#about-credit` (the id kept), whose static words are `CREDIT_FALLBACK`'s.
- **Item 2.** `PRIVATE_USE` and `privateUse()` as the list gives them; `render()` puts it straight after the zone's
  title. `.statement.private-use` is `--ink`.
- **Item 3.** `js/staircase.js`'s `caption()` became `scaleLabel(M)` (`test_prices.mjs` imported it; it now tests
  `scaleLabel`): `c/kWh, spot price per 15 min, before grid rent, tax and VAT.`; `landingBlock()` writes it under the
  readout as `p.note.scale`, then `div.key` with one item, `Chosen run, at its mean`, a 10 × 3 px ink bar.
- **Item 4, P4.** `nowSection()`: `h2.hl-what` `Now, 10:15–10:30`, `.fig b` 34 px 650, `.u` 15 px, the rank at
  13.5 px; the band's words in `span.cheap` / `span.dear`, the middle half uncolored. *(Corrected after the final
  verifier, 2026-10-08: this said the heading rendered at 15 px 650 "exactly as in Finances 1.2". It did render at
  15 px 650, because `.sec > h2` (0,1,1) outranks `.hl-what` (0,1,0), but that is not Finances: Finances, Outdoor
  Window and Running Dashboard put the label, figure and lead in `div.hl`, out of `.sec > h2`'s reach, and the label
  is 12.5 px 400 there. Now built the same way; see the section at the end.)*
- **Item 5.** Runs on a plate, `.tm` 15 px 600; the saving words in `--cheap` below the mean ahead, `--dear` above,
  uncolored when level or paid to run; the `aria-label`s unchanged.
- **Item 6.** The help note left `statements()`; its words are a paragraph of About's *How the data gets here*.
- **Items 7 and 8.** Plates for Now, the Landing (`section.sec.landing` around `.stw`) and the runs; the halos and
  the head's ring in `--sheet`; `drawLanding()` measures the plate's inner width. `palette.py` checks 2 to 4 run on
  both grounds (the Landing passes on `--sheet`: the staircase 4.62 / 3.70, the level across it 3.55 / 3.48), so
  the list's fallback (the Landing unplated) was not needed. `--cheap` / `--dear` with `--own` / `--owe`'s values;
  `palette.py` check 6 measures them as text on both grounds and `--json` prints them.
- **Item 9.** The About key last in the pane; P7 sizes: the scale is 10.5 / 11.5 / 12.5 / 13.5 / 15 / 34 px.
- **Item 10, the stamp.** When ran out and kept hold together the stamp leads with `Prices ran out … ago.` alone.
  `shoot.mjs` now writes every combination `stamp()` can join, at 390 and 320 px. **Two are still two lines, and
  per the list I stopped and report them, unfixed:** `Kept from the run before. Made after the phone’s time. Updated
  2 Oct, 14:00` measures 371 px of text against 358 px of room at 390 (288 at 320); `Prices ran out 36 h ago. Made
  after the phone’s time. Updated 4 Oct, 14:00` measures 359 px against 358. Both need the phone's clock behind the
  file's by over an hour. `shoot.mjs` prints them as `HOLD` lines for the lead, not failures. Every other state is
  one line, 16 px, at every width tested (the normal, run-out, kept, undated, dated-next-morning, loading and
  no-usable-prices stamps, 320 to 1024 px, and on the shipped file).
- **Item 11, prose.** `NOTES.md` (the CC BY paragraph and the Credits list) and `PROMPT.md` (*Do not touch*, the
  scale label, the look) say the credit is in About, one tap away.
- **Item 12.** `miniapp.json` 1.1 → **1.2**.
- **Plan 0011's owed items.** The header follows the centered pane (`max(16px, 50% - 364px)` plus the inset); the
  old 700 px rule went with the band; the widths check proves the pane's and the header's left edges equal
  `max(16, W/2 − 364)` from 312 to 1024 px. The passive empty `touchstart` listener is added. **The scrub-race
  check** was already here (`window.__fx`, one frame, then the check); it passes at 2, 8 and 20 intervals a second
  in both themes. **Finances' readout fix** was already true: `wireSlider()` follows only `start.id`, and a second
  finger ends a scrub.
- **US English.** Two code comments said "dearest"; check item 17 bans the word; they say "most expensive".

### Checks changed, and why each

`check.mjs`: item 5 (above); item 6 pins version 1.2; item 8 reads About's `#about-credit`, `CREDIT_FALLBACK`,
`PRIVATE_USE` and `privateUse()` at the pane's head, and refuses any band, caption line or credit line; item 13
compares `--cheap` and `--dear` with `palette.py --json` and with HOUSE 11.2 by value; item 14's sizes allow the pane
apps' scale and require the one 34 px rule to be `.fig b`; B11's pattern follows `sec now headline`; item 16's
`ZIP_CAP` 120 785; new item 18 (About key, the foot, plates and the Landing's `--sheet` halos and ring, Now, the
scale's label and key, the centered header, `touchstart`). 51 `ok`. `shoot.mjs`: the fixed day as `BASE`; the
credit read from About; no footer; `.private-use` under the title in ink; the scale's label and key for the
caption; the plates and the About key; Now at 34 px with its heading and uncolored middle half; About's inert list
`['head', 'main']`; the clock-crossing check reads the heading; the treads' contrast against the plate; locales
without the band; widths without the caption, plus 1024 × 768; the stamp on one line in every state; the stamp
combinations; the shipped file's stage. 204 `ok`, 0 failures, 4 `HOLD`.

### Owner calls this leaves

1. The appliance names' label on the Landing (`Dishwasher, Tumble dryer`) is now left out at 390 px on 1 Oct at
   10:20: the plate's 24 px less width leaves no clear spot by the placement rule, which drops a label rather than
   run it through the staircase. It still shows where there is room (run out, the shipped file).
2. The saving's price and percentage colored together (`14.19 c/kWh, 8 % below the mean ahead`), as the list's
   span holds `savingWords()` whole.
3. ~~The plate heading `Now, 10:15–10:30` at 15 px (Finances' cascade) rather than the 12.5 px `.hl-what` declares.~~
   Withdrawn: it was not Finances' cascade. The label is 12.5 px 400 in `div.hl`, as in Finances (the fix below).

### Budgets

Code 87 779 B (84 587 before; cap 200 000). ZIP 98 544 B with today's data (96 628 before), cap 120 785, the house
rule (96 628 × 1.25), which is above 1.1's ruled 97 000, so the cap rises to it. Nothing cut.

### The camera

`c/kWh` stays visible (Now's unit, the readout, the runs, the scale's label); `Car charging` in the runs' names
untouched. At 440 × 956 run out, Car charging's landing `Thu 00:00–04:00` is 31 px longer than the dishwasher's
(30 px). No string the camera waits for or taps changed.

### Phone checks this adds (not claimed here)

The `:active` tint on a run row with the `touchstart` listener; the About key's tap; the private-use line on a
non-CC zone's file; the Landing on its plate in both themes in Snuggery's web view. Each needs the device and iOS
version named in the matrix.

### Real touch

Driven by real touch at 390 × 844, DPR 2, in headless Chromium and WebKit on the shipped file at today's clock
(8 Oct, so the file of 6 to 7 Oct has run out): Car charging pressed moves the landing and is said once
(`Car charging: Tuesday 11:15 to 15:15, 13.48 cents a kilowatt hour.`); a tap on the staircase picks its interval;
the About key and the stamp open About, whose first credit paragraph is the data's own words; Close closes it; no
console error in either engine.

### The scrub race with a resting pointer (QA's should, plan 0012 package 4)

QA found the line above overstated: Power Hours had the per-speed scrub check, but no run with a second pointer
resting on the drawing, which is the Finances bug class (a `pointerleave` from an unrelated pointer ended the
finger's read). `wireSlider()` was safe by inspection (every handler checks `e.pointerId !== start.id`, and there is
no leave handler), but nothing tested it. `shoot.mjs` now adds a fourth scrub, 8 intervals a second, with
Playwright's mouse resting on the head's own path three intervals ahead, so the head slides under the mouse mid-scrub;
the `window.__fx` listener now takes touch moves only. In both themes: 0 moves lost, 0 frames differ, the lift
lands under the finger, the head back to 8 px.

The check was mutation-tested on a scratch copy (deleted after): with a handler that ends the scrub on any mouse
boundary or move event, the new check fails in both themes, and the mouse got exactly one event. With the mouse
resting mid-chart, off the head's path, the same mutation passed, because no event reached the mouse. So where the
mouse rests matters, and the check puts it where the head passes. No app code changed; check.mjs and the ZIP are
unaffected. `shoot.mjs`: 206 `ok`, 0 failures, 4 `HOLD` (the same four).

## The final verifier's two shoulds, fixed under the lead's rulings (2026-10-08)

### Now's label, built as Finances builds it

The verifier measured `Now, 10:15–10:30` at 15 px / 650: `.sec > h2` (0,1,1) beat `.hl-what` (0,1,0). In Finances,
Outdoor Window and Running Dashboard the label sits in `div.hl` with the figure and the lead, and computes to
12.5 px / 400. `nowSection()` now builds `section.sec.now.headline > div.hl > h2.hl-what + p.fig + p.lead`; the
stylesheet adds Finances' `.hl { display: grid; gap: 2px; }`, and the 2 px that `.fig`'s padding and the lead's
margin gave are now the grid's gap, so the plate keeps its rhythm (the figure stays `.fig b`, 34 px 650, so B11 and
the 34 px rule are unchanged). `ART.md` section 3 item 2 says 12.5 px `--ink-2`.
- `check.mjs` item 18 (Now) requires the `div.hl` wrap, the `.hl` grid and `.hl-what`'s rule as written.
- `shoot.mjs` adds a check in both themes: the label computes to `12.5px` / `400`, and the figure and the lead share
  its `div.hl`. Both print `ok`.

### The stamp stays one line: "Made after the phone's time." moves to the pane when another lead is there

The two combinations held for the lead (`Kept from the run before. Made after the phone's time. Updated …`, 371 px
against 358; `Prices ran out 36 h ago. Made after the phone's time. Updated …`, 359 against 358) wrapped to two lines.
**The lead's ruling:** when another lead is in the stamp (ran out or kept), `Made after the phone's time.` leaves the
stamp and is said as a statement in the pane, so the stamp stays one line.
- `app.js`: `madeAhead()` (the file more than `AHEAD_OF_CLOCK`, an hour, after the phone's time) and `aheadInPane()`
  (that, with ran out or kept leading). `stamp()` pushes `Made after the phone's time.` only when no other lead is
  there; `statements()` adds, last, `This file was made after the phone's time: it says 2 Oct, 14:00, more than an
  hour ahead of the phone's clock.` (`p.statement.made-ahead`, the first words at 620 like the others). Alone, the
  lead stays in the stamp and the pane says nothing of it.
- `refresh()` (the clock's tick, which rewrites only the stamp) now also redraws the pane when the statement's
  presence would change, so the stamp and the pane never disagree as the phone's clock catches up with the file.
- `shoot.mjs`: the `HOLD` branch and the `held` list are gone; every combination is an `ok` or `FAIL` line, at 390
  and 320 px, and each checks the pane too: `kept, made after` and `ran out, made after` print the stamp on one line
  (230 and 219 px of text) with the statement in the pane; a new case, `made after the phone's time, alone`, keeps
  it in the stamp (245 px) with no statement; the other three say nothing of the phone's time.
- `ART.md`'s header paragraph and its statements item say when each form shows.

### The runs

`node tools/check.mjs`: all checks pass (code 88 696 B of 200 000; ZIP 98 950 B of 120 785; `ART.md` section 6 updated
to about 88 700 and about 99 000, and its doubled header row removed). `node tools/test_prices.mjs`: 51 checks, all
pass. `python3 tools/art/palette.py`: ALL CHECKS PASS. `PLAYWRIGHT_MODULE=… node tools/shoot.mjs` (both themes): 216
`ok`, 0 failed, no `HOLD`; run again with `SCREENSHOTS=1` to refresh `screenshots/landing-*`, `history-*` and
`about-light` (the label's size changed). Real touch (a scratch script, deleted after), Chromium and WebKit at
390 × 844 and 320 × 568, both themes, on the fixed day: the label at 12.5px / 400 in `div.hl`, a tap on the third run
presses it, the About key opens About and Close closes it; on the kept file made after the phone's time: the stamp
one 16 px line, the statement in the pane, the stamp opens About. 56 `ok`, 0 failed, no console error.

