# Snug Kart: decisions and the record of the house-system pass

This file does not ship (`tools/` is left out of the ZIP). `ART.md` holds the look as built; this file
holds the record: the lead's rulings, the owner calls as the pass left them, the as-built departures,
the after-QA, after-review and after-follow-up sections, the phone checks. Plan 0011 package B, D1 to D5
and HOUSE.md are the brief. The builder's last step moves `ART.md`'s sections 8 and 9 here, word for
word, below this section; nothing above the first `---` is to be overwritten.

## The lead's interim ruling on the code cap (2026-10-02, plan 0011 D19)

**Held at 220 070 B until the build has measured; Tilt stays.** The game is already over the house's
200 000 B, so D5 holds it at the size the pass starts from, and the art pass estimates about 230 000 B
for the house modules, the Lap Chart and About. An estimate is not a measurement, so the builder
applies the whole change list, cuts no feature (not Tilt, whose only fault is a permission prompt the
device matrix has not yet seen), never minifies or strips comments, measures, and reports. The lead
then rules on the measured figure as for Milky Way (D7, D9: 240 000 then 242 000 from 223 463) and
Besseggen (D11: 227 000 from 215 934): a raise of up to about 5 % is the expected answer. The game's
own limits (the 3 MB ZIP, the draw-call and triangle budgets) stay as they are.

## The lead's ruling on the code cap (2026-10-02, plan 0011 D20)

**The cap is 244 000 B; Tilt stays.** The build measured 240 048 B against the held 220 070 (+9.1 %), with
nothing cut, minified or stripped: the house modules (`units.js` 2 583, `palette.js` 1 448, `chart.js`
4 622), About's markup, the title's bands and the race card's plates. That is about 20 000 B for the
house system — Shelf Atlas paid 44 000, World Oil & Gas 35 000, Milky Way 18 000 on a 223 000 base —
so the growth is in line and the estimate (230 000) was the thing that was off. Cutting Tilt (about
5 200 B) would still leave the game over the held figure by 6.7 %, so it would not avoid a ruling and
would remove a control scheme whose only fault is a permission prompt the device matrix has not yet
seen (row 152(b)). The ruling leaves about 4 000 B for the fix stages; they pay for nits in place and
report anything over, as every pass has. The lead set `CODE_CAP` in `tools/check.mjs` to 244 000
with this reason, so the one failing line passes.

---

## The build (2026-10-02): what was built, measured, and where it departs from ART.md

**The code cap, measured.** App code (every shipped `.html`, `.css` and `.js` outside `vendor/` and
`data/`) is **240 048 B** against the held 220 070 (+9.1 %), with the whole change list
applied, no feature cut, nothing minified and no existing comment removed. `node tools/check.mjs` fails
on that one line until the lead rules; every other check passes. Where the bytes went, against the
files as the pass found them: `index.html` +3 661 (About's words, the title's bands, the plates),
`style.css` +2 803 (rewritten on the house), `js/main.js` +3 479 (About, the title from words, the
results' chart and record sentence, the live region, Reduce Motion, `setViewOffset`, net of the speed
lines' 2 209 B), new `js/chart.js` 4 622, `js/units.js` 2 583, `js/palette.js` 1 448, and a few hundred
bytes in `race.js`, `hud.js`, `camera.js`, `track.js` and `items-view.js`. ART.md section 6 estimated
about 230 000; the estimate left out the About markup's real length and the title's rebuilt bands. The
one feature cut on offer was owner call 1, Tilt (`js/tilt.js` 3 566 B and about 1 670 B of wiring, so
about 5 200 B), which pays for a quarter of the 19 978 B over, not most of it (corrected after QA; the
lead ruled 244 000 B with Tilt kept, D20, above).

**Departures from ART.md, each with its reason** (ART.md is corrected to match where it described them):

1. *The title camera aims higher.* With `setViewOffset` centering the camera's axis in the plate, the
   old target (the road 14 m ahead, 4 m below it) filled the plate with asphalt. The glide now looks at
   the road 14 m ahead 0.6 m above it, 21° down, which is where the middle of the old visible region
   pointed; the plate shows the road to the horizon. Reduce Motion's still view is unchanged (40 m past
   the line, 6 m up, 14 m ahead).
2. *The warning sits under the race card, at the left,* not under the Pause key: the card is 154 px
   wide, and a centered plate under Pause covered it on every phone narrower than 390 px. For the same
   reason the Pause key stays centered only where the card leaves room (`left: max(50%, inset + 184 px)`);
   `shoot.mjs` lays out the card, Pause, the map, the warning, Item and Drift at five widths and finds
   them clear of each other. The diagnostics plate moved down to make room.
3. *The track map's casing has butt caps.* Drawn segment by segment in order of height with round
   caps, each segment's casing covered its neighbors' road wherever the road climbs, so on Pinewood
   Pass the map showed dots and no road (measured: 46 road pixels of 41 616). With butt caps the casing
   never reaches a neighbor, and Lantern Night's bridge still reads over its underpass by its gap.
4. *The settings row scrolls sideways inside itself* on a narrow screen, as the house's row of words
   does, rather than wrapping to a second row that would take the plate's height.
5. *Eight faces across from 384 px of width* (ART.md said 376): eight 44 px hits need 352 px inside
   the 16 px gutters. Below it, two rows of four.
6. *`raceTime` rounds to the millisecond before it splits off the minutes*, so 59.9996 s prints
   `1:00.000`, never `0:60.000` (the old `fmtTime` could).
7. *While the item key shuffles* its accessible name stays `Item`, as before; empty it is `No item`.
8. *Under Reduce Motion a respawn has no fade at all* (a cut), rather than a fade at 0 s.
9. *The reticle's sampler leaves out the four places where its ticks cross the ring* (there the
   "halo" sample lands on a tick's stroke).
10. *Screenshots.* `screenshots/title.png` and `results.png` (the old look, written by the old
    `SAVE=1`) are removed; `SCREENSHOTS=1 node tools/shoot.mjs` writes `title`, `race`, `results`,
    `about` and `paused`, each `-light` and `-dark`, and never `app.png`, whose hash it checks. The
    README's composite is the lead's.
11. *No `PROMPT.md`* exists in this app, so there was none to update; `NOTES.md` carries what a copy
    must know about the look.

