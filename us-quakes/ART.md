# US Quakes — art direction

Written on 2026-09-30, before any app code, for the builders. `DESIGN.md` says what the app does;
this file says how it looks, moves and speaks, and the change list at the end says what that changes
in `DESIGN.md` (already applied there, so the two agree). Every contrast figure and byte count below
names the command that printed it. The pictures referred to are `tools/art/study-light.png` and
`study-dark.png`: a study of the designed objects drawn from **real catalog rows** (§"The study").

---

## The look: Drum Record

A seismograph writes on a drum of paper turning under a pen. The paper is ruled by the clock, the
pen draws a flat line while nothing happens, and ink piles up where the ground was busy. That record,
not an atlas plate and not a dashboard, is what this app looks like.

- **Light theme: helicorder paper.** A cool white, never cream, with a faint blue-gray ruling, and
  near-black ink.
- **Dark theme: smoked paper.** The early mechanical seismographs wrote by scratching a stylus
  through soot on a drum, so their records are white lines on black. The dark theme is soot, with
  the ink scratched white.
- **Chrome is ink; color is data.** Nothing in the interface carries a hue: no accent blue, no
  tinted buttons, no colored focus rings. The only colors on screen are the depth ramp, the volcano
  color codes and the no-depth gray, so **every color a person sees is a measurement**.
- **One bold object per task.** In Live and History it is the **record strip** at the head of the
  sheet. In a section it is the **section plot**. Everything around them stays quiet.
- **The map runs edge to edge**, with no frame and no neatline. It is a working sheet on the drum,
  not a plate in a book.
- **Nothing shakes.** Shaking is the one thing an earthquake app must never fake. Motion is
  critically damped, the way a seismometer's pendulum is: things arrive and stop, with no overshoot,
  bounce, wobble or pulse.

**How it differs from Earth's History ("Deep Field Atlas")**, the previous app, which reviewers
judged crafted, and which this must not copy:

| | Earth's History | US Quakes |
| --- | --- | --- |
| Metaphor | an atlas plate photographed at night | a seismograph's drum record |
| Frame | a neatline around a night panel | none; the map is edge to edge |
| Second face | Newsreader serif and italic (an atlas voice) | Red Hat Mono (a bulletin voice); no serif, no italic |
| Accent | survey blue | none: ink only, and color is data |
| Signature control | the ICS color bar (color is the track) | the record strip (ink is the track) |
| Light ground | mineral gray with a green bias (`#eceee9`) | cool drum paper (`#f1f3f4`) with a blue-gray ruling |
| Dark ground | navy (`#0a1120`) | soot (`#0c0e10`) |
| Opening | 750 million years played in five seconds | the last 30 days written onto the paper |
| Motion curve | an eased settle | critically damped: no overshoot, ever |

The two share only Atkinson Hyperlegible, the house face for reading.

---

## Type

Two faces, one job each. **Atkinson Hyperlegible** sets words. **Red Hat Mono** sets every measured
value (magnitudes, times, depths, distances, counts on the strips and axes), the section's `A` and
`A′`, and the event page's address. That is the voice of an earthquake bulletin, where a catalog
line is fixed-width and read in columns. Numbers inside running prose are set the same way by `nums()`
(below); only years in prose, names and USGS's quoted words stay in Atkinson.

| Role | Face | Size / line | Where |
| --- | --- | --- | --- |
| Title | Atkinson 700 | 15 / 15 px | "US Quakes" in the top bar |
| Card magnitude | Red Hat Mono 500 | 17 / 17 px | "M 7.1", with the type code at 12 px in `--ink-2` |
| Names | Atkinson 700 | 14 px / 1.3 | the card's place, story titles, the History label's year |
| Body | Atkinson 400 | 13.5 px / 1.4 | lists, story text, About, the honesty notes |
| Controls | Atkinson 400; 700 when on | 11.5 px | segmented controls and chips |
| Section heads | Atkinson 700, sentence case, `--ink-2` | 12 px | "Largest this month", "Stories" |
| Readouts | Red Hat Mono 500 | 11.5–12 px | the feed stamp's time, list magnitudes, dates, depths, the History label's count |
| Instrument labels | Red Hat Mono 500 | 10 px | strip axes, "max 910 · 2020", the scale bar, the section's axes, the legend's numbers |
| Fine print | Atkinson 400, `--ink-2` | 11–11.5 px | the card's small print, captions, the credit line |

The scale is **10 / 11 / 11.5 / 12 / 13.5 / 14 / 15 / 17 px**. There is nothing larger: no hero
numbers and no display size. The largest number on screen is a magnitude at 17 px. The mono needs no
`tnum` because it is already fixed-width. Atkinson sets `font-variant-numeric: tabular-nums`
wherever its digits line up: the segmented controls, chips, legend tab and card, counts, the feed
stamp, the History label, the largest row, notices, notes and the card's small print (`style.css`;
Atkinson's `latin` files carry `tnum`, checked with fontTools).

