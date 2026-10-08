# Anatomy: art direction

`NOTES.md` says what the app does and how its data is built. This file says how it looks, moves and
speaks under the template's house system (`Template/HOUSE.md`, the brief; Global Weather is the
reference, Milky Way, Besseggen and Norne Reservoir the apps that took it before this one). It holds
the look as built, its rules and its measured figures. The record of how it got here (the app as it
was before, the bugs fixed, the change list, the reviews, the owner calls, the phone checks) is
`tools/DECISIONS.md`, which does not ship.

**Measured on 2026-10-02** on the working tree. Every figure names the command that printed it; the
commands run from `Template/anatomy/` unless they say `Template/`, and their scripts are in `tools/`,
which the ZIP leaves out: `node tools/check.mjs` (static), `node tools/test_decode.mjs` (the data
decoded and the Levels' math), `python3 anatomy/tools/art/palette.py` (from `Template/`: every color
and contrast) and `PLAYWRIGHT_MODULE=… node tools/shoot.mjs` (the app driven). Times and rendered
pixels from `shoot.mjs` are headless Chromium with SwiftShader on the build Mac: a trend, never phone
evidence.

---

## The look: the house, with one bold thing of its own

Anatomy is HOUSE 4.0's *3D view without time*. It takes the house chrome whole: one face, the
house's tokens on a white ground (HOUSE 12), the row of words, the key column, the caption band, the readout card, About, focus mode, SI
and the no-tells rules. What is its own is the body, which keeps its one true appearance in both
themes, and one signature.

- **The body keeps its colors in both themes.** A human body has one appearance, as Earth's History's
  night does (HOUSE 3.2): every structure is drawn in the color `data/anatomy.json` gives it, in the
  light theme and the dark one alike. Only the ground under it follows the theme: white `#ffffff`
  in the light theme (plan 0012 D6, HOUSE 12), the house's slate `#141d21` in the dark. The plate's edge is the
  edge: the page and the plate are one color, as Global Weather's map is.
- **One bold thing: the Levels** (section 1), a rule at the plate's left edge made of this body's own
  spine, 24 vertebrae and the sacrum as 25 levels, drawn where the camera sees them, with the selected
  structure's span inked beside them. Everything else is quiet.
- **Honesty is about what the model is.** One adult male reference body, simplified, from two
  releases of one database fitted together. The app prints every word the data says about its sources
  and its gaps; says, where the picture is read, that the colors, the light, the fade, the explode and
  the selection's marks are display; and writes its own rendering and type credit, which the data's
  third source paragraph repeats word for word, so About prints it once.

**How it differs from the apps before it** (it copies none of them):

| | Global Weather, Global Wind | Earth's History | US Quakes | Warming World | Milky Way | Besseggen | Norne Reservoir | Anatomy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Signature | the streak field on the plate | the time control as a stratigraphic column | the record strip, one stem per quake | the stripes as an instrument | the Reach: a log ruler of distance | the Burn: one day's sun at one point | the Cut: what the wells lifted, oil and water | **the Levels: the body's own spine as the rule it is measured by** |
| Axis | the map | time (Ma) | time (days) | time (years) | distance from the Sun | the hours of one day | the production history | **height in the body, graduated by its 25 levels** |
| What it encodes | the wind's path | period colors | magnitude by stem height | anomaly by color | presence only | the sun's altitude; direct sun by ink | liquid per day; oil and water by tone | **where each vertebra is drawn; the selection's span, read as levels** |
| Where | on the plate | the time track | the time track | the scrubber | a strip under the header | the time track | the time track | **on the plate's left edge, projected through the plate's own camera** |
| Shape | streaks | a banded column | stems | stripes | a flat bar with gaps | one arch with bites | a two-tone skyline | **a column of ink blocks split by the discs, short in the neck, tall in the lumbar spine, one long sacrum; a bar beside it** |
| Plate | film base / print | night in both themes | drum paper | gray card | space in both themes | daylight terrain in both themes | the rock printed twice | **the body in its own colors on the theme's ground** |

The Levels is the only signature in the template that is not a time control or a field of marks: it
is a ruler, as the Reach is, but the Reach is an abstract logarithmic scale under the header, while
the Levels is the body's own skeleton, drawn in the plate through the camera that draws the body, so
it turns, zooms and comes apart with it.

---

## 1. The signature: the Levels

**What it is, in one paragraph a stranger would get.** A doctor does not say a kidney sits "about a
meter up". The spine is the body's own ruler, and every height in the trunk is given as a *vertebral
level*: the kidneys lie from T12 to L3, the aorta divides at L4, the hyoid bone sits at C3. The Levels
draws that ruler beside the body. At the plate's left edge stands a column of 25 small ink blocks, one
per level of this model's spine, C1 at the top, then the seven of the neck packed tight, the twelve of
the chest, the five taller ones of the lower back, and the sacrum, five fused vertebrae, as one long
block, each block at the height on screen where that vertebra is drawn, the gaps between them where
the discs are. Labels name the ones that have room (`C1`, `C7`, `T12`, `L5`, `S1–S5`). Tap a structure
and an ink bar appears beside the column, from its top to its bottom, and the card and the caption say
it in words: *T12 to L3*. Turn the body and the column turns with it; zoom into the chest and the blocks
grow until every thoracic vertebra carries its label; pull the body apart and the blocks follow the
vertebrae.

**What a stranger remembers is that the model agrees with the textbook.** Read off this body's own
spine by the rule below (`node tools/test_decode.mjs`, which computes every one from
`data/geometry.json`'s boxes and `data/anatomy.json`'s labels with formulas of its own): the right
kidney T12 to L3, the left T11 to L2; the celiac trunk at T12; the right renal artery L1 to L2; the
abdominal aorta T10 to L4, ending where the textbooks put its division; the hyoid bone C3 to C4; the
cricoid cartilage C5 to C6; the trachea C5 to T5; the pancreas T12 to L2; the xiphoid process T8 to
T9; the scapula T2 to T8. No other app in the template has a ruler made of its own subject, and no
number is invented: a vertebra is where the model's data puts it.

**How it was found** (HOUSE 5.1):

1. *What does a specialist call the picture of this data?* An anatomical plate, and in it two
   documents: the labeled figure, and the levels by which a clinician places anything in the trunk
   (the transpyloric plane at L1, the sternal angle at T4 and T5, the umbilicus at L3 and L4). Surface
   and imaging anatomy are taught by vertebral level; a radiologist counts vertebrae before naming an
   organ's height. The Levels is that document, drawn from this model.
2. *What does a person do most here?* Peel, explode, turn the body and tap a structure to read its
   name. The tap is where the Levels speaks: the card's one new row and the bar beside the column.
