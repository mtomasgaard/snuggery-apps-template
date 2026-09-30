"""Build us-quakes/assets/geo.json (tools/CONTRACT.md §4): the basemap, depth bands, places, faults,
the static volcano list, the relief bounds, the region chips and the section presets, all on the
app's 172°..296° longitude axis; and us-quakes/tools/ref/section_ref.json for the app's section test.

    .venv/bin/python build_geo.py

Reads the pinned cache (Natural Earth, the fault database), the committed volcano sample, relief.json
and assets/history.bin (for the section reference and the preset check); no network.

The date-line seam: every geometry is clipped in its own longitudes to the two boxes [172, 180] and
[-180, -64] (latitudes 17..72), and the second part is unwrapped (+360), so no ring or line crosses
180° inside the file. A line segment that jumps across the antimeridian is first split at ±180 by
interpolation; a ring that does stops the build (Natural Earth cuts its polygons there already).
Lines and rings are simplified with Visvalingam-Whyatt (common.simplify, triangle area in m²),
rounded to 0.001° and packed as Google polylines (longitude first, factor 1000).

The basemap (land, lakes, coast, borders, states and the depth bands) is clipped instead to the wider
BASEMAP box, 168°E to 55°W and 25°S to 81°N ([168, 180] and [-180, -55]), so that every region chip's
framing on a phone is map to its edges (CONTRACT §4.1, DESIGN §25); its longitudes run on the same
axis, 168..172 written as they are and 296..305 unwrapped. Inside the axis's width from 14° to 75°N
it is simplified at the thresholds below, and past that more coarsely (DETAIL), in one pass per ring
so the zones meet without a seam. Faults, places, volcanoes, views and presets stay on the axis box.
"""
import json
import math
import os
import sys
import unicodedata
from collections import Counter, OrderedDict

import numpy as np

from common import (group, BuildError, RETRIEVED, clip_line_to_bbox, clip_polygon_to_bbox, decode_line,
                    encode_line, log, ring_area_m2, sha256_of, simplify, unwrap_lon,
                    write_credits_fragment, write_json)
from paths import APP, ASSETS, CACHE, HERE
from sources import COMCAT, STATIC, VOLCANO_LIST_SAMPLE

BUDGET = 1_900_000
BUDGET_SECTION_REF = 250_000
FACTOR = 1000
AXIS = {'west': 172, 'east': 296, 'south': 17, 'north': 72, 'unwrapBelow': 172}
BOX_A = (172.0, 17.0, 180.0, 72.0)          # east of the date line, own longitudes
BOX_B = (-180.0, 17.0, -64.0, 72.0)         # west of it, unwrapped afterwards
BASEMAP_M2 = 250_000
BATHY_M2 = 5_000_000
BATHY_MIN_KM2 = 50.0
# The basemap's extent, on the axis: measured on a 390 x 844 phone at Peek, Half and in focus mode, the
# Lower 48 chip shows 23.6°S to 68.4°N and 232.0 to 304.2, Alaska 169.0 to 241.7 and up to 79.5°N; a
# smaller basemap would make the app's clamp (js/map.js) push those framings off their boxes.
BASEMAP_BOX = {'west': 168, 'east': 305, 'south': -25, 'north': 81}
BASE_A = (168.0, -25.0, 180.0, 81.0)        # east of the date line, own longitudes
BASE_B = (-180.0, -25.0, -55.0, 81.0)       # west of it, unwrapped afterwards
# (west, south, east, north on the axis, multiple of the threshold): the first zone holding a vertex sets
# its threshold. The contract's thresholds where the chips look closely (Hawaii's and Puerto Rico's
# framings reach 14.4°N); ten times them from 5° to 84°N elsewhere, seen at the Lower 48's and Alaska's
# scale (1 px about 4 to 18 km); eighty times south of 5°N, seen only at the Lower 48's (1 px about 18 km).
DETAIL = ((172.0, 14.0, 296.0, 75.0, 1), (0.0, 5.0, 999.0, 84.0, 10), (0.0, -90.0, 999.0, 90.0, 80))
FAULT_M2 = 50_000
R_KM = 6371.0088

