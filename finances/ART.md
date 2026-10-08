# Finances: art direction

How the app looks, moves and speaks under the template's house system (`Template/HOUSE.md`; Running
Dashboard is the first pane app, whose frame this one follows) and its pane-app register (HOUSE 11): one
key number per pane, sections on plates, tables and tiles in place of sentences, color with one meaning. `NOTES.md` says where the numbers come
from; `PROMPT.md` sets a copy up. The record of the pass (its change list, the owner calls, the as-built
departures, the phone checks) is in `tools/DECISIONS.md`, which does not ship.

Figures were measured on 2026-10-02, the register's on 2026-10-08; `python3 finances/tools/art/palette.py` (from `Template/`)
prints every color figure and ends `ALL CHECKS PASS`. Screens were read in headless Chromium at
390 × 844, the clock at 21 Sep 2026, 12:00 in Oslo: what the page draws, never how a phone feels.

---

## 1. The signature: the Balance

**In one paragraph.** An accountant draws a household's position as a T: what it owns on the left,
what it owes on the right, and the two sides made equal by one balancing figure, which is what the
household is worth. Finances draws that T on Overview, under the net worth, to scale. Under a crossbar headed
`Own` and `Owe`, each side hangs one block per account, fund, car, home and loan, as deep as its
value, what is owned in `--own` blue and what is owed in `--owe` orange. The left side ends where everything owned ends; the right side's debts stop short of it, and
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
4. *The house's means:* blocks in the register's two side colors on a `--sheet` plate, 1 px gaps of
   the plate, 1 and 2 px ink rules, 10.5 px labels, no motion.

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
  row is the plate (a 1 px gap) unless it is under 2 px deep, when it is one 1 px row of its color. Columns 56 px
  wide at 390 px (44 under 340), 6 px from a 1 px ink stem, set left of center so the right side keeps
  the room the figure needs, measured in the face; a 2 px ink crossbar;
  `Own` and `Owe` over it, 12.5 px 600, in `--own` and `--owe`. Both sides close on a double rule (two 1 px ink rules, 2 px
  apart) at the deeper foot. The drawing is at most 420 px wide and left-aligned, so on a phone on its
  side the T keeps its ruler beside it.
- **The balancing figure**: the hollow on the shallower side, from its last block to the deeper foot
  (55 px for the demo's 2 720 264 kr; the double rule is 2 px below), has a 1 px ink bracket beside it with `Net worth` (12.5 px `--ink-2`) and the figure (15 px 600;
  the key number above the drawing carries it at 34 px); when debts exceed what is owned the hollow is on the left, `Owed beyond
  what is owned`, the figure unsigned (the words carry the sign); when there is no room beside it (less than 70 px left for the labels at the
  left, as at 320 px wide, or a hollow under 40 px tall), the words go under the double rule, ending
  at the drawing's right edge.
- **Labels**, 10.5 px `--ink-2` on a 3 px `--sheet` halo, outside the columns at a block's middle: a
  block 12 px or deeper takes its name (`Home`, `Home loan`); a run of shallower ones shares a label,
  two names (`Credit card, Car loan`) or their kinds counted (`3 accounts, 1 fund, 2 vehicles`); a
  label within 12 px of the one before is left out. A label wraps to the room beside its column, at its
  commas first, on at most three lines 12 px apart; one that would then touch the label above it is
  left out too (its card still names it).
- **Readout**: a tap on a block opens the house card (`Home, property`, `5 059 605 kr`, its share of
  its side, its basis as the data writes it, its change since the anchor); on a run of shallow blocks,
  one row per item; on the hollow, `Net worth` with Owned, Owed and the two changes. The tapped thing
  is marked: a 1 px `--sheet` ring inset in a block 5 px or deeper; a 2 px ink tick (6 px at least)
  outside the column along a run, a thinner block or the hollow. The card hangs below the drawing
  (beside it on a wide screen), never over the T. The home's
  valuation words (Owned) redraw it. VoiceOver reads a label built from the data, its numbers written
  whole so they are read as numbers (`Balance on 21 September 2026: owned 5736193 kroner, the home
  5059605 of it; owed 3015929 kroner, the home loan 2871222 of it; net worth 2720264 kroner.`).
- **Under it, its numbers as a table**: two columns, `Owned` and `Owed` (12.5 px 620 in `--own` and
  `--owe`), each side's total at 19 px 650, then its rows parted by `--line`, amounts right-aligned at 560:
  owned by kind (`Bank accounts`, `Funds`, `Employee shares`, `Pension`, `Vehicles`, `Other`, each home by
  its name), owed by name (`Credit card`, `Car loan`, `Home loan`). What the drawing means is About's *What
  the Balance is*; the drawing carries no sentence. Test hook: `window.__fin.balance()`.

