"""Shared pieces of the Shelf Atlas / World Oil & Gas pipeline.

Everything here is standard library except the shapefile reader (pyshp) and the
Excel reader (openpyxl), both pure Python. There is deliberately no GDAL, no
mapshaper and no node: the whole build runs on a bare GitHub runner with
`pip install pyshp openpyxl`, and on a laptop the same way.

Contents
  fetch / cache   cache-first HTTP, so a rebuild from a warm cache costs no traffic
  ed50_to_wgs84   the datum shift Sodir's shapefiles and DMS facility positions need
  simplify        Visvalingam–Whyatt with a metric area threshold (lat/lon aware)
  encode_line     Google-polyline packing of a coordinate list at a chosen precision
  pack_u16        production series -> per-series scaled Uint16 bytes
  months          month index arithmetic (0 = January 1971)
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import math
import os
import re
import struct
import sys
import time
import urllib.error
import urllib.request
import zipfile

USER_AGENT = "shelf-atlas-pipeline/1.0 (+https://github.com/mtomasgaard/snuggery-apps-template)"
EPOCH_YEAR = 1971            # month index 0 = January 1971, the first North Sea oil (Ekofisk)
SM3_PER_BBL = 1 / 6.2898     # 1 bbl = 0.158987 m³
BBL_PER_SM3 = 6.2898
GAS_SM3_PER_SM3OE = 1000.0   # Sodir convention: 1000 Sm³ gas = 1 Sm³ o.e.
NGL_T_PER_SM3 = 1.9          # Sodir: 1 tonne NGL ≈ 1.9 Sm³ o.e. (NGL Sm³ ≈ 1.9 × tonnes)
FT3_PER_M3 = 35.3147


# ---------------------------------------------------------------------------
# logging
# ---------------------------------------------------------------------------

def log(*a):
    print(*a, file=sys.stderr, flush=True)


class BuildError(RuntimeError):
    """A condition the build refuses to paper over. Fail loudly, never write."""


# ---------------------------------------------------------------------------
# cache-first HTTP
# ---------------------------------------------------------------------------

class Cache:
    """cache.get(key, url) returns bytes; a file already on disk is never refetched
    unless `refresh` is set. Keys are paths under the cache directory."""

    def __init__(self, root: str, refresh: bool = False, offline: bool = False):
        self.root = root
        self.refresh = refresh
        self.offline = offline
        os.makedirs(root, exist_ok=True)

    def path(self, key: str) -> str:
        return os.path.join(self.root, key)

    def get(self, key: str, url: str, method: str = "GET", data: bytes | None = None,
            headers: dict | None = None, timeout: int = 180, retries: int = 4,
            accept_status=(200,)) -> bytes:
        p = self.path(key)
        if os.path.exists(p) and not self.refresh:
            with open(p, "rb") as f:
                return f.read()
        if self.offline:
            raise BuildError(f"offline and {key} is not cached")
        body = fetch(url, method=method, data=data, headers=headers, timeout=timeout,
                     retries=retries, accept_status=accept_status)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + ".part"
        with open(tmp, "wb") as f:
            f.write(body)
        os.replace(tmp, p)
        return body


def fetch(url: str, method: str = "GET", data: bytes | None = None, headers: dict | None = None,
          timeout: int = 180, retries: int = 4, accept_status=(200,)) -> bytes:
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, method=method,
                                     headers={"User-Agent": USER_AGENT, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if r.status not in accept_status:
                    raise BuildError(f"{url}: HTTP {r.status}")
                body = r.read()
                log(f"  fetched {len(body):>10,} B  {url[:110]}")
                return body
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
            last = e
            wait = 2 ** attempt
            log(f"  retry {attempt + 1}/{retries} in {wait}s: {url[:90]} ({e})")
            time.sleep(wait)
    raise BuildError(f"could not fetch {url}: {last}")


def read_zip_member(blob: bytes, suffix: str) -> bytes:
    z = zipfile.ZipFile(io.BytesIO(blob))
    for n in z.namelist():
        if n.lower().endswith(suffix.lower()):
            return z.read(n)
    raise BuildError(f"no *{suffix} in zip ({z.namelist()[:6]})")


# ---------------------------------------------------------------------------
# datum shift: ED50 -> WGS84
# ---------------------------------------------------------------------------
# Sodir's shapefiles and FactPages positions are ED50 (International 1924
# ellipsoid). The EPSG "ED50 to WGS 84 (1)" three-parameter geocentric
# translation (dx -87, dy -98, dz -121 m; EPSG:1133) is what everyone uses for
# the North Sea; the residual against the 7-parameter transformations Sodir's own
# FactMaps applies is a few metres, far below the 0.0001° (~6-11 m) the app's
# geometry is quantised to.

_INTL_A, _INTL_F = 6378388.0, 1 / 297.0
_WGS_A, _WGS_F = 6378137.0, 1 / 298.257223563


def _geodetic_to_ecef(lat, lon, a, f):
    e2 = f * (2 - f)
    lat, lon = math.radians(lat), math.radians(lon)
    n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    return (n * math.cos(lat) * math.cos(lon), n * math.cos(lat) * math.sin(lon),
            n * (1 - e2) * math.sin(lat))


def _ecef_to_geodetic(x, y, z, a, f):
    e2 = f * (2 - f)
    lon = math.atan2(y, x)
    p = math.hypot(x, y)
    lat = math.atan2(z, p * (1 - e2))
    for _ in range(6):
        n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
        lat = math.atan2(z + e2 * n * math.sin(lat), p)
    return math.degrees(lat), math.degrees(lon)


def ed50_to_wgs84(lat: float, lon: float) -> tuple[float, float]:
    x, y, z = _geodetic_to_ecef(lat, lon, _INTL_A, _INTL_F)
    return _ecef_to_geodetic(x - 87.0, y - 98.0, z - 121.0, _WGS_A, _WGS_F)


def dms(deg, minute, sec, hemi) -> float:
    v = float(deg or 0) + float(minute or 0) / 60 + float(sec or 0) / 3600
    return -v if str(hemi).strip().upper() in ("S", "W") else v


# ---------------------------------------------------------------------------
# geometry
# ---------------------------------------------------------------------------

def _tri_area_m2(p0, p1, p2, kx, ky):
    ax, ay = (p1[0] - p0[0]) * kx, (p1[1] - p0[1]) * ky
    bx, by = (p2[0] - p0[0]) * kx, (p2[1] - p0[1]) * ky
    return abs(ax * by - ay * bx) / 2


def simplify(coords, min_area_m2: float, closed: bool = False):
    """Visvalingam–Whyatt: drop the point whose triangle with its neighbours has the
    least area, until every remaining triangle is at least `min_area_m2`. Areas are
    in square metres on a local equirectangular approximation, so the threshold
    means the same thing at 52°N and 62°N. A ring keeps at least 4 points, a line 2."""
    pts = list(coords)
    if closed and len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)
    if n < 3:
        return pts + ([pts[0]] if closed and pts else [])
    lat0 = sum(p[1] for p in pts) / n
    kx, ky = 111320.0 * math.cos(math.radians(lat0)), 110574.0
    prev = list(range(-1, n - 1))
    nxt = list(range(1, n + 1))
    if closed:
        prev[0], nxt[-1] = n - 1, 0
    else:
        prev[0], nxt[-1] = -1, -1
    import heapq
    area = [math.inf] * n
    heap = []
    for i in range(n):
        if prev[i] >= 0 and nxt[i] >= 0:
            area[i] = _tri_area_m2(pts[prev[i]], pts[i], pts[nxt[i]], kx, ky)
            heap.append((area[i], i))
    heapq.heapify(heap)
    alive = [True] * n
    count = n
    floor = 4 if closed else 2
    while heap and count > floor:
        a, i = heapq.heappop(heap)
        if not alive[i] or a != area[i]:
            continue
        if a >= min_area_m2:
            break
        alive[i] = False
        count -= 1
        p, q = prev[i], nxt[i]
        if p >= 0:
            nxt[p] = q
        if q >= 0:
            prev[q] = p
        for j in (p, q):
            if j >= 0 and alive[j] and prev[j] >= 0 and nxt[j] >= 0:
                area[j] = max(a, _tri_area_m2(pts[prev[j]], pts[j], pts[nxt[j]], kx, ky))
                heapq.heappush(heap, (area[j], j))
    out = [pts[i] for i in range(n) if alive[i]]
    if closed:
        out.append(out[0])
    return out


def encode_line(coords, factor: int) -> str:
    """Google's polyline algorithm at an arbitrary precision (factor 1e4 = 4 decimals).
    lon first then lat, as GeoJSON orders them; the app's decoder mirrors this."""
    out = []
    px = py = 0
    for x, y in coords:
        qx, qy = round(x * factor), round(y * factor)
        for v in (qx - px, qy - py):
            v = ~(v << 1) if v < 0 else v << 1
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1F)) + 63))
                v >>= 5
            out.append(chr(v + 63))
        px, py = qx, qy
    return "".join(out)


