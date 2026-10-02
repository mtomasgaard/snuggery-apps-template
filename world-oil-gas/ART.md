# World Oil & Gas: art direction

`NOTES.md` says what the app shows and where every number comes from; `shelf-atlas/RESEARCH.md`,
`shelf-atlas/HANDOFF.md` and `scripts/shelf_atlas/SCHEMA.md` say how the data is built. This file
says how the app looks, moves and speaks under the template's house system (`Template/HOUSE.md`, the
brief this pass follows; Global Weather is the reference, and Milky Way, Besseggen, Norne Reservoir,
Anatomy and Shelf Atlas are the passes before this one). Every figure names the command that printed
it. The scripts are in `tools/`, which the ZIP leaves out. The pass's record (the change list with
the bugs B1 to B18, the owner calls, the as-built departures, the phone checks) is in
`tools/DECISIONS.md`, because this file ships.

Commands run from `Template/world-oil-gas/` unless they say `Template/`. Load and frame times are
headless Chromium on the build Mac: a trend, never phone evidence. The throwaway scripts named below
live in `tools/.work/`, which git ignores (`.gitignore`, written by this pass).

---

## The look: the house, with one bold thing of its own

World Oil & Gas is HOUSE 4.0's *map with time*, the sibling of Shelf Atlas: the same pipeline, the
same kind of plate, a century where Shelf Atlas has 55 years and a world where it has one basin. It
takes the house chrome whole: one face, gray chrome, the row of words, the key column, the caption
band, the player and the app's own track, the readout card, About, focus mode, SI and the no-tells
rules. What is its own is the plate, printed twice, and one signature.

**What a stranger saw before the pass** (`PLAYWRIGHT_MODULE=… node tools/.work/look.mjs`, light and
dark, 390 x 844, DPR 2, touch; pictures and `look.log` in `tools/.work/look/`): a dashboard, not a
plate. A blue accent on the Play key, the slider and every switch; glass panels with shadows over the
map; 19 and 17 px bold system type; pill switches; a violet choropleth running to near-black under
three saturated fuel hues, 6 047 field dots drawn in 2024, with the country names drawn *under* the
dots (`Eg t`, `Lib a`, `Pa kistan`); a credit line cut to `… Natural Earth · G…` at every phone width;
a legend whose expanded ticks collide (`10k30k`); 13 controls under 44 x 44; the stamp in red when
stale. And three things that were not true: the Play key never turns into a pause mark, Cumulative
blanks every country whose series stopped in 2016, and four sentences promise hatching that the map
never draws (B1 to B5 in `tools/DECISIONS.md`; the pass fixed all eighteen).

- **The plate is printed twice.** The light theme is the negative (pale sea, plain land, a big
  producer a mid violet), the dark theme the print (dark sea, a big producer a bright lavender). In
  both, more stands further from the land.
- **One bold thing: the Ledger** (section 1), a strip of ink under the plate. Everything else is quiet.
- **Honesty is already the app's habit.** The stock app separates "no data" from zero, says the
  field sizes are an estimate and how it is made, names the former states, the source holes and the
  outlines without a series. The pass keeps every word of that, corrects the words that promise what
  is not drawn, and fixes the places where the screen says less than the data.

**How it differs from the apps before it** (it copies none of them):

| | Its signature | Where | What it encodes | Shape |
| --- | --- | --- | --- | --- |
| Global Weather, Global Wind | the streak field | the plate | the wind's path at a printed exposure | streaks |
| Earth's History | the time control as a stratigraphic column | the track | period colors | a banded bar along time |
| US Quakes | the record strip | the reading | magnitude by stem height | stems |
| Warming World | the stripes as an instrument | the scrubber | anomaly by color | stripes along time |
| Milky Way | the Reach | a ruler in the header | presence along a log distance | a bar with gaps |
| Besseggen | the Burn | the track | one day's sun at one point | an arch with bites |
| Norne Reservoir | the Cut | the track | one field's liquid, oil and water | a two-tone skyline |
| Anatomy | the Levels | the plate's edge | the spine's levels at their height | a column of blocks |
| Shelf Atlas | the Peaks | the plate, around every field | each field's best month so far | one ink ring per field |
| **World Oil & Gas** | **the Ledger** | **the caption band, under the plate** | **each producer's share of the world's output in the year shown** | **one strip of ink blocks, widest first, a hatched end** |

Earth's History and Warming World also draw a banded bar, but theirs runs along time and is read by
color; the Ledger runs along the world's output for one year, is read by width, and has no color at
all. Anatomy's Levels are blocks at a body's own heights; the Ledger's blocks are shares. No other app
in the template has a series per country or a world total: Shelf Atlas has four countries' fields,
Warming World a grid of anomalies.

---

## 1. The signature: the Ledger

**What it is, in one paragraph a stranger would get.** Under the map runs one strip of ink, the
width of the screen: the world's oil and gas for the year on the player, laid out as a row of blocks,
one block per producing country, widest first, each as wide as that country's share. Everything under
1 % each is the hatched end. Play the century and the strip tells it without a word: in 1900 two
blocks are nine-tenths of it (the United States and the lands that became the USSR, 94.8 %); in 1920
the United States alone is 68.7 %; in 1950 still 61.4 %; by 1973 it is 26.3 %, with the USSR, Saudi
Arabia and Iran beside it; in 2024 the first block is the United States again at 21.6 %, followed by
twenty more and a hatched end of 13.4 %. The map shows who produces at all, on a log scale that
flattens the giants; the Ledger shows who dominates, on a linear one. Nothing about it is invented:
every width is a country's figure over the world's, as the source publishes them.

**What a stranger remembers is the first block.** Measured from `data/snapshot.json` with its own
decode (`python3 tools/.work/ledger.py`, output in `tools/.work/ledger.out`), oil and gas together,
annual:

- **The first block** belongs to the United States from 1900 to 1979, the USSR 1980 to 1984, Russia
  1985 to 1993 (from 1985 the successor states' own figures replace the USSR's: below), the United
  States 1994 to 2000, Russia 2001 to 2013, the United States from 2014. In oil alone the first block
  changes hands nine times (USSR, United States, USSR, Russia, Saudi Arabia, Russia, Saudi Arabia,
  Russia, Saudi Arabia, United States); in gas the United States holds it alone from 1900 to 1982.
- **The number of blocks** grows from 4 (1900) and 5 (1920) to 9 (1950), 15 (1973) and 21 (2024);
  the hatched end from 2.7 % to 13.4 %.
- **Cumulative** turns it into the ledger of everything produced so far: by 2024 the United States
  holds 21.6 % of all the oil and gas ever produced (17.2 % of the oil, 29.5 % of the gas), Russia
  11.1 %, Saudi Arabia 8.0 %, the USSR 4.9 %.

**How it was found** (HOUSE 5.1):

1. *What does a specialist call the picture of this data?* The Energy Institute's Statistical Review,
   the source under these figures, prints every country with a *share of total* column. The Ledger is
   that column drawn: the share of total as a ruled line of blocks, the way an annual report shows
   who holds what.
2. *What does a person do most here?* Play the century and scrub it. The Ledger needs no tap and no
   chart: it makes the year on the player legible as a balance of producers, which is what the scrub
   is for, and it reorders as the leader changes.
3. *What does this data have that no other app has?* A century of every country's production and the
   world's total beside it. Moved to Shelf Atlas the Ledger would be four countries' blocks; moved to
   any other app it would have nothing to draw. Candidates tried and set aside, each measured:
   - *The world's production curve on the track*: a skyline on the track is Norne's Cut, and the lead
     already prints the world total in figures.
   - *Fields discovered per year as stems on the track*: US Quakes' record strip in another unit; and
     1 748 of the 7 055 units have no discovery or start year (`python3 tools/.work/facts.py`, output
     in `tools/.work/facts.out`), so the stems would show the tracker's gaps as history.
   - *The fields in ink, as a petroleum map's well symbols*: the field circles' size through time is
     the app's own estimate, not a measurement (HOUSE 5.2 test 2 fails), and 6 047 ink marks in 2024
     would be a froth over the Gulf.
   - *Each country's best year so far, a mark per country*: Shelf Atlas's Peaks, the pass before this one.