**The camera.** Its one string, the button `Race`, is unchanged in text and role (`check.mjs` 9,
`shoot.mjs`'s boot): the camera needs no change.

**Not done by the builder, and why.** The `Template/README.md` sentence on the Lap Chart and the
README's picture are the lead's (change list item 23). The before-and-after pair is the lead's.

## ART.md sections 8 and 9, moved word for word at the build's close

## 8. The change list

The builder applies these in order. Each names its file; a *must* is checked by the final reviewer.
Data files stay byte-identical (`data/tracks.json` sha256 `057541fb…f8a88ec`, `data/racers.json`
`87dc6a99…19734846`), and so does `vendor/`.

1. **Baselines first** (must). Before any edit: `node tools/sim.mjs standard 3`, `node
   tools/items.mjs` and `node tools/check.mjs`, kept under `tools/.work/`. The art stage left three
   there on 2026-10-02: `sim-baseline-standard-3.txt` (`sim: all assertions pass`),
   `items-baseline.txt` (`items: all pass`) and `shoot-baseline.txt` (the old `shoot.mjs`, light
   theme: 78 checks, `no console errors; all checks pass`, exit 0; per frame on High 31 / 30 / 31
   draw calls and 29 544 / 105 026 / 63 828 triangles on the three tracks). `.gitignore` already
   ignores `tools/node_modules/`, `tools/.work/` and `dist/`.
2. **`fonts/`** (must): copy `ysabeau-office-gw.woff2` and `OFL.txt` from `../global-weather/fonts/`
   byte for byte (section 4).
3. **`js/units.js`** (new, must, pure: no DOM, imported by `js/track.js` as well): `raceTime(t)`
   (`1:52.985`, the `–:––.–––` placeholder), `aboutTime(t)` (`about 1:54`), `place(n)` (`5th`),
   `placeOf(n, of)`, `lapOf(n, of)`, `meters(x, digits)` (U+202F, thousands grouped with U+202F from
   four digits, the true minus), `percent(x)`, the diagnostics' figures, and the words VoiceOver
   hears (`1 minute 52.985 seconds`). `toFixed` and `toLocaleString` appear nowhere else but the
   allow-list `check.mjs` names (the test hook's numbers).
4. **`js/palette.js`** (new, must): the pasted output of `python3 snug-kart/tools/art/palette.py
   --json`, and `tone(racer, theme)` with the `from` fallback (section 2); the theme read from
   `matchMedia('(prefers-color-scheme: dark)')` with a `change` listener that redraws the chart, the
   strip, the map and the rings.
5. **`js/race.js`** (must): the `gates` record and an exported `GATES = 10` (section 1). No other
   change; prove it with the sim baseline (item 1).
6. **`js/chart.js`** (new, must): the results chart and the strip exactly as section 1 rules; the
   face awaited; `points` kept for the test hook.
7. **`index.html`** (must): `<html lang="en-US">`; the viewport `width=device-width, initial-scale=1,
   viewport-fit=cover` (B1); `<meta name="color-scheme" content="light dark">` and the two
   `theme-color` metas carrying `--page` per scheme; the title's header (`h1`, the About key), the
   track words, the bands, the record row with `Race`; the race card with its strip canvas, no
   `aria-live` on the place (B6); the Pause key plate; the keys; notice plates; the results sheet
   with the chart canvas and caption; the About dialog with its words (section 3); one live region.
   Remove the wordmark, the tagline, the track card and its ‹ › keys, `#lines`, the dashed ghost,
   the inline style on the symbol sprite (a class instead). Keep the five item symbols as they are.
8. **`style.css`** (must): rewritten on the house: the `@font-face` rule and the token block copied
   from `global-weather/style.css` lines 10-43 (less `--outside`); `html, body { background:
   var(--page) }`; the objects of section 3; radii by role; no `box-shadow`, `backdrop-filter`,
   `text-shadow`, `filter: drop-shadow`, `text-transform` or nonzero `letter-spacing`; no accent;
   transitions on `transform`, `opacity` and `clip-path` only, never `all`; the Reduce Motion block
   (`*, *::before, *::after` at 0 s); `(hover: hover)` for hover; the landscape layout; the safe
   areas. The pad and the drift zone keep `touch-action: none`; every control
   `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent`.
9. **`js/main.js`** (must): the title from words (no `innerHTML`, B14) with the caption, the racer's
   name and line, the record row and the notes through `js/units.js`; `setViewOffset` for the plate;
   the results sheet (place, lead, chart, caption, rows with `aboutTime` for projected racers (B3),
   the record sentence); About (open from the key, the loop stopped while open, Escape, focus held
   and returned, `vendor/three-LICENSE.txt` fetched into its text); the live region's sentences
   (section 3); the error sentences in US English with no em dash (B5, B10); the diagnostics
   through `js/units.js`; `window.__sk.chart()`; and the Reduce Motion listener that tells the camera.
10. **`js/hud.js`** (must): the card's forms (`placeOf`, `lapOf`, `Last lap`), the strip's redraw rule,
    the track map as section 2 draws it, banners and the countdown as notice plates with no
    animation (B7, B9, B11); `fmtTime` and `ordinal` move to `js/units.js`.
11. **`js/items-view.js`** (must): the reticle's locked state as a shape; the warning's words, no
    blink, no icon (B7); the empty item key's `No item` (B8).
12. **Speed lines** (`js/main.js`, `index.html`, `style.css`; should, the trim of section 6): remove
    `speedLines`, `clearLines`, `G.lines`, `#lines` and its resize code. Owner call 2.
13. **`js/camera.js`** (must): Reduce Motion: the still title view, no swoop, no finish swing, no
    shake (B9).
14. **`js/track.js`** (must): the validation's sentences through `js/units.js` (B15).
15. **`js/input.js`** (should): only class names if the restyle needs them; the pad's geometry, the
    drift zone and decision 31's sizes do not change.
16. **US English** (must): every shipped text file, comments included. Measured today with Global
    Weather's spelling pattern (`global-weather/tools/check.mjs` line 262, widened with the British
    spellings of *cozy* and *curb*): 19 hits of the British *color* in `DESIGN.md`, 7 of *colors*, 7 of
    *center*, 5 of *centerline*, and more of *meter(s)*, *curb(s)*, *neighboring*, *forever* written
    as two words, *license(s)* and *defense*, in `DESIGN.md`, `NOTES.md` and twelve of the eighteen
    modules (`js/scenery.js`, `js/track.js`, `js/ai.js`, `js/kart.js`, `js/main.js`, `js/geo.js`,
    `js/fx.js`, `js/items.js`, `js/items-view.js`, `js/camera.js`, `js/rng.js`, `js/physics.js`).
    The data's names and keys stay: `Harbour Loop`, the id and ground `harbour`, and the identifiers
    that read them (`harbourProps`, the `'harbour'` cases in `js/scenery.js` and `js/store.js`),
    allow-listed in `check.mjs` by file and word, with the phrase `Harbour Loop` allowed wherever the
    data's name is quoted (this file included). The scenery's curb identifiers, spelled the British
    way today, are renamed.
17. **`NOTES.md`** (must): the folder (`ART.md`, `fonts/`, `js/units.js`, `js/palette.js`,
    `js/chart.js`, `tools/art/`, `tools/test_chart.mjs`, `tools/DECISIONS.md`), the tests and their
    results as run, its credits heading in US spelling ("Licenses") with three.js and the font's credit line, and the
    sentence "No font … is included" removed; the look points to this file.
18. **`DESIGN.md`** (must): §11 (the HUD's face, colors and outline), §12 (the title, the panels'
    colors), §13 (the viewport sentence: zoom is blocked by `touch-action`, not `user-scalable`), §17
    (the tests) and §18 (the font's credit), brought to what is built; US spelling.
19. **`tools/check.mjs`** (must): HOUSE 7.1's seventeen checks, kept with the game's own (`vendor/`
    identical to `../anatomy/vendor/`, the borrowed-names list, the track table): the face's and
    `OFL.txt`'s sha256; `fonts/` holding exactly those two; the data's sha256 (above); `miniapp.json`
    (name `Snug Kart`, unchanged); the AI vendor list copied from `global-weather/tools/check.mjs`
    line 128, ROT13; the font credit line and the three.js credit in About; the camera's `Race`
    button in `index.html`; every `localStorage` key still `snugkart:v1:` (`settings`, `best:<id>`,
    `hints`), none removed; SI and the `toFixed` allow-list; nothing that carries a number
    transitions (the race card, the record row, the captions); `innerHTML` only as `= ''`; the palette
    (`js/palette.js` equals `--json`; the script exits 0 with `ALL CHECKS PASS`); the tells' greps,
    the tokens in both themes, one `@font-face`, no other `font-family`, every script font string
    starting `"Ysabeau Office"`; the budgets (code at the cap the lead rules, fonts 160 000, ZIP
    720 806, the ZIP built as `build-zips.yml` builds it with `index.html` at its top); US spelling
    with the data's allow-list; `screenshots/app.png`'s sha256 unchanged
    (`6568ae797c44d88b07c0d4204c0361b9e9b3680c435ef13e046de2ff3629239c`).
20. **`tools/shoot.mjs`** (must): today's scenes kept and moved to the new markup (the countdown
    without its pinned animation; the results' rows; the settle guard), and HOUSE 7.2's adapted to a
    game, in both themes by default: boot (`Race` by role and name, the face loaded before the first
    chart); every visible text node at 4.5:1 or more over its composited background on the title, in
    the race, on pause, the results and About; the tracer under exactly the chosen track, racer and
    toggles; **the signature sampler** (the results chart's ink pixels along `__sk.chart().points`
    against the pixels 4 px to each side, 90 % at 3:1 or more, the lowest printed); the chart drawn
    by the script's own formula (column 0 the grid, every column a ranking, column 30 the results'
    places, projected racers dotted from their last column); the reticle and the steering ring
    sampled over Pinewood Pass's snow in the dark theme (3:1); SI in every visible text node; hit
    targets 44 × 44 or more (B2); About opened from its key, the loop stopped under it, Escape and
    focus return, the license text and both credits present; Reduce Motion (every duration 0 s, the
    title camera still over a second, the countdown's camera already at the chase pose, no shake);
    the live region's sentences, once each; widths 320, 360, 375, 844 × 390 and 125 % zoom (312 ×
    675): no sideways scroll, the bands scrolling inside, the title's plate at least 220 px on its
    side; broken data (`tracks.json` missing, not JSON, no `tracks`, a racer short of a field) each
    giving its sentence; hidden stops every loop; pictures to `tools/.work/shots/`, and with
    `SCREENSHOTS=1` `title.png` and `results.png` to `screenshots/`, **never `app.png`**, the
    README's picture, whose hash it checks unchanged (today `SAVE=1` writes it: that stops). Frame
    times stay printed as a headless trend.
21. **`tools/test_chart.mjs`** (new, must; the decode test of HOUSE 7.3): races in Node on the real
    `js/race.js` (as `tools/sim.mjs` sets them up), with places recomputed every step by the test's
    own rule (finished karts by finishing time, then distance) and its own gate crossings, compared
    with `gates` for every kart in 15 races; prints the figures section 1 quotes.
22. **`tools/DECISIONS.md`** (new, must): the owner calls as they stand, the builder's as-built
    notes, the record of the review. At the close, sections 8 and 9 of this file move there word for
    word and this file keeps the look as built.
23. **Not the builder's**: `Template/README.md`'s entry gains one sentence on the Lap Chart, and the
    README's picture is recomposed by the lead.

---

## 9. Owner calls left open

1. **The code cap: the lead's interim ruling (2026-10-02, plan 0011 D19) is in section 6** — held at
   220 070 B until the build has measured, Tilt kept, the lead rules on the measured figure. The
   question as the pass put it: the game is held at 220 070 B; the pass is estimated at about 230 000
   (section 6). The lead rules on the measured figure, as for Milky Way and Besseggen. The alternative
   was **cut Tilt** (`js/tilt.js` 3 566 B and about 1 670 B of wiring), whose permission prompt may
   never appear inside Snuggery (the device matrix's row 152(b), never run). *Closed by the lead's
   ruling (D20, at the top of this file): 244 000 B, Tilt kept. Corrected after QA: the cut would have
   paid for about 5 200 of the 19 978 B over, a quarter, not most of it.*
2. **The speed lines** go (2 209 B and more): the boost keeps its sound, its camera field of view and
   its puffs. Say if they should come back.
3. **The banners' voice.** `Paper plane!`, `Tangled!`, `Sticky!` become plain sentences. The game's
   exclamations were its personality; the house speaks in statements.
4. **The tagline** (`Three laps. Seven rivals. One cozy town.`) is removed rather than moved; it
   could open About's second section instead, at no cost.
5. **Pip's orange is darker in the chrome** than on its kart in the light theme (rust `#7f4302`) to
   stand apart from Wren's gold. Changing Pip's or Wren's color in `data/racers.json` would let the
   tones follow the karts more closely; that is a data edit, outside this pass.
6. **`Harbour Loop`** keeps its British spelling because it is the data's name (`data/tracks.json`,
   which this pass may not touch). Renaming it `Harbor Loop` is a one-word data edit; the id
   `harbour`, which keys every stored best time, must stay.
7. **The scene in the light theme.** Lantern Night stays night and every track keeps its own light in
   both themes; only the chrome follows the theme.
8. **Drift and Item as square key plates** rather than round game buttons, same sizes and the same
   14 px of slack. Round is the genre's convention; square is the house's key.

**Phone checks for the device matrix** (not claimed; each needs the device and iOS version it names
when run): on an iPhone 16-class phone on the current iOS, in Snuggery's full screen, from the
public ZIP: the race card, the track map and the notices legible over all three tracks in daylight;
the Lap Chart legible on the results in both themes, and its lines followable by eye; the drift
key's two tiers seen under a thumb; the steering ring and the lock-on reticle over Pinewood Pass's snow in the dark theme (their
margins over 3:1 are thin, after QA item 4);
Reduce Motion (the still title, no swoop or swing); a phone on its side (the title's column, the
race); the safe areas with the status bar showing, and the HUD clear of Snuggery's exit control on
iOS 18; VoiceOver on the title's groups, the live region in a race and the results' rows; frame time
on High through a Pinewood Pass race against today's (the strip's redraws and the DOM plates are
the new cost); and the tilt prompt, which owner call 1 depends on.