3. *What does this data have that no other app has?* A named skeleton: 25 labeled levels with their
   boxes, and 1 752 named structures in the same frame. The Levels moved to any other app would have
   nothing to graduate by. Candidates set aside: a stature rule in centimeters (true, but a ruler any
   3D app could carry, and a body's height in centimeters is not how anatomy places anything); a
   locator figure in a corner (an atlas convention, but a minimap, and it encodes the camera, not the
   data); leader lines from the selection to a label in the margin (annotation, not data, and Norne and
   Milky Way already label their plates); the layer stack drawn as a dissection ruler, Skin to Bone
   (nine stations whose sizes would have to be counts of structures, which say more about how the
   source was cut up than about the body).
4. *Can it be drawn with the house's means?* One ink at the far end of the tonal budget on the
   house's halo, the house face at 10.5 px, no motion of its own.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears.* The blocks are the parts whose `type` is `atlas`, `axis`,
   `cervical`, `thoracic`, `lumbar` or `sacrum` with a `label`, at their boxes' centers in
   `geometry.json`; their labels are the data's (`C1` to `L5`, `S1–S5`). Remove them from the data and
   the column loses them; with no vertebra in the data there is no rule, and the caption says so
   (`Levels: the data names no vertebrae, so there is no rule beside the body.`). Before the model is
   in, nothing is drawn.
2. *Every property that varies is measured.* A block's height on screen is the projected distance
   between the midpoints to its neighbors' box centers (its *band*); C1's band tops out at C1's box top
   (1.495 m) and the sacrum's ends at the sacrum's box bottom (0.795 m), 70.0 cm of spine. The bands run
   from 13 mm (in the neck) to 54 mm (L5) and 110 mm (the sacrum) (`test_decode.mjs`). The selection's
   bar runs between the levels of its box's top and bottom, placed on the column by the same
   piecewise-linear map from a height to the vertebrae's centers that places the blocks, so the bar and
   the words cannot disagree: the bar's ends are the box's top and bottom placed exactly by that map,
   not rounded to a band. Nothing is scaled to fit the screen: the column is wherever the camera puts
   the spine. No number is read off a length on screen; the words carry the reading.
3. *It is captioned.* The caption line (section 3) says how to read it, with its numbers:
   `Levels: this body’s spine in 25 levels, C1 to S1–S5, drawn beside it where the camera sees them.`
   (a level is a labeled part, so the sacrum is one); with a selection, `The selection spans T12 to L3
   on this body’s spine: the bar beside the levels.` (one band: `The selection lies at T12 …`; past
   the top: `The selection runs from above C1 to T3 …`); a selection off the spine, `The selection lies
   below the sacrum, under the spine.` When there is no column the caption says which of two reasons
   holds, each with what to do (`Levels: turn the body upright to read its vertebrae beside it.`, or
   `Levels: come closer to read this body’s vertebrae beside it.`; with a selection, `The selection
   spans T12 to L3; turn the body upright to see its bar.` or `…; come closer to see its bar.`). The 25
   and the two end labels come from the data. `tools/test_decode.mjs` prints eleven sentences, the
   longest 96 characters, and `tools/shoot.mjs` fits the longest the data can make at every width it
   runs.
4. *It reads.* Ink on its halo, over every lit body color and both grounds: blocks and bar 11.66:1
   (light) and 9.70:1 (dark), labels the same figures against the 4.5 the text needs; without the halo
   it would fall to 1.10 and 1.00 over the body (`palette.py`). On the rendered column (`shoot.mjs`, 152
   samples of the blocks against the halo beside them per theme) 100 % sit at 3:1 or more, median
   15.79:1 (light) and 15.43:1 (dark); the lowest single samples, 4.04:1 and 5.70:1, are edge pixels
   the antialiasing blends with the halo, which the full mark's figures above do not see.
5. *It survives Reduce Motion.* It has no motion of its own. It moves only because the camera or the
   explode moved, and under Reduce Motion those are cuts, so it jumps with them.
6. *About says what it shows and what it does not* (section 3): a level here is a height, read off
   this one model's spine (an adult male reference body), from the boxes around whole structures, so a
   long structure spans many levels and an arm hanging beside the trunk has levels too (the left
   humerus spans T3 to L2); the sacrum's five fused vertebrae count as one level; levels differ between
   people by a vertebra or more; a vertebral level is not a spinal cord segment and says nothing about
   which nerves supply a structure; the blocks are spaced by the vertebrae's centers, not drawn as the
   vertebral bodies; above C1 and below the sacrum there are no levels.
7. *It is the only bold element.* The selection is an ink outline, not a hue (section 2), and the rest
   passes section 7.

**Drawn exactly so** (pure math in `js/levels.js`, drawing in `app.js` on a 52 px canvas of its own
at the plate's left edge, inside the left safe area, over the WebGL canvas, `pointer-events: none`,
`aria-hidden="true"`):

- **The levels** come from the data at boot and on every refresh of `anatomy.json`: the labeled parts
  of the six types above, sorted by box center, top to bottom. Today 25 (`test_decode.mjs`).
- **Their places on screen**: each vertebra's box center, moved by its mesh's current explode offset,
  projected through the camera to a screen height; the band edges the same way. Recomputed only when
  the camera, the explode, the plate's size or the data changed (HOUSE 4.6's second rule); a counter in
  the test hook proves it rests. The column's ink and halo are read from the stylesheet once per theme,
  not per frame. Pulled apart by group, the thoracic vertebrae rise past C7: the column keeps the
  spine's order, and the block between the two flattens. `shoot.mjs` holds every drawn edge within 1 px
  of its own projection of the data's boxes through the camera's matrices, at the first-run view, in
  the front view and pulled apart 45 % (it measures 0.000 px).
- **When it is drawn**: when the camera looks no steeper than 64° from level (the view direction's
  vertical part at most 0.9) and the projected column, C1's top to the sacrum's bottom, is at least
  120 px tall, or 80 px on a plate under 300 px (a phone on its side, or the Layers sheet open). The
  whole body's spine is 216 px tall at the first-run view and 222 px from the front at 390 x 844, and
  93 px on its side at 844 x 390, where the plate is 278 px tall (`shoot.mjs`, 2026-10-07): so the column is in the
  opening in every orientation. Otherwise there is no column and the caption gives the reason (test 3
  above): `turn the body upright` when the camera looks down or up the spine, `come closer` when the
  spine is drawn too short. Blocks above or below the plate are clipped; the column is drawn only
  inside the plate.
- **The column**: a 5 px wide ink block per level at x = 36 to 41 px from the plate's left edge (plus
  the left safe-area inset), from its band's top to its bottom less 1 px, the 1 px left as a gap in the
  halo color (the disc). Where a band is under 4 px on screen the gaps go and the blocks run together,
  except at the three region boundaries (C7 to T1, T12 to L1, L5 to S1–S5), which always keep their
  gap. Each block sits on a 3 px halo of `--level-halo`.
- **The labels**: 10.5 px at weight 560 in `--level`, on a 3 px stroke of `--level-halo`, right-aligned
  to x = 32 px, centered on their blocks. Every block taller than 12 px on screen is labeled; otherwise
  the region ends are labeled first (`C1`, `C7`, `T1`, `T12`, `L1`, `L5`, `S1–S5`), then the topmost
  and bottommost blocks in view, each skipped if it would come within 12 px of a label already placed.
  The font string names `"Ysabeau Office"` first, and the column waits for the face (section 4).
