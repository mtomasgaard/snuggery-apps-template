# World News: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look as built; this file
holds the record: the art pass's change list and owner calls as it left them, the as-built departures, the
measured budget and the phone checks. Plan 0011 package B, D1 to D5 and `Template/HOUSE.md` are the brief.

## The lead's ruling on the ZIP cap (2026-10-02, plan 0011 D30)

**The ZIP cap is 88 000 B; nothing is cut.** The build measured 84 990 B against D5's 72 140 (+17.8 %) with the
whole change list applied, nothing minified and no comment stripped. Stored in the ZIP: the face and its
license 37 510 B — more than the whole stock ZIP — the data 9 157, the app code 16 533 (7 602 before), the
shipped ART.md 9 886, NOTES.md and PROMPT.md 10 255. The formula cannot fit an app smaller than the face it
gains (HOUSE §8 now says so), and a shorter ART.md would still leave the ZIP near 81 000 while hiding the look
as built. The raise leaves about 3 000 B for the fix stages; they pay for nits in place and report anything
over. The lead set `ZIP_CAP` in `tools/check.mjs` to 88 000 with this reason, so the one failing line passes.

---

## ART.md's sections 8 and 9, as the art pass wrote them (moved word for word by the builder, item 15)

## 8. Change list (the pass record; moves to `tools/DECISIONS.md`)

**Bugs on record.** None for World News: plan 0009 item 5 names Norne, World Oil & Gas, Milky Way and
Global Weather; `docs/review/` and the app's `NOTES.md` record none. **The stranger's run** (headless
Chromium, 390 × 844, both themes, the clock at 1 Oct 2026; `tools/.work/look.mjs`) found these. All
are musts.

- **B1** Dates and times come from the phone's locale: `Updated 07:01 AM`, `Tue 02:00 AM` and
  `Sep 23` on an American phone, `23 Sept` on a British one, `tir. 02:00` and `23. sep.` on a
  Norwegian one, `火 09:00` and `9月23日` on a Japanese one.
- **B2** Stale is a color: the stamp turns amber (`#a87400`) with no `Stale.`; a cached region is an
  amber dot on its tab and an amber uppercase `CACHED` badge (3.69:1); a cached story `· cached` in
  amber.
- **B3** The stamp is a `<p>`: it opens nothing and no keyboard reaches it; `problem()` empties it, so
  the data's age leaves the screen.
- **B4** `<main aria-live="polite">`: every tab change and every return re-reads the whole pane, up to
  48 stories, to VoiceOver.
- **B5** A cached region's tab is renamed `Europe — cached headlines` (a spaced em dash), so the
  camera's `app.buttons["Europe"]` fails exactly when Europe's feeds fail.
- **B6** A broken replacement while open wipes the screen: after `<html>oops</html>` arrives, 0
  stories, 0 tabs and no stamp.
- **B7** Notices print literal backticks (``It has no `generatedAt` string``), set a hint through
  `innerHTML`, use a monospace `code` face, a red edge and title (`--critical`), `Options ⋯ → App
  Files` (⋯ is not in the face; → is a tell) and a `python3 -m http.server` hint that cannot apply
  inside Snuggery.
- **B8** Text under 4.5:1: the stamp and the footer, 11.25 px `#687080` on `#eef0f4`, 4.36; the
  `Terms` links 3.97.
- **B9** Tabs 27 px tall; the chosen one an accent-blue pill.
- **B10** The tells of section 7: middle dots in every source line and the stale stamp, uppercase
  tracked headings, a letter-spaced name, white rounded cards, an accent hover, the system font.
- **B11** Three time forms in one list (`12 h ago`, `Tue 02:00 AM`, `Sep 23`), the relative ones
  counted from the phone's clock; and a time of day printed for 20 headlines whose feed gives only a
  date (`Sat 02:00 PM` for a UN News story stamped 12:00:00 UTC).
- **B12** A story link's accessible name is the whole row (headline, source line and summary, up to
  about 400 characters); three links named `Terms`.
- **B13** `Today's headlines` (`miniapp.json`, `PROMPT.md`): at the file's making Europe's newest
  headline was 2 d 5 h old and Oceania's oldest 50 d.
- **B14** Three stories are under two or three regions (Global Voices files one story into several
  regional feeds, as `NOTES.md` says) with no word saying so; on `All` they show twice, unexplained.
- **B15** British spelling and tells in shipped text: `colour` (`style.css` comments, 2), `licence` in
  prose (`app.js` 1, `NOTES.md` 7, `PROMPT.md` 7; `NOTES.md`'s quotation of The Conversation's terms
  keeps its word, allow-listed by file and phrase; the data key `licence` stays), `...` in `app.js`'s
  shape comment.
- **B16** `<html lang="en">`, no `color-scheme` or `theme-color` metas; the page scrolls under a
  sticky header rather than a pane inside the frame; every return re-renders the whole page even when
  the file has not changed.

**Items**, in order:

1. `.gitignore`: `tools/.work/`, `tools/node_modules/`, `dist/` (written by the art pass).
2. `fonts/`: copy `ysabeau-office-gw.woff2` and `OFL.txt` from `global-weather/fonts/` byte for byte.
3. `js/units.js` (new, pure): `NNBSP`; the stamp's forms (`07:01`, `1 Oct, 07:01`, the year when not
   this one); a story's date (`23 Sep`) and date with time (`30 Sep, 22:07`), by hand from the phone's
   clock; `isDateOnly(iso)` (exactly 00:00:00 or 12:00:00 UTC); spans for the scale (`1 h`, `6 h`,
   `1 d`, `7 d`, `60 d`, open ends `≤ 1 h`, `≥ 60 d`); spoken ages (`7 days 17 hours`); About's instant
   with its offset (`Thu 1 Oct 2026, 07:01 (UTC+2)`). Copied in kind from `global-weather/js/units.js`,
   only what this app writes. B1, B11.
4. `js/datelines.js` (new, pure): ages from `generatedAt`, the scale, the label column, ticks with
   their shared parts and hollow state, the nearest tick to a tap; and a `draw(svg, model, chosen)`
   that builds the SVG with `createElementNS` and `textContent`. Section 1.
5. `index.html`: `lang="en-US"`; `color-scheme` and both `theme-color` metas (`#e8eef0`, `#141d21`); the
   header (h1 `translate="no"`, the stamp button with its `hidden` hint, the tab row); `<main
   class="pane">` with the notice and `role="tabpanel"` body, no `aria-live`; the caption band (caption
   line, credits); About as a `role="dialog"` sheet with its four sections and two `Close` keys; the
   live region. B3, B4, B16.
