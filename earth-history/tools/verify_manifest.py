"""Checks data/manifest.json (tools/CONTRACT.md §1 and §18) and prints what it measured.

Independent of 80_manifest.py where it matters: the ICS units are found again from data/timescale.json
by the containment rule (not copied from work/ics_slices.json); the climate and elevation matches are
recomputed from data/climate.json and data/elevation.json; the CO2 and sea-level tiles are
re-interpolated from the pinned spreadsheets themselves (Foster SD2, van der Meer mmc1); the
temperature and land tiles are compared with climate.json and elevation.json.

    .venv/bin/python verify_manifest.py
"""
import json
import os

import numpy as np

from geo import read_slices, source
from paths import DATA
from xlsx import read_workbook

CAP = 60_000
MATCH_MYR = 2.5
TOP = ['axis', 'count', 'proxy', 'retrieved', 'schema', 'slices', 'surface', 'tile_rules', 'units']
SLICE = ['age_ma', 'climate', 'climate_age_ma', 'elevation', 'elevation_age_ma', 'file', 'file_age_ma',
         'i', 'ics', 'ics_note', 'interval', 'label', 'map', 'rotation_ma', 'stage', 'tiles']
TILES = {'temperature': ['c'], 'co2': ['hi68', 'kind', 'lo68', 'ppm'], 'sea_level': ['m', 'max_m', 'min_m'],
         'land': ['land_pct', 'shelf_pct']}
RANKS = {'eon': 'Eon', 'era': 'Era', 'period': 'Period', 'subperiod': 'Sub-Period', 'epoch': 'Epoch',
         'age': 'Age'}
# CONTRACT §1, measured by step 50 and pinned here.
BOUNDARY_MAPS = [14, 16, 32, 43, 49, 65, 83, 88]
PERIOD_MAPS = [61, 73, 93]