4. *Can it be drawn with the house's means?* One ink at the far end of the tonal budget, on `--page`,
   the house face for its labels, the house tracer for the chosen country, no motion of its own.

**The test** (HOUSE 5.2), each answered yes:

1. *Delete the data and it disappears.* A block is a country's figure over the world's for the year
   shown, nothing else. With no snapshot there is no strip; a year with no world figure draws none
   and the caption says so.
2. *Every property that varies is measured.* A block's width is its share, linear (no projection
   distorts it); the order is by share; the 1 % floor and the hatched end are constants printed in
   the caption. Height (10 px), gap (1 px) and color are constants.
3. *It is captioned.* The caption line says how to read it, with its number, in every year: `Bar:
   shares of the world's oil and gas in 2024; hatched, all under 1 %.`, then what plain land means.
   In the 93 years a former state holds a figure its members' outlines lack (1900 to 1992), a note
   says so first and the number follows it: `The USSR's lands are plain: its figure is in the bar.
   Bar: shares of the world's oil and gas in 1950; hatched, all under 1 %. Field sizes are
   estimates.` at 390 px, `… Bar: hatched, all under 1 %. …` where that is too long (section 3).
4. *It reads.* The ink is `#1b150e` on the light page and `#f4f0e7` on the dark: 15.44:1 and
   15.04:1 on `--page`, and 0.298 and 0.236 of OKLab lightness beyond the nearest data color on the
   plate (`python3 world-oil-gas/tools/art/palette.py` from `Template/`, ended `ALL CHECKS PASS`;
   the run is kept in `tools/.work/palette.out`). It is never drawn over the data, so its worst case
   is the page itself; `shoot.mjs` samples its drawn pixels against the page in both themes.
5. *It survives Reduce Motion.* It has no motion of its own; it changes only with the year.
6. *About says what it shows and what it does not* (section 3, About): a share of the file's world
   series, energy-equivalent; the former states (below); that after 2016 the source lists fewer
   countries, so the hatched end also holds the ones it stopped listing (the listed countries add up
   to 98.1 % to 98.8 % of the world from 2017, against 100 % before); that the strip is scaled to the
   larger of the world's figure and the countries' sum (they differ by at most 0.64 %, gas in 1970);
   that it says nothing about reserves, consumption or who owns the fields.
7. *It is the only bold element.* The rest passes section 7. The map's darkest fill is held at L 0.50
   (light) and its brightest at L 0.72 (dark), so a 10 px strip of ink at L 0.20 or 0.955 is the
   strongest mark on screen in both themes.

**Drawn exactly so** (in `app.js`; the arithmetic in `js/data.js`):

- **The world.** The snapshot's `world` series (OWID_WRL) for the shown mode (oil, gas, or oil and
  gas), annual, or summed from 1900 in Cumulative. Units do not apply: shares have none.
- **Who counts, once (rule B).** A former state (USSR, Czechoslovakia, Yugoslavia: `FORMER_STATE` in
  `app.js`) is replaced by its members in any year its largest member (Russia, Czechia, Serbia) has a
  figure, so no barrel is counted twice: the USSR's series runs to 1991 and its successors' from
  1985, and the world series counts the successors in 1985 to 1991 (gas in 1989: all listed less the
  USSR is 100.3 % of the world, all listed less the members 106.1 %; `tools/.work/ledger.py`). In
  Cumulative each block is the sum of its country's counted years, so Russia's block is Russia's own
  total since 1985, the figure its card prints, and the USSR's block is the USSR's to 1984, labeled so.
- **The blocks.** Every producer at 1 % of the world or more, widest first, from the strip's left
  end; each `share x width - 1` px wide (at least 1 px of ink), 10 px tall, square ends, in `--ledger`
  at alpha 1, a 1 px gap of `--page` after it. 1 to 26 blocks across the three modes, annual and
  cumulative (4 to 21 in oil and gas, annual); the smallest 3.8 px at 390 px (2024).
- **The hatched end.** The rest of the strip: 1 px lines of `--ledger` at 45 degrees, 3 px apart,
  clipped to the end, no frame. Its width is `1 - Σ blocks` of the larger of the world's figure and
  the sum of all listed countries, never negative.
- **The labels.** 10.5 px `--ink-2` on `--page`, one line, 6 px under the strip (below the tracer),
  every label 10 px clear of every other and inside the strip. The chosen country's label comes
  first (below). **The three widest blocks are named wherever a label can start well inside the
  block**: each at the first free x in its own block that leaves at least 10 px of the block after
  the label's start (half the block, where it is narrower than 20 px), so no label starts in a
  block's last pixels; in the fullest forms that fit together, tried in order, earlier blocks first:
  name and share (`United States 21.6 %`, through `units.js`), the name alone (`Russia`), the share
  alone (`12.4 %`); the combination naming the most wins. Every other block keeps the first rule:
  its name and share at its left edge where that fits. Measured over every year at 390 px, in both
  modes, with no country chosen and with the United States or Norway chosen alike
  (`tools/.work/followup/after.log`): the second block named in 125 of 125 years, the third in 121,
  2.97 of the first five on average; at 320 px the third in 114 (annual) and 110 (cumulative). In
  2024 `United States 21.6 % | Russia | Saudi Arabia 7.6 % | Iraq 2.8 %`, in 1973 `United States
  26.3 % | USSR 16.1 % | Saudi Arabia 10.0 % | Nigeria 2.6 %`, in 1950 `United States 61.4 % |
  11.2 % | USSR 6.1 %` (the USSR's label at its block's edge, Venezuela's share alone). The years a
  third block goes unnamed at 390 px (1900 to 1902 and 1927 annual, 1900 to 1903 cumulative) are the
  ones where it is 5 to 16 px wide next to a label or the strip's end; it is still spoken and still
  opens on a tap. Names are the data's (`countries[].name`; a former state's `historical` label
  without its parenthesis, `USSR`, and `USSR to 1984` in Cumulative once its members replace it).
- **A tap on a block** opens that country's card, a former state's too (the USSR has no outline
  to tap, so the strip is its only way in besides Find), with the tracer under the block and the
  outline on the map; a tap on the hatched end opens nothing, since it is no one country. The whole
  30 px row takes the tap, by the block's own span. Find stays the keyboard's way to the same cards.
- **The chosen country.** When the card shows a country with its own block, the house tracer runs
  under that block (2 px, transparent at its left to `--ledger` at its right, a 4 px disc at the
  end, 2 px below the strip) and its label is drawn first, in `--ink` at 560, at its block's left
  edge (moved left only to stay inside the strip), displacing any label it would collide with. The
  three widest are still named around it by the rule above; the chosen label takes its name alone or
  its share alone only where that names more of them (with the United States chosen, 2024 reads
  `United States 21.6 % | Russia | Saudi Arabia 7.6 % | Iraq 2.8 %` and 2000 `United States |
  Russia | Saudi Arabia 8.5 %`). A member drawn inside its former state (Russia before 1985) puts
  the tracer under the former state's block; the card's note says why. Under 1 %, no tracer: the
  card carries the share.
- **Spoken.** The canvas is `aria-hidden`; a visually hidden sentence beside it, rewritten when the
  shown year, mode or accumulation changes (never per animation frame): `Shares of the world's oil
  and gas in 2024: United States 21.6 percent, Russia 13.2 percent, Saudi Arabia 7.6 percent, Iran 5.7
  percent, Canada 5.6 percent; 21 producers of 1 percent or more; all others 13.4 percent.` A
  snapshot with no world series says `Shares of all listed countries' oil and gas …`, as the
  caption line does, since the shares are then of the listed sum.
