# Data contract: what `Template/scripts/warming_world/` writes, and what the app reads

This is the agreement between the pipeline and the app. Every shipped data file is described here:
its layout, units, order, rounding, and how to decode it. A script that changes a format changes this
file in the same commit. `../DESIGN.md` says what the app does with each file. `RESEARCH.md` says
where every source comes from and quotes its terms.

Numbers marked *measured* were printed by a command on 2026-09-30, from the research copies pinned in
`sources.GISTEMP_RESEARCH`: the August 2026 grid and the September 2026 table. The commands are in
§11. Numbers in the JSON examples are illustrative unless marked.

## 0. Ground rules

- **Only GISS's numbers, and what this app derives from them by the rules below.** Nothing is
  interpolated, smoothed, filled or typed in. A cell GISS gives no value for is "none" (byte 255,
  `null` in `ask`), never 0.
- **Integers first.** The grid stores hundredths of a kelvin as int16, and a kelvin anomaly is the
  same number in °C. Every mean and every rounding is computed from those integers (§3.6), never by
  multiplying the float32 `scale_factor` (RESEARCH §1.2).
- **Rounding is half away from zero**, defined on integers in §3.6, everywhere: cell values to
  0.1 °C, partial-year table means to 0.01 °C.
- **Orientation.** The snapshot's grid is north-first and west-first: row 0 is the 2° band 90–88° N,
  and column 0 is 180–178° W. The source file is south-first, so the pipeline flips the rows. It
  never flips columns.
- **The app's color scales are not data.** ±4 °C (map) and ±1.5 °C (stripes) are constants in the
  app (`js/ramp.js`). The snapshot carries no scale, because a value in a file that a monthly job
  rewrites would let one release rescale every year before it.
- **Text** is UTF-8 in NFC, US English, no AI vendor or product names. There is no URL in the app's
  own code: URLs live in the snapshot's `sources`, `assets/about.json` and `../CREDITS.txt`, and the
  app prints them as text, never as links.
- **Deterministic** (§6). **Budgets are asserted before writing** (§7). A run that fails any check
  writes nothing (§8).
- **The refresh needs the standard library and `requests`**, nothing else (RESEARCH §1.11): `gzip`,
  `zlib`, `base64`, `struct` (through `netcdf3.py`), `json`, `math`, `csv`, `hashlib`, `datetime`.
  `build_static.py` may use the same set, and needs no numpy.

---

## 1. What is read

### 1.1 The grid: `gistemp1200_GHCNv4_ERSSTv5.nc.gz`

The URL is `sources.GISTEMP['url']`. It is about 25.8 MB, gzip of classic NetCDF (CDF-1), 57 014 888
B unpacked (*measured* on the August file). It is read with `netcdf3.py`. The contract is
`sources.GISTEMP['contract']`, and every item of it is checked on every run (§8, V1):

| Item | Must be |
| --- | --- |
| magic | `CDF\x01` |
| dimensions | `lat` 90, `lon` 180, `nv` 2, `time` ≥ 1 (fixed, `numrecs` 0, in the files read so far; `netcdf3.frame()` reads both shapes and either is accepted) |
| variable | `tempanomaly(time, lat, lon)`, type `h` (big-endian int16) |
| `scale_factor` | float32 within 1e−9 of 0.01. Decode as integer ÷ 100; the scale is checked, never used |
| `_FillValue` | 32767 |
| `units` | `K` |
| `lat` | −89, −87, … 89: cell centers, **south to north** |
| `lon` | −179, −177, … 179: cell centers, west to east |
| `time` units | `days since 1800-01-01 00:00:00`; `time[0]` falls in 1880-01, and each next value falls in the next calendar month, with no gaps |
| `history` | contains `ILAND=1200`, `IOCEAN=NCDC/ER5` and `Base: 1951-1980` |

The newest month is the calendar month of `time[-1]`. The `history` attribute's `Created
YYYY-MM-DD HH:MM:SS` is the release's creation time (§3.2). The August file says `Created
2026-08-10 06:37:42`.

### 1.2 The table: `GLB.Ts+dSST.csv`

The URL is `sources.GISTEMP['table_url']`, 12 887 B (*measured*, the September release). Line 1 is a
title. Line 2 is the header `Year,Jan,Feb,…,Dec,J-D,D-N,DJF,MAM,JJA,SON`. Then one row per year from
1880. Values are hundredths written as decimals (`-.19`, `1.29`), and `***` means missing. Parsing is
done in integers: `round(float(s) × 100)` on a value with at most two decimals, asserted exact.

- A **complete** year has 12 months and a `J-D`.
- The newest year has n months followed by `***`, and `J-D` `***`.
- The app uses `J-D` for complete years, the monthly columns for the 24 months, and the mean of the
  first n′ months for the partial year (§3.6). Here n′ is the grid's month count for that year, so
  the stripe and the map always cover the same months.

### 1.3 Natural Earth v5.1.2 (static, `build_static.py`)

These are pinned by sha256 in `sources.STATIC`: `ne_50m_land`, `ne_50m_lakes`,
`ne_50m_admin_0_boundary_lines_land` and `ne_50m_populated_places_simple`, at commit `f1890d9f…`.
`ne_50m_coastline` is pinned but not used, because the land outlines are the coast (§5.1).

---

## 2. The grid and the frame

```
nx 180 columns × ny 90 rows = 16 200 cells, one byte each, row-major
row j (0 … 89):    the band from (90 − 2j)° to (88 − 2j)°; center latitude 89 − 2j
column i (0 … 179): the band from (−180 + 2i)° to (−178 + 2i)°; center longitude −179 + 2i
index k = j · 180 + i
source row (south-first) = 89 − j
```

**Area weights.** A 2° band's area is proportional to sin(φ + 1°) − sin(φ − 1°) = 2 sin 1° cos φ,
where φ is its center latitude. So **w_j = cos(89 − 2j)°** is exact up to a constant, not an
approximation. Every area-weighted figure below uses it.

**A frame** is the 16 200 bytes of one step, with these values:

```
byte b in 0 … 254  →  value = −12.7 + 0.1 · b  °C      (b = tenths + 127)
byte 255           →  no data
```

This range holds −12.7 … +12.7 °C. Bytes 0 and 254 are both values: −12.7 and +12.7.

---

## 3. `data/snapshot.json` (`refresh.py`; the only file the phone's Shortcut replaces)

### 3.1 Top level, keys in this order

```
{ "schema": 1,
  "app": "Warming World",
  "generatedAt": "2026-10-15T06:44:10Z",       // when refresh.py ran, UTC, to the second
  "source":   { … },                            // §3.2, Global Weather's shape
  "release":  { … },                            // §3.2
  "grid":     { … },                            // §3.3
  "encoding": { … },                            // §3.3
  "layers":   [ … ],                            // §3.3
  "annual":   { … },                            // §3.3, the rules the steps were built with
  "steps":    [ … ],                            // §3.4, one per year
  "months":   [ … ],                            // §3.5, exactly the 24 newest months
  "sources":  [ … ],                            // §3.7
  "ask":      [ … ] }                           // §3.8, never read by the app
