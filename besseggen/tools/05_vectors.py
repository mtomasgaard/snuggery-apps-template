#!/usr/bin/env python3
"""Step 5 — the five GeoJSON layers, with their heights taken from the terrain built in step 4.

    route.geojson     the walk and its four connectors, draped, with the profile indices the app
                      needs (kilometre marks, waypoints, the high point, cumulative distance)
    places.geojson    SSR names inside the core box, with an elevation sampled from the 2 m grid
                      and a cheap, deterministic stand-in for prominence
    water.geojson     N50 lakes, the two kommune halves rejoined, at their own surface level
    glaciers.geojson  N50 snow and ice
    rivers.geojson    N50 rivers and streams

All five carry EPSG:25833 coordinates and the pre-RFC-7946 `crs` member, deliberately: the app
works in 25833 throughout and converting on disk would be work with nothing to show for it. That
is a stated deviation from RFC 7946, not an oversight — see README.md.
"""
from __future__ import annotations
import json
import math
import os
import sys

import numpy as np
import shapely
from shapely import wkb as shapely_wkb
from shapely.geometry import box as shapely_box, mapping
from shapely.ops import unary_union
from shapely.strtree import STRtree
from pyogrio.raw import read as ogr_read

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geom
from paths import DATA, DTM, N50, VECTORS, WORK

SIMPLIFY_M = 5.0            # NOTES/DESIGN.md section 8
# The water plane: N50's `hoyde` is a rounded integer, and lidar reads the water surface itself,
# which for most lakes here is a few decimetres above that integer — so a plane at `hoyde` is
# drawn UNDER the ground it sits on and the near shore renders as bare rock. The level is taken
# from the lidar instead: the 99th percentile of the surface inside the lake, shrunk by
# WATER_INSET_M so the bank is not sampled, floored at N50's figure and lifted by WATER_LIFT_M.
# Sampling is on a fixed lattice anchored to the grid, so it is bit-for-bit reproducible.
WATER_SAMPLE_M = 10.0       # lattice step inside a lake
WATER_INSET_M = 3.0         # shrink the polygon before sampling, to stay off the bank
WATER_PCTL = 99.0           # islands and shoreline rocks are meant to stand above the plane
WATER_LIFT_M = 0.1
COORD_DP = 2
KOMMUNER = [('3435', 'Vaga'), ('3434', 'Lom')]

# SSR's navneobjekttype -> the app's own small vocabulary. `kindNo` keeps the original so the
# mapping can be checked; anything not listed here becomes "other".
KIND = {
    'Fjell': 'peak', 'Topp': 'peak', 'Haug': 'peak', 'Berg': 'peak',
    'Ås': 'ridge', 'Rygg': 'ridge', 'Egg': 'ridge', 'Fjellkant': 'ridge',
    'Skar': 'pass', 'Botn': 'cirque',
    'Innsjø': 'lake', 'Vann': 'lake', 'Tjern': 'tarn', 'Gruppe av tjern': 'tarn',
    'Elv': 'river', 'Bekk': 'stream', 'Os': 'stream', 'Høl': 'stream', 'Foss': 'stream',
    'Isbre': 'glacier',
    'Turisthytte': 'hut', 'Hotell': 'hut', 'Campingplass': 'hut',
    'Seter/støl': 'farm', 'Bygg for jordbruk, fiske og fangst': 'farm',
    'Li': 'slope', 'Bakke': 'slope', 'Stup': 'slope', 'Hylle': 'slope',
    'Dal': 'valley',
    'Nes': 'point', 'Vik': 'point', 'Holme': 'point', 'Sand': 'point',
}
# The coarsest zoom band a label is drawn at: 0 is always, 3 is closest in. Peaks are graded by
# their local relief so a 2366 m summit outranks a knoll; everything else is graded by kind.
SHOW_AT_KIND = {'hut': 0, 'lake': 1, 'ridge': 1, 'glacier': 2, 'pass': 2, 'valley': 2, 'river': 2,
                'cirque': 3, 'tarn': 3, 'stream': 3, 'farm': 3, 'slope': 3, 'point': 3,
                'other': 3}
# A peak's band comes from the larger of its relief over 2 km and its height above 1500 m, so a
# summit that stands alone and a summit that is simply very high both make the headline band, and
# a knoll on a shoulder makes neither. Thresholds chosen against the real data: 12 peaks at band 0,
# 28 by band 1, 47 by band 2.
PEAK_BANDS = [(800.0, 0), (550.0, 1), (300.0, 2)]