---

## After QA (2026-10-02)

QA reran every tool and found the build's figures exact; it returned one must, one should and two nits.

1. **Must: app code over the held 220 070 B.** *Declined as already resolved.* QA ran `check.mjs` before
   the lead's ruling landed; the lead has since ruled 244 000 B with Tilt kept (D20, at the top of this
   file, and plan 0011 D20) and set `CODE_CAP` in `check.mjs`. The rerun after this section's edits
   printed `ok   app code 240,052 bytes (cap 244,000, …)` and `all checks pass`. The 4 B over the
   ruled-on 240 048 are the two curly apostrophes of item 3 (two bytes each in UTF-8); 3 948 B remain.
2. **Should: "Tilt pays for most of it" overstated the cut.** *Applied.* Measured line by line, Tilt's
   wiring is about 1 670 B: the `set-tilt` button (`index.html`), `body.tilt #pad-ghost`
   (`style.css`), `tiltSteer` and its read (`js/input.js`), the import, the hook, the start at the
   race, the permission request on Race, the settings toggle and its notes, the calibrate at Go and the
   debug field (`js/main.js`), the default (`js/store.js`). With `js/tilt.js`'s 3 566 B that is about
   5 200 B, 26 % of the 19 978 B over, leaving about 234 800 B, 6.7 % over the held figure, which is
   the lead's own arithmetic in D20. Corrected in place in the build record and owner call 1 above;
   `ART.md` section 6 now gives the same arithmetic instead of the bare "would still leave the game
   over".
