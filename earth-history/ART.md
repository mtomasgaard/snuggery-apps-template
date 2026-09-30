# Earth's History — art direction

## The look: Deep Field Atlas

A plate from a field atlas, photographed at night. The Earth hangs in its own dark field, in both
themes, framed by the plate's neatline and lit like an object rather than drawn like a diagram. Under it the page turns to paper: an
atlas voice for names and ages, a hyperlegible sans for everything read closely. The one bold
object is the time control, drawn as what it measures: a stratigraphic column laid on its side.

Every effect is presentation and nothing more. The painted maps, the climate fields and the
plate geometry are untouched. The night, the frame, the atmosphere and the shading are display
choices, and About says so in as many words.

## Type

| Role | Face | Size / line | Where |
| --- | --- | --- | --- |
| Age number | Newsreader 500, tabular lining figures | 21 / 21 px | the age row, and its rolling twin |
| Age unit | Newsreader 400 italic | 15 px | "million years ago" |
| Names | Newsreader 500 | 14.5–17 px | the app title, period names, card and event headings, cities, tile values |
| Captions | Newsreader 400 italic | 11.5–13.5 px | era names over the bar, the legend's one-line title, the notices (on black glass), the opening's line |
| Text and controls | Atkinson Hyperlegible 400 / 700 | 10, 11, 11.5, 12, 12.5, 13.5 px | everything else |
| Section labels | Atkinson 700, all small caps, +0.08 em | 12.5–13 px | THIS MAP, THEN AND NOW, the ledger's keys |

The scale runs 10 / 11.5 / 13 / 14 / 17 / 21 px. Every counter uses tabular figures: the age, the
tick labels, the legend numbers, the tile values and the Find coordinates. Atkinson's slashed zero is
the typeface's own legibility feature, kept deliberately; in prose ("2016", "230 million years") it
is conspicuous and can read like "Ø", and whether to set the sheet's and About's numerals in
Newsreader instead is left to the owner of the app. Neither face has the subscript "₂", so
"CO₂" takes it from the system face. Both fonts are vendored in `fonts/` (82,696 bytes of WOFF2,
plus OFL.txt, 4,984) and credited by `tools/90_about.py` in CREDITS.txt and About.

## Palette

