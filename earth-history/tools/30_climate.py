"""Step 30 — the climate model's annual means: data/climate.bin + data/climate.json.

Reads the PhanDA HadCM3L model priors, suite scotese_07 (Zenodo 8237751): ExperimentInfo.xlsx for
each experiment's ages and CO2, and every member of scotese_07_tas.zip and scotese_07_pr.zip
(109 experiments x 5 files per variable). Layout, encoding and weights: tools/CONTRACT.md §6.

What a member is, read from each file's own `history` attribute (and asserted here): member Mk is
`cdo -ymonmean -seltimestep,{240(k-1)+1}/{240k}` over the last 1,200 months of the run, i.e. the
12-month climatology of the k-th of five consecutive 20-year windows covering the run's last 100
model years. The annual mean is therefore the plain mean of the 12 months (a 360-day calendar,
months 30 days apart, asserted), then the plain mean of the 5 members: the 100-year annual mean.

Also writes tools/work/climate.json: which climate slice each of the 90 maps uses (the nearest
Plate Age to the map's file_age_ma within 2.5 Myr, else none; CONTRACT §1), for steps 40 and 80.

    .venv/bin/python 30_climate.py
"""
import io
import os
import re
import zipfile

import h5py
import numpy as np

from common import RETRIEVED, json_text, write_bin, write_fragment, write_json, write_work
from geo import read_slices, source
from paths import DATA
from sources import SOURCES
from xlsx import read_workbook

NX, NY = 96, 73
NSLICE = 109
SLICE_BYTES = NX * NY
MEMBERS = 5
FILL = 1e19                      # the files' _FillValue is 2e20; anything this large is a fill
MATCH_MYR = 2.5
CAP_JSON = 30_000
BIN_BYTES = 2 * NSLICE * SLICE_BYTES      # 1,527,744 (CONTRACT §6)

# One byte per node, Global Weather's `offset + step * byte ** power`; 255 = no data (CONTRACT §6).
FIELDS = [
    {'key': 'temperature', 'variable': 'temp_mm_1_5m', 'zip': 'phanda_07_tas', 'suffix': 'tas',
     'what': 'annual mean air temperature 1.5 m above the surface', 'unit': 'C',
     'offset': -60.0, 'step': 0.5, 'power': 1, 'nodata': 255},
    {'key': 'rain', 'variable': 'precip_mm_srf', 'zip': 'phanda_07_pr', 'suffix': 'pr',
     'what': 'annual mean total precipitation', 'unit': 'mm/day',
     'offset': 0.0, 'step': 0.0003, 'power': 2, 'nodata': 255},
]


def encode(values, f):
    """Bytes for float values; refuses (never clips) a value that needs a byte outside 0..254."""
    if f['power'] == 1:
        b = np.rint((values - f['offset']) / f['step'])
    else:
        assert values.min() >= 0, f'{f["key"]}: negative value {values.min()} cannot be encoded'
        b = np.rint(np.sqrt((values - f['offset']) / f['step']))
    assert b.min() >= 0 and b.max() <= 254, \
        f'{f["key"]}: bytes {b.min()}..{b.max()} outside 0..254 — change the encoding in CONTRACT §6'
    return b.astype(np.uint8)


def decode(b, f):
    b = b.astype(np.float64)
    return f['offset'] + f['step'] * (b if f['power'] == 1 else b * b)


def weights():
    """Node-bound area weights (CONTRACT §6): rows 90 -> -90 by 2.5, each node's band +-1.25 deg."""
    lat = 90.0 - 2.5 * np.arange(NY)
    hi = np.radians(np.minimum(90.0, lat + 1.25))
    lo = np.radians(np.maximum(-90.0, lat - 1.25))
    w = np.sin(hi) - np.sin(lo)
    w2 = np.repeat(w[:, None], NX, axis=1)
    return w2 / w2.sum()


def experiments():
    """The 109 scotese_07 experiments from ExperimentInfo.xlsx, ordered by Plate Age ascending."""
    cells = read_workbook(source('phanda_info'))['Sheet1']
    assert cells[(1, 1)] == 'Experiment Number' and cells[(1, 2)] == 'Experiment Age'
    assert cells[(1, 3)] == 'Plate Age' and cells[(1, 16)] == 'scotese_07'
    assert cells[(2, 16)] == 'PUMA ID' and cells[(2, 17)] == 'CO2'
    rows = []
    r = 3
    while (r, 1) in cells:
        rows.append({'experiment': int(cells[(r, 1)]), 'experiment_age_ma': cells[(r, 2)],
                     'plate_age_ma': cells[(r, 3)], 'puma_id': cells[(r, 16)],
                     'co2_ppm': cells[(r, 17)]})
        r += 1
    rows.sort(key=lambda e: e['plate_age_ma'])
    assert [e['plate_age_ma'] for e in rows] == [5.0 * s for s in range(NSLICE)], \
        'Plate Age is not exactly 0, 5, ... 540'
    assert sorted(e['experiment'] for e in rows) == list(range(1, NSLICE + 1))
    return rows


