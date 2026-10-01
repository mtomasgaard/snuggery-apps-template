# Milky Way: art direction

`NOTES.md` says what the app does and where every number comes from. This file says how it looks,
moves and speaks under the template's house system (`Template/HOUSE.md`, the brief this pass
follows; Global Weather is the reference). Every figure names the command that printed it. The
scripts are in `tools/`, which the ZIP leaves out. Owner calls are listed at the end and, as the
build settles them, in `tools/DECISIONS.md`.

**Measured on 2026-10-01**, before the pass, on the working tree: commands are run from
`Template/milky-way/` unless they say `Template/`.

---

## The look: the house, with one bold thing of its own

Milky Way takes the house chrome whole: one face, gray chrome, the caption band, the player and the
app's own track, focus mode, SI and the no-tells rules. What is its own is the plate and one
signature.

- **The plate keeps its night in both themes.** Space has one true appearance (HOUSE §3.2, as
  Earth's History keeps its night). The stars keep their catalog colors, the globes their maps and
  measured colors, the Gaia sky and the galaxy model their display tints. The chrome around the
  plate follows the phone's theme: film base and ink by day, the slate print by night.
- **One bold thing: the Reach** (below). Everything else on the chrome is quiet.
- **Honesty is the point of the app already.** Every position, size and name is measured or a
  labeled fit. The pass keeps every word of that and adds the house's rules for numbers and words.

**How it differs from the apps before it** (it copies none of them):

| | Global Weather, Global Wind | Earth's History | US Quakes | Warming World | Milky Way |
| --- | --- | --- | --- | --- | --- |
| Signature | the streak field on the plate | the time control as a stratigraphic column | the record strip, one stem per quake | the stripes as an instrument | **the Reach: a log ruler of distance, inked where the catalogs reach, notched where you are** |
| Axis | the map | time (Ma) | time (days) | time (years) | **distance from the Sun, fifteen powers of ten** |
| What it encodes | the wind's path at a printed rate | period colors | magnitude by stem height | anomaly by color | **presence only: is anything cataloged at this distance?** |
| Where it lives | on the plate | the player | a band | the scrubber | **the caption band's legend slot** |
| Plate | film base / print, theme-inverted | night in both themes | drum paper | gray card | **space in both themes** |

---

## 1. The signature: the Reach

**What it is.** Under the picture, where another app keeps its color legend, runs a ruler of
distance from the Sun on a logarithmic scale: from 0.001 AU (150 000 km) at its left end to
10¹² AU at its right, fifteen powers of ten, running past both ends of the app's one continuous zoom
(30 km to 580 kpc: the ruler's last 0.92 of a power of ten, with its `1 Mpc` label, lies beyond the
zoom's ceiling, `MAX_DIST` in `js/view.js`). Along it
runs a 6 px bar, inked at every distance where these catalogs hold an object at the date shown:
the planets and the Moon, the 21 moons, 9 989 asteroids and comets, 10 973 named stars and 209 156
deep stars placed in 3D, 194 globular clusters, 65 satellite galaxies and the tracks of 100 stellar
streams. Where nothing is cataloged, the bar is blank. A notch cut through the bar, with a hairline
above and below it, stands at the camera's own distance from the Sun, the number the caption
prints (`You are 9.43 AU from the Sun`). Pinch out from Saturn and the notch slides right along
the planets, out of the ink into a long blank stretch, and back into ink at the nearest star.

**What a stranger remembers is the gap.** At 2026-10-01 the farthest small body in the data is
159.8 AU from the Sun and the nearest placed star is 268 500 AU (Proxima Centauri, 1.30 pc): 3.23
powers of ten with nothing in these catalogs, a blank stretch 77 px long at 390 px, between two
long runs of ink (`node tools/.work/census.mjs`, a throwaway script that read every shipped file:
"gap 1.598e+2 -> 2.685e+5 AU, 3.23 decades"; the only gap over half a decade). The Sun's family
and the stars are separated by a void the app's zoom crosses in one pinch, and the Reach shows it
without a word of explanation.

**How it was found** (HOUSE §5.1):

1. *What does a specialist call the picture of this data?* The powers-of-ten scale: the log axis
   every astronomer draws when one plot must hold a moon's orbit and a satellite galaxy, and the
   slide rule's graduated scale with its cursor.
2. *What does a person do most here?* Pinch, from a moon to the galaxy, and tap the three scale
   words that fly there. The notch answers every pinch, so the craft sits where the hands are.
3. *What does this data have that no other app has?* Eighteen powers of ten of distance (from
   the rig's 30 km floor to its 580 kpc ceiling) and the measured fact that the catalogs are empty
   between the Kuiper belt and the nearest star. No other app has an axis like it; moved to another
   app, the Reach would mean nothing.
4. *Can it be drawn with the house's means?* One mark at the far end of the tonal budget, the
   house's ticks and labels, no motion of its own.

**The test** (HOUSE §5.2), each answered yes:

1. *Delete the data and it disappears.* The ink is computed from the loaded files. With a file
   missing the app shows its notice and the bar stays blank; only the graduation remains, as an
   empty legend would.
2. *Every property that varies is measured.* The ink per device pixel column is the presence of at
   least one cataloged distance in that column's range; the notch is the camera's distance from the
   Sun, the same float64 number the caption prints. The scale is fixed and printed (decade ticks,
   unit labels). Nothing encodes by length or speed.
3. *It is captioned.* The caption band's text holds its reading, with its numbers: `You are 9.43 AU
   from the Sun` (the notch) and `The bar is inked where these catalogs hold an object; none lie
   between 160 AU and 1.30 pc.` (the ink and the gap, both computed from the data).
4. *It reads.* Ink on the page measures 15.90:1 (light) and 15.47:1 (dark); the notch in the ink
   the same (`python3 milky-way/tools/art/palette.py`, from `Template/`).
5. *It survives Reduce Motion.* It has no motion of its own; the notch moves only when the view
   does, and under Reduce Motion flights are cuts, so the notch jumps.
6. *About says what it shows and what it does not.* The gap is the reach of these catalogs, not a
   measurement of empty space: comets and bodies too faint for these lists live there. About says
   so in as many words, with the gap's two ends.
7. *It is the only bold element* on the chrome. The rest passes §7 below.

**Drawn exactly so** (a new pure module `js/rule.js`, a canvas in the caption band):

- Span: log10(distance / AU) from −3 to 12, full width inside the band's 16 px gutters (plus the
  side safe areas). The canvas is DPR-sharp and redraws only when the notch moves by a device pixel
  or the census changes.
- The bar: 6 px tall, square ends, in the signature color (light `#0d131c`, dark `#eff4fa`),
  filled per device pixel column where the census has at least one object. Under the bar, 1 px
  `--line-strong` along its full length, so the blank stretches still read as part of the ruler.
- The graduation: a 4 px `--ink-3` tick under the baseline at every power of ten (16 ticks); no
  sub-ticks (at 24 px a decade they merge).
- Labels, 10.5 px `--ink-2`, under their ticks: `1 AU`, `1 pc`, `1 kpc`, `1 Mpc` at their true
  positions (1 pc and 1 Mpc are not powers of ten of the AU: they get a 7 px tick of their own),
  the last one right-aligned at the end; labels that would collide are skipped, as the track does.
- The notch: a 3 px gap of `--page` cut through the bar at the camera's distance from the Sun,
  with a 1.5 px hairline in the signature color from 6 px above the bar to 6 px below it. No disc,
  so it never reads as the time track's thumb.
- The census: the solar part (planets, the Moon, the 21 moons where their fits cover the date, the
  small bodies) is computed at load and again whenever a frame draws another day (after review; it
  was once a year, see "After review"); the stars, clusters,
  satellites and streams once at load. The 76 sky-only stars have no distance and are left out.
  The gap's two ends for the caption come from the same census (the farthest solar-system object,
  the nearest placed star).
- Accessible: `role="img"`, its name rewritten on `settle` and `arrive`, never per frame:
  `Distance from the Sun on a ruler of powers of ten. Catalog objects lie from 0.31 to 160
  astronomical units and from 1.30 parsecs to 370 kiloparsecs. You are at 9.43 astronomical
  units.` (every figure from the census and the view).

---

## 2. Palette

`tools/art/palette.py` (written in this pass; run from `Template/`, standard library only) holds
every value below and ended `ALL CHECKS PASS` (`python3 milky-way/tools/art/palette.py`, exit 0).
`--json` prints the plate's colors in the shape `js/plate.js` takes; the builder pastes it, never
retypes it, and `tools/check.mjs` fails while the two differ.

### The chrome tokens

The house tokens of HOUSE §3.1, copied exactly, in both themes. Measured by the same run:

| Pair (WCAG 2) | Light | Dark |
| --- | --: | --: |
| `--ink` / `--ink-2` / `--ink-3` on `--page` | 14.80 / 6.61 / 4.78 | 14.43 / 7.76 / 5.88 |
| `--ink` / `--ink-2` / `--ink-3` on `--sheet` | 16.40 / 7.32 / 5.29 | 12.87 / 6.92 / 5.25 |
| `--line-strong` on `--page` | 3.27 | 3.56 |

Highest chroma of any chrome token: 0.0239. The stock look's `--accent` (sunlight `#f2c56f`),
`--cool`, `--warn`, `--glass`, `--glass-2`, `--panel`, `--panel-2`, `--muted`, `--faint`, `--rule`,
`--serif` and `--r` go, with every `backdrop-filter`, `box-shadow` and `text-shadow`.

### The tonal budget, per ground

**The caption band (the signature's ground), per theme:**

| | Light | Dark |
| --- | --- | --- |
| Ground | `--page` `#e8eef0`, L 0.945 | `--page` `#141d21`, L 0.224 |
| The band's other marks | graduation `--ink-3`, labels `--ink-2`, baseline `--line-strong`: all between the page and the ink | the same |
| Signature | the bar and hairline, `#0d131c` (OKLCh 0.185, 0.0208, 258), alpha 1 | `#eff4fa` (OKLCh 0.965, 0.0097, 253), alpha 1 |
| Beyond `--ink`? | yes: L 0.185 against `--ink`'s 0.218 | yes: L 0.965 against 0.941 |
| Worst measured | bar on page 15.90; notch in bar 15.90; ticks 4.78; labels 6.61 | bar on page 15.47; notch in bar 15.47; ticks 5.88; labels 7.76 |

The signature is a cool near-neutral (starlight, h 253–258, chroma ≤ 0.021): not `--ink`, not a hue
of any data color, and not Global Weather's streak (`#0b171d` / `#f4f2ea`, h 231 / 95).

**The plate (one appearance in both themes, stated once):**

| | Value |
| --- | --- |
| Ground | space `#020308` (the renderer's clear color), L 0.099 |
| Data band, the plate's own marks | L 0.599 to 0.901 at base color: orbits, trails, markers, figures, every category below |
| Data with its own logic, untouched | the stars' Planck colors (the color table in `data/stars/`), the globes' maps and measured colors, the Gaia sky's tint (0.82, 0.86, 1.0), the young-star maps' tint (0.32, 0.58, 1.0), the disk-and-bar model's tint (1.0, 0.86, 0.66) |
| Far end | the labels' ink `#e6edee` (L 0.941) on a 3 px halo of space at 0.85 |
| Worst measured | label ink on its halo over the worst base (white: a star core, the Sun, ice) 12.26; `--plate-ink-2` there 6.59 (text, target 4.5) |

The bases a label or mark can sit on, all in `palette.py`: bare space; the Gaia sky at full count
(`#d1dbff`); the disk-and-bar model's five planes at full (`#fff1b9`); white.

### The plate's marks and categories

The stock app colored orbits, trails and markers per planet with "interface colors for finding
things, not data" (`js/solar.js`), and the galaxy and small-body layers with category hues. Under
the house every hue a person sees is data, so:

- **Neutral, one color** `#cad2d8` (OKLCh 0.86, 0.012, 240): planet and Moon orbits (alpha 0.16),
  moon orbits (0.30), trails (head 0.90, the stock fade kept), planet markers (1.0), constellation
  figures (0.275), the galaxy's distance rings (0.18). The planets are named by their labels, as
  they always were. The selected label carries the selection mark (§3).
- **Categories, fitted into the band**, the stock hue logic kept where it meant something. Each is
  checked against bare space at its drawn alpha (marks ≥ 3:1; guides, drawn faint on purpose and
  never the only carrier of a meaning, ≥ 1.3:1), and every pair that shares a scale separates by
  ΔE (OKLab) ≥ 0.10 under normal vision and simulated deutan, protan and tritan vision:

| Scale | Category | Color | Alpha | On space | Worst pair (ΔE, vision) |
| --- | --- | --- | --: | --: | --- |
| Galaxy, lines | arm fits to masers (Reid 2019), band 0.34 under line 0.42 | `#fab36d` | 0.62 together | 4.73 | with Drimmel 0.106 (tritan) |
| | arm fits to Cepheids (Drimmel 2024), dashed | `#9c72de` | 0.75 | 3.60 | with streams 0.113 (tritan) |
| | streams, measured tracks (guide) | `#95e0e8` | 0.26 | 1.78 | with Reid 0.101 (deutan) |
| | streams, approximate: dashed and fainter (guide) | `#95e0e8` | 0.16 | 1.33 | (same hue; the dash, the alpha and the card's word tell them apart) |
| Galaxy, points | globular clusters | `#f8dc86` | 1.0 | 15.28 | with satellites 0.199 (tritan) |
| | satellite galaxies | `#e680a1` | 1.0 | 7.82 | |
| | the Sun's mark, the frame's center (each always labeled) | `#ecdcc1`, `#dedede` | 1.0 | | not paired |
| Solar System | small bodies, inner (near-Earth, Mars-crossers) | `#f28c5c` | 0.9 | 6.96 | with belt 0.144 (deutan) |
| | belt (main belt, Trojans, other) | `#f3dba9` | 0.9 | 12.22 | with comets 0.144 (protan) |
| | outer (centaurs, trans-Neptunian, dwarf planets) | `#697fb1` | 0.9 | 4.36 | with comets 0.144 (deutan) |
| | comets and interstellar objects | `#42c2e6` | 0.9 | 8.08 | |
| Neighborhood | an exoplanet host's ring (guide, after review) | `#61e8a8` | 0.35 | 2.34 | (one category) |

What was given up, said plainly: the stock app drew ten small-body classes in ten colors; ten
cannot pass the pair check, so they are four groups by where the orbit lies, and the card names the
class in words, as it already did (owner call 4). The planets lose their hue codes (owner call 5).
The host ring is green because the Planck locus never reaches green, so it cannot be read as a
star's color.

**The ghost key** sits on the night plate in both themes, so it is drawn one way in both: a 1.4 px
`#f2f4f1` stroke over a 3.4 px halo of space `#020308` at 0.75. Global Weather's dark-theme halo
(45 %) measured 2.17:1 over a white star and failed; at 0.75 the worst over every base is 5.60.

### CSS custom properties this app adds (theme-independent, declared once in `:root`)

`--plate: #020308`, `--plate-ink: #e6edee`, `--plate-ink-2: #a3b1b6`,
`--plate-halo: rgba(2, 3, 8, 0.85)`, `--reach: #0d131c` (redefined `#eff4fa` in the dark block).

---

## 3. The chrome, object by object

Milky Way is HOUSE §4.0's *3D view with time*, with time only at its Solar System scale. The frame
at 390 × 844 (CSS px, safe areas outside):

```
+------------------------------------------+
| Milky Way                                | 22  name 15/650
| JPL DE430 and Gaia DR3, retrieved 23 Sep | 16  the stamp, 11.5 --ink-2, opens About
| Solar System  Neighborhood  Milky Way    | 44  the scale words, the tracer under one
+------------------------------------------+
| [card]                              [+]  |
|                                     [-]  |     the plate: the 3D view, edge to edge,
|                                     ---  |     space in both themes, labels on halos
|                                     [F]  |     Find
|                                     [L]  |     Layers
|                                     ---  |
|                                     [H]  |     Hide the controls
+------------------------------------------+
| ####### ###########       ############## | 31  the Reach: bar, notch, graduation
|  '    1 AU   '    '    1 pc '  1 kpc 1 Mpc
| You are 9.43 AU from the Sun; the screen | 45  the caption: three lines fixed
| is 152 000 km across there. The bar is   |     below 640 px, two from 640 px
| inked where these catalogs hold ...      |
| NASA/JPL, USGS, ESA/Gaia/DPAC, AT-HYG... | 15  the credit line
+------------------------------------------+
| 1 Oct 2026, 16:03 UTC     [1 s = 7 d] Now| 44  the time row (Solar System only; 28 before QA)
|  <   [>]   >   ---------*-------.------- | 44  Previous year, Play, Next year, the track
|                Jan Feb ... Oct Nov Dec   | 14  month labels
+------------------------------------------+
```

That leaves about 565 px of plate at the Solar System scale and about 659 px elsewhere (the
builder measures both in `shoot.mjs`). The page is a column (header, plate, caption band, player),
`100dvh`, `overscroll-behavior: none`; the plate is `flex: 1 1 auto; min-height: 0`. The stock
`position: fixed` stage, the floating dock, the gradient scrim and the `≥ 760 px` and `≥ 880 px`
side-panel layouts go: wide screens get the same column with 20 px gutters from 700 px.

**The plate's angular scale is held across every height change.** The stock camera has a fixed
50° vertical field, so a taller plate would zoom the picture. `resize()` keeps `pxPerRad` when only
the plate's height changes (focus mode, the player band leaving at the scale threshold) and derives
the vertical field from it, clamped to 30°–75°; a width change (rotation) resets it from 50°. The
rig's `fov` follows. A `ResizeObserver` on the plate drives `resize()` once per change.

| Object | Here | Notes |
| --- | --- | --- |
| **Header: name** | `h1` `Milky Way`, 15/650, `translate="no"` | The Library name; never renamed. |
| **Header: stamp** | `<button>` opening About (`aria-haspopup="dialog"`, described *Opens About this data.*), 11.5 px `--ink-2`, a 44 px hit: `JPL DE430 and Gaia DR3, retrieved 23 Sep 2026` | Data built once: the stamp names the edition. The date is the latest `retrieved` in `data/about.json`, written by `js/units.js`; the two names are fixed words. While loading it counts: `Reading the stars… 4 of 6`. No stale state (nothing is refreshed). The stock subtitle (`Saturn · 1 Oct 2026`) goes: the date is in the player, the target in its label. |
| **Header: units key** | none | Distances are printed in km, AU, pc and kpc (SI and the IAU's units); stars and galaxy objects add light-years as a second figure in the card. A pc/ly key is owner call 2. |
| **Row of tabs and words** | the three scale words `Solar System`, `Neighborhood`, `Milky Way`: `<button aria-pressed>`, 12.5 px, 44 px tall, 16 px apart, the house tracer under the current scale (620, `--ink`) | The camera's buttons (§5). The current scale follows `currentScale()` as today, so the tracer moves while you pinch. No divider and no layer words: the layers are a sheet. 230 px of words at 12.5 px (measured, `node tools/.work/measure.mjs`), so the row fits at 320 px without scrolling. |
| **Key column** | three `--sheet` plates on the plate's right edge, inset 8 px: `Zoom in`, `Zoom out` / `Find`, `Layers` / `Hide the controls` (as built after the follow-up: two plates, `Zoom in`, `Zoom out`, `Find`, `Layers` / `Hide the controls`, so the column fits the 255 px plate of a 320 × 568 phone) | 44 × 44 hits drawn 36 × 44, 16 px marks in 1.5 px strokes, `--ink-2` at rest. Zoom keys set `rig.vel.zoom` as the empty-space double-tap does (a cut under Reduce Motion). Find and Layers carry `aria-haspopup="dialog"` and `aria-expanded`. Find's mark is a lens; Layers' mark must not be the stock two-rhombus glyph (three parallel arcs of an orbit seen edge-on, nested, is the suggestion). |
| **Caption band: legend slot** | the Reach (§1), 31 px | Leaves in focus mode with the legend's bar (HOUSE §4.10; owner call 10). |
| **Caption band: caption line** | 11 px `--ink-2`, fixed height: three lines below 640 px, two from 640 px | `You are 9.43 AU from the Sun; the screen is 152 000 km across there. The bar is inked where these catalogs hold an object; none lie between 160 AU and 1.30 pc.` The first sentence is rewritten every frame the view changes (the camera waits for its words); the screen's width at the target's distance replaces the stock ruler (80 px bar). The second is rewritten when the census changes. Measured at 11 px: 315 px and about 370 px, so three lines hold both at 288 px (a 320 px phone) and two at 358 px; `shoot.mjs` measures the longest caption the data can produce at 320 px. Nothing in it may say `from the Sun` before the data is in. |
| **Caption band: credits** | the constant `CREDITS`, 10.5 px `--ink-2`, on screen in every mode | Proposed: `NASA/JPL, USGS, ESA/Gaia/DPAC, AT-HYG, LVDB, galstreams, Stellarium` (335 px at 10.5 px: one line from 360 px, two below). Commas, no middle dots. Which names make the line is owner call 6; every source and license stays in About. |
| **Player** | only at the Solar System scale, as today (`showTime`); the band collapses elsewhere and the plate takes its rows (angular scale held) | |
| **Player: time row** | the one large figure `1 Oct 2026, 16:03` 600/21 px, then `UTC` 12.5 px `--ink-2`; at right a speed key `1 s = 7 d` and a text key `Now` | Dates by hand in `js/units.js`, day before month, 24-hour, UTC (the ephemeris's own clock). VoiceOver: `Thursday 1 October 2026, 16:03 UTC`. Below 360 px the clock moves out of the figure into the lead (`16:03 UTC`). Speed key: the house's word-key frame, cycling the stock five speeds and writing them as exposures, `1 s = 1 h`, `1 s = 1 d`, `1 s = 7 d`, `1 s = 30.4 d`, `1 s = 365.25 d` (the stock `30.436875` and `365.25` days; owner call 7), named `Playback speed, now 1 s = 7 d` (its visible words, WCAG 2.5.3) and described `7 days a second` (after review). `Now` is described *Back to the present moment*. Nothing in the row transitions. |
| **Player: transport** | `Previous year`, `Play` / `Pause`, `Next year` (44 × 44) | The track holds one year, so the step keys step a year, as the stock `‹ ›` did; disabled at 1900 and 2099. Play is the one solid control: a 32 × 32 `--ink` square, `--page` triangle, two bars while playing, its mark always its name. |
| **Player: the track** | `js/track.js` on Global Weather's pattern: `id="slider"`, `role="slider"`, one year of whole days (365 or 366 steps), `aria-valuetext` in words | Baseline `--line-strong`; 2 px `--ink` from 1 January to the shown day; a 7 px `--ink-2` tick and a 10.5 px label at each month (`Jan` … `Dec`, colliding labels skipped); no per-day ticks (0.6 px apart, they would merge: a stated departure); `now` notch when today is in the shown year; the tracer-head thumb. A step keeps the clock: scrubbing changes the date, not the time of day. The Left and Right arrow keys move a day, Page Up and Page Down eight days, Home and End to the year's ends. **The scrub rule holds:** the frame draws the wanted day and then sets `shown`; the thumb, the time row, `aria-valuenow`, the card and the caption read `shown`; a position is a Chebyshev evaluation (measured about 6 ms of script per frame in headless Chromium, `NOTES.md`; a trend, not phone evidence), so no frame can lag the finger and there are no preview frames. |
| **Play** | continuous, on the clock, as today; under Reduce Motion one jump of the speed's own unit (1 h, 1 d, 7 d, 30.4 d, 365.25 d) once a second | Every frame is an exact ephemeris instant, never a blend. About and the other sheets hold play still. A touch on the track during play stops it on the day under the finger. Leaving the Solar System scale stops play, as today. |
| **Readout card** | the selected object: `--sheet`, 1 px `--line-strong` edge, 8 px radius, top-left inset 8 px, at most 280 px wide; at most 34 % of the plate's height upright, and never less than 144 px (it scrolls inside, its two keys held at its foot; after review: it was 45 %), the plate's height less 16 px on its side; bottom-left when it would cover the tapped point | Kind line 12.5 px `--ink-2` (`Moon of Saturn`) with ✕ (SVG, 44 px hit, `Close`); the name, `h2` 15/650; the one figure, the distance from the Sun (from the Earth for the Sun itself), 21/600 with its unit 13.5 px after U+202F; rows as a `dl` at 12.5 px; the note and source in 12.5 px `--ink-2`; `Fly there` and `Show orbit` as text keys at its foot (no filled button). In: 120 ms fade and 4 px rise; out at once. Its text is updated in place. The stock view shift (`wantedShift`, `setViewOffset`) goes: a 280 px card in the top-left leaves the plate's center clear, and the house rule moves the card instead (after the follow-up it is back, fitted to this layout: see the last section). The rule counts a globe's disk, not only its center, and the 34 % keeps a globe flown to (9 radii: a disk 24 % of the plate's height across, its top at 38 % of it) clear of the card on any plate from 399 px tall; below that the 144 px floor wins and the card covers the disk's edge (about 12 px at 375 × 667), a trade written down in "After review". |
| **Readout: sentence** | one polite live region | A tap says it once: `Saturn, planet, 9.43 astronomical units from the Sun.` The stock `aria-live` on the card (rewritten four times a second while playing) and on the HUD (every frame) go. |
| **About** | a full-height `--sheet` sheet from the stamp: `role="dialog"`, `aria-modal`, slides up 220 ms on `--sheet-in`, closes at once, `Close` at the top right and the foot, Escape, focus held and returned | Sections, each headed 13.5/650 in sentence case, separated by 1 px `--line` rules: **1. What the picture is**: the Reach (what the ink and the notch are, that the gap is the catalogs' reach and not empty space, with its ends), sizes true and the screen width in the caption, then about.json's `reading-brightness` and `reading-glow` blocks as they are. **2. This data**: `label: value` lines from the data (`Planets and the Moon: 1900 to 2099`, `Moons of Mars and the giant planets: 21, 1950 to 2049`, `Asteroids and comets: 9 989`, `Stars placed in 3D: 220 129`, `Stars on the sky only: 76`, `Globular clusters: 194`, `Satellite galaxies: 54 confirmed, 11 candidates`, `Stellar streams: 100, 52 with measured tracks`, `Retrieved: 23 Sep 2026`). **3. Sources and credits**: about.json's dataset blocks and `not-shown`, each field as its own line (`Owner:`, `License:`, `Retrieved:`; the values verbatim, middle dots gone), then the app's own `Software and type` block (three.js r186, MIT; `Type: Ysabeau Office by …`, the house line). **4. How the data gets here.** about.json's `reading-sizes` (it names the stock ruler "at the bottom left") and `software` (it names the dropped faces) blocks are not rendered; §8 item 17 says why the file keeps them (after the follow-up's rebuild both carry their new text, and About still says both in its own words). |
| **Find, Layers** | the same sheet as About, opened from the key column | Find: a 16 px search field (the one size off the type scale: iOS zooms into any field set smaller; owner call 12) in a 1 px `--line-strong` frame, radius 6; results as `<button>` rows ≥ 44 px, the name 13.5 px `--ink` and the kind 11.5 px `--ink-2`. Layers: groups headed 13.5/650 (`Solar System`, `Stars`, `Milky Way`, `Everywhere`), each row a `<label>` with the stock checkbox kept for its semantics and drawn as a 28 × 28 key (on: `--ink` 12 % plate and a 1.5 px check; off: a 1 px `--line-strong` frame), the name 13.5 px, the description 11.5 px `--ink-2`. |
| **Notices** | a `--sheet` plate on the plate, `role="alert"`, 13.5 px, at most 300 px, centered, no icon | The stock loading overlay goes. A load failure says what is wrong in the file's terms and does not apologize: `data/stars/named.json could not be read (HTTP 404). The app's files are incomplete: install its ZIP again.` WebGL refused: `This phone gave no 3D graphics (WebGL 2) just now. Close other apps and open Milky Way again.` |
| **Live region** | one `<p class="sr" aria-live="polite">` | A tap's sentence; a year step's new date; focus mode's two sentences. Never per frame. The track's arrow keys add none. |
| **Focus mode** | `Hide the controls` alone in the column's last plate; the ghost key `Show the controls` (`aria-keyshortcuts="Escape"`) top-right of the plate, 8 px under the top safe area | Leaves (`hidden` and `inert`): the header, the key column, the Reach, any open sheet, an open card. Stays: the plate; the stamp, moved into the caption band as its first line; the caption; the credits; the player at the Solar System scale. A tap still opens the card. Escape leaves it when no sheet is open (Escape today closes sheets and the card; it keeps doing that first). Remembered as `milkyway:focus` through the stock `store` (`true` / `false`), restored before the first draw. Sentences: `Controls hidden. Press Escape or the corner key to show them.` and `Controls shown.`; focus moves only when the keyboard did it. Fades: chrome out 160 ms, ghost in 200 ms, one resize. |
| **Labels on the plate** | the stock DOM labels, restyled: 11.5/560 `--plate-ink` (major), 11/400 `--plate-ink-2` (minor: moons, dwarfs), 10.5/400 `--plate-ink-2` (faint: comets, stars seen from the planets), each over a 3 px halo of `--plate-halo` (`paint-order: stroke fill; -webkit-text-stroke: 3px`) | No pill, no border, no blur, no `text-shadow`. The point mark before the name is a 4 px disc in `--plate-ink`, or the category's color for the galaxy's categories (arms, clusters, satellites), with no glow. An arm label reads `Norma arm (fit)`. The selected label: 620 and the house tracer under it in `--plate-ink`, no animation (labels move every frame). Widths measured with `"Ysabeau Office"` after the face has loaded. If WebKit does not paint the stroke under the fill on HTML text (a phone check), the fallback is eight zero-blur `text-shadow` offsets of 1.5 px in the halo color: a stroke built of offsets, never a blur. |
| **The opening** | none | The arrival is the sky appearing: the stamp counts while the files load over bare space, then the first frame draws. The stock overlay, its 34 px serif title and its gold progress bar go. |
| **Motion** | HOUSE §4.12 | Flights keep `js/view.js`'s own path and `easeInOut` timing (900–3 200 ms, the camera's waits are tuned to them; a departure from `--draw`, stated; after the follow-up the path is van Wijk and Nuij's, the timing unchanged). A touch during a flight now lands at its destination (today it stops mid-flight). Reduce Motion: every CSS duration 0 s, flights are cuts (already in `view.js`), play jumps. Hidden: the frame loop stops; a return redraws at once. The Sun's glow and the points' soft halo stay as the plate's documented display effects (about.json's `reading-glow` says so; owner call 3). |
| **On its side** | HOUSE §4.13 | Header one 46 px row (name over stamp at left, the scale words in the middle); the caption band sets the Reach and the credits side by side over a one-line caption; the player one row; the key column becomes a row along the plate's top when five keys do not fit. Measured at 844 × 390 in `shoot.mjs`: plate ≥ 220 px. |
| **Safe areas** | HOUSE §4.14 | Every band pads itself; the card and the ghost key under the top safe area in focus mode. Phone checks. |

**What does not apply, and why:** a units key (nothing is converted between systems in this pass;
owner call 2); layer words in the row (nineteen layers belong in a sheet); a color legend (no
quantity on the plate is read through a color scale; the stars' colors are explained in About);
an opening (none is needed: the sky itself arrives).

---

## 4. Type

- **The house file, byte for byte.** `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
  `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
  sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copied from
  `global-weather/fonts/`. The one `@font-face` rule exactly as HOUSE §2.5 gives it.
- **A supplement, as HOUSE §2.3 and D5 allow.** The data writes 32 characters the cut lacks, every
  one a data character (a scan of every shipped `.html`, `.js`, `.css` and data `.json` against the
  cut's character map, fontTools 4.60.2): the Greek small letters of the Bayer designations
  (U+03B1–03C9, in `data/stars/named.json`), the superscript figures ⁴–⁹ of `α¹ Cen`-style indices
  (U+2074–2079; ¹ ² ³ are in the cut) and the ʻokina of `ʻOumuamua` (U+02BB, in
  `data/smallbodies.json`). No capital Greek appears. File:
  `fonts/ysabeau-office-milky-way-extra.woff2`, **5 620 B**, sha256
  `efdeac3fc405906974460b62b3e3b0c606da4f87c80346b1c7d0c32ca068e42f`, 32 code points. **Recipe:**
  Global Weather's `tools/art/font_subset.py` calls unchanged (same pinned upstream, google/fonts
  commit `9710da1e…`, `YsabeauOffice[wght].ttf` 401 964 B sha256 `0f305c84…`; same features and
  options; weight axis 400–650; `recalcTimestamp = False`) with
  `UNICODES = 'U+02BB,U+03B1-03C9,U+2074-2079'`, writing only the supplement and never `OFL.txt`.
  Cut twice into a scratch folder: 5 620 B and the same sha256 both times, `cmp` identical. A second
  `@font-face` of the same family with `unicode-range: U+02BB, U+03B1-03C9, U+2074-2079`,
  `font-weight: 400 650; font-display: block`. Fonts total **45 695 B** (`cat fonts/* | wc -c` on a
  scratch copy).
- **Removed:** `atkinson-hyperlegible-latin-400-normal.woff2`, `…-700-normal.woff2`,
  `newsreader-latin-400-italic.woff2`, `newsreader-latin-500-normal.woff2` and their `OFL.txt`
  (87 680 B together, `cat fonts/* | wc -c`), the four `@font-face` rules, `--serif`, and every
  credit naming them (§8 item 17).
- **Characters not set:** the right and left arrows (only in code comments today; written as
  words), `ᵀ` (comments only). Ellipses are `…`.
- **The scale here:** name 15/650; stamp 11.5; scale words 12.5 (620 chosen); caption 11; the
  Reach's labels and the track's labels 10.5; credits 10.5; the date 21/600 (the one large figure);
  `UTC`, keys and lead 12.5; card name 15/650, card figure 21/600 with unit 13.5, rows 12.5 (values
  560); About title 15/650, heads 13.5/650, prose 13.5/1.5 within 62 ch; plate labels 11.5/560,
  11/400, 10.5/400 over the halo; notices 13.5; the search field 16 (owner call 12). The stock 34 px
  load title, 26 px serif `h1`, 24 px card and sheet titles, the uppercase tracked kickers and the
  italic serif source lines go.
- **Text waits for the face.** `document.fonts.load('560 11.5px "Ysabeau Office"')` before the
  first frame with labels and before `labels.js` measures; the width cache is cleared and the
  labels redrawn on `document.fonts`' `loadingdone`. Every font string in a script names
  `"Ysabeau Office"` first (`labels.js` measures with `700 11px Atkinson` today).
- **Credit line, word for word** (About, `NOTES.md`, `CREDITS.txt`): `Ysabeau Office by Christian
  Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.`

---

## 5. The camera's strings (HOUSE §7.4)

| String | Role | Verdict |
| --- | --- | --- |
| visible text containing `from the Sun` (the camera waits up to 240 s) | the caption line's first sentence, `You are 1.0 AU from the Sun; …` | **kept**. Written by the frame loop only after the data is in. No static text may contain the phrase: the canvas's description today says "zoom from a planet" and must keep avoiding it; the loading counter must not use it. |
| `Solar System` | the scale word, `<button aria-pressed>` | **kept**, moved from the foot to the header's row. |
| `Milky Way` (the lowest element so named, because the title reads Milky Way too) | the scale word | **kept**: the `h1` sits above the row, so the word is still the lowest element with that exact name. Nothing below the row may carry the exact name `Milky Way`, `Solar System` or `Neighborhood` (the Reach's labels are canvas text inside a `role="img"`; the Layers group heads and Find's kind labels live in sheets that are hidden while the camera taps). |
| the stock spelling of `Neighborhood` (with -our), tapped by the clip | the scale word | **replaced by `Neighborhood`** (D5 (3), US spelling). The lead changes `MarketingClipsUITests.swift` line 53, `milkyWayScale(…)`, in the same commit. |
| `Play`, at the Solar System scale | the transport's Play key, `Pause` while playing | **kept**; the player exists only at that scale, as today, and the camera taps `Solar System` first. |
| new: a remembered focus mode (`milkyway:focus`) | the ghost key `Show the controls` | **the lead adds the guard** to `waitForMilkyWay()` (`MarketingCameraCase.swift` 429–435), as `showWeatherControlsIfHidden()` does, in the same commit. |

Timings: the camera's waits (3 s after `Solar System`, 6 s and 7 s after the other two, 240 s for
the data) are not lengthened: flights keep their 900–3 200 ms and loading gains nothing.

---

## 6. Budgets

Measured on the working tree before the pass:

| | Today | Cap | Command |
| --- | --: | --: | --- |
| App code (every shipped `.html`, `.css`, `.js` outside `vendor/`, `data/`, `tools/`; 14 files) | 223 463 B | **223 463 B, held** (D5 (2): over the house's 200 000, held at its size; the pass trims what it adds). **After QA: 240 000 B**, the lead's ruling in `tools/DECISIONS.md` (owner call 1); 239 674 B after QA; **239 950 B after review, 50 B (0.02 %) to spare**. **After the follow-up: 242 000 B**, the lead's second ruling, for the zoom keys and the view offset; **241 813 B, 187 B (0.08 %) to spare**, so anything this app gains it pays for | `find . -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.mjs' \) -not -path './vendor/*' -not -path './data/*' -not -path './tools/*' -print0 \| xargs -0 wc -c` |
| Fonts | 87 680 B | 160 000 B; planned 45 695 B | `cat fonts/* \| wc -c` |
| ZIP, as `build-zips.yml` packs it (61 files after the pass, `node tools/check.mjs`) | 6 525 210 B | **8 156 512 B** (today × 1.25, HOUSE §8's table; D5's +37 834 B face allowance would give 8 194 346 B, but §8 grants none to an app that swaps its faces, and the tighter cap wins) | `zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`, then `wc -c` |

With the faces swapped and nothing else changed, the same command gives **6 483 234 B** (a scratch
copy). The ZIP has 1.67 MB of headroom; the code cap is the one that binds.

**The code ledger** (estimates for planning; the builder measures after every step and
`check.mjs` prints the truth):

| Change | Bytes |
| --- | --: |
| Freed: the stock stylesheet's glass, pills, dock, scrim, `input[type=range]`, switches, loading overlay and the two side-panel layouts (the house stylesheet replaces it: Global Weather's whole one is 18 348 B against today's 19 962 B) | −4 000 to −6 000 |
| Freed: `wantedShift()`, the view offset and the shift in `project()` (632 B for the function alone, `sed -n 362,374p app.js \| wc -c`, more with its uses) | −1 000 to −1 500 |
| Freed: `hud()`'s ruler and subtitle (2 092 B today, `sed -n 759,785p app.js \| wc -c`), replaced by the caption | −800 |
| Freed: `util.js`'s `fmt` … `fmtDays` (2 176 B) move into `js/units.js`; dead `fmtRuler`, `m3v`, `m3tv`, `v3`, `vset`, `vdist`, `RAD` and the unused `reduceMotion` import go | −2 900 |
| Freed: the loading overlay's markup and its progress bar code | −600 |
| Freed: the stock `timing` debug hook (the shoot measures frame times itself) | −400 |
| Added: `js/units.js` | +4 000 |
| Added: `js/track.js` (Global Weather's, adapted) | +5 500 |
| Added: `js/rule.js` (the Reach and its census) | +3 000 |
| Added: `js/plate.js` (`palette.py --json`, pasted), less the literals it replaces | +900 |
| Added: focus mode, sheets as dialogs, About's sections, the live region, the card's placement, zoom keys, the face wait | +4 500 |
| Added: `index.html` restructured | +1 500 |

The middle of those ranges lands about 6 000 B over the held cap. **The builder trims, in this
order, until the code is at or under 223 463 B:** (1) share one canvas helper between `rule.js` and
`track.js` (DPR setup, baseline, ticks, colliding labels); (2) write the stylesheet for this app
only, with nothing of Global Weather's map, legend-gradient or globe rules; (3) build About's
section 2 from one table of `[label, value]` pairs; (4) drop the zoom keys (the scale words and
Find still give a way to move without a pinch). **Never minify and never strip comments.** If the
code is still over after (4), the builder stops and reports the figure: owner call 1.

---

## 7. The generated-page tells, answered

| Tell | Milky Way |
| --- | --- |
| 1. Warm cream ground, high-contrast serif display, terracotta accent | The chrome's ground is the house film base `#e8eef0` (cool, h 220). The stock Newsreader serif title and the gold `--accent` go; one Renaissance sans at every size. Warm hues on screen are data (the Sun, the cluster category, the masers' arm fit). |
| 2. Near-black ground with one acid-green or vermilion accent | The plate is space, `#020308`, because it is space, not a dark theme; the chrome's dark page is the house slate at L 0.224. No accent: the host rings' green is a data category, measured and paired. |
| 3. Broadsheet hairlines, zero radius, dense columns | One column; hairlines only between About's sections, key plates and the player's top. Radii 6, 8 and 4 px by role. |
| 4. SaaS-card kit, one radius, soft shadow, gradient washes | The stock frosted cards, 14–18 px radii, the card's long shadow and the dock's gradient scrim go. One card (the selected object), one sheet at a time. No gradient but the selection tracer. |
| 5. All-caps tracked eyebrow labels | The stock `PLANET` kicker and the uppercase gold About and Layers heads (`letter-spacing: .08em`) go: sentence case, letter-spacing 0. |
| 6. Meta strings joined with middle dots | The stock subtitle (`Saturn · 1 Oct 2026`), `· fit`, `Satellite · galaxy candidate`, `8.44 AU · 70.2 light-minutes`, the exoplanet lines and About's owner and license lines all become commas, parentheses or one value per line. The credit line uses commas. |
| 7. "WORD — fragment" with a spaced em dash | The layer descriptions (`Poggio et al. 2021 — where young stars crowd`) and the Venus card's `Surface: none drawn — a plain disc` become sentences. |
| 8. A tinted near-black standing in for black | The chrome's dark page is the house slate. The plate's `#020308` is the stock renderer's clear color for space, stated as the plate's ground, and nothing in the chrome uses it. |
| 9. Monospace for small data labels | None. Tabular figures from the one face. |
| 10. An arrow appended to buttons | None in text; the comments' arrows become words. Buttons say what they do: `Fly there`, `Show orbit`, `Hide the controls`. |
| 11. One accented word in a headline | None. |
| 12. Unnecessary labels above content | The kicker above the card's name goes; the kind sits on the line with ✕, the name is the heading. Nothing else is labeled from above. |
| 13. Numbered markers | None. |
| 14. Big number, small label, gradient accent | One large figure, the date (21 px), and the card's distance; no gradient. The stock 26 px and 34 px titles go. |
| 15. Scattered fade-and-slide entrances, hover on every card | The stock card's 12 px rise, the sheets' slide-in from the side and the overlay's fade go; the house's three small transitions answer a touch. The one continuous motion is the sky itself. |

The interface guidelines, where the house writes its own rule: sentence case (`Hide the
controls`); dates by hand, not `Intl`; `font-display: block`; `translate="no"` on the name and on
catalog designations; `…` never `...`; `<button>` for every action (Find's result rows become
buttons); the viewport loses `user-scalable=no`; `<html lang="en-US">`.

---

## 8. The change list (the builder applies these in order)

Nothing in `data/`, `vendor/`, the pipeline's logic or `screenshots/app.png` changes. Before step 1,
record the sha256 of every one of the 33 files in `data/` (their combined digest today:
`find data -type f | sort | xargs shasum -a 256 | shasum -a 256` gives `a9c72c12…07d4a1`) and of
`vendor/three.core.js` (`9edde002…`) and `vendor/three.module.js` (`90520426…`); `check.mjs` pins
them.

1. **`fonts/`**: delete the four Atkinson and Newsreader files and `fonts/OFL.txt`; copy
   `global-weather/fonts/ysabeau-office-gw.woff2` and `global-weather/fonts/OFL.txt` byte for byte;
   write `tools/art/font_extra.py` (Global Weather's recipe, §4's `UNICODES`, writing only
   `fonts/ysabeau-office-milky-way-extra.woff2`, printing its size and sha256) and run it twice in
   a venv with fonttools 4.60.2 and Brotli (the pinned upstream is cached at
   `global-weather/tools/.work/font/YsabeauOffice-var.ttf`, sha256 `0f305c84…`); expect 5 620 B
   and `efdeac3f…e42f` both times.
2. **`js/plate.js`**: `export const PLATE = ` + `python3 milky-way/tools/art/palette.py --json`
   pasted, with a two-line comment naming the command.
3. **`js/units.js`**: the one writer of numbers, units and dates, on Global Weather's pattern:
   U+2212 for negatives (never −0.0), U+202F between number and unit and in thousands from four
   digits (years, clock times, catalog numbers like `NGC 5139` and `HIP 71683` never grouped),
   three significant figures as the stock `sig()`; distances km below 10⁶ km, AU below 20 000 AU,
   pc below 1 000 pc, kpc below 1 000 kpc, Mpc beyond, and light-years as a second figure where
   the card asks; durations in h below 2 d, d below 800 d, then years in words; dates
   `1 Oct 2026`, `16:03`, `23 Sep 2026`; spans `in 3 y`, `12 y ago`; the spoken forms
   (`astronomical units`, `parsecs`, `kiloparsecs`, `kilometers`, `light-years`). The stock
   `fmt`, `sig`, `fmtAU`, `fmtLightTime`, `fmtDays` move here; `fmtRuler` and the dead vector
   helpers leave `util.js`.
4. **`styles.css`**: rewritten as the house stylesheet for this app: the §3.1 tokens in both
   themes and `color-scheme`, `html, body { background: var(--page) }`, `--face` only, the two
   `@font-face` rules, the plate tokens of §2, the column frame, header, row and tracer, key
   column and states, caption band, player, track, card, sheets, notices, ghost key, labels on
   their halos, landscape at `(orientation: landscape) and (max-height: 500px)`, gutters 20 px from
   700 px, `@media (prefers-reduced-motion: reduce)` zeroing every duration, `@media (hover:
   hover)` hovers, `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` on
   controls. No `box-shadow`, `backdrop-filter`, `text-shadow` (but item 9's fallback, if needed),
   `transition: all`, uppercase or letter-spacing; `.valid, .lead, .track, .track canvas`
   carry `transition: none; animation: none`.
5. **`index.html`**: `lang="en-US"`; the viewport without `user-scalable=no`; `<meta
   name="color-scheme" content="light dark">`; two `theme-color` metas carrying each theme's
   `--page`; the column (header with `h1`, stamp and the three scale words; the plate with the
   canvas, the labels layer, the key column, the card, the notice and the ghost key; the caption
   band with the Reach's canvas, the caption, the stamp's focus-mode slot and the credits; the
   player); the three sheets as dialogs; the live region. The canvas's description in US spelling
   and without `from the Sun`. The stock loading overlay goes.
6. **`app.js`, the frame**: create the renderer and start loading as today; drive the stamp's
   counter from the stock `progress()` phases (`Reading the ephemeris… 1 of 6` …); `fail()` writes
   the notice; `ResizeObserver` on the plate and the held angular scale of §3; delete `wantedShift`,
   the view offset and the shift in `project()`; keep `window.__mw` (add `shown`, `wanted`, `focus`
   and the census for the tests; drop `timing`).
7. **`js/track.js`** and the player (§3): the year of days, the scrub rule, play on the clock,
   Reduce Motion jumps, About and the other sheets holding play, a touch during play landing on
   its day, the speed and `Now` keys, the year keys with their stock disabled states.
8. **`js/rule.js`**, the Reach (§1): a pure census function (sorted log distances in, a column mask
   out) the decode test can call, and the drawing. The caption's two sentences in `app.js`.
9. **`js/labels.js`** and the label styles: the face and its wait, widths measured in it, the
   halo, the neutral or category point marks from `PLATE`, the selected label's tracer. Candidate
   colors in `app.js` (`'#bcd4ff'`, `'#cfd7e2'`, `'#ffe2a8'`, `'#ffffff'`, `'#e6cfa8'`,
   `'#ff8fa3'`, `'#ffd27a'`, `'#f2c56f'`) come from `PLATE`.
10. **The plate's colors** from `PLATE`: `js/solar.js` (`UI_COLOUR` becomes the neutral for every
    body's orbit, trail and marker; `KIND_COLOUR`'s ten classes become the four groups through
    `PLATE.smallGroups`; the moon orbits' `#9aa6b8`), `js/stars.js` (the figures'
    `[0.45, 0.62, 0.95]` and the host rings' `[0.45, 0.95, 0.75]` at 0.32 become the neutral at
    0.275 and the host color at 0.60), `js/galaxy.js` (Reid, Drimmel, streams at 0.26 and 0.16,
    clusters, satellites, the Sun's and the center's marks). Shaders, the stars' colors, textures
    and the three display tints are not touched.
11. **The card** (§3): top-left, 280 px, its fields, its placement rule, its text keys, the one
    figure; facts' strings through `units.js`; the live sentence.
12. **The sheets**: About, Find and Layers as dialogs (focus held and returned, Escape, `Close`
    twice), Find's rows as buttons, Layers' drawn keys.
13. **Focus mode** (§3), with `milkyway:focus`, the ghost key, Escape, the two sentences and the
    held angular scale.
14. **Motion**: a touch during a flight completes it (`js/view.js`, the one change there); the
    stock card and sheet keyframes go; Reduce Motion as §3.
15. **Words**: US spelling in every shipped file, comments included (`center`, `color`, `gray`,
    `catalog`, `kilometer`, `normalize`, `neighborhood`, `disk`), except the data's own names
    and keys, which keep their British spelling (the stars' color file and its index field, the
    textures' color table, the license key) and text read from the data; `Galactic center`, `Disk and bar model`, `Catalog` in the card; no middle dot,
    no spaced em dash, no `~` for "about", no arrow characters in comments; SI through `units.js` everywhere
    (the layer descriptions' counts, the card's rows, the search's empty sentence).
16. **About** (§3): the four sections; about.json's dataset blocks rendered field by field; the
    two stock blocks it no longer matches not rendered.
17. **Credits and the pipeline's content strings** (the only pipeline file touched, and only its
    text): in `tools/90_about.py`, `SOFTWARE['owner']` becomes `three.js authors; Christian
    Thalmann (Catharsis Fonts)`, the `SOFTWARE` entry for the license `three.js r186: MIT. Ysabeau Office: SIL
    Open Font License 1.1`, `SOFTWARE['source']` names vendor/ as today and then the house credit
    line and the supplement; the CREDITS fonts paragraph quotes the face's own copyright line whole, `Copyright
    2023 The Ysabeau Project Authors` followed by the project's address in parentheses, as name ID 0
    of the shipped file gives it (fontTools); `READING`'s `reading-sizes` drops the ruler sentence. Then
    `CREDITS.txt`'s `SOFTWARE AND FONTS` section (lines 1111–1118 today) is edited by hand to
    exactly what the edited script writes there (`textwrap.fill(…, 98)`), the rest of the file
    untouched. `data/about.json` stays byte-identical (the brief: data files do not change); the
    app does not render its two stale blocks, and the next pipeline run writes them anew (owner
    call 8). The pipeline is not run.
18. **`miniapp.json`**: name, entry, schema and version unchanged; the description in US English
    and at most 200 characters (343 today), for instance `The Solar System, the stars around the
    Sun and the Milky Way in one 3D zoom, from real data only: JPL planets from 1900 to 2099, Gaia
    stars in 3D, and the galaxy as measured. Offline.` (183).
19. **`NOTES.md`**: US English; the code map gains `units.js`, `track.js`, `rule.js`, `plate.js`;
    "Using it" describes the header's words, the key column, the Reach, focus mode and the card;
    the folder list names the face and the supplement with its recipe, code points and sha256; the
    house credit line; the tools section names `check.mjs`, `shoot.mjs`, `test_decode.mjs`,
    `palette.py` and `font_extra.py`.
20. **`tools/check.mjs`** (HOUSE §7.1, all seventeen, for this app): the ZIP's limits; no scheme in
    shipped `.html`/`.css`/`.js` (`vendor/` pinned by sha256 instead); relative references present;
    `fonts/` exactly the house pair and the supplement, three sha256 pins; the 33 data files and
    two vendor files pinned; `miniapp.json`; the vendor-name list copied from Global Weather's
    `check.mjs` as ROT13, never decoded into a source file, with data words that collide
    allow-listed by file and word (a constellation's name in `data/stars/constellations.json`);
    `CREDITS` byte for byte; the camera's strings with their roles (the caption's `You are` …
    `from the Sun` written by the frame loop, the three scale words as `<button>`s, `Play`,
    `Show the controls`, `Hide the controls`), every `localStorage` key under `milkyway:` and
    today's `layers`, `speed` and `camera` still read; SI; nothing that carries a step
    transitions; innerHTML: no new uses, every value in the touched ones escaped (`escapeHtml`
    stays), no `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval`, `new Function`;
    `js/plate.js` equals `palette.py --json` and `palette.py` prints `ALL CHECKS PASS`; the tells
    (the house's greps, plus `text-shadow` outside the labels' fallback); budgets as §6; US
    spelling over every shipped text file except `data/` and `CREDITS.txt` (pipeline outputs
    quoting their sources), with the data names of item 15 allowed.
21. **`tools/shoot.mjs`** (HOUSE §7.2): the stock scenes (solar, inner, earth, moon, jupiter,
    saturn, mars, play, stars, orion, galaxy, edge, search) kept as the picture set in both themes,
    plus every check of §7.2 that a 3D view with time carries: boot and the camera's strings; text
    contrast on the chrome; for plate labels, a screenshot sampler comparing each placed label's
    brightest glyph pixels with its halo ring (90 % at 4.5:1 or more, the lowest printed); the
    signature sampler over the Reach's pixels against `--page`; the SI scan; the card against the
    script's own decode (the planets' distances from `data/ephem.bin` read and evaluated in the
    script); the three-speed scrub by real touch with drawn = wanted = the day under the finger;
    play, its mark, About holding it, a touch landing; the plate holding still while the caption
    changes; focus mode end to end; hidden; hit targets ≥ 44 × 44; About; Reduce Motion; broken
    data (`data/physical.json` missing, not JSON, short; a sentence each); widths 320, 360, 375,
    844 × 390 and 125 % zoom. Console warnings fail the run, except the exact headless message
    `GPU stall due to ReadPixels`, allow-listed by its text (the stock run printed it four times
    while taking screenshots). Frame times are printed as headless figures.
    `screenshots/app.png` is never written and its sha256 (`7981ec84…`) is checked unchanged.
22. **`tools/test_decode.mjs`** (HOUSE §7.3), Node with no dependencies and no `tools/.cache/`:
    decodes `stars/deep.bin` (int16 × 3 / 64, the two codes), `stars/named.json`,
    `galaxy/galaxy.json` and the small bodies' elements with formulas written in the test,
    computes the census, and compares `js/rule.js`'s census with it column by column; and pins the
    decoders unchanged: positions from `js/ephem.js`, `js/smallbodies.js` and `js/galaxydata.js`
    at three fixed epochs, recorded before step 1 and written into the test as constants. The
    stock `test_*.mjs` stay; they need `tools/.cache/`, which this machine does not have, so the
    report says they were not run.
23. **`tools/DECISIONS.md`**: the owner calls below with what each was chosen over, the camera
    change list for the lead (§5), the budget figures before and after, the phone checks, and the
    review record as it comes.

---

## 9. Owner calls left open

1. **The code cap.** If §6's four trims still leave the code over 223 463 B, a raised cap and its
   reason (Global Weather's was raised 1.5 % for its coast).
2. **A units key** (pc and AU, or light-years) in the header. Not in this pass: distances are in
   km, AU, pc and kpc, with light-years as the card's second figure for stars and galaxy objects.
3. **The Sun's glow and the points' soft halo** kept as the plate's documented display effects
   (about.json's `reading-glow` says so), against the house's no-glow rule read strictly.
4. **Small bodies in four orbit groups** instead of ten class colors.
5. **Neutral orbits, trails and markers** instead of a hue per planet.
6. **The on-screen credit line's names.**
7. **The speed key written as exposures** (`1 s = 7 d`) instead of words (`1 week a second`).
8. **`data/about.json` keeps its two stale blocks** (the dropped faces, the stock ruler) until the
   next pipeline run, with `tools/90_about.py`'s text already corrected and the app not rendering
   them; the alternative is regenerating the file in this pass, which needs the pipeline's cache.
9. **The plate stays night in the light theme** (space has one appearance), against a star chart
   printed as its own negative.
10. **Focus mode hides the Reach** with the legend slot, as the house says; the alternative keeps it.
11. **The caption is three lines high below 640 px** (Global Weather's is two), to hold the view's
    sentence and the Reach's at 320 px.
12. **The search field at 16 px**, the one size off the type scale, so iOS does not zoom into it.

**Phone checks for the device matrix** (none claimed): frame time idle, flying, playing and
scrubbing; memory after five minutes; background and return; focus mode in Snuggery's full screen
with the ghost key and Snuggery's own exit control both reachable in the top-right corner; the
labels' halo (`paint-order` on HTML text in WebKit); VoiceOver on the track, the Reach, a tap and
the sheets; the phone on its side; the safe areas of every band.

---

## After QA (2026-10-01)

What changed after QA's report, each run with what it printed (the full record is in
`tools/DECISIONS.md` section 8):

- **The code cap is 240 000 B**, the lead's ruling (owner call 1, §6). `check.mjs` item 16 says so:
  `ok app code 239,674 bytes (cap 240,000, …; 326 to spare)`.
- **One SI fix in the app:** the Drimmel arm fit's note read `0.9 kpc` with a plain space; it is
  `0.9\u202Fkpc` (`app.js`, the arm-fit card's note).
- **`check.mjs`'s SI scan skips shader source**: the template literals `js/gfx.js` tags
  `/* glsl */` are dropped before the scan, so `vec2 d` no longer reads as "2 d". With the note's
  plain space put back, the scan still fails on exactly that string.
- **The time row is 44 px tall** (was 28 px of row in 32 px with padding). The speed key's hit area
  ended where the track begins, because the track, a later positioned sibling, paints over it: it
  measured 63 × 35.5 px. Now it is 44 px, and so is `Now`'s, which the track had also been covering
  by 8 px unseen (its box was 44 px, so the probe never ran). `shoot.mjs` now probes every control's
  hit area even when its box is 44 px. The plate is 12 px shorter at the Solar System scale.
- **`shoot.mjs`'s play check needs 12 drawn frames in 3 s, not 60**: the count was a frame rate,
  and HOUSE §7.2 fails nothing on a frame time; SwiftShader draws this scene at about 9 a second.
  The touch-during-play check reads the state at the end of the next animation frame instead of
  after a fixed 120 ms, which at about 113 ms a frame could read before the touched day was drawn.
- **British spellings in About** (owner call 15, new): `data/about.json` is pipeline output and
  stays byte for byte, and About shows its prose verbatim, so its British spellings (91 counted by
  `check.mjs`, which now prints the count instead of exempting `data/` silently) stay on screen
  until the pipeline runs again. `tools/90_about.py`'s own blocks (the intro, the reading blocks,
  "What this app does not show") are now US English; the dataset blocks' text comes from the other
  pipeline scripts and is not yet.


---

## After review (2026-10-01)

The reviewer's must and shoulds, as built (each with its command and output in `tools/DECISIONS.md`
section 8, "Review, and the fixes"):

- **The bottom safe area.** At the Neighborhood and Milky Way scales the player is hidden and the
  caption band is the last band, so it now pads itself for the home indicator:
  `.caption:has(+ [hidden])` adds `env(safe-area-inset-bottom)` (HOUSE §4.14). `shoot.mjs` checks
  the rule applies exactly when the player has gone; the inset itself is a phone check.
- **The Reach is the day shown's.** Its Solar System part is taken again whenever a frame draws
  another day, the finger on the track included, reusing the small bodies' positions when the frame
  has just placed them for the same instant; the stars', clusters', satellites' and streams' columns
  are worked out once per canvas width (`js/rule.js`), so a new day costs the Solar System's ten
  thousand distances, not the 230 000. `shoot.mjs` sets 30 Dec and 2 Jan of one year and finds the
  census taken at the instant shown both times, 0 columns off its own decode.
- **Focus mode's caption** no longer describes the Reach, which has gone with the legend slot
  (owner call 10 stands: focus mode hides it).
- **The card.** Its height is at most 34 % of the plate (at least 144 px), its `Fly there` and
  `Show orbit` keys are held at its foot while its rows scroll, and its placement counts a globe's
  disk, not only its center. At 390 × 844 the card for Saturn, Jupiter and the Earth, each flown to,
  leaves the whole disk clear (`shoot.mjs`, the disk worked out from `data/physical.json`). Saturn's
  rings reach past the disk and the card can still cover their ends. The trade: on a 375 × 667
  phone the floor wins and the card covers about 12 px of the disk's lower edge; a view offset (the
  stock `wantedShift`) would clear it at every size but costs about 500 B the cap does not have.
- **Venus is labeled again.** The Solar System scale frames the inner planets at about 120 px to
  the AU on the plate's shorter side (`3.2 × pxPerRad / min(W, H)`, 4.80 AU on a 390 × 844 phone
  where the stock look's 7.5 AU on a taller canvas gave the same scale), and the Sun's label, when
  it steps off the glow, is drawn without its point mark, which would sit where the Sun is not.
- **About no longer scrolls sideways**: its paragraphs wrap anywhere (the sha256 lines).
- **`js/units.js` rounds first**: the figures and the unit come from the rounded value, so 99.99 is
  `100`, 999.96 pc is `1.00 kpc` and 1.999 d is `2.00 d`; ten boundary cases in `test_decode.mjs`.
- **The speed key's name carries its visible words**, `Playback speed, now 1 s = 7 d`, described
  `7 days a second` (WCAG 2.5.3, as Global Wind's `Speed colors`).
- **The Layers mark** is three flat planes stacked, no longer a Wi-Fi glyph.
- **The small bodies' colors have a key**: the Layers row says `colored by orbit: orange near the
  Earth and Mars, pale in the belt, blue beyond Jupiter, cyan for comets`. About still shows
  `data/about.json`'s `reading-glow` sentence that marker colors "are not data"; the pipeline's text
  (`tools/90_about.py`) now says what they are, and the data refresh that writes it is owner call 17.
- **Nits taken:** the exoplanet host rings are a guide at 0.35 (2.34:1 on space, `palette.py`); one
  formatter writes the year spans and one count the stars placed in 3D, in Layers, About and the
  moons' card note; with a data file missing, the scale words, the key column and the player leave
  with the data; Find focuses its field inside the tap and drops the native search look; the 3D
  canvas has `role="img"`.
- **Not taken, with the reason:** the zoom keys (owner call 13, restated in `tools/DECISIONS.md`
  with the accessibility consequence: about 430 B against 50 B of headroom); a `you` at the notch
  (bytes; the caption's first sentence and About name the notch); caching the label layer's four
  rectangles (bytes; a frame-time phone check instead).
- **Paid for, with no function removed:** an unused test hook (`stats`), one vertex shader shared by
  the galaxy's two flat layers, one fetch helper for both readers, the card's and Find's kind words
  written once, the canvas helpers `rule.js` now takes from `track.js` (ART's trim 1, in part),
  `solar.js` and `stars.js` fields nothing read, a dead label opacity, the `CAT` table inlined.

**Budget after review:** app code **239 950 B** of 240 000 (50 B, 0.02 %, to spare: anything more
pays for itself); fonts 45 695 B; the ZIP as `node tools/check.mjs` prints it.

---

## After the follow-up (2026-10-01)

The items the pass left for the lead, as built (each with its command and output in
`tools/DECISIONS.md` section 9):

- **The zoom keys are back** (owner call 13): `Zoom in` and `Zoom out` head the column's first
  plate, above Find and Layers, one plate rather than §3's two so the column fits the 255 px plate
  of a 320 × 568 screen. Each press is the double-tap's zoom, about ×2.8; under Reduce Motion one
  step at once.
- **The view shifts a globe flown to clear of its card** (owner call 16): with the card open on
  the object the camera is aimed at, the picture moves it to the middle of the plate the card
  leaves free, below the card upright and to its right on a wide plate (the stock `wantedShift`,
  fitted to this layout). Saturn's disk and rings stay whole at 390 × 844 and 375 × 667, and the
  disk at 320 × 568 and on its side.
- **Flights pull back while the target moves** (the bug on record, plan 0011 D8): the old path slid
  the target along the galaxy's disk while the camera was a few tens of parsecs from it, so it
  skimmed the young-star map, which lies flat at the Sun's own height, and one of its 0.1 kpc cells
  filled the screen with blue (the phone's recording, frames 2532–2536). The path is now van Wijk
  and Nuij's; the durations are unchanged, so the camera's waits stand. On the way out the screen
  shows what a pinch shows (the deep catalog's 500 pc ball, the young-star maps in patches, the
  arm fits, the model), and a flight to the Earth keeps the Earth in view all the way, with no
  black middle.
- **Crowded inner planets keep their names**: important labels may also sit a label's height
  further above or below, without the dot.
- **Smaller things**: the year spans read 1900 to 2099 and 1950 to 2049, as the app computes them;
  Find's field has no browser cross; after a load failure the stamp is inert.
- **The pipeline's prose is US English** (owner calls 8, 15, 17): see `tools/DECISIONS.md` section 9
  for the rebuild and its proof that only prose changed.

