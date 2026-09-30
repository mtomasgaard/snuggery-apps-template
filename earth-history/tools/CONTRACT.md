# Data contract — what `tools/` writes into `data/`, and what the app reads

The agreement between the pipeline steps and the app. Every shipped file is described here: its
layout, units, frame and the order to decode it in. A step that changes a format changes this file
in the same commit. `../DESIGN.md` says what the app does with each file; `RESEARCH.md` says where
every source comes from and quotes its licence. Numbers marked *measured* come from the design stage's
measurements (`DESIGN.md` §15); the pipeline re-measures them and its verify scripts print them.

## 0. Ground rules

- **Only real data.** Every number comes from a pinned source file downloaded by the pipeline, or
  from a cited formula (Gough 1981, computed in the app). Nothing from memory. What cannot be shown
  from real data is left out and the About text says so.
- **Pinned and reproducible.** Every download goes through `common.fetch()` with the sha256 in
  `sources.py`. Every output goes through `common.write_json()` / `common.write_bin()`. No `today()`,
  no clock, no environment in any output; the only date anywhere is `common.RETRIEVED`
  (`'2026-09-30'`). Randomness only from `numpy.random.default_rng(20260930)`. Every list is sorted by
  something stable and stated below. **Two builds from the same cache give byte-identical `data/` and
  `../CREDITS.txt`** (`build_all.sh` twice, then `shasum -a 256` over both trees).
- **Binary files are little-endian and headerless**, and each `.bin` has a sibling `.json` that says
  where every section starts (`offset` in bytes), its element type and count. Every section starts at
  a multiple of 4 bytes (zero bytes pad the gap), so the app takes `TypedArray` views on the one
  `ArrayBuffer` without copying. Types: `uint8`, `int16`, `uint16`, `uint32`, `float32`.
- **No URL in the app's own code.** `index.html`, `style.css` and `js/*.js` contain no `http://` or
  `https://`, not even in a comment. URLs live in `../CREDITS.txt`, `about.json` and `story.json`
  (as text the app prints, never links), `../NOTES.md` and `tools/`.
- **The one-plate-model rule.** Every rotation the app applies comes from `PALEOMAP_PlateModel.rot`
  in the pinned atlas zip (PALEOMAP Plate Model m15g60_v2d3, Scotese 2016), with anchor plate 0, and
  every plate id comes from partitioning with `PALEOMAP_PlatePolygons.gpml` from the same zip.
  **Geometry from any other plate model is never written to `data/`, and never drawn on any lens.**
  `plates.json` records both files' sha256; `verify_plates.py` asserts that every plate id in
  `coast.bin`, `places.json` and `story.json` is in `plates.json.plates`.
- **Coordinates.** Degrees, longitude east-positive in [−180, 180], latitude north-positive, on a
  sphere. The app's unit vector for (λ, φ) is `(cos φ cos λ, cos φ sin λ, sin φ)` (x → 0° N 0° E,
  y → 0° N 90° E, z → north pole).
- **Ages** are in Ma (millions of years before present), positive into the past. Each map has
  `age_ma` (Table 1 of Scotese's PDF — what the app shows), `file_age_ma` (the number in the raster's
  file name) and `rotation_ma` (what overlays are rotated to; `= file_age_ma` unless step 20's test
  says otherwise, §14). Climate and elevation slices are matched on `file_age_ma` (§1).
- **Plate index** means the position in `plates.json.plates`; plate id means Scotese's number.
- **Text** is UTF-8 in NFC, English (US spelling) for anything shown; no AI vendor or product names.
- **Credits fragments.** Every step writes `tools/credits/fragments/<step>.json` (not shipped): a list
  of `{id, title, owner, source, url, licence, licence_uri, licence_quote, retrieved, adaptations,
  accuracy, cite}` blocks, one per source it uses (`source` and `url` may be lists, merged item by
  item, §18). `90_about.py` builds `about.json` and `../CREDITS.txt` from them. (`tools/credits/` itself holds the research's licence evidence and is not
  read as fragments.)
- **`data/` holds only claimed files**: the fixed names below, plus the 90 `surface/mNN.webp` the
  manifest names. `verify_data.py` fails on a stray file or a missing one.