Chrome follows the theme. The Earth panel is night in both themes, and the ICS colors, the lens
ramps and the overlay colors never change. The light theme is survey paper, a pale mineral gray
with a green bias rather than cream: warm cream with a serif is the stock look of templated pages,
and a map margin is cooler than that. The dark theme is deep navy.

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` | `#eceee9` | `#0a1120` |
| `--panel` | `#f7f8f5` | `#0f182b` |
| `--tile` | `#e4e8e2` | `#16213a` |
| `--ink` | `#16201f` | `#e8ebe6` |
| `--ink-2` | `#4e5a57` | `#9ea9ba` |
| `--line` | `#cfd5cd` | `#1f2b45` |
| `--accent` (survey blue) | `#1d5a7e` | `#86b6e6` |
| `--space` (the Earth's field) | `#05070c` | `#02040a` |

The instruments on the Earth panel are theme-independent: black glass `rgba(12,16,26,0.66)` with a
hairline of `rgba(255,255,255,0.15)`, text `#eef0ea` and `#b3bcc8`, and a chalk key `#e6ebe3` with
`#121a1c` text for whatever is on.

**Contrast, measured** (WCAG ratio; a Node script over the tokens, then `shoot.mjs` over 35 rendered
text styles in each theme). Light: ink on bg 14.26, ink-2 on bg 6.15, on panel 6.74, on tile 5.79;
accent on bg 6.38; curve colors on bg 5.21 (temperature), 6.11 (CO₂), 5.39 (sea). Dark: ink-2 on bg
7.93, on tile 6.73; accent on bg 8.84. Panel glass: `#eef0ea` 16.91, `#b3bcc8` 10.12; chalk key
14.58. The lowest rendered style is `.tile-k`: **5.79:1 light, 6.73:1 dark**.

## Motion

Motion is a single language: an eased settle (`cubic-bezier(.22,.61,.36,1)`), about 200–300 ms.
Nothing moves when nothing is happening. Every loop stops when it lands, and every motion is off
under Reduce Motion or when the page is hidden.

- **The opening**, once, on a first launch only, as soon as the previews are on the GPU. The globe
  fades in at 750 Ma, small, then the 90 maps play to today in five seconds, each map's own
  low-resolution preview as while scrubbing (at 0.6 of the globe's size, so they are magnified less),
  and the globe grows into place over the last second. The counter rolls and the thumb sweeps the
  bar. Then today's full map fades in and the controls appear. Skip, any touch or any key ends it.
  It is stored (`eh.intro`) before it starts and never runs under Reduce Motion.
- **The land stays in view.** The view follows a point of today's Africa (Kinshasa, plate 701, the
  model's reference frame) as the model carries it, map after map, in the opening and afterwards,
  easing there (τ 180 ms) at each stop. A drag or a turn to a place hands the view to the person;
  a double-tap gives it back. Measured over the 90 maps, the followed view never shows less than
  20 % land; a fixed view on the Americas showed under 10 % on 42 of them.
- **Play is a time-lapse.** The thumb glides linearly from map to map, and the age counts toward
  each map's age and lands on it exactly. The count never strays past the neighboring map's age,
  however slow the frames are.
- **Pins drop and settle**, and their shadow firms up as they land (420 ms).
- **The sheet glides.** The grid takes its new size at once (every test measures it straight away),
  then the rows under the Earth slide from where they were, 280 ms, over an extension of the night.
- **Keys and chips** cross-fade their fill. Cards and overlays rise 4–10 px as they appear.
- **The curves** mark the current map with a hairline and a small glowing dot on each series.

## Signature moments

1. **The stratigraphic bar.** The ICS period colors are the track itself, 22 px tall, under a 3 px
   band of era colors, the way the chart nests its columns. Italic era names ride above it, and a
   hairline comb of the 90 maps and the rounded era starts sit below. The squeezed 750–550 Ma
   stretch is hatched, as the curves hatch it, and ends at a wavy unconformity cut. The thumb is a
   ring, so the period's own color shows through it.
2. **The plate and its night.** The panel is framed by a neatline, a hairline and a finer rule
   inside it, as an atlas plate is. Behind the Earth there is only night: a faint navy deepening
   toward it, and no stars (a star field behind a glowing globe is every globe demo). A thin
   scattering rim lights the limb on the lit side, with a tight halo just outside it. There is no
   terminator, because nothing in the data says where the Sun was. The globe sits between the
   controls, so the legend and the notices are set under it like a plate's caption.
3. **The toggles are legends.** Coasts and Plates each carry a swatch of the overlay's own line
   drawn on night: white over a dark halo, and an amber outline.
4. **The card is a callout** with a pointer on its pin. Collapsed, it never cuts inside a number: a
   figure group stays whole, and the footnote marks wait for the chevron that opens the rest.
5. **"Then and now" is a ledger**, ruled with hairlines the way a field notebook tabulates, not a
   grid of rounded stat cards.

## Deliberately restrained

- One accent, survey blue, used only for focus rings and text buttons. The panel uses chalk, not
  color, for "on".
- No gradients on chrome, no glows on text, no drop shadows beyond the card, the sheet's edge, the
  keys, the thumb and the pins. The only glows belong to the Earth's atmosphere and the curves' current-age dots.
- No graticule, clouds, ice, weather, terminator or night side, and no relief beyond Scotese's
  painting.
- Overlays are thinner than before. Coasts are 0.8 px over a 2.25 px halo. Plate outlines run from
  1.15 px down to 0.5 px and fade by area, so the large pieces read and the slivers recede. There are
  at most 16 arrows, 46 px apart.
- No library. Two typefaces, four files. The app code is within its 250,000-byte budget (the figure
  is in `NOTES.md`), so the cap in `tools/check.mjs` is unchanged.

---

## Change log

DESIGN.md §19 records the same changes against §3, §5, §6 and §9.

- **Fonts**: `fonts/` holds Atkinson Hyperlegible 400 and 700, Newsreader 500 and Newsreader 400
  italic (Template/anatomy's subsets), and OFL.txt, 87,680 bytes. `tools/90_about.py`'s software
  paragraph credits both faces in Template/anatomy/CREDITS.txt's words. Its "Display choices" caveat
  now names the bright rim and the stars. `tools/build_all.sh` rebuilt `data/about.json` (22,639
  bytes) and `CREDITS.txt` from the cache, and `verify_data.py` passes.
- **style.css**, rewritten on the tokens above: the type scale, the night Earth panel with glass
  controls and chalk keys, the stratigraphic bar, the age row, the callout card, the caption notices,
  the legend, the sheet's small-caps labels and serif values, the night loading screen, and the
  reduced-motion rules.
- **index.html**: legend swatches in the toggles; the card's pointer and "More" chevron; the
  opening's caption and Skip; the age line's rolling twin, with the swatch inline in the ICS line;
  the bar's era band, era names, hatch and unconformity; the round play key; curly apostrophes in the
  visible titles.
- **shader.js / earth.js**: the star field (a public-domain integer hash), a navy deepening toward the
  Earth, a quarter-level dither, the scattering rim and halo on the lit side, and slightly shallower
  lambert shading. New uniforms are `uFade` (the opening) and `uPx`.
- **overlay.js**: finer coasts, area-weighted plate outlines in four weights, fewer arrows with
  filled heads and halos, pins that drop, labels in Atkinson, and a hairline Mollweide edge.
- **timeline.js**: the era band and era names (measured, kept inside the track), the hatch, the
  rolling counter (#age keeps the true text, and its twin is aria-hidden), the play glide,
  `nearest` and `placeThumb`.
- **lut.js / app.js legend**: rain ticks are 0, 10, 50, 200 in and 0, 250, 1,000, 5,000 mm;
  temperature is −40, 0, 32, 60, 100 °F. The unit is set on the last number. The labels are placed by
  measured width and nudged apart, and hairline marks sit at the true positions. The rain caption
  reads "Rain and snow in an average year · climate model". The "100200" collision is fixed.
- **app.js**: the opening (`wantIntro`, `startIntro`, `introTick`, `endIntro`), the callout
  placement, the pin drop, the play glide, fonts reloading canvas text, and the glow read from
  `--glow`. The test surface adds `__eh.intro()`, `skipIntro()`, `card()` and `legendBoxes()`.
  `settled()` also waits for the opening and a pin drop.
- **curves.js**: Atkinson on the canvas, a finer hatch, and the current-age hairline with a glowing
  dot on each curve.
- **sheet.js**: the glide between heights (a FLIP), the period name in Newsreader with its range in
  the sans, and event titles in Newsreader.
- **tools/shoot.mjs**: new checks. The opening is watched, then skipped, in each theme, and never
  runs under Reduce Motion or after a reload. The legend labels do not touch in either unit system,
  for either lens. The card is a callout above its pin and "More" opens it. The age row stays inside
  its 48 px at all 90 stops. Contrast now covers 35 text styles. Screenshots wait for the resting
  state. `screenshots/` holds app.png and ten named scenes.

### Second pass

- **The star field is gone** (shader.js; `uPx` with it). In its place the neatline (style.css,
  `#earth::before` and `::after`). About's "Display choices" now names the night and the frame.
- **The Earth is seated between the controls** (proj.js `cy`), and **the view follows the
  continents** (app.js `followAt`, `followTick`; `eh.follow`; `__eh.follow()`), the opening included.
- **The opening** starts on the previews, runs the globe at 0.6 of its size and grows it into place.
- **Notices** sit on black glass, one clause per line. **The temperature legend** is one line; its
  definition moved to the accessible name and to About.
- **The card**: figure groups never break, footnote marks hide while collapsed, "then" gets two
  lines (three with no "now"), and it is no longer a live region; a short line is announced instead.
- **The sheet**: the ledger; no repeated range; the chart's line only where it disagrees.
- **Small things**: US spellings in every string the app shows, Find and About hold focus, the grip's
  focus ring and hit area, 38 px step keys, a pressed state on the icon and step keys, and the age
  row's live region cleared after it speaks.
