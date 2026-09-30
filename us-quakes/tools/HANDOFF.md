# Handoff: US Quakes (static data)

How to run and maintain US Quakes' data pipeline. `RESEARCH.md` has the sources and why; `CONTRACT.md`
has every byte layout and, at its end, the builder's decisions; `../DESIGN.md` says what the app does
with the files. This file is how to rebuild them, and how the live snapshot (`data/snapshot.json`,
hourly) is made and published ("The hourly refresh", below).

## What belongs to this app

```
us-quakes/
  assets/history.bin, history.json   every earthquake to the cutoff, as columns     (rebuilt each January)
  assets/geo.json                    basemap, depth bands, places, faults, volcanoes, relief bounds,
                                     region chips, section presets                   (rebuilt each January)
  assets/about.json, stories.json    About's text and numbers; the seven stories      (rebuilt each January)
  assets/relief-{conus,ak,hi,pr}.jpg shaded relief, grey JPEG, Web Mercator           (committed; rebuilt by hand)
  CREDITS.txt                        every source, licence, what was changed, fonts   (rebuilt each January)
  data/snapshot.json                 the demo snapshot the ZIP ships (rewritten each January); the live one
                                     is on the data-us-quakes branch, rewritten about hourly
  tools/ref/history_ref.json         1 000 seeded rows + the six known events, raw CSV strings (decoder test)
  tools/ref/section_ref.json         the four presets' first 200 rows, along/cross km (section test)
  tools/ref/snapshot_ref.json        the demo snapshot's first and last 250 rows, source values (decoder test)
  tools/RESEARCH.md CONTRACT.md HANDOFF.md design_measure.py art/    documents and design tools
scripts/us_quakes/                   the pipeline (below); cache/ is gitignored
  sources.py paths.py common.py      every source and pin; paths; helpers (standard library + requests)
  fetch_catalog.py                   ComCat windows under the 20 000 limit -> cache/comcat/, catalog-windows.json
  fetch_relief.py                    3DEP hillshade + elevation exports -> cache/relief/, relief-extents.json
  fetch_layers.py                    fault ZIP, Natural Earth, the volcano sample pin -> cache/
  build_static.py                    runs build_history, build_relief (check), build_geo, build_about
  build_history.py build_relief.py build_geo.py build_about.py      one output each
  verify_static.py                   every check of CONTRACT §11.1, printed
  refresh.py                         the hourly snapshot (standard library + requests) -> data/snapshot.json
  verify_snapshot.py                 CONTRACT §3 and §11.3, independently, against the cached sources
  build_all.sh                       fetch -> build -> verify [-> rebuild and compare]
  catalog-windows.json relief.json relief-extents.json               committed pins and measurements
  content/about.json stories.json quotes.json                        the words, as templates
  credits/                           licence evidence and the verbatim USGS quotes (usgs-statements.txt)
  samples/                           saved API responses; volcano-getUSVolcanoes.json is the pinned list
  probe.py probe-urls.txt            what every source returns now
  requirements.txt                   pinned: requests, pyshp, pillow, numpy, pypdf, pyogrio
.github/workflows/refresh-us-quakes.yml about hourly: refresh.py -> verify -> force-push to data-us-quakes
.github/workflows/build-us-quakes.yml   2 January + on demand: the yearly rebuild and the demo snapshot, then build-zips
.github/workflows/publish-web.yml       (shared) lists both workflows; takes us-quakes' data from its branch
.github/workflows/probe-us-quakes.yml   diagnostic: runs probe.py on a runner
Template/.gitignore                      scripts/us_quakes/cache/
```

Deleting the app means deleting `us-quakes/`, `scripts/us_quakes/`, the workflows named
`*-us-quakes.yml`, the cache line in `Template/.gitignore`, the three `publish-web.yml` entries
("Refresh us-quakes", "Build US Quakes data", and `us-quakes` in the data-branch loop), the
`data-us-quakes` branch, and (once the app stage adds them) the README row and the `LICENSE`
carve-out.

## Running the build

**Locally**, from `Template/scripts/us_quakes/` (Python 3.12):

```bash
/opt/homebrew/bin/python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
./build_all.sh                 # fetch what the cache lacks, build, verify (incl. the USGS count check)
./build_all.sh --offline       # the same with no network; skips only the count check
./build_all.sh --relief        # also re-export and rebuild the relief JPEGs (deliberate; they are committed)
./build_all.sh --twice         # then rebuild and prove assets/, CREDITS.txt and tools/ref/ are byte-identical
.venv/bin/python build_static.py                 # just the four build steps, from the cache
.venv/bin/python verify_static.py [--offline]    # just the checks
```