- **JSON rounding** (`write_json(ndigits=…)`): 6 for `plates.json`, `coast.json`; 4 for everything
  else, except `curves.json` (3). Keys sorted (so `write_json`'s key order is the only order); arrays
  keep the order stated here. `pretty=False`.
- Every step has a `verify_<step>.py` that asserts what the app relies on and **prints measured
  numbers**; `verify_data.py` runs them all and adds the cross-file checks (§14).

---

## 1. `manifest.json` — the 90 maps   (step `80_manifest.py`)

Assembled from `slices.csv` and the work files of steps 10, 30, 35, 40 and 50. Step 10 writes a first
`manifest.json` with the fields it owns (`schema`, `count`, `retrieved`, `surface`, `proxy`, `axis`, and
per slice `i`, `map`, `file`, `age_ma`, `file_age_ma`, `rotation_ma`, `label`, `interval`, `stage`) and
the same content to `tools/work/surface.json`; `80_manifest.py` rewrites it with the rest. `slices` is in
**ascending age**: index 0 is map 1 (today), index 89 is map 93 (750 Ma).

```
{ "schema": 1, "count": 90, "retrieved": "2026-09-30",
  "surface": { "dir": "surface/", "width": 1024, "height": 512, "format": "webp", "quality": 65,
               "projection": "equirectangular", "west_lon": -180, "north_lat": 90 },
  "proxy":   { "file": "surface/proxy.webp", "cols": 10, "rows": 9, "cell_width": 256,
               "cell_height": 128, "quality": 70 },
  "axis":    { "break_ma": 550, "compressed_fraction": 0.15,
               "knots": [[750, 0], [690, 0.05], [600, 0.1], [550, 0.15]] },
  "units":   { "today_temperature_c": <climate.json slice 0 global_mean_c, 2 decimals>,
               "today_land_pct": <elevation.json slice 0 land_pct, 2 decimals>,
               "today_shelf_pct": <elevation.json slice 0 shelf_pct, 2 decimals>,
               "today_co2_fit_ppm": <Foster's first row, 1 decimal>,          // as built, §18
               "today_co2_model_ppm": <climate.json slice 0 co2_ppm> },
  "tile_rules": { … },        // as built, §18: per tile its source, the age it is at, its 'today'
  "slices": [ {
      "i": 0,                         // index = position in this array = sprite index
      "map": 1,                       // Scotese's map number (Table 1)
      "file": "surface/m01.webp",
      "age_ma": 0,                    // Table 1
      "file_age_ma": 0,               // file-name number
      "rotation_ma": 0,               // overlays are rotated to this; plates.json.times[i][0]
      "label": "Present-day (Holocene, 0 Ma)",   // Table 1 row text, verbatim from slices.csv
      "interval": "Present-day", "stage": "Holocene",
      "ics": { "eon": "Phanerozoic", "era": "Cenozoic", "period": "Quaternary", "subperiod": null,
               "epoch": "Holocene", "age": "Meghalayan", "colour": "#F9F97F" },  // timescale.json ids; colour of the period
      "ics_note": null | { "kind": "boundary" | "period", "unit": "Paleogene", "text": "…",
                           "scotese_ma": 65.5, "ics_ma": 66.0, "ics_unc_ma": null },   // ics_ma null for "period"
      "climate": 0 | null,            // slice index in climate.json/.bin
      "climate_age_ma": 0 | null,     // that slice's plate age
      "elevation": 0 | null,          // slice index in elevation.json/.bin
      "elevation_age_ma": 0 | null,
      "tiles": { … }                  // below
  }, … ] }
```

- `ics` holds the ids (IRI local names, §9) of the units that contain `age_ma` under the rule "end <
  a ≤ begin, or a = 0 and end = 0"; a rank ICS does not define at that age is `null`.
  `subperiod` is set only inside the Carboniferous.
- `ics_note` (step 50): `"boundary"` for maps whose `interval` contains "Boundary"/"boundary", "KT"
  or a hyphenated pair ("Permo-Triassic", "Devono-Carboniferous", "Cambro-Ordovician"): the ICS
  boundary is the `begin_ma` of the younger named unit (period, or epoch for "Paleocene/Eocene"), and
  the note is written when |`age_ma` − boundary| ≥ 0.05:
  `"Scotese dates this boundary {age_ma} Ma, on the 2008 timescale his atlas uses; today's chart puts
  it at {ics_ma}{ ± ics_unc_ma} Ma."`, with `ics_ma` and `ics_unc_ma` written as the chart's own
  numerals ("66.00", "143.1 ± 0.6"). *Measured* (step 50): boundary notes on maps 14, 16, 32, 43,
  49, 65, 83, 88; period notes on 61 (Pennsylvanian), 73 (Devonian) and 93 (Tonian). `"period"` for other maps when the ICS period (or sub-period)
  of `age_ma` is not among those named in `interval`/`stage` by the keyword table in
  `50_timescale.py` (Holocene/Pleistocene/Glacial → Quaternary; Pliocene/Miocene → Neogene;
  Oligocene/Eocene/Paleocene/PETM → Paleogene; the period names and their adjectives; Pennsylvanian
  and Mississippian → Carboniferous; Neoproterozoic names no period and falls back to `stage`):
  `"By today's chart, {age phrase} is in the {Period}."`. Everything else: `null`.
- **Matching climate and elevation**: the slice whose plate age is nearest `file_age_ma`, when that
  distance is ≤ 2.5 Myr; otherwise `null` (maps 90, 92, 93). *Measured*: 82 exact, and 1 → 0, 4 → 5,
  6 → 5, 66 → 65, 461 → 460.

`tiles` (step 40 computes into `tools/work/tiles.json` at full precision, step 80 copies, rounds and
drops the fields that repeat something the slice or `units` already says — **as built, §18**):

```
"tiles": {
  "temperature": { "c": 21.84 } | null,                          // 2 decimals; at climate_age_ma
  "co2": { "ppm": 825.5, "lo68": 419.4 | null, "hi68": 1329.1 | null,
           "kind": "proxy_fit" | "model_input" } | null,         // 1 decimal; bands null for model_input
  "sea_level": { "m": 120.3, "min_m": 110.5, "max_m": 130.3 } | null,   // 1 decimal; at age_ma
  "land": { "land_pct": 28.7, "shelf_pct": 7.86 } | null         // 2 decimals; at elevation_age_ma
}
```

The dropped fields live once in `manifest.tile_rules`: `source` (temperature `phanda`; co2
`{proxy_fit: foster2017, model_input: phanda}`; sea_level `vandermeer2022`; land `paleodem`), `at`
(the slice field whose age the value belongs to: `climate_age_ma`, `{proxy_fit: age_ma, model_input:
climate_age_ma}`, `age_ma`, `elevation_age_ma`) and `today` (the `units` key to compare with; sea level
is relative to today, 0). Step 80 asserts every dropped value equals what `tile_rules` says, map by map.

- `temperature`: `climate.json.slices[climate].global_mean_c`; null without a climate slice.
- `co2`: if `age_ma ≤ 419.5039` (Foster's last row): `kind "proxy_fit"`, Foster's central value
  linearly interpolated at `age_ma` (clamped to his first row below 0.0039 Ma), `lo68`/`hi68` the same
  for his 68 % band with the lower edge clipped at 0, `today_ppm` his first row; otherwise, with a
  climate slice: `kind "model_input"`, that slice's `co2_ppm`, bands null, `today_ppm` slice 0's
  `co2_ppm`; otherwise null. `at_ma` is the age the value belongs to (`age_ma` or the slice's plate age).
- `sea_level`: van der Meer's AVG / MIN / MAX linearly interpolated at `age_ma` when `age_ma ≤ 540`,
  else null.
- `land`: `elevation.json.slices[elevation]`'s `land_pct` and `shelf_pct`; null without a slice.
  Step 40 computes them from the PaleoDEM grids with `geo.paleodem_land_shelf()`, the function
  step 35 must use, at the climate match (the PaleoDEM plate ages equal the climate slices',
  asserted), so step 40 does not depend on step 35.

Budget ≤ 60,000 bytes (*measured* 59,665, §18).

## 2. `surface/mNN.webp` and `surface/proxy.webp` — the painted maps   (step `10_surface.py`)

Source: the 90 JPEGs in `Scotese PaleoAtlas_v3/PALEOMAP PaleoAtlas Rasters v3/` of the pinned atlas
zip, each 3600 × 1800 RGB (*measured*), joined to `slices.csv` by file name.

**`surface/mNN.webp`**, NN = the map number zero-padded to two digits (`m01` … `m93`; 20, 89 and 91
do not exist). Each: `Image.open(...).convert('RGB')`, `.resize((1024, 512), Image.LANCZOS)`, then
copied into a fresh image (`Image.frombytes('RGB', (1024, 512), im.tobytes())`) so no ICC profile,
EXIF or XMP is carried, saved `format='WEBP', quality=65, method=6`. Equirectangular: column `i`
covers longitudes −180 + 360·i/1024 … −180 + 360·(i+1)/1024, row `j` latitudes 90 − 180·j/512 …
90 − 180·(j+1)/512 (column 0's west edge is 180° W, row 0's north edge 90° N). *Measured*: 4,747,276
bytes for the 90, 21,078–94,800 each.

**`surface/proxy.webp`**: 2560 × 1152 RGB, a 10 × 9 grid of 256 × 128 cells; slice `i` is the cell
at column `i mod 10`, row `floor(i / 10)` (all 90 cells used). Each cell is the source JPEG resized
straight to 256 × 128 with LANCZOS (not from the 1024 version); saved like the maps at
`quality=70, method=6`. *Measured*: 435,250 bytes.

Budgets: ≤ 110,000 bytes per map, ≤ 5,000,000 for the 90; proxy ≤ 480,000.

## 3. `plates.bin` + `plates.json` — pieces of today's crust and their rotations   (step `20_plates.py`)

Source: `PALEOMAP_PlatePolygons.gpml` and `PALEOMAP_PlateModel.rot` from the pinned atlas zip, read
with pygplates 1.0.0.

**Rings.** Every `PolygonOnSphere` geometry of every feature, in file order (feature order, then
geometry order): *measured* **R = 503** rings, **V = 25,881** vertices (26,374 before the closing duplicates are
dropped), no interior rings. The 2
`PolylineOnSphere` geometries (plates 201 and 714, 59 vertices) are not areas and are left out
(`verify_plates.py` prints them). Per ring: the exterior points of the polygon **reconstructed at
0 Ma** (`R(0, p) · polygon`, which is the polygon itself for every plate except 198, below), read with
`to_lat_lon_list()`, with the closing duplicate dropped (493 of the 503 rings repeat their first
point at the end), the feature's reconstruction plate id and valid time (`get_valid_time()` → `(begin,
end)`; `begin` may be +∞ "distant past", `end` −∞ "distant future"), the area in km²
(`get_area() · 6371²`), and an anchor: `get_interior_centroid()`.

**Plates.** `P` = the sorted set of plate ids of the R rings: *measured* **P = 241**, including 0.

**Rotations.** For slice `i` (manifest order) and `k ∈ {0, 1}`, time `t = rotation_ma[i] + k`
(k = 1 is one million years **earlier**, never later, so today's arrows never read the file's
"future" poles). For each plate id `p`: `R = get_rotation(t, p, anchor_plate_id=0) ·
get_rotation(0, p, anchor_plate_id=0).get_inverse()` — the rotation from the present-day (0 Ma
reconstructed) position to the position at `t`. For 240 of the 241 plates `get_rotation(0, p)` is the
identity and `R` is simply `get_rotation(t, p)`; plate 198 (the rotation file's "PCT PRECORDILLERA
TERRANE") has the pole (8.74° N, 38.11° W, 83.7°) relative to plate 201 at 0 Ma, so its polygon is
stored in Mexico and placed by the model in Argentina at 0 Ma;
if `R.represents_identity_rotation()` the quaternion is (1, 0, 0, 0), else from
`R.get_lat_lon_euler_pole_and_angle_degrees()` → (φp, λp, θ): axis
`a = (cos φp cos λp, cos φp sin λp, sin φp)`, `q = (cos θ/2, sin θ/2 · a)`, negated if `w < 0`.
Quantised `round(c · 32767)` to int16 per component.

`plates.bin`, sections in this order (offsets for the measured R, V, P; the `.json` carries the
actual ones):

| Section | Type | Count | Offset | Meaning |
| --- | --- | --: | --: | --- |
| `ring_start` | uint32 | R | 0 | index of the ring's first vertex in `vertices` |
| `ring_count` | uint32 | R | 2,012 | its number of vertices |
| `ring_begin` | float32 | R | 4,024 | valid from (Ma); `+Infinity` = distant past |
| `ring_end` | float32 | R | 6,036 | valid until (Ma); `-Infinity` = distant future |
| `ring_area` | float32 | R | 8,048 | area, km² |
| `ring_plate` | uint16 | R | 10,060 | plate **index** (2 pad bytes follow) |
| `ring_anchor` | int16 | 2R | 11,068 | the anchor's (lon, lat), quantised as vertices |
| `vertices` | int16 | 2V | 13,080 | (lon, lat) pairs, present-day |
| `rotations` | int16 | 90 · 2 · P · 4 | 116,604 | `[slice][k][plate index][w, x, y, z]` |

Total **463,644 bytes** (*measured*, step 20). Vertex quantisation: `lon_q = round(lon · 32767 / 180)`,
`lat_q = round(lat · 32767 / 90)`; decode `lon = lon_q · 180 / 32767`, `lat = lat_q · 90 / 32767`
(steps of 0.0055° lon and 0.0027° lat, 0.61 and 0.31 km). Quaternion decode: divide by 32767 and
**renormalise**. *Measured* worst position error after int16 quantisation over the 241 × 90 × 2
rotations, 5 shipped vertices per plate: 0.360 km (plate 127 at 160 Ma).

Rotate a unit vector `p` by `q = (w, v)`: `t = 2 (v × p)`, `p' = p + w t + v × t`. A ring is drawn at
time `T` when `ring_end ≤ T ≤ ring_begin` (pygplates' `is_valid_at_time`; `verify_plates.py` compares
the two for every ring at all 90 `rotation_ma`).

`plates.json`:
```
{ "model": "PALEOMAP Plate Model m15g60_v2d3 (Scotese 2016)",
  "rotation_file": "PALEOMAP_PlateModel.rot", "rotation_sha256": "…",
  "polygons_file": "PALEOMAP_PlatePolygons.gpml", "polygons_sha256": "…",
  "anchor_plate": 0, "plates": [0, 101, …],            // P ids, ascending; index = plate index
  "times": [[0, 1], [1, 2], …],                        // [rotation_ma, rotation_ma + 1] per slice
  "rings": 503, "vertices": 26374, "slices": 90,
  "sections": { "ring_start": { "offset": 0, "type": "uint32", "count": 503 }, … },
  "vertex_scale": { "lon": 180, "lat": 90, "q": 32767 },
  "quaternion": { "order": ["w", "x", "y", "z"], "scale": 32767, "w_nonnegative": true,
                  "renormalise": true, "rotate": "p' = p + w t + v x t, t = 2 v x p" },
  "valid_rule": "ring_end <= T <= ring_begin",
  "arrow_min_area_km2": 1000000,
  "max_quantisation_error_km": <measured>,
  "dropped_polylines": [ { "plate": 201, "vertices": 26 }, { "plate": 714, "vertices": 33 } ] }
```

`tools/work/plates_ref.json` (not shipped, for `test_plates.mjs`): 1,000 points drawn with the seeded
generator (`numpy.random.default_rng(20260930).choice(n, 1000, replace=False)`, sorted) from the land
sample (§14; kept in `tools/work/land_sample.json`), each with its plate index and its pygplates-rotated (lat, lon) at
the `rotation_ma` of slices 0, 10, 20, … 80 and 89.

Budget: `plates.bin` ≤ 520,000 bytes; `plates.json` ≤ 10,000.

## 4. `coast.bin` + `coast.json` — today's coastlines with their plates   (step `20_plates.py`)

Source: Natural Earth 1:50m coastline v5.1.2 (`ne_50m_coastline.geojson`, public domain). Each
LineString / MultiLineString part becomes a pygplates `PolylineOnSphere` feature, in file order;
`pygplates.partition_into_plates(polygons_valid_at_0, rotation_model, features,
properties_to_copy=[PartitionProperty.reconstruction_plate_id, PartitionProperty.valid_time_begin],
reconstruction_time=0, partition_method=PartitionMethod.split_into_plates)` with the default sort,
where `polygons_valid_at_0` are the polygon features with `is_valid_at_time(0)` (*measured* 453).
Output order: the partitioned pieces as returned, then the unclaimed ones as returned (the call uses
`partition_return=PartitionReturn.separate_partitioned_and_unpartitioned`). A piece with fewer than 2
vertices is dropped. **Unclaimed pieces**: *measured* 44 pieces, 109 vertices, lie in gaps between the
polygons (along the antimeridian, in a few straits, and in Mexico where plate 198's polygon sits
before its 0 Ma rotation). They keep plate 0 and `seg_begin = 0`: drawn today, where they are, and on
no past map. More than 0.5 % of the vertices unclaimed fails the step. (The design's "none" came from
the combined return, which labels such pieces plate 0 with an infinite valid time — that would have
drawn them unmoved on every map.) *Measured*: **N = 2,121** pieces (2,077 claimed), **V = 61,800**
vertices, 151 plates.

| Section | Type | Count | Offset | Meaning |
| --- | --- | --: | --: | --- |
| `seg_start` | uint32 | N | 0 | first vertex |
| `seg_count` | uint32 | N | 8,484 | vertices |
| `seg_begin` | float32 | N | 16,968 | the containing polygon's begin (Ma); `+Infinity` = distant past |
| `seg_plate` | uint16 | N | 25,452 | plate index (2 pad bytes follow) |
| `vertices` | int16 | 2V | 29,696 | (lon, lat), quantised as in §3 |

Total 276,896 bytes for the measured counts. A piece is drawn at `T` when `T ≤ seg_begin`.

`coast.json`: `{ "source": "naturalearth", "file": "ne_50m_coastline.geojson", "pieces": N,
"vertices": V, "plates_used": 151, "unclaimed": { "pieces": 44, "vertices": 109, "first_index": 2077,
"rule": "…" }, "draw_rule": "T <= seg_begin", "sections": { … as in plates.json … }, "vertex_scale":
{ … }, "partition": "…the call above in words…" }`. Budget: `coast.bin` ≤ 300,000; `coast.json` ≤ 4,000.

## 5. `places.json` — ~300 cities for Find   (step `20_plates.py`)

Source: Natural Earth 1:50m populated places, simple (`ne_50m_populated_places_simple.geojson`,
public domain; 1,251 features). Selection: sort by (`scalerank` ascending, `pop_max` descending,
`name` ascending), drop a feature whose (`name`, `adm0name`) was already taken, keep the first 300.
Names: runs of whitespace collapsed to one space ("Washington, D.C."). Position: the feature's
geometry. Plate: `PlatePartitioner(polygons_valid_at_0, rotation_model).partition_point(point)`;
its feature's plate id and `get_valid_time()[0]`. A place no polygon claims fails the step.

```
{ "source": "naturalearth", "count": 300,
  "selection": "first 300 unique (name, country) by scalerank, then pop_max descending, then name",
  "places": [ { "n": "Chicago", "a": "Chicago", "c": "United States of America",
                "lon": -87.752, "lat": 41.8319, "plate": 101, "pi": <plate index>,
                "from_ma": null | 15.0,     // polygon begin; null = distant past
                "r": 1 }, … ] }             // r = scalerank; order = selection order
```

`a` is `nameascii`. Budget ≤ 40,000 bytes.

## 6. `climate.bin` + `climate.json` — the climate model's annual means   (step `30_climate.py`)

Source: PhanDA HadCM3L model priors, suite `scotese_07` (Zenodo 8237751): `ExperimentInfo.xlsx`,
`scotese_07_tas.zip`, `scotese_07_pr.zip`. Read with `zipfile` + `h5py`; the spreadsheet with
`zipfile` + ElementTree.

- **Slices**: the 109 experiments of `ExperimentInfo.xlsx`, keyed by **Experiment Number** (never the
  file name's rounded age), ordered by **Plate Age** ascending (0, 5, … 540; the step asserts
  exactly these 109 values). Slice `s` holds the experiment whose Plate Age is `5s`.
- **Members**: the 5 files per experiment and variable in each zip (`scotese_07_{NNN}_…_tas.nc`,
  `…_pr.nc`, NNN = experiment number); the step asserts 5 each.
- **Fields**: `temp_mm_1_5m (12, 1, 73, 96)` in K ("TEMPERATURE AT 1.5M") and `precip_mm_srf (12, 1,
  73, 96)` in kg m⁻² s⁻¹ (its `units` attribute says "kg m-2", which is wrong for a rate — the long
  name is "TOTAL PRECIPITATION RATE KG/M2/S"). No value equals the fill 2e20 (asserted).
- **Annual mean**: the plain mean of the 12 months (the files use a 360-day calendar, so the months
  are equal), then the plain mean of the 5 members. Temperature − 273.15 → °C; rain × 86,400 →
  mm/day. Each member is, by its own `history` attribute (asserted per file), `cdo -ymonmean
  -seltimestep,{240(k−1)+1}/{240k}` over the last 1,200 months of the run: the monthly climatology
  of one of five consecutive 20-year windows, so the 5-member mean is the run's last-100-year annual
  mean. The `history` also names the run's PUMA ID, which must equal the sheet's column P.
- PhanDA's added `tas` / `pr` copies are not used by step 30; `verify_climate.py` re-reads them as
  an independent path. `pr` is in mm per 365-day year (the UM rate × 31,536,000, a ratio measured
  at every node), not in the UM's unit.
- **Grid**: the UM's own nodes, kept as they are: rows latitude 90 → −90 by 2.5° (73), columns
  longitude 0 → 356.25 by 3.75° (96).
- **Area weights** for the global means: node-bound weights
  `w_j = sin(min(90°, φ_j + 1.25°)) − sin(max(−90°, φ_j − 1.25°))`, the same for every column,
  normalised. *Measured* at 0 Ma: 14.74 °C and 2.961 mm/day.

**Encoding**, one byte per node, Global Weather's `offset + step · byte ^ power`:

| Field | offset | step | power | Bytes used (*measured*) | Largest error |
| --- | --: | --: | --: | --- | --- |
| temperature (°C) | −60 | 0.5 | 1 | 9–205 (−55.68 … 42.47 °C) | 0.25 °C |
| rain (mm/day) | 0 | 0.0003 | 2 | 0–232 (0 … 16.165 mm/day) | 0.06 mm/day |

`byte = round((value − offset) / step)` for power 1, `round(sqrt(value / step))` for power 2.
**255 means no data** and must not occur (asserted). A value that would need a byte above 254 fails
the step — it never clips; the fix is a deliberate change here.

`climate.bin`: `[field][slice][row][col]`, fields in the order temperature, rain; 7,008 bytes per
slice-field (96 × 73); 2 × 109 × 7,008 = **1,527,744 bytes**. The field-major order deflates better
(*measured* 780,559 vs 812,974 bytes). Offset of (field `f`, slice `s`) = `(f · 109 + s) · 7008`.

`climate.json`:
```
{ "source": "phanda", "suite": "scotese_07", "model": "HadCM3L",
  "grid": { "nx": 96, "ny": 73, "lon0": 0, "dlon": 3.75, "lat0": 90, "dlat": -2.5,
            "order": "row-major, north row first, eastward columns", "at": "nodes" },
  "layout": "[field][slice][row][col]", "slice_bytes": 7008, "count": 109,
  "fields": [
    { "key": "temperature", "variable": "temp_mm_1_5m", "what": "annual mean air temperature 1.5 m above the surface",
      "unit": "C", "offset": -60, "step": 0.5, "power": 1, "nodata": 255, "bytes_used": [9, 205] },
    { "key": "rain", "variable": "precip_mm_srf", "what": "annual mean total precipitation",
      "unit": "mm/day", "offset": 0, "step": 0.0003, "power": 2, "nodata": 255, "bytes_used": [0, 232] } ],
  "max_encoding_error": { "temperature_c": 0.25, "rain_mm_day": 0.0603 },
  "annual_mean": "mean of 12 equal months (360-day calendar), then of the 5 twenty-year means",
  "weights": "node-bound: sin(min(90, lat+1.25)) - sin(max(-90, lat-1.25))",
  "slices": [ { "s": 0, "experiment": 109, "plate_age_ma": 0, "experiment_age_ma": 0, "puma_id": "tfkea",
                "co2_ppm": 276.01, "global_mean_c": 14.74, "global_mean_rain_mm_day": 2.961,
                "range_c": [lo, hi], "range_rain_mm_day": [lo, hi] }, … ] }
```
Global means and ranges are of the unrounded annual means (4 decimals). Step 30 also writes
`tools/work/climate.json`: per map, its climate slice under §1's matching rule.

`co2_ppm` is the suite's column in `ExperimentInfo.xlsx` (columns P–Q per `RESEARCH.md` §2.3), the
CO₂ the model was run with. Budget: `climate.bin` exactly 1,527,744; `climate.json` ≤ 30,000.

## 7. `elevation.bin` + `elevation.json` — PaleoDEM classes for the readout   (step `35_elevation.py`)

Source: Scotese & Wright 2018 1° PaleoDEMs (`Scotese_Wright_2018_Maps_1-88_1degX1deg_PaleoDEMS_nc.zip`),
109 NetCDF4 grids `z (lat 181: −90 … 90, lon 361: −180 … 180)` in metres, read with h5py. Each grid is
keyed by the **Plate Model Age** in the zip's `PaleoAtlasTimeIntervalsv22b copy.csv` (old-Mac `\r`
line endings), joined to the `.nc` file by its map id — not by the age in the file name, which is
fractional for two files (`…_385.2Ma.nc`, `…_390.5Ma.nc`). The step asserts the 109 plate ages are
exactly 0, 5, … 540. Slice `s` = plate age `5s`.

**Classes**: Scotese's Table 2 (atlas PDF p. 42, after Ziegler et al. 1985). `code = number of
edges e with e < z`, edges `[−6000, −4000, −200, −50, 0, 200, 1000, 2000, 4000]` m
(`numpy.digitize(z, edges, right=True)`):

| code | z (m) | name shown (US / metric) |
| --: | --- | --- |
| 0 | ≤ −6000 | ocean trench (deeper than 19,700 ft / 6,000 m) |
| 1 | −6000 < z ≤ −4000 | deep ocean floor (13,100–19,700 ft / 4,000–6,000 m deep) |
| 2 | −4000 < z ≤ −200 | deep sea (660–13,100 ft / 200–4,000 m deep) |
| 3 | −200 < z ≤ −50 | outer shelf sea (160–660 ft / 50–200 m deep) |
| 4 | −50 < z ≤ 0 | shallow sea (under 160 ft / 50 m deep) |
| 5 | 0 < z ≤ 200 | lowland (up to 660 ft / 200 m) |
| 6 | 200 < z ≤ 1000 | hills and plateaus (660–3,300 ft / 200–1,000 m) |
| 7 | 1000 < z ≤ 2000 | highlands (3,300–6,600 ft / 1,000–2,000 m) |
| 8 | 2000 < z ≤ 4000 | mountains (6,600–13,100 ft / 2,000–4,000 m) |
| 9 | > 4000 | high mountains (above 13,100 ft / 4,000 m) |

**Land %** = weighted share of nodes with code ≥ 5 (z > 0); **shelf %** = codes 3–4 (−200 < z ≤ 0);
computed on the full 1° grid with `cos φ` node weights and the +180° column left out (it repeats
−180°). *Measured*: 27.6 % land and 5.8 % shelf at 0 Ma.

**Shipped grid**: every second node of the 1° grid — rows latitude 90 → −90 by 2° (91; source row
index `180 − 2r`), columns longitude −180 → 178 by 2° (180; source column `2c`). `elevation.bin`:
`[slice][row][col]`, one byte = the code, 255 = no data (must not occur), 16,380 bytes per slice,
109 × 16,380 = **1,785,420 bytes**.

`elevation.json`:
```
{ "source": "paleodem", "grid": { "nx": 180, "ny": 91, "lon0": -180, "dlon": 2, "lat0": 90,
  "dlat": -2, "order": "row-major, north row first", "at": "nodes of the 1-degree grid" },
  "layout": "[slice][row][col]", "slice_bytes": 16380, "count": 109, "nodata": 255,
  "classes_source": "Scotese 2016, PALEOMAP PaleoAtlas for GPlates v3, Table 2 (after Ziegler et al. 1985)",
  "codes": [ { "code": 0, "z_min": null, "z_max": -6000, "name_us": "…", "name_metric": "…" }, … ],
  "slices": [ { "s": 0, "plate_age_ma": 0, "map_id": "1", "file": "Map01_PALEOMAP_1deg_Holocene_0Ma.nc",
                "land_pct": 27.6, "shelf_pct": 5.8 }, … ] }
```
Budget: `elevation.bin` exactly 1,785,420; `elevation.json` ≤ 20,000.

**As built (§18)**: each `codes` entry also carries `name` (the class alone, "shallow sea", for the
readout line) beside `name_us` / `name_metric` (with the range); the file adds `class_rule`,
`edges_m` (the nine edges) and `land_rule`; `land_pct` / `shelf_pct` have 4 decimals. The edges are
parsed from Table 2 of the atlas PDF on every build and must equal `geo.DEM_EDGES`. Step 35 also
writes `tools/work/elevation.json` (per map: `elevation`, `elevation_age_ma`, §1's matching rule) for
step 80. *Measured*: `elevation.bin` 1,785,420 and `elevation.json` 17,113 bytes; land 27.598 % and
shelf 5.757 % at 0 Ma, land 14.276–36.517 %, shelf 1.267–13.919 % over the 109 (the same numbers
step 40 prints: one function).

## 8. `curves.json` — the time series on a 1-Myr grid   (step `40_curves.py`)

One shared grid, `t = 0, 1, … 750` Ma (**751 points**, index = age in Ma), the slider's whole axis, so
the curves strip reads it without re-mapping. Values are floats (3 decimals) or `null` where the
series has no value; nothing is extrapolated (every series is null from 541 Ma, Foster's from 420).
Each series says what its native sampling is, so nothing pretends to be finer than its source.

```
{ "grid": { "t0_ma": 0, "dt_ma": 1, "n": 751, "note": "…" },
  "series": {
    "temperature_c": { "values": [...751], "native_ma": [0, 5, … 540], "interp": "linear",
                       "source": "phanda", "unit": "C", "what": "…" },
    "co2_ppm": { "values": [...], "lo68": [...], "hi68": [...], "source": "foster2017", "unit": "ppm",
                 "interp": "linear", "native_step_ma": 0.5, "first_ma": 0.0039, "last_ma": 419.5039,
                 "fit_to_ma": 419, "lo68_clipped_ma": [], "clipped_lo68_rows": 0, "lo68_rule": "…",
                 "lo95_negative_rows": 124, "lo95_negative_from_ma": 247.004, "lo95_negative_to_ma": 419.504,
                 "band95": "not shipped …", "what": "…" },
    "co2_model_ppm": { "values": [...], "native_ma": [0, 5, … 540], "interp": "linear",
                       "source": "phanda", "unit": "ppm", "what": "… draw it where co2_ppm is null" },
    "sea_level_m": { "values": [...], "min": [...], "max": [...], "native_step_ma": 1, "interp": "none",
                     "source": "vandermeer2022", "unit": "m", "column": "TGE_SL_isocorr_m (Fig10), AVG/MIN/MAX",
                     "band_rule": "…", "min_above_max_ma": [1], "avg_outside_band_ma": [1, 2, 3, 444, 445] },
    "land_pct":  { "values": [...], "native_ma": [0, 5, … 540], "interp": "linear", "source": "paleodem", "unit": "%" },
    "shelf_pct": { "values": [...], "native_ma": [0, 5, … 540], "interp": "linear", "source": "paleodem", "unit": "%" } } }
```

- `co2_ppm` 0 … 419: Foster et al. 2017 Supplementary Data 2 ("LOESS Fit": Age, pCO2 probability
  maximum, lw95%, lw68%, up68%, up95%), linearly interpolated to the integer ages (0 takes his
  first row, 0.0039 Ma); null from 420. `lo68` clipped at 0 before interpolation;
  `clipped_lo68_rows` counts the native rows that needed it and `lo68_clipped_ma` lists every grid
  age whose value used such a row (*measured*: 0 rows, empty list — the flag exists so a new file
  cannot clip silently). The 95 % band is not shipped; its negative-row count and range are
  computed for the About text (*measured* 124 rows, 247.0039–419.5039 Ma).
- `co2_model_ppm` 0 … 540: the `co2_ppm` of the 109 climate slices (the CO₂ the model was run with),
  linearly interpolated between 5-Myr points. A model input, not a proxy fit: the strip draws it
  (dashed) where `co2_ppm` is null, and may draw it faintly under the fit for comparison.
- `sea_level_m`: van der Meer et al. 2022 `mmc1.xlsx`, sheet "SuppTable", column A age 0–540 at
  1 Myr, `TGE_SL_isocorr_m` AVG / MIN / MAX (columns AI–AK), used as published; rows without an age
  in column A (546 onward) are ignored. **The `GAT_degC` column (Scotese et al. 2021 temperatures) is
  never read.** MIN and MAX are not ordered bounds at every age (*measured*: MIN > MAX at 1 Ma; AVG
  outside [min(MIN, MAX), max(MIN, MAX)] at 1, 2, 3, 444, 445 Ma), so the band is drawn between the
  lower and the higher of the two.
- `temperature_c`: `climate.json`'s `global_mean_c` at the plate ages; `land_pct` (z > 0 m) and
  `shelf_pct` (shallow sea, −200 < z ≤ 0 m): `geo.paleodem_land_shelf()` on each PaleoDEM grid
  (§7's definition); all interpolated linearly to the integer ages.

Budget ≤ 80,000 bytes (*measured* 53,394).

## 9. `timescale.json` — ICS names, ages and colours   (step `50_timescale.py`)

Source: `chart.ttl` from `i-c-stratigraphy/chart` at commit `81618a865cdb04998355a302f3e859908a080c0e`,
parsed with rdflib. A unit is a subject with a `gts:rank`; its begin and end are the `gtsd:inMYA` of
its `time:hasBeginning` / `time:hasEnd` nodes, uncertainties their `schema:marginOfError` (null when
absent), its colour its `schema:color`, its parent its `skos:broader`. **id** = the IRI's last path
segment (`https://data.stratigraphy.org/data/gts/LowerTriassic` → `LowerTriassic`). **name** =
`skos:prefLabel@en`; when a unit has none (*measured*: 21 units in this commit, e.g. `LowerTriassic`,
`UpperPleistocene`) the id split before each capital that follows a lower-case letter
("Lower Triassic"), with `"name_from": "id"` so the fallback is visible.

Units shipped: ranks Eon, Era, Period, Sub-Period, Epoch, Age whose interval overlaps [0, 1000) Ma
(`end < 1000`), sorted by `begin_ma` descending, then by rank in that order, then id. *Measured*: 162
units (2 eons, 4 eras, 15 periods, 2 sub-periods, 38 epochs, 102 ages). **A subject can carry two
ranks**: `Pridoli` is both an Epoch and an Age in this chart; it ships once with `"rank": "Epoch"`
(the coarser) and `"also_rank": ["Age"]`, and a lookup by rank matches either. A parent that is not
shipped is written `null` with `"parent_unshipped"` (only `Proterozoic`, whose parent is the
Super-Eon `Precambrian`). `cite` is the chart's own `dcterms:bibliographicCitation@en`, its DOI link
written `doi:…`. `version` is the scheme's `owl:versionInfo` ("2026-06").

**`quirks`** lists the chart data's own inconsistencies, shipped as given (never corrected here) so
the app never tiles a rank blindly; step 50 asserts each and that no map age falls inside one:
the Ludlow epoch is given as 426.7–419.62 Ma and overlaps the Pridoli (422.7–419.62; the Ludlow's
last age, the Ludfordian, ends at 422.7), and the Aquitanian begins at 23.03 Ma while the Chattian,
Oligocene and Paleogene end, and the Miocene and Neogene begin, at 23.04 (a 0.01-Myr gap between
ages).

```
{ "source": "ics", "commit": "81618a865cdb04998355a302f3e859908a080c0e",
  "version": "2026-06", "quirks": [ { "units": ["Ludlow", "Pridoli"], "text": "…" }, … ],
  "cite": "Cohen K, Harper D, Gibbard P, Car N. … Episodes 2025;48:105-115. doi:10.18814/epiiugs/2025/025001. …",
  "ranks": ["Eon", "Era", "Period", "Sub-Period", "Epoch", "Age"],
  "rule": "a unit contains age a when end < a <= begin, or a = 0 and end = 0",
  "units": [ { "id": "Triassic", "name": "Triassic", "name_from": "prefLabel", "rank": "Period",
               "begin_ma": 251.902, "begin_unc_ma": 0.024, "end_ma": 201.4, "end_unc_ma": 0.2,
               "colour": "#812B92", "parent": "Mesozoic" }, … ],
  "card_periods": [ "Quaternary", "Neogene", … "Tonian" ] }   // Period ids containing a map's age, youngest first
```
*Measured* from the pinned commit: Cretaceous begins 143.1 ± 0.6, Devonian 419.62 ± 1.36,
Ordovician 486.85 ± 1.5, Cambrian 538.8 ± 0.6, Cryogenian 720.0, Tonian 1000.0. Step 50 also writes
`tools/work/ics_slices.json` (per map: the unit ids `eon`, `era`, `period`, `subperiod`, `epoch`,
`age`, the period colour, and `ics_note`, §1). Budget ≤ 40,000 bytes (*measured* 31,699).

## 10. `story.json` — cards, events, look-for anchors, sources   (step `60_story.py`)

Written by hand in `tools/content/story.yaml` (never shipped), validated and converted by step 60.

```yaml
sources:                       # every id cited anywhere below; each used at least once
  - id: foster2017
    cite: "Foster, G.L., Royer, D.L. & Lunt, D.J. (2017). Future climate forcing potentially without precedent in the last 420 million years. Nature Communications 8, 14845."
    doi: "10.1038/ncomms14845"          # or url:
    access: open | closed
periods:                       # one card per id in timescale.json card_periods, no others
  - ics: Triassic
    text: "…"                  # ≤ 90 words
    sources: [ … ]
prologue: { title: "Before 750 million years ago", text: "…", sources: [ … ] }   # ≤ 90 words
events:                        # ~25
  - id: end-permian
    title: "…"                 # ≤ 60 characters
    age_ma: 251.9
    age_unc_ma: 0.1            # optional
    boundary: Triassic         # optional: the event marks the base of this ICS unit
    text: "…"                  # ≤ 45 words
    sources: [ … ]
look_for:
  - id: appalachians
    label: "…"                 # the pin's label, ≤ 24 characters
    text: "…"                  # ≤ 25 words
    lon: -79.0
    lat: 38.0
    window_ma: [480, 250]      # shown while window[1] ≤ age_ma ≤ window[0]
    plate: 101                 # optional; must equal the partition result
    sources: [ … ]
```

`story.json` is the same structure plus, per period card, the ICS `name`, `begin_ma`, `end_ma`,
`colour`; per event, the id of the ICS Period containing `age_ma`; per look-for, `plate`, `pi` (plate
index) and `from_ma` from `partition_point` exactly as §5. Word counts are whitespace-separated
tokens.

Step 60 fails when: a card is missing for a `card_periods` id or exists for another; a word or
character limit is exceeded; an item has no source; a source id does not resolve or is unused; a
`boundary` event's age differs from that unit's ICS `begin_ma` by more than its `begin_unc_ma`
(0.05 when null) unless the event cites a source for a different number (`boundary_source:`); an
event's age is outside [0, 750]; a look-for anchor's plate is not carried back over its whole window
(`from_ma < window_ma[0]`); any text contains "http", "www." or the name of an AI vendor or
product; any source's cite or URL points at Wikipedia or another wiki. The reviewers check every
number against its source; the step cannot.

**As built (§17)**: the YAML is `tools/content/story.yaml`, and each item also carries `numbers`
(`{numeral as written: source id or [ids]}`; every numeral in its text, title, label or `when` must be
a key, and every key must occur), events carry `period` (the ICS Period they are filed under, checked
against the chart), `age_source`, and optionally `ics_unit` (the unit whose begin an ICS-sourced age
is), `range_ma` ([older, younger]: `age_ma` is its midpoint and `age_unc_ma` its half-width) and
`when` (the age as the sheet should print it); a `measured` map explains an atlas-credited numeral that
is not a map number or age. `evidence` (sources) and `placement` (pins) stay in the YAML. story.json
adds `schema`, `retrieved`, `note`, and turns every `numbers` value into a sorted list.

Budget ≤ 60,000 bytes (*measured* 40,982).

## 11. `about.json` — the About panel   (step `90_about.py`)

```
{ "title": "About Earth's History", "retrieved": "2026-09-30", "version": "1.0",
  "intro": "…",
  "reading": [ { "id": "reading-surface", "title": "…", "text": "…" }, … ],   // how to read each lens and overlay
  "caveats": [ { "id": "one-reconstruction", "title": "…", "text": "…", "sources": [ids] }, … ],
  "not_shown": { "title": "What this app does not show, and why", "text": "…" },
  "numbers": { "lo95_negative_rows": 124, "lo95_negative_from_ma": 247.0, "lo95_negative_to_ma": 419.5,
               "today_temperature_c": 14.74, … },     // every number the caveats quote, from the data
  "sources": [ { "id": "paleoatlas", "title": "…", "owner": "…", "licence": "CC BY 4.0",
                 "licence_uri": "http://creativecommons.org/licenses/by/4.0/", "source": "…", "url": "…",
                 "retrieved": "2026-09-30", "adaptations": "…", "accuracy": "…", "cite": "…",
                 "attribution": "…" }, … ],                 // the credit line the licence asks for
  "references": [ { "id": "domeier2014", "cite": "…", "doi": "…", "access": "open" }, … ],  // caveat papers
  "software": { "text": "No third-party code ships with this app. The build pipeline in tools/ uses pygplates (GPL-2.0) and other Python packages at build time only." } }
```
`reading` items also carry `sources` (as built, §17).

Source ids, fixed: `paleoatlas`, `paleodem`, `phanda`, `foster2017`, `vandermeer2022`, `ics`,
`naturalearth`, `gough1981` (cited formula; `sources.CITED`). The caveats are the list in `DESIGN.md`
§3.8; each caveat's numbers are read from `numbers`, never typed. Budget ≤ 40,000 bytes.

## 12. `../CREDITS.txt`   (step `90_about.py`)

Plain text, 100-column wrapped, from the same fragments: a heading ("Earth's History — credits and
licences"), one paragraph on how the data was obtained, then one block per source in the order of
§11's ids: TITLE in capitals, Owner, Source (file name and sha256), URL, Licence, Licence text (the
quote from `tools/credits/`), Retrieved, Adaptations, Accuracy, Cite. CC BY 4.0 blocks carry the
licence URI and say what was changed (resized and re-encoded, averaged, quantised, resampled,
clipped). Natural Earth's block says "Made with Natural Earth." and that it is public domain.
Gough 1981 is listed as a cited formula (publisher copyright, nothing copied). Then "Software": none
shipped; pygplates (GPL-2.0) used at build time only. Budget ≤ 40,000 bytes.

## 13. Budgets

| File | Cap (bytes) | Expected |
| --- | --: | --- |
| `surface/mNN.webp` (each / all 90) | 110,000 / 5,000,000 | 4,747,276 (*measured*) |
| `surface/proxy.webp` | 480,000 | 435,250 (*measured*) |
| `plates.bin` / `plates.json` | 520,000 / 10,000 | 463,644 / 3,652 (*measured*) |
| `coast.bin` / `coast.json` | 300,000 / 4,000 | 276,896 / 910 (*measured*) |
| `places.json` | 40,000 | 35,615 (*measured*) |
| `climate.bin` / `climate.json` | 1,527,744 exactly / 30,000 | 1,527,744 / 25,615 (*measured*) |
| `elevation.bin` / `elevation.json` | 1,785,420 exactly / 20,000 | 1,785,420 / 17,113 (*measured*) |
| `curves.json` | 80,000 | 53,394 (*measured*, 751-point grid) |
| `timescale.json` | 40,000 | 31,699 (*measured*) |
| `story.json` | 60,000 | 40,982 (*measured*) |
| `manifest.json` | 60,000 | 18,282 after step 10; 59,665 after step 80 (*measured*, §18) |
| `about.json` | 40,000 | 22,302 (*measured*, after step 35) |
| `../CREDITS.txt` | 40,000 | 25,010 (*measured*, after step 35) |
| **`data/` total** | 11,000,000 | 9,527,177 raw, 105 files (*measured* by `verify_data.py`) |
| **The ZIP** (`tools/check.mjs`) | 8,000,000 | 6,749,388 for `data/` + `CREDITS.txt` alone (*measured*: `zip -r -X`, default level); the app's code adds to it |

A step that would exceed its cap stops before writing the file; it never writes a partial or
trimmed one.

## 14. What each verify script asserts (and prints)

- **`verify_surface.py`** — 90 map files and the proxy, dimensions, byte caps. **Registration gate**:
  map 1 at 1024 × 512 classified "water iff blue > max(red, green)" against Natural Earth 1:50m land
  rasterised to the same grid (pixel centres, holes cut), cos-latitude weights: agreement ≥ 0.95 at
  zero shift and strictly highest at zero among horizontal shifts of ±3, ±5, ±10, ±14 (≈ ±5°) and
  ±20 px, a half-width shift and a north–south flip (*measured* by `verify_surface.py`: 0.9731 at
  zero; 0.9566 / 0.9573 at ∓3 px, 0.8933 / 0.8930 at ∓14 px, 0.6622 at 180°, 0.5666 flipped).
  Prints the table.
- **`verify_plates.py`** — section offsets and sizes match `plates.json`; every ring valid at each of
  the 90 times exactly when pygplates says so; the stored quaternions reproduce
  `R(t, p) · R(0, p)⁻¹ * point` within 1 km at every plate and time for 5 shipped vertices per plate
  (prints the worst: *measured* 0.360 km); identity at 0 Ma for every plate. **The land sample**: the
  integer-degree nodes (longitude −180 … 179, latitude 90 … −90) inside Natural Earth 1:50m land by
  the even-odd rule — *measured* 21,215 nodes, 21,214 claimed by a polygon valid at 0 Ma (the design's
  24,830 came from a scratch script that is not in the repository and could not be reproduced).
  **Rotation-time gate**: the land sample, keeping points whose polygon is carried back to T (begin ≥
  T), rotated to `T = rotation_ma` of maps 16, 43 and 57 (66, 200, 300 by file age), must fall on
  PaleoDEM z ≥ −200 m at the nearest 1° node of the matched grid (65, 200, 300 Ma) in ≥ 0.88 of cases
  and beat rotations of the same points to T − 20 and T + 20 by ≥ 0.03 each (*measured* 0.926 / 0.982 /
  0.911; controls 0.832–0.835 / 0.924–0.934 / 0.842–0.863), and on the painted map's not-water pixels
  more often than both controls (*measured* 0.800 / 0.965 / 0.698; controls 0.689–0.694 /
  0.913–0.915 / 0.661–0.682). The same test
  is run with `age_ma` as the time; `rotation_ma` stays `file_age_ma` unless `age_ma` scores higher on
  both measures at all three maps, in which case the script fails and asks for a deliberate change of
  `ROTATION_TIME` in `10_surface.py` (*measured*: `age_ma` is higher on both at none of the three —
  0.926 / 0.796, 0.982 / 0.965, 0.907 / 0.694). **Cities**: Cape Town, New York, Mumbai and Sydney at
  66, 200 and 300 Ma, rotated with the shipped quaternions (≤ 0.25 km from pygplates, round trip
  ≤ 1e−6 km), each on painted land or PaleoDEM z ≥ −200 m. **Places gate**: of the places carried
  back to T, the fraction on painted land or PaleoDEM z ≥ −200 m is ≥ 0.80 and above both T ± 20
  controls (*measured* 0.892 / 0.943 / 0.892; controls 0.688–0.691 / 0.854–0.871 / 0.799–0.838). Prints the anchor speed distribution
  (median, 99th percentile, maximum) and every ring above 20 cm/yr. Coast and places: every plate
  index valid, `seg_begin`/`from_ma` equal to the containing polygon's begin, the list of places not
  carried back past 0 Ma (e.g. Honolulu, plate 901).
- **`verify_climate.py`** — size exactly 1,527,744; `climate.json` ≤ 30,000; shape, grid and plate
  ages 0 … 540 by 5; no 255; decoded per-slice ranges and global means equal `climate.json`'s within
  the stated encoding error; **an independent re-read** of slices 0, 54 and 108 of both fields from
  the raw NetCDFs through PhanDA's own `tas` / `pr` copies, every node located by its coordinate
  values (*measured*: every node within 0.2500 °C and 0.0596 mm/day of the decoded bytes); 0 Ma global
  mean within 0.05 °C of the design stage's 14.74 and within 14.0–15.5, rain within 0.005 of 2.961 and
  within 2.5–3.5 (*measured* 14.7441 °C, 2.9610 mm/day — the model's pre-industrial run at 276.01 ppm,
  not an observation); experiment 27 carries Experiment Age 410 / Plate Age 410 and experiment 108
  Experiment Age 4 / Plate Age 5 from the sheet, whatever their file names (`409Ma`, `3Ma`) say;
  slice 0 is experiment 109 with CO₂ 276.01 and slice 108 experiment 1 (Plate Age 540, Experiment
  Age 541, CO₂ 3374); all 109 sheet rows agree with `climate.json`; the map match (82 exact, 5
  nearest, none for maps 90, 92, 93).
- **`verify_elevation.py`** — size exactly 1,785,420; codes 0–9 only; plate ages 0 … 540 by 5;
  land % and shelf % re-derived from the shipped 2° grid within 1.5 points of the 1° values (prints
  both for every slice; *measured* worst 0.220 points). As built: every one of the 1,785,420 bytes
  re-derived from the raw NetCDF, each node found by the file's own coordinates and classed with
  `codes`' `z_min < z ≤ z_max` (not `digitize`): 0 mismatches; `land_pct` / `shelf_pct` recomputed
  independently on the 1° grid (within 0.00005, the rounding); the map match equals step 30's.
- **`verify_manifest.py`** (as built, §18) — ≤ 60,000 bytes; the exact key sets; the 90 slices in
  ascending age with their map files present; every `ics` id re-found in `timescale.json` by the
  containment rule (not copied from step 50's work file) and the colour the period's; boundary notes
  on maps 14, 16, 32, 43, 49, 65, 83, 88 and period notes on 61, 73, 93; the climate and elevation
  matches recomputed; CO₂ and sea-level tiles re-interpolated from Foster's and van der Meer's sheets
  (*measured* within 0.0498, the 0.1 rounding); temperature and land equal to `climate.json` /
  `elevation.json` at 2 decimals; `units`.
- **`verify_curves.py`** — no NaN or Infinity; ≤ 80,000 bytes; grid 0 … 750 by 1, strictly
  increasing; every array 751 long and non-null exactly on its stated coverage (0 … 540, Foster
  0 … 419); wide sanity bounds that catch a unit mistake; `0 ≤ lo68 ≤ values ≤ hi68`; the CO₂ switch
  at 419/420; CO₂ at 0 Ma equals Foster's first row and is within 5 ppm of the model's 0 Ma input
  (*measured* 276.008 vs 276.01); spot values re-read from the sheets (CO₂ and sea level at 66 Ma)
  and land/shelf re-derived from the 0 and 250 Ma grids; `sea_level_m` 0 at 0 Ma; prints each
  series' min/max and the tiles of maps 1, 16, 49, 88.
- **`verify_timescale.py`** — ≤ 40,000 bytes; every Phanerozoic period's begin against the build
  brief's list (541/538.8, 485.4, 443.8, 419.2, 358.9, 298.9, 251.9, 201.4, 145.0, 66.0, 23.03,
  2.58): equal at the list's precision, or within the chart's own uncertainty, or a **listed
  difference pinned to the chart's exact numeral** (*measured*: Cretaceous 143.1 ± 0.6 against 145.0,
  Neogene 23.04 against 23.03); the chart's numerals also read from the Turtle text by regular
  expression, independently of rdflib; periods and eras tile 0 … 1000 Ma and epochs and ages 0 …
  538.8 Ma with exactly the two listed `quirks`; every parent shipped, coarser and enclosing; every
  map in exactly one Period, the one `ics_slices.json` names; prints all 90 maps with age, ICS
  period / sub-period / epoch / age and `ics_note`, and the 21 names made from ids.
