"""Shared pieces of the Warming World pipeline.

Adapted from Template/scripts/shelf_atlas/common.py (cache-first HTTP, loud failure,
Visvalingam-Whyatt simplification) and Template/scripts/us_quakes/common.py (sha256-pinned fetch,
deterministic writes with size budgets, the fixed retrieval date, the narrow-no-break-space
grouping). Copied, never imported across apps, so deleting one app cannot break another.

Standard library plus `requests` only: the monthly refresh, which a bare GitHub runner runs after
`pip install requests`, imports this module and nothing else of the venv. The GISTEMP grid is read
by netcdf3.py, also standard library.

Contents
  log, BuildError         loud failure; the build never writes a partial file
  http_get                one GET with retries and the pipeline's User-Agent, optionally streamed
  Cache                   cache-first GET keyed by a path under CACHE
  fetch_pinned            GET once, verify sha256 (and size), keep for good
  write_json / write_bin  deterministic output: compact JSON, rounded floats, asserted budgets
  zip_stored_size         what a file costs inside the ZIP (deflate level 6, as build-zips.yml)
  simplify, delta_encode  Natural Earth to Global Weather's world.json shape
  group                   thousands grouped with U+202F, the apps' SI rule (plan D15)
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
import time
import zlib

import requests

from paths import CACHE

# Fixed, not today(): the date every static source in CREDITS.txt was retrieved. Keeping it a
# constant is what makes a later rebuild byte-identical. The live GISTEMP grid carries its own
# date (its newest month and the file's Last-Modified), written into the snapshot by the refresh.
RETRIEVED = '2026-09-30'

USER_AGENT = 'warming-world-pipeline/1.0 (+https://github.com/mtomasgaard/snuggery-apps-template)'


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
             accept_status=(200,), stream_to: str | None = None,
             headers_out: dict | None = None) -> bytes | None:
    """GET with exponential back-off; 429 and 5xx are retried like network errors. With
    `stream_to`, the body goes to that file (via .part, resumed with a Range request when a .part
    is already there: data.giss.nasa.gov dropped a 26 MB transfer at 10.7 MB on 2026-09-30) and
    None is returned. With `headers_out`, the final response's headers are copied into it (the
    refresh records GISS's Last-Modified)."""
    last = None
    for attempt in range(retries):
        try:
            headers = {}
            tmp = (stream_to + '.part') if stream_to else None
            have = os.path.getsize(tmp) if tmp and os.path.exists(tmp) else 0
            if have:
                headers['Range'] = f'bytes={have}-'
            r = _s().get(url, params=params, timeout=timeout, stream=bool(stream_to), headers=headers)
            if stream_to and r.status_code == 206:
                pass                                  # resuming: append below
            elif r.status_code in accept_status:
                have = 0                              # a full answer: start the file again
            else:
                last = f'HTTP {r.status_code}: {r.text[:200]!r}'
                if r.status_code not in (416, 429, 500, 502, 503, 504):
                    break
                if r.status_code == 416 and tmp and os.path.exists(tmp):
                    os.remove(tmp)                    # the .part is longer than the file: restart
                raise requests.RequestException(last)
            if headers_out is not None:
                headers_out.clear()
                headers_out.update(r.headers)
            if stream_to:
                os.makedirs(os.path.dirname(stream_to), exist_ok=True)
                with open(tmp, 'ab' if have else 'wb') as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
                os.replace(tmp, stream_to)
                log(f'  fetched {os.path.getsize(stream_to):>11,} B  {r.url[:120]}')
                return None
            log(f'  fetched {len(r.content):>11,} B  {r.url[:120]}')
            return r.content
        except requests.RequestException as e:
            last = repr(e)
        wait = 2 ** (attempt + 1)
        log(f'  retry {attempt + 1}/{retries} in {wait}s: {url[:90]} ({str(last)[:120]})')
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
    """Return the local path of `url`, cached as CACHE/name, verified against `sha256` (and `size`
    when given). A changed upstream file stops the build instead of changing the app.

    For the static sources only (Natural Earth, the research copy of the GISTEMP grid). The
    monthly refresh cannot pin GISTEMP by hash, because GISS rewrites the file every month; it pins
    the file's contract instead (variable, dtype, scale, fill, grid, time units: sources.GISTEMP)."""
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


def write_json(path: str, obj, max_bytes: int | None = None, ndigits: int = 6, keep_stamp: bool = True):
    """Compact JSON, keys in insertion order, floats rounded to `ndigits`. Refuses to write more
    than `max_bytes` (the budget is asserted, never discovered on the phone). If the file exists
    and differs ONLY in its `generatedAt`, the old stamp is kept so an unchanged build commits
    nothing (keep_stamp=False: a file whose stamp is copied from another, which is stable already)."""
    obj = _round_floats(obj, ndigits)
    if keep_stamp and isinstance(obj, dict) and 'generatedAt' in obj and os.path.exists(path):
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
    """A little-endian headerless .bin, always paired with a sibling .json that documents the
    layout (Milky Way's CONTRACT rule), which the caller writes with write_json."""
    if max_bytes is not None and len(data) > max_bytes:
        raise BuildError(f'{path}: {len(data):,} B exceeds its budget of {max_bytes:,} B; nothing written')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)
    log(f'  wrote {len(data):>11,} B  {path}')


def zip_stored_size(data: bytes, level: int = 6) -> int:
    """Bytes a ZIP entry takes for `data` the way `zip -r -X` (Info-ZIP, default level 6, the
    build-zips.yml command) stores it: deflated, or stored when deflate does not shrink it. Raw
    deflate stream size, without the entry's header (a few dozen bytes)."""
    c = zlib.compressobj(level, zlib.DEFLATED, -15)
    n = len(c.compress(data)) + len(c.flush())
    return min(n, len(data))


# ---------------------------------------------------------------------------
# geometry: Natural Earth to the [lon0, lat0, dlon, dlat, ...] hundredths of Global Weather's
# assets/world.json, which the copied globe already draws
# ---------------------------------------------------------------------------

def _tri_area_m2(p0, p1, p2, kx, ky):
    ax, ay = (p1[0] - p0[0]) * kx, (p1[1] - p0[1]) * ky
    bx, by = (p2[0] - p0[0]) * kx, (p2[1] - p0[1]) * ky
    return abs(ax * by - ay * bx) / 2


def simplify(coords, min_area_m2: float, closed: bool = False):
    """Visvalingam-Whyatt: drop the point whose triangle with its neighbours has the least area,
    until every remaining triangle is at least `min_area_m2`. Areas are square metres on a local
    equirectangular approximation. A ring keeps at least 4 points, a line 2."""
    import heapq
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


def delta_encode(coords, factor: int = 100) -> list[int]:
    """[lon0, lat0, dlon, dlat, ...] in 1/factor degree, Global Weather's world.json units
    ("hundredths of a degree, delta-encoded"). Rounds each absolute point, then differences, so no
    error accumulates along a ring. Repeated points after rounding are dropped."""
    out, px, py = [], None, None
    for lon, lat in coords:
        x, y = int(round(lon * factor)), int(round(lat * factor))
        if px is None:
            out += [x, y]
        elif (x, y) != (px, py):
            out += [x - px, y - py]
        else:
            continue
        px, py = x, y
    return out


def group(n) -> str:
    """Thousands grouped with a narrow no-break space (U+202F), the apps' SI rule (plan D15): 12 565."""
    s = str(int(n))
    neg = s.startswith('-')
    s = s.lstrip('-')
    out = ''
    while len(s) > 3:
        out = ' ' + s[-3:] + out
        s = s[:-3]
    return ('-' if neg else '') + s + out
