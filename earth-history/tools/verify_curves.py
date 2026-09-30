"""Checks data/curves.json and tools/work/tiles.json (tools/CONTRACT.md §8, §1, §14) and prints
what it measured.

The sanity bounds below are wide on purpose: they catch a unit or column mistake (kelvin for
Celsius, ppb for ppm, feet for metres, a fraction for a percentage), not a scientific claim.
Spot values are re-read from the source spreadsheets and PaleoDEM grids here, not taken from step 40.

    .venv/bin/python verify_curves.py
"""
import json
import math
import os
import re

import numpy as np

from geo import paleodem_grids, paleodem_land_shelf, paleodem_z, source
from paths import DATA, WORK
from xlsx import read_workbook

N = 751
SANE = {'temperature_c': (5, 35), 'co2_ppm': (100, 5000), 'co2_model_ppm': (100, 5000),
        'sea_level_m': (-100, 300), 'land_pct': (10, 45), 'shelf_pct': (0, 20)}
COVER = {'temperature_c': 540, 'co2_ppm': 419, 'co2_model_ppm': 540, 'sea_level_m': 540,
         'land_pct': 540, 'shelf_pct': 540}


def main():
    raw = open(os.path.join(DATA, 'curves.json'), 'rb').read()
    txt = raw.decode('utf-8')
    assert not re.search(r'\bNaN\b|Infinity', txt), 'NaN or Infinity in curves.json'
    c = json.loads(txt)
    print(f'curves.json: {len(raw):,} bytes (cap 80,000)')
    assert len(raw) <= 80_000
    g = c['grid']
    assert (g['t0_ma'], g['dt_ma'], g['n']) == (0, 1, N)
    t = g['t0_ma'] + g['dt_ma'] * np.arange(g['n'])
    assert np.all(np.diff(t) > 0) and t[-1] == 750, 'grid not monotone 0..750'
    print('grid: 0..750 Ma by 1, strictly increasing, 751 points')

    S = c['series']
    assert sorted(S) == sorted(SANE), sorted(S)
    for k, s in S.items():
        arrays = {n: s[n] for n in ('values', 'lo68', 'hi68', 'min', 'max') if n in s}
        for n, arr in arrays.items():
            assert len(arr) == N, f'{k}.{n} has {len(arr)} values'
            for i, y in enumerate(arr):
                assert y is None or (isinstance(y, (int, float)) and math.isfinite(y)), (k, n, i, y)
            present = [i for i, y in enumerate(arr) if y is not None]
            assert present == list(range(COVER[k] + 1)), f'{k}.{n}: values at {present[0]}..{present[-1]}'
            lo, hi = SANE[k]
            vals = [arr[i] for i in present]
            assert lo <= min(vals) and max(vals) <= hi or n == 'lo68', f'{k}.{n} outside {SANE[k]}'
        v = s['values']
        present = [i for i in range(N) if v[i] is not None]
        mn = min(present, key=lambda i: v[i])
        mx = max(present, key=lambda i: v[i])
        print(f'{k:14s} {v[mn]:9.3f} at {mn:3d} Ma .. {v[mx]:9.3f} at {mx:3d} Ma; values 0..{COVER[k]} Ma, '
              f'null {COVER[k] + 1}..750 (source {s["source"]})')

    # CO2: band order, clip, the switch at 419/420, and today's value in the curve's own terms.
    co2 = S['co2_ppm']
    for i in range(420):
        assert 0 <= co2['lo68'][i] <= co2['values'][i] <= co2['hi68'][i], i
    assert co2['values'][419] is not None and co2['values'][420] is None
    assert co2['fit_to_ma'] == 419 and co2['lo68_clipped_ma'] == [] and co2['clipped_lo68_rows'] == 0
    assert S['co2_model_ppm']['values'][420] is not None
    info = read_workbook(source('phanda_info'))['Sheet1']
    model0 = [info[(r, 17)] for r in range(3, 112) if info[(r, 3)] == 0.0][0]
    f = read_workbook(source('foster2017_sd2'))['LOESS Fit']
    first = f[(3, 2)]
    print(f'CO2 at 0 Ma: {co2["values"][0]:.3f} ppm = Foster\'s first row ({f[(3, 1)]} Ma, {first:.4f}), '
          f'68 % band {co2["lo68"][0]:.1f}..{co2["hi68"][0]:.1f}; the climate model\'s 0 Ma input '
          f'{model0} ppm; difference {abs(co2["values"][0] - model0):.3f} ppm')
    assert abs(co2['values'][0] - first) < 5e-4 and abs(co2['values'][0] - model0) < 5.0
    assert co2['lo95_negative_rows'] == 124
    print(f'CO2 switch: fit to 419 Ma ({co2["values"][419]:.1f} ppm), null from 420; model input at 420: '
          f'{S["co2_model_ppm"]["values"][420]:.1f} ppm; lo68 clipped nowhere; lo95 negative in '
          f'{co2["lo95_negative_rows"]} rows, {co2["lo95_negative_from_ma"]}..{co2["lo95_negative_to_ma"]} Ma')
    # Spot: t = 66 from the sheet's two bracketing rows (65.5039 and 66.0039).
    rows = {f[(r, 1)]: f[(r, 2)] for r in range(3, 843)}
    a0, a1 = 65.5039, 66.0039
    want = rows[a0] + (66 - a0) / (a1 - a0) * (rows[a1] - rows[a0])
    assert abs(co2['values'][66] - want) < 5e-4, (co2['values'][66], want)
    print(f'spot: CO2 at 66 Ma {co2["values"][66]:.3f} ppm, from the sheet\'s rows {a0} and {a1}: {want:.3f}')

    # Sea level: 0 at 0 Ma; a row read straight from the sheet.
    sl = S['sea_level_m']
    assert sl['values'][0] == 0.0 and sl['min'][0] == 0.0 and sl['max'][0] == 0.0
    vm = read_workbook(source('vdm2022_table'))['SuppTable']
    r66 = [r for r in range(5, 546) if vm[(r, 1)] == 66.0][0]
    assert abs(sl['values'][66] - vm[(r66, 35)]) < 5e-4
    print(f'sea level: 0 m at 0 Ma; 66 Ma {sl["values"][66]:.3f} m = sheet row {r66} ({vm[(r66, 35)]:.4f}); '
          f'MIN > MAX at {sl["min_above_max_ma"]} Ma; AVG outside the band at {sl["avg_outside_band_ma"]} Ma')

    # Temperature at 0 = the climate model's 0 Ma slice; land/shelf re-derived from two grids.
    cl = json.load(open(os.path.join(DATA, 'climate.json'), encoding='utf-8'))
    assert abs(S['temperature_c']['values'][0] - cl['slices'][0]['global_mean_c']) < 5e-4
    assert abs(S['temperature_c']['values'][540] - cl['slices'][108]['global_mean_c']) < 5e-4
    grids = paleodem_grids()
    for age in (0.0, 250.0):
        land, shelf = paleodem_land_shelf(paleodem_z(grids[age][0]))
        assert abs(S['land_pct']['values'][int(age)] - land) < 5e-4
        assert abs(S['shelf_pct']['values'][int(age)] - shelf) < 5e-4
        print(f'PaleoDEM {int(age)} Ma ({grids[age][0].split("/")[-1]}): land {land:.3f} %, shelf {shelf:.3f} %')
    for i in range(541):
        assert S['land_pct']['values'][i] + S['shelf_pct']['values'][i] < 100

    # Tiles.
    tiles = json.load(open(os.path.join(WORK, 'tiles.json'), encoding='utf-8'))['maps']
    assert len(tiles) == 90 and [m['i'] for m in tiles] == list(range(90))
    kinds = {}
    for m in tiles:
        co = m['tiles']['co2']
        kinds[None if co is None else co['kind']] = kinds.get(None if co is None else co['kind'], 0) + 1
        if co and co['kind'] == 'proxy_fit':
            assert m['age_ma'] <= 419.5039 and co['lo68'] >= 0
        if m['tiles']['sea_level'] is None:
            assert m['age_ma'] > 540
    print(f'tiles: co2 kinds {kinds}')
    for mp in (1, 16, 49, 88):
        m = next(x for x in tiles if x['map'] == mp)
        print(f'  map {mp} ({m["age_ma"]} Ma): {json.dumps(m["tiles"], sort_keys=True)}')
    print('verify_curves: OK')


if __name__ == '__main__':
    main()
