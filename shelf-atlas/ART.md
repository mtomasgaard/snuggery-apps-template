# Shelf Atlas: art direction

`NOTES.md` says what the app shows and where every number comes from; `RESEARCH.md` and
`HANDOFF.md` say how the data is built. This file says how the app looks, moves and speaks under the
template's house system (`Template/HOUSE.md`, the brief this pass follows; Global Weather is the
reference, and Milky Way, Besseggen, Norne Reservoir and Anatomy are the passes before this one).
Every figure names the command that printed it. The scripts are in `tools/`, which the ZIP leaves
out. The pass's record (the change list, the owner calls, the as-built departures, the phone checks)
is in `tools/DECISIONS.md`, because this file ships.

Commands run from `Template/shelf-atlas/` unless they say `Template/`. Load and frame times are
headless Chromium on the build Mac: a trend, never phone evidence. The throwaway scripts named below
live in `tools/.work/`, which git ignores (`.gitignore`).

---

## The look: the house, with one bold thing of its own

Shelf Atlas is HOUSE 4.0's *map with time*, the first after the reference pair. It takes the house
chrome whole: one face, gray chrome, the row of words, the key column, the caption band, the player
and the app's own track, the readout card, About, focus mode, SI and the no-tells rules. What is its
own is the plate, printed twice, and one signature.

- **The plate is printed twice.** The light theme is the negative (a pale sea, a big producer a dark
  red-brown disc), the dark theme the print (a dark sea, a big producer a bright coral disc). In both,
  more stands further from the sea.
- **One bold thing: the Peaks** (section 1), on the plate, around the circles. Everything else is
  quiet.
- **Honesty is already the app's habit.** The stock app says where each regulator's series starts,
  that Danish outlines are legal delineations, that the newest month is uneven, and refuses to count
  a cross-border field twice. The pass keeps every word of that, moves it where the picture is read,
  and fixes the places where the screen says less than the data (B1 to B14, listed in `tools/DECISIONS.md`).

**How it differs from the apps before it** (it copies none of them):

| | Its signature | Where | What it encodes | Shape |
| --- | --- | --- | --- | --- |
| Global Weather, Global Wind | the streak field | the plate | the wind's path at a printed exposure | streaks |
| Earth's History | the time control as a stratigraphic column | the track | period colors | a banded bar |
| US Quakes | the record strip | the reading | magnitude by stem height | stems |
| Warming World | the stripes as an instrument | the scrubber | anomaly by color | stripes |
| Milky Way | the Reach | a ruler in the header | presence along a log distance | a bar with gaps |
| Besseggen | the Burn | the track | one day's sun at one point | an arch with bites |
| Norne Reservoir | the Cut | the track | one field's liquid, oil and water | a two-tone skyline |
| Anatomy | the Levels | the plate's edge | the spine's levels at their height | a column of blocks |
| **Shelf Atlas** | **the Peaks** | **the plate, around every field** | **each field's best month so far, at the circles' own scale** | **one ink ring per field, a disc inside it** |

The streaks and the Peaks both live on a plate, but the streaks are a field the forecast moves and
the Peaks are one mark per object, standing still while the month changes under them. No other app
in the template has a production series per field: World Oil & Gas carries one figure per field and
annual national totals, Norne Reservoir one field's simulated history.

---

## 1. The signature: the Peaks

**What it is, in one paragraph a stranger would get.** Every producing field on the map is a disc
whose area is what it produced that month. Around each disc is a thin ink ring drawn at the same
scale for the field's best month so far: the most it ever produced in one month, up to the month on
the player. A field still rising fills its ring; a field past its best sits small inside it; a field
that has stopped leaves its ring empty. Play the North Sea from 1971 and the rings grow outward with
the discs through the 1980s and 1990s, then stay where they are while the discs shrink inside them:
by 2026 the northern North Sea is a field of empty and near-empty rings, each the size of a giant
that was, with a few full ones (Johan Sverdrup) among them. Nothing about a ring is invented: it is
the regulator's own monthly figure, the largest one so far.

**What a stranger remembers is the emptiness.** Measured from `data/snapshot.json` with its own decode
(`python3 tools/.work/peaks.py`, output in `tools/.work/peaks.out`), in liquids, the quantity the app
opens on:

- **Jun 2026**, the month the app opens on (the newest month all four regulators have reported):
  205 rings; 70 empty and 72 more holding a disc under a tenth of their area, **142 of 205** in all.
- **Jun 2000**: 129 rings, 20 of them empty or under a tenth. **Jun 1985**: 33 rings, 1.
- The giants: Statfjord's best month was 134 273 Sm³/d in Nov 1986 and it lifted 985 Sm³/d in Jun 2026
  (0.7 % of its best); Brent 82 249 in Feb 1984, now nothing; Forties 88 610 in Dec 1978, now 2.0 %;
  Ekofisk 55 465 in Oct 1976, now 12.3 %; Troll's liquids 69 930 in Feb 2003, now 8.6 %; Johan
  Sverdrup 122 786 in Jun 2023, now 82.4 %.

In oil equivalent the same month holds 179 rings, 111 of them empty or under a tenth; in gas, 73 and
43. Statfjord's second-best month, 134 174 Sm³/d, is the top of the liquids scale (app.js takes each
unit's second-highest month so one mis-keyed month cannot squash the scale), so Statfjord's ring is
the largest on the map, 34 px across.

**How it was found** (HOUSE 5.1):

1. *What does a specialist call the picture of this data?* A petroleum engineer reads a field by its
   production profile: the build-up, the plateau, the decline. The first question asked of any field
   is where it stands against its own peak. The ring is that question asked of every field at once,
   in the map's own symbol: a proportional circle and its high-water mark.
2. *What does a person do most here?* Play the 55 years and scrub them, watching the map. The Peaks
   need no tap and no reading of a chart: they make the month on the player legible as a stage in
   each field's life, which is what the scrub is for.
