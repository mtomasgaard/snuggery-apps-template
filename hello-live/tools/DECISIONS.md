# Hello Live: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look; this file holds the
record: the lead's rulings, the owner calls as the pass leaves them, the as-built departures, the
measured budget, what the tools printed, the phone checks. Plan 0011 package B, D1 to D5 and HOUSE.md
are the brief. `ART.md`'s sections 8 and 9, as the art stage wrote them, move here word for word when
the fix stage closes, below the last `---`.

## The lead's ruling on the ZIP (2026-10-06, plan 0011 D42)

**The ZIP cap is 74 000 B, nothing cut** — the measured figure plus about 3 000 B for the fix stages,
as D27, D30, D34 and D39 ruled. The resumed build measured 76 370 B with ART.md's sections 8 and 9
still in it; house rule keeps the build's history out of the shipped ART.md, so the lead moved them
word for word to the end of this file and replaced them with a pointer, and the ZIP measured
**70 777 B**. The lead also rewrote ART.md section 6, where the build had left the art stage's
pre-build table and paragraph under the as-built ones (a broken table in a shipped file). Set as
`ZIP_CAP` with `ZIP_RULED = true` in `tools/check.mjs` while QA ran.

## The art stage (2026-10-03)

**What was read.** Plan 0011 (package B, D1 to D5, the decision log through D40), HOUSE.md in full,
the app (`index.html`, `miniapp.json`, `data/snapshot.json`), its README entry and the README's
conventions, `scripts/refresh_hello_live.py` and `.github/workflows/refresh-hello-live.yml` (the loop,
untouched), `build-zips.yml` and `scripts/build_web.py` (what ships), the camera's three files for the
app's name, Global Weather's `js/units.js`, Power Hours' `ART.md`, `index.html`, `style.css`,
`tools/check.mjs`, `tools/art/palette.py` and this file's twin, World News' section 1 (the Datelines,
for the collision check), and the owner's standing rules for the pane apps.

**Bugs on record elsewhere: none.** Plan 0009 item 5 names Norne, World Oil & Gas, Milky Way and
Global Weather; `docs/review/` does not name Hello Live; the folder had no DECISIONS or NOTES. The
stranger's run found sixteen faults, B1 to B16 in `ART.md` section 8, all musts.

**Measured today** (the commit the pass starts from):

- `wc -c`: `index.html` 7 281 B (the app's whole code), `miniapp.json` 186, `data/snapshot.json` 545.
- `shasum -a 256 data/snapshot.json`: `db50d9add6f0d940671235ee12a3fbe7f2a4f7e90e9620e3f6899539f04333a8`.
- The ZIP by `build-zips.yml`'s command, into the scratchpad: **3 730 B**, 4 entries. D5's cap:
  floor(3 730 × 1.25) + 37 834 = **42 496 B**.
- `python3 hello-live/tools/art/palette.py` from `Template/`: 54 `ok`, `ALL CHECKS PASS`, exit 0.
- The stock in headless Chromium (`tools/.work/stock.mjs`, log `tools/.work/stock-run.txt`): body
  16 px in `-apple-system, system-ui, "SF Pro Text"`; `h1` 16.8 px 700; the headline 41.6 px 640 with
  −0.832 px tracking; the caption and the row labels 14.4 px; the foot 12.8 px centered, its age
  `rgb(138, 51, 36)` (light) with `stale` set; two cards at a 14 px radius; `#app` `aria-live="polite"`;
  0 buttons; no horizontal scroll at 390, 320 or 844 × 390. After a 404, a not-JSON and a wrong-shape
  replacement while open, `#app` held the problem card alone and `#foot` was empty (B8). The browser
  logs its own `Failed to load resource … 404` line on the missing-file case.
- Text widths in the house face (`tools/.work/measure.mjs`, canvas `measureText`): `Wed 30` 33.5 px
  and `Mon 28` 34.0 at 10.5 px (the label column is 40 px); `00:00`, `06:00`, `24:00` 24.4; `now`
  18.6; `01:59 UTC` 95.4 at 600 / 21 px; `03:59 on this phone’s clock` 139.7 at 12.5; the caption line
  495.9 at 11 px; the credits constant 251.4 at 10.5; `Stale. Updated 1 Oct, 03:59` 133.6 at 11.5;
  `Made after the phone’s time. Updated 3 Oct, 11:59` 245.1 at 11.5.

**The signature chosen: the Time Card** (`ART.md` section 1). Candidates set aside, with the reason:
a 24-hour strip of arrivals (a daily Shortcut puts one punch on it); a year ruler and a day ruler
marking the headline's instant (a progress bar; says nothing about the loop); a ring of the day (set
aside by Power Hours; no room for days); the lag as a figure alone (the stamp says it). The collision
check against World News' Datelines: theirs is an index of ages on a log scale at the file's making;
this is rows of days on a clock axis with a punch per arrival and a tail the app measured itself.

