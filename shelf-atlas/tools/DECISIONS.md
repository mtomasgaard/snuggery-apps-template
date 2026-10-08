# Shelf Atlas: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look as built; this file
holds the record: the lead's rulings, the owner calls as the pass left them, the as-built departures,
the after-QA, after-review and after-follow-up sections, the phone checks. Plan 0011 package B, D1 to D5
and HOUSE.md are the brief. The builder's step 24 moves `ART.md`'s sections 8 and 9 here, word for
word, below this section; nothing above the first `---` is to be overwritten.

## The lead's ruling on the code cap (2026-10-02, plan 0011 D15)

**The cap is the house's 200 000 B**, not the app's own 150 000 B. The 150 KB in `NOTES.md` was a
target the app's author set and no build or check ever enforced (`scripts/shelf_atlas/build_north_sea.py`
holds only the three data files; B14). The house modules every app now carries (`js/units.js`,
`js/track.js`, the card, Find as a dialog, focus mode) take the art pass's estimate to about 171 000 B,
and holding 150 000 would cut Find, the details sheet's lists, the history chart and keyboard pan
(owner call 1) for nothing a phone would notice: Anatomy runs at 116 467 B, Global Weather at 202 709.
The precedents are Milky Way (240 000 then 242 000) and Besseggen (227 000), each ruled above the house
cap because the app was already over it; this app sits under it, so the house's own figure is the
ruling. `check.mjs` enforces 200 000 B; the build corrects `NOTES.md`'s statement; nothing is minified
or stripped of comments to fit (HOUSE 8).

---

## Moved from ART.md at step 24, word for word (sections 8 and 9 as the art pass wrote them)

## 8. The change list (the builder applies these in order)

Nothing in `data/`, in `scripts/shelf_atlas/` or in `screenshots/app.png` changes; the snapshot
and the loop are untouched. **This pass writes no pipeline file.** The app's text the pipeline
generates (each source's name, license, attribution and cadence in `snapshot.sources`; the names in
`geo.json`) is printed as data. Its British spellings are allow-listed by file and word in
`check.mjs`: in `snapshot.json` the sources' license key and values, Sodir's cadence sentence and an
operator's name; in `geo.json` pipeline and platform names, an operator's name and the bathymetry
entry's encoding note (base64 and polyline strings are skipped). The code that reads the sources'
license key keeps its British spelling too, since it is the data's key (HOUSE 6.3), allow-listed in
`js/data.js` and `app.js` by that one word. The attribution strings are license text and stay
verbatim. Before step 1, record the data's hashes (below); `check.mjs` pins them.

```
a97b5bf5e64900ca241628c0f8b10c90256f3bf7c5b75929288d206eb9fb4b51  data/bathy.png
c9d897206df0d74e76f803f4ef16b26734acf0dcb88d4c6ce43cc50f253ff623  data/geo.json
367aca9db92e8d009f205f99fa2b869c595dd234c79e4835607d7db76f6cf1e5  data/snapshot.json
```

**The bugs on record and found here, which this pass must fix.** The review records hold none for
this app: plan 0009 item 5 names Norne, World Oil & Gas, Milky Way and Global Weather; `grep -rn -i
shelf docs/review/` finds only the Library's Recents shelf; the app has no `DECISIONS.md`, and
`NOTES.md` and `HANDOFF.md` record data gaps, not app bugs. Reading the app and its data as a
stranger found these. Each is a must, and each names its evidence.

- **B1. Norwegian names are shown double-encoded.** 316 strings in 209 pipeline and facility records
  of `data/geo.json` carry UTF-8 read as Latin-1: `Ã\x85SGARD A` for ÅSGARD A, `VÃ¥r Energi ASA`,
  `KÃ\x85RSTÃ\x98` (`python3 tools/.work/peaks.py`, last line; every one repairs by one latin-1 to
  utf-8 round trip; `snapshot.json` has none). The card shows them as typed, and a platform's
  `Show Åsgard` key never appears, because `unitByName()` cannot match the garbled field name. Cause:
  `scripts/shelf_atlas/common.py` line 388 reads every shapefile's DBF with `encoding="latin1"`.
  **Fix in the app, not the data**: `repairText()` in `js/data.js`, applied once at decode to the
  pipelines' `name`, `from`, `to` and the facilities' `name`, `field`, `operator`, `kind`, acting only
  on strings that match `/[\u00C2\u00C3][\u0080-\u00BF]/` and round-trip as UTF-8, so it is a no-op
  once the pipeline is fixed (owner call 8). `test_decode.mjs` proves all 316 repair and no other
  string changes.
- **B2. The newest months read as a collapse.** Play runs to Aug 2026, which only Denmark has
  reported (`peaks.out`, first line: UK to Jun, NO and NL to Jul), so play ends on a map of a few
  Danish circles; a cross-border unit is drawn from one side when the other has not reported (the
  stock `computeMonth()` sums the sides it has). The camera's README note records the first
  (`MarketingShotsUITests.swift` lines 728–733). Items 9 and 10: play stops at the common month;
  a unit is drawn only when every shown side has reported; the caption names what is missing.
- **B3. The credit line is cut off.** It is a nowrap button with `text-overflow: ellipsis`, cut to
  `… Sodir NLOD · …` at 320 and 390 px (538 px of words in a 300 or 370 px box, measured by
  `scrollWidth` in headless Chromium; whole from 538 px), so on a phone held upright NSTA, the Danish
  Energy Agency and NLOG are never on screen (NOTES: "the credits line on the map … carry these strings"). Item 10.
