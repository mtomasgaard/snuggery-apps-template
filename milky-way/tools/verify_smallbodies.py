#!/usr/bin/env python3
"""Checks data/smallbodies.json + smallbodies.bin (CONTRACT.md section 4) and exports the reference
positions tools/test_smallbodies.mjs compares js/smallbodies.js against.

The reference propagator here is independent of the shipped model (20_smallbodies.py and
js/smallbodies.js solve Kepler's equation in the eccentric / hyperbolic anomaly, or Barker's
equation). This one starts from the state vector at perihelion — r0 = q P, v0 = sqrt(mu (1+e)/q) Q —
and propagates it with the universal-variable formulation (Stumpff functions C(z), S(z), Lagrange f
and g), one formula for every conic, solved by safeguarded Newton on the universal anomaly.

Printed and asserted:
  * layout: columns contiguous and aligned, sizes, index ranges, the byte budget (700,000 B);
  * physics: |P| = |Q| = 1 and P.Q = 0 to float32 precision, q > 0, e >= 0, finite tp;
  * selection: Pluto, (2002 PD153) and the SBDB copy of A/2024 U2 absent, A/2024 U2 once (MPC);
  * frame: our ecliptic -> ICRF rotation against CSPICE's built-in ECLIPJ2000 frame;
  * constants: k against SBDB's own periods (per_y), MPC calendar dates against astropy Time;
  * the shipped model against the universal-variable propagation of the same stored numbers at
    eight epochs 1900-2100 (every row), and the storage error (float32 elements against the
    full-precision source elements);
  * the drift figures in the file against a fresh computation from JPL Horizons' elements.
Writes tools/.cache/smallbodies/ref_smallbodies.json + ref_smallbodies.bin (not shipped).
"""
import importlib.util
import json
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import smallbodies_sources as SB
from common import J2000
from paths import APP, CACHE, DATA, TOOLS

spec = importlib.util.spec_from_file_location('step20', os.path.join(TOOLS, '20_smallbodies.py'))
step = importlib.util.module_from_spec(spec)
spec.loader.exec_module(step)

EPOCHS = [2415020.5, 2433282.5, 2442413.5, 2451545.0, 2461000.5, 2461306.5, 2469807.5, 2488069.5]
EPOCH_LABELS = ['1900-01-01', '1950-01-01', '1975-01-01', '2000-01-01.5', '2025-11-21', '2026-09-23',
                '2050-01-01', '2100-01-01']
fails = []


def check(ok, msg):
    print(('  ok    ' if ok else '  FAIL  ') + msg)
    if not ok:
        fails.append(msg)


# ------------------------------------------------------------------------ universal variables
def stumpff(z):
    """C(z), S(z) for arrays, with series near z = 0 (no cancellation)."""
    z = np.asarray(z, np.float64)
    C = np.empty_like(z)
    S = np.empty_like(z)
    small = np.abs(z) < 1e-2
    zs = z[small]
    C[small] = 1 / 2 - zs / 24 + zs ** 2 / 720 - zs ** 3 / 40320 + zs ** 4 / 3628800
    S[small] = 1 / 6 - zs / 120 + zs ** 2 / 5040 - zs ** 3 / 362880 + zs ** 4 / 39916800
    pos = (~small) & (z > 0)
    sz = np.sqrt(z[pos])
    C[pos] = (1 - np.cos(sz)) / z[pos]
    S[pos] = (sz - np.sin(sz)) / sz ** 3
    neg = (~small) & (z < 0)
    sz = np.sqrt(-z[neg])
    C[neg] = (np.cosh(sz) - 1) / -z[neg]
    S[neg] = (np.sinh(sz) - sz) / sz ** 3
    return C, S