**A number is mono, its words are not.** Inside a line that mixes them, `nums()` (`js/util.js`) sets
each number with its sign, an "M " before it and a unit after it ("300 km", "±50 km", "03:19 UTC",
"13 days", "M 2.5+") in Red Hat Mono and leaves the words in Atkinson: the legend card, the corridor
and stretch controls, the History label's counts ("205 earthquakes · 44 in view"), the card's time
line ("… UTC · 20:19 on your phone"), its magnitude type ("mw" mono, "· moment" Atkinson), the largest
row's age ("13 days" mono, "ago" Atkinson) and a story's date; and, from the lead's pass (DESIGN §25),
About's intro, reading, notes and data lines, the story text, the section caption, the event card's
fault and volcano lines, the volcano card's elevation and notice, and the Live sheet's counts. So in
these lines a measured value takes the mono's figures, not Atkinson's among the words, and words never
read as terminal output. (Still in Atkinson: USGS's quoted words, About's source and credit lines,
headings such as "232 earthquakes here", the stamp's age and the card's felt, tsunami and PAGER lines.)
In prose (`nums(s, true)`) a bare year, "Lower 48" and whatever USGS says
between “ ” stay Atkinson, and a digit fused to letters (3DEP, BT2, 2010s) is a name everywhere; `.mono`
does not wrap, so a number never leaves its unit. Years in prose and names ("Kīlauea, 2018", the
History label's bold window) stay Atkinson; the record strip and the plot axes, being instruments,
stay wholly mono.

**Why a mono, and why this one.** The first study set the legend's depths in Atkinson, and its
slashed zero read as "Ø" ("3Ø days", "1Ø km"). Red Hat Mono slashes its zero too: the shipped file's
`zero` has three contours, its counter split by a diagonal, like Atkinson's (fontTools, 2026-09-30).
What the mono changes is the setting: every figure one width, in the listing's voice and apart from the
words, not a zero among letters. It has the prime `′` that `A′` needs, which Atkinson lacks. It is 9,960 bytes. The other RFN-free monos were set in
the same specimen (`dm-mono`, `spline-sans-mono`, `azeret-mono`, `jetbrains-mono`, `fragment-mono`):
DM Mono's cursive *f* is a mannerism, Spline and Azeret lack the prime, JetBrains reads as a code
editor, and Fragment Mono costs 25 KB. **IBM Plex Mono was the first choice and is rejected**: its
upstream license reserves the font name ("Copyright © 2017 IBM Corp. with Reserved Font Name
"Plex""), so a subset of it could not carry its own name. **Newsreader is not used**, because it is
Earth's History's voice.

**Coverage, checked with fontTools on the vendored files:**
- Neither face has **U+202F**, the narrow no-break space that groups thousands. The browser takes
  that one character from the system face. Its width comes from the fallback and nothing is
  mis-drawn; `shoot.mjs` looks at it in the screenshots.
- Atkinson's `latin` subset lacks **ī** (Kīlauea), so the `latin-ext` subsets of both weights ship,
  split by `unicode-range` and loaded only when a glyph needs them.
- Red Hat Mono ships its `latin` subset only. It sets no place names.
- Neither face has ʻokina (U+02BB) in the vendored subsets. The app writes "Hawaii" as USGS does.

**Files** (`us-quakes/fonts/`, vendored now; `cat fonts/*.woff2 | wc -c` printed 63,448):

| File | Bytes | From |
| --- | --: | --- |
| `atkinson-hyperlegible-latin-400-normal.woff2` | 17,208 | identical to `Template/anatomy/fonts/` (`cmp`) = `@fontsource/atkinson-hyperlegible@5.2.8` |
| `atkinson-hyperlegible-latin-700-normal.woff2` | 17,524 | the same |
| `atkinson-hyperlegible-latin-ext-400-normal.woff2` | 9,384 | `@fontsource/atkinson-hyperlegible@5.2.8` |
| `atkinson-hyperlegible-latin-ext-700-normal.woff2` | 9,372 | the same |
| `red-hat-mono-latin-500-normal.woff2` | 9,960 | `@fontsource/red-hat-mono@5.3.0` |
| `OFL.txt` | 5,294 | both copyright notices verbatim from the fonts' OpenType name ID 0, the file list, and the SIL OFL 1.1 text |

That is 68,742 bytes against DESIGN's 120 KB fonts budget. The `@font-face` rules copy
`tools/art/study.html`: one rule per file, `font-display: block` (the files are local, so there is no
network wait to hide), Fontsource's `unicode-range` for `latin` and `latin-ext`, and fallbacks of
`system-ui, -apple-system, sans-serif` and `ui-monospace, 'SF Mono', Menlo, monospace`. Canvas text
is drawn after `document.fonts.ready` and redrawn on `document.fonts` `loadingdone`.

---

## Palette

### Chrome tokens

| Token | Light: drum paper | Dark: smoked paper | Used for |
| --- | --- | --- | --- |
| `--bg` | `#f1f3f4` | `#0c0e10` | the page, the section plot's ground |
| `--panel` | `#fafbfb` | `#15181b` | the sheet, cards, About |
| `--ink` | `#15191c` | `#e7e9e7` | text, strip ink, the selection ring, focus rings, "on" fills |
| `--ink-2` | `#4d5760` | `#9ba3a9` | secondary text, axis labels |
| `--ink-3` | `#646e76` | `#848d94` | tertiary text (captions under the plot); the 10 km dashed line |
| `--on-ink` | `#fafbfb` | `#0c0e10` | text on an "on" fill |
| `--line` | `#d2d8dc` | `#272c31` | hairlines, card borders, segment dividers |
| `--line-strong` | `#aeb7be` | `#444c53` | segmented-control outline, the grip |
| `--rule` | `#c5d0d8` | `#2b3238` | the drum ruling in the strips and the plot (blue-gray, like helicorder paper) |
| `--hatch` | `rgba(21,25,28,.22)` | `rgba(231,233,231,.20)` | hatching: before 1900, the "since the feed" tail, gaps |
| `--glass` | `rgba(250,251,251,.90)` | `rgba(21,24,27,.90)` | anything set over the map: chips, tools, legend, notices |
| `--land` | `#ebedeb` | `#1c2023` | land fill |
| `--sea` | `#d5dfe5` | `#0f1418` | sea from 0 to 200 m, and lakes |
| `--fault` | `#3a4146` | `#c3c9cd` | fault lines (graphite in light, pencil in dark) |

**Sea depth bands**, eight tints of one blue-gray, the deepest darkest, deliberately narrow in
lightness so the sea never competes with the dots. For 200, 1 000, 2 000 … 7 000 m:
light `#d0dbe2 #cad6de #c4d1da #bfccd6 #b9c7d2 #b3c2ce #aebdca #a8b8c6`;
dark `#0e1317 #0d1216 #0c1014 #0b0f12 #0a0d10 #080b0e #07090c #05070a`.

### Contrast (WCAG 2), measured

`python3 tools/art/contrast.py` computes these from the hex values; `shoot.mjs` re-measures the
rendered text styles (≥ 4.5:1, as Earth's History's does).

| Pair | Light | Dark |
| --- | --: | --: |
| `--ink` on `--bg` / `--panel` | 15.89 / 17.06 | 15.85 / 14.60 |
| `--ink-2` on `--bg` / `--panel` | 6.63 / 7.11 | 7.56 / 6.96 |
| `--ink-3` on `--bg` / `--panel` (lowest text) | **4.68** / 5.02 | 5.73 / 5.28 |
| `--ink-2` on glass over land / sea / the deepest band | 7.03 / 6.92 / 6.61 | 6.90 / 6.98 / 7.10 |
| `--ink-2` on glass over black / over white (the relief's extremes) | 5.68 / 7.11 | 7.10 / **5.26** |
| `--fault` on land / sea | 8.82 / 7.66 | 9.81 / 11.08 |

### The depth ramp: one ramp, both themes

Stops at **0 · 10 · 35 · 70 · 150 · 300 km**, interpolated in OKLab:

| km | 0 | 10 | 35 | 70 | 150 | 300 |
| --- | --- | --- | --- | --- | --- | --- |
| stop | `#fde28d` straw | `#f5a231` amber | `#dc6673` rose | `#9a6299` mauve | `#5d47ad` violet | `#2a3b6b` slate navy |
| L* | 90.4 | 73.2 | 58.0 | 49.4 | 37.6 | 25.8 |

**Why these replace DESIGN's first stops.** Those stops passed their color-vision check (10.5), but
their 35 km stop, `#e3665a`, was a signal red, and in an earthquake app a red dot says *danger*. It
is also where the most dots sit in Alaska's intermediate-depth bands. Their deepest stop, at L* 18.8,
vanished on a dark sea. The new 35 km stop is a rose, and the deep end stops at L* 25.8, which stays
visible on soot. The stops were found by a seeded search in OKLCh that kept L* monotonic, put the
35 km hue between rose and raspberry (never red), and maximised the smallest neighboring ΔE2000
under the three simulated color-vision deficiencies. `design_measure.py ramp` (updated to these
stops) printed, from `Template/scripts/us_quakes`:

```
normal  L* [90.4, 73.2, 58.0, 49.4, 37.6, 25.8] monotonic True  dE2000 neighbours [19.1, 35.8, 21.5, 18.0, 13.8]
protan  L* [88.7, 68.8, 52.2, 47.7, 38.8, 27.3] monotonic True  dE2000 neighbours [15.2, 27.4, 23.0, 12.0, 11.9]
deutan  L* [91.4, 75.8, 61.4, 50.5, 37.1, 24.9] monotonic True  dE2000 neighbours [12.2, 19.4, 31.2, 17.3, 11.7]
tritan  L* [88.7, 71.2, 58.0, 49.8, 38.7, 26.4] monotonic True  dE2000 neighbours [18.2, 12.4, 16.9, 31.6, 15.0]
smallest neighbour dE2000 over the four: 11.7
```

That is better than the stops it replaces (10.5). The ramp is **not a heat scale**: warm is shallow
because shallow rock is near the sunlit surface, and cold is deep. The legend says "Depth", never
"intensity".

### Rims: the mark is the same in both themes

A dot is its fill plus a 1-device-px rim, and **the rim is chosen by the dot's own depth, not by the
theme**. A dot shallower than **60 km**, or with no depth, gets a dark rim `rgba(16,20,24,.55)`. A dot
at 60 km or deeper gets a light rim `rgba(255,255,255,.50)`. So a given earthquake looks identical in
light and dark, and each dot's contrast comes from whichever of fill and rim differs from the ground.
From `contrast.py`:

- Light theme: a dot under 60 km is carried by its dark rim (3.89:1 on land, 3.76 on sea). A dot at
  60 km or deeper is carried by its fill (≥ 3.57 on land, ≥ 3.11 on sea).
- Dark theme: a dot under 60 km is carried by its fill (≥ 3.90 on land, ≥ 4.41 on sea). A dot at
  60 km or deeper is carried by its light rim (5.11 on land, 5.33 on sea).
- The one weak pairing is the light theme's deepest sea band. A dot at the 60 km switch shows 2.07
  there by fill, while its dark neighbor just above 60 km shows 3.26 by rim. Such dots are few:
  intermediate-depth earthquakes lie under the arc, not over the trench. The study shows it.
- In the section plot, which is a dense cloud on a plain ground, the light rim drops to `.30`. At
  `.50` the study's dark plot turned the slab lavender. The dark rim stays `.55`.

The no-depth gray `#8a9099` takes the dark rim (fill 2.73 on light land, 5.10 on dark land).

### Volcanoes: the one place red means danger

The aviation color code is USGS's own signal, and it is data. Triangles are filled with GREEN
`#4f9a5a`, YELLOW `#f2cc38`, ORANGE `#ee8a2a` or RED `#d0342c`, with a 1 px `--ink` outline and a
1 px `--panel` halo, so the shape (a triangle, never a disc) keeps them apart from the depth ramp's
straw and amber. A volcano that is not monitored is an empty triangle. RED is the only red in the
app, and it appears only when USGS has issued it.

---

## Layers: the data reads first

Bottom to top. The change from DESIGN is that the lines now sit **under** the dots, because a fault
drawn over the San Andreas's own earthquakes would cross out the very dots it explains.

| # | Canvas | Draws | During a gesture |
| --- | --- | --- | --- |
| 1 | `#base`, 2D | sea, the eight depth bands, land, lakes | moved by CSS transform |
| 2 | `#relief`, WebGL2 | the shaded relief (DESIGN §5.2's shader, alone in its own context) | moved by CSS transform |
| 3 | `#lines`, 2D | coast, country and state lines, faults | moved by CSS transform |
| 4 | `#gl`, WebGL2 | the earthquakes, and the play trace | redrawn every frame |
| 5 | `#over`, 2D | volcanoes, labels, the selection ring, the section line and corridor, the story annotation | moved by CSS transform |

- **Relief** stays low: `uDark` / `uLight` start at **0.40 / 0.20** light and **0.55 / 0.08**
  dark, down from 0.55 / 0.30 and 0.70 / 0.12. The land is a surface for dots, not a picture of
  itself. The builders tune these once on the Lower 48 at the default view, and they may lower them
  but never raise them above DESIGN's. (The QA pass raised the light shade to **0.50**, measured:
  change list 20.)
- **Lines**: coast 0.9 px `--ink` at 55 %; countries 0.8 px at 45 %; states 0.6 px dashed 3/2 at
  30 %; faults in `--fault` with DESIGN §10.1's weights and alphas, times 0.55 at the wide chips and
  rising to 1 at zoom 5 (the California chip is 0.62), so at regional scale the earthquakes read
  before the faults. The selected fault is 2 px `--ink` over a 3 px `--panel` halo, drawn on `#over`.
- **Labels**: Atkinson 400 at 11 px in `--ink-2`, with a 3 px `--bg` halo. City names are set in
  sentence case, never all caps. Volcano names are Atkinson 400 at 10.5 px in `--ink-2`, from zoom 4.5
  (`log2(s / sMin)`; the regional chips are 3.2–3.3), or at any zoom for a volcano above Normal or
  the one chosen, so at the California and Pacific Northwest chips the cities are named first. No label
  runs off the right edge or under the foot's glass (scale bar, legend, credit line, notices).
- **Past the map's edge** (the basemap's, 168° E–55° W and 25° S–81° N, DESIGN §25) the paper is
  hatched in `--hatch-map` (the strip's "no record" hatching at half strength, 7 px apart) and the edge
  is a 1 px `--line-strong` rule, so where the panel is wider or taller than the map (the opening's whole
  arc, the widest zoom) it reads as designed, not as a map that failed to load. The chips' framings on
  a phone never reach it: the view is held inside the map (DESIGN §4.2).
- **The selection**: a 1.5 px `--ink` ring 4 px outside the dot, over a 1 px `--panel` halo. It is
  never colored.

---

## The signature control: the record strip

One 56 px strip, full content width (358 px), at the head of the sheet in both modes. It is drawn
like a length of drum record: `--rule` ruling, a 1 px `--ink` baseline, ink marks, and hatching
where there is no record. Its geometry is the same in both modes:

- rows 0–10: a 10 px mono label line (the count on the right in Live, the maximum on the left in
  History);
- rows 12–44: the plot band, 32 px;
- row 44: the baseline;
- rows 47–56: the 10 px mono axis labels.

A 22 px left gutter carries the vertical labels ("M 4", "M 6"), which never sit on a mark (the study
shows the collision this avoids).

### Live: a magnitude–time record
- **x** runs from `feed.generated − window` to `feed.generated`. It is linear, with UTC ruling: hour
  lines for Day, day lines for Week and Month, and every 7th line at full `--rule` strength. The axis
  names days ("Dec 1", "8", "15", "22"), or hours for Day ("06", "12", "18").
- **Each earthquake is a stem**: 0.5 CSS px (1 device px) of `--ink`, from the baseline to its
  magnitude, on a linear scale from the window's floor (M −1 for All sizes, M 2.5 for M 2.5+) to
  `max(6, ceil(largest))`, with dotted `--rule` lines at whole magnitudes. The ink's strength
  carries the size: α **0.28** below M 2.5, **0.45** from M 2.5 to 4, **1** from M 4. So a busy
  stretch is thick with ink, as a real record is. That is a count, not an effect.
- **Heads**: from M 4.5, a stem ends in the event's own dot at 0.8 of its map size, capped at M 5.5,
  in its depth color and rim; a hollow dot if it is automatic.
- **The largest** in the window is labeled "M 7.0" beside its head, in mono `--ink`.
- **The tail since the feed**: if the phone's clock is later than `feed.generated`, a hatched block
  follows the baseline's end. Its width is the feed's age on the same time scale, at least 6 px and at
  most 25 % of the strip, labeled under the axis with the age ("2 h"). The pen has stopped, and the
  paper shows it. With a wrong clock (a negative age) there is no tail.
- **Tap or drag** along the strip selects the stem nearest the finger within 12 px, the larger
  magnitude winning within 3 px, and **the pen** — a 1 px `--ink` line the height of the plot band,
  the opening's cursor — stands on the selected stem. While the finger is down nothing else moves: the
  sheet keeps its height, so the strip stays under the finger, and the map keeps its view while the
  ring and the card follow. On release the sheet lifts to Half and, only if the event is off the free
  map, the view flies to it once. The strip is a second way into the same data.

### History: a record of the century
- The **stub** is the left 25 px, 1600–1900, hatched, with "625" (from `about.json.numbers`) above
  it, and cut from the linear part by an axis-break mark `//` on the baseline, not by a wavy line.
- **Bars**: one per calendar year at the current floor, in `--ink`, 0.6 px apart, on a linear scale
  to the tallest year, with "max 910 · 2020" in the label line (the M 4+ figures from the cache). The
  study prints the M 4+ maximum as 910 in 2020, and 1964 as 203.
- **Emphasis instead of color**: bars inside the window at α 1, and the others at α 0.42. During
  Play, bars already played rise to α 0.7, so the record visibly fills in behind the thumb.
- **The window** is a bracket of two 1 px `--ink` verticals with 3 px feet at the top, over a 7 %
  `--ink` wash, like a register mark on a strip chart, not a rounded selection pill.
- **The thumb** is a 12 px ring (2 px `--ink` stroke, `--panel` fill) on the baseline at the
  window's center, with a 44 × 44 px hit area.
- The current year's bar is hatched as partial. A gap between the history and the snapshot is
  hatched and named (DESIGN §7.1).

### The floor chips carry their own legend
The floor segmented control **2.5+ | 4+ | 5+ | 6+** draws, before each number, a disc at exactly the
map size of that magnitude (2.2, 3.7, 5.2 and 7.4 px), in `currentColor`. The control is its own
key: choosing 5+ says "dots this big and up".

---

## Signature moments

1. **The month writes itself (first launch).** When the first snapshot is decoded, and only once
   (`uq.intro` is stored before it starts), the view opens on the whole domain, the arc from Attu to
   San Juan (the box fitted to the panel). The Live window is **Month, All sizes**. Then `uT1` runs
   from `feed.generated − 30 d` to `feed.generated` in **3.0 s**, linear in time. The dots appear at
   their true times, each at full strength and settling to its age alpha as the window's newest edge
   moves past it. The strip's stems appear in step, under a 1 px `--ink` cursor. A line in the Live
   head reads "The last 30 days, as recorded", in place of the summary. Then the view eases to the
   Lower 48 over 600 ms. Any touch or key ends it at the final state; so does a hidden page. It never
   runs under Reduce Motion or without a snapshot. It is a replay of real times at a stated speed,
   not an animation of the ground.
2. **A—A′: drawing the section.** With Section on, the finger draws a survey line labeled in mono
   as geological maps label theirs, `A` at the start and `A′` at the end (both in 11 px mono on a
   `--glass` tab). The corridor is two 0.75 px `--ink` lines at the half-width, with ticks every
   50 km along the line, over a 6 % `--ink` wash. **While the line exists, events outside the
   corridor dim to α 0.25** and events inside keep their strength. The shader applies the same
   great-circle test as `section.js` (uniforms `uSecA`, `uSecN`, `uSecHalf`, `uSecLen`), in float32,
   where the difference from the float64 plot is under a meter. The plot redraws on every frame of
   the drag while its section takes under 12 ms, and on release otherwise.
3. **The section plot** is the one bold object of a section. It uses `--bg` ground, **true scale**,
   `A` and `A′` over its top corners, and distance labels every 100 km across the top. Down the left
   edge runs a 5 px **rail of the depth ramp at the true depths**, so the legend and the axis are the
   same object, with depth labels in mono beside it. There are dotted `--rule` lines at the ramp's
   stops (35, 70, 150 km) and a solid sea-level line. The 10 km line is dashed `--ink-3` and named
   **under** the plot as a key ("– – 10 km: depth often fixed here"); a label inside the cloud would
   be covered. A highlighted event (Cook Inlet's 2018 M 7.1) gets the selection ring and a mono callout
   ("M 7.1 · 2018 · 46.7 km") on a leader line into the emptier side, with a 3 px `--bg` halo. The
   study draws the Cook Inlet preset from the cache: 6,179 earthquakes with a depth, the slab
   descending to 249.1 km.
4. **1900 to now.** Play in History steps the window as DESIGN §7.5 says, and it also **leaves a
   trace**. Events from the play's first window up to the current window stay on the map as faint
   `--ink` specks: α 0.14, a fixed 1.6 px, no rim, no depth color. So by the time the play reaches the
   present, the plate boundaries have drawn themselves out of a century of real events. The trace
   uses one uniform (`uTrace0`) and costs nothing. It stays while paused and clears when the window is
   moved by hand or the mode changes. The legend names it: "Faint specks: earlier in this play". The
   label steps with no rolling digits; the count changes in one frame.
5. **Stories play their sequence.** 1964 Alaska, 2018 Kīlauea and 2019 Ridgecrest carry a `play`
   block (`tools/CONTRACT.md` §6), and the story card gets **Play the sequence**. It is cumulative:
   the window is `[from, from + k·step)`, one day (a week for Kīlauea) every 300 ms, with the
   label saying exactly what is drawn ("1964-03-27 to 1964-04-06"). Ridgecrest's July 4 M 6.4 and
   July 6 M 7.1 arrive on their days, and 1964's aftershock zone fills in around the rupture. On the
   map, the story's anchor event is annotated in the `#over` layer: a leader line from the ring to a
   `--glass` tab reading "M 9.2 · 1964-03-28", placed in the emptiest quadrant around the dot.
6. **A new event arriving.** See "The live feed" below.

---

## The live feed, present but never alarming

- **The stamp**, first in the Live head: "USGS feed **14:05 UTC** · 2 h ago", in Atkinson with the
  time in mono. **No amber and no red for staleness**: amber is a depth on this map. Age is said in
  words and shown in form:
  - under 3 h, the stamp as above;
  - from 3 h, "· 5 h ago, not refreshed since", with the age in `--ink` 700 and the strip's hatched
    tail growing;
  - from 48 h, a notice over the map, "This copy is 3 days old. It shows nothing newer than
    2026-09-27 14:05 UTC.", and the same words at the top of the Live body.
- **The largest events**: the head's third row is the largest in the window ("M 4.9 · 48 km S of
  Sand Point, Alaska · 3 h ago ›"), magnitude and age in mono. The body's list of the ten largest
  starts every row with the event's own dot at its map size (capped at 14 px) in a 16 px column, so
  the list and the map share one mark.
- **A new event arriving.** When `visibilitychange` brings a snapshot with rows newer than the
  previous `feed.generated`:
  - the strip's baseline extends to the new feed time and the new stems are written left to right
    in time order over 600 ms, as a pen writes, while the hatched tail shrinks;
  - on the map, the new dots fade in from 0 to their own alpha over 400 ms, in the same order,
    **with no change of size** and no ring, pulse, glow or halo;
  - the Live head says "12 new since 13:05 UTC", with the time in mono, until the next window change
    or 10 minutes pass;
  - if a new event is the window's largest, the largest row takes it without animation.
  There is no sound, no vibration and no badge. Under Reduce Motion, everything appears at once.
- **"Not a warning service" is always on screen.** It is the first clause of the map's credit line,
  "**Not a warning service** · USGS · Natural Earth", in 10.5 px with the first clause in `--ink`
  700, so it shows at every sheet height where the map shows. At Full, the Live body's first line
  says it in full (DESIGN §10.2).

---

## Designed objects

- **Segmented controls** (Live | History, Day | Week | Month, the window, the floor, the section's
  width and stretch): one outlined object, 28 px tall with a 44 px hit area, a 5 px radius, a 1 px
  `--line-strong` outline and `--line` dividers. The "on" segment is filled `--ink` with `--on-ink`
  text in 700. The cells are equal-width grid columns, so the change to bold does not shift anything.
  Text is 11.5 px, padded 7 px. They are not pills and have no shadow.
- **Region chips** over the map are square-ended **tabs** on `--glass`: 26 px tall, a 4 px radius,
  a 1 px `--line` border, and 11.5 px Atkinson. They sit in a row that scrolls sideways under a fade
  mask. The marked chip is `--ink` with `--on-ink` text, and a moved view unmarks it.
- **Tools** (Layers, Section, focus): 36 px `--glass` squares with a 5 px radius and 1.25 px ink line
  icons drawn in SVG in the page (the Section icon is `A—A′` in mono; the focus key's is four corner
  marks, the frame of the sheet). Section when on is `--ink` filled. In focus mode the way out is a
  ghost of the same key in the map's top-right corner: no fill, a 1 px `--ink-2` outline, the corner
  marks turned inward over a 1 px `--bg` halo (change list 19).
- **The sheet**: `--panel` with a 1 px `--line` top edge, a **6 px** top radius (paper, not a
  stock 16 px card), and a 34 × 4 px `--line-strong` grip. There is no shadow over the map. The head
  is separated from the body by a hairline.
- **The event card** is a bulletin entry with a 1 px `--line` border, 6 px radius, 10 × 12 px
  padding, and no shadow. Its first line is **the event's own dot** at its map size, then "M 7.1" at
  17 px mono and its type code at 12 px `--ink-2`, and the ✕ on the right. Then the place (Atkinson
  700, 14 px), the time (12 px mono), and "Depth **8.0 km**" followed by a **depth gauge**: the ramp
  at 72 × 6 px with a 2 × 12 px `--ink` notch at the event's depth (a hatched gray bar when there is
  no depth). Then the review line and the fault and volcano lines in 12 px `--ink-2`, and the event
  page address in 11 px mono, selectable, breaking anywhere.
- **The legend**: compact over the map as a `--glass` tab, with the word "Depth" in 10 px Atkinson
  700, the ramp at 112 × 6 px, and "0 · 35 · 300 km" in mono ("0 · 22 · 186 mi" in US units). Tapping it opens "Reading the map" as a
  card above it, with rows of drawn keys (each key drawn with the app's own renderer, not an icon
  font): the four dot sizes with "each whole magnitude doubles the area; M 2.2 and below share the
  smallest dot"; the ramp with all six stops; hollow at M 6 and at its M 4 floor; gray and ×; three
  fault weights; dotted class B and dashed inferred; the five volcano triangles (or "volcano status not
  available in this copy"); the trace specks.
- **Notices** (over the map): one line on `--glass` with a 1 px `--line` border and a 5 px radius,
  12 px Atkinson, centered above the scale bar. A leading glyph appears only where it names the thing:
  `A—A′` in mono for the section hint. There are no icons for their own sake and no colored bars.
- **The scale bar**: a 1 px `--ink` rule with end ticks, labeled in 10.5 px mono "100 km · at 61° N".
- **Lists**: rows 40 px tall with 1 px `--line` separators. The magnitude column is in mono, 44 px
  wide, and aligned; the place is in Atkinson with an ellipsis; the time is right-aligned in mono
  `--ink-2`.
- **Focus**: a 2 px `--ink` outline with a 2 px offset in `--panel` on every control, never a hue.

---

## Motion and easing

**One curve**, `cubic-bezier(0.25, 0.8, 0.3, 1)` in CSS and its JS twin for view moves: a critically
damped approach, fast out and a long, quiet arrival, **never overshooting**. Nothing in the app uses
a spring with bounce, an elastic ease or a shake.

| What | Duration |
| --- | --- |
| Segments and chips cross-fading their fill | 120 ms |
| The sheet changing height | 240 ms |
| A region chip or a list row moving the view | 450 ms |
| A story moving the view | 600 ms |
| New dots fading in | 400 ms |
| New stems being written | 600 ms in all |
| Cards and the legend card appearing (4 px rise and fade) | 160 ms |
| The opening | 3.0 s of replay, then 600 ms to the Lower 48 |
| A fling | decays as DESIGN §4.3 |

Nothing loops, and nothing moves while nothing is happening: the dirty-flag scheduler (DESIGN §5.6)
is idle between gestures.

**Reduce Motion** (`prefers-reduced-motion: reduce`):

| Off, replaced by | |
| --- | --- |
| The opening | never runs; the app opens on the Lower 48, Live, Month |
| View moves (chips, stories, list rows) | jump |
| The fling | stops on release |
| New stems and dots | appear at once |
| The sheet and cards | take their state at once |
| Play, and story play | still step, since a step is a state change and not a motion |

---

## Deliberately restrained

- No accent color. The chrome is ink: every chrome token has an OKLCh chroma of at most 0.0194
  (light `--ink-2`, the blue-gray bias of the paper), measured from the hex values.
- No gradients anywhere in the chrome. The ramp's own bar is the only gradient on screen.
- No shadows except the legend card's 0 2px 8px `rgba(0,0,0,.12)` in light (none in dark, where a
  hairline does the job).
- No glass blur. `--glass` is a flat 90 % fill; a backdrop blur over the dots would smear data.
- No map frame, no neatline, no vignette, no graticule, no compass rose, no place-name typography
  beyond 11 px.
- No big-number tiles. The count is a line of text.
- No icons beyond Layers, Section, the focus frame (in and out), About and the grip.
- The type is compact and never over 17 px; controls are 26–28 px, with 44 px hit areas.
- **No library**: plain WebGL2 and Canvas 2D, as DESIGN planned. Two typefaces, five files.

## Never

- **No invented shaking**: no screen shake, no wobble on a new event, no waveform drawn as
  decoration. The strip's stems are catalog rows; a wiggle line would be a seismogram the app does
  not have.
- **No glow, pulse, ripple or expanding ring** on any earthquake, new or old. Those read as a live
  alert, and this is not one.
- **No red for depth**, and no red or amber for staleness or errors. The only red is a volcano's
  RED code, from USGS.
- **No heat-map language**: the legend never says "intensity", "activity level", "risk" or
  "hazard", and colors never mean them.
- **No smoothing, blur or density** layer. The ink in a busy strip is a count of marks.
- **"Not a warning service" is never hidden**, collapsed or moved into About only.
- **No color on the chrome**, so no color on screen is ever decoration.
- **Nothing is animated between positions.** A dot appears or fades in where it is; it never travels.

---

## Libraries and vendored files

| What | License | Bytes | Decision |
| --- | --- | --: | --- |
| Atkinson Hyperlegible 400, 700 (latin + latin-ext) | SIL OFL 1.1 | 53,488 | vendored in `fonts/` |
| Red Hat Mono 500 (latin) | SIL OFL 1.1 | 9,960 | vendored in `fonts/` |
| `fonts/OFL.txt` | — | 5,294 | vendored |
| IBM Plex Mono | OFL with Reserved Font Name "Plex" | — | rejected: a subset may not carry the reserved name |
| Newsreader | OFL | — | not used; it is Earth's History's voice |
| d3 / chroma.js (ramp, scales) | ISC / BSD | — | rejected: OKLab interpolation is 30 lines, as in the study |
| MapLibre, three.js, deck.gl | BSD / MIT | — | rejected, as in DESIGN §19: plain WebGL2 draws 445,000 points in one call |

**Total vendored: 68,742 bytes, all fonts.** No code library earns its bytes here.

---

## The study (`tools/art/`, left out of the ZIP)

- `study_data.py` extracts real rows from the pipeline cache through `design_measure.earthquakes()`
  into `study-data.json` (227,448 B). It printed: "years 126; max M2.5+ 26763 in 2018; max M4+ 910;
  before 1900 625; Cook Inlet 6179 rows, length 612.6 km, deepest 249.1; Dec 2025 1659 rows".
- `study.html` draws the top bar, the map's glass objects on flat ground swatches (labeled "not a
  map"), the Live strip (December 2025, M 2.5+, where the 2025 Hubbard Glacier M 7.0 is the largest),
  the History strip (M 4+, 1964), the floor chips, the 1964 event card, the legend and the Cook Inlet
  section plot, all with the vendored fonts. Serve `us-quakes/` over HTTP and open
  `tools/art/study.html` (add `?dark` for the dark theme).
- `study-light.png` and `study-dark.png` are 780 px wide (390 px at DPR 2). They were taken with
  Playwright 1.63.0 headless Chromium, which reported 0 console errors and warnings in either theme
  and the three faces loaded: "Atkinson Hyperlegible 400, Atkinson Hyperlegible 700, Red Hat Mono 500".
- `contrast.py` prints every contrast figure in this file.

The study is a reference for proportion and tone. It is not code to copy into the app, apart from
the OKLab ramp function and the `@font-face` rules. The "2 h" tail and the chip states in it are
illustrative UI state; every mark is a catalog row.

What the study caught, and this file already fixes: the slashed zero in the legend (hence mono for
data); the strip's labels colliding with stems (the 22 px gutter); a second row for the feed stamp
(the stamp is now Atkinson with a mono time, and segments are padded 7 px); the 10 km label buried
in the dots (now a key under the plot); the floor chips overflowing 358 px (now 11.5 px); and the
dark plot washed out by white rims (the section's light rim at `.30`). It also shows a horizontal
row of dots near 33–35 km on the Cook Inlet plot, which looks like a second assigned depth. That is a
**question for the builders' quote stage, not a label**: nothing about it is said on screen until a
USGS page saved in `credits/` says it.

---

## Change list against DESIGN.md (applied there in place)

Each item names the DESIGN section it changed. `DESIGN.md` §19 lists them again as decisions.

1. **§3.1 Top bar**: the title is Atkinson 700 at 15 px; Live | History is a segmented control as
   styled above.
2. **§3.2 Map panel**: the chips become square-ended tabs; the tools are 36 px glass squares; the
   compact legend is 112 × 6 px with "0 · 35 · 300 km"; the credit line reads "Not a warning
   service · USGS · Natural Earth"; notices use `--glass`; a new notice appears from 48 h of age.
3. **§3.3 Sheet**: a 6 px radius, a 34 × 4 px grip, no shadow.
4. **§3.4 Live**: the head is the stamp row, **the record strip (56 px)** and the largest row, with
   the summary moved into the strip's label line. Staleness is shown by words, weight and the hatched
   tail, **with no amber**. The default window is **Month, All sizes**. List rows start with the
   event's dot. "N new since …" appears on a refresh.
5. **§3.5 History**: the timeline is the record strip in its History form; the floor chips draw their
   dot sizes; the window chips are one segmented control.
6. **§5.1, §5.2, §5.4, §5.5, §5.7 Rendering**: five layers (`#base`, `#relief`, `#lines`, `#gl`,
   `#over`), so that lines sit under the dots. The relief moves to its own WebGL2 context and is
   CSS-moved during gestures like the 2D layers; both contexts share the loss and restore path. Relief
   strength drops to 0.40 / 0.20 light and 0.55 / 0.08 dark.
7. **§6 How an earthquake is drawn**: the new ramp stops; the rim chosen by depth (dark under 60 km,
   light from 60 km, and `.30` light in the section plot); the play trace; the section-corridor
   dimming.
8. **§7.3 Timeline**: the strip's geometry and marks (bars in ink, emphasis by alpha, the bracket
   with feet, the 12 px thumb ring, the `//` break).
9. **§7.5 Play**: the trace, and played bars rising to α 0.7.
10. **§7.6 Stories**: the optional `play` sequence for three stories, and the anchor annotation.
11. **§8.3 Card**: the dot, the mono magnitude, and the depth gauge.
12. **§9 Section**: `A` / `A′`, the corridor's ticks and wash, dimming outside, the live plot while
    dragging, the ramp rail, the key under the plot, and the callout.
13. **§10.1 Layers**: faults in `--fault` graphite or pencil; the volcano triangles' outline and
    halo; the sea-band tints.
14. **§12 Themes and type**: the tokens and type above replace the starting ones.
15. **§13 Budgets**: fonts 68,742 B (in the ZIP about the same, since WOFF2 is already compressed);
    one more WebGL context and one more 2D backing store (about 4 MB each at DPR 2) in the memory
    budget.
16. **§14 File layout**: adds `fonts/` (shipped) and `tools/art/` (not shipped).
17. **§16 Tests**: `check.mjs` asserts `fonts/` holds exactly the five files and `OFL.txt`, and that
    the ramp stops in `js/ramp.js` equal this file's. `shoot.mjs` adds the opening (watched, then
    skipped; never under Reduce Motion; never twice), a strip scene per mode, a new-snapshot arrival
    (the "new since" line; no element with an animation other than opacity), the section drag with
    dimming, a story's play sequence, text contrast ≥ 4.5 over every rendered text style in both
    themes, and a check that no computed color on a chrome element has an OKLCh chroma above 0.025
    ("chrome is ink"; the most chromatic token, light `--ink-2`, measures 0.0194).
18. **§18 Hand-off**: done; it now points here.

Added by the QA pass (2026-09-30), applied in `DESIGN.md` §22–§23:

19. **§22 Focus mode** (new): the working sheet trimmed to its record. The chrome leaves (top bar,
    chips, keys, legend, grip, the sheet's body, the Live window control and largest row), each hidden
    and inert; the map runs from the top of the screen to a band holding the record strip in its
    current form; the scale bar, the notices and the credit line with "Not a warning service" stay. In
    by a fourth key in the column (corner marks), out by its ghost in the top-right corner or Escape. The
    controls fade over 160 ms on the one curve and the view eases to its re-fit over 240 ms; nothing
    under Reduce Motion. A selection's card opens over the map as a `--glass` card above the scale bar.
    No accent, no shadow, no blur: the ghost key is ink on the map, as a register mark is on paper.
20. **§5.2 Relief**: the light theme's shade `uDark` 0.40 → **0.50** (uLight 0.20 unchanged; the dark
    theme unchanged). In light the relief shows only by its shade (lit slopes are nearly the land's
    white), and at 0.40 its shaded 5th percentile was 1.34:1 against bare land; at 0.50 it is 1.45:1.
    Still under DESIGN's 0.55 / 0.30, and gray, so every color on screen is still a measurement.
21. **§10.1 Volcanoes**: the triangles recede at wide zoom: 0.65 of their size with a 1.5 px halo and a
    0.75 px outline at the Lower 48's and Alaska's scale, full size (3 px, 1 px) from the regional chips
    in. The fill is still only USGS's color code.
22. **§3.5 History label**: two lines by design (the window and floor; the counts), three when × are
    drawn (the × counted apart, in `--ink-2`), inside the Play key's 44 px row, so the head never
    changes height.
23. **§4.4 Region chips**: a box is fitted between the chips and the foot (scale bar, legend, credit
    line), not into a band that ran under the foot, and the key column is kept clear only when the box
    reaches it: the Lower 48 is centered in the free map and 14 % larger at Peek.
24. **The second fix pass (DESIGN §24)**: numbers mono and words Atkinson in mixed lines, `tabular-nums`
    applied; the strip's pen on the selected stem and a drag that moves nothing but the selection; the
    hatching past the data's edge; faults and volcano names recede at regional zoom; the CONUS relief's
    edges fade; a hollow ring never smaller than an M 4 dot.
25. **The lead's pass (DESIGN §25)**: the basemap runs past the axis to 168° E–55° W and 25° S–81° N, so
    every chip's framing on a phone is map to its edges; the hatching now marks only where the map ends
    (the opening's whole arc, the widest zoom). The same sea tints, land and lines, simplified more
    coarsely where no chip looks closely. A 2D hollow ring is whole (no notch at 3 o'clock). `nums()`
    reaches About, the stories, the section caption and the cards' fault and volcano lines, with years
    in prose, names and USGS's quotes left in Atkinson; `.mono` does not wrap. The compact legend's
    stops follow the units ("0 · 22 · 186 mi"), and the catalog's fixed depth reads "10 km (6 mi)". The
    Live pen's nib sits clear of the count label. Focus mode rings the ghost key only when it was
    reached by keys: no accent, no ring, on the map after a tap.
