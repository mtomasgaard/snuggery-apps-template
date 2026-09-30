# Data contract — what `Template/scripts/us_quakes/` writes, and what the app reads

The agreement between the pipeline and the app. Every shipped data file is described here: its
layout, units, frame, order and how to decode it. A script that changes a format changes this file in
the same commit. `../DESIGN.md` says what the app does with each file; `RESEARCH.md` says where every
source comes from and quotes its terms. Numbers marked *measured* were printed by
`design_measure.py` over the pipeline's cache on 2026-09-30 (§12 has the command and the output); the
pipeline re-measures them, and `verify.py` prints them. Numbers in the JSON examples are illustrative
unless marked *measured*.

## 0. Ground rules

- **Only earthquakes, only measured values.** A row is a catalogue event whose `type` is
  `earthquake` (the CSV's `type` column, the feed's `properties.type`). Explosions, quarry blasts,
  mining explosions, the 673 nuclear explosions, ice quakes, "other event", "not existing" and every
  other label are dropped and counted (§2.3). Nothing is interpolated, smoothed or typed in; a value
  the source does not give is written as "none", never as a default.
- **Binary is little-endian and headerless**, Milky Way's rule: `assets/history.bin` has a sibling
  `assets/history.json` that gives every section's `offset` (bytes), `type` and `count`. Every
  section starts at a multiple of 4 bytes (zero bytes pad the gap), so the app takes `TypedArray` views
  on the one `ArrayBuffer` without copying. Types: `uint8`, `uint16`, `uint32`, and `utf8` (bytes of
  UTF-8 text). The snapshot carries **the same sections** as base64 of zlib inside JSON (§3), so one
  decoder serves both.
