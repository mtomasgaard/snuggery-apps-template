# Finances: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look as built; this file
holds the record: the lead's rulings, the owner calls as the pass left them, the as-built departures,
the after-QA, after-review and after-follow-up sections, the phone checks. Plan 0011 package B, D1 to D5
and HOUSE.md are the brief. The builder's first step moves `ART.md`'s sections 8 and 9 here, word for
word, below this section; nothing above the first `---` is to be overwritten.

## The lead's rulings before the build measured (2026-10-02, plan 0011 D26)

**The ZIP cap stands at 125 304 B until the build has measured; nothing cut.** The cap is the stock
ZIP's 69 976 B × 1.25 plus 37 834 B for the face (D5). The art pass's simulated build is 121 043 B,
about 4 250 B compressed under it, before the stylesheet rewrite, About and the caption band. The
builder applies the whole change list, cuts no feature, never minifies or strips comments, and reports.
If the ZIP lands over with nothing cut, the lead rules on the measured figure: for an app whose stock
ZIP was 70 kB, the house face and the two modules weigh more than the formula foresaw, so a raise is
the expected answer, not a trim of `ART.md`, which ships as the look as built. The code cap is the
house's 200 000 B (the app is under it: 103 178 B today, about 130 000 after the pass).

**"Example data." in place of "Stale." on synthetic data (owner call 1): stands.** The example never
refreshes, so "Stale." would read as a fault to fix; the date stays on screen. For the record, Running
Dashboard's demo says "Stale." today under the same circumstances; making it say "Example data." is a
family-wide owner call (about 50 B against a cap already full there).

**The data's British words (owner call 2) are a data follow-up after the pass**, not the pass:
`scripts/finances.py` and `scripts/make_demo_finances.py` are swept and `--check` proves the change, as
Running Dashboard's follow-up did; the pass keeps the four data files byte-identical.

## The lead's ruling on the ZIP cap (2026-10-02, plan 0011 D27)

**The ZIP cap is 131 000 B; nothing is cut.** The build measured 128 025 B against 125 304 (+2.2 %) with the
whole change list applied, nothing minified and no comment stripped. Inside the ZIP the face and its license
store 37 510 B, the app code 40 696 (29 406 before), the shipped documents 18 332 and the data 29 540: the house
face and modules are a fixed cost, and D5's formula — today's ZIP × 1.25 plus the face — undercounts an app
whose stock ZIP was 70 kB, where the code's growth alone is 11 000 B stored. Trimming `ART.md`, which ships as
the look as built, would hide the record for 3 000 B. The raise leaves about 3 000 B for the fix stages; they
pay for nits in place and report anything over. The lead set `ZIP_CAP` in `tools/check.mjs` to 131 000 with
this reason, so the one failing line passes.

---

## ART.md's sections 8 and 9, as the art pass wrote them (moved word for word by the builder, item 1)

## 8. The change list (for the builder, in order)

Bugs are B1 to B25, every one a must unless it says *should*. None is on record elsewhere: plan 0009
item 5 names no Finances bug, `grep -rn -i finance docs/review/` finds nothing, and the app has no
DECISIONS file. They come from the stranger's run (`tools/.work/look.mjs`, headless Chromium 390 × 844,
both themes, clock 21 Sep 2026, 12:00 Oslo; its numbers from `tools/.work/look/report.json`).

- **B1** Numbers through `toLocaleString('nb-NO')`: decimal commas and U+00A0 thousands (`10,3 %`,
  `4,90 % nominal`, `513,9718 units`, `NAV 232,51`, `−86,49 kr`).
