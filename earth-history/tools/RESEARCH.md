# Research: sources, licences and decisions for Earth's History

The brief is `docs/plans/0010-four-showcase-apps.md`, "Idea 1 — Earth's history on a globe". This
file makes every source in it real on disk, pins it, quotes its licence, and writes down what the
plan left open. Every URL, size, hash and quirk below was measured on **2026-09-30** from this
machine, with the command named next to it; nothing here comes from memory. `RESEARCH.md` lives
under `tools/` so it never ships inside the app's ZIP.

| Where | What |
| --- | --- |
| `tools/sources.py` | every download: URL, sha256, bytes, licence, attribution, retrieval date |
| `tools/probe.py` | prints what each source URL returns now; `--fetch` fills `tools/.cache/` through `fetch()` and checks every pin |
| `tools/make_slices.py` → `tools/slices.csv` | the 90 maps with their ages, parsed from Table 1 of Scotese's PDF (run once; the CSV is committed) |
| `tools/credits/` | licence evidence: the atlas's own `License.txt`, both Zenodo record JSONs, the ICS licence and README, Natural Earth's terms, the Foster and van der Meer licence statements |
| `tools/common.py`, `tools/paths.py` | copied from Milky Way and adapted (prefix `EARTHHISTORY_`, `RETRIEVED = '2026-09-30'`, a Range-request `fetch_zip_member()`) |

Verification commands, run from `Template/earth-history/tools/`:

```
.venv/bin/python probe.py            # 12 sources, each "206 range ok size ok"
.venv/bin/python probe.py --fetch    # 12 x "ok": every file in .cache/ matches its sha256 pin
.venv/bin/python make_slices.py      # "maps in the zip: 90 · Table 1 rows 1-93 without a raster in the zip: [20, 89, 91]"
```

The download cache is **862 MB** (`du -sh .cache`), 814 MB of it the two PhanDA zips.

---

## 1. Decisions

### The atlas is usable: CC BY 4.0 in its own `License.txt`
The stop rule was that the atlas must be CC BY 4.0 by its own licence file. It is: the zip's
`License.txt` (dated 2020-10-19 in the zip listing) reads, verbatim:

> This work is licensed under the Creative Commons Attribution 4.0 International License.
> To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/ or
> send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.

and the Zenodo record says `"license": {"id": "cc-by-4.0"}`, `"access_right": "open"`. Both are kept
in `tools/credits/` (`PaleoAtlas_v3_License.txt`, `zenodo-5460860.json`). The PaleoDEM zip carries a
byte-identical `License.txt` (`unzip -p … License.txt | diff - credits/PaleoAtlas_v3_License.txt`
printed nothing).

### Map ages come from Table 1, and both ages are kept
`slices.csv` has one row per map in the zip, with two ages:

- **`age_ma`** — the age in *Table 1. Paleogeographic Maps: Time Intervals in the PALEOMAP PaleoAtlas
  (Ogg et al., 2008)*, pages 37–41 of `PALEOMAP PaleoAtlas for GPlates v3.pdf` (Scotese, 2016), the
  PDF that ships inside the same zip. This is what the app says: "35.6 million years ago".
- **`file_age_ma`** — the three-digit number at the end of each JPEG's name. It is the time GPlates
  assigns when the folder is imported as a "Time Dependent Raster", which is how the PDF's Part III
  tells users to load the atlas, and Part IV pairs those rasters with `PALEOMAP_PlateModel.rot` and
  `PALEOMAP_PlatePolygons.gpml`. The file-name number is a rounded bin, not the age: map 2 is
  `_001` and Table 1 says 21 ky; map 79 is `_460` and Table 1 says 456 Ma (the largest gap, 4.0 Myr;
  the next are maps 87, 80 and 48 at 3.5 Myr).

**Decision:** the app shows `age_ma`; overlays rotated onto a map (plates, coasts, cities, pins) use
**`file_age_ma` as the reconstruction time**, because that is the time at which Scotese's own
workflow puts the rasters and the rotation file together. Step 20's check (today's coastlines
rotated back must land on the painted land at 66, 200 and 300 Ma) should be run at both ages and
keep `file_age_ma` unless the other overlaps measurably better; a gap of at most 4 Myr moves a
plate by tens of kilometres, so either should pass.

*How the ages were extracted.* `make_slices.py` reads the PDF's text layer with pypdf, joins the
one wrapped row (map 14), drops stray quote marks (maps 40, 49) and pins those three rows to their
expected text, takes the number before `Ma`/`ky` in each row's parentheses (map 37 prints `169.7)`
with no unit; Ma by context), joins the 90 JPEG names by map number, and asserts that ages increase
with map number and that Table 1 and file-name ages agree within 5 Myr. *Checked independently* by
rendering pages 37–40 of the PDF as images and reading them: map 10 is "Late Eocene (Priabonian,
35.6 Ma)" and its file is `Map10a Late Eocene_035.jpg`; map 49 is "Permo-Triassic Boundary (251 Ma)"
with file `Map49a Permo-Triassic Boundary_250.jpg`; map 80 is "Middle Ordovician (Darwillian,464.5
Ma)" with file `Map80a LtO Darwillian_461.jpg`; map 2 is "Last Glacial Maximum (Pleistocene, 21 ky)"
with file `…_001.jpg`. All four match the CSV rows.

