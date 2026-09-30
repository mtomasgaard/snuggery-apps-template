"""Design-stage measurements for US Quakes (DESIGN.md §13, tools/CONTRACT.md §12).

Reads only the pipeline's cache (Template/scripts/us_quakes/cache/, filled by fetch_catalog.py,
fetch_relief.py and probe.py --fetch) and prints the numbers the design quotes. Writes nothing.
It is a measuring tool, not the build: the pipeline stage writes the real files and asserts the
caps; where its numbers differ, CONTRACT.md is updated with the new ones.

    cd Template/scripts/us_quakes
    .venv/bin/python ../../us-quakes/tools/design_measure.py [history|relief|geo|faults|snapshot|sections|stories|ramp|all]
"""
import base64
import collections
import csv
import glob
import io
import json
import math
import os
import struct
import sys
import zlib
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.normpath(os.path.join(HERE, '..', '..', 'scripts', 'us_quakes'))
sys.path.insert(0, PIPE)
from common import simplify, encode_line, unwrap_lon, clip_line_to_bbox, clip_polygon_to_bbox  # noqa: E402

CACHE = os.path.join(PIPE, 'cache')
EPOCH = datetime(1600, 1, 1, tzinfo=timezone.utc)
AXIS = (172.0, 17.0, 296.0, 72.0)          # unwrapped lon, lat
_eq = None


def earthquakes():
    """Every cached row of type 'earthquake', de-duplicated by id, sorted by (time, id)."""
    global _eq
    if _eq is not None:
        return _eq
    seen, rows = set(), []
    for reg in ('conus', 'ak', 'hi', 'pr'):
        for f in sorted(glob.glob(os.path.join(CACHE, 'comcat', reg, '*.csv'))):
            with open(f, encoding='utf-8') as fh:
                for r in csv.DictReader(fh):
                    if r['id'] in seen or r['type'] != 'earthquake':
                        continue
                    seen.add(r['id'])
                    t = datetime.fromisoformat(r['time'].replace('Z', '+00:00')) - EPOCH
                    r['tmin'] = t.days * 1440 + t.seconds // 60
                    r['tsec'] = t.days * 86400 + t.seconds + t.microseconds / 1e6
                    rows.append(r)
    rows.sort(key=lambda r: (r['tsec'], r['id']))
    _eq = rows
    return rows


def mag_code(s):
    if s == '':
        return 255
    from decimal import Decimal, ROUND_HALF_UP
    return int((Decimal(s) * 10).quantize(Decimal(1), rounding=ROUND_HALF_UP)) + 20


def columns(rows, types):
    import numpy as np
    n = len(rows)
    t = np.array([r['tmin'] for r in rows], '<u4')
    x = np.array([round((unwrap_lon(float(r['longitude'])) - 172.0) / 0.002) for r in rows], '<u2')
    y = np.array([round((float(r['latitude']) - 17.0) / 0.001) for r in rows], '<u2')
    d = np.array([65535 if r['depth'] == '' else round((float(r['depth']) + 5.0) * 100) for r in rows], '<u2')
    m = np.array([mag_code(r['mag']) for r in rows], 'u1')
    st = {'reviewed': 0, 'automatic': 1, 'manual': 2}
    f = np.array([st.get(r['status'], 3) | (types.get(r['magType'], 63) << 2) for r in rows], 'u1')
    return [t, x, y, d, m, f]


