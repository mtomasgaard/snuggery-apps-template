#!/usr/bin/env python3
"""Step 3 — assemble the walk and its connecting routes from Turrutebasen, in plan only.

The heights come later (step 5), from the terrain; this step produces geometry, and it runs before
the terrain is cut because the corridor the fine levels are built in is a buffer around this route.

The Besseggen walk is NOT labelled "Besseggen" in the source. The segments that make it up carry
`rutenavn` values of `Ukjent` and `Historisk vandrerute i Jotunheimen`, so it has to be assembled
by shortest path across a graph of the marked foot routes rather than picked out by name
(cache/SOURCES.md section 2). The four connecting routes, by contrast, *are* named, and are taken
by name.

Output: <work>/route2d.json — the 25 m plan-view samples of the walk, the connectors clipped to
the core box, and the place points the waypoints are pinned to.
"""
from __future__ import annotations
import heapq
import json
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geom
from paths import VECTORS, WORK

SNAP = 2.0          # metres: endpoints closer than this are the same graph node
STEP = 25.0         # metres between route samples

START_NAME = 'Gjendesheim'
END_NAME = 'Memurubu'

# id -> (the `rutenavn` in Turrutebasen, the end the route is walked from)
CONNECTORS = [
    ('gjendesheim-bessheim', 'Gjendesheim-Bessheim', 'Gjendesheim'),
    ('gjendesheim-sikkilsdalsseter', 'Gjendesheim-Sikkilsdalsseter', 'Gjendesheim'),
    ('memurubu-glitterheim', 'Memurubu-Glitterheim', 'Memurubu'),
    ('memurubu-gjendebu', 'Memurubu-Gjendebu', 'Memurubu'),
]

# The waypoints the app pins to the route: (id, the name to show, how it is positioned, the SSR
# name to attribute it to).  'ssr' means the waypoint sits at the route sample nearest that place;
# 'high-point' means it sits at the highest sample on the walk, whatever the place register says.
#
# Veslfjellet is positioned by the high point AND attributed to SSR, because the summit is in the
# register — under the spelling "Veslefjell" (Fjell, stedsnummer 71966), 28 m from the high point.
# A plain search for "Veslfjellet" misses it and finds a different 1459 m top 10 km away, which is
# why NOTES/DESIGN.md §5 recorded it as unnamed. The id below is checked against the high point at
# build time, so it can never quietly become the wrong mountain.
WAYPOINTS = [
    ('gjendesheim', 'Gjendesheim', 'ssr', 'Gjendesheim'),
    ('veslfjellet', 'Veslfjellet', 'high-point', 'Veslefjell'),
    ('besseggen', 'Besseggen', 'ssr', 'Besseggen'),
    ('bandet', 'Bandet', 'ssr', 'Bandet'),
    ('bjornboltjonne', 'Bjørnbøltjønne', 'ssr', 'Bjørnbøltjønne'),
    ('memurubu', 'Memurubu', 'ssr', 'Memurubu'),
]
HIGH_POINT_MATCH_M = 100.0     # how near the SSR summit must be to the walk's high point


# ------------------------------------------------------------------------------------ GML reading
FEATURE_RE = re.compile(r'<app:Fotrute\b.*?</app:Fotrute>', re.S)
POSLIST_RE = re.compile(r'<gml:posList[^>]*>(.*?)</gml:posList>', re.S)
ID_RE = re.compile(r'gml:id="([^"]+)"')
SRS_RE = re.compile(r'srsName="([^"]+)"')


def read_fotrute(path):
    """Read app:Fotrute features: their id, their vertices in EPSG:25833 (easting first, which is
    what this service returns and what the coordinate magnitudes confirm), and their route names."""
    with open(path, encoding='utf-8') as f:
        text = f.read()
    out = []
    for m in FEATURE_RE.finditer(text):
        blob = m.group(0)
        srs = SRS_RE.search(blob)
        assert srs and srs.group(1).endswith('25833'), srs
        pos = POSLIST_RE.search(blob)
        if not pos:
            continue
        nums = [float(v) for v in pos.group(1).split()]
        pts = np.array(nums, dtype=np.float64).reshape(-1, 2)
        assert pts[:, 0].max() < 1e6 < pts[:, 1].min(), 'coordinates are not (easting, northing)'
        out.append({
            'id': ID_RE.search(blob).group(1),
            'pts': pts,
            'names': sorted(set(re.findall(r'<app:rutenavn>(.*?)</app:rutenavn>', blob))),
            'updated': (re.findall(r'<app:oppdateringsdato>(.*?)</app:oppdateringsdato>', blob)
                        or [None])[0],
        })
    out.sort(key=lambda f: f['id'])          # a stable order, whatever the server sent
    return out


def length(pts):
    return float(np.hypot(*np.diff(pts, axis=0).T).sum())


# ---------------------------------------------------------------------------------------- a graph
def node_of(p):
    return (int(round(p[0] / SNAP)), int(round(p[1] / SNAP)))


