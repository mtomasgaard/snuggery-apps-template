# Finances: art direction

How the app looks, moves and speaks under the template's house system (`Template/HOUSE.md`; Running
Dashboard is the first pane app, whose frame this one follows). `NOTES.md` says where the numbers come
from; `PROMPT.md` sets a copy up. The record of the pass (its change list, the owner calls, the as-built
departures, the phone checks) is in `tools/DECISIONS.md`, which does not ship.

Figures were measured on 2026-10-02; `python3 finances/tools/art/palette.py` (from `Template/`)
prints every color figure and ends `ALL CHECKS PASS`. Screens were read in headless Chromium at
390 × 844, the clock at 21 Sep 2026, 12:00 in Oslo: what the page draws, never how a phone feels.

---

## 1. The signature: the Balance

**In one paragraph.** An accountant draws a household's position as a T: what it owns on the left,
what it owes on the right, and the two sides made equal by one balancing figure, which is what the
household is worth. Finances draws that T at the head of Overview, to scale. Under a crossbar headed
`Own` and `Owe`, each side hangs one block of ink per account, fund, car, home and loan, as deep as its
value. The left side ends where everything owned ends; the right side's debts stop short of it, and
the empty space below them, down to the double rule both sides close on, is the net worth, bracketed
and printed beside it. The example household's T is mostly two slabs: the home (5 059 605 kr, 88.2 %
of what is owned) against the home loan (2 871 222 kr), with the accounts, the fund and both cars a
few hairlines at the top. A stranger remembers the hollow under the mortgage: the part that is theirs.

**How it was found** (HOUSE 5.1):

1. *The specialist's picture:* the balance sheet, in its oldest form the T-account, with totals
   double-ruled. Also the net-worth line, the cash-flow waterfall, the running balance of a statement
   and the amortization table. Only the T holds every account, holding and debt with the one identity
   (owned = owed + net worth) on one axis.
2. *What a person does most:* opens Overview, the pane the app opens on and the camera photographs,
   to see what they are worth and why. The T answers both where the eyes land.
3. *What this data has that no other app has:* signed money that must reconcile. The snapshot's items
   add up to `netWorth` to the øre (5 736 192.80 owned less 3 015 928.95 owed is 2 720 263.85); moved
   to any other app, the T has nothing to draw. Set aside: the net-worth line (every finance app's;
   kept as a chart), a statement's running balance (only as complete as 300 transactions), the
   waterfall (a budgeting-app pattern; categories exist for 30 days only), the amortization schedule
   (two loans), last year's totals as ticks (Shelf Atlas's Peaks already rings a past best).
4. *The house's means:* `--ink` blocks on `--page`, 1 px page gaps, 1 and 2 px ink rules, 10.5 px
   labels, no motion.

**The rule it is drawn by** (`js/balance.js`, pure; `tools/test_balance.mjs` proves it):

- **Items, most liquid first.** Own: accounts with a positive balance (largest first), funds, counted
  shares (`equity.counted`), pension when `includeInNetWorth`, vehicles, property. Owe: accounts with
  a negative balance, then loans, smallest first. A side whose items differ from `netWorth`'s
  components by more than 1 kr gains one block, `Other, as the snapshot totals it`, so the T balances
  on the snapshot's own total.
- **The scale**: the first rung of 1, 2, 2.5 or 5 times a power of ten (so 10 000, 20 000, 25 000,
  50 000, 100 000 … kr) per CSS pixel that keeps the deeper side within 160 px (the demo: 50 000, so
  115 px owned and 60 owed); the smaller rungs serve a copy kept in a currency of smaller numbers. Printed as a ruler at the left: 1 px `--line-strong`, a 1 × 4 px `--ink-3` tick and a
  10.5 px value at each 1-2-5 step (`0` to `5` under `million kr`), and a 1 px `--line` hairline across
  both columns at each.
- **Blocks**: positions cumulative and rounded, so a side's depth is exactly its total; a block's top
  row is the page (a 1 px gap) unless it is under 2 px deep, when it is one 1 px ink row. Columns 56 px
  wide at 390 px (44 under 340), 6 px from a 1 px ink stem, set left of center so the right side keeps
  the room the figure needs, measured in the face (108 px for `2 720 264 kr`); a 2 px ink crossbar;
  `Own` and `Owe` over it, 12.5 px 600. Both sides close on a double rule (two 1 px ink rules, 2 px
  apart) at the deeper foot. The drawing is at most 420 px wide and left-aligned, so on a phone on its
  side the T keeps its ruler beside it.