BASEMAP = [('land', 'ne_land', True), ('lakes', 'ne_lakes', True), ('coast', 'ne_coastline', False),
           ('borders', 'ne_borders', False), ('states', 'ne_states', False)]
BATHY = [(200, 'ne_bathy_200'), (1000, 'ne_bathy_1000'), (2000, 'ne_bathy_2000'), (3000, 'ne_bathy_3000'),
         (4000, 'ne_bathy_4000'), (5000, 'ne_bathy_5000'), (6000, 'ne_bathy_6000'), (7000, 'ne_bathy_7000')]

FAULT_AGES = ['historic', 'latest Quaternary', 'late Quaternary', 'middle and late Quaternary',
              'undifferentiated Quaternary', 'class B', 'unspecified']
FAULT_SLIPS = ['Greater than 5.0 mm/yr', 'Between 1.0 and 5.0 mm/yr', 'Between 0.2 and 1.0 mm/yr',
               'Less than 0.2 mm/yr', 'Unspecified', 'Insufficient data']
FAULT_LINES = ['Well Constrained', 'Moderately Constrained', 'Inferred']
FAULT_CLASSES = ['A', 'B', 'C']

# DESIGN §4.4, in its order: west, south, east, north in degrees (the Americas as -180..-64).
VIEWS = [('lower-48', 'Lower 48', -125.0, 24.3, -66.9, 49.5),
         ('california', 'California', -124.5, 32.4, -114.0, 42.1),
         ('pacific-northwest', 'Pacific Northwest', -127.5, 41.8, -116.4, 49.3),
         ('alaska', 'Alaska', 172.0, 51.0, -129.5, 71.5),
         ('hawaii', 'Hawaii', -160.4, 18.8, -154.7, 22.3),
         ('new-madrid', 'New Madrid', -91.2, 35.0, -88.3, 37.8),
         ('oklahoma', 'Oklahoma', -103.0, 33.6, -94.4, 37.0),
         ('yellowstone', 'Yellowstone', -111.6, 44.0, -109.7, 45.2),
         ('puerto-rico', 'Puerto Rico', -67.95, 17.6, -64.5, 18.6)]
# CONTRACT §4.9 / DESIGN §9.3: A and B as (lat, lon) in degrees.
SECTIONS = [('cook-inlet', 'Cook Inlet', (59.0, -146.8), (63.2, -154.2), 'ak018fcnsk91'),
            ('aleutians', 'Aleutians', (50.2, -176.6), (53.8, -176.6), None),
            ('cascadia', 'Cascadia', (47.3, -127.4), (47.3, -120.6), None),
            ('hawaii', 'Hawaii', (18.7, -156.2), (20.4, -154.4), None)]
SECTION_MIN_EVENTS = 300        # within ±50 km, M2.5+, all years (CONTRACT §11.1 item 5)


# ---------------------------------------------------------------------------------------------
# geometry onto the axis
# ---------------------------------------------------------------------------------------------

def split_antimeridian(coords):
    """Split a line where a segment jumps more than 180° in longitude, interpolating at ±180."""
    out, cur = [], [coords[0]]
    for (x0, y0), (x1, y1) in zip(coords, coords[1:]):
        if abs(x1 - x0) > 180:
            e0 = 180.0 if x0 > 0 else -180.0
            x1u = x1 + 360 if x0 > 0 else x1 - 360
            t = (e0 - x0) / (x1u - x0)
            ym = y0 + t * (y1 - y0)
            cur.append((e0, ym))
            out.append(cur)
            cur = [(-e0, ym)]
        cur.append((x1, y1))
    out.append(cur)
    return [p for p in out if len(p) > 1]


