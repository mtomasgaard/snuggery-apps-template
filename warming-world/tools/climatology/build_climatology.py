"""Warming World's Absolute mode: a 1951–1980 climatology of 2 m air temperature on the app's 2° grid,
written to assets/climatology.json. A one-time static build, like assets/world.json; the monthly refresh
never touches it, and the app adds GISS's anomaly to it.

    python3 -m venv .venv && .venv/bin/pip install -r tools/climatology/requirements.txt
    .venv/bin/python tools/climatology/build_climatology.py            # download (pinned), build, write
    .venv/bin/python tools/climatology/build_climatology.py --check    # rebuild, compare with the file

Run from Template/warming-world/. Downloads go to tools/.work/climatology/ (gitignored, about 103 MB,
kept between runs); every file is checked against the sha256 pinned below before it is read.

The method (plan 0012 package 3.3; the researcher's recommendation, tools/DECISIONS.md):

1. ERA5 2 m air temperature, 1990–2019, as WeatherBench 2's 6-hourly day-of-year climatology on a 1.5°
   grid with poles (Rasp and others 2024; Google Cloud Storage, a copy of the Copernicus data made by
   WeatherBench 2 and published under the Copernicus licence in the bucket's LICENSE). It is the route
   that needs no account. The Climate Data Store's monthly ERA5 (CC BY 4.0, a free account) is the
   better source and is not built here: tools/DECISIONS.md says what it needs.
2. The mean of its four hours, then calendar months on a leap-year calendar (29 February weighted 1/4).
3. WeatherBench 2 smooths its climatology with a 61-day window. For a uniform window on the 366-day
   circle a harmonic of k cycles a year is scaled by g_k = sin(61πk/366) / (61 sin(πk/366)); the 12
   monthly means of each cell have harmonics 1–3 divided by g_k again. This is our own modelling step,
   said in About: it leaves monthly errors of up to about 1.3 °C on land (the researcher's test on an
   unsmoothed field), and it does not change the annual mean.
4. A first-order conservative remap onto the app's 180 × 90 cells: the exact overlap of every source
   cell with every app cell in longitude × sin(latitude).
5. Moved from 1990–2019 to 1951–1980 cell by cell and month by month with GISTEMP's own anomalies:
   C(cell, m) = ERA5(cell, m) − mean of GISS's anomaly for that cell and calendar month over 1990–2019,
   from the pinned grid the Warming World pipeline reads (release created 2026-08-10). A cell-month
   needs 20 of the 30 years; one without them takes its row's mean shift for that month.
6. 13 planes: January to December, then the year as the plain mean of the 12 (as GISS's annual mean is
   the mean of 12 monthly anomalies). One byte a cell, value −80 + 0.5·b °C, 255 for none (none occur),
   each byte minus the one to its west mod 256 (row delta, from 0 at 179° W), zlib level 9, base64.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
import urllib.request
import zlib

import numpy as np
import numcodecs

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(os.path.dirname(HERE))
TEMPLATE = os.path.dirname(APP)
PIPELINE = os.path.join(TEMPLATE, 'scripts', 'warming_world')     # GISTEMP's reader and its pinned grid
CACHE = os.path.join(APP, 'tools', '.work', 'climatology')
OUT = os.path.join(APP, 'assets', 'climatology.json')
CAP = 120_000                                                       # bytes of assets/climatology.json

WB2 = ('https://storage.googleapis.com/weatherbench2/datasets/era5-hourly-climatology/'
       '1990-2019_6h_240x121_equiangular_with_poles_conservative.zarr/')
WB2_LICENSE = 'https://storage.googleapis.com/weatherbench2/datasets/era5-hourly-climatology/LICENSE'
ACCESSED = '2026-10-06'             # the date the pinned files below were downloaded
# path → (bytes, sha256), read on 2026-10-06 (the objects' generation 1734011234350624, 2024-12-12)
PINS = {
    'latitude/0': (528, '0099a8a0cfec2eb3e7d3c1a5a0b00b063c86ba0fe98bdc379bfe269af0207875'),
    'longitude/0': (845, '127c574174be6960bd1abe3d7f6259b9b9a85fad751df91ae1e6c0c469bb0beb'),
    'dayofyear/0': (407, '6124de26183676ad95738068949b35444c5d30ff9993f38d4a922d918e81b47c'),
    'hour/0': (48, '204a0a0a276366a2b84c44247faebcf5b2fde6e17e7976f4daacf621fcb3dfe9'),
    '2m_temperature/.zarray': (390, '6153b374b6efaa37645fd672db800fda8867ca01be5b9ccc7e444aa96238feca'),
    '2m_temperature/0.0.0.0': (8350573, 'f1d716ace79463ab7e148dfca847de156f3f181dfe6eb5235ae2498b9eb549d1'),
    '2m_temperature/0.1.0.0': (8521756, 'febd86470034bf7a58f5b8ead93b86b02d52cba53caa5a0287ade6080d6f273d'),
    '2m_temperature/0.2.0.0': (8586973, '856134f2b3325698dba494592295f893fded9a514911d398fd5bf5ae69c7ae59'),
    '2m_temperature/0.3.0.0': (8484175, 'c2ec6cceeb8e1cb807e41fb3968e39262ef4af68f06388c4d42af1cdc4f51728'),
    '2m_temperature/0.4.0.0': (8357339, '8ddaa4ee314242f8ff85e6a6148ee4a7ea184fafc80ffb89a8449fb97247d855'),
    '2m_temperature/0.5.0.0': (8330406, 'ea360596aed85a02b780f2c29b48ca5ae6948e93a2a635236327cc1be1145608'),
    '2m_temperature/0.6.0.0': (8166016, '38ce68e41131778d2a0f332e69ce3eab17cb8239f05ad459a3a4b3739c3356b6'),
    '2m_temperature/0.7.0.0': (8134119, 'b40f30e547cd7f6f11c3b5af7ded3d513fdff62c4a049fe708e74bc57a613ee4'),
    '2m_temperature/0.8.0.0': (8382668, '20cb94b51c4678796468b40f84dfeed60b0b7154fec9e6ce028a8d19642bb789'),
    '2m_temperature/0.9.0.0': (8544437, 'c880c8fd08836dd68a66e5dd8ffba7d2b26628aa42b82ee2043d054fc4273dff'),
    '2m_temperature/0.10.0.0': (8603835, 'ade35575b431c419c647dc8d3e85abb98775728bb24389b69d75be4574fcee94'),
    '2m_temperature/0.11.0.0': (8521376, 'eb3789b7442068d7b5d1ed3b81b670f9710392cf136033dbd0a342df3ae28819'),
    '2m_temperature/0.12.0.0': (1728985, '182da56ef9befb1e8449bc4dc90fe23305cf4463a6ebf1210380b270c41ceb81'),
}
LICENSE_PIN = (8435, 'ffe05f9653f14ffd23322bf1ebecfd6dd519ba59726280b34593fcf69ccab60e')

NX, NY = 180, 90
OFFSET, STEP, NONE = -80.0, 0.5, 255
SHIFT_YEARS = (1990, 2019)
MIN_YEARS = 20
WINDOW = 61
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

SOURCE = {
    'name': 'ERA5-based 2 m air temperature, 1951–1980 average (assets/climatology.json)',
    'owner': 'Copernicus Climate Change Service (C3S), ECMWF',
    'licence': 'ERA5: CC BY 4.0 (creativecommons.org/licenses/by/4.0/). The copy read here, WeatherBench 2’s '
               'climatology, is published under the Licence to Use Copernicus Products, which its bucket’s '
               'LICENSE file quotes.',
    'attribution': 'Absolute temperatures: the 1951–1980 average 2 m air temperature from ERA5 (Copernicus Climate '
                   'Change Service, ECMWF), averaged onto GISS’s 2° grid by this app and moved from 1990–2019 to '
                   '1951–1980 by GISTEMP’s own anomalies; GISS’s anomaly is added to it. Contains modified '
                   'Copernicus Climate Change Service information 2026. Neither the European Commission nor ECMWF '
                   'is responsible for any use that may be made of the Copernicus information or data it contains.',
    'citation': [
        # the ERA5 product WeatherBench 2 derived its climatology from (hourly, not the CDS's monthly means);
        # this build never read the CDS, so no access date: the date is WeatherBench 2's, said as such
        'Copernicus Climate Change Service (C3S): ERA5 hourly data on single levels from 1940 to present. '
        'Copernicus Climate Change Service (C3S) Climate Data Store (CDS), DOI: 10.24381/cds.adbb2d47.',
        'Hersbach, H., and others, 2020: The ERA5 global reanalysis. Quarterly Journal of the Royal Meteorological '
        'Society, 146(730), 1999–2049, doi:10.1002/qj.3803.',
        'Read through WeatherBench 2’s ERA5 climatology for 1990–2019, downloaded from WeatherBench 2 on '
        f'{ACCESSED}: Rasp, S., and others, 2024: WeatherBench 2: '
        'A Benchmark for the Next Generation of Data-Driven Global Weather Models. Journal of Advances in Modeling '
        'Earth Systems, 16(6), e2023MS004019, doi:10.1029/2023MS004019.',
    ],
    'url': WB2 + '2m_temperature/',
    'use': 'the Absolute mode: each cell’s 1951–1980 average, to which GISS’s anomaly is added',
}


# The CREDITS.txt section the Warming World pipeline writes from this file (build_static.py, plan 0012).
CREDITS = {
    'title': 'ERA5-based 2 m air temperature, 1951–1980 average (Absolute)',
    'owner': 'Copernicus Climate Change Service (C3S), implemented by ECMWF; the 1990–2019 climatology read '
             'here is WeatherBench 2’s copy of ERA5',
    'what': 'The Absolute mode only: each 2° cell’s 1951–1980 average, per calendar month and for the year, to '
            'which the app adds GISS’s anomaly (assets/climatology.json, built by '
            'tools/climatology/build_climatology.py).',
    'url': [WB2 + '2m_temperature/', 'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels'],
    'licence': SOURCE['licence'],
    'licence_quote': ['Licence to Use Copernicus Products, 5.1.2: Where the Licensee makes or contributes to a '
                      'publication or distribution containing adapted or modified Copernicus Products, the Licensee '
                      'shall provide the following or any similar notice: Contains modified Copernicus Climate Change '
                      'Service information [Year]. 5.1.3: Any such publication or distribution covered by clauses 5.1.1 '
                      'and 5.1.2 shall state that neither the European Commission nor ECMWF is responsible for any use '
                      'that may be made of the Copernicus information or data it contains.',
                      'The Climate Data Store’s catalogue record for ERA5 hourly data on single levels: license CC-BY-4.0.'],
    'accessed': '2026-10-06',
    'changes': 'Averaged over its four hours and into calendar months; its 61-day smoothing undone for the yearly '
               'cycle’s harmonics 1–3; remapped conservatively onto 2° cells; moved from 1990–2019 to 1951–1980 by '
               'GISTEMP’s own mean anomaly for each cell and calendar month; quantized to 0.5\u202f°C.',
    'citation': SOURCE['citation'],
    'attribution': SOURCE['attribution'],
}


def log(*a):
    print(*a, flush=True)


def fetch(rel: str, url: str, pin) -> bytes:
    p = os.path.join(CACHE, 'wb2', rel)
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        log(f'  downloading {url}')
        with urllib.request.urlopen(url, timeout=120) as r:
            data = r.read()
        with open(p + '.tmp', 'wb') as f:
            f.write(data)
        os.replace(p + '.tmp', p)
    data = open(p, 'rb').read()
    n, sha = pin
    got = hashlib.sha256(data).hexdigest()
    if len(data) != n or got != sha:
        sys.exit(f'error: {rel} is {len(data)} B sha256 {got}, pinned {n} B {sha}; delete it and run again')
    return data


def era5_monthly():
    """(12, 121 lat ascending, 240 lon) °C monthly means of WeatherBench 2's day-of-year climatology."""
    raw = {k: fetch(k, WB2 + k, v) for k, v in PINS.items()}
    fetch('LICENSE', WB2_LICENSE, LICENSE_PIN)
    za = json.loads(raw['2m_temperature/.zarray'])
    assert za['shape'] == [4, 366, 240, 121] and za['chunks'] == [4, 30, 240, 121] and za['dtype'] == '<f4', za
    blosc = numcodecs.Blosc()
    arr = lambda k, dt: np.frombuffer(blosc.decode(raw[k]), dt)
    lat, lon = arr('latitude/0', '<f8'), arr('longitude/0', '<f8')
    doy, hour = arr('dayofyear/0', '<i8'), arr('hour/0', '<i8')
    assert np.allclose(lat, -90 + 1.5 * np.arange(121)) and np.allclose(lon, 1.5 * np.arange(240)), 'not the 1.5° grid with poles'
    assert (doy == np.arange(1, 367)).all() and list(hour) == [0, 6, 12, 18], 'not 366 days at 00/06/12/18 UTC'
    parts = []
    for c in range(13):
        b = np.frombuffer(blosc.decode(raw[f'2m_temperature/0.{c}.0.0']), '<f4').reshape(4, 30, 240, 121)
        parts.append(b[:, :min(30, 366 - 30 * c)])
    t = np.concatenate(parts, axis=1).astype(np.float64)              # (hour, day, lon, lat), K
    assert t.shape == (4, 366, 240, 121) and np.isfinite(t).all()
    daily = t.mean(0) - 273.15                                        # (day, lon, lat), °C
    days = np.array([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
    month = np.repeat(np.arange(12), days)
    w = np.ones(366); w[59] = 0.25                                    # 29 February, one year in four
    mon = np.stack([np.average(daily[month == m], axis=0, weights=w[month == m]) for m in range(12)])
    return np.transpose(mon, (0, 2, 1)), lat, lon                     # (12, lat, lon)


def unsmooth(m):
    """Undo the 61-day uniform window for harmonics 1–3 of each cell's 12 monthly means."""
    F = np.fft.rfft(m.reshape(12, -1), axis=0)
    gains = []
    for k in (1, 2, 3):
        g = np.sin(np.pi * k * WINDOW / 366) / (WINDOW * np.sin(np.pi * k / 366))
        F[k] /= g
        gains.append(round(float(g), 4))
    return np.fft.irfft(F, n=12, axis=0).reshape(m.shape), gains


def conservative(src, lat, lon):
    """First-order conservative remap of src (lat ascending, lon from 0) onto the app's cells: row 0 is
    88–90° N, column 0 is 180–178° W. Exact overlap in longitude × sin(latitude)."""
    le = np.concatenate([[-90.0], (lat[:-1] + lat[1:]) / 2, [90.0]])          # pole cells are half cells
    lo = np.concatenate([lon - 0.75, [lon[-1] + 0.75]])
    a_hi = 90.0 - 2.0 * np.arange(NY); a_lo = a_hi - 2.0
    h = np.minimum(a_hi[:, None], le[1:][None, :]); l_ = np.maximum(a_lo[:, None], le[:-1][None, :])
    Wlat = np.clip(np.sin(np.radians(h)) - np.sin(np.radians(l_)), 0, None) * (h > l_)
    x0 = -180.0 + 2.0 * np.arange(NX); Wlon = np.zeros((NX, len(lon)))
    for k in (-360.0, 0.0, 360.0):
        Wlon += np.clip(np.minimum(x0[:, None] + 2, lo[1:][None, :] + k) - np.maximum(x0[:, None], lo[:-1][None, :] + k), 0, None)
    assert np.allclose(Wlon.sum(1), 2.0) and np.allclose(Wlat.sum(1), np.sin(np.radians(a_hi)) - np.sin(np.radians(a_lo)))
    W = Wlat.sum(1)[:, None] * Wlon.sum(1)[None, :]
    return np.stack([(Wlat @ f @ Wlon.T) / W for f in src])


def gistemp_shift():
    """(12, 90, 180) GISS's mean anomaly per calendar month over 1990–2019, north first, °C; and counts."""
    sys.path.insert(0, PIPELINE)
    import gistemp, sources                                           # the pipeline's own reader and pin
    pin = sources.GISTEMP_RESEARCH['grid']
    p = os.path.join(PIPELINE, 'cache', pin['name'])
    if not os.path.exists(p):
        sys.exit(f'error: {p} is missing: run scripts/warming_world/probe.py --fetch (it downloads the pinned grid)')
    gz = open(p, 'rb').read()
    if hashlib.sha256(gz).hexdigest() != pin['sha256']:
        sys.exit(f'error: {p} does not match its pinned sha256')
    g = gistemp.read_grid(gz)
    fill = g.nc.vars['tempanomaly'].attrs['_FillValue']
    acc = np.zeros((12, NY * NX)); n = np.zeros((12, NY * NX))
    for t, ym in enumerate(g.months):
        y, m = int(ym[:4]), int(ym[5:]) - 1
        if not SHIFT_YEARS[0] <= y <= SHIFT_YEARS[1]:
            continue
        f = np.array(g.frame(t), dtype=np.float64)                     # int16 hundredths, north first
        ok = f != fill
        acc[m][ok] += f[ok] / 100; n[m][ok] += 1
    with np.errstate(invalid='ignore', divide='ignore'):
        s = np.where(n >= MIN_YEARS, acc / np.maximum(n, 1), np.nan).reshape(12, NY, NX)
    missing = int(np.isnan(s).sum())
    for m in range(12):
        zonal = np.nanmean(np.where(np.isnan(s[m]), np.nan, s[m]), axis=1) if np.isfinite(s[m]).any() else None
        for j in range(NY):
            bad = np.isnan(s[m, j])
            if bad.any():
                z = zonal[j]
                if not np.isfinite(z):                                 # the nearest row with values
                    rows = [r for r in range(NY) if np.isfinite(zonal[r])]
                    z = zonal[min(rows, key=lambda r: abs(r - j))]
                s[m, j, bad] = z
    return s, {'release': pin['release'], 'sha256': pin['sha256'], 'cellMonthsFilled': missing}


def gmean(f):
    w = np.cos(np.radians(89.0 - 2.0 * np.arange(NY)))[:, None] * np.ones((1, NX))
    return float((f * w).sum() / w.sum())


def encode(plane):
    q = np.round((plane - OFFSET) / STEP)
    assert q.min() >= 0 and q.max() <= 254, (q.min(), q.max())
    b = q.astype(np.int16).reshape(NY, NX)
    d = np.diff(np.concatenate([np.zeros((NY, 1), np.int16), b], 1), axis=1) % 256
    return b.astype(np.uint8), base64.b64encode(zlib.compress(d.astype(np.uint8).tobytes(), 9)).decode()


def decode(s):
    d = np.frombuffer(zlib.decompress(base64.b64decode(s)), np.uint8).reshape(NY, NX)
    return (np.cumsum(d.astype(np.int64), axis=1) % 256).astype(np.uint8)


def build():
    log('== ERA5 (WeatherBench 2)')
    mon, lat, lon = era5_monthly()
    log(f'   native 1990–2019 global annual mean {np.average(mon.mean(0).mean(1), weights=np.cos(np.radians(lat))):.4f} °C (cos-weighted points)')
    sharp, gains = unsmooth(mon)
    log(f'   61-day window undone for harmonics 1–3, gains {gains}; annual mean changed by at most '
        f'{np.abs(sharp.mean(0) - mon.mean(0)).max():.2e} °C; monthly by at most {np.abs(sharp - mon).max():.2f} °C')
    era = conservative(sharp, lat, lon)                               # (12, 90, 180), 1990–2019
    log(f'   on the app grid: 1990–2019 global annual mean {gmean(era.mean(0)):.4f} °C')
    log('== GISTEMP shift, 1990–2019 against 1951–1980')
    shift, sh = gistemp_shift()
    log(f'   global mean shift {gmean(shift.mean(0)):.4f} °C; cell-months filled from their row: {sh["cellMonthsFilled"]} of {12 * NY * NX}')
    clim = era - shift
    planes = [clim[m] for m in range(12)] + [clim.mean(0)]
    enc = [encode(p) for p in planes]
    back = np.stack([OFFSET + STEP * e[0].astype(np.float64) for e in enc])
    err = float(np.abs(back - np.stack(planes)).max())
    for e in enc:
        assert (decode(e[1]) == e[0]).all()
    meansT = [int(round(gmean(back[i]) * 10)) for i in range(13)]    # tenths, for tools/test_decode.mjs
    doc = {
        'v': 1, 'app': 'Warming World', 'what': '2 m air temperature, the 1951–1980 average of each 2° cell, '
        'for each calendar month and the year; the app adds GISS’s anomaly to it for its Absolute mode',
        'variable': '2 m air temperature', 'period': '1951-1980',
        'grid': {'nx': NX, 'ny': NY, 'lon0': -179, 'lat0': 89, 'dlon': 2, 'dlat': -2, 'cells': True},
        'plane': {'offset': OFFSET, 'step': STEP, 'unit': '°C', 'none': NONE},
        'encoding': {'compression': 'deflate', 'delta': 'row', 'order': MONTHS + ['year']},
        'method': {
            'source': 'ERA5 1990–2019, WeatherBench 2’s 6-hourly day-of-year climatology at 1.5°, mean of its four hours, '
                      'calendar months (29 February weighted 1/4)',
            'unsmoothed': f'its {WINDOW}-day window undone for harmonics 1–3 of each cell’s 12 months (gains {gains})',
            'regrid': 'first-order conservative, exact overlap in longitude × sin(latitude)',
            'shift': f'minus GISS’s mean anomaly for the cell and calendar month over {SHIFT_YEARS[0]}–{SHIFT_YEARS[1]} '
                     f'(at least {MIN_YEARS} of 30 years; {sh["cellMonthsFilled"]} cell-months took their row’s mean), '
                     f'GISTEMP grid {sh["release"]}, sha256 {sh["sha256"]}',
            'year': 'the plain mean of the 12 months',
            'quantized': f'{STEP}\u202f°C steps, at most {err:.3f}\u202f°C off',
        },
        'globalMeanTenths': meansT,
        'source': SOURCE,
        'credits': CREDITS,
        'planes': [e[1] for e in enc],
    }
    log(f'   1951–1980 global means (tenths, Jan..Dec, year): {meansT}')
    log(f'   cells: year {back[12].min():.1f} to {back[12].max():.1f} °C; months {back[:12].min():.1f} to {back[:12].max():.1f} °C; quantizing error at most {err:.3f} °C')
    j, i = 12, 16
    log(f'   Fairbanks cell (row {j}, column {i}): year {back[12, j, i]:+.1f}, Jan {back[0, j, i]:+.1f}, Jul {back[6, j, i]:+.1f} °C')
    return doc, back


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--check', action='store_true', help='rebuild and compare with assets/climatology.json; write nothing')
    a = ap.parse_args(argv)
    doc, back = build()
    data = (json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
    if len(data) > CAP:
        sys.exit(f'error: {len(data):,} B exceeds the cap of {CAP:,} B; nothing written')
    if a.check:
        old = json.load(open(OUT, encoding='utf-8'))
        same = all((decode(x) == decode(y)).all() for x, y in zip(old['planes'], doc['planes'])) and len(old['planes']) == 13
        meta = {k: v for k, v in old.items() if k != 'planes'} == {k: v for k, v in json.loads(data).items() if k != 'planes'}
        log(f'check: planes {"identical" if same else "DIFFER"}, metadata {"identical" if meta else "DIFFERS"}')
        sys.exit(0 if same and meta else 1)
    with open(OUT + '.tmp', 'wb') as f:
        f.write(data)
    os.replace(OUT + '.tmp', OUT)
    log(f'wrote {len(data):,} B  {OUT}')


if __name__ == '__main__':
    main()