- **The balancing figure**: the hollow on the shallower side, from its last block to the deeper foot
  (55 px for the demo's 2 720 264 kr; the double rule is 2 px below), has a 1 px ink bracket beside it with `Net worth` (12.5 px `--ink-2`) and the figure (21 px 600, the
  pane's one large figure); when debts exceed what is owned the hollow is on the left, `Owed beyond
  what is owned`, the figure unsigned (the words carry the sign); when there is no room beside it (less than 70 px left for the labels at the
  left, as at 320 px wide, or a hollow under 40 px tall), the words go under the double rule, ending
  at the drawing's right edge.
- **Labels**, 10.5 px `--ink-2` on a 3 px `--page` halo, outside the columns at a block's middle: a
  block 12 px or deeper takes its name (`Home`, `Home loan`); a run of shallower ones shares a label,
  two names (`Credit card, Car loan`) or their kinds counted (`3 accounts, 1 fund, 2 vehicles`); a
  label within 12 px of the one before is left out. A label wraps to the room beside its column, at its
  commas first, on at most three lines 12 px apart; one that would then touch the label above it is
  left out too (its card still names it).
- **Readout**: a tap on a block opens the house card (`Home, property`, `5 059 605 kr`, its share of
  its side, its basis as the data writes it, its change since the anchor); on a run of shallow blocks,
  one row per item; on the hollow, `Net worth` with Owned, Owed and the two changes. The tapped thing
  is marked: a 1 px `--page` ring inset in a block 6 px or deeper; a 2 px ink tick (6 px at least)
  outside the column along a run, a thinner block or the hollow. The card hangs below the drawing
  (beside it on a wide screen), never over the T. The home's
  valuation words (Owned) redraw it. VoiceOver reads a label built from the data, its numbers written
  whole so they are read as numbers (`Balance on 21 September 2026: owned 5736193 kroner, the home
  5059605 of it; owed 3015929 kroner, the home loan 2871222 of it; net worth 2720264 kroner.`);
  `Show the table` under the facts lists every block.
- **Caption**, 11 px `--ink-2`: `Owned against owed on 21 Sep 2026, one block per account, holding or
  loan, to one scale; the space under the debts is net worth.` Test hook: `window.__fin.balance()`.

**Against the apps before it**: no other signature is a ledger. It shares Running Dashboard's Block's
way of counting (ink cut into one block per thing, the page between) and nothing else: two columns,
hung, not stood; no time axis; a hollow that is a result, not a plan.

---

## 2. Palette

`palette.py --json` prints the data tokens, pasted into `style.css`; `tools/check.mjs` fails while
they differ. Only lightness is fitted; hue and chroma are the stock slots' (sRGB permitting).

**Chrome**: HOUSE 3.1's tokens as they are, both themes (ink on page 14.80 / 14.43; ink-3 on sheet
5.29 / 5.25; chroma at most 0.0239).

| | Light (film base) | Dark (the print) |
| --- | --- | --- |
| Ground | `--page` `#e8eef0`, L 0.945; card and About on `--sheet` | `--page` `#141d21`, L 0.224 |
| Data band | L 0.400 to 0.625 | L 0.560 to 0.860 |
| Signature | the Balance, `--ink` `#0f1c23` (L 0.218), opaque | `--ink` `#e6edee` (L 0.941), opaque |
| Lowest data token on a ground | 3.28, `--series-2` on page | 3.05, `--series-2` on sheet |

The band is the widest that keeps every token at 3:1 on both grounds and clear of the ink: the same
constraint, so the same band, as Running Dashboard's. The Balance never sits over data; ink drawn over
data (a cursor's discs, the net-worth line's end dot) has a 2 px `--page` ring (without it, 1.95
light and 1.35 dark against the nearest token). The end dot's 4 px `--page` casing lies under the
line: it clears the gridlines, never the line's last days.

| Token | Use | Light | Dark |
| --- | --- | --- | --- |
| `--amount` | every chart of one quantity: net worth over time, spending by category, a loan's share repaid | `#4a6588` | `#93aeca` |
| `--series-1` | the first of a pair (In, Value) and the largest fund | `#034992` | `#abcffe` |
| `--series-2` | the second (Out, Every debt, Paid in) and the second fund | `#db5923` | `#c34605` |
| `--series-3` to `-6` | the third to sixth funds (sixth: `Other`) | `#0a8d61` `#654301` `#9f3964` `#8265d9` | `#06a471` `#febf62` `#eb7ea7` `#8669de` |

The pair stays apart under normal, deutan, protan and tritan vision (ΔE 0.247 at the closest, light
protan). The six slots are 0.173 apart at the closest under normal vision. **A stated departure**:
under the simulations four pairs of fund slots come closer than 0.10 (light deutan `series-3` and
`series-5`, 0.067, the lowest); every fund is named in the strip's legend and in its own row, so color never
carries identity alone. Slot 6 changes hue (a violet for the stock's second green) so six funds never
show two greens; the pair is ordered (slot 1 further from the ground) so the line read first is the
stronger. Money's direction is never a color: no green gains, no red debts; the sign and the words
carry it.

**Marks that are not data**: hairlines `--line`; baselines and the ruler `--line-strong`; the cursor a
1 px `--ink` rule at 50 % with a 7 px ink disc on a 2 px `--page` ring; a column's cursor `--ink` at
7 %; a bar's track `--line`.

---

## 3. The chrome, object by object

HOUSE 4.0's *panes from a pull*, in Running Dashboard's frame: header, a pane scrolling inside itself,
a fixed caption band; no key column, player, focus mode or opening.

- **Header.** `<h1 translate="no">Finances</h1>`, 15 px 650. The stamp, a `<button>` opening About
  (44 px hit): `Updated 07:12` on the snapshot's day, `Updated 21 Sep, 07:12` after; `Stale. Updated …`
  (the word in `--ink`) past 30 hours; on example data (`synthetic`) `Example data. Updated 07:12`,
  in place of `Stale.`, the date added once the day has passed, the year once it is another year. On
  example data every relative day (the bill, consent, units set, a vest) counts from the snapshot's
  own day, so it never reads overdue. The stamp opens About with no usable data too. No units key.
- **Tabs**: `Overview`, `Owned`, `Spending`, `Cash flow`, `Savings`, `Transactions`, `<button
  role="tab">` words at 12.5 px with the house tracer, 44 px hits, scrolling inside their row (the
  chosen one scrolled whole into view; focus rings inset 2 px, as the row clips), built after the
  snapshot parses (section 5).
- **Rows of words** with the tracer (`aria-pressed`, 44 px): the range `30 days`, `90 days`, `1 year`,
  `All`; the home's valuation `All dwellings`, `Detached houses`, `Flats` (the data's labels).
- **Sections, not cards**, between hairlines, headed 13.5 px 650 in sentence case. One 21 px figure per
  pane at most: the net worth (in the Balance), `Owned, less what is owed on it`, `Spent, 23 Aug to
  21 Sep`, `Invested`. **Facts** (`<dl>` rows, label left, value right) replace the stock's tiles and
  splits; a holding the snapshot lacks is left out, never a dash.
- **Rows** (accounts, holdings, loans, merchants, repeating charges, transactions): the name, then
  words joined by commas, each dropped when it repeats one before it (`Credit card, ending 3388`);
  masked numbers as `ending 4417`; amounts tabular, signed, never colored.
- **Statements** (the snapshot's notes, a failed or stale source, consent ending, an unpriced fund,
  units unchecked, history part contributions): sentences on the page, 13.5 px `--ink`, the first
  words at 620 (`Bank: consent ends in 12 days.`, `Units last set from the provider 385 days ago.`);
  the snapshot's own notes as written; no box, dot or color.
- **Charts**: SVG in the house face, labels 10.5 px; the unit above the plot (`thousand kr`, `million
  kr`) and plain tick numbers with the step's decimals; the value axis past the largest value; square
  bars; no gradient; the net worth line's end an ink dot on its last vertex. `Show the table`
  under each chart and under the Balance's facts.
- **Readout card** as Running Dashboard's (HOUSE 4.7): `--sheet`, 1 px `--line-strong` edge, 8 px
  radius, inside the chart clear of the point, `Close`, the value 21 px, rows; text nodes updated in
  place; **a tap opens it, a vertical drag scrolls and opens nothing**; announced once in words.
- **Caption band** (fixed): a caption line per pane, two lines high, in the data's words (Overview:
  `Accounts as read on 21 Sep 2026; what no bank reports is estimated, each by the method Owned
  names.`), then the credits, 10.5 px, one of two constants by `synthetic`: `Accounts, holdings and
  loans: invented for this example. Home index: Statistics Norway, table 07221 (NLOD).` or `Accounts:
  your banks, through Enable Banking (PSD2). Home index: Statistics Norway, table 07221 (NLOD).`
