# Norne Reservoir: art direction

`NOTES.md` says what the app does and where every number comes from. This file says how it looks,
moves and speaks under the template's house system (`Template/HOUSE.md`, the brief this pass
follows; Global Weather is the reference, Milky Way and Besseggen the passes before this one).
Every figure names the command that printed it. The scripts are in `tools/`, which the ZIP leaves
out. Choices marked *owner call* are listed, with what each was chosen over, in `tools/DECISIONS.md`
there, beside the record of how this look was built, checked and reviewed; B1 to B11 are the bugs
the pass fixed, listed there too.

**Version 2.2 (2026-10-07, the template's plan 0012).** The ground is white (`#ffffff`); the front
holds the name, the view and its controls, and the sources, the credits and the edition are in About,
which the `About` key opens from every screen; the caption band keeps the legend, the instrument line,
the wells key and a key for the cut; the view keeps about half the screen with the controls sheet
raised; and the section A–A′ opens under the model (section 3, *The section A–A′*). Where a figure
below changed with 2.2, it is the one measured for 2.2, and says so.

**Measured on 2026-10-01**, before the pass, on the working tree. Commands run from
`Template/norne-reservoir/` unless they say `Template/`. Load and frame times are headless Chromium
(SwiftShader) on the build Mac: a trend, never phone evidence. The throwaway scripts named below
live in `tools/.work/`, which git ignores.

---

## The look: the house, with one bold thing of its own

Norne Reservoir takes the house chrome whole: one face, gray chrome, the row of words, the key
column, the caption band, the player and the app's own track, the readout card, About, focus mode,
SI and the no-tells rules. What is its own is the plate, printed twice, and one signature.

- **The plate is printed twice.** A reservoir model has no true appearance: every color on it is a
  value on a scale. So it takes Global Weather's road, not Besseggen's: the light theme is the
  negative (pale rock, more of a quantity darker), the dark theme is the print (dark rock, more of a
  quantity brighter). In the dark theme the oil leg glows out of a dark body, which is what the
  model is about (`tools/.work/look/preview-dark-Oil-0.png`). The stock app drew the same colors in
  both themes, so its dark theme was a near-white block on a near-black stage
  (`tools/.work/look/dark-0-open.png`).
- **One bold thing: the Cut** (section 1), on the player's track. Everything else is quiet.
- **Honesty is already the app's point.** `NOTES.md` states the run's check against the published
  reference and the model's distance from the field's own history. The pass keeps every word of
  that, says it where the picture is read (About, section 3), and fixes the places where the screen
  says less than the data: scales that clip without saying so, a legend that sits over the date
  (B5, B1).

**What a stranger saw before the pass** (`PLAYWRIGHT_MODULE=… node tools/.work/look.mjs`, light and dark at
390 x 844, DPR 2, touch, plus 844 x 390; pictures in `tools/.work/look/`): a 28 px condensed `Norne`
and a 30 px condensed `Nov 1997` floating over the model, with `Norwegian Sea`, the property name
and a four-entry well key stacked under them; a 160 px vertical color bar on the plate's right edge
with a text shadow; a frosted round compass with an ochre needle and a scale bar at the plate's
foot; a frosted round frame button; a frosted hint card for seven seconds; well names as pills with
a colored left edge; an ochre (`#A8740F` light, `#DDAA3F` dark) Play disc, slider thumb, chart
cursor, focus ring and checkboxes. Two system faces (Avenir Next and its condensed cut), neither
shipped. The model is the same colors in both themes. Every control the run measured is under 44 px
in one dimension or both (`look.mjs`'s `small` list at the sheet's top stop: the property chips
36 px tall, Play and the frame button 40, the grip 22, the sliders 28, the checkboxes 17, the well
labels 21, the selects 27, the two text buttons 40).

**How it differs from the apps before it** (it copies none of them):

| | Global Weather, Global Wind | Earth's History | US Quakes | Warming World | Milky Way | Besseggen | Norne Reservoir |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Signature | the streak field on the plate | the time control as a stratigraphic column | the record strip, one stem per quake | the stripes as an instrument | the Reach: a log ruler of distance | the Burn: one day's sun at one point | **the Cut: nine years of what the field's wells lifted, oil in ink, water stacked on it** |
| Axis | the map | time (Ma) | time (days) | time (years) | distance from the Sun | the hours of one day | **the production history, 6 Nov 1997 to 1 Dec 2006, linear in days** |
| What it encodes | the wind's path | period colors | magnitude by stem height | anomaly by color | presence only | the sun's altitude; direct sun by ink | **liquid per day by height; oil and water by tone** |
| Shape | streaks | a banded column | stems | stripes | a flat bar with gaps | one arch with bites | **a two-tone skyline: an ink plateau that sinks while a gray layer of water rises over it** |
| Plate | film base / print | night in both themes | drum paper | gray card | space in both themes | daylight terrain in both themes | **the rock printed twice: negative and print** |

The Cut and the Burn both live on the track, as three of the house's first four signatures do. They
read differently: the Burn is one day for one point and binary (lit or not under a geometric arc);
the Cut is a field's whole life and a quantity split in two (oil, water) at a printed scale.

---

## 1. The signature: the Cut

**What it is, in one paragraph a stranger would get.** An oil field does not lift oil. It lifts
liquid, and as the years pass more and more of that liquid is water: the share that is water is
what the trade calls the *water cut*, and it is the curve a reservoir engineer looks at first. The
Cut draws the player's track as that record. Each month of the history is a column standing on the
track's baseline, as tall as the liquid the field's wells lifted per day in the month to that date,
at a fixed and printed scale. The oil in it is solid ink from the baseline up; the water is the same
ink, thinned, stacked on top. Read left to right, the ink climbs to a plateau in 2000 and 2001 and
then sinks, while the gray layer above it thickens until, from the month to 1 Jul 2004 on, the wells
lift more water than oil in every month. The thumb stands on the month shown; the track's value
says that month's two figures and its cut, and the rates chart under More controls draws them.

**What a stranger remembers is the crossover.** Measured from `data/model.json`'s field rates
(`python3 tools/.work/cut.py`; `tools/test_decode.mjs` and `tools/shoot.mjs` reproduce them with their
own decode): liquid peaks at 37 144 Sm³/d in the month to
1 Nov 2000, 35 735 of it oil and 1 409 water (4 %). Water passes oil for the first time in the month
to 1 Jul 2004 and stays above it in all 30 months from there to the end; in the month to 1 Dec 2006 the field lifts
7 361 Sm³/d of oil and 16 251 of water, 69 % water. By year the water share runs 0, 2, 4, 8, 19,
28, 48, 63 and 59 % from 1998 to 2006. Over the 3 312 days the averages sum to 67.20 million Sm³ of
oil and 23.29 million of water. No other app in the template has a number like that, and the Cut
shows it without a word: scrub to 2005 and two thirds of each column is gray.

**How it was found** (HOUSE 5.1):

1. *What does a specialist call the picture of this data?* For a producing field the reservoir
   engineer's first documents are the production profile (rate against time, the plateau and the
   decline) and the water-cut plot (the water share against time, rising from zero). The Cut is the
   two in one: a stacked liquid-rate record, so the profile is the column's height and the cut is its
   split.
2. *What does a person do most here?* Play the production history and scrub it while the colors
   change in the rock (the marketing clip does exactly that: `Play production history`, then
   `Pause`). The track is where the hands are, and the Cut tells the viewer which month is worth
   stopping on.
3. *What does this data have that no other app has?* A reservoir simulation's own account of what
   came out of the rock, month by month, next to the 3D state of the rock it came out of. The
   atlases carry fields' reported production on a map, never the water a field lifted with its oil;
   the Cut moved to either would have nothing to split. Candidates tried and set aside: the wells
   restyled in ink as the signature (memorable less than the crossover, and the wells already carry
   role colors that are data); the oil left in the cells, summed per month from the 44 431 cells (a
   true number, but a gentle monotone decline nobody remembers); a stipple on swept cells (sub-pixel
   at the whole-field view on a phone, and redundant with the oil-saturation view).
4. *Can it be drawn with the house's means?* One ink at the far end of the tonal budget and its own
   tint, the house's track, ticks and labels, no motion of its own.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears.* The columns are `summary.field.oil` and
   `summary.field.water`, nothing else. With `model.json` missing the app shows its notice and the
   track carries only its graduation; a month with no liquid (the first report date, 6 Nov 1997, the
   day production started) has no column.
2. *Every property that varies is measured.* A column's height is oil plus water in Sm³ a day at a
   fixed 0.5 px per 1 000 Sm³/d, printed by a tick at the track's left end labeled `40 000 Sm³/d` (US `250 000 bbl/d`; 20 px;
   the peak, 37 144, is 18.6 px). The split is the two measured rates. A column's width is its
   interval in days on a linear time axis (25 days for the first, 28 to 31 after), so nothing is
   projected or stretched. The scale is never fitted to what is on screen.
