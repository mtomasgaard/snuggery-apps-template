#!/usr/bin/env python3
"""Checks the star files the app relies on (CONTRACT.md section 7) and prints what it measured.

Reads only data/stars/*. Exits non-zero on the first failed assertion. Also writes a small fixture
(tools/.cache/work/stars_fixture.json) of decoded records that tools/test_stars.mjs compares
its own JavaScript decoding against.
"""
import json
import math
import os
import sys

import numpy as np

from paths import DATA, WORK

S = os.path.join(DATA, 'stars')
fails = []


def check(cond, msg):
    print(('  ok    ' if cond else '  FAIL  ') + msg)
    if not cond:
        fails.append(msg)


def load(name):
    with open(os.path.join(S, name), encoding='utf-8') as f:
        return json.load(f)


def main():
    print('verify_stars')
    sizes = {f: os.path.getsize(os.path.join(S, f)) for f in sorted(os.listdir(S))}
    for f, b in sizes.items():
        print(f'  {f:22s} {b:>9,d} B')
    small = sizes['named.json'] + sizes['constellations.json'] + sizes['exoplanets.json']
    check(sizes['deep.bin'] <= 1_900_000, f'deep.bin {sizes["deep.bin"]:,} B <= 1,900,000')
    check(small <= 900_000, f'named + constellations + exoplanets {small:,} B <= 900,000')

    # ---------------- colour table
    col = load('colour.json')
    T = col['teff_k']
    srgb = np.array(col['srgb'])
    lin = np.array(col['linear'])
    check(len(T) == 256 and srgb.shape == (256, 3) and lin.shape == (256, 3), 'colour.json has 256 entries')
    check(T[255] is None and col['unknown_index'] == 255, 'entry 255 is the no-colour entry')
    t = np.array(T[:255], float)
    check(np.all(np.diff(t) > 0), f'temperatures increase, {t[0]:.0f} K .. {t[-1]:.0f} K, '
          f'step {100 * (t[1] / t[0] - 1):.2f} %')
    check(np.all((srgb >= 0) & (srgb <= 1)) and np.allclose(srgb.max(1), 1), 'sRGB in 0..1, max channel 1')
    br = lin[:255, 2] - lin[:255, 0]
    check(np.all(np.diff(br) >= -1e-4), 'blue minus red never decreases with temperature')

    def lut(teff):
        return int(round(254 * math.log(min(max(teff, t[0]), t[-1]) / t[0]) / math.log(t[-1] / t[0])))
    for name, teff in (('M dwarf 3000 K', 3000), ('Sun-like 5770 K', 5770), ('A0 9700 K', 9700),
                       ('B2 20600 K', 20600)):
        c = srgb[lut(teff)]
        print(f'    {name:16s} -> #{"".join(f"{int(round(v * 255)):02x}" for v in c)}')
    sun = srgb[lut(5770)]
    check(sun[0] >= sun[2] and sun[2] > 0.8, 'a 5770 K blackbody is near white, slightly warm')

    # ---------------- deep cloud
    dj = load('deep.json')
    raw = open(os.path.join(S, 'deep.bin'), 'rb').read()
    check(len(raw) == dj['count'] * dj['record_bytes'] == dj['count'] * 8,
          f'deep.bin = {dj["count"]:,} records x 8 B')
    rec = np.frombuffer(raw, dtype=[('x', '<i2'), ('y', '<i2'), ('z', '<i2'), ('m', 'u1'), ('c', 'u1')])
    xyz = np.stack([rec['x'], rec['y'], rec['z']], 1) / dj['units_per_pc']
    r = np.linalg.norm(xyz, axis=1)
    mv = rec['m'] / 10 - 8
    print(f'    distance {r.min():.2f} .. {r.max():.2f} pc, median {np.median(r):.1f} pc; '
          f'M_V {mv.min():.1f} .. {mv.max():.1f}, median {np.median(mv):.1f}')
    check(r.max() <= 500.01, 'every deep star within 500 pc')
    check(r.min() > 20 - 0.02, f'no deep star within 20 pc (all of those are named), min {r.min():.2f} pc')
    check(np.all(np.diff(rec['m'].astype(int)) >= 0), 'deep.bin sorted by absmag_code')
    for k, n in dj['mv_prefix'].items():
        if n and n < len(rec):
            assert rec['m'][n - 1] <= (int(k) + 8) * 10 < rec['m'][n], k
    check(True, f'mv_prefix consistent (e.g. {dj["mv_prefix"]["0"]:,} stars with M_V <= 0)')
    unk = int((rec['c'] == 255).sum())
    print(f'    colour codes: {len(np.unique(rec["c"]))} distinct, {unk:,} without colour '
          f'({100 * unk / len(rec):.2f} %)')
    print(f'    distance sources: {dj["dist_src_counts"]}')

    # ---------------- named stars
    nm = load('named.json')
    n = nm['count']
    cols = ['id', 'name', 'desig', 'con', 'x', 'y', 'z', 'vmag', 'absmag', 'colour', 'spect',
            'dist_src', 'flags']
    check(all(len(nm[c]) == n for c in cols), f'named.json: {n:,} rows, all {len(cols)} columns equal length')
    check(len(set(nm['id'])) == n, 'named ids unique')
    X = np.array([nm['x'], nm['y'], nm['z']], float).T
    R = np.linalg.norm(X, axis=1)
    F = np.array(nm['flags'])
    DS = np.array(nm['dist_src'])
    unplaced = (F & 16) != 0
    check(np.allclose(R[unplaced], 1, atol=2e-4), f'{unplaced.sum()} unplaced rows carry unit directions')
    check(all(nm['absmag'][i] is None for i in np.where(unplaced)[0]), 'unplaced rows have no absmag')
    am = np.array([np.nan if a is None else a for a in nm['absmag']])
    vm = np.array([np.nan if v is None else v for v in nm['vmag']])
    ok = ~unplaced & np.isfinite(am) & np.isfinite(vm)
    resid = am[ok] - (vm[ok] + 5 - 5 * np.log10(R[ok]))
    check(np.abs(resid).max() < 0.06, f'absmag = V + 5 - 5 log10 r (max |diff| {np.abs(resid).max():.3f}, rounding)')
    vs = [v for v in nm['vmag'] if v is not None]
    check(vs == sorted(vs), 'named rows sorted by V')
    labels = nm['dist_src_labels']
    near = ~unplaced & (R <= 20.0005)
    print(f'    within 20 pc: {near.sum():,} rows; by distance source: '
          + ', '.join(f'{labels[k]} {int(((DS == k) & near).sum())}' for k in range(len(labels))))
    for b in range(7):
        print(f'    flag bit {b}: {int(((F >> b) & 1).sum()):>5d}  {nm["flag_bits"][str(b)]}')
    check(int(((F & 2) != 0).sum()) > 80, 'white dwarfs present')

    def row(ident=None, name=None):
        for i in range(n):
            if (ident and nm['id'][i] == ident) or (name and nm['name'][i] == name):
                return i
        return None

    def desc(i):
        return (f'{nm["id"][i]} "{nm["name"][i]}" {nm["desig"][i]} r={R[i]:.4f} pc V={nm["vmag"][i]} '
                f'M={nm["absmag"][i]} {nm["spect"][i]} [{labels[nm["dist_src"][i]]}] flags={F[i]:#09b}')

    exo = load('exoplanets.json')
    planets = {int(k): [p[0] for p in v] for k, v in exo['hosts'].items()}

    spots = [('HIP 32349', 'Sirius', 2.6371, 0.005), ('HIP 70890', 'Proxima Centauri', 1.302, 0.002),
             ('HIP 71683', 'Rigil Kentaurus', 1.3248, 0.03), ('HIP 71681', 'Toliman', 1.3248, 0.03),
             ('HIP 87937', "Barnard's Star", 1.828, 0.003), ('HIP 91262', 'Vega', 7.68, 0.03),
             ('HIP 27989', 'Betelgeuse', 152.7, 5), ('HIP 11767', 'Polaris', 132.6, 3),
             ('Gl 406', 'Wolf 359', 2.408, 0.005), ('HIP 16537', 'Ran', 3.22, 0.01)]
    for ident, name, dist, tol in spots:
        i = row(ident=ident)
        check(i is not None and nm['name'][i] == name and abs(R[i] - dist) <= tol,
              f'{name}: {desc(i) if i is not None else "missing"}')
    si = row(ident='HIP 32349')
    check(nm['desig'][si] == 'α CMa' and F[si] & 32, 'Sirius is α CMa with an IAU name')
    b = row(ident='Gl 244B')
    check(b is not None and F[b] & 2 and F[b] & 4 and abs(R[b] - R[si]) < 1e-3,
          f'Sirius B as a white-dwarf companion at Sirius\'s distance: {desc(b)}')
    p = row(ident='HIP 70890')
    check(F[p] & 1 and {'Proxima Centauri b', 'Proxima Centauri d'} <= set(planets.get(p, [])),
          f'Proxima is a host: {planets.get(p)}')
    k = row(ident='HIP 87937')
    check(not F[k] & 1, "Barnard's Star lists no confirmed planet in this OEC snapshot")
    e = row(name='Ran')
    check(not F[e] & 1, 'eps Eri b is "Controversial" in OEC, so eps Eri is not a host here')
    tc = row(ident='HIP 8102')
    check(tc is not None and planets.get(tc) and all(x[-1] in 'efgh' for x in planets[tc]),
          f'tau Ceti planets: {planets.get(tc)} (b, c, d are retracted)')
    tr = row(ident='TRAPPIST-1')
    check(tr is not None and len(planets.get(tr, [])) == 7 and abs(R[tr] - 12.43) < 0.1
          and labels[DS[tr]] == 'Open Exoplanet Catalogue',
          f'TRAPPIST-1 placed from OEC with 7 planets: {desc(tr)}')
    te = row(name="Teegarden's Star")
    check(te is not None and abs(R[te] - 3.83) < 0.05, f"Teegarden's Star from OEC: {desc(te) if te is not None else 'missing'}")
    pg = row(ident='HIP 113357')
    check(pg is not None and '51 Peg b' in ' '.join(planets.get(pg, [])) or
          any('51 Peg' in x for x in planets.get(pg, [])), f'51 Peg: {planets.get(pg)}')

    # Pleiades: the brightest members, and the cluster as a whole from every star we ship
    al = row(name='Alcyone')
    ua = X[al] / R[al]
    print('    Pleiades, brightest members:')
    for nme in ('Alcyone', 'Atlas', 'Electra', 'Maia', 'Merope', 'Taygeta', 'Pleione'):
        j = row(name=nme)
        print(f'      {nme:8s} {R[j]:6.1f} pc  [{labels[DS[j]]}]')
    allxyz = np.concatenate([X[~unplaced], xyz])
    allr = np.linalg.norm(allxyz, axis=1)
    cosang = (allxyz @ ua) / allr
    memb = (cosang > math.cos(math.radians(1.0))) & (allr > 100) & (allr < 180)
    med = float(np.median(allr[memb]))
    check(130 <= med <= 140, f'Pleiades: {memb.sum()} stars within 1 deg of Alcyone at 100-180 pc, '
          f'median distance {med:.1f} pc')

    # ---------------- constellations
    cons = load('constellations.json')
    check(len(cons) == 88, f'{len(cons)} constellations')
    segs = [s for c in cons.values() for s in c['lines']]
    sky = [s for c in cons.values() for s in c['lines_sky_only']]
    check(all(0 <= a < n and 0 <= b < n for a, b in segs + sky), 'every line index is a named row')
    check(all(not ((F[a] | F[b]) & 16) for a, b in segs), '3D lines touch only placed stars')
    check(all((F[a] | F[b]) & 16 for a, b in sky), 'sky-only lines each touch an unplaced star')
    print(f'    {len(segs)} segments in 3D, {len(sky)} sky-only')
    ori = cons['Ori']
    on = {nm['name'][x] for s in ori['lines'] + ori['lines_sky_only'] for x in s}
    want = {'Betelgeuse', 'Rigel', 'Bellatrix', 'Mintaka', 'Alnilam', 'Alnitak', 'Saiph'}
    check(want <= on, f'Orion ({ori["name"]}) figure reaches {sorted(want)}')
    belt = [row(name=x) for x in ('Mintaka', 'Alnilam', 'Alnitak')]
    joined = {tuple(sorted(s)) for s in ori['lines'] + ori['lines_sky_only']}
    check(tuple(sorted(belt[:2])) in joined and tuple(sorted(belt[1:])) in joined,
          'the belt runs Mintaka - Alnilam - Alnitak')
    xi = row(name='Alula Australis')
    uma = {x for s in cons['UMa']['lines'] + cons['UMa']['lines_sky_only'] for x in s}
    check(xi is not None and xi in uma and nm['desig'][xi] == 'ξ UMa',
          f'HIP 55203 in the UMa figure resolves to xi UMa: {desc(xi) if xi is not None else "missing"}')
    for ident, name in (('HIP 88267', 'Bodu'), ('HIP 73695', 'Quadrans')):
        j = row(ident=ident)
        check(j is not None and nm['name'][j] == name, f'IAU key with a component suffix: {ident} is {name}')
    print(f'    Orion sky-only segments (a star with no usable parallax): '
          f'{[(nm["name"][a] or nm["id"][a], nm["name"][b] or nm["id"][b]) for a, b in ori["lines_sky_only"]]}')

    # ---------------- exoplanets
    hosts = {int(k) for k in exo['hosts']}
    check(hosts == set(np.where(F & 1)[0].tolist()), f'{len(hosts)} host rows = flag bit 0 rows')
    nf = len(exo['fields'])
    allp = [p for v in exo['hosts'].values() for p in v]
    check(all(len(p) == nf for p in allp), f'{len(allp)} planets, each with {nf} fields')
    check(all(p[6] is None or 0 <= p[6] < len(exo['methods']) for p in allp), 'method indices valid')
    hosts100 = [i for i in hosts if not unplaced[i] and R[i] <= 100]
    print(f'    hosts within 100 pc: {len(hosts100)}; methods {exo["methods"]}')

    # ---------------- deep and named do not repeat a star
    from scipy.spatial import cKDTree
    tree = cKDTree(xyz)
    code_named = np.rint((am + 8) * 10)
    rep = 0
    for i in np.where(~unplaced & (R <= 500))[0]:
        for j in tree.query_ball_point(X[i], 0.02):
            if abs(int(rec['m'][j]) - code_named[i]) <= 1:
                rep += 1
    check(rep <= 5, f'deep stars within 0.02 pc and 0.1 mag of a named star: {rep} (a wide binary pair '
          'such as HD 80606/80607 can do this; a repeated star would show up as many)')

    # ---------------- fixture for the node test
    pick = [0, 1, len(rec) // 2, len(rec) - 1]
    fx = {'deep': [{'index': int(k), 'x': int(rec['x'][k]), 'y': int(rec['y'][k]), 'z': int(rec['z'][k]),
                    'absmag_code': int(rec['m'][k]), 'colour_code': int(rec['c'][k])} for k in pick],
          'deep_count': int(len(rec)), 'named_count': n, 'sirius_row': int(si),
          'sirius_r_pc': float(R[si])}
    os.makedirs(WORK, exist_ok=True)
    with open(os.path.join(WORK, 'stars_fixture.json'), 'w') as f:
        json.dump(fx, f, indent=1)

    if fails:
        print(f'verify_stars: {len(fails)} FAILED')
        sys.exit(1)
    print('verify_stars: all checks passed')


if __name__ == '__main__':
    main()
