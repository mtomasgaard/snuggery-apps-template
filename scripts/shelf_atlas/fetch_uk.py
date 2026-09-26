"""United Kingdom — the North Sea Transition Authority's open data (ArcGIS Online). NSTA Open User Licence.

Reads, from NSTA's ArcGIS organisation (services-eu1.arcgis.com/OZMfUznmLTnWccBc):
  Offshore_hydrocarbon_fields_(WGS84)                       478 field outlines with type, status, dates, operator
  UKCS_hydrocarbon_field_production_reports_PPRS_points     one row per field-month from the Petroleum Production
                                                            Reporting System (~135,000 rows, 1975 onwards), paged 2000 at a time
  UKCS_offshore_infrastructure_pipeline_linear_(WGS84)      pipelines (thousands of segments; the build keeps the hydrocarbon ones)
  UKCS offshore infrastructure surface points WGS84         platforms, FPSOs and other surface structures
  UKCS_offshore_infrastructure_subsea_points_(WGS84)        subsea structures

The layer id inside each service is read from the service description rather than assumed:
NSTA republishes these with a dated layer name and the id has been 0 or 1 on different days.

For a field on the median line (Statfjord, Murchison, Frigg...) PPRS carries the UK SHARE only.
"""
from __future__ import annotations

import json
import re
import urllib.parse

from .common import BuildError, Cache, log, month_index, norm_name

ORG = "https://services-eu1.arcgis.com/OZMfUznmLTnWccBc/arcgis/rest/services"
FIELDS_SVC = "Offshore_hydrocarbon_fields_(WGS84)"
PPRS_SVC = "UKCS_hydrocarbon_field_production_reports_PPRS_points_(WGS84)"
PIPES_SVC = "UKCS_offshore_infrastructure_pipeline_linear_(WGS84)"
SURFACE_SVC = "UKCS offshore infrastructure surface points WGS84"
SUBSEA_SVC = "UKCS_offshore_infrastructure_subsea_points_(WGS84)"
PAGE = 2000

SOURCE = {
    "id": "nsta",
    "name": "North Sea Transition Authority (NSTA) — Open Data",
    "url": "https://open-data-ukcs-transition.hub.arcgis.com/",
    "licence": "NSTA Open User Licence (June 2023): free to copy, publish, distribute, adapt; "
               "commercial exploitation is not granted",
    "attribution": "Contains information provided by the North Sea Transition Authority and/or other third parties",
    "cadence": "PPRS field production is updated monthly, about two months in arrears; GIS layers as NSTA republishes them",
}


def _svc(name: str) -> str:
    return ORG + "/" + urllib.parse.quote(name, safe="()_-") + "/FeatureServer"


def _layer_id(cache: Cache, name: str, key: str) -> int:
    raw = cache.get(f"uk/{key}.service.json", _svc(name) + "?f=pjson")
    j = json.loads(raw)
    layers = j.get("layers") or []
    if not layers:
        raise BuildError(f"NSTA service {name} lists no layers: {str(j)[:300]}")
    return int(layers[0]["id"])


def _query(cache: Cache, name: str, key: str, layer: int, params: dict) -> dict:
    q = dict(where="1=1", f="json")
    q.update(params)
    url = f"{_svc(name)}/{layer}/query?" + urllib.parse.urlencode(q)
    raw = cache.get(f"uk/{key}.json", url)
    j = json.loads(raw)
    if "error" in j:
        raise BuildError(f"NSTA {name}: {j['error']}")
    return j


def _all_features(cache: Cache, name: str, key: str, layer: int, out_fields: str, geometry: bool):
    """Page through a layer with resultOffset; ArcGIS Online caps a page at 2000."""
    feats = []
    offset = 0
    while True:
        j = _query(cache, name, f"{key}.{offset:06d}", layer, {
            "outFields": out_fields, "orderByFields": "OBJECTID", "resultOffset": offset,
            "resultRecordCount": PAGE, "returnGeometry": "true" if geometry else "false",
            "f": "geojson" if geometry else "json",
        })
        fs = j.get("features") or []
        feats.extend(fs)
        if len(fs) < PAGE or not j.get("exceededTransferLimit", len(fs) == PAGE):
            if len(fs) < PAGE:
                break
        offset += PAGE
        if offset > 400000:
            raise BuildError(f"NSTA {name}: runaway paging")
    return feats


def _epoch_year(v):
    """ArcGIS dates are epoch milliseconds."""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    if v > 1e11:
        import datetime as _dt
        return _dt.datetime.fromtimestamp(v / 1000, _dt.timezone.utc).year
    return None


SUBSEA_KEEP = ("MANIFOLD", "TEMPLATE", "SUBSEA PRODUCTION", "SSIV", "PLEM", "PLET", "TIE-IN", "RISER BASE")


