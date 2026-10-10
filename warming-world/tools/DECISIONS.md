# Warming World: decisions (does not ship)

The pass's record. `ART.md` and `NOTES.md` ship and say only what is true of the app; the reasons,
the rejected options and the open questions are here.

## Plan 0012, package 3.3 (2026-10-06): version 1.0 → 1.1

The owner's brief, word for word: *"Warming world: Allow option to show absolute temp rather than
diffeeences. On the difference mode, allow user to select base/starting point as an average range.
Full screen should not remove scale"*. With it, the change list for this app
(`docs/plans/0012-change-lists.md`, Warming World, items 1–4) and HOUSE §4.15 (the front), §12 (its own
ground, `#f5f5f5`, kept) and §13 (versions). No bug was on record for this app: matrix row 155 is "not
run", and neither `docs/plans/0009-launch-1.1.md` nor `docs/review/` names it.

### D-1. Absolute: ERA5's 1951–1980 average plus GISS's anomaly

- **Source.** The researcher's recommendation, taken: ERA5 2 m air temperature everywhere, never
  blended with sea-surface temperature (GISS defines its index as an air-temperature anomaly, with the
  sea surface's anomaly standing in for the air's; a blend reads 0.85 °C warmer globally). Anchored on
  a modern normal and moved to 1951–1980 cell by cell and month by month with GISTEMP's own mean
  anomaly, so recent absolute values rest on the best-observed years and every change over time is
  exactly GISS's.