- **B4. Controls under 44 x 44**: 21 (`look.log`'s `small` list). Items 6 to 13; `shoot.mjs` counts.
- **B5. No Reduce Motion, About does not hold play, hidden does not stop it** (`grep -n
  "reduced-motion\|pagehide" app.js style.css` finds nothing; `showAbout()` leaves `playing`). Items 9
  and 14.
- **B6. VoiceOver speaks every month of play**: `#month-label` carries `aria-live="polite"`
  (`index.html` line 118) and `updateTimeUI()` rewrites it on every step. Items 6 and 9.
- **B7. Numbers and dates break SI and the house's forms**: `408k`, `1.19bn`, `117k Sm³/d`, `85.47%`,
  `.5×`, `30″ (762 mm)` with the inch first, `61.255° N` without U+202F, `9/26/2026, 10:51:07 AM`
  (`toLocaleString()` in About, the phone's locale). Items 3 and 10 to 14.
- **B8. Middle dots, an arrow, em dashes and tracked capitals in the app's own strings** (section 7).
  Items 7 and 16.
- **B9. VoiceOver cannot hear the stamp's date or the credits**: the `aria-label`s on the stamp
  (`About this data`) and on the credits (*Sources and* the British plural) replace their words
  (`index.html` lines 21 and 97). Items 6 and 11.
- **B10. About's dates come from the phone's locale** (B7) **and its addresses carry their scheme**
  (`https://…` in the fallback `allSources()` entries in `app.js` lines 1346–1347, which HOUSE 7.1
  item 2 forbids in a shipped script, and every source's printed `url`). Item 14.
- **B11. The accent blue, red, glass and shadows** (section 2). Items 7 and 8.
- **B12. The sheet's drag and stops cover half the plate** with the field's details whenever a field
  is tapped (`tools/.work/look/light-3-statfjord.png`). Items 6, 7 and 12.
- **B13. A touch stops a flight midway** (`canvas` `pointerdown` sets `fly = null`), where the house
  ends it at its destination. Item 14.
- **B14. `NOTES.md` misstates the budgets**: "`geo.json` ≤ 2 MB … app code ≤ 150 KB … enforced by the
  build", where the build enforces 2 500 000 B for each JSON file and nothing for the code. Item 17.

**The steps:**

1. **`.gitignore`** (new; written by this art pass): `tools/.work/`, `tools/node_modules/`, `dist/`,
   `.DS_Store`.
2. **`fonts/`** (new): copy `../global-weather/fonts/ysabeau-office-gw.woff2` and
   `../global-weather/fonts/OFL.txt` byte for byte (`cmp` both). No supplement.
3. **`js/units.js`** (new), the one writer of numbers, units and dates, on Global Weather's pattern:
   U+2212 for negatives (never −0); U+202F between number and unit and in thousands from four digits
   (`408 000 Sm³/d`, `1 038 m`; years, months, ids and codes never grouped); rates and volumes to
   three significant figures, words from a million (`1.02 million Sm³/d`, `82.9 billion Sm³`); both
   systems (`Sm³/d`, `Sm³`, `Sm³ o.e./d`; `bbl/d`, `scf/d`, `boe/d`, `bbl`, `scf`, `boe`; the
   factors `BBL` 6.2898 and `SCF` 35.3147 as today); percentages `85.47 %`; coordinates
   `65.064° N, 6.725° E`; lengths `308 km`; diameters `762 mm (30 in)` in SI, `30 in (762 mm)` in US;
   months `Jun 2026` and `June 2026` (spoken); the stamp's `26 Sep, 10:56`; About's `Sat 26 Sep
   2026, 10:56 (UTC−7)`; legend ticks with open ends `≤ 42`, `≥ 134 000`; spoken forms (`standard
   cubic meters a day`, `barrels of oil equivalent a day`, numbers without group spaces). `toFixed`
   and `toLocaleString` appear nowhere else but the allow-list `check.mjs` names (the legend's CSS
   percentages).
4. **`js/data.js`** (new, pure, no DOM): moved from `app.js`, not rewritten: `mercY`, `unmercY`,
   `decodeLine`, `decodeSeries`, `validateGeo`, `validateSnap`, `daysIn`, `monthly`, `cumAt`,
   `titleCase`, `sentenceCase`, `normStatus`, `hcLabel`, `fold`, `mediumClass`, `shortSource`; added:
   `repairText` (B1), `bestRecords(series)` and `bestAt(records, month)` (section 1), the reporting
   months per country. `app.js` imports it; `tools/test_decode.mjs` tests it.
5. **`js/track.js`** (new): Global Weather's track adapted (section 3): 668 steps, no per-step ticks,
   year and decade ticks and labels measured apart, no `now`, Page Up and Page Down twelve,
   `role="slider"` with `aria-valuetext`, drawn into a cached canvas per size and theme, the thumb on
   top.
6. **`index.html`**: `lang="en-US"`; the viewport as today (no `user-scalable`); `<meta
   name="color-scheme" content="light dark">`; two `theme-color` metas carrying each theme's
   `--page`; `<script type="module" src="./app.js">`; the column: the header (`h1`, the stamp with its
   hidden description, `Find`, the units key, the row of words as two radio groups with `Rate` and
   `Cumulative` written as today); the plate (the canvas, focusable, with its description; the key
   column; the card; the notice; the ghost key); the caption band (the stamp's focus-mode slot, the
   legend, the caption line, the credits as a `<p>`); the sheet slot (Details, Map layers); the player
   (the time row without `aria-live`, `Back one year`, Play with its two marks, `Forward one year`,
   the track); Find and About as dialogs with About's static sections; the live region. The stock
   `.toolbar`, `#chips`, `.mapbtns`, `#layers`, `#legend` button, `#credits` button, `.sheet` with its
   grip, `#btn-speed` and `<input type="range">` go.
7. **`style.css`**: rewritten as the house stylesheet for this app: the HOUSE 3.1 tokens in both
   themes and `color-scheme`; `html, body { background: var(--page) }`; `--face` only, the one
   `@font-face`; this app's four tokens (section 2); the frame, header, the row of words and its
   tracer, the key column and its states, the caption band, the player, the track, the card and its
   three kinds, the sheet and its rows, the Layers samples, Find and its clear key (with
   `::-webkit-search-cancel-button { appearance: none; -webkit-appearance: none; }`), the chart and
   its key, the members table, About, notices, the ghost key; landscape at `(orientation: landscape)
   and (max-height: 500px)`; the sheet as a column at `(min-width: 820px) and (min-height: 480px)`;
   gutters 20 px from 700 px; `@media (prefers-reduced-motion: reduce)` zeroing every duration;
   `@media (hover: hover)` hovers; `touch-action: manipulation` and `-webkit-tap-highlight-color:
   transparent` on controls. No `box-shadow`, `backdrop-filter`, `transition: all`, uppercase or
   letter-spacing; `.valid, .lead, .track, .track canvas` (the month, the lead, the track) carry
   `transition: none; animation: none`.
8. **`app.js`, the plate**: `THEMES` replaced by `python3 shelf-atlas/tools/art/palette.py --json`,
   pasted, with the keys `buildPalette()`, `drawStatic()` and `bathyCanvas()` read (`ramp` now 17
   stops; `idle`, `shutFill`, `prodFill`, `rim`, `pipes` with their alphas; `ring`); the selection in
   `--ink` over its halo, as an outline and a registration mark of four 4 px ticks around the unit's
   `max(disc, ring)` (no circle, so it is never read as a ring); *other* pipelines dotted; platforms
   in their new tones; the rings (section 1: records, the floor, reporting gaps, the stroke, the
   order); hits and label placement against `max(disc, ring)`; names in `"Ysabeau Office"` 11.5/560
   on the halo, measured after the face loads, kept out of the card's, the key column's and the ghost
   key's rectangles; the theme change rebuilding the palette, the bathymetry tint and the track's
   tokens once.
9. **`app.js`, the player**: `wanted` and `shown`; the frame computing the newest wanted month and
   then writing the time row, the lead, the caption, the card's dynamic rows, the chart's cursor and
   `aria-valuenow` from `shown`; play on the clock at 12 months a second, stopping at the newest month
   every shown country has reported (B2), Play there restarting from Jan 1971; About, Find, a touch on
   the track and hidden stopping or holding it; the year keys with their live sentence; the Play key's
   two marks toggled with `toggleAttribute('hidden', …)` on the SVGs' wrapper (HOUSE 4.6); `aria-live`
   off the month (B6); the dirty check and its counter in the hook; units drawn only when every
   shown member has reported the month (B2).
10. **`app.js`, the caption band**: the legend (title, the bar from the same 17 stops over `--sea`,
    decade ticks through `units.js`, open ends, the unit after the last label, measured apart); the
    caption line's sentences (section 3) with its fixed height; the credit line whole, as a `<p>`,
    built as today (B3).
11. **`app.js`, the header**: the stamp's words and its stale and loading states (section 3), its
    `aria-label` removed and *Opens About this data.* as its description (B9); the units key's words
    and name; the row of words (`setQty`, `setMode` unchanged in what they do; `aria-checked`, the
    tracer); `Find` opening its dialog.
12. **`app.js`, the card and the details sheet**: the card's three kinds (section 3), its rows written
    once per selection and updated in place per month, every value through `units.js` and set with
    `textContent`; the placement (top-left, or bottom-left over the tapped point); the tap's sentence
    once; `Details` opening the sheet with the stock `renderUnitSheet()` content restyled (the chart
    through `--chart-liq` and `--chart-gas`, the members table, the per-member lists, the notes);
    `renderFacSheet`, `renderPipeSheet` and `renderBorderSheet` become the card's other kinds;
    `Show Åsgard` a text key; an unnamed pipeline's title `From to To`, without the arrow; `sheetDrag()` removed
    (B12); the sheet's slot shrinking the plate rather than covering it, so `flyTo()` fits the target
    in the plate as it is.
13. **`app.js`, the Layers sheet and Find**: the seven layer rows and the four country rows as
    `aria-pressed` buttons with their samples (section 3), writing `sa.layers` and `sa.countries` as
    today; `peaks` added to `sa.layers` (default on); the key `Show each field's best month`; Find as
    a dialog (`runSearch()` and `pickUnit()` kept), its clear key, `inert` behind it.
14. **`app.js`, focus mode, About, notices, motion, the map's keys**: focus mode as section 3 says,
    `sa.focus` restored before the first draw, Escape in the order About, Find, sheet, card, focus mode;
    About built from its static HTML and the data's own figures (section 3), dates by hand, addresses
    without their scheme, the fallback sources' `https://` removed (B10); notices restyled, their
    sentences kept; Reduce Motion read live (flights as cuts); `flyTo` on `--draw`'s curve and ended at
    its destination by any touch (B13); hidden stopping play and the loop; the arrow-key pan and `+`
    `-` zoom on the focused canvas.
15. **`app.js`, the hook**: `window.__sa` keeps every member it has (`render`, `renderCold`, `state`,
    `setMonth`, `setMode`, `setQty`, `val`, `setLayer`, `pick`, `project`, `zoomTo`, `hit`, `reload`,
    `anchor`, `find`) and adds `stats()` (frames drawn, month computations, ring passes), `wanted()`,
    `shown()`, `best(name)` (`{ value, month }`), `focus()`; nothing in the app calls it.
16. **Words, everywhere shipped** (`index.html`, `app.js`, `js/*.js`, `style.css`, `NOTES.md`,
    `PROMPT.md`, `HANDOFF.md`, `RESEARCH.md`, `ART.md`): US spelling, comments included (the British forms on
    `check.mjs`'s list, which `grep -n -i` finds in every stock file), except proper names (the
    Norwegian open-data license and the NSTA's license, as their publishers spell them) and the data's
    words, allow-listed in `check.mjs` by file and word; no middle dot, arrow, em dash or `...` in a string the app writes but
    the credit line; abbreviations written out (`Oil equivalent`).
17. **`NOTES.md`**: US spelling; the budgets as measured (B14: `geo.json` and `snapshot.json` ≤
    2 500 000 B each and `bathy.png` ≤ 1 200 000 B, enforced by the build; the app's code cap as the
    lead rules it, enforced by `tools/check.mjs`); the folder list (`fonts/`, `js/`, `tools/`); the
    code map (`js/units.js`, `js/data.js`, `js/track.js`); the Peaks, what they compute and what they
    cannot show; the stale threshold (10 days); focus mode; the font's credit line word for word; the
    name repair and the pipeline bug behind it. The data and honesty sections keep their words.
18. **`PROMPT.md`, `HANDOFF.md`, `RESEARCH.md`**: US spelling only, by the same list (`field center`,
    among others); a license's own name stays as its publisher spells it. `HANDOFF.md` also serves World Oil & Gas; its words change, not its content.
19. **`miniapp.json`**: the name unchanged; `version` `1.1`; the description may name the rings (at
    most 200 characters), the lead's choice.
20. **`tools/check.mjs`** (new, Global Weather's pattern; every item of HOUSE 7.1): the ZIP's limits;
    no scheme address in shipped `.html`, `.css`, `.js`; references relative and present; the folder
    contract (`fonts/` exactly the two house files; `data/` exactly the three files; `js/` exactly the
    three modules); the face's and `OFL.txt`'s sha256; the three data hashes above; `miniapp.json`;
    the vendor-name list copied from `global-weather/tools/check.mjs` line 128 as it is (ROT13, never
    decoded); the credit line's construction from `snapshot.sources` and its expected text for the
    shipped snapshot; the camera's strings of section 5 with their roles, and no `aria-label` on
    `Rate` or `Cumulative`; `localStorage`: every key `STORE` holds today still read, `sa.focus` added,
    `peaks` added to `sa.layers`, `sa.speed` and `sa.key` listed as retired with owner call 3 and the
    stock legend key's removal as the reasons; SI; nothing that carries a step transitions; no
    `innerHTML` but `= ''` (the app holds Global Weather's rule today and keeps it), no
    `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval` or `new Function`; the palette
    (`THEMES` equals `--json`, and the script exits 0 with `ALL CHECKS PASS`); the tells and the
    house's three additions; the budgets (code at the lead's cap, fonts ≤ 160 000, the ZIP ≤
    2 413 130, built as `build-zips.yml` builds it, with `index.html` at its top); US spelling with
    the allow-list.
21. **`tools/test_decode.mjs`** (new; no dependencies): `data/` decoded with formulas written in the
    test (base64 uint16 series, polylines), compared with `js/data.js` for a sample of fields and
    every cross-border unit; `monthly`, `cumAt` and the prefix sums at the first, a middle and the last
    month; the Peaks against the test's own running maximum for every unit and quantity at Jun 1985,
    Jun 2000 and Jun 2026 (the counts of section 1: 33, 129 and 205 rings in liquids; Statfjord's
    134 273 Sm³/d in Nov 1986); the reporting months per country; `repairText` on all 316 strings and
    on every other string, unchanged; `units.js` for a table of values (thousands, words from a
    million, both systems, months, spoken forms, coordinates, diameters).
22. **`tools/shoot.mjs`** (new; HOUSE 7.2 as the kind allows): boot (the camera's strings by role and
    name, the credits whole and visible, the face loaded); text contrast in both themes; the tracer
    under exactly the chosen words; **the ring sampler** (rendered ring pixels against the pixels just
    outside them, at Jun 2026 and Jun 1985, both themes, 90 % of samples ≥ 3, the lowest printed; and
    the ring count at the opening view equal to the script's own count from `snapshot.json`); the
    card's figure and `Best month so far` against the script's own decode for Statfjord, Brent and
    Johan Sverdrup; the lead's total against the script's sum; SI in every visible text node; the
    scrub by real touch at 2, 8 and 20 steps a second with 0 frames whose drawn month differs from the
    label's, and the month and ring pass times printed; play (never backwards, stopping at the common
    month, the Play key's mark by computed style, About holding it, the counter steady across a second
    of play); the plate's height steady while the caption changes; the card clear of the tapped point;
    names outside the card, keys and ghost key; focus mode (touch, Enter, Escape, the ghost key, a
    reload, the live sentences, hit targets, the plate's growth, the rings and the credits still
    there); the units key (SI first; `bbl/d` after one press); Find (typing shows no blue-led pixels at
    the field's right end; a choice flies); the Layers sheet (a country off removes its circles and
    rings and names it in the lead); a Norwegian platform's card reading `Åsgard A` (B1); hidden (the
    loop at rest); Reduce Motion (every animation 0 s, `Whole North Sea` a cut); broken data (each file
    missing, not JSON, the wrong schema; a replacement while open keeps the view); widths 320, 360,
    375, 844 x 390 and 125 % zoom with every caption form measured; hit targets ≥ 44 x 44 in both
    modes; pictures to `tools/.work/shots/`, never `screenshots/app.png`, whose hash the run checks
    unchanged; load and frame times printed as headless figures.
23. **`tools/art/palette.py`**: written by this art pass; the builder only runs it (`--json` for step
    8) and changes it only with a figure in this file.
24. **`tools/DECISIONS.md`** (new): sections 8 and 9 of this file moved there word for word, removed
    from here; then the owner calls as they settle, as-built notes and the review record (HOUSE: the
    pass record never ships).
25. **`ART.md`**: the builder corrects any figure here that the build measures differently, in place,
    and says so in `DECISIONS.md`.

---

## 9. Owner calls left open

1. **The code cap: ruled by the lead on 2026-10-02, 200 000 B** (plan 0011 D15; the reasons in
   section 6). The question as the pass put it: HOUSE 8 holds the app to its own 150 000 B; the pass
   lands near 171 000 (section 6). Recommended: the house's 200 000 B, since the 150 KB was a target no build or check
   ever enforced (B14) and the house modules are what every app now carries. To hold 150 000 instead,
   these would go, in this order: Find (about 4 500 B with its dialog; search would leave the app),
   the details sheet's per-member lists and notes (about 4 000; the card would keep the figure, the
   best month and the operator), the history chart (about 3 500), the Layers samples (about 1 500),
   keyboard pan (400): about 13 900 together, which still leaves about 157 000; the last 7 000 would
   mean dropping the countries filter or the platform, pipeline and boundary cards as well.
2. **The signature is the Peaks**, each field's best month so far as an ink ring at the circles' own
   scale, over the alternatives section 1 names (the basin's profile on the track, a vintage layer
   cake, the tapped field's slice). A variant for later: in Cumulative mode, a ring at the volume the
   field has produced by the newest month, so the disc grows into it during play; not in this pass,
   since a ring that means two things by mode needs its own caption.
3. **The speed key goes**, and `sa.speed` is retired: play runs at the stock default, a year a
   second, stated in About. The alternative keeps it as a word key at the player's right (`1 year a
   second`, cycling 0.25 to 4), about 700 B.
4. **Play stops at the newest month every shown country has reported** (Jun 2026 today), against the
   stock end at the newest month any has (Aug 2026), which ends play on a Danish-only map (B2); the
   two later months stay one drag away.
5. **Focus mode drops the legend's bar and ticks**, the house default, since a circle's size reads
   against its ring and its neighbors without them. The alternative keeps the legend, as Norne's
   owner call 7 did for a false-color model.
6. **The rings' 3 px floor** (fields under 3.11 % of the scale's top get no ring), printed in the
   caption and About. Without it, 947 rings in oil equivalent at the opening, most of them 1.6 px,
   over the southern gas basin.
7. **The countries move from four header chips into the Map layers sheet**, which frees the header's
   second row; the time row's lead names the countries shown whenever one is off. The alternative keeps four word
   toggles in the row of words after a second divider, scrolling sideways.
8. **The pipeline's two data-text fixes are a separate follow-up**, not this pass: `common.py` line
   388 should read each DBF with its `.cpg` encoding (UTF-8 for Sodir's), and the fetchers' prose
   (Sodir's cadence sentence) could be swept to US English. Both change `geo.json` and
   `snapshot.json` at the next weekly build, which an art pass must not cause. Until then B1's repair
   keeps the screen right, and it does nothing once the data is fixed.
9. **The field sheet becomes a card and a details sheet**: a tap shows the house card with the month's
   figure and the best month, and `Details` opens the stock sheet's content in the sheet's slot,
   instead of the stock half-height sheet over the map on every tap.
10. **The credit line keeps its middle dots**, as the house's credit-line exception allows, since it
    is built from the data's sources. The alternative is commas, which changes the words the stock
    app printed.

**Phone checks for the device matrix** (none claimed; the owner's iPhone on iOS 26 and an iPhone on
iOS 18, the floor): frame time idle, playing and scrubbing by finger (the month computation and the
ring pass per step); memory after five minutes of play (3.04 MB of JSON parsed, 1 923 series
decoded); background and return; a delivery of a new `snapshot.json` while open; the rings' 1 px at
DPR 3 over the dark plate; focus mode in Snuggery's full screen with the ghost key and Snuggery's own
exit control both reachable in the top-right corner; VoiceOver on the track, on a tap, on the row of
words, in the Layers sheet and in Find; Find's field not zooming the page; the phone on its side with
the sheet open; the safe areas of every band; `Åsgard A` and `Vår Energi ASA` spelled right on a
platform's card.

---

## The build (2026-10-02)

The change list above was applied in order, steps 1 to 25. Nothing in `data/`, in
`scripts/shelf_atlas/` or in `screenshots/app.png` changed: the three data hashes are the ones
recorded before step 1 (`check.mjs` pins them), and `shoot.mjs` reports `app.png` untouched
(sha256 `49ccc6d7df81…`). No pipeline file was written. Every figure below names its command, run
from `Template/shelf-atlas/` (the palette script from `Template/`).

### What the tools printed

- `node tools/check.mjs`: `all checks pass`. App code 178 317 B of 200 000 (`index.html` 18 653,
  `style.css` 23 224, `app.js` 97 363, `js/data.js` 26 165, `js/track.js` 6 137, `js/units.js`
  6 775); fonts 40 075 B of 160 000; the ZIP, built as `build-zips.yml` builds it, 1 977 900 B of
  2 413 130 (17 files, `index.html` at its top; `ART.md` ships, so its own figure moves the last
  digits).
- `node tools/test_decode.mjs`: `all checks pass`, 19 checks: all 1 923 series, `monthly` and
  `cumAt`, the reporting months (NO Jun 1971 to Jul 2026, UK Jun 1975 to Jun 2026, DK Jan 1972 to
  Aug 2026, NL Jan 2003 to Jul 2026), the Peaks against the test's own running maximum for 1 219
  units, 3 quantities and 3 months (rings over the floor in liquids: Jun 1985 33, Jun 2000 129,
  Jun 2026 205, as the art pass counted; gas 9, 39, 73; oil equivalent 31, 119, 179), Statfjord's
  134 273 Sm³/d in Nov 1986, the 316 repaired names and none of the other 19 556 strings changed,
  the polylines, the credit line, 38 forms of `js/units.js`, and About's four data claims (the UK
  and Dutch series starts, Danish `monthlyFrom` Jan 2018 on 19 fields, Tern's two 2000 gas months
  98 times its third).
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: `all checks pass`, 94 checks, both
  themes, with the three-speed scrub. Headless Chromium on the build Mac, a trend and never phone
  evidence: data in after 486 and 500 ms (581 in an earlier run); a month's frame 0.5 ms and a frame with the basemap
  redrawn 11.6 ms (medians); the scrub drew 0 frames whose label or `aria-valuenow` differed from
  the month drawn at 2, 8 and 20 months a second; play ran 11 month computations over 60 frames in
  its first second. The ring sampler compares every drawn ring with the same pixels drawn with the
  rings off: 100 % of 2 952 samples at 3:1 or more at Jun 2026 (lowest 3.26 light, 3.52 dark) and
  of 528 at Jun 1985 (3.46, 3.68).
- `python3 shelf-atlas/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`, exit 0, and
  `THEMES` in `app.js` equals its `--json` (checked by `check.mjs`).

### The bugs on record

| | Fixed by | Proved by |
| --- | --- | --- |
| B1 double-encoded names | `repairText()` in `js/data.js`, at decode, every string of every pipeline and facility record | `test_decode.mjs` (316 of 316, 0 others); `shoot.mjs` (the platform card reads `Åsgard A`, its key `Show Åsgard` selects `NO-43765`) |
| B2 the newest months | play stops at the newest month every shown country has reported; a unit is drawn only when every shown member's country has reported the month; the caption names who is missing | `shoot.mjs` (play stops at Jun 2026; at Aug 2026 the 10 rings are all Danish, this file's own count 10) |
| B3 the credit line cut off | a `<p>`, whole, wrapping | `shoot.mjs` (on screen whole at 390 px, both themes) |
| B4 controls under 44 px | the house keys | `shoot.mjs` (18 controls, 6 in focus mode, 24 with the Layers sheet open, all at least 44 × 44) |
| B5 Reduce Motion, About, hidden | read live; About and Find hold play; hidden stops play and the loop | `shoot.mjs` |
| B6 VoiceOver and every month | no `aria-live` on the month; the year keys say the new month once | `shoot.mjs` (`September 1986`) |
| B7 SI | `js/units.js` | `check.mjs`, `shoot.mjs` (145 visible text nodes with a unit's details open) |
| B8 middle dots, the arrow, em dashes, capitals | gone from the app's own strings; the credit line keeps its dots | `check.mjs` |
| B9 the stamp's and the credits' names | no `aria-label` on either | `index.html` |
| B10 About's dates and addresses | dates by hand with their zone; addresses without their scheme; no `https://` in a shipped script | `check.mjs`, `shoot.mjs` |
| B11 accent, red, glass, shadows | the house tokens | `check.mjs` |
| B12 the drag sheet | the card on the plate and the details in the sheet's slot, which shrinks the plate | by eye in the pictures |
| B13 a touch stops a flight midway | any touch ends it at its destination | `shoot.mjs` |
| B14 `NOTES.md`'s budgets | rewritten as enforced: the build's three data caps, `check.mjs`'s code, font and ZIP caps | `NOTES.md` |

### Departures from the change list, and why

1. **The units key's name** is `Change units, now Sm³/d`, not `… now standard cubic meters a day`:
   a name that contains the key's visible text (WCAG 2.5.3), as HOUSE 4.2 writes it.
2. **The card's line** is `Liquids in Jun 2026.` and the status is a row of its own, `Status
   today`, with `Hydrocarbon` beside it: `Oil, producing.` under a month in 1990 would read as the
   status then, and the data holds only today's status (a field's history of statuses is in its
   details, `Status in Jun 1990`).
3. **The card stands down while a sheet is open**: the sheet shows the same field, and on a 220 px
   plate the card would cover it. Closing the sheet brings the card back.
4. **On a phone on its side** the sheet is a column beside the plate only, and the caption band
   keeps the full width: with the caption beside the sheet too, its credits wrapped to three lines
   and the plate fell to 218 px (measured); as built it is 233.
5. **The caption with several countries before their series** reads `No Danish, UK or Dutch
   figures yet.`: the months listed in full (`Norwegian figures start in Jun 1971, Danish in Jan
   1972, …`) overflowed the line's two lines at 320, 360 and 312 px. One country keeps its month
   (`Dutch figures start in Jan 2003.`), the form that holds from 1975 to 2003.
6. **The focus-mode plate** measured 650.1 px; `shoot.mjs` holds it at 645 or more, since one run
   measured it a fraction under 650. `ART.md` says so.
7. **Platforms are drawn without the stock outline stroke**: the palette gives them a fill only
   (`#5c676c` / `#7e8a90`, 3.70 and 3.83 on the worst ground).
8. **The details keep the stock "peak rate" as `Best month on record, liquids`** (the whole
   series), beside the card's `Best month so far` (the ring's record at the month shown); both read
   the same series.
9. **The Layers sheet's rows and samples are markup** in `index.html`, drawn in the plate's colors
   through custom properties `--s-*` that `buildPalette()` sets from `THEMES`, not built in script.
10. **B2's rule holds in Cumulative too**: a unit whose shown country has not reported the month
    draws no circle there (the stock drew the sum to the country's last month).
11. **`screenshots/cumulative.png`**, a picture of the stock look, was removed; `SCREENSHOTS=1`
    writes the scenes as `*-light.png` and `*-dark.png` beside `app.png`, which is untouched.
12. **The test hook** keeps every member it had and adds `ready`, `stats`, `wanted`, `shown`,
    `best`, `rings`, `labels`, `home`, `focus`, `flying` and `log`; nothing in the app calls it.

### Owner calls, as the build leaves them

1. The code cap: ruled by the lead, 200 000 B (above). As built 178 317.
2. to 7., 9. and 10. Built as the art pass recommended: the Peaks; the speed key gone (`sa.speed`
   retired, a year a second, stated in About); play stops at the common month and starts over
   there; focus mode drops the legend's bar and ticks (its title stays); the 3 px floor; the
   countries in the Map layers sheet; the card and the details sheet; the credit line's dots kept.
8. Open, and not this pass's: the pipeline reading each DBF with its own encoding, and the
   fetchers' prose in US English (plan 0011 D15 makes it a data follow-up after the pass's final).
   Until then `repairText()` keeps the screen right.

### The camera

Every string of HOUSE 7.4 for this app is kept with its role: the button `Play` (named `Pause`
while playing), the button `Back one year`, the radios `Rate` and `Cumulative` by their own text
with no `aria-label`, and the ghost key `Show the controls` for `showControlsIfHidden()`.
`check.mjs` and `shoot.mjs` both assert them. The camera needs no change.

### For the lead, outside this folder

- `Template/README.md`'s Shelf Atlas entry can name the Peaks; the README composite
  (`screenshots/app.png`) and the panes are the lead's to re-shoot.
- `Template/HOUSE.md`'s budget table: Shelf Atlas after its pass, ZIP about 1 977 900, code
  178 317 of 200 000, fonts 40 075.
- The before-and-after pair: the "before" from the committed state (`git show HEAD:…`), the
  "after" from `screenshots/*-light.png` and `*-dark.png`.
- The phone checks in section 9's last paragraph above, for the device matrix; none is claimed
  here.

---

## After QA (2026-10-02)

QA's verdict was a pass with no must or should, and three nits. No shipped file changed for them:
`ART.md`, `NOTES.md`, `PROMPT.md`, the code and the fonts are as the build left them, so the
figures above stand, and this section, outside the ZIP, is the only edit.

1. **`PROMPT.md` groups thousands with commas (`1,200 field outlines`)**: kept. HOUSE 6.1's
   narrow-space grouping binds "every number, unit and date the app shows", through `js/units.js`,
   and `check.mjs`'s SI scan reads the app's HTML, CSS and script strings, not the Markdown.
   `PROMPT.md` is US English prose written for a coding agent, and the house's own sibling does
   the same: `world-oil-gas/PROMPT.md` line 10 reads `7,055 fields`. Changing one of the two
   would make the family disagree with itself; if the owner wants SI grouping in prose, it is a
   family-wide change for the lead, not this pass's.
2. **The hit-target count differs between runs (18 or 20)**: kept. `hitTargets()` in
   `tools/shoot.mjs` counts the controls on screen at that moment, and whether the field card (with
   its own keys) is still up when the count runs depends on the preceding step. What is asserted is
   that every counted control is at least 44 × 44, and at least 15 in the main view; that holds on
   every run. B4's row above gives the counts of the build's run, not invariants.
3. **The README composite and the removed `screenshots/cumulative.png`**: outside this folder, and
   already in "For the lead" above and departure 11. Nothing replaces `cumulative.png` by name:
   `SCREENSHOTS=1 node tools/shoot.mjs` writes `cumulative-light.png` and `cumulative-dark.png`
   beside `app.png`, which is unchanged.

The tools re-run after this section was written are quoted in the lead's report for this step.

## After review (2026-10-02)

The reviewer sent the app back with one must, seven shoulds and six nits, every one from a touch
drive in headless Chromium that the tools had not covered (`tools/.work/review/`). All fourteen are
applied but one half of one should, declined below with its reason. Nothing in `data/` changed:
`check.mjs` pins the three hashes. The camera's strings are untouched. No pipeline file was written.

### What changed, finding by finding

1. **Must: a tap at a ring's center opened a small neighbor.** `hitTest()` ranked the units in reach
   by smallest radius, and every unit has a 9 px reach, so a producing 1.6 px disc beat the 17 px
   ring under the finger (the reviewer's `reach2.mjs`: 7 of 7 centers wrong; Statfjord and Brent
   opened Barnacle). Now the units in reach (radius plus 3 px, at least 9 px) are ranked by distance
   over radius, the radius taken as at least 4.5 px. `reach2.mjs` re-run: all seven open their own
   field. `shoot.mjs` now taps Statfjord, Brent, Oseberg and Ekofisk at their centers and Barnacle's
   1.6 px disc, by touch at the opening view, in both themes; all five open their own name.
2. **Should: a finger on the plate during play froze the picture while the label ran on.** `loop()`
   now holds the play clock while a gesture is down (`lastPlay = 0`, no step), as About does; play
   goes on from the lift. `shoot.mjs`: a finger held 0.5 s on open sea during play leaves the month
   where it was (Apr 1980, drawn Apr 1980), and play goes on after the lift (Nov 1980 0.6 s later).
3. **Should: the 1.6 px floor made small rings look fuller than the data.** A unit with a ring now
   draws its disc at its true radius with no floor, and without the rim (a 1 px rim would cover a
   disc under 1.6 px); a ringless disc keeps the floor (`discR()` in `app.js`). About and `NOTES.md`
   name the floor in words. `shoot.mjs`: 135 producing rings at Jun 2026, 76 of them with a disc
   under the floor, every drawn share of the ring's area equal to this file's month over best
   (worst difference 0.0000), both themes.
4. **Should: `First production` printed the first month of the regulator's series.** The card's and
   the details sheet's row is now `First month reported`, and where data.js marks the series as
   starting late the value says so in `cumNotes()`'s terms. `shoot.mjs`: Groningen `Jan 2003, when
   the Dutch series starts`; West Sole `Apr 1983; earlier months are not in the series`; Statfjord
   `Nov 1979`.
5. **Should: beyond the data's box the plate was `--page`.** `palette.py` gives the outside a neutral
   of its own (light `#dbdee0`, L 0.900; dark `#0c1012`, L 0.168) and a new `edge`, the `--line` token,
   which `drawStatic()` strokes 1 px around the box; `THEMES` re-pasted from `--json`. The home view
   is now fitted to the plate (`homeCenter()`): on an axis where the box is longer than the plate it
   moves just enough that no band beyond the box shows, and a resize that finds the view at home
   re-homes. That removes the 29 px strip above the caption band in portrait focus mode.
   **Declined: fitting the home view by width on its side.** At 844 x 233 a width fit is 22 px a
   degree and about 6° of latitude, so the opening view would lose either the southern gas basin
   or the northern fields; the box's west edge stays at x 320, and the outside's tone and edge now
   say what that area is. `shoot.mjs` measures it in both themes at 844 x 390: the pixel 30 px west
   of 6° W is the outside's tone, not the page's, and the edge line is there.
6. **Should: from zoom 1.6 the pipelines out-shouted the rings.** `PIPE_W` went from 0.7, 1.2, 1.9 to
   0.7, 0.95, 1.25 px and the zoom growth's cap from 1.8 to 1.15: the widest is 1.44 px at any zoom,
   where it was 3.4. The reviewer's suggestion (1.5 px, × 1.2) was tried first and looked at: at
   zoom 3 in light the magenta trunk lines still drew the eye before the rings, so it went one step
   further. Looked at by eye at zoom 3 in both themes (scratch pictures from a throwaway script):
   the rings are the boldest marks. The palette's 3:1 figures are unchanged, since they come from
   lightness.
7. **Should: the shipped `ART.md` carried the pass's history and three wrong lead figures.** Moved
   here word for word (below): the measuring note at its head, "What a stranger saw before the
   pass", section 6's "Today" table, its estimate ledger and its ZIP estimate. The lead examples now
   read what the app prints at Jun 2026: `408 000 Sm³/d, 426 fields` (`shoot.mjs`, against its own
   sum), `10.8 billion Sm³, 949 fields` and `NO, DK: 331 000 Sm³/d, 107 fields`
   (`PLAYWRIGHT_MODULE=… node tools/.work/review/lead.mjs`, re-run). Every rule changed above is
   corrected in place in `ART.md`: the caption, test 7, the disc, the hits, the records' cost, the
   tonal budget and the plate table, the time row, the transport, the card, Find, the live region,
   focus mode, on its side, and section 6's as-built table.
8. **Should: `shoot.mjs` covered neither the stale state nor a short file.** Both are in its
   broken-data block now. Stale, a snapshot built 20 days ago: `Stale. Updated 12 Sep, 05:31, figures
   to Jun 2026`, the first sentence in `--ink` (rgb(15, 28, 35) light, rgb(230, 237, 238) dark), the
   same in focus mode's caption band. Short, half the snapshot: the notice `data/snapshot.json is not
   valid JSON.`, the stamp `Map only. Updated 26 Sep, 10:51`, the caption line and the transport (nit
   12 below).

The nits:

9. VoiceOver's tap sentence gives the best month with its unit: `Best month so far: 134000 standard
   cubic meters a day, November 1986.` (`U.amountSpoken`; `shoot.mjs`'s pattern now requires the
   unit).
10. The Peaks' records are kept in a `Map` per quantity and set of countries, cleared when a new model
    is read. The reviewer's `perf.mjs`, run with the quantities twice over (headless Chromium at DPR
    3, a trend only): `Gas` 42.4 ms and `Oil equivalent` 44.5 ms to the next frame the first time,
    one record build each; every switch after that 9.0 to 11.2 ms, no build.
11. `exclusions()` reads layout once and keeps it, dropped on a resize of the card, the key column or
    the ghost key (a `ResizeObserver`, which also sees one shown or hidden), on the card's placement,
    opening and closing, on a focus-mode change and on a resize of the plate. `shoot.mjs`'s check
    that no name lies under the card or the keys still passes.
12. Find says the count once typing settles (700 ms): `3 fields match.` for `statf` (`shoot.mjs`
    checks it against its own count of names), `No field by that name.` for none.
13. With no production figures the three transport keys and the Peaks key are `aria-disabled` and
    dimmed, and do nothing; the caption line reads `No production figures to show; the notice above
    says why.` (`shoot.mjs`, short file).
14. The caption reads `Rings: each field's best month so far, drawn from a best of 4 180 Sm³/d.`, so
    the figure cannot be read as the month's rate. Every caption form fits its lines at 320, 360,
    375, 312 (125 % zoom) and 844 wide in both unit systems (`shoot.mjs`'s widths block).

### What the tools printed after the fixes

- `node tools/check.mjs` (from `Template/`): `all checks pass`. App code 183 795 B of 200 000
  (`index.html` 18 867, `style.css` 23 269, `app.js` 102 582, `js/data.js` 26 165, `js/track.js`
  6 137, `js/units.js` 6 775: 5 478 more than the build's 178 317); fonts 40 075 B of 160 000; the
  ZIP 1 979 299 B of 2 413 130 (`ART.md` ships, so its own figure moves the last digits); the three
  data hashes the ones recorded before the pass.
- `node tools/test_decode.mjs`: `all checks pass`, 19 checks, unchanged.
- `python3 shelf-atlas/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`, exit 0, with the
  outside's new tones among the grounds every ring is checked over.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: `all checks pass`, 109 checks (94 at the
  build), both themes, with the three-speed scrub; `screenshots/*-{light,dark}.png` refreshed,
  `app.png` untouched (`49ccc6d7df81…`). Headless Chromium on the build Mac, never phone evidence:
  data in after 488 and 487 ms; a month's frame 0.4 ms, a frame with the basemap redrawn 12.0 ms
  (medians).
- **The new checks pin the fixes.** With the three fixes switched off in a copy of `app.js` (the old
  hit ranking, no play hold, the floor inside rings) `SCHEMES=light SCRUB=0 node tools/shoot.mjs`
  failed exactly those three: the disc's share off by 0.2337; Statfjord and Brent opening Barnacle,
  Oseberg opening Tune, Ekofisk opening Edda; the month running from May to Nov 1980 under a held
  finger. With `app.js` restored (`cmp` against the saved copy) they pass.

### For the lead, and the owner calls left open

- `Template/HOUSE.md`'s budget row for Shelf Atlas, after review: ZIP about 1 979 300 B, code
  183 795 of 200 000, fonts 40 075. The camera needs no change: no string or role moved.
- The before-and-after pair: `screenshots/*-{light,dark}.png` are this run's.
- Owner call, new: on its side the home view keeps the North Sea's full height and leaves the area
  west of 6° W to the outside's tone (declined half of finding 5, above). A width fit is a small change to
  `computeFit()` if the owner would rather fill the plate and lose latitude.
- Owner call 8 stays open and is not this pass's (the pipeline's DBF encodings, a data follow-up).

### Phone checks this adds (none claimed)

- A tap at the center of a big ring, and on a small disc beside it, on the iOS 18 floor device.
- Time from a tap on `Gas` to the frame, the first time and the second, on the iOS 18 floor device.
- The discs drawn under the floor inside small rings (Harald, Nini, Siri at Jun 2026) at DPR 3 in
  both themes: a dot, not a gap.
- The 1.25 px pipelines and their dotted class at DPR 3.
- A finger held on the map during play, and play going on after the lift.

### Moved from ART.md, word for word

**The measuring note at the head of ART.md**, as it stood:

**Measured on 2026-10-02**, before the pass, on the working tree. Commands run from
`Template/shelf-atlas/` unless they say `Template/`. Load times are headless Chromium on the build
Mac: a trend, never phone evidence. The throwaway scripts named below live in `tools/.work/`, which
git ignores (`.gitignore`, added by this pass).

**"What a stranger saw before the pass" (ART.md, "The look")**, as it stood:

**What a stranger saw before the pass** (`PLAYWRIGHT_MODULE=… node tools/.work/look.mjs`, light and
dark at 390 x 844, DPR 2, touch, plus 320 x 568 and 844 x 390; pictures and `look.log` in
`tools/.work/look/`): a 19 px bold system-font title; two pill segmented controls with a drop
shadow (`Liquids Gas O.E.`, then `Rate Cumulative`) beside four bordered country chips; a white
icon key for search and a `Sm³/d` key; glass map keys with a blur and a shadow; a glass legend
labeled `Liquids ▸` whose ticks read `≤42 1k 10k 134k+`; a credit line cut off with `…` on every
phone held upright; a blue Play disc, a blue native slider and a `1×` speed key; a half-height sheet with
a 24 px figure, `CROSS-BORDER UNIT` in tracked capitals and a pill badge; middle dots in the stamp,
the lead and every sheet's sub-line; the selection drawn in the accent blue; a near-black (`#07090d`)
plate in the dark theme. 21 controls measured under 44 x 44 (`look.log`'s `small` list: the stamp
240 x 20, search 44 x 40, the units key 56 x 40, the three quantity buttons 36 tall, `Rate` and
`Cumulative` 79 x 28, the four chips 38 x 40, the four map keys 40 x 40, the credits 370 x 20,
the two year keys and the speed key 40 x 44, the slider 182 x 30). The data was in after 244 ms
(light) and 156 ms (dark).

**Section 6, "Today"**, as it stood:

**Today** (2026-10-02, the working tree):

| | Bytes | Command |
| --- | --: | --- |
| App code: `index.html` 8 880, `app.js` 110 660, `style.css` 19 765 | **139 305** | `wc -c index.html app.js style.css` |
| Fonts | 0 | no `fonts/` |
| ZIP, as `build-zips.yml` packs it | **1 900 237** | `zip -q -r -X tools/.work/shelf-atlas.zip . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`, then `wc -c` |
| Root documents in it, each zipped alone | `RESEARCH.md` 13 052, `HANDOFF.md` 4 579, `PROMPT.md` 2 822, `NOTES.md` 2 490 | `zip -q -X OUT FILE` |
| Data (unchanged by the pass) | `geo.json` 1 362 549, `snapshot.json` 1 679 997, `bathy.png` 459 995 | `unzip -l` |

**Section 6, the code ledger and the ZIP estimate**, as it stood:

**The code ledger** (estimates; the builder measures after every step, and `check.mjs` prints the truth):

| Change | Bytes |
| --- | --: |
| Freed: the sheet's drag (`sheetDrag`, 1 274), the speed key and `updateSpeed` (about 600), the ticks under the native slider (`buildTicks`, 601), `fmt3` and `fmtVol` (1 037, into `units.js`) | −3 500 |
| Moved, net zero: the decode, the shape checks, the series, `monthly`, `cumAt`, the name helpers and `shortSource` into `js/data.js` (pure, so the decode test can import it) | 0 |
| Added: `js/units.js` (Global Weather's 4 837 B, plus volumes in words, months, rates in both systems, spoken forms) | +5 500 |
| Added: `js/track.js` (Global Weather's 6 695 B adapted: year and decade ticks, no per-step ticks) | +6 800 |
| `style.css` rewritten as the house stylesheet for this app (Global Weather's 18 348, plus the card's three kinds, the sheet, the Layers rows and samples, Find, the chart and the members table), against the stock 19 765 | +1 200 |
| `index.html` restructured (header, plate, caption band, sheet slot, player, Find, About's static sections, the live region), against the stock 8 880 | +2 600 |
| `app.js`: the Peaks (records, lookup, drawing, hits, the card's row, the caption's floor) | +3 000 |
| `app.js`: wanted and shown, play on the clock to the common month, About holding play, hidden, the dirty counter | +2 500 |
| `app.js`: focus mode | +3 200 |
| `app.js`: the card (three kinds, placement, in-place rows, the tap's sentence) and the details sheet split from the stock sheet | +3 500 |
| `app.js`: Find as a dialog, the Layers sheet with its samples, the countries moved | +1 100 |
| `app.js`: the caption's sentences, the stamp and the lead rewritten, About's dynamic parts by hand, notices, Reduce Motion, the face wait, the name repair (B1), keyboard pan, the hook's additions | +5 300 |
| `THEMES` replaced by the pasted `--json` (17 stops a theme and the plate) | +1 300 |

About **171 000 B** after the pass: 21 000 over the app's own 150 000 and 29 000 under the house's
200 000. It cannot land under 150 000 without cutting features (owner call 1 lists what would go);
HOUSE 8 forbids minifying or stripping comments to fit (`app.js` carries 15 672 B of comments today,
5 417 of them the data contract at its head).

**The ZIP.** It gains the face (37 834 B zipped), this file (about 80 800 B as the art pass wrote it,
about 32 000 B zipped alone by `zip -q -X OUT ART.md`; less once step 24 moves sections 8 and 9 out),
since root `*.md` files ship, and the code's growth with `js/` (about 32 000 B, about 9 000 zipped):
about **1 979 000 B against the 2 413 130 cap**, about 434 000 B of headroom. Nothing in `tools/` ships.

---

## The data follow-up (2026-10-02)

Owner call 8, as plan 0011 D15 scoped it: the pipeline reads each DBF in the encoding its shapefile
declares, the fetchers' prose that lands in the data is US English, and the data is rebuilt with the
change proved. Every figure below was printed by a command run on the build Mac on 2026-10-02; the
scratch for all of it is `tools/.work/data-followup/` (not shipped, not tracked), named by file.
Nothing here ran on a phone.

### Reachability

`python3 scripts/shelf_atlas/probe.py shelf-atlas/tools/.work/data-followup/probe-hosts.txt` (from
`Template/`; one URL per host the North Sea build fetches, since `probe-urls.txt` lists only the
bathymetry hosts): all eleven URLs, ten hosts, answered HTTP 200 from this Mac: factpages.sodir.no
(a CSV and `fclPoint.zip`), services-eu1.arcgis.com (NSTA), ens.dk, data.geus.dk,
www.gdngeoservices.nl, www.nlog.nl (the production API, by POST), geo.vliz.be,
ows.emodnet-humanactivities.eu, ows.emodnet-bathymetry.eu and raw.githubusercontent.com. So the
rebuild ran here, not on a runner.

One host is unreliable. EMODnet Bathymetry's WCS answered `GetCoverage` for the second tile with
HTTP 502 four times inside the build's 15 s of retries (`fetch()`: four tries, 1 + 2 + 4 + 8 s), and
the first build stopped there (`BUILD FAILED: could not fetch …BBOX=-3.0%2C70.0%2C0.0%2C73.0…: HTTP
Error 502: Bad Gateway`); a minute later a probe tile came back. `warm_bathy.py` then called the
pipeline's own `fetch_bathymetry._tile()` for all 104 tiles, in the build's order, with up to 40
tries 10 to 90 s apart: all 104 came back at the first try. The weekly runner keeps the tiles in its
Actions cache, so this bites only on `refresh` or a cold cache.

### The encodings, per source

`peek_dbf.py` read each zip's members, its `.cpg` and the DBF header's language-driver byte (offset
29), and tested every text value with a byte over 127; the build logs the same per file
(`build-new.log`):

| Source | `.cpg` | Byte 29 | Text values (beyond ASCII) | Read as |
| --- | --- | --- | --- | --- |
| Sodir `fldArea.zip`, field outlines | `UTF-8` | 0x00 | 1 846 (51) | UTF-8 |
| Sodir `fclPoint.zip`, facilities | `UTF-8` | 0x00 | 24 580 (311) | UTF-8 |
| Sodir `pipLine.zip`, pipelines | `UTF-8` | 0x00 | 913 (85) | UTF-8 |
| Danish Energy Agency `FieldDelination_12_12_2025` (ens.dk/media/7661/download) | `UTF-8` | 0x00 | 102 (2) | UTF-8 |

Every value beyond ASCII in the four files is valid UTF-8, and none fills its field to the last
byte, so none was cut mid-character. No source is Latin-1: the Danish file's two such values, the
`Label`s `Halfdan NØ` and `Tyra SØ`, read as `Halfdan NÃ\x98` and `Tyra SÃ\x98` as Latin-1. They never
reached the data either way: the build matches Danish outlines on the `Field` column (`Halfdan (Igor
area)`, `Tyra Southeast`, ASCII) and reads `Label` only when `Field` is empty, which it is for
neither; and of `fldArea` the build keeps only `idField`. So the fix changes names in `geo.json`'s
facilities and pipelines and nothing else.

### The code

`scripts/shelf_atlas/common.py`: `shapefile_records(blob)` keeps its signature and its records. It
asks `dbf_encoding()` for the codec, which takes the `.cpg` beside the DBF when it names a code page
(`cpg_codec()`: `UTF-8`, `UTF8`, `ISO-8859-1`, `88591`, `1252`, `ANSI 1252`, `cp1252`,
`Windows-1252` and the like), else the header's language-driver byte (`LDID_CODECS`: 23 common
drivers, each as GDAL's shapefile driver reads it, compared with its `ogrshapelayer.cpp` with no
disagreement; 0x57 as Latin-1), else UTF-8 when every text value decodes as UTF-8 and Latin-1 when
one does not, and logs the choice per file. The order is the one GDAL's shapefile documentation gives
(the `.cpg`, "or as a fallback in the LDID/codepage setting from the .dbf"). pyshp 3.1.6 does not expose the byte (it
skips header bytes 12 to 31), so the build reads it from the DBF. A declared encoding that one of the
file's values does not decode in stops the build with a `BuildError` naming the file, the
declaration and the value: the declaration or the file changed, and a guess would ship garbled names.
None of today's four files is near that (above). `test_encoding.py` puts synthetic zipped shapefiles
through `shapefile_records()`: a `.cpg` `UTF-8`, a `.cpg` `UTF8` with a line end, no `.cpg` over
UTF-8 text, no `.cpg` over Latin-1 text, byte 0x57, byte 0x03 with a cp1252 `€`, a `.cpg` `1252`, an
unknown `.cpg`, a `.cpg` `UTF-8` over Latin-1 text (it stops), ASCII only, and fourteen `.cpg`
spellings: all pass on pyshp 3.1.6, what `pip install 'pyshp>=2.3'` installs today, and on 2.3.1,
the floor the workflow allows.

### The prose

Three strings the fetchers write into the data, spelling only:

- `fetch_norway.py`, Sodir's cadence: `FactPages are synchronised daily` becomes `synchronized`.
- `fetch_denmark.py`, the Danish license statement: `No licence stated on the data pages` becomes
  `No license stated` (the `licence` key the app reads stays).
- `fetch_bathymetry.py`, `geo.json`'s `bathymetry.encoding`: `8-bit grey` becomes `8-bit gray`;
  `scripts/shelf_atlas/SCHEMA.md`'s quotation of that string follows.

Kept: `NLOD 2.0 (Norwegian Licence for Open Government Data)`, `NSTA Open User Licence (June 2023):
…` and NLOD's own attribution sentence (`Contains data under the Norwegian licence for Open
Government data (NLOD) distributed by …`), each a license's name, which `check.mjs` already strips
as one. No other sentence that lands in the data has a British spelling; comments and docstrings
(`colouring`, `metres`, `greyscale`, `organisation`, `NEIGHBOURS`) do not ship and were left alone.

### The rebuild, and what it proves

Three builds compared with a structural diff (`jsondiff.py`: both trees walked together, record
lists matched by id, every difference classed as a key, a record, an order, a list length, a type, a
number, a geometry polyline, a series payload or a text, and each text tested against the Latin-1
round trip and the three swept spellings; outputs `diff-AB-*.out`, `diff-drift-*.out`,
`diff-total-*.out`):

- **A**, the unchanged code (a copy in the scratch folder), run online into a scratch cache
  (`build-old.log`; the bathymetry tiles and the four shapefile zips were already in that cache from
  the warm-up and the encoding probe, fetched through the pipeline's own `Cache`);
- **B**, the fixed code, run `--offline` from the same cache (`build-new.log`), so A and B read the
  same bytes;
- the shipped files of 2026-09-26.

**A against B, the fix alone.** `geo.json`: 316 strings changed, each exactly the Latin-1 to UTF-8
round trip of the old (facilities' `field` 112, `name` 109, `operator` 63; pipelines' `name` 14,
`from` 10, `to` 8), plus the one swept string and the stamp; 0 keys, 0 records, 0 order, 0 list
lengths, 0 types, 0 numbers, 0 geometry polylines, 0 series, 0 other strings. Examples:
`Ã\x85SGARD A` to `ÅSGARD A`, `KÃ\x85RSTÃ\x98` to `KÅRSTØ`, `VÃ¥r Energi ASA` to `Vår Energi ASA` (63
facilities), `GJÃ\x98A` to `GJØA`, `Ã\x98ST FRIGG CMS` to `ØST FRIGG CMS`, `42" Gas Ã\x85SGARD ERB,
KÃ\x85RSTÃ\x98` to `42" Gas ÅSGARD ERB, KÅRSTØ` (`diff-AB-geo-repairs.out` lists all 316). The file
goes from 1 362 547 B to 1 361 881 B: 666 B, two for each of the 333 pairs. `snapshot.json`: the two
swept strings and the stamp, nothing else. `bathy.png`: byte-identical in all three (`a97b5bf5…`).

**The shipped files against A, what the sources changed since 2026-09-26** (the old code both
times; `drift.out`):

- The UK's newest month went from Jun to Jul 2026 (179 UK fields' `lastMonth`, 169 of them from
  Jun); 14 Dutch fields gained Jul 2026 (5 from May, 9 from Jun). Norway (Jul 2026) and Denmark (Aug
  2026) did not move, so `lastMonth` stays 667 and **the month the app opens on, the newest every
  country has reported, moves from Jun to Jul 2026**.
- Teal West, a UK field the snapshot already listed without a series, reports its first month: Jul
  2026, 23 543 Sm³ of liquids and 852 905 Sm³ of gas (its six keys added).
- NSTA revised 12 UK series in Jun 2026 by more than one quantization step, the largest Nevis's gas,
  1 018 008 to 1 089 126 Sm³ for the month; nothing earlier moved.
- So 746 numbers (`lastMonth` of 193 fields, `cumGas` 191, `cumLiq` 178, Teal West's `firstMonth`
  and peaks), 376 series payloads and 63 `ask` rows (the newest month and its three rates) changed;
  `groups`, `matching`, `sources` and `units` did not, and no field's text did.
- `geo.json`: two Norwegian outlines come out as Sodir's `fldArea.zip` draws them today: Gudrun's
  first ring (49 points either way, 3.298 to 3.295 km², no vertex more than 26 m from the old ring's)
  and Knarr's second (43 points, 2.662 to 2.661 km², one vertex 236 m from any old one). Every other
  outline, all 2 082 facilities, all 1 200 pipelines, the coast, the land, the 200 m bathymetry and
  the borders come out identical, so this Mac reproduces the build's arithmetic and the two rings
  follow the source. NLOG's WFS now lists the 567 Dutch outlines in another order (the same 567);
  the app keys outlines by id and hit-tests by the smallest area, so the order shows nowhere.

**The shipped files against B** are those two sums and nothing else (`diff-total-*.out`). The brief
allowed new months as long as they are what the regulators publish and are said; B went into
`data/` as built (`cmp` against the scratch copy), stamped `2026-10-02T13:23:40Z`.

### The data now

```
a97b5bf5e64900ca241628c0f8b10c90256f3bf7c5b75929288d206eb9fb4b51  data/bathy.png       unchanged
4dc10f498ef23a2a5c441386b40e839ae222a8df5fe6df96cd1235895b0b1448  data/geo.json        1 361 881 B
ea6c01e73f4370b756e0193d9982bc35c676a7a042814918150951b153b11932  data/snapshot.json   1 681 298 B
```

The final code, run once more `--offline` with the same stamp (`--generated-at
2026-10-02T13:23:40Z`, `build-final.log`), rebuilds all three byte for byte (`cmp`). `check.mjs`
pins these. The hashes the pass recorded before it began stay at the head of the change list, as its
record. `NOTES.md` records no hashes.

### The tools, changed and run (from `Template/shelf-atlas/`)

- `tools/test_decode.mjs`, section 5: the shipped data has nothing to repair (0 of the 38 630
  strings in both files carry the pattern, `repairText` changes none, `repaired()` none of the 19 872
  strings of the pipeline, facility and border records); the function is tested on six garbled
  samples written in the file (Sodir's names as the Latin-1 read had them) and on seven strings it
  must leave alone; and the names arrive spelled right in `geo.json` itself (`ÅSGARD A` of `ÅSGARD`,
  `GJØA` of `GJØA`, 5 pipelines to or from `KÅRSTØ`, 63 facilities of `Vår Energi ASA`). The
  opening-month pins move from Jun to Jul 2026: the default month, and the third month of the Peaks'
  checks (205 rings; Statfjord's best, 134 273 Sm³/d in Nov 1986, the same at both). The new checks
  are not vacuous: on a scratch copy holding the 2026-09-26 data, the data checks fail (316 strings
  with the pattern, the names not found) and the sample check passes; with `repairText` switched off
  in a scratch copy of `js/data.js`, the sample check fails (all six) and the data checks pass.
  `node tools/test_decode.mjs`: 20 checks, `all checks pass` (19 before: section 5's two became
  three).
- `tools/check.mjs`: the three data pins and their wording; the spelling allow-list down to the
  regulators' own words (`Harbour` in both files, `CENTRE` and `Centre` in `geo.json`), since
  `synchronised`, `licence` and `grey` are gone from the data. `node tools/check.mjs`: 38 checks,
  `all checks pass`; the ZIP 1 980 247 B of 2 413 130; app code 183 795 B, unchanged.
- `tools/shoot.mjs`: `COMMON + 2` (with the old data, the month only Denmark had reported) becomes
  `LAST`, the snapshot's own `lastMonth`: the same month with the old data, and the right one with the
  new, where `COMMON + 2` falls past the track (the app clamps it to Aug 2026 while the check counted
  rings for Sep 2026, which nobody reported). The two month names it pinned (`Aug 2026`, `June 2026`)
  are worked out from the data, like the rest of its figures. `PLAYWRIGHT_MODULE=… node
  tools/shoot.mjs`: 109 checks, `all checks pass`, no console error, both themes; it opens on Jul 2026
  with the stamp `Updated 06:23, figures to Jul 2026`; B1's check reads `Åsgard A`, its key `Show
  Åsgard`, selecting `NO-43765`. Headless Chromium on the build Mac, never phone evidence.
- `tools/.work/data-followup/dom_read.mjs`, serving a copy of `js/data.js` whose `repairText` returns
  its input: the Åsgard A card reads `Åsgard A` (key `Show Åsgard`, field `Åsgard`), the Gjøa
  platform's `Gjøa` (key `Show Gjøa`, operator `Vår Energi ASA`), the field's card `Gjøa`; 0 console
  errors; exit 0. So the names come from the data itself. Pictures: `dom/*-repair-off.png`.

### ART.md and NOTES.md, corrected in place

Each ART.md figure that names the opening month moves to Jul 2026, from the command it names, rerun
on the new data. Every Jun 2026 figure the pass printed is unchanged at Jun 2026 (`peaks.py` at month
665 gives the pass's output line for line), so nothing it measured was wrong; the app now opens a
month later.

| Where in ART.md | Was | Now (Jul 2026) | Printed by |
| --- | --- | --- | --- |
| The Peaks, liquids | Jun 2026: 205 rings; 70 empty, 72 under a tenth, 142 of 205 | 205; 68, 75, 143 of 205 | `python3 tools/.work/peaks.py` (`peaks-new.out`) |
| The giants, now | Statfjord 985 Sm³/d (0.7 %); Forties 2.0 %; Ekofisk 12.3 %; Troll 8.6 %; Johan Sverdrup 82.4 % | 2 561 (1.9 %); 2.2 %; 12.8 %; 8.8 %; 79.0 % | the same |
| Oil equivalent; gas | 179 rings, 111; 73 and 43 | 179, 112; 73 and 40 | the same |
| Ring contrast | 2 952 samples, the lowest 3.26 and 3.52 | 2 952, 3.26 and 3.57 | `shoot.mjs` |
| Discs inside rings | 76 of 135 | 79 of 137 | `shoot.mjs` |
| The stamp, wireframe and row | `Updated 26 Sep, 10:56, figures to Jun 2026` | `Updated 2 Oct, 06:23, figures to Jul 2026` | `shoot.mjs` (`Updated 06:23, …` the same day) |
| The time row | `408 000 Sm³/d, 426 fields`; `10.8 billion Sm³, 949 fields`; `NO, DK: 331 000 Sm³/d, 107 fields`; `June 2026` | `401 000`, `425`; `10.8 billion`, `950`; `NO, DK: 327 000`, `107`; `July 2026` | `shoot.mjs`; `tools/.work/review/lead.mjs` |
| The track's words | `June 2026`, or `July 2026, no UK figures yet` | `July 2026`, or `August 2026, no NO, UK or NL figures yet` | `shoot.mjs` |
| The card | `985`, `Liquids in Jun 2026.`, `Liquids to Jun 2026.`; spoken `June 2026: 985` | `2 560`, `Jul 2026`; `July 2026: 2560` | `card_read.mjs`; `shoot.mjs` |
| No supplement | the data adds `Å Æ Ø ” ¥ Ã` and three C1 bytes | `Å Æ Ø ”`, the rest named as gone | fontTools over the face's cmap: every character beyond ASCII in the data is in it |

`NOTES.md`'s note on the double-encoded names now says the names arrive as Sodir writes them, why
they once did not, and that `repairText()` stays as a guard with nothing to do.

### Left alone, and why

- ART.md's 947 rings at Jun 2026, the prototype over the stock map that led to the floor: a dated
  design record, not something the app or a tool prints now.
- ART.md's caption example `No UK figures for Jul 2026 yet.`: a form of the caption; with this data
  no month lacks one country only, and the form stays right for when one does.
- ART.md's ZIP row (`about 1 980 000`, about 433 000 to spare): still right at 1 980 247.
- ART.md's spoken example leaves out `, cross-border unit`, which the app says (the pass's own
  `shoot.out` printed it too): not the rebuild's; noted for the lead.
- `js/data.js`'s comment on `repairText` (lines 121 to 125) still describes the Latin-1 read as
  current: app code, outside this follow-up's files.
- The pipelines carry one repeated id, `NL-EPL0205_HS` (two unnamed 19.3 km EMODnet segments), as
  they did before.

### World Oil & Gas

`build_world.py` never calls `shapefile_records()` (Natural Earth arrives as GeoJSON, pinned by
sha256), and the coordinator asked for the proof. Run from `Template/` with the fixed code,
`--offline` from the existing cache into `tools/.work/data-followup/world-out/`
(`scripts/shelf_atlas/.venv`, Python 3.12.14; of the hosts it would fetch, naciscdn.org and
raw.githubusercontent.com answered, and the relief's GitHub fallback URL answers 404): `world.json`
is byte-identical to `world-oil-gas/data/world.json` (`cmp`; sha256 `926c3cb93f75…`), `relief.jpg`
byte-identical (`c92737899f1e…`), and `snapshot.json` and `fields.json` equal apart from
`generatedAt` (built in place, `write_json()` keeps the old stamp, so neither file would change).
Nothing was written into `world-oil-gas/`.

### For the lead, outside this folder

- `Template/HOUSE.md`'s budget row for Shelf Atlas: the ZIP is now 1 980 247 B (1 979 297 after the
  pass).
- `js/data.js` lines 121 to 125: the comment can say the read was fixed on 2026-10-02 and the
  function stays as a guard.
- `screenshots/*-{light,dark}.png` show the 2026-09-26 data (Jun 2026); `SCREENSHOTS=1 node
  tools/shoot.mjs` refreshes them. Not run here.
- The marketing camera needs nothing: it steps back a year from the opening month (Jul 2025 now).
- The opening-month pins in `test_decode.mjs` and the opening-view figures in ART.md move whenever
  the weekly build moves the newest common month (next when Sodir, NSTA and NLOG publish Aug 2026);
  deriving them from the data, as `shoot.mjs` now does, would stop that.
- The build gives a host 15 s (four tries); EMODnet's bathymetry server needed more today.

### Phone checks this adds (none claimed)

- A Norwegian platform's card (Åsgard A) and a pipeline's (to Kårstø) on the iOS 18 floor device in
  both themes: the names in the house face, nothing garbled.
- The app opening on Jul 2026 with the stamp `figures to Jul 2026` on the device.

### The lead's pass on the follow-up (2026-10-02)

The lead re-ran the three tools (`node tools/check.mjs`, `node tools/test_decode.mjs`, `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: all pass, no FAIL line), counted `Ã` in `data/geo.json` (0) and read `ÅSGARD ERB` from it, and checked the three sha256 values above. The `repairText` comment in `js/data.js` was describing the Latin-1 read as current; it now says the read was fixed on 2026-10-02 and that the guard stays for a data file built before the fix. With that comment the app code is **183 869 B** and the ZIP **1 980 292 B** (`node tools/check.mjs`); `ART.md` section 6 and `HOUSE.md`'s budget row carry these. The README panes, the composite and the before/after picture were shot before the data copy and show the opening on Jun 2026 with the old figures; they stand, because the weekly build moves the data every Monday anyway and the pictures describe a date, as every live app's do. The public repository's log shows no weekly data commit for Shelf Atlas since the app landed on 2026-09-26, so the lead checked the workflow's runs separately (recorded in plan 0011 and CURRENT_STATE).


## Plan 0012 package 3.7: the text cut, 1.2 (2026-10-07)

The change list in `docs/plans/0012-change-lists.md` (Shelf Atlas), applied in full. The ground stays
gray (D6). The bugs on record: plan 0009 item 5, `docs/review/` and the matrix (row 162, the phone
pass) name none open; B1 to B14 stay fixed (B3, the credit line cut off, is now moot: it is in About,
whole).

- **The credit line (F1).** `#credits` and both writes are gone (the band's label loses "and
  credits"); `creditLine()` is unchanged and its result is written into
  `<p id="about-credit-line" translate="no">`, first under *Sources and credits*, where the two writes
  were (for a snapshot, and for none). `#about-sources` still prints every source's statement.
- **The read line becomes notes and a key (F4).** `readline(m)` returns the notes (the missing or late
  countries; `No country is shown; turn one on in Map layers.`) and the key as [swatch, word] pairs;
  `setReadline()` writes them, and nothing while both are unchanged (a signature in `data-sig`):
  - Rate: a disc, `The month’s rate`; with the Peaks, a ring, `Best month so far, from 4 180 Sm³/d`
    (the figure as before, `U.amount(model.hi[qty] * RING_FLOOR, …)`).
  - Cumulative: the disc, `Produced to date`; a shut disc, `Shut down`. `Rings show with Rate.` goes
    from the line (the Peaks key's description says it).
  - **The key is drawn in the map's own marks** (the list's risk): `applyTheme()` sets `--k-rate` (the
    ramp's middle stop, `ramp[8]`, at the discs' `circleAlpha`), `--k-best` (`ring`, as a 1 px border)
    and `--k-shut` (`P.shut`, the shut fill at its alpha), so they follow the theme with the plate.
    `shoot.mjs` compares the computed swatch colors with `THEMES`.
  - The items are separated by a space as well as their 9 px margin: driven in WebKit, the line's text
    read `The month’s rateBest month so far…`, one word to a screen reader.
  - **Departure, measured:** the key's items wrap between their words (each swatch glued to its first
    word in a `nowrap` span). With every item `nowrap`, the longest note plus both items took three
    lines at 320 and 312 px (`No Norwegian, Danish, UK or Dutch figures yet.`, and `No NO, UK or NL
    figures for Aug 2026 yet.` in bbl/d). As built every form fits the fixed 30 px at every width
    `shoot.mjs` opens, and the height rule (30 px, 15 from 640) is unchanged.
- **On its side** the caption band is plain flow: the legend, then the line (the credits' second
  column is gone). The plate is 234 px (233 before).
- **Prose (F5):** `NOTES.md` (what the app prints; the credit line in About), `HANDOFF.md` (sources in
  About), `ART.md` (the Peaks' caption test, the wireframe, the caption line's key, the credits row,
  About, focus mode, on its side, the plate figures).
- **Version (F6):** 1.2; `check.mjs` item 6 pins it.

**Checks changed (F8).** `check.mjs` item 8: `creditLine(snap)` and `creditLine(null)` into
`#about-credit-line`, the paragraph first under the head, no `#credits`, and no source name on the
front of `index.html`; item 6 pins 1.2. `shoot.mjs`: the boot check reads the credit in About (was:
on screen whole, B3); new, the stamp one 16 px line in six states (loading, the failure, fresh, map
only, and the stale forms); focus mode's "stays" list drops `credits`; new, the key's words and swatch
colors against `THEMES` in Rate and Cumulative. The caption checks (the plate holding still, every form
inside its height, the late month's note) run unchanged on the new form.

**Not this pass's, for the lead:** `check.mjs` item 5 fails on `data/geo.json` and
`data/snapshot.json`, whose sha256 pins are the 2026-10-02 follow-up's while the weekly build rewrote
both on 2026-10-06 (`generatedAt` 2026-10-05T12:34:51Z); and `tools/test_decode.mjs` fails one
assertion, `M.defaultMonth === Jul 2026`, because that data opens on Jun 2026. Both read the data
alone, which this pass did not touch (the files' mtimes are 2026-10-06), and the change list forbids
touching data, so the pins are left for the lead to re-pin or to derive from
the data. Every other check passes.

**Measured** (headless Chromium): the plate 560 → 590 px at 390 × 844 (+30, as the list said), 650 →
680 in focus mode, 234 on its side. App code 184 934 B of 200 000; ZIP 1 980 049 B.

**Camera strings:** none changed (`Play`, `Back one year`, `Forward one year`, `Cumulative`, `Rate`).

### Plan 0012 3.7, the fixer's pass on QA's finding (2026-10-07)

- **`tools/test_decode.mjs`, section 3:** the opening-month assertion no longer pins Jul 2026. It
  works the month out from this file's own decode (`common`, the earliest of the four countries'
  last reported months, no later than `lastMonth`) and checks `M.defaultMonth` and `commonMonth`
  against it, as the 2026-10-02 follow-up recommended. On the 2026-10-05 weekly build it reads
  Jun 2026 (UK last Jun 2026, NO and NL Jul 2026, DK Aug 2026). `node tools/test_decode.mjs`:
  `all checks pass`. The Peaks' checks at Jun 1985, Jun 2000 and Jul 2026 stay pinned: they check
  dated figures in ART.md, not the opening month, and they pass on this data.
- **`tools/check.mjs` item 5, the data hashes: not re-pinned here.** They guard the committed data,
  and re-pinning them to the 2026-10-05 build (`geo.json` 5fc27bb1…, `snapshot.json` 43429ac9…) is
  the lead's call. Both files read clean (0 `Ã`; `ÅSGARD ERB` spelled right). Note for the lead: the
  UK's newest month went *back* from Jul 2026 (10-02 data) to Jun 2026 (10-05 build), which is why the
  app now opens a month earlier; ART.md's opening-view figures are the 2026-10-02 data's at Jul 2026.

## The lead after package 3.7 (2026-10-07): the data re-pinned, the UK's July

- `check.mjs` item 5 failed on stale pins, from before 3.7: `data/geo.json` and `data/snapshot.json`
  in Template/ are the public template's weekly build of 2026-10-05 (`c52cfcf`, generatedAt
  2026-10-05T12:34:51Z), byte for byte, pulled in by plan 0012's package 1. They are pinned now
  (5fc27bb1… and 43429ac9…).
- **The UK's July 2026 left the source between the builds.** On 2026-10-02, 179 UK fields reported
  July; on 2026-10-05 the UK's newest month is June (176 fields), while Norway and the Netherlands
  still end in July and Denmark in August. So the app now opens on Jun 2026, the newest month every
  shown country has reported (`M.defaultMonth`), which is correct for the data it has.
  - Recheck on the next weekly build. If July does not come back, or months keep vanishing, look at
    the NSTA fetch before the source.
- ART.md's opening figures are dated (2026-10-02's data) rather than re-measured. test_decode now
  derives the opening month from the data, the fixer's change, so it no longer pins Jul 2026.