def line_to_axis(coords, boxes=None):
    a, b = boxes or (BOX_A, BOX_B)
    pieces = []
    for part in split_antimeridian([tuple(p[:2]) for p in coords]):
        for box, shift in ((a, 0.0), (b, 360.0)):
            for p in clip_line_to_bbox(part, box):
                pieces.append([(x + shift, y) for x, y in p])
    return pieces


def ring_to_axis(ring, boxes=None):
    a, b = boxes or (BOX_A, BOX_B)
    ring = [tuple(p[:2]) for p in ring]
    if any(abs(q[0] - p[0]) > 180 for p, q in zip(ring, ring[1:])):
        raise BuildError('a ring crosses the antimeridian; expected Natural Earth to cut it there')
    out = []
    for box, shift in ((a, 0.0), (b, 360.0)):
        r = clip_polygon_to_bbox(ring, box)
        if r:
            out.append([(x + shift, y) for x, y in r])
    return out


def pack(coords, closed):
    """Round to 0.001°, drop consecutive repeats, keep the ring closed; None when too few points."""
    pts = []
    for x, y in coords:
        q = (round(x * FACTOR) / FACTOR, round(y * FACTOR) / FACTOR)
        if not pts or q != pts[-1]:
            pts.append(q)
    if closed:
        if pts[0] != pts[-1]:
            pts.append(pts[0])
        return pts if len(pts) >= 4 else None
    return pts if len(pts) >= 2 else None


def _parts(g):
    t, c = g['type'], g['coordinates']
    if t == 'LineString':
        return [c]
    if t == 'MultiLineString':
        return c
    if t == 'Polygon':
        return c
    if t == 'MultiPolygon':
        return [r for p in c for r in p]
    return []


def _load_ne(key):
    s = STATIC[key]
    p = os.path.join(CACHE, s['name'])
    if not os.path.exists(p) or sha256_of(p) != s['sha256']:
        raise BuildError(f'{s["name"]} missing or not its pin; run fetch_layers.py')
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def detail(x, y):
    """The multiple of a layer's threshold that holds at (x on the axis, latitude): DETAIL's first zone."""
    for w, s, e, n, k in DETAIL:
        if w <= x <= e and s <= y <= n:
            return k
    return DETAIL[-1][4]


def layer(key, poly, thr, min_km2=0.0):
    """One basemap layer over BASEMAP_BOX, simplified zone by zone (DETAIL). A ring under `min_km2` is
    dropped, the limit scaled like the threshold by the finest zone the ring touches."""
    out, nv = [], 0
    boxes = (BASE_A, BASE_B)
    for ft in _load_ne(key)['features']:
        for part in _parts(ft['geometry']):
            pieces = ring_to_axis(part, boxes) if poly else line_to_axis(part, boxes)
            for p in pieces:
                s = simplify(p, thr, closed=poly, scale=detail)
                if poly and min_km2 and ring_area_m2(s[:-1]) < min_km2 * 1e6 * min(detail(x, y) for x, y in s):
                    continue
                q = pack(s, poly)
                if q is None:
                    continue
                out.append(encode_line(q, FACTOR))
                nv += len(q)
    return out, nv


# ---------------------------------------------------------------------------------------------
# places, faults, volcanoes
# ---------------------------------------------------------------------------------------------

def in_axis(lon_axis, lat):
    return AXIS['west'] <= lon_axis <= AXIS['east'] and AXIS['south'] <= lat <= AXIS['north']


def places():
    out = []
    for ft in _load_ne('ne_places')['features']:
        p = ft['properties']
        lon, lat = ft['geometry']['coordinates'][:2]
        la = unwrap_lon(lon)
        if not in_axis(la, lat):
            continue
        rec = {'n': p['name'], 'lon': round(la, 3), 'lat': round(lat, 3), 'r': int(p['scalerank']),
               'a1': p.get('adm1name') or '', 'c': p.get('adm0name') or '', '_pop': p.get('pop_max') or 0}
        for k in ('n', 'a1', 'c'):
            if unicodedata.normalize('NFC', rec[k]) != rec[k]:
                raise BuildError(f'place name not NFC: {rec[k]!r}')
        out.append(rec)
    out.sort(key=lambda r: (r['r'], -r['_pop'], r['n']))
    for r in out:
        del r['_pop']
    return out


