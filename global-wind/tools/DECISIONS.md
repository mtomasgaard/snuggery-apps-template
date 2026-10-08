# Global Wind — decisions and build record

This file lives in `tools/`, which `build-zips.yml` leaves out of the ZIP, so a phone never carries the
build's history. Global Wind's look and flow were decided with Global Weather's, and their earlier
record is `../global-weather/tools/DECISIONS.md`. This file starts with plan 0012.

---

# Plan 0012, package 3.6 (2026-10-07): the deeper zoom, the front cut, 1.2

The owner, 2026-10-06: *"Global weather/wind needs further zoom."* Both apps took the pass in one
workflow, with Global Weather's record holding the measurement in full
(`../global-weather/tools/DECISIONS.md`, *Plan 0012, package 3.6*). In short:

- **The limit: 120 px a degree of longitude** (`MAX_SCALE = 360 * 120`; it was 80), where the shipped
  1:10m coast still draws under half its length in straight runs longer than 8 px around the fjords,
  Lofoten and Finnmark (43–50 %, against 64–69 % at 160). The globe stops at `MAX_SCALE / 2π`
  (r 6 875.5 px); it was 12 × the plate's short side. `assets/world.json` is the same file as Global
  Weather's and is unchanged.
- **The globe's land at depth:** the same `fineLand()` as Global Weather's, byte for byte, so the land
  fill follows the coast instead of the mask's 0.18° squares. `shoot.mjs` here: 746 of 746 cells
  further than 2 px from a coast agree with world.json's rings at the deepest radius.
- **The ladder:** `js/flow-math.js` (shared, byte-identical with Global Weather's, `check.mjs` compares
  it) gains 20 min and 10 min; over Lofoten at the deepest zoom the rung is 20 min.
- **Frame times and memory** (`../global-weather/tools/.work/p0012/perf.log`, headless, a trend only):
  interval medians at the deepest zoom 16.7 ms idle, panning (real touch), playing and dragging the
  globe in Chromium, 20 ms in WebKit (touch-type pointer events); the globe's redraw at rest 5.7 ms
  (Chromium) and 9 ms (WebKit); JS heap 19.7 MB after both views at their deepest.
- **The readout and About:** bilinear on the 2° grid, unchanged; About's grid paragraph gains the
  same sentence as Global Weather's on blending looking smoother than the forecast when zoomed in close.
- **Grid labels:** none drawn; the finest graticule stays 2°, the forecast's own grid. **City labels:**
  unchanged tiers and placement.

## The change list, as built (`docs/plans/0012-change-lists.md`, Global Wind)

1. **F1.** `#credits` gone (the band is *Scale and exposure*), `CREDITS` unchanged and written into
   `#about-credit-line`, the first paragraph under *Sources and credits*; `.credits` and its landscape
   grid gone.
2. **F3.** The stamp drops the run (`Updated 1 Oct, 04:02`), one line in every state; the run is
   About's *Model run*. `zHour`, `dayMonthUTC` (shared `js/units.js`) and `pad2` went unused and were
   removed.
3. The exposure line and `Speed colors` stay.
4. **F5.** `ART.md`, `NOTES.md`, `assets/LICENSES.md` and `PROMPT.md`'s *Do not touch* line say About.
   `DESIGN.md` defers to Global Weather's and needed no change.
5. **F6.** 1.2; `check.mjs` item 6 pins digits and dots above 1.1.

The plate: 559 → 590 px upright and 665 → 680 in focus mode at 390 × 844, 234 px on its side (Chromium
and WebKit). F8's stamp check: one line, 16.0 px, in all four states.

**Fixed with Global Weather:** the readout card's exclusion box is read as laid out, not mid-slide
(`card-in`'s 4 px). This app passed that check at the start commit but carries the same code.

## Budgets

App code 184 809 → 187 037 B (cap 200 000); the ZIP as `NOTES.md`'s table gives it (cap 1 600 000).

## The bundled starter pack

Global Wind is one of the seven apps Snuggery installs itself (*Install the live examples*). What
changes for it in 1.2's pack: version 1.1 → 1.2, so L5's update path offers it to anyone who has 1.1;
the credit line moves from under the map into About; the stamp loses the model run; the map zooms to
120 px a degree and the globe correspondingly; the globe's land follows the coast at depth; the flow
has two shorter rungs. Nothing it stores changes (`gw.*` keys unchanged), so an update keeps a reader's
view, units, colors and marker. The pack is rebuilt by the lead in 5b.

## Camera strings

`Updated` kept (the stamp writes `Updated …`). `Zoom in`, `Zoom out`, `Show the controls`, `Map` and
`Globe` unchanged; the camera's zoom round trip from the opening fit stays far below the new limit.

## Owner calls left open

As Global Weather's: the 120 limit, the two new rungs, About's sentence, `PROMPT.md`'s line.

## The fixer pass after QA and review (2026-10-07)

As Global Weather's (its `tools/DECISIONS.md`, *The fixer pass*): `NOTES.md`'s coast paragraph now says
the 120 limit was measured on Norway's coast, the hardest measured, gives the other coasts' figures and
notes the Arctic's own straight segments. App code 187 037 B, within 200 000; HOUSE.md §8's row still
says 184 653, for the lead to update. `scripts/world_json.py`'s docstring (MAX_SCALE 360 * 80) is the
lead's to change.
