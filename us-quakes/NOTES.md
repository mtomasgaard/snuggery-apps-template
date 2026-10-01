# US Quakes — notes

Running it, the code map, what ships and how big it is, and the honesty caveats. The design is
`DESIGN.md` (§20, §21, §23, §24 and §25 list what the build, QA, fix and lead's passes decided; §22 is focus mode), the look is `ART.md`, every byte
layout is `tools/CONTRACT.md`, the pipeline is `tools/HANDOFF.md`.

## What a person can do (2026-09-30)

- **The first launch** writes the last 30 days onto the map in three seconds, over the whole arc from
  Attu to San Juan, with the record strip's pen in step, then eases to the Lower 48. It happens once;
  any touch or key ends it; it never runs under Reduce Motion or without live data.
- **Live**: the last day, week or month before the USGS feed's own minute, every size or M 2.5+, with
  the feed stamp ("USGS feed 16:51 UTC · 40 min ago"; from 3 h "not refreshed since"; from 48 h a
  notice over the map, and the windows named against the feed: "the 30 days to 2026-08-01 16:51 UTC"),
  the record strip (a tap or drag on a stem selects its event and stands the pen on it; nothing else
  moves until the finger leaves, then the sheet lifts and, if the event is off the map, the view flies to
  it once), the largest
  event, the ten largest, per-box counts, the hollow note, the volcanoes above Normal, the sources.
  When a Shortcut delivers a newer snapshot (or one arrived since the last launch) the new stems are
  written, the new dots fade in, and the largest row reads "12 new since 16:51 UTC".
- **History**: 1900 to now with the stub before 1900; Month, Year, Decade or All; floors 2.5+ to 6+;
  Play leaves a faint trace; the label names exactly the window drawn and its count. **Seven stories**
  (Cascadia 1700 to Ridgecrest 2019) set the window, floor and view, select their anchor, annotate it
  on the map and print the pipeline's text and sources; three play their sequence a day (or a week) at
  a time, the label naming the exact span.
- **The map**: pan, pinch, double-tap, keys; nine region chips (a rotation re-fits a marked one); the
  scale bar at the visible center's latitude; "Not a warning service" on the map's credit line at every
  sheet height where the map shows. The map runs past the data's edge, to 168° E–55° W and 25° S–81° N,
  so every chip's framing on a phone is map to its edges, and the view is held inside it; only past it
  (the opening's whole arc, the widest zoom) is the paper hatched, as the strip marks "no record".
- **A tap** selects the nearest event (or a volcano's triangle when it is as close, or else a fault
  within 12 px); a long press lists everything under the finger (the sheet lifts when the finger
  leaves, and the release clicks nothing). The event card, the fault card and the
  volcano card print catalog and database values and USGS's quoted meanings, never a gloss.
- **A–A′**: the Section tool draws a great-circle line with one finger (drag an end to move it); the
  corridor (±25, 50 or 100 km) is washed, ticked every 50 km and everything outside it dims; the sheet
  shows distance against depth at true scale (or stretched 2× or 5×, said on the plot), the depth ramp
  as the axis, the 10 km line keyed under the plot with USGS's words. Presets: Cook Inlet (with the
  2018 M 7.1 called out), Aleutians, Cascadia, Hawaii. A tap on a plotted dot selects it. From the
  keyboard: with Section on and the map focused, Enter places A at the center, the arrow keys move the
  map, Enter places A′; Escape takes back an A still waiting for its A′.
- **Layers**: shaded relief, sea depth, faults, volcanoes, state lines, labels, units. **The legend**
  ("Reading the map") draws every mark. **About**: how to read the map, the honesty notes with USGS's
  quotes, the Oklahoma statement, what is not shown, the data's dates, every source with its license,
  attribution and address as text, the fonts' notice, SI | US, and the version line (five taps show a
  frame-time readout).
- **Focus mode**: the fourth key in the map's column ("Hide the controls", four corner marks) leaves
  the map and the record strip alone: the top bar, chips, keys, legend, grip and the sheet's body go
  (hidden and inert), the map runs from the top of the screen to a band with the strip in its current
  form (Live: the stamp and the stems; History: the label, Play, the strip, window and floor), and the
  scale bar, the notices and "Not a warning service" stay. A tap opens its card over the map. Out by
  the ghost key in the top-right corner ("Show the controls") or Escape. Focus moves to the ghost key
  and back only when the key was used from the keyboard; after a tap it stays put, with no ring. Kept
  across launches (`uq.focus`); the opening never starts in it. DESIGN §22.
