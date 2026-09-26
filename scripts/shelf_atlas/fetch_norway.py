"""Norway — the Norwegian Offshore Directorate (Sodir), FactPages and shapefiles. NLOD.

Reads
  FactPages CSV exports (SSRS endpoint; the same URLs FactPages' own CSV buttons use)
    field                       one row per field: operator, status, HC type, discovery well
    field_production_monthly    one row per field-month, from 1971 (Ekofisk) to two months ago
    field_activity_status_hst   status by date range, for colouring a field by the month shown
    field_operator_hst          operator by date range
    discovery                   discovery year per discovery, joined to its field
  Shapefiles (ED50 geographic, shifted to WGS84 here)
    fldArea.zip     field outlines (142 polygons)
    fclPoint.zip    facilities (1229 points: platforms, FPSOs, subsea templates, onshore plants)
    pipLine.zip     the 83 main pipelines

Everything Sodir publishes about a field on the border is the NORWEGIAN SHARE only
(Statfjord: 85.47 %); the UK share comes from the NSTA feed and the build joins them.
"""
from __future__ import annotations

import csv
import io
import re

from .common import (BuildError, Cache, dms, ed50_to_wgs84, log, month_index, norm_name,
                     parse_no_date, shape_rings, shapefile_records)

SSRS = ("https://factpages.sodir.no/public?/Factpages/external/tableview/{table}"
        "&rs:Command=Render&rc:Toolbar=false&rc:Parameters=f&IpAddress=not_used"
        "&CultureCode=en&rs:Format=CSV&Top100=false")
SHAPE = "https://factpages.sodir.no/downloads/shape/{name}.zip"

SOURCE = {
    "id": "sodir",
    "name": "Norwegian Offshore Directorate (Sodir) — FactPages and FactMaps",
    "url": "https://factpages.sodir.no/",
    "licence": "NLOD 2.0 (Norwegian Licence for Open Government Data)",
    "attribution": "Contains data under the Norwegian licence for Open Government data (NLOD) "
                   "distributed by the Norwegian Offshore Directorate",
    "cadence": "FactPages are synchronised daily; monthly production lands about a month in arrears",
}


def _csv(cache: Cache, table: str):
    raw = cache.get(f"norway/{table}.csv", SSRS.format(table=table))
    txt = raw.decode("utf-8-sig")
    if txt.lstrip().startswith("<"):
        raise BuildError(f"Sodir {table}: got HTML, not CSV")
    rows = list(csv.DictReader(io.StringIO(txt)))
    if not rows:
        raise BuildError(f"Sodir {table}: empty")
    return rows


def _need(rows, table, *cols):
    missing = [c for c in cols if c not in rows[0]]
    if missing:
        raise BuildError(f"Sodir {table} lacks {missing}; has {list(rows[0].keys())}")


