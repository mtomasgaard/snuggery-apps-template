# Running Dashboard: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look as built; this file
holds the record: the lead's rulings, the owner calls as the pass left them, the as-built departures,
the after-QA, after-review and after-follow-up sections, the phone checks. Plan 0011 package B, D1 to D5
and HOUSE.md are the brief. The builder's last step moves `ART.md`'s sections 8 and 9 here, word for
word, below this section; nothing above the first `---` is to be overwritten.

## The lead's rulings before the build measured (2026-10-02, plan 0011 D22)

**The code cap: held at 236 521 B until the build has measured; nothing cut.** The app is already
over the house's 200 000 B, so D5 holds it at the size the pass starts from, and the art pass estimates
about 244 000 B (+3 %) for the house modules, the Block, the readout card and About. An estimate is not
a measurement, so the builder applies the whole change list, cuts no feature (not the muscle-load unit,
not Sport time, not the adjusted-pace charts, not the window track), never minifies or strips comments,
measures, and reports. The lead then rules on the measured figure as for Milky Way (D7, D9), Besseggen
(D11) and Snug Kart (D20): a raise of a few per cent is the expected answer.

**The routes' OpenStreetMap credit goes on screen (owner call 4).** The shipped `data/` carries routes
derived from OpenStreetMap, whose ODbL license requires attribution wherever the data is shown. So About
(or the credits line, where the app credits its sources) names it — "Routes: © OpenStreetMap
contributors, ODbL" or the app's equivalent wording — without calling the shipped data a demo, which
`NOTES.md` forbids on screen. This is a license requirement, not a taste call; the build or the fix
stage adds it.

**The demo text's British spellings (owner call 5) are a data follow-up after the pass**, not the
pass: `scripts/make_demo_running_dashboard.py` is swept and its `--check` proves the change, as Shelf
Atlas's and Besseggen's follow-ups did for their pipelines. The pass keeps the data byte-identical.

**US units (owner call 1)** stay the owner's: the app ships SI only this pass, as the art direction
says, and a mile switch waits for a cap raised for it if the owner wants one.

## The lead's ruling on the code cap (2026-10-02, plan 0011 D23)

**The cap is 244 000 B; nothing is cut.** The build measured 241 335 B against the held 236 521 (+2.0 %)
with the whole change list applied, nothing minified and no comment stripped: the stock's own files
shrank by 8 428 B (the stylesheet rewritten on the house, the dead diverging mode and the tile kit gone)
and the three house modules — `js/units.js` 5 956, `js/block.js` 6 857, `js/palette.js` 429 — added
13 242 B. That is the smallest growth of any pass after Snug Kart's, and the art pass's own estimate
(about 244 000) was close. Cutting the muscle-load unit, Sport time or the adjusted-pace charts to fit
a cap set at the stock's accidental size would remove things the owner uses for a few thousand bytes.
The ruling leaves about 2 700 B for the fix stages; they pay for nits in place and report anything
over, as every pass has. The lead set `CODE_CAP` in `tools/check.mjs` to 244 000 with this reason, so
the one failing line passes.

## The lead's second ruling on the code cap (2026-10-02, plan 0011 D24)

**The cap is 245 000 B for the follow-up after the final review.** The fixes landed at 243 905 B, 95 B
under D23's 244 000, and left three things that are worth more than the bytes they cost: the map's card
placed at the bottom when both top corners would cover the tapped point (about 60 B; the house's own
rule, and the pattern the pane apps after this one copy), open folds kept across a re-render when a
new file arrives (421 B measured; a reader who glances away should not come back to find the text they
were reading folded away), and a minimum span for the route's relative color ramp (about 350 B with
its sentences; a steady run must read steady, HOUSE 6.5). As Milky Way's second raise paid for its zoom
keys and view offset (D9), this one pays for those three and nothing else; what is left over is not
spent. The lead set `CODE_CAP` in `tools/check.mjs` to 245 000 with this reason.

---

## As built: the builder's record (2026-10-02)

The whole change list of ART.md (now below) applied in one build, nothing cut, minified or stripped.
What the build did not take word for word from ART.md, and why (ART.md is corrected in place to match):

1. **The Block's grid values sit in a 30 px gutter at the right.** Drawn over the columns, as ART.md's
   first geometry had it, `60 km`, `40` and `20` collided with the last outlines and the race's rule
   (`tools/.work/probe/out/` pictures of the first build). The columns share the width less the gutter:
   20.5 px slots, columns of 16 and 17 px, every edge on a whole pixel so the 1 px gap between runs is
   the page itself.
2. **Under the race's name the `now` notch starts below the letters** (y 11 to 14 instead of 8 to 14), and
   the name sits on a 3 px `--page` halo. With sixteen columns the demo's race name always covers the
   current week, so `now` loses its word (ART.md's rule) and the full notch cut through the name.
3. **The demo's figures are running kilometers**, walk breaks out, as ART.md's rule says: 49.8, 73.9,
   77.8, 40.0 and 45.9 km. ART.md's first text quoted the sessions' whole distances (49.9, 74.0, 78.0,
   46.0); `node tools/test_block.mjs` prints both decodes' agreement.
4. **The stamp's 44 px hit runs up over the name** (22 + 16 + 6 px, Global Weather's shape). Running 28 px
   down, as ART.md had it, lands on the tabs, which sit above it in the stacking order and take the tap;
   the name is not a control.
5. **The Block's caption wraps in the pane** (two lines on a phone held upright) instead of a fixed
   height: the fixed-height rule exists for the caption band, whose height moves the plate; this line
   scrolls with its pane and moves nothing.
6. **Health's caption line** is `Weeks of 12 Jan to 4 Oct 2026. Today is the last 24 hours the watch
   handed over.`: Health has no sport or equipment filter, so `all sports, any equipment` would describe
   a choice that is not there.
7. **The elevation profile's window** is an `--amount` area at 16 % under a line in the route's own
   colors (the stock line's colors, kept so the profile and the map read as one), the rest in `--ink-3`
   at 60 %.
8. **A broken replacement's notice** is the same centered plate, fixed over the pane rather than in its
   flow: in the flow it pushed the content down and the pane lost its place (`tools/shoot.mjs` asserts
   the scroll is kept).
9. **The stress line in Today is one color** (`--series-2`, as in the trends chart); the stock colored it
   by its four levels in the zone hues with no legend, color alone carrying a meaning. The level is a
   word in the card and the caption gives the thresholds.
10. **Recovery laps are `--zone-1`**, the gray zone token (the stock used a hairline token, under 3:1).
11. **The assessment's lead** is the tone word (`On track.`), followed by the data's own verdict only
    when it says something else (the demo's `On track` does not).
12. **Text keys** draw their 1 px frame 28 px tall on a 44 px hit, the house's unit-key shape, rather
    than a 44 px frame: the owner's standing rule asks for modest controls.
13. **The routes' OpenStreetMap credit** (the lead's ruling on owner call 4, above): under a route drawn
    from the template's own courses (`Route: © OpenStreetMap contributors, ODbL.`) and as a sentence in
    About's sources, keyed on the generator's own rule for its sessions (`id` starting `demo-`,
    `scripts/make_demo_running_dashboard.py` lines 1255 and 1264), so a copy's own pulled routes never
    carry it and the word demo never appears on screen.
14. **Words** the change list implied: `Hike or walk` for `Hike / walk`; `Steps per day`, `Floors climbed
    per day` and `Active calories per day` on the Health charts, whose weekly bars are an average day
    (the stock legend said `per week`); `Smoothed` on the heart-rate switch, each chart's caption giving
    its own window from the series' median spacing (about 10 min for heart rate, about 18 min for
    stress; the stock tooltip's `15-min mean` was wrong).

**Measured** (the commands run from `Template/running-dashboard/` on 2026-10-02):

- `node tools/check.mjs`: every check passes but one, the code cap: `app code 241,335 bytes (cap 236,521)`,
  `index.html 7,304, style.css 20,805, app.js 199,984, js/units.js 5,956, js/block.js 6,857,
  js/palette.js 429`. Before the pass: `app.js` 203 882, `style.css` 30 622, `index.html` 2 017. So the
  stock's own files shrank by 8 428 B (`style.css` −9 817, `app.js` −3 898, `index.html` +5 287 for
  About's markup and prose) and the three new modules add 13 242 B. Fonts 41 291 B (Geist's 74 128
  before); the ZIP 1 073 152 B of 1 340 193; the 37 data files byte-identical (concatenation
  `37973fe9…ecf180e`, as before the pass). **The code cap is the lead's to rule** (D22): 4 814 B,
  2.0 % over the held 236 521, under the art pass's estimate of about 244 000.
- `node tools/test_block.mjs`: `all 15 pass` (the Block on 1 Oct 2026 against this file's own decode,
  the layout at both scales, no plan, a range, an expired horizon, the card and the label, 30 format cases).
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: `all checks pass`, 98 checks, both themes; headless Chromium
  on this Mac, so its times (first pane about 340 ms, a pane drawn and checked in 90 to 390 ms) are a
  trend, never phone evidence. With `SCREENSHOTS=1` it wrote `screenshots/{now,plan,training,health,
  sessions}-{light,dark}.png` and `about-light.png`; `screenshots/app.png` untouched.
- `python3 running-dashboard/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
- The supplement: `tools/art/font_extra.py` run twice with fonttools 4.60.2 and Brotli,
  `fonts/ysabeau-office-running-dashboard-extra.woff2 1216 B sha256 f9937497…583268` both times, `cmp`
  silent.

**The camera**: unchanged. `Now` and `Health` are still `<button role="tab">` built by `buildTabs()` after
the snapshot parses (the static markup holds none), so `app.buttons["Health"]` remains the proof of
data and `selectPane` finds both; the loop clip's drag from 75 % to 35 % scrolls the pane (shoot.mjs
drives it by real touch: 376 px, the page and the bands still).

