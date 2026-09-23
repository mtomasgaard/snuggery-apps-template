#!/usr/bin/env python3
"""Build the topside layers: data/topside.json (Stage 1) and data/topside-network.json (Stage 2).

Stage 1 is the field itself -- the sea surface and seabed, the Norne FPSO and its riser base, the
seven subsea templates, the schematic flowlines and risers, the 16-inch gas export line, the
well->template map taken from the deck's WELSPECS groups, and the Norwegian Offshore Directorate's
reported monthly production aligned to the viewer's 110 frames.

Stage 2 is the area and the network -- the trunk lines to the landfall, the onshore terminals, the
neighbouring field outlines, the tie-back satellites and a coastline -- and lives in its own file so
it can be dropped without touching Stage 1.

Everything is converted here, once, offline: NOD geometry arrives in EPSG:23032 (ED50 / UTM 32N)
and is re-centred on model.json's centre and rounded to 1 m for the 3D scene, and is requested a
second time in EPSG:4326 straight from the publisher for the flat network panel, so the build needs
no projection library and no third-party package at all.

Deterministic: two runs from the same cache produce byte-identical files. Nothing is downloaded
that the cache already holds.

    python3 build_topside.py [--cache ../../../cache] [--data-dir ../data] [--no-network]
                             [--offline] [--report]

Only the Python standard library is used (3.9+).
"""
from __future__ import annotations

import argparse
import calendar
import csv
import datetime as dt
import hashlib
import json
import math
import struct
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

# --------------------------------------------------------------------------------------------
# Pinned constants. They are pinned rather than computed from "now" so that two runs, on any day
# and on any machine, produce byte-identical files.
# --------------------------------------------------------------------------------------------

BUILD_DATE = "2026-09-23"          # the date these files were built
RETRIEVED = "2026-09-22"           # the date the cached NOD/Natural Earth downloads were made
SCHEMA_VERSION = 1

FACTMAPS = ("https://factmaps.sodir.no/api/rest/services/Factmaps/"
            "FactMapsED50UTM32/MapServer")
OPM_DATA_RAW = "https://raw.githubusercontent.com/OPM/opm-data"
NATURAL_EARTH_COASTLINE = "https://naciscdn.org/naturalearth/50m/physical/ne_50m_coastline.zip"
FACTPAGES_PRODUCTION = ("https://factpages.sodir.no/public?/Factpages/external/tableview/"
                        "field_production_monthly&rs:Command=Render&rc:Toolbar=false&"
                        "rc:Parameters=f&IpAddress=not_used&CultureCode=en&rs:Format=CSV&"
                        "Top100=false")
EUROSTAT = ("https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
            "{table}?format=JSON&lang=en&partner=NO&siec={siec}&unit={unit}&time=2023")
# The 60 x 60 km box around the model centre that the research fetched the local facilities with
# (the cached answer reaches 33.8 km, so a 40 km box does not reproduce it).
FACILITY_BOX = {"xmin": 429130, "ymin": 7293122, "xmax": 489130, "ymax": 7353122}
OPM_COMMIT = "eaa2261683a97027e057c2bc49612ad1c86390b3"   # the commit the app's own data was built from
SCH_PATH = "norne/INCLUDE/BC0407_HIST01122006.SCH"
USER_AGENT = "norne-reservoir-topside-pipeline/1.0"

# The 90th percentile of the non-zero per-well rates over the whole run, Sm3/day. Shipped as
# constants so the flow animation's rate->speed mapping cannot drift between rebuilds; the build
# recomputes them from model.json and fails if they have moved more than DRIFT_TOLERANCE.
FLOW_REFERENCE = {"unit": "Sm3/d", "oil": 5300, "water": 2600, "gas": 1060000,
                  "winj": 10000, "ginj": 3900000,
                  "note": "90th percentile of non-zero per-well rates over the 110 frames"}
DRIFT_TOLERANCE = 0.05

# The satellites tied back to the same FPSO, for the Area step. Every one of them except Urd's
# three templates comes on stream after this history ends.
SATELLITES = ["NORNE J", "NORNE G", "NORNE H", "VERDANDE", "ALVE", "ALVE NORD",
              "FOSSEKALL P", "FOSSEKALL R", "DOMPAP S", "MARULK"]
NEIGHBOUR_FIELDS = ["NORNE", "ÅSGARD", "HEIDRUN", "URD", "ALVE", "SKARV", "MARULK",
                    "SKULD", "ÆRFUGL NORD", "IDUN NORD", "VERDANDE", "ALVE NORD"]
CHAIN_FACILITIES = ["NORNE FPSO", "NORNE ERB", "NORNE/HEIDRUN T", "ÅSGARD ERB",
                    "ÅSGARD A", "ÅSGARD B", "HEIDRUN"]

# The network panel's window: NW Europe, enough for every route NOD carries.
NET_BBOX = (-6.0, 48.0, 16.0, 68.0)          # lon min, lat min, lon max, lat max
COAST_TOLERANCE_M = 1000.0                   # Douglas-Peucker, metres
OUTLINE_TOLERANCE_M = 400.0                  # field outlines on the network panel
OUTLINE_TOLERANCE_3D_M = 25.0                # field outlines in the 3D area step
MULTIPART_DROP_KM = 5.0                      # a detached part shorter than this is dropped

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


# --------------------------------------------------------------------------------------------
# cache and fetch
# --------------------------------------------------------------------------------------------

class Cache:
    """Read-first download cache. Nothing already on disk is fetched again."""

    def __init__(self, root: Path, offline: bool = False):
        self.root = root
        self.offline = offline
        self.log: list[tuple[str, str, str, int]] = []   # (path, method, url, bytes)

    def path(self, rel: str) -> Path:
        return self.root / rel

    def get(self, rel: str, url: str, *, post: dict | None = None) -> bytes:
        p = self.root / rel
        if p.exists() and p.stat().st_size > 0:
            return p.read_bytes()
        if self.offline:
            raise SystemExit(f"error: {p} is not in the cache and --offline was given")
        headers = {"User-Agent": USER_AGENT}
        data = None
        method = "GET"
        if post is not None:
            # FactMaps' WAF answers a GET whose `where` contains a quote or a % with an HTML
            # page and HTTP 200. The same query as POST is answered properly.
            data = urllib.parse.urlencode(post).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            method = "POST"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=180) as r:
            if r.status != 200:
                raise SystemExit(f"error: {url} returned HTTP {r.status}")
            raw = r.read()
        if post is not None and raw[:1] not in (b"{", b"["):
            raise SystemExit(f"error: {url} did not answer with JSON (WAF page?): {raw[:120]!r}")
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(raw)
        self.log.append((rel, method, url, len(raw)))
        return raw

    def json(self, rel: str, url: str, *, post: dict | None = None):
        return json.loads(self.get(rel, url, post=post))


def factmaps_query(cache: Cache, rel: str, layer: int, where: str, out_fields: str,
                   out_sr: str, fmt: str = "json", envelope: dict | None = None):
    post = {"where": where, "outFields": out_fields, "outSR": out_sr,
            "returnGeometry": "true", "f": fmt}
    if envelope:
        post.update({"geometry": json.dumps(envelope), "geometryType": "esriGeometryEnvelope",
                     "inSR": "23032", "spatialRel": "esriSpatialRelIntersects"})
    return cache.json(rel, f"{FACTMAPS}/{layer}/query", post=post)