- **B2** Axis ticks write `m` for million (SI's milli), and the net-worth axis prints `2,7m` on two
  gridlines (2.65 and 2.70 million rounded to one decimal).
- **B3** Dates through `toLocaleDateString('en-GB')`: `21 Sept` and `Sept` beside `Sep`; the clock
  through `toLocaleTimeString`; and "today" taken as `new Date().toISOString().slice(0, 10)`, the UTC
  date, so from 00:00 to 02:00 in Oslo every `in N days` (the card's due date, consent, vesting) is a
  day off.
- **B4** Stale is a color: `.freshness.stale` turns the stamp amber and bold, its words unchanged.
- **B5** Text under 4.5:1: every meta line, sub line, split label, day heading and the footer in
  `--ink-faint`, 3.07:1 light and 3.76:1 dark; the chosen tab's white on blue 4.42:1.
- **B6** Hit targets under 44 px: the tabs 31 px tall, the range keys 28, the valuation chips 26,
  `Show as a table` 28, the search field 40, `Show 100 more of 300` 41.
- **B7** Middle dots join the stamp, every meta line and the deltas.
- **B8** Spaced em dashes in the app's own text (`Bank — ok, read 5 hours ago`, `access expires in N days —
  re-authorise`, the chips' titles) and `—` printed for an absent value.
- **B9** Savings' four splits overflow at 390 px: `119 504 kr` runs into Pension's `—`; `101 000 kr`
  ends 14 px past the card's padding.
- **B10** The credit card's row reads `•• 3388 · Credit card · Credit card` (source and type repeat
  its name), and its balance is `−8 761 kr` under Accounts but `8 761 kr` in red under Card.
- **B11** Spending's dates are a day too wide: `build_spending` counts `from < date <= to`, so the
  window is 23 Aug to 21 Sep, but the sub says `Sat, 22 Aug 2026 to Mon, 21 Sept 2026`.
- **B12** A broken replacement wipes the screen: `showError()` hides `<main>` and the footer even
  when good data was showing; the error is a pink box with a monospace `code` face.
- **B13** `localStorage` outside try/catch (`getItem` of `fin.range` and `fin.tab` at module top,
  `setItem` in `showTab` and the range handler): with storage blocked the module throws and nothing
  renders. The runtime rule is every access in try/catch.
- **B14** A vertical scroll that starts on a chart pops its tooltip: `pointerdown` shows it before the
  browser has decided the touch is a scroll.
- **B15** Plurals: `in 1 days`, `1 days ago` (the card's due date, vesting).
- **B16** Uppercase tracked labels: section headings, section heads, hero labels, split labels, table
  heads, day headings.
- **B17** Red and green carry direction: deltas, debts, gains, `vs previous`.
- **B18** Two amber boxes say one thing on Overview: the app's example-data sentence and the
  snapshot's own note.
- **B19** Tells in the stylesheet: `box-shadow` on every card and the tooltip, `backdrop-filter` on the
  header, a gradient under the net-worth line, pill tabs in accent blue, one 16 px radius, `▸ ▾`
  markers, `title` attributes as the only place for the stamp's full instant.
- **B20** The Owned chart's ticks stop at 4 million while the owned line runs at 5.3 million, above
  the last labeled gridline.
- **B21** `<html lang="en">`; no `color-scheme` or `theme-color` meta.
- **B22** British spelling: on screen `amortised` (the footer) and `Re-authorise`; in `app.js`'s
  comments `colour`, `labelled`, `for ever`, `artefact`; in `style.css` `colour`, `licence`; in
  `NOTES.md` `licence`, `authorise`; in `PROMPT.md` `modelled`, `amortised`, `categorise`,
  `authorise`.
- **B23** `PROMPT.md` line 251 writes `→` twice.
- **B24** The data's `•` is not in the house cut.
- **B25** *Should*: `miniapp.json`'s description has a spaced em dash (`savings — bank data`).

The items, in order:

1. `ART.md`, `tools/DECISIONS.md` (new): sections 8 and 9 of this file moved word for word to
   `tools/DECISIONS.md` under a heading that says so, before the first measurement; section 8 here
   becomes "Where the record is". `.gitignore` is done (`tools/.work/`, `tools/node_modules/`,
   `dist/`).
2. `fonts/`: copy `global-weather/fonts/ysabeau-office-gw.woff2` and `OFL.txt` byte for byte. Measure
   the ZIP (`check.mjs` or the command in section 6).
3. `js/units.js` (new, pure): every number, amount, percent, date and span the app writes. `money(n,
   currency)` (`kr` for NOK, the ISO code for any other; U+202F thousands from four digits and before
   the unit; U+2212; no `−0`); `signed()`; `pct(x, decimals)` (`10.3 %`); `units(n)` for fund units;
   `axis(ticks)` returning the unit caption (`thousand kr`, `million kr`) and labels whose decimals come
   from the step, so no two ticks share a label (B1, B2); dates by hand from the phone's clock, 24-hour,
   day before month (`21 Sep`, `Mon 21 Sep 2026`, `Sep 2026`, `07:12`; B3); `todayIso()` from the
   phone's local date (B3); `days(n)` with plurals (`in 1 day`; B15); `spoken()` (kr kroner, % percent,
   dates in full, U+2212 minus). `toFixed` and `toLocaleString` nowhere else.
4. `js/balance.js` (new, pure): section 1's items, order, reconciliation, rungs, cumulative geometry,
   groups and labels, exported for the test.
5. `style.css`: rewritten on the house's (Global Weather's and Running Dashboard's as the base): the
   `@font-face`; HOUSE 3.1's tokens in `:root` and under `(prefers-color-scheme: dark)`; the data tokens
   from `palette.py --json` (`--amount`, `--series-1` to `-6`); `html, body { background: var(--page)
   }`; the frame, header, stamp, tabs with the tracer, rows of words, sections, facts, rows, statements,
   charts, the Balance, the card, the table keys, the search field with its cancel button removed
   (HOUSE 4.8), notices, About, `.sr`, landscape, safe areas; transitions on `opacity`, `transform`,
   `clip-path` only; Reduce Motion at 0 s; hover only under `(hover: hover)`; `touch-action:
   manipulation` and no tap highlight on controls. Out: the stock tokens, `--shadow`, `backdrop-filter`,
   uppercase, letter-spacing, pills, `.banner`, `.tag`, the monospace `code` rule, `▸ ▾` (B4, B5, B16,
   B19).
6. `index.html`: `lang="en-US"`; `color-scheme` and two `theme-color` metas (`#e8eef0`, `#141d21`);
   the header with the stamp button; an empty `role="tablist"`; `<main>` scrolling, not `aria-live`;
   each pane's sections in house markup, the Balance's `<svg>` heading Overview; the caption band (line
   and credits); the live region; About's dialog with section 3's words; the stock footer gone; no
   `title` used for information (B19, B21).
7. `app.js`, the frame: render into `<main>`; scroll moved from `window` to it; tabs built by
   `buildTabs()` after the parse with the tracer and arrow keys; the stamp (section 3; B4); the caption
   band per pane; About; every `localStorage` access in try/catch, keys unchanged (`fin.tab`,
   `fin.range`, `fin.basis`; B13).
8. `app.js`, the Balance: drawn from `js/balance.js` (section 1), its readout, label, table, caption,
   and `window.__fin` (inert: `ready()`, `balance()`, `card()`, `pane()`). It replaces the mix bar
   and the `Less what you owe` row.
9. `app.js`, statements: banners become sentences (section 3); with `synthetic`, the app's own
   sentence goes to About and the stamp, and the snapshot's notes stay on Overview (B18); consent in
   US English (`Authorize again with BankID before then.`; B22).
10. `app.js`, rows and facts: meta joined by commas with repeats dropped and masks as `ending NNNN`
    (B7, B10, B24); facts for the hero splits, absent holdings left out (B8, B9); the card's due as
    `To pay` with the balance's sign kept in Accounts (B10); no color on any amount (B17).
11. `app.js`, charts: `attachHover` and `.tip` replaced by the house card, tap-opened, with a slide
    sideways reading and a vertical drag scrolling, as Running Dashboard's `readout()` (B14); cards from
    every chart as objects; ticks through `units.axis()`, the value axis padded past its largest value
    (B20); the net-worth line in `--amount` with no gradient (B19); bars square; pairs in
    `--series-1`/`-2`; the allocation strip's slots fixed; `Show the table` keys replacing `<details>`.
12. `app.js`, Spending: the window printed as `from` plus one day to `to` (B11); the 21 px figure; bars
    in `--amount` on a `--line` track, 6 px, square; `vs previous` in words.
13. `app.js`, notices: `showError()` becomes the house plate; a failed reload while data is showing
    keeps the pane and says `Still showing the data from 21 Sep, 07:12.` with `Close` (B12); the
    validator's words kept.
14. `app.js`, words: every string US English, every comment too (B22); no middle dot, no spaced em
    dash, no `—` placeholder (B7, B8); `innerHTML` only as `= ''` (the two string assignments go;
    `check.mjs` holds the rule).
15. `app.js`, a return: the same file redraws only the stamp; a new file re-renders in place.
16. `NOTES.md`: US English except the license's proper name (*Norwegian Licence for Open Government
    Data*, allow-listed in `check.mjs` by file and phrase); the stale sentence; the type credit line
    (B22). `PROMPT.md`: US English; `→` as words (`in Safari, Share, then Snuggery`; B22, B23).
    `miniapp.json`: the description without the em dash, the name unchanged (B25).
17. `tools/check.mjs` (new, HOUSE 7.1's seventeen checks): `CODE_CAP = 200000`, `ZIP_CAP = 125304`;
    the face's two pins; the four data files' sha256; the camera's two strings with their role, and no
    tab in `index.html`; `palette.py --json` equal to `style.css`; the credits constants; the
    allow-lists; the tells.
18. `tools/test_balance.mjs` (new): decodes the snapshot with its own code; the items, order,
    reconciliation (demo: 0.00 kr off), rung (50 000) and depths (115 and 60 px) against
    `js/balance.js`; `js/units.js`'s forms.
19. `tools/shoot.mjs` (new, HOUSE 7.2 as a pane app allows): boot by the camera's tabs; both themes;
    text contrast; the Balance's ink sampled on rendered pixels; its blocks against the script's own
    decode; a tap's card against the data and clear of the point; fifteen taps on the cash-flow chart
    with no column under the card; a vertical drag on every chart scrolling with no card; SI in every
    visible text node; hit targets; About; storage blocked (B13); a clock at 00:30 Oslo (B3); Reduce
    Motion; hidden and back; broken data (missing, not JSON, the wrong shape, a broken replacement);
    320, 360, 375, 844 × 390, 125 %; pictures to `tools/.work/shots/`, never `screenshots/app.png`.

---

## 9. Owner calls left open

1. **The stamp on example data** says `Example data.` where real data would say `Stale.`: the
   example never refreshes, so `Stale.` would read as a fault to fix. The date stays on screen.
2. **The data's own British words** (`modelled annuity`, `amortised`, `INSTALMENT`, `Holiday fund`,
   `Petrol Station`) are written by `scripts/finances.py` and `scripts/make_demo_finances.py`. A data
   follow-up after the pass, as Running Dashboard's was, sweeps both and proves with `--check` that
   only words moved; the pass keeps the data byte-identical.
3. **The bank's capitals** (`MORTGAGE PAYMENT`, `PARKING`) are shown as the bank writes them, as data.
   Sentence case on display is the other road.
4. **The ZIP cap.** If the build measures over 125 304 B with nothing cut, the lead rules as on the
   code caps; this file's shipped size is the easiest give.
5. **Slot 6's hue** (a violet for the stock's second green; section 2).
6. **The credits**, two constants by `synthetic`: example, `Accounts, holdings and loans: invented for
   this example. Home index: Statistics Norway, table 07221 (NLOD).`; real, `Accounts: your banks,
   through Enable Banking (PSD2). Home index: Statistics Norway, table 07221 (NLOD).` The index's own
   attribution stays printed under the home's value, as `NOTES.md` requires.

**Phone checks** (not claimed here): the pane scrolling inside the frame; a tap on a 1 px block and on
the hollow; a vertical scroll starting on a chart or on the Balance; the stamp on a stale real
snapshot; a delivery while open, and a broken one; VoiceOver on the tabs, the Balance's label and a
card; safe areas; landscape; the search field's keyboard. Each on an iPhone with iOS 18 and one with
iOS 26.

## ART.md's section 6 before the build (moved by the builder when the section was rewritten as built)

| | Today | Cap | Note |
| --- | --: | --: | --- |
| App code | 103 178 (`app.js` 79 120, `style.css` 14 514, `index.html` 9 544) | 200 000 | the house's; about 130 000 expected |
| Fonts | 0 | 160 000 | 40 075 after the pass |
| ZIP | 69 976 | **125 304** | 69 976 × 1.25 rounded down, plus 37 834 for the face (D5) |
| Data | `data/snapshot.json` `5d1c30a3…085be0`, `assets.json` `03ff325a…f92e1c`, `holdings.json` `6301079e…d2bb86`, `categories.json` `7d6e4a2f…ba60b` | pinned | `scripts/make_demo_finances.py --check` passes |

