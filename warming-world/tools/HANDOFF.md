# Handoff: Warming World (data)

How to run and maintain Warming World's data pipeline. `RESEARCH.md` has the sources and why;
`CONTRACT.md` has every byte layout and, at its end, the builder's decisions; `../DESIGN.md` says what
the app does with the files. This file says how to rebuild them, and how the live snapshot
(`data/snapshot.json`, monthly) is made and published.

## What belongs to this app

```
warming-world/
  data/snapshot.json            the demo snapshot the ZIP ships (rebuilt by build_all.sh); the live one is on
                                the data-warming-world branch, rewritten once a month
  assets/world.json             Natural Earth 1:50m land, land borders, lakes ≥ 5 000 km² (rebuilt by hand)
  assets/places.json            all 1 251 Natural Earth populated places, four tiers     (rebuilt by hand)
  assets/about.json             About's nine sections; placeholders the app fills from the snapshot
  CREDITS.txt                   every source, licence, change, citation and the font, from the fragments
  fonts/                        Archivo, cut by tools/art/font_subset.py (checked by build_static, not built)
  tools/ref/snapshot_ref.json   66 cells computed from the integers, the partial label (decoder test)
  tools/RESEARCH.md CONTRACT.md HANDOFF.md bench/ art/      documents and design tools
scripts/warming_world/          the pipeline; cache/ and .venv/ are gitignored
  sources.py paths.py common.py every source and pin (GISTEMP's contract, the research copies, Natural Earth,
                                Archivo); paths; helpers (standard library + requests)
  netcdf3.py                    classic NetCDF reader, standard library
  gistemp.py                    the frame maths: contract check (V1), table (V2), annual rule, rounding, stats
  build_snapshot.py             the snapshot: fetch (live or research), build, V1–V13, write; --ref writes the
                                decoder reference and the GISTEMP credits fragment
  refresh.py                    the workflow's entry point: build_snapshot.py's main() under the contract's name
  build_static.py               world.json, places.json, the font check, about.json, CREDITS.txt
  verify_snapshot.py            recomputes every frame from the grid with code of its own; CONTRACT §8.2
  verify_static.py              CONTRACT §8.3, plus every number the About prose types, re-derived
  build_all.sh                  snapshot -> static -> verify_static -> verify_snapshot [-> rebuild and compare]
  credits/                      licence evidence, quoted verbatim; credits/fragments/*.json, one per step
  probe.py probe-urls.txt       what every source returns now
  requirements.txt              pinned: requests (the refresh), numpy and scipy (research only)
.github/workflows/refresh-warming-world.yml   15th and 22nd: refresh.py -> verify -> force-push to data-warming-world
.github/workflows/probe-warming-world.yml     diagnostic: runs probe.py on a runner
.github/workflows/publish-web.yml             (shared) lists "Refresh warming-world"; takes warming-world's data
                                              from its branch
Template/.gitignore                           scripts/warming_world/cache/
```

Deleting the app means deleting `warming-world/`, `scripts/warming_world/`, the two workflows named
`*-warming-world.yml`, the cache line in `Template/.gitignore`, the two `publish-web.yml` entries
("Refresh warming-world" and `warming-world` in the data-branch loop), the `data-warming-world`
branch, and (once the app stage adds them) the README row and the `LICENSE` carve-out.

## Running the build

**Locally**, from `Template/scripts/warming_world/` (Python 3.12):

```bash
/opt/homebrew/bin/python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
./build_all.sh                 # the demo from GISS's live files (what the ZIP ships), static, both verifiers;
                               # it fails, writing nothing, when data.giss.nasa.gov does not answer
./build_all.sh --source research   # the sha256-pinned Internet Archive copies instead (the record)
./build_all.sh --offline       # the chosen source from cache/ only, no network
./build_all.sh --twice         # then rebuild and prove 10 files byte-identical
./build_all.sh --source live   # the demo from GISS's live files (when data.giss.nasa.gov answers)
.venv/bin/python build_snapshot.py --source research --offline --ref    # just the snapshot
.venv/bin/python build_static.py --offline                              # just the static files
.venv/bin/python verify_snapshot.py [path] ; .venv/bin/python verify_static.py
```