**Phone checks** (ART.md's list, unchanged): on an iPhone with iOS 18 and one with iOS 26, the pane
scrolling inside the frame (momentum, the caption band holding still, no rubber-band of the page); the
loop clip's drag scrolling Now; the stamp's stale sentence on a two-day-old snapshot; a Shortcut delivery
while the app is open (the reload keeping the pane and scroll, and a broken delivery keeping the data);
VoiceOver on the tabs, a tapped bar's sentence and the Block's label; the readout card's placement at
the screen's edges and hung under the Block; safe areas and the caption band over the home indicator;
landscape; the native selects' picker over the word keys; the route map's drag and the two 44 px thumbs;
a vertical scroll that starts on a chart (the chart's card opens on the touch, as before the pass).

---

## The change list and the owner calls, moved from ART.md (sections 8 and 9, word for word)

## 8. The change list (for the builder, in order)

Bugs from the stranger's run are B1 to B17 (none is on record for this app in plan 0009 item 5,
`docs/review/` or the app's own notes; the two record searches, `grep -rn -i "running.dashboard"`
over `docs/review/` and plan 0009's item 5, found none). Every B is a must.

1. `.gitignore`: done in the art pass (`tools/.work/`, `tools/node_modules/`, `dist/`).
2. `fonts/`: copy `global-weather/fonts/ysabeau-office-gw.woff2` and `OFL.txt` byte for byte; delete
   `Geist.woff2` and `LICENSE-Geist.txt`.
3. `tools/art/font_extra.py`: Milky Way's recipe for U+2082 (section 4); run it; it must print 1 216 B
   and sha256 `f9937497…583268` (a different figure is a stop, not a pass).
4. `style.css`: rewrite to the house's, from Global Weather's as the base: the one `@font-face` and the
   supplement's; the chrome tokens of HOUSE 3.1 in `:root` and under `(prefers-color-scheme: dark)`
   (and the `[data-theme]` overrides the stock file honored, if kept); the data tokens `--zone-0…5` and
   `--series-1…8` pasted from `palette.py --json`, and `--amount: var(--series-1)`; `html, body {
   background: var(--page) }`; the frame (header, scrolling pane, fixed caption band); sections,
   headings, facts rows, legends, chips as words with the tracer, text keys, the window's track and
   word selects, tables, the sessions list, the plan's rows, disclosures with a drawn chevron, the
   readout card, notices, About, the `.sr` class, landscape, safe areas; `transition` only on
   `opacity`, `transform` and `clip-path`, never `all`; `@media (prefers-reduced-motion: reduce)`
   setting every duration on `*, *::before, *::after` to 0s; hover only under `(hover: hover)`;
   `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` on every control. No
   `box-shadow`, `backdrop-filter`, `text-transform: uppercase`, `letter-spacing` other than 0,
   `font-family` but through `--face`. Map tiles' dark inversion kept.
5. `index.html`: `<html lang="en-US">`; viewport unchanged (no `user-scalable`); `<meta
   name="color-scheme" content="light dark">`; two `theme-color` metas, `#e8eef0` and `#141d21`; the
   header (`h1 translate="no"`, the stamp as a `<button>` with `aria-haspopup="dialog"` and its
   description); the tablist (empty until `buildTabs()`); the pane's controls block; `<main>` without
   `aria-live`; the caption band with the caption line and the credits; the live region `<p class="sr"
   aria-live="polite">`; About's dialog with the words of section 3. The stock footer goes.
6. `js/units.js` (new): every number, unit, date and span the app writes, as HOUSE 6.1 and 6.2: U+2212
   for negatives and never `−0`, U+202F between a number and its unit and between thousands from four
   digits (B11: `toLocaleString('en-GB')` puts commas in `11,669` steps and `1,013` today), a point for
   decimals, whole numbers whole; `km`, `pace` (`4:54 /km`), `span` (`1 h 12 min`, `56 min`; the stock
   `1h 12m` goes), `clock` and `date` built by hand from the phone's clock (B7: `toLocaleTimeString`
   with `'en-GB'` and `[]` today); `spoken()`. `toFixed` and `toLocaleString` nowhere else but the
   allow-list `check.mjs` names.
7. `js/palette.js` (new): the route ramp's nine stops per theme pasted from `--json`; `app.js`'s
   `RAMP` and `rampColor` go, the route reads the theme's stops.
8. `js/block.js` (new, pure): the Block's weeks, runs, targets, ranges and scale (section 1), exported
   for the test; the drawing in `app.js` (or in the module) by section 1's rule; the readout, the
   `aria-label`, the table, the caption; `window.__rd.block()`.
9. `app.js`, the frame: render into the pane's scroller; every `window.scrollTo`/`scrollY` moved to it;
   the stamp (B1: stale in words; B6: a button; opens About); `buildTabs()` with the tracer, still after
   the parse; the window, track and selects (B10: words in full, dates with four-digit years); every control 44 × 44 px
   (B17: the stock tabs are 40 px tall, the presets 28, the window's thumbs 28, the selects 36 and the
   ⓘ key 26 × 26, measured by the stranger's run); the caption band's line per pane and the credits constant `Data: Garmin Connect. Coaching text: the
   coaching routine.`; remove the entrance class.
10. `app.js`, notices: `fail()` becomes the notice plate; on a reload that fails while `DATA` exists,
    keep the pane and say so (B3); no monospace (B4).
11. `app.js`, the live region: `<main>` loses `aria-live` (B2); one `announce(text)` writing the `.sr`
    region; the readout card announces once per tap, never per move.
12. `app.js`, the readout card: `showCard()`, cards as objects from every tip function (columnChart,
    scatterChart, lapChart, statusStrip, streamChart, the map, the profile, the Block), updated in place,
    placed as section 3 says, ✕ named `Close`; `readout()`'s pin, drag and hover behavior kept.
13. `app.js`, sections: `card()` becomes a section; `help()`/`ensureInfo()` become the `How to read it`
    disclosure (B5); `tableToggle()` says `Show the table`/`Hide the table`; the group heads in sentence
    case (B12).
14. `app.js`, facts: `tile()` becomes a facts row (label, value with unit, note); every tile call site
    keeps its numbers and notes; the stray leading separator in `Training effect`'s note when Garmin's
    label is missing (today `anaerobic 3` led by a middle dot) goes (B13: notes are joined, never prefixed).
15. `app.js`, the one large figure per pane (Now, Plan, Sessions; section 3).
16. `app.js`, tone: pills become words (`On track.` …) in `--ink` 620; the race table's colors go and
    `Δ` becomes `Difference` (B14 with item 19).
17. `app.js`, chips become word rows with the tracer and roles (section 3).
18. `app.js`, charts: ticks, captions and labels at 10.5 px; square bars; planned bars in outline; ink
    lines on a `--page` casing; `--amount` for every single-quantity chart; thresholds in `--ink-2`;
    the cursor in ink; mark labels (`now`, `today`) in `--ink-3` (B15: the stock `now` and `today` are
    set in `--hairline-strong`, 1.48:1 on the white card and 1.78:1 on the dark one); month labels with
    four-digit years where they carry one (B10: `Mar 26` reads as the 26th of March).
19. `app.js`, the ramp-rate chart: the green band and red spike line become the neutral band and the
    `--ink` rule with `1.5, a spike` (B14).
20. `app.js`, the Plan pane: the Block replaces `horizonCard`'s first chart; the load chart keeps its
    four units with planned bars in outline; the race mark of every chart anchored inside the chart
    (B9).
21. `app.js`, the Sessions pane: the list rows, the session's facts and figure, the map (modes as
    words, the credit in the caption, the range label in words, the ramp from `js/palette.js`, the
    legend with open ends), the session curves and laps; the note sentence when a recent session has
    no evaluation says `No evaluation written for this session yet.` (today it claims the notes are
    written only for sessions logged after they began, which is false for the newest session: B16).
22. `app.js`, the Health pane: Today's facts and charts; the smoothing words say the window each chart
    uses (`Smoothed, 10 min` today labels both, while the stress chart's tooltip says a 15-minute mean);
    the step goal and other rules as `about`.
23. `app.js`, US English in every string and comment (`check.mjs`'s list): `Color by stroller`,
    `colored`, `meters`, `kilometers`, `normalized`, `re-analyzed`, `gray`, `catalog`, `Strength
    program` (the data key `programme` stays: data), `neighbors`; the six `≈` in strings as `about`
    (three more sit in comments); no arrow, chevron triangle, `Δ` or circled i in shipped text.
24. `app.js`, dead code out: `columnChart`'s `diverging` mode (no caller), `.kv`, `.swhy`, `--div-*`.
25. `app.js`, markup from strings: no new `innerHTML`, `insertAdjacentHTML` or `outerHTML`; `el()`'s
    third argument becomes text; the remaining `innerHTML` assignments (14 that are not `= ''` today)
    either go with the card rewrite or escape every value, and `check.mjs` counts them.
26. `app.js`, motion: no transition but the tracer's, the card's and About's; smooth scrolling only
    when Reduce Motion is off (`matchMedia` read live).
27. `app.js`, the test hook `window.__rd` (inert): `block()`, `card()` (the open card's object),
    `pane()`.
28. `TILES.md`: Geist's section out; the British spelling of *license*
    made US English (the file ships).
29. `NOTES.md`: US English (*catalog*, *kilometers*, *colored*, *license*, each
    spelled the British way today), the typeface sentence in
    the last section (`fonts/Geist.woff2` becomes the house face and its supplement, with the
    supplement's code point, command and sha256), the font credit line, and the stale-stamp sentence
    ("turns into a warning" becomes "leads with the word Stale").
30. `PROMPT.md`: US English (*kilometers* and *neighbor*, spelled the British way today). The data's own text keeps its spelling (owner
    call 5).
31. `tools/check.mjs` (new, Global Weather's pattern, HOUSE 7.1's seventeen checks): `CODE_CAP =
    236521`, the font and supplement pins, each data file's sha256, the camera's two strings with
    their role and the rule that `index.html` holds no tab, `palette.py --json` equal to `style.css`'s
    tokens and `js/palette.js`, the innerHTML count, the tells.
32. `tools/test_block.mjs` (new): decodes `data/snapshot.json` with its own code and compares the
    Block's columns, runs, targets and scale with `js/block.js`; tests `js/units.js` (U+2212, U+202F,
    grouping, `spoken()`).
33. `tools/shoot.mjs` (new, HOUSE 7.2 as the kind allows): boot by the camera's strings, both themes,
    text contrast, the Block's ink sampled, SI in every visible text node, the readout equal to the
    script's own decode, hit targets 44 × 44 (B5's 26 px key, the stock 40 px tabs, 28 px presets and
    36 px selects among the failures today), the loop drag scrolling the pane, About, Reduce Motion,
    broken data (missing, not JSON, the wrong shape, a broken replacement keeping the view), widths
    320, 360, 375, 844 × 390 and 125 % zoom, pictures to `tools/.work/shots/`, never
    `screenshots/app.png`.
34. `tools/DECISIONS.md` (new): sections 8 and 9 of this file moved there by the fix stage, with the
    pass record.

---

## 9. Owner calls left open

1. **US units one tap away.** HOUSE 6.1 puts a units key in every app that has something to convert.
   This app has hundreds of distances, paces and elevations in charts whose axes are built from the
   values, so a mile switch means converting at every row builder, not at formatting: an estimated
   6 000 to 9 000 B and a test of its own, against a code cap already held at today's size. The pass
   ships SI only (the watch's data is metric) and leaves the key for the owner: add it later with a
   cap raised for it, or leave the app SI.
2. **The code cap: the lead's interim ruling (2026-10-02, plan 0011 D22) is in section 6** — held at
   236 521 B until the build has measured, nothing cut, the lead rules on the measured figure. The
   question as the pass put it: held at 236 521 B (D5); the estimate after the pass is about 244 000
   (section 6). If the measured figure is over, the lead rules as for Milky Way, Besseggen and Snug
   Kart, or the owner names cuts. Candidates, with their size in `app.js` today (`grep` of the lines that carry
   them, so approximate): the muscle-load unit (the `MUSCLE` model and every `isMuscle` branch, about
   8 000 B), the `Sport time` unit (about 2 700 B), the grade- and condition-adjusted pace charts
   (about 1 500 B), the pane window's custom track (keeping the four words; about 2 500 B with its CSS).
3. **The route's colors read the session against itself.** HOUSE 6.5 wants scales fixed and printed.
   The route colors between the session's own 5th and 95th percentiles: a display choice the pass keeps,
   prints (the legend's open ends) and names in About, because a route map answers "where on this run
   was I faster", which a fixed scale would paint one flat color on an easy run. The alternative is a
   fixed scale per sport (for example 3:00 to 7:00 /km for running), at about 1 000 B.
4. **The demo's routes and OpenStreetMap's attribution.** The demo's six routes are derived from
   OpenStreetMap (ODbL; `TILES.md`), and nothing on screen credits that today: only `TILES.md` does. A
   map drawn from them is arguably a produced work that should carry `© OpenStreetMap contributors` on
   screen, but `NOTES.md`'s rule is that nothing on screen calls the demo a demo. The pass changes
   neither; the owner decides whether About's sources sentence names it.
5. **The coaching text's British spelling.** The demo's evaluation and plan spell *kilometers* the British way four
   times (`plan` twice, `assessment` twice). That text is data, written by
   `scripts/make_demo_running_dashboard.py`, and the pass leaves data byte-identical. A follow-up, as
   Milky Way's and Anatomy's were, can sweep the generator's prose and prove with its `--check` that
   only words changed.
6. **`Agent` on the race table.** The forecast's column is headed `Agent` and its sentences say *the
   agent's*. It names no vendor, so it passes HOUSE 6.4; *the coaching routine* would match `NOTES.md`
   and the credits line. Kept as written unless the owner prefers the routine's name.
7. **Garmin's zone colors in the light theme.** Fitted to the band, Z3 prints forest green and Z4 burnt
   orange on the film base (section 2), further from the watch's own colors than the dark theme's. The
   alternative, Garmin's exact colors, stands under 3:1 on the light page for every zone but Z5 (on `#e8eef0`: no
   zone 1.18, Z1 2.04, Z2 2.87, Z3 2.34, Z4 1.88, Z5 3.43; `palette.py`'s own functions).

### Phone checks, for the device matrix (not claimed here)

On an iPhone with iOS 18 and one with iOS 26: the pane scrolling inside the frame (momentum, the
caption band holding still, no rubber-band of the page); the loop clip's drag scrolling Now; the
stamp's stale sentence on a two-day-old snapshot; a Shortcut delivery while the app is open (the
`visibilitychange` reload keeping the pane and scroll, and a broken delivery keeping the data);
VoiceOver on the tabs, a tapped bar's sentence and the Block's label; the readout card's placement at
the screen's edges and hung under the Block; safe areas and the caption band over the home indicator;
landscape; the native selects' picker over the word keys; the route map's drag and the two thumbs at
44 px; a vertical scroll that starts on a chart (the chart's card opens on the touch and stays pinned
while the pane scrolls, as before the pass: whether that reads as a bug on a phone is the check).
(The last two items added after QA, from the as-built list above; this is the complete list.)

---

## After QA (2026-10-02)

QA passed the build (no must) and raised one should and two nits. All three answered here; ART.md's
rules and figures were corrected in place.

1. **Should: the scroll-on-a-chart concern was missing from the device list.** Applied. The list under
   "Phone checks, for the device matrix" in section 9 now carries it, with the readout card hung under
   the Block, which the as-built list had and that one did not. It is the complete list to copy into
   `docs/DEVICE_TEST_MATRIX.md`. Nothing is claimed about either on a phone.
2. **Nit: the race's name crossed the dashed `now` rule on Plan's time-in-zone chart.** Applied,
   because it was more than cosmetic. A probe of every chart carrying a mark (a throwaway Playwright
   script under `tools/.work/`, light and dark, the clock fixed at 1 Oct 2026, 12:00 Copenhagen)
   printed, before the fix, `line mark at x=272 (top 20) crosses label "Copenhagen Half Marathon"
   [216..337, y 18..32]`. It also showed the `now` word drawn at 275..294, inside the race's name and
   hidden under its halo. The column chart (`columnChart` in `app.js`) now applies the Block's rule
   (ART.md section 1): a mark's word that would collide with the race's name is not drawn (the rule
   stays), and a rule that passes under another mark's word starts 12 px lower, below its letters.
   After the fix the same probe printed no crossing, and the `now` rule starts at y 32. The day charts'
   `today` (130..155, its rule at 127.1) is unchanged. The picture shows `Copenhagen Half Marathon`
   whole in both themes. Cost +419 B (`app.js` 199 984 → 200 403; code 241 335 → 241 754 of 244 000).
   ART.md's "Marks that are not data" states the rule. `SCREENSHOTS=1 node tools/shoot.mjs` refreshed
   `screenshots/*-{light,dark}.png`, since the committed Plan pair showed the crossing; `app.png`, the
   README's composite, was left untouched (its hash checked unchanged).
3. **Nit: the OpenStreetMap credit is keyed on the `demo-` id prefix, not on license metadata.**
   Declined, with evidence. The data carries no license or source field (`snapshot.json`'s keys and
   every activity's: `cal d elev g hr hrMax id indoor km min movMin name race sport t type z`), and the
   pass keeps `data/` byte-identical, so no metadata-derived trigger is possible without a data
   change. The prefix is the license's own boundary. `TILES.md` grants the ODbL notice to
   "`data/streams/demo-*.json` and the `streams` embedded in `data/snapshot.json`". The generator
   enforces the prefix (`scripts/make_demo_running_dashboard.py --check` reports any activity or
   stream id without `demo-` as a problem). A real pull writes Garmin's numeric `activityId`
   (`scripts/garmin_pull.py` line 180, `build_garmin_snapshot.py` `aid = str(a["id"])`), which can
   never begin with `demo-`. If the owner wants a field instead (say `"license": "ODbL"` on the demo's
   streams), that is a pipeline change for a data follow-up, not this pass.


---

## After review (2026-10-02)

The reviewer's verdict was *fix*: three musts, eleven shoulds, three nits (one of them six small
slips). Every must is applied; the shoulds are applied, or declined with the measurement that decided
it. `ART.md` was corrected in place (and rewritten as built, below); the record is here.

### The musts

1. **Stale data shown as zero. Applied.** `todayIso()` now returns the last day the data saw: the
   phone's date, never before `dataThrough` and never past the local date of the pull (`pulledAt`, else
   `generatedAt`). `phoneIso()` is the phone's date, kept where the arithmetic is the calendar's: race
   day's countdown, a session's year in the list, `days ago` for the last hard session. When the phone
   is past the pull (`pastPull()`), Now's figure reads `Week of 28 Sep, data to 30 Sep` and its facts
   `Run, 7 days to 30 Sep` and `Run, 28 days to 30 Sep`; the Block's `this` is the pull's week, so no
   empty past weeks are drawn after it, only the plan's outlines; the plan's day charts mark the pull's
   day `updated` instead of `today` (and the load chart's week mark `updated` instead of `now` once the
   phone's week is past the pull's), and a planned session after the pull is planned, not missed;
   Today's facts carry their day (`at 30 Sep, 19:00`) whenever the sample is not from the phone's
   today. `NOTES.md` says so beside the stale stamp. `shoot.mjs` gained a case with the clock at
   21 Oct 2026, 21 days after the data, which checks the figure's words, the first fact's words and its
   value against its own sum (50.1 km for 24 to 30 Sep), the Block's columns, Plan's `11 days` from the
   phone and Health's day: all pass.
2. **The route card's ✕ 172 px from its button. Applied.** `.mapwrap svg` became `.mapwrap > svg` (the
   route's svg is the wrap's direct child; the card's ✕ is not). `shoot.mjs` now checks, on every card it
   opens (the Block's, Training's first chart's, the route's), that the drawn mark lies inside its
   44 × 44 button. With the stylesheet as the review found it, the route's check fails (`mark at 25,280,
   button at 197,278`); with the fix it passes (`mark at 213,294, button at 197,278`).
3. **A scroll that starts on a chart opens a card. Applied.** `readout()` now lets a finger say what it
   is before anything is shown: a lift where it landed is a tap (the card opens, pins and is announced
   once); a slide more than 8 px sideways, and more across than down, is a scrub (the card opens and
   follows, nothing is announced); a vertical move is the browser's scroll (`touch-action: pan-y`, then
   `pointercancel`), which leaves no card and no sentence, and a card a scrub had opened is closed by a
   cancel. A mouse or pen still reads on the press. The 24-hour chart's caption `Tap and hold to read a
   point.` became `Tap or slide sideways to read a point.` (holding still now shows nothing until the
   lift). `shoot.mjs` drags 260 px up from the middle of Training's first chart in both themes: the pane
   scrolls 294 px (light) and 297 px (dark) in the last run (the figure moves a few pixels run to run with
   the scroll's momentum), no card, the live region empty. Run against the app as the
   review found it, the same check fails: `opened "Week of 11 May 2026"` and said it.

### The shoulds

4. **A return to the app closes every open fold. Applied in part.** `load()` keeps the last good file's
   text and the day it was drawn on; the same file on the same day redraws nothing (only the stamp is
   rewritten, so `Stale.` still appears on time), so the pane, its scroll and every open fold stay.
   `shoot.mjs` opens three folds on Plan, scrolls 300 px and returns: 3 folds and 300 px kept, the
   snapshot read once. **Declined: carrying the folds across a re-render when the file did change.** It
   was built (folds keyed by their words and their place among those words) and measured at 421 B
   (`node tools/check.mjs` then printed 244 094 of 244 000 with the other fixes in), so it was taken
   out; a new delivery re-renders the pane in place and closes its folds, as a filter change does. If
   the owner wants it, it needs a cap raised by about 450 B.
5. **The route map traps vertical scrolling. Applied.** The map's svg and the elevation profile are
   `touch-action: pan-y`; a tap or a sideways slide reads points (the new `readout()`), and the map's
   caption says `Tap the map, or slide sideways, to read points along the track`. `shoot.mjs` swipes up
   across the map: the pane scrolls 269 px in the last run and no card opens; with the stylesheet as the review found
   it, 0 px.
6. **The saturated `--amount` blue. Applied.** `--amount` is its own token, no longer `--series-1`: a
   slate in the running hue family, `#4a6588` (L 0.500, C 0.065, h 255; on page 5.11, on sheet 5.66) in
   the light theme and `#93aeca` (L 0.740, C 0.050, h 249; 7.45 and 6.65) in the dark, defined in
   `tools/art/palette.py` (`AMOUNT`), checked there in the band, at 3:1 on both grounds and at chroma
   0.07 or less, emitted by `--json`, pasted into `style.css`, and compared by `check.mjs` (15 data
   tokens per theme now). `--series-1` keeps the stock blue for the running *category* (the sports'
   stacks and the status strip's Recovery), where hue is the meaning. Code cost 15 B.
7. **The Block's `now` reduced to a tick under `Half`. Applied.** When the race's name covers `now`, the
   notch is not drawn; the word goes to the month row under `this` if it stands at least 4 px clear of
   every month's name (measured with `getComputedTextLength`), otherwise neither is drawn. At 390 px
   the demo's `now` (18.7 px wide, centered at 234.5) would end 2 px before `Oct` (at 246), so on the
   camera's screen there is no word and no notch; at 844 × 390 `now` and its notch stand over the column
   (a throwaway Playwright probe printed the labels' positions at 390, 320 and 844 px). Anchoring the race's name over the values gutter was
   measured and set aside: the name is 153.3 px wide, so right-anchored at 358 it still begins at 204.7,
   left of `this`.
8. **Body battery `+66` on an easy run. Applied in the app; the data is a follow-up.** The session fact
   is now `Body battery change`, so a real pull's `−6` (Garmin's `differenceBodyBattery`,
   `scripts/garmin_pull.py` line 301) reads unambiguously. The demo generator writes a level
   (`int(rng.uniform(55, 95))`, `scripts/make_demo_running_dashboard.py` line 1007), so until the data
   follow-up the demo shows `Body battery change +66`, which is untrue; the data stays byte-identical in
   this pass. Added to owner call 5's sweep below.
9. **A broken replacement's plate cannot be dismissed. Applied: the Close key.** The plate keeps HOUSE
   4.9's sentence (`The new data/snapshot.json is not valid JSON; it looks like a web page was written
   over it. Still showing the data from 30 Sep, 20:20.`) and gains a framed `Close` text key, 48 × 44,
   that puts it away; the stamp keeps the data's age. The stamp-lead alternative was set aside: `Stale.
   New file not read. Updated 30 Sep, 20:20, last session 30 Sep` is about 70 characters, wider than
   the stamp's line at 390 px, so the header would grow a line exactly when the data is in trouble.
   `shoot.mjs` taps Close and checks the plate goes and the ten sections stay.
10. **The shipped `ART.md` was a pre-build change list. Applied.** The whole file as it stood is moved
    below, word for word, and `ART.md` is rewritten as built, in the present tense: no stock comparison,
    no B-numbers, no code plan, no after-QA figures, the false README line gone, every figure measured
    after the review. `node tools/check.mjs` passes its spelling and vendor-name checks over it.
11. **Category sets of five or fewer fail the color-vision check. Applied as a stated departure.**
    `palette.py` check 3 now prints every shortfall under simulation as `dep` with a header saying why,
    and `ART.md` section 2 states it in full: separating zone 3 from zone 4 (protan, light, 0.065) or
    run from strength (tritan, 0.065 light) by lightness would break the 3:1 floor on both grounds
    inside a 0.225-wide band or give up Garmin's zone hues, so identity rests on words and fixed order
    (every legend, every readout, the stacks' order, the session rows). Not re-fitted: moving zone 4
    lighter toward 0.60 lands it on series 4 (L 0.626, the amber), already the closest status pair at
    0.105.
12. **The route's relative pace ramp paints noise. Declined for this pass; owner call 3, still open.**
    The reviewer's proposal (a minimum span: 30 s/km of pace, 10 spm, 20 m, centered) keeps the
    owner's relative scale and would cost about 150 B of code plus about 200 B in About's and the map
    caption's sentences, which must then say the span is widened. The code stands at 243 905 of 244 000
    after the musts (95 B to spare), so it does not fit without a cut or a raise; it is written into
    owner call 3 below with its cost.
13. **The 12.5 px native selects and iOS focus zoom. Applied as a phone check.** Not reproducible in
    headless Chromium; added to the device list below with the fix to apply if it zooms (a transparent
    16 px select over the 12.5 px word key).

### The nits

14. **Small honesty and wording slips. Applied, all six.** (1) `VO₂ max` prints `–` when neither source
    has a value (`f1(undefined)` is `–` in `js/units.js`; the `|| 0` went). (2) A session's weather wind
    is in m/s like its headwind (the data's km/h divided by 3.6, one helper, `wind()`). (3) One verb for
    the instant the data was made, *Updated*: the stamp, Now's caption (`Updated 30 Sep, 20:20.`), the
    notice (`the data from 30 Sep, 20:20`), Today's chart caption (`updated 2 d ago`) and About
    (`Updated:` is the pull's time, or the build's when the snapshot has no `pulledAt`; `Snapshot
    built:` only when it has both). (4) A note that begins `per` is joined by a space (`.fact dd .per`).
    (5) The 24-hour charts draw a 1 × 3 px tick at every third hour and center each label on its tick,
    leaving out a label rather than end-anchoring it; a threshold's word within 12 px of the last one
    drawn is left out (the Z4 floor's, which touched Z3's). (6) The one large figure sits at its row's
    right (`.fig { justify-self: end }`).
15. **Accessibility structure. Applied.** Group heads are `h2` and the sections under them `h3` (panes
    without groups keep `h2`); `#pane` is a `role="tabpanel"` labeled by the chosen tab (`tab-now`
    and so on); the rows of words are `aria-pressed` buttons in a named `role="group"`, as Global
    Weather's layer words, each its own tab stop (the camera's tabs are untouched). `shoot.mjs`'s
    tracer check reads `aria-pressed` and passes on every pane in both themes.
16. **The coaching text's dates and spelling. Not this pass's (data).** Folded into owner call 5. The
    README composite `screenshots/app.png` still shows the stock look and is the lead's to remake.

### What the fixes cost, and how they were paid

`node tools/check.mjs`, from this folder: app code **243 905 of 244 000** (after QA 241 754, so
+2 151): `app.js` 202 501, `style.css` 20 842, `index.html` 7 320, `js/*` unchanged. Paid for in
place, nothing minified and no existing comment stripped: `el()` now sets `type="button"` on every
button it makes, so nine `.type = 'button'` lines went (203 B), and `el()` replaced
`document.createElement` in ten places (220 B), less the 70 B line that does it; the fold carry-over was dropped (421 B, item 4); the new code's comments
were written short. Fonts 41 291 B. The ZIP 1 072 937 B of 1 340 193 (`ART.md` went from 63 453 to
59 721 B). The data: 37 files, unchanged byte for byte (concatenation `37973fe9…ecf180e`).

### Verified (2026-10-02, from `Template/running-dashboard/` unless noted)

- `node tools/check.mjs`: `all checks pass`.
- `node tools/test_block.mjs`: `all 15 pass`.
- `python3 running-dashboard/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: `all checks pass`, 111 checks in both themes and once,
  `screenshots/app.png` untouched. Headless Chromium on this Mac: its times are a trend, never phone
  evidence. Run against the app and stylesheet as the review found them, the new checks fail as they
  should (the scroll on a chart, the route's ✕, the map swipe, the kept folds).

### The camera

Unchanged and needs no change: `Now` and `Health` are still `<button role="tab">` built by
`buildTabs()` after the parse (they gained an `id`, nothing else), and the loop clip's drag still
scrolls the pane (shoot's last run: 363 px) and, with the new `readout()`, can no longer open a card where it
starts on a chart.

### Owner calls left open after the review

1. **US units one tap away** (unchanged): SI only; a mile switch needs a cap raised for it (6 000 to
   9 000 B estimated).
3. **The route's colors** (unchanged, with the reviewer's proposal): the session's own 5th to 95th
   percentile, stated in About and the caption. The proposal: keep it relative but give it a minimum
   span (for example 30 s/km of pace, 10 spm, 20 m), so a steady run reads steady; about 350 B with
   its sentences, which needs a cap raise of that size.
5. **The data follow-up** (widened by the review): sweep `scripts/make_demo_running_dashboard.py` and
   prove it with `--check`: the British spellings in the coaching text; the session body battery as a
   negative change, as Garmin's `differenceBodyBattery` is (today a level, 55 to 95, shown as
   `Body battery change +66`); dates in the coaching text as `14 Sep` (today `week of 2026-09-14`) and
   `1 Nov`; no spaced em dashes; and the same instructions in `PROMPT.md` for the coaching routine.
6. **`Agent` on the race table** against *the coaching routine* everywhere else (unchanged).
7. **Garmin's zone colors in the light theme** (unchanged): fitted to the band, burnt orange and forest
   green.
(Owner call 2, the code cap, was settled by the lead at 244 000 B, plan 0011 D23; owner call 4, the
OpenStreetMap credit, by the lead's ruling. Both stand.)

### Phone checks, for the device matrix (not claimed here)

On an iPhone with iOS 18 and one with iOS 26:
- switching into Training and Health (10 to 14 SVG charts each): the time it takes;
- the stale stamp on a two-day-old snapshot, and the stale state's words three weeks on (`Week of …,
  data to …`, `Run, 7 days to …`, `updated` on Plan's day charts);
- a return to the app after a Shortcut delivery: the same file keeps the open folds and the scroll; a
  new file re-renders in place; a broken delivery shows the plate, its Close key puts it away, the data
  stays;
- a tap on a chart (the card and VoiceOver's sentence, said once), a sideways slide across the
  721-sample heart-rate chart and along the route (the card follows the finger and reads its own size
  on every move), and a vertical scroll that starts on a chart and on the route map (the pane scrolls,
  no card opens): WebKit sends `pointercancel` when a pan starts, as Chromium does, but this is the
  check;
- the distance thumbs, which rebuild the route on each input;
- tapping `All sports` and `Any equipment`: whether iOS zooms the page on focusing the 12.5 px select
  and leaves the frame zoomed (if it does: a transparent 16 px select laid over the word key);
- the nested scroll of the session list inside the pane;
- the pane scrolling inside the frame (momentum, the caption band holding still, no rubber-band of the
  page), and the loop clip's drag scrolling Now;
- VoiceOver on the tabs and the tab panel, the heading rotor (groups as `h2`, sections as `h3`), the
  rows of words as pressed buttons, the Block's label;
- the readout card at the screen's edges and hung under the Block;
- safe areas and the caption band over the home indicator; landscape (`now` over the Block's column).

---

## ART.md as the build and QA left it, moved here word for word (2026-10-02, after review)

The reviewer found the shipped `ART.md` still largely a pre-build change list against the stock app (the
stock comparisons, the B-numbers, "the builder implements", the code plan of section 6 and its after-QA
figures), against HOUSE.md's rule "What ships and what does not". The whole file as it stood is kept
below, verbatim, as the record, inside a fenced block so its headings are not this file's; nothing in it
was edited. `ART.md` itself was rewritten as built, in the present tense.

````markdown
# Running Dashboard: art direction

`NOTES.md` says where the data comes from and how the pieces fit; `PROMPT.md` sets a copy up. This
file says how the app looks, moves and speaks under the template's house system
(`Template/HOUSE.md`, the brief; Global Weather is the reference, and Milky Way, Besseggen, Norne
Reservoir, Anatomy, Shelf Atlas, World Oil & Gas and Snug Kart took it before this one). It is the
first of HOUSE 4.0's *panes from a pull* to take the house, so what it settles for a pane app (the
frame that scrolls inside itself, the caption band that closes each pane, the readout card inside a
chart, the plan drawn in outline) is the pattern the four pane apps after it follow.

The pass's working record (the change list, the owner calls, the as-built departures) is in
`tools/DECISIONS.md`, which does not ship (HOUSE.md, "What ships and what does not"); section 8 says so.

**Measured on 2026-10-02** on the working tree before the pass (Template commit `931b799`). Every
figure names the command that printed it; the commands run from `Template/running-dashboard/` unless
they say `Template/`. `python3 running-dashboard/tools/art/palette.py` (from `Template/`) prints every
color and contrast and ends `ALL CHECKS PASS` (exit 0). The stranger's run was a throwaway Playwright
script in `tools/.work/` (headless Chromium, 390 × 844, DPR 2, real touch, both themes): its pictures
are evidence of what the page draws, never of how a phone feels.

---

## The look: the house, with one bold thing of its own

Running Dashboard today is a stock analytics page: Geist, a blue accent on tabs, chips, thumbs and
links, white cards with an 18 px radius and a soft shadow on each of about 30 charts, uppercase
tracked eyebrow labels over 28 px tile numbers, green, amber and red pills for the coaching tone, a
gradient wash on the verdict, a frosted sticky header, an entrance animation on every pane, and the
chart colors of a generic data-viz kit (eight series and Garmin's zones, nothing fitted to a ground).
It is honest and dense, and it looks like every dashboard. The pass keeps every number and every
chart and changes how they are set.

- **Panes on a page, not cards.** Each pane is one column on `--page`: sections separated by 1 px
  `--line` rules, headed in the house face at 13.5 px 650, each chart with its legend, a one-line
  caption that says what one bar is, and a `How to read it` disclosure holding the longer text that
  the ⓘ button hid. No card, no shadow, no radius but the house's roles.
- **Color only where it is a category.** Garmin's zone hues, the sports, the shoes and Garmin's
  training statuses keep their identities, fitted into a lightness band per theme (section 2). A
  chart of one quantity (sleep hours, steps, floors, calories) no longer wears an arbitrary hue of its
  own: it is drawn in the running series' tone, `--amount`, and every average line is ink on a casing.
- **The plan is drawn in outline, everywhere.** What was done is filled; what the plan asks is a
  1.5 px outline of the same shape. The Block (section 1) is where that rule is born; the day charts,
  the load chart and the plan's zone bars follow it, so a reader learns it once.
- **One bold thing: the Block** (section 1), the training block as a coach's sheet, weeks of running
  in ink with the weeks still to run as empty outlines up to race day. Everything else is quiet.
- **Honesty is the coaching text's provenance and the data's age.** Every number is the watch's or is
  computed here by a method About names. The evaluation, the plan and the race forecast are text the
  coaching routine wrote on a date the screen prints; the data's age is a sentence in the stamp, never
  a color.

**How it differs from the apps before it** (it copies none of them):

| | Signature | Axis | What it encodes | Where | Shape |
| --- | --- | --- | --- | --- | --- |
| Global Weather, Global Wind | the streak field | the map | the wind's path | on the plate | streaks |
| Earth's History | the stratigraphic column | time (Ma) | period colors | the time track | a banded column |
| US Quakes | the record strip | time (days) | magnitude by stem height | the time track | stems |
| Warming World | the stripes as an instrument | time (years) | anomaly by color | the scrubber | stripes |
| Milky Way | the Reach | distance from the Sun | presence | under the header | a log ruler with gaps |
| Besseggen | the Burn | the hours of one day | the sun's altitude, direct sun | the time track | one arch with bites |
| Norne Reservoir | the Cut | the production history | liquid per day, oil and water | the time track | a two-tone skyline |
| Anatomy | the Levels | height in the body | the selection's span in levels | the plate's left edge | a column of blocks |
| Shelf Atlas | the Peaks | the map | each field's best month so far | around the discs | rings |
| World Oil & Gas | the Ledger | the world's output in one year | each country's share | a strip under the plate | one strip of blocks |
| Snug Kart | the Lap Chart | race distance, in timing lines | each racer's place at each line | the results sheet | eight crossing lines |
| **Running Dashboard** | **the Block** | **weeks, twelve back to race day** | **each run's kilometers, and the plan's target per week** | **the head of Now and Plan** | **ink columns cut into runs, then empty outlines** |

The one family resemblance is Shelf Atlas's Peaks, where an outline is a reference and the fill is
now. There the reference is a record behind the disc (the field's best month); here it is an
intention ahead of the ink (the week the plan asks for), and the outline is empty until the runner
fills it. It is the only signature in the template that draws the future as something a person is
going to do rather than something that will happen to them.

---

## 1. The signature: the Block

**What it is, in one paragraph a stranger would get.** A coach plans a race as a *block*: sixteen
weeks or so of running drawn up on one sheet, the weekly distance climbing through a build with an
easier week every few, peaking, then tapering into race day. Runners pin that sheet to the fridge and
fill it in. Running Dashboard draws the sheet at the top of its first pane. Each week is a column.
The weeks already run are solid ink, cut into one block per run, so a week of six runs shows six
pieces with the long run the tallest. The weeks still to come are empty outlines as tall as the plan
asks, ending at the race, named over its week. This week is both: an outline of what the plan wants,
with this week's runs filling it from the bottom, a block at a time. A glance says how far into the
block you are, what the shape of it has been, how much of this week is left, and how many weeks
until the start line.

**What a stranger remembers** is the empty boxes. The demo's Block (measured from `data/snapshot.json`
with a throwaway script; `python3` over `activities[]`, `plan.horizon[]`): twelve weeks back from the
week of 28 Sep, from 49.8 km (13 Jul, five runs) through two peaks of 73.9 and 77.8 km (7 and 14 Sep,
six runs each, the long runs 23.0 and 24.0 km) and two down weeks (40.0 km on 24 Aug, 45.9 km on
21 Sep), then this week, 24.0 km in two runs inside an outline of 62 km, then four outlines, 76, 62,
48 and 49 km, the last carrying Copenhagen Half Marathon on Sunday 1 Nov. The build, the peak and the
taper are visible without a word. (The figures are running kilometers, walk breaks out, as the rule below
says; the sessions' whole distances are 49.9, 74.0, 78.0 and 46.0 km. `node tools/test_block.mjs` prints them.)

**How it was found** (HOUSE 5.1):

1. *What does a specialist call the picture of this data?* A coach's training block (periodization)
   sheet: weeks across, volume up, the race at the end. Also the training log (a diary of days), the
   fitness and fatigue chart (Banister's two curves, which Garmin's acute and chronic load already
   are), the intensity distribution (time in zone) and the route map. Only the block sheet holds the
   plan and the runs on one axis.
2. *What does a person do most here?* Opens it in the morning on Now, the pane the app opens on and
   the marketing camera photographs (shot 11, README pane 1): did the week go to plan, what is next,
   how long to the race. The Block sits where the eyes land and answers all three.
3. *What does this data have that no other app has?* A plan: an intention written ahead by the
   coaching routine (`plan.horizon[]`, one target per week to the race; `plan.goal.race`, a dated race)
   set against what the watch recorded. No other app in the template has a future that a person will
   carry out. Moved to Finances it would need a budget per week and a race; moved to a weather app it
   would draw a forecast as if it were a promise. Set aside, with what they would have said:
   - *The fitness and fatigue chart*: true and already on Training (Garmin's acute and chronic load),
     but it is TrainingPeaks' and Garmin's own picture, and it says nothing about the plan.
   - *The training log as a calendar of days*: honest, but the calendar grid of dots sized by distance
     is a common product pattern and a contribution-graph look-alike; it could move to any app with
     dates.
   - *The route map*: the most visual thing in the app, and the least fitted: every running app has it,
     and the demo's routes are segments of famous courses, not the runner's own.
   - *The heart-rate zone trace* (every second of a run credited to a zone, `zk`): precise and rare, but
     a picture of one session, read on Sessions, not the thing a person opens the app for.
4. *Can it be drawn with the house's means?* Yes: `--ink` blocks and 1.5 px `--ink` outlines on
   `--page`, `--line` hairlines, 10.5 px labels in the house face, no motion at all.

**The rule it is drawn by** (the builder implements exactly this; `tools/test_block.mjs` proves it):

- **The weeks** (`js/block.js`, pure, exported for the test). Let `this` be the Monday of today's
  week by the phone's clock (the existing `todayIso()`, which never runs earlier than `dataThrough`).
  The columns are the eleven Mondays before `this`, `this`, and every Monday after `this` in
  `plan.horizon[]` (in the demo four, to 26 Oct; up to 26 when a plan reaches further). Without a plan,
  or with a horizon that ends before `this`, the columns are the fifteen Mondays before `this` and
  `this`: ink only.
- **The ink.** For each column up to and including `this`, every activity with `sport === 'run'` whose
  date falls in that week contributes one block of `runKm(a)` (the running inside the session, walk
  breaks out, as every running figure in the app already is), stacked from the baseline in date order
  and, within a day, start-time order (`a.t`). Height = km × the scale; a 1 px gap of the ground
  separates blocks; a block under 1 px is drawn 1 px. No other sport is drawn: the Block is running
  kilometers, as its caption says.
- **The outline.** For `this` and each later column, the plan's target: `horizon[i].km` for that
  Monday (a number). Drawn as a 1.5 px `--ink` stroke inset by 0.75 px so its outer edge is the
  column's edge, no fill, square corners. Where `plan.weeks[]` gives the same week a range
  (`targetKm` like `26–30 km`), the outline runs to the upper value and a 1 px `--ink` tick crosses it
  at the lower value; the readout prints the range as written. A week before `this` never has an
  outline: past plans are not kept in the data, and the Block does not invent them (About says so).
- **The scale** is fixed and printed: **0.8 px per km on Now, 1.2 px per km on Plan**, from a
  baseline. The plot is as tall as the larger of 80 km and the tallest column (ink or outline) rounded
  up to 20 km; 1 px `--line` hairlines at every 20 km behind the columns, with their value in a 30 px
  gutter at the right end in 10.5 px `--ink-3` (`20`, `40`, `60 km`, the unit after the last only,
  U+202F before it; over the columns the values collided with the last outlines and the race's rule). The demo's Block is 64 px of plot on Now, 96 on Plan.
- **The columns** share the content width less the values' 30 px gutter (328 of 358 px at 390 × 844
  with 16 px gutters): slot = width / columns, column = slot − 4 px, left-aligned in the slot, every
  edge on a whole pixel (16 columns: 20.5 px slots, columns of 16 and 17 px).
  Above the plot, one 14 px label row; under it, a 3 px gap and one 14 px label row.
- **The labels.** Under the plot, in 10.5 px `--ink-2`, the month at the first column whose Monday
  begins it (`Jul`, `Aug`, `Sep`, `Oct`), the first label carrying the year (`Jul 2026`), and a later
  January carrying it again; a label that would collide with the one before it is skipped. Above the
  plot: over `this`, `now` in 10.5 px `--ink-3` with a 1 × 6 px `--ink-2` notch down to the plot's top;
  over the race's column, a 1 px `--ink` rule at the race day's x (the column's left + (weekday index +
  0.5) / 7 × column width) from the label row to the outline's top, and the race's name and date in
  10.5 px `--ink-2`, `Copenhagen Half Marathon, 1 Nov`, anchored at its **right** end to the rule so it
  can never run off the chart (the stock chart's race label is cut to `Co` at the right edge in both
  themes: bug B9). If the race label and `now` would collide, `now` keeps its notch and loses its word, and under the
  race's name the notch starts below its letters, which sit on a 3 px `--page` halo.
- **The readout.** A tap or a drag on a column opens the house readout card (HOUSE 4.7; section 3) for
  that week: the place line `Week of 14 Sep 2026`, the value `77.8 km` (21 px, 600; the unit 13.5 px
  after U+202F), then the rows `Runs 6`, `Longest 24.0 km`, and for a planned week `Plan 76 km`,
  `Kind peak`, `Mix easy 78 %, moderate 12 %, hard 10 %`, `Note The last big week.` (from the data,
  as written). This week's card says `So far 24.0 km of 62 km planned`. The card's text is announced
  once in words (`Week of 14 September 2026. 77.8 kilometers in 6 runs, longest 24.0 kilometers.`).
- **Keyboard and VoiceOver.** The drawing is `role="img"` with an `aria-label` built from the data:
  `Weekly running, 13 July to the week of 26 October 2026: 12 weeks run, the latest 77.8, 45.9 and so
  far 24.0 kilometers; 4 weeks planned, 76, 62, 48 and 49 kilometers; Copenhagen Half Marathon on
  1 November.` The section's `Show the table` key lists every column (week, run km, runs, longest,
  plan) as the other charts' tables do.
- **The caption**, under it, 11 px `--ink-2`, wrapping in the pane (two lines on a phone held upright):
  `Weeks of running to Copenhagen Half Marathon: ink is a run, an outline the plan's week.` Without a
  race: `Weeks of running: ink is a run, an outline the plan's week.` Without a plan: `Weeks of
  running: each block is a run. No plan in this snapshot.`
- **The test hook**: `window.__rd.block()` returns `{ columns: [{ week, runs: [km…], target, low,
  kind }], scale, points: [[x, y, w, h]…] }`, the drawn rectangles in CSS px, so `shoot.mjs` checks
  the drawing against its own decode and samples the ink's pixels.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears.* No activities, no ink; no plan, no outlines; no race, no race
   mark. A broken snapshot is a sentence (section 3), never an empty sheet. Nothing is seeded or drawn
   ahead of the data, and nothing moves.
2. *Every property that varies is measured.* A block's height is a run's running kilometers at a
   printed rate; an outline's height is the plan's number for that week at the same rate; x is the
   week (an even division of time); the race rule's x is the race's date; the gaps are fixed. Color
   encodes nothing: it is all ink.
3. *It is captioned.* The caption above, the hairlines' values, the month labels, `now` and the race's
   name; About's first section in full.
4. *It reads.* Ink on `--page`: 14.80:1 in the light theme, 14.43:1 in the dark (`python3
   running-dashboard/tools/art/palette.py`, check 4), against a target of 3.0:1 for a mark. The 1 px
   gap between two runs is the page itself, so it holds the same figure. `shoot.mjs` samples the
   drawn ink on rendered pixels in both themes.
5. *It survives Reduce Motion.* It has no motion.
6. *About says what it shows and what it does not* (its first section): running only, walk breaks
   out; one block per run, not per day; the outline is the plan as the coaching routine wrote it on
   the date printed, and past weeks' plans are not kept, so a past week shows only what was run; a
   target given as a range is drawn to its top with a tick at its bottom; the scale; and that the
   weeks follow the phone's calendar (Monday to Sunday).
7. *It is the only bold element.* On Now and Plan it is the only drawing in ink at full strength; the
   charts below it are drawn in the fitted data tones, the text is quiet, and no tile or pill competes.

---

## 2. Palette

Every figure here is printed by `python3 running-dashboard/tools/art/palette.py` (from `Template/`;
`ALL CHECKS PASS`, exit 0, run 2026-10-02). `--json` prints the fitted tokens and the route ramp per
theme; the builder pastes them into `style.css` (the zone and series tokens) and `js/palette.js`
(the ramp), and `tools/check.mjs` fails while either differs from `--json`. The script's source colors
are the stock `style.css`'s light tokens, copied into it as `SOURCE` because they are not in any data
file; their hue and chroma are what is kept.

### The chrome tokens

The house's, copied as they are, in both themes (HOUSE 3.1; Global Weather's `style.css` lines
17-43), with `--draw`, `--sheet-in` and `--face`. Gone from `:root`: `--surface-0` to `--surface-3`,
`--hairline`, `--hairline-strong`, `--text-*`, `--accent`, `--on-accent`, `--shadow`, `--ring`,
`--good`, `--warning`, `--serious`, `--critical`, `--div-*`, `--radius`, `--radius-sm`, `--pad`,
`--ease`.

