# Warming World — art direction

Written on 2026-09-30, before any app code, for the builders. `DESIGN.md` says what the app does;
this file says how it looks, moves and speaks. The change list at the end says what that changes in
`DESIGN.md`, and those changes are already made there, so the two agree. Every contrast figure and
byte count below names the command that printed it. The pictures referred to are in `tools/art/`:
`study-light.png` (2025 over the North Pacific, the Fairbanks card open), `study-1880.png` (1880
over the Atlantic) and `study-focus-dark.png` (focus mode on the partial year). They are drawn from
**real frames and GISS's real table** (see "The study" below).

---

## The look: Gray Card

A photographer puts a gray card in the frame so that every color can be judged against a known
neutral. This app has one known neutral too: the 1951–1980 average, the zero every number departs
from (or the span a person chooses as Base, plan 0012). So the whole interface is built from that
neutral.

- **Every chrome surface is an exact gray.** It has chroma 0, with no blue bias, no warmth and no
  accent. In an app where blue means colder and red means warmer, any tint in the chrome would be
  read as a temperature. So **a hue on screen is always a measurement**, and never decoration: in
  Difference a departure from the baseline in use (1951–1980 unless Base chooses another span), in
  Absolute an estimated temperature on its own scale (below, "The temperature ramp").
- **The globe sits on a gray card**, a full-width band of mid-gray, in the light theme as well as the
  dark. It is not night and not space. On a white page the near-white "normal" cells would vanish,
  and on black they would glow brighter than the anomalies. On the card the 0 °C cells read as quiet
  paper, the departures read as ink, and the hatched no-data cells read as darker than the card. The
  eye goes to the departures, which is where it should go.
- **The stripes are an instrument, not a poster.** The world knows the warming stripes as a picture
  with no words. Here they are the scrubber, and like any instrument they are framed, graduated,
  labeled with their scale, and marked with the 30 years that define their zero. The open stripe at
  the end is the year that is not finished.
- **One bold object:** the stripes track. The globe is the subject, and everything else stays quiet.

**How it differs from the two apps before it** (it must not copy either):

| | Earth's History, "Deep Field Atlas" | US Quakes, "Drum Record" | Warming World, "Gray Card" |
| --- | --- | --- | --- |
| Metaphor | an atlas plate photographed at night | a seismograph's drum record | a neutral reference card |
| The view's ground | night in both themes, a neatline | paper; the map edge to edge | a mid-gray band in both themes (light `#bebebe`, dark `#303030`) |
| Type | Newsreader serif + Atkinson | Atkinson + Red Hat Mono | **Archivo** only, one variable file (weight 400–700, width 87.5–100) |
| Accent | survey blue | none; ink, with a blue-gray paper | none, and the grays have chroma exactly 0 |
| Signature control | the ICS color bar | the record strip of ink stems | the stripes, framed and graduated, with the zero's 30 years bracketed |
| Opening | 750 million years in 5 s | the last 30 days written onto the paper | 1880 to now at 8 a second, with the stripes written behind the thumb |
| Motion | an eased settle | critically damped | a turn with weight for the globe; a short settle for the paper; numbers never count |

---

## Type: Archivo, one file