- **About** (HOUSE 4.8): what the Balance is and is not, with its scale in words (`50 000 kr a pixel
  here`); this data (on example data first `Example data:` and what was invented; `Updated:` with the zone, the
  currency, the history's span, each source's state and last read, consent's end, `Stale after: 30
  hours`); how the numbers are made (the index, the depreciation curve, the modeled loans, the accrued
  units); sources and credits (SSB's NLOD statement, the bank route, Norges Bank, fund prices, the
  type); how the data gets here. The stock footer moves here.
- **Notices** (`role="alert"`) only for a file that cannot be read; a broken replacement keeps the
  data and says so, with `Close`. One polite live region. A return re-reads the file: the same file
  redraws only the stamp; a new one re-renders in place, keeping pane and scroll. Landscape: a 46 px
  header row and a one-line caption band.

---

## 4. Type

The house face byte for byte: `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256 `fdf1a28c…cdb262`)
and `fonts/OFL.txt` (4 703 B, `d1adfffd…be6269`), the one `@font-face` rule word for word, the family
only through `--face`. **No supplement**: the one character the app needs that the cut lacks is the
data's `•` in masked account numbers, shown as `ending 4417` (HOUSE 2.3; the data unchanged). The
stock's disclosure triangles go with their `<details>`: a table opens from a `Show the table` text key.
`PROMPT.md`'s arrows become words. The system and monospace stacks go. The scale 10.5 / 11 / 11.5 /
12.5 / 13.5 / 15 / 21 px, weights 400 to 650, no capitals, no letter-spacing, with one stated departure:
the Transactions search field is set at 16 px, because iOS zooms the page into a text field set any
smaller (Shelf Atlas's find field does the same). SVG text takes the page's face; the Balance waits for
the face before it measures its figure. The credit line word for word in About (`Type: `) and
`NOTES.md`.

---

## 5. The camera's strings

HOUSE 7.4: the camera waits for **a button named `Overview`** and taps **`Overview` and `Spending`**
(`MarketingShotsUITests.swift` 334-345; `selectPane`, `MarketingCameraCase.swift` 196-200).

| String | Role | Kept |
| --- | --- | --- |
| `Overview` | `<button role="tab">` | kept; now built after the snapshot parses, so the wait proves the data loaded |
| `Spending` | `<button role="tab">` | kept |

The app remembers its pane (`fin.tab`); the camera selects `Overview` first and again at the end.
**The camera needs no change.** No string is British.

---

## 6. Budget

*Measured* 2026-10-02 by `node tools/check.mjs`: code as every shipped `.html`, `.css` and `.js`; the ZIP
built by `build-zips.yml`'s command (`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*'
'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`), then its size.

| | Before the pass | As built | Cap |
| --- | --: | --: | --: |
| App code | 103 178 | 123 733 | 200 000, the house's |
| Fonts | 0 | 40 075 | 160 000 |
| ZIP | 69 976 | **129 764** | **131 000, the lead's ruling (2026-10-02, plan 0011 D27)**: 125 304 by D5's formula (69 976 × 1.25 plus 37 834 for the face) until the build had measured 128 025 with nothing cut or minified; the face stores 37 510 and the code's growth 11 000, more than the formula foresees for a 70 kB app; about 3 000 B for the fix stages |
| Data | `data/snapshot.json` `5d1c30a3…085be0`, `assets.json` `03ff325a…f92e1c`, `holdings.json` `6301079e…d2bb86`, `categories.json` `7d6e4a2f…ba60b` | unchanged | pinned by `check.mjs` |

**The ZIP is inside its cap**: about 129 800 B of 131 000. Stored in the ZIP, the face and its license take
37 510 B, the app code 41 954 B and the shipped `.md` files about 18 800 B; this file's own size moves the last
digits, and `node tools/check.mjs` prints the exact figure.

---

## 7. The generated-page tells, answered

| Tell | Here |
| --- | --- |
| 1. Cream, serif display, terracotta | film base; one sans; no accent |
| 2. Near-black with an acid accent | slate print; the bright thing is the Balance's ink |
| 3. Broadsheet | one column, hairlines between sections, radii by role |
| 4. The SaaS-card kit | the stock's cards, shadows and 16 px radii go; no gradient |
| 5. Tracked capitals | none; the stock's uppercase labels go |
| 6. Middle-dot joins | commas and sentences |
| 7. Spaced em dash | none in the app's own text; the data's are shown as written |
| 8. Tinted near-black | ink `#0f1c23` as ink |
| 9. Monospace labels | none; `code` and the error box's face go |
| 10. Arrows on buttons | none, and none in `PROMPT.md` |
| 11. One accented word | none; the stock's `NOT` goes |
| 12. Labels above content | labels beside values |
| 13. Numbered markers | none |
| 14. Big number, small label, gradient | one 21 px figure per pane; the line chart's gradient goes |
| 15. Entrances, hover everywhere | none; the card's 120 ms fade answers a tap |

---

## 8. Where the record is

The art pass's change list (bugs B1 to B25 and items 1 to 19), the owner calls it left open, the
as-built departures and the phone checks are in `tools/DECISIONS.md`, which does not ship.