- **Cost.** Per mode and snapshot, one pass over 219 series x 125 years to build the counted series
  and their prefix sums; per shown year a sort of at most 120 values, cached by mode, accumulation and
  year; the strip redrawn into its own canvas only when the shown year, the mode, the accumulation,
  the width, the theme or the chosen country changes.
- **In every mode.** Focus mode keeps it (it is the reading the view needs); a phone on its side puts
  it beside the legend (section 3).

---

## 2. Palette

`tools/art/palette.py` (written in this pass; run from `Template/`, standard library only) holds
every value below and ended `ALL CHECKS PASS` with exit 0 (`python3
world-oil-gas/tools/art/palette.py`; the run is kept in `tools/.work/palette.out`). `--json` prints
what `app.js`'s `THEMES` takes per theme: the 17 evenly spaced ramp stops `buildPalette()` already
interpolates, the sea and its two depth stops, plain land, the outside and its edge, the borders, the
four fuels with their alphas, the rim, the labels and their halo, the selection, the chart pair and
the Ledger. The builder pastes the output; `tools/check.mjs` fails while `THEMES` and `--json` differ.

### The chrome tokens

The house tokens of HOUSE 3.1, copied exactly, in both themes. Measured by the same run:

| Pair (WCAG 2) | Light | Dark |
| --- | --: | --: |
| `--ink` / `--ink-2` / `--ink-3` on `--page` | 14.80 / 6.61 / 4.78 | 14.43 / 7.76 / 5.88 |
| `--ink` / `--ink-2` / `--ink-3` on `--sheet` | 16.40 / 7.32 / 5.29 | 12.87 / 6.92 / 5.25 |
| `--line-strong` on `--page` | 3.27 | 3.56 |

Highest chroma of any chrome token: 0.0239. The stock `--bg`, `--card`, `--ink-dim`, `--ink-faint`,
`--accent` (`#2f6df6` / `#5b8eff`), `--accent-ink`, `--chip`, the three `--warn-*` and three
`--note-*` tokens, `--shadow`, `--radius` (14 px on everything) and `--glass` go, with every
`box-shadow` and `backdrop-filter` (18 lines with either, `grep -c` over `style.css`),
`letter-spacing` (5 rules), `text-transform` (3) and `transition` on the switches and the legend's
chevron.

### The tonal budget

| | Light (the negative) | Dark (the print) |
| --- | --- | --- |
| Ground | the sea `#d5e2e8` (L 0.905), with depth bands on `#ccdce4` at 200 m to `#b9ccd9` at 6 000 m; plain land `#eff1ef` (L 0.956); beyond 85 degrees `#e6e9ea`, edged by a 1 px `--line` | the sea `#111b20` (L 0.215), bands `#0d181d` to `#050c12`; plain land `#23292b` (L 0.276); beyond 85 degrees `#0f1214`, edged by `--line` |
| Data band | L 0.50 to 0.96: the countries 0.501 to 0.901, the fuels 0.505 to 0.729 | L 0.15 to 0.72: the countries 0.339 to 0.720, the fuels 0.500 to 0.711 |
| Signature | `--ledger` `#1b150e`, OKLCh (0.201, 0.0164, 71), alpha 1, on `--page` | `#f4f0e7`, OKLCh (0.956, 0.0127, 87), alpha 1, on `--page` |
| Worst measured | 15.44 on `--page`; 0.298 of L beyond the darkest data color | 15.04 on `--page`; 0.236 of L beyond the brightest data color |

