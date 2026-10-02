# Norne Reservoir: decisions, as built, and the review record

Build history lives here, never in a shipped file. `ART.md` is the direction; this file records what
the house-system pass (plan 0011, package B) built, where it departed, and what is left to the owner.

## The house pass, build stage (2026-10-01)

**Verified** (every figure from the command that printed it, run from `Template/norne-reservoir/`):

- `node tools/check.mjs`: all checks pass. App code 142 044 B (cap 200 000; 77 032 before), fonts
  40 075 B (cap 160 000), ZIP 15 354 881 B as `build-zips.yml` packs it (cap 19 110 591 = 15 258 206 x
  1.25 + 37 834, plan 0011 D5), 19 files. The seven data files byte-identical to their pins.
- `node tools/test_decode.mjs`: all checks pass (the frames, the open ends: pressure 56.4 to 612.5 bar,
  gas 0.922, permeability 13 / 101 / 5 cells; the cut: 37 144 Sm³/d in the month to 2000-11-01, the
  crossover in the month to 2004-07-01 held 30 of 30 months, 69 % in the last, 67.20 and 23.29
  million Sm³; 37 units cases).
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: all checks pass in both themes with the scrub. Headless
  Chromium with SwiftShader: load and color-pass times are a trend, never phone evidence.
- `python3 norne-reservoir/tools/art/palette.py` (from `Template/`): ALL CHECKS PASS, exit 0;
  `config.json` and `style.css` carry its values (check item 13).

**The bugs on record (ART.md section 8), each fixed and where it is tested:**

| Bug | Fix | Test |
| --- | --- | --- |
| B1 legend over the date and the property name, sheet raised | the legend is in the caption band, the body a grid with the plate held at 200 px or more | shoot: no overlap with the header, the date or the player at all three stops with 59 / 34 px insets emulated |
| B2 Snuggery's exit control over the date (iOS 18) | the date is in the player | phone check (the ghost key now takes that corner in focus mode) |
| B3 header and wells key over the model | both are bands | shoot pictures |
| B4 VoiceOver speaks every step twice | no `aria-live` on the date or the card; one polite live region for a tap, a step key, focus mode | shoot: the tap's one sentence, the step key's sentence |
| B5 scales clip silently; commas, `50 k`, `10 M`, abbreviations | open ends from `js/data.js`; every number through `js/units.js`; full words | test_decode (open ends), shoot (legend at 1 Nov 2005, SI scan, card against its own decode) |
| B6 controls under 44 px | every control 44 x 44 | shoot: hit targets, sheet closed, at its last stop, in focus mode, at five widths |
| B7 dark theme not printed | per-theme scales (`colormapsDark`), the plate's clear color `--plate` | shoot: oil-bearing cells darker than barren rock in light, brighter in dark |
| B8 well roles color alone | dashed injectors, a thin faint shut well, cores lighter than every data end on a casing | wells key; palette.py |
| B9 Regions and Layers unreadable | `Segments` (4, named) replaces Regions; Layers a sequence with formation ticks | owner call 4 |
| B10 markup from data names | no `innerHTML` but `= ''` anywhere (the five builds are DOM now) | check item 12 |
| B11 the loop never rests | frames only while dirty, a flight or play | shoot: 0 frames in a second at rest |

**Departures from ART.md, corrected in it:**

1. About holds play and resumes it on close (HOUSE 4.6), where ART said About stops play.
2. The sheet's column (wide screens, a phone on its side) is a 45 px grip strip at the closed stop:
   with the full 340 px column the plate was 157 px tall at 844 x 390 (shoot), against the 220 px rule.
   The landscape caption is three rows by named grid areas (legend and credits, instruments and wells
   key, the cut's line); the plate is now at least 220 px there (shoot prints it).
3. Well names take no touch; a tap in a name's 44 x 44 box selects the well (so a drag starting on a
   name still turns the model). They stay buttons for VoiceOver; out of the tab order, since the well
   picker reaches every well from the keyboard.
4. The gas scale's open end prints `≥ 0.9`, not `≥ 0.90`, like the scale's other ticks.
5. Code is 142 044 B, not ART's estimated 110 000.
6. Legend ticks: about three round intervals inside the fixed range; interior labels that would touch a
   neighbor are dropped, the ends always print.
7. The well picker now opens the well's card, as the stock picker did.

**Not changed:** `data/`, `pipeline/`, `screenshots/app.png` (shoot checks its hash). `scripts/package.sh`
gained `js/` and `fonts/` in its file list (it copies named files; without them its ZIP would not run).

## The camera (HOUSE 7.4)

Every string is kept with its role: `Oil saturation` (the legend's title, written last, after every file
is in; absent from `index.html`), the radios `Oil` and `Pressure`, the button `Show the whole field`,
`Play production history` / `Pause`, the grip's three names, the ghost key `Show the controls`. The two
camera changes ART.md section 5 asks of the lead were already in the working tree when the build looked:
`waitForNorne()` calls `showControlsIfHidden()` (MarketingCameraCase.swift line 240), and clip 2 finds
`Pressure` and `Oil` with `webControl(labelled:)` (MarketingClipsUITests.swift). Still the lead's: the
`Double-tap a spot` wait in `waitForNorne()` is now dead code (the hint is gone), and the stale comments
ART.md section 5 lists (shot 17's *Along the field*, the slider note's `<input type="range">`).

## Owner calls left open

ART.md section 9's twelve, as built: 1 the cut; 2 the plate printed twice; 3 the ten scales rewritten in
`config.json`; 4 Segments for Regions; 5 the SI / US key; 6 the on-screen credit line; 7 focus mode keeps
the legend, instruments and wells key; 8 the first-run hint gone (`norne-viewer:v1:hint` retired);
9 `Reset view` gone, the explode select three words, the well picker a native select; 10 the rates chart
kept; 11 the stamp's words; 12 Page Up and Page Down move a year.

## Phone checks (not claimed; for the device matrix)

Frame time idle, playing and scrubbing by finger (the color pass and texture upload per date; with a value
filter on, the face rebuild per date); memory after five minutes of play; background and return; the
print on an OLED screen; the wells' dash at DPR 3; the labels' halo (`paint-order: stroke fill` with
`-webkit-text-stroke` on HTML text in WebKit; if it paints the stroke over the glyphs, eight 1.5 px
`text-shadow` offsets are the fallback); focus mode in Snuggery's full screen with the ghost key and
Snuggery's exit control both reachable (iOS 18 and 26); B1 and every band's safe areas on a phone with
the sheet raised; VoiceOver on the track, a tap, the property words, the grip, About; the phone on its
side with the 45 px grip strip; `:has()` in the iOS 18 web view (the strip depends on it).