def norne_production(cache: Cache) -> list[dict]:
    """The Directorate's monthly volumes for Norne, one row per month, oldest first.

    The research cached the 110-row extract; if it is not there, the whole-shelf report is
    fetched (it needs Top100=false, or it answers with 300 rows and looks complete) and the
    field's rows are taken from it.
    """
    extract = cache.path("norway/norne_production_1997_2006.csv")
    if extract.exists() and extract.stat().st_size > 0:
        with extract.open(newline="", encoding="utf-8-sig") as fh:
            rows = [{"year": int(r["year"]), "month": int(r["month"]),
                     "oil": float(r["oil_MSm3"]), "gas": float(r["gas_BSm3"]),
                     "water": float(r["water_MSm3"])} for r in csv.DictReader(fh)]
    else:
        raw = cache.get("norway/factpages_field_prod_monthly.csv", FACTPAGES_PRODUCTION)
        rows = []
        for rec in csv.DictReader(raw.decode("utf-8-sig").splitlines()):
            if rec["prfInformationCarrier"].strip() != "NORNE":
                continue
            rows.append({"year": int(rec["prfYear"]), "month": int(rec["prfMonth"]),
                         "oil": float(rec["prfPrdOilNetMillSm3"]),
                         "gas": float(rec["prfPrdGasNetBillSm3"]),
                         "water": float(rec["prfPrdProducedWaterInFieldMillSm3"])})
    rows.sort(key=lambda r: (r["year"], r["month"]))
    return [r for r in rows if (r["year"], r["month"]) >= (1997, 11)]


# --------------------------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------------------------

def m1(v: float) -> int:
    """Round half away from zero to 1 m, so -2138.4999 -> -2138 on every platform."""
    return int(math.floor(v + 0.5)) if v >= 0 else int(math.ceil(v - 0.5))


def r(v: float, nd: int) -> float:
    """Round and kill negative zero, so the text form is stable."""
    out = round(v + 0.0, nd)
    return out + 0.0 if out != 0 else 0.0