### 90 maps, not 91 or 93
Table 1 lists maps 1–93 in black (94–103 are greyed out: "Map intervals that are 'grayed out' do not
have paleogeographic maps"), and the PDF's introduction says the atlas "consists of 91
paleogeographic maps". The zip holds **90** JPEGs: Table 1 rows **20** (Late Cretaceous, Santonian &
Coniacian, 86 Ma), **89** (Late Ediacaran, 560 Ma) and **91** (Early Ediacaran, 650 Ma) have no
raster. The slider has 90 stops, one per real map; the gap between 80.3 Ma (map 19) and 91.1 Ma
(map 21) is a normal step, not a hole to paper over.

### Deep time: three maps older than 540 Ma — four by Table 1's age
By file-name age, **only 3 of the 90 maps are older than 540 Ma**: 600 Ma (map 90, Middle Ediacaran),
690 Ma (map 92, Late Cryogenian) and 750 Ma (map 93, Middle Cryogenian). Table 1 puts map 88
(`…Precambrian-Cambrian Boundary_540.jpg`) at 542 Ma, so by Table 1's ages there are four. The
slider's compressed 750–540 stretch therefore holds three or four stops; the design stage should
say which age it breaks at.

### The rotation file reaches 1,100 Ma; the plate model is 257 plates and 471 polygons
Parsed directly from `PALEOMAP_PlateModel.rot` (1,491 rotation lines, none unparsed): **257 moving
plate IDs**, and **every plate's sequence ends at 1,100 Ma** — the oldest age in the file (its
header lines read "PALEOMAP Plate Model m15g60_v2d3 … for use with Plate Polygons
ContOCeanPolyv10u_v2d3 … by CR Scotese 02/01/2016"). For most plates the 1,100 Ma row only holds the
last real pole constant (for 246 of 257 it repeats the previous row), so the rotations are defined,
not measured, beyond the last real pole; 750 Ma, the atlas's oldest map, is inside the range.
`PALEOMAP_PlatePolygons.gpml` has **471 features** over **241 plate IDs** (plate 0, not in the
rotation file, is used by some), 26,433 vertices. pygplates 1.0.0 loads both;
`pygplates.reconstruct` returns 193 / 142 / 86 / 78 / 64 polygons at 66 / 200 / 300 / 540 / 750 Ma.