def load(cache: Cache):
    fields_csv = _csv(cache, "field")
    _need(fields_csv, "field", "fldName", "cmpLongName", "fldCurrentActivitySatus", "fldHcType",
          "fldNpdidField", "fldFactPageUrl", "wlbCompletionDate", "fldMainArea")
    prod = _csv(cache, "field_production_monthly")
    _need(prod, "field_production_monthly", "prfInformationCarrier", "prfYear", "prfMonth",
          "prfPrdOilNetMillSm3", "prfPrdGasNetBillSm3", "prfPrdNGLNetMillSm3",
          "prfPrdCondensateNetMillSm3", "prfPrdOeNetMillSm3", "prfNpdidInformationCarrier")
    status_hst = _csv(cache, "field_activity_status_hst")
    _need(status_hst, "field_activity_status_hst", "fldNpdidField", "fldStatusFromDate", "fldStatus")
    op_hst = _csv(cache, "field_operator_hst")
    _need(op_hst, "field_operator_hst", "fldNpdidField", "cmpLongName", "fldOperatorFrom")
    disc = _csv(cache, "discovery")
    _need(disc, "discovery", "fldNpdidField", "dscDiscoveryYear")

    disc_year = {}
    for r in disc:
        fid, y = r["fldNpdidField"].strip(), r["dscDiscoveryYear"].strip()
        if fid and y.isdigit():
            disc_year[fid] = min(disc_year.get(fid, 9999), int(y))

    fields = {}
    for r in fields_csv:
        fid = r["fldNpdidField"].strip()
        name = r["fldName"].strip()
        wc = parse_no_date(r["wlbCompletionDate"])
        fields[fid] = {
            "id": f"NO-{fid}",
            "country": "NO",
            "name": name,
            "key": norm_name(name),
            "hc": r["fldHcType"].strip() or None,
            "status": r["fldCurrentActivitySatus"].strip(),
            "operator": r["cmpLongName"].strip() or None,
            "area": r["fldMainArea"].strip() or None,
            "discYear": disc_year.get(fid) or (int(wc[:4]) if wc else None),
            "url": r["fldFactPageUrl"].strip() or None,
            "statusHist": [],
            "operatorHist": [],
            "series": {},
            "rings": [],
            "point": None,
            "source": "sodir",
        }

    for r in status_hst:
        fid = r["fldNpdidField"].strip()
        d = parse_no_date(r["fldStatusFromDate"])
        if fid in fields and d:
            fields[fid]["statusHist"].append((month_index(int(d[:4]), int(d[5:7])), r["fldStatus"].strip()))
    for r in op_hst:
        fid = r["fldNpdidField"].strip()
        d = parse_no_date(r["fldOperatorFrom"])
        if fid in fields and d:
            fields[fid]["operatorHist"].append((month_index(int(d[:4]), int(d[5:7])), r["cmpLongName"].strip()))
    for f in fields.values():
        f["statusHist"].sort()
        f["operatorHist"].sort()

    unmatched = set()
    n_rows = 0
    for r in prod:
        fid = r["prfNpdidInformationCarrier"].strip()
        f = fields.get(fid)
        if f is None:
            unmatched.add(r["prfInformationCarrier"])
            continue
        mi = month_index(int(r["prfYear"]), int(r["prfMonth"]))
        oil = float(r["prfPrdOilNetMillSm3"] or 0) * 1e6
        ngl = float(r["prfPrdNGLNetMillSm3"] or 0) * 1e6
        cond = float(r["prfPrdCondensateNetMillSm3"] or 0) * 1e6
        gas = float(r["prfPrdGasNetBillSm3"] or 0) * 1e9
        oe = float(r["prfPrdOeNetMillSm3"] or 0) * 1e6
        # liquids in Sm³, gas in Sm³, oil-equivalent in Sm³ o.e. — all per month
        f["series"][mi] = [oil + ngl + cond, gas, oe]
        n_rows += 1
    if unmatched:
        log(f"  sodir: {len(unmatched)} production carriers with no field row (kept out): {sorted(unmatched)[:8]}")
    if n_rows < 20000:
        raise BuildError(f"Sodir monthly production has only {n_rows} rows; expected > 20,000")

    # --- outlines ---
    by_id = {}
    for rec, shape in shapefile_records(cache.get("norway/fldArea.zip", SHAPE.format(name="fldArea"))):
        fid = str(rec.get("idField", "")).strip()
        f = fields.get(fid)
        if f is None:
            continue
        for ring in shape_rings(shape):
            f["rings"].append([tuple(reversed(ed50_to_wgs84(y, x))) for x, y in ring])
        by_id[fid] = True
    no_geom = [f["name"] for f in fields.values() if not f["rings"]]
    log(f"  sodir: {len(fields)} fields, {len(by_id)} with outlines; without: {no_geom[:10]}")

    # --- facilities ---
    facilities = []
    for rec, shape in shapefile_records(cache.get("norway/fclPoint.zip", SHAPE.format(name="fclPoint"))):
        if not shape.points:
            continue
        x, y = shape.points[0][:2]
        lat, lon = ed50_to_wgs84(y, x)
        start = str(rec.get("dtStartup") or "")
        shut = str(rec.get("yrShutdown") or "")
        removed = str(rec.get("yrRemoved") or "")
        facilities.append({
            "id": f"NO-F{rec.get('idFacility')}",
            "country": "NO",
            "name": str(rec.get("facName", "")).strip(),
            "kind": str(rec.get("facKind", "")).strip(),
            "surface": str(rec.get("surface", "")).strip().upper() == "Y",
            "phase": str(rec.get("phaseName", "")).strip(),
            "startYear": int(start[:4]) if start[:4].isdigit() else None,
            "endYear": int(shut[:4]) if shut[:4].isdigit() else (int(removed[:4]) if removed[:4].isdigit() else None),
            "field": str(rec.get("belong2nm", "")).strip() or None,
            "operator": str(rec.get("curOperNam", "")).strip() or None,
            "lon": lon, "lat": lat,
            "source": "sodir",
        })

    # --- pipelines ---
    pipelines = []
    for rec, shape in shapefile_records(cache.get("norway/pipLine.zip", SHAPE.format(name="pipLine"))):
        lines = []
        for part in shape_rings(shape):
            lines.append([tuple(reversed(ed50_to_wgs84(y, x))) for x, y in part])
        if not lines:
            continue
        dim = rec.get("dimension")
        pipelines.append({
            "id": f"NO-P{rec.get('idPipeline')}",
            "country": "NO",
            "name": str(rec.get("pipName", "")).strip(),
            "medium": str(rec.get("medium", "")).strip() or None,
            "dimIn": float(dim) if dim not in (None, "", " ") else None,
            "phase": str(rec.get("curPhase", "")).strip() or None,
            "from": str(rec.get("fromFacili", "")).strip() or None,
            "to": str(rec.get("toFacility", "")).strip() or None,
            "lines": lines,
            "source": "sodir",
        })
    log(f"  sodir: {len(facilities)} facilities, {len(pipelines)} pipelines")
    return {"fields": list(fields.values()), "facilities": facilities, "pipelines": pipelines}
