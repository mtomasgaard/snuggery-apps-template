# World News: art direction

How the app looks, moves and speaks under the template's house system (`Template/HOUSE.md`; Running
Dashboard and Finances are the pane apps before it, whose frame this one follows). `NOTES.md` says
where the headlines come from and on what terms; `PROMPT.md` sets a copy up. The record of the pass (its
change list, the owner calls, the as-built departures, the phone checks) is in `tools/DECISIONS.md`,
which does not ship.

Figures were measured on 2026-10-02 on `data/snapshot.json` as committed (made 1 Oct 2026, 05:01 UTC;
sha256 `4a26ced7…749018409`). `python3 world-news/tools/art/palette.py` (from `Template/`) prints
every color figure and ends `ALL CHECKS PASS`. Screens were read in headless Chromium at 390 × 844,
the clock at 1 Oct 2026, 12:00 in Oslo: what the page draws, never how a phone feels.

---

## 1. The signature: the Datelines

**In one paragraph.** A dateline is the line a newsroom puts on a story to say when it was filed.
World News sets every headline's dateline on one scale at the head of each pane: six rows, one per
region in the file's order, and in each row one tick of ink per headline, placed by how long before
this file was made the story was published, on a logarithmic scale that runs from an hour at the
right to sixty days at the left (labels `1 h`, `6 h`, `1 d`, `7 d`, `60 d`). A desk that published
this morning has its ticks against the right edge; a desk whose feeds have gone quiet has them far to
the left. In this file Oceania has five headlines (four ticks) inside the last 15 hours and three alone at 16, 35 and
50 days; Europe's newest carries only a date, 29 Sep, so is 1 or 2 days old. A stranger remembers the ragged right edge: how fresh each
part of the world's news is, which the list alone hides under eight headlines that all look current.

**How it was found** (HOUSE 5.1):

1. *The specialist's picture.* A newsroom reads its feeds by desk and by time: the wire's log, the
   budget per desk, the dateline on every story. The data has no place line and no measure of
   importance; what every item carries is its desk (the region), its publisher and its published
   instant. Of those, only the instant is a measured quantity, and the age at the file's making is
   what the stock app spread over three unreadable forms (`12 h ago`, `Tue 02:00 AM`, `Sep 23`).
2. *What a person does most.* Opens the app, reads the first pane, switches region tabs, taps a
   headline out. The Datelines head every pane, so the eyes meet them first, and a tick is a way in:
   a tap scrolls the list to its story.
3. *What this data has that no other app has.* A daily file whose freshness varies by desk by a
   factor of 550 (2.2 hours to 50 days in this file), publishers that post at rates an order of
   magnitude apart (the pipeline makes them take turns), feeds that fail and are kept from an earlier
   run (`stale`), and stories filed under several regions. Moved to any other app, six rows of
   headline ages have nothing to draw. Set aside: a coverage map (the data has no places; a region is
   a desk, not a polygon), the publisher mix per region (three sources, a category bar any app could
   draw), the cross-filing (three stories today; a note, not a picture), a day-by-day grid (a
   contribution calendar, a generated-page pattern, and it crushes the last hours into one cell).
4. *The house's means.* `--ink` ticks on `--page`, `--ink-3` for the rows not chosen, `--line`
   hairlines, `--line-strong` for the scale, 10.5 px and 12.5 px labels, no motion.

**Against the apps before it.** US Quakes' record strip is one linear drum of thirty days with a stem
as tall as each magnitude; the Datelines are six rows on a logarithmic scale of age with every tick
the same height, and what they show is recency per desk, not size. Running Dashboard's Block and
Finances' Balance count things in blocks; Norne's Cut and Besseggen's Burn are time tracks of a
player; none is an index of ages.

**The rule it is drawn by** (`js/datelines.js`, pure; `tools/test_datelines.mjs` proves it):

