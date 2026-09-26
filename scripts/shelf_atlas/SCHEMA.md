# Data contract: Shelf Atlas and World Oil & Gas

Two apps, one pipeline (`scripts/shelf_atlas/`). Every file below is written by the pipeline and
read by exactly one app. The apps refuse a file that fails this shape and say so on screen.

Coordinates are WGS84 lon/lat. Lines and rings are packed with Google's polyline algorithm
(lon first, then lat) at the file's `factor` (10000 = four decimals ≈ 6–11 m at 55–62°N;
1000 = three decimals for the world). Rings are closed (last point repeats the first).

Month index `mi` counts months from January 1971: `mi = (year − 1971) × 12 + month − 1`.

## shelf-atlas/data/geo.json — the North Sea basemap and every geometry (rebuilt weekly, rarely changes)

```
{
  "schema": 1,
  "generatedAt": "2026-09-26T18:00:00Z",
  "factor": 10000,
  "bbox": [-6, 50.5, 12, 63],                  // lon0, lat0, lon1, lat1 of the region
  "coast":    ["<polyline>", …],               // Natural Earth 1:10m coastline, clipped to bbox
  "land":     [["<ring>", …], …],              // Natural Earth 1:10m countries, clipped; one array of rings per polygon, outer first
  "bathy200": [["<ring>", …], …],              // Natural Earth 1:10m bathymetry, the 200 m polygons (the Norwegian Trench shows)
  "bathymetry": { "file": "bathy.png",         // EMODnet DTM as an 8-bit grey PNG beside geo.json (optional key)
                  "bounds": [-6, 50.5, 32, 73], "width": 1267, "height": 1725,
                  "rows": "uniform in Web Mercator y between bounds[1] and bounds[3]; columns uniform in longitude",
                  "encoding": "8-bit grey; 0 = land or no data; depth_m = 3000 × (v/255)²",
                  "maxDepth": 3000, "source": "emodnet-bathymetry" },
                                                // draw: project the four corners, one drawImage; tint via a per-theme LUT
  "borders":  [{ "name": "Norway - United Kingdom", "type": "Treaty", "a": "Norway", "b": "United Kingdom",
                 "lines": ["<polyline>", …] }, …],                     // Marine Regions maritime boundaries (median lines)
  "fields":   [{ "id": "NO-43658", "rings": ["<ring>", …] }, …],      // field outlines; a field without one is absent here
  "pipelines":[{ "id": "NO-P1", "country": "NO", "name": "Statpipe", "medium": "Gas", "dimIn": 30,
                 "phase": "In service", "from": "…", "to": "…", "lines": ["<polyline>", …] }, …],
  "facilities":[{ "id": "NO-F271273", "country": "NO", "name": "STATFJORD A", "kind": "CONCRETE STRUCTURE",
                 "surface": true, "phase": "IN SERVICE", "startYear": 1979, "endYear": null,
                 "field": "STATFJORD", "lon": 1.8532, "lat": 61.2545 }, …]
}
```

`country` is one of `NO`, `UK`, `DK`, `NL`. `surface: false` is a subsea structure.

## shelf-atlas/data/snapshot.json — everything that changes with the monthly reports (rebuilt weekly)