The cache (`cache/`, 181 MB: ComCat 69 MB, Natural Earth 59 MB, faults 31 MB, relief 22 MB) is
**never refetched**: every ComCat window ends before the cutoff and is pinned by sha256 in
`catalog-windows.json`, every static file by sha256 in `sources.py`. A rerun makes no request at all.
A window missing from the cache is counted and downloaded again, and the run prints whether its bytes
still match the pin (a changed window means USGS revised it; the manifest takes the new pin and the
history changes with it). A cached file that does not match its pin stops the build (a corrupt cache:
delete the file).

**What a run printed on 2026-09-30** (`./build_all.sh --relief --twice`, 55 s, exit 0; `verify_static`
printed 116 `ok` lines and "all checks passed"):

```
conus 1600..1900 mNone: cached 493 vs USGS count 493 (+0.000 %)          (and the other seven box/eras, all +0.000 %)
all 385,071 rows within bounds (failures 0); worst |Δlon| 0.001000°, |Δlat| 0.000500°, |Δdepth| 0.0050 km
text table holds exactly the 15,664 rows at M4.5+ (decoded tenth)
ak018fcnsk91   2018-11-30T17:29 61.346 -149.956 depth 46.70 M7.1 mw   (and the other five known events)
relief conus registration gate: 0.9917 agreement with Natural Earth 1:10m land, best shift [0, 0] px
preset cascadia 513 km: 709 events within ±50 km at M2.5+ (≥ 300)
assets/ in all: 8,738,688 B raw, 5,701,599 B as the ZIP stores it (cap 6,000,000); headroom 298,401 B
byte-identical: 12 files
```

**What the lead's pass printed** (`./build_all.sh --offline`, 12 s, exit 0; `verify_static` ended "all
checks passed"): the basemap past the axis (CONTRACT §4.1) and the depth code 1500 kept for the
catalog's exact 10 (CONTRACT §1):

```
history: depth code 1500 holds the 23,759 rows at exactly 10 km; 203 measured depths that round to 10.00 km written as 9.99 or 10.01
all 385,071 rows within bounds (failures 0); worst |Δlon| 0.001000°, |Δlat| 0.000500°, |Δdepth| 0.0090 km; depth code, magnitude, status and type exact
land       458 pieces decode inside the basemap (192 reach past the axis box) and close        (and coast, lakes, borders, states, the eight bands)
assets/ in all: 8,945,829 B raw, 5,851,793 B as the ZIP stores it (cap 6,000,000); headroom 148,207 B
```

Before and after, the four relief JPEGs, `stories.json`, `history_ref.json` and `section_ref.json`
hashed identical (sha256); `history.bin` changed in 203 depth codes, `history.json` in `codes.d`'s
wording, `geo.json` in its basemap, `about.json` and `CREDITS.txt` in the negative-depth note, the
display note and two adaptations.

| File | Bytes | As the ZIP stores it | Cap |
| --- | --: | --: | --: |
| `assets/history.bin` | 5,339,530 | 3,216,030 | 5,800,000 raw |
| `assets/history.json` | 2,856 | 1,368 | 16,000 |
| `assets/geo.json` | 1,851,803 | 987,085 | 1,900,000 raw |
| `assets/relief-conus.jpg` | 941,150 | 922,296 | 1,050,000 |
| `assets/relief-ak.jpg` | 635,665 | 600,888 | 720,000 |
| `assets/relief-hi.jpg` | 43,668 | 32,856 | 60,000 |
| `assets/relief-pr.jpg` | 84,413 | 76,504 | 100,000 |
| `assets/about.json` | 37,509 | 11,722 | 40,000 |
| `assets/stories.json` | 9,235 | 3,044 | 30,000 |
| **`assets/` total** | **8,945,829** | **5,851,793** | **6,000,000 in the ZIP** |
| `CREDITS.txt` | 20,410 | | 40,000 |
| `tools/ref/history_ref.json` / `section_ref.json` | 134,986 / 40,232 | not shipped | 250,000 each |

**If a step fails** it prints `BUILD FAILED:` with the reason and writes nothing: a changed upstream
file (update the pin in `sources.py` after looking at it), a budget exceeded (see the levers below), a
quotation not found verbatim in `credits/usgs-statements.txt`, a numeral in a text that is not a
computed number, a story over 70 words or whose anchor no longer holds its claim, a relief gate that
fails. Run `probe.py` (or *Probe US Quakes sources* on GitHub) to see what a source serves now.