def history():
    import numpy as np
    eq = earthquakes()
    n = len(eq)
    print(f'earthquakes {n:,} (of the cache\'s every-type rows), sorted by time')
    lon = [unwrap_lon(float(r['longitude'])) for r in eq]
    lat = [float(r['latitude']) for r in eq]
    print(f'lon {min(lon)}..{max(lon)}  lat {min(lat)}..{max(lat)}')
    mt = collections.Counter(r['magType'] for r in eq)
    print(f'magType labels {len(mt)} (blank counted): {mt.most_common()}')
    print('status', dict(collections.Counter(r['status'] for r in eq)))
    mags = [float(r['mag']) for r in eq if r['mag'] != '']
    deps = [float(r['depth']) for r in eq if r['depth'] != '']
    print(f'no magnitude {n - len(mags)}, magnitude {min(mags)}..{max(mags)}; no depth {n - len(deps)}, depth {min(deps)}..{max(deps)} km')
    print(f'depth exactly 10 km: {sum(1 for d in deps if d == 10.0):,}')
    print(f'M4.5+ {sum(1 for v in mags if v >= 4.5):,}  M4+ {sum(1 for v in mags if v >= 4):,}  M3+ {sum(1 for v in mags if v >= 3):,}')
    pre = [r for r in eq if r['time'] < '1900']
    print(f'before 1900: {len(pre):,} (no depth {sum(1 for r in pre if not r["depth"])}, no magnitude '
          f'{sum(1 for r in pre if not r["mag"])}); first earthquake {eq[0]["time"]} {eq[0]["place"]}')
    types = {k: i for i, k in enumerate(sorted(k for k in mt if k))}
    cols = columns(eq, types)
    print('x code', int(cols[1].min()), int(cols[1].max()), ' y code', int(cols[2].min()), int(cols[2].max()),
          ' depth code max', int(cols[3][cols[3] < 65535].max()), ' mag code', int(cols[4][cols[4] < 255].min()),
          int(cols[4][cols[4] < 255].max()), ' minutes', int(cols[0].min()), int(cols[0].max()))
    raw = b''.join(c.tobytes() for c in cols)
    print(f'columns raw {len(raw):,} B  deflate(6) {len(zlib.compress(raw, 6)):,} B  per column deflate(6) '
          f'{[len(zlib.compress(c.tobytes(), 6)) for c in cols]}')
    side = [r for r in eq if r['mag'] != '' and float(r['mag']) >= 4.5]
    ids = '\n'.join(r['id'] for r in side).encode()
    pl = '\n'.join(r['place'] for r in side).encode()
    idx = np.array([i for i, r in enumerate(eq) if r['mag'] != '' and float(r['mag']) >= 4.5], '<u4').tobytes()
    print(f'text rows (M4.5+) {len(side):,}: index {len(idx):,} B deflate {len(zlib.compress(idx, 6)):,}; '
          f'ids {len(ids):,} B deflate {len(zlib.compress(ids, 6)):,}; places {len(pl):,} B deflate {len(zlib.compress(pl, 6)):,}')


def _relief_layer(key):
    from PIL import Image
    import numpy as np

    def load(k):
        h = np.array(Image.open(os.path.join(CACHE, 'relief', k + '.png')).convert('L')).astype(np.float32)
        e = np.array(Image.open(os.path.join(CACHE, 'relief', k + '.tif'))).astype(np.int32)
        return h, (e != 0) & (e != -32768)
    if key == 'ak':
        hw, lw = load('ak-west')
        he, le = load('ak-east')
        return np.concatenate([hw, he], 1), np.concatenate([lw, le], 1)
    return load(key)


def relief():
    from PIL import Image
    import numpy as np
    tot = collections.Counter()
    for key, scale in (('conus', 1.0), ('ak', 1.0), ('ak', 0.75), ('hi', 1.0), ('pr', 1.0)):
        h, land = _relief_layer(key)
        lo = float(np.percentile(h[land], 0.5))
        g = np.where(land, h, 242.0)                  # masked -> the flat-ground grey
        s = np.clip((g - lo) / (255.0 - lo) * 255.0, 0, 255).round().astype(np.uint8)
        neutral = (242.0 - lo) / (255.0 - lo) * 255.0
        im = Image.fromarray(s, 'L')
        if scale != 1.0:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        for q in (70, 75, 82):
            b = io.BytesIO()
            im.save(b, 'JPEG', quality=q, optimize=True)
            n = len(b.getvalue())
            if not (key == 'ak' and scale == 1.0):
                tot[q] += n
            print(f'{key:5s} scale {scale:4.2f} {im.size[0]}x{im.size[1]} land px {int(land.sum()):,} '
                  f'p0.5 {lo:.0f} neutral {neutral:.1f}  q{q} {n:,} B')
    print('total with Alaska at 0.75:', dict(tot))