def decode_line(s: str, factor: int):
    """The inverse, used by the pipeline's own self-check."""
    coords, i, x, y = [], 0, 0, 0
    while i < len(s):
        for k in range(2):
            shift = result = 0
            while True:
                b = ord(s[i]) - 63
                i += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            d = ~(result >> 1) if result & 1 else result >> 1
            if k == 0:
                x += d
            else:
                y += d
        coords.append((x / factor, y / factor))
    return coords


def ring_area_m2(ring) -> float:
    if len(ring) < 3:
        return 0.0
    lat0 = sum(p[1] for p in ring) / len(ring)
    kx, ky = 111320.0 * math.cos(math.radians(lat0)), 110574.0
    s = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        s += x0 * kx * y1 * ky - x1 * kx * y0 * ky
    return abs(s) / 2


def centroid(rings) -> tuple[float, float]:
    """Area-weighted centroid of the outer rings of a (multi)polygon, lon/lat."""
    sx = sy = sa = 0.0
    for ring in rings:
        a = ring_area_m2(ring)
        if a == 0 or len(ring) < 3:
            continue
        cx = sum(p[0] for p in ring[:-1]) / (len(ring) - 1)
        cy = sum(p[1] for p in ring[:-1]) / (len(ring) - 1)
        sx += cx * a
        sy += cy * a
        sa += a
    if sa == 0:
        pts = [p for r in rings for p in r]
        return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    return (sx / sa, sy / sa)