def build_graph(feats):
    adj = {}
    for k, f in enumerate(feats):
        a, b = node_of(f['pts'][0]), node_of(f['pts'][-1])
        if a == b:
            continue
        w = length(f['pts'])
        adj.setdefault(a, []).append((b, w, k))
        adj.setdefault(b, []).append((a, w, k))
    for v in adj.values():
        v.sort()
    return adj


def dijkstra(adj, src, dst):
    """Shortest path, with ties broken by node order so the answer never depends on heap luck."""
    dist = {src: 0.0}
    prev = {}
    seen = set()
    q = [(0.0, src)]
    while q:
        d, u = heapq.heappop(q)
        if u in seen:
            continue
        seen.add(u)
        if u == dst:
            break
        for v, w, k in adj.get(u, ()):
            nd = d + w
            if nd < dist.get(v, math.inf) - 1e-9:
                dist[v] = nd
                prev[v] = (u, k)
                heapq.heappush(q, (nd, v))
    if dst not in dist:
        raise SystemExit(f'no path from {src} to {dst} in the trail graph')
    path = []
    u = dst
    while u != src:
        u, k = prev[u]
        path.append(k)
    path.reverse()
    return path, dist[dst]


def stitch(feats, edge_ids, start_node):
    """Walk the edges in path order, flipping any whose first vertex is not the node it is entered
    from, and concatenate — dropping the duplicated joint vertex."""
    out = []
    node = start_node
    for k in edge_ids:
        pts = feats[k]['pts']
        if node_of(pts[0]) != node:
            assert node_of(pts[-1]) == node, (k, node)
            pts = pts[::-1]
        node = node_of(pts[-1])
        out.append(pts if not out else pts[1:])
    return np.vstack(out)


def farthest(adj, src):
    dist = {src: 0.0}
    q = [(0.0, src)]
    seen = set()
    best = (0.0, src)
    while q:
        d, u = heapq.heappop(q)
        if u in seen:
            continue
        seen.add(u)
        if (d, u) > best:
            best = (d, u)
        for v, w, k in adj.get(u, ()):
            if d + w < dist.get(v, math.inf) - 1e-9:
                dist[v] = d + w
                heapq.heappush(q, (d + w, v))
    return best[1]


def resample(pts, step):
    seg = np.hypot(*np.diff(pts, axis=0).T)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    d = np.arange(0.0, cum[-1], step)
    return np.interp(d, cum, pts[:, 0]), np.interp(d, cum, pts[:, 1]), d, float(cum[-1])


def clip_to_core(pts):
    """Keep the run of vertices from the first one inside the core box up to the first one outside
    it after that, so a connector that leaves the box is cut where it leaves rather than dropped."""
    box = geom.CORE
    inside = ((pts[:, 0] >= box['x0']) & (pts[:, 0] <= box['x1'])
              & (pts[:, 1] >= box['y0']) & (pts[:, 1] <= box['y1']))
    if inside.all():
        return pts, False
    if not inside.any():
        return pts[:0], True
    i0 = int(np.argmax(inside))
    i1 = i0
    while i1 + 1 < len(pts) and inside[i1 + 1]:
        i1 += 1
    return pts[i0:i1 + 1], True


# ------------------------------------------------------------------------------------ place names
def load_places():
    d = json.load(open(os.path.join(VECTORS, 'ssr_core.json'), encoding='utf-8'))
    out = []
    for rec in d['navn']:
        p = rec['representasjonspunkt']
        for nm in rec['stedsnavn']:
            out.append({'name': nm['skrivemåte'], 'main': nm.get('navnestatus') == 'hovednavn',
                        'kindNo': rec['navneobjekttype'], 'x': p['øst'], 'y': p['nord'],
                        'ssrId': rec['stedsnummer'], 'status': rec.get('stedstatus'),
                        'updated': rec.get('oppdateringsdato')})
    return out


def find_place(places, name):
    cand = [p for p in places if p['name'] == name and p['main'] and p['status'] == 'aktiv']
    if not cand:
        raise SystemExit(f'SSR has no active main name "{name}" in the core box')
    cx, cy = geom.ORIGIN['x'], geom.ORIGIN['y']
    cand.sort(key=lambda p: (math.hypot(p['x'] - cx, p['y'] - cy), p['ssrId']))
    return cand[0]