```

It is compact JSON (`separators=(',', ':')`), UTF-8 (`ensure_ascii=False`), with a final newline.
Floats are rounded as each field says.

### 3.2 `source` and `release`

```
"source": {
  "name": "NASA GISS Surface Temperature Analysis, version 4 (GISTEMP v4)",
  "detail": "Land-Ocean Temperature Index, 1 200 km smoothing, GHCN-monthly v4 stations and ERSST v5 sea surface, 2° cells; annual means and 0.1 °C rounding by this app",
  "licence": "Public domain in the United States (US Government work, 17 U.S.C. §105); GISS asks for a citation",
  "attribution": "Temperature: NASA GISS Surface Temperature Analysis (GISTEMP v4); annual means and 0.1 °C rounding by this app."
},
"release": {
  "id": "2026-08/2026-09-08T06:37:42",          // newestMonth + "/" + created; the workflow's skip key
  "created": "2026-09-08T06:37:42",             // from `history` ("Created …"), as GISS wrote it, no zone
  "history": "Created 2026-09-08 06:37:42 by SBBX_to_nc 2.0 - ILAND=1200, IOCEAN=NCDC/ER5, Base: 1951-1980",
  "firstMonth": "1880-01", "newestMonth": "2026-08", "monthCount": 1760,
  "tableNewestMonth": "2026-08",
  "base": "1951-1980",
  "mode": "live",                               // "live" | "research" (§10.2)
  "retrieved": "2026-10-15"                     // UTC date of the run; GISS's "date of access"
}
```

Every number in these strings is joined to its unit by U+202F (`1 200 km`, `0.1 °C`, written here with
plain spaces), and thousands are grouped with it (`../DESIGN.md` §22 L-6), so the snapshot carries the bytes
the screen shows. `source.attribution` is `sources.GISTEMP['attribution']`, verbatim, and
`verify_static.py` pins that sentence. `release.history` is the
attribute, verbatim (control characters stripped). The `created` above is illustrative. The August
file's is `2026-08-10T06:37:42` with `newestMonth` `2026-07` (*measured*).

### 3.3 `grid`, `encoding`, `layers`, `annual`

```
"grid": { "nx": 180, "ny": 90, "lon0": -179, "lat0": 89, "dlon": 2, "dlat": -2, "cells": true },
"encoding": {
  "value": "offset + step * byte, per plane, as `layers` says; byte 255 = no data",
  "order": "row-major from lat0 southwards, lon0 eastwards, one byte per 2° cell",
  "compression": "deflate",                     // zlib, RFC 1950, level 9, one stream per plane
  "delta": "none",                              // absolute values; delta packs 15 % worse here (§11)
  "none": 255
},
"layers": [ {
  "key": "anom", "label": "Temperature anomaly", "kind": "scalar",
  "unit": "°C", "base": "1951-1980",
  "level": "surface: air over land and sea ice, sea surface over open water",
  "field": "tempanomaly",
  "range": [-6.4, 6.4],                         // min, max over every annual step's values (0.1 °C)
  "planes": { "v": { "offset": -12.7, "step": 0.1, "power": 1, "unit": "°C", "none": 255 } }
} ],
"annual": { "minMonths": 9, "partialMinMonths": 6, "partialCellShare": 0.75,
            "rounding": "half away from zero, from integer hundredths" }
```

`lon0` and `lat0` are **cell centers** (`cells: true`). Global Weather's grid is points, and this
key is the difference. The app checks every number in `grid` and `encoding` exactly, and reads
`offset`, `step` and `none` from the plane. `range` is *measured* at −6.37 … +6.43 °C before
rounding (RESEARCH §1.7).

### 3.4 `steps`: one per year, ascending, contiguous from 1880

```
{ "year": 1998,
  "label": "1998",                              // partial: "2026, Jan–Aug (partial)"
  "months": 12,                                 // n, the grid's months in that year (12, or 6–11 when partial)
  "partial": false,
  "globalMean": 0.61,                           // GISS's own figure, °C, 2 decimals (§3.6)
  "gridMean": 0.604,                            // this app's area-weighted mean of the map, 3 decimals (§3.6)
  "coverage": { "area": 0.9873, "cells": 0.9741 },   // share with data, 4 decimals
  "beyondScale": { "above": 12, "below": 0 },   // cells with data whose value is > +4.0 / < −4.0 °C
  "planes": { "anom.v": "<base64 of zlib of the 16 200-byte frame>" } }
```

- The years run 1880 … the newest complete year, then the partial year if the newest year has
  6 ≤ n ≤ 11 months in the grid. A newest year with n ≤ 5 is left out of `steps`; its months are in
  `months`.
- The `label` of the partial year is `"<year>, Jan–<Mon> (partial)"`. The en dash is U+2013, and
  `Mon` is one of `Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`.
- `coverage.area` is Σ w_j over cells with data ÷ Σ w_j over all 16 200 cells. `coverage.cells` is
  the count with data ÷ 16 200. *Measured* in 1880: area 0.8265, cells 0.6800. In 2025: 0.9922 and
  0.9888.
- `beyondScale` counts decoded tenths > 40 and < −40. A cell at exactly ±4.0 is on the scale.
  *Measured*: 872 above in 2025 (RESEARCH §1.6).

### 3.5 `months`: the 24 newest months, ascending, consecutive

```
{ "month": "2026-08",
  "label": "August 2026",
  "globalMean": 1.40,                           // the table's month column, °C, 2 decimals
  "gridMean": 1.384,
  "coverage": { "area": 0.9951, "cells": 0.9930 },
  "beyondScale": { "above": 1043, "below": 37 },
  "planes": { "anom.v": "…" } }
