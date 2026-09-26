# Research: sources, licences and decisions for Shelf Atlas and World Oil & Gas

Two Snuggery apps built from one pipeline (`scripts/shelf_atlas/`):

| app | folder | what | refresh |
| --- | --- | --- | --- |
| **Shelf Atlas** | `shelf-atlas/` | North Sea detail: field outlines, platforms, pipelines, median lines; monthly production per field from January 1971 | weekly Action (`build-shelf-atlas.yml`) |
| **World Oil & Gas** | `world-oil-gas/` | world map: country choropleth of annual oil and gas production 1900→, field points from GOGET | yearly Action (`build-world-oil-gas.yml`) for countries; manual drop-in for GOGET |

Everything below was verified on 2026-09-26 by fetching the sources from a GitHub runner (the
development sandbox could not reach any of the national data hosts, so the probe workflow
`probe-shelf-atlas.yml` was written first and every URL and column name here comes from its
logs, not from memory).

---

## 1. Decisions

### One app or two?
**Two.** The task asked for one app with two tiers and then asked whether two would be better. Two is
better here, for three reasons that are all about the phone:

- **Size and load time.** The North Sea bundle is ~2 MB of geometry and packed monthly series that
  must be decoded on open; the world bundle is ~0.5 MB (plus GOGET, ~1 MB when dropped in). A user
  who opens the world map should not pay for 700 months of North Sea series, and vice versa.
- **Different refresh cadence and different data hops.** The North Sea files change weekly; the
  world files change once a year (and GOGET by hand). One app would mean one Shortcut row
  rewriting a 2 MB file weekly for a map whose world half never changed.
- **Different interaction.** Monthly scrubbing over ~1,000 polygons and yearly scrubbing over 177
  countries want different rendering budgets and different chrome; forcing a zoom-level switch
  between them adds a mode nobody asked for. The world app's field points for the North Sea will,
  once GOGET is dropped in, sit exactly where Shelf Atlas draws its outlines.

Trade-off accepted: no "zoom in and it switches" moment. The world app instead carries a
"North Sea in detail: open Shelf Atlas" hint on its About screen.