**The ZIP is the tight cap**, so it was simulated, not guessed: this folder zipped by the command
above with the house face and `OFL.txt`, this file as it will ship (sections 1 to 7 and a short
section 8), and Running Dashboard's `js/units.js` and `js/block.js` standing in for the two new
modules, comes to about 121 050 B (`zip -q -r -X` in a scratch copy, then `wc -c`; this file ships,
so its own figure moves the last digits). **That leaves about 4 250 B, compressed, for the rewritten
stylesheet, About and the caption band in `index.html`, and `app.js`'s net growth.** The stock's own
weight pays first: its stylesheet goes whole, its locale formatters and the tooltip code go, the
footer's prose moves into About. The builder measures after items 2, 5, 6 and 11 and stops to report
if the ZIP would pass 125 304, rather than cutting a feature or stripping a comment (HOUSE 8.4).

**The lead's interim ruling (2026-10-02, plan 0011 D26).** The ZIP cap stands at 125 304 B until the
build has measured; the builder applies the whole change list, cuts no feature, never minifies or strips
comments, moves sections 8 and 9 out first as item 1 says, and reports the figure. If the ZIP lands over
with nothing cut, the lead rules on the measured figure — for an app whose stock ZIP was 70 kB, the house
face and modules weigh more than the formula foresaw, so a raise is the expected answer, not a trim of a
shipped document. The code cap is the house's 200 000 B. The stamp's "Example data." on synthetic data
(owner call 1) stands as the pass proposes; the data's British words (owner call 2) are a data follow-up
after the pass, proven with `--check`, as Running Dashboard's was.

---

## As built (the builder, 2026-10-02)

Every item of the change list above was applied; nothing was cut, minified or stripped of comments. The
four data files are byte-identical (`tools/check.mjs` pins their sha256; `python3
scripts/make_demo_finances.py --check`, run from `Template/finances`, prints `check: the committed
data is what the generator makes`). Nothing outside `Template/finances/` was written; no pipeline file
was touched.

**Departures from the change list, each with its reason:**

1. **The scale's rungs** are the whole 1, 2, 2.5, 5 × 10^k sequence, not the nine rungs from 10 000 to
   1 000 000 kr: the same rungs over that range (the demo still reads 50 000), and a copy kept in a
   currency of smaller numbers is not drawn 5 px deep.
2. **A run's label counts its kinds**: `3 accounts, 1 fund, 2 vehicles` where section 1 wrote
   `Accounts, funds, vehicles`; one fund is not "funds". Labels wrap to the room beside their column, at
   their commas first, on at most three lines; one that would touch the label above is left out (its
   card still names it).
3. **The figure under the double rule** whenever fewer than 70 px would be left for the labels at the
   left, or the hollow is under 40 px tall; it then ends at the drawing's right edge. At 320 px wide the
   demo takes this form; at 360 px and wider it sits beside the hollow.
