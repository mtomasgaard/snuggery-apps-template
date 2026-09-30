"""Checks data/climate.bin + climate.json (tools/CONTRACT.md §6 and §14) and prints what it measured.

Independent of 30_climate.py where it matters: the spot check re-reads the raw NetCDFs through
PhanDA's *own* float64 copy of each field (`tas` / `pr`, stored lon-major on longitudes -180..176.25)
and finds every node by its coordinate values, so an orientation, roll or layout mistake in step 30
cannot cancel out here. PhanDA's `pr` copy is in mm per 365-day year (the UM rate x 31,536,000, a
ratio measured at every node), so it is divided by 365 here; step 30 multiplies the UM rate by
86,400. The ExperimentInfo.xlsx facts are read again from the sheet.

The 0 Ma global mean is compared with the design stage's measurement of the same model slice
(tools/DECISIONS.md §15 E3: 14.74 C, 2.961 mm/day), not with observations: it is a climate model's
pre-industrial run (CO2 276.01 ppm), and this check proves the pipeline reproduces that model.

    .venv/bin/python verify_climate.py
"""
import io
import json
import os
import zipfile

import h5py
import numpy as np

from geo import source
from paths import DATA, WORK
from xlsx import read_workbook

NX, NY, NS = 96, 73, 109
SB = NX * NY
MODEL_0MA_C, MODEL_0MA_RAIN = 14.74, 2.961          # DECISIONS.md §15 E3 (design stage, same model)
TOL_C, TOL_RAIN = 0.05, 0.005
BAND_C, BAND_RAIN = (14.0, 15.5), (2.5, 3.5)       # CONTRACT §14


def decode(b, f):
    b = b.astype(np.float64)
    return f['offset'] + f['step'] * (b if f['power'] == 1 else b * b)