**The cap**: `ART.md` section 6 asks the lead to rule on the measured figure after the build, as D27,
D30, D34 and D39 did; D5's 42 496 B cannot hold the face.

**The camera**: nothing inside the app is waited for or tapped (HOUSE 7.4; `MarketingShotsUITests.swift`
238; `MarketingClipsUITests.swift` 400 to 402); the Library row's name `Hello Live` is `miniapp.json`'s
and stays. No change to the camera.

**Phone checks to list in the device matrix** (not claimed): the card's punches at the phone's
display (2 px stems at DPR 3); the stamp's minute timer surviving a return from the background and the
file re-read on Snuggery's `visibilitychange` when a Shortcut delivers while the app is open; the
storage record surviving a relaunch and a Snuggery update; VoiceOver's reading of the card's accessible
name and of the stamp; the phone on its side. Each with the device and the iOS version it needs.

## The build stage (2026-10-03, cut off by a usage limit; resumed 2026-10-06)

**What the first attempt left.** The face and `OFL.txt` vendored (hashes verified), `js/units.js`,
`js/card.js`, `style.css`, `index.html`, `app.js`, `NOTES.md`, `tools/test_card.mjs` (passing) and
`tools/check.mjs` (never run end to end). The resumed build read every file against `ART.md`'s change
list item by item, ran each tool, and wrote `tools/shoot.mjs` and this section.

**Found and fixed on resuming.**

- `check.mjs`'s first full run printed two failures, both the check's or a comment's, not the app's:
  B4's pin (`\.problem`) matched `S.problems` in `app.js`, so it now looks for the stock's selector
  (`\.problem[\s,.{]`); and a comment in `app.js` said `fetch()`, which the one-fetch count read as a
  second call (the comment now says "reading the file").
- The rows' hairlines broke at the grid's 12 px column gap (seen in the first pictures). The gap is now
  the label's right padding, so each row's hairline runs unbroken under label and value.
- **Tab escaped About** to the page's body (the shoot's Tab check). `inert` keeps the page out of the
  order, but Tab from the last key left the sheet; `app.js` now turns the last key's Tab back to the
  first and Shift-Tab from the first to the last, Global Weather's pattern (HOUSE 4.8).

**As built, where it departs from `ART.md` as the art stage wrote it** (`ART.md` is corrected to match):

1. `js/units.js` holds what the app writes and no more: `spokenClock` and `ago` were not built (nothing
   writes them); `count`, `stampWhen` and `localLead` were added.
2. About's `Files read here` reads `1 file, since 3 Oct` (the day without its weekday, as the stamp's
   form), and adds `; storage is unavailable, so the record is this page’s` when storage refuses; a
   `Read before written` line appears only when a file was first read before its writing.
3. A file missing on a return keeps the view and says `data/snapshot.json could not be read (HTTP 404).
   Nothing new arrived. Still showing the file updated 10:04.` (the builder's words; `ART.md` gave only
   the not-JSON case).
4. When the read itself is refused (a page opened from a folder, a connection cut), the first line
   carries the browser's own error text in its parentheses: `could not be read (Failed to fetch).` in
   Chromium; WebKit's words differ (`Load failed`). The hint sentence follows it, as owner call 2 keeps.
5. A kept-data notice is `position: fixed` at 40 % of the frame, over the rows, until its `Close`;
   Power Hours' pattern.

**The tools, as run by the build** (from `Template/hello-live/` unless named):

- `node tools/test_card.mjs`: 48 checks, `all 48 checks pass`, exit 0.
- `node tools/check.mjs`: every check `ok` and one `HOLD`: `all checks pass; 1 held for the lead's
  ruling (the ZIP's size, printed above)`. Code 44 164 B (`index.html` 5 775, `style.css` 8 980,
  `app.js` 14 571, `js/units.js` 5 426, `js/card.js` 9 412); fonts 40 075; the ZIP **76 370 B**, 11
  files, against D5's 42 496 (`ZIP_RULED` false).
