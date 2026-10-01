#!/usr/bin/env python3
"""Build assets/world.json for Global Weather and Global Wind: the coastlines (land rings) and the
country borders both apps draw, from Natural Earth 1:10m.

    python3 scripts/world_json.py            # fetch (once, into scripts/world_json_cache/), build, write both
    python3 scripts/world_json.py --check    # rebuild in memory and compare with both files, byte for byte
    python3 scripts/world_json.py --verify   # decode both files with the apps' own rules and print what they hold
    python3 scripts/world_json.py --only global-weather   # write (or --check, --verify) one app's copy only

Both apps carry the same file. An app's app.js must build its paths ring by ring and draw a coarser
level at small scales before it is given the 1:10m file (Global Weather's buildWorldPaths and lod()
show how): the 1:50m file's way of building one Path2D took seconds in Chromium at 1:10m.

Standard library only (Python 3.10 or newer; the repository uses /opt/homebrew/bin/python3.12).
Run from Template/ or anywhere: paths are worked out from this file.

Source. Natural Earth v5.1.2, the commit every other app in this repository pins
(nvkelso/natural-earth-vector f1890d9f152c896d250a77557a5751a93d494776), two files:
ne_10m_land (the land fill and its outline, the coast) and ne_10m_admin_0_boundary_lines_land
(the borders). Each download is checked against the sha256 and size recorded below; a changed
upstream file stops the build instead of changing the apps. Natural Earth is public domain. No lakes
layer: the pair never drew lakes, and ne_10m_land fills them as land except the Caspian, as the
1:50m file did (docs/plans/0011-coastlines-research.md §2).

Simplification. Visvalingam-Whyatt in Web Mercator pixels at the apps' maximum zoom (MAX_SCALE =
360 * 80 in both app.js: 80 CSS px per degree of longitude, 0.695 km a pixel at 60° N): a point is
dropped while its triangle with its neighbors is under TOLERANCE_PX2 = 1 square CSS pixel at that
zoom, so the tolerance is the same on screen at every latitude. A ring keeps at least 4 points, a line
2. The research measured 0.25 px² against 1 px² at maximum zoom and could not tell them apart
(plan 0011 research §2, tol/), and 1 px² keeps Global Weather's ZIP under its 2,800,000 B budget.

Encoding, unchanged from the file it replaces: {"v", "source", "units", "land", "borders"}, every ring
or line [lon0, lat0, dlon, dlat, ...] in hundredths of a degree (each point rounded, then
differenced, so no error accumulates; a point that rounds onto the previous one is dropped);
"land" is a list of polygons, each a list of rings (outer first, then holes), filled even-odd.
Border pieces that meet end to end (exactly two ends at a point) are joined into one line, with no
point added, moved or dropped: 1:10m comes in about 7,900 pieces, which would otherwise be as many
subpaths for the canvas.

Determinism. No clock, no randomness, no set iteration; dict order is insertion order; the heap
breaks ties by index. Two runs on one machine write the same bytes (--check proves it); a different
libm could in principle round a Mercator area differently by an ulp and flip a tie.
"""
from __future__ import annotations

import argparse
import hashlib
import heapq
import json
import math
import os
import sys
import urllib.request
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.dirname(HERE)
CACHE = os.path.join(HERE, 'world_json_cache')
APPS = ('global-weather', 'global-wind')
OUTPUTS = {app: os.path.join(TEMPLATE, app, 'assets', 'world.json') for app in APPS}

NE_COMMIT = 'f1890d9f152c896d250a77557a5751a93d494776'      # tag v5.1.2, as scripts/warming_world/sources.py
NE_RAW = f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}/geojson/'
SOURCES = {   # name: (sha256, bytes), measured on the first download (2026-10-01)
    'ne_10m_land': ('1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416', 10157965),
    'ne_10m_admin_0_boundary_lines_land': ('74d9c16229c095fde65943a9919e337682f044bcebccb120764f38edf3b70f4a', 2284669),
}

PX_PER_DEG = 80.0          # MAX_SCALE / 360 in both apps' app.js
TOLERANCE_PX2 = 1.0        # square CSS pixels at that zoom
FACTOR = 100               # hundredths of a degree
MAX_LAT = 85.05112878      # Web Mercator's edge, as app.js
BUDGET = 1_600_000         # bytes, raw; the ZIP budgets are in each app's tools/check.mjs

SOURCE = 'Natural Earth v5.1.2 1:10m land and admin-0 boundary lines (public domain)'
UNITS = 'hundredths of a degree, delta-encoded [lon0, lat0, dlon, dlat, ...]'


class BuildError(Exception):
    pass


