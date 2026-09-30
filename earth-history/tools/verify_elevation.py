"""Checks data/elevation.bin + elevation.json (tools/CONTRACT.md §7 and §14) and prints what it measured.

Independent of 35_elevation.py where it matters: every shipped byte is re-derived from the raw NetCDF
grids with nodes found by their coordinate values (the file's own lat / lon arrays, not index
arithmetic) and classed with the ranges written in elevation.json's `codes` (z_min < z <= z_max),
not with numpy.digitize; land and shelf % are recomputed here on the 1-degree grid with the +180
column found by its longitude, and compared with elevation.json; and the shipped 2-degree grid's own
land and shelf % must come within 1.5 points of the 1-degree values for every slice.

    .venv/bin/python verify_elevation.py
"""
import io
import json
import os
import zipfile

import h5py
import numpy as np

from geo import DEM_EDGES, paleodem_grids, source
from paths import DATA, WORK

NS, NX, NY = 109, 180, 91
SB = NX * NY
TOL_2DEG = 1.5            # percentage points, CONTRACT §14
TOL_JSON = 1e-4           # elevation.json rounds to 4 decimals
COORD_TOL = 1e-6


def one(mask):
    idx = np.flatnonzero(mask)
    assert len(idx) == 1, f'{len(idx)} nodes match a coordinate'
    return int(idx[0])


