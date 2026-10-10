# Warming World — design

**Plan 0012 (2026-10-06).** Version 1.1 adds Absolute (an ERA5-based 1951–1980 average plus GISS's anomaly,
an estimate), a baseline of one's own in Difference (Base), the legend kept in focus mode, and the
credit moved from the legend into About. `ART.md` items 26–30 and `NOTES.md` describe them; where
this file says otherwise (§7.3's credit line, §10's legend hidden in focus mode, "an anomaly, never a
temperature"), they are what the app does now. `tools/DECISIONS.md` holds the pass's reasons.

**Plan 0012 D21 and D22 (2026-10-10).** Version 1.2: Absolute takes Global Weather's temperature colors on
a −50 … +50 °C scale centered on 0 °C, and Base is set by four presets and a two-thumb slider. `ART.md`
("The temperature ramp", items 27 and 28) and `NOTES.md` describe them.

The brief is `docs/plans/0010-four-showcase-apps.md`, "Idea 2 — recommendation: Warming World
(GISTEMP)", with the rules for all four apps under "Recommendation and order" (the art-direction
stage, SI units, the focus mode, sharp scrubbing; decision log D11, D15, D18, D19, D20). The sources,
licenses and every measured number about the data are in `tools/RESEARCH.md`. The data file is
specified byte for byte in `tools/CONTRACT.md`. This file says what the app does with that data and
why. The look (chrome palette, type, motion, the opening, the details) belongs to `ART.md`, "Gray
Card", written before any code. Its change list is applied in this file, so the two agree, and §19
records what it decided and what it could not change.

Numbers marked *measured* name the command that printed them. Everything else is a target or an
estimate, and says so.

---

## 1. What it is

A globe, and a map, of NASA GISS's surface temperature anomalies (GISTEMP v4, 1200 km Land-Ocean
grid, 2° cells), one frame a year from 1880 to the newest published month. The planet starts mostly
pale, with gray where no one measured. Over the years it turns red. The year scrubber is the warming
stripes: each year's global mean, from GISS's own table, colors the track you drag along. Tap any
cell and you get its number for that year, plus its own line from 1880 against the global mean. A
second view, **Last 24 months**, scrubs the newest two years month by month.

It is a live app. A GitHub workflow rebuilds `data/snapshot.json` from GISS once a month, and the
phone's Shortcut copies it in. Nothing in the app reaches the network.

What it is not: a temperature map. Every number is an **anomaly**, the difference from that place's
own 1951–1980 average for the same months. The app says so wherever a number appears (§9).

## 2. Ground rules

- **Snuggery's contract.** One ZIP with `index.html` at its top, relative paths only, no `..`, no
  symlinks, no `http://` or `https://` in any `.html`, `.css` or `.js`, ES modules, `fetch()` of the
  app's own files only, `localStorage` with every access in `try/catch`, works at 390 × 844 in both
  themes. No JavaScript-to-native bridge, no `postMessage`, no `eval`, and no value ever reaches
  `innerHTML`.
- **Honesty is drawn on screen, not kept in a README.** That means anomalies, not temperatures. Gray
  is no data, never an invented value. The color scale is fixed, symmetric and printed. The current
  year is partial and is labeled as partial wherever it appears. §9 maps each statement to the place
  on screen that makes it.
- **SI by default, and here only.** Values are in °C with one decimal and a sign (`+1.3 °C`,
  `−0.4 °C`, `0.0 °C`). The minus is U+2212. Between number and unit sits U+202F (narrow no-break
  space), and thousands are grouped with U+202F (`1 200 km`, `16 200 cells`), never with a comma.
  Percentages are written `97 %` with U+202F. Years are never grouped. The app has no °F switch;
  §18 D-6 explains why.
- **US English** in every visible string. No AI vendor or model is named anywhere in the app or in
  this file, which ships in the ZIP.
- **Copy, never import.** Code taken from Global Weather, Earth's History or US Quakes is copied
  into this folder, with a comment naming where it came from. The apps stay deletable one at a time.
- **Fail in words.** If the snapshot is missing or the wrong shape, if WebGL 2 is absent, or if the
  data are stale, the app says so in a sentence a person can act on. It never shows a plausible
  blank.

---

## 3. The screen at 390 × 844

One column, CSS grid, rows top to bottom:

| Row | Height | Holds |
| --- | --: | --- |
| Top bar | 44 px | the name, About |
| Earth panel | `1fr`: 632 px at 844 tall (598 px on a phone with a 34 px home-indicator inset) | the gray card (ART): the WebGL2 canvas and the Canvas 2D overlay; its top strip (Globe \| Map, Arctic, Antarctic, the focus key); its foot (the legend, 44 px); the tap card when open |
| Year row | 56 px | the year, the global mean, the coverage |
| Stripes track | 64 px | the scrubber: its caption line, the framed stripes, the decade graduations, the 1951–1980 bracket, the labels, the thumb |
| Controls row | 48 px | ‹ ▶ ›, the Annual \| Last 24 months switch |
| `env(safe-area-inset-bottom)` | 0–34 px | |

The side gutter is 16 px everywhere. Nothing scrolls horizontally, and the page itself never
scrolls: the About panel and the tap card scroll inside themselves.

### 3.1 Top bar (44 px)

The app's name sits on the left. On the right is **About**, a text key with a 44 × 44 hit area.
That is all. The bar does not hold the data's date; it is in the year row's second line and in
About, so it never gets truncated.

### 3.2 The Earth panel

- **The panel is the gray card** (ART "Gray Card"): a full-width band of `--card` (`#bebebe` light,
  `#303030` dark), with no frame, radius or gradient. It is the ground of the globe and the map in
  both themes (§7.4).
- **The canvas** fills the panel. The globe's seat is the panel minus its top strip (44 px) and its
  foot (44 px): 390 × 544 at 844 tall. The globe's radius is `0.47 × min(seat width, seat height)`,
  so **183 px** at 390 wide and 176 px at 375. The globe is centered in the seat.
- **The map** (Equal Earth, §6.2) fits the seat's width less the gutters, 374 px. That makes the
  whole world 374 × 182 px, centered vertically. Pinch zooms in up to 4×. On a portrait phone the map
  is the second view; the globe is the hero.
- **Top strip** (44 px, laid over the canvas's top edge, no fill, so the card shows through):
  - Left: the **Globe | Map** switch, ART's underline switch (the chosen option in 650 over a 2 px
    ink rule), 32 px tall, 44 px hit.
  - Right: **Arctic** and **Antarctic**, text keys of 32 px height with 44 px hits, then the
    **focus key** (30 × 30, 44 hit) at the far right (§10).
  - Measured target: the strip's contents fit at 360 px with 8 px gaps. Below 360 px, the pole keys
    become ART's ring-and-dot glyphs, with the same accessible names. The builder measures this in `shoot.mjs`
    at 320, 360, 375 and 390.
- **Foot (44 px): the legend** (§7.3), the printed ±4 °C scale with its no-data swatch.
- **Notices** take one line at the top of the seat, under the strip, on a `--sheet` chip with a 1 px
  `--line` edge and a 3 px radius (ART), never in amber or red: "Restoring the view…" after a
  context loss, the staleness line (§12.4), and "New
  data: the September 2026 release" for 4 s after a replacement (§12.3).
- **The selected cell** is outlined on the Earth (§5.5). The tap card (§8) opens over the panel's
  lower part.

### 3.3 Year row (56 px)

Two columns.
- **Left, the step's name** in the app's largest figure (Archivo 600, 28 px, width 87.5 %, tabular;
  ART): `1998`.
  For a partial year it reads `2026`, with a second line under it: `Jan–Aug, partial`. In Last 24
  months it reads `Aug 2026`.
- **Right, two lines, right-aligned:**
  1. `Global mean +0.61 °C`. This is GISS's own number from its table (§7.2), for the step: the
     year's `J-D` value, or the month's value. For a partial year it reads `Global mean so far
     +1.22 °C (8 months)`.
  2. `Data cover 97 % of Earth's surface`. This is the step's area coverage from the snapshot
     (CONTRACT §3.4). It is never typed into the code.
- The row's text is the scrubber's value text too (§11).

### 3.4 Stripes track (64 px): the scrubber, as an instrument

ART's signature control. From the top of the row:

- **Caption line** (rows 0–12): `Stripes: GISS global mean, each year, on a ±1.5 °C scale` in
  10.5 px `--ink-2` (in Last 24 months: `…, each month, …`). A stripe's red is not the map's red at the
  same number, and the caption says the scale so no one has to assume it is the same. It stays at
  every width and in focus mode.