4. **Overview's caption line** reads `Accounts as read on 21 Sep 2026; what no bank reports is
   estimated, each by the method Owned names.`, not "the home, the cars and the loans estimated": a
   copy with no car would otherwise print a sentence about cars.
5. **The search field is 16 px**, off the house scale, because iOS zooms the page into a text field set
   smaller; Shelf Atlas's find field does the same. `check.mjs` allows exactly that one 16 px.
6. **VoiceOver's label** writes its numbers whole (`5736193 kroner`), as `sayBalance()` builds it, so
   VoiceOver reads a number rather than three.
7. **The credit card's row keeps the bank's "available" figure** (`51 239 kr available`, the credit
   left), as the stock did; the row is otherwise `Credit card`, `ending 3388`, `−8 761 kr`.
8. **Owned's chart names its second line `Every debt`**, not "Owed": it plots `history.liabilities`,
   which counts the card, while the fact above it, `Owed on it`, counts the loans only (3 015 929
   against 3 007 167 kr).
9. **The table keys**: `Show the table` sits under the Balance's facts, and under every line and column
   chart; the allocation strip's legend prints every fund's value and share, so it has none.
10. **Pension and shares** are grouped under 15 px group heads only when two or more kinds of holding
    are present; with funds alone the pane is one run of sections, and the funds' section is `Funds`
    (`Holdings` under a `Funds` group head).
11. **About's This data** leads with `Example data:` and what was invented when the snapshot says
    `synthetic`, which is where the stock's banner sentence went (B18); `Stale after: 30 hours`.
12. **app.js's header comment** (the snapshot contract) writes the loan example as `modeled annuity`;
    the pipeline still writes `modelled` until the data follow-up (owner call 2).
13. **PROMPT.md** names the fallback category by its place in `categories.json` rather than by its
    label `Uncategorised`, which is the data's own word until the follow-up.
14. **NOTES.md** keeps the license's proper name, *Norwegian Licence for Open Government Data*, on one
    line, allow-listed by file and phrase in `check.mjs`; About says `NLOD, Norway's license for open
    government data (data.norge.no/nlod/en)`.
15. **The Balance is at most 420 px wide, left-aligned**: laid out over the pane's whole width on a
    phone on its side, the T drifted 600 px from its ruler (seen in the landscape picture).

**The camera.** Its strings stand: `Overview` and `Spending` are `<button role="tab">`, as before the
pass, now built by `buildTabs()` after the snapshot parses and validates, so the camera's wait for a
button named `Overview` proves the data loaded. The stored pane (`fin.tab`) is kept, so the camera's
`selectPane("Overview")` at the end still puts it back. **The camera needs no change.**

**Budgets, measured** (see the final figures in `ART.md` section 6 and the last `node tools/check.mjs`):
the code grew from 103 178 to 120 242 B (cap 200 000); fonts 40 075 B (cap 160 000); **the ZIP is over
its cap**, 128 025 B against 125 304 (2 721 B, 2.2 %), with nothing cut. Where it went, stored in the
ZIP: the face and its license 37 510 B, the app code 40 696 B (29 406 before), the shipped `.md` files
18 332 B (ART.md about 8 100 of them, after sections 8 and 9 moved here; 13 098 before the move). Per the lead's interim
ruling (D26) the builder stops here and reports the measured figure for the lead's ruling; `check.mjs`
keeps `ZIP_CAP = 125304` until the lead sets another, so its ZIP line prints FAIL until then.

**Phone checks** (not claimed; each on an iPhone with iOS 18 and one with iOS 26): the pane scrolling
inside the frame; a tap on the 1 px blocks (the card and car loan) and on the hollow; a vertical scroll
starting on a chart or on the Balance opening nothing; the stamp on a stale real snapshot; a delivery
while open, and a broken one; VoiceOver on the tabs, the Balance's label and a card; safe areas;
landscape; the search field's keyboard, and that focusing it does not zoom the page; the font loading
before the Balance measures its figure.

---

## After QA (the builder, 2026-10-02)

QA's verdict was **pass**, with no *must* and no *should*: two nits. Both are answered below; nothing the
app ships changed for them, except `ART.md` section 6, corrected in place.

1. **Nit: Savings' vertical-drag check had about 10 px of room** (at 390 × 844 the demo's Savings pane is
   barely taller than the frame, so the drag there scrolls 10 px where every other pane's scrolls 243 to
   253 px). **Applied in `tools/shoot.mjs`**: the widths stage now drags Savings' chart at 375 × 667,
   where the same pane has room, and asserts the pane moved more than 100 px, no card opened and nothing
   was said. It printed `ok   375 × 667: Savings, a vertical drag on its chart scrolls the pane by 187 px,
   opens no card and says nothing (B14, with room to scroll)`. The 844-tall check stays, labelled
   `(as far as it goes)` as before. **Proven to pin B14**: with `readout()`'s `pointerdown` changed to open
   the card on a touch's press (the stock behavior) and `SCHEMES=light node tools/shoot.mjs` run, both
   Savings lines printed `FAIL`, the 10 px one included, as did the Balance, Overview, Owned and Cash
   flow drags; `app.js` was then restored from a copy and its sha256 (`a8c2be29…eb56fb3`) checked
   unchanged before anything else ran. So the 10 px check was weak on the scroll, not on the card.
2. **Nit: one merchant in two cases** (`BAKERY` in Transactions, `Bakery` in Spending's *Where it went*).
   **Declined for the pass, recorded for the data follow-up.** Both are the data's own words:
   Transactions prints each transaction's `text` as the bank wrote it, and `scripts/finances.py` groups
   spending by `merchant_key(text)` and labels each group `titlecase(key)` (around line 1607), because
   one merchant reaches the bank under several spellings. Changing either is a pipeline decision, and
   the pass keeps the four data files byte-identical. **For the data follow-up** (with owner call 2's
   British words): decide whether a merchant label should keep the bank's case when every transaction in
   its group agrees, and whether NOTES.md should say in one sentence that *Where it went* groups the
   bank's text; prove either with `python3 scripts/make_demo_finances.py --check`.
3. **`ART.md` section 6 was out of date after D27.** It still said the ZIP was 2 721 B over its cap and
   that `check.mjs` printed `FAIL`; the lead's ruling had already raised `ZIP_CAP` to 131 000 B. The
   paragraph now says the ZIP is inside its cap, and the *As built* figure is the measured one. Because
   `ART.md` ships, its own figures change the ZIP; they were iterated to a fixed point (the figures
   written equal the figures `node tools/check.mjs` then measures): **ZIP 128 169 B, 2 831 B under
   131 000**; shipped `.md` files 18 476 B stored; code 120 242 B (unchanged by this stage); fonts
   40 075 B.

QA's own working files (`tools/.work/qa_drive.mjs`, `tools/.work/qa-shots/`) are under `tools/.work/`,
which `.gitignore` leaves out and the ZIP never holds.

---

## After review (the builder, 2026-10-02)

The final reviewer's verdict was **fix**: no *must*, six *shoulds*, eight nits. All six shoulds and all
eight nits are applied; none is declined. The data, its pipeline and the four data files are untouched
(`check.mjs` pins their sha256). The camera's strings stand (`Overview` and `Spending`, `<button
role="tab">`); **the camera needs no change.** Every new check in `tools/shoot.mjs` was proven to pin
its fix: the new `shoot.mjs` run with `SCHEMES=light` against a scratch copy of the folder holding the
pre-review `app.js`, `style.css`, `index.html` and `js/balance.js` printed `FAIL` on all seventeen of
them (the mark on four taps, the line's end, the focus ring, the last tab by touch and on launch, the
double draw, Owned's words, the one-fund strip, the search field, the example in 2027, the double
negative, the stamp with no data, three times); on this folder every one prints `ok`.

**Shoulds.**

1. **The example's relative days** (the card's due, consent ending, units set, a vest) count from the
   snapshot's own day (`today()` in `app.js`: `lastIso()` when `synthetic`, the phone's day otherwise);
   a stale source's "Last good read" counts from `generatedAt` on the example. The stamp adds the year
   once the data is from another year. `shoot.mjs` with the clock at 1 Mar 2027 prints no consent
   sentence, the bill `Due Tue 6 Oct, in 15 days` and the stamp `Example data. Updated 21 Sep 2026,
   07:12`. B3's check (the phone's local day at 00:30) now runs on a copy's own data
   (`synthetic: false`), where the phone's day still governs.
2. **The net-worth line's end**: the 4 px `--page` casing is drawn before the line, so it clears the
   gridlines and never the data; the dot (its own 2 px `--page` ring) sits on the last vertex. Checked at
   30 days, 90 days, 1 year and All (DOM order and the dot's center equal to the last point) and read in
   pictures: the 90-day rise into the dot is drawn.
3. **The Balance's selection mark**: a 1 px `--page` ring inset in a block whose ink is 5 px or taller
   (the home, the home loan); a 2 px ink tick, at least 6 px long, 2 px outside the column along a run,
   a thinner block or the hollow; cleared with the card. **The card hangs below the drawing** (or beside
   it when the screen leaves 300 px to its right, as on a phone on its side), so it never covers the
   other column: `showCard` takes optional spots in place of its three corners. `palette.py`'s ring
   check now measures a mark that exists.
4. **Focus rings in the scrolling rows**: `.tabs button:focus-visible, .words button:focus-visible {
   outline-offset: -2px; }`, as Global Weather's track. Checked: a keyboard-focused tab's ring lies
   inside its row.
5. **The chosen tab scrolled into view** (`showTab()` after `choose()` and at first boot): a touch on the
   visible part of `Transactions` leaves it whole in the row (300 to 382 of the row's 8 to 382), and so
   does a launch on a stored Transactions.
6. **One word, one number**: Owned's first series is `Value` in the legend, the card's row and the
   table's header (the aria label already said Value); the card's place reads `…, value less every debt`.

**Nits.** One draw per render: `watch()` draws once and redraws only when the width changes, and
`render()` disconnects every observer (switching to Owned makes one drawing for one chart). Debts beyond
what is owned print `Owed beyond what is owned 839 341 kr`, unsigned (the card too; VoiceOver's sentence
keeps `net worth minus …`). The hollow and its bracket end at the foot (55 px for 2 720 264 kr at 50 000
kr a pixel, test_balance's check 6), and a tap anywhere under the foot still reads the hollow. With no
usable data the stamp opens About (its prose and credits; This data hidden). The shape errors use curly
quotes, no backticks. One fund draws no allocation strip. The stamp's hint is `hidden`, so VoiceOver
reads it once as the description. The search field reads `Search text, account or category…`, named
`q`.

**Budgets** (`node tools/check.mjs`): code 123 733 B of 200 000; fonts 40 075 B of 160 000; **ZIP 129 764
B of 131 000** (1 236 B under), the app code stored 41 954 B (40 696 before these fixes), the `.md` files
18 813 B; ART.md's figures iterated to the fixed point they describe.

**For the lead** (outside this folder, so not touched): the clipped focus ring is probably family-wide
(Global Weather's `.layers` row, Running Dashboard's rows), and so is the stamp hint read twice (the same
markup in both). Also: Finances and Running Dashboard both open on a black block figure at the top of
their first pane (the reviewer's caution; not changed here).

**Phone checks** added to the list above (iPhone, iOS 18 and iOS 26): a tap on the Balance's 1 px
blocks shows the tick and the card below the drawing; tab-switch latency and memory after fifty range or
tab switches; the chosen tab scrolling into view; About's Close against Snuggery's exit control in full
screen.

## Moved from ART.md on 2026-10-02 by the lead: the budget paragraph's history, word for word

`ART.md` ships, and HOUSE.md's rule "What ships and what does not" keeps build history out of a shipped file,
so the lead moved this paragraph here after the final review and left the measured figures in section 6.

**The ZIP is inside its cap with nothing cut**: 129 764 B, 1 236 B under 131 000. Stored in the ZIP, the face
and its license take 37 510 B, the app code 41 954 B (29 406 before the pass; 40 696 before the review's fixes), and the shipped `.md` files 18 813 B.
The build first measured 128 025 B, over D5's 125 304; the lead raised the cap on that figure (D27,
`tools/DECISIONS.md`), and the record of that ruling here accounts for the rest.

---

## The data follow-up (2026-10-02)

Owner call 2, as D28 widened it (the British words, the merchant case, the example note's em dash), done after
the pass as the lead ruled (D26): the example rebuilt by its generator with its words in US English and its
note without a spaced em dash, the pipeline's own words swept with it, and `PROMPT.md` giving a copy's agent
the same rules. Every figure below was printed by a command run on this Mac. The throwaway scripts
(`structdiff.py`, `txnalign.py`, `dom.mjs`), the rebuilds and every tool's output are in
`tools/.work/data-followup/` (gitignored). Nothing in `app.js`, `js/`, `style.css`, `index.html` or `fonts/`
changed; no git command was run.

### The scripts

- **`scripts/make_demo_finances.py`** (15 lines): the invented bank's texts `CAR LOAN INSTALMENT`, `PETROL
  STATION` and `TAKEAWAY` to `CAR LOAN INSTALLMENT`, `GAS STATION` and `TAKEOUT`, capitals kept (owner call 3);
  the account `Holiday fund` to `Vacation fund`; the owned source's message `indexed and amortised by date` to
  `amortized`; the note `Example text — every account, …` to `Example text: every account, …`, its words
  otherwise the same; `validate()`'s `Uncategorised` to `Uncategorized`; the docstring's `Petrol station` and
  three comments (`amortise`, `modelled`, `amortisation`); the constant `HOLIDAY_TODAY` and the local
  `uncategorised` renamed `VACATION_TODAY` and `uncategorized`. The seed, every number and every draw untouched.
- **`scripts/finances.py`** (34 lines). What the example and a copy's own refresh write: the loans' basis
  `modelled annuity, …` to `modeled annuity, …`; the owned source's `amortised` (twice: `--no-banks` and the live
  run); the fallback category `Uncategorised` to `Uncategorized`. Its seven other spaced em dashes in words the
  app prints (Owned's basis line when the index or a curve fails, the note when SSB cannot match a name, and
  four messages a failed or stale source prints on Overview) become a semicolon or parentheses, the words the
  same, except the consent message: `the consent has expired — re-authorise with BankID` is now `the consent
  has expired; authorize again with BankID`, the app's own words since B22. The SSB attribution,
  `f"SSB {SSB_TABLE} — {described}"`, is unchanged. Twenty lines of prose (docstrings, comments, `--help`, log
  and exit messages): `amortizes`, `normalizes` (twice), `amortized`, `authorize` (three), `authorization`
  (three), `authorized` (two), `recognized`, `recognizes`, `Categorizing`, `labeled`, `artifact`, `modeled`
  (two), `amortization` (two); the local `modelled_loans` renamed `modeled_loans`.
- **The inputs the generator reads** (they ship, and `check.mjs` pins them). `categories.json`, 7 strings: the
  match strings that find the example's texts follow them (`LOAN INSTALLMENT`, `GAS STATION`, `TAKEOUT`),
  `FIBRE` and `GARDEN CENTRE` to `FIBER` and `GARDEN CENTER`, the fallback's label and the `_comment`'s
  `categorises` and `Uncategorised`. `assets.json`, 6 strings: `Estate car` to `Station wagon` (id `car-estate`
  kept), the home's variant `Flats` to `Apartments` (id `flats` kept, so a stored `fin.basis` choice still
  applies), `Modelled` and `modelled` in `_loans` and `_floatingRate`, `a three-year-old estate` and `a holiday
  property` in two notes on method. `holdings.json` had nothing to change and is byte-identical.
- **Beyond the brief's list, for the lead to keep or revert**: `Station wagon`, `Apartments`, `TAKEOUT` and
  `vacation property`, by the rule that took `Holiday fund` and `Petrol Station` (a British word for a thing US
  English names otherwise); `FIBER` and `GARDEN CENTER`, by the grep list's `centre`; and the seven dashes in
  the refresh's failure words, by the rule `PROMPT.md` now teaches (no spaced em dash in what the app shows),
  which the template's own refresh would otherwise break.

Checked where it can be without a bank or a network (`asset_value_on`, `loan_balance_on` and `Categoriser`
called from the scratch copy): `SSB index unavailable; holding the anchor value`, `depreciation curve is
degenerate; holding the anchor`, `modeled annuity, 43 of 84 payments made`, `('other', 'Uncategorized')`. The
four source messages and the SSB-match note sit in `run_live()`, `run_no_banks()` and the index fetch of
`build_assets()`: **not exercised** (they need a bank session or the network); `python3 -m py_compile` passes
on both scripts.

### Deterministic, and only words moved

- **Two runs, byte-identical.** `finances.py` reads its inputs from beside itself, so the edited scripts were
  copied into a scratch root beside the edited inputs (their sha256 equal to the in-place files', `73841ebc…`
  and `506cc4a7…`), then `python3 root/scripts/make_demo_finances.py --today 2026-09-21 --out-root <run1>`,
  and again into `<run2>`: both print `validate: ok`, `cmp` is silent, sha256 `2481554a…aae1c1` both times.
  The same harness with the original scripts and inputs rebuilds the shipped snapshot byte for byte
  (`5d1c30a3…085be0`), so the harness itself changes nothing.
- **The structural diff** (`structdiff.py`, then `txnalign.py` for the transactions), the four rebuilt files
  against the shipped ones: **55 strings changed; numbers, ids, dates, keys and array lengths changed: 0.**
  - `data/snapshot.json` (7 088 leaves: 4 413 numbers, 2 656 strings, 931 of them dates): 42 strings. Outside
    `transactions`, no key, length, type or number differs and 19 strings do. The 300 transactions, matched
    by date, amount, account, source and category, are the same 300 with 23 texts renamed and nothing else.
    The pairs: `CAR LOAN INSTALMENT` → `CAR LOAN INSTALLMENT` ×10 (5 transactions, the repeating charge, 4 rows
    of the ask table), `PETROL STATION` → `GAS STATION` ×14 (13 transactions, 1 ask row), `TAKEAWAY` →
    `TAKEOUT` ×5, `Car Loan Instalment` → `Car Loan Installment` ×2 and `Petrol Station` → `Gas Station` ×2
    (*Where it went* and its ask row), `Holiday fund` → `Vacation fund` ×2, `Estate car` → `Station wagon` ×2,
    `Flats` → `Apartments`, `modelled annuity, 54 of 300 payments made` and `…, 43 of 84 …` → `modeled …`,
    `… indexed and amortised by date` → `amortized`, and the note. 104 501 B (104 534 before); spaced em
    dashes 8 (9 before): the SSB line five times and the three asset notes.
  - `assets.json` 6 strings (6 532 B, 6 518 before), `categories.json` 7 (3 601 B, 3 604 before),
    `holdings.json` none.
  - **What the write touched beyond those strings: the order of 13 transactions within their days**, and only
    that. `assemble()` sorts by `(date, text)`, newest first, so a renamed text moves within its day: 13
    positions on 6 days (14 Apr, 29 Apr, 8 Jun, 8 Jul, 14 Jul, 25 Aug) hold a different transaction, every date
    stays at its position, and the cut at 300 keeps the same two transactions on its oldest day (4 Apr).
    *Where it went*, the repeating charges and the ask table keep their order.
- **The generator's own check.** Before anything was copied, over the scratch root: `check: the committed data
  is what the generator makes`; the new generator against the shipped snapshot: `check: problems [] | bytes
  match: False`, as it should. After the copy, from `Template/`: `check: the committed data is what the
  generator makes`.

### The merchant case: no change to the data

The app changes the case of nothing it prints: Transactions prints each transaction's `text`, *Where it went*
each merchant's `label` and the repeating charges theirs, as the data has them (`app.js` and `js/balance.js`
lowercase only to compare, as with a repeated word, a kind word or the search, and for one name inside the
Balance's VoiceOver sentence). So both cases are the pipeline's, and both stay, as the lead preferred: the
transactions, the repeating charges and the account names are the bank's text as it was sent (owner call 3),
while *Where it went*'s labels are the pipeline's own words, `titlecase(merchant_key(text))`, a name it makes
for a group of the bank's texts (dates, card numbers and long digit runs dropped, the first three words kept).
`NOTES.md` says so in one paragraph; `PROMPT.md` teaches it.

### What the copy changed

- `data/snapshot.json`, renamed into place from a staging copy after every check above had passed in a scratch
  copy of the whole app; `assets.json` and `categories.json` copied; `holdings.json` not written.
- `tools/check.mjs`: the pins `5d1c30a3…` to `2481554ae4fc5b2c818cca58d45f78be8cab50408638624e5e39b30233aae1c1`
  (`data/snapshot.json`), `03ff325a…` to `78df79dd193395e51b912ebe63a4b739008388dc263d0a55d54f19c2bba2164d`
  (`assets.json`), `7d6e4a2f…` to `07b65e5ef923cf5f0a8688056e3c0b753053985a4ce9ef5e8864720ab87282c8`
  (`categories.json`), `holdings.json`'s `6301079e…` unchanged; the item's words (`as the data follow-up rebuilt
  them`); the US-spelling allowance emptied (`ALLOW = {}`; it allowed `amortised`, `modelled`, `Instalment`,
  `INSTALMENT`, `categorises`, `CENTRE`, `Uncategorised` and `Modelled` by file); and the section-5 comment's
  `(from Template/finances)`, where the command cannot run, corrected to `(from Template/)`. **Proven to pin
  the sweep**: the new `check.mjs` over a scratch copy holding the old data fails on both lines (the pins:
  `changed: data/snapshot.json, assets.json, categories.json`; the spelling: `assets.json:75 Modelled,
  assets.json:77 modelled, categories.json:2 categorises, categories.json:9 INSTALMENT, categories.json:22
  CENTRE, data/snapshot.json:1 amortised, … and 6 more`).
- `ART.md`: section 3's quoted labels (`Apartments`); section 6's data row (the three new hashes beside
  `holdings.json`'s, and the rule: pinned, `--check` rebuilds the snapshot byte for byte), the ZIP row **129 764
  → 130 333** and its paragraph (`about 130 300`; the `.md` files `about 19 400`), iterated to the fixed point
  the figures describe. 129 764 was already stale before this follow-up: `check.mjs` measured 129 699 once the
  lead had moved the budget paragraph out. **The Balance's figures are unchanged**: `test_balance.mjs`'s whole
  output over the shipped data and over the rebuild is identical once `Holiday fund` and `Estate car` are
  mapped to their new names (the scale 50 000, the depths 115 and 60 px, every block's rows, the labels, the
  VoiceOver sentence).
- `NOTES.md`: one paragraph under *The example data is not data* (US English; the bank's capitals in
  Transactions; *Where it went*'s groups in the refresh's title case). It records no hash of the data.
- `PROMPT.md`: a section, *The words the app prints*, before Step 1, in the guide's voice: US spelling in every
  name and label the agent writes; no spaced em dash, the SSB basis line the one exception; the bank's names as
  the bank writes them, a `match` string spelled as the bank spells the text, and why one shop reads `BAKERY`
  and `Bakery`. Step 6 now names the fallback `Uncategorized` (departure 13 above named it by its place while
  the label was British).
- **The ZIP**: 129 699 → 130 333 B (+634: the data and the three JSON files store 29 552 B, 12 more; the `.md`
  files 19 370, 622 more); 667 B under the 131 000 cap.

### On screen

`dom.mjs` served each folder in headless Chromium (390 × 844, light, `shoot.mjs`'s clock; what the page draws,
never phone evidence) and read every pane, the Transactions list opened to all 300. Before, then after (the
real folder, after the copy):
- **Overview**: the statement `Example text — every account, …`, then `Example text: every account, …`; no
  spaced em dash anywhere on the pane after. `Holiday fund`, then `Vacation fund`.
- **Spending**: `Petrol Station` and `Car Loan Instalment` under *Where it went*, then `Gas Station` and `Car
  Loan Installment`; `Bakery` as before.
- **Owned**: `Estate car`, `Flats`, `modelled annuity` twice, then `Station wagon`, `Apartments`, `modeled
  annuity` twice; the one spaced em dash on the pane is the SSB line, before and after.
- **Cash flow**: `CAR LOAN INSTALMENT`, then `CAR LOAN INSTALLMENT`. **Transactions**: `PETROL STATION` ×13,
  `TAKEAWAY` ×5, `INSTALMENT` ×5, then `GAS STATION` ×13, `TAKEOUT` ×5, `INSTALLMENT` ×5; `BAKERY` ×30 both
  times.
- No console error or warning, before or after.

### Verified (2026-10-02, after the copy)

- `node tools/check.mjs` (from `Template/finances/`): `all checks pass` (39 lines `ok`; `the data: … as the
  data follow-up rebuilt them`; `ZIP size 130,333 bytes`; `US spelling in 13 shipped text files, the data's own
  words included`).
- `node tools/test_balance.mjs`: `all checks pass` (18 `ok`).
- `python3 finances/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`, no `SCREENSHOTS`: `all checks pass` (177 `ok`, 0 `FAIL`, exit 0);
  `screenshots/app.png` untouched and no screenshot rewritten. The same run over the scratch copy before the
  copy: 177 `ok`, 0 `FAIL`.
- `python3 scripts/make_demo_finances.py --check` (from `Template/`): `check: the committed data is what the
  generator makes`.

### Left alone, and why

- **The SSB basis line** (`SSB 07221 — Hele landet, …`): the NLOD attribution `NOTES.md` quotes.
- **Words the app never prints**: the example's asset and loan notes (`Example text — a round figure, not a
  purchase price`; the asset notes ride in the snapshot, and Owned does not print them), `holdings.json`'s
  `_account`, the prose of every `_` key in the three JSON files, the equity source's `vesting is a calendar,
  not a feed — …` (a derived source's message is never printed; About lists each source's state and time),
  log and exit messages, comments.
- **British-flavored words in US use**: `CORNER SHOP`, `BOOKSHOP` and the other `… SHOP` names, `CHARGING
  POINT`, `PUBLIC TRANSPORT`, `LUNCH BAR`, the category `Transport`, `Everyday account`, `MOBILE PHONE PLAN`,
  `HOUSING COSTS SHARED`, `CHILD BENEFIT`; and match strings for texts European terminals send that the
  example never writes (`CAR HIRE`, `GREENGROCER`, `SERVICE CHARGE`, `GROUND RENT`). Whether the US-market
  example goes further (`CORNER STORE`, `PUBLIC TRANSIT`, `CHARGING STATION`, `Checking account`) is an owner
  call.
- **Keys and the module's class**: the snapshot key `unrealised` (investments and equity; structure, named in
  `app.js`'s contract), the class `Categoriser` (the generator imports it as `fin.Categoriser`), the ids
  `car-estate` and `flats`; the NLOD's proper name (*Licence*) in the generator's comment.
- **`PROMPT.md`'s and `NOTES.md`'s own spaced em dashes** in their prose from before: the rules were added;
  sweeping the guides is a separate edit, as Running Dashboard's follow-up left its own.
- **`check.mjs`'s spelling pattern** knows no vocabulary (`holiday`, `petrol`, `estate car`, `takeaway`,
  `flat`) and no `fibre`; widening it is family-wide, the lead's.
- **Outside this follow-up's files**, for the lead: `app.js`'s contract comment still quotes `"note": "Example
  text — a round figure, not a valuation"` and `("index unavailable — holding the anchor value")` (the refresh
  now writes `SSB index unavailable; holding the anchor value`); `docs/MANUAL_STEPS.md` line 3353 still lists
  these faults as pending; `App/Snuggery/Resources/StarterPack/live/finances.zip` (20:05) and
  `screenshots/*-{light,dark}.png` (19:50) were made before the copy (20:28), so they carry the old words
  (`Holiday fund` on Overview, `Petrol Station` on Spending).

