#!/usr/bin/env python3
"""Build the Shelf Atlas (North Sea) app's data files.

    python3 -m scripts.shelf_atlas.build_north_sea --out shelf-atlas/data [--cache DIR] [--offline]
                                                   [--countries NO,UK,DK,NL] [--basemap-only]

Writes shelf-atlas/data/geo.json and shelf-atlas/data/snapshot.json — see SCHEMA.md.

The four national fetchers each return the same shape ({fields, facilities, pipelines} with
series in Sm³ per month), and this script does what is common: the basemap, the maritime
boundaries, cross-border grouping, simplification and packing, size checks, the `ask` rows.

Nothing is guessed. A source that changed shape stops the build with what it found; a merge
that would drop a producing field is logged by name; a file over its size budget fails.
"""
from __future__ import annotations

import argparse
import calendar
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from scripts.shelf_atlas.common import (BBL_PER_SM3, BuildError, Cache, EPOCH_YEAR, b64, bbox_of, centroid,
                                        encode_line, log, month_label, norm_name, pack_u16, ring_area_m2,
                                        simplify, write_json)
from scripts.shelf_atlas import fetch_basemap, fetch_denmark, fetch_netherlands, fetch_norway, fetch_uk

BBOX = [-6.0, 50.5, 12.0, 63.0]
FACTOR = 10000
BASE_MIN_AREA = 8000.0        # m², Visvalingam threshold for coast/land/bathymetry/borders
FIELD_MIN_AREA = 2500.0       # m², field outlines (a 50 m wiggle is noise at any phone zoom)
PIPE_MIN_AREA = 6000.0        # m², pipelines
PIPE_MIN_LENGTH_M = 3000.0    # shorter pieces (risers, spools, jumpers) are dropped
BUDGET_GEO = 2_000_000        # bytes
BUDGET_SNAPSHOT = 2_500_000

# Cross-border units. Name matching across regulators finds the candidates automatically; this
# table CONFIRMS which pairs are one unit (each regulator reports its national share) and gives
# the shares where the regulators publish them. Anything matched by name but not listed here is
# reported in snapshot.matching for a human to look at, and NOT grouped.
CROSS_BORDER = {
    "STATFJORD": {"name": "Statfjord", "members": {"NO": 85.47, "UK": 14.53}},
    "FRIGG": {"name": "Frigg", "members": {"NO": 60.82, "UK": 39.18}},
    "MURCHISON": {"name": "Murchison", "members": {"NO": 22.2, "UK": 77.8}},
    "MARKHAM": {"name": "Markham", "members": {"UK": None, "NL": None}},
    "PLAYFAIR": {"name": "Playfair", "members": {"NO": None, "UK": None}},
    "BLANE": {"name": "Blane", "members": {"NO": 18.0, "UK": 82.0}},
    "ENOCH": {"name": "Enoch", "members": {"NO": 21.8, "UK": 78.2}},
    "ORMEN LANGE": None,   # a name that could collide with nothing; listed to show the shape
}


def _norm_status(s):
    if not s:
        return None
    t = s.strip().lower()
    if "produc" in t and "unlikely" not in t and "not" not in t and "approved" not in t:
        return "Producing"
    if "shut" in t or "abandon" in t or "ceased" in t or "decommission" in t or "removed" in t:
        return "Shut down"
    if "approved" in t or "development" in t or "under" in t:
        return "Approved for production"
    return s.strip()


def _first_last(series):
    keys = [k for k, v in series.items() if v[0] > 0 or v[1] > 0]
    return (min(keys), max(keys)) if keys else (None, None)


def _pack(series, idx, first, last):
    vals = [series.get(mi, (0, 0, 0))[idx] for mi in range(first, last + 1)]
    if max(vals) <= 0:
        return None
    raw, scale = pack_u16(vals)
    return {"start": first, "scale": round(scale, 6), "b64": b64(raw)}


