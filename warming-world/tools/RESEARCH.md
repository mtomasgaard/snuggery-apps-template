# Research: sources, licences and decisions for Warming World

The brief is `docs/plans/0010-four-showcase-apps.md`, "Idea 2 — recommendation: Warming World
(GISTEMP)", with the rules for all four apps under "Recommendation and order". This file makes every
source in it real on disk, pins what can be pinned, quotes each licence or set of terms, and writes
down what the plan left open. Every URL, count, size, hash and quirk below was measured on
**2026-09-30** (US time; 2026-10-01 UTC for the later fetches) from this machine, with the command
named next to it. Nothing here comes from memory: citations are quoted from the providers' pages,
and three of them (Hansen 2010, Lenssen 2024, Menne 2018) were also checked against Crossref
(`api.crossref.org/works/<doi>`), the ERSST data DOI against DataCite. It lives under
`tools/` so it never ships inside the app's ZIP.

The pipeline is not in this folder: it is in `Template/scripts/warming_world/`, because the monthly
refresh runs from `Template/scripts/` on a GitHub runner the way `scripts/global_weather.py` does.

| Where (under `Template/scripts/warming_world/`) | What |
| --- | --- |
| `sources.py` | every source: URL, sha256 and bytes where the file is static, licence, attribution and citation wording, retrieval date; for GISTEMP, the file's **contract** (format, variable, type, scale, fill, grid, time axis) instead of a hash, plus hash pins of the two research copies the numbers below were measured on |
| `netcdf3.py` | a classic-NetCDF reader in the standard library (`struct`), 164 lines, so the runner needs no netCDF4, HDF5 or SciPy; cross-checked against `scipy.io.netcdf_file` (§1.2) |
| `probe.py`, `probe-urls.txt` | Shelf Atlas's shape: prints what every URL returns now, with a NetCDF header peek for the grid and a newest-year peek for GISS's table; `--fetch` fills `cache/` and checks every static pin. `.github/workflows/probe-warming-world.yml` runs the same file on a runner |
| `common.py`, `paths.py` | adapted from `scripts/shelf_atlas/common.py` and `scripts/us_quakes/{common,paths}.py` (copied, never imported): cache, `http_get()` that resumes a dropped download with a Range request, `fetch_pinned()`, deterministic `write_json()`/`write_bin()` with size budgets, `zip_stored_size()`, Visvalingam–Whyatt, `delta_encode()` to Global Weather's `world.json` units, `group()` with U+202F; `RETRIEVED = '2026-09-30'`; standard library + `requests` at import time |
| `credits/` | licence and terms evidence, quoted verbatim with the URL and status each came from: `gistemp-page-and-faq.txt`, `gistemp-netcdf-header.txt`, `nasa-media-guidelines.txt`, `nasa-esds-data-policy.txt`, `ncei-ersst-ghcn.txt`, `hadcrut5-terms.txt`, `era5-licence.txt`, `natural-earth-LICENSE.md` |
| `requirements.txt` | pinned: requests 2.34.2, numpy 2.5.3, scipy 1.18.1 (numpy and scipy for research and the static build only; the refresh needs neither, §1.11) |

Verification commands, run from `Template/scripts/warming_world/` (venv made with
`/opt/homebrew/bin/python3.12 -m venv .venv && .venv/bin/pip install requests numpy scipy`;
`pip freeze` printed the three pins above):

```
.venv/bin/python probe.py --fetch /dev/null
    # ne_land ok 1,636,166 B · ne_coastline ok 1,640,858 B · ne_lakes ok 876,018 B ·
    # ne_borders ok 760,189 B · ne_places ok 850,767 B · ne_licence ok 4,636 B ·
    # research grid ok 25,836,095 B · research table ok 12,887 B          (exit 0)
.venv/bin/python probe.py
    # data.giss.nasa.gov: five URLs "-> 0 URLError(ConnectionRefusedError(61, 'Connection refused'))";
    # nasa.gov, ncei.noaa.gov (2), metoffice.gov.uk, cds.climate.copernicus.eu, raw.githubusercontent.com (2): 200
.venv/bin/python probe.py <file:// list of the two research copies>
    # netcdf b'CDF\x01', dims {'lat': 90, 'lon': 180, 'time': 1759, 'nv': 2}, unlimited None
    # history: Created 2026-08-10 06:37:42 by SBBX_to_nc 2.0 - ILAND=1200, IOCEAN=NCDC/ER5, Base: 1951-1980
    # tempanomaly('time', 'lat', 'lon') type h scale 0.009999999776482582 fill 32767 units K
    # time: 1759 months, 1880-01-15 .. 2026-07-15
    # table: 1880 .. 2026, 8 months in 2026; J-D 2025 = 1.19
```