3. *It is captioned*, as a dated departure (2026-10-06; HOUSE 4.15 and 5.2: the owner's *"Norne full
   screen mode has too much text at the bottom"*, and the plan's *"Cut the caption to the legend and the
   scale, and move the rest into About"*). The caption band carries the cut's key, one line: `Oil
   lifted` (an ink swatch), `Water lifted` (the water's tint, with its `--ink-3` top) and `on the track`.
   The month's figures left the front: the track's value says them (`1 December 2006, 9.1 years after
   first oil. Oil 7361 standard cubic meters a day, water 16251, 69 percent water.`), the rates chart
   under More controls draws them with its cursor on the month, and About says how to read the cut,
   with its peak and its crossover. Every figure comes from the same two arrays the columns are drawn
   from.
4. *It reads.* On the player's page: the oil ink 15.75:1 (light) and 15.39:1 (dark); the water tint
   1.94:1 and 2.90:1 (a tone, deliberately faint, as the house's derived states are; its top edge is
   a 1 px `--ink-3` line at 4.78:1 and 5.88:1); oil against water 8.11:1 and 5.30:1; the thumb's
   `--page` ring on the ink 15.75:1 and 15.39:1 (`python3 norne-reservoir/tools/art/palette.py`,
   from `Template/`). `tools/shoot.mjs` samples the rendered track.
5. *It survives Reduce Motion.* It has no motion of its own. It is drawn once per size and per unit
   system, and the thumb moves only with the step.
6. *About says what it shows and what it does not.* It is the simulation's field production, the
   run of the public deck driven by the field's historical well controls, averaged over each month
   to the date shown; not the field's reported production (against the field's history the model
   lifts about 7 % less oil and 43 % more water, as `NOTES.md` says). Gas is not in it: at the
   surface the field's gas is measured in volumes about 220 times the oil's (218 over the run), so it is in the
   rates chart instead, and so is injection.
7. *It is the only bold element* on the chrome. The rest passes section 7.

**Drawn exactly so** (in `js/track.js`, on the track's canvas; the series from `js/data.js`):

- The track canvas is 58 px tall, the house's. The baseline at y = 34: a 1 px `--line-strong`
  line, inset 10 px from each end, the first report date at the left inset and the last at the right,
  linear in days. At 390 px the track is 230 px wide, so a month is 1.6 to 2.0 px (5 to 6
  device pixels at DPR 3).
- For each device-pixel column, the report interval under it (the interval that ends at report
  date f covers the days from date f - 1 to date f, which is how `pipeline/extract.py`'s `avg_rate`
  builds the rates): from y = 32 up (a 2 px `--page` gap above the baseline, so the house's "exposure
  so far" line stays its own mark), oil at 0.5 px per 1 000 Sm³/d in `--cut`, then water on it in
  `--cut` at `--cut-water-a` (0.30 light, 0.34 dark), then a 1 px `--ink-3` pixel at the liquid's
  top. Every month is drawn, before and after the shown one: the record is complete.
- The scale: at the left end, a 3 px `--ink-3` tick at the 40 000 height (20 px above y = 32) with
  its value and unit over it, `40 000 Sm³/d` (U+202F in both places), in 10.5 px `--ink-3`, the
  label's foot 1 px above the tick, at y = 11. In US units the scale is 0.08 px per 1 000 bbl/d and
  the tick reads `250 000 bbl/d` at the same 20 px (40 000 Sm³ is 251 592 bbl, rounded down to a
  round value). The label runs 57.6 px (SI) or 59.5 px (US) into the track; the columns under it top
  out between y = 12.3 and 16.2 (at 320 and 390 px wide, both systems), under the label's foot, so
  the label never sits on ink. `tools/shoot.mjs` checks both systems at both widths.
- The graduation: no per-step ticks (110 steps at under 2 px would be a gray smear; a stated
  departure, as Besseggen's); a 7 px `--ink-2` tick under the baseline at each 1 January with a
  10.5 px year label (`1998` to `2006`, years never grouped), labels that would collide skipped (at
  390 px every other year shows).
- No `now` notch: the data ends on 1 Dec 2006, and the present is outside it. About names the
  edition (section 3), so there is no ran-out sentence either: this is a history, not a forecast.
- The thumb: the house's tracer head on the baseline at the shown report date (the right edge of its
  column), never gliding: an 8 px `--ink` disc in a 3 px `--page` ring, 10 px while a finger is on
  the track, with a 1.5 x 18 px `--ink` rule through it that crosses the column's foot.
- Accessible: the track keeps `role="slider"`; `aria-valuetext` says the date, the lead and the
  month's cut in words, its figures without their group spaces so VoiceOver reads each as one
  number: `1 December 2006, 9.1 years after first oil. Oil 7361 standard cubic meters a day, water
  16251, 69 percent water.` The whole history is its description (`aria-describedby` on a visually
  hidden sentence written at boot and again when the units change): `The cut: the liquid the field
  lifted per day, month by month, from November 1997 to December 2006. Oil peaks at 35735 standard
  cubic meters a day in the month to 1 November 2000. Water passes oil from the month to 1 July
  2004.`
- Cost: 110 numbers, drawn into the canvas once per size, per theme and per unit system; the thumb
  is a second, cheap pass. Nothing is recomputed per frame.

---

## 2. Palette

`tools/art/palette.py` (written in this pass; run from `Template/`, standard library only) holds
every value below and ended `ALL CHECKS PASS` with exit 0 (`python3
norne-reservoir/tools/art/palette.py`). `--json` prints what `config.json` takes (`colormaps`, the
light theme, in the evenly spaced shape `lut()` has always read; `colormapsDark`; `wellColors`) and
the rates chart's three series per theme, which `style.css` carries as tokens. The builder pastes
the output; `tools/check.mjs` fails while `config.json` and `--json` differ. `config.json` is the
app's settings file, not data: no pipeline writes it (`grep -rn config.json pipeline scripts` finds
only `scripts/package.sh` copying it), so the pass wrote its color fields, and the app still reads a
copy in the old shape (one scale for both themes, the explode distances under their older key names).

### The chrome tokens

The house tokens of HOUSE 3.1, copied exactly, in both themes. Measured by the same run:

| Pair (WCAG 2) | Light | Dark |
| --- | --: | --: |
| `--ink` / `--ink-2` / `--ink-3` on `--page` (white since 2.2) | 17.35 / 7.75 / 5.60 | 14.43 / 7.76 / 5.88 |
| `--ink` / `--ink-2` / `--ink-3` on `--sheet` | 16.40 / 7.32 / 5.29 | 12.87 / 6.92 / 5.25 |
| `--line-strong` on `--page` | 3.83 | 3.56 |

Highest chroma of any chrome token: 0.0239. The stock look's `--stage`, `--panel`, `--muted`,
`--rule`, `--accent`, `--accent-ink`, `--glass`, `--c-oil`, `--c-water`, `--c-gas`, `--face-narrow`
and the Avenir stack go, with every `backdrop-filter` (four rules), `box-shadow` (three),
`text-shadow` (two) and the 50 % radii.

### The signature, per theme

| | Light (the negative) | Dark (the print) |
| --- | --- | --- |
| Ground | the player's `--page` `#ffffff`, L 1.000 (`#e8eef0`, L 0.945, before 2.2) | `--page` `#141d21`, L 0.224 |
| The track's other marks | baseline `--line-strong`, ticks and the liquid's top `--ink-3`, year labels `--ink-2`, thumb `--ink`: all between the page and the ink | the same |
| Signature | `--cut` `#12150b`, OKLCh (0.189, 0.0198, 122): crude, an olive near-black; water its tint at 0.30 (`#b8b9b6` on the page) | `#eff5e7`, OKLCh (0.962, 0.0195, 126): a pale straw; water at 0.34 (`#5e6664`) |
| Beyond `--ink`? | yes: L 0.189 against 0.218 | yes: L 0.962 against 0.941 |
| Worst measured | oil 18.46; water 1.97; oil against water 9.36; top line 5.60; ring 18.46 | 15.39; 2.90; 5.30; 5.88; 15.39 |

A near-neutral (chroma 0.0198 and 0.0195, under the house's 0.021), not `--ink` and not a hue of any
data scale. Its distances to the template's other signature inks, printed by the same run: light,
dE 0.034 to Global Weather's streak, 0.038 to Milky Way's Reach, 0.023 to Besseggen's Burn; dark,
0.012, 0.027 and 0.018. Near-neutrals at the far end of a range are close in color by construction;
the Cut is a different mark in a different place, and its hue (122° to 126°, crude oil's olive) is
its own (the others sit at 231°/95°, 258°/253°, 52°/75°).

### The plate: printed twice

The grid shader (`app.js`, `GRID_FS`) multiplies each cell's color, as the texture's sRGB numbers,
by a light factor of 0.42 + 0.5 lambert + 0.14 fill: 0.42 on a face turned from both lamps, about
0.83 on a top face from the default camera, at most 1.06 (clamped); a cell edge multiplies by 0.55.
`palette.py` runs every plate check over the base colors at the factors 0.42, 0.62, 0.83, 1.00 and
1.06; `tools/shoot.mjs` samples rendered frames.

| | Light (the negative) | Dark (the print) |
| --- | --- | --- |
| Ground (`--plate`, the WebGL clear color) | `#ffffff`, the page itself (the film base `#e8eef0` before 2.2): the plate's edge is the edge | `#0c1316`, OKLCh (0.181, 0.012, 226): a stated slate darker than the page, as Global Weather's globe sits on `#0a1013` |
| Data band | L 0.975 (salience 0) to 0.420 (salience 1) | L 0.330 (salience 0) to 0.880 (salience 1) |
| The body off its ground | a salience-0 top face `#cbcec8` against the ground: dE 0.153, 1.59:1 (0.098, 1.36:1 on the gray) | `#2b2d29`: dE 0.114, 1.35:1 |
| What stands at the far end | the labels' ink on its halo; the wells' casing | the labels' ink on its halo; the wells' bright cores |

**The scales' "nothing" end on white** (2.2; HOUSE 12 asks for it measured). The light scales' salience-0
end (L 0.975) was tuned to fade into the gray, and it is measured on `#ffffff` where it is drawn
(`palette.py`, its block on the nothing end). Lit, as the 3D view draws a face: at a top face from the
default camera (0.83) every scale's end stands off white by dE 0.152 or more (1.57:1; `layers` 0.201),
and at the brightest factor the shader reaches (0.950, the most `0.42 + 0.5 lambert + 0.14 fill` can be
for one normal) by dE 0.062 or more (1.19:1). On the old gray those brightest faces were the weak case,
dE 0.007 to 0.014 (1.02:1): white is the better ground for the lit model. Unshaded, as the legend's bar
and the section's cells draw it, the end is dE 0.027 to 0.039 from white (1.06 to 1.08:1; `layers`
0.086), about as on the gray (0.030 to 0.044, 1.08 to 1.09:1), and not enough to see a pale cell's
edge by: so the legend's bar keeps its `--line-strong` frame at 60 %, and the section strokes a 1.5 px
`--line-strong` rim under its cells, whose outer half (3.83:1 on white) outlines the cut and its gaps.
Since 2.4 this paragraph is about the house ramps alone (the saturations and the layers): pressure and
the rock start dark (D16, below). The scales themselves did not move: `palette.py --json` prints the same stops on white, and
`config.json` is unchanged.

**The ten scales** (`palette.py` prints each one's stops; every one is monotone in lightness, its two
ends separate by dE 0.475 or more in all four visions, every eighth steps by dE 0.049 or more as
rendered on a top face, and the 33 stored stops interpolated as `lut()` does stay within dE 0.0054 of
the OKLab path):

| Scale | Properties | Hue logic kept | Light, salience 0 to 1 | Dark, salience 0 to 1 |
| --- | --- | --- | --- | --- |
| `oil` | Oil saturation, 0 to 1 | oil green, the reservoir-display convention the stock app used | `#f5f8f1` to `#005d38` | `#343631` to `#8ff0b9` |
| `water` | Water saturation, 0 to 1 | water blue | `#f1f8fd` to `#234993` | `#31363a` to `#c3d8ff` |
| `gas` | Gas saturation, 0 to 0.90 | gas red | `#fdf5f1` to `#8d1920` | `#3a3431` to `#ffc8c3` |
| `pressure` | Pressure, 200 to 450 bar | since 2.4 matplotlib's **plasma** (plan 0012 D16): blue-violet through magenta and orange to yellow, dark to light in both themes; magma's violet-to-orange path printed twice before | `#0d0887` to `#f0f921` | the same stops |
| `rock` | Porosity, 0.13 to 0.35; both permeabilities, log | since 2.4 matplotlib's **viridis** (D16): violet through blue and teal to green and yellow, dark to light in both themes; viridis's hue path printed twice before | `#440154` to `#fde725` | the same stops |
| `sand` | Net to gross, 0 to 1 | since 2.4 **viridis**, as the rock (D16); a sand path, `#fbf6ee` to `#6d4201` light, before | `#440154` to `#fde725` | the same stops |
| `depth` | Depth, the model's own 2 467 to 3 062 m | since 2.4 **viridis** (D16), the shallowest violet and the deepest yellow; blue as charted water depth before | `#440154` to `#fde725` | the same stops |
| `layers` | Layer (K), 1 to 22 | new: a stone sequence, since K is ordered and 22 categorical colors could not be told apart | `#f1e2cf` to `#723c2e` | `#4d4232` to `#ffc9bb` |

**Plan 0012 D16: plasma and viridis, the owner's exception (2.4).** The owner did not like the pale
single-hue ramps for pressure, porosity, permeability and the like (*"i dont like the colortables for
pressure, porosity, permeability etc"*), shown against Turbo, plasma and viridis, and Jet on Volve
(`docs/marketing/reference/0012-ramps-board.png`), and chose plasma for pressure and viridis for the
rock: porosity, both permeabilities, net to gross and depth. The stops are matplotlib 3.9.4's own
256-entry tables sampled at the 33 places `lut()` reads (`palette.py`'s `MPL`, its source file and
hash named there), the same in both themes. The saturations keep their own ramps exactly, at the
owner's word (*"keep the original ones for the saturations"*), and so do the layers, the formations,
the segments and the wells' colors; `check.mjs` pins those scales as 2.3.1 stored them. **This is the owner's
exception to the tonal budget for data colors** (HOUSE 3.2, its dated line): these four scales run dark
to light in both themes, so they are not printed twice, do not live in the data band, and in the light
theme "more" pressure or porosity is the lightest color, nearest white in lightness. What the band was
for is measured on them directly (`palette.py`, the block headed D16 and every block over all bases):

- **The darkest end on the dark plate** (`#0c1316`): plasma's `#0d0887` stands off it by dE 0.211
  (1.25:1) unshaded, viridis's `#440154` by 0.173 (1.23:1); on a top face from the default camera
  (0.83) by 0.172 and 0.140; on a face turned from both lamps (0.42) by 0.092 and 0.083 at 1.04:1, and
  at a cell edge (a further 0.55) by 0.081 and 0.084. So a low-pressure or tight cell's sides read as
  a deep violet on the slate by hue, hardly by lightness; its top faces and the lit model around it
  carry the shape. Few cells sit there: pressure under 200 bar and porosity at the scale's foot.
- **The light end on white**: plasma's `#f0f921` stands off `#ffffff` by dE 0.212 at 1.15:1 unshaded,
  viridis's `#fde725` by 0.203 at 1.26:1; on a top face by 0.252 and 0.258 (1.70 and 1.86:1), at the
  brightest face by 0.217 and 0.214 (1.29 and 1.41:1). A strong yellow on white, told by hue and by
  the cell edges; the legend's bar keeps its `--line-strong` frame at 60 % and the section its 1.5 px
  `--line-strong` rim (3.83:1), so the bar's and the section's light ends have an edge. The other two
  pairs are far apart: the light ends on the dark plate 14.85 and 16.31:1, the dark ends on white
  15.24 and 14.98:1.
- **Over every stop of the new tables**, at every light factor: the labels' ink on its halo worst
  12.38:1 light and 10.62:1 dark; a well's core on its casing worst 4.17 and 4.31; the ghost key 3.76
  and 4.43; the compass (section 3) 3.55 and 3.64 for its fainter arm.
- Both tables are monotone in OKLab lightness (plasma L 0.293 to 0.944, viridis 0.285 to 0.918), their
  ends apart by dE 0.626 or more in all four visions, every eighth a step of 0.080 or more on a top
  face, and the stored stops within dE 0.0038 of the table as `lut()` interpolates them.

What was given up, plainly: the house's rule that "more" stands further from the ground in both
themes, for these four scales; and a value of pressure or rock now has one color in both themes,
where the house prints it twice. The saturations, the layers and the categories are as they were, and
the legend under the plate is always the scale the plate uses.

**Ends the data goes past, printed open.** Measured over all 110 report dates
(`python3 tools/.work/ranges.py`): pressure spans 56.4 to 612.5 bar against the scale's 200 to 450,
with up to 1 719 cells outside it on 1 Nov 2005; gas saturation reaches 0.922 against 0.90;
horizontal permeability has 13 cells under 1 mD; vertical permeability 101 cells under 0.1 mD and 5
over 2 000 mD. Those ends print `≤ 200`, `≥ 450 bar`, `≥ 0.9`, `≤ 1`, `≤ 0.1` and `≥ 2 000 mD` (as built, the gas end prints `0.9` like the scale's other ticks, which drop trailing zeros)
(HOUSE 4.5). Porosity, net to gross and depth stay inside their ranges, so their ends print plain.
`model.json`'s `dynamic.pressureRange` (56 to 613) is the 16-bit encoding's range, the floor and
ceiling of the run's own extremes (`pipeline/extract.py`), so the pressure ends are known at boot
without a scan; gas needs one pass over the 110 frames' bytes, once.

**Categories** (one set for both themes, inside both bands' overlap, L 0.45 to 0.86; every pair
separates by dE 0.10 or more in all four visions, and every color by 0.22 or more from both
grounds):

| Set | Colors | Worst pair |
| --- | --- | --- |
| Formations | Garn `#f2cd6f`, Not `#bababa`, Ile `#329e9e`, Tofte `#be563d`, Tilje `#534b97` | 0.104, Garn and Not under tritan |
| Fault segments | 1 `#e1ca74`, 2 `#37a1b8`, 3 `#bc5243`, 4 `#5a478b` | 0.161, 2 and 3 under deutan |

Not, a shale, has no active cell in this grid (`ijk.bin` holds no K = 4, `tools/.work/ranges.py`),
so it is never drawn and the legend leaves it out; it is checked anyway. The fluid-in-place regions
are formation by segment: FIPNUM 1 to 4 lie in K 1 to 3 (Garn), 5 to 8 in K 5 to 11 (Ile), 9 to 12
in K 12 to 18 (Tofte), 13 to 16 in K 19 to 22 (Tilje), the same `ranges.py` run. So the stock
`Regions` view (16 colors, unlabeled) becomes `Segments` (4, named), and the card still names the
region (owner call 4).

**The wells.** Role colors kept from the stock logic (a producer green, a water injector blue, a gas
injector red, a shut well gray), fitted so each core stands off its casing over every base:

| Role | Core (both themes) | Core on its casing over the worst base | Also carried by |
| --- | --- | --- | --- |
| Producer | `#90faa8` | light 8.59, dark 13.70 on the bare casing (over the white ground since 2.2); worst 4.17 or more over any base | a solid line |
| Water injector | `#7cc2fd` | 5.75, 9.17 | a dashed line |
| Gas injector | `#ef806f` | 4.17, 6.66; worst over any base 4.17 (light, over white) and 4.31 (dark, over plasma's yellow; 4.37 before 2.4) | a dashed line |
| Shut | `#6f7274` | 2.27, 3.62: faint on purpose | 60 % of the width, half see-through |

The casing is the stock dark outline (`#0f1c23` at 0.85, 1.25 px each side), kept. Roles separate by
dE 0.118 or more in the four visions (worst: the gas injector and a shut well under protan), and the
dash and the weight carry the role besides, so color is never its only carrier. The stock cores
(`#2E9E5B`, `#2F74D0`, `#D0493A`) sat at the oil, water and gas scales' own hues and lightness, so a
producer vanished into an oil leg (`tools/.work/look/light-8-explode.png`: the green producers over
the green oil); the new cores are all lighter than any data color's dark end and sit on a dark casing.

**Labels on the plate** (well names, formation names when exploded, and the section's names): `--ink`
on a 3 px halo at 0.85 of the theme's ground (`#ffffff` light since 2.2, `#f6f9fa` before; the plate
ground `#0c1316` dark): worst 12.38:1 and 10.62:1 over every base (text, ≥ 4.5; 12.63 and 10.83 before 2.4's plasma and viridis).

**The ghost key** (focus mode): a 1.4 px stroke at rest (72 %) over a 3.4 px halo: light `#0f1c23`
over `rgb(246,249,250)` at 0.60, worst 3.76:1 (3.91 before 2.4); dark `#f2f4f1` over `rgb(10,16,19)` at **0.70** (the
house's 0.45 measured 2.44:1 over the print's bright ends), worst 4.43:1 (4.68 before 2.4).

**The rates chart** (in the controls sheet, on `--page`): oil at its scale's far end, water a step
nearer the page, gas at 0.85, produced solid and injected dashed: light `#005d38` 8.01, `#4479b8`
4.49, `#a63430` 6.66 (on the white page); dark `#8ff0b9` 12.49, `#75acef` 7.25, `#ffa59b` 9.05 (marks, ≥ 3). Oil and water
share the liquids panel and separate by dE 0.146 and 0.155 at worst; gas has its own panel.

### CSS custom properties this app adds

`--plate` (`#ffffff`; dark `#0c1316`), `--cut` (`#12150b`; dark `#eff5e7`), `--cut-water-a` (0.30;
dark 0.34), `--plate-halo` (`rgba(255, 255, 255, 0.85)`; dark `rgba(12, 19, 22, 0.85)`),
`--chart-oil`, `--chart-water`, `--chart-gas` (the `chart` block of `--json`, per theme). `app.js`
reads `--plate` for the WebGL clear color, and `js/track.js` reads `--cut` and `--cut-water-a` for the
track.

---

## 3. The chrome, object by object

Norne Reservoir is HOUSE 4.0's *3D view with time*: the time is the production history. It keeps a
controls sheet (HOUSE 4.10's "any sheet of controls") for the explode, the rates chart and the
section cuts, which need the model in view while they move. The frame at 390 x 844 (CSS px, safe
areas outside):

```
+------------------------------------------+
| Norne Reservoir                          | 22  name 15/650 (the stamp's line, under it,
|                                          |     only while the files load or on an error)
| Oil  Water  Gas  Pressure | Por [About][SI] | 44  the property words; About; the units key
+------------------------------------------+
| (N)                                 [+]  |     the compass, top left (2.4);
| [card]                              [-]  |     the plate: the grid, printed per theme,
|                                     [#]  |     wells on their casing, names on halos;
|                                     ---  |     keys: Zoom in, Zoom out, Show the whole
|                                     [W]  |     field / Wells, Section / Hide the controls
|                                     [S]  |
|                                     ---  |
|                                     [H]  |
+------------------------------------------+
| Along  Across  Draw                  [x] |     the section A-A' when it is open (under
| A                                     A' |     the model; beside it on a wide screen or a
| 2 600 |#######......######|              |     phone on its side): its lines, Draw, Hide;
| 2 800 m ...                              |     the cells it cuts, depth TVD, distance
|        0      2 000     4 000     6 000 m|     from A
| [/] No active cell  | Wells within 150 m  vertical x5 |
+------------------------------------------+
| Oil saturation    |=================|    | 30  the legend: title, bar, ticks, open ends
|                   0  0.25  0.5  0.75  1  |
| 3 km |------| vertical x5                | 20  the instrument line: the scale
| - producer  -- water inj.  -- gas  . shut| 15  the wells key (while Wells is on)
| [#] Oil lifted  [ ] Water lifted  on the track | 15  the cut's key
+------------------------------------------+
| 1 Dec 2006         9.1 years after first oil | 28  the time row
|  <  [>]  >   ..:|||||||||||:::...  *---  | 58  the transport; the Cut on the track
|              1998   2000   2002   2004   |
+------------------------------------------+
|                 ----                   ^ | 44  the grip: Show more controls
+------------------------------------------+
```

**The view's share of the screen** (2.2; the owner: *"when expanding the bottom section, the 3d view
becomes too small"*). Measured by `tools/shoot.mjs` at 390 x 844: with the sheet closed the model has
547 px (480 before 2.2: the stamp's line and the caption's sentence and credit left the front), 664 px
in focus mode. With the sheet at either raised stop it had 200 px of 844 (24 %) and now keeps 405 px
(48 %): the sheet rises only as far as leaves the view `--view-min`, `max(200px, min(48dvh, 100dvh -
432px))`, about half the screen and never under 200 px, while the sheet keeps at least 180 px on a short
phone; it scrolls inside itself, its grip held at its top. With the section open, the model and the
section share that view: 387 + 160 px with the sheet closed, 245 + 160 px with it raised. That was
chosen over compacting what sits between the view and the sheet, because what sits there is the
legend, the instruments and the player, which the view cannot be read or moved without. The page is a
one-column grid: header, the view (the plate, and the section under it), caption band, player, sheet;
`100dvh`, `overscroll-behavior: none`; the sheet's row `minmax(0, max-content)`. `shoot.mjs` holds
the model at 530 px or more with the sheet closed, 590 or more in focus mode, and the view at 47 % or
more at every stop, with and without the section. Wide screens (≥ 820 x 480) keep the sheet as a
380 px column at the right; a phone on its side, the last rows of the table.

| Object | Here | Notes |
| --- | --- | --- |
| **Header: name** | `h1` `Norne Reservoir`, 15/650, `translate="no"` | `miniapp.json`'s name (the Library row the camera opens). The stock `model.name` (`Norne`), the 28 px condensed title and the `Norwegian Sea` subtitle go; the sea is named in About. |
| **Header: the stamp's line** | 11.5 px `--ink-2`, one line, under the name, only while the files load (`Reading the model… 3 of 7`) or when they could not be read (`The model could not be read.`) | Data built once (HOUSE 4.2, 4.15): once every file is in, the line hides and the `About` key takes its place. The edition, `Norne benchmark, OPM Flow 2026.04 run` (the run's name and version taken from `model.json`'s `source`, never retyped), is About's first row, `Edition`. `shoot.mjs` holds the line at one line, 16 px, in every state the app writes into it. |
| **Header: About key** | `About`, a word key like the units key, at the right end of the row of words, before the units key | `aria-haspopup="dialog"`; shown once every file is in, hidden on an error (the line says why); opens About from every screen. In focus mode it moves into the caption band, at its right, and back. |
| **Header: units key** | at the right end of the row of words: `SI`, then `US` (owner call 5) | A word key in a 1 px `--line-strong` frame, 28 px tall, 6 px radius, a 44 x 44 hit, 600 at 12.5 px. Its accessible name says the system and its units: `Change units, now SI: bar, meters, cubic meters a day`. One system for every quantity (pressure bar or psi, depth and the scale bar meters or feet, oil and water Sm³/d or bbl/d, gas Sm³/d or Mscf/d; permeability stays mD in both), a stated departure from the house's one-quantity key, since an engineer switches the system, not a unit. Remembered as `norne-viewer:v1:units`. |
| **Row of words** | the twelve properties as words in full, `role="radio"` in a `role="radiogroup"` named `Property`, the tracer under the chosen one; a 1 px `--line` divider between the four that change with time and the eight that do not | `Oil`, `Water`, `Gas`, `Pressure` (the camera's words, kept exactly), then `Porosity`, `Permeability`, `Vertical permeability`, `Net to gross`, `Depth`, `Formations`, `Segments`, `Layers`. The stock `Perm X`, `Perm Z`, `NTG` and `Regions` go (words in full; owner call 4 for Segments). Scrolls sideways inside itself, its right edge fading over 22 px while more words lie past it (so it reads as a row that scrolls, not one cut off at the About key); 44 px hits. The stock 3 px gradient underline (`--grad`, a swatch, HOUSE 4.3) goes: the legend shows the scale. One tab stop for the group, the chosen word; the arrow keys move the choice inside it, as in the explode words. |
| **Key column** | `--sheet` plates on the plate's right edge, inset 8 px: `Zoom in`, `Zoom out`, `Show the whole field` / `Wells`, `Section` / `Hide the controls` | 44 x 44 hits drawn 36 x 44, 16 px marks in 1.5 px strokes, `--ink-2` at rest. Zoom keys move `S.cam.dist` by 0.7 and 1/0.7 through `flyTo` (one-finger and keyboard zoom, WCAG 2.5.1, where the stock app zoomed by pinch or wheel only). `Show the whole field` (the camera's key, the stock round frame button) draws four corner brackets around a small three-by-two block of cells, not the house's Whole world circle. `Wells` (`aria-pressed`, the stock `t-wells` checkbox moved) draws three wellheads on a line, each dropping a stroke of a different length. `Section` (`aria-pressed`) shows and hides the section A–A′: a line over a vertical plane with a block cut out of it. Where six keys do not fit the plate's height (a plate under 302 px: the section open with the sheet raised, a phone on its side), they run as a row along the plate's top; where that row does not fit the plate's width either (the section beside the model), they take whichever of two forms fits inside the plate and leaves the model larger, measured against the rooms it is fitted to: two rows in the plate's top right (the zoom plate over the other two; with the sheet raised beside the section at 844 x 390) or the three plates side by side (the 160 px strip). `Show the whole field` fits the field by its projected box (two corners of every fourth cell, as exploded, and the well heads) to both of the plate's axes, in the room left of the key column or below the key row, with 26 px above for the names; a lens shift puts the field's middle at that room's middle. A camera still at the fit is fitted again whenever the plate changes size (focus mode, the sheet's stops, a turn of the phone, the explode, the vertical stretch); one moved by hand keeps its zoom against the fit. On a plate much wider than tall the eye comes down from 36° toward 24°. |
| **Caption band: the legend** | 30 px: the property's label from `config.json` as the title (`Oil saturation`, 600 at 11.5 px `--ink`), the 6 px bar in the remaining width, ticks at round values, the unit after the last label | Painted from the same 256-entry `lut()` the plate uses, unshaded, over `--page`; 1 px `--line-strong` frame at 60 %, square ends. Open ends as section 2 lists. Log scales tick at decades (`≤ 1`, `10`, `100`, `1 000`, `4 000 mD`). Categories: named swatches in one row (`Garn`, `Ile`, `Tofte`, `Tilje`; `1` to `4` titled `Fault segment`); `Layers` a bar with ticks at `1`, `5`, `12`, `19`, `22` (the four formations' first layers and the last). **This ends the recorded bug B1**: the stock bar stood on the plate, centered on its height, and met the header whenever the plate shrank. |
| **The compass** (2.4, plan 0012 D17) | the plate's top left, 8 px in (8 px under the top safe area in focus mode): a 36 px disc of `--plate` at 0.80 with a 1 px `--line` rim; a two-tone needle 17 px long and 6.4 px across, the north arm `--ink`, the south `--ink-3`; `N` at the north tip, 11 px 650 `--ink`, upright | The owner: *"And the north arrow seems to have gotten lost?"* The house pass had moved the stock compass into the instrument line as a 16 px needle, which, turned and foreshortened, read as a smudge. Top left, because Snuggery's full-screen exit control sits top right and the keys run down the right. It turns with the model from the projection `updateGauge()` already made: rotated to north at the camera's target and shortened as north leans into the view (north's screen length against east's), never under half its length and never narrower; the N moves with the tip. It takes no touch (a drag on it turns the model). Its name is the one the needle had: `North arrow: north is toward the right of the view.` Shown in every state, focus mode and on its side included; the card goes below it, 4 px clear (6 px from a key, whose hit the card's Close must not meet; the compass takes no touch), the well names and their 44 px hits keep off it, and a tapped cell's ring under it hides. 36 px and not 38: at the sheet's raised stops (a 405 px plate) the full card still fits beside a cell anywhere below it, with 1.7 px to spare; 38 px and 6 px left it 0.3 px short and the card compact. Over every base at 0.80 (`palette.py`): the north arm and the N worst 10.99:1 light and 8.92:1 dark, the south arm 3.55 and 3.64 (marks, ≥ 3); the arms 3.10 and 2.45:1 apart. `shoot.mjs` checks it at rest, turning, at every sheet stop, with the section, in focus mode, on its side and under every card. |
| **Caption band: the instrument line** | 20 px: the scale bar and its words | The stock compass and scale bar left the plate (HOUSE 4.1), as Besseggen's did; from the house pass to 2.3.1 north was a 16 px needle here, and since 2.4 it is the compass on the plate (above). Scale: a 2 px `--ink` bar with 4 px end ticks, its length before it (`3 km`) and `vertical ×5` after it in 11 px `--ink-2`. `updateGauge()` moved, not rewritten; written through `units.js`; never transitioned. |
| **Caption band: the wells key** | 15 px, while `Wells` is on: four drawn samples (solid green, dashed blue, dashed red, thin gray) and `Producer`, `Water injector`, `Gas injector`, `Shut` at 10.5 px | A group named `Wells key`. The stock key left the header, where it sat over the model (B3). |
| **Caption band: the cut's key** | one 15 px line at 11.5 px `--ink-2`: a 10 px swatch of the cut's ink and `Oil lifted`, a swatch of its water tint (with the 1 px `--ink-3` top the track draws) and `Water lifted`, then `on the track` | Since 2.2, in place of the caption line that said the month's figures (section 1, test 3; HOUSE 4.15's dated Norne departure). The caption band holds no credit: `Data: Norne benchmark, Equinor and the Norne partners via the Open Porous Media initiative, ODbL 1.0` (owner call 6) is About's first *Sources and credits* paragraph, word for word, with `model.json`'s `source` sentence and the license after it. |
| **Player: time row** | the one large figure `1 Dec 2006` (600 at 21 px); the lead at right, 12.5 px `--ink-2`: `9.1 years after first oil`, `25 days after first oil`, or `First oil` at the first report date | Report dates are instants (the restart's date), so the figure carries the day; the first is `6 Nov 1997`. By hand in `js/units.js`, day before month, the same on every locale. VoiceOver hears `1 December 2006`. Below 60 days the lead counts days, then years to one decimal. Empty until boot completes. Nothing in the row transitions. The stock 30 px condensed date at the header's top right goes, which also ends its overlap with Snuggery's full-screen exit control on iOS 18 (B2). |
| **Player: transport** | `Back one month`, `Play production history` / `Pause`, `Forward one month`, 44 x 44 | Play is the one solid control: a 32 x 32 `--ink` square, 8 px radius, a `--page` triangle; while playing, two 2.5 px bars, toggled by attribute so the mark always matches its name (HOUSE 4.6). The step keys say the new date in the live region. The stock ochre disc goes. |
| **Player: the track** | `js/track.js` on Global Weather's pattern: `id="slider"`, `role="slider"`, 110 steps, `aria-valuetext` in words, the Cut drawn in it (section 1) | Left and Right a step; Page Up and Page Down twelve (a year; a stated departure from the house's eight); Home and End the ends. **The scrub rule holds**: input records `wanted`; the frame decodes the newest wanted step's colors (`fillValues`, the LUT pass and one texture upload), sets `shown`, then draws; the time row, the lead, the caption, the card, the chart's cursor and `aria-valuenow` read `shown`. Stale requests are dropped. With a value filter on, the frame also rebuilds the faces (the costly path); there is no preview, a slow phone draws fewer frames, each whole. `shoot.mjs` counts frames whose texture step differs from the label's step (must be 0) and prints the color pass and face rebuild times as a trend. The stock `<input type="range">` goes. |
| **Play** | the history at `config.json`'s `playbackFramesPerSecond` (6 steps a second, 18 s end to end) on the clock, from the shown step to the last, where it stops; Play at the end starts from the first | Every frame is one whole step. Reduce Motion: the same whole steps (it already is). A touch on the track stops it, landing on the step under the finger; hidden stops it. About holds play still, and closing it lets play go on (HOUSE 4.6). The expensive work runs only when the step changed (HOUSE 4.6's second rule: at 60 Hz, nine frames in ten during play draw nothing new); a counter in the test hook proves it. |
| **Readout card** | the tapped cell or well: `--sheet`, 1 px `--line-strong` edge, 8 px radius, inset 8 px, at most 55 % of the plate's height with the sheet closed or in focus mode and half of it otherwise; in a corner of the room the keys leave, never over the selection's mark, in its full form (at most 280 px wide) or, on a short plate, its compact one (below the table); what scrolls ends on a row's edge, with a 1 px `--line-strong` rule at its foot when more follow | Cell: the place line `Cell I 41, J 66, K 15, Tofte` (12.5 px `--ink-2`) with ✕ (SVG, a 44 px hit, `Close`); the one figure, the shown property's value with its unit (`287 bar`; a saturation `0.62`; a category its name, `Tofte`); rows at 12.5 px, labels `--ink-2`, values 560 `--ink`, in full words: at the date (`Oil saturation`, `Water saturation`, `Gas saturation`, `Pressure`), then the rock (`Depth`, `Porosity`, `Horizontal permeability`, `Vertical permeability`, `Net to gross`, `Fault segment`, `Fluid-in-place region`). Well: `Well C-4H`; the figure its main rate at the date (`412 000 Sm³/d` of gas injected), `Shut` or `Not yet open`; open in a role the summary holds no rate for, what it is doing, as the `Now` row says it (`Producing`, under it `no rate reported for the month to 6 Nov 1997`); a rate is dated `Water injected in the month to 1 Jul 2004`, since the pipeline averages it over the month, never `Shut` beside a `Now` that is not; rows: what it is doing in words (`Producing`, `Injecting water`, `Injecting gas`, `Shut`), its roles over the history, its completions (`7 cells, layers 1 to 20`), its open span (`Nov 1997 to Dec 2006`), its rates at the date. A text key, always in view: `Zoom to cell` or `Zoom to well`, under the figure's line (beside Close in the compact form). The tapped cell is also marked on the plate: a 14 px ring, 1.5 px `--ink` on a 2 px `--plate-halo` outline, at the cell's middle, which the card keeps clear of (below the table). In: 120 ms fade and 4 px rise; out at once. **Updated in place per step** (the stock `refreshCard()` emptied and rebuilt the list on every step of play). A tap says it once: `Cell I 41, J 66, K 15, Tofte. Oil saturation 0.00 on 6 November 1997.` The stock glass card, its 16 px condensed title and the two-column grid go. |
| **Labels on the plate** | well names 11.5/560 `--ink` on the 3 px halo, a 10 px sample of the well's role line before the name; formation names (exploded by formation) 11.5/560 on the same halo; no pill, border or background | Each well label stays a `<button>` (tap to select). As built, the labels take no touch themselves (a drag that starts on one still turns the model): `app.js` reads a tap on a name's own text, padded to 24 px tall (WCAG 2.5.8), as a tap on its well; its 44 x 44 box, grown upward from the text and away from the rock under the well head, counts only where no cell is under the finger, and the labels stay buttons for VoiceOver and the keyboard. Widths measured in `"Ysabeau Office"` after `document.fonts.load`. Labels are kept out of the card's, the key column's and the ghost key's rectangles (HOUSE 4.7) as well as each other's (the stock collision pass, extended). The chosen well's name is always drawn, under its head when the card or the keys hold the place over it. If WebKit does not paint `paint-order: stroke fill` under HTML text (a phone check), eight zero-blur 1.5 px `text-shadow` offsets in the halo color are the fallback, as Milky Way's. |
| **The wells** | the stock three passes (see-through, casing, core), with injectors dashed and a shut well thin and faint | `WELL_VS` gains a per-vertex distance along the path; the fragment shader discards the dash's gaps for codes 2 and 3 (a dash of about 8 px on screen, its world length from `S.cam.dist`). A shut well: 60 % of the width, alpha 0.5, as the stock alpha already was. |
| **About** | a full-height `--sheet` panel from the `About` key: `role="dialog"`, `aria-modal`, slides up 220 ms on `--sheet-in`, closes at once, `Close` at the top right and at the foot, Escape, focus held and returned | New; the stock app had none. **1. What the picture is**: each cell colored by its value on the scale under the plate, at the report date shown; the light on the faces and the darker cell edges are display, not data; the depth stretched ×5 by default; ends the data goes past printed open; the explode a display distance (110 m between formations, 22 m between layers, segments spread by 0.4); the Cut, what it shows and what it does not (section 1, test 6); the wells' paths from the deck's completions, their roles from the schedule. The section: what it shows and what it does not (section 3, *The section A–A′*). **2. This data**: `label: value` lines: the edition (`Norne benchmark, OPM Flow 2026.04 run`), the grid (46 by 112 by 22, 44 431 active cells), the report dates (110, 6 Nov 1997 to 1 Dec 2006), the wells (36), the storage (saturations to 1/255, pressure to 0.0085 bar over 56 to 613 bar), the rates (Sm³ a day, averaged over the month to each date). **3. Sources and credits**: the credit line, `CREDIT`, word for word; `model.json`'s `source`, verbatim; the license as `ATTRIBUTION.txt` names it, under a US-spelled label: `License: Open Database License (ODbL) 1.0, opendatacommons.org/licenses/odbl/1-0/` (the address without its scheme); the check against the published reference results; `Type: Ysabeau Office by …` (section 4). **4. How the data gets here**: built once by `pipeline/` on a Linux runner; nothing is fetched; `config.json` is re-read on return; how to move around (the gestures and the keys). The Norwegian Sea is named here. |
| **Controls sheet** | three stops, four in the column since 2.5 (the tall stop, below), on `--page` with a 1 px `--line` rule on top | **Grip**: a 36 x 4 px `--line-strong` bar centered and a drawn chevron 1.5 px `--ink-2` at the right (turned down where the next step hides), a 44 px hit (the stock 22 px), its names the stock three (`Show more controls`, `Show all controls`, `Hide the extra controls`) and, since 2.5, `Show Cells and view in full` at the second stop where the tall one follows. **Stop 0**: the grip alone. **Stop 1**: `Explode` (a house slider) with `Formations`, `Layers`, `Segments` as words with the tracer (`role="radio"`; the stock `select` goes); `Rates` (the chart, below) with the well picker. **Stop 2**: `Cells and view` (named `Section and view` before 2.2, when there was no section): `Columns (I)`, `Rows (J)`, `Layers (K)` and `Value range` as pairs of house sliders with their outputs (`1 to 46`), `Vertical exaggeration` (`×5`), `Well names` and `Cell edges` as house toggle rows (`aria-pressed`, a 28 x 28 key drawn on or off), `Show all cells`. The stock `Reset view` goes (it did what `Show the whole field` does; owner call 9). Sliders are the native range inputs drawn by CSS alone (a 1 px `--line-strong` track, the value so far 2 px `--ink`, an 8 px `--ink` thumb with a 3 px `--page` ring), labels 12.5 px `--ink-2`, values 12.5 px tabular, right-aligned. Section heads 13.5/650 sentence case between 1 px `--line` rules. Stop changes are instant. At stop 2 the sheet scrolls `Cells and view` up under the grip, since both raised stops are one height (smoothly, or at once under Reduce Motion); stop 1 opens at the sheet's top. Raised, the sheet takes no more than leaves the view about half the screen (the paragraph under the frame), and the grip stays at its top while it scrolls. |
| **The rates chart** | the stock SVG, redrawn: `Field rates` or `C-4H rates` as its title (13.5/650); the liquids panel and the gas panel; series in `--chart-oil`, `--chart-water`, `--chart-gas`, 1.5 px, injected dashed; gridlines 1 px `--line`; each panel's top value in full figures with its unit (the field's `50 000 Sm³/d` and `10 000 000 Sm³/d`) at 10.5 px `--ink-3` on a 3 px `--page` halo, the cursor passing under it; years at 10.5 px `--ink-2`; the cursor a 1.5 px `--ink` line at the shown step; a drawn key (line samples, `Oil produced`, `Water produced`, `Water injected`, `Gas produced`, `Gas injected`) | The stock `50 k` and `10 M` labels go (SI, B5). The well picker stays a native `select` (36 wells; a stated departure from the house's words, since a native list is the right control for 36 names), restyled: 44 px tall, a 1 px `--line-strong` frame, 6 px radius, its options built as DOM nodes, not markup. Tapping or dragging the chart seeks, through `wanted`. |
| **Notices** | a `--sheet` plate centered on the plate, `role="alert"`, 13.5 px, at most 300 px, no icon | In the file's terms, no apology: `data/model.json could not be read (HTTP 404).`, `data/dynamic.bin holds 19 549 000 bytes; 110 report dates need 19 549 640.`, `This phone gave no WebGL 2, which the 3D view needs.`, and, opened from a file: `This app reads its data over Snuggery's own server; opened as a file, the browser blocks it.` A broken `config.json` on a later read keeps the settings already loaded, as the stock app did, and says so once. The stock loading overlay, its progress bar and its `Could not open the model:` box go. |
| **Live region** | one `<p class="sr" aria-live="polite">` | A tap's sentence; a step key's new date; focus mode's two sentences. Never per frame. The stock `aria-live` on the date (it spoke every step of play) and on the card (it spoke every rebuild) go (B4). |
| **Focus mode** | `Hide the controls` alone in the column's last plate; the ghost key `Show the controls` (`aria-keyshortcuts="Escape"`) top-right of the plate, 8 px under the top safe area; Escape | Leaves (`hidden` and `inert`): the header (name, units key, the row of words), the key column, the controls sheet, an open card. Stays: the plate; the section, when it is open, with its own words and Hide; the `About` key, moved into the caption band at its right; **the legend, the instrument line, the wells key** (a stated departure: a false-color model cannot be read without its scale; owner call 7) and the cut's key; the player. A tap still opens the card; the double-tap still flies to a cell. **Remembered** as `norne-viewer:v1:focus` (`'1'` or `'0'`), restored before the first draw. Sentences: `Controls hidden. Press Escape or the corner key to show them.` and `Controls shown.`; focus moves only when the keyboard did it. Fades: chrome out 160 ms, the ghost key in 200 ms, one resize. |
| **The opening** | none | The arrival is the model appearing once its seven files are in; the stamp's line counts while they load, then hides. The stock overlay and the first-run hint card go (owner call 8); the gestures are in the canvas's description and in About. |
| **Motion** | HOUSE 4.12 | A camera move that answers a touch (`Show the whole field`, the zoom keys, a double-tap, `Zoom to cell`) keeps its 520 ms (the camera waits 2 s after the first) and takes `--draw`'s curve in place of the stock cubic in-out; any touch ends it at its destination. Under Reduce Motion they are cuts. The render loop requests a frame only while something is dirty, a flight runs or play is on. Hidden: play stops and the loop stops; a return re-reads `config.json`, as the stock app did, and redraws. |
| **On its side** | HOUSE 4.13 with the sheet as a right column, `min(340px, 45%)`; at the sheet's closed stop the column is only its grip, a 45 px strip with a chevron, on a wide screen too, because the full column left the plate 157 px tall at 844 x 390; in focus mode, here and on a wide screen, one column, the strip gone with the sheet | The header one 46 px row (the name at left, the words, the About and units keys); the section, when open, beside the model; the caption band's legend and the cut's key side by side (the About key after them in focus mode), the instrument line and wells key on the next row; with the sheet open, where the band is too narrow for the cut's key beside the legend, the key takes a row of its own under it (2.3: 2.2 cut its words off there); the player one row (the time row stacked at left, the transport, the track); the keys a row along the plate's top, or two rows where the section beside the model leaves the plate too narrow for one. At 844 x 390 the plate must be ≥ 220 px, measured by `shoot.mjs`. The card takes its compact form here. |
| **Safe areas** | HOUSE 4.14 | Every band pads itself; the sheet pads the bottom inset; the card and the ghost key sit under the top inset in focus mode. Phone checks. |

**Where the card goes, and its compact form** (`placeCard()` in `app.js`; HOUSE 4.7 carried to a
short plate). The card goes to a corner of the room the keys, the ghost key and (since 2.4) the compass leave, 6 px clear of
their hits, and never within 10 px of the selection's mark (since 2.2 counting the 4 px under a clipped card's foot rule, which had let the card reach up to 4 px past its room): the tapped cell's ring (18 px with its
outline), the spot the finger touched, or a well's head with its name over it. The corners are tried
in the house's order, top-left, then bottom-left, then the right-hand side, top or bottom; the first
that holds the whole card wins, else the tallest. The card is placed again whenever the plate changes
size (the sheet's stops, focus mode, a turn of the phone) and checked after a step, new units, a turn
of the model or a flight, staying where it is while it still fits. Before 2.2 the raised sheet left
the plate 200 px at 390 x 844, too short for the full card (149 px with one row) beside a point in
its middle. Since 2.2 the sheet stops where the plate keeps 405 px at both raised stops, so the full
card fits there too. The form still follows the plate: where the full card fits beside a cell's mark
wherever the mark falls, it keeps its full form (upright, at every stop of the sheet, and in focus
mode); elsewhere (a phone on its side) it takes its compact form, as wide as its lines need up to the plate's width less 16 px (a stated departure
from the house's 280 px): the place line with `Zoom to cell` and Close on one 24 px row, their 44 px
hits reaching 4 px above the card and 12 px down into what follows, then the figure with its line
beside it, then the rows, everything under the first row scrolling as one. At its tightest the compact card is 58 px
tall, the place line and the figure's line with the rule at its foot, which fits on one side or the
other of a mark anywhere in those 137 px. A chosen well's name goes under its head when the card or
the keys hold the place over it. `tools/shoot.mjs` taps a grid over the field at every stop, in focus
mode and on a phone on its side, and chooses every well in the list.

### The section A–A′ (2.2)

The owner asked for *"a section view as an additional pane to the 3d"*. No Norne seismic can be
shipped (the template's plan 0012, D4), so the section is the model's own: a vertical plane through
the grid along a line on the field, the cells it cuts drawn as blocks. `js/section.js` holds it,
pure geometry and drawing layers; `tools/test_section.mjs` checks the geometry against the data
files.

- **Where.** Under the model in a pane of its own, upright; beside it (`min(46%, 520px)` wide) on a
  wide screen or a phone on its side. Compact, under the model the pane is as tall as the section needs
  at its width, up to `clamp(202px, 26dvh + 32px, 262px)` (2.2's cap and the sweep's 32 px row); with
  the sheet raised, up to what the model can give above its 220 px (`--view-min` less 220 px, 185 px at
  844, between 150 and 234 px), so there the sweep's row costs the plot 16 px;
  its edge makes it taller or wider (2.3, below). It
  it keeps its height while a line is drawn or an end moved, so the model never refits under the
  finger, and fits the new section once the finger lifts. A line that cuts no cell (one drawn off the
  field) is refused when the finger lifts: the line before it stays, and the app says `That line misses
  the field.` While such a line is drawn the pane prints only that sentence, with no depth words. The `Section` key opens and hides it; so does the pane's own `Hide the section` (✕), which
  is what reaches it in focus mode. It stays in focus mode. Remembered with the view.
- **The line.** `Along` and `Across` are the field's own: of the straight lines through the field
  (every whole degree, offsets every 50 m), the one that passes within 60 m of the middles of the
  most grid columns (8.5 km at 38°, 176 of the 2 263 columns), and of the lines square to it, the one
  that does (3.7 km); each ends where the cells it cuts end, A at its west end. `Draw`, then one
  finger across the model, draws one's own; a drag that starts on A or A′ (within 22 px) moves that
  end, where the model is drawn 76 px or more on its shorter side; where it is drawn smaller (the
  strip a tall pane leaves it) the ends would cover a quarter of it or more, so they take no touch there and one
  finger always turns the model, `Draw` still drawing a new line; a second
  finger hands the touch back to the view and leaves the line as it was; Escape or `Draw` again turns
  drawing off. Otherwise one finger still turns the model. The finger meets the field where it sees
  it: the reservoir's top and base are kept as two height fields (40 m a pixel, read between pixels),
  and the ray from the eye through the finger is followed to the top (off the field, to the level of
  the top's mean depth). On the model the line lies on that top (off the field, at the top's level
  where it last was on it, so it never drops off the field's edge), with a faint curtain (`--ink` at
  7 %, a dashed 35 % edge) down to the base where it crosses the field: the plane the section shows. A and
  A′ are 14 px `--sheet` discs with an `--ink` edge and their letter, 650 at 11.5 px.
- **What is drawn**, bottom to top, each layer its own function over one axis: the ground and its
  depth guides (1 px `--line`); the gaps; the cells; the formation tops; the wells; the tapped cell;
  the frame and its words. The axis (`sectionAxis`) maps distance from A across and depth down, both in
  meters, depth stretched by the 3D view's own vertical exaggeration in the compact pane (`vertical ×5`
  printed at the pane's foot, as the instrument line prints it) and by its own in a pane made taller
  (2.3, below), the whole section fitted to the pane and centered across. It is the only place a scale lives, so data from another source drawn at its own depths (a
  seismic line along the same A–A′, in another app) can go in after the ground on the same axis
  without touching the other layers.
- **The cells are blocks, never samples.** Each active cell the plane cuts is the polygon where the
  plane meets its twelve edges, filled in one color: its value on the shown property's scale at the
  shown report date, from the same 256-entry scale and the same texture the 3D view draws, unshaded,
  as the legend paints it. Nothing is blended between cells. A warped cell face is drawn as straight
  chords between its edges' crossings; the test measures the largest departure it found from a cell's
  middle, 2.03 m, under half a pixel at ×5 along the field. A 1.5 px `--line-strong` rim is stroked
  under the fills, so its outer half outlines the cut and its gaps (the scales' pale end is not enough
  to see a cell's edge by on white, section 2); where cells are 3 px wide or more their edges show,
  `--ink` at 28 %, fading in as they widen.
- **Gaps stay honest.** Inside the cut, between the shallowest and the deepest cell of each pixel
  column, what no cell covers is hatched (`--ink-3`, 1 px every 4 px at 45°): the plane passing between
  active cells, where the model's inactive cells hold no values. `No active cell` joins the pane's key
  only when a gap shows (150 CSS px² or more). Outside the field, the pane is plain ground.
- **The formations** each get a 1.25 px `--ink` line along their first layer's top faces, and their
  names (560 at 11.5 px on the halo) at the section's left end where they show; a name that would
  touch another, A, A′ or a well's name tries the middle of the formation's run, a quarter and three
  quarters along it, then its right end, and goes only if none is clear.
- **The wells** that come within 150 m of the plane (feet in US units) are drawn on it, moved square
  onto it, as the 3D view draws them on the shown date: a casing in `--ink` at 0.85, the role's core,
  injectors dashed, a shut well thin and faint, a well not yet open not at all; their names at the top
  of their path in the pane. A name that would touch another tries beside the path's top, then up to
  three rows lower on either side, with a 1 px `--ink-2` hairline to the path's top when it is set off
  it; a well that finds no place is named in the key (`, unlabeled: D-4H`), so no drawn well goes
  unnamed. `Wells within 150 m` is the key, hidden with the wells.
- **Words.** `A` and `A′` over the section's ends, which are 1 px `--line-strong` rules; depth beside
  the section at round steps, the unit on the deepest (`2 600`, `2 800 m`); distance from A under it,
  the unit on the last (`0`, `2 000`, `4 000`, `6 000 m`). All through `js/units.js`.
- **It follows the player and the words.** The section is drawn in the same frame as the 3D view's
  colors for a new date or property, so the time player stays sharp while scrubbed (`shoot.mjs` logs
  every frame of a scrub at 8 and 20 dates a second and finds none whose section is another date's).
  A tap on a block opens that cell's card, with its ring on the model and its outline in the section.
- **It does not take** the explode, the cell ranges or the value range: those change the 3D view
  only, and About says so.
- **Cost** (headless SwiftShader on the build Mac, a trend, never phone evidence): a cut of the grid,
  2.6 ms on average over 42 lines in Node; a draw of the pane, about 17 ms in headless Chromium. The
  height fields are built once at load.
- **Accessible.** The canvas is an image named with what it shows (`Section A to A prime, along the
  field, 8.51 km long, 2061 cells cut, from 2525 meters to 2844 meters deep, colored by Oil
  saturation, depth stretched 5 times. Wells within 150 meters: …`). Along and Across are one tab stop
  with the arrow keys inside it; Draw and Hide the section are buttons; the live region says `Section
  shown, …`, `Drag across the field to draw the section line.` and `Section drawn, …`. Drawing a line
  of one's own needs a pointer; Along and Across, the sweep's slider and its keys are the
  single-pointer and keyboard way to a section.

### The pane's edge and the sweep (2.3)

The owner, after 2.2: *"Can the section view be extended taller to optionally take up more screen?"*
and *"I assume we are also making it easy to scroll through the sections with sliders etc?"* (the
template's plan 0012, D13 and D14). Both live in the pane: the resizing in `js/pane.js` and the
stylesheet's `.grown` rules, the sweep in `js/section.js` and the pane's row of keys.

- **The edge.** Under the model, the pane's head between `Draw` and ✕ is its top edge: a 44 px hit
  that reaches 22 px further up over the plate's foot, with the house's grip (a 36 × 4 px
  `--line-strong` bar, 2 px round) laid on the 1 px line between the model and the pane, at the
  screen's middle, so the grip sits inside the hit and not on its boundary. Beside the model, its side edge is a 44 px strip
  astride that line beside the plot, the same grip upright; the model's keys keep 30 px clear of it.
  A drag moves the edge with the finger, from compact (as 2.2 sized the pane) up to tall, where the
  3D view keeps a strip of its own: **120 px** under the pane (its keys in a row and the field under
  them), **160 px** beside it past the screen's left inset (its three key plates side by side). A
  double tap toggles compact and tall (wide, beside the model); the tap's own click, which follows the
  lift over whatever the toggle moved under the finger, is taken by the edge. It is a slider for VoiceOver (`Section height`, `Section width`;
  `Compact`; `Tall` under the model and `Wide` beside it; or a share of the view's height or width in words; increment and decrement step a tenth; the edge
  under the model is a vertical slider, the one beside it a horizontal one), and on a keyboard ↑ and →
  step it a tenth larger, ↓ and ← a tenth smaller, on both edges, Home and End go to compact and tall,
  Enter toggles. The size is kept with the rest of the view and comes back on the next launch.
- **Live and sharp.** While the edge moves, the section's height and the plate's are set in the frame
  that draws at them, and both canvases take their new size before they draw, so neither is ever
  shown stretched; the text in the section is drawn at its own size every frame. A model at the fit is
  fitted again to the plate as it changes, as at the sheet's stops.
- **The room used honestly.** A pane made taller than compact fills with the section: it is stretched
  to the largest round figure (`1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50`) at
  which the whole section still fits, where that is a fifth or more above the 3D view's, and the
  pane's foot then prints its own (`vertical ×20`) where it printed the 3D view's; the canvas's name
  says `depth stretched 20 times, more than the 3D view's 5`. Where the pane has no more room for it
  (a wide pane, a long flat section) the stretch stays the 3D view's. The depth and distance words are
  read from the one axis at every size, more of them as the pane grows.
- **A narrow plate.** The strip beside a pane made wide is narrower than the card: there the card
  takes its compact form with the place line wrapping beside Close and `Zoom to cell` under it, and a
  card that must open under the finger takes no click for 350 ms, so the lift's click never lands on
  its keys.
- **The sweep.** Under the plot, in a 32 px row whose keys and slider keep 44 px hits (reaching 6 px
  over the distance words above and the key below, neither of which takes a touch), `‹`, a house
  slider and `›`, with where the line is at the right. Where the pane is too narrow for all four on one row with the slider at 140 px or more (beside the model with the sheet raised), where the line is takes a 15 px line of its own over the slider, and the row reaches the pane's padding edge. From
  `Along` the slider steps through the grid's columns (`I 6` to `I 41`, each the cells of one I), from
  `Across` through its rows (`J 11` to `J 102`), the field's own line in its place among them (`Along`
  between I 22 and I 23, `Across` between J 69 and J 70), so the slider always says where the line is.
  A column or a row is drawn as it is in the grid, not as a straight cut through it: its own cells,
  each the face midway across it (the mean of its two sides' corners), along the path through the
  middles of the slice's pillars, distance measured along that path; on the model the line follows
  the same path on the reservoir's top and moves as the slider does. The grid's columns bend (their
  middles stray 24 to 175 m from a straight line), so a straight line through one would cut its
  neighbors; the path keeps every block the slice's own. A line of one's own sweeps parallel to
  itself, a slice's width at a time (the grid's mean step square to it, 54 to 92 m by bearing), the pane saying
  how far and which way (`89 m NW`). The slider is a range input, adjustable for VoiceOver, its value
  in words (`row J 70`, `the field's own line, between rows J 69 and J 70`, `your line, moved 89
  meters northwest`); `‹` and `›` say the new place through the live region.
- **Sharp while swept.** Each input only records the place; the frame draws the newest one, so a fast
  scrub never queues a place already passed (`shoot.mjs` logs every frame of a touch scrub: none drew
  a place other than the slider's). The pane holds its height while the finger is down and fits the
  section once it lifts. A slice is cut in under 2 ms in Node and the last 24 are kept.

### Zoom in the section, the axes' lock, and the tall stop (2.5)

The owner, reviewing TestFlight 48: *"I want to be able to zoom in the sections of the reservoir apps"*,
*"Also want the axes to have the option to be locked to cover the whole displayed area/view (just show
data where it is, but keep axis extended)"*, *"But when i say locked, i still want to be able to manually
adjust the view. Just not have it automatically adjusting the limits/grid"* and *"the menu at the bottom
is too small when looking at the slices (cells and view), but works for the explode. Maybe add one more
layer tp the menu to expand it a bit more when using that?"* (the template's plan 0012, D18 to D20). The
view's arithmetic is in `js/section.js` (`viewAxis`, `zoomAt`, `panBy`, `keepIn`, `fitWindow`,
`commonFrame`), the gestures in `js/gesture.js`, the rest in `app.js` (`secAxis`, `secZoom`).

- **Zoom.** Two fingers on the plot zoom about their midpoint and carry it with them, so the point under
  the fingers stays under them; one finger moves the view once it is zoomed in, and at the fit a drag
  does nothing (the plot never scrolls the page). A tap, 8 px or less, still shows its cell at once; a
  second tap within 380 ms and 30 px zooms in two times where it lands, as the 3D view's double tap
  focuses where it lands. A mouse wheel or a trackpad's pinch zooms about the pointer. The zoom is
  uniform, so the stretch the pane states is the one drawn. It goes out to the fit and no further, and
  in to where the field's thin cells read plainly: the 5th percentile of the active cells' thickness
  (1.81 m) drawn 24 px tall, about 72 times Along's compact fit at ×5. A move keeps 48 px of the
  section in view (all of it where it is smaller).
- **Everything follows.** The cells, their edges (fading in as the cells widen, the 2.2 rule), the
  formation tops, the wells and their names, the gaps, the tapped cell's outline and A and A′ all draw on
  the one held axis. Zoomed in, the depth words stand at the plot's left edge and the distance words at
  its foot, re-chosen for the depths and distances in view, never past the data's own (the section's,
  unlocked; the field's, locked); the data is drawn inside the plot. An end off the plot is left out
  (its letter and its rule), and the distance words say where the plot is. Names stay on the part of
  the section in view; a well wholly out of view is not named.
- **Fast.** While a pinch, a move or a wheel lasts, the plot shows the last full drawing of its data
  moved and scaled to the newest view, under depth and distance words, A, A′ and names drawn for that
  view; the frame after the fingers lift draws in full, the gaps' hatch included, at the newest view.
  Under that drawing lies the whole view's own (the fit's, or locked, the field's window: the cells, tops,
  wells and tapped cell, kept from the last drawing at the fit, or drawn at rest 250 ms after a zoomed
  one), so a pinch out or a move past what the last drawing covered shows the section at once, coarse
  until the lift, never an empty plot. A preview is only of the same section, month and colors; anything
  else draws in full at once, and while the fingers move even that leaves the gaps' hatch as it was,
  moved, so no gesture's frame waits on it.
- **The keys** stand in a strip at the plot's right, outside the data: the plot's box ends 6 px before
  them, so no key ever covers a cell. They are the 3D view's plates stood upright (44 × 44 hits drawn
  36 × 44): `Lock the axes` (`aria-pressed`; a pair of axes with a padlock, its shackle open when
  unlocked) over `Zoom the section in` in one plate, and `Fit the section` (four corner brackets around
  a slanting band) and `Zoom the section out` in a second, shown only where they would change
  something. Where the plot is 186 px tall or more the second plate stands under the first; under that,
  from 89 px, it stands to the first's left while zoomed (the box then 46 px narrower), so no key moves
  under a finger. At 390 × 844 the compact plot's box is 270 px wide at the fit (2.4's 312), the plot at
  least 94 px tall, and the sweep's word 94 px wide so that › stays clear of the strip. Where the plot is
  shorter than 89 px, or its box would be under 150 px wide (the tall stop with the section open, a
  raised sheet on a 375 or 320 px phone, the narrow pane beside the model),
  the keys step aside: out of sight, still in the keyboard's order and to VoiceOver, shown over the
  plot's top right while they hold the keyboard, and `Axes locked` says so in the key under the pane
  when they are. Locked, Fit is named `Fit the field’s depth and length`. The keys zoom two times about
  the plot's middle.