- **The route built: WeatherBench 2's copy, not the Climate Data Store.** The CDS's monthly ERA5
  (1991–2020, CC BY 4.0) needs a free account accepted by the owner; this pass had none. WeatherBench
  2's 1990–2019 climatology (1.5°, 6-hourly by day of year, Licence to Use Copernicus Products) is open
  over HTTPS and was pinned by sha256 per chunk (`tools/climatology/build_climatology.py`; the 13
  chunks concatenated hash to the researcher's `f8be189f…`). Its 61-day smoothing is undone for
  harmonics 1–3 with the analytic gains of a uniform 61-day window on the 366-day circle (0.9549,
  0.8270, 0.6367; the researcher's numerical ones were 0.9547, 0.8261, 0.6349). **This is our own
  modelling step** and About says so: on the researcher's test field it leaves monthly errors of RMS
  0.20 °C and at most 1.28 °C over land. The annual plane is unaffected (2.8e-14 °C).
- **To move to the CDS later** (the owner's call): make the account, accept the licence, download
  `2m_temperature`, 1991–2020, monthly means, and add a reader for its NetCDF-4 (h5py or netCDF4) in
  place of `era5_monthly()`; drop `unsmooth()`; change `SHIFT_YEARS` to 1991–2020. Nothing in the app
  changes: the file's shape is the contract (`tools/CONTRACT.md` §5.5). Not built or tested here.
- **Measured on the build (2026-10-06, `build_climatology.py`, numpy 2.3.3, numcodecs 0.16.3):**
  ERA5 1990–2019 global annual mean 14.3458 °C on the app grid (14.3496 on the native points); GISS's
  1990–2019 mean shift 0.5939 °C, 1 765 of 194 400 cell-months filled from their row (the researcher's
  figures exactly); the 1951–1980 global means in tenths 118 120 127 138 147 154 157 155 149 138 127
  120 and the year 137 (13.748 °C after quantizing); cells −53.5 to +29.0 °C for the year, −64.0 to
  +38.0 for months; quantizing error at most 0.250 °C; Fairbanks' cell −4.5 (year), −23.5 (January),
  +14.5 (July), the researcher's values. `--check` rebuilds and finds the planes and metadata
  identical, and a second build is byte-identical (`cmp`).
- **Encoding.** 13 planes, one byte a cell at 0.5 °C from −80 °C, a row delta, zlib 9, base64, in
  `assets/climatology.json`: 101 349 B with its source and credits blocks (98 036 B without the credits
  block; the researcher's sample without metadata, 95 018 B). It is a static asset, never in `data/`,
  which the monthly refresh owns.
- **In the shader**, not as precomputed frames: the climatology goes up once as an R16I array texture
  (14 layers, the 14th the partial year's months averaged, 453 600 B on the GPU) and the shader adds it
  to the anomaly in integer tenths, then reads a 1024-entry LUT (−60.0 … +40.0 °C at 0.1 °C). A step
  change is still one uniform and one draw; 171 absolute frames (2 770 200 B more) were not made.
- **What is printed.** A cell's temperature to the whole degree (the researcher: absolute values vary
  by source far more than changes do); the global figure is the climatology's area mean plus GISS's
  global mean, with ±0.5 °C (GISS's baseline uncertainty), never a mean of the map's cells (1880's map
  would read 16.4 °C for lack of the poles). The card's chart and stripes stay the anomaly. The pole
  chip gives, in whole degrees and "estimated", the climatology's mean over the whole cap plus the
  cap's mean anomaly (D-8; first built as a mean of the cells with data, which the review caught).
- **The scale (owner call: taste).** Sequential, −60 … +40 °C, lightness rising with temperature,
  violet → indigo → blue → teal → sage → sand, checked in `check.mjs` (gamut, chroma, monotonic
  lightness under four visions, even 10 °C steps, ends, hatch). Rejected: a cold-pale/hot-dark ramp,
  whose tropics in deep brick would read as the anomaly map's +4 °C; any ramp through orange or yellow
  (ART's "never a color that reads as danger"); a symmetric ±45 °C scale (odd tick values). The light
  card sits nearest +17 °C (ΔE 0.066), the dark card nearest −56 °C (0.086); the limb's ring parts them.

### D-2. A baseline of one's own (Base)

- **The control.** A text key `Base 1951–1980` in a new first row of the legend, beside
  `Difference | Absolute`; it opens a sheet in the tap card's place with `From ‹ year › to ‹ year ›`,
  held keys repeating at 8 a second like ‹ ›. The span is drawn on the app's own time track: the
  bracket under the stripes moves with it and reads `1991–2020 = 0`. Dragging the bracket's ends on the
  track was considered and rejected: the track's whole row is the scrubber, and two gestures on one
  strip would make the scrub ambiguous.
- **The rule.** A cell's baseline is its mean over the span's complete years, in integer tenths, half
  away from zero, when it has a value in at least two thirds of them (rounded up: 20 of 30, as the
  researcher's shift used); otherwise it has none and is drawn as no data, and the card says how many
  years it has and needs. GISS's global means are re-expressed by subtracting their own mean over the
  span (hundredths). 1951–1980 chosen again is GISS's own base: nothing is re-expressed (the app's
  annual means over 1951–1980 are not exactly zero, and GISS's definition wins).
- **Months stay against 1951–1980.** The snapshot holds GISS's monthly maps for the last 24 months only,
  so a month cannot be averaged over other years. Subtracting the span's *annual* mean from a month was
  rejected: it would print a number the data does not hold under a label that reads as something
  else. The sheet and About say so; every label in Last 24 months names 1951–1980.
- **Labels.** Every difference now names its baseline, the default included: the year row
  (`Global mean +1.19 °C vs. 1951–1980`), the pole chip, the caption, the card, the bracket. This
  changes the default front's year row and chip by a few words (owner call: they could name it only
  when another span is chosen).
- **Absolute and the baseline.** Absolute does not depend on it; its card's chart and the stripes do.
- **Stored** as `ww.base` and applied once every frame is decoded (it is a mean over decoded years);
  until then, about 0.3 s on this Mac, the app shows GISS's base and says so in every label.

### D-3. The scale stays in focus mode

The legend's bar and caption stay at the panel's foot in focus mode; its new switch row is hidden and
inert. The globe does not shrink at 844 px tall (its radius is width-limited: 187.2 px as before). The
caption keeps working as the key into About (About now opens from focus mode). The card in focus mode
docks 6 px above the legend instead of 8 px above the panel's foot.

### D-4. The change list

1. The legend's credit (`#legend-credit`, its CSS, the narrow-screen "Data: NASA GISS, to …" append)
   is gone; the constant `creditLine()` is unchanged and About writes it as the first line under
   "Sources and citations" (`#about-credit-line`, `translate="no"`), followed by the climatology's
   attribution. `check.mjs` 7b pins it. A research copy below 360 px still says "From an archived
   copy." in the caption, because the stamp's tail is hidden there (a status, not a credit).
2. The caption stays, in each mode's words.
3. Prose (F5): `NOTES.md`'s legend and About lines now say "in About".
4. `miniapp.json` 1.0 → 1.1, nothing else in it changed; About prints `Version: 1.1`.

Checks changed by the same rule (F8): `check.mjs` (assets list, version, the credit, the new ramp);
`shoot.mjs`: the legend's credit half went (its height bound is now 92 px), `translate="no"` on the
legend no longer requires GISS in Difference (there is no source left in it), the focus-mode hidden
list lost `legend` and gained a check that the scale stays, the card in focus docks above the legend,
`Version: 1.1`, the year row's and pole chip's expected text gained `vs. 1951–1980`.

### D-5. The pipeline: a patch, not applied (the lead's ruling)

`assets/about.json` and `CREDITS.txt` are written by `Template/scripts/warming_world/build_static.py`,
and `verify_static.py` fails on any unclaimed file in `assets/` and on any numeral the prose types
without a reason. So the yearly demo build (`build-warming-world.yml`, 16 January) would **fail** on
`climatology.json`, and a rebuild would drop the ERA5 attribution. This pass writes only in the app's
folder, so the change to the pipeline is `tools/climatology/pipeline-0012.patch` (apply from
`Template/` with `patch -p1` or `git apply`): two About sections and an edited paragraph each in
`build_static.py`, the climatology's CREDITS.txt section read from `assets/climatology.json`, the
section list, numerals and a `check_climatology()` in `verify_static.py`, and an evidence file
`credits/era5-climatology-terms.txt`. The app's shipped `about.json` and `CREDITS.txt` are exactly what
the patched pipeline writes: run on a copy (`build_static.py --offline`, then `verify_static.py`:
"all checks passed"), twice, byte-identical; the unpatched pipeline was first shown to reproduce the
shipped files byte for byte. `world.json`, `places.json` and `data/snapshot.json` are untouched.

### D-6. Licence

ERA5: CC BY 4.0 at the CDS. WeatherBench 2's copy: the Licence to Use Copernicus Products (commercial
use allowed; clauses 5.1.2 and 5.1.3 require the modification notice and the non-responsibility
sentence). Both are met in About (one tap from every screen, HOUSE §4.15; neither licence asks for a
credit beside the data) and in `CREDITS.txt`. The WeatherBench 2 paper's citation was checked at
Crossref on 2026-10-06 (JAMES 16(6), e2023MS004019). Rejected sources (the researcher's): Berkeley
Earth (CC BY-NC), NCEP/NCAR R1 (public domain, kept as the fallback if CC BY is refused: RMS 1.73 °C
from ERA5 over land, spectral ringing), GHCN_CAMS (unfit for absolute values). The root `LICENSE`
carve-out and RESEARCH.md §2.5's "ERA5 … not used" change: RESEARCH.md is amended here; the root
`LICENSE` is outside this folder and is the lead's.

### D-7. Found and fixed while driving it

- A held stepper key kept repeating when the sheet grew under the finger (the first change shows a
  longer note, the rows move up, and WebKit delivered the lift to another element): the hold now
  captures the pointer and any lift anywhere ends it, and "Back to GISS's base" is always there
  (disabled at the default) so the keys move less. Seen in Playwright WebKit as a tap that stepped
  twice; the transport keys share the fix.
- Focus mode restored at boot measured the legend before the measure knew the snapshot (a TypeError):
  the measure is bound to the indexes before focus mode is restored.
- The card's baseline label could overlap the first year's label (`1880–1900` over `1880`): an end
  year now gives way to the baseline's label.

### D-8. The review's findings, fixed (2026-10-06, the fixer)

The QA pass passed; the reviewer's did not. What changed, and why:

- **must: Absolute's card sentence.** It took its anomaly from the chart's series, which is the
  difference against the chosen span (`M.diff`), so with Base 1980–2021 Fairbanks read "−2 °C … the
  cell's 1951–1980 average plus GISS's −1.3 °C" (the sum did not add up), and with Base 1880–1900 a
  cell without a baseline printed NIL as "−3276.8 °C". The sentence now reads GISS's own value from
  the frame (`I.tenths[byte]`), the number the climatology is added to: "plus GISS's +2.5 °C" and
  −4.5 + 2.5 = −2 °C. `shoot.mjs` checks the sum with Base 1980–2021 and four Antarctic cells with
  Base 1880–1900 (no "3276").
- **must: Absolute's pole chip.** It was the mean of the cap's cells with a value, so coverage alone
  made a trend (Antarctic 1880 −2 °C on 3 % of the cap, 1957 −23 °C on 93 %). It is now the year
  row's method on the cap: the climatology's area mean over every cell of the cap (each has one) plus
  the cap's mean anomaly against 1951–1980 (the Difference chip's number at GISS's base), each in
  hundredths half away from zero, then to the whole degree. The Antarctic reads −21 °C in 1880 and in
  2025; the Arctic −12 °C in 1880 (42 %) and −8 °C in 2025. The coverage clause stays, since the
  anomaly half still rests on it. Rejected: printing nothing below a coverage floor (a threshold of our
  own, and the year row already sets the method). About's Absolute section says it in one sentence
  (in the pipeline patch, below). `shoot.mjs` pins 1880 against 2025 on the Antarctic.
- **should: the Base key in Last 24 months and in Absolute.** In Last 24 months the key now names the
  base in use, `Base 1951–1980`, and its accessible name adds "for single months; years use
  1980–2021"; the sheet adds "The span applies to years." In Absolute the key keeps the chosen span
  (its chart and the stripes use it) and its accessible name and the sheet say "the map's
  temperatures do not use it". Dimming the key was rejected: a dim key reads as disabled, and it
  is not (the sheet still sets the card's chart and the stripes). **Camera strings:** the marketing
  camera waits for `Arctic` and taps `Annual` only; neither changed.
- **should: the ERA5 citation.** The build never read the Climate Data Store; it read WeatherBench 2,
  whose climatology is computed from hourly ERA5. The two "ERA5 monthly averaged data … (Accessed on
  06-Oct-2026)" citations are replaced by the hourly product (DataCite record 10.24381/cds.adbb2d47,
  read 2026-10-06, no access date claimed) and Hersbach and others 2020, QJRMS 146(730), 1999–2049,
  doi:10.1002/qj.3803 (Crossref, read 2026-10-06); the WeatherBench 2 line says it was downloaded on
  2026-10-06. The CDS link is the hourly dataset's page and the licence line quotes its catalogue
  record ("license": "CC-BY-4.0", read 2026-10-06). Done in `build_climatology.py` and rebuilt
  (`--check`: planes identical, metadata identical; two builds byte-identical); `CREDITS.txt` and
  `about.json` rewritten by the patched pipeline.
- **nits taken:** a one-year span's note says "this one year, and needs a value in it" and the span is
  named `2021`, not `2021–2021`; the year row holds the span together at its en dash (U+2060, as the
  caption); the card's footnote and the credit's title say "ERA5-based" 1951–1980 average; NOTES.md's
  code map is refreshed; `shoot.mjs` asserts focus mode's spoken sentence ("Controls hidden. The
  Earth, its scale and the stripes stay.", ART item 29 now gives it).
- **nits left (owner's taste):** "(8 months)" after the partial year's mean (DESIGN §3.3 asks for it;
  at 390 it can take a line of its own); Absolute's partial year carries the season (Jan–Aug's
  climatology is 13.95 °C against 13.7 °C for the year, so 2025 → 2026 reads about 0.25 °C warmer than
  the anomaly says; the year row says "so far, 8 months" and About explains the partial year);
  `miniapp.json`'s description still speaks of anomalies only (the brief allowed the version bump
  alone).

The pipeline patch (`tools/climatology/pipeline-0012.patch`, D-5) is regenerated: the About sentence
for the pole chip, `verify_static.py`'s climatology check now asks CREDITS.txt for
`DOI: 10.24381/cds.adbb2d47` and `doi:10.1002/qj.3803`, and the evidence file gains item 5 (the hourly
record and the two DOI lookups). Applied with `patch -p1` from `Template/` on a scratch copy of the
pipeline and the app: `build_static.py --offline` twice gives byte-identical `about.json` and
`CREDITS.txt`, the same bytes the app ships, and `verify_static.py` says "all checks passed".

### Budgets (for the lead)

App code is 222 127 B against its 200 000 B budget (`node tools/check.mjs`, 2026-10-06, after D-8;
220 396 B before the review's fixes, 192 954 B before the pass). Nothing was cut: the measure, the
sheet and the second LUT are the owner's three requests. `assets/climatology.json` is 100 922 B (cap
120 000). The ZIP is 1 262 865 B, well under its 2 000 000 B cap.

### The lead's pass (2026-10-06)

- **The code budget is 223 000 B,** ruled on the measured 222 127 B. The overage is the owner's three
  requests (Absolute and its scale, the baseline sheet, the re-baselining); nothing was cut, as plan
  0011 ruled other apps on their measured figures. `check.mjs` and NOTES carry it.
- **`tools/climatology/pipeline-0012.patch` applied** to `Template/scripts/warming_world/` in the same
  commit. HOUSE §6.5's byte-identical pipeline rule binds art passes; this pass adds an asset, and
  without the patch the 16 January demo build would fail `verify_static.py` and drop the ERA5
  credit. The lead's `verify_static.py` after applying it: all checks passed.
- **The root LICENSE's Warming World paragraph** now names `assets/climatology.json` as modified
  Copernicus information under CC BY 4.0, with the non-responsibility sentence.
- **Owed, not fixed in this round (the final's should):** with a chosen baseline, the partial year
  subtracts the span's annual mean from a mean of the months so far. The anomalies are already
  seasonal, so the bias is small, but it exists where a season warmed more than the year (the
  Arctic winter), and About does not say so. It needs a sentence in `build_static.py`'s baseline
  section and a regenerated `about.json`, or a per-month baseline.


## Plan 0012, D21 and D22 (2026-10-10): version 1.1 → 1.2

The owner reviewed TestFlight 48 on 2026-10-10 and asked for two changes, which bind word for word:
*"The warming world needs to afjust the color table for the absolutes"* (D21; from the board
`docs/marketing/reference/0012-ww-absolute-board.png` the owner chose A, Global Weather's temperature
colors), with the follow-up *"Both colortables should be centered around 0"*, *"Ie, absolute and
diff"*; and *"also adjusting the base with arrows was not very user friendly"* (D22; presets and a
slider chosen). The change list for this app was applied in 3.3 (1.1); this pass is D21, D22 and the
bugs on record.

**Bugs on record, read first.** Matrix rows 155 and 185 are "not run" (no phone result to fix);
`docs/plans/0009-launch-1.1.md` item 5 names Norne, World Oil & Gas, Milky Way and Global Weather, not
this app; nothing under `docs/review/` names it. One item was owed: 3.3's final (the lead's pass,
above) left the partial year under a chosen baseline unexplained in About. Fixed here (D-13).

### D-9. Absolute in Global Weather's temperature colors, by value (D21)

- **The stops are Global Weather's `RAMPS.temp`**, 41 per theme from −50 to +48 °C, copied as hex
  into `js/ramp.js` (`ABS_STOPS`) and interpolated in sRGB exactly as Global Weather's `rampAt`
  (rounded to 8 bits for the LUT, as its `Uint8ClampedArray` does). A cell at a temperature takes
  Global Weather's color for that temperature, as the board was drawn. `check.mjs` compares the stops
  with `global-weather/js/ramps.js` stop for stop (or with their sha256, recorded in it, where a copy of
  the template has no Global Weather); `test_decode.mjs` checks all 1 001 LUT entries per theme against
  Global Weather's file interpolated in the test (0 differ).
- **The dark theme takes Global Weather's dark variant** (decided, as the brief's family rule says: the
  same color as Global Weather in each theme). The LUT is rebuilt when the color scheme changes, with the
  legend. Measured against this app's own dark card (`#303030`), the nearest value is 0 °C at ΔE 0.070,
  more than the light theme's nearest (0.055 at −2.7 °C against `#bebebe`); the limb's ring and the
  map's outline part the Earth from the card there, as they do for the anomaly ramp's ends.
- **Opaque, not Global Weather's 0.90** (owner call: taste). Global Weather lays its temperature layer at
  0.90 opacity over its land and sea; this app has no basemap under the cells and fills each with the
  stop itself, as the board did. On a phone the two will differ by that tenth of the ground; 1.0 here is
  the board's look.
- **The scale is −50 … +50 °C, centered on 0** (in place of −60 … +40, where 0 sat at 60 %): `ABS_LO`,
  `ABS_HI`, the LUT (entry i is (i − 500) tenths; the shader clamps to 0 … 1000), the counts beyond
  (`measure.js`, strictly beyond ±50.0), the card's "beyond the map's end" note, the legend and About.
  −50 °C is Global Weather's coldest stop, so below it a cell takes that color (82 cells of the 2025
  map, all Antarctic, counted in the legend as before); above +48 °C, its warmest stop, the warmest (no
  cell of this data reaches +48).
- **The legend's ticks** (owner call: taste): every 5 °C, long and labeled every 25 (`≤ −50`, `−25`,
  `0`, `+25`, `≥ +50 °C`). Labels every 20 from −40, as 1.1 had them every 20 from −60, would put `−40`
  20.85 px from `≤ −50` (one 10 °C step is 20.85 px at 2.085 px a degree), and the two labels are about
  28 and 16 px wide, so they would collide; every 25 keeps 0 labeled and the labels evenly spaced.