3. **Nit: two straight apostrophes on screen.** *Applied.* `Uses your phone’s volume. …` and
   `Tilt isn’t available here.` (`js/main.js`, the settings notes) now use U+2019, which the house cut
   carries (HOUSE.md's character list, `U+2018-201E`; the app's face is byte-identical to Global
   Weather's). A grep of every double-quoted and template string in `js/` and of `index.html`'s text
   found no other straight apostrophe on screen. `ART.md`'s and `DESIGN.md`'s quotations of the two
   strings follow.
4. **Nit: the dark reticle's margin over Pinewood Pass is thinner on a fresh run.** *Recorded, no
   change.* QA's `shoot.mjs` run printed a 10th percentile of 3.30 (lowest single sample 1.63) for the
   reticle and 6.97 (lowest 1.88) for the steering ring, against the builder's 3.41 and about 1.9; the
   check (90 % of samples at 3:1 or more) passes on both runs, and the spread is the simulated race
   (items, collisions, framing). The halo recipe is the house's and is not changed to buy margin; the
   rerun's own figures are quoted below. The phone check for the steering ring over Pinewood Pass's
   snow in the dark theme (owner call list above) now names the reticle too.

**Reruns after these edits** (Playwright headless Chromium at 390 × 844, DPR 2: layout and pixel
evidence, never phone evidence):

- `node tools/check.mjs`: `ok   app code 240,052 bytes (cap 244,000, …)`, `ok   ZIP size 618,344 bytes
  (cap 720,806 …)`, `ok   fonts/ 40,075 bytes`, both data files' sha256 the values recorded before the
  pass, `all checks pass`.
- `node tools/test_chart.mjs`: `kart.gates equals the test's own record for 240 of 240 karts in 30
  races`; `the order changes 49.3 times, the chart shows 38.5 crossings; your place changes 14.1 times
  and the chart sees 8.1`; `all checks pass`.
- `node tools/sim.mjs standard 3` and `standard 5`: `sim: all assertions pass`. `node tools/items.mjs`:
  `items: all pass`. `python3 snug-kart/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
- `SCREENSHOTS=1 node tools/shoot.mjs`: exit 0, `367 requests, 0 outside the app`, `no console errors;
  all checks pass`. Its two Tilt checks matched `/isn't available/` with a straight apostrophe and failed
  on the first rerun (`FAIL motion permission refused: tilt stays off ("Tilt isn’t available here.")`);
  the pattern now carries U+2019 and both print `ok`. Halo marks over Pinewood Pass on this run: light,
  reticle 10th percentile 4.80 (lowest 2.56), steering ring 3.67 (1.98); dark, reticle 3.01 (1.63),
  steering ring 6.97 (1.88). The dark reticle's 3.01 is the thinnest margin any run has printed; it
  passes, and it is why item 4 asks for the phone. The race, paused, results and title screenshots were
  rewritten by the run (the simulated race differs run to run); About's and `app.png` are unchanged.


---

## After review (2026-10-02)

The reviewer's verdict was *fix*: two musts, six shoulds, five nits. Every must and should is
applied; the nits are applied except where noted. Code went from 240 052 B to **241 876 B** (+1 824;
2 124 B left under the lead's 244 000). No comment was stripped and nothing was minified to make room.
Moved here from `ART.md` section 6, which now gives only the figure: *240 048 B when the lead ruled;
QA's two curly apostrophes added 4, giving 240 052 B before this review.*

**Must 1, the Lap Chart's caption collapsed on a short results panel.** *Applied.* `.results-panel >
* { flex-shrink: 0; }` (`style.css`): the panel scrolls instead of squeezing its children, so the
caption (`p.two`, 30 px, `overflow: hidden`, whose automatic minimum height was 0) keeps both lines.
Measured by `tools/.work/fix/probe.mjs` (throwaway): caption 30 px and inside the panel at 390 × 844,
375 × 667, 360 × 640, 320 × 568, 844 × 390, 667 × 375 and 932 × 430 (the reviewer's run: 30, 21, 0,
0, 0, 0, 0). `shoot.mjs`'s `widths` scene now finishes a race at every width and asserts it.

**Must 2, the first-race hint landed on the countdown (upright) and on Pause (on its side).**
*Applied, and widened.* The hint now sits 8 px under the countdown's plate. Extending `shoot.mjs`'s
clearance check to the countdown (hint, countdown, card, Pause, map, Item, Drift, the steering ring)
found a second, older collision the reviewer's probe did not look for: on 320 and 360 px phones and
at 125 % zoom the countdown's plate itself (22 % down) ran into the track map, and at 320 × 568 into
the race card too. So the countdown's top is now `--ct: max(22%, calc(var(--mt) + 168px))`, 8 px
under the map on a narrow phone (18 % on its side, unchanged), the hint follows it (`calc(var(--ct)
+ var(--ch) + 8px)`), and on an upright phone 600 px tall or less the plate is 100 px with 75 px
numerals (`calc(var(--ch) * 0.75)`; written 76 here until the final review) instead of 128 and 96,
so the hint still clears the steering ring. The banners use the same `--ct` (they were 24 % down; at
320 px the longest, *Caught in a yarn snare*, would have met the map), and the race clearance check
now includes the longest banner. The hint's width limit is `100% − 32px` (was 48), so the pad's hint
is one line on a 320 px phone. Chosen over the alternative of the hint just above the steering ring
because under the countdown is where the code comment always said it was, and it reads with the
numerals as one thing.

**Should 1, fast blinks ignored Reduce Motion.** *Applied.* `main.js` passes `chase.still` as
`view.still` to `Field.update` and as a fourth argument to the items hook's `frame` (and on to its
`hud`). Under Reduce Motion: a kart with `immuneT > 0` is drawn at a steady opacity of 0.5 (its
material is alpha-hashed, so it is a steady dither, not a fade) and never hidden; an expiring Quilt
shrinks once to 80 % instead of blinking (its bubble is one instanced mesh with one material, so a
per-kart opacity would cost a second mesh; a single step in size is not motion); the item key shows
the item the shuffle lands on, at the existing 75 %, instead of cycling. With motion on, both blinks
are 3 Hz (`time * 6`, were 12 and 10, i.e. 6 and 5 Hz): a recovery is 1 s, so at most three flashes
in any second (WCAG 2.3.1's threshold is "no more than three"). The shuffle keeps 5 Hz with motion on:
it swaps a 46 px icon on a white plate, not a flash of a large area. `shoot.mjs`'s `reduced` scene
asserts it: `Reduce Motion, no blink: mid-shuffle the item key shows the honey it lands on, at 75 %
(#i-honey); after a hit your kart is a steady half form ([[true,0.5],[true,0.5],[true,0.5]] …)`. The
test hook's `karts()` gained `body` (the kart body's visibility) for that check.

**Should 2, the title plate was mostly asphalt.** *Applied.* `js/camera.js` `glide()` looks at the
road 32 m ahead instead of 14 m (about 10° down instead of 21°, from 6 m up, unchanged), so with the
view centered in the plate the horizon sits a third of the way down it: Pinewood's hills and pines,
the harbor's buildings, crane and boats, Lantern Night's bridge and towers fill the plate (before
and after, all three tracks: `tools/.work/fix/cmp-*.png`). The Reduce Motion still pose is the same
code at 40 m, so it follows. The harbor's start straight is open on one side, so a title shot taken
there shows more sky than the other two; that is the track. Re-shot in both themes and at 375 × 667,
320 × 568 and 844 × 390.

**Should 3, state changes not announced; focus lost on pause.** *Applied.* `onSetting` says its note
through the live region (`Tilt isn’t available here.` is heard; asserted in `shoot.mjs`'s `tilt`
scene). `#pause` is `role="dialog"` named by its `<h2 id="pause-h">Paused</h2>`; `pause()` focuses
Resume and `resume()` focuses the Pause key (asserted in `look-pause`, which now pauses by a real tap
so the screenshot shows focus as a finger leaves it, with no ring). Focus moves on every pause, not
only a keyboard one (`event.detail === 0` was suggested): a finger's pause draws no ring in WebKit's
or Chromium's focus-visible heuristics, and a VoiceOver activation's `detail` is not something this
build can measure. On a pause during a race, the Pause key holding focus does not re-pause on Space
or Enter: `js/input.js` already calls `preventDefault` on both while racing. As the results appear the
live region says `Results: 6th of 8. Race again or change track.` (asserted in `live`).

**Should 4, About sat under iOS 18's full-screen exit control.** *Applied.* The probe put the
control's 44 px square 16 px inside the top-right corner (decision 36) over the About key at every
width, and at 320 px over `Lantern Night` too. About now sits right after the name (`grid-area: 1 /
2; justify-self: start`), and the track row stops 52 px short of the right edge (on its side: name,
About, the track words, the words row likewise short of the corner). `shoot.mjs`'s `widths` scene
asserts at all six sizes that no header key, the words as clipped by their row, meets that square.
This departs from HOUSE 4.2 (*a game: About at the header's right*); the house's own reference opens
About from the stamp at the left, and the app's measured constraint wins (`ART.md`, the header). Still
a phone check: tap About in full screen on iOS 18 and see it open.

**Should 5, shipped documents stated facts the build had moved past.** *Applied.* `NOTES.md`'s
results now give the current check line (all pass, 241 876 of 244 000) and the halo figure as "3:1 or
more for 90 % of samples, the 10th percentile varying run to run between about 3.0 and 7.0"; the
"when the lead ruled / QA's apostrophes" clause is moved here (above).

**Nits.** *Applied:* the map's rival dots read the theme once per map build, not `matchMedia` per dot
per frame (`hud.js`); the strip's and the chart's canvases keep their backing store when the size is
unchanged and are cleared instead (`chart.js` `sized`); `role="img"` on `#gl` and `#minimap`;
`role="list"` on `#res-list`; each results row named in words with `spokenTime` (`2nd, Pip Marlow, 2
minutes 20.900 seconds, best lap 45.821 seconds`, `about …` for a projected time; asserted in
`look-results`); the record reads `best race 2:10.000, as Juno`; About joins the three.js license's
single line breaks into spaces and keeps its blank lines (the words verbatim; `look-title` compares
with the file joined the same way). *Not applied:* caching the strip's width (`stripKey` reads
`clientWidth` with no layout pending, which is a cached read; the reviewer's own LayoutCount showed
no extra layout); a roving tabindex with arrow keys in the two radiogroups (about 300 B for a
keyboard convenience on a touch game, left for the budget); the off toggles reading `Sound off`, and
seeding `#note` so the band is never a hole — owner calls (close to calls 3 and 8, below).

**Reruns after these edits** (Playwright headless Chromium at 390 × 844, DPR 2: layout and pixel
evidence, never phone evidence; no frame time here is a phone figure):

- `node tools/check.mjs`: `ok   app code 241,876 bytes (cap 244,000, …)`, `ok   fonts/ 40,075 bytes`,
  the ZIP under its 720 806 cap, both data files' sha256 the values recorded before the pass,
  `all checks pass`.
- `node tools/test_chart.mjs`: `per race, over 30 races: the order changes 49.3 times, the chart shows
  38.5 crossings; your place changes 14.1 times and the chart sees 8.1`, `all checks pass`.
- `node tools/sim.mjs standard 3`: `sim: all assertions pass`. `node tools/items.mjs`: `items: all
  pass`. `python3 snug-kart/tools/art/palette.py`: `ALL CHECKS PASS`.
- `SCREENSHOTS=1 node tools/shoot.mjs`: exit 0, 189 `ok` lines, `395 requests, 0 outside the app`,
  `no console errors; all checks pass`; `screenshots/app.png` untouched. Halo marks over Pinewood Pass
  on this run: light, reticle 10th percentile 4.80 (lowest 2.56), steering ring 3.67 (1.98); dark,
  reticle 3.14 (1.63), steering ring 6.97 (1.88). The first full run failed one check, the record
  row's expected string (`by Juno`), which the wording change moved; the expectation now reads
  `, as Juno` and passes.

**The camera.** Its one string, the button `Race`, is unchanged (`look-title`: one button named
"Race"). No camera change is needed. Note for the lead: the camera's full-screen shots of the title
(`23-snug-kart`, `readme-snug-kart-1`) will show the About key after the name rather than at the
right, and the plate framed on the scenery.

**Phone checks added** (each needs the device and iOS version it names when run): on iOS 18, in
Snuggery's full screen, the title's About key opens with the exit control showing; the recovery blink
(3 Hz) and the Reduce Motion half form at the kart's real size; VoiceOver: pause lands on Resume,
resume on Pause, the results' sentence and rows in words; frame time on Pinewood Pass at High through
a full race against the pre-pass build (the reviewer's nit; the per-frame `matchMedia` and canvas
reallocations are gone).

---

## Moved from ART.md on 2026-10-02, word for word (the follow-up after the final review)

The final review found the pass's record still in `ART.md`, which ships (should 3 of the section
below). Every passage that left it is here as it stood, under the place it stood. Where a passage
also stated a rule or a figure that is kept, the whole passage moved and `ART.md` now says what is
built. The section that stood between "The look" and section 1, with the bugs B1 to B15 that
`ART.md` and `NOTES.md` cite, is last, under its own heading as it stood.

### The opening, its second paragraph's first sentence (its history: "before the pass"; the figures are as built)

**Measured on 2026-10-02** on the working tree, before the pass.

### Section 3, "Motion and Reduce Motion", the title camera's row as it stood (its history: "as today", "at 21° down, 14 m ahead, it was two thirds asphalt")

| The title camera | glides along the centerline at 8 m/s, as today, 6 m up and looking about 10° down at the road 32 m ahead, so with the view centered in the plate the horizon sits near a third of the way down it and the track's own scenery (the harbor, the pines, the lanterns and the bridge) fills it; at 21° down, 14 m ahead, it was two thirds asphalt |

### Section 3, "Reduce Motion", the sentence on the two blinks as it stood (its history: "(they were 6 and 5 Hz)", "still")

With motion on, those two blinks run at 3 Hz (they were 6 and 5 Hz): a recovery lasts
1 s, so at most three flashes in any second (WCAG 2.3.1), and the shuffle still cycles at 5 Hz.

### Section 6, "Budgets", the figures before the pass as they stood (headed "Today")

**Today**, measured 2026-10-02 on the working tree:

| | Measured | Command |
| --- | --: | --- |
| App code (every shipped `.html`, `.css`, `.js` outside `vendor/` and `data/`) | **220 070 B** | `find . -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.mjs' \) -not -path './vendor/*' -not -path './data/*' -not -path './tools/*' -not -path './screenshots/*' -print0 \| xargs -0 wc -c` |
| Fonts | 0 B (no `fonts/`) | `ls fonts` |
| ZIP | **546 378 B** | `zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'` then `wc -c`; `node tools/check.mjs` printed the same, `ZIP size 534 KB (546378 bytes; limit 3 MB)` |

### Section 6, the caps table's app code row as it stood (its history: "held at 220 070 B … until the build had measured")

| App code | **244 000 B, the lead's ruling (2026-10-02, plan 0011 D20)** | held at 220 070 B (over the house's 200 000, D5 point 2) until the build had measured; ruled on the measured 240 048 B, Tilt kept; the reasons are in `tools/DECISIONS.md` |

