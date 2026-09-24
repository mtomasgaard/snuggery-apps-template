#!/usr/bin/env python3
"""Step 10 — planets, the Moon and Pluto as a compact float32 Chebyshev table refitted from JPL DE430.

    ephem.bin    per body, intervals x 3 x (degree+1) float32 Chebyshev coefficients (km),
                 laid out [interval][x,y,z][coefficient], bodies concatenated in manifest order
    ephem.json   the manifest (CONTRACT.md section 1): range, EMRAT, per-body offset, interval
                 length and degree, and the error measured against DE430 itself

DE430 (Folkner et al. 2014) is read from the full SPK, pinned by sha256. For every interval the
body's position is sampled at the degree+1 Chebyshev nodes and the interpolating polynomial is
solved exactly in float64, then stored as float32 — the same construction as the research
prototype (research/solar-ephemeris/bench/build_table.py), whose interval/degree choices are kept.
Heliocentric = target barycentre - Sun, both relative to the solar-system barycentre. For Jupiter
to Pluto the target is the system barycentre (DE has no planet centres there). The Moon is
geocentric (301 - 399 around the Earth-Moon barycentre).

EMRAT (the Earth/Moon mass ratio the app needs to split the EMB) is not copied from a header: it
is measured from the SPK's own 3->301 and 3->399 segments, whose ratio is exactly -EMRAT.

The error is measured at 20,000 epochs drawn from a fixed seed over the whole range, with the
float32 coefficients evaluated in float64 — exactly what js/ephem.js does.
"""
import json
import os
import sys

import numpy as np
from jplephem.spk import SPK
from numpy.polynomial import chebyshev as C

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
import solar_sources as S
from paths import CACHE

JD0, JD1 = S.PLANET_JD
N_TEST = 20000
SEED = 20260923

# name, NAIF target (relative to the Sun), interval days, degree — research prototype settings.
CFG = [('mercury', 1, 32, 13), ('venus', 2, 128, 11), ('emb', 3, 128, 9), ('mars', 4, 256, 11),
       ('jupiter', 5, 512, 9), ('saturn', 6, 512, 9), ('uranus', 7, 512, 9), ('neptune', 8, 512, 9),
       ('pluto', 9, 512, 9), ('moon', 'moon', 16, 11)]


