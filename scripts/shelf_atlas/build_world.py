#!/usr/bin/env python3
"""Build the World Oil & Gas app's data files.

    python3 -m scripts.shelf_atlas.build_world --out world-oil-gas/data [--cache DIR] [--offline]

Writes
  world.json     Natural Earth 1:110m countries, packed polylines keyed by ISO 3166-1 alpha-3
  snapshot.json  annual oil and gas production by country, 1900 -> latest, from Our World in
                 Data's energy dataset (which carries the Energy Institute Statistical Review),
                 plus `ask` rows and the source list the app prints on its attribution screen
  fields.json    oil and gas extraction units from Global Energy Monitor's GOGET, IF the
                 spreadsheet has been dropped into world-oil-gas/raw/manual/ (it sits
                 behind a form, so no job can fetch it); otherwise the file is written with
                 `available: false` and the reason, and the app says so on screen

Nothing here is guessed: a column that is not where this script expects it stops the build
with the columns that were found, so a silent renaming upstream cannot ship an empty map.
"""
from __future__ import annotations

import argparse
import collections
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
        "source": "Natural Earth 1:110m admin-0 countries and 1:10m bathymetry (public domain), simplified",
        "countries": countries,
        "bathymetry": build_world_bathymetry(cache),
    }


NE_BATHY = [("A", 10000), ("B", 9000), ("C", 8000), ("D", 7000), ("E", 6000), ("F", 5000),
            ("G", 4000), ("H", 3000), ("I", 2000), ("J", 1000), ("K", 200), ("L", 0)]
FIELDS_BUDGET = 2_600_000     # fields.json: 7,000 units with production, reserves and outlines
BATHY_MIN_AREA_M2 = 4.0e8      # 400 km² triangles: the ocean floor at world scale, not a coastline