def dist(a, b) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def polyline_length(pts) -> float:
    return sum(dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def point_segment_distance(p, a, b) -> float:
    ax, ay, bx, by = a[0], a[1], b[0], b[1]
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(p[0] - ax, p[1] - ay)
    t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


def simplify(pts, tol):
    """Douglas-Peucker, iterative so a long coastline cannot blow the recursion limit."""
    if len(pts) < 3:
        return list(pts)
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        worst, wi = -1.0, -1
        for k in range(i + 1, j):
            d = point_segment_distance(pts[k], pts[i], pts[j])
            if d > worst:
                worst, wi = d, k
        if worst > tol:
            keep[wi] = True
            stack.append((i, wi))
            stack.append((wi, j))
    return [p for p, k in zip(pts, keep) if k]


def deg_scale(lat: float) -> tuple[float, float]:
    """Metres per degree of longitude and latitude at this latitude (spherical, good enough
    for a simplification tolerance)."""
    return 111320.0 * math.cos(math.radians(lat)), 110540.0


def simplify_lonlat(pts, tol_m):
    if len(pts) < 3:
        return list(pts)
    lat0 = sum(p[1] for p in pts) / len(pts)
    sx, sy = deg_scale(lat0)
    metric = [(p[0] * sx, p[1] * sy) for p in pts]
    keep = simplify_indexed(metric, tol_m)
    return [pts[i] for i in keep]


def simplify_indexed(pts, tol):
    if len(pts) < 3:
        return list(range(len(pts)))
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        worst, wi = -1.0, -1
        for k in range(i + 1, j):
            d = point_segment_distance(pts[k], pts[i], pts[j])
            if d > worst:
                worst, wi = d, k
        if worst > tol:
            keep[wi] = True
            stack.append((i, wi))
            stack.append((wi, j))
    return [i for i, k in enumerate(keep) if k]


# --------------------------------------------------------------------------------------------
# dates: NOD stores epoch milliseconds; every one of them is midnight in Oslo
# --------------------------------------------------------------------------------------------

def _last_sunday(year: int, month: int) -> dt.date:
    d = dt.date(year, month, calendar.monthrange(year, month)[1])
    return d - dt.timedelta(days=(d.weekday() + 1) % 7)


def oslo_date(epoch_ms: int) -> dt.date:
    """NOD's epochs are midnight Europe/Oslo. Reading them as UTC is a one-day error on every
    winter date (FINDINGS 3.3) -- the FPSO's 1997-11-04T23:00Z is 5 November in Oslo.

    The EU summer-time rule (last Sunday in March 01:00 UTC to last Sunday in October 01:00 UTC,
    CET = UTC+1 otherwise) has applied in Norway since 1996 and covers every date in this data,
    so it is implemented here rather than depending on a tz database. When zoneinfo has a
    database, the result is cross-checked against it.
    """
    u = dt.datetime.fromtimestamp(epoch_ms / 1000, dt.timezone.utc).replace(tzinfo=None)
    start = dt.datetime.combine(_last_sunday(u.year, 3), dt.time(1, 0))
    end = dt.datetime.combine(_last_sunday(u.year, 10), dt.time(1, 0))
    offset = 2 if start <= u < end else 1
    out = (u + dt.timedelta(hours=offset)).date()
    try:
        from zoneinfo import ZoneInfo
        ref = dt.datetime.fromtimestamp(epoch_ms / 1000, ZoneInfo("Europe/Oslo")).date()
        if ref != out:                                     # pragma: no cover - a real bug if hit
            raise SystemExit(f"error: Oslo date {out} disagrees with the tz database's {ref}")
    except Exception as exc:
        if isinstance(exc, SystemExit):
            raise
    return out


def long_date(d: dt.date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def first_frame(frames: list[dt.date], d: dt.date) -> int:
    return next((i for i, f in enumerate(frames) if f >= d), -1)


def dms(deg, minute, sec, code) -> str:
    return f"{int(deg)}°{int(minute):02d}′{sec:g}″{code}"


def function_text(raw: str | None) -> str:
    """NOD writes "OFFLOADING - PROCESSING - QUARTER - STORAGE"; make it a sentence."""
    if not raw:
        return "—"
    words = [w.strip().lower() for w in raw.split(" - ")]
    words = ["quarters" if w == "quarter" else w for w in words]
    return ", ".join(words).capitalize()


# --------------------------------------------------------------------------------------------
# the deck's WELSPECS groups
# --------------------------------------------------------------------------------------------

def parse_welspecs(text: str) -> tuple[dict[str, str], dict[str, str]]:
    """Return {well: group} from every WELSPECS block, and {child: parent} from GRUPTREE.

    Eclipse free format: '--' starts a comment, each record ends with '/', a section ends with a
    record that is only '/'. Later blocks overwrite earlier ones, which is the deck's own
    semantics for a well that is re-specified.
    """
    wells: dict[str, str] = {}
    tree: dict[str, str] = {}
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        kw = lines[i].split("--")[0].strip().upper()
        if kw in ("WELSPECS", "GRUPTREE"):
            i += 1
            while i < len(lines):
                body = lines[i].split("--")[0].strip()
                i += 1
                if body == "":
                    continue
                if body == "/":
                    break
                if not body.endswith("/"):
                    continue
                fields = [f.strip().strip("'") for f in body[:-1].split()]
                fields = [f for f in fields if f]
                if len(fields) >= 2:
                    if kw == "WELSPECS":
                        wells[fields[0]] = fields[1]
                    else:
                        tree[fields[0]] = fields[1]
            continue
        i += 1
    return wells, tree


def well_templates_from_deck(text: str, names: list[str]) -> tuple[dict[str, str], dict[str, str]]:
    wells, tree = parse_welspecs(text)
    out, manifolds = {}, {}
    for n in names:
        group = wells.get(n)
        if group is None:
            raise SystemExit(f"error: {n} has no WELSPECS record in the deck")
        # 'B1-DUMMY' and 'D2-DUMMY' are parented onto a manifold by GRUPTREE.
        manifold = group
        seen = set()
        while not manifold.startswith("MANI-") and manifold in tree and manifold not in seen:
            seen.add(manifold)
            manifold = tree[manifold]
        if not manifold.startswith("MANI-"):
            raise SystemExit(f"error: {n}'s group {group} does not resolve to a manifold")
        manifolds[n] = manifold
        out[n] = manifold[len("MANI-"):][0]
    return out, manifolds


# --------------------------------------------------------------------------------------------
# a minimal ESRI shapefile polyline reader (shape type 3), for the Natural Earth coastline
# --------------------------------------------------------------------------------------------

def read_shp_polylines(raw: bytes):
    """Yield each part of every PolyLine record as a list of (lon, lat)."""
    if struct.unpack(">i", raw[0:4])[0] != 9994:
        raise SystemExit("error: not a shapefile (bad magic)")
    n = len(raw)
    pos = 100
    while pos + 8 <= n:
        _num, words = struct.unpack(">ii", raw[pos:pos + 8])
        content = pos + 8
        length = words * 2
        shape_type = struct.unpack("<i", raw[content:content + 4])[0]
        if shape_type == 3:
            num_parts, num_points = struct.unpack("<ii", raw[content + 36:content + 44])
            parts = struct.unpack(f"<{num_parts}i", raw[content + 44:content + 44 + 4 * num_parts])
            off = content + 44 + 4 * num_parts
            coords = struct.unpack(f"<{2 * num_points}d", raw[off:off + 16 * num_points])
            bounds = list(parts) + [num_points]
            for k in range(num_parts):
                a, b = bounds[k], bounds[k + 1]
                yield [(coords[2 * j], coords[2 * j + 1]) for j in range(a, b)]
        pos = content + length


def clip_to_bbox(part, bbox):
    """Keep the runs of a polyline that are inside the box, each extended by one point so the
    line still reaches the edge. Returns a list of polylines."""
    lo_x, lo_y, hi_x, hi_y = bbox
    inside = [lo_x <= x <= hi_x and lo_y <= y <= hi_y for x, y in part]
    out, run = [], []
    for i, p in enumerate(part):
        if inside[i]:
            if not run and i > 0:
                run.append(part[i - 1])
            run.append(p)
        else:
            if run:
                run.append(p)
                out.append(run)
                run = []
    if run:
        out.append(run)
    return [s for s in out if len(s) >= 2]


# --------------------------------------------------------------------------------------------
# geometry from NOD's GeoJSON answers
# --------------------------------------------------------------------------------------------

def line_parts(feature):
    g = feature.get("geometry")
    if not g:
        return []
    if g["type"] == "LineString":
        return [[(c[0], c[1]) for c in g["coordinates"]]]
    if g["type"] == "MultiLineString":
        return [[(c[0], c[1]) for c in part] for part in g["coordinates"]]
    return []


def polygon_rings(feature):
    g = feature.get("geometry")
    if not g:
        return []
    if g["type"] == "Polygon":
        return [[(c[0], c[1]) for c in ring] for ring in g["coordinates"]]
    if g["type"] == "MultiPolygon":
        return [[(c[0], c[1]) for c in ring] for poly in g["coordinates"] for ring in poly]
    return []


def keep_main_parts(parts, drop_km, metric="m"):
    """Drop a detached part shorter than drop_km that does not touch the longest part.

    Three NOD pipelines are multi-part and one of them is the Asgard trunk, whose first part is a
    1.7 km stub: code that reads coordinates[0] silently draws the stub and loses 690 km.
    """
    if len(parts) <= 1:
        return list(parts), []
    def length_km(p):
        if metric == "m":
            return polyline_length(p) / 1000.0
        lat0 = sum(q[1] for q in p) / len(p)
        sx, sy = deg_scale(lat0)
        return polyline_length([(q[0] * sx, q[1] * sy) for q in p]) / 1000.0
    lengths = [length_km(p) for p in parts]
    longest = max(range(len(parts)), key=lambda i: lengths[i])
    ends = {parts[longest][0], parts[longest][-1]}
    kept, dropped = [], []
    for i, p in enumerate(parts):
        touches = p[0] in ends or p[-1] in ends
        if i == longest or touches or lengths[i] >= drop_km:
            kept.append(p)
        else:
            dropped.append((i, lengths[i]))
    return kept, dropped


def split_at_tee(line, tee):
    """Where the Norne/Heidrun tee lands on the Asgard trunk, and how far it is from there to the
    landfall end. The trunk's vertices run from the landfall northwards, so the two directions
    must be measured rather than assumed: the landfall end is the one furthest south."""
    best = min(range(len(line) - 1),
               key=lambda i: point_segment_distance(tee, line[i], line[i + 1]))
    offset = point_segment_distance(tee, line[best], line[best + 1])
    to_start = polyline_length(line[:best + 1]) + dist(line[best], tee)
    to_end = polyline_length(line[best + 1:]) + dist(tee, line[best + 1])
    if line[0][1] < line[-1][1]:          # vertex 0 is further south: the landfall is the start
        return best, offset, to_start, "start"
    return best, offset, to_end, "end"


_ONSHORE_23032 = {}


def by_onshore_name(cache, name):
    """The position of an onshore facility in the cached EPSG:23032 answer."""
    if not _ONSHORE_23032:
        raw = factmaps_query(cache, "norway/onshore_facilities.geojson", 307,
                             "fclKind='ONSHORE FACILITY'", ONSHORE_FIELDS_23032, "23032",
                             "geojson")
        for f in raw["features"]:
            _ONSHORE_23032[f["properties"]["fclName"].strip()] = tuple(f["geometry"]["coordinates"])
    return _ONSHORE_23032[name]


# --------------------------------------------------------------------------------------------
# Stage 1 -- data/topside.json
# --------------------------------------------------------------------------------------------

TEMPLATE_ROLE = {"B": "producer", "C": "waterInjector", "D": "producer",
                 "E": "producer", "F": "waterInjector", "K": "producer", "M": "producer"}

DATUM_NOTE = ("The simulation deck names no datum (MAPAXES is the identity transform). Every "
              "record for Norne carries the datum ED50, so ED50 is assumed. The shift to WGS84 "
              "here is 80 m east, 209 m north — smaller than the 139–861 m scatter between a "
              "well and its own template, so nothing drawn here depends on it.")


def build_stage1(cache: Cache, model: dict, report: dict) -> dict:
    cx, cy, cz = model["center"]
    frames = [dt.date(*map(int, s.split("-"))) for s in model["frames"]]
    n_frames = len(frames)

    fac_raw = factmaps_query(cache, "norway/norne_facilities_60km_box.json", 307, "1=1", "*",
                             "23032", "json", envelope=FACILITY_BOX)
    by_name = {f["attributes"]["fclName"]: f for f in fac_raw["features"]}

    facilities: list[dict] = []

    def facility(name, fid, kind, *, display=None, shape=None, role=None, schematic=None,
                 length_m=None, extra_facts=None, later=False):
        a = by_name[name]["attributes"]
        g = by_name[name]["geometry"]
        d = oslo_date(a["fclStartupDate"])
        lat = a["fclNsDeg"] + a["fclNsMin"] / 60 + a["fclNsSec"] / 3600
        lon = a["fclEwDeg"] + a["fclEwMin"] / 60 + a["fclEwSec"] / 3600
        rec = {"id": fid, "name": display or name.title(), "kind": kind}
        if shape:
            rec["shape"] = shape
        if length_m:
            rec["lengthM"] = length_m
        if role:
            rec["role"] = role
        rec["schematic"] = schematic or []
        rec.update({
            "x": m1(g["x"] - cx), "y": m1(g["y"] - cy), "depth": int(a["fclWaterDepth"]),
            "lat": r(lat, 6), "lon": r(lon, 6), "latlonDatum": a["fclGeodeticDatum"],
            "inService": d.isoformat(), "firstFrame": first_frame(frames, d),
            "npdid": a["fclNpdidFacility"],
        })
        if later:
            rec["later"] = True
        facts = {
            "Function": function_text(a["fclFunctions"]),
            "Water depth": f"{int(a['fclWaterDepth'])} m",
            "In service": long_date(d),
            "Operator": a["fclCurrentOperatorName"] or "—",
            "Position": (dms(a["fclNsDeg"], a["fclNsMin"], a["fclNsSec"], a["fclNsCode"]) + " " +
                         dms(a["fclEwDeg"], a["fclEwMin"], a["fclEwSec"], a["fclEwCode"]) +
                         f" ({a['fclGeodeticDatum']})"),
        }
        facts.update(extra_facts or {})
        rec["facts"] = facts
        facilities.append(rec)
        return rec

    facility("NORNE FPSO", "fpso", "fpso", display="Norne FPSO", shape="ship", length_m=250,
             role="hub", schematic=["shape", "heading"], extra_facts={
                 "Hull": "Drawn 250 m long — the shape and heading are schematic; the real "
                         "vessel turns around its turret with the weather",
             })
    _fpso_g = by_name["NORNE FPSO"]["geometry"]
    _erb_g = by_name["NORNE ERB"]["geometry"]
    facility("NORNE ERB", "erb", "riserBase", display="Norne ERB", schematic=[], extra_facts={
        "Belongs to": (by_name["NORNE ERB"]["attributes"]["fclBelongsToName"] or "—").title(),
        "Distance to the FPSO":
            f"{dist((_erb_g['x'], _erb_g['y']), (_fpso_g['x'], _fpso_g['y'])):.0f} m",
    })
    for letter in ["B", "C", "D", "E", "F", "K"]:
        a = by_name[f"NORNE {letter}"]["attributes"]
        facility(f"NORNE {letter}", f"tpl-{letter}", "template", shape="template",
                 role=TEMPLATE_ROLE[letter],
                 extra_facts={"Slots": str(a["fclSlotCapacityGross"])})
    facility("NORNE M", "tpl-M", "template", shape="template", role=TEMPLATE_ROLE["M"],
             later=True, extra_facts={
                 "Slots": str(by_name["NORNE M"]["attributes"]["fclSlotCapacityGross"]),
                 "Note": "Came on stream after this history ends",
             })

    fpso = next(f for f in facilities if f["id"] == "fpso")
    erb = next(f for f in facilities if f["id"] == "erb")
    seabed = fpso["depth"]

    # ---- lines --------------------------------------------------------------------------
    export = factmaps_query(cache, "norway/norne_gas_export_16in.geojson", 311,
                            "fclNameFrom='NORNE ERB'", EXPORT_FIELDS, "23032", "geojson")
    ef = export["features"][0]
    pts = [(c[0], c[1]) for c in ef["geometry"]["coordinates"]]
    gap = dist(pts[0], (erb["x"] + cx, erb["y"] + cy))
    export_km = polyline_length(pts) / 1000.0

    chain = factmaps_query(cache, "norway/chain_facilities.json", 307,
                           "fclName IN (" + ",".join(f"'{n}'" for n in CHAIN_23032) + ")",
                           "*", "23032", "json")
    chain_by_name = {f["attributes"]["fclName"]: f for f in chain["features"]}
    tee_date = oslo_date(chain_by_name["NORNE/HEIDRUN T"]["attributes"]["fclStartupDate"])
    erb_date = oslo_date(chain_by_name["NORNE ERB"]["attributes"]["fclStartupDate"])
    tee_frame = first_frame(frames, tee_date)

    # The Asgard trunk, for the length quoted on the export line's card.
    ppl = factmaps_query(cache, "norway/pipelines_all_ncs.geojson", 311, "1=1",
                         PIPELINE_FIELDS_23032, "23032", "geojson")
    trunk = next(f for f in ppl["features"] if f["properties"]["pplName"].startswith('42" Gas ÅSGARD ERB'))
    trunk_parts, trunk_dropped = keep_main_parts(line_parts(trunk), MULTIPART_DROP_KM)
    trunk_main = max(trunk_parts, key=polyline_length)
    tee_xy = (chain_by_name["NORNE/HEIDRUN T"]["geometry"]["x"],
              chain_by_name["NORNE/HEIDRUN T"]["geometry"]["y"])
    # where the tee lands on the trunk, and how far the trunk runs from there to its south end
    best, tee_offset_m, to_landfall, landfall_end = split_at_tee(trunk_main, tee_xy)
    kalstoe = by_onshore_name(cache, "KALSTØ")
    kaarstoe = by_onshore_name(cache, "KÅRSTØ")
    end_pt = trunk_main[-1] if landfall_end == "end" else trunk_main[0]
    report["trunk"] = {"parts": [round(polyline_length(q) / 1000.0, 3) for q in line_parts(trunk)],
                       "dropped": trunk_dropped, "length_km": polyline_length(trunk_main) / 1000.0,
                       "tee_offset_m": tee_offset_m, "tee_to_landfall_km": to_landfall / 1000.0,
                       "landfall_end": landfall_end,
                       "trunk_end_to_KALSTO_m": dist(end_pt, kalstoe),
                       "trunk_end_to_KARSTO_m": dist(end_pt, kaarstoe)}
    report["export"] = {"vertices": len(pts), "length_km": export_km, "gap_to_erb_m": gap}
    route_km = export_km + to_landfall / 1000.0

    lines: list[dict] = [
        {
            "id": "erb-connector", "name": "Riser base to the published route", "kind": "tie",
            "medium": "gas", "direction": "away", "schematic": ["route"],
            "fromId": "erb", "toId": None, "firstFrame": tee_frame,
            "pts": [[erb["x"], erb["y"], seabed],
                    [m1(pts[0][0] - cx), m1(pts[0][1] - cy), seabed]],
            "facts": {
                "Why it is schematic": "The published dataset drops pipeline tracks within 500 m "
                                       "of a facility, so this first stretch is drawn straight",
                "Length": f"{gap:.0f} m",
            },
        },
        {
            "id": "export-16", "name": "16-inch gas export line", "kind": "export",
            "medium": "gas", "direction": "away", "schematic": ["depth"],
            "fromId": "erb", "toId": None, "firstFrame": tee_frame,
            "endLabel": f"→ Åsgard Transport tie-in {export_km:.0f} km · "
                        f"Kalstø landfall {route_km:.0f} km",
            "pts": [[m1(x - cx), m1(y - cy), seabed] for x, y in pts],
            "facts": {
                "Diameter": f"{ef['properties']['pplDimension']} inches",
                "Route": f"{export_km:.1f} km to the Norne/Heidrun tee, then "
                         f"{to_landfall / 1000.0:.1f} km of the Åsgard Transport trunk to the "
                         f"Kalstø landfall — {route_km:.1f} km of published route in all",
                "In service": f"Riser base {long_date(erb_date)}; tie {long_date(tee_date)}",
                "System": ef["properties"]["pplBelongsToName"].title(),
                "Depth": f"Drawn on the field's seabed plane at {seabed} m. The route is "
                         f"published; a depth profile is not — the dataset carries one water "
                         f"depth, {ef['properties']['pplWaterDepth']} m, for the whole line",
                "Gap at the start": "No pipeline track is published within 500 m of a facility, "
                                    "so the first 500 m from the riser base is drawn straight",
            },
        },
        {
            "id": "riser-fpso", "name": "Risers to the FPSO", "kind": "riser",
            "medium": "mixed", "direction": "toward", "schematic": ["route"],
            "fromId": None, "toId": "fpso", "firstFrame": 0,
            "pts": [[fpso["x"], fpso["y"], seabed], [fpso["x"], fpso["y"], 0]],
            "facts": {"Why it is schematic": "No riser geometry is published; this is a straight "
                                             "line from the seabed to the vessel"},
        },
        {
            "id": "oil-export", "name": "Oil offloading", "kind": "oilExport", "medium": "oil",
            "direction": "away", "schematic": ["route", "destination"],
            "fromId": "fpso", "toId": None, "firstFrame": 0,
            "endLabel": "shuttle tanker → sold worldwide",
            "pts": [[fpso["x"], fpso["y"], 0], [fpso["x"] + 2600, fpso["y"] + 1500, 0]],
            "facts": {
                "How the oil leaves": "By shuttle tanker — there is no oil pipeline from Norne",
                "Destination": "Not published. No open dataset records where a cargo of Norne "
                               "crude goes, so no line is drawn to any refinery",
            },
        },
    ]
    for f in facilities:
        if f["kind"] != "template" or f.get("later"):
            continue
        letter = f["id"][-1]
        d = dist((f["x"], f["y"]), (fpso["x"], fpso["y"]))
        lines.append({
            "id": f"fl-{letter}", "name": f"Flowline {letter} to the FPSO", "kind": "flowline",
            "medium": "water" if f["role"] == "waterInjector" else "mixed",
            "direction": "toward" if f["role"] == "producer" else "away",
            "schematic": ["route"], "fromId": f["id"], "toId": "fpso",
            "firstFrame": f["firstFrame"],
            "pts": [[f["x"], f["y"], f["depth"]], [fpso["x"], fpso["y"], seabed]],
            "facts": {
                "Length drawn": f"{d / 1000:.1f} km",
                "Why it is schematic": "The published pipeline dataset stops 500 m short of every "
                                       "facility, so no in-field flowline geometry exists; this is "
                                       "a straight line between two real end points",
            },
        })

    # ---- well -> template, from the deck's WELSPECS groups ---------------------------------
    sch = cache.get("opm/BC0407_HIST01122006.SCH",
                    f"{OPM_DATA_RAW}/{OPM_COMMIT}/{SCH_PATH}").decode("latin-1")
    names = [w["name"] for w in model["wells"]]
    well_templates, manifolds = well_templates_from_deck(sch, names)
    report["welspecs"] = {
        "wells": len(well_templates),
        "manifolds": sorted(set(manifolds.values())),
        "disagree_with_prefix": sorted(n for n, t in well_templates.items() if n[0] != t),
    }

    # ---- reported production ----------------------------------------------------------------
    rows = norne_production(cache)
    oil = [0] * n_frames
    gas = [0] * n_frames
    water = [0] * n_frames
    used = 0
    for i, row in enumerate(rows):
        f = i + 1                    # a calendar month's volume belongs at the frame that ends it
        if f >= n_frames:
            break
        days = calendar.monthrange(row["year"], row["month"])[1]
        oil[f] = round(row["oil"] * 1e6 / days)
        gas[f] = round(row["gas"] * 1e9 / days)
        water[f] = round(row["water"] * 1e6 / days)
        used += 1
    report["production"] = {
        "rows": len(rows), "used": used,
        "span": [f"{rows[0]['year']}-{rows[0]['month']:02d}",
                 f"{rows[used - 1]['year']}-{rows[used - 1]['month']:02d}"],
        "first_gas_frame": next((i for i, v in enumerate(gas) if v > 0), -1),
        "dropped_last_month": [f"{rows[used]['year']}-{rows[used]['month']:02d}"] if used < len(rows) else [],
        "totals_drawn": {"oil_MSm3": round(sum(x["oil"] for x in rows[:used]), 3),
                         "gas_BSm3": round(sum(x["gas"] for x in rows[:used]), 3),
                         "water_MSm3": round(sum(x["water"] for x in rows[:used]), 3)},
        "totals_all_rows": {"oil_MSm3": round(sum(x["oil"] for x in rows), 3),
                            "gas_BSm3": round(sum(x["gas"] for x in rows), 3),
                            "water_MSm3": round(sum(x["water"] for x in rows), 3)},
    }

    doc = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "norne-topside",
        "stage": 1,
        "generated": BUILD_DATE,
        "sources": {
            "facilities": f"Norwegian Offshore Directorate, FactMaps layer 307, retrieved {RETRIEVED}",
            "pipelines": f"Norwegian Offshore Directorate, FactMaps layer 311, retrieved {RETRIEVED}",
            "production": f"Norwegian Offshore Directorate, FactPages field_production_monthly, retrieved {RETRIEVED}",
            "wells": f"Norne simulation deck, WELSPECS groups, opm-data {OPM_COMMIT[:7]}",
            "licence": "NLOD 2.0 (facilities, pipelines, production); ODbL 1.0 (the deck)",
            "changes": "re-centred on the model origin, rounded to 1 m, dates converted to Europe/Oslo",
        },
        "datum": {"assumed": "ED50 / UTM 32N (EPSG:23032)", "note": DATUM_NOTE},
        "modelCentre": [r(cx, 2), r(cy, 2), r(cz, 2)],
        "frameCount": n_frames,
        "sea": {
            "surfaceDepth": 0,
            "seabedDepth": seabed,
            "seabedRange": [min(f["depth"] for f in facilities if f["kind"] == "template"),
                            max(f["depth"] for f in facilities if f["kind"] == "template")],
            "planeHalfSize": [m1(model["extent"][0] / 2 * 1.6), m1(model["extent"][1] / 2 * 1.6)],
        },
        "facilities": facilities,
        "lines": lines,
        "wellTemplates": well_templates,
        "wellTemplateSource": f"deck WELSPECS groups (MANI-*) at opm-data {OPM_COMMIT[:7]}",
        "flowReference": FLOW_REFERENCE,
        "production": {
            "unit": "Sm3/d",
            "rowZeroFrame": 1,
            "note": "Monthly volumes divided by the days in each month. Reported gas is gas SOLD "
                    "and is zero until February 2001; the simulation's gas is gas produced from "
                    "the reservoir. The two are not the same quantity.",
            "oil": oil, "gasSold": gas, "water": water,
        },
    }
    return doc


# --------------------------------------------------------------------------------------------
# Stage 2 -- data/topside-network.json
# --------------------------------------------------------------------------------------------

REFINERY_NOTE = ("A refinery on the Norwegian coast. No open dataset records where a cargo of "
                 "Norne crude goes, so no line is drawn from Norne to this or any other "
                 "refinery.")
REFINERIES = {"MONGSTAD", "SLAGENTANGEN"}
ONSHORE_FIELDS = ("fclName,fclKind,fclFunctions,fclPhase,fclCurrentOperatorName,fclNationName,"
                  "fclNationCode2,fclStartupDate,fclBelongsToName,fclNpdidFacility,"
                  "fclNsDeg,fclNsMin,fclNsSec,fclNsCode,fclEwDeg,fclEwMin,fclEwSec,fclEwCode")
PIPELINE_FIELDS = ("pplName,pplBelongsToName,cmpLongName,pplCurrentPhase,fclNameFrom,fclNameTo,"
                   "pplDimension,pplWaterDepth,pplMedium,pplNpdidPipeline,pplMainGroupingName")
FIELD_FIELDS = "fldName,fldCurrentActivitySatus,fldHcType,fldDiscoveryYear,cmpLongName"

NORNE_ROUTE_IDS = ["ppl-319132", "ppl-307674"]     # the 16" line, then the Asgard Transport trunk
ONSHORE_FIELDS_23032 = "fclName,fclFunctions,fclCurrentOperatorName,fclPhase"
PIPELINE_FIELDS_23032 = ("pplName,fclNameFrom,fclNameTo,pplMedium,pplDimension,pplBelongsToName,"
                         "pplCurrentPhase,pplWaterDepth")
EXPORT_FIELDS = "pplName,fclNameFrom,fclNameTo,pplMedium,pplDimension,pplBelongsToName,pplWaterDepth"
CHAIN_23032 = ["HEIDRUN", "NORNE FPSO", "ÅSGARD A", "ÅSGARD B", "NORNE ERB", "ÅSGARD ERB",
               "KÅRSTØ", "STURE", "TJELDBERGODDEN", "MONGSTAD", "NORNE/HEIDRUN T", "NYHAMNA"]


def eurostat_figures(cache: Cache) -> dict:
    out = {}
    for key, rel, unit, url in [
            ("gas", "global/eurostat_gas_imports.json", "million m³",
             EUROSTAT.format(table="nrg_ti_gas", siec="G3000", unit="MIO_M3")),
            ("oil", "global/eurostat_oil_imports.json", "thousand tonnes",
             EUROSTAT.format(table="nrg_ti_oil", siec="O4100_TOT", unit="THS_T"))]:
        d = json.loads(cache.get(rel, url))
        geo = d["dimension"]["geo"]["category"]
        labels, index, values = geo["label"], geo["index"], d["value"]
        rows = []
        for code, i in index.items():
            v = values.get(str(i))
            if v is not None and code not in ("EU27_2020", "EA20", "EA21", "EA19"):
                rows.append((labels[code], v))
        rows.sort(key=lambda t: -t[1])
        eu = values.get(str(index["EU27_2020"]))
        siec = d["dimension"]["siec"]["category"]["label"]
        out[key] = {
            "title": d["label"],
            "product": next(iter(siec.values())),
            "year": next(iter(d["dimension"]["time"]["category"]["index"])),
            "unit": unit,
            "eu27": r(eu, 3),
            "top": [{"country": n, "value": r(v, 3)} for n, v in rows[:3]],
        }
    return out


def build_stage2(cache: Cache, model: dict, report: dict) -> dict:
    cx, cy, _cz = model["center"]
    frames = [dt.date(*map(int, s.split("-"))) for s in model["frames"]]

    # ---- the flat panel: WGS84 lon/lat straight from the publisher -------------------------
    ppl4326 = factmaps_query(cache, "norway/pipelines_all_ncs_4326.geojson", 311, "1=1",
                             PIPELINE_FIELDS, "4326", "geojson")
    onshore = factmaps_query(cache, "norway/onshore_facilities_4326_full.json", 307,
                             "fclKind='ONSHORE FACILITY'", ONSHORE_FIELDS, "4326", "json")
    chain4326 = factmaps_query(cache, "norway/chain_facilities_4326.json", 307,
                               "fclName IN (" + ",".join(f"'{n}'" for n in CHAIN_FACILITIES) + ")",
                               "*", "4326", "json")
    fields4326 = factmaps_query(cache, "norway/neighbour_fields_4326.geojson", 502,
                                "fldName IN (" + ",".join(f"'{n}'" for n in NEIGHBOUR_FIELDS) + ")",
                                FIELD_FIELDS, "4326", "geojson")

    # Lengths are measured on the publisher's own projected geometry (EPSG:23032), not off the
    # lon/lat copy, so every figure in the app matches the figures in the research. The two
    # answers are the same query in two output CRSs and come back in the same order; that is
    # asserted per feature rather than assumed.
    ppl23032 = factmaps_query(cache, "norway/pipelines_all_ncs.geojson", 311, "1=1",
                              PIPELINE_FIELDS_23032, "23032", "geojson")
    if len(ppl23032["features"]) != len(ppl4326["features"]):
        raise SystemExit("error: the two pipeline answers have different feature counts")

    # Pair the two answers by name and vertex signature rather than by position, so a server
    # that reorders one of them is matched correctly instead of silently mislabelled; three names
    # are shared by more than one line, and the signature separates them.
    utm_by_key = {}
    for f_utm in ppl23032["features"]:
        parts_utm = line_parts(f_utm)
        if not parts_utm:
            continue
        key = (f_utm["properties"]["pplName"], tuple(len(q) for q in parts_utm))
        if key in utm_by_key:
            raise SystemExit(f"error: two projected lines share the key {key}")
        utm_by_key[key] = parts_utm

    pipelines, dropped_parts = [], []
    for f in ppl4326["features"]:
        parts = line_parts(f)
        if not parts:
            continue
        p = f["properties"]
        parts_utm = utm_by_key.get((p["pplName"], tuple(len(q) for q in parts)))
        if parts_utm is None:
            raise SystemExit(f"error: {p['pplName']} has no match in the projected answer")
        kept, dropped = keep_main_parts(parts, MULTIPART_DROP_KM, metric="deg")
        kept_utm = [parts_utm[parts.index(q)] for q in kept]
        for i, km in dropped:
            dropped_parts.append((p["pplName"], i, round(km, 3)))
        km = sum(polyline_length(q) for q in kept_utm) / 1000.0
        pipelines.append({
            "id": f"ppl-{p['pplNpdidPipeline']}",
            "name": p["pplName"],
            "medium": p["pplMedium"],
            "dimension": p["pplDimension"],
            "system": p["pplBelongsToName"],
            "operator": p["cmpLongName"],
            "phase": p["pplCurrentPhase"],
            "from": p["fclNameFrom"],
            "to": p["fclNameTo"],
            "lengthKm": r(km, 1),
            "parts": [[[r(x, 4), r(y, 4)] for x, y in part] for part in kept],
        })
    pipelines.sort(key=lambda d: d["id"])

    terminals, unlocated = [], []
    for f in onshore["features"]:
        a = f["attributes"]
        g = f["geometry"] or {}
        if not isinstance(g.get("x"), (int, float)) or not isinstance(g.get("y"), (int, float)):
            # NOD carries virtual sale points with no position at all (NaN); they are not places
            # and are left out rather than drawn somewhere.
            unlocated.append(a["fclName"].strip())
            continue
        d = oslo_date(a["fclStartupDate"]) if a.get("fclStartupDate") else None
        rec = {
            "id": f"fcl-{a['fclNpdidFacility']}",
            "name": a["fclName"].strip(),
            "kind": "terminal",
            "lon": r(g["x"], 5), "lat": r(g["y"], 5),
            "connectedToNorne": False,
            "facts": {
                "Function": function_text(a["fclFunctions"]),
                "Operator": a["fclCurrentOperatorName"] or "—",
                "Country": a["fclNationName"] or "—",
                "System": (a["fclBelongsToName"] or "—").title(),
                "In service": long_date(d) if d else "—",
            },
        }
        if rec["name"] in REFINERIES:
            rec["refinery"] = True
            rec["facts"]["Note"] = REFINERY_NOTE
        terminals.append(rec)
    terminals.sort(key=lambda t: t["id"])

    nodes = []
    for f in chain4326["features"]:
        a = f["attributes"]
        g = f["geometry"]
        d = oslo_date(a["fclStartupDate"])
        nodes.append({
            "id": f"fcl-{a['fclNpdidFacility']}", "name": a["fclName"], "kind": "offshore",
            "lon": r(g["x"], 5), "lat": r(g["y"], 5),
            "inService": d.isoformat(),
            "facts": {"Kind": a["fclKind"].title(), "Water depth": f"{int(a['fclWaterDepth'])} m",
                      "In service": long_date(d),
                      "Operator": a["fclCurrentOperatorName"] or "—"},
        })
    nodes.sort(key=lambda t: t["id"])

    outlines = []
    for f in fields4326["features"]:
        rings = [simplify_lonlat(ring, OUTLINE_TOLERANCE_M) for ring in polygon_rings(f)]
        rings = [ring for ring in rings if len(ring) >= 4]
        if not rings:
            continue
        outlines.append({"name": f["properties"]["fldName"],
                         "rings": [[[r(x, 4), r(y, 4)] for x, y in ring] for ring in rings]})
    outlines.sort(key=lambda o: o["name"])

    # ---- the coastline: Natural Earth 50 m, public domain -----------------------------------
    cache.get("global/ne_50m_coastline.zip", NATURAL_EARTH_COASTLINE)
    with zipfile.ZipFile(cache.path("global/ne_50m_coastline.zip")) as z:
        shp = z.read("ne_50m_coastline.shp")
        version = z.read("ne_50m_coastline.VERSION.txt").decode().strip()
    coast, coast_raw = [], 0
    for part in read_shp_polylines(shp):
        for run in clip_to_bbox(part, NET_BBOX):
            coast_raw += len(run)
            s = simplify_lonlat(run, COAST_TOLERANCE_M)
            if len(s) >= 2:
                coast.append([[r(x, 4), r(y, 4)] for x, y in s])
    coast.sort(key=lambda line: (line[0][0], line[0][1], len(line)))
    report["coast"] = {"lines": len(coast), "points": sum(len(c) for c in coast),
                       "points_before_simplify": coast_raw, "version": version}

    # ---- the Area step: model-relative metres, the same frame as the reservoir --------------
    fac_raw = factmaps_query(cache, "norway/norne_facilities_60km_box.json", 307, "1=1", "*",
                             "23032", "json", envelope=FACILITY_BOX)
    by_name = {f["attributes"]["fclName"]: f for f in fac_raw["features"]}
    satellites = []
    for name in SATELLITES:
        a = by_name[name]["attributes"]
        g = by_name[name]["geometry"]
        d = oslo_date(a["fclStartupDate"])
        satellites.append({
            "id": f"sat-{a['fclNpdidFacility']}", "name": a["fclName"].title(),
            "kind": "satellite",
            "x": m1(g["x"] - cx), "y": m1(g["y"] - cy), "depth": int(a["fclWaterDepth"]),
            "inService": d.isoformat(), "firstFrame": first_frame(frames, d),
            "field": (a["fclBelongsToName"] or "—").title(),
            "distanceKm": r(math.hypot(g["x"] - cx, g["y"] - cy) / 1000.0, 1),
            "facts": {"Function": function_text(a["fclFunctions"]),
                      "Belongs to": (a["fclBelongsToName"] or "—").title(),
                      "Water depth": f"{int(a['fclWaterDepth'])} m",
                      "In service": long_date(d),
                      "Tied back to": "The same Norne FPSO"},
        })
    satellites.sort(key=lambda s: s["id"])

    fields23032 = factmaps_query(cache, "norway/neighbour_fields.geojson", 502,
                                 "fldName IN (" + ",".join(f"'{n}'" for n in NEIGHBOUR_FIELDS) + ")",
                                 FIELD_FIELDS, "23032", "geojson")
    outlines3d = []
    for f in fields23032["features"]:
        rings = [simplify(ring, OUTLINE_TOLERANCE_3D_M) for ring in polygon_rings(f)]
        rings = [ring for ring in rings if len(ring) >= 4]
        if not rings:
            continue
        outlines3d.append({"name": f["properties"]["fldName"],
                           "rings": [[[m1(x - cx), m1(y - cy)] for x, y in ring] for ring in rings]})
    outlines3d.sort(key=lambda o: o["name"])

    # ---- the highlighted Norne route, as one explicit polyline ------------------------------
    # Emitted so the app never has to decide which half of the trunk carries Norne's gas, and so
    # it is provable that the drawn route touches no refinery: riser base -> tee -> landfall.
    by_id = {p["id"]: p for p in pipelines}
    ex = by_id[NORNE_ROUTE_IDS[0]]["parts"][0]
    tr = max(by_id[NORNE_ROUTE_IDS[1]]["parts"], key=len)
    tee_ll = next((n["lon"], n["lat"]) for n in nodes if n["name"] == "NORNE/HEIDRUN T")
    lat0 = sum(q[1] for q in tr) / len(tr)
    sx, sy = deg_scale(lat0)
    tr_m = [(q[0] * sx, q[1] * sy) for q in tr]
    cut, _off, _len, landfall_end = split_at_tee(tr_m, (tee_ll[0] * sx, tee_ll[1] * sy))
    leg = list(reversed(tr[:cut + 1])) if landfall_end == "start" else tr[cut + 1:]
    route_pts = ex + [[r(tee_ll[0], 4), r(tee_ll[1], 4)]] + leg
    # the two legs, measured on the projected geometry in stage 1
    export_km = report["export"]["length_km"]
    trunk_km = report["trunk"]["tee_to_landfall_km"]
    route_km = export_km + trunk_km
    report["route"] = {"points": len(route_pts), "length_km": round(route_km, 1),
                       "ends_at": [route_pts[-1][0], route_pts[-1][1]]}

    report["network"] = {
        "pipelines": len(pipelines), "pipeline_points": sum(len(p) for d in pipelines for p in d["parts"]),
        "dropped_parts": dropped_parts, "terminals": len(terminals),
        "unlocated_terminals": unlocated, "nodes": len(nodes),
        "outlines": len(outlines), "outline_points": sum(len(rg) for o in outlines for rg in o["rings"]),
        "satellites": len(satellites),
        "outlines3d_points": sum(len(rg) for o in outlines3d for rg in o["rings"]),
    }

    return {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "norne-topside-network",
        "stage": 2,
        "generated": BUILD_DATE,
        "sources": {
            "pipelines": f"Norwegian Offshore Directorate, FactMaps layer 311, retrieved {RETRIEVED}",
            "facilities": f"Norwegian Offshore Directorate, FactMaps layer 307, retrieved {RETRIEVED}",
            "fields": f"Norwegian Offshore Directorate, FactMaps layer 502, retrieved {RETRIEVED}",
            "coastline": f"Natural Earth 1:50m physical coastline {version}, public domain",
            "trade": "Eurostat, imports of natural gas / of oil and petroleum products by "
                     "partner country, partner Norway, 2023",
            "licence": "NLOD 2.0 (the Directorate's layers); public domain (Natural Earth); "
                       "reuse authorised with the source acknowledged (Eurostat)",
            "changes": "multi-part lines rejoined and detached stubs dropped, coastline clipped "
                       "to north-west Europe and simplified to 1 km, field outlines simplified, "
                       "coordinates rounded",
        },
        "crs": {
            "panel": "WGS84 lon/lat (EPSG:4326), reprojected by the publisher's own service",
            "area": "metres relative to the model centre, ED50 / UTM 32N assumed",
            "note": "The flat panel is drawn in Web Mercator. Lengths are measured along the "
                    "real route, not off the map.",
        },
        "modelCentre": [r(cx, 2), r(cy, 2)],
        "bbox": list(NET_BBOX),
        "norneRoute": NORNE_ROUTE_IDS,
        "norneRoutePath": {
            "points": route_pts,
            "lengthKm": r(route_km, 1),
            "segments": [
                {"id": NORNE_ROUTE_IDS[0], "name": by_id[NORNE_ROUTE_IDS[0]]["name"],
                 "from": "NORNE ERB", "to": "NORNE/HEIDRUN T", "lengthKm": r(export_km, 1)},
                {"id": NORNE_ROUTE_IDS[1], "name": by_id[NORNE_ROUTE_IDS[1]]["name"],
                 "from": "NORNE/HEIDRUN T", "to": "KALSTØ landfall", "lengthKm": r(trunk_km, 1)},
            ],
        },
        "routeNote": "The published gas route: the 16-inch line from the Norne riser base to the "
                     "Norne/Heidrun tee, then the Åsgard Transport trunk to the Kalstø landfall. "
                     "The Kårstø plant is 19.7 km further inland and no line between them is "
                     "published.",
        "oilExport": {
            "label": "shuttle tanker → sold worldwide",
            "note": "Oil leaves Norne by shuttle tanker. There is no published record of where a "
                    "cargo goes, so no destination is drawn. What is published is the trade "
                    "total below.",
            "eurostat": eurostat_figures(cache),
        },
        "coast": coast,
        "pipelines": pipelines,
        "terminals": terminals,
        "nodes": nodes,
        "fieldOutlines": outlines,
        "area": {"satellites": satellites, "fieldOutlines": outlines3d},
    }


# --------------------------------------------------------------------------------------------
# assertions the build refuses to write past
# --------------------------------------------------------------------------------------------

def percentile90(values):
    v = sorted(values)
    if not v:
        return 0.0
    i = (len(v) - 1) * 0.9
    lo, hi = math.floor(i), math.ceil(i)
    return v[lo] + (v[hi] - v[lo]) * (i - lo)


def check_stage1(doc: dict, model: dict, report: dict) -> None:
    fail = []
    frames = model["frames"]
    if doc["schemaVersion"] != SCHEMA_VERSION:
        fail.append("schemaVersion")
    if doc["frameCount"] != len(frames):
        fail.append(f"frameCount {doc['frameCount']} != {len(frames)}")
    for a, b in zip(doc["modelCentre"], model["center"]):
        if abs(a - b) > 0.01:
            fail.append(f"modelCentre {a} vs {b}")
    for k in ("oil", "gasSold", "water"):
        if len(doc["production"][k]) != len(frames):
            fail.append(f"production.{k} is {len(doc['production'][k])} long")
    if set(doc["wellTemplates"]) != {w["name"] for w in model["wells"]}:
        fail.append("wellTemplates does not match model.json's well set")
    if "fixture" in doc:
        fail.append("the shipped file must not carry the fixture flag")

    fpso = next(f for f in doc["facilities"] if f["id"] == "fpso")
    if (fpso["x"], fpso["y"]) != (-463, 316):
        fail.append(f"FPSO offset {(fpso['x'], fpso['y'])} != (-463, 316)")

    counts = {}
    for f_i in (0, 1, 9, 108, 109):
        counts[f_i] = sum(1 for f in doc["facilities"]
                          if f["kind"] == "template" and 0 <= f["firstFrame"] <= f_i)
    report["template_counts"] = counts
    if [counts[i] for i in (0, 1, 9, 108)] != [3, 4, 5, 6]:
        fail.append(f"template counts per frame {counts} != 3/4/5/6 at frames 0/1/9/108")
    if next(f for f in doc["facilities"] if f["id"] == "tpl-M")["firstFrame"] != -1:
        fail.append("template M must never appear inside this history")

    export = next(l for l in doc["lines"] if l["id"] == "export-16")
    first_gas = report["production"]["first_gas_frame"]
    if export["firstFrame"] != first_gas:
        fail.append(f"export line frame {export['firstFrame']} != first reported gas {first_gas}")

    # the flow reference must not drift away from the shipped constants
    wells = model["summary"]["wells"]
    drift = {}
    for k in ("oil", "water", "gas", "winj", "ginj"):
        live = percentile90([v for w in wells.values() for v in w.get(k, []) if v > 0])
        shipped = FLOW_REFERENCE[k]
        drift[k] = (round(live, 1), shipped, round(abs(live - shipped) / shipped, 4))
        if abs(live - shipped) / shipped > DRIFT_TOLERANCE:
            fail.append(f"flowReference.{k}: shipped {shipped}, model says {live:.0f}")
    report["flow_drift"] = drift

    for f in doc["facilities"] + doc["lines"]:
        if f.get("schematic") and not f.get("facts"):
            fail.append(f"{f['id']} is schematic but carries no facts")
    if fail:
        raise SystemExit("error: stage 1 failed its own checks:\n  " + "\n  ".join(fail))


def check_stage2(doc: dict, report: dict) -> None:
    fail = []
    ids = {p["id"] for p in doc["pipelines"]}
    for rid in doc["norneRoute"]:
        if rid not in ids:
            fail.append(f"norneRoute names {rid}, which is not in the file")
    refineries = {t["name"] for t in doc["terminals"] if t.get("refinery")}
    if not refineries:
        fail.append("no refinery is labelled, so the 'not connected to Norne' note is missing")
    for t in doc["terminals"]:
        if t["connectedToNorne"]:
            fail.append(f"{t['name']} is marked as connected to Norne")
    # no drawn line may end at a refinery
    by_name = {t["name"]: t for t in doc["terminals"]}
    for p in doc["pipelines"]:
        if p["id"] in doc["norneRoute"] and (p["to"] in refineries or p["from"] in refineries):
            fail.append(f"the highlighted Norne route touches the refinery {p['to'] or p['from']}")
    path = doc["norneRoutePath"]["points"]
    landfall = next((t for t in doc["terminals"] if t["name"] == "KALSTØ"), None)
    if landfall is None:
        fail.append("the Kalstø landfall is missing from the terminals")
    else:
        lat0 = landfall["lat"]
        sx, sy = deg_scale(lat0)
        d = math.hypot((path[-1][0] - landfall["lon"]) * sx, (path[-1][1] - landfall["lat"]) * sy)
        if d > 1000:
            fail.append(f"the highlighted route ends {d:.0f} m from the Kalstø landfall")
        for t in doc["terminals"]:
            if not t.get("refinery"):
                continue
            near = min(math.hypot((q[0] - t["lon"]) * sx, (q[1] - t["lat"]) * sy) for q in path)
            if near < 5000:
                fail.append(f"the highlighted route passes {near:.0f} m from {t['name']}")
    report["refineries"] = sorted(refineries)
    report["refineries_present"] = sorted(n for n in refineries if n in by_name)
    if fail:
        raise SystemExit("error: stage 2 failed its own checks:\n  " + "\n  ".join(fail))


def no_urls(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    for bad in ("http://", "https://"):
        if bad in text:
            i = text.index(bad)
            raise SystemExit(f"error: {path.name} contains {bad} at {i}: "
                             f"{text[max(0, i - 60):i + 60]!r}")


def write_json(path: Path, doc: dict) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(doc, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
    path.write_text(text, encoding="utf-8")
    no_urls(path)
    return len(text.encode("utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# --------------------------------------------------------------------------------------------

def default_cache(here: Path) -> Path:
    """The research cache if it is beside the build folder, otherwise a cache under work/."""
    for candidate in (here.parent.parent.parent / "cache", here / "work" / "cache"):
        if candidate.exists():
            return candidate
    return here / "work" / "cache"


def main() -> None:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache", default=None,
                    help="download cache; nothing already in it is fetched again")
    ap.add_argument("--data-dir", default=str(here.parent / "data"))
    ap.add_argument("--no-network", action="store_true", help="skip stage 2")
    ap.add_argument("--offline", action="store_true",
                    help="fail instead of downloading anything the cache lacks")
    ap.add_argument("--report", action="store_true", help="print the build report as JSON")
    args = ap.parse_args()

    cache = Cache(Path(args.cache).resolve() if args.cache else default_cache(here),
                  offline=args.offline)
    data_dir = Path(args.data_dir).resolve()
    model = json.loads((data_dir / "model.json").read_text())
    report: dict = {"cache": str(cache.root), "dataDir": str(data_dir)}

    stage1 = build_stage1(cache, model, report)
    check_stage1(stage1, model, report)
    p1 = data_dir / "topside.json"
    b1 = write_json(p1, stage1)
    print(f"topside.json          {b1:>7,} B  sha256 {sha256(p1)}")
    print(f"  {len(stage1['facilities'])} facilities, {len(stage1['lines'])} lines, "
          f"{len(stage1['wellTemplates'])} wells, {stage1['frameCount']} frames, "
          f"templates per frame {report['template_counts']}")

    if not args.no_network:
        stage2 = build_stage2(cache, model, report)
        check_stage2(stage2, report)
        p2 = data_dir / "topside-network.json"
        b2 = write_json(p2, stage2)
        print(f"topside-network.json  {b2:>7,} B  sha256 {sha256(p2)}")
        print(f"  {len(stage2['pipelines'])} pipelines, {len(stage2['terminals'])} terminals, "
              f"{len(stage2['coast'])} coastline lines, "
              f"{len(stage2['fieldOutlines'])} field outlines, "
              f"{len(stage2['area']['satellites'])} satellites")

    if cache.log:
        print("fetched (everything else came from the cache):")
        for rel, method, url, n in cache.log:
            print(f"  {method:4s} {n:>8,} B  {rel}")
    else:
        print("fetched nothing: every input was already in the cache")

    if args.report:
        print(json.dumps(report, ensure_ascii=False, indent=1, default=str))


if __name__ == "__main__":
    main()