def member_names(z, suffix):
    """{experiment: [member file names M1..M5]} from one zip, asserting 5 per experiment."""
    pat = re.compile(r'^scotese_07_(\d{3})_[0-9.]+Ma_[0-9.]+pCO2_M([1-5])_' + suffix + r'\.nc$')
    out = {}
    for n in z.namelist():
        m = pat.match(n)
        assert m, f'unexpected member {n!r}'
        out.setdefault(int(m.group(1)), {})[int(m.group(2))] = n
    assert sorted(out) == list(range(1, NSLICE + 1)), 'experiments missing from the zip'
    for e, d in out.items():
        assert sorted(d) == [1, 2, 3, 4, 5], f'experiment {e}: members {sorted(d)}'
    return {e: [d[k] for k in range(1, MEMBERS + 1)] for e, d in out.items()}


def read_member(raw, f, puma, k):
    """One member's (12, 73, 96) float64 field, with every assumption about the file asserted."""
    with h5py.File(io.BytesIO(raw), 'r') as h:
        hist = h.attrs['history']
        hist = hist.decode() if isinstance(hist, bytes) else str(hist)
        want = f'-seltimestep,{240 * (k - 1) + 1}/{240 * k} scotese_output/scotese_07/{puma}_{f["suffix"]}.nc'
        assert want in hist, f'{puma} M{k}: history does not say {want!r}'
        lat = h['latitude'][:]
        lon = h['longitude'][:]
        assert np.array_equal(lat, (90.0 - 2.5 * np.arange(NY)).astype(np.float32)), 'latitude grid'
        assert np.array_equal(lon, (3.75 * np.arange(NX)).astype(np.float32)), 'longitude grid'
        t = h['t']
        assert t.attrs['calendar'] in (b'360_day', '360_day') and t.shape == (12,)
        assert np.all(np.diff(t[:]) == 30.0), 'months are not 30 days apart'
        v = h[f['variable']]
        assert v.shape == (12, 1, NY, NX), f'{f["variable"]} shape {v.shape}'
        a = v[:, 0, :, :].astype(np.float64)
    assert np.isfinite(a).all() and (np.abs(a) < FILL).all(), f'{puma} M{k}: fill or NaN present'
    return a


def annual_means(key, exps):
    """(109, 73, 96) float64 annual means, slice order = exps order, in the field's display unit."""
    f = next(x for x in FIELDS if x['key'] == key)
    out = np.empty((NSLICE, NY, NX), dtype=np.float64)
    with zipfile.ZipFile(source(f['zip'])) as z:
        names = member_names(z, f['suffix'])
        for s, e in enumerate(exps):
            acc = np.zeros((NY, NX), dtype=np.float64)
            for k, n in enumerate(names[e['experiment']], start=1):
                acc += read_member(z.read(n), f, e['puma_id'], k).mean(axis=0)
            m = acc / MEMBERS
            out[s] = m - 273.15 if key == 'temperature' else m * 86400.0
    return out


def match_maps(plate_ages):
    """Per map (manifest order): the climate slice whose plate age is nearest file_age_ma, when
    within MATCH_MYR, else None (CONTRACT §1)."""
    rows = []
    pa = np.asarray(plate_ages)
    for i, s in enumerate(read_slices()):
        d = np.abs(pa - s['file_age_ma'])
        j = int(np.argmin(d))
        ok = d[j] <= MATCH_MYR
        rows.append({'i': i, 'map': s['map'], 'file_age_ma': s['file_age_ma'],
                     'climate': j if ok else None, 'climate_age_ma': float(pa[j]) if ok else None})
    return rows