def bbox_of(geoms):
    xs = [p[0] for g in geoms for p in g]
    ys = [p[1] for g in geoms for p in g]
    return [min(xs), min(ys), max(xs), max(ys)]


def clip_line_to_bbox(coords, bbox):
    """Cut a line into the pieces inside a lon/lat box (Cohen–Sutherland per segment)."""
    x0, y0, x1, y1 = bbox
    pieces, cur = [], []
    for (ax, ay), (bx, by) in zip(coords, coords[1:]):
        seg = _clip_segment(ax, ay, bx, by, x0, y0, x1, y1)
        if seg is None:
            if cur:
                pieces.append(cur)
                cur = []
            continue
        (cax, cay), (cbx, cby) = seg
        if not cur or cur[-1] != (cax, cay):
            if cur:
                pieces.append(cur)
            cur = [(cax, cay)]
        cur.append((cbx, cby))
    if cur:
        pieces.append(cur)
    return [p for p in pieces if len(p) > 1]


def _clip_segment(ax, ay, bx, by, x0, y0, x1, y1):
    def code(x, y):
        return (x < x0) | ((x > x1) << 1) | ((y < y0) << 2) | ((y > y1) << 3)
    ca, cb = code(ax, ay), code(bx, by)
    while True:
        if not (ca | cb):
            return (ax, ay), (bx, by)
        if ca & cb:
            return None
        c = ca or cb
        if c & 8:
            x, y = ax + (bx - ax) * (y1 - ay) / (by - ay), y1
        elif c & 4:
            x, y = ax + (bx - ax) * (y0 - ay) / (by - ay), y0
        elif c & 2:
            x, y = x1, ay + (by - ay) * (x1 - ax) / (bx - ax)
        else:
            x, y = x0, ay + (by - ay) * (x0 - ax) / (bx - ax)
        if c == ca:
            ax, ay, ca = x, y, code(x, y)
        else:
            bx, by, cb = x, y, code(x, y)