The measurements in §1 were made with one-off numpy scripts in the session scratchpad (not
committed); each figure names what it counts, so the build stage can reproduce it in its own
assertions.

The download cache is 42 MB by `du -sh` (`cache/wayback/` 25 MB, `cache/live/` an 11 MB partial,
`cache/ne/` 5.5 MB) and is gitignored as `scripts/warming_world/cache/` (the line sits next to US Quakes' in
`Template/.gitignore`).

**Stop rule: not triggered, with one caveat the lead should weigh.** The GISTEMP grid was downloaded
and read: a byte-exact copy of the file GISS published on 2026-08-10, from the Internet Archive.
The *current* file (published 2026-09-08) was not completed, because data.giss.nasa.gov stopped
accepting TCP connections at about 00:00 UTC on 2026-10-01, from this machine and from an
independent fetcher, after delivering 10,678,272 of its 25,853,076 bytes (§3). Everything this
stage had to establish — format, variable, scale, fill, grid, time axis, coverage, the annual rule,
the clip fraction, sizes, agreement with GISS's own table — is established on the August file and
does not depend on which month the file ends in. The refresh will read the live file; the probe
workflow can confirm GISS from a runner. The lead decides whether to wait for GISS before the
pipeline stage.

---

## 1. Decisions

### 1.1 The file: the 1200 km Land-Ocean grid, as the plan says

`gistemp1200_GHCNv4_ERSSTv5.nc.gz` — the downloads page lists it as *"Land-Ocean Temperature Index,
ERSSTv5, 1200km smoothing"*. Its sibling `gistemp250_GHCNv4.nc.gz` is land only with 250 km smoothing
(no oceans, much greyer); the Zarr copy (53 MB) and the SBBX equal-area files are the same analysis in
other shapes. The 1200 km file is what GISS's own maps and global means are built from, so the app's
picture and GISS's numbers agree (§1.10).

### 1.2 Read it with the standard library

The file is **classic NetCDF (CDF-1)**, not NetCDF-4/HDF5: magic `CDF\x01`, 57,014,888 bytes after
gunzip. `netcdf3.py` reads it with `struct`; on all 1,759 frames its int16 values are identical to
`scipy.io.netcdf_file(..., maskandscale=False)` (`numpy.array_equal` printed `True`). The variable is
`tempanomaly(time, lat, lon)`, big-endian int16, `scale_factor` stored as float32
`0.009999999776482582`, `_FillValue 32767`, `units "K"`. **Decode as the integer divided by 100**,
never by multiplying the float32 scale: the integer is hundredths exactly, and the float32 product
would put values like 0.15 on the wrong side of a rounding tie. A kelvin anomaly is the same number in
°C; the app says °C. The refresh asserts the contract in `sources.GISTEMP['contract']` and refuses to
publish a file that breaks it.

One surprise: **`time` is a fixed dimension, not the unlimited one** (`numrecs` 0), so the anomaly
variable is not a record variable. `netcdf3.frame()` handles both.

### 1.3 The grid and its orientation

`lat` runs **south to north**, −89 … 89 (cell centres, 2°); `lon` −179 … 179. The time axis is
"days since 1800-01-01", mid-month values with month bounds: the first month is 1880-01 (bounds
1880-01-01 … 1880-02-01). The August file ends at 2026-07 (1,759 months); GISS's September table has
eight 2026 months, so the September grid ends at 2026-08 (1,760).