- **3.3's rule is overruled by the owner's choice** (ART's "sequential, never orange, yellow or signal
  red; the warm end reads as sand, not as an alarm", D-1 above). ART's "The temperature ramp" now says
  what is true, and "Never" keeps its no-alarm rule for the anomaly ramp only. The switch, the legend and
  the caption say which map is on screen; Difference keeps its blue-white-red ramp.
- **Difference does not change**, and is checked centered at 0 in both themes (`shoot.mjs`: the bar's
  middle step is the ramp's white, 244,243,240, its ends −4 and +4; the card's chart is drawn on ±R with
  its zero line at the plot's middle, by construction, `Y(0) = top + ph / 2`; the stripes and the card's
  own stripes are the same ramp, white at 0). In Absolute the card's chart, its stripes and the track's
  stripes stay the anomaly and its ramp: they show the change, not the temperature.
- **check.mjs's assertions, changed** (the brief: keep what still means something). Kept: the gamut
  (now true by construction: 8-bit sRGB stops interpolated in sRGB, asserted as such); the hatch, told
  apart by measured ΔE at every 0.1 °C in each theme, ≥ 0.10 under normal vision (0.119 light, 0.127
  dark) and ≥ 0.02 under the deutan, protan and tritan simulations (lowest 0.024, dark protan; 1.1's
  floor was 0.03; the hatch is a pattern of 45° lines, so color is not its only cue); both cards, new
  as an assertion, ≥ 0.05 under normal vision (0.055 light, 0.070 dark), printed under the simulations
  (lowest 0.024, light tritan, near +12 °C). Added from Global Weather's own checks: every eighth of the
  legend a step of ΔE ≥ 0.02 (lowest 0.024) and the ends ≥ 0.10 apart (0.156–0.215). Dropped, because the
  owner's ramp is not meant to meet them: "lightness rises at every 1 °C" (the ramp is palest in light,
  darkest in dark, at 0 °C, and its 1 °C steps go as low as ΔE 0.0002 in dark protan) and "10 °C steps
  within a factor 1.75" (they run 0.019–0.130, Global Weather's ramp is not perceptually even). The
  LUT's middle entry is asserted to be 0 °C's slate in both themes.