def uv_positions(q, e, tp, P, Q, jd, mu):
    """Universal-variable propagation from perihelion. q, e, tp (days from J2000): (N,); P, Q:
    (N, 3). Returns (N, 3) heliocentric positions in au at JD `jd`."""
    q = np.asarray(q, np.float64)
    e = np.asarray(e, np.float64)
    smu = math.sqrt(mu)
    alpha = (1 - e) / q                                   # 1/a
    dt = jd - J2000 - np.asarray(tp, np.float64)
    ell = alpha > 0
    with np.errstate(divide='ignore', invalid='ignore'):
        T = np.where(ell, 2 * np.pi / np.sqrt(mu * np.abs(alpha) ** 3), np.inf)
        dt = np.where(ell, dt - T * np.round(dt / T), dt)
    sgn = np.where(dt < 0, -1.0, 1.0)
    tt = smu * np.abs(dt)
    # F(chi) = (1 - alpha q) chi^3 S + q chi - tt is increasing and F >= q chi - tt, so the root is
    # in [0, tt/q]; for an ellipse also z <= pi^2 (|dt| <= half a period), for a hyperbola the
    # bracket is capped at a hyperbolic anomaly of 600 (far beyond any case here) so cosh stays finite.
    lo = np.zeros_like(q)
    hi = tt / q
    with np.errstate(divide='ignore', invalid='ignore'):
        cap = np.where(ell, np.pi, 600.0) / np.sqrt(np.where(alpha != 0, np.abs(alpha), 1.0))
        hi = np.where(alpha != 0, np.minimum(hi, cap), hi)
    # Safeguarded Newton (as rtsafe in Numerical Recipes): take the Newton step only when it stays
    # inside the bracket and at least halves the step before last; otherwise bisect.
    chi = 0.5 * (lo + hi)
    dx = dxold = hi - lo
    for _ in range(400):
        z = alpha * chi * chi
        C, S = stumpff(z)
        F = (1 - alpha * q) * chi ** 3 * S + q * chi - tt
        r = chi * chi * C + q * (1 - z * C)
        lo = np.where(F < 0, chi, lo)
        hi = np.where(F > 0, chi, hi)
        with np.errstate(invalid='ignore', over='ignore'):
            newton = chi - F / r
            bis = ~((newton > lo) & (newton < hi)) | (np.abs(2 * F) > np.abs(dxold * r))
        dxold = dx
        dx = np.where(bis, 0.5 * (hi - lo), F / r)
        chi = np.where(bis, lo + 0.5 * (hi - lo), newton)
        if np.all((np.abs(dx) <= 1e-16 * np.maximum(chi, 1e-300)) | (F == 0)):
            break
    chi = chi * sgn
    z = alpha * chi * chi
    C, S = stumpff(z)
    f = 1 - chi * chi * C / q
    g = sgn * np.abs(dt) - chi ** 3 * S / smu
    v0 = np.sqrt(mu * (1 + e) / q)
    return f[:, None] * (q[:, None] * P) + (g * v0)[:, None] * Q