### Phone checks this adds (not claimed here)

On an iPhone with iOS 18 and one with iOS 26: Spending's `Car Loan Installment` and Overview's `Vacation fund`
rows at the largest accessibility text size (each name now longer); VoiceOver reading Overview's `Example
text: every account, …` as one statement; Owned's `Apartments` valuation word at the largest text size; on a
real copy, a stale or failed source's message with its new punctuation (`Bank: the consent has expired;
authorize again with BankID.`).

---

## Plan 0012 package 4: the pane-app register, the pilot (the builder, 2026-10-08)

The brief is `docs/plans/0012-the-owners-brief-of-2026-10-06.md` (D5, *"Yes, as prototyped"*; D6, gray),
`Template/HOUSE.md` §4.15, §11, §12 and §13 as amended on 2026-10-06, and `docs/plans/0012-change-lists.md`:
*Shared steps, every app (F)*, *the six pane apps (P)* and *Finances* (items 1 to 19), plus plan 0011's three
owed items (P9). The approved prototype (`docs/plans/0012-prototypes/finances.patch`) was the target picture,
built properly rather than pasted: the band deleted, not hidden; the checks moved where the register moved
what they pin. Bugs on record: none open (plan 0009 item 5 names no Finances bug, nothing under
`docs/review/` names the app, matrix rows 166 and 174 are phone rows, not yet run); B1 to B25 stay fixed and
`check.mjs` still pins them. The data, its pipeline and the four data files are byte-identical (`check.mjs`
item 5). No git command was run.

### What changed, by the list

- **F1, P1. The band goes.** `footer#band` with `#capline` and `#credits` deleted from `index.html`;
  `caption()` and its call in `render()`, the `capline` write in `fail()`, the `.band`, `.capline` and
  `.credits` rules (and their 700 px and landscape variants), and `'band'` from `about()`'s inert list. The two
  credit constants are unchanged and written once, in `boot()`, into `<p id="about-credit-line"
  translate="no">`, the first child of About's *Sources and credits*.