## After QA (2026-10-01)

QA's verdict was `fix`, with one must and one should. Both are fixed in `app.js` and pinned in
`tools/shoot.mjs`, and each new check was first run against the old code, where it failed:
`FAIL the well card agrees with itself: C-4H 1997-11-06: "Shut" / on 6 Nov 1997 / Now Producing`
(and the same for F-4H on 2001-09-01), and `FAIL /data/dynamic.bin broken, light theme: 0.0 % of
36838 sampled plate pixels outside the notice are the ground #e8eef0` (every broken case, both themes).

1. **Must: the well card's figure fell back to `Shut` beside `Now: Producing`** when the well was open
   in a role the summary held no rate series for. That happens on two frames in this file, C-4H on
   1997-11-06 and F-4H on 2001-09-01, both coded Producer with no `oil` key in `summary.wells`. Now the
   figure is `DOING[code]` and the line under it reads `no rate reported on <date>`. `Shut` and
   `Not yet open` are unchanged.
2. **Should: a failed load left the plate black.** `fail()` now clears the opaque WebGL context to
   `--plate` through `readTheme()`, and does it again on a theme change.

**Verified after QA**, run from `Template/norne-reservoir/`:

- `node tools/check.mjs`: all checks pass. App code 142 675 B (app.js 80 051), fonts 40 075 B, ZIP
  15 356 182 B against the 19 110 591 B cap, data byte-identical to the pins.
- `node tools/test_decode.mjs`: all checks pass.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: all checks pass in both themes. The card
  check covers both gap frames and one rated frame (B-2H 1998-01-01, `3 692 Sm³/d`). The broken plate
  reads 100.0 % ground in every case, including light, then dark, then light again with the data broken.
- `python3 norne-reservoir/tools/art/palette.py` (from `Template/`): ALL CHECKS PASS.
- `bash scripts/package.sh`: built `dist/norne-reservoir.zip`.
- `shasum -a 256 data/* | shasum -a 256`: `f8b8a7d1…f005`, the pin.

## After review (2026-10-01)