**Against the apps before it**: no other signature is a ledger. It shares Running Dashboard's Block's
way of counting (one block per thing, a 1 px gap between) and nothing else: two columns,
hung, not stood; no time axis; a hollow that is a result, not a plan.

---

## 2. Palette

`palette.py --json` prints the data tokens, pasted into `style.css`; `tools/check.mjs` fails while
they differ. Only lightness is fitted; hue and chroma are the stock slots' (sRGB permitting).

**Chrome**: HOUSE 3.1's tokens as they are, both themes (ink on page 14.80 / 14.43; ink-3 on sheet
5.29 / 5.25; chroma at most 0.0239).

| | Light (film base) | Dark (the print) |
| --- | --- | --- |
| Ground | `--page` `#e8eef0`, L 0.945 (gray, HOUSE 12); every section, the card and About on `--sheet` | `--page` `#141d21`, L 0.224; the same |
| Data band | L 0.400 to 0.625 | L 0.560 to 0.860 |
| Signature | the Balance: `--own` and `--owe` blocks (6.29 and 5.49 on the plate), `--ink` `#0f1c23` rules (16.40) | `--own` and `--owe` (7.68 and 7.24), `--ink` `#e6edee` rules (12.87) |
| Lowest data token on a ground | 3.28, `--series-2` on page | 3.05, `--series-2` on sheet |

The band is the widest that keeps every token at 3:1 on both grounds and clear of the ink: the same
constraint, so the same band, as Running Dashboard's. The Balance never sits over data; ink drawn over
data (a cursor's discs, the net-worth line's end dot) has a 2 px `--sheet` ring, the plate it is drawn on
(without it, 1.95 light and 1.35 dark against the nearest token). The end dot's 4 px `--sheet` casing lies
under the line: it clears the gridlines, never the line's last days.

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
stronger.

**Meaning colors** (HOUSE 11.1 rule 5, 11.2; taken as the house measured them, and `palette.py` repeats
every figure): four hues, one meaning each, and never the only carrier. They are never on a control, a tab,
a heading, a plate, a hairline or the stamp.

| Token | Means here | Light | Dark | As text, light: page / plate | Dark: page / plate |
| --- | --- | --- | --- | --: | --: |
| `--own` | what is owned: the Balance's Own blocks and head word, the `Owned` column's head | `#1f5f99` | `#8cbcf0` | 5.68 / 6.29 | 8.61 / 7.68 |
| `--owe` | what is owed: the Owe blocks and head word, the `Owed` column's head, a debt's amount among the accounts | `#a64a1a` | `#f0a070` | 4.96 / 5.49 | 8.12 / 7.24 |
| `--up` | a change up: net worth's changes; the change under Owned's and Savings' key numbers (the amount only, its words and percentage plain); an owned item's, a fund's or a pension's change since it was bought or set | `#17723e` | `#6fd39a` | 5.10 / 5.65 | 9.34 / 8.33 |
| `--down` | a change down, in the same places | `#b42318` | `#ff9a8f` | 5.61 / 6.21 | 8.37 / 7.46 |

Owned and owed stay apart under all four visions (ΔE 0.246 / 0.224 / 0.188 / 0.252 light, 0.202 / 0.185 /
0.175 / 0.225 dark). Up and down come within 0.062 in light deutan, and up and owed within 0.059 in light
protan: allowed only because a change always prints its sign (`+16 492 kr`, `−149 927 kr`) and a debt its
minus, so the color is never the only carrier. A change of zero takes neither. `--own` and `--owe` are the
same blue and orange family as `--series-1` and `--series-2` (ΔE 0.068 at the closest) and never meet them
on one drawing; Owned's chart and Cash flow's keep their pair slots.

**Marks that are not data**: hairlines `--line`; baselines and the ruler `--line-strong`; the cursor a
1 px `--ink` rule at 50 % with a 7 px ink disc on a 2 px `--sheet` ring; a column's cursor `--ink` at
7 %; a bar's track `--line`.

---

## 3. The chrome, object by object

HOUSE 4.0's *panes from a pull*, in Running Dashboard's frame, in the pane-app register (HOUSE 11): a
header and a pane scrolling inside itself under it, which pads the home indicator itself (`calc(28px +
env(safe-area-inset-bottom))`); no caption band, key column, player, focus mode or opening. The pane is a
column at most 760 px wide, centered, and on a wider screen the header is centered with it, so the name
and the tabs start where the plates do.

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
  `All`; the home's valuation `All dwellings`, `Detached houses`, `Apartments` (the data's labels).
