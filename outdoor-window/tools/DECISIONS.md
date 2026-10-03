# Outdoor Window: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look as built; this file
holds the record: the lead's rulings, the owner calls as the pass left them, the as-built departures,
the after-QA, after-review and after-follow-up sections, the phone checks. Plan 0011 package B, D1 to D5
and HOUSE.md are the brief. The builder's last step moves `ART.md`'s sections 8 and 9 here, word for
word, below this section; nothing above the first `---` is to be overwritten.

## The lead's rulings before the build measured (2026-10-03, plan 0011 D33)

**The ZIP cap stands at D5's 75 257 B until the build has measured; nothing cut.** The stock ZIP is
29 939 B, smaller than the house face it gains (37 510 B stored), so the formula cannot fit the house
modules, About and the shipped ART.md; the art pass's estimate is about 85 000 B. The builder applies
the whole change list, cuts no feature, never minifies or strips comments, and reports. When the ZIP
lands over, the lead rules on the measured figure, as for Finances (D27) and World News (D30): a raise
is the expected answer. The code cap is the house's 200 000 B (the app is at 50 637 B).

**Owner calls 1 to 5 stand as the pass proposes:** the stock's 6 h stale threshold; the credit line
word for word on screen; the two Open-Meteo / CC BY anchors keeping their addresses because the terms
ask for a link (an allow-listed exception to HOUSE 7.1); gusts in km/h because the file's unit and the
rule key are km/h; past hours drawn at 40 % with a `now` notch. The pipeline's comments that name
`app.js` as the scorer's mirror (owner call 6) and the README sentence on the Shutters (7) are the
lead's at the commit.

## The lead's ruling on the measured ZIP (2026-10-03, plan 0011 D34)

**The ZIP cap is 99 000 B, nothing cut.** The build measured the ZIP at 95 790 B against D5's 75 257
(+27 %) with nothing cut, minified or stripped: all seventeen faults fixed, the Shutters, the house chrome,
About; code 82 781 B of 200 000; fonts 40 075; both data files byte-identical. Inside the ZIP the face and
its license store 37 510 B, more than the whole stock ZIP (29 939 B), so D5's formula could never fit this
app; the shipped `ART.md` stores about 14 000 B and a shorter one would hide the look as built for the
price of a few thousand bytes. The raise leaves about 3 000 B for the fix stages, as the Finances (D27)
and World News (D30) rulings did. `ZIP_CAP` is set in `tools/check.mjs`; `node tools/check.mjs` passes.
The builder's three new owner calls (the failing-hour line as "ruled out by gusts and daylight", the
readout at four lines below 360 px, the `now` label yielding to the first day's label for the file's
first ten hours) stand as built, for the owner to reverse if they prefer.

---

## ART.md's sections 8 and 9, as the art pass wrote them (moved word for word by the builder, item 15)

## 8. Change list (the pass record; moves to `tools/DECISIONS.md`)

**Bugs on record.** None for Outdoor Window: plan 0009 item 5 names Norne, World Oil & Gas, Milky Way
and Global Weather; `docs/review/` and the app's `NOTES.md` record none. **The stranger's run**
(`tools/.work/look.mjs`: headless Chromium, 390 × 844, both themes, the clock inside the file and at
2 Oct 2026; four locales; a broken replacement; 320 px and 844 × 390) found these. All are musts.