The cache (`cache/`, 42 MB) holds the research copies (`wayback/`, sha256-pinned in
`sources.GISTEMP_RESEARCH`), Natural Earth (`ne/`, pinned in `sources.STATIC`) and the last live read
(`live/`, with `meta.json` recording each file's `Last-Modified` and read time, so `--source live
--offline` rebuilds from it). A pinned file is never refetched; one that no longer matches its pin
stops the build.

**What a run printed in the lead's pass, 2026-10-01 (UTC)** (`./build_all.sh --offline --twice`, 7.9 s
by `time`, exit 0; every line below is copied from its output; against the builders' run, V11, V13, the
Antarctic and `CREDITS.txt` lines differ, and the two ask lines are new):

```
V1 the file's contract: CDF-1, tempanomaly int16 ×0.01 fill 32767 K, 90 × 180 cells south-first, 1759 months 1880-01–2026-07; Created 2026-08-10 06:37:42 by SBBX_to_nc 2.0 - ILAND=1200, IOCEAN=NCDC/ER5, Base: 1951-1980
V7 same release: grid 2026-07, table 2026-08 (research mode: the table may be one month newer; only the grid's months are used)
V8 freshness: skipped in research mode (2026-07 ended 61 days before 2026-10-01)
V3 shape: 147 steps 1880–2026, 24 months 2024-08–2026-07, 171 frames of 16200 B, layers 171 ≤ 256
V4 orientation: row 0 equals source row 89 (lat 89) under the rule in 1880 (0 of 180 cells with data) and 2025 (180 of 180 cells with data)
V5 no clipping: every tenth within −127…127 (min -6.4, max +11.7 °C over all 171 frames); annual range [-6.4, 6.4]
V6 GISS's table: 146 complete years, max |gridMean − J-D| 0.031 °C (1884), RMS 0.0095 (limit 0.05); the 24 months, printed only: max 0.050 (2025-10)
V9 coverage (area): 1880 0.8265, 2025 0.9922, minimum 0.8265 (1880)
V10 none means none: in every frame the 255 bytes are exactly the cells failing their rule
V11 sizes: snapshot 1,151,893 B ≤ 1,500,000; deflated (zlib 6) 814,609 B; ask 177 rows ≤ 200, 58,976 B ≤ 70,000
V12 round trip: the serialized file parses, keys in order, all 171 planes inflate to the frames in memory
V13 text: 769 strings NFC, no control characters, no AI vendor names, no statement attributed to NASA, U+202F before every °C, km and %
ok    claim: north of 64° N: every cell has data first in 1931, in every complete year from 1946; gaps between in [1934, 1935, 1943, 1944, 1945]; 1880 31.1%
ok    claim: south of 64° S: the area with data 0.3820 in 1955, 0.9266 in 1957 (prose: 38 % and 93 %, as the Antarctic reading prints them); by cells 0.286 and 0.956 (RESEARCH.md: 29 % and 96 %)
ok    claim: 2025: 179 of 181 gray cells lie in 54–70° S (98.9%; prose: nearly all)
ok    claim: 2025 Jan–Jul against the full year: mean |difference| 0.297 °C over 16,019 cells (from 0.1 °C months; prose: about 0.3)
ok    CREDITS.txt: the pinned attribution verbatim (U+202F before °C, as sources.py and the snapshot carry it), both GISS citations (accessed 2026-10-01), the endorsement, the three inputs' citations, Natural Earth, Archivo; no plain space before °C, km or %; 7,713 B ≤ 30,000
verify_static: all checks passed
ok    every frame recomputed from the grid with this file's own code: 171 of 171 byte-identical (0 differ); coverage, beyondScale and gridMean equal on every one
ok    GISS's table: every globalMean is the table's (J-D, the month, or the partial mean); the decoded map's area-weighted mean is within ±0.05 °C of J-D for all 146 complete years (max 0.031 in 1884)
ok    1 000 random cells (seed 1000): 912 decode within 0.0500 °C of the source's exact mean (limit 0.05, half a step), 88 are none where the source fails its rule
skip  freshness: research mode (the Internet Archive copy of the August release); 2026-07 ended 61 days before 2026-10-01, the live limit is 60
ok    ask pole means: all 342 north64AnomalyC and south64AnomalyC values (171 rows) equal the app's capMean recomputed from the shipped frames (0 null); 3 exact ties (a cap with values in one row) rounded away from zero; every other mean lies at least 3.46e-04 of a hundredth from a tie
ok    ask notes: the source note carries NASA's AI clause and the newer table (2026-08); no string attributes a statement to NASA
ok    ask: 6 notes, 147 year rows matching their steps, 24 month rows; 177 rows ≤ 200, 58,976 B ≤ 70,000
verify_snapshot: all checks passed
byte-identical: 10 files
```

| File | Bytes | As the ZIP stores it | Cap |
| --- | --: | --: | --: |
| `data/snapshot.json` (live, release 2026-08; the research build was 1 151 893) | 1 152 161 | 814 925 | 1 500 000 raw |
| of which `ask` (177 rows) | 58 798 | | 70 000 |
| `assets/world.json` | 361 123 | 123 695 | 420 000 |
| `assets/places.json` | 59 509 | 17 000 | 70 000 |
| `assets/about.json` | 6 510 | 2 819 | 40 000 |
| `CREDITS.txt` | 7 713 | 3 070 | 30 000 |
| `tools/ref/snapshot_ref.json` (not shipped) | 3 002 | | 20 000 |

"As the ZIP stores it" is `common.zip_stored_size()` (deflate level 6, as `build-zips.yml`'s `zip`).
The data the ZIP carries thus comes to about 960 KB; the ZIP itself is measured by the app stage's
`tools/check.mjs`.

**What was tried against the checks** (2026-10-01, copies in the session scratchpad, never the
committed files). `verify_snapshot.py` failed, naming the defect, on: one byte changed in 1950's
frame; 2025's rows left south-first; a `globalMean` off by 0.01; the partial year marked complete; a
vendor name in an `ask` note; an extra top-level key; a live-mode file 61 days old. It passed the
same file at 45 days. `build_snapshot.py` exited 1 and wrote nothing on: a truncated grid (V1), a
`***` in the middle of 1950 (V2), the September table against the July grid in live mode (V7), a
July grid on 2026-10-01 in live mode with `--skip-release` set to that release (V8, checked before
the skip). It wrote nothing and exited 0 on the same release with `--skip-release`. `verify_static.py`
failed on: "from 1940" for the Arctic, an edited quotation, an unknown placeholder, "about 0.5 °C",
"26,000", "0.3 °C" with a plain space, "31 %" for 1955, a place removed, a citation altered, an extra
file in `assets/`.

**What the lead's pass tried against its new checks** (2026-10-01, scratch copies only).
`verify_snapshot.py` failed, naming the defect, on: "According to NASA" added to an ask note; the
source note without NASA's AI clause; without the newer-table clause; a `south64AnomalyC` off by 0.01;
1888's Antarctic tie rounded as before (0.17 for 0.18); a wrong `north64AnomalyC`; a plain space before
°C in `source.detail`; `south64AnomalyC` missing from a month row. `verify_static.py` failed on: the
Antarctic sentence by cells again (29 %, 96 %), "cells" with the area figures, the attribution with a
plain space in `CREDITS.txt`, a number and "°C" split across a line break, and `sources.GISTEMP`
worded otherwise than the pinned sentence. Each unchanged copy passed.

**The live path, exercised without GISS**: with `sources.GISTEMP`'s two URLs pointed at the
Internet Archive copies (a test harness, not a change to the code), `build_snapshot.run(['--source',
'live', …])` downloaded the table, then the grid; the archive broke the grid's transfer at 8 402 889 B
(`IncompleteRead`), `common.http_get` resumed it, and the file matched the research pin's sha256
(`93f73f64…`). `cache/live/meta.json` was written. The run then stopped at V7, as it should (the
archived table is a month newer than the archived grid). With `requests` as the only package in a
fresh venv (`pip freeze`: certifi, charset-normalizer, idna, requests 2.34.2, urllib3; `import numpy`
→ `ModuleNotFoundError`), `refresh.py --source research --offline --generated-at 2026-10-01T00:00:00Z`
wrote a file byte-identical to the pipeline venv's, and `verify_snapshot.py` passed on it.

**If a step fails** it prints `BUILD FAILED:` with the check's number (CONTRACT §8.1) and writes
nothing; `verify_*` print `FAIL` and the defect. A changed GISS file format fails V1 (update
`sources.GISTEMP['contract']` only after reading the new file; a switch to ERSST v6 changes the file
name and `IOCEAN`, RESEARCH §4). A changed Natural Earth file fails its pin. Run `probe.py` (or *Probe
Warming World sources* on GitHub) to see what a source serves now.

## The monthly refresh

**On GitHub**: *Refresh warming-world* runs on the 15th and the 22nd (and on demand, with `force`).
It installs `requests` only, reads the published `release.id` from the `data-warming-world` branch,
runs `refresh.py --skip-release <id>`, then `verify_snapshot.py` on the new file, and force-pushes one
parentless commit behind Global Weather's branch-name guard. It publishes nothing when GISS's newest
release is the one already published, and fails red when the newest month ended more than 60 days
before the run. A failed run leaves the last good snapshot on the branch. `publish-web.yml` follows
it and takes the branch's snapshot into the browser copy.

**The Shortcut's address** (for MANUAL_STEPS):

```
https://raw.githubusercontent.com/OWNER/REPO/data-warming-world/warming-world/data/snapshot.json
```

or, for a private repository,
`https://api.github.com/repos/OWNER/REPO/contents/warming-world/data/snapshot.json?ref=data-warming-world`
with `Accept: application/vnd.github.raw` and the read token.
That address is the only per-app step (the usual one row in the shortcut's Dictionary): the
workflow needs no secret, no account and no key, and the repository holds a real snapshot from the
first commit, so **there is no `PROMPT.md`** for this app.

**Actions minutes.** Two scheduled runs a month (the 15th, and the 22nd for a late release, which
normally finds the release already published and writes nothing), each billed as one minute: the
build takes 2.0 s and the verifier about 3 s locally, and the rest is the runner's setup, the sparse
checkout, `pip install requests` and the 25.8 MB grid download (estimated, not measured on a runner;
the job's timeout is 15 minutes). Each completed run also starts *Publish apps to the web*, about one
minute more even while Pages is off. So about **4 minutes a month, about 48 a year** (24 if the 22nd's
slot is deleted, which leaves the twelve runs the plan named): negligible on GitHub Free's 2 000 a
month for a private copy, and free on a public repository.

**The runner's path, rehearsed locally on 2026-10-01** (a copy of `scripts/warming_world/` alone,
as the sparse checkout leaves it, and a fresh venv holding only `requests==2.34.2`, `import numpy` →
`ModuleNotFoundError`): the workflow's own command, `refresh.py --out out/warming-world/data/snapshot.json
--skip-release ""`, retried the table five times against GISS's refused port, printed `BUILD FAILED:
could not fetch https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv … [Errno 61]
Connection refused`, exited 1 after 63 s and wrote no `out/` at all, so the publish step would not
have run. The same copy with `--source research --offline` (the cache passed in through
`WARMINGWORLD_CACHE`) wrote 1 147 429 B and `verify_snapshot.py` printed `verify_snapshot: all checks
passed`.

## When GISS answered again (2026-10-01, done from GitHub)

data.giss.nasa.gov refused every connection from the build machine from about 00:00 UTC on
2026-10-01 (RESEARCH §3; `curl: (7) … Connection refused`, and still at 06:00 UTC) — but answered
GitHub's runners the whole time. So the research build (the Internet Archive's copy of the August
release, newest month 2026-07, `release.mode` "research", `sources[].via` naming the captures) was
the demo for about an hour, and the live path was proved on the runners instead:

1. The first *Refresh warming-world* run, started by the publish itself, read the live September
   release (grid 25 853 076 B, sha256 6a597332…, Last-Modified 2026-09-08) and created
   `data-warming-world` in 29 s. The data branch is what phones get.
2. *Build Warming World demo* (`build-warming-world.yml`, new that morning) ran `build_all.sh --source
   live --twice` on a runner — V1–V13 and both verifiers, 10 files byte-identical — and committed the
   live demo to `main` (release 2026-08/2026-09-08), then dispatched the ZIP build. It repeats every
   16 January and on demand, so the ZIP's own copy is never more than a year behind the branch; a
   local `./build_all.sh` (the default is now `--source live`) does the same when GISS answers here.
3. Still open: replace the research pins in `sources.GISTEMP_RESEARCH` with the live files only if
   the measurements in RESEARCH.md are re-run on them; otherwise leave them as the record of what was
   measured. The research build stays reachable as `./build_all.sh --source research`.

## Known data gaps

| Where | Gap | Why |
| --- | --- | --- |
| Every cell | a cell's color need not contain a thermometer: station anomalies are spread over 1 200 km | GISTEMP's method (Hansen et al. 2010); About §2 says so |
| Arctic, 64–90° N | fully colored only in every year from 1946 (and 1931–33, 1936–42); 31 % in 1880 | smoothing from coastal stations; About §3 |
| Antarctica, 64–90° S | 38 % of its area in 1955, 93 % in 1957 (29 % and 96 % of its cells) | the International Geophysical Year's stations |
| Southern Ocean, 54–70° S | gray in recent years (179 of 2025's 181 gray cells) | the sea-ice zone: no sea-surface value |
| Partial year | a mean of the published months, not comparable cell by cell with full years (0.297 °C mean difference, 2025 Jan–Jul against the year) | GISS publishes no partial annual figure |
| 9–11-month cells | no seasonal adjustment | 96 % of cell-years are complete (RESEARCH §1.4) |
| Revisions | earlier months change slightly every release; the snapshot is replaced whole | GISS's FAQ |
| Uncertainty | not shown (Lenssen et al. 2024 ensemble) | About §7 |
| The demo | the ZIP's copy is the release of the last January run (or the last `build-warming-world` dispatch); the branch is monthly | the demo is committed to `main`, where a monthly 1.1 MB would bloat every clone |

## Constraints summary (reuse in future prompts)

- Snuggery mini-app: one folder, `index.html` at its top, relative paths, ES modules, `fetch()` of
  its own files only, no `http(s)://` in any `.html`/`.css`/`.js`, no network, `localStorage` in
  `try/catch`, works at 390 × 844 in both themes, no AI vendor names in shipped text.
- Data: `data/snapshot.json` is the only file the phone's Shortcut replaces; `assets/` is static.
  Snapshot schema 1 in Global Weather's shape, a 180 × 90 grid of 2° **cells** (`cells: true`,
  `lon0` −179, `lat0` 89, north-first), one byte per cell, `−12.7 + 0.1·b` °C, 255 = no data, zlib
  level 9 per frame, base64, no delta. `steps` one per year from 1880 (the partial year last, only
  with 6–11 months, labeled "2026, Jan–Jul (partial)"), `months` the 24 newest. Every step carries
  GISS's own `globalMean`, the app's `gridMean`, `coverage` (area and cells) and `beyondScale`.
- Rules: a year's cell needs 9 of 12 months (the partial year ⌈0.75 n⌉ of n); means from integer
  hundredths, rounded half away from zero to 0.1 °C; never clamped; nearest cell, never
  interpolated; the map's ±4 °C and the stripes' ±1.5 °C are app constants, never data.
- Honesty: anomalies against 1951–1980, not temperatures; gray is no value, never zero; the partial
  year is labeled everywhere; every number in About is filled from the snapshot or re-derived by
  `verify_static.py`; NASA does not endorse the app; GISS's two citations with the access date.
- Refresh: monthly, standard library + `requests`, orphan branch `data-warming-world`, skip when the
  release is unchanged, red when the newest month is over 60 days old.
- Budgets: snapshot ≤ 1 500 000 B, `ask` ≤ 200 rows and 70 000 B, `world.json` ≤ 420 000 B,
  `places.json` ≤ 70 000 B, `about.json` ≤ 40 000 B, `CREDITS.txt` ≤ 30 000 B, ZIP ≤ 2 000 000 B.
- SI units: °C with a sign and U+2212, U+202F between number and unit and between thousands, in
  every string the pipeline writes as well as on screen (V13, `verify_static.py`).
- Ask: the `ask` rows feed an on-device model, so their source note says the answers are this app's
  reading of GISS's published data, which NASA has not reviewed and is not responsible for, and no
  string attributes a statement to NASA (NASA's AI guidance); the pole means are the chip's own.
