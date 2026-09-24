#!/usr/bin/env python3
"""Verify the solar-system outputs (steps 10, 11, 12) and export the reference values the node
tests compare js/ephem.js and js/rotation.js against.

Checks, each printed with the measured number:
  ephem     layout matches the manifest; within budget; re-measured against DE430 at 25,000 fresh
            random epochs (a different seed from the build) and within the research's figures;
            EMRAT re-derived from the SPK.
  moons     layout; budget; every moon re-measured at 5,000 fresh random epochs against its SPK as
            the app evaluates it (relative to the system barycentre, with the rebuilt planet
            centre) and within 0.5 % of its orbit radius; frames orthonormal.
  physical  every body key present, radii/GM/pole copied exactly from the kernel pool; the IAU
            rotation evaluated from the JSON alone (a straight port of js/rotation.js) against
            CSPICE pxform('J2000', 'IAU_<BODY>') at seven epochs 1950-2100; leap seconds against
            pyerfa's eraDat; budget.
  js        no 'http://' or 'https://' in js/ephem.js or js/rotation.js.

Writes tools/.cache/solar/ref_rotation.json and ref_time.json (not shipped).
"""
import json
import math
import os
import sys

import numpy as np
from jplephem.spk import SPK

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import moonfit as MF
import solar_sources as S
from paths import APP, CACHE, DATA

FAIL = []


def check(ok, msg):
    print(('  ok    ' if ok else '  FAIL  ') + msg)
    if not ok:
        FAIL.append(msg)


# Research figures (report-solar-ephemeris.md: max error of the same table construction vs DE),
# with the float32 floor of the outer planets taken from the DE430 variant's upper end.
RESEARCH_KM = {'mercury': 21, 'venus': 9, 'emb': 12, 'earth': 13, 'mars': 27, 'jupiter': 72,
               'saturn': 105, 'uranus': 175, 'neptune': 290, 'pluto': 340, 'moon': 2.7}