- **The track** (rows 17–42) is the full width less the gutters (358 px) and 25 px tall, inside a
  **1 px `--line-strong` frame** (the frame is what makes the near-white 1951–1980 stripes read as
  stripes on the light page, whose lightness equals the ramp's 0 °C). It has one stripe per step: 147
  in Annual, so about 2.4 px each, and 24 in Last 24 months, about 14.9 px each, with edges snapped to
  device pixels. Each stripe takes GISS's global mean for its step on the **stripes scale**, fixed at
  ±1.5 °C (§7.2), through the same ramp as the map. 1880 is at the left and the newest step at the
  right.
- **The partial year's stripe** is drawn open: its color only in the top and bottom thirds, with the
  page between them, inside the frame. An open stripe reads as "not finished" without a word, and its
  label says the rest (§4.2).
- **Graduations** under the frame: a 3 px tick at every decade (`--ink-2` at 50 %), 5 px at 1900,
  1950 and 2000.
- **The base bracket**: a 1 px `--ink` bracket with 3 px feet spanning 1951–1980 under the
  graduations, labeled **`1951–1980 = 0`** in `--ink`. It shows what the stripes' zero is. In Last 24
  months there is no bracket.
- **Labels** (10.5 px `--ink-2`): `1880`, `1900`, the bracket's label, `2000` and the newest year. In
  Last 24 months: the first month, each January, and the newest month.
- **The thumb is a reading index**: a 1.5 px `--ink` rule from 3 px above to 3 px below the track,
  with a 7 × 4 px solid index triangle above it, over a 4.5 px `--page` halo. It sits at the center of
  its step's stripe and **steps, never glides**: it points at the drawn year only. Pressed, the frame
  turns `--ink`. The hit area is the whole row plus 8 px above and below.

### 3.5 Controls row (48 px)

- At the left are **‹**, **▶ / ❚❚** and **›**: 44 × 44 keys that step one year (or month) back,
  play or pause, and step forward. Holding ‹ or › repeats at 8 steps a second after a 400 ms delay.
- At the right is **Annual | Last 24 months**, ART's underline switch, 32 px tall with a 44 px hit
  area. ‹ and › are 1.5 px chevrons; ▶ is a solid triangle in a 31 px ring, and ❚❚ two bars in it.
  The row measures 132 + 12 + 200 = 344 px against the 358 px available at 390. Below 360 px the
  gutters drop to 8 px and the switch's labels shrink by one type step. Labels are never
  abbreviated.

### 3.6 About

A full-height panel over everything, with ✕ (44 hit) and Escape to close it. It scrolls inside
itself, and focus is trapped while it is open. Its prose comes from `assets/about.json`, with
every number filled from the snapshot through the placeholders in CONTRACT §5.3. Sections in order:

1. **What the colors mean.** Each cell's color is how much warmer or colder that 2° cell was than
   its own 1951–1980 average for the same months. It is not a temperature. 0.0 °C means the
   1951–1980 normal. The scale runs from −4 to +4 °C and never changes. Cells beyond it are drawn
   in the end colors, and a tap gives their true value. Gray means GISS makes no estimate for that
   cell.
2. **Where the numbers come from.** Land: about 26 000 weather stations of NOAA's GHCN-monthly v4,
   adjusted. Ocean: NOAA's ERSST v5 sea-surface temperatures, which stand in for air over ice-free
   water. Over sea ice, land stations' air temperatures are used. A station's anomaly is spread over
   every cell within 1 200 km, so a colored cell need not contain a thermometer. Quoted from GISS's
   FAQ (RESEARCH §2.1).
3. **How much of Earth is covered, era by era**, from the snapshot's own coverage:
   `{coverage:1880}` of the surface in 1880, then `{coverage:1900}` in 1900, `{coverage:1950}` in
   1950, `{coverage:1980}` in 1980 and `{coverage:last}` in `{lastComplete}`. *Measured* on the
   August 2026 release: 82.7, 89.9, 95.1, 98.9 and 99.2 % (RESEARCH §1.12). The Arctic north of
   64° N is fully colored in every year from 1946, and in some years from 1931 (*measured* by
   `verify_static.py` on the demo snapshot: full in 1931–33 and 1936–42, gaps in 1934–35 and
   1943–45; RESEARCH's "from 1940" did not reproduce), but that comes from the 1 200 km smoothing
   of a few coastal stations, not from observation of the ocean. The share of Antarctica's area with data
   (64–90° S) jumps from 38 % to 93 % between 1955 and 1957, when the International Geophysical Year's
   stations opened, the shares the Antarctic reading prints (29 % to 96 % of its cells, RESEARCH §4). The gray
   Southern Ocean around Antarctica in recent years is the sea-ice zone.
4. **The current year is partial.** `{partialLabel}` is the mean of the months GISS has published so
   far. A cell needs at least three quarters of those months. A partial map cannot be compared cell
   by cell with a full year. On 2025, a January–July map differed from the full year by 0.3 °C per
   cell on average (RESEARCH §1.5). The partial year appears only once 6 months are out.
5. **Annual means and rounding are this app's.** A year needs 9 of its 12 months. Values are rounded
   to 0.1 °C. GISS publishes no annual map; the stripes and the global means are GISS's own table,
   which GISS calls definitive.
6. **Revisions.** GISS updates its analysis about the 10th of every month, and earlier months can
   change slightly with each release. This copy is the release created `{releaseCreated}`, with the
   newest month `{newestMonth}`. It was read on `{accessed}`.
7. **What is not shown.** Uncertainty (GISS publishes an ensemble; this app shows the central
   analysis only). Seasons. Temperatures. Anything before 1880. Sea ice. Causes.
8. **Sources and citations.** These come from the snapshot's `sources` (CONTRACT §3.7) and
   `about.json`'s static sources. They are printed as text and nothing is a link. The on-screen
   attribution is "Temperature: NASA GISS Surface Temperature Analysis (GISTEMP v4); annual means
   and 0.1 °C rounding by this app." GISS's two requested citations follow, with the access date
   filled in. Then "Coastlines, borders and city names: Made with Natural Earth (public domain)."
   Last: "**NASA does not endorse this app.** It uses NASA's published data, as NASA's media
   guidelines allow for factual use."
9. **This copy:** the app's version, `generatedAt` and the release identity, as one block of
   `label: value` lines.

The NASA insignia, logotype and "meatball" never appear. The app is never called "NASA's" or
"official" (RESEARCH §1.15, §2.2).

### 3.7 Notices and errors (in words, in place)

| Case | What shows | What still works |
| --- | --- | --- |
| `data/snapshot.json` missing | The panel: "The data file data/snapshot.json is missing. It ships in the ZIP and the Shortcut replaces it; reinstall the app or run the Shortcut." | About (static parts) |
| Unparseable or the wrong shape | The panel: "The data file could not be read: <the first failed check, in words, e.g. 'step 1903 holds 16 199 cells, expected 16 200'>." | About (static parts) |
| A replacement fails while open | The old data stay on screen. The notice reads "The new data file could not be read (<reason>); still showing the <month year> release." | everything |
| No WebGL 2 | The panel: "This view needs WebGL 2, which this device does not offer." | the year row (global mean, coverage), the stripes, play, About; no tap card, since there is no Earth to tap |
| Stale (`generatedAt` over 75 days old) | The notice line: "This copy of the data was made on 2026-07-15. GISS publishes a release about the 10th of every month." | everything |

### 3.8 Wide screens and landscape (≥ 700 px wide)

There are two columns under the full-width top bar. The Earth panel takes the left, everything else
the right column (380 px): the legend, year row, stripes, controls, and the tap card docked under
them instead of over the panel. At 844 × 390 the panel is 464 × 346. Its seat, less the top strip,
is 464 × 302, so the globe's radius is 0.47 × 302 = 142 px. The map gets 448 × 218 px, the size at
which it beats the globe for an overview. Focus mode is one column here too (§10).

### 3.9 The opening (first launch only)

The globe faces the viewer's own longitude, using Global Weather's clock trick: UTC offset × 15° per
hour, latitude 20° N. The app opens at **1880** and plays to the last complete year at the normal
8 years a second (about 18 s), then stops there. Any touch, key or wheel ends it at once, on the
year it had reached. It never runs under Reduce Motion, never in focus mode, never twice
(`ww.opened`), and never without a valid snapshot. When it does not run, the app opens on the stored
year, or else on the **last complete year**, never on the partial one. Its look is ART's first
signature moment: **the stripes are written behind the thumb**, each one appearing as its year is
drawn, so the track starts as an empty frame with its graduations and bracket. One line on a
`--sheet` chip under the top strip says `Playing 1880 to 2025, one year every eighth of a second.
Touch to stop.` (the years filled in from the snapshot), and it fades when the play ends or is
stopped. When the opening is ended early, the remaining stripes appear at once. There is no title
card. The year's digits roll (ART), and play keeps its linear clock: no ease in or out of the
play itself.

---

## 4. The time model

### 4.1 Two step lists

The snapshot has `steps` (annual, 1880 … the newest complete year, plus the partial year when it
has ≥ 6 months) and `months` (exactly the 24 newest months). CONTRACT §3.4–3.5 gives both. **Annual
| Last 24 months** chooses which list the scrubber walks.
- Switching from Annual to months goes to the newest month. Switching from months to Annual goes to
  the year of the month that was showing, or the last complete year if that month's year is the
  partial one and the partial year is not in `steps`.
- Each list keeps its own position while the other is showing (`ww.year`, `ww.month`).
- The two views are never mixed. One frame is one year or one month, labeled as such.

### 4.2 The partial year

It is the last annual step when present, with `partial: true` and its `label` ("2026, Jan–Aug
(partial)"). Wherever it appears:
- The year row reads `2026` with `Jan–Aug, partial` under it, and `Global mean so far +1.22 °C
  (8 months)`.
- Its stripe is open (§3.4).
- The tap card's chart draws its point hollow and labels it "Jan–Aug, partial".
- The legend's second line adds "partial year".

It is never drawn as a full year.

### 4.3 Play and step

- **Annual: 8 years a second.** 1880 to 2025 takes 18.1 s. **Months: 4 months a second**, so 6 s
  for the 24. Fewer than 8 a second, because each month is its own picture and the swings are large
  (single months exceed ±4 °C in 8.42 % of the last 24 months' cells; RESEARCH §1.6).
- Play shows **every step in order**. It never skips one to keep time, and it never cross-fades:
  each frame drawn is exactly one year's data. A blend between two years would show values neither
  year had (§18 D-4).
- It stops at the newest step. Play pressed there starts again from the first.
- A drag on the track, a tap on a stripe, ‹ or › stops play.
- Play is clocked by `requestAnimationFrame` time accumulated against 125 ms (or 250 ms) per step. A
  late frame advances by one step, never more, so a stall slows play down rather than skipping years.

### 4.4 Scrubbing (the owner's rule: scrubbing must look as good as play)

Earth's History blurred under a fast drag because the map under the finger waited behind decodes for
stops the drag had already passed (DESIGN §21 there). Here the cause cannot arise. **Every frame is
resident.** All 147 + 24 frames are decoded once at boot into one `Uint8Array` (2 770 200 B) and
uploaded once into one `R8` array texture (§5.3). Showing any year is then one uniform and one draw.
There are no previews, no blur and no loads during a drag.

- Each `pointermove` on the track sets `wanted = round(x_fraction × (n − 1))` and requests a frame.
  A frame draws whatever `wanted` is at that moment. Intermediate positions between two frames are
  simply never drawn: the newest request always wins, and stale ones never existed as work.
- **What 8 years a second needs:** one new year every 125 ms, so one draw every 7.5 display frames
  at 60 Hz. *Measured*: a year change costs 0.0–0.2 ms of main thread with the array texture. The GPU
  draw is 3.6 ms median on SwiftShader, Chromium's CPU emulation of a GPU, at 780 × 1 200 device px
  (§5.1). A phone GPU is expected to be faster, which is a phone check. A drag at 8 years a second
  therefore draws every year it crosses, and the label and the map always agree. A flick at
  150 years a second crosses about 2.5 years per frame. It draws the year under the finger at each
  frame, which is the rule, and skips the ones in between, which no frame could have shown.
- **The label is the drawn step.** The year row, the thumb and the Earth's accessible name all
  read `shown`, the step whose layer was last drawn, never `wanted`. They therefore cannot disagree
  for even one frame.
- **Before every frame is resident** (the first tens of milliseconds after boot, or after a snapshot
  replacement, §4.5), `wanted` may not be uploaded yet. The decoder then takes `wanted` next, then
  read-ahead in the drag's direction (`wanted + dir`, `wanted + 2·dir`, …), then the rest. Until
  `wanted` is resident the screen keeps `shown` with its own label. *Measured*: decoding all 171
  frames took 19.6–20.2 ms in Chromium on this Mac (`tools/bench`). The window is therefore short,
  but the rule holds inside it too.

### 4.5 Boot order and the decoder

1. `fetch('data/snapshot.json')` and `JSON.parse`. *Measured*: 3–5.7 ms for the 1.06 MB bench file
   in Chromium. Validate the shape (§12.1).
2. In parallel: `assets/world.json`, `assets/places.json`, `assets/about.json`.
3. Allocate the array texture for `steps.length + months.length` layers (§5.3). Decode the **step
   to be shown first** (stored, or the last complete year, or 1880 for the opening), upload it, and
   draw. The first paint does not wait for the other 170.
4. Decode the rest through the queue: up to 4 `DecompressionStream`s in flight, ordered as §4.4
   says, each result checked to be exactly 16 200 bytes, copied into the CPU array, uploaded with
   `texSubImage3D` into its layer, and marked resident. Each base64 string is dropped as soon as its
   frame is decoded.
5. The stripes track, the coverage line and the global means need no decoding (they are plain
   numbers in the snapshot), so they draw at step 1.

The inflater is `DecompressionStream('deflate')` (zlib format, RFC 1950). Where that is missing, the
pure-JS `inflateRaw`/`unzlib` copied from Global Weather's `app.js` does the job, with its output cap
of 16 200 bytes. Snuggery's iOS 18 floor has `DecompressionStream`. The fallback is for the web copy
in older browsers, and costs about 6 KB.

### 4.6 State kept between launches

All in `localStorage` under `ww.*`, every read and write in `try/catch`. Anything that fails to parse
or is out of range reads as the default.

| Key | Holds | Default |
| --- | --- | --- |
| `ww.view` | `"globe"` or `"map"` | `"globe"` |
| `ww.globe` | `{lon, lat, zoom}` | the clock's longitude, 20° N, 1 |
| `ww.map` | `{lon0, y, zoom}` | lon0 0, centered, 1 |
| `ww.mode` | `"annual"` or `"months"` | `"annual"` |
| `ww.year` | a year number, kept only if it is a step of the current snapshot | the last complete year |
| `ww.month` | `"YYYY-MM"`, kept only if it is in `months` | the newest month |
| `ww.focus` | `true` / anything else | off |
| `ww.opened` | `true` once the opening has run or been skipped | absent |

The selected cell is not stored. A reload opens with nothing selected.

---

## 5. Rendering

### 5.1 The decision: WebGL2, one array texture, measured

The two candidates were Global Weather's per-pixel Canvas 2D orthographic raster (proven, simple)
and Earth's History's WebGL2 full-screen-triangle shader (sharper, cheap redraws, globe and map in
one shader). They were measured on the real data: the August 2026 release's 147 annual frames and 24
months, built with the contract's encoding by `tools/bench/make_frames.py`. The measurements ran in
headless Chromium 153 at 390 × 844 with a 390 × 600 panel, so 780 × 1 200 = 936 000 device pixels at
DPR 2. The Canvas route was given its best shape: a per-pixel cell index cached while the view is
still, so a year change is one lookup per pixel.

```
scripts/warming_world/.venv/bin/python warming-world/tools/bench/make_frames.py
PLAYWRIGHT_MODULE=<scratch>/pw/node_modules/playwright/index.mjs node warming-world/tools/bench/run.mjs
```

| Measured (renderer: SwiftShader, Chromium's CPU GPU) | Canvas 2D, per device px | WebGL2, array texture |
| --- | --: | --: |
| Year change, main thread, DPR 2 (median / p90) | 2.4 / 3.3 ms | 0.0 / 0.0 ms |
| Rotation frame, main thread, DPR 2 | 9.3 / 9.7 ms | 0.0 / 0.0 ms |
| Rotation frame, main thread, DPR 3 | 20.8 / 21.1 ms; frame interval p90 **33.4 ms** (30 fps) | 0.0 / 0.1 ms; interval 16.7 ms |
| One draw incl. GPU (synchronous readback), orthographic | n/a | 3.6 ms median |
| Same, Equal Earth (6 Newton steps in the shader) | n/a | 5.5 ms median |
| Upload of all 171 frames (2 770 200 B) once | n/a | 1.8–2.7 ms |
| Upload per year instead (`texSubImage3D`, 16 200 B) + draw | n/a | 3.6 ms median (no saving) |
| Inflate all 171 frames (`DecompressionStream`, parallel) | 19.6–20.2 ms | same |
| A pixel at the disc center, WebGL vs the LUT | | identical (`[255,193,178]`) |

(Two runs, 2026-09-30, on this Mac. Neither is phone evidence; the ratios are what decide.)

**Choice: WebGL2.** The Canvas route's year change is cheap, but each rotation re-inverts the
projection on the CPU for every pixel. That is 9.3 ms on this Mac at DPR 2, and it dropped to 30 fps
at DPR 3. A phone's JavaScript is slower, so a drag of the globe would stutter at full sharpness, or
it would need Global Weather's 3 px blocks. Those blocks would put ragged steps on every 2° cell
edge, and the cell edges are the honest picture of the data's resolution (§5.4). With WebGL2 both a
rotation and a year change cost nothing on the main thread, and the overlay (coastlines) is
redrawn only when the view moves.

**One array texture, not one texture swapped per year.** Per-year `texSubImage3D` measured no
cheaper per frame, and it puts an upload on the scrub path. The array costs 2.77 MB of GPU memory
in total, so every year is always ready.

### 5.2 Context and canvases

- `canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false,
  premultipliedAlpha: false, preserveDrawingBuffer: false })`. If that returns null, show §3.7's
  sentence.
- Size: panel CSS size × `min(devicePixelRatio, 2)`, set from a `ResizeObserver`. The overlay canvas
  uses the same factor. The cap matches Earth's History. A 2° cell is about 12 device px across at
  the globe's center at DPR 2, and DPR 3 would add 2.25× the fill for no visible gain on cells. Lines
  at DPR 3 are a phone check, not a reason to pay it now.
- One empty VAO and `drawArrays(TRIANGLES, 0, 3)` with Earth's History's buffer-less full-screen
  triangle (its DESIGN §5.2).

### 5.3 The data texture

- `TEXTURE_2D_ARRAY`, internal format `R8`, 180 × 90 × L, where L = `steps.length + months.length`
  (171 for the August 2026 file). It is allocated once with `texImage3D(…, null)` and each layer is
  filled with `texSubImage3D` as it is decoded. `UNPACK_ALIGNMENT 1`. `NEAREST` for both filters, no
  mipmaps, `CLAMP_TO_EDGE`. Layers `0 … steps.length − 1` are the years in order. The months follow.
- Row 0 is the northern row (88–90° N), column 0 is 180–178° W. This is the snapshot's own order
  (CONTRACT §2), so a frame is uploaded exactly as decoded.
- The cap is checked at boot: L ≤ `gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)`. WebGL 2
  guarantees at least 256, and Chromium reported 2 048. 171 layers in 2026 reach 256 in 2111. The
  pipeline asserts L ≤ 256 as well (CONTRACT §8).
- **The LUT**: a 256 × 1 `RGBA8` texture. Entry `b` is the map ramp's color at `−12.7 + 0.1 b` °C,
  clamped to the ±4 °C ends (§7.1). Entry 255 is never sampled for color (the shader branches to the
  hatch first). It is built in JS from `ramp.js` at boot and once per theme change (the ramp is the
  same in both themes, but the panel colors it is drawn over are not).
- **The CPU copy** of the same bytes stays in memory (2.77 MB). The tap card reads it, the chart reads
  a cell's 147 values from it, and a context restore re-uploads from it.

### 5.4 The fragment shader

The uniforms are `uProj` (0 globe, 1 map), `uCenter`, `uScale`, `uView = (λ0, φ0)`, `uLayer`, `uDpr`
and the panel colors.

1. `p = (gl_FragCoord.xy − uCenter) / uScale`, with y up.
2. **Orthographic** (Earth's History's formulas): `r² = p·p`, `z = sqrt(max(0, 1 − r²))`,
   `φ = asin(clamp(z sin φ0 + p.y cos φ0, −1, 1))`, `λ = λ0 + atan(p.x, z cos φ0 − p.y sin φ0)`.
   Inside when `r² ≤ 1`. The edge is anti-aliased over 1 device px with
   `clamp((1 − sqrt(r²)) · uScale + 0.5, 0, 1)`.
3. **Equal Earth** (Šavrič, Patterson and Jenny 2018), with `A1 = 1.340264, A2 = −0.081106,
   A3 = 0.000893, A4 = 0.003796, M = √3/2`. These are checked against d3-geo 3.1.1's
   `equalEarth.js`. Newton's method runs 6 steps for θ from `y = p.y`, starting at θ = y. Then
   `λ = λ0 + M·p.x·(A1 + 3A2θ² + θ⁶(7A3 + 9A4θ²)) / cos θ` and `φ = asin(sin θ / M)`. Inside when
   `|p.y| ≤ 1.3173627` and `|λ − λ0| ≤ π`. *Measured*: x max 2.70663, y max 1.31736 with the
   forward formula (`node`, 2026-09-30). The edge is anti-aliased with `fwidth()` on the outline's
   implicit function.
4. **The cell**: `col = min(179, floor((λ° + 180) / 2))` after wrapping λ° into [−180, 180), and
   `row = clamp(floor((90 − φ°) / 2), 0, 89)`. Then `b = int(texelFetch(uData, ivec3(col, row,
   uLayer), 0).r * 255.0 + 0.5)`. This is **nearest cell, never interpolated**. A 2° cell is a mean
   over its whole area, so it is drawn as one flat patch with sharp edges. Bilinear sampling would
   blend a gray no-data cell into its neighbor and invent values along every coverage edge (RESEARCH
   §1.3). `texelFetch` has no derivatives, so Earth's History's antimeridian seam cannot occur.
5. **No data** (`b == 255`): a hatch in screen space at 45°, with a period of 6 CSS px
   (`6 · uDpr` device px) and lines 1.5 CSS px wide. Two neutral grays (§7.4). The hatch is fixed to
   the screen, not the sphere, so it stays crisp at the limb and reads as "missing" rather than as a
   texture of the ground.
6. **Data**: `texelFetch(uLut, ivec2(b, 0), 0)`.
7. **Outside** the disc or the map's outline: `--card` (the panel's ground, passed as a uniform per
   theme), flat. **No soft limb, glow, atmosphere or vignette** (ART): the limb is the overlay's 1 px
   `--card-ink` ring at 55 %. There is **no** shading, night side or glow that changes a cell's color
   inside the disc. The color of a cell is the number of a cell, so lighting is not applied to the
   data.

### 5.5 The Canvas 2D overlay

The overlay is one canvas over the WebGL canvas, at the same DPR, in CSS pixels, with the same
projection. Its forward functions in `proj.js` match the shader's inverse, tested to 1e−9 in
`test_proj.mjs` (§16). It draws:
- **Coastlines** (Natural Earth land outlines) and **lakes** of 5 000 km² and more, as one `Path2D`
  each, cached per view. On the globe they are broken where they cross the horizon and picked up
  where they come back (Global Weather's `sphereRings`). On the map they are clipped to the outline.
- **Borders**: fainter and thinner than the coastlines.
- **The graticule**: every 30°, faint, plus the equator a step stronger. Nothing else is drawn on
  the sphere.
- **Places**: tiers 1–2 at zoom 1 (186 places before collision culling), tier 3 from zoom 2, and
  tier 4 never drawn (it serves only the card's place phrase; CONTRACT §5.2). They are placed only
  on the facing hemisphere, with collision boxes, never over the selected cell's outline, and never
  in the top strip's or the legend's rectangles.
- **The selected cell**: its 2° quadrilateral (the four edges sampled every 0.25°), stroked in
  `#121212` at 1.5 px over a 3.5 px `#f5f5f5` halo (ART, both themes). It shows the cell's true
  size, about 222 km on a side at the equator.
- **Keyboard crosshair**: when the Earth has keyboard focus, a small cross at the seat's center
  (§11).

Every line needs a halo or a stroke that reads on both ramp ends and on the hatch. ART's "Layers"
table sets them, **the same in both themes** (they sit on the data): the graticule 0.6 px `#101010`
at 13 % (the equator 24 %); borders 0.5 px `#101010` at 30 %; coastlines and lakes 0.8 px `#101010`
at 74 % over a 2.2 px white halo at 40 %; places in Archivo 500 11 px `#121212` over a 3 px `#f5f5f5`
halo at 85 %; the selected cell 1.5 px `#121212` over a 3.5 px `#f5f5f5` halo at 95 %; the limb 1 px
`--card-ink` at 55 %. `shoot.mjs` samples the contrast (§16).

### 5.6 Redraw only on change

There is one `requestRender()` that schedules a single `requestAnimationFrame` when none is pending.
Dirty flags decide what a frame does:

| Flag | Set by | Cost |
| --- | --- | --- |
| `earth` | a step change, a view change, resize, theme | one draw |
| `overlay` | a view change, resize, theme, selection | paths rebuilt only on a view change |
| `track` | a step change (thumb only), a mode change or theme (stripes re-rendered to a cached bitmap) | a `drawImage` and a 2 px rule |
| `card` | a step change while a cell is selected | the marker and the value; the chart's series is cached per cell |

Only play, a fling, a pole turn and the opening keep scheduling frames. When all are idle, nothing
runs.

### 5.7 Context loss

On `webglcontextlost`: call `preventDefault()`, stop the scheduler, forget every GL object, and show
"Restoring the view…". On `webglcontextrestored`: rebuild the program, the VAO, the LUT, and the
array texture from the CPU copy (one `texImage3D` of all layers, *measured* 1.8–2.7 ms in the
bench), then redraw. `shoot.mjs` forces this with `WEBGL_lose_context` (*verified* present in
Chromium 153) and fails on any console error.

### 5.8 Without WebGL 2

The Earth panel shows the sentence from §3.7. The year row, the stripes, play, the controls, focus
mode's keys (hidden, since there is no view to focus on) and About keep working. There is no Canvas 2D
fallback in v1 (§17). Snuggery's iOS 18 floor has WebGL 2 in its web view.

---

## 6. Views and gestures

### 6.1 Globe

- **Drag** turns the world under the finger (Global Weather's `panBy`: one radius of drag is one
  radian). Latitude is clamped to ±89.5°.
- **Fling**: velocity decays by 0.92 per frame and stops below 0.05° a frame. Off under Reduce
  Motion.
- **Pinch** zooms 1–4× about the pinch center. **Double-tap** at zoom 1 zooms in 2× about the
  finger; zoomed, it goes home (zoom 1, latitude 20°, longitude kept) (§21 R-7). **Wheel** zooms (web copy).
- **Tap**: under 8 px of movement and under 300 ms. It selects the cell (§8).

### 6.2 Map: Equal Earth, not Mercator

Global Weather's map is Web Mercator. This one is **Equal Earth**, for reasons that are about the
data:
- Mercator multiplies area by 1/cos² latitude, which is about 15× at 75° N. The Arctic is where the
  anomalies are largest: 846 cells beyond +4 °C in 2025, mostly north of 64° N, against an
  area-weighted mean there of +2.97 °C and a global +1.21 °C (the snapshot's `beyondScale` and
  `ask`, CONTRACT "Builder's decisions"; RESEARCH §1.6's 872 and +3.37 counted unrounded values and
  unweighted cells). Mercator would paint the warmest place
  on Earth fifteen times its size and make the planet look redder than it is.
- Mercator cannot show the poles, so it would cut off the very region the Arctic key exists for.
- On an equal-area map, each cell's area on screen is proportional to its area on Earth. "How much
  of the map is red" is then the honest share, and the coverage figure in the year row ("97 % of
  Earth's surface") is what the eye sees. Cell area on a 2° grid is proportional to the cosine of
  the cell's center latitude (CONTRACT §2), so the shares agree.

Gestures: a horizontal drag moves the **central meridian** λ0, and the world wraps (Earth's
History's Mollweide does the same). A vertical drag pans only when zoomed. Pinch zooms 1–4×.
Double-tap zooms in 2× at zoom 1 and goes home when zoomed (§21 R-7). A tap selects.

### 6.3 Carrying the view across

Globe → map: λ0 = the globe's center longitude, and the map's vertical center goes to the globe's
center latitude when zoomed. Map → globe: center longitude = λ0, latitude = the map's center
latitude clamped to ±80°. The zoom factor carries as it is. The selection and the step carry. The
switch redraws in the same frame, with no animation between the projections.

### 6.4 Arctic and Antarctic

- **Arctic** turns the globe to latitude **72° N**, keeping its longitude, over 600 ms on the app's
  curve (§19), at the current zoom. **Antarctic** turns it to 72° S. Under Reduce Motion the turn is
  instant.
- In Map view, either key switches to the Globe and turns. The globe is the honest view of a pole,
  and Equal Earth flattens both poles into lines.
- A key is marked active while the view is within 2° of its target. Any drag clears it.
- **Cost**: one animated `uView`. The overlay is rebuilt each frame of the turn. That is the same
  work as a drag, and it is a phone check (§13).

### 6.5 Keyboard (and the web copy)

- On the track (`role="slider"`): ← → one step, PageUp/PageDown 10 years (or 6 months), Home/End,
  Space to play or pause.
- On the Earth (focusable, `role="application"` while focused): arrow keys turn the globe 5° (or pan
  the map). `+`/`−` zoom. Enter selects the cell under the crosshair.
- **Escape**, one thing per press: it closes About if open, else clears the selection, else leaves
  focus mode.

---

## 7. Colors and scales

### 7.1 The map's scale: ±4 °C, fixed, symmetric, printed

- One **diverging ramp**: blue below 0, a near-white neutral at 0, red above. It is **fixed at −4 …
  +4 °C**. It is never re-fitted to a year, a view or a data release, and the scale is constant code
  in `ramp.js`, not a value read from the snapshot (CONTRACT §0 says why the snapshot does not
  carry it).
- Values beyond the ends take the end colors. Measured (RESEARCH §1.6): 0.233 % of all annual
  cell-years, 2.20 % since 2016, and **846 cells (5.2 %) in 2025** (strictly above +4.0 °C after
  rounding to 0.1 °C, the legend's own count; RESEARCH's 872 counted unrounded means), mostly
  Arctic, with a maximum of +5.31 °C (+5.3 as shipped). The data are not clipped: the file holds ±12.7 °C, the tap shows the true value, and the
  legend counts the cells beyond each end for the step on screen (§7.3).
- The color is quantized at exactly the data's 0.1 °C. The LUT has one entry per byte.
- **Constraints on the ramp** (ART set the exact stops, below; `tools/check.mjs` asserts these on
  `ramp.js`):
  - Lightness in OKLab is symmetric: `|L(+v) − L(−v)| ≤ 0.02` for every v in 0.1 steps to 4.
  - Lightness falls monotonically from 0 to each end.
  - Chroma at 0 °C is ≤ 0.02.
  - The ends are distinct from each other and from the hatch grays under a deuteranopia and a
    protanopia simulation (the matrices copied into the test with their source cited):
    ΔE(OKLab) ≥ 0.15 between −4 and +4, and ≥ 0.08 between ±1 °C and 0 °C.
  - The same ramp in both themes. A number is a color whatever the theme.
- **The stops** (ART, OKLCh, interpolated in OKLab; `tools/art/ramp.py` checks every constraint
  above and printed "ALL CHECKS PASS"):

  | °C | −4 | −2 | −1 | −0.5 | 0 | +0.5 | +1 | +2 | +4 |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | L | 0.440 | 0.640 | 0.800 | 0.890 | 0.965 | 0.890 | 0.800 | 0.640 | 0.440 |
  | C | 0.120 | 0.105 | 0.062 | 0.030 | 0.004 | 0.032 | 0.068 | 0.125 | 0.125 |
  | h | 262 | 251 | 245 | 240 | 95 | 30 | 28 | 27 | 24 |

  Lightness falls fast near zero so the first half degree shows; the warm side runs rose to brick
  and never through orange or a signal red. These are the app's own numbers, not copied from any
  published palette.

### 7.2 The stripes' scale: ±1.5 °C, fixed, printed

- The stripes use **GISS's own global means**. These are the table's `J-D` for each year, the mean
  of the published months for the partial year, and the month's column for the 24 months. GISS's
  FAQ calls the index files definitive (RESEARCH §1.9). The grid's own global mean is used only to
  check the pipeline.
- The global means span **−0.49 °C (1909) to +1.29 °C (2024)**, and single months −0.82 … +1.48 °C
  (*measured* 2026-09-30 on the pinned September table, `cache/wayback/GLB.Ts+dSST.20260914.csv`:
  its `J-D` column and its twelve month columns). On the map's ±4 scale
  they would never get past a pale pink. So the stripes have **their own fixed scale, ±1.5 °C**,
  through the same ramp function. It holds every value GISS has published, and a future year beyond
  it takes the end color, as on the map. It is printed in the track's caption (§3.4).
- It is never auto-fitted. A future record does not rescale the past.

### 7.3 The legend (the panel's foot, 44 px)

Three lines (ART "Designed objects"):
- Line 1: the bar, **81 graduated steps of 2.6 px** (one per 0.1 °C byte, −4.0 … +4.0: the LUT
  itself, not a smooth gradient), 9 px tall, with **pointed ends** (7 px triangles in the end colors:
  "beyond is drawn in this color"), ticks every 0.5 °C (2 px) and at −4, −2, 0, +2, +4 (4 px). At
  the right: a 14 × 9 px hatch swatch and `no data`.
- Line 2: `≤ −4`, `−2`, `0`, `+2`, `≥ +4 °C` under their ticks. At the right, when the step has
  cells beyond an end, the snapshot's `beyondScale` (CONTRACT §3.4, strictly beyond ±4.0):
  `846 above +4`, `37 below −4`, or `37 below, 846 above`.
- Line 3 (caption, `--card-ink-2`): `Anomaly vs each place's 1951–1980 average, not temperature`. In
  Last 24 months it adds: `Single months swing further than years.` For a partial year: `Partial
  year: Jan–Aug.` Then the credit line or `Data: NASA GISS.` (§9).
- The legend is part of the controls and is hidden in focus mode (§10).

### 7.4 No data

The hatch uses two neutral grays at OKLab L 0.60 and 0.68, chroma 0, in both themes. Hatch and ramp
must stay distinct: chroma 0 against a colored ramp everywhere but at 0 °C, where the ramp is at
L 0.965, far lighter than either gray. The panel's ground must differ by ΔL ≥ 0.15 from the ramp's
0 °C color and by ≥ 0.10 from both hatch grays, in both themes. ART chose a **gray card**, light in
the light theme: `--card` `#bebebe` (OKLab L 0.802: 0.163 from 0 °C, 0.122 from the nearer gray) and
`#303030` dark (L 0.309: 0.655 and 0.291), measured by `tools/art/contrast.py`. On it the 0 °C cells
read as quiet paper, departures as ink, and the hatch as darker than the card. The globe's limb line
is drawn in any case.

---

## 8. Tap: the cell, its number, its line from 1880

A tap selects the cell under the finger; the inverse projection in JS mirrors the shader. Tapping the
selected cell again, or ✕, or Escape, clears it. The selection survives step changes, view changes
and play, so a person can hold one cell and scrub through 146 years of it.

**The card** opens over the lower part of the Earth panel, 222 px tall at 390 (262 px in Last 24
months): `--sheet` with a 1 px `--line-strong` edge and a 3 px radius, no shadow, no blur (ART). It
rises 6 px and fades in over 160 ms. If the selected cell would sit under it, the globe turns over 240 ms
to bring the cell into the free part above (instant under Reduce Motion). Contents, top to bottom:

1. **Where**: `64–66° N, 148–146° W`. A second phrase follows when a place from `places.json` lies
   inside the cell (`, with Fairbanks`) or within 250 km of its center (`, near Fairbanks`). Ocean
   cells get no name.
2. **The value**, in the year row's figure style: `+3.4 °C`. It is followed by `in 2025, against
   this cell's 1951–1980 average`. For a partial year: `in 2026 so far (Jan–Aug)`. In Last 24
   months: `in August 2026`.
   - When the value is beyond the scale: an added line, `Beyond the map's +4 °C end; drawn in the
     end color.`
   - When there are no data: `No estimate for this cell in 1880.` followed by `First year with
     data: 1903.` (or `No year has data.`).
3. **The chart**, 334 × 120 px. Its parts:
   - x: 1880 to the newest year, with ticks at 1880, 1950 and the newest.
   - y: symmetric, ±R where R = max(2, ceil(max |v|)) over the cell's years. Integer ticks if
     R ≤ 4, every 2 otherwise, all printed.
   - A faint band marks **1951–1980**, the base period the anomalies are measured against.
   - The zero line.
   - **The cell's annual line.** It breaks where a year has no data, and a hatched strip along the
     bottom marks those years. The partial year's point is hollow.
   - **GISS's global mean as a faint line** (the same numbers as the stripes), keyed `— global mean`
     in the labels row under the cell's stripes, never labeled inside the plot (§21 R-1).
   - A vertical rule at the step on screen. A horizontal drag on the chart scrubs the year, the rule's
     year printed at its head while held; a plain tap does nothing (§21 R-8).
   - Styles (ART): the cell's line 1.5 px `--ink` (never colored), the global mean 1 px `--ink-3`,
     the base band `--ink` at 7 %, the zero line at 45 %, the rule at 60 % with a 2.6 px dot.
   - **It draws itself** once per newly selected cell: the band, the zero and the global mean at
     once, then the cell's line from 1880 to the newest year over 480 ms, linear in years, with the
     cell's stripes (item 4) filling at the same pace. At once under Reduce Motion.
4. **The cell's own stripes**: 12 px under the chart, one per year, on the **map's ±4 °C scale**, so
   their colors mean what the globe's do. Years with no data are hatched. This is the cell's own
   version of the scrubber.
5. In **Last 24 months**, an extra 40 px row: the cell's 24 months as bars on the ±4 scale, with the
   month on screen marked.
6. **Footnote**, two lines, for the value on screen (§21 R-3, R-4): the rule (`Annual mean of at
   least 9 of 12 months.`, the partial year's `Mean of at least 6 of its 7 months (Jan–Jul).`, or
   `One month's value; the line shows annual means.`), then a clause true for every cell: `Land and
   sea ice: station anomalies spread up to 1 200 km. Open water: sea-surface anomalies.`

The card's text is the data. The chart's accessible name summarizes it: "Line chart of this cell's
annual anomaly from 1880 to 2025. First year with data 1903. Lowest −1.8 °C in 1966, highest
+5.3 °C in 2016."

---

## 9. The honesty notes, and where each one is on screen

| Statement | Where it shows | Backed by |
| --- | --- | --- |
| Anomalies, not temperatures; the base is 1951–1980 | the legend's caption (always, outside focus mode); the card's value line; About §1 | GISS FAQ (RESEARCH §2.1) |
| The scale is fixed at ±4 °C; beyond it the end colors | the legend's printed bar and caps, with the count of cells beyond; the card's added line; About §1 | RESEARCH §1.6 |
| Gray is no data, not "no change" | the legend's hatch swatch; the card's no-data line; About §3 | RESEARCH §1.12, §4 |
| Coverage per era | the year row's coverage line on every step; About §3's numbers, filled from the snapshot | RESEARCH §1.12 |
| 1 200 km smoothing: color need not mean a thermometer | About §2 and §3; the card's footnote | RESEARCH §2.1, §4 |
| Oceans are sea-surface anomalies (ERSST v5) | About §2 | GISS FAQ |
| The current year is partial | the year row's second line; the open stripe; the hollow chart point; the legend's caption; About §4 | RESEARCH §1.5 |
| Stripes are GISS's global means on their own ±1.5 °C scale | the track's caption; About §5 | RESEARCH §1.9 |
| Annual means and rounding are this app's | the on-screen attribution in About §8; About §5 | plan; `sources.GISTEMP['attribution']` |
| Monthly revisions; which release this is | About §6 and §9; the staleness notice (§12.4) | GISS FAQ |
| Uncertainty is not shown | About §7 | Lenssen et al. 2024 (RESEARCH §4) |
| NASA does not endorse this app | About §8 | NASA media guidelines (RESEARCH §2.2) |

The **credit line** (`Temperature: NASA GISS Surface Temperature Analysis (GISTEMP v4); annual
means and 0.1 °C rounding by this app.`) is required on screen. It sits at the top of About, and as
small text under the legend's caption at widths ≥ 375 px when no card is open. Below 375 px it moves
into About only, and the legend's caption ends with `Data: NASA GISS.` so the source is never off
screen. This placement is a decision (§18 D-9).

---

## 10. Focus mode

The owner's rule: everything hidden but the view and the one control it needs. Here that means the
globe (or map) and the year scrubber. It follows Earth's History §20 and US Quakes §22, in this
app's terms.

- **One state**, `st.focus`, persisted as `ww.focus` (`true`; anything else is off), off by default.
  A reload restores it before the first draw. It needs WebGL 2: without it the key is hidden and a
  stored `true` is ignored.
- **What leaves**, each element with `hidden` and `inert` (out of the accessibility tree and the tab
  order, not merely transparent): the top bar, the panel's top strip (Globe | Map, Arctic,
  Antarctic, the focus key itself), the legend, the year row, the Annual | Last 24 months switch,
  and the notices except "Restoring the view…". An open About closes first. Focus mode hides the
  printed scale, as Earth's History's hides its lens legend. Entering it is the viewer's explicit
  choice, and the scale returns with the controls.
- **What stays**: the Earth, with its gestures (drag, pinch, fling, double-tap, tap); the stripes
  track at full width with its thumb, ticks and the open partial stripe; and the controls row with
  ‹ ▶ › at its left and, in place of the switch, the step's name (`1998`, `2026, Jan–Aug
  (partial)`, `Aug 2026`) in Archivo 600 at 20 px, width 87.5 % (ART). The stripes keep their
  caption, frame, graduations and bracket: focus never shows the bare poster. The step's name is part of the scrubber:
  without it a colored globe has no year, and the partial label is honesty that never hides.
- **A tap in focus mode** opens the card over the Earth as usual (§8), with its ✕. Closing it
  returns to the clean view.
- **The Earth takes the freed rows**: the panel grows from 632 to 732 px at 844 tall (+44 the top
  bar, +56 the year row). The seat is the panel's full width by its height less 16 px (390 × 716),
  and the radius factor rises from 0.47 to 0.48. On a phone the globe's radius therefore goes from
  183 to 187 px, because the width limits it. The map stays width-limited. The canvases are
  resized once, through the normal path, with the DPR cap of 2.
- **The keys.** *Hide the controls*: the 30 × 30 key at the right end of the panel's top strip
  (44 × 44 hit). ART's mark is **what stays**: a 12 px circle (the globe) over a 16 px bar (the
  track), 1.4 px `--card-ink`, with two short ticks at the top corners at 55 % for the chrome that
  leaves (not Earth's History's corner marks). *Show the controls*: a ghost key in the panel's
  top-right corner, the same mark and size, with no fill, drawn like the overlay's lines (a 1.4 px
  `#f2f2f2` stroke over a 3.4 px dark halo at 45 %) so it reads over the card and any color. It is at 72 % opacity at rest and full on hover, focus or press. **Escape**
  leaves too (`aria-keyshortcuts="Escape"`). Double-tap keeps its meaning (in at zoom 1, home when
  zoomed) and never toggles focus mode.
- **Focus follows the keys only from the keyboard.** After Enter or Space on a key, focus moves to the
  ghost key on the way in and back to the entry key on the way out, with a ring
  (`focus({ focusVisible: true })`, *verified* honored in Chromium 153). After a pointer, focus
  stays where it was and nothing is ringed (US Quakes §22's finding).
- **Motion**: the grid takes its new rows at once, so every size is final straight away. The track
  and the controls row glide to their new places (FLIP, 280 ms on the app's curve). The Earth glides
  to its new seat, and the ghost key fades in. Leaving reverses it. The canvas is resized and drawn
  in the same task, so it is never blank. Under Reduce Motion it all happens at once, with no
  transition or animation running.
- **The opening never starts in focus mode** (§3.9). A stored `true` skips the opening.
- **Wide screens**: one column, with the Earth over the track and the controls row at full width.
- **Tests**: `shoot.mjs`'s `focus` scene, §16.

---

## 11. Accessibility and both themes

- **The Earth**: `role="img"` with an accessible name. For example: "Globe, 1998. Anomalies against
  each place's 1951–1980 average. Global mean +0.61 °C. Data cover 97 % of Earth's surface. No cell
  selected." It updates when a step settles: after play stops, after a drag ends, or 400 ms after a
  key step. It does not update on every frame of play. When focused for the keyboard it becomes
  `role="application"` with instructions in `aria-describedby`.
- **The scrubber**: `role="slider"`, `aria-valuemin` = first year, `aria-valuemax` = last,
  `aria-valuenow` = the shown year (or the month index in Last 24 months), and `aria-valuetext` =
  "1998, global mean +0.61 °C" (and "partial, January to August" for the partial year).
- **Live region** (polite): announces the step's name and global mean when a step settles,
  never during play. It also announces "Playing" and "Paused", the selection, and a data
  replacement.
- **Keys**: every control is a `<button>` with a visible label or an `aria-label`, and a 44 × 44 hit
  area. The segmented switches are radio groups with arrow-key movement. ‹ › have `aria-label`s
  "Previous year" and "Next year" (or "month").
- **Color is never the only carrier.** Every color has a number one tap away. No data is a pattern
  as well as a gray. The partial year is open, hollow and labeled, not only paler.
- **Contrast**: text ≥ 4.5:1 over its actual background in both themes, including text over the
  card's and the notices' `--sheet`, and the legend on the gray card (sampled in `shoot.mjs`). Lines on the Earth are checked against
  both ramp ends and the hatch (§5.5).
- **Reduce Motion** (`prefers-reduced-motion: reduce`): no opening, no fling, instant pole turns,
  card and focus changes at once, the year's digits do not roll, and the card's chart is drawn whole
  (ART "Motion"). **Play still plays**, because it is content the viewer asked for,
  not decoration, and each step is a cut, not a motion.
- **Both themes**: tokens on `:root`, redefined under `@media (prefers-color-scheme: dark)`. The data
  colors (ramp, hatch) and the overlay's line styles are identical in both. The chrome and the card
  follow the theme within §7.4's constraints, and every chrome token is an exact gray (ART's table;
  lowest text contrast 4.62:1, dark `--ink-3` on `--sheet`). Light and dark are checked by eye in `screenshots/`
  and by the contrast sampler.
- **Text size**: the layout holds at the browser's 125 % text zoom without horizontal scroll. The
  year row's lines may wrap to the card's scroll. `shoot.mjs` checks 125 %.

---

## 12. Data at runtime

### 12.1 Loading and validation

`data.js` validates every field the app reads, against CONTRACT §3. It checks:
- `schema` is 1 and `app` is "Warming World".
- The grid is exactly `{nx 180, ny 90, lon0 −179, lat0 89, dlon 2, dlat −2, cells true}`.
- The encoding is `deflate` with no delta and 255 as none.
- The one layer `anom` with its plane `v` (offset and step read from it, power 1).
- `steps` is non-empty, contiguous years from 1880, with at most the last one partial.
- `months` holds 1–24 consecutive `YYYY-MM` steps.
- Every step has `globalMean`, `coverage.area` in [0, 1] and `beyondScale`.
- Every plane is a non-empty base64 string.
- Layers ≤ the GPU's cap.

Each frame's inflated length is checked at decode: exactly 16 200. The first failure is reported in
words naming the field and the step (§3.7).

### 12.2 Indexes built once per load

These are all small: the per-step global means (two `Float32Array`s), coverage, the beyond-scale
counts, the year → layer and month → layer maps, and the places' cell index for the card's place
phrase.

### 12.3 A new snapshot while the app is open

Snuggery fires `visibilitychange` when the Shortcut replaces the file, and the app re-reads on every
`visible`. If `generatedAt` or `release.id` differ, the app validates the new file in full. If it
passes, it decodes all frames into a new CPU array, re-allocates the array texture when L changed
(`texImage3D`), or re-uploads it, and swaps. It keeps the view, the mode, the selected cell, and the
step **by its name**: the same year, or the same month if still among the 24, otherwise the newest.
It shows "New data: the <Month YYYY> release" for 4 s and announces it. If the new file fails,
everything stays as it was, with the notice from §3.7.

### 12.4 Staleness

The age is `now − generatedAt`. Over 75 days (two missed releases plus slack), the notice line
shows §3.7's sentence. The refresh workflow fails red long before that, at 60 days for the newest
month (CONTRACT §8), so a stale phone copy means the Shortcut or the workflow has stopped.

### 12.5 Snuggery's Ask

The snapshot's `ask` array (CONTRACT §3.8) is for Snuggery's Ask and is **never read by the app**.
It holds 6 notes, one row per year and the newest months: plain keys, numbers as the app shows them,
at most 200 rows. The pole means are the Arctic and Antarctic chip's own numbers (§22 L-3), and the
source note says whose reading an answer is, as NASA's guidance for AI products asks (§22 L-4).

---

## 13. Performance budgets and what to measure

**Bytes** (raw; caps asserted by the pipeline or `check.mjs`):

| File | Size | Status | Cap |
| --- | --: | --- | --: |
| `data/snapshot.json` | 1 118 942 (807 822 deflated) | *measured* on a prototype of the contract shape built from the August 2026 release | 1 500 000 |
| of which: 147 annual frames, base64 | 856 328 | *measured* (`make_frames.py`) | |
| of which: 24 monthly frames, base64 | 200 072 | *measured* | |
| of which: `ask` (176 rows on the prototype: 5 notes, 147 years, 24 months; the contract's 6 notes make 177) | 28 622 | *measured* on the prototype rows | 60 000 |
| `assets/world.json` (land, borders, lakes) | ≈ 375 000 | estimate: Global Weather's is 359 992 (123 745 deflated, *measured*) plus lakes | 420 000 |
| `assets/places.json` | ≈ 59 000 | estimate: all 1 251 Natural Earth places; the 1 128 of scalerank ≤ 4 *measured* 53 370 B in this shape | 70 000 |
| `assets/about.json` | ≈ 15 000 | estimate | 40 000 |
| `CREDITS.txt` | ≈ 12 000 | estimate | 30 000 |
| app code (`index.html`, `style.css`, `js/*.js`) | ≈ 110 000 | estimate | 160 000 |
| `fonts/` (`archivo-ww.woff2` 62 536 + `OFL.txt` 4 666) | 67 202 | *measured* (`cat fonts/*.woff2 fonts/OFL.txt \| wc -c`) | 250 000 |
| **ZIP** | ≈ 1.3 MB | estimate: 808 KB snapshot + 125 KB world + ~45 KB code and text + fonts + the `.md` files | **2 000 000** |

Growth: one annual frame is about 5.8 KB of base64 and 4.4 KB deflated, so the snapshot grows about
6 KB a year and stays under its cap for decades.

**Memory** (targets; the phone measures, the simulator does not):
- CPU: the frames, 2 770 200 B; the parsed snapshot's strings, about 1.1 MB, released as frames
  decode; geometry about 1.5 MB of `Path2D`s and float arrays; the per-step numbers in a few KB. The
  app's own data stay **under 8 MB**.
- GPU: the array texture, 2.77 MB; the LUT, 1 KB; two drawing buffers of up to 780 × 1 288 × 4 =
  4.0 MB each (WebGL and the overlay), plus the stripes and chart canvases (< 0.5 MB). That totals
  **under 12 MB** before the compositor's copies.

**Time** (targets on an iPhone 16-class phone; measured only on a phone):
- First paint: the first frame drawn within 1 s of launch. Every frame resident within 0.5 s of
  launch (*measured* 20 ms for the decode in Chromium on this Mac).
- A step change: ≤ 1 ms of main thread (*measured* 0.0–0.2 ms) and one draw.
- A rotation frame: the draw, plus rebuilding the overlay's paths ≤ 8 ms of JS. Global Weather does
  the same per frame and is in use on phones. This is still a phone check.
- Play at 8 years a second shows every year, in order, for the whole 1880 → newest run.
- Scrubbing: the drawn step equals the step under the finger at every frame (§4.4).

**How it is measured**: `window.__ww.perf()` (inert unless called) returns the last 120 frames' times
(earth draw submit, overlay, total) and the queue state. `shoot.mjs` prints it after its scripted
scrub and play, as a trend only. On the phone, five taps on the version line in About toggle a small
frame-time readout. The phone checks go to NOTES.md and the device matrix: frame time while turning
the globe at DPR 2, play from 1880, the scrub at the three speeds, memory after 5 minutes, a pole
turn, background and return (context loss), and a Shortcut refresh while open.

---

## 14. File layout

```
warming-world/
  index.html              the whole page; <script type="module" src="js/app.js">
  style.css               ART.md's tokens, both themes, the grid, the panel, the track, the card, About
  miniapp.json            {schemaVersion 1, name "Warming World", entryPoint "index.html", description, version "1.0"}
  fonts/                  archivo-ww.woff2 (Archivo, OFL, cut by tools/art/font_subset.py) and OFL.txt
  js/
    app.js                boot, state, the scheduler, persistence, focus mode, wiring, window.__ww (inert)
    data.js               fetch, validate (CONTRACT §3), the decode queue (§4.4–4.5), inflate (Global Weather's, copied)
    earth.js              WebGL2: context, program, the array texture, the LUT, draw, context loss
    shaders.js            the GLSL sources (orthographic, Equal Earth, cell lookup, hatch)
    proj.js               forward and inverse for both projections, the view, gestures, fling, pole turns, carry-across
    overlay.js            Canvas 2D: coastlines, lakes, borders, graticule, places, the selected cell, the crosshair
    track.js              the stripes track: the cached stripes bitmap, the thumb, ticks, pointer and keys, play
    readout.js            the year row, the legend and its counts, the notices
    card.js               the tap card: place phrase, value, chart, the cell's stripes, the 24-month row
    about.js              the About panel from assets/about.json and the snapshot's sources
    ramp.js               the map ramp (stops, OKLab interpolation), the stripes scale, the LUT builder, the hatch grays
    units.js              °C formatting (sign, U+2212, U+202F), percentages, coordinates, month names
    util.js               small helpers; the localStorage wrapper; ease
  assets/                 written by Template/scripts/warming_world/build_static.py (CONTRACT §5)
    world.json  places.json  about.json
  data/
    snapshot.json         the only file the phone's Shortcut replaces (CONTRACT §3)
  CREDITS.txt             written by build_static.py
  NOTES.md                running it, the code map, the size table, the phone checks, the caveats
  DESIGN.md               this file
  ART.md                  the art direction, "Gray Card"
  screenshots/            app.png 780 × 1688 and the scenes (left out of the ZIP)
  tools/                  left out of the ZIP
    RESEARCH.md  CONTRACT.md  HANDOFF.md (pipeline stage)
    check.mjs  shoot.mjs  test_decode.mjs  test_proj.mjs
    ref/snapshot_ref.json written by build_snapshot.py --ref (CONTRACT §9)
    bench/                the renderer measurement of §5.1 (make_frames.py, bench.html, raf.html, run.mjs)
    art/                  ART's study: ramp.py, contrast.py, font_subset.py, study_data.py, study.html, three PNGs
    node_modules/ .work/  gitignored (warming-world/.gitignore)
```

The pipeline is **not** in this folder. It lives in `Template/scripts/warming_world/`, beside the
other live apps', because the monthly job runs from `Template/scripts/` on a runner.

---

## 15. Pipeline and workflows (summary; every layout is in `tools/CONTRACT.md`)

In `Template/scripts/warming_world/` (RESEARCH §1.11; the standard library plus `requests` for
everything a runner executes):
- `refresh.py`: the monthly job, which runs `build_snapshot.py`'s `main()` (the code). It fetches the grid and the table (one URL at a time, resuming),
  checks the file's contract, builds the annual and monthly frames, the coverage, the global means,
  `sources` and `ask`, validates everything in CONTRACT §8, and writes `data/snapshot.json` only if
  every check passes. `--skip-release <id>` writes nothing when GISS's release is the one already
  published. `--source research` builds from the Internet Archive pins while data.giss.nasa.gov is
  unreachable (RESEARCH §3). `--ref` also writes `warming-world/tools/ref/snapshot_ref.json`.
- `gistemp.py`: the frame maths (annual rule, rounding, coverage, area weights), imported by
  `build_snapshot.py` only; `verify_snapshot.py` recomputes every frame with code of its own.
- `build_static.py`: `assets/world.json`, `assets/places.json`, `assets/about.json` and
  `CREDITS.txt` from the Natural Earth pins and `sources.py`. Run by hand when the static files
  change. Deterministic.
- `verify_snapshot.py` and `verify_static.py`: independent re-checks of what was written.
- `build_all.sh`: the demo snapshot, then static (CREDITS.txt takes the demo's access date from
  the snapshot step's credits fragment), then both verifiers; `--offline`, `--twice`. How to run
  everything is `tools/HANDOFF.md`.
- Already there: `netcdf3.py`, `common.py`, `paths.py`, `sources.py`, `probe.py`.

In `Template/.github/workflows/`:
- `refresh-warming-world.yml`: on the **15th** of each month (with a second slot on the 22nd for a
  late GISS release), `workflow_dispatch` with `force`, and a push to `main` touching the refresh
  code. It installs `requests` only. It force-pushes one parentless commit to the orphan branch
  **`data-warming-world`**, behind Global Weather's branch-name guard. It publishes nothing when the
  release is unchanged, and fails red when the newest month is over 60 days old.
- `publish-web.yml`: `Refresh warming-world` joins `workflow_run.workflows`, and `warming-world`
  joins the loop that takes live snapshots from data branches.
- `probe-warming-world.yml` exists already (RESEARCH).

The Shortcut's address (for MANUAL_STEPS): the data branch's copy of
`warming-world/data/snapshot.json`, in the same two forms as Global Weather's (public raw, or the
contents API with a read token).

---

## 16. Tests

- **`tools/check.mjs`** (Node, no dependencies; Earth's History's and US Quakes' shape) checks:
  - Shipped files within Snuggery's limits, with the ZIP's exclusions (`tools/`, `screenshots/`).
  - No `http://` or `https://` in any `.html`, `.css` or `.js`. Every `import`, `src`, `href`,
    `fetch(` and `url(` relative and inside the folder.
  - `assets/` holds exactly `world.json`, `places.json`, `about.json`. `data/` holds only
    `snapshot.json`.
  - `miniapp.json` is valid. No AI vendor or model name appears in any shipped text file, this one
    included.
  - The ramp's constraints (§7.1) on `js/ramp.js`, its stops equal to ART's table, and the stripes
    scale equals ±1.5.
  - `fonts/` holds exactly `archivo-ww.woff2` and `OFL.txt`; every chrome color token in
    `style.css` (both themes) has OKLCh chroma < 0.001.
  - App code ≤ 160 000 B, the snapshot ≤ 1 500 000 B, and `fonts/` ≤ 250 000 B.
  - The ZIP, built as `build-zips.yml` builds it, has `index.html` at its top and is ≤ 2 000 000 B.
  - Every size printed.
- **`tools/test_decode.mjs`** (Node 26; `DecompressionStream` *verified* global there) decodes the
  committed demo snapshot with `js/data.js` itself and checks:
  - Every frame inflates to 16 200 B, and the app's validator passes.
  - Each of `tools/ref/snapshot_ref.json`'s cells (60 seeded year-or-month × row × col triples, plus
    the fixed ones in CONTRACT §9) decodes to its reference value **exactly** at 0.1 °C, or to
    "none".
  - Row 0 is the north. The reference includes a cell at 64–66° N, 148–146° W and one at 88–90° S.
  - The partial step's label.
  - A deliberately broken copy (a frame cut by one byte, a wrong `nx`, an HTML body) fails with the
    expected sentence.
- **`tools/test_proj.mjs`** checks:
  - Orthographic and Equal Earth forward/inverse round trips on a 1° grid to < 1e−9 (float64).
  - Equal Earth's extent: x max 2.7066300 and y max 1.3173628 (§5.4).
  - The shader's float32 6-step Newton against the float64 12-step one, to < 1e−5 rad on the
    same grid (run in JS with `Math.fround`).
  - The cell index of 1 000 seeded points against a direct floor of lat and lon.
- **`tools/shoot.mjs`** (Playwright, headless Chromium, 390 × 844, DPR 2, touch, light and dark;
  `PLAYWRIGHT_MODULE` for a scratch install). It serves the folder itself and fails on any console
  error or warning, page error, failed request, or request outside the local server. Scenes, each a
  screenshot:
  - The globe at 1880, with the hatch visible: a pixel sample in the Southern Ocean reads a hatch
    gray.
  - The globe at the last complete year: the label, the global mean and the coverage equal the
    snapshot's.
  - The partial year: the label, the open stripe, the legend's caption.
  - The map at the same year, with the view carried across: the center longitude is equal.
  - Arctic, Antarctic, and Arctic from the map.
  - Last 24 months.
  - A tap on the Fairbanks cell: the card's value equals the reference, and the chart and the
    cell's stripes are drawn.
  - A tap on a no-data cell in 1880.
  - About, with its numbers equal to the snapshot's coverage.
  - A forced context loss and restore.
  - Broken, missing and stale snapshots: the sentences.
  - A snapshot replaced while open: the step kept by name, and the notice.
  - WebGL 2 disabled: the sentence, the track and play still work.
  - 320, 360 and 375 px widths: no horizontal scroll, the top strip fits.
  - 125 % text.
  - Contrast sampled over every text style in both themes, the legend's labels on the card
    included.
  - Fonts: `document.fonts` reports Archivo `loaded` before any picture, and canvas text is
    redrawn on `loadingdone` (the art study once drew the track's labels in a serif).
  - The opening writes stripes only up to `shown`: a pixel inside the frame right of the index is
    the page color. No element animates a number's text other than the rolling year twin.
  - The opening: plays, is skipped by a touch, never under Reduce Motion or twice.
  - **Play**: 3 s at 8 years a second. The recorded `shown` sequence advances by exactly one each
    step, 24 ± 2 steps, with no year skipped.
  - **The three-speed scrub** (the owner's rule): a finger dragged along the track at **2, 8 and
    30 years a second**, then a **150 years a second** flick. Each frame, the page records the step
    under the finger and the step drawn (`__ww.frameLog`). The test asserts:
    - drawn = under-the-finger on **every** frame at 2, 8 and 30;
    - on every frame drawn during the flick;
    - drawn = the final step on the first frame after the lift.

    It then repeats the 8 a second drag **during boot**, with the decoder slowed by the test hook
    `__ww.slowDecode(40)`. The step under the finger must be decoded next, within one decode time
    of being requested, and `shown` never labels a frame that is not drawn. The numbers are printed
    into NOTES.md.
  - **Focus** (§10), both themes:
    - entered by the key with a pointer: every hidden element is `hidden`, `inert` and computed
      `display: none`; the accessibility snapshot has the ghost key and not the rest; no focus
      moved; `ww.focus` stored;
    - entered and left by Enter: focus on the ghost key and back, each ringed;
    - the panel's new height and radius;
    - a scrub and play in focus;
    - a tap and its card;
    - left by Escape and by the ghost key;
    - a reload with focus on (restored, no opening);
    - Reduce Motion (at once, nothing running);
    - 844 × 390.
  - Pictures: `screenshots/card-{light,dark}.png` (780 × 1 688, the globe at the last complete year with the
    Fairbanks cell's card open; `app.png` is the README's composite, never written by the script),
    `focus-{light,dark}.png`, and one scene per item above under
    `tools/.work/shots/`.
- **The pipeline's own checks**: `verify_snapshot.py` and `verify_static.py` (CONTRACT §8), and two
  `build_static.py` runs byte-identical.
- **On the phone** (the owner, a device-matrix row): import the ZIP, play from 1880, scrub at three
  speeds, turn the globe, Arctic, a tap, the map, focus mode, background and return, a Shortcut
  refresh while open. These are the only evidence for frame time, memory and context loss.

---

## 17. Cut from v1, and why

- **The full monthly history** (1880 to now month by month, about 11 MB). It breaks the snapshot
  budget the phone's Shortcut downloads every day, and single months are noisy at 2°. The newest 24
  months are kept.
- **Sea ice** (NSIDC). It is a second dataset with its own projection and license; the plan names it
  a later layer.
- **CO₂ and causes.** That is a different story, and the plan cut the "cause" tab.
- **°F.** See D-6.
- **Uncertainty** (the Lenssen et al. 2024 ensemble). It is stated in About, not drawn.
- **Per-cell month counts**, which would show how many of the 12 months a cell's year rests on. That
  is one more plane per year; the footnote states the 9-month rule instead.
- **Seasonal views, trend maps, and a difference between two years.** Each is a derived statistic
  that needs its own honesty notes.
- **A Canvas 2D fallback renderer.** Snuggery's floor has WebGL 2 (§5.8).
- **Find (city search).** Places are labeled and the card names them. Search can come later.

---

## 18. Decisions taken where the plan was silent

- **D-1 Renderer: WebGL2 with one `R8` array texture**, measured against Canvas 2D (§5.1). The plan
  said "Canvas 2D (Global Weather copy)". The measurement overturns it for sharp cells at full
  resolution. The coastline overlay stays Canvas 2D, as Earth's History's does.
- **D-2 Map projection: Equal Earth, not Mercator** (§6.2). It is equal area, it shows the poles, and
  it does not inflate the Arctic.
- **D-3 Nearest cell, never interpolated** (RESEARCH §1.3; §5.4).
- **D-4 No cross-fade between steps.** Every frame is one year's data. Earth's History blends maps
  because its stops are pictures; this app's are measurements, and a blend is a value nobody
  measured.
- **D-5 Every frame resident from boot** (§4.4). That gives zero loads on the scrub path, for
  2.77 MB CPU + 2.77 MB GPU.
- **D-6 °C only, no °F switch.** The plan allows a US-units switch. But an anomaly's printed scale
  would become ±7.2 °F, the stripes' ±2.7 °F, and GISS publishes in °C. Two sets of printed numbers
  would invite a reading of the color as a different scale. The rule's default is °C, and this app
  keeps the default.
- **D-7 Play at 8 years a second, months at 4.** Play stops at the end, with no loop.
- **D-8 The opening** plays 1880 → the last complete year once (§3.9), writing the stripes behind
  the thumb (ART).
- **D-9 The credit line's placement** (§9): in About always, under the legend where it fits, and
  `Data: NASA GISS.` where it does not.
- **D-10 The app opens on the last complete year, never the partial one.**
- **D-11 Pole keys switch Map to Globe** (§6.4).
- **D-12 Coverage shown as area** (RESEARCH §1.12), per step, in the year row.
- **D-13 The stripes' scale ±1.5 °C** (RESEARCH §1.9's proposal, kept). It holds every annual and
  monthly value GISS has published.
- **D-14 CREDITS.txt at the app's root**, as Earth's History and US Quakes have, with no
  `assets/LICENSES.md`. Natural Earth's credit and GISS's citations live there and in About.
- **D-15 About's prose in `assets/about.json`** with placeholders filled from the snapshot, so
  no number about the data is typed into code or prose, and no URL is in the app's code.
- **D-16 Staleness at 75 days** in the app; the workflow fails at 60.
- **D-17 DPR capped at 2** (§5.2).

## 19. The art direction (ART.md, "Gray Card"), and what it could not change

ART.md was written before the build, and its change list is applied above. What it decided:
- **The look**: every chrome surface an exact gray (chroma 0), so every hue is a departure from
  1951–1980; the globe on a **gray card** in both themes (`#bebebe` / `#303030`), with no space,
  glow or limb light (§3.2, §5.4, §7.4).
- **Type**: Archivo only, one subset file with weight 400–700 and width 87.5–100 (67 202 B with its
  license), chosen for its plain zero in a year-heavy app, `tnum`, U+2212, ≤ ≥, and a width axis
  (§3.3, §13, §14).
- **The ramp's stops** (§7.1), the overlay's line styles, the same in both themes (§5.5).
- **The stripes as an instrument**: caption line, frame, graduations, the `1951–1980 = 0` bracket,
  the open partial stripe, a reading-index thumb that steps (§3.4).
- **The legend**: 81 graduated steps with pointed ends, the beyond counts as "above / below" (§7.3).
- **Motion**: `--turn` `cubic-bezier(0.45, 0, 0.2, 1)` for the globe, `--settle`
  `cubic-bezier(0.2, 0, 0, 1)` for what lies on the card; the year's digits roll during play only;
  numbers never count (§3.9, §11).
- **Signature moments**: the stripes written behind the thumb in the opening (§3.9), the Arctic
  turn (§6.4), the chart drawing itself (§8), play with the rolling counter (§4.3).
- **The card** as `--sheet` paper, not glass (§8); the focus mark "globe over track" (§10).

The `frontend-design` calibration list was applied: no cream, no accent, no serif, no mono, no
capitals or eyebrows, no middle-dot strings, no em-dash labels, no "→", no card kit, no shadows.

What ART could not change, and did not:
- the ±4 °C and ±1.5 °C scales;
- the ramp's symmetry and its sameness across themes;
- the hatch as the only no-data mark;
- nearest-cell drawing;
- the absence of any lighting on the cells;
- what is on screen for honesty (§9);
- the focus mode's contents (§10);
- the rows' minimum hit areas;
- the budgets.

It moved rows within §3's totals (the stripes row 52 → 64 px, the legend 40 → 44 px, the panel
644 → 632 px); `shoot.mjs`'s width checks at 320, 360, 375 and 390 decide whether that holds.

---

## §18 Builder's decisions (core)

The core pass (2026-10-01) built §3–§7 and §12 less the tap card, the pole keys, About, the opening
and focus mode. Where this file, ART.md and the brief were silent or disagreed, it decided as below.
`NOTES.md` has what each check printed.

- **B-1 Module names are §14's** (`shaders.js`, `overlay.js`, `track.js`, `readout.js`), not the
  brief's `shader.js`, `stripes.js` and `time.js`. The time model (play's clock, the two step lists,
  `wanted` and `shown`) lives in `app.js`'s scheduler, because the frame that resolves the step is the
  frame that draws it and writes its label.
- **B-2 App code is held to 200 000 B in `check.mjs`** (the brief's cap, US Quakes' raised one), not
  §13 and §16's 160 000. Measured: 122 570 B, inside both.
- **B-3 The legend is taller than 44 px.** Its three lines plus the credit line §9 requires at
  ≥ 375 px, with the release's newest month and, for a research build, "read from the Internet
  Archive's copy of GISS's files", measure about 108 px at 390. The seat's bottom is the legend's
  height with its longest caption (measured at layout), so the globe never moves between steps; at
  390 × 844 the globe stays width-limited at 183 px. The legend has the card's fill, so a zoomed map
  never lies under its text. ART may want to tighten this; the honesty lines cannot go.
- **B-4 The release is named on screen before About exists**: the credit line ends "Newest month
  July 2026" (and the research note). Below 375 px the caption ends "Data: NASA GISS, to July 2026,
  from an archived copy."
- **B-5 Coverage never prints 100 % while a cell has no value, nor 0 % while one has**: the whole
  percentage, except at those two ends, where one decimal is printed toward the truth (January 2025:
  0.9975 → "99.7 %", not "100 %").
- **B-6 The beyond counts move into the caption when they would collide** with "≥ +4 °C" (below
  about 360 px): "1 481 cells above +4 °C." starts the caption instead.
- **B-7 The stripes sit inside the 1 px frame**, and that inner box is the step geometry the finger,
  the thumb and the labels share. The thumb's page-colored halo also clears 9 × 5 px above the
  index, so the caption's descenders never touch it.
- **B-8 A stored partial year opens on the last complete year** (D-10 read strictly).
- **B-9 Map → Globe at map zoom 1 keeps the globe's latitude**: the whole map is in view, so its
  center latitude says nothing. From a zoomed map it takes the map's center latitude, clamped to ±80°.
- **B-10 Pinch zoom keeps the place under the fingers' midpoint** (three corrective pans), on both
  projections. Horizontal map drags use the equator's scale.
- **B-11 The hatch is the study's geometry**: 6 CSS px along a row (4.24 px across the lines), lines
  1.5 CSS px across, in screen space from `gl_FragCoord`'s x − y, so the lines lean as in the study.
- **B-12 Natural Earth's polygon seams are not coasts**: 11 land segments along the ±180° meridian and
  one along the South Pole's line are never stroked.
- **B-13 Place labels**: §5.5's tiers, plus: the place's dot must be on screen, within 0.92 of the
  globe's radius from its center, with 4 px between labels across and 2 px down.
- **B-14 The base period is the snapshot's** (`release.base`, validated): the bracket, its label, the
  caption and the Earth's name read it, so no year of it is typed in the code.
- **B-15 Wide screens move the legend to the right column** (§3.8) by moving its node at layout; the
  Earth then takes the whole panel below the top strip: radius 142 px at 844 × 390, as §3.8 computed.
- **B-16 A word joiner follows every en dash in the legend's caption**, so "Jan–Jul" never breaks
  at its dash. Tests strip U+2060 before comparing.
- **B-17 §4.1's switches follow its explicit rules** (Annual → the newest month; months → the year
  of the month showing); "each list keeps its own position" is read as what `ww.year` and `ww.month`
  keep across launches.
- **B-18 The scheduler's clock restarts after idle.** Play's first frame used to count the idle time
  since the last frame and advanced at once; `shoot.mjs` caught it (10 steps for 1990 → 2000).
- **B-19 Hooks for the next pass**: About, Arctic, Antarctic and the focus key are in the markup with
  `hidden`; `track.setWritten(n)` writes the opening's stripes; `view.factor`, `view.top` and
  `view.bottom` seat focus mode; `st.selection` and `select()` feed the card. A tap now outlines the
  cell and announces its bounds and value.
- **B-20 Canvas text is set semi-condensed through the `font` shorthand** (`semi-condensed 400 10.5px
  Archivo`), *measured* in Chromium 153 to narrow the stripes' caption from 173.1 to 154.6 px; iOS is
  a phone check.

Owner calls flagged, not decided: the legend's height (B-3); the label density at zoom 1 (§5.5's tiers
1–2 put 16–25 names on a phone globe); §10's legend hidden in focus mode.

## §19 Builder's decisions (polish)

The polish pass (2026-10-01) built what the core left: the tap card and its chart (§8), the pole keys
(§6.4), About (§3.6), the opening (§3.9), focus mode (§10), pausing when hidden, Reduce Motion
throughout, the top bar's stamp, and the rest of `shoot.mjs` (§16). `NOTES.md` has what each check
printed. Where this file, ART.md and the brief were silent or disagreed, it decided as below.

- **P-1 The north-of-64° reading has a place now.** This file named the number (§6.2) but put it
  nowhere on screen. While the Arctic key is on, a `--sheet` chip under the top strip reads
  `Mean north of 64° N: +2.97 °C` for the drawn step (Antarctic: `Mean south of 64° S`), and adds
  `, data cover 42 % of it` whenever a cell of the cap has no value (1880). It is the area-weighted
  mean of the drawn frame's own 0.1 °C cells (`data.js` `capMean`), never the `ask` rows, which the
  app does not read (CONTRACT §3.8). Against those rows, built from unrounded monthly means, the
  worst difference over all 171 steps is 0.0100 °C and 40 steps differ at the second decimal
  (`test_decode.mjs`); 2025 reads +2.97 in both. The Earth's accessible name carries the reading.
  The chip hides in focus mode. At 320 px it covers the top edge of the globe at zoom 1 (owner call).
- **P-2 The stamp in the top bar**, Global Weather's "Updated" pattern as the brief asked, against
  §3.1's "That is all": two lines at 10.5 px, `July 2026 release` over `Updated Sep 30, archived
  copy` (the local date of `generatedAt`; research mode named). Below 360 px only the first line. It
  is a key into About at "This copy". The research sentence stays where the core put it, in the
  legend's credit line (B-4), and in About.
- **P-3 About's version is `miniapp.json`'s**, read at runtime, so no version is typed in code.
- **P-4 About adds one paragraph it can count**, under "What the colors mean": the last complete
  year's cells beyond ±4 °C (`beyondScale`) out of its cells with a value (counted from the frame),
  and the share over every complete year: 4 585 of 2 086 125 values, **0.22 %**. RESEARCH §1.6's
  0.233 % counted unrounded means (the 846 against 872 of CONTRACT's Builder's decision 4).
- **P-5 The legend's caption is a key into About** at "What the colors mean", so the
  anomalies-not-temperatures caveat is one tap from the scale. Its hit area reaches 25 px up over the
  bar's labels to make 44 px.
- **P-6 Where the card sits.** On the phone it sits above the legend, as in the study, its foot at
  the legend's height without the credit line; while a card is open the credit hides and the
  caption ends `Data: NASA GISS, to July 2026, from an archived copy.`, so the source never leaves
  the screen (D-9). In focus mode its foot is 8 px above the panel's. On wide screens it docks under
  the controls (§3.8) and the side legend hides while it is open, because at 844 × 390 the column
  cannot hold the legend, the rows and a card; the card scrolls inside itself.
- **P-7 The card's turn.** When the selected cell's center lies under the card, the globe turns over
  240 ms (instant under Reduce Motion) to put the cell's center midway between the strip and the
  card's top: longitude to the cell's, latitude φ0 = φc − asin(Y), where Y is that point's height in
  globe radii. A zoomed map pans instead; a map at zoom 1 is left as it is.
- **P-8 The chart's details**: the y labels at the left in `--ink-3`, a faint grid at each labeled
  tick (`--ink` at 8 %), the partial year's hollow point not joined to the line, and the
  `global mean` label drawn last on a paper halo so the cell's line never cuts it. The x labels are
  ART's (the first year, the base period under its band, the newest year), not §8's 1880 / 1950 /
  newest ticks. The months row: bars from a zero rule, their height the value to ±4 °C, the month on
  screen framed, `±4` printed at its left, the first and newest month labeled. A tap on the chart
  moves the step to that year (from Last 24 months it switches to Annual).
- **P-9 The card's footnote is the snapshot's**: "at least 9 months" from `annual.minMonths`, and
  "1 200 km" from `source.detail`. The `250 km` of the place phrase and the ±4 °C scale stay
  constants of the app (§8, CONTRACT §0).
- **P-10 The chart always finishes.** The scheduler keeps frames coming until the frame that draws the
  whole line has run. `shoot.mjs` reads the drawing from the frame log, not the clock: SwiftShader's
  first frame after a tap lands about 300 ms late (its compositing; a CPU profile showed under 2 ms
  of script), and the check is that every partial frame's share matches a constant 480 ms rate.
- **P-11 The opening's mechanics.** The decoder starts at 1880; each drawn step writes the stripes to
  itself (`track.setWritten(shown + 1)`); play's end is the last complete year. A capture-phase
  `pointerdown`, `keydown` or `wheel` anywhere ends it, and the touch then does what it would (a tap
  on ▶ plays on from that year). Hiding the page ends it too. The globe faces the clock's longitude
  at 20° N for the opening only; otherwise the stored view stands.
- **P-12 Focus mode's seat and glide.** The seat is the panel less 8 px top and bottom, factor 0.48:
  radius 187.2 px at 390 × 844 (measured). The Earth glides from where it was (its center offset and
  radius factor eased over 280 ms on `--turn`). At 390 × 844 the track and the controls do not move,
  because the panel grows by exactly the rows that leave; FLIP moves them where they do move. The
  canvases are resized and drawn in the same task (`layout()` draws at once), so they are never
  blank. Notices hide by CSS, except "Restoring the view…".
- **P-13 Hit targets.** The switches' options have a 30 px minimum width, so with their 7 px reach on
  each side every option is at least 44 px wide (the word "Map" alone is narrower). Everything else was
  already 44 × 44; `shoot.mjs` measures every visible control in four states.
- **P-14 Chips are set at width 87.5 %** (ART's instrument width) so the opening's line fits on one
  line at 390, as ART asks.
- **P-15 Hidden means still.** On `visibilitychange` to hidden the opening ends, play stops, and any
  turn or glide jumps to its end; on visible the snapshot is re-read as the core did.
- **P-16 Escape, one thing per press**: About, else the selected cell, else focus mode (§6.5). Any key
  ends the opening first.
- **P-17 125 % is tested as browser zoom**: a 312 × 675 CSS px viewport at 2.5 device px, which is
  what 125 % does to a 390 × 844 screen (Safari's text size zooms the page the same way). CSS
  `zoom` on the root was tried first and is not the same thing: it leaves `100dvh` unzoomed.

Owner calls flagged, not decided: the stamp against §3.1 (P-2); the pole chip over the globe's top
edge at 320 px (P-1); the side legend hidden while a card is docked on wide screens (P-6); and the
core's three (B-3's legend height, the label density, the legend hidden in focus mode).

## §20 Builder's decisions (QA pass)

The QA pass (2026-10-01) applied QA's one must, one should and three nits, and the lead's four notes.
`NOTES.md` has what each check printed. These win over the sections above where they differ.

- **Q-1 The selected cell's mark is drawn from its true projected quadrilateral and never covers
  the cell** (QA's must; §5.5's "its 2° outline"). The old outline was centered on the cell's edges,
  1.5 px of ink over a 3.5 px halo sized for the equator; a 2° cell is 6.4 px tall at zoom 1 but only
  2.7 px wide at Fairbanks (cos 65°) and 1.0 px at 80°, so the halo filled it and the cell read as a
  blob. Now the four edges are sampled every 0.5° (on the map unwrapped about the cell's center, so a
  cell on the ±180° seam stays whole), and the cell's on-screen size m is the smaller distance between
  the midpoints of opposite edges.
  - **m ≥ 4 px: a frame outside the cell.** Every stroke is clipped to the cell's exterior, so not one
    of the cell's pixels is covered: a pale gap, the ink line, a pale halo, 0.5 + 1.5 + 1.5 px (ART's
    1.5 px of `#121212` and 3.5 px of `#f5f5f5` at 95 %, moved outside) at m ≥ 6, scaled down with m
    below that and never wider than 0.6 m.
  - **m < 4 px: an open ring** centered on the cell, radius 9 px (or 3 px wider than the cell's half
    diagonal), the same ink over the same halo: a mark to find again once the finger lifts, the cell
    and its neighbors visible inside it. On the 390 px globe at zoom 1 that is every cell from about
    51° poleward where the globe faces it (sooner toward the limb), and every cell on the map at zoom 1.
  The labels keep clear of the mark's box. `overlay.stats().mark` reports which was drawn.
- **Q-2 The mark is tested as a hollow shape.** `shoot.mjs` selects ocean cells at 0°, 45°, 64° and
  80° on the globe at zoom 1, on the map at zoom 1 and (0°, 45°) on the map at zoom 3, works out each
  center with its own projections, and asserts: the WebGL pixel at the center is the cell's ramp color
  (worst channel off by 0), the overlay has nothing at the center or anywhere out to the cell's edges
  along the four rays to their midpoints, and the mark's opaque ink lies on all four rays within
  reach. The ink must be the mark's own (opaque, ≤ 30 per channel): a coastline's 74 % ink over its
  halo does not count.
- **Q-3 Pressed and hover, in grays** (QA's should; ART "Designed objects"). A press lays a plate of
  the key's own ink at 14 % behind it (a 3 px radius; inside the play ring, the ring fills) and brings
  a text key to full ink. Hover, only for a hovering pointer (`@media (hover: hover)`, so a touch never
  leaves a key lit), brings a text key to full ink and lays a 7 % plate behind an icon key. The plates
  are `color-mix()` of `currentColor`, which is always a gray token, with transparency: no hue, no
  shadow, no scale. `:focus-visible` stays the 2 px ring and shows no plate. The stripes track's frame
  is `--line-strong` at rest, `--ink-2` under a hovering pointer and `--ink` pressed (ART's). The ghost
  key keeps its opacity rule, because a plate there would cover the data. **The pressed state is a
  class (`.down`) set by capture-phase pointer events** as well as `:active`: WebKit gives `:active`
  to a touch only when a touch listener exists, and late, and Chromium's emulated touches never set it
  at all, so the class is what shows under a finger on every engine and what `shoot.mjs` can test;
  `:active` stays for a key held from the keyboard.
- **Q-4 The nits.** The switch's underline is a 1 px wide mark moved and stretched by `transform`
  (`translateX` to the option, `scaleX` its width, 140 ms `--settle`), never `left`/`width`.
  `<meta name="theme-color">` for each scheme is that theme's `--page` (`#f5f5f5`, `#1f1f1f`);
  `check.mjs` asserts it. GISS, NASA GISS, GISTEMP (v4), Archivo and Natural Earth, and the card's
  place name, sit in `<span translate="no">` wherever they are DOM text (the legend, the card, About,
  the notices; `util.richText`). The canvases' text is not translated by any browser.
- **Q-5 The legend is two text lines, 65 px at 390** (the lead's note a; was about 108; ART's 44
  cannot hold the honesty lines). The caption is one line: `Anomaly vs each place's 1951–1980
  average, not temperature.` (259.5 px), with ` Partial year: Jan–Jul.` (348.5 px, inside the 358 px
  column at 390). The credit is one small line, the snapshot's attribution with its label read as
  "Data:" and GISS's product name cut to its acronym: `Data: NASA GISS (GISTEMP v4); annual means and
  0.1 °C rounding by this app.` (334.1 px; if the pipeline ever words the attribution otherwise, the
  line is the attribution as it stands, and the legend measures its own height). The full credit line
  stays first in About. "Newest month July 2026; read from the Internet Archive's copy of GISS's
  files" left the legend: the release and the research mode are now the top bar's one line (Q-6),
  and in About. **Declined: the beyond-scale count beside the hatch key.** It already sits in the
  legend's right column, under the hatch key, at the right of the label row; moving it onto the bar's
  row gains no height (that row is the bar's) and would read as a count of no-data cells. The months'
  clause (`Single months swing further than years.`, 424 px) does not fit one line, so **the
  reserve is now measured per time list**: 65 px for Annual, 79 px for Last 24 months at 390, and a
  switch between the lists moves the Earth's center by 7 px (scrubbing never moves it). The reserve
  now also includes B-6's beyond-count lead, the longest of the list: before this pass the partial
  year's legend at 320 px was 79 px over a 65 px reserve, hidden only because one reserve covered the
  longer months caption. At 390 × 844 the globe stays width-limited at 183.3 px, so the 43 px go to
  the space above and below it and to the card's room; at 375 × 667 the reserve is 79 (the partial
  caption wraps there), at 320 × 568 it is 79 and the globe's radius 109.5 px (it was 116.1 over a
  reserve that was too small).
- **Q-6 The stamp is one line** (the lead's note b): `July 2026 release, archived copy` for a
  research copy, `July 2026 release, updated Sep 30` for a live one, 10.5 px `--ink-2`, a key into
  About's "This copy" as before. A comma, not the lead's middle dot: ART's list forbids middle-dot
  strings. The date of a research copy is in About ("Data file made"). Below 360 px only `July 2026
  release` shows, and the legend's caption ends `Data: NASA GISS, to July 2026, from an archived copy.`
  as before (B-4), so the research mode is on screen at every width.
- **Q-7 Focus mode keeps the legend hidden** (the lead's note d; §10 stands, the owner's call as
  flagged). The printed scale is one tap away: the ghost key, whose accessible name is now "Show the
  controls and the color scale", or Escape.
- **Q-8 Place labels at zoom 1** (the lead's note c). Measured on the 390 px globe at zoom 1, every 30°
  of longitude at 20° N, tiers 1–2 drew 10, 10, 13, 15, 21, 25, 27, 21, 28, 25, 16 and 16 names, and
  the map 16–19. So below zoom 1.5 a phone-sized Earth (seat under 600 px across) shows tier 1 only:
  now 4–15 on the globe (15 over Europe and Africa) and 11–13 on the map; tier 2 returns at zoom 1.5
  (30 names over Europe), tier 3 at 2 as before. A larger Earth (an iPad's) keeps tier 2 at zoom 1. A
  rule by count (tier 1 when more than twelve would draw) was not used: the set would flip while the
  globe turns.

Owner calls flagged, not decided: the credit's short form on screen (Q-5) against §9's full line under
the legend; the 7 px move of the Earth's center on Annual ↔ Last 24 months (Q-5); and the earlier ones
(P-1, P-6, and §10's legend hidden in focus mode).

## §21 Builder's decisions (review pass)

Two reviewers (honesty and numbers; a stranger's phone) examined the app after the QA pass. These
win over the sections above where they differ. `NOTES.md` has what each check printed.

- **R-1 The global mean's label left the plot** (both reviewers' must). It was drawn last, on a 3 px
  paper halo at the plot's top right, exactly where a warming cell's line runs in recent decades, and
  erased stretches of it (Fairbanks: 2001–2005, 2013, 2022–2023), which read as missing years. Now a
  key, a 12 px sample of the 1 px `--ink-3` line and `global mean`, sits in the labels row under the
  cell's stripes, in the first gap between `1880`, `1951–1980` and the newest year that holds it.
  `shoot.mjs` samples the line at a quarter, half and three quarters of every segment between two
  years with data (426 points at Fairbanks) and finds ink on each; a copy with the old label failed
  on 8 segments.
- **R-2 The top strip has its own ground** (B's must). `.strip { background: var(--card) }`: a zoomed
  globe or a map panned to the top passes under Globe | Map, Arctic, Antarctic and the focus key
  instead of through them (1.03–1.57:1 measured before in dark). At zoom 1 nothing reaches the strip,
  so nothing changes there. The ghost key in focus mode is `.iconkey.ghost { position: absolute }`:
  the QA pass's plate rule (`.iconkey { position: relative }`, later and of equal weight) had moved it
  to the panel's top left, 4 px off screen.
- **R-3 The card's footnote follows the step** (both reviewers' must): `Annual mean of at least 9 of 12
  months.` for a complete year, `Mean of at least 6 of its 7 months (Jan–Jul).` for the partial year
  (⌈`partialCellShare` × its months⌉, from the snapshot), `One month's value; the line shows annual
  means.` in Last 24 months. Written with the value on every step (`card.footText`).
- **R-4 The footnote is true over open water** (both reviewers' should; §8 item 6 carried the error).
  `Land and sea ice: station anomalies spread up to 1 200 km. Open water: sea-surface anomalies.`,
  GISS's own split ("SAT anomalies over land and sea ice … SST anomalies over (ice-free) water"); the
  1 200 km is read from the snapshot's detail as before.
- **R-5 SI spacing everywhere the app prints** (A's should). The stripes' caption and data.js's error
  text use U+202F. The snapshot's credit lines (the attribution's `0.1 °C`, a source name's `200 km`)
  are the pipeline's and keep a plain space there; the app sets every snapshot string it prints
  through `units.si` (a digit, U+0020, then °C, km or %, becomes U+202F). `check.mjs` now fails on a
  plain space before °C, % or km in `index.html`, `js/` and `assets/about.json`, and `shoot.mjs` on
  one in About's rendered text. **Not fixed: `CREDITS.txt` and `data/snapshot.json`**, which carry
  `sources.GISTEMP['attribution']` verbatim (and `verify_static.py` pins it); that is a change to
  `sources.py` and `verify_static.py`, outside this pass's files, for the lead.
- **R-6 The touch that stops the opening only stops it.** If it lands on the Earth, its tap opens no
  card (a capture-phase flag the tap handler reads once). On ▶, the track or a key it still acts.
- **R-7 Double-tap zooms in, as Photos does** (B's should): at zoom 1, 2× about the finger (with
  B-10's corrective pans); zoomed, home. Neither selects.
- **R-8 The chart scrubs; it is no longer a tap target** (B's should: two of five exploratory taps
  meant for the globe behind the card jumped the year). A horizontal drag of 6 px or more scrubs the
  year, the rule's year printed at its head under the lines while held; a plain tap does nothing; a
  vertical drag scrolls the card (`touch-action: pan-y`).
- **R-9 The 2D canvases draw at the device's own DPR, up to 3** (B's should). The WebGL canvas keeps
  §5.2's cap of 2 (fragment cost); the track, the legend, the card's chart and months row and the
  overlay (labels, coastlines, the mark) use `min(devicePixelRatio, 3)`, so canvas text and the
  stripes' snapped edges land on device pixels on a 3× iPhone. The overlay's redraw on every drag
  frame grows 2.25× in pixels at DPR 3: it is on the phone checks, and goes back to 2 if it misses a
  frame there.
- **R-10 One hint, once** (B's should, an owner call taken): when the first launch's opening ends,
  or on a first launch without it, one chip says `Tap any place for its own line since 1880.` (the
  first year from the snapshot). It goes at the next touch or after 6 s, is stored as `ww.hinted`, and
  never shows in focus mode.
- **R-11 The stripes say when they clip** (A's should). A year or month whose global mean lies beyond
  ±1.5 °C takes the end color, as §7.2 says; the caption then ends `, N beyond it`, and About says so.
  No step does today.
- **R-12 The pole reading is named as the app's**: `Map mean north of 64° N: +2.97 °C` (A's should),
  and About's rounding section adds "The Arctic and Antarctic readings are this app's own:
  area-weighted means of the map's cells, not GISS's zonal means." It is said to VoiceOver when the
  turn lands.
- **R-13 A copy that mixes releases says so** (A's should). The research build's map is GISS's release
  with data to July 2026 and its global means GISS's table through August 2026. When
  `release.tableNewestMonth` is newer than `newestMonth`, About's "This copy" adds a `Global means`
  line and the revisions section a paragraph naming both, and that GISS's data already run to the
  table's month.
- **R-14 The stamp names the data, not the release** (A's should; supersedes Q-6's wording):
  `Data to July 2026, archived copy`, `Data to July 2026, updated Sep 30` for a live copy; the
  notices `New data: to August 2026` and `… Still showing data to July 2026.` "The July 2026 release"
  read as published in July; GISS made it on 10 August.
- **R-15 About's prose** (`build_static.py`, then `build_all.sh --offline`; only `assets/about.json`
  changed): ERSST is said to be a reconstruction, so an early colored ocean cell is an estimate (A's
  should); the Antarctic sentence keeps its cell shares (pinned by `verify_static.py`) and adds that
  the map's Antarctic reading weighs cells by area and so gives other shares (A's should; 29/96 % of
  cells against 38/93 % of the area); the stripes' clipping (R-11); the pole means (R-12).
- **R-16 The nits taken**: the legend's `vs.`; `846 cells above +4` where it fits; the thumb's head
  moved under the caption's baseline and its caption-clearing halo dropped, so it never bites
  `±1.5 °C`; the partial year's stripe open in the card as on the track; switching Annual ↔ Last 24
  months with a card open turns its cell back into view; the legend's hint span `hidden` (one stop
  fewer for VoiceOver); a broken replacement says `it is damaged` or `it is not a Warming World data
  file` instead of a schema phrase (the boot error keeps the precise one); US spellings in the three
  shipped `.md` files.

Declined, with the reason in `NOTES.md`'s review-pass block: the ask rows' NASA AI-guidance clause and
`north64AnomalyC` from tenths (both `build_snapshot.py`, the lead's); "Estimates cover" in the year
row and "Data:" for About's first line (owner calls); the citation's "(read through the Internet
Archive)" (the next line says so); a cheaper resume check (correct as it is; on the phone checks).

## §22 Lead's pass

After the review pass a final reviewer found no must left; the lead's pass (2026-10-01) took its should
and nits and the pipeline items the builders could not reach. These win over the sections above where
they differ. `NOTES.md` has what each check printed; CONTRACT's "Lead's pass" has the data side.

- **L-1 The side insets in landscape** (the final reviewer's should). About's head and body and the tap
  card used `--gutter` only, so on a notched or Dynamic Island iPhone in full-screen landscape their
  text, ✕ and edge lay under the sensor housing. About's head now pads `var(--gl)` on the left and
  `max(6px, env(safe-area-inset-right))` on the right (the ✕ keeps its 6 px in portrait), its body
  `var(--gl)` and `var(--gr)`. The docked card's outer margin is `var(--gr)`. The card inside the panel
  sits at `max(8px, env(safe-area-inset-left/right))`: in focus mode at 844 × 390 it is in the panel,
  and it spanned 8–836 px over either housing. The frame-time readout moved the same way. The wide grid's
  last row is `minmax(env(safe-area-inset-bottom), 1fr)`: its two spacer rows used to share the free
  21 px, so a docked card at full height ended 10.5 px inside the home indicator's inset (its foot at
  379.5 of 390); now at 369. Measured with Chromium's CDP `Emulation.setSafeAreaInsetsOverride`, which
  sets `env(safe-area-inset-*)` once a page declares `viewport-fit=cover`, at 844 × 390 with insets
  59/0 and 0/59 (bottom 21); `shoot.mjs`'s landscape scene now checks both.
- **L-2 The pole readings round exact ties away from zero** (found by this pass). When every cell with
  a value in a cap lies in one row, the mean is exactly 10·S/C hundredths. In 1888, 1894 and 1896 the
  Antarctic cap has values only in its northernmost row (40 cells), with means of exactly 0.175, 0.005
  and 0.535 °C. Floating point lands a hair below each (17.499999999999993 hundredths), so the chip read
  +0.17, 0.00 and +0.53, where §3.6's half away from zero gives +0.18, +0.01 and +0.54. `capMean` now
  counts a value within 1e−9 of a tie as a tie, and so does the pipeline. Every other mean of the 342
  lies at least 3.46e−4 of a hundredth from a tie, so a cos that differs in its last bit between two
  platforms cannot move one (measured here: macOS's libm and V8 differ in the last bit for 6 of the
  90 row weights, none of them in a cap).
- **L-3 Snuggery's Ask reads the numbers the chip prints.** `north64AnomalyC` came from unrounded
  monthly means, and 40 of 171 steps differed from the chip at the second decimal. The ask rows now
  carry `north64AnomalyC` and a new `south64AnomalyC`, both computed by `build_snapshot.cap_mean` from
  the frame's tenths as `capMean` computes them (its weights, its order, its rounding): 342 of 342
  equal, by `verify_snapshot.py` from the shipped frames and by `test_decode.mjs` through the app's
  own code. The `figures` note says they are this app's area-weighted means of the map's cells with
  data, not GISS's zonal means.
- **L-4 NASA's guidance for AI products.** The ask rows feed an on-device model. NASA asks that an AI
  product's outputs be attributed to the product, that no review or permission be implied, that NASA
  not be held responsible for their accuracy, and it forbids "according to NASA". The source note now
  ends "Answers drawn from these rows are this app's reading of GISS's published data; NASA has not
  reviewed them and is not responsible for their accuracy." V13 and `verify_snapshot.py` fail on any
  string that attributes a statement to NASA ("according to NASA", "NASA says", …). Naming the data's
  source as a fact stays.
- **L-5 A research copy's newer table is said to Ask too.** When `release.tableNewestMonth` is newer
  than the grid's newest month, the source note adds "The global means come from GISS's table through
  August 2026, a newer release than the map's; only the map's months are used." (the month computed),
  as About's lines do since R-13.
- **L-6 SI spacing at the source** (R-5's remainder). The attribution, the source detail, the grid
  source's name, the ask notes, the GISTEMP credits fragment and the Archivo upstream line carry U+202F
  before °C, km and B. So `CREDITS.txt`, the snapshot and `about.json` hold the bytes the screen shows,
  and no number in `CREDITS.txt` is broken from its unit at a line end. `units.si` stays for a live
  snapshot written before this pass. `verify_static.py` pins the attribution verbatim, with its U+202F,
  and fails on a plain space or a line break before a unit in `CREDITS.txt`. V13 and
  `verify_snapshot.py` fail on a plain space before °C, km or % in the snapshot (GISS's `history` is
  verbatim and exempt), and `check.mjs`'s SI check now covers `CREDITS.txt` and the snapshot.
- **L-7 Licenses capitalized**: GISTEMP's "Public domain in the United States …" (About and
  `CREDITS.txt`) and Natural Earth's in `CREDITS.txt`, as About's Natural Earth line and Archivo's were.
- **L-8 About's Antarctic sentence is by area** (reviewer A's should): "South of 64° S, the share of
  the area with data jumps from 38 % in 1955 to 93 % in 1957, when the stations of the International
  Geophysical Year opened. The map's Antarctic reading gives the same shares." `verify_static.py`
  re-derives 0.3820 and 0.9266 with the reading's weights and rounding. The cell shares (29 % and
  96 %) stay in RESEARCH.md as the research record.
- **L-9 About's picture has no keyboard ring.** `shoot.mjs` opened About through the hook, so Chromium
  drew the 2 px focus-visible ring on ✕ in `screenshots/about-light.png`. It now opens About with a
  real tap on its key, and asserts that ✕ has the focus without the ring.
- **L-10 The decoder reference carries the demo's stamp.** `write_json` kept the reference's old
  `generatedAt` whenever its cells were unchanged (01:10:47 against the snapshot's 01:17:43). `write_ref`
  now passes `keep_stamp=False`, so CONTRACT §9's "the demo's" holds.