def main():
    raw = open(os.path.join(DATA, 'elevation.bin'), 'rb').read()
    jtxt = open(os.path.join(DATA, 'elevation.json'), 'rb').read()
    meta = json.loads(jtxt)
    print(f'elevation.bin {len(raw):,} bytes; elevation.json {len(jtxt):,} bytes')
    assert len(raw) == NS * SB == 1_785_420, 'elevation.bin is not exactly 1,785,420 bytes'
    assert len(jtxt) <= 20_000, 'elevation.json over its 20,000-byte cap'
    assert meta['grid'] == {'nx': 180, 'ny': 91, 'lon0': -180, 'dlon': 2, 'lat0': 90, 'dlat': -2,
                            'order': 'row-major, north row first', 'at': 'nodes of the 1-degree grid'}
    assert meta['layout'] == '[slice][row][col]' and meta['slice_bytes'] == SB
    assert meta['count'] == NS and meta['nodata'] == 255 and meta['source'] == 'paleodem'
    assert [s['s'] for s in meta['slices']] == list(range(NS))
    assert [s['plate_age_ma'] for s in meta['slices']] == [5.0 * s for s in range(NS)]
    a = np.frombuffer(raw, dtype=np.uint8).reshape(NS, NY, NX)
    assert a.max() <= 9, f'a byte above 9 is present ({a.max()})'
    print('shape [109 slices][91 rows][180 cols]; plate ages 0..540 by 5; codes 0..9 only (no 255)')

    codes = meta['codes']
    assert [c['code'] for c in codes] == list(range(10))
    assert codes[0]['z_min'] is None and codes[9]['z_max'] is None
    for c in range(1, 10):
        assert codes[c]['z_min'] == codes[c - 1]['z_max'], f'codes {c - 1} and {c} do not meet'
    assert [c['z_max'] for c in codes[:9]] == DEM_EDGES == meta['edges_m']
    for c in codes:
        assert c['name_us'].startswith(c['name'] + ' (') and c['name_metric'].startswith(c['name'] + ' (')
    print('codes: ' + '; '.join(f"{c['code']} {c['name_metric']}" for c in codes))

    grids = paleodem_grids()
    z = zipfile.ZipFile(source('paleodem_1deg'))
    lat2 = 90.0 - 2.0 * np.arange(NY)
    lon2 = -180.0 + 2.0 * np.arange(NX)
    w2 = np.repeat(np.cos(np.radians(lat2))[:, None], NX, axis=1)
    w2 /= w2.sum()
    worst_json = worst_2 = 0.0
    mismatched = 0
    print(f'{"age":>5} {"file":42s} {"land 1°":>8} {"land 2°":>8} {"shelf 1°":>8} {"shelf 2°":>8}')
    for s, sl in enumerate(meta['slices']):
        member = grids[sl['plate_age_ma']][0]
        assert member.rsplit('/', 1)[-1] == sl['file'], (member, sl['file'])
        with h5py.File(io.BytesIO(z.read(member)), 'r') as h:
            lat = h['lat'][:]
            lon = h['lon'][:]
            zz = h['z'][:].astype(np.float64)
        # Find every shipped node by its coordinates in the file.
        # The files' float64 coordinates sit within ~2e-11 of whole degrees, so match within 1e-6.
        ri = np.array([one(np.abs(lat - v) < COORD_TOL) for v in lat2])
        ci = np.array([one(np.abs(lon - v) < COORD_TOL) for v in lon2])
        zs = zz[np.ix_(ri, ci)]
        want = np.full(zs.shape, 255, dtype=np.int64)
        for c in codes:
            m = np.ones(zs.shape, dtype=bool)
            if c['z_min'] is not None:
                m &= zs > c['z_min']
            if c['z_max'] is not None:
                m &= zs <= c['z_max']
            assert (want[m] == 255).all(), 'classes overlap'
            want[m] = c['code']
        assert (want != 255).all(), 'a node fell in no class'
        mismatched += int((want != a[s]).sum())
        # 1-degree land and shelf, the +180 column found by its longitude and dropped.
        keep = np.abs(lon - 180.0) >= COORD_TOL
        assert keep.sum() == 360
        z1 = zz[:, keep]
        w1 = np.repeat(np.cos(np.radians(lat))[:, None], 360, axis=1)
        w1 /= w1.sum()
        land1 = float(w1[z1 > 0].sum() * 100)
        shelf1 = float(w1[(z1 > -200) & (z1 <= 0)].sum() * 100)
        worst_json = max(worst_json, abs(land1 - sl['land_pct']), abs(shelf1 - sl['shelf_pct']))
        land2 = float(w2[a[s] >= 5].sum() * 100)
        shelf2 = float(w2[(a[s] == 3) | (a[s] == 4)].sum() * 100)
        worst_2 = max(worst_2, abs(land2 - sl['land_pct']), abs(shelf2 - sl['shelf_pct']))
        print(f'{sl["plate_age_ma"]:5.0f} {sl["file"][:42]:42s} {sl["land_pct"]:8.3f} {land2:8.3f} '
              f'{sl["shelf_pct"]:8.3f} {shelf2:8.3f}')
    assert mismatched == 0, f'{mismatched} shipped bytes differ from the raw grids'
    assert worst_json <= TOL_JSON, f'elevation.json land/shelf off the 1-degree recomputation by {worst_json}'
    assert worst_2 <= TOL_2DEG, f'the 2-degree grid disagrees with the 1-degree % by {worst_2:.3f} points'
    print(f'every shipped byte ({NS * SB:,}) equals the class of its raw node, found by coordinates')
    print(f'land/shelf %: elevation.json within {worst_json:.6f} of an independent 1-degree recomputation; '
          f'the shipped 2-degree grid within {worst_2:.3f} points (limit {TOL_2DEG})')

    em = json.load(open(os.path.join(WORK, 'elevation.json'), encoding='utf-8'))['maps']
    cm = json.load(open(os.path.join(WORK, 'climate.json'), encoding='utf-8'))['maps']
    assert len(em) == len(cm) == 90
    for e, c in zip(em, cm):
        assert e['map'] == c['map'] and e['elevation'] == c['climate'] and \
            e['elevation_age_ma'] == c['climate_age_ma'], (e, c)
    none = [e['map'] for e in em if e['elevation'] is None]
    print(f'map match: equal to the climate match for all 90 maps; none for maps {none}')
    print('verify_elevation: OK')


if __name__ == '__main__':
    main()