def load(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as fh:
        return json.load(fh)


def verify_ephem():
    print('ephem')
    ej = load('ephem.json')
    blob = open(os.path.join(DATA, 'ephem.bin'), 'rb').read()
    total = sum(b['intervals'] * 3 * (b['degree'] + 1) * 4 for b in ej['bodies'])
    check(total == len(blob), f'ephem.bin {len(blob)} bytes = sum of manifest blocks {total}')
    size = len(blob) + os.path.getsize(os.path.join(DATA, 'ephem.json'))
    check(size <= 1_500_000, f'ephemeris {size} bytes <= 1.5 MB budget')
    check(ej['jd_start'] == 2415020.5 and ej['jd_end'] == 2488069.5, 'range 1900-01-01 .. 2100-01-01 TDB')
    k = SPK.open(S.spk_path('de430'))
    te = np.linspace(ej['jd_start'], ej['jd_end'], 997)
    m, e = k[3, 301].compute(te), k[3, 399].compute(te)
    emrat = float(np.median(np.linalg.norm(m, axis=0) / np.linalg.norm(e, axis=0)))
    check(abs(emrat - ej['emrat']) < 1e-8, f'EMRAT {ej["emrat"]:.10f} vs SPK ratio {emrat:.10f}')
    rng = np.random.default_rng(77)
    T = rng.uniform(ej['jd_start'], ej['jd_end'], 25000)
    got = {}
    for b in ej['bodies']:
        n, L, deg = b['intervals'], b['interval_days'], b['degree']
        c = np.frombuffer(blob, '<f4', n * 3 * (deg + 1), b['offset']).reshape(n, 3, deg + 1).astype(float)
        i = np.clip(((T - ej['jd_start']) // L).astype(int), 0, n - 1)
        x = 2 * (T - (ej['jd_start'] + i * L)) / L - 1
        est = np.einsum('ik,ick->ci', np.polynomial.chebyshev.chebvander(x, deg), c[i])
        got[b['name']] = est
        if b['name'] == 'moon':
            truth = k[3, 301].compute(T) - k[3, 399].compute(T)
        else:
            target = {'mercury': 1, 'venus': 2, 'emb': 3, 'mars': 4, 'jupiter': 5, 'saturn': 6,
                      'uranus': 7, 'neptune': 8, 'pluto': 9}[b['name']]
            truth = k[0, target].compute(T) - k[0, 10].compute(T)
        err = float(np.linalg.norm(est - truth, axis=0).max())
        check(err <= RESEARCH_KM[b['name']], f'{b["name"]:8s} max {err:8.2f} km at 25,000 fresh epochs '
              f'(manifest {ej["max_error_km"][b["name"]]:.2f}, research <= {RESEARCH_KM[b["name"]]})')
    earth = got['emb'] - got['moon'] / (1 + ej['emrat'])
    truth = k[0, 3].compute(T) + k[3, 399].compute(T) - k[0, 10].compute(T)
    err = float(np.linalg.norm(earth - truth, axis=0).max())
    check(err <= RESEARCH_KM['earth'], f'earth    max {err:8.2f} km (EMB - moon/(1+EMRAT))')


def verify_moons():
    print('moons')
    mj = load('moons.json')
    blob = open(os.path.join(DATA, 'moons.bin'), 'rb').read()
    total = sum(m['windows'] * 36 for m in mj['moons'])
    check(total == len(blob), f'moons.bin {len(blob)} bytes = sum of manifest blocks {total}')
    size = len(blob) + os.path.getsize(os.path.join(DATA, 'moons.json'))
    check(size <= 600_000, f'moons {size} bytes <= 0.6 MB budget')
    offs = [m['offset'] for m in mj['moons']]
    check(offs == sorted(offs) and offs[0] == 0, 'offsets ascending from 0')
    for k, F in mj['frames'].items():
        F = np.array(F)
        check(np.abs(F @ F.T - np.eye(3)).max() < 1e-11, f'frame {k} orthonormal')
    jd0, jd1 = mj['jd_start'], mj['jd_end']
    planets = {'mars': ('mar097', 4, 499), 'jupiter': ('jup310', 5, 599), 'saturn': ('sat425', 6, 699),
               'uranus': ('ura111', 7, 799), 'neptune': ('nep081', 8, 899)}
    rng = np.random.default_rng(78)
    for key, (f, b, p) in planets.items():
        k = SPK.open(S.spk_path(f))
        lo = max(s.start_jd for s in k.segments if s.center == b)
        T = rng.uniform(max(jd0, lo), jd1, 5000)
        F = np.array(mj['frames'][key])
        mine = [m for m in mj['moons'] if m['parent'] == key]
        rc = {}
        for m in mine:
            P = np.frombuffer(blob, '<f4', m['windows'] * 9, m['offset']).reshape(-1, 9).astype(float)
            W = m['window_days']
            kk = np.clip(np.floor((T - jd0) / W).astype(int), 0, m['windows'] - 1)
            rc[m['name']] = F.T @ MF.position_many(P[kk], T - (jd0 + (kk + 0.5) * W))
        centre = -sum(m['mass_ratio'] * rc[m['name']] for m in mine)
        for m in mine:
            truth = k[b, m['naif']].compute(T)[:3]
            err = float(np.linalg.norm(rc[m['name']] + centre - truth, axis=0).max())
            frac = err / m['a_km']
            check(frac <= 0.005, f'{m["name"]:9s} max {err:8.1f} km = {100 * frac:.4f} % of a at 5,000 fresh '
                  f'epochs (manifest {m["max_error_km"]:.1f} km)')
        cerr = float(np.linalg.norm(centre - k[b, p].compute(T)[:3], axis=0).max())
        check(cerr < 1.0, f'{key} centre rebuilt from moons: max {cerr:.3f} km off JPL\'s planet segment')


def pole_eval(body, angles, jd):
    """Straight port of js/rotation.js poleAngles + bodyFrame (independent of CSPICE)."""
    p = body['pole']
    d = jd - 2451545.0
    T = d / 36525
    ra = p['ra'][0] + p['ra'][1] * T + p['ra'][2] * T * T
    dec = p['dec'][0] + p['dec'][1] * T + p['dec'][2] * T * T
    W = p['pm'][0] + p['pm'][1] * d + p['pm'][2] * d * d
    n = max(len(p['nut_ra']), len(p['nut_dec']), len(p['nut_pm']))
    for kk in range(n):
        th = math.radians(sum(c * T ** j for j, c in enumerate(angles[kk])))
        if kk < len(p['nut_ra']):
            ra += p['nut_ra'][kk] * math.sin(th)
        if kk < len(p['nut_dec']):
            dec += p['nut_dec'][kk] * math.cos(th)
        if kk < len(p['nut_pm']):
            W += p['nut_pm'][kk] * math.sin(th)

    def r3(a):
        c, s = math.cos(a), math.sin(a)
        return np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])

    def r1(a):
        c, s = math.cos(a), math.sin(a)
        return np.array([[1, 0, 0], [0, c, s], [0, -s, c]])
    return r3(math.radians(W % 360)) @ r1(math.radians(90 - dec)) @ r3(math.radians(90 + ra))


def verify_physical():
    print('physical')
    ph = load('physical.json')
    mj = load('moons.json')
    size = os.path.getsize(os.path.join(DATA, 'physical.json'))
    check(size <= 60_000, f'physical.json {size} bytes <= 60 KB budget')
    keys = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus',
            'neptune', 'pluto'] + [m['name'].lower() for m in mj['moons']]
    check(sorted(keys) == sorted(ph['bodies']), f'{len(keys)} body keys = planets + every moon in moons.json')
    sp = S.load_kernel_pool()
    exact = True
    for key, b in ph['bodies'].items():
        exact &= b['radii_km'] == S.pool(sp, f'BODY{b["naif"]}_RADII')
        gm = S.pool(sp, f'BODY{b["naif"]}_GM')
        exact &= b['gm_km3_s2'] == (gm[0] if gm else None)
        if b['pole']:
            exact &= b['pole']['ra'][:len(S.pool(sp, f'BODY{b["naif"]}_POLE_RA'))] == S.pool(sp, f'BODY{b["naif"]}_POLE_RA')
            exact &= b['pole']['pm'][:len(S.pool(sp, f'BODY{b["naif"]}_PM'))] == S.pool(sp, f'BODY{b["naif"]}_PM')
    check(exact, 'radii, GM, pole RA and PM polynomials equal the CSPICE kernel pool exactly')
    epochs = [2433282.5, 2440000.5, 2451545.0, 2455197.5, 2460000.5, 2469807.5, 2488069.5]
    worst, ref = {}, {'epochs': epochs, 'bodies': {}}
    import spiceypy
    for key, b in ph['bodies'].items():
        if not b['pole']:
            continue
        angles = ph['nut_prec_angles'].get(b['pole']['system']) if b['pole']['system'] else None
        mats, w = [], 0.0
        for jd in epochs:
            et = (jd - 2451545.0) * 86400.0
            try:
                M = np.array(spiceypy.pxform('J2000', 'IAU_' + b['name'].upper(), et))
            except Exception:                      # no built-in IAU_ frame: the same via tipbod
                M = np.array(spiceypy.tipbod('J2000', b['naif'], et))
            mats.append(M.ravel().tolist())
            D = pole_eval(b, angles, jd) @ M.T
            # rotation angle of D from its antisymmetric part (acos of the trace loses precision)
            ax = np.array([D[2, 1] - D[1, 2], D[0, 2] - D[2, 0], D[1, 0] - D[0, 1]]) / 2
            ang = math.degrees(math.asin(min(1.0, float(np.linalg.norm(ax))))) * 3600
            w = max(w, ang)
        worst[key] = w
        ref['bodies'][key] = mats
    wk = max(worst, key=worst.get)
    check(worst[wk] < 0.01, f'IAU rotation from physical.json vs CSPICE pxform, {len(worst)} bodies x '
          f'{len(epochs)} epochs 1950-2100: worst {worst[wk]:.2e} arcsec ({wk})')
    print('        ' + ', '.join(f'{k} {v:.1e}' for k, v in sorted(worst.items())))
    with open(os.path.join(CACHE, 'solar', 'ref_rotation.json'), 'w') as fh:
        json.dump(ref, fh)

    import warnings
    import erfa
    # eraDat flags years more than five past its release (2023) as 'dubious': future leap seconds
    # are unknown, and the app, like ERFA, keeps the last value (37 s) from 2017 on.
    warnings.filterwarnings('ignore', message='.*dubious year.*')
    ls = ph['constants']['leap_seconds']
    bad = 0
    for jd, v in ls:
        y, mo, d, _ = erfa.jd2cal(jd, 0.0)
        bad += erfa.dat(y, mo, d, 0.0) != v
    check(bad == 0, f'{len(ls)} leap-second steps equal pyerfa eraDat ({ls[0][1]:.0f} s from 1972 to '
          f'{ls[-1][1]:.0f} s from JD {ls[-1][0]})')
    # Reference UTC -> TT conversions for the node test, through ERFA (dtf2d, utctai, taitt).
    # Instants are whole milliseconds from the Unix epoch (what a JavaScript Date holds), turned
    # into a calendar date and time first, because ERFA's quasi-JD stretches a leap-second day.
    import datetime
    samples = []
    rng = np.random.default_rng(79)
    ms_list = [63072000000, 78796800000, 1483228799900, 1483228800000, 946727935816]
    ms_list += [int(x) for x in rng.integers(63072000000, 2524608000000, 60)]
    for ms in ms_list:
        dt = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc) + datetime.timedelta(milliseconds=ms)
        u1, u2 = erfa.dtf2d('UTC', dt.year, dt.month, dt.day, dt.hour, dt.minute,
                            dt.second + dt.microsecond / 1e6)
        a1, a2 = erfa.utctai(u1, u2)
        t1, t2 = erfa.taitt(a1, a2)
        samples.append({'unix_ms': ms, 'jd_tt': t1 + t2})
    with open(os.path.join(CACHE, 'solar', 'ref_time.json'), 'w') as fh:
        json.dump({'samples': samples}, fh)
    check(abs(ph['constants']['au_km'] - 149597870.7) < 1e-9 and ph['constants']['obliquity_j2000_arcsec'] == 84381.406,
          f'au {ph["constants"]["au_km"]} km, obliquity {ph["constants"]["obliquity_j2000_arcsec"]} arcsec')
    sat = {r['name']: r for r in ph['rings']['saturn']}
    check(sat['A']['outer_km'] == 136780.0 and all(r['inner_km'] < r['outer_km'] for r in ph['rings']['saturn']
                                                     + ph['rings']['uranus']),
          f'rings: Saturn A outer {sat["A"]["outer_km"]} km (sat425 header), {len(ph["rings"]["uranus"])} Uranian rings')
    ob = {k: ph['bodies'][k]['obliquity_deg'] for k in ('earth', 'mars', 'uranus', 'venus')}
    check(abs(ob['earth'] - 23.44) < 0.01, 'derived obliquities ' + ', '.join(f'{k} {v}' for k, v in ob.items()))


def verify_js():
    print('js')
    for f in ('ephem.js', 'rotation.js'):
        txt = open(os.path.join(APP, 'js', f), encoding='utf-8').read()
        check('http://' not in txt and 'https://' not in txt, f'js/{f}: no URL')


if __name__ == '__main__':
    verify_ephem()
    verify_moons()
    verify_physical()
    verify_js()
    if FAIL:
        sys.exit(f'{len(FAIL)} check(s) failed')
    print('verify_solar: all checks passed')
