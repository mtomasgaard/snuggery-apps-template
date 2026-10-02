# Milky Way: decisions, as built, and the record of the house pass

Not shipped (`tools/` stays out of the ZIP). `ART.md` is the direction; this file is what the
build did with it, what it could not settle, and what is owed. Plan 0011 package B, 2026-10-01.

---

## 1. Verification, as it stands

**Run, with what they printed (before the harness stopped execution; see section 7):**

- `python3 milky-way/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
  `--json` pasted into `js/plate.js` by the shell, not retyped.
- `tools/art/font_extra.py`, run twice with fonttools 4.60.2 (scratch venv): both times
  `fonts/ysabeau-office-milky-way-extra.woff2 5620 B sha256 efdeac3fc405906974460b62b3e3b0c606da4f87c80346b1c7d0c32ca068e42f`;
  `cmp` identical.
- `shasum -a 256 fonts/*` after the copy: `d1adfffd…be6269` OFL.txt, `fdf1a28c…cdb262` the house
  face, `efdeac3f…e42f` the supplement. `cat fonts/* | wc -c`: 45 695 B.
- Before any change: `find data -type f | sort | xargs shasum -a 256 | shasum -a 256` gave
  `a9c72c1265e69f1dfa9b70c3f93c97d99a015089e61ade0e767ead511807d4a1` (ART.md's `a9c72c12…07d4a1`);
  the 33 per-file sha256 are pinned in `tools/check.mjs`. No file in `data/` was written by this pass.
- The decoders' positions at three epochs, recorded before any change by a throwaway script
  (`tools/.work/pass/baseline.mjs`), are the constants in `tools/test_decode.mjs`.
- `node --check` on `app.js` and every `js/*.js` after the US-spelling sweep: all passed.
- Two headless smoke runs of the rebuilt app (`tools/.work/pass/smoke.mjs`, Playwright's Chromium,
  390 × 844, DPR 2, SwiftShader WebGL), light then dark: the app booted, the caption read
  `You are 7.50 AU from the Sun; … none lie between 160 AU and 1.30 pc.`, the Solar System,
  Saturn-with-card, Neighborhood and Milky Way scenes rendered, and the only console messages were
  four `GPU stall due to ReadPixels` performance warnings from the screenshot reads. Headless
  Chromium is not phone evidence.

**Superseded.** The builder could not run `node tools/check.mjs`, `node tools/test_decode.mjs` or
`shoot.mjs` (section 7). QA ran all three, the reviewer ran them again, and the fix stage ran them
after its changes: each run, with what it printed, is in section 8.

---

## 2. Budgets

| | Before the pass | After | Cap | Command |
| --- | --: | --: | --: | --- |
| App code (`.html`, `.css`, `.js` outside `vendor/`, `data/`, `tools/`) | 223 463 B | **241 813 B** after the follow-up (239 950 B after review, 239 674 B after QA, 239 566 B before) | **242 000 B**, the lead's second ruling below (240 000 B the first; 223 463 B held, plan 0011 D5) | `node tools/check.mjs` (item 16) |
| Fonts | 87 680 B | 45 695 B | 160 000 B | `cat fonts/* \| wc -c` |
| ZIP, as `build-zips.yml` packs it | 6 525 210 B | 6 520 687 B after the follow-up (6 517 000 B after QA) | 8 156 512 B | `node tools/check.mjs` prints it |

**The code is 16 103 B (7.2 %) over the held cap. This is owner call 1.** What the house costs
here, by file: `js/units.js` 4 265, `js/track.js` 5 953, `js/rule.js` (the Reach) 3 992,
`js/plate.js` 1 319; in `app.js` and `index.html`, focus mode, the three sheets as dialogs, About's
four sections built from the data, the card's figure and placement, the census, the player and the
test hook. What was paid: `util.js`'s formatters and dead helpers (2 707 B), the stock stylesheet
replaced (1 857 B net), the stock HUD ruler, view shift, loading overlay and timing hook, the dead
`makeLine` export, ART's trim (4) (the zoom keys), and the decoders' header comments condensed to
pointers into `tools/CONTRACT.md`, which documents the same formats in full (about 5 200 B,
comments only). ART's trims (1) (one canvas helper shared by the Reach and the track) and (3) are
not done: (3) is how About's list was built from the start, and (1) changes code that could not be
run again in this session. HOUSE.md section 8 forbids stripping comments to fit, so the pass
stopped there, as ART.md section 6 says to, with the figure. Options for the owner: raise the cap
to about 240 000 B (7.4 %), with this file's reason; or name what goes (the year keys, the
speed key's five exposures, the Layers sheet's descriptions, the Bayer spelling in Find).

---

## 3. The camera (HOUSE.md section 7.4)

Every string the camera reads survives, with its role:

| String | Where now | State |
| --- | --- | --- |
| visible text containing `from the Sun` | the caption's first sentence, written by the frame loop once the data is in | kept; no static text before About contains the phrase (the canvas's name avoids it; the Reach's name is written only after load) |
| `Solar System`, `Milky Way` (the lowest so named) | the header's scale words, `<button aria-pressed>` | kept; the `h1` is not a button and sits above them; nothing below carries those exact names (the plate's labels are `aria-hidden`; the Layers sheet's group heads are hidden while the camera taps) |
| `Neighborhood` | the middle scale word | **US spelling** (D5 (3)); `MarketingClipsUITests.swift` line 53 already reads `milkyWayScale("Neighborhood")` on this branch: no camera change is owed |
| `Play` (`Pause` while playing) | the transport's solid key, at the Solar System scale only, as before | kept |
| `Show the controls` | the ghost key of the new, remembered focus mode (`milkyway:focus`) | `waitForMilkyWay()` already calls `showControlsIfHidden()` (`MarketingCameraCase.swift` line 433): no camera change is owed |

Flights keep `js/view.js`'s own durations (900 to 3 200 ms), so the camera's fixed waits stand;
loading gained nothing. A touch during a flight now lands it at once (a new behavior: the camera
never touches mid-flight).

---

## 4. Owner calls left open (ART.md section 9, as built)

1. **The code cap**: section 2.
2. **A units key** (pc and light-years): not built. Distances are in km, AU, pc, kpc and Mpc; stars
   and the galaxy's objects add light-years under the card's figure.
3. **The Sun's glow and the points' soft halo** kept as the plate's display effects
   (about.json's `reading-glow` says so).
4. **Small bodies in four orbit groups** instead of ten class colors (the card names the class).
5. **Neutral orbits, trails and markers** instead of a hue per planet.
6. **The on-screen credit line**: `NASA/JPL, USGS, ESA/Gaia/DPAC, AT-HYG, LVDB, galstreams,
   Stellarium` (ART's proposal); every source stays in About.
7. **The speed key written as exposures** (`1 s = 7 d`).
8. **`data/about.json` keeps two stale blocks** (the old ruler, the old faces) until the next
   pipeline run; the app does not show them, and `tools/90_about.py` already writes their new
   text. `CREDITS.txt`'s "SOFTWARE AND FONTS" section was edited by hand to what the edited script
   writes there. **Checked after review** by running it: from `tools/`, importing `90_about.py` and
   joining the section's four paragraphs as `main()` does (`textwrap.fill(…, 98)`) printed
   `the whole SOFTWARE AND FONTS section, as main() writes it, found verbatim in CREDITS.txt: True`.
   **Settled in the follow-up**: the pipeline wrote `about.json` and `CREDITS.txt` again (section 9).
9. **The plate stays night in the light theme.**
10. **Focus mode hides the Reach** with the legend slot, as HOUSE.md section 4.10 says. After
    review the caption there leaves out the Reach's sentence too. The other road stays open: keep
    the Reach in focus mode, which keeps the signature in the mode the owner photographs (an
    estimated few dozen bytes: drop `$('reach')` from the list that leaves, and the caption's
    `!S.focus`).
11. **The caption is three lines high below 640 px.**
12. **The search field at 16 px**, the one size off the scale.
13. *New:* **the zoom keys are gone** (ART's budget trim 4). Pinch, double-tap and the scale words
    still move the view; the key column is Find, Layers, Hide the controls. **Restated after
    review, as an accessibility call, not a budget trim:** without them there is no way to zoom out
    with one finger or a keyboard. The double-tap only zooms in; zooming out takes two fingers or
    one of the three fixed scale words (or Find). That conflicts with WCAG 2.5.1 (Level A, pointer
    gestures) for the app's one continuous zoom, and with HOUSE.md section 4.4, which puts Zoom in
    and Zoom out first in a 3D view's column. Restoring them costs an estimated 430 B (the plate's
    markup, two marks and two listeners on the `zoom()` helper still in `app.js`) against 50 B of
    headroom. The choices: raise the cap to about 240 500 B; pay with the Bayer spelling in Find
    (716 B measured, `awk` over the `GREEK` table and `spellBayer`: a star would no longer be found
    by its letter's name, such as `alpha` for `α¹ Cen`); or keep the keys out. A cheaper half (an
    estimated 75 B): `+` and `−` on a keyboard, which helps keyboard users and not one finger.
    **Settled in the follow-up** (the lead's second ruling): the keys are back, at the head of the
    column's first plate (section 9).
14. *New:* **the clock moves out of the date into the lead below 440 px** (ART said 360 px): at
    390 px the date, the clock, the speed key and Now did not fit one row in an estimate from the
    smoke screenshot; not measured at other widths in this session.

15. *New, after QA; scope restated after review:* **British spellings shown from `data/`**, in
    About and on the card. The card shows data text too: the maps' and colors' notes
    (`tex/textures.json`), the galaxy's references and notes (`galaxy/galaxy.json`), the small
    bodies' sources, the stars' distance sources. `check.mjs`'s note now counts both
    (`91 in About (data/about.json) and 9 in strings the card can show (tex/textures.json 4,
    galaxy/galaxy.json 5)`); the Sun's card, for one, reads `coloured by the TSIS-1 spectrum`. The
    fix stays the same: sweep the pipeline scripts and run the pipeline. Before review this read:
    **British spellings shown in About.** `data/about.json` is pipeline output
    that this pass keeps byte for byte, and About renders its prose verbatim, so the intro and the
    dataset blocks still show `colour`, `grey`, `catalogue`, `modelled`, `neighbourhood`, `disc`,
    `centre` and the like on screen: `node tools/check.mjs` counts 91 and prints the figure as a
    `note` line every run. `tools/90_about.py`'s own blocks (the intro, `reading-brightness`,
    `reading-glow`, `not-shown`, the shapeless-moon sentence) were swept to US English in this pass,
    and `check.mjs` now fails if they regress; the dataset blocks' `text`, `source` and `accuracy`
    come from the other pipeline scripts (`solar_sources.py`, `galaxy_sources.py`,
    `smallbodies_sources.py`, `texsky_sources.py` and others), which still write British spelling.
    The owner's call: sweep those scripts and run the pipeline (which rewrites `data/about.json`
    and `CREDITS.txt`), or accept the spelling until the next data refresh. Proper names keep
    theirs (the Open Exoplanet Catalogue, ESA's NEO Coordination Centre and Planetary Defence
    Office). **Settled in the follow-up**: the pipeline's prose swept and rebuilt; 0 on screen,
    and a check now (section 9).
16. *New, after review:* **the card's height.** At most 34 % of the plate and at least 144 px,
    its keys held at its foot. On plates from 399 px tall a globe flown to stays clear of it; on a
    375 × 667 phone the floor wins and the card covers about 12 px of the disk's lower edge, and
    Saturn's rings can pass under it at any size. A view offset under the card (the stock
    `wantedShift`) would clear both at every size, for an estimated 500 B. **Settled in the
    follow-up** (the lead's second ruling): the offset is built, about 1 050 B (section 9).
17. *New, after review:* **About still says marker colors "are not data".** `data/about.json`'s
    `reading-glow` block predates the four orbit groups. The Layers row now names the four colors,
    and `tools/90_about.py`'s `reading-glow` text now says that a marker's color names its category
    (US English, checked by `check.mjs`). The block on screen changes when the owner runs the
    pipeline, the same refresh as 8 and 15. Hiding the block instead would drop its true parts too
    (the Sun's glow, the display tints, the Gaia stretch, the neutral gray), and writing them in the
    app costs an estimated 450 B. **Settled in the follow-up**: `reading-glow` now says what the
    colors name (section 9).
---

## 5. As built: departures from ART.md, each with its reason

- **The caption's first sentence** reads `You are 9.43 AU from the Sun; the screen spans
  353 600 km there.` (ART: "is … across there"): six characters shorter, so the longest caption
  fits three lines at 320 px and one line on a phone's side. The camera's words are unchanged.
- **Significant figures round.** The stock `sig()` printed every digit of a large integer
  (`353 559 km` at four figures); `js/units.js` rounds to the figures it claims (`353 600 km`).
- **The card's figure.** Planets, moons, small bodies, stars, clusters, satellites and the frame's
  origin: the distance from the Sun (the Sun: from the Earth, with its light time). The galaxy's
  Sun: from the Galactic center. Streams, arm fits and the mass model have no single distance and
  show none; their rows stand.
- **innerHTML.** Down from 7 uses to 2: the labels' constant markup and the Layers sheet, every
  value escaped; the card, the search results and About are built with DOM calls.
- **Fetch errors are sentences**: `util.js`'s `getJSON` and `getBin` throw
  `data/x.json could not be read (HTTP 404)` and `… is not valid JSON; it looks like a web page was
  written over it` (or `, or it was cut short`); the notice adds `The app's files are incomplete:
  install its ZIP again.`
- **About's sources** render about.json's `intro` and each dataset block field by field (`Owner:`,
  `License:`, `Retrieved:`, `Address:` with the scheme removed), the values verbatim.
- **The US-spelling sweep** renamed code identifiers too (`colour` variables, `centreline`,
  `centreKey`, the solar orbits' `centre` field), but never a data key or a name the pipeline's
  own tests call (`planetCentre`, `moonFromCentre`, `pixelCentre`, `labelled`, `named.colour`,
  `textures.colours`, `quantisation_pc`, the `licence` key) nor the stored camera target id
  `gal:centre` (a saved view would otherwise be lost). In the four decoders only comments changed.
  One dead fallback key in `js/galaxy.js` became `thin_disk` (the data has neither spelling; it
  reads `thin`).
- **One data-facing string changed in a decoder**: `js/smallbodies.js`'s card source line
  `. Physical values — …` became `. Physical values: …` (tell 7). Positions are untouched
  (`tools/test_decode.mjs` pins them).
- **The Layers mark** was three nested arcs over a dot, which the review read as a Wi-Fi glyph; it
  is now three flat planes stacked (16 px, 1.5 px strokes).

---

## 6. Phone checks for the device matrix (none claimed)

On an iPhone with iOS 18 or later (the owner's), in Snuggery's full screen:

- frame time idle, during a flight, while playing and while scrubbing the track;
- memory after five minutes; background and return (the loop stops; the return redraws);
- the labels' halo: `paint-order: stroke fill` with `-webkit-text-stroke` on HTML text in WebKit
  (fallback in ART.md if WebKit paints the stroke over the glyphs);
- focus mode: the ghost key and Snuggery's own exit control both reachable in the top-right
  corner; the ghost key under the status bar;
- VoiceOver on the track (`Thursday 1 October 2026, 16:03 UTC`), the Reach's name, a tap's
  sentence, the three sheets;
- the phone on its side; every band's safe area;
- the supplement's Greek letters in Find and on star labels (`α¹ Cen`, `ʻOumuamua`);
- *after review:* the credits line clear of the home indicator at the Neighborhood and Milky Way
  scales, upright and on its side, in focus mode too; Find raising the keyboard on its first tap;
  the card at 375 × 667 (its keys, and the disk's edge under it); frame time while scrubbing and
  while playing at `1 s = 365.25 d`, where the Reach's Solar System census is taken again on every
  drawn day (headless: 0.7 ms on this Mac for the full 230 000-value census in Node, which the
  cached columns now spare; not phone evidence); VoiceOver on the speed key (`Playback speed, now
  1 s = 7 d`, then `7 days a second`).
- *after the follow-up:* the flights from the Neighborhood to the Milky Way and back, and from the
  Solar System to the Earth, in Snuggery's web view: no frame filled with one color (the bug was
  seen on the phone, on WebKit; headless Chromium reproduced it and shows it gone); the zoom keys'
  reach on the phone (the fling's size depends on the frame rate: about ×2.8 a press at 60 fps,
  ×3.4 in headless SwiftShader) and VoiceOver on `Zoom in`, `Zoom out`; the picture shifting below
  an open card after Fly there, on a 375 × 667 phone too, and on its side; after a load failure,
  VoiceOver passing the inert stamp and reading the notice.

---

## 7. Process: execution stopped mid-pass

Partway through, the session's harness began refusing every command that runs code (node,
python, Playwright), with "Auto mode could not evaluate this action", while read-only commands
(`wc`, `grep`) and file edits went on working. So the three tools were written but never run, and
these edits were made after the last successful run (the dark smoke run) and were checked only by
reading them back:

- comments only: the headers of `js/ephem.js`, `js/smallbodies.js`, `js/galaxydata.js`,
  `js/rotation.js`, `js/stars.js`, `js/galaxy.js`, `js/solar.js`, `js/gfx.js`, `js/view.js`, `app.js`;
- `js/gfx.js`: the unused `makeLine` export removed (no file imports it);
- `js/smallbodies.js`: the one string above;
- `index.html`: the zoom keys' plate removed; About's first section shortened;
- `app.js`: the zoom keys' two listeners removed; `deepN` replaced by `stars.deepCount`;
  `censusJd` recorded for the test hook; the caption's "spans"; the hook's `point(id)`;
- `styles.css`: `.lead` may shrink (`min-width: 0; overflow: hidden`) so the time row never
  widens the page at 320 px.

The lead should run `node --check app.js`, the three tools, and look at the pictures before
committing. A process note too: the art director's summary records one read-only `git` command
(`git check-ignore`) run against the rule; this pass ran none.

---

## 8. Review record

### QA, and the builder's fixes (2026-10-01)

QA ran `check.mjs` (2 failures), `test_decode.mjs` (pass) and `shoot.mjs` twice; its findings and
what was done with each:

- **must, the code cap** (239 566 B against 223 463 B): settled by the lead's ruling at the end of
  this file, 240 000 B, written into `check.mjs` item 16 and ART.md §6. After the fixes below,
  239 674 B: 326 B to spare.
- **must, `0.9 kpc` with a plain space** in the Drimmel arm fit's note (`app.js`): now
  `0.9\u202Fkpc`, the escape `js/rule.js` uses. +5 B.
- **must, the SI scan reading GLSL as text** (`vec2 d` as "2 d", four hits in `js/gfx.js`):
  `check.mjs`'s `strings()` drops the template literals tagged `/* glsl */` before it strips
  comments (the tag is a comment, so it had been stripped first and the shader read as a string).
  Regression run: with the note's plain space put back, item 11 fails on exactly that string and
  nothing else; restored, it passes.
- **must, British spelling in About**: not fixable in the app without changing `data/`; owner call
  15 above. Done in this pass: `tools/90_about.py`'s own blocks swept to US English (`python3 -m
  py_compile` passes), a `check.mjs` check that they stay so (it fails on the pre-sweep file, run
  and restored), and a `note` line that prints the count still on screen (91).
- **must, the speed key's hit area 63 × 35.5 px**: the time row was 32 px with 4 px of top padding,
  and the track (positioned, later in the DOM) paints over whatever reaches below the row. A probe
  of `elementFromPoint` down the key's center showed the speed key's expander cut at the track's
  top, and `Now`, whose 44 px box made `shoot.mjs` skip the probe, covered by the track for its
  bottom 8 px too. The row is now 44 px with no top padding (the padding box of `.wordkey` is 26 px,
  so its `inset: -9px` expander spans exactly 44 px of border box); the probe now reads 44 px for
  both at 390 × 844, 320 × 700 and 844 × 390. `shoot.mjs`'s hit-target check now probes every
  control, even one whose box is already 44 px. Cost: 12 px of plate at the Solar System scale.
- **should, play's 60-frame floor**: a frame rate in disguise, which HOUSE.md §7.2 says fails
  nothing. Now at least 12 frames in the 3 s (so the per-frame checks have frames), with the frame
  time still printed as a headless trend. Measured: 32 frames, median interval 112.8 ms.
- **should, the touch during play landing on day 156 once**: the check read the state 120 ms after
  the touch, while SwiftShader draws a frame every 113 to 140 ms here; `playing false` with the old
  day is exactly a read before the next frame. It now reads at the end of the next animation frame
  (the app's loop callback is registered before the test's, so it has drawn). Three full runs
  after the change: day 30, playing false, each time.

Runs after the fixes (headless Chromium is not phone evidence; frame times are SwiftShader's):

- `node tools/check.mjs`: `all checks pass` (plus the owner-call-15 `note` line).
- `node tools/test_decode.mjs`: `all checks pass`.
- `node --check` on `app.js`, every `js/*.js`, `tools/check.mjs`, `tools/shoot.mjs`: no output.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`, then twice more without
  `SCREENSHOTS`: `all checks pass` all three times, exit 0; `hit targets ≥ 44 × 44 px: 13
  controls`, `focus mode's hit targets ≥ 44 × 44 px: 8 controls`, `play at 7 days a second: 32
  drawn frames over 20.5 days`, `a touch on the track during play … day 30 (want 30), playing
  false`. `screenshots/*-{light,dark}.png` were refreshed by the first run.

### Review, and the fixes (2026-10-01)

The reviewer's verdict was *fix*: one must, eleven shoulds, eight nits. What was done with each:

- **must, the credits under the home indicator** at the two scales without a player: fixed,
  `.caption:has(+ [hidden])` pads for `env(safe-area-inset-bottom)` (`styles.css`). Headless
  Chromium has no safe areas; `shoot.mjs` checks the rule applies exactly when the player is gone.
  The inset is a phone check (section 6).
- **should, the Reach held a year's first census**: fixed; the Solar System part is taken again on
  every newly drawn day (`app.js` `solarCensus()`), the fixed lists' columns cached per width
  (`js/rule.js`). `shoot.mjs`: 30 Dec and 2 Jan of one year, each `taken at the instant shown true,
  0 columns off this file's decode`.
- **should, the focus-mode caption**: fixed (the Reach's sentence leaves with the Reach; owner call
  10's other road recorded). `shoot.mjs` asserts the caption in focus mode.
- **should, the card over its globe, its keys scrolled away**: fixed at the reference size and
  above 399 px of plate: height at most 34 % (at least 144 px), the keys sticky at its foot, the
  placement rule counting the disk. `shoot.mjs` now tests the disk, worked out from
  `data/physical.json`, not the center: `saturn (disk 65 px) clear, key in view; jupiter … earth …`.
  Below 399 px the floor covers the disk's edge (owner call 16); the view offset that would not is
  an estimated 500 B, declined on bytes.
- **should, Venus unlabeled**: fixed by framing the Solar System scale from the plate (4.80 AU at
  390 × 844) and drawing the Sun's stepped-aside label without its point mark. `shoot.mjs`: `the
  inner planets on screen at boot are labeled: earth labeled, mercury labeled, venus labeled, mars
  labeled`.
- **should, the zoom keys**: declined in this pass on bytes and put to the owner as an
  accessibility call (owner call 13, restated with WCAG 2.5.1 and the costs).
- **should, About scrolling sideways**: fixed (`overflow-wrap: anywhere` on About's paragraphs);
  `shoot.mjs`: `its body 390 px wide in 390`.
- **should, `units.js` at the rounding boundaries**: fixed (round first; the unit chosen from the
  rounded value); ten new cases in `test_decode.mjs` (`25 cases in SI notation`).
- **should, the speed key's name**: fixed, `Playback speed, now 1 s = 7 d`, described by a hidden
  sentence, `7 days a second`; `shoot.mjs` checks all five.
- **should, the Layers mark read as Wi-Fi**: redrawn as three flat planes stacked.
- **should, colors as data with no key**: the Layers row for asteroids and comets names the four
  colors; `tools/90_about.py`'s `reading-glow` text rewritten to match (pipeline content only; the
  pipeline was not run, `data/about.json` is unchanged); the sentence on screen waits for the data
  refresh (owner call 17).
- **should, British spelling's scope**: restated (owner call 15) and counted: `check.mjs`'s note
  now covers the card's data strings too (`91 in About … and 9 in strings the card can show`).
- **nits taken**: exoplanet rings a guide at 0.35 (`palette.py` `host #61e8a8 at 0.35: 2.34 (>=
  1.3) ok`, `js/plate.js` pasted from `--json`); one formatter for the year spans and one count of
  stars placed in 3D in Layers, About and the moons' card note (About's static text says 1900 to
  2099 to match); with data missing, the scale words, keys and player leave (`shoot.mjs`, all three
  broken-data cases); Find focuses inside the tap and drops the native search look; `role="img"`
  on the 3D canvas; DECISIONS section 1 and owner call 8 brought up to date (8 checked by running
  it); ART §1 now says the ruler runs past the zoom's ceiling.
- **nits declined**: `you` at the notch (bytes); caching the four rectangles the labels avoid
  (bytes; frame time is a phone check).
- **paid for** (no function removed): the unused `stats` and `invalidate` members of the test
  hook; one vertex shader for the galaxy's two flat layers (`js/gfx.js`); one fetch helper
  (`js/util.js`); `bodyKind`, `satKind`, `armKind` shared by the card and Find; `css` and the
  label face exported by `track.js` for `rule.js` (ART's trim 1, in part); fields nothing read in
  `solar.js` and `stars.js` (and `drawnCount`, now that Layers counts stars placed); a dead label
  opacity line (`js/labels.js`); the `CAT` table inlined.

Runs after the fixes, from `Template/milky-way/` (headless Chromium is not phone evidence; frame
times are SwiftShader's on this Mac):

- `node tools/check.mjs`: `all checks pass`, with `ok   app code 239,950 bytes (cap 240,000, …; 50
  to spare)`, `ok   fonts/ 45,695 bytes (budget 160,000)`, `ok   ZIP size 6,519,522 bytes (budget
  8,156,512 …)` and the owner-call-15 note.
- `node tools/test_decode.mjs`: `all checks pass` (`js/units.js: 25 cases in SI notation`; the
  census at six widths, 0 columns differ).
- `python3 milky-way/tools/art/palette.py` (from `Template/`): `ALL CHECKS PASS`.
- `find data -type f | sort | xargs shasum -a 256 | shasum -a 256`:
  `a9c72c1265e69f1dfa9b70c3f93c97d99a015089e61ade0e767ead511807d4a1`, the digest before the pass.
- `node --check` on `app.js`, every `js/*.js`, `tools/check.mjs`, `tools/shoot.mjs`,
  `tools/test_decode.mjs`: no output.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs` (scrub included), then `SCREENSHOTS=1` the same:
  `all checks pass` both times, exit 0, 76 `ok` lines; play's interval median 114.1 ms (headless);
  `screenshots/app.png … untouched: 7981ec844480…`. `screenshots/*-{light,dark}.png` were
  refreshed by the second run.
- The fix stage's own probe (`tools/.work/fix/probe.mjs`, pictures in `tools/.work/fix/shots/`)
  drove the card at 375 × 667, 844 × 390 and 320 × 568 as well (no test asserts those sizes).

## 9. The follow-up (plan 0011 D9, 2026-10-01)

One Opus builder, after the final review, on the items the pass left for the lead. Commands run
from `Template/milky-way/` unless they say otherwise; headless Chromium is never phone evidence.

### 1. The lead's second ruling, spent: the zoom keys and the view offset

- **The cap is 242 000 B** (the lead's second ruling, at the end of this file; `check.mjs` item 16;
  ART.md §6). The two items it was granted for cost about 1 600 B together (the keys about
  560 B: the markup, two marks, two listeners on the `zoom()` helper; the offset about 1 050 B), so
  they fitted it; the rest of the follow-up (the flight path, the label fallback, the Find field's
  cross, the stamp after a failure) was paid for in place, with no function removed and no comment
  stripped: the four hand-written vector differences in `app.js` now use the `vlen(vsub(…))` it
  already imports, and the four hand-written year expressions the `yr()` it already defines (both
  give the same numbers); the six key rules' centering said once in `styles.css`, and the card's
  and About's `dl` grid once; `loadTexture()`'s `srgb` option, which nothing passed; `stars.update()`'s
  unused `extent` parameter and a stale comment in `galaxy.js` naming a parameter that does not
  exist; the new comments written short; and, once the rebuild had written About's two blocks
  again, the comment in `app.js` that called them stale says why About leaves them out.
  **241 813 B, 187 B to spare.**
- **(a) Zoom in and Zoom out are back** (owner call 13, WCAG 2.5.1), at the head of the column's
  first plate, above Find and Layers. One plate, not ART's two: three plates (242 px) did not fit
  the 255 px plate of a 320 × 568 screen (an iPhone SE with Display Zoom), so the keys ran as a row
  along the plate's top and an open card covered the zoom and Find keys; the merged column is
  232 px. Each press calls the `zoom()` the empty-space double-tap uses: it lands a flight in
  progress first, then sets the zoom fling (about ×2.8 a press at 60 fps; at once and exactly
  e^1.04 under Reduce Motion).
- **(b) A view offset keeps a globe flown to clear of its card at every size** (owner call 16).
  While the card is open on the object the camera is aimed at (Fly there, a double-tap, Find), the
  picture shifts it to the middle of the plate the card leaves free: down by half the card's
  height on an upright phone, right by half its width on a wide plate. The stock app's
  `wantedShift` fitted to this layout: `setViewOffset` on the three cameras, the same shift in
  `project()` so labels and taps agree, eased over about 90 ms (at once under Reduce Motion). An
  object merely tapped keeps the card's own rule (the card moves to the foot when it would cover
  it); the two never act on the same object, so they cannot chase each other.
- `shoot.mjs`, the last run below: `the zoom keys: Zoom out by touch takes the camera from 4.80 to
  16.1 AU of its target (×3.36); from the keyboard, Zoom in ×0.29 and Zoom out ×3.45` (the fling
  carries further at SwiftShader's frame rate than the 2.8 of 60 fps, and a little differently
  from run to run); `Reduce Motion: Zoom out is
  one step, at once: ×2.829217 (want e^1.04 = 2.829217)`; and, each globe flown to with its card
  open, its disk from `data/physical.json` and the camera's distance, Saturn's rings as the circle of
  the A ring's outer edge (136 780 km), clear of the card and the keys and inside the plate:
  `390 × 844: … saturn (disk 65 px, rings 149 px) clear and on the plate, key in view; jupiter (disk
  65 px) …; earth (disk 65 px) …`, `375: … saturn (disk 44 px, rings 101 px) clear and on the
  plate …`, `320: … saturn (disk 30 px) …` and `844 × 390: … saturn (disk 28 px) …`. Saturn's rings
  are not asserted at 320 × 568: their bounding circle (70 px) does not fit a 255 px plate under a
  144 px card, though the drawn ellipse did in the probe's picture (`tools/.work/follow/`).

### 2. The bug on record: the galaxy flight's blue frames (plan 0011 D8), and the flight to the Earth

- **Found on the phone's recording.** `build/clips/raw/milky-way.mov` (the owner's screen
  recording of 2026-09-28, the take the clip reviewers saw), decoded frame by frame with ffmpeg:
  frames 2532–2536, 50.458–50.542 s, the mean color of the frame's middle rises from (27, 35, 53)
  to (59, 94, 163), with 91–95 % of its pixels led by blue, between the stock HUD's `4.12 thousand
  light-years from the Sun` and `5.54 thousand` (1.26 to 1.70 kpc), then falls back. The blue's ratio, 0.36 : 0.58 : 1,
  is the young-star maps' tint (0.32, 0.58, 1.0). The same stretch then fills the screen with the
  disk-and-bar model's tan for a second (51.0–51.4 s, mean up to (152, 131, 107)).
- **The cause is the flight's path** (`js/view.js`). A flight moved the target in a straight line
  with the same easing that moved the log of the distance, so flying from the Neighborhood (the
  Sun, 14 pc) to the Milky Way (the Galactic center, 8.1 kpc away, from 46 kpc), the target slid
  along the disk while the camera was still 14 to 80 pc from it, a few tens of parsecs above the
  plane. The young-star maps lie flat at the Sun's own height (`galaxy.json`, `young.files.*.z_kpc`
  0.0208): the camera skimmed them, and one 0.1 kpc cell (the Sagittarius–Carina arm's young stars,
  on the line to the center) filled the screen. Nothing in the data was wrong; the camera was
  where no one would put it.
- **The fix** is the path of van Wijk and Nuij (2003, "Smooth and efficient zooming and panning",
  as d3's `interpolateZoom` with ρ = √2): the camera pulls back while the target moves and closes
  in once it is over the new one. `zoomPath()` in `view.js`, written with `asinh` and in the
  `sinh(s) / cosh(s + r0)` form so it holds from 2 × 10⁻⁷ to 10¹¹ AU without cancelling. Durations
  are unchanged (the old formula is kept for the duration only), so the camera's waits stand. On
  the way out the screen now shows what a pinch from the Neighborhood shows: the 500 pc ball of
  the deep catalog from outside, then the young-star maps in patches, the arm fits and the model.
- **The check** (`shoot.mjs`, "the flights, frame by frame"): each scale flight (Solar System to
  Neighborhood to Milky Way and back) runs on a stepped clock in 32 steps; every step's frame is
  read back from the WebGL buffer, and its dominant color (the most common of 16 levels a channel,
  every fourth pixel) must be space or the plate's own light, neutral to warm (the stars, the
  model's glow), never led by blue. Run: `ok … solar to stars: 33 frames, 33 space, 0 the plate's
  light; stars to galaxy: 33 frames, 26 space, 7 the plate's light (brightest (120, 105, 87) at
  17.6 kpc); galaxy to stars: 33 frames, 27 space, 6 …; stars to solar: 33 frames, 33 space`.
  **It fails on the old path**: with the original `js/view.js` put back (from a scratch copy taken
  before any change; restored after, sha256 checked), `SCRUB=0 SCHEMES=light node tools/shoot.mjs`
  printed `FAIL … NOT SO: stars to galaxy at 1.33 kpc: (24, 30, 42) | stars to galaxy at 1.73 kpc:
  (26, 29, 39) | galaxy to stars at 1.65 kpc: (27, 30, 40) | galaxy to stars at 1.27 kpc …`, the
  phone's frames in headless form, and nothing else failed.
- **The flight to the Earth's black middle, improved because the path allowed it honestly.** On
  the old path the target slid from the Sun toward the Earth while the camera closed in on a point
  of empty space, so the Earth left the plate for most of the flight. The new path pans while the
  view is wide and then closes in on the Earth: nothing new is drawn, only where the camera is
  changes. `shoot.mjs`: `the flight to the Earth keeps it on the plate in 25 of 25 frames`; on the
  old path the same check printed `7 of 25`.

### 3. The pipeline rebuild for US English (owner calls 8, 15, 17)

- **The sweep** (`tools/*.py`, every British spelling in a string literal that reads as prose):
  186 words in 17 scripts, US for British (`color`, `gray`, `catalog`, `cataloged`, `center`,
  `centered`, `barycenter`, `pericenter`, `disk`, `toward`, `labeled`, `modeled`, `normalized`,
  `synthesized`, `quantization`, `license` the noun, and their plurals and capitals), plus the
  `'License'` label CREDITS.txt prints. Done by a tokenizer pass (`tokenize` and `ast`, Python 3.12)
  that leaves untouched: docstrings and comments (the pipeline's own documentation); data keys,
  identifiers and file names (`licence`, `colours`, `colour_code`, `quantisation_pc`,
  `stars/colour.json`, block ids such as `mw-disc-bar-model`); URLs; format fields (`{grey}`);
  proper names (the Open Exoplanet Catalogue, ESA's NEO Coordination Centre and Planetary Defence
  Office, the Unified Cluster Catalogue, the `colour-science` package, the Spectre stream); every
  argument of `quoted()`, `_quoted()` and `quote()`, which the pipeline checks verbatim against the
  pinned files; and any text between quotation marks inside the prose. A first run, on a scratch
  copy, was read change by change; a script then checked that every changed line differs from the
  original only by words in the map (186 words, 0 otherwise), and every script still compiles
  (`py_compile`). The verify scripts' expectations moved with the outputs they check (the model's
  component names `thin stellar disk`, `thick stellar disk`). `tools/CONTRACT.md` describes the
  formats in its own words and quotes none of the changed values; it is left as it was.
- **The rebuild ran to completion, twice**, each time from a scratch copy of the app (so that
  `CREDITS.txt` and `tools/credits/` were rewritten there, not here) with `OUT_DATA` in scratch and
  the cache at `tools/.cache/`: once with the scripts as they were (the baseline), once swept.
  Nothing was written into `data/`, `CREDITS.txt` or `tools/credits/` until the proofs below held.
  - *The download*: 6 299 504 269 B (6.30 GB, 162 files: JPL's satellite ephemerides 2.38 GB, seven
    USGS mosaics 3.67 GB with Mercury's at 1.88 GB, the rest small), about twice the "about 3 GB"
    `build_all.sh` said. The first cold run stopped in step 11 after 34 minutes (`curl: (56) Recv
    failure: Connection reset by peer` on `jup310.bsp` at 587 MB; the pipeline's `curl --retry 4`
    neither retries a reset nor resumes), and the link then ran at 40–150 KB/s. The rest came
    through a scratch stand-in for `curl` put first on the build's `PATH` (no pipeline file changed):
    it resumes a partial file and fetches what is missing in parallel 8 MiB ranges, with a lock so a
    prefetch of the largest files and the build never write one file at once; the pipeline's own
    `fetch()` checked every file's pinned sha256 as always. The baseline build then ran in 58 min
    43 s (19:51–20:50 UTC, downloads included), exit 0, every verify script passing; the swept
    build, on the warm cache, in 116 s, exit 0, likewise.
  - *Proof A, the sweep changes prose only*: the swept build against the baseline (both on this
    machine) with `verify_rebuild.py` (every file: byte-identical, or the same JSON structure with
    every number equal in value and type and every changed string differing only by the sweep's
    word map): 22 data files byte-identical (every binary and image among them); 11 JSON files
    (`about.json`, `ephem.json`, `galaxy/galaxy.json`, `moons.json`, `physical.json`, `sky/sky.json`,
    `smallbodies.json`, `stars/colour.json`, `stars/deep.json`, `stars/exoplanets.json`,
    `tex/textures.json`), the five credits fragments and `CREDITS.txt` changed by spelling only,
    and by the two year spans of the not-shown text (`2050 -> 2049`, `2100 -> 2099`, the corrected
    `year()`); `ALL PROSE-ONLY`.
  - *This machine is not the container that built `data/`*: the baseline itself differs from the
    committed files in five binaries. `ephem.bin` (4 142 of 329 694 float32 coefficients, most by
    one unit in the last place) and `moons.bin` (20 341 of 112 050) come from least-squares fits
    that agree numerically (step 10's and 11's printed errors and both JSON manifests, which record
    them, are identical) but not in their last bits on an Apple M4 with Apple's BLAS; the three
    `galaxy/*.png` have identical pixels (decoded and compared) in a different deflate stream (this
    Pillow uses the system zlib 1.2.12). Two values follow from them: the galaxy frame's round-trip
    error (2.27e-13 kpc committed, 2.17e-13 here; printed `2.3e-13` and `2.2e-13` in a credits
    sentence) and the three PNGs' byte counts in `galaxy.json`. NOTES.md's claim of a bit-identical
    rebuild held on the build's own machine; it does not hold across machines.
  - *So `data/` keeps every committed number and binary and takes the swept prose*: a three-way
    merge (`merge3.py`) took each JSON file from the swept build and put back every value
    the platform alone changed, leaf by leaf and inside strings token by token, stopping on any
    conflict (none): four values in `galaxy.json` and the `2.3e-13` sentence in `credits/galaxy.json`.
    Every binary and image is the committed file. Then step 90 itself (`90_about.py`) wrote
    `about.json` and `CREDITS.txt` again from the merged fragments, and `verify_data.py` passed on
    the result (`data/ holds exactly the 33 files the steps claim`, `all checks passed`).
  - *Proof C, the result against the committed state*: 22 data files byte-identical, every number in
    every JSON file equal in value and type; 10 data JSON files, the five fragments and `CREDITS.txt`
    by spelling only (`CREDITS.txt`: 239 words, among them the label `Licence` -> `License` 100
    times); `about.json` by spelling (128 words) and in three blocks `90_about.py` writes itself,
    each now word for word the script's text (checked against its constants): `reading-sizes` and
    `software` (owner call 8; About still writes both in its own words and leaves these out) and
    `reading-glow` (owner call 17: a marker's color now names its category). Block ids identical,
    in the same order.
  - *Tests*: `verify_data.py`, then `node tools/test_decode.mjs`, `test_ephem.mjs`,
    `test_galaxy.mjs`, `test_rotation.mjs`, `test_smallbodies.mjs`, `test_stars.mjs`: all pass. One
    note on `test_ephem.mjs`: its fourteen "vs Python" checks compare the shipped `moons.bin` with
    `tools/.cache/solar/ref_moons.json`, which step 11 writes from the fit it has just made, so on
    this machine it described this machine's fit and those checks failed by up to 0.088 km
    (Iapetus; limit 0.001 km) against the committed file, while every check against JPL's kernels
    passed (Io 47.6 km against its 64.4 km limit, for one) and the whole test passed against this
    machine's own `moons.bin`. The fixture, which the cache documents as "the Python evaluation of
    the shipped windows", was evaluated again with step 11's own `evaluate_centre()` on the windows
    that ship (`ref_moons_shipped.py`; epochs and SPK positions unchanged). The cache is
    gitignored and never shipped.
  - The scripts and logs of this rebuild (the sweep, `verify_rebuild.py`, `merge3.py`,
    `compare3.py`, `ref_moons_shipped.py`, the `curl` stand-in, both builds' logs and both proofs) are
    in `tools/.work/follow/rebuild/`, which is gitignored: on this machine only.
  - **The data's combined digest**, `find data -type f | sort | xargs shasum -a 256 | shasum -a 256`:
    `29cd06f457fe689b368dcc5f501b2c5ddf5f07713d2ce0fc63ffbbf319d24eca` (it was `a9c72c12…07d4a1`);
    the eleven new sha256 are pinned in `check.mjs`, whose former British-spelling note is now a
    check: `US English in the prose the app shows from data/ (owner call 15): 0 British spellings
    in About (data/about.json) and 0 in strings the card can show (none)` (proper names excepted:
    the Open Exoplanet Catalogue, ESA's NEO Coordination Centre and Planetary Defence Office, the
    `colour-science` package and a path in it). With one `colour` put back into About in a scratch
    copy, it fails.

### 4. The nits the final left

- **Venus unlabeled** (and Mercury, and Mars, on other days and sizes): the placer tried six
  places for an important label and dropped it when all six were taken, which happened whenever
  two inner planets and the Sun crowd: a probe (`tools/.work/follow/labels.mjs`: eleven dates from
  today to 300 days on, five sizes) found 24 inner planets on the plate without a label before the
  change. The fallback: two more rows, a label's height further above and below, drawn without
  the dot (it would sit on nothing), and the clamped placements the selected label already had;
  about 60 B of code. The same probe on the final code: none at 390 × 844, 375 × 667, 360 × 740 and
  844 × 390; at 320 × 568, Venus on 2 of the 11 dates, where the Sun, Mercury, Venus and the Earth
  sit within about 70 px beside the key column and all ten places are taken (a third row was not
  worth its bytes). `shoot.mjs`: `390 × 844: the inner planets on the plate carry their labels
  through a year, every 15 days (99 placements)` and `375: … (97 placements)`, none unlabeled. A
  planet under the key column is not counted: no label may go there.
- **The year spans**: the data cover 1900-01-01 to 2100-01-01 and the moons 1950-01-01 to
  2050-01-01, exclusive, and the app writes `1900 to 2099` and `1950 to 2049` (`span()`). Now the
  same in `miniapp.json` (183 characters), `NOTES.md` (seven places) and ART.md; and in the
  pipeline's "What this app does not show" text, whose `year()` rounded the end instant up to the
  next year: it now names the last year covered (`tools/90_about.py`, the one change in the
  pipeline that is not spelling).
- **ART.md**: `disc-and-bar model` is `disk-and-bar model` (twice; the app says `Disk and bar
  model`); the ZIP row says 61 files, as `check.mjs` counts them.
- **Find's cross**: `.search-q::-webkit-search-cancel-button { appearance: none; }`. The field
  already dropped the native look; its cancel button kept the browser's blue cross, an accent.
  `shoot.mjs`, both themes: `Find's field: its cancel button's appearance is none, and its right
  end holds 0 blue-led pixels`.
- **The stamp after a load failure: made inert**, rather than bound or merely stripped of
  `aria-haspopup`. About is built from the data, so after a failure it has nothing to show and its
  Close and Escape are bound only once the data is in; binding the stamp would open a sheet that
  could not be closed. Stripping `aria-haspopup` alone would leave a button that does nothing.
  `inert` takes it out of the tab order and the accessibility tree while its words stay on screen,
  and the notice (`role="alert"`) says what is wrong. `shoot.mjs`, the three broken-data cases:
  `the stamp says "The sky could not be read", inert (takes no focus; 0 buttons so named in the
  accessibility tree)`, read from Chromium's own accessibility tree over CDP (Playwright's role
  engine does not model `inert`: a first version of the check that asked it failed on a correct
  page).

### Runs (the last, after every change, the rebuilt data included)

- `node tools/check.mjs`: `all checks pass`, 40 `ok` lines: `app code 241,813 bytes (cap 242,000,
  …; 187 to spare)`, `fonts/ 45,695 bytes`, `ZIP has index.html at its top (61 files)`, `ZIP size
  6,522,068 bytes (budget 8,156,512 …)`, `the data is the follow-up's rebuild: 33 files at the
  sha256 recorded after it`, `US English in the prose the app shows from data/ (owner call 15): 0
  British spellings in About (data/about.json) and 0 in strings the card can show (none)`.
- `node tools/test_decode.mjs`: `all checks pass`, 13 `ok` lines (the decoders unchanged).
- `tools/venv/bin/python tools/verify_data.py` (the pipeline's five verify scripts on `data/`):
  `data/ holds exactly the 33 files the steps claim`, `all checks passed`; then `node
  tools/test_ephem.mjs`, `test_galaxy.mjs`, `test_rotation.mjs`, `test_smallbodies.mjs`,
  `test_stars.mjs`: each `all checks passed` (section 9, item 3, on the moon fixture).
- `node --check` on `app.js`, every `js/*.js`, `tools/check.mjs`, `tools/shoot.mjs`,
  `tools/test_decode.mjs`: no output; `sh -n tools/build_all.sh`: no output.
- `PLAYWRIGHT_MODULE=… SCREENSHOTS=1 node tools/shoot.mjs`: `all checks pass`, exit 0, 88 `ok`
  lines; `hit targets ≥ 44 × 44 px: 15 controls`, `focus mode's hit targets ≥ 44 × 44 px: 8
  controls`, 15 at each of the five widths; `play at 7 days a second: 32 drawn frames over 20.5
  days`, interval median 113.0 ms (SwiftShader, a trend only); `screenshots/app.png … untouched:
  7981ec844480…`; `screenshots/*-{light,dark}.png` refreshed, and read by eye.
- In the app, headless: the Sun's card reads `Surface: SDO HMI continuum (Stellarium map by R.
  Kabatsayev), colored by the TSIS-1 spectrum`; About's display-effects paragraph opens `The glow
  around the Sun and the halo of points are display effects … A marker's color names its
  category`.
- The first full run of the new `shoot.mjs` failed only the new broken-data assertion, three times
  (Playwright's role engine counted the inert stamp; item 4), and passed everything else.

## The lead's ruling on the code cap (2026-10-01)

HOUSE.md §8 item 3 held Milky Way's app code at 223 463 B, its size when the pass started, until the
lead set another cap and recorded why. The pass measures 239 566 B after ART's trims 2–4 and the
comment condensation (248 643 B before them). **The cap is 240 000 B**, recorded here by the lead:
the house system's own modules (units, the track, the Reach's rule, the plate's palette, focus mode
and the dialogs) are what the owner asked every app to carry, and HOUSE.md §8 item 4 forbids
stripping comments or minifying to fit; cutting the year keys, the speed exposures or the Layers
descriptions would remove function to meet a number set before the system existed. Record the
figure in `tools/check.mjs` (item 16) and in ART.md's budget section. If the owner prefers features
cut, the four candidates ART.md lists are the ones to take, in that order.

### The lead's second ruling: 242 000 B (2026-10-01)

After the final review the lead raised the cap to **242 000 B** (+0.8 %), for two items the second
fix pass had declined for want of bytes: the Zoom in and Zoom out keys (owner call 13; one finger
and the keyboard could not zoom out, WCAG 2.5.1) and a view offset that keeps a globe flown to clear
of the readout card at every size (owner call 16). Recorded in `tools/check.mjs` (item 16) and in
ART.md §6. The follow-up spent it on those two and paid for the rest in place (section 9): 241 813 B.

---

## 10. Moved from `ART.md` on 2026-10-02: its sections 8 and 9 and its after-QA, after-review and after-follow-up summaries, word for word

`ART.md` ships inside the ZIP, and the house rule (`Template/HOUSE.md`, "What ships and what does not")
keeps build history out of a shipped file, so the lead moved these here unchanged on 2026-10-02, as
Anatomy's pass did for its own. Inside the moved text, *this file*, *§N* and *section N* mean `ART.md`
as it stood on 2026-10-01, and a pointer to `tools/DECISIONS.md` section N means this file's own
section N above.

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