- **B1** Dates and times follow the phone's locale: the stamp is `toLocaleTimeString`, `Updated 05:35
  AM` on an American phone, `Updated 11:35` on a Norwegian one; the age `6h old` with no space.
- **B2** Stale is a color: the stamp turns amber (`--warn`) at 6 hours with no word, `No data` and
  `Undated file` too; notices carry an amber edge, the problem card a red edge and title (`--alarm`).
- **B3** The stamp is a `<p>`: it opens nothing, no keyboard reaches it, there is no About; the place
  line joins place, zone and activity with middle dots.
- **B4** `<main aria-live="polite">`: every tab change, every return and every bar tap re-reads the
  whole pane to VoiceOver.
- **B5** A broken replacement while open wipes the screen: after `<html>oops</html>` arrives, 0 bars,
  the place line emptied, the stamp `No data`; and every return re-renders the page even when the files
  have not changed.
- **B6** Hit targets: the 48 hour bars are buttons 7.1 × 56 px each; the tabs 32 px tall; the two
  credit links 12 px tall.
- **B7** The tabs are built before the forecast is read (`renderTabs()` at the script's start), so the
  camera's wait for `Hours` proves nothing, and a broken file leaves three tabs over an empty pane.
- **B8** Failing hours are near-invisible: their bars 1.37:1 (light) and 1.33 (dark) on the card;
  "near" bars 1.80; the muted 11 px words on a good hour's tint 4.16 (light).
- **B9** An hour scoring 60 or more is drawn darker (`near`), a threshold printed nowhere.
- **B10** Numbers off the data and off SI: gusts printed whole, so 35.5 km/h (ruled out) shows `36` and
  34.9 (passing) `35` under a 35 km/h limit; temperatures whole; no U+202F before a unit (`17°C`,
  `0%`, `≤ 30%`); `-10 to 17°C` with a hyphen-minus; the stat tile `gust 27` without its unit.
- **B11** `Best window in this sample` heads the first window (Mon, best 78) while Tuesday's scores 85.
- **B12** Rules shows a band with its `max` missing as `2 to undefined°C` while the scorer does not
  apply it; and shows `any hour` for `"daylight": "Golden"` while the scorer, which ignores case,
  applies the golden-hour rule.
- **B13** The tells of section 7: uppercase tracked eyebrows and table head, a letter-spaced h1, white
  cards, a pill, stat tiles, middle dots, spaced em dashes, a monospace `code` face, an accent green on
  the tab, links and readout, the system font stack, weights 640 and 660, a 22 px figure, a sticky
  header with `backdrop-filter` blur, a bar-height transition.
- **B14** `⋯ → App Files` in two help sentences (`⋯` is not in the face; `→` is a tell), and in
  `PROMPT.md`; `app.js`'s comment too.
- **B15** British spelling in shipped text: `licence` in prose (`NOTES.md` on 10 lines, `PROMPT.md` 4,
  `index.html` comment 2; Open-Meteo's address `open-meteo.com/en/licence` and the quoted CC BY clause
  keep their words, allow-listed by file and phrase), `colour` and `centres` (`style.css` comments),
  `recognise`, `normalise`, `labelled` and `allotment` (`PROMPT.md`).
- **B16** `<html lang="en">`; no `color-scheme` or `theme-color` metas; the page scrolls under a sticky
  header rather than a pane inside the frame.
- **B17** The readout and the table leave out rainfall, a scored rule: an hour ruled out by rainfall
  would name the rule and never show the value.

**Items**, in order:

1. `.gitignore`: `tools/.work/`, `tools/node_modules/`, `dist/` (written by the art pass).
2. `fonts/`: copy `ysabeau-office-gw.woff2` and `OFL.txt` from `global-weather/fonts/` byte for byte.
3. `js/units.js` (new, pure; copied in kind from `world-news/js/units.js`, only what this app writes):
   `NNBSP`; the true minus; a value at the data's precision with its unit (`29.2 km/h`, `0 %`, `0 mm`,
   `−3.5 °C`; a whole value whole); the stamp's three forms and its date, year and stale and ran-out
   sentences from the phone's clock; the place's clock and day (`07:00`, `Mon 21`, `Mon 21 Sep`,
   `Tue 22 Sep 2026` when the year is not this one) from `utc_offset_seconds`; coordinates
   (`42.37° N, 71.06° W`); spans (`11 d`, `6 h`, `12 hours`); spoken forms (`Monday 21 September,
   07:00`, `kilometers an hour`, `degrees Celsius`). B1, B10.
4. `js/score.js` (new, pure): the scorer moved out of `app.js` **with its arithmetic unchanged**
   (`clamp`, `isNumber`, `localToEpoch`, `maxRule`, `bandRule`, `sunTimes`, `scoreHours`,
   `findWindows`), its header comment's scoring paragraph with it; each row gains `checks` (per rule:
   key, label, ok, comfort, missing) so the Shutters read the scorer's own numbers; `score`, `pass`,
   `blocked` and `light` stay exactly as computed. The header comment says the Python mirror is
   `scripts/outdoor_window.py`. Section 1.
5. `js/shutters.js` (new, pure): the label column, pixels an hour, blocks, hollow blocks, bars,
   brackets, axis ticks and labels with the collision rule, `now`, the chosen column and head, the
   nearest hour to an x; and a `draw(svg, model, chosen)` that builds the SVG with `createElementNS` and
   `textContent`; the description sentence. Section 1.
6. `index.html`: `lang="en-US"`; `color-scheme` and both `theme-color` metas (`#e8eef0`, `#141d21`); the
   header (h1 `translate="no"`, the stamp button with its `hidden` hint, an empty tab row); `<main
   class="pane">` with the notice slot and the `role="tabpanel"` body, no `aria-live`; the caption band
   (caption line; the credits as the stock's static markup word for word, its two anchors kept); About
   as a `role="dialog"` sheet with its four sections and two `Close` keys; the live region. Comments
   in US English. B3, B4, B15, B16.
7. `style.css`: rewritten on the house (World News' `style.css` is the pattern): the tokens and the one
   `@font-face`; `--used` pasted from `palette.py --json`; the frame (header, the pane scrolling
   inside, the caption band at a fixed height); tabs and tracer; sections, `dl` rows, the hours table
   and its window rule; statements; the Shutters and the readout; the notice; About; Reduce Motion; a
   phone on its side; safe areas. The stock tokens (`--surface-*`, `--accent*`, `--bar-*`, `--warn`,
   `--alarm`, `--radius*`), the cards, pill, tiles, `code`, the sticky blurred header and the
   transition go. B2, B6, B8, B9, B13, B16.
8. `app.js`: the render on the new markup, the scorer imported from `js/score.js`: tabs after the parse
   with arrow keys (B7); the Windows, Hours and Rules panes as section 3 (B11, B12, B17); the Shutters
   with the slider's input, the scrub and the tap-not-swipe rule; the readout updated in place; the
   statements; the stamp (B1, B2, B3); the caption line per pane; About built with the DOM from the
   files; `readJson()` and `validate()` as plain sentences, `problem()` a notice that keeps the stamp
   and the view (B5, B14); a return that compares the files (same: the stamp only; new: re-render
   keeping pane, scroll and hour; broken: keep the view, a notice with `Close`); the live region;
   `window.__ow` as an inert test hook. No `innerHTML` but `= ''`.
9. `PROMPT.md`: arrows and `⋯` become words (`in Snuggery, Options, then App Files`; `Options, then
   Keep This Up To Date`); `licence` in prose becomes `license`, `recognise` `recognize`, `normalise`
   `normalize`, `labelled` `labeled`, `allotment` `community garden`; the `activity` key's row says it
   heads the Windows and Rules panes; *Step 4* and *Do not touch* name `js/score.js` beside `app.js`
   and the new guard (`tools/test_shutters.mjs` compares the app's scorer with the `ask` rows); "a red
   card" becomes "a notice". B14, B15.
10. `NOTES.md`: `licence` in prose becomes `license` (quotations and Open-Meteo's address keep their
    words); *What is in the app* says the app now ships one font (the house face, its credit line word
    for word) and that the strip is the Shutters, an SVG; the two anchors' sentence unchanged. B15.
11. `tools/art/palette.py` (written by the art pass; ends `ALL CHECKS PASS`).
12. `tools/check.mjs` (HOUSE 7.1, all seventeen, from `world-news/tools/check.mjs`): both data files'
    sha256 above; the camera's `Windows` and `Hours` as tabs built after the parse; no `localStorage`;
    the credits' words against `index.html`'s static markup; the two credit anchors as the one allowed
    exception to "no http(s) address" (by file and exact string, owner call 3); the scorer's arithmetic
    lines in `js/score.js` pinned to the stock's text; `--used` against `palette.py --json`; the
    spelling allow-list (Open-Meteo's `licence` address and the quoted clause in `NOTES.md` only); the
    ZIP cap at 75 257 until the lead rules.
13. `tools/test_shutters.mjs` (HOUSE 7.3): `js/score.js` on the shipped files against the snapshot's
    `ask` table, row by row (pass, score, blockedBy, daylight: the art pass measured 0 mismatches of 48
    with the stock's `scoreHours`) and against a scorer written in the test; the windows (Mon 07:00 to
    19:00, 12 hours, best 78; Tue 08:00 to 19:00, 11 hours, best 85); the Shutters' geometry at 320 and
    390 px and on a phone on its side, every block, bar height and bracket recomputed with formulas
    written in the test; rules files with keys left out, a band missing an end, `"Golden"`, a missing
    value (a hollow block). This is the guard `PROMPT.md` asked for (a mode that loads the app's scorer
    in node and compares the two row sets), written without touching the pipeline.
14. `tools/shoot.mjs` (HOUSE 7.2 as a pane app allows: no player, focus mode or units key), the clock
    fixed at Mon 21 Sep 2026, 16:00 UTC (noon in Boston) and once at 2 Oct 2026 (ran out), `TZ`
    Europe/Oslo: boot (the camera's tabs by role and name, absent until the parse; the credits; the face;
    the stamp's words); text contrast; the tracer; SI and the date forms; hit targets at 44 px (the
    slider, the tabs, the stamp, the credit anchors); the Shutters on rendered pixels in both themes
    (blocks at the target, bars against blocks); a tap, a sideways drag and a vertical swipe on them; the
    keyboard on the slider; the readout against the test's own decode; four locales giving the same
    words (B1); About; hidden and back (the same files, a new file, a broken replacement keeping the
    view, B5); stale at 7 hours; ran out; a rules file with a band missing an end and a `"Golden"`
    light (B12); broken data at the start; Reduce Motion; 320, 360, 375, 844 × 390 and 125 % text;
    pictures to `tools/.work/shots/`, `screenshots/*-{light,dark}.png` with `SCREENSHOTS=1`, never
    `screenshots/app.png`, whose hash is checked unchanged.
15. `tools/DECISIONS.md` (new): this section and section 9 moved word for word, the as-built
    departures, the measured budget, the phone checks; then this file's sections 8 and 9 replaced by a
    short "Where the record is" section, as World News' `ART.md` ends.

**Phone checks** for the device matrix (an iPhone on iOS 18, in Snuggery's full screen): the Shutters'
slider with VoiceOver (swipe up and down moves an hour; the description read once); a sideways drag on
the Shutters against a vertical scroll of the pane; a tap on each credit anchor (Snuggery names the
address and offers Safari); a new forecast delivered by the Shortcut while the app is open (it redraws
in place, keeping the pane and the hour); the phone on its side; safe areas.

---

## 9. Owner calls left open

1. **The stale threshold** stays the stock's 6 hours. `PROMPT.md` advises refreshing once or twice a
   day, so a morning refresh reads `Stale.` from early afternoon; 12 or 24 hours would match the advice.
   The default keeps the stock's number until the owner moves it.
2. **The credit line** stays the stock's three sentences, word for word, on screen in the caption band
   (three lines at 390 px, up to four at 320). The other road: a two-line form on screen (`Weather data
   by Open-Meteo.com, under CC BY 4.0; the forecast unmodified, the scores this app's.`) with the full
   statement in About. Default: word for word, as `PROMPT.md` asks of the footer.
3. **The two credit links** stay `<a href>`s with their `https` addresses in `index.html`, a stated
   exception to HOUSE 7.1 item 2, allow-listed in `check.mjs` by file and exact string, because
   Open-Meteo's terms ask for a link next to the data and CC BY for a link to the license. Global
   Weather prints GeoNames' CC BY address as text without a link; the owner may prefer that road for
   the whole family.
4. **No units key, and km/h for gusts.** The house's SI default would show wind in m/s first. The file's
   unit is km/h, the rule's key is `maxGustKmh`, and a display unit that differed from the file's would
   print the reader's limits in a unit their rules file does not use. Default: the file's units, °C and
   km/h (km/h is accepted for use with SI), stated in the caption.
5. **Hours already past** are drawn in the Shutters at 40 % (the file's whole span, with `now`), while
   the table and the windows start at the current hour as the stock's do. The alternative draws only
   the remaining hours, left-aligned at the same scale.
6. **The pipeline's comments**: `scripts/outdoor_window.py` names `app.js` as its mirror (lines 67,
   122, 141, 146, 155); with the scorer in `js/score.js`, those comments go stale. A comment-only edit
   in a pipeline file is the lead's, outside an art pass.
7. **README's entry**: one sentence on the Shutters (the lead's, at the commit).

---

## ART.md's section 6 before the build (moved by the builder when the section was rewritten as built)

## 6. Budget

*Measured* 2026-10-02 on the committed folder: code as every shipped `.html`, `.css` and `.js`; the ZIP
by `build-zips.yml`'s command (`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*'
'scripts/*' 'dist/*' 'raw/*'`), then `wc -c`.

| | Before the pass | Cap |
| --- | --: | --: |
| App code | 50 637 (`index.html` 1 770, `style.css` 11 020, `app.js` 37 847) | 200 000, the house's |
| Fonts | 0 | 160 000 |
| ZIP | 29 939 | 75 257 by D5 (29 939 × 1.25, rounded down, plus 37 834 for the face); see below |
| Data | `data/snapshot.json` `94071ec5e9cb14dfeb0a6b00df3e3e37002f162929d69fd4241a58a726d1f1f1`; `data/rules.json` `ac9e029fe5147af3c247d59a173135014b5ae8b3f83a119fc0db0cc7afefc97a` | pinned by `check.mjs`, byte-identical |

**The ZIP is expected over D5's cap**, as World News' and Finances' were (HOUSE 8, "The formula and the
small apps"). Stored in today's ZIP: `app.js` 11 996, `PROMPT.md` 6 370, `NOTES.md` 4 022, `style.css`
3 315, the data 2 244, `index.html` 945. The pass adds the face and its license (37 510 B stored, more
than the whole stock ZIP), three small modules, About, and this file. An estimate from World News'
stored sizes: about 25 000 B of code, 37 510 of face, 2 244 of data, about 10 500 of `NOTES.md` and
`PROMPT.md`, about 8 500 of this file once sections 8 and 9 have moved, about 1 500 of entries:
**about 85 000 B**, some 10 000 over 75 257. The builder applies the whole list, cuts nothing, never
minifies or strips a comment, measures, and leaves `ZIP_CAP` at 75 257 in `check.mjs` with the one
failing line for the lead to rule on the measured figure, as D27 and D30 were ruled. App code is
expected near 70 000 B, a third of its cap.

**The lead's interim ruling (2026-10-03, plan 0011 D33).** The ZIP cap stands at D5's 75 257 B until the build
has measured; the builder applies the whole change list, cuts no feature, never minifies or strips comments, moves
sections 8 and 9 out as its last item, and reports the figure. The stock ZIP (29 939 B) is smaller than the face it
gains (37 510 B stored), so the lead rules on the measured figure, as for Finances (D27) and World News (D30):
a raise is the expected answer. The code cap is the house's 200 000 B. Owner calls 1 to 5 stand as the pass
proposes; the pipeline's comments (owner call 6) and the README sentence (7) are the lead's at the commit.

---

## As built (the builder, 2026-10-03)

Items 1 to 15 of the change list are applied, B1 to B17 with them; nothing was cut, minified or stripped
of a comment. The data files are byte-identical (`check.mjs` pins both sha256 values) and the pipeline
(`scripts/outdoor_window.py`) is untouched. New files: `fonts/` (the house face and `OFL.txt`, copied
byte for byte from `global-weather/fonts/`), `js/units.js`, `js/score.js`, `js/shutters.js`,
`tools/check.mjs`, `tools/test_shutters.mjs`, `tools/shoot.mjs`. Rewritten: `index.html`, `style.css`,
`app.js`. Edited: `NOTES.md`, `PROMPT.md`, `ART.md` (sections 6 and 8 rewritten, the departures below
corrected in place). `screenshots/app.png`, the README's composite, is untouched.

**Departures from the art pass's text, each corrected in `ART.md`:**

1. **`now` sits under the axis**, in its label row, not over the notch: over the notch are the rows. It
   is a label like the others, so near the file's start it gives way to the first day's label (at 390 px
   for the file's first ten hours: shown from 10 h 20 min in, not at 9 h 20 min) and the notch alone marks the present.
2. **The axis' baseline is 9 px under the brackets**, not 4: at 4 the tracer head's 7 px `--page` ring
   covered the bracket under the chosen hour (seen on the first run-out picture, where the first window
   starts at the chosen hour).
3. **A tap is taken in the click that follows the pointer's lift**, not in `pointerup`. Found by
   `shoot.mjs`: the Hours pane's scroll to the tapped hour ran inside `pointerup`, and the browser's
   following click then landed on whichever table row the scroll had moved under the finger (a tap on
   hour 44 chose hour 32). The click is armed only by a pointer tap, so VoiceOver's press, a click with
   no pointer before it, still picks nothing.
4. **The readout has four lines below 360 px** (three above): at 320 px one hour and at 312 px (125 %
   text) eight hours need a third line of values when they hold a sunrise, a sunset or `already past`.
5. **A failing hour's line in the table reads `ruled out by gusts and daylight`**, the readout's words,
   not `gusts, daylight`: under `night` the bare word `daylight` read as the hour's light.
6. **Rainfall is shown everywhere a value is** (B17): a table column, `Most rainfall` in the window's
   facts, and `rainfall in mm` in the Hours caption.
7. **A tap on the Shutters scrolls the table until the row is in view**, the least scroll that shows
   it, so a row already on screen leaves the Shutters where they are.
8. **About prints the credit sentence without its anchors**; the anchors are the band's, on every pane.
   The two addresses are printed under it without their scheme, so `index.html` holds each `https`
   address once, the two anchors `check.mjs` allows by exact string.
9. **The same files on a return redraw only the stamp, unless an hour has ended since**: then the panes
   are drawn again in place (pane, scroll and hour kept), so the faint hours and the table's first row
   follow the clock. A new forecast says `New forecast, updated 12:35.`; new rules alone say `The rules
   were read again from data/rules.json.`
10. **A broken replacement's notice** reads `A new data/snapshot.json arrived and cannot be used. …
    Still showing the forecast updated 11:35.`, with `Close`; a first file that cannot be used empties
    the stamp to `No usable forecast` and lists each problem, then `In Snuggery, Options, then App
    Files shows what the file holds.`
11. **The arrow keys up and down move the hour too**, as the house track's do; VoiceOver's swipes on a
    slider arrive as those keys. Page Up and Page Down move six hours.
12. **The count column narrows from 26 to 24 px** where 4 px an hour only just fits (312 px, 125 %
    text), so the drawing never runs past the pane.
13. **The golden-hour rule marks an hour as having no value** (a hollow block) when the file gives no
    sunrise or sunset for its day. The score is unchanged: `check.mjs` pins the scorer's arithmetic to
    the stock's text, passage by passage, and `test_shutters.mjs` finds 0 differences.
14. **The credit anchors' 44 px hit** is vertical padding on a positioned inline, so it paints and
    hit-tests above the next line's text without moving it.

**The camera** (HOUSE 7.4): `Windows` and `Hours` stay `<button role="tab">` named by their visible
words, now built only after the forecast parses (B7); nothing else on the page is a button by either
name (the Shutters are one slider named `Hour`). The app stores nothing. **The camera needs no change.**

**Budget** (`node tools/check.mjs`): app code 82 781 B of 200 000 (50 637 before); fonts 40 075 of
160 000; the ZIP about 95 800 B against D5's 75 257, about 10 000 over the art pass's 85 000 estimate.
Stored: face and license 37 510, app code 29 448, `ART.md` about 14 000, `NOTES.md` and `PROMPT.md`
10 774, data 2 244. `ZIP_CAP` stays at 75 257 with its one failing line, for the lead's ruling.

**Phone checks** for the device matrix (an iPhone on iOS 18, in Snuggery's full screen), none claimed:

- VoiceOver on the Shutters' slider: a swipe up or down moves one hour and says the new value; the
  description is read once; a double-tap picks nothing.
- A sideways drag on the Shutters against a vertical scroll of the pane: the drag scrubs, the scroll
  scrolls and picks nothing; the head and the readout follow the finger on every frame.
- A tap on the Shutters on the Hours pane: the hour is chosen and the table scrolls to its row, and the
  tap never chooses the row the scroll brought under the finger (departure 3, on WebKit's own click).
- A tap on each credit anchor: Snuggery names the address and offers Safari.
- A new forecast delivered by the Shortcut while the app is open: it redraws in place, keeping the pane,
  the scroll and the hour, and says so once.
- The phone on its side; safe areas at every edge.

## After QA (the builder, 2026-10-03)

QA passed the house-system pass with no must and no should, so the app, `ART.md` and the data are
unchanged by this stage. One thing QA set aside was not what it said it was, and is fixed here, in a
tool that does not ship.

**The scrub check's intermittent failure was a race in the test, not a file race and not the app.** QA
saw `tools/shoot.mjs` fail one check once and put it down to the lead editing files at the same moment.
With no one else editing, the unchanged tool failed 2 runs of 2, and copies of it that only added logging
failed 7 runs of 11: each time one to three of a run's six scrubs (three speeds in two themes), with 1 or
2 moves out of 40 or 70 showing the hour before the one under the finger (wanted:shown 10:9, 13:12,
17:16, 9:8, 16:15, 14:13, 8:7). A scratch copy that logged each `pointermove` with
`performance.now()` showed why: CDP's `Input.dispatchTouchEvent` returns before headless Chromium hands
the move to the page, which sometimes arrives with a later frame (one case: the call returned at
10 239 ms, the move arrived at 10 256, the test's two-frame wait ended at 10 257 and read the state at
once). Two frames later, every mismatched case showed the right hour. The app does what the house track
does (HOUSE 4.6, Global Weather's `js/track.js`): it takes the hour on `pointermove` and draws it on the
next animation frame. Its own per-frame log, which compares the chosen hour, the value, the head and the
readout's label on every drawn frame, never failed in any run.

**The fix, in `tools/shoot.mjs` only:** a capture-phase `pointermove` listener records the last finger
position the page has received, and after each move the scrub waits (up to 500 ms, counted as `never
arrived` if it runs out) until the page has that position, then one drawn frame, then compares. This is
the comparison Global Weather's scrub check makes, against the finger the page itself was given. The
line now reads `after every move, once the page has it (0 never arrived), and one drawn frame, …`.

**It still catches a slow slider**, proven on two mutants of `app.js` in a scratch copy, the fixed tool
unchanged: drawing the hour three frames after the move instead of one failed 3 of the 6 scrubs (1 or 2
moves each), and drawing nothing until the lift failed all 6 (70, 33 and 37 moves).

**Measured after the fix:** `node tools/shoot.mjs` 154 ok, 0 FAIL, exit 0 in 6 consecutive runs (9
failing runs of 13 before it, counting the logging copies); `node tools/check.mjs` all
checks pass with the ZIP at 95 825 B under the 99 000 B cap (D34), app code 82 781 B, fonts 40 075 B;
`node tools/test_shutters.mjs` 25 of 25. Headless Chromium is not phone evidence: these runs say the
scrub keeps the hour, the value, the head and the readout together, not that it keeps up on an iPhone.
The phone checks listed above under "As built" stand unchanged.

**Left for the lead, outside this pass's folder:** `scripts/outdoor_window.py`'s comments still name
`app.js` as the scorer's mirror; it is `js/score.js` now (owner call 6). The camera needs no change.

## After review (the builder, 2026-10-03)

The reviewer's verdict was `fix`: one must, three shoulds, eight nits. Every must and should is applied; six
nits are applied, one is declined and one becomes a phone check. The data, the pipeline, the snapshot, the
loop and the scorer's arithmetic are unchanged (`check.mjs` pins both sha256 values and the scorer's ten
passages). `ART.md` is corrected in place: sections 1, 2, 3 and 6, its header's hash and clock.

**Must: the axis named the wrong day for a file that starts after about 14:00.** The labels were placed in
the order first day, midnights, `now`, noon, so the first day's label won every collision and ran under the
next day's hours. Now every midnight's day is placed first, under its own tick; the first day's label comes
second and only where it ends 4 px before the first midnight's tick (`stop` in `js/shutters.js`), so it is
left out rather than run across a midnight; noon last. `now` left the axis row altogether (next item).
`tools/test_shutters.mjs` now builds the shipped values re-timed to start at each of the 24 hours of the day
in Oslo (UTC+2), read 2 h 30 min after the fetch, and asserts that every midnight's day is labeled under
its own tick, that no day's label crosses a midnight it does not name, and that the first day's label ends
4 px before the first midnight. Run against a scratch copy of `js/shutters.js` with the old order restored,
that check failed for every fetch from 14:00 to 23:00 (`14:00 (Sun 20, Tue 22, 12:00, 12:00) | 15:00 …`),
the reviewer's measurement; as built it passes for all 24. `tools/shoot.mjs` drives a reader's own file
fetched at 22:00 in Oslo and read at 00:30 (picture `tools/.work/shots/late-22-light.png`): the axis says
`Mon 21, Tue 22, 12:00, 12:00`, with Monday under its own midnight and the first two hours unnamed.

**Should: nothing marked the present hour.** `now` now has a 16 px row of its own over the stack, with a
1 × 5 px `--ink-2` notch hanging from it to the rows. This is the house track's `now` above its notch, with
the rows between them and the axis. No day label competes with it, and the tracer head, which stands on
the axis under the stack, can never cover it. `shoot.mjs` asserts the notch's foot (y 17) is above the
head's rule (y 132.5). When the file has run out, the row is not drawn and the rows start at y 1, so the
camera's ran-out picture is 16 px shorter there. The readout prints `Mon 21 Sep, 10:00 now, clears every
rule, score 76` for the present hour. `now` sits in the verdict, not in the bold label, because `10:00, now
clears every rule` read as a sentence. The slider's value is `Monday 21 September, 10:00, now: clears every
rule, score 76`. D34's owner call on `now` yielding to the first day's label is withdrawn: `now` never
yields now.

**Should: the signature did not read as windows.** A window is now drawn as one, from the same data, the
scorer's `findWindows`. Its opening is lit (`--sheet`) from the stack's top down to the sill. A 1 px ink
jamb runs up the whole stack at each edge, in the page's gap beside the window's first and last hours, and
a 2 px ink sill under it joins them (it was the bracket). The allowance bars are thinner, 2 px wide at 4
and 5 px an hour and 4 px at 12, and centered on their hour, so an open hour reads as light rather than
green. The rows went from 12 px to 16 px (pitch 19), and the bar scale from 9 px to 12 px, so a bar is
still never as tall as a block. The example statement is one line (`Example forecast: Boston Common, 21
to 23 Sep 2026.`, 310 px). The stamp already says when the file ran out, so the ran-out sentence went.
The way to one's own forecast now closes the Windows pane (`Build the Shortcut in PROMPT.md and the app
shows where you are.`) and is also in About. The pane keeps the stock's order below the drawing: the
readout, the next window, the facts, `After that`. Changing that order was not needed for the windows to
read.

- Pictures: `tools/.work/fix/before-after-windows.png` (390 px a pane) and
  `tools/.work/fix/before-after-windows-thumb.png` (195 px a pane, about arm's length). In both themes
  the windows read as two framed openings at thumbnail size. Before, they read as a green strip with a
  bracket.
- Color (`palette.py`, new lines in section 3):
  - a bar in a window, `--used` on the opening: 4.00 light, 4.11 dark; on the chosen column there: 3.49
    light, 3.39 dark (the dark theme's new lowest data figure);
  - a jamb or sill, ink on the opening: 16.40 light, 12.87 dark;
  - the opening against the page: 1.11 light, 1.12 dark. This is printed but not held to 3:1, because
    it is a ground and the frame carries the edge.
- `shoot.mjs` reads every mark against its own ground on rendered pixels: 100 % of 1 800 green samples are
  at 3:1 or more in both themes, and each of the four jambs is 3:1 over 100 % of its height. Each opening
  is `--sheet` in the gaps between rows (93 % and 100 %; the rest is a midnight hairline or the chosen
  column).
- Tests: the decode test recomputes every bar at `round(12 × used)` and checks the widths. `shoot.mjs`
  checks every opening, jamb and sill against the decoded windows.
- Shipped bars:
  - Gusts: 42 bars, 8 of them at 11 px and 2 at 12 px.
  - Dew point: 47 bars, up to 8 px.
  - Temperature: 40 bars, up to 5 px.
  - Rain chance: one bar of 1 px.

**Should: a pinch that started on the Shutters could not zoom.** `.sh` is `touch-action: pan-y
pinch-zoom`. A second finger on the Shutters ends a scrub where it stood, and two fingers never scrub.
The app keeps a set of the pointers that are down, cleared by capture-phase `pointerup` and
`pointercancel` listeners on `window`. `shoot.mjs` sends a two-finger spread by CDP and asserts the hour
does not move. Against a scratch copy with the guard removed, that check failed: the hour went to 28.
Headless Chromium's visual viewport stayed at scale 1.00, so the zoom itself is a phone check (below),
not a measured result.

**Nits.**

- **Applied: a window across midnight.** `js/units.js` `placeSpan` writes a run of hours as
  `07:00–19:00`. One that ends at midnight reads `20:00–24:00`, and one that ends on a later day reads
  `10:00 to Wed 05:00`. VoiceOver hears `Monday 05:00 to Wednesday 05:00`. These are in the decode test's
  units and in `shoot.mjs`'s no-rule run.
- **Applied: no rule in use.** The pane now says it in a statement: `No rule is in use, so every hour
  clears and scores 0. The Rules pane says how to add one.` The caption becomes `No rule is in use, so
  every hour is open. Framed gaps are windows.` The score of 0 is the stock scorer's arithmetic, pinned,
  so it is explained, not changed.
- **Declined: the past hours' contrast** (the faint marks measure 1.62:1 to 2.45:1). Owner call 5 stands
  as it was. With `now` always labeled over the stack, the faint hours to its left explain themselves.
- **Applied: the credit anchors.** Their 44 px hit is now `padding: 0 4px 30px`, all of it below the
  anchor's top. `shoot.mjs` samples every point of the caption's box at eight widths and three panes and
  finds 0 points under an anchor. With the old padding injected, 966 points of the caption were under an
  anchor (`tools/.work/fix/cap.mjs`).
- **Applied: left alignment on a phone on its side and on a tablet.** `.panebody` has no `auto` margin
  any more and takes the header's 20 px gutter from 700 px. `shoot.mjs` asserts that the pane's, the
  header's and the band's left edges are equal at every width (x 16; x 20 on its side and on the tablet).
- **Corrected: `ART.md`'s errors.** The snapshot hash now reads `94071ec5…a726d1f1f1`, the screen clock
  14:20 UTC, and section 6 is figures only, with the pass narrative left here.
- **Applied: the edge geometry.**
  - A one-hour window is now a framed slit, 4 px lit between two jambs at 5 px an hour.
  - A file too long for 4 px an hour (over about 60 hours at 390 px) takes the fraction that fits beside
    a 20 px count column. The decode test's 72-hour file draws 3.806 px an hour, 358 px in all inside
    358.
  - The 48-hour cases keep their whole pixels.
- **Applied: the Hours rows.** They are no longer tappable: `tr.onclick` and the pointer cursor are gone,
  and the Shutters choose the hour. `shoot.mjs` asserts that a tap on a row chooses nothing.
- **Not fixed: daylight saving time.** The scorer's one `utc_offset_seconds` for the whole file is
  pinned arithmetic. It becomes a phone check below and a follow-up for the lead and the owner.

**The camera** is unchanged: `Windows` and `Hours` stay `<button role="tab">`, built after the parse, and
nothing else on the page is a button by either name. `screenshots/app.png` is untouched (`shoot.mjs`
checks its hash). `SCREENSHOTS=1` re-shot `screenshots/{windows,hours,rules}-{light,dark}.png` and
`about-light.png`.

**Owner calls this stage leaves open**, each standing as built until the owner reverses it:

1. The example statement is one line. The ran-out sentence is dropped because the stamp carries it, and
   the PROMPT.md pointer moves to the pane's foot.
2. The window's opening is lit in `--sheet`, a chrome token that HOUSE 3.1 lists for plates, the card,
   About and notices, used here as the lit ground of a data shape. The other way is the page, with the
   frame alone.
3. The rows are 16 px and the bars 12 px. With `now` in the file the Shutters are 163 px tall (123
   before); with the file run out, 147 px.
4. The Hours rows are not tappable.
5. A window that ends at midnight is written `24:00`.

**Phone checks added** (an iPhone on iOS 18, in Snuggery's full screen), none claimed:

- A pinch started on the Shutters zooms the page, and a one-finger sideways drag still scrubs.
- An evening Shortcut refresh in Oslo (after 14:00): each day's name sits under its own midnight, and
  `now` is drawn over the stack.
- A file spanning Sun 25 Oct 2026 in Oslo (the change from summer time): `now`, the faint hours and the
  windows sit at the right hour after the change. Expected to be off by an hour; this is the follow-up.
- The windows' frames and openings at arm's length in both themes.

**Measured after this stage** (the lead's runs should match):

- `node tools/check.mjs`: all checks pass. App code is 86 825 B of 200 000 and fonts 40 075 B. The ZIP is
  97 744 B of 99 000, about 1 255 B to spare, within 5 %. Both data files are byte-identical.
- `node tools/test_shutters.mjs`: all 30 checks pass.
- `python3 outdoor-window/tools/art/palette.py` (run from `Template/`): ALL CHECKS PASS.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: 166 ok, 0 FAIL, all checks pass, with
  `screenshots/app.png` untouched.

Every frame figure is headless Chromium on this Mac, not phone evidence.

**Left for the lead, outside this folder:**

- Owner call 6, `scripts/outdoor_window.py`'s comments, still stands.
- The README has no sentence on the Shutters yet (owner call 7). Any sentence written should say
  "framed windows", not "brackets".
- The before and after pictures are in `tools/.work/fix/`, which does not ship and is gitignored.

## After the final (the lead, 2026-10-03)

The final stage left one should: the readout's first line (`.ro-when`) had no fixed height and wrapped
on long verdicts — at 312 and 320 px on 5 of 48 hours, at 360 px on the present hour when it is ruled
out — so the content under the Shutters jumped while scrubbing, though ART.md §3 calls the readout a
fixed block. The lead fixed it in `app.js`: `holdReadout()` runs once per draw after `show()`, writes
every hour's date, time and verdict into the first line in turn, takes the tallest height, puts the
chosen hour's text back and sets that height as the line's `min-height`; the width's draw repeats it.
Measured with the final's own script (headless Chromium, 48 hours by the keys): the first line holds at
34 px at 312 and 360, at 17 px at 375, 390 and 430, and the section under the readout keeps one top at
every width (453, 418, 401, 401, 401). `shoot.mjs`'s width checks now hold the first line's height and
the top of what follows the Shutters to one value across all 48 hours; the first run of the guard
crashed on its own null (it read the readout's next sibling, which is nothing: the readout closes its
wrapper), fixed to read the wrapper's. ART.md §3's readout paragraph says how the block is held. Code
87 647 B, ZIP 98 073 of the ruled 99 000; `check.mjs`, `test_shutters.mjs` (30) and `palette.py` pass.

Owner call 6 was taken in D34 (`scripts/outdoor_window.py` names `js/score.js`; the lowercase sentence
start the final noticed on its line 146 is corrected with this commit). Owner call 7 is the README's
sentence: "a framed window stands open, with `now` marked above the rows". The demo forecast of 21 Sep
has no refresh bot, so the camera's README panes show the ran-out state; refreshing the demo means
re-pinning the shoot's and the decode test's fixtures to the new file, an owed follow-up (plan 0011 D37).
