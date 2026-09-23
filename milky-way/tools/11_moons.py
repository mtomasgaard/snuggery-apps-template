#!/usr/bin/env python3
"""Step 11 — the major moons of Mars, Jupiter, Saturn, Uranus and Neptune as precessing-ellipse
windows fitted to JPL's satellite ephemerides.

    moons.bin    per moon, `windows` x 9 float32: a, e, varpi0, dvarpi, inc, Omega0, dOmega,
                 lambda0, n (km, rad, rad/day), moons concatenated in manifest order
    moons.json   the manifest (CONTRACT.md section 2): range, per-planet fit frames, per-moon
                 window length, byte offset, mass ratio and the error measured against the SPK

Sources are R. A. Jacobson's satellite SPKs, read whole and pinned by sha256: mar097, jup310,
sat425, ura111, nep081. The range is 1950-2050, the span all five cover (sat425 is the short one).
The Moon is not here: it comes from DE430 in step 10.

What is fitted. Each moon's position relative to its PLANET'S CENTRE (not the system barycentre),
because that is the orbit that is close to a precessing ellipse. The planet's centre itself moves
around the barycentre by up to 312 km (Saturn, mostly Titan's pull); the app rebuilds that motion
from the fitted moons and their masses, centre = -sum(mass_ratio_j * r_j), which reproduces JPL's
own planet-centre segment to 0.25 km (measured below), and hands out moon positions relative to
the barycentre, which is what DE430 gives for the planets.

The frame of each planet's fits is fixed: z along the planet's spin axis at J2000 (pck00011, full
series through CSPICE), x along that equator's ascending node on the ICRF equator. Window lengths
are chosen per moon (WINDOWS below) from a scan of 8-16 sample windows each at 146, 91, 61, 37,
24, 18, 12 and 7 days; the choice is the cheapest length that is comfortably inside the 0.5 %
target, shortened where a shorter window bought a clearly better fit for a few kilobytes. The
Uranian moons do not improve much below 37 days: their residual is real — Titania and Oberon kick
each other's eccentricity at every slow conjunction — and a 9-number ellipse cannot follow it.

The fit itself is in moonfit.py. The error of every window is measured on the stored float32
values at the fit samples and at the points between them; after that the whole range is checked
again at 20,000 random epochs per moon, as the app evaluates it (barycentric, with the rebuilt
planet centre), against the SPK.

Parallel: one process per moon (4 at a time); each moon's windows are fitted in order, each
seeded from the one before, and the results are gathered in manifest order, so the output does
not depend on scheduling. BLAS is pinned to one thread for the same reason.
"""
import os

os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('MKL_NUM_THREADS', '1')

import json
import math
import sys
import time
from multiprocessing import Pool

import numpy as np
from jplephem.spk import SPK

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
import moonfit as MF
import solar_sources as S
from paths import CACHE

JD0, JD1 = S.MOON_JD
SPAN = JD1 - JD0
N_TEST = 20000
SEED = 20260924
TARGET = 0.005             # max error / a, CONTRACT.md section 2
MULTISTART_GOAL = 0.002    # try the ring of extra starts when a window is worse than this / a

PLANETS = {  # key: (spk, barycentre id, planet id)
    'mars': ('mar097', 4, 499),
    'jupiter': ('jup310', 5, 599),
    'saturn': ('sat425', 6, 699),
    'uranus': ('ura111', 7, 799),
    'neptune': ('nep081', 8, 899),
}

# name, NAIF id, parent, windows over 1950-2050 (W = 36525 / windows days, a terminating decimal)
WINDOWS = [
    ('Phobos', 401, 'mars', 400), ('Deimos', 402, 'mars', 400),
    ('Io', 501, 'jupiter', 400), ('Europa', 502, 'jupiter', 600),
    ('Ganymede', 503, 'jupiter', 600), ('Callisto', 504, 'jupiter', 250),
    ('Mimas', 601, 'saturn', 1000), ('Enceladus', 602, 'saturn', 400),
    ('Tethys', 603, 'saturn', 400), ('Dione', 604, 'saturn', 250),
    ('Rhea', 605, 'saturn', 250), ('Titan', 606, 'saturn', 250),
    ('Hyperion', 607, 'saturn', 3000), ('Iapetus', 608, 'saturn', 250),
    ('Ariel', 701, 'uranus', 250), ('Umbriel', 702, 'uranus', 1000),
    ('Titania', 703, 'uranus', 1000), ('Oberon', 704, 'uranus', 1000),
    ('Miranda', 705, 'uranus', 250),
    ('Triton', 801, 'neptune', 250), ('Nereid', 802, 'neptune', 250),
]


def frames():
    sp = S.load_kernel_pool()
    out = {}
    for key, (_, _, pid) in PLANETS.items():
        F = S.fit_frame(sp, pid)
        out[key] = np.round(F, 12)          # exactly the matrix written to moons.json
    return out