| Token | Light | Dark | On `--page` | On `--sheet` |
| --- | --- | --- | --: | --: |
| `--ink` | `#0f1c23` | `#e6edee` | 14.80 / 14.43 | 16.40 / 12.87 |
| `--ink-2` | `#45555d` | `#a3b1b6` | 6.61 / 7.76 | 7.32 / 6.92 |
| `--ink-3` | `#5b6a72` | `#8b9a9f` | 4.78 / 5.88 | 5.29 / 5.25 |
| `--line-strong` | `#74858c` | `#64757b` | 3.27 / 3.56 | 3.62 / 3.18 |

The on-plate (`--ink` at 12 % over `--sheet`: `#dadee0` / `#343f43`) marks the chosen session row and
a key that is on: `--ink` on it 12.81 / 9.14, `--ink-2` 5.72 / 4.91. The highest chroma of any chrome
token: 0.0239 (light), 0.0223 (dark).

### The tonal budget

| | Light (film base) | Dark (the print) |
| --- | --- | --- |
| Ground | `--page` `#e8eef0` (L 0.945) under every pane; `--sheet` `#f6f9fa` (L 0.980) under the readout card, About and the route's casing | `--page` `#141d21` (L 0.224); `--sheet` `#1c272c` (L 0.265) |
| Data band (every data token) | L 0.400–0.625 | L 0.560–0.860 |
| Signature | the Block, `--ink` `#0f1c23` (L 0.218, C 0.0228), opaque | `--ink` `#e6edee` (L 0.941, C 0.0076), opaque |
| Worst measured case | ink on page 14.80; the lowest data token on a ground 3.04 (zone 0 on `--page`) | ink on page 14.43; the lowest 3.21 (series 4 on `--sheet`) |

