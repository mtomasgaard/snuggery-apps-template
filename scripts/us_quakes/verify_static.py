"""Verify every static file US Quakes ships against tools/CONTRACT.md §11.1, independently of the
builders (it re-reads the catalogue CSVs itself and decodes the shipped bytes the way the app does).
Prints every measured number; exits non-zero on the first failed check.

    .venv/bin/python verify_static.py              # includes the count check against the USGS service
    .venv/bin/python verify_static.py --offline    # everything except that network check

Checks, in order:
 1. counts: each box and era's cached rows against a fresh USGS count (all event types, the same
    box, era and floor, endtime = the cutoff) within 0.5 %; and exactly, per box, the shipped rows
    equal the cache's earthquake rows (less the rows the history's floor rule drops, named).
 2. the six known events survive the round trip with their values.
 3. every row decoded against its CSV row within the contract's bounds (the depth code exactly, 1500
    only for the catalog's exact 10); order, cutoff, codes, the text table; and the committed decoder
    reference (history_ref.json) against the file.
 4. history.bin's sections: offsets, sizes, 4-byte alignment, nothing after the last.
 5. geo.json: the basemap's polylines decode inside its extent (which holds the axis box), the
    faults, places and volcanoes onto the axis, rings close, fault counts add up, 148
    volcanoes, relief bounds and sizes as relief.json states (the JPEGs' sha256 and pixel sizes),
    the registration gate as recorded, views and presets inside the axis, each preset holding at
    least 300 events within ±50 km at M2.5+.
 6. about.json and stories.json: every number re-derived from the history, every story anchor found.
 7. budgets (raw caps, and assets/ as the ZIP stores it), nothing unclaimed in assets/, no web address
    in the app's data where the contract forbids it, no AI vendor name in any shipped text.
"""
import argparse
import csv
import glob
import json
import math
import os
import re
import sys
import zlib
from collections import Counter
from decimal import ROUND_HALF_UP, Decimal

import numpy as np
from PIL import Image

from common import decode_line, sha256_of, zip_stored_size
from paths import APP, ASSETS, CACHE, HERE

CLAIMED = ['about.json', 'geo.json', 'history.bin', 'history.json', 'relief-ak.jpg', 'relief-conus.jpg',
           'relief-hi.jpg', 'relief-pr.jpg', 'stories.json']
RAW_CAPS = {'history.bin': 5_800_000, 'history.json': 16_000, 'relief-conus.jpg': 1_050_000,
            'relief-ak.jpg': 720_000, 'relief-hi.jpg': 60_000, 'relief-pr.jpg': 100_000, 'geo.json': 2_360_000,
            'stories.json': 30_000, 'about.json': 40_000}
ZIP_CAP = 6_340_000   # 6,000,000 until the 1:10m basemap and its credit added 340,010 B as stored (plan 0011 A); the yearly headroom kept
KNOWN = {  # CONTRACT §11.2, the values measured in the cache on 2026-09-30
    'official17000127050000000': ('1700-01-27T05:00', 45.0, -125.0, None, '9.0', 'mw'),
    'official18111216081500000': ('1811-12-16T08:15', 36.0, -89.96, None, '7.5', 'mw'),
    'official19060418131226300_12': ('1906-04-18T13:12', 37.75, -122.55, 11.7, '7.9', 'mw'),
    'official19640328033616_30': ('1964-03-28T03:36', 60.908, -147.339, 25.0, '9.2', 'mw'),
    'ak018fcnsk91': ('2018-11-30T17:29', 61.3464, -149.9552, 46.7, '7.1', 'mw'),
    'ci38457511': ('2019-07-06T03:19', 35.7695, -117.5993, 8.0, '7.1', 'mw'),
}
VENDORS = re.compile(r'\b(Claude|Anthropic|OpenAI|ChatGPT|GPT-\d|Gemini|Copilot|Midjourney|LLaMA|Mistral AI)\b')
REGIONS = ['conus', 'ak', 'hi', 'pr']
EPOCH = __import__('datetime').date(1600, 1, 1).toordinal()
_fail = [0]