### Section 6, the paragraph under "As built" as it stood (its history: the estimate before the build, the ruling's arithmetic)

The whole change list is applied with nothing cut, nothing minified and no existing comment removed;
the estimate before the build was about 230 000 B. Where the bytes went is in `tools/DECISIONS.md`.
The lead ruled 244 000 B on this figure (plan 0011 D20): the house modules, the chart and About cost this
app about 20 000 B, the least of any pass, and cutting Tilt would not have avoided a ruling: `js/tilt.js`
(3 566 B) and its wiring (about 1 670 B in `index.html`, `style.css`, `js/input.js`, `js/main.js` and
`js/store.js`) come to about 5 200 B, a quarter of the 19 978 B over, and would have left the game near
234 800 B, 6.7 % over the held figure. `check.mjs` enforces 244 000.

## Bugs on record, and the stranger's run

**On record: none.** Plan 0009 item 5 ("Bugs in your own apps, seen by the reviewers") names four
bugs, in Norne Reservoir, World Oil & Gas, Milky Way and Global Weather, none in this game
(`grep -n "Bugs in your own apps" -A 6 docs/plans/0009-launch-1.1.md`). `docs/review/` never names
it (`grep -rn -i kart docs/review/` prints nothing). `NOTES.md`'s 42 decisions are all settled; its
"Device checks this build cannot do" and the device matrix's row 152 list phone checks never run,
not defects.