The reviewer's verdict was `fix`: no musts, six shoulds, eight nits. Every should is fixed; of the nits,
six are fixed, one is left to the lead (ART.md's build history, family-wide) and one is the phone list
below. The reviewer's figures before the fix come from their real-touch drive (`tools/.work/review.mjs`);
the figures after come from the checks this pass added to `tools/shoot.mjs`.

**Shoulds.**

1. **The model was badly framed whenever the plate changed size** (focus mode cropped both ends; 35 % of
   the width at the sheet's middle stop; about a quarter of the plate on its side). `defaultCam()` fitted
   the extent's diagonal against a fixed vertical field of view and nothing refitted on a resize. Now
   `fitCam()` fits the field's projected box (two opposite corners of every fourth cell, as exploded, and
   the well heads) to both of the plate's axes by bisection on the distance, in the room left of the key
   column or below the key row (below only when the field comes out at least a fifth larger, so it keeps
   the plate's middle), with 26 px above for the names. A lens shift (`sx`, `sy`, clip units, in the
   projection's third column) puts the field's middle at that room's middle, so orbiting still turns it
   about its own middle; flights interpolate the shift. A camera still at the fit (`S.cam.fit`, cleared by
   an orbit, a pan, a pinch, the wheel or any flight but `Show the whole field`) is fitted again on every
   plate resize, explode and vertical stretch; any other keeps its zoom against the fit (its distance
   scaled by the fit's ratio between the two sizes). On a plate wider than 1.6 : 1 the eye comes down from
   36° toward 24° (24.0° at 844 × 390). A camera saved before this pass has no lens shift and is replaced
   by the fit. shoot, light theme, the drawn box from rendered pixels with the keys and ghost key left out:
   sheet closed 390 × 480 84 % of the width (left of the key column); stop 1 390 × 200 95 %; focus mode
   390 × 601 95 %; focus mode on its side 844 × 251 98 %; upright again 84 %; each inside the plate and
   clear of the keys. On its side with the sheet closed (799 × 223) the key row takes the plate's top
   right, so the room is the part left of it: the field ends at 546 px against the keys at 549 px, 67 % of
   the plate's width and 75 % of its height. That is the one case under the reviewer's 70 % of the width;
   it is bound by the keys, not by the fit. A camera pinched to half the fit keeps its zoom through focus
   mode: 9 507 m, 11 745 in focus mode (the taller plate), 9 507 back out.
2. **The names' 44 px hit boxes covered 31.4 % of the model.** A name's own text, padded to 24 px tall
   (WCAG 2.5.8) and 2 px each side, now wins; its 44 x 44 box grows upward from the text, away from the rock
   under the well head, and counts only where no cell is under the finger (`resolveTap()`, also on the
   test hook). shoot: of 1 370 sampled points on the field, 293 (21.4 %) open a well, every one on a
   name's padded text, none beyond it; the drawn text alone covers 189 (13.8 %), so the padding adds
   7.6 %. **Declined in part:** the reviewer's "at most 10 % of the model resolves to a well" cannot hold
   while names are drawn over the rock, since the text alone covers 13.8 % at the bigger fit; the check
   holds what the finding was about instead (nothing outside a name's text, and the padding adds 10 % or
   less).
3. **Gas was "about two hundred times the liquids'".** Interval-weighted over the 110 report dates the
   field's gas is 161.6 times the liquids and 217.6 times the oil (`python3` over
   `data/model.json`'s `summary.field`, run in this pass). About, NOTES.md and ART.md now say "about 220
   times the oil's" (NOTES and ART add "218 over the run").
4. **The Cut's tick was a bare `40 000`.** It now prints `40 000 Sm³/d` (US `250 000 bbl/d`, U+202F
   both), and About quotes it with the unit. shoot at 320 and 390 px in both systems: the label is 57.6 px
   (SI) and 59.5 px (US) wide, the tallest column under it tops out at 12.3 to 16.2 px, below the label's
   foot at 11, and no column ink in its box.
5. **The card hid its Zoom key and sliced a row.** The Zoom key sits under the figure's line; only the
   rows scroll; `fitCardRows()` ends them on a row's edge at 55 % of the plate (sheet closed or focus
   mode) or half of it, with a 1 px `--line-strong` rule at their foot when more follow
   (`screenshots/cell-*.png`: the rows end at `Porosity`, whole).
6. **Focus mode on its side left a 45 px column.** `body.focus` (and `body.focus:has(.sheet.s0)`, which
   outranks the strip's rule) is one column on a wide screen and on a phone on its side; it also covers the
   340 / 380 px column a raised sheet would have left. shoot at 844 × 390 in focus mode: `"844px"`, the
   plate 844 of 844 px wide.

**Nits.** Fixed: the thumb grows under the finger and shrinks on the lift (`onStart` / `onEnd` mark the
track dirty); the well card dates a rate `Water injected in the month to 1 Jul 2004` and the gap case
`no rate reported for the month to …`; the caption reads `On the track, the month to 1 Dec 2006: oil
7 361 Sm³/d (ink), water 16 251 Sm³/d (tint), 69 % water cut.` (shoot's longest-line fit passes at every
width, both systems); the tapped cell has a 14 px `--ink` ring on a `--plate-halo` outline on the names'
layer, kept out of the card; the chart's top labels carry a 3 px `--page` halo and the cursor is drawn
under them; each word group (the properties, the explode modes) is one tab stop with a roving tabindex,
the arrows moving inside it; `#wellkey` is `role="group"`. Not changed: rotate keys (WCAG 2.5.1 for the
orbit and pan) are a family-wide decision, as the reviewer says; ART.md's build history (its "After QA"
and now a short "After review") is the lead's family-wide call, as for Global Weather, Milky Way and
Besseggen; the full record is here.

**The camera.** Every HOUSE 7.4 string is unchanged with its role. `frameNorne()` still taps `Show the
whole field` and waits 2 s; the field it frames sits left of the key column at 84 % of the plate's width
(81 % before, measured by the reviewer, part of it under the keys), centered on the plate's height. In
Snuggery's full screen, where the clip records, the plate grows taller and a fitted camera refits to it
(not measured on a phone). The stills 17 and the README pair are the lead's to re-capture.

**Phone checks added** (the reviewer's list; headless numbers are SwiftShader trends, never phone
evidence): frame time while orbiting with names on (labels read layout per frame: `keepOut`'s four
`getBoundingClientRect` calls, formation labels' `offsetWidth`) and while playing exploded by formations;
play with a value filter on (a face rebuild and a full `bufferData` per date); memory after five minutes
(19.5 MB of frames plus vertex buffers up to about 12 MB); the refit on a turn of the phone and on
entering Snuggery's full screen, upright and on its side, iOS 18 and 26; the ghost key and Snuggery's
exit control both reachable in focus mode; the tapped cell's ring and the names' halo in WebKit.

**Verified after review**, run from `Template/norne-reservoir/`:

- `node tools/check.mjs`: all checks pass. App code 152 665 B (app.js 89 164), fonts 40 075 B, ZIP
  15 360 541 B against the 19 110 591 B cap; the seven data files byte-identical to the pins; every camera
  string with its role.
- `node tools/test_decode.mjs`: all checks pass.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: all checks pass, exit 0, both themes with the
  scrub (0 frames whose texture, label or value differ from the date drawn at 2, 8 and 20 dates a second);
  the framing, tap and scale checks above; `screenshots/app.png` untouched. Headless SwiftShader times are
  trends, never phone evidence.
- `python3 norne-reservoir/tools/art/palette.py` (from `Template/`): ALL CHECKS PASS, exit 0.
- Not run: the new checks against the code before this pass (there is no copy of it outside version
  control here); the reviewer's drive measured the old behavior they replace.

## The follow-up (2026-10-01)

One builder, after the final review passed the pass, on the lead's four items: the final reviewer's
should on the card, `ART.md` corrected to the code, the record moved out of the shipped `ART.md`, and
the tools run until they pass. Every figure names the command that printed it, run from
`Template/norne-reservoir/`; headless Chromium with SwiftShader is never phone evidence.

**1. The card on a short plate** (the final reviewer's should). With the controls sheet at its first
or second stop the plate is 200 px tall at 390 × 844 and the keys run as a row along its top; the
card, 149 px with one row, covered the tapped point and the key row. The new checks in
`tools/shoot.mjs` were first run against a copy of the app holding the code from before this follow-up
(`app.js`, `style.css` and `index.html` as the pass left them; the wells check left out, since that
code has no `wellScreen`), where they failed at every stop, in focus mode and on a phone on its
side (7 FAIL lines), for example `FAIL sheet at its first stop, plate 390 × 200: … (36, 96) full, over
the tap, ring hidden, over a key` and, with the sheet closed, `FAIL sheet closed, plate 390 × 480: …
(57, 252) over the tap, ring hidden`: a tap halfway down the field fell under the full card at its
top-left and at its bottom-left alike.

What changed:

- `app.js`: `placeCard()` rewritten, `fitCardRows()` folded into it. The card goes to a corner of the
  room the keys and the ghost key leave, 6 px clear of their hits, never within 10 px of the
  selection's mark (`markBox()`: the cell's middle, the finger's spot at the moment of the tap, or a
  well's head with its name over it); the corners in the house's order, top-left, bottom-left, then
  the right-hand side, top or bottom, the first that holds the whole card, else the tallest. The form
  follows the plate: full where it sits beside a cell's mark wherever the mark falls in the left-hand
  column, else compact. What scrolls ends on a row's edge, measured in fractional px (a rounded
  `offsetHeight` let a card filling its room reach 1 px into the mark's margin), with the
  `--line-strong` rule at its foot. The card is placed afresh when the plate changes size (the
  stops, focus mode, a turn of the phone) and checked, staying where it is while it fits, after a
  step, new units or a new property, a turn, a pan, a pinch, the wheel or a flight. `keepOut()` reads
  layout boxes: `getBoundingClientRect()` included the card's 4 px entrance rise, and the ring, kept
  4 px off the card, hid itself under it and was not placed again. The ring now hides only when its
  middle is under the card or a key. The chosen well's name, always drawn, goes under its head when
  the card or the keys hold the place over it. The test hook gains `wellScreen(name)`, beside
  `cellScreen`; nothing in the app calls it.
- `index.html`: the card's figure, its line and its rows wrapped in `#readout-body` (the first two in
  `.readout-head`), the Zoom key after them. Both wrappers are `display: contents` in the full form,
  whose flex `order` keeps Zoom under the figure's line, so the full card looks as it did
  (`tools/.work/shots/cell-light.png` against the run before the follow-up).
- `style.css`: `.readout.compact`, a grid: the place line, Zoom and Close on one 24 px row, their 44 px
  hits reaching 4 px over it and 12 px into the body and raised over it; the body scrolling as one;
  `.readout-body.more` carries the foot rule as `.readout-all.more` does. `.readout.right`. The
  `.low`, `.keys-row` and `.focus` top rules gone: `placeCard()` sets the top.
- `tools/shoot.mjs`: the section `== the card at every stop`: a 3 × 3 grid of taps over the field at
  each stop and in focus mode upright (light), and on a phone on its side with the sheet closed,
  raised and in focus mode (dark), each checked for the form the plate calls for, the tap and its ring
  clear of the card, every key and the ghost key clear, the card inside the plate, Close and Zoom
  reachable (`elementFromPoint` at their middles), no row sliced, and the 1 px `--line-strong` rule at
  the foot wherever more follow; every well in the list, chosen there at the first stop, its head and
  drawn name clear; the hits with a compact card open; a step leaving the card in place; and a card
  carried from the closed stop to both raised ones.

Measured in headless Chromium at 390 × 844 with a throwaway probe (29 taps down the field at the first
stop): the compact card is 58.19 px at its tightest, the place line and the figure's line with the foot
rule (most taps in the middle of the field), 82.05 px with one row and 99.94 px with two (the cap,
half the plate). Two rows are what a tap near the field's top or bottom edge leaves room for; in the
middle, the rows wait behind the card's own scroll.

**2. `ART.md` corrected to the code.** The Cut's scale (`40 000 Sm³/d`, `250 000 bbl/d`, the label's
width and the columns under it, from shoot's own lines at 320 and 390 px); the track's width (230 px
at 390, where it said about 226); the thumb's sizes; the spoken figures (`7361`, `16251`, `35735`:
`spokenUnits()` drops the group spaces) and when the Cut's description is written (at boot and on a
change of units); `config.json`'s old shape still read; `js/track.js` reading `--cut`; the plate's 480
and 601 px and the page as a grid (`minmax(200px, 1fr)`), not flex; the keys' row below 258 px of
plate; the rates chart's top labels (the field's `50 000 Sm³/d` and `10 000 000 Sm³/d`, on a `--page`
halo, the cursor under them); the review's nits as built (the roving tab stop, the wells key a named
group, the thumb growing under the finger, the ring); focus mode one column on its side; the card's
placement and compact form (a new paragraph after the section 3 table, which names the compact form's
width as a stated departure from HOUSE 4.7's 280 px); section 5 as the camera reads the app now (the
lead's camera changes and comments are done: `waitForNorne()` calls `showControlsIfHidden()`, clip 2
matches `Pressure` and `Oil` by label, the hint is no longer waited out); the stock app's state no
longer called "today"; the code's figures as built. The quoted `no rate reported on 6 Nov 1997` was in
the "After QA" note, which moved with its section; the card's row in section 3 already quotes the
code's `no rate reported for the month to 6 Nov 1997`.

