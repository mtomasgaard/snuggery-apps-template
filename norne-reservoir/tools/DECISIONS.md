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

## Plan 0012, package 3.4 (2026-10-06 and 07): the text cut, the view's share, the section, white

The template's plan 0012 (`docs/plans/0012-the-owners-brief-of-2026-10-06.md` in the Snuggery
repository; this app's change list is in `docs/plans/0012-change-lists.md`). The owner: *"Norne full
screen mode has too much text at the bottom, just above time slider. Also when expanding the bottom
section, the 3d view becomes too small … Maybe add a section view as an additional pane to the 3d"*;
D4: no Norne seismic can ship, so the section is the model's alone; D6: the ground goes white; D11:
model cells are blocks, never interpolated, and a later app (Volve) adds seismic along the same line
on the same depth axis. Version 2.1 → 2.2. Pictures: `tools/.work/p0012/` (before: `before/`, the
screenshots as the pass found them; the probes' and drives' pictures in `shots/`).

**Measured before** (`tools/.work/p0012/measure.mjs`, 390 x 844, DPR 2, touch, light; Chromium and
WebKit agree within 1 px): header 94 px, plate 480 with the sheet closed and **200 px at both raised
stops** (24 % of the screen; the brief's "about 270 px" was read off a picture), caption band 135,
player 90, sheet 45 closed and 325 raised.

**The change list, as built.**

1. *The stamp (F2).* `writeStamp()` now hides `#stamp-home` and shows `#btn-about`; the edition
   (`Norne benchmark, OPM Flow 2026.04 run`, from `model.json`'s `source`) is About's first *This data*
   row, `Edition`. The loading count and `The model could not be read.` stay, and `fail()` shows the
   line again. `shoot.mjs` holds it at one line, 16 px, in all three kinds of words it can hold.
2. *The About key (F2).* **A departure from the list's placement**: the list put the group in the units
   key's grid area (rows 1 and 2, beside the name). With the stamp's row gone those rows are 28 px, and
   the two keys' 44 px hits were cut to 33.25 px (`shoot.mjs`'s hit-target check, measured), while a
   44 px row there would have given the 22 px back. So `.hkeys` closes the row of words (row 3, a
   44 px row), the About key before the units key. The header is 72 px (94 before). The words' scroller
   is narrower by the two keys; `Pressure`, the camera's word, stays in view. The About key is hidden
   until the data is in and on an error, as the stamp was inert then. In focus mode it moves into the
   caption band, floated right on the legend's line, its hit over the legend (`z-index`), and back.
3. *The credit line (F1).* `#credits` and its write are gone; `CREDIT` is unchanged and written once,
   to `#about-credit-line`, About's first *Sources and credits* paragraph, before `#about-source` and the
   license line. `.credits` rules and the landscape `credits` area are gone.
4. *The cut's sentence becomes a key (F4; the lead's gate released 2026-10-06).* `#cutline`,
   `cutSentence()` and `.cutline` are gone; `#cutkey` holds `Oil lifted` (a `--cut` swatch), `Water
   lifted` (the tint, `color-mix` of `--cut` at `--cut-water-a` over `--page`, with the track's 1 px
   `--ink-3` top) and `on the track`, one 15 px line. The month's figures stay in the track's
   `aria-valuetext` and the rates chart. ART.md records the departure (section 1, test 3).
5. *What stays in the band:* the legend (`Oil saturation`, the camera's wait), the instrument line,
   the wells key, and the cut's key. 135 px → 90 px.
6. *The ground (F7).* `--page` and `--plate` `#ffffff` in light; `readTheme()`'s fallback `#ffffff`;
   the light `theme-color` `#ffffff`; `--plate-halo` white (it was `--sheet`'s `#f6f9fa`, near the old
   gray); `palette.py`'s light page, `GROUND['light']` and label halo `#ffffff`; `check.mjs`'s token
   table and `shoot.mjs`'s six `#e8eef0` constants follow. **The palette re-checked on white** (the
   brief: fix it if it fails, and say so). `python3 norne-reservoir/tools/art/palette.py` ends `ALL
   CHECKS PASS`; its `--json` is unchanged, so `config.json` did not move. The body off its ground, a
   salience-0 top face `#cbcec8`: dE 0.153, 1.59:1 on white (0.098, 1.36:1 on the gray). The scales'
   nothing end, measured where it is drawn (a new block in `palette.py`): lit at the brightest factor
   the shader reaches (0.950) it stands off white by dE 0.062 or more (1.19:1), where on the gray it
   was dE 0.007 to 0.014 (1.02:1); unshaded, as the legend and the section draw it, dE 0.027 to 0.039
   (1.06 to 1.08:1) on white against 0.030 to 0.044 on the gray. So nothing failed that the gray passed,
   but a pale cell's edge cannot be seen by color on either ground: the fix is in the section, a 1.5 px
   `--line-strong` rim under its cells (3.83:1 on white), and `palette.py` now checks that rim. The
   legend's bar keeps its frame.
7. *Prose (F5):* `ART.md` and `NOTES.md` say the credit is in About; `ART.md`'s focus-mode row, the
   band's rows, the frame, the palette figures, the type scale and the tells follow.
8. *Version (F6):* `2.2`; `check.mjs` item 6 pins it.

**Checks that followed the change (F8)**, beyond the list's lines: `shoot.mjs`'s tracer check counts
three chosen words (the properties, the section's lines, the explode); the plate's floor with the
sheet closed is 530 px (it was 460, under 480); the units-key check reads the track's value in words
where it read the cut's line; the widths check measures the cut's key, the section's key and its row
instead of the cut's longest line; About opens from the About key by the keyboard; a broken file shows
the stamp's line and hides the About key; the card scenes expect the full card at the raised stops
(the model is 405 px there now) and gain one with the section open and the sheet raised (245 px, the
compact card); "the card at every stop" takes 4 taps on the field or more where it took 6 (the shorter
plates leave fewer rows clear of the names). `check.mjs`: js/ holds four modules; the credit is
written once, to About, and nothing on the front carries one; the storage check reads `s.section`.

**(2) The view's share with the sheet raised.** Chosen: **cap how far the sheet rises** rather than
compact what sits between the view and the sheet, because that is the legend, the instruments and
the player, which the view cannot be read or moved without, and the text cut already took 45 px out of
the band. `body.raised` (set by `applyStop()`) gives the view's row `minmax(var(--view-min), 1fr)`,
`--view-min: max(200px, min(48dvh, 100dvh - 432px))`: about half of an 844 px screen, never under
200 px, and the sheet keeps about 180 px on a short phone. The sheet scrolls inside itself and its grip
is sticky at its top. Measured by `shoot.mjs` at 390 x 844: the model 547 px with the sheet closed,
405 px (48 %) at either raised stop (200 before), the sheet 187; with the section open, 387 + 160 and
245 + 160. The two raised stops are now the same height (the second stop adds *Cells and view* below,
reached by scrolling the sheet).

**(3) The section A–A′ (D4, D11).** ART.md section 3 describes it as built; the decisions behind it:

- *A pane under the model* (beside it on a wide screen or on its side), not a pane in the sheet: the
  brief's "an additional pane to the 3d", and it follows the player, which the sheet does not show.
- *The line's two presets come from the cells.* The first try, the principal axis through the cells'
  middle, left the field for its last third (the field is a SW–NE body with a northern lobe and an
  eastern arm), and its pane was mostly empty. Along is now the line that passes nearest the most
  grid columns, Across the line square to it that does; both are trimmed to what they cut. Words:
  `Along`, `Across`.
- *Drawing meets the reservoir, not a plane.* The first try mapped the finger onto a plane at the
  grid's top. In the oblique view that plane lies in front of the field, so a line drawn over the
  model landed south of it and cut nothing (WebKit drive: `6144 m, 0 cells`). The finger now follows
  its ray to the field's top, kept as a height field (`surfaces()`, 40 m a pixel, read bilinearly so
  the surface has no steps for a ray to catch), and the line is laid on that top on the model. A
  finger on the model's front wall meets the column whose wall it touches, and the line's end is drawn
  on that column's top, a few pixels above the finger: the wall's meaning, accepted. Measured: at the
  points on the model a touch can reach, the point a touch maps to lies within 150 m of the middle of
  the cell drawn there (cells are up to 160 m across), in 66 of 67 points in both engines, the farthest
  155 m; a line drawn between two such points ends 0.01 to 0.62 px from the finger (Chromium by touch
  0.02 and 0.01; WebKit by mouse 0.21 and 0.62).
- *The pane's height follows the section*, up to a cap, so a long flat section leaves the model the
  rest; it is fixed while a line is drawn or an end moved, because a refit under the finger moved the
  line 10 px from where it was drawn (measured before the lock).
