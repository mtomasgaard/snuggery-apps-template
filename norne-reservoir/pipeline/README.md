# pipeline

Two independent builds live here.

**The reservoir** (`fetch_model.py` → `run_simulation.py` → `validate.py` → `extract.py`) rebuilds
`data/model.json` and the five `.bin` files from the public Norne deck. It needs OPM Flow, which
publishes Linux x86_64 wheels only, and it takes hours. `pipeline/build_data.sh` runs the whole
chain.

**The topside layers** (`build_topside.py` → `validate.py --topside-only`) rebuild
`data/topside.json` and `data/topside-network.json`. They need **nothing but the Python standard
library**, on any platform, and take about two seconds from a warm cache. Nothing in the reservoir
build is touched, and neither file is read by the app until a topside toggle is switched on.

```bash
python3 build_topside.py --data-dir ../data          # both stages
python3 build_topside.py --no-network                # stage 1 only
python3 build_topside.py --cache /path/to/cache      # a different download cache
python3 build_topside.py --offline                   # fail instead of downloading anything
python3 validate.py --topside-only --data-dir ../data
```

`--cache` defaults to the research cache beside the app folder if it is there, and otherwise to
`pipeline/work/cache`, which the script then fills itself. It is **cache-first**: a file already on
disk is never downloaded again, so a rebuild is reproducible and costs no traffic. Every request to
the Directorate's FactMaps service is a POST, because a GET whose `where` clause contains a quote is
answered by their firewall with an HTML page and HTTP 200.

## What it reads

| from | file | why |
| --- | --- | --- |
| FactMaps 307 | `norway/norne_facilities_60km_box.json` | the FPSO, the riser base, the seven templates and the tie-back satellites, EPSG:23032 |
| FactMaps 307 | `norway/chain_facilities.json`, `norway/chain_facilities_4326.json` | the Norne/Heidrun tee, the Åsgard riser base, Kårstø |
| FactMaps 307 | `norway/onshore_facilities*.json` | 45 onshore terminals |
| FactMaps 311 | `norway/norne_gas_export_16in.geojson` | the 16-inch line, 63 vertices |
| FactMaps 311 | `norway/pipelines_all_ncs*.geojson` | every pipeline on the shelf, in both output CRSs |
| FactMaps 502 | `norway/neighbour_fields*.geojson` | 12 neighbouring field outlines |
| FactPages | `norway/norne_production_1997_2006.csv` (or the whole-shelf report) | the reported monthly volumes |
| Natural Earth | `global/ne_50m_coastline.zip` | the coastline, read straight out of the shapefile |
| Eurostat | `global/eurostat_*_imports.json` | where Norwegian gas and crude actually go |
| opm-data | `opm/BC0407_HIST01122006.SCH` | the deck's `WELSPECS` groups, for the well→template map |

Lengths are always measured on the Directorate's projected geometry (EPSG:23032), never on the
longitude/latitude copy, so every figure the app shows matches the figures in the research.

## Determinism

Two runs from the same cache produce byte-identical files. Measured on 2026-09-23,
`python3.12 build_topside.py` run twice with the data directory emptied in between:

```
$ shasum -a 256 run-a/*.json run-b/*.json
1831c0109c29c82e67a447d6053eda7f821b0e4fbb36774300093aa37d5d8255  run-a/topside-network.json
80f675f1f0a4f3cb202965ed1c0c0f810f91fadcc3ae656fc29cba5a0b3af3a9  run-a/topside.json
1831c0109c29c82e67a447d6053eda7f821b0e4fbb36774300093aa37d5d8255  run-b/topside-network.json
80f675f1f0a4f3cb202965ed1c0c0f810f91fadcc3ae656fc29cba5a0b3af3a9  run-b/topside.json
$ cmp run-a/topside.json run-b/topside.json && cmp run-a/topside-network.json run-b/topside-network.json
(no output: identical)
```

A stronger run was also made: a build into an **empty** cache, downloading all fifteen inputs fresh
from the Directorate, Natural Earth, Eurostat and opm-data, produced the *same two hashes* as the
build from the research cache. So the output does not depend on which copy of the inputs is used.

| file | bytes | gzipped | budget |
| --- | ---: | ---: | ---: |
| `data/topside.json` | 13,736 | 4,515 | 20,000 |
| `data/topside-network.json` | 163,534 | 55,763 | 220,000 |
| both | 177,270 | 60,278 | 240,000 |

What makes it deterministic, and what to keep that way:

- `BUILD_DATE` and `RETRIEVED` are **pinned constants**, not `today()`. A build in a year's time
  still writes the same bytes; change them deliberately when the sources are re-fetched.
- Every list that is not inherently ordered is sorted before it is written (pipelines and terminals
  by id, field outlines by name, coastline lines by their first point).
- Coordinates are rounded to whole metres with half-away-from-zero, not with Python's
  round-half-to-even, so -2138.4999 becomes -2138 on every platform.
- Start-up dates are converted in Europe/Oslo with the EU summer-time rule implemented in the file,
  and cross-checked against the tz database when there is one — so the build does not depend on a
  `tzdata` package being installed.
- The two pipeline answers (EPSG:23032 and EPSG:4326) are paired by name and vertex signature, not
  by position in the array, so a server that reorders one of them is matched rather than
  mislabelled.

## What the build refuses to write

`build_topside.py` checks its own output before writing and exits non-zero on any of: a frame count
that is not the model's, a model centre more than 1 cm from `model.json`'s, a production series that
is not 110 long, an FPSO anywhere but (-463, +316), template counts that are not 3/4/5/6 at frames
0/1/9/108, template M appearing inside this history, an export line whose first frame is not the
first month of reported gas, a flow reference that has drifted more than 5 % from the model's own
rates, a `fixture` flag, or an `http://` or `https://` anywhere in either file.

`validate.py --topside-only` then re-checks the written files independently, against
`data/model.json` and `data/geometry.bin` — including that every template falls inside the grid
footprint, that the tee is within 5 m of the Åsgard Transport trunk, and that the highlighted Norne
route ends at the Kalstø landfall and passes nowhere near a refinery.