- **Sections on plates** (HOUSE 11.1 rule 4): each a `--sheet` plate with a 1 px `--line` edge, an 8 px
  radius and 12 px padding, 12 px apart on the page, headed 15 px 650 in sentence case. Savings' group
  heads (`Pension`, `Funds`, `Employee shares`) stand 15 px above their plates, and each day of
  Transactions is a plate under its date.
- **The key number** (HOUSE 11.1 rule 2), on its own plate at the head of a pane: its label at 12.5 px
  `--ink-2` (the pane's first heading, so a screen reader's headings start there), the figure at 34 px 650, its change or lead under it at 13.5 px. Overview: `Net worth, 21
  Sep`, `2 720 264 kr`, then `+16 492 kr in 30 days` and `+395 314 kr in a year`, each amount in
  `--up` or `--down` by its sign (`Change: not enough history yet` when the file has no 30 days). Owned:
  `Owned, less what is owed on it`, then `+118 400 kr in value over a year, before the loans moved`; Spending:
  `Spent, 23 Aug to 21 Sep 2026`; Savings: `Invested`, then `+18 504 kr, +18.3 % on what was paid in`. A
  change printed with its sign under a key number takes its direction's color on every pane, the amount
  only. Spending's comparison is words (`less than`, `more than`), unsigned, and stays ink. Cash flow and
  Transactions have none.
- **Tiles** (HOUSE 11.1 rule 3): on the key number's plate, two columns of a label (11.5 px `--ink-2`),
  the value at 19 px 650 and a note (11.5 px), parted by `--line`; a holding the snapshot lacks is left
  out, never a dash.
- **Rows** (accounts, holdings, loans, merchants, repeating charges, transactions): the name, then
  words joined by commas, each dropped when it repeats one before it (an account's type, then its mask:
  `current account, ending 4417`); masked numbers as `ending 4417`; amounts 15 px 600, tabular, signed. A
  debt's amount among the accounts is `--owe` (`−8 761 kr`); the change under an owned item, a fund or a
  pension account prints its amount in `--up` or `--down` (`+559 605 kr, +12 %`).
- **Statements** (a failed or stale source, consent ending, an unpriced fund, units unchecked, history
  part contributions): sentences on a plate, 13.5 px `--ink`, the first words at 620 (`Bank: consent
  ends in 12 days.`, `Units last set from the provider 385 days ago.`); no box, dot or color. The
  snapshot's own notes (the example's `Example text: …`) are About's *This data*, not the pane's.