- **Age** of an item = `generatedAt − published`, in hours, from the file alone (never the phone's
  clock, so the picture is the same on every phone and every day). Clamped to the scale's ends: under
  1 h is drawn at the right end, over 60 d at the left, and that end's label then prints open (`≤ 1 h`,
  `≥ 60 d`). An item published after the file was made (a feed's clock ahead) is under 1 h.
- **Scale.** `x = right − k × log2(age / 1 h)`, `k = plot width / log2(1440)`. The label column is the
  widest region name in the face at 12.5 px and 620, plus 10 px (73 px for `Middle East`); the plot is
  the rest of the pane's width less 6 px, at most 480 px. At 390 px: plot 279 px, 26.6 px a doubling
  (`6 h` at 69 px from the right, `1 d` at 122, `7 d` at 197). At 320 px: 209 px, 19.9 px a doubling.
- **Rows** 18 px apart, the region's name at the left in 12.5 px: `--ink` at 620 for the chosen
  region (every row on `All`), `--ink-2` at 400 for the others. Ticks 2 × 12 px in `--ink` on the
  chosen rows, `--ink-3` on the others. Vertical `--line` hairlines through all six rows at 6 h, 1 d
  and 7 d; under the rows a 1 px `--line-strong` baseline with 1 × 4 px `--ink-3` ticks and 10.5 px
  `--ink-2` labels, whose unit follows U+202F (`1 h`). Both end labels always print; a middle one that
  would come within 4 px of another (a plot narrowed by a long region name) is left out.
- **Ticks that touch.** Two or more headlines whose ticks would be under 3 px apart share one tick at
  the newest one's place, cut by 1 px page gaps into a part for each headline, up to four (Europe's two UN News
  stories of 23 Sep, both stamped 12:00 UTC by their feed, and a Global Voices story filed six hours
  before them are one tick in three parts). A tick takes an older headline only while it stands under
  3 px from the tick's own place, so no headline is drawn 3 px or more from its age (a run of near ages
  never chains). In this file the 48 headlines draw 39 ticks, 17 headlines sharing one, three parts at
  most, at 390 px and at 320 px. A part is never thinner than 2 px: past four headlines the tick is
  drawn in four parts and its count is printed beside it, 10.5 px `--ink-2` on a 3 px `--page` halo,
  drawn before the row's ticks so the halo never hides one.
- **Kept from an earlier run** (`stale: true`): the tick is hollow, a 1 px `--ink` outline 4 × 12 px
  (in a shared tick, each part by its own headline), so a desk whose feeds failed shows it by shape, and the pane says it in words.
