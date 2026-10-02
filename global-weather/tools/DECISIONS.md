# Global Weather — owner calls, build record and reviews

This file holds what used to sit at the end of `ART.md` and `DESIGN.md`: the owner calls, the
art pass's change list, the as-built notes and the QA notes. It also holds the record of the two
reviews that followed. It lives in `tools/`, which `build-zips.yml` leaves out of the ZIP, so a
phone never carries the build's history, and Snuggery's Ask never reads it as if it described the
app. `ART.md` and `DESIGN.md` still say *owner call N*: the numbers are the lists below, one list
for each file.

---

# From ART.md

## ART: Owner calls left open

1. **Ramps printed twice** (lightness inverted between themes, so a value has a different color in
   each). The alternative is one fixed ramp with a halo on every streak. That doubles the strokes,
   and it was not measured.
2. **The rainbow wind scale and the radar rain scale are replaced** by the hue paths above. That
   gives up radar's familiar green-yellow-red.
3. **Dark-theme temperatures between 10 and 24 °C print as khaki and ochre**, the price of the
   tonal budget.
4. **The credit line's middle dots** stay, because the credit text is fixed. Semicolons would match
   the rest of the app, but only with the owner's yes (DESIGN owner call 9).
5. **The legend's bar hidden in focus mode** (Warming World's precedent; DESIGN owner call 3). The
   exposure and credits stay either way.
6. **The caption band under the plate** costs about 45 px of plate height. It replaces today's
   legend and credits drawn over the map.