- `python3 hello-live/tools/art/palette.py` from `Template/`: `ALL CHECKS PASS`.
- `SCREENSHOTS=1 PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: 151 `ok`, 0 `FAIL`, `all checks pass`,
  exit 0 (log: `tools/.work/shoot-run.txt`). **The Playwright named in the brief
  (`scratchpad/pw/node_modules/playwright/`) had lost its `index.mjs` and `package.json` on this
  machine**, so the run used `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`
  (Playwright 1.63.0, headless Chromium 153.0.8010.12). Lowest text contrast 4.78 (light) and 5.88
  (dark), `now` in `--ink-3`, as `ART.md` section 2 gives; the card's ink 100 % of sampled device
  pixels at 3:1 or more in every state, the lowest 11.47 (light) and 10.36 (dark), where a tail
  crosses a quarter-day hairline, which is the figure the palette prints for that crossing. Load
  times are headless Chromium on this Mac, never phone evidence.
- `shasum -a 256`: `data/snapshot.json` `db50d9ad…f04333a8`, the face `fdf1a28c…cdb262`, `OFL.txt`
  `d1adfffd…be6269`; `miniapp.json` 186 B, unchanged.
- Pictures: `screenshots/card-ranout-*`, `card-fresh-*`, `card-week-*` and `about-*` in both themes
  (`card-week` from a seeded record of six files, a daily Shortcut near 06:00 with Tuesday missed);
  `screenshots/app.png` does not exist for this app and was not written.

**The camera**: unchanged. It names only the Library row `Hello Live` (`miniapp.json`'s name, kept);
nothing inside the app is waited for or tapped, and the arrival is not lengthened (no opening, the face
local with `font-display: block`, the first frame the data).

**For the lead at the commit** (not the builder's files): `README.md` line 346 and the entry at line 88
(Hello Live is no longer a single `index.html`; owner call 5); the template `LICENSE`'s house-face
carve-out; HOUSE.md's budget row (code 44 164, fonts 40 075, the ZIP as ruled) and §7.1 item 13's count
(Hello Live's one `innerHTML` is gone, and it now holds Global Weather's rule); the ZIP cap (owner call
7: the measured 76 370 B, about 71 000 once sections 8 and 9 of `ART.md` move here).

**Phone checks** (not claimed; for the device matrix, an iPhone on the current iOS in Snuggery): the
2 px punches and tails at DPR 3; the minute timer across a return from the background; a Shortcut's
delivery while the app is open re-reading the file and adding a punch; the record surviving a relaunch
and a Snuggery update; VoiceOver reading the card's name, the stamp and its description; Tab and
Escape in About with a hardware keyboard; the phone on its side with its safe areas; WebKit's words in
the refused-read notice.

## After QA (2026-10-06)

QA passed the pass and raised one finding, a should: the live card left about 55 to 60 % of a
390 × 844 screen blank between its last line and the caption band in every state, because this kind
(One live card, HOUSE.md section 4) has no plate to take the frame's free height the way a map or a
chart does. Applied, not declined.

**What changed.** The Time Card's rows now take the pane's free height, in whole pixels from 14 px (the
old fixed row, now the least) to 40 px (`ROW_MAX`). `js/card.js` gained `rowFor(room)` and
`layout(width, rowH)`; the punch and the notch keep their place relative to the row (4 px and 5 px short
of it, so 10 and 9 at 14 px, 36 and 35 at 40), the tail still runs at the punch's top 3 px under the
row's top, and every x is unchanged. `app.js` measures the room as `#main`'s height less everything
else on the page (the stale sentence included, so `statement()` now runs before `drawCard()`), and its
`ResizeObserver` watches `#main` for a new height as well as a new width. Nothing else moved: no new
color, control, word or file, and the data files are untouched.

**Chosen over.** Centering the content block vertically: HOUSE.md section 4.1 keeps content
left-aligned and top-anchored, and a centered card floats on a phone and jumps when the stale sentence
appears. Showing more days than seven: changes what the card claims, About's words and NOTES.md. Rows
with no cap: at 390 × 844 in the fresh state they would be about 64 px, and a 2 px stem 60 px tall
stops reading as a punch. 40 px leaves 194 px of the pane below the page in the fresh state and 146 px
in the stale and week states, against 376 px and 328 px with the 14 px rows before (the same pane
less 7 × 26 px); the rest is the honest length of a page with three rows and no plate. Raise `ROW_MAX` if the owner wants it fuller.