def spk_reader(key):
    f, b, p = PLANETS[key]
    k = SPK.open(S.spk_path(f))
    seg_lo = max(s.start_jd for s in k.segments if s.center == b)
    seg_hi = min(s.end_jd for s in k.segments if s.center == b)

    def rel_centre(m, t):
        t = np.clip(t, seg_lo, seg_hi)
        return k[b, m].compute(t)[:3] - k[b, p].compute(t)[:3]

    def rel_bary(m, t):
        t = np.clip(t, seg_lo, seg_hi)
        return k[b, m].compute(t)[:3]

    def centre(t):
        t = np.clip(t, seg_lo, seg_hi)
        return k[b, p].compute(t)[:3]
    return rel_centre, rel_bary, centre, (seg_lo, seg_hi)


def fit_moon(job):
    name, naif, parent, nwin, F = job
    sp = S.load_kernel_pool()
    _, b, p = PLANETS[parent]
    rel_centre, _, _, (lo, hi) = spk_reader(parent)

    def pos(t):
        return F @ rel_centre(naif, t)

    # Mean orbital period from the data, only to set the sampling density.
    tt = np.linspace(common.J2000, common.J2000 + 400, 4001)
    r = pos(tt)
    v = np.gradient(r, tt, axis=1)
    rate = np.linalg.norm(np.cross(r.T, v.T), axis=1) / (r * r).sum(0)
    P = 2 * math.pi / float(np.median(rate))
    gm = S.pool(sp, f'BODY{p}_GM')[0] + (S.pool(sp, f'BODY{naif}_GM') or [0.0])[0]
    mu = gm * 86400.0 ** 2

    W = SPAN / nwin
    N = int(min(3000, max(128, math.ceil(16 * W / P))))
    params = np.zeros((nwin, 9))
    errs = np.zeros(nwin)
    tried = 0
    prev = None
    t0 = time.time()
    for kk in range(nwin):
        ws = JD0 + kk * W
        tc = JD0 + (kk + 0.5) * W
        tj = ws + (np.arange(N) + 0.5) * W / N
        y = pos(tj)
        fit = MF.WindowFit(tj - tc, y, W)
        a_scale = fit.scale
        starts = [MF.guess_from_data(tj - tc, y)]
        rs = pos(np.array([tc - 1e-3, tc, tc + 1e-3]))
        starts.append(MF.guess_osculating(rs[:, 1], (rs[:, 2] - rs[:, 0]) / 2e-3, mu))
        if prev is not None:
            c = prev.copy()
            c[2] += c[3] * W
            c[5] += c[6] * W
            c[7] += c[8] * W
            starts.append(c)
        c, _, nt = fit.fit(starts, MULTISTART_GOAL * a_scale)
        tried += nt
        prev = c
        c32 = MF.f32(c)
        te = np.clip(ws + np.arange(N + 1) * W / N, lo, hi)   # sat425 starts 41 s after 1950.0
        ye = pos(te)
        e1 = np.linalg.norm(MF.position(c32, te - tc) - ye, axis=0).max()
        e2 = np.linalg.norm(MF.position(c32, tj - tc) - y, axis=0).max()
        params[kk] = c32
        errs[kk] = max(e1, e2)
    return dict(name=name, naif=naif, parent=parent, nwin=nwin, W=W, N=N, period=P,
                params=params.astype('<f4'), errs=errs, tried=tried, seconds=time.time() - t0)