7. **The `now` notch** on the track (new; recommended).
8. **Dates**: `Wed 23 Sep, 11:00` (24-hour, day before month, the phone's time zone) or the phone's
   locale (DESIGN owner call 4).
9. **`assets/LICENSES.md`**: this pass was asked to put the font's credit there, and also to leave
   `assets/` unchanged. Change list 9 adds one paragraph to that text file. If "unchanged"
   means byte for byte, the credit lives in `fonts/OFL.txt`'s header, About and `NOTES.md` only.
10. **Light-theme streaks are not dimmed at night** (κ 0), unlike the dark theme's 0.30.
11. **The play key is the only filled control.** The alternative is an outlined key like the
    others.

---

## ART: Change list (apply in order)

1. **`fonts/`**: already done in this pass, `ysabeau-office-gw.woff2` (35 372 B) and `OFL.txt`
   (4 703 B). Rebuild with `python global-weather/tools/art/font_subset.py`, which must print
   sha256 `fdf1a28c…cdb262`.
2. **`index.html`**:
   - `<meta name="theme-color">` per scheme (`#e8eef0` / `#141d21`).
   - The header's three rows. `#layerchips` becomes the layer-word row, built as today from the
     snapshot.
   - The key column's three plates: Flow (`btn-flow`), Arrows, Night with the terminator icon, and
     Hide the controls.
   - The ghost key with its inline SVG mark.
   - The caption band (`#legend`, `#exposure`, `#credits`) moved out of `#map-wrap`, under it.
   - The player's time row, transport keys (chevrons and the solid Play) and DESIGN §2's track in
     place of `<input type="range">`.
   - The readout's ➤ replaced by an inline SVG streak glyph.
   - `translate="no"` on the stamp and the units key.
   - No `user-scalable=no`.
3. **`style.css`**: rewritten on the tokens above.
   - `:root` light, redefined under `@media (prefers-color-scheme: dark)`. `body` gets an explicit
     `background: var(--page)`.
   - The `@font-face` rule.
   - The type scale. Tabular figures on `body` and proportional in prose.
   - Every object in "The chrome", including the selection tracer as a pseudo-element, the hover
     rules under `@media (hover: hover)`, and the `:focus-visible` ring.
   - The motion table, and the Reduce Motion block setting every duration to 0.
   - Gone: `--accent`, `--shadow`, `--glass`, `--warn-*`, every `box-shadow`, every
     `backdrop-filter` and the 14 px radius.
4. **`app.js`**:
   - `LOOKS` gets the stops from `palette.py --json` as `stops: (dark) => …` for all five layers,
     the alpha rules above, and `short` set to the snapshot's full label.
   - `buildPalette()` takes the plate table, with `alphaScale` 1.
   - The place-label font becomes `560 11.5px "Ysabeau Office", system-ui, sans-serif`, awaited
     before the first draw and redrawn on `loadingdone`.
   - The arrows take the streak color and halo.
   - The stamp uses the new separators and adds the date when not today. Its words and `Updated`
     stay.
   - The legend title is `${label}, ${level}`.
   - The readout gets its coordinate line and direction glyph.
   - About gets its four sections and the font credit.
   - `CREDITS` does not change.
5. **`js/units.js`** (DESIGN §4): the valid-time and stamp formats above, built by hand (not through `Intl`) with fixed
   options, plus U+2212, U+202F and grouping.
6. **`js/track.js`** (DESIGN §2): the baseline, ticks, day labels, `now` notch and tracer thumb as
   drawn above, with no transitions.
7. **`js/flow.js`** (DESIGN §1):
   - Per-theme streak color, width 1.0, head alpha 0.95 / 0.85, κ 0.30 / 0.
   - `lineCap` and `lineJoin` `round`, `source-over`.
   - On the first frame after unpacking, release without a prewarm.
   - The exposure text written into `#exposure`.
8. **`NOTES.md`**:
   - "What the streaks are" (DESIGN §10).
   - A short "The look" paragraph naming Long Exposure and the tonal budget.
   - The font's credit line.
   - How to rebuild the font and check the palette (`font_subset.py`, `palette.py`).
9. **`assets/LICENSES.md`**: one paragraph with the font's credit line (owner call 9 decides).
10. **`DESIGN.md`**, amended in place:
    - §1.12: κ = 0.30 dark and 0 light, with the reason.
    - §1.13: the flow key is the caption band's exposure line, and its Reduce Motion wording.
    - §3: in focus mode the stamp moves into the caption band.
    - §6: fonts 40 075 B.
    - §8: "the contrast ART.md sets" = 3.0:1 day, 2.5:1 night, on the streak head.
    - §10: `fonts/` and `tools/art/` in the file tree.
11. **`tools/check.mjs`** adds:
    - `fonts/` holds exactly the two files, and the woff2's sha256 is the one above.
    - `LOOKS`' stops equal `palette.py --json` (run with `python3`), and `palette.py` exits 0.
    - `style.css` has no `box-shadow`, `backdrop-filter`, `transition: all`, `text-transform:
      uppercase` or `letter-spacing` other than 0.
    - No `·` in any string the app writes except `CREDITS`, and no `→`, `➤` or `...` in shipped
      text.
    - Both `theme-color` metas exist.
12. **`tools/shoot.mjs`** adds:
    - `document.fonts.check('560 11.5px "Ysabeau Office"')` once per theme, before its pictures.
    - The rendered-text contrast sampler (≥ 4.5:1) over every text style in both themes.
    - The streak sampler (DESIGN §5.2) holding the head to 3.0:1 by day and 2.5:1 at night, over
      the five layers.
    - The selection tracer under the chosen word only.
    - No element with a running animation on the thumb, time row or lead during a scrub.
    - Reduce Motion: zero transition durations and no flow.
    - The layer row fits or scrolls inside itself at 320 px, with no page scroll.
    - Scenes as DESIGN §5.2 names them, never `screenshots/app.png`.
13. **`miniapp.json`**: version per DESIGN owner call 11.
14. **Global Wind**: apply 1–13 to `global-wind/` with the differences in "Global Wind, by copy".
    The font files are copied, not rebuilt (`cmp` in its `check.mjs`). `palette.py` is copied. Its
    `NOTES.md` gets the same font credit, and its `assets/LICENSES.md` follows owner call 9.

## ART: Files of this pass

| Path | Ships | What |
| --- | --- | --- |
| `ART.md` | yes | this file |
| `fonts/ysabeau-office-gw.woff2`, `fonts/OFL.txt` | yes | the face, 40 075 B |
| `tools/art/font_subset.py` | no | builds the font from the pinned upstream file |
| `tools/art/palette.py` | no | every token, ramp and contrast figure in this file; `--json` for `LOOKS` |
| `tools/.work/art/` | no (ignored) | the throwaway study, specimen and candidate checks |

## ART: After QA (2026-10-01)

The art itself is unchanged. One rule moved. In focus mode the stamp heads the caption band, so its
44 px hit now runs down over the caption's words rather than up into the plate (DESIGN §12). The
lowest antialiased streak heads, around 2.4:1 in the dark theme, stay as disclosed. The target is a
90 % threshold over the heads, not a floor on each pixel.

---

# From DESIGN.md

## DESIGN: owner calls (§7.2, for MANUAL_STEPS)

1. **Defaults**: Flow on and Arrows off (recommended), or both on.
2. **Focus mode remembered** between launches (recommended, the house rule) or not.
3. **The colour legend hidden in focus mode** (Warming World's precedent) or kept.
4. **Dates and times**: one fixed 24-hour, day-before-month format (*Tue 22 Sep 09:00*, as the ask
   rows write it) — recommended — or the phone's locale.
5. **Four-digit grouping for pressure**: `1 013 hPa` (the rule's letter) or `1013 hPa` (meteorology's
   habit).
6. **Reduce Motion**: arrows only (the rule, designed) or a still frame of streaks.
7. **Streaks dimmed on the night side** (§1.12, designed) or not.
8. **Rest after inactivity**: the flow runs while the page is visible; whether it should stop after,
   say, five minutes without a touch to save battery.
9. **The credit line's separators**: the three credits' words stay; the middle dots between them are
   on the generated-page tell list, and the art pass may replace them only with the owner's yes.
10. **Global Wind gains an Arrows key** (its arrows are always on today) so the pair has the same four
    states.
11. **Versions**: Global Weather 2.0 → 2.1, Global Wind 1.0 → 1.1 in `miniapp.json`.


## DESIGN §11. As built (2026-10-01)

Where the build differs from the text above, and why:
- The exposure's polar clause follows the latitude the map shows (≥ 45°), not "zoom ≤ 2": the
  opening map is zoom 2.9 and reaches 70°, where the stretch is 2.9×.
- Every step's u and v is built at once after unpacking, not in idle chunks: 41 steps took a few
  milliseconds, so the chunking bought nothing.
- The map keys are 36 px wide and 44 px tall, so each hit is a full 44 × 44 with no overlap; ART's
  36 × 36 key would need hit areas that overlap their neighbors.
- `test_flow.mjs` holds the 10 m/s screen speed to 1 × 10⁻⁵, not 10⁻⁶: one step at 24 h a second is
  15 km, and the kernel's chord error there is 1.7 × 10⁻⁶ (§1.3's own figure).
- `shoot.mjs` holds 90 % of streak heads to 3.0:1 by day and 2.5:1 at night, and prints the lowest
  single head: an antialiased 1-point line's edge pixel and a just-spawned dot sit below the
  full-alpha head `palette.py` checks.
- The two license addresses in About are printed without their scheme (`www.geonames.org`,
  `creativecommons.org/licenses/by/4.0/`), because no shipped `.js` may contain `http`.
- `__weather.flow.hold()` was added for `shoot.mjs`: it freezes the trails so a pan's carried pixels
  can be compared; a map move still carries them.


## DESIGN §12. After QA (2026-10-01)

QA passed the package with two *should* items and two nits. What changed, and what did not:
- **The stamp's hit in focus mode is 44 px tall** (was 24 px). In focus mode the stamp heads the
  caption band, so its hit area now runs *down* over the caption's own words (6 + 16 + 22 px), never
  up into the plate, whose taps are the map's (`style.css`, `.caption > .stamp::before`). `shoot.mjs`
  now checks hit targets in focus mode too (6 controls, the stamp among them). With the old rule the
  same measurement read 24 px.
- **A library left in focus mode and the camera: the app does not change.** Focus mode stays
  remembered (the owner's rule: "the state remembered between launches"). Opening in focus mode, the
  camera still finds *Updated*, and finds exactly one button named *Show the controls*. One tap on
  it brings back *Globe*, *Map*, *Zoom in* and *Zoom out* and stores `gwe.focus` as `'0'`. `shoot.mjs`
  replays that path by role and name after a reload, using real touch. The guard itself belongs to the
  camera (tap *Show the controls* if it exists, before the Globe tab), which lives in `Tests/` and is
  outside this folder. That is the lead's call (§7.3, *The camera*).
- **Not changed (nits):** 90 % of streak heads still clear 3.0:1 by day and 2.5:1 at night, with the
  lowest single head printed (§11). The two license addresses in About still have no scheme (§11).

---

# After review (2026-10-01)

Two reviewers came after QA. A looked at honesty, physics and licenses; B used the app on a phone
as a stranger, and also covered accessibility and performance. Each finding is listed with what
was done or why it was declined. All of it is checked by `node tools/check.mjs`,
`node tools/test_flow.mjs` and `tools/shoot.mjs`, and each check's line is quoted below. The flow
math is unchanged, and so are the snapshot, `validate()`, `CREDITS`, `world.json` and
`places.json`.

## Musts

- **A1. `assets/LICENSES.md` said that no font is bundled.** Its last section was rewritten, prose
  only, to name the face, its license and `fonts/OFL.txt`. `NOTES.md` now points at both files.
  ART owner call 9 is resolved this way: the file's words change, and nothing else in `assets/`
  does. *Lead to confirm*: if `assets/` has to stay unchanged byte for byte, this edit has to be
  reverted, and the false sentence comes back with it. Check: `check.mjs` line *assets/LICENSES.md
  credits the face … and never says no font is bundled*.
- **B1. The plate resized in a loop near 45°.** The polar clause wrapped the exposure line, which
  shrank the plate, which moved the view's edge back under 45°, and around again. `.exposure` now
  has a fixed height: 30 px below 640 px of width and 15 px from 640 px. The `:empty` rule is gone,
  so Flow off, Arrows only and the polar clause are all the same height. Check: *the plate never
  resizes with the caption: a real-touch pan crossed the 45° edge (the polar clause appeared after
  294 px and went again on the way back) with 0 resizes of #map-wrap during it and in 2 s at rest;
  Flow off, on, Arrows on, off: the plate 559 → 559, 559, 559, 559 px (0 resizes)*. A second check:
  *the longest exposure lines fit the line's fixed height* at 320, 360, 375, 844 × 390 and 312
  (125 % zoom).
- **B2. The Play key never showed Pause.** An `<svg>` has no `hidden` property, so the code now
  calls `toggleAttribute('hidden', …)`. Check: *the Play key's mark follows play, by touch: paused ▶
  shown (block, none), playing ‖ shown (none, block) and named "Pause"*.

## Shoulds

- **A2 and B (nit). The streak density claim.** About, `NOTES.md`, DESIGN §1.1 and §1.7, and ART's
  "cool animations" paragraph no longer say that streaks gather only where the air converges.
  They now say streaks also bunch where the projection shrinks the ground (toward the equator on the
  map, toward the edge on the globe), and that otherwise their spacing is random. Reviewer A's
  figure (map term 2·v·tan φ / R) is in DESIGN §1.1.
- **A3. Reduce Motion said "drawn as steps" but played continuously.** Play now runs on a clock in
  hours (`playClock`). Under Reduce Motion, `t` takes whole steps only: 5 h a second, one 3 h step
  every 0.6 s, and a frame is drawn only when the step changes. Check: *play plays whole steps: 2
  drawn frames in 1.5 s, 0 at a fractional step, each a new step (4 → 6)*.
- **A4. The grid was called "an average".** `NOTES.md`, About and DESIGN §7.3 now say that the
  0.25° model is point-sampled every 2° (about 220 km, `global_weather.py` takes `[::8]`). About
  no longer says the forecast "cannot see" mountains. It says they are smaller than the sampled grid
  can show.
- **A5. Safe area in focus mode.** `.ghost` and `.focus .readout:not(.low)` are now inset by
  `env(safe-area-inset-top)`. Headless Chromium has no safe areas, so this is untested here. It is
  on the phone list in DESIGN §7.3.
- **A6. The refresh schedule in `NOTES.md` and `PROMPT.md`.** Both now describe the workflow's
  eight slots and up to four pulls a day, and the growth is given as about 4 GB a year. The workflow
  file was not touched; its header still says "twice a day", which is the lead's call.
- **A7. British spelling in shipped files.** All shipped text files are now in US spelling (color,
  center, meter, behavior, license, harbor, toward, forever …), comments included. The snapshot's
  `licence` key is data and stays. `MAP_VIEW.centre()` became `center()`. New check: *US spelling
  in 17 shipped text files*. It fails on a planted "colour" (tried once, then removed).
- **A8. Build process shipped in DESIGN.md and ART.md.** ART's owner calls, change list, files list
  and After QA, and DESIGN §7.2, §11 and §12, moved to this file. References to the lead, the
  builders, QA and `tools/.work/` were reworded. `*.md` stored in the ZIP went from 56,253 to the
  figure `check.mjs` prints now. B suggested going further (keeping only the look and the streaks
  at the root). Not done: the house precedent ships both files, and what is left is the design and
  its rules.
- **B3. Play ran behind About.** `loop()` now returns at once while About is open: nothing is drawn
  and play's clock does not move. Closing About asks for a frame. Check: *About holds play still
  while it is open (t 6.917 → 6.917 over 0.8 s, still playing) and play goes on once it closes*.
- **B4. The readout card covered the tapped place.** `placeReadout()` moves the card to the
  bottom-left (`.readout.low`) when the marker would sit under it, and back when it would not. Place
  names are not drawn under the card or the keys. Check: *two taps under its top-left corner move it
  to the bottom, a tap near the bottom keeps it at the top (bottom, bottom, top); covered 0 of 3*.
- **B5. Landscape was a strip.** A layout for `(orientation: landscape) and (max-height: 500px)`:
  - the header is one 46 px row;
  - the legend and the credits share a row, with the exposure as one line under them;
  - the player is one row.

  The key column becomes a row when it would not fit the plate's height (`layoutKeys()`). The map's
  first-launch fit follows the plate until the reader zooms (`mapFitted`). The globe keeps its
  radius relative to the plate across resizes. Check: *a phone on its side: the plate 234 px tall
  (≥ 220), the keys one row 38 px high, the globe's disc 225 px inside it* (it was 136 px).
- **B6. The map opened on 0° E.** Both views now open on `CLOCK_LON`, the clock's offset from UTC
  at 15° an hour. Check: *the map opens on the reader's longitude from the clock: −105°*.
  *Camera note for the lead*: the simulator's time zone now picks the marketing camera's opening
  map.
- **B7. VoiceOver.**
  - A tap announces the place, the value with its unit in words, and the descriptive line, once,
    never per frame.
  - Previous and Next step say the new time in words.
  - The track's `aria-valuetext` spells the date and the hours.
  - The stamp has `aria-haspopup="dialog"` and is described as *Opens About this data.*
  - `translate="no"` is now on the model-run token only.

  Not done: an announcement on the track's own arrow keys. A focused `role="slider"` announces its
  new `aria-valuetext` itself, and a live-region sentence on top of that would read the time twice.
  Check: *VoiceOver hears a tap once, units in words: "3.9 degrees north, 108.8 degrees west. Wind
  5.4 meters a second. From SSW (202°), gentle breeze, Beaufort 3."*
- **B8. Per-frame costs during play.**
  - The readout's text is now updated in place, and only where it changed.
  - `#top` is redrawn during play only when it carries arrows.
  - The track reads its CSS tokens once per theme.
  - `slowPlay()` judges every 15th frame.
  - The ladder judges only intervals between two quiet frames, and never while playing.

  These are headless figures, a trend only (not phone evidence): play on the map ran at a 16.7 ms
  median interval with 0 ladder moves. The phone is the owner's check.
- **B9. Key glyphs and states.**
  - *On* is now a 28 px plate of ink at 12 % behind the mark (it was a 2 px tick that read as a
    caret).
  - Flow: three curved streaks with dot heads.
  - Night: a globe with its night side filled, bounded by an elliptical terminator, with the equator
    on the day side.
  - Whole world: four corner brackets around a small circle (it was a globe, next to the Globe
    tab).
  - Hide the controls: the track drawn inside the frame (it read as a laptop).

  A word key for Flow was considered and not made, because the icon now reads as streamlines.

## Nits

- **Done:**
  - `NOTES.md` sizes re-measured and thousands grouped with U+202F throughout.
  - ART's two `Intl` lines now say the dates are hand-built.
  - The legend's ends that the forecast went past are printed open (`≤ −40`, `≥ 36 m/s`), judged
    from the layer's own `range`.
  - The arrows' length and weight both stop at 25 m/s, and the caption says so in the unit on
    screen.
  - Arrows sample `shownT`.
  - Labels are skipped at the left and top edges and under the keys, the ghost key and the card.
  - Map lines are clipped to the Mercator rows, and the coast is stroked from its own path, broken
    where Natural Earth's Antarctica is cut off.
  - The globe is not drawn with streaks while a finger turns it, and the first frame after the
    release prewarms. A first version still flashed a prewarm between two touch moves; it is now
    keyed to the gesture. Check: *at most 0 at 3 reads during the drag*.
  - Focus mode closes an open readout card.
  - No arrow is drawn under the ghost key.
  - `role="tabpanel"` moved to an inner `div`, so `<main>` is a landmark again.
  - The canvas is `role="img"`, and its label follows the tab.
  - The caption region is named *Scale, exposure and credits*.
- **Declined:**
  - Offsetting the globe to clear the key column. The centered disc is what every projection, the
    flow's seeding, the arrows and the test hooks assume. The overlap is a corner of the disc.
  - Drawing a spawn's first segment one frame later, so calm air shows no dots. That is the owner's
    taste: the dots are calm air drawn at its own speed.
  - A keyboard path for the tap readout and map panning. This predates the pass, and the arrow keys
    belong to the track.
  - The 320 × 568 wrap of the key column. Seven 44 px keys fit neither the 283 px plate as a column
    nor 320 px as a row.
  - The camera guard that taps *Show the controls* first. That belongs in `Tests/`, outside this
    folder, so it is the lead's.

## Owner calls left open after review

- ART 9 / A1: `assets/LICENSES.md` was edited as prose (above).
- The map's opening view now follows the phone's time zone, as the globe's always did.
- Landscape gives up the caption's two-line exposure for one line under the legend. Below 640 px of
  width it keeps two lines.
- The globe shows no streaks while it is being turned.
- Every owner call in the lists above is still open as written.

---

## Moved from `ART.md` on 2026-10-02: its after-review summary, word for word

`ART.md` ships inside the ZIP, and the house rule (`Template/HOUSE.md`, "What ships and what does not")
keeps build history out of a shipped file, so the lead moved these here unchanged on 2026-10-02, as
Anatomy's pass did for its own. Inside the moved text, *this file*, *§N* and *section N* mean `ART.md`
as it stood on 2026-10-01, and a pointer to `tools/DECISIONS.md` section N means this file's own
section N above.

## After review (2026-10-01)

Two reviews, one for honesty and one with a stranger's phone, changed these. The look is the same:
- The keys' *on* state is a plate of ink behind the mark, not a 2 px tick that read as a text
  caret. The Flow, Night, Whole world and Hide the controls marks were redrawn so that none of them
  reads as another app's icon.
- The exposure line has a fixed height, so the plate never moves when its words do.
- The Play key's mark now follows play. About holds play still. The readout card moves out of the
  way of the place that was tapped. Reduce Motion plays whole steps.
- A phone on its side gets its own layout.
- About's sentence on where streaks gather now names the projection as well as convergence, and
  the grid is described as sampled, not averaged.

Each finding, what was done or declined and why, and the commands that checked it are in
`tools/DECISIONS.md`.