def main():
    exps = experiments()
    w = weights()
    fields = {}
    for f in FIELDS:
        fields[f['key']] = annual_means(f['key'], exps)

    blobs = []
    slices = [dict(s=i, experiment=e['experiment'], plate_age_ma=e['plate_age_ma'],
                   experiment_age_ma=e['experiment_age_ma'], puma_id=e['puma_id'],
                   co2_ppm=e['co2_ppm']) for i, e in enumerate(exps)]
    worst = {}
    for f in FIELDS:
        vals = fields[f['key']]
        b = encode(vals, f)
        worst[f['key']] = float(np.abs(decode(b, f) - vals).max())
        blobs.append(b.tobytes())
        for s in range(NSLICE):
            gm = float((vals[s] * w).sum())
            lo, hi = float(vals[s].min()), float(vals[s].max())
            if f['key'] == 'temperature':
                slices[s].update(global_mean_c=gm, range_c=[lo, hi])
            else:
                slices[s].update(global_mean_rain_mm_day=gm, range_rain_mm_day=[lo, hi])
        f['bytes_used'] = [int(b.min()), int(b.max())]
    raw = b''.join(blobs)
    assert len(raw) == BIN_BYTES, f'climate.bin {len(raw)} bytes, expected {BIN_BYTES}'
    assert 255 not in raw, 'a no-data byte (255) reached climate.bin'

    meta = {
        'source': 'phanda', 'suite': 'scotese_07', 'model': 'HadCM3L',
        'grid': {'nx': NX, 'ny': NY, 'lon0': 0, 'dlon': 3.75, 'lat0': 90, 'dlat': -2.5,
                 'order': 'row-major, north row first, eastward columns', 'at': 'nodes'},
        'layout': '[field][slice][row][col]', 'slice_bytes': SLICE_BYTES, 'count': NSLICE,
        'fields': [{k: f[k] for k in ('key', 'variable', 'what', 'unit', 'offset', 'step', 'power',
                                      'nodata', 'bytes_used')} for f in FIELDS],
        'annual_mean': ('mean of 12 equal months (360-day calendar), then of the 5 members; each '
                        'member is the monthly climatology of one of five consecutive 20-year '
                        "windows over the run's last 100 model years"),
        'weights': 'node-bound: sin(min(90, lat+1.25)) - sin(max(-90, lat-1.25))',
        'max_encoding_error': {'temperature_c': worst['temperature'],
                               'rain_mm_day': worst['rain']},
        'slices': slices,
    }
    txt = json_text(meta, ndigits=4)
    assert len(txt.encode('utf-8')) <= CAP_JSON, f'climate.json {len(txt)} bytes > {CAP_JSON}'

    match = match_maps([e['plate_age_ma'] for e in exps])

    # Only after every check: write.
    write_bin('climate.bin', raw)
    write_json('climate.json', meta, ndigits=4)
    write_work('climate.json', {'rule': f'nearest plate age to file_age_ma within {MATCH_MYR} Myr',
                                'maps': match})

    s = SOURCES['phanda_07_tas']
    p = SOURCES['phanda_07_pr']
    x = SOURCES['phanda_info']
    write_fragment('climate', [{
        'id': 'phanda', 'part': 'climate fields',
        'title': 'PhanDA HadCM3L model priors, suite scotese_07',
        'owner': ('E. J. Judd, J. E. Tierney, D. J. Lunt, I. P. Montanez, B. T. Huber, S. L. Wing & '
                  'P. J. Valdes; simulations by the BRIDGE group, University of Bristol'),
        'source': (f'{x["name"]} (sha256 {x["sha256"]}), {s["name"]} (sha256 {s["sha256"]}) and '
                   f'{p["name"]} (sha256 {p["sha256"]}), Zenodo record 8237751 '
                   '(doi:10.5281/zenodo.8237751): the fields temp_mm_1_5m and precip_mm_srf of '
                   'experiments 1-109, five 20-year monthly climatologies each.'),
        'url': 'https://zenodo.org/records/8237751',
        'licence': 'CC BY 4.0', 'licence_uri': 'http://creativecommons.org/licenses/by/4.0/',
        'licence_quote': 'Zenodo record 8237751: license cc-by-4.0 (Creative Commons Attribution 4.0 International).',
        'retrieved': RETRIEVED,
        'adaptations': ('Averaged over the 12 months and the five 20-year means into annual means; '
                        'temperature converted from kelvin to degrees Celsius and precipitation from '
                        'kg m-2 s-1 to mm/day; each value rounded to one byte (temperature in steps of '
                        '0.5 C, rain on a square-root scale); area-weighted global means computed.'),
        'accuracy': ('A climate model, not measurements: one HadCM3L run per 5 million years on '
                     "Scotese's reconstructed geography, forced with a CO2 history. Byte rounding "
                     f'changes values by at most {worst["temperature"]:.2f} C and '
                     f'{worst["rain"]:.3f} mm/day.'),
        'cite': (SOURCES['phanda_info']['attribution'] + ' The simulations are described in Valdes, '
                 'P.J., Scotese, C.R. & Lunt, D.J., 2021. Deep ocean temperatures through time. '
                 'Climate of the Past 17, 1483-1506, doi:10.5194/cp-17-1483-2021 (title, authors '
                 'and pages from Crossref).'),
    }])

    t0, r0 = slices[0]['global_mean_c'], slices[0]['global_mean_rain_mm_day']
    exact = sum(1 for m in match if m['climate'] is not None and m['climate_age_ma'] == m['file_age_ma'])
    near = [(m['file_age_ma'], m['climate_age_ma']) for m in match
            if m['climate'] is not None and m['climate_age_ma'] != m['file_age_ma']]
    none = [m['map'] for m in match if m['climate'] is None]
    print(f'climate.bin: {len(raw):,} bytes (2 fields x {NSLICE} slices x {SLICE_BYTES:,})')
    print(f'climate.json: {len(txt.encode()):,} bytes')
    for f in FIELDS:
        v = fields[f['key']]
        print(f'  {f["key"]}: {v.min():.3f} .. {v.max():.3f} {f["unit"]}, bytes {f["bytes_used"][0]}..'
              f'{f["bytes_used"][1]}, worst encoding error {worst[f["key"]]:.4f} {f["unit"]}')
    print(f'  0 Ma (experiment {slices[0]["experiment"]}): global mean {t0:.3f} C, {r0:.4f} mm/day, '
          f'CO2 {slices[0]["co2_ppm"]} ppm')
    print(f'maps -> climate slice: {exact} exact, nearest {near}, none for maps {none}')


if __name__ == '__main__':
    main()
