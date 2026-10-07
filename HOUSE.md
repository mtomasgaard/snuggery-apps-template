# The house system

This is the brief every art pass on the template's apps reads first. It is not shipped: it lives at
the template's root, and no ZIP carries it. It distills Global Weather's look, *Long Exposure*, into
rules that also fit apps with no map, no time player and no weather: a three.js sky, a kart game, a
running dashboard, a one-screen live card.

**What it binds.** The owner's decision of 2026-10-01 is *one shared system, a signature per app*:
every app takes the house chrome (Ysabeau Office, the restrained keys and plates, the caption band,
the player and the app's own track, focus mode, SI, the no-tells rules) and keeps a palette and one
signature element fitted to its own data. The apps, in the order the passes run: Milky Way,
Besseggen, Norne Reservoir, Anatomy, Shelf Atlas, World Oil & Gas, Snug Kart; then Running
Dashboard, Finances, World News, Outdoor Window, Power Hours, Hello Live.

- **Global Weather and Global Wind are the reference, not targets.** This file takes its rules from
  them, and a citation names the line.
- **Earth's History, US Quakes and Warming World keep their own directions** (Deep Field Atlas,
  Drum Record, Gray Card), and these passes do not touch them. They share this file's rules for
  words, numbers, tests and budgets (§6 to §8), never its chrome, with two exceptions the owner
  added on 2026-10-06: the front of the app (§4.15) and versions (§13) bind them too. Their grounds
  stay their own (§12).
- **An art pass never touches a pipeline, a snapshot or the refresh loop.** The data half of every
  app stays byte-identical.

**How to read it.** *Must* is a rule the final reviewer checks (§10). *Should* is the house default;
an app may depart from it only with the reason written in its own `ART.md`. A figure marked
*measured* says how it was measured. Line numbers in citations are those of 2026-10-01. Examples of
shipped text use plain spaces, except in §6.1 and §6.2, where the narrow no-break spaces are real.

**Sources.** Paths are relative to the template's root unless they say otherwise.

| Short | File |
| --- | --- |
| ART | `global-weather/ART.md` (the look, *Long Exposure*) |
| DESIGN | `global-weather/DESIGN.md` (what the app does) |
| DEC | `global-weather/tools/DECISIONS.md` (owner calls, as built, the review record) |
| CSS, HTML, APP | `global-weather/style.css`, `global-weather/index.html`, `global-weather/app.js` |
| TRACK, UNITS | `global-weather/js/track.js`, `global-weather/js/units.js` |
| CHECK, SHOOT | `global-weather/tools/check.mjs`, `global-weather/tools/shoot.mjs` |
| SUBSET, PAL, OFL | `global-weather/tools/art/font_subset.py`, `global-weather/tools/art/palette.py`, `global-weather/fonts/OFL.txt` |
| WIND | `global-wind/ART.md` (how the system was carried to a sibling) |
| EH, UQ, WW | `earth-history/ART.md`, `us-quakes/ART.md`, `warming-world/ART.md` (what a signature is) |
| CAM, SHOTS, CLIPS | In the Snuggery app repository, not this one: `Tests/SnuggeryUITests/MarketingCameraCase.swift`, `MarketingShotsUITests.swift`, `MarketingClipsUITests.swift` (the marketing camera) |

