# Global Weather — art direction

`DESIGN.md` says what the app does. This file says how it looks, moves and speaks. Global Wind takes
all of it by copy. Every figure below names the command that printed it; the scripts are in `tools/`
of the template repository, which does not travel with the app. Choices marked *owner call* are
listed, with what each was chosen over, in `tools/DECISIONS.md` there, beside the record of how this
look was built and reviewed.

---

## The look: Long Exposure

In a fluid laboratory you seed the water with tracer particles, light them, and hold the shutter
open. Each particle draws its own path, and the length of a streak is its speed times the exposure.
The caption under the photograph states the exposure, because without it the picture cannot be
read. This app's screen is that photograph of the air, retaken sixty times a second from the
forecast. Every streak is a tracer carried by the wind the forecast gives for that place and hour,
and the caption under the plate states the exposure: `Streaks: 1 s = 24 h of wind at the hour
shown`.

- **Dark theme: the print.** Pale tracers on a dark plate, the way flow photographs are printed.
- **Light theme: the negative.** The same picture on clear film base: dark tracers on a pale,
  faintly cyan ground. In both themes "more" stands further from the ground, and the streaks have
  the far end of the lightness range to themselves (the tonal budget below).
- **The plate and its caption.** The view runs edge to edge as the plate. Under it, the caption
  band carries the scale, the exposure and the credits, in one face. Nothing is pasted on the
  photograph except the map keys and the tapped readout.
- **One bold thing: the streaks.** Everything else is quiet: one face, no accent color, no glass,
  no shadows, and no gradients in the chrome. The only gradients are the data scale and the
  selection mark, which is a drawn tracer.
- **Honesty is the metaphor.** A flow photograph is a measurement. Its rules are this app's rules:
  the streaks come from the field and nowhere else, the exposure is printed, and the plate's
  conditions (the forecast's age, NOAA's "sampled") never leave the screen.

**How it differs from the three showpieces before it** (it must not copy any of them):

| | Earth's History | US Quakes | Warming World | Global Weather and Global Wind |
| --- | --- | --- | --- | --- |
| Name | Deep Field Atlas | Drum Record | Gray Card | **Long Exposure** |
| Metaphor | an atlas plate photographed at night | a seismograph's drum | a photographer's neutral card | a flow photograph and its caption |
| Ground | night in both themes | drum paper, soot | exact grays, chroma 0 | film base (light), the print (dark); faint cyan-slate, h 220–227 |
| Type | Newsreader + Atkinson | Atkinson + Red Hat Mono | Archivo | **Ysabeau Office**, one variable file |
| Accent | survey blue | none | none | none; the tracer (`#f4f2ea` / `#0b171d`) is the one recurring mark |
| Signature | the ICS color bar | the record strip | the stripes as an instrument | the streak field, captioned with its exposure |
| Data colors | fixed | fixed | fixed, theme-independent | **one hue path per layer, printed twice**: lightness inverted between themes |
| Motion | an eased settle | critically damped | a turn with weight | the measured field, nothing else |

---

## Type: Ysabeau Office, one file

**Ysabeau Office** (Christian Thalmann, Catharsis Fonts; SIL OFL 1.1, **no Reserved Font Name**: the
copyright line of google/fonts' `OFL.txt` names none). google/fonts describes Ysabeau as combining
"the familiar timeless letterforms of the Garamond legacy with the unencumbered crispness of a clean
low-contrast sans serif". It is a Renaissance sans: Garamond's proportions without the serifs, and
the Office cut has a larger x-height and plainer forms for small text. The other three showpieces
use a slab-free grotesque (Archivo), a hyperlegible humanist (Atkinson) and a serif (Newsreader).
None of them is a Renaissance sans. The four reasons it was chosen, all measured:

1. **It holds every character the app writes, including U+202F.** It is the only face of thirteen
   checked that draws the narrow no-break space the SI rule groups thousands with. Archivo, Atkinson
   and Red Hat Mono all lacked it. It also draws U+2009, U+2212, ≤ ≥, °, ×, primes, ‹ › and the
   ellipsis. (A font check over the candidates' character maps. Encode Sans came closest, lacking
   only U+202F, and is ruled out by its Reserved Font Name.)
2. **A plain zero and tabular figures.** `zero` has two contours (no slash), and `tnum` is in the
   font, so the valid time, the legend and the readout do not shift as numbers change.
3. **It is compact without condensing.** Garamond proportions are narrow by nature, so `Map Globe
   Wind Temperature Rain Cloud Pressure` sets at 12.5 px in about 350 px. That fits at 390 px with
   the full words, where the stock app abbreviated "Temp" and "Press.". The owner asked for
   restrained type, not small type.
4. **GeoNames' place names.** Of the 1 612 names in `assets/places.json`, the cut lacks only ḑ, Ḩ
   and ḩ (U+1E11, U+1E28, U+1E29), which the upstream font does not draw. The browser takes those
   three letters from the system face.

| Role | Setting | Where |
| --- | --- | --- |
| Valid time | 600, 21 px / 1, tabular | the time row: the app's one large figure |
| Readout value | 600, 21 px, tabular; unit 400 at 13.5 px after U+202F | the tapped card |
| App name | 650, 15 px | "Global Weather" in the header |
| Body | 400, 13.5 px / 1.5, at most 62 ch | About's prose (Ysabeau's long extenders want the extra leading) |
| Section heads | 650, 13.5 px, sentence case | About |
| Controls | 400, 12.5 px; 620 when on | Map, Globe, the layer words, Close |
| Readouts | 400, 12.5 px / 1.35, values 560 tabular | the card's rows, the time row's lead |
| Stamp | 400, 11.5 px, `--ink-2`; a stale clause in `--ink` | under the app name |
| Instrument labels | 400, 10.5 px, tabular | legend ticks, day labels, `now` |
| Caption | 400, 11 px, `--ink-2`; the legend's title 600 at 11.5 px in `--ink` | the caption band |
| Fine print | 400, 10.5 px, `--ink-2` | the credit line |
| Place names (canvas) | 560, 11.5 px over a 3 px halo | the map and the globe |