- **`verify_story.py`** — re-runs step 60's checks (`story_check.py`) on the shipped `story.json`, not
  on the YAML; checks each card's chart fields against `timescale.json` and events oldest first;
  re-partitions every pin with pygplates and compares `plate`, `pi` and `from_ma`; re-measures the 13
  map claims; prints the word counts and each pin's paleolatitude range over its window (*measured*:
  cards ≤ 83 words, events ≤ 43, pins ≤ 23; 142 numerals, all mapped).
- **`verify_data.py`** — runs all of the above, then: the byte caps in §13; `data/` holds exactly
  the claimed files; no URL in `index.html`, `style.css`, `js/*.js` (once they exist); every plate id
  used anywhere is in `plates.json.plates` (the one-plate-model rule). As built (§18): `--cross-only`
  skips re-running the step verifies (`build_all.sh` has just run each after its step); also checks
  each `.bin` against its `.json` layout, that `plates.json`'s two files are the pinned zip's, that
  index and id name the same plate for every place and pin, that land/shelf % and temperature agree
  across `curves.json`, `elevation.json`, `climate.json`, `manifest.json` and `about.json`, that the
  `paleodem` credits name the report and page the "first draft" caveat quotes, and that no shipped
  text file names an AI vendor or product.

---

## 15. Builder's decisions (steps 10 and 20, 2026-09-30)