**As measured** (`tools/shoot.mjs`, headless Chromium, never phone evidence): rows 40 px at 390 × 844,
360 × 740 and 820 × 1180; 35 at 375 × 667; 31 at 312 × 675 (125 % text); 16 at 320 × 568; 14 on its
side at 844 × 390. Where the rows are between their least and most, the pane left below the page is
under 7 px (the floor's remainder over seven rows).

**Tests.** `tools/test_card.mjs` gained four checks (52, was 48): `rowFor()` at its edges, `layout()` at
40 px, the marks at 40 px against the same formulas, the tails at 40 px the same pieces as at 14.
`tools/shoot.mjs` reads the row height from the hook and checks the punch, notch and card heights
against it, and that the rows either fill the pane to under 7 px, stop at 40, or stay at 14 with no
room; the width runs print each width's rows and remaining space, and require 14 on the side. With
`ROW_MAX` set back to 14 the run printed 13 FAIL lines, so the checks pin the change; with 40 it printed
151 ok, 0 FAIL.

**ART.md** section 1 corrected in place (the rows, the drawing's height, the punch, the notch, the
test hook) and section 6's app-code row (45 570 B). `screenshots/` re-shot (`SCREENSHOTS=1`); there
is no `screenshots/app.png` composite for this app (shoot.mjs: "absent, as before the run").

**Phone checks added** (not claimed): the rows' height on an iPhone in Snuggery, where WKWebView's
frame has no browser chrome; that a Shortcut's delivery while open, or the stale sentence appearing at
the six-hour mark, redraws the card to its new room without a visible jump.

## After review (2026-10-06)

The final review returned *fix*: one must, four shoulds, five nits. All applied except the two that
belong to the lead (outside this folder) and the optional sentence under the card, declined below.

**Must: a file written before the seven days left the card empty and its name false.** On the starter
pack's route the bundled file is older than a week on many first launches; `geometry()` dropped the
entry with its tail, the card drew seven empty rows, and the name said `no file read`. Now an entry
written before the seven days and first read inside them draws no punch and the part of its tail that
lies inside (every older row whole from the oldest row's left edge, then the reading's row to
`firstRead`), counts as a file read (`carried`), and the name says `…; the latest written Thursday 1
October, 03:59, before these 7 days, first read here Saturday 10 October, 10:00.` `no file read` is
kept for an empty record; a record with nothing in the seven days says `no file read in these 7 days`.
`test_card.mjs` G6 now expects the in-window pieces and a nine-days-on case and two `describe()` cases
were added; `shoot.mjs`'s rule (`marks()`) gained the same branch and a new state per theme at
2026-10-10T08:00Z (no punch, seven tail pieces, the name). Picture: `tools/.work/shots/card-ninedays-*`
(not kept in `screenshots/`). The optional line under the card (`This file was written 1 Oct, before
the card's seven days.`) is **declined**: the stamp already says `Stale. Updated 1 Oct, 03:59` and the
owner asked today for less text on front pages.

**Should: the now notch had a punch's shape.** It is now 9 px at every row height and never more than
the row less 9 (5 at 14 px, 7 at 16, 9 from 18), rising from today's foot, joined to its word by a
1 px `--line` hairline drawn under the ink (`.nowhair`). On a fresh import the punch, its tail at the
row's top and the notch at the foot no longer close into a bracket (`card-fresh-*`, read by eye). The
reviewer's other option, a tick in the now strip, was set aside: the tail runs at the row's top, so a
notch hanging from the top would touch it again.

**Should: the week picture showed an impossible loop.** The committed file is gone from the week's
record; `shoot.mjs` serves a fixture file written Sat 3 Oct 05:58 Oslo (`03:58 UTC`, day 276, week 40,
minute 238, its ask table the same) through the override, seeds the five earlier days, and opens at
06:12, so this launch adds today's punch with a 14-minute tail. `screenshots/card-week-*` and
`about-*` re-shot. The data file is untouched.

**Should: ART.md's history paragraph** replaced with one sentence pointing here.

**Should: owner call 10, the sentence under the rows.** Its default is reversed: the sentence, its
CSS and `statement()` are gone, and the stamp and About (`Stale after: 6 h`) carry staleness. Restoring
it is the build's `statement()` and three CSS lines. **For the lead, not done here:** whether a credit
with nothing to license (`Data: this repository's own refresh job; no outside source.`) must stay on
screen under HOUSE 4.5 is a HOUSE question; the band keeps it until the lead rules.

**Nits applied:** a stored record that does not parse is an empty record and no longer reports
storage as unavailable (`readRecord()` catches the read and the parse apart; `check.mjs` pins both);
About says `so rarely exactly on the hour` and `the file's own table, written by the job` (no
hard-coded count); the kept notice adds the next step, `In Snuggery, Options, then App Files shows
what the file holds.`, as a second paragraph (`shoot.mjs` checks it); `miniapp.json` version 2.0.
**For the lead:** `Template/README.md` line 92, `personalise` to `personalize`.

**Measured** (2026-10-06): `node tools/check.mjs` `all checks pass`, app code 46 888 B, fonts 40 075 B,
ZIP 71 854 B of 74 000; `node tools/test_card.mjs` `all 55 checks pass` (with the fix reverted in
`js/card.js`, the carried branch and the notch formula, it printed `6 of 55 checks failed`, so the
checks pin both); `shoot.mjs` 163 ok, 0 FAIL, `all checks pass` (headless Chromium, not phone
evidence); `palette.py` `ALL CHECKS PASS`. The camera's only string, `Hello Live`, is unchanged.

**Phone checks added** (not claimed): a fresh punch and the short notch told apart at DPR 3; a starter
pack install whose data is more than seven days old, showing the tail through every row and VoiceOver
reading `before these 7 days`.

---

---

## ART.md's sections 8 and 9, as the art stage wrote them (moved word for word by the lead, 2026-10-06)

## 8. The change list

In order, for the builder; each names its file. Items 1 to 16 are the stock's faults, found by the
stranger's run (`tools/.work/stock.mjs`, headless Chromium, both themes) or by reading `index.html`,
and are **musts**. No bug for this app is on record elsewhere: plan 0009 item 5, `docs/review/` and
the app's folder (which has no DECISIONS or NOTES) name it nowhere. Items 17 on are the pass.

1. **B1, the stamp's color** (`index.html` to `style.css`, `app.js`): the age was green (`--accent`
   `#2f6f4f` / `#7ec79b`) and `stale` red (`--warn` `#8a3324` / `#e5907f`); the word `stale` never
   appeared (the computed color of `Updated 2 days ago` was `rgb(138, 51, 36)`), so staleness was
   carried by hue alone, at ΔE 0.062 from the green under deutan vision. Now `Stale. Updated 1 Oct,
   03:59`, a sentence in `--ink`, no hue (section 3).