def fc(features, box=None):
    b = box or geom.CORE
    return {'type': 'FeatureCollection',
            'crs': {'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:EPSG::25833'}},
            'bbox': [b['x0'], b['y0'], b['x1'], b['y1']],
            'features': features}


def rnd(v, dp=COORD_DP):
    return round(float(v), dp)


def round_geometry(g, dp=COORD_DP):
    if isinstance(g, (list, tuple)):
        if g and isinstance(g[0], (int, float)):
            return [round(float(v), dp) for v in g]
        return [round_geometry(v, dp) for v in g]
    return g


# ------------------------------------------------------------------------------- terrain sampling
class Terrain:
    """Height lookups against the grids step 4 built, and the level-5/level-4 rule the route uses:
    sample the 2 m grid where a level-5 tile exists and the 4 m grid otherwise."""

    def __init__(self):
        self.manifest = json.load(open(os.path.join(DATA, 'manifest.json'), encoding='utf-8'))
        ny, nx = geom.MASTER_SHAPE
        self.g5 = np.memmap(os.path.join(DTM, f'core_2m_{nx}x{ny}_u16dm.raw'),
                            dtype=np.uint16, mode='r', shape=(ny, nx))
        ny4, nx4 = geom.grid_shape(geom.CORE, 4)
        self.g4 = np.memmap(os.path.join(WORK, 'core_L4_4m.raw'),
                            dtype=np.uint16, mode='r', shape=(ny4, nx4))
        self.g2 = np.load(os.path.join(WORK, 'core_L2_16m.npy'))
        lv5 = [l for l in self.manifest['levels'] if l['level'] == 5][0]
        self.l5_tiles = {(t['tx'], t['ty']) for t in lv5['tiles']}
        self.l5_span = lv5['tileSpan']

    def on_route(self, xs, ys):
        """Heights for route samples: level 5 where it exists, level 4 where it does not."""
        xs = np.asarray(xs, dtype=np.float64)
        ys = np.asarray(ys, dtype=np.float64)
        tx = np.floor((xs - geom.CORE['x0']) / self.l5_span).astype(int)
        ty = np.floor((ys - geom.CORE['y0']) / self.l5_span).astype(int)
        fine = np.array([(a, b) in self.l5_tiles for a, b in zip(tx, ty)])
        z = geom.sample_bilinear(self.g4, geom.CORE, 4, xs, ys)
        if fine.any():
            z[fine] = geom.sample_bilinear(self.g5, geom.CORE, 2, xs[fine], ys[fine])
        return z, int(fine.sum())

    def at(self, xs, ys):
        return geom.sample_bilinear(self.g5, geom.CORE, 2, xs, ys)

    def relief(self, x, y, radius=1000.0):
        """The lowest point within `radius`, off the 16 m grid. elevM minus this is a cheap and
        completely deterministic stand-in for prominence, enough to sort a mountain above a knoll."""
        res = 16
        ny, nx = self.g2.shape
        c = (x - geom.CORE['x0']) / res
        r = (geom.CORE['y1'] - y) / res
        k = int(math.ceil(radius / res))
        r0, r1 = max(0, int(r) - k), min(ny, int(r) + k + 1)
        c0, c1 = max(0, int(c) - k), min(nx, int(c) + k + 1)
        sub = self.g2[r0:r1, c0:c1]
        rr = (np.arange(r0, r1)[:, None] - r) * res
        cc = (np.arange(c0, c1)[None, :] - c) * res
        inside = rr * rr + cc * cc <= radius * radius
        if not inside.any():
            return None
        return float(sub[inside].min()) / 10.0


# ------------------------------------------------------------------------------------------ route
def profile(z):
    dz = np.diff(z)
    return float(dz[dz > 0].sum()), float(-dz[dz < 0].sum())