The band sits below the grounds in the light theme and above them in the dark, and the ink keeps the
far end of the range in both (check 4: L 0.218 under 0.400; L 0.941 over 0.860). Every data token is
a mark at 3:1 or more on both grounds (check 2). The Block never sits over data, so its worst case is
the page. Ink drawn *over* data (the four-week and seven-day averages, the planned average, the
cursor, the route's start and finish) goes on a 4 px `--page` casing (2 px of ink over it): without
the casing ink over the closest data token would be 1.83:1 (light, series 8) and 1.23:1 (dark,
zone 3), which is why the casing is there (check 5).

### The data tokens

`--zone-0` to `--zone-5` and `--series-1` to `--series-8`, the names the code already uses, so every
`var(--…)` in `app.js` keeps working. Hue and chroma are the stock token's (chroma lowered only where
sRGB has none at the new lightness); lightness is fitted per theme.

| Token | Stock | Light | L | On page | Dark | L | On page |
| --- | --- | --- | --: | --: | --- | --: | --: |
| `--zone-0` (no zone) | `#d7dbe3` | `#81898e` | 0.625 | 3.04 | `#6e767a` | 0.560 | 3.69 |
| `--zone-1` | `#a3a8b2` | `#5f676b` | 0.508 | 4.92 | `#9ca5a9` | 0.716 | 6.82 |
| `--zone-2` (blue) | `#3b8fe4` | `#0061af` | 0.490 | 5.38 | `#66affe` | 0.740 | 7.44 |
| `--zone-3` (green) | `#52b043` | `#115702` | 0.399 | 7.50 | `#8dec7e` | 0.859 | 11.76 |
| `--zone-4` (orange) | `#f59a23` | `#965a01` | 0.524 | 4.77 | `#dc8602` | 0.695 | 6.07 |
| `--zone-5` (red) | `#e5443b` | `#d7352f` | 0.580 | 4.04 | `#e5443b` | 0.619 | 4.25 |
| `--series-1` (running; `--amount`) | `#2f6df6` | `#0541c8` | 0.445 | 6.90 | `#9cbeff` | 0.801 | 9.14 |
| `--series-2` (ride) | `#f0663a` | `#ca430e` | 0.569 | 4.15 | `#e1592c` | 0.635 | 4.62 |
| `--series-3` (strength) | `#17b07c` | `#007651` | 0.500 | 4.83 | `#36c18c` | 0.725 | 7.47 |
| `--series-4` (elliptical) | `#efa400` | `#b47b06` | 0.626 | 3.10 | `#9b6901` | 0.559 | 3.60 |
| `--series-5` (other) | `#e97ba8` | `#a33c6a` | 0.513 | 5.25 | `#e678a5` | 0.710 | 6.19 |
| `--series-6` (hike or walk) | `#7f62d6` | `#785bce` | 0.558 | 4.28 | `#9377ed` | 0.650 | 4.97 |
| `--series-7` | `#16a9bd` | `#0b8d9e` | 0.590 | 3.37 | `#0092a4` | 0.605 | 4.60 |
| `--series-8` | `#a06c3d` | `#6a3a02` | 0.400 | 8.08 | `#fdc493` | 0.860 | 10.99 |

`--amount` is a new alias, `var(--series-1)`: every chart of one quantity draws in it (weekly running
kilometers, runs per week, longest run, sleep, HRV, steps, floors, calories, the efficiency index, the
VO₂ max line, the weight line, blood oxygen, body battery, the ramp ratio). It replaces the stock
pane's habit of giving each single-quantity chart a hue of its own (floors amber, resting heart rate
pink, weight purple, oxygen cyan, calories brown), which encoded nothing. Where two quantities share
a chart they keep two tokens (stress `--series-2` over the body-battery band in `--amount`;
moderate and vigorous intensity minutes `--zone-3` and `--zone-4`).

**The categories** (check 3), every pair at least ΔE 0.10 apart (OKLab) under normal vision: the six
zones (closest light zone 0 and zone 1, 0.117; dark zone 1 and zone 2, 0.128), the eight series
(closest light series 3 and 7, 0.123; dark series 2 and 4, 0.136), and Garmin's ten training
statuses, each drawn in one of the tokens (Detraining `series-8`, Recovery `series-1`, Maintaining
`series-4`, Productive `zone-3`, Peaking `series-6`, Unproductive `zone-4`, Strained `series-5`,
Overreaching `zone-5`, Paused `zone-1`, No status `zone-0`; closest light Maintaining and
Unproductive, 0.105; dark Recovery and Paused, 0.124). Easy, moderate and hard (zones 2, 3, 4) are
0.195 apart at the closest (light). Under simulated color-vision deficiency some pairs come closer
(the script prints each): the hardest are zone 4 against zone 5 (protan, light, 0.034), the shoes'
series 3 against 5 (deutan, 0.030 light) and the statuses Detraining against Productive (deutan,
light, 0.010). So identity never rests on color alone (HOUSE 3.3): every legend names its categories
in words, the status strip's legend carries each status's day count, every readout names the zone,
sport, shoe or status in words, and the planned-session rows name their kind.

**How the steps were chosen, and what was given up, plainly.** The two zone grays keep Garmin's order
(no zone nearest the ground, Z1 a step further), so they part by lightness. Every other token's place
in the band was found by a search over a grid of twentieths (a throwaway script, 20 000 draws) for the
widest closest pair across the zones, the series and the statuses in both themes with every token at
3:1 on both grounds; the steps are in the script's `STEP`. They are not a salience order: Garmin's
zones are categories here, named in every legend, not a scale. **In the light theme Garmin's orange
zone prints as a burnt orange (`#965a01`) and its green as a forest green (`#115702`)**, because the
stock orange (L 0.762) and green (L 0.676) are too light to stand at 3:1 on the film-base page; in the
dark theme both stay close to Garmin's (`#dc8602`, `#8dec7e`). The stock series' pastels are darker in
the light theme for the same reason.

### The route ramp

The Sessions pane colors a route by pace, speed, cadence, power or elevation. The stock ramp ran cool
to warm through a pale middle (`#3b4cc0` … `#f2d5c4` … `#b2182b`): a diverging map on sequential data,
whose pale middle all but vanished on the white casing. Kept: cool for low, warm for high. Changed:
one path whose lightness runs one way (light theme L from 0.641 to 0.420, dark from 0.579 to 0.860: "more" stands
further from the casing in both), printed twice, every point at 3:1 or more on the route's `--sheet`
casing (lowest 3.14 light, 3.59 dark), the ends apart by ΔE 0.26 or more under normal, deutan, protan
and tritan vision, every eighth stepping by at least 0.045 (check 6). Nine stops per theme, from
`--json`, interpolated in sRGB by the app stay within ΔE 0.0084 of the OKLab path:

- light: `#4493d0 #5c80d5 #756bd0 #8d55bb #9f3e99 #a72c6d #a61d3c #9b1b0f #7f3203`
- dark: `#3080bc #5c81d5 #877fe6 #b57ce6 #de79d7 #fe7dba #fe99a2 #ffaea0 #ffc1a6`

The legend under the map is that ramp as a 6 px bar (0 radius, a 1 px `--line-strong` frame at 60 %)
with its two ends printed as values (section 3).

### Marks that are not data