The scale is **10.5 / 11 / 11.5 / 12 / 12.5 / 13.5 / 15 / 21 px** (12 px is the readout's place line, as built). Nothing is larger than 21 px. Nothing
is set in capitals or small capitals, nothing is letter-spaced, and no label sits above a heading.
`body` sets `font-variant-numeric: tabular-nums lining-nums`. Prose that is not a number column
(About, the caption) sets `proportional-nums`, which the cut cannot honor: the face has no `pnum`, and its default figures are already tabular (every digit 517/1000 em), so the figures are the same either way.

**The file** (`fonts/`, vendored in this pass):

| File | Bytes | From |
| --- | --: | --- |
| `ysabeau-office-gw.woff2` | 35 372 | `tools/art/font_subset.py`: google/fonts commit `9710da1e…` (2026-09-30), `ofl/ysabeauoffice/YsabeauOffice[wght].ttf` (401 964 B, sha256 `0f305c84…`), weight axis cut to 400–650, 685 glyphs |
| `OFL.txt` | 4 703 | upstream `OFL.txt` (sha256 `1343b916…`), headed by a note naming the file, the commit and the cut |

That totals **40 075 bytes** (`cat fonts/*.woff2 fonts/OFL.txt | wc -c`) against the 160 000-byte
budget. The output's sha256 is `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`.
Two runs were byte-identical (`cmp`).

- **Command** (from `Template/`, in any venv with fonttools 4.60.2 and Brotli; the pipeline's venv
  is not used): `python global-weather/tools/art/font_subset.py`.
- **Characters**: Basic Latin, Latin-1, Latin Extended-A, Ơ ơ Ư ư (U+01A0–01A1, U+01AF–01B0), Ș ș
  Ț ț (U+0218–021B), combining macron and dot above (U+0304, U+0307), Latin Extended Additional
  (U+1E00–1EFF, which GeoNames uses for Vietnamese and transliterated names), U+2009, U+202F,
  dashes, quotes, the ellipsis, primes, single guillemets, U+2212 and ≤ ≥.
- **Features kept**: kern, tnum, case, liga, calt, ccmp, locl, mark, mkmk (the upstream has no `pnum`, and the subset empties `lnum`; measured on the shipped woff2).
- **Checked on the cut** with fontTools: axis wght 400–650, features as above, places missing
  `ḑḨḩ` only, and U+2212, U+202F, U+2009, °, ≤ ≥, …, ‹ ›, × and ′ all present.

`@font-face`: one rule, `font-family: 'Ysabeau Office'; src: url(fonts/ysabeau-office-gw.woff2)
format('woff2'); font-weight: 400 650; font-display: block`. The file is local, so there is no
network wait to hide, and `block` stops the canvas from drawing in a fallback face. The fallback
stack is `system-ui, -apple-system, sans-serif`.

**Canvas text waits for the face.** Place names on the canvas are drawn in the same face.
The app awaits `document.fonts.load('560 11.5px "Ysabeau Office"')` before the first frame with
text, and redraws `#top` on `document.fonts`' `loadingdone`. Warming World's study drew its first
labels in a serif because it did not wait.

**Credit line** (the same words in About, `NOTES.md` and `assets/LICENSES.md`):
`Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is
in fonts/ with its license.`

**Rejected, with the reason** (the same cut of google/fonts, `fontcheck.py` and a 390 px specimen
of the app's own strings in both themes):

| Face | Why not |
| --- | --- |
| Archivo, Atkinson Hyperlegible, Newsreader, Red Hat Mono | the voices of the other three showpieces |
| Encode Sans | "with Reserved Font Name "Encode Sans"" in its OFL.txt, so a subset could not keep its name |
| Instrument Sans | lacks ≤ ≥, U+2009 and the primes, and is a frequent choice of generated pages |
| Cabin | Gill and Johnston's descendant (a transit voice); its U+2212 is hyphen-short, so −12 read as -12 in the specimen |
| Commissioner, Geologica | well made but wider: in the 374 px specimen Geologica's layer row ran past the edge and Commissioner's filled it, where Ysabeau left room |
| Sofia Sans (Semi Condensed) | lacks ŭ ơ and the Vietnamese letters GeoNames uses |
| Schibsted Grotesk | a newspaper group's house face |
| B612 | lacks Latin Extended (Ā ă Ł ń Ş …), and it is an aircraft-cockpit face whose voice would claim an authority this forecast does not have |
| Hanken, Host, Familjen Grotesk | grotesques with no reason to be here, and each lacked U+202F |

---

## Palette

### The tonal budget (the rule everything else follows)

A streak is about 1 CSS px wide, so it reads only if it stands well apart from the color under it
in lightness. Hue is not enough. So the lightness range is split:

- **Light theme**: the data lives in OKLab L **0.625–0.955**. The streak is ink at L **0.196**.
- **Dark theme**: the data lives in L **0.255–0.650**. The streak is a warm white at L **0.960**.

Each layer has **one hue path, printed twice**. Each stop has a salience s, where 0 is the plate's
own tone and 1 is as far from the plate as the band allows. The light theme prints salience as
darkness (the negative) and the dark theme prints it as light (the print). So in both themes a gale,
a downpour, deep cold or a deep low stands furthest from the ground, and calm, dry, clear and
1013 hPa sit near it. The legend paints from the same stops as the map, per theme, so the scale
under the map is always the scale on it. The cost, owner call 1: one value has two colors, one per
theme, as the cloud layer already did.

### Chrome tokens

| Token | Light: film base | Dark: the print | Used for |
| --- | --- | --- | --- |
| `--page` | `#e8eef0` | `#141d21` | header, caption band, player |
| `--sheet` | `#f6f9fa` | `#1c272c` | key plates, the readout card, About, notices |
| `--ink` | `#0f1c23` | `#e6edee` | text, the thumb, the selection mark, focus rings |
| `--ink-2` | `#45555d` | `#a3b1b6` | secondary text, the stamp, icons at rest |
| `--ink-3` | `#5b6a72` | `#8b9a9f` | day ticks, the `now` label |
| `--line` | `#c9d4d8` | `#2a373c` | hairlines, the key plates' edge |
| `--line-strong` | `#74858c` | `#64757b` | the track's baseline, the units key's frame, the card's edge |

The light page is not cream: OKLCh L 0.945, C 0.007, h 220. The dark page is not near-black: L
0.224, C 0.015, h 227, a slate that leaves room for a darker plate. `theme-color` metas carry
`--page` per scheme, and `color-scheme: light dark` is on `<html>`.

### The plate (`buildPalette()` in `app.js`)

| Value | Light | Dark |
| --- | --- | --- |
| ocean | `#d3e0e4` (L 0.898) | `#0c1518` (L 0.188) |
| land | `#eef2ef` (L 0.957) | `#1a262a` (L 0.259) |
| outside the globe | `#e8eef0` (= `--page`) | `#0a1013` |
| coast | `#5f7079`, 0.9 px | `#8a9ca3`, 0.9 px |
| borders | `#9fb0b7`, 0.6 px | `#46565c`, 0.6 px |
| graticule | `rgba(15,28,35,.07)` | `rgba(230,237,238,.06)` |
| night wash | `rgb(18,33,43)` up to **0.20** | `rgb(2,6,9)` up to **0.42** |
| place label / halo | `#0f1c23` on `rgba(246,249,250,.88)` | `#e6edee` on `rgba(12,21,24,.88)` |
| streak | `#0b171d` (OKLCh 0.196 0.021 231) | `#f4f2ea` (OKLCh 0.960 0.011 95) |
| arrows (when on) | the streak's color over a 2.6 px halo of the label halo | the same |
| globe limb | 1 px `--ink` at 35 % | 1 px `--ink` at 30 % |
| tapped marker | a 6 px ring, 1.5 px `--ink`, over a 3.5 px label-halo ring, and a 2 px dot | the same |

There is no glow, no atmosphere and no stars on the globe. Earth's History rejected the star field
as every globe demo's, and the outside is the plate's own tone.

### Contrast, measured

`python3 global-weather/tools/art/palette.py` (from `Template/`, standard library only) printed
every figure here and ended `ALL CHECKS PASS`:

| Pair (WCAG 2) | Light | Dark |
| --- | --: | --: |
| `--ink` / `--ink-2` / `--ink-3` on `--page` | 14.80 / 6.61 / **4.78** | 14.43 / 7.76 / 5.88 |
| `--ink` / `--ink-2` / `--ink-3` on `--sheet` | 16.40 / 7.32 / 5.29 | 12.87 / 6.92 / **5.25** |
| `--line-strong` on `--page` (non-text, ≥ 3) | 3.27 | 3.56 |
| place label on its halo | 16.40 | 15.59 |
| coast on ocean / on land | 3.81 / 4.55 | 6.48 / 5.44 |
| streak on bare ocean / land | 13.47 / 16.10 | 16.49 / 13.83 |

**Streaks over the weather.** For every layer and 97 values across its legend, over ocean and land,
by day and at full night, the head of a streak was composited over the base under it. The table
gives the worst case for each layer. The target is ≥ 3.0:1 by day (WCAG's non-text figure) and
≥ 2.5:1 at night.

| Layer | Light day / night | Dark day / night | Worst at |
| --- | --: | --: | --- |
| Wind | 4.30 / 3.28 | 3.32 / 4.37 | 36 m/s |
| Temperature | 4.47 / 3.41 | 3.46 / 4.48 | 45 °C |
| Rain | 4.30 / 3.31 | 3.30 / 4.36 | 40 mm/h |
| Cloud | 5.03 / 3.82 | 3.52 / 4.49 | 100 % |
| Pressure | 4.73 / 3.62 | 3.63 / 4.61 | 955 hPa |

The ghost key over every base: stroke against its own halo, worst **5.28** (light) and **4.85**
(dark).

### The ramps

Stops are (value, salience, OKLCh chroma, hue), interpolated in OKLab. A stop that asks for more
chroma than sRGB has at its lightness is printed at the most the screen has (`gamut_map`,
hue and L kept). `palette.py --json` prints the per-theme sRGB stops in the shape `LOOKS` takes,
each interval split in four, so that `rampAt`'s straight sRGB interpolation stays within ΔE 0.0052
of the OKLab path the checks ran on. `js/ramps.js` is that output, pasted and never retyped, and
`check.mjs` fails while the two differ.

| Layer | Hue path | Stops, light → | Stops, dark → |
| --- | --- | --- | --- |
| Wind (0–36 m/s) | cyan 200 → blue 245 → violet 305 → crimson 358 | 0 `#e9f2f3` · 6 `#91d5eb` · 10 `#7dbcf1` · 15 `#8e9def` · 20 `#ae81df` · 26 `#c46cbd` · 36 `#cc5b87` | 0 `#1d2425` · 6 `#014f62` · 10 `#206090` · 15 `#5b67b3` · 20 `#8e61bc` · 26 `#b45eae` · 36 `#d5638f` |
| Temperature (−40–45 °C) | violet 290 → blue 250 → slate 205 at 0 °C → green 150 → ochre 80 → red 15 | −35 `#748ae7` · −8 `#7fc3e6` · 0 `#bad6d9` · 14 `#b2bc6c` · 22 `#d09c36` · 30 `#de7932` · 38 `#db644e` | −35 `#677bd7` · −8 `#17607f` · 0 `#2d4548` · 14 `#5b6307` · 22 `#8d6405` · 30 `#bf5d03` · 38 `#d55e48` |
| Rain (0–40 mm/h) | green 165 → teal 190 → blue 260 → magenta 325 | 0.3 `#9ae1c8` · 1 `#66d1cb` · 3 `#4bbbe2` · 8 `#6d9eee` · 18 `#9580e3` · 40 `#b464b9` | 0.3 `#004d3b` · 1 `#05615d` · 3 `#01708e` · 8 `#4674c1` · 18 `#856fd1` · 40 `#bc6cc1` |
| Cloud (0–100 %) | one cool gray, h 240, C ≤ 0.016 | 0 `#aab1b7` → 100 `#7f8991` | 0 `#5b6267` → 100 `#879198` |
| Pressure (955–1050 hPa) | violet 300 (lows) → neutral at 1013 → ochre 55 (highs) | 975 `#9692e5` · 995 `#a2c1f4` · 1013 `#e5eeee` · 1032 `#d3a658` · 1045 `#cc8331` | 975 `#6f69b8` · 995 `#36507c` · 1013 `#212828` · 1032 `#825b00` · 1045 `#b26c0c` |

The full stop lists, with the values beyond each legend, are in `palette.py`. The alpha rules stay
as `LOOKS` writes them, with these values: wind 0.40 → 0.92 over 0–8 m/s (calm lets the plate
through); temperature 0.90; rain 0 below 0.02 mm/h, then 0 → 0.92 up to 1.2 mm/h (a dry world
looks dry); cloud 0 → 0.82 over 0–100 %; pressure 0.88. `pal.alphaScale` becomes 1 in both themes.

**Checks** (the same run): every ramp's ends separate under normal vision and simulated deutan,
protan and tritan vision by ΔE ≥ 0.10 (the lowest is pressure under tritan, 0.146). Every eighth of
every legend, as it is seen over the ocean, steps by ΔE ≥ 0.02. The first eighth of wind, rain and
cloud is exempt, because calm, dry and clear fade into the plate on purpose (the lowest is cloud,
light, 0.021). Wind's dark band has 3 chroma-limited samples, temperature's 16, rain's 25 and
pressure's 12, all on the dark side, where sRGB has little chroma at low lightness.

**What was given up, said plainly.** The radar convention for rain (green → yellow → red) and the
rainbow wind scale are gone. The rainbow put yellow at L ≈ 0.85, where no streak of either theme
can read. In the dark theme the mild-warm band (10–24 °C) prints as khaki and ochre rather than
yellow, because a dark yellow is ochre. These are owner calls 2 and 3.

---

## The streaks: how they read

DESIGN §1 decides what a streak is: the measured wind, at its speed and in its direction, at the
hour on the slider. This section decides how it is drawn.

- **Color**: one color per theme, `#f4f2ea` (dark) and `#0b171d` (light). The color never encodes
  anything. Speed is the colored layer's job, and the layer is labeled. Neither color is a hue of
  any ramp: both have chroma ≤ 0.021.
- **Weight**: 1.0 CSS px in both themes (2 device px at DPR 2), `lineCap: 'round'` so that a curving
  path has no gaps between its frame-segments, and `lineJoin: 'round'`.
- **Alpha**: the head is drawn at **0.95** (dark) and **0.85** (light). The light theme is lower
  because dark ink on a pale ground reads heavier at equal alpha. In the study, 0.92 looked heavy
  against the place labels. The trail fades by DESIGN §1.6's half-life (0.18 s), quantized to four alpha bins.
- **Compositing**: plain `source-over`. There is no `lighter`, `screen` or additive blending, so a
  convergence line does not bloom into a bright "hot spot". Additive light would turn tracer
  density into brightness, a quantity nobody measured. There is no glow, no shadow and no blur.
- **Night**: the dark theme dims a streak on the night side by κ = **0.30** × the base's own
  twilight ramp, so a pale tracer does not contradict the terminator under it. The light theme uses
  κ = **0**: the night wash already darkens the pale ground under a dark streak, and dimming the
  streak too would erase it (at κ 0.5 the light night worst case measures 1.86:1, `palette.py`). Both are in the
  contrast table above (DESIGN §1.12).
- **Arrows**, when on alone or with the flow, are drawn on `#top` in the streak's color over a halo:
  a 1.4 px shaft, a filled 5 px head, and length by speed as today. With both on, the arrows sit
  over the streaks.
- **Never**: colored streaks, streaks whose width or length is a setting, sparkle, comet heads that
  are not the trail's own fade, a vignette, or any motion over the plate that is not the field.

**What "cool animations" means here.** The owner asked for an animation that shows off the
platform. The animation is the forecast itself. A cyclone off Iceland winds into a spiral. The
trades stream west below 20°. The Southern Ocean's westerlies run unbroken around the plate.
Streaks bunch along lines where the air meets (and, on the flat map, wherever the air runs toward
the equator, because the map shrinks the ground there: a streak's spacing is never read as a
measurement). Press play and all of it moves through five days at
5 hours a second, with the streaks riding the interpolated field (DESIGN §1.10). The craft goes into
making that read: the tonal budget, the trail length, the exposure printed beside it. Nothing is
added for effect.

---

## The chrome, object by object

The layout at 390 × 844 (heights in CSS px, safe-area insets added outside them):

```
┌──────────────────────────────────────────┐
│ Global Weather                     [m/s] │ 22  name 15/650; the units key
│ Updated 22 Sep, 04:15, GFS 06Z 22 Sep    │ 16  stamp 11.5, --ink-2
│ Map  Globe     Wind  Temperature  Rain … │ 40  view switch | layer words (row scrolls)
├──────────────────────────────────────────┤
│ [card]                              [+]  │
│                                     [−]  │
│                                     [◯]  │
│          the plate: base, streaks,  ───  │
│          arrows, places             [≈]  │  Flow
│                                     [↗]  │  Arrows
│                                     [◐]  │  Night
│                                     ───  │
│                                     [▭]  │  Hide the controls
├──────────────────────────────────────────┤
│ Wind, 10 m above ground  ▕▔▔▔▔▔▔▔▔▔▔▔▏    │ 28  legend: title, bar, ticks (unit on the last)
│                          0  10  20 36 m/s│
│ Streaks: 1 s = 24 h of wind at the hour… │ 30  the exposure, two lines high whatever it says
│ NOAA GFS, sampled · Natural Earth · Geo… │ 14  the credit line, unchanged
├──────────────────────────────────────────┤
│ Wed 23 Sep, 11:00         +36 h, 8 d ago │ 28  the time row
│  ‹   ■▶   ›   ──────●────────·─────────  │ 44  transport | the time track
│                Tue  Wed  Thu  Fri  Sat   │ 14  day labels
└──────────────────────────────────────────┘
```

That leaves 559 px of plate at 390 × 844 (measured by `tools/shoot.mjs`, with the stamp on two
lines because the demo forecast has run out), against about 657 in the stock app. The caption band
costs about 85 px of height (about 45 px more of the plate than the overlaid legend it replaced), its exposure line holding two lines' height whatever it says, and in exchange
the legend and the credits no longer cover the plate (owner call 6).
Content is left-aligned throughout. The only centered things are the error sentence on the plate
and the play key's glyph.

**Header** (`--page`, no rule under it, since the plate's edge is the edge). The name and the stamp
sit left. The **units key** is a word key at right: the unit (`m/s`, `°C`, `km/h` …) in 600 at
12.5 px inside a 1 px `--line-strong` frame, 28 px tall, 6 px radius, 44 × 44 hit area, and
accessible name `Change units, now m/s`. It is a key, not a pill: the radius is small, and the frame
is there because the word is a control.

**The stamp** keeps its words and its rules (DESIGN §3, §4). The separators become commas and
sentences: `Updated 04:15, GFS 06Z 22 Sep`, or `Updated 22 Sep, 04:15, …` when not today. A stale
forecast leads with a sentence in `--ink` (the rest of the line stays `--ink-2`): `Forecast ran out
4 d ago. Updated 22 Sep, 04:15, GFS 06Z 22 Sep` or `Stale. Updated …`. There is no red and no amber:
the temperature ramp uses those colors, and the words carry the warning. Tapping the stamp opens
About, as today.

**The view switch and the layer words** share one 44 px row. `Map` and `Globe` (exact text, for the
camera) are tabs, then a 1 px `--line` divider 14 px tall, then the layer words from the snapshot's
`label` in full: Wind, Temperature, Rain, Cloud, Pressure. Each is a 44 px-tall hit, with the words
16 px apart. **The chosen one is marked by a tracer**: weight 620, and under it a 2 px line as wide
as the word plus 4 px, fading from transparent at its left end to `--ink` at its right, ending in a
4 px disc. It is the streak glyph, the one mark the chrome borrows from the plate. Unchosen words
are 400 in `--ink-2`. The row scrolls sideways inside itself if a narrow screen needs it
(`overflow-x: auto`, scrollbar hidden, `scroll-padding` 16 px), and the page never scrolls sideways.
The swatches the stock chips carried are gone, because the legend under the plate shows the scale.

**The key column** sits over the plate's right edge, inset 8 px. It holds three plates of
`--sheet`, each with a 1 px `--line` edge, a 6 px radius and no shadow, separated by 8 px. Each key
is 36 × 44 drawn (44 × 44 hit) with hairline `--line` separators inside a plate. Icons are
1.5 px strokes in `--ink-2`, `--ink` when on.
- **Zoom in** (`+`), **Zoom out** (`−`), **Whole world** (four corner brackets around a 5.5 px
  circle: everything, fitted; not a globe, which would be read as the Globe tab one row up). These
  are the camera's labels, kept.
- **Flow** (`Show the wind's flow`): three curved streaks of 9, 8 and 6 px, staggered, each ending in
  a 2.8 px dot: the tracer mark the selected word carries, drawn as streamlines so it cannot be read
  as a list or an alignment icon.
- **Arrows** (`Show wind arrows`): one 12 px arrow, shaft and open head.
- **Night** (`Shade the night side`): a 13 px globe whose night side is filled, bounded by an
  elliptical terminator, with the equator drawn across the day side. The equator is what keeps it
  from reading as a moon's phase or the system's contrast glyph.
- **Hide the controls** (focus mode), alone in the last plate (below).

**On, pressed, hover, focus** (all three toggles carry `aria-pressed`). On: the icon in `--ink` over
a 28 × 28 px plate of `--ink` at 12 % with a 4 px radius, the key visibly held down. Off: `--ink-2`
and no plate. Pressed (while held): the plate at 22 % of `currentColor`. Hover, only where the
pointer can hover (`@media (hover: hover)`): an icon key gets a 7 % plate, and a text key goes to
full `--ink`. Focus: `:focus-visible` gets a 2 px `--ink` ring at a 2 px
offset, never a hue, and is never removed without that replacement. `touch-action: manipulation`
on every control and `-webkit-tap-highlight-color: transparent`, since the pressed plate replaces
it.

**The caption band** (`--page`, under the plate):
1. **The legend.** The title comes from the snapshot, `${label}, ${level}` (`Wind, 10 m above
   ground`, `Pressure, mean sea level`), 600 at 11.5 px. To its right sits the **bar**, 6 px tall
   and the remaining width (at least 150 px), painted from the same LUT as the map at the same
   alpha over the theme's ocean, with a 1 px frame of `--line-strong` at 60 %, square ends and no
   radius. Its **ticks** are 3 px marks at the true positions with 10.5 px labels below, measured
   apart as today, with the unit on the last label after U+202F (`36 m/s`, `45 °C`). Negative
   ticks take U+2212.
2. **The exposure** (DESIGN §1.13): `Streaks: 1 s = 24 h of wind at the hour shown`, with the
   rung's text from DESIGN §1.5. On the map, once the view reaches 45° of latitude, it adds `,
   faster toward the poles, where the map stretches`. 11 px `--ink-2`, `1 s` and `24 h` with
   U+202F. **Its height is fixed**: two lines below 640 px of width, which hold the longest line
   (544 px) on any phone held upright, and one line from 640 px. Its words change with the view, the
   keys and Reduce Motion, and a line that grew and shrank with them would move the plate above it.
   Under Reduce Motion or with the flow off it reads `Arrows: length and weight grow with wind speed
   up to 25 m/s` (in the unit on screen, a whole number printed whole; when arrows are drawn), or is empty and keeps its
   height.
3. **The credit line**: the `CREDITS` constant, byte for byte (`NOAA GFS, sampled · Natural Earth ·
   GeoNames CC BY 4.0`), 10.5 px `--ink-2`. Its middle dots are the one place they stay (owner call
   4).

**The time row.** The valid time is the one large figure, 600 at 21 px, tabular, built by hand in
`js/units.js` from the phone's clock, 24-hour and day before month, the same on every locale:
`Wed 23 Sep, 11:00` (owner call 8). VoiceOver hears it spelled out, `Wednesday 23 September,
11:00, 36 hours after the run`. The lead sits at the right in 12.5 px `--ink-2`: `+36 h, 8 d ago`, or `+30 h, now`, with U+202F.
No transition on any of it (DESIGN §2.2).

**The transport keys** are 44 × 44 hits.
- `‹` and `›` (Previous step and Next step): 1.5 px chevrons, 10 px tall, in `--ink-2`.
- **Play** is the one solid key: a 32 × 32 `--ink` square with an 8 px radius and a `--page`
  triangle (pause: two 2.5 px bars). It is the shutter release, the one control that starts motion,
  and the only filled control in the app. It changes to pause without animation, and its mark always
  matches its name (`Play` or `Pause`).

**The time track** (DESIGN §2's own element, `id="slider"`, `role="slider"`). It is a 44 px-tall
hit across the remaining width.
- **Baseline**: 1 px `--line-strong`. From step 0 to the shown step it is 2 px `--ink`, the
  exposure so far.
- **Ticks**: 41 step ticks, 3 px `--ink-3` at 50 % under the baseline. Each local midnight gets a
  7 px `--ink-2` tick with a 10.5 px day label under it (`Wed 23`, or `Wed` when the space measured
  is short).
- **`now`**: if the present falls inside the forecast, a 1 px `--ink-2` notch 9 px tall rises above
  the baseline at that position, with `now` in 10.5 px `--ink-3` over it. If the forecast has run
  out there is no notch, and the stamp says so.
- **The thumb is a tracer head**: an 8 px `--ink` disc on the baseline with a 3 px `--page` ring,
  and a 1.5 px `--ink` rule 18 px tall through it. Pressed, the disc is 10 px, an instant state
  change with no transition. It always stands at the **shown** step (DESIGN §2.2) and never glides.

**The readout card** (the tapped place) sits top-left on the plate, inset 8 px, at most 280 px
wide. When it would cover the place that was tapped, it sits bottom-left instead, so the marker is
never under its own card. Place names are not drawn under it, nor under the key column. `--sheet`, a 1 px `--line-strong` edge, an 8 px radius, no shadow, no blur, `4px 4px 10px 12px`
padding and a 176 px minimum width.
- The place line: the coordinates as today, `27.0° N, 1.5° E` (U+202F before the hemisphere).
  12 px `--ink-2`, with ✕ (an SVG, 44 px hit) at the right.
- The value: 21 px, 600, with the unit 13.5 px after U+202F.
- For wind, a **direction mark** before the value: a 16 px streak glyph rotated to where the air
  goes, never the ➤ character. Then a line in 12.5 px: `From ENE (63°), moderate breeze, Beaufort
  4`.
- The other layers' rows: a `dl` in 12.5 px, labels `--ink-2` left, values `--ink` 560 tabular
  right-aligned. It appears with a 120 ms fade and a 4 px rise, and is hidden at once (no exit animation is built: `[hidden]` is `display: none`).

**About** is a full-height `--sheet` panel that slides up over 220 ms, with `overscroll-behavior:
contain` and focus held inside it. Its sections, each headed 650 at 13.5 px in sentence case and
separated by a 1 px `--line` rule (no cards inside):
1. **What the streaks are**: the exposure, the Mercator stretch, the 2° grid, and that nothing about
   a streak is invented.
2. **This forecast**: `label: value` lines, one per line, no middle dots.
3. **Sources and credits**: NOAA's statement and "sampled", Natural Earth, GeoNames with the license
   text as printed text (not links), and the font's line.
4. **How the data gets here.**

The prose is 13.5 / 1.5 within 62 ch. `Close` is a text key at the foot and at the top right, and
Escape closes too.

**Notices and errors.** A broken, missing or schema-mismatched snapshot is a sentence centered on
the plate: a `--sheet` plate with a 1 px `--line-strong` edge and an 8 px radius, 13.5 px `--ink`,
at most 300 px wide, with no icon and no colored bar. Loading reads `Unpacking the forecast… 12 of
41` in the stamp, with a real ellipsis, while the plate shows its bare ground and coasts.

**Focus mode** (DESIGN §3; what leaves and what stays is decided there). Two keys, drawn as the
screen each one leads to:
- **Hide the controls** (in the key column's last plate): a 15 × 14 px frame (1.5 px corners)
  holding one streak glyph, and under it, inside the frame, a 9 px line with a 3 px dot: a screen
  showing only the plate and its track, which is what stays. (A track drawn under the frame read as
  a laptop.)
- **Show the controls** (the ghost key), in the plate's top-right corner where the column was,
  inset 8 px below the top safe area (in Snuggery's full screen the plate starts under the status
  bar once the header has gone), 44 × 44 hit, `aria-keyshortcuts="Escape"`: the same frame, holding a plain line
  where the hide key holds a streak, with a 15 px line added 3.5 px above the frame, the header returning. No arrow is drawn under it. It has no plate. It is drawn like the overlay:
  dark theme, a 1.4 px `#f2f4f1` stroke over a 3.4 px `rgb(10,16,19)` halo at 45 %; light theme, a
  1.4 px `#0f1c23` stroke over a 3.4 px `rgb(246,249,250)` halo at 60 %. It rests at 72 % opacity
  and is full on hover, focus and press. Over every base the stroke holds 5.28:1 (light) and 4.85:1
  (dark) against its halo (`palette.py`).
- In focus mode the caption band keeps the exposure and the credit line, and the stamp moves into
  it as the first line (its words unchanged). The legend's bar and ticks leave (owner call 5). The
  time row, transport and track stay. An open readout card closes on the way in, since it is a
  panel; a tap in focus mode opens it again, inset below the top safe area like the ghost key.

**A phone on its side** (landscape, at most 500 px tall). Each band gives the plate its second row:
the header is one 46 px row (the name over the stamp at left, the view switch and layer words in
the middle, the units key at right); the caption puts the legend and the credit line side by side
over the one-line exposure; the player is one row (the time row stacked at left, then ‹ ▶ › and the
track). At 844 × 390 that is a 234 px plate, against 136 with the upright layout. The key column
becomes a row along the plate's top whenever the column would not fit the plate's height, so it
never wraps into a second column over the weather. A plate still too narrow for the row (a 320 px
phone held upright, 283 px of plate) keeps the wrapped column: seven 44 px keys do not fit either
way.

---

## The opening

**There is no opening sequence**, and nothing to store or skip. The arrival is the release of the
tracers. On the first frame after the forecast is unpacked, the trail canvases start empty (no
prewarm on this one frame), and the streaks write themselves in over the 0.6 s a trail lives. Every
later restart (a step change, a return from hidden, a resize) prewarms as DESIGN §1.10 says, so old
streaks never show. A touch during those 0.6 s works at once. Under Reduce Motion there are no
streaks to release.

## Motion

Two curves:

| Token | Curve | For |
| --- | --- | --- |
| `--draw` | `cubic-bezier(0.2, 0, 0, 1)` | things that answer a touch: the selection tracer, the card, the ghost key |
| `--sheet-in` | `cubic-bezier(0.32, 0.72, 0, 1)` | About sliding up |

| What | How |
| --- | --- |
| The selection tracer moving to a new word | it draws in from its tail to its head, 160 ms `--draw` (`clip-path` inset from the right, so only `transform`/`clip-path` animate) |
| Readout card in | 120 ms opacity and a 4 px `translateY`; out at once |
| About in | 220 ms `translateY`, `--sheet-in`; out at once |
| Focus mode | the chrome fades out over 160 ms; the canvases resize once, never blank (DESIGN §3); the ghost key fades in over 200 ms |
| The thumb, the time row, the lead, the legend's numbers, the exposure text | **no transition, ever** (DESIGN §2.2; `check.mjs`) |
| The flow | DESIGN §1, the only continuous motion |

No `transition: all`, only named properties, and only `transform`, `opacity` and `clip-path`. Every
animation is interruptible: a touch mid-transition lands at the final state. Numbers never count
up. Staleness never pulses.

**Reduce Motion** (`prefers-reduced-motion: reduce`, read live):
- the flow is off and the arrows are drawn instead (DESIGN §1.14);
- every transition above has zero duration;
- the selection tracer appears in place;
- About appears without sliding;
- **play still plays**, drawn as whole steps at the same 5 hours a second (one 3 h step every
  0.6 s), so each frame is a state of the forecast and never a blend of two.

**Hidden** (`visibilitychange`, `pagehide`): the loop stops and the trails clear. **About open**
holds everything: nothing is drawn under the sheet and play waits, so closing it shows the hour it
was opened on, and play goes on from there.

---

## Deliberately restrained

- One face, one file, 35 372 bytes. One large figure (the valid time, 21 px).
- No accent color. Chrome tokens stay at OKLCh chroma ≤ 0.024 (`--ink-2`'s, the highest), and every hue on the
  plate is a layer's scale.
- No shadows, blur, glass or glow anywhere: not on the keys, not on the card, not on the globe.
- One solid control (Play). Radii: 6 px (keys), 8 px (card, notices, Play), 0 on the legend bar.
  Round only for the thumb's disc and the tracer heads.
- Icons only for the map keys, the transport, ✕ and the focus marks. Everything else is a word.
- No library. The ramps are numbers from `palette.py --json`, interpolated as `rampAt` already
  does; `palette.py` is their proof.

## Never

- Never a streak that is not the field. No seeded "ambient" particles, no motion while the field
  is missing or broken, and no particles faster or slower than the rung (DESIGN §1.5).
- Never red or amber for staleness or errors: those are temperatures here.
- Never an exaggerated scale. The legend ranges are fixed and printed. There is no auto-stretch to
  the visible range, and no extra saturation for extremes.
- Never NOAA's look: no NOAA emblem, no government web face, and nothing that suggests an official
  forecast. The credit line's "sampled" stays.
- Never the stock look back: no pills, no blue accent, no system font, no glass cards with one
  shared shadow.

---

## The generated-page tell list, item by item

| Tell | What this app does instead |
| --- | --- |
| Warm cream ground, high-contrast serif display, terracotta accent | Light ground `#e8eef0` (cool, h 220, C 0.007). One low-contrast Renaissance sans, no display serif. No accent: warm hues appear only as temperature and pressure data. |
| Near-black ground with one acid-green or vermilion accent | The dark page is a slate at L 0.224, not a black stand-in. There is no accent. The one bright thing is the tracer, a near-neutral warm white (C 0.011), and it is data. |
| Broadsheet: hairlines, zero radius, dense columns | One column. Hairlines only where they separate (About's sections, the key separators). Radii are 6 and 8 px by role. |
| SaaS-card kit: identical rounded cards, one radius, one soft shadow, gradient washes | One card (the tapped readout) and one sheet (About). No shadows. The only gradients are the legend's data scale and the selection tracer, which is drawn on purpose. |
| ALL-CAPS tracked eyebrow labels | None. Sentence case everywhere, no tracking, and no label above a heading. |
| Meta strings joined with middle dots | The stamp, the lead, the readout and About use commas, sentences or one value per line. The three-credit line keeps its dots because its text is fixed by license (owner call 4). |
| "WORD — fragment" labels with a spaced em dash | None. |
| Tinted near-black (#0B0B0B, #111) standing in for black | Ink is `#0f1c23`, a stated developer-ink color (L 0.22) used for text and streaks, and the dark page is L 0.224. |
| A monospace face for small data labels | None. Ysabeau's tabular figures do the aligning. |
| "→" appended to links and buttons | None. There are no links, and button words say what they do. |
| One word accented in a headline | None. The only emphasis is the stale sentence in the stamp, which is a status: its words, not its color, say "ran out". |
| Unnecessary labels above content | The legend's title is the quantity the bar measures, from the snapshot (`Wind, 10 m above ground`). Nothing else is labeled from above. |
| Numbered markers (01 / 02 / 03) | None on screen. |
| Big number, small label, gradient accent | The one large figure is the valid time, the plate's real subject, with no gradient. |
| Scattered fade-and-slide entrances, hover on every card | No entrances at all. The one continuous motion is the field, and the small transitions answer a touch. |

**The interface guidelines** this build is held to, where the house writes its own rule:
- **Buttons in Title Case**: the house writes sentence case (`Hide the controls`). The visible
  labels are single words anyway.
- **Dates through `Intl`**: not used. The dates are built by hand from the phone's clock with fixed
  words (above), so every locale prints the same thing, as the `ask` rows do.
- **Critical fonts preloaded with `font-display: swap`**: the font is local, so `block` costs
  nothing and keeps canvas text out of a fallback face.
- **`translate="no"`** on place names, `GFS`, `NOAA` and the unit keys.
- **The rest applies as written**: `aria-live="polite"` for the focus sentences and the Reduce
  Motion note, `<button>` for every action, `env(safe-area-inset-*)` on the header and the player,
  and `…` not `...`.

---

## Global Wind, by copy

The same file set, copied by hand (a mini-app is one folder). It differs only in these ways:
- **No layer row.** Row 3 holds `Map` and `Globe`, and at its right a word toggle **`Speed
  colors`** (`aria-pressed`, named `Speed colors`, with `Color the map by wind speed` as its description), which replaces the
  `btn-heat` icon key. Its stored key stays `gw.heat`. Every string is in US spelling.
- **An Arrows key** joins Flow and Night in the column (DESIGN owner call 10), so the pair has the
  same four states. Stored `gw.arrows`.
- **The wind ramp only**, the same stops. The legend title comes from its snapshot's layer.
- **Fonts**: `fonts/ysabeau-office-gw.woff2` and `fonts/OFL.txt`, byte-identical copies (`cmp`).
  `font_subset.py` is not duplicated. Global Wind's `NOTES.md` names Global Weather's
  `tools/art/` as the source.
- `tools/art/palette.py` is copied too, so Global Wind's `check.mjs` can compare its own `LOOKS`
  with it.
- Budgets: the ZIP ≤ 1 600 000 B, and the same code and font caps.

---

## Where the record is

The after-review summary that closed this file moved to `tools/DECISIONS.md` on 2026-10-02, word
for word, beside the review record it pointed at: this file ships inside the ZIP, and the house rule
(`Template/HOUSE.md`, "What ships and what does not") keeps build history out of a shipped file.