## The yearly rebuild

**On GitHub**: *Build US Quakes data* runs on 2 January (and on demand, with an optional `cutoff`
input, `YYYY-01-01`). It restores the download cache, runs `build_all.sh --cutoff <1 January> --twice`,
commits `us-quakes/assets`, `CREDITS.txt`, `tools/ref` and `catalog-windows.json` if they changed, and
dispatches `build-zips.yml` itself (a push with the job's token starts no workflow). With the cache it
downloads only the new year: `fetch_catalog.py` plans the span from the old cutoff to the new one on
its own, so every cached window stays exactly as it is. Without the cache it refetches every window
(about 400 000 rows at one request a second) and says which ones USGS has revised.

**By hand**: `./build_all.sh --cutoff 2027-01-01 --twice` (a cutoff in the future is refused: its
windows would not be closed). Then check the stories: their numbers are recomputed (Oklahoma's last
year moves with the cutoff), and a changed anchor stops the build rather than printing a wrong claim.

**The budget.** The history grows by about 12 000 rows a year, ≈ 100 KB as the ZIP stores it, against
148 KB of headroom since the lead's pass carried the basemap past the axis (it took 149 KB), so the
January 2027 rebuild fits and the 2028 one will fail its assertion. Then: Lower 48 relief at quality 70
(−86 KB, measured at the design stage; change `QUALITY` in `build_relief.py` and run with `--relief`),
faults at 200 000 m² (−44 KB; `FAULT_M2` in `build_geo.py`), the basemap's coarse zones doubled (the
10 in `build_geo.DETAIL` to 20: −22 KB, measured on the layers alone), then a decision for the owner
(the floor, or a bathymetry band). The build fails rather than trims.

**Relief** is rebuilt only by hand (`./build_all.sh --relief`), after the service's data changes and
the pins in `sources.RELIEF_PINS` / `RELIEF_DEM_PINS` are updated deliberately; it rewrites
`relief.json` and `relief-extents.json`. **The volcano list** is refreshed by hand too:
`fetch_layers.py --refresh-volcanoes` re-saves the sample and prints the new pin to paste.

## The hourly refresh

`refresh.py` writes `data/snapshot.json` (CONTRACT §3) from three USGS sources: the `all_month.geojson`
feed (every earthquake of the last 30 days, every magnitude), the FDSN event service (M2.5 and up from
1 January of the year before the history cutoff; asked once a day, the answer cached), and the
monitored volcanoes' alert levels. It needs the standard library and `requests` only, and reads the
cutoff, the volcano list and two quoted meanings from the committed `assets/history.json`,
`geo.json` and `about.json`. It validates the snapshot as it will be written and writes nothing on
any failure; `verify_snapshot.py` checks the written file again, independently, against the same
cached feed and FDSN answers.

**Locally**, from `Template/scripts/us_quakes/`:

```bash
.venv/bin/python refresh.py --ref            # the demo snapshot + tools/ref/snapshot_ref.json
.venv/bin/python verify_snapshot.py          # the checks, against cache/live/
.venv/bin/python refresh.py --out /tmp/s.json --prev old.json   # as the workflow runs it
.venv/bin/python refresh.py --requery        # ask FDSN again even if today's answer is cached
```

**What it printed on 2026-09-30** (the committed demo; the FDSN answer reused from a run 7 minutes
earlier, which had queried: 9 requests, 22.0 s):

```
feed 2026-09-30T16:51:54Z: 10,526 features, 9,694 in the boxes, 9,471 earthquakes from liveFrom
FDSN: reusing the query of 2026-09-30T16:44:57Z (0.1 h old)
FDSN part: 19,620 M2.5+ rows before liveFrom (0 replaced by the feed, 0 below the floor)
validated: 29,091 rows decode to their sources, text table 9,817, 200 ask rows, 533,512 B
refresh: 29,091 rows (19,620 M2.5+ from 2025-01-01, 9,471 from the feed of 2026-09-30T16:51:54Z),
  newest 2026-09-30T16:50:15Z; FDSN reused (2026-09-30T16:44:57Z); volcanoes live; 3.3 s
```