- Two columns at ≥ 700 px (a phone on its side). Reduce Motion: jumps instead of eases, no opening,
  arrivals at once; Play and story sequences still step.

## Run it locally

```
cd Template/us-quakes && python3 -m http.server 8000     # then open http://localhost:8000/
node tools/test_decode.mjs                                # js/data.js against the pipeline's reference rows
node tools/test_geo.mjs                                   # Mercator, the section maths, the scale bar
node tools/check.mjs                                      # files, references, budgets, the ZIP
PLAYWRIGHT_MODULE=…/playwright/index.mjs node tools/shoot.mjs   # headless Chromium, both themes (~4 min)
```

Never from `file://`: modules and `fetch()` need a server. `shoot.mjs` serves the folder itself,
writes its scenes to `tools/.work/shots/` (or the folder given) and writes `screenshots/cook-inlet-light.png` (Alaska
with the Cook Inlet section at Half, light; `screenshots/app.png` is the README's two-pane composite and is never
written by the script), `screenshots/live-{light,dark}.png`,
`screenshots/focus-live-{light,dark}.png` (California, Live, focus mode) and
`screenshots/focus-history-{light,dark}.png` (Alaska, 1964, focus mode).

## Code map

| File | Bytes | What |
| --- | --: | --- |
| `index.html` | 5,065 | the page |
| `style.css` | 15,499 | ART.md's tokens (both themes), the fonts, the layout, the controls and hit areas, focus mode, tabular figures |
| `js/app.js` | 48,271 | boot, state, the scheduler, persistence, selection, section (and its keyboard path), stories, panels, the fit and the re-fit on rotation, focus mode (focus moved only for keys), the opening, arrivals, the legend's units, `window.__uq` |
| `js/sheet.js` | 16,570 | the heads, bodies, lists, the event, fault and volcano cards |
| `js/data.js` | 12,067 | the decoders, validation, the capped native inflate, the join, geo.json |
| `js/gl.js` | 9,614 | the two WebGL2 contexts: relief textures (decoded from their bytes, re-decoded after a loss), the event buffer, draws, context loss |
| `js/map.js` | 9,176 | the axis, Mercator, the view and its clamp to the basemap, gestures (event-time taps and presses), eased moves, region fit, scale bar |
| `js/strip.js` | 8,986 | the record strip, Live and History forms, the pen on the opening and on the selected stem (its nib clear of the label), the Live hit test |
| `js/section.js` | 7,615 | great-circle maths, the corridor, the corridor query, the true-scale plot |
| `js/shaders.js` | 5,886 | GLSL |
| `js/base.js` | 5,231 | sea, depth bands, land, lakes, the hatching where the basemap ends; coast, borders, states, faults; a selected fault |
| `js/overlay.js` | 4,960 | volcanoes (receding at wide zoom), labels (clear of the foot), the selection ring, glass tabs |
| `js/layers.js` | 4,892 | the Layers panel, the legend card, the drawn keys |
| `js/events.js` | 4,547 | floor time indexes, per-year counts, boxes, the grid, largest, the draw order |
| `js/util.js` | 4,378 | helpers, `nums()` (numbers in mono; prose mode), the localStorage wrapper |
| `js/ramp.js` | 3,996 | the depth ramp (OKLab), rims, sizes, the hollow floor, the 2D dot (each hole its own full circle) |
| `js/about.js` | 3,991 | About |
| `js/units.js` | 2,564 | SI / US, U+202F grouping, the legend's stops, the fixed depth "10 km (6 mi)", dates |
| `js/stories.js` | 2,505 | the stories: list, card, windows, sequences |
| `js/timeline.js` | 2,256 | Live and History windows, labels, Play steps |
| **App code** | **178,069** | budget 200,000 (`check.mjs`); 21,931 bytes of headroom |

The budget was raised from 150,000 to 200,000 bytes for the QA pass (by the lead; `check.mjs` says so).
With it the code is back in two-space indentation, each module has a two-to-four-line header saying
what it owns, and focus mode fits; the reasoning lives in DESIGN §20–§25. The second fix pass
(§24) added 11,754 bytes, the lead's pass (§25) 4,581.