**Found by the stranger's run** (`tools/.work/look.mjs`, a throwaway driver: title, a race on each
track, pause and results, in both themes at 390 × 844, at 320 × 640 and at 844 × 390; read by
eye), every one a must, every one fixed (`tools/DECISIONS.md` names the item that fixed each):

| # | What | Evidence |
| --- | --- | --- |
| B1 | The viewport says `maximum-scale=1, user-scalable=no`, and `<html lang="en">` | `index.html` line 5 and line 2; HOUSE 4.1 forbids the first and asks `en-US` |
| B2 | The Pause key is 40 × 40 px, under the 44 × 44 every control needs | `style.css`: `#btn-pause { … width: 40px; height: 40px; }` |
| B3 | A projected time (a rival still racing when the race ends) is printed to the millisecond, as `1:54.056 est.`: an estimate from ten seconds of average speed, shown at a precision no one measured | `js/main.js` `showResults`; `js/race.js` `finishRace` |
| B4 | Thousands with a comma and meta joined by middle dots: `1,028 m · No best yet`, `Best lap … · Best race …` | `js/main.js` `renderTitle` (`toLocaleString('en-US')`) |
| B5 | British spelling on screen: the tagline's last word (the British spelling of *cozy*), and the racer check's sentence that a body must be a *color* like `#F28C28`, spelled the British way | `index.html` line 49; `js/main.js` `checkRacers` |
| B6 | The place is an `aria-live` region, so VoiceOver speaks every overtake: 14.1 place changes a race for an even driver | `index.html` `#pos`; `node tools/art/measure_lapchart.mjs` (15 races) |
| B7 | The *Plane behind* warning blinks twice a second in red, and the lock-on reticle spins and turns orange when locked: a pulse and a color as the only signal | `style.css` `#warn` (`animation: blink 0.5s steps(2) infinite`), `#reticle` |
| B8 | With no item in hand the item key is a blank dark disc with no word on it; a stranger cannot tell what it is | `race-*.png` in the run; `js/items-view.js` (`Item` is only its accessible name) |
| B9 | Nothing reads Reduce Motion: the title camera glides forever, the countdown swoops, the finish camera swings, a boost shakes the camera, the numerals pop, the reticle spins, the warning blinks | `grep -n "prefers-reduced\|matchMedia" js/*.js style.css` prints nothing |
| B10 | Spaced em dashes as separators: `Harbour Loop — 5th`, `Pip Marlow — A bike courier …`, `Graphics were reset — tap to continue.`, `… is not valid JSON — check …` | `js/main.js` lines 100, 303, 418; `index.html` line 89 |
| B11 | Text over the scene is held up by an eight-way text-shadow and banners fade in over pale sky: in the landscape run `Paper plane!` is half-transparent over Harbour Loop's buildings | `style.css` `#hud` text-shadow, `#banner` transition |
| B12 | At 320 × 640 the title panel covers the whole scene: the track the person is choosing is not on screen | `title-w320-light.png` in the run |
| B13 | The diagnostics line is set in a monospace stack | `style.css` `#diag` (`ui-monospace, Menlo, monospace`) |
| B14 | One value reaches markup through `innerHTML` (the settings chips) | `js/main.js` `renderChips` |
| B15 | The track validation's sentences put a plain space between a number and its unit (`radius 12.0 m`) and format through `toFixed` | `js/track.js` lines 99, 203, 208, 226 |

---

## After the final review (2026-10-02)

The final reviewer's verdict on the pass (`wf_d5612955-2cf`) was **fix**: one must in the app, two
shoulds, one nit (the review's must on `Template/README.md` is the lead's and was already fixed).
All four are applied; nothing is declined. The lead's rulings held throughout: the code cap is
244 000 B (plan 0011 D20), Tilt stays, nothing is minified and no comment is stripped (the new
comments are short). My drives, logs and pictures are in `tools/.work/followup/`, which git ignores:
`probe.mjs` (the title at any size: the faces, the plate, the bands, the house's run-length hit
test, and Chromium's emulated safe-area insets), `spoken.mjs` (what is drawn against what the
accessibility tree reads, in this build and in `app-orig/`, a copy of the build before the
follow-up), `art_edit.py` and `notes_edit.py` (the `ART.md` and `NOTES.md` edits, every replacement
asserted to match once), `moved.md`, the logs and pictures named below, and in `orig/` the files as
they stood before.