def main():
    t_start = time.time()
    # Fetch everything once, before any worker starts.
    for key in PLANETS:
        S.spk_path(PLANETS[key][0])
    S.pck_path()
    S.gm_path()
    F = frames()
    sp = S.load_kernel_pool()

    jobs = [(name, naif, parent, nwin, F[parent]) for name, naif, parent, nwin in WINDOWS]
    order = sorted(range(len(jobs)), key=lambda i: -jobs[i][3])   # longest jobs first
    results = [None] * len(jobs)
    with Pool(4) as pool:
        for i, res in zip(order, pool.imap(fit_moon, [jobs[i] for i in order])):
            results[i] = res
            print(f'  {res["name"]:9s} {res["nwin"]:5d} windows of {res["W"]:8.4f} d, {res["N"]:4d} samples, '
                  f'worst window {res["errs"].max():9.2f} km, {res["tried"]} fits, {res["seconds"]:.0f} s',
                  flush=True)

    # Mass ratios for the planet-centre reflex: GM_moon / GM_system (gm_de440).
    blob = bytearray()
    moons = []
    for res in results:
        _, b, _ = PLANETS[res['parent']]
        gm_sys = S.pool(sp, f'BODY{b}_GM')[0]
        gm = S.pool(sp, f'BODY{res["naif"]}_GM')
        res['mass_ratio'] = (gm[0] / gm_sys) if gm else 0.0
        res['offset'] = len(blob)
        blob += res['params'].tobytes()
        moons.append(res)

    # Whole-range check at random epochs, as the app evaluates it.
    rng = np.random.default_rng(SEED)
    check = {}
    ref = {'jd_start': JD0, 'jd_end': JD1, 'moons': {}, 'centres': {}}
    for key in PLANETS:
        rel_centre, rel_bary, centre, (lo, hi) = spk_reader(key)
        mine = [m for m in moons if m['parent'] == key]
        T = np.sort(rng.uniform(max(JD0, lo), min(JD1, hi), N_TEST))
        fitc = {m['name']: evaluate_centre(m, F[key], T) for m in mine}
        c_model = -sum(m['mass_ratio'] * fitc[m['name']] for m in mine)
        c_err = np.linalg.norm(c_model - centre(T), axis=0).max()
        # the reflex formula with the SPK's own moon positions: how much the formula itself costs
        c_formula = -sum(m['mass_ratio'] * rel_centre(m['naif'], T) for m in mine)
        c_formula_err = np.linalg.norm(c_formula - centre(T), axis=0).max()
        print(f'  {key:8s} planet centre from the fitted moons: max error {c_err:.3f} km '
              f'(formula with SPK moons {c_formula_err:.3f} km; centre offset up to '
              f'{np.linalg.norm(centre(T), axis=0).max():.1f} km)')
        check[key] = dict(centre_err=c_err, centre_formula_err=c_formula_err)
        for m in mine:
            truth_b = rel_bary(m['naif'], T)
            est_b = fitc[m['name']] + c_model
            eb = np.linalg.norm(est_b - truth_b, axis=0)
            ec = np.linalg.norm(fitc[m['name']] - rel_centre(m['naif'], T), axis=0)
            a_mean = float(m['params'][:, 0].astype(np.float64).mean())
            m.update(a_km=a_mean, err_bary=float(eb.max()), err_bary_p99=float(np.percentile(eb, 99)),
                     err_centre=float(ec.max()), frac=float(eb.max()) / a_mean)
            flag = 'OK ' if m['frac'] <= TARGET else 'MISS'
            print(f'  {flag} {m["name"]:9s} a {a_mean:11.1f} km  max {eb.max():9.2f} km '
                  f'({100 * m["frac"]:.4f} %)  p99 {np.percentile(eb, 99):8.2f}  '
                  f'rel. centre {ec.max():9.2f}  windows {m["errs"].max():9.2f}')
        # Reference values for tools/test_ephem.mjs (not shipped).
        tr = T[:: N_TEST // 300][:300]
        ref['centres'][key] = centre(tr).T.tolist()
        for m in mine:
            ref['moons'][m['name']] = {'jd': tr.tolist(), 'spk_bary': rel_bary(m['naif'], tr).T.tolist(),
                                       'model_bary': (evaluate_centre(m, F[key], tr) - sum(
                                           mm['mass_ratio'] * evaluate_centre(mm, F[key], tr)
                                           for mm in mine)).T.tolist(),
                                       'max_error_km': m['err_bary']}

    missed = [m['name'] for m in moons if m['frac'] > TARGET]
    if missed:
        sys.exit(f'moons missing the {100 * TARGET} % target: {missed} — drop them from WINDOWS')

    manifest = {
        'source': ['mar097.bsp', 'jup310.bsp', 'sat425.bsp', 'ura111.bsp', 'nep081.bsp'],
        'jd_start': JD0, 'jd_end': JD1, 'time_scale': 'TDB', 'units': 'km, rad, rad/day',
        'frames': {k: v.tolist() for k, v in F.items()},
        'record': ['a', 'e', 'varpi0', 'dvarpi', 'inc', 'Omega0', 'dOmega', 'lambda0', 'n'],
        'fit_center': 'planet',
        'moons': [{
            'name': m['name'], 'naif': m['naif'], 'parent': m['parent'], 'window_days': m['W'],
            'windows': m['nwin'], 'offset': m['offset'], 'a_km': round(m['a_km'], 1),
            'mass_ratio': m['mass_ratio'], 'max_error_km': round(m['err_bary'], 2),
            'max_error_frac': round(m['frac'], 7), 'p99_error_km': round(m['err_bary_p99'], 2),
        } for m in moons],
        'centre_error_km': {k: round(v['centre_err'], 3) for k, v in check.items()},
        'error_epochs': N_TEST,
        'note': ('Precessing Keplerian ellipses least-squares fitted per window to R. A. Jacobson\'s '
                 'JPL satellite ephemerides, relative to the planet\'s centre; positions relative '
                 'to the system barycentre add centre = -sum(mass_ratio * r). A fitted model of the '
                 'JPL ephemeris, not the ephemeris itself.'),
    }
    common.write_bin('moons.bin', bytes(blob))
    common.write_json('moons.json', manifest, ndigits=12)
    with open(os.path.join(CACHE, 'solar', 'ref_moons.json'), 'w') as fh:
        json.dump(ref, fh)
    print(f'moons.bin {len(blob)} bytes, {sum(m["nwin"] for m in moons)} windows, '
          f'{time.time() - t_start:.0f} s')


def evaluate_centre(m, F, T):
    """Moon relative to the planet's centre, ICRF, from the stored float32 windows."""
    W = m['W']
    k = np.clip(np.floor((T - JD0) / W).astype(int), 0, m['nwin'] - 1)
    tc = JD0 + (k + 0.5) * W
    C = m['params'][k].astype(np.float64)
    return F.T @ MF.position_many(C, T - tc)


if __name__ == '__main__':
    main()