## What ships (measured by `tools/check.mjs`, 2026-10-01, after the 1:10m basemap)

| File | Raw bytes | As the ZIP stores it |
| --- | --: | --: |
| `assets/` (history.bin, geo.json, four relief JPEGs, about, stories, history.json) | 9,452,727 | **6,200,432** (cap 6,340,000; `verify_static.py`, counting deflate streams without entry headers, prints 6,191,803 and 148,197 of headroom) |
| `data/snapshot.json` (the demo, the feed of 2026-09-30T23:17:42Z) | 535,106 | 363,628 |
| `fonts/` (five WOFF2 + OFL.txt) | 68,742 | 65,718 |
| app code | 178,069 | 65,927 |
| **The ZIP** (41 files, with CREDITS, NOTES, DESIGN, ART, miniapp.json) | | **6,788,418** (cap 8,000,000) |

The basemap past the axis took 149,533 B of the assets' headroom (`geo.json` 837,552 → 987,085 as the
ZIP stores it): the January 2027 rebuild fits, and 2028's will need the first of HANDOFF's levers.

**The basemap is Natural Earth 1:10m** (plan 0011 A, 2026-10-01): at the deepest zoom a CSS pixel is
0.11 km at 60° N, and 1:50m cut straight across the arms of Prince William Sound and the Inside Passage
that the relief shows. Land, coast, lakes, borders and state lines come from 1:10m, cut to what 1:50m
drew (`build_geo.py`: 1:50m's lakes by Natural Earth's `ne_id` plus four pieces of 1:50m water 1:10m
files under another id; the nine 1:50m countries' state lines less the indicators across water; the
borders less the Guantánamo lease limit), at the same 250 000 m² thresholds. `geo.json` 1,851,803 →
2,358,179 B raw (budget 1,900,000 → 2,360,000, +24.2 %), 987,085 → 1,326,898 B stored; the assets' cap
rose by what the basemap and its credit added (340,010 B), 6,000,000 → 6,340,000 (+5.7 %), so the
yearly headroom above is unchanged. The ZIP cap did not move. The 1:50m file drew Lake Mead, Fort Peck
Lake, Teslin Lake and Lower Arrow Lake twice, and the even-odd fill cancelled them: they were land on
the map until this build; `build_geo.py` now stops if a ring is written twice. The relief JPEGs still
mask lakes with 1:50m (`build_relief.py`, unchanged, byte-identical).
At run time the history and the snapshot join at the cutoff: 385,071 + 18,350 = 403,421 rows.

## Measurements (headless Chromium 153 on SwiftShader: a trend, never phone evidence)

From `tools/shoot.mjs` on 2026-09-30: ready about 150–950 ms after navigation (geo.json decoded, then
history, indexed; relief textures about 1–2 s). Over a scripted pan and pinch of History All at M 2.5+:
JS time for the points draw 0.1 ms median (the GPU work is not in it), the base redraw 4.4 ms median /
5.9 p95, the lines 1.7 / 2.4, the overlay 0.2 / 0.6; after the lead's pass, with the basemap past the
axis in view, the base 7.4 / 10.1, the lines 2.2 / 2.8, the overlay 0.2 / 0.9; with the 1:10m basemap
(2026-10-01, the same scenes, the old file measured in the same session for comparison: base 7.4 / 10.1,
lines 2.1 / 2.8) the base 9.7 / 12.3 and the lines 2.4 / 3.2, geo.json's load mark 47 → 58 ms and the
Alaska chip's base and lines 24.6 → 26.1 ms (median of five). In the full harness a
real long press listed after 1,004 ms held (alone, the same steps before it, 533 ms: the 500 ms timer
and a frame), so the check now waits for the list rather than reading at 750 ms. The section query and plot: Cook Inlet 14–15 ms,
Aleutians 8, Cascadia 1, Hawaii 53–55 (35 342 dots). The relief over the western US's land (scene 1):
light at uDark 0.50, luminance p5 0.567 · p50 0.820 · p95 0.849 against bare land 0.842 (the shaded 5th
percentile 1.45:1); dark at 0.55, 0.010 · 0.014 · 0.017 against 0.014. Focus mode (scene 17): the free
map 358 → 730 px tall from Half, the band 110 px in Live and 148 px in History. The phone's numbers are
owed (DESIGN §13). The second fix pass (DESIGN §24) left the relief figures unchanged; loading the
relief from its bytes (ImageBitmap, uploaded and closed) moved the uploads out of `loadRelief` and into
the first frames, where SwiftShader shows one 1.2 s frame while four textures and their mipmaps upload
(the old code blocked for the same work outside a frame). A fresh Alaska view takes about 300 ms of
SwiftShader raster (two rAF round trips, old and new code alike).