- *Blocks, never samples (D11).* Each polygon is one cell in one color from the 3D view's own
  texture; nothing is blended. `tools/test_section.mjs` checks every polygon of 42 lines is its own
  cell's, inside the line and the cell's depth range, convex and with area; that a plane through a
  cell's middle cuts that cell and holds the middle (within 2.03 m where a face is warped and drawn as
  chords: 27 of 2 000 cells); and that no point of a section lies in two cells (0 of 8 000 in the last
  run, 2 in an earlier one with other points: slivers on shared edges). `shoot.mjs` checks the pane's
  pixels at the middles of the 30 widest cells on Across against its own decode of `dynamic.bin` and
  `config.json`'s scales: oil on two dates 30 of 30; pressure, water and the dark theme 29 of 30, the
  other the same cell each time (39961, I 8, J 69, K 19), whose middle lies under the formation name
  `Tofte` (`tools/.work/p0012/shots/probe-cell39961.png`).
- *Gaps.* The plane passing between active cells inside the model is hatched, found per pixel column
  between the shallowest and deepest cell, from every cell filled as one path (so neighbors leave no
  seam). The first build also stroked that path to close seams, and the stroke erased a real gap: Not,
  the shale in K 4 with no active cell, lies between Garn's base and Ile's top in all 2 263 columns,
  3.20 to 10.37 m thick (median 7.24; measured from `geometry.bin` with `node`), about 1.3 px at ×5
  along the field. Without the stroke it shows. `No active cell` joins the key only where 150 CSS px²
  or more show (Along: 1 497 device px, about 374 CSS px², so the key shows there too); the test's
  case is a line found by a search for inactive cells (−3337, −2360 to 663, −675), 925 CSS px²
  hatched.
- *Wells within 150 m* of the plane, projected square onto it: the cells are 70 to 160 m across, so
  150 m takes the wells completed in the cells the plane cuts and their neighbors.
- *Not applied in the section:* the explode, the I, J, K ranges and the value range. About says so.
- *Escape* turns Draw off before it leaves focus mode.
- **For Volve (D10, D11), the seams.** `js/section.js` keeps the axis and the layers apart:
  `sectionAxis(sec, box, exag, datum)` is the one scale, `X(s)` and `Y(z)` with z the model's depth
  less `datum` (`model.json`'s `center[2]`), so `Y(depth - datum)` places any depth in meters on it.
  `drawSection()` in `app.js` draws the layers in order (ground and guides; gaps; cells; tops; wells;
  the tapped cell; frame), each its own call. A seismic layer goes after the ground's guides, drawn
  from its own samples at its own depths through `ax.X` and `ax.Y`, with `drawCells(…, alpha)`'s alpha
  below 1 if the cells are to let it through, and the gap hatch left out where the seismic should
  show. The axis states one datum; D11 asks that the seismic's datum be stated and nothing be tied,
  so Volve's About says which datum each set uses.

**(4) White (D6):** item 6 above.

**Bugs on record, fixed as musts.**

- *A hidden well label kept its `sel` class* (the follow-up's left-open list): `placeLabels()` sets
  `sel` on every label before it decides whether the label shows.
- *The cut's line was cut off on a phone on its side with the sheet raised* (the same list): the
  line is gone; its key fits one line at every width `shoot.mjs` runs, in both unit systems.
- *The colour scale over the date and the property name with the sheet raised* (the clip reviewers,
  plan 0009 item 5; B1 here): fixed in 2.0's house pass, and `shoot.mjs`'s B1 check, with the phone's
  insets emulated, passes again at all three stops with 2.2's layout.
- *Found in this pass:* the card could reach up to 4 px past the room it was placed in when its rows
  were clipped, because the full form's foot rule carries a 4 px margin `placeCard()` did not count;
  with the section open in focus mode that put the card's edge on a tapped cell's ring (`shoot.mjs`,
  the card at every stop). Counted now.
- *Not fixable here:* matrix row 149's note that on iOS 18 Snuggery's exit arrows share the top-right
  band with a mini-app's controls (in focus mode, Norne's ghost key); the camera's stale comments
  (`waitForNorne()`'s note on `#prop-name`) are in the Snuggery repository, the lead's.

**The camera (HOUSE 7.4).** No string the camera reads changed: `Oil saturation` (the legend's title,
written last), `Pressure`, `Oil`, `Show the whole field`, `Play production history`, `Pause`, `Show
the controls`, the grip's three names. New names: `About`, `Section`, `Along`, `Across`, `Draw`,
`Hide the section`.

**Budgets.** App code is **216 746 B against its 200 000 B cap** (`app.js` 120 577, `js/section.js`
23 535, `style.css` 32 833, `index.html` 18 349, `js/track.js` 7 840, `js/units.js` 7 225,
`js/data.js` 6 387; 161 963 B at the start of the pass, so 2.2 adds 54 783 B, nearly all the
section). Nothing was cut to fit (the brief); the lead rules on the cap, and `check.mjs` keeps
failing that one line until then. Fonts 40 075 B of 160 000. The ZIP as `build-zips.yml` packs it is
15 378 349 B of its 19 110 591 B cap (15 354 835 at the start). `data/` is byte for byte as it was: the
section is code only.

**Owner calls left open (taste, each reversible).**

1. The About and units keys close the row of words (item 2 above), rather than sit beside the name.
2. `Section and view` in the sheet is renamed `Cells and view`, since a section now means A–A′.
3. The section's pane under the model upright, beside it on its side; its height following the
   section up to `clamp(170px, 26dvh, 230px)`.
4. The two raised stops the same height (the cap), the sheet scrolling.
5. Along and Across as defined (the most columns), their words; the wells' corridor at 150 m.
6. The line laid on the reservoir's top on the model, with a faint curtain to the base.
7. The section's cells unshaded (the legend's colors) with a rim, where the 3D view shades faces.
8. The focus-mode About key on the legend's line, at its right.

**Phone checks (none claimed; for the device matrix).** Drawing a line and moving its ends by
finger in Snuggery's web view (Playwright's WebKit has no touch drag, so WebKit drags were by mouse;
taps were by touch); the section's draw time per date during play (about 17 ms in headless Chromium
with SwiftShader, never phone evidence) and memory; the pane beside the model on its side and the
sticky grip; VoiceOver on the pane (its image description, the words, Draw); the white ground on the
phone's screen in both themes; the About key in Snuggery's full screen against its exit control on
iOS 18.

**Verified** (run from `Template/norne-reservoir/` on 2026-10-07, after the last change; headless
times are SwiftShader trends on the build Mac, never phone evidence):

- `node tools/check.mjs`: 44 ok, 1 FAIL, the code cap above (exit 1 for that line alone); the seven
  data files byte-identical to their pins; `palette.py` ALL CHECKS PASS; the credit written once, to
  About; nothing on the front carries a credit; the camera's strings with their roles; version 2.2.
- `node tools/test_decode.mjs`: all checks pass.
- `node tools/test_section.mjs` (new): all checks pass: 42 lines, 23 081 polygons; Along 8 513 m,
  2 061 cells; Across 3 686 m, 792 cells; a cut 2.6 ms on average in Node.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: all checks pass, exit 0, 160 ok, both
  themes; the section drawn in about 17 ms a draw; a scrub with it open at 8 and 20 dates a second,
  0 frames whose section is another date's; `screenshots/*-{light,dark}.png` written (two new:
  `section-light.png`, `section-dark.png`), `screenshots/app.png` untouched.
- `tools/.work/p0012/drive.mjs` in WebKit and Chromium, both themes, at 390 x 844 DPR 2 (taps by
  touch; drags by touch in Chromium and by mouse in WebKit): all ok, no console error.
- `python3 norne-reservoir/tools/art/palette.py` (from `Template/`): ALL CHECKS PASS.
- Not run: anything on a phone; `scripts/package.sh` (its URL scan now names `js/section.js`; it copies
  `js/` whole).

## Plan 0012, package 3.4, after QA and review (2026-10-07)

QA passed with one should (the code cap, the lead's) and a nit (HOUSE §4.15 and §5.2 still read Norne's
gate as pending). The review passed with six shoulds and six nits. Each, as taken:

1. **The pane kept its old height after a line was drawn or an end moved** (should). `SEC.lockH` was
   set on every drag step and cleared only by `setSection` and the line words. The plate's pointer
   `end()` now clears it and asks for a redraw once the finger lifts (and on the two-finger hand-back),
   so the pane fits the new section. `shoot.mjs` reads where the line lies under the finger *before*
   the lift (the plate refits after it), checks the lift keeps the line, and checks the plot's set
   height equals what the section needs (`__norne.secFit()`) after a drawn line and after A′ is moved:
   126 of 126 px, 263 of 263 px (shown under `--sec-h`).