def load(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


def contains(u, a):
    return (u['end_ma'] < a <= u['begin_ma']) or (a == 0 and u['end_ma'] == 0)


def near(pa, age):
    d = np.abs(np.asarray(pa) - age)
    j = int(np.argmin(d))
    return (j, float(pa[j])) if d[j] <= MATCH_MYR else (None, None)


def main():
    txt = open(os.path.join(DATA, 'manifest.json'), 'rb').read()
    m = json.loads(txt)
    print(f'manifest.json {len(txt):,} bytes (budget {CAP:,})')
    assert len(txt) <= CAP
    assert sorted(m) == TOP, sorted(m)
    assert m['schema'] == 1 and m['count'] == 90 and m['retrieved'] == '2026-09-30'
    rows = read_slices()
    sl = m['slices']
    assert len(sl) == 90
    for i, (s, r) in enumerate(zip(sl, rows)):
        assert sorted(s) == SLICE, (i, sorted(s))
        assert s['i'] == i and s['map'] == r['map'] and s['age_ma'] == r['age_ma']
        assert s['file'] == f'surface/m{r["map"]:02d}.webp' and os.path.isfile(os.path.join(DATA, s['file']))
        assert s['label'] == r['table1_row']
    ages = [s['age_ma'] for s in sl]
    assert ages == sorted(ages) and ages[0] == 0 and ages[-1] == 750
    print('90 slices, ascending age 0..750 Ma, every map file present, Table 1 labels as in slices.csv')

    # ICS: found again from timescale.json.
    ts = load('timescale.json')
    units = {u['id']: u for u in ts['units']}
    for s in sl:
        a = s['age_ma']
        for key, rank in RANKS.items():
            hits = [u['id'] for u in ts['units'] if (u['rank'] == rank or rank in u.get('also_rank', []))
                    and contains(u, a)]
            assert len(hits) <= 1, (s['map'], rank, hits)
            want = hits[0] if hits else None
            assert s['ics'][key] == want, (s['map'], key, s['ics'][key], want)
        assert s['ics']['colour'] == units[s['ics']['period']]['colour']
        if s['ics']['subperiod'] is not None:
            assert s['ics']['period'] == 'Carboniferous'
    notes = {s['map']: s['ics_note'] for s in sl if s['ics_note']}
    b = sorted(k for k, v in notes.items() if v['kind'] == 'boundary')
    p = sorted(k for k, v in notes.items() if v['kind'] == 'period')
    assert b == BOUNDARY_MAPS and p == PERIOD_MAPS, (b, p)
    for mp, v in notes.items():
        s = next(x for x in sl if x['map'] == mp)
        assert v['scotese_ma'] == s['age_ma'] and v['unit'] in units and v['text']
        if v['kind'] == 'boundary':
            assert v['ics_ma'] == units[v['unit']]['begin_ma'] and v['ics_unc_ma'] == units[v['unit']]['begin_unc_ma']
            assert abs(v['ics_ma'] - s['age_ma']) >= 0.05
        else:
            assert v['ics_ma'] is None and v['ics_unc_ma'] is None
    print(f'ics: every unit re-found in timescale.json by "end < a <= begin"; colours are the period\'s; '
          f'boundary notes on maps {b}, period notes on {p}')

    # Climate and elevation matches.
    cl, el = load('climate.json'), load('elevation.json')
    cpa = [x['plate_age_ma'] for x in cl['slices']]
    epa = [x['plate_age_ma'] for x in el['slices']]
    moved = []
    for s in sl:
        assert (s['climate'], s['climate_age_ma']) == near(cpa, s['file_age_ma'])
        assert (s['elevation'], s['elevation_age_ma']) == near(epa, s['file_age_ma'])
        if s['climate'] is not None and s['climate_age_ma'] != s['file_age_ma']:
            moved.append((s['map'], s['file_age_ma'], s['climate_age_ma']))
    none = [s['map'] for s in sl if s['climate'] is None]
    print(f'climate/elevation match recomputed: nearest-not-exact {moved}; none for maps {none}')

    # Tiles.
    u = m['units']
    assert u['today_temperature_c'] == round(cl['slices'][0]['global_mean_c'], 2)
    assert u['today_land_pct'] == round(el['slices'][0]['land_pct'], 2)
    assert u['today_shelf_pct'] == round(el['slices'][0]['shelf_pct'], 2)
    assert u['today_co2_model_ppm'] == cl['slices'][0]['co2_ppm']
    fo = read_workbook(source('foster2017_sd2'))['LOESS Fit']
    F = np.array([[fo[(r, c)] for c in (1, 2, 4, 5)] for r in range(3, 843)], dtype=np.float64)
    assert F[0, 0] == 0.0039 and F[-1, 0] == 419.5039
    assert u['today_co2_fit_ppm'] == round(F[0, 1], 1)
    assert m['tile_rules']['co2']['source'] == {'proxy_fit': 'foster2017', 'model_input': 'phanda'}
    vm = read_workbook(source('vdm2022_table'))['SuppTable']
    V = np.array([[vm[(r, c)] for c in (1, 35, 36, 37)] for r in range(5, 546)], dtype=np.float64)
    assert np.array_equal(V[:, 0], np.arange(541))
    worst = {'co2': 0.0, 'sea': 0.0}
    for s in sl:
        t = s['tiles']
        assert sorted(t) == sorted(TILES)
        for k, keys in TILES.items():
            assert t[k] is None or sorted(t[k]) == keys, (s['map'], k, t[k])
        a = s['age_ma']
        if s['climate'] is None:
            assert t['temperature'] is None and t['land'] is None
        else:
            assert t['temperature']['c'] == round(cl['slices'][s['climate']]['global_mean_c'], 2)
            ev = el['slices'][s['elevation']]
            assert t['land'] == {'land_pct': round(ev['land_pct'], 2), 'shelf_pct': round(ev['shelf_pct'], 2)}
        co = t['co2']
        if a <= F[-1, 0]:
            aa = max(a, F[0, 0])
            want = [float(np.interp(aa, F[:, 0], F[:, j])) for j in (1, 2, 3)]
            got = [co['ppm'], co['lo68'], co['hi68']]
            assert co['kind'] == 'proxy_fit'
            worst['co2'] = max(worst['co2'], max(abs(x - y) for x, y in zip(got, want)))
        elif s['climate'] is not None:
            assert co == {'hi68': None, 'kind': 'model_input', 'lo68': None,
                          'ppm': round(cl['slices'][s['climate']]['co2_ppm'], 1)}
        else:
            assert co is None
        if a <= 540:
            want = [float(np.interp(a, V[:, 0], V[:, j])) for j in (1, 2, 3)]
            got = [t['sea_level']['m'], t['sea_level']['min_m'], t['sea_level']['max_m']]
            worst['sea'] = max(worst['sea'], max(abs(x - y) for x, y in zip(got, want)))
        else:
            assert t['sea_level'] is None
    assert worst['co2'] <= 0.05 + 1e-9 and worst['sea'] <= 0.05 + 1e-9, worst
    print(f'tiles: CO2 within {worst["co2"]:.4f} ppm of Foster\'s sheet re-interpolated, sea level within '
          f'{worst["sea"]:.4f} m of van der Meer\'s sheet (both rounded to 0.1); temperature and land '
          'equal climate.json / elevation.json rounded to 2 decimals')
    print(f'units: {u}')
    for mp in (1, 16, 49, 88, 93):
        s = next(x for x in sl if x['map'] == mp)
        print(f'  map {mp} ({s["age_ma"]} Ma): {json.dumps(s["tiles"], sort_keys=True)}')
    print('verify_manifest: OK')


if __name__ == '__main__':
    main()