### Rendering: Canvas 2D, no map library
Canvas 2D with our own Web Mercator, exactly as the repository's Global Wind and Global Weather do.
Rejected: **SVG** (a thousand field polygons plus thousands of facility points, recoloured every
frame while scrubbing, is too many DOM nodes for a phone), and **a vendored map library** (MapLibre
needs WebGL and style/tile plumbing that serves nothing here; Leaflet is DOM/SVG and adds ~150 KB for
pan/zoom we already have in the repo's own code). Geometry is decoded once into typed arrays and
Path2D objects; a month change is a recolour, never a rebuild.

### Geometry simplification and size budget
No mapshaper and no GDAL: a **Visvalingam–Whyatt** implementation in `common.py` with a threshold in
square metres (lat-aware), so a field outline is simplified the same way at 52°N and 62°N. Thresholds:
coast/land/bathymetry 8,000 m², field outlines 2,500 m², pipelines 6,000 m². Pipeline pieces under
3 km (risers, spools, jumpers) are dropped, as are umbilicals, cables and control lines, and UK
pipelines whose fluid is not a hydrocarbon (seawater, chemicals). Coordinates are packed with Google's
polyline encoding at four decimals (~6–11 m). Budgets enforced by the build: `geo.json` ≤ 2.0 MB,
`snapshot.json` ≤ 2.5 MB. The basemap alone (10 m Natural Earth clipped to the box) is 109 KB.

Bathymetry: Natural Earth's 200 m polygons (public domain, 2.5 KB packed) rather than EMODnet or
GEBCO. They show the one feature that matters at this scale, the Norwegian Trench; a real DEM would
cost megabytes for shading nobody can read on a phone.

### Units
Internal: **Sm³ per month** for liquids (oil + condensate + NGL) and for gas, plus Sodir's
oil-equivalent convention (1 Sm³ liquids = 1 Sm³ o.e.; 1000 Sm³ gas = 1 Sm³ o.e.). Every source is
converted to that on the way in:

| source | liquids | gas |
| --- | --- | --- |
| Sodir | million Sm³ (oil, NGL, condensate separately) | billion Sm³ |
| NSTA PPRS | m³ (`OILPRODM3`, `GCONDVOL`) | thousand Sm³ (`AGASPROKSM` + `DGASPROKSM`, associated + dry gas) |
| Danish Energy Agency | thousand m³ (yearly) / M m³ (monthly) | million Nm³ |
| NLOG | see §2.4 | see §2.4 |

Display: **Sm³/d or bbl/d** (liquids, ×6.2898), **Sm³/d or scf/d** (gas), **Sm³ o.e./d or boe/d**
(total), one toggle, persisted. Monthly volumes are divided by the days in that month.

World app: OWID gives production in TWh. Shown as **energy-equivalent kboe/d** (1 boe = 5.8 MMBtu =
6.1178632 GJ, the Energy Institute's own factor; 1 TWh = 588,441 boe) or TWh/yr. These are not
measured barrels: the EI's oil figure is tonnes-based, so a country with light crude shows slightly
fewer boe than its reported bbl/d. The app says so in About. GOGET's own million bbl/y and million
m³/y are converted to bbl/d and to boe/d at 159 Sm³ per boe (Sodir's 1000:1 o.e. rule times 6.29).

### Field-name matching across sources
Names are normalised to upper-case letters and digits (`STATFJORD ØST` → `STATFJORDOST`). A name
appearing in two regulators' data is a **candidate** cross-border unit. It becomes a **group** only
if listed in `CROSS_BORDER` in `build_north_sea.py`, which also carries the published national
shares (Statfjord 85.47/14.53, Frigg 60.82/39.18, Murchison 22.2/77.8, Blane, Enoch, Playfair,
Markham). Each member keeps its own series (each regulator reports its national share only), the app
colours each member by its own share and the field sheet shows the summed unit. Candidates that are
not confirmed are listed under `snapshot.matching.crossBorderCandidates` and drawn separately.
Fields dropped for lack of any geometry are listed by name in `snapshot.matching.dropped`; nothing
is dropped silently.

GOGET names are not matched to regulator names at all: the world app shows GOGET as GOGET, with
its own ids, and the North Sea app shows the regulators' data. Reconciling the two catalogues is a
research project (GOGET units are often unitised areas, licences or "complexes"), and a bad merge
would be worse than two honest layers.

### Refresh cadence
| what | cadence | why |
| --- | --- | --- |
| Shelf Atlas (all four regulators + basemap) | weekly, Monday morning | Sodir syncs daily but monthly production lands once a month; NSTA PPRS monthly; the Danish report monthly; NLOG monthly — a week is the shortest interval at which any of them can have changed |
| World countries (OWID) | yearly, plus manual dispatch | the Energy Institute publishes once a year (June); OWID follows within weeks |
| GOGET | manual | behind a form; see HANDOFF.md |

### Cross-border median lines
From Marine Regions (VLIZ) v12, filtered to lines whose two territories are both among Norway, UK,
Denmark, Netherlands, Germany, Belgium, Sweden, Faroe (43 lines, with `line_type` — Treaty, median
line, joint regime). Neither Sodir's nor NSTA's public layers carry a clean boundary line.

---

## 2. Sources

### 2.1 Norway — Sodir (Norwegian Offshore Directorate / Sokkeldirektoratet)
- **FactPages CSV exports**, the same SSRS endpoint the site's CSV buttons call, e.g.
  `https://factpages.sodir.no/public?/Factpages/external/tableview/field_production_monthly&rs:Command=Render&rc:Toolbar=false&rc:Parameters=f&IpAddress=not_used&CultureCode=en&rs:Format=CSV&Top100=false`
  Tables used: `field` (144 rows; `fldName, cmpLongName, fldCurrentActivitySatus, fldHcType, fldNpdidField, wlbCompletionDate, fldFactPageUrl…`),
  `field_production_monthly` (28,456 rows, from 1971; `prfInformationCarrier, prfYear, prfMonth, prfPrdOilNetMillSm3, prfPrdGasNetBillSm3, prfPrdNGLNetMillSm3, prfPrdCondensateNetMillSm3, prfPrdOeNetMillSm3, prfNpdidInformationCarrier`),
  `field_activity_status_hst`, `field_operator_hst`, `discovery` (for discovery year), `facility_fixed` (not needed; the shapefile has it).
  Tables that do **not** exist: `pipeline`, `tuf_petroleum_pipeline` (HTTP 500).
- **Shapefiles** at `https://factpages.sodir.no/downloads/shape/{fldArea,fclPoint,pipLine}.zip` (the directory itself is 403).
  All are **ED50 geographic** (`GCS_European_1950`), shifted to WGS84 in the pipeline with the
  EPSG:1133 three-parameter transformation (−87, −98, −121 m). `fldArea` 142 polygons
  (`idField, fieldName, curActStat, discYear, OpLongName…`); `fclPoint` 1,229 points (`facName,
  facKind, phaseName, surface, dtStartup, yrShutdown, yrRemoved, belong2nm…`); `pipLine` 83 main
  lines (`pipName, medium, dimension, curPhase, fromFacili, toFacility…`). `dscArea` and `blkArea`
  exist too (not used); `prlArea` is 404.
- **FactMaps** REST/WFS at `factmaps.sodir.no` (WGS84 service, 97 feature types) works and is the
  alternative if the shapefile downloads move; not used because the shapefiles are one request each.
- **Licence: NLOD 2.0** (Norwegian Licence for Open Government Data). Required attribution:
  *"Contains data under the Norwegian licence for Open Government data (NLOD) distributed by the
  Norwegian Offshore Directorate."* Changes must be indicated (they are: datum shift, simplification,
  unit conversion).
- **Cadence:** FactPages sync daily; monthly production is complete about a month after month end.
- **Quirk:** cross-border fields carry the Norwegian share only (Statfjord 85.47 %).

### 2.2 United Kingdom — NSTA (North Sea Transition Authority)
- The old `data.nstauthority.co.uk` ArcGIS server **no longer resolves in DNS** and the old hub
  (`opendata-nstauthority.hub.arcgis.com`) search API returns global ArcGIS results. NSTA's data now
  lives in ArcGIS Online organisation `OZMfUznmLTnWccBc`:
  `https://services-eu1.arcgis.com/OZMfUznmLTnWccBc/arcgis/rest/services` (listing works with `?f=pjson`),
  hub at `https://open-data-ukcs-transition.hub.arcgis.com/`.
- Layers used (all WGS84; the layer id inside a service is read at build time because NSTA
  republishes them with dated names and the id has been 0 or 1):
  - `Offshore_hydrocarbon_fields_(WGS84)` — 478 polygons: `FIELDNAME, FIELDTYPE, STATUS, DISC_DATE (1975/04), PROD_DATE, CURR_OPER, DET_STATUS…`
  - `UKCS_hydrocarbon_field_production_reports_PPRS_points_(WGS84)` — **135,570 field-months, 1975-06 → 2026-06**, one point per field-month:
    `FIELDNAME, LOCATION (Offshore/Onshore), ORGGRPNM, PERIODYR, PERIODMNTH, OILPRODM3, OILPRODMBD, AGASPROKSM, DGASPROKSM, GCONDVOL, GASFLARVOL, WATPRODVOL…`.
    Paged 2,000 rows at a time with `resultOffset` (68 requests, ~25 MB). Onshore fields are skipped.
  - `UKCS_offshore_infrastructure_pipeline_linear_(WGS84)` layer 1 — 9,025 segments: `PIPE_NAME, INF_TYPE, FLUID, STATUS, DIAMETERMM, LENGTH_M, START_DATE, END_DATE, REP_GROUP…`
  - `UKCS offshore infrastructure surface points WGS84` layer 1 — 309 surface structures: `NAME, INF_TYPE (FPSO, PLATFORM…), STATUS, REP_GROUP, START_DATE, END_DATE, PIPE_SYS`
  - `UKCS_offshore_infrastructure_subsea_points_(WGS84)` layer 1 — 20,004 points (every wellhead and PLET); the build keeps manifolds, templates and production systems only.
  - Not used: `Offshore_petroleum_fields_daily_production_(WGS84)` (40 fields with daily data as zipped downloads), `SDC_infrastructure_*` (decommissioning survey, 567 pipelines / 6,724 points, a subset).
- **Licence: NSTA Open User Licence** (the "North Sea Transition Authority User Agreement", June
  2023, `https://www.nstauthority.co.uk/media/u51lhvio/nsta-user-agreeement-june-2023.pdf`).
  Worldwide, royalty-free, perpetual: copy, publish, distribute, transmit, adapt, and *"exploit the
  Information non-commercially"*. Required attribution: *"Contains information provided by the North
  Sea Transition Authority and/or other third parties."* Some layers are additionally marked Open
  Government Licence. **Read this as: fine for this app and for a public repository; not a licence
  to sell a product built on it.** Noted in LICENSE.
- **Cadence:** PPRS about two months in arrears; GIS layers as republished (layer names carry the date).

### 2.3 Denmark — Danish Energy Agency (Energistyrelsen) and GEUS
- The English `ens.dk/en/our-services/...` addresses in the brief are gone (404, "Ups, der gik
  strømmen"). Current pages:
  - `https://ens.dk/en/energy-sources/monthly-and-yearly-production` — the **yearly workbook**
    (link text "1972-2025", `/media/7167/download`, one sheet; column A blocks: *Oil, thousand cubic
    meters* → Production → one row per field (Dan, Gorm, Skjold, Tyra, Rolf, Kraka, Dagmar, Regnar,
    Valdemar, Roar, Svend, Harald, Lulita, Halfdan, Siri, Syd Arne, Tyra Se, Cecilie, Nini, Ravn,
    Solsort) → Total; *Gas, million normal cubic meters* → the same; then Export / Fuel / Flare /
    Injection / Water), and the **monthly reports**: HTML pages from January 2018
    (`/sites/default/files/OlieGas/[HTM_GIF/]mpYYYYMMsi[_0].htm`) and PDFs from January 2024
    (`/media/NNNN/download`). Two lists on the page: SI units first, then barrels; the pipeline takes
    the first link per month. Each report is a text table: *Oil, M m³ … Field Monthly Daily Avg. …
    Dan 66.0 2.1 …*, parsed with the field list from the workbook (names sorted longest first, so
    "Tyra SE" is not "Tyra").
  - `https://ens.dk/en/energy-sources/oil-and-gas-related-data/shape-files-oil-and-gas-maps` —
    "Shape file with field delineations" (`/media/7661/download`, 34 records, **ED50 / UTM 31N**,
    `Field, Label, EndDate, DepthLimit`), "Shape file with Offshore Installations"
    (`/media/4907/download`, 66 records). The UTM inverse and the datum shift are in the pipeline.
  - **GEUS WFS** `https://data.geus.dk/geusmap/ows/4326.jsp?...&TYPENAME=ens_platform&outputformat=geojson`
    — 66 platforms in WGS84 with `platform_name, operator_name, platform_type_name, category_name,
    function_name, start_using_year, primary_production, status_name, water_depth` (the Agency's own
    installations list, richer than the shapefile). `ens_flight_safety` is the only other `ens_` layer.
- **Before 2018 there is no monthly per-field series**; the pipeline spreads each year's total
  evenly over its twelve months and sets `monthlyFrom` on every Danish field so the app can say so.
- **Pipelines: none.** The Agency publishes no pipeline geometry, GEUS has none, and EMODnet's
  Danish pipelines are five onshore heating lines. Known gap (see HANDOFF.md).
- **Licence:** the data pages carry no licence statement at all. The Agency is a public authority
  and this is statutory reporting under the Danish Subsoil Act, reusable under the Danish PSI Act
  (lov om videreanvendelse af den offentlige sektors informationer). Treated as free to reuse with
  attribution ("Danish field data: Danish Energy Agency"); flagged as an assumption in LICENSE.
- **Cadence:** monthly report about six weeks after month end; the workbook each spring.

### 2.4 Netherlands — NLOG (TNO)
- Geometry from NLOG's **WFS** at `https://www.gdngeoservices.nl/geoserver/nlog/ows` (7 types):
  `nlog:gdw_ng_field_utm` — 567 field polygons (`FIELD_CODE, FIELD_NAME, HYDROCARBON_MINERAL,
  STATUS, STATUS_DESCRIPTION, OPERATOR, DISCOVERY_WELL, DISCOVERY_YEAR, PRODUCTION_START, LANDSEA, URL`),
  `nlog:GDW_NG_FACILITY_UTM` — 655 facilities (`FACILITY_NAME, FACILITY_CODE, FACILITY_TYPE_DESCRIPTION,
  OPERATOR, STATUS_DESCRIPTION`). Requested with `srsName=EPSG:4326`.
- **Production** is only in the **datacenter**, an Angular app (`https://www.nlog.nl/datacenter/`).
  Its bundle (`main-*.js`, `URL_PREFIX="/nlog-mapviewer"`) calls
  `POST https://www.nlog.nl/nlog-mapviewer/rest/prodfigures/field` with a JSON body
  `{"yearStart": 2024, "yearEnd": 2024, "product": "Gas"|"Oil"|"Condensate", "production": "Produced"}`
  (optional `name`, `location`), and gets one row per field and year with the twelve months and a
  total; an unknown key is rejected with HTTP 400 naming it. `.../field-export?lang=en` returns the
  same as an Excel file. **The year picker starts at 2003**, so Dutch series start in 2003; the
  "Release annual report" workbooks on `/en/fields` cover 2003–2016 only and add nothing. Gas is in
  1000 Nm³ (converted ×1.0549 to Sm³), oil and condensate in Sm³. `nlog_production.py` checks the
  national gas total for the last full year against 2–120 bcm and stops if the unit assumption is
  wrong. `/rest/field/fields` (608 rows) is the datacenter's own field list, not needed.
- **Pipelines:** NLOG's WFS has none; **EMODnet Human Activities** `emodnet:pipelines` filtered
  `country_co='NL'` gives 461 lines with `medium, status, operator, size_in, from_loc, to_loc`.
- **Licence:** NLOG's disclaimer: *"NLOG.NL does not claim any rights (except domain names,
  trademark rights, patents and other intellectual property rights) in respect of information
  provided on or through this site"* — public information under the Mining Act. No formal open
  licence; attribution given.
- **Cadence:** monthly figures published within about two months.

### 2.5 World — countries
- **Our World in Data, energy dataset**: `https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv`
  (9.2 MB; `country, year, iso_code, oil_production, gas_production` in TWh; 1900 → 2024 for 216
  countries with ISO codes; aggregates like `OWID_WRL` for the world). Sources inside: Energy
  Institute Statistical Review of World Energy (2025 edition) and The Shift Data Portal for years
  before 1965. **CC BY 4.0.** Chosen over the EI's own CSV (URL changes every edition, terms are the
  EI's own) and over the EIA API (needs a key). Refreshed yearly.
- **Natural Earth 1:110m countries** (public domain) from the `nvkelso/natural-earth-vector` GitHub
  mirror; ISO_A3 is `-99` for France, Norway, Kosovo and a few others, mapped explicitly.

### 2.6 World — fields: Global Energy Monitor, GOGET
- `https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/` — newest release
  **March 2026** (per GEM's recommended citation). Download is an `.xlsx` behind a form; **CC BY 4.0**.
  It cannot be fetched by a job, so `world-oil-gas/raw/manual/` is the drop-in folder and the
  yearly build reads whatever GOGET workbook is there. The parser matches columns by name with
  aliases (Unit ID, Unit name, Country, Latitude, Longitude, Status, Fuel type, Unit type, Operator,
  Discovery year, Production start year, Wiki URL, Production - Oil (million bbl/y), Production -
  Gas (million m³/y), Production year) and **fails with the headers it found** rather than guessing.
  Until a workbook is dropped in, `fields.json` says `available: false` and the app says why.

### 2.7 Basemap and boundaries
- **Natural Earth 1:10m** coastline, admin-0 countries, bathymetry 200 m — public domain.
- **Marine Regions, Maritime Boundaries v12** (Flanders Marine Institute, 2023), WFS
  `https://geo.vliz.be/geoserver/MarineRegions/wfs`, type `MarineRegions:eez_boundaries`, CQL on
  `territory1`/`territory2` (lower-case; the upper-case names in older docs are rejected). **CC BY
  4.0**, citation "Flanders Marine Institute (2023). Maritime Boundaries Geodatabase, version 12."
- **EMODnet Human Activities** `https://ows.emodnet-humanactivities.eu/wfs` — pipelines (3,951
  Europe-wide: NL 461, NO 63, DK 5 (onshore), GB 0) and platforms (1,617). Used for the Netherlands
  only. EMODnet data is free to use with attribution (CC BY 4.0 per the portal's terms; the terms
  page itself is behind a login on the portal).

---

## 3. What did not work
- **Every data host is blocked from the development sandbox** (egress policy). All fetching, and
  every schema above, went through the probe workflow on a GitHub runner. The pipeline was
  developed against those logs and run in Actions.
- `factpages.sodir.no/downloads/shape/` directory listing: 403 (files under it download fine).
- Sodir SSRS tables `pipeline`, `tuf_petroleum_pipeline`: HTTP 500 — the pipelines are in the shapefile only.
- `data.nstauthority.co.uk`: DNS gone. `open-data-ukcs-transition.hub.arcgis.com/api/v3/datasets?q=`: global results. The ArcGIS org's services listing is the reliable index.
- NSTA WGS84 infrastructure services: layer id 1, not 0 (`/0` → "layer not found").
- `ens.dk/en/our-services/...` and `ens.dk/en/about-us/copyright`: 404; `data.geus.dk/geusmap/?mapname=oil_gas` WFS on the 25832 endpoint: groundwater layers only; the 4326 endpoint has `ens_platform`.
- NLOG: no download links for production on any page; `/en/search-production` and `/en/oil-and-gas-fields-overview` are 403 for a script; the datacenter is an API-driven app (§2.4).
- Marine Regions CQL with `TERRITORY1` (upper case): "Illegal property name" — property names are lower case.
- EMODnet: no UK pipelines at all, Denmark onshore only.
- GOGET: no scriptable download (form), by design of the source.

---

## 4. Known data gaps (also in HANDOFF.md)
- Denmark: no pipelines; monthly per-field series only from January 2018 (annual spread before).
- Netherlands: production depends on an undocumented API (§2.4); onshore fields (Groningen and
  ~300 small ones) are inside the map box and are drawn — they are labelled by `LANDSEA`.
- UK: PPRS starts in June 1975; fields that produced before that (e.g. Argyll from June 1975 is the
  first) are covered, but the UK series begins four years after Norway's. Subsea points are
  thinned to manifolds/templates.
- Norway: complete from 1971.
- World: OWID lags the Energy Institute by weeks; the 2025 data year arrives with the 2026 edition.