6. `style.css`: rewritten on the house (Finances' `style.css` is the pattern): the tokens and the one
   `@font-face`; the frame (header, the pane scrolling inside, the caption band at a fixed height); the
   tabs and the tracer; sections, rows, statements; the Datelines; the notice; About; Reduce Motion;
   a phone on its side; safe areas. The stock tokens (`--accent`, `--stale`, `--critical`,
   `--surface-*`, `--radius`) and the white region cards go. B2, B8, B9, B10.
7. `app.js`: the render on the new markup: tabs with exact names, `aria-describedby` for a cached
   region and arrow keys (B5); the Datelines at the head of every pane with the tap (section 1); story
   rows as section 3 (B11, B12, B14); statements for failed feeds and empty regions (B2); the stamp
   (B1, B2, B3); the caption line and the credits; About's lists built with the DOM from the file
   (sources word for word, the terms address as the link); `validate()`'s cases rewritten as plain
   sentences, `problem()` a notice that keeps the stamp (B7); a return re-reads and compares
   `generatedAt` (same: the stamp only; new: re-render keeping pane and scroll; broken: keep the view,
   a notice with `Close`) (B6, B16); the live region; `window.__wn` as an inert test hook. No
   `innerHTML` but `= ''`; the escaping helper goes with its last use.
8. `miniapp.json`: description `The latest headlines by region from freely licensed newsrooms' RSS
   feeds, each linking out to its publisher` (≤ 200 characters); name and version unchanged. B13.
9. `PROMPT.md`: `eight of today's headlines` becomes `the latest eight headlines`; arrows and `⋯`
   become words (`Safari, Share, then Snuggery`; `Options, then App Files`; `Options, then Rebuild Data
   Now`); `licence` in prose becomes `license`. B13, B15.
10. `NOTES.md`: `licence` in prose becomes `license` (quotations keep their own words); the font's
    credit line word for word; a sentence that the app now shows each headline's age at the file's
    making. B15.
11. `tools/art/palette.py` (written by the art pass; ends `ALL CHECKS PASS`).
12. `tools/check.mjs` (HOUSE 7.1, all seventeen, from `finances/tools/check.mjs`): the data's sha256
    above; the camera's `Europe` and `Americas` as tabs built from the data; no `localStorage` at all;
    the credits' constant words; the date-only rule; the data key `licence` where `ART.md` and `app.js`
    name it, allow-listed by file; the ZIP cap as section 6 settles it; the
    out-of-cut characters of the current file listed, not failed.
13. `tools/test_datelines.mjs` (HOUSE 7.3): ages, positions at 320 and 390 px, shared parts and hollow
    ticks recomputed from `data/snapshot.json` with formulas written in the test, against
    `js/datelines.js`; the date-only count (20); the cross-filed stories (3).
14. `tools/shoot.mjs` (HOUSE 7.2 as a pane app allows: no player, no focus mode, no units key), the
    clock fixed at 1 Oct 2026, 12:00 in Oslo: boot (the camera's tabs by role and name, the face, the
    credits); text contrast on every pane; the tracer under exactly the chosen tab; SI and the date
    forms in every visible node; the same words under `nb-NO`, `en-GB`, `en-US` and `ja-JP` (B1); the
    Datelines' ink sampled on rendered pixels against the page (90 % of samples ≥ 3, the lowest
    printed); every tick's x against the script's own decode; a tap on a tick selecting its story and
    saying one sentence, on `All` and across panes; a vertical swipe starting on the Datelines
    scrolling and selecting nothing; hit targets; About (opens from the stamp, sources word for word,
    Escape); hidden and back (the same file, then a new one keeping pane and scroll); a broken
    replacement keeping the view (B6); stale at 31 hours; a copy with Europe's feeds cached (the tab
    still named `Europe`, hollow ticks, the statement); broken files at the start (404, a web page, an
    error envelope, empty regions); Reduce Motion; widths 320, 360, 375, 844 × 390 and 125 % zoom
    (312 × 675), the caption inside its two lines. Pictures to `tools/.work/shots/`; never
    `screenshots/app.png`.
15. Move sections 8 and 9 of this file to `tools/DECISIONS.md`, leave a short *Where the record is*,
    and fill section 6 with the figures as built.

---

## 9. Owner calls left open (the pass record; moves to `tools/DECISIONS.md`)