2. **A line off the field was kept and printed a broken pane** (should). On the lift, a moved line is
   cut once; if it cuts no cell the line before it is restored, Draw stays on, and the live region
   says `That line misses the field.` While such a line is drawn the pane prints only `This line
   misses the field.` (no depth ticks, no gap key) and the plot's description says `…: the line misses
   the field, so no cell is cut.` `shoot.mjs` draws a line above the model by touch: 0 cells while
   drawn, refused on the lift, the line as it was (578 cells). The reviewer's `offfield.mjs`: the
   restored Along (2 061 cells), also after a reload.
3. **Focus mode with the section open: `400` ran into `≥ 450 bar` on Pressure** (should). The tick
   thinning is `thinTicks()`, run by `drawLegend()` and again by a `ResizeObserver` on
   `#legend-ticks`, so it re-measures after the band reflows round the About key. The reviewer's
   `legend2.mjs`: no overlap (`≤ 200 | 300 | ≥ 450 bar`). `shoot.mjs` now chooses Pressure before
   focus mode with the section open and checks the labels stand 5 px apart or more (63.8 px).
4. **The second stop looked like the first** (should). Taken as the review's first option, keeping
   owner call 4 (both raised stops one height): at stop 2 `applyStop()` scrolls the sheet so `Cells
   and view` sits under the sticky grip (smoothly; at once under Reduce Motion), and stop 1 and closed
   go back to the top. `shoot.mjs`: the heading 0 px under the grip at stop 2 with and without the
   section (the sheet scrolled 353 px); stop 1 at 0.
5. **Well names dropped silently in the section** (should). A well's name tries, in order, centered
   over its path's top, then beside the top on the right and on the left, then up to three 13 px rows
   lower on either side, with a 1 px `--ink-2` hairline to the path's top when it is set more than 6 px
   off; a well that finds no place is named in the key (`, unlabeled: …` after `Wells within 150 m`),
   so none is drawn unnamed. `__norne.section()` reports `named` and `unnamed`; `shoot.mjs` checks every
   drawn well is in one of the two and that the key lists the unnamed. The reviewer's `wells.mjs` on
   Along and Across at report dates 78 and 110: all named on the pane (Along 110: D-1CH, B-2H, D-4H,
   B-4DH, E-4AH; `tools/.work/review/shots/wells-*.png`).
6. **The code cap** (should, both): **221 794 B** now against 200 000 (`app.js` 125 390, `style.css`
   33 041, `js/section.js` 23 535, `index.html` 18 376, `js/track.js` 7 840, `js/units.js` 7 225,
   `js/data.js` 6 387); these fixes added 5 048 B to the 216 746 B the build reported. Nothing was cut;
   the lead rules, and `check.mjs` fails that line alone until then. The ZIP is 15 380 277 B of
   19 110 591.

**Nits.**

- *Ile never named* (taken): a formation's name now tries its left end, then the middle of its run, a
  quarter and three quarters along it, then its right end. Ile is named on Along and Across.
- *The words' row cut flush against the About key* (taken): `#props.more` fades its right 22 px with a
  mask while more words lie past it (set on scroll and by a `ResizeObserver`), so `Porosity` reads as
  scrolling on.
- *The section head lost 1 px of its hits to the plot on its side* (found in this pass, at 844 × 390,
  DPR 3: `Draw` and ✕ measured 43 px tall because Chromium's hit test gave the plot the head's last
  device pixel). `.sec-head` is `position: relative; z-index: 1`; 44 px again.
- *TVD on the depth axis and the datum* (declined): the depth words sit in a 46 px margin that
  `2 800 m TVD` does not fit, and About already says the depth is the model's true vertical depth.
  No datum is named anywhere in `data/` (`model.json` has `center`, no datum), so About cannot state
  one without inventing it; Volve (D11), which must state datums, will carry its own.
- *The model at 245 px with the section open and the sheet raised* (owner call, left): the model and
  the section keep 48 % together. Listed for the owner beside calls 3 and 4.
