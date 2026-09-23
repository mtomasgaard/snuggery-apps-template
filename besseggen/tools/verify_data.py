#!/usr/bin/env python3
"""Check that data/ really has the properties the app is entitled to assume, by decoding it
exactly the way the app will. A failure here is a failure of the contract, not of the data.

Run it after every build; build_all.sh does. It needs the cached masters, because check 2 compares
the shipped tiles against the grids they were decimated from.
"""
from __future__ import annotations
import json
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geom
from paths import DATA, DTM, WORK

M = json.load(open(os.path.join(DATA, 'manifest.json'), encoding='utf-8'))
S = M['tile']['samples']
C = M['tile']['cells']
fails = []


def check(name, cond, detail=''):
    print(('  ok   ' if cond else '  FAIL ') + name + (('  — ' + detail) if detail else ''))
    if not cond:
        fails.append(name)


blobs = {lv['level']: np.fromfile(os.path.join(DATA, lv['file']), dtype='<u2')
         for lv in M['levels']}


def tile_dm(lv, e):
    return geom.decode_tile(blobs[lv['level']], e)


def idx(lv):
    return {(e['tx'], e['ty']): e for e in lv['tiles']}


def level(n):
    return [l for l in M['levels'] if l['level'] == n][0]


print('1. every level file is exactly its tiles, in order')
for lv in M['levels']:
    n = len(lv['tiles'])
    b = os.path.getsize(os.path.join(DATA, lv['file']))
    check(f"L{lv['level']}: {n} tiles x {M['tile']['bytes']} B == {b} B on disk",
          b == lv['bytes'] == n * M['tile']['bytes'])
    offs = [e['o'] for e in lv['tiles']]
    check(f"L{lv['level']}: offsets contiguous, aligned and ascending",
          offs == list(range(0, n * M['tile']['bytes'], M['tile']['bytes'])))

print('2. decoding a tile gives back the decimated grid, to the decimetre')
ny, nx = geom.MASTER_SHAPE
grids = {5: np.memmap(os.path.join(DTM, f'core_2m_{nx}x{ny}_u16dm.raw'),
                      dtype=np.uint16, mode='r', shape=(ny, nx)),
         4: np.memmap(os.path.join(WORK, 'core_L4_4m.raw'), dtype=np.uint16, mode='r',
                      shape=geom.grid_shape(geom.CORE, 4)),
         2: np.load(os.path.join(WORK, 'core_L2_16m.npy')),
         0: np.load(os.path.join(WORK, 'shell_L0_64m.npy'))}