def fetch(name: str) -> str:
    """The cached GeoJSON for `name`, downloaded once from the pinned commit and checked."""
    sha, size = SOURCES[name]
    path = os.path.join(CACHE, name + '.geojson')
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        url = NE_RAW + name + '.geojson'
        print(f'fetch {url}', file=sys.stderr)
        req = urllib.request.Request(url, headers={'User-Agent': 'snuggery-apps-template world_json.py'})
        with urllib.request.urlopen(req, timeout=300) as r:
            body = r.read()
        tmp = path + '.part'
        with open(tmp, 'wb') as f:
            f.write(body)
        os.replace(tmp, path)
    with open(path, 'rb') as f:
        body = f.read()
    got = hashlib.sha256(body).hexdigest()
    if got != sha or len(body) != size:
        bad = path + '.mismatch'
        os.replace(path, bad)
        raise BuildError(f'{name}: sha256 {got}, {len(body)} B, but the pin says {sha}, {size} B (kept as {bad}). '
                         'The upstream file changed; check it and update the pin deliberately.')
    return path


def merc(lon: float, lat: float) -> tuple[float, float]:
    """Web Mercator in CSS pixels at the maximum zoom."""
    lat = max(-MAX_LAT, min(MAX_LAT, lat))
    return lon * PX_PER_DEG, math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))) * PX_PER_DEG


def simplify(coords, closed: bool):
    """Visvalingam-Whyatt in Mercator pixels: drop the point whose triangle with its neighbors is
    smallest while it is under TOLERANCE_PX2. A ring keeps at least 4 points (and comes back closed), a line 2."""
    pts = [(float(p[0]), float(p[1])) for p in coords]
    if closed and len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)
    if n < 3:
        return pts + ([pts[0]] if closed and pts else [])
    P = [merc(x, y) for x, y in pts]

    def area(a, b, c):
        return abs((P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0])) / 2

    prev = list(range(-1, n - 1))
    nxt = list(range(1, n + 1))
    if closed:
        prev[0], nxt[-1] = n - 1, 0
    else:
        prev[0], nxt[-1] = -1, -1
    A = [math.inf] * n
    heap = []
    for i in range(n):
        if prev[i] >= 0 and nxt[i] >= 0:
            A[i] = area(prev[i], i, nxt[i])
            heap.append((A[i], i))
    heapq.heapify(heap)
    alive = [True] * n
    count = n
    floor = 4 if closed else 2
    while heap and count > floor:
        a, i = heapq.heappop(heap)
        if not alive[i] or a != A[i]:
            continue
        if a >= TOLERANCE_PX2:
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
                A[j] = max(a, area(prev[j], j, nxt[j]))
                heapq.heappush(heap, (A[j], j))
    out = [pts[i] for i in range(n) if alive[i]]
    if closed:
        out.append(out[0])
    return out


def to_ints(coords) -> list[tuple[int, int]]:
    """Each point rounded to hundredths; a point that rounds onto the one before it is dropped."""
    out = []
    for lon, lat in coords:
        p = (int(round(lon * FACTOR)), int(round(lat * FACTOR)))
        if not out or p != out[-1]:
            out.append(p)
    return out


def delta(points) -> list[int]:
    out = [points[0][0], points[0][1]]
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        out += [bx - ax, by - ay]
    return out


def chain(lines: list[list[tuple[int, int]]]) -> list[list[tuple[int, int]]]:
    """Join lines that meet end to end where exactly two line ends share a point."""
    at = defaultdict(list)
    for i, line in enumerate(lines):
        at[line[0]].append(i)
        at[line[-1]].append(i)
    used = [False] * len(lines)
    out = []
    for start in range(len(lines)):
        if used[start]:
            continue
        used[start] = True
        cur = list(lines[start])
        for tail in (True, False):                       # grow at the tail, then at the head
            while True:
                pt = cur[-1] if tail else cur[0]
                if len(at[pt]) != 2:
                    break
                free = [j for j in at[pt] if not used[j]]
                if not free:
                    break
                j = free[0]
                used[j] = True
                seg = lines[j]
                if tail:
                    cur += (seg if seg[0] == pt else seg[::-1])[1:]
                else:
                    cur = (seg if seg[-1] == pt else seg[::-1])[:-1] + cur
        out.append(cur)
    return out


