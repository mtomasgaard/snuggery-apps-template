# World Oil & Gas: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look as built; this file
holds the record: the lead's rulings, the owner calls as the pass left them, the as-built departures,
the phone checks, and (below the second rule) `ART.md`'s sections 8 and 9 as the art pass wrote them,
moved here word for word by the builder's step 25. Below the third rule: the history `ART.md` still
carried at the final review, moved here word for word on 2026-10-02, and the record of the follow-up
that answered the final review. Plan 0011 package B, D1 to D5 and `Template/HOUSE.md` are the brief.

## The lead's ruling on the code cap (2026-10-02, plan 0011 D17), and what the build measured

The ruling, as it stands in `ART.md` section 6: the cap stays at the house's 200 000 B until the build
has measured; the builder applies the whole change list, cuts no feature and never minifies; if the
code measures over after the list's own trims, the lead rules on the figure. **The build measured
under it: 197 402 B of app code, `app.js` 116 462 B** (`node tools/check.mjs`), so no raise is needed and
the 150 000 B that `NOTES.md` states for `app.js` holds too; `check.mjs` enforces both. Within 5 % of
the cap, as HOUSE 8 asks to say: 2 598 B of headroom. Comments were written short where new code was
written; no stock comment was stripped to fit, and nothing is minified. The art pass's estimate (about
203 000 B) was high because `app.js` lost the data contract, the decode, the series, the estimate and
the search folding to `js/data.js` and kept no stock CSS or DOM builders that the house replaced.

## As built (the builder, 2026-10-02)

Every step of the change list (section 8 below) is applied. Written in this folder: `fonts/` (the
house face and `OFL.txt`, byte for byte from `global-weather/fonts/`, `cmp` clean), `js/units.js`,
`js/data.js`, `js/track.js`, `index.html`, `style.css` and `app.js` rewritten, `NOTES.md`, `PROMPT.md`,
`miniapp.json` (version 1.1, the description naming the year's shares), `ART.md` (corrected in place,
sections 8 and 9 moved here), `tools/check.mjs`, `tools/test_decode.mjs`, `tools/shoot.mjs`, this
file, and `screenshots/*-{light,dark}.png` from `SCREENSHOTS=1` (the nine stock pictures, which only
this folder named, removed; `screenshots/app.png`, the README's composite, untouched at sha256
`f66365fd…`). No file outside this folder was written. No data, `raw/`, pipeline or snapshot file
changed: the four data files are byte-identical to the hashes in section 8, which `check.mjs` pins.

**Departures from the change list and from `ART.md` as the art pass wrote it** (each corrected in
`ART.md` where it states a figure):

1. **The Ledger's row is 30 px, with a 4 px gap**, not 29: the chosen country's tracer runs 2 px
   under the strip (2 px tall, its 4 px disc), so the labels start 6 px under it, not 3.
2. **The lead's field count is every unit drawn filled in the year shown** (6 015 in 2024), not the
   stock's 4 387, which left out the undated units while drawing all of them. With B5 the undated
   units are drawn from their data year, so they are counted from then; the Map layers' sentence
   names them apart (`1 628 without dates appear in their data year (1 628 by 2024)`).
3. **The relief JPEG is read only once Terrain shading is switched on.** The stock app fetched and
   decoded the 4096 × 2048 image on every load whatever the switch said; a library that never turns
   the relief on now never decodes it. About says so while it is off.
4. **A broken replacement of any of the three files keeps what was showing and says so**
   (`… Showing the figures as last read.`). `ART.md` said "as the stock app does"; the stock app in
   fact dropped what it had (`prod = null`) and showed outlines only. HOUSE 4.9's rule is now the
   app's, and `shoot.mjs` drives it.
5. **The credit line wraps to two lines at phone widths**, and loses `Global Energy Monitor` when
   the fields are switched off (it credits what is drawn, as the stock did), so that one toggle
   resizes the plate by a line, once. The caption line keeps its fixed height, so nothing that
   changes with the year resizes anything; `shoot.mjs` compares each name at its own place in each
   picture for B6.
6. **No `--land` token**: the Map layers key needed no plain-land sample; the caption says what
   plain means. The key's fuel samples take their colors from `THEMES` as `--s-*` properties.
7. **The tracker page prints as `www.gem.wiki/…`**, the stock prefix without its scheme, rather than
   `gem.wiki/…`: that is the host the stock app linked; data addresses print with only the scheme
   stripped.
8. **A field's card says `Reported for 2024.`** when the year shown is its report year (the
   estimate equals the report then), and the estimate's line names the report's own year (`from the
   2025 report`), never the year it is clamped to.
9. **The tracker comparison in a country's details stays in kboe/d**, the one unit both files carry
   (the country figure energy-equivalent, the tracker's barrels volumes; the sentence says the share
   is indicative). The rows above it follow the units key.
10. **The track draws `1900` at its start and `2024` at its end**, each held inside the track, where
    the art pass's "labels that would leave the track skipped" would have dropped `1900`.
11. **Find's dialog is titled `Find`**; its key keeps the name `Find a field, company, basin or
    country` (the visible word first, WCAG 2.5.3).
12. **Test hooks added to `window.__wog`** beside the ones the change list names: `ready`, `pick`,
    `field`, `home`, `labels`, `log`, `flying`. Nothing in the app calls them.
13. **`js/units.js` writes U+202F and U+2212 as escapes**: a literal narrow no-break space was lost
    once while the file was written (the caption broke between `1` and `%`); an escape cannot be.

**Measured** (the builder's last runs, 2026-10-02, on this Mac; headless Chromium is never phone evidence):

- `node tools/check.mjs` from this folder: 44 checks, `all checks pass`; app code 197 402 B
  (cap 200 000), `app.js` 116 462 B (cap 150 000), fonts 40 075 B (cap 160 000), the ZIP 2 145 501 B (the last run; `ART.md` ships inside it, so it says "about 2 145 500")
  (cap 2 622 870), 16 files.
- `node tools/test_decode.mjs`: 18 checks, `all checks pass` (the shapes; every country ring
  decoded against the test's own decoder, 4 240 rings, 269 237 points; the series and the world in
  all modes; B1 on all 159 series that end early; `ledgerAt` against the test's rule-B partition in 60
  cases and the figures of `ART.md` section 1; B5 on all 1 748 undated units; the estimate; 29
  values of `js/units.js`; the dates; the credit line).
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: 101 checks, `all checks pass`, both themes,
  with the scrub (2, 8 and 20 years a second by real touch, 0 frames whose label, `aria-valuenow` or
  Ledger differ from the year drawn), Reduce Motion, the broken files, the widths and the phone on
  its side. The Ledger sampler: 100.0 % of 1 005 (1920) and 843 (2024) samples of its ink at 3:1 or
  more against the page, the lowest 15.44 and 14.11 (light), 15.04 and 13.75 (dark). Load to the first
  frame 523 to 536 ms, a year's frame 0.5 to 1.2 ms median: headless figures, a trend only.
- `python3 world-oil-gas/tools/art/palette.py` from `Template/`: `ALL CHECKS PASS`, untouched by the
  build; `app.js`'s `THEMES` is its `--json`, pasted.

**The owner calls (section 9 below) as the build left them**: 1, the code cap, settled by the
measurement (no raise); 2 to 12 applied as the art pass recommended (the Ledger; SI first, a stored
`kboe` kept; undated fields in their data year; Cumulative holding a series' total; the rim always
drawn and `wog.rings` retired; focus mode keeping the Ledger and dropping the legend's bar; the field
key in Map layers; the relief as gray shading; the highlight without its chip; the credit line's
middle dots kept; Page Up and Page Down a decade). Each is still the owner's to reverse.

**The camera** (`Tests/SnuggeryUITests/`): every string it reads for this app survives with its role
(`Play`, then `Pause` on the same key; `Show the controls`, added by this pass and already in
`waitForWorldOilGas()`), so no camera change is needed in the commit that lands the pass. The lead's
note in `ART.md` section 5 stands: the README pane plays from the year the app opens on, and the app
remembers the year, so the pane should put the year back (a tap on the `Year` track near its end).

**For the lead, outside this folder** (not written by the build): `Template/README.md`'s entry for
this app gains a sentence on the Ledger; `HOUSE.md`'s budget row for World Oil & Gas (the figures
above); the camera's year put-back; the README panes, the composite and the before/after pair; the
public mirror per MANUAL_STEPS section 32.

**Phone checks** (none claimed; the owner's iPhone on iOS 26 and an iPhone on iOS 18, the floor): the
list in section 9 below, plus: the relief's first switch-on (the JPEG's fetch and decode now happen
then, not at load); the credit line's two lines and the Ledger's 30 px row at the phone's own text
size; Find's 16 px field not zooming the page.

---

## After QA (the builder, 2026-10-02)

QA's verdict was **pass with no findings**: no must, no should, nothing declined. QA re-ran all three
tools and got the builder's figures exactly, hashed the four data files against `check.mjs`'s pins,
grepped the shipped text for vendor names and British spellings, checked the camera's strings and
roles in `index.html` and `app.js`, and drove the app with its own Playwright script (B1 and B2
fixed by eye, the relief fetched 0 times before Terrain shading and once after, the plate's one-line
resize when fields go off). So nothing in the app, `ART.md`, `NOTES.md`, `PROMPT.md` or
`miniapp.json` changed after QA, and the figures in "As built" above stand.

Re-run after QA, from `Template/world-oil-gas/`:

- `node tools/check.mjs`: 44 `ok`, `all checks pass`; app code 197,402 B (cap 200,000), `app.js`
  116,462 B (cap 150,000), `fonts/` 40,075 B, ZIP 2,145,501 B (cap 2,622,870), 16 files.
- `node tools/test_decode.mjs`: 18 `ok`, `all checks pass`.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs` (without `SCREENSHOTS=1`, so the shipped screenshots
  were not rewritten): 101 `ok`, `all checks pass`, both themes; the scrub at 2, 8 and 20 years a
  second by real touch with 0 frames whose label, `aria-valuenow` or Ledger differ from the year
  drawn; load to the first frame 525 and 520 ms (headless Chromium on this Mac, a trend, never
  phone evidence).