**3. The record out of the shipped `ART.md`** (moved below, word for word): section 8, the change list
with the bugs on record (B1 to B11); section 9, the owner calls as they stood and the phone checks;
the notes "After QA" and "After review"; and section 6's code ledger. The lead's brief named the two
notes and asked that `ART.md` keep only the rules, the math and the look as built; HOUSE.md's "What
ships and what does not" names the owner calls as they stood, the change list and the phone checks as
the record too, so they moved with the notes, a call the lead may reverse by moving them back.
`ART.md`'s references followed: its introduction says the owner calls and B1 to B11 are listed here,
the "(section 8, step …)" references went, and its last lines point here. The headers of
`tools/check.mjs`, `tools/test_decode.mjs` and `tools/shoot.mjs`, which named "ART.md change list 19,
20, 21", and `app.js`'s note on the retired hint key now name this file. `NOTES.md`: the code's budget
figure (about 162 000 B) and a line on the card in the code map.

**Verified after the follow-up**, run from `Template/norne-reservoir/`:

- `node tools/check.mjs`: all checks pass (44 ok). App code 161 833 B (`app.js` 96 282, `style.css`
  28 448, `index.html` 15 651), 38 167 B under the cap; fonts 40 075 B; the ZIP 15 354 792 B against the
  19 110 591 B cap, 19 files (`*.md` stored 30 553 B, against 39 537 B before the record moved); the
  seven data files byte-identical to their pins; every camera string with its role.
- `node tools/test_decode.mjs`: all checks pass (17 ok).
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: all checks pass, exit 0 (130 ok, 3:37), both themes with the scrub, the new section included (every stop 8 taps, focus mode 6, on its side 7, 6 and 7; 31 wells; the compact card's 25 controls at 44 × 44 or more); `screenshots/*-{light,dark}.png` written (ten), `screenshots/app.png` untouched.
- Not run: anything on a phone.

**Left open.**

- The cut's line on a phone on its side with the sheet raised (a 504 px plate column at 844 × 390) is
  cut off at its end (`… 20 % water c`): the landscape caption sets it on one line with
  `overflow: hidden`, and shoot's widths check runs on its side only with the sheet closed. Outside
  this follow-up's items; seen in `tools/.work/shots/card-side.png`.
- In the camera's code (the lead's files): `waitForNorne()`'s doc comment still says `#prop-name`
  ships as an em dash and `setProperty()` writes it, and the README panes' comment puts the property
  words "in the sheet's first row"; the legend's title is empty in `index.html` until `drawLegend()`
  writes it, and the words are the header's row.
- `placeLabels()` toggles a well label's `sel` class only on the labels it shows, so a hidden label
  can keep it after another well is chosen; nothing shows it, and shoot finds a well's name by its
  text.

**Phone checks added** (none claimed): the compact card in Snuggery's web view, its Close and Zoom hits
over its edges, the body's scroll by finger (`overscroll-behavior: contain`), VoiceOver reading rows
scrolled out of view; the card's place at the raised stops with the phone's own insets, upright and on
its side; a chosen well's name under its head.

## From ART.md, moved here word for word (the follow-up, 2026-10-01)