def ok(cond, msg):
    print(('ok    ' if cond else 'FAIL  ') + msg, flush=True)
    if not cond:
        _fail[0] += 1
        raise SystemExit(f'verify_static: FAILED: {msg}')


def load(name):
    with open(os.path.join(ASSETS, name), encoding='utf-8') as f:
        return json.load(f)


def ms_of(text):
    """Independent of common.parse_time_ms: via datetime."""
    import datetime as dt
    d = dt.datetime.strptime(text[:19], '%Y-%m-%dT%H:%M:%S')
    frac = text[20:-1] if len(text) > 20 and text[19] == '.' else ''
    return ((d.toordinal() - EPOCH) * 86400 + d.hour * 3600 + d.minute * 60 + d.second) * 1000 + \
        (int((frac + '000')[:3]) if frac else 0)


def tenth(s):
    return (Decimal(s) * 10).quantize(Decimal(1), rounding=ROUND_HALF_UP)


def dcode(s):
    """The depth code of a CSV depth text by CONTRACT §1, written here again rather than imported:
    (depth + 5) x 100 half up, except that 1500 is kept for an exact 10 (a depth that only rounds
    to it is 1499 below 10 and 1501 above); a code outside 0..65534 is none (65535)."""
    v = Decimal(s)
    c = int(((v + 5) * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    if c == 1500 and v != 10:
        c = 1499 if v < 10 else 1501
    return c if 0 <= c <= 65534 else 65535


# ---------------------------------------------------------------------------------------------

def read_history():
    hj = load('history.json')
    with open(os.path.join(ASSETS, 'history.bin'), 'rb') as f:
        buf = f.read()
    return hj, buf


def check_sections(hj, buf):
    print('--- 4. history.bin sections')
    size = {'uint32': 4, 'uint16': 2, 'uint8': 1, 'utf8': 1}
    end, prev_end = 0, 0
    order = ['t', 'x', 'y', 'd', 'm', 'f', 'text_row', 'id_text', 'place_text']
    ok(list(hj['sections']) == order, f'sections in contract order: {list(hj["sections"])}')
    for k in order:
        s = hj['sections'][k]
        ok(s['offset'] % 4 == 0 and s['offset'] >= prev_end and s['offset'] - prev_end < 4,
           f'{k:10s} offset {s["offset"]:>9,} aligned, {s["offset"] - prev_end} pad bytes')
        prev_end = s['offset'] + s['count'] * size[s['type']]
    ok(prev_end == len(buf) == hj['bytes'], f'file ends at the last section: {len(buf):,} B = history.json bytes {hj["bytes"]:,}')


def cols(hj, buf):
    dt = {'uint32': '<u4', 'uint16': '<u2', 'uint8': 'u1'}
    s = hj['sections']
    c = {k: np.frombuffer(buf, dt[s[k]['type']], s[k]['count'], s[k]['offset']) for k in ('t', 'x', 'y', 'd', 'm', 'f', 'text_row')}
    txt = {k: buf[s[k]['offset']:s[k]['offset'] + s[k]['count']].decode('utf-8').split('\n') for k in ('id_text', 'place_text')}
    return c, txt


def read_csv_rows(manifest, cutoff):
    """Every cached row (all types), de-duplicated by id, first box wins; plus per-box stats."""
    seen, rows, drop, below = set(), [], Counter(), []
    cached_eq = Counter()
    era_rows = Counter()
    for region in REGIONS:
        for w in manifest['regions'][region]['windows']:
            if w['start'] >= cutoff:
                continue
            p = os.path.join(CACHE, w['cache'])
            with open(p, encoding='utf-8', newline='') as f:
                for r in csv.DictReader(f):
                    era_rows[(region, w['minmagnitude'])] += 1
                    if r['id'] in seen:
                        continue
                    seen.add(r['id'])
                    if r['type'] != 'earthquake':
                        drop[r['type']] += 1
                        continue
                    if w['minmagnitude'] is not None and (r['mag'] == '' or Decimal(r['mag']) < Decimal('2.5')):
                        below.append(r['id'])
                        continue
                    ms = ms_of(r['time'])
                    r['_ms'] = ms
                    r['_box'] = region
                    cached_eq[region] += 1
                    rows.append(r)
    rows.sort(key=lambda r: (r['_ms'], r['id']))
    return rows, drop, below, cached_eq, era_rows


def check_counts(hj, manifest, era_rows, offline):
    print('--- 1. counts against the USGS count endpoint (all event types, same box, era, floor; endtime = cutoff)')
    if offline:
        print('skip  --offline: the network count check was not run')
        return
    import requests
    base = manifest['service']
    s = requests.Session()
    s.headers['User-Agent'] = 'us-quakes-pipeline/1.0 (verify_static)'
    import time
    eras = [('1600-01-01', '1900-01-01', None), ('1900-01-01', hj['cutoff'], 2.5)]
    for region in REGIONS:
        box = manifest['regions'][region]['box']
        for a, b, mm in eras:
            p = dict(box, starttime=a, endtime=b, format='geojson')
            if mm is not None:
                p['minmagnitude'] = mm
            time.sleep(1)
            r = s.get(base + '/count', params=p, timeout=300)
            r.raise_for_status()
            n = r.json()['count']
            have = era_rows[(region, mm)]
            d = (have - n) / n * 100 if n else 0.0
            ok(abs(d) <= 0.5, f'{region:5s} {a[:4]}..{b[:4]} m{mm}: cached {have:,} vs USGS count {n:,} ({d:+.3f} %)')


def check_rows(hj, c, txt, rows, below):
    print('--- 3. every row against its CSV row')
    n = hj['count']
    ok(len(rows) == n == len(c['t']), f'rows: {n:,} in history.json, {len(c["t"]):,} in the file, {len(rows):,} from the CSVs')
    types = hj['magTypes']
    cutoff_min = (__import__('datetime').date.fromisoformat(hj['cutoff']).toordinal() - EPOCH) * 1440
    bad = Counter()
    worst = Counter()
    exact10 = recoded = 0
    t = c['t'].astype(np.int64)
    ok(bool(np.all(np.diff(t) >= 0)), 'time non-decreasing')
    ok(int(t.max()) < cutoff_min, f'every row before the cutoff {hj["cutoff"]} (last {int(t.max()):,} < {cutoff_min:,})')
    ok(int(c['x'].max()) <= 62000 and int(c['y'].max()) <= 55000, 'x ≤ 62000 and y ≤ 55000')
    for i, r in enumerate(rows):
        tm = int(c['t'][i])
        if not (tm * 60000 <= r['_ms'] < tm * 60000 + 60000):
            bad['t'] += 1
        lon = float(r['longitude'])
        lon = lon + 360 if lon < 172 else lon
        dl = abs(172 + int(c['x'][i]) * 0.002 - lon)
        worst['lon'] = max(worst['lon'], dl)
        if dl > 0.001 + 1e-9:
            bad['x'] += 1
        dla = abs(17 + int(c['y'][i]) * 0.001 - float(r['latitude']))
        worst['lat'] = max(worst['lat'], dla)
        if dla > 0.0005 + 1e-9:
            bad['y'] += 1
        d = int(c['d'][i])
        if r['depth'] == '':
            if d != 65535:
                bad['d'] += 1
        else:
            dd = abs(d / 100 - 5 - float(r['depth']))
            worst['depth'] = max(worst['depth'], dd)
            dv = Decimal(r['depth'])
            exact10 += dv == 10
            recoded += dv != 10 and int(((dv + 5) * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP)) == 1500
            # the exact code, and within 0.005 km, or under 0.01 km for a depth moved off 1500
            if d == 65535 or d != dcode(r['depth']) or dd > (0.01 if d in (1499, 1501) else 0.005 + 1e-9):
                bad['d'] += 1
        m = int(c['m'][i])
        if r['mag'] == '':
            if m != 255:
                bad['m'] += 1
        elif m != int(tenth(r['mag'])) + 20:
            bad['m'] += 1
        f = int(c['f'][i])
        st = {'reviewed': 0, 'automatic': 1, 'manual': 2}.get(r['status'], 3)
        mt = f >> 2
        if (f & 3) != st or (types[mt] if mt != 63 else '') != r['magType']:
            bad['f'] += 1
        if i and (rows[i - 1]['_ms'], rows[i - 1]['id']) >= (r['_ms'], r['id']):
            bad['order'] += 1
    ok(not bad, f'all {n:,} rows within bounds (failures {dict(bad) or 0}); worst |Δlon| {worst["lon"]:.6f}°, '
       f'|Δlat| {worst["lat"]:.6f}°, |Δdepth| {worst["depth"]:.4f} km; depth code, magnitude, status and type exact')
    n1500 = int((c['d'] == 1500).sum())
    ok(n1500 == exact10 == hj['counts']['depth10km'],
       f'depth code 1500 holds exactly the {exact10:,} rows the catalog lists at 10 km (history.json depth10km '
       f'{hj["counts"]["depth10km"]:,}; code 1500 in the file {n1500:,}); {recoded} depths that round to 10.00 km '
       f'written as 9.99 or 10.01')
    want = [i for i, r in enumerate(rows) if r['mag'] != '' and tenth(r['mag']) >= 45]
    ok(c['text_row'].tolist() == want, f'text table holds exactly the {len(want):,} rows at M4.5+ (decoded tenth)')
    ok(txt['id_text'] == [rows[i]['id'] for i in want] and txt['place_text'] == [rows[i]['place'] for i in want],
       'ids and places equal the CSV strings')
    print(f'info  dropped by the M2.5 floor from 1900 (magnitude below 2.5 in an M2.5+ answer): {below}')
    ref = json.load(open(os.path.join(APP, 'tools', 'ref', 'history_ref.json'), encoding='utf-8'))
    cols_ = ref['columns']
    agree = all(rows[e[1]][k] == e[2 + j] for e in ref['known'] for j, k in enumerate(cols_[1:])) and \
        all(rows[e[0]][k] == e[1 + j] for e in ref['rows'] for j, k in enumerate(cols_[1:]))
    rng = sorted(int(v) for v in np.random.default_rng(ref['seed']).choice(n, 1000, replace=False))
    ok(agree and [e[0] for e in ref['rows']] == rng and len(ref['rows']) == 1000,
       f'history_ref.json: 1 000 seeded rows (seed {ref["seed"]}) and {len(ref["known"])} known events equal the CSV strings')


def check_known(hj, c, txt):
    print('--- 2. the six known events')
    row = {e: int(r) for e, r in zip(txt['id_text'], c['text_row'])}
    for eid, (tm, la, lo, dep, mag, mt) in KNOWN.items():
        ok(eid in row, f'{eid} is in the text table')
        i = row[eid]
        t = int(c['t'][i])
        import datetime as dt
        day = dt.date.fromordinal(EPOCH + t // 1440).isoformat()
        iso = f'{day}T{t % 1440 // 60:02d}:{t % 60:02d}'
        lat = 17 + int(c['y'][i]) * 0.001
        lon = 172 + int(c['x'][i]) * 0.002 - 360
        d = int(c['d'][i])
        depth = None if d == 65535 else d / 100 - 5
        m = int(c['m'][i])
        f = int(c['f'][i])
        good = (iso == tm and abs(lat - la) <= 0.0005 + 1e-9 and abs(lon - lo) <= 0.001 + 1e-9
                and ((depth is None and dep is None) or (depth is not None and dep is not None and abs(depth - dep) <= 0.005 + 1e-9))
                and f'{(m - 20) / 10:.1f}' == mag and hj['magTypes'][f >> 2] == mt)
        extra = ''
        if eid == 'official19640328033616_30':
            good = good and (f & 3) == 1
            extra = f', status {hj["status"][f & 3]}'
        ok(good, f'{eid:30s} {iso} {lat:.3f} {lon:.3f} depth {"none" if depth is None else f"{depth:.2f}"} '
                 f'M{(m - 20) / 10:.1f} {hj["magTypes"][f >> 2]}{extra}')


def check_geo(c):
    print('--- 5. geo.json')
    g = load('geo.json')
    ax, bm = g['axis'], g['basemap']
    tol = 0.0005 + 1e-9

    def inside(pts, b=ax):
        return all(b['west'] - tol <= x <= b['east'] + tol and b['south'] - tol <= y <= b['north'] + tol for x, y in pts)
    ok(bm['west'] <= ax['west'] and bm['east'] >= ax['east'] and bm['south'] <= ax['south'] and bm['north'] >= ax['north'],
       f'the basemap ({bm["west"]}..{bm["east"]} on the axis, {bm["south"]}..{bm["north"]}°) holds the axis box '
       f'({ax["west"]}..{ax["east"]}, {ax["south"]}..{ax["north"]}°)')
    nv = 0
    for key in ('land', 'lakes', 'coast', 'borders', 'states'):
        poly = key in ('land', 'lakes')
        pts = [decode_line(s, g['polyline']['factor']) for s in g[key]]
        nv += sum(len(p) for p in pts)
        past = sum(1 for p in pts if not inside(p))
        ok(all(inside(p, bm) for p in pts) and (not poly or all(p[0] == p[-1] and len(p) >= 4 for p in pts)),
           f'{key:8s} {len(pts):>5,} pieces decode inside the basemap ({past:,} reach past the axis box)' + (' and close' if poly else ''))
    for band in g['bathymetry']:
        pts = [decode_line(s, 1000) for s in band['rings']]
        past = sum(1 for p in pts if not inside(p))
        ok(all(inside(p, bm) and p[0] == p[-1] for p in pts),
           f'bathymetry {band["depth"]:>5} m: {len(pts):>5,} rings inside the basemap ({past:,} past the axis box), closed')
    fa = g['faults']
    nf = 0
    good = len(fa['lines']) == len(fa['counts']) == len(fa['groups'])
    for s, cnt in zip(fa['lines'], fa['counts']):
        p = decode_line(s, fa['factor'])
        nf += len(p)
        good = good and len(p) == sum(cnt) and inside(p)
    ok(good, f'faults: {len(fa["groups"]):,} groups, {sum(len(c_) for c_ in fa["counts"]):,} lines, {nf:,} vertices; '
             'counts add up, all on the axis')
    tables = all(0 <= r[0] < len(fa['names']) and 0 <= r[1] < len(fa['sections']) and r[2] < len(fa['ages'])
                 and r[3] < len(fa['slipRates']) and r[4] < len(fa['senses']) and r[5] < len(fa['lineTypes'])
                 and r[6] < len(fa['classes']) for r in fa['groups'])
    ok(tables, 'every fault group indexes its label tables')
    ok(len(g['volcanoes']) == 148 and inside([(v['lon'], v['lat']) for v in g['volcanoes']]),
       f'{len(g["volcanoes"])} volcanoes inside the axis')
    ok(len(g['places']) > 0 and inside([(p['lon'], p['lat']) for p in g['places']]), f'{len(g["places"])} places inside the axis')
    rj = json.load(open(os.path.join(HERE, 'relief.json'), encoding='utf-8'))['regions']
    for r in g['relief']:
        m = rj[r['key']]
        p = os.path.join(ASSETS, r['file'])
        with Image.open(p) as im:
            size = im.size
            mode = im.mode
        same = all(r[k] == m[k] for k in ('west', 'east', 'south', 'north', 'width', 'height', 'neutral', 'lo'))
        ok(same and size == (r['width'], r['height']) and mode == 'L' and sha256_of(p) == m['sha256'],
           f'relief {r["key"]:5s} {size[0]}x{size[1]} {mode}, bounds W {r["west"]:.4f} E {r["east"]:.4f} '
           f'S {r["south"]:.4f} N {r["north"]:.4f} (the server\'s extents), sha256 as relief.json')
        gt = m['gate']
        ok(gt['passed'], f'relief {r["key"]:5s} registration gate (recorded): {gt["agreement"]:.4f} agreement with '
                         f'{gt["reference"]}, best shift {gt["best"]} px ({gt["bestKm"]} km)')
    for v in g['views']:
        ok(inside([(v['west'], v['south']), (v['east'], v['north'])]) and v['west'] < v['east'] and v['south'] < v['north'],
           f'view {v["key"]:18s} inside the axis')
    lon = 172.0 + c['x'].astype(np.float64) * 0.002
    lat = 17.0 + c['y'].astype(np.float64) * 0.001
    mm = c['m']
    R = 6371.0088
    P = np.stack([np.cos(np.radians(lat)) * np.cos(np.radians(lon)), np.cos(np.radians(lat)) * np.sin(np.radians(lon)),
                  np.sin(np.radians(lat))], -1)
    for s in g['sections']:
        ok(inside([tuple(s['a']), tuple(s['b'])]), f'preset {s["key"]:11s} inside the axis')
        A, B = (np.array([math.cos(math.radians(q[1])) * math.cos(math.radians(q[0])),
                          math.cos(math.radians(q[1])) * math.sin(math.radians(q[0])), math.sin(math.radians(q[1]))])
                for q in (s['a'], s['b']))
        n = np.cross(A, B)
        n /= np.linalg.norm(n)
        L = math.acos(float(np.clip(A @ B, -1, 1))) * R
        cross = np.arcsin(np.clip(P @ n, -1, 1)) * R
        # along-track by the angle from A of the point's projection onto the circle's plane
        pr = P - np.outer(P @ n, n)
        pr /= np.linalg.norm(pr, axis=1)[:, None]
        along = np.arctan2(np.cross(A, pr) @ n, pr @ A) * R
        k = (mm >= 45) & (mm != 255) & (np.abs(cross) <= 50) & (along >= 0) & (along <= L)
        ok(int(k.sum()) >= 300, f'preset {s["key"]:11s} {L:4.0f} km: {int(k.sum()):,} events within ±50 km at M2.5+ (≥ 300)')
    return g


def check_text(hj, c, txt, g):
    print('--- 6. about.json and stories.json')
    a = load('about.json')
    st = load('stories.json')
    nums = a['numbers']
    g_ = lambda n: format(n, ',').replace(',', ' ') if n >= 1000 else str(n)  # noqa: E731
    cnt = hj['counts']
    by = hj['dropped']['byType']
    checks = {'history': g_(hj['count']), 'before1900': g_(cnt['before1900']), 'noDepth': g_(cnt['noDepth']),
              'noMagnitude': g_(cnt['noMagnitude']), 'depth10km': g_(cnt['depth10km']),
              'nuclear': g_(by['nuclear explosion']), 'droppedOther': g_(sum(by.values())),
              'firstYear': hj['first'][:4], 'magTypeCount': str(len(hj['magTypes']))}
    for k, v in checks.items():
        ok(nums[k] == v, f'about number {k:14s} = {v} (from history.json)')
    ok(nums['noDepthBefore1900'] == g_(int(((c['d'] == 65535) & (c['t'] < (__import__('datetime').date(1900, 1, 1).toordinal() - EPOCH) * 1440)).sum())),
       f'about number noDepthBefore1900 = {nums["noDepthBefore1900"]} (from history.bin)')
    ok(a['intro'].startswith('This map is not an earthquake or tsunami warning service.'), 'About opens with the not-a-warning sentence')
    row = {e: int(r) for e, r in zip(txt['id_text'], c['text_row'])}
    views = {v['key'] for v in g['views']}
    for s in st['stories']:
        words = len(s['text'].split())
        found = all(e in row for e in s['anchors'])
        mags = [f'{(int(c["m"][row[e]]) - 20) / 10:.1f}' for e in s['anchors'] if e in row]
        used = '{' not in s['text'] and '}' not in s['text']
        mag_ok = all(m_ in s['text'] for m_ in mags)
        ok(found and words <= 70 and s['view'] in views and used and mag_ok,
           f'story {s["id"]:18s} {words} words, anchors {s["anchors"]} found, magnitudes {mags} in the text')


def check_budgets(g):
    print('--- 7. budgets and contents')
    names = sorted(os.listdir(ASSETS))
    ok(names == sorted(CLAIMED), f'assets/ holds exactly the contract\'s files: {names}')
    tot_raw = tot_zip = 0
    for n in CLAIMED:
        p = os.path.join(ASSETS, n)
        with open(p, 'rb') as f:
            b = f.read()
        z = zip_stored_size(b)
        tot_raw += len(b)
        tot_zip += z
        ok(len(b) <= RAW_CAPS[n], f'{n:17s} {len(b):>10,} B raw (cap {RAW_CAPS[n]:>10,}), {z:>10,} B as the ZIP stores it')
    ok(tot_zip <= ZIP_CAP, f'assets/ in all: {tot_raw:,} B raw, {tot_zip:,} B as the ZIP stores it (cap {ZIP_CAP:,}); '
                           f'headroom {ZIP_CAP - tot_zip:,} B')
    cp = os.path.join(APP, 'CREDITS.txt')
    ok(os.path.getsize(cp) <= 40_000, f'CREDITS.txt {os.path.getsize(cp):,} B (cap 40,000)')
    for n in ('history.json', 'geo.json'):
        s = open(os.path.join(ASSETS, n), encoding='utf-8').read()
        ok('http://' not in s and 'https://' not in s, f'{n}: no web address')
    texts = [os.path.join(ASSETS, n) for n in CLAIMED if n.endswith('.json')] + [cp]
    hits = [(os.path.basename(p), m.group(0)) for p in texts for m in VENDORS.finditer(open(p, encoding='utf-8').read())]
    ok(not hits, f'no AI vendor or product name in the shipped text ({hits or "none"})')
    for n in ('geo.json', 'stories.json', 'about.json', 'history.json'):
        s = open(os.path.join(ASSETS, n), encoding='utf-8').read()
        import unicodedata
        ok(unicodedata.normalize('NFC', s) == s, f'{n}: UTF-8 in NFC')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--offline', action='store_true')
    a = ap.parse_args()
    hj, buf = read_history()
    manifest = json.load(open(os.path.join(HERE, 'catalog-windows.json'), encoding='utf-8'))
    ok(sha256_of(os.path.join(HERE, 'catalog-windows.json')) == hj['provenance']['catalog-windows.json'],
       'history.json names the catalog-windows.json it was built from (sha256)')
    rows, drop, below, cached_eq, era_rows = read_csv_rows(manifest, hj['cutoff'])
    check_counts(hj, manifest, era_rows, a.offline)
    by_box = Counter(r['_box'] for r in rows)
    for k in REGIONS:
        ok(hj['counts']['byBox'][k] == by_box[k] == cached_eq[k],
           f'{k:5s} shipped {hj["counts"]["byBox"][k]:,} = cached earthquake rows {cached_eq[k]:,}')
    ok(dict(sorted(drop.items())) == hj['dropped']['byType'] and sorted(below) == hj['dropped']['belowFloor'],
       f'dropped by type as history.json says: {sum(drop.values()):,} rows of {len(drop)} other types; '
       f'{len(below)} below the floor')
    c, txt = cols(hj, buf)
    check_known(hj, c, txt)
    check_rows(hj, c, txt, rows, below)
    check_sections(hj, buf)
    g = check_geo(c)
    check_text(hj, c, txt, g)
    check_budgets(g)
    print('verify_static: all checks passed')


if __name__ == '__main__':
    main()