## After review (the builder, 2026-10-02)

The final reviewer's verdict was **fix**: one must, five shoulds, four nits (its drives, logs and
pictures are under `tools/.work/review/`). Every must and should is applied; one suggestion inside a
should is declined with its reason; the camera nit is the lead's. My own drives are under
`tools/.work/fix/` (`verify.mjs`, `few.mjs`, `chosen.mjs`, their logs and `shots/`), and every new
assertion is now in `shoot.mjs`'s "after review" block. **Each of those assertions was run once against
the pre-review `app.js` and `style.css`** (copied back for one run, `SCHEMES=light SCRUB=0`, then
restored and `cmp`-checked; log `tools/.work/fix/shoot-prefix.log`): all twelve failed there, so they
pin the fixes rather than pass either way.

**The must: a finger could not scroll a short details sheet.** Applied, two ways.

- **The chart's drag to set the year is cut**, not gated. It is the first cut owner call 1 names
  (section 9 below: "the chart's drag to set the year (about 600 B; the track does it)"), the
  reviewer offered it, and the gated version (a `pan-y` chart that scrubs only after 8 px of mostly
  sideways movement) was written, measured and put the code at 201 013 B, 1 013 B over the cap. The
  chart is now a picture (`role="img"`, its sentence unchanged) with the default `touch-action`, so
  an upright swipe on it scrolls the sheet. The track sets the year as before.
- **Room for the sheet on a short screen**: upright at most 760 px tall with a sheet open, the plate's
  row is `minmax(150px, 1fr)` instead of 220, and the legend's bar and ticks leave (its title stays),
  as in focus mode. The 220 px floor HOUSE 4.13 sets is for a phone on its side, which this rule does
  not touch (`orientation: portrait`); B16's own floor at 320 x 568 is 150 px and holds.