def clip_polygon_to_bbox(ring, bbox):
    """Sutherland–Hodgman clip of one ring to a lon/lat box. Returns a ring (may be empty)."""
    x0, y0, x1, y1 = bbox
    def clip(pts, inside, intersect):
        out = []
        if not pts:
            return out
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(intersect(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(intersect(prev, cur))
            prev = cur
        return out
    def ix(p, q, x):
        t = (x - p[0]) / (q[0] - p[0])
        return (x, p[1] + t * (q[1] - p[1]))
    def iy(p, q, y):
        t = (y - p[1]) / (q[1] - p[1])
        return (p[0] + t * (q[0] - p[0]), y)
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else list(ring)
    pts = clip(pts, lambda p: p[0] >= x0, lambda p, q: ix(p, q, x0))
    pts = clip(pts, lambda p: p[0] <= x1, lambda p, q: ix(p, q, x1))
    pts = clip(pts, lambda p: p[1] >= y0, lambda p, q: iy(p, q, y0))
    pts = clip(pts, lambda p: p[1] <= y1, lambda p, q: iy(p, q, y1))
    if len(pts) < 3:
        return []
    return pts + [pts[0]]


def shapefile_records(blob: bytes):
    """Yield (record dict, shape) pairs from a zipped shapefile, via pyshp."""
    import shapefile  # pyshp
    z = zipfile.ZipFile(io.BytesIO(blob))
    parts = {}
    for n in z.namelist():
        ext = n.rsplit(".", 1)[-1].lower()
        if ext in ("shp", "shx", "dbf"):
            parts[ext] = io.BytesIO(z.read(n))
    if "shp" not in parts or "dbf" not in parts:
        raise BuildError(f"zip is not a shapefile: {z.namelist()}")
    r = shapefile.Reader(shp=parts["shp"], shx=parts.get("shx"), dbf=parts["dbf"], encoding="latin1")
    fields = [f[0] for f in r.fields[1:]]
    for sr in r.iterShapeRecords():
        yield dict(zip(fields, sr.record)), sr.shape


def shape_rings(shape):
    """Split a pyshp polygon/polyline shape into its parts as lists of (x, y)."""
    pts = shape.points
    parts = list(shape.parts) + [len(pts)]
    return [[tuple(p[:2]) for p in pts[a:b]] for a, b in zip(parts, parts[1:]) if b - a > 1]


# ---------------------------------------------------------------------------
# months and series
# ---------------------------------------------------------------------------

def month_index(year: int, month: int) -> int:
    return (int(year) - EPOCH_YEAR) * 12 + int(month) - 1


def month_label(idx: int) -> str:
    return f"{EPOCH_YEAR + idx // 12}-{idx % 12 + 1:02d}"


def pack_u16(values: list[float]) -> tuple[bytes, float]:
    """Scale a non-negative series so its maximum is 65535 and pack as little-endian
    Uint16. Returns (bytes, scale) with value ≈ code × scale. An all-zero series
    packs with scale 0."""
    mx = max(values) if values else 0.0
    if mx <= 0:
        return b"\0\0" * len(values), 0.0
    scale = mx / 65535.0
    codes = [min(65535, max(0, round(v / scale))) for v in values]
    return struct.pack("<%dH" % len(codes), *codes), scale


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def sha256_short(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()[:12]


def write_json(path: str, obj, indent=None):
    """Writes obj as compact JSON. If the file already exists and differs ONLY in its
    `generatedAt`, the old stamp is kept and the bytes stay identical, so a weekly build
    whose sources did not move commits nothing (the repository's rule)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if isinstance(obj, dict) and "generatedAt" in obj and os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                old = json.load(f)
            if isinstance(old, dict) and "generatedAt" in old:
                a = dict(old); b = dict(obj)
                a.pop("generatedAt"); b.pop("generatedAt")
                if json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True):
                    obj = dict(obj, generatedAt=old["generatedAt"])
                    log(f"  unchanged apart from the stamp; keeping {old['generatedAt']}  {path}")
        except (ValueError, OSError):
            pass
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), indent=indent, sort_keys=False)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(s)
        f.write("\n")
    os.replace(tmp, path)
    log(f"  wrote {os.path.getsize(path):>10,} B  {path}")


def norm_name(s: str) -> str:
    """Field-name key for cross-source matching: upper-case ASCII letters and digits
    only. 'Statfjord Øst' -> 'STATFJORDOST', 'Ekofisk (Unit)' -> 'EKOFISKUNIT'."""
    s = (s or "").upper()
    for a, b in (("Ø", "O"), ("Æ", "AE"), ("Å", "A"), ("Ä", "A"), ("Ö", "O"), ("Ü", "U"), ("É", "E")):
        s = s.replace(a, b)
    return re.sub(r"[^A-Z0-9]", "", s)


def parse_no_date(s: str) -> str | None:
    """'26.11.1972' -> '1972-11-26'."""
    m = re.match(r"\s*(\d{1,2})\.(\d{1,2})\.(\d{4})", s or "")
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else None