**Archivo** (Héctor Gatti and the Omnibus-Type team, SIL OFL 1.1, **no Reserved Font Name**: the
copyright line in google/fonts' `OFL.txt` names none). google/fonts describes it as "a grotesque
sans serif typeface family originally designed for highlights and headlines … reminiscent of late
nineteenth century American typefaces". The record starts in 1880, so that is the right era, but it
is not why Archivo was chosen. It was chosen for four measured reasons:

1. **A plain zero.** This app prints years all the time: 1880, 1900, 1951–1980, 2000. Atkinson
   Hyperlegible's slashed zero turns them into "188Ø" and "2ØØØ", which the type specimen made
   obvious (both previous apps flagged that zero). fontTools counted the contours of `zero`:
   Atkinson 3, Atkinson Hyperlegible Next 3 (so the 2025 successor slashes it too), Archivo 2.
2. **Tabular figures (`tnum`), a true minus (U+2212), a degree sign, a thin space and both
   inequality signs (≤ ≥)** in the font, so the legend's end caps do not fall back to the system
   face.
3. **A width axis.** Labels, ticks, the year and the switches are set at width 87.5 % (semi-
   condensed). That keeps them compact without shrinking the type: the owner wants restrained type,
   not small type. Prose stays at 100 %.
4. **No Reserved Font Name.** That means the subset may keep its name (see "Rejected" below for the
   faces that failed this test).

| Role | Setting | Where |
| --- | --- | --- |
| Year | 600, 28 px / 1, width 87.5 %, tabular, −0.01 em | the year row: the app's one large figure |
| Card value | 600, 22 px, width 87.5 % | `+2.5 °C` in the tap card |
| Focus step name | 600, 20 px, width 87.5 % | the controls row in focus mode |
| App name | 650, 14 px, width 87.5 % | "Warming World" in the top bar |
| Body | 400, 13.5 px / 1.45, width 100 % | About's prose, at most 62 ch |
| Section heads | 600, 14 px, sentence case | About's sections. No capitals, no small capitals, no tracking |
| Readouts | 400, 12 px / 1.4, values in 600 | the year row's right column, the card's place line |
| Controls | 400, 12 px, width 87.5 %; 650 when on | the switches, Arctic, Antarctic, About |
| Instrument labels | 400, 10.5 px, width 87.5 %, tabular | the stripes' caption and ticks, the legend, the chart's axes, the notices |
| Fine print | 400, 10.5 px, `--ink-3` | the card's footnote, the credit line |

The scale is **10.5 / 12 / 13.5 / 14 / 20 / 22 / 28 px**. Every number is tabular
(`font-variant-numeric: tabular-nums lining-nums` on `body`), so the year and the global mean do not
shift sideways as they change. Nothing is set in capitals, and no label sits above a heading.

**Canvas text must wait for the face.** The study's first focus-mode shot drew the track's labels
in the browser's default serif, because the canvas drew before the font arrived. So the app awaits
`document.fonts.load('400 12px Archivo')` and `'600 12px Archivo'` before its first canvas text, and
redraws the track, the legend and the labels on `document.fonts`' `loadingdone`. `shoot.mjs` checks
that the face is `loaded` before any picture is taken.

**The file** (`fonts/`, vendored now):

| File | Bytes | From |
| --- | --: | --- |
| `archivo-ww.woff2` | 62 536 | `tools/art/font_subset.py`: google/fonts commit `95f4904f…` (2026-03-03), `ofl/archivo/Archivo[wdth,wght].ttf` (658 596 B, sha256 `0e094a7d…`), axes cut to weight 400–700 and width 87.5–100, characters Basic Latin, Latin-1, Latin Extended-A, ș ț, dashes, quotes, the ellipsis, primes, ‹ ›, the thin space, − ≤ ≥ |
| `OFL.txt` | 4 666 | upstream `OFL.txt` (sha256 `108b4e57…`), headed by a note naming the file, the commit and the cut |

That totals **67 202 bytes** (`cat fonts/*.woff2 fonts/OFL.txt | wc -c`). Two runs of
`font_subset.py` were byte-identical (`cmp`). Coverage was checked with fontTools on the cut. It
holds every character outside Latin-1 in Natural Earth's 1 251 place names (ă ġ İ ń Ō ō ş ș ț,
which include Utqiaġvik, Alaska's northernmost town, on the Arctic coast). It does **not** hold U+202F,
the narrow no-break space, and neither did any face tried, so the browser takes that one space from
the system face, as in US Quakes. ✕, ‹, ▶ and ❚❚ are drawn as inline SVG, never as text.

`@font-face`: one rule, `font-family: Archivo; src: url(fonts/archivo-ww.woff2) format('woff2');
font-weight: 400 700; font-stretch: 87.5% 100%; font-display: block` (the file is local, so there is
no network wait to hide). The fallback is `system-ui, -apple-system, sans-serif`.

**Rejected, with the reason** (specimens rendered at 390 px from the Fontsource 5.3.0 packages;
`fontTools` on each `latin-400` file):

| Face | Why not |
| --- | --- |
| Atkinson Hyperlegible (house) | Its slashed zero makes every year read "188Ø". It stays the voice of the two other apps. |
| Atkinson Hyperlegible Next | The same slashed zero (3 contours). |
| Newsreader | Earth's History's voice, and a serif display face with a red ramp is the "cream + serif + terracotta" tell. |
| Red Hat Mono, or any mono | US Quakes' voice, and monospace for small data labels is on the tell list. |
| Source Sans 3 | "with Reserved Font Name 'Source'" (its name ID 0), so a subset could not keep the name. |
| Public Sans | It is the US government's own web face (USWDS). On NASA data it would suggest an official site, which the endorsement rule forbids. |
| Libre Franklin | Franklin is the house face of one newspaper's climate graphics. Warming World would read as a copy of them. |
| Overpass | It carries Highway Gothic's road-sign voice, which belongs to the US Federal Highway Administration's lettering, not to a measurement. |
| Inria Sans | A close second, humanist and well made. Its bold figures are mannered at 28 px, and it has no width axis. |

---

## Palette

### Chrome: exact grays

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--page` | `#f5f5f5` | `#1f1f1f` | the page: top bar, year row, stripes row, controls, About |
| `--card` | `#bebebe` | `#303030` | the Earth panel's band, the ground of the globe and the map |
| `--sheet` | `#f5f5f5` | `#262626` | the tap card, notices and About's panel, laid on the card |
| `--ink` | `#161616` | `#ededed` | text, the thumb, focus rings, the "on" underline |
| `--ink-2` | `#4f4f4f` | `#ababab` | secondary text, tick labels |
| `--ink-3` | `#666666` | `#8e8e8e` | fine print, the chart's axes and its global-mean line |
| `--card-ink` | `#121212` | `#f0f0f0` | text and keys on the card, the globe's limb |
| `--card-ink-2` | `#333333` | `#c4c4c4` | the card's unselected keys, the legend's caption |
| `--line` | `#d9d9d9` | `#393939` | hairlines |
| `--line-strong` | `#8a8a8a` | `#6b6b6b` | the stripes track's frame, the tap card's edge, the switches' base rule |

The light page is not cream: it is `#f5f5f5`, chroma 0. The dark page is not near-black: it is
`#1f1f1f` (OKLab L 0.239), a graphite that leaves room for a darker shadow and a lighter card.

### Contrast (WCAG 2), measured

`python3 tools/art/contrast.py` computes these from the hex values. `shoot.mjs` measures them
again on the rendered text styles (≥ 4.5:1), as Earth's History's and US Quakes' do.

| Pair | Light | Dark |
| --- | --: | --: |
| `--ink` on `--page` | 16.60 | 14.08 |
| `--ink-2` on `--page` | 7.51 | 7.18 |
| `--ink-3` on `--page` | 5.27 | 5.03 |
| `--ink` / `--ink-2` / `--ink-3` on `--sheet` | 16.60 / 7.51 / 5.27 | 12.93 / 6.59 / **4.62** |
| `--card-ink` / `--card-ink-2` on `--card` | 10.08 / 6.80 | 11.58 / 7.57 |
| `--line-strong` on `--page` (the track's frame; non-text ≥ 3) | 3.17 | 3.09 |
| Highest chroma of any chrome token (OKLCh C) | 0.0000 | 0.0000 |

The lowest text pair is dark `--ink-3` on `--sheet` at **4.62**. It is used only for the card's
footnote and the chart's axis numbers.

**DESIGN §7.4's constraints on the ground, measured:** OKLab L of the card is 0.802 (light) and 0.309
(dark). Against the 0 °C color (L 0.965) that is a difference of 0.163 and 0.655, where at least 0.15
is required. Against the nearer hatch gray (0.60 / 0.68) it is 0.122 and 0.291, where at least 0.10
is required. So the light card sits in the narrow window §7.4 allows (L 0.78–0.82), which is why it
is exactly this gray and no lighter.

### The anomaly ramp: the center of the palette

Fixed at −4 … +4 °C, symmetric, the same in both themes, printed in the legend. The stops are in
OKLCh and are interpolated in OKLab. `tools/art/ramp.py` holds them, checks DESIGN §7.1's
constraints, and prints the LUT with `--lut`:

| °C | −4 | −2 | −1 | −0.5 | 0 | +0.5 | +1 | +2 | +4 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L | 0.440 | 0.640 | 0.800 | 0.890 | 0.965 | 0.890 | 0.800 | 0.640 | 0.440 |
| C | 0.120 | 0.105 | 0.062 | 0.030 | 0.004 | 0.032 | 0.068 | 0.125 | 0.125 |
| h | 262 | 251 | 245 | 240 | 95 | 30 | 28 | 27 | 24 |
| sRGB | `#2c4f94` | `#5990ca` | `#9dc3e4` | `#cadeed` | `#f4f3f0` | `#efd3ce` | `#e6aea6` | `#cd6c62` | `#8a2f2f` |

`python3 tools/art/ramp.py` printed:

```
symmetry max |L(+v)-L(-v)| 0.0000 (<= 0.02)  monotonic True  chroma at 0 0.0040 (<= 0.02)
  normal dE(-4,+4) 0.214  dE(-2,+2) 0.213  dE(-1,0) 0.178  dE(+1,0) 0.178  min dE(end, hatch) 0.200
  deutan dE(-4,+4) 0.186  dE(-2,+2) 0.171  dE(-1,0) 0.182  dE(+1,0) 0.164  min dE(end, hatch) 0.162
  protan dE(-4,+4) 0.167  dE(-2,+2) 0.154  dE(-1,0) 0.157  dE(+1,0) 0.194  min dE(end, hatch) 0.182
  tritan dE(-4,+4) 0.235  dE(-2,+2) 0.270  dE(-1,0) 0.183  dE(+1,0) 0.185  min dE(end, hatch) 0.173
ALL CHECKS PASS
```

(ΔE is Euclidean in OKLab. The color-vision simulation uses Machado, Oliveira and Fernandes (2009),
at severity 1.0, applied in linear sRGB; the citation is in the script.)

**Why these stops.**
- **The lightness falls fast near zero** (0.965 → 0.89 by ±0.5 → 0.80 by ±1). Most of the record,
  and every stripe before 1980, lies within ±1 °C, and a ramp that stayed near-white until ±1 would
  draw the 19th century as blank. The first half degree is visible.
- **The warm side runs rose to brick and never passes through orange.** Orange and yellow are the
  colors of warnings, and a heat-warning palette (yellow → orange → red) would make an anomaly look
  like an alarm. The +4 end is a deep brick, `#8a2f2f` (C 0.125), not a signal red (a fire-engine
  red is about L 0.63, C 0.25). The +2 stop, `#cd6c62`, is redder (h 27) than the terracotta
  generated pages use (h ≈ 39, `#D97757`), and it appears only as data.
- **The cold end leans to indigo** (h 262), so −4 and +4 differ in hue as well as in sign, which
  helps under deuteranopia (ΔE 0.186).
- **The zero is near-white with a trace of warmth** (C 0.004). It is "no departure", the paper on the
  gray card. It is not the page: in the light theme the page (L 0.970) and the zero (L 0.965) are the
  same lightness. That is why the stripes track has a frame (below), and why the zero is never used
  for chrome.

### The temperature ramp (Absolute, plan 0012)

Absolute shows each cell's 1951–1980 average 2 m air temperature (ERA5, `assets/climatology.json`)
plus GISS's anomaly: an estimate, said so on the legend, in the year row and in About. It needs its
own scale, because temperature runs about −64 to +38 °C cell by cell where the anomaly runs ±4, and
it must never be read as the anomaly map. So it is **sequential, not diverging**: lightness rises
from the coldest to the warmest, and the hues run violet, indigo, blue, teal, sage and sand. It never
passes through the anomaly ramp's near-white zero or its brick red, and it uses no orange, yellow or
signal red, so the warm end reads as sand, not as an alarm. Fixed at −60 … +40 °C, the same in both
themes, printed in the legend with pointed ends and the count of cells beyond either end. The stops,
in OKLCh, interpolated in OKLab (`js/ramp.js` `ABS_STOPS`; `tools/check.mjs` asserts this table):

| °C (Absolute) | −60 | −40 | −20 | 0 | +10 | +20 | +30 | +40 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L (Absolute) | 0.270 | 0.400 | 0.530 | 0.665 | 0.735 | 0.805 | 0.875 | 0.945 |
| C (Absolute) | 0.080 | 0.120 | 0.120 | 0.085 | 0.070 | 0.070 | 0.075 | 0.050 |
| h (Absolute) | 305 | 280 | 255 | 220 | 180 | 125 | 95 | 85 |
| sRGB | `#301a45` | `#3d3c86` | `#376daf` | `#51a0b8` | `#77b8ab` | `#b5c896` | `#e5d69e` | `#fcebc7` |

`node tools/check.mjs` printed (2026-10-06): in sRGB's gamut (0.00000 outside), chroma at least
0.0500 at every 0.1 °C; lightness rises at every 1 °C under normal, deutan, protan and tritan
vision; the 10 °C steps' ΔE (OKLab) 0.070–0.095 normal (ratio 1.36), 0.065–0.096 deutan, 0.056–0.084
protan, 0.065–0.104 tritan (all ≤ 1.75); the ends 0.674–0.694 apart; every value at least 0.076 from
both hatch grays (0.036–0.099 under the simulations, where the hatch's pattern also tells them
apart). The light card (`#bebebe`) sits nearest +17 °C (ΔE 0.066) and the dark card nearest
−56 °C (0.086), so the limb's ring and the map's outline, not the fill, part the Earth from the card
there, as they do for the anomaly ramp's ends.

**No data** stays DESIGN's hatch: ground `#989898` (L 0.68), lines `#808080` (L 0.60), 45°, a period
of 6 CSS px, 1.5 px lines, fixed to the screen. On the gray card it reads as darker than the card,
so absence is drawn, not left blank (`study-1880.png`: the Sahara, the Amazon and the Arctic).

---

## Layers: the field reads first

On the card, bottom to top (the WebGL canvas, then the Canvas 2D overlay). The **line styles are the
same in both themes**, because they sit on the data, and the data's colors do not change with the
theme. US Quakes chose its rims by the data for the same reason.

| Layer | Style |
| --- | --- |
| Card | `--card`, flat. No gradient, no vignette, no stars, no glow. |
| The field | nearest cell, the ramp's LUT, the hatch. Unlit: no shading, terminator or rim light inside the disc, ever. |
| Limb | a 1 px ring in `--card-ink` at 55 %. The globe is an object on a card, outlined in pencil, not a planet glowing in space. The Equal Earth outline is the same line. |
| Graticule | every 30°, 0.6 px `#101010` at 13 %; the equator at 24 %. |
| Borders | 0.5 px `#101010` at 30 %, with no halo. |
| Coastlines and lakes | 0.8 px `#101010` at 74 % over a 2.2 px white halo at 40 %. |
| Places | Archivo 500, 11 px, `#121212`, over a 3 px `#f5f5f5` halo at 85 %, with a 1.6 px dot. Sentence case. |
| Selected cell | its 2° outline, 1.5 px `#121212` over a 3.5 px `#f5f5f5` halo at 95 %. |
| The tap card, notices | `--sheet`, above everything. |

From `contrast.py`: a coastline against its ground measures 7.74 on 0 °C, 3.30 on −2, 3.18 on +2,
3.71 and 2.88 on the two hatch grays. At the ±4 ends the line itself is 1.56–1.60, but its halo is
2.60–2.63 there, so the pair always reads: dark line on pale ground, pale halo on dark ground. A
place label over the darkest cell (+4 °C) measures 13.41 on its halo. Lines are deliberately thin, so
the coasts orient the eye and the cells carry the picture (`study-light.png`).

---

## The signature control: the stripes, as an instrument

The stripes row is **64 px** (DESIGN said 52). From the top:

- **Caption line** (rows 0–12): `Stripes: GISS global mean, each year, on a ±1.5 °C scale` in
  10.5 px `--ink-2`, left-aligned (in Last 24 months: `…, each month, on a ±1.5 °C scale`). The scale
  is printed on the instrument, so no one has to assume it is the map's.
- **The track** (rows 17–42, 25 px tall), the full content width, in a **1 px `--line-strong`
  frame**. It has one stripe per step on the ±1.5 °C scale, through the map's ramp, each stripe's
  edges snapped to device pixels so 147 stripes never shimmer. The frame is what makes the
  near-white years from 1951 to 1980 read as white stripes, not as a gap in the bar.
- **The partial year is open**: its color fills only the top and bottom thirds, with the page
  between them. It is the one stripe that is visibly unfinished.
- **Graduations** under the frame: a tick at every decade (3 px, `--ink-2` at 50 %), with
  1900, 1950 and 2000 at 5 px and full strength. These are years, so they are graduations, not a
  numbered list.
- **The zero's bracket.** Under the graduations, a 1 px `--ink` bracket with 3 px feet spans
  1951–1980, and the label row prints **`1951–1980 = 0`** under it in `--ink`. The other labels are
  `1880`, `1900`, `2000` and the newest year, in `--ink-2`. This is the detail that makes the stripes
  this app's own. The poster shows warming; this instrument also shows what "zero" means. In
  Last 24 months there is no bracket (none of the 24 months is in the base period). The ticks
  become the first month, each January, and the newest month, and the caption carries the base.
- **The thumb is a reading index**, not a knob: a 1.5 px `--ink` rule from 3 px above the track to
  3 px below it, a 7 × 4 px solid index triangle above it pointing down, and a 4.5 px `--page` halo
  behind the rule so it parts the stripes rather than sitting on them. It stands at the center of
  the drawn step's stripe. During play and drags it **steps from stripe to stripe and never
  glides**: the index points at the year that is drawn, never between two years. The hit area is
  the whole row plus 8 px.
- **Pressed**, the frame turns `--ink`. There is no glow, scale-up or bubble.

---

## Signature moments

1. **The stripes are written by the years (first launch only).** The globe faces the viewer's
   longitude at 20° N, in 1880. The track shows only its frame, graduations and bracket, with the
   page inside it. Play runs at the normal 8 years a second to the last complete year, about 18 s.
   **Each stripe appears as its year is drawn**, so the world's best-known climate picture assembles
   itself behind the index, out of the same years the globe is showing. The 1950s–70s write near-
   white, and the bracket under them says why. One line on a `--sheet` chip under the panel's top
   strip says `Playing 1880 to 2025, one year every eighth of a second. Touch to stop.` (the years
   are filled in from the snapshot). It fades out when the play ends or is stopped. Any touch, key or
   wheel ends the opening at the year it had reached, and the rest of the stripes appear at once.
   It never runs under Reduce Motion, in focus mode, twice (`ww.opened`), or without a snapshot.
   There is no title card, no logo and no flourish at the end: the last stripe is written, and the
   app is simply open.
2. **The counter rolls, the numbers don't count.** During play (and the opening) only, the digits
   of the year that change slide up 0.55 em and in, over 90 ms on `--settle`. The units digit rolls
   every step; the tens roll at each decade. Scrubbing and stepping **cut**: the label is the drawn
   step on every frame (DESIGN §4.4). The global mean and the coverage never tween or count up. A
   number that counts passes through values nobody measured. The rolling digits are an `aria-hidden`
   twin over the true text (Earth's History's pattern).
3. **The Arctic turn.** Arctic turns the globe to 72° N over 600 ms on `--turn`: it starts slowly,
   like a globe with weight, and settles without overshoot. Nothing else happens. There is no zoom
   punch and no highlight, and the reddest place on Earth arrives on its own. When it lands the
   key shows "on" (below). Antarctic is the same toward 72° S, and from the map either key switches
   to the globe first.
4. **The tap chart draws itself.** The card rises 6 px and fades in over 160 ms on `--settle`. The
   value and the place are there at once. In the chart, the 1951–1980 band, the zero line and the
   faint global-mean line are drawn first, at once, as the context. Then **the cell's own line draws
   from 1880 to the newest year over 480 ms, at a constant number of years per millisecond**, and the
   cell's own stripes under the chart fill in at the same pace. Time on the x axis moves linearly,
   because easing a time axis would make some decades appear to pass faster than others. It draws
   once per newly selected cell. A step change while the card is open moves only the year rule and
   the dot. Under Reduce Motion it is drawn at once.
5. **Play at 8 years a second.** Every year is shown in order, each one a cut (DESIGN D-4: no
   cross-fades). The index steps one stripe at a time, and the counter rolls. The ▶ key becomes ❚❚
   without animation.

---

## Motion and easing

Two curves, one for the object and one for the paper:

| Token | Curve | For |
| --- | --- | --- |
| `--turn` | `cubic-bezier(0.45, 0, 0.2, 1)` | the globe's moves: the pole turns, the card's 240 ms turn, the Earth gliding to its focus seat. An ease-in-out with a long, quiet arrival and no overshoot. |
| `--settle` | `cubic-bezier(0.2, 0, 0, 1)` | everything laid on the card: the tap card, notices, the opening's line, the ghost key, the rolling digits |

| What | Duration |
| --- | --- |
| Arctic / Antarctic turn | 600 ms `--turn` |
| Turning a covered cell into view when the card opens | 240 ms `--turn` |
| Tap card in (6 px rise and fade) / out (fade) | 160 / 120 ms `--settle` |
| The cell's line drawing | 480 ms, linear in years |
| Rolling digits | 90 ms `--settle` |
| Notices in / out | 160 / 200 ms opacity |
| Focus mode: the rows glide, the Earth to its seat | 280 ms `--turn` |
| Switch underline moving between options | 140 ms `--settle` |
| Fling | DESIGN §6.1 (0.92 a frame) |

Nothing moves while nothing is happening. The scheduler is idle between gestures (DESIGN §5.6).

**Reduce Motion** (`prefers-reduced-motion: reduce`): no opening; pole turns, the card's turn and
focus mode happen at once; the card and notices appear without moving; the chart is drawn whole;
the digits do not roll; no fling. **Play still plays.** Each step is a state change the viewer asked
for, not decoration (DESIGN §11).

---

## Designed objects

- **Switches** (Globe | Map on the card; Annual | Last 24 months on the page). There are no boxes
  and no pills. The options sit 14 px apart over a shared 1 px base rule (`--line-strong` on the
  page, `currentColor` at 35 % on the card). The chosen option is set in 650 and **its stretch of the
  rule thickens to 2 px of ink**: a reading mark under the option. 12 px at width 87.5 %. The hit
  area is 44 px tall, and the options are radio groups (DESIGN §11). Labels are never abbreviated.
- **Arctic and Antarctic** are text keys, in `--card-ink-2`; "on" is `--card-ink`, weight 650, with
  the same 2 px underline. From 360 px up they have no icons: the word says where the globe goes.
  Below 360 px (DESIGN §3.2) each becomes a 14 px ring with a 3 px dot at its top (Arctic) or bottom
  (Antarctic), in the same 1.4 px stroke as the focus mark, keeping its accessible name.
- **‹ ▶ ›**: 1.5 px stroke chevrons in 44 px keys. Play is a 31 px ring around a solid triangle, and
  pause is two 2.5 px bars in the same ring. These are the only round things in the app.
- **The focus key** (30 × 30, 44 hit, at the right end of the card's top strip). **Not** Earth's
  History's corner marks around a disc, and not US Quakes' frame: its mark is **what stays**, a
  12 px circle (the globe) over a 16 px bar (the track), drawn in 1.4 px `--card-ink`, with two short
  ticks at the top corners at 55 % for the chrome that leaves. **The ghost key** that brings the
  controls back is the same mark in the panel's top-right corner, drawn like the overlay: a pale
  1.4 px `#f2f2f2` stroke over a 3.4 px dark halo at 45 %, at 72 % opacity at rest and full on hover,
  focus or press (`study-focus-dark.png`). It reads on the card in both themes and over any cell.
- **The legend** (the card's foot, **44 px**, three lines):
  1. The bar is **81 graduated steps of 2.6 px**, one per 0.1 °C byte from −4.0 to +4.0. It is the
     LUT itself, not a smooth gradient, so the legend tells the truth about the quantization. It is
     9 px tall, with **pointed ends** (7 px triangles in the end colors), the scientific colorbar's
     sign for "values beyond are drawn in this color". It has ticks every 0.5 °C (2 px) and at
     −4, −2, 0, +2, +4 (4 px). At the right of the line sits a 14 × 9 px hatch swatch and `no data`.
  2. Labels in 10.5 px `--card-ink`: `≤ −4`, `−2`, `0`, `+2`, `≥ +4 °C`. At the right, in
     `--card-ink-2`, the step's `beyondScale` (CONTRACT §3.4, strictly beyond ±4.0) as
     `846 above +4` or `37 below −4`, or `37 below, 846 above` when both are there.
  3. The caption in `--card-ink-2`: `Anomaly vs each place's 1951–1980 average, not temperature`,
     extended per DESIGN §7.3 (`Single months swing further than years.` / `Partial year: Jan–Aug.`),
     and the credit line or `Data: NASA GISS.` per DESIGN §9.
- **The year row**: the year at 28 px, and under it, for the partial year, `Jan–Aug, partial` at
  11 px `--ink-2`. On the right, two lines at 12 px `--ink-2`, with the value in `--ink` 600:
  `Global mean +1.19 °C` and `Data cover 99 % of Earth's surface`.
- **The tap card**: `--sheet`, a 1 px `--line-strong` edge, a **3 px radius**, and no shadow and no
  blur (a backdrop blur over the field would smear data, and a shadow would say "floating app card").
  Inside it, 9 × 12 px of padding holds: the place line at 11.5 px `--ink-2` with ✕ at the right;
  the value at 22 px with its sentence at 12 px; the chart (334 × ~92 px plot); the cell's stripes,
  10 px tall, on the map's ±4 scale with hatch for missing years, labeled `1880`, `1951–1980` and the
  newest year; and the footnote at 10.5 px `--ink-3`. The chart's cell line is 1.5 px `--ink` and its
  global-mean line 1 px `--ink-3`. The base band is `--ink` at 7 %, and the zero line `--ink` at
  45 %. The step rule is 1 px `--ink` at 60 %, with a 2.6 px dot. The partial point is a hollow
  ring. The line is ink, not colored: color stays in the stripes under it, so a red line never reads
  as a warning. The card is 222 px tall at 390 (262 in Last 24 months).
- **Notices**: one line on a `--sheet` chip with a 1 px `--line` edge and a 3 px radius, 12 px text,
  centered under the card's top strip. There is no icon and no colored bar. Staleness is said in
  words, never in amber or red. Amber and red are temperatures here.
- **Errors** (DESIGN §3.7): the sentence is centered on the card, 13.5 px `--card-ink`, at most
  300 px wide. The card stays gray, so a failure never looks like a cold or warm planet.
- **About**: a full-height `--sheet` panel. Section heads are 600 at 14 px in sentence case, prose
  400 at 13.5 / 1.45 within 62 ch, citations at 12 px `--ink-2`. The "This copy" block is
  `label: value` lines, one per line, with no middle dots. Nothing is a link. A 1 px `--line` rule
  separates sections, and there are no cards inside it.
- **Focus rings**: 2 px `--ink` (`--card-ink` on the card) with a 2 px offset. Never a hue.
- **Map view** (Equal Earth): the same card, the outline as the limb, the same overlay. On wide
  screens the card is the left column, edge to edge in its column.

---

## Deliberately restrained

- **One typeface, one file**: 67 202 bytes with its license. One large figure (the year, 28 px).
- **No accent color**, and the grays' chroma is exactly 0. Every hue is a measurement.
- **No gradients** in the chrome. The legend is stepped, and the only gradient-like things on screen
  are data (the stripes and the field).
- **No shadows, blur, glow or glass.** The tap card is paper with an edge.
- **No light on the planet**: no atmosphere, rim light, terminator, night side or stars. The data
  are lit by nothing, so a color is only ever a number.
- **No icons** except the transport keys, ✕, the focus mark and its ghost (and the pole keys' rings
  below 360 px). Arctic, Antarctic and About are words.
- Radii: 3 px (the card, notices), and round only for the play ring. Nothing else is rounded,
  because nothing else is a container.
- **No library.** Plain WebGL2 and Canvas 2D, as DESIGN planned. The OKLab interpolation is 20 lines
  (`ramp.js`, the study's function).

## Never

- **Never a color that reads as danger where it means an anomaly.** No orange, yellow or signal red
  in the ramp. No red or amber for staleness, errors or "new data". No pulsing, flashing or
  "record!" treatment for a warm year. The newest year is drawn like every other.
- **Never an exaggerated scale.** ±4 °C on the map, ±1.5 °C on the stripes and −60 … +40 °C in
  Absolute, fixed and printed. No re-fitting, no zoom into the color scale, no extra saturation for the recent years,
  and no "stretched" stripes poster mode.
- **Never invented data over the gray.** The hatch is drawn on top of nothing. No interpolation
  across it, no fade into it, no smoothing of cell edges, and no cross-fade between years (D-4).
- **Never a temperature where an anomaly is meant, nor an anomaly where a temperature is.** Every
  difference carries the baseline it is against ("vs. 1951–1980", the bracket's `1991–2020 = 0`) or
  sits under a caption that says so; every temperature says it is an estimate (the caption's
  "Estimated temperature", the year row's ±0.5 °C, the card's "estimated"). No thermometer icons, no
  flames, no ice.
- **Never the poster on its own.** The stripes always carry their frame, scale, bracket and labels,
  in focus mode too. A full-bleed, unlabeled stripes image is Ed Hawkins's work, and it is not
  reproduced here.
- **Never NASA's look**: no insignia, no "meatball", no NASA blue, no government web face.
- **Never a number that counts up** or a value that tweens.

---

## Libraries and vendored files

| What | License | Bytes | Decision |
| --- | --- | --: | --- |
| Archivo, subset (`fonts/archivo-ww.woff2`) | SIL OFL 1.1, no RFN | 62 536 | vendored |
| `fonts/OFL.txt` | — | 4 666 | vendored |
| Atkinson Hyperlegible, Newsreader (house) | OFL | — | not used (see Type) |
| d3-scale-chromatic / chroma.js | ISC / BSD | — | rejected: the ramp is 9 stops and 20 lines of OKLab, checked by `ramp.py` |
| three.js, MapLibre | MIT / BSD | — | rejected, as in DESIGN §5.1 |

**Total vendored: 67 202 bytes, all font.** No code library earns its bytes. The credit goes into
`CREDITS.txt` and About through the pipeline's `sources.py` (change list 15).

---

## The study (`tools/art/`, outside the ZIP)

- `study_data.py` reads GISS's table from the pinned September copy
  (`scripts/warming_world/cache/wayback/GLB.Ts+dSST.20260914.csv`) and the bench frames' coverage
  into `study-data.json` (3 083 B). It printed: "years 1880 - 2025 146 | min −0.49 1909 | max 1.29
  2024 | partial {'year': 2026, 'months': 8, 'mean': 1.224} | coverage frames 147 | months 2024-09 -
  2026-08".
- `study.html` draws the 390 × 844 screen: the gray card with an orthographic globe of a real frame
  (from `tools/.work/bench/annual.bin`, made by `tools/bench/make_frames.py`), the overlay styles,
  the legend, the year row, the stripes track, the controls, the tap card for the Fairbanks cell
  (row 12, column 16), and focus mode. For the study only, the coastlines are Global Weather's
  `world.json`; the app builds its own from Natural Earth. Serve `Template/` and open
  `warming-world/tools/art/study.html` with `?y=2025&card=1&lat=50`, `?y=1880&lon=0`, or
  `?y=2026&focus=1&lon=20&dark`.
- The three PNGs are 780 × 1 688. They were taken with Playwright 1.63.0 headless Chromium at DPR 2,
  which reported 0 console errors, 0 failed requests and `Archivo:loaded` for each.
- `ramp.py` and `contrast.py` print every figure in this file. `font_subset.py` builds the font.

**What the study caught** (all fixed above): the canvas drew its labels in a serif before the font
arrived (so the font load is awaited); the "scale ±1.5 °C" caption collided with the thumb's index at
the newest year (so the caption is now one line on the left); the light page and the 0 °C stripes are
the same lightness (so the track has a frame); and the legend's "≥ +4 °C, 846 cells" disagreed with
CONTRACT's strict "beyond" count (so the count reads "846 above +4"). The study's count comes from
its own bench bytes. The app's comes from the snapshot.

The study is a reference for proportion and tone. It is not code to copy, except the ramp function,
the `@font-face` rule and the hatch geometry. Its globe is a Canvas 2D raster, while the app's is the
WebGL2 shader of DESIGN §5.

---

## Change list against DESIGN.md (applied there in place)

Each item names the DESIGN section it changes. DESIGN §19 lists them again as decisions taken.

1. **§3 rows**: the stripes row becomes 64 px (caption line, framed 25 px track, graduations,
   bracket, labels). The Earth panel is `1fr` = **632 px** at 844 tall (598 with a 34 px inset), and
   its foot (the legend) is 44 px. The seat is 390 × 544 at 844. The globe's radius stays 183 px
   (it is width-limited).
2. **§3.2 Earth panel**: the panel is the **gray card** (`--card`), not space. Its top strip carries
   the underline switch, the Arctic and Antarctic text keys, and the new focus mark. Notices are
   `--sheet` chips.
3. **§3.3 Year row**: the year in Archivo 600 at 28 px, width 87.5 %, tabular. The partial second
   line is 11 px `--ink-2`.
4. **§3.4 Stripes track**: the frame, the decade graduations, the **`1951–1980 = 0` bracket**, the
   caption moved to a line above the track, the reading-index thumb with no glide, and the partial
   stripe open in its middle third.
5. **§3.5 Controls**: the transport keys as drawn above. Annual | Last 24 months is the underline
   switch.
6. **§3.6 About**: the `--sheet` panel, sentence-case heads, no links, `label: value` lines.
7. **§3.9 The opening**: the stripes are written behind the index as the years play, with the one
   caption line. There is no title card.
8. **§5.4 step 7**: the outside is `--card`, with **no soft limb and no glow**. The limb is the
   overlay's 1 px ring.
9. **§5.5 Overlay**: the line, label and selection styles above, the same in both themes.
10. **§7.1 Ramp**: the stops above replace the starting point. `check.mjs` asserts `ramp.js`'s stops
    equal ART's table, and the constraints `ramp.py` checks.
11. **§7.3 Legend**: three lines in 44 px, the 81-step bar with pointed ends, the beyond counts
    worded "above / below".
12. **§7.4 Ground**: the card's measured L (0.802 / 0.309) and its margins.
13. **§8 Card**: `--sheet`, not glass; the chart's styles; the line drawing itself; 222 / 262 px.
14. **§10 Focus mode**: the focus mark (globe over track) and its ghost replace the corner marks.
    Focus keeps the stripes' caption, frame and bracket. The panel grows by the top bar and the year
    row: 632 + 44 + 56 = 732 px.
15. **§13 Bytes**: fonts 67 202 B. **The pipeline's `sources.py` gains an Archivo entry**
    (license OFL 1.1, the google/fonts commit and sha256 above, the credit "Archivo by Héctor Gatti
    and Omnibus-Type, SIL Open Font License 1.1"), so that `build_static.py` puts it in
    `CREDITS.txt` and About.
16. **§11 Reduce Motion**: adds the rolling digits and the chart's drawing to what is turned off.
17. **§14 File layout**: `fonts/archivo-ww.woff2`, `fonts/OFL.txt`, `tools/art/`.
18. **§16 Tests**: `check.mjs` asserts that `fonts/` holds exactly the two files, that `ramp.js`'s
    stops equal ART's, and that every chrome token in `style.css` has chroma 0 (OKLCh C < 0.001).
    `shoot.mjs` adds: `document.fonts` reports Archivo loaded before any picture; the opening writes
    stripes only up to `shown` (a pixel sampled to the right of the index is the page color, inside
    the frame); no element animates a number's text; and the contrast sampler covers the legend
    labels on the card.

### After the QA pass (2026-10-01; DESIGN §20 has the reasons and the measurements)

19. **Pressed and hover, in grays** (DESIGN §20 Q-3; this file had only the track's pressed frame and
    the ghost key's opacity). Pressed: a plate of the key's own ink at 14 % behind it, 3 px radius,
    the one round exception being the play key, whose ring fills; a text key goes to full ink. Hover
    (a hovering pointer only, never a touch): a text key goes to full ink, an icon key gets a 7 %
    plate. The track's frame: `--line-strong` at rest, `--ink-2` on hover, `--ink` pressed. The plates
    are `currentColor` (a gray token) mixed with transparency, so every state is a gray; no shadow,
    glow or scale-up, and `:focus-visible` stays the 2 px ring with no plate. The ghost key keeps its
    opacity rule (72 % → full), because a plate over it would cover data.
20. **The legend is two text lines, not one** (DESIGN §20 Q-5). "Designed objects" said 44 px and
    three lines; the honesty lines do not fit that, and the core measured about 108 px. Now: the bar
    and its labels (30 px), the caption on one line (`Anomaly vs. each place's 1951–1980 average, not
    temperature.`, and the partial year's months), and the credit in one small line, `Data: NASA GISS
    (GISTEMP v4); annual means and 0.1 °C rounding by this app.`: **65 px** at 390 (79 in Last 24
    months, where `Single months swing further than years.` takes a second caption line). The beyond
    counts stay at the right of the labels' row, under the hatch key. The release and "archived copy"
    moved to the top bar's stamp, one line at 10.5 px `--ink-2` (`Data to July 2026, archived copy`
    since the review pass, DESIGN §21 R-14; a comma, never a middle dot).
21. **The selected cell** (DESIGN §20 Q-1; "Layers" said "its 2° outline, 1.5 px `#121212` over a
    3.5 px `#f5f5f5` halo at 95 %"). The same ink and halo, but drawn outside the cell only (a pale
    0.5 px gap, the 1.5 px ink, a 1.5 px halo, scaled down for cells under 6 px and never wider than
    0.6 of the cell), and for a cell under 4 px across an open ring of radius 9 px in the same ink over
    the same halo. The cell's own color is never covered.
22. **The switches' underline** moves by `transform` (`translateX`, `scaleX`) over the same 140 ms
    `--settle`; the browser's bar takes `--page` through `theme-color` in each scheme.
23. **The chart's `global mean` is a key, not a label** (DESIGN §21 R-1). "Designed objects" put it at
    the faint line's right end; on its paper halo it erased the cell's own line in recent decades. Now
    a 12 px sample of the 1 px `--ink-3` line and the words, 10.5 px `--ink-3`, in the labels row under
    the cell's stripes. Nothing is drawn over the cell's line. The partial year's stripe is open there
    too, as on the track.
24. **The top strip sits on the card's own gray** (DESIGN §21 R-2): `--card`, the panel's ground, so at
    zoom 1 it is invisible, and a zoomed Earth passes under the keys like a view through a window in
    the card. The ghost key is back in the top-right corner.
25. **The canvases' text at the device's own DPR, up to 3** (DESIGN §21 R-9), so "edges snapped to
    device pixels" holds on a 3× iPhone; the WebGL canvas stays capped at 2.

### Plan 0012 (2026-10-06): Absolute, a baseline of one's own, the scale in focus mode, the credit in About

The owner's brief: *"Allow option to show absolute temp rather than differences. On the difference
mode, allow user to select base/starting point as an average range. Full screen should not remove
scale"*, and the family's front rule (HOUSE §4.15). What is true of the app now, where it differs
from the sections above (`tools/DECISIONS.md` has the reasons):

26. **The legend's first row** (on the card, `--card-ink-2`; 40 px, every key's hit area 44 px): the
    underline switch **Difference | Absolute** (remembered, `ww.measure`) at its left, and the text key
    **Base 1951–1980** (the span in use, `ww.base`) at its right. Below it the bar and the caption, as
    before. The legend measures about 88 px at 390 (65 before: its 36 px row in, the credit's 14 out).
27. **Absolute's legend:** 101 graduated steps of 1 °C from −60 to +40 (2.085 px each), the same
    pointed ends, ticks every 10 °C and long ones every 20, labels `≤ −60`, `−40`, `−20`, `0`, `+20`,
    `≥ +40 °C`, the counts beyond either end; the caption `Estimated temperature: each place's
    1951–1980 average plus GISS's anomaly.` The year row reads `Global mean 14.9 °C (±0.5 °C)`: the
    climatology's area mean plus GISS's global mean, never a mean of the map's cells. The card prints
    the cell's temperature to the whole degree (`−2 °C`) with "estimated: the cell's 1951–1980 average
    plus GISS's +2.5 °C" (GISS's own anomaly against 1951–1980, whatever Base says, so the sum adds
    up); its chart and its stripes stay the anomaly, which is where change is read. The pole chip:
    `Map mean north of 64° N: −8 °C, estimated`, made as the year row's figure is: the climatology's
    mean over the whole cap plus the cap's mean anomaly, so a cap with few cells (the Antarctic before
    1957) does not read colder or warmer for lack of data.
28. **Base:** the key opens a sheet in the tap card's place and dress (`--sheet`, 1 px
    `--line-strong` edge, 3 px radius): `From ‹ 1951 › to ‹ 1980 ›` in 20 px semibold figures with
    44 px chevron keys that repeat when held, a sentence that says the rule and how many cells it
    leaves without a baseline, and `Back to GISS's base, 1951–1980` once another span is chosen. As the
    years move, the bracket under the stripes moves and is labeled with the span (`1991–2020 = 0`,
    placed first so no year label can hide it), the stripes, the map, the legend's caption and the
    year row (`Global mean +0.58 °C vs. 1991–2020`) follow at once. Every difference names its
    baseline: the year row and the pole chip now end `vs. 1951–1980` by default too. The key names
    the base in use: in Last 24 months it reads `Base 1951–1980` whatever span is chosen (single months
    stay against GISS's base, and the sheet says the span applies to years); in Absolute its name and
    the sheet say the map's temperatures do not use it. A one-year span is named as one year (`2021`).
29. **Focus mode keeps the scale:** the legend's bar and caption stay at the foot of the panel (the
    switch row goes, inert); the ghost key's name, "Show the controls and the color scale", is kept
    because the switch and Base come back with it. The card in focus mode docks 6 px above the legend.
    Entering it says `Controls hidden. The Earth, its scale and the stripes stay.` (HOUSE §4.10's
    sentence, naming what this app keeps).
30. **The credit left the legend** (change list item 1): `Data: NASA GISS (GISTEMP v4); annual means
    and 0.1 °C rounding by this app.` is About's first line under "Sources and citations"
    (`#about-credit-line`), followed by the climatology's attribution. On a narrow research copy the
    caption still ends "From an archived copy." where the stamp's tail is hidden.