def polygons(geom):
    return [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']


def linestrings(geom):
    return [geom['coordinates']] if geom['type'] == 'LineString' else geom['coordinates']


def build() -> tuple[bytes, dict]:
    with open(fetch('ne_10m_land'), encoding='utf-8') as f:
        land_src = json.load(f)
    with open(fetch('ne_10m_admin_0_boundary_lines_land'), encoding='utf-8') as f:
        border_src = json.load(f)
    stats = {'source land rings': 0, 'source land points': 0, 'source border lines': 0, 'source border points': 0}
    land = []
    for feature in land_src['features']:
        for poly in polygons(feature['geometry']):
            rings = []
            for k, ring in enumerate(poly):
                stats['source land rings'] += 1
                stats['source land points'] += len(ring)
                pts = to_ints(simplify(ring, closed=True))
                if len(pts) >= 4:
                    rings.append(delta(pts))
                elif k == 0:
                    break                                # an outer ring too small to draw takes its holes with it
            if rings:
                land.append(rings)
    pieces = []
    for feature in border_src['features']:
        for line in linestrings(feature['geometry']):
            stats['source border lines'] += 1
            stats['source border points'] += len(line)
            pts = to_ints(simplify(line, closed=False))
            if len(pts) >= 2:
                pieces.append(pts)
    borders = [delta(line) for line in chain(pieces)]
    w = {'v': 1, 'source': SOURCE, 'units': UNITS, 'land': land, 'borders': borders}
    body = json.dumps(w, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    stats.update({'border pieces': len(pieces), 'bytes': len(body)})
    if len(body) > BUDGET:
        raise BuildError(f'world.json would be {len(body):,} B, over the {BUDGET:,} B budget')
    return body, stats


# --- the apps' own decoding rules, for --verify (app.js: addLine, encodeRing, buildLandMask) -----------

PATH_K = 4096


def lat_to_y(lat: float) -> float:
    p = math.radians(max(-MAX_LAT, min(MAX_LAT, lat)))
    return 0.5 - math.log(math.tan(math.pi / 4 + p / 2)) / (2 * math.pi)


def decode(enc: list[int]):
    """[lon0, lat0, dlon, dlat, ...] → [(lon, lat), ...], exactly as addLine walks it."""
    x = y = 0
    out = []
    for i in range(0, len(enc), 2):
        x += enc[i]
        y += enc[i + 1]
        out.append((x / 100, y / 100))
    return out


def verify(path: str) -> dict:
    with open(path, 'rb') as f:
        body = f.read()
    w = json.loads(body)
    problems = []
    if list(w) != ['v', 'source', 'units', 'land', 'borders'] or w['v'] != 1 or w['units'] != UNITS:
        problems.append(f'keys {list(w)}, v {w.get("v")}, units {w.get("units")!r}')
    n = rings = 0
    stats = {'open rings': 0}
    sx = sy = 0.0
    lon_range = [math.inf, -math.inf]
    lat_range = [math.inf, -math.inf]

    def walk(enc, closed, where):
        nonlocal n, sx, sy
        if not isinstance(enc, list) or len(enc) % 2 or not all(type(v) is int for v in enc):
            problems.append(f'{where}: not an even list of integers')
            return
        pts = decode(enc)
        if len(pts) < (4 if closed else 2):
            problems.append(f'{where}: {len(pts)} points')
        if closed and pts[0] != pts[-1]:
            stats['open rings'] += 1                     # the app closes every ring itself (closePath)
        for lon, lat in pts:
            if not (-90 <= lat <= 90) or not (-540 <= lon <= 540):
                problems.append(f'{where}: point {lon}, {lat} out of range')
                return
            lon_range[0], lon_range[1] = min(lon_range[0], lon), max(lon_range[1], lon)
            lat_range[0], lat_range[1] = min(lat_range[0], lat), max(lat_range[1], lat)
            n += 1
            sx += (lon + 180) / 360 * PATH_K
            sy += lat_to_y(lat) * PATH_K

    for i, poly in enumerate(w['land']):
        if not poly:
            problems.append(f'land[{i}] empty')
        for j, ring in enumerate(poly):
            rings += 1
            walk(ring, True, f'land[{i}][{j}]')
    for i, line in enumerate(w['borders']):
        walk(line, False, f'borders[{i}]')
    return {'file': os.path.relpath(path, TEMPLATE), 'bytes': len(body),
            'sha256': hashlib.sha256(body).hexdigest(), 'source': w.get('source'),
            'polygons': len(w['land']), 'rings': rings, 'border lines': len(w['borders']),
            'points': n, 'lon': lon_range, 'lat': lat_range,
            'checksum': [sx, sy], **stats, 'problems': problems[:10], 'problem count': len(problems)}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--check', action='store_true', help='rebuild in memory and compare with both files byte for byte')
    ap.add_argument('--verify', action='store_true', help="decode the files with the apps' rules and report")
    ap.add_argument('--only', choices=APPS, help='one app only (default: both)')
    args = ap.parse_args()
    outputs = [OUTPUTS[args.only]] if args.only else list(OUTPUTS.values())
    try:
        if args.verify:
            reports = [verify(p) for p in outputs]
            for r in reports:
                print(json.dumps(r, ensure_ascii=False))
            if not args.only:
                print(f'both apps carry the same file: {len({r["sha256"] for r in reports}) == 1}')
            return 1 if any(r['problem count'] for r in reports) else 0
        body, stats = build()
        print(json.dumps(stats), file=sys.stderr)
        if args.check:
            bad = [p for p in outputs if not os.path.exists(p) or open(p, 'rb').read() != body]
            for p in outputs:
                print(f'{os.path.relpath(p, TEMPLATE)}: {"identical to a fresh build" if p not in bad else "DIFFERS from a fresh build"}')
            return 1 if bad else 0
        for p in outputs:
            with open(p, 'wb') as f:
                f.write(body)
            print(f'wrote {os.path.relpath(p, TEMPLATE)}: {len(body):,} B, sha256 {hashlib.sha256(body).hexdigest()}')
        return 0
    except BuildError as e:
        print(f'world_json.py: {e}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