def build_route(terrain, route):
    rx = np.array(route['x'], dtype=np.float64)
    ry = np.array(route['y'], dtype=np.float64)
    rd = np.array(route['cumM'], dtype=np.float64)

    z_raw, n_fine = terrain.on_route(rx, ry)
    # a 3-sample box over 25 m samples: a 1 m elevation model read at its own vertex spacing counts
    # boulder noise as ascent, and this is what brings the figure back to something honest
    pad = np.concatenate([z_raw[:1], z_raw, z_raw[-1:]])
    z = np.convolve(pad, np.ones(3) / 3.0, mode='valid')

    ascent, descent = profile(z)
    unsmoothed_ascent, _ = profile(z_raw)
    zv, _ = terrain.on_route(np.array(route['rawX']), np.array(route['rawY']))
    raw_ascent, _ = profile(zv)
    hi = int(np.argmax(z))

    km_marks = [{'km': k, 'i': int(np.argmin(np.abs(rd - k * 1000.0)))}
                for k in range(1, int(rd[-1] // 1000) + 1)]
    wps = []
    for w in route['waypoints']:
        i = hi if w['i'] is None else w['i']
        wps.append({'id': w['id'], 'i': i})

    coords = [[rnd(a), rnd(b), rnd(c)] for a, b, c in zip(rx, ry, z)]
    main = {
        'type': 'Feature', 'id': 'besseggen',
        'geometry': {'type': 'LineString', 'coordinates': coords},
        'properties': {
            'name': 'Besseggen: Gjendesheim – Memurubu',
            'role': 'main',
            'source': route['source'],
            'sourceUpdated': route['sourceUpdated'],
            'sampleStepM': route['stepM'],
            'smoothing': '3-sample box over 25 m samples',
            'lengthM': round(float(rd[-1]), 1),
            'pathLengthM': route['pathLengthM'],
            'ascentM': round(ascent), 'descentM': round(descent),
            'rawAscentM': round(raw_ascent), 'unsmoothedAscentM': round(unsmoothed_ascent),
            'rawVertices': route['rawVertices'],
            'heightSource': f'{n_fine}/{len(rx)} samples from the 2 m grid, the rest from 4 m',
            'highPoint': {'i': hi, 'name': 'Veslfjellet', 'elevM': round(float(z[hi]))},
            'cumM': [round(float(v), 1) for v in rd],
            'kmMarks': km_marks,
            'waypoints': wps,
        },
    }
    feats = [main]
    for c in route['connectors']:
        cx = np.array(c['x'], dtype=np.float64)
        cy = np.array(c['y'], dtype=np.float64)
        cz, _ = terrain.on_route(cx, cy)
        feats.append({
            'type': 'Feature', 'id': c['id'],
            'geometry': {'type': 'LineString',
                         'coordinates': [[rnd(a), rnd(b), rnd(d)] for a, b, d in zip(cx, cy, cz)]},
            'properties': {'name': c['name'], 'role': 'connector', 'from': c['from'],
                           'source': route['source'], 'sourceUpdated': route['sourceUpdated'],
                           'lengthM': round(float(np.hypot(*np.diff(
                               np.column_stack([cx, cy]), axis=0).T).sum()), 1),
                           'clipped': c['clipped']},
        })
    stats = dict(ascent=ascent, descent=descent, raw_ascent=raw_ascent,
                 unsmoothed=unsmoothed_ascent, hi=hi, z=z, rd=rd, rx=rx, ry=ry)
    return feats, stats


# ----------------------------------------------------------------------------------------- places
def build_places(terrain):
    d = json.load(open(os.path.join(VECTORS, 'ssr_core.json'), encoding='utf-8'))
    box = geom.CORE
    out = []
    for rec in d['navn']:
        p = rec['representasjonspunkt']
        x, y = p['øst'], p['nord']
        if not (box['x0'] <= x <= box['x1'] and box['y0'] <= y <= box['y1']):
            continue
        if rec.get('stedstatus') != 'aktiv':
            continue
        main = [n for n in rec['stedsnavn'] if n.get('navnestatus') == 'hovednavn']
        if not main:
            continue
        name = sorted(n['skrivemåte'] for n in main)[0]
        kind_no = rec['navneobjekttype']
        kind = KIND.get(kind_no, 'other')
        z = float(terrain.at(np.array([x]), np.array([y]))[0])
        lo1 = terrain.relief(x, y, 1000.0)
        lo2 = terrain.relief(x, y, 2000.0)
        rel1 = 0.0 if lo1 is None else z - lo1
        rel2 = 0.0 if lo2 is None else z - lo2
        if kind == 'peak':
            score = max(rel2, z - 1500.0)
            show = next((b for t, b in PEAK_BANDS if score >= t), 3)
        else:
            show = SHOW_AT_KIND.get(kind, 3)
        out.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [rnd(x), rnd(y), rnd(z)]},
            'properties': {'name': name, 'kind': kind, 'kindNo': kind_no,
                           'elevM': round(z, 1), 'relief1kmM': round(rel1, 1),
                           'relief2kmM': round(rel2, 1),
                           'ssrId': rec['stedsnummer'],
                           'ssrUpdated': (rec.get('oppdateringsdato') or '')[:10] or None,
                           'showAt': show},
        })
    out.sort(key=lambda f: f['properties']['ssrId'])
    return out