# ----------------------------------------------------------------------------------------- main
def main():
    feats = read_fotrute(os.path.join(VECTORS, 'fotrute_core.gml'))
    total = sum(length(f['pts']) for f in feats)
    print(f'  {len(feats)} marked foot-route segments, {total/1000:.1f} km, in the core box')

    places = load_places()
    start_pt = find_place(places, START_NAME)
    end_pt = find_place(places, END_NAME)

    adj = build_graph(feats)
    print(f'  graph: {len(adj)} nodes, {sum(len(v) for v in adj.values())//2} edges')

    def nearest_node(px, py):
        return min(adj, key=lambda n: (math.hypot(n[0] * SNAP - px, n[1] * SNAP - py), n))

    src = nearest_node(start_pt['x'], start_pt['y'])
    dst = nearest_node(end_pt['x'], end_pt['y'])
    print(f"  start node {src[0]*2},{src[1]*2} is "
          f"{math.hypot(src[0]*SNAP-start_pt['x'], src[1]*SNAP-start_pt['y']):.0f} m from "
          f"{START_NAME}; end node is "
          f"{math.hypot(dst[0]*SNAP-end_pt['x'], dst[1]*SNAP-end_pt['y']):.0f} m from {END_NAME}")

    edges, plen = dijkstra(adj, src, dst)
    line = stitch(feats, edges, src)
    rx, ry, rd, path_len = resample(line, STEP)
    print(f'  main walk: {len(edges)} segments, {plen/1000:.3f} km path, '
          f'{len(line)} raw vertices, {len(rx)} samples at {STEP:g} m')

    # --- waypoints, pinned to the nearest route sample
    wps = []
    for wid, name, how, ssr_name in WAYPOINTS:
        p = find_place(places, ssr_name)
        if how == 'high-point':
            i = None                      # step 5 fills it in: it needs the heights to find it
            # prove the register's summit really is the summit the walk crosses
            d = float(np.min(np.hypot(rx - p['x'], ry - p['y'])))
            if d > HIGH_POINT_MATCH_M:
                raise SystemExit(f'SSR "{ssr_name}" is {d:.0f} m from the route — not the '
                                 f'high point of the walk; check the name before shipping it')
        else:
            i = int(np.argmin(np.hypot(rx - p['x'], ry - p['y'])))
            d = float(math.hypot(rx[i] - p['x'], ry[i] - p['y']))
        wps.append({'id': wid, 'name': name, 'ssrId': p['ssrId'], 'i': i,
                    'source': 'route high point, named from SSR' if how == 'high-point' else 'SSR',
                    'ssrName': p['name'], 'ssrX': p['x'], 'ssrY': p['y'], 'kindNo': p['kindNo'],
                    'ssrUpdated': p['updated'], 'offRouteM': round(d, 1)})
        km = 'high point' if i is None else f'km {rd[i]/1000:5.2f}'
        print(f"    {name:16s} {km:12s}  {d:6.1f} m off route"
              + ('' if p['name'] == name else f'  (SSR: {p["name"]})'))

    # --- the four named connectors
    conns = []
    for cid, rutenavn, from_name in CONNECTORS:
        sub = [f for f in feats if rutenavn in f['names']]
        if not sub:
            raise SystemExit(f'no Turrutebasen segment carries rutenavn "{rutenavn}"')
        sadj = build_graph(sub)
        a = farthest(sadj, farthest(sadj, min(sadj)))
        b = farthest(sadj, a)
        eids, clen = dijkstra(sadj, a, b)
        pts = stitch(sub, eids, a)
        hut = find_place(places, from_name)
        if (math.hypot(pts[0, 0] - hut['x'], pts[0, 1] - hut['y'])
                > math.hypot(pts[-1, 0] - hut['x'], pts[-1, 1] - hut['y'])):
            pts = pts[::-1]
        pts, clipped = clip_to_core(pts)
        conns.append({'id': cid, 'name': rutenavn, 'from': from_name,
                      'segments': len(sub), 'clipped': bool(clipped),
                      'x': [round(float(v), 2) for v in pts[:, 0]],
                      'y': [round(float(v), 2) for v in pts[:, 1]]})
        print(f'    {cid:30s} {len(sub):2d} segments, {length(pts)/1000:5.2f} km'
              + ('  (clipped at the core box)' if clipped else ''))

    out = {
        'source': 'Turrutebasen (Tur- og friluftsruter), Kartverket',
        'retrieved': geom.RETRIEVED,
        'sourceUpdated': max(f['updated'] for f in feats if f['updated'])[:10],
        'segmentsInBox': len(feats),
        'segmentKm': round(total / 1000.0, 1),
        'stepM': STEP,
        'pathLengthM': round(path_len, 1),
        'sampledLengthM': round(float(rd[-1]), 1),
        'rawVertices': int(len(line)),
        # the un-resampled path, kept so step 5 can report what reading a 1 m model at its own
        # vertex spacing does to the ascent figure
        'rawX': [round(float(v), 2) for v in line[:, 0]],
        'rawY': [round(float(v), 2) for v in line[:, 1]],
        'x': [round(float(v), 2) for v in rx],
        'y': [round(float(v), 2) for v in ry],
        'cumM': [round(float(v), 1) for v in rd],
        'waypoints': wps,
        'connectors': conns,
    }
    path = os.path.join(WORK, 'route2d.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'  wrote {path}')


if __name__ == '__main__':
    main()