worst = 0
for n, g in grids.items():
    lv = level(n)
    box = geom.SHELL if lv['region'] == 'shell' else geom.CORE
    nyt = (box['y1'] - box['y0']) // lv['tileSpan']
    for e in lv['tiles'][:: max(1, len(lv['tiles']) // 20)]:
        r0 = nyt * C - (e['ty'] * C + C)
        c0 = e['tx'] * C
        ref = np.asarray(g[r0:r0 + S, c0:c0 + S], dtype=np.int64)
        worst = max(worst, int(np.abs(tile_dm(lv, e) - ref).max()))
check('sampled tiles at L0, L2, L4 and L5 decode to the grid exactly', worst == 0,
      f'max |diff| = {worst} dm')

print('3. neighbouring tiles at the same level share bit-identical edges')
bad = []
for lv in M['levels']:
    ix = idx(lv)
    for (tx, ty), e in ix.items():
        a = tile_dm(lv, e)
        r = ix.get((tx + 1, ty))
        if r is not None and not np.array_equal(a[:, -1], tile_dm(lv, r)[:, 0]):
            bad.append(('E', lv['level'], tx, ty))
        n = ix.get((tx, ty + 1))                      # ty counts north
        if n is not None and not np.array_equal(a[0, :], tile_dm(lv, n)[-1, :]):
            bad.append(('N', lv['level'], tx, ty))
check('every shared edge matches exactly', not bad, str(bad[:4]))

print('4. the quadtree is complete: every tile has its parent')
for lv in M['levels']:
    if lv['level'] <= 1:
        continue
    par = idx(level(lv['level'] - 1))
    miss = [(e['tx'], e['ty']) for e in lv['tiles'] if (e['tx'] // 2, e['ty'] // 2) not in par]
    check(f"L{lv['level']}: every tile's parent exists at L{lv['level']-1}", not miss,
          str(miss[:4]))

print('5. the shell equals the core inside the core box')
l0 = level(0)
core64 = np.load(os.path.join(WORK, 'core64.npy'))
worst0 = 0
seen = 0
for e in l0['tiles']:
    x0 = l0['grid']['x0'] + e['tx'] * l0['tileSpan']
    y0 = l0['grid']['y0'] + e['ty'] * l0['tileSpan']
    if not (geom.CORE['x0'] <= x0 and x0 + l0['tileSpan'] <= geom.CORE['x1']
            and geom.CORE['y0'] <= y0 and y0 + l0['tileSpan'] <= geom.CORE['y1']):
        continue
    seen += 1
    cr0 = (geom.CORE['y1'] - (y0 + l0['tileSpan'])) // 64
    cc0 = (x0 - geom.CORE['x0']) // 64
    worst0 = max(worst0, int(np.abs(tile_dm(l0, e)
                                    - core64[cr0:cr0 + S, cc0:cc0 + S].astype(np.int64)).max()))
check('L0 tiles wholly inside the core equal the core decimated to 64 m', worst0 == 0,
      f'{seen} tiles, max {worst0} dm')

print('6. the elevation range and the UTM checkpoints')
lo = min(e['dmin'] for l in M['levels'] for e in l['tiles']) / 10.0
hi = max(e['dmax'] for l in M['levels'] for e in l['tiles']) / 10.0
check('manifest elevation range matches the tiles',
      abs(lo - M['elevation']['minM']) < 0.05 and abs(hi - M['elevation']['maxM']) < 0.05,
      f'{lo}..{hi} m')
clo = min(e['dmin'] for l in M['levels'] if l['level'] >= 1 for e in l['tiles']) / 10.0
chi = max(e['dmax'] for l in M['levels'] if l['level'] >= 1 for e in l['tiles']) / 10.0
check('manifest core elevation range matches the core tiles',
      abs(clo - M['elevation']['core']['minM']) < 0.05
      and abs(chi - M['elevation']['core']['maxM']) < 0.05, f'{clo}..{chi} m')


def utm_to_wgs84(x, y, w):
    """The app's own inverse, transcribed, so the manifest's checkpoints are checked against the
    same 30 lines the app ships rather than against pyproj twice."""
    a = w['ellipsoid']['a']
    f = 1.0 / w['ellipsoid']['invF']
    n = f / (2 - f)
    k0 = w['k0']
    A = a / (1 + n) * (1 + n**2 / 4 + n**4 / 64)
    b = [n/2 - 2*n**2/3 + 37*n**3/96 - n**4/360,
         n**2/48 + n**3/15 - 437*n**4/1440,
         17*n**3/480 - 37*n**4/840,
         4397*n**4/161280]
    d = [2*n - 2*n**2/3 - 2*n**3, 7*n**2/3 - 8*n**3/5, 56*n**3/15, 4279*n**4/630]
    xi = (y - w['falseNorthing']) / (k0 * A)
    eta = (x - w['falseEasting']) / (k0 * A)
    xip, etap = xi, eta
    for j in range(1, 5):
        xip -= b[j-1] * math.sin(2*j*xi) * math.cosh(2*j*eta)
        etap -= b[j-1] * math.cos(2*j*xi) * math.sinh(2*j*eta)
    chi = math.asin(math.sin(xip) / math.cosh(etap))
    lat = chi
    for j in range(1, 5):
        lat += d[j-1] * math.sin(2*j*chi)
    lon0 = math.radians(6 * w['zone'] - 183)
    return math.degrees(lon0 + math.atan2(math.sinh(etap), math.cos(xip))), math.degrees(lat)


w = M['wgs84']
worstm = 0.0
for cp in w['checkpoints']:
    lon, lat = utm_to_wgs84(cp['x'], cp['y'], w)
    worstm = max(worstm, math.hypot((lon - cp['lon']) * 111320 * math.cos(math.radians(lat)),
                                    (lat - cp['lat']) * 110570))
check('the app\'s own UTM inverse reproduces every checkpoint', worstm < 0.05,
      f'worst {worstm*1000:.1f} mm')

print('7. the GeoJSON layers')
for n in ('route.geojson', 'places.geojson', 'water.geojson', 'glaciers.geojson',
          'rivers.geojson'):
    g = json.load(open(os.path.join(DATA, n), encoding='utf-8'))
    check(f'{n}: FeatureCollection in EPSG:25833 with a bbox and features',
          g['type'] == 'FeatureCollection' and '25833' in g['crs']['properties']['name']
          and len(g['bbox']) == 4 and len(g['features']) > 0,
          f"{len(g['features'])} features")
R = json.load(open(os.path.join(DATA, 'route.geojson'), encoding='utf-8'))
main = [f for f in R['features'] if f['properties'].get('role') == 'main'][0]
p = main['properties']
co = main['geometry']['coordinates']
check('route: cumM, kmMarks and waypoints all index the geometry',
      len(p['cumM']) == len(co)
      and all(0 <= k['i'] < len(co) for k in p['kmMarks'])
      and all(0 <= k['i'] < len(co) for k in p['waypoints'])
      and p['highPoint']['i'] == max(range(len(co)), key=lambda i: co[i][2]))
chord = sum(math.dist(co[i][:2], co[i+1][:2]) for i in range(len(co)-1))
check('route: lengthM is the along-path distance of the last sample',
      abs(p['lengthM'] - p['cumM'][-1]) < 0.05)
check('route: cumM steps by the stated sample interval',
      all(abs((p['cumM'][i+1] - p['cumM'][i]) - p['sampleStepM']) < 0.05
          for i in range(len(co) - 1)),
      f"{p['sampleStepM']:g} m")
# the chain through the samples is shorter than the path it was resampled from, because a chord
# cuts the corner an arc goes round; that is expected, and it is why cumM is shipped
check('route: the sampled chain is a little shorter than the path, never longer',
      chord <= p['lengthM'] <= p['pathLengthM'] and p['lengthM'] - chord < 0.03 * p['lengthM'],
      f"chords {chord:.1f} m, cumM {p['lengthM']} m, path {p['pathLengthM']} m")
dz = [co[i+1][2] - co[i][2] for i in range(len(co)-1)]
check('route: the stated ascent and descent match the geometry',
      abs(p['ascentM'] - sum(v for v in dz if v > 0)) < 1.0
      and abs(p['descentM'] + sum(v for v in dz if v < 0)) < 1.0,
      f"{p['ascentM']} m up, {p['descentM']} m down")
box = geom.CORE
check('route: every vertex is inside the core box',
      all(box['x0'] <= c[0] <= box['x1'] and box['y0'] <= c[1] <= box['y1']
          for f in R['features'] for c in f['geometry']['coordinates']))

print('8. the editable files')
ed = {}
for n in ('waypoints.json', 'viewpoints.json', 'pace.json', 'colors.json', 'about.json'):
    ed[n] = json.load(open(os.path.join(DATA, n), encoding='utf-8'))
check('all five parse as JSON', True)
# NOTES/OWNER-DECISIONS.md, 2026-09-22: no boat timetable ships, anywhere
stray = [f for f in os.listdir(DATA) if 'boat' in f.lower() or 'ferry' in f.lower()]
check('no timetable file ships', not stray, str(stray))
boat = ed['about.json'].get('boat', '')
check('about.json mentions the boat in one sentence, with no times and no link',
      bool(boat) and not re.search(r'\d{1,2}[:.]\d{2}', boat) and 'http' not in boat,
      boat[:60] + '...')
anchors = {tuple(a) for a in M['corridor']['anchors']}
vp = {(v['x'], v['y']) for v in ed['viewpoints.json']['viewpoints'] if v.get('anchor')}
check('every corridor anchor is a saved viewpoint at the same coordinates', anchors == vp,
      f'{len(anchors)} anchors, {len(vp)} anchored viewpoints')
# An anchor named after a waypoint is where a saved camera stands, and the app's marker for that
# waypoint is on the route. If the two are not the same place, the viewpoint's name is a lie.
wp_xy = {w['id']: co[w['i']][:2] for w in p['waypoints']}
far = []
for ai, wid in geom.ANCHOR_WAYPOINT.items():
    ax, ay = M['corridor']['anchors'][ai]
    wx, wy = wp_xy[wid]
    d = math.dist((ax, ay), (wx, wy))
    if d > geom.ANCHOR_NEAR_M:
        far.append(f'{wid} {d:.0f} m')
check(f"every anchor named for a waypoint is within {geom.ANCHOR_NEAR_M:.0f} m of it", not far,
      ', '.join(far) or ', '.join(
          f"{wid} {math.dist(tuple(M['corridor']['anchors'][ai]), tuple(wp_xy[wid])):.0f} m"
          for ai, wid in geom.ANCHOR_WAYPOINT.items()))
wpi = {w['id'] for w in ed['waypoints.json']['waypoints']}
check('every route waypoint index has an entry in waypoints.json',
      {w['id'] for w in p['waypoints']} == wpi, str(sorted(wpi)))
check('colors.json carries a light and a dark palette and elevation bands',
      set(ed['colors.json']['light']) == set(ed['colors.json']['dark'])
      and len(ed['colors.json']['elevationBands']) > 0)
na = ed['about.json']['notNavigation']
check('about.json carries the "this is not a navigation tool" sentence',
      len(na) > 80 and 'planning tool' in na and 'no position fix' in na)
check('about.json names a source, a licence and a date for each dataset',
      all(all(k in ed['about.json'][d] for k in ('name', 'licence', 'retrieved'))
          for d in ('terrain', 'trails', 'mapData', 'placeNames')))

print('9. the budget')
files = sorted(os.listdir(DATA))
tot = sum(os.path.getsize(os.path.join(DATA, f)) for f in files)
tri = 2 * C * C + 8 * C
check(f'data/ is {tot:,} B ({tot/2**20:.2f} MiB) in {len(files)} files', tot < 60 * 2**20)
check(f'{tri} triangles per tile, so a 160-tile cap draws {160*tri/1e6:.2f} M',
      160 * tri < 1_500_000)

print()
print('FAILED: ' + ', '.join(fails) if fails else 'ALL CHECKS PASSED')
sys.exit(1 if fails else 0)