- **The axis.** Longitudes are on one continuous axis from **172° to 296°**: a longitude below 172
  (the Americas, −180…−65) gains 360 (`common.unwrap_lon`; 172.5 → 172.5, −179 → 181, −150 → 210,
  −66 → 294). Latitudes 17°–72° N. Every coordinate in every file here is on this axis. Degrees,
  WGS 84 as the sources give them, on a sphere. **The basemap alone runs past the axis box** (§4.1,
  the lead's pass): `geo.json`'s land, lakes, coast, borders, states and depth bands reach 168° E–55° W
  and 25° S–81° N on the same axis, 168–172 written as they are (east of the date line, below the
  unwrap) and 296–305 for 64° W–55° W; in the app's world units X runs below 0 and past 0.3444 and Y
  below 0 and past 0.2453 for them. Events, places, faults, volcanoes, views and presets stay inside
  the axis box, and the event columns' codes (§1) cannot leave it.
- **Time.** Minutes since **1600-01-01T00:00:00Z**, UTC, proleptic Gregorian, truncated (not rounded)
  to the minute. ISO strings in JSON are UTC with a `Z`.
- **No URL in the app's own code.** `index.html`, `style.css` and `js/*.js` contain no `http://` or
  `https://`, not even in a comment. Addresses live in `assets/about.json`, `assets/stories.json`,
  `../CREDITS.txt`, the snapshot's `sources` (printed as text, never as links) and `tools/`.
- **Text** is UTF-8 in NFC, English (US spelling) for anything shown; no AI vendor or product names;
  no value reaches `innerHTML`.
- **Deterministic.** Static outputs are written through `common.write_json()` / `common.write_bin()`
  (sorted where stated, fixed float rounding, compact separators). No `today()`, no clock, no
  environment in any static output: the only dates are `common.RETRIEVED` (`'2026-09-30'`), the
  cutoff (an input, §9) and dates that are data. **Two builds from the same cache and cutoff give
  byte-identical `assets/` and `../CREDITS.txt`**. The snapshot is live and carries `generatedAt`.
- **Budgets are asserted before writing.** A step whose output would exceed its cap stops and writes
  nothing (§10); it never writes a trimmed or partial file.
- **Credits fragments.** Every build script writes `scripts/us_quakes/cache/work/credits/<step>.json`
  (not shipped): `{id, title, owner, source, url, licence, licence_quote, retrieved, adaptations,
  cite, attribution}` per source used. `build_about.py` builds `assets/about.json` and `../CREDITS.txt`
  from them.

---

## 1. The event columns — one layout for the history and the snapshot

Six fixed columns, one value per row, rows sorted ascending by **(time as the source gives it, to the
millisecond; then id)**:

| Column | Type | Code | Decode | Range | None | Worst decode error |
| --- | --- | --- | --- | --- | --- | --- |
| `t` | uint32 | `floor((time − 1600-01-01T00:00Z) / 60 s)` | epoch + t minutes | 0 … 4,294,967,295 | — | < 60 s early |
| `x` | uint16 | `round((λ′ − 172) / 0.002)`, λ′ on the axis | `λ′ = 172 + 0.002 x`; shown as `λ′ − 360` when λ′ > 180 | 0 … 62,000 | — | 0.001° |
| `y` | uint16 | `round((φ − 17) / 0.001)` | `φ = 17 + 0.001 y` | 0 … 55,000 | — | 0.0005° |
| `d` | uint16 | `round((depth_km + 5) × 100)`, **1500 only for an exact 10** (below) | `d / 100 − 5` km | 0 … 65,534 (−5.00 … 650.34 km) | 65,535 | 0.005 km; under 0.01 km for a depth moved off 1500 |
| `m` | uint8 | the magnitude text × 10, rounded **half up** as a decimal, + 20 | `(m − 20) / 10` | 0 … 254 (M −2.0 … 23.4) | 255 | none: the displayed tenth is exact |
| `f` | uint8 | bits 0–1 status, bits 2–7 magnitude type | below | | | exact |

- **Rounding** is on the source's decimal text, not its float: `Decimal(text) × 10`, `ROUND_HALF_UP`
  (so "2.45" → 2.5 and "4.349999999999999" → 4.3). 141 history rows carry float noise of up to 13
  decimals (`RESEARCH.md` §2.1); the rule handles them.
- **Out of range**: a depth outside −5 … 650.34 km or a magnitude below −2.0 is written as none and
  counted in the file's `outOfRange` (§2.2, §3.2). *Measured*: the history has depths −3.74 … 308.5 km
  and magnitudes 0.7 … 9.2, so none today.
- **`d` = 1500 means "10 km as the catalog lists it", and nothing else** (the lead's pass). A depth
  whose text is exactly 10 (`Decimal(text) == 10`: "10", "10.0", "10.000") is 1500; a depth that is not
  10 but would round to 1500 (9.995 up to, not including, 10.005) is written **1499** when below 10 and
  **1501** when above, the nearer of the two, so its decode is off by less than 0.01 km instead of
  0.005. `common.depth_code` is the rule; `build_history.py` and `refresh.py` both code with it, and
  `verify_static.py`, `verify_snapshot.py` and `tools/test_decode.mjs` each write it again and compare
  every depth code exactly. *Measured*: in the history, code 1500 on 23,759 rows = `counts.depth10km`
  (before the rule the file held 23,962: 203 measured depths of 9.995–10.003 km shared the code, now
  1499 or 1501); in the demo snapshot of 2026-09-30T23:17:42Z, 2,890 rows at exactly 10 km and 2 moved.
  So the app may say "At 10 km, as the catalog lists it" of a 1500 row (DESIGN §25).
- **`f`, status** (bits 0–1): 0 `reviewed`, 1 `automatic`, 2 `manual`, 3 anything else. Stored as
  given — the history's 2,975 automatic rows included (§2.3); the hollow rule is the app's (DESIGN §6).
- **`f`, magnitude type** (bits 2–7): an index into the file's own `magTypes` list — the distinct
  non-blank labels as the source spells them (case kept: `Md` and `md` are distinct labels in the
  catalogue), sorted by Python string order; **63 = blank**. At most 63 labels; a 64th stops the
  build. *Measured*: 33 non-blank labels in the history.
- **Region** is not stored: a row's box is the first of `conus, ak, hi, pr` whose inclusive bounds
  (`history.json.boxes`, on the axis) contain it.

**The text side table**: three more sections, for the rows whose id and place text are kept.

| Section | Type | Count | Meaning |
| --- | --- | --- | --- |
| `text_row` | uint32 | K | row indices, strictly ascending |
| `id_text` | utf8 | bytes | the K preferred ids joined by `\n` (no trailing newline) |
| `place_text` | utf8 | bytes | the K place strings joined by `\n`; an empty place is an empty line |

A newline inside an id or a place stops the build (none in the cache). Which rows are kept is each
file's rule: the history keeps **M 4.5 and up** (by the decoded tenth, `m ≥ 65`); the snapshot keeps
**every row at or after `liveFrom`, and M 4.5 and up before it**.

---

## 2. `assets/history.bin` + `assets/history.json`   (`build_history.py`)

### 2.1 Rows
From every window in `catalog-windows.json`, read from `cache/comcat/<box>/*.csv` after checking each
file's sha256 against the window's pin; box order `conus, ak, hi, pr`; de-duplicated by `id` (first
box wins; *measured* 0 duplicates); `type == earthquake`; `time < cutoff`. Two eras
(`sources.COMCAT['eras']`): before 1900 every event, magnitude or not; from 1900 M 2.5 and up.
*Measured*: **N = 385,076** rows, **K = 15,490** text rows; the first earthquake is 1638-06-11T19:00Z
"Central New Hampshire" (the cache's 1627 row is typed `not existing` and dropped).

### 2.2 Sections (offsets for the measured N, K and text sizes; `history.json` carries the actual ones)

| Section | Type | Count | Offset | Bytes |
| --- | --- | --: | --: | --: |
| `t` | uint32 | N | 0 | 1,540,304 |
| `x` | uint16 | N | 1,540,304 | 770,152 |
| `y` | uint16 | N | 2,310,456 | 770,152 |
| `d` | uint16 | N | 3,080,608 | 770,152 |
| `m` | uint8 | N | 3,850,760 | 385,076 |
| `f` | uint8 | N | 4,235,836 | 385,076 |
| `text_row` | uint32 | K | 4,620,912 | 61,960 |
| `id_text` | utf8 | 177,542 | 4,682,872 | 177,542 (+2 pad) |
| `place_text` | utf8 | 471,554 | 4,860,416 | 471,554 |

Total **5,331,970 bytes** (*measured* section sizes). The whole column block is one contiguous
4,620,912-byte span the app uploads to the GPU's column regions without touching (DESIGN §5.3).

### 2.3 `history.json`

```
{ "schema": 1, "file": "history.bin", "bytes": 5331970,
  "source": "comcat", "api": "2.7.0", "retrieved": "2026-09-30",
  "cutoff": "2026-01-01",                         // rows have time < cutoff; the refresh reads this
  "epoch": "1600-01-01T00:00:00Z",
  "eras": [ { "from": "1600-01-01", "to": "1900-01-01", "minMagnitude": null },
            { "from": "1900-01-01", "to": "2026-01-01", "minMagnitude": 2.5 } ],
  "type": "earthquake",
  "axis": { "lon0": 172, "dlon": 0.002, "lat0": 17, "dlat": 0.001, "unwrapBelow": 172 },
  "boxes": { "conus": { "name": "Lower 48", "west": 230, "east": 295, "south": 24, "north": 50 },
             "ak":    { "name": "Alaska", "west": 172, "east": 231, "south": 50, "north": 72 },
             "hi":    { "name": "Hawaii", "west": 199, "east": 206, "south": 18, "north": 23 },
             "pr":    { "name": "Puerto Rico", "west": 292, "east": 296, "south": 17, "north": 20 } },
  "codes": { "t": "minutes since epoch, truncated", "x": "(lon − 172) / 0.002, rounded",
             "y": "(lat − 17) / 0.001, rounded", "d": "(depth_km + 5) × 100, rounded; 1500 only for a depth of exactly 10, …; 65535 none",
             "m": "half-up tenth × 10 + 20; 255 none",
             "f": "bits 0-1 status index, bits 2-7 magTypes index (63 blank)" },
  "status": ["reviewed", "automatic", "manual", "other"],
  "magTypes": ["Mb", "Md", "Mfa", …],             // the 33 labels, Python-sorted
  "text": { "rule": "magnitude 4.5 and up", "rows": 15490 },
  "count": 385076, "first": "1638-06-11T19:00:00Z", "last": "2025-12-31T…Z",
  "counts": { "byBox": { "conus": …, "ak": …, "hi": …, "pr": … },
              "before1900": 625, "noDepth": 1492, "noMagnitude": 180,
              "depth10km": 23759, "automatic": 2975, "outOfRange": { "depth": 0, "magnitude": 0 } },
  "dropped": { "byType": { "explosion": …, "quarry blast": …, "nuclear explosion": 673, … },
               "duplicates": 0 },
  "provenance": { "catalog-windows.json": "<sha256>", "windows": 120 },
  "sections": { "t": { "offset": 0, "type": "uint32", "count": 385076 }, … } }
```
*Measured* where given: `before1900` 625, `noDepth` 1,492 (607 before 1900), `noMagnitude` 180 (all
before 1900), `depth10km` 23,759, `automatic` 2,975, 33 labels. Keys in this order; `write_json`
with `ndigits` 6.

### 2.4 Reference for the app's decoder test
`us-quakes/tools/ref/history_ref.json` (committed, not shipped): the six known events (§11.2) and
1,000 rows chosen by `numpy.random.default_rng(20260930).choice(N, 1000, replace=False)` sorted, each
with its row index and the **raw CSV strings** of `time, latitude, longitude, depth, mag, magType,
status, id, place`. `tools/test_decode.mjs` decodes `history.bin` with `js/data.js` and checks each
within the bounds of §1.

Budgets: `history.bin` ≤ 5,800,000; `history.json` ≤ 16,000; `history_ref.json` ≤ 250,000.

---

## 3. `data/snapshot.json`   (`refresh.py`; the only file the phone's Shortcut replaces)

### 3.1 Top level
```
{ "schema": 1, "app": "US Quakes",
  "generatedAt": "2026-09-30T14:07:12Z",          // when refresh.py ran (UTC)
  "cutoff": "2026-01-01",                         // history.json.cutoff on main when it ran
  "feed": { … },                                  // §3.4
  "fdsn": { … },                                  // §3.4
  "rows": { … },                                  // §3.2, §3.3
  "volcanoes": { … },                             // §3.5
  "sources": [ … ],                               // §3.7
  "ask": [ … ] }                                  // §3.6
```
Keys in this order. The app reads everything but `ask`.

### 3.2 `rows` — the same columns as the history
The same codes as §1, the depth rule included: `refresh.py` codes with `common.depth_code`, so 1500 is
the feed's or the FDSN answer's exact 10 and a depth that only rounds to it is 1499 or 1501.
Two parts in one sorted run: **M 2.5 and up** (`m ≥ 45`) from `from` (the cutoff minus one year:
2025-01-01) to `liveFrom`, from the FDSN event service; and **every magnitude** from `liveFrom`
(the feed's generation minute minus 30 days) to `to` (the feed's generation minute), from
`all_month.geojson`. Only rows inside the four boxes (the history's inclusive boxes) and of type
`earthquake`.

```
"rows": {
  "count": 30412, "epoch": "1600-01-01T00:00:00Z",
  "from": 222…, "liveFrom": 224…, "to": 224…,          // minutes since the epoch
  "liveFirst": 20710,                                  // index of the first row with t ≥ liveFrom
  "compression": "zlib", "encoding": "base64",         // every section below: base64 of RFC 1950
  "status": ["reviewed", "automatic", "manual", "other"],
  "magTypes": ["mb", "mb_lg", "md", "mh", "ml", "mun", "mw", "mwr", "mww"],   // this file's own list
  "columns": {
    "t": { "type": "uint32", "bytes": 121648, "data": "<base64>" },
    "x": { "type": "uint16", "bytes": 60824,  "data": "…" },
    "y": { … }, "d": { … }, "m": { "type": "uint8", … }, "f": { … } },
  "text": { "rule": "every row at or after liveFrom, and magnitude 4.5 and up before it", "rows": 9870,
    "text_row":   { "type": "uint32", "bytes": 39480, "data": "…" },
    "id_text":    { "type": "utf8", "bytes": 113220, "data": "…" },
    "place_text": { "type": "utf8", "bytes": 297114, "data": "…" } },
  "live": { … },                                        // §3.3
  "outOfRange": { "depth": 0, "magnitude": 0 } }
```
`bytes` is the section's size after inflating; the decoder allocates exactly that and refuses more
(Global Weather's capped inflate). The decoded `t` is sorted and `from ≤ t ≤ to` for every row; `m ≥
45` for every row before `liveFirst`.

### 3.3 `rows.live` — the feed's own extras, for rows `liveFirst … count − 1`
| Section | Type | Code | None |
| --- | --- | --- | --- |
| `felt` | uint16 | the feed's `felt` (number of felt reports), capped at 65,534 | 65,535 |
| `alert` | uint8 | PAGER `alert`: 1 green, 2 yellow, 3 orange, 4 red | 0 |
| `tsunami` | uint8 | the feed's `tsunami` flag, 0 or 1 | — |
| `sig` | uint16 | the feed's `sig` | 65,535 |
| `updated` | uint32 | the feed's `updated`, minutes since the epoch | — |

Each `{ "type", "bytes", "data" }` as above, `count − liveFirst` values. What each field means is
printed only from the quotes in `about.json.fields` (DESIGN §10.3).

### 3.4 `feed` and `fdsn`
```
"feed": { "file": "all_month.geojson", "generated": "2026-09-30T14:05:31Z",   // metadata.generated
          "api": "2.7.0", "features": 10520, "inBoxes": 9686, "earthquakes": 9684,
          "otherTypes": { "explosion": 76, "quarry blast": 133, … },   // in the boxes, not drawn
          "newest": "2026-09-30T13:58:12Z" },
"fdsn": { "queriedAt": "2026-09-30T02:23:10Z", "api": "2.7.0", "minMagnitude": 2.5,
          "from": "2025-01-01T00:00:00Z", "to": "2026-09-30T02:22:40Z",   // the feed's time when queried
          "queries": [ { "box": "conus", "start": "…", "end": "…", "count": 4685, "rows": 4685 }, … ],
          "kept": 19620, "replacedByFeed": 0, "belowFloor": [ids] }   // rows before liveFrom; see below
```
The FDSN part is queried once a day up to the feed's time **at the query**, so it covers every later
hour's `[from, liveFrom)`; rows at or after `liveFrom` are dropped from it (the feed has them).
*Measured* 2026-09-30: `features` 10,526, `inBoxes` 9,694, `earthquakes` 9,471; FDSN counts conus
4,685, ak 13,191, hi 509, pr 2,379.

### 3.5 `volcanoes` — status only; positions and names are in `geo.json` (§4.6)
```
"volcanoes": { "readAt": "2026-09-30T14:07:10Z", "ok": true, "endpoint": "getMonitoredVolcanoes",
  "monitored": [ { "vnum": "311120", "alert": "WATCH", "color": "ORANGE",
                   "sent": "2026-09-12T19:41:00Z", "noticeType": "VAN" }, … ] }   // in boxes, sorted by vnum
```
If the API fails, changes shape, or answers with a label outside the lists, `refresh.py` copies the
previous snapshot's block unchanged (its `readAt` stays old, so the app says "as of"); with no
previous block, `"ok": false, "monitored": [], "error": "<reason>"` and the app draws every
triangle hollow with its sentence (DESIGN §10.1). `alert` ∈ NORMAL, ADVISORY, WATCH, WARNING;
`color` ∈ GREEN, YELLOW, ORANGE, RED (`sources.VOLCANOES`); a written block with anything else
fails the run. `sent` is the time of the volcano's **latest notice** (`sent_utc`), not when its
level began; `null` when the API gives none. *Measured* (research): 63 monitored in the boxes.

### 3.6 `ask` — at most 200 flat rows for Snuggery's Ask
Plain keys, one `kind` per row, numbers in SI, times ISO UTC; every number is the decoded value the
app shows (magnitude to the tenth, depth to 10 m), so an answer and a tap agree. Order: summaries,
events, volcanoes, the volcano summary, notes.
- `"summary"` — 15 rows, each box and all four (`"All four regions"`), for the past day, 7 days and
  30 days back from the feed's minute (`t ≥ to − k × 1440`, the app's windows): `{kind, box, window,
  earthquakes, m25Plus, m4Plus, largestMagnitude, largestPlace, largestTimeUtc}`; `m25Plus` and
  `m4Plus` count decoded codes ≥ 45 and ≥ 60.
- `"event"` — the largest earthquakes of the last 30 days, taken **round-robin across the four
  boxes** by magnitude (then newest first) so every region's largest are there, filling the rows
  left: `{kind, timeUtc, box, within, magnitude, magType, depthKm, place, status, felt, tsunami,
  pagerAlert, id}`; `box` is the region's name, `within` "past day" / "past 7 days" / "past 30
  days", `timeUtc` to the second.
- `"volcano"` — each monitored volcano above NORMAL/GREEN: `{kind, name, vnum, alertLevel,
  aviationColor, noticeSentUtc, alertLevelMeaning, observatory, statusReadAt}`;
  `alertLevelMeaning` is `about.json.volcanoLevels`' USGS quote. One `"volcanoSummary"`:
  `{kind, statusReadAt, statusAvailable, monitored, normal, advisory, watch, warning, notMonitored}`
  (the counts `null` when `statusAvailable` is false: unknown, not zero).
- `"note"` — three rows: not a warning service (and only as new as `generatedAt`); the boxes are
  not borders, with their bounds; the tsunami flag's meaning, quoted from `about.json.fields`.
*Measured* 2026-09-30: 200 rows (15 summaries, 178 events, 3 volcanoes, 1 summary, 3 notes),
≈ 56,300 B.

### 3.7 `sources` — drives the on-screen credit for the live data
```
[ { "id": "feed", "name": "USGS earthquake feed (all_month, GeoJSON summary)", "owner": "U.S. Geological Survey",
    "licence": "Public domain (US Government work); USGS asks for credit",
    "attribution": "Earthquakes: U.S. Geological Survey, ANSS Comprehensive Earthquake Catalog (ComCat), doi:10.5066/F7MS3QZH; rounded and repacked.",
    "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",   // text, never a link
    "readAt": "2026-09-30T14:05:31Z" },
  { "id": "comcat", … "readAt": "<fdsn.queriedAt>" },
  { "id": "volcanoes", …, "attribution": "Volcano status: USGS Volcano Hazards Program.", "readAt": "<volcanoes.readAt>" } ]
```
`attribution` strings are `sources.py`'s, verbatim; `licence` is `sources.CREDIT`'s. The static
sources are in `assets/about.json`.

### 3.8 Size
Estimate from measured parts (§12): the two-year M 2.5+ part at its largest (≈ 24,000 rows in
December) ≈ 255,000 B of base64; 10,000 live rows' columns ≈ 107,000 B, ids 48,356 B, places
62,084 B, extras ≈ 27,000 B; `ask` ≈ 45,000 B; the rest ≈ 15,000 B: **≈ 560,000 bytes**. Cap
**1,500,000** (refresh asserts); a 30-day swarm of 30,000 rows would add ≈ 330,000 B.
*Measured* on the first real snapshot (2026-09-30T16:51:54Z feed, 29,091 rows: 19,620 M2.5+ from
2025-01-01 and 9,471 live): **533,512 B**, 362,351 B as the ZIP stores it; columns 302 KB of base64,
text table 126 KB, `ask` 56 KB.

### 3.9 How `refresh.py` builds it (hourly; standard library + `requests`)
1. Read `cutoff` from `us-quakes/assets/history.json` in the checkout; `from` = cutoff − 1 year.
2. GET `all_month.geojson`; check `metadata.api == "2.7.0"`, every feature carries the 26 property
   names of `sources.FEEDS['properties']`, geometry is `[lon, lat, depth]`; else fail.
3. Keep features with `type == "earthquake"` inside the boxes (unwrapped); `liveFrom` = generated
   minute − 30 × 1440.
4. The M 2.5+ part: the cached FDSN answers in `scripts/us_quakes/cache/live/` (the workflow's
   `actions/cache` carries them between runs), if their marker `live-marker.json` is under 24 h old,
   has this `from`, ends at or after this `liveFrom`, and every file matches its sha256; otherwise
   query FDSN per box (per calendar year, then month, when a box's count reaches 18,000) for
   `[from, the feed's time)`, `minmagnitude=2.5`, `eventtype=earthquake`, count first, one request a
   second, rows == count (asked again up to three times, then fail). Keep the rows with `t <
   liveFrom` and a preferred magnitude ≥ 2.5. `--prev` (the published snapshot) lends only its
   volcano block.
5. Merge, sort by (time, id), de-duplicate by id: a feed row wins over an FDSN row that shares any of
   its `ids` (the feed lists every id an event has had).
6. Volcanoes (§3.5), `ask` (§3.6), `sources` (§3.7).
7. Validate (§11.3); write only if every check passes (`write_json` keeps the old `generatedAt` when
   nothing else changed). `--ref` also writes `us-quakes/tools/ref/snapshot_ref.json` (the first 250
   and the last 250 rows' source values, so the live part and its extras are tested too, for
   `test_decode.mjs`). `verify_snapshot.py` then checks the written file again, independently.

The demo snapshot on `main` (what the ZIP ships) is written by the same script during the yearly
build.

---

## 4. `assets/geo.json`   (`build_geo.py`)

### 4.1 Frame and encoding
```
{ "schema": 1, "retrieved": "2026-09-30",
  "axis": { "west": 172, "east": 296, "south": 17, "north": 72, "unwrapBelow": 172 },
  "basemap": { "west": 168, "east": 305, "south": -25, "north": 81 },     // the lead's pass; see below
  "polyline": { "algorithm": "Google encoded polyline, longitude first", "factor": 1000 },
  "land": […], "lakes": […], "coast": […], "borders": […], "states": […],
  "bathymetry": […], "places": […], "faults": {…}, "volcanoes": […],
  "relief": […], "views": […], "sections": […], "sources": [ids] }
```
**The basemap's extent** (the lead's pass): land, lakes, coast, borders, states and the depth bands are
clipped to `basemap`, 168° E–55° W and 25° S–81° N (in own longitudes [168, 180] and [−180, −55]), not
to the axis box, so that every region chip's framing on a phone is map to its edges; the app holds its
view inside `basemap` and hatches past it (DESIGN §4.2, §25). They are simplified by zone, in one pass
per ring (`common.simplify(…, scale=)`): the thresholds of §4.2–4.3 across the axis's width (172–296)
from 14° to 75° N; ten times them elsewhere from 5° to 84° N; eighty times south of 5° N; a band's
ring is dropped under 50 km² times the finest zone it touches. Places, faults, volcanoes, views and
presets are on the axis box, as below. A reader without `basemap` (an older file) uses `axis`.

Every line or ring is one polyline string (`common.encode_line`, factor 1000 = 3 decimals, ≈ 0.1 km),
on the axis. **The date-line seam**: a geometry is first clipped in its own longitudes to the two
boxes [172, 180] and [−180, −64] (× [17, 72]), then the second part is unwrapped (+360); a ring or
line never crosses 180 inside the file. Rings are closed (last = first). Simplification is
Visvalingam–Whyatt (`common.simplify`, minimum triangle area in m² on a local equirectangular
frame). Arrays keep the source's feature order unless stated.

### 4.2 Basemap (Natural Earth 1:50m, pinned in `sources.STATIC`)
| Key | Source | Geometry | VW threshold | *Measured* pieces · vertices · JSON · deflated |
| --- | --- | --- | --: | --- |
| `land` | `ne_50m_land` | rings, filled even-odd | 250,000 m² | 273 · 13,308 · 50,844 · 35,527 |
| `coast` | `ne_50m_coastline` | lines | 250,000 m² | 289 · 13,318 · 50,980 · 35,599 |
| `lakes` | `ne_50m_lakes` | rings | 250,000 m² | 223 · 8,104 · 30,291 · 20,490 |
| `states` | `ne_50m_admin_1_states_provinces_lines` | lines | 250,000 m² | 149 · 2,633 · 10,611 · 7,154 |
| `borders` | `ne_50m_admin_0_boundary_lines_land` | lines | 250,000 m² | 9 · 521 · 2,026 · 1,457 |

(Measured with the seam-crossing pieces skipped instead of split; the build splits them, which adds a
few pieces.)

### 4.3 `bathymetry` (Natural Earth 1:10m, the only scale with depth bands)
`[{ "depth": 200, "rings": […] }, { "depth": 1000, … }, … { "depth": 7000, … }]` — shallowest first;
each band is the sea **deeper than** `depth`, so they nest and the app paints them in array order.
Rings simplified at 5,000,000 m² and dropped under 50 km². *Measured*: 3,307 rings, 76,518 vertices,
307,615 B JSON, 206,172 B deflated.

### 4.4 `faults` (Quaternary Fault and Fold Database, GDB layer `Qfaults_2020` read with pyogrio)
Features grouped by **(fault_id, section_id, age, slip_rate, class, linetype)**; the group's lines,
each simplified at **50,000 m²**, are concatenated into one polyline string (the first vertex of a line
is a delta from the previous line's last) with a per-line vertex count.
```
"faults": { "simplify_m2": 50000, "factor": 1000,
  "ages": ["historic", "latest Quaternary", "late Quaternary", "middle and late Quaternary",
           "undifferentiated Quaternary", "class B", "unspecified"],
  "slipRates": ["Greater than 5.0 mm/yr", "Between 1.0 and 5.0 mm/yr", "Between 0.2 and 1.0 mm/yr",
                "Less than 0.2 mm/yr", "Unspecified", "Insufficient data", …, ""],
  "lineTypes": ["Well Constrained", "Moderately Constrained", "Inferred"],
  "classes": ["A", "B", "C", ""],
  "names": ["…"], "sections": ["…"], "senses": ["…"],        // sorted string tables
  "groups": [[nameIx, sectionIx, ageIx, slipIx, senseIx, lineIx, classIx, reviewYear], …],
  "counts": [[n1, n2, …], …],                                 // vertices per line, per group
  "lines": ["<polyline>", …] }                                // one per group
```
Labels are the database's own, trimmed; the 282 "Late Quaternary" join "late Quaternary"; `None`,
blank and whitespace become `""`; any label not in these lists is appended at the end (and printed).
`reviewYear` is the year of `last_review`, 0 when absent (1,069 rows, the 2025 additions among them).
Groups are sorted by (name, section, then the label indices). `fault_url` is not shipped (the search
it points at is retired, `RESEARCH.md` §2.4). *Measured*: 112,944 features, 5,816 groups, 113,301
lines, 994,427 → 278,038 vertices; lines + counts 929,231 B JSON (473,455 deflated); tables: names
2,111 (60,779 B), sections 428 (9,986 B), senses 18 (243 B), groups 140,730 B; **1,140,969 B raw,
513,053 B deflated** in all.

### 4.5 `places`
Natural Earth 1:50m populated places (simple) inside the axis box: *measured* 189 (111 United States,
38 Canada, 25 Mexico, …). `[{ "n": name, "lon", "lat", "r": scalerank, "a1": adm1name, "c": adm0name }]`
sorted by (scalerank, −pop_max, name). Used for labels and the computed "near" line (DESIGN §8.3).

### 4.6 `volcanoes` (the static list)
From the committed `scripts/us_quakes/samples/volcano-getUSVolcanoes.json` (retrieved 2026-09-30; its
sha256 recorded in `about.json` sources), the entries inside any of the four boxes: *measured*
(research) 148 of 170.
`[{ "vnum", "name", "lon", "lat", "elev_m", "threat", "obs" }]`, sorted by vnum; `threat` is
`nvews_threat` verbatim ("" when blank or "Waiting for Threat Level"). `volcano_url` and
`volcano_image_url` are not shipped. Refreshing the list is a deliberate act (re-save the sample).

### 4.7 `relief` — one entry per JPEG (§5)
`[{ "key": "conus", "file": "relief-conus.jpg", "width": 4096, "height": 2192, "west": 232.0,
"east": 295.0, "south": 23.5, "north": 50.0, "neutral": 217.8, "lo": 166, "quality": 75 }, …]`.
Bounds are the **server's reported extent** (§5.2), converted to degrees on the axis, 6 decimals.

### 4.8 `views` — the region chips
`[{ "key": "lower-48", "label": "Lower 48", "west": 235.0, "south": 24.3, "east": 293.1, "north": 49.5 }, …]`
in DESIGN §4.4's order and boxes, longitudes on the axis (Alaska: 172.0 … 230.5).

### 4.9 `sections` — the four presets
```
[ { "key": "cook-inlet", "label": "Cook Inlet", "a": [213.2, 59.0], "b": [205.8, 63.2], "highlight": "ak018fcnsk91" },
  { "key": "aleutians", "label": "Aleutians", "a": [183.4, 50.2], "b": [183.4, 53.8] },
  { "key": "cascadia", "label": "Cascadia", "a": [232.6, 47.3], "b": [239.4, 47.3] },
  { "key": "hawaii", "label": "Hawaii", "a": [203.8, 18.7], "b": [205.6, 20.4] } ]
```
`[lon, lat]` on the axis.

### 4.10 Size
*As built by the lead's pass* (the basemap to 25° S–81° N, 168° E–55° W): **1,851,803 B raw, 987,085 B as
the ZIP stores it** (`verify_static.py`); the basemap's keys 673,536 B raw (land 76,280, coast 75,724,
lakes 31,170, states 12,166, borders 6,665, bathymetry 471,531). The design-stage estimate follows.
Basemap 144,752 + bathymetry 307,615 + faults 1,140,969 (*measured*) + places, volcanoes, relief,
views and sections ≈ 27,000 (*estimate*) ≈ **1,620,000 B raw, ≈ 832,000 B in the ZIP**. Cap
1,900,000 raw.

---

## 5. `assets/relief-{conus,ak,hi,pr}.jpg`   (`build_relief.py --relief`; committed)

### 5.1 Processing, per region
1. Read the pinned hillshade PNG (grey) and the pinned Int16 elevation TIFF of the same box and size
   (`sources.RELIEF_PINS`, `RELIEF_DEM_PINS`). Alaska: stitch `ak-west` (555 px) and `ak-east`
   (3541 px) side by side, 4096 × 3309.
2. **Mask**: a pixel is land when its elevation is neither 0 nor −32768. Rasterise Natural Earth's
   1:50m lakes into the same Mercator pixel grid (Pillow `ImageDraw.polygon`) and treat them as
   not land. Not-land pixels are set to **242**, the hillshade's flat-ground grey.
3. **Stretch** (display): `lo` = the 0.5th percentile of the land pixels;
   `v′ = clip((v − lo) / (255 − lo) · 255)`; `neutral = (242 − lo) / (255 − lo) · 255` (1 decimal).
4. Alaska only: resize to 0.75 (Lanczos), 3072 × 2482.
5. JPEG, grey (one channel), quality 75, `optimize=True`, no metadata.

### 5.2 Georeferencing — measured, not assumed
`exportImage` may widen the requested box to the requested pixel aspect. The build asks each export
once more with `f=json`, records the returned `extent` (EPSG 3857 metres), and writes **those**
bounds (converted to degrees on the axis) into `geo.json.relief`. Gate: Natural Earth 1:50m land
rasterised into each image's grid by those bounds agrees with the elevation mask on ≥ 0.95 of the
pixels (cos-latitude weighted), and the agreement is strictly highest at zero shift among shifts of
±2 and ±5 px in each axis; `verify.py` prints the table.

### 5.3 Files (*measured* bytes at q75, §12)
| File | Pixels | Requested box (W, S, E, N, degrees) | Land px | `lo` | neutral | Bytes | Cap |
| --- | --- | --- | --: | --: | --: | --: | --: |
| `relief-conus.jpg` | 4096 × 2192 | −128, 23.5, −65, 50 | 6,058,098 | 166 | 217.8 | 942,611 | 1,050,000 |
| `relief-ak.jpg` | 3072 × 2482 | 172, 50, −129, 72 | 4,724,421 | 142 | 225.7 | 635,849 | 720,000 |
| `relief-hi.jpg` | 2048 × 1458 | −160.5, 18.5, −154.5, 22.5 | 182,644 | 85 | 235.5 | 43,668 | 60,000 |
| `relief-pr.jpg` | 2048 × 801 | −68, 17.5, −64.5, 18.8 | 286,350 | 126 | 229.3 | 84,413 | 100,000 |

Total **1,706,541 B** (JPEG does not deflate further). Land pixel counts are before the lake mask.
The shipped JPEGs are committed; the yearly build never refetches relief.

---

## 6. `assets/stories.json`   (`build_about.py`, from `scripts/us_quakes/content/stories.yaml`)

```
{ "schema": 1,
  "stories": [ {
      "id": "cascadia-1700", "title": "Cascadia, 1700", "when": "1700-01-27",
      "view": "pacific-northwest",                   // a views key
      "window": { "kind": "stub" | "month" | "year" | "decade", "start": "1700" | "2019-07" | "1906" | "2010" },
      "floor": 2.5 | 4 | 5 | 6,
      "anchors": ["official17000127050000000"],      // ids in the history's (or snapshot's) text table
      "text": "…",                                   // ≤ 70 words
      "numbers": { "magnitude": "9", "year": "1700", … },   // every numeral in text, with where it came from
      "sources": ["usgs-cascadia-1700", "comcat"],
      "play": { "from": "2019-07-01", "to": "2019-08-01", "step": "day" } } … ],   // optional (ART.md, "Playing a sequence")
  "sources": [ { "id": "usgs-…", "title": "…", "owner": "U.S. Geological Survey", "url": "…",
                 "retrieved": "2026-…", "quote": "…" } ] }
```
The seven stories and their anchors are DESIGN §7.6 (anchors *measured* in the cache). The build
checks: every anchor id is in a text table with the magnitude, time and depth the text quotes; every
numeral in `text` is a key of `numbers` whose value the build recomputed (from a catalogue row or a
count over `history.bin`, e.g. Oklahoma's M 3+ per year in the chip's box: 4 in 2008, 888 in 2015,
6 in 2025, *measured*); every sentence's claim beyond the catalogue has a `quote` saved in
`credits/usgs-statements.txt`. `play`, where present, is a
cumulative sequence the app steps through (DESIGN §7.6): `from` < `to` (UTC dates), `step` "day" or
"week", at most 62 steps; while it plays, the window is `[from, from + k·step)`. Three stories carry
one: 1964 Alaska (1964-03-27 → 1964-05-01, day), 2018 Kīlauea (2018-04-30 → 2018-09-01, week), 2019
Ridgecrest (2019-07-01 → 2019-08-01, day). Budget ≤ 30,000.

## 7. `assets/about.json`   (`build_about.py`, from `content/about.yaml` and the credits fragments)

```
{ "title": "About US Quakes", "version": "1.0", "retrieved": "2026-09-30",
  "intro": "…",                                        // opens with the not-a-warning sentence
  "reading": [ { "id": "sizes", "title": "…", "text": "…" }, … ],
  "notes": [ { "id": "more-instruments", "title": "…", "text": "…", "quote": "…", "source": "usgs-faq-rates" }, … ],
  "notShown": { "title": "What this app does not show, and why", "text": "…" },
  "fields": { "status": {…}, "felt": {…}, "tsunami": {…}, "alert": {…} },     // quoted meanings (DESIGN §10.3)
  "magTypeNames": { "mw": { "name": "…", "quote": "…" }, … },                // only quoted ones
  "faultAges": { "latest Quaternary": { "bounds": "…", "quote": "…" } | null, … },
  "volcanoLevels": { "WATCH": {…}, "ORANGE": {…}, … },
  "eventPage": "earthquake.usgs.gov/earthquakes/eventpage/{id}",           // printed as text
  "numbers": { "history": 385076, "before1900": 625, "noDepth": 1492, "nuclear": 673, … },  // every number the notes quote
  "sources": [ { "id": "comcat" | "relief" | "qfaults" | "volcano-list" | "naturalearth", "title", "owner",
                 "licence", "licence_quote", "source", "url", "retrieved", "adaptations", "cite", "attribution" } ],
  "software": { "text": "No third-party code ships with this app. …", "fonts": "Atkinson Hyperlegible … Red Hat Mono … SIL Open Font License 1.1 (fonts/OFL.txt)." } }
```
The honesty notes are DESIGN §10.2; their numbers come from `numbers`, never typed. A field whose
quote is missing is `null` and the app shows the bare value (DESIGN §10.3). Budget ≤ 40,000.

## 8. `../CREDITS.txt`   (`build_about.py`)
Plain text, 100 columns: a heading ("US Quakes — credits and licenses"), how the data was obtained,
then one block per source (ComCat and the feed, 3DEP relief, the Quaternary Fault and Fold Database,
the Volcano Hazards Program, Natural Earth): TITLE, Owner, Source (file names and sha256, or the
service and its API version), URL, License and the quote from `credits/`, Retrieved, Adaptations
("rounded to the minute, 0.002°/0.001°, 10 m and a tenth of magnitude; earthquakes only; repacked";
"hillshade levels stretched, masked to land, re-encoded as JPEG"; "grouped, simplified at 50,000
m², rounded to 3 decimals"; …), Cite (ComCat doi:10.5066/F7MS3QZH; faults doi:10.5066/P9BCVRCK with
the access date), the attribution line each owner asks for. Then the fonts block (ART.md "Type"): Atkinson
Hyperlegible, "Copyright 2020 Braille Institute of America, Inc."; Red Hat Mono, "Copyright 2024 The
Red Hat Project Authors (github.com/RedHatOfficial/RedHatFont)"; both under the SIL Open Font
License 1.1, whose text ships as `fonts/OFL.txt`; the five file names; "unchanged from the Fontsource
packages @fontsource/atkinson-hyperlegible@5.2.8 and @fontsource/red-hat-mono@5.3.0".
Budget ≤ 40,000.

As built (2026-09-30, QA pass): the app's own words here and in `about.json` / `stories.json` are in US
spelling ("catalog", "color", "gray", "License:"); quotations, titles and the JSON keys (`licence`,
`licence_quote`, the reading ids `colours` and `grey`) are unchanged. `build_about.py` respells the two
British words that reach it from the build steps' credits fragments ("the catalogue's type", "grey JPEG").

---

## 9. Determinism and the cutoff

`build_all.sh --cutoff 2026-01-01` twice from the same cache gives byte-identical `assets/*` and
`CREDITS.txt` (`shasum -a 256` over both trees, printed). The cutoff is the build's one input: the
January workflow passes the new year's first day; `fetch_catalog.py` then fetches only the windows
the new year adds (older windows are closed and cached for good). `RETRIEVED` moves with a deliberate
cache refresh, not with the cutoff. The relief is not rebuilt by `build_all.sh` (only by
`build_relief.py --relief`).

## 10. Budgets

| File | Cap (bytes) | Expected |
| --- | --: | --- |
| `history.bin` / `history.json` | 5,800,000 / 16,000 | 5,331,970 (*measured* sections) / ≈ 6,000 |
| `relief-conus/ak/hi/pr.jpg` | 1,050,000 / 720,000 / 60,000 / 100,000 | 942,611 / 635,849 / 43,668 / 84,413 (*measured*) |
| `geo.json` | 1,900,000 | 1,851,803 (*measured*, the lead's pass, §4.10) |
| `stories.json` / `about.json` | 30,000 / 40,000 | *estimate* |
| **`assets/` as stored in the ZIP** | **6,000,000** | 5,851,793 (*measured*, the lead's pass; headroom 148,207) |
| `data/snapshot.json` | 1,500,000 | ≈ 560,000 (§3.8) |
| `../CREDITS.txt` | 40,000 | *estimate* |
| app code (`index.html`, `style.css`, `js/*.js`) | 150,000 | *estimate* (DESIGN §13) |
| **The ZIP** (`tools/check.mjs`) | **8,000,000** | ≈ 6,400,000 |

## 11. Validation — fail loudly, write nothing

### 11.1 `build_history.py` / `verify.py`
1. **Counts against the service.** For each box and era, a fresh `count` (all event types, the same
   box, `endtime` = cutoff) against the cached rows of that box and era: |Δ| ≤ 0.5 % (USGS adds,
   revises and deletes after a window is cached). And exactly: shipped rows per box = the cache's
   `earthquake` rows per box (nothing lost in packing); dropped rows per type printed.
2. **The six known events survive the round trip** (§11.2): each found by id in the text table, each
   decoded value within §1's bounds of its CSV row, 2018 Anchorage at 46.70 ± 0.005 km, 1964 at M 9.2
   with status automatic, 1700 and 1811 with no depth.
3. **Every row** decoded against its CSV row within §1's bounds (all 385,076), the order (time, id)
   strictly increasing, `t < cutoff`, codes in range, `text_row` exactly the rows with `m ≥ 65`, ids
   and places equal.
4. The section offsets and sizes match `history.json`; each section 4-aligned; no bytes after the last.
5. **Geo**: every polyline decodes, the basemap's vertices inside `basemap` (which holds the axis box)
   and every other vertex on the axis box; fault counts sum to each group's
   decoded vertex count; 148 volcanoes; the relief georeferencing gate (§5.2); every view and preset
   inside the axis; each preset holds ≥ 300 events within ±50 km at M 2.5+ over all years (*measured*
   minimum 714, Cascadia).
6. **Stories** (§6) and **About** numbers recomputed.
7. Budgets (§10); two-build byte identity (§9).

### 11.2 The six known events (*measured* in the cache, `RESEARCH.md` §2.1)
| Event | id | time (UTC) | lat, lon | depth | mag |
| --- | --- | --- | --- | --- | --- |
| 1700 Cascadia | `official17000127050000000` | 1700-01-27T05:00 | 45, −125 | none | 9 mw |
| 1811 New Madrid | `official18111216081500000` | 1811-12-16T08:15 | 36, −89.96 | none | 7.5 mw |
| 1906 San Francisco | `official19060418131226300_12` | 1906-04-18T13:12:26.3 | 37.75, −122.55 | 11.7 | 7.9 mw |
| 1964 Prince William Sound | `official19640328033616_30` | 1964-03-28T03:36:16 | 60.908, −147.339 | 25 | 9.2 mw, automatic |
| 2018 Anchorage | `ak018fcnsk91` | 2018-11-30T17:29:29.33 | 61.3464, −149.9552 | 46.7 | 7.1 mw |
| 2019 Ridgecrest | `ci38457511` | 2019-07-06T03:19:53.04 | 35.7695, −117.5993 | 8 | 7.1 mw |

### 11.3 `refresh.py`, every run
1. The feed: `metadata.api` 2.7.0; the 26 properties on every feature; geometry of three numbers.
2. The FDSN service (when queried): `GET /version` 2.7.0; every query's rows == its count.
3. **The newest in-box earthquake is under 6 h older than `feed.generated`** (*measured* rate ≈ 320
   a day in the boxes, so a 6 h silence means a broken feed, not a quiet Earth).
4. Rows sorted by (time, id); no id twice; `m ≥ 45` before `liveFirst`; every code in range; decoded
   values within §1's bounds of their source values (all rows).
5. Volcano labels in the known lists (§3.5).
6. `ask` ≤ 200 rows; the file ≤ 1,500,000 bytes.
Any failure: exit non-zero, write nothing; the workflow publishes nothing and the last good snapshot
stays on `data-us-quakes`.

### 11.4 The app's own tests
`tools/test_decode.mjs` against `tools/ref/history_ref.json` and `tools/ref/snapshot_ref.json`;
`tools/test_geo.mjs` against `tools/ref/section_ref.json` (the four presets' first 200 events: along-
and cross-track km in float64); `tools/check.mjs`; `tools/shoot.mjs` (DESIGN §16).

---

## 12. Measurements behind the numbers

Run from `Template/scripts/us_quakes/` on 2026-09-30, exit 0, 9.42 s real (`/usr/bin/time -p`):

```
.venv/bin/python ../../us-quakes/tools/design_measure.py all
```

It printed (abridged only where marked; its `ramp` part is quoted at the end of this section):

```
--- history
earthquakes 385,076 (of the cache's every-type rows), sorted by time
lon 172.0..296.0  lat 17.0135..71.9743
magType labels 34 (blank counted): [('ml', 238842), ('md', 78847), ('mb', 24727), ('mc', 14491), ('Md', 8196), ('mw', 5236), ('mh', 4971), ('mwr', 1993), ('mb_lg', 1982), ('mblg', 1027), ('m', 950), ('mwc', 824), ('mww', 741), ('ms', 410), ('mlg', 305), ('mlr', 263), ('', 249), ('mfa', 211), ('ml(texnet)', 145), ('mint', 129), ('ma', 119), ('mwb', 102), ('fa', 73), ('lg', 72), ('uk', 68), ('Ml', 45), ('Mw', 26), ('mlv', 11), ('Mb', 8), ('mwp', 8), ('Unknown', 2), ('Mfa', 1), ('mB', 1), ('mbLg', 1)]
status {'reviewed': 382090, 'automatic': 2975, 'manual': 11}
no magnitude 180, magnitude 0.7..9.2; no depth 1492, depth -3.74..308.5 km
depth exactly 10 km: 23,759
M4.5+ 15,490  M4+ 33,005  M3+ 162,409
before 1900: 625 (no depth 607, no magnitude 180); first earthquake 1638-06-11T19:00:00.000Z Central New Hampshire
x code 0 62000  y code 14 54974  depth code max 31350  mag code 27 112  minutes 20220180 224055357
columns raw 4,620,912 B  deflate(6) 3,051,835 B  per column deflate(6) [729377, 696070, 701352, 604515, 219942, 96842]
text rows (M4.5+) 15,490: index 61,960 B deflate 23,769; ids 177,542 B deflate 55,663; places 471,554 B deflate 77,341
--- relief
conus scale 1.00 4096x2192 land px 6,058,098 p0.5 166 neutral 217.8  q70 856,293 B
conus scale 1.00 4096x2192 land px 6,058,098 p0.5 166 neutral 217.8  q75 942,611 B
conus scale 1.00 4096x2192 land px 6,058,098 p0.5 166 neutral 217.8  q82 1,134,672 B
ak    scale 1.00 4096x3309 land px 4,724,421 p0.5 142 neutral 225.7  q70 964,400 B
ak    scale 1.00 4096x3309 land px 4,724,421 p0.5 142 neutral 225.7  q75 1,048,141 B
ak    scale 1.00 4096x3309 land px 4,724,421 p0.5 142 neutral 225.7  q82 1,234,626 B
ak    scale 0.75 3072x2482 land px 4,724,421 p0.5 142 neutral 225.7  q70 582,620 B
ak    scale 0.75 3072x2482 land px 4,724,421 p0.5 142 neutral 225.7  q75 635,849 B
ak    scale 0.75 3072x2482 land px 4,724,421 p0.5 142 neutral 225.7  q82 750,946 B
hi    scale 1.00 2048x1458 land px 182,644 p0.5 85 neutral 235.5  q70 40,735 B
hi    scale 1.00 2048x1458 land px 182,644 p0.5 85 neutral 235.5  q75 43,668 B
hi    scale 1.00 2048x1458 land px 182,644 p0.5 85 neutral 235.5  q82 50,504 B
pr    scale 1.00 2048x801 land px 286,350 p0.5 126 neutral 229.3  q70 77,736 B
pr    scale 1.00 2048x801 land px 286,350 p0.5 126 neutral 229.3  q75 84,413 B
pr    scale 1.00 2048x801 land px 286,350 p0.5 126 neutral 229.3  q82 98,886 B
total with Alaska at 0.75: {70: 1557384, 75: 1706541, 82: 2035008}
--- geo
ne_50m_land                              VW   250,000 m²  (pieces, vertices, json B, deflate B) (273, 13308, 50844, 35527)
ne_50m_coastline                         VW   250,000 m²  (pieces, vertices, json B, deflate B) (289, 13318, 50980, 35599)
ne_50m_lakes                             VW   250,000 m²  (pieces, vertices, json B, deflate B) (223, 8104, 30291, 20490)
ne_50m_admin_1_states_provinces_lines    VW   250,000 m²  (pieces, vertices, json B, deflate B) (149, 2633, 10611, 7154)
ne_50m_admin_0_boundary_lines_land       VW   250,000 m²  (pieces, vertices, json B, deflate B) (9, 521, 2026, 1457)
bathymetry K_200   VW 5 km², rings < 50 km² dropped: (166, 6557, 25914, 17986)
bathymetry J_1000  VW 5 km², rings < 50 km² dropped: (137, 4960, 19608, 13441)
bathymetry I_2000  VW 5 km², rings < 50 km² dropped: (301, 7254, 29161, 19837)
bathymetry H_3000  VW 5 km², rings < 50 km² dropped: (559, 12178, 49192, 33006)
bathymetry G_4000  VW 5 km², rings < 50 km² dropped: (852, 17863, 72139, 47831)
bathymetry F_5000  VW 5 km², rings < 50 km² dropped: (1164, 24639, 99300, 65534)
bathymetry E_6000  VW 5 km², rings < 50 km² dropped: (111, 2683, 10745, 7416)
bathymetry D_7000  VW 5 km², rings < 50 km² dropped: (17, 384, 1556, 1121)
bathymetry total json 307,615 B deflate 206,172 B
places in the axis box 189; by country [('United States of America', 111), ('Canada', 38), ('Mexico', 25), ('Russia', 2)]
--- faults
Qfaults_2020 112,944 features
  age: [('latest Quaternary', 38951), ('undifferentiated Quaternary', 30151), ('late Quaternary', 18682), ('historic', 14260), ('middle and late Quaternary', 6155), ('class B', 4396), ('Late Quaternary', 282), ('unspecified', 67)]
  slip_rate: [('Less than 0.2 mm/yr', 44166), ('Between 0.2 and 1.0 mm/yr', 17125), ('Between 1.0 and 5.0 mm/yr', 16688), ('Greater than 5.0 mm/yr', 16286), ('Unspecified', 14113), ('', 2973), ('Insufficient data', 873), (None, 717), (' ', 2)]
  class: [('A', 106178), ('B', 4674), ('', 1657), (None, 434), ('C', 1)]
  linetype: [('Well Constrained', 67777), ('Moderately Constrained', 24111), ('Inferred', 21056)]
groups (fault, section, age, slip rate, class, line type) 5,816; lines 113,301; vertices 994,427; fault names 2,111
  VW  20,000 m²: vertices 312,042; lines+counts json 991,164 B deflate 515,468 B
  VW  50,000 m²: vertices 278,038; lines+counts json 929,231 B deflate 473,455 B
  VW 200,000 m²: vertices 247,871; lines+counts json 879,213 B deflate 429,380 B
  fault names: 2,111 entries, json 60,779 B deflate 14,924 B
  section names: 428 entries, json 9,986 B deflate 2,950 B
  senses: 18 entries, json 243 B deflate 132 B
  attr rows: 5,816 entries, json 140,730 B deflate 21,592 B
--- snapshot
proxy for two years of M2.5+ (2024-2025 rows) 21,799: columns raw 261,588 B, deflate 173,834 B, base64 231,780 B
text of 10,000 rows: ids 114,623 B -> base64(deflate) 48,356 B; places 302,258 B -> 62,084 B
--- sections
Cook Inlet ± 25 km  length   613 km  events  2,612  max depth  247.8 km  p50/p90/p99 [ 52.2  99.2 135.9]  at exactly 10 km 12
Cook Inlet ± 50 km  length   613 km  events  6,184  max depth  249.1 km  p50/p90/p99 [ 45.5  90.  125.4]  at exactly 10 km 31
Cook Inlet ±100 km  length   613 km  events 10,628  max depth  249.7 km  p50/p90/p99 [ 44.7  92.4 130.1]  at exactly 10 km 69
Aleutians  ± 25 km  length   400 km  events  2,259  max depth  269.5 km  p50/p90/p99 [ 34.6  75.  230.7]  at exactly 10 km 137
Aleutians  ± 50 km  length   400 km  events  5,122  max depth  274.0 km  p50/p90/p99 [ 34.4  97.5 229.5]  at exactly 10 km 477
Aleutians  ±100 km  length   400 km  events  9,725  max depth  290.8 km  p50/p90/p99 [ 33.   91.  231.4]  at exactly 10 km 1021
Cascadia   ± 25 km  length   513 km  events    330  max depth   64.2 km  p50/p90/p99 [21.5 45.2 57.2]  at exactly 10 km 0
Cascadia   ± 50 km  length   513 km  events    714  max depth   64.2 km  p50/p90/p99 [19.3 44.4 56.9]  at exactly 10 km 1
Cascadia   ±100 km  length   513 km  events  1,202  max depth   66.4 km  p50/p90/p99 [17.4 44.5 57.5]  at exactly 10 km 4
Hawaii     ± 25 km  length   267 km  events 27,275  max depth  102.4 km  p50/p90/p99 [ 1.4 30.3 43.4]  at exactly 10 km 6
Hawaii     ± 50 km  length   267 km  events 35,222  max depth  102.4 km  p50/p90/p99 [ 2.9 30.5 44.7]  at exactly 10 km 8
Hawaii     ±100 km  length   267 km  events 38,646  max depth  102.4 km  p50/p90/p99 [ 4.7 31.3 45.2]  at exactly 10 km 17
--- stories  (abridged: the six 'known' lines repeat §11.2)
New Madrid official18111216081500000 1811-12-16T08:15:00.000Z 36,-89.96 depth none M7.5 mw reviewed | Northeastern Arkansas (New Madrid Seismic Zone)
New Madrid official18111216090000000 1811-12-16T09:00:00.000Z 36.5,-89.9 depth none M6.3 mw reviewed | Near New Madrid, Missouri (New Madrid Seismic Zone)
New Madrid official18111216131500000 1811-12-16T13:15:00.000Z 36.25,-89.5 depth none M7 mw reviewed | Western Tennessee (New Madrid Seismic Zone)
New Madrid official18111216180000000 1811-12-16T18:00:00.000Z 36.5,-89.9 depth none M6.3 mw reviewed | Near New Madrid, Missouri (New Madrid Seismic Zone)
New Madrid official18111217180000000 1811-12-17T18:00:00.000Z 35.1,-90 depth none M6.1 mw reviewed | Near Memphis, Tennessee
New Madrid official18120123150000000 1812-01-23T15:00:00.000Z 36.8,-89.5 depth none M7.3 mw reviewed | North of New Madrid, Missouri (New Madrid Seismic Zone)
New Madrid official18120207094500000 1812-02-07T09:45:00.000Z 36.3,-89.4 depth none M7.5 mw reviewed | Western Tennessee (New Madrid Seismic Zone)
Oklahoma chip box M3+ per year [('2005', 1), ('2006', 5), ('2007', 3), ('2008', 4), ('2009', 20), ('2010', 42), ('2011', 63), ('2012', 35), ('2013', 103), ('2014', 585), ('2015', 888), ('2016', 639), ('2017', 272), ('2018', 167), ('2019', 57), ('2020', 36), ('2021', 29), ('2022', 15), ('2023', 17), ('2024', 23), ('2025', 6)]
Oklahoma largest since 2009 us10006jxs 2016-09-03T12:02:44.400Z 36.4251,-96.9291 depth 5.557 M5.8 mww reviewed | 14 km NW of Pawnee, Oklahoma
Oklahoma largest since 2009 usp000jadn 2011-11-06T03:53:10.000Z 35.532,-96.765 depth 5.2 M5.7 mww reviewed | 8 km NW of Prague, Oklahoma
Kilauea box 2018-04-30..09-01 M2.5+ 12,565
Kilauea largest hv70116556 2018-05-04T22:32:54.650Z 19.3181667,-154.9996667 depth 5.81 M6.9 mw reviewed | 18 km SSW of Leilani Estates, Hawaii
Ridgecrest ci38443183 2019-07-04T17:33:49.000Z 35.7053333,-117.5038333 depth 10.5 M6.4 mw reviewed | Ridgecrest Earthquake Sequence
Ridgecrest ci38457511 2019-07-06T03:19:53.040Z 35.7695,-117.5993333 depth 8 M7.1 mw reviewed | Ridgecrest Earthquake Sequence
```

What the numbers are, and are not:
- The history's in-ZIP size is the sum of per-section `deflate(6)` sizes (3,208,608 B); the ZIP
  deflates the file as one stream, so the real number is `check.mjs`'s.
- The relief step here skipped the lake mask (§5.1 step 2) and used the requested boxes, not the
  server's reported extents; both change the pixels slightly and the bytes little.
- The geo layers here skipped the pieces that cross the date-line seam instead of splitting them.
- The snapshot's sizes are proxies (two years of the history's M 2.5+ rows; the last 10,000 history
  rows' ids and places). The first real snapshot replaces them.
- The sections' events are the history's (M 2.5+ from 1900, all before), not the snapshot's.
- The depth ramp (DESIGN §6, ART.md "Palette") is checked by `design_measure.py ramp` (included in
  `all`). For the art pass's stops (`#fde28d #f5a231 #dc6673 #9a6299 #5d47ad #2a3b6b`) it printed, on
  2026-09-30:

```
normal  L* [90.4, 73.2, 58.0, 49.4, 37.6, 25.8] monotonic True  dE2000 neighbours [19.1, 35.8, 21.5, 18.0, 13.8]
protan  L* [88.7, 68.8, 52.2, 47.7, 38.8, 27.3] monotonic True  dE2000 neighbours [15.2, 27.4, 23.0, 12.0, 11.9]
deutan  L* [91.4, 75.8, 61.4, 50.5, 37.1, 24.9] monotonic True  dE2000 neighbours [12.2, 19.4, 31.2, 17.3, 11.7]
tritan  L* [88.7, 71.2, 58.0, 49.8, 38.7, 26.4] monotonic True  dE2000 neighbours [18.2, 12.4, 16.9, 31.6, 15.0]
smallest neighbour dE2000 over the four: 11.7
```

  Computed from the hex values (sRGB → CIE L*a*b*, D65; Machado 2009 matrices at full severity on
  linear RGB; CIEDE2000), not measured on a screen. The design stage's stops (`#ffe08a #f39b52
  #e3665a #bf4a8c #533f9e #1b2a5e`) reached 10.5 and passed, and were replaced by the art pass for two
  reasons ART.md gives: their 35 km stop was a signal red (`#e3665a`), and their deepest stop (L* 18.8)
  vanished on the dark theme's sea. An earlier candidate (`#ffd166 … #2e3f8f`) reached only 8.1.

## 13. Corrections to the research, and what the pipeline must settle

- **The history starts in 1638, not 1627.** The cache's 1627 row ("Near Essex, Massachusetts") has
  `type` `not existing`; the first earthquake is 1638-06-11 (§2.1).
- **625 earthquakes before 1900** (the research's 631 counts every type).
- **Quotes owed before any text ships** (DESIGN §10.3): magnitude-type names; `status`; the 10 km
  assigned depth; `felt`, `tsunami`, `alert` (PAGER); the fault age classes' bounds and the database's
  scope; volcano alert levels and colour codes; every story claim beyond the catalogue; a probe line
  that the event-page address answers for `ci38457511`. Each goes into `credits/usgs-statements.txt`
  verbatim with its address and retrieval date; `about.json` carries `null` for any still missing.
- **The relief extents** are to be read from the server (§5.2) and the registration gate run before
  the JPEGs are committed.
- **`publish-web.yml`** gets `us-quakes` in its data-branch loop and the two workflow names in its
  `workflow_run` list, in the same change as `refresh-us-quakes.yml` (DESIGN §15).

---

## Builder's decisions (pipeline stage, 2026-09-30)

What the static build decided where this contract was silent, wrong or measured differently.
Everything below was measured by the commands in `HANDOFF.md` ("Running the build"); the numbers
there supersede the design-stage estimates above wherever they differ. Each item says what was
chosen, what it was chosen over, and what would change it.

### Scripts and where each step lives
- **Names.** The brief named `fetch_catalog.py`, `fetch_relief.py`, `fetch_layers.py`,
  `build_static.py`, `verify_static.py` and `build_all.sh`; this contract and DESIGN §15 named
  `build_history.py`, `build_relief.py`, `build_geo.py`, `build_about.py` and `verify.py`. Both
  exist: `build_static.py` is the driver that runs `build_history` → `build_relief` (check, or
  rebuild with `--relief`) → `build_geo` → `build_about`, and **`verify_static.py` is §11.1's
  `verify.py`** (the static half; §11.3's live checks are `refresh.py`'s). `build_all.sh` runs the
  fetches, `build_static.py`, `verify_static.py`, and with `--twice` the byte-identity check (§9).
  It does not run `refresh.py`: the refresh stage adds that.
- **Content is JSON, not YAML** (`scripts/us_quakes/content/about.json`, `stories.json`,
  `quotes.json`), so the build needs no YAML library. Texts are templates: every `{name}` is a
  number `build_about.py` computes from the shipped `history.bin`, `history.json` or `geo.json`, or
  a pipeline rule constant, written out as `numbers`.
- **Committed pipeline files added**: `relief.json` (each JPEG's bounds, stretch, grid, land
  pixels, registration gate and sha256; `build_geo.py` copies bounds from it and refuses a JPEG
  whose sha256 differs, so the yearly build never needs the relief cache), `relief-extents.json`
  (the extents the server reported), and `catalog-windows.json` now records each window's
  `retrieved` date.

### History (§1–2)
- **N = 385,071, not 385,076.** Five rows came back from M2.5+ queries with a preferred magnitude
  below 2.5 (`ld60063426` 2.42, `ld60064321` 2.46, `ld60086101` 2.12, `us1000gcqs` 1.9,
  `us20008ia2` 0.7, all `ml`; the service matched them on another magnitude). The history's floor
  rule is on the preferred magnitude, so they are dropped and listed in
  `history.json.dropped.belowFloor`. Chosen over keeping them, which would make "from 1900, M2.5
  and up" false for five rows no floor ever shows. The count check (§11.1 item 1) still compares
  the cache with the service, which includes them.
- **K = 15,664 text rows, not 15,490**: the rule is the decoded tenth (`m ≥ 65`), so "4.45" counts;
  the design stage measured `float(mag) ≥ 4.5`. `id_text` 179,359 B, `place_text` 476,654 B.
- **Every code is rounded half up on the catalogue's decimal text** (Decimal arithmetic), not only
  the magnitude: x, y and d too, so a rebuild is exact and the decoder test is against raw strings.
  Half up means away from zero for negatives (`ROUND_HALF_UP`): the history has no negative
  magnitude, the live feed does (−1.21), and `refresh.py` must use `common.half_up`.
- **The column block is not one contiguous span.** N is odd, so the uint16 and uint8 columns need
  2- and 1-byte pads to keep every section on a 4-byte boundary (§0). The app uploads each column
  from its own `offset` (DESIGN §5.3's per-column regions need that anyway); it must not treat
  `t … f` as one 4,620,912-byte block.
- **`history.json` additions**: `dropped.belowFloor` (the five ids). `retrieved` is the windows'
  download date (one date, or "first to last" once a January run adds windows), not the constant.
- **Measured**: `history.bin` 5,339,530 B (3,216,034 B as the ZIP stores it); `history.json` 2,752
  B; `history_ref.json` 134,986 B (the 1,000 rows and six events as arrays, `columns` naming them).

### Relief (§5)
- **Alaska is re-gridded, not placed side by side.** The server widened the two exports to
  different pixel sizes (ak-west 1,604.603 m, ak-east 1,603.780 m) and ak-east starts 846 m west of
  180°, so the halves do not share a grid. The western 555 columns are resampled onto ak-east's
  grid (bilinear for the shade, nearest for the elevation) before joining; the bounds written are
  that grid's: west 171.99652, east 231.007604 on the axis — 0.0035° west of the axis box, which
  is harmless for a textured quad. Chosen over stitching as-is (up to 0.85 px vertical error in the
  western half).
- **The registration gate measures against Natural Earth 1:10m land, and allows a best shift of up
  to 2 px.** Against 1:50m (the first reference) the best shift was 2 px south in Alaska and ≥ 3 px
  in Hawaii and Puerto Rico, because 1:50m is too coarse for 326 m and 190 m pixels: its Ka Lae is
  5.8 km north of the DEM's. The DEM itself is right: its Ka Lae is at 18.912° and Upolu Point at
  20.270°, within a pixel of the capes. Gate now: the reported extent equals the elevation TIFF's
  own GeoTIFF tiepoint and pixel scale (exact to 1 cm, all five exports); agreement ≥ 0.95 on the
  pixels 3DEP covers, cos-latitude weighted; best shift over −5…5 px within ±2 px; zero beats ±5.
  Measured: conus 0.99172, best [0, 0]; ak 0.98525, best [0, +1] (1.6 km); hi 0.98495, best
  [0, +1] (0.33 km); pr 0.98589, best [+1, +1] (0.19 km). `ne_10m_land` (10,157,965 B) is pinned
  in `sources.STATIC` for this check only and does not ship.
- **3DEP covers land beyond the United States.** Elevation was returned for Sonora (−110°, 28°:
  249 m), northern Mexico (−100°, 25°), British Columbia, the Yukon and Quebec; not for the
  Bahamas. DESIGN §5.2's "Relief covers US land only: Canada, Mexico … are flat land" is wrong;
  About says "the United States and, near its borders, parts of Canada and Mexico; the Bahamas
  have none".
- **`lo` is an actual pixel value** (`numpy.percentile(…, 0.5, method='lower')`), so conus is 165
  and its neutral 218.2 (the design stage printed 166 / 217.8 from interpolated percentiles).
  The lake mask removed 205,608 land pixels in conus and 16,522 in Alaska.
- **Measured**: conus 941,150 B; ak 635,665 B; hi 43,668 B; pr 84,413 B; 1,704,896 B in all.

### Geo (§4)
- **Fault groups are keyed by every attribute the record ships** — (name, section, age, slip
  rate, slip sense, line type, class, review year, fault_id, section_id) — because the design's
  six-field key had one group with two slip senses, two with two review years and two with two
  names. Blank, `None` and whitespace labels become `""` before keying, which merges a few
  groups: 5,815 groups (not 5,816), 113,297 lines, 278,012 vertices.
- Four fault traces are dropped whole, not lost by accident: Alaska–Aleutian subduction-zone
  segments west of 172° E (164–169° E, the Commander Islands side), outside the axis.
- One slip-rate label outside the contract's list is appended and printed:
  `0.2 +/- 0.1 mm/yr` (one feature).
- Coordinates are rounded to 0.001° and consecutive repeats dropped; a fault line shorter than
  0.001° keeps its one point twice, so every source line has a count.
- **`tools/ref/section_ref.json`** (40,232 B): the four presets' first 200 M2.5+ rows in history
  order within ±100 km and 0 ≤ along ≤ length, from the decoded (not raw) positions, with the
  formula written into the file; `alongKm`/`crossKm` to 1e-9 km.
- **Measured**: `geo.json` 1,646,283 B raw, 837,552 B as the ZIP stores it. By key: faults
  1,141,314; bathymetry 321,790; coast 51,711; land 51,570; lakes 30,289; volcanoes 17,568;
  places 17,135; states 10,687; borders 2,026; the rest under 2 KB. Presets within ±50 km at M2.5+:
  Cook Inlet 6,182, Aleutians 5,121, Cascadia 709, Hawaii 35,219.

### About, stories, credits (§6–8)
- **Quotes owed (DESIGN §10.3) were fetched and saved**, 28 in `content/quotes.json` plus the
  magnitude-type table and the volcano alert levels, each verbatim in
  `credits/usgs-statements.txt`; `build_about.py` refuses any quotation (curly-quoted in a text,
  or a `quote` field) not found there. The field meanings (status, felt, tsunami, alert, sig,
  magType, depth, fixed depth) come from USGS's ComCat Event Terms as **archived on 2025-01-04**
  (web.archive.org): the live address now shows a new landing page without the glossary. The
  archive URL and that fact are printed with each.
- **Fault age bounds are `null`.** No USGS page read here states them; About prints class names
  only and says so (`faultAgesNote`). Fault classes A, B, C are quoted.
- **Magnitude-type names** are given only for labels the USGS table spells (case-insensitive:
  mww, mw, mwc, mwb, mwr, ms, mb, mfa, ml, mb_lg, mlg, md, mwp, mh, mint). mc, mlv, mblg, mbLg,
  mB, lg, fa, ma, m, uk, Unknown and ml(texnet) show their code only.
- **Every numeral is checked**: outside a quotation, each must be one of the story's or About's
  computed `numbers` (a numeral fused to letters, like 3DEP, is a name; "Lower 48" is listed as a
  name). Stories are 44–67 words. The event-page pattern is evidenced by USGS's own record of
  ci38457511 giving that url, and the address answering 200.
- **Removed claims no quote supported**: DESIGN's "energy grows about 32-fold per magnitude"
  (About's size note says only that dot area is a display rule), and from the Cascadia and 1906
  stories any wording beyond their quotes.
- **Credits fragments** are read from `fetch_catalog`, `fetch_layers`, `build_history`,
  `build_relief` and `build_geo` (not `fetch_relief`, which does not run in a yearly build; the
  relief fragment is written by `build_relief.py` in both modes), so `CREDITS.txt` is the same
  with or without `--relief`. Counts in those strings use the narrow no-break space (D15), because
  About prints them.
- **Keys keep insertion order** (the contract's "keys in this order"), not sorted order; the
  fragments are written with sorted keys. Determinism is by construction and proven by `--twice`.
- **Measured**: `about.json` 36,400 B (cap 40,000); `stories.json` 8,886 B; `CREDITS.txt` 19,628 B.

### Budgets as measured
`assets/` 8,738,688 B raw, **5,701,599 B as the ZIP stores it** (deflate level 6, `zip`'s default),
under the 6,000,000 cap with **298,401 B** of headroom (the design estimated 230 KB). The JPEGs
deflate a little further in a ZIP (relief-hi 43,668 → 32,856 B), which the design had not counted.

---

## Builder's decisions (refresh stage, 2026-09-30)

What the live stage decided where §3 and §11.3 were silent or contradicted themselves; §3 above is
already edited to match. Measured by the commands in `HANDOFF.md` ("The hourly refresh").

- **The daily M2.5+ answer lives in `actions/cache`, not in the previous snapshot.** §3.9 first said
  to reuse the published snapshot's rows, but a snapshot keeps ids only for M4.5+ before `liveFrom`,
  so reused rows could not be de-duplicated by id or sorted to the millisecond. The raw CSV answers
  and a marker (`cache/live/live-marker.json`: `queriedAt`, `from`, `to`, each query's count and
  sha256) are kept instead; the workflow restores the newest `us-quakes-fdsn-*` entry and saves a new
  one, named for its `queriedAt`, only when the run asked USGS. What would change it: `actions/cache`
  becoming unavailable (the run then simply queries every hour: 9 requests, about 20 s).
- **The query runs to the feed's time, not to `liveFrom`.** Every later hour's `liveFrom` is then
  inside the cached span, so no row is lost in the gap between a query and a later boundary; rows at
  or after `liveFrom` are dropped from it. `fdsn.to` is that time.
- **Feed rows older than `liveFrom` are dropped** (the FDSN part holds the M2.5+ ones), so the two
  parts meet at one boundary; an FDSN row whose id is among a live row's `ids` is dropped too
  (`fdsn.replacedByFeed`; 0 on the first run).
- **`encoding`, not `text`.** §3.2's example used `text` both for `"base64"` and for the side table;
  a JSON object cannot hold both, so the encoding is `rows.encoding`.
- **An unknown volcano label keeps the previous block** instead of failing the run: §3.5 and §11.3
  disagreed, and failing would freeze the earthquakes over a volcano label. The written block is
  still checked (§11.3 item 5 holds for the file). `sent` is the latest notice's time, so the ask row
  calls it `noticeSentUtc`.
- **A feed row without `updated` fails the run** rather than borrowing the event time: the column has
  no "none", and a borrowed value would be invented.
- **Ask**: the events are taken round-robin across the boxes (178 rows: Alaska 45, Lower 48 45,
  Puerto Rico 44, Hawaii 44 on the first run), because the largest 178 overall would be almost all
  Alaska and a question about Hawaii would find nothing; `within` names the smallest window holding
  the event. The volcano rows carry USGS's quoted meaning of their level from `about.json`, and a
  third note quotes the tsunami flag's meaning, so a question in words cannot read the flag as "a
  tsunami happened". Without a volcano status, the summary's counts are `null`, not 0.
- **`snapshot_ref.json` holds the first 250 and the last 250 rows**, not the first 500: the first 500
  are all FDSN rows, and the live part's extras would go untested.
- **Extra fields**, all additive: `feed.otherTypes` (non-earthquakes in the boxes, not drawn),
  `fdsn.kept`, `fdsn.replacedByFeed`, `fdsn.belowFloor`, `volcanoes.error` (only with `ok: false`),
  and `sources[].url` (printed as text).
- **`verify_snapshot.py`** is §11.3's independent half: its own decoder and box test, and with the
  cached sources it proves the live part is exactly the feed's in-box earthquakes from `liveFrom` and
  the rest exactly the FDSN answers' M2.5+ earthquakes before it, every value within §1's bounds. The
  workflow runs it before publishing.
- **Workflows.** `refresh-us-quakes.yml` ("Refresh us-quakes"): cron `23 * * * *`, dispatch (with a
  `requery` input), and a push to `main` touching the refresh's code; a sparse checkout of
  `scripts/us_quakes` and `us-quakes/assets` (a blob-less partial clone); `requests==2.34.2` only;
  Global Weather's branch guard and single parentless force-push to `data-us-quakes`.
  `build-us-quakes.yml` now also writes and verifies the demo snapshot and its ref and commits them
  with the assets. `publish-web.yml` lists both workflow names and takes `us-quakes` from its data
  branch (§13's last item is done). `build_web.py` keeps no such list, so it is unchanged.
- **Measured**: `data/snapshot.json` 533,512 B (cap 1,500,000), 362,351 B as the ZIP stores it;
  `tools/ref/snapshot_ref.json` 84,593 B; a run reusing the day's query took 3.3 s locally, one that
  queried 22.0 s (9 FDSN requests at one a second).

---

## The lead's pass (2026-09-30)

What changed in the contract after the builder's passes; §0, §1, §2.3, §3.2, §4.1, §4.10, §10 and §11.1
are edited to match. Measured by `./build_all.sh --offline` (then `verify_static.py`: all checks
passed), `refresh.py --ref` and `verify_snapshot.py` (all checks passed).

- **The depth code 1500 is the catalog's exact 10** (§1): `common.depth_code`, used by
  `build_history.py` and `refresh.py`. `verify_static.py` printed "all 385,071 rows within bounds
  (failures 0); … |Δdepth| 0.0090 km; depth code, magnitude, status and type exact" and "depth code 1500
  holds exactly the 23,759 rows the catalog lists at 10 km (history.json depth10km 23,759; code 1500 in
  the file 23,759); 203 depths that round to 10.00 km written as 9.99 or 10.01"; `verify_snapshot.py`
  "depth code 1500: 2,890 rows, exactly the sources' depths of 10 km; 2 depths that round to 10.00 km
  written as 9.99 or 10.01". `history.bin` keeps its size (5,339,530 B) and changes in those 203 codes;
  `history.json` changes only in `codes.d`'s wording. `history_ref.json` is unchanged (it holds the
  catalog's strings, not codes).
- **The basemap runs past the axis** (§0, §4.1): `geo.json.basemap` = 168–305 on the axis, 25° S–81° N.
  Chosen over the brief's "about 5° N and 76° N across 172° E–64° W" because the app's own framings on
  a 390 × 844 phone reach 23.6° S (the Lower 48 in focus mode), 79.5° N (Alaska at Peek), 169.0 (Alaska)
  and 304.2 (the Lower 48 at Half, its right 60 px kept for the key column); with the smaller basemap the
  app's clamp would have moved those framings off their boxes. `verify_static.py` printed land 458
  pieces (192 reach past the axis box), lakes 232 (10), coast 450 (182), borders 38 (31), states 153
  (13), and the bands 289, 223, 445, 842, 1,283, 1,620, 173 and 19 rings (1,658 past the axis box), each
  inside the basemap and closed; faults, places, volcanoes, relief, views and presets are identical to
  the file before, key by key. The basemap's keys: 673,536 B raw against 468,073; `geo.json` 1,851,803 B
  raw (cap 1,900,000) and 987,085 B as the ZIP stores it (837,552 before): `assets/` **5,851,793 B**,
  headroom **148,207 B** (`verify_static.py`). What would change it: a phone whose framings reach
  further (the zones would then need to grow with it), or the budget (the zones' multiples are the
  cheapest lever: ×20 north of 5° N instead of ×10 saves 22 KB, measured on the layers alone).
- **The relief stays unmasked** (§5): reviewer B's mask to US land was declined by the lead, because
  the basemap now runs on into Canada and Mexico and a relief ending at the border would read as a cut;
  `build_relief.py` and the four JPEGs are unchanged (sha256 as `relief.json`).
- **Quotes** (`credits/usgs-statements.txt`, `content/quotes.json`): the negative-depth FAQ's two
  sentences, joined with "…" in its own order, at
  `https://www.usgs.gov/faqs/what-does-it-mean-earthquake-occurred-a-depth-0-km-how-can-earthquake-have-a-negative-depth`
  (the address ending `-negative-depth-sometimes` answers 404); the `Mww … — Mww …` header-as-quote line
  is gone (the `mw` and `mww` headers are still found in the Mww line above it).