The Ledger is a near-neutral (chroma under the house's 0.021) with a trace of warmth at hue 71, the
brown-black of crude, as printing ink is; it is not `--ink` and not a hue of any data scale. Its
distance to the template's other signature inks (OKLab dE, the same run): light 0.037 to Global
Weather's streak, 0.020 to Norne's Cut, 0.040 to Shelf Atlas's ring; dark 0.005, 0.014 and 0.025.
Near-neutrals at the far end of a range are close in color by construction; the Ledger is a
different mark in a different place.

The depth bands are ground, not a data scale: deeper is darker in both themes, as a chart prints it,
compressed (light L 0.885 to 0.835, where the stock ran to `rgb(170,188,209)`) so the countries and
the fields stay the data.

### The plate

| Value | Light | Dark | Notes |
| --- | --- | --- | --- |
| sea | `#d5e2e8` | `#111b20` | the stock `#d6e4ef` and `#0f1a26` refit to the house's grounds |
| depth bands (off by default), 200 m to 6 000 m and deeper | `#ccdce4` to `#b9ccd9` | `#0d181d` to `#050c12` | linear in depth between, as `bathyStyle()` reads them |
| plain land (no figure, or nothing produced) | `#eff1ef` | `#23292b` | the stock light land `#f7f5f0` was cream |
| beyond 85 degrees (the whole-world view's empty bands) | `#e6e9ea` | `#0f1214` | a neutral that is neither the page, the sea nor the land, with a 1 px `--line` at the map's top and bottom edge, so the plate never melts into the chrome |
| borders, 0.6 px | `#474e52` at 0.50 (2.33 on plain land, 2.23 on the sea) | `#abb2b6` at 0.35 (2.07, 2.12) | separators, never a control's edge |
| country names | `--ink` 11.5/560 on a 3 px `--sheet` halo at 0.88 (13.85 worst) | the same (10.55) | drawn after the fields, never under them |
| the selection | `--ink`, 1.5 px over a 3.5 px `--sheet` halo at 0.90 (14.15 worst over every base) | the same (10.80) | a country's outline; a field's four 4 px registration ticks, never a circle (a ring means "found, not yet producing") |
| field rim | `--sheet` at 0.95 | `--page` at 0.90 | always drawn (owner call 6): it is what parts a gas disc from a violet country for a reader with tritan or deutan vision (section 2, the fields) |
| field outlines at high zoom | the fuel at 0.16 fill, 0.85 stroke | the fuel at 0.18, 0.85 | as the stock draws them |
| relief (off by default; the JPEG is read only once Terrain shading is on) | Natural Earth I drawn as gray shading only | the same, dimmed | its hypsometric tints are not this app's data; desaturated once into the cached sea canvas with a `saturation` composite (owner call 9) |

### The countries: production, printed twice

One hue path, violet (the stock app's choice, kept: neither the sea's blue nor a fuel's hue), from a
pale lilac at the small end to a mid violet, salience along the legend's log axis (`lutIndex()`, the
unit's `dom`, unchanged). The light theme prints salience as darkness from L 0.90 to 0.50, the dark
theme as light from L 0.34 to 0.72. Stops at s = 0, 0.25, 0.5, 0.75, 1: light `#e2d9f5` `#c3b4e8`
`#a391d9` `#8271c2` `#6454a5`; dark `#3b334a` `#564875` `#715ea2` `#8a79ca` `#a496ed`.

Checks (the same run): the ends separate by dE 0.406 (light) and 0.378 (dark) at worst of the four
visions; every eighth of the legend steps by at least 0.048 and 0.046; the small end stands 0.057 and
0.065 from plain land at worst; no sample is chroma-limited; 17 stops interpolated in sRGB as
`buildPalette()` does stay within dE 0.0043 of the OKLab path.

**What was given up, said plainly.** The stock light ramp ran to `#2b1e66` (L 0.29) and the dark one
to `#bcbcff`; the biggest producers are now a mid violet (L 0.50) in the light theme and a lavender
(L 0.72) in the dark, so that nothing on the map is as bold as the Ledger's ink and every country name
and selection keeps its contrast on its halo.

### The fields: four fuels

The stock app's logic, kept: oil warm, gas cool, oil and gas green, gas and condensate a neutral. Told
apart by lightness as well as hue, because blue and green collapse under tritan vision and orange and
green under deutan:

| Fuel | Light | Dark |
| --- | --- | --- |
| oil | `#f08944` (L 0.729) | `#e58647` (L 0.711) |
| gas | `#14a3d5` (L 0.670, hue 230) | `#259cca` (L 0.651) |
| oil and gas | `#0f7845` (L 0.505) | `#167645` (L 0.500) |
| gas and condensate (`other`) | `#7a8185` | `#787e82` |

Checks (the same run): oil, gas, and oil and gas separate pairwise by dE 0.142 (light) and 0.132
(dark) at worst (oil against oil and gas under protan); the gray stands 0.098 and 0.093 from them;
every fuel stands at least 0.128 (light) and 0.124 (dark, both gas) from every country fill under
normal vision and 0.24 from the sea and plain land. Gas sits at hue 230, 60 degrees from the
countries' violet. Under tritan or deutan vision a gas disc on a country of its own lightness is 0.008
(light) and 0.014 (dark) from it, which is why the rim is always drawn (owner call 6). The pale (no rate reported, alpha 0.45) and the ring (found, not yet producing,
1.75 px) keep the stock forms.

### The details chart

Oil and gas as two lines on `--page`, at the fuels' hues but their own lightness, so each line holds
3:1: light oil `#b2580b` (4.17), gas `#066d90` (4.98); dark `#eb9259` (7.16), `#49abd6` (6.58); apart
by dE 0.169 and 0.173 at worst. The stock chart drew its lines in the field fuels' own colors; on the
new page the light oil fuel `#f08944` would hold 2.14:1 and the stock `#eb6834` 2.73:1.

### The ghost key

HOUSE 3.1's fixed colors, over every color of this plate: the stroke holds 4.73:1 (light) and 3.73:1
(dark) against its own halo at rest.

### CSS custom properties this app adds

`--ledger` (`#1b150e` / `#f4f0e7`) for the strip, its hatch and the chosen country's tracer;
`--chart-oil` and `--chart-gas` (the chart pair above); `--sea` (`#d5e2e8` / `#111b20`) for the plate
before the first draw. Everything else on the plate is drawn from `THEMES`; the Map layers key's
samples take the fuels and the rim from it as `--s-oil`, `--s-gas`, `--s-both`, `--s-other` and
`--s-rim`, set by `buildPalette()` per theme.

---

## 3. The chrome, object by object

The frame at 390 x 844 (CSS px, safe areas outside):

```
+------------------------------------------+
| World Oil & Gas            [Find] [TWh/yr]| 22  name 15/650; two word keys
| Updated 27 Sep, 08:18, figures to 2024    | 16  the stamp, 11.5 --ink-2, opens About
| Oil  Gas  Oil and gas | Annual  Cumulative| 44  mode words | accumulation words, tracer under each
+------------------------------------------+
| [card]                              [+]  |
|                                     [-]  |     the plate: sea, countries by production,
|                                     [#]  |     borders, the fields, names on halos;
|                                     ---  |     keys: Zoom in, Zoom out, Whole world /
|                                     [=]  |     Map layers / Hide the controls
|                                     ---  |
|                                     [H]  |
+------------------------------------------+
| ##########|#####|###|##|#|#|…|/////////  | 30  the Ledger: blocks, the hatched end,
| United States 21.6 %  Russia  Saudi Arabia 7.6 %  …|     the labels (section 1)
| Oil and gas a year                        | 39  the legend: title on its own line
| |========================================|      below 640 px, the log bar the full
| <= 2   10    100    1 000  >= 20 000 TWh/yr|     width, open ends
| Bar: shares of the world's oil and gas in | 30  the caption line, two lines, fixed
| 2024; hatched, all under 1 %. Plain: no   |
| figure, or none. Field sizes are estimates.|
| Sources: Energy Institute via Our World in| 30  the credit line, whole, wrapping
| Data · Natural Earth · Global Energy Monitor|     to two lines, never cut
+------------------------------------------+
| 2024  World 94 100 TWh/yr, 6 015 fields producing | 28  the time row
|  <  [>]  >   --'----'----'----'----*     | 58  the transport; the track
|              1900 1925 1950 1975 2000    |
+------------------------------------------+
```

The page is a one-column grid: header, plate, caption band, the sheet (closed by default), player;
`100dvh`, `overscroll-behavior: none`; the plate's row `minmax(220px, 1fr)`, and `minmax(150px, 1fr)` upright on a screen at most 760 px tall while a sheet is open (below). The stock plate was
627 px tall at 390 x 844 with the legend and credits laid over its foot (`look.log`); the house plate
is 517 px (`shoot.mjs`; 616 in focus mode, 234 on its side) with nothing over it but the keys, the card, a notice and the ghost key. `shoot.mjs`
holds it at 480 px or more, at 600 or more in focus mode, and at 220 or more at 844 x 390 (the stock
167).

| Object | Here | Notes |
| --- | --- | --- |
| **Header: name** | `h1` `World Oil & Gas`, 15/650, line 22 px, `translate="no"` | `miniapp.json`'s name, the Library row the camera opens. The stock 19/700 title with negative tracking goes. |
| **Header: stamp** | a `<button>` opening About, `aria-haspopup="dialog"`, described *Opens About this data.* (`aria-describedby`), 11.5 px `--ink-2`, a 44 px hit: `Updated 27 Sep, 08:18, figures to 2024`; `Updated 08:18, …` when today | Built by hand in `js/units.js` from the snapshot's `generatedAt` in local time, the figures' last year from `years[1]`. The stock `Data Sep 26, 2026 · 1900–2024` (the phone's locale, a middle dot) and its `aria-label="About this data"` (which hid the date from VoiceOver) go. Stale after 400 days (`STALE_DAYS`, the yearly build; stated in `NOTES.md`): `Stale. Updated 27 Sep 2025, …`, the first sentence in `--ink`, never the stock red. Loading: `Reading the data… 2 of 3`, a real ellipsis. No snapshot: `Map only. Outlines from data/world.json.` |
| **Header: Find** | a word key, `Find`, named `Find a field, company, basin or country` (the visible word first, WCAG 2.5.3), `aria-haspopup="dialog"` | Anatomy's and Shelf Atlas's word key: 600 at 12.5 px in a 1 px `--line-strong` frame, 28 px tall, 6 px radius, a 44 x 44 hit. It replaces the stock magnifier, since icons live only in the key column and the transport. |
| **Header: units key** | at the right: `TWh/yr`; one press `kboe/d`; in Cumulative `PWh` and `Gboe` | The house key (HOUSE 4.2): 600 at 12.5 px, `--line-strong` frame, 28 px, 6 px radius, 44 x 44, `translate="no"`, named `Change units, now TWh/yr`. **SI first** (owner call 3): TWh, the source's own unit, is SI's watt-hour; kboe/d, the industry's energy-equivalent barrel, is one tap away. The key switches the fields with it: SI shows a field in `Sm³/d` of oil or gas and `Sm³ o.e./d` together (1 Sm³ = 6.2898 bbl; gas at the file's 159 Sm³ per boe), reserves in million Sm³ and billion Sm³; the other system the file's own `bbl/d` and `boe/d`. Stored in `wog.units` as today (`twh`, `kboe`); a library with `kboe` stored keeps it; a new one starts on `twh`. |
| **Row of words** | `Oil`, `Gas`, `Oil and gas` (`role="radio"` in a `role="radiogroup"` named `Countries show`), a 1 px `--line` divider 14 px tall, then `Annual`, `Cumulative` (`role="radio"` in a group named `Each year or to date`) | Words in full: the stock `Oil + Gas` is written `Oil and gas` (the stored `total` unchanged). The tracer under the chosen word of each group (HOUSE 4.3); unchosen words 400 `--ink-2`. 44 px hits, 16 px apart; the row scrolls inside itself at 320 px. One tab stop per group; arrow keys move the choice. The stock segmented pills, their shadow and the second header row go. |
| **Key column** | `--sheet` plates on the plate's right edge, inset 8 px: `Zoom in`, `Zoom out`, `Whole world` / `Map layers` / `Hide the controls` | 44 x 44 hits drawn 36 x 44; 16 px marks, 1.5 px strokes, `--ink-2` at rest, `--ink` with the 28 x 28 on-plate when on (HOUSE 4.4). Marks: Zoom in and out, the house's drawn plus and minus (the stock `+` and `&minus;` text go); `Whole world`, the house's four corner brackets around a small circle (the stock globe goes); `Map layers` (`aria-expanded`, `aria-controls` the sheet), the plate's own marks stacked: a 4 px disc, a 4 px ring and a 9 px line, not the stock two-rhombus layers glyph. Where five keys do not fit (on its side, a sheet open), a row along the plate's top. |
| **Caption band: the Ledger** | 30 px and a 4 px gap: the strip, the tracer and the labels (section 1) | On `--page`, the house's 16 px gutters. Its row keeps its height when there is nothing to draw, so the plate never resizes with the data. |
| **Caption band: legend** | the title `Oil and gas a year`, `Oil a year`, `Gas a year` (Annual) or `Oil and gas to date`, … (Cumulative), 600 at 11.5 px `--ink`; below 640 px on its own line over the 6 px bar at the full width (39 px in all), from 640 px beside it (30 px); ticks at decades | Painted from the same 17 stops, opaque, as the map fills; a 1 px `--line-strong` frame at 60 %, square ends. Ticks 1 x 3 px at their true log positions, labels 10.5 px through `units.js`, measured apart and 8 px clear of the open ends (the stock `10k30k` collided); the ends printed open where the data goes past them. Drawn at 390 px: `≤ 2`, `10`, `100`, `1 000`, `≥ 20 000 TWh/yr` (the United States reached 20 300 TWh/yr in 2024; `10 000` would touch the open end and is left out), so every producer the Ledger names, above 940 TWh/yr, reads against the `1 000` tick; `≤ 0.05`, `1`, `10`, `≥ 500 PWh` to date. The stock glass button, its fold, its `▸` (a character the face does not draw), its `None` and hatched `No data (plain)` swatches and its field key go; the field key moves to the Map layers sheet (owner call 8). |
| **Caption band: caption line** | 11 px `--ink-2`, a fixed two lines below 640 px and one from 640 px | The longest of these forms that fits: `Bar: shares of the world's oil and gas in 2024; hatched, all under 1 %. Plain: no figure, or none.`, then, while the fields follow the year, ` Field sizes are estimates.`; failing that the bar and plain land alone; then the bar with `, largest first` and the estimate; then the bar alone. Plain land's meaning comes before `largest first`, which the strip shows by itself. Cumulative: `Bar: shares of all the oil and gas produced to 2024; hatched, all under 1 %.` and the same. With no world series in the snapshot, `Bar: shares of all listed countries' oil and gas in 2024; …`. A note leads when it applies, and the bar's number follows it: the note, the bar's whole sentence and the estimate; failing that the note, `Bar: hatched, all under 1 %.` and the estimate; then the same without the estimate; last, the note with `Bar: shares of the world's output, largest first.` (`Bar: shares of everything produced to date, largest first.` in Cumulative), or the note alone. The notes: `No field points: data/fields.json says they are not available.`; while the fields are drawn, `Highlighted: TotalEnergies SE, 189 fields.` (the company or basin chosen in Find, owner call 10) or `Fields: offshore, unconventional only.` (the stock legend's filter note); and, in any year a former state holds the figure while its lead member has none, `The USSR's lands are plain: its figure is in the bar.` (1900 to 1984; then `Czechoslovakia's lands …` in 1985 to 1992, once the USSR's members have their own; the same years in Annual and Cumulative), because the former state has no outline and its members' do. In 1950 the line reads `The USSR's lands are plain: its figure is in the bar. Bar: shares of the world's oil and gas in 1950; hatched, all under 1 %. Field sizes are estimates.` at 390 px, `The USSR's lands are plain: its figure is in the bar. Bar: hatched, all under 1 %. Field sizes are estimates.` at 320 px, and the same without the estimate on its side, where the line is one line. A year with no world figure draws no strip, and the line says only `No world figure for 1900.` `shoot.mjs` reads the line in all 125 years, both modes, at 390 and 320 px and on its side: `under 1 %` in every one, the estimate in every upright one, never past its fixed height. At 312 px (125 % zoom) Cumulative from 1993 keeps plain land and leaves out the estimate (`tools/.work/followup/after.log`). |
| **Caption band: credits** | the credit line as the stock builds it from the sources (`Sources: ${[...new Set(full.map(shortSource))].join(' · ')}`), 10.5 px `--ink-2`, **whole**, wrapping to two lines | Today `Sources: Energy Institute via Our World in Data · Natural Earth · Global Energy Monitor`. Its words and its middle dots stay (the house's credit-line exception, owner call 11). The stock button that cut it to `… Natural Earth · G…` at every phone width (B7) and its `ⓘ` go: it is a `<p>`, on screen in every mode. The full statements stay in About. |
| **Player: time row** | the one large figure `2024` (600 at 21 px); the lead at the right, 12.5 px `--ink-2`: `World 94 100 TWh/yr, 6 015 fields producing`; Cumulative `World 4 060 PWh to date, 6 015 fields producing` (the count is every unit drawn filled in the year shown, the undated ones included from their data year, B5) | Years plain, never grouped (HOUSE 4.6). The world figure from the `world` series through `units.js` (three significant figures, U+202F groups); the fields' part only while the fields are drawn, dropped when the lead would not fit (measured; at 320 px), and spoken in full. Figures: 94 076 TWh/yr in 2024, 4 059 PWh to date (`tools/.work/facts.out`). The stock second lead line goes. Never transitions. |
| **Player: transport** | `Previous year`, `Play` / `Pause`, `Next year`, 44 x 44 | The camera's `Play` and `Pause` kept exactly (section 5); the year keys keep their stock names. The house's chevrons, 1.5 px strokes 10 px tall, `--ink-2`; they say the new year in the live region. Play is the one solid control: a 32 x 32 `--ink` square, 8 px radius, a `--page` triangle; while playing two 2.5 px bars, **toggled by attribute on the SVGs' wrapper** so the mark matches its name (B2; HOUSE 4.6). The stock blue disc goes. With no snapshot the three keys are `aria-disabled`, drawn at 40 %, and do nothing. |
| **Player: the track** | `js/track.js` on Global Weather's pattern: `id="slider"`, `role="slider"`, named `Year`, 125 steps (1900 to 2024), `aria-valuetext` `1987` (`2024, the newest year` at the end) | Baseline, the exposure so far in 2 px `--ink`, the tracer-head thumb at the shown year, never gliding. No per-step ticks (125 steps at about 1.7 px); a 3 px `--ink-3` tick at 50 % every 5 years, a 7 px `--ink-2` tick at each decade, a 10.5 px label every 25 years (`1900` to `2000`, never grouped; `2024` at the end only where it clears `2000`, measured), labels that collide skipped. No `now` notch: the data ends in 2024, before today, and the stamp says so. ← → one year, Page Up and Page Down ten (a decade; a stated departure from the house's eight), Home and End. **The scrub rule holds**: input records `wanted`; the frame takes the newest wanted year, sets `shown`, draws; the map, the Ledger, the time row, the lead, the caption, the card, the chart's cursor and `aria-valuenow` read `shown`. A year change is lookups in cached arrays (the country colors per year, the Ledger per year), so no preview is needed. The stock `<input type="range">` goes. |
| **Play** | 8 years a second on the clock (the stock rate, `YEARS_PER_SEC`), from the shown year to 2024, where it stops; Play at 2024 starts from 1900 | Every frame is one whole year (it already is). A touch on the track stops it on the year under the finger; About holds it (B3); hidden stops it and a return never jumps (the stock tick added the whole hidden interval and landed on 2024, B3). The expensive work (the country fills, the field pass, the labels, the Ledger) runs only when the year, the view, the mode, the accumulation, the units, the filters or the theme changed since the last draw; a counter in the test hook proves it across a second of play (HOUSE 4.6). |
| **Readout card** | the tapped country or field: `--sheet`, 1 px `--line-strong` edge, 8 px radius, top-left of the plate inset 8 px, at most 280 px wide; bottom-left when it would cover the tapped point | **What a tap opens**: a drawn country name, its country; a field, inside its disc and 2 px round it, and within 14 px of it only where no country with a series is under the finger or once zoomed in to the outlines (16 px a degree); otherwise the country under the finger. At the opening view a tap opens a producing country on most of its own area (Iran 53 %, Saudi Arabia 70 %, Russia 69 %, `shoot.mjs`); the Gulf states, mostly under their own fields' discs at that zoom, open from their names, from the Ledger and from Find. **A country**: the place line `Norway` (12.5 px `--ink-2`) with ✕ (an SVG, a 44 px hit, `Close`); the figure, the shown mode in the shown year (`2 130` at 21/600, `TWh/yr` at 13.5 after U+202F), or `No figure`; a line under it, `Oil and gas in 2024, 2.3 % of the world, 11th of 60.` (`to 2024` in Cumulative); rows (`dl`, 12.5 px, labels `--ink-2`, values 560 `--ink`): `Oil` `999 TWh/yr, 1.9 %`, `Gas` `1 130 TWh/yr, 2.7 %`, `Series` `1900 to 2024` (or `1900 to 2016; later years are not in it`) (Norway in 2024, from `tools/.work/facts.out`); the partial and former-state notes as sentences; a text key `Details`. **A field**: its name at 13.5/650 (the tracker's long names wrap, at most three lines), the place line `Norway, offshore`; the figure is what its circle shows: the estimate for the shown year with the line `Estimated for 1998 from the 2024 report.`, the report itself with `Reported for 2024.`, or with the reserves sizing the reserves; rows `Fuel`, `Status`, `Discovered`, `First production`, `Operator`; `Details`. Values update in place per year, never rebuilt (HOUSE 4.7). In: 120 ms fade and a 4 px rise; out at once. A tap says it once in the live region: `Norway. Oil and gas in 2024: 2130 terawatt-hours a year, 2.3 percent of the world.` While a sheet is open the card stands down, since the sheet shows the same thing. |
| **Details sheet** | in the sheet's slot between the caption band and the player, on `--page` with a 1 px `--line` rule on top; the subject's name at 13.5/650 and `Close` at the top; scrolls inside itself; the plate keeps 220 px, or 150 px upright on a screen at most 760 px tall, where the legend's bar and ticks also leave while a sheet is open (its title stays), so the sheet's body has room (at 375 x 667 the body shows 168 of 542 px; at 390 x 719, a 390 x 844 iPhone under Snuggery's navigation bar, 220; at 375 x 603, 104; `tools/.work/followup/verify.log`) | A country: the chart (below), `In the tracker` (the five units with the highest reported rate as 44 px rows, name and rate; the stock's summed comparison, its words kept, its figures through `units.js`; the stock tracked capitals go), the notes as 12.5 px `--ink-2` sentences. A field: the stock field sheet's rows, every value through `units.js` in the chosen system with the other in brackets (`9 070 Sm³/d (57 000 bbl/d)`), the estimate's sentence word for word, the volumes note, the tracker's page as `gem.wiki/Troll_Oil_and_Gas_Field_(Norway)` without its scheme (B10). No grip, no drag, one sheet open at a time (Details, or Map layers). On a wide screen (at least 820 x 480) a 380 px column at the right; on its side at most 340 px. The stock 60 % sheet over the map goes (B16). |
| **The chart** | in a country's details, 104 px, on a canvas: oil and gas in the unit on screen, `--chart-oil` and `--chart-gas` 1.5 px; two 1 px `--line` gridlines; the scale's top at the top left in 10.5 px `--ink-3` (Norway: `1 890 TWh/yr`); `1900` and `2024` at 10.5 px `--ink-2`; the cursor a 1 px `--ink` line at the shown year with its two dots | A picture, not a control: an upright swipe on it scrolls the sheet (`touch-action` left at its default); the track sets the year. The stock SVG goes, and with it the `http://www.w3.org/2000/svg` namespace, the one scheme address a canvas needs no replacement for (B10). |
| **Map layers sheet** | the sheet's slot; `Map layers` at 13.5/650 and `Close` at the top; 44 px rows | `Oil and gas fields` and `Fields follow the year` (each a `<button aria-pressed>` with Anatomy's drawn 16 x 16 box), then four word groups with the tracer: `Show` (`Operating`, `All`), `Setting` (`All`, `Onshore`, `Offshore`), `Type` (`All`, `Conventional`, `Unconventional`), `Size fields by` (`Production`, `Reserves`); then `Terrain shading`, `Depth bands`, `Country names`. The stored keys unchanged. **The field key**, drawn as the plate draws it: the four fuel discs with `oil`, `gas`, `oil and gas`, `gas and condensate`; a ring, `found, not yet producing`; a pale disc, `no rate reported`; three size samples at the current zoom (`1 000`, `10 000`, `100 000 Sm³ o.e./d`, or `10 000`, `100 000`, `1 000 000 boe/d`); the stock note's sentence on what the size is, word for word. The counts sentence (`6 047 fields on the map by 2024, 1 628 of them without dates (shown from their data year); 6 015 producing; 6 055 of 7 055 pass the filters.`; the pipeline leaves out the 618 units without coordinates, which `NOTES.md` says), commas for the stock middle dots. `Clear the highlight` while a company or basin is lit. The stock switch toggles in accent blue and `Circle edges` go (owner call 6). |
| **Find** | a full-height `--sheet` panel: `role="dialog"`, `aria-modal`, slides up 220 ms on `--sheet-in`, closes at once, `Close` at the top right, Escape, focus held and returned; the page behind it `inert` | Anatomy's form: the field 44 px tall, 1 px `--line-strong` frame, 6 px radius, placeholder `Field, company, basin or country` in `--ink-3`, its text at 16 px (iOS zooms into any field set smaller; a stated departure from the scale). The browser's clear button switched off (`::-webkit-search-cancel-button { appearance: none; -webkit-appearance: none }`, HOUSE 4.8) and replaced, while the field holds text, by `Clear the search`, a 12 px ✕ in a 44 x 44 hit. Groups headed `Fields`, `Companies`, `Basins`, `Countries` at 13.5/650 (the stock tracked capitals go); rows 44 px, the name 13.5 px `--ink`, the line under it 12.5 px `--ink-2` with commas (`Saudi Arabia, 7 080 Sm³ o.e./d reported`; `189 fields, light them up on the map`). Once typing settles (700 ms) the live region says the count. `runSearch()` and the picks are kept. |
| **About** | a full-height `--sheet` panel from the stamp: `role="dialog"`, `aria-modal`, slides up 220 ms on `--sheet-in`, closes at once, `Close` at the top right and at the foot, Escape, focus held and returned, the page behind `inert`; it holds play still | **1. What the picture is**: the countries (production in the chosen year, unit and mode on a continuous log scale between the printed ends; plain means no figure for that country and year, or nothing produced, and the card says which; the map hatches nothing); **the Ledger** (section 1, test 6, every caveat there); the fields (one reported rate per unit; the estimate, its words kept; a ring from discovery, filled from first production; units without dates, owner call 4; the rim; outlines at high zoom); Cumulative (each year from the first with data added up; a year with no data adds nothing, and a series that has ended keeps its total, B1); play runs 8 years a second. **2. This data**: `label: value` lines, one per line: updated, by hand with its zone (`Sun 27 Sep 2026, 08:18 (UTC+2)`, not the stock `Intl`), years, series (219, in GWh a year), the world total (the `World` series, OWID_WRL), the fields (7 055 units; 6 055 operating), the conversions (`kboe/d = GWh ÷ 1 000 x 588 441 boe per TWh ÷ 365 ÷ 1 000`; the units note, verbatim), the corrections, the matching of series to outlines, *Worth knowing* (`dataNotes()`, its words corrected: B4). **3. Sources and credits**: each source's name as the data writes it, `License:` (the label in US spelling; the value verbatim from the data), its attribution verbatim, its detail verbatim but for addresses, every address without its scheme (`github.com/owid/energy-data`, `naturalearthdata.com/`, `creativecommons.org/licenses/by/4.0/`), the CC BY sentence the stock writes (changes, no endorsement, no warranty); then `Type: Ysabeau Office by …` (section 4). **4. How the data gets here**: the yearly build, the loop replacing `data/snapshot.json`, the app re-reading the three files when it is opened and when new data lands; nothing fetched from outside the folder. Sections headed 13.5/650 in sentence case and parted by 1 px `--line` rules; the stock `DATA`, `UNITS`, `SOURCES` capitals and the blue `Close` go. |
| **Notices** | a `--sheet` plate centered on the plate, 1 px `--line-strong` edge, 8 px radius, `role="alert"`, 13.5 px `--ink`, at most 300 px, no icon | The stock sentences already speak in the file's terms (`data/snapshot.json could not be read (HTTP 404). Is the file missing?`); their em dashes become semicolons (`… is not JSON; it looks like a web page was written over it.`). The stock pink box, its red text and shadow go. A broken replacement keeps what was showing and says so (`… Showing the figures as last read.`); the stock app dropped what it had. The stock fields banner becomes the caption's note. |
| **Live region** | one `<p class="sr" aria-live="polite">` | A tap's sentence; a year key's new year; Find's count; focus mode's two sentences. Never per frame; the stock `#sheet` was itself `aria-live` and spoke its whole content on every year of play (B17). |
| **Focus mode** | `Hide the controls` alone in the column's last plate; the ghost key `Show the controls` (`aria-keyshortcuts="Escape"`) top-right of the plate, 8 px under the top safe area; Escape when no panel is open | Leaves (`hidden` and `inert`): the header (name, `Find`, units key, the row of words), the key column, the sheet, the legend's bar and ticks (the house default, owner call 7), an open card. Stays: the plate with its countries and fields; **the Ledger**; the stamp, moved into the caption band as its first line, its hit running down; the caption line; the credits; the player. A tap still opens the card; a double tap still zooms. **Remembered** as `wog.focus` (`'1'` or `'0'`), restored before the first draw. Sentences: `Controls hidden. Press Escape or the corner key to show them.` and `Controls shown.`; focus moves only when the keyboard did it. Fades: chrome out 160 ms, ghost key in 200 ms, one resize. The camera already calls `showControlsIfHidden()` for this app (section 5). |
| **The opening** | none | The arrival is the map, its fields and the Ledger appearing once the files are in; the stamp counts while they load. |
| **Motion** | HOUSE 4.12 | `flyTo` (a search choice, a country's fit) keeps its 600 ms and takes `--draw`'s curve in place of the stock ease-in-out; **any touch ends it at its destination** (the stock `pointerdown` cancels it midway, B13). Under Reduce Motion, read live with a `change` listener, flights are cuts (the stock already reads it per flight) and every CSS duration is 0 s; play already moves in whole years. Hidden (`visibilitychange`, `pagehide`): play stops, the loop stops; a return re-reads the three files, as the stock app does. |
| **The map by keyboard** | the canvas focusable (`tabindex="0"`), described by a sentence naming the gestures; the arrow keys pan a quarter of the plate, `+` and `-` zoom about its middle | A single-pointer and keyboard way to move the map beside the drag and the pinch (plan 0011 D13's call for every view), about 400 B. |
| **On its side** | HOUSE 4.13 | The header one 46 px row; the caption band two rows, the Ledger and the legend side by side, then the caption and the credits side by side, each one line; the player one row; the keys a row along the plate's top; the sheet a 340 px column beside the plate only. At 844 x 390 the plate must be 220 px or more, measured by `shoot.mjs` (the stock 167). |
| **Safe areas** | HOUSE 4.14 | Every band pads itself; the card and the ghost key sit under the top inset in focus mode. Phone checks. |

**What does not apply, and why:** a `now` notch (the data ends before today); per-step ticks on the
track (125 steps at 1.7 px); an opening; a second large figure (the card's figure is the only other
21 px figure, and only while the card is open); the stock legend's fold (the legend is always open in
the caption band, and its field key lives in the Map layers sheet).

---

## 4. Type

- **The house file, byte for byte.** `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256
  `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`) and `fonts/OFL.txt` (4 703 B,
  sha256 `d1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269`), copied from
  `global-weather/fonts/` (`cmp` both after copying). The one `@font-face` rule exactly as HOUSE 2.5
  gives it; the family used only through `--face`.
- **No supplement.** Every character the app writes outside comments and every string the app
  prints from the data (`fields.json`'s names, countries, operators, parents, basins, statuses,
  fuels and types; `snapshot.json` but its `ask` rows; `world.json`'s country names and source) was
  read against the cut's measured character map (HOUSE 2.2) by `python3 tools/.work/glyphs.py` (output
  in `tools/.work/glyphs.out`), comments stripped: nothing outside it, but U+0300 and U+036F, the ends of a regular expression's
  range in `fold()`, which is never shown. The stock CSS writes `\24D8` (ⓘ), `\203A` (›) and
  `\00B7`, and `index.html` `&#x25B8;` (▸); the cut has › and the middle dot, not ⓘ or ▸, and the pass
  removes all four (section 7). The pass adds U+202F, U+2212, ≤ and ≥, all in the cut.
- **Removed:** nothing shipped, since the stock app named the system faces (`-apple-system`,
  `BlinkMacSystemFont`, `"SF Pro Text"`, `Roboto`, `Helvetica`, `Arial`) without shipping any: the
  stack in `style.css` and the label font string in `drawLabels()` go, and with them the 20, 19, 17
  and 14 px sizes (`look.log`'s `sizes`). Fonts after the pass: 40 075 B (0 before it).
- **The scale here:** name 15/650; stamp 11.5; `Find` and the units key 600 at 12.5; the row of
  words 12.5 (620 chosen); the Ledger's labels 10.5 (560 for the chosen country); legend title
  11.5/600, its labels 10.5; caption 11; credits 10.5; the year 21/600 (the one large figure), the
  lead 12.5; track labels 10.5; the card's place line 12.5, its figure 21/600 with its unit 13.5, its
  rows 12.5 (values 560), a field's name 13.5/650; the sheet's heads 13.5/650, its rows 12.5, its
  notes 12.5; the chart's labels 10.5; Find's results 13.5 and 12.5, its field 16; country names on
  the plate 11.5/560 on the halo; About's prose 13.5/1.5 within 62 ch; notices 13.5.
- **Text waits for the face.** `document.fonts.load('560 11.5px "Ysabeau Office"')` before the first
  frame with names and before any name is measured (the stock caches each name's width on first
  placement in `textWidths`, so a fallback face would place every name wrong for good), and before the
  track's and the Ledger's first draw; names, the track, the Ledger and the chart redrawn on
  `document.fonts`' `loadingdone`, with `textWidths` cleared. Every font string in a script names
  `"Ysabeau Office"` first.
- **Credit line, word for word** (About, `NOTES.md`): `Ysabeau Office by Christian Thalmann
  (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.`

---

## 5. The camera's strings (HOUSE 7.4)

What the marketing camera reads in this app, in the Snuggery app's repository
(`Tests/SnuggeryUITests/MarketingCameraCase.swift` `waitForWorldOilGas()`, lines 385–394;
`MarketingShotsUITests.swift` shot 22, lines 499–506, and the README panes, lines 749–772;
`MarketingClipsUITests.swift` has no World Oil & Gas take: its `Oil` at line 179 is Norne's). The
camera's `webControl` lookup by label matches a button's label case-insensitively and exactly,
buttons first.

| String | Role | What the camera does | After the pass |
| --- | --- | --- | --- |
| `Updated` | visible text, the stamp | waits up to 180 s for it | **written** by this pass: the stamp `Updated 27 Sep, 08:18, figures to 2024` (or `Stale. Updated …`), only once the snapshot is read |
| `Play` | button | then waits up to 30 s for it, calls `showControlsIfHidden()` and waits 4 s; taps it for the README pane | **kept**: the Play key, named `Play` while paused; the player stays in focus mode |
| `Pause` | button | taps it 4 s after Play (the README pane `readme-world-oil-gas-2`) | **kept**: the same key, named `Pause` while playing, its mark now the pause bars (B2) |
| `Year` | slider | after `Pause`, a tap at 0.995 of its track (`setWebSlider`), which lands on 2024 | **kept**: the stock range's name, now on the app's own track, `role="slider"` |
| `Show the controls` | button | taps it if it exists (the focus guard, already in `waitForWorldOilGas()`) | **added** by this pass with the exact name |

The camera waits for the stamp's `Updated`, which appears only once the snapshot is read, before it
looks for `Play`, and after the README pane it puts the year back with that tap on the `Year` track.

---

## 6. Budgets

**The caps** (HOUSE 8, plan 0011 D5 and D17):

- **Code: 200 000 B, the house's cap**, which the lead's ruling (plan 0011 D17) keeps with no raise.
  The app's own figure, 150 000 B for `app.js`, binds `app.js` alone: `NOTES.md` states both and
  `tools/check.mjs` enforces both. No build enforces either (`scripts/shelf_atlas/build_world.py`
  holds only `WORLD_BUDGET`, 1 400 000 B, line 66, and `FIELDS_BUDGET`, 2 600 000 B, line 288;
  `grep -n -i budget scripts/shelf_atlas/*.py` from `Template/`). Never minified, never stripped of
  comments.
- **Fonts: 160 000 B.**
- **ZIP: 2 622 870 B**: the ZIP before the pass, 2 068 029 B, x 1.25, rounded down (2 585 036), plus
  37 834 B for the face (HOUSE 2.2), as HOUSE 8's table gives it.

**As built** (2026-10-02; `node tools/check.mjs`, which prints every figure):

| | Bytes | Against |
| --- | --: | --- |
| App code: `index.html` 18 075, `style.css` 24 406, `app.js` 118 407, `js/data.js` 26 163, `js/track.js` 5 938, `js/units.js` 6 928 | **199 917** | 200 000: 83 to spare |
| `app.js` alone | **118 407** | 150 000 |
| Fonts: the face 35 372, `OFL.txt` 4 703 | **40 075** | 160 000 |
| ZIP, as `build-zips.yml` packs it | **about 2 147 000** | 2 622 870 |

The code is within 5 % of its cap, 83 B under it (HOUSE 8), so anything this app gains, it pays for.
The ZIP's exact figure is the one `check.mjs` prints: this file ships inside it, so writing the
figure here moves its last digits (2 147 328 B when this table was written).

---

## 7. The generated-page tells, answered

| Tell | What this app does instead |
| --- | --- |
| 1. A warm cream ground, a high-contrast serif display, a terracotta accent | The cool film-base page `#e8eef0`; the stock cream land `#f7f5f0` becomes `#eff1ef`. One low-contrast Renaissance sans at every size. No accent: the warm hues on screen are the oil fields, which are data. |
| 2. A near-black ground with one acid-green or vermilion accent | The dark page is the house slate (L 0.224); the stock `#0b0e13` goes. No accent; the one bright thing is the Ledger, and it is data. |
| 3. Broadsheet: hairlines, zero radius, dense columns | One column. Hairlines only where they separate: the sheet's top, About's sections, the key separators, the player's top rule, the map's edge at 85 degrees. Radii 6, 8 and 4 px by role, 0 on the legend bar and the Ledger. |
| 4. The SaaS-card kit: identical rounded cards, one radius, one soft shadow, gradient washes | One card (the readout), one sheet at a time, About and Find as panels. No shadow, no blur, no glass (the stock had glass map keys, a glass legend and credits, and 18 shadow or blur lines). The only gradients are the legend's data scale and the selection tracer. |
| 5. ALL-CAPS tracked eyebrow labels | None: the stock `DATA`, `UNITS`, `SOURCES` in About, `FIELDS`, `COMPANIES` in search and `IN THE TRACKER` in the sheet (uppercase, 0.04 em tracking) become sentence-case heads at 13.5/650. |
| 6. Meta strings joined with middle dots | Commas, sentences or one value per line: the stamp, the lead, the counts, search's lines, the card. The one middle-dot string left is the credit line, kept word for word. |
| 7. "WORD — fragment" labels with a spaced em dash | None in the app's own text: the banner's `No field points — fields.json is not available`, About's `— which is not the same as zero —`, the notices' `is not JSON — it looks like…`, and `PROMPT.md`'s `Step 1 — the clock` headings become sentences, semicolons and colons. A source's name as the data writes it (`Our World in Data — Energy dataset`) is printed as the data writes it. |
| 8. A tinted near-black standing in for black | Ink is the house `#0f1c23`, a stated ink; the Ledger `#1b150e` is a stated printing ink at hue 71; the stock `#14181f` ink and `#0b0e13` ground go. |
| 9. A monospace face for small data labels | None, and there was none. Ysabeau Office's figures are tabular. |
| 10. "→" appended to links and buttons | None: the stock banner's `›` and the stamp's and credits' `ⓘ` go; `PROMPT.md`'s menu paths, written with arrows today, become words (`in Safari, Share, then Snuggery`); `check.mjs` fails on → and ➤. |
| 11. One word accented in a headline | None: the stock red stale stamp and the accent-blue search key go; a stale state is a sentence in `--ink`. |
| 12. Unnecessary labels above content | The legend's title is the quantity its bar measures. The Ledger has no title; the caption line says how to read it. The sheet's heads name what follows. |
| 13. Numbered markers (01 / 02 / 03) | None. |
| 14. A big number, a small label and a gradient accent | One large figure, the year, at 21 px; the card's figure at 21 px only while it is open. The stock sheet's 17 px bold stat tiles go. No gradient. |
| 15. Scattered fade-and-slide entrances, hover on every card | No entrances. The one continuous motion is the data's (play); the small transitions answer a touch. Hover only on controls, under `@media (hover: hover)`. |

**The interface guidelines**, where the house writes its own rule (HOUSE 9): sentence case
(`Hide the controls`, `Find`); dates by hand, not `Intl` (the stock's `fmtDate` and `fmtFull`); the face
`font-display: block`; `translate="no"` on the name, the units key, field, company, country and
source names; `aria-live="polite"` for sentences only; `<button>` for every action (the stock legend
`div role="button"` and the credits button become text); `env(safe-area-inset-*)` on every band;
`…`, never `...`.

---

## 8. Where the record is

The pass's record does not ship: the change list with the bugs B1 to B18, the owner calls (the
references to "owner call 1" to "owner call 12" above point there), the as-built departures, the
reviews and the follow-up, the history this file once carried and the phone checks are in
`tools/DECISIONS.md`, which the ZIP leaves out (HOUSE.md, "What ships and what does not").