**What a pass delivers** (per app, in the app's folder):

| File | Ships | What |
| --- | --- | --- |
| `ART.md` | yes | the app's direction: its signature (§5), its palette inside the tonal budget with measured contrast (§3), the chrome mapped onto its controls (§4), the tell list answered (§9) |
| `fonts/ysabeau-office-gw.woff2`, `fonts/OFL.txt` | yes | the house face, byte-identical copies (§2.2) |
| `js/units.js` | yes | every number, unit and date the app writes (§6) |
| `js/track.js` | yes, where there is a time player | the app's own track (§4.6) |
| `tools/art/palette.py` (or the app's equivalent) | no | every token, ramp and contrast figure in `ART.md`; `--json` for the app's ramps (§3.3) |
| `tools/check.mjs`, `tools/shoot.mjs`, a decode test where there is data | no | §7 |
| `tools/DECISIONS.md` | no | owner calls, the change list, as-built notes, the review record. Build history never goes in a shipped file (DEC 3-8, 263-268) |

## Contents

1. The idea, and the rule that governs everything
2. Type: Ysabeau Office
3. Color: the tokens, the tonal budget, the app's palette
4. The chrome, object by object
5. What a signature is
6. Words and numbers: SI, US English, vendor neutrality, honesty
7. The tests and the camera
8. Budgets
9. The generated-page tell list, answered
10. The final reviewer's checklist
11. The pane-app register (2026-10-06)
12. Grounds (2026-10-06)
13. Versions (2026-10-06)

---

**What ships and what does not (a rule learned on the third pass).** `ART.md` ships inside the ZIP, so
it carries only the rules, the measured figures and the look as built, corrected in place when a
fix changes them. The record of the pass — the owner calls as they stood, the as-built departures,
the "after QA", "after review" and "after the follow-up" sections, the phone checks — lives in
`tools/DECISIONS.md`, which never ships. A pass that finds history in a shipped `ART.md` moves it.

## The owner's critique of 2026-10-06 (plan 0012)

On 2026-10-06 the owner looked at the family and wrote, among the brief's other items (saved word for
word in the Snuggery repository, `docs/plans/0012-the-owners-brief-of-2026-10-06.md`):

> Apps/dashboard with a lot of text become a bit messy to read (finqnces, training load / running
> dashboard, world news, etc) - matbe need more colors, more separation, bigger fonts, contrasts,
> table instead of lot of text? etc etc
>
> Bot all apps need this grey ish background?
>
> Milky way can remove some pf the text/subtitles at the «front page». That gows for all actually,
> data origin/licenses etc shpuld not take up too much space - would be better to have inside the
> views if we have to show it clearly?

The plan's checks found the pattern behind it: every house app carried three layers of origin text
on its front (the header's stamp of sources and dates, the caption band's sentences, the footer's
credit line), and the pane apps set facts as sentences in one face, black on gray (findings 11 and
12). The owner then decided four things, and this file now carries them. Where they override an
earlier rule, that rule is amended where it stands and says so, so nothing in this file contradicts
another part of it.

| What | Decision | Where the rule now is | What it amends |
| --- | --- | --- | --- |
| **The front of every app**, all eighteen, the three directed apps included | the brief, package 2 (a) | §4.15 | §1, §4.1, §4.2, §4.5 (the credits on screen, and what the band holds), §4.8 (and its one exception for links a source's terms ask for), §4.10, §4.13, §5.2 test 3 (Norne only, the lead to confirm), §6.5, §7.1, §7.2, §9 row 3, §10 |
| **The pane-app register**: bigger key numbers, color with one meaning, plates, tables, keys, `Example data.` | D5, the owner's verdict on the picture board, as prototyped | §11 | for the six pane apps only: §2.5's 21 px ceiling, §3.1's no-accent rule, §4.5's band, §4.14's insets (the pane pads its own foot), §9's "content sits on the page between hairlines" (the pane apps' "panes on a page, not cards"), Finances' `ART.md` rule that money's direction is never a color |
| **The grounds**: white, gray or the app's own, per app | D6, the designer's picks | §12 | §3.1's one `--page` for every app |
| **Versions mean something** | L4, the lead's call | §13 | §7.1 item 7 |

Every app's change list is `docs/plans/0012-change-lists.md` in the Snuggery repository. The approved
prototypes are patches in `docs/plans/0012-prototypes/` (Finances' Overview, World News' All, Running
Dashboard's Now), and the board is `docs/marketing/reference/0012-board-*.png`.

## 1. The idea, and the rule that governs everything

**The idea.** Each app's screen is printed like a scientific photograph: a plate and its caption.
The picture runs edge to edge, and under it a short band of plain type says what the picture is
and how to read it; the stamp over it says how old it is, and whose data it shows is one tap away in
About (the owner, 2026-10-06: §4.15). The picture is the data and nothing else. Everything around it
is quiet: gray chrome, one typeface, no accent color in the chrome, no shadows, no glass (a pane
app's data takes the register's colors, §11).
Exactly one element on the screen is allowed to be bold, and it is made of the data itself. In
Global Weather it is a field of streaks, each a tracer carried by the forecast's wind, captioned
with its exposure, `Streaks: 1 s = 24 h of wind at the hour shown`. The dark theme is the print
(pale marks on a dark plate) and the light theme is the negative (dark marks on pale film base)
(ART 13-33; WIND 9-23).

**The rule that governs everything: the tonal budget.** A one-point mark reads only if it stands
apart from what is under it in lightness; hue is not enough (ART 151-152). So each app splits its
lightness range, per theme. **Its data lives inside a stated OKLab lightness band, and its
signature keeps the far end of the range to itself**, so the signature stays legible over every
value of every data layer, at a contrast that is measured, not hoped for. In Global Weather the
light theme's data lives in L 0.625–0.955 and the streak is ink at L 0.196; the dark theme's data
lives in L 0.255–0.650 and the streak is a warm white at L 0.960 (ART 154-155). In both themes
"more" stands further from the ground (ART 22-24). Two corollaries follow, and they bind every app:

- **Chrome is gray.** Every chrome token is a near-neutral at OKLCh chroma ≤ 0.024, so every hue a
  person sees is data (ART 550-551). The pane-app register's colors (§11, 2026-10-06) are data
  colors too: they say owned or owed, done or planned, up or down, or which source, and never color a
  control, a tab, a heading, a plate or the stamp.
- **Type is one face.** Ysabeau Office, one file, at every size and in every role, canvas text
  included (ART 549).

---

## 2. Type: Ysabeau Office

### 2.1 Why this face

Ysabeau Office (Christian Thalmann, Catharsis Fonts; SIL OFL 1.1, no Reserved Font Name) is a
Renaissance sans: Garamond's proportions without the serifs, with the Office cut's larger x-height
and plainer forms for small text (ART 52-58). It was chosen over twelve other faces for four
measured reasons (ART 60-73): it draws every character the app writes, U+202F included, which
Archivo, Atkinson and Red Hat Mono lack; its zero is plain and its figures tabular; it is compact
without being condensed (`Map Globe Wind Temperature Rain Cloud Pressure` sets at 12.5 px in about
350 px, so full words fit at 390 px); and it covers GeoNames' place names but three letters. The
rejected faces and why are in ART 130-143: the three directed apps' voices (Archivo, Atkinson
Hyperlegible, Newsreader, Red Hat Mono) are theirs, Encode Sans has a Reserved Font Name, Instrument
Sans is a frequent choice of generated pages and lacks ≤ ≥, U+2009 and primes, Cabin's minus is
hyphen-short.

### 2.2 The file every app vendors

| | |
| --- | --- |
| Published path | `fonts/ysabeau-office-gw.woff2` |
| Bytes | 35 372 |
| sha256 | `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262` (ART 103; CHECK 101) |
| License file | `fonts/OFL.txt`, 4 703 B, sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269` (*measured*, `shasum -a 256`; Global Wind's copy is identical) |
| Together | 40 075 B, against the 160 000 B font budget (ART 102) |
| Cost in a ZIP | 37 834 B (*measured*: Hello Live's folder zipped by the `build-zips.yml` command with and without the two files) |
| Upstream | google/fonts commit `9710da1eacb3be272583c3224dcb70f9da6eadbb`, `ofl/ysabeauoffice/YsabeauOffice[wght].ttf`, 401 964 B, sha256 `0f305c8451c1566f0ae62dca9921831fa59f09f6468b012fd6c9161362b5d360`; its `OFL.txt`, 4 391 B, sha256 `1343b9162a2d24f685767766ea23a75a80b88ba13ba421244e65b72210578b78` (SUBSET 28-31) |
| Cut | 685 glyphs, 492 characters, weight axis 400–650 (ART 99, 113; *measured*: fontTools 4.60.2 on the shipped file) |

**Vendoring (must).** Copy both files from `global-weather/fonts/` byte for byte, as Global Wind did
(ART 616; WIND 44-45). Do not rebuild the face in the app, and do not rename the file: the first line
of `OFL.txt` names `fonts/ysabeau-office-gw.woff2` (OFL 1-4), so a renamed file would make the
license header wrong, and an edited header would no longer be the house's file. `check.mjs` pins
both sha256 values (§7.1). An app that drops another face (Milky Way, Besseggen and Anatomy carry
Atkinson Hyperlegible and Newsreader; Running Dashboard carries Geist) deletes those files and their
credits in the same pass.

**The recipe**, for the record and for a supplement (§2.3):

- **Command**, from the template's root, in any venv with fonttools 4.60.2 and Brotli (never a
  pipeline's venv): `python global-weather/tools/art/font_subset.py` (ART 106-107; SUBSET 15-17).
  It fetches the two pinned files, checks their size and sha256, subsets, cuts the axis, writes the
  woff2 and `OFL.txt` with its header, and prints the size and sha256 (SUBSET 38-65). Run it in a
  scratch copy: in place it rewrites `global-weather/fonts/`, the reference app.
- **Characters** (SUBSET 32-34): `U+0020-007E, U+00A0-00FF, U+0100-017F, U+01A0-01A1,
  U+01AF-01B0, U+0218-021B, U+0304, U+0307, U+1E00-1EFF, U+2009, U+202F, U+2013-2014,
  U+2018-201E, U+2026, U+2032-2033, U+2039-203A, U+2212, U+2264-2265`: Basic Latin, Latin-1,
  Latin Extended-A, Ơ ơ Ư ư, Ș ș Ț ț, the combining macron and dot above, Latin Extended Additional
  (GeoNames' Vietnamese and transliterated names), the thin and narrow no-break spaces, dashes,
  quotes, the ellipsis, primes, single guillemets, the true minus and ≤ ≥ (ART 108-111).
- **Features requested** (SUBSET 35): `kern tnum lnum pnum case liga calt ccmp locl mark mkmk`.
- **Options** (SUBSET 50-55): all name records kept, a drawn `.notdef`; subset first, then the
  weight axis instantiated to 400–650; `recalcTimestamp = False`, which is what makes a rebuild
  byte-identical; flavor woff2.
- **Verified 2026-10-01**: the same calls, run twice from the cached pinned upstream with
  fonttools 4.60.2 and Brotli into a scratch folder, gave 35 372 B and sha256 `fdf1a28c…cdb262`
  both times, byte-identical to the shipped file (`cmp`).

**What the cut actually holds** (*measured*, fontTools `getBestCmap()` on the shipped file; the
upstream does not draw every requested code point, so the ranges shrink): U+0020–007E, U+00A0–00AC,
U+00AE–017F, U+01A0–01A1, U+01AF–01B0, U+0218–021B, U+0304, U+0307, parts of U+1E00–1EFF
(U+1E0C–1E0F, 1E20–1E21, 1E24–1E25, 1E2A–1E2B, 1E30–1E31, 1E36–1E3B, 1E40–1E4B, 1E5A–1E63,
1E6C–1E6F, 1E80–1E85, 1E8E–1E8F, 1E92–1E93, 1E97, 1E9E, 1EA0–1EF9), U+2009, U+2013–2014,
U+2018–201A, U+201C–201E, U+2026, U+202F, U+2032–2033, U+2039–203A, U+2212, U+2264–2265. That
includes °, ±, ×, µ, ¹ ² ³, ½, the middle dot and Å.

**Features actually in the cut** (*measured*: the GSUB and GPOS feature lists): `calt case ccmp
kern liga locl mark mkmk tnum`. The subset empties `lnum`'s lookups, and the upstream has no `pnum`
at all. ART 112-113 lists both as kept; §2.4 says what that means.

### 2.3 Characters beyond the cut

*Measured* 2026-10-01: every shipped `.html`, `.js`, `.css` and `.json` of the thirteen apps read
against the cut's character map. Many hits sit in code comments, so read each before acting.

| App | Characters it writes that the cut lacks |
| --- | --- |
| Milky Way | Greek letters (its stars' designations, in its data), superscript digits (⁰ ⁴ ⁹), arrows |
| Running Dashboard | ₂ (the `VO₂ max` tile), ≈ (in a tooltip), ▴ ▾ (a fold's chevrons), and Δ, ⓘ, ↑ ↓ → |
| Finances | • (its data's masked account numbers, `•• 4417`) |
| World News, Outdoor Window, Power Hours, Hello Live | ⋯ and → in help sentences (`Options ⋯ → App Files`) on 2026-10-01; each pass replaced them with words, so none ships either now |
| Shelf Atlas, World Oil & Gas | ▸ ▾ in CSS, → and math signs (mostly in comments) |
| Besseggen | → in its route chip (`Gjendesheim → Memurubu`) |
| Norne Reservoir, Anatomy, Snug Kart (outside comments) | none |

The rule, in this order:

1. **Use what the cut has.** Most of these are tells or icons the house replaces anyway. → is never
   written (§9): a direction is words (`Gjendesheim to Memurubu`), and so is a path through
   Snuggery's menus (`in Snuggery, Options, then App Files`). ▸, ▾, ▴ and ⓘ become drawn SVG marks
   (§4.4). `≈` in a sentence is `about`. A data value is shown as the data gives it, so Finances'
   bullets either come from a supplement or are reformatted for display (`ending 4417`); the data
   file itself is never changed.
2. **A character the data needs and the upstream draws comes from a supplement**: a second file cut
   by the same recipe from the same pinned upstream, holding only those code points, named
   `fonts/ysabeau-office-<app>-extra.woff2`, declared as a second `@font-face` of the same family
   with a `unicode-range` that names exactly those code points. The house file and `OFL.txt` stay
   byte-identical (the one license covers both files; the supplement's commit, code points and
   command go in `NOTES.md` and `ART.md`), and `check.mjs` pins the supplement's sha256 too.
   *Measured* costs, same recipe, scratch build: the Greek capitals and small letters (U+0391–03A9,
   U+03B1–03C9) 7 232 B; ₂ ≈ • together 1 492 B; € 1 276 B. The upstream draws (fontTools on the
   pinned TTF): 77 Greek and 222 Cyrillic code points, ⁰ ⁴–⁹, ₀–₃, ← ↑ → ↓ ↔, •, €, ‰, ≈, ∞, №,
   the figure space U+2007 and the figure dash U+2012.
3. **A character the upstream does not draw is not set in text.** It lacks ⁺ ⁻ (so no negative
   exponents: write `0.001`, or use a prefix), ⋯, ▴ ▸ ▾, ⓘ, ℃ (write ° and C), U+212B (use Å,
   U+00C5), ☉, ⊕, U+2010 and U+2011. The one exception is a rare letter inside a data name, which
   the browser takes from the system face, as Global Weather lets ḑ Ḩ ḩ through, the only three
   letters its 1 612 place names use that the cut lacks (ART 71-73). `check.mjs` then lists those
   letters by name, so a new one fails.

### 2.4 Figures, the zero and the signs

- **Figures are lining and tabular by default.** All ten digits are 517/1000 em wide, and their
  height, 658–668 units, is the cap height (658) (*measured* on the cut). The valid time, the legend
  and the readout never shift as numbers change (ART 65-66).
- **The zero is plain**: two contours, no slash (ART 65; *measured*). The slashed `zero` feature is
  not in the cut.
- **What CSS can change.** `body` sets `font-variant-numeric: tabular-nums lining-nums` (CSS 55;
  ART 92): it states the intent, and the face already does it. The house does not write
  `proportional-nums`: the cut has no mapping from the default figures to proportional ones, so
  Global Weather's `proportional-nums` on the caption band and About (CSS 335, 409; ART 92-93)
  changes nothing. Figures in prose are tabular in this face, and that is fine.
- **U+2212**, the true minus, is drawn at the plus sign's width (550/1000 em; the hyphen is 380), so
  `−12` and `+12` align (*measured*; ART 62). Cabin was rejected because its minus was
  hyphen-short (ART 138).
- **U+202F**, the narrow no-break space, is 211/1000 em (U+2009 the same; a word space 246). It is
  the space between a number and its unit and between thousands (§6.1).
- The face also draws `…` (always the real ellipsis), ′ ″ (primes, not quotes), ‹ › (single
  guillemets), ≤ ≥ (a legend's open ends; DEC 327-328), × (factors) and ° (angles).

### 2.5 The scale

| Role | Size / line height | Weight | Color | As built | Source |
| --- | --- | --- | --- | --- | --- |
| App name | 15 px / 22 px | 650 | `--ink` | header | ART 79; CSS 93 |
| Stamp | 11.5 px / 16 px | 400 | `--ink-2`; a stale sentence in `--ink` | under the name | ART 84; CSS 95-104 |
| Units key | 12.5 px | 600 | `--ink` | header, right | ART 345-346; CSS 110-121 |
| Tabs, layer words, panes | 12.5 px, in a 44 px row | 400; 620 when chosen | `--ink-2`; `--ink` when chosen | header's last row | ART 82; CSS 143-154 |
| Legend title | 11.5 px | 600 | `--ink` | caption band | ART 86; CSS 340 |
| Caption line | 11 px / 15 px | 400 | `--ink-2` | caption band | ART 86; CSS 328-336 |
| Instrument labels | 10.5 px | 400 | `--ink-2`; `now` in `--ink-3` | legend ticks, day labels, `now` | ART 85; CSS 343; TRACK 11 |
| Credits | 10.5 px / 15 px | 400 | `--ink-2` | the caption band until 2026-10-06; now only §4.15's two exceptions, at the data's edge | ART 87; CSS 358 |
| The one large figure | 21 px / 1 | 600 | `--ink` | the valid time | ART 77; CSS 369 |
| Lead | 12.5 px | 400 | `--ink-2` | beside the valid time | ART 416; CSS 370 |
| Readout value | 21 px / 1.2 | 600 | `--ink` | the card | ART 78; CSS 291 |
| Readout unit | 13.5 px | 400 | `--ink-2` | after U+202F | ART 78; CSS 292 |
| Readout place line | 12.5 px (see the note) | 400 | `--ink-2` | the card's first line | ART 445; CSS 287 |
| Readout lines and rows | 12.5 px / 1.35 | 400; values 560 | labels `--ink-2`, values `--ink` | the card | ART 83; CSS 293-305 |
| About title | 15 px | 650 | `--ink` | the sheet's head | CSS 402 |
| About section heads | 13.5 px | 650 | `--ink` | sentence case | ART 81; CSS 412 |
| About prose | 13.5 px / 1.5, at most 62 ch | 400 | `--ink` | the sheet | ART 80; CSS 411-413 |
| About lists | 13.5 px / 1.45 | 400 | terms `--ink-2` | `label: value` lines | CSS 416-418 |
| Text keys (Close) | 12.5 px, 44 px tall | 400 | `--ink` | About | CSS 403 |
| Notices | 13.5 px / 1.4 | 400 | `--ink` | on the plate | CSS 320-321 |
| Canvas and WebGL labels | 11.5 px over a 3 px halo | 560 | `--ink` on the label halo | the plate | ART 88; APP 139, 1819 |
| Everything else | 13.5 px / 1.35 | 400 | `--ink` | `body` | CSS 54 |

Global Weather builds the readout's place line at 12 px (ART 445; CSS 287), which is off its own
scale; the house sets it at 12.5.

**Rules (must).**

- The scale is **10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 / 21 px**, and nothing is larger than 21 px
  (ART 90). A screen has one large figure, at 21 px and 600: the subject's own number (the valid
  time, the tapped value, a card's headline) (ART 549, 590). **Amended 2026-10-06 for the six pane
  apps only** (§11.1 rules 2 and 3): their scale adds 19 px (tile values and table totals) and 34 px
  (one key number per pane), both at 650; the key number is a pane's one large figure. Text that is part of a rendered scene
  (a game's countdown on the track) belongs to the scene, is set in this face, and is named with its
  size in the app's `ART.md`.
- Weights are 400, 560, 600, 620 and 650, all inside the cut's 400–650 axis.
- Nothing is set in capitals or small capitals, nothing is letter-spaced (`letter-spacing` is only
  ever 0), and no label sits above a heading. Every label and button is in sentence case (ART 90-92,
  581, 594-595).
- **One `@font-face` rule**, word for word (CSS 10-15; ART 116-119; CHECK 235-236):
  `@font-face { font-family: 'Ysabeau Office'; src: url(fonts/ysabeau-office-gw.woff2)
  format('woff2'); font-weight: 400 650; font-display: block; }`. The file is local, so `block`
  costs nothing and keeps canvas text out of a fallback face (ART 598-599). The family is used only
  through `--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif` (CSS 28).
- **Canvas and WebGL text wait for the face**: `document.fonts.load('560 11.5px "Ysabeau Office"')`
  before the first frame with text, and a redraw on `document.fonts`' `loadingdone` (ART 121-124;
  APP 2797-2800). Every font string in a script names `"Ysabeau Office"` first (APP 139; TRACK 11).
  Warming World's study drew its first labels in a serif because it did not wait (ART 123-124).
- **The credit line, word for word** (ART 126-128), in About (prefixed `Type: `; HTML 120), in
  `NOTES.md` and in the app's licenses or credits file: `Ysabeau Office by Christian Thalmann
  (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.`

---

## 3. Color: the tokens, the tonal budget, the app's palette

### 3.1 The chrome tokens

Every app declares these custom properties in `:root` and again under
`@media (prefers-color-scheme: dark)`, with these values (CSS 17-43; ART 165-179). Contrast is WCAG 2.
The three inks on both grounds and `--line-strong` on `--page` are PAL's figures (ART 206-210); the
rest are *measured* with PAL's own `lum` and `cr` functions, imported from the file.

| Token | Light: film base | Dark: the print | Used for | Contrast on `--page` (light / dark) | On `--sheet` (light / dark) |
| --- | --- | --- | --- | --: | --: |
| `--page` | `#e8eef0` | `#141d21` | header, caption band, player, `body` | — | 1.11 / 1.12 |
| `--sheet` | `#f6f9fa` | `#1c272c` | key plates, the readout card, About, notices | 1.11 / 1.12 | — |
| `--ink` | `#0f1c23` | `#e6edee` | text, the thumb, the selection mark, focus rings, the Play key | 14.80 / 14.43 | 16.40 / 12.87 |
| `--ink-2` | `#45555d` | `#a3b1b6` | secondary text, the stamp, icons at rest | 6.61 / 7.76 | 7.32 / 6.92 |
| `--ink-3` | `#5b6a72` | `#8b9a9f` | step ticks, `now` (the lowest text pairs, both ≥ 4.5) | 4.78 / 5.88 | 5.29 / 5.25 |
| `--line` | `#c9d4d8` | `#2a373c` | hairlines, the plates' edges (separators only, never a control's only edge) | 1.29 / 1.39 | 1.43 / 1.24 |
| `--line-strong` | `#74858c` | `#64757b` | the track's baseline, the units key's frame, the card's edge (non-text, ≥ 3) | 3.27 / 3.56 | 3.62 / 3.18 |
| `--draw` | `cubic-bezier(0.2, 0, 0, 1)` | the same | motion that answers a touch (§4.12) | | |
| `--sheet-in` | `cubic-bezier(0.32, 0.72, 0, 1)` | the same | About sliding up | | |
| `--face` | `'Ysabeau Office', system-ui, -apple-system, sans-serif` | the same | every text | | |

`color-scheme` is `light` in `:root` and `dark` in the dark block (CSS 29, 41), and
`<meta name="color-scheme" content="light dark">` is in the head (HTML 6). OKLCh of the grounds: the
light page is L 0.945, C 0.007, h 220, a cool film base and not cream; the dark page is L 0.224,
C 0.015, h 227, a slate that leaves room for a darker plate (ART 177-179). The highest chroma of any
chrome token is 0.0239 (`--ink-2`, light; PAL prints it).

**The white ground (2026-10-06, §12).** Anatomy, Norne Reservoir, Snug Kart and Hello Live set the
light theme's `--page` to `#ffffff`; every other token keeps the value above, and the dark theme is
unchanged. *Measured* on `#ffffff` with PAL's `lum` and `cr`: `--ink` 17.35, `--ink-2` 7.75, `--ink-3`
5.60, `--line` 1.51, `--line-strong` 3.83, `--sheet` 1.06 (against 1.11 on `#e8eef0`). On white a
plate of `--sheet` reads by its 1 px `--line` edge more than by its fill. That is accepted for key
plates and the readout card, which hold marks and text with contrast of their own; no control's only
edge becomes `--line` (the text keys keep their `--line-strong` frame).

**Not a house token.** Global Weather's `--outside` (`#e8eef0` / `#0a1013`, the plate beyond its
globe; CSS 25, 40) belongs to that app's plate. An app's plate colors are its palette (§3.2), named
in its own `ART.md`.

**Derived states** (*measured* the same way):

| State | How it is made | Light | Dark |
| --- | --- | --: | --: |
| A key that is on | `--ink` at 12 % over `--sheet` (`#dadee0` / `#343f43`), 28 × 28 px, radius 4 (CSS 226-228) | ink mark on it 12.81 | 9.14 |
| A key held down | `currentColor` at 22 % (CSS 229) | ink-2 mark on it 5.22 | 4.47 |
| Hover, only where the pointer can hover | `currentColor` at 7 % (CSS 425-429) | ink-2 mark on it 6.63 | 6.06 |
| Focus | a 2 px `--ink` outline at 2 px offset, never a hue, never removed without it (CSS 77; ART 387-388) | 14.80 on the page | 14.43 |
| The Play key | a `--page` glyph on an `--ink` square (CSS 373-375) | 14.80 | 14.43 |
| The legend bar's frame | `--line-strong` at 60 % (CSS 342) | 1.92 on the page | 2.11 |
| A step tick | `--ink-3` at 50 % (TRACK 49-50) | 1.98 on the page | 2.48 |

The last two are deliberately faint: the bar's frame only holds a data scale, and the day ticks in
`--ink-2` carry the reading.

**The ghost key's fixed colors** (CSS 256-264; ART 480-484): light, a 1.4 px `#0f1c23` stroke over a
3.4 px `rgb(246,249,250)` halo at 60 %; dark, a 1.4 px `#f2f4f1` stroke over a 3.4 px
`rgb(10,16,19)` halo at 45 %. At rest the key is at 72 % opacity. Over every one of Global Weather's
bases the stroke holds 5.28:1 (light) and 4.85:1 (dark) against its own halo (ART 228-229;
PAL 195-204). Each app measures its own worst case over its own plate (§3.3).

**Rules (must).**

- The tokens are copied as they are, in every app (the four white apps' light `--page` is
  `#ffffff`, §12). `html` and `body` get `background: var(--page)`
  (CSS 48-53; DEC 60-61). Both `theme-color` metas carry `--page`, one per scheme (HTML 7-8;
  CHECK 229-234).
- No accent color in the chrome, anywhere. No red or amber in the chrome, not for staleness and not
  for errors: the words carry the warning, and warm hues belong to data (ART 353-355, 563).
  **Amended 2026-10-06 for the six pane apps only** (§11): the meaning of their data (owned and owed,
  done and planned, up and down, a coaching tone, a source) takes the register's colors, on figures,
  marks, swatches and the tone word, never on a control, a tab, a heading, a plate, a hairline or the
  stamp.
- No shadows, blur, glass or glow: not on the keys, not on the card, not around a globe or a scene.
  No gradient in the chrome but a data scale and the selection tracer (ART 28-30, 552). Gone from
  every app, as they went from Global Weather's stock look: `box-shadow`, `backdrop-filter`, accent,
  glass and warning tokens, and one big radius on everything (DEC 67-68).
- Radii by role: 6 px for keys and key plates, 8 px for the card, notices, the Play key and a pane
  app's section plates (§11), 2 px for a key's swatch (§4.15), 4 px
  for the on-plate, 0 for the legend bar. Round only for the thumb's disc and the tracer heads
  (ART 553-554).

### 3.2 The tonal budget, per app

Every app's `ART.md` states, for each theme:

1. **the ground**: the color under the data, and its OKLab L;
2. **the data band**: the OKLab lightness range `[L low, L high]` every data color lives in;
3. **the signature**: its color, its OKLab L at the far end of the range from the band, and the
   alpha it is drawn at;
4. **the measured worst case** of the signature over every data color, at that alpha, over every
   ground, named by value and place. The target is **3.0:1** where the signature is a mark (WCAG's
   non-text figure) and **4.5:1** where it is text. Global Weather allows **2.5:1** at night, under
   its own night shading (ART 215-218).

**The worked example** (ART 154-155, 183-196, 220-226; PAL 55-62):

| | Light (the negative) | Dark (the print) |
| --- | --- | --- |
| Ground | ocean `#d3e0e4` (L 0.898), land `#eef2ef` (L 0.957) | ocean `#0c1518` (L 0.188), land `#1a262a` (L 0.259) |
| Data band | L 0.625–0.955 | L 0.255–0.650 |
| Signature | the streak, `#0b171d` (L 0.196, C 0.021), head alpha 0.85 | `#f4f2ea` (L 0.960, C 0.011), head alpha 0.95 |
| Worst case, day / night | wind at 36 m/s: 4.30 / 3.28 | rain at 40 mm/h: 3.30 / 4.36 |

**Rules (must).**

- **One hue path, printed twice.** A data scale is one hue path whose salience runs from the
  ground's own tone (0) to the band's far edge (1). The light theme prints salience as darkness,
  the dark theme as light, so "more" stands further from the ground in both. A value has one color
  per theme, and that is accepted (ART 157-163; DEC 16-18).
- **An app keeps its data's own color logic, inside the band.** A temperature still runs cold to
  warm, a chart's series keep their identities, a star keeps its color by temperature, a game's
  world keeps its palette: only lightness is fitted to the band, per theme. Where the logic needs a
  lightness the band cannot give (the radar convention's yellow sits at L ≈ 0.85, where no streak
  of either theme can read), the logic gives way and `ART.md` says plainly what was given up
  (ART 260-263; DEC 19-22).
- **The signature encodes nothing by its color.** It is a near-neutral (Global Weather's streaks
  have chroma ≤ 0.021) and never a hue of any data scale (ART 272-274).
- **A subject with one true appearance** (a night sky, a rendered body, a terrain under the real
  sun) may keep it in both themes, as Earth's History keeps its night (EH 5-6, 35): the chrome still
  follows the theme, and the band is stated once for that plate. The other road is Global Weather's
  negative (ART 21-24); a star chart printed dark on pale paper is the sky's own negative. The art
  pass chooses, and says why.
- **Scenes with lighting** (three.js, WebGL): lighting moves rendered colors, so the band is stated
  for the base colors and checked on rendered frames by `shoot.mjs` (§7.2).

### 3.3 How a palette is derived and checked

Copy PAL into the app's `tools/art/`, replace the data, and keep every check. Standard library only;
run from the template's root; `--json` prints the ramps (PAL 1-11).

- **Stops** are `(value, salience s, OKLCh chroma C, hue h)`. Lightness is
  `L = L(s=0) + (L(s=1) − L(s=0)) · s`, with the band per theme; colors are interpolated in OKLab
  (ART 233; PAL 68-72, 94-100).
- **Gamut**: a stop that asks for more chroma than sRGB has at its lightness is printed at the most
  the screen has, with L and hue kept (ART 234-235; PAL 101-107).
- **Output**: `--json` prints the per-theme sRGB stops, each interval split in four, so a straight
  sRGB interpolation stays within ΔE 0.01 of the OKLab path the checks ran on (Global Weather:
  0.0052). The app's ramps file is that output pasted, never retyped, and `check.mjs` fails while
  the two differ (ART 235-238; PAL 118-132, 183-194; CHECK 199-208).
- **The checks**, which exit non-zero and print `SOME CHECKS FAIL` when any fails, and
  `ALL CHECKS PASS` otherwise (PAL 133-223):
  - chrome text pairs ≥ 4.5 and `--line-strong` on `--page` ≥ 3 (PAL 134-143);
  - the plate's own marks: labels on their halos, lines on their grounds (PAL 144-150);
  - every scale in both themes: its two ends separate by ΔE (OKLab) ≥ 0.10 under normal vision and
    simulated deutan, protan and tritan vision (Machado, Oliveira and Fernandes 2009, severity 1.0);
    every eighth of the legend, as seen over the ground, steps by ΔE ≥ 0.02, except a "nothing" end
    that fades into the plate on purpose (calm, dry, clear) (PAL 151-165; ART 253-258);
  - the signature over every value of every scale, over every ground, by day and night, against the
    targets of §3.2 (PAL 166-182);
  - the ghost key's stroke against its own halo over every base ≥ 3 (PAL 195-204).
- **Categorical data** (series, zones, categories), the house's extension of the ends rule: every
  pair of categories separates by ΔE ≥ 0.10 under normal vision and the three simulations, inside the
  band. Beyond five categories, words or direct labels carry identity, never color alone. A pane
  app's direction and tone colors (§11: up and down, on track, watch, act now) are always printed
  with their sign or their word, so this pairwise check does not bind them, and their text contrast
  does; §11.2 records their measured separation (up against down under deutan: 0.062 light, 0.024
  dark) so nobody mistakes the exemption for a pass.
- **Color is never the only carrier** of a meaning: staleness is a sentence, a value past the scale
  is printed open ("≥ 36 m/s").

---

## 4. The chrome, object by object

### 4.0 The kinds of app

The thirteen apps are six kinds. The table says which objects each kind carries; the sections after
it say what each object is, and what it becomes when an app has no map, no time player or no data
layers.

| Kind | Apps | Row of tabs and words | Key column | Caption band | Player | Readout card | Focus mode |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A map with time | Shelf Atlas, World Oil & Gas (the reference pair too) | views, then layer words | zoom, the whole map, display toggles | legend, caption line or key | yes | the tapped place | yes |
| A 3D view with time | Milky Way (dates, at its Solar System scale), Besseggen (the sun's hours), Norne Reservoir (the production history) | scales, views or properties | the view's keys | legend where color is data, caption line, key | yes | the selected object | yes |
| A 3D view without time | Anatomy | layers | the view's keys | caption line | no | the selected structure | yes |
| A game | Snug Kart | racers and tracks, as words | no | none; the credits are in About | no | no | no: the race is already the view |
| Panes from a pull | Running Dashboard, Finances, World News, Outdoor Window, Power Hours | panes, as tabs | no | none since 2026-10-06: each pane's own keys and one short label (§11) | no (a pane may plot time on an axis) | a tapped bar, hour or item | no |
| One live card | Hello Live | no | no | none since 2026-10-06: the card's key (§11) | no | no | no |

Every kind carries the header (§4.2), About (§4.8), notices and the live region (§4.9), the motion
rules (§4.12), landscape (§4.13) and safe areas (§4.14). Since 2026-10-06 every kind also takes the
front rule (§4.15), and the six pane apps (Finances, World News, Running Dashboard, Outdoor Window,
Power Hours, Hello Live) the register (§11). The credits column this table had until then is gone:
no kind carries credits on its front.

### 4.1 The frame

The layout at 390 × 844 (heights in CSS px; safe-area insets are added outside them; ART 308-335):

```
┌──────────────────────────────────────────┐
│ App name                         [units] │ 22  the name, 15/650; the units key
│ Updated 04:15                            │ 16  the stamp, 11.5, --ink-2, one line (opens About)
│ View  View │ Word  Word  Word  Word  …   │ 44  tabs, a divider, then words (scrolls inside)
├──────────────────────────────────────────┤
│ [readout card]                     [key] │
│                                    [key] │     the plate: the data, edge to edge,
│              the plate             ───── │     the key column at its right edge
│                                    [key] │
├──────────────────────────────────────────┤
│ Title, level        ▕▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▏    │ 30  the legend: title, bar, ticks
│                     0   10   20  36 m/s  │
│ The caption line: what the picture is    │ 30  fixed height, whatever it says
├──────────────────────────────────────────┤
│ Wed 23 Sep, 11:00         +36 h, 8 d ago │ 28  the one large figure; the lead
│  ‹   ■▶   ›   ──────●────────·────────── │ 44  the transport; the app's own track
│                Tue  Wed  Thu  Fri  Sat   │ 14  period labels
└──────────────────────────────────────────┘
```

- `body` is a column: header, plate, caption band, player. The plate takes the rest
  (`flex: 1 1 auto; min-height: 0; overflow: hidden`), and the page is `100dvh` with
  `overscroll-behavior: none` (CSS 48-64, 171-180). A pane app scrolls its pane's content inside
  the frame, so the header and the caption band stay put.
- Nothing is pasted on the plate but the keys, the tapped readout, a notice and the ghost key
  (ART 25-27).
- The diagram is the front as amended on 2026-10-06 (§4.15): the stamp is one line with no source
  token, and the credit line that closed the caption band is in About.
- Content is left-aligned. The only centered things are a notice's sentence and the Play key's
  glyph (ART 341-342).
- Side gutters are 16 px plus the safe-area inset, 20 px from 700 px of width; the player's are
  12 px (CSS 90, 330, 364, 430-432).
- The page never scrolls sideways. It holds at 320 px wide and at 125 % text zoom (DESIGN 670-671).
- The page declares `<html lang="en-US">` and a viewport of `width=device-width, initial-scale=1,
  viewport-fit=cover`, never with `user-scalable=no` (HTML 2, 5; DEC 58).
- No rule under the header: the plate's edge is the edge. The player has a 1 px `--line` rule on top
  (ART 344; CSS 366).

### 4.2 The header

- **The name**: an `h1`, 15 px, 650, line 22 px, `translate="no"` (CSS 93; HTML 20). It is the
  name in `miniapp.json`, by which the marketing camera opens the app (§7.4): never rename an app.
- **The stamp**, under the name: when the data was made, in words. A `<button>` that opens About,
  with `aria-haspopup="dialog"`, described as *Opens About this data.*, its hit 44 px tall
  (HTML 21-22; CSS 95-109; DEC 289-295). Its words: `Updated 04:15`, or `Updated 22 Sep, 04:15`
  when not today (ART 350-353; APP 1908-1911). **One line at 390 px in every state, and no source
  token** (amended 2026-10-06, §4.15): the model run Global Weather wrote after the time
  (`GFS 06Z 22 Sep`), a feed's name or a retrieval date is About's *This data* (Global Weather's
  `Model run` line already holds the run). A stale or ran-out state
  leads with a sentence in `--ink` while the rest stays `--ink-2`: `Stale. Updated …`,
  `Forecast ran out 4 d ago. Updated …` (APP 1912-1920). Words, never color. The threshold is stated
  in the app's `DESIGN.md` (Global Weather: 30 hours; APP 135). While loading, the stamp counts with
  a real ellipsis: `Unpacking the forecast… 12 of 41` (ART 468-469).
  - *Data that is built once and never refreshed* (an ephemeris, a terrain, a body, a reservoir
    model): **amended 2026-10-06** (§4.15). Until then the stamp named the data's edition (its
    source and date). Now the stamp's line shows only while the data loads (its count) or when it
    fails, and is `hidden` once the data is in, because there is no status left to state; the
    edition is About's first *This data* line. About opens from a text key named `About` at the
    header's right, as a game's does, with `aria-haspopup="dialog"` and a 44 px hit; in focus mode
    that key moves into the caption band as its first line, as the stamp does (§4.10).
  - *No data to date* (a game): no stamp. About opens from a text key named `About` at the header's
    right.
  - *Example data* (a demo the data marks as one: Finances' `synthetic`, Running Dashboard's
    `demo-` activity ids, Outdoor Window's `demoPlace`): the stamp leads with `Example data.` in
    `--ink`, in place of `Stale.` or `Forecast ran out …`, because an example never refreshes
    (§11.1 rule 8).
- **The units key**, at the right: a word key, not a pill. The unit (`m/s`, `°C`, `km/h`) in 600 at
  12.5 px inside a 1 px `--line-strong` frame, 28 px tall, 6 px radius, a 44 × 44 hit, its
  accessible name `Change units, now m/s` (ART 344-348; CSS 110-123; APP 2036). Each press cycles
  one quantity's units, SI first and the US units one tap away (DESIGN 406-408; SHOOT 401-406).
  *Nothing to convert*: no key.

### 4.3 The row of tabs and words

Global Weather's header ends in one 44 px row: `Map` and `Globe` as tabs (`role="tab"`,
`aria-selected`), then a 1 px `--line` divider 14 px tall, then the layer words (`aria-pressed`
buttons in a `role="group"`), each a 44 px-tall hit, 16 px apart, in full: Wind, Temperature, Rain,
Cloud, Pressure, from the data's own labels. The row scrolls sideways inside itself on a narrow
screen (`overflow-x: auto`, scrollbar hidden, `scroll-padding` 16 px); the page never does
(ART 357-365; CSS 125-152; HTML 24-31).

**The tracer marks what is chosen.** The chosen word is set at 620 in `--ink`; under it runs a 2 px
line as wide as the word plus 4 px, fading from transparent at its left end to `--ink` at its right,
ending in a 4 px disc: the streak glyph, the one mark the chrome borrows from the plate (ART 360-363;
CSS 153-167). Unchosen words are 400 in `--ink-2`. It draws in from tail to head over 160 ms,
animating `clip-path` only (ART 522). It is the house's selection mark in every app.

- Words in full, never abbreviated ("Temperature", not "Temp"; ART 67-70). No swatches: the legend
  shows the scale (ART 365).
- A word key's accessible name is its visible words; a sentence that explains it is its description
  (`aria-describedby`), as Global Wind's `Speed colors` does to meet WCAG 2.5.3 (WIND 27-33).
- *Panes* (Running Dashboard's `Now`, `Health`; Finances' `Overview`, `Spending`; World News'
  regions; Outdoor Window's `Windows`, `Hours`) are this row's tabs. Keep them `<button role="tab">`
  with their exact visible text: the camera finds them as buttons by name (SHOTS 288-299, 340-359;
  CAM 191-198).
- *Property and mode chips* (Norne's `Oil`, `Pressure`; Shelf Atlas's `Rate`, `Cumulative`; Milky
  Way's scales) become words with the tracer, keeping their role (`radio`, `tab` or button) and
  their accessible names: the camera finds them by label (SHOTS 603-627, 726-742). Milky Way's
  camera taps the lowest element on screen named like the scale, because the title reads Milky Way
  too, so wherever the scale words go, each stays the lowest element with its name (CAM 437-456).
- *No views and no layers*: no row; the header is two lines. *One layer that can be switched off*:
  one word toggle at the row's right, as Global Wind's `Speed colors` (WIND 27-35).

### 4.4 The key column of plates

Over the plate's right edge, inset 8 px (plus the right safe-area inset): plates of `--sheet`, each
38 px wide with a 1 px `--line` edge (36 px inside it), a 6 px radius and no shadow, 8 px apart
(ART 367-370; CSS 186-204). Each key is a 44 × 44 button laid over its plate, 4 px past each edge, so
it reads as 36 × 44 and hits as 44 × 44 with no overlap (CSS 205-214; DEC 175-176). Keys in one plate
are separated by 1 px `--line` hairlines inset 4 px (CSS 215-223).

- **Marks**: 16 px drawings in 1.5 px strokes with round caps and joins, `--ink-2` at rest and
  `--ink` when on (CSS 78-79; HTML 44-54). Each mark is drawn so it cannot be read as another app's
  icon: Whole world is four corner brackets around a small circle, not a globe beside the Globe tab;
  Night is a globe with its night side filled and the equator drawn, not a moon or the system's
  contrast glyph; Flow is three curved streaks with dot heads, not a list (ART 371-381; DEC 310-320).
- **States** (all toggles carry `aria-pressed`): on, the mark in `--ink` over the 28 × 28 on-plate
  of `--ink` at 12 %, the key visibly held down; off, `--ink-2` and no plate; pressed, the plate at
  22 %; hover, only under `@media (hover: hover)`, a 7 % plate; focus, the 2 px ring
  (ART 383-390; CSS 225-230, 425-429). Every control has `touch-action: manipulation` and
  `-webkit-tap-highlight-color: transparent`, because the pressed plate replaces the flash
  (CSS 66-76).
- **Icons only here**, in the transport, for ✕ and for the focus marks. Everything else is a word
  (ART 555).
- **Order**: the view's keys first (Zoom in, Zoom out, the whole view), then display toggles, then
  Hide the controls alone in the last plate (ART 371-381).
- *A 3D view*: the same column holds the view's keys (fit the whole thing, as Norne's
  `Show the whole field`, which the camera taps; CAM 252-259), its display toggles, and Hide the
  controls. *A pane app or a card*: no column.
- *A plate too short for the column* (a phone on its side): the keys run as a row along the plate's
  top, never as a second column over the data (ART 494-498; CSS 232-236).

### 4.5 The caption band

Under the plate, on `--page`: 11 px at 15 px line height in `--ink-2`, 16 px gutters (CSS 326-336).
It holds only these, and nothing else (amended 2026-10-06: the front rule, §4.15, which lists the
same): the legend; the scale or the instrument line (north, a scale bar, a vertical exaggeration);
the caption line; a key; and, where the app's signature lives in the band, the signature itself
(World Oil & Gas's Ledger). Each is there only when reading the view needs it. The three numbered
below are the ones every kind uses.

1. **The legend.** Its title is the quantity the bar measures, from the data (`Wind, 10 m above
   ground`), 600 at 11.5 px in `--ink`. The bar is 6 px tall and takes the remaining width (at
   least 150 px), painted from the same stops at the same alpha over the theme's ground, so the
   scale under the plate is the scale on it; a 1 px `--line-strong` frame at 60 %, square ends, no
   radius. Its ticks are 1 × 3 px marks at the true positions with 10.5 px labels; the unit follows
   the last label after U+202F; negatives take U+2212; an end the data went past prints open
   (`≤ −40`, `≥ 36 m/s`) (ART 393-399; CSS 338-349; DEC 327-328; APP 2021-2023). The range is fixed
   and printed, never stretched to what is on screen (ART 564-565).
2. **The caption line**: what the picture is, in the words a reader needs to read it: the
   signature's caption with its numbers (§5.2 test 3), a scale's words, a state. Never a credit, a
   method sentence or a sentence a key could replace (§4.15).
   Global Weather's states the exposure, `Streaks: 1 s = 24 h of wind at the hour shown`, adds
   `, faster toward the poles, where the map stretches` once the view passes 45°, and says what the
   arrows mean when they replace the streaks (ART 400-408; DESIGN 252-271). **Its height is fixed**,
   two lines below 640 px of width and one from 640 px, whatever it says, because a line that grew
   and shrank with its words would resize the plate, which changes the view, which changes the
   words: near 45° that loop resized every canvas about 22 times a second (CSS 351-357; DEC 225-233).
   Its numbers go through `js/units.js`.
   - *What it states elsewhere*: whatever the picture cannot be read without. A rate or an exposure;
     a vertical exaggeration; the viewer's distance (Milky Way's `You are 1.0 AU from the Sun`,
     whose words the camera waits for; CAM 425-435); an explode amount; a projection's stretch;
     what one bar or one dot is in a chart.
3. **A key**, where the picture has marks the legend bar does not explain (a well's role, a ring,
   a hatched share, a window's frame): 10 px drawn swatches with a 2 px radius, or the marks
   themselves drawn small, each with its word at 11.5 px `--ink-2`, in one row (§4.15). It replaces
   the sentence that said the same thing.

**No credits** (amended 2026-10-06). Until then the app's credit constant closed the band, byte for
byte, 10.5 px `--ink-2`, on screen in every mode, focus mode included (ART 409-411; DEC 23-24). It is
now the first paragraph of About's *Sources and credits*, byte for byte, its middle dots kept because
its words are fixed by license (§4.8); §4.15 says how each license is still met, and names the two
exceptions that stay beside the data.

*No color scale*: the band holds the caption line and a key. *A pane app*: no band (§11.1 rule 1),
or only a §4.15 exception's one line; each pane carries its own keys and at most one short label. *A game*: no band; the credits live in
About.

### 4.6 The player

The player is the band at the foot of the screen, on `--page`, for an app whose data moves through
time (ART 413-438; CSS 360-380; HTML 89-100).

- **The time row.** The valid time is the screen's one large figure: 600 at 21 px, line height 1,
  tabular, built by hand in `js/units.js` from the phone's clock, 24-hour and day before month, the
  same on every locale: `Wed 23 Sep, 11:00`. VoiceOver hears it in words (`Wednesday 23 September,
  11:00, 36 hours after the run`). At the right, the lead in 12.5 px `--ink-2`: `+36 h, 8 d ago`, or
  `+30 h, now`. Nothing in the row ever transitions (ART 413-417; UNITS 50-61, 89-93).
- **The transport**, three 44 × 44 keys. Previous step and Next step are drawn chevrons, 1.5 px
  strokes 10 px tall, in `--ink-2`. **Play is the one solid control in the app**, the shutter
  release: a 32 × 32 `--ink` square with an 8 px radius and a `--page` triangle; while playing, two
  2.5 px bars. Its mark always matches its name, `Play` or `Pause`, and it changes without animation
  (ART 419-424; CSS 372-375; HTML 95-97; DEC 234-236). The step keys say the new time in words through the live
  region (APP 2705-2709).
- **The app's own track** replaces `<input type="range">` (DESIGN 334-337): an element with
  `id="slider"`, `role="slider"`, `tabindex="0"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
  set to the **shown** step and `aria-valuetext` in words (`Wednesday 23 September, 14:00, 39 hours
  after the run`), drawn on a 58 px canvas, its hit at least 44 px tall (HTML 98; CSS 376-378;
  TRACK 9-11). What it draws (TRACK 39-106; ART 426-438):
  - a 1 px `--line-strong` baseline, inset 10 px from each end;
  - from the first step to the shown one, 2 px of `--ink`: the exposure so far;
  - one 3 px `--ink-3` tick at 50 % under the baseline per step;
  - at each period boundary (Global Weather: local midnight), a 7 px `--ink-2` tick with a 10.5 px
    label under it (`Wed 23`, or `Wed` when the space measured is short), labels that would collide
    skipped;
  - **`now`**: when the present falls inside the data, a 1 × 9 px `--ink-2` notch rising above the
    baseline with `now` over it in 10.5 px `--ink-3`; when the data has run out, no notch, and the
    stamp says so;
  - **the thumb is a tracer head**: an 8 px `--ink` disc on the baseline with a 3 px `--page` ring
    and a 1.5 × 18 px `--ink` rule through it, 10 px while pressed, an instant change. It always
    stands at the shown step and never glides.
- **Input**: a `pointerdown` anywhere on the track captures the pointer, stops play and jumps to
  the step under the finger, with no slop and no thumb to find; `pointermove` sets the wanted step;
  ← → (and ↑ ↓) move one step, Page Up and Page Down eight, Home and End to the ends (TRACK 108-136;
  DESIGN 338-351).

**The scrub rule (must).** On every drawn frame, the picture, the thumb, the time row,
`aria-valuenow` and the readout show the step under the finger. The frame draws the wanted step and
then sets `shown` to it; everything that carries a step reads `shown`; the draw is aligned to the
animation frame rather than run inside the handler; every step's data is decoded ahead, so a step
change is a lookup; a flick that crosses three steps in a frame draws the third and never the two it
skipped (DESIGN 340-358). Where a frame cannot be ready in the input's own frame, **the newest
request is drawn first**, stale ones are dropped, reading runs ahead in the drag's direction through
the cache play uses, and any low-resolution preview hands over to the full frame within a frame or
two of the finger slowing. The owner asked for this after Earth's History went soft on a fast drag:
the drag is the main way these apps are used and shown, not a degraded one. The test counts preview
frames and the handover time (§7.2).

**Play** runs on a clock (DEC 245-248). Under Reduce Motion it still plays, in whole steps at the
same rate, so no frame is a blend of two steps (ART 538-539; DESIGN 280-283). About holds play
still; closing it shows the hour it opened on, and play goes on from there (DESIGN 288-289;
DEC 269-271). A touch on the track during play stops it and lands on the step under the finger
(SHOOT 540-547).

- *Years* (World Oil & Gas): the figure is `1987`. *Months* (Shelf Atlas): `Mar 1987`. *Dates*
  (Milky Way): `23 Sep 2026`, with the clock only when the step is shorter than a day. *Hours of
  one day* (Besseggen's sun): `14 Jun, 07:00 CEST`, keeping the zone, which the camera waits for
  (CAM 413-423). Period ticks fall at decades, years or days, as the span needs.
- *Keep the camera's names*: `Play` and `Pause` (World Oil & Gas, Shelf Atlas; CAM 261-266, 385-388;
  SHOTS 751-756), `Play production history` (Norne; CLIPS 166-171), `Back one year` (Shelf Atlas;
  SHOTS 716-722), Milky Way's `Play` (CLIPS 41-51).
- *Other sliders* (an explode amount, a slicer, an exaggeration, a pace) are drawn in the same
  language: a baseline, the value so far, a tracer-head thumb. A tap anywhere on the track takes the
  value under it, which is how the camera drives Anatomy's `Explode amount` (CAM 84-98;
  SHOTS 583-585). Their names stay.
- *No time*: no player. The plate takes the space, and the caption band is the last band.

**Two rules every player carries, learned twice (Global Weather's Flow pass, Besseggen's pass):**

- *The Play key shows the pause bars while playing.* Toggle the icons with
  `toggleAttribute('hidden', …)` or by hiding a wrapping element: an SVG element has no `hidden`
  property, so `svg.hidden = true` only creates an expando and the triangle never changes.
  `shoot.mjs` asserts, while playing, that the pause mark is displayed and the triangle is
  `display: none` — by computed style, never by reading the property back.
- *A frame that draws the step already drawn does no work.* Play and the scrub call for a frame
  per input, but the expensive parts (a shadow sweep, a census, a texture upload, a readout
  rebuild) run only when the step, the view or the marker changed since the last draw. Keep a
  counter of the expensive runs and let `shoot.mjs` assert it does not grow across a second of
  play at a fixed step.

### 4.7 The readout card

The one card on the screen, for the thing that was tapped (ART 440-451; CSS 268-305; HTML 65-73). A
pane app's section plates (§11.1 rule 4) are sections, not cards: they hold the pane's content, open
nothing and never float.

- `--sheet`, a 1 px `--line-strong` edge, an 8 px radius, no shadow, no blur. It sits top-left on
  the plate, inset 8 px, at most 280 px wide. When it would cover the point that was tapped, it moves
  to the bottom-left, so the marker is never under its own card; labels are not drawn under it or
  under the keys (DEC 272-275, 332).
- The place line, 12.5 px `--ink-2` (`27.0° N, 1.5° E`), with ✕ at the right: an SVG, a 44 px hit,
  named `Close`. The value, 21 px and 600, with its unit at 13.5 px after U+202F. A direction is a
  drawn glyph, never the ➤ character. Other rows are a `dl` at 12.5 px: labels `--ink-2` at the left,
  values `--ink` at 560, right-aligned.
- It appears with a 120 ms fade and a 4 px rise, and leaves at once (as built: APP 2089-2091). Its
  text is updated in place, never rebuilt per frame (DEC 301-303).
- A tap announces the place, the value and its unit in words, the descriptive line, once:
  `3.9 degrees north, 108.8 degrees west. Wind 5.4 meters a second. From SSW (202°), gentle breeze,
  Beaufort 3.` (DEC 299-300).
- Focus mode closes it on the way in; a tap in focus mode opens it again, inset below the top safe
  area (ART 487-488; CSS 286).
- *In other apps* it holds the selected thing: a planet, a structure, a cell, a field, a country, a
  bar of a chart. *Nothing to tap*: no card.
- **A card opens on a tap, never on a swipe.** A vertical swipe that starts on a chart or a map
  scrolls the pane, opens nothing and says nothing to the live region; the chart's or map's touch
  handler yields to the scroll until the finger has moved mostly sideways or has held still. Running
  Dashboard's reviewer found every scroll on its pane apps popping a card and a sentence
  (2026-10-02); the pane apps that take the pattern after it carry this rule from the start.

### 4.8 About

A full-height `--sheet` panel that slides up over 220 ms on `--sheet-in` and closes at once
(ART 453-464; CSS 382-419; HTML 102-129; APP 2208-2229).

- **One tap away on every screen** (2026-10-06): from the stamp, or, where the data was built once
  or there is none, from the `About` text key at the header's right (§4.2); in focus mode from the
  same control, moved into the caption band (§4.10). A pane app also ends every pane with the text
  key *Sources, method and credits are in About.* (§11.1 rule 1).
- `role="dialog"`, `aria-modal="true"`, labeled by its 15 px, 650 title. `Close` is a text key at
  the top right and again at the foot; Escape closes it; Tab is held inside it; focus returns to
  what opened it; `overscroll-behavior: contain`.
- **Sections**, each headed at 13.5 px and 650 in sentence case and separated by a 1 px `--line`
  rule, never cards. Prose is 13.5 px at line height 1.5, at most 62 characters wide.
  1. **What the picture is**: what the signature shows, and what it does not (Global Weather: a
     streak's length and speed on the flat map are not the wind's strength; where streaks gather is
     partly the picture; HTML 107-111; DEC 240-244).
  2. **This data**: `label: value` lines, one per line, no middle dots.
  3. **Sources and credits**: first the app's credit constant, byte for byte, in a paragraph of its
     own (the line that closed the caption band until 2026-10-06, §4.5); then each source's
     statement, the license texts as printed text, not links, any address printed without its
     scheme (no shipped script may contain one; DEC 182-183), and the font's credit line. Every
     attribution a license requires is here, word for word (§4.15). **One exception (2026-10-06)**:
     where a source's own terms ask for a link, About carries it as an anchor in `index.html`'s static
     markup, its visible text the address without its scheme: Outdoor Window's license link,
     `<a href="https://creativecommons.org/licenses/by/4.0/">creativecommons.org/licenses/by/4.0/</a>`,
     which Open-Meteo's *"provide a link to the licence"* asks for and which left the footer with
     §4.15's exception 1. `check.mjs` pins each such anchor by its exact string, and no script writes
     one.
  4. **How the data gets here.**
- While About is open, the app draws nothing under it and play waits (DESIGN 288-289).

**A search field, if the app has one (learned on Milky Way and again on Anatomy):** a native
`<input type="search">` draws the browser's own clear button in the browser's accent blue once
text is typed — invisible in a screenshot of the empty field, a chroma violation the moment someone
types. `appearance: none` on the input does not remove it; the field needs its own
`::-webkit-search-cancel-button { appearance: none }` (and `-webkit-appearance`), and `shoot.mjs`
types into the field and asserts no blue-led pixels at its right end.

### 4.9 Notices and the live region

- **A problem with the data is a sentence on the plate**, never a blank screen: a `--sheet` plate
  with a 1 px `--line-strong` edge and an 8 px radius, 13.5 px `--ink`, at most 300 px wide,
  centered, with no icon and no colored bar, `role="alert"` (ART 466-468; CSS 307-324; HTML 75). It
  says what is wrong in the file's terms and does not apologize: `data/snapshot.json could not be
  read (HTTP 404)`, `… is not valid JSON; it looks like a web page was written over it`
  (SHOOT 822-827). A broken replacement keeps the data that was showing, says so, and keeps the view
  (DESIGN 290-292; SHOOT 857-861).
- **One polite live region**, `<p class="sr" aria-live="polite">` (HTML 131), for sentences: a
  tap's readout, the step keys' new time, focus mode's two sentences, a refused press (`The flow is
  off while Reduce Motion is on.`; DESIGN 278-280). Never once per frame, and never twice for one
  event: a focused `role="slider"` announces its own value, so the track's arrow keys add no sentence
  (DEC 297-298).
- Staleness never pulses, and numbers never count up (ART 530-531).

### 4.10 Focus mode

For every app whose hero is a view: the maps and the 3D views (§4.0). The view alone, plus the one
control it needs (DESIGN 371-400; ART 471-488; APP 2461-2486, 2705-2717, 2791; CSS 239-266, 421-423).

- **Into it**: a key named exactly `Hide the controls`, alone in the key column's last plate. Its
  mark is the screen it leads to: a 15 × 14 px frame with 1.5 px corners holding one streak glyph
  and, inside the frame, a 9 px line with a 3 px dot, the track that stays (ART 473-476; HTML 54).
  An app that already enters focus mode by a gesture keeps the gesture as a second way in when the
  camera uses it: Besseggen's double-tap on the terrain (CLIPS 109-115). On a map, a double-tap keeps
  zooming and never toggles focus mode (DESIGN 379-380).
- **Out of it**: the ghost key, named exactly `Show the controls`, with
  `aria-keyshortcuts="Escape"`, in the plate's top-right corner where the column was, inset 8 px
  below the top safe area and 8 px from the right one: in Snuggery's full screen the plate starts
  under the status bar once the header has gone. A 44 × 44 hit, no plate, the same mark with a 15 px
  line 3.5 px above the frame (the header returning), drawn with the halo of §3.1, resting at 72 %
  opacity and full on hover, focus and press; nothing is drawn under it (ART 477-484; CSS 242-266;
  HTML 58-63; DEC 253-255, 339). And **Escape**, when About is closed (APP 2713-2717).
- **What leaves**, each `hidden` and `inert`, so out of the tab order and the accessibility tree:
  the header (name, units key, tabs and words), the key column, the legend's bar and ticks, any sheet
  of controls, and an open readout card, which closes on the way in (DESIGN 381-384; APP 2469-2476).
- **What stays**: the plate with the data as chosen; the player (the time row, the transport and the
  track) or, without one, the one control the view needs; **the stamp** (or, where there is none,
  the `About` key, §4.2), moved into the caption band as its first line with its words unchanged, its
  hit running down over the caption, never up into the plate (DEC 191-195; CSS 109); the caption line
  and the key; any notice. A tap still opens the readout (DESIGN 385-390; ART 485-488). **The credits
  no longer stay** (amended 2026-10-06), because they are no longer on the front (§4.15); About
  stays one tap away through the stamp or the key.
- **Remembered** between launches under the app's own prefix (`gwe.focus`, `'1'` or `'0'`) and
  restored before the first draw (DESIGN 391-393; APP 2468, 2791).
- **VoiceOver**: the live region says `Controls hidden. Press Escape or the corner key to show them.`
  and `Controls shown.` Focus moves to the ghost key, and back to the entry key, only when the
  keyboard did it (`event.detail === 0`); after a touch, nothing is ringed (DESIGN 394-396;
  APP 2479, 2485, 2710-2712).
- **The plate takes the freed rows** through the normal resize path: the chrome fades out over
  160 ms, the canvases resize once and never blank, the ghost key fades in over 200 ms; under Reduce
  Motion every change is instant (DESIGN 397-399; ART 525).
- **The camera**: a library left in focus mode hides the controls the camera taps. Its guard taps
  `Show the controls` when it exists (CAM 400-411), which is why the name is exact; the lead calls it
  for each app that gains a remembered focus mode (DEC 196-202).

### 4.11 The opening

**Default: none.** The arrival is the data appearing. Global Weather's first frame after unpacking
starts its trails empty, and the streaks write themselves in over the 0.6 s a trail lives; a touch
during them works at once; there is nothing to store or skip (ART 502-509). An app may have an
opening only if it is the data replayed at a stated speed, as Earth's History plays 750 million
years in five seconds, US Quakes writes the last 30 days onto its paper, and Warming World runs 1880
to now (EH 67-72; UQ 335-344; WW 43). It then must: run once, its stored flag written before it
starts; end at its final state on any touch, any key or a hidden page; never run under Reduce Motion
or without data; offer a key named `Skip`; and be taught to the camera by the lead in the same
commit, as its waits are (CAM 278-285, 316-323, 353-374).

### 4.12 Motion and Reduce Motion

Two curves (ART 513-518; CSS 26-27):

| Token | Curve | For |
| --- | --- | --- |
| `--draw` | `cubic-bezier(0.2, 0, 0, 1)` | things that answer a touch: the selection tracer, the card, the ghost key, a camera move to a chosen object |
| `--sheet-in` | `cubic-bezier(0.32, 0.72, 0, 1)` | About sliding up |

| What | How |
| --- | --- |
| The selection tracer moving to a new word | draws in from tail to head, 160 ms, `--draw`, by `clip-path` |
| The readout card | in: 120 ms opacity and a 4 px `translateY`; out: at once |
| About | in: 220 ms `translateY` on `--sheet-in`; out: at once |
| Focus mode | the chrome fades out over 160 ms; the canvases resize once and never blank; the ghost key fades in over 200 ms |
| The thumb, the time row, the lead, the legend's numbers, the caption line | **no transition, ever** (`check.mjs` fails on one) |
| The signature | its own motion, if it moves, is the data's and nothing else |

(ART 520-527; CSS 165-167, 253, 266, 281-283, 380, 391-393, 423.)

- Only named properties, never `transition: all`, and only `transform`, `opacity` and `clip-path`
  (ART 529). Every animation is interruptible: a touch mid-transition lands at the final state
  (ART 530).
- No entrances. The one continuous motion is the data's; the small transitions answer a touch
  (ART 591).
- A camera move that answers a touch (a flight to a planet, a scale change) takes `--draw`'s curve,
  lasts what the distance needs, and ends at its destination on any touch. The camera waits these
  out with fixed pauses (SHOTS 697-708), so a pass never lengthens one without the lead changing the
  wait.
- **Reduce Motion** (`prefers-reduced-motion: reduce`, read live with a `change` listener): every
  duration is zero (`*, *::before, *::after` set to `0s`; CSS 465-467); continuous motion stops or
  takes its still form, which must say the same thing (Global Weather draws arrows in place of
  streaks; DESIGN 275-280); flights become cuts; play still plays, in whole steps (ART 533-539).
- **Hidden** (`visibilitychange`, `pagehide`): every loop stops and anything that trails clears, so
  a return never shows a frame from before; a return re-reads the data (ART 541-543; DESIGN 284-287).

### 4.13 A phone on its side

At `(orientation: landscape) and (max-height: 500px)` each band gives the plate its second row
(ART 490-498; CSS 434-464; DEC 276-284):

- the header is one 46 px row: the name over the stamp at left, the tabs and words in the middle,
  the units key at right;
- the caption band sets the legend and the key side by side, over a one-line caption (until
  2026-10-06 the credits stood beside the legend; they are in About now, §4.15);
- the player is one row: the time row stacked at left, then the transport and the track;
- the key column becomes a row along the plate's top whenever it would not fit the plate's height.

At 844 × 390 Global Weather's plate is 234 px tall, against 136 px with the upright layout. The test
holds it at 220 px or more, the keys in one row at most 40 px high (SHOOT 882-885).

### 4.14 Safe areas

`viewport-fit=cover` (HTML 5), and every band pads itself (CSS 90, 190, 244-245, 271, 286, 330, 364,
399, 408): the header `6 px + top` and `16 px + left/right`; the caption band `16 px + left/right`;
the player `12 px + left/right` and `bottom`; the key column `8 px + right`; the readout card
`8 px + left`, and `8 px + top` in focus mode; the ghost key `8 px + top` and `8 px + right`;
About's head `top`, its body `16 px + bottom`. **A pane app with no band** (2026-10-06, §11.1 rule
1) pads its pane body's foot itself, `calc(28px + env(safe-area-inset-bottom))`, because the band
that carried the bottom inset is gone and the pane's last control (the About key) would otherwise
rest under the home indicator; Outdoor Window, which keeps its one-line footer, leaves the inset on
the footer. Headless Chromium has no safe areas, so `check.mjs` pins the declaration and the phone
checks the result (DEC 253-255).

### 4.15 The front of an app (the owner, 2026-10-06)

The owner: *"data origin/licenses etc shpuld not take up too much space - would be better to have
inside the views if we have to show it clearly?"* It binds all eighteen apps, the three with their
own directions included, and it overrides every earlier rule that put a source on the front (§4.2's
edition stamp, §4.5's credit line, §4.10's credits in focus mode, §6.5's "on screen in every mode").

**Rules (must).**

- **The front** is what is on screen when the app opens, and what each tab, view or word shows when it
  is chosen. It holds the app's name, the view, its controls and **at most one status line**. Nothing
  else.
- **The status line is the stamp** (§4.2): when the data was made, and any state that needs a
  sentence (`Stale.`, `Forecast ran out 4 d ago.`, `Example data.`, a loading count, an error). It is
  one line at 390 px in every state and names no source. A model run, a feed's name and a retrieval
  date are About's *This data*. Data built once has no status once it is in (§4.2), so its line hides
  and an `About` key takes its place at the header's right.
- **Sources, licenses, retrieval dates and method sentences live in About**, one tap from every
  screen and every mode. The app's credit constant is the first paragraph under *Sources and
  credits*, byte for byte; each source's full statement follows (§4.8). Every attribution a license
  requires stays there word for word. `NOTES.md`, `CREDITS.txt` and `ART.md` say "in About" wherever
  they said "on screen" or "under every screen".
- **The caption band keeps only what reading the view needs** (§4.5): the legend; the scale or the
  instrument line; the caption line (the signature's caption with its numbers, a state); a key; and,
  where the app's signature lives in the band, the signature itself (World Oil & Gas's Ledger). It
  holds no credit line, no method sentence and no sentence a key could replace. A sentence that only says what a mark means
  ("Ink: hours a rule rules out. Green: how much of its limit an hour uses.") becomes a **key**: 10 px
  drawn swatches with a 2 px radius, or the marks drawn small, each with its word at 11.5 px
  `--ink-2`, in one row. Where a fixed-height line loses words, its height shrinks to what the longest
  form still needs at 320 px wide (§4.5's fixed-height rule stands; `shoot.mjs`'s longest-caption check
  proves it).
  - *One dated departure, Norne Reservoir* (2026-10-06; plan 0012's package 3.4: *"Cut the caption to
    the legend and the scale, and move the rest into About"*, after the owner's *"Norne full screen
    mode has too mich text at the bottom, just above time slider"*). Norne's band keeps its legend,
    its instrument line (north, the scale, `vertical ×5`), the well key and a key for the cut; the
    cut's sentence with its month's oil, water and water cut leaves the front. §5.2 test 3 is met for
    Norne by the cut's key on the track and by the month's figures in the rates chart under More
    controls, and Norne's `ART.md` records the departure. **The lead confirms, before Norne's build,
    that the well key and the cut's key read as part of "the legend and the scale"**; until then
    `docs/plans/0012-change-lists.md`'s Norne item 4 waits.
- **Text in the view that names what is drawn is the view's own** and stays: a period's name, Earth's
  History's `This map: Scotese map 49 · …`, a story's source on its own row in World News, a value's
  basis line where the data writes it (Finances' home index, Norges Bank beside its rate).
- **Two exceptions, and only these**, each named in the app's `NOTES.md` with the terms quoted, and
  pinned by `check.mjs` by file and exact string:
  1. *A source whose own terms require its credit beside the data* keeps only what those terms
     require there, as one short line at the foot of the drawing or band that shows the data, 10.5 px
     `--ink-2`. Anything the terms do not require beside the data (the rest of the credit, the
     license's name and address, the modification sentence) is in About. The lead's ruling of
     2026-10-06: each source's terms were read at the source that day, and these two require it, in
     these words:
     - **Open-Meteo** (Outdoor Window), <https://open-meteo.com/en/licence>: *"You must include a
       link next to any location Open-Meteo data are displayed, for example:"*
       `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`. The same page's
       other requirement, *"Attribution: You must give appropriate credit, provide a link to the
       licence, and indicate if changes were made. You may do so in any reasonable manner, but not in
       any way that suggests the licensor endorses you or your use."*, names no place, so the license
       link and the changes sentence are in About (§4.8 item 3). Outdoor Window's footer holds one
       line, the anchor `Weather data by Open-Meteo.com`, and nothing else.
     - **OpenStreetMap** (Running Dashboard: the routes of its template sessions, derived from
       OpenStreetMap, and the OpenStreetMap tiles a private copy fetches outside Norway and the United
       States), <https://osmfoundation.org/wiki/Licence/Attribution_Guidelines>: *"Attribution must
       be presented to anyone who uses, views, accesses, interacts with, or is otherwise exposed to the
       map or produced work. The attribution format should not require individuals to interact with
       the map or produced work to see the attribution."*; *"Attribution must be placed in the
       vicinity of the produced work or in a location where customarily attribution would be expected
       by the users of the produced work."*; *"Attribution must also make it clear that the data is
       available under the Open Database License."*; and *"The historical forms of attribution “©
       OpenStreetMap contributors” or “© OpenStreetMap” are acceptable."* Running Dashboard keeps one
       line under a route map that OpenStreetMap data drew, and only then: `Route: © OpenStreetMap
       contributors, ODbL.` (a template session's route), `Map: © OpenStreetMap contributors, ODbL.`
       (OpenStreetMap tiles under a route of the person's own) or `Route and map: © OpenStreetMap
       contributors, ODbL.` (both).

     **Map tiles whose terms do not require it are credited in About only**, read the same day:
     - **USGS The National Map** (Running Dashboard's demo tiles),
       <https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map>:
       *"Map services and data downloaded from The National Map are free and in the public domain.
       There are no restrictions; however, we request that the following acknowledgment statement of
       the originating agency be included in products and data derived from our map services when
       citing, copying, or reprinting: "Map services and data available from U.S. Geological Survey,
       National Geospatial Program.""* A request with no place; About prints the statement word for
       word.
     - **Kartverket** (Running Dashboard's tiles in a private copy in Norway; Besseggen's terrain),
       <https://www.kartverket.no/api-og-data/vilkar-for-bruk>: *"Dette inneber at Kartverkets namn
       skal visast i alle samanhengar der produkta eller uttrekk av produkta blir brukt, det vere seg
       applikasjonar, webløysingar, trykte produkt, illustrasjonar eller anna, på følgjande måte: ©
       Kartverket. Det skal også linkast til nettsidene våre der det er mogleg."* (the name shown
       wherever the products are used, in applications among others, as `© Kartverket`, with a link
       where possible). The terms name the application, not a place on the map, and CC BY 4.0's
       §3(a)(2) allows any reasonable manner, so About, one tap from the map, names Kartverket:
       Running Dashboard's as `© Kartverket` (`index.html` line 75), Besseggen's by its credit
       constant, `Terrain, trail, lakes and names: Kartverket, CC BY 4.0`, moved there unchanged.

     So Running Dashboard's `Map tiles: USGS The National Map.` and `Map tiles: © Kartverket.` leave
     the front for About, whose *Sources and credits* already names every tile source.
  2. *A use restriction a license attaches to the data shown* is a statement on the pane while it
     applies, at the pane's head (straight under its title), never a footer: Power Hours' `These prices are licensed for private and internal use
     only. Do not republish them.` for a zone not on the CC BY list.
  A safety statement is not a credit and stays where its app puts it (US Quakes' `Not a warning
  service`, on the map at every sheet height).
- **No other credit may stand on the front where a source's does not**, the app's own or the font's
  included. That keeps the older licenses' "at least as prominent as any comparable authorship
  credit" true by construction (the row for CC BY 2.x and 3.0 below).

**How each license family the apps use is still met.** The quotations are the license texts'; the
apps' `NOTES.md` quote each source's own terms and win where they ask for more.

| License family | Used by (2026-10-06) | What it asks of the attribution | How it is met now |
| --- | --- | --- | --- |
| **CC BY 4.0** | GeoNames (Global Weather, Global Wind), Kartverket (Besseggen; Running Dashboard's own tiles in a copy), Marine Regions and EMODnet (Shelf Atlas), Energy Institute via Our World in Data and Global Energy Monitor (World Oil & Gas), Energy-Charts and SMARD (Power Hours), Open-Meteo (Outdoor Window), Earth's History's sources | §3(a)(1): the creator and attribution parties, a copyright notice, a license notice and disclaimer notice, a link where reasonably practicable, whether the material was modified, and the license's address. §3(a)(2): *"You may satisfy the conditions in Section 3(a)(1) in any reasonable manner based on the medium, means, and context in which You Share the Licensed Material. For example, it may be reasonable to satisfy the conditions by providing a URI or hyperlink to a resource that includes the required information."* | About, one tap from every screen and named there by the stamp or the `About` key, prints the credit constant, each source's attribution, the license's name and address (without its scheme) and the modification sentence (`sampled`, `rounded by this app`, `the scores … are this app's`), word for word. Open-Meteo's own terms ask for more, so its link alone stays beside the data (exception 1); Kartverket's terms name the application, not the map, so `© Kartverket` is in About (exception 1's note). |
| **CC BY-SA** (2.1 JP, 4.0) and **CC BY 2.x and 3.0** | BodyParts3D (Anatomy, BY-SA 2.1 JP), AT-HYG and adapted textures (Milky Way, BY-SA 4.0), Global Voices (World News, CC BY 3.0: its attribution policy asks to *"give appropriate credit, provide a link to the license, and indicate if changes were made"*) | As CC BY; adaptations under the same license. The 2.x texts (2.1 JP among them) let the credit be given in any reasonable manner, but in an adaptation or collection it must *"at a minimum … appear where any other comparable authorship credit appears and in a manner at least as prominent as such other comparable authorship credit"*; 3.0 says the same of the credits for the other contributing authors. | As CC BY, and nothing else is credited on the front (the rule above), so About is where every comparable credit appears, the font's included. The share-alike notice for the adapted geometry and catalogs stays in About and `CREDITS.txt`, unchanged. World News: each story names its publisher on its own source line, where every publisher's name appears alike (the view's own text), with its author when the feed names one; the headline is the link to the original; About prints the license line with its changes sentence (*the summaries here are the feed's own line, shortened*). Clamping a summary to two lines on All is display only: the words are unchanged and a region's tab shows them whole. |
| **CC BY-ND 4.0** | The Conversation (World News), as its republishing page (`theconversation.com/au/republishing-and-media`) gives it | *"Credit the author(s) and their institution(s), ideally in the byline"*; *"Credit The Conversation with a link to our homepage or the original article"*; *"You may only edit to provide accurate references to time and place, or to comply with an editorial style. Any other edits need the author's approval."* | Nothing is derived: the headline is carried exactly as written and is the link to the original article, no summary is carried at all (so the two-line clamp never touches its text), and the byline is carried whole, institution included. Joining the byline to the source line (§11.1 rule 10) moves it, word for word, and changes none of it; About prints the license. |
| **CC BY-NC 3.0 IGO** | Gaia DR3 (Milky Way), as `CREDITS.txt` records it | As CC BY 3.0 for the credit; non-commercial use. | The credit as CC BY 3.0. Moving it changes nothing about the use; the terms stay as `CREDITS.txt` records them. |
| **ODbL 1.0** | the Norne benchmark model (Norne Reservoir); OpenStreetMap-derived routes (Running Dashboard's template sessions) and OpenStreetMap tiles (Running Dashboard, a private copy outside Norway and the United States) | §4.3: a Produced Work used in public must *"include a notice associated with the Produced Work reasonably calculated to make any Person that uses, views, accesses, interacts with, or is otherwise exposed to the Produced Work aware that Content was obtained from the Database … and that it is available under this License"*. | Norne: About's first *Sources and credits* line is the constant `Data: Norne benchmark, Equinor and the Norne partners via the Open Porous Media initiative, ODbL 1.0`, followed by the license's address; About opens from the `About` key on every screen and in focus mode, and `NOTES.md` carries the notice in the ZIP. OpenStreetMap routes and tiles: exception 1, under the map they drew. |
| **NLOD 2.0** | Statistics Norway's house price index (Finances), Sodir (Shelf Atlas), Kartverket's terrain (Besseggen, NLOD 2.0 / CC BY 4.0) | The licensor credited in the words it asks for (Sodir's, as Shelf Atlas's `NOTES.md` quotes it: *"Contains data under the Norwegian licence for Open Government data (NLOD) distributed by the Norwegian Offshore Directorate"*), a reference to the license, and no suggestion of endorsement. | About prints each licensor's statement word for word, the license's name and address, and the non-endorsement sentence where the app has one. Finances' home value keeps its basis line, which names the index beside the number it produced, as the data writes it. |
| **Terms of an agency, not a public license** | the North Sea Transition Authority's Open User Licence (Shelf Atlas: commercial exploitation not granted), the Danish Energy Agency and GEUS (no license stated), NLOG (no rights claimed); UN News (World News), whose terms (`un.org/en/about-us/copyright`) say *"News-related material can be used as long as the appropriate credit is given and the United Nations is advised."* | The attribution string each one asks for (Shelf Atlas's `NOTES.md` table); UN News: credit, and advising the UN. | About prints each string word for word, as the data carries it. UN News: each story names `UN News` on its source line, About carries both conditions, and advising the UN is the duty of whoever runs a copy, as World News' `NOTES.md` says. |
| **SIL OFL 1.1** | Ysabeau Office in every house app; Archivo, Atkinson Hyperlegible, Newsreader and Red Hat Mono in the directed apps | No credit on screen. The license must travel with the font, and the name not be used as a Reserved Font Name. | Unchanged: `fonts/OFL.txt` ships beside the file, and the credit line of §2.5 stays in About, `NOTES.md` and the credits file. |
| **Public domain** | NOAA GFS (Global Weather, Global Wind), USGS (US Quakes; Running Dashboard's tiles), Natural Earth (every map app), NASA GISS GISTEMP (Warming World), NASA/JPL (Milky Way) | Nothing; the sources ask for courtesies: NOAA that sampled data not be passed off as unaltered NOAA data and that no endorsement be implied, USGS an acknowledgment sentence (The National Map's, quoted under exception 1), NASA no endorsement. | The courtesies are kept word for word in About, as they were; Running Dashboard's `Map tiles: USGS The National Map.` leaves the front. |
| **Software licenses** (MIT, GPL) | three.js (Milky Way, Besseggen, Anatomy, Snug Kart), the tools behind some data | The notice ships with the software. | Unchanged: `vendor/` keeps the license files, About names the library. |
| **No license, or not a license** | Garmin Connect and the coaching routine (Running Dashboard), the household's banks (Finances), Norges Bank's rates (Finances), the repository's own job (Hello Live) | Nothing the app can point at. | The words the band carried move to About word for word; Norges Bank stays beside its rate, as `NOTES.md` sets out. |

---

## 5. What a signature is

A signature is the one element of an app that a stranger remembers after a minute with it, and it
is made of the app's data. Everything else in the house is quiet so that this one thing can be bold
(ART 28-30: *One bold thing: the streaks*). It is what makes thirteen apps in one system still look
like thirteen apps.

**The four in the template:**

| App | Its signature | What it is made of | How it is captioned |
| --- | --- | --- | --- |
| Global Weather, Global Wind | the streak field: *Long Exposure* | every streak a tracer moved by the forecast's wind at its place and hour, at a printed rate; nothing about a streak is invented (ART 13-19, 267-302; DESIGN 38-47) | the caption line: `Streaks: 1 s = 24 h of wind at the hour shown` (ART 400-408) |
| Earth's History | the time control drawn as a stratigraphic column laid on its side | the ICS period colors are the track, era bands nested above it, a comb of the 90 maps below (EH 7-8, 89-93) | the era names over the bar, the ages under it |
| US Quakes | the record strip | one ink stem per earthquake, its height the magnitude; a busy stretch is thick with ink, as a real drum record is, and that is a count, not an effect (UQ 25-26, 273-296) | its axes and its label line |
| Warming World | the stripes as an instrument | each stripe a year's anomaly; the scrubber framed, graduated, with the 30 years that define the zero bracketed (WW 28-32, 42) | its scale and the zero's bracket |

Three of the four are the time control itself, and the fourth is the reading. None is an ornament
added to a working app: each is the working part, drawn as the document its data already has in
the field it comes from.

### 5.1 How to find one

Ask these in order, and write the answers in the app's `ART.md`:

1. **What does a specialist call the picture of this data?** A flow photograph, a stratigraphic
   column, a seismograph's drum, a stripes chart. The signature usually comes from the document the
   data already has in its own field.
2. **What does a person do most in this app?** Scrub time, read a tapped value, turn an object,
   compare panes. A signature there puts the craft where the hands are.
3. **What does this data have that no other app in the template has?** A signature that could move
   to another app unchanged is not fitted. Global Weather's `ART.md` compares itself with the three
   apps before it so that it copies none of them (ART 35-46); every pass does the same against every
   app already done.
4. **Can it be drawn with the house's means?** One mark at the far end of the tonal budget, the
   house face, the house motion. If it needs a second accent, a glow or a new face, it is the wrong
   candidate.

### 5.2 The test: data, not decoration

A candidate passes only if every answer is yes.

1. **Delete the data and it disappears.** Nothing about it is invented: no seeded "ambient" motion,
   no motion while the data is missing or broken, no particle faster or slower than its stated rate
   (ART 561-562; DESIGN 40-47).
2. **Every property that varies is measured.** Every visual property that changes is a measured
   quantity or a constant printed on screen. A property that encodes a quantity does so
   monotonically, through a printed scale, and on-screen length or speed is never the encoding where
   the projection distorts it (DESIGN 654-657; ART 291-292).
3. **It is captioned.** The one line that says how to read it is on screen, with its numbers
   (ART 15-19). *One dated departure*: Norne Reservoir's cut is captioned by its key on the track, and
   its month's figures are in the rates chart under More controls (2026-10-06, §4.15, the lead to
   confirm before the build).
4. **It reads.** In both themes, over everything it is drawn on, at the contrast its `ART.md`
   states (§3.2), measured on rendered pixels (§7.2).
5. **It survives Reduce Motion** in a form that says the same thing: Global Weather draws arrows
   where the streaks were (DESIGN 275-280).
6. **About says what it shows and what it does not.** Global Weather's About says that where streaks
   gather is partly the air and partly the picture, and that a streak's length is not the wind's
   strength (HTML 108-111; DEC 240-244).
7. **It is the only bold element.** The rest of the screen passes §9.

**What a signature is not**: a gradient wash, a glow, a particle effect the data does not drive, a
logo or a mascot, an accent color, an oversized number, an animated background, a hero image, or
anything that would still be there if the data file were empty.

---

## 6. Words and numbers: SI, US English, vendor neutrality, honesty

### 6.1 SI notation

In the examples of shipped text in §6.1 and §6.2, the space between a number and its unit, and
between thousands, is a real U+202F, so a copy is correct. One pure module writes every number,
unit and date the app shows: `js/units.js` (UNITS 1-4; DESIGN 410-411). `toFixed` and
`toLocaleString` appear nowhere else except a short allow-list of non-text uses (cache keys, test
hooks), and `check.mjs` enforces it (DESIGN 427-428; CHECK 161-178).

- **SI first.** Every unit cycle starts with SI (m/s, °C, mm/h, hPa, km, m), and the US units are one
  tap away on the units key (DESIGN 406-408). Temperatures are in °C. The owner's standing rule:
  the marketing is written for the US, and the units inside the apps stay scientific.
- **The true minus**, U+2212, for every negative number shown, and never `−0.0`
  (UNITS 6, 22-29; DESIGN 412-413).
- **U+202F between a number and its unit**, everywhere text is written: `12.3 °C`, `82 %`, `5 h`,
  `1 s = 24 h`. An angle's degree sign attaches to its number (`63°`), and a coordinate puts U+202F
  before the hemisphere: `51.5° N, 0.1° W` (UNITS 7, 33, 41-44; DESIGN 414-418, 422).
- **Thousands grouped with U+202F from four digits up**, never with a comma: `1 013 hPa`,
  `16 380 points` (UNITS 12-20, 27-28; DESIGN 419-421; SHOOT 396-398). Years, clock times, codes,
  identifiers and version numbers are never grouped (`2026`, `04:15`, `C-4H`).
- **The decimal mark is a point.** A whole number prints whole (`up to 25 m/s`, not `25.0 m/s`).
- **Text the app did not write** (a level from the data, such as `10 m above ground`) passes through
  `si()`, which puts U+202F between a number and a known unit (UNITS 46-47).
- **VoiceOver hears words, not symbols**: dates spelled out, hours as `39 hours after the run`, units
  by name, `meters a second` (DESIGN 429-431; UNITS 55-61).
- **The data's own rows are not reformatted**: a snapshot's `ask` rows are data for questions in
  words, written by the pipeline (DESIGN 432-433).

### 6.2 Dates and times

- **Built by hand from the phone's clock, with fixed English words, the same on every locale**:
  24-hour, day before month. `Wed 23 Sep, 11:00` for the valid time; `22 Sep` and `04:15` in the
  stamp; About's full instants carry the zone as an offset, `Tue 22 Sep 2026, 08:00 (UTC+2)`
  (UNITS 3-4, 49-77; DESIGN 423-426). Not through `Intl` (ART 596-597).
- **Spans** in the app's words: `5 min`, `5 h`, `2 d`, `just now`; the lead `+36 h, 8 d ago`,
  `+54 h, in 2 d` (UNITS 79-93).
- **Longer spans**: years plain (`1987`), months `Mar 1987`, a model run's UTC hour `06Z`
  (UNITS 68-69).

### 6.3 US English

- **Every word** on screen and in every shipped text file is US English, comments included
  (DEC 259-262; DESIGN 672). `check.mjs` fails on colour, centre, metre, behaviour, licence,
  harbour, honour, neighbour, defence, labelled, towards, grey, favour, catalogue, "for ever" and
  the `-ise` forms it lists (CHECK 260-272). A data key spelled `licence` is data and stays
  (DEC 260-261).
- **Sentence case** for every label and button, and a button's words say what it does (`Hide the
  controls`) (ART 594-595). Errors say what is wrong and how it shows; they never apologize.
- **Strings the camera reads come first.** Milky Way's scale button `Neighbourhood` is tapped by the
  clip camera under that spelling (CLIPS 53): the pass writes `Neighborhood`, lists the change in
  `tools/DECISIONS.md`, and the lead changes the camera in the same commit. The same goes for any
  British spelling in a string §7.4 lists.

### 6.4 Vendor neutrality

- **No AI vendor, product or model name** in any shipped file, `ART.md`, `DESIGN.md`, `NOTES.md` and
  `PROMPT.md` included (DESIGN 454-456, 672). The list is stored ROT13 in `check.mjs` and copied
  from CHECK 128 as it is, never decoded into a source file; the snapshot's binary planes are
  skipped and its strings read (CHECK 126-133). A data word that collides with the list (a
  constellation's name, say) is allow-listed in `check.mjs` by file and word, never in the app's own
  strings.
- **A prompt or a help text describes a capability, never a brand**: "an agent that can run commands
  and reach the network", and the reader's own assistant names its product.

### 6.5 Honesty

Honesty is the metaphor: a flow photograph is a measurement, and its rules are the app's rules
(ART 31-33).

- **Every number on screen comes from the data**, or is a constant printed beside it. The readout and
  the signature read the same sample, so they cannot disagree (DESIGN 56-59, 296-297).
- **Scales are fixed and printed.** No auto-stretch to the visible range, no extra saturation for
  extremes (ART 564-565); an end the data went past prints open (DEC 327-328).
- **The data's age never leaves the screen**, focus mode included; stale and ran-out states are
  sentences in `--ink`, never a color and never a pulse (ART 350-355, 530-531, 563; DESIGN 386-389).
  Data built once has no age to keep on screen: its edition is About's first *This data* line (§4.2,
  2026-10-06).
- **Credits are kept word for word**, in About, one tap from every screen and every mode, and
  `check.mjs` compares the constant byte for byte where About prints it (ART 409-411; CHECK 135-139).
  Until 2026-10-06 this rule said "on screen in every mode"; the owner moved them (§4.15), and the
  only credits left beside the data are §4.15's two exceptions. A license address is printed without
  its scheme (DEC 182-183).
- **Display choices are named as display choices** in About (EH 10-12), and so is what the drawing
  cannot show: Global Weather's grid is sampled every 2°, not averaged, and About says so
  (DEC 249-252).
- **No borrowed authority**: no agency emblem, no government web face, nothing that suggests an
  official product (ART 566-567).
- **A broken file is a sentence, never a blank plate**, and a broken replacement keeps the data that
  was showing (DESIGN 290-292).
- **The data half is not the pass's.** Pipelines, snapshots and the loop stay byte-identical, and
  `check.mjs` pins each data file's sha256 (CHECK 110-115).

---

## 7. The tests and the camera

Each app carries its own tools in `tools/`, which the ZIP leaves out: Node, no dependencies but
Playwright for `shoot.mjs` (and `python3` for the palette script), every check printed as `ok` or
`FAIL` with its number, exit 1 on any failure (DESIGN 437-440; CHECK 41). Global Weather's are the
pattern; copy them and change them for the app. Apps that already have tools keep what they test
and gain what is missing (Snug Kart's `tools/check.mjs` already pins its `vendor/` to Anatomy's
byte for byte, for one).

### 7.1 `tools/check.mjs`: static (`node tools/check.mjs`)

Every app's check asserts at least these (CHECK 1-31):

1. **What the ZIP ships** stays within Snuggery's limits: at most 10 000 files, a folder depth of
   16, no symlinks, the largest file within 128 MiB and the total within 512 MiB (CHECK 51-67).
2. **No address with an `http` or `https` scheme** in any shipped `.html`, `.css` or `.js`,
   comments included (CHECK 69-72). A vendored library's own files are excepted, and pinned byte
   for byte to their source instead. So are the links a source's own terms ask for, as static
   anchors in `index.html` and nowhere else (Outdoor Window's two: the Open-Meteo link in the footer,
   §4.15 exception 1, and the license link in About, §4.8), each pinned by its exact string and
   counted once; nothing is ever fetched from them.
3. **Every reference is relative**, inside the folder, and present: `import`, `src`, `href`,
   `url(`, `fetch(` and every data path the code names (CHECK 74-89).
4. **The folder contract**: `assets/`, `data/` and `fonts/` hold exactly the files the app lists;
   `fonts/` holds `ysabeau-office-gw.woff2` and `OFL.txt` (and a declared supplement) (CHECK 91-99).
5. **The face**: the woff2's sha256 is `fdf1a28c…cdb262` (CHECK 100-102); `OFL.txt` names the face
   and carries the OFL 1.1 (CHECK 103), and the house adds its sha256, `d1adfffd…be6269`; the
   credits file names the face and never says no font ships (CHECK 104-108).
6. **The data is untouched**: each data file's sha256 equals the value recorded before the pass,
   or the app's own `.sha256` line (CHECK 110-115).
7. **`miniapp.json` is valid**: schema 1, the name unchanged, the entry point present, a
   description of at most 200 characters, a version of digits and dots that is higher than the
   version the pass started from (§13; CHECK 117-124).
8. **No AI vendor or model name** in any shipped text file (§6.4; CHECK 126-133).
9. **The credits**, word for word, in the constant About prints first under *Sources and credits*,
   and no element on the front that carries a credit but §4.15's two exceptions, each pinned by file
   and exact string (CHECK 135-139; amended 2026-10-06 from "the constant the app writes to the
   screen").
10. **The camera's strings** (§7.4), each in the markup or the code, with its role (CHECK 141-159).
    Every `localStorage` key keeps the app's existing prefix, every key read today is still read,
    and new keys are only added (DESIGN 27-29; CHECK 147-158).
11. **SI**: no plain space between a digit and a unit in any string the app writes; `toFixed` and
    `toLocaleString` only in `js/units.js` and the allow-list (CHECK 161-178).
12. **Nothing that carries a step transitions**: no `transition` or `animation` on the track, the
    time row or the lead (CHECK 180-188).
13. **No value reaches markup unescaped.** Global Weather allows `innerHTML` only as `= ''`
    (CHECK 190-197; DESIGN 24-25). Eight of the thirteen still set markup from strings
    (*measured*, assignments that are not `= ''`: Running Dashboard 15, Besseggen 11, Milky Way 7,
    Norne Reservoir 5, Finances 2, World News 0 (after its pass), Snug Kart 1, Hello Live 0 (after its pass)). A pass adds no new
    such use, escapes every value in the ones it touches, and never adds `insertAdjacentHTML`,
    `outerHTML`, `document.write`, `eval` or `new Function`. An app that already holds Global
    Weather's rule (Anatomy, Shelf Atlas, World Oil & Gas, Outdoor Window, Power Hours) keeps it,
    and its check says so.
14. **The palette**: the app's ramps equal its palette script's `--json`, and the script exits 0
    with `ALL CHECKS PASS` (CHECK 199-208).
15. **The tells**: no `box-shadow`, `backdrop-filter`, `transition: all`, `text-transform:
    uppercase` or `letter-spacing` other than 0 in any shipped CSS; no middle dot in a string the app
    writes but the credit constant; no →, ➤ or `...` in shipped HTML, CSS or script text; both
    `theme-color` metas equal each theme's `--page`; the `@font-face` rule exactly as §2.5 gives it
    (CHECK 210-237). The house adds three: the chrome tokens of §3.1 in both themes with exactly the
    house values (the four white apps' light `--page` `#ffffff`, §12; a pane app's register tokens
    with exactly §11.2's values); no other `font-family` and no monospace stack; every font string in a script names
    `"Ysabeau Office"` first.
16. **Budgets** (§8), and the ZIP built exactly as `build-zips.yml` builds it, with `index.html` at
    its top and nothing else in it, every size printed (CHECK 239-258).
17. **US spelling** in every shipped text file (CHECK 260-272).

### 7.2 `tools/shoot.mjs`: the app driven (`PLAYWRIGHT_MODULE=… node tools/shoot.mjs`)

Headless Chromium at 390 × 844 CSS px, DPR 2, mobile with real touch through CDP, in the light and
the dark theme, with Reduce Motion where a scene names it. It fails on any console error or warning,
page error, failed request, HTTP status of 400 or more, or any request outside its own local server.
Every figure it asserts is worked out in the script from the shipped files with Node's own tools and
formulas written there, never by importing `js/`, so a bug in the app cannot agree with itself
(SHOOT 1-32, 155-164; DESIGN 472-478). The app exposes an inert test hook, `window.__<app>`, that
nothing in the app calls (DESIGN 299-313). `SCHEMES=light`, `SCRUB=0` and `SCREENSHOTS=1` narrow
or extend a run (SHOOT 11-14).

Every app's run asserts, as its kind allows:

- **Boot**: the camera's strings by role and name, no credit line on the front (§4.15) and the
  credit constant word for word as About's first *Sources and credits* paragraph, and the face loaded
  (`document.fonts.check`) before any picture (SHOOT 287-297).
- **Text contrast**: every rendered text node at 4.5:1 or more over its composited background, in
  both themes (SHOOT 195-217, 311-314). **The tracer** under exactly the chosen words
  (SHOOT 315-316).
- **The signature sampler**: the signature's drawn pixels against the pixels under them, in both
  themes; 90 % of samples at or above the target its `ART.md` states, the lowest single sample
  printed, because an antialiased edge pixel sits below the full mark the palette script checks
  (SHOOT 249-270, 347-373; DEC 179-181).
- **SI** in every visible text node: no hyphen-minus before a digit, U+202F before every unit,
  thousands grouped (SHOOT 233-247, 396-398); the units key cycles with SI first (SHOOT 401-406).
- **The readout** equals the script's own decode of the data, in SI (SHOOT 375-399).
- **The scrub, by real touch**, wherever there is a time player: on each view, at 2, 8 and 20 steps a
  second, a move every 16 ms. On every frame the finger is down, drawn = wanted = the step under the
  finger, and the label is the drawn step's; at 2 steps a second every step is drawn, in order; the
  frame after the lift draws the last step; no animation runs on the time row or the track
  (SHOOT 452-495; DESIGN 360-367). Where frames can lag, the log also counts preview frames and the
  time each took to hand over (§4.6).
- **Play**: on every drawn frame the label is the drawn time's, never backwards, and pausing rounds
  to a step (SHOOT 497-518); the Play key's mark follows play by touch (SHOOT 519-527); About holds
  play still (SHOOT 528-539); a touch on the track during play stops it on the step under the finger
  (SHOOT 540-547).
- **The plate holds still** while the caption's words change (SHOOT 551-581).
- **The readout card** keeps clear of the tapped point, and VoiceOver's sentences are right
  (SHOOT 583-614).
- **Focus mode**: entered by touch and by Enter; what leaves is `hidden`, `inert` and gone from the
  accessibility tree; what stays is visible; the plate grew; a scrub, play and a tap work inside it;
  it is left by the ghost key and by Escape; it survives a reload; the live region's sentences; hit
  targets inside it; and the camera's way out of a library left in focus mode (SHOOT 656-728).
- **Hidden**: every loop stops, and the return redraws fresh (SHOOT 750-769).
- **Hit targets**: every button, slider and tab at 44 × 44 px or more (SHOOT 218-232, 771-775).
- **The stamp is one line** (2026-10-06, §4.2): at 390 × 844, in every state the app's stamp
  function can write (fresh, each lead alone, and the longest combination of leads it can join),
  `#stamp`'s height is one line height (16 px) to within 1 px.
- **About** opens from the stamp (or the `About` key, §4.2), holds the app still, carries the
  credit constant first, every credit and the font's, and closes on Escape (SHOOT 777-785).
- **Reduce Motion**: continuous motion off or in its still form, every animation at 0 s, play in
  whole steps (SHOOT 789-816).
- **Broken data**: missing, not JSON, the wrong schema, a short file, stale; each gives its sentence,
  and a replacement while open keeps the view (SHOOT 818-865).
- **Widths**: 320, 360, 375, 844 × 390, and 125 % zoom (312 × 675): no horizontal scroll, rows that
  scroll inside themselves, the caption's longest line inside its fixed height, and on its side a
  plate of at least 220 px (SHOOT 867-891).
- **Pictures**, both themes, to `tools/.work/shots/` and with `SCREENSHOTS=1` to `screenshots/`;
  never `screenshots/app.png`, the README's composite, whose hash the run checks unchanged
  (SHOOT 31-32, 52-53, 174-180, 895-896).
- **Frame times** printed as headless Chromium figures, a trend only; nothing fails on a frame time
  (SHOOT 8-9, 438-442).

### 7.3 The decode test

Where an app has data, a Node test with no dependencies decodes the shipped data with tools and
formulas written in the test and compares the app's pure modules with it (Global Weather's
`tools/test_flow.mjs`, DESIGN 530-560; Warming World's `tools/test_decode.mjs`). An art pass changes
no decoding; this test proves it did not.

### 7.4 The camera

Snuggery's marketing camera opens each app by its Library name, waits for a string that proves the
data is in, and taps controls by their accessible names (CAM 49-82, 125-137). Before changing any
visible word, accessible name, role or element type, search the three camera files for the app's
name and for the word.

| App | The camera waits for | It taps or sets | Source |
| --- | --- | --- | --- |
| Milky Way | visible text containing `from the Sun` (its `You are 1.0 AU from the Sun` line) | the scale buttons `Solar System` and `Milky Way` (the lowest match on screen, since the title reads Milky Way too) and `Neighbourhood`; `Play`, at the Solar System scale | CAM 425-456; SHOTS 478-488, 689-709; CLIPS 35-64 |
| Besseggen | `CEST` or `CET` in visible text (the date and time line) | the sheet's grip, `Show more controls`, `Show all controls`, `Hide the extra controls`; `From the boat on Gjende`, `Stop`, `Fit the route`, `Fly the route`; a double-tap on the terrain for focus mode | CAM 413-423; SHOTS 649-687; CLIPS 66-148 |
| Norne Reservoir | `Oil saturation` (the default property's label, written once every file is in); it waits out `Double-tap a spot` | `Show the whole field`; the property chips `Pressure` and `Oil` (by label in the stills; as buttons in the clip); `Play production history`, then `Pause` | CAM 230-259; SHOTS 603-627; CLIPS 150-184 |
| Anatomy | `Every layer is showing` (the add button's label, written once the model is in) | a control whose label begins `Remove the`; the slider `Explode amount`, set by taps at 0.45 and 0.01 of its track; a control whose label begins `Bring back the` | CAM 211-228; SHOTS 560-601; CLIPS 186-224 |
| Shelf Atlas | a control named `Play` | `Back one year`, `Cumulative`, `Rate` | CAM 261-266; SHOTS 711-743 |
| World Oil & Gas | visible text containing `Updated` (the stamp, written once the snapshot is read; `Play` is in the static markup, disabled until then), then a control named `Play` | `Play`, then `Pause`; then the slider named `Year` tapped at 0.995 of its track, which puts the year back | CAM 385-394; SHOTS 749-778 |
| Snug Kart | a control named `Race` | `Race` | CAM 270-276; SHOTS 763-777 |
| Running Dashboard | a button named `Health` (the panes are built after the data parses) | the panes `Now` and `Health`, as buttons by name | SHOTS 283-301, 327-332; CLIPS 239-240 |
| Finances | a button named `Overview` | the panes `Overview` and `Spending` | SHOTS 334-345 |
| World News | a button named `Europe` (built from the data's regions) | `Europe`, `Americas` | SHOTS 347-353 |
| Outdoor Window | a button named `Hours` | `Windows`, `Hours` | SHOTS 355-360 |
| Power Hours | visible text containing `c/kWh` (written only after the snapshot parses) | a tap on car charging's pressed word in the runs list: its four-hour landing, apart from the dishwasher's (the washing machine's sits in the same trough in the run-out state) (the pane has nothing to scroll at the camera's size since the pass, plan 0011 D39) | SHOTS 253-259, 362-377 |
| Hello Live | its Library row | nothing inside the app | SHOTS 238; CLIPS 398-402 |

**Rules (must).**

- **Keep every string** the camera waits for or taps, with its role: a button stays a button, a tab
  stays `role="tab"`, a slider stays a slider the camera finds by its name and sets by a tap on its
  track (CAM 84-98). Change the look, not the markup the camera reads.
- **If a string must change** (US spelling, §6.3), list it in `tools/DECISIONS.md`; the lead changes
  the camera in the same commit.
- **Never rename an app**: the Library row is `miniapp.json`'s name.
- **The front-text cut keeps the camera's strings** (2026-10-06). Five of them sit in elements §4.15
  edits, and each stays visible where it is: Milky Way's `from the Sun` (the caption line's first
  sentence), Norne's `Oil saturation` (the legend's title), the stamps' `Updated` (World Oil & Gas,
  Global Weather, Global Wind), Power Hours' `c/kWh` (the price now, the runs' note and rows, once the
  band's caption has gone) and Earth's History's `Scotese map 49 ·` (the sheet's head).
  `docs/plans/0012-change-lists.md` names them per app.
- **Full screen** is where the camera photographs: no status bar, and the web view under every
  safe-area edge (CAM 139-149). Snuggery's own exit control sits in the top-right corner
  (CAM 159-165, 168-176), the corner the ghost key uses: on the phone, check that both can be
  reached.
- **A remembered focus mode** needs its exit key named exactly `Show the controls`, so the camera's
  guard can bring the controls back (CAM 400-411; §4.10).
- **What the camera changes, it puts back** (a scale, a property, a peeled layer), because the app
  remembers it and the dark pass runs after the light one (SHOTS 550-559). Every such control must
  still be able to put it back.
- **The camera's waits are timed.** A pass never lengthens a load, an opening or a flight the camera
  waits out (CAM 278-285, 316-323, 353-374; SHOTS 697-708) without the lead changing the wait.

### 7.5 What headless runs are not

Headless Chromium is not a phone. Frame time, memory, battery, safe areas, VoiceOver and the scrub
in Snuggery's web view are the owner's phone checks; each pass lists the ones it needs, with the
device they need, for the lead to put in the device matrix (DESIGN 612-622; DEC 253-255).

---

## 8. Budgets

**The caps** (the plan for this pass; CHECK 239-258 for how each is measured):

- **App code ≤ 200 000 B**: every shipped `.html`, `.css`, `.js` and `.mjs` outside `vendor/` and
  `data/`. An app that carries a vendored library (three.js in Milky Way, Besseggen, Anatomy and
  Snug Kart) measures its code without `vendor/`.
- **Fonts ≤ 160 000 B**: everything in `fonts/`, a supplement included.
- **The ZIP ≤ its size before the pass plus a quarter**, built exactly as `build-zips.yml` builds
  it. An app that gains the house face where it had no face before adds the face's fixed cost on top,
  **37 834 B** (§2.2): for the small apps the font alone is more than a quarter of the ZIP (Hello
  Live's is 3 730 B), so without it the rule could not be met by any pass that vendors the face. An
  app that swaps its faces for the house's needs no allowance: the house's 40 075 B replace 87 680 B
  of Atkinson Hyperlegible and Newsreader, or 74 128 B of Geist.
- **An app's own budgets stay**, and the tighter one wins — when the app actually enforces it. World
  Oil & Gas holds its `app.js` to 150 KB and each data file to its own cap (`world-oil-gas/NOTES.md`
  lines 60-62); Shelf Atlas's `NOTES.md` said 150 KB of app code too, but no build or check ever
  enforced it, so the lead ruled the house's 200 000 B for its pass (plan 0011 D15; its data caps
  stay, and its `check.mjs` now enforces all of them); Snug Kart keeps its ZIP under 3 MB and its
  frames inside their draw-call and triangle budgets (`snug-kart/tools/check.mjs` line 300 after its
  pass; `snug-kart/NOTES.md`).

**The figures today** (*measured* 2026-10-01 on the working tree: each folder zipped by the
`build-zips.yml` command, `zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*'
'scripts/*' 'dist/*' 'raw/*'`, then `wc -c`). "Today" for a pass means the commit it starts from:
the map apps change in the coastline package first, so each pass measures again and writes its own
figures into its `ART.md`.

| App | ZIP today | ZIP cap | App code today | Fonts today |
| --- | --: | --: | --: | --: |
| Global Weather (reference) | 2 788 259 (2026-10-02, with the family fixes) | its own, 2 800 000 (CHECK 258) | 202 840 of 203 000 (D5/D6) | 40 075 |
| Global Wind (reference) | 1 483 107 (with the family fixes of 2026-10-02) | its own, 1 600 000 (ART 621) | 184 653 | 40 075 |
| Milky Way | 6 513 447 (after its pass, the record's move and the family fixes of 2026-10-02) | 8 156 512 | 241 820 of 242 000 (the lead's ruling, plan 0011 D9) | 45 695 |
| Besseggen | 16 854 392 (after its pass, the record's move and the family fixes of 2026-10-02; NOTES.md's own figure is approximate because it ships inside the ZIP) | 21 088 756 | 226 794 of 227 000 (the lead's ruling, D11) | 40 075 |
| Norne Reservoir | 15 354 835 (after its pass and the family fixes of 2026-10-02) | 19 110 591 | 161 833 | 40 075 |
| Anatomy | 24 552 816 (after its pass and the family fixes of 2026-10-02) | 30 692 577 | 116 467 | 40 075 |
| Shelf Atlas | 1 980 340 (after its pass, the data follow-up and the family fixes of 2026-10-02) | 2 413 130 | 184 002 of 200 000 (the lead's ruling, plan 0011 D15) | 40 075 |
| World Oil & Gas | 2 147 335 (after its pass and the family fixes of 2026-10-02) | 2 622 870 | 199 975 of 200 000 (the house's cap, plan 0011 D17 standing; `app.js` 118 407 of its own 150 000) | 40 075 |
| Snug Kart | 619 403 (after its pass and the family fixes of 2026-10-02) | 720 806 | 242 778 of 244 000 (the lead's ruling, plan 0011 D20; held at 220 070 before it) | 40 075 |
| Running Dashboard | 1 081 046 (after its pass, the data follow-up, the family fixes and the owner's six and seventh of 2026-10-03) | 1 340 193 | 251 775 of 252 000 (the lead's rulings, plan 0011 D23–D24 and D32 for the owner's six; held at 236 521 before them) | 41 291 |
| Finances | about 129 800 (after its pass; `ART.md`'s own size moves the last digits) | 131 000 (the lead's ruling, plan 0011 D27; 125 304 by D5's formula) | 123 733 of 200 000 | 40 075 |
| World News | 86 993 (after its pass and the data follow-up of 2026-10-02; `ART.md`'s own size moves the last digits) | 88 000 (the lead's ruling, plan 0011 D30; 72 140 by D5's formula) | 46 119 of 200 000 | 40 075 |
| Outdoor Window | 98 073 (after its pass and the lead's fix of the final's should, 2026-10-03; `ART.md`'s own size moves the last digits) | 99 000 (the lead's ruling, plan 0011 D34; 75 257 by D5's formula) | 87 647 of 200 000 | 40 075 |
| Power Hours | 95 506 (after its pass, 2026-10-03; `ART.md`'s own size moves the last digits) | 97 000 (the lead's ruling, plan 0011 D39; 70 305 by D5's formula) | 84 497 of 200 000 | 40 075 |
| Hello Live | 71 844 (after its pass, 2026-10-06; `ART.md`'s own size moves the last digits) | 74 000 (the lead's ruling, plan 0011 D42; 42 496 by D5's formula) | 46 888 of 200 000 | 40 075 |

The ZIP caps are today's size times 1.25, rounded down, plus 37 834 B where the app gains a face.

† Re-measured after package A (true coastlines) by the same command: World Oil & Gas carries the
1:10m coast (it was 1 670 512 B, cap 2 125 974); Shelf Atlas gained two documentation sentences (it
was 1 900 111 B, cap 2 412 972). Global Weather's and Global Wind's rows predate package A too; their
caps are their own, and their `check.mjs` prints today's figures.

**The formula and the small apps (plan 0011 D27, D29).** For an app whose stock ZIP is smaller than
the face it gains — Finances (70 kB) and the loop apps after it — the ZIP cap of today × 1.25 plus the
face leaves no room for the house modules, About and the shipped `ART.md`, so the builder applies the
whole list, cuts nothing, and the lead rules on the measured figure after the build, as every pass over
a cap has been ruled; the measured ZIP plus a few thousand bytes for the fix stages is the expected cap.
The front cut and the register (2026-10-06) move bytes both ways; the pane apps that start them within
about 1 % of a cap (World News, Finances, Outdoor Window, Power Hours, and Running Dashboard's code) are built
whole and ruled the same way.

**What to do near or over a cap.**

1. **Measure before adding.** `check.mjs` prints every size; read them before and after the pass.
2. **Pay before you add.** The stock look's CSS (Running Dashboard's `style.css` is 30 622 B, for
   one), the dropped faces and their `@font-face` rules, and dead code usually free more than the
   house costs. Global Weather's whole house stylesheet is 18 348 B.
3. **Over the code cap today** (Milky Way, Besseggen, Snug Kart, Running Dashboard): the pass does
   not grow the code. Its cap is its size at the start of the pass, written into its `check.mjs`,
   until the lead, with the owner, sets another and records why in `tools/DECISIONS.md`.
4. **Never minify, and never strip comments, to fit.** The template's code is meant to be read.
   Cut a feature, or move data out of code into a data file, and say so.
5. **Within 5 % of a cap after the pass**, `ART.md` says so and gives the headroom left. Global
   Weather sits at 202 560 B of its 203 000 (440 B to spare; the cap rose 1.5 % for the 1:10m coast's levels of detail, plan 0011 D6), so anything it gains, it pays for.

---

## 9. The generated-page tell list, answered

The `frontend-design` skill lists the traits that make a page read as generated. Each is
legitimate for some brief; here each is a default the house does not take. Every app's `ART.md`
answers all fifteen for itself (ART 573-591 is Global Weather's answer).

| Tell | What the house does instead |
| --- | --- |
| 1. A warm cream ground, a high-contrast serif display, a terracotta accent | A cool film-base ground, `#e8eef0` (OKLCh 0.945, 0.007, 220). One low-contrast Renaissance sans at every size; no display face. No accent: warm hues appear only as data. |
| 2. A near-black ground with one acid-green or vermilion accent | The dark page is a slate at L 0.224, not a black stand-in. No accent. The one bright thing on a screen is the signature, and it is data. |
| 3. Broadsheet: hairlines, zero radius, dense columns | One column. Hairlines only where they separate (About's sections, the key separators, the player's top rule). Radii by role: 6, 8, 4 and 2 px (a key's swatch, §4.15), and 0 only on the legend bar. |
| 4. The SaaS-card kit: identical rounded cards, one radius, one soft shadow, gradient washes | At most one card on a screen (the readout) and one sheet (About). Content sits on the page between hairlines. No shadows. The only gradients are data scales and the selection tracer. **A pane app's sections sit on plates** of `--sheet` with a 1 px `--line` edge (§11, amended 2026-10-06): the separation the owner asked for, every plate holding data, with no shadow, no gradient, no hover and no lift. |
| 5. ALL-CAPS tracked eyebrow labels | None. Sentence case everywhere, `letter-spacing` 0, and no label above a heading. |
| 6. Meta strings joined with middle dots | Commas, sentences, or one value per line. The one middle dot left is inside a credit line whose words are fixed by license, kept word for word. |
| 7. "WORD — fragment" labels with a spaced em dash | None. |
| 8. A tinted near-black (#0B0B0B, #111) standing in for black | Ink is `#0f1c23` (L 0.218), a stated ink used for text and marks; the dark page is a slate at L 0.224. No `#000` or `#111` ground anywhere. |
| 9. A monospace face for small data labels | None. Ysabeau Office's figures are tabular by default; one face does the aligning. |
| 10. "→" appended to links and buttons | None, and `check.mjs` fails on → and ➤. Button words say what they do. |
| 11. One word accented in a headline | None. The only emphasis is a status sentence (stale, ran out) in `--ink`, and its words carry the meaning. |
| 12. Unnecessary labels above content | The legend's title is the quantity its bar measures, from the data. Nothing else is labeled from above. |
| 13. Numbered markers (01 / 02 / 03) | None, unless the content is a sequence, and then an ordered list. |
| 14. A big number, a small label and a gradient accent | One large figure per screen, at 21 px, the subject's own (the valid time, the tapped value), with no gradient. A pane app's key number is 34 px (§11, amended 2026-10-06): the pane's own subject, one per pane, its label above it in words and its change under it, with no gradient, glow or accent behind it. |
| 15. Scattered fade-and-slide entrances, hover on every card | No entrances. The one continuous motion is the data's own; the small transitions answer a touch. Hover only on controls, and only where the pointer can hover. |

**The web interface guidelines** the QA stage reads apply as written, except where the house writes
its own rule (ART 593-603):

- **Buttons in Title Case**: the house writes sentence case (`Hide the controls`).
- **Dates through `Intl`**: not used. Dates are built by hand from the phone's clock with fixed
  words, so every locale prints the same thing (§6.2).
- **Critical fonts preloaded with `font-display: swap`**: the face is local, so `block` costs
  nothing and keeps canvas text out of a fallback face (§2.5).
- **`translate="no"`** on names, source and model tokens, and the unit keys (HTML 20, 23, 86;
  APP 1910).
- **The rest as written**: `aria-live="polite"` for sentences, `<button>` for every action,
  `env(safe-area-inset-*)` on every band, and `…`, never `...`.

---

## 10. The final reviewer's checklist

Run every command yourself, from the app's folder unless it says otherwise, and read the output, not
the summary. Tick an item only on evidence. Nothing here is checked on a phone; the last item lists
what is.

**The tools**

- [ ] `node tools/check.mjs` ends `all checks pass`, and every size it prints is inside §8.
- [ ] Every decode or math test passes (`node tools/test_*.mjs`).
- [ ] `PLAYWRIGHT_MODULE=… node tools/shoot.mjs` ends `all checks pass` in both themes, with the
  scrub (no `SCRUB=0`); `screenshots/app.png` is reported untouched.
- [ ] The palette script, run from the template's root, ends `ALL CHECKS PASS`, and the app's ramps
  equal its `--json`.

**Type (§2)**

- [ ] `shasum -a 256 fonts/*` gives `fdf1a28c…cdb262` for the face and `d1adfffd…be6269` for
  `OFL.txt`; any supplement matches the sha256 its `NOTES.md` and `check.mjs` give, and its
  `unicode-range` names only what it holds.
- [ ] One family in the CSS, through `--face`; no monospace; every script font string starts with
  `"Ysabeau Office"`; canvas or WebGL text waits for the face.
- [ ] Nothing larger than 21 px (a pane app: §11's 19 and 34 px); one large figure per screen (a
  pane app: one key number per pane); weights within 400–650; no capitals, no small capitals, no
  letter-spacing; sentence case.
- [ ] The credit line is word for word in About, `NOTES.md` and the credits file; the faces the app
  dropped are gone, with their credits.

**Color (§3)**

- [ ] The chrome tokens equal §3.1 in both themes (the four white apps' light `--page` `#ffffff`,
  §12); `body` has `background: var(--page)`; both `theme-color` metas carry `--page`.
- [ ] No accent, no red or amber in the chrome, no shadow, blur, glass or glow; a pane app's
  register colors only on data (§11).
- [ ] `ART.md` states, per theme, the ground, the data band, the signature's color and lightness,
  and the worst measured contrast, and every figure names the command that printed it.
- [ ] Every data scale is one hue path printed twice, keeps its own color logic inside the band, and
  passes the color-vision checks; categories pass the pairwise check.

**The chrome (§4)**

- [ ] Each object of §4 is present or absent as the app's kind requires (§4.0), and drawn as §4
  says.
- [ ] Every control is 44 × 44 px or more, in normal and focus mode (shoot prints the count).
- [ ] The caption line has a fixed height; the plate holds still when its words change.
- [ ] The time player (where there is one): the three-speed scrub shows 0 frames that differ, every
  label is the drawn step's, no animation on the time row or track; the Play key's mark follows
  play; About holds play; preview frames and handovers are counted where frames can lag.
- [ ] Focus mode (where the hero is a view): what leaves is `hidden` and `inert`; the ghost key is
  named exactly `Show the controls`, sits under the top safe area, and Escape works; the state is
  remembered; the stamp (or the `About` key) stays, so About is one tap away; the live region says
  both sentences.
- [ ] No opening, or one that runs once, ends on any touch, has `Skip`, and never runs under Reduce
  Motion.
- [ ] Reduce Motion: every duration 0 s, continuous motion off or in its still form, play in whole
  steps. Hidden: every loop stops.
- [ ] 320 px wide, 125 % zoom and 844 × 390: no horizontal scroll; on its side the plate is at least
  220 px tall.

**The signature (§5)**

- [ ] It passes all seven tests of §5.2, and it copies no other app's signature.
- [ ] The shoot run's signature sampler holds 90 % of samples at the target in both themes, and its
  lowest sample is printed and explained.

**Words and numbers (§6)**

- [ ] The SI scan of every visible text node is clean; the units key starts with SI; years are never
  grouped; every number comes through `js/units.js`.
- [ ] Dates are built by hand: 24-hour, day before month, the same on every locale.
- [ ] US spelling passes, and reading the visible strings finds no British spelling the check missed.
- [ ] The vendor-name check passes over every shipped text file, `ART.md` and `PROMPT.md` included.
- [ ] Every number on screen traces to the data or to a printed constant; staleness is a sentence;
  the credits are word for word in About; About names what the picture is and is not.
- [ ] Every data file's sha256 is what it was before the pass.

**The front, the register, the ground, the version (2026-10-06)**

- [ ] The front (§4.15) holds the name, the view, the controls and at most one status line, one line
  at 390 px in every state; nothing on it is a credit, license, retrieval date or method sentence
  but §4.15's two exceptions, each named in `NOTES.md` with its terms quoted.
- [ ] About's *Sources and credits* opens with the credit constant, byte for byte, and carries every
  attribution a license asks for; no shipped file still says the credits are on screen.
- [ ] A pane app: §11's eleven rules; its register tokens equal §11.2 and its palette script measures
  them on its ground and on `--sheet` in both themes.
- [ ] The ground is §12's for this app; a white app's palette script ran with `#ffffff` and passes.
- [ ] `miniapp.json`'s version is higher than the one the pass started from, by §13's rule.

**The camera (§7.4)**

- [ ] Every string in the app's row of §7.4 is present, with its role, in both themes, or the lead's
  camera change is listed for the same commit.
- [ ] Any state the camera changes can still be put back by the same controls.

**Budgets (§8)**

- [ ] Code, fonts and ZIP are within their caps, and an app over a cap today did not grow.

**The tell list (§9)**

- [ ] `ART.md` answers all fifteen rows for this app; the `check.mjs` greps are clean; a stranger's
  look at the screenshots in both themes finds no generated-page default and one memorable thing.

**Phone checks, listed for the device matrix, not claimed**

- [ ] Frame time while idle, playing and scrubbing; memory after five minutes; background and
  return; a delivery of new data while open; focus mode in Snuggery's full screen, with the ghost
  key and Snuggery's own exit control both reachable; VoiceOver on the track and on a tap; the phone
  on its side. Each item names the device and the iOS version it needs.

---

## 11. The pane-app register (2026-10-06)

The owner's verdict on the picture board (plan 0012 D5): Finances' Overview, World News' All and
Running Dashboard's Now, redrawn in a denser register, were approved as prototyped. The prototypes
are patches against the template at `b7accea` in the Snuggery repository
(`docs/plans/0012-prototypes/*.patch`), and the board is `docs/marketing/reference/0012-board-pane-register-*.png`.
The register binds **the six pane apps only**: Finances, World News, Running Dashboard, Outdoor
Window, Power Hours and Hello Live, and the owner's private Training Load. Where a rule here departs
from §2.5, §3.1, §4.5, §4.7, §9 rows 4 and 14 or an app's `ART.md`, this section wins for those six,
and the rule it replaces says so where it stands.

### 11.1 The eleven rules (must)

1. **The front of a pane app** is the name, one stamp line, the tabs and the pane. The caption band
   leaves the screen, its caption line and credit line with it; `footer.band` is deleted, unless it
   holds one of §4.15's exceptions (Outdoor Window's one-line Open-Meteo link), and then it holds
   only that line and stays among the elements About makes inert. With the band gone, the pane body
   pads the bottom safe-area inset itself (§4.14). Each pane ends with one text key, `Sources, method and credits are in About.`
   (World News: `Sources, their terms and credits are in About.`): a `<button>` at 12.5 px
   `--ink-2`, underlined at a 3 px offset, at least 44 px tall, 14 px under the last section, that
   opens About. §4.15's two exceptions stay where they are.
2. **One key number per pane**, at 34 px, weight 650, line height 1.05: the pane's subject (net
   worth, the week's kilometers, the next window, the price now, the file's time). Its label sits
   above it at 12.5 px `--ink-2`, and its change or plan right under it at 13.5 px. Tile values and
   table totals are 19 px, weight 650. A pane with no subject number (World News' headlines, Running
   Dashboard's Training and Health, Finances' Cash flow and Transactions) has none, and its tiles
   carry the 19 px figures. The pane apps' scale is **10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 / 19 / 21 /
   34 px**; 21 px stays for the readout card's value alone (§4.7), and 16 px for a search field (iOS
   zooms into a smaller one).
3. **Tables and tiles in place of sentences.** A tile is a label (11.5 px `--ink-2`), a value (19 px,
   650) and an optional note (11.5 px `--ink-2`), in two columns at 390 px, parted by `--line`
   hairlines. A table has `th` at 11.5 px, 600, `--ink-2` over a `--line-strong` rule and rows parted
   by `--line`; its first column is left-aligned and its amounts right-aligned in tabular figures, at
   12.5 to 15 px and weight 560 to 600. A fact a sentence used to carry goes into one or the other.
4. **Sections sit on plates**: fill `--sheet`, a 1 px `--line` edge, radius 8 px, padding 12 px, 12 px
   apart. Section headings are 15 px, weight 650. Halos, casings and dot strokes drawn on a plate
   take `--sheet`, not `--page`. A drawing whose own marks are drawn in `--sheet` (Outdoor Window's
   lit windows) stays on the page ground, unplated, because on a plate those marks would vanish.
5. **Color carries meaning, never decoration.** Each hue means one thing in its app, and an app uses
   at most four hues besides the inks, all from §11.2, under the names given there, in `:root` and
   again in the dark block. (The board's rule said three. The approved prototypes carry four:
   Running Dashboard's done blue and a three-step tone, Finances' owned, owed, up and down. The lead
   ruled on 2026-10-06 that four stands, as the owner approved them, D5's "as prototyped"; neither
   app is cut back to three.) An app's existing categorical series (Finances' six fund slots,
   `--series-1` to `--series-6`) are its palette's, inside its band, and are not meaning colors.
   Color is never the only carrier: the sign, the word or the key stays. It is never on a control, a
   tab, a heading, a plate, a hairline or the stamp.
6. **A key replaces a how-to-read sentence**: 10 px swatches with a 2 px radius, or the marks
   themselves, each with its word at 11.5 px `--ink-2`, in one row under the drawing (§4.15).
7. **Every planned outline holds a light fill**: 14 % of its stroke color over `--sheet`
   (`color-mix(in srgb, var(--ink-2) 14%, var(--sheet))`), in the drawing, in its key and in any bar
   that shows a plan.
8. **Example data says so in the stamp**: `Example data.` in `--ink` leads the stamp (§4.2),
   decided by the data alone (Finances' `synthetic`; Running Dashboard's activity ids, every one
   `demo-…`, the rule its OpenStreetMap credit already keys on; Outdoor Window's `demoPlace`), in
   place of `Stale.` or a ran-out lead. Nothing else on the front repeats it, and the long example
   paragraph is About's *This data*. The owner's private copies, whose data is real, never show it.
9. **Method sentences leave the pane**: into the section's own fold where the app has folds (Running
   Dashboard's `How to read it` and `Why the numbers differ`), and otherwise into About. A section
   keeps at most one short label, one line at 390 px: `Age when the file was made, 1 Oct, 07:01. Log
   scale.`, `A plus is the agent slower than Garmin.`, `One bar is one week, Monday to Sunday.`
10. **Long text clamps**: a summary shows two lines on an overview pane (World News' All) and in full
    on a detail pane (a region); a byline joins its source line instead of taking a line of its own.
11. **The ground**: the register works on either ground by changing `--page` alone. On white a plate
    parts by its edge (1.51:1) and a 1.06:1 fill, against 1.11:1 on gray, so gray is the ground
    wherever plates are used (§12). Hello Live, on white, takes no plates: one card and three short
    sections parted by hairlines.

### 11.2 The tokens, measured

Contrast is WCAG 2, as text, by PAL's `lum` and `cr`; separation is ΔE in OKLab under normal vision
and Machado, Oliveira and Fernandes (2009) deutan, protan and tritan at severity 1.0, PAL's method.
*Measured* 2026-10-06 by package 2's designer with those formulas written out; each app's palette
script repeats the figures for the tokens it uses and fails if they move.

| Token (and its other names) | Means | Light | Dark | On `#e8eef0` | On `--sheet` light | On `#ffffff` | On `--page` dark | On `--sheet` dark |
| --- | --- | --- | --- | --: | --: | --: | --: | --: |
| `--own` (`--src-1`, `--done`, `--cheap`) | owned; the first source; a run done; the day's cheapest prices | `#1f5f99` | `#8cbcf0` | 5.68 | 6.29 | 6.66 | 8.61 | 7.68 |
| `--owe` (`--src-2`, `--dear`) | owed; the second source; the day's dearest prices | `#a64a1a` | `#f0a070` | 4.96 | 5.49 | 5.81 | 8.12 | 7.24 |
| `--up` | up; on track | `#17723e` | `#6fd39a` | 5.10 | 5.65 | 5.98 | 9.34 | 8.33 |
| `--down` | down; act now, stop | `#b42318` | `#ff9a8f` | 5.61 | 6.21 | 6.57 | 8.37 | 7.46 |
| `--watch` | watch | `#8a5a00` | `#e0a340` | 5.06 | 5.60 | 5.93 | 7.73 | 6.89 |
| `--src-3` | the third source | `#6d2736` | `#ab8198` | 8.99 | 9.96 | 10.53 | 5.15 | 4.60 |

The lowest figures are `--owe` on the gray page in light (4.96) and `--src-3` on `--sheet` in dark
(4.60); every token clears 4.5 as text on every ground it is drawn on.

**`--src-3` is not the prototype's** (the lead's ruling, 2026-10-06): World News' third source is
wine, `#6d2736`, in light and mauve, `#ab8198`, in dark, in place of the board's purple, and World
News' before/after shows the owner the change. The prototype drew it in `#6b4fa0` /
`#c3a6f0`, which fails §3.3's categorical check against the first source: ΔE 0.100 normal, 0.022
deutan, 0.026 protan in light; 0.087, 0.002, 0.039 in dark. The values above were searched for the
widest separation from both other sources under all four visions, with text contrast of at least
4.5 on every ground and at least ΔE 0.15 from `--ink`.

| Pair | Light: normal / deutan / protan / tritan | Dark |
| --- | --- | --- |
| `--src-1` / `--src-2` (also owned / owed, cheap / dear) | 0.246 / 0.224 / 0.188 / 0.252 | 0.202 / 0.185 / 0.175 / 0.225 |
| `--src-1` / `--src-3` | 0.208 / 0.159 / 0.194 / 0.230 | 0.171 / 0.143 / 0.180 / 0.195 |
| `--src-2` / `--src-3` | 0.160 / 0.164 / 0.154 / 0.149 | 0.163 / 0.170 / 0.145 / 0.143 |
| `--up` / `--down` (always with a sign or a word; §3.3's exemption) | 0.265 / **0.062** / 0.112 / 0.296 | 0.225 / **0.024** / 0.094 / 0.251 |
| `--up` / `--owe` (Finances: a gain beside a debt; sign and word) | 0.207 / **0.071** / **0.059** / 0.253 | 0.192 / **0.055** / 0.095 / 0.243 |

The categorical pairs all clear 0.10. The figures in bold are below it, and they are allowed only
because the sign or the word always prints beside the color.

**The planned fill and its outline**: light `#dde2e4` (1.23:1 on `--sheet`), dark `#2f3a3f`
(1.31:1); the 1.5 px `--ink-2` outline 7.32:1 and 6.92:1 on `--sheet`. **A plate on its ground**:
`--sheet` on `#e8eef0` 1.11:1, with its `--line` edge 1.29:1 against the page; on `#ffffff` 1.06:1,
the edge 1.51:1.

### 11.3 Each pane app, in one line

| App | Meaning colors | Key number per pane | Ground (§12) |
| --- | --- | --- | --- |
| Finances | `--own` owned, `--owe` owed (the Balance's blocks, `Own` and `Owe`, the sides' heads, a debt's amount); `--up` and `--down` a change in net worth | Overview: net worth; Owned: owned less owed on it; Spending: spent; Savings: invested; Cash flow and Transactions: none | gray |
| World News | `--src-1` to `--src-3`, by the order of the file's `sources[]`: ticks and swatches; the third is wine / mauve, not the board's purple (§11.2) | none | gray |
| Running Dashboard | `--done` a run done, a planned week an `--ink-2` outline with the 14 % fill; the tone: `--up` on track, `--watch` watch, `--down` act now and stop | Now: the week's kilometers; Plan: days to race day; a session: its distance or time; Training and Health: none | gray |
| Outdoor Window | none added: the Shutters' green (`--used`, its palette's) already means how much of a rule's limit an hour uses | Windows: the next window's hours; Hours and Rules: none | gray |
| Power Hours | `--cheap` the day's cheapest quarter and a run below the mean, `--dear` the dearest quarter and a run above it; the Landing keeps its own `--price` | the price now | gray |
| Hello Live | none | the file's time | white |

### 11.4 What the register amends where it stands

§2.5's scale and its 21 px ceiling (§11.1 rule 2); §3.1's no-accent rule (rule 5); §4.5's band (rule
1); §4.14's insets, the pane body padding the bottom inset where the band did (rule 1); §4.7's one card (plates are sections, rule 4); §9 rows 4 and 14; Finances' `ART.md` ("Money's
direction is never a color: no green gains, no red debts", amended in its pass to this section's
rule 5); the pane apps' `ART.md` sections that set panes on the page between hairlines (amended in
each pass to rule 4). Each app's `check.mjs` follows: the type sizes it allows, its no-accent token
check (the register's tokens allowed by name and value), Finances' B17, and its credits check (§7.1
item 9).

---

## 12. Grounds (2026-10-06)

The owner asked whether every app needs the gray. D6, the designer's picks, approved on the board
(`docs/marketing/reference/0012-board-grounds-1.png` and `-2.png`):

| Ground, light theme | Apps | Why |
| --- | --- | --- |
| **White** `#ffffff` | Anatomy, Norne Reservoir, Snug Kart, Hello Live | The plate is the ground: the body and the model read as a printed figure on white. Snug Kart's own sky and track carry its screen, and white reads as a game's menu. Hello Live is one card of lines and figures, with nothing that depends on a fill. |
| **Gray** `#e8eef0` | Finances, World News, Running Dashboard, Outdoor Window, Power Hours | The register's plates need a ground to lift from (§11.1 rule 11). Outdoor Window's lit windows are lighter than the ground and vanish on white. |
| **Gray** `#e8eef0` | Global Weather, Global Wind, Shelf Atlas, World Oil & Gas | Full-bleed pale maps sit in tone with gray bands, so the frame and the map read as one sheet. |
| **Gray** `#e8eef0` | Milky Way, Besseggen | White bands around the black sky make the hardest frame on the board; the pale terrain sky and gray bands read as one print. |
| **Their own** | Earth's History `#eceee9`, US Quakes `#f1f3f4`, Warming World `#f5f5f5` | Each is its direction's. Warming World's visible gray is its card (`#bebebe`), which its diverging scale needs, since the scale's zero (L 0.965) reads only against it. |

**Dark themes are unchanged** in all eighteen.

**What white needs (must).**

- **Tokens.** In the light `:root`: `--page: #ffffff`. Anatomy and Norne also set `--plate: #ffffff`
  (Norne reads `--plate` into `gl.clearColor`, so its fallback `'#e8eef0'` in `app.js` becomes
  `'#ffffff'`). The light `theme-color` meta is `#ffffff`. Every other token keeps §3.1's value.
- **Anything that reads the ground once.** A track, chart or canvas that caches `--page` at boot
  (players' tracks do) reads it from the stylesheet as before; a literal `#e8eef0` in a script, a
  `shoot.mjs` constant or a palette script becomes `#ffffff`.
- **The palette script** runs with its light `page` set to `#ffffff` (Norne's `GROUND['light']` too),
  ends `ALL CHECKS PASS`, and the app's ramps are pasted from its `--json` if they moved.
- **Norne's palette is re-checked on white.** Its scales' "nothing" end was tuned to fade into
  `#e8eef0`, and its `ART.md` records the body off its ground (a salience-0 top face `#cbcec8`, ΔE
  0.098, 1.36:1 on the old ground). The pass measures both on `#ffffff` and writes the figures into
  `ART.md`; if any check fails, it stops and reports the figures to the lead before anything ships.
- **Edges on white.** `--sheet` parts from white by 1.06:1, so a key plate is carried by its 1 px
  `--line` edge (1.51:1) and the readout card by its `--line-strong` edge (3.83:1); no token changes.
  Labels drawn with a halo in the ground's color get a white halo; the palette script checks them.
- **Checks.** `check.mjs`'s chrome-token check expects `--page` `#ffffff` in light for these four, and
  the theme-color check follows `--page`.

---

## 13. Versions (2026-10-06)

Until plan 0012 every example said `"version": "1.0"` whatever had happened to it, and Snuggery never
read the field (plan 0012, finding 1). From now on it means something.

- **The form**: digits and dots, `MAJOR.MINOR` or `MAJOR.MINOR.PATCH` (`2.1`, `1.2.1`). Nothing else:
  no letters, no leading `v`.
- **What bumps it**: any change that alters what a person sees or can do. **A remake** (the app
  rebuilt, or its look replaced, as Hello Live's plan 0011 pass replaced the stock card) is a major
  version: `1.4` to `2.0`. **A pass or a new feature** is a minor one: `1.1` to `1.2`. **A fix** is a
  patch: `1.2` to `1.2.1`. A data refresh, a new snapshot or a change to `tools/` alone does not bump it.
- **One bump per published change.** The version after a package is higher than the version the
  package started from. Two passes inside one package, before anything is published, take one bump,
  of the larger kind. The plan 0011 passes that left their app at `1.0` are folded into plan 0012's
  bump; they are not counted again.
- **How Snuggery reads it.** Snuggery 1.2's update path for its live examples compares versions
  numerically, segment by segment: `1.10` is newer than `1.9`, and a missing segment counts as 0, so
  `1.2` equals `1.2.0`. *Install the live examples* offers to update an installed example only when
  the bundled version is higher; one at the same or a higher version is left alone, because it may be
  the person's own copy (plan 0012 L5). A batch import shows the versions old and new and never
  decides by them (D7). So a look that changed without a bump never reaches the people who
  installed the app before.
- **Where it is pinned.** The pass's builder bumps `miniapp.json` in the same change as the look.
  `check.mjs` item 7 compares with the version the pass started from. A check that pins `'1.0'`
  (Earth's History, US Quakes, Warming World) pins the new value; Warming World's About prints the
  version (`Version: …`), and its `shoot.mjs` follows. The bundled versions are also written in
  Snuggery's starter-pack entry table, pinned by its test (L5), and the lead updates them with the
  pack.
- **As plan 0012 found them**: Anatomy 4.0, Besseggen 1.2, Earth's History 1.0, Finances 1.0, Global
  Weather 2.1, Global Wind 1.1, Hello Live 2.0, Milky Way 1.0, Norne Reservoir 2.1, Outdoor Window
  1.1, Power Hours 1.1, Running Dashboard 1.0, Shelf Atlas 1.1, Snug Kart 1.0, US Quakes 1.0,
  Warming World 1.0, World News 1.0, World Oil & Gas 1.1. Each app's target is in
  `docs/plans/0012-change-lists.md`.