- Measured (`verify.log`, real touch, Norway's details, a swipe up through 60 % of the body): 375 x 667
  scrollTop 0 to 64, the year 2024 to 2024, body 168 of 542 px in view (the review: 84, and the year
  went to 1951); 390 x 719 (the owner's iPhone under Snuggery's navigation bar, the reviewer's
  estimate) 0 to 61, body 220 (was 136); 375 x 603 body 104 (was 20); 312 x 675 body 160 (was 76);
  320 x 568 body 53; 390 x 844 unchanged at 220 px of plate, 0 to 61. A tap on the chart leaves the
  year. `shoot.mjs` asserts the swipe at 375 x 667 and 390 x 719.

**Should 1: a tap on a producing country opened a nearby field.** Applied in part.

- `fieldAt()` takes its 14 px near-field reach only where no country with a series is under the
  finger, or once zoomed in to the outlines (`OUTLINE_SCALE`); otherwise a field wins only inside its
  disc and 2 px round it, as before.
- A tap on a drawn country name opens that country (each placed label keeps its country's index).
- Measured with the reviewer's own `reach.mjs`, unchanged (2024, the opening view, 390 x 844, a 5 px
  grid): Russia 39 % to 72 %, Saudi Arabia 21 % to 67 %, Iran 10 % to 57 %, China 13 % to 57 %, Norway
  33 % to 58 %, Algeria 17 % to 63 %, Kazakhstan 35 % to 70 %, Nigeria 8 % to 39 %, Iraq 0 % to 17 %,
  Oman 0 % to 7 %; the United Arab Emirates (3 grid points) and Kuwait (1) still 0. What is left is
  the discs themselves: at the opening zoom the Gulf states lie under their own fields' discs, and a
  tap on a disc is how a field is reached. Those countries open from their names where drawn, from
  their Ledger block (should 2, below), and from Find. `shoot.mjs` asserts that every Ledger producer
  with 50 or more grid points of its own opens on half of them or more (Russia 69 %, Saudi Arabia
  70 %, Iran 53 %, China 57 %, Norway 63 %, Algeria 62 %, Kazakhstan 71 %), and that each of the 17
  names drawn at the opening view opens its own country's card.
- **Declined: the country in a field card's place line as a text key.** With 396 B of code headroom
  left, and the strip and the names now reaching every Ledger producer, it is the one part of the
  suggestion not built. It is about 300 B and would be the next thing to add if the cap ever moves.

**Should 2: the Ledger named too few blocks and could not be tapped.** Applied.

- The three widest blocks (other than the chosen country's, which keeps its own label) are named
  wherever a label can start inside the block: at the first free x inside its own span, in the
  fullest forms that fit together (name and share, then the name, then the share), earlier blocks
  first; the combination naming the most of the three wins. Every other block keeps the old rule.
- Measured over every year at 390 px (`verify.log`): the second block named in 125 of 125 years in both
  Annual and Cumulative (the review: 85 and 98), the third in 121, 2.97 of the first five on average
  (was 2.26). The unnamed third blocks (1900 to 1902 and 1927 Annual, 1900 to 1903 Cumulative) are 5
  to 16 px wide next to a label or the strip's end, where no label can start inside them
  (`few.mjs`). `shoot.mjs` asserts every block of the three that is 20 px wide or more is named in
  every year, in both modes.
- A tap on the strip opens the card of the block under the finger, the USSR's too (it has no outline
  to tap); the hatched end opens nothing. The canvas stays `aria-hidden`; Find is the keyboard's way.
  About says `Tap a block for that country's card.` `shoot.mjs` taps the first six blocks in 1973 and
  2024 and checks each card, and the hatched end.
- Found while doing it, by my own drive, before anything was run by anyone else: the first version
  declared a `top` that shadowed the strip's own and threw on every draw (a temporal dead zone), and
  the second sorted the label boxes in place, so resetting them dropped the chosen country's box and
  let a label overprint it (Qatar over Norway at 375 px). Both fixed; `chosen.mjs` shows the chosen
  label clear of the others for Norway, Iraq, the United States and Russia at 375 and 390 px.

**Should 3: plain land was never explained on screen.** Applied.

- The caption line's forms are now tried in this order, the longest that fits its fixed two lines
  winning: the bar's sentence without `largest first` (the strip shows that itself), then `Plain: no
  figure, or none.`, then `Field sizes are estimates.` while they are; without the estimate; the old
  form with `largest first`; the bar alone. At 390 px in 2024 it reads `Bar: shares of the world's oil
  and gas in 2024; hatched, all under 1 %. Plain: no figure, or none. Field sizes are estimates.`,
  inside its two lines, as is every form `shoot.mjs` measures at 320, 360, 375, 312 and 844 px.
- In any year a former state holds the figure while its lead member has none, the caption leads with
  `The USSR's lands are plain: its figure is in the bar.` (1900 to 1984; `Czechoslovakia's lands …` in
  1985 to 1992, both modes, `tools/.work/fix/notes.mjs`), with the fields on or off. A highlight or a filter note still comes first when one
  is set.
- Left open as an owner call (below): the reviewer's "honest drawing", filling the members' outlines
  with the former state's figure in those years.

**Should 4: the upright legend had no tick between 100 and 20 000.** Applied: below 640 px the
legend's title takes its own line and the bar runs the full width, so at 390 px it reads `≤ 2 / 10 /
100 / 1 000 / ≥ 20 000 TWh/yr` (the review: `≤ 2 / 10 / 100 / ≥ 20 000`); `10 000` still touches the
open end and is left out. It costs 9 px of plate (526 to 517 at 390 x 844; `shoot.mjs` holds 480).
`ART.md` section 3's tick list, which claimed six, now says what is drawn.

**Should 5: the Layers counts did not add up.** Applied: `6 047 fields on the map by 2024, 1 628 of
them without dates (shown from their data year); 6 015 producing; 6 055 of 7 055 pass the filters.`
(`countFields()` lost its `discovered` and `undatedShown` counts). `shoot.mjs` checks the three
figures against its own count from `data/fields.json` (6 047, 1 628, 6 015).

**The nits.** The caption line and the Ledger's spoken sentence say `all listed countries'` when the
snapshot has no world series (`shoot.mjs` serves one without it: `All listed 92 700 TWh/yr`, `Bar:
shares of all listed countries' oil and gas in 2024; …`, `Shares of all listed countries' oil and gas
in 2024: …`). A field's spoken sentence starts its last sentence in upper case (`… onshore. No rate
reported.`; `Found by 2024. Found, not yet producing.` too, which had the same fault). `miniapp.json`
says `1900 to the latest year` (140 characters). The camera's wait is the lead's: `ART.md` section 5
says what to wait for (`figures to`, as Global Weather's camera waits for `Updated`); no camera
string changed, so the camera needs no change for this commit.

**`ART.md` corrected in place**: section 1 (the caption quote, the labels rule with its measured
figures, the tap, the no-world sentence), section 3 (the frame, the plate's rows, the legend, the
caption line's forms, what a tap opens, the details sheet on a short screen, the chart, the counts
sentence, and the notices row's "as the stock app does", which departure 4 above had already found
untrue), section 5 (the lead's camera note), section 6 (the after-review budget).

**Measured after the review** (2026-10-02, from `Template/world-oil-gas/` unless stated; headless
Chromium is never phone evidence):

- `node tools/check.mjs`: 44 `ok`, `all checks pass`; app code 199 604 B (cap 200 000: 396 B of
  headroom, within 5 %), `app.js` 118 094 B (cap 150 000), `index.html` 18 075, `style.css` 24 406,
  fonts 40 075 B, ZIP 2 148 453 B (cap 2 622 870), the data files' hashes pinned and unchanged.
- `node tools/test_decode.mjs`: 18 `ok`, `all checks pass`.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: exit 0, 114 `ok`, 0 `FAIL`, `all checks
  pass`, both themes, with the scrub at 2, 8 and 20 years a second (0 frames whose label,
  `aria-valuenow` or Ledger differ from the year drawn); the Ledger sampler 100.0 % at 3:1 or more,
  the lowest 15.44 and 14.11 (light), 15.04 and 13.75 (dark); load to the first frame 529 and 529 ms,
  a year's frame 1.10 ms median (headless, a trend only); `screenshots/app.png` untouched at
  `f66365fd7c1c…`. Log: `tools/.work/fix/shoot-final.log`.
- `python3 world-oil-gas/tools/art/palette.py` from `Template/`: `ALL CHECKS PASS`.
- `shasum -a 256 fonts/*`: `fdf1a28c…` for the face, `d1adfffd…` for `OFL.txt`. The data files' dates
  are still 28 Sep and 1 Oct, before the pass.
- `screenshots/*-{light,dark}.png` rewritten by that run (the same 18 names; `app.png` never).

**Owner calls after the review** (each still the owner's to reverse):

- The chart's drag is cut (owner call 1's first cut). To have it back, the gated version (above)
  costs about 1 000 B, which needs either a raise of the cap or a cut elsewhere.
- On a short upright screen with a sheet open the legend's bar leaves and the plate goes to 150 px.
  The alternative keeps the bar and gives the sheet about 40 px less.
- Plain land under a former state: the caption now says so in words. The alternative the reviewer
  named draws the members' outlines in the former state's own color in those years (one territory,
  one value, the card saying so); it changes what the map encodes, so it is not the builder's call.
- The field card's country as a key into the country's card (declined above for budget).

**Phone checks added** (none claimed; the owner's iPhone on iOS 26 and an iPhone on iOS 18): the
details sheet in Snuggery's default view, under its navigation bar, scrolled by a swipe through the
chart; the plate at 150 px with a sheet open on an SE-sized phone; a tap on a Ledger block, a narrow
one included, opening its card at the phone's own text size; the Ledger's labels at DPR 3; the legend
on its own line at 390 px.

## Moved from ART.md at step 25, word for word (sections 8 and 9 as the art pass wrote them, with the lead's D17 note)

## 8. The change list (the builder applies these in order)

Nothing in `data/`, in `raw/`, in `scripts/shelf_atlas/` or in `screenshots/app.png` changes; the
snapshot and the loop are untouched. **This pass writes no pipeline file.** The app's text the
pipeline generates (each source's name, license, attribution and detail in `snapshot.sources`; the
fields' source and units notes; the country names) is printed as data. Its British spellings (the
sources' license key and its values, spelled the British way in `snapshot.json` and `fields.json`)
are allow-listed by file and word in `check.mjs`; the code that reads that key keeps its spelling, as
the data's key (HOUSE 6.3), allow-listed in `app.js` and `js/data.js` by that one word. Before step 1,
the data's hashes are recorded (`shasum -a 256 data/*`, 2026-10-02); `check.mjs` pins them:

```
19f1a6459a2eaa2a0a37e6682d39a848e052d6aa736938563d887aa0aa44aa23  data/fields.json
c92737899f1ee7722f05db2a4bf76cbc8a4419d3f13bbcd8f16f97731e7184c9  data/relief.jpg
adb9e6ee40ba21274c471445c6c3f3ed09648f1263fe83f96739d03821db175c  data/snapshot.json
926c3cb93f753f722379f751ba90de427fb05b121f2fe4dcf43958d7e0352c96  data/world.json
```

**The bugs on record and found here, which this pass must fix.** The review records hold one for this
app: plan 0009 item 5, *"World Oil & Gas's cumulative mode blanks Sweden and Ireland after 2017
(`seriesAt` returns null past a series' last year)"*, carried into this pass by plan 0011 D8.
`docs/review/` has no entry for it (`grep -n -i "world oil\|wog" docs/review/*.md`: nothing); the app
has no `DECISIONS.md`, and `NOTES.md` records data gaps, not app bugs. Reading the app and its data
as a stranger found the rest. Each is a must, and each names its evidence.

- **B1. Cumulative blanks every series that has ended.** The bug on record is wider than two
  countries: 159 of 219 series end before 2024 (156 in 2016, the former states in 1991 and 1992;
  `python3 tools/.work/ledger.py`, the last lines), and `cumOf()` builds a running total only as long
  as the series, so `seriesAt()` returns null from the year after. At Cumulative 2024 the stock map
  shows France, Spain, Sweden and Ireland as having no data (`window.__wog.countryColour('FRA')`
  returns `st: 2`; `look.log`, the line that starts `light cum 2024`). **Fix in `cumOf()` / `seriesAt()` (in `js/data.js`)**: past a
  series' last year the running total holds its last value, exactly as a null year inside a series
  adds nothing (the app's own rule, About's words); the card's `Series` row says `1900 to 2016; later
  years are not in it` and its figure's line `to 2024, with no figures after 2016`; *Worth knowing*
  names how many series stop in 2016. The map, the card, the ranks and the Ledger all read the held
  total. `test_decode.mjs` asserts France's total to 2024 equals its total to 2016 (4.08 PWh).
- **B2. The Play key never shows its pause mark.** `setPlaying()` sets `$('ico-play').hidden`, an
  expando on an SVG element (SVG elements have no `hidden` property), so while playing the key is
  named `Pause` and still draws the triangle (`look.log`: `playDisp: block, pauseDisp: none`).
  HOUSE 4.6's rule: toggle by attribute on the wrapper; `shoot.mjs` asserts it by computed style.
- **B3. About does not hold play, and hidden does not stop it.** `showAbout()` leaves `playing`;
  nothing listens to `pagehide`; and `tick()` adds `(now - lastFrame)` whole, so a return from the
  background jumps by eight years for every second away (from 1900, 16 s away lands on 2024 and stops
  play). Items 10 and 15.
- **B4. Four sentences promise hatching the map never draws.** `drawCountries()` paints "no data" and
  zero alike as plain land (its own comment, line 1221) and `hatchPattern()` is never called, yet the
  country sheet says `it is hatched in every year` (line 1719), About `their successor states are
  hatched before their own series begin` (2108), *Worth knowing* `earlier years are hatched on the
  map` (2172) and that a partial total `is hatched over` its color (2185), and the legend's `No data (plain)` swatch is
  drawn hatched (1472). The words become `plain` and say that the card tells no figure from zero;
  `hatchPattern()`, `hatch`, `hatchInk` and `nodata` go. Item 17.
- **B5. Fields without dates are drawn as producing in every year.** `fieldYears()` gives the 1 748
  undated units (1 628 passing the default filter) `appear = fill = -Infinity`, so in 1906 the map
  shows them as small filled discs across Nigeria, Angola and Southeast Asia (`look/light-12-landscape.png`)
  beside the 49 fields actually found by then. **Fix (owner call 4, recommended)**: while the fields
  follow the year, an undated unit appears and fills at its estimate's own start, the year before its
  data year (`es = prodYear - 1`; `prodYear` 2025 clamps to 2024), and a unit with neither dates nor a
  data year appears only in the newest year; the counts sentence names them (`1 628 without dates
  appear in their data year`).
- **B6. Country names are drawn under the field discs** (`render()`: labels before `drawFields()`), so
  `Egypt`, `Libya`, `Pakistan` and `Saudi Arabia` lose letters at the opening view
  (`look/light-0-open.png`). Names draw last, on halos, and are kept out of the card's, the key
  column's and the ghost key's rectangles.
- **B7. The credit line is cut off** at every phone width (`creditsCut: true` at 390 and 320 px,
  `look.log`): `Global Energy Monitor` is never on screen held upright. Item 11.
- **B8. Controls under 44 x 44**: 13 at 390 px (`look.log`'s `small`: the stamp 24 px tall, the five
  mode and accumulation buttons 34 to 36, the four map keys 40, the slider 32, the credits 26, the
  legend 39). Items 6 to 15; `shoot.mjs` counts.
- **B9. Numbers and dates break SI and the house's forms**: `151,666 kboe/d` (comma groups),
  `Sep 26, 2026` and `Sep 26, 2026, 11:18 PM` (the phone's locale: `Intl`, `toFixed` and
  `toLocaleString` on nine lines of `app.js`), `4.3%`, `10k`,
  `1M boe/d`, `57,041 bbl/d`, the barrel first where SI is the house's first unit. Items 3 and 12.
- **B10. Scheme addresses in a shipped script**: `app.js` lines 61, 920 (`https://www.gem.wiki/`),
  1870 (the SVG namespace), 2054 (`https://creativecommons.org/…`) and 2072
  (`https://www.naturalearthdata.com/`), which HOUSE 7.1 item 2 forbids; and the data's addresses
  printed with their schemes in About and in the field sheet. Items 13 and 15.
- **B11. Middle dots, em dashes, tracked capitals and characters the face does not draw** in the
  app's own strings (section 7; 16 middle dots in `app.js`, 8 of them in shown strings; ▸ and ⓘ).
  Items 7 and 17.
- **B12. The accent blue, red and amber, glass and shadows** (section 2). Items 6 and 7.
- **B13. A touch stops a flight midway** (`canvas` `pointerdown` cancels `flyRaf`), where the house
  ends it at its destination. Item 15.
- **B14. A stray space**: `so the total counts gas only .` (`countrySheet()`, both branches). Item 13.
- **B15. `NOTES.md` misstates the code budget**: "the build fails rather than ship over budget" for
  `app.js`'s 150 KB, which no build checks (section 6). Item 18.
- **B16. The sheet covers 60 % of the plate** whenever a country or field is tapped
  (`look/light-3-norway.png`). Items 13 and 14.
- **B17. VoiceOver**: the stamp's `aria-label` hides its date; the credits' `aria-label` replaces
  their words; the legend is a `div role="button"`; the whole sheet is `aria-live` and speaks on
  every year of play. Items 6 and 10 to 15.
- **B18. On its side the plate is 167 px** at 844 x 390 (`look.log`'s `landscape` rects), under the
  house's 220. Items 7 and 16.

**The steps:**

1. **`.gitignore`** (new; written by this art pass): `tools/.work/`, `tools/node_modules/`, `dist/`,
   `.DS_Store`.
2. **`fonts/`** (new): copy `../global-weather/fonts/ysabeau-office-gw.woff2` and
   `../global-weather/fonts/OFL.txt` byte for byte (`cmp` both). No supplement.
3. **`js/units.js`** (new), the one writer of numbers, units and dates, on Global Weather's and
   Shelf Atlas's pattern: U+2212 for negatives (never −0); U+202F between number and unit and in
   thousands from four digits (`94 100 TWh/yr`, `57 000 bbl/d`; years, codes and ids never grouped);
   world and country figures to three significant figures, words from a million; both systems
   (`TWh/yr`, `PWh`; `kboe/d`, `Gboe`; fields `Sm³/d`, `Sm³ o.e./d`, million and billion `Sm³`; `bbl/d`,
   `boe/d`, million `bbl`, million `boe`), with the factors the stock uses (`boePerTWh` from the
   snapshot, 6.2898 bbl per Sm³, the file's 159 Sm³ per boe); percentages `21.6 %`; legend ticks with
   open ends `≤ 2`, `≥ 20 000`; years plain; the stamp's `27 Sep, 08:18`; About's `Sun 27 Sep 2026,
   08:18 (UTC+2)`; ordinals (`9th`); spoken forms (`terawatt-hours a year`, `barrels of oil equivalent
   a day`, `standard cubic meters a day`, `percent`, numbers without group spaces). `toFixed` and
   `toLocaleString` appear nowhere else but the allow-list `check.mjs` names (CSS percentages for
   positions, cache keys).
4. **`js/data.js`** (new, pure, no DOM): moved from `app.js`, not rewritten: `decodePolyline`,
   `checkWorld`, `checkSnapshot`, `checkFields`, the projection, `buildProd`, `cumOf` and `seriesAt`
   (with B1's hold), `valueAt`, `worldAt`, `toUnit`, `FORMER_STATE`, `fold`, `COUNTRY_ALIAS`,
   `countryKey`, the `fieldYears()` rules (with B5), `refArr` and the estimate's arithmetic; added:
   `ledgerAt(prod, mode, cumulative, year)`, returning the blocks (`{ iso3, name, share, value }`,
   widest first, rule B, the 1 % floor), the hatched end and the scale used (section 1), cached by
   its caller. `app.js` imports it; `tools/test_decode.mjs` tests it.
5. **`js/track.js`** (new): Global Weather's track adapted (section 3): 125 steps, no per-step ticks,
   5-year ticks, decade ticks, 25-year labels measured apart, no `now`, Page Up and Page Down ten,
   `role="slider"` named `Year` with `aria-valuetext`, drawn into a cached canvas per size and theme,
   the thumb on top.
6. **`index.html`**: `lang="en-US"`; the viewport as today (no `user-scalable`); `<meta
   name="color-scheme" content="light dark">`; two `theme-color` metas carrying each theme's `--page`;
   `<script type="module" src="./app.js">`; the column: the header (`h1`, the stamp with its hidden
   description, `Find`, the units key, the row of words as two radio groups); the plate (the canvas,
   focusable, with its description; the key column; the card; the notice; the ghost key); the caption
   band (the stamp's focus-mode slot, the Ledger's canvas and its hidden sentence, the legend, the
   caption line, the credits as a `<p>`); the sheet slot (Details, Map layers); the player (the time
   row without `aria-live`, `Previous year`, Play with its two marks in a wrapper, `Next year`, the
   track); Find and About as dialogs with About's static sections; the live region. The stock
   `.switcher`, `.mapbtns`, `#layers`, `#legend`, `#credits` button, `#hlchip`, `#banner`, `.sheet`,
   `#slider` range input and `#ticks` go.
7. **`style.css`**: rewritten as the house stylesheet for this app: the HOUSE 3.1 tokens in both
   themes and `color-scheme`; `html, body { background: var(--page) }`; `--face` only, the one
   `@font-face`; this app's five tokens (section 2); the frame, the header, the row of words and its
   tracer, the key column and its states, the caption band (the Ledger's row at a fixed height), the
   player, the track, the card and its two kinds, the sheet and its rows, the Map layers rows and
   samples, Find and its clear key (with `::-webkit-search-cancel-button { appearance: none;
   -webkit-appearance: none; }`), the chart, About, notices, the ghost key; landscape at
   `(orientation: landscape) and (max-height: 500px)`; the sheet as a column at `(min-width: 820px)
   and (min-height: 480px)`; gutters 20 px from 700 px; `@media (prefers-reduced-motion: reduce)`
   zeroing every duration; `@media (hover: hover)` hovers; `touch-action: manipulation` and
   `-webkit-tap-highlight-color: transparent` on controls. No `box-shadow`, `backdrop-filter`,
   `transition: all`, uppercase or letter-spacing; `.valid, .lead, .track, .track canvas` carry
   `transition: none; animation: none`.
8. **`app.js`, the plate**: `buildPalette()`'s two literal palettes replaced by `THEMES`, pasted from
   `python3 world-oil-gas/tools/art/palette.py --json` (run from `Template/`), with the keys
   `buildPalette()`, `drawSea()`, `bathyStyle()`, `drawCountries()`, `drawFields()` and
   `drawOutlines()` read (`ramp` 17 stops into the 256-step LUT as today; `sea`, `deep`, `land`,
   `outside`, `edge`, `border`/`borderAlpha`, `fuel`, `paleAlpha`, `tintAlpha`, `edgeAlpha`, `rim`/
   `rimAlpha`, `label`, `halo`/`haloAlpha`, `sel`); the map's top and bottom edge at 85 degrees in
   `--line`; the draw order sea, countries, borders, outlines, fields, **names**, selection (B6); the
   rim on every disc (owner call 6); the selected field as four 4 px registration ticks around its
   disc, never a circle; the relief desaturated once into the cached sea canvas by a `saturation`
   composite of a mid gray (owner call 9); names in `"Ysabeau Office"` 11.5/560 on the halo, measured
   after the face loads; B5's undated rule through `fieldYears()`; the theme change rebuilding the
   palette, the caches, the track's and the Ledger's tokens once.
9. **`app.js`, the Ledger**: its canvas in the caption band, drawn as section 1 says from
   `ledgerAt()`, cached per mode, accumulation and year; the chosen country's tracer and label; the
   hidden sentence; redrawn only on a change of shown year, mode, accumulation, width, theme or
   chosen country.
10. **`app.js`, the player**: `wanted` and `shown`; the frame computing the newest wanted year and
    then writing the time row, the lead, the caption, the Ledger, the card's dynamic rows, the chart's
    cursor and `aria-valuenow` from `shown`; play on the clock at 8 years a second, never adding a
    hidden interval (B3), stopping at 2024, Play there restarting from 1900; About, Find, a touch on
    the track and hidden stopping or holding it; the year keys with their live sentence; the Play
    key's two marks toggled with `toggleAttribute('hidden', …)` on their wrapper (B2); the dirty check
    and its counter in the hook.
11. **`app.js`, the caption band**: the legend (title, the bar from the same 17 stops, decade ticks
    through `units.js`, open ends, the unit after the last label, measured apart); the caption line's
    forms (section 3) at their fixed height; the credit line whole, as a `<p>`, built as today (B7).
12. **`app.js`, the header**: the stamp's words and its stale, loading and map-only states (section
    3), its `aria-label` removed and *Opens About this data.* as its description; the units key's
    words, name and the two systems (SI first for a new library; owner call 3); the row of words
    (`setMode`, `setAccum` unchanged in what they do; `aria-checked`, the tracer); `Find` opening its
    dialog.
13. **`app.js`, the card and the details sheet**: the card's two kinds (section 3), its rows written
    once per selection and updated in place per year, every value through `units.js` and set with
    `textContent`; the placement (top-left, or bottom-left over the tapped point); the tap's sentence
    once; `Details` opening the sheet with the stock `countrySheet()`, `trackerSection()` and
    `fieldSheet()` content restyled (the chart on a canvas through `--chart-oil` and `--chart-gas`,
    the tracker rows, the notes, B4's and B14's words); the field page as `gem.wiki/…` and the
    estimate's sentence kept; the sheet's slot shrinking the plate rather than covering it (B16), so
    `flyTo()` fits its target in the plate as it is.
14. **`app.js`, the Map layers sheet and Find**: the rows, the four word groups and the field key
    with its drawn samples (section 3), writing the stock keys; the counts sentence with commas;
    `Clear the highlight`; Find as a dialog (`runSearch()`, `searchResults()` and the picks kept), its
    clear key, `inert` behind it; the stock `#hlchip` folded into the caption's note and the clear key
    (owner call 10).
15. **`app.js`, focus mode, About, notices, motion, the map's keys**: focus mode as section 3 says,
    `wog.focus` restored before the first draw, Escape in the order About, Find, sheet, card, focus
    mode; About from its static HTML and the data's own figures (section 3), dates by hand, addresses
    without their scheme (the constants `CCBY`, the Natural Earth address and the GEM wiki prefix
    written without `https://`, B10; data addresses shown with the scheme stripped); notices restyled,
    their sentences kept, em dashes out; Reduce Motion read live; `flyTo` on `--draw`'s curve and
    ended at its destination by any touch (B13); hidden stopping play and the loop (B3); the arrow-key
    pan and `+` `-` zoom on the focused canvas.
16. **`app.js`, the hook**: `window.__wog` keeps every member it has (`render`, `state`, `setYear`,
    `setMode`, `setUnits`, `setAccum`, `setFieldOpt`, `setHighlight`, `loadAll`, `selectAt`,
    `estimate`, `lut`, `countryColour`, `pixel`, `search`, `flyTo`, `project`, `decodePolyline`,
    `bathy`; `setLegendOpen` retires with the legend's fold; `countryColour` is renamed `countryColor`,
    as the colors-per-year function is, for US spelling) and adds `stats()` (frames drawn, fill
    passes, field passes, Ledger draws), `wanted()`, `shown()`, `ledger()` (the shown year's blocks),
    `focus()`; nothing in the app calls it.
17. **Words, everywhere shipped** (`index.html`, `app.js`, `js/*.js`, `style.css`, `NOTES.md`,
    `PROMPT.md`, `ART.md`): US spelling, comments included (the British forms on `check.mjs`'s list,
    which `grep -n -i` finds today in `index.html`, `app.js`, `style.css`, `NOTES.md` and `PROMPT.md`,
    with `ellipsised` in `style.css` and the British license noun as About's label), except the data's words
    and the data's key, allow-listed in `check.mjs` by file and word; `hatched` only for the Ledger's
    end (B4); no middle dot, arrow, em dash or `...` in a string the app writes but the credit line;
    `Oil + Gas` written `Oil and gas`.
18. **`NOTES.md`**: US spelling (its table's license column heading too; the license names
    keep their publishers' words); the budgets as measured (B15: `world.json` ≤ 1 400 000 B and
    `fields.json` ≤ 2 600 000 B enforced by the build; the code's caps enforced by `tools/check.mjs`);
    the folder list (`fonts/`, `js/`, `tools/`) and the code map (`js/units.js`, `js/data.js`,
    `js/track.js`); the Ledger, what it computes and what it cannot show; B1's hold and B5's rule; the
    stale threshold (400 days); focus mode; SI first; the font's credit line word for word. The data
    and honesty sections keep their words, B4's corrected.
19. **`PROMPT.md`**: US spelling (two lines today); the menu paths in words (`in Safari, Share, then
    Snuggery`, not arrows); the step headings with a colon (`Step 1: the clock`), not a spaced em
    dash; `Making it yours` names the units in both systems and says the land is plain "so the color
    encodings read", as now.
20. **`miniapp.json`**: the name unchanged; `version` `1.1`; the description may name the Ledger (at
    most 200 characters), the lead's choice.
21. **`tools/check.mjs`** (new, Global Weather's pattern; every item of HOUSE 7.1): the ZIP's limits;
    no scheme address in shipped `.html`, `.css`, `.js`; references relative and present; the folder
    contract (`fonts/` exactly the two house files; `data/` exactly the four files; `js/` exactly the
    three modules); the face's and `OFL.txt`'s sha256; the four data hashes above; `miniapp.json`;
    the vendor-name list copied from `global-weather/tools/check.mjs` line 128 as it is (ROT13, never
    decoded); the credit line's construction and its expected text for the shipped data; the
    camera's strings of section 5 with their roles; `localStorage`: every key `STORE` holds today
    still read but `wog.legend` (the legend no longer folds) and `wog.rings` (the rim is always drawn,
    owner call 6), listed as retired with those reasons, and `wog.focus` added; SI; nothing that
    carries a step transitions; no `innerHTML` but `= ''` (the app holds Global Weather's rule today
    and keeps it), no `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval` or `new Function`;
    the palette (`THEMES` equals `--json`, and the script exits 0 with `ALL CHECKS PASS`); the tells
    and the house's three additions; the budgets (code ≤ the cap the lead rules, `app.js` ≤ 150 000,
    fonts ≤ 160 000, the ZIP ≤ 2 622 870, built as `build-zips.yml` builds it, with `index.html` at
    its top); US spelling with the allow-list.
22. **`tools/test_decode.mjs`** (new; no dependencies): `data/` decoded with formulas written in the
    test (polylines, the series), compared with `js/data.js`: `checkWorld`, `checkSnapshot`,
    `checkFields` on the shipped files and on broken copies; `seriesAt`, `valueAt` and `cumOf` for a
    sample of countries in all three modes, including B1 (France, Spain, Sweden, Ireland: the total to
    2024 equals the total to 2016); `worldAt`; `ledgerAt` against the test's own rule-B partition at
    1900, 1920, 1950, 1973, 1985, 1991, 2000, 2016, 2017 and 2024 in all six mode and accumulation
    pairs (the counts and shares of section 1: 4, 5, 9, 15 and 21 blocks; the United States 55.9,
    68.7, 61.4, 26.3 and 21.6 %; the sum against the world within 98.14 % and 100.64 %); the first
    block's holders by year (section 1); `fieldYears()` with B5's rule (no undated unit drawn in 1906);
    `units.js` for a table of values (thousands, both systems, open ends, ordinals, spoken forms).
23. **`tools/shoot.mjs`** (new; HOUSE 7.2 as the kind allows): boot (the camera's strings by role and
    name, the credits whole and visible, the face loaded); text contrast in both themes; the tracer
    under exactly the chosen words; **the Ledger sampler** (its drawn pixels against `--page` in both
    themes, 90 % of samples at 3:1 or more, the lowest printed; its block count and the first block's
    share at 1920 and 2024 equal to the script's own partition from `snapshot.json`; the chosen
    country's tracer under its block); the card's figure for Norway and the United States against the
    script's own decode; the lead's world figure against the script's; SI in every visible text node;
    the scrub by real touch at 2, 8 and 20 steps a second with 0 frames whose drawn year differs from
    the label's; play (never backwards, stopping at 2024, the Play key's mark by computed style, About
    holding it, a hidden page stopping it and a return not jumping, the counter steady across a second
    of play at a fixed year); the plate's height steady while the caption changes; the card clear of
    the tapped point; names drawn over the fields and outside the card, keys and ghost key; focus mode
    (touch, Enter, Escape, the ghost key, a reload, the live sentences, hit targets, the plate's growth,
    the Ledger and the credits still there); the units key (SI first; `kboe/d` after one press; a
    field's card in `Sm³ o.e./d` then `boe/d`); Find (typing shows no blue-led pixels at the field's
    right end; a choice flies and a touch ends the flight at its destination); Cumulative at 2024
    with France colored (B1); 1906 with no undated unit drawn (B5); Reduce Motion (every animation
    0 s, a flight a cut); broken data (each file missing, not JSON, the wrong schema; a replacement
    while open keeps the view); widths 320, 360, 375, 844 x 390 and 125 % zoom with every caption form
    measured; hit targets ≥ 44 x 44 in both modes; pictures to `tools/.work/shots/` and with
    `SCREENSHOTS=1` to `screenshots/` (replacing the nine stock pictures there, never
    `screenshots/app.png`, whose hash the run checks unchanged); load and frame times printed as
    headless figures.
24. **`tools/art/palette.py`**: written by this art pass; the builder only runs it (`--json` for step
    8) and changes it only with a figure recorded in `tools/DECISIONS.md`.
25. **`tools/DECISIONS.md`** (new): sections 8 and 9 of this file moved there word for word, removed
    from here; then the owner calls as they settle, as-built notes and the review record (HOUSE: the
    pass record never ships). `ART.md` keeps a short "Where the record is" section in their place.
26. **`ART.md`**: the builder corrects any figure here that the build measures differently, in place,
    and says so in `DECISIONS.md`.

**For the lead, outside this folder** (not the builder's): `Template/README.md`'s entry ("a year
scrubber", the fields' description) gains one sentence on the Ledger; `HOUSE.md`'s budget row; the
camera's put-back of the year (section 5); the README panes and the before/after pair.

---

## 9. Owner calls left open

1. **The code cap: the lead's interim ruling (2026-10-02, plan 0011 D17) is in section 6** — 200 000 B
   until the build has measured, no feature cut, the lead rules on the measured figure if it is over.
   The question as the pass put it: the estimate is about 203 000 B against the house's 200 000
   (section 6). The recommendation: a lead's ruling of 205 000 B (+2.5 %, as Global Weather's 203 000 was ruled for
   its coast), recorded in `tools/DECISIONS.md`, rather than cutting a feature the README advertises.
   To hold 200 000 instead, in this order: the chart's drag to set the year (about 600 B; the track
   does it), the drawn samples in the field key (about 1 200; words only), the company and basin
   highlight (about 3 500; Find would keep fields and countries, and the README entry would change).
2. **The signature is the Ledger**, each producer's share of the world's output in the year shown as
   one strip of ink blocks under the plate, over the alternatives section 1 names (the world curve on
   the track, discovery stems, the fields as ink well symbols, each country's best year). A variant
   for later: a second, thinner strip for the field layer's own operators; not in this pass.
3. **SI first**: a new library opens on `TWh/yr`, the fields in `Sm³` units, with `kboe/d` and the
   barrel units one tap away; a library with `kboe` stored keeps it. The alternative keeps `kboe/d`
   first as the industry's unit, which HOUSE 6.1 does not allow without the owner.
4. **Fields without dates appear in their data year** (B5: the year before it, the estimate's start),
   not in every year. The alternatives: the stock "always drawn", which shows 1 628 producing fields
   in 1906; or a gray "no date" ring in every year before it, which keeps them visible as unknowns.
5. **Cumulative holds a series' total past its last year** (B1), with the card saying the series
   stops in 2016. The alternative shows "no figure after 2016" and leaves 156 countries plain from
   2017 in Cumulative, which is the bug on record.
6. **The field rim is always drawn and `Circle edges` goes** (`wog.rings` retired): measured, a gas
   disc on a violet country of its own lightness is 0.008 apart under tritan or deutan vision, and
   only the rim parts them. The alternative keeps the toggle, default on.
7. **Focus mode keeps the Ledger and drops the legend's bar and ticks**, the house default; the
   Ledger is the reading the view needs, as US Quakes keeps its record strip.
8. **The field key moves into the Map layers sheet**, as Shelf Atlas's map key did; the card names a
   tapped field's fuel. The alternative is a third row in the caption band (about 15 px of plate).
9. **The relief, when switched on, is gray shading only**: its hypsometric greens and browns are not
   this app's data and would compete with the fuels. The alternative keeps its colors at the stock
   0.5 alpha.
10. **The company and basin highlight leaves its floating chip**: it is named in the caption's lead
    note and cleared in the Map layers sheet and in Find.
11. **The credit line keeps its middle dots**, as the house's credit-line exception allows, since it
    is built from the data's sources. The alternative is commas, which changes the words the stock
    app printed.
12. **The track's Page Up and Page Down move ten years**, a decade, against the house's eight steps.

**Phone checks for the device matrix** (none claimed; the owner's iPhone on iOS 26 and an iPhone on
iOS 18, the floor): frame time idle, playing and scrubbing by finger (the country fills, the field
pass and the Ledger per year, with the fields on); memory after five minutes of play (3.8 MB of JSON
parsed and a 4096 x 2048 JPEG decoded when the relief is on); background and return (play stopped,
no jump); a delivery of a new `snapshot.json` while open; the Ledger's 1 px gaps and hatch at DPR 3;
the relief's `saturation` composite in the web view; focus mode in Snuggery's full screen with the
ghost key and Snuggery's own exit control both reachable in the top-right corner; VoiceOver on the
track, on a tap, on the row of words, on the Ledger's sentence, in the Map layers sheet and in Find;
Find's field not zooming the page; the phone on its side with a sheet open; the safe areas of every
band.

---

## Moved from ART.md on 2026-10-02, word for word (the follow-up after the final review)

The final review found the pass's history still in `ART.md`, which ships (should 1 below). Every
passage that left it is here as it stood, under the place it stood. Where the passage also stated a
rule that changed (the labels, the caption line, the camera's table, the budgets), the whole passage
moved, and `ART.md` now says what is drawn.

### Section 1, the labels bullet as it stood (its rule changed by nits a and b; its history: "(after the final review)", "(it was 85)", "(it was 2.26)")

- **The labels.** 10.5 px `--ink-2` on `--page`, one line, 6 px under the strip (below the tracer),
  every label 10 px clear of every other and inside the strip. **The three widest blocks are named
  wherever a label can start inside the block** (after the final review): each at the first free x
  inside its own block, in the fullest forms that fit together, tried in order, earlier blocks
  first: name and share (`United States 21.6 %`, through `units.js`), the name alone (`Russia`),
  the share alone (`12.4 %`); the combination naming the most of the three wins. Every other block
  keeps the first rule: its name and share at its left edge where that fits. Measured at 390 px
  (`tools/.work/fix/verify.log`): the second block is named in 125 of 125 years (it was 85), the
  third in 121, 2.97 of the first five on average (it was 2.26); in 2024 `United States 21.6 % |
  Russia | Saudi Arabia 7.6 % | Iraq 2.8 %`, in 1973 `United States 26.3 % | USSR 16.1 % | Saudi
  Arabia 10.0 % | Nigeria 2.6 %`. The years a third block goes unnamed (1900 to 1902 and 1927
  annual, 1900 to 1903 cumulative) are the ones where it is 5 to 16 px wide next to a label or the
  strip's end, so no label can start inside it; it is still spoken and still opens on a tap. Names
  are the data's (`countries[].name`; a former state's `historical` label without its parenthesis,
  `USSR`, and `USSR to 1984` in Cumulative once its members replace it).


### Section 2, "CSS custom properties this app adds", its last sentence

(A `--land` sample was planned and not needed: the caption says what plain means.)

### Section 3, the plate's height

526 before the final review set the legend's title on its own line

### Section 3, the legend row

Before the final review the title shared the row and the bar lost `1 000` too (`≤ 2 / 10 / 100 / ≥ 20 000`).

### Section 3, the caption line row, its notes as they stood (corrected for the must; its history: the "after the final review" parenthetical and the instruction to the builder)

The longest of these forms that fits: `Bar: shares of the world's oil and gas in 2024; hatched, all under 1 %. Plain: no figure, or none.`, then, while the fields follow the year, ` Field sizes are estimates.`; failing that the bar and plain land alone; then the bar with `, largest first` and the estimate; then the bar alone. Plain land's meaning comes before `largest first`, which the strip shows by itself (after the final review: the old default form, `… largest first; hatched, all under 1 %. Field sizes are estimates.`, never said what plain land is). Cumulative: `Bar: shares of all the oil and gas produced to 2024; hatched, all under 1 %.` and the same. With no world series in the snapshot, `Bar: shares of all listed countries' oil and gas in 2024; …`. A note leads when it applies, and the bar's sentence shortens to `Bar: shares of the world's output, largest first.`: `No world figure for 1900.`; `No field points: data/fields.json says they are not available.`; while the fields are drawn, `Highlighted: TotalEnergies SE, 189 fields.` (the company or basin chosen in Find, owner call 10) or `Fields: offshore, unconventional only.` (the stock legend's filter note); and, in any year a former state holds the figure while its lead member has none, `The USSR's lands are plain: its figure is in the bar.` (1900 to 1984; then `Czechoslovakia's lands …` in 1985 to 1992, once the USSR's members have their own; the same years in Annual and Cumulative, measured year by year at 390 px), because the former state has no outline and its members' do. `shoot.mjs` measures every form at 320, 360 and 390 px in both unit systems; the builder writes a shorter form for 320 px where a long one does not fit, never a third line.

### Section 3, the readout card row

After the final review: the 14 px reach used to come first, so at the opening view most of every producing country opened a field (of their own area, Iran 10 %, Saudi Arabia 21 %, Russia 39 %; now 53 %, 70 % and 69 %, `shoot.mjs`); the Gulf states, still mostly under their own fields' discs at that zoom, open from their names, from the Ledger and from Find.

### Section 3, the details sheet row

(after the final review: at 375 x 667 the body showed 84 of 542 px, now 168; at 390 x 719, a 390 x 844 iPhone under Snuggery's navigation bar, 136 then, 220 now; at 375 x 603, 20 then, 104 now)

### Section 3, the chart row

Its drag to set the year was cut after the final review, the first cut owner call 1 named: on a short screen the chart filled most of the sheet's visible body, so its `touch-action: none` turned every swipe into a year change (375 x 667: the year went 2024 to 1951 and the sheet did not scroll); the track does the same job.

### Section 3, the Map layers row

after the final review, so the words add up: the build's `4 419 fields discovered by 2024, 6 015 producing` left the undated units out of one count and in the other; the pipeline already left out the 618 units without coordinates, which `NOTES.md` says

### Section 5, its Play row and its two closing paragraphs as they stood (its citations then read `waitForWorldOilGas()`, lines 385–389, and the README panes, lines 749–765)

| `Play` | button | waits up to 180 s for it, then `showControlsIfHidden()`, then 4 s; taps it for the README pane | **kept**: the Play key, named `Play` while paused; the player stays in focus mode |

No string changes, so the camera needs no change in the commit that lands this pass. One note for the
lead, not this pass's to fix: the README pane plays four seconds from where the app opens and pauses,
and the app remembers the year, so a library that is not reset opens each run on a later year (1932
after the first, then 1964). What the camera changes, it puts back (HOUSE 7.4): after `Pause`, a tap
on the track named `Year` at 0.995 of its width (`setWebSlider`) lands on 2024.

A second note for the lead from the final review, also outside this folder: `waitForWorldOilGas()`
waits for `Play`, which is in the static HTML before any data is read (`aria-disabled` until then),
so the wait proves nothing and the 4 s sleep after it does the work (the stock app had the same
disabled key). The stamp's `figures to` (`Updated 26 Sep, 23:18, figures to 2024`) appears only once
the snapshot is read, so waiting for visible text containing `figures to` is the true signal, as
Global Weather's camera waits for `Updated`. No string here changed after the review.

### Section 6, "Budgets", the whole section below its heading as it stood (the caps are kept, restated; the figures are replaced by the as-built table)

**The caps** (HOUSE 8, plan 0011 D5):

- **Code: 200 000 B, the house's cap.** The app's own figure, "`app.js` is 130 KB against a 150 KB
  budget … the build fails rather than ship over budget" (`NOTES.md`), is enforced by no build:
  `scripts/shelf_atlas/build_world.py` holds only `WORLD_BUDGET` (1 400 000 B, line 66) and
  `FIELDS_BUDGET` (2 600 000 B, line 288) (`grep -n -i budget scripts/shelf_atlas/*.py` from
  `Template/`). So, as the lead ruled for Shelf Atlas (plan 0011 D15), the house's cap is the one
  that binds; the pass keeps `app.js` itself under 150 000 B as well, so that `NOTES.md` can state it
  truthfully and `check.mjs` enforces both. The estimate after the pass is close to the cap
  (below; owner call 1). Never minified, never stripped of comments. **The lead's ruling
  (2026-10-02, plan 0011 D17): the cap stands at 200 000 B until the build has measured.** The
  builder applies the whole change list, including the company and basin highlight, cuts no
  feature and never minifies; if the code then measures over 200 000 B after the list's own
  trims, the builder reports the figure and the lead rules on it, as for Besseggen (a raise of
  up to about 2.5 %, not a cut of something the README advertises). If `app.js` alone cannot
  stay under 150 000 B while the whole is under the cap, the whole-code cap is the one that
  binds and `NOTES.md` states the measured figure instead of the 150 KB.
- **Fonts: 160 000 B.**
- **ZIP: 2 622 870 B**: the ZIP before the pass, 2 068 029 B, x 1.25, rounded down (2 585 036), plus
  37 834 B for the face (HOUSE 2.2), as HOUSE 8's table gives it.

**Today** (2026-10-02, the working tree the pass starts from):

| | Bytes | How measured |
| --- | --: | --- |
| App code: `index.html` 10 997, `style.css` 23 501, `app.js` 130 664 | **165 162** | `wc -c index.html style.css app.js` |
| Fonts | **0** | no `fonts/` |
| ZIP, as `build-zips.yml` packs it | **2 068 029** | `zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`, then `wc -c` (11 entries, 4 786 486 B unpacked) |

**The plan, against the caps.** Shelf Atlas grew from 139 305 B to 183 869 B (+44 564) taking the
same house modules (`shelf-atlas/tools/DECISIONS.md`, the before-pass table and the as-built line).
This app starts 25 857 B larger, mostly in `app.js`'s search, the fields' estimate and About's
builder, and pays back less (its stock CSS is already near the house's size). Estimated by part:
`index.html` about 19 000 (About's static sections, the dialogs, the Map layers sheet, the key column's
marks, the ghost key, the track, the caption band), `style.css` about 22 500, `app.js` and `js/data.js`
together about 148 000 (`app.js` under 150 000 on its own), `js/track.js` about 6 300, `js/units.js`
about 7 000: **about 203 000, against 200 000**. The trims this change list already makes (the
legend's fold and its DOM field key, the `hlchip`, the `Circle edges` row, the `Intl` formatters, the
SVG chart, the stock switch styles) are counted in that figure. If the build measures over, owner
call 1 names the choice; the builder does not cut a feature on its own.

**As built** (`node tools/check.mjs`, the last run of the pass): app code 197 402 B (`index.html` 18 032, `style.css`
23 879, `app.js` 116 462, `js/data.js` 26 163, `js/track.js` 5 938, `js/units.js` 6 928) against the 200 000 B cap, within 5 %
of it, so 2 598 B of headroom (HOUSE 8): the lead's interim ruling stands and no raise is needed; `app.js`
alone 116 462 B, under the 150 000 B that `NOTES.md` states. Fonts 40 075 B. The ZIP about 2 145 500 B against
2 622 870 (this file ships inside it, so its own figure moves the last digits).

**After the final review** (`node tools/check.mjs`, 2026-10-02): app code **199 604 B** (`index.html`
18 075, `style.css` 24 406, `app.js` 118 094, `js/data.js` 26 163, `js/track.js` 5 938, `js/units.js`
6 928) against the 200 000 B cap: **396 B of headroom**, within 5 % of it (HOUSE 8). The fixes cost
3 611 B as first written, which measured 1 013 B over; paid for by cutting the chart's drag (owner
call 1's first named cut, which was also the review's must) and by writing the new comments short,
never by stripping an old one or minifying. About gained one sentence, `Tap a block for that
country's card.` `app.js` alone 118 094 B, under its 150 000 B. Fonts
40 075 B. The ZIP about 2 149 000 B against 2 622 870 (the exact figure is in `tools/DECISIONS.md`;
this file ships inside it). Anything this app gains next, it pays for.

**The ZIP after the pass**, as the art pass estimated it: 2 068 029 + 37 834 (the face) + about 23 000 (this file once
sections 8 and 9 have moved out: 57 618 B, 23 052 B deflated by Python's `zlib` at level 6) + about
12 000 (the code's growth, compressed) = about 2 141 000, against 2 622 870.

## After the final review (2026-10-02)

The final reviewer's verdict on the pass (`wf_f6dfabba-884`) was **fix**: one must, two shoulds,
three nits. All six are applied; nothing is declined, and one suggestion inside nit (b) is replaced by
a rule measured to read better (below). The lead's rulings held throughout: the code cap is the
house's 200 000 B (plan 0011 D17, no raise), nothing is minified and no comment is stripped (the new
comments are short), and the chart's drag to set the year stays cut. My drives, logs and pictures
are in `tools/.work/followup/`: `measure.mjs` (the caption in every year at six sizes; the Ledger's
labels in every year with no country, the United States and Norway chosen), `side.mjs` (the caption's
width on its side), `modes.mjs` (every mode with Russia and the USSR's block chosen, DPR 3), a copy of
the fix stage's `verify.mjs`, `art_edit.py` (the `ART.md` edit and the moves above), and the logs
`before.log`, `after.log`, `labels-*.log`, `regress-*.log`, `shoot-full.log`, `check-2.log`,
`decode.log`, `palette.log`. The files as they stood before the follow-up are in
`tools/.work/followup/orig/`.

**The must: in 93 of 125 years the caption dropped the Ledger's number.** Where a former state holds
the figure while its lead member has none (the USSR 1900 to 1984, Czechoslovakia 1985 to 1992), the
note form `${note} Bar: shares of ${of} output, largest first.` left out `hatched, all under 1 %`
(HOUSE 5.2 test 3), `Field sizes are estimates.` and the general `Plain: no figure, or none.`, in
exactly the years when every field disc is an estimate. Measured before (`before.log`, every year,
both modes): `under 1 %` in 32 of 125 years at every width and on its side. Applied:

- The note forms are now, longest first: the note, the bar's whole sentence and the estimate; the
  note, `Bar: hatched, all under 1 %.` and the estimate; **the same without the estimate**; the old
  form; the note alone. The third is mine, beyond the brief's order: on its side the caption is one
  line of 394 px, and in the caption's face the note with `Bar: hatched, all under 1 %.` measures
  353 px, with the estimate 467 px, the old form 439 px (`side.log`), so without it the note years on
  its side still fell through to the note alone. It costs 32 B.
- Nit 3 rides with it: the old form, now the last resort, says `Bar: shares of everything produced to
  date, largest first.` in Cumulative (`… of the world's output, …` stays in Annual).
- `No world figure for 1900.` moved from `captionNote()` to an early return in `readline()`. The new
  forms would otherwise have followed it with the bar's sentence and `hatched, all under 1 %`, in a
  year whose strip is not drawn (the old form already claimed a bar there). The shipped snapshot has
  no such year: its `world` series has no null or zero among its 125 oil and 125 gas values (checked
  with Node), so nothing on screen changes from this.
- Measured after (`after.log`, every year, both modes): `under 1 %` in 125 of 125 years at 312, 320,
  360, 375 and 390 px and on its side; the estimate in 125 of 125 upright, but for 312 px Cumulative
  (93, below); never past the line's fixed height. 1950 reads `The USSR's lands are plain: its figure
  is in the bar. Bar: shares of the world's oil and gas in 1950; hatched, all under 1 %. Field sizes
  are estimates.` at 390 px (both themes, `screenshots/1950-light.png` and `1950-dark.png`), `The
  USSR's lands are plain: its figure is in the bar. Bar: hatched, all under 1 %. Field sizes are
  estimates.` at 320 px, and `The USSR's lands are plain: its figure is in the bar. Bar: hatched, all
  under 1 %.` on its side; Cumulative 1950 at 390 px `… Bar: shares of all the oil and gas produced to
  1950; hatched, all under 1 %. Field sizes are estimates.` 2024 is unchanged: `Bar: shares of the
  world's oil and gas in 2024; hatched, all under 1 %. Plain: no figure, or none. Field sizes are
  estimates.` (Cumulative: `Bar: shares of all the oil and gas produced to 2024; …`, the same
  sentences after it), as `open-light.png` and `open-dark.png` show.
- `shoot.mjs`: the single 1962 assertion is replaced by a loop over all 125 years in both modes at
  390 x 844, 320 x 568 and 844 x 390: the caption starts with the note this file works out from the
  snapshot (`noteIn()`, the former-state rule written again, 186 of the 250 year-modes), says `under
  1 %`, says `Field sizes are estimates.` upright, and stays inside its height.
- Left as it was, measured, not in the review's findings: at 312 px (125 % zoom) Cumulative from 1993
  the forms without a note keep `Plain: no figure, or none.` and drop the estimate (the fix stage's
  order puts plain land first, should 3 of the review); on its side no form carries the estimate (the
  one line holds the bar's sentence and no more). Both are the lead's to weigh.
- Cost: 232 B in `app.js` (the forms 92 B, nit 3 47 B, the new comment 93 B).

**Should 1: `ART.md` ships and held the pass's history.** Moved, word for word, into the section
above (eleven passages: section 1's labels bullet; section 2's planned `--land` sample; section 3's
plate height before the review, the legend before the review, the caption line's notes, the 14 px
reach as it was, the details sheet's before figures, the chart's cut, the counts sentence's history;
section 5's Play row and both notes for the lead; section 6 whole). `ART.md` now carries the look as
built with today's figures, on Shelf Atlas's model, keeping what that model keeps (the stock
comparisons, "written in this pass", "The builder pastes the output", the stranger's look before the
pass). Corrected in place: section 1 (test 3 as the app prints it; the labels and the chosen country
under the new rules, with `after.log`'s figures), section 3 (the caption line's forms, what a tap
opens, the details sheet's figures re-measured by `verify.mjs`, the chart, the counts), section 5 (the
camera as it reads the app now: `Updated` and `Year` added to the table, the Play row's wait
corrected, one sentence on the wait and the put-back, the citations re-read as lines 385–394 and
749–772), section 6 (the caps, D17 standing with no raise, and the as-built table from `check.mjs`;
within 5 % of the code cap, so it says the headroom), section 8. `ART.md` went from 65 637 B to
62 911 B. The ZIP figure in section 6 is exact: written as 2 147 328 B, the ZIP then measured
2 147 328 B.

**Should 2: stray pictures.** `tools/tools/` (two QA pictures under `tools/tools/.work/qa/shots/`,
which the `.gitignore`'s `tools/.work/` does not cover) is deleted. Under `tools/`, outside
`tools/.work/`, only `check.mjs`, `shoot.mjs`, `test_decode.mjs`, `DECISIONS.md` and
`art/palette.py` remain (`find tools -path tools/.work -prune -o -print`).

**Nit (a): with a country chosen, the three widest lost their names, and wider than reported.** The
chosen label was drawn first and the three-widest search then ran over the three blocks after the
chosen one, so a chosen widest block pulled the fourth into the search while its own label crowded
the others out. Measured before (`labels-before2.log`, every year): with the United States chosen,
at 390 px the second block was named in 123 of 125 years and the third in 64 (Cumulative 125 and
83), a block of 20 px or more among the first three going unnamed in 38 years (19 in Cumulative); at
320 px the second in 107 and 102, the third in 43 and 62. Applied: the
search always covers the three widest; the chosen block takes part when it is one of them, its label
first at its block's left edge, its form the search's slowest digit, so it keeps name and share unless
a shorter form names more. After (`after.log`): with the United States or Norway chosen the strip
names exactly as with none chosen: at 390 px the second block in 125 of 125 years, the third in 121,
both modes; at 320 px 125 and 114 (Annual), 125 and 110 (Cumulative). 2024 with the United States
chosen reads `United States 21.6 % | Russia | Saudi Arabia 7.6 % | Iraq 2.8 %` (`card-light.png`; the
review saw Russia and Iran, not Saudi Arabia). The chosen label now shortens where that names more:
2000 with the United States chosen, `United States | Russia | Saudi Arabia 8.5 %`; Russia chosen in
2024, `Russia`. `modes.mjs`: oil, gas and both, annual and cumulative, every year, with Russia chosen
and with the USSR's block chosen, at DPR 3: the chosen label drawn in every year its block is (750
frames each) and in no other, no console message. `shoot.mjs`'s three-widest check now runs with no
country, the United States and Norway chosen, in both modes, and asserts the chosen label in 560 in
every year its block is drawn. Cost 48 B.

**Nit (b): a label could start in its block's last pixels.** The rule built: a label of the three
widest starts where at least 10 px of its block is still to come, or half the block where it is
narrower than 20 px (`b.x1 - x >= Math.min((b.x1 - b.x0) / 2, 10)` in `free()`); otherwise a shorter
form of it or of a wider block is tried, or none. Measured (every year, 390 px, no country chosen,
`labels-before2.log` against `labels-final.log`): labels breaking that rule, 22 (Annual) and 54
(Cumulative) before, 0 after; at 320 px 24 and 42, then 0. 1950 now reads `United States 61.4 % |
11.2 % | USSR 6.1 %`: the USSR's label at its block's edge, Venezuela's share alone (the review saw
`USSR 6.1 %` start near x 274 of a block spanning 260 to 282). The names hold: the third block in
121 of 125 years at 390 px as before, its full label in 98 (96 before), names on 338 of the first
three blocks' labels in Annual (349 before); 2024 unchanged. **The brief's suggestion, half of the
label inside its own block, measured and set aside** (`labels-r1b.log`, even with labels at a block's
left edge excepted): the third block's full label fell from 96 years to 23 and its share alone rose
from 5 to 57, and the fourth block got its name while the third showed only its share (1973 `… |
10.0 % | Venezuela 4.9 %`, 2024 `… | 7.6 % | Canada 5.6 %`), because every other label in the strip
starts at its block's edge and runs on to the right by design, and a narrow block can hold half of
almost no name. The rule built answers the reviewer's case (where a label starts) without that cost.
One block goes unnamed that was named before: 1949 Cumulative at 320 px, Venezuela, 20 px (the
`shoot.mjs` check runs at 390 px). `shoot.mjs` asserts, every year, both modes, three choices, that
no label of the three widest starts with less than that much of its block to come. Cost 31 B.

**The regression proof** (the fix stage's way; `SCHEMES=light SCRUB=0`, `app.js` swapped for a copy,
then restored, `cmp` clean against `app.final.js`, sha256 `a4e16d4a…`):

- The caption's change switched off (`captionNote()` and `readline()` as they stood, everything else
  final; `regress-caption-off.log`): exit 1, 97 `ok` and 3 `FAIL`, exactly the new caption checks at
  390 x 844, 320 x 568 and 844 x 390 (`annual 1900 "The USSR's lands are plain: its figure is in the
  bar. Bar: shares of the world's output, largest first."`).
- The labels' change switched off (the Ledger's labels as they stood; `regress-labels-off.log`): exit
  1, 94 `ok` and 6 `FAIL`, the six three-widest checks (labels starting in a block's last pixels in
  every case, `1910 "Poland" at 322 in 315 to 326`; with the United States chosen, blocks of 20 px or
  more unnamed, `1915 Mexico, 1916 Mexico, 1940 Venezuela …`).

**Budgets.** App code 199 604 B to **199 917 B** (+313: the caption 232, nit (a) 48, nit (b) 31, the
Ledger's header comment 2), against the house's 200 000 B: 83 B of headroom, within 5 % (HOUSE 8).
`app.js` 118 094 to 118 407 B (its own cap 150 000). Fonts 40 075 B. The ZIP 2 148 453 to **2 147 328
B** (cap 2 622 870), smaller: `ART.md` lost 2 726 B.

**The tools' last runs** (2026-10-02, from `Template/world-oil-gas/` unless stated; headless Chromium
153 is never phone evidence):

- `node tools/check.mjs`: 44 `ok`, last line `all checks pass`; app code 199 917 B, `app.js` 118 407
  B, fonts 40 075 B, ZIP 2 147 328 B, the data files' hashes pinned and unchanged (`check-2.log`;
  run again after this record, same figures).
- `node tools/test_decode.mjs`: 18 `ok`, last line `all checks pass` (`decode.log`).
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: exit 0, 120 `ok`, 0 `FAIL`, last line
  `all checks pass`, both themes, with the scrub at 2, 8 and 20 years a second by real touch (0 frames
  whose label, `aria-valuenow` or Ledger differ from the year drawn); the Ledger sampler 100.0 % at
  3:1 or more, the lowest 15.44 and 14.11 (light), 15.04 and 13.75 (dark); load to the first frame
  528 ms, a year's frame 1.30 ms median (headless, a trend only); `screenshots/*-{light,dark}.png`
  rewritten, `screenshots/app.png` untouched at `f66365fd7c1c…` (`shoot-full.log`).
- `python3 world-oil-gas/tools/art/palette.py` from `Template/`: `ALL CHECKS PASS` (`palette.log`).

**What I looked at myself**: `screenshots/1950-light.png` and `1950-dark.png` (the caption in two
lines as quoted above; the strip `United States 61.4 % | 11.2 % | USSR 6.1 %`), `focus-light.png`
(1973 in focus mode: `The USSR's lands are plain: its figure is in the bar. Bar: shares of the
world's oil and gas in 1973; hatched, all under 1 %. Field sizes are estimates.` under `United States
26.3 % | USSR 16.1 % | Saudi Arabia 10.0 % | Nigeria 2.6 %`), `open-light.png` and `open-dark.png`
(2024 as quoted, the strip `United States 21.6 % | Russia | Saudi Arabia 7.6 % | Iraq 2.8 %`), and
`card-light.png` (the United States chosen, Saudi Arabia named).

**Owner calls as they now stand** (each still the owner's to reverse):

- **The chart's drag stays cut** (owner call 1's first cut; the lead accepts it). The gated version
  costs about 1 000 B; with 83 B of headroom it needs a raise of the cap or a cut elsewhere.
- **The short-screen sheet**: upright on a screen at most 760 px tall with a sheet open, the legend's
  bar leaves and the plate goes to 150 px (re-measured: 375 x 667 shows 168 of the body's 542 px). The
  alternative keeps the bar and gives the sheet about 40 px less.
- **Plain land under a former state is explained in words**: the caption's note, now with the bar's
  number after it. The alternative draws the members' outlines in the former state's color in those
  years; it changes what the map encodes.
- **The field card's country as a key into the country's card**: declined for budget, about 300 B
  against 83 B of headroom.
- **The Gulf states** are reached by their Ledger block, their drawn name and Find; at the opening
  zoom a tap on their land mostly lands on their own fields' discs.
- New, from this follow-up: **the label rule** (10 px or half the block to come) in place of the
  brief's half of the label inside its block, with the figures above; **the chosen label may shorten**
  to its name or share where that names more of the three widest (the alternative keeps it whole and
  names fewer); **the estimate on its side and at 312 px Cumulative** gives way as measured above.

**For the lead, outside this folder**: none of the camera's strings changed (`Updated`, `Play`,
`Pause`, `Year`, `Show the controls`); `HOUSE.md`'s budget row for World Oil & Gas can take 199 917 B
and 2 147 328 B, and its §7.4 row the camera's `Updated` wait and `Year` put-back. The screenshots
changed where the year or the chosen country does (`1950-*`, `card-*`, `cumulative-*`, `details-*`,
`focus-light`, `reduced-dark`, `cumulative-france-light`); `open-*`, `layers-*`, `about-light`,
`find-light` and `side-light` kept their size to the byte.

**Phone checks** (none claimed; the owner's iPhone on iOS 26 and an iPhone on iOS 18, the floor):
frame time idle, playing and scrubbing by finger with the fields on; memory with Terrain shading on;
the Ledger's 1 px gaps, hatch and labels at DPR 3, a chosen country's label among them; a tap on a
narrow Ledger block at the phone's own text size; the caption's two lines in a note year (1950) at
the phone's own text size, and its one line on its side; the details sheet in Snuggery's default
view, under its navigation bar, scrolled by a swipe through the chart; the 150 px plate on an
SE-sized phone with a sheet open; the ghost key next to Snuggery's exit control in the top-right
corner; VoiceOver on the track, on a tap, on the Ledger's sentence, in Map layers and in Find; Find's
16 px field not zooming the page; the phone on its side with a sheet open; the safe areas of every
band.