2. **B2, the headline off the scale** (`style.css`): 41.6 px, weight 640, letter-spacing −0.832 px; the
   name 16.8 px at 700. Now 21 px at 600 and 15 px at 650, tracking 0 (section 4).
3. **B3, no face** (`fonts/`, `style.css`): the system stack and monospace `code` chips. Now the house
   face, one family through `--face`, no monospace.
4. **B4, the card kit** (`style.css`): two white cards at a 14 px radius on a gray page (card against
   page 1.08, edge 1.19). Now the page between hairlines.
5. **B5, the age with no instant** (`app.js`, `js/units.js`): `Updated 2 days ago`, centered under the
   rows, with no clock time and no threshold stated. Now the house stamp in the header, the instant
   on the phone's clock, the threshold (6 h) in About.
6. **B6, a file from the future reads `just now`** (`app.js`): `ageOf()` rounds a negative age to under
   two minutes. Now `Made after the phone’s time. Updated …` past an hour ahead; `tools/test_card.mjs`
   pins it at fixed clocks.
7. **B7, an unreadable date printed raw** (`app.js`): `span.textContent = age ? age.text :
   data.generatedAt` put an ISO string on screen. Now `Undated file.`, no punch, About's note.
8. **B8, a broken replacement wipes the screen** (`app.js`): `problem()` emptied `#app` and `#foot`;
   measured in the stranger's run, a 404 replacement while open left the page with the notice alone.
   Now the view stays and a notice with `Close` says what arrived (section 3).
9. **B9, `innerHTML` with markup** (`app.js`): the one use HOUSE 7.1 counts for this app
   (`q.innerHTML = hint`), carrying `<code>`, a midline ellipsis (U+22EF, not in the cut), an arrow (U+2192, a tell) and spaced em dashes.
   Now `textContent` only; the app holds Global Weather's rule and `check.mjs` says so.