```

The last entry's `month` equals `release.newestMonth`. A month's frame is GISS's value for that
month rounded to 0.1 °C. No months rule applies: a cell is shown when GISS has it.

### 3.6 How every value is computed

Let `h` be a cell's value in hundredths (int16, not 32767), and `valid` mean `h ≠ 32767`.

- **Half away from zero, on integers.** `round_div(s, d)` for `d > 0` is
  `sign(s) · ⌊(2|s| + d) / (2d)⌋`. To tenths of a degree from a sum `s` of `c` hundredths, the
  result is `q = round_div(s, 10c)`. A month is `q = round_div(h, 10)`. Check: 15 hundredths → 2
  tenths, 14 → 1, −15 → −2.
- **A complete year's cell**: over its 12 months, `c` = the number of valid months and `s` = their
  sum. If `c ≥ 9`, the value is `q`, so `byte = q + 127`. Otherwise byte 255.
- **The partial year's cell** (n months): the same, with `c ≥ ⌈0.75 n⌉` (6 of 7, 6 of 8, 7 of 9,
  8 of 10, 9 of 11).
- **No clamping.** If any `q` is outside −127 … +127 the run fails (V5). *Measured*: never, either
  for annual values or the last 24 months.
- **`globalMean`** comes from the table:
  - a complete year: `J-D` as GISS wrote it;
  - a month: its column;
  - the partial year: `round_div(Σ first n′ months' hundredths, n′)` hundredths ÷ 100, where n′ is
    the grid's month count.
- **`gridMean`** (validation and `ask`): Σ w_j · (s/c) ÷ Σ w_j over cells passing the rule, in °C
  from the **unrounded** means (s/c/100), summed in row-major order in Python floats, then rounded
  to 3 decimals.
- **`coverage`** and **`beyondScale`**: §3.4.

### 3.7 `sources`: drives the on-screen credit for the live data

```
[ { "id": "gistemp-grid",
    "name": "GISTEMP v4 Land-Ocean Temperature Index, 1 200 km smoothing (gistemp1200_GHCNv4_ERSSTv5.nc.gz)",
    "owner": "NASA Goddard Institute for Space Studies",
    "licence": "<sources.GISTEMP['licence']>",
    "attribution": "<sources.GISTEMP['attribution']>",
    "citation": [ "GISTEMP Team, 2026: GISS Surface Temperature Analysis (GISTEMP), version 4. NASA Goddard Institute for Space Studies. Dataset accessed 2026-10-15 at https://data.giss.nasa.gov/gistemp/.",
                  "Lenssen, N., G.A. Schmidt, M. Hendrickson, P. Jacobs, M. Menne, and R. Ruedy, 2024: A GISTEMPv4 observational uncertainty ensemble. J. Geophys. Res. Atmos., 129, no. 17, e2023JD040179, doi:10.1029/2023JD040179." ],
    "url": "https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz",   // text, never a link
    "via": null,                                // research mode: "Internet Archive capture 20260906203026 of the URL above"
    "bytes": 25853076, "sha256": "<of the bytes read>",
    "lastModified": "Tue, 08 Sep 2026 06:31:20 GMT",   // the HTTP header verbatim; null when absent
    "readAt": "2026-10-15T06:43:51Z",
    "note": "NASA does not endorse this app." },
  { "id": "gistemp-table",
    "name": "GISTEMP v4 global means (GLB.Ts+dSST.csv)",
    "owner": "NASA Goddard Institute for Space Studies",
    "licence": "…", "attribution": "<the same line>",
    "use": "the stripes and the global-mean figures",
    "url": "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
    "via": null, "bytes": 12887, "sha256": "…", "lastModified": "…", "readAt": "…" } ]
```

- The two `citation` strings are `sources.GISTEMP['citation']` with `{year}` set to the year of
  `release.retrieved` and `{accessed}` set to `release.retrieved`.
- The static source (Natural Earth) and its credit are in `assets/about.json` (§5.3), because they
  do not change monthly.

### 3.8 `ask`: at most 200 flat rows for Snuggery's Ask

Ask reads these rows; the app never does. Keys are plain, and numbers are what the app shows: GISS's
global means to 0.01, cell values to 0.1, the app's pole means to 0.01 (the chip's own numbers),
percentages to 0.1. `null` means no data, never 0. The order is notes, then years ascending, then
months ascending. Snuggery's Ask is an on-device model, so the rows follow NASA's guidance for AI
products (`scripts/warming_world/credits/nasa-media-guidelines.txt`): the source note says whose
reading an answer is, and no string attributes a statement to NASA (V13; naming the data's source as
a fact is allowed).