# ------------------------------------------------------------------------------------ N50 vectors
def n50_layer(layer):
    """Read one N50 Arealdekke layer from both kommune zips. Returns (shapely geometry, fields)."""
    rows = []
    for code, name in KOMMUNER:
        zp = os.path.join(N50, f'Basisdata_{code}_{name}_25833_N50Kartdata_GML.zip')
        inner = f'Basisdata_{code}_{name}_25833_N50Arealdekke_GML.gml'
        meta, _, wkbs, fields = ogr_read(f'/vsizip/{zp}/{inner}', layer=layer)
        keys = list(meta['fields'])
        for i, blob in enumerate(wkbs):
            if blob is None:
                continue
            g = shapely_wkb.loads(bytes(blob))
            if g.is_empty:
                continue
            rows.append((g, {k: fields[j][i] for j, k in enumerate(keys)}, name))
    return rows


def explode(g):
    if g.is_empty:
        return []
    if g.geom_type.startswith('Multi') or g.geom_type == 'GeometryCollection':
        return [p for part in g.geoms for p in explode(part)]
    return [g]


def clipped_parts(g, clip, min_area=0.0, min_len=0.0):
    g = g.intersection(clip)
    parts = []
    for p in explode(g):
        if p.geom_type == 'Polygon' and p.area > min_area:
            parts.append(p)
        elif p.geom_type == 'LineString' and p.length > min_len:
            parts.append(p)
    return parts


def name_by_point(parts, points, kinds):
    """Give a polygon the SSR name whose point falls inside it. Deterministic: the lowest ssrId
    wins if two names fall in the same water body."""
    cands = sorted([p for p in points if p['properties']['kind'] in kinds],
                   key=lambda p: p['properties']['ssrId'])
    from shapely.geometry import Point
    named = {}
    tree = STRtree([p for p, _ in parts]) if parts else None
    for p in cands:
        x, y, _ = p['geometry']['coordinates']
        if tree is None:
            break
        for idx in tree.query(Point(x, y)):
            if parts[idx][0].contains(Point(x, y)) and idx not in named:
                named[idx] = p['properties']['name']
                break
    return named


def _inside_samples(terrain, g, step):
    """The 2 m model read on a fixed lattice inside `g`. The lattice is anchored to absolute
    multiples of `step`, not to the polygon's own bounds, so it does not shift when a coordinate
    is rounded and a rebuild reads exactly the same points."""
    x0, y0, x1, y1 = g.bounds
    ix = np.arange(int(math.ceil(x0 / step)), int(math.floor(x1 / step)) + 1) * step
    iy = np.arange(int(math.ceil(y0 / step)), int(math.floor(y1 / step)) + 1) * step
    if not len(ix) or not len(iy):
        return np.empty(0)
    gx, gy = np.meshgrid(ix, iy)
    gx = gx.ravel()
    gy = gy.ravel()
    keep = shapely.contains_xy(g, gx, gy)
    if not keep.any():
        return np.empty(0)
    return terrain.at(gx[keep], gy[keep])


def lidar_surface(terrain, polys):
    """The lidar height of one lake's own surface: the WATER_PCTL percentile of the 2 m model
    inside the lake, over all of its parts pooled together, each shrunk by WATER_INSET_M first so
    the bank is not counted. Returns None when the lake is too small to hold a sample."""
    for step in (WATER_SAMPLE_M, 2.0):
        pool = []
        for g in polys:
            inner = g.buffer(-WATER_INSET_M)
            pool.append(_inside_samples(terrain, inner if not inner.is_empty else g, step))
        z = np.concatenate(pool) if pool else np.empty(0)
        if len(z) >= 10:
            return float(np.percentile(z, WATER_PCTL))
    pts = [g.representative_point() for g in polys]
    pts = [q for g, q in zip(polys, pts) if g.contains(q)]
    if not pts:
        return None
    return float(np.max(terrain.at(np.array([q.x for q in pts]), np.array([q.y for q in pts]))))