10. **B10, `<main aria-live="polite">`** (`index.html`): every render re-announced the pane. Now one
    polite live region for sentences.
11. **B11, every return rebuilds the page** (`app.js`): `render()` cleared and rebuilt the DOM on each
    `visibilitychange`, same file or not. Now in place: the same file moves only the clock's words; a
    new file updates text nodes and adds a punch.
12. **B12, the page's declarations** (`index.html`): `lang="en"`, no `theme-color` metas, no
    `color-scheme` meta. Now `en-US`, both metas at `--page`, the meta.
13. **B13, nothing explains the numbers** (`index.html`): no About, no credits, nothing saying that
    `Minute of day 119` is the minute the file was written, in UTC, or that the headline is UTC while
    the phone is not. Now About's four sections, the lead's local clock, the credits constant.
14. **B14, the problem card** (`index.html`, `style.css`, `app.js`): red title and edge, monospace
    chips, no `role="alert"`. Now the house notice.
15. **B15, the age never moves while visible** (`app.js`): no timer, so `just now` stayed for as long
    as the app stayed on screen. Now one timeout to the next whole minute while visible, cleared when
    hidden; `shoot.mjs` asserts the stamp's words change across a faked minute and that nothing runs
    while hidden.
16. **B16, the headline's width** (`style.css`): no `overflow-wrap` on a string the file controls, so a
    long unbroken headline would widen the page (not observed on the committed file; a fixture in
    `shoot.mjs` proves the fix at 320 px). Now `overflow-wrap: anywhere`.
17. **`fonts/`**: copy `ysabeau-office-gw.woff2` and `OFL.txt` byte for byte from `global-weather/fonts/`;
    `shasum -a 256` gives `fdf1a28c…cdb262` and `d1adfffd…be6269`.