- **Unlocked** the pane is 2.4's at the fit: the scales hug the section, the depth words beside it,
  distance from A to A′. A zoom by hand holds until the section changes (a sweep step, Along or Across,
  a line drawn or an end moved); then it fits again. A resize holds the scale and the top-left corner;
  the stretch slider under More controls keeps the scale and the depth at the plot's middle.
- **Locked** the window opens on the whole field: every active cell's depths (2 439 to 3 090 m, with the
  4 % pad a section takes) and the full length of the line's family at one scale, at the stretch the
  pane would give that window (the 3D view's compact, or, where the pane's cap holds the plot under the
  window's need, the largest round stretch under it that fills the plot's width; its own when grown),
  its plot height set then and held. The depth guides run across the whole plot and the distance words along its whole foot. The
  family's distance: for Along and Across, the line and every column or row its slider goes through,
  each placed by where its start falls along the line, measured from a baseline square to the line
  through the family's first end, and keeping its own length along its path (Along's family 9.39 km,
  Across's 4.50 km); its zero names that end by the compass, `Southwest end` on Along and `Northwest
  end` on Across, and where the zero is out of view the unit's tick says `from the southwest end`. A line of one's own steps square to itself, so its family is
  its own length, from A. A step through the sweep moves the cells and never the scale. While locked
  nothing moves the window by itself: not a step, not another line or family, not a property or a
  month, not the pane's size; only a pinch, a move, the keys, a double tap, a wheel and the stretch
  slider (a manual setting, which keeps the scale and the middle depth). A section that falls outside a
  held window is not chased: the window stays, and Fit shows it. Unlocking returns to the fit of the
  section shown. The lock is kept with the rest of the view; a state saved before 2.5 opens unlocked,
  and a reload opens a locked pane on the field's window.
- **The tall stop.** The sheet has a fourth stop in the column: above `Explode`'s and the scrolled
  `Cells and view`, it raises the sheet until all of `Cells and view` shows under the grip (its five
  slider rows, the two toggles and `Show all cells`, which since 2.5 shares the toggles' row), its
  heading scrolled up under the grip as `Explode` is at the second stop; the 3D view keeps a strip it
  never loses, 104 px (its keys' row and 58 px of the model under it); with the section open the view
  keeps 254 px, the strip and the pane at its 150 px floor, and the sheet takes the rest. Never more than the second
  stop leaves. Where the stop would raise the sheet less than 44 px past the second (375 × 667 with the
  section open), and where the sheet is a column at the side (a phone on its side, a wide screen),
  which shows everything already, there is no fourth stop: the grip steps through three, and a saved
  fourth opens as the second there and as the fourth where it fits. The grip's names say what the next
  step does: `Show more controls`, `Show all controls`, `Show Cells and view in full`, `Hide the extra
  controls` (the third stop's name is `Hide the extra controls` where no fourth follows). Tap cycles,
  a drag steps a stop at a time, ↑ and ↓ step, VoiceOver activates it as a button. Measured (headless):
  the sheet 311 px at each size, all of Cells and view in view at each; the model 281 to 282 px at
  390 × 844, 369 to 370 at 430 × 932, 104 to 105 at 375 × 667; with the section open, the model 131 to
  132 and the pane 150 at 390 × 844, 219 to 220 and 150 at 430 × 932.

**What does not apply, and why:** a `now` notch and a ran-out sentence (a finished history, not a
forecast: About names the edition); per-step ticks on the track (110 steps under 2 px apart; year
ticks instead); an opening (section 3); a second large figure (the card's value is the only other
21 px figure, and only while the card is open).

---

## 4. Type

- **The house file, byte for byte.** `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
  `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
  sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copied from
  `global-weather/fonts/` (`cmp` both after copying). The one `@font-face` rule exactly as HOUSE 2.5
  gives it; the family used only through `--face`.
- **No supplement.** Every character the app writes outside comments was read against the cut
  (`python3` over `index.html`, `app.js` with `//` comments stripped, `style.css`, `config.json` and
  every string in `data/model.json`): beyond ASCII it writes only U+2014, U+00D7 (×), U+2026 (…),
  U+2013 and U+00B3 (³, in `Sm³`), all in the cut (HOUSE 2.2). The pass adds U+202F, U+2212, ≤ and
  ≥, also in the cut. The em dashes go anyway (section 7). Well names are ASCII.