def build(args):
    cache = Cache(args.cache, refresh=args.refresh, offline=args.offline)
    generated = args.generated_at or dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    wanted = [c.strip().upper() for c in args.countries.split(",") if c.strip()]

    log("basemap")
    coast, land, bathy = fetch_basemap.natural_earth(cache, BBOX, BASE_MIN_AREA)
    borders = [] if args.basemap_only and args.offline else fetch_basemap.boundaries(cache, BBOX, BASE_MIN_AREA)

    geo = {
        "schema": 1, "generatedAt": generated, "factor": FACTOR, "bbox": BBOX,
        "coast": [encode_line(l, FACTOR) for l in coast],
        "land": [[encode_line(r, FACTOR) for r in p] for p in land],
        "bathy200": [[encode_line(r, FACTOR) for r in p] for p in bathy],
        "borders": [{"name": b["name"], "type": b["type"], "a": b["a"], "b": b["b"],
                     "lines": [encode_line(l, FACTOR) for l in b["lines"]]} for b in borders],
        "fields": [], "pipelines": [], "facilities": [],
    }
    sources = list(fetch_basemap.SOURCES)
    fields, facilities, pipelines = [], [], []

    if not args.basemap_only:
        loaders = {"NO": (fetch_norway, "sodir"), "UK": (fetch_uk, "nsta"),
                   "DK": (fetch_denmark, "dea"), "NL": (fetch_netherlands, "nlog")}
        for cc in wanted:
            mod, _ = loaders[cc]
            log(f"{cc}: fetching")
            got = mod.load(cache)
            fields.extend(got["fields"])
            facilities.extend(got["facilities"])
            pipelines.extend(got["pipelines"])
            sources.append(mod.SOURCE)
        need_emodnet = [c for c in ("DK", "NL") if c in wanted]
        if need_emodnet:
            pipelines.extend(fetch_basemap.emodnet_pipelines(cache, need_emodnet, BBOX))

    # ---- fields: centroid, status, series, cross-border ----
    out_fields = []
    by_key = {}
    dropped = []
    for f in fields:
        rings = []
        for r in f["rings"]:
            if len(r) < 4:
                continue
            s = simplify(r, FIELD_MIN_AREA, closed=True)
            if len(s) >= 4 and ring_area_m2(s) > 0:
                rings.append(s)
        if rings:
            c = centroid(rings)
        elif f.get("point"):
            c = f["point"]
        else:
            c = None
        first, last = _first_last(f["series"])
        if c is None:
            dropped.append(f"{f['id']} {f['name']} (no geometry; {'producing' if first is not None else 'no production'})")
            continue
        if not (BBOX[0] <= c[0] <= BBOX[2] and BBOX[1] <= c[1] <= BBOX[3]):
            dropped.append(f"{f['id']} {f['name']} (outside bbox)")
            continue
        rec = {
            "id": f["id"], "country": f["country"], "name": f["name"], "hc": f.get("hc"),
            "status": f.get("status"), "statusNorm": _norm_status(f.get("status")),
            "operator": f.get("operator"), "discYear": f.get("discYear"),
            "firstMonth": first, "lastMonth": last, "url": f.get("url"),
            "c": [round(c[0], 4), round(c[1], 4)],
        }
        if f.get("statusHist"):
            rec["statusHist"] = [[mi, s] for mi, s in f["statusHist"]]
        if f.get("operatorHist"):
            rec["operatorHist"] = [[mi, s] for mi, s in f["operatorHist"]]
        if f.get("monthlyFrom") is not None:
            rec["monthlyFrom"] = f["monthlyFrom"]
        if first is not None:
            liq = _pack(f["series"], 0, first, last)
            gas = _pack(f["series"], 1, first, last)
            if liq:
                rec["liq"] = liq
            if gas:
                rec["gas"] = gas
            rec["peakLiq"] = round(max(v[0] for v in f["series"].values()))
            rec["peakGas"] = round(max(v[1] for v in f["series"].values()))
            rec["cumLiq"] = round(sum(v[0] for v in f["series"].values()))
            rec["cumGas"] = round(sum(v[1] for v in f["series"].values()))
        if rings:
            geo["fields"].append({"id": f["id"], "rings": [encode_line(r, FACTOR) for r in rings]})
        out_fields.append(rec)
        by_key.setdefault(norm_name(f["name"]), []).append(rec)
    if dropped:
        log(f"  dropped {len(dropped)} fields: " + "; ".join(dropped[:20]))

    # cross-border: same normalised name in two countries
    groups, candidates, excluded = [], [], []
    for key, recs in sorted(by_key.items()):
        countries = sorted({r["country"] for r in recs})
        if len(countries) < 2:
            continue
        rule = CROSS_BORDER.get(key)
        if rule and rule.get("members") and set(countries) <= set(rule["members"]):
            gid = key
            for r in recs:
                r["group"] = gid
                share = rule["members"].get(r["country"])
                if share is not None:
                    r["share"] = share
            groups.append({"id": gid, "name": rule["name"], "members": [r["id"] for r in recs],
                           "note": f"Cross-border {'/'.join(countries)} unit; each member carries its national share"})
        else:
            candidates.append({"name": recs[0]["name"], "countries": countries, "ids": [r["id"] for r in recs],
                               "note": "same name in two regulators' data, not confirmed as one unit — shown separately"})
    for key, rule in CROSS_BORDER.items():
        if rule and key not in {g["id"] for g in groups}:
            excluded.append({"name": rule["name"], "note": "listed as cross-border but not found in both regulators' data"})
    log(f"  cross-border groups: {[g['id'] for g in groups]}; unconfirmed name matches: {[c['name'] for c in candidates]}")

    # ---- facilities ----
    for fa in facilities:
        if not (BBOX[0] <= fa["lon"] <= BBOX[2] and BBOX[1] <= fa["lat"] <= BBOX[3]):
            continue
        geo["facilities"].append({
            "id": fa["id"], "country": fa["country"], "name": fa["name"], "kind": fa["kind"],
            "surface": bool(fa["surface"]), "phase": fa.get("phase"),
            "startYear": fa.get("startYear"), "endYear": fa.get("endYear"),
            "field": fa.get("field"), "operator": fa.get("operator"),
            "lon": round(fa["lon"], 4), "lat": round(fa["lat"], 4),
        })
    geo["facilities"].sort(key=lambda x: (x["country"], x["name"], x["id"]))

    # ---- pipelines ----
    def length_m(line):
        import math
        s = 0.0
        for (x0, y0), (x1, y1) in zip(line, line[1:]):
            kx = 111320.0 * math.cos(math.radians((y0 + y1) / 2))
            s += math.hypot((x1 - x0) * kx, (y1 - y0) * 110574.0)
        return s
    kept = 0
    for p in pipelines:
        lines = []
        for l in p["lines"]:
            s = simplify(l, PIPE_MIN_AREA)
            if len(s) > 1:
                lines.append(s)
        if not lines:
            continue
        total = sum(length_m(l) for l in lines)
        kind = (p.get("kind") or "").upper()
        if total < PIPE_MIN_LENGTH_M or any(k in kind for k in ("UMBILICAL", "CABLE", "CONTROL", "RISER")):
            continue
        medium = (p.get("medium") or "").strip()
        geo["pipelines"].append({
            "id": p["id"], "country": p["country"], "name": p.get("name"), "medium": medium or None,
            "dimIn": p.get("dimIn"), "phase": p.get("phase"), "from": p.get("from"), "to": p.get("to"),
            "km": round(total / 1000, 1),
            "lines": [encode_line(l, FACTOR) for l in lines],
        })
        kept += 1
    geo["pipelines"].sort(key=lambda x: (x["country"], -(x["km"] or 0), x["id"]))
    log(f"  pipelines kept: {kept} of {len(pipelines)}")

    # ---- snapshot ----
    last_month = max((f["lastMonth"] for f in out_fields if f.get("lastMonth") is not None), default=0)
    ask = []
    for f in sorted(out_fields, key=lambda r: -(r.get("peakLiq", 0) + r.get("peakGas", 0) / 1000)):
        if f.get("lastMonth") is None:
            continue
        mi = f["lastMonth"]
        y, m = EPOCH_YEAR + mi // 12, mi % 12 + 1
        days = calendar.monthrange(y, m)[1]
        liq = gas = 0.0
        src = next((x for x in fields if x["id"] == f["id"]), None)
        if src:
            liq, gas = src["series"].get(mi, (0, 0, 0))[0], src["series"].get(mi, (0, 0, 0))[1]
        ask.append({
            "country": {"NO": "Norway", "UK": "United Kingdom", "DK": "Denmark", "NL": "Netherlands"}[f["country"]],
            "field": f["name"].title(), "operator": f.get("operator"), "status": f.get("statusNorm") or f.get("status"),
            "hydrocarbonType": f.get("hc"), "latestMonth": month_label(mi),
            "liquidsSm3PerDay": round(liq / days), "gasSm3PerDay": round(gas / days),
            "boePerDay": round((liq + gas / 1000.0) / days * BBL_PER_SM3),
            "discoveryYear": f.get("discYear"),
            "firstProductionYear": EPOCH_YEAR + f["firstMonth"] // 12 if f.get("firstMonth") is not None else None,
            "crossBorderUnit": f.get("group"),
        })
        if len(ask) >= 200:
            break
    snapshot = {
        "schema": 1, "generatedAt": generated, "epochYear": EPOCH_YEAR, "lastMonth": last_month,
        "units": {"liq": "Sm³ per month: oil + condensate + NGL", "gas": "Sm³ per month",
                  "oe": "1 Sm³ liquids = 1 Sm³ o.e.; 1000 Sm³ gas = 1 Sm³ o.e.", "bblPerSm3": BBL_PER_SM3},
        "series": {"encoding": "base64 of little-endian uint16; value = code × scale; index 0 is month `start`"},
        "sources": sources,
        "countries": {"NO": "Norway", "UK": "United Kingdom", "DK": "Denmark", "NL": "Netherlands"},
        "fields": sorted(out_fields, key=lambda r: (r["country"], r["name"])),
        "groups": groups,
        "matching": {"note": "Fields are matched across regulators by name (letters and digits only). "
                             "Confirmed cross-border units are grouped; other same-name matches are listed here and left separate.",
                     "crossBorderCandidates": candidates, "excluded": excluded, "dropped": dropped},
        "ask": ask,
    }

    geo_path = os.path.join(args.out, "geo.json")
    snap_path = os.path.join(args.out, "snapshot.json")
    write_json(geo_path, geo)
    write_json(snap_path, snapshot)
    for p, budget in ((geo_path, BUDGET_GEO), (snap_path, BUDGET_SNAPSHOT)):
        sz = os.path.getsize(p)
        if sz > budget:
            raise BuildError(f"{p} is {sz:,} B, over its {budget:,} B budget")
    n_series = sum(1 for f in out_fields if f.get("liq") or f.get("gas"))
    log(f"done: {len(out_fields)} fields ({n_series} with series), {len(geo['fields'])} outlines, "
        f"{len(geo['facilities'])} facilities, {len(geo['pipelines'])} pipelines, last month {month_label(last_month)}")
    if not args.basemap_only and n_series < 300:
        raise BuildError(f"only {n_series} fields carry a series; refusing to publish")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="shelf-atlas/data")
    ap.add_argument("--cache", default=os.environ.get("SHELF_ATLAS_CACHE", "scripts/shelf_atlas/cache"))
    ap.add_argument("--countries", default="NO,UK,DK,NL")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--basemap-only", action="store_true")
    ap.add_argument("--generated-at", default=None)
    args = ap.parse_args()
    try:
        build(args)
    except BuildError as e:
        log(f"BUILD FAILED: {e}")
        sys.exit(2)


if __name__ == "__main__":
    main()