Where this contract or `../DESIGN.md` was silent or wrong, the builder of steps 10 and 20 decided the
following. Every number was printed by `build_all.sh` (steps `10_surface.py`, `verify_surface.py`,
`20_plates.py`, `verify_plates.py`) with the pinned venv.

1. **Step 10 writes a first `manifest.json`.** The brief for steps 10–20 asks step 10 to write it;
   §1 gives it to step 80. Both hold: step 10 writes the fields it owns (§1) and `work/surface.json`,
   and step 80 rewrites the file with the ICS, climate, elevation and tile fields. `rotation_ma` comes
   from one constant, `ROTATION_TIME = 'file_age_ma'` in `10_surface.py`, which `verify_plates.py`'s
   gate tests; a change is a deliberate edit, never automatic.
2. **Present-day means reconstructed at 0 Ma, and rotations are relative to it** (§3). Plate 198 has a
   non-zero pole at 0 Ma, so `get_rotation(t, p)` applied to stored geometry would move today's
   coasts, cities and taps on that plate by 83.7° on the 0 Ma map. Rings are stored as the 0 Ma
   reconstruction and every rotation is `R(t) · R(0)⁻¹`; for the other 240 plates nothing changes. As
   the only 198 ring is valid from 0 Ma only, this affects nothing drawn on a past map. Chosen over
   shipping `R(t)` and special-casing 198 in the app.