- **Overview, in order**: the key number; the Balance with its Owned and Owed table; `To pay` (the
  card's bill, the one number with a deadline); any statements; `Net worth over time` with its range
  words; `Accounts`; the About key.
- **The About key** (HOUSE 11.1 rule 1): every pane, an empty one too, ends with the button `Sources,
  method and credits are in About.`, 12.5 px `--ink-2`, underlined at a 3 px offset, at least 44 px tall,
  14 px under the last section.
- **Charts**: SVG in the house face, labels 10.5 px; the unit above the plot (`thousand kr`, `million
  kr`) and plain tick numbers with the step's decimals; the value axis past the largest value; square
  bars; no gradient; the net worth line's end an ink dot on its last vertex. `Show the table`
  under Owned's chart, Cash flow's and the funds' line. No caption sentence: a chart's legend keys its
  series, and what a chart counts is About's *How the numbers are made*.
- **Readout card** as Running Dashboard's (HOUSE 4.7): `--sheet`, 1 px `--line-strong` edge, 8 px
  radius, inside the chart clear of the point, `Close`, the value 21 px, rows; text nodes updated in
  place; **a tap opens it, a vertical drag scrolls and opens nothing**; announced once in words. A
  sideways slide reads along the chart, the day or month under the finger after every move, and leaves
  the card pinned when it lifts; only the pointer that is reading ends its read by leaving the chart.
- **About** (HOUSE 4.8), from the stamp or the key at any pane's end: what the Balance is and is not,
  with its scale in words (`50 000 kr a pixel here`); this data (first the snapshot's own notes, on the
  example its `Example text: …`; then `Example data:` and what was invented, `Updated:` with the zone, the
  currency, the history's span, each source's state and last read, consent's end, `Stale after: 30
  hours`); how the numbers are made (the index, the depreciation curve, the modeled loans, what Owned's
  chart counts, the accrued units, Spending's and Cash flow's windows, Repeating, shares still to vest);
  sources and credits (first the credit, one of two constants by `synthetic`: `Accounts, holdings and
  loans: invented for this example. Home index: Statistics Norway, table 07221 (NLOD).` or `Accounts:
  your banks, through Enable Banking (PSD2). Home index: Statistics Norway, table 07221 (NLOD).`; then
  SSB's NLOD statement, the bank route, Norges Bank, fund prices, the type); how the data gets here.
  The front carries no credit; the home's basis line and Norges Bank beside its rate are the view's own
  text (HOUSE 4.15).
- **Notices** (`role="alert"`) only for a file that cannot be read; a broken replacement keeps the
  data and says so, with `Close`. One polite live region. A return re-reads the file: the same file
  redraws only the stamp; a new one re-renders in place, keeping pane and scroll. Landscape: a 46 px
  header row. The text keys' pressed tint shows on iOS through an empty passive `touchstart` listener.

---

## 4. Type

The house face byte for byte: `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256 `fdf1a28c…cdb262`)
and `fonts/OFL.txt` (4 703 B, `d1adfffd…be6269`), the one `@font-face` rule word for word, the family
only through `--face`. **No supplement**: the one character the app needs that the cut lacks is the
data's `•` in masked account numbers, shown as `ending 4417` (HOUSE 2.3; the data unchanged). The
stock's disclosure triangles go with their `<details>`: a table opens from a `Show the table` text key.
`PROMPT.md`'s arrows become words. The system and monospace stacks go. The pane apps' scale (HOUSE 11.1
rule 2): 10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 / 19 / 21 / 34 px, 34 for each pane's key number alone, 19
for tile values and the Balance's side totals, 21 for the card's value alone; weights 400 to 650, no
capitals, no letter-spacing, with one stated departure:
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

*Measured* 2026-10-08 by `node tools/check.mjs`: code as every shipped `.html`, `.css` and `.js`; the ZIP
built by `build-zips.yml`'s command (`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*'
'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`), then its size.

| | Before the register | As built | Cap |
| --- | --: | --: | --: |
| App code | 123 706 | 126 632 | 200 000, the house's |
| Fonts | 40 075 | 40 075 | 160 000 |
| ZIP | 130 333 | **about 133 200** | **162 916**: the ZIP before the register × 1.25, the house rule (the lead's ruling for the pane apps, plan 0012) |
| Data | `data/snapshot.json` `2481554a…aae1c1`, `assets.json` `78df79dd…a2164d`, `holdings.json` `6301079e…d2bb86`, `categories.json` `07b65e5e…7282c8` | the same, byte for byte | pinned by `check.mjs`; `scripts/make_demo_finances.py --check` rebuilds the snapshot byte for byte |

**The ZIP is inside its cap**: about 133 200 B of 162 916. Stored in the ZIP, the face and its license take
37 510 B, the app code 43 272 B and the shipped `.md` files about 20 900 B; this file's own size moves the last
digits, and `node tools/check.mjs` prints the exact figure.

---

## 7. The generated-page tells, answered

| Tell | Here |
| --- | --- |
| 1. Cream, serif display, terracotta | film base; one sans; four meaning colors, one meaning each, no accent |
| 2. Near-black with an acid accent | slate print; the bright thing is the Balance's ink |
| 3. Broadsheet | one column of plates, radii by role |
| 4. The SaaS-card kit | the stock's cards, shadows and 16 px radii go; no gradient |
| 5. Tracked capitals | none; the stock's uppercase labels go |
| 6. Middle-dot joins | commas and sentences |
| 7. Spaced em dash | none in the app's own text; the data's are shown as written |
| 8. Tinted near-black | ink `#0f1c23` as ink |
| 9. Monospace labels | none; `code` and the error box's face go |
| 10. Arrows on buttons | none, and none in `PROMPT.md` |
| 11. One accented word | none; the stock's `NOT` goes |
| 12. Labels above content | the key number's and the tiles' labels above their values, as HOUSE 11 sets them; labels beside values in rows |
| 13. Numbered markers | none |
| 14. Big number, small label, gradient | one 34 px key number per pane, its subject's own figure; no gradient |
| 15. Entrances, hover everywhere | none; the card's 120 ms fade answers a tap |

---

## 8. Where the record is

The art pass's change list (bugs B1 to B25 and items 1 to 19), the owner calls it left open, the
as-built departures and the phone checks are in `tools/DECISIONS.md`, which does not ship.