- Thresholds a reader measures against (sleep `7 h`, intensity `150 min`, oxygen `95 %`, the step
  goal, the ramp ratio's `1.5`, the lactate threshold, the zone floors): 1 px `--ink-2`, dashed 3/3,
  their label in 10.5 px `--ink-2` at the line's right end. The ramp ratio's sustainable band (0.8 to
  1.3) is `--ink` at 7 % with its words in the legend. No green band, no red spike line (B14).
- Garmin's optimal-load band is data (Garmin's own range): `--amount` at 16 %, as the stock band was.
- The column charts' week and day marks (`now` on the time-in-zone or load chart, `today` on the day
  charts): a 1 px `--line-strong` rule dashed 3/3 over the plot's height, its word in 10.5 px `--ink-3`
  on a 3 px `--page` halo at the top; the race's mark a solid 1 px `--ink` rule, its name in `--ink-2`.
  Words anchor inside the chart (B9). The Block's rule holds here too: a word that would collide with
  the race's name loses its word and keeps its rule, and a rule that passes under another mark's word
  starts below its letters (the demo's `now` sits under `Copenhagen Half Marathon` on Plan).
- Hairlines behind a chart: `--line`; the baseline: `--line-strong`.
- The cursor on a chart (the column under the finger): `--ink` at 7 %; on a line chart a 1 px `--ink`
  rule at 50 % and a 7 px `--ink` disc with a 2 px `--page` ring.
- The route's start and finish: the start a 9 px `--ink` disc with a 2 px `--sheet` ring, the finish a
  12 px ring of 2 px `--ink` on `--sheet` (as today, in the house's tokens). The route line: 4 px of
  ramp color on a 7 px `--sheet` casing; the part outside the distance window 2.5 px `--ink-3` at 45 %.
- The map tiles keep their own colors in the light theme and the stock inversion in the dark
  (`invert(1) hue-rotate(180deg) brightness(.82) contrast(.92)`): the basemap printed as its negative,
  which the house allows for a picture with one appearance (HOUSE 3.2); it is not chrome.

---

## 3. The chrome, object by object

HOUSE 4.0's row for *panes from a pull*: panes as tabs; no key column; a caption band per pane
(legend, caption line, credits); no player (a pane may plot time on an axis); a readout card for a
tapped bar, hour or item; no focus mode. Every kind carries the header, About, notices and the live
region, the motion rules, landscape and safe areas.

### The frame

Now, at 390 × 844 (heights in CSS px; safe-area insets outside them):

```
┌──────────────────────────────────────────┐
│ Running Dashboard                        │ 22  the name, 15/650
│ Updated 30 Sep, 20:20, last session 30 Sep│ 16  the stamp, 11.5, --ink-2 (opens About)
│ Now  Plan  Training  Health  Sessions    │ 44  the panes as tabs; the tracer under the chosen
├──────────────────────────────────────────┤ ── the pane scrolls from here down, inside the frame
│            now        Copenhagen Half …, 1 Nov│ 14 labels over the Block
│ ▇ ▇ ▇ ▇ ▇ ▇ ▅ ▇ █ █ ▆ ▄  ┌┐ ┌┐ ┌┐ ┌┐      │ 64  the Block: ink cut into runs, then outlines
│ Jul 2026     Aug       Sep          Oct  │ 14
│ Weeks of running to Copenhagen Half …    │ 15  its caption, 11 px
│ This week, 28 Sep to 4 Oct       24.0 km │ 28  the one large figure 21/600; the lead at its left
│                         of 62 km planned │
│ On track. Eleven weeks in, the block is … │     the verdict in --ink 620, the headline in prose
│ What to do next: Sharpen this week, …    │
│ [Open the plan]                          │ 44  a framed text key
│ Run, last 7 days         44.7 km, 4 runs │     the facts as label: value rows
│ …                                        │
├──────────────────────────────────────────┤ ── fixed: the caption band
│ Pulled 30 Sep, 20:20. Evaluation and plan │ 30  the pane's caption line, two fixed lines
│ written 30 Sep.                          │
│ Data: Garmin Connect. Coaching text: …   │ 15  the credits, word for word
└──────────────────────────────────────────┘
```

- **The frame.** `body` is a column of three: the header, the pane (`<main>`, `flex: 1 1 auto;
  min-height: 0; overflow-y: auto; overscroll-behavior: contain`) and the caption band; the page is
  `100dvh` and never scrolls itself (HOUSE 4.1: *a pane app scrolls its pane's content inside the
  frame, so the header and the caption band stay put*). The sticky, frosted `.topbar` goes. Every
  `window.scrollTo` and `window.scrollY` in `app.js` (the pane switch, the same-pane re-render that
  keeps the reader's place, the session pick) moves to the pane's own `scrollTop`. Content is one
  column, at most 760 px wide, centered on wide screens; gutters 16 px plus the safe-area inset,
  20 px from 700 px of width. No rule under the header; the caption band has a 1 px `--line` rule on
  top. The page never scrolls sideways at 320 px or at 125 % text zoom.
- **The header.** The name, `<h1 translate="no">Running Dashboard</h1>`, 15 px, 650, 22 px line (the
  stock 21 px 660 with negative tracking goes). **The stamp** under it, a `<button>` (today a `<p
  role="button">` that a keyboard cannot reach: B6), `aria-haspopup="dialog"`, described as *Opens
  About this data.*, its hit 44 px tall running up over the name, which is not a control, and down into the gap above the
  tabs (22 + 16 + 6 px; running 28 px down would have landed on the tabs, which take the tap): `Updated
  20:20, last session 30 Sep` today, `Updated 30 Sep, 20:20, last session 30 Sep` on another day
  (`pulledAt` when the snapshot has it, else `generatedAt`; the clock built by hand in `js/units.js`,
  24-hour, day before month, the same on every locale). **Stale** when the snapshot is more than
  48 hours old (the threshold `NOTES.md` already states as two days): the stamp leads with
  `Stale.` in `--ink` and the rest stays `--ink-2`: `Stale. Updated 28 Sep, 07:00, last session
  27 Sep`. The stock stamp said stale only by turning orange (B1). The watch-sync time and the rest of
  the stamp's tap-to-expand line go to About (`This data`); the ▴ ▾ chevrons go. While loading:
  `Reading the data…`. **No units key** in this pass (owner call 1, `tools/DECISIONS.md`): everything is SI, and the cost of a
  US switch is stated there.
- **The row of tabs: the panes.** `Now`, `Plan`, `Training`, `Health`, `Sessions`, each a `<button
  role="tab" aria-selected>` in a `role="tablist"` named `Panes`, 12.5 px, 400 `--ink-2`, the chosen
  620 `--ink` with the house tracer under it (a 2 px line as wide as the word plus 4 px, transparent to
  `--ink`, ending in a 4 px disc; drawn in over 160 ms on `--draw` by `clip-path`), each a 44 px-tall
  hit, 16 px apart, the row scrolling inside itself if it must. **They stay built by `buildTabs()`
  after the snapshot parses**, never moved into the static markup: the marketing camera waits for the
  button `Health` as its proof that the data loaded (`MarketingShotsUITests.swift` lines 289-292).
- **The pane's own controls** (Training, Health, Sessions): the first rows of the pane, scrolling with
  it, so the frame's fixed bands stay three:
  - *The window*: `3 months`, `6 months`, `1 year`, `All` as words (the stock `3 m`, `6 m`, `1 yr` were
    abbreviations), `role="radio"` in a `role="radiogroup"` named `Time window`, 12.5 px, the tracer
    under the chosen, 44 px hits; at the row's right, the window in words, `12 Jan to 4 Oct 2026`
    (12.5 px, `--ink`, the two-digit years `12 Jan 26` go: B10).
  - *The window's track*: the two native range inputs kept (they are accessible for free), restyled in
    the house's slider language: a 1 px `--line-strong` baseline, the chosen window in 2 px `--ink`,
    each thumb a tracer head (an 8 px `--ink` disc with a 3 px `--page` ring and a 1.5 × 18 px `--ink`
    rule through it, 10 px while pressed), the input 44 px tall so the thumb's hit is 44 × 44; no
    accent, no shadow. Names unchanged (`Start of window`, `End of window`).
  - *Sport and equipment*: the native `<select>`s kept, set as word keys: 12.5 px `--ink` at 560 in a
    1 px `--line-strong` frame, 6 px radius, 44 px tall, no chevron glyph and no fill (the stock
    `data:` SVG chevron goes). Names unchanged (`Activity type`, `Equipment`).
- **Sections, not cards.** Each chart is a section on `--page`: a 1 px `--line` rule above it (none
  above the first), 16 px padding top; its heading `<h2>` at 13.5 px 650 sentence case; a pane's group
  heading (`Running`, `Load`, `Heart` on Training; `Today`, `Recovery and trends` on Health) at 15 px
  650, sentence case, never uppercase or tracked (B12). No `.card` background, radius or shadow; the
  stock `.hero` and its gradient go; `main > .tiles` loses its card.
- **Under each chart**, in this order: the legend; the caption line (11 px, 15 px line, `--ink-2`,
  what one bar or point is, in the data's words); `How to read it` and `Show the table` as text keys
  (12.5 px `--ink-2`, 44 px tall, sentence case). `How to read it` is a `<details>` whose `<summary>`
  is those words; its body is the stock help text at 13.5 px, line height 1.5, `--ink-2`, at most
  62 characters wide. The ⓘ button (an italic `i` set in Georgia: a second face, B5) and its
  `help`/`ensureInfo` machinery go. `Show the table` and `Hide the table` replace `Table view` and
  `Hide table`.
- **The legend** of a chart: swatches 8 × 8 px, square (the legend bar's 0 radius), a line series
  16 × 2 px, labels 10.5 px `--ink-2`, 12 px apart; the route ramp's legend is the bar described in
  section 2 with its ends printed (`slower ≥ 6:12 /km`, `faster ≤ 4:05 /km` for pace; `≤ 158`,
  `≥ 181 spm` for cadence: the ends are this session's 5th and 95th percentiles, printed open because
  the colors clip there).
- **Charts.** Every axis and tick label 10.5 px (the stock 9.5 and 9 px are off the scale), `--ink-2`;
  the unit caption above the plot 10.5 px `--ink-2` at 400 (the stock 9.5 px 560 with letter-spacing
  goes); bars square-topped (the stock 4 px rounded tops go); ticks and numbers through `js/units.js`.
  Planned bars, wherever they are (the day charts, the load chart, the plan's zone bars), are drawn in
  outline: each segment a 1.5 px stroke of its token, inset, no fill, 1 px gaps between segments, a
  segment under 3 px drawn as a 1.5 px line (the stock "faint" fills at 38 % and the 45 % mini bars go).
  The planned four-week average is `--ink` dashed 5/4 on its casing, the actual one solid.
- **The facts** (the stock tiles: four on Now, four on Today, six on Health, up to fourteen in a
  session, the race day, distance and goal on Plan, the assessment's metrics): a `<dl>` of rows, each
  a label at 12.5 px `--ink-2` at the left and the value at 12.5 px `--ink` 560 right-aligned, with the
  note after the value in `--ink-2` (`Run, last 28 days`, then `235.6 km`, then `1 % more than the 28
  days before, 0.4 km walked`, as three cells of one row, wrapping under on a narrow screen), rows parted by
  1 px `--line` hairlines; two columns of rows from 560 px. The 28 px numbers, the uppercase tracked
  labels and the hairline grid go (tells 5 and 14). A label is the quantity in words, never above the
  value.
- **The one large figure** (at most one per pane, 21 px, 600, tabular): Now, this week's running
  kilometers (`24.0 km`, the lead `of 62 km planned` in 12.5 px `--ink-2`, and the week in words at the
  left, `This week, 28 Sep to 4 Oct`); Plan, the days to the race (`30 days`, the lead `to Copenhagen
  Half Marathon, 1 Nov, 09:30`); Sessions, the chosen session's distance, or its time when it has none
  (`11.2 km`, the lead `56 min, 4:54 /km`). Training and Health have none: their charts are the
  subject. The readout card's value is the screen's figure while the card is open.
- **The verdict and the plan's headline**: no pill, no gradient, no 21 px headline. The tone is a word
  (`On track.`, `Watch.`, `Act now.`, `Stop.`, `Note.` from the stock `toneWord`) at 13.5 px, 620,
  `--ink`, leading the data's headline set as prose at 13.5 px, line height 1.5, `--ink`. The same for
  the plan's tone, a section's tone in the evaluation folds, and a session note's tone. Color carried
  the tone before (green, amber, orange, red): now the word does.
- **The race predictions table**: 12.5 px, tabular; headers 11.5 px 600 `--ink-2` in sentence case
  (`Distance`, `Garmin`, `Agent`, `Difference`; the uppercase tracked headers and the `Δ` column head,
  a character the face does not draw, go); the difference in `--ink` with its sign (`+0:15`, `−0:20`),
  no amber for slower and green for faster (B14).
- **The sessions list**: rows on `--page`, at least 52 px tall, separated by `--line` hairlines; the
  chosen row on the on-plate; the date in 12.5 px `--ink-2` (`Wed 30 Sep`, the year under it only when
  it is not this year), the name 13.5 px `--ink` 600, under it `Run, 56 min, 157 bpm` in 12.5 px
  `--ink-2`, at the right the distance 12.5 px 560 with the training effect's word under it. The sport
  swatch (8 px square in its token) stays before the name; the word after it carries the sport. The
  inner scroller (the stock `max-height: 46vh`) stays.
- **The plan's week rows**: the day, the session's words at 13.5 px 600, the kind as a word in 11 px
  `--ink-2` (sentence case; `done` and `missed` in `--ink`), the stats in 12.5 px `--ink-2`, the kind's
  8 px dot in its token. A missed row is no longer drawn at 55 % opacity (its text fell under 4.5:1):
  it says `missed` in `--ink`. Planned zone bars in outline.
- **The readout card** (HOUSE 4.7; the stock `.tip`, an inverted dark bubble with a shadow, goes). The
  one card on the screen: `--sheet`, a 1 px `--line-strong` edge, an 8 px radius, no shadow, at most
  280 px wide, 10 px padding. It sits inside the chart's box, top-left, inset 8 px; when the tapped
  column or point is under it, it moves to the top-right; when the chart is shorter than the card (the
  Block on Now, the status strip, a mini spark line) it hangs from the chart's foot over what follows,
  never off the screen. Its first line, 12.5 px `--ink-2`, is the place (`Week of 14 Sep 2026`,
  `Wed 30 Sep 2026`, `Lap 4, work`, `12:34 into the session, 3.1 km`), with ✕ at its right: an SVG,
  a 44 × 44 hit, named `Close`. Then the value, 21 px 600, its unit at 13.5 px `--ink-2` after U+202F.
  Then a `<dl>` of rows at 12.5 px: labels `--ink-2` left, values `--ink` 560 right. The stock tip
  functions return HTML strings; they become functions returning `{ place, value, unit, rows:
  [[label, value]…] }`, and one `showCard(wrap, card)` writes them as text nodes, **updated in place**
  while a finger drags (never rebuilt per move), which also removes most of the app's markup-from-string
  (check 13). Behavior kept: a tap pins it, a drag scrubs it, a tap elsewhere or ✕ closes it, a mouse
  hover shows it when nothing is pinned. In: 120 ms opacity and a 4 px rise on `--draw`; out: at once.
  A tap announces it once through the live region, in words (`spoken()`, below).
- **The route map** (Sessions): the map is a plate of its own, 8 px radius only where it meets the
  page, no fill behind the tiles but `--sheet`. Its modes (`Heart-rate zone`, `Pace`, `Speed`,
  `Cadence`, `Power`, `Elevation`; the stock `HR zone` is spelled out) are words with the tracer. The
  tile credit leaves the map (the stock `.attr` badge on a translucent fill) for the map section's
  caption line, word for word from `TILE_CREDIT` (`USGS The National Map`, `© Kartverket`, `©
  OpenStreetMap contributors`), after the sentence that says how the route is colored, and, under a
  route drawn from the template's own courses, `Route: © OpenStreetMap contributors, ODbL.` The distance
  window's two thumbs take the house slider language (as the pane window's); the elevation profile
  draws the window as an `--amount` area at 16 % under a line in the route's own colors, as the map
  draws it, with the rest in `--ink-3` at 60 %; its marker the house cursor disc.
  The range label: `Whole session, 11.2 km, up 65 m, down 65 m` (the stock `↑ 65 m ↓ 65 m` arrows go).
- **Chips become words.** Every `.chips` row (the load unit `Zone time`, `Aerobic`, `Muscle`, `Sport
  time`; `Share of time`, `Minutes`; `Color by stroller`, `Color by shoe`; `By time`, `By distance`;
  `Pace by heart-rate zone`; `Every sample`, `Smoothed`; the map modes) is a row of words: 12.5 px,
  400 `--ink-2`, the chosen 620 `--ink` with the tracer under it, `role="radio"` in a named
  `role="radiogroup"` (the one on/off word, `Pace by heart-rate zone`, an `aria-pressed` button), 44 px
  hits, 16 px apart, scrolling inside itself on a narrow screen. The tinted accent chip goes.
- **Text keys** (`Open the plan`, `Open in Sessions`, `Show the table`): 12.5 px `--ink`, 44 px tall, a
  1 px `--line-strong` frame, 6 px radius, no fill; pressed, `currentColor` at 22 %; hover only under
  `@media (hover: hover)`, at 7 %. No `transform` on `:active` (the stock 1 px drop goes).
- **Disclosures** (the evaluation's sections, `About this plan`'s folds, `Why the numbers differ`, a
  session row): the `<summary>` at 13.5 px 600 `--ink` (the stock accent-blue summary goes), a 1.5 px
  drawn chevron (the stock rotated border) that turns at once, no transition.
- **The caption band** (fixed, at the foot; HOUSE 4.5, *a pane app: the band closes each pane*): on
  `--page`, a 1 px `--line` rule on top, 16 px gutters plus the safe area, padding-bottom the bottom
  inset. Two things: **the pane's caption line**, 11 px, 15 px line, `--ink-2`, **fixed at two lines**
  whatever it says, saying what the pane is showing: Now `Pulled 30 Sep, 20:20. Evaluation and plan
  written 30 Sep.`; Plan `The plan the coaching routine wrote on 30 Sep, to Copenhagen Half Marathon
  on 1 Nov.`; Training `Weeks of 12 Jan to 4 Oct 2026, all sports, any equipment.` and Health `Weeks of 12 Jan
  to 4 Oct 2026. Today is the last 24 hours the watch handed over.` (Health has no sport or equipment
  filter) (the
  window and the filters in words, so the scope is on screen while the controls have scrolled away);
  Sessions `248 sessions in the window, newest first.` Then **the credits**, 10.5 px `--ink-2`, one
  constant, on screen on every pane: `Data: Garmin Connect. Coaching text: the coaching routine.` The
  stock footer's paragraph (run/walk detection, Edwards TRIMP, Garmin's load) moves to About, and its
  stale `Load pane` (a pane that no longer exists: B8) goes with the move.
- **The player: none.** No time to scrub. The session curves, the 24-hour charts and the route keep
  their drag-to-read readout.
- **About** (section below), opened from the stamp.
- **Notices and the live region.** A problem with the data is a sentence on a `--sheet` plate, a 1 px
  `--line-strong` edge, 8 px radius, 13.5 px `--ink`, at most 300 px wide, centered in the pane, no
  icon, no colored frame (the stock red inset frame and red heading go), `role="alert"`. It says what
  is wrong in the file's terms: `data/snapshot.json could not be read (HTTP 404).`, `data/snapshot.json
  is not valid JSON; it looks like a web page was written over it.`, `data/snapshot.json is not the
  shape this app expects:` with the validator's lines under it at 12.5 px `--ink-2`, then `The file
  begins:` and its first 240 characters in the house face (the stock monospace `<code>` goes: B4), then
  the stock hint sentences (the dead token, the Shortcut). **A broken replacement keeps the data that
  was showing**: when `visibilitychange` reloads and the new file fails, the pane, its scroll and its
  card stay, and the notice says `The new data/snapshot.json is not valid JSON. Still showing the data
  pulled 30 Sep, 20:20.` (today `fail()` empties the pane and hides the tabs: B3). One polite live
  region, `<p class="sr" aria-live="polite">`, for sentences: a readout's words, a refused press, a
  pane's name when a tab is chosen by keyboard. `<main>` is no longer a live region (today it is, so
  VoiceOver reads a whole pane on every chip or filter: B2).
- **Focus mode: none** (HOUSE 4.0). The panes are reading, not a view.
- **The opening: none.** The stock entrance (each section rising 8 px and fading in over 380 ms,
  staggered, on every pane change) goes (tell 15).
- **Landscape** (`(orientation: landscape) and (max-height: 500px)`): the header is one 46 px row, the
  name over the stamp at the left and the tabs at the right; the caption band one line of caption and
  the credits beside it; the pane scrolls between them.
- **Safe areas**: the header `6 px + top` and `16 px + left/right`; the pane's content `16 px +
  left/right`; the caption band `16 px + left/right` and `bottom`; the readout card stays inside the
  chart; About's head `top`, its body `16 px + bottom`.

### Spoken forms

VoiceOver hears words, not symbols. `js/units.js` gains `spoken(text)`, which expands the app's own
unit and date forms in a card's text before it reaches the live region: `km` kilometers, `/km` per
kilometer, `km/h` kilometers an hour, `bpm` beats a minute, `spm` steps a minute, `min` minutes, `h`
hours, `m` meters, `ms` milliseconds, `kJ/kg` kilojoules per kilogram, `W` watts, `kg` kilograms, `%`
percent, `°C` degrees Celsius, `22 Sep` 22 September, U+2212 minus, U+202F a space. The sentence is
the card's place, value and rows joined with periods.

### About

A full-height `--sheet` panel that slides up over 220 ms on `--sheet-in` and closes at once:
`role="dialog"`, `aria-modal="true"`, labeled by its title `About Running Dashboard` (15 px, 650);
`Close` at the top right and again at the foot; Escape closes it; Tab is held inside; focus returns to
the stamp; `overscroll-behavior: contain`. Sections at 13.5 px 650 sentence case separated by 1 px
`--line` rules; prose 13.5 px, line height 1.5, at most 62 characters wide. The words, for the
builder to set as they are (values from the data where braced):

1. **What the Block is.** *The strip at the top of Now and Plan is the training block as a coach
   draws it: one column a week, from twelve weeks back to the race. Each block of ink is one run's
   running, walk breaks left out, so a week of six runs is six pieces. An outline is the week the plan
   asks for, as the coaching routine wrote it on {plan.updated}; when the plan gives a range, the
   outline runs to its top and a tick marks its bottom. This week is both: its runs fill its outline
   from the bottom. Past weeks have no outline because the data keeps only today's plan, not the plans
   that came before it. The scale is fixed: 0.8 pixels a kilometer on Now, 1.2 on Plan, with a line
   every 20 kilometers. Weeks run Monday to Sunday by the phone's calendar. Other sports are not in it;
   they are on Training.*
2. **This data.** `label: value` lines, no middle dots: `Pulled: 30 Sep 2026, 20:20 (UTC+2)`,
   `Snapshot built: …`, `Watch last synced: …` (the newest intraday sample), `Sessions: 248, 12 Jan to
   30 Sep 2026`, `Full detail kept since: 31 Mar 2026`, `Evaluation written: 30 Sep 2026`, `Plan
   written: 30 Sep 2026`, `Race forecast written: 30 Sep 2026`, `Map tiles on this phone: 30`, `Stale
   after: 48 hours`.
3. **How the numbers are made.** The stock footer's paragraph, rewritten in US English and without
   naming a pane that is gone; then one short paragraph each: running against walking (the watch's
   run/walk detection), zone load (Edwards' TRIMP, minutes in zones 1 to 5 weighted 1 to 5), muscle
   load (the method `app.js`'s `MUSCLE` comment states, its two judgement calls named), kilometers by
   zone (the record stream when present, else laps, else time in zone), the ramp ratio, the efficiency
   index, and the route's colors: *A route is colored between its own 5th and 95th percentile of the
   quantity chosen, so the colors compare stretches of this session with each other, never one session
   with another; the legend prints the two ends.* (A stated display choice: owner call 3.)
4. **Sources and credits.** Garmin Connect's data, the user's own account, through the pull (`NOTES.md`
   says how); each map's tile source and its terms in a sentence (Kartverket CC BY 4.0, USGS public
   domain with its requested acknowledgment word for word from `TILES.md`, OpenStreetMap's credit);
   any address printed without its scheme; where the snapshot's sessions follow the template's own
   courses (ids `demo-…`, the generator's rule), `Routes: © OpenStreetMap contributors, under the Open
   Database License 1.0 (opendatacommons.org/licenses/odbl/1-0); the route shapes in these sessions
   are derived from it.` (the lead's ruling on owner call 4: a license requirement; the word demo never
   appears on screen); then `Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open
   Font License 1.1; a subset is in fonts/ with its license.`
5. **How the data gets here.** The pull in GitHub Actions, the Shortcut that carries the snapshot in,
   the coaching routine that writes the evaluation, the plan, the race forecast and the session notes;
   that the app itself reaches no network.

---

## 4. Type

- **The house face, byte for byte**: `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
  `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
  sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copied from
  `global-weather/fonts/` with `cp`, never rebuilt or renamed. The one `@font-face` rule word for word
  (HOUSE 2.5), `font-display: block`, the family used only through `--face`.
- **Removed**: `fonts/Geist.woff2` (69 760 B), `fonts/LICENSE-Geist.txt` (4 368 B), the Geist
  `@font-face` and font stack, the Georgia italic of the ⓘ key, the monospace stack of the notice
  (`ui-monospace, SFMono-Regular, Menlo, monospace`), and Geist's paragraph in `TILES.md` (the file's
  title and opening sentence become *two parts*: the tiles and the routes). The root `README.md` names
  Geist in its licenses line (line 495) and is the lead's to change.
- **One supplement, for ₂ alone** (HOUSE 2.3, the lead's D5 ruling 5 allowed ₂ ≈ • for this app):
  `VO₂ max` (the Now facts, the VO₂ max chart's title and axis, the training-effect word, a table head)
  and `SpO₂` (the oxygen chart's axis) need U+2082, which the house cut lacks and the upstream draws.
  `≈` is not needed: every `≈` the app writes is in a sentence or a tooltip and becomes `about` (`goal
  about 8 100`, `about 62 load`). The file: `fonts/ysabeau-office-running-dashboard-extra.woff2`,
  **1 216 B, sha256 `f9937497336f4bf70c2728bc020588ebdb2a952acdf7dc5e96f14b8377583268`**, built twice
  byte-identically on 2026-10-02 (`cmp` silent) by Milky Way's recipe with only the code points
  changed: `tools/art/font_extra.py` is `milky-way/tools/art/font_extra.py` with `UNICODES =
  'U+2082'` and `OUT = 'fonts/ysabeau-office-running-dashboard-extra.woff2'` and its docstring
  rewritten for this app; run from `Template/` in a venv with fonttools 4.60.2 and Brotli (`python
  running-dashboard/tools/art/font_extra.py`); it reads the pinned upstream from
  `global-weather/tools/.work/font/` when it is there (sha256 `0f305c84…5d360`, 401 964 B, google/fonts
  commit `9710da1eacb3be272583c3224dcb70f9da6eadbb`). Declared as a second rule of the same family:
  `@font-face { font-family: 'Ysabeau Office'; src: url(fonts/ysabeau-office-running-dashboard-extra.woff2)
  format('woff2'); font-weight: 400 650; font-display: block; unicode-range: U+2082; }`. `OFL.txt`
  covers both files and stays byte-identical; `NOTES.md` records the supplement's code point, command
  and sha256; `check.mjs` pins it.
- **Characters the app writes that the cut lacks, and what replaces each** (*measured*: fontTools on
  the shipped cut against `app.js`): `▴` `▾` (the stamp's chevrons: gone), `ⓘ` (a comment; the key
  goes), `Δ` (the race table's head: `Difference`), `↑` `↓` (the route's climb: `up`,
  `down`), the right arrow (a comment: the house writes none, `check.mjs` fails on it), `≈` (six
  in strings, three in comments: `about`). The data's strings use `—`, `–` and `×` only (all in the cut).
- **The scale** (HOUSE 2.5): 10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 / 21 px, weights 400, 560, 600, 620,
  650; nothing larger than 21 px (the stock 28 px tile figures, 21 px headlines, 17.5 px plan heads and
  16 px race table go); no capitals, no letter-spacing (the stock negative tracking on headings and the
  positive tracking on every uppercase label go); sentence case for every label and button. Body text
  13.5 px / 1.35; the stock 15 px / 1.5 body goes. `font-variant-numeric: tabular-nums lining-nums` on
  `body`. SVG text inherits the face from the page; there is no canvas text.
- **The credit line** word for word in About (prefixed `Type: `), in `NOTES.md` and in `TILES.md`.

---

## 5. The camera's strings

HOUSE 7.4's row for this app: the camera waits for **a button named `Health`** (the panes are built
after the data parses) and taps **the panes `Now` and `Health`, as buttons by name**
(`MarketingShotsUITests.swift` lines 288-299 and 327-332; `MarketingClipsUITests.swift` lines 241-242;
`selectPane` in `MarketingCameraCase.swift` lines 196-200).

| String | Role | Kept? |
| --- | --- | --- |
| `Health` | `<button role="tab">`, built by `buildTabs()` after the parse | kept, text and role and timing |
| `Now` | `<button role="tab">` | kept |

**The camera needs no change.** Two things the builder must not break: the tabs stay out of the
static markup until the snapshot has parsed (the wait is the camera's proof of data), and the loop
clip's slow drag from 75 % to 35 % of the web view's height on Now (`MarketingClipsUITests.swift`
lines 244-247) must scroll the pane: at 844 px the drag starts at 633 px, inside the pane's scroller
and above the caption band (about 64 px tall plus the bottom inset), so the pane, not the page,
scrolls. The app remembers its pane (`running-dashboard.ui.v3`); the camera selects `Now` first, so
nothing has to be put back. No string is British; no remembered focus mode exists.

---

## 6. Budget

*Measured* 2026-10-02 on the working tree before the pass: the ZIP by `build-zips.yml`'s own command,
`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*'
'raw/*'`, then `wc -c`; code by `wc -c` on every shipped `.html`, `.css` and `.js` outside `data/`.

| | Today | Cap | Rule |
| --- | --: | --: | --- |
| App code | 236 521 (`app.js` 203 882, `style.css` 30 622, `index.html` 2 017) | **244 000, the lead's ruling (2026-10-02, plan 0011 D23)** | held at 236 521 B (over the house's 200 000, D5 ruling 2) until the build had measured 241 335 B with nothing cut or minified; ruled 244 000 on that figure, about 2 700 B for the fix stages; the reasons are in `tools/DECISIONS.md` |
| Fonts | 74 128 (Geist 69 760 and its license 4 368) | 160 000 | after the pass 41 291: the house's 40 075 and the supplement's 1 216 |
| ZIP | 1 072 155 (62 entries) | **1 340 193** | today × 1.25, rounded down; no face allowance, since the house face replaces Geist |
| Data | 37 files, sha256 of the concatenation in sorted path order `37973fe9069081a8814e4621069ba84fa03820ac0efc6fa73406c6d04ecf180e`; `data/snapshot.json` `7c6084b9b216232ddd56def183fdf9b16301d1b5879e04c0ee8a0ef092eb849d` | byte-identical | `check.mjs` pins every file's own sha256, recorded before the pass |

**The plan for the code.** The house costs, estimated by scaling the passes before this one (an
estimate, not a measurement: Shelf Atlas's 171 000 became 183 795): `js/units.js` with `spoken()` about
+5 500; the Block in `js/block.js` about +4 500; the readout card and its cards-as-objects about +3 000
net of the tip strings it replaces; About's markup and prose about +6 500 in `index.html`;
`js/palette.js` about +700; notices that keep the data and the live region about +1 000; the chips,
facts and verdict rewrites about neutral. It pays with: the stock stylesheet rewritten to the house's
(Global Weather's whole house stylesheet is 18 348 B; this one needs more, for sections, facts, tables,
the window controls and the map: about 21 000, so about −9 600); the dead diverging mode in
`columnChart` and its `--div-*` tokens, `.kv` and `.swhy` (nothing calls them: about −1 600); the
info key's machinery, the stamp's chevrons, the tile kit, the pills, the entrance animation and
`rampColor` (about −2 500). **Net: about +7 500, so about 244 000 against the held 236 521**, some
3 % over. Following the precedent of Milky Way (D9), Besseggen (D11), World Oil & Gas (D17) and Snug
Kart (D20): **the builder applies the whole list, cuts nothing on its own, never minifies or strips
comments, and measures; the lead rules on the measured figure** (owner call 2 in `tools/DECISIONS.md` lists what could be cut
instead, with its size). `tools/check.mjs` holds `CODE_CAP = 236521` until the lead rules. **The lead's rulings (2026-10-02):** the interim one (plan 0011 D22) held the cap at 236 521 B until the
build had measured, nothing cut; the build measured **241 335 B** (+2.0 %) with nothing cut or minified,
and **the lead ruled the cap at 244 000 B** (D23) — the stock's own files shrank by 8 428 B and the three
house modules added 13 242 B, the smallest growth of any pass after Snug Kart's, and the raise leaves
about 2 700 B for the fix stages. `check.mjs` enforces 244 000. **As built** (`node tools/check.mjs`,
2026-10-02): 241 335 B with nothing cut, minified or stripped (`app.js` 199 984, `style.css` 20 805,
`index.html` 7 304, `js/block.js` 6 857, `js/units.js` 5 956, `js/palette.js` 429), 4 814 B (2.0 %) over
the held figure and under the estimate. **After QA** (the column charts' marks take the Block's
collision rule, above): **241 754 B** (`app.js` 200 403, +419), 2 246 B under the cap; fonts 41 291 B;
the ZIP about 1 073 700 B of 1 340 193 (this file ships inside it, so its own figure moves the last digits). Two more rulings in
`tools/DECISIONS.md`: the routes' OpenStreetMap credit goes on screen (a license requirement, not a
taste call), and the demo text's British spellings are a data follow-up after the pass.

---

## 7. The generated-page tells, answered

| Tell | Here before | Here after |
| --- | --- | --- |
| 1. A warm cream ground, a serif display, a terracotta accent | a cool gray ground, Geist, a blue accent | the film base `#e8eef0`; one Renaissance sans; no accent: warm hues are zones, sports and the route's ramp only |
| 2. A near-black ground with one acid accent | dark `#0b0e13` with the blue accent | the slate print `#141d21`; no accent; the bright thing is the Block's ink |
| 3. Broadsheet hairlines, zero radius, dense columns | not this; card soup | one column, hairlines between sections only, radii by role (6, 8, 4, 0) |
| 4. The SaaS-card kit | every chart in an 18 px-radius white card with a soft shadow, the verdict in a gradient-washed card | no card but the readout and About; sections between hairlines; no shadow; no gradient but the route's legend |
| 5. ALL-CAPS tracked eyebrow labels | every tile label, every pill, the group heads, the race table and the data tables' heads | none: sentence case, `letter-spacing` 0, no label above a value |
| 6. Meta strings joined with middle dots | 78 middle dots in `app.js` (stats lines, tooltips, the stamp, the map credits) | commas and sentences; the credits constant has none |
| 7. "WORD — fragment" with a spaced em dash | 69 `—` in `app.js` (`1.5 — spike`, `Road shoes A — 691 km`, help texts) | none written by the app (`1.5, a spike`, `Road shoes A, 691 km`); the coaching text's own dashes are data and stay |
| 8. A tinted near-black standing in for black | `#0b0e13`, `#0f1420` | ink `#0f1c23` used as ink; the dark page a slate at L 0.224 |
| 9. A monospace face for small data labels | the notice's `<code>` | none; the house face's figures are tabular |
| 10. An arrow appended to links and buttons | none on screen, one in a comment | none anywhere; `check.mjs` fails on it |
| 11. One word accented in a headline | none | none; the tone word leads the headline in weight, not color |
| 12. Unnecessary labels above content | uppercase labels over every tile number; `RUNNING`, `LOAD`, `HEART` over groups | labels beside values in rows; group heads are headings, in sentence case |
| 13. Numbered markers | none | none |
| 14. A big number, a small label and a gradient accent | 28 px tile figures under small caps labels, a gradient behind the verdict | at most one 21 px figure per pane, the subject's own; no gradient |
| 15. Fade-and-slide entrances, hover on every card | a staggered rise on every pane change; hover fills on chips and rows | no entrance; the card's 120 ms fade answers a touch; hover only on controls, only under `(hover: hover)` |

The web interface guidelines apply as written but for the house's own rules (HOUSE 9): sentence case,
dates by hand rather than `Intl`, `font-display: block` for the local face, `translate="no"` on the
app's name and on Garmin's status words as the data gives them.

---

## 8. Where the record is

The pass's working record is `tools/DECISIONS.md`, which does not ship: the lead's rulings, the change
list (B1 to B17 among it) and the owner calls as the art direction left them, moved there word for
word, the as-built departures from this file with their reasons, and the phone checks this app needs.
````

---

## After the final review (2026-10-02)

The final reviewer (pass `wf_6a094cf0-b55`) found no must and left six shoulds: the route map's card
covering the tapped point; `judgement` on screen; pre-fix figures in `ART.md`; the demo's `Body battery
change +66` (the data follow-up's); the color-vision departure (an owner call); and the two declines
waiting on a cap raise (folds across a new file, the ramp's minimum span). The lead raised the code cap
to 245 000 B for three of them (plan 0011 D24, above). This is the follow-up's record, from
`Template/running-dashboard/` unless it says otherwise. Every probe named here is a throwaway script in
`tools/.work/followup/` (gitignored): headless Chromium at 390 × 844, DPR 2, touch through CDP, so it shows
what the page draws, never how a phone behaves.

### What was done, in the lead's order

1. **The readout card never covers what was tapped (should 1, HOUSE 4.7). Applied; 248 B** (`app.js`
   +224, `style.css` +24). `showCard()` tries the corners in order and takes the first that keeps 12 px
   clear of the point, or of the column for a chart that passes no y: top-left, top-right, bottom-left.
   Where none does, the card hangs from the chart's foot, or over the chart's head when the pane has no
   room below; it hangs too when the chart is shorter than the card, as before. "None does" means a
   column under both top corners (a column runs the plot's height, so inside the chart only a sideways
   move clears it), or a point near the middle of a plate less than about twice the card's height. The
   route's plate now clips its tiles rather than itself (`overflow: hidden` moved from `.mapwrap` to
   `.mapwrap .tiles`, with `border-radius: inherit`), so its card can hang below it too.
   - **Why more than D24's 60 B.** The bottom placement alone clears session 2's route (20 of 20 points),
     but not Training's first chart. That chart is 358 × 200 and its card is 176 to 177 px wide and 126
     to 144 px tall, so a column where both top corners hold it (x 162 to 196) sits under the
     bottom-left card too, finger and bar top both (`cover.mjs`, taps at 20, 55 and 85 % of the chart's
     height). Only a card outside the chart clears it. The same holds on routes whose map is shorter
     than about twice the card (the long run of 27 Sep: 358 × 212, the card 162 px tall) and on the
     scatter (230 px tall). Hanging needed the map to stop clipping its card (+24 B), and a room check (one
     line) so that a hung card is never cut off at the foot of the pane.
   - **Measured, before → after** (`cover.mjs`, light): Training's first chart, 15 taps at 55 % of its
     height, 1 → 0 with the finger or the bar top under the card (the same at 20 and 85 %); the scatter
     (Heart rate against pace), all 164 dots, 37 → 0; Health's 24-hour heart rate, 20 taps, 0 → 0; the six
     routes, 20 points each, 8, 10, 7, 4, 4 and 0 → 0. The long run of 27 Sep hangs 10 of its 20 cards
     below the map; session 2's hangs 1. With a column chart scrolled to the foot of the pane
     (`room.mjs`), the card goes over the chart's head, wholly in the pane.
   - **ART.md section 3** now gives the order and its reason (a column is cleared only sideways, so the
     card moves sideways first on every chart, then to the house's bottom-left), the hang, and the
     measured width of the route's card, 222 to 257 px of 358.
   - **`shoot.mjs`** gained two sweeps. The first: fifteen taps along Training's first chart at 55 % of
     its height, in both themes; the tapped column's highlight never meets the card, and every card is in
     view (`top-right, hung from the foot, top-left` in the last run). The second: twenty points along
     session 2's route; the marker, with its 1 px of ring, never meets the card, and every card is in
     view (`top-left, hung from the foot, bottom-left`).

2. **Open folds kept across a re-render when a new file arrives (the fix stage's decline). Applied;
   397 B** (the fix stage measured 421 B for its version). On a re-render of the same pane, `render()`
   records each fold's open state, keyed by its words and its place among folds with the same words
   (`folds()`). Once the pane is drawn, and before the scroll is put back, it restores those states. So
   a new file keeps the reader's folds and scroll, as the same file already did. A fold that is new in
   the new file keeps its default (`Stop signs` opens by itself), and a fold the reader closed stays
   closed. A filter, a unit or the theme re-render the same pane, so they now keep the folds too (the
   same mechanism, no extra code; before, they closed them).
   - **`shoot.mjs`** gained the changed-file case. On Plan it opens one fold of each kind (`How to read
     it`, a week row, `Why this shape`), closes the rest and scrolls 300 px. It then serves the snapshot
     with the pull an hour later (`generatedAt` 19:20Z) and checks four things: the stamp (`Updated
     30 Sep, 21:20, …`), that the pane was drawn again, that exactly those three folds are open, and the
     scroll (300 px). Then it serves the file as it was.

3. **A minimum span for the route's relative ramp (owner call 3). Applied; 389 B** (`app.js` +207,
   `index.html` +182). The ramp still spans each session's own 5th to 95th percentile. When those lie
   closer than a floor, it spans the floor, centered on the session's median, and the legend prints the
   ends as before. The map's caption reads `… between this session’s own 5th and 95th percentile, at
   least 45 s/km apart, whatever the slider shows`, with the floor of the chosen quantity. About gains one
   sentence: `Ends closer than 45 seconds a kilometer, 4 kilometers an hour, 10 steps or turns a minute,
   30 watts or 20 meters are spread that far around the median, so a steady run reads steady.`
   - **The floors, and why.** `floors.mjs` ran over the six demo sessions that have a record stream,
     taking the points as the map does:
     - **Pace 45 s/km, not the reviewer's 30.** In the demo's steady sessions the 5th and 95th
       percentiles lie 12 s/km apart (the easy run of 29 Sep), 14 (the tempo run of 23 Sep) and 17 (the
       10 km tune-up of 6 Sep). In the varied ones they lie 49 and 51 s/km apart (the long runs) and 137
       (the intervals of 19 Aug).
       At 30 s/km, the easy run's 5th to 95th percentile still covers 3.2 of the ramp's 8 intervals.
       Four stops each hold more than 5 % of its route (stops 2 to 5: 20, 77, 168 and 70 of its 355
       points; 17 at stop 6, 3 further out), so it does not read steady.
       45 s/km is the smallest round floor that puts 90 % of every steady session in three stops (the
       easy run's 3 to 5 hold 81, 203 and 65 points, with 6 elsewhere). It leaves every varied session at
       its own percentiles, since 45 is under 49. One stop is then 5.6 s/km, about the steady runs'
       interquartile range of 4 to 7 s/km.
     - **Cadence 10 spm, the reviewer's figure.** In every demo session the cadence percentiles lie 2 to
       3 spm apart (the generator's cadence is steady), so 10 spm puts 90 % of each in 1.6 to 2.4
       intervals.
     - **Elevation 20 m, the reviewer's figure.** The flat easy run's percentiles lie 5 m apart (7 m in
       all), which gives 2.2 intervals. The sessions with 11 and 18 m of spread are lifted to 20 m; the
       hilly ones (20, 35 and 48 m) keep their own.
     - **Speed 4 km/h and power 30 W are not measured**: no demo session is a ride or carries power.
       Each is set at about the share that 45 s/km is of the easy pace (14 %): 4 km/h of a ride's 25 to
       30 km/h, and 30 W of a run's or ride's 200 to 250 W. A copy with rides or a power meter should
       check them against its own steady sessions.
   - **Measured**: session 2's legends now read `slower ≥ 5:55 /km`, `faster ≤ 5:10 /km` for pace
     (before: 5:39 and 5:27), `≤ 173`, `≥ 183 spm` for cadence and `≤ 171`, `≥ 191 m` for elevation.
     `shoot.mjs` gained the check. It works out the run's percentiles and median from the stream and
     expects the legend's two ends to the second. It projects every drawn segment's color onto the
     legend's nine stops, finds 90 % of its 354 segments in 3 stops (segments per stop `0 0 2 65 202 81
     4 0 0`), and checks that the caption names the floor.
   - The reviewer's other option, a fixed scale per sport, stays open to the owner.

4. **`judgement` → `judgment` (should 2). Applied; −2 B.** The word is changed in About in `index.html`
   (`Its two judgment calls are…`), in `ART.md` section 3 (About, item 3) and in the `MUSCLE` comment in
   `app.js`. The spelling pattern in `tools/check.mjs` gains `judgement\w*`. Run over the files as they
   were, it flags `index.html:67`, `app.js:1724` and `ART.md:620`; now it flags none. The Geist check's
   message said `Geist is gone from every shipped file but ART.md, which records the swap`. `ART.md` no
   longer names Geist, so the check now reads `ART.md` too and says `Geist is named in no shipped .md,
   .html, .css or .js file, ART.md included`. The header comment's budget line now names 245,000 (D24),
   where it still gave 236,521.

5. **`ART.md`'s figures read against the running app (should 3). Applied; document only.**
   `figures.mjs` read every on-screen figure `ART.md` quotes at two fixed clocks: 1 Oct 2026, 12:00 in
   Copenhagen (`shoot.mjs`'s clock) and 30 Sep, 21:00 (the evening of the pull). `places.mjs` read the
   card places; `test_block.mjs`, `shoot.mjs` and `palette.py` the rest. `ART.md`'s intro now names the
   clock. Corrected, each from the output that printed it:
   - **The frame diagram**, drawn for the evening of the pull and now saying so: `Run, last 7 days
     50.1 km, 5 runs` for `44.7 km, 4 runs`; the Block's caption 30 px in two lines, not 15; the figure
     row 59 px with its 14 px of air, not 28; the plan pointer as the screen has it (the heading `What
     to do next`, then `On track. Sharpen this week, one last …`), for `What to do next: Sharpen this
     week, …`.
   - **The facts.** The example is now `Run, 28 days to 30 Sep`, `253.9 km`, `12 % more than the 28 days
     before, 0.5 km walked` (`Run, last 28 days` on the evening of the pull), for `235.6 km … 1 % more …
     0.4 km walked`. The counts: eight on Now (the app's four and the evaluation's four metrics), not
     four; up to sixteen in a session (the easy run of 29 Sep), not fourteen.
   - **The one large figure**: `Week of 28 Sep, data to 30 Sep` at the tools' clock (`This week, 28 Sep
     to 4 Oct` on the evening of the pull); on Plan `31 days`, not `30` (that was read at the real clock
     of 2 Oct).
   - **The race table**: the signed differences `−0:15`, `+0:20` (the demo's 10 km and half), not
     `+0:15`, `−0:20`.
   - **The readout card.** Its places are `Lap 4` (the demo's laps are auto-laps; `Lap 4, work` needs
     structured laps) and `35:24 into the session, 6.4 km` (a real tap), for `12:34 into the session,
     3.1 km`. A planned week's Block card is `Week of 5 Oct 2026, planned`, `76 km`, `Kind`, `Mix`,
     `Note`, with no `Plan 76 km` row; a `Plan` row appears only for a range.
   - **The route.** The range label is `Whole session, 12.8 km, up 21 m, down 20 m` (the easy run of 29
     Sep, the newest session with a route; the 11.2 km session of 30 Sep has no record stream), for
     `11.2 km, up 65 m, down 65 m`. The legend's ends are as item 3 left them.
   - **The stale stamp's example**: `Stale. Updated 30 Sep, 20:20, last session 30 Sep` (`shoot.mjs`, the
     clock at 3 Oct, 12:00), for an invented `28 Sep, 07:00`.
   - **The budget row**: 244 937 of 245 000 (D24); the ZIP about 1 074 300.

   **Read and found right:** the Block's weeks and figures (`test_block.mjs`: 49.8 … 77.8, 40.0, 45.9
   and 24.0 km; 76, 62, 48, 49); the plot's 64 and 96 px; the 20.5 px slots with columns of 16 and 17 px;
   `now` 18.7 px wide, centered at 234.5, with `Oct` at 246; the cards' and the label's words; every
   caption line; About's `This data`; the Block's 2 257 ink samples per theme at 14.80 and 14.43; and
   every color and contrast in section 2 (`palette.py`).

   **No history is left in `ART.md`** beyond its pointer to this file and section 8. `How it was found`
   and `How the steps were chosen` give the signature's and the palette's reasons, and every pass's
   `ART.md` keeps them. The ZIP cap's `before the pass` defines the cap. The cap row's `since the house
   face replaced another` now reads as a rule (`an app that swaps its own face for the house's gets
   none`). Nothing needed moving here.

### What the follow-up cost

`node tools/check.mjs`: app code **244 937 of 245 000** (63 B to spare): `app.js` 203 328, `style.css`
20 866, `index.html` 7 501, `js/*` unchanged. Item by item, each measured by reverting it from the final
files with the rest kept: the card's placement +248, the folds +397, the ramp's span +389, `judgment` −2;
+1 032 in all. Reverting all four gives back the files as they were before the follow-up, byte for byte.
Nothing was minified and no existing comment was stripped; the new comments were written short
(`showCard()`'s in two lines, `folds()`'s and the ramp's in one). The ZIP is 1 074 352 B of 1 340 193.
The data: 37 files, byte-identical (concatenation `37973fe9…ecf180e`).

### What was not done, and why

- **Nothing on the lead's list was declined.**
- **Not spent, since D24 pays for three things only:** the first caption of Session curves still says
  `Tap and hold to read a point; tap outside to release.` (`streamCard()` in `app.js`, both the
  placeholder and the line written once the stream loads). Since the review's touch fix, a held finger
  shows nothing until the lift; the 24-hour chart's caption was changed then, this one was not. The
  wording change is about 10 B, for the lead.
- **A hung card covers what follows it**: under a short map, the distance window and the elevation
  profile's own marker (the long run of 27 Sep hangs half its cards there); under a chart, its legend,
  caption and keys; over a chart's head, its heading. It closes on the next tap.
- **The bottom-left placement alone** was not enough (item 1), so the change cost more than D24's 60 B.

### Verified (2026-10-02, from `Template/running-dashboard/` unless noted)

- `node tools/check.mjs`: `all checks pass`.
- `node tools/test_block.mjs`: `all 15 pass`.
- `python3 running-dashboard/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: `all checks pass`, 116 checks (both themes,
  then the run-once checks). `screenshots/*-{light,dark}.png` and `about-light.png` were refreshed and are
  byte-identical to before (`shasum -a 256`: none of the panes' first screens changed);
  `screenshots/app.png` is reported untouched (`2388121857bd…`). Headless Chromium 153 on this Mac: a
  trend, never phone evidence.
- **The regression proofs.** For each, the change was switched off in the working file, `shoot.mjs` was
  run (`SCHEMES=light`), the file was put back from a copy, and `cmp` was silent:
  1. With the old placement, and the map clipping its card: `FAIL Weekly running volume, 15 taps along
     it: … 173 px covered`, and `FAIL the route, 20 points along it: … 193,165 covered; 184,145 covered;
     184,123 covered; 169,114 covered; 159,93 covered; 148,73 covered; 136,54 covered; 131,41 covered`.
  2. Without the restore line: `FAIL back on screen with a changed file ("Updated 30 Sep, 21:20, last
     session 30 Sep"): the pane drawn again (true), its 1 open folds kept by their words ("Stop signs") and
     its scroll (300 px)`.
  3. Without the floor line: `FAIL a steady run (5th to 95th percentile 12 s/km apart) is colored over
     45 s/km around its median: the legend "slower ≥ 5:39 /km", "faster ≤ 5:27 /km" (this file 5:55 and
     5:10); 90 % of its 354 segments in 9 of the ramp's 9 stops (segments per stop 24 22 43 43 82 42 50
     23 25); the caption says so`.

### The camera

Unchanged, and it needs no change: no string the camera reads moved, and the panes' first screens are
byte-identical in both themes.

### Owner calls as they now stand

1. **US units one tap away**: SI only. A mile switch is estimated at 6 000 to 9 000 B and needs a cap
   raised for it (unchanged).
3. **The route's colors**: built as a relative scale with a floor. Each session spans its own 5th to 95th
   percentile, never less than 45 s/km, 4 km/h, 10 spm (or rpm), 30 W or 20 m around its median; About
   and the caption say so. Open to the owner: the floors themselves (the reviewer proposed 30 s/km; 45
   is measured above), or a fixed scale per sport instead.
5. **The data follow-up** (the lead's, separate): the generator's British spellings; the session body
   battery as a change (the demo shows `Body battery change +66` today, which is untrue); dates in the
   coaching text; spaced em dashes; date-based week labels; and the same instructions in `PROMPT.md`.
6. **`Agent` on the race table**, against *the coaching routine* everywhere else (unchanged).
7. **Garmin's zone colors in the light theme**: fitted to the band (burnt orange `#965a01`, forest green
   `#115702`). The color-vision departure rides on this call: easy, moderate and hard lie 0.065 apart
   under protan vision (light), and the three sports 0.065 under tritan (light) and 0.089 (dark).
   Identity rests on words and fixed order; `palette.py` prints each as `dep`.
- **The routes' OpenStreetMap credit** stays keyed on the generator's `demo-` id prefix. The prefix
  matches the ODbL scope in `TILES.md`, and a real pull's numeric ids never start with it. A license
  field instead would be a data follow-up (the lead's ruling on owner call 4).

(Owner call 2, the code cap, is settled by D24 at 245 000 B.)

### Phone checks, for the device matrix (not claimed here)

On an iPhone with iOS 18 and one with iOS 26:
- switching into Training and Health (10 to 14 SVG charts each): the time it takes;
- the stale stamp on a two-day-old snapshot, and the stale state's words three weeks on (`Week of …,
  data to …`, `Run, 7 days to …`, `updated` on Plan's day charts);
- a return to the app after a Shortcut delivery: the same file keeps the open folds and the scroll; a
  new file re-renders in place and keeps them too; a broken delivery shows the plate, its Close key puts
  it away, and the data stays;
- a tap on a chart (the card and VoiceOver's sentence, said once), a sideways slide across the
  721-sample heart-rate chart and along the route (the card follows the finger and reads its own size
  on every move), and a vertical scroll that starts on a chart and on the route map (the pane scrolls,
  no card opens): WebKit sends `pointercancel` when a pan starts, as Chromium does, but this is the
  check;
- **the readout card's placement**: taps along a route where both top corners would hold the point (the
  card at the bottom-left, or hung under the map over the distance window); a column in the middle of a
  chart (the card hung from the chart's foot); the same with the chart at the foot of the pane (the card
  over its head); and whether a hung card reads as its chart's;
- the route's colors on a real pull's steady run and on a hilly one: whether 45 s/km reads steady
  against a real watch's pace noise, and whether a real hill still shows;
- the distance thumbs, which rebuild the route on each input;
- tapping `All sports` and `Any equipment`: whether iOS zooms the page on focusing the 12.5 px select
  and leaves the frame zoomed (if it does, the fix is a transparent 16 px select laid over the word key);
- the nested scroll of the session list inside the pane;
- the pane scrolling inside the frame (momentum, the caption band holding still, no rubber-band of the
  page), and the loop clip's drag scrolling Now;
- VoiceOver on the tabs and the tab panel, the heading rotor (groups as `h2`, sections as `h3`), the
  rows of words as pressed buttons, and the Block's label;
- the readout card at the screen's edges and hung under the Block;
- safe areas and the caption band over the home indicator; landscape (`now` over the Block's column).

---

## The data follow-up (2026-10-02)

Owner call 5, as the review and the final widened it, done after the pass as the lead ruled (D22): the
demo's data rebuilt by its generator, with a session's body battery as Garmin's change, the coaching
text in US English with the app's dates and plain punctuation, and the plan's weeks named so they stay
true; `PROMPT.md` gives a copy's coaching routine the same rules. Every figure below was printed by a
command run on this Mac. The throwaway scripts (`structdiff.py`, `texts.py`, `dom.mjs`, `heads.mjs`)
and the rebuilds are in `tools/.work/data-followup/` (gitignored). Nothing in `app.js`, `js/`,
`style.css` or `index.html` changed.

### The generator (`scripts/make_demo_running_dashboard.py`, 32 lines out, 58 in)

- **The body battery as a change.** The session's row of `details.csv` wrote `int(rng.uniform(55,
  95))`, a level, where `garmin_pull.py` (line 301) writes Garmin's `differenceBodyBattery`, the change
  over the session. `bb_change(z, day_factor)` now writes a negative change sized to the session's
  duration and effort: each minute costs its heart-rate zone's number in tenths of a point (a tenth in
  zone 1, half a point in zone 5), times a factor of 0.85 to 1.15 for the day's stress and sleep,
  rounded, at least 1. The factor is `rng.uniform(0.85, 1.15)`: one draw, at the place of the old
  level's one draw, so every later draw, and every other number in the data, is what it was (the diff
  below shows it).
  - **Why tenths.** A twelfth was tried first (−29 to −3). Tenths put the demo on the scale of the one
    real pull the repository quotes, the example in `app.js`'s header (`"bb":-6` on a 52-minute session
    Garmin labeled recovery): the demo's recovery runs of 24 to 59 minutes read −3 to −10, median −5.
  - **Measured on the rebuild**, the 121 sessions with detail (118 outdoor runs, 3 on the treadmill):
    −34 to −3. By kind, median and range: long runs −25.5 (−20 to −34, 75 to 128 min), intervals −17
    (−9 to −25), the two 10 km races −16 and −17, tempo runs −14 (−7 to −28), easy runs −10 (−3 to
    −16), steady runs −6 (−3 to −10), recovery runs −5 (−3 to −10), treadmill recovery −5 (−3 to −7).
    Per hour, medians: easy 10.7, long 16.7, intervals 19.4, tempo 20.7. The newest session (the
    intervals of 30 Sep, 55 min) is −20, the easy run of 29 Sep −12, the 24 km long run of 20 Sep
    (2 h 08) −34.
- **Dates in the app's words.** `day_mon()` writes `14 Sep` and `1 Nov` with fixed English names, as
  `js/units.js` does. It replaces `race.strftime("%-d %B")` (`1 November`; `%-d` is not portable) and
  the two ISO dates in prose (`week of 2026-09-14`; `Sunday's 15 km (2026-10-04)`).
- **The week labels.** `week_label()` names the plan's two weeks by their place in the block, `Week 12
  of 16` and `Week 13 of 16`, for `This week` and `Next week`. Not the dated label the brief suggested:
  `weekCard()` in `app.js` already heads a week `${w.label}, ${dayMon(start)} to ${dayMon(end)}`, so a
  label with dates in it would print them twice (`28 Sep to 4 Oct, 28 Sep to 4 Oct`). The heading now
  reads `Week 12 of 16, 28 Sep to 4 Oct`: dated by the app, and true on any day. The field is still
  `label`.
- **The coaching text, words only** (19 strings): `kilometre(s)` to `kilometer(s)` (the four places);
  `fortnight` out (`inside the two peak weeks`, `two weeks of recovery`, and `over the last two weeks`
  in the easy days' sentence's other branch, which the committed day does not take); `on holiday` to
  `on vacation`; `per cent` to `percent`; the eleven
  spaced em dashes to parentheses, commas or a colon; `1 November` to `1 Nov` (twice); the two ISO
  dates as above. For example: `Run it as a rehearsal (race shoes, race breakfast, even pace from the
  first kilometer) and let the time be whatever it is.`; `What comes after it (two weeks of recovery,
  then whatever the next goal is) gets written after the race, with the race in the data.`; `1:37:10 is
  the middle of the range: the low end needs the taper to land and a cool morning, …`.
- **The goal's preferences, punctuation.** Beyond the em dash: the two preferences were sentences with
  closing periods, and `panePlan()` joins them as `Preferences: a; b.`, so Plan printed `… the long runs
  used.; Long runs on Sunday mornings; the tempo on Wednesday; Monday is strength..`. They are fragments
  now, the shape `app.js`'s header shows: `nothing new on race day (the shoes, the breakfast and the gels
  are the ones the long runs used)` and `long runs on Sunday mornings, the tempo on Wednesday and
  strength on Monday`. The strength line reads `Squats, single-leg deadlifts, calf raises and planks,
  40 minutes.`
- **The generator's own comments** spell `kilometer` and `meters` now (nine lines); they write nothing.

### Deterministic, and nothing else moved

- **Two runs, byte-identical.** From `Template/`, `python3 scripts/make_demo_running_dashboard.py
  --out-root <scratch> --today 2026-09-30 --keep-raw <scratch>/raw`, twice, each over a copy of the
  committed tiles (as `--check` builds): `diff -r` silent over 63 files (the 37 of `data/` and the raw
  store's 26), the snapshot's sha256 `d47c5c1c…bb36434` both times. Repeated with the final file (after
  the comments): silent again, identical to the first pair, and its `data/` identical to the committed
  one.
- **The structural diff against the shipped `data/`** (`structdiff.py`): the same 37 paths, 36 of them
  byte-identical (the 30 tiles and the 6 stream files). `snapshot.json`: 140 changed leaves, 121 of them
  `activities[].dt.bb` (every session with detail: 55 to 94 before, all positive; −34 to −3 after, all
  negative integers) and 19 coaching strings (the evaluation 8, the plan 8, the race forecast 3);
  **anything else: 0**. The 248 session ids identical and in order, all `demo-`; every session's date,
  start, distance, duration, heart rate, zones, zone kilometers, laps, weather and gear unchanged, and
  every detail field but `bb`; the four embedded streams' route points unchanged; every top-level key but
  `activities`, `assessment`, `plan` and `racecast` unchanged. The 21 session notes needed nothing. The
  snapshot is 408 115 B (408 116 before); its eleven em dashes are gone, its eight en dashes (ranges)
  stay.
- **The generator's own check.** Before anything was copied: `--check --out-root <the rebuild>` printed
  `check: the committed data is what the generator makes` and `--verify --out-root …` `verify: ok`;
  against the shipped `data/`, `--check` drifted on `snapshot.json` alone, as it should. After the copy,
  from `Template/`: `python3 scripts/make_demo_running_dashboard.py --check` prints `check: the
  committed data is what the generator makes`, and `--verify` prints `verify: ok`. On three other days
  (`--today` 2026-10-05, 2026-10-11 and 2026-12-02) the generator writes `Week 12 of 16` and `Week 13 of
  16`, `week of 21 Sep`, `8 Nov` and `(11 Oct)`, no em dash and no ISO date in prose, and `verify: ok`.

### What the copy changed

- `data/snapshot.json`, renamed into place; the other 36 files untouched.
- `tools/check.mjs`: the snapshot's pin `7c6084b9…92eb849d` to
  `d47c5c1c41fbc0243d59ec9fcabc38ed3803e27c269c994bec614008bbb36434` (the other 36 pins were already
  right); the concatenation `37973fe9…ecf180e` to
  `871171cb856ae3da7ed869aa88a3cc335f7822ec01530fd47ae975d4eb13f0dc`, which the check printed but did
  not pin and now pins (`DATA_ALL`); the item's words (`as the data follow-up rebuilt them`); and the
  US-spelling allowance for `data/snapshot.json`, from `kilometre`, `kilometres`, `analysed` and
  `programme` to `analysed` alone (the race forecast's key; the plan's `programme` key is already
  stripped by the check's rule for it). Run over the shipped snapshot, the narrowed allowance flags its
  four `kilometre(s)`; over the rebuild, nothing.
- `ART.md`, section 6: the data row's two hashes and its rule (pinned; `--check` rebuilds them byte for
  byte), and the ZIP's `about 1 075 100` (`check.mjs`: 1 075 078 B; zipped alone, the snapshot stores
  48 B smaller, `PROMPT.md` 622 B larger, `NOTES.md` 113 B and `ART.md` 41 B). Section 7, tell 7: `and
  none in the demo's coaching text, which is data`, for `the coaching text's own dashes are data and
  stay`. None of the Block's figures changed (`test_block.mjs`, below).
- `NOTES.md`: `details.csv`'s row names the body-battery change (Garmin's own figure, negative for a
  drain), and the coaching text's section points to `PROMPT.md`'s rules. `NOTES.md` records no hash of
  the data, so there was none to change.
- `PROMPT.md`, under *Optional: the coaching text*, the routine's rules in the guide's voice: US
  spelling with metric units; dates as `14 Sep` and `1 Nov`, ISO dates in date fields only; no spaced
  em dash; a session's body battery as Garmin's change (`-14`), never a level; week names that stay
  true (`Week 12 of 16`, `Taper, week 2`), since the app prints the dates after them; the goal's
  preferences as fragments.

### On screen

`dom.mjs` served the app with each `data/` in headless Chromium (390 × 844, `shoot.mjs`'s clock: what
the page draws, never phone evidence) and read the panes. Before, then after:
- **Sessions**, all 248 listed, each clicked: the 121 with detail show `Body battery change`, `+55` to
  `+94` before (`+76` on the intervals of 30 Sep, `+66` on the easy run of 29 Sep), `−34` to `−3` after,
  every one with the true minus (`−20`, `−12`).
- **Plan's week headings**: `This week, 28 Sep to 4 Oct` and `Next week, 5 Oct to 11 Oct`, then `Week 12
  of 16, 28 Sep to 4 Oct` and `Week 13 of 16, 5 Oct to 11 Oct`, one line each at 320 and at 390 px (177
  and 178 px wide, in 288 at 320 px; `heads.mjs`).
- **Plan, The goal**: `Preferences: Nothing new on race day — the shoes, … used.; Long runs on Sunday
  mornings; the tempo on Wednesday; Monday is strength..`, then `Preferences: nothing new on race day
  (the shoes, … used); long runs on Sunday mornings, the tempo on Wednesday and strength on Monday.`
- **Now**, the evaluation's facts: `Biggest week 78 km, week of 2026-09-14`, then `week of 14 Sep`;
  `Goal 1:37:30, Copenhagen Half Marathon, 1 November`, then `1 Nov`. No em dash and no `kilometre` on
  Now after.
- No console error or warning, page error or failed response, before or after.

### Verified (2026-10-02, from `Template/running-dashboard/` unless noted)

- `node tools/check.mjs`: `all checks pass` (`data/: the 37 files as the data follow-up rebuilt them
  (concatenation 871171cb…b13f0dc)`; `US spelling in 18 shipped text files, the data's own words allowed
  by file`).
- `node tools/test_block.mjs`: `all 15 pass` (the Block as before: 49.8 … 77.8, 45.9 and 24.0 km; the
  outlines 76, 62, 48 and 49).
- `python3 running-dashboard/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`, no `SCREENSHOTS`: `all checks pass`, 116 checks, no console
  error in any context; `screenshots/app.png` untouched.
- `python3 scripts/make_demo_running_dashboard.py --check` (from `Template/`): `check: the committed data
  is what the generator makes`.

### Left alone, and why

- **Relative words in the prose** (`This week sharpens …`, `HRV dipped this week`, the plan's headline
  `Sharpen this week, …`, `Sunday's 15 km`): the evaluation and the plan are dated (`Plan written 30
  Sep`) and read as of that day. The fault was the week headings, which are not dated.
- **Month names in prose** (`in March`, `in May`, `in June`) are months, not dates. **Ranges** keep
  their en dashes (`30–48 km`, `168–176`, `km 0–10`).
- **The keys** `programme` and `analysed`, the shape the code and the routine share; **`niggle`,
  `mileage` and `2:00 up on May`**, which are in US use.
- **`PROMPT.md`'s own spaced em dashes**, in its prose from before the pass: the rules were added, and
  sweeping the guide is a separate edit.
- **Outside this follow-up's files**, for the lead: `app.js` line 3573 says `over a fortnight` (the app's
  own string); `docs/MANUAL_STEPS.md` line 3308 still calls the data's faults pending;
  `App/Snuggery/Resources/StarterPack/live/running-dashboard.zip`, last written at 17:48 by the other
  work on this Mac (its file time; `screenshots/app.png` and `docs/marketing/` at 17:49), before the
  snapshot was copied at 17:55, so it carries the data as it was; and `ART.md`'s app-code row says
  244 937 B (`app.js` 203 328) where `check.mjs` measures 244 919 B (`app.js` 203 310), a difference
  this follow-up did not make.

### Phone checks this adds (not claimed here)

On an iPhone with iOS 18 and one with iOS 26:
- a session's `Body battery change −20`: that VoiceOver says the minus (U+2212), and that the figure
  reads as a drain beside Health's 0 to 100 levels;
- Plan's `Week 12 of 16, 28 Sep to 4 Oct` at the largest accessibility text size (one line at 320 px in
  Chromium at the default size);
- the goal's `Preferences: …` read by VoiceOver as one sentence.

---

## The owner's six (2026-10-03)

The owner used the app on their phone on the morning of 3 Oct (their private copy, Training Load, built
from this one) and sent three screenshots (Training, Plan, Now) with six points, numbered as they wrote
them. **The lead's ruling (plan 0011 D32): the owner's features take precedence over the house budget, so
the code cap is 252 000 B for exactly these six**; `tools/check.mjs` sets `CODE_CAP` to it with that reason.
HOUSE.md's rules otherwise hold. Every probe named here is a throwaway script in `tools/.work/owner/`
(gitignored), with the files as they were before this round kept in `tools/.work/owner/orig/`. Headless
Chromium 153 and WebKit 26.6 on this Mac, 390 × 844 at DPR 2: what the page draws, never how a phone feels.

### What was built, point by point

1. **"I do not like the squares around the sliders."** The two gray squares in the owner's Training
   screenshot sit exactly on the window's two thumbs, 44 × 44 CSS px with a shadow. They are not this
   stylesheet's: with the CSS as it was, neither WebKit 26.6 nor Chromium 153 on this Mac draws them
   (`probe-thumbs.mjs`, `thumbs-before-all.png`: a bare head on the page in both themes), so they are the
   phone's own painting of a native thumb, whatever its cause. **Built:** the two range inputs are drawn
   at opacity 0, so nothing the platform paints for them can show, and stay the 44 × 44 hits and the
   accessible sliders; the heads are drawn by the window's fill, its `::before` and `::after`, the same
   tracer heads as before (an 8 px ink disc on a 3 px page ring with a 1.5 × 18 px tick through it, 10 px
   while its thumb is pressed, by `:has(input:active)`), round, so even a key's focus ring is a circle
   around the head, never a square. The route's distance window on Sessions shares the drawing. **589 B**
   (`style.css`). *Tested:* `shoot.mjs` finds the inputs at opacity 0, nothing but the page in each thumb's
   44 × 44 box outside its head and the track (0 of 5 616 samples, both themes), each head's ink 14.80 and
   14.43:1, and each hit 44 × 44 by `elementFromPoint` (43 of 43 points both ways). *Not shown here:* that the
   phone's square is gone; Chromium never drew it, so the pixel check passes on the old CSS too, and only
   the opacity check fails there. That is a phone check.

2. **"The sliders should be locked on top for relevant pages."** On Training, Health and Sessions the window
   (its words, its printed range, its track) is held under the tabs while the pane scrolls beneath. **Built:**
   the filter block is `position: sticky; top: 0` inside the pane's scroller, on `--page`, z-index 4 (over a
   chart's card at 3, under a notice at 5). It stays in the flow, so at rest the pane's content begins at
   its foot and nothing is covered. *The brief asked for the pane's top padding to equal the block's
   height:* there is no padding to set, because the block keeps its own place in the flow; the equivalent
   is measured instead, the content's top at the block's height (136 = 136 on Training, 88 on Health). An
   overlay with a padding would have needed the padding to follow the tuck (point 3) and opened a gap at
   the top. A session picked on Sessions scrolls to 8 px under the block as it stands once tucked (the old
   scroll put it under the block). **429 B** (`style.css` 296, `app.js` 133). *Counts against the plate:* of
   the 694 px pane at 390 × 844, 136 at rest and 88 once tucked, leaving 558 and 606; on a phone on its side
   (844 × 390), 136 and 88 of 320, leaving 184 and 232 (`shoot.mjs`).

3. **"The sport/equipment filter can be above sliders and can be hidden when moving down."** **Built:** the
   selects' row moves to the top of the block (4 px under the tabs, 48 px with its frames), above the window's
   words and track. It tucks like a browser's bar: `tucked()` in `app.js`, on the scroller's `scroll`, sets the
   block's `translateY` to the scroll moved since the direction last changed, held between 0 and the row's
   height and never more than the scroll itself. So a scroll down carries the row up and out with the pane,
   pixel for pixel, gone after 48 px; a scroll up brings it back the same way; at the top it is always
   there, with no gap. It never moves on a timer: no transition, so `check.mjs`'s motion rule (no transition
   anywhere) holds unchanged and Reduce Motion has nothing to stop. A key that focuses a control in the block
   brings it back (`focusin`, only when the target matches `:focus-visible`): a finger on a thumb does not, so
   the track never moves under a drag. In Chromium a touch on a thumb does not focus it at all
   (`probe-drag.mjs`); whether iOS does is unknown, hence the gate. Health has no selects, so nothing tucks
   there. **807 B** (`app.js` 810, `style.css` −3; `index.html` only reordered). *Tested:* `shoot.mjs`, both
   themes: 200 px down, the row's foot at the pane's top and the window's words at the top, 88 px of block
   held; 60 px back up, the row back whole; at the top, the block as at rest; the same by touch (a drag up
   to about 300 px tucks it, a drag down of about 125 px brings it back); a finger dragging the window's end
   with the row tucked moves the window (week 37 to 30) while the track holds at one height through all ten
   moves; Health holds its 88 px and tucks nothing. `probe-focus.mjs`: Tab into the selects while tucked
   brings the row back in both engines.

4. **"On the plan I want a running plot similar to the time in zone plot with colors as it was. I like the
   new one as well."** The stock app's chart was read from the stranger's pictures of the stock app,
   `tools/.work/shots/light-Plan-full.png` and `dark-Plan-full.png` (2026-10-02, 13:59, before the pass; crops
   in `tools/.work/owner/stock/`): **Running volume, past and planned**, after the goal and before the time in
   zone, kilometers per week stacked `Below Z1`, `Easy (Z1–2)`, `Moderate (Z3)`, `Hard (Z4–5)` (the zone hues:
   pale gray, blue, green, orange), the plan's weeks as pale fills of the same colors, a 4-week average
   actual (ink) and planned (dashed), `now` and the race's rule. **Built:** the same chart in the house: the
   Block's sixteen weeks (`blockWeeks()`), each run week's kilometers by zone from `kmByZone()` (as the day
   charts take them) in the fitted tokens of those four colors (`--zone-0`, `--zone-2`, `--zone-3`,
   `--zone-4`: the stock's hues, lightness fitted), the plan's weeks split by their own `mix`, drawn planned
   (outlined and tinted, point 5), this week's rest of its target on top of what was run, the two averages
   meeting at `now`, the race's rule and name, its card the Block's with the zones under it, a legend, the
   caption `One bar is one week, Monday to Sunday.` and `Show the table`. The Block stays as it is. *Where the
   brief and the stock differ:* the stock's planned bars were pale fills (its "faint" fills at 38 %, the
   pass's record says), not outlines; the outline with a 20 % tint keeps the house's rule and gives the
   stock's pale look. The stock showed no walked portion in this chart (`Below Z1` is running below the zone
   1 floor), so none is drawn. This week's rest is split by the week's mix, where the time in zone puts its
   rest in easy; and this week counts at the larger of done and target in both averages, as on the time in
   zone. *Fixed in the build:* the first build's race name crossed the bar of 14 Sep (77.8 km in an 80 km
   plot); the plot now keeps a tenth of headroom over its tallest week (top 100 km). **2 941 B** (`app.js`).
   *Tested:* `shoot.mjs`, both themes: the section between `Goal: Copenhagen Half Marathon` and `Time in zone,
   past and planned`; its legend's seven entries; 15 planned segments tinted; the race's name clear of all
   63 bars; its table's 16 weeks, each run week's kilometers as the script sums them and its four zones
   adding up to them, this week's 62 km, the plan's 76, 62, 48 and 49; a tap on 14 Sep, `77.8 km` (the
   script's sum) with four zones adding up to 77.8.

5. **"I want fill inside the planned stuff (light) to make it possible to see."** **Built:** every planned
   element drawn as an outline now holds its own token at 20 % over the page: the Block's weeks still to run
   (in ink, and only from the outline's top down to the ink, so this week is tinted above its runs and a
   week run past its target not at all; `js/block.js` computes the tints, `window.__rd.block().tints` shows
   them), the running, time-in-zone and day charts' planned segments (`segRect()`: the segment's own fill
   under `.tint { fill-opacity: 0.2; }`, its stroke at full strength), the plan's zone bars in the week rows
   and the legend's `Planned` swatch (`color-mix(in srgb, var(--c) 20%, transparent)`), and About's sentence
   on the outline. *Why 0.20:* `palette.py` (new `TINT`, check 8, `tint` in `--json`): the largest round
   strength at which every token ever drawn planned stands at 3:1 or more against its own tint in both themes
   (at 0.22 zone 5 falls to 2.95 in the light theme), so done and planned stay apart at the mark's target,
   and every tint stays under 2:1 on the page: light 1.28 to 1.51, dark 1.22 to 1.80; the Block's ink tint
   `#bdc4c7` (1.51:1, the ink 9.82:1 on it) and `#3e474a` (1.80:1, 8.03:1). ART.md section 2 prints the whole
   table. **713 B** (`style.css` 125, `js/block.js` 244, `app.js` 303, `index.html` 41). *Tested:*
   `test_block.mjs` (two new cases, both scales: 5 tints from each outline's top to the ink, this week's
   31 px on Now over its 24.0 km; a week run past its target keeps its outline and no tint); `shoot.mjs`, both
   themes: the Block's 535 samples inside its tints, 94.8 % at the tint's exact color (the race's rule
   crosses one column), the outlines' strokes still ink; on Plan, the tallest planned segment of each of the
   four charts sampled inside, within one step per channel of its token at 20 % (light `rgb(186,209,227)` for
   `rgb(186,210,227)`, dark exact), the done segment of its color 4.00 (light) and 5.11 (dark) against it; the
   zone bars and the legend swatch at alpha 0.2. `check.mjs` holds the stylesheet's two forms to
   `palette.py`'s `tint`.

6. **"The Now pane would read better as a table on top."** **Built:** Now opens on a table of its short facts,
   above the Block and the verdict: the app's four (`Run, last 7 days`, `Run, last 28 days`, `Garmin status`,
   `VO₂ max`) and every metric of the evaluation that fits a line, by a rule a routine can follow: its value
   and note 64 characters or fewer, and no second sentence (a period, `!` or `?` followed by a capital). The
   demo's four metrics (`Weeks done`, `Biggest week`, `10 km tune-up`, `Goal`) all fit; the owner's
   (`Share of the 2025 peak`, `The down week, as it closed`, `Fridays without a run`, `HRV last night`) run
   to three to five sentences and do not. The table is a `<dl class="tab">` on a grid with `subgrid` rows:
   the labels a column as wide as the longest (at most half), the values left-aligned beside them, a note
   wrapping under its own value, `text-wrap: pretty` (it kept the demo's `1 Nov` whole in both engines; iOS
   18 ignores it). A long metric is set under the verdict as a label over its prose, left-aligned at 12.5 px,
   line height 1.5, at most 62 characters wide. *Placement, decided here:* the brief says the long facts
   "stay below with the evaluation". Under the verdict was chosen over two alternatives: where they stood
   (after `What to do next`, where they read as part of the plan's section) and inside `The full evaluation`
   (below the race table, far from the headline they argue for). The verdict is the evaluation's headline and
   these are its evidence; moving them is one line in `paneNow()` if the owner prefers otherwise. The Block,
   the figure, the coaching text and the private copy's anchors (the empty-assessment and empty-plan
   sentences, `rewritten by each run of the coaching routine`, the race table's strings) are unchanged.
   `NOTES.md` states the rule for the routine's author. **1 086 B** (`app.js` 435, `style.css` 651). *Tested:*
   `shoot.mjs`, both themes: the pane's first section is the table, its eight labels as the script expects
   them, the first value the script's own 50.1 km, every value at one left edge (x 147), the Block second,
   no long fact in the demo; then the snapshot served with one long metric added: it is under the verdict,
   not in the table (still eight rows), three lines of left-aligned prose inside the gutters.

### What it cost

| Point | Bytes | Where |
| --- | --: | --- |
| 1. No plate behind the thumbs | 589 | `style.css` |
| 2. The filters held under the tabs | 429 | `style.css` 296, `app.js` 133 |
| 3. The selects above, tucking with the scroll | 807 | `app.js` 810, `style.css` −3 |
| 4. Plan's running chart | 2 941 | `app.js` |
| 5. The plan's tint | 713 | `style.css` 125, `js/block.js` 244, `app.js` 303, `index.html` 41 |
| 6. Now's table | 1 086 | `app.js` 435, `style.css` 651 |
| **All six** | **6 565** | 244 994 before (the record's 244 917 and the lead's 77 B in `index.html` and `style.css` at 20:07 on 2 Oct) to **251 559 of 252 000**, 441 B to spare |

Attributed hunk by hunk from a `difflib` comparison with `tools/.work/owner/orig/` (the sum is the measured
total). Nothing was minified and no existing comment stripped; the new comments were kept to a line or
two. The ZIP is 1 080 837 B of 1 340 193 (`ART.md` and `NOTES.md` ship inside it). The data: 37 files,
byte-identical (`check.mjs`: concatenation `871171cb…b13f0dc`). The stored keys are as they were
(`running-dashboard.ui.v3`, `tl-loadunit`).

### Declined, departed from, or not mine

- **Nothing declined.** Departures from the brief's letter, each above: no top padding (the block keeps its
  place in the flow, measured equal); the stock's planned bars were fills, not outlines; no walked portion
  (the stock had none in this chart).
- **`shoot.mjs` has no three-speed scrub in this app**, so there was none to keep: a pane app has no player
  (HOUSE 4.0). Its other checks (hit targets, Reduce Motion, the camera's drag, the card sweeps and the rest)
  pass; the two card sweeps' "in view" now means under the held filters, not only inside the pane.
- **For the lead:** `screenshots/app.png`, the README's composite, is untouched (`f3d36d54aaa8…`) and shows
  Now as it was; the camera's picture of Now now leads with the table. The private copy's anchors were
  counted before and after: every one present the same number of times, and every line naming the agent
  identical.

### The tools' last lines (2026-10-03, from `Template/running-dashboard/` unless noted)

- `node tools/check.mjs`: `all checks pass` (`app code 251,559 bytes (cap 252,000, …)`, `ZIP size 1,080,837
  bytes`, and the new line `the plan's tint at palette.py's 0.2 in both themes: …`).
- `node tools/test_block.mjs`: `all 18 pass` (15 before; the tint at both scales, and a week run past its
  target).
- `python3 running-dashboard/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS` (check 8 new, 18 lines).
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: `all checks pass`, 157 checks (116 before),
  `screenshots/{now,plan,training,health,sessions}-{light,dark}.png` and `about-light.png` refreshed,
  `screenshots/app.png` untouched.
- **The regression proof.** The new `shoot.mjs` was run (`SCHEMES=light`) on the app as it was before this
  round (`app.js`, `style.css`, `index.html`, `js/block.js` from `tools/.work/owner/orig/`), then the new files
  were put back and `cmp` was silent for all four (`tools/.work/owner/proof-final.log`). 19 checks failed,
  every new per-theme one: the Block's tints (`0 tints`), the Now table (`a table of 0 short facts`), the
  thumb drag (`week 37 to 37`, the track scrolled away to −62 px), the held filters (`140 px … its foot at
  -60 px`) in all four states and by touch, Health, the thumbs (`the inputs at opacity 1 and 1`; the pixels
  around them were already clean in Chromium), the running chart (`between "undefined" and ""`), its table
  and card, the four charts' planned interiors (`a planned segment to sample`), the zone bars (`rgba(0, 0, 0,
  0)`) and the long fact.

### What I looked at

`screenshots/now-*.png`: the pane opens on the eight-row table (labels in a column, values left-aligned,
`253.9 km, 12 % more than the 28 days before, 0.5 km walked` wrapping under its value, `1 Nov` whole), then
the Block with its coming weeks pale inside their outlines and this week tinted above its two runs, then
`Week of 28 Sep, data to 30 Sep 24.0 km of 62 km planned` and the verdict. `screenshots/plan-*.png`: the
Block on Plan with the same pale weeks, the race-day figure, the verdict, the goal, then the head of
`Running volume, past and planned`; `tools/.work/shots/plan-running-*.png` shows the whole chart: the
stock's four colors fitted to the band, run weeks solid, the plan's weeks outlined around pale blue, green
and brown (dim blue, green and amber in the dark theme), the averages meeting at `now`, the race's name
clear over the plan's weeks, a tapped week's card with its zones, the table. `screenshots/training-*.png`:
the selects, the window's words and the track with its two bare heads held at the top over `Running`;
`training-tucked-*.png`: the selects gone, the window and track over the chart as it scrolls beneath;
`training-landscape-light.png`: the same on a phone on its side, 232 px of chart under them;
`now-long-fact-*.png`: a served long metric under the verdict as a label over three lines of prose.

### Phone checks this adds (not claimed here)

On an iPhone with iOS 18 and one with iOS 26:
- **the filters held and the selects' row tucking, by thumb**: the row following the finger both ways,
  momentum and the rubber-band at the top (the row always there) and at the bottom (it may come back on the
  bounce, as a browser's bar does); the 88 px held over Training and Sessions, 136 at rest, and on a phone
  on its side; VoiceOver reaching a tucked select (does it come back, can it be opened);
- **the thumbs without their plates**: no square behind either thumb at rest, under a finger or after one;
  each hit still 44 × 44; the head growing to 10 px while pressed (`:active` on iOS needs a touch handler,
  as before); whether a touch focuses the range input, and if it does, that no ring appears on a touch and
  the track holds still;
- **the tints at the phone's display**, both themes and at full and low brightness: the plan's weeks seen as
  pale bars and never mistaken for done, on the Block, the running and time-in-zone charts, the day charts and
  the week rows' zone bars;
- **Now's table**: the label column and the left-aligned values (`subgrid`, `fit-content()`), and a date in a
  note on iOS 18, where `text-wrap: pretty` does nothing; the owner's long metrics under the verdict, read by
  VoiceOver label first;
- **Plan's running chart**: a tap's card over the chart's neighbors, the table's sideways scroll, the race's
  name on the owner's own plan.