1. **The ZIP cap.** D5's formula gives 72 140 B; section 6's simulation measures about 84 000 B with
   nothing cut (the code's growth about 8 900 B stored, the shipped `ART.md` about 9 600). The
   formula leaves this 27 kB app about 14 000 B for all its code and its `ART.md`, against 7 602 B of
   code before the pass. As for Finances (plan 0011 D27, a 70 kB app the formula also undercounted),
   the recommendation is that the lead rules on the measured figure after the build: nothing cut,
   nothing minified, no comment stripped. If the owner would rather hold nearer the formula, the one
   lever that removes nothing a reader of the app uses is a shorter shipped `ART.md` (the look as
   built, without section 1's derivation and section 3's detail, which `tools/DECISIONS.md` keeps)
   saves about 4 000 B stored, and the ZIP would still be about 80 000 B: the formula cannot be met
   without cutting the house's own modules.
2. **The data's own words** (a data follow-up after the pass, never the pass): `scripts/world_news.py`
   writes each source's `licence` line: Global Voices' says `link to the licence`, and Global Voices'
   and The Conversation's both use a spaced em dash (`Creative Commons Attribution 3.0 — credit the
   author, …`). They are the
   repository's words, not the publishers', so US English is open to the owner; the app shows them
   word for word either way, and the key `licence` stays.
3. **Date-only headlines.** The pass shows a headline stamped exactly 00:00:00 or 12:00:00 UTC by its
   date alone (20 of 48 today). The alternative is the feed's time as given, which prints `14:00`
   for a UN News story whose feed never said a time.
4. **The scale.** Logarithmic, 1 h to 60 d, fixed. A linear scale of the last 14 days with an open
   `older` end would read more plainly but crushes Oceania's five stories of the last 15 hours into
   12 px; the pass chose the logarithm and says so in the caption and About.
5. **The README entry** (the lead's file): `Today's headlines by region…` has B13's problem; suggested
   `The latest headlines by region…, each headline's age drawn at the head of the pane.`

**Phone checks** (for the lead's device matrix; not claimed by any headless run; an iPhone on iOS 18
and one on iOS 26): a tap on a story raising Snuggery's *This app wants to open a web page* and
*Open in Safari* reaching the publisher, then back; VoiceOver on the tabs (a cached region's tab read
as its name, then its description), on the Datelines' image label and on a tick's sentence; a new
file delivered by the Shortcut while the app is open, keeping the pane and the scroll; the header
under the status bar and the caption band over the home indicator in Snuggery's full screen; the
phone on its side; a fast vertical flick that starts on the Datelines.

---

## ART.md's section 6 before the build (moved by the builder when the section was rewritten as built)

## 6. Budget

*Measured* 2026-10-02: code as every shipped `.html`, `.css` and `.js` (`wc -c`); the ZIP built by
`build-zips.yml`'s command (`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*'
'scripts/*' 'dist/*' 'raw/*'`), then `wc -c`.

| | Before the pass | Cap |
| --- | --: | --: |
| App code | 21 787 (`index.html` 1 071, `style.css` 6 710, `app.js` 14 006) | 200 000, the house's |
| Fonts | 0 | 160 000 |
| ZIP | 27 445 | 72 140 by D5's formula (27 445 × 1.25 rounded down, plus 37 834 for the face) |
| Data | `data/snapshot.json` sha256 `4a26ced769fa9b20a438031ecbf008791c920af165b26151b533007749018409` | pinned by `check.mjs`, byte-identical |

**The ZIP is the binding cap, and the projection is over it.** Stored in a ZIP, the face and its
license take 37 510 B and the files the pass does not grow (`data/snapshot.json` 9 157, `NOTES.md`
5 747, `PROMPT.md` 4 012, `miniapp.json` 143) 19 059 B; with the entries' headers (about 1 500 B for
fifteen files), that leaves about 14 000 B under 72 140 for all the code and this file together.
Today's code alone stores 7 602 B. A simulated build (scratch copy, the same `zip` command) with
stand-ins of the house's size for the new code, 44 246 B raw (`js/units.js` 4 000 B of Global
Weather's, `js/datelines.js` 6 500 B of Finances' `balance.js`, Finances' `index.html` 5 740,
`style.css` 10 000, `app.js` 18 006), measured **84 157 B** with this file's sections 1 to 7 shipped
(21 630 B raw, 9 622 stored) and 88 067 B with the whole file. The code's own growth stores about
8 900 B more than today; this file is the next largest part. Owner call 1. Code is far inside its
cap (about 44 000 of 200 000); fonts 40 075 of 160 000.

**The lead's interim ruling (2026-10-02, plan 0011 D29).** The ZIP cap stands at D5's 72 140 B until the
build has measured; the builder applies the whole change list, cuts no feature, never minifies or strips
comments, moves sections 8 and 9 out as its last item, and reports the figure. D5's formula — the stock ZIP
× 1.25 plus the face — cannot fit an app whose stock ZIP (27 445 B) is smaller than the face it gains
(37 510 B stored), so when the ZIP lands over with nothing cut, the lead rules on the measured figure, as for
Finances (D27): a raise is the expected answer, not a trimmed document or a dropped house module. The code cap
is the house's 200 000 B. Owner call 3 (a date alone for a headline whose feed gave only a date) stands as the
pass proposes; owner call 2 (the pipeline's license lines) is a data follow-up after the pass; owner call 5
(the README's "Today's headlines") is the lead's edit at the commit.

---

## As built (the builder, 2026-10-02)

Every item of the change list above was applied; nothing was cut, minified or stripped of comments.
`data/snapshot.json` is byte-identical (sha256 `4a26ced769fa9b20a438031ecbf008791c920af165b26151b533007749018409`,
pinned by `tools/check.mjs`); `scripts/world_news.py` and the refresh workflow were not touched. Nothing
outside `Template/world-news/` was written.

**Departures from the change list, each with its reason:**

1. **The caption line's words.** `Ticks: each headline's age when this file was made, 1 Oct, 07:01, on a
   logarithmic scale. Tap one to find it.`; on a region's pane `…, 07:01; Europe in ink. Tap one to find
   it.` (section 1's own region form, without the scale's name); where a hollow tick is drawn, `Hollow:
   from an earlier run.` Section 1's longer words (`every headline at its age`, `Hollow: kept from an
   earlier run.`) ran to a third line at 320 px on a region's pane, and at 312 px (the house's 125 %
   text check) on All with a hollow tick, measured in headless Chromium; the line's height is fixed at
   two lines (HOUSE 4.5). `Europe in ink` replaces `Europe's in ink`, which printed `Americas's`.
2. **Statements on All too.** A region whose feeds failed, or that is empty, gets its sentence under its
   heading on `All` as well as on its own pane: an empty region's heading would otherwise stand over
   nothing. A possessive of a name ending in s is `Americas'`.
3. **The source line's example** with a time is `Global Voices, 28 Sep, 08:00`: section 3's `The
   Conversation, 30 Sep, 22:07` is that story's UTC time, and the app prints the phone's zone (in Oslo,
   `1 Oct, 00:07`). A date-only stamp prints the feed's UTC date, so a noon stamp never moves a day.
4. **The live region** spells the month (`23 September`) through `units.spoken()`, as Finances does, and a
   shared tick's sentence opens with its count (`3 headlines at this age.`: the 23 Sep tick holds three).
5. **VoiceOver's label** opens `Datelines.` so the image is named before its sentences; an empty region
   reads `Oceania: no headlines.`; a region with kept headlines ends `; all kept from an earlier run`
   (or the count).
6. **A return re-reads even after a failed first read**: the `visibilitychange` listener is set when the
   module loads, not after the first good file, so a mended file is drawn without a relaunch.
7. **About's This data** lists each failed feed as its own line, the id as the term and the pipeline's
   note as the value (`gv-western-europe: HTTP 503; kept 3 cached`), after `Feeds:`.
8. **Tab words are centered in their 44 px hit**, so `All`'s tracer sits under the word.
9. **A new width redraws the Datelines alone** (a `ResizeObserver` on the pane), so a phone turned on
   its side gets a plot of its new width without rebuilding the list.
10. **The label column is measured on a canvas** after `document.fonts.load('620 12.5px "Ysabeau
    Office"')`, its font string naming the face first with the fallback stack after it.
11. **`NOTES.md`** gains a `Type` section (the credit line word for word) and two bullets under *What the
    app draws* (the date-only rule; the Datelines). `license` in its prose; The Conversation's own words
    (`Attribution/No derivatives licence`) are quoted as written, allow-listed by file and phrase.
    The footer it named is now About and the credit line.
12. **`PROMPT.md`** also says that a failed feed's headlines are marked stale and drawn hollow (the stock
    said `cached` with a marker), and its *Do not touch* list names `js/` and `fonts/`.
13. **`check.mjs`'s spelling check** reads the snapshot for the pipeline's own words (sources, region
    names, feed rows); the headlines, summaries and bylines are the publishers' and are listed as
    information (today: `organise`, `Centre`), never failed. `licence` is allowed in `app.js` (the data
    key and the contract comment), `ART.md` and the data (owner call 2).