3. *What does this data have that no other app has?* A monthly series for every field of a whole
   basin, since 1971. Moved to World Oil & Gas the Peaks would have nothing to draw (one figure per
   field); moved to Norne they would be one ring. Candidates tried and set aside, each measured:
   - *The basin's production profile on the track* (the stacked liquids of the four countries): the
     track is 210 px for 668 months at 390 px, 0.31 px a month, and a skyline on the track is Norne's
     Cut, the signature of the pass before last.
   - *A layer cake of fields by decade of first production* (the "vintage" chart): the Dutch series
     starts in Jan 2003, so Groningen and every older Dutch field would be filed under the 2000s
     (the snapshot's own `ask` row for Groningen: discovered 1959, first production 2003); it would
     show the data's edge as history.
   - *The tapped field's slice cut out of the basin's profile*: at the track's scale a giant is 2 %
     of the basin, under half a pixel.
   - *Every field's ring, however small*: a prototype drawn over the stock map
     (`PLAYWRIGHT_MODULE=… node tools/.work/rings.mjs`, rings computed in Node from the snapshot)
     put 947 rings on screen at the opening view in oil equivalent at Jun 2026, a froth of 1.6 px
     circles over the southern gas basin (`tools/.work/look/light-rings-2026-06.png`). Hence the
     floor in the drawing rules below: 161 on screen with it (`MIN=3`,
     `tools/.work/look/light-rings-2026-06-min3.png`; the new palette under them in
     `tools/.work/look/*-pal-*.png`, from `tools/.work/preview.mjs`).
4. *Can it be drawn with the house's means?* One 1 px ink at the far end of the tonal budget, the
   circles' own area scale, no motion of its own.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears.* A ring is the largest of the unit's monthly rates in the
   shown quantity from its first month to the month shown, nothing else. With no snapshot there are
   no circles and no rings; a month a country has not reported draws neither for its fields.
2. *Every property that varies is measured.* The radius is `circleR(best)`, the function that sizes
   the disc (`17 px × √(best / top)`, the top printed as the legend's open end `≥ 134 000 Sm³/d`),
   so a ring and its disc are on one scale and a ring's area is a rate. Width (1 px) and color are
   constants. The scale never fits itself to what is on screen.
3. *It is captioned.* The caption line says how to read it, with its number: `Circles: the month's
   rate. Rings: each field's best month so far, drawn from a best of 4 180 Sm³/d.` (section 3).
4. *It reads.* The ring is `#0c131b` on the light plate and `#edf3fa` on the dark. Over every color
   it can be drawn on (every ground, every circle color at its alpha over every depth, every tint,
   line and mark of the plate) the worst is 3.10:1 (light, over a gas pipeline on land) and 3.09:1
   (dark, over an oil pipeline on land); over the circles 3.96 and 4.07; over the sea 11.89 to 15.71
   and 13.64 to 17.28 (`python3 shelf-atlas/tools/art/palette.py` from `Template/`, ended `ALL
   CHECKS PASS`). On rendered pixels, `tools/shoot.mjs` compares every drawn ring with the same
   pixels drawn with the rings off: at Jun 2026, 2 952 samples, 100 % at 3:1 or more, the lowest 3.26
   (light) and 3.52 (dark); at Jun 1985, 528 samples, the lowest 3.46 and 3.68 (headless Chromium).
5. *It survives Reduce Motion.* It has no motion of its own; it moves only with the month.
6. *About says what it shows and what it does not* (section 3, About): a ring is the best month in
   the regulator's series, so a field whose series starts late (Dutch fields before Jan 2003, UK
   fields before Jun 1975) may have had a better month that the ring cannot show; Danish figures
   before Jan 2018 are each year's total spread evenly, so a Danish ring before then is a year's
   average; one UK field (Tern) reports two months of gas in 2000 far above the rest of its life, and
   its gas ring keeps them as reported; fields that never reached 3.1 % of the scale's top have no
   ring; a ring says nothing about what is left in the ground.
7. *It is the only bold element.* The rest passes section 7. The pipelines, the plate's other strong
   lines, are held under it: 0.7, 0.95 and 1.25 px by diameter where they appear, growing at most
   × 1.15 as you zoom (1.44 px at the widest; `PIPE_W` and `grow` in `app.js`), in colors at 3.0 to
   4.4:1 on the sea at worst, against the ring's 1 px at 11.9:1 and more on the sea (`palette.py`).

**Drawn exactly so** (in `app.js`; the records in `js/data.js`):

- **Which units.** Every unit (a field, or a cross-border unit as one) with any production in the
  shown quantity up to the month shown, among the countries shown, whose best month so far gives a
  radius of 3 px or more: `best ≥ top × (3 / 17)²`, 3.11 % of the scale's top (4 178 Sm³/d of
  liquids, 7.62 million Sm³/d of gas, 7 628 Sm³ o.e./d in this data). Not in Cumulative mode.
- **Reporting gaps.** A unit is drawn for month M, disc and ring, only when every shown member's
  country has reported M (`ccLast` and `ccFirst` in `app.js` today). A cross-border unit whose UK side
  has not reported M is not drawn half; the caption says which country is missing (section 3).