Global Weather's snapshot says `order: row-major from lat0 southwards, lon0 eastwards`, with a
*point* grid of 91 rows from 90° to −90° and longitudes from 0°. GISTEMP is a *cell* grid. Decision:
keep Global Weather's schema and order, and describe the cells honestly — `grid: {nx: 180, ny: 90,
lon0: -179, lat0: 89, dlon: 2, dlat: -2, cells: true}` — so the pipeline **flips the rows** (north
first) and the app samples by **nearest cell, never bilinear**. Bilinear sampling would blend a grey
no-data cell into its coloured neighbour and invent a value along every coverage edge; nearest-cell
sampling shows the 2° cells as they are, which is also the honest picture of the data's resolution
(2° is about 222 km at the equator).

### 1.4 The annual-mean rule: at least 9 of 12 months

A cell's year is the plain mean of its available monthly anomalies when it has **at least 9 of the 12
months**, and no data (255) otherwise. Measured over 1880–2025 (146 complete years × 16,200 cells):

| Rule | Cell-years kept | Grid's global annual mean vs GISS's `J-D` column: max \|Δ\| · RMS |
| --- | ---: | --- |
| ≥ 1 month | 2 148 251 | 0.028 · 0.0082 °C |
| ≥ 6 months | 2 108 555 | 0.023 · 0.0087 °C |
| **≥ 9 months** | **2 086 125** | **0.031 · 0.0095 °C** |
| all 12 | 2 069 159 | 0.031 · 0.0099 °C |

The 9-month rule drops 62,126 cell-years that have 1–8 months (2.89 % of cell-years with any data;
743 cells in 1880, 605 in 1900, 484 in 1950). The global means barely move between rules, so the rule
is chosen for the *cell*: a mean of two or three months is a season, not a year, and the tap readout
would call it a year. Months-per-cell-year histogram (0…12): 216,949 · 3,352 · 10,780 · 8,219 ·
8,636 · 8,709 · 9,030 · 6,469 · 6,931 · 6,863 · 3,872 · 6,231 · 2,069,159 — so 96.3 % of cell-years
with data are complete and the rule only bites at coverage edges. No seasonal adjustment is made (a
9-month mean missing three winter months leans to the summer anomaly); with 96 % complete it is not
worth the complexity, and it is a known gap (§4).

Rounding: the mean is computed from the integer hundredths, then rounded to 0.1 °C **half away from
zero**. Rounding to 0.1 °C moved the global mean by at most 0.0009 °C in any year (measured with
numpy's rounding; the tie rule cannot change that bound).

### 1.5 The current, partial year

GISS's table shows 2026 with eight months and `J-D = ***`: GISS does not publish an annual figure for
a partial year, and neither will the app's stripes. Measured on 2025, a January–July mean differs
from the full-year mean by 0.30 °C per cell on average (95th percentile 0.93, worst 1.52; 0.54 north
of 64° N), though the global mean differs by only 0.006 (1.212 vs 1.206). A partial-year map is
therefore *not* comparable, cell by cell, with the full years before it. Decisions:

- The partial year is the last frame of the Annual view **only once it has at least 6 published
  months** (from the July release, mid-August). Before that the Annual view ends at the last complete
  year, and the newest months are in the Last 24 months view, where they belong.
- Its cells use the same three-quarters ratio as the full years: at least ⌈0.75 n⌉ of the n published
  months (6 of 7 in the August file, 6 of 8 in September's).
- It is labelled with its months on screen — "2026, Jan–Aug (partial)" — in the scrubber, the tap
  readout and the legend; its stripe is drawn from the mean of the table's published months and marked
  partial (hatched or open, the art stage's choice), never as a full year.

### 1.6 The fixed ±4 °C scale, and what it clips

The map's colour scale is blue–white–red, **fixed at −4 … +4 °C, symmetric, printed on screen** —
never re-fitted to the year or the data release. Measured on the annual frames (1880–2026 partial):

| Annual cell values with \|anomaly\| > | Share | Count |
| --- | ---: | --- |
| 3 °C | 1.098 % | 20,462 above, 2,611 below |
| **4 °C** | **0.233 %** | **4,504 above +4, 387 below −4** |
| 5 °C | 0.027 % | 523 above, 44 below |

The clipped share grows with time: 0.37 % of cell-years since 1950, 1.03 % since 2000, 2.20 % since
2016, and **872 cells (5.4 %) in 2025**, nearly all in the Arctic (the 2025 maximum is +5.31 °C; the
mean north of 64° N is +3.37 °C against a global +1.21). Decision: keep ±4 (it is the plan's, and a
wider scale would wash out everything south of the Arctic), but **never hide the clip**: the legend's
end caps read "≥ +4 °C" and "≤ −4 °C", the tap readout always shows the cell's true value, and the
data are encoded to ±12.7 °C so nothing is clipped in the file — only in the colour.

Monthly values clip far more often: 3.08 % of all monthly cell values exceed ±4 °C, and 8.42 % in the
last 24 months (3.49 % beyond ±6, 1.13 % beyond ±8). The Last 24 months view uses the same scale and
says in its legend that single months swing much further than years.

### 1.7 Encoding: one byte at 0.1 °C, no delta

`value = −12.7 + 0.1 × byte` for bytes 0–254, **255 = no data**: Global Weather's `offset + step ·
byte` (power 1), a plane per step, deflated and base64'd per frame. Ranges measured: annual −6.37 …
+6.43 °C (well inside); monthly −16.22 … +15.94 over 1880–2026, of which 0.0058 % lie beyond ±12.7;
the last 24 months −6.08 … +11.68 (none beyond). The pipeline asserts that **no shipped value
clips** and fails rather than clamp silently.

Sizes, measured with zlib level 9 per frame on the August file:

| What | Raw | Deflated | Base64 |
| --- | ---: | ---: | ---: |
| 147 annual frames (1880–2026) | 2,381,400 B | **641,918 B** | 856,096 B |
| same, delta mod 256 against the previous frame | | 738,832 B (**×1.151**, worse) | |
| one deflate stream over all 147 (reference) | | 604,537 B | |
| 24 monthly frames | 388,800 B | 149,684 B | 199,604 B |

So the plan's "0.64 MB" and "delta 15 % worse" both reproduce. **No delta.** A snapshot holding both
lists is about 1,056 KB of JSON, which `zip_stored_size()` puts at about 800 KB inside the ZIP.
With the basemap (Global Weather's `world.json` costs 123,739 B in a ZIP, its `places.json` 21,659 B)
and app code, the plan's **ZIP ≈ 1.2–1.5 MB** holds.

### 1.8 The Last 24 months view

A second step list in the same snapshot, `months`, with the 24 newest months as `YYYY-MM` steps in
the same encoding (no annual rule: a month is shown when GISS has it). It overlaps the partial year,
which is the point: it is where the newest data are seen month by month. Coverage over the last 24
months of the August file: 99.2 % of cell-months.

### 1.9 The warming stripes come from GISS's table, not from the grid

GISS's FAQ (credits §3): *"the number in the index files should be considered definitive"*, because
its global means fill gaps using the whole time series, while a mean of one map uses only that map.
So the scrubber's stripes take each year's `J-D` value from `GLB.Ts+dSST.csv` (and the partial year
from the mean of its published months, marked partial). The stripes span −0.49 °C (1909) to +1.29 °C
(2024). On the map's ±4 °C scale they would never pass a pale pink, so **the stripes get their own
fixed, symmetric scale, printed beside the scrubber** — proposed ±1.5 °C, never auto-fitted to the
data; the art stage may choose another fixed value and must print it. The grid's own global mean is
used only to validate the pipeline (§1.10).

### 1.10 Validation the refresh asserts

- The contract (§1.2–1.3), every run.
- **Annual** global means of the grid (area-weighted by cos latitude over cells with data, after the
  9-month rule) within **±0.05 °C** of the table's `J-D`, every complete year. Measured: max 0.031 °C
  (1884), RMS 0.0095, mean +0.0008; the 1951–1980 mean of the grid's global series is −0.0002, as an
  anomaly against that base should be. The table here is the September release and the grid the
  August one, so this already includes a month of GISS's revisions.
- Not asserted per month at ±0.05: one month in 1,759 differs by 0.054 (RMS 0.0148). If a monthly
  check is wanted, ±0.08.
- The grid and the table end in the same month (same release).
- **Freshness**: the newest month's end no more than **60 days** before the run. GISS updates "about
  the 10th of every month"; a run on the 15th sees a newest month that ended 15 days before (45 if one
  release is late), so 60 fails only when GISS has missed two releases — and then the job fails red
  rather than republishing old data as new. When the newest month and the file's `history` stamp equal
  what the data branch already holds, the run publishes nothing (Global Weather's `--skip-run`).

### 1.11 Pure Python on the runner

The refresh needs `requests` and nothing else: gunzip plus header parse took 0.1 s and all 146 annual
frames 3.2 s in pure Python (`netcdf3.frame()` and lists), so numpy buys nothing worth an install. If
the pipeline stage uses numpy anyway, the workflow must install it and say so (the brief's rule). The
monthly workflow runs on the **15th**, publishes to an orphan branch `data-warming-world` with Global
Weather's branch-name guard, and `warming-world` joins the loop in `publish-web.yml` (both for the
pipeline stage).

### 1.12 Coverage on screen: say "of Earth's surface", from the data

Coverage is measured per frame by the pipeline and shipped in the snapshot, never typed into the
About text. Two measures, and they differ a lot early on because the missing cells are mostly polar
and small:

| Year | Cells with any month | Cells passing the 9-month rule | **Area** passing the rule |
| --- | ---: | ---: | ---: |
| 1880 | 72.6 % | **68.0 %** | 82.7 % |
| 1900 | 79.9 % | 76.2 % | 89.9 % |
| 1950 | 89.4 % | **86.5 %** | 95.1 % |
| 1980 | 99.2 % | 98.2 % | 98.9 % |
| 2000 | 99.9 % | 98.8 % | 99.2 % |
| 2025 (last complete) | 99.9 % | 98.9 % | 99.2 % |

The plan's "68 % of cells in 1880, 86 % in 1950, 99 % after 1980" reproduces, though "99 %" is
98.2–98.9 % of cells and 98.9–99.2 % of area. Decision: the About screen and the legend quote the
**area** share ("data cover 83 % of Earth's surface in 1880"), because a cell count over-weights the
poles, and the map shows the grey cells directly. In 2025 the 1.1 % without data are the Southern
Ocean's sea-ice zone (55–69° S) and two tropical cells at 15° S.

### 1.13 Basemap and labels: Natural Earth v5.1.2, built, not copied

`global-weather/assets/world.json` says it is "Natural Earth 1:50m via world-atlas 2.0.2", but
nothing in the repository rebuilds it, and world-atlas pins its own older Natural Earth. Decision:
**build `assets/world.json` from Natural Earth v5.1.2 at the commit the other apps pin**
(`f1890d9f…`), in exactly Global Weather's format (`{v, source, units, land, borders}`, hundredths of
a degree, delta-encoded; `common.delta_encode()`), so the copied globe draws it unchanged and its
provenance is a sha256 chain. Global Weather's file is the fallback and the format reference. All
five GeoJSON files and the licence downloaded here hash identically to US Quakes' pins.
City labels come from **Natural Earth populated places** (1,251 places, public domain), not GeoNames
(CC BY 4.0), as Earth's History did (plan D8).

### 1.14 Units and text

°C everywhere, signed ("+1.3 °C"), one decimal; thousands with U+202F (`common.group()`); "anomaly"
always next to the number. US English. No AI vendor or model named anywhere.

### 1.15 Attribution, citation, endorsement

- On screen and in the snapshot's `sources` block: *"Temperature: NASA GISS Surface Temperature
  Analysis (GISTEMP v4); annual means and 0.1 °C rounding by this app."* and *"Coastlines, borders and
  city names: Made with Natural Earth (public domain)."*
- About and `CREDITS.txt` carry GISS's two requested citations, with the access date filled from the
  snapshot's retrieval date (§2.1).
- **No implied endorsement**: no NASA insignia or logotype, no "NASA app", "official" or "from NASA";
  the About screen says plainly that NASA does not endorse the app. NASA's guidelines (§2.2) allow
  factual use without permission on exactly that condition.

---

## 2. Sources

### 2.1 NASA GISTEMP v4

| | |
| --- | --- |
| Page | https://data.giss.nasa.gov/gistemp/ — 200, 19,101 B, Last-Modified Fri, 11 Sep 2026 20:25:56 GMT (23:57 UTC) |
| Grid | https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz — HEAD 200, **25,853,076 B**, Last-Modified Tue, 08 Sep 2026 06:31:20 GMT, `application/x-gzip`; download stopped at 10,678,272 B (gzip header mtime 2026-09-08 06:31:20) when the host went away |
| Table | https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv — HEAD 200, 12,887 B, Last-Modified Tue, 08 Sep 2026 06:29:13 GMT, `text/csv` |
| Research grid | Internet Archive capture `20260906203026` of the grid URL (`id_` form): 200, **25,836,095 B**, sha256 `93f73f648a5e43b2870880865406ae98d35b03146612717e538d48a3bec02425`; gunzipped 57,014,888 B, sha256 `2d886aaff02133e0a3b39d38770c8c10dd812d136538e1e972283b8e1f302282`; `history` "Created 2026-08-10 06:37:42 by SBBX_to_nc 2.0 - ILAND=1200, IOCEAN=NCDC/ER5, Base: 1951-1980"; the archive's CDX lists captures of 2026-07-28 (25,815,070), 2026-08-18 and 2026-09-06 (same digest) |
| Research table | capture `20260914070505`: 200, 12,887 B, sha256 `c9ce0750ca93a8241c42fe86cd5bf54d07b28b21ae650b0ae49a206907018cd9` — the September release (1880 … 2026-08); same length as the live file |
| Updates | "Graphs and tables are updated about the 10th of every month" (the page) |

**Status: US Government work, public domain in the United States (17 U.S.C. §105).** GISS states no
licence; it asks for a citation. Verbatim (credits/gistemp-page-and-faq.txt §1):

> When referencing the GISTEMP v4 data provided here, please cite both this webpage and also our most
> recent scholarly publication about the data. In citing the webpage, be sure to include the date of
> access.
> GISTEMP Team, 2026: GISS Surface Temperature Analysis (GISTEMP), version 4. NASA Goddard Institute
> for Space Studies. Dataset accessed 20YY-MM-DD at https://data.giss.nasa.gov/gistemp/.
> Lenssen, N., G.A. Schmidt, M. Hendrickson, P. Jacobs, M. Menne, and R. Ruedy, 2024: A GISTEMPv4
> observational uncertainty ensemble. J. Geophys. Res. Atmos., 129, no. 17, e2023JD040179,
> doi:10.1029/2023JD040179.
> Graphics from these GISTEMP pages are subject to NASA Image and Media guidance.

(Crossref confirms the paper: "A NASA GISTEMPv4 Observational Uncertainty Ensemble", JGR Atmospheres
129, e2023JD040179, Lenssen, Schmidt, Hendrickson, Jacobs, Menne, Ruedy, 2024. The app uses the data,
not GISS's graphics.)

What the honesty notes rest on, verbatim from the FAQ (Wayback capture `20260611042938`, credits §3):
- *"Temperature anomalies indicate how much warmer or colder it is than normal for a particular place
  and time. For the GISS analysis, normal always means the average over the 30-year period 1951-1980
  for that place and time of year."* — anomalies, not temperatures; the base.
- *"Whereas SATs and SSTs may be very different … their anomalies are very similar … This is not true
  in the presence of sea ice … L-OTI maps show SAT anomalies over land and sea ice, and show SST
  anomalies over (ice-free) water."* — what a cell is.
- *"we are using the adjusted monthly mean data of NOAA/NCEI's Global Historical Climatology Network
  (GHCN) version 4 and NOAA/NCEI's Extended Reconstructed Sea Surface Temperature (ERSST) v5 data."*
- *"The analysis is limited to the period since 1880 because of poor spatial coverage of stations and
  decreasing data quality prior to that time."*
- *"monthly updates not only add e.g. global mean estimates for the new month, but may slightly change
  estimates for earlier months"* — revisions.
- *"the number in the index files should be considered definitive"* — §1.9.

The 1200 km radius is GISS's own name for the file ("1200km smoothing") and the `ILAND=1200` in its
history; the method is Hansen et al. 2010 (below).

### 2.2 NASA's rules on media use and endorsement

https://www.nasa.gov/nasa-brand-center/images-and-media/ — 200, 320,591 B (the older
`/multimedia/guidelines/index.html` redirects here). Verbatim (credits/nasa-media-guidelines.txt):

> The NASA Insignia, Logotype, identifiers, and imagery are not in the public domain. The use of the
> Insignia, Logotype and NASA identifiers is protected by law …
> NASA content used in a factual manner that does not imply endorsement may be used without needing
> explicit permission. NASA should be acknowledged as the source of the material.
> If the NASA material is to be used for commercial purposes, including advertisements, it must not
> explicitly or implicitly convey NASA's endorsement of commercial goods or services.
> NASA will not promote or endorse or appear to promote or endorse a commercial product, service or
> activity.

NASA's Earth Science data policy (earthdata.nasa.gov, 200, 142,113 B; credits/nasa-esds-data-policy.txt)
is quoted for NASA's open-data stance — *"NASA commits to the full and open sharing of Earth science
data … with all users as soon as these data become available"* — but GISTEMP is a GISS analysis, not
mission data, and its status rests on §105, not on that policy.

### 2.3 GISTEMP's inputs, for the honesty notes (nothing downloaded)

- **GHCNm v4** — https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-monthly
  (200, 66,992 B): *"Version 4 combines data from a variety of sources for a total 26,000 monthly
  temperature stations compared to 7,200 in v2 and v3."* Citation (NCEI's, with volume and pages from
  Crossref): Menne, M. J., C. N. Williams, B. E. Gleason, J. J. Rennie, and J. H. Lawrimore, 2018: The
  Global Historical Climatology Network Monthly Temperature Dataset, Version 4. J. Climate, 31,
  9835–9854, doi:10.1175/JCLI-D-18-0094.1. US Government work (NOAA).
- **ERSST v5** — https://www.ncei.noaa.gov/products/extended-reconstructed-sst (200, 56,535 B). Data
  citation as NCEI gives it: Huang, B., P. W. Thorne, V. F. Banzon, T. Boyer, G. Chepurin, J. H.
  Lawrimore, M. J. Menne, T. M. Smith, R. S. Vose, and H.-M. Zhang (2017): NOAA Extended Reconstructed
  Sea Surface Temperature (ERSST), Version 5. NOAA NCEI. doi:10.7289/V5T72FNM (DataCite 200). Paper:
  Huang et al. 2017, J. Climate, doi:10.1175/JCLI-D-16-0836.1. US Government work. **NCEI now leads
  with ERSSTv6** (news item dated December 11, 2025: *"ERSSTv6 has been upgraded from ERSSTv5 by
  implementing an interpolation method using an artificial neural network."*); GISTEMP still names v5
  (§4).
- **Method** — Hansen, J., R. Ruedy, M. Sato, and K. Lo, 2010: Global surface temperature change. Rev.
  Geophys., 48, RG4004, doi:10.1029/2010RG000345 (Crossref: "GLOBAL SURFACE TEMPERATURE CHANGE",
  Reviews of Geophysics 48, RG4004; Hansen, Ruedy, Sato, Lo).

### 2.4 Fallbacks named by the plan (terms recorded, nothing downloaded)

- **HadCRUT5** — https://www.metoffice.gov.uk/hadobs/hadcrut5/ (200); the current release is
  **HadCRUT.5.2.0.0** (download page 200), 5° grid from 1850. Terms page (200, 3,267 B), verbatim:
  *"HadCRUT5 is subject to Crown copyright protection and is provided under the Open Government License
  v3."* … *"A term of the licence is that users must include the following acknowledgement when the
  data are used: HadCRUT.[version number] data were obtained from http://www.metoffice.gov.uk/hadobs/hadcrut5
  on [date downloaded] and are © British Crown Copyright, Met Office [year of first publication],
  provided under an Open Government License, http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"*.
  Citation: Morice et al. 2021, JGR Atmospheres 126, e2019JD032361, doi:10.1029/2019JD032361. Usable
  (OGL v3 allows commercial reuse with that acknowledgement); coarser (5°) and not US Government work.
- **ERA5** — https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels (200) and its
  catalogue record (200, 7,666 B): `"license": "CC-BY-4.0"`, DOI 10.24381/cds.adbb2d47,
  `"conditionsOfAccess": "Free access upon acceptance of applicable licences and terms of use"`.
  Required wording, verbatim: *"Generated using or contains modified Copernicus Climate Change Service
  information <YYYY>. Neither the European Commission nor ECMWF is responsible for any use that may be
  made of the Copernicus information or data it contains."* A reanalysis (a model constrained by
  observations), from 1940 not 1880; download needs a CDS account (not tested here).

### 2.5 Natural Earth v5.1.2

`https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/<name>.geojson`,
all 200, all identical to US Quakes' pins:

| Key | File | Bytes | sha256 (first 16) |
| --- | --- | ---: | --- |
| ne_land | ne_50m_land | 1,636,166 | e874b27a51d14645 |
| ne_coastline | ne_50m_coastline | 1,640,858 | 271f1c4c1908312b |
| ne_lakes | ne_50m_lakes | 876,018 | d350b75978b26fe8 |
| ne_borders | ne_50m_admin_0_boundary_lines_land | 760,189 | 2faac4f6b34386f3 |
| ne_places | ne_50m_populated_places_simple (1,251 features) | 850,767 | 8e70756b39fae9bc |
| licence | LICENSE.md | 4,636 | 2631b5b39b6d1acc |

**Licence** (`credits/natural-earth-LICENSE.md`): *"Everything here is public domain."* … *"All
versions of Natural Earth raster + vector map data found on this website are in the public domain. You
may use the maps in any manner, including modifying the content and design, electronic dissemination,
and offset printing."* … *"No permission is needed to use Natural Earth. Crediting the authors is
unnecessary."* Credit given anyway.

### What is US Government work

GISTEMP (NASA GISS), GHCNm v4 and ERSST v5 (NOAA NCEI) are US Government works, public domain in the
United States under 17 U.S.C. §105; GISS asks for its citation, which the app gives. Natural Earth is
not government work; it is public domain by its authors' dedication. HadCRUT5 (Crown copyright, OGL v3)
is not used. Nothing shipped is under a non-commercial or share-alike term.

**Amended 2026-10-06 (plan 0012 package 3.3).** ERA5 **is** now used, for Absolute only:
`assets/climatology.json`, ERA5's 2 m air temperature for 1990–2019 as WeatherBench 2's climatology
holds it, moved to 1951–1980 by GISTEMP's own anomalies (`tools/climatology/build_climatology.py`,
pinned by sha256). ERA5 is CC BY 4.0 at the Climate Data Store; WeatherBench 2's copy is published
under the Licence to Use Copernicus Products (its bucket's `LICENSE`); both allow commercial use and
ask for the Copernicus notice, which About and `CREDITS.txt` print with the modification sentence.
The researcher's comparison of sources (Berkeley Earth refused as CC BY-NC; NCEP/NCAR R1 the
public-domain fallback; GHCN_CAMS unfit for absolute values) is in `tools/DECISIONS.md`. So the root
`LICENSE` carve-out should now say: public-domain data, except `assets/climatology.json`, which is
CC BY 4.0 (Copernicus Climate Change Service information, modified), credited in
`warming-world/CREDITS.txt`.

---

## 3. What did not work

- **data.giss.nasa.gov went away mid-download.** At 23:57 UTC on 2026-09-30 the page, table and grid
  answered HEAD 200; a GET of the grid stalled at 10,678,272 B, and from about 00:00 UTC on 2026-10-01
  every TCP connection to 129.164.141.233 (data.giss.nasa.gov, ports 443 and 80) and to
  www.giss.nasa.gov was refused (`curl: (7) Failed to connect … Couldn't connect to server`;
  `nc -z` closed). An independent fetcher on another network got `connect ECONNREFUSED
  129.164.141.233:443`, so it was the host, not this machine. nasa.gov and earthdata.nasa.gov answered
  200 throughout. Retry loops with `curl -C -` (resume) ran once a minute from 00:03 to past 00:17 UTC
  without one open connection. Why the host went down is not known here. `common.http_get()` now
  resumes a dropped transfer with a Range request.