**The must: on a phone on its side the eight racer faces were 40 × 52 px buttons.** The landscape
block set `#racers { grid-template-columns: repeat(8, 40px); }` and `.racer { width: 40px; }`: the
360 px column less its 32 px of gutters leaves 328 px for eight 44 px faces, which need 352.
Measured before (`probe-before.log`, the run-length hit test `house()` runs at 390 × 844): at
844 × 390, 667 × 375 and 932 × 430, 8 of the title's 18 controls under 44 × 44, every face `40×52
(hit 40×52)`.

*Applied: the faces wrap to two rows of four in the column, as the upright title does under 384 px*,
by one rule (`@media (max-width: 383px), (orientation: landscape) and (max-height: 500px)`), and the
landscape block's two 40 px lines go. Chosen over a 384 px column for two reasons. The plate keeps
its width: it stays 307 × 329 px at 667 × 375, where a 384 px column would leave it 283 px wide,
narrower than the column beside it (and 484 × 344 at 844 × 390, 572 × 384 at 932 × 430, against 460
and 548). And a 384 px column would still not hold eight faces on a notched iPhone: with side
safe-area insets emulated in Chromium (`Emulation.setSafeAreaInsetsOverride`, 47 px a side at
844 × 390, 59 at 852 × 393 and 932 × 430: the insets commonly published for those iPhones on their
side, never measured on a phone here), the build before the follow-up packed its eight 40 px faces
edge to edge and pushed the last one or two past the column's padding into the inset
(`probe-before-inset47.log`, `probe-before-inset59.log`, `before-inset47-844x390.png`), and 384 px
less its gutters and a 47 px inset leaves 305 px for 352. Two rows of four fit at every size and
inset tried (`probe-after*.log`; at 812 × 375 with 44 px insets the column scrolls 15 px inside
itself, as it is built to, and Race keeps its own row). The second row adds 52 px to the column: its
content is 270 px, inside the 291, 276 and 331 px the column has at 844 × 390, 667 × 375 and
932 × 430, so nothing scrolls there.

After (`probe-after.log`; `shoot.mjs`, below): **each face is a 44 × 52 px button**, 18 of 18 title
controls at 44 × 44 or more at all six sizes probed, the plate unchanged. I looked at
`after-844x390.png` and `after-667x375.png` myself: two rows of four faces, 82 px apart, the chosen
face's tracer under it, the name and line below, the settings and Race in place, nothing clipped.
Cost 74 B in `style.css` (the comment 104, the media query 50, less the 80 B of the two lines it
replaces).

`shoot.mjs`'s widths scene now also runs at 667 × 375 and 932 × 430, and at every size asserts, with
`house()`'s run-length test, that every control on the title hits at 44 × 44 or more; the two new
sizes pass every other check of the scene (no sideways scroll, the plate, the caption, the
exit-control corner, a first race's countdown and a race clear of each other, the results' caption).
`ART.md` (the racers: "a 44 × 52 button", "two rows of four below it, and in the column on a phone
on its side"; a phone on its side: the two rows and the plate's three sizes), `DESIGN.md` §12 and
`NOTES.md` decision 16 (which said the title packs the racers into one row so Race fits; Race has
its own row under the column and never scrolls away) say what is built.

**The regression proof** (the fix stages' way): `style.css` swapped for its copy from before the
follow-up (the landscape change off, nothing else different), `SCHEMES=light node tools/shoot.mjs
widths` exited 3 with 46 `ok` and 3 `FAIL`, exactly the new assertion at 844 × 390, 667 × 375 and
932 × 430 (`racer "Pip Marlow" 40×52 (hit 40×52)` and the seven others;
`regress-landscape-off.log`); restored, `cmp` clean against `style.final.css` (sha256 `ec0fb294…`).

**Should 2: shipped documents described what the fix stage changed.** Applied, documents only:

- (a) `ART.md`'s title frame draws About right after the name.
- (b) `NOTES.md` decision 13: the glide looks about 10° down, at the road 32 m ahead (`js/camera.js`
  `glide()`: 6 m up over the centerline, the target 32 m ahead and 0.6 m up; atan(5.4 / 32) is 9.6°
  on the flat).
- (c) The small countdown is 75 px: `style.css` sets `font-size: calc(var(--ch) * 0.75)` and
  `--ch: 100px` on an upright phone 600 px tall or less. The documents now say what the code does
  (`ART.md` section 3 and section 4's scale, `DESIGN.md` §11, and this file's after-review record,
  corrected in place with a note), because 76 px would cost a rule of its own and nothing argues for
  it. `shoot.mjs`'s widths scene now asserts the numerals: `75px` at 320 × 568, `96px` elsewhere.
- (d) `NOTES.md`: a refused Tilt "stays off, the note says "Tilt isn’t available here."" (U+2019),
  and the permission is asked "inside the tap on the title's Tilt word". The same word where
  `NOTES.md` still called the settings chips: decision 31 (every title control hits at 44 × 44 or
  more), 32 (a refusal turns the setting off), 39 (the Controls note); and `js/tilt.js`'s three
  comments, "chip" to "word" (0 B).

Found on the way, the same kind, corrected in place: `ART.md` gave the title plate as "about 400 px
tall" at 390 × 844 and "about 290 px" at 375 × 667 (`shoot.mjs` measures 501 and 272), and
`tools/check.mjs` "line 113" for the 3 MB bound (line 300); `NOTES.md` decision 33 quoted the stock
banners and warning, decision 40 put the drift hint "under the mini-map" (it sits under the
countdown's plate), decision 41 said the tagline "sits on a dark pill" (the house look removed it);
`DESIGN.md` §16 quoted the stock `Graphics were reset — tap to continue`. `NOTES.md`'s device checks
name the reticle beside the steering ring over Pinewood Pass's snow, as QA's nit 4 asked in this
file.

**Should 3: `ART.md` shipped the record of the pass.** Moved, word for word, into the section above:
"Bugs on record, and the stranger's run" whole, with its B1–B15 table; the opening's "before the
pass"; the title camera's row with "as today" and "at 21° down, 14 m ahead, it was two thirds
asphalt"; the blinks' sentence with "(they were 6 and 5 Hz)"; section 6's "Today" figures, the caps
table's app code row ("held at 220 070 B … until the build had measured") and the paragraph with
"the estimate before the build" and the ruling's arithmetic. In their place `ART.md` says what is
built: section 6 keeps the caps (the ZIP's derived from the ZIP before the pass, as World Oil & Gas
keeps it) and the as-built table, with the headroom HOUSE 8 asks for. `ART.md`'s opening says the
bugs B1 to B15 it cites are listed here, and "Where the record is" names what this file holds;
`NOTES.md` decision 43 points here for B1 to B15. The lead's grep (`grep -n -i -w -E 'was|were'
ART.md` and `grep -n -i -E 'before the|after the|since the' ART.md`) now finds only what is not
history: among them the design "it was built from", About's "how a race was kept on paper", "How it
was found" (HOUSE 5.1), the palette's step order "was found by trying", the string `Graphics were
reset`, the race's "After the places are updated", the camera's "before the still" and the ZIP cap's
"the ZIP before the pass".

Corrected in place rather than moved, because what they say stays and only the time word was wrong
once the pass was built: the stock comparisons that said "today" for the game before the pass (the
respawn fade's `#000`, the drift button's gold and mint, `LEFT` and `RIGHT`, "none ship today",
`NOTES.md`'s "No font" sentence, section 7's seven "Today: … After: …" rows, the strings table's
"Today" and "After the pass" columns, section 5's "After the pass") say "the stock game" and "As
built", as Shelf Atlas's and World Oil & Gas's shipped `ART.md` keep their stock comparisons; two
reasons in the past tense ("covered half the key", "22 % ran into the map") say what they guard
against ("would cover", "alone would run into"). "as today" stays where it states a behavior the
pass kept and the build still has. `ART.md` went from 60 702 B to 56 678 B.

