"""Shared pieces of the US Quakes pipeline.

Adapted from Template/scripts/shelf_atlas/common.py (cache-first HTTP, Visvalingam-Whyatt
simplification, polyline packing, bbox clipping) and Template/earth-history/tools/common.py
(sha256-pinned fetch, deterministic writes, the fixed retrieval date). Copied, never imported across
apps, so deleting one app cannot break another.

Standard library plus `requests` only at import time: refresh.py, which a bare GitHub runner runs
every hour, imports this module after `pip install requests` and nothing else. pyshp is imported
inside the one function that needs it.

Contents
  log, BuildError       loud failure; the build never writes a partial file
  http_get              one GET with retries and the pipeline's User-Agent
  Cache                 cache-first GET keyed by a path under CACHE
  fetch_pinned          GET once, verify sha256 (and size), keep for good
  write_json / write_bin deterministic output: fixed float format, no dates unless passed in
  simplify, encode_line, decode_line, clip_line_to_bbox, clip_polygon_to_bbox, ring_area_m2
  shapefile_records, shape_rings
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import os
import sys
import time
import zipfile
import zlib

import requests

from paths import CACHE

# Fixed, not today(): the date every static source listed in CREDITS.txt was retrieved. Keeping it
# a constant is what makes a later rebuild byte-identical.
RETRIEVED = '2026-09-30'

USER_AGENT = 'us-quakes-pipeline/1.0 (+https://github.com/mtomasgaard/snuggery-apps-template)'


# ---------------------------------------------------------------------------
# logging
# ---------------------------------------------------------------------------

def log(*a):
    print(*a, file=sys.stderr, flush=True)


class BuildError(RuntimeError):
    """A condition the build refuses to paper over. Fail loudly, never write."""


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

_session = None


def _s():
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers['User-Agent'] = USER_AGENT
    return _session


def http_get(url: str, params: dict | None = None, timeout: int = 300, retries: int = 5,
             accept_status=(200,), stream_to: str | None = None) -> bytes | None:
    """GET with exponential back-off. USGS answers an overloaded query with 503 or 504 (seen on
    2026-09-30 for a count over millions of rows), so those are retried like network errors.
    With `stream_to`, the body goes to that file (via .part) and None is returned."""
    last = None
    for attempt in range(retries):
        try:
            r = _s().get(url, params=params, timeout=timeout, stream=bool(stream_to))
            if r.status_code in accept_status:
                if stream_to:
                    os.makedirs(os.path.dirname(stream_to), exist_ok=True)
                    tmp = stream_to + '.part'
                    with open(tmp, 'wb') as f:
                        for chunk in r.iter_content(1 << 20):
                            f.write(chunk)
                    os.replace(tmp, stream_to)
                    log(f'  fetched {os.path.getsize(stream_to):>11,} B  {r.url[:120]}')
                    return None
                log(f'  fetched {len(r.content):>11,} B  {r.url[:120]}')
                return r.content
            last = f'HTTP {r.status_code}: {r.text[:200]!r}'
            if r.status_code not in (429, 500, 502, 503, 504):
                break
        except requests.RequestException as e:
            last = repr(e)
        wait = 2 ** (attempt + 1)
        log(f'  retry {attempt + 1}/{retries} in {wait}s: {url[:90]} ({last[:120]})')
        time.sleep(wait)
    raise BuildError(f'could not fetch {url} {params or ""}: {last}')


class Cache:
    """cache.get(key, url) returns bytes; a file already on disk is never refetched unless
    `refresh` is set. Keys are paths under the cache directory."""

    def __init__(self, root: str = CACHE, refresh: bool = False, offline: bool = False):
        self.root = root
        self.refresh = refresh
        self.offline = offline
        os.makedirs(root, exist_ok=True)

    def path(self, key: str) -> str:
        return os.path.join(self.root, key)

    def has(self, key: str) -> bool:
        return os.path.exists(self.path(key))

    def get(self, key: str, url: str, params: dict | None = None, **kw) -> bytes:
        p = self.path(key)
        if os.path.exists(p) and not self.refresh:
            with open(p, 'rb') as f:
                return f.read()
        if self.offline:
            raise BuildError(f'offline and {key} is not cached')
        body = http_get(url, params=params, **kw)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + '.part'
        with open(tmp, 'wb') as f:
            f.write(body)
        os.replace(tmp, p)
        return body


def sha256_of(path: str, bufsize: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            b = f.read(bufsize)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def fetch_pinned(url: str, name: str, sha256: str, size: int | None = None,
                 params: dict | None = None) -> str:
    """Return the local path of `url`, cached as CACHE/name, verified against `sha256` (and
    `size` when given). A changed upstream file stops the build instead of changing the app."""
    dest = os.path.join(CACHE, name)
    if not os.path.exists(dest):
        http_get(url, params=params, stream_to=dest)
    got = sha256_of(dest)
    if got != sha256:
        bad = dest + '.mismatch'
        os.replace(dest, bad)
        raise BuildError(f'{url}: sha256 {got} does not match the pin {sha256} (kept as {bad}). '
                         'The upstream file changed; check it and update the pin deliberately.')
    if size is not None and os.path.getsize(dest) != size:
        raise BuildError(f'{dest}: {os.path.getsize(dest)} bytes, the pin says {size}')
    return dest


def read_zip_member(path_or_blob, suffix: str) -> bytes:
    src = io.BytesIO(path_or_blob) if isinstance(path_or_blob, (bytes, bytearray)) else path_or_blob
    z = zipfile.ZipFile(src)
    for n in z.namelist():
        if n.lower().endswith(suffix.lower()):
            return z.read(n)
    raise BuildError(f'no *{suffix} in zip ({z.namelist()[:6]})')


# ---------------------------------------------------------------------------
# deterministic output
# ---------------------------------------------------------------------------

def _round_floats(o, nd):
    if isinstance(o, float):
        return round(o, nd)
    if isinstance(o, list):
        return [_round_floats(v, nd) for v in o]
    if isinstance(o, dict):
        return {k: _round_floats(v, nd) for k, v in o.items()}
    return o


def write_json(path: str, obj, max_bytes: int | None = None, ndigits: int = 6):
    """Compact JSON, keys in insertion order, floats rounded to `ndigits`. Refuses to write more
    than `max_bytes` (the budget is asserted, never discovered on the phone). If the file exists
    and differs ONLY in its `generatedAt`, the old stamp is kept so an unchanged build commits
    nothing."""
    obj = _round_floats(obj, ndigits)
    if isinstance(obj, dict) and 'generatedAt' in obj and os.path.exists(path):
        try:
            with open(path, encoding='utf-8') as f:
                old = json.load(f)
            if isinstance(old, dict) and 'generatedAt' in old:
                a, b = dict(old), dict(obj)
                a.pop('generatedAt'); b.pop('generatedAt')
                if json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True):
                    obj = dict(obj, generatedAt=old['generatedAt'])
        except (ValueError, OSError):
            pass
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '\n'
    data = s.encode('utf-8')
    if max_bytes is not None and len(data) > max_bytes:
        raise BuildError(f'{path}: {len(data):,} B exceeds its budget of {max_bytes:,} B; nothing written')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)
    log(f'  wrote {len(data):>11,} B  {path}')


def write_bin(path: str, data: bytes, max_bytes: int | None = None):
    """A little-endian headerless .bin (Milky Way's CONTRACT rule: always paired with a sibling
    .json that documents the layout, which the caller writes with write_json)."""
    if max_bytes is not None and len(data) > max_bytes:
        raise BuildError(f'{path}: {len(data):,} B exceeds its budget of {max_bytes:,} B; nothing written')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)
    log(f'  wrote {len(data):>11,} B  {path}')


# ---------------------------------------------------------------------------
# geometry (copied from shelf_atlas/common.py)
# ---------------------------------------------------------------------------

def _tri_area_m2(p0, p1, p2, kx, ky):
    ax, ay = (p1[0] - p0[0]) * kx, (p1[1] - p0[1]) * ky
    bx, by = (p2[0] - p0[0]) * kx, (p2[1] - p0[1]) * ky
    return abs(ax * by - ay * bx) / 2


def simplify(coords, min_area_m2: float, closed: bool = False, scale=None):
    """Visvalingam-Whyatt: drop the point whose triangle with its neighbours has the least area,
    until every remaining triangle is at least `min_area_m2`. Areas are square metres on a local
    equirectangular approximation, so the threshold means the same at 19°N and 65°N. A ring keeps
    at least 4 points, a line 2.

    `scale`, when given, is a function (x, y) -> the multiple of `min_area_m2` that holds at that
    vertex (build_geo.py's basemap past the axis): the points are then ranked by their triangle's
    area over their own threshold and dropped while that ratio is under 1, so one ring or line is
    simplified in one pass, finer where the threshold is lower, with no seam between the zones.
    Without it the code below is the original, unchanged, so every other layer is byte-identical."""
    import heapq
    pts = list(coords)
    if closed and len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)
    if n < 3:
        return pts + ([pts[0]] if closed and pts else [])
    lat0 = sum(p[1] for p in pts) / n
    kx, ky = 111320.0 * math.cos(math.radians(lat0)), 110574.0
    if scale is not None:
        return _simplify_scaled(pts, n, closed, kx, ky, [min_area_m2 * scale(p[0], p[1]) for p in pts])
    prev = list(range(-1, n - 1))
    nxt = list(range(1, n + 1))
    if closed:
        prev[0], nxt[-1] = n - 1, 0
    else:
        prev[0], nxt[-1] = -1, -1
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


def _simplify_scaled(pts, n, closed, kx, ky, lim):
    """simplify() with a threshold per vertex: the effective area is the triangle's over its own
    limit, kept non-decreasing as Visvalingam-Whyatt keeps it, and points go while it is under 1."""
    import heapq
    prev = list(range(-1, n - 1))
    nxt = list(range(1, n + 1))
    if closed:
        prev[0], nxt[-1] = n - 1, 0
    else:
        prev[0], nxt[-1] = -1, -1
    area = [math.inf] * n
    heap = []
    for i in range(n):
        if prev[i] >= 0 and nxt[i] >= 0:
            area[i] = _tri_area_m2(pts[prev[i]], pts[i], pts[nxt[i]], kx, ky) / lim[i]
            heap.append((area[i], i))
    heapq.heapify(heap)
    alive = [True] * n
    count = n
    floor = 4 if closed else 2
    while heap and count > floor:
        a, i = heapq.heappop(heap)
        if not alive[i] or a != area[i]:
            continue
        if a >= 1.0:
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
                area[j] = max(a, _tri_area_m2(pts[prev[j]], pts[j], pts[nxt[j]], kx, ky) / lim[j])
                heapq.heappush(heap, (area[j], j))
    out = [pts[i] for i in range(n) if alive[i]]
    if closed:
        out.append(out[0])
    return out


def encode_line(coords, factor: int) -> str:
    """Google's polyline algorithm at an arbitrary precision (factor 1e3 = 3 decimals), lon first
    then lat as GeoJSON orders them; the app's decoder mirrors this."""
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
    return ''.join(out)


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


def unwrap_lon(lon: float, west: float = 172.0) -> float:
    """Longitude on the app's continuous 172°E -> 64°W axis: anything west of `west` (i.e. the
    Americas at -180..-65) gains 360, so the Aleutians do not split at the date line.
    172.5 -> 172.5, -179 -> 181, -150 -> 210, -66 -> 294."""
    return lon + 360.0 if lon < west else lon


def ring_area_m2(ring) -> float:
    if len(ring) < 3:
        return 0.0
    lat0 = sum(p[1] for p in ring) / len(ring)
    kx, ky = 111320.0 * math.cos(math.radians(lat0)), 110574.0
    s = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        s += x0 * kx * y1 * ky - x1 * kx * y0 * ky
    return abs(s) / 2


def clip_line_to_bbox(coords, bbox):
    """Cut a line into the pieces inside a lon/lat box (Cohen-Sutherland per segment)."""
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
    """Sutherland-Hodgman clip of one ring to a lon/lat box. Returns a ring (may be empty)."""
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


def shapefile_records(zip_path: str, stem: str | None = None):
    """Yield (record dict, shape) pairs from a zipped shapefile via pyshp (build-time only).
    `stem` picks one shapefile when the zip holds several."""
    import shapefile  # pyshp
    z = zipfile.ZipFile(zip_path)
    parts = {}
    encoding = 'latin1'
    for n in z.namelist():
        base, _, ext = n.rpartition('.')
        if stem and not base.lower().endswith(stem.lower()):
            continue
        if ext.lower() in ('shp', 'shx', 'dbf'):
            parts[ext.lower()] = io.BytesIO(z.read(n))
        elif ext.lower() == 'cpg':
            # The .cpg names the .dbf's code page. The fault database's says UTF-8; reading it as
            # latin1 turns 'La Cañada' into 'La CaÃ±ada' (seen 2026-09-30).
            encoding = z.read(n).decode('ascii', 'replace').strip() or encoding
    if 'shp' not in parts or 'dbf' not in parts:
        raise BuildError(f'{zip_path}: no shapefile{" " + stem if stem else ""} in {z.namelist()[:8]}')
    r = shapefile.Reader(shp=parts['shp'], shx=parts.get('shx'), dbf=parts['dbf'], encoding=encoding)
    fields = [f[0] for f in r.fields[1:]]
    for sr in r.iterShapeRecords():
        yield dict(zip(fields, sr.record)), sr.shape


def shape_rings(shape):
    """Split a pyshp polygon/polyline shape into its parts as lists of (x, y)."""
    pts = shape.points
    parts = list(shape.parts) + [len(pts)]
    return [[tuple(p[:2]) for p in pts[a:b]] for a, b in zip(parts, parts[1:]) if b - a > 1]


# ---------------------------------------------------------------------------
# time: minutes since 1600-01-01T00:00Z (tools/CONTRACT.md §0), exact integer arithmetic
# ---------------------------------------------------------------------------

import datetime as _dt
from decimal import ROUND_HALF_UP, Decimal

EPOCH_ISO = '1600-01-01T00:00:00Z'
_EPOCH_ORD = _dt.date(1600, 1, 1).toordinal()


def parse_time_ms(text: str) -> int:
    """'2019-07-06T03:19:53.040Z' -> milliseconds since the epoch, exactly (no float). Digits past
    the millisecond are truncated; ComCat gives three at most."""
    if not text.endswith('Z') or len(text) < 20 or text[10] != 'T':
        raise BuildError(f'unexpected time text {text!r}')
    d = _dt.date(int(text[0:4]), int(text[5:7]), int(text[8:10])).toordinal() - _EPOCH_ORD
    h, mi, s = int(text[11:13]), int(text[14:16]), int(text[17:19])
    frac = text[20:-1] if text[19] == '.' else ''
    ms = int((frac + '000')[:3]) if frac else 0
    return ((d * 86400 + h * 3600 + mi * 60 + s) * 1000) + ms


def minutes_of(text: str) -> int:
    """Minutes since the epoch, truncated (CONTRACT §1, column t)."""
    return parse_time_ms(text) // 60000


def iso_of_minutes(m: int) -> str:
    d, rem = divmod(m, 1440)
    day = _dt.date.fromordinal(_EPOCH_ORD + d)
    return f'{day.isoformat()}T{rem // 60:02d}:{rem % 60:02d}:00Z'


def minutes_of_date(iso_date: str) -> int:
    """'2026-01-01' -> minutes since the epoch at that midnight UTC."""
    return (_dt.date.fromisoformat(iso_date).toordinal() - _EPOCH_ORD) * 1440


def half_up(value: Decimal) -> int:
    """Round a Decimal to the nearest integer, halves away from zero for positives (ROUND_HALF_UP)."""
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


DEPTH_FIXED_CODE = 1500                       # (10 + 5) x 100: the catalog's 10 km, and nothing else


def depth_code(depth: Decimal) -> int:
    """The depth column's code (CONTRACT §1): (depth_km + 5) x 100, rounded half up, except that
    1500 is kept for a catalog depth of exactly 10. A depth that is not 10 but would round to 1500
    (9.995 up to 10.005) is written 1499 below 10 and 1501 above it, the nearer of the two, so code
    1500 always means "10 as the catalog lists it" (the fixed depth USGS assigns, DESIGN §24, §25).
    Out-of-range codes are the caller's to catch. build_history.py and refresh.py both code with
    this; verify_static.py, verify_snapshot.py and the app's test_decode.mjs repeat the rule on their own."""
    d = half_up((depth + 5) * 100)
    if d == DEPTH_FIXED_CODE and depth != 10:
        d = DEPTH_FIXED_CODE - 1 if depth < 10 else DEPTH_FIXED_CODE + 1
    return d


# ---------------------------------------------------------------------------
# Web Mercator (EPSG:3857, the sphere of radius 6,378,137 m the 3DEP service uses)
# ---------------------------------------------------------------------------

MERC_R = 6378137.0


def merc_lon(x: float) -> float:
    return math.degrees(x / MERC_R)


def merc_lat(y: float) -> float:
    return math.degrees(math.atan(math.sinh(y / MERC_R)))


def merc_x(lon: float) -> float:
    return math.radians(lon) * MERC_R


def merc_y(lat: float) -> float:
    return MERC_R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


# ---------------------------------------------------------------------------
# sizes as the ZIP stores them
# ---------------------------------------------------------------------------

def zip_stored_size(data: bytes, level: int = 6) -> int:
    """Bytes a ZIP entry takes for `data` the way `zip -r -X` (Info-ZIP, default level 6, the
    build-zips.yml command) stores it: deflated, or stored when deflate does not shrink it. Raw
    deflate stream size, without the entry's header (a few dozen bytes)."""
    c = zlib.compressobj(level, zlib.DEFLATED, -15)
    n = len(c.compress(data)) + len(c.flush())
    return min(n, len(data))


# ---------------------------------------------------------------------------
# credits fragments (CONTRACT §0): every step says which sources it read and what it changed
# ---------------------------------------------------------------------------

CREDITS_WORK = os.path.join(CACHE, 'work', 'credits')


def write_credits_fragment(step: str, entries: list):
    """entries: [{id, source: [str], adaptations: [str], retrieved: str, ...}]. Deterministic:
    written with sorted keys, no clock. build_about.py joins them with sources.CREDIT."""
    for e in entries:
        if 'id' not in e:
            raise BuildError(f'credits fragment {step}: entry without id')
    os.makedirs(CREDITS_WORK, exist_ok=True)
    path = os.path.join(CREDITS_WORK, step + '.json')
    with open(path + '.tmp', 'w', encoding='utf-8') as f:
        json.dump({'step': step, 'sources': entries}, f, ensure_ascii=False, sort_keys=True, indent=1)
        f.write('\n')
    os.replace(path + '.tmp', path)
    log(f'  credits fragment {path}')


def read_credits_fragments(order: list) -> dict:
    """{step: fragment} for the steps in `order` that wrote one."""
    out = {}
    for step in order:
        p = os.path.join(CREDITS_WORK, step + '.json')
        if os.path.exists(p):
            with open(p, encoding='utf-8') as f:
                out[step] = json.load(f)
    return out


def group(n) -> str:
    """Thousands grouped with a narrow no-break space (U+202F), the apps' SI rule (plan D15): 12 565."""
    s = str(int(n))
    out = ''
    while len(s) > 3:
        out = ' ' + s[-3:] + out
        s = s[:-3]
    return s + out