- **`"note"`, 6 rows**: `{kind, topic, text}`, with `topic` one of `anomaly`, `source`, `smoothing`,
  `coverage`, `partial`, `figures`. Every number in a text is filled from the snapshot:
  - `anomaly`: "Every value is a temperature anomaly: the difference from the same place's 1951–1980
    average for the same months, in °C. It is not a temperature."
  - `source`: "Data: NASA GISS Surface Temperature Analysis (GISTEMP v4), 1 200 km Land-Ocean grid,
    2° cells, release created <created>, newest month <Month YYYY>.[ The global means come from
    GISS's table through <table's Month YYYY>, a newer release than the map's; only the map's months
    are used.] Annual means and 0.1 °C rounding are this app's. NASA does not endorse this app.[ Read
    from the Internet Archive's copies of GISS's files.] Answers drawn from these rows are this app's
    reading of GISS's published data; NASA has not reviewed them and is not responsible for their
    accuracy." The first bracket is there when `release.tableNewestMonth` is newer than `newestMonth`
    (a research build, V7), the second in research mode (Builder's decision 19). The last sentence is
    NASA's AI guidance: outputs are the product's, with no review implied and no accuracy vouched for.
  - `smoothing`: "A weather station's anomaly is spread over every cell within 1 200 km, and over
    ice-free ocean the value is a sea-surface anomaly (NOAA ERSST v5). A colored cell need not
    contain a thermometer."
  - `coverage`: "Cells with no estimate are null, not zero. Data covered <x> % of Earth's surface in
    1880 and <y> % in <last complete year>."
  - `partial`: "<year> is partial: the mean of <n> published months (Jan–<Mon>), not comparable cell
    by cell with full years." When no partial year is in `steps`: "No partial year is included;
    <year>'s months so far are in the month rows."
  - `figures`: "globalAnomalyC is GISS's own global mean (GLB.Ts+dSST.csv). north64AnomalyC and
    south64AnomalyC are this app's area-weighted means of the map's cells with data north of 64° N and
    south of 64° S, as its Arctic and Antarctic readings show them, not GISS's zonal means. The warmest
    and coldest cells are this app's too, from the map's cells." (64 is computed from the 13 rows.)
- **`"year"`, one per step**:
  ```
  { "kind": "year", "year": 2025, "months": 12, "partial": false,
    "globalAnomalyC": 1.19,                     // = steps[].globalMean
    "north64AnomalyC": 2.97,                    // the pole means, below: rows 0–12 (90–64° N); null if no cell has a value
    "south64AnomalyC": 1.54,                    // rows 77–89 (64–90° S)
    "coveragePercentOfSurface": 99.2,           // coverage.area × 100
    "cellsWithData": 16019,
    "cellsAbove4C": 872, "cellsBelowMinus4C": 0,
    "warmestCellC": 5.3, "warmestCell": "78–80° N, 56–58° E",
    "coldestCellC": -1.9, "coldestCell": "…" }
  ```
  `warmestCell` and `coldestCell` are the cell's bounds, written as the card writes them. Ties go to
  the first cell in row-major order. The values above are illustrative, except
  `globalAnomalyC 1.19`, `north64AnomalyC 2.97` and `south64AnomalyC 1.54` (*measured* on the demo).
- **The pole means** are the app's Arctic and Antarctic readings, to the hundredth: js/data.js
  `capMean` on the frame's own bytes, computed by `build_snapshot.cap_mean` the same way. Over the 13
  rows nearest the pole, each cell with a value adds `w · q` and `w`, where `q` is its tenths and
  `w = cos(((89 − 2·row) · π) / 180)`, row by row from the pole and column by column from 180° W; the
  mean is `|s| / w · 10` hundredths, rounded half away from zero with any value within 1e−9 of a tie
  counted as a tie, and signed as `s`. The tie rule matters when every cell with a value lies in one
  row: the mean is then exactly 10·S/C hundredths, and floating point lands a hair below it (the
  Antarctic in 1888, 1894 and 1896: 40 cells in 64–66° S, exactly 0.175, 0.005 and 0.535 °C, so +0.18,
  +0.01 and +0.54). Every other mean of the demo lies at least 3.46e−4 of a hundredth from a tie, so a
  cos that differs in its last bit between the runner's libm and the phone's cannot move it.
  `verify_snapshot.py` recomputes all of them from the shipped frames, and `test_decode.mjs` through
  the app's own code (342 of 342 equal). Until the lead's pass, `north64AnomalyC` came from unrounded
  monthly means, and 40 of 171 steps differed from the chip at the second decimal.
- **`"month"`, the newest months**:
  `{kind, month, globalAnomalyC, north64AnomalyC, south64AnomalyC, coveragePercentOfSurface,
  cellsAbove4C, cellsBelowMinus4C, warmestCellC, warmestCell, coldestCellC, coldestCell}`. There are 24 rows,
  trimmed from the oldest when `6 + steps + 24 > 200`. That first happens when the 171st year is
  added, in 2050.
- *Measured* on a prototype with 5 notes, 147 years and 24 months, carrying fewer fields than above:
  176 rows, 28 622 B. With these fields the estimate is ≈ 45 000 B. The cap is 60 000.
- *Measured* on the demo after the lead's pass: 177 rows, **58 976 B** (notes 1 735 B, a year row
  340 B on average, a month row 300 B). At the 200-row cap that projects to about 66 700 B, or
  68 500 B with every row as wide as the widest, so the row cap still binds before the 70 000 B cap
  (Builder's decision 2), with about 1.5 KB to spare at worst.

---

## 4. Decoding (the app's side, `js/data.js`)

```
for each step s of steps, then months:              // layer index = position in that order
  b64 = s.planes["anom.v"]
  bytes = inflate_zlib(base64_decode(b64), cap = 16200)   // DecompressionStream('deflate'), else the copied inflater
  require bytes.length == 16200
  value(k) = bytes[k] == 255 ? none : layers[0].planes.v.offset + layers[0].planes.v.step * bytes[k]
cell under (lon, lat):
  i = min(179, floor((wrap180(lon) + 180) / 2)),  j = clamp(floor((90 − lat) / 2), 0, 89),  k = j·180 + i
```

The value at a cell is the stored tenth. To show it, print `round(value × 10)` tenths with one
decimal, so a value of −0.05 prints `0.0` or `−0.1` exactly as stored, never through a float
`toFixed` of `−12.7 + 0.1·b`. The same applies to the app's tests.

---

## 5. `assets/` and `../CREDITS.txt` (`build_static.py`; committed; never rewritten by the refresh)

### 5.1 `assets/world.json`: Global Weather's format, from Natural Earth v5.1.2

```
{ "v": 1,
  "source": "Natural Earth 1:50m v5.1.2 (public domain), commit f1890d9f",
  "units": "hundredths of a degree, delta-encoded [lon0, lat0, dlon, dlat, ...]",
  "land":    [ [ [ring], [ring], … ], … ],   // per polygon of ne_50m_land: its rings (outer first)
  "borders": [ [line], … ],                  // ne_50m_admin_0_boundary_lines_land
  "lakes":   [ [ [ring], … ], … ] }          // ne_50m_lakes polygons whose area is ≥ 5 000 km²
```

- Each ring or line is `common.delta_encode()`: the first pair is absolute hundredths of a degree
  (lon, lat), and each later pair is the difference from the previous one.
- Rings are simplified with `common.simplify()` (Visvalingam–Whyatt) to the tolerance that keeps the
  file within its cap. Rings left with fewer than 4 points are dropped.
- The app reads `land` and `borders` exactly as Global Weather's `buildWorldPaths` does. `lakes` is
  extra, and Global Weather's reader would ignore it.
- A lake's area is computed on the sphere, with the spherical excess of the ring (R = 6 371 km).
  The count is printed.
- Caps: 420 000 B. Global Weather's comparable file is 359 992 B (*measured*).

### 5.2 `assets/places.json`

```
[ { "n": "Fairbanks", "lon": -147.71, "lat": 64.84, "r": 3 }, … ]   // sorted by r, then n
```

- All 1 251 features of `ne_50m_populated_places_simple` (*measured* count). `n` is `name` with
  runs of whitespace collapsed (the file has `"Washington,  D.C."`). `lon` and `lat` are rounded to
  0.01.
- Tiers: `r` 1 = `scalerank` 0 (27 places); `r` 2 = `scalerank` 1–2 (159); `r` 3 = `scalerank` 3
  (336), plus any place at |lat| ≥ 60° whatever its rank (Longyearbyen, McMurdo Station), so the
  pole views have names; `r` 4 = the rest.
- Cap 70 000 B. *Measured*: the 1 128 places with `scalerank` ≤ 4 make 53 370 B in this shape.

### 5.3 `assets/about.json`

```
{ "v": 1,
  "sections": [ { "id": "colors", "title": "What the colors mean",
                  "paragraphs": [ "…", "…" ] }, … ],          // DESIGN §3.6's nine sections, in order
  "static": [ { "id": "natural-earth", "name": "Natural Earth 1:50m v5.1.2",
                "credit": "Coastlines, borders and city names: Made with Natural Earth (public domain).",
                "licence": "Public domain (Natural Earth's own dedication)",
                "url": "https://www.naturalearthdata.com/" } ],
  "endorsement": "NASA does not endorse this app. It uses NASA's published data, as NASA's media guidelines allow for factual use." }
```

Paragraphs may hold placeholders, which the app fills from the snapshot. An unknown placeholder is
a test failure (`verify_static.py` and `test_decode.mjs`). There are no others:

| Placeholder | Filled with |
| --- | --- |
| `{coverage:YYYY}` | that year's `coverage.area` as a percentage, 1 decimal (`82.7 %`) |
| `{coverage:last}` | the same, for the newest complete year |
| `{lastComplete}` | the newest complete year |
| `{partialLabel}` | the partial step's `label`, or "No partial year is shown at the moment." |
| `{newestMonth}` | `release.newestMonth` as "August 2026" |
| `{releaseCreated}` | `release.created`'s date, `2026-09-08` |
| `{accessed}` | `release.retrieved` |
| `{firstYear}` | `steps[0].year` (1880) |

The prose is US English with SI units and U+202F, and it names no AI vendor. The quotations come
from RESEARCH §2 and are marked as quotations.

### 5.4 `../CREDITS.txt`

Plain text, one block per source:
- GISTEMP: name, owner, URL, licence, the attribution line, both citations with "Dataset accessed
  <date of the demo build>" (the phone's About shows the live access date from the snapshot), and
  the endorsement sentence.
- GHCNm v4, ERSST v5 and Hansen et al. 2010: cited as inputs and method, from `sources.CITED`.
- Natural Earth: the credit and the licence's own words.
- The fonts, if ART vendors any, with their licence names.

Cap 30 000 B.

---

### 5.5 `assets/climatology.json` (plan 0012 3.3; `tools/climatology/build_climatology.py`, not the pipeline)

A static file, built once, like `world.json`; the refresh never touches it, and the pipeline's
`build_static.py` only reads its `credits` block for `CREDITS.txt` (with
`tools/climatology/pipeline-0012.patch` applied). Keys in this order: `v` (1), `app`
(`"Warming World"`), `what`, `variable` (`"2 m air temperature"`), `period` (`"1951-1980"`), `grid`
(as §3.3's), `plane` (`{"offset": -80.0, "step": 0.5, "unit": "°C", "none": 255}`), `encoding`
(`{"compression": "deflate", "delta": "row", "order": [Jan … Dec, "year"]}`), `method` (the build's
steps, in words), `globalMeanTenths` (13 integers: each plane's area mean, cos-latitude weights, in
tenths, for the decode test), `source` (name, owner, licence, attribution, citation, url, use: About's
block), `credits` (CREDITS.txt's section), `planes` (13 strings).

A plane is the 16 200 cells north first, one byte each, value `offset + step · byte` °C, 255 for none
(none occur). Each byte is stored minus the byte west of it, mod 256, from 0 at 179° W (a row delta),
then zlib-compressed and base64-encoded. `js/measure.js` checks the shape (`checkClim`), inflates each
plane to exactly 16 200 bytes with the snapshot's inflater, undoes the delta and keeps tenths
(`−800 + 5 · byte`); a 14th plane, the partial year's, is the mean of its months' planes in tenths,
half away from zero. The year is the plain mean of the 12 months, as GISS's annual anomaly is. Cap
120 000 B (`tools/check.mjs`); 100 922 B as built on 2026-10-06 (101 349 B before the citation was corrected the same day).

## 6. Determinism

- `build_static.py` writes `assets/*.json` and `../CREDITS.txt` through `common.write_json()` /
  `write_bin()`. Keys are in the order given here, floats rounded as stated, compact separators.
  There is no clock: the only date is `common.RETRIEVED`. **Two runs from the same cache give
  byte-identical files.**
- `refresh.py`, from the same grid and table bytes, gives the same snapshot except `generatedAt`,
  `sources[].readAt` and `release.retrieved`. With `--generated-at <iso>` (tests and the demo
  rebuild) it gives identical bytes. zlib's level-9 output is deterministic for the same input and
  library.
- `write_json` keeps the previous file's `generatedAt` when everything else is equal, so re-running
  on unchanged inputs does not change the file.

## 7. Budgets (asserted before writing; a run over any cap writes nothing)

| File | Cap | Now |
| --- | --: | --- |
| `data/snapshot.json` | 1 500 000 B | 1 151 893 B, 814 608 B deflated (the demo, lead's pass; 1 118 942 B on the prototype) |
| each frame, inflated | exactly 16 200 B | — |
| layers (`steps` + `months`) | 256 | 171 |
| `ask` | 200 rows and 70 000 B (Builder's decision 2) | 177 rows, 58 976 B (lead's pass; 28 622 B on the prototype) |
| `assets/world.json` | 420 000 B | 361 123 B |
| `assets/places.json` | 70 000 B | 59 509 B |
| `assets/about.json` | 40 000 B | 6 510 B |
| `../CREDITS.txt` | 30 000 B | 7 713 B |
| the ZIP (`tools/check.mjs`, as `build-zips.yml` builds it) | 2 000 000 B | about 1.17 MB (`check.mjs`; the app's NOTES give the byte count) |

## 8. Validation: fail loudly, write nothing

### 8.1 `refresh.py`, every run (exit 1 on any failure; the message names the check and the numbers)

- **V1 The file's contract**: every row of §1.1.
- **V2 The table**: the header exactly as in §1.2; years contiguous from 1880; every complete year
  has 12 months and a `J-D`; the newest year's missing months are `***` and come only after its
  published ones.
- **V3 Shape**:
  - every frame is 16 200 bytes;
  - `steps` are contiguous from 1880 to the newest complete year, plus the partial year exactly when
    6 ≤ n ≤ 11;
  - `months` has 24 consecutive months ending at `release.newestMonth`;
  - layers ≤ 256.
- **V4 Orientation**: snapshot row 0 is source row 89 (`lat` 89). Asserted on the data: the first
  frame's row 0 equals the source's last row after the rule.
- **V5 No clipping**: every tenth is in −127 … +127. Otherwise fail; never clamp. *Measured*: annual
  −6.37 … +6.43, last 24 months −6.08 … +11.68.
- **V6 GISS's own table**: for every complete year, |`gridMean` (unrounded) − `J-D`| ≤ **0.05 °C**.
  It prints the maximum, its year and the RMS. *Measured*: maximum 0.031 °C (1884), RMS 0.0095,
  over 146 years. No monthly check at ±0.05 (one month in 1 759 is off by 0.054). Monthly agreement
  is printed, not asserted.
- **V7 The same release**: in `live` mode, the table's newest month equals the grid's. In `research`
  mode the table may be one month newer (§10.2), and only the grid's months are used.
- **V8 Freshness**: the run's UTC date minus the first day of the month after `newestMonth` is at
  most **60 days**. A run on the 15th normally sees 15 days, or 45 when one release is late. In
  `research` mode the check is skipped, and `release.mode` says so.
- **V9 Coverage sanity**: the newest complete year has `coverage.area` ≥ 0.98, 1880's is in
  [0.70, 0.95], and no year is under 0.60. *Measured*: 0.9922 in 2025, 0.8265 in 1880.
- **V10 None means none**: in every frame, the 255 count equals the count of cells failing their
  rule, and no cell with data holds 255.
- **V11 Sizes**: the §7 caps.
- **V12 Round trip**: the written file is read back, every plane inflated and compared byte for
  byte with the frames in memory, and the top-level key order checked.
- **V13 Text**: every `label`, `ask` text and `sources` string is NFC, with no control characters and
  no AI vendor name; none attributes a statement to NASA ("according to NASA", "NASA says", …); and
  no number is followed by a plain space and °C, km or % (GISS's `history` is verbatim and exempt).

### 8.2 `verify_snapshot.py` (independent; the standard library only)

It reads a written snapshot and the cached grid and table, and re-checks V3, V4, V5, V10 and V11
with its own decoder. It recomputes three annual frames (1880, 1950 and the newest complete year)
and three months (the first, the 12th and the newest) from the grid with **separately written** code
(not `gistemp.py`), and compares bytes exactly. It checks every `globalMean` against the table and
`release.id` against the file. It prints each figure and exits 1 on any difference. Since the lead's
pass it also recomputes both pole means of every `ask` row from the shipped frames with its own copy
of `capMean` (§3.8) and requires them equal, requires the source note's NASA clause (and the
newer-table clause exactly when the table is newer), and fails on a string that attributes a
statement to NASA or has a plain space before °C, km or %.

### 8.3 `verify_static.py`

It checks:
- `world.json`'s keys, ring lengths ≥ 4, and every decoded coordinate within ±180 / ±90;
- `places.json`'s 1 251 entries, fields and tier counts;
- `about.json`'s sections in DESIGN §3.6's order, with no unknown placeholder;
- `CREDITS.txt` contains the attribution line, both citations and the endorsement sentence;
- since the lead's pass: the attribution sentence pinned verbatim (with its U+202F), equal in
  `sources.py`, the snapshot and `CREDITS.txt`; no plain space or line break before °C, km or % in
  `CREDITS.txt`; About's Antarctic shares by area (38 % in 1955, 93 % in 1957, re-derived with the
  Antarctic reading's weights and rounding);
- the §7 caps.

## 9. Reference for the app's decoder test: `tools/ref/snapshot_ref.json`

`refresh.py --ref` writes it next to the demo snapshot. It is committed, and its file is overwritten
whenever the demo snapshot is. Its `generatedAt` is the snapshot's, never an older stamp kept
because its cells did not change (`write_json(keep_stamp=False)`, lead's pass).

```
{ "release": "<release.id>", "generatedAt": "<the demo's>",
  "cells": [ { "step": "2025", "row": 12, "col": 16, "c": 3.4 },           // c: °C to 0.1, or null
             { "step": "1880", "row": 85, "col": 90, "c": null }, … ],
  "partialLabel": "2026, Jan–Jul (partial)",
  "counts": { "steps": 147, "months": 24 } }
```

- 60 cells come from a seeded generator (seed 20260930), drawn from `steps` and `months`.
- Fixed cells are added: the Fairbanks cell (row 12, col 16: 66–64° N, 148–146° W) in the newest
  complete year and in 1880; a cell at 88–90° S; one at 180–178° W on the equator; and the warmest
  cell of the newest complete year.
- Each `c` is computed by `gistemp.py` from the integers (§3.6). It is not decoded from the
  snapshot, so the test compares two routes to the same number.

## 10. How `refresh.py` builds it (monthly; standard library + `requests`)

### 10.1 Live mode (the runner)

1. GET the table, then the grid: **one URL at a time with a 2 s pause** (GISS refused a second
   connection while the first was streaming, RESEARCH §3). Use `common.http_get` with retries and a
   resumed Range request for a dropped transfer, into `scripts/warming_world/cache/live/`. Record
   bytes, sha256, `Last-Modified` and the read time.
2. gunzip in memory, parse with `netcdf3.NetCDF3`, check V1 and V2.
3. **Skip**: if `--skip-release <id>` equals this release's `newestMonth/created`, print "release
   <id> is already published" and exit 0 **without writing** (unless `--force`). This is the
   workflow's "nothing new" path.
4. Build the frames month by month with `netcdf3.frame()` (pure Python, *measured* 3.2 s for 146
   years). Then build the steps (§3.4–3.6), `sources` (§3.7) and `ask` (§3.8).
5. Run V3–V13. Then write through `common.write_json(max_bytes=1_500_000)`.
6. `--ref` writes §9's file. `--out` sets the path (default `../../warming-world/data/snapshot.json`
   relative to the script; the workflow writes `out/warming-world/data/snapshot.json`).

### 10.2 Research mode (`--source research`)

While data.giss.nasa.gov refuses connections (RESEARCH §3), the demo snapshot on `main` can be built
from the pinned Internet Archive copies in `sources.GISTEMP_RESEARCH`, checked by sha256:
- `release.mode` is `"research"`, and `sources[].via` names the capture;
- V8 is skipped;
- V7 allows the table one month newer, with the stripes and the partial year cut to the grid's
  months.

The app shows the release as it would any other. About §6 prints `via` when it is set ("read from
the Internet Archive's copy of GISS's file"), so a research build is never passed off as a live
read. The first live run replaces it.

### 10.3 The workflow (`refresh-warming-world.yml`, written by the pipeline stage)

- **When**: `cron: '41 6 15 * *'` and `'41 6 22 * *'` (the second catches a late release and costs
  only the downloads when nothing changed). Also `workflow_dispatch` with `force`, and a push to
  `main` touching `scripts/warming_world/{refresh,gistemp,netcdf3,common,sources,verify_snapshot}.py`
  or the workflow itself, never the demo snapshot.
- **Installs** `requests` only (`python3 -m pip install 'requests>=2.32'`). It does **not** install
  numpy: the refresh does not use it, and the workflow says so in a comment.
- **What is published already**: fetch `data-warming-world`, read `release.id` from
  `warming-world/data/snapshot.json` with a one-line `python3 -c`, flatten newlines (Global
  Weather's guard), and pass it as `--skip-release`. Then run `verify_snapshot.py` on the new file.
- **Publish**: Global Weather's step, unchanged in shape:
  - the branch-name guard (`''|main|master|"$GITHUB_REF_NAME"` refused);
  - `git init -b data-warming-world` in `out/`, one parentless commit, `git push --force` with four
    retries;
  - the commit message `warming-world: GISTEMP release <release.id>, published <UTC time>`;
  - `permissions: contents: write`; `concurrency: refresh-warming-world`.
- `publish-web.yml`: `Refresh warming-world` added to `workflow_run.workflows`, and `warming-world`
  added to the `for app in …` loop that takes live snapshots from data branches.

The Shortcut's addresses (for MANUAL_STEPS):
- public: `https://raw.githubusercontent.com/OWNER/REPO/data-warming-world/warming-world/data/snapshot.json`;
- private: `https://api.github.com/repos/OWNER/REPO/contents/warming-world/data/snapshot.json?ref=data-warming-world`
  with `Accept: application/vnd.github.raw` and the read token.

## 11. Measurements behind the numbers

All on 2026-09-30, from the research copies (`cache/wayback/`).
- `tools/bench/make_frames.py` (in `warming-world/`, run with `scripts/warming_world/.venv`). Its
  rounding is numpy's `sign · floor(|x|·10 + 0.5)` on the float mean. A scratch check compared it
  with §3.6's integer `round_div` on the same file. It printed `annual cells 2102204 float vs
  integer differ 0 exact ties 17545 | last-24 months differ 0`, so the two agree on these data,
  ties included. The pipeline still uses the integer rule. `make_frames.py` printed:
  - `months 1759`, `annual frames 147`, `monthly 24`;
  - coverage (area, cells): 1880 (0.8265, 0.6800), 1900 (0.8991, 0.7621), 1950 (0.9513, 0.8646),
    1980 (0.9895, 0.9823), 2000 (0.9918, 0.9880), 2025 (0.9922, 0.9888), 2026 with 7 months
    (0.9949, 0.9925);
  - `annual b64 856328 deflated 642084`, `monthly b64 200072`, `bench.json 1063989`.
- A prototype of §3's shape (scratch script, not committed) wrote 1 118 942 B, 807 822 B at zlib
  level 6, with 176 `ask` rows of 28 622 B. It also measured the table's ranges: `J-D` −0.49 … +1.29,
  months −0.82 … +1.48, and the newest 24 months 1.02 … 1.38 °C.
- RESEARCH §1.4–§1.12 measured the annual rule, the agreement with the table (max 0.031, RMS 0.0095),
  the clip shares, the value ranges and the delta comparison (738 832 against 641 918 B, ×1.151).

---

## Builder's decisions (the pipeline stage, 2026-10-01 UTC)

Where this contract was silent, or a number in it did not reproduce, the pipeline decided as below.
Each item names the check that holds it. The run's output is in `HANDOFF.md`.

1. **File names.** The code is `scripts/warming_world/build_snapshot.py` (fetch, build, V1–V13,
   write) over `gistemp.py` (the maths). `refresh.py`, the name this contract and the workflow use,
   runs `build_snapshot.py`'s `main()` and nothing else, so every "`refresh.py`" above means that
   code. `--ref` (written by `build_snapshot.py`) also writes the GISTEMP credits fragment.
2. **`ask` cap: 70 000 B, not 60 000** (§3.8, §7). Measured: 177 rows, **54 524 B** (the estimate
   was ≈ 45 000), 310 B a data row on average. At the 200-row cap that is about 61 500 B, so a
   60 000 cap would have failed a refresh in about 2044, years before the row cap bites (2050). At
   70 000 the row cap is always the binding one. The snapshot's 1 500 000 cap is unchanged. (Lead's
   pass: with `south64AnomalyC` and the longer notes, 58 976 B now and about 66 700 B projected at
   200 rows, 68 500 B at worst; the row cap still binds first, §3.8.)
3. **`north64AnomalyC` is area-weighted, as §3.8 says: +2.97 for 2025, not 3.37.** The 3.37 in §3.8
   and RESEARCH §1.6 is the *unweighted* mean of the 2 340 cells north of 64° N (reproduced:
   3.3755); weighting by cos latitude gives 2.97. The definition stands; the example number was
   wrong. (Lead's pass: it is now computed from the map's 0.1 °C cells as the chip computes it, with
   `south64AnomalyC` beside it; §3.8, "The pole means".)
4. **`beyondScale.above` for 2025 is 846, not 872.** The contract's rule (decoded tenths > 40) gives
   846; ≥ 4.0 gives 904; RESEARCH's 872 counted unrounded means above 4. The shipped count is the
   one the legend shows. DESIGN §6.2, §7.1 and §7.3's examples were updated to 846.
5. **The Arctic is fully colored in every year from 1946, not 1940.** Measured on the demo's annual
   frames (rows 0–12): full in 1931–33 and 1936–42, gaps in 1934–35 and 1943–45, full every year
   from 1946. RESEARCH §4's "100 % from 1940" did not reproduce. About §3 says "in every year from
   1946 on, and in some years from 1931"; DESIGN §3.6 item 3 was corrected; `verify_static.py`
   asserts the years and the sentence together.
6. **Every number the About prose types is re-derived** by `verify_static.py` from the demo
   snapshot, and the sentence stating it must be present word for word (`SENTENCES`): the Arctic
   years, Antarctica's share of its area with data, 38 % (0.3820) in 1955 and 93 % (0.9266) in 1957
   (by cells 29 % and 96 %, as RESEARCH records; restated by area in the lead's pass), 179 of 2025's 181 gray cells
   in 54–70° S, the 2025 January–July difference (0.297 °C, "about 0.3"), "a few hundredths"
   (0.031), the rules (9 of 12, 6, three quarters) and NCEI's "26,000" stations. Any other numeral
   in the prose fails the check until it is listed. Every quotation (“…”) must appear verbatim in
   `credits/gistemp-page-and-faq.txt`.
7. **About's "gray" sentence names both causes**: GISS made no estimate, or the year's cell has
   fewer than 9 of its 12 months (DESIGN §3.6 item 1 named only the first).
8. **`coveragePercentOfSurface` = round(`coverage.area` × 100, 1)** from the 4-decimal figure, not
   from the unrounded area, so the two never disagree by double rounding (`verify_snapshot.py`
   caught 1884: 83.7 against 83.8).
9. **Research mode's dates.** `readAt` is the pinned time the research stage finished reading each
   copy (the cache files' mtimes: grid `2026-10-01T00:06:51Z`, table `2026-10-01T00:09:54Z`, in
   `sources.GISTEMP_RESEARCH`), never a time this run invents. `lastModified` is `null` (the
   archive's copy does not carry GISS's header). In both modes `release.retrieved` is the UTC date of
   the grid's `readAt`, so the citations read "Dataset accessed 2026-10-01".
10. **V8 runs before the skip** (§10.1 step 3). Otherwise a GISS that stopped publishing would turn
    every run into a green "already published".
11. **Live downloads.** A partial grid download over 6 h old is deleted before a resumed GET (it may
    belong to an older release; gzip's CRC would also catch a splice, but late). Each live read
    records its `Last-Modified` and read time in `cache/live/meta.json`, so `--source live --offline`
    and `verify_snapshot.py` work from the cache. `common.http_get` gained `headers_out`.
12. **SI grouping in the snapshot's own strings**: `source.detail` and `sources[0].name` say
    "1 200 km" with U+202F (§3.2 and §3.7 printed "1200 km"); the owner's rule wins over the
    example. GISS's file name and history keep their own spelling. (Lead's pass: U+202F before km,
    °C and % as well, in every string the pipeline writes; §3.2.)
13. **`verify_snapshot.py` recomputes all 171 frames**, not the six §8.2 names, byte for byte
    (2.8 s), plus coverage, `beyondScale` and `gridMean` of every step, every `globalMean` against
    the table, and 1 000 seeded cells against the source's exact mean (worst 0.0500 °C).
14. **`assets/world.json`**: Visvalingam–Whyatt at 1e7 m² (one dropped vertex's triangle is under one
    device pixel at the largest globe, zoom 4 at DPR 2). Measured: land and borders 456 517 B
    unsimplified, 339 429 B at 1e7; with 36 lakes ≥ 5 000 km² the file is **361 123 B** (cap
    420 000). 1 420 of 1 421 land polygons (one under 4 points), 391 of 393 border lines. Rings are
    closed (first point repeated), as in Global Weather's file. Lake areas by spherical excess;
    `verify_static.py` re-measures them with an equal-area shoelace (smallest 5 035 km²).
15. **`assets/places.json` tiers**: 27 / 159 / **409** / 656. §5.2's 336 for tier 3 is scalerank 3
    alone; 73 places at |lat| ≥ 60° are promoted to it.
16. **`assets/about.json`'s `static`** holds Natural Earth and Archivo (ART change list 15:
    `sources.ARCHIVO`, with the shipped font files pinned by size and sha256). `{partialLabel}`
    stands as its own paragraph, so "No partial year is shown at the moment." reads as a sentence.
17. **`CREDITS.txt` comes from credits fragments** in `scripts/warming_world/credits/fragments/`
    (Milky Way's rule): `gistemp.json` from `build_snapshot.py --ref` (the demo's release and access
    date, the captures read, the inputs' citations, the endorsement), `basemap.json`, `places.json`
    and `archivo.json` from `build_static.py`. So `build_all.sh` runs the snapshot first. An
    unclaimed fragment fails the build. 7 703 B (cap 30 000).
18. **`tools/ref/snapshot_ref.json`'s fixed cells**: the Fairbanks cell (row 12, col 16) in 2025 and
    1880; row 89, col 90 (88–90° S, 0–2° E) in 2025 and 1880; row 44, col 0 (0–2° N, 180–178° W) in
    2025; and 2025's warmest cell (80–82° N, 72–74° E, +5.3). 66 cells, 3 002 B.
19. **The `source` note** in research mode ends "Read from the Internet Archive's copies of GISS's
    files.", so Ask never passes a research build off as a live read. The cell bounds in `ask` are
    written as the card writes them: south latitudes ascending in magnitude ("62–64° S"), west
    longitudes from the cell's west edge ("148–146° W").
20. **The demo on `main` is a research build** (release `2026-07/2026-08-10T06:37:42`, partial 2026
    with 7 months), because data.giss.nasa.gov still refused connections at 01:06 UTC on 2026-10-01.
    HANDOFF "When GISS answers again" lists the steps that replace it.

## The lead's pass (2026-10-01)

What changed on the data side after the review pass (`../DESIGN.md` §22 has the app side). Each item
names the check that holds it. The run's output is in `HANDOFF.md`.

1. **The pole means are the chip's** (§3.8): `north64AnomalyC` from the frame's tenths, and a new
   `south64AnomalyC`, both by `build_snapshot.cap_mean`, both rounding exact ties away from zero.
   `verify_snapshot.py` recomputes all 342 from the shipped frames (0 differ, 3 exact ties, every
   other mean at least 3.46e−4 of a hundredth from a tie); `test_decode.mjs` compares them with the
   app's own `capMean` (0 differ). The ask rows grew from 54 524 B to 58 976 B (V11's count).
2. **NASA's AI guidance in the notes** (§3.8): the source note's last sentence, and V13's rule
   against a statement attributed to NASA. `credits/nasa-media-guidelines.txt`'s header no longer
   says the app runs no model on NASA data: Snuggery's Ask does, on these rows. The quotations are
   unchanged.
3. **The newer table, said** (§3.8): computed from `release.tableNewestMonth`, never typed.
4. **SI at the source** (§3.2): U+202F before °C, km, % and B in every string the pipeline writes
   (the attribution, the source detail and name, the notes, the credits fragments), checked by V13,
   `verify_snapshot.py`, `verify_static.py` and `check.mjs`.
5. **Licenses capitalized**: `sources.PUBLIC_DOMAIN_US` and Natural Earth's licence string, so
   every license line in About and `CREDITS.txt` starts with a capital ("Public domain …").
6. **About's Antarctic sentence by area** (§5.3, Builder's decision 6).
7. **The decoder reference's stamp is the demo's** (§9).