**The nit: the race card's time and the title's record were read to VoiceOver as symbols.** Applied,
to every time the game draws for a reader: the race card's race time and `Last lap`, the title's
record row, and the results' lead (`of 8 in 1:52.985`), which the brief did not name and had the
same fault; the results' rows already had their words. Each drawn time is `aria-hidden`, with a
visually hidden twin after it (`.sr`, the live region's class) written through `spokenTime`
(`js/units.js`). A twin rather than `aria-label`, because ARIA 1.2 does not allow naming a `<span>`
or a `<p>` (the generic and paragraph roles), so a label there is not reliably read. The card's twin
begins with a comma, so the row pauses after the lap, as the live region's `Lap 2 of 3, 5th of 8.`
does. The card writes its twins in `Hud.text()` only when the drawn text changes, as it did (at most
30 times a second). Nothing drawn changed: the record row, the race card past its first lap and the
results' head, clipped in both themes from the final build and from `app-orig/`, are byte-identical
PNGs (`spoken-orig.log`, `spoken-final.log`, `clip-orig-*.png`, `clip-final-*.png`; run again after
the comma, which came after the first comparison, `spoken-now.log`). What Chromium's accessibility
tree reads (`ariaSnapshot`): `Best lap 41.000 seconds, best race 2 minutes 10.000 seconds, as Juno`
(it was `Best lap0:41.000 best race 2:10.000, as Juno`); `Lap 2 of 3 , 44.992 seconds` (it was `Lap
2 of 3 0:44.992`; Chromium joins the two spans with a space, so one stands before the comma, which
speech does not voice); `Last lap 38.918 seconds` (`Last lap 0:38.918`); `5th of 8 in 1 minute
53.175 seconds` (`5th of 8 in 1:53.175`). `shoot.mjs` asserts each twin against its own words for
the drawn figures (`look-race` once the first lap is done, `look-results`, `reload`). **Cost
705 B**: `index.html` 123 (three `aria-hidden` and three twins), `js/hud.js` 219, `js/main.js` 363 (the
record row 258, the results' lead 105).

**The regression proof for the nit**: `index.html`, `js/hud.js` and `js/main.js` swapped for their
copies from before the follow-up (the twins off), `SCHEMES=light node tools/shoot.mjs reload
look-race look-results` exited 3, every check passing but exactly the three new ones: the record row
(`… in words for VoiceOver ("null")`), the race card (`"0:51.992" as "null", "Last lap 0:48.548" as
"null"`) and the results' lead (`"of 8 in 1:49.839" as "null"`) (`regress-spoken-off.log`);
restored, `cmp` clean (`index.html` sha256 `febae906…`, `js/hud.js` `40ae180f…`, `js/main.js`
`1477309e…`). The test's own `words()` agrees with `spokenTime` on 114 286 times from 0 to 400 s,
measured and projected (`words-check.mjs`, throwaway, the only place the two meet).

**Budgets.** App code 241 876 B to **242 655 B** (+779: the must 74, the nit 705, `js/tilt.js` 0),
against the lead's 244 000 B: 1 345 B of headroom, within 5 % (HOUSE 8), so anything the game gains
next, it pays for. Fonts 40 075 B. The ZIP 620 559 B to **619 349 B** (cap 720 806): `ART.md` lost
4 024 B, `NOTES.md` gained 746 and `DESIGN.md` 57.

**The tools' last runs** (2026-10-02, from `Template/snug-kart/` unless stated; headless Chromium is
layout and pixel evidence, never phone evidence):

- `node tools/check.mjs`: 44 `ok`, 0 `FAIL`, last line `all checks pass`; app code 242 655 B (cap
  244 000), fonts 40 075 B, ZIP 619 349 B (cap 720 806), both data files' sha256 the values recorded
  before the pass (`check-final.log`). `data/` and `vendor/` hash as they did before the follow-up
  (`data-vendor-before.sha`).
- `node tools/test_chart.mjs`: `kart.gates equals the test's own record for 240 of 240 karts in 30
  races`, `the order changes 49.3 times, the chart shows 38.5 crossings; your place changes 14.1 times
  and the chart sees 8.1`, last line `all checks pass` (`test_chart.log`).
- `node tools/sim.mjs standard 3`: last line `sim: all assertions pass`, and its output equals
  `tools/.work/sim-baseline-standard-3.txt` once the nine `in N ms` timings are masked (`cmp` clean;
  `sim-standard-3.txt`).
- `node tools/items.mjs`: last line `items: all pass`, its output equal to
  `tools/.work/items-baseline.txt` (`items.log`).
- `python3 snug-kart/tools/art/palette.py` from `Template/`: last line `ALL CHECKS PASS`
  (`palette.log`).
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: exit 0, 211 `ok`, 0 `FAIL`, `451
  requests, 0 outside the app`, last line `no console errors; all checks pass`, both themes
  (`shoot-full.log`). The title's plate 501 px tall at 390 × 844; text contrast lowest 6.61 (light)
  and 6.92 (dark); the Lap Chart's ink, 10th percentile 16.40 and 12.87; the halo marks over Pinewood
  Pass, light reticle 4.80 (lowest 2.56) and steering ring 3.67 (1.98), dark reticle 3.67 (2.48) and
  steering ring 6.97 (1.88); per frame on High 31 / 30 / 31 calls and 29 544 / 105 026 / 63 828
  triangles, unchanged; the widths scene at eight sizes, the numerals `75px` at 320 × 568;
  `screenshots/app.png` untouched (`6568ae797c44…`). The follow-up's first full run
  (`shoot-full-1.log`) exited 3 with 209 `ok` and two `FAIL`, both my new `look-race` check, which
  asked for `Last lap` 24 s after the scene turns the autopilot off, before the player had finished a
  lap (`"0:47.992" as ", 47.992 seconds", "" as ""`: the twin right, the premise wrong); the scene
  now drives on autopilot until a lap is done, and the run above is the one after that change.

**Owner calls as they now stand** (each still the owner's to reverse):

- **The code cap**: 244 000 B with Tilt kept (D20), 1 345 B left after this follow-up.
- **The off toggles' wording**: `Sound` and `Tilt` keep their names when off (the word in `--ink-2`
  at 400, no tracer, `aria-pressed="false"`), so the accessible name never changes; the alternative
  is `Sound off` and `Tilt off`. Seeding the note band so it is never empty is the same kind of call.
- **About right after the name**, against HOUSE 4.2's place at the header's right for a game,
  because in Snuggery's full screen on iOS 18 the 44 pt exit control sits 16 pt inside the top-right
  corner and would cover half the key. On iOS 26 the control sits in the status-bar band, so the
  house's place would be clear there; iOS 18 is Snuggery's floor.
- **The title camera's aim**: about 10° down at the road 32 m ahead, so the plate shows the track's
  scenery to the horizon; Harbour Loop's start straight is open on one side, so its title shows more
  sky than the other two.
- **The Lap Chart echoed on the title**: not built. It would cost code against 1 345 B of headroom,
  so it needs a raise of the cap or a cut.
- The art pass's calls, unchanged (section 9 of `ART.md` as it stood, above): **the speed lines**
  removed; **the banners' voice** (`Hit by a paper plane` for `Paper plane!`); **the tagline**
  removed; **Pip's tone** darker than its kart in the light theme; **`Harbour Loop`** kept as the
  data's name; **each track's one appearance** in both themes; **Drift and Item as square key
  plates**.

**For the lead, outside this folder**: `HOUSE.md` §8 cites `snug-kart/tools/check.mjs` "line 113"
for the 3 MB bound (it is line 300) and its budget table still gives Snug Kart's figures before the
pass (546 378 B and 220 070 B, over): after the pass and this follow-up they are 619 349 B and
242 655 B of 244 000 (D20), fonts 40 075 B. The camera's one string, the button `Race`, is unchanged
in text and role (`check.mjs` 9, `look-title`), so the camera needs no change; no shot it takes is
on its side (`grep -n -i "landscape\|orientation" Tests/SnuggeryUITests/Marketing*.swift`, from the
repository's root, prints nothing). `SCREENSHOTS=1` rewrote `title`, `race`, `results` and `paused`
in both themes (the title's glide and the simulated race differ run to run; the drawn times are
byte-identical, above); `about-*` and `app.png` kept their bytes.

**Phone checks** (none claimed; each needs the device and iOS version it names): on iOS 18 in
Snuggery's full screen, the About key opens with the exit control showing; the recovery blink at
3 Hz and the Reduce Motion half form at the kart's real size; VoiceOver on pause (lands on Resume,
then back on Pause), on the results (the sentence, the lead and the rows in words) and on the race
card's two times in words; frame time on Pinewood Pass at High through a full race against the build
before the pass; the reticle's and the steering ring's halo over Pinewood Pass's snow in the dark
theme; the title on its side, its two rows of faces under a thumb, on an iPhone SE (667 × 375) and
on a notched iPhone, whose side insets the emulation above only assumed; the safe areas of every
band with the status bar showing.
