# Research: sources, licences and decisions for US Quakes

The brief is `docs/plans/0010-four-showcase-apps.md`, "Idea 4 — US maps from USGS open data". This
file makes every source in it real on disk, pins what can be pinned, quotes each licence or set of
terms, and writes down what the plan left open. Every URL, count, size, hash and quirk below was
measured on **2026-09-30** from this machine, with the command named next to it; nothing here comes
from memory. It lives under `tools/` so it never ships inside the app's ZIP.

The pipeline is not in this folder: it is in `Template/scripts/us_quakes/`, because the hourly
refresh runs from `Template/scripts/` on a GitHub runner the way `scripts/global_weather.py` does.

| Where (under `Template/scripts/us_quakes/`) | What |
| --- | --- |
| `sources.py` | every source: URL, sha256 and bytes where the file is static, licence, attribution wording, retrieval date; for the queried and live sources, the contract (API version, columns, fields) instead of a hash |
| `fetch_catalog.py` → `catalog-windows.json` | ComCat for the four map boxes as CSV, split into windows under the 20,000-event limit, one request a second; the JSON records every window's query, count, rows, bytes and sha256 |
| `fetch_relief.py` | the 3DEP hillshade and its land-mask elevation raster per region, pinned |
| `probe.py`, `probe-urls.txt` | Shelf Atlas's shape: prints what every URL returns now; `--fetch` fills `cache/` and checks every static pin. `.github/workflows/probe-us-quakes.yml` runs the same file on a runner |
| `common.py`, `paths.py` | adapted from `scripts/shelf_atlas/common.py` and `earth-history/tools/{common,paths}.py` (copied, never imported): cache, `fetch_pinned()`, deterministic `write_json()`/`write_bin()` with size budgets, Visvalingam–Whyatt, polyline, bbox clipping, `unwrap_lon()`, shapefile reading; `RETRIEVED = '2026-09-30'`; standard library + `requests` at import time |
| `credits/` | licence and terms evidence: `usgs-terms.txt` (every USGS term quoted), `usgs-statements.txt` (the honesty notes' sources, quoted), the fault database's own FGDC metadata, both DataCite DOI records, the 3DEP service description, Natural Earth's `LICENSE.md` |
| `samples/` | saved responses: the three volcano endpoints and a three-feature excerpt of `all_day.geojson` |
| `requirements.txt` | pinned: requests 2.34.2, pyshp 3.1.6, pillow 12.3.0, numpy 2.5.3, pypdf 6.19.0, pyogrio 0.13.0 |

Verification commands, run from `Template/scripts/us_quakes/` (venv made with
`/opt/homebrew/bin/python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt`):

```
.venv/bin/python fetch_catalog.py --count-all
    # {"conus": [171429, 55, 31721447, 2688929], "ak": [143890, 37, 24735347, 991271],
    #  "hi": [39875, 14, 7662569, 270525], "pr": [42824, 14, 8099778, 71003]}
    # (rows, windows, bytes, every event since 1600 with no magnitude floor), exit 0
.venv/bin/python fetch_relief.py       # 10 lines "ok", five hillshades and five elevation rasters
.venv/bin/python probe.py --fetch      # 18 URLs, all 200; then 15 static pins + 5 relief pairs "ok", exit 0
```

The download cache is **69 MB of ComCat CSV** (`du -sh cache/comcat`) plus 32 MB for the fault ZIP,
56 MB of Natural Earth GeoJSON and 23 MB of relief. It is gitignored as `scripts/us_quakes/cache/`
(the line sits next to Shelf Atlas's in `Template/.gitignore`).

**Stop rule: not triggered.** ComCat downloaded in full; the 3DEP relief fetched and is
byte-reproducible; the fault database's metadata says `useconst: none`, `accconst: none`, and the
USGS page marks the database public domain. Nothing forbids redistribution in an MIT template.

---

## 1. Decisions

### The four map boxes
The plan names the regions but not their boxes. Chosen, as the FDSN service's own inclusive
parameters (in `sources.COMCAT['regions']`):

| Key | Region | minlatitude | maxlatitude | minlongitude | maxlongitude |
| --- | --- | --- | --- | --- | --- |
| `conus` | Lower 48 | 24 | 50 | -130 | -65 |
| `ak` | Alaska | 50 | 72 | 172 | 231 |
| `hi` | Hawaii | 18 | 23 | -161 | -154 |
| `pr` | Puerto Rico | 17 | 20 | -68 | -64 |

Alaska runs 172°E → 129°W written as **172…231**; the service accepts longitudes to ±360 and the
count came back 150,349 — four more than the planner's 150,345 the day before, so this is the box the
planner used. Hawaii (40,058 vs 40,057) and Puerto Rico (43,974 vs 43,972) likewise reproduce the
planner's boxes. The Lower 48 does not: the planner's 167,966 sits between the `-125…-65` box
(165,130) and this one. **This box reaches 130°W** so the Juan de Fuca and Gorda plates and the
Blanco and Mendocino fracture zones — the Cascadia story's offshore half — are inside it (173,094).
Every box is a box, not a border: the Lower 48's takes in northern Mexico and southern British
Columbia, Puerto Rico's takes in the Virgin Islands, and the app says "the map box", not "the United
States", wherever it counts. The boxes meet only along 50°N between 130° and 129°W; the download
held **0 duplicate ids across boxes**, and the build de-duplicates by id anyway.

### Two eras, every event type cached, earthquakes drawn
- **Before 1900: every event, magnitude or not** (631 events: Lower 48 493, Alaska 64, Hawaii 61,
  Puerto Rico 13; 186 have no magnitude). **From 1900: M2.5 and up.** A minimum-magnitude filter
  drops events with no magnitude, so a single M2.5+ query since 1600 would lose those 186.
- The cache keeps **every event type** (the service's default); the build filters. Of the 398,018
  rows, 385,076 are `earthquake`; the rest are explosions (5,679), quarry blasts (3,224), mining
  explosions (2,663), **nuclear explosions (673)**, ice quakes (220), "other event" (184), rock
  bursts (161), volcanic eruptions (64) and 17 rarer labels (including one `train crash` and one
  `not existing`). **The map draws `earthquake` only.** The nuclear tests are a real, striking layer
  (Nevada), but they are not earthquakes; they are a candidate for a later, labelled layer, never
  mixed into the dots.
- The count check in the plan's validation ("within 0.5 % of the count endpoint") must ask the same
  question the cache was filled with — all event types, the same box, the same eras. At download
  time the check is stricter than the plan's: **every window's CSV row count equalled the count the
  endpoint had returned a second earlier**, or `fetch_catalog.py` would have stopped. The 0.5 %
  tolerance applies at build time, when a fresh count to the cutoff meets windows cached months
  earlier (USGS revises, adds and deletes events).

### The history cutoff and the overlap
`history.bin` runs from 1627 (the oldest event: "Near Essex, Massachusetts") to **2026-01-01**. The
snapshot carries M2.5+ from **2025-01-01** (a year before the cutoff, the plan's rule) plus every
magnitude for the last 30 days. The overlap is de-duplicated by id: the live feed's `ids` field
lists every id an event has had (968 of the month's 10,520 events have more than one), so the build
and the app match on any of them, not only the preferred `id`. The yearly build (January) moves the
cutoff forward a year.

### Splitting under the 20,000 limit
The service refuses a query matching more than 20,000 events (`"maxAllowed":20000` in every count
answer; the error text: *"173094 matching events exceeds search limit of 20000. A query using these
search parameters would fail. Modify the search to match fewer events."*). `fetch_catalog.py` asks
the count first, and splits on a **fixed calendar ladder** — the whole era, decades, years, months,
days — rather than by bisection, so window edges stay the same from one run to the next and a
cached window is reused. Result: **120 windows** (Lower 48 55, Alaska 37, Hawaii 14, Puerto Rico
14), the largest 17,690 events (Puerto Rico, 2010–2019, one decade that stayed under the limit). One request a second,
counts included, as the brief asks. Every window ends on or before the cutoff, so every window is
**closed and cached for good**; `catalog-windows.json` (committed) records each window's query,
count, rows, bytes and sha256, which is the pin a hash-pinned static file would have.

### The snapshot must split too
M2.5+ earthquakes since 2025-01-01 across the four boxes: **20,761** (Lower 48 4,685, Alaska 13,190,
Hawaii 508, Puerto Rico 2,378; `count?starttime=2025-01-01&minmagnitude=2.5&eventtype=earthquake`
per box). That is over the limit as one query, so `refresh.py` queries **per box**, and per box per
calendar year once Alaska nears the limit (13,190 in 21 months; it would pass 20,000 at the current
rate only if the January rebuild were skipped). The last 30 days, all magnitudes, earthquakes only:
**9,684** (5,278 / 3,524 / 485 / 397). The hourly refresh reads `all_month.geojson` for those, and the
FDSN query once a day for the M2.5+ year (plan's rule).

### What "hollow" means
The plan draws "unreviewed automatic solutions hollow". ComCat's history holds **2,980 `automatic`
events, and one of them is the 1964 Prince William Sound M9.2** (`official19640328033616_30`, status
`automatic`). Drawing the second-largest earthquake ever recorded as a tentative solution would be
false. **Decision: hollow means an automatic solution in the live window** (the snapshot's 30
days, where "automatic" does mean "may change or vanish": 1,747 of the month's 10,520 feed events).
Historic events are drawn solid whatever their flag; the tap sheet states the flag as USGS lists it.

### Relief: Web Mercator from the server, masked by elevation, committed once
- One `exportImage` per region from the 3DEP Bare Earth DEM dynamic service with
  `renderingRule={"rasterFunction":"Hillshade Multidirectional"}`, **`bboxSR=4326&imageSR=3857`**, so
  the server returns Web Mercator and a pixel row is a map row — no reprojection in the pipeline.
  Sizes keep pixels square in Mercator: Lower 48 4096×2192; Alaska two requests either side of 180°,
  555 + 3541 = 4096 wide over 59° of longitude at one height, 3309, so the halves stitch exactly;
  Hawaii 2048×1458; Puerto Rico 2048×801.
- **The hillshade cannot tell sea from plains.** Inside a 3DEP tile the sea is elevation 0 and shades
  as flat land (grey value 242, the same as Kansas); outside any tile it is NoData (253). Seen in the
  Hawaii and Lower 48 thumbnails as square blocks over the sea. So each region also has an **Int16
  elevation raster at the same box and size** (`format=tiff&pixelType=S16&compression=LZ77`, NoData
  −32768; Pillow reads it as mode `I`, `tiff_lzw`) and the build keeps relief only where elevation
  is neither 0 nor NoData. Measured land pixels: Lower 48 6,058,098; Alaska east 4,721,458; Alaska
  west 2,963; Hawaii 182,644; Puerto Rico 286,350.
- The service is dynamic ("reflects all 3DEP DEM data published as of August 24, 2026"), so a later
  fetch may differ. The ten files are pinned (sources.py); two identical requests returned
  byte-identical PNGs, and after deleting `conus.png` and `hi.tif` a refetch matched both pins. **The
  shipped JPEGs are committed to `us-quakes/assets/`**, so the yearly history build never has to
  refetch relief; a relief refresh is a deliberate act that updates the pins.
- Relief is US-only: Canada, Mexico and the Bahamas are NoData, drawn as plain land from Natural
  Earth. The About page says so.

### Attribution wording: the National Map's own sentence
The plan's line "Data available from U.S. Geological Survey, National Geospatial Program." is a
shortening. The National Map's terms ask for, verbatim, **"Map services and data available from U.S.
Geological Survey, National Geospatial Program."** (`credits/usgs-terms.txt` §3). `sources.py` uses
the verbatim sentence: *"Relief: USGS 3D Elevation Program. Map services and data available from U.S.
Geological Survey, National Geospatial Program."*

### Faults: read the File Geodatabase, not the shapefile beside it
The ZIP carries the database twice. `SHP/Qfaults_US_Database.*` is dated 2020-10-19 and holds
**112,809** lines; `GDB/Qfaults_2020_WGS84.gdb`, layer `Qfaults_2020`, has files modified
2025-09-29 and holds **112,944**. The difference is 2025 edits in north-coastal California and New
Mexico: the Cascadia megathrust has **179** segments in the GDB against **140** in the SHP (39 added,
undated, `latest`/`late Quaternary`), the Mendocino fault zone +11, Little Salmon (offshore) +12, Mad
River +11 and others. The Cascadia cross-section preset and the 1700 story sit exactly there.

**Decision: the build reads the GDB with pyogrio 0.13.0** (its wheel bundles GDAL 3.12.4, so the
runner installs it with pip and nothing else). This departs from the plan's "no GDAL", whose reason —
no system install on a bare runner — still holds; only the yearly static build installs it, and
nothing of it ships. *What would change this:* if pyogrio will not install on the runner, read the
SHP (with the `.cpg` fix below) and list the 2025 edits as a known gap.

Also decided: the fault records' `fault_url` links are **not shipped**. They point at
`earthquake.usgs.gov/cfusion/qfault/show_report_AB_archive.cfm`, and the USGS page says *"As of
February 26, 2026, the Database Search function is retired."*

### Volcanoes: two HANS endpoints, never the Smithsonian one
- **Static list:** `getUSVolcanoes` — 170 US volcanoes with position, elevation, observatory and the
  NVEWS threat class; **148 fall inside the four boxes** (the other 22 are the Northern Marianas, 19,
  and American Samoa, 3, cut for v1).
- **Live layer:** `getMonitoredVolcanoes` — 69 monitored volcanoes, each with `alert_level`,
  `color_code`, `sent_utc` and its notice; 63 inside the boxes. (The six outside: three in American
  Samoa, Ahyi Seamount in the Marianas, and an entry named "Cascade Range" that has no record in the
  US list — a regional notice, skipped.)
- A volcano that is not monitored has **no** alert level, and the app says "not monitored", never
  "normal".
- Not used: `vsc/api/volcanoApi/volcanoesGVP` (1,470 world volcanoes with Smithsonian GVP pages);
  the plan left the Smithsonian database out over its non-commercial terms. The HANS endpoints use
  the Smithsonian volcano number (`vnum`) as an identifier; a number is not content.
- If the API fails or changes shape, the refresh keeps the last good status and the snapshot says
  when it was last read; if it has never been read, the layer shows the static list with no alert
  colours and says so (the plan's fallback).

### Natural Earth: 1:50m lines, 1:10m depth bands
Natural Earth v5.1.2 at commit `f1890d9f152c896d250a77557a5751a93d494776`: 1:50m coastline, land,
lakes (the Great Lakes matter on this map), state/province lines, country land borders and populated
places. **Natural Earth has no 1:50m bathymetry** — the depth bands exist only at 1:10m
(`ne_10m_bathymetry_{A_10000 … L_0}`) — so the depth bands come from 1:10m: 200, 1,000, 2,000,
3,000, 4,000, 5,000, 6,000 and 7,000 m (the Aleutian Trench passes 7,000 m). They are clipped to the
boxes and simplified at build time; 52 MB raw, a few hundred KB after. The coastline, land and places
hashes are identical to Earth's History's pins at the same commit.

### Units
Depth in **km**, distance in km, magnitudes as the catalogue gives them with their type (the plan's
"Rules for all four", D15: SI units by default, thousands grouped with a narrow no-break space,
never a comma).

### Left for the pipeline stage
- The `us-quakes` entry in `publish-web.yml`'s branch-data loop, added with `refresh-us-quakes.yml`
  so the loop never names a branch no workflow writes.
- The exact history layout (`history.json` beside `history.bin`, Milky Way's rule). Measured
  feasibility with the plan's field widths (time as minutes since 1600-01-01 in 4 bytes; longitude on
  the 172…296 axis at 0.002° and latitude from 17° at 0.001° in 2 bytes each; depth and magnitude as
  below): earthquakes only, 385,076 events → **4,235,836 bytes raw, 2,885,249 deflated** (level 9,
  columnar), **2,676,225** with time delta-coded. The ranges fit: longitude 172.0–296.0 → 62,000 steps,
  latitude 17.01–71.97 → 54,960 steps, minutes to 2026 ≈ 224 million < 2³². Depth needs a sign
  (min −3.74 km) and a "none" code (1,498 rows); magnitude needs a "none" code (186 rows). IDs for
  M4.5+ only: 15,490.
- Counts the history would ship at other floors: M3+ 162,409; M4+ 33,005 (earthquakes, all eras).

---

## 2. Sources

### 2.1 ComCat through the FDSN event web service
- **Service:** `https://earthquake.usgs.gov/fdsnws/event/1` — `GET /version` → `2.7.0` (200,
  text/plain). The `application.json` endpoint lists catalogs, contributors and product types.
- **Count queries**, 2026-09-30, all event types (`count?format=geojson&…`):

  | Box | M2.5+ since 1900 | every event 1600–1900 | M2.5+ since 1600 | M3+ since 1900 | M4+ since 1900 | every event 1600 → 2026-01-01, no floor |
  | --- | ---: | ---: | ---: | ---: | ---: | ---: |
  | Lower 48 | 173,094 | 493 | 173,465 | 68,845 | 11,428 | 2,688,929 |
  | Alaska | 150,349 | 64 | 150,359 | 71,087 | 20,367 | 991,271 |
  | Hawaii | 40,058 | 61 | 40,118 | 10,009 | 921 | 270,525 |
  | Puerto Rico | 43,974 | 13 | 43,977 | 22,207 | 998 | 71,003 |

  Query strings: `starttime=1900-01-01&minmagnitude=2.5&minlatitude=24&maxlatitude=50&minlongitude=-130&maxlongitude=-65`
  (Lower 48), `…&minlatitude=50&maxlatitude=72&minlongitude=172&maxlongitude=231` (Alaska),
  `…&minlatitude=18&maxlatitude=23&minlongitude=-161&maxlongitude=-154` (Hawaii),
  `…&minlatitude=17&maxlatitude=20&minlongitude=-68&maxlongitude=-64` (Puerto Rico); the other
  columns change `starttime`, `endtime` and `minmagnitude` only. The last column is the sum of
  per-decade counts (`catalog-windows.json`, `allEventsByDecade`), because the one-shot count fails
  (§3). Four million events, 1600 → 2026, is why the history has a floor.
- **Download:** `query?format=csv&orderby=time-asc&<box>&starttime=…&endtime=…[&minmagnitude=2.5]`,
  120 windows, **398,018 rows, 72,219,141 bytes**; per box 171,429 / 143,890 / 39,875 / 42,824 rows.
- **CSV columns** (checked on every window): `time, latitude, longitude, depth, mag, magType, nst,
  gap, dmin, rms, net, id, updated, place, type, horizontalError, depthError, magError, magNst,
  status, locationSource, magSource`. Longitudes come back in −180…180 (Alaska's western Aleutians as
  172…180); `common.unwrap_lon()` puts them on the app's 172…296 axis.
- **What is in it** (earthquakes and every other type, 398,018 rows): status `reviewed` 395,027,
  `automatic` 2,980, `manual` 11. magType `ml` 246,308, `md` 81,492, `mb` 24,989, `mc` 15,628, `Md`
  8,196 (a case variant of `md`), `mh` 5,884, `mw` 5,300, `mb_lg` 2,095, `mwr` 1,995, `mblg` 1,350,
  `m` 950, `mwc` 824, `mww` 742, `ms` 411, then 20 rarer labels (35 distinct in all, with case variants); 256 blank. Depth: 1,498 blank,
  **23,760 exactly 10 km**, 14,048 negative (min −3.74 km: above the reference datum), max 308.5 km.
  Magnitude: 186 blank, all before 1900. Magnitudes carry 0, 1 or 2 decimals, and 141 rows carry
  floating-point noise (up to 13 decimals).
- **The six known events survive the round trip** (searched in the cached CSVs):

  | Event | id | time (UTC) | lat, lon | depth | mag |
  | --- | --- | --- | --- | --- | --- |
  | 1700 Cascadia | `official17000127050000000` | 1700-01-27T05:00 | 45, −125 | none | 9 mw |
  | 1811 New Madrid | `official18111216081500000` | 1811-12-16T08:15 | 36, −89.96 | none | 7.5 mw |
  | 1906 San Francisco | `official19060418131226300_12` | 1906-04-18T13:12:26.3 | 37.75, −122.55 | 11.7 | 7.9 mw |
  | 1964 Prince William Sound | `official19640328033616_30` | 1964-03-28T03:36:16 | 60.908, −147.339 | 25 | 9.2 mw (status `automatic`) |
  | 2018 Anchorage | `ak018fcnsk91` | 2018-11-30T17:29:29.33 | 61.3464, −149.9552 | **46.7** | 7.1 mw |
  | 2019 Ridgecrest | `ci38457511` | 2019-07-06T03:19:53.04 | 35.7695, −117.5993 | 8 | 7.1 mw |

  New Madrid also has 1811-12-16 13:15 M7.0, 1812-01-23 M7.3 and 1812-02-07 M7.5.
- **Licence:** US Government work, public domain. The DOI record (DataCite,
  `credits/comcat-doi-10.5066-F7MS3QZH.datacite.json`): title *"Advanced National Seismic System
  (ANSS) Comprehensive Catalog"*, creator and publisher U.S. Geological Survey, 2017, no rights field;
  the terms are USGS's general ones, quoted in `credits/usgs-terms.txt` §1–2: *"USGS-authored or
  produced data and information are considered to be in the U.S. Public Domain."* and *"Most U.S.
  Geological Survey (USGS) information resides in the Public Domain and may be used without
  restriction. When using information from USGS information products, publications, or websites, we
  ask that proper credit be given."* Contributing networks include non-federal ones (university
  networks, the Oklahoma Geological Survey, TexNet); USGS distributes the merged catalogue on these
  terms, and neither the service nor the CSV states any other.
- **Citation:** U.S. Geological Survey, 2017, Advanced National Seismic System (ANSS) Comprehensive
  Catalog, doi:10.5066/F7MS3QZH. **On screen:** *"Earthquakes: U.S. Geological Survey, ANSS
  Comprehensive Earthquake Catalog (ComCat), doi:10.5066/F7MS3QZH; rounded and repacked."*

### 2.2 The GeoJSON summary feeds
- `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{all_day,all_week,all_month}.geojson` —
  200, `application/json; charset=utf-8`, `cache-control: public, max-age=60`; the documentation
  (`/earthquakes/feed/v1.0/geojson.php` and the feed index) says each is **"Updated every minute."**
- At 14:24 UTC: `all_day` 149,619 B, 209 events; `all_week` 1,341,773 B, 1,882; `all_month`
  7,474,795 B, 10,520 (the probe twenty minutes later: 145,417 / 1,337,487 / 7,473,376 B; 203 / 1,876
  / 10,518). `metadata`: `generated` (ms), `url`, `title`, `status` 200, **`api` "2.7.0"**, `count`.
  The feeds are worldwide; **9,686** of the month's events fall in the four boxes (1,143 of them M2.5+).
- **Properties** (every feature): `mag, place, time, updated, tz, url, detail, felt, cdi, mmi,
  alert, status, tsunami, sig, net, code, ids, sources, types, nst, dmin, rms, gap, magType, type,
  title`; geometry `[lon, lat, depth_km]`. The design's fields, in the month's file: `magType` (ml
  6,785, md 2,810, mb 772, mww 103, mwr 19, mb_lg 11, mw 10, mh 9, mun 1); `status` (reviewed 8,773,
  automatic 1,747); `felt` (non-null on 446); `tsunami` (1 on 10); `alert` (PAGER: green 56, orange
  1, null 10,463); `ids` (comma-wrapped, e.g. `,aka2026tjmqti,`; 968 with more than one id); depth
  exactly 10 km on 565, negative on 312; magnitudes −1.21 to 6.6; `type` earthquake 10,299, quarry
  blast 133, explosion 76, ice quake 9, mining explosion 2, landslide 1.
- Licence and attribution as §2.1 (the same catalogue). Sample: `samples/feed-all_day.excerpt.geojson`.

### 2.3 3DEP relief (The National Map)
- **Service:** `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer`
  (`?f=pjson`, 200, 12,981 B, saved as `credits/3dep-imageserver-info.json`): ArcGIS 11.3, Web
  Mercator (102100/3857), F32, one band, `maxImageWidth`/`Height` 8000, raster functions including
  `Hillshade Multidirectional`; *"Data available in this map service reflects all 3DEP DEM data
  published as of August 24, 2026."*; `copyrightText` *"USGS National Map 3D Elevation Program
  (3DEP). August 25, 2026."*
- **Requests** (`exportImage`, all with `bboxSR=4326&imageSR=3857&interpolation=RSP_BilinearInterpolation&f=image`):

  | File | bbox (W,S,E,N) | size | hillshade PNG (`format=png&pixelType=U8&renderingRule=…`) | elevation TIFF (`format=tiff&pixelType=S16&compression=LZ77&noData=-32768`) |
  | --- | --- | --- | ---: | ---: |
  | conus | −128, 23.5, −65, 50 | 4096×2192 | 2,596,191 B `7bd89e4b…` | 8,673,794 B `5322416e…` |
  | ak-west | 172, 50, 180, 72 | 555×3309 | 12,707 B `873fe937…` | 71,144 B `74845b8a…` |
  | ak-east | −180, 50, −129, 72 | 3541×3309 | 2,580,580 B `5fe0f4ef…` | 7,355,538 B `e2dffa06…` |
  | hi | −160.5, 18.5, −154.5, 22.5 | 2048×1458 | 118,202 B `f02345a1…` | 434,646 B `e7192829…` |
  | pr | −68, 17.5, −64.5, 18.8 | 2048×801 | 194,894 B `1c9b9728…` | 433,781 B `49f46160…` |

  Full hashes in `sources.RELIEF_PINS` and `RELIEF_DEM_PINS`. Example URL (Hawaii hillshade):
  `…/exportImage?bbox=-160.5,18.5,-154.5,22.5&bboxSR=4326&imageSR=3857&size=2048,1458&format=png&pixelType=U8&interpolation=RSP_BilinearInterpolation&renderingRule=%7B%22rasterFunction%22%3A%22Hillshade%20Multidirectional%22%7D&f=image`.
- **Quirks:** the multidirectional hillshade is pale (flat ground 242 of 255; darkest values 33–63),
  so the build stretches levels — a display transform of a measured product, labelled "shaded
  relief". Elevation extremes in the masks: Lower 48 −173 to 4,164 m, Alaska east −14 to 5,974 m,
  Hawaii 0 to 4,147 m. Lakes with surveyed bottoms can carry negative values and count as land in the
  mask; Natural Earth's lakes are drawn over them.
- **Licence** (`credits/usgs-terms.txt` §3, verbatim): *"Map services and data downloaded from The
  National Map are free and in the public domain. There are no restrictions; however, we request that
  the following acknowledgment statement of the originating agency be included in products and data
  derived from our map services when citing, copying, or reprinting: "Map services and data available
  from U.S. Geological Survey, National Geospatial Program.""* US Government work.

### 2.4 Quaternary Fault and Fold Database of the United States
- **File:** `https://earthquake.usgs.gov/static/lfs/nshm/qfaults/Qfaults_GIS.zip` — 200,
  application/zip, **32,371,696 B** (the page says "16 MB"), sha256
  `447eadc5926256710d988c30e5996ba540604caa0154f9746c48bad637926893`, Last-Modified Mon, 23 Feb 2026
  22:08:26 GMT. Linked from `https://www.usgs.gov/programs/earthquake-hazards/faults` ("GIS files (16
  MB ZIP file)"; the other link is `qfaults.kmz`, 13 MB). 108 members, 304,188,931 B unpacked.
- **Contents:** `SHP/Qfaults_US_Database.{shp,dbf,…}` (22 MB geometry, 203 MB attributes, 2020-10-19;
  `.cpg` **UTF-8**; `.prj` GCS WGS 1984), `SHP/ca_offshore.*`, `SHP/fault_areas.*`, two citation
  spreadsheets, two ArcMap `.lyr` files, and `GDB/Qfaults_2020_WGS84.gdb` with layers `Qfaults_2020`
  (MultiLineString, **112,944**, EPSG:4326), `California_Offshore` (1,093), `fault_areas` (37) and
  citation tables (6,431 citations, 24,126 reference links).
- **Fields** (SHP names; the GDB spells them out): `fault_name, section_na, fault_id, section_id,
  Location, linetype, age, dip_direct, slip_rate, slip_sense, scale, class, certainty, strike,
  fault_leng, cooperator, earthquake, review_dat, fault_url, symbology, ref_id, Shape_Leng`. SHP
  counts: **112,809** lines, 993,315 vertices, 2,107 fault names, extent −180…180, 18.8…70.8°N.
  - `age`: latest Quaternary 38,893 · undifferentiated Quaternary 30,125 · late Quaternary 18,631
    (+282 capitalised "Late Quaternary") · historic 14,260 · middle and late Quaternary 6,155 ·
    class B 4,396 · unspecified 67.
  - `slip_rate`: < 0.2 mm/yr 44,166 · 0.2–1.0 17,112 · 1.0–5.0 16,667 · > 5.0 16,224 · Unspecified
    14,076 · blank 3,690 · Insufficient data 873.
  - `slip_sense`: Normal 54,158 · Right lateral 33,943 · Left lateral 6,195 · Thrust 5,056 · Reverse
    3,134 · blank/unspecified ≈ 9,600 · folds (anticline, syncline, monocline) 167.
  - `linetype`: Well Constrained 67,720 · Moderately Constrained 24,037 · Inferred 21,052.
  - `class`: A 106,043 · B 4,674 · blank 2,091 · C 1.
  - Latest `last_review` in the GDB: 2019-07-16; 1,069 GDB rows have none (California 640, New Mexico
    404, Alaska 16, Nevada 9) — the 2025 additions among them.
- **Terms — the one licence the plan asked to confirm. Confirmed, no restriction.** The FGDC metadata
  inside the ZIP (`SHP/Qfaults_US_Database.shp.xml`, kept as `credits/qfaults-Qfaults_US_Database.shp.xml`):
  `<useconst>none</useconst>`, `<accconst>none</accconst>`, and the standard USGS disclaimer
  (`<distliab>`, quoted in full in `credits/usgs-terms.txt` §5). The USGS page credits its map image
  *"Sources/Usage: Public Domain."* and asks: *"When you use this data, please provide proper
  acknowledgment. … To cite the entire USGS Quaternary Fault and Fold Database, please use the
  following citation: U.S. Geological Survey, 2020, Quaternary Fault and Fold Database for the
  Nation, accessed [Month, Day, Year], at https://doi.org/10.5066/P9BCVRCK"*. The DOI record
  (DataCite) names Schmitt, R.G., Gold, R.D. and the Geologic Hazards Science Center, publisher USGS,
  2020. **Not purely federal authorship:** the database is compiled with state geological surveys
  (the page lists cooperators in twelve states; each record has a `cooperator` field), but USGS
  releases it with no use or access constraint, so it is redistributable in an MIT template with the
  credit. The ScienceBase landing page (the DOI's target) was unreadable from here (§3).
- **On screen:** *"Faults: USGS and state geological surveys, Quaternary Fault and Fold Database of
  the United States."*; CREDITS.txt adds the citation with the access date 2026-09-30.

### 2.5 USGS Volcano Hazards Program API
- **Base and terms:** `https://volcanoes.usgs.gov/vsc/api/` — *"These items are freely available but
  are designed to support USGS applications. No guarantee of continuing support should be assumed."*
  (quoted in `credits/usgs-terms.txt` §6). Endpoint documentation:
  `https://volcanoes.usgs.gov/hans-public/api/volcano/`.
- `GET https://volcanoes.usgs.gov/hans-public/api/volcano/getUSVolcanoes` — 200, application/json,
  170,146 B, a list of 170: `obs_abbr, obs_fullname, obs_email, volcano_cd, vnum, volcano_name, region,
  latitude, longitude, elevation_meters, boilerplate, volcano_url, volcano_image_url, nvews_threat,
  icao_coordinates`. Threat classes: Very High 18, High 35, Moderate 48, Low 42, Very Low 20, blank
  5, "Waiting for Threat Level" 2.
- `GET …/getMonitoredVolcanoes` — 200, 45,386 B, 69 entries: `volcano_name, vnum, sent_utc,
  sent_unixtime, alert_level, color_code, volcano_cd, obs_fullname, obs_abbr, notice_type_cd,
  notice_identifier, notice_url, notice_data`. On 2026-09-30: NORMAL/GREEN 65, WATCH/ORANGE 2,
  ADVISORY/YELLOW 2.
- `GET …/getElevatedVolcanoes` — 200, 2,614 B: Great Sitkin ORANGE/WATCH, Kīlauea ORANGE/WATCH,
  Shishaldin YELLOW/ADVISORY, Ahyi Seamount YELLOW/ADVISORY (outside the boxes).
- Also seen, not used: `getCapElevated` (CAP detail for orange/red), `vsc/api/volcanoApi/elevated`,
  `vsc/api/volcanoApi/geojson` (161 features in one call with `alertLevel` UNASSIGNED for 95 of them),
  `vsc/api/volcanoApi/volcanoesGVP` (Smithsonian's list).
- Saved: `samples/volcano-get{US,Monitored,Elevated}Volcanoes.json`. The `volcano_image_url` values
  point at AVO's site (avo.alaska.edu); those images are not USGS-only works and are never fetched.
- **Licence:** US Government data, public domain; the API itself carries the "no guarantee of
  continuing support" caveat. **On screen:** *"Volcano status: USGS Volcano Hazards Program."*

### 2.6 Natural Earth v5.1.2
`https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/<name>.geojson`,
all 200:

| Key | File | Bytes | sha256 (first 16) |
| --- | --- | ---: | --- |
| ne_coastline | ne_50m_coastline | 1,640,858 | 271f1c4c1908312b |
| ne_land | ne_50m_land | 1,636,166 | e874b27a51d14645 |
| ne_lakes | ne_50m_lakes | 876,018 | d350b75978b26fe8 |
| ne_states | ne_50m_admin_1_states_provinces_lines (581 lines) | 882,513 | 72cca93c850d4126 |
| ne_borders | ne_50m_admin_0_boundary_lines_land | 760,189 | 2faac4f6b34386f3 |
| ne_places | ne_50m_populated_places_simple | 850,767 | 8e70756b39fae9bc |
| ne_bathy_200 … 7000 | ne_10m_bathymetry_{K_200, J_1000, I_2000, H_3000, G_4000, F_5000, E_6000, D_7000} | 4,229,885 · 2,509,878 · 4,280,462 · 8,479,402 · 12,182,812 · 9,759,029 · 1,006,550 · 100,076 | in sources.py |

**Licence** (`credits/natural-earth-LICENSE.md`, from the same commit): *"Everything here is public
domain."* … *"All versions of Natural Earth raster + vector map data found on this website are in the
public domain. You may use the maps in any manner, including modifying the content and design,
electronic dissemination, and offset printing."* … *"No permission is needed to use Natural Earth.
Crediting the authors is unnecessary."* **Not** US Government work: public domain by its authors'
dedication. Credit given anyway: *"Basemap: Made with Natural Earth."*

### 2.7 USGS statements behind the honesty notes
Quoted verbatim in `credits/usgs-statements.txt`, cited in `sources.CITED`:
- **More dots means more instruments** —
  https://www.usgs.gov/faqs/why-are-we-having-so-many-or-so-few-earthquakes-has-naturally-occurring-earthquake-activity :
  *"The ComCat earthquake catalog contains an increasing number of earthquakes in recent years--not
  because there are more earthquakes, but because there are more seismic instruments and they are
  able to record more earthquakes."*
- **Completeness** — https://www.usgs.gov/faqs/where-can-i-search-earthquake-catalog-past-events
  lists *"World-wide Earthquakes Catalog (M4.5+ worldwide, M2.5+ U.S.)"*; and
  https://earthquake.usgs.gov/data/mineblast/goals.php : *"For much of the U.S., earthquakes of
  magnitude 2.5 or larger are located and cataloged by the USGS/NEIC. In other parts of the U.S., the
  threshold … is higher, due either to the remoteness of those regions from seismographs or … Within
  the conterminous U.S., the level of completeness for earthquake location by the USGS/NEIC is
  probably in the magnitude 3.0-3.5 range."* That is the plan's "~M3 in the Lower 48", and its
  "~M4.5 worldwide" is the first page's catalogue description. Neither is dated on the page; the
  mining-seismicity page is an older programme's.
- **Oklahoma** — https://www.usgs.gov/faqs/oklahoma-has-had-a-surge-earthquakes-2009-are-they-due-fracking :
  *"Beginning in 2009, Oklahoma experienced a surge in seismicity. This surge was so large that its
  rate of magnitude 3 and larger earthquakes exceeded California's from 2014 through 2017."* and
  *"The majority of earthquakes in Oklahoma are caused by the industrial practice known as
  "wastewater disposal"."* (with *"few of these earthquakes were induced by fracking"*).

### What is US Government work
ComCat, the feeds, 3DEP, the volcano API and the fault database are USGS releases in the public
domain (17 U.S.C. §105), with non-federal contributors inside ComCat (regional networks) and the
fault database (state surveys) released by USGS without restriction. Natural Earth is not government
work; it is public domain by dedication. Nothing in the app is under a non-commercial or share-alike
term. The root `LICENSE` carve-out should say: public-domain data, credited in `us-quakes/CREDITS.txt`.

---

## 3. What did not work

- **One count for "everything since 1600"** in the Lower 48 and Alaska: the Lower 48 returned `504
  Gateway Time-out` (nginx HTML); Alaska returned `Error 503: Service Unavailable … SQLSTATE[HY000]:
  General error: 1114 The table '/rdsdbdata/tmp/#sql164_141fbd8b_0' is full`. Hawaii (274,620) and
  Puerto Rico (73,215) answered. Summed by decade instead (§2.1); `common.http_get()` retries 503/504.
- **The plan's Lower 48 count** (167,966) could not be reproduced exactly: its box is not recorded.
  The other three matched to within four events, which identifies their boxes.
- **"16 MB ZIP"** on the faults page: the file is 32,371,696 bytes.
- **The ScienceBase landing page** for doi:10.5066/P9BCVRCK (`sciencebase.gov/catalog/item/589097b1e4b072a7ac0cae23`,
  also `?format=json` and `?format=fgdc`) answered **403** behind a browser challenge ("Just a
  moment… Enable JavaScript and cookies to continue"). The terms were read from the metadata inside
  the ZIP and the USGS page instead. `catalog.data.gov`'s CKAN API returned 404
  (`{"message":"Not Found"}`), and `data.usgs.gov/datacatalog/data/USGS:589097b1e4b072a7ac0cae23` 404.
- **usgs.gov with curl's default User-Agent**: 403. With a browser User-Agent: 200. The pipeline only
  reads usgs.gov for evidence, never at build time; the data hosts (earthquake.usgs.gov,
  elevation.nationalmap.gov, volcanoes.usgs.gov) answered the pipeline's own agent.
- **Pages that are JavaScript only or gone:** `earthquake.usgs.gov/earthquakes/map/doc_aboutdata.php`
  ("Javascript must be enabled"), `…/earthquakes/feed/policy.php` (404),
  `…/earthquakes/search/help.php` (404); the ComCat documentation pages (`/data/comcat/`,
  `/data/catalog/…`) carry no completeness figure or DOI in their HTML.
- **Reading the fault shapefile as latin1** (Shelf Atlas's helper default) turned "La Cañada del
  Amagre" into "La CaÃ±ada del Amagre"; the `.cpg` says UTF-8, and `common.shapefile_records()` now
  reads it.
- **A 512-pixel hillshade test** looked washed out: the service shades the DEM resampled to the
  output size, so small exports lose relief. The production sizes above are fine.
- **tifffile** could not read the LZW elevation TIFF without `imagecodecs`; Pillow reads it, so
  tifffile was dropped. An F32 LERC export (6.1 MB for Puerto Rico) was 14× the Int16 LZW one.
- **Natural Earth 1:50m bathymetry** does not exist (see §1).

---

## 4. Known gaps

- **How far back the catalogue is complete.** Events per decade in the four boxes (earthquakes):
  1900s 132 · 1910s 248 · 1920s 206 · 1930s 3,081 · 1940s 3,420 · 1950s 4,344 · 1960s 8,104 · 1970s
  24,184 · 1980s 39,071 · 1990s 47,878 · 2000s 63,061 · 2010s 116,894 · 2020–2025 73,828. Before
  1900: 631 events in 273 years. The rise is mostly instruments (USGS, §2.7), not the Earth; the
  2010s also hold Oklahoma's induced surge. USGS gives completeness only as "M2.5+ for much of the
  U.S." and "probably M3.0–3.5 within the conterminous U.S." with no dates, and ~M4.5 worldwide; no
  USGS source found here states *when* each region became complete at a given magnitude. The app
  must not imply a rate change from dot density alone.
- **Pre-1900 locations and times are nominal.** 612 of 631 have no depth, 186 no magnitude;
  positions are round numbers (Puerto Rico 1785 at 18.5, −64; 1700 Cascadia at 45, −125 for a
  rupture ~1,000 km long); the oldest, 1627, is dated 1 January at 00:00, i.e. year-only. Magnitude
  types there are intensity-derived (`mfa`, `mint`, `mlg`).
- **The 10 km default depth.** 23,760 of the 398,018 cached rows (6.0 %) and 565 of the month's feed events sit at
  exactly 10 km, the depth networks assign when it is not constrained; they draw a flat line in
  cross-sections and are drawn and labelled as such. Negative depths (14,048, to −3.74 km) are above
  the datum, not errors.
- **Magnitude types differ.** Local (ml), duration (md, Md), body-wave (mb, mb_lg, mblg, lg), coda
  (mc), moment (mw, mww, mwr, mwc, mwb), surface-wave (ms), Hawaii's mh, intensity-based (mfa, mint)
  and more — 35 labels, counting case variants (`Md`/`md`, `Ml`/`ml`, `mB`/`mb`, `mbLg`/`mb_lg`/`mblg`), plus 256 blanks. They are not interchangeable, especially above M6 (ml saturates); the app
  shows each event's own type and does not convert. Magnitudes are quantised for the history file
  (resolution fixed in the contract); the sheet shows the value to one decimal.
- **Automatic vs reviewed.** 2,980 history rows are `automatic`, including the 1964 M9.2; only live
  events are drawn hollow (§1). Automatic live solutions can move, change magnitude or vanish.
- **Closed windows do not see later revisions.** Once cached, a window is never refetched, so a USGS
  relocation, magnitude change or deletion after 2026-09-30 reaches the app only when the cache is
  deleted and rebuilt. The yearly build's count check (0.5 %) catches large drift, not individual
  edits. `updated` in every row says when USGS last touched it.
- **The boxes are not the borders.** Mexican, Canadian and Virgin Islands events inside the boxes are
  kept and shown as what they are; events just outside (the Gulf of California south of 24°N, the
  Marianas, Samoa, Guam) are not in the app.
- **Relief is US-only and masked with whole-metre elevation**: land within half a metre of sea level
  rounds to 0 and loses its shading at the coast; outside the US there is no relief.
- **Faults are as last reviewed**: newest review date 2019-07-16, plus the undated 2025 additions;
  the database holds faults with geological evidence of surface deformation in the past 1.6 million
  years (the USGS page's definition), not every fault that can make an earthquake, and it is not a
  hazard map.
- **Volcano status depends on an API with no support promise**, and 85 of the 148 volcanoes in the
  boxes are not monitored at all.
- **The live feed is worldwide and 7.5 MB per month**; the refresh filters to the boxes each hour.
  An hourly job is about 720 runner-minutes a month (plan's risk note; a private copy should run every
  3 h).
- **Not a warning service.** Nothing here is real-time enough, or meant, to warn anyone; the feed is
  minutes to hours behind, the phone's copy up to the last refresh. The app says so on screen.