def _year_month(s: str):
    m = re.match(r"\s*(\d{4})[/-](\d{1,2})", s or "")
    return (int(m.group(1)), int(m.group(2))) if m else None


def load(cache: Cache):
    # --- fields ---
    lid = _layer_id(cache, FIELDS_SVC, "fields")
    feats = _all_features(cache, FIELDS_SVC, "fields", lid, "*", True)
    if len(feats) < 300:
        raise BuildError(f"NSTA fields: only {len(feats)} features")
    fields = {}
    for f in feats:
        p = f["properties"]
        name = (p.get("FIELDNAME") or "").strip()
        if not name:
            continue
        g = f.get("geometry") or {}
        polys = [g["coordinates"]] if g.get("type") == "Polygon" else (g.get("coordinates") or [])
        rings = [[tuple(c[:2]) for c in poly[0]] for poly in polys if poly]
        key = norm_name(name)
        disc = _year_month(p.get("DISC_DATE"))
        prod = _year_month(p.get("PROD_DATE"))
        rec = fields.get(key)
        if rec is None:
            rec = fields[key] = {
                "id": f"UK-{key}",
                "country": "UK",
                "name": name,
                "key": key,
                "hc": (p.get("FIELDTYPE") or "").strip() or None,
                "status": (p.get("STATUS") or "").strip().title() or None,
                "operator": (p.get("CURR_OPER") or "").strip().title() or None,
                "discYear": disc[0] if disc else None,
                "prodStart": month_index(*prod) if prod else None,
                "url": None,
                "statusHist": [],
                "operatorHist": [],
                "series": {},
                "rings": [],
                "point": None,
                "source": "nsta",
            }
        rec["rings"].extend(rings)
    log(f"  nsta: {len(fields)} fields with outlines")

    # --- production (PPRS) ---
    lid = _layer_id(cache, PPRS_SVC, "pprs")
    rows = _all_features(cache, PPRS_SVC, "pprs", lid,
                         "FIELDNAME,PERIODYR,PERIODMNTH,OILPRODM3,AGASPROKSM,DGASPROKSM,GCONDVOL,LOCATION,ORGGRPNM,UNITTYPDES",
                         False)
    if len(rows) < 100000:
        raise BuildError(f"NSTA PPRS: only {len(rows)} rows; expected > 100,000")
    onshore = set()
    n = 0
    no_outline = {}
    for r in rows:
        a = r.get("attributes") or r.get("properties") or {}
        name = (a.get("FIELDNAME") or "").strip()
        if not name:
            continue
        if (a.get("LOCATION") or "").strip().lower() == "onshore":
            onshore.add(name)
            continue
        try:
            mi = month_index(int(a["PERIODYR"]), int(a["PERIODMNTH"]))
        except (TypeError, ValueError, KeyError):
            continue
        key = norm_name(name)
        rec = fields.get(key)
        if rec is None:
            rec = no_outline.get(key)
            if rec is None:
                rec = no_outline[key] = {
                    "id": f"UK-{key}", "country": "UK", "name": name, "key": key, "hc": None,
                    "status": None, "operator": (a.get("ORGGRPNM") or "").strip().title() or None,
                    "discYear": None, "prodStart": None, "url": None, "statusHist": [], "operatorHist": [],
                    "series": {}, "rings": [], "point": None, "source": "nsta",
                }
        oil = float(a.get("OILPRODM3") or 0)                 # m³
        cond = float(a.get("GCONDVOL") or 0)                 # m³ (gas condensate volume)
        gas = (float(a.get("AGASPROKSM") or 0) + float(a.get("DGASPROKSM") or 0)) * 1000.0   # kSm³ -> Sm³
        if oil == 0 and cond == 0 and gas == 0:
            continue
        liq = oil + cond
        prev = rec["series"].get(mi)
        if prev:   # a field reported under two unit types in one month: add
            liq += prev[0]
            gas += prev[1]
        rec["series"][mi] = [liq, gas, liq + gas / 1000.0]
        if a.get("ORGGRPNM") and not rec["operator"]:
            rec["operator"] = a["ORGGRPNM"].strip().title()
        n += 1
    # fields with production but no outline: keep, they get a point from the PPRS centroid later if available
    for key, rec in no_outline.items():
        if rec["series"]:
            fields[key] = rec
    log(f"  nsta: {n} offshore field-months; {len(onshore)} onshore fields skipped; "
        f"{sum(1 for r in no_outline.values() if r['series'])} producing fields without an outline: "
        f"{sorted(r['name'] for r in no_outline.values() if r['series'])[:12]}")

    # centroid points for outline-less fields from the PPRS point geometry (one page with geometry per field name)
    need = {k for k, r in fields.items() if not r["rings"]}
    if need:
        pts = _all_features(cache, PPRS_SVC, "pprs.points", lid, "FIELDNAME,PERIODYRMN", True)
        for f in pts:
            key = norm_name((f.get("properties") or {}).get("FIELDNAME") or "")
            if key in need and fields[key]["point"] is None and f.get("geometry"):
                c = f["geometry"]["coordinates"]
                fields[key]["point"] = (float(c[0]), float(c[1]))

    # --- infrastructure ---
    facilities = []
    for svc, key, surface in ((SURFACE_SVC, "surface", True), (SUBSEA_SVC, "subsea", False)):
        try:
            lid = _layer_id(cache, svc, key)
            feats = _all_features(cache, svc, key, lid, "*", True)
        except BuildError as e:
            log(f"  nsta: {key} infrastructure unavailable: {e}")
            continue
        for f in feats:
            p = f.get("properties") or {}
            g = f.get("geometry") or {}
            if g.get("type") != "Point":
                continue
            lon, lat = g["coordinates"][:2]
            name = (p.get("NAME") or p.get("FEATURE_NAME") or p.get("STRUCTURE") or p.get("INF_NAME") or "").strip()
            kind = (p.get("INF_TYPE") or p.get("TYPE") or p.get("STRUC_TYPE") or p.get("FEATURE_TYPE") or "").strip()
            status = (p.get("STATUS") or p.get("STAT_DESC") or "").strip()
            if not surface and not any(k in kind.upper() for k in SUBSEA_KEEP):
                continue
            sy = _epoch_year(p.get("START_DATE") or p.get("INS_DATE"))
            ey = _epoch_year(p.get("END_DATE"))
            facilities.append({
                "id": f"UK-F{p.get('OBJECTID')}{'S' if surface else 'U'}",
                "country": "UK", "name": name, "kind": kind, "surface": surface,
                "phase": status, "startYear": sy, "endYear": ey,
                "field": (p.get("FIELD_NAME") or p.get("FIELDNAME") or p.get("FIELD") or p.get("PIPE_SYS") or "").strip() or None,
                "operator": (p.get("OPERATOR") or p.get("REP_GROUP") or "").strip().title() or None,
                "lon": float(lon), "lat": float(lat), "source": "nsta",
            })
    pipelines = []
    try:
        lid = _layer_id(cache, PIPES_SVC, "pipes")
        feats = _all_features(cache, PIPES_SVC, "pipes", lid, "*", True)
    except BuildError as e:
        log(f"  nsta: pipelines unavailable: {e}")
        feats = []
    for f in feats:
        p = f.get("properties") or {}
        g = f.get("geometry") or {}
        if g.get("type") == "LineString":
            lines = [[tuple(c[:2]) for c in g["coordinates"]]]
        elif g.get("type") == "MultiLineString":
            lines = [[tuple(c[:2]) for c in part] for part in g["coordinates"]]
        else:
            continue
        dim_mm = p.get("DIAMETERMM") or p.get("DIAMETER_MM") or p.get("NOM_DIAM")
        dim_in = p.get("DIAMETER_IN") or p.get("DIAM_IN")
        try:
            dim = float(dim_in) if dim_in not in (None, "") else (float(dim_mm) / 25.4 if dim_mm not in (None, "") else None)
        except ValueError:
            dim = None
        fluid = (p.get("FLUID") or p.get("FLUID_TYPE") or p.get("MEDIUM") or "").strip().upper()
        if fluid and not any(k in fluid for k in ("OIL", "GAS", "CONDENSATE", "MULTIPHASE", "HYDROCARBON", "NGL", "CRUDE")):
            continue
        pipelines.append({
            "id": f"UK-P{p.get('OBJECTID')}",
            "country": "UK",
            "name": (p.get("PIPE_NAME") or p.get("NAME") or p.get("DESCRIPTIO") or p.get("DESCRIPTION") or "").strip(),
            "medium": (p.get("FLUID") or p.get("FLUID_TYPE") or p.get("MEDIUM") or "").strip() or None,
            "dimIn": round(dim, 1) if dim else None,
            "phase": (p.get("STATUS") or "").strip() or None,
            "from": (p.get("START_POINT") or p.get("FROM_LOC") or "").strip() or None,
            "to": (p.get("END_POINT") or p.get("TO_LOC") or "").strip() or None,
            "kind": (p.get("INF_TYPE") or p.get("PIPE_TYPE") or "").strip() or None,
            "startYear": _epoch_year(p.get("START_DATE")),
            "endYear": _epoch_year(p.get("END_DATE")),
            "lines": lines,
            "source": "nsta",
        })
    if feats:
        sample = feats[0].get("properties") or {}
        log(f"  nsta: pipeline attribute names: {sorted(sample.keys())[:40]}")
    log(f"  nsta: {len(facilities)} facilities, {len(pipelines)} pipeline segments")
    return {"fields": list(fields.values()), "facilities": facilities, "pipelines": pipelines}