- **A tap** (a click event, so a vertical swipe that starts on the Datelines scrolls the pane and
  selects nothing) picks the nearest tick within 22 px in the tapped row. On `All` or that region's
  pane, the list scrolls (instantly, never animated) to the story; on another region's pane, the tab
  of the tick's region is chosen first. The tick gets the track's tracer head, a 6 px ink disc in a
  1.5 px `--page` ring centered on the tick, inside its own row (a tick above or below at the same age,
  as UN News's noon stamps often are, stays clear), the story a 2 px
  ink rule in its left gutter and `aria-current="true"` on its link, until another tap or another pane. The live
  region says, once, with the month in words: `3 headlines at this age. Europe, 23 September:
  Zelenskyy urges stronger pressure on Russia, warns war's impact is spreading beyond Ukraine. UN News,
  7 or 8 days before the file was made.` A date-only stamp's age is spoken as the span of the UTC day
  its feed named (`7 or 8 days`; within two days of the file, `at most 1 day 5 hours`), never the
  hours its placeholder noon or midnight gives; a stamp with a time keeps them (`2 days 23 hours`). A
  shared tick picks its newest story, and its sentence opens with the count. The Datelines are a picture
  with a tap, not a set of buttons (the list is the way through for a keyboard and VoiceOver). A finger
  lands on a hidden layer (`aria-hidden`) over the image. The click listener is on their wrapper and acts
  only on the layer: VoiceOver's activation in WebKit finds that listener and clicks the image itself,
  which it passes over. Their 18 px rows are not hit targets in HOUSE 7.2's sense; nothing in them is a
  `button` named like a tab, so the camera's `Europe` stays the tab.
- **VoiceOver** reads the Datelines as one image (`role="img"`) labeled from the data, `Datelines.`
  and then a sentence a region, ages by the same rule: `Europe: 8 headlines, the newest 1 or 2 days and the oldest 15 days
  20 hours before the file was made.`, ending `; all kept from an earlier run` (or the count kept)
  where it applies, and `Oceania: no headlines.` for an empty region.
- **Caption** (the pane's caption line, two lines, fixed): `Ticks: each headline's age when this file
  was made, 1 Oct, 07:01, on a logarithmic scale. Tap one to find it.` On a region's pane `Ticks: each
  headline's age when this file was made, 1 Oct, 07:01; Europe in ink. Tap one to find it.` Where a
  hollow tick is drawn, the last sentence is `Hollow: from an earlier run.` Each form fits its two
  lines at 312 px wide, the house's 125 % text check. Test hook: `window.__wn.datelines()` returns the
  plot's geometry and every tick's x and headlines; `window.__wn.selected()` the picked headline.

**What About says it is not.** The age at the file's making, not now (the stamp says how old the file
is). Not importance: every headline is one tick. A tick's place is the feed's own time; 20 of the 48
headlines in this file carry a date and no time (UN News stamps all 14 of its stories 12:00:00 UTC;
6 of Global Voices' 25 are at 00:00:00 UTC), and they are drawn where the feed puts them. The scale is
logarithmic, so the step from 1 hour to 6 is as wide as the step from 1 day to 6. A story Global
Voices files under two regions is a tick in both rows.

---

## 2. Palette

This app has no data color. Its data is text and the Datelines are ink. The stock look's three hues
were chrome, not data, and they go: the accent blue (`#2f6df6` / `#6f9bff`: the chosen tab, links,
hover), the amber of cached and stale (`#a87400` / `#f2b322`) and the red of errors (`#c23b34` /
`#f07a72`). `palette.py --json` prints the house tokens as `style.css` declares them; `tools/check.mjs`
fails while the two differ.

**Chrome**: HOUSE 3.1's tokens as they are, both themes (ink on page 14.80 / 14.43; ink-3 on page 4.78
/ 5.88; highest chroma 0.0239 light, 0.0223 dark).

| | Light (film base) | Dark (the print) |
| --- | --- | --- |
| Ground | `--page` `#e8eef0`, L 0.945; notices and About on `--sheet` | `--page` `#141d21`, L 0.224 |
| The middle of the range | the scale's hairlines `--line` L 0.863; the other rows' ticks `--ink-3` L 0.515 | `--line` L 0.327; `--ink-3` L 0.676 |
| Signature | the chosen rows' ticks, `--ink` `#0f1c23`, L 0.218, opaque | `--ink` `#e6edee`, L 0.941, opaque |
| Lowest mark on the ground | 3.27, the scale's baseline (`--line-strong`); ticks not chosen 4.78 | 3.56; ticks not chosen 5.88 |

Each mark stands further from the page than the one before it, the ink furthest (palette check 2).
Where a tick crosses a hairline: ink on `--line` 11.47 / 10.36, ink-3 on `--line` 3.71 / 4.22. The
hairlines are quiet on purpose (1.29 / 1.39 on the page). Text: headlines `--ink`, source, date,
byline and summary `--ink-2` (6.61 / 7.76); a row held down takes `--ink` at 7 % (`#d9dfe2` /
`#232c2f`; headline 12.89 / 12.03, meta 5.76 / 6.47). The stock stamp and footer were 4.36:1 and its
`Terms` links 3.97:1 (palette section 6); every text pair here is 4.5 or more. No hue anywhere, so
no color-vision check applies: identity is words (the region names) and state is shape (hollow) and
words.

---

## 3. The chrome, object by object

HOUSE 4.0's *panes from a pull*, in Finances' frame: header, a pane scrolling inside itself, a fixed
caption band; no units key, key column, player, focus mode or opening. Not a view: the hero is a list
of headlines, so no focus mode (HOUSE 4.10). No time player: time is the Datelines' axis.

- **Header.** `<h1 translate="no">World News</h1>`, 15 px 650. The stamp, a `<button>` opening About
  (`aria-haspopup="dialog"`, its hint `hidden`, a 44 px hit): `Updated 07:01, 17 of 17 feeds
  answered` on the file's own day, `Updated 1 Oct, 07:01, …` after, `Stale. Updated 1 Oct, 07:01, …`
  past 30 hours (`REFRESH_HOURS`, unchanged), the word `Stale.` in `--ink`. The feed count is the
  file's `feeds[].ok`; without `feeds` the clause is left out. While loading: `Reading the
  headlines…`. A problem with the file never empties it once a file has been read. No units key:
  the app shows hours, days and dates and nothing to convert.
- **Tabs**: `All`, then the file's regions by `name`, `<button role="tab">` words at 12.5 px with the
  house tracer, 44 px tall, in one row that scrolls sideways inside itself (the chosen tab scrolled
  whole into view by setting the row's scroll, so the next Tab still starts at the stamp; focus rings
  inset 2 px), built after the snapshot parses. A tab's accessible name
  is exactly its visible word, always; a region kept from an earlier run says so through
  `aria-describedby` (`Kept from an earlier run: its feeds did not answer.`), never by a dot or by
  renaming the tab. The left and right arrow keys move between tabs, Home and End to the ends; the
  focused tab says its own name, so the live region adds nothing. The pane is
  `role="tabpanel"` labeled by the chosen tab. The app opens on `All` and stores nothing (no
  `localStorage`, as today).
- **The pane**: the Datelines first, then a statement where it applies (on a region's pane, and under
  each region's heading on `All`), then the stories. On `All`, a section per region headed 13.5 px 650 in the data's words (`Europe`), parted by
  hairlines. No cards, no surface under the list: rows on the page.
- **A story** is a row whose headline is its `<a>` (target `_blank`, `rel="noopener noreferrer"`, only
  `http(s)` addresses, as before), named by its own words and described by the source line
  (`aria-describedby`). The link's `::after` covers the row, so a tap anywhere opens the story, while
  the source line, byline and summary are text after it that VoiceOver reaches by swiping. In order: the headline, 13.5 px / 18 px, 560, `--ink`; the source
  line, 11.5 px / 16 px `--ink-2`, words joined by commas: `UN News, 23 Sep` where the feed gives a
  date (published exactly 00:00:00 or 12:00:00 UTC; the feed's UTC date), `Global Voices, 28 Sep,
  08:00` where it gives a time (the phone's zone, 24-hour, built by hand), the year added when it is
  not the phone's; then
  `, kept from an earlier run` in `--ink` where `stale`, and `, also under Middle East` where the same
  link is in another region; the byline on its own line, `By Elmira Lyapina`, when the feed names one;
  the summary, 12.5 px / 17 px `--ink-2`, when the feed gives one; each line at most 62 characters
  wide and a long word broken anywhere, so the page never scrolls sideways. Rows
  parted by `--line` hairlines, 10 px above and 11 below. A row held down: `--ink` at 7 %. No hover
  color. The selected story (from a tick): the 2 px ink rule in the gutter.
- **Statements**, sentences on the page, 13.5 px `--ink`, the first words at 620: `Europe's feeds did
  not answer on the last run: gv-western-europe, gv-eastern-europe and un-europe (HTTP 503). These 8
  headlines are kept from an earlier run.` When only some failed: `One of Europe's 3 feeds did not
  answer on the last run: …`, and the count of headlines kept. An empty region: `No headlines for
  Oceania on the last run, and none kept from an earlier one.` No badge, dot or color.
- **Caption band** (fixed, on `--page`, 16 px gutters): the caption line per pane (section 1), 11 px /
  15 px `--ink-2`, two lines below 640 px and one from 640; then the credits, 10.5 px `--ink-2`, built
  from the file's `sources[].name` in its order: `Headlines from Global Voices, The Conversation and UN
  News; terms in About.` The words around the names are the constant `check.mjs` pins; the shoot run
  checks the built line against its own read of the file. The full attribution and license lines
  are in About, word for word as the file gives them.
- **Readout card**: none. A tick's readout is its story in the list, which already holds everything
  the item has (a stated departure from HOUSE 4.7: a card would repeat the row it points at). The tap
  rule is the house's: a tap selects, a swipe scrolls.
- **About** (HOUSE 4.8), opened by the stamp: *What the Datelines are* (section 1, what they show and
  what they do not); *This data*, `label: value` lines: `Updated: Thu 1 Oct 2026, 07:01 (UTC+2)`,
  `Stale after: 30 hours`, `Regions: 6`, `Headlines: 48`, `Dates without a time: 20`, `Feeds: 17 of 17
  answered on the last run` (and each failed feed's id with its note), `In two regions or more: 3`; *Sources and credits*: per source, its name, then its `attribution` and `licence` lines
  word for word, then its terms address printed without its scheme and itself the link
  (`creativecommons.org/licenses/by/3.0/`); then the stock footer's two sentences as plain words
  (headlines, the publishers' own summary lines, bylines and links, nothing else copied; a tap on a
  story asks Snuggery to open it in Safari, on the publisher's own site); then `Type: ` and the face's
  credit; *How the data gets here*: a scheduled job in the repository reads the feeds once a day at
  05:20 UTC and writes `data/snapshot.json`; a Shortcut carries it to the phone; the app re-reads it
  when it returns to the screen and reaches no network.
- **Notices** (`role="alert"`, `--sheet`, 1 px `--line-strong` edge, 8 px radius, 13.5 px `--ink`, at
  most 300 px, centered) only for a file that cannot be used: `data/snapshot.json could not be read
  (HTTP 404).`; `… is not valid JSON; it looks like a web page or an error was written over it.`;
  `… is not the shape this app expects: it has no generatedAt, so its age cannot be told.` (each of
  `validate()`'s cases in plain words, field names without backticks), then one sentence: `In
  Snuggery, Options, then App Files shows what the file holds.` A broken replacement while open keeps
  the headlines and the stamp on screen and says so in a notice with `Close`. One polite live region
  (`<main>` loses `aria-live`). A return re-reads the file: the same `generatedAt` redraws only the
  stamp; a new file re-renders in place, keeping the pane and the scroll, and says `New headlines,
  updated 07:01.` once.
- **Motion.** The tracer (160 ms, `clip-path`) and About (220 ms in, out at once). Nothing else moves;
  the scroll to a story is instant. Under Reduce Motion every duration is 0 s.
- **A phone on its side**: a 46 px header row (name over stamp, tabs beside), a one-line caption band;
  the Datelines' plot stays at most 480 px. Safe areas as HOUSE 4.14.

---

## 4. Type

The house face byte for byte: `fonts/ysabeau-office-gw.woff2` (35 372 B, sha256 `fdf1a28c…cdb262`)
and `fonts/OFL.txt` (4 703 B, `d1adfffd…be6269`), the one `@font-face` rule word for word, the family
only through `--face`. **No supplement.** The app's own text needs nothing the cut lacks once the stock's
midline ellipsis and arrow leave (its help sentence becomes `Options, then App Files`; `PROMPT.md`'s
arrows become words). The data's characters today (é í ó – — ‘ ’ “ ” …) are all in the cut. Headlines change daily
and come from three publishers in several languages, so a character the cut lacks is set by the
system face through `--face`'s fallback (HOUSE 2.3 rule 3's exception, for a daily file):
`check.mjs` lists such characters in the current file as information, never as a failure. The system
stack, the `code` face and the uppercase eyebrows go. Scale: 10.5 / 11 / 11.5 / 12.5 / 13.5 / 15 px;
no 21 px figure (the subject is the headlines, and none of them is a number); weights 400, 560, 620,
650; no capitals, no letter-spacing. The SVG's text takes the page's face; the Datelines measure their
label column after `document.fonts.load('620 12.5px "Ysabeau Office"')`. The credit line word for word
in About (`Type: `) and `NOTES.md`.

---

## 5. The camera's strings

HOUSE 7.4: the camera waits for **a button named `Europe`** (built from the data's regions) and taps
**`Europe` and `Americas`** (`MarketingShotsUITests.swift` 347-353; `selectPane`,
`MarketingCameraCase.swift` 196-200, `app.buttons[name].firstMatch`).

| String | Role | Kept |
| --- | --- | --- |
| `Europe` | `<button role="tab">` | kept, built after the parse; its name is now `Europe` even when its feeds failed (the stock renamed it `Europe`, a spaced em dash and `cached headlines`, which the camera would not find) |
| `Americas` | `<button role="tab">` | kept |

Nothing else on the page is a button named `Europe` or `Americas`: the Datelines are one image, the
section headings are headings and the stories are links. The app stores no pane, so the camera has
nothing to put back. **The camera needs no change.** No string is British.

---

## 6. Budget

*Measured* 2026-10-02 by `node tools/check.mjs`: code as every shipped `.html`, `.css` and `.js`; the ZIP
built by `build-zips.yml`'s command (`zip -q -r -X … . -x '.*' '*/.*' 'screenshots/*' 'tools/*'
'pipeline/*' 'scripts/*' 'dist/*' 'raw/*'`), then its size.

| | Before the pass | As built | Cap |
| --- | --: | --: | --: |
| App code | 21 787 | 46 119 | 200 000, the house's |
| Fonts | 0 | 40 075 | 160 000 |
| ZIP | 27 445 | **86 948** | **88 000, the lead's ruling (2026-10-02, plan 0011 D30)**: D5's formula gave 72 140 (27 445 × 1.25 plus 37 834 for the face) until the build had measured 84 990 with nothing cut or minified; the face alone stores 37 510, more than the stock ZIP. The ZIP is within 5 % of it: 1 052 B left (HOUSE 8), so whatever the app gains, it pays for |
| Data | `data/snapshot.json` `4a26ced7…749018409` | the same, byte for byte | pinned by `check.mjs` |

**The ZIP is over D5's cap.** Stored in it, the face and its license take 37 510 B, the data 9 157, the
app code 17 737 (7 602 before the pass), this file about 10 500 and `NOTES.md` and `PROMPT.md`
10 346; this file's own size moves the last digits, and `node tools/check.mjs` prints the exact
figure. The formula leaves a 27 kB app about 14 000 B for its code and this file together; the house's
two modules, the stylesheet, About and the Datelines need more than that, as the art pass's simulation
foresaw (about 84 000 B).

---

## 7. The generated-page tells, answered

| Tell | Here |
| --- | --- |
| 1. Cream, serif display, terracotta | film base; one sans; no accent |
| 2. Near-black with an acid accent | slate print; the stock's blue goes; the bright thing is the Datelines' ink |
| 3. Broadsheet | one column, hairlines between stories and sections, radii by role |
| 4. The SaaS-card kit | the stock's white region cards with 14 px radii go; rows on the page |
| 5. Tracked capitals | none; `EUROPE`, `SOURCES` and `CACHED` go |
| 6. Middle-dot joins | commas (`UN News, 23 Sep`) and lines (`By …`); the stale stamp's middle dot goes |
| 7. Spaced em dash | none in the app's own text; the data's (license lines, headlines) as written |
| 8. Tinted near-black | ink `#0f1c23` as ink; the stock's `#0b0e13` ground goes |
| 9. Monospace labels | none; the notice's `code` face goes |
| 10. Arrows on buttons | none; the stock's arrowed help sentence becomes words, in the app and `PROMPT.md` |
| 11. One accented word | none; the stock's amber `cached` goes |
| 12. Labels above content | the eyebrow `SOURCES` goes; region names head their own stories |
| 13. Numbered markers | none |
| 14. Big number, small label, gradient | none: no figure larger than 15 px |
| 15. Entrances, hover everywhere | none; the stock's hover recolor of every headline goes |

---

## 8. Where the record is

The art pass's change list (bugs B1 to B16 and items 1 to 15), the owner calls it left open, the
as-built departures, the measured budget and the phone checks are in `tools/DECISIONS.md`, which does
not ship.