18. **`index.html`**: rewritten on Power Hours' markup: the head of HOUSE 4.1 (`en-US`, the viewport,
    `color-scheme`, both `theme-color` metas, `<link rel="icon" href="data:,">`, `style.css`); the
    header (`h1 translate="no"`, the stamp button and its hidden hint); `<main class="pane">` with the
    notice and the pane body (the headline row, the caption, the `Time card` heading and its `<svg
    role="img">`, the `dl`, the statement); the band with the fixed caption line and the credits
    constant in static markup; About with its four sections and two `Close` keys; the live region;
    `<script type="module" src="./app.js">`. The shape comment that heads the stock's script moves to
    the top of `app.js` unchanged in substance (the file's shape is documented there for whoever
    rewrites it, `README.md`'s convention), with `ask` added to it.
19. **`style.css`**: new, from Power Hours' sheet cut to this app: the tokens of HOUSE 3.1 in both
    themes exactly (`palette.py --json`), the `@font-face` rule word for word, the frame (`html, body`
    overflow hidden on `--page`, `body` a column at `100dvh`, `overscroll-behavior: none`), the
    header, the pane, the headline row (`.fig b` the one 21 px figure, the lead, the caption), the card
    (`.card svg` at 10.5 px, `.punch`, `.tail`, `.today`, `.hair`, `.axis`, `.tick`, `.now`, `.nowl`), the
    rows (`dl` at 12.5 px, 28 px rows, hairlines), the statement, the band (the caption line at 30 px,
    15 from 640 px), the notice, the text keys, About, hover under `(hover: hover)`, the 700 px
    gutters, the landscape rule, Reduce Motion. No `transition`; the one animation is About's
    `sheet-in`; no `box-shadow`, `backdrop-filter`, uppercase, letter-spacing, monospace, gradient.
20. **`js/units.js`**: Global Weather's module cut to what this app writes and extended with the stamp:
    `NB`, `MINUS`, `int`, `count`, `si`, `clock`, `dayMon` (the year when not the phone's), `stampWhen`,
    `dayTick`, `full`, `spoken`, `span`, `localLead`, `offsetWord(now)` (`UTC+2`, `UTC`, `UTC−3:30`), and
    `stamp(made, now)` returning `{ lead, rest }` for the five states of section 3 with the thresholds
    as constants (`STALE_MS = 6 h`, `AHEAD_MS = 1 h`). `toFixed` and `toLocale*` nowhere else; `Intl`
    nowhere.
21. **`js/card.js`**: pure: `layout(paneWidth)` (the label column, px per hour, the plot width),
    `geometry(record, now, layout)` (seven rows from the phone's local midnights, punches, tails split
    at midnights, the `now` notch, the axis labels, the day labels), `describe(record, now)` (the
    accessible name in words), `draw(svg, geometry)` (SVG children built with `createElementNS`, never
    markup strings, updated by replacing the children once per draw), `remember(record, written, now)`
    (dedupe by `written`, append, cap at 400). `window.__hl` exposes `card()` and `record()` and nothing
    in the app calls it.
22. **`app.js`**: the module: `readJson()` and `validate()` with the notice words of section 3; the
    render in place (text nodes kept and updated; the `dl` rebuilt only when the row count or labels
    change); the storage record under `hello-live.card` in `try`/`catch`; the stamp's five states; the
    minute timeout; `visibilitychange` and `pagehide`; About (open from the stamp, `Close` ×2, Escape,
    Tab held inside, focus returned, `overscroll-behavior: contain`); the kept-data notice with
    `Close`; the live region's one sentence on a new file; `document.fonts.load` before the first
    card and a redraw on `loadingdone`; the test hook. No `innerHTML`, `insertAdjacentHTML`,
    `outerHTML`, `document.write`, `eval` or `new Function`.
23. **`NOTES.md`**: new, short, ships: what the file is and who writes it, that the job fetches nothing,
    the stale threshold, the card's storage key and what the card can and cannot tell, the font's
    credit line word for word, and that `data/snapshot.json` on the public repository is rewritten by
    the refresh job (the mirror rule).
24. **`tools/check.mjs`**: on Power Hours' pattern, every item of HOUSE 7.1: the ZIP's contents; no
    scheme; references; `fonts/` exactly the two files at their sha256 and no supplement; the data's
    sha256 `db50d9ad…f04333a8`; `miniapp.json` with the name `Hello Live`; the vendor list; the credits
    constant word for word in the band's static markup and in `app.js`; the camera's string (the
    name); the one storage key with the `hello-live.` prefix and no other; SI; no transition and only
    `sheet-in`; `innerHTML` never set; `palette.py` passes and `style.css`'s tokens equal `--json` in
    both themes; the look greps (the tokens, no accent or warn token, no `box-shadow` and the rest, one
    family, every script font string naming `"Ysabeau Office"` first, no middle dot or em dash in the
    app's strings, no arrow, pointer, triangle, circled i or midline ellipsis (U+2192, U+27A4, U+25B8, U+25BE, U+25B4, U+24D8, U+22EF) and no three-dot ellipsis in shipped text, both `theme-color` metas, the
    `@font-face` rule, `en-US` and the viewport, the scale with one 21 px figure); items 1 to 16
    pinned in the code; budgets with the ZIP line `HOLD` against 42 496 until `ZIP_RULED`; US spelling
    in every shipped text file; the characters the app writes all in the cut.
25. **`tools/test_card.mjs`**: Node, no dependencies, its own implementation of section 1's rule: px per
    hour at 312, 320, 360, 375, 390, 430 and 844 px; the punch x of fixed instants in `Europe/Oslo`
    (`TZ` set by the test), including both 2026 clock-change days; a tail across one and two midnights;
    a tail under 1 px not drawn; a `firstRead` before `written`; the record's dedupe and its 400 cap;
    `stamp()` at fixed clocks for all five states and the 6 h and 1 h edges; `describe()`'s words; the
    lead's local clock for the committed file (`03:59 on this phone’s clock` in Oslo).
26. **`tools/shoot.mjs`**: Global Weather's pattern cut to this app, both themes, 390 × 844, DPR 2,
    touch, the clock faked at Sat 3 Oct 2026, 10:00 UTC and at Thu 1 Oct 2026, 02:30 UTC (31 minutes
    after the committed file's writing: the fresh state): boot (the face loaded before the card, the
    credits visible and word for word, the headline and rows equal to the script's own read of the
    file); every text node at 4.5:1 or more; the signature sampler on the card's ink pixels against
    the pixels under them (target 3:1, 90 % of samples, the lowest printed); the SI scan; hit targets
    (the stamp and both `Close` keys at 44 px or more); About from the stamp, Escape, Tab held, focus
    returned; the storage path (a second fixture file with a later `generatedAt` adds a punch and says
    `New file, written …` once; storage blocked by an init script leaves one punch and no console
    error); broken data (missing, with the browser's own 404 line allowed once; not JSON; the wrong
    shape; undated; a file an hour ahead; stale; a broken replacement while open keeping the view and
    its `Close`); the minute timer (a faked minute moves the stamp and `now`; nothing runs while
    hidden); widths 320, 360, 375, 844 × 390 and 312 × 675 at 125 % zoom, with a 40-character
    unbroken headline fixture at 320 (no horizontal scroll; the caption's longest line inside its
    fixed height; on its side the pane's content inside the frame or scrolling inside it); Reduce
    Motion (About's animation at 0 s); pictures to `tools/.work/shots/` and, with `SCREENSHOTS=1`, to
    `screenshots/`, never `screenshots/app.png`.
27. **`ART.md`**: corrected to the look as built (the measured code and ZIP, the card's figures at
    390 px as drawn); sections 8 and 9 moved to `tools/DECISIONS.md` by the fix stage.
28. **`tools/DECISIONS.md`**: the record (the art stage's part is there now).
29. **`miniapp.json`**: unchanged, the name above all. **`data/snapshot.json`**: unchanged, byte for
    byte. **`.gitignore`**: as the art stage left it (`tools/.work/`, `tools/node_modules/`, `dist/`).

For the lead at the commit (not the builder's): `README.md` line 346 says *Hello Live is a single
`index.html` with its CSS and JS inline*, which stops being true (owner call 5); the entry at line 88
can name the Time Card in one sentence; the `LICENSE`'s house-face carve-out adds Hello Live; HOUSE.md's
budget row and §7.1 item 13's count (Hello Live's one `innerHTML` is gone).

---

## 9. Owner calls

Left open, each with what the pass does unless the owner says otherwise:

1. **The order on the pane**: headline, then the Time Card, then the three rows. The owner's rule for
   the pane apps puts the short facts in a table on top; here the three facts are the headline's
   instant written three more ways, so the pass puts the card, which is what the app is for, before
   them. The reverse is a two-line swap in `index.html`.
2. **The hint for a page opened from disk** stays in the missing-file notice, as words
   (`Opened from a file, a browser blocks the read: serve the folder with a local web server.`): Hello
   Live is the first app a copier opens, and in a browser it is the one most likely to be opened
   straight from a folder. Power Hours dropped its equivalent; the owner may want the two alike.
3. **The record** (`hello-live.card`, at most 400 files, seven days drawn): the stock app stored
   nothing, and the house's other loop apps store nothing. The alternative is a card with one punch,
   the current file's, drawn from nothing but the file, which is honest and proves less: a daily
   Shortcut's rhythm is then never seen. The pass takes the record, named plainly in About.
4. **The stale threshold** stays the stock's 6 hours and is now said in About. A copier whose Shortcut
   runs once a day will read `Stale.` most of the day; that is this app's claim about its own hourly
   job, and the sentence under the rows says so. The owner may prefer a day.
5. **The README**: line 346's sentence and the entry at line 88 are the lead's at the commit (section 8's
   last paragraph). If the owner would rather Hello Live stayed the one single-file example for
   readers, the house's `js/` modules can be inlined into `index.html` at the cost of the shared
   `units.js` pattern and the decode test's import; the pass does not do this.
6. **Two clocks**: the headline is left in the file's own words (`01:59 UTC`) and the lead gives the
   same instant on the phone's clock (`03:59 on this phone’s clock`). The alternatives are to show
   only the file's words (and leave a stranger in Oslo to do the sum) or to rewrite the headline,
   which is the file's and not the app's to change.
7. **The ZIP cap**: the lead's ruling on the measured figure after the build (section 6; about 70 000 B
   expected against D5's 42 496).
8. **The rows' order on the card**: today at the top, the six days before it below, so the `now` notch
   and the newest punch sit where the eye lands. A time clock's card runs the other way, Monday at the
   top; the pass does not.
9. **The card's hours in the phone's clock**, with the offset printed in the caption, not in UTC, which
   is the file's clock. A word key to switch would be a control on a card that has none and a stored
   preference; the pass does not add one. If the owner wants UTC, the caption's last sentence changes
   and the rows are ruled by UTC midnights.
10. **The sentence under the rows** when the file is stale (`No new file for 2 d. The job writes about
    every hour; a Shortcut carries the file to this phone when it runs.`): it repeats the stamp's fact
    in longer words for a stranger who does not read stamps. The owner may want the stamp alone.