- *Records* (the lead's): matrix row 160 for 2.2's phone checks (the list above, under *Phone checks*,
  plus the section's pane fitting after a lift and the stop-2 scroll on the phone) and HOUSE §4.15 and
  §5.2's gate wording are outside this folder.
- *The A stub* (verified by the reviewer, `tools/.work/review/stub_node.mjs`): on Along the cut at s 0
  to 20 m holds only a deep sliver (z 24 to 56) and the top at s 0 to 30 m is 23 to 24, −22 at 60 m;
  Across alike. The line's drop at A is the cells' own geometry, not a fault.

**The camera.** No string the camera reads changed. New words on screen: `This line misses the
field.` (in the pane), `That line misses the field.` (spoken), `, unlabeled: …` (in the key, only when
needed).

**Verified** (from `Template/norne-reservoir/`, 2026-10-07, after the last change; headless figures
are SwiftShader trends, never phone evidence):

- `node tools/check.mjs`: 44 ok, 1 FAIL, the code cap (221 794 B); data byte-identical to the pins;
  palette ALL CHECKS PASS; version 2.2 (`tools/.work/p0012/check-fix.log`).
- `node tools/test_decode.mjs`, `node tools/test_section.mjs`: all checks pass.
- `python3 norne-reservoir/tools/art/palette.py` from `Template/`: ALL CHECKS PASS.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: exit 0, 166 ok, both themes
  (`tools/.work/p0012/shoot-fix-3.log`); `screenshots/*` rewritten.
- `tools/.work/fix/drive.mjs` (the reviewer's drive, its pictures to `tools/.work/fix/shots/`) in
  Chromium light and dark (CDP touch, drags by touch) and WebKit light (touch taps, mouse drags), 390 ×
  844 DPR 2: a drawn line refits the pane, an off-field line is refused (Draw left on), no console
  error. The reviewer's `legend2.mjs`, `offfield.mjs` and `wells.mjs` as above.
- `bash scripts/package.sh`: built (15 MB), then `dist/` removed.

### The lead's pass on plan 0012 3.4 (2026-10-06)

- **The code budget is 222 000 B,** ruled on the measured 221 794 B. The overage is the owner's section
  pane (its geometry, the drawn line, the presets and the refit) plus the review's fixes; nothing was cut.
- **ART.md's card passage** now says what 2.2 does: the plate keeps 405 px at both raised stops and
  the card is full there; the compact form is for a phone on its side. NOTES's frame line drops the cut's
  line, which no longer exists.
- **TVD on the axis:** the fixer's decline stands for Norne (a 46 px margin; About says true vertical
  depth). For Volve, where seismic and model share the axis (D11), the pane gets one axis title, "Depth,
  m TVD", instead of a word per tick.
- **Left as an owner call:** with the section open and the sheet raised, the model keeps 245 px; the
  model and the section together keep 48 % of the screen.


## Plan 0012, package 3.4b (2026-10-07): 2.3, a taller section (D13) and a sweep (D14)

The owner after 2.2, 2026-10-07: *"Can the section view be extended taller to optionally take up more
screen?"* (D13), *"did the explode functionality disappear?"*, and *"I assume we are also making it easy
to scroll through the sections with sliders etc?"* (D14). The brief: the pane's edge drags from 2.2's
compact size up to most of the view, the 3D view keeping a slim strip; a double tap toggles compact and
tall; the size is remembered; the edge a 44 px hit with a grip, a VoiceOver adjustable control and arrow
keys; live and sharp while dragged; a taller pane uses the room and states its own stretch; a slider
sweeps the line through the grid's rows and columns, ‹ › one at a time, the line moving on the model,
sharp while scrubbed; a drawn line swept parallel if simple; the resizing in the pane's own code, for
Volve. Version 2.2 → 2.3. Pictures: `tools/.work/p23/` (`before/` the screenshots as the pass found
them, `shots/` the probes' and drives' pictures), logs beside them.

**Explode did not disappear.** It is the first heading of the sheet at its first raised stop, upright
and on its side, with and without the section open: `tools/.work/p23/probe5.mjs` taps the grip once and
finds `Explode` heading the stop, the `Explode amount` slider wholly inside the sheet and on top at its
middle (upright at 154, 735, 136 × 44; on its side at 663, 77, 77 × 44), and `Formations`, `Layers`,
`Segments` under it (`shots/p5-chromium-*.png`). 2.2's second stop scrolls the sheet to *Cells and view*,
which is what the before/after picture showed.

### As built

1. **The edge (D13), `js/pane.js`.** One function, `paneEdge()`, owns the resizing: a drag (pointer
   capture, 4 px slop), a double tap (two lifts within 400 ms and 30 px), the keys (↑ ↓, and on its side
   ← → by the edge's own direction; Home, End; Enter toggles), an assistive click (detail 0) toggles, and
   a `ResizeObserver` on the view re-applies the size when the screen changes. The size is one fraction,
   0 compact to 1 tall, saved as `S.section.size` with the view (`norne-viewer:v1`); the pane takes it as
   `--pane` with the class `grown` (`style.css`: `.section.grown { flex: 0 0 var(--pane) }`, its plot
   taking the rest). Compact is measured, never restated: the pane without `grown` is 2.2's pane, so its
   fit-to-the-section and its caps are unchanged. Volve takes `js/pane.js`, the `.grown` and
   `.sec-edge`/`.sec-side` rules and the two edge elements, and passes its own pane, view and minimum.
   - *Where the edge is.* Under the model, the head's free stretch between `Draw` and ✕ (188 × 44 px at
     390 px), with the house's grip (36 × 4 px, `--line-strong`, the sheet's `.grip-bar`) laid on the
     line between the model and the pane at the screen's middle. A dedicated strip would have cost the
     plot 14 to 44 px or taken the plate's foot from the turn and Draw; the head's free stretch costs
     nothing and is already the pane's top. Beside the model, a 44 px strip astride the line beside the
     plot (22 px over the plate), the grip upright; the model's keys sit 30 px in from the plate's edge
     there (`.sectioned .keys`) so the strip never covers them (measured: the hit was 30.75 px wide
     before).
   - *The minimum strip:* **120 px** under the pane (its keys in a row, 46 px, and a band of the field
     under them that still turns by one finger and opens a cell on a tap), **160 px past the screen's
     left inset** beside it (read from the pane's own left padding, which carries
     `env(safe-area-inset-left)`), where the three key plates stand side by side (`keys-cols`, 130 ×
     134 px; new in `layoutKeys()` for a plate both under 302 px tall and 310 px wide).
   - *Live and sharp.* The pane's and the plate's heights are set in the frame that draws at them:
     `fitSection()` (the 2.2 fit, split out of `drawSection()`) runs before the 3D view draws, and the
     loop runs `layoutKeys()` and `reframe()` before every draw, so both canvases take their new size
     before they draw (2.2's fit returned and drew a frame later). `shoot.mjs` logs every frame of a
     touch drag past tall and back: no frame with a canvas not at its own size, the pane's top within
     0.00 px of the finger.
   - *The room used honestly.* `ownExag()` in `js/section.js`: in a pane made taller than compact, the
     largest round stretch (1 to 50, `STRETCHES`) at which the whole section still fits, used where it is
     a fifth or more above the 3D view's; else the 3D view's. The pane's foot prints it (`vertical ×20`)
     and the canvas's name says `depth stretched 20 times, more than the 3D view's 5`. The depth and
     distance words come from the one axis at every size, more of them as the pane grows (about one per
     75 px down, one per 150 px across). The compact pane is untouched (always the 3D view's stretch).
2. **The sweep (D14).** A row under the plot: `‹` (`tkey`), a house slider (`.hslider`, an `input
   type=range`, so VoiceOver's adjustable control comes with it), `›`, and where the line is.
   - *Along sweeps the grid's columns, Across its rows*, in this app's own words: the sheet's cell ranges
     already say `Columns (I)` and `Rows (J)` and the card `I`, `J`. The brief has it the other way round
     ("rows (for Along) or columns (for Across)"); by the grid's geometry Along (38°) runs with the I
     slices' spacing direction (−52.7°) and Across (128°) with the J slices', and `sweepAxis()` picks the
     family whose step is most square to the line, so any line gets the family it crosses. Called out
     for the lead.
   - *A column or row is drawn as the grid's own slice, not as a straight cut.* Measured
     (`tools/.work/p23/slices.mjs`): Norne's rows are near straight (their column middles 7 to 26 m off a
     fitted line) but its columns bend (24 to 175 m), and the active J ranges differ from column to
     column (I 6–19 run J 11–100, I 20–29 J 11–70, I 30–41 J 50–102). The first build swept the field's
     line parallel to itself through each slice's mean offset: the slices then came out of order
     (I 41, 40, 38, 39, 29, 37, 28, …) and a straight cut through a column's middle held 14 to 78 % of
     that column's cells. The second fitted a straight line to each slice: still 14 to 78 % for the
     columns. As built, `sliceSection()` takes the slice's own active cells, each drawn as the face
     midway across it (the mean of its two sides' corners), between its back and front boundary, on the
     path through the middles of the slice's pillars; distance is measured along that path. Every block
     is the slice's own (`test_section.mjs`: 128 slices, 88 862 blocks, none foreign, none missed but
     the pinched-out). The line on the model follows the same path (`lineAt()`), and the wells within
     150 m of the path are drawn at their nearest point on it (`wellsNearPath()`).
   - *The field's lines keep their place.* Along and Across stay the presets 2.2 chose; on the slider
     they sit among the slices where their middles fall (Along between I 22 and I 23, Across between
     J 69 and J 70), so the slider always says where the line is and ‹ › pass through them.
   - *A drawn line is swept parallel to itself* (the brief's "if that is simple": it was): steps of the
     slice spacing square to it (`shifts()`, 54 to 92 m by bearing), over the field either side; the pane
     says how far and which way (`89 m NW`, spoken `your line, moved 89 meters northwest`). Its ends can
     still be dragged; a moved end starts its sweep afresh.
   - *Sharp while scrubbed.* Each input records the place and asks for a frame; the frame draws the
     newest, so a scrub never queues a place already passed. While the finger is down the pane keeps its
     height (`SEC.lockH`, as 2.2 did for a drawn line) and fits the section on the lift (`change`).
     A slice is cut in 0.17 ms on average in Node (1.5 at most), its wells in 1 to 7 ms; the last 24
     slices are kept.
   - *Words.* Visible: `I 23`, `J 70`, `Along`, `Across`, `Drawn`, `89 m NW`. Spoken (the slider's
     `aria-valuetext`): `column I 23`, `row J 70`, `the field’s own line, between rows J 69 and J 70`,
     `your line, as drawn`, `your line, moved 89 meters northwest`; ‹ › (`Previous column`, `Next row`,
     `Previous step` …) say the new place through the live region. The canvas's name says the slice
     (`Section A to A prime, column I 23, 5.52 km long, …`).
3. **About** says it: the how-to paragraph (the slider, ‹ ›, the edge, its double tap, the strips, the
   keys) and the section paragraph (the taller pane's stretch; what a swept column or row is and how it
   is drawn; the wells on a path). Its sentence on the field's lines no longer says "grid columns" for
   the stacks of cells, since the app's columns are the I slices.
4. **Version (F6/HOUSE 13):** `2.3`; `check.mjs` item 6 pins it, item 4 lists `js/pane.js`, and its SI,
   middle-dot and module lists take the new file.

### Bugs on record and found, fixed as musts

- *The cut's key cut off on a phone on its side with the sheet raised* (2.2's left-open list said it was
  fixed at every width `shoot.mjs` runs; it was not at 844 × 390 with the sheet open, where the band's
  cut column is 216 px and the key needs about 280: `Water lifted` and `on the track` were hidden,
  `shots/p5-chromium-844x390-sec.png` before). With the sheet open on its side the caption's areas are
  now `legend legend about / cut cut cut / inst wells wells`, so the key has a row of its own, and it
  wraps rather than cuts where even that is short.
- *Distance words colliding in a short plot* (found: `6 08000 m` at the raised sheet's compact pane):
  the last word, which carries the unit, always stood, so an interior word it overlapped was drawn under
  it. Now an interior word it would touch gives way.
- *The lift's click landing on a card opened under the finger* (found on the 160 px strip: the tap
  opened the card under the finger and the click that follows the lift pressed its `Zoom to cell`).
  `tap()` makes the card take no click for 350 ms. On a narrow plate the card takes the compact form
  with the place line wrapping beside Close and Zoom under it (`.narrow`); before, its place line was
  squeezed to 49 px over three lines and ran into the figure.
- *A saved sweep place the grid has not* (a hand-edited or stale `at`) falls back to the line itself.
- The clip reviewers' item (plan 0009 item 5, B1) still passes at all three stops (`shoot.mjs`); matrix
  row 149 (Snuggery's exit arrows over a mini-app's top-right controls on iOS 18) is Snuggery's, not
  this folder's.

### Checks that followed the change (F8), named

- `shoot.mjs`, the section's colors on four properties and in the dark theme: run with the pane made
  tall (End on its edge), since the sweep row took 44 px of the compact plot and the widest cells'
  middles then fell under formation names (26 of 30 matched, the rest under a label's halo). Tall, the
  check is as strict as before (30 of 30, or all but one).
- `shoot.mjs`, *a card carried across the stops*: stop 0's form is no longer pinned to the full one;
  with the sweep row the compact pane is 44 px taller, the plate 343 px, and the app's own rule gives
  the compact form there. The raised stops still require the compact form, and every stop the card
  open, its ring clear, off the keys and inside the plate.
- `shoot.mjs`, *the finger meets the cell it sees*: 0.95 where it was 0.97. With the plate 44 px
  shorter the grid of samples lands on two more of the field's walls (74 of 77 within 150 m; the far
  ones at the field's southwest wall and one at 1 946 m, cell I 33, J 88, K 1), where a ray through a wall
  meets the top behind it. `mapPoint()` is unchanged; the drawn line still lands under the finger
  (0.02 and 0.01 px). **The lead may prefer a better wall rule to the looser threshold.**

### New checks

- `shoot.mjs` (*the pane's edge and the sweep (2.3)*): Across sweeps the rows (93 places; `row J 70`,
  every block in J 70; said `Row J 70.`; the line on the model moved); Along the columns (`column I 22`,
  every block its own); a fast touch scrub of the slider (every frame drew the slider's place, both
  canvases at their own size, the pane held while the finger was down and fitted after); a drawn line
  swept parallel (|cos| 1.000000, 89.0 m, the words); a touch drag on the edge past tall and back (the
  top under the finger to 0.00 px, no stretched frame, the model's 120 px strip); a double tap to tall
  and back (`Tall`, `vertical ×20` drawn ×20.00 and said, one finger on the strip turns the model); the
  keys (`0.3`, `30`) and the size over a reload; hit targets with the pane grown; on its side the side
  edge under the finger, the model 160 px with its plates side by side.
- `test_section.mjs` (8): the families and the field lines' places; every slice's blocks its own, on
  its path, A west; lineAt and the wells on a path; a drawn line's steps; the own stretch.

### The camera (HOUSE 7.4)

No string the camera reads or taps changed: `Oil saturation` (the legend's title, written last),
`Pressure`, `Oil`, `Show the whole field`, `Play production history`, `Pause`, `Show the controls`, the
grip's three names. New names: `Line position`, `Previous column` / `Next column` (`row`, `step`),
`Section height`, `Section width`; on screen `I 23`, `J 70`, `Drawn`, `89 m NW`. A library saved tall
opens tall; the camera's waits do not depend on the pane.

### Owner calls (taste, each reversible)

1. The edge under the model is the head's free stretch, its grip on the line; not a strip of its own.
2. The minimum strips: 120 px under, 160 px beside (plus the screen's inset).
3. Tall is the most the strip allows (the pane 427 of 547 px at 390 × 844, 78 %); a double tap goes
   there.
4. **Superseded after review (below): the row is 32 px with 44 px hits and the caps take it.** The sweep row (44 px) sits under the plot inside 2.2's compact caps. Where the section fitted under
   the cap, the pane grows by the row: Along, the pane 160 → 204 px and the model 387 → 343 px with the
   sheet closed. Where it was at the cap, the plot gives the row up: Across, the plot 153 → 109 px; with
   the sheet raised the pane is at its 169 px cap for both lines and the plot 59 px (Along 94, Across
   103 in 2.2; the model 245 → 236 px for Along). The edge gives the room back on demand; the
   alternative raises the caps by 44 px and takes it from the model.
5. A taller pane stretches the section to a round figure that fills it, up to ×50; the alternative
   keeps the 3D view's stretch and leaves the extra height empty.
6. Columns (I) for Along and rows (J) for Across, in the app's own words (see 2 above).
7. A swept column or row follows its own path through the grid (its own cells) rather than a straight
   line; the field's lines stay straight.
8. The field's own line sits on the slider among the slices; the alternative drops it from the slider.
9. Visible place words: `I 23` and `J 70` (the card's letters), `Along`, `Across`, `Drawn`, `89 m NW`.
10. With the sheet open on its side, the cut's key takes its own row (the plate 15 px shorter there).

### Phone checks (none claimed; for the device matrix)

On an iPhone 16-class device and the iOS 18 floor, in Snuggery's full screen: the edge dragged by
finger, upright and on its side, both views sharp and the model refitting as it goes (frame time and
memory with the section tall; the gap hatch is rebuilt each frame of a drag); the double tap on the edge
not taken by the web view as a zoom; VoiceOver on the edge (its name, `Compact`, `Tall`, the percentage,
swipe up and down stepping it: WebKit sends the arrow keys for an ARIA slider, which is what the edge
answers) and on the sweep's slider (`column I 23`, adjustable, ‹ › heard); the sweep scrubbed fast by
finger on the native range, sharp; the 120 px strip turned and tapped; the 160 px strip beside the pane
with the notch on the left; the remembered size after a relaunch; Explode at the first stop in both
orientations.

### Budgets

App code **250 592 B against the 222 000 B the lead ruled for 2.2** (`app.js` 135 020, `style.css`
35 518, `js/section.js` 33 833, `index.html` 20 205, `js/track.js` 7 840, `js/units.js` 7 225,
`js/data.js` 6 387, `js/pane.js` 4 564): 2.3 adds 28 798 B: `js/section.js` +10 298 (the columns,
the slices and their sections, the wells on a path, a drawn line's steps, the own stretch),
`app.js` +9 630 (the sweep, the edge's wiring, the fit split out before the draw, About's sentences,
the narrow card and its click guard, the test hook's frame log), `js/pane.js` 4 564, `style.css`
+2 477 and `index.html` +1 829. Nothing was cut
to fit (the brief); `check.mjs` fails that one line until the lead rules. Fonts 40 075 B of 160 000.
The ZIP as `build-zips.yml` packs it is 15 392 425 B of its 19 110 591 B cap (15 380 306 at the
start). `data/` is byte for byte as it was: everything here is code.

### Verified (from `Template/norne-reservoir/`, 2026-10-07, after the last change; headless figures are
SwiftShader trends on the build Mac, never phone evidence)

- `node tools/check.mjs`: 44 ok, 1 FAIL, the code cap above (exit 1 for that line alone); the seven
  data files byte-identical to their pins; palette ALL CHECKS PASS; version 2.3; the camera's strings;
  US spelling; no vendor name (`tools/.work/p23/check-final.log`).
- `node tools/test_decode.mjs`, `node tools/test_section.mjs`: all checks pass (the section's new
  part 8 above).
- `python3 norne-reservoir/tools/art/palette.py` from `Template/`: ALL CHECKS PASS.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: exit 0, 177 ok, both themes
  (`tools/.work/p23/shoot-final.log`); the section drawn in about 17 ms a draw; `screenshots/*`
  rewritten, one new (`pane-tall-light.png`), `screenshots/app.png` untouched.
- `tools/.work/p23/drive.mjs` in Chromium and WebKit, light and dark, 390 × 844 DPR 2 (taps by touch in
  both; drags by touch in Chromium and by mouse in WebKit, which has no touch drag in Playwright): the
  sweep by ‹ › and by its slider, a double tap to tall, a tap on a block, focus mode tall, on its side
  and back; no console error (`drive-final.log`). The probes (`probes-final.log`): the double tap, keys,
  memory and the side edge; a scrub of the slider in every frame at the newest place, no stretched
  canvas; a drag past tall, sharp, the strip turning; Explode at the first stop both ways; the card on
  the narrow strip. One headless note: in one Chromium run a double tap's two taps arrived 347 ms
  apart and in another over 400 ms (the first frames after the section opens are slow in SwiftShader),
  so that run took the second double tap; the app's window is 400 ms, as the plate's is 380.
- `bash scripts/package.sh` names `js/pane.js` in its URL scan (it copies `js/` whole); not run.
- Not run: anything on a phone.

## Plan 0012, package 3.4b, after QA and review (2026-10-07)

QA passed the build with one should and a nit; the reviewer failed it on one must, with three shoulds and
four nits. Every must and should is applied; the nits taken are the free ones.

### Applied

- **Must: on a strip, a turn took an end of the line.** `secHandle()` grabbed A or A′ within 22 px, and
  on the 120 px strip the model is about 79 × 26 px, so 57 to 70 % of its cells lay within an end's hit
  (the reviewer's 61 %; measured again here with `tools/.work/fix/m1.mjs`, which samples the plate every
  4 px). Now the ends take a touch only where the model is drawn **90 px or more on its shorter side**
  (`SEC_GRAB_MIN`, `modelBox()` projects the fit's points: the cells' corners and the well heads, at
  pointer-down only). Measured at 390 × 844 and 844 × 390: every state where the ends still grab has
  8 to 12 % of the model's cells within an end (2.2's compact figure); every state where they no longer
  do had 16 % or more (16 to 80 %). Below it one finger always turns the model, and `Draw` still draws a
  new line; the ends move again once the model is drawn larger (the pane made smaller, or zoomed in).
  The reviewer's other option (an end hit shrunk to the 12 px marker on the strip) was not built: on a
  79 × 26 px model a 12 px disc at each end still covers a large part of it (not measured).
  The probe's states were sampled while the caps below were being changed, with the sweep row at 44 px;
  the gate depends on the model's drawn size, not on the caps.
- **Should: the grip sat on the top boundary of its hit.** Under the model the edge's hit now reaches
  22 px up over the plate's foot (`.sec-head .sec-edge { margin-top: -22px }`, inside the head's own
  z-index, under the keys' plates), so the grip is in the middle of a 66 px hit: `elementFromPoint` at
  the grip's middle −8, −4, 0, +4, +8 px is the edge (`shoot.mjs`), and a drag by touch from 6 px above
  the grip resizes the pane and does not turn the model (Chromium and WebKit, `drive.mjs`). The plate's
  bottom 22 px no longer turns the model while the section is open; a line end drawn there is reached
  with the pane made smaller or the model turned. Two `shoot.mjs` touches that used a plate rectangle
  read before the pane refitted to a drawn line (the two-finger step and the turn after it) now read the
  plate as it is.
- **Should: the raised-sheet compact plot was 59 px.** Taken from both of the reviewer's directions,
  within the reservoir's minimum share (the model at least 220 px with the sheet up, `shoot.mjs`'s
  *the view keeps about half the screen*, package 3.4), which the plain alternative (the caps raised by
  44 px) would have broken: the model 192 px for Across with the sheet up.
  - The sweep row is **32 px**; its keys and slider keep 44 px hits that reach 6 px over the plot's
    distance words above and the key's top below (neither takes a touch; the row is over both by its
    own z-index). `hitTargets()` still finds every control at 44 × 44 or more.
  - Sheet closed: the cap is `clamp(202px, 26dvh + 32px, 262px)`, 2.2's cap plus the row, so the
    Across plot is 2.2's again (the model 355 px under Along, 547 px of view).
  - Sheet raised: the cap is `clamp(150px, var(--view-min) − 220px, 234px)`, what the model can give
    above its 220 px: 185 px at 844, so the compact plot is **87 px** for both lines (2.2: Along 94,
    Across 103; the review's 59). The model is 220 px there (236 before). Below the reviewer's "about
    90" by 3 px; the rest would come from the model's 220 px or the sheet's 187, which are the brief's.
  - Owner call 4 above is superseded by this; the alternative now is the 44 px row (59 px plot) or the
    model under 220 px.
- **Should: the side edge's orientation, with its keys.** `#sec-side` is `aria-orientation="horizontal"`
  (QA's finding), and the keys follow the slider convention on both edges: ↑ and → larger, ↓ and ←
  smaller (the reviewer's point: WebKit's increment sends → to a horizontal slider, which used to
  narrow the pane). Checked in `shoot.mjs` (from tall: ← 90, → 100, ↓ 90, ↑ 100). On a keyboard beside
  the model, → now widens the pane although its edge moves left; the slider convention is the one
  assistive technology relies on, so it wins. **For the device row:** VoiceOver's increment on the side
  edge widens the pane.

### Nits

- Taken: the side edge comes first in the pane's DOM (it is absolutely placed, so nothing moves), so
  focus meets it where it is drawn, at the pane's left.
- Taken: distance words thin evenly. Where interior words would touch, every other one gives way (then
  every third, …) before the last word, which carries the unit, takes the one next to it; before, only
  the words next to the last gave way (`0 500 1 000 _ _ 2 500 m`).
- Not taken: the two `vertical ×N` figures on one screen. The brief asked for the pane's own figure at
  its foot and the 3D view's on the instrument line; `section vertical ×20` does not fit the key row
  beside the wells at 390 px, and hiding the pane's while it equals the 3D view's makes the figure come
  and go with the edge. Left to the lead or owner.
- For the lead: the code cap and the records outside this folder (the device matrix row for 2.3, the
  manual steps).

### Checks added to `shoot.mjs`

- On the 120 px strip (upright, tall) and the 160 px strip (on its side), a one-finger drag that starts
  on the model 8 px from A′ turns it and leaves the line's ends as they were.
- The grip under the model lies inside its edge's hit (±8 px).
- At the raised sheet's first stop, the compact pane's plot is 86 px or more for Along and Across, the
  model 220 px.
- The side edge is a horizontal slider and its keys step it in the slider convention.

### The camera (HOUSE 7.4)

No string the camera waits for or taps changed.

### Budgets after the fixes

App code **252 685 B** against the lead's 222 000 B (the builder's 250 592 B plus 2 093: `app.js`
136 251 (+1 231: the model's box, the ends' gate, the even distance words, two test hooks),
`style.css` 36 295 (+777), `js/pane.js` 4 647 (+83), `index.html` 20 207 (+2)). Nothing cut to fit;
`check.mjs` fails that one line for the lead's ruling. The ZIP 15 393 528 B of 19 110 591. `data/`
untouched.

### Verified (from `Template/norne-reservoir/`, 2026-10-07, after the last change; headless, never phone evidence)

- `node tools/check.mjs`: 44 ok, 1 FAIL (the code cap above); version 2.3; the camera's strings
  (`tools/.work/fix/check-final.log`).
- `node tools/test_decode.mjs`, `node tools/test_section.mjs`: all checks pass.
- `python3 norne-reservoir/tools/art/palette.py` from `Template/`: ALL CHECKS PASS.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: exit 0, 182 ok, both themes
  (`tools/.work/fix/shoot-final.log`); `screenshots/app.png` untouched.
- `tools/.work/fix/drive.mjs` in Chromium (light, drags by CDP touch) and WebKit (dark, taps by touch,
  drags by mouse) at 390 × 844 DPR 2 and 844 × 390 (`drive.log`): a drag from 6 px above the grip
  resizes the pane (0 → 0.42) with the model unturned; a double tap to tall (the model 120 px); on the
  strip a drag from 6 px off A′ and one from 6 px off A each turn the model (theta 62 → 13 → −36) with
  the line's ends unchanged; a double tap back to compact; Across at the raised sheet's first stop, an
  87 px plot over a 220 px model, `›` to `J 70`; on its side, tall, a drag from 6 px off A′ on the
  160 px strip turns the model with A′ unchanged; no console error. Pictures looked at in
  `tools/.work/fix/shots/`.
- Not run: anything on a phone.


## Plan 0012, package 3.4b, after the final review (2026-10-07)

The final failed 2.3 on one must, with a should and two nits; the lead ruled the code budget the same
day. Everything below is applied. Probes and logs: `tools/.work/p23c/` (scratch, deleted at the end of
the pass; the figures are copied here).

### The must: on its side with the sheet raised, the model in a third of its plate

At 844 × 390 with the sheet at its first raised stop and the pane compact, the plate is 272 × 207 px.
2.3's `layoutKeys()` took `keys-cols` for any plate under 302 px tall and 310 px wide, which fitted the
model into 94 × 36 px (35 % of the plate's width) and put its line's ends under `SEC_GRAB_MIN`.

- **2.2 measured, not only recalled.** The final's copy of 2.2 (rebuilt from HEAD in the session's
  scratchpad: `app.js`, `index.html`, `style.css` and `js/section.js` as 2.2 had them; this pass ran no
  git) driven the same way: plate 272 × 223, `keys-row`, A and A′ at x 33 and 240 (the final's
  figures exactly), the drag from 6 px off A′ moving it. It also showed what neither record said: 2.2's
  row there is 286 px in a 272 px plate, so it stood 22 px past the plate's left edge and `Zoom in`
  was cut in half (its picture). 2.3's `.sectioned .keys { right: 30px }` would have put it 44 px out.
  So the row cannot simply come back there.
- **As built.** `layoutKeys()`: the column where the plate is 302 px tall or more; else 2.2's row
  wherever it fits inside the plate (8 px inset) (every upright state, and on its side with the sheet
  closed); else, of the forms that fit inside the plate, the one that leaves the larger fitted model:
  **two rows** (`keys-wrap`, new: the zoom plate over the other two, 150 × 84 px, top right) or the
  plates side by side (`keys-cols`, 130 × 134). The model's size is worked out from the rooms
  `fitRooms()` gives the fit, at the field's aspect as last fitted (`G.fitAsp`, written by
  `fitCam()`), so it costs two style toggles, never a fit; it is worked out again only when the
  plate's size, the keys' visibility or `.sectioned` change (`G.keysAt`). Measured: at the raised
  stop the two rows win (model 231 × 81 px, **85 %** of the plate's width, Along and Across, Chromium
  and WebKit alike); on the 160 px strip only the side-by-side form fits (two rows need 180 px) and it
  is taken, as before. A first cut of this let the two rows win on the raised 160 px strip by the
  model's measure while they stood 20 px past the plate's edge (`webkit-dark-844x390-raised-tall`,
  seen in the picture); a form now has to fit inside the plate to be weighed at all.
- **The card's `.narrow` form** still follows the plate's width alone (under 310 px): it does not
  touch the model's fit, and on a 272 px plate the full card would squeeze its place line as on the
  strip.
- **The ends' gate moved: `SEC_GRAB_MIN` 90 → 76 px.** At 231 × 81 the old gate (the shorter side
  90 px or more) still refused the ends, and no layout of a 272 × 207 plate gives a field about three
  times wider than tall 90 px of height (the room under the two key rows is 81 px). Measured again
  over the pane's sizes in tenths and fifths, both orientations, sheet closed and raised
  (`p23c/share.mjs`, the fix pass's method: the plate sampled every 4 px, the share of the model's
  cells within an end's 22 px):

  | the model's shorter side | its cells within an end's reach |
  | --- | --- |
  | 100 px and more | 8 to 15 % |
  | 80 to 87 px (231 × 81 here; 247 × 80; 244 × 87; 269 × 87) | 16 to 22 % |
  | 75 px and less (231 × 75, 203 × 72, 190 × 69, 181 × 65, … the strips at 27 to 51) | 21 to 70 %, all but one 24 % and up |

  76 sits between the 80 px states and the 75 px state; every state that still grabs has 22 % or
  less within an end, every strip the reviewer's must was about (57 to 70 %) still turns the model.
  The states the fix pass newly refused at 80 to 87 px (a pane grown to 0.6 to 0.8) take the ends
  again; the margin at the raised stop is 5 px (81 against 76) and does not move with fonts (the
  room is the plate less the two key rows).
- **Checked in `shoot.mjs`** (*on its side, the sheet at its first raised stop, the pane compact*):
  for Along and Across, the model 70 % or more of the plate's width (85 %), the keys inside the plate,
  and a touch drag from 6 px off A′ moves A′ (1 372 and 1 885 m) and leaves A, the line now drawn.

### The should: the sweep's slider 63 px for 93 places

In the same state the pane's content is 206 px wide, and `‹` 44, the slider and `›` 44 cannot hold
140 px for the slider in it even with the word gone (127 px). As built: where the plot is under 284 px
wide (`fitSection()` sets `.narrow` on the row in the frame that draws, from the plot's width, which
the row's form does not change), the place word takes a 15 px line of its own **over** the track,
centered, and the row reaches the pane's padding edge (−12 px instead of −4), so the track is
**143 px** and the plot gives 15 px (110 → 95). Over, not under: the side edge's hit ends 65 px above
the pane's foot, just over the row's keys, and the word under them would have pushed the keys into it.
The slider's flex basis is 0, so its keys never wrap. Measured in `shoot.mjs` at 12 states (upright
and on its side, the sheet at each of its three stops, compact and tall): 222, 199, 470, 175 px, and
143 px with the word over it on its side at both raised stops compact.

### The nit: the side edge says what it does

`js/pane.js`: `Compact`; `Tall` under the model, `Wide` beside it; between, `77 percent of the view’s
width` (or `height`). `shoot.mjs` pins `Wide` and the width wording. About's sentence says "between
compact and its largest" where it said "compact and tall".

### Found while driving, fixed as a must: the double tap's own click

A double tap on the side edge back to compact (Chromium, real touch, the sheet raised) closed the
section: the second tap's pointerup shrinks the pane, and the click that follows the lift is hit-tested
where the finger was, by then over the plate's `Section` key (the model, upright). `js/pane.js` takes
the one click that follows a double-tap toggle (capture phase, within 400 ms), as `tap()` does for a
card opened under the finger; an assistive click (detail 0) still toggles. `shoot.mjs` checks both
edges: after the double tap back the section is open and no card opened.

### The lead's ruling, applied

`tools/check.mjs` item 15: `CODE_CAP = 256000`, with a comment naming the ruling (2026-10-07: D13's
edge and D14's sweep, which the owner asked for and Volve will copy). ART.md and NOTES.md give the
measured figure.

### The camera (HOUSE 7.4)

No string the camera waits for or taps changed. The edge's value text `Tall` stays under the model;
beside it the edge now says `Wide` (not a camera string).

### Left for the lead (not changed here)

- On the 160 px strip with the sheet raised (the pane made wide on its side), the plates side by side
  leave no room the fit accepts, so the model is drawn at the fallback distance behind the key
  plates (156 × 57 px box; the fix pass's log has the same box). Two rows do not fit there.
- At the raised stop on its side the pane's foot (`No active cell`, `Wells within 150 m`,
  `vertical ×5`) is wider than 206 px, and its last word is cut where a gap is in the section.
  2.2 had the same pane width; `shoot.mjs` checks that foot at its widths with the sheet closed only.
- The side edge's drag in `shoot.mjs` followed the finger to 0.47 px in this pass's runs (0.00 before);
  inside the check's 1 px.

### Owner calls (taste, each reversible)

1. Two rows for the keys where the row does not fit and they leave the model larger; the alternative
   is 2.2's row, cut off past the plate's edge.
2. The ends take a touch on a model 76 px or more on its shorter side (was 90 in the fix pass).
3. In a narrow pane the place word sits over the slider; the alternative is the word in the slider's
   spoken value only (15 px more plot).

### Phone checks (none claimed; for the device matrix)

On an iPhone 16-class device and the iOS 18 floor, on its side with the sheet at its first stop and the
section open: the keys in two rows inside the plate, an end of the line dragged by finger; the sweep
scrubbed by finger on its 143 px track with the place word over it; a double tap on the side edge to
wide and back, the section staying open (iOS's click after a double tap is the case the fix is for);
VoiceOver on the side edge saying `Wide` and `… percent of the view’s width`.

### Budgets

App code **255 443 B** of the lead's 256 000 (`app.js` 137 645, `style.css` 37 087, `js/section.js`
33 833, `index.html` 20 214, `js/track.js` 7 840, `js/units.js` 7 225, `js/data.js` 6 387,
`js/pane.js` 5 212): 2 758 B over the final's 252 685 (the key forms and their choice, the narrow
sweep row, the click guard, the edge's words). The ZIP 15 394 827 B of 19 110 591. `data/` untouched
(`check.mjs`: the seven data files byte-identical to their pins).

### Verified (from `Template/norne-reservoir/`, 2026-10-07, after the last change; headless, never phone evidence)

- `node tools/check.mjs`: exit 0, 45 ok, all checks pass (the code 255 443 B of 256 000; version 2.3;
  the camera's strings; US spelling; the ZIP 15 394 827 B).
- `node tools/test_decode.mjs`, `node tools/test_section.mjs`: exit 0, all checks pass.
- `python3 norne-reservoir/tools/art/palette.py` from `Template/`: ALL CHECKS PASS.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`, then `SCREENSHOTS=1 …` after the last change: exit 0,
  189 ok, 0 failed, light and dark; `screenshots/app.png` untouched. The screenshots whose bytes
  changed: `pane-tall-light`, `pressure-light`, `sheet-dark`, each looked at and as before in what they
  show (none shows the states this section changed).
- Driven by touch at DPR 2 in Chromium (light; drags by CDP touch) and WebKit (dark; taps by touch,
  drags by mouse, which Playwright's WebKit has for want of touch drags), at 390 × 844 and 844 × 390,
  the sheet raised: the keys' form and the model (231 × 81 on its side, 366 × 121 upright), a drag from
  6 px off A′ moving it in every state, the slider by a tap (I 33), `›` twice (I 35, spoken
  `column I 35`) and a drag to its end (I 41), focus mode on and off (the keys back in two rows inside
  the plate), a double tap on the edge to tall or wide and back; no console error. Pictures looked at:
  the raised states before and after, in both engines, the 160 px strip raised, `pane-raised-side`,
  `pane-side`, and the three changed screenshots.
- Not run: anything on a phone.

## Plan 0012, 2.3.1: the play clamp (2026-10-07, the lead)

Volve's fix pass found that `loop()` could ask for report date −1: a frame's time can precede the
Play tap's `performance.now()`, so `now - playing.t0` came out negative at the first frame, and
`Math.floor` of it gave −1 from frame 0. One Chromium run crashed on it ("Start offset −734180").
Norne carries the same line, so it takes Volve's clamp, `Math.max(0, now - playing.t0)`, as 2.3.1.
Nothing else changed.

## Plan 0012 D16 and D17: plasma and viridis, and the compass back on the plate (2.4, 2026-10-07)

The owner, 2026-10-07: *"And i dont like the colortables for pressure, porosity, permeability etc"*,
then, of the board (`docs/marketing/reference/0012-ramps-board.png`: the house's ramps against Turbo,
plasma/viridis and Jet on Volve), plasma/viridis, with *"i meant keep the original ones for the
saturations"*; and *"And the north arrow seems to have gotten lost?"*. Built here and in Volve 1.1 in
one pass. Version 2.3.1 to 2.4.

### D16: the ramps

- **The source.** matplotlib 3.9.4's own tables, `_plasma_data` and `_viridis_data` in
  `lib/matplotlib/_cm_listed.py`, read from the copy on the build machine
  (`build/venv-decks/lib/python3.9/site-packages/`, sha256 `86980cc7…05e64e3`), 256 entries each,
  rounded to 8 bits and pasted into `tools/art/palette.py` as `MPL`. The polynomial fits in the run's
  scratchpad were not needed. The file carries no license note of its own; the colormaps' authors
  (Nathaniel Smith and Stéfan van der Walt, viridis with Eric Firing) are named in `NOTES.md`'s
  credits without a license line, for the lead to settle (see Left for the lead).
- **The mapping.** `pressure` takes plasma; `rock` (porosity, both permeabilities), `sand` (net to
  gross) and `depth` take viridis. The keys stay, so `config.json`'s properties are untouched. Each is
  33 stops sampled at `k / 32` of the table with straight sRGB interpolation between its two nearest
  entries, the shape `lut()` has always read, and `colormaps` and `colormapsDark` hold the same stops.
  Low values at the dark end in both themes (pressure 200 bar `#0d0887`, 450 bar `#f0f921`; the rock's
  foot `#440154`, its top `#fde725`; the shallowest depth violet, the deepest yellow).
- **Kept exactly**: `oil`, `water`, `gas`, `layers`, `formations`, `segments` and `wellColors`
  (`palette.py --json` prints them byte-identical; `check.mjs` pins the six scales by a sha256 of
  2.3.1's stops, `3e57d70a4d1e…`). Only those four scales' 264 stops changed in `config.json`.
- **One source still.** `palette.py` writes all of it; the four house paths it replaces left `RAMPS`
  (2.3.1's stops are in git and in ART.md's history: pressure `#f8f5ff`..`#773a00` light,
  `#383243`..`#ffcba9` dark; rock `#f7f5ff`..`#305a12`, `#363243`..`#b8e89e`; sand `#fbf6ee`..`#6d4201`,
  `#39352f`..`#ffcd98`; depth `#e1fefd`..`#31478e`, `#223a3a`..`#c7d7ff`). Its docstring and the
  `PUBLISHED` block record the exception.
- **The checks kept and changed.** Kept: the chrome, the Cut, the plate's body, the categories, the
  wells, the chart, the labels, the ghost key, all over every stop of every scale (the new tables
  included). The scales' block keeps monotone lightness (falling with the value in the light theme for
  the house ramps, rising in both themes for the tables), the ends apart in four visions, the step per
  eighth and `lut()` against the path (for the tables, against the table). The "nothing end on white"
  block now runs over the house ramps only, since the tables start dark. New: a D16 block measuring
  each table's ends on each theme's ground, unshaded and at the shader's light factors and a cell edge,
  and a compass block. No symmetry check concerns these scales (Volve's seismic ramps carry theirs).
- **Where it shows.** Everything reads `lut()`: the 3D view's texture, the section's cells (the
  texture's own colors) and the legend's bar. The card has no color swatch (`index.html` and
  `placeCard()` draw none; it prints the figure), and the legend's category swatches are unchanged. The track draws the cut in its own ink, no
  scale. About's words (*"Each cell is colored by its value on the scale under the picture…"*) stay
  true and name no ramp, so the code budget paid nothing for words; `NOTES.md` names them.
- **The two ends, as the brief asked.** On the dark plate `#0c1316` the darkest stops stand off by dE
  0.211 (plasma `#0d0887`, 1.25:1) and 0.173 (viridis `#440154`, 1.23:1) unshaded; on a top face
  (0.83) 0.172 and 0.140; on a face turned from both lamps (0.42) 0.092 and 0.083 at 1.04:1; at a cell
  edge (×0.55 more) 0.081 and 0.084. A deep violet on the slate, by hue rather than lightness; few cells
  sit there (pressure at or under 200 bar, porosity at the scale's foot). On white the lightest stops
  stand off by 0.212 (`#f0f921`, 1.15:1) and 0.203 (`#fde725`, 1.26:1) unshaded, 1.70 and 1.86:1 on a
  top face, 1.29 and 1.41:1 at the brightest face: a strong yellow, with the cell edges, the legend
  bar's 60 % `--line-strong` frame and the section's 1.5 px rim (3.83:1) giving it an edge.
- **What moved in the existing checks**: labels worst 12.38 and 10.62:1 (12.63 and 10.83 before), the
  ghost key 3.76 and 4.43 (3.91 and 4.68), the gas injector's core over any base 4.31 dark (4.37).
  All above their floors.

### D17: the compass

- **Where and what.** `<span class="compass" id="north" role="img">` in the plate, after the labels'
  layer: top left, 8 px in (8 px under the top safe area in focus mode), z-index 2, no touch. A 36 px
  SVG: a disc of `--plate` at 0.80 with a 1 px `--line` rim, a kite needle (each arm 8.5 px long,
  6.4 px across at the middle), the north arm `--ink`, the south `--ink-3`, and `N` (11 px, 650,
  `--ink`) upright at the north tip. The instrument line's 16 px needle and its CSS went; the scale
  bar stays.
- **Turning.** `updateGauge()` already projected north and east at the camera's target; it now rotates
  the needle to north, scales it along its length by north's screen length over east's (floor 0.5, so
  never under half; the old needle's floor was 0.3), never across, and moves the N to 8.5k + 5.5 px
  from the middle along north, rounded to a pixel. The VoiceOver name is the needle's, unchanged:
  `North arrow: north is toward the right of the view.` (eight directions).
- **Keeping clear.** `keepOut()` lists the compass, so well and formation names, and the tapped cell's
  ring, keep off it; a name whose 44 px hit (grown upward) would reach the compass's box plus 4 px is
  not drawn there either (the chosen well's name still is, under its head first, as before).
  `placeCard()` counts it like a key but 4 px clear, not 6: the 6 px kept the card's Close hit off a
  key's hit, and the compass takes no touch. **Why 36 px, not 38**: at the sheet's raised stops the
  plate is 405 px and the full card needs 162.8 px beside a mark anywhere in its column; a 38 px
  compass 6 px clear left 162.5 and the first `shoot.mjs` run failed there (the card compact at stops
  1 and 2). 36 px 4 px clear leaves 164.5. The brief said about 36.
- **The code budget.** 2.4 is 255 990 B of the 256 000 (2.3.1: 255 520): the compass's markup, CSS and
  keep-outs, less the old needle, and three comments shortened (the north-and-scale note, `keepOut`'s,
  the section header) to fit. 10 B are left; anything more in 2.4 needs the lead's ruling.

### The checks

- `check.mjs`: version 2.4; two new checks: D16 (the four scales are plasma and viridis, 33 stops,
  one set for both themes; the kept scales hash as 2.3.1's) and D17 (the compass's markup in the
  plate, the instrument line down to the scale, the compass in `keepOut()` and `placeCard()`'s keep).
- `shoot.mjs`: `compassOf()` works out north's screen direction from the camera's own numbers (eye,
  the 40° lens, the lens shift), not app.js's matrices, and checks the compass shown, 32 px or more,
  in the plate's top-left, its N within 6° of north, its needle not under half its length or narrower
  than 6.4 px, its name's direction, and over none of the keys, the ghost key, the card, a drawn name
  or its hit, a formation's name, the tapped cell's ring or the section's A and A′. It runs at rest in
  both themes, at the start of every scene of "the card at every stop" (closed, both raised stops,
  the section open, focus mode, on its side closed, raised and in focus mode), under every card those
  scenes open (`cardAt` gains "over the compass"), and in a new block turning and tilting the model
  by touch in the dark theme. The colors' checks needed no change: the section's colors are checked
  against `config.json` as read, and the plate check is on Oil.

### Left for the lead

- **The code budget**: 10 B under 256 000. Volve has 16 B under its 312 000, and a later agent makes
  its section fast under 1.1: that needs a ruling.
- **The colormaps' license**: matplotlib 3.9.4's copy carries no note on them; NOTES credits their
  authors only. The lead to settle whether a license line is wanted.
- **HOUSE.md 4.15's Norne departure** still lists the instrument line as "north, the scale,
  `vertical ×5`": north is now on the plate. Only D16's line was written to HOUSE.md, as briefed.
- **The marketing camera**: `screenshots/app.png` untouched (`23c808ceee59…`), for the 5b camera.

### Phone checks (none claimed)

The compass in Snuggery's own full-screen mode beside the host's exit control, under the notch's
inset in focus mode and on its side; VoiceOver reading `North arrow: north is toward … of the view.`
as the model turns; plasma's and viridis's dark ends on the dark plate and the yellow ends on white
on the phone's own display; the full card at the raised stops in WebKit's own text metrics (1.7 px to
spare in Chromium).

### Verified (from `Template/norne-reservoir/` unless named, 2026-10-07/08; headless, never phone evidence)

- `python3 norne-reservoir/tools/art/palette.py` from `Template/`: exit 0, ALL CHECKS PASS.
- `node tools/check.mjs`: exit 0, all checks pass (app code 255 990 of 256 000; version 2.4; D16; D17).
- `node tools/test_decode.mjs`, `node tools/test_section.mjs`: all checks pass.
- `SCREENSHOTS=1 PLAYWRIGHT_MODULE=… node tools/shoot.mjs` (log `tools/.work/shoot-d16.log`): exit 0,
  208 ok, 0 failed, `all checks pass`; `screenshots/app.png` untouched. A first run with a 38 px compass
  6 px clear of the card failed the full card at both raised stops; that is what made it 36 px.
- Pictures looked at: `pressure-light` and `-dark`, `cell-light`, `section-light` and `-dark`,
  `card-sheet`, `landscape-dark`, the focus mode on its side, the tilted compass, and the section on
  Pressure and Porosity in both themes (a separate look script): the section's cells, tops and names
  read on plasma and viridis.
- Not run: anything on a phone.