and `verify_snapshot.py` printed ten `ok` lines and "all checks passed", among them "live part = the
feed's 9,471 in-box earthquakes from liveFrom … every value within CONTRACT §1 of the feed",
"M2.5+ part = the FDSN answers' 19,620 in-box M2.5+ earthquakes before liveFrom … every value within
CONTRACT §1 of the CSV text", "newest earthquake 2026-09-30T16:50:15Z is 2 min before the feed", and
"ask: 200 flat rows … events match their decoded rows, summaries recount exactly". The FDSN counts
that day: Lower 48 4,685, Alaska 13,191, Hawaii 509, Puerto Rico 2,379.

The lead's pass wrote the demo again (`refresh.py --ref`, 4.4 s: the feed of 2026-09-30T23:17:42Z,
9,522 earthquakes from liveFrom, the FDSN answer of 16:44:57Z reused, 29,146 rows, 535,106 B), now with
depth code 1500 kept for an exact 10 (`common.depth_code`, CONTRACT §1), and `verify_snapshot.py`
printed eleven `ok` lines and "all checks passed", among them "depth code 1500: 2,890 rows, exactly the
sources' depths of 10 km; 2 depths that round to 10.00 km written as 9.99 or 10.01".

What was tried to make it fail, each refused as it should be: a feed 7 hours stale ("the newest
in-box earthquake is 7.0 h older than the feed"), a feature missing `sig`, `metadata.api` 2.8.0, and
nine corruptions of a written snapshot for `verify_snapshot.py` (a position code, a magnitude code,
an ask magnitude, a summary count, a volcano label, a stale `newest`, an attribution, an extra key,
a vendor name). The volcano API failing kept the previous block unchanged with `--prev`, and wrote
`ok: false` with null counts without it. A split threshold of 5,000 split Alaska into 21 monthly
queries whose counts summed to the one-shot 13,191.

**On GitHub**: *Refresh us-quakes* runs about hourly (`23 * * * *`; GitHub's cron is best effort), on
dispatch (tick `requery` to ask FDSN again), and on a push to `main` that touches the refresh's
code. It checks out only `scripts/us_quakes` and `us-quakes/assets`, installs `requests==2.34.2`,
restores the newest `us-quakes-fdsn-*` cache, takes the published snapshot from `data-us-quakes` as
`--prev`, runs `refresh.py` then `verify_snapshot.py`, saves a new cache entry only when the run
asked FDSN, and force-pushes one parentless commit holding `us-quakes/data/snapshot.json` to
`data-us-quakes`, refusing an empty branch name, `main`, `master` or the branch it runs from (the
guard and the orphan commit were exercised against a local bare repository; the workflow itself has
not run on a runner). A failed run publishes nothing, so the last good snapshot stays.

**The Shortcut's data address** is the data branch's copy, not `main`'s:

```
https://raw.githubusercontent.com/OWNER/REPO/data-us-quakes/us-quakes/data/snapshot.json
```

or, for a private repository, `https://api.github.com/repos/OWNER/REPO/contents/us-quakes/data/snapshot.json?ref=data-us-quakes`
with `Accept: application/vnd.github.raw` and the read token. That is the only per-app step (the
usual one row in the shortcut's Dictionary): the workflows need no secret, no account and no key,
so **there is no `PROMPT.md`** for this app.

**Actions minutes.** The script takes 3 s locally (22 s on the one run a day that asks FDSN); with the
runner's setup, the sparse checkout and the install a run should stay under a minute, but that is an
estimate, not a measurement on a runner. GitHub bills each job rounded up to a whole minute: about **720 minutes a month** hourly (744 in a 31-day month). Each completed run also
starts *Publish apps to the web*, which costs another minute even while Pages is off, so about
**1,440** in all. Free on a public repository. On a private copy under GitHub Free (2,000 minutes a
month) that is about 72 % of the allowance for one app: change the cron to every three hours
(`23 */3 * * *`, about 480 minutes with publish-web), and delete `publish-web.yml` if the apps are
not published to the web. The workflow's header says the same.

## Known gaps

| Where | Gap | Why |
| --- | --- | --- |
| History | rows are as USGS listed them on 2026-09-30; later relocations, magnitude changes and deletions of old events arrive only if the cache is lost and refetched, or the window is deleted by hand | closed windows are cached for good so rebuilds are byte-identical; the 0.5 % count check catches large drift |
| History | five rows an M2.5+ query returned with a preferred magnitude below 2.5 are dropped (listed in `history.json`) | the floor rule is on the preferred magnitude |
| History | before 1900, positions and times are nominal (round numbers, year-only dates); 607 of 625 have no depth, 180 no magnitude | source |
| History | 2,975 rows are `automatic`, including the 1964 M9.2 | source; the app draws only live automatic rows hollow |
| History | the file keeps ids and place text for M4.5+ only (15,664 rows) | size; other rows get a computed "near" line in the app |
| Relief | covers the United States and some land across the Canadian and Mexican borders, not the Bahamas; land within half a metre of sea level loses its shading | where 3DEP had elevation; whole-metre elevation mask |
| Relief | the Natural Earth 1:10m check prefers a 1 px southward shift in Alaska, Hawaii and Puerto Rico | the reference's own generalisation; the DEM is within a pixel of two Hawaii capes |
| Faults | as last reviewed (newest review 2019, plus undated 2025 additions); age classes printed by name only | no USGS page read here states their time bounds |
| Faults | four Aleutian trace segments west of 172° E are outside the map | the axis starts at 172° E |
| Basemap | ends at 168° E–55° W and 25° S–81° N; past it the app hatches the paper, which shows only at the opening's whole arc and the widest zoom | the phone's framings, measured, lie inside it; the budget |
| Basemap | outside the axis's width or 14°–75° N it is simplified ten times more coarsely, and south of 5° N eighty times | seen there only at the Lower 48's and Alaska's scale (4–18 km a pixel); 149 KB already spent |
| Volcanoes | the static list is the 2026-09-30 sample, 148 of 170 inside the boxes (not the Marianas or Samoa) | refreshed by hand |
| Text | the field glossary (status, felt, tsunami, alert, sig, depth) is quoted from USGS's ComCat Event Terms as archived on 2025-01-04 | the live address no longer carries it |
| Workflow | `refresh-us-quakes.yml` and `build-us-quakes.yml` parse (`ruby -ryaml`) and their shell steps ran locally (the publish against a bare repository), but neither has run on a GitHub runner, so the sparse checkout, `actions/cache/restore`/`save` and the push are untested there | not run here |
| Live | the M2.5+ part is up to 24 h old (one FDSN query a day); the last 30 days come from the feed each hour, automatic solutions included, which USGS may revise or delete | USGS's gentle-use request; the feed is the live source |
| Live | if the volcano API fails, the previous status is kept with its old read time; with none, every volcano is drawn hollow | the API "carries no guarantee of continuing support" |
| Live | the demo snapshot on `main` is rewritten only by the yearly build, so a freshly installed ZIP shows data up to a year old until its first Shortcut refresh | the ZIP is rebuilt yearly; the app shows the feed's own date |

## Constraints summary (reuse in future prompts)

- Snuggery mini-app: one ZIP, `index.html` at its top; relative paths, no `..`, no symlinks; **no
  network at runtime** and no `http(s)://` in any `.html`, `.css`, `.js`; ES modules and `fetch()` of
  the app's own files; `localStorage` in try/catch; phone screen, light and dark.
- `assets/` is static and ships in the ZIP; **only `data/snapshot.json` changes after install**
  (hourly refresh, orphan branch `data-us-quakes`, Global Weather's branch guard).
- Binary is little-endian and headerless with a sibling JSON giving each section's offset, type and
  count; every section on a 4-byte boundary (upload each column from its own offset); longitudes on
  one 172°…296° axis (the basemap alone runs past it, 168…305 and 25° S–81° N); time in minutes since
  1600-01-01Z, truncated; depth code 1500 only for the catalog's exact 10 (`common.depth_code`).
- Everything is public domain (USGS works; Natural Earth by dedication); credit on screen, in About and
  in `CREDITS.txt`; web addresses printed as text, never links.
- Honesty: a drawn thing is a measured thing or is labelled as a display choice; every explanation
  of a USGS field and every story claim is a verbatim USGS quote kept in `credits/`; every number in
  the text is computed by the build; this is not a warning service and says so first.
- SI by default (km, m), thousands grouped with a narrow no-break space; English for a US audience; no
  AI vendor named anywhere.
- Budgets asserted before writing: `assets/` ≤ 6,000,000 B as the ZIP stores it, `history.bin` ≤
  5.8 MB raw, `geo.json` ≤ 1.9 MB raw, snapshot ≤ 1.5 MB, app code ≤ 200 KB (raised from 150 KB for the
  QA pass, `check.mjs`), the ZIP ≤ 8 MB.
- Deterministic: no clock in any static output; `build_all.sh --twice` proves two builds identical.