- **The selection's bar**: a 2 px ink bar at x = 45 to 47 px with 5 px end ticks, from the selection's
  box top to its bottom, each height placed on the column by `toColumn()`, on a 3 px halo. A selection
  that runs past C1's top or the sacrum's bottom ends at the column's end in an open drawn chevron
  pointing on; a selection wholly off the spine draws no bar (the card and the caption say `above C1`
  or `below the sacrum`). For a group or a region the box is the union of its parts' boxes.
- **The level of a height** (`js/levels.js`, tested by `tools/test_decode.mjs`): above C1's box top,
  `above C1`; below the sacrum's box bottom, `below the sacrum`; otherwise the label of the vertebra
  whose band holds it. A span is `{top} to {bottom}`, or one label when both ends fall in one band
  (`T12`).
- **Room**: the rule takes the plate's left 50 px. The readout card, the status plate and the camera's
  framing all keep clear of it (section 3).
- **Accessible**: the canvas is hidden from assistive technology; what it says is said in words: the
  card's `Levels` row (`T12 to L3`), spoken with the tap's sentence (`Right kidney. Organs. Levels T12
  to L3.`), and the caption line, which is text.
- **Cost**: 25 projections and at most 25 rectangles and labels per redraw, only when something moved,
  with one scratch vector and no style read.

---

## 2. Palette