def _parts(g):
    t, c = g['type'], g['coordinates']
    return {'LineString': [c], 'MultiLineString': c, 'Polygon': c,
            'MultiPolygon': [r for p in c for r in p]}.get(t, [])


def _layer(name, poly, thr, min_area_km2=0.0):
    with open(os.path.join(CACHE, 'ne', name + '.geojson'), encoding='utf-8') as fh:
        gj = json.load(fh)
    out, nv = [], 0
    for f in gj['features']:
        for r in _parts(f['geometry']):
            r = [(unwrap_lon(x), y) for x, y in r]
            if any(abs(a[0] - b[0]) > 180 for a, b in zip(r, r[1:])):
                continue                      # crosses the unwrap seam; the build splits these first
            pieces = [clip_polygon_to_bbox(r, AXIS)] if poly else clip_line_to_bbox(r, AXIS)
            for p in pieces:
                if not p or len(p) < 2:
                    continue
                s = simplify(p, thr, closed=poly)
                if len(s) < (4 if poly else 2):
                    continue
                if poly and min_area_km2:
                    from common import ring_area_m2
                    if ring_area_m2(s) < min_area_km2 * 1e6:
                        continue
                out.append(encode_line(s, 1000))
                nv += len(s)
    b = json.dumps(out, separators=(',', ':')).encode()
    return len(out), nv, len(b), len(zlib.compress(b, 6))


def geo():
    for name, poly, thr in (('ne_50m_land', True, 2.5e5), ('ne_50m_coastline', False, 2.5e5),
                            ('ne_50m_lakes', True, 2.5e5), ('ne_50m_admin_1_states_provinces_lines', False, 2.5e5),
                            ('ne_50m_admin_0_boundary_lines_land', False, 2.5e5)):
        print(f'{name:40s} VW {thr:>9,.0f} m²  (pieces, vertices, json B, deflate B) {_layer(name, poly, thr)}')
    tot = [0, 0]
    for band in ('K_200', 'J_1000', 'I_2000', 'H_3000', 'G_4000', 'F_5000', 'E_6000', 'D_7000'):
        r = _layer('ne_10m_bathymetry_' + band, True, 5e6, 50.0)
        tot[0] += r[2]
        tot[1] += r[3]
        print(f'bathymetry {band:7s} VW 5 km², rings < 50 km² dropped: {r}')
    print(f'bathymetry total json {tot[0]:,} B deflate {tot[1]:,} B')
    with open(os.path.join(CACHE, 'ne', 'ne_50m_populated_places_simple.geojson'), encoding='utf-8') as fh:
        g = json.load(fh)
    pl = [f['properties'] for f in g['features']
          if AXIS[1] <= f['geometry']['coordinates'][1] <= AXIS[3]
          and AXIS[0] <= unwrap_lon(f['geometry']['coordinates'][0]) <= AXIS[2]]
    print(f'places in the axis box {len(pl)}; by country {collections.Counter(p["adm0name"] for p in pl).most_common(4)}')


def _wkb_lines(b):
    o = 1
    e = '<' if b[0] == 1 else '>'
    t = struct.unpack_from(e + 'I', b, o)[0] % 1000
    o += 4
    out = []
    if t == 5:
        n = struct.unpack_from(e + 'I', b, o)[0]
        o += 4
        for _ in range(n):
            o += 5
            m = struct.unpack_from(e + 'I', b, o)[0]
            o += 4
            out.append([struct.unpack_from(e + 'dd', b, o + 16 * i) for i in range(m)])
            o += 16 * m
    elif t == 2:
        m = struct.unpack_from(e + 'I', b, o)[0]
        o += 4
        out.append([struct.unpack_from(e + 'dd', b, o + 16 * i) for i in range(m)])
    return out