- **Two GETs at once to GISS** (the grid, then a page) got the second one refused while the first was
  still streaming; the probe and the pipeline fetch one URL at a time with a pause.
- **The downloads page's sizes are stale**: "(23 MB)" for a file of 25.8 MB.
- **The Internet Archive rate-limits** (`429 Too Many Requests` after a handful of availability
  queries; one CDX query timed out, and once "Internet Archive services are temporarily offline").
  The two captures used were fetched with the `id_` URL form, which returns the original bytes.
- **NOAA PSL's copy of GISTEMP** (`downloads.psl.noaa.gov/Datasets/gistemp/combined/1200km/air.2x2.1200.mon.anom.comb.nc`,
  200) is NetCDF-4/HDF5 (`\x89HDF`), 334,365,891 B, Last-Modified 2026-09-01 — a month behind GISS,
  13× larger, and not readable by `netcdf3.py`. Not used; recorded as a last-resort mirror.
- **`datetime.UTC`** does not exist in the system Python 3.9 (used for one quick check); the venv's 3.12
  has it. The pipeline runs on 3.12.

---

## 4. Known gaps

- **Revisions every month.** Late reports, corrections and the homogenisation of GHCN change earlier
  months with every release (the FAQ, §2.1). The whole snapshot is rebuilt and replaced each month, so
  the app always shows one consistent release; the release date is in the snapshot and on screen. A
  cell's value for 1950 can differ by a few hundredths from last month's.