## Owed to the phone (DESIGN §16, the matrix row)

- `DecompressionStream('deflate')` reads the snapshot (the pure-JS fallback is gone; DESIGN §21).
- Frame time with both WebGL contexts, memory, first paint; a 30 s pan; the Hawaii section's cost and
  whether the plot follows the finger for Cook Inlet (it takes 14 ms here, just over the 12 ms rule).
- Background and return (context loss), a Shortcut refresh while open (the arrival), rotation.
- The hit areas and the grip under a real thumb; unprefixed `mask-image` on the chip row.
- **Focus mode** on the phone: in by the key and out by the ghost key under a thumb; the ghost key
  readable over real relief, sea and dense dots in both themes; the 160 ms fade and the 240 ms re-fit
  without a dropped frame (the five canvases are resized once); the band above the home indicator
  (`env(safe-area-inset-bottom)`) and the ghost key below the status bar (`env(safe-area-inset-top)`);
  VoiceOver finding nothing of the hidden chrome and landing on "Show the controls"; relaunch in focus.
- **The second fix pass (DESIGN §24)**: a drag along the Live strip at Peek under a thumb (the strip stays
  put, the pen follows, one fly on release); a long press near the foot (nothing slides under the held
  finger, the release opens nothing, no callout or text selection); rotation from a marked chip;
  VoiceOver reaching the chips, keys and credit line (`<main>` no longer `role="img"`) and reading the
  Live strip's name; memory after the relief upload and after five background-and-return cycles (the
  JPEG bytes re-decoded to ImageBitmaps; `createImageBitmap(blob, { colorSpaceConversion: 'none' })`
  on WebKit, with an `Image` fallback); the hatching where the map ends (the opening's whole arc) and
  the hollow floor read at DPR 3; the CONUS relief's faded edges.
- **A fast drag of the History thumb** (in the sheet and in the focus band) staying readable: the
  three-line label, the bracket and the map keeping up without the label flickering between two and
  three lines at the 1899/1900 boundary.
- **The lead's pass (DESIGN §25)**: the map past the data's edge on the phone's own screen, in both
  themes, at Peek, Half and in focus mode (no straight cut anywhere a chip lands; the coarser land,
  coast and sea bands south of 5° N and north of 75° N, and the seam-free joins at 14° N and 5° N,
  looked at, not measured); the settle redraw of `#base` with the extra geometry (7.4 ms median on
  SwiftShader against 4.4 before, a trend only); **focus mode by VoiceOver**: where the cursor lands
  after "Hide the controls" is double-tapped, now that focus moves only for a keyboard-like activation
  (one with no pointerdown before it) — if iOS reports the double tap as a pointer, focus is not moved
  and the phone check decides whether it must be; the pen's nib under the count label at DPR 3; a
  number never parted from its unit at the accessibility text sizes; the depth legend in US units; on
  its side, the framings the clamp moves (Alaska's box left of center, the Lower 48 right of center in
  focus mode with the basemap's east edge hatched), for the owner's eye.

## Honesty caveats

- The map draws every row as USGS listed it on 2026-09-30 (history) or at the feed's time (snapshot).
  Positions to 0.002° / 0.001°, times to the minute, depth to 10 m, magnitude to the tenth half-up.
- Rows without a magnitude (180, all before 1900) are drawn as × in windows reaching before 1900 and
  counted apart; the section plot leaves them out.
- "Near X" lines for rows without a stored place are computed from Natural Earth's place list and say so.
- Every explanation of a USGS field, fault class or volcano level is about.json's quote, printed with
  "USGS:"; where about.json has none, the bare value is shown. Story text is stories.json's, verbatim.
- "Not a warning service" leads the map's credit line at every sheet height where the map shows (the
  Layers panel ends above it) and in focus mode, and opens the Live body and About.
- The relief, rims, fade, trace, corridor dimming and the record strip's ink are display choices
  (About says so, from about.json). Outside a corridor dots are drawn at a quarter of their alpha; over
  dense clusters the stacked dots still read at about half strength.
- US spelling throughout the app's own words, the pipeline's included (fixed at the source in
  `scripts/us_quakes/content/` and `build_about.py`, DESIGN §23); USGS quotations, page and dataset
  titles and license quotes keep their own spelling, and the JSON keys (`licence`) are the contract's.
  The shipped Markdown (NOTES, ART, DESIGN) is respelled too, outside code spans and quoted words (§24).
- The light theme's relief shade is 0.50 (was 0.40), measured over the western US's land: its shaded
  5th percentile is 1.45:1 against bare land (DESIGN §23). Volcano triangles are drawn at 0.65 of their
  size at the Lower 48's and Alaska's scale; their fill is only USGS's color code at every size.
- A hollow (automatic, live) ring is never drawn smaller than an M 4 dot, so its hole shows; About and
  the legend say so. Dots of M 2.2 and below share the 2 px floor, and About says that too.
- A depth coded 10.00 km is the catalog's exact 10 and nothing else (the lead's pass, CONTRACT §1): the
  203 measured depths that only round to it are stored as 9.99 or 10.01 km, off by under 10 m instead of
  5 m, so the card can say "At 10 km, as the catalog lists it" with USGS's fixed-depth quote and the
  section caption "N listed at 10 km". About's count (23 759 "at exactly 10 km") is the same rows.