def faults():
    import pyogrio
    src = '/vsizip/' + os.path.join(CACHE, 'faults', 'Qfaults_GIS.zip') + '/GDB/Qfaults_2020_WGS84.gdb'
    meta, _, geom, cols = pyogrio.raw.read(src, layer='Qfaults_2020')
    names = list(meta['fields'])
    ix = {k: i for i, k in enumerate(names)}
    recs = list(zip(*cols))
    print(f'Qfaults_2020 {len(recs):,} features')
    for k in ('age', 'slip_rate', 'class', 'linetype'):
        print(f'  {k}: {collections.Counter(r[ix[k]] for r in recs).most_common(9)}')
    groups = collections.defaultdict(list)
    attr = {}
    for r, g in zip(recs, geom):
        key = (r[ix['fault_id']], r[ix['section_id']], r[ix['age']], r[ix['slip_rate']], r[ix['class']], r[ix['linetype']])
        attr.setdefault(key, (r[ix['fault_name']] or '', r[ix['section_name']] or ''))
        for pts in _wkb_lines(g):
            groups[key].append([(round(unwrap_lon(x), 5), round(y, 5)) for x, y in pts])
    nv0 = sum(len(p) for v in groups.values() for p in v)
    print(f'groups (fault, section, age, slip rate, class, line type) {len(groups):,}; lines '
          f'{sum(len(v) for v in groups.values()):,}; vertices {nv0:,}; fault names {len({a[0] for a in attr.values()}):,}')
    for thr in (20000, 50000, 200000):
        strs, counts, nv = [], [], 0
        for key in sorted(groups, key=lambda k: (attr[k], str(k))):
            pts, cnt = [], []
            for c in groups[key]:
                s = simplify(c, thr)
                pts += s
                cnt.append(len(s))
                nv += len(s)
            strs.append(encode_line(pts, 1000))
            counts.append(cnt)
        b = json.dumps({'s': strs, 'n': counts}, separators=(',', ':')).encode()
        print(f'  VW {thr:>7,} m²: vertices {nv:,}; lines+counts json {len(b):,} B deflate {len(zlib.compress(b, 6)):,} B')
    # the attribute tables of CONTRACT §4.4: string tables + one small-integer row per group
    extra = collections.defaultdict(tuple)
    for r in recs:
        key = (r[ix['fault_id']], r[ix['section_id']], r[ix['age']], r[ix['slip_rate']], r[ix['class']], r[ix['linetype']])
        if key not in extra:
            extra[key] = (r[ix['slip_sense']] or '', str(r[ix['last_review']] or '')[:4])
    fnames = sorted({a[0] for a in attr.values()})
    snames = sorted({a[1] for a in attr.values()})
    senses = sorted({e[0] for e in extra.values()})
    fi, si, ssi = ({n: i for i, n in enumerate(t)} for t in (fnames, snames, senses))
    cat = {k: sorted({str(key[j]) for key in groups}) for j, k in ((2, 'age'), (3, 'slip'), (4, 'class'), (5, 'line'))}
    rows = [[fi[attr[k][0]], si[attr[k][1]], cat['age'].index(str(k[2])), cat['slip'].index(str(k[3])),
             ssi[extra[k][0]], cat['line'].index(str(k[5])), cat['class'].index(str(k[4])),
             int(extra[k][1]) if extra[k][1].isdigit() else 0]
            for k in sorted(groups, key=lambda k: (attr[k], str(k)))]
    for name, obj in (('fault names', fnames), ('section names', snames), ('senses', senses), ('attr rows', rows)):
        b = json.dumps(obj, separators=(',', ':'), ensure_ascii=False).encode()
        print(f'  {name}: {len(obj):,} entries, json {len(b):,} B deflate {len(zlib.compress(b, 6)):,} B')


