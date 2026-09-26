#!/usr/bin/env python3
"""Build the World Oil & Gas app's data files.

    python3 -m scripts.shelf_atlas.build_world --out world-oil-gas/data [--cache DIR] [--offline]

Writes
  world.json     Natural Earth 1:110m countries, packed polylines keyed by ISO 3166-1 alpha-3
  snapshot.json  annual oil and gas production by country, 1900 -> latest, from Our World in
                 Data's energy dataset (which carries the Energy Institute Statistical Review),
                 plus `ask` rows and the source list the app prints on its attribution screen
  fields.json    oil and gas extraction units from Global Energy Monitor's GOGET, IF the
                 spreadsheet has been dropped into world-oil-gas/data-src/manual/ (it sits
                 behind a form, so no job can fetch it); otherwise the file is written with
                 `available: false` and the reason, and the app says so on screen

Nothing here is guessed: a column that is not where this script expects it stops the build
with the columns that were found, so a silent renaming upstream cannot ship an empty map.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import glob
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from scripts.shelf_atlas.common import (BuildError, Cache, b64, centroid, encode_line, log, norm_name,
                                        ring_area_m2, simplify, write_json)

OWID_CSV = "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv"
OWID_CODEBOOK = "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-codebook.csv"
NE_COUNTRIES = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
                "ne_110m_admin_0_countries.geojson")
NE_COUNTRIES_50 = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
                   "ne_50m_admin_0_countries.geojson")

# Energy-equivalence used to turn OWID's terawatt-hours into barrels of oil
# equivalent. EI's own conversion factor: 1 boe = 5.8 million Btu = 6.1178632 GJ.
# So 1 TWh = 3.6e6 GJ / 6.1178632 GJ = 588,441 boe. See RESEARCH.md, "Units".
BOE_PER_TWH = 3.6e6 / 6.1178632
WORLD_FACTOR = 1000          # world.json packed at 3 decimals (~110 m); 1:110m has nothing finer
WORLD_MIN_AREA_M2 = 2.0e7    # Visvalingam threshold: 20 km² triangles, invisible below zoom 6

# Natural Earth's ISO_A3 is -99 for a handful of countries (France, Norway, Kosovo,
# Somaliland, N. Cyprus...) because of a disputed-territory convention. ADM0_A3 is
# always filled; the OWID codes for the awkward ones are mapped here explicitly.
NE_TO_ISO3_FIXES = {"NOR": "NOR", "FRA": "FRA", "KOS": "OWID_KOS", "SOL": "OWID_SML",
                    "CYN": "OWID_CYN", "SDS": "SSD", "PSX": "PSE", "SAH": "ESH"}


def build_world_geometry(cache: Cache):
    raw = cache.get("global/ne_110m_admin_0_countries.geojson", NE_COUNTRIES)
    gj = json.loads(raw.decode("utf-8"))
    countries = []
    for f in gj["features"]:
        p = f["properties"]
        a3 = p.get("ISO_A3_EH") if p.get("ISO_A3_EH") not in (None, "-99") else p.get("ADM0_A3")
        a3 = NE_TO_ISO3_FIXES.get(p.get("ADM0_A3"), a3)
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        rings = []
        for poly in polys:
            outer = [tuple(c) for c in poly[0]]
            outer = simplify(outer, WORLD_MIN_AREA_M2, closed=True)
            if len(outer) >= 4 and ring_area_m2(outer) > 0:
                rings.append(outer)
        if not rings:
            continue
        cx, cy = centroid(rings)
        countries.append({
            "iso3": a3, "name": p.get("NAME") or p.get("ADMIN"), "adm0": p.get("ADM0_A3"),
            "c": [round(cx, 3), round(cy, 3)],
            "rings": [encode_line(r, WORLD_FACTOR) for r in rings],
        })
    countries.sort(key=lambda c: (c["iso3"], c["name"]))
    return {
        "schema": 1,
        "factor": WORLD_FACTOR,
        "encoding": "Google polyline, lon then lat, 3 decimals; rings closed",
        "source": "Natural Earth 1:110m admin-0 countries (public domain), simplified",
        "countries": countries,
    }


def read_owid(cache: Cache):
    raw = cache.get("global/owid-energy-data.csv", OWID_CSV).decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(raw)))
    need = {"country", "year", "iso_code", "oil_production", "gas_production", "population"}
    if not rows or not need <= set(rows[0].keys()):
        raise BuildError(f"OWID columns changed: {sorted(rows[0].keys())[:40] if rows else 'empty'}")
    book = {}
    try:
        cb = cache.get("global/owid-energy-codebook.csv", OWID_CODEBOOK).decode("utf-8-sig")
        for r in csv.DictReader(io.StringIO(cb)):
            book[r["column"]] = r
    except BuildError:
        pass
    return rows, book


def build_countries(rows, book):
    """Per ISO3 country: yearly oil and gas production in GWh (integers), dense from the
    first year with data to the last. Aggregates (World, Europe, OPEC...) have no ISO
    code in OWID except 'OWID_WRL' and friends; the world total is kept, the rest dropped."""
    by = {}
    for r in rows:
        iso = r["iso_code"]
        if not iso:
            continue
        if iso.startswith("OWID_") and iso != "OWID_WRL":
            continue
        try:
            y = int(r["year"])
        except ValueError:
            continue
        o = r["oil_production"]
        g = r["gas_production"]
        if o == "" and g == "":
            continue
        d = by.setdefault(iso, {"name": r["country"], "iso3": iso, "years": {}})
        d["years"][y] = (float(o) if o != "" else None, float(g) if g != "" else None)
    countries = []
    y_min, y_max = 9999, 0
    for iso, d in sorted(by.items()):
        ys = sorted(d["years"])
        if not ys:
            continue
        y0, y1 = ys[0], ys[-1]
        oil = [None] * (y1 - y0 + 1)
        gas = [None] * (y1 - y0 + 1)
        for y, (o, g) in d["years"].items():
            oil[y - y0] = round(o * 1000) if o is not None else None   # TWh -> GWh, integer
            gas[y - y0] = round(g * 1000) if g is not None else None
        countries.append({"iso3": iso, "name": d["name"], "y0": y0, "oil": oil, "gas": gas})
        y_min, y_max = min(y_min, y0), max(y_max, y1)
    src = ""
    if "oil_production" in book:
        src = book["oil_production"].get("source", "")
    return countries, y_min, y_max, src


# --------------------------------------------------------------------------------------------
# GOGET — Global Energy Monitor's Global Oil and Gas Extraction Tracker
# --------------------------------------------------------------------------------------------

GOGET_COLS = {
    # key: regexes tried in order against the lower-cased header. The tracker renames
    # columns between releases; every alias seen so far is listed, and a miss stops the
    # build with the headers that were found so the list can be extended, not guessed at.
    "id": [r"^unit id$", r"^goget id$", r"^id$"],
    "name": [r"^unit name$", r"^name$", r"^unit$"],
    "country": [r"^country$", r"^country/area$", r"^country \(area\)$"],
    "lat": [r"^latitude$", r"^lat$"],
    "lon": [r"^longitude$", r"^lon$", r"^lng$"],
    "status": [r"^status$", r"^unit status$"],
    "fuel": [r"^fuel type$", r"^fuel$", r"^hydrocarbon type$"],
    "type": [r"^unit type$", r"^type$"],
    "operator": [r"^operator$", r"^operator\(s\)$"],
    "disc": [r"^discovery year$", r"^discovery$"],
    "start": [r"^production start year$", r"^start year$", r"^first production year$"],
    "wiki": [r"^wiki url$", r"^wiki$", r"^gem wiki$"],
    "oil": [r"^production - oil.*", r"^oil production.*", r"^production.*oil.*"],
    "gas": [r"^production - gas.*", r"^gas production.*", r"^production.*gas.*"],
    "prod_year": [r"^production year$", r"^year of production.*", r"^data year$"],
}


def _pick(headers, key):
    low = [str(h or "").strip().lower() for h in headers]
    for rx in GOGET_COLS[key]:
        for i, h in enumerate(low):
            if re.match(rx, h):
                return i
    return None


def _num(v):
    if v is None or v == "":
        return None
    try:
        f = float(str(v).replace(",", ""))
        return f if f == f else None
    except ValueError:
        return None


def _year(v):
    m = re.search(r"(18|19|20)\d\d", str(v or ""))
    return int(m.group(0)) if m else None


def read_goget(path: str):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    log(f"  GOGET workbook {os.path.basename(path)}: sheets {wb.sheetnames}")
    main = prod = None
    for name in wb.sheetnames:
        n = name.lower()
        if main is None and ("main" in n or "unit" in n or "data" in n) and "production" not in n:
            main = wb[name]
        if prod is None and "production" in n:
            prod = wb[name]
    if main is None:
        main = wb[wb.sheetnames[0]]
    rows = list(main.iter_rows(values_only=True))
    # header is the first row holding 'Unit ID' or 'Unit name'
    hi = next((i for i, r in enumerate(rows[:10]) if any(re.match(r"^unit (id|name)$", str(c or "").strip().lower()) for c in r)), 0)
    headers = rows[hi]
    col = {k: _pick(headers, k) for k in GOGET_COLS}
    missing = [k for k in ("id", "name", "country", "lat", "lon", "status") if col[k] is None]
    if missing:
        raise BuildError(f"GOGET main sheet lacks {missing}; headers: {[str(h) for h in headers]}")
    units = {}
    for r in rows[hi + 1:]:
        if r is None or col["id"] >= len(r):
            continue
        uid = r[col["id"]]
        if not uid:
            continue
        lat, lon = _num(r[col["lat"]]), _num(r[col["lon"]])
        if lat is None or lon is None:
            continue
        u = {"id": str(uid), "name": str(r[col["name"]] or "").strip(), "country": str(r[col["country"]] or "").strip(),
             "lat": round(lat, 3), "lon": round(lon, 3), "status": str(r[col["status"]] or "").strip()}
        for k in ("fuel", "type", "operator", "wiki"):
            if col[k] is not None and r[col[k]] not in (None, ""):
                u[k] = str(r[col[k]]).strip()
        for k in ("disc", "start"):
            if col[k] is not None:
                y = _year(r[col[k]])
                if y:
                    u[k] = y
        if col["oil"] is not None:
            u["oil"] = _num(r[col["oil"]])
        if col["gas"] is not None:
            u["gas"] = _num(r[col["gas"]])
        if col["prod_year"] is not None:
            u["prodYear"] = _year(r[col["prod_year"]])
        units[u["id"]] = u
    # a separate production sheet, if the main one has no production columns
    if prod is not None and (col["oil"] is None or col["gas"] is None):
        prow = list(prod.iter_rows(values_only=True))
        phi = next((i for i, r in enumerate(prow[:10]) if any(re.match(r"^unit id$", str(c or "").strip().lower()) for c in r)), 0)
        ph = prow[phi]
        pc = {k: _pick(ph, k) for k in ("id", "oil", "gas", "prod_year")}
        if pc["id"] is None or (pc["oil"] is None and pc["gas"] is None):
            raise BuildError(f"GOGET production sheet lacks id/oil/gas; headers: {[str(h) for h in ph]}")
        latest = {}
        for r in prow[phi + 1:]:
            uid = str(r[pc["id"]] or "")
            if uid not in units:
                continue
            y = _year(r[pc["prod_year"]]) if pc["prod_year"] is not None else None
            o = _num(r[pc["oil"]]) if pc["oil"] is not None else None
            g = _num(r[pc["gas"]]) if pc["gas"] is not None else None
            if o is None and g is None:
                continue
            if uid not in latest or (y or 0) >= (latest[uid][0] or 0):
                latest[uid] = (y, o, g)
        for uid, (y, o, g) in latest.items():
            units[uid]["oil"], units[uid]["gas"], units[uid]["prodYear"] = o, g, y
    oil_hdr = str(headers[col["oil"]]) if col["oil"] is not None else ""
    gas_hdr = str(headers[col["gas"]]) if col["gas"] is not None else ""
    return list(units.values()), {"oil": oil_hdr, "gas": gas_hdr}


def goget_units_to_file(units, hdr, src_name):
    """Normalise GOGET production to boe/day. GOGET reports oil in million bbl/y and gas in
    million m³/y; the header text is checked so a unit change upstream is caught."""
    def per_day_oil(v):
        if v is None:
            return None
        if re.search(r"million\s*bbl.*\/?\s*y", hdr["oil"], re.I) or "bbl" in hdr["oil"].lower():
            return v * 1e6 / 365.0
        raise BuildError(f"GOGET oil unit not understood: {hdr['oil']!r}")
    def per_day_gas_boe(v):
        if v is None:
            return None
        h = hdr["gas"].lower()
        if "million" in h and ("m³" in h or "m3" in h or "cubic met" in h):
            return v * 1e6 / 365.0 / 159.0      # Sm³ gas -> boe at 1 boe = 159 Sm³ (Sodir's 1000 Sm³ = 1 Sm³ o.e.)
        if "bcf" in h or "billion cubic feet" in h:
            return v * 1e9 / 35.3147 / 365.0 / 159.0
        raise BuildError(f"GOGET gas unit not understood: {hdr['gas']!r}")
    out = []
    for u in units:
        o = per_day_oil(u.get("oil"))
        g = per_day_gas_boe(u.get("gas"))
        rec = {k: u[k] for k in ("id", "name", "country", "lat", "lon", "status") if k in u}
        for k in ("fuel", "type", "operator", "disc", "start", "wiki", "prodYear"):
            if u.get(k) is not None:
                rec[k] = u[k]
        if o is not None:
            rec["oilBpd"] = round(o)
        if g is not None:
            rec["gasBoepd"] = round(g)
        out.append(rec)
    out.sort(key=lambda r: (r["country"], r["name"], r["id"]))
    return out


def find_goget(manual_dir: str):
    cands = sorted(glob.glob(os.path.join(manual_dir, "*.xlsx")) + glob.glob(os.path.join(manual_dir, "*.xls")))
    cands = [c for c in cands if "goget" in os.path.basename(c).lower() or "extraction" in os.path.basename(c).lower()
             or "oil" in os.path.basename(c).lower()]
    return cands[-1] if cands else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="world-oil-gas/data")
    ap.add_argument("--manual", default="world-oil-gas/data-src/manual")
    ap.add_argument("--cache", default=os.environ.get("SHELF_ATLAS_CACHE", "scripts/shelf_atlas/cache"))
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--refresh", action="store_true", help="refetch sources even if cached")
    ap.add_argument("--generated-at", default=None, help="ISO timestamp to stamp (default: now)")
    args = ap.parse_args()
    cache = Cache(args.cache, refresh=args.refresh, offline=args.offline)
    generated = args.generated_at or dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    log("world: geometry")
    world = build_world_geometry(cache)
    write_json(os.path.join(args.out, "world.json"), world)

    log("world: countries")
    rows, book = read_owid(cache)
    countries, y0, y1, src = build_countries(rows, book)
    if len(countries) < 150 or y1 < 2020:
        raise BuildError(f"OWID looks wrong: {len(countries)} countries, last year {y1}")
    wrl = next((c for c in countries if c["iso3"] == "OWID_WRL"), None)
    # ask rows: latest year, top producers, in kboe/d
    latest = []
    for c in countries:
        if c["iso3"] == "OWID_WRL":
            continue
        yy = c["y0"] + len(c["oil"]) - 1
        for k in range(len(c["oil"]) - 1, -1, -1):
            if c["oil"][k] is not None or c["gas"][k] is not None:
                yy = c["y0"] + k
                break
        o = c["oil"][yy - c["y0"]] or 0
        g = c["gas"][yy - c["y0"]] or 0
        latest.append({"country": c["name"], "iso3": c["iso3"], "year": yy,
                       "oilGWh": o, "gasGWh": g,
                       "oilKboePerDay": round(o / 1000 * BOE_PER_TWH / 365 / 1000, 1),
                       "gasKboePerDay": round(g / 1000 * BOE_PER_TWH / 365 / 1000, 1)})
    latest.sort(key=lambda r: -(r["oilGWh"] + r["gasGWh"]))
    snapshot = {
        "schema": 1,
        "generatedAt": generated,
        "app": "World Oil & Gas",
        "units": {
            "series": "GWh per year (integer)",
            "boePerTWh": round(BOE_PER_TWH),
            "note": "1 boe = 5.8 MMBtu = 6.1178632 GJ (Energy Institute convention); barrels here are "
                    "energy-equivalent, not measured volumes",
        },
        "years": [y0, y1],
        "sources": [
            {"name": "Our World in Data — Energy dataset (oil_production, gas_production)",
             "url": "https://github.com/owid/energy-data",
             "licence": "CC BY 4.0",
             "detail": src or "Energy Institute Statistical Review of World Energy; The Shift Data Portal for years before 1965",
             "attribution": "Country production: Energy Institute Statistical Review of World Energy, via Our World in Data (CC BY 4.0)"},
            {"name": "Natural Earth 1:110m admin-0 countries", "url": "https://www.naturalearthdata.com/",
             "licence": "Public domain", "attribution": "Basemap: Natural Earth"},
        ],
        "world": wrl,
        "countries": [c for c in countries if c["iso3"] != "OWID_WRL"],
        "ask": latest[:200],
    }
    write_json(os.path.join(args.out, "snapshot.json"), snapshot)

    log("world: fields (GOGET)")
    path = find_goget(args.manual)
    fields_path = os.path.join(args.out, "fields.json")
    if path is None:
        write_json(fields_path, {
            "schema": 1, "available": False, "generatedAt": generated,
            "reason": "No Global Oil and Gas Extraction Tracker spreadsheet in world-oil-gas/data-src/manual/. "
                      "Download it from Global Energy Monitor (it sits behind a form) and rerun the build; "
                      "see HANDOFF.md.",
            "fields": [],
        })
        log("  no GOGET spreadsheet dropped in; wrote fields.json with available=false")
        return
    units, hdr = read_goget(path)
    if len(units) < 1000:
        raise BuildError(f"GOGET parsed only {len(units)} located units from {path}; not writing")
    recs = goget_units_to_file(units, hdr, os.path.basename(path))
    rel = re.search(r"(20\d\d)[-_ ]?(\d\d|[A-Za-z]+)?", os.path.basename(path))
    write_json(fields_path, {
        "schema": 1, "available": True, "generatedAt": generated,
        "source": {"name": "Global Oil and Gas Extraction Tracker, Global Energy Monitor",
                   "file": os.path.basename(path), "release": rel.group(0) if rel else "",
                   "url": "https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/",
                   "licence": "CC BY 4.0",
                   "attribution": "Fields: Global Energy Monitor, Global Oil and Gas Extraction Tracker (CC BY 4.0)",
                   "columns": hdr},
        "units": {"oilBpd": "barrels of oil per day (annual volume / 365)",
                  "gasBoepd": "gas as barrels of oil equivalent per day, 159 Sm³ per boe"},
        "fields": recs,
    })


if __name__ == "__main__":
    try:
        main()
    except BuildError as e:
        log(f"BUILD FAILED: {e}")
        sys.exit(2)