### D-10. The baseline by presets and a slider (D22)

- **Four presets, one tap each:** `1951–1980` (GISS's base and the default), `1961–1990`, `1981–2010`,
  `1991–2020`, in the underline switch's dress (the app's own `.seg`, so the switches read alike), a
  `radiogroup` named "Common baselines" whose buttons are `radio`s; the arrow keys move the choice as on
  every switch here. The chosen one is underlined and `aria-checked`; when the span is none of them,
  none is (and the first is the group's tab stop). VoiceOver names: "1951–1980, GISS's base" and
  "1991–2020, the current climate normal" (the visible text first, so voice control finds them);
  About names the World Meteorological Organization for the normal. The hit is the switch's own, 44 px
  tall (`shoot.mjs`'s hit sampler).
- **The two-thumb slider:** each thumb is an `input type=range` (`From`, `To`), the year as its value
  and `aria-valuetext`, step 1, min and max following the other thumb so the two can meet but not cross:
  VoiceOver's adjustable control and the arrow keys come with the native control, as Norne chose for its
  sweep (Norne's DECISIONS, 2.3). The inputs are invisible 44 × 44 px boxes over the drawn dots and take
  no pointer events; the slider's 44 px row takes the finger: a touch takes the nearer thumb, moves it
  to the year under the finger at once, and drags it (pointer capture, `touch-action: none`, so the page
  never scrolls). Where the thumbs meet, the first move's direction chooses (left From, right To). A touch
  never focuses an input (a mouse does), so no iOS focus behavior can move the page (not seen, not
  tested on a phone). The ends are labeled with the first and the last complete year in `--ink-3`.
- **Live or at the release: at the release, by measurement.** A baseline over a span is a mean of every
  cell over every year of it, then the counts, the legend's reserve and the stripes: `setSpan` took
  15.6–25.4 ms in headless Chromium and 8–25 ms in headless WebKit on this Mac (`tools/.work` probe,
  six spans each, the synchronous part only), more than a 16.7 ms frame here and more on a phone, so a
  live map would make the thumb lag. While a thumb moves, the span, the presets and the note's rule
  follow it (the note says what follows at the lift in the mode on screen, and is `aria-busy`, so
  VoiceOver does not read each year); at the lift the map, the stripes' bracket, the year row, the
  legend and the note's count follow in one go. The note's height is held at its longest form, so
  nothing in the sheet moves while it is open (D-14). A key or VoiceOver step is applied at the next
  frame (coalesced), and speaks through the control alone (D-14).
- **"Back to GISS's base, 1951–1980" is gone** (decided): the `1951–1980` preset is that, one tap,
  and is named GISS's base to VoiceOver. The live region still says "Baseline 1951–1980, GISS's own".
- **Kept as it was:** the two-thirds rule and its note (`#base-note`, `aria-live`), single months against
  1951–1980 and the sentence that says so, Absolute's base applying to the card's chart and the stripes
  and not to the map's temperatures, the base key's words, and the stored span: `ww.base`, the same key
  and shape, so a span stored by 1.1 opens as it was (`shoot.mjs` stores 1991–2019 and reloads).
- **Fits:** at 375 × 667 in portrait, with its longest words (a span with cells lacking, in Last 24
  months), the sheet is 257 px tall, 135–392 px, inside the panel above the legend (398), with nothing to
  scroll; on its side (844 × 390) it is 166–382 px with nothing to scroll (with the note's reserve, D-14), and a
  touch on a preset works.

### D-11. About (the pipeline's words): a patch, as 3.3's

`assets/about.json` is written by `Template/scripts/warming_world/build_static.py`, outside this folder.
`tools/climatology/pipeline-0012-d21-d22.patch` (apply from `Template/` with `patch -p1`; a dry run
applies cleanly) changes three things: Absolute's scale paragraph (−50 … +50 °C, centered on 0 °C,
Global Weather's colors by value, Difference's own scale), the baseline section's first paragraph (the
four presets, the slider, down to one year), and a new paragraph on the partial year under a chosen
span (D-13); and `verify_static.py`'s list of numerals the prose may type (`50`, `0`, `1961`, `1981`,
`1991`, `2020`; `60` and `40` leave with the old scale). Run on a scratch copy of the pipeline and the app
(`WARMINGWORLD_APP`, the real cache, its own `.venv`): the unpatched pipeline first rebuilt the shipped
`about.json`, `world.json`, `places.json` and `CREDITS.txt` byte for byte; the patched one wrote the
`about.json` this app now ships, twice byte-identical, `CREDITS.txt` unchanged, and `verify_static.py`
said "all checks passed". `data/` and `assets/climatology.json` are untouched (sha256 before and after).

### D-12. The camera

The marketing camera waits for `Arctic` and the end of the opening (`Touch to stop`) and taps `Annual`.
None changed; nothing it reads moved.

### D-13. The owed sentence (3.3's final)

About's baseline section now says: "The partial year is its months so far minus the cell's mean over the
span's whole years, not over the same months, because the app keeps no monthly maps for those years.
Where the span's years departed from 1951–1980 more in some months than over the whole year, as the
Arctic's winters did, the partial year's difference is off by that much." `shoot.mjs` checks it is in
About. The per-month baseline (the other remedy) is not possible with 24 months of maps.

### D-14. The review of 1.2, fixed (2026-10-10, the fixer)

- **The sheet moved under the finger (must).** It is anchored at its foot, and the note grew from one
  line (GISS's base) to three to six (a chosen span), so the first choice pushed the presets and the
  slider up 27–41 px and the next tap where a preset was landed on the span figure. Now `noteReserve()`
  sets `#base-note`'s `min-height` to the tallest of its forms at the current width, text size, time
  list and measure (the drag note, a span over every complete year with every cell lacking, with none
  lacking, GISS's base), measured by setting each and reading `offsetHeight` in one task, never
  painted; it is measured again when the width, the text size, the list or the measure changes and when
  a font face arrives. The old freeze while a finger was down is gone. Measured by real touch (CDP,
  Chromium 390 × 844 DPR 2): the presets, the slider and the span figure at the same top before and after
  taps on 1961–1990, 1981–2010 (at its box measured before the first tap) and 1951–1980, and the
  slider's top 478 px before, during and after the first drag from GISS's base; the same at 375 × 667
  (both lists) and 844 × 390. `shoot.mjs` checks both, in both themes.
- **The drag note said "The map follows on release." where the map does not use the span.** In
  Absolute it now says "The stripes and the card's chart follow on release."; in Last 24 months "The
  years follow on release; single months stay against 1951–1980." In Absolute the settled note says the
  lacking cells "have fewer, so they have no mean over the span", not "are drawn as no data": no cell
  of the Absolute map is hatched for it.
- **VoiceOver would have spoken three times a step.** A thumb's key or VoiceOver step no longer calls
  `say()` (the native control speaks its year), and the note is `aria-live="off"` and `aria-busy` while
  steps come; 600 ms after the last it is `polite` again and its text is set afresh, so it speaks once.
  A pointer drag and a preset still say "Baseline …" once, then the note. `shoot.mjs` checks the
  attributes and that `#live` is unchanged after a key step; the speech itself is a phone check (NOTES
  1.2 (d)).
- **Accepted, not changed (nits, the owner's call):** a finger moves a thumb 2.25 px a year at 390 px
  wide, so a sighted touch user lands a single year only by the live span figure (VoiceOver and keys
  step one at a time; a preset covers the common spans). At 320 × 568, and at 375 with Larger Text or
  125 % page zoom, the sheet's words scroll inside it (33 px at 320 × 568) now that the note's height is
  held; the brief's 375 × 667 fits with nothing to scroll in both lists.
- **About's words (nit, taken):** "so a temperature takes the same color in both apps", not "looks the
  same": Global Weather draws at 0.90 over a basemap and this app fills cells opaque (D-9). In the patch
  and in `about.json`; the patched pipeline, run on a scratch copy, wrote the shipped `about.json`,
  `world.json`, `places.json` and `CREDITS.txt` byte for byte and `verify_static.py` passed.

### Owner calls (taste, each reversible)

- Absolute opaque, not at Global Weather's 0.90 (D-9).
- The legend's ticks every 5 °C, labeled every 25 (D-9).
- The presets in the underline switch's dress, without words beside them; VoiceOver hears "GISS's
  base" and "the current climate normal" (D-10).
- The map at the release, not live (measured, D-10).
- "Back to GISS's base" removed (D-10).
- About names Global Weather (another app of the template) as the source of the colors.

### Budgets (for the lead)

App code is 229 889 B (`node tools/check.mjs`): 6 889 B over the 223 000 B the lead ruled for 1.1, and 7 762 B
of growth over the measured 222 127 B that ruling was set on (5 720 B for D21 and D22 as first built, 2 042 B
for the review's fixes, D-14). **The lead's ruling (2026-10-10): 230 500 B**, on the measured figure. Nothing was cut: the slider, the presets and the two per-theme stop
lists (as hex, the most compact form that keeps them checkable) are the owner's two requests.