- **Removed:** nothing shipped, since the stock app named the system's Avenir Next and its condensed
  cut without shipping them: the two stacks (`--face`, `--face-narrow`) go, and with them the 28 and
  30 px condensed display sizes. Fonts after the pass: 40 075 B (0 before it).
- **The scale here:** name 15/650; the stamp's line 11.5 (while loading); the About and units keys
  600 at 12.5; the property words 12.5 (620 chosen); legend title 11.5/600; instrument line 11 with its
  labels 10.5; wells key 10.5; the cut's key and the section's key 11.5; the section's words 12.5, its
  depth and distance words 10.5, its A and A′ 11.5/650, formation names 11.5/560, well names 10.5/560; the
  date 21/600 (the one large figure in the bands), the lead 12.5; the track's year and scale labels
  10.5; card place line 12.5, card figure 21/600 with its unit 13.5, rows 12.5 (values 560); plate
  labels 11.5/560 on the halo; sheet labels and values 12.5; section heads 13.5/650; the chart's
  labels 10.5; About prose 13.5/1.5 within 62 ch; notices 13.5. The stock 30 px date, 28 px title,
  16 px card title, 15 px body and 14 px chips go.
- **Text waits for the face.** `document.fonts.load('560 11.5px "Ysabeau Office"')` before the first
  frame with labels, before the well labels are measured (the stock code caches each label's width
  on first placement, `it.el._w`, so a fallback face would place every label wrong for good) and
  before the track's first draw; labels and the track redrawn on `document.fonts`' `loadingdone`.
  Every font string in a script (the track's canvas) names `"Ysabeau Office"` first.
- **Credit line, word for word** (About, `NOTES.md`): `Ysabeau Office by Christian Thalmann
  (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.`

---

## 5. The camera's strings (HOUSE 7.4)

What the marketing camera reads in this app, in the Snuggery app's repository:
`Tests/SnuggeryUITests/MarketingCameraCase.swift` (`waitForNorne()`, `frameNorne()`, and the note on
`setWebSlider`, which names Norne's former date slider), `MarketingShotsUITests.swift` (shot 17, the
README panes) and `MarketingClipsUITests.swift` (clip 2).

| String | Role | Kept as |
| --- | --- | --- |
| `Oil saturation` in visible text (waited up to 300 s; `label CONTAINS[c]`) | the legend's title in the caption band | the default property's `config.json` label, written once every file is in. `index.html` never contains it (a hidden copy would let the wait pass early), and it stays visible in focus mode, so the wait passes in a library left in focus mode too. |
| `Show the whole field` (`webControl` by exact label, then a 2 s sleep) | a key in the key column | the exact accessible name of a `<button>`, the only control so named, in the tree at every sheet stop; its fly stays 520 ms. |
| `Pressure`, `Oil` (the stills and clip 2: `webControl` by exact label) | property words, `role="radio"` | role and exact names. `app.buttons[…]` cannot find a `role="radio"` element, so the camera matches them by label. |
| `Play production history`, then `Pause` | the Play key's name at rest and while playing | the two names; no other control is named `Pause`. |
| `Show the controls` (`showControlsIfHidden()`, at the end of `waitForNorne()`) | the ghost key of a remembered focus mode (`norne-viewer:v1:focus`) | the exact name, so a kept library left in focus mode shows `Pressure` and `Show the whole field` again. |
| what the camera changes | the property (Pressure, then Oil again) | put back with the same words; nothing else it does is remembered. |

2.2 adds `About`, `Section`, `Along`, `Across`, `Draw` and `Hide the section`, and 2.3 `Line
position`, `Previous column`, `Next column` (`row` and `step` too), `Section height` and `Section
width`, and 2.5 `Fit the section`, `Fit the field’s depth and length`, `Zoom the section in`, `Zoom the section out`, `Lock the axes` and the grip's `Show Cells and view in full`, none of which is a string the camera reads, and none named `Pause`; `Oil saturation` stays the legend's title, written
last. The stamp's line hides once every file is in; the camera never read it.

The stock app's first-run hint, `Double-tap a spot`, went with owner call 8, and the camera no longer
waits it out. Nothing the camera waits out got longer: there is no opening, the files and their order
are unchanged, and the stamp's count replaced the overlay.

---

## 6. Budgets

Measured on the working tree before the pass:

| | Before the pass | Cap | Command |
| --- | --: | --: | --- |
| App code (`index.html` 5 795, `style.css` 13 352, `app.js` 57 885) | 77 032 B | **200 000 B** (HOUSE 8; not over it then, so not held) | `find . -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.mjs' \) -not -path './vendor/*' -not -path './data/*' -not -path './tools/*' -not -path './pipeline/*' -not -path './scripts/*' -print0 \| xargs -0 wc -c` |
| Fonts | 0 B | 160 000 B; planned 40 075 B | `cat fonts/* \| wc -c` |
| ZIP, as `build-zips.yml` packs it (14 entries then) | 15 258 206 B | **19 110 591 B** (that size × 1.25, rounded down, plus 37 834 B for the face the app gains: plan 0011 D5) | `zip -q -r -X OUT . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`, then `wc -c` |

The data, pinned before the pass (`check.mjs` checks them every run): `find data -type f | sort |
xargs shasum -a 256 | shasum -a 256` gives `f8b8a7d1913bdeccd2263674c9f9a124f16200d0ec9d7072d91283657af7f005`;
per file, `ATTRIBUTION.txt` `e6c83cba…3cae`, `dynamic.bin` `2fa5d166…dc28`, `geometry.bin`
`77e7b35d…e11d`, `ijk.bin` `7b8ad432…2c45a`, `model.json` `979cfdfd…6a38`, the cell connections file
`ea665b90…f49`, `static.bin` `5766ae91…5f28` (`shasum -a 256 data/*`; the builder copies the full
values from that command). `screenshots/app.png`, the README's composite, is `2b91205d…b635` and
stays so. `config.json` was `aacc94ec…6ca9` before the pass, which rewrote its color fields.

**As built, 2.2** (`node tools/check.mjs`): app code 221 794 B (`app.js` 125 390, `style.css` 33 041,
`js/section.js` 23 535, `index.html` 18 376, `js/track.js` 7 840, `js/units.js` 7 225, `js/data.js`
6 387), over the 200 000 B cap by 21 794 B with the section, for the template's ruling (161 833 B
before 2.2); fonts 40 075 B of 160 000; the ZIP about 15.4 MB of its 19.11 MB cap. The exact ZIP
size is in `tools/DECISIONS.md`, since this file's own bytes move it, and so is the plan's code
ledger, which put the pass at about 110 000 B.