def build_water(terrain, places):
    """Lakes, with the two kommune downloads rejoined. The download is cut at the kommune border,
    so Gjende arrives in two pieces; N50's own `vatnLøpenummer` is the key that puts them back
    together. A lake with no lake number (a nameless tarn) stays on its own.

    Every part of one lake gets one level, computed over all of its parts together, so a lake cut
    by the kommune border cannot come back with a step in the middle of it."""
    clip = shapely_box(geom.CORE['x0'], geom.CORE['y0'], geom.CORE['x1'], geom.CORE['y1'])
    groups = {}
    for layer in ('Innsjø', 'InnsjøRegulert'):
        for g, f, kommune in n50_layer(layer):
            lnr = f.get('vatnLøpenummer')
            lnr = None if lnr is None or (isinstance(lnr, float) and math.isnan(lnr)) else int(lnr)
            hoyde = None if f.get('høyde') is None else int(f['høyde'])
            key = (lnr, hoyde) if lnr is not None else ('unnumbered', str(f.get('gml_id')))
            groups.setdefault(key, {'key': key, 'lnr': lnr, 'hoyde': hoyde,
                                    'geoms': []})['geoms'].append(g)
    parts = []
    for key in sorted(groups, key=lambda k: (str(k[0]), str(k[1]))):
        grp = groups[key]
        merged = unary_union(grp['geoms'])           # rejoins a lake cut at the kommune border
        for p in clipped_parts(merged.simplify(SIMPLIFY_M, preserve_topology=True), clip,
                               min_area=400.0):
            parts.append((p, grp))
    parts.sort(key=lambda pw: (-pw[0].area, pw[0].bounds))
    named = name_by_point(parts, places, ('lake', 'tarn'))

    # One level per lake, from all of its parts pooled — a lake cut by the kommune border must
    # not come back with a step in the middle of it. Insertion order follows `parts`, which is
    # already sorted, so this is stable.
    bodies = {}
    for p, grp in parts:
        bodies.setdefault(grp['key'], (grp, []))[1].append(p)
    level = {}
    for key, (grp, polys) in bodies.items():
        if grp['hoyde'] is None:
            level[key] = None
            continue
        z = lidar_surface(terrain, polys)
        base = float(grp['hoyde']) if z is None else max(float(grp['hoyde']), z)
        level[key] = round(base + WATER_LIFT_M, 2)

    feats = []
    for i, (p, grp) in enumerate(parts):
        feats.append({
            'type': 'Feature',
            'geometry': {'type': p.geom_type,
                         'coordinates': round_geometry(mapping(p)['coordinates'])},
            'properties': {'name': named.get(i),
                           'levelM': level[grp['key']],
                           'n50Hoyde': grp['hoyde'],
                           'levelSource': None if grp['hoyde'] is None else
                           'lidar water surface (p99 of DTM1 inside the lake) if above N50 hoyde',
                           'areaKm2': round(p.area / 1e6, 3),
                           'lakeNo': grp['lnr'],
                           'nameSource': 'SSR' if named.get(i) else None,
                           'source': 'N50 Kartdata, Kartverket, CC BY 4.0'},
        })
    return feats


def build_glaciers(places):
    clip = shapely_box(geom.CORE['x0'], geom.CORE['y0'], geom.CORE['x1'], geom.CORE['y1'])
    merged = unary_union([g for g, _, _ in n50_layer('SnøIsbre')])
    parts = [(p, None) for p in clipped_parts(
        merged.simplify(SIMPLIFY_M, preserve_topology=True), clip, min_area=2000.0)]
    parts.sort(key=lambda pw: (-pw[0].area, pw[0].bounds))
    named = name_by_point(parts, places, ('glacier',))
    return [{'type': 'Feature',
             'geometry': {'type': p.geom_type,
                          'coordinates': round_geometry(mapping(p)['coordinates'])},
             'properties': {'name': named.get(i), 'areaKm2': round(p.area / 1e6, 3),
                            'source': 'N50 Kartdata, Kartverket, CC BY 4.0'}}
            for i, (p, _) in enumerate(parts)]