def build_world_bathymetry(cache: Cache):
    """Natural Earth 1:10m bathymetry: one layer per depth step, deepest first, so the app paints
    them in order and the deepest tint wins. The 0 m layer (the whole ocean) is skipped: the sea
    is the background."""
    layers = []
    for letter, depth in NE_BATHY:
        if depth == 0:
            continue
        name = f"ne_10m_bathymetry_{letter}_{depth}"
        raw = cache.get(f"global/{name}.geojson", NE.replace("ne_110m_admin_0_countries.geojson", "") + name + ".geojson"
                        if False else f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/{name}.geojson")
        gj = json.loads(raw.decode("utf-8"))
        rings = []
        for f in gj["features"]:
            g = f["geometry"]
            polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
            for poly in polys:
                outer = simplify([tuple(c) for c in poly[0]], BATHY_MIN_AREA_M2, closed=True)
                if len(outer) >= 4 and ring_area_m2(outer) > BATHY_MIN_AREA_M2:
                    rings.append(encode_line(outer, WORLD_FACTOR))
        layers.append({"depth": depth, "rings": rings})
    return layers


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


HISTORICAL = {"World": "OWID_WRL", "USSR": "OWID_USS", "Czechoslovakia": "OWID_CZS", "Yugoslavia": "OWID_YGS"}


def build_countries(rows, book):
    """Per ISO3 country: yearly oil and gas production in GWh (integers), dense from the
    first year with data to the last. Aggregates (World, Europe, OPEC...) have no ISO
    code in OWID except 'OWID_WRL' and friends; the world total is kept, the rest dropped."""
    by = {}
    patched = []
    for r in rows:
        iso = r["iso_code"]
        if not iso:
            # OWID leaves the code empty for aggregates; the world total and the three
            # dissolved states are kept under codes of our own so sums are complete
            iso = HISTORICAL.get(r["country"], "")
            if not iso:
                continue
        if iso.startswith("OWID_") and iso not in HISTORICAL.values():
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
        # An isolated zero between two large values (Norway gas 1998 in the 2025 file) is a
        # hole in the source, not a year without production: it becomes "no data" and is listed.
        for kind, arr in (("oil", oil), ("gas", gas)):
            for k in range(1, len(arr) - 1):
                if arr[k] == 0 and arr[k - 1] and arr[k + 1] and min(arr[k - 1], arr[k + 1]) > 20000:
                    arr[k] = None
                    patched.append({"iso3": iso, "country": d["name"], "year": y0 + k, "series": kind,
                                    "note": "isolated zero between two large values set to no data"})
        countries.append({"iso3": iso, "name": d["name"], "y0": y0, "oil": oil, "gas": gas})
        y_min, y_max = min(y_min, y0), max(y_max, y1)
    src = ""
    if "oil_production" in book:
        src = book["oil_production"].get("source", "")
    if patched:
        log(f"  owid: {len(patched)} isolated zeros set to no data: {[(p['country'], p['year'], p['series']) for p in patched]}")
    return countries, y_min, y_max, src, patched


# --------------------------------------------------------------------------------------------
# GOGET — Global Energy Monitor's Global Oil and Gas Extraction Tracker
# --------------------------------------------------------------------------------------------

GOGET_COLS = {
    # key: regexes tried in order against the lower-cased header. The tracker renames
    # columns between releases; every alias seen so far is listed, and a miss stops the
    # build with the headers that were found so the list can be extended, not guessed at.
    # Main sheet ("Field-level main data" since the 2025 releases; one row per unit):
    "id": [r"^unit id$", r"^goget id$", r"^id$"],
    "name": [r"^unit name$", r"^name$", r"^unit$"],
    "country": [r"^country/area$", r"^country$", r"^country \(area\)$"],
    "lat": [r"^latitude$", r"^lat$"],
    "lon": [r"^longitude$", r"^lon$", r"^lng$"],
    "status": [r"^status$", r"^unit status$"],
    "fuel": [r"^fuel type$", r"^fuel$", r"^hydrocarbon type$"],
    "type": [r"^production type$", r"^unit type$", r"^type$"],
    "operator": [r"^operator$", r"^operator\(s\)$"],
    "parents": [r"^parent\(s\)$", r"^parent$", r"^parent company$"],
    "disc": [r"^discovery year$", r"^discovery$"],
    "fid": [r"^fid year$", r"^final investment decision.*"],
    "start": [r"^production start year$", r"^start year$", r"^first production year$"],
    "wiki": [r"^wiki url \(field\)$", r"^wiki url \(project\)$", r"^wiki url$", r"^wiki$", r"^gem wiki$"],
    "shore": [r"^onshore/offshore$", r"^onshore or offshore$"],
    "basin": [r"^basin$"],
    "accuracy": [r"^location accuracy$"],
    "wkt": [r"^field outline \(wkt\)$", r"^outline \(wkt\)$"],
    # Long-format production and reserves sheets (one row per unit × fuel description):
    "fuel_desc": [r"^fuel description$", r"^fuel$"],
    "qty": [r"^quantity \(converted\)$", r"^quantity$"],
    "unit": [r"^units \(converted\)$", r"^units$", r"^unit$"],
    "data_year": [r"^data year$", r"^production year$", r"^year$"],
    "res_class": [r"^reserves classification$", r"^reserves class$", r"^classification$"],
}

# GOGET's "Fuel description" values are free text from each regulator. They are folded into
# liquids or gas by their converted unit (million bbl/y is a liquid, million m³/y is gas); the
# handful reported as million boe/y are hydrocarbons mixed and go to whichever side the
# description names, else to liquids. Anything else stops the build.
GEM_WIKI = "https://www.gem.wiki/"
GOGET_BBL_PER_BOE_GAS = 159.0     # Sm³ gas per boe (Sodir: 1000 Sm³ gas = 1 Sm³ o.e., 6.29 bbl/Sm³)

# Reserves: many classifications, and a unit carries at most a few of them. The file keeps one
# figure per unit and fuel, the "most remaining" class it has, in this order of preference.
GOGET_RESERVE_CLASSES = [
    (r"^remaining", "remaining"),
    (r"^2p\b|^proved and probable|^proven and probable", "2P"),
    (r"^1p\b|^proved\b|^proven\b", "1P"),
    (r"^reserves$|^recoverable|^economic|^a \+ b1 \+ c1|^estimated|^confirmed", "reserves"),
    (r"^eur\b|ultimate", "EUR"),
]


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


def _sheet_rows(wb, want):
    """Rows of the first sheet whose lower-cased name contains every word in `want`, as
    (headers, rows) with the header row detected as the first one holding 'Unit ID'."""
    for name in wb.sheetnames:
        n = name.lower()
        if all(w in n for w in want):
            rows = list(wb[name].iter_rows(values_only=True))
            hi = next((i for i, r in enumerate(rows[:10])
                       if any(re.match(r"^unit (id|name)$", str(c or "").strip().lower()) for c in r)), None)
            if hi is None:
                raise BuildError(f"GOGET sheet {name!r}: no header row with 'Unit ID' in the first 10 rows")
            return name, rows[hi], rows[hi + 1:]
    return None, None, None


def _fuel_side(desc: str, unit: str):
    """'liquid' or 'gas' for a long-format production/reserves row, or None to skip it."""
    u = (unit or "").strip().lower().replace("m3", "m³")
    d = (desc or "").strip().lower()
    if "bbl" in u:
        return "liquid"
    if "m³" in u or "cubic met" in u or "cf" in u or "cubic feet" in u:
        return "gas"
    if "boe" in u:
        # mixed hydrocarbons; count as liquid unless the description is gas only
        return "gas" if re.fullmatch(r".*\bgas\b.*", d) and "oil" not in d and "liquid" not in d and "condensate" not in d else "liquid"
    return None


def _per_day(qty: float, unit: str, side: str):
    """Annual volume in GOGET's converted units -> bbl/d (liquids) or boe/d (gas)."""
    u = (unit or "").strip().lower().replace("m3", "m³")
    if not u.startswith("million"):
        raise BuildError(f"GOGET production unit not understood: {unit!r}")
    if "/y" not in u and "per year" not in u and "/yr" not in u:
        raise BuildError(f"GOGET production unit is not annual: {unit!r}")
    v = qty * 1e6 / 365.0
    if "bbl" in u or "boe" in u:
        return v
    if "m³" in u:
        return v / GOGET_BBL_PER_BOE_GAS
    if "cf" in u or "cubic feet" in u:
        return v / 35.3147 / GOGET_BBL_PER_BOE_GAS
    raise BuildError(f"GOGET production unit not understood: {unit!r}")


def _to_mboe(qty: float, unit: str):
    """Reserves in GOGET's converted units -> million boe."""
    u = (unit or "").strip().lower().replace("m3", "m³")
    if "bbl" in u or "boe" in u:
        return qty
    if "m³" in u:
        return qty / GOGET_BBL_PER_BOE_GAS
    if "cf" in u or "cubic feet" in u:
        return qty / 35.3147 / GOGET_BBL_PER_BOE_GAS
    raise BuildError(f"GOGET reserves unit not understood: {unit!r}")


def read_goget(path: str):
    """Parse the tracker into one record per located field-level unit.

    Since 2025 the workbook has a main sheet (one row per unit) and long-format production and
    reserves sheets (one row per unit × fuel description × data year). Production is summed
    per unit for its newest data year: everything in barrels is a liquid (oil, condensate,
    NGL, LPG …), everything in cubic metres is gas. Reserves keep one class per side."""
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    log(f"  GOGET workbook {os.path.basename(path)}: sheets {wb.sheetnames}")
    mname, headers, rows = _sheet_rows(wb, ("main",))
    if mname is None:
        mname, headers, rows = _sheet_rows(wb, ("unit",))
    if mname is None:
        raise BuildError(f"GOGET: no main sheet among {wb.sheetnames}")
    col = {k: _pick(headers, k) for k in GOGET_COLS}
    missing = [k for k in ("id", "name", "country", "lat", "lon", "status") if col[k] is None]
    if missing:
        raise BuildError(f"GOGET main sheet {mname!r} lacks {missing}; headers: {[str(h) for h in headers]}")
    units, unlocated, outlines = {}, 0, 0
    for r in rows:
        if r is None or col["id"] >= len(r) or not r[col["id"]]:
            continue
        uid = str(r[col["id"]]).strip()
        lat, lon = _num(r[col["lat"]]), _num(r[col["lon"]])
        if lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180:
            unlocated += 1
            continue
        u = {"id": uid, "name": str(r[col["name"]] or "").strip(), "country": str(r[col["country"]] or "").strip(),
             "lat": round(lat, 3), "lon": round(lon, 3), "status": str(r[col["status"]] or "").strip().lower()}
        for k in ("fuel", "type", "operator", "shore", "basin", "accuracy"):
            if col[k] is not None and r[col[k]] not in (None, ""):
                u[k] = str(r[col[k]]).strip()
        if col["wiki"] is not None and r[col["wiki"]] not in (None, ""):
            u["wiki"] = str(r[col["wiki"]]).strip()
        elif col["wiki"] is not None:
            # the field wiki column is preferred; fall back to the project one
            j = _pick(headers, "wiki")
            alt = next((i for i, h in enumerate(headers) if i != j and re.match(r"^wiki url", str(h or "").strip().lower())), None)
            if alt is not None and r[alt] not in (None, ""):
                u["wiki"] = str(r[alt]).strip()
        if col["parents"] is not None and r[col["parents"]] not in (None, ""):
            # "Equinor ASA [60.0%]; DNO ASA [20.0%]" -> ["Equinor ASA", "DNO ASA"]
            u["parents"] = [re.sub(r"\s*\[.*?\]\s*", "", x).strip() for x in str(r[col["parents"]]).split(";") if x.strip()]
        for k in ("disc", "fid", "start"):
            if col[k] is not None:
                y = _year(r[col[k]])
                if y:
                    u[k] = y
        if col["wkt"] is not None and r[col["wkt"]] not in (None, ""):
            u["wkt"] = str(r[col["wkt"]])
            outlines += 1
        units[uid] = u
    log(f"  goget main: {len(units)} located units, {unlocated} without coordinates, {outlines} with outlines")

    # production, long format
    pname, ph, prows = _sheet_rows(wb, ("production",))
    if pname is None:
        raise BuildError(f"GOGET: no production sheet among {wb.sheetnames}")
    pc = {k: _pick(ph, k) for k in ("id", "fuel_desc", "qty", "unit", "data_year")}
    if any(pc[k] is None for k in ("id", "qty", "unit")):
        raise BuildError(f"GOGET production sheet {pname!r} lacks id/quantity/units; headers: {[str(h) for h in ph]}")
    acc = {}      # uid -> {year: {"liquid": bbl/d, "gas": boe/d, "descs": [...]}}
    skipped_desc = collections.Counter()
    for r in prows:
        if r is None or pc["id"] >= len(r) or not r[pc["id"]]:
            continue
        uid = str(r[pc["id"]]).strip()
        if uid not in units:
            continue
        q = _num(r[pc["qty"]])
        if q is None:
            continue
        unit = str(r[pc["unit"]] or "")
        desc = str(r[pc["fuel_desc"]] or "") if pc["fuel_desc"] is not None else ""
        side = _fuel_side(desc, unit)
        if side is None:
            skipped_desc[(desc, unit)] += 1
            continue
        y = _year(r[pc["data_year"]]) if pc["data_year"] is not None else None
        d = acc.setdefault(uid, {}).setdefault(y or 0, {"liquid": None, "gas": None})
        d[side] = (d[side] or 0.0) + _per_day(q, unit, side)
    if skipped_desc:
        log(f"  goget production: skipped rows with unknown units: {dict(skipped_desc)}")
    with_prod = 0
    for uid, years in acc.items():
        y = max(years)
        d = years[y]
        u = units[uid]
        u["prodYear"] = y or None
        # a side is kept only when a row reported it, so a gas field with no oil row has no oilBpd
        if d["liquid"] is not None:
            u["oil"] = d["liquid"]
        if d["gas"] is not None:
            u["gas"] = d["gas"]
        with_prod += 1
    log(f"  goget production: {with_prod} units with a figure; data years {collections.Counter(u.get('prodYear') for u in units.values() if u.get('prodYear')).most_common(4)}")

    # reserves, long format (optional sheet)
    rname, rh, rrows = _sheet_rows(wb, ("reserves",))
    if rname is not None:
        rc = {k: _pick(rh, k) for k in ("id", "fuel_desc", "qty", "unit", "data_year", "res_class")}
        if any(rc[k] is None for k in ("id", "qty", "unit", "res_class")):
            log(f"  goget reserves: sheet {rname!r} lacks id/quantity/units/class, skipped; headers: {[str(h) for h in rh]}")
        else:
            best = {}   # (uid, side) -> (rank, -year, mboe, label)
            for r in rrows:
                if r is None or rc["id"] >= len(r) or not r[rc["id"]]:
                    continue
                uid = str(r[rc["id"]]).strip()
                if uid not in units:
                    continue
                q = _num(r[rc["qty"]])
                if q is None:
                    continue
                unit = str(r[rc["unit"]] or "")
                desc = str(r[rc["fuel_desc"]] or "") if rc["fuel_desc"] is not None else ""
                side = _fuel_side(desc, unit)
                if side is None:
                    continue
                cls = str(r[rc["res_class"]] or "").strip()
                rank = next((i for i, (rx, _) in enumerate(GOGET_RESERVE_CLASSES) if re.search(rx, cls.lower())), None)
                if rank is None:
                    continue    # in-place volumes and unnamed classes are not reserves
                label = GOGET_RESERVE_CLASSES[rank][1]
                y = _year(r[rc["data_year"]]) if rc["data_year"] is not None else 0
                key = (uid, side)
                cur = best.get(key)
                if cur is None or (rank, -(y or 0)) < (cur[0], cur[1]):
                    best[key] = [rank, -(y or 0), 0.0, label]
                if (best[key][0], best[key][1]) == (rank, -(y or 0)):
                    best[key][2] += _to_mboe(q, unit)
            n = 0
            for (uid, side), (rank, ny, mboe, label) in best.items():
                u = units[uid]
                u["resOilMbbl" if side == "liquid" else "resGasMboe"] = round(mboe, 1)
                u.setdefault("resClass", label)
                u.setdefault("resYear", -ny or None)
                n += 1
            log(f"  goget reserves: {len({k[0] for k in best})} units with a reserves figure ({n} sides)")
    return list(units.values()), {"main": mname, "production": pname, "reserves": rname}


def _wkt_rings(wkt: str):
    """Outer rings of a WKT POLYGON / MULTIPOLYGON as [(lon, lat), …] lists; holes dropped."""
    rings = []
    for m in re.finditer(r"\(\(([^()]+)\)", wkt):
        pts = []
        for pair in m.group(1).split(","):
            xy = pair.split()
            if len(xy) >= 2:
                try:
                    pts.append((float(xy[0]), float(xy[1])))
                except ValueError:
                    pass
        if len(pts) >= 4:
            rings.append(pts)
    return rings


def goget_units_to_file(units, hdr, src_name, outline_min_tri_m2=6e4, outline_min_m2=2e5):
    """Flatten parsed units to the app's records. Production is already in bbl/d and boe/d.
    Outlines come along as packed polylines (3 decimals) when the unit has one, simplified with
    Visvalingam at `outline_min_tri_m2` (a 350 m × 350 m triangle) and dropped when the ring
    is smaller than `outline_min_m2`."""
    out = []
    n_out = 0
    for u in units:
        rec = {k: u[k] for k in ("id", "name", "country", "lat", "lon", "status") if k in u and u[k] != ""}
        for k in ("fuel", "type", "operator", "disc", "fid", "start", "prodYear", "basin",
                  "parents", "resOilMbbl", "resGasMboe", "resClass", "resYear"):
            if u.get(k) not in (None, "", []):
                rec[k] = u[k]
        # Bytes matter (7,000 records): the wiki URL is carried only when it is not simply the
        # name with underscores under gem.wiki, offshore is a flag, and only approximate
        # locations are marked.
        wiki = u.get("wiki")
        if wiki and wiki != GEM_WIKI + u["name"].replace(" ", "_"):
            rec["wiki"] = wiki
        shore = (u.get("shore") or "").lower()
        if shore == "offshore":
            rec["offshore"] = 1
        elif shore == "onshore":
            rec["offshore"] = 0
        if (u.get("accuracy") or "").lower().startswith("approx"):
            rec["approx"] = 1
        if u.get("oil") is not None:
            rec["oilBpd"] = round(u["oil"])
        if u.get("gas") is not None:
            rec["gasBoepd"] = round(u["gas"])
        if u.get("wkt"):
            rings = []
            for ring in _wkt_rings(u["wkt"]):
                if ring_area_m2(ring) < outline_min_m2:
                    continue
                s = simplify(ring, outline_min_tri_m2, closed=True)
                if len(s) >= 4:
                    rings.append(encode_line(s, WORLD_FACTOR))
            if rings:
                rec["rings"] = rings
                n_out += 1
        out.append(rec)
    out.sort(key=lambda r: (r["country"], r["name"], r["id"]))
    log(f"  goget: {len(out)} records, {n_out} with outlines")
    return out


def find_goget(manual_dir: str):
    cands = sorted(glob.glob(os.path.join(manual_dir, "*.xlsx")) + glob.glob(os.path.join(manual_dir, "*.xls")))
    cands = [c for c in cands if "goget" in os.path.basename(c).lower() or "extraction" in os.path.basename(c).lower()
             or "oil" in os.path.basename(c).lower()]
    return cands[-1] if cands else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="world-oil-gas/data")
    ap.add_argument("--manual", default="world-oil-gas/raw/manual")
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
    countries, y0, y1, src, patched = build_countries(rows, book)
    if len(countries) < 150 or y1 < 2020:
        raise BuildError(f"OWID looks wrong: {len(countries)} countries, last year {y1}")
    wrl = next((c for c in countries if c["iso3"] == "OWID_WRL"), None)
    # ask rows: latest year, top producers, in kboe/d
    latest = []
    for c in countries:
        if c["iso3"].startswith("OWID_"):
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
        "historical": {"OWID_USS": "USSR (to 1991; no outline)", "OWID_CZS": "Czechoslovakia (no outline)",
                       "OWID_YGS": "Yugoslavia (no outline)"},
        "patched": patched,
        "ask": latest[:200],
    }
    write_json(os.path.join(args.out, "snapshot.json"), snapshot)

    log("world: fields (GOGET)")
    path = find_goget(args.manual)
    fields_path = os.path.join(args.out, "fields.json")
    if path is None:
        write_json(fields_path, {
            "schema": 1, "available": False, "generatedAt": generated,
            "reason": "No Global Oil and Gas Extraction Tracker spreadsheet in world-oil-gas/raw/manual/. "
                      "Download it from Global Energy Monitor (it sits behind a form) and rerun the build; "
                      "see HANDOFF.md.",
            "fields": [],
        })
        log("  no GOGET spreadsheet dropped in; wrote fields.json with available=false")
        return
    units, hdr = read_goget(path)
    if len(units) < 1000:
        raise BuildError(f"GOGET parsed only {len(units)} located units from {path}; not writing")
    if sum(1 for u in units if u.get("oil") is not None or u.get("gas") is not None) < 500:
        raise BuildError("GOGET parsed fewer than 500 units with production; the production sheet changed shape")
    recs = goget_units_to_file(units, hdr, os.path.basename(path))
    if len(json.dumps(recs, ensure_ascii=False, separators=(",", ":")).encode()) > FIELDS_BUDGET:
        raise BuildError(f"fields.json would exceed its budget of {FIELDS_BUDGET/1e6:.1f} MB; thin the records")
    rel = re.search(r"(20\d\d)[-_ ]?(\d\d|[A-Za-z]+)?", os.path.basename(path))
    write_json(fields_path, {
        "schema": 1, "available": True, "generatedAt": generated,
        "source": {"name": "Global Oil and Gas Extraction Tracker, Global Energy Monitor",
                   "file": os.path.basename(path), "release": rel.group(0) if rel else "",
                   "url": "https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/",
                   "licence": "CC BY 4.0",
                   "attribution": "Fields: Global Energy Monitor, Global Oil and Gas Extraction Tracker (CC BY 4.0)",
                   "sheets": hdr},
        "units": {"oilBpd": "liquids (oil, condensate, NGL, LPG) in barrels per day (annual volume / 365)",
                  "gasBoepd": "gas as barrels of oil equivalent per day, 159 Sm³ per boe",
                  "resOilMbbl": "liquids reserves, million barrels (class in resClass, year in resYear)",
                  "resGasMboe": "gas reserves, million boe at 159 Sm³ per boe",
                  "rings": "outline rings as Google polylines, 3 decimals, lon first, holes dropped",
                  "wiki": "GEM wiki page; when absent it is " + GEM_WIKI + " + name with spaces as underscores",
                  "offshore": "1 offshore, 0 onshore, absent when the tracker does not say",
                  "approx": "1 when the tracker marks the location approximate"},
        "counts": {"units": len(recs),
                   "withProduction": sum(1 for r in recs if "oilBpd" in r or "gasBoepd" in r),
                   "withReserves": sum(1 for r in recs if "resOilMbbl" in r or "resGasMboe" in r),
                   "withOutline": sum(1 for r in recs if "rings" in r)},
        "fields": recs,
    })


if __name__ == "__main__":
    try:
        main()
    except BuildError as e:
        log(f"BUILD FAILED: {e}")
        sys.exit(2)