`ART.md` ships in the ZIP, so it keeps only the rules, the math and the look as built (HOUSE.md, "What
ships and what does not"). These parts of it were the plan and the record of the pass, and are kept
here as `ART.md` had them before the follow-up, the text unchanged and the headings one level down:
section 8, the change list with the bugs on record (B1 to B11); section 9, the owner calls as they
stood and the phone checks; the notes "After QA" and "After review"; and section 6's code ledger. They
speak as they were written: "this pass", "today" and "the builder" are the pass before it was built,
and their figures are the ones measured then. Since then the well card's gap line reads `no rate
reported for the month to 6 Nov 1997` (the review's nit), where "After QA" quotes `no rate reported
on 6 Nov 1997`, and the code is 161 833 B, where the ledger's note says 142 675 B after QA.

### From section 6: the code ledger and its as-built note

**The code ledger** (estimates; the builder measures after every step, `check.mjs` prints the truth):

| Change | Bytes |
| --- | --: |
| Freed: the stock stylesheet's glass, pills, gradient underline, loading overlay, hint, compass and scale on the plate, round buttons, checkboxes in the accent | −4 000 |
| Freed: the overlay, the hint and their wiring; `Reset view`; the explode `select`; the credit paragraph | −1 500 |
| Added: `js/units.js` (numbers, units, both systems, dates, spans, spoken forms; the stock `fmt`, `fmtProp`, `fmtDate`, `fmtRate` move in) | +3 500 |
| Added: `js/data.js` (pure: the frame decode, `cellValue`, `fillValues`, `propRange`, `norm`, the open ends, the Cut's series; moved from `app.js`, so mostly net zero) | +1 500 |
| Added: `js/track.js` (Global Weather's 6 695 B adapted: no per-step ticks, year ticks, the Cut) | +7 500 |
| Added: the house stylesheet for this app | +5 000 |
| Added: the player (wanted and shown, play on the clock, the step keys, the time row and lead, the live sentences) | +2 500 |
| Added: the caption band (legend with open ends and named swatches, the instrument line moved, the wells key, the caption, the credit) | +3 000 |
| Added: About, the stamp's count, notices, the card in place, labels on halos and their exclusions, the key column, focus mode, the units key, the wells' dash, the face wait | +11 000 |
| Added: `index.html` restructured | +2 500 |

About **110 000 B** after the pass, 90 000 B under the cap; no trims are needed, and none is planned. **As built: 142 044 B, 142 675 B after QA** (`node tools/check.mjs`; before QA app.js 79 420, after 80 051; style.css 25 951, index.html 15 259, js/track.js 7 802, js/units.js 7 225, js/data.js 6 387), 57 956 B under the cap; the estimate missed the test hook, the card's in-place rows and the chart rebuilt as DOM.
Fonts 40 075 B. The ZIP gains the face (37 834 B zipped, HOUSE 2.2), `ART.md` itself (root `*.md`
files ship: 81 818 B, 31 959 B zipped alone by `zip -q -X OUT ART.md`, as this pass wrote it) and the
code's growth: about 15.34 MB against the 19.11 MB cap, 3.8 MB of headroom. As built: 15 354 881 B (`node tools/check.mjs`); after QA, `tools/DECISIONS.md` has the figure, since this file's own bytes move it.

### 8. The change list (the builder applies these in order)

Nothing in `data/`, `pipeline/`, `scripts/` or `screenshots/app.png` changes. This pass writes no
pipeline file: the app's text that the pipeline generates is `model.json`'s `source` sentence, which
is US English and stays verbatim. `config.json` is the app's settings file, written by hand, and
this pass writes its color fields and words (step 3). Before step 1, record the hashes of section 6;
`check.mjs` pins them.

**The bugs on record and found here, which this pass must fix.** Plan 0009 item 5 records one for
this app; the device matrix (row 149) and plan 0008 D8 record a second; `docs/review/` records none
(`grep -rn -i norne docs/review/` finds nothing); the app has no `DECISIONS.md`, and `NOTES.md`
records none open. Reading the app as a stranger found the rest. Each is a must, and each names its
evidence:

- **B1. The color scale collides with the date and the property name when the sheet is fully
  raised** (plan 0009 item 5, seen in the owner's recording). Reproduced by
  `PLAYWRIGHT_MODULE=… node tools/.work/bug.mjs`, which emulates the phone's insets (59 px top,
  34 px bottom; 20 and 0 on a 375 x 667 phone) because headless Chromium has none: at 390 x 844 with
  the sheet at its top stop the legend spans x 354 to 378, y 74 to 280, over the date (y 69 to 99)
  and the property name (y 102 to 120); at 393 x 852 and 375 x 667 the same (`overDate: true,
  overProp: true` on all three; `tools/.work/look/bug-390x844.png`). Cause: `#legend` is centered on
  the plate's height while the header grows by the top inset. Fixed by items 7 and 11 (the legend
  leaves the plate for the caption band); `shoot.mjs` asserts no overlap between the legend, the
  header and the player at all three sheet stops, with the same emulated insets.
- **B2. Snuggery's full-screen exit control sits over the date on iOS 18** (matrix row 149; plan 0008
  D8: "over Norne's 'Nov 1997'"). The date leaves the header for the player (item 10); in focus mode
  the ghost key takes that corner, which is HOUSE 7.4's phone check.
- **B3. The header and its well key are drawn over the model**, since `#head` is laid over the
  plate: `Shut` over the grid in `tools/.work/look/bug-390x844.png`. Item 7 (the header is a band).
- **B4. VoiceOver speaks every step of play twice**: `#date` and `#inspect` both carry
  `aria-live="polite"` (`index.html` lines 22 and 35), and `setFrame()` rewrites both on every step.
  Item 10 and item 12 (one live region, sentences only on a key or a tap).
- **B5. Scales clip without saying so, and numbers break SI**: pressure is drawn 200 to 450 bar while
  cells span 56.4 to 612.5 bar (1 719 outside on 1 Nov 2005), gas to 0.922 against 0.90, 13 and 106
  permeability cells beyond their ends (`python3 tools/.work/ranges.py`); thousands print with commas
  (`2,763 m` in the card, `toLocaleString('en-US')`), the chart's scales print `50 k` and `10 M`,
  and the card abbreviates (`Oil sat.`, `NTG`, `Perm X`). Items 4, 11 and 12.
- **B6. Controls under 44 x 44**: the property chips (36 px tall), Play and the frame button (40),
  the grip (22), the date slider (28), the checkboxes (17), the well labels (21), the selects (27)
  (`look.mjs`'s `small` list). Items 7 to 15; `shoot.mjs` counts.
- **B7. The dark theme is not printed**: the zero end of every scale is near-white in both themes, so
  in dark the model is a pale block on a near-black stage (`tools/.work/look/dark-0-open.png`). Items
  3 and 9.
- **B8. A well's role is color alone, in the scales' own hues**: the producer's `#2E9E5B` on the oil
  scale's greens. Items 3 and 9 (cores lighter than every data end on a casing; injectors dashed; a
  shut well thin).
- **B9. Two category views cannot be read**: `Regions` paints 16 unlabeled colors and `Layers` 22
  (`tools/.work/look/light-7-Regions.png`). Items 3 and 11 (owner call 4).
- **B10. The well picker builds its options from data names as markup**
  (`sel.innerHTML = … ${n} …`, `app.js` line 828), and the legend's swatches and the well key set
  `style` from `config.json` strings in markup. Items 12 and 14 (DOM nodes, or every value escaped;
  HOUSE 7.1 item 13: no new uses, five today, `grep -n innerHTML app.js | grep -v "= ''"`).
- **B11. The render loop never rests**: `loop()` requests a frame every display frame even when
  nothing is dirty (`app.js` lines 111 and 481). Item 15 (and a phone check for idle power).

**The steps:**

1. **`.gitignore`**: ignores `tools/.work/` and `tools/node_modules/` beside `dist/` (done by this art
   pass; `pipeline/work/` and `__pycache__/` were there).