**As built, 2.3.1** (`node tools/check.mjs`): app code 255 520 B (`app.js` 137 722, `style.css` 37 087,
`js/section.js` 33 833, `index.html` 20 214, `js/track.js` 7 840, `js/units.js` 7 225, `js/data.js`
6 387, `js/pane.js` 5 212), 33 726 B more than 2.2 for the edge, the sweep and 2.3.1's play clamp, within the 256 000 B the
template ruled for 2.3; fonts and the data unchanged; the ZIP about 15.4 MB.


**As built, 2.4** (`node tools/check.mjs`; plan 0012 D16 and D17): app code 255 990 B of the 256 000
(`app.js` 137 806, `style.css` 37 482, `js/section.js` 33 833, `index.html` 20 205, `js/track.js` 7 840,
`js/units.js` 7 225, `js/data.js` 6 387, `js/pane.js` 5 212), 470 B more than 2.3.1 for the compass,
its keep-outs and the needle's removal from the instrument line, with three comments shortened to fit;
the colors are `config.json`'s, not code. Fonts and the data unchanged.

**As built, 2.5** (`node tools/check.mjs`; plan 0012 D18 to D20, with the review's fixes): app code
299 880 B (`app.js` 163 265, `js/section.js` 43 228, `style.css` 40 733, `index.html` 22 141, `js/track.js`
7 840, `js/units.js` 7 225, `js/data.js` 6 387, `js/pane.js` 5 212, `js/gesture.js` 3 849), 43 890 B more than
2.4 for the zoom, the lock and the tall stop, over the 256 000 B the template ruled for 2.3: nothing was cut, and the cap is the
template's to rule on. Fonts and the data unchanged; the ZIP about 15.4 MB.
---

## 7. The generated-page tells, answered

| Tell | Norne Reservoir |
| --- | --- |
| 1. Warm cream ground, high-contrast serif display, terracotta accent | No cream (the stock stage `#DDE4E5` was cool), but an ochre accent on Play, the thumb, the needle, the chart cursor, the focus ring and the checkboxes, and two condensed display sizes. The chrome's ground becomes the house film base `#e8eef0`; one Renaissance sans at every size; no accent. Warm hues on screen are data: the gas and pressure scales, the gas injector, the sand. |
| 2. Near-black ground with one acid-green or vermilion accent | The stock dark stage `#0C161C` with the brighter ochre `#DDAA3F` goes. The dark page is the house slate (L 0.224); the plate's darker slate (L 0.181) is stated as the print's ground, as Global Weather's globe plate is. No accent; the bright things in the dark theme are data (the oil leg) and the Cut. |
| 3. Broadsheet hairlines, zero radius, dense columns | One column; hairlines between the sheet's sections, the key plates and the player. Radii 6, 8 and 4 px by role; 0 only on the legend bar. |
| 4. SaaS-card kit, one radius, soft shadow, gradient washes | Four frosted `backdrop-filter` surfaces (the card, the frame button, the hint, the compass), the translucent well and formation pills, three `box-shadow`s and two `text-shadow` halos go. One card (the tapped cell or well), one sheet at a time. No gradient but the data scales and the selection tracer (the stock per-chip gradient underline goes). |
| 5. All-caps tracked eyebrow labels | None before the pass; none added. Sentence case, letter-spacing 0 (the stock condensed title's −0.01em goes). |
| 6. Meta strings joined with middle dots | None before the pass, none now; the credit line (in About) and the card's rows use commas and one value per line. |
| 7. "WORD — fragment" with a spaced em dash | Before the pass, no spaced em dash on screen, but nine em dashes as placeholders (`grep -n '—' app.js index.html`): `#date`, `#prop-name`, the legend's two ends and the scale's length in `index.html`; a missing value in `fmt()` and `fmtRate()`, a category's value range and an unknown formation in `app.js`. Empty elements before boot; a missing value says `not in the data`; a cell with no formation says `no formation`. |
| 8. A tinted near-black standing in for black | The stock `#0C161C` stage goes. The plate's darkest data colors are stated stops of named scales; the wells' casing is the house ink `#0f1c23`. |
| 9. Monospace for small data labels | None; the stock condensed face for small labels (well pills, formation pills, the compass `N`) is the same habit and goes. Tabular figures from the one face. |
| 10. An arrow appended to buttons | None before the pass, none now. Buttons say what they do: `Show the whole field`, `Zoom to cell`, `Show all cells`, `Hide the controls`. |
| 11. One accented word in a headline | None. |
| 12. Unnecessary labels above content | The legend's title is the quantity its bar measures, from `config.json`. The stock `Field rates, Sm³/d` keeps its words with the unit moved to the scale labels; `Cells and view` (`Section and view` before 2.2) stays as a section head between rules, not a label over one control. |
| 13. Numbered markers | None. The fault segments are named `1` to `4` because that is their name in the deck, under the title `Fault segment`. |
| 14. Big number, small label, gradient accent | The stock 30 px date over a 13 px property name goes; the date is the 21 px figure in the player, and the property is the legend's title. No gradient but the data. |
| 15. Scattered fade-and-slide entrances, hover on every card | The first-run hint's appearance and the load bar's width transition go; the house's three small transitions answer a touch; the one continuous motion is the history played. |

The interface guidelines, where the house writes its own rule: sentence case (`Hide the controls`,
`Show all cells`); dates by hand, not `Intl`; `font-display: block`; `translate="no"` on the name,
the edition's source and version (About's first row), the credit line, the well names, the formation names; `…` never `...` (the loading
strings already use the real ellipsis); `<button>` for every action (the explode `select` becomes
three words; the well picker stays a `select`, a stated departure); the viewport loses
`user-scalable=no`; `<html lang="en-US">`.

---

The record of the pass, the owner calls as they stood, the change list with the bugs it fixed (B1 to
B11), the phone checks, and what QA, the review and the follow-up changed, is in `tools/DECISIONS.md`,
which the ZIP leaves out.