def build_rivers(places):
    from shapely.geometry import Point
    clip = shapely_box(geom.CORE['x0'], geom.CORE['y0'], geom.CORE['x1'], geom.CORE['y1'])
    feats = []
    lines = []
    for g, f, _ in n50_layer('ElvBekk'):
        for p in clipped_parts(g.simplify(SIMPLIFY_M, preserve_topology=True), clip, min_len=50.0):
            lines.append(p)
    polys = []
    merged = unary_union([g for g, _, _ in n50_layer('Elv')])
    for p in clipped_parts(merged.simplify(SIMPLIFY_M, preserve_topology=True), clip,
                           min_area=400.0):
        polys.append(p)
    lines.sort(key=lambda p: (-p.length, p.bounds))
    polys.sort(key=lambda p: (-p.area, p.bounds))

    # name a watercourse from the SSR river and stream points that sit on it, nearest first
    names = {}
    if lines:
        tree = STRtree(lines)
        for pl in sorted([p for p in places if p['properties']['kind'] in ('river', 'stream')],
                         key=lambda p: p['properties']['ssrId']):
            x, y, _ = pl['geometry']['coordinates']
            idx = tree.nearest(Point(x, y))
            if idx is not None and lines[int(idx)].distance(Point(x, y)) <= 100.0:
                names.setdefault(int(idx), pl['properties']['name'])
    for i, p in enumerate(lines):
        feats.append({'type': 'Feature',
                      'geometry': {'type': 'LineString',
                                   'coordinates': round_geometry(mapping(p)['coordinates'])},
                      'properties': {'name': names.get(i), 'kind': 'stream',
                                     'source': 'N50 Kartdata, Kartverket, CC BY 4.0'}})
    for p in polys:
        feats.append({'type': 'Feature',
                      'geometry': {'type': p.geom_type,
                                   'coordinates': round_geometry(mapping(p)['coordinates'])},
                      'properties': {'name': None, 'kind': 'river',
                                     'source': 'N50 Kartdata, Kartverket, CC BY 4.0'}})
    return feats


# ------------------------------------------------------------------------------------------- main
def main():
    terrain = Terrain()
    route = json.load(open(os.path.join(WORK, 'route2d.json'), encoding='utf-8'))

    feats, st = build_route(terrain, route)
    geom.write_json(os.path.join(DATA, 'route.geojson'), fc(feats),
                    compact_keys=('coordinates', 'cumM', 'kmMarks', 'waypoints'))
    print(f"  route.geojson   {len(st['rd'])} samples, {st['rd'][-1]/1000:.3f} km, "
          f"ascent {st['ascent']:.0f} m (raw {st['raw_ascent']:.0f}, "
          f"unsmoothed {st['unsmoothed']:.0f}), descent {st['descent']:.0f} m, "
          f"high point {st['z'][st['hi']]:.1f} m at km {st['rd'][st['hi']]/1000:.2f}")

    places = build_places(terrain)
    geom.write_json(os.path.join(DATA, 'places.geojson'), fc(places),
                    compact_keys=('coordinates',))
    peaks = [p for p in places if p['properties']['kind'] == 'peak']
    top = max(places, key=lambda p: p['properties']['elevM'])
    print(f"  places.geojson  {len(places)} names, {len(peaks)} peaks, highest "
          f"{top['properties']['name']} {top['properties']['elevM']} m")

    water = build_water(terrain, places)
    geom.write_json(os.path.join(DATA, 'water.geojson'), fc(water),
                    compact_keys=('coordinates',))
    big = sorted(water, key=lambda f: -f['properties']['areaKm2'])[:3]
    print(f'  water.geojson   {len(water)} bodies; ' + ', '.join(
        f"{f['properties']['name']} {f['properties']['areaKm2']} km2 at "
        f"{f['properties']['levelM']} m (N50 {f['properties']['n50Hoyde']})" for f in big))

    glaciers = build_glaciers(places)
    geom.write_json(os.path.join(DATA, 'glaciers.geojson'), fc(glaciers),
                    compact_keys=('coordinates',))
    print(f'  glaciers.geojson {len(glaciers)} polygons, '
          f"largest {max(f['properties']['areaKm2'] for f in glaciers):.3f} km2")

    rivers = build_rivers(places)
    geom.write_json(os.path.join(DATA, 'rivers.geojson'), fc(rivers),
                    compact_keys=('coordinates',))
    print(f'  rivers.geojson  {len(rivers)} features')

    with open(os.path.join(WORK, 'route_stats.json'), 'w', encoding='utf-8') as f:
        json.dump({'ascentM': round(st['ascent'], 1), 'descentM': round(st['descent'], 1),
                   'rawAscentM': round(st['raw_ascent'], 1),
                   'unsmoothedAscentM': round(st['unsmoothed'], 1),
                   'lengthM': round(float(st['rd'][-1]), 1),
                   'highIndex': st['hi'], 'highElevM': round(float(st['z'][st['hi']]), 1),
                   'highX': round(float(st['rx'][st['hi']]), 1),
                   'highY': round(float(st['ry'][st['hi']]), 1),
                   'z': [round(float(v), 2) for v in st['z']]}, f)


if __name__ == '__main__':
    main()