def main():
    spk_file = S.spk_path('de430')
    k = SPK.open(spk_file)
    for seg in k.segments:
        assert seg.start_jd <= JD0 and seg.end_jd >= JD1 + 512, 'DE430 must cover the table range'

    def fun(target):
        if target == 'moon':
            return lambda t: k[3, 301].compute(t) - k[3, 399].compute(t)
        return lambda t: k[0, target].compute(t) - k[0, 10].compute(t)

    # EMRAT from the SPK itself: (Moon - EMB) = -EMRAT * (Earth - EMB) at every epoch.
    te = np.linspace(JD0, JD1, 4001)
    m = k[3, 301].compute(te)
    e = k[3, 399].compute(te)
    emrat = float(-(m * e).sum() / (e * e).sum())
    emrat_spread = float(np.max(np.abs(np.linalg.norm(m, axis=0) / np.linalg.norm(e, axis=0) - emrat)))
    print(f'EMRAT from 3->301 / 3->399: {emrat:.10f} (max deviation over 4001 epochs {emrat_spread:.1e})')

    rng = np.random.default_rng(SEED)
    T = np.sort(rng.uniform(JD0, JD1, N_TEST))
    blob = bytearray()
    bodies, errs, detail = [], {}, {}
    coef_cache = {}
    for name, target, L, deg in CFG:
        f = fun(target)
        n = int(np.ceil((JD1 - JD0) / L))
        x = np.cos(np.pi * (np.arange(deg + 1) + 0.5) / (deg + 1))
        starts = JD0 + L * np.arange(n)
        tt = (starts[:, None] + (x[None, :] + 1) / 2 * L).ravel()
        P = f(tt).reshape(3, n, deg + 1)
        coefs = np.linalg.solve(C.chebvander(x, deg), P.transpose(2, 0, 1).reshape(deg + 1, -1))
        coefs = coefs.reshape(deg + 1, 3, n)
        arr = np.ascontiguousarray(coefs.transpose(2, 1, 0)).astype('<f4')   # [interval][xyz][coef]
        bodies.append(dict(name=name, center='earth' if target == 'moon' else 'sun', offset=len(blob),
                           intervals=n, interval_days=L, degree=deg))
        blob += arr.tobytes()
        c = arr.astype(np.float64)
        coef_cache[name] = (c, L, n, deg)
        est = evaluate(c, L, n, deg, T)
        err = np.linalg.norm(est - f(T), axis=0)
        errs[name] = float(err.max())
        detail[name] = dict(p99=float(np.percentile(err, 99)), bytes=arr.nbytes)
        print(f'{name:8s} L={L:4d} d  deg {deg:2d}  {arr.nbytes:8d} B  max {err.max():8.2f} km  '
              f'p99 {np.percentile(err, 99):8.2f} km')

    # Earth as the app rebuilds it: EMB - Moon/(1+EMRAT).
    emb = evaluate(*coef_cache['emb'], T)
    moon = evaluate(*coef_cache['moon'], T)
    earth = emb - moon / (1 + emrat)
    truth = k[0, 3].compute(T) + k[3, 399].compute(T) - k[0, 10].compute(T)
    errs['earth'] = float(np.linalg.norm(earth - truth, axis=0).max())
    print(f'earth (EMB - moon/(1+EMRAT)) max {errs["earth"]:.2f} km')

    manifest = {
        'source': 'de430.bsp', 'jd_start': JD0, 'jd_end': JD1, 'frame': 'ICRF', 'units': 'km',
        'time_scale': 'TDB', 'emrat': emrat, 'bodies': bodies,
        'max_error_km': {kk: round(v, 3) for kk, v in errs.items()},
        'error_epochs': N_TEST,
        'note': ('Refit of JPL DE430 (Folkner et al. 2014). Heliocentric ICRF; jupiter..pluto are '
                 'system barycentres (Pluto-system barycentre, ~2,135 km from the centre of Pluto); '
                 'moon is geocentric. Earth = emb - moon/(1+emrat).'),
    }
    common.write_bin('ephem.bin', bytes(blob))
    common.write_json('ephem.json', manifest, ndigits=30)
    print(f'ephem.bin {len(blob)} bytes')

    # Reference positions for the node test (not shipped): DE430 straight from the SPK.
    rng2 = np.random.default_rng(SEED + 1)
    tr = np.sort(rng2.uniform(JD0, JD1, 600))
    ref = {'jd': tr.tolist(), 'emrat': emrat, 'max_error_km': manifest['max_error_km'], 'helio': {}}
    ssb_sun = k[0, 10].compute(tr)
    for name, target in [('mercury', 1), ('venus', 2), ('mars', 4), ('jupiter', 5), ('saturn', 6),
                         ('uranus', 7), ('neptune', 8), ('pluto', 9)]:
        ref['helio'][name] = (k[0, target].compute(tr) - ssb_sun).T.tolist()
    earth_ref = k[0, 3].compute(tr) + k[3, 399].compute(tr) - ssb_sun
    ref['helio']['earth'] = earth_ref.T.tolist()
    ref['helio']['moon'] = (k[0, 3].compute(tr) + k[3, 301].compute(tr) - ssb_sun).T.tolist()
    ref['geo_moon'] = (k[3, 301].compute(tr) - k[3, 399].compute(tr)).T.tolist()
    os.makedirs(os.path.join(CACHE, 'solar'), exist_ok=True)
    with open(os.path.join(CACHE, 'solar', 'ref_ephem.json'), 'w') as fh:
        json.dump(ref, fh)


def evaluate(c, L, n, deg, T):
    i = np.clip(((T - JD0) // L).astype(int), 0, n - 1)
    xs = 2 * (T - (JD0 + i * L)) / L - 1
    V = C.chebvander(xs, deg)
    return np.einsum('ik,ick->ci', V, c[i])


if __name__ == '__main__':
    main()