def snapshot():
    import numpy as np
    eq = earthquakes()
    part = [r for r in eq if r['time'] >= '2024-01-01']
    types = {k: i for i, k in enumerate(sorted({r['magType'] for r in part if r['magType']}))}
    raw = b''.join(c.tobytes() for c in columns(part, types))
    c = zlib.compress(raw, 9)
    print(f'proxy for two years of M2.5+ (2024-2025 rows) {len(part):,}: columns raw {len(raw):,} B, '
          f'deflate {len(c):,} B, base64 {len(base64.b64encode(c)):,} B')
    live = eq[-10000:]
    ids = '\n'.join(r['id'] for r in live).encode()
    pl = '\n'.join(r['place'] for r in live).encode()
    print(f'text of 10,000 rows: ids {len(ids):,} B -> base64(deflate) {len(base64.b64encode(zlib.compress(ids, 9))):,} B; '
          f'places {len(pl):,} B -> {len(base64.b64encode(zlib.compress(pl, 9))):,} B')


def _unit(la, lo):
    import numpy as np
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


def sections():
    import numpy as np
    eq = earthquakes()
    la = np.radians([float(r['latitude']) for r in eq])
    lo = np.radians([float(r['longitude']) for r in eq])
    dep = np.array([float(r['depth']) if r['depth'] else np.nan for r in eq])
    P = _unit(la, lo)
    R = 6371.0088
    presets = {'Cook Inlet': ((59.0, -146.8), (63.2, -154.2)), 'Aleutians': ((50.2, -176.6), (53.8, -176.6)),
               'Cascadia': ((47.3, -127.4), (47.3, -120.6)), 'Hawaii': ((18.7, -156.2), (20.4, -154.4))}
    for name, (a, b) in presets.items():
        A = _unit(math.radians(a[0]), math.radians(a[1]))
        B = _unit(math.radians(b[0]), math.radians(b[1]))
        n = np.cross(A, B)
        n /= np.linalg.norm(n)
        L = math.acos(float(np.clip(A @ B, -1, 1))) * R
        xt = np.arcsin(np.clip(P @ n, -1, 1)) * R
        pr = P - np.outer(P @ n, n)
        pr /= np.linalg.norm(pr, axis=1)[:, None]
        at = np.arctan2(np.cross(A, pr) @ n, pr @ A) * R
        for hw in (25, 50, 100):
            sel = (np.abs(xt) <= hw) & (at >= 0) & (at <= L)
            d = dep[sel]
            print(f'{name:10s} ±{hw:3d} km  length {L:5.0f} km  events {int(sel.sum()):6,}  max depth {np.nanmax(d):6.1f} km  '
                  f'p50/p90/p99 {np.round(np.nanpercentile(d, [50, 90, 99]), 1)}  at exactly 10 km {int((d == 10).sum())}')


def stories():
    eq = earthquakes()

    def m(r):
        return float(r['mag']) if r['mag'] else -9

    def line(r):
        return f"{r['id']} {r['time']} {r['latitude']},{r['longitude']} depth {r['depth'] or 'none'} M{r['mag']} {r['magType']} {r['status']} | {r['place']}"
    for i in ('official17000127050000000', 'official19060418131226300_12', 'official19640328033616_30',
              'ak018fcnsk91', 'ci38457511'):
        print('known', next((line(r) for r in eq if r['id'] == i), 'MISSING ' + i))
    for r in eq:
        if '1811-12' <= r['time'] < '1812-03' and 35 <= float(r['latitude']) <= 38 and -91 <= float(r['longitude']) <= -88:
            print('New Madrid', line(r))
    ok = [r for r in eq if 33.6 <= float(r['latitude']) <= 37.0 and -103.0 <= float(r['longitude']) <= -94.4]
    print('Oklahoma chip box M3+ per year', sorted(collections.Counter(r['time'][:4] for r in ok if m(r) >= 3 and r['time'] >= '2005').items()))
    for r in sorted((r for r in ok if r['time'] >= '2009'), key=m, reverse=True)[:2]:
        print('Oklahoma largest since 2009', line(r))
    k = [r for r in eq if '2018-04-30' <= r['time'] < '2018-09-01' and 18.8 <= float(r['latitude']) <= 20.3
         and -156.1 <= float(r['longitude']) <= -154.7]
    print(f'Kilauea box 2018-04-30..09-01 M2.5+ {len(k):,}')
    for r in sorted(k, key=m, reverse=True)[:1]:
        print('Kilauea largest', line(r))
    for r in eq:
        if '2019-07-04' <= r['time'] < '2019-07-07' and m(r) >= 6 and float(r['latitude']) < 40:
            print('Ridgecrest', line(r))