### Present-day geometry gets its plate IDs from Scotese's polygons, at time 0
Coasts, cities and "where is this rock today" anchors are stored in present-day coordinates and
rotated per plate in the app (the plan's rule). They get plate IDs by partitioning with
`PALEOMAP_PlatePolygons.gpml` at 0 Ma — every polygon is valid at 0 Ma, including the 196 whose
valid time is exactly 0–0 (see §2.1 quirks). The atlas also ships
`PALEOMAP_PoliticalBoundaries.gpml` (437 country features with plate IDs, 129 IDs, 868 polylines and
131 polygons, 29,115 vertices) from the same model; it is a cross-check for step 20, not the coast
layer, because it is political borders rather than coastlines.

### Today's coasts and cities: Natural Earth direct, not a copy of Global Weather's assets
`Template/global-weather/assets/world.json` is Natural Earth 1:50m via world-atlas 2.0.2, simplified
and delta-coded at 0.01°, and `places.json` is ~1,600 GeoNames labels (CC BY 4.0) tiered by hand for
a weather map. For this app the pipeline reads **Natural Earth v5.1.2 GeoJSON at a pinned commit**
instead: the same public-domain source at full 1:50m resolution (which step 20's land-overlap check
and the plate partition want), cities with Natural Earth's own `scalerank`/`labelrank`/population
fields to choose ~300 from 1,251, public domain so no second attribution condition, and no file read
from another app's folder (deleting Global Weather must not break this build). The app's shipped
`coast.bin` / `places.json` are built from these.

### Climate: PhanDA suite `scotese_07`, whole zips, keyed by experiment number
- **Suite `scotese_07`** is the one the plan names: the record's table gives its CO₂ as "Foster et
  al. (2017); Rae et al, 2021" and its configuration as HadCM3L "Update B" (PUMA IDs tfkea … tFkee).
- **Variables:** `scotese_07_tas.zip` (2 m air temperature) and `scotese_07_pr.zip` (precipitation).
  Not `tos` or `so` (sea temperature and salinity are cut for v1).
- **Whole files, not Range requests.** Zenodo honours Range (every probe returned 206, and
  `fetch_zip_member()` pulled `scotese_07_049_301Ma_393pCO2_M5_tas.nc` out of the remote zip by
  three ranged reads, byte-identical to the local copy). But the climate step needs **every** member
  — 109 slices × 5 twenty-year means per variable, 1,090 NetCDFs — so ranges would move the same
  814 MB in over a thousand requests. The two zips were downloaded whole (300,384,517 and
  513,591,309 bytes, about 4½ and 8–9 minutes here, one after the other), and their MD5s match Zenodo's.
- **Key on the experiment number, take ages from `ExperimentInfo.xlsx`.** File names carry a
  rounded age and CO₂ (`scotese_07_109_0Ma_276pCO2_M5_tas.nc`), and two disagree with the
  spreadsheet: experiment 27 is `409Ma` in its name and 410 Ma in the sheet, experiment 108 is `3Ma`
  and 4.0 Ma. The sheet's **Plate Age** column is exactly 0, 5, … 540 Ma (109 values, no repeats);
  its **Experiment Age** column is the stage age (e.g. 541 for plate age 540).
- **Map → climate slice**: match `file_age_ma` to Plate Age. 82 of the 90 maps have an exact match;
  maps at 1, 4, 6, 66 and 461 Ma take the nearest plate age (0, 5, 5, 65, 460); maps 90, 92 and 93
  (600, 690, 750 Ma) have **no climate** — PhanDA starts at 541 Ma — and the Temperature and Rain
  lenses must say so rather than show a neighbour.

### CO₂ curve: Foster's LOESS where it exists, the model's input before
Foster et al. (2017) Supplementary Data 2 covers 0.0039–419.5039 Ma every 0.5 Myr (840 rows). Before
420 Ma the only open CO₂ series is the per-slice value PhanDA ran `scotese_07` with (3,374 ppm at
541 Ma down to 276.01 at 0 Ma; minimum 232.91), which the record attributes to Foster (2017) and Rae
(2021); the curves strip labels that stretch as the climate model's input, not a proxy fit. The
lower 95 % band is negative in **124 rows, from 247.0 to 419.5 Ma** (not only near 420 Ma as the plan
says); the 68 % band and the central curve are never negative. Clip at zero and say so.

### Sea level: the TGE curve, from the article's own supplement
van der Meer et al. (2022) supplementary table `mmc1.xlsx`, column group "Fig10",
`TGE_SL_isocorr_m` AVG / MIN / MAX: tectono-glacio-eustatic sea level in metres relative to today,
0–540 Ma at 1 Myr (0 m at 0 Ma; 192.8 m at 66 Ma, 206.5 m at 94 Ma, 16.2 m at 300 Ma; range −2.2 to
216.8 m over 1–540 Ma). No manual drop was needed: Elsevier's file host served it to a script,
twice, with the same sha256.

### The Sun's brightness: Gough (1981), equation (1)
The tile uses Gough's formula, not a table: L(t) = [1 + ⅖(1 − t/t☉)]⁻¹ L☉ for t ≤ t☉ (Solar Physics
74, p. 28), with t☉ "about 4.7 × 10⁹ yr" (p. 23), t = t☉ − age. At 750 Ma that is 1/(1 + 0.4 ×
0.75/4.7) = 94.0 % of today. Read from the NASA ADS scan; the paper is publisher-copyright, so only
the formula is used, cited, and nothing is copied.

### Timescale: ICS chart data at a pinned commit, and Scotese's labels kept as his
`chart.ttl` from `i-c-stratigraphy/chart` at commit **`81618a865cdb04998355a302f3e859908a080c0e`**
(main, 2026-07-27, "produce VocPub version of vocab"; the last commit touching `chart.ttl`). It
parses with rdflib 7.6.0 into 12,831 triples with ranks Super-Eon 1, Eon 4, Era 10, Period 22,
Sub-Period 2, Epoch 38, Age 102, each with `time:hasBeginning/hasEnd` in `gtsd:inMYA` and
`schema:color` (e.g. Permian 298.9–251.902 Ma, `#F04028`). Scotese's Table 1 uses the Ogg et al.
(2008) timescale, so **some maps fall in a different ICS unit than their own label**: map 16 "KT
Boundary (latest Maastrichtian, 65.5 Ma)" is inside the Paleogene by ICS (which begins at 66.00 Ma);
map 88 "Cambrian/Precambrian boundary (542 Ma)" is Ediacaran by ICS (Cambrian begins 538.8); map 93
"Middle Cryogenian (750 Ma)" is Tonian by ICS (Cryogenian begins 720). Step 50 must compute the full
list. **Decision:** the age line and period colour come from ICS for `age_ma`; the "This map" card
quotes Scotese's own label and number unchanged, so the two never silently disagree.