- **The value.** For each unit and quantity, the months where the running maximum of its rate rises,
  with their values, built the first time a quantity and a set of countries is shown and kept until
  the data is read again, so switching back costs nothing (a
  cross-border unit's members are summed only over the countries shown, as its disc is). The month
  shown finds its record by binary search: about 1 000 lookups a frame, no allocation.
- **The mark.** A full circle of radius `circleR(best)` around the unit's circle center, stroked 1 CSS
  px in `--ring` (light `#0c131b`, dark `#edf3fa`) at alpha 1, `source-over`, round joins, no glow,
  no halo. Drawn after the discs and their rims, before the platforms, the labels and the selection.
  A unit at its best month draws its ring on its disc's edge, so a field at its peak reads as a disc
  with an ink edge.
- **The disc inside it.** A disc is never drawn under 1.6 px radius (3.2 px across), so that a small
  producer stays in sight and in reach, except inside a ring: there it is drawn at its true radius,
  however small, and without a rim, so the share of the ring it fills is the month over the best. At
  Jun 2026, 76 of the 135 producing rings hold a disc under that floor; `shoot.mjs` checks every one
  against its own decode. About and `NOTES.md` say so in words.
- **Hits.** A tap reaches every unit within `max(disc, ring) + 3 px`, at least 9 px, of its center;
  of those, the one with the smallest distance over its radius (taken as at least 4.5 px) wins. So a
  tap at a ring's center opens that field, an empty ring (Brent) included, and a tap on a small disc
  opens the disc. `shoot.mjs` taps Statfjord, Brent, Oseberg and Ekofisk at their centers and
  Barnacle's 1.6 px disc beside Statfjord, by touch at the opening view, in both themes. Labels are
  placed below `max(disc, ring)`.
- **The card agrees.** The card's `Best month so far` row reads the same record (section 3), so the
  ring and the card cannot disagree.
- **The key.** The key column's toggle `Show each field's best month` (`aria-pressed`, remembered in
  `sa.layers` as `peaks`, on by default). In Cumulative mode it is `aria-disabled` and drawn at 45 %,
  described by `Rings show with Rate.`
- **Cost.** Records: one pass over every unit's series per quantity and set of countries, the first
  time it is shown (668 months x about 980 units): 42 to 45 ms from a tap on `Gas` to the frame the
  first time, 9 to 11 ms after (headless Chromium, `tools/.work/review/perf.mjs` run twice over). Drawing: one stroke per ring, about 200 at the opening view.

---

## 2. Palette

`tools/art/palette.py` (written in this pass; run from `Template/`, standard library only) holds
every value below and ended `ALL CHECKS PASS` with exit 0 (`python3
shelf-atlas/tools/art/palette.py`; the run is kept in `tools/.work/palette.out`). `--json` prints
what `app.js`'s `THEMES` takes per theme: the 17 evenly spaced ramp stops `buildPalette()` already
interpolates, the depth stops keyed by the raster's gray value as `bathyCanvas()` reads them, and
every plate color with its alpha. The builder pastes the output; `tools/check.mjs` fails while
`THEMES` and `--json` differ.

### The chrome tokens

The house tokens of HOUSE 3.1, copied exactly, in both themes. Measured by the same run:

| Pair (WCAG 2) | Light | Dark |
| --- | --: | --: |
| `--ink` / `--ink-2` / `--ink-3` on `--page` | 14.80 / 6.61 / 4.78 | 14.43 / 7.76 / 5.88 |
| `--ink` / `--ink-2` / `--ink-3` on `--sheet` | 16.40 / 7.32 / 5.29 | 12.87 / 6.92 / 5.25 |
| `--line-strong` on `--page` | 3.27 | 3.56 |

Highest chroma of any chrome token: 0.0239. The stock `--bg`, `--card`, `--ink-dim`, `--ink-faint`,
`--accent` (`#2f6df6` / `#5b8eff`), `--accent-ink`, `--chip`, the three `--warn-*` tokens, `--shadow`,
`--radius` (14 px on everything), `--glass` and the `--k-*` swatch tokens go, with every
`backdrop-filter` (four rules, each with its `-webkit-` twin), `box-shadow` (eight), `letter-spacing`
(six) and `text-transform` (one) (`grep -c` over `style.css`).

### The tonal budget

| | Light (the negative) | Dark (the print) |
| --- | --- | --- |
| Ground | the sea, shaded by depth: `#e4edf0` (L 0.940) in the shallows to `#bed1df` (L 0.851) at 3 000 m; land `#eff1ef` (L 0.956); beyond the data's box `#dbdee0` (L 0.900), edged by a 1 px `--line` | the sea `#1d272c` (L 0.265) to `#070f15` (L 0.163); land `#292f32` (L 0.301); beyond the box `#0c1012` (L 0.168), edged by `--line` |
| Data band | L 0.50 to 0.96: the circles 0.52 to 0.88, the plate's lines and marks 0.506 to 0.721 | L 0.15 to 0.64: the circles 0.36 to 0.639, the lines and marks 0.420 to 0.626 |
| Signature | `--ring` `#0c131b`, OKLCh (0.184, 0.0197, 252), alpha 1 | `#edf3fa`, OKLCh (0.962, 0.0114, 252), alpha 1 |
| Worst measured | 3.10 over a gas pipeline on land; 3.96 over the circles | 3.09 over an oil pipeline on land; 4.07 over the circles |

The ring is a near-neutral (chroma under the house's 0.021), at hue 252, the sea's own, as chart ink
is; not `--ink` and not a hue of any data scale. Its distance to the template's other signature
inks (OKLab dE, the same run): light 0.015 to Global Weather's streak, 0.036 to Norne's Cut; dark
0.022 and 0.028. Near-neutrals at the far end of a range are close in color by construction; the
Peaks are a different mark in a different place.

The sea's depth shading is ground, not a data scale: deeper is darker in both themes, as a chart
prints it. It was compressed (light L 0.940 to 0.851, where the stock ran to `#7ea2c7`) so that every
line on the plate holds 3:1 on the deepest water while staying inside the band the rings need.

### The plate

| Value | Light | Dark | Notes |
| --- | --- | --- | --- |
| sea, by the raster's gray value (1, 40, 80, 150, 255: 0.1, 74, 295, 1 038, 3 000 m) | `#e4edf0` `#dce7ed` `#d2e1e9` `#c7d8e3` `#bed1df` | `#1d272c` `#182228` `#121d23` `#0c161d` `#070f15` | the 200 m polygons' fallback is the 74 m stop |
| land | `#eff1ef` | `#292f32` | the stock light land `#f7f5f0` was cream |
| beyond the data's box | `#dbdee0` | `#0c1012` | a neutral that is neither the page, the sea nor the land, so the plate never melts into the chrome (on its side, half the plate lies west of 6° W); the box's own edge is a 1 px `--line` (`#c9d4d8` / `#2a373c`), so a straight cut such as Britain at 6° W reads as the data's limit |
| coast, 0.8 px | `#5a696f` (3.63 worst) | `#758388` (3.46) | contrast on every ground |
| maritime boundaries, 1.2 px, dashed 5 on 4 | `#626a6f` (3.51) | `#727c81` (3.18) | |
| field outline (no production that month), 0.8 px | `#636c71` (3.42) | `#707b81` (3.13) | Danish delineations dashed 4 on 3, unfilled, as today |
| producing tint inside an outline | the ramp's middle `#e87e42` at 0.22 | `#9e4501` at 0.26 | status only, never the rate |
| shut down fill | `#a0a6a9` at 0.60 | `#484e52` at 0.70 | the stock key's word for it, in British spelling, goes with the key |
| circle rim (`Circle edges`), 1 px | `--sheet` at 0.90 | `--page` at 0.90 | separates overlapping discs |
| platforms, fixed (square) and floating (triangle) | `#5c676c` (3.70) | `#7e8a90` (3.83) | the stock near-black `#14181f` sat at the ring's tone |
| subsea structures (dot) | `#6d767b` | `#6d767b` | |
| pipelines: oil, gas | `#277a40`, `#8c4896` (3.39, 3.84) | `#4a9a5e`, `#ad67b8` (4.41, 3.92) | alpha 1 (the stock 0.75 fell under 3:1 on deep water); 0.7, 0.95 and 1.25 px by diameter (under 14 in, under 26 in, 26 in and more), at most × 1.15 zoomed in, so never bolder than a ring |
| pipelines: other or unknown | `#676b6d`, **dotted** (3.43) | `#6b6f71`, dotted (3.00) | form carries it, not a hue (below) |
| field names | `--ink` 11.5/560 on a 3 px `--sheet` halo at 0.88 (16.08) | the same (13.00) | |
| the selection | `--ink`, 1.5 px over a 3.5 px `--sheet` halo at 0.90 | the same | the stock accent blue goes |

### The circles: production, printed twice

One hue path, amber at the small end through orange to a red-brown, warm against the cool sea and
never a hue of the pipelines (ramp hues 75, 48, 30; pipelines 150 and 322). Salience runs along the
legend's log axis (3.5 decades below the top, `DOMAIN_DECADES` in `app.js`, unchanged); the light
theme prints it as darkness from L 0.88 to 0.52, the dark theme as light from L 0.36 to 0.64.
Stops at s = 0, 0.25, 0.5, 0.75, 1: light `#f5d1a0` `#efa96a` `#e87e42` `#ce5b36` `#ab4235`; dark
`#543601` `#754102` `#9e4501` `#c04f29` `#d36757`. The discs keep their alpha, 0.82.

Checks (the same run): the ends separate by dE 0.374 (light) and 0.297 (dark) under normal vision and
at least 0.354 and 0.236 under the three simulations; every eighth of the legend, seen over the sea,
steps by at least 0.038 and 0.031; the small end stands 0.081 and 0.122 from the sea; 17 stops
interpolated in sRGB as `buildPalette()` does stay within dE 0.0041 of the OKLab path. The dark
ramp has 55 chroma-limited samples of 97, all on its dark half, where sRGB has little orange.

**What was given up, said plainly.** The stock light ramp ran to `#6e2408` (L 0.33), where no ink
ring could read on it; its top is now `#ab4235` (L 0.52), so the biggest producer is a lighter
red-brown than before. The dark ramp's top is a coral (`#d36757`) rather than the stock pale peach
`#ffdcbd`, which sat where the pale ring must be. The stock saturated pipeline green `#008300` and
violet `#4a3aa7` were refit to the band, gas moving to a magenta-violet (hue 322) because a violet
and a gray cannot be told apart under tritan vision.

### Categories

The pipelines' oil and gas pair separates by dE 0.131 (light) and 0.132 (dark) at worst, under
deutan vision; the history chart's liquids and gas lines by 0.133 and 0.132 (gate 0.10). The third
pipeline class, *other or unknown*, is a near-neutral drawn dotted (round caps, a dot every 2.5 px):
its colors stand only 0.059 and 0.101 from the oil green under deutan, so the dots, not the color,
carry it, and the run prints those distances without gating them.

### The ghost key

HOUSE 3.1's fixed colors, over every color of this plate: the stroke holds 4.83:1 (light) and
4.51:1 (dark) against its own halo at rest.

### CSS custom properties this app adds

`--ring` (`#0c131b` / `#edf3fa`), `--chart-liq` (`#2f8247` / `#63b376`) and `--chart-gas`
(`#934f9e` / `#c77fd2`) for the history chart and its key; `--sea` (`#dce7ed` / `#182228`) for the
legend bar's ground and the plate before the first draw. Everything else on the plate is drawn from
`THEMES`.

---

## 3. The chrome, object by object

The frame at 390 x 844 (CSS px, safe areas outside):

```
+------------------------------------------+
| Shelf Atlas                 [Find] [Sm³/d]| 22  name 15/650; two word keys
| Updated 26 Sep, 10:56, figures to Jun 2026| 16  the stamp, 11.5 --ink-2, opens About
| Liquids  Gas  Oil equivalent | Rate  Cum… | 44  quantity words | mode words, tracer under each
+------------------------------------------+
| [card]                              [+]  |
|                                     [-]  |     the plate: sea by depth, land, outlines,
|                                     [#]  |     circles and their rings, names on halos;
|                                     ---  |     keys: Zoom in, Zoom out, Whole North Sea /
|                                     [o]  |     Show each field's best month, Map layers /
|                                     [=]  |     Hide the controls
|                                     ---  |
|                                     [H]  |
+------------------------------------------+
| Liquids a day   |=================|      | 30  the legend: title, log bar, open ends
|                 ≤ 42  100  1 000 … ≥ 134 000 Sm³/d
| Circles: the month's rate. Rings: each   | 30  the caption line, two lines, fixed
| field's best month so far, drawn from a… |
| Natural Earth · Marine Regions CC BY · …  | 30  the credit line, whole, two lines
+------------------------------------------+
| Jun 2026            408 000 Sm³/d, 426 fields | 28  the time row
|  <  [>]  >   --'----'----'----'----*     | 58  the transport; the track
|              1980 1990 2000 2010 2020    |
+------------------------------------------+
```

The page is a one-column grid: header, plate, caption band, the sheet (closed by default), player;
`100dvh`, `overscroll-behavior: none`; the plate's row `minmax(220px, 1fr)`. As built, 560 px of plate
at 390 x 844 (the stock 621, which the overlaid legend and credits covered) and 650 px in focus mode;
`shoot.mjs` holds it at 540 px or more, at 645 or more in focus mode, and at 220 or more at 844 x 390
(233 measured, with or without a sheet open).

| Object | Here | Notes |
| --- | --- | --- |
| **Header: name** | `h1` `Shelf Atlas`, 15/650, line 22 px, `translate="no"` | `miniapp.json`'s name, the Library row the camera opens. The stock 19/700 title with negative tracking goes. |
| **Header: stamp** | a `<button>` opening About, `aria-haspopup="dialog"`, described *Opens About this data.* (`aria-describedby`), 11.5 px `--ink-2`, a 44 px hit: `Updated 26 Sep, 10:56, figures to Jun 2026`; `Updated 10:56, …` when today | The figures' month is the newest month every shown country has reported (`model.defaultMonth` over the countries shown), so the stamp never claims Aug 2026 when only Denmark has filed it, as the stock `Data to Aug 2026` did. The stock `aria-label="About this data"` goes: it hid the date from VoiceOver (B9). Stale after 10 days (`STALE_DAYS`, the weekly build; stated in `NOTES.md`): `Stale. Updated 26 Sep, 10:56, …`, the first sentence in `--ink`, never the stock red. Loading: `Reading the data… 1 of 2`, a real ellipsis. A map with no production yet: `Map only. Updated …`. Dates by hand in `js/units.js`, local time. |
| **Header: Find** | a word key, `Find`, named `Find a field`, `aria-haspopup="dialog"` | Anatomy's word key form: 600 at 12.5 px in a 1 px `--line-strong` frame, 28 px tall, 6 px radius, a 44 x 44 hit. It replaces the stock magnifier, since icons live only in the key column and the transport. |
| **Header: units key** | at the right: the unit of what the circles show, `Sm³/d`, `Sm³`, `Sm³ o.e./d`; one press `bbl/d`, `scf/d`, `boe/d` (or the volumes) | The house key (HOUSE 4.2): 600 at 12.5 px, `--line-strong` frame, 28 px, 6 px radius, 44 x 44, `translate="no"`, named `Change units, now Sm³/d` (the visible unit inside its name, WCAG 2.5.3, as HOUSE 4.2 writes it). SI first, the field units one tap away, both systems already in `UNITS`; remembered in `sa.units` (`si` or `field`, the stored values unchanged). |
| **Row of words** | `Liquids`, `Gas`, `Oil equivalent` (`role="radio"` in a `role="radiogroup"` named `Quantity`), a 1 px `--line` divider 14 px tall, then `Rate`, `Cumulative` (`role="radio"` in a group named `Circles show`) | Words in full: the stock `O.E.` (named `Oil equivalent` only for VoiceOver) is written out. The tracer under the chosen word of each group (HOUSE 4.3); unchosen words 400 `--ink-2`. **`Rate` and `Cumulative` keep their exact visible text, role and no `aria-label`**, because the camera finds them by label (section 5). 44 px hits, 16 px apart; the row scrolls inside itself at 320 px. One tab stop per group; arrow keys move the choice. The stock pills, their shadow and the second row go. |
| **Key column** | `--sheet` plates on the plate's right edge, inset 8 px: `Zoom in`, `Zoom out`, `Whole North Sea` / `Show each field's best month`, `Map layers` / `Hide the controls` | 44 x 44 hits drawn 36 x 44; 16 px marks, 1.5 px strokes, `--ink-2` at rest, `--ink` with the 28 x 28 on-plate when on (HOUSE 4.4). Marks: Zoom in and out, the house's; `Whole North Sea` (the stock name kept), four corner brackets framing a short zigzag of coast, not the house's circle and not a house (the stock icon was a house); `Show each field's best month`, two field marks side by side, a 10 px ring around a 3 px disc and a 5 px disc filling its 5 px ring, so it cannot be read as a radio button or a record key; `Map layers` (`aria-expanded`, `aria-controls` the sheet), three 10 px lines stacked, solid, dashed and dotted, the map's own line kinds, not the stock two-rhombus layers glyph. Where six keys do not fit (a phone on its side, a sheet open), a row along the plate's top. |
| **Caption band: legend** | 30 px: the title `Liquids a day`, `Gas a day`, `Oil equivalent a day` (Rate) or `Liquids to date`, … (Cumulative), 600 at 11.5 px `--ink`; the 6 px bar in the rest of the width; ticks at decades | Painted from the same 17 stops at the discs' alpha over `--sea`; a 1 px `--line-strong` frame at 60 %, square ends. Ticks 1 x 3 px at their true positions, labels 10.5 px through `units.js`, measured apart (the stock guessed 3.4 px a character); the open ends printed open, `≤ 42` and `≥ 134 000`, the unit after the last label. The stock glass button, its `▸ ▾` (characters the face does not draw) and its expanding map key go; the key's samples move to the Layers sheet. |
| **Caption band: caption line** | 11 px `--ink-2`, a fixed two lines below 640 px and one from 640 px | Rate: `Circles: the month's rate. Rings: each field's best month so far, drawn from a best of 4 180 Sm³/d.` (the floor is on a field's best month, never on the month's rate; through `units.js` in the shown quantity and units). Cumulative: `Circles: what each field has produced to date; gray ones have shut down. Rings show with Rate.` A reporting note leads when it applies, and the reading shortens: `No UK figures for Jul 2026 yet. Circles: the month's rate; rings: best month so far.`; `No NO, UK or NL figures for Aug 2026 yet.`; one country whose series has not started, `Dutch figures start in Jan 2003.`; several, `No Danish, UK or Dutch figures yet.` (their months listed in full overflowed two lines at 320 px); `No country is shown; turn one on in Map layers.` With no production figures: `No production figures to show; the notice above says why.` `shoot.mjs` measures every form at 320, 360 and 390 px in both unit systems. |
| **Caption band: credits** | the credit line as the stock builds it from `snapshot.sources` (`[...new Set(allSources().map(shortSource))].join(' · ')`), 10.5 px `--ink-2`, **whole**, wrapping to two lines | Today `Natural Earth · Marine Regions CC BY · EMODnet CC BY · Sodir NLOD · NSTA · Danish Energy Agency · NLOG`. Its words and its middle dots stay (the house's credit-line exception). The stock button that cut it to `… Sodir NLOD · …` on a phone held upright goes (B3): it is a `<p>`, on screen in every mode. The full statements stay in About. |
| **Player: time row** | the one large figure `Jun 2026` (600 at 21 px); the lead at the right, 12.5 px `--ink-2`: `408 000 Sm³/d, 426 fields`; Cumulative `10.8 billion Sm³, 949 fields`; filtered `NO, DK: 331 000 Sm³/d, 107 fields` (Jun 2026: `shoot.mjs` checks the first against its own sum; the other two printed by `PLAYWRIGHT_MODULE=… node tools/.work/review/lead.mjs`) | Months by hand (`Mar 1987`, HOUSE 4.6), the same on every locale; VoiceOver hears `June 2026`. The lead counts the shown units with a value and sums them, through `units.js`: three significant figures, U+202F groups below a million, words from a million (`1.02 million Sm³/d`). Never transitions. The stock `aria-live` on the month goes: it spoke every month of play (B6). |
| **Player: transport** | `Back one year`, `Play` / `Pause`, `Forward one year`, 44 x 44 | The camera's `Back one year` and `Play` kept exactly (section 5). The year keys are the house's chevrons, 1.5 px strokes 10 px tall, `--ink-2`; their names say the year, and they say the new month in the live region. Play is the one solid control: a 32 x 32 `--ink` square, 8 px radius, a `--page` triangle; while playing two 2.5 px bars, toggled by attribute so the mark matches its name (HOUSE 4.6). The stock `−1y`, `+1y` text, the blue disc and the `1×` speed key go (owner call 3). With no production figures (no snapshot, or one that cannot be read) the three keys and the Peaks key are `aria-disabled`, drawn at 40 % (the Peaks key at 45 %), and do nothing. |
| **Player: the track** | `js/track.js` on Global Weather's pattern: `id="slider"`, `role="slider"`, 668 steps (Jan 1971 to Aug 2026), `aria-valuetext` in words: `June 2026`, or `July 2026, no UK figures yet` | Baseline, the exposure so far in 2 px `--ink`, the tracer-head thumb at the shown month, never gliding. No per-step ticks (668 at 0.31 px); a 3 px `--ink-3` tick at 50 % for each 1 January where ticks stand 3 px or more apart (every fifth year below that); a 7 px `--ink-2` tick and a 10.5 px label at each decade (`1980` to `2020`, never grouped), labels that collide skipped. No `now` notch: the data ends in Aug 2026, before today. ← → one month, Page Up and Page Down twelve (a year; Norne's stated departure from the house's eight), Home and End. **The scrub rule holds**: input records `wanted`; the frame computes the newest wanted month (`computeMonth()`, the ring lookups), sets `shown`, draws; the time row, the lead, the caption, the card, the details chart's cursor and `aria-valuenow` read `shown`. Stale requests are dropped; a month change is lookups in decoded arrays, so no preview is needed. The stock `<input type="range">` goes. |
| **Play** | 12 months a second on the clock, a year a second (the stock default), from the shown month to the newest month every shown country has reported, where it stops; Play there starts from Jan 1971 (owner call 4) | Every frame is one whole month (it already is). A touch on the track stops it on the month under the finger; About holds it; hidden stops it. The expensive work (`computeMonth()`, the circle and ring pass, the labels) runs only when the month, the view, the quantity, the mode or the countries changed since the last draw; a counter in the test hook proves it across a second of play (HOUSE 4.6). The months beyond (Jul and Aug 2026 today) stay reachable by the track and the keys. |
| **Readout card** | the tapped unit, platform, pipeline or boundary: `--sheet`, 1 px `--line-strong` edge, 8 px radius, top-left of the plate inset 8 px, at most 280 px wide; bottom-left when it would cover the tapped point | A field or unit: the place line `Statfjord, Norway and United Kingdom` (12.5 px `--ink-2`; `cross-border unit` follows for a group) with ✕ (an SVG, a 44 px hit, `Close`); the figure, the shown quantity in the shown month (`985` at 21/600, `Sm³/d` at 13.5 after U+202F), or `No figures` in an unreported month; a line under it, `Liquids in Jun 2026.` (`Liquids to Jun 2026.` in Cumulative); rows (`dl`, 12.5 px, labels `--ink-2`, values 560 `--ink`): **`Best month so far` `134 000 Sm³/d, Nov 1986`** (the ring's own record), `Hydrocarbon`, `Status today` (the regulator's current status, a row of its own so it is never read as the status in the month shown), `Operator`, `First month reported` (the first month of the regulator's series for the field; where that series starts late the value says so, in the words the cumulative notes use: `Jan 2003, when the Dutch series starts` for Groningen, discovered 1959; `Apr 1983; earlier months are not in the series` for West Sole, discovered 1965; the details sheet's row is the same); a text key `Details` (opens the details sheet). A platform: the place line `Floating, Norway`, its name at 13.5/650, rows `Phase`, `In place from`, `Until`, `Field`, `Operator`, `Position` (`65.064° N, 6.725° E`), `Id`, and `Show Åsgard` when it names a field. A pipeline: `Pipeline, Norway`, its name, rows `Medium`, `Diameter` (`762 mm (30 in)`; US `30 in (762 mm)`), `From`, `To`, `Phase`, `Length`, `Id`. A boundary: its name, `Between`, `Type`, and the Marine Regions sentence. Values update in place per month, never rebuilt (HOUSE 4.7). While a sheet is open the card stands down, since the sheet shows the same field and the plate is 220 px. In: 120 ms fade and a 4 px rise; out at once. A tap says it once in the live region: `Statfjord, Norway and United Kingdom. Liquids in June 2026: 985 standard cubic meters a day. Best month so far: 134000 standard cubic meters a day, November 1986.` |
| **Details sheet** | in the sheet's slot between the caption band and the player, on `--page` with a 1 px `--line` rule on top; `Statfjord` at 13.5/650 and `Close` at the top; scrolls inside itself; the plate keeps 220 px | The stock sheet's content, restyled: the history chart (below), the cross-border table (`NO` `Norwegian side` `85.47 % share` `884 Sm³/d`, a `Unit total` row at 560, 1 px `--line` rules, no bold), one `dl` per member under a 13.5/650 sentence-case head (`Norwegian side, NO-43658`; the stock tracked capitals go), the notes as 12.5 px `--ink-2` sentences (Danish delineation, annual figures spread evenly, where a cumulative sum starts). No grip, no drag, no half and full stops (the stock `sheetDrag`, B12); one sheet open at a time (Details or Map layers). On a wide screen (at least 820 x 480) a 380 px column at the right; on a phone on its side at most 340 px. |
| **History chart** | in the details sheet, 104 px: liquids and gas as oil equivalent on one scale (the stock's honest choice, kept), `--chart-liq` and `--chart-gas` 1.5 px; two 1 px `--line` gridlines; the scale's top value at the top left in 10.5 px `--ink-3` (`134 000 Sm³ o.e./d`); years at 10.5 px `--ink-2`; the cursor a 1 px `--ink` line at the shown month with its two dots; the key (line samples, `Liquids 985 Sm³/d`, `Gas 1.04 million Sm³/d`) | A tap or a drag on it sets the month through `wanted`, as the track does. The stock `134k`, `1.04M` labels and its 10 px system face go. |
| **Map layers sheet** | the same slot; `Map layers` at 13.5/650 and `Close` at the top; 44 px rows | `Field outlines`, `Platforms and subsea`, `Pipelines`, `Maritime boundaries`, `Depth shading`, `Field names`, `Circle edges` (the stock seven, the stored keys unchanged); then, under `Countries`, `Norway`, `United Kingdom`, `Denmark`, `Netherlands` (the stock chips moved here, owner call 7). Each row a `<button aria-pressed>` named by its words, with Anatomy's drawn 16 x 16 box (1.5 px `--ink-2` frame, a check in `--ink` when on) and, at the row's right, the map's own samples drawn as the plate draws them: a tinted outline, a gray shut field and a dashed delineation with `producing`, `shut down`, `Danish delineation`; a square, a triangle and a dot with `fixed`, `floating`, `subsea`; three line samples with `oil`, `gas`, `other`; the dashed boundary. That is the stock map key, moved where the layers are switched. A sentence at the foot: `Platforms and pipelines appear as you zoom in.` |
| **Find a field** | a full-height `--sheet` panel: `role="dialog"`, `aria-modal`, slides up 220 ms on `--sheet-in`, closes at once, `Close` at the top right, Escape, focus held and returned; the page behind it `inert` | Anatomy's form: the field 44 px tall, 1 px `--line-strong` frame, 6 px radius, placeholder `Statfjord, Troll, Brent` in `--ink-3`, its text at 16 px (iOS zooms into any field set smaller; a stated departure from the scale). The browser's clear button switched off (`::-webkit-search-cancel-button { appearance: none; -webkit-appearance: none }`, HOUSE 4.8) and replaced, while the field holds text, by `Clear the search`, the card's 12 px ✕ in a 44 x 44 hit. Results: 44 px rows, the name 13.5 px `--ink`, the countries as words in `--ink-2` (`NO, UK`), the status at the right in 12.5 px `--ink-2` (`Cross-border unit`, `Producing`). `No field by that name.` keeps its words. Once typing settles (700 ms) the live region says the count: `3 fields match.`, or `No field by that name.`. A choice closes the panel, turns the field's countries on, moves the month to its first production when it is not yet found, and flies to it. |
| **About** | a full-height `--sheet` panel from the stamp: `role="dialog"`, `aria-modal`, slides up 220 ms on `--sheet-in`, closes at once, `Close` at the top right and at the foot, Escape, focus held and returned, the page behind `inert`; it holds play still | **1. What the picture is**: the circles (area and color both the month's rate of the shown quantity, the month's volume over its days; color on a log scale over 3.5 decades below the top, area by square root, both saturating at the legend's open top end); **the rings** (section 1, test 6, every caveat there); the outlines (status only; tinted while producing, gray once shut, Danish delineations dashed); Cumulative (a sum of monthly volumes from where each regulator's series starts); months not yet reported; the depth shading (EMODnet's mean depth, display); play runs a year a second. The stock "Notes on the numbers" paragraphs keep their words in US spelling. **2. This data**: `label: value` lines, one per line: fields (1 229; with production figures; without an outline), cross-border units, installations (and the wind turbines and geothermal plants not drawn), pipelines, maritime boundary lines, monthly figures per country (`Norway: Jan 1971 to Jul 2026`, built from `ccFirst`, `ccLast`), the two files' build instants by hand with their zone (`Sat 26 Sep 2026, 10:56 (UTC−7)`, not the stock `toLocaleString()`, B10), the conversions (`1 Sm³ = 6.2898 bbl`, …). **3. Sources and credits**: each source's name, `License:` (the label in US spelling; the value verbatim from the data), its attribution verbatim, its address without the scheme (`factpages.sodir.no/`), its update cadence verbatim; then `Type: Ysabeau Office by …` (section 4). **4. How the data gets here**: the weekly build, the loop replacing `data/snapshot.json`, the app re-reading both files when it is opened and when new data lands; nothing fetched from outside the folder. |
| **Notices** | a `--sheet` plate centered on the plate, a 1 px `--line-strong` edge, 8 px radius, `role="alert"`, 13.5 px `--ink`, at most 300 px, no icon | The stock sentences already speak in the file's terms (`data/snapshot.json could not be read (HTTP 404).`); the em dash in `… is not valid JSON — it looks like a web page was written over it` becomes `; it looks like a web page was written over it`. The stock pink warning box, its red text and shadow go (no red in the chrome). A broken replacement keeps what was showing and says so, as the stock app already does. |
| **Live region** | one `<p class="sr" aria-live="polite">` | A tap's sentence; a year key's new month; Find's count; focus mode's two sentences; a refused press (`Rings show with Rate.`). Never per frame. |
| **Focus mode** | `Hide the controls` alone in the column's last plate; the ghost key `Show the controls` (`aria-keyshortcuts="Escape"`) top-right of the plate, 8 px under the top safe area; Escape when no panel is open | Leaves (`hidden` and `inert`): the header (name, `Find`, units key, the row of words), the key column, the sheet, the legend's bar and ticks (the house default, owner call 5), an open card. Stays: the plate with its circles and rings; the stamp, moved into the caption band as its first line, its hit running down; the caption line; the credits; the player. A tap still opens the card; a double tap still zooms. **Remembered** as `sa.focus` (`'1'` or `'0'`), restored before the first draw. Sentences: `Controls hidden. Press Escape or the corner key to show them.` and `Controls shown.`; focus moves only when the keyboard did it. Fades: chrome out 160 ms, ghost key in 200 ms, one resize. The camera already calls `showControlsIfHidden()` for this app (section 5). The home view is fitted to the plate: entering focus mode at home, or any resize that finds the view at home, moves it north just enough that the data's south edge (50.5° N) leaves no strip above the caption band. |
| **The opening** | none | The arrival is the map and its circles appearing once both files are in; the stamp counts while they load. |
| **Motion** | HOUSE 4.12 | `flyTo` (a search choice, `Whole North Sea`) keeps its 550 ms and takes `--draw`'s curve (`cubic-bezier(0.2, 0, 0, 1)`) in place of the stock ease-in-out; **any touch ends it at its destination** (the stock `pointerdown` set `fly = null`, stopping it midway, B13). Under Reduce Motion, read live with a `change` listener, flights are cuts and every CSS duration is 0 s; play already moves in whole months. Hidden (`visibilitychange`, `pagehide`): play stops, the loop stops; a return re-reads both files, as the stock app does. |
| **The map by keyboard** | the canvas focusable (`tabindex="0"`), described by a sentence naming the gestures; the arrow keys pan a quarter of the plate, `+` and `-` zoom about its middle | A single-pointer and keyboard way to move the map beside the drag and the pinch (the accessibility call the house raised for every view, plan 0011 D13), about 400 B. |
| **On its side** | HOUSE 4.13 | The header one 46 px row; the caption band's legend and credits side by side over a one-line caption; the player one row; the keys a row along the plate's top; the sheet a 340 px column beside the plate only, the caption band keeping the full width under both (with the caption beside the sheet as well, its credits wrapped to three lines and the plate fell to 218 px). At 844 x 390 the plate must be 220 px or more, measured by `shoot.mjs`: 233. West of the data's 6° W and east of its 32° E the plate shows the outside's own tone behind a `--line` edge, measured by `shoot.mjs` in both themes. The home view is not fitted by width: at 844 x 233 that is 22 px a degree and about 6° of latitude, so the opening would lose either the southern gas basin or the northern fields. |
| **Safe areas** | HOUSE 4.14 | Every band pads itself; the card and the ghost key sit under the top inset in focus mode. Phone checks. |

**What does not apply, and why:** a `now` notch (the data ends before today); per-step ticks on the
track (668 steps at 0.31 px); an opening; a second large figure (the card's figure is the only
other 21 px figure, and only while the card is open); the stock speed key (owner call 3).

---

## 4. Type

- **The house file, byte for byte.** `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
  `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
  sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copied from
  `global-weather/fonts/` (`cmp` both after copying). The one `@font-face` rule exactly as HOUSE 2.5
  gives it; the family used only through `--face`.
- **No supplement.** Every character the app writes outside comments, and every string in the data,
  was read against the cut (`python3` over `index.html`, `app.js` and `style.css` with comments
  stripped, and every string of `data/snapshot.json` and of `data/geo.json`'s borders, pipelines and
  facilities). Beyond ASCII the stock writes `³ · – — … ″ → ≤ ° × å æ ø` and, in CSS, `▸ ▾`; the
  data adds `Å Æ Ø ” ¥ Ã` and three C1 control bytes (U+0085, U+0086, U+0098). All are in the cut
  but `→ ▸ ▾` (which the pass removes: section 7) and the control bytes, which belong to the
  double-encoded names of B1 and disappear when they are repaired (`Ã…` becomes `Å`). The pass adds
  U+202F, U+2212, ≤ and ≥, all in the cut.
- **Removed:** nothing shipped, since the stock app named the system faces (`-apple-system`,
  `"SF Pro Text"`, `Roboto`, `Helvetica`, `Arial`) without shipping any: the stack in `style.css` and
  the `FONT` constant in `app.js` go, and with them the 19, 17 and 24 px sizes. Fonts after the pass:
  40 075 B (0 before it).
- **The scale here:** name 15/650; stamp 11.5; `Find` and the units key 600 at 12.5; the row of
  words 12.5 (620 chosen); legend title 11.5/600, its labels 10.5; caption 11; credits 10.5; the
  month 21/600 (the one large figure), the lead 12.5; track labels 10.5; the card's place line 12.5,
  its figure 21/600 with its unit 13.5, its rows 12.5 (values 560), a platform's name 13.5/650; the
  sheet's heads 13.5/650, its rows 12.5, its notes 12.5; the chart's labels 10.5; Find's results
  13.5 and 12.5, its field 16; field names on the plate 11.5/560 on the halo; About's prose 13.5/1.5
  within 62 ch; notices 13.5.
- **Text waits for the face.** `document.fonts.load('560 11.5px "Ysabeau Office"')` before the first
  frame with names, before any name is measured (the stock caches each label's width on first
  placement, `Un.lw`, so a fallback face would place every name wrong for good), and before the
  track's first draw; names, the track and the chart redrawn on `document.fonts`' `loadingdone`.
  Every font string in a script names `"Ysabeau Office"` first.
- **Credit line, word for word** (About, `NOTES.md`): `Ysabeau Office by Christian Thalmann
  (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.`

---

## 5. The camera's strings (HOUSE 7.4)

What the marketing camera reads in this app, in the Snuggery app's repository
(`Tests/SnuggeryUITests/MarketingCameraCase.swift` `waitForShelfAtlas()`, lines 260–266;
`MarketingShotsUITests.swift` shot 21, lines 490–497, and the README panes, lines 713–745;
`MarketingClipsUITests.swift` has no Shelf Atlas take). The camera's `webControl` lookup by label matches a
button's label case-insensitively and exactly, buttons first.

| String | Role | What the camera does | After the pass |
| --- | --- | --- | --- |
| `Play` | button | waits up to 180 s for it, then `showControlsIfHidden()`, then 4 s | **kept**: the Play key, named `Play` while paused; the player stays in focus mode |
| `Show the controls` | button | taps it if it exists (the focus guard) | **added** by this pass with the exact name; the guard is already in `waitForShelfAtlas()` (this repository's commit `3524aca`, *Camera: the Shelf Atlas helper leaves focus mode if a kept library had it on*) |
| `Back one year` | button | taps it, waits 2 s, shoots `readme-shelf-atlas-1` | **kept**: the left transport key's name |
| `Cumulative` | radio | taps it, waits 3 s, shoots `readme-shelf-atlas-2` | **kept**: a word in the row, `role="radio"`, no `aria-label` |
| `Rate` | radio | taps it to put the mode back | **kept** the same way; no other element is labeled `Rate` (the caption's `Rings show with Rate.` is a sentence) |

No string changes, so the camera needs no change in the commit that lands this pass. One note for
the lead, not this pass's to fix: the README pane taps `Back one year` and never steps forward again,
and the app remembers the month, so on a library that is not reset each run lands a year earlier
than the last (HOUSE 7.4: what the camera changes, it puts back).

---

## 6. Budgets

**The caps** (HOUSE 8, plan 0011 D5):

- **Code: 200 000 B, the lead's ruling (2026-10-02, plan 0011 D15): the house's cap.** The app's own
  150 000 B (`NOTES.md`: "app code ≤ 150 KB"; HOUSE 8 would let the tighter one win) was a target no
  build or check ever enforced (`scripts/shelf_atlas/build_north_sea.py` lines 38–39 and 313–317 hold
  only `geo.json` ≤ 2 500 000, `snapshot.json` ≤ 2 500 000 and `bathy.png` ≤ 1 200 000; `NOTES.md`
  misstates both, B14), and holding it would cut Find, the details sheet, the history chart and
  keyboard pan (owner call 1) for nothing a phone would notice. `check.mjs` enforces
  200 000, and `NOTES.md` is corrected to say so. Never minified, never stripped of comments.
- **Fonts: 160 000 B.**
- **ZIP: 2 413 130 B**: the ZIP before the pass, 1 900 237 B, × 1.25, rounded down, plus 37 834 B for the face (HOUSE 2.2), as
  HOUSE 8's table gives it.

**As built** (2026-10-02, after the review's fixes; `node tools/check.mjs`, which prints every figure):

| | Bytes | Against |
| --- | --: | --- |
| App code: `index.html` 18 867, `style.css` 23 269, `app.js` 102 582, `js/data.js` 26 165, `js/track.js` 6 137, `js/units.js` 6 775 | **183 795** | 200 000 (16 205 to spare) |
| Fonts: the face 35 372, `OFL.txt` 4 703 | **40 075** | 160 000 |
| ZIP, as `build-zips.yml` packs it | **about 1 980 000** | 2 413 130 (about 433 000 to spare) |

The ZIP's exact figure is the one `check.mjs` prints: this file ships inside it, so writing the
figure here moves its last digits (1 979 298 B when this table was written).

---

## 7. The generated-page tells, answered

| Tell | What this app does instead |
| --- | --- |
| 1. A warm cream ground, a high-contrast serif display, a terracotta accent | The cool film-base page `#e8eef0`; the stock cream land `#f7f5f0` becomes `#eff1ef`. One low-contrast Renaissance sans at every size. No accent: the warm hues on screen are the circles, which are data. |
| 2. A near-black ground with one acid-green or vermilion accent | The dark page is the house slate (L 0.224); the stock plate `#07090d` (L 0.09) goes. No accent; the one bright thing is the ring, and it is data. |
| 3. Broadsheet: hairlines, zero radius, dense columns | One column. Hairlines only where they separate: the sheet's top, About's sections, the members table, the key separators, the player's top rule. Radii 6, 8 and 4 px by role, 0 on the legend bar. |
| 4. The SaaS-card kit: identical rounded cards, one radius, one soft shadow, gradient washes | One card (the readout), one sheet at a time, About and Find as panels. No shadow, no blur, no glass (the stock had four blurred glass surfaces and eight shadows). The only gradients are the legend's data scale and the selection tracer. |
| 5. ALL-CAPS tracked eyebrow labels | None: the stock `CROSS-BORDER UNIT` and `NORWEGIAN SIDE · NO-43658` heads (uppercase, 0.04 em tracking) become `Cross-border unit` and `Norwegian side, NO-43658` at 13.5/650; the country chips' tracking goes. |
| 6. Meta strings joined with middle dots | Commas, sentences or one value per line: the stamp, the lead, the card's line, a platform's kind line, About. The one middle-dot string left is the credit line, kept word for word. |
| 7. "WORD — fragment" labels with a spaced em dash | None in the app's own text: the fallback source names in `allSources()` (`Natural Earth 1:10m — coastline, …`) become `Natural Earth 1:10m: coastline, countries, bathymetry`. A source's name as the data writes it is printed as the data writes it. |
| 8. A tinted near-black standing in for black | Ink is the house `#0f1c23`, a stated ink; the ring `#0c131b` is a stated chart ink at hue 252; the stock near-black facilities and `#07090d` plate go. |
| 9. A monospace face for small data labels | None, and there was none. Ysabeau Office's figures are tabular. |
| 10. "→" appended to links and buttons | None: the stock title of a pipeline with no name, `From → To` (`renderPipeSheet()`), becomes `From to To`; `check.mjs` fails on → and ➤. |
| 11. One word accented in a headline | None: the stock lead's bold total and the red stale stamp go; a stale state is a sentence in `--ink`. |
| 12. Unnecessary labels above content | The legend's title is the quantity its bar measures. The sheet's heads name what follows (`Cross-border unit`, `Norwegian side`) and sit beside their content, in sentence case. |
| 13. Numbered markers (01 / 02 / 03) | None. |
| 14. A big number, a small label and a gradient accent | One large figure, the month, at 21 px; the card's figure at 21 px only while it is open. The stock sheet's 24 px figure goes. No gradient. |
| 15. Scattered fade-and-slide entrances, hover on every card | No entrances. The one continuous motion is the data's (play); the small transitions answer a touch. Hover only on controls, under `@media (hover: hover)`. |

**The interface guidelines**, where the house writes its own rule (HOUSE 9): sentence case
(`Hide the controls`, `Find a field`); dates by hand, not `Intl`; the face `font-display: block`;
`translate="no"` on the name, the units key, field and source names; `aria-live="polite"` for
sentences; `<button>` for every action (the stock credits button and legend button become text);
`env(safe-area-inset-*)` on every band; `…`, never `...`.

---

## 8. Where the record is

The pass's record does not ship: the change list with the bugs B1 to B14, the owner calls (the
references to "owner call 1" to "owner call 10" above point there), the as-built departures and the
phone checks are in `tools/DECISIONS.md`, which the ZIP leaves out (HOUSE.md, "What ships and what does
not").