def _wkb_lines(b):
    """MultiLineString / LineString WKB (2D, or with Z/M ignored) -> list of [(x, y)]."""
    import struct
    e = '<' if b[0] == 1 else '>'
    t = struct.unpack_from(e + 'I', b, 1)[0]
    base, dims = t % 1000, 2 + (t // 1000 in (1, 2)) + (t // 1000 == 3) * 2
    o = 5

    def line(o):
        n = struct.unpack_from(e + 'I', b, o)[0]
        o += 4
        pts = [struct.unpack_from(e + 'dd', b, o + 8 * dims * i) for i in range(n)]
        return pts, o + 8 * dims * n
    if base == 2:
        return [line(o)[0]]
    if base == 5:
        n = struct.unpack_from(e + 'I', b, o)[0]
        o += 4
        out = []
        for _ in range(n):
            o += 5
            pts, o = line(o)
            out.append(pts)
        return out
    raise BuildError(f'unexpected fault geometry type {t}')


def _label(v):
    if v is None:
        return ''
    return str(v).strip()


def faults():
    import pyogrio
    s = STATIC['qfaults']
    zp = os.path.join(CACHE, s['name'])
    if not os.path.exists(zp) or sha256_of(zp) != s['sha256']:
        raise BuildError('the fault ZIP is missing or not its pin; run fetch_layers.py')
    src = '/vsizip/' + zp + '/GDB/Qfaults_2020_WGS84.gdb'
    meta, _, geom, cols = pyogrio.raw.read(src, layer='Qfaults_2020')
    names = list(meta['fields'])
    ix = {k: i for i, k in enumerate(names)}
    recs = list(zip(*cols))
    ages, slips, lines, classes = (list(v) for v in (FAULT_AGES, FAULT_SLIPS, FAULT_LINES, FAULT_CLASSES))
    extra = Counter()
    groups = OrderedDict()
    nfeat = nline = nv0 = 0
    for r, g in zip(recs, geom):
        nfeat += 1
        age = _label(r[ix['age']])
        if age == 'Late Quaternary':
            age = 'late Quaternary'
        labels = {'age': age, 'slip': _label(r[ix['slip_rate']]), 'line': _label(r[ix['linetype']]),
                  'class': _label(r[ix['class']])}
        for k, lst in (('age', ages), ('slip', slips), ('line', lines), ('class', classes)):
            if labels[k] and labels[k] not in lst:
                lst.append(labels[k])
                extra[f'{k}: {labels[k]}'] += 1
        lr = r[ix['last_review']]
        year = int(str(lr)[:4]) if lr is not None and str(lr)[:4].isdigit() else 0
        key = (_label(r[ix['fault_name']]), _label(r[ix['section_name']]), labels['age'], labels['slip'],
               _label(r[ix['slip_sense']]), labels['line'], labels['class'], year,
               _label(r[ix['fault_id']]), _label(r[ix['section_id']]))
        if g is None:
            continue
        parts = _wkb_lines(g)
        for pts in parts:
            nline += 1
            nv0 += len(pts)
            for piece in line_to_axis(pts):
                groups.setdefault(key, []).append(piece)
    for lst in (ages, slips, lines, classes):
        lst.append('')
    fnames = sorted({k[0] for k in groups})
    snames = sorted({k[1] for k in groups})
    senses = sorted({k[4] for k in groups})
    fi, si, ssi = ({v: i for i, v in enumerate(t)} for t in (fnames, snames, senses))

    def row(k):
        return [fi[k[0]], si[k[1]], ages.index(k[2]), slips.index(k[3]), ssi[k[4]], lines.index(k[5]),
                classes.index(k[6]), k[7]]
    order = sorted(groups, key=lambda k: (k[0], k[1], row(k)[2:], k[8], k[9]))
    grows, counts, strs = [], [], []
    nv = 0
    for k in order:
        pts, cnt = [], []
        for c in groups[k]:
            q = pack(simplify(c, FAULT_M2), False)
            if q is None:                         # shorter than 0.001°: keep the trace as one point, twice
                q = [(round(c[0][0] * FACTOR) / FACTOR, round(c[0][1] * FACTOR) / FACTOR)] * 2
            pts += q
            cnt.append(len(q))
        nv += len(pts)
        grows.append(row(k))
        counts.append(cnt)
        strs.append(encode_line(pts, FACTOR))
    if extra:
        log(f'  fault labels outside the contract\'s lists, appended: {dict(extra)}')
    out = {'simplify_m2': FAULT_M2, 'factor': FACTOR, 'ages': ages, 'slipRates': slips, 'lineTypes': lines,
           'classes': classes, 'names': fnames, 'sections': snames, 'senses': senses,
           'groups': grows, 'counts': counts, 'lines': strs}
    stats = {'features': nfeat, 'groups': len(order), 'lines': sum(len(c) for c in counts),
             'sourceLines': nline, 'verticesIn': nv0, 'verticesOut': nv}
    return out, stats


def volcanoes():
    p = os.path.join(HERE, VOLCANO_LIST_SAMPLE['path'])
    if sha256_of(p) != VOLCANO_LIST_SAMPLE['sha256']:
        raise BuildError(f'{VOLCANO_LIST_SAMPLE["path"]} is not its pin')
    with open(p, encoding='utf-8') as f:
        vs = json.load(f)
    boxes = []
    for k in ('conus', 'ak', 'hi', 'pr'):
        b = COMCAT['regions'][k]['box']
        boxes.append((unwrap_lon(b['minlongitude']), b['minlatitude'], unwrap_lon(b['maxlongitude']), b['maxlatitude']))
    out = []
    for v in vs:
        lon, lat = unwrap_lon(float(v['longitude'])), float(v['latitude'])
        if not any(w <= lon <= e and s <= lat <= n for w, s, e, n in boxes):
            continue
        threat = (v.get('nvews_threat') or '').strip()
        if threat == 'Waiting for Threat Level':
            threat = ''
        out.append({'vnum': str(v['vnum']), 'name': v['volcano_name'], 'lon': round(lon, 4), 'lat': round(lat, 4),
                    'elev_m': v['elevation_meters'], 'threat': threat, 'obs': v['obs_abbr']})
    out.sort(key=lambda r: (int(r['vnum']) if r['vnum'].isdigit() else 10 ** 9, r['vnum']))
    return out, len(vs)


def relief():
    with open(os.path.join(HERE, 'relief.json'), encoding='utf-8') as f:
        rj = json.load(f)
    out = []
    for key in ('conus', 'ak', 'hi', 'pr'):
        m = rj['regions'][key]
        p = os.path.join(ASSETS, m['file'])
        if not os.path.exists(p) or sha256_of(p) != m['sha256']:
            raise BuildError(f'{m["file"]} is not the JPEG relief.json describes; run build_relief.py')
        out.append({'key': key, 'file': m['file'], 'width': m['width'], 'height': m['height'],
                    'west': m['west'], 'east': m['east'], 'south': m['south'], 'north': m['north'],
                    'neutral': m['neutral'], 'lo': m['lo'], 'quality': m['quality']})
    return out


# ---------------------------------------------------------------------------------------------
# the history, decoded, for the section presets
# ---------------------------------------------------------------------------------------------

def read_history():
    with open(os.path.join(ASSETS, 'history.json'), encoding='utf-8') as f:
        hj = json.load(f)
    with open(os.path.join(ASSETS, 'history.bin'), 'rb') as f:
        buf = f.read()
    sec = hj['sections']
    dt = {'uint32': '<u4', 'uint16': '<u2', 'uint8': 'u1'}

    def col(k):
        s = sec[k]
        return np.frombuffer(buf, dt[s['type']], s['count'], s['offset'])

    def text(k):
        s = sec[k]
        return buf[s['offset']:s['offset'] + s['count']].decode('utf-8').split('\n')
    return hj, {k: col(k) for k in ('t', 'x', 'y', 'd', 'm', 'f', 'text_row')}, text('id_text')


def _unit(lat_deg, lon_deg):
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


def section_geometry(a, b, lat, lon):
    """Along- and cross-track km of points (degrees) against the great circle A->B, float64:
    n = A x B / |A x B|; cross = asin(P.n) R; along = atan2((A x p).n, p.A) R, p = P projected onto
    the plane of the circle; L = acos(A.B) R. R = 6371.0088 km (the mean Earth radius)."""
    A = _unit(a[0], a[1])
    B = _unit(b[0], b[1])
    n = np.cross(A, B)
    n /= np.linalg.norm(n)
    L = math.acos(float(np.clip(A @ B, -1, 1))) * R_KM
    P = _unit(lat, lon)
    cross = np.arcsin(np.clip(P @ n, -1, 1)) * R_KM
    pr = P - np.outer(P @ n, n)
    pr /= np.linalg.norm(pr, axis=1)[:, None]
    along = np.arctan2(np.cross(A, pr) @ n, pr @ A) * R_KM
    return along, cross, L


def sections(cols, ids):
    lon = 172.0 + cols['x'].astype(np.float64) * 0.002
    lat = 17.0 + cols['y'].astype(np.float64) * 0.001
    m = cols['m']
    ok = (m >= 45) & (m != 255)
    id_of = {ids[i]: int(r) for i, r in enumerate(cols['text_row'])}
    out, ref, report = [], [], []
    for key, label, a, b, hl in SECTIONS:
        along, cross, L = section_geometry(a, b, lat, lon)
        inside = ok & (along >= 0) & (along <= L)
        n50 = int((inside & (np.abs(cross) <= 50)).sum())
        if n50 < SECTION_MIN_EVENTS:
            raise BuildError(f'section {key}: {n50} events within ±50 km at M2.5+, fewer than {SECTION_MIN_EVENTS}')
        entry = {'key': key, 'label': label, 'a': [round(unwrap_lon(a[1]), 4), a[0]],
                 'b': [round(unwrap_lon(b[1]), 4), b[0]]}
        if hl:
            if hl not in id_of:
                raise BuildError(f'section {key}: highlight {hl} is not in the history text table')
            r = id_of[hl]
            if not (inside[r] and abs(cross[r]) <= 50):
                raise BuildError(f'section {key}: highlight {hl} is not within ±50 km of the line')
            entry['highlight'] = hl
        out.append(entry)
        rows = np.nonzero(inside & (np.abs(cross) <= 100))[0][:200]
        ref.append({'key': key, 'a': entry['a'], 'b': entry['b'], 'lengthKm': round(L, 9),
                    'rows': [[int(i), round(float(lon[i]), 3), round(float(lat[i]), 3),
                              round(float(along[i]), 9), round(float(cross[i]), 9)] for i in rows]})
        report.append(f'{key} {L:.0f} km, {n50:,} events within ±50 km at M2.5+')
    return out, ref, report


# ---------------------------------------------------------------------------------------------

def build():
    geo = OrderedDict()
    geo['schema'] = 1
    geo['retrieved'] = RETRIEVED
    geo['axis'] = AXIS
    geo['basemap'] = BASEMAP_BOX
    geo['polyline'] = {'algorithm': 'Google encoded polyline, longitude first', 'factor': FACTOR}
    stats = {}
    for name, key, poly in BASEMAP:
        geo[name], nv = layer(key, poly, BASEMAP_M2)
        stats[name] = (len(geo[name]), nv)
    bands = []
    for depth, key in BATHY:
        rings, nv = layer(key, True, BATHY_M2, BATHY_MIN_KM2)
        bands.append({'depth': depth, 'rings': rings})
        stats[f'bathymetry {depth}'] = (len(rings), nv)
    geo['bathymetry'] = bands
    geo['places'] = places()
    geo['faults'], fstats = faults()
    geo['volcanoes'], nvolc = volcanoes()
    geo['relief'] = relief()
    geo['views'] = [{'key': k, 'label': lab, 'west': round(unwrap_lon(w), 4), 'south': s,
                     'east': round(unwrap_lon(e), 4), 'north': n} for k, lab, w, s, e, n in VIEWS]
    for v in geo['views']:
        if not (in_axis(v['west'], v['south']) and in_axis(v['east'], v['north']) and v['west'] < v['east']):
            raise BuildError(f'view {v["key"]} is not inside the axis')
    hj, cols, ids = read_history()
    geo['sections'], sref, sreport = sections(cols, ids)
    geo['sources'] = ['naturalearth', 'qfaults', 'volcano-list', 'relief']

    write_json(os.path.join(ASSETS, 'geo.json'), geo, BUDGET, ndigits=6)
    write_json(os.path.join(APP, 'tools', 'ref', 'section_ref.json'),
               {'schema': 1, 'file': 'history.bin', 'count': hj['count'], 'radiusKm': R_KM,
                'method': section_geometry.__doc__.split('\n', 1)[0].strip() + ' ' +
                ' '.join(l.strip() for l in section_geometry.__doc__.split('\n')[1:]).strip(),
                'decode': 'lon = 172 + 0.002 x, lat = 17 + 0.001 y (the axis); M2.5+ (m >= 45, m != 255); '
                          'the first 200 rows in history order within ±100 km and 0 <= along <= length',
                'columns': ['row', 'lon', 'lat', 'alongKm', 'crossKm'], 'sections': sref},
               BUDGET_SECTION_REF, ndigits=9)
    for k, v in stats.items():
        log(f'  {k:18s} pieces {v[0]:>6,}  vertices {v[1]:>8,}')
    log(f'  places {len(geo["places"])}; volcanoes {len(geo["volcanoes"])} of {nvolc}; faults {fstats}')
    for line in sreport:
        log(f'  section {line}')
    write_credits_fragment('build_geo', [
        {'id': 'naturalearth', 'source': [], 'retrieved': RETRIEVED,
         'adaptations': ['clipped to the map\'s extent (168°E to 55°W, 25°S to 81°N), cut at 180° and put on '
                         'one continuous longitude axis',
                         'simplified (Visvalingam-Whyatt: 250 000 m² for 1:50m land, coast, lakes and '
                         'boundaries; 5 km² for the depth bands, whose rings under 50 km² are dropped) from 172°E '
                         'to 64°W and 14° to 75°N, ten times coarser elsewhere north of 5°N and eighty times '
                         'south of it; coordinates rounded to 0.001°; packed as encoded polylines (assets/geo.json)',
                         f'{len(geo["places"])} populated places inside the box, with name, rank and region']},
        {'id': 'qfaults', 'source': [], 'retrieved': RETRIEVED,
         'adaptations': [f'{group(fstats["features"])} fault traces grouped into {group(fstats["groups"])} records by '
                         'fault, section and their age, slip-rate, slip-sense, line-type, class and review-year '
                         'labels (as the database spells them; "Late Quaternary" joined to "late Quaternary")',
                         'lines simplified at 50 000 m² and rounded to 0.001°; the fault_url links are not '
                         'shipped (the search they point at was retired on February 26, 2026)']},
        {'id': 'volcano-list', 'source': [], 'retrieved': VOLCANO_LIST_SAMPLE['retrieved'],
         'adaptations': [f'the {len(geo["volcanoes"])} of {nvolc} US volcanoes inside the four map boxes; name, '
                         'position, elevation, threat class and observatory kept; web links not shipped']},
    ])
    return geo


def main():
    build()


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        sys.exit(1)