### Python
`tools/.venv` from `/opt/homebrew/bin/python3.12` (3.12.14), `pip install -r requirements.txt`:
numpy 2.5.3, scipy 1.18.1, pillow 12.3.0, h5py 3.16.0 (HDF5 2.0.0), pygplates 1.0.0 (cp312 macOS
arm64 wheel from PyPI; brings nothing but numpy), pyyaml 6.0.3, rdflib 7.6.0 (+ pyparsing 3.3.3),
pypdf 6.19.0. No netCDF4 package: every NetCDF here (PhanDA and the PaleoDEMs) is NetCDF4/HDF5 and
reads with h5py; no xlsx package: the three spreadsheets are read with `zipfile` + ElementTree.

---

## 2. Sources

### 2.1 PALEOMAP PaleoAtlas v3 — Scotese (Zenodo record 5460860)
- **URL:** `https://zenodo.org/api/records/5460860/files/Scotese_PaleoAtlas_v3.zip/content` —
  HTTP 206 to a Range probe, 58,089,990 bytes, sha256
  `7bf15709970645465df17542e20f9e2e9ed01d20797f38513ed83621e4ace2a0` (MD5 matches Zenodo's
  `9a8d16ab2d7f070ae3e89da7835ce4d4`). Record JSON: `https://zenodo.org/api/records/5460860` → HTTP
  200, saved as `credits/zenodo-5460860.json`. The record is titled "PALEOMAP Paleodigital Elevation
  Models (PaleoDEMS) for the Phanerozoic" (Scotese, Christopher R; Wright, Nicky M; 2018-08-01;
  DOI 10.5281/zenodo.5460860) and holds six files; the atlas zip is one of them.
