"""Netherlands — NLOG (TNO Geological Survey of the Netherlands, for the Ministry).

Geometry from NLOG's WFS at gdngeoservices.nl (the same service the NLOG interactive map uses):
  nlog:gdw_ng_field_utm        567 field outlines with status, operator, discovery year, production start
  nlog:GDW_NG_FACILITY_UTM     655 facilities (platforms, satellites, onshore sites) with type and status
Pipelines: NLOG's WFS has none, so the build takes the Netherlands' from EMODnet.

Production per field per month comes from the NLOG datacenter's API (see nlog_production() and
RESEARCH.md); NLOG publishes monthly figures about two months in arrears.

Licence: NLOG's disclaimer states it claims no intellectual property rights in the information
provided through the site (bar names, marks and patents); the data is public information under
the Dutch Mining Act.
"""
from __future__ import annotations

import json
import re
import urllib.parse

from .common import BuildError, Cache, log, month_index, norm_name

WFS = "https://www.gdngeoservices.nl/geoserver/nlog/ows"
FIELD_PAGE = "https://www.nlog.nl/en/fields"

SOURCE = {
    "id": "nlog",
    "name": "NLOG — Netherlands Oil and Gas portal (TNO / Ministry of Climate Policy and Green Growth)",
    "url": "https://www.nlog.nl/en/data",
    "licence": "Public information; NLOG claims no intellectual property rights in the data it provides",
    "attribution": "Dutch field data: NLOG (nlog.nl), TNO – Geological Survey of the Netherlands",
    "cadence": "Monthly production about two months in arrears; WFS layers continuously",
}


def _wfs(cache: Cache, key: str, type_name: str):
    url = WFS + "?" + urllib.parse.urlencode({
        "service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeName": type_name,
        "outputFormat": "json", "srsName": "EPSG:4326"})
    gj = json.loads(cache.get(f"netherlands/{key}.geojson", url))
    if not gj.get("features"):
        raise BuildError(f"NLOG WFS {type_name}: no features")
    return gj


def _year(v):
    m = re.search(r"(19|20)\d\d", str(v or ""))
    return int(m.group(0)) if m else None


def load_geometry(cache: Cache):
    fields = {}
    gj = _wfs(cache, "fields", "nlog:gdw_ng_field_utm")
    for ft in gj["features"]:
        p = ft.get("properties", {})
        g = ft.get("geometry") or {}
        name = (p.get("FIELD_NAME") or "").strip()
        code = (p.get("FIELD_CODE") or "").strip()
        if not name:
            continue
        polys = [g["coordinates"]] if g.get("type") == "Polygon" else (g.get("coordinates") or [])
        rings = [[tuple(c[:2]) for c in poly[0]] for poly in polys if poly]
        key = norm_name(name)
        rec = fields.get(key)
        ps = p.get("PRODUCTION_START")
        if rec is None:
            hc = (p.get("HYDROCARBON_MINERAL") or "").strip()
            rec = fields[key] = {
                "id": f"NL-{norm_name(code) or key}",
                "country": "NL", "name": name, "key": key, "code": code,
                "hc": hc.upper() if hc else None,
                "status": (p.get("STATUS_DESCRIPTION") or p.get("STATUS") or "").strip() or None,
                "operator": (p.get("OPERATOR") or "").strip() or None,
                "discYear": _year(p.get("DISCOVERY_YEAR")),
                "prodStart": None,
                "url": (p.get("URL") or "").strip() or None,
                "landsea": (p.get("LANDSEA") or "").strip() or None,
                "statusHist": [], "operatorHist": [], "series": {}, "rings": [], "point": None,
                "source": "nlog",
            }
            y = _year(ps)
            if y:
                m = re.search(r"(19|20)\d\d[-/](\d{2})", str(ps))
                rec["prodStart"] = month_index(y, int(m.group(2))) if m else month_index(y, 1)
        rec["rings"].extend(rings)
    facilities = []
    gj = _wfs(cache, "facilities", "nlog:GDW_NG_FACILITY_UTM")
    for ft in gj["features"]:
        p = ft.get("properties", {})
        g = ft.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        lon, lat = g["coordinates"][:2]
        kind = (p.get("FACILITY_TYPE_DESCRIPTION") or p.get("FACILITY_TYPE_CODE") or "").strip()
        kl = kind.lower()
        if any(k in kl for k in ("wind", "geotherm", "aardwarmte", "zout", "salt")):
            continue
        facilities.append({
            "id": f"NL-F{(p.get('FACILITY_CODE') or '').strip() or len(facilities)}",
            "country": "NL",
            "name": (p.get("FACILITY_NAME") or "").strip(),
            "kind": kind,
            "surface": not any(k in kl for k in ("subsea", "onderwater", "wellhead")),
            "phase": (p.get("STATUS_DESCRIPTION") or p.get("STATUS_CODE") or "").strip(),
            "startYear": None, "endYear": None,
            "field": None,
            "operator": (p.get("OPERATOR") or "").strip() or None,
            "lon": float(lon), "lat": float(lat), "source": "nlog",
        })
    log(f"  nlog: {len(fields)} fields, {len(facilities)} facilities")
    return fields, facilities


def load(cache: Cache):
    fields, facilities = load_geometry(cache)
    try:
        from .nlog_production import attach_production
        attach_production(cache, fields)
    except ImportError:
        log("  nlog: no production module yet; Dutch fields carry no series")
    return {"fields": list(fields.values()), "facilities": facilities, "pipelines": []}