RAMP = ['#fde28d', '#f5a231', '#dc6673', '#9a6299', '#5d47ad', '#2a3b6b']   # DESIGN §6 and ART.md, 0 → 300 km
# Colour-vision simulation: Machado, Oliveira & Fernandes (2009), severity 1.0, on linear sRGB.
CVD = {'normal': ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
       'protan': ((0.152286, 1.052583, -0.204868), (0.114503, 0.786281, 0.099216), (-0.003882, -0.048116, 1.051998)),
       'deutan': ((0.367322, 0.860646, -0.227968), (0.280085, 0.672501, 0.047413), (-0.011820, 0.042940, 0.968881)),
       'tritan': ((1.255528, -0.076749, -0.178779), (-0.078411, 0.930809, 0.147602), (0.004733, 0.691367, 0.303900))}


def _lab(lin_rgb):
    r, g, b = (min(1.0, max(0.0, v)) for v in lin_rgb)
    X = 0.4124 * r + 0.3576 * g + 0.1805 * b
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    Z = 0.0193 * r + 0.1192 * g + 0.9505 * b
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116   # noqa: E731
    fx, fy, fz = f(X / 0.95047), f(Y), f(Z / 1.08883)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def _de2000(p, q):
    L1, a1, b1 = p
    L2, a2, b2 = q
    Cb = (math.hypot(a1, b1) + math.hypot(a2, b2)) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p, h2p = math.degrees(math.atan2(b1, a1p)) % 360, math.degrees(math.atan2(b2, a2p)) % 360
    dL, dC, dh = L2 - L1, C2p - C1p, h2p - h1p
    if C1p * C2p == 0:
        dh = 0
    elif dh > 180:
        dh -= 360
    elif dh < -180:
        dh += 360
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lb, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hb = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hb = (h1p + h2p) / 2
    else:
        hb = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb))
         + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.2 * math.cos(math.radians(4 * hb - 63)))
    dth = 30 * math.exp(-((hb - 275) / 25) ** 2)
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    return math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2
                     - math.sin(math.radians(2 * dth)) * Rc * (dC / Sc) * (dH / Sh))


def ramp():
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4   # noqa: E731
    worst = 99.0
    for name, m in CVD.items():
        labs = []
        for h in RAMP:
            rgb = [lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)]
            labs.append(_lab([sum(m[i][j] * rgb[j] for j in range(3)) for i in range(3)]))
        d = [round(_de2000(labs[i], labs[i + 1]), 1) for i in range(len(labs) - 1)]
        L = [round(x[0], 1) for x in labs]
        worst = min(worst, min(d))
        print(f'{name:7s} L* {L} monotonic {all(a > b for a, b in zip(L, L[1:]))}  dE2000 neighbours {d}')
    print(f'smallest neighbour dE2000 over the four: {worst}')


if __name__ == '__main__':
    what = sys.argv[1:] or ['all']
    for name in ('history', 'relief', 'geo', 'faults', 'snapshot', 'sections', 'stories', 'ramp'):
        if 'all' in what or name in what:
            print(f'--- {name}')
            globals()[name]()