- **Contents** (`unzip -l`, 206 entries, 75,450,172 bytes unpacked):
  - `Scotese PaleoAtlas_v3/PALEOMAP PaleoAtlas Rasters v3/` — **90 JPEGs**, `Map<N>a <title>_<age>.jpg`,
    every one **3600 × 1800 px RGB, 72 dpi**, equirectangular ("rectilinear … Cartesian latitude and
    longitude", PDF p. 4); 55,797,251 bytes in all, 369,721 (map 84) to 1,398,262 (map 1) each.
  - `Scotese PaleoAtlas_v3/PALEOMAP Global Plate Model/PALEOMAP_PlateModel.rot` (79,521 bytes),
    `PALEOMAP_PlatePolygons.gpml` (5,287,072), `PALEOMAP_PoliticalBoundaries.gpml` (3,488,915).
  - `PALEOMAP PaleoAtlas for GPlates v3.pdf` (5,289,678 bytes, 56 pages, "February 16, 2016") —
    Table 1 on pp. 37–41.
  - `PaleoDataPlotter_Program/` — a 2015 macOS app and sample CSVs; not used.
  - `License.txt` (253 bytes) — quoted in §1.
- **Quirks:** file names mis-spell and mis-label some stages relative to Table 1 (map 27's file says
  "EK Early Albian_120", Table 1 says early Aptian, 121.8 Ma; map 81's file says "Floian-Dapingian",
  Table 1 "Arenig"; "MIddle", "Lochlovian", "Darwillian", "Lalndovery" as printed) — the app takes
  names from ICS and quotes Table 1, never the file name. Maps 6, 7, 9 and 73 have a double space in their names.
  In the polygons file, 196 of 471 features have `gml:validTime` begin = end = 0 in the XML itself
  (434 `timePosition` values of 0), so a naive `pygplates.reconstruct` drops them at any past age;
  17 begin in the "distantPast", 46 at 4,500 Ma. The PDF's text layer separates words with tab +
  no-break space and has broken xref entries (pypdf warns "Ignoring wrong pointing object"; text
  still extracts).
- **Licence:** CC BY 4.0 (zip `License.txt`; Zenodo `license.id = cc-by-4.0`).
- **Attribution** (the PDF p. 2 asks: "Please cite this work as: Scotese, C.R., 2016. PALEOMAP
  PaleoAtlas for GPlates and the PaleoData Plotter Program, PALEOMAP Project"): *Maps and plate
  model: C.R. Scotese, PALEOMAP PaleoAtlas for GPlates v3 (2016), via Scotese & Wright 2018, Zenodo,
  doi:10.5281/zenodo.5460860, CC BY 4.0. Resized and re-encoded.*
- **Retrieved:** 2026-09-30.

### 2.2 PaleoDEMs 1° — Scotese & Wright 2018 (same record)
- **URL:** `…/5460860/files/Scotese_Wright_2018_Maps_1-88_1degX1deg_PaleoDEMS_nc.zip/content` —
  206, 9,302,291 bytes, sha256 `7014767a168c28d3762f55117ebafcd0f6b6b90029a495e2d14fd23f94abc16d`
  (MD5 matches). Also pinned: the report `Scotese_Wright2018_PALEOMAP_PaleoDEMs.pdf` (6,840,972
  bytes, sha256 `8a5fca14…edac`), read for provenance only.
- **Contents:** **109 NetCDF files** (NetCDF4/HDF5), one per 5 Myr from 0 to 540 Ma
  (`Map01_PALEOMAP_1deg_Holocene_0Ma.nc` … `Map88_PALEOMAP_1deg_Cambrian_Precambrian boundary_540Ma.nc`,
  with half-numbers such as `Map86.5_…_525Ma.nc` for the in-between steps), each a `z(lat 181, lon 361)`
  float32 grid in metres, lon −180…180, lat −90…90, range −9,000 to 6,000 m. GPlates cache files for
  every grid, an `All_Maps.gpml`, and `PaleoAtlasTimeIntervalsv22b copy.csv` (Appendix I: map ID,
  "Stratigraphic Age Description", **Plate Model Age**, Map#; old-Mac `\r` line endings). The record
  describes "117 PALEOMAP paleoDEMS"; the 1° zip holds 109 grids — the plan's "117" is the report's
  count, not this file's.
- **Quirk worth knowing:** the 2018 list is a later revision of the 2016 atlas list and re-labels
  some maps (map 93 is "early Cryogenian, 700 Ma" with plate age 700 there, "Middle Cryogenian, 750
  Ma" in the atlas); its Plate Model Age differs from the atlas's file-name age for 10 maps (2, 3, 4,
  16, 60, 61, 79, 80, 85, 93). It is therefore not used for the atlas maps' ages; only the grids are
  used, for land and shallow-sea area.
- **Licence:** CC BY 4.0 (identical `License.txt`; record licence). **Attribution:** *Scotese, C.R. &
  Wright, N.M., 2018. PALEOMAP Paleodigital Elevation Models (PaleoDEMS) for the Phanerozoic.
  Zenodo, doi:10.5281/zenodo.5460860. CC BY 4.0.*
- **Retrieved:** 2026-09-30.

### 2.3 PhanDA HadCM3L model priors (Zenodo record 8237751)
- **Record:** `https://zenodo.org/api/records/8237751` → 200, saved as `credits/zenodo-8237751.json`.
  "PhanDA HadCM3L Model Priors", Judd, Tierney, Lunt, Montañez, Huber, Wing, Valdes; 2023-08-11;
  version 1; DOI 10.5281/zenodo.8237751; `license.id = cc-by-4.0`, open. 33 files, 11,418,481,731
  bytes in all: `ExperimentInfo.xlsx` and 32 zips (8 suites × `tas`, `tos`, `so`, `pr`), each zip
  287–516 MB holding 545 NetCDFs.
- **Pinned:** `ExperimentInfo.xlsx` (25,443 bytes, sha256 `21866d6c…0f51`), `scotese_07_tas.zip`
  (300,384,517, `f28c137c…3983`), `scotese_07_pr.zip` (513,591,309, `63fe79de…980f`); Zenodo MD5s match
  (`0c61461d…`, `575721a5…`, `7094ba86…`). All three return 206 to a Range probe.
- **Format** (`h5py` on `scotese_07_109_0Ma_276pCO2_M5_tas.nc`; first bytes `\x89HDF\r\n\x1a\n`):
  NetCDF4, CF-1.6, each file a 12-month climatology ("cdo -ymonmean" over 20 model years, per its
  `history`). Two copies of each field:
  - the UM original, `temp_mm_1_5m (t 12, ht 1, latitude 73, longitude 96)` float32 in **K**
    (`standard_name air_temperature`), `precip_mm_srf` float32 with `standard_name precipitation_flux`,
    long name "TOTAL PRECIPITATION RATE KG/M2/S" but **`units` attribute "kg m-2"** (it is a rate:
    the 0 Ma area-weighted mean × 86,400 is 2.97 mm/day); latitude 90 → −90 by 2.5°, longitude 0 →
    356.25 by 3.75°; fill 2e20;
  - PhanDA's added copy, `tas` / `pr (12, 1, 96, 73)` float64 on `lon` −180…176.25 × `lat` 90…−90,
    which equals the original transposed and rolled by 48 columns (checked: `np.roll(tas.T, 48)`
    matches `temp_mm_1_5m` to 0.0), plus `pr_anomaly` and `prln_anomaly (96, 73)`.
  Use the UM originals with their CF coordinates. Sanity check: 0 Ma annual area-weighted mean
  2 m temperature is 14.79 °C.
- **Quirks:** members sit at the zip's top level, deflated. File names round the age (see §1).
  `ExperimentInfo.xlsx` columns: Experiment Number, Experiment Age, Plate Age, then PUMA ID and CO₂
  per suite (scotese_07 is columns P–Q).
- **Licence:** CC BY 4.0 (record). The record's description credits the simulations to "the Bristol
  Research Initiative for the Dynamic Global Environment (BRIDGE) group using the computational
  facilities of the Advanced Computing Research Centre at the University of Bristol".
- **Attribution:** *Judd, E.J., Tierney, J.E., Lunt, D.J., Montañez, I.P., Huber, B.T., Wing, S.L. &
  Valdes, P.J., 2023. PhanDA HadCM3L Model Priors, suite scotese_07. Zenodo,
  doi:10.5281/zenodo.8237751, CC BY 4.0. Simulations by the BRIDGE group, University of Bristol.
  Annual means computed from the monthly fields.* The suite's model description paper is Valdes et
  al. 2021, Climate of the Past 17, 1483 (doi:10.5194/cp-17-1483-2021), cited by the record.
- **Retrieved:** 2026-09-30.

### 2.4 Foster, Royer & Lunt 2017 — CO₂, Supplementary Data 2
- **URL:** `https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fncomms14845/MediaObjects/41467_2017_BFncomms14845_MOESM2875_ESM.xlsx`
  — 206, 79,529 bytes, sha256 `84df255974cb77c95d298d324fb281fe2ac40a0696ea92598985816e7095c74c`.
  Found on the article page `https://www.nature.com/articles/ncomms14845` (200 to a script), whose
  supplementary list reads "Supplementary Data 2 … LOESS fit to the CO2 data set in Sup. Data 1.
  (XLSX 77 kb)". `MOESM2874` is Supplementary Data 1 (the proxy compilation), not used.
- **Europe PMC route (the plan's):** `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5382278/supplementaryFiles`
  → 200, `application/zip`, 1,297,267 bytes, 19 members; `ncomms14845-s3.xlsx` inside it is
  byte-identical to `MOESM2875`. The zip itself cannot be pinned: two downloads a minute apart had
  different sha256s (`ac98a845…` and `3be14ac4…`) and every member is stamped with the download date.
- **Contents:** one sheet, "LOESS Fit"; A1 "Supplementary Data 2. LOESS fit to the CO2 data set in
  Sup. Data 1."; columns Age (Ma), pCO2 probability maximum, lw95%, lw68%, up68%, up95% (ppm); 840
  rows, 0.0039 to 419.5039 Ma every 0.5 Myr; maximum central value 2,165 ppm.
- **Licence**, quoted from the article page's "Rights and permissions" (full text in
  `credits/foster2017-licence.txt`): "This work is licensed under a Creative Commons Attribution 4.0
  International License. … To view a copy of this license, visit
  http://creativecommons.org/licenses/by/4.0/"; page metadata `dc.rights` "2017 The Author(s)".
- **Attribution:** *Foster, G.L., Royer, D.L. & Lunt, D.J., 2017. Future climate forcing potentially
  without precedent in the last 420 million years. Nature Communications 8, 14845,
  doi:10.1038/ncomms14845. Supplementary Data 2, CC BY 4.0. Resampled; lower band clipped at zero.*
- **Retrieved:** 2026-09-30.

### 2.5 van der Meer et al. 2022 — Phanerozoic sea level
- **URL:** `https://ars.els-cdn.com/content/image/1-s2.0-S1342937X22002192-mmc1.xlsx` — 206, 263,101 bytes (served without a browser User-Agent: `mmc2.xlsx` returned 200 to
  plain curl), sha256
  `800b34928378ae902426fc16ef002debfc064465f8ac663cbeeb7bd0c77c074f`. Found by probing
  `mmc1`–`mmc4` × seven extensions; only `mmc1.xlsx` and `mmc2.xlsx` exist. `mmc2.xlsx` (10,773 bytes,
  "SuppTable2", "TGE Eustatic Events": regressive–transgressive couplets with lowstand/highstand
  ages and stages) is not pinned; the story step may want it.
- **Contents:** sheet "SuppTable"; row 2 names the figure each column group belongs to (Fig2a …
  Fig10), row 3 the quantity, row 4 AVG/MIN/MAX; column A is age in Ma, 0–540 at 1 Myr. Columns
  AI–AK, `TGE_SL_isocorr_m`, are the tectono-glacio-eustatic curve (Fig. 10). The sheet also carries
  `GAT_degC` ("AVG (Scotese et al. 2021)") — Scotese 2021 temperatures, which the plan avoids;
  **do not use that column**. Rows 546–1005 carry only columns AF–AH (`Glacio_SL_isocorr_m`) and no age in column A.
- **Licence**, quoted from the White Rose record `https://eprints.whiterose.ac.uk/id/eprint/189833/`
  (200; full text in `credits/vandermeer2022-licence.txt`): "© 2022 The Authors. Published by
  Elsevier B.V. on behalf of International Association for Gondwana Research. This is an open access
  article under the CC BY license (http://creativecommons.org/licenses/by/4.0/)." The record lists
  the deposited published version with "Licence: CC-BY 4.0", and Crossref lists the version of record
  under `http://creativecommons.org/licenses/by/4.0/` from 2022-08-07. No licence is printed on the
  supplement itself; it is published with the article.
- **Attribution:** *van der Meer, D.G., Scotese, C.R., Mills, B.J.W., Sluijs, A., van den Berg van
  Saparoea, A.-P. & van de Weg, R.M.B., 2022. Long-term Phanerozoic global mean sea level: Insights
  from strontium isotope variations and estimates of continental glaciation. Gondwana Research 111,
  103–121, doi:10.1016/j.gr.2022.07.014. Supplementary table, CC BY 4.0.*
- **Retrieved:** 2026-09-30.

### 2.6 ICS International Chronostratigraphic Chart — `chart.ttl`
- **URL:** `https://raw.githubusercontent.com/i-c-stratigraphy/chart/81618a865cdb04998355a302f3e859908a080c0e/chart.ttl`
  — 206, 642,198 bytes, sha256 `8548707d66c383460b3bddc20afb7070cb5f3ea187ea1262418dc3a6f2d6e9f7`.
  Commit from `api.github.com/repos/i-c-stratigraphy/chart/commits?path=chart.ttl` (latest, 2026-07-27).
- **Contents / quirks:** RDF Turtle, a SKOS vocabulary. Units carry `gts:rank`, `skos:broader` /
  `skos:narrower`, `time:hasBeginning` / `time:hasEnd` as blank nodes with `gtsd:inMYA` and
  `schema:marginOfError`, `schema:color` as `"#RRGGBB"^^gtsd:RGBHex`, `skos:prefLabel` in ~25
  languages (filter `@en`), `sh:order`. The file's own citation line (`dcterms:bibliographicCitation`,
  `@en`): "Cite: Cohen K, Harper D, Gibbard P, Car N. The ICS international chronostratigraphic chart
  this decade. Episodes 2025;48:105-115. https://doi.org/10.18814/epiiugs/2025/025001. Modified
  2024-12." The chart's PDF is not used (the plan: "© ICS", not copied).
- **Licence**, quoted from the repository's `README.adoc` (saved in `credits/`): "This data is
  copyrighted as follows: © International Commission on Stratigraphy, 2026 / This data is licensed
  for use with the Creative Commons Attribution 4.0 license: https://creativecommons.org/licenses/by/4.0/
  / A local copy of the license deed is stored in the file LICENSE in this repository." The repository
  `LICENSE` (18,616 bytes, CC BY 4.0 legal code) is saved as `credits/ics-chart-LICENSE.txt`; GitHub's
  API reports `cc-by-4.0`.
- **Attribution:** *International Chronostratigraphic Chart data, © International Commission on
  Stratigraphy, 2026, CC BY 4.0 (github.com/i-c-stratigraphy/chart, commit 81618a865cdb). Cohen, K.,
  Harper, D., Gibbard, P. & Car, N., 2025, Episodes 48, 105–115.*
- **Retrieved:** 2026-09-30.

### 2.7 Natural Earth 1:50m — coastlines, land, populated places
- **URLs** (repository `nvkelso/natural-earth-vector`, tag **v5.1.2** = commit
  `f1890d9f152c896d250a77557a5751a93d494776`, `VERSION` file reads `5.1.2`):
  `geojson/ne_50m_land.geojson` (206, 1,636,166 bytes, sha256 `e874b27a…826b`, 1,420 features),
  `geojson/ne_50m_coastline.geojson` (206, 1,640,858, `271f1c4c…a283`, 1,428 features),
  `geojson/ne_50m_populated_places_simple.geojson` (206, 850,767, `8e70756b…d978`, 1,251 features
  with `scalerank`, `labelrank`, `name`, `adm0cap`, `worldcity`, population fields). The official
  host `naciscdn.org/naturalearth/50m/…` also answers 200 (shapefile zips); GeoJSON was chosen so no
  shapefile reader is needed.
- **Licence**, quoted from the repository's `LICENSE.md` (saved as `credits/natural-earth-LICENSE.md`):
  "All versions of Natural Earth raster + vector map data found on this website are in the public
  domain. You may use the maps in any manner, including modifying the content and design, electronic
  dissemination, and offset printing. … No permission is needed to use Natural Earth. Crediting the
  authors is unnecessary. However, if you wish to cite the map data, simply use one of the following.
  Short text: Made with Natural Earth."
- **Attribution** (courtesy, as Global Weather gives it): *Made with Natural Earth.*
- **Retrieved:** 2026-09-30.

### 2.8 Gough 1981 — the Sun's brightness (cited, not downloaded by the pipeline)
Gough, D.O., 1981. Solar interior structure and luminosity variations. Solar Physics 74, 21–34,
doi:10.1007/BF00151270 (Crossref). Closed access (OpenAlex `oa_status: closed`); the scan at
`https://articles.adsabs.harvard.edu/pdf/1981SoPh...74...21G` answered 200 (161,494 bytes, image-only
PDF) and was read page by page: abstract ("the solar luminosity has risen steadily from about 70% of
its current value during the last 4.7×10⁹ yr"), p. 23 (t☉ "of about 4.7×10⁹ yr"), p. 28 (equation 1).
Copyright © 1981 D. Reidel. The pipeline embeds the formula; `sources.CITED` records it.

### 2.9 pygplates 1.0.0 — build time only
PyPI wheel `pygplates-1.0.0-cp312-cp312-macosx_11_0_arm64.whl` (60.0 MB download); its METADATA
licence is the GNU GPL version 2; `Requires-Dist: numpy` only. Runs inside `tools/`; nothing of it is
shipped or linked by the app, so the GPL does not reach the template's MIT code or the ZIP.

### 2.10 Listed in the plan, not fetched (no v1 step needs them)
Kocsis & Scotese 2021 PaleoCoastlines (alternative A) and Merdith 2021 / Müller 2022 (the v2 Plates
lens) — alternatives only; not probed today. Global Weather's `assets/world.json` and
`assets/places.json` — read and their `LICENSES.md` noted (Natural Earth public domain; GeoNames CC
BY 4.0, attribution a condition), superseded here by §2.7.

---

## 3. What did not work
- **Europe PMC's supplementary-files zip is not pinnable:** rebuilt per request (two sha256s for two
  downloads). The pin is on the publisher's `MOESM2875_ESM.xlsx`, byte-identical to its `s3` member.
  Per-file URLs `europepmc.org/articles/PMC5382278/bin/ncomms14845-s2.xlsx` (403),
  `www.ncbi.nlm.nih.gov/pmc/articles/PMC5382278/bin/…` (404) and
  `pmc.ncbi.nlm.nih.gov/articles/instance/5382278/bin/…` (200 but an HTML page) did not serve the file.
- **ScienceDirect refuses a script:** `https://www.sciencedirect.com/science/article/pii/S1342937X22002192`
  → 403 (an 833 KB challenge page with no article). Not needed: the supplement is on `ars.els-cdn.com`
  and the licence is quoted from White Rose.
- **White Rose's PDF crawls:** `…/eprint/189833/7/1-s2.0-S1342937X22002192-main.pdf` (5,033,661 bytes)
  delivered 245,760 bytes in 240 s before `curl --max-time 240` stopped it; a first attempt stalled
  at 442,368 bytes. The published PDF was therefore not read; the record page (200) carries the
  licence statement. Manual fallback if the lead wants the PDF itself: open that URL in a browser and
  drop it into `tools/.cache/`.
- **NASA ADS abstract pages refuse a script** (`ui.adsabs.harvard.edu/abs/1981SoPh...74...21G/abstract`
  → 405); the `articles.adsabs.harvard.edu/pdf/…` scan works.
- **pygplates 1.0's `Feature` has no `get_total_reconstruction_sequence()`** (AttributeError); the
  rotation file was parsed as text instead (its format is plain columns: plate, age, lat, lon, angle,
  fixed plate, `!!` comment).
- **pypdf** reads the atlas PDF with "Ignoring wrong pointing object 8 0 (offset 0)" warnings (also 55,
  77); the text is intact.

## 4. Known gaps
- **Map ages are Scotese's 2016 choices on the Ogg et al. 2008 timescale**; ICS 2026 boundaries move
  some maps across a unit boundary (maps 16, 88, 93 found by hand; step 50 lists them all).
- **Which rotation time matches the painted maps** is decided by step 20's overlap test, not by any
  document (§1). The 2018 PaleoDEM list disagrees with the atlas's file-name ages for 10 maps.
- **Deep time is sparse:** 3 maps older than 540 Ma by file-name age (600, 690, 750), 4 by Table 1
  (map 88 at 542). Maps 20 (86 Ma), 89 (560 Ma) and 91 (650 Ma) are listed in Table 1 but not in the
  zip.
- **No climate before 541 Ma** (PhanDA's range): maps 90, 92, 93 have no Temperature or Rain lens.
- **CO₂ before 420 Ma** is the PhanDA suite's model input, not Foster's fit; Foster's lower 95 % band
  is negative from 247 to 419.5 Ma and must be clipped.
- **Rotations beyond the last real pole** are held constant to 1,100 Ma for most plates; paleomagnetism
  does not fix Paleozoic longitudes (the About text says so).
- **The PhanDA precipitation `units` attribute is wrong** ("kg m-2" for a rate in kg m⁻² s⁻¹); the
  pipeline converts ×86,400 to mm/day and says why in `CONTRACT.md`.
- **The van der Meer supplement has no licence line of its own**; it is treated as covered by the
  article's CC BY statement. Flag for the lead.
- **The Scotese CC BY grant is Scotese's own upload** (Zenodo, 2018; `License.txt` 2020). The plan's
  courtesy email to Scotese stays on the owner's list.
- **pygplates' plate-ID partition of Natural Earth coasts** has not been run yet (pipeline step 20).