def main():
    m = json.load(open(os.path.join(DATA, 'smallbodies.json'), encoding='utf-8'))
    raw = open(os.path.join(DATA, 'smallbodies.bin'), 'rb').read()
    n = m['count']
    jb = os.path.getsize(os.path.join(DATA, 'smallbodies.json'))
    print(f'smallbodies: {n:,} rows; json {jb:,} B + bin {len(raw):,} B = {jb + len(raw):,} B')
    check(jb + len(raw) <= 700_000, f'within the 700,000 B budget ({700_000 - jb - len(raw):,} B spare)')

    # ---- layout
    size = {'f32': 4, 'f64': 8, 'u8': 1}
    dt_ = {'f32': '<f4', 'f64': '<f8', 'u8': 'u1'}
    off, col = 0, {}
    for c in m['columns']:
        ok = c['offset'] == off and c['offset'] % size[c['type']] == 0 and c['length'] == n * c['per_row']
        check(ok, f"column {c['name']:5s} {c['type']} x{c['per_row']} at {c['offset']:,} ({c['bytes']:,} B)")
        col[c['name']] = np.frombuffer(raw, dt_[c['type']], c['length'], c['offset']).astype(
            np.float64 if c['type'] != 'u8' else np.uint8)
        off += c['bytes']
    check(off == len(raw), f'columns fill the file exactly ({off:,} B)')
    check(len(m['names']) == n and all(isinstance(s, str) and s for s in m['names']), 'a non-empty name for every row')
    q, e, tp = col['q'], col['e'], col['tp']
    P, Q = col['P'].reshape(n, 3), col['Q'].reshape(n, 3)
    H, kind, flags = col['H'], col['kind'], col['flags']
    check(set(np.unique(kind).tolist()) <= {int(k) for k in m['kinds']}, 'every kind code is in kinds')
    src_rows = sorted((s['first'], s['first'] + s['count']) for s in m['sources'])
    check(src_rows[0][0] == 0 and src_rows[-1][1] == n and all(a[1] == b[0] for a, b in zip(src_rows, src_rows[1:])),
          'source ranges tile 0..count')
    ep_idx = [i for v in m['epochs'].values() for i in v]
    check(len(ep_idx) == len(set(ep_idx)) and all(0 <= i < n for i in ep_idx), f'{len(ep_idx):,} per-row epochs, valid indices')
    check(all(0 <= i < n for i in m['labelled']) and all(0 <= int(i) < n for i in m['info']) and
          all(0 <= int(i) < n for i in m['diameter_km']), f"{len(m['labelled'])} labelled rows, "
          f"{len(m['info'])} info rows, {len(m['diameter_km']):,} diameters: valid indices")

    # ---- physics of the stored numbers
    nP, nQ, pq = np.linalg.norm(P, axis=1), np.linalg.norm(Q, axis=1), np.abs(np.einsum('ij,ij->i', P, Q))
    check(np.abs(nP - 1).max() < 3e-7 and np.abs(nQ - 1).max() < 3e-7 and pq.max() < 3e-7,
          f'|P|-1 max {np.abs(nP - 1).max():.1e}, |Q|-1 max {np.abs(nQ - 1).max():.1e}, |P.Q| max {pq.max():.1e}')
    check(bool((q > 0).all() and (e >= 0).all() and np.isfinite(tp).all()),
          f'q {q.min():.4f}..{q.max():.1f} au, e {e.min():.2e}..{e.max():.3f}, tp finite')
    kinds = {int(k): v for k, v in m['kinds'].items()}
    counts = {kinds[k]: int((kind == k).sum()) for k in sorted(kinds)}
    print('  kinds: ' + ', '.join(f'{k} {v:,}' for k, v in counts.items()))
    print(f"  weak-orbit flag {int((flags & 1).astype(bool).sum()):,}; no epoch {int((flags & 2).astype(bool).sum())}; "
          f"H unknown {int(np.isnan(H).sum())}; open orbits (e >= 1) {int((e >= 1).sum())}")
    weak_kinds = sorted({kinds[int(x)] for x in kind[(flags & 1).astype(bool)]})
    check(set(weak_kinds) <= {'tno', 'centaur'}, f'weak-orbit flags only on {weak_kinds}')
    names = m['names']
    check(not any('Pluto' in s for s in names), 'Pluto not in the file (DE430 draws it)')
    check('(2002 PD153)' not in names, '(2002 PD153) (e = 0, no mean anomaly) dropped')
    check(names.count('A/2024 U2') == 1 and '(A/2024 U2)' not in names, 'A/2024 U2 once, from the MPC list')
    i_u2 = names.index('A/2024 U2')
    check(e[i_u2] > 1, f'A/2024 U2 kept hyperbolic (e = {e[i_u2]:.6f})')
    check(counts.get('dwarf') == 8, 'eight dwarf planets (Celestia\'s grouping, Pluto excluded)')
    check(len(set(names)) == n, 'names unique')
    for want in ['1P/Halley', '2P/Encke', '67P/Churyumov-Gerasimenko', 'C/1995 O1 (Hale-Bopp)', '109P/Swift-Tuttle',
                 '1I/ʻOumuamua', '2I/Borisov', '3I/ATLAS', '1 Ceres', '4 Vesta', '99942 Apophis',
                 '101955 Bennu', '486958 Arrokoth', '136199 Eris']:
        if want not in names or names.index(want) not in m['labelled']:
            check(False, f'{want} present and labelled')
    check(all(('2061-07-28' not in json.dumps(v)) for v in m.values()), 'no from-memory Halley date anywhere')

    # ---- frame and constants
    import spiceypy as sp
    R = np.array(SB.ecl_to_icrf(m['obliquity_arcsec']))
    Rs = np.array(sp.pxform('ECLIPJ2000', 'J2000', 0.0))
    ang = math.degrees(math.acos(min(1.0, (np.trace(R.T @ Rs) - 1) / 2))) * 3600
    check(ang < 1e-9, f'ecliptic -> ICRF rotation = CSPICE ECLIPJ2000 to {ang:.1e}" (obliquity {m["obliquity_arcsec"]}")')
    rows_src = step.sbdb_rows('asteroids')
    k = m['k_gauss_au15_day']
    rel, rel_e = [], []
    for r in rows_src:
        a, per = SB.num(r['a']), SB.num(SB.field(r, 'per_y'))
        if a and per and a > 0:
            (rel if r['orbit_id'].startswith('JPL') else rel_e).append(abs(2 * math.pi / (k / a ** 1.5) / 365.25 / per - 1))
    rel, rel_e = np.array(rel), np.array(rel_e)
    check(np.median(rel) < 1e-12 and np.percentile(rel, 99) < 1e-10,
          f'k agrees with SBDB\'s own periods for its {len(rel):,} JPL-computed orbits: |P_ours/P_sbdb - 1| '
          f'median {np.median(rel):.1e}, 99th percentile {np.percentile(rel, 99):.1e}, max {rel.max():.1e}')
    print(f'  (the {len(rel_e)} orbits with non-JPL orbit ids, "E2026D54" etc., print a with ~10 digits: '
          f'median {np.median(rel_e):.1e}, max {rel_e.max():.1e})')
    from astropy.time import Time
    import gzip
    with gzip.open(SB.path('cometels'), 'rt', encoding='utf-8') as f:
        mpc = json.load(f)
    worst = 0.0
    for c in mpc:
        y, mo, d = c['Year_of_perihelion'], c['Month_of_perihelion'], c['Day_of_perihelion']
        ref = Time(f'{y:04d}-{mo:02d}-{int(d):02d}', scale='tt').jd + (d - int(d))
        worst = max(worst, abs(SB.jd_from_calendar(y, mo, d) - ref))
    check(worst < 1e-8, f'MPC perihelion dates -> JD against astropy Time: max {worst * 86400:.1e} s')

    # ---- full-precision rows from the sources, in the shipped order
    rows, C = step.build()
    phys = os.path.join(DATA, 'physical.json')
    k_phys = (json.load(open(phys, encoding='utf-8'))['constants']['k_gauss_au15_day'] if os.path.exists(phys)
              else C['k_gauss_au15_day'])
    check(m['k_gauss_au15_day'] == C['k_gauss_au15_day'] == k_phys,
          f"k in the file written in full ({m['k_gauss_au15_day']!r}; = the tp computation's, = physical.json's)")
    order = {s[0]: i for i, s in enumerate(step.SOURCES)}
    rows.sort(key=lambda r: order[r['src']])
    check([r['name'] for r in rows] == names, 'rebuilding from the sources gives the same rows in the same order')
    q64 = np.array([r['q'] for r in rows])
    e64 = np.array([r['e'] for r in rows])
    tp64 = np.array([r['tp'] - J2000 for r in rows])
    P64 = np.array([r['P'] for r in rows])
    Q64 = np.array([r['Q'] for r in rows])
    check(np.array_equal(tp64, tp), 'tp stored as float64 exactly')
    mu = k * k

    # ---- the model (Python twin of the JS) against universal variables; storage error
    ref_pos = np.zeros((len(EPOCHS), n, 3))
    print('  epoch          model vs UV (same stored numbers)      stored float32 vs full precision (UV)')
    worst_model, worst_store, worst_store_rel = 0.0, {}, 0.0
    for j, jd in enumerate(EPOCHS):
        uv = uv_positions(q, e, tp, P, Q, jd, mu)
        mod = step.model_positions(q, e, tp, P, Q, jd, k)
        full = uv_positions(q64, e64, tp64, P64, Q64, jd, mu)
        ref_pos[j] = uv
        r = np.linalg.norm(uv, axis=1)
        dm = np.linalg.norm(mod - uv, axis=1)
        ds = np.linalg.norm(uv - full, axis=1)
        worst_model = max(worst_model, float((dm / r).max()))
        worst_store_rel = max(worst_store_rel, float((ds / r).max()))
        for kc, kn in kinds.items():
            sel = kind == kc
            if sel.any():
                worst_store[kn] = max(worst_store.get(kn, 0.0), float(ds[sel].max()))
        print(f'  {EPOCH_LABELS[j]:13s}  max {dm.max():.1e} au, rel {(dm / r).max():.1e}'
              f'             max {ds.max():.1e} au (row {int(ds.argmax())}: {names[int(ds.argmax())]})')
    check(worst_model < 1e-10, f'model = universal variables to {worst_model:.1e} (relative), every row, 8 epochs')
    print('  float32 storage error, worst per kind over the 8 epochs: ' +
          ', '.join(f'{kn} {v:.1e} au' for kn, v in worst_store.items()))
    check(worst_store_rel < 3e-4, f'float32 storage error at most {worst_store_rel:.1e} of the distance '
          '(1900-2100; far below the two-body drift)')

    # ---- drift figures: recompute and compare with the file
    stored = (q, e, tp, P, Q)
    drift = step.measure_drift(rows, C, stored)
    same = json.dumps(drift, sort_keys=True) == json.dumps(m['accuracy'], sort_keys=True) or all(
        abs(drift['horizons_big4'][nm]['bins'][b]['max_au'] - m['accuracy']['horizons_big4'][nm]['bins'][b]['max_au']) < 1e-9
        for nm in drift['horizons_big4'] for b in drift['horizons_big4'][nm]['bins'])
    check(same, 'accuracy figures in the file reproduce')
    near = max(v['nearest_epoch_err_au'] for v in drift['horizons_big4'].values())
    check(near < 2e-5, f'Ceres/Pallas/Juno/Vesta within {near:.1e} au of JPL Horizons 49 days from the epoch')

    # ---- Horizons reference points for the node test (big four at the nearest yearly epochs)
    with open(SB.path('horizons_big4'), encoding='utf-8') as f:
        big4 = json.load(f)
    rot = SB.ecl_to_icrf(m['obliquity_arcsec'])
    hz = []
    for ast in big4['asteroids']:
        i = names.index(re.sub(r' \(.*\)$', '', ast['name']))
        pts = []
        for jd in [2415020.5, 2433282.5, 2442413.5, 2451545.0, 2457000.5, 2460951.1, 2463000.5, 2469807.5, 2488069.5]:
            el = min(ast['elements'], key=lambda x: abs(x['epoch_jde'] - jd))
            pts.append({'jd': el['epoch_jde'], 'pos': step.horizons_elements_pos(el, rot, k, el['epoch_jde']).tolist()})
        ep = next((float(jd) for jd, rr in m['epochs'].items() if i in rr), None)
        ep = ep if ep is not None else next(s['epoch_jd'] for s in m['sources'] if s['first'] <= i < s['first'] + s['count'])
        hz.append({'row': i, 'name': names[i], 'epoch': ep, 'points': pts})

    # ---- synthetic orbits: every branch of the solver, including e == 1 exactly (not data)
    syn = [(1.0, 1.0), (0.5, 0.99999994), (0.3, 1.0000001), (2.0, 0.0), (1.2, 0.5), (1.35, 6.14), (0.0078, 0.999915),
           (40.0, 0.25)]
    rng = np.random.default_rng(20)
    sq = np.array([s[0] for s in syn])
    se = np.array([s[1] for s in syn], np.float32).astype(np.float64)
    ang3 = rng.uniform(0, 2 * np.pi, (len(syn), 3))
    sP, sQ = [], []
    for (i_, om, w) in ang3:
        p_, q_ = step.elements_to_pq(math.degrees(i_ / 2), math.degrees(om), math.degrees(w), np.eye(3).tolist())
        sP.append(p_)
        sQ.append(q_)
    sP = np.array(sP, np.float32).astype(np.float64)
    sQ = np.array(sQ, np.float32).astype(np.float64)
    sq = sq.astype(np.float32).astype(np.float64)
    stp = np.array([0.0, 100.0, -50.0, 3000.0, 9000.0, 9433.0, -12500.0, 6000.0])
    syn_dts = [-36525.0, -3650.0, -40.0, -0.5, 0.0, 0.3, 12.0, 400.0, 7300.0, 36525.0]
    syn_pos = [uv_positions(sq, se, stp, sP, sQ, J2000 + d, mu).tolist() for d in syn_dts]

    os.makedirs(os.path.join(CACHE, 'smallbodies'), exist_ok=True)
    ref_bin = os.path.join(CACHE, 'smallbodies', 'ref_smallbodies.bin')
    ref_pos.astype('<f8').tofile(ref_bin)
    with open(os.path.join(CACHE, 'smallbodies', 'ref_smallbodies.json'), 'w', encoding='utf-8') as f:
        json.dump({'epochs': EPOCHS, 'labels': EPOCH_LABELS, 'count': n, 'layout': '[epoch][row][xyz] float64 little-endian',
                   'model_vs_uv_rel': worst_model, 'horizons': hz,
                   'synthetic': {'q': sq.tolist(), 'e': se.tolist(), 'tp': stp.tolist(), 'P': sP.tolist(),
                                 'Q': sQ.tolist(), 'dt': syn_dts, 'pos': syn_pos}}, f)
    print(f'  wrote {os.path.relpath(ref_bin, TOOLS)} ({os.path.getsize(ref_bin):,} B) and ref_smallbodies.json')

    # ---- the app code carries no URL
    js = open(os.path.join(APP, 'js', 'smallbodies.js'), encoding='utf-8').read()
    check(not re.search(r'https?://', js), 'js/smallbodies.js has no URL')

    if fails:
        sys.exit(f'{len(fails)} check(s) failed')
    print('smallbodies: all checks passed')


if __name__ == '__main__':
    main()