**The camera.** Its strings stand: `Europe` and `Americas` are `<button role="tab">` named by their
visible words alone, as before the pass, built by `buildTabs()` from the data's regions after the
snapshot parses and validates; a region kept from an earlier run keeps its tab's name (B5) and says its
state as a description. The app stores nothing, so the camera has nothing to put back. **The camera
needs no change.**

**Budgets, measured** (`node tools/check.mjs`, the last run): app code 42 811 B (21 787 before; cap
200 000): `index.html` 4 359, `style.css` 9 808, `app.js` 18 752, `js/units.js` 4 171,
`js/datelines.js` 5 721; fonts 40 075 B (cap 160 000); **the ZIP is 84 990 B against D5's 72 140**
(12 850 B, 17.8 % over) with nothing cut. Stored in the ZIP: the face and its license 37 510 B, the data
9 157, the app code 16 533 (7 602 before), `ART.md` 9 886 (after sections 8 and 9 moved here),
`NOTES.md` and `PROMPT.md` 10 255. The art pass's simulation foresaw about 84 000 B. `check.mjs` keeps
`ZIP_CAP = 72140` until the lead rules (owner call 1, as Finances' D27), so its ZIP line prints FAIL until
then; every other line passes.

**What the tools printed** (each run from `Template/world-news/` unless it says otherwise):

- `node tools/test_datelines.mjs`: `all 26 checks pass` (ages, positions at 390 and 320 px, 39 and 37
  ticks, shared parts, hollow ticks, open ends, the tap, the date-only count 20, the cross-filed 3, the
  date and span forms).
- `node tools/check.mjs`: every line `ok` but `FAIL ZIP size 84,990 bytes (cap 72,140 …)`; it ends
  `1 check(s) failed`.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: `all checks pass`, 185 `ok` lines in both themes; load to
  the first pane about 330 ms in headless Chromium on this Mac (a trend, never phone evidence).
- `python3 world-news/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.

**Phone checks** (not claimed by any headless run; an iPhone on iOS 18 and one on iOS 26): a tap on a
story raising Snuggery's *This app wants to open a web page* and *Open in Safari* reaching the
publisher, then back; VoiceOver on the tabs (a kept region's tab read as its name, then its
description), on the Datelines' image label and on a tick's sentence; a tap on a tick with a finger (22 px
reach on 18 px rows); a new file delivered by the Shortcut while the app is open, keeping the pane and
the scroll; the header under the status bar and the caption band over the home indicator in Snuggery's
full screen; the phone on its side; a fast vertical flick that starts on the Datelines.

**Owner calls left open** (section 9 above, as they stand after the build): 1, the ZIP cap, now
measured at 84 990 B; 2, the data's own words (the pipeline's `licence` lines and spaced em dashes,
shown word for word); 3, date-only headlines shown by their date (as built); 4, the logarithmic scale
(as built); 5, the README's entry, the lead's file.

## After QA (2026-10-02)

QA passed the app with one nit and no must or should: `ART.md` section 6 printed the ZIP as built at
84 990 B and its own stored size at 9 886 B, while `node tools/check.mjs` measured 85 037 and 9 933 (the file
grew when the D30 ruling was written into it). Applied in `ART.md` section 6, nothing else touched:

- The table's *As built* ZIP cell now reads 85 037, the current measure. The cap cell still names 84 990,
  because that is the figure the lead's ruling was made on.
- The paragraph under it gives this file's stored size as 9 933. Its "`NOTES.md` with `PROMPT.md`" became
  "`NOTES.md` and `PROMPT.md`": with the old wording the two figures had no fixed point (writing 85 041 and
  9 937 stored 9 936 and the ZIP measured 85 040, and back again), and the new wording measures exactly what
  it prints.

No code, style, data, font or markup changed; the app code stays 42 811 B and `data/snapshot.json` stays
`4a26ced7…`. The ZIP is 85 037 B against the 88 000 cap, 2 963 B to spare. Owner call 1 above (the ZIP cap)
is closed by D30.

## After review (2026-10-02)

The reviewer found no must, five shoulds and nine nits. All five shoulds are applied, and so are seven
of the nits, one of them in part (the label column's 40 % cap is declined below). The other two are
handed to the lead below, each with its reason.
`data/snapshot.json`, the pipeline and the fonts are unchanged. Nothing outside `Template/world-news/`
was written.

**Shoulds, applied:**

1. **The selection mark stays in its own row.** The 4 px disc above the tick, which touched the tick
   in the row above (UN News's same-day noon stamps line up across rows), is replaced by the track's
   tracer head: a 6 px `--ink` disc in a 1.5 px `--page` ring, centered on the tick (`cy = y + 9`,
   `r = 3.75`, stroke 1.5). With its ring it spans y+4.5 to y+13.5, inside the tick's y+3 to y+15.
   Shot at 390 px, DPR 4, in both themes, on Middle East's 30 Sep tick, which has Africa's and Asia's
   ticks at the same x above and below. The head is clear of both (`tools/.work/after-review/disc-*.png`,
   `dl-*.png`). `test_datelines.mjs` and `shoot.mjs` check that the head stays inside its own tick.
2. **Date-only stamps are spoken as a span.** New `units.spokenDated(gen, iso)`: the feed named a UTC
   day, so the age is between `gen − (D + 24 h)` and `gen − D`. It is said in whole days, the way
   `spokenAge` counts them (`7 or 8 days`), or `at most 1 day 5 hours` when the day ends within 48 h
   of the file. `spokenItem` picks between this and `spokenAge`. The tap sentence uses it, and so do
   a row's newest and oldest in the image's label, because the model's items now carry `iso`. Today:
   `UN News, 7 or 8 days before the file was made.` and `Europe: 8 headlines, the newest 1 or 2 days
   and the oldest 15 days 20 hours …`. The test checks every 7th minute of three named days, and the
   real age is inside the span said each time. 3 of the 6 rows have a date-only newest or oldest, and
   none of them is read to the hour. About adds that such an age `is read aloud as a span (7 or 8
   days)`, and NOTES says the same. The date-only tick is still drawn where the feed puts it. A
   different tick for date-only stamps is left open (owner call A).
3. **The byline and summary are reachable by VoiceOver.** A story is a `div.story` row. Its first child is
   the headline, as an `<a class="hl">` holding only the headline, described by the source line
   (`aria-describedby`, B12). The link's `::after { position: absolute; inset: 0 }` covers the row,
   so a tap anywhere opens the story. The pressed tint is `.story:has(a:active)`, the focus ring is
   drawn on the `::after`, `aria-current` is on the link, and the gutter rule is
   `.story:has(> [aria-current])::before`. In Chromium's ariaSnapshot the link `"When the right to
   protest…"` is followed by `text: Global Voices, 29 Sep, also under Middle East By Elmira Lyapina
   Since the 1950s…`. check.mjs's B12 pattern now checks for this structure. A known cost: VoiceOver
   may read the source line twice, once as the link's hint and once as the text after it. That is a
   phone check.
4. **An assistive activation of the image does nothing.** The template is now `div.dlw` > `svg.dl
   role="img"` and a sibling `div.dlhit aria-hidden="true"` over it. Only the layer has the click
   listener, and it also carries the `touch-action: pan-y` and callout rules. WebKit's `press()`
   dispatches its click on the element itself, so `shoot.mjs` stands in for it by dispatching a click
   on the `<svg>` at its center, on Europe and on Asia. The pane stays, nothing is picked and nothing
   is said, and the tree holds one `img "Datelines. …"`. A finger tap still lands on the layer, and
   the tick tests and the swipe test pass unchanged. A centre click through Playwright's locator, as
   the reviewer ran it, still hits the layer, because it hit-tests the way a finger does. That is
   expected and is not the assistive path.
5. **A crowded tick says its count, and clusters never chain.** A tick takes an older headline only
   while it is under 3 px from the tick's own (newest) x. Past four headlines, four parts are drawn
   with the count beside them (`int(n)`, 10.5 px `--ink-2` on a 3 px `--page` halo, at x + 3).
   `test_datelines.mjs` adds three cases. The first is a tick of 6 drawn through a fake SVG: 4 parts
   and `6`. The second is five ages 2 px apart: 3 ticks, the farthest headline 2.00 px from its tick.
   The third is four at one age. `shoot.mjs` draws a crafted six-headline tick at 320 px and finds
   `6`. About now says `cut into a part for each headline, up to four; one that holds more has its
   count beside it`. **The cap changes today's figures at 320 px:** 39 ticks and 17 shared, which was
   37 and 19 with the chain. 390 px is unchanged at 39 and 17. ART section 1 is corrected.

**Nits, applied:** `overflow-wrap: anywhere` and `max-width: 62ch` on `.hl, .src, .by, .sum`. A
66-letter word at 320 px no longer scrolls sideways (the crafted shoot), and headlines on a tablet stop
at the summary's measure. The caption line is 15 px from 640 px wide, checked at 640 × 900 and
820 × 1180 with one line on every pane. About's term is now `In two regions or more`. The tab row scrolls by
`scrollLeft`, and only when the tab is clipped. In a scratch drive, Chromium's first Tab after the load
went to `stamp` as built, and to `A` once the old `scrollIntoView` was replayed, so `shoot.mjs` now
checks for the stamp. The keyboard tab sentence (`Europe.`) is dropped, because the focused tab
announces itself (HOUSE 4.9), so `choose()` loses its `byKeyboard` argument. Scale labels: both ends
always print, and a middle label within 4 px of a kept one is removed (measured by `getBBox`). With
`Latin America and the Caribbean` at 320 px, `7 d` is dropped and none of the rest touch
(`crafted-320-light.png`). `miniapp.json`: `The latest headlines by region from newsrooms whose terms
allow a credited headline and link, each linking out to its publisher` (128 characters).

**Nits declined or handed on:**

- *The 760 px centered pane against a left-aligned header* (wide screens, landscape). The reviewer
  calls this a family pattern shared with Finances and Running Dashboard, so it is the lead's call
  across the pane apps. It is not changed here, so this app does not drift from its siblings.
- *`:active` on iOS without a touch listener.* This becomes a phone check: hold a story row. If no
  tint shows, the fix is the passive empty `touchstart` listener in every pane app, and that is the
  lead's call for the family.
- *Long region names:* the label column is not capped at 40 %. A cap would mean wrapping SVG text, and
  the label skip alone keeps the scale readable.

**The camera.** `Europe` and `Americas` are still `<button role="tab">` named by their words. The image's
layer is an `aria-hidden` div, not a button, and stories are links. **The camera needs no change.**

**Measured** (`node tools/check.mjs`): app code 45 942 B, up from 42 811 (`index.html` 4 535,
`style.css` 10 585, `app.js` 19 301, `js/units.js` 4 997, `js/datelines.js` 6 524). Fonts 40 075 B. **ZIP
86 725 B against the 88 000 cap**, 1 275 B to spare. Stored: app code 17 679, `ART.md` 10 436,
`NOTES.md` and `PROMPT.md` 10 290. ART section 6 gives this file's size rounded (`about 10 400`),
because no written pair of figures came out exactly. A grid of 63 pairs was written and measured
(86 720 to 86 728 against 10 432 to 10 438), and each one moved the stored size by a byte or two. The
ZIP cell is exact.

**What the tools printed** (from `Template/world-news/`, the last runs): `node tools/check.mjs`
gave `all checks pass`. `node tools/test_datelines.mjs` gave `all 33 checks pass` (26 before; the 7 new
ones are the date-only spans, the label rule, the crowded tick, the chain and the head). `python3
world-news/tools/art/palette.py` (from `Template/`) gave `ALL CHECKS PASS`. `PLAYWRIGHT_MODULE=… node
tools/shoot.mjs` exited 0 with `all checks pass` and 198 `ok` lines in both themes. It was then run
again with `SCREENSHOTS=1`, with the same result: `screenshots/*-{light,dark}.png` and `about-light.png`
(About's new term) were refreshed, and `screenshots/app.png` was left untouched. `shasum -a 256`:
the face `fdf1a28c…cdb262`, OFL `d1adfffd…be6269`, the data `4a26ced7…749018409`, all unchanged. The
frame times are headless Chromium on this Mac, never phone evidence.

**Phone checks added** (an iPhone on iOS 18 and one on iOS 26): VoiceOver swipes from a story's
headline to its source line, byline and summary, and whether the source line is read twice. A VoiceOver
double-tap on the Datelines does nothing. A held story row shows its pressed tint. A finger tap on a
tick shows the ringed head on it.

**Owner calls left open:** A, a date-only tick drawn differently, for example 8 px tall (About already
names its placement as a display choice). B, the reviewer's idea of keeping the signature in view while
the list scrolls (the chosen row pinned under the tabs), which was not built. C, the lead's: the pane
apps' wide-screen alignment and the `:active` touch listener, family-wide. D, the lead's: the
README's entry still says `freely licensed newsrooms' RSS feeds`, while `miniapp.json` now uses the
reviewer's words.

## After the final review (2026-10-02)

The final reviewer's verdict on the pass (`wf_e685b4ed-f13`) was **fix**: no must, one should, five
nits. All six are applied; nothing is declined. The lead's rulings held: the ZIP cap is 88 000 B (plan
0011 D30), the code cap the house's 200 000 B, nothing is minified and no comment is stripped (the new
ones are short), and `data/snapshot.json` is byte-identical (`4a26ced7…749018409`). Nothing outside
`Template/world-news/` was written. My scratch is in `tools/.work/followup/` (gitignored): `orig/`
(every file as it stood before), `drive.mjs` (the press path and the halo case in headless Chromium),
`geom.mjs`, `oceania.mjs`, `fixpoint.py`, the `regress-*.log` files, `shoot-final.log`,
`check-docs.log`, `test-final.log`, `palette.log`, and the crops `halo-{before,after}-{light,dark}.png`.

**The should: VoiceOver's activation of the Datelines.** Applied as the final reviewer gave it.
`render()` registers the click listener on `div.dlw`, the wrapper of the `<svg role="img">` and the
`aria-hidden` layer over it, and `onTick` returns at once unless `ev.target` is the layer; the tap's
place is read from the layer's box, which is the wrapper's. I read WebKit main (fetched 2026-10-02)
for each step rather than rely on the summary:

- `AccessibilityNodeObject::actionElement()` ends in `clickableSelfOrAncestor()` (`AXCoreObject.h`),
  which walks `parentObject()` up from the image to the first object with a click, mousedown or
  mouseup listener, stopping at `<body>`. On Apple platforms `parentObject()` is the DOM parent's
  object (`AccessibilityRenderObject::parentObject()`), so the walk meets `div.dlw`.
- `AccessibilityObject::press()` (`AccessibilityObject.cpp` 1607 on) keeps the image as the element it
  presses: the action element is not inside the image, and neither is the layer its hit test finds at
  the image's centre. With no touch listener anywhere (`hasTouchEventListener()`,
  `AccessibilityObjectIOS.mm` 127 on), `SVGElement::accessKeyAction(true)` dispatches mousedown,
  mouseup and click on the image at its centre (`SimulatedClick.cpp`) and returns true, so
  `_accessibilityActivate` returns YES and iOS takes no fallback.
- Before the change the walk found nothing: a CDP scan of the built page found no listener at all on
  the svg, the wrapper, `#pane`, `#main`, `body` or `html`. So `press()` returned false, and iOS would
  tap `accessibilityActivationPoint`, the image's centre (`clickPoint()`), which is on the layer. In
  headless Chromium a touch there on Europe's pane chose Middle East and picked `{"ri":3,"ii":5}`. At
  320, 360, 375 and 390 px the centre falls in Middle East's row with a tick 12.8 to 15.1 px away,
  inside the 22 px reach (`geom.mjs`).
- The move changes nothing else iOS shows. The image keeps the image trait: iOS takes traits from the
  role and from the ancestors' roles, never from listeners (`WebAccessibilityObjectWrapperIOS.mm`,
  `accessibilityTraits`). The wrapper, not the layer, is now the tap's responder; the two share one
  box, and WebKit paints no tap highlight over a box wider than 30 % of the view
  (`WKContentViewInteraction.mm`, `_showTapHighlight`).

WebKit main is not the build iOS 18 or iOS 26 ships, so "a VoiceOver double-tap on the Datelines does
nothing" stays a phone check, the first below. `app.js` costs 71 B (19 372).

`shoot.mjs` now models that path in place of the fix stage's stand-in, on Europe's and Asia's panes in
both themes. It finds the action element as WebKit does, by scanning the image and its ancestors below
`<body>` for click, mousedown and mouseup listeners over CDP (`DOMDebugger.getEventListeners`). With
none it taps the image's centre, as iOS would. With one it takes the hit test at the centre, keeps the
press on the image unless that element is inside it, and dispatches mousedown, mouseup and a
`PointerEvent` click there. The press must pick nothing, say nothing and keep the pane. A second check
follows a finger: a click on the svg at Middle East's tick nearest the centre (x 191.8) picks nothing,
and a click on the layer there picks that tick's newest story and chooses Middle East. ART.md section
1 now states the mechanism, not the outcome: `A finger lands on a hidden layer (aria-hidden) over the
image. The click listener is on their wrapper and acts only on the layer: VoiceOver's activation in
WebKit finds that listener and clicks the image itself, which it passes over.`

**The halo nit (latent): a count's halo could erase a newer tick.** Applied the first way offered:
`draw()` prints a row's counts before its ticks, so every tick is painted over any halo. That keeps
every tick whole in any arrangement, which setting the count where no tick falls cannot do when ticks
stand on both sides. The cost falls on the count: in the final reviewer's case the newer tick now
crosses the `6`'s left stroke (`halo-after-*.png`). `test_datelines.mjs` adds that case with the
reviewer's seven Middle East items at 390 px (one 91 h old, six about 100 h old): the tick of six at
x 175.3, the newer tick at 178.9, the `6` starting at x 178 on the newer tick (x 178 to 180), and the
count drawn before every tick of its row. Rendered in headless Chromium at 390 × 844 (`drive.mjs`),
the newer tick's 44 inner samples against the page were at lowest 1.00:1, median 4.96:1 (light) and
7.31:1 (dark) before; after, every one is 14.80:1 (light) and 14.43:1 (dark), ink on page. ART.md
section 1 says so. `js/datelines.js` costs 106 B (6 630).

**The other nits, the documents** (all ship but this file):

- ART.md section 1: `five ticks` became `five headlines (four ticks)`. At 390 px and at 320, 4 ticks
  hold Oceania's 5 headlines of the last 15 hours (the 02:45 and 02:49 UTC stories share one), then
  single ticks at 16, 35 and 50 days (`oceania.mjs`).
- ART.md section 6: the cap cell's `about 3 000 B for the fix stages` became `The ZIP is within 5 % of
  it: 1 052 B left (HOUSE 8), so whatever the app gains, it pays for`, and its em dash a semicolon.
  The As built cells and the stored figures under the table are today's. ART.md ships inside the ZIP
  it measures, so `fixpoint.py` wrote each candidate figure in, built the ZIP with `build-zips.yml`'s
  command and kept one that measures itself: 86 948 (86 949 does too). `check.mjs` then measured
  86 948 B.
- NOTES.md: `good, credited, freely licensed journalism` became `good journalism from newsrooms whose
  terms allow a credited headline and link`, `miniapp.json`'s claim. Its first paragraph said each
  headline shows `the time`; it now says `the date (and the time when the feed gives one)`, the
  PROMPT.md correction carried into NOTES.md, beyond the list.
- PROMPT.md: `the date and time` became `the date and, when the feed gives one, the time (in the file
  of 1 Oct 2026, 20 of the 48 have a date alone)`. The date pins a figure that a daily file changes.
- This file's *After review*: the review raised nine nits, not thirteen: seven applied, one of them in
  part (the label column's 40 % cap declined), and two handed to the lead. Corrected in place, where
  the sentence also named the review's author the final reviewer.

**Measured after each item** (`node tools/check.mjs`):

| | App code | ZIP | Left of 88 000 |
| --- | --: | --: | --: |
| Before | 45 942 | 86 725 | 1 275 |
| After the should | 46 013 | 86 748 | 1 252 |
| After the halo nit | 46 119 | 86 783 | 1 217 |
| After the documents | 46 119 | **86 948** | **1 052** |

Stored in the ZIP at the end: app code 17 737 (+58), ART.md 10 545 (+109), NOTES.md and PROMPT.md
10 346 (+56); the data 9 157 and the fonts 37 510 unchanged. The ZIP is at 98.8 % of its cap. Code by
file: `index.html` 4 535, `style.css` 10 585, `app.js` 19 372, `js/units.js` 4 997, `js/datelines.js`
6 630. Fonts 40 075 B.

**The regression proofs** (the fix stages' way: the change switched off in the working file, the check
run, the file put back from its final copy, `cmp` clean):

1. The should switched off whole (`app.js` as before this follow-up; `regress-press-off.log`):
   `SCHEMES=light node tools/shoot.mjs` exited 1 with 127 `ok` and 2 `FAIL`, exactly the press checks:
   `FAIL Europe: VoiceOver's press on the image: no action element, so press() fails and iOS taps its
   centre, on .dlhit: it picked {"ri":3,"ii":5} on middle-east; …`, and the same on Asia.
2. The listener on the wrapper without the target check (`regress-target-off.log`): exit 1, 125 `ok`
   and 4 `FAIL`, the two press checks (`its action element .dlw; … so the click lands on .dl: it picked
   {"ri":3,"ii":5} on middle-east`) and the two finger checks (`a click on the svg at Middle East's tick
   at x 191.8 picks {"ri":3,"ii":5}; …`).
3. The halo change switched off (`js/datelines.js` as before; `regress-halo-off.log`): `node
   tools/test_datelines.mjs` exited 1 with `1 of 34 failed`, exactly the new case: `FAIL a tick of six
   at x 175.3 and a newer one at 178.9: the "6" starts at x 178, on the newer tick (x 178 to 180), and
   is the row's child 6, the newer tick child 1: …`.

Restored, `cmp` is clean against `app.final.js` (sha256 `201742e4…1e5cfa`) and `datelines.final.js`
(`b03fbe42…1301e4`).

**The tools' last runs** (2026-10-02, from `Template/world-news/` unless stated; headless Chromium 153
on this Mac, never phone evidence):

- `node tools/check.mjs`: `all checks pass`; app code 46 119 B, fonts 40 075 B, ZIP 86 948 B of
  88 000, the data's sha256 the pin.
- `node tools/test_datelines.mjs`: `all 34 checks pass` (33 before; the new one is the halo case).
- `python3 world-news/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: exit 0, 202 `ok` and no `FAIL` (198 before:
  each pane's one press check is now two), `all checks pass`, both themes; load to the first pane 332
  and 330 ms (headless, a trend only). `screenshots/*-{light,dark}.png` and `about-light.png` were
  rewritten byte-identical to before (`cmp`): neither change alters what today's file draws.
  `screenshots/app.png` untouched (`42171bc6def9…`).
- `shasum -a 256`: the face `fdf1a28c…cdb262`, OFL `d1adfffd…be6269`, the data `4a26ced7…749018409`,
  all unchanged.

**Owner calls as they now stand:**

- **A**: a date-only tick (20 of 48 today) is drawn like the rest and spoken as a span; a different
  mark, for example 8 px tall, is not built.
- **B**: the Datelines scroll out of view with the list, so a tap on a tick scrolls the signature
  away; keeping the chosen row pinned under the tabs is not built.
- **C**, the lead's, family-wide: the 760 px pane centred while the header and caption band stay left
  (World News, Finances, Running Dashboard), and the pressed tints on `:active` with no `touchstart`
  listener.
- **D**, the lead's: the README's entry still says `freely licensed newsrooms' RSS feeds`;
  `miniapp.json`, and now NOTES.md, say `newsrooms whose terms allow a credited headline and link`.
- Standing as built (D29): headlines and license lines in the data's own words; a date-only headline
  shows its date alone; the logarithmic scale from 1 h to 60 d.
- New, from this follow-up: **a count drawn under the ticks** keeps every tick whole, but a tick that
  stands where the count prints crosses its glyph. Setting the count left of its tick when a newer
  tick stands where it would print would keep it clear in most cases, at an estimated 150 B of code
  more; not built.

**For the lead, outside this folder**: HOUSE §8's row for World News becomes ZIP 86 948 of 88 000
(D30), code 46 119, fonts 40 075. The camera needs no change: the tabs are untouched, the wrapper that
now holds the listener has no role, and the image keeps its image trait.

**Phone checks** (none claimed; an iPhone on iOS 18 and one on iOS 26), the final reviewer's nine:

1. A VoiceOver double-tap on the Datelines on Europe's and Asia's panes does nothing: no pane change,
   no sentence, nothing marked. As built, WebKit's press should find the wrapper's listener and click
   the image, which the listener passes over.
2. VoiceOver swipes from a story's headline to its source line, byline and summary, and whether the
   source line is read twice (the link's hint, then the text).
3. VoiceOver touch-exploring a summary probably announces the link, because the stretched `::after`
   covers the row.
4. A held story row shows its pressed tint.
5. A finger tap on the 18 px rows lands the ringed head on the right tick (the tap now reaches the
   wrapper's listener through the layer).
6. Snuggery's *This app wants to open a web page*, then Safari on the publisher's page, then back.
7. A Shortcut delivers a new file while the app is open, keeping the pane and the scroll.
8. In Snuggery's full screen, the header sits under the status bar and the caption band over the home
   indicator.
9. The phone on its side on a notched model (the safe-area gutters).

## The data follow-up (2026-10-02)

Owner call 2, as the owner ruled it: the license lines `scripts/world_news.py` writes into the data are the
repository's own sentences, so they are now in US English with plain punctuation. The publishers' names, their
terms' quoted wording, every URL and the key `licence` are unchanged. My scratch is in
`tools/.work/data-followup/` (gitignored): `orig/` (every file as it stood before), `apply_sources.py`,
`fixpoint.py`, `about-read.mjs`, the diffs and every log named below.

**The script.** Three lines changed, all inside `SOURCES` (`script.diff`): 174, 175 and 188. A full stop takes
the place of each spaced em dash. A colon would have put two colons into one sentence in Global Voices' line,
and the same stop in both Creative Commons lines keeps them parallel. The word after the stop is capitalized,
and `licence` in Global Voices' line becomes `license`. The UN News line and all three attribution lines were
already US English with no dash and are unchanged.

| Source | Before | After |
| --- | --- | --- |
| Global Voices | `Creative Commons Attribution 3.0 — credit the author, link to the licence, and indicate changes: the summaries here are the feed's own line, shortened.` | `Creative Commons Attribution 3.0. Credit the author, link to the license, and indicate changes: the summaries here are the feed's own line, shortened.` |
| The Conversation | `Creative Commons Attribution–NoDerivatives 4.0 — credit the author and their institution and link back. Nothing of theirs is changed here: the headline stands as written and no article text is carried.` | `Creative Commons Attribution–NoDerivatives 4.0. Credit the author and their institution and link back. Nothing of theirs is changed here: the headline stands as written and no article text is carried.` |

The module still imports (`python3 -B`, so nothing was written to `__pycache__/`): 17 feeds, 6 regions, 3
sources, and check.mjs's British pattern finds nothing in the table. `python3 -B scripts/world_news.py
--selftest` prints `4 self-tests passed`. The offline path `--demo --out` (it fetches nothing and reads `data/` only)
wrote `48 headlines, 48 ask rows, 0/17 feeds live` to scratch, and its `sources[]` carry the new lines: the
public copy's refresh writes them on its next run that reaches a feed, and a push of the script starts one.

**The fixture, not rebuilt.** `apply_sources.py` loads both versions of the module, the swept one and the
pre-sweep copy in `orig/`, with `importlib`, so no string is retyped. It refuses an input whose sha256 is not
the pin, and it proves that the fixture round-trips byte for byte through the script's own serialization
(`json.dumps`, `indent=1`, `ensure_ascii=False`, a final newline). It also proves that the fixture's three
`sources[]` entries equal the pre-sweep table key for key and in order. Then it sets each entry's fields from
the swept table and writes the file as the script writes it (`apply.log`):

- sha256 `4a26ced769fa9b20a438031ecbf008791c920af165b26151b533007749018409` (40 681 B) became
  `ecb808729f4562dfe98f324aaef3a54ffaeebef03982c62348ab6f8f910c5d2c` (40 675 B, −6).
- Structural diff over 696 leaves: **2 strings changed** (`$.sources[0].licence` and `$.sources[1].licence`,
  old → new as in the table above). Changed: 0 numbers, 0 booleans, 0 nulls, 0 types, 0 key sets or
  orders, 0 array lengths, 0 ids (`regions[].key`, `items[].feed`, `feeds[].id`), 0 dates (`generatedAt`,
  every `published`), 0 headlines (`items[].title`, `ask[].title`), and 0 anything outside `$.sources` or
  other than a `licence` field. Counts before and after: regions 6, items 48, sources 3, feeds 17, ask 48.
- Byte diff: 962 lines both, and only lines 517 and 523 differ. The first 27 831 B and the last 12 488 B are
  identical. Cross-checked in Node: the two files are equal once the `licence` fields are removed, and the new
  `sources[]` equal the `--demo` output's.

**`check.mjs`.** `DATA_SHA` is now `ecb80872…`, and its comment and message say the file is the one committed
before the pass, with its license lines swept. The British-spelling allowance for the data is narrowed to
the key: `ALLOW` no longer lists the data, and `PHRASES` passes over `"licence":` in the data and nothing else,
so a `licence` inside a line now fails. The proof, run before the new file went in (`regress-narrowed-on-old-data.log`):
the narrowed check against the old data exited 1 with exactly 2 `FAIL`s, the pin and `US spelling … data/snapshot.json:1 licence`.
That is the one `licence` in Global Voices' line; the three keys were passed over. `app.js` and `ART.md`
keep `licence`, where they name the key.

**`ART.md`** (it ships). The sha256 in the opening paragraph and in section 6's Data row is now
`ecb80872…f910c5d2c`, and the row says the file is the same apart from the two swept license lines. Section 6's
figures: the ZIP **86 993**, 1 007 B left, the data stored 9 156, this file about 10 600. Section 7's row 7
said the data's spaced em dashes were in its license lines; it now says `none in the app's own text or the
data's license lines; the publishers' words as written`. The two left are in summaries. `fixpoint.py` built
the ZIP with `build-zips.yml`'s command on a copy of the shipped files, after first proving that the copy
builds what `check.mjs` measured on the real folder (86 947). 86 993 is the only figure between 86 949 and
87 029 that measures itself. **`NOTES.md` is unchanged**: its two quoted fragments of the lines (`the summaries
here are the feed's own line, shortened` and the UN sentence) are in the new lines word for word.

**Measured** (`node tools/check.mjs`): before, ZIP 86 948 and data stored 9 157. With the data alone changed,
86 947 and 9 156. After `ART.md`, **86 993 of 88 000** and `ART.md` stored 10 591 (10 545 before). App code is
46 119 B (17 737 stored), unchanged, and so are fonts (37 510 stored) and `NOTES.md` with `PROMPT.md` (10 346).

**The tools' last runs** (2026-10-02, from `Template/world-news/` unless stated; headless Chromium 153 on this
Mac, never phone evidence):

- `node tools/check.mjs`: exit 0, 40 `ok` (40 before), `all checks pass`.
- `node tools/test_datelines.mjs`: `all 34 checks pass`.
- `python3 world-news/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs` (no `SCREENSHOTS`): exit 0, 202 `ok`, 0 `FAIL`, `all checks pass`,
  both themes. Its About check reads each source's lines from the file. All 10 `screenshots/*.png` are
  unchanged by sha256.
- `about-read.mjs`: About open, every source's attribution and license line on its own line, word for word
  from the file; 0 spaced em dashes and 0 `licence` in About; no fragment of the old lines. The page's 2
  spaced em dashes are both in `.sum`, publishers' summaries. No console error.

**Left alone, and why:**

- The en dash in `Attribution–NoDerivatives` is inside the license's name and is not a spaced em dash. The
  license's own title uses a hyphen, so matching it is the owner's call.
- The script's comments and its `--selftest` help (`the licence flag`, `check the parser's licence and safety
  rules`), and `SOURCES`' comment, which still calls About `its footer`. None of them reaches the data or the
  app, and the brief kept the script's diff to the table's strings.
- The two spaced em dashes in summaries (the publishers' words) and the key `licence`, which the app reads.
- `screenshots/about-light.png` still shows the first words of Global Voices' old line at its bottom edge
  (`Creative Commons Attribution 3.0 — credit the author, link to`): this run did not rewrite screenshots, and
  a `SCREENSHOTS=1` run does.
- This file's earlier sections, which record what was true when they were written.

**For the lead, outside this folder:** HOUSE §8's World News row (86 948), `docs/CURRENT_STATE.md` and plan
0011 D31 quote the old ZIP figure; it is now 86 993 of 88 000. The starter pack's `world-news.zip` carries
the data and `ART.md`. Owner call 2 is closed.