- Negative depths: About's note counts 11 448 rows whose stored depth (to 10 m) is below 0 km; the
  catalog lists 11 472 negative depths, 24 of them within 5 m of zero and stored as 0.00 km. The note
  quotes USGS's FAQ on why a depth can be negative; the sentence on how the app draws them is its own.
- Faults are drawn at 0.55–1 of their class's alpha below zoom 5, volcano names only from zoom 4.5
  (or above Normal), and the CONUS relief's edges fade over 0.5°: display choices, like the hatching
  where the map ends. The relief still shades 3DEP's land in Canada and Mexico, as About says; masking
  it to US land was declined by the lead (DESIGN §25), since the basemap now runs on across both borders.
- The basemap past the data's edge (to 168° E–55° W and 25° S–81° N) is context, not data: no
  earthquake is drawn there (the four map boxes end at 17° N and 72° N), no place is named there, and it
  is simplified ten times (eighty south of 5° N) more coarsely than inside the chips' reach; Natural
  Earth's adaptation line in About and CREDITS says so.

## Fonts

Both notices in `fonts/OFL.txt` are the WOFF2 files' own name ID 0. Red Hat Mono's is "Copyright 2024
The Red Hat Project Authors", which is Google Fonts' `ofl/redhatmono/OFL.txt` (no Reserved Font Name)
and Fontsource's; the upstream RedHatFont repository's LICENSE reads "Copyright 2021 Red Hat, Inc., with
Reserved Font Name Red Hat" while its own OFL.txt declares none. The shipped file is the RFN-free Google
Fonts release, unmodified, so shipping it under the plain OFL is sound (and OFL clause 3 restricts only
renamed Modified Versions). Checked by the honesty review, 2026-09-30.

## Asked of the lead (outside this builder's files) — done in the lead's pass (DESIGN §25)

- **Done**: `build_history.py` and `refresh.py` write a depth that only rounds to 10.00 km as 1499 or
  1501 (`common.depth_code`), so code 1500 always means the catalog's 10 (CONTRACT §1); `test_decode.mjs`
  asserts count(d === 1500) = `counts.depth10km` = 23 759 (the file before held 23 962), and
  `verify_static.py` and `verify_snapshot.py` compare every depth code exactly.
- **Done**: the FAQ's two sentences on negative depths are in `credits/usgs-statements.txt` and
  `content/quotes.json` (its address ends `…-how-can-earthquake-have-a-negative-depth`), quoted by About's
  note, which now says "a negative depth"; the `Mww … — Mww …` header-as-quote line is gone.
- **Done, wider than asked**: `build_geo.py` carries land, lakes, coast, borders, states and the eight
  bands to 168° E–55° W and 25° S–81° N (the phone's framings reach 23.6° S, 79.5° N, 169.0 and 304.2
  on the axis), and the app holds the view inside it.
- **Declined by the lead**: masking the CONUS relief to US land, because the basemap now runs on into
  Canada and Mexico and a relief ending at the border would read as a cut.
