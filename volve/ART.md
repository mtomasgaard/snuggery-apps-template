# Volve: art direction

`NOTES.md` says what the app does and where every number comes from. This file says how it looks,
moves and speaks under the template's house system (`Template/HOUSE.md`). Volve is Norne Reservoir
2.3 carried to a second field, so its chrome, its plate, its card, its sheet, its pane and its
signature are Norne's, and Norne's `ART.md` is their full account; what follows is what Volve keeps,
what it changes, and what it adds: the seismic in the section. Every figure names the command that
printed it; the scripts are in `tools/`, which the ZIP leaves out. The record of how the app was
built, and the choices an owner may want to reverse, are in `tools/DECISIONS.md`.

**Version 1.0 (2026-10-07, the template's plan 0012).** Measured on the build Mac with the commands
named. Load, frame and memory figures are headless WebKit and Chromium: a trend, never phone evidence.
**Version 1.1** takes Norne Reservoir 2.4's two changes of plan 0012: plasma and viridis for pressure and
the rock (D16) and the compass back on the plate (D17), recorded below with Volve's own measurements,
and makes the section follow the finger: drawn from what it has while the view moves and in full at rest
(section 2, *The seismic's drawing*).

---

## The look: the house, with one bold thing of its own

The house chrome whole: one face, gray chrome, the row of words, the key column, the caption band,
the player and the app's own track, the readout card, About, focus mode, SI and the no-tells rules.
The ground is white (`#ffffff`, Norne's, HOUSE 12); the front holds the name, the view and its
controls, and the sources, credits and edition are in About, which the `About` key opens from every
screen and from focus mode. The caption band keeps the legend, the instrument line (the scale and
the vertical stretch; north was a 16 px needle there until 1.1, and is now the compass at the plate's
top left, as Norne 2.4's), the wells key and the cut's key.

**The signature is the cut**, on the player's track, as Norne's: each report date a column over its
own interval on a linear day axis, as tall as the liquid the field's wells lifted per day over that
interval, oil in the cut's ink from the baseline up and the water stacked on it in the same ink
thinned, with a 1 px `--ink-3` top. Volve's field lifts under a third of Norne's peak (10 779 Sm³/d in the
quarter to 5 Jan 2011, `node tools/test_decode.mjs`), so its scale is three times Norne's: **1.5 px per
1 000 Sm³/d** (0.25 px per 1 000 bbl/d in US units), the tick at the track's left end printing
`12 000 Sm³/d` over the tallest column, so its label never meets one (`shoot.mjs` measures it at 320 and
390 px wide, in both systems). Volve's report dates are a quarter apart after an 11-day first step, so its columns
are wide: the track reads as 36 steps, the plateau of 2009 and the water's crossing in the quarter to
9 Jul 2010 standing out without a word.

The plate is printed twice, as Norne's: the light theme a negative on white (more of a quantity
darker), the dark theme a print (more of it brighter), lit by the same shader.

## 1. Palette (`python3 volve/tools/art/palette.py`, from `Template/`, ends `ALL CHECKS PASS`)

Norne's tokens, scales, wells, casing, chart colors, labels and ghost key, unchanged, and checked
again for Volve; since 1.1, Norne 2.4's plasma and viridis for pressure and the rock, and its compass:

- **Chrome tokens**: the house's seven per theme; ink on page 17.35:1 (light) and 14.43:1 (dark);
  highest chroma 0.0239.
- **The cut**: `#12150b` light and `#eff5e7` dark, beyond `--ink`; oil on the page 18.46:1 and
  15.39:1; the water's tint 1.97:1 and 2.90:1, faint on purpose, its top line carrying the edge.
- **The plate**: white light, `#0c1316` dark. A salience-0 top face `#cbcec8` stands off white by
  ΔE 0.153 (1.59:1); the house ramps' "nothing" ends (the saturations' and the layers'), lit at the brightest face the shader reaches, by
  0.062 at the least (water); unshaded, the section's 1.5 px `--line-strong` rim (3.83:1) carries
  the pale cells' edge.
- **The scales**: oil, water, gas, pressure, rock, depth and layers, each monotone in lightness,
  ends apart by ΔE 0.475 or more in four visions. Norne's sand scale (net to gross) is not carried:
  Volve's deck has no net to gross.
- **Plasma and viridis (1.1, plan 0012 D16, the owner's exception to HOUSE 3.2's tonal budget).** The
  owner chose them on Volve itself (`docs/marketing/reference/0012-ramps-board.png`): plasma for
  pressure, viridis for the rock (porosity, both permeabilities) and depth, matplotlib 3.9.4's tables
  sampled at 33 stops (`palette.py`'s `MPL`), the same in both themes. The saturations, the layers, the
  regions, the wells' colors and the seismic's two ramps are exactly as 1.0 stored them (`check.mjs`
  pins their sha256). These scales run dark to light whatever the theme, so they are not printed twice
  and live outside the data band, and in the light theme "more" pressure or porosity is the lightest
  color. Measured instead (`palette.py`): the darkest ends on the dark plate stand off it by ΔE 0.211
  (plasma `#0d0887`, 1.25:1) and 0.173 (viridis `#440154`, 1.23:1) unshaded, 0.172 and 0.140 on a top
  face, 0.092 and 0.083 (1.04:1) on a face turned from both lamps: a low-pressure or tight cell's sides
  read as deep violet on the slate by hue, hardly by lightness. The light ends on white stand off it by
  ΔE 0.212 (`#f0f921`, 1.15:1) and 0.203 (`#fde725`, 1.26:1) unshaded and 1.70 and 1.86:1 on a top face:
  a strong yellow, told by hue and the cell edges, the legend's bar and the section keeping their
  `--line-strong` frame and rim. Over every stop of the two tables the labels stay at 12.38:1 (light)
  and 10.62:1 (dark), the wells' cores on their casing at 4.17 and 4.31, the ghost key at 3.76 and 4.43.
  Both tables are monotone in lightness and their ends apart by ΔE 0.626 or more in four visions.
- **The compass (1.1, plan 0012 D17)**: Norne 2.4's (its `ART.md`, section 3): the plate's top left, a
  36 px disc of `--plate` at 0.80, a two-tone needle (`--ink` north, `--ink-3` south) turning with the
  model and never under half its length, `N` upright at its tip, named `North arrow: north is toward …
  of the view.`; the card goes below it and the well names and their hits keep off it. Over every base,
  the seismic's stops not among them since the compass is on the 3D view: north arm and N 10.99:1
  light and 8.92:1 dark, south arm 3.55 and 3.64.
- **Regions**: the eleven fluid-in-place regions take Norne's four segment colors (`#e1ca74`,
  `#37a1b8`, `#bc5243`, `#5a478b`; worst pair ΔE 0.161, deutan), assigned so that none of the 21
  pairs of regions whose columns touch on the map shares one. The legend and the card name each
  region by its number, so a color two regions apart share never stands for both.
- **The seismic's two ramps**, 21 stops each over −1 to +1 of the clip, the 11th at zero:
  - *Gray* (the default): a straight lightness ramp, L 0.979 to 0.191 in the light theme (negative
    pale, positive dark: a negative print, as the plate is) and L 0.168 to 0.949 in the dark; zero
    at L 0.586 and 0.559; |L(t) − L(0)| equals |L(−t) − L(0)| within 0.0054.
  - *Red and blue*: zero a neutral near the ground (`#f7f7f7` light, `#242424` dark), lightness
    moving away from it alike on both sides (within 0.0031), positive red (hue 27) and negative blue
    (hue 258), + and − apart by ΔE 0.104 or more at half and full amplitude in four visions.
- **Wells and labels over the seismic**: the wells' cores on their casing stay at 4.17:1 or more over
  every base, the seismic's stops included; the labels' ink on its halo at 4.5:1 or more over all of
  them.
- **The rates chart**: oil, water and gas as Norne's; the field's reported rates in the same color
  dotted (1.25 px, `1 2.5`), injection dashed (`4 3`): the dash says injected, the dots say
  reported, never the color.

## 2. The section, with the seismic

The pane is Norne 2.3's (the edge, the sweep, Draw), with four line words: **Inline** and
**Crossline**, the survey's own lines, and **Along** and **Across**, the field's lines through the
grid; **Draw** beside them. Inline is the default, on the inline nearest the field's middle. Where the
pane is too narrow for four words they scroll sideways and fade at the right, as the property words
do, and Draw and Close stay whole.

**The layers, bottom to top:** the ground and its depth guides; the seismic; the gaps (hatched where
the plane passes between active cells inside the model); the cells; the Hugin top and base; the wells
within 150 m; the tapped cell's outline; the frame and its words.

**How cells and seismic share the plot.** Under More controls, *Section* offers **Seismic**,
**Model** and **Both** (the default). In Both the seismic lies under the cells and the cells cover it
by the share set in *Cells over it* (60 % by default, 0 to 100 %), with the cut's outline drawn in
full at any share, so the reflectors read through the model and the model's edge stays exact. The
default ramp is gray, so the cells' colors are the only hues in the plot; red and blue is offered for
the seismic alone. The seismic is never blended into the cells' colors and the cells are never
interpolated: each is the block it is (the cells' color at a block's middle is 60 % of its own over
the seismic's pixel there, measured by `tools/shoot.mjs`).

**Plasma and viridis over the seismic (1.1).** At the default 60 % over the gray ramp, pressure's
plasma reads as a muted rose to orange and the rock's viridis as teal through green to olive, in both
themes, with the reflectors still showing through and the horizons' dashes and the wells' names over
them (looked at on inline 10174, Pressure, Porosity and Permeability, light and dark). They read
duller than the legend's bar, which is drawn at full strength: the same is true of the saturations,
and *Cells over it* at 100 % shows the scale's own colors. Their dark ends over the seismic's dark
peaks are the closest pair in the plot; the cut's outline, drawn in full at any share, keeps each
block's edge.

**The seismic's drawing** at rest is an image at the plot's own device pixels (the screen's, two or
three a point), drawn 1:1, so nothing resamples it after `js/seismic.js`: bilinear across the survey,
a windowed sinc in depth widened to the rows' Nyquist where the rows outrun the samples, and the ramp.
It is kept while the line, the plot, the gain and the ramp stay, so a new report date redraws only the
cells over it. **While the view moves (1.1)**, an edge dragged, the sweep scrubbed or a line's end
moved, the plot is drawn from what it has: on the same line, the last full image laid on the new plot
by distance and depth; on a new line, the seismic's own samples (a column every 25 m along the line,
a row every 5 m), both scaled and smoothed by the canvas, D11's variable-density display. The cells
are drawn anew on a new line and laid on anew on the same one; the gaps' hatch and the cut's outline
wait for rest. About says so. With the finger up and nothing changed for 150 ms, everything is drawn
in full again, the seismic a few columns a frame, and the newest place always wins.

**One depth axis.** Depth in meters below mean sea level (feet in US units), the figures alone beside
the plot and **one title along it**: `Depth, m below mean sea level`, on two lines where the plot is
short; where even two outrun the plot, the title runs past the plot's ends along the pane's height,
and on the shortest pane it reads `m below` over `sea level`. The seismic is drawn at its own depths and the model at its own; nothing is shifted. With the
seismic shown, the plot shows 150 m above the shallowest cut cell and below the deepest, so the
reflectors around the reservoir are seen; with the model alone it pads the cut as Norne's does.

**The frame's words.** `A` and `A′` at the plot's top corners as Norne's, and beside each, in
`--ink-2` at 10.5 px, the inline and crossline of the trace nearest that end (`IL 10174, XL 2464`),
inside the plot after the letter or, where the plot is narrow, outside it in the pane's margin; on a
survey line where neither will fit, the one that changes along it, the other being the sweep's word;
failing that, `IL` over `XL`, in the margin or after the letter with the second line just inside the
plot on a halo. One end's words keep 10 px from the other's letter and words. Where none of these fits
(a pane on its side with the sheet raised, a short pane at 320 px), the numbers stand in a key to the
plot's right, `A` over `A′`, each led by its letter, and the plot moves left to make room. An end off
the cropped survey has no trace and so no numbers. Distance runs from A in meters, the unit on the
last tick, the ticks kept at one stride where some must give way; failing that, `0` at A and the last
tick, which may then be centered on its place or start at it.

**The horizons**: the Hugin Formation's top and base as interpreted, a 1.25 px `--ink` line dashed
`5 3` on a 3 px halo, named `Hugin top` and `Hugin base` in the plot itself (so the key under the pane
does not repeat them), broken where the interpretation has no pick. A name is set only by its own
line: it is set against the line's highest point across its width (or lowest, under it), its own
dashes within 20 px of it at every column and never through it, and the other horizon's 3 px or more
farther from it, so the other line never passes between a name and its own. It is also set only where it covers no cut cell, no well's path and no other word, and never
pushed sideways off its place by the plot's ends. Where no such place is left (a short plot, or the
two lines close together), the dashes stand unnamed, and About says what they are.

**The key under the pane**: the seismic's ramp as a 22 × 10 px swatch between its signed ends,
negative at the left and positive at the right (`−0.105` and `+0.105` at gain ×1, the clip; `−0.052`
and `+0.052` at ×2; where the row is too narrow for the wells key beside them, the left end keeps only
its sign), the gap's key where a gap shows, the wells key, and the stretch at the right
(`vertical ×3`). Positive is dark in gray on a light page, bright on a dark one, and red in red and
blue.

**The sheet's Section group**: the three show words, *Seismic gain* (×0.125 to ×8, in quarter
powers of two, its value printed `×1`), *Cells over it* (in Both only), and the ramp's two words.

**Zoom in the section, the axes' lock and the tall stop (1.2).** Norne Reservoir 2.5's (its `ART.md`
has the full account; the template's plan 0012, D18 to D20, the owner's words), with the seismic:

- **Zoom.** A pinch zooms about the fingers and carries the point under them; one finger moves the
  view once zoomed in and does nothing at the fit; a tap (8 px or less) still shows its cell at once;
  a double tap (380 ms, 30 px) zooms in two times where it lands; a wheel or a trackpad zooms about the
  pointer. Uniform, so the stretch the pane states is the one drawn. Out to the fit, in to where the
  field's thin cells read plainly: the 5th percentile of the active cells' thickness (0.42 m) drawn
  24 px tall, about 350 times the inline's compact fit at ×3 on a 390 px screen. There a trace spacing is some 475 px wide,
  so the seismic shows its blend between two traces, which is all the survey holds there. A move keeps
  48 px of the section in view.
- **The seismic zooms with the cells** on the one axis. While a finger moves, the last full drawing is
  laid on the newest view by distance and depth (the seismic's image, the cells, the gaps and the
  outline), with the seismic's own samples (a column every 25 m, a row every 5 m) and the cells over the
  whole view (the fit's, or locked, the field's window, and the view zoomed out four times about its
  middle, drawn at rest after a zoomed drawing) under it wherever the drawing did not reach, so a pinch
  out never leaves the plot empty; nothing is rendered in full. At rest (150 ms after the lift) the seismic is
  rendered as before, a few columns a frame at the screen's own pixels, for exactly the part of the line
  and the window the plot shows, and drawn 1:1. No new display.
- **Everything follows**: cells, edges, gaps, outline, horizons, wells and names, the tapped cell, A and
  A′ and their inline and crossline numbers where they lie (an end off the plot is left out, letter,
  rule and numbers), and the scales, which stand at the plot's edges zoomed or locked and are re-chosen
  for the depths and distances in view. Held, the numbers stand by the letters or not at all: the key
  beside the plot (the fit's last resort) would move the plot, which a held view never does.
- **The keys** in a strip at the plot's right, outside the data, as Norne's: `Lock the axes`
  (`aria-pressed`, its shackle open when unlocked) over `Zoom the section in`, and `Fit the section` and
  `Zoom the section out` only where they would change something, under them where the plot is 186 px
  tall or more, else beside them while zoomed. The plot's box ends 6 px before the strip, and the ends'
  numbers keep off it. Where the plot is under 89 px tall, or its box would be under 150 px wide (the
  52 px plot a raised sheet leaves on the smallest phones, the tall stop with the section, the narrow pane
  beside the model, a 320 px phone), the keys step aside: out of sight, still in the keyboard's order and to VoiceOver,
  shown over the plot while they hold the keyboard, and `Axes locked` in the key under the pane says
  when they are locked. Norne's rule exactly.
- **Locked**, the window opens on the whole field: every active cell's corners, 2 797 to 3 549 m below
  sea level, with 150 m of seismic above and below (2 647 to 3 699 m, inside the cube's 2 295 to
  4 050 m), whatever the section shows, so switching Seismic, Model and Both never moves it; and the
  full length of the line's family at one scale, at the 3D view's stretch, or where the pane's cap holds
  the plot under the window's need, the largest round stretch under it that fills the plot's width (×2
  on the inlines at 390 × 844 with the sheet closed), stated as the pane's own. The family's distance: the inlines (4 675 m) and the
  crosslines (3 575 m) are straight and parallel and all start at the survey's edge, so each lies at
  its own distance from it; Along's rows (4.60 km) and Across's columns (3.24 km) each from the end
  nearer the family's first end, at its own distance along the line from a baseline square to it, and
  keeping its own length along its path: 25 of Across's columns run against the line and are laid the
  other way, A′ to the left of A. The zero names that end by the compass (`West end` on the inlines and
  Along, `South end` on the crosslines, `North end` on Across); out of view, the unit's tick says
  where it is measured from (`from the west end`). A line of one's own keeps its own length, from A. Nothing moves the window but
  a hand: not a step, a family, a property, a date, the display or the pane's size.
- **The tall stop**: above Explode's and the scrolled stop, the sheet rises to the grip and all of
  Cells and view's rows (its five sliders, the two toggles and Show all cells, which since 1.2 shares the
  toggles' row); the section's display and the heading scroll away under the grip. The 3D view keeps
  104 px (its keys' row and 58 px of the model), 254 px with the section open (the strip and the pane at
  150).
  The grip's names: `Show more controls`, `Show all controls`, `Show Cells and view in full`, `Hide the
  extra controls`. No fourth stop where the sheet is a column at the side, or where it would gain under
  44 px. Measured (headless): all of Cells and view in view at each size, the sheet 311 px; the model
  281 to 282 px at 390 × 844, 369 to 370 at 430 × 932, 104 to 105 at 375 × 667; with the section open,
  the model 131 to 132 and the pane 150 at 390 × 844, 219 to 220 and 150 at 430 × 932.

## 3. Words

The run's period is read from the dates (`periods()` in `js/data.js`), never assumed: the card says
`Oil produced in the 90 days to 10 Apr 2008`, About `in the quarter to 5 Jan 2011`, the track's
value `… 8.8 years into the run`. The lead counts from the run's start, 31 Dec 2007 (`Start of the
run`), since no report date marks Volve's first oil. Page Up and Page Down move the track a year,
four report dates. A survey line's number is a name and is never grouped (`IL 10174`).

## 4. Type

The house face, one file (`fonts/ysabeau-office-gw.woff2`, the house's sha256), at the house's sizes:
the new words are 10.5 px (the ends' numbers, the axis title, the key's amplitude), 11.5 px (the
horizons' names, at 560) and 12.5 px (the line words); nothing new is bold.

## 5. The camera's strings (HOUSE 7.4)

Volve is not in Snuggery's bundled pack, and the marketing camera does not photograph it; it keeps
Norne's strings anyway, so a camera pointed at it would find them: `Oil saturation` (the legend's
title, written once every file is in, never in `index.html`), `Show the whole field`, `Pressure` and
`Oil` as `role="radio"` property words, `Play production history` and `Pause` (nothing else named
Pause), `Show the controls` (the ghost key of a remembered focus mode, under `volve-viewer:v1:focus`),
and the grip's three names. New names, none of which a camera reads: `Inline`, `Crossline`,
`Previous inline` and `Next inline` (`crossline` likewise), `Seismic`, `Model`, `Both`,
`Seismic gain`, `Cells over it`, `Gray`, `Red and blue`, `Back one report date` and `Forward one
report date`; since 1.2, `Fit the section`, `Fit the field’s depth and length`, `Zoom the section
in`, `Zoom the section out`, `Lock the axes` and the grip's `Show Cells and view in full`.

## 6. Budgets

`node tools/check.mjs` prints the truth. The template's caps for Volve: 322 500 B of app code and
33 600 000 B of ZIP. App code 311 642 B (`app.js` 175 365, `style.css`
38 244, `js/section.js` 35 780, `index.html` 21 597, `js/seismic.js` 12 485, `js/track.js` 8 149,
`js/units.js` 7 778, `js/data.js` 7 032, `js/pane.js` 5 212): Norne 2.3's 255 443 B and more for the
seismic, the survey's lines, the horizons, the display controls, the sub-pixel cells' drawing, the
frame's words and About's seismic and terms. **1.1** (plan 0012 D16 and D17): app code
311 984 B (`app.js` 175 321, `style.css` 38 639, `index.html` 21 588, the modules unchanged), 342 B more
than 1.0 for the compass, its keep-outs and the needle's removal from the instrument line, with three
comments shortened and one dropped that was Norne's history, not Volve's (a retired `:hint` key Volve
never wrote); 16 B were left under the cap. The colors are `config.json`'s, not code. **The section's
speed, the same 1.1:** app code 321 958 B (`app.js` 183 615, `js/section.js` 36 774, `js/seismic.js`
13 044, `js/pane.js` 5 339, the rest as before), 9 974 B more for the drawing while the view moves, the
render in slices, the exact cheaper fit and cut, and About's sentence; within the 322 500 B cap the lead ruled for 1.1, nothing cut. Fonts 40 075 B of 160 000. The ZIP is about 33.4 MB, of which
the data, which the pipeline owns, is 33 234 794 B deflated (64.5 MB unpacked, 29 files).

**As built, 1.2** (`node tools/check.mjs`; plan 0012 D18 to D20, with the review's fixes): app code 369 523 B
(`app.js` 212 396, `js/section.js` 46 467, `style.css` 41 890, `index.html` 23 537, `js/seismic.js` 13 044,
`js/track.js` 8 149, `js/units.js` 7 778, `js/data.js` 7 032, `js/pane.js` 5 339, `js/gesture.js` 3 891),
47 565 B more than 1.1
for the zoom, the lock and the tall stop, over the 322 500 B the template ruled for 1.1: nothing was cut, and
the cap is the template's to rule on. The ZIP is about 33 420 700 B (its last bytes move with these notes), within its 33 600 000.

## 7. The generated-page tells, answered

As Norne's (its `ART.md`, section 7): no accent in the chrome, no shadows, no glass, no gradient
but the data's scales and the selection tracer, sentence case, no middle dots, no arrows on buttons,
no monospace, no numbered markers but the deck's own names (the regions `1` to `11`, the layers, the
inline and crossline numbers, which are the survey's). The seismic adds a ramp, which is data, and
a dashed line for the horizons, which is an interpretation and is drawn as one.

---

The record of the build, the owner calls, the measurements and what is left for a phone are in
`tools/DECISIONS.md`, which the ZIP leaves out.