- **F5.** `NOTES.md`: "the credits under every pane" → "the credits in About". `PROMPT.md` (ships): the same,
  and "the file's own Example text note is on Overview" → "opens About's This data"; its Overview sentence now
  starts on the net worth. `ART.md` rewritten where the register changed what it describes (item 18).
- **F6.** `miniapp.json` 1.1 → **1.2**; `check.mjs` item 6 now pins `'1.2'` (it pinned no version before).
- **F8.** `shoot.mjs`: no `#credits` and no band on the front, About's first *Sources and credits* paragraph
  equals the constant; the band-height check deleted; the stale case reads the real constant from About; the
  widths stage's caption-height check deleted. The stamp is measured one line, 16 px, in every state it
  writes: the example (`Example data. Updated 07:12`), the longest (`Example data. Updated 21 Sep 2026,
  07:12`), a copy's own data fresh (`Updated 07:12`) and the next night (`Updated 21 Sep, 07:12`), `Stale.
  Updated 21 Sep, 07:12` and `No usable data`.
- **P2.** `ABOUT_KEY` and `aboutKey()` as the list gives them. **Departure:** called once, by `render()`, right
  after the pane is built, instead of at the end of each of the six pane functions and `empty()`: the same
  result (every pane and every empty pane ends with it), one call instead of seven. `check.mjs` item 18 pins
  that call; `shoot.mjs` checks on every pane that the key is the last child, at least 44 px tall and 14 px
  under the last section, and that a tap on it opens About and Escape gives focus back to it.
- **P3. Plates.** `.sec` as the list (bottom padding 8 px: the last row pads itself); headings 15 px 650; the
  hairline between sections gone; `.panebody` pads `calc(28px + env(safe-area-inset-bottom))` (one
  declaration, pinned). Every halo, casing, dot ring and the Balance's selection ring take `--sheet`, in the
  CSS and in the two `stroke` attributes `app.js` wrote as `var(--page)` (the line's casing, the Balance's
  ring); `shoot.mjs`'s `markOf()` reads the ring by `var(--sheet)`.
- **P4, item 14. The key number.** `figure()` now builds a plate (`sec(null)` with class `headline`) holding
  `.hl`: `.hl-what` 12.5 px, `.hl-fig` 34 px 650 line 1.05, `.hl-lead` (or a node, Overview's `.hl-chg`) at
  13.5 px, and returns the plate, so Owned's and Savings' tiles sit on the same plate. **Departure:** the
  list kept the old class names `.fig`, `.fig-what`, `.fig-lead` restyled; one set of names for Overview and
  the other panes is less CSS, so `.figure`/`.fig*` are gone and `shoot.mjs`'s Spending check reads `.hl-*`.
- **P5, item 15. Tiles.** `.facts` a two-column grid, 14 px apart; a tile's label 11.5 px `--ink-2`, its value
  19 px 650, its note on its own line at 11.5 px; parted by `--line`.
- **P6, item 4.** `--own`, `--owe`, `--up`, `--down` after `--amount`, light and dark, HOUSE §11.2's values.
  `palette.py` emits them in `--json` (11 tokens a theme; `check.mjs` item 13 pins 11) and gains check 7:
  text contrast on both grounds equal to HOUSE §11.2's figures, owned/owed apart under all four visions, the
  direction pairs equal to HOUSE's and printed as allowed only beside a sign. Its checks 4 to 6 now measure
  the Balance on its plate (blocks 6.29 / 5.49 light, 7.68 / 7.24 dark; the ring against each).
  `ALL CHECKS PASS`.
- **P7.** Allowed sizes 10.5, 11, 11.5, 12.5, 13.5, 15, 19, 21, 34 and the search field's 16; 34 px only on
  `.hl-fig`, 21 px only on the card's value (pinned).
- **P8.** Already true: `Example data.` leads the stamp in place of `Stale.`; `Stale.` is proven on a copy of
  the data with `synthetic: false` (`B4: real data two days on`).
- **Items 6 to 13 (Overview, as the prototype).** The headline plate (`Net worth, 21 Sep`, `2 720 264 kr`,
  `+16 492 kr in 30 days`, `+395 314 kr in a year`; `Change: not enough history yet` when there is no 30-day
  change, as the old facts row said); the Balance's blocks `blk-own`/`blk-owe`, its head words in their
  colors, its figure at 15 px, its method sentence deleted; the sides table (`OWN_GROUP`, `sideRows()`), the
  four facts and the Balance's `Show the table` deleted; To pay moved straight after the Balance; the notes
  loop deleted from `statements()` and `snap.notes` written into `<p id="about-example" hidden>` before This
  data's list (hidden when the file has none); the net-worth chart's caption and toggle deleted; Accounts'
  meta type first, then the mask, no source label (`sourceLabel()` deleted, it had no other use), a debt's row
  `debt` with its amount in `--owe`, the empty state kept; rows 9 px, amounts 15 px 600.
- **Item 16. The captions.** Deleted as listed; moved to About's *How the numbers are made*: `On Owned's chart,
  every debt counts the card too; the gap is net worth less cash and savings.` (after the paragraph on the
  home and the loans; "On Owned's chart," added so the sentence reads without the chart beside it),
  `Repeating lists the charges that landed on a regular rhythm, as the bank writes them.` (after Cash flow)
  and `Employee shares still to vest are valued at today's price; what they are worth depends on the price on
  the day, and tax comes off it.` (its own paragraph). Kept: the NAV line, the share price and Norges Bank's
  rate, the pension's state line.
- **Item 17.** `tone()` and `signedFig()`: a figure `krs()` prints with its sign takes `up` or `down` by
  its rounded sign, zero neither. Used by the headline's changes and by `changeSub()`, the sub line of an owned
  item, a fund and a pension account (`+559 605 kr, +12 %`, the amount colored, the percentage not). The pair
  charts keep `--series-1`/`-2`; nothing else gains a color.
- **Item 18.** `ART.md`: the rule "Money's direction is never a color" replaced by the meaning-color table
  (HOUSE §11.1 rule 5, §11.2's figures); section 1 (colors, the plate, the 15 px figure, the sides table in
  place of the caption), section 2, section 3 (plates, the key number, tiles, rows, statements, Overview's
  order, the About key, About's contents, the centered header, the slide), section 4 (the scale), section 6
  (the budget), section 7 (tells 1, 3, 12, 14). The intro says the register binds it.
- **About's Balance paragraph** said "The T at the top of Overview … Each block of ink"; it now says "The T on
  Overview, under the net worth, … what is owned on the left, in blue, and what is owed on the right, in
  orange. Each block is …". About's `p + dl` gains the 8 px its `p + p` has.

### P9, plan 0011's three owed items

1. **The pane centered with its header on wide screens.** `.head`'s sides are `calc(max(16px, 50% - 364px) +
   env(safe-area-inset-…))`, so on a screen wider than 760 px the name and the tabs start where the pane's
   760 px column puts its plates (the old 700 px rule's 20 px is gone, which also aligned them from 700 to
   760 px). `shoot.mjs`'s widths stage gains `wide (1024 × 768)` and checks at every width that the name starts
   where the first plate does, and above 760 px that the column is centered: 148 and 148 px, the column 148 to
   876 of 1 024.
2. **A passive `touchstart` listener**, empty, on the document, so iOS draws `:active` (the text keys'
   pressed tint; the About key's `:active` ink, new). Pinned by `check.mjs`; the tint itself is a phone check.
3. **The scrub-race check.** Finances has no time player; its scrub is the sideways slide along a chart. Per
   theme, `shoot.mjs` slides along Overview's net-worth line by CDP touch at 3 px and at 9 px a move, and after
   every move waits until the page has received it (`window.__fx`, as Outdoor Window's and Power Hours' do),
   then one frame, then checks that the cursor and the card name the day under the finger; the lift leaves the
   card pinned and says nothing (a tap still says it once).
   **It found a bug, fixed here.** On the first run the card froze on one day (`25 Jul`) a third of the way
   along and stayed there, the lift included. The trace: the earlier range clicks had left Playwright's mouse
   resting on `90 days`; when the card moved to the plate's lower left it slid under that resting mouse, the
   chart's hit layer got the *mouse's* `pointerleave`, and `readout()` reset `down` for the finger's slide.
   Any second pointer can do that (an iPad's trackpad pointer resting on a chart). `readout()` now records the
   reading pointer's id in `open()` and a `pointerleave` from any other pointer while it reads is ignored. The
   new check, run against a scratch copy holding the old handler, printed `FAIL … 29 right, 51 wrong: 32:Sat
   25 Jul 2026 …` and the 9 px pass `11 right, 17 wrong`; on this folder `80 right, 0 wrong` and `28 right, 0
   wrong`, both themes.

### Found while looking, fixed

- **The Balance overflowed its plate at 320 px.** Its floor of 280 px fitted the bare page (288 px) but not a
  plate (262 px): the figure under the double rule ran 18 px past the plate's edge
  (`tools/.work/shots/overview-320-light.png` before the fix). The floor is now 240 px (`js/balance.js`'s
  layout already narrows its columns under 340 px; test_balance tests 288 and 358). The widths check now
  also requires the drawing inside its plate.
- **Transactions' days on plates** (beyond the list): each day's rows are a plate under its date heading,
  as Savings' sections sit under their group heads; without it the busiest pane was the one without plates.

### Checks changed, and why each

`check.mjs`: item 6 pins 1.2; item 8 rewritten (F8; also: no credit words in `index.html` before About, and
in `app.js` only inside the two constants); item 13 counts 11 tokens; item 14's type sizes (P7); B17 (the
register's rule: `'up'`/`'down'` only in `tone()`, `tone(` only in `signedFig()`, `--up`/`--down` only on
`.up`/`.down`, a debt's `--owe`); B18 extended to `#about-example` and the notes read once, in `boot()`; item
16's cap; new item 18 (the About key, the pane's foot, plates and `--sheet` strokes, the centered header,
`touchstart`). Each new or changed check was run against the before copy (`tools/.work/before/finances`): ten
lines print `FAIL` there (version, credits, tokens, sizes, B17/B18, the key, the foot, the plates, the header,
`touchstart`). `shoot.mjs`: as F8 above, plus the register on Overview (the key number at 34 px with its
changes in `--up`, the sides' totals and rows against this file's decode, their head colors, the plates'
order, no example sentence on the pane, a debt in `--owe`), the Balance's pixels sampled as `--own`/`--owe` on
the plate (was ink on the page), its figure 15 px, the ring `--sheet`, About's credit and example paragraph,
the About key by touch, the scrub, the stamp's line, the wide screen; B10's row picked from Accounts, since
To pay's row with the same name now comes first. 177 `ok` before, 214 now.