- **1200 km smoothing.** A station's anomaly speaks for every cell within 1,200 km, so a cell with a
  colour need not have a thermometer in it. Arctic 64–90° N shows 31 % of cells with data in 1880, 60 %
  in 1900 and **100 % from 1940** — a few coastal stations filling the basin, not an observed ocean.
  Antarctica (64–90° S) jumps from 29 % in 1955 to **96 % in 1957**, the International Geophysical
  Year's stations. The About screen says the coloured area is an estimate around stations and ships,
  and the grey is where GISS makes none.
- **Pre-1900 coverage.** 68 % of cells (83 % of area) in 1880, 76 % (90 %) in 1900; the early decades
  are mostly the Northern Hemisphere's land and shipping lanes. The early maps are honest as grey, but
  a viewer should not read the 1880s Southern Ocean as "no change".
- **Ocean cells are sea-surface anomalies.** Over ice-free water the cell is ERSST's sea-surface
  anomaly standing in for air; over sea ice, land stations' air (the FAQ). The Southern Ocean's
  sea-ice zone stays grey in 2025 (about 180 cells).
- **ERSSTv6.** NCEI has released ERSSTv6; GISTEMP still uses v5. If GISS switches, the file name and
  `IOCEAN` in `history` will change; the contract check fails on the name and the pipeline needs a
  deliberate update (and the About text a new line).
- **No seasonal adjustment** in a 9–11-month annual mean (§1.4), and a partial year is not comparable
  cell by cell with full years (§1.5).
- **The live September grid has not been read here** (§3). Its contract is expected to equal the
  August file's (same URL, same generator); the probe workflow or the pipeline stage confirms it, and
  the research pins in `sources.GISTEMP_RESEARCH` should be replaced by the live files when GISS
  answers.
- **Uncertainty is not shown.** Lenssen et al. 2024 publish an ensemble; the app shows the central
  analysis only and should say so in one line.