3. **Closing duplicates dropped**: 493 of 503 rings repeat their first vertex at the end; the
   contract's "no closing duplicate" is honoured, so V = 25,881, not 26,374, and `plates.bin` is
   463,644 bytes, not 465,616.
4. **Unclaimed coast slivers are kept at 0 Ma only** (§4): 44 pieces, 109 vertices; plate 0,
   `seg_begin` 0. Chosen over failing the build (the contract's rule, written from a measurement that
   could not see them) and over dropping them (today's coastline would have small gaps).
5. **Plate 0 is honest as identity**: its only polygon (122,363 km²) is valid from 0 Ma only, so
   nothing on plate 0 is carried back.
6. **Credits fragments share ids across steps.** Steps 10 and 20 both use the atlas; each writes a
   block with id `paleoatlas` and a `part` field (`maps`, `plate model`). `90_about.py` must merge
   blocks with the same id (one source entry; adaptations joined in step order). Step 20 also writes
   the `naturalearth` block (coastlines, places, and the land file used by the checks). Fragments are
   `tools/credits/fragments/surface.json` and `plates.json`, written with sorted keys and one-space
   indent.
7. **The land sample is defined here** (§14): integer-degree nodes inside Natural Earth land. The
   design's 24,830-point sample could not be reproduced (its scratch script was not kept); the gates
   were re-measured on this sample and all pass with margin.
8. **Registration check extra controls**: the ±5° shift the brief asks for is ±14 px (4.92°); a
   half-width shift and a north–south flip are also checked.
9. **Places gate threshold 0.80** (painted land or PaleoDEM z ≥ −200 m, among places carried back to
   T, and above both T ± 20 controls). Measured 0.892 / 0.943 / 0.892 at 66 / 200 / 300 Ma. Why not
   higher: most of the 300 cities are coastal, and a 0.35° map pixel or a 1° DEM node puts many of them
   on the sea side of a painted shoreline even when the rotation is right. Painted land alone is
   reported but not gated: at 300 Ma it is 0.591 against controls of 0.606–0.614, because the painted
   300 Ma map floods much of today's coastal land with shallow sea; the PaleoDEM measure beats both
   controls there (0.892 against 0.799–0.838). New York at 66 Ma is on painted water but on PaleoDEM
   land (80 m) — the named-city check accepts either.
10. **Quantisation error measured one way**: step 20 and `verify_plates.py` both rotate 5 evenly
    spaced shipped vertices per plate and compare with pygplates; `max_quantisation_error_km` =
    0.359538 (printed as 0.360).
11. **Anchor speeds**: the shipped anchors move at most 17.94 cm/yr (median 3.64, 99th percentile
    11.68) over the 12,066 (ring, map) pairs where the ring is valid; none exceeds 20 cm/yr, so the
    reviewers' list is empty. The design's 154.5 cm/yr was a rigid-rotation upper bound, not an
    anchor speed.
12. **Places not carried back past 0 Ma**: Taipei and Kaohsiung (plate 605), Honolulu (901),
    Makassar (679) — their polygons are valid at 0 Ma only.
13. **WebP determinism** is confirmed on the pinned Pillow 12.3.0 (libwebp 1.6.0): two builds, and a
    third from a freshly created venv, gave byte-identical `data/`.

## 16. Builder's decisions (steps 30, 40 and 50, 2026-09-30)

Where this contract, `../DESIGN.md` or the build brief was silent or disagreed, the builder of steps
30, 40 and 50 decided the following. Every number was printed by `build_all.sh` (steps
`30_climate.py`, `verify_climate.py`, `40_curves.py`, `verify_curves.py`, `50_timescale.py`,
`verify_timescale.py`) with the pinned venv; two full builds gave byte-identical `data/`, fragments
and work files (`shasum -a 256` lists compared with `cmp`).

1. **What is averaged** (§6): the files provide monthly means (12 per file) and five 20-year windows
   (M1–M5); the annual mean is the mean of the 12 months, then of the five. Each member's `history`
   attribute is asserted to be the k-th 240-month window of the last 1,200 months of the run whose
   PUMA ID is in the sheet's column P, so the join experiment → file → run is checked, not assumed.
2. **The "modern figure" for the 0 Ma check** is the model's own pre-industrial slice as the design
   stage measured it (14.74 °C, 2.961 mm/day, DECISIONS.md §15 E3), with the contract's bands around it.
   No observed global temperature is in the pinned sources, and a number from memory would break
   §0; the check proves the pipeline reproduces the model, and says so when it prints.
3. **An independent path in `verify_climate.py`**: PhanDA's own float64 `tas` / `pr` copies, found
   by coordinate value. It found that `pr` is in mm per 365-day year (×31,536,000 of the UM rate),
   which the files do not state; step 30 does not read those copies.
4. **Valdes et al. 2021 is cited as the model description** in the `phanda` credits block, with the
   title, authors and pages taken from Crossref (`api.crossref.org/works/10.5194/cp-17-1483-2021`:
   "Deep ocean temperatures through time", Valdes, Scotese & Lunt, Climate of the Past 17,
   1483–1506), not from memory. RESEARCH.md §2.3 gave only the journal, volume and first page.
5. **Curves grid 0 … 750 (751 points), not 0 … 540** (§8): the brief asks for 750 Ma to 0, and the
   slider spans 750 Ma; the extra 210 points are null in every series (10 arrays × 210 × `null,`
   = 10,500 bytes). Chosen over the
   contract's 541 points, which would have made the strip special-case its compressed stretch.
6. **Foster and the model's CO₂ are two series** (`co2_ppm`, `co2_model_ppm`), not one spliced
   array: the brief asks for Foster "null before 420 Ma", and the contract wanted the model's input
   drawn from 420 Ma. Keeping them apart means no array mixes a proxy fit with a model input; the
   strip draws `co2_model_ppm` dashed where `co2_ppm` is null. The tiles keep the contract's
   `kind: proxy_fit | model_input` switch at Foster's last row (419.5039 Ma).
7. **The clip flag** is `lo68_clipped_ma` (grid ages whose value used a clipped native row) plus
   `clipped_lo68_rows`; both are empty/0 for this file. A per-point boolean array would add 751
   values to say nothing.
8. **Sea level's MIN and MAX are shipped as published**, with `min_above_max_ma` and
   `avg_outside_band_ma` and a `band_rule` telling the app to draw between the lower and higher of
   the two. Chosen over reordering them (an adaptation the source does not ask for) and over
   shipping only AVG (the band is what makes the uncertainty visible).
9. **Land and shelf % come from the PaleoDEMs inside step 40**, through `geo.paleodem_land_shelf()`,
   because step 35 does not exist yet; step 35 must call the same function so the curves, the tiles
   and `elevation.json` cannot disagree (`verify_data.py` should compare them once 35 exists).
   *Measured*: 27.598 % land and 5.757 % shelf at 0 Ma; land 14.276–36.517 %, shelf 1.267–13.919 %.
10. **Tiles are written by step 40** to `tools/work/tiles.json` (the design's pipeline table), with
    full float precision; step 80 copies and rounds them. Map 88 (542 Ma) has no sea-level tile
    (van der Meer ends at 540) and takes the model's 540 Ma CO₂; maps 90, 92 and 93 have no
    temperature, CO₂ or land tile.
11. **Boundary notes quote the chart's own numerals** ("66.00", "143.1 ± 0.6", "251.902 ± 0.024"),
    so the chart's precision survives; the float in `ics_ma` is for arithmetic.
12. **The boundary table is explicit** (`BOUNDARY_UNIT` in `50_timescale.py`, one entry per Table 1
    interval text); an interval containing "oundary" that is not in the table fails the step. "KT"
    maps to the Paleogene (the younger side of the Cretaceous/Tertiary boundary in today's chart).
    A label naming a sub-period (Pennsylvanian, Mississippian) is compared at the sub-period, which
    is why map 61 (323.2 Ma, "Late Mississippian") gets a note: the chart's Pennsylvanian begins at
    323.4 ± 0.4.
13. **`ics` also carries `eon` and `era`** (§1), for the period card's context line; each is one id.
14. **The chart's two inconsistencies ship as given** (`quirks`, §9), never corrected: correcting
    them would be an adaptation the ICS did not make, and no map age falls inside either.
15. **The reference list's differences are pinned, not waved through**: `verify_timescale.py` accepts
    a period begin that differs from the brief's list beyond the chart's uncertainty only when the
    chart gives exactly the listed numeral (Cretaceous 143.1, Neogene 23.04), so a parse error or an
    unexpected chart change still fails.
16. **Shared code added, nothing changed**: `tools/xlsx.py` (the zipfile + ElementTree reader
    RESEARCH §1 promised; no xlsx package), `common.write_fragment()` and `common.write_work()` (the
    format steps 10 and 20 write inline), `geo.DEM_EDGES` and `geo.paleodem_land_shelf()`.
    `10_surface.py` and `20_plates.py` were not edited; after both builds their outputs have exactly
    the sizes their builder measured (`plates.bin` 463,644, `coast.bin` 276,896, `places.json`
    35,615, `manifest.json` 18,282, the 90 maps and the proxy 5,182,526 together).

## 17. Builder's decisions (steps 60 and 90, 2026-09-30)

Where this contract, `../DESIGN.md` or the build brief was silent or disagreed, the builder of steps 60
and 90 decided the following. Every number was printed by `build_all.sh` (`60_story.py`,
`verify_story.py`, `90_about.py`) with the pinned venv; two full builds gave byte-identical `data/`
and `../CREDITS.txt` (`shasum -a 256` over both trees, compared with `cmp`).

1. **`story.yaml` lives at `tools/content/story.yaml`** (§10 and DESIGN §11), not at the app's root
   `content/` the build brief named: a root folder ships inside the ZIP (`build-zips.yml` excludes
   `tools/`, not `content/`), and the YAML's reviewer notes (`evidence`, `placement`) are not for
   phones.
2. **15 cards, not 16.** `card_periods` holds the 15 Periods that contain a map's age (the Ediacaran,
   Cryogenian and Tonian among them); the prologue is the sixteenth card.
3. **Every numeral is mapped to a source** (§10 as built): the step extracts ASCII numerals from each
   text, title, label and `when` and requires each to be a key of the item's `numbers`, crediting a
   source the item lists; unused keys fail too. An ICS-credited numeral must equal a chart begin, end
   or uncertainty at the precision written (so "539" passes as 538.8 rounded); an atlas-credited one
   must be a map number or a Table 1 age (in Ma or years) or be explained in `measured`. Negative
   controls were run by hand: an unsourced "3 degrees", an age outside its period, 445.0 for the
   Hirnantian's 445.2, plate 9999, a 92-word card and a vendor name each failed with a named error.
4. **Every citation was checked against Crossref**, and the statement used was read from the paper's
   abstract (Crossref, OpenAlex, Europe PMC), its title, or its open full text; `evidence` in the YAML
   says which. Papers whose abstract could not be read were used only for what their title states
   (`rooney2015`, `bondwignall2008`, `hu2016`, `hildebrand1991`). `renne2013`'s statement is from the
   article's editor summary as indexed with it. No encyclopaedia was used.
5. **Map statements are measured, not described from memory**: 13 claims (e.g. "the 690 Ma map paints
   no ice", "almost all land lies south of the equator on the Cambrian maps", "Gondwana over the South
   Pole at 388.2 Ma") are re-measured on every build on the shipped 1024 × 512 maps (land = not "blue >
   max(red, green)", white = every channel above 200, cos-latitude weights) and with pygplates, and
   fail the step if they stop holding. Six statements (the Permian bay, the Jurassic Atlantic, the
   South Atlantic, the 80.3 Ma seaway, India an island, Euramerica side by side) were checked by eye
   and are printed as such.
6. **"White", not "ice"**: the atlas's colour key (PDF pp. 7–8) says white is "the highest peaks";
   the cards say what is painted and leave "ice" to the cited papers.
7. **Pins**: 17, each partitioned exactly as `places.json` (polygons valid at 0 Ma); the claimed plate
   must match, the crust must be carried back over the whole window, and the point must lie on Natural
   Earth 1:50m land. Namibia (plate 701, carried back only to 600 Ma) cannot hold a Cryogenian pin, so
   the snowball rocks are pinned in the Yukon (plate 124), which the model holds back to 4,500 Ma and
   puts at 9° S to 15° N at 690–750 Ma — near the equator, as the source says. No "Tethys shoreline"
   pin: no paper in hand places one, and ocean names are cut (DESIGN §14).
8. **Events dated by the chart** carry `boundary` or `ics_unit`, and their `age_ma` and `age_unc_ma`
   must equal that unit's begin exactly. Events with a range (the first forests, 393–383 Ma; the Last
   Glacial Maximum, 26,500 to 19,000–20,000 years ago, taken as 26.5–19.5 ka) store the midpoint and
   half-width and print the range through `when`. Two events share 330.3 Ma (the coal forests and
   Pangaea's assembly both start in the Serpukhovian).
9. **Contested points are stated, not settled**: the Cambrian base (542 in the atlas, 538.8 ± 0.6 in
   the chart, 538.6–538.8 in Namibia), end-Permian species losses (about 81% against more than 90%)
   and its killing mechanism, the Deccan Traps' share in the end-Cretaceous extinction, the onset of
   the India–Asia collision, the snowball-Earth hypothesis, the age of the Isthmus of Panama, and the
   weakness of the Late Devonian signal in Raup and Sepkoski's counts.
10. **The longitude caveat is pinned** to van Hinsbergen et al. 2015 (open full text, CC BY); the
    "one reconstruction" caveat cites Domeier & Torsvik 2014. Both are in `about.json.references`,
    since neither is a data source.
11. **The ocean-floor caveat's numbers are measured by partition**, not by summing ring areas: the
    1° cell centres, cos-weighted, partitioned as places are — 62.7% of the globe is crust the model
    holds only for today, 99.8% of it under today's oceans. Summed ring areas give 63.7% because
    outlines overlap.
12. **Merging fragments** (§15.6): blocks with one id are merged in step order; licence and licence
    URI must agree; sources, URLs and accuracy notes are joined without repeats; adaptations are
    labelled with their part when a source has several; the longest cite wins. Gough (1981) comes from
    `sources.CITED`. A fragment with an id outside §11's list, or a retrieval date other than
    `RETRIEVED`, stops the step.
13. **`attribution`** is a new field per source: the credit line each licence asks for, with what this
    app changed ("resized and recompressed", "averaged … rounded to one byte", "interpolated").
    CREDITS.txt adds a "References for the text" list (44 papers plus Domeier & Torsvik) and a
    software line read from `requirements.txt`.
14. **90_about runs before 35 and 80 exist.** It reads the fragments present (surface, plates,
    climate, curves, timescale); when step 35 adds a `paleodem` part, the merge picks it up. Rerun it
    after 35 and 80 are built.

## 18. Builder's decisions (steps 35, 80, verify_data)

Where this contract, `../DESIGN.md` or the build brief was silent or disagreed, the builder of steps 35
and 80 and of `verify_data.py` decided the following. Every number was printed by `build_all.sh`
(`35_elevation.py`, `verify_elevation.py`, `80_manifest.py`, `verify_manifest.py`, `90_about.py`,
`verify_data.py --cross-only`) with the pinned venv; two full builds from the cache gave byte-identical
`data/`, `../CREDITS.txt` and credits fragments (`shasum -a 256` over 112 files, the two lists diffed:
no difference) and identical logs.

1. **Nothing about the classes is typed from memory.** Step 35 parses Table 2 from the atlas PDF (p.
   42, in the pinned atlas zip, read with pypdf) and stops unless its edges equal `geo.DEM_EDGES`; it
   also stops unless the pinned report `Scotese_Wright2018_PALEOMAP_PaleoDEMs.pdf` says "The paleoDEMS
   provided with this report are a “first draft”" on p. 7, the page `about.json`'s caveat quotes.
2. **Class names**: Table 2 names environments ("Collisional mountains", "Delta tops"); DESIGN §8 asks
   for the class "named by depth or height, not by environment", so the names are §7's table, with
   the ranges converted to feet by a stated rule (to 100 ft from 1,000 ft up, else to 10 ft), which
   reproduces §7's figures exactly. `name` holds the bare class for the readout line.
3. **The land tile is `elevation.json`'s value**, as §1 says, not step 40's copy: step 80 asserts the
   two agree to elevation.json's 4 decimals for all 87 maps with a slice (one function made both).
4. **The manifest's tiles are compacted to fit the 60,000-byte budget.** Assembled as §1 first
   described them, the manifest measured 73,692 bytes even with the tiles rounded; the fields that
   repeat what the slice already says (`slice_age_ma`, `dem_age_ma`, `at_ma`, `source`, 87–90 copies
   each) and `today_ppm` (the same two numbers 87 times) were moved into one `tile_rules` block and
   `units` (§1 as built). Step 80 asserts, map by map, that every dropped value equals what
   `tile_rules` or `units` says, so nothing is lost. *Measured*: 59,665 bytes — **335 bytes under the
   cap**; any new per-slice field needs a budget decision first. Chosen over raising the budget (the
   brief fixes it) and over dropping contract fields that carry meaning (`climate_age_ma`,
   `elevation_age_ma`, the `ics` block).
5. **Tile precision**: temperature and land/shelf to 2 decimals (the sheet prints 0.1 °F and 0.1 %),
   CO₂ and sea level to 1 decimal (it prints whole ppm and feet); `units` is rounded the same way, so
   a tile and its "today" have equal precision. The unrounded values stay in `climate.json`,
   `elevation.json` (4 decimals) and `curves.json` (3).
6. **Foster's switch age is not shipped as a number** in `tile_rules`: `curves.json` keeps 3 decimals
   (419.504) where his last row is 419.5039; the rule names the field instead, and step 80 asserts
   no map age lies between the two. Each tile's `kind` is the per-map answer.
7. **Step 80 reads step 10's top-level blocks from `data/manifest.json`** (only the keys step 10 owns:
   `schema`, `count`, `retrieved`, `surface`, `proxy`, `axis`) and the per-slice fields from
   `work/surface.json`, asserting the two agree and match `slices.csv`. Re-running step 80 therefore
   gives the same file (checked: two runs, same sha256). Chosen over copying step 10's constants.
8. **`verify_manifest.py` is new** (the brief asks for a verify of step 80; §14 had none). Its checks
   are independent of step 80: ICS units re-found from `timescale.json`, matches recomputed, CO₂ and
   sea level re-read from the two spreadsheets.
9. **`verify_data.py --cross-only`** in `build_all.sh`: each step's verify runs right after its step
   (fail fast), so the final call skips re-running them; `verify_data.py` without the flag runs all
   eight verify scripts first, as §14 says. Negative controls run by hand on a copy of `data/`
   (`EARTHHISTORY_DATA`): a stray file, a missing `elevation.json`, a place with a wrong plate index,
   `curves.json` land off by 0.01, and `elevation.bin` 1,000 bytes long each failed with a named
   message; one changed byte in `elevation.bin` failed `verify_elevation.py` ("1 shipped bytes differ
   from the raw grids"), and a land tile off by 0.01 failed `verify_manifest.py`.
10. **A stray `.DS_Store` in `data/` fails the build**, as §0's "fails on a stray file" says, even
    though `build-zips.yml` would leave it out of the ZIP. Delete it and rerun.
11. **The PaleoDEM report is credited** (the verifier's finding): the `paleodem` block's source now
    names `Scotese_Wright2018_PALEOMAP_PaleoDEMs.pdf` with its sha256, what it was read for and the
    page, and its URL. To keep CREDITS.txt from repeating the zip's sentence and URL, a fragment's
    `source` and `url` may now be lists, which `90_about.py` merges item by item (§0); step 35's first
    item is word for word step 40's sentence. The attribution line (`CHANGES` in `90_about.py`) now
    also says the grid points were sorted into Scotese's classes.
12. **The coordinates in the PaleoDEM files are float64 within 2.1e−11 of whole degrees**, not exact;
    step 35 selects rows and columns by index (row `180 − 2r`, column `2c`), and `verify_elevation.py`
    finds every node by its coordinate within 1e−6 and re-derives every byte: 0 mismatches.
13. **Two things the app builder should know.** (a) The readout's class 4 is "shallow sea" (under 50
    m), while the Land tile's second line and `curves.json`'s `shelf_pct` are "shallow sea" in the
    wider sense of codes 3–4 (0–200 m deep, §7) — label the tile "shallow sea (0–200 m deep)" or
    "shelf seas" so the two do not read as one number. (b) `climate` and `elevation` are always the
    same index, and `climate_age_ma` equals `elevation_age_ma` (asserted); both are shipped because the
    sheet prints both parts.