`tools/art/palette.py` (run from `Template/`, standard library only) holds every value below and ends
`ALL CHECKS PASS` with exit 0 (`python3 anatomy/tools/art/palette.py`). It reads the body's colors from
`data/anatomy.json` itself, by the same resolution `applyLook()` uses (a part's `color`, else its
layer's `connectiveColor` for connective tissue, else its type's `color`, else its layer's), so nothing
is retyped. `--json` prints the four CSS custom properties this app adds, per theme; `styles.css`
carries them and `tools/check.mjs` fails while the two differ.

### The chrome tokens

The house tokens of HOUSE 3.1, copied exactly, in both themes. Measured by the same run:

| Pair (WCAG 2) | Light | Dark |
| --- | --: | --: |
| `--ink` / `--ink-2` / `--ink-3` on `--page` | 14.80 / 6.61 / 4.78 | 14.43 / 7.76 / 5.88 |
| `--ink` / `--ink-2` / `--ink-3` on `--sheet` | 16.40 / 7.32 / 5.29 | 12.87 / 6.92 / 5.25 |
| `--line-strong` on `--page` | 3.27 | 3.56 |

Highest chroma of any chrome token: 0.0239. No `backdrop-filter`, `box-shadow`, gradient wash, round
or pill radius (but the slider thumb's disc), `accent-color` or letter-spacing anywhere
(`check.mjs`).

### The plate and the body

| | Light | Dark |
| --- | --- | --- |
| Ground (`--plate`, the page itself; the WebGL canvas clears to transparent over it) | `#ffffff`, OKLCh (1.000, 0.0000, 90) | `#141d21`, OKLCh (0.224, 0.0152, 227) |
| The body | 55 colors over 1 752 parts, the same in both themes. Base colors L 0.314 (hair, `#3b2e27`) to 0.955 (the eye, `#f2f0ea`). Most used: muscle `#b0524a` x 478, artery `#c4383b` x 430, bone `#e6d9bf` x 201, vein `#3e62b6` x 198, cartilage `#b2cbd3` x 53, tendon `#ddd3c3` x 49 | the same |
| The body lit | the rendered-to-base factors `palette.py` states, 0.60 to 1.15 (a form's shaded side 0.82, its median face 1.04), calibrated once on the rendered bone (the calibration is recorded in `tools/DECISIONS.md`): L 0.233 to 1.000 | the same |
| The body off its ground (every color's shaded side, x 0.82, or median face, x 1.04, at dE 0.05 or more) | worst 0.177 (the eye, `#f2f0ea`); 48 of 1 752 parts have a median face within dE 0.06 of the ground (298 on the old `#e8eef0`): the palest bone, teeth and the eye's parts, separated by their shading and their warmth (ivory, chroma about 0.04, on a neutral ground) | worst 0.105 (hair); 0 parts within dE 0.06 |

**What was weighed, plainly.** In the light theme the most common light tissue, bone, is the body's
palest: its median face is L 0.917 against white's 1.000, and it reads by its shading and its warmth.
White parts it from the ground better than the old film base (L 0.945) did: the worst part's distance
rose from 0.123 to 0.177 and the parts within dE 0.06 fell from 298 to 48 (`palette.py`, 2026-10-07).
A mid-gray plate (L 0.75 to 0.80) would separate every part (0 within dE 0.06 at L 0.75), and the
slate plate in both themes separates bone best of all; both are recorded as alternatives in
`tools/DECISIONS.md`. The body reads as a printed figure on white (HOUSE 12).

The body's colors are the data's and stay so: `anatomy.json` is the file a person edits, and its
`_about` note invites them to recolor any part. The lighting (a room environment at 0.75, a warm key
light at 1.55, a cool rim at 0.7, neutral tone mapping) is display; About says the light is display,
not data.

### The signature, per theme

| | Light | Dark |
| --- | --- | --- |
| Ground | the plate, white, L 1.000 | the plate, L 0.224 |
| Signature (`--level`) | `#15121c`, OKLCh (0.191, 0.0204, 298): beyond `--ink` (L 0.218) | `#f4f2fb`, OKLCh (0.965, 0.0121, 296): beyond `--ink` (L 0.941) |
| Its halo (`--level-halo`) | the plate at 0.85, `rgba(255, 255, 255, 0.85)`, 3 px | `rgba(20, 29, 33, 0.85)`, 3 px |
| On the bare plate | 18.50:1 | 15.43:1 |
| Worst on its halo over any lit body color | 13.64:1 (over `#231c17`, hair in shade) | 9.70:1 (over `#ffffff`, a highlight) |
| Without the halo | 1.10:1 | 1.00:1 |

**Why the halo is a must.** The body's highlights reach L 1.000 and its hair in shade L 0.233, so no
ink is beyond every data color in either theme: the body has no lightness band the signature could
keep clear of, because a lit body uses the whole range. The Levels therefore never touches the body
without its halo, and the worst case above is measured over the halo. Labels on the plate in Norne
Reservoir and Milky Way are drawn the same way.

A near-neutral (chroma 0.0204 and 0.0121, under the house's 0.021), not `--ink` and not a hue of any
data color. Its hue, 296 to 298 (the violet of the stain histology uses to show nuclei), is its own;
the template's other signature inks sit at 231 and 95 (Global Weather), 258 and 253 (Milky Way), 52
and 75 (Besseggen), 122 and 126 (Norne). Near-neutrals at the far end are close by construction:
light, dE 0.024, 0.015, 0.034 and 0.040 to those four; dark, 0.023, 0.008, 0.030 and 0.032 (the same
run). The Levels is a different mark in a different place.

### The selection

**The house's selection mark, alone: an ink outline.** A selection of up to 60 parts keeps its own
colors and is outlined: 1.5 px of `--ink` around its silhouette on a 1.5 px halo of the plate at 0.90
(`--select-halo`), worst 14.18:1 (light) and 10.74:1 (dark) over any lit or tinted body color (`palette.py`, on the white plate). No
hue is added, so after a tap the Levels is still the boldest thing on the screen, and a muscle is read
in its own red. The outline is two back-face hulls per selected part, sharing its geometry, each vertex
pushed along its normal by a constant 3 px (the halo) and 1.5 px (the ink) on screen. A hull's back
faces lie at the surface's own depth, so on thin or double-sided soft tissue they would fight the
surface for depth and scribble inside it; the selected parts write 1 into the stencil buffer wherever
they are drawn and the hulls draw only where it is not 1, so the outline can only ever lie outside the
silhouette. `shoot.mjs` selects the Left external oblique by a tap at the opening and finds 0 changed
pixels inside its silhouette in both themes, the outline's ink around it.

**A larger selection** (a large group, or a region, of more than 60 parts) has no outline, which would cost two draw calls a part; it takes the data's selection color
instead (`colors.selected` `#3552d6` and `colors.selectedDark` `#8ea2ff` in `anatomy.json`), lerped at
0.3 in linear sRGB with no glow. That tint is gentle by design: it moves 767 (light) and 808 (dark)
parts by less than the dE 0.10 that reads on its own (`palette.py`), and the card, which names the
selection and counts its structures, and the bar beside the Levels carry the reading. About names the
outline and the tint as display choices.

**X-ray when the selection is hidden.** When Find, or `Zoom to it`, flies to a structure that the
layers in front of it would hide, X-ray turns on, so the selection is drawn whole and everything else
see-through, and the live region says so after the tap's sentence: `X-ray on, so it shows through the
muscles.` Under X-ray the selection is drawn after the see-through layers, over them, in its own
colors: at 12 % each, the layers in front would otherwise wash it toward the plate until it read only
by its outline. It stays opaque and pickable; only its place in the drawing order moves. `shoot.mjs`
finds the found right kidney's pixels unchanged (0 of 32 842 inside its silhouette in the light theme,
0 of 32 843 in the dark) when every layer but the organs is turned off. Whether it is hidden is
measured at the flight's destination: rays from there to eight of the selection's vertices, and the
first that meets the selection before anything solid settles it as seen. X-ray turned on that way
belongs to that selection and goes off when it is let go; X-ray pressed by hand is kept between
selections and launches. Of the eleven structures `shoot.mjs` finds by name, ten turn X-ray on (the
kidneys, the celiac trunk, the renal artery, the aorta, the hyoid, the cricoid, the trachea, the
pancreas, the scapula); the xiphoid process, which a ray from the camera reaches, does not.

### The Layers sheet's swatches

Each layer's swatch is its data color, 10 x 10 px, square, framed by a 1 px `--line-strong` edge
(3.27:1 light, 3.18:1 dark on the sheet's grounds); the swatch itself falls to 1.02:1 (bone on the
light sheet) and is never the only carrier: its name stands beside it. Nine layers are more than five
categories (HOUSE 3.3); the closest pair, muscle and artery, is dE 0.020 under deutan vision, which is
why words carry identity everywhere.

### The ghost key

A 1.4 px stroke at rest (72 %) over a 3.4 px halo: light `#0f1c23` over `rgb(246, 249, 250)` at 0.60,
worst 4.04:1 over every lit body color; dark `#f2f4f1` over `rgb(10, 16, 19)` at **0.70** (the house's
0.45 measures 2.17:1 over the body's white highlights; Norne made the same change), worst 4.28:1.

### CSS custom properties this app adds

`--plate` (`#ffffff`; dark `#141d21`), `--level` (`#15121c`; dark `#f4f2fb`), `--level-halo`
(`rgba(255, 255, 255, 0.85)`; dark `rgba(20, 29, 33, 0.85)`), `--select-halo`
(`rgba(255, 255, 255, 0.90)`; dark `rgba(20, 29, 33, 0.90)`), as `--json` prints them. `app.js` reads
`--level` and `--level-halo` for the column, and `--ink` and `--select-halo` for the outline, again on
a theme change.

---

## 3. The chrome, object by object

The frame at 390 x 844 (CSS px, safe areas outside):

```
+------------------------------------------+
| Anatomy          [Layers] [Find] [About] | 39  name 15/650; three word keys (while
|                                          |     loading: the stamp's count under the name)
| Skin  Muscles  Organs  Arteries | Front …| 44  the depth words, tracer under one; views
+------------------------------------------+
|C1 =  [card                ]         [+]  |
|   =                                 [-]  |     the plate: the body in its own colors;
|C7 =                                 [#]  |     the Levels at the left edge;
|   =                                 ---  |     keys: Zoom in, Zoom out, Show the whole
|T12=|                                [H]  |     body / Hide the controls
|L5 =|                                     |
|S1–S5                                     |
|      [3 structures hidden   Show all]    |     the status plate, when there is one
+------------------------------------------+
| Levels: this body's spine in 25 levels,  | 30  the caption line, two lines, fixed
| C1 to S1–S5, drawn beside it where the … |
+------------------------------------------+
| [Remove the skin]  Every layer is showing| 44  the dissection band: step keys
| [Explode] ----*-----------  Part Group Region | 44  explode key, track, the explode words
+------------------------------------------+
```

The page is a one-column grid: header, plate, caption band, dissection band; `100dvh`,
`overscroll-behavior: none`; the plate's row `minmax(200px, 1fr)`. The WebGL canvas and the Levels
canvas live inside the plate, so nothing overlaps the model. The plate is 624 px tall at 390 x 844 and
719 px in focus mode (`shoot.mjs` holds them at 540 and 700 px or more).

| Object | Here | Notes |
| --- | --- | --- |
| **Header: name** | `h1` `Anatomy`, 15/650, `translate="no"` | `miniapp.json`'s name, the Library row the camera opens. |
| **Header: word keys** | at the right: `Layers` (opens the Layers sheet, `aria-expanded`, `aria-controls`) and `Find` (opens Find a structure, `aria-haspopup="dialog"`) | Word keys in the units key's form: 600 at 12.5 px in a 1 px `--line-strong` frame, 28 px tall, 6 px radius, 44 x 44 hits. `Find`'s accessible name is `Find a structure` (it begins with the visible word). There is no units key: the screen shows counts and levels, no quantity to convert; About's two lengths are SI. A third key, `About`, opens About once the model is in. |
| **Header: stamp** | `<button>` opening About (`aria-haspopup="dialog"`, described *Opens About this data.*), 11.5 px `--ink-2`, a 44 px hit, one line | Data built once (HOUSE 4.2 and 4.15): the stamp's line shows only while the model loads or when it cannot be read (`The model could not be read.`), and is hidden once the model is in. The edition, `BodyParts3D 3.0 and 4.0, 1 752 structures`, is About's first *This data* line: `BodyParts3D 3.0 and 4.0` is a constant `check.mjs` checks against `geometry.json`'s `source` (which names both releases); the count is the parts built, through `units.js`. While loading it counts: `Reading the geometry… 12 of 32 MB`, then `Building the structures… 800 of 1 752` (a megabyte as a million bytes: the eight `.bin` files hold 31 962 192 B). Nothing is refreshed but `anatomy.json`'s text, so there is no stale state. |
| **Row of words** | the depth words, then a 1 px `--line` divider, then the views | **Depth** (`role="radio"` in a `role="radiogroup"` named `Show the body from`, the tracer under the outermost layer that is not off): the data's `short` names in peel order, `Skin`, `Muscles`, `Organs`, `Arteries`, `Veins`, `Brain`, `Cartilage`, `Bone` (teeth are never peeled, so `Bone` is the deepest). A tap on a word shows the body from that layer in: every layer outside it goes off, its mode remembered as the remove key remembers it (`layerPrev`), and it and every layer inside it that is off comes back in the mode it had; the changed layers fade over 320 ms together, at once under Reduce Motion. **Views** (`Front`, `Back`, `Left`, `Right`, `Top`; plain buttons, no tracer, since a view is a camera move and not a state; each described, *Turns the camera to the body's left side*, by a hidden element so a swipe through the page reads it once). `Left` and `Right` are the body's own sides. A stated departure from the house's order (views first): the depth words come first because they are the app's main action and the row scrolls. Words in full, 12.5 px, 44 px hits, 16 px between words, the row scrolling sideways inside itself. One tab stop for the depth group; the arrow keys move the choice inside it. |
| **Key column** | `--sheet` plates on the plate's right edge, inset 8 px: `Zoom in`, `Zoom out`, `Show the whole body` / `Hide the controls` | 44 x 44 hits drawn 36 x 44, 16 px marks in 1.5 px strokes, `--ink-2` at rest. The zoom keys move the camera's distance by 0.7 and 1/0.7 toward the target (one-finger and keyboard zoom, WCAG 2.5.1). `Show the whole body` draws four corner brackets around a small standing figure: a 3 px head circle over a 7 px stroke. Where the column does not fit the plate's height (a phone on its side with a short plate), the keys run as a row along the plate's top. |
| **The Levels** | the signature, on the plate's left 50 px | Section 1. Stays in focus mode. |
| **Readout card** | the selected structure, group or region: `--sheet`, a 1 px `--line-strong` edge, 8 px radius, beside the Levels (x = 58 px), at most 280 px wide and as wide as the room left of the key column allows, at most 55 % of the plate's height, scrolling inside itself. It opens at the top-left, 8 px down, or at the bottom-left, above the status plate, whichever keeps it 24 px or more from the point the tap touched (half a fingertip), so it never opens under the finger, and covers less of the selection's projected box; where neither place clears the finger it narrows to end left of it, or else shrinks into the taller band above or below it. The tap that opens it presses nothing on it: the browser sends a touch's click after the touch to whatever then stands there, and the app swallows that one click should it reach the card. In focus mode it sits level with the ghost key, under the top safe area, and ends 8 px before it (under it, where the plate leaves less than 180 px beside it) | **The place line** (12.5 px `--ink-2`): the selection's group and region as text keys separated by a comma (`Muscles of the abdomen, Abdomen`; for a group, its count and its region: `12 structures, Abdomen`), each a 44 px-tall hit that selects it, underlined 1 px `--line-strong` at a 3 px offset; ✕ at the right (SVG, a 44 px hit, `Close`). **The one large figure**: the name, 21/600, wrapping. **The Latin**, 13.5 px `--ink-2`, upright, `lang="la"`, `translate="no"` (the house face has no italic, and `font-synthesis: none` keeps the browser from slanting it). **Rows** (`dl`, 12.5 px, labels `--ink-2`, values 560 `--ink`, right-aligned): `Layer` (`Muscles and tendons`), `Levels` (`T9 to L5`, or `below the sacrum`), and where the data has them `Label` (`C5`) and `Tooth` (`36`, the FDI number). **Description** and **note** (12.5 px / 1.45, `--ink`, the note in `--ink-2`). **Actions**, four text keys in one row, 44 px tall: `Zoom to it` (named so it is not confused with focus mode), `Isolate` / `Show all`, `X-ray` (`aria-pressed`, the 28 x 28 on-plate when on), `Hide`. In: 120 ms fade and a 4 px rise; out at once. Text updated in place, never rebuilt while it is open; no live region on the card itself. A tap says it once, in the live region: `Right kidney. Organs. Levels T12 to L3.` (and, when the flight turned X-ray on, `X-ray on, so it shows through the muscles.`). **The compact form**, on a plate under 420 px (375 x 667, a phone on its side, the Layers sheet open): the name at 15 px, the Latin and the `Layer` row left out so the `Levels` row stands right under the name, `Zoom to it` reading `Zoom` so the four actions keep one row, the rest scrolling, at most 80 % of the plate (at 375 x 667 the plate is 447 px since plan 0012's text cut, so the card is full there; `shoot.mjs` checks that the form follows the plate, one row of actions and the Levels row in view). |
| **Selection on the plate** | the ink outline; past 60 parts the data's tint | Section 2. A larger group or region keeps the gentle tint and the card, which says how many structures it holds. |
| **Status plate** | when structures are hidden or one is isolated: a `--sheet` plate with a 1 px `--line-strong` edge and an 8 px radius at the plate's bottom-left, 8 px right of the Levels, 12.5 px `--ink`: `3 structures hidden` or `Showing only Left femur`, then the text key `Show all` (44 px hit) | A state, said in words, and it stays in focus mode. Hidden-by-default parts (the heart's four cavities) are not counted. |
| **Caption band: the caption line** | 11 px `--ink-2`, a fixed two lines below 640 px wide and one from 640 px | The Levels' sentences (section 1, test 3); when exploded and nothing is selected: `Pulled apart 45 % by part, a display distance; the levels follow the vertebrae as drawn.` The structure's name is never in the caption (the card holds it), so the longest sentence is bounded: `shoot.mjs` measures every variant at 312, 320, 360, 375 and 844 px inside the fixed height. The plate never resizes when the words change. |
| **Credits** | the constant `CREDIT`, in About | `BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP and CC BY 4.0`: the attribution the geometry's license asks for, with its two licenses, About's first paragraph under *Sources and credits*, word for word, before the full statements (also in `CREDITS.txt`). Commas, no middle dot. Nothing on the front carries a credit (HOUSE 4.15), so no other credit is more prominent than it. |
| **No legend** | | The body's colors are representational, not a scale; the Layers sheet's swatches are the key to the layers (HOUSE 4.0: a 3D view without time carries no legend). |
| **Dissection band** (in the player's place, on `--page`, a 1 px `--line` rule on top) | two 44 px rows | **Row 1, the step keys**: `Remove the skin` and `Bring back the skin` (word keys in the units key's form). Their accessible names are `Remove the skin and hair layer` and `Bring back the skin and hair layer`, which the camera taps by prefix, and their visible words are the beginning of those names (WCAG 2.5.3): `Remove the ${short}` and `Bring back the ${short}`, lowercased from the data's `short`. When there is nothing to remove, the key reads and is named `Only bone and teeth are left`; when nothing to bring back, `Every layer is showing`, the camera's wait string; both disabled, frameless, in `--ink-3`. **Row 2**: `Explode` / `Assemble` (a word key; 900 ms on `--draw`'s curve, a cut under Reduce Motion); the explode track; the explode words `Part`, `Group`, `Region` (`role="radio"` in a `role="radiogroup"` named `Explode by`, the tracer under the chosen). The words set how the body comes apart and nothing else: they never move it, so arrowing through them changes no picture but the way an explode already applied is spread. The **track** is a native `<input type="range" id="explode">` named `Explode amount`, which the camera finds as a slider and sets by taps at 0.45 and 0.01 of its width (HOUSE 7.4), drawn by CSS alone in the house's slider language: a 48 px box with 2 px taken back above and below (a full 44 px hit in its 44 px row), a 1 px `--line-strong` baseline, the value so far 2 px `--ink` (hard stops, no blend), an 8 px `--ink` thumb in a 3 px `--page` ring; `aria-valuetext` `45 percent, by part`. The track is 86 px wide at 320 px, 78 px at 125 % text zoom (312 px), 126 at 360, 141 at 375 and 366 on its side at 844, and a tap at 0.45 of it lands on 44 or 45 and at 0.01 on 0 at every one of those widths (`shoot.mjs`). |
| **Layers sheet** | a sheet between the caption band and the dissection band, so the step keys stay right under it, on `--page` with a 1 px `--line` rule on top, keeping the plate at least 260 px (measured 260) and scrolling inside itself; `Layers` 13.5/650 and `Close` at the top; one row per layer, 44 px | Row: the swatch (section 2), the layer's name in full (13.5 px), its count (`527`, `--ink-2`, tabular), then `Off`, `Faded`, `On` as words with the tracer under the chosen (`role="radio"` in a group named by the layer's name). The note under the title says how the remove and bring-back keys relate to it. `Turn every layer on` is a text key at the foot. On a wide screen (at least 820 x 480) the sheet is a 380 px column at the right, and on a phone on its side a column of at most 340 px. |
| **Find a structure** | a full-height `--sheet` panel: `role="dialog"`, `aria-modal`, slides up 220 ms on `--sheet-in`, closes at once, `Close` at the top right, Escape, focus held and returned; while it is open the page behind it is `inert` | The search field: 44 px tall, a 1 px `--line-strong` frame, 6 px radius, placeholder `Femur, liver, biceps, C5, tooth 36` in `--ink-3`, its text at 16 px (a stated departure from the scale: iOS zooms the page into any field set smaller). The engine's own clear button is switched off (`::-webkit-search-cancel-button`; WebKit and Chromium draw it in their accent color, the one color the house never uses); in its place, while the field holds text, `Clear the search`: the card's drawn 12 px ✕ (1.5 px strokes, `--ink-2`) in a 44 x 44 hit at the field's right end, which empties the field, brings the tree back and returns focus to the field. Results and the tree: rows of 44 px or more (a part's row 46), the name 13.5 px `--ink`, the Latin 12.5 px `--ink-2` upright, right-aligned; a hidden part's name in `--ink-3` with `, hidden` for VoiceOver; the selected part's name at 620 with the tracer under it. Layers and groups open with a drawn 10 px chevron (1.5 px strokes, `--ink-2`): a layer's whole row (chevron, swatch, name, count) is its toggle; a group's chevron is a 44 px key of its own just before its name, and the name selects the group. A group's parts are built the first time it opens. Visibility: a drawn 16 x 16 box (1.5 px `--ink-2` frame; a check in `--ink` when on; a bar when some are on) in a 44 x 44 hit, named for what it shows: `Show Muscles and tendons`, `Show Muscles of the thigh`. The `Nothing matches` sentence keeps its words with real quotes. A choice flies to the structure, and turns X-ray on when the layers in front hide it (section 2). |
| **Notices** | a `--sheet` plate centered on the plate, `role="alert"`, 13.5 px, at most 300 px, no icon | In the file's terms, no apology: `data/geometry.json could not be read (HTTP 404).`, `data/geometry-muscle.bin holds 9 509 900 bytes; data/geometry.json says 9 509 920.`, `data/anatomy.json is not valid JSON.` (or `… is not valid JSON; it looks like a web page was written over it.` when it starts like one), `This phone gave no WebGL, which the 3D view needs.`, and, opened from a file: `This app reads its data over Snuggery’s own server; opened as a file, the browser blocks it.` A broken `anatomy.json` on a later read keeps the text already loaded and says so once: `data/anatomy.json is not valid JSON. The text already loaded stays.`; the next touch on the plate clears it. |
| **Live region** | one `<p class="sr" aria-live="polite">` | A tap's sentence; a peel or an add (`Muscles and tendons removed.`); X-ray turned on by a flight; focus mode's two sentences. Never per frame. |
| **About** | a full-height `--sheet` panel from the `About` key (and the stamp): `role="dialog"`, `aria-modal`, slides up 220 ms on `--sheet-in`, closes at once, `Close` at the top right and at the foot, Escape, focus held and returned; while it is open the page behind it is `inert` | **1. What the picture is**: the data's `about.intro`, verbatim; then one adult male reference body, every structure a separate surface model; its colors come from `anatomy.json` and are a display convention (arteries red, veins blue, bone ivory), not measured tissue colors; the light and the shading are display; a faded layer is drawn see-through and ignores taps; the explode moves parts apart by a display distance from their region, group and own centers; the selection's outline and tint are display choices, and X-ray turns on by itself for a structure the layers in front hide; and, under its own head `The levels beside the body`, what the Levels show and what they do not (section 1, test 6). **2. This data**: `label: value` lines: the edition first (`BodyParts3D 3.0 and 4.0, 1 752 structures`), structures (1 752), one line per layer with its count, triangles (3 448 950, simplified from the source data), height from sole to crown (1.68 m, the skin's box: 1.684 527 m from the four skin parts' boxes in `geometry.json`), geometry (32.0 MB in 8 files), the levels on the spine (`25, C1 to S1–S5, the sacrum as one`), coordinates (meters, Y up, +Z the body's front, +X its left). **3. Sources and credits**: the credit line; `about.sources[0]` and `[1]` from the data, verbatim; then, written by the app, `Rendering: three.js r186, MIT License (its text is in vendor/three-LICENSE.txt).` and `Type: Ysabeau Office by …` (section 4), the same words as the data's third paragraph, which is therefore not printed twice; `What is not included`, the data's `gaps`, verbatim; `For learning and reference. Not for diagnosis or clinical use.` **4. How the data gets here, and how to use it**: built once by `tools/` from BodyParts3D 3.0 and 4.0; nothing is fetched; `anatomy.json` is re-read when the app comes back, so edits made in Snuggery show; then the gestures and the keys, in sentences (drag to turn, pinch to zoom, two fingers to pan; the depth words; `Remove the` and `Bring back the`; `Layers`; `Find`; a tap, a double tap; `Zoom to it`, `Isolate`, `X-ray`, `Hide`; Explode, its track and its three ways; what is kept between launches). |
| **Focus mode** | `Hide the controls` alone in the column's last plate; the ghost key `Show the controls` (`aria-keyshortcuts="Escape"`) top-right of the plate, 8 px under the top safe area; Escape when no sheet or dialog is open | Leaves (`hidden` and `inert`): the header (name, `Layers`, `Find`, the row of words), the key column, the Layers sheet, the explode row (`Explode`, the track, `Part`, `Group`, `Region`), an open card (it closes on the way in). Stays: the plate and the Levels; the `About` key, moved into the caption band as its first line (with the stamp's line, which shows only while the model loads); the caption line; the status plate; and **the one control the view needs, the step keys**, which take the body apart a layer at a time and put it back, as a player's step keys move through its steps. The step keys rather than the explode track, because the bring-back key's name, `Every layer is showing`, is what the marketing camera waits for before its focus guard runs (section 5): a library left in focus mode must still show it. `shoot.mjs` counts what is left in focus mode: `Show the controls`, `About`, and the two step keys. A tap still opens the card; a double tap still flies to a part. **Remembered** as `skeleton-viewer:focus` (`'1'` or `'0'`), restored before the first draw. Sentences: `Controls hidden. Press Escape or the corner key to show them.` and `Controls shown.`; focus moves only when the keyboard did it. Fades: chrome out 160 ms, the ghost key in 200 ms, one resize. |
| **The opening** | none | The arrival is the body appearing once its ten files are in; the stamp counts while they load. The body appears at the explode amount it was left at (HOUSE 4.11). |
| **Motion** | HOUSE 4.12 | A camera move that answers a touch (a view word, the zoom keys, `Show the whole body`, `Zoom to it`, a double tap, a choice from Find) lasts 750 ms on `--draw`'s curve; any touch ends it at its destination. The level change takes 600 ms, the peel fade 320 ms, the explode key 900 ms, all on `--draw`'s curve. Reduce Motion is read live, with a `change` listener: every one of those becomes a cut, and CSS durations are 0 s. The render loop asks for a frame only while something is dirty, a tween runs or the controls are still damping. Hidden: the loop stops, a running tween lands on its end; a return re-reads `anatomy.json` and redraws. |
| **On its side** | HOUSE 4.13 | The header one 46 px row (the name at left, over the stamp while loading; the row of words; the three word keys); the caption band one line; the dissection band one row (the step keys, `Explode`, the track, the explode words); the key column as a row along the plate's top when the plate is short. The caption line runs on one line across the band. At 844 x 390 the plate is 278 px tall (at least 220, `shoot.mjs`); the key column still fits it (the row takes over below a 212 px plate); the Levels is in the opening (section 1). The card takes its compact form. |
| **Safe areas** | HOUSE 4.14 | Every band pads itself; the Levels' x positions add the left inset; the card, the status plate and the ghost key sit inside the plate's insets. The camera's fit keeps the body out of them too: `app.js` reads the four insets on every resize from a hidden probe padded by `env(safe-area-inset-*)`, and the room it fits into adds the left inset always, the right one in focus mode and beside the keys, and the top one in focus mode, where the plate runs up under the status bar. `shoot.mjs` gives the probe a 47 px top inset by a test style and finds the body's top 47 px or more under the plate's top in focus mode. Headless Chromium has no real safe areas, so the rest is a phone check. |

**The camera's framing** (`frame()`, `room()`). The room the body is fitted into is the plate less the
Levels' 50 px at the left, the key column's 54 px at the right (or the key row's 52 px at the top), the
status plate at the foot and the safe-area insets; when the selection itself is framed (`Zoom to it`, a
double tap, a choice from Find, Isolate), less the card too, so the card never covers what it
describes. The fit is exact: the nearest distance at which all eight corners of the box project inside
the room with 4 % to spare, found by bisection. A fit (the first run, `Show the whole body`, a view
word) frames every part that is not hidden, whatever its layer's mode, so removing a layer never moves
it; while the camera stays at a fit (turned, but not moved in or across), a change of the plate's size
fits again at once, and the explode, when it settles, fits again with a flight, so the body pulled apart
stays whole on the plate (the camera's README picture at 45 %) and a return to 0 is the opening frame,
pixel for pixel (`shoot.mjs`).

**What does not apply, and why:** a units key (no quantity on screen to convert); a legend (no color
scale); a player, a time row and the one large figure in it (no time: the large figure is the card's
name, only while the card is open); a `now` notch and stale states (the model is built once); an
opening (above).

---

## 4. Type

- **The house file, byte for byte.** `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
  `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
  sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copies of
  `global-weather/fonts/` (`check.mjs` pins both). The one `@font-face` rule exactly as HOUSE 2.5
  gives it; the family used only through `--face`; `font-synthesis: none` on `html`, since the face
  has no italic and Latin names are set upright. No other face ships.
- **No supplement.** Every character the app writes outside comments is in the cut. Beyond ASCII the
  data holds U+2013 (50 times, as in `S1–S5`), U+2019 (4) and © (1); `app.js` writes “ and ” (the empty
  search's sentence), U+202F, U+2212, U+2026 and the typographic apostrophe U+2019. All are in the cut
  (HOUSE 2.2).
- **The scale here:** name 15/650; the word keys 12.5/600; stamp 11.5; the row's words 12.5 (620
  chosen); the Levels' labels 10.5/560 on their halo; card place line 12.5, the name 21/600 (the one
  large figure, only while the card is open; 15 in the compact form), Latin 13.5, rows 12.5 (values
  560), description 12.5; status 12.5; caption 11; credits 10.5; the step keys and the explode words
  12.5; the Layers sheet's names 13.5, counts and words 12.5; Find's rows 13.5 and 12.5, its field 16
  (stated above); About's title 15/650, heads 13.5/650, prose 13.5/1.5 within 62 ch; notices 13.5.
- **Text waits for the face.** `document.fonts.load('560 10.5px "Ysabeau Office"')` before the Levels'
  first draw, and the column redrawn on `document.fonts`' `loadingdone`. Every font string in a script
  names `"Ysabeau Office"` first.
- **Figures**: tabular and lining by the face's default; counts grouped with U+202F from four digits
  (`1 752`, `3 448 950`).
- **Credit line, word for word** (About, `NOTES.md`, `CREDITS.txt`): `Ysabeau Office by Christian
  Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.`

---

## 5. The camera's strings (HOUSE 7.4)

What the marketing camera reads in this app, in the Snuggery app's repository:
`Tests/SnuggeryUITests/MarketingCameraCase.swift` (`waitForAnatomy()`, lines 212 to 229, and the note
on `webControl(prefixed:)`, lines 59 to 75), `MarketingShotsUITests.swift` (shot 16, lines 440 to 447;
the README panes, lines 563 to 600) and `MarketingClipsUITests.swift` (clip 3, lines 188 to 226).

| String | Role | Kept as |
| --- | --- | --- |
| `Every layer is showing` (`webText`, `label CONTAINS[c]`, waited up to 240 s, then again after the put-back) | the disabled bring-back key's accessible name, written only from `syncLayerUI()` inside `applyAnatomy()` | the same name, written at the same moment and never before the model is in (`index.html` must not contain it). Its visible words are the same string. It stays on screen in focus mode, because `waitForAnatomy()` waits for it before it calls its focus guard. |
| a control whose label begins `Remove the` (`webControl(prefixed:)`, buttons first) | the remove key in the dissection band | `Remove the skin and hair layer` and its successors, a `<button>`; the only buttons whose names begin so. |
| the slider `Explode amount`, set by taps at 0.45 and 0.01 of its width | `app.sliders["Explode amount"]` | a native `<input type="range">` with `aria-label="Explode amount"`, its frame the track's 44 px box. A tap at 0.45 must land between 42 and 46, and at 0.01 on 0; `shoot.mjs` checks both at five widths and on its side. The explode words never move the body, and the camera never taps them. |
| a control whose label begins `Bring back the` | the bring-back key | as above. |
| `Show the controls` (`showControlsIfHidden()`, called by `waitForAnatomy()`) | the ghost key of a remembered focus mode (`skeleton-viewer:focus`) | the exact name; a kept library left in focus mode shows the step keys, so the wait passes, and the guard then brings back the rest. |
| what the camera changes | a peel and the explode amount | put back by the same controls: the slider to 0, the skin brought back faded, and `Every layer is showing` again. |

Nothing the camera waits out got longer: the files and their order are as they were, there is no
opening, and the camera's pauses (3 s, 3.5 s after the peel, 2.5 s after the explode) outlast the
320 ms fade and the 750 ms refit after an explode. No string the camera waits for or taps changed in
this app's house pass.

---

## 6. Budgets

`node tools/check.mjs` prints every size on every run; the ZIP is built there exactly as
`build-zips.yml` builds it. Figures of 2026-10-02:

| | As built | Cap | Command |
| --- | --: | --: | --- |
| App code | **116 467 B** (`app.js` 71 183, `index.html` 13 663, `styles.css` 24 275, `js/levels.js` 5 064, `js/units.js` 2 282) | **200 000 B** (HOUSE 8; the app was 57 615 B before its house pass, under the cap, so its own size does not hold it) | `find . -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.mjs' \) -not -path './vendor/*' -not -path './data/*' -not -path './tools/*' -print0 \| xargs -0 wc -c` |
| Fonts | **40 075 B** (the house face 35 372, `OFL.txt` 4 703) | 160 000 B | `cat fonts/* \| wc -c` |
| ZIP, as `build-zips.yml` packs it | **24 552 764 B** (data 24 010 651 and `vendor/` 430 286 stored) | **30 692 577 B** (24 554 062 B before the house pass × 1.25, rounded down, and no face allowance: an app that swaps its own faces for the house's gets none) | `zip -q -r -X OUT . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`, then `wc -c` |

The app uses 58 % of its code budget and 80 % of its ZIP cap, far from either.

`vendor/` is outside the code budget (HOUSE 8) and must not change by a byte: Snug Kart's
`tools/check.mjs` (line 46) pins its own `vendor/` to this folder's. Its sha256:
`OrbitControls.js` `30386f71…2fdda`, `RoomEnvironment.js` `77d4d2be…ed9dc`, `three-LICENSE.txt`
`8b378ebe…3b5bc`, `three.core.js` `9edde002…a769e6`, `three.module.js` `9052042d…7812ea`
(`shasum -a 256 vendor/*`; `check.mjs` pins the full values).

The data is pinned (`check.mjs` checks it every run): the geometry as it was before the house pass,
`anatomy.json` as its text was last rebuilt, in US English (`tools/DECISIONS.md` has the record).
`find data -type f | sort | xargs shasum -a 256 | shasum -a 256` gives
`9b1358abd95e56f81ddbf6232fd613ce5609ea1c964dfc6008d72c08f266ce8c`; per file, `anatomy.json`
`7f1106b7…c11a2`, `geometry-artery.bin` `63070c34…6f441`, `geometry-cartilage.bin` `cb627499…ded94`,
`geometry-muscle.bin` `8392bfe8…fc393`, `geometry-nerve.bin` `9a4cb029…031d9`, `geometry-organ.bin`
`09773374…594cd`, `geometry-skin.bin` `2ab98a2d…b7762`, `geometry-vein.bin` `775a78e2…f09df`,
`geometry.bin` `bfcd6e57…23ce7`, `geometry.json` `f71878ca…22052` (`shasum -a 256 data/*`;
`check.mjs` holds the full values). `screenshots/app.png`, the README's composite, is
`27f89f092307cdeacde319753fec697bdfdb4c6677912cdfce50e6583a040a7c` and stays so.

---

## 7. The generated-page tells, answered

| Tell | Anatomy |
| --- | --- |
| 1. Warm cream ground, high-contrast serif display, terracotta accent | The ground is white `#ffffff` in the light theme (HOUSE 12); one Renaissance sans at every size, the Latin names upright in it; no accent. Warm hues on screen are the body's own. |
| 2. Near-black ground with one acid-green or vermilion accent | The dark page is the house slate (L 0.224). The bright things in the dark theme are the body and the Levels. The data's periwinkle appears only as the tint of a selection larger than 60 parts, at 0.3, and About calls it a display choice. |
| 3. Broadsheet hairlines, zero radius, dense columns | One column; hairlines only between the sheets' sections, the key plates and the dissection band. Radii 6, 8 and 4 px by role. |
| 4. SaaS-card kit, one radius, soft shadow, gradient washes | One card (the selection), one sheet at a time, no shadow, no blur, no glass. No gradient but the explode track's hard-stop fill and the selection tracer. |
| 5. All-caps tracked eyebrow labels | None; `letter-spacing` 0 everywhere. |
| 6. Meta strings joined with middle dots | None. The credit line and the card's place line use commas. |
| 7. "WORD — fragment" with a spaced em dash | None on screen; `NOTES.md` uses commas and colons in prose. |
| 8. A tinted near-black standing in for black | The darkest ink is the Levels' `#15121c`, a stated signature, and `--ink` `#0f1c23`. |
| 9. Monospace for small data labels | None; tabular figures from the one face. |
| 10. An arrow appended to buttons | None. The keys say what they do, `Remove the skin`, `Bring back the skin`. |
| 11. One accented word in a headline | None. |
| 12. Unnecessary labels above content | The Layers sheet's one sentence under its title stays, because it says how the remove and bring-back keys relate to the modes; nothing else is labeled from above. The card's rows are a `dl`, labels at the left. |
| 13. Numbered markers | None. `C1` to `L5` and tooth `36` are the data's names, not markers. |
| 14. Big number, small label, gradient accent | None; the one large figure is the selected structure's name, 21 px, in the card. |
| 15. Scattered fade-and-slide entrances, hover on every card | No entrance and no opening; the house's small transitions answer a touch; hover only on controls, only where the pointer hovers. |

The interface guidelines, where the house writes its own rule: sentence case (`Hide the controls`,
`Show the whole body`, `Turn every layer on`); `font-display: block`; `translate="no"` on the name,
`BodyParts3D`, the Latin names and the vertebra labels; `…` never `...` (the stamp's count); `<button>`
for every action (the explode words are buttons; the search field stays a field); the viewport allows
the page zoom (the search field's 16 px is what keeps iOS from zooming into it); `<html lang="en-US">`;
a dialog makes the page behind it inert; a description is read once, by `aria-describedby`.