### Owner calls this leaves (each reversible)

1. **About's This data says the example twice**: the data's own `Example text: …` paragraph (item 10) and the
   list's `Example data: …` line (B18). Dropping the list line would also drop B18's pin on it.
2. **A real copy's job notes** (`House-price index unavailable; …`) now read in About, not on Overview (item
   10 applies to every note, not only the example's). The home's basis line on Owned still says the
   fallback where the number is.
3. **Transactions' days on plates** (above).
4. **A slide's lift says nothing**, as before the pass; a tap says the card once.
5. **The prototype's choices kept**: `Bank accounts` for one account or several; the depreciation of a car
   in `--down` (`−149 927 kr, −44 %`), which is true and reads as a loss.
6. **The pointer fix** changes nothing a single finger or a single mouse does.

### Budgets (`node tools/check.mjs`)

App code **126 632 B** of 200 000 (123 706 before: `index.html` 6 084, `style.css` 16 246, `app.js` 87 048,
`js/units.js` 7 867, `js/balance.js` 9 387). Fonts 40 075 B of 160 000. **ZIP 133 193 B** (130 333 before),
inside the lead's ruled cap for package 4, **162 916 B** (130 333 × 1.25, rounded down; the app's own 131 000
of plan 0011 D27 was tighter, so it rose to the house rule; `ZIP_CAP` set with that reason). Stored in the
ZIP: data and the three JSON files 29 552, fonts 37 510, app code 43 272, `.md` files 20 912. Nothing cut.