2. **`fonts/`** (new): copy `../global-weather/fonts/ysabeau-office-gw.woff2` and
   `../global-weather/fonts/OFL.txt` byte for byte (`cmp` both). No supplement.
3. **`config.json`**: `colormaps`, `colormapsDark` and `wellColors` replaced by `python3
   norne-reservoir/tools/art/palette.py --json`'s blocks, pasted (the `chart` block goes to
   `style.css`, step 8); each property's `colormap` renamed to the new scale (`oil`, `water`, `gas`,
   `pressure`, `rock` for PORO, PERMX and PERMZ, `sand` for NTG, `depth`, `formations`, `segments`,
   `layers`); `short` written in full (`Permeability`, `Vertical permeability`, `Net to gross`,
   `Segments`); the `FIPNUM` entry replaced by `{ "key": "SEGMENT", "label": "Fault segment",
   "short": "Segments", "type": "category", "colormap": "segments" }` (owner call 4); `LAYER` made
   a sequence (`range` `[1, 22]`, `decimals` 0, `colormap` `layers`, no `type`); the two explode gap
   keys renamed to US spelling (`formationGapMeters`, `layerGapMeters`), and the app reads the old
   names too, so a person's own edited copy keeps working; `wellColors.outline` stays `#0f1c23`.
   Nothing else in the file changes (ranges, decimals, zones, playback rate, well width).
4. **`js/units.js`** (new), the one writer of numbers, units and dates, on Global Weather's pattern:
   U+2212 for negatives (never −0); U+202F between number and unit and in thousands from four digits
   (`2 763 m`, `7 361 Sm³/d`, `1 000 mD`; years, report dates, cell indices, well names never
   grouped); saturations and net to gross to two decimals, porosity three, pressure whole bar or psi,
   depth whole meters or feet, permeability whole above 10 mD and one decimal below (two below 1),
   rates whole Sm³/d, bbl/d or Mscf/d; the two systems' constants (1 bar = 14.5038 psi, 1 m = 3.28084
   ft, 1 Sm³ = 6.28981 bbl, 1 Sm³ = 0.0353147 Mscf; About says standard conditions differ slightly
   between the two and the conversion ignores it); dates `1 Dec 2006`, `Nov 1997`; the lead's spans
   (`25 days`, `9.1 years`); the vertical factor `×5`; the scale bar's `3 km`, `750 m`, `2 mi`,
   `2 000 ft`; the spoken forms (`1 December 2006`, `standard cubic meters a day`, `bar`, `meters`,
   `percent`). `toFixed` and `toLocaleString` appear nowhere else but the allow-list `check.mjs`
   names.