def main():
    raw = open(os.path.join(DATA, 'climate.bin'), 'rb').read()
    jtxt = open(os.path.join(DATA, 'climate.json'), 'rb').read()
    meta = json.loads(jtxt)
    print(f'climate.bin {len(raw):,} bytes; climate.json {len(jtxt):,} bytes')
    assert len(raw) == 2 * NS * SB == 1_527_744, 'climate.bin is not exactly 1,527,744 bytes'
    assert len(jtxt) <= 30_000, 'climate.json over its 30,000-byte cap'
    assert meta['count'] == NS and len(meta['slices']) == NS and meta['slice_bytes'] == SB
    assert meta['grid'] == {'nx': 96, 'ny': 73, 'lon0': 0, 'dlon': 3.75, 'lat0': 90, 'dlat': -2.5,
                            'order': 'row-major, north row first, eastward columns', 'at': 'nodes'}
    assert [s['s'] for s in meta['slices']] == list(range(NS))
    assert [s['plate_age_ma'] for s in meta['slices']] == [5.0 * s for s in range(NS)]
    a = np.frombuffer(raw, dtype=np.uint8).reshape(2, NS, NY, NX)
    assert not (a == 255).any(), 'a no-data byte (255) is present'
    print('shape [2 fields][109 slices][73 rows][96 cols]; plate ages 0..540 by 5; no 255 byte')

    # Weights, as the contract defines them.
    lat = 90.0 - 2.5 * np.arange(NY)
    wr = np.sin(np.radians(np.minimum(90, lat + 1.25))) - np.sin(np.radians(np.maximum(-90, lat - 1.25)))
    w = np.repeat(wr[:, None], NX, axis=1)
    w /= w.sum()

    fields = meta['fields']
    assert [f['key'] for f in fields] == ['temperature', 'rain']
    err = meta['max_encoding_error']
    tol = {'temperature': err['temperature_c'], 'rain': err['rain_mm_day']}
    for fi, f in enumerate(fields):
        b = a[fi]
        assert b.min() == f['bytes_used'][0] and b.max() == f['bytes_used'][1]
        v = decode(b, f)
        rk = 'range_c' if f['key'] == 'temperature' else 'range_rain_mm_day'
        gk = 'global_mean_c' if f['key'] == 'temperature' else 'global_mean_rain_mm_day'
        worst_r = worst_g = 0.0
        for s in range(NS):
            lo, hi = meta['slices'][s][rk]
            worst_r = max(worst_r, abs(v[s].min() - lo), abs(v[s].max() - hi))
            worst_g = max(worst_g, abs(float((v[s] * w).sum()) - meta['slices'][s][gk]))
        # json values are rounded to 4 decimals, so allow that on top of the byte rounding
        assert worst_r <= tol[f['key']] + 1e-4, f'{f["key"]}: decoded range off by {worst_r}'
        assert worst_g <= tol[f['key']] + 1e-4, f'{f["key"]}: decoded global mean off by {worst_g}'
        print(f'{f["key"]}: bytes {b.min()}..{b.max()}, decoded {v.min():.3f}..{v.max():.3f} {f["unit"]}; '
              f'decoded ranges within {worst_r:.4f} and global means within {worst_g:.4f} of climate.json '
              f'(encoding error bound {tol[f["key"]]:.4f})')

    # Spot check against the raw files through PhanDA's own float64 copies, located by coordinate.
    zips = {'temperature': ('phanda_07_tas', 'tas'), 'rain': ('phanda_07_pr', 'pr')}
    for fi, f in enumerate(fields):
        zkey, var = zips[f['key']]
        with zipfile.ZipFile(source(zkey)) as z:
            names = z.namelist()
            for s in (0, 54, 108):
                e = meta['slices'][s]['experiment']
                mem = sorted(n for n in names if n.startswith(f'scotese_07_{e:03d}_'))
                assert len(mem) == 5, mem
                acc = None
                for n in mem:
                    with h5py.File(io.BytesIO(z.read(n)), 'r') as h:
                        x = h[var][:, 0, :, :].mean(axis=0)          # (96 lon, 73 lat)
                        plon, plat = h['lon'][:], h['lat'][:]
                    acc = x if acc is None else acc + x
                acc /= 5.0
                ref = np.empty((NY, NX))
                for j in range(NY):
                    jj = int(np.flatnonzero(plat == 90.0 - 2.5 * j)[0])
                    for c in range(NX):
                        lon = 3.75 * c
                        lon = lon - 360.0 if lon >= 180.0 else lon
                        cc = int(np.flatnonzero(plon == lon)[0])
                        ref[j, c] = acc[cc, jj]
                # tas is in K like the UM field; PhanDA's pr copy is the UM rate x 31,536,000
                # (measured: the ratio is exactly that at every node), i.e. mm per 365-day year.
                ref = ref - 273.15 if f['key'] == 'temperature' else ref / 365.0
                d = np.abs(decode(a[fi, s], f) - ref).max()
                assert d <= tol[f['key']] + 1e-6, f'{f["key"]} slice {s}: {d} from the raw file'
                gm = float((ref * w).sum())
                gk = 'global_mean_c' if f['key'] == 'temperature' else 'global_mean_rain_mm_day'
                assert abs(gm - meta['slices'][s][gk]) < 1e-3
                print(f'  raw re-read ({var} copy) slice {s} (plate age {5 * s} Ma, experiment {e}): '
                      f'every node within {d:.4f} {f["unit"]}; global mean {gm:.4f}')

    # The present-day slice: the model's own pre-industrial climate, not observations.
    s0 = meta['slices'][0]
    t0, r0 = s0['global_mean_c'], s0['global_mean_rain_mm_day']
    print(f'0 Ma (the model\'s pre-industrial run, CO2 {s0["co2_ppm"]} ppm): global mean {t0:.4f} C '
          f'(design-stage measurement {MODEL_0MA_C}, tolerance {TOL_C}; band {BAND_C}), '
          f'{r0:.4f} mm/day ({MODEL_0MA_RAIN}, tolerance {TOL_RAIN}; band {BAND_RAIN})')
    assert abs(t0 - MODEL_0MA_C) <= TOL_C and BAND_C[0] <= t0 <= BAND_C[1]
    assert abs(r0 - MODEL_0MA_RAIN) <= TOL_RAIN and BAND_RAIN[0] <= r0 <= BAND_RAIN[1]
    gms = [s['global_mean_c'] for s in meta['slices']]
    k = int(np.argmax(gms)), int(np.argmin(gms))
    print(f'global mean temperature over the 109 slices: {min(gms):.2f} C at {5 * k[1]} Ma .. '
          f'{max(gms):.2f} C at {5 * k[0]} Ma')

    # ExperimentInfo.xlsx, read again: the file names' rounded ages are never used.
    cells = read_workbook(source('phanda_info'))['Sheet1']
    sheet = {int(cells[(r, 1)]): (cells[(r, 2)], cells[(r, 3)], cells[(r, 17)])
             for r in range(3, 3 + NS)}
    assert sheet[27][:2] == (410.0, 410.0), sheet[27]
    assert sheet[108][:2] == (4.0, 5.0), sheet[108]
    by_exp = {s['experiment']: s for s in meta['slices']}
    assert (by_exp[27]['experiment_age_ma'], by_exp[27]['plate_age_ma']) == (410.0, 410.0)
    assert (by_exp[108]['experiment_age_ma'], by_exp[108]['plate_age_ma']) == (4.0, 5.0)
    assert s0['experiment'] == 109 and s0['co2_ppm'] == 276.01 == sheet[109][2]
    last = meta['slices'][108]
    assert (last['experiment'], last['plate_age_ma'], last['experiment_age_ma'], last['co2_ppm']) == \
        (1, 540.0, 541.0, 3374.0)
    for e, (ea, pa, co2) in sheet.items():
        assert (by_exp[e]['experiment_age_ma'], by_exp[e]['plate_age_ma'], by_exp[e]['co2_ppm']) == (ea, pa, co2)
    print('ExperimentInfo.xlsx: experiment 27 = 410/410 Ma (file name says 409Ma), 108 = age 4 / plate 5 '
          '(file name 3Ma); slice 0 = experiment 109, CO2 276.01; slice 108 = experiment 1, plate 540, '
          'age 541, CO2 3374; all 109 rows agree with climate.json')

    # Map matching (work/climate.json, CONTRACT §1).
    match = json.load(open(os.path.join(WORK, 'climate.json')))['maps']
    assert len(match) == 90
    exact = sum(1 for m in match if m['climate'] is not None and m['climate_age_ma'] == m['file_age_ma'])
    near = sorted((m['file_age_ma'], m['climate_age_ma']) for m in match
                  if m['climate'] is not None and m['climate_age_ma'] != m['file_age_ma'])
    none = [m['map'] for m in match if m['climate'] is None]
    assert exact == 82 and near == [(1.0, 0.0), (4.0, 5.0), (6.0, 5.0), (66.0, 65.0), (461.0, 460.0)]
    assert none == [90, 92, 93]
    print(f'maps -> climate: {exact} exact; nearest {near}; none for maps {none}')
    print('verify_climate: OK')


if __name__ == '__main__':
    main()