### The camera

`MarketingShotsUITests.swift` 340-344 opens `Finances`, waits for the button `Overview` and taps `Overview` and
`Spending`: all three untouched (`buildTabs()` was not changed). **The camera needs no change.** The new
About key is a button named `Sources, method and credits are in About.`; nothing waits for it.

### Phone checks this adds (not claimed here; an iPhone on iOS 18 and one on iOS 26)

Matrix row 174 (the About key above the home indicator in full screen, both orientations) covers the foot.
New: the pressed tint on `Show the table` and on the About key when held (the `touchstart` listener); a
sideways slide along the net-worth line reading every day under the finger, and on an iPad with a trackpad
pointer resting on the chart; the plates' edges and the meaning colors in sunlight in both themes; the
headline's 34 px figure at the largest accessibility text size; Overview at 320 px wide (iPhone SE in
Display Zoom) with the Balance inside its plate.

## Plan 0012 package 4: the fixer's pass on QA's and the reviewer's findings (2026-10-08)

### Taken

- **A signed change under a key number is colored on every pane** (the reviewer's should, option (a)). Owned's
  lead (`+118 400 kr in value over a year, before the loans moved`) and Savings' (`+18 504 kr, +18.3 % on
  what was paid in`, and the granted-shares form `… above what was paid; …`) are now built by `changeLine()`
  as net worth's are: the amount through `signedFig()` in `--up`/`--down`, the words and the percentage plain.
  Before, Savings showed `+18 504 kr` in ink in the lead and in green on the fund row of the same first screen.
  Option (a) over (b) because it is the smaller change and matches HOUSE 11.1 rule 2 (a key number's change
  sits right under it), and B17's rule is untouched: `up`/`down` still come only from `tone()`, `tone(` only
  from `signedFig()`. Spending's comparison (`1 234 kr less than the 30 days before`) is words, unsigned, so
  it stays ink. `ART.md`'s `--up` row and its key-number paragraph say so. `shoot.mjs` gains one check per
  theme: each lead's amount in its direction's token, its words in ink, Owned's figure against this file's
  sum of `change365d` (two checks a theme: 214 `ok` became 218).
- **Another pointer no longer moves or ends a read** (the reviewer's nit, free). `readout()`'s guard covered
  `pointerleave` only; `pointermove`, `pointerup` and `pointercancel` from a pointer other than the reading one
  are now ignored while a read is down. Checked in WebKit and Chromium with synthetic pointer events (mouse 1
  reads, pointer 2 moves to 80 %, lifts and cancels: the card holds, then follows pointer 1 again); the scrub
  check is unchanged (80/0 and 28/0 in both themes).
- **The key number's label is the pane's first heading** (the reviewer's nit, free). `.hl-what` is an `h2` at
  its old size and weight (`font-weight: inherit`), so VoiceOver's heading rotor starts at `Net worth, 21 Sep`,
  `Owned, less what is owed on it`, `Invested` or `Spent, …`, not at `To pay`. Pixels unchanged (WebKit
  and Chromium, both themes, read by eye).

### Declined here, and why

- **Matrix rows, HOUSE §8's budget row, HOUSE §11.3's Finances line, the starter pack's version** (QA's should,
  the reviewer's second should): all outside this folder, which is the only place this pass may write. Handed
  to the lead with the figures below.
- **Display rounding** (Owned's tile 3 007 167 kr against rows that sum to 3 007 168; `+18.3 %` against `+18 %`):
  optional, existed before the pass, each figure correctly rounded. Recorded, not changed.
- **A debt's `--owe` on Overview but not on Owned's Loans, and the Balance left of center on a wide screen**: the
  reviewer asked for no change in the pilot; a family rule for the lead.

### Budgets after this pass (`node tools/check.mjs`)

App code **127 140 B** of 200 000 (`app.js` 87 534, `style.css` 16 268). ZIP **133 546 B** of the ruled 162 916.

### The camera

`Overview` and `Spending` untouched (`buildTabs()` unchanged); nothing the camera waits for moved.