5. **`js/data.js`** (new, pure, no DOM, no WebGL): `fillValues`, `cellValue`, `propRange`, `norm`,
   `denorm`, the segment of a cell (from FIPNUM, as `segmentOf()` today), the open ends of each
   scale (pressure from `dynamic.pressureRange`, the static properties from `static.ranges`, gas
   from one pass over the frames' bytes at boot), and the Cut's series (per report date: oil, water,
   liquid, the water share, the interval's days). `app.js` imports it; `tools/test_decode.mjs` tests
   it.
6. **`js/track.js`** (new): Global Weather's track adapted (sections 1 and 3): 110 steps on a linear
   day axis, the Cut, year ticks and labels, the scale tick, the thumb, the keys (Page Up and Page Down
   twelve), `role="slider"` with `aria-valuetext` and the Cut's description; drawn into a cached
   canvas per size, theme and unit system, the thumb on top.
7. **`index.html`**: `lang="en-US"`; the viewport without `user-scalable=no`; `<meta
   name="color-scheme" content="light dark">`; two `theme-color` metas carrying each theme's `--page`;
   the column: the header (`h1` `Norne Reservoir`, the stamp button, the units key, the row of words
   as an empty `radiogroup` the app fills); the plate (the canvas with its description in US English
   naming the gestures, the labels layer, the key column, the card, the notice, the ghost key); the
   caption band (the stamp's focus-mode slot, the legend, the instrument line, the wells key, the
   caption, the credit); the player (the time row, the transport, the track); the controls sheet
   (the grip and its three stops); About as a dialog; the live region; the Cut's hidden description.
   No `Oil saturation` anywhere in the file. The stock `#head`, `#legend`, `#gauge`, `#fit`, `#hint`,
   `#loading`, the `select` for the explode mode, `#reset-view` and `#credit` go.
8. **`style.css`**: rewritten as the house stylesheet for this app: the 3.1 tokens in both themes
   and `color-scheme`, `html, body { background: var(--page) }`, `--face` only, the one
   `@font-face`, this app's tokens (section 2), the column frame, header, the row of words and its
   tracer, key column and states, the caption band, player, track, card, labels on halos, the sheet
   and its grip, sliders, toggle rows, words with the tracer, the chart's classes, About, notices,
   the ghost key, landscape at `(orientation: landscape) and (max-height: 500px)` (replacing the
   stock 479 px rule), the wide column at `(min-width: 820px) and (min-height: 480px)`, gutters 20 px
   from 700 px, `@media (prefers-reduced-motion: reduce)` zeroing every duration, `@media (hover:
   hover)` hovers, `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` on
   controls. No `box-shadow`, `backdrop-filter`, `text-shadow` (but item 9's fallback, if needed),
   `transition: all`, uppercase or letter-spacing; `.valid, .lead, .track, .track canvas` carry
   `transition: none; animation: none`.
9. **`app.js`, the plate**: the clear color from `--plate`; the LUTs per theme (`colormapsDark` in
   the dark theme when present, else `colormaps`), the cache keyed by theme, and a scheme change
   recoloring once; the wells' dash and the shut well's weight (`WELL_VS` gains a per-vertex
   distance along the path, the fragment shader the dash, section 3); labels restyled on halos with
   44 px hits, measured after the face loads, kept out of the card's, the key column's and the ghost
   key's rectangles; formation labels likewise; `fillValues` and its kin imported from `js/data.js`.
10. **`app.js`, the player**: `wanted` and `shown`, the frame drawing the newest wanted step and
    then writing the time row, the lead, the caption, the card's dynamic rows, the chart's cursor and
    `aria-valuenow` from `shown`; play on the clock at `playbackFramesPerSecond`, stopping at
    the last step; About, a touch on the track and hidden stop it; the step keys with their live
    sentence; the Play key's two marks toggled by attribute; `aria-live` off the date (B4); a counter
    of color passes and face rebuilds in the test hook.
11. **`app.js`, the caption band**: the legend (the title from `config.json`, the bar from the same
    LUT, round ticks through `units.js`, open ends from `js/data.js`, the unit after the last label;
    named swatches for `Formations` and `Segments`, without Not; the layer bar's formation ticks)
    (B1, B5, B9); `updateGauge()` writing into the instrument line; the wells key while `Wells` is
    on; the caption's two fixed lines; the credit constant `CREDIT` (owner call 6).
12. **`app.js`, the card**: the house card (section 3), its rows written once per selection and their
    values updated in place per step; every value through `units.js` and set with `textContent`; the
    placement rule (top-left, or bottom-left over a tapped point under the card); the tap's live
    sentence once (B4); `Zoom to cell` and `Zoom to well` as text keys; the well picker's options as
    DOM nodes (B10).
13. **`app.js`, the header and the key column**: the row of words from `config.json` (`role="radio"`,
    the tracer, the divider after the dynamic four; the stock per-chip gradient goes); the units key
    (owner call 5) cycling `SI` and `US`, remembered as `norne-viewer:v1:units`, redrawing the
    legend, the instrument line, the caption, the card, the chart and the track; the stamp's count
    and its About; `Zoom in`, `Zoom out`, `Show the whole field`, `Wells`, `Hide the controls`.
14. **`app.js`, focus mode, About, notices, the sheet**: focus mode as section 3 says, remembered and
    restored before the first draw, Escape when About is closed; About built at boot from
    `model.json`'s `source` and the data's own figures; notices in the file's terms (`fail()`
    rewritten; a broken `config.json` keeps the settings already loaded and says so once); the sheet's
    three stops with the explode words, the chart restyled (section 3) with its innerHTML builds
    escaping every value they touch or rebuilt as DOM, the section rows, the toggle rows,
    `Show all cells`; `Reset view` removed (owner call 9).
15. **`app.js`, the loop and the hook**: the render loop requests a frame only while a dirty flag is
    set or a fly is running (B11); `visibilitychange` to hidden stops play; a return re-reads
    `config.json` (as today) and redraws; `flyTo` on `--draw`'s curve, ended at its destination by
    any touch; `window.__norne`, inert, nothing in the app calling it: `stats()` (the counters),
    `wanted()`, `shown()`, `pick(x, y)`, `cell(a, frame)`, `cut()`, `focus()`, `setFrame(f)`,
    `setProp(key)`.
16. **Words, everywhere shipped** (`index.html`, `app.js`, `js/*.js`, `config.json`, `NOTES.md`,
    `ART.md`): US spelling, comments and identifiers included, except the data's own words (the cell
    connections file's name and its `model.json` key, which the code must keep reading, and
    `ATTRIBUTION.txt`'s British spellings, data), allow-listed in `check.mjs` by file and word; no
    em dash, middle dot, arrow or `...` in a visible string; abbreviations written out (`Oil
    saturation`, `Net to gross`, `Horizontal permeability`); the canvas's description in full
    sentences.
17. **`NOTES.md`**: US spelling throughout (the stock file carries eleven British forms, the
    `tools/.work/` grep); the folder list (`fonts/`, `js/`, `tools/`); the code map
    (`js/units.js`, `js/data.js`, `js/track.js`); the Cut, what it computes; the plate printed
    twice and where the colors live (`config.json`, written from `tools/art/palette.py`); focus
    mode; the units key; the camera-free gestures; the budgets re-measured; the font's credit line
    word for word. The data sections, the check against the reference and the rebuild steps are
    unchanged.
18. **`miniapp.json`**: the name unchanged; `version` `2.1`; the description may name the water cut
    (at most 200 characters), the lead's choice.
19. **`tools/check.mjs`** (new, Global Weather's pattern; every item of HOUSE 7.1): the ZIP's limits;
    no scheme address in shipped `.html`, `.css`, `.js` (the scheme-bearing addresses in `NOTES.md`
    and `ATTRIBUTION.txt` are not scanned, as Global Weather's check does not scan `.md`); references
    relative and present; the folder contract (`fonts/` exactly the two house files; `data/` exactly
    the seven files; `js/` exactly the three modules); the face's and `OFL.txt`'s sha256; the seven
    data hashes; `miniapp.json`; the vendor-name list copied from `global-weather/tools/check.mjs`
    line 128 as it is (ROT13, never decoded); the credit constant word for word; the camera's strings
    of section 5 with their roles, and `Oil saturation` absent from `index.html`; `localStorage`:
    `norne-viewer:v1` still read with every field `restore()` reads today, `norne-viewer:v1:focus`
    and `norne-viewer:v1:units` added, `norne-viewer:v1:hint` listed as retired with owner call 8 as
    the reason; SI; nothing that carries a step transitions; `innerHTML` assignments not `= ''` no
    more than the five counted today and none new; the palette (`config.json`'s three blocks and
    `style.css`'s chart tokens equal `--json`, and the script exits 0); the tells and the house's three
    additions; the budgets (code ≤ 200 000 B, fonts ≤ 160 000 B, the ZIP ≤ 19 110 591 B, built as
    `build-zips.yml` builds it, with `index.html` at its top); US spelling with the allow-list.
20. **`tools/test_decode.mjs`** (new; no dependencies): `data/` decoded with formulas written in the
    test per `ATTRIBUTION.txt`'s formats (frame bytes, saturations /255, oil as the remainder,
    pressure over `pressureRange`), compared with `js/data.js` at the first, a middle and the last
    report date for a sample of cells; the open ends against the test's own scan (pressure 56.4 to
    612.5, gas 0.922, the permeability counts); the Cut's series against the test's own sums (the peak
    37 144 Sm³/d in the month to 1 Nov 2000, the crossover in the month to 1 Jul 2004, 69 % in the
    last month, 67.20 and 23.29 million Sm³ in all); `js/units.js`'s output for a table of values
    (negatives, thousands, years, dates, both systems, spoken forms).
21. **`tools/shoot.mjs`** (new; HOUSE 7.2 as the kind allows): boot (the camera's strings by role and
    name, `Oil saturation` absent before boot completes and present after, the credit, the face
    loaded); text contrast in both themes; the Cut's sampler (the ink's pixels against the page, 90 %
    of samples ≥ 3, the lowest printed; the water tint's pixels present where the series says) and
    the Cut's column heights against the script's own decode of `model.json` at five months (within 1
    device pixel); the caption's figures against the same decode; the legend's open ends at 1 Nov 2005
    on Pressure; the card's values against the script's own decode of `dynamic.bin` and `static.bin`
    at a tapped cell (through `__norne.pick`); SI in every visible text node; the scrub by real touch at
    2, 8 and 20 steps a second with 0 frames whose texture step differs from the label's, the
    color pass and face rebuild times printed; play (never backwards, the Play key's mark by computed
    style, About holding play, the expensive counter steady across a second of play between steps);
    the plate's height steady while the caption changes; the card clear of the tapped point; labels
    outside the card, keys and ghost key; the legend outside the header and the player at all three
    sheet stops with emulated insets (B1); focus mode (touch, Enter, Escape, the ghost key, a reload,
    the live sentences, hit targets, the plate's growth, `Oil saturation` still visible); the units
    key (SI first; psi, feet and bbl/d after one press); the grip's three names at their stops;
    hidden (the loop at rest); Reduce Motion (every animation 0 s, `Show the whole field` a cut, play
    in whole steps); broken data (a missing `dynamic.bin`, a short one, `model.json` not JSON, a
    broken `config.json` on a later read); widths 320, 360, 375, 844 x 390 and 125 % zoom; hit
    targets ≥ 44 x 44 in both modes; pictures to `tools/.work/shots/`, never `screenshots/app.png`,
    whose hash the run checks unchanged; load and frame times printed as headless figures.
22. **`tools/DECISIONS.md`** (new): the owner calls (section 9) as they settle, this change list,
    as-built notes and the review record.
23. **`ART.md`**: the builder corrects any figure here that the build measures differently, in place,
    and says so in `DECISIONS.md`.

### 9. Owner calls left open

1. **The signature is the Cut**, the field's liquid record with oil in ink and water stacked on it,
   over the alternatives section 1 names (the wells in ink, the oil left in the cells, a stipple on
   swept cells). A variant for later: the track following a selected producer (its own cut, its
   breakthrough) at its own printed scale; not in this pass, since a scale that changes with the
   selection needs its own design.
2. **The plate printed twice**: the dark theme becomes the print (dark rock, bright oil), the largest
   visible change of the pass. The alternative is one appearance in both themes (the stock way),
   which leaves the dark theme a pale block.
3. **The ten scales recolored** inside the band, their hue logic kept where it carried meaning (oil
   green, water blue, gas red, pressure magma-like, rock viridis-like), net to gross as sand and
   layers as a sequence; viridis and magma lose their yellow high ends in the light theme. Written
   into `config.json`, the person's settings file, which keeps reading the old shape.
4. **`Regions` (16 colors) becomes `Segments` (4, named)**, since a region is a formation by a
   segment (measured, section 2) and 16 colors cannot be told apart; the card still names the region.
   The alternative keeps `Regions` with a legend that says to tap a cell for its region.
5. **A units key**, `SI` then `US` (psi, feet, bbl/d, Mscf/d; permeability stays mD), for a reader in
   the US oil patch; about 2 000 B. The alternative is SI only, as Besseggen chose.
6. **The on-screen credit line**: `Data: Norne benchmark, Equinor and the Norne partners via the Open
   Porous Media initiative, ODbL 1.0`, with `model.json`'s 501-character `source` verbatim in About.
   ODbL asks that a user be made aware of the source and the license; the line does both.
7. **Focus mode keeps the legend, the instrument line and the wells key**, against Global Weather,
   which hides its legend's bar: a false-color model cannot be read without its scale, and the
   camera's `Oil saturation` wait then passes in focus mode too.
8. **The first-run hint goes**, and its key `norne-viewer:v1:hint` is retired: the gestures move to
   the canvas's description and About, and the zoom keys and `Show the whole field` give a way to move
   without a gesture.
9. **`Reset view` goes** as a duplicate of `Show the whole field`; the explode `select` becomes three
   words; the well picker stays a native `select`.
10. **The rates chart stays** in the sheet's middle stop: it repeats the Cut's oil and water for the
    field, and adds gas, injection and every well. The alternative drops it (about 3 000 B) and
    leaves the per-well rates to the card.
11. **The stamp's words**: `Norne benchmark, OPM Flow 2026.04 run`, the edition as the data names it.
12. **Page Up and Page Down move a year** (twelve steps) on the track, against the house's eight.

**Phone checks for the device matrix** (none claimed): frame time idle (the loop at rest), playing,
scrubbing the history by finger (the color pass and texture upload per step; with a value filter on,
the face rebuild per step), orbiting and pinching; memory after five minutes of play (26 MB of data
resident); background and return; the dark theme's print on an OLED screen; the wells' dash at the
6.9" screen's DPR; the labels' halo (`paint-order` on HTML text in WebKit); focus mode in Snuggery's
full screen with the ghost key and Snuggery's own exit control both reachable in the top-right corner
(iOS 18 and iOS 26; B2); VoiceOver on the track (the date, the lead and the month's cut; the Cut's
description), on a tap, on the property words, on the grip and in About; the phone on its side with
the sheet column; the safe areas of every band, and B1 with the sheet at its top stop; the camera's
`Oil saturation` wait and clip 2 end to end on the simulator, once the lead's two lookups are
changed, then the stills.

### After QA

QA's two findings, both fixed in `app.js` and both now held by `tools/shoot.mjs`, each check run once
against the old code first, where it failed:

1. **A well's card contradicted itself** (must). Open in a role the summary holds no rate series
   for, the card's figure fell back to `Shut` beside a `Now` row that said `Producing`: C-4H on
   6 Nov 1997 and F-4H on 1 Sep 2001, the only two such frames in this file. The figure now says what
   the well is doing, as the row does, and the line under it says `no rate reported on 6 Nov 1997`;
   `Shut` and `Not yet open` stay for a well that is. shoot walks every such frame in the file (and
   one rated frame) and fails if the figure and `Now` disagree.
2. **A failed load left the plate black** (should). The WebGL context is opaque (`alpha: false`) and
   its clear color is set from `--plate` only once the model is in, so a broken file showed its
   notice on black. The failure path now clears the plate to `--plate` and again when the theme
   changes. shoot samples the plate around the notice in every broken-data case, and in the first
   turns the theme to dark and back: 0.0 % of the plate was the ground before, all of it after.

### After review

The review's six shoulds are fixed; DECISIONS.md holds the record and the figures. The field is fitted
by its projected box and refitted as the plate changes (focus mode, the sheet's stops, the phone on its
side), with a lens shift so it sits in the room the keys leave. A name's tap is its own text padded to
24 px; its 44 px box grows upward and yields to any cell under the finger. Gas is about 220 times the
oil's volume (218 over the run), not two hundred times the liquids'. The Cut's tick prints its unit,
`40 000 Sm³/d`. The card's Zoom key sits under its figure and only its rows scroll, ending on a row's
edge. Focus mode on a wide plate is one column. Of the nits: the caption reads `On the track, the month
to …`, the well card dates a rate `in the month to`, the thumb grows under the finger, the tapped cell
has a ring, the chart's top labels carry a halo under which the cursor passes, each word group is one
tab stop, and the wells key is a named group.