```
{
  "schema": 1,
  "generatedAt": "2026-09-26T18:00:00Z",
  "epochYear": 1971,
  "lastMonth": 668,                             // the newest month index with any production
  "units": {
    "liq": "Sm³ per month: oil + condensate + NGL",
    "gas": "Sm³ per month",
    "oe":  "1 Sm³ liquids = 1 Sm³ o.e.; 1000 Sm³ gas = 1 Sm³ o.e.",
    "bblPerSm3": 6.2898
  },
  "series": { "encoding": "base64 of little-endian uint16; value = code × scale; index 0 is month `start`" },
  "sources": [{ "id": "sodir", "name": "…", "url": "…", "licence": "…", "attribution": "…", "cadence": "…" }, …],
  "countries": { "NO": "Norway", "UK": "United Kingdom", "DK": "Denmark", "NL": "Netherlands" },
  "fields": [{
    "id": "NO-43658", "country": "NO", "name": "STATFJORD", "hc": "OIL",
    "status": "Producing",                      // the source's current status, verbatim
    "statusHist": [[mi, "Producing"], …],       // optional: status from month mi onwards (Norway only)
    "operator": "Equinor Energy AS",
    "discYear": 1974, "firstMonth": 106, "lastMonth": 668,
    "url": "https://factpages.sodir.no/…",
    "c": [1.85, 61.25],                         // centroid of the outline, or the source's point
    "group": "STATFJORD",                       // optional: cross-border group id (see groups)
    "share": 85.47,                             // optional: this member's national share of the unit, %
    "monthlyFrom": 564,                         // optional: before this month the values are annual totals spread evenly
    "liq": { "start": 106, "scale": 61.2, "b64": "…" },   // absent when the field never produced liquids
    "gas": { "start": 106, "scale": 3121.7, "b64": "…" },
    "peakLiq": 3400000, "peakGas": 900000000, "cumLiq": 720000000, "cumGas": 88000000000
  }, …],
  "groups": [{ "id": "STATFJORD", "name": "Statfjord", "members": ["NO-43658", "UK-STATFJORD"],
               "note": "Cross-border NO/UK unit; each member carries its national share" }, …],
  "matching": { "note": "…", "crossBorderCandidates": [ … ], "excluded": [ … ] },
  "ask": [{ "country": "Norway", "field": "Statfjord", "operator": "…", "status": "Producing",
            "latestMonth": "2026-07", "liquidsSm3PerDay": 12000, "gasSm3PerDay": 2100000,
            "boePerDay": 88700, "discoveryYear": 1974, "firstProductionYear": 1979 }, …]
}
```

A series is decoded as: `codes = Uint16Array(atob(b64) bytes)`, `value[mi] = codes[mi − start] × scale`
for `start ≤ mi < start + codes.length`, else 0.

## world-oil-gas/data/world.json — Natural Earth 1:110m countries and 1:10m bathymetry (static)

```
{ "schema": 1, "factor": 1000, "encoding": "…", "source": "…",
  "countries": [{ "iso3": "NOR", "name": "Norway", "adm0": "NOR", "c": [17.8, 68.5], "rings": ["<ring>", …] }, …],
  "bathymetry": [{ "depth": 10000, "rings": ["<ring>", …] }, …, { "depth": 200, "rings": [ … ] }] }
```

Bathymetry layers are deepest first; paint each as a filled band over the sea background in that order.

## world-oil-gas/data/snapshot.json — annual production by country (rebuilt yearly)

```
{ "schema": 1, "generatedAt": "…", "app": "World Oil & Gas",
  "units": { "series": "GWh per year (integer)", "boePerTWh": 588441, "note": "…" },
  "years": [1900, 2024],
  "sources": [ … ],
  "world": { "iso3": "OWID_WRL", "name": "World", "y0": 1900, "oil": [ … ], "gas": [ … ] },
  "countries": [{ "iso3": "NOR", "name": "Norway", "y0": 1900, "oil": [GWh|null, …], "gas": [GWh|null, …] }, …],
  "ask": [{ "country": "United States", "iso3": "USA", "year": 2024, "oilGWh": …, "gasGWh": …,
            "oilKboePerDay": 16085.2, "gasKboePerDay": 16653.8 }, …] }
```

`oil[k]` is the value for year `y0 + k`; `null` is "no data", not zero. `countries` includes the
dissolved states `OWID_USS`, `OWID_CZS`, `OWID_YGS` (no outline; listed in `historical`), and
`patched` lists source holes set to null.

## world-oil-gas/data/fields.json — GOGET extraction units (manual drop-in)

```
{ "schema": 1, "available": true|false, "generatedAt": "…",
  "reason": "…",                                    // only when available is false
  "source": { "name": "…", "file": "…", "release": "…", "url": "…", "licence": "CC BY 4.0", "attribution": "…" },
  "units": { "oilBpd": "barrels per day", "gasBoepd": "boe per day at 159 Sm³ per boe" },
  "fields": [{ "id": "G…", "name": "…", "country": "…", "lat": 56.1, "lon": 2.3, "status": "operating",
               "fuel": "oil and gas", "type": "conventional", "operator": "…", "disc": 1974, "start": 1979,
               "wiki": "https://www.gem.wiki/…", "prodYear": 2023, "oilBpd": 12000, "gasBoepd": 30000 }, …] }
```
