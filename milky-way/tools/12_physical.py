#!/usr/bin/env python3
"""Step 12 — sizes, masses, spin axes and prime meridians, ring radii and the time/frame constants.

    physical.json    CONTRACT.md section 3

Sources, all pinned:
  pck00011.tpc     NAIF's generic text PCK (IAU WGCCRE 2015 report, Archinal et al. 2018, plus
                   NAIF's updates): radii, pole right ascension/declination and prime meridian
                   polynomials, and the nutation/precession series. Read with CSPICE's own
                   kernel-pool parser (spiceypy), never by regex.
  gm_de440.tpc     GM of the Sun, the planets, their systems and the satellites (DE440 values and
                   JPL satellite release forms, compiled by NAIF).
  sat425.bsp       the header's "Additional Constants" give the ring radii JPL's Saturn
                   integration uses (C, B and A rings).
  rms-oops         the PDS Ring-Moon Systems Node's body.py, whose Uranian ring elements are
                   "adapted from the tabulated values" of French et al. 1991.
  pyerfa 2.0.1.5   ERFA's dat.c leap-second table, obl06.c's J2000 mean obliquity (IAU 2006) and
                   erfam.h's TT - TAI.
  astropy 7.1.0    iau2012.py: the astronomical unit, IAU 2012 Resolution B2.

Derived here, and labelled so in the file: the obliquity of each body (angle between its spin
axis — the IAU pole, reversed when the prime meridian runs backwards — and the normal of its
osculating orbit at J2000 from the same JPL ephemerides), the sidereal rotation period from the
prime-meridian rate, and k (Gauss) from GM_sun and the au.

This step also writes the solar-system credits fragment (tools/credits/solar.json), because it is
the last of the three and can quote the accuracy the other two measured.
"""
import ast
import json
import math
import os
import re
import sys
import tarfile

import numpy as np
from jplephem.spk import SPK

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
import solar_sources as S
from paths import DATA

PLANETS = [  # key, name, naif, barycentre (DE430 target), parent
    ('sun', 'Sun', 10, None, None),
    ('mercury', 'Mercury', 199, 1, 'sun'), ('venus', 'Venus', 299, 2, 'sun'),
    ('earth', 'Earth', 399, 3, 'sun'), ('moon', 'Moon', 301, None, 'earth'),
    ('mars', 'Mars', 499, 4, 'sun'), ('jupiter', 'Jupiter', 599, 5, 'sun'),
    ('saturn', 'Saturn', 699, 6, 'sun'), ('uranus', 'Uranus', 799, 7, 'sun'),
    ('neptune', 'Neptune', 899, 8, 'sun'), ('pluto', 'Pluto', 999, 9, 'sun'),
]
SAT_SPK = {'mars': 'mar097', 'jupiter': 'jup310', 'saturn': 'sat425', 'uranus': 'ura111',
           'neptune': 'nep081'}
PLANET_ID = {'mars': 499, 'jupiter': 599, 'saturn': 699, 'uranus': 799, 'neptune': 899}


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v)


def angle_deg(u, v):
    return math.degrees(math.acos(max(-1.0, min(1.0, float(unit(u) @ unit(v))))))


def padded(v, n=3):
    v = list(v or [])
    return v + [0.0] * (n - len(v))


def erfa_constants():
    """Leap seconds, J2000 obliquity and TT-TAI read from the ERFA C sources in the pyerfa sdist."""
    with tarfile.open(S.pyerfa_path()) as tf:
        def read(name):
            return tf.extractfile(f'pyerfa-2.0.1.5/liberfa/erfa/{name}').read().decode()
        dat = read('src/dat.c')
        obl = read('src/obl06.c')
        erfam = read('src/erfam.h')
    table = re.search(r'changes\[\]\s*=\s*\{(.*?)\};', dat, re.S).group(1)
    rows = [(int(y), int(m), float(d)) for y, m, d in
            re.findall(r'\{\s*(\d{4}),\s*(\d{1,2}),\s*([\d.]+)\s*\}', table)]
    assert rows[-1] == (2017, 1, 37.0), rows[-1]
    # From 1972 TAI-UTC is a whole number of seconds; the 1960-1971 rows carry a drift term
    # (dat.c's drift[] table) that the app does not model — it uses 10 s before 1972.
    leaps = [[jd_of(y, m, 1), d] for y, m, d in rows if y >= 1972]
    eps0 = float(re.search(r'eps0\s*=\s*\(\s*([\d.]+)', obl).group(1))
    ttmtai = float(re.search(r'#define\s+ERFA_TTMTAI\s+\(([\d.]+)\)', erfam).group(1))
    return leaps, eps0, ttmtai, len(rows)


def jd_of(y, m, d):
    """Julian Date at 0h of a Gregorian calendar date (Fliegel & Van Flandern integer algorithm)."""
    a = (14 - m) // 12
    yy = y + 4800 - a
    mm = m + 12 * a - 3
    jdn = d + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045
    return jdn - 0.5


def astropy_au_km():
    txt = open(S.astropy_iau2012_path(), encoding='utf-8').read()
    m = re.search(r'au\s*=\s*IAU2012\(\s*"au",\s*"Astronomical Unit",\s*([0-9.eE+]+),\s*"m"', txt)
    return float(m.group(1)) / 1000.0


def saturn_rings():
    k = SPK.open(S.spk_path('sat425'))
    txt = k.comments()
    val = {}
    for name in ('C_ring_RI', 'C_ring_RO', 'B_ring_RI', 'B_ring_RO', 'A_ring_RI', 'A_ring_RO'):
        val[name] = float(re.search(name + r'\s+([0-9.E+-]+)', txt).group(1))
    src = ('JPL SAT425 satellite ephemeris header, "Additional Constants" (the ring radii of the '
           'integration\'s ring model; R. A. Jacobson)')
    return [{'name': r, 'inner_km': val[f'{r}_ring_RI'], 'outer_km': val[f'{r}_ring_RO'], 'source': src}
            for r in ('C', 'B', 'A')]


def uranus_rings():
    tree = ast.parse(open(S.rms_oops_body_path(), encoding='utf-8').read())
    names = {'SIX': '6', 'FIVE': '5', 'FOUR': '4', 'ALPHA': 'alpha', 'BETA': 'beta', 'ETA': 'eta',
             'GAMMA': 'gamma', 'DELTA': 'delta', 'LAMBDA': 'lambda', 'EPSILON': 'epsilon'}
    out = []
    for node in tree.body:
        if not (isinstance(node, ast.Assign) and isinstance(node.value, ast.Call)):
            continue
        fn = node.value.func
        if not (isinstance(fn, ast.Name) and fn.id == '_uranus_ring_elements'):
            continue
        target = node.targets[0].id               # e.g. URANUS_ALPHA_ELEMENTS
        key = target[len('URANUS_'):-len('_ELEMENTS')]
        a, e, peri, inc, lnode, da = [num(x) for x in node.value.args]
        out.append({'name': names[key], 'a_km': a, 'e': e, 'width_km': da,
                    'inner_km': round(a - da / 2, 3), 'outer_km': round(a + da / 2, 3),
                    'source': ('PDS Ring-Moon Systems Node constants (SETI rms-oops body.py), '
                               'adapted from French et al. 1991')})
    assert len(out) == 10, out
    out.sort(key=lambda r: r['a_km'])
    return out


def num(n):
    """Evaluate a numeric literal or a sum of literals (e.g. 58.1+37.6) from the parsed source."""
    if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
        return float(n.value)
    if isinstance(n, ast.BinOp) and isinstance(n.op, ast.Add):
        return num(n.left) + num(n.right)
    if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
        return -num(n.operand)
    raise ValueError(ast.dump(n))


def pole_block(sp, bid):
    ra, dec, pm = (S.pool(sp, f'BODY{bid}_{k}') for k in ('POLE_RA', 'POLE_DEC', 'PM'))
    if ra is None:
        return None
    nra, ndec, npm = (S.pool(sp, f'BODY{bid}_NUT_PREC_{k}') for k in ('RA', 'DEC', 'PM'))
    system = None
    if nra or ndec or npm:
        system = str(bid // 100 if bid >= 100 else bid)
        assert S.pool(sp, f'BODY{system}_NUT_PREC_ANGLES'), bid
    return {'ra': padded(ra), 'dec': padded(dec), 'pm': padded(pm), 'nut_ra': nra or [],
            'nut_dec': ndec or [], 'nut_pm': npm or [], 'system': system}


def spin_axis(sp, bid):
    z = np.array(sp.tipbod('J2000', bid, 0.0))[2]
    return -z if S.pool(sp, f'BODY{bid}_PM')[1] < 0 else z


def main():
    sp = S.load_kernel_pool()
    de = SPK.open(S.spk_path('de430'))
    with open(os.path.join(DATA, 'moons.json'), encoding='utf-8') as fh:
        moons_manifest = json.load(fh)

    leaps, eps0, ttmtai, n_dat_rows = erfa_constants()
    au_km = astropy_au_km()
    gm_sun = S.pool(sp, 'BODY10_GM')[0]
    k_gauss = math.sqrt(gm_sun) * 86400.0 / au_km ** 1.5
    eps = math.radians(eps0 / 3600.0)
    ecl_pole = np.array([0.0, -math.sin(eps), math.cos(eps)])

    bodies = {}
    t0 = common.J2000
    for key, name, bid, bary, parent in PLANETS:
        b = body_common(sp, name, bid, parent)
        if key == 'sun':
            b['obliquity_deg'] = round(angle_deg(spin_axis(sp, bid), ecl_pole), 4)
            b['obliquity_ref'] = 'J2000 ecliptic (IAU 2006 obliquity, ERFA)'
        elif key == 'moon':
            p, v = de[3, 301].compute_and_differentiate(t0)
            pe, ve = de[3, 399].compute_and_differentiate(t0)
            h = np.cross(p - pe, v - ve)
            b['obliquity_deg'] = round(angle_deg(spin_axis(sp, bid), h), 4)
            b['obliquity_ref'] = 'osculating geocentric orbit at J2000 (DE430)'
        else:
            p, v = de[0, bary].compute_and_differentiate(t0)
            ps, vs = de[0, 10].compute_and_differentiate(t0)
            h = np.cross(p - ps, v - vs)
            b['obliquity_deg'] = round(angle_deg(spin_axis(sp, bid), h), 4)
            b['obliquity_ref'] = ('osculating heliocentric orbit of the '
                                  + ('Earth-Moon barycentre' if key == 'earth' else
                                     'system barycentre' if bary >= 5 else 'planet')
                                  + ' at J2000 (DE430)')
            b['gm_system_km3_s2'] = S.pool(sp, f'BODY{bary}_GM')[0]
        bodies[key] = b

    spks = {}
    for m in moons_manifest['moons']:
        key = m['name'].lower()
        parent = m['parent']
        bid = m['naif']
        b = body_common(sp, m['name'], bid, parent)
        if b['pole'] is not None:
            f = SAT_SPK[parent]
            if f not in spks:
                spks[f] = SPK.open(S.spk_path(f))
            k = spks[f]
            bc = PLANET_ID[parent] // 100
            h = orbit_normal(k, bc, bid, PLANET_ID[parent], t0)
            b['obliquity_deg'] = round(angle_deg(spin_axis(sp, bid), h), 4)
            b['obliquity_ref'] = f'osculating planetocentric orbit at J2000 ({f})'
        bodies[key] = b

    nut = {}
    for sysid in sorted({b['pole']['system'] for b in bodies.values() if b['pole'] and b['pole']['system']}):
        ang = S.pool(sp, f'BODY{sysid}_NUT_PREC_ANGLES')
        deg = int((S.pool(sp, f'BODY{sysid}_MAX_PHASE_DEGREE') or [1])[0]) + 1
        nut[sysid] = [ang[i:i + deg] for i in range(0, len(ang), deg)]

    out = {
        'constants': {
            'au_km': au_km, 'gm_sun_km3_s2': gm_sun, 'k_gauss_au15_day': k_gauss,
            'obliquity_j2000_arcsec': eps0, 'tt_minus_tai_s': ttmtai,
            'leap_seconds': leaps, 'tai_minus_utc_before_1972_s': 10.0,
            'notes': {
                'au_km': 'IAU 2012 Resolution B2, from astropy 7.1.0 constants/iau2012.py',
                'gm_sun_km3_s2': 'gm_de440.tpc BODY10_GM (DE440)',
                'k_gauss_au15_day': 'derived: sqrt(gm_sun) * 86400 / au_km^1.5',
                'obliquity_j2000_arcsec': 'IAU 2006 mean obliquity at J2000, ERFA obl06.c',
                'tt_minus_tai_s': 'ERFA erfam.h ERFA_TTMTAI',
                'leap_seconds': ('ERFA dat.c (release year 2023), rows from 1972 on: '
                                 '[JD UTC at 0h of the day the value starts, TAI - UTC s]. '
                                 'Before 1972 the app uses 10 s (dat.c\'s 1960-1971 drift rows '
                                 'are not modelled; < 1 minute of error).'),
            },
        },
        'nut_prec_angles': nut,
        'bodies': bodies,
        'rings': {'saturn': saturn_rings(), 'uranus': uranus_rings()},
        'rings_note': ('Saturn C/B/A edges from JPL\'s SAT425 header. Uranian rings: semi-major axis '
                       'a, eccentricity e and radial width as written in rms-oops (a sum such as '
                       '58.1+37.6 is added up); inner/outer = a -/+ width/2 as circles in Uranus\'s '
                       'equatorial plane. The rings\' pericentre and node longitudes are not shipped: '
                       'rms-oops applies them at 1977-03-10T20:00 UTC in a B1950-based Uranus '
                       'ring frame, and they mean nothing without it. Saturn\'s D and F rings are '
                       'left out: rms-oops has them only as uncited constants.'),
        'rotation_note': ('IAU convention (pck00011, CONTRACT.md section 3). T = Julian centuries TDB '
                          'and d = days TDB from J2000; nut_* terms use sin for RA and PM and cos '
                          'for Dec, with theta_k from nut_prec_angles[system]. Hyperion and Nereid '
                          'have no rotation model in pck00011 (pole = null). pck00011 warns that its '
                          'IAU Earth model is low-accuracy (prime meridian error of order 150 arcsec).'),
        'sources': ['pck00011.tpc', 'gm_de440.tpc', 'sat425.bsp', 'rms-oops body.py',
                    'pyerfa-2.0.1.5 (ERFA)', 'astropy 7.1.0 iau2012.py', 'de430.bsp'],
    }
    common.write_json('physical.json', out, ndigits=30)
    size = os.path.getsize(os.path.join(DATA, 'physical.json'))
    print(f'physical.json {size} bytes, {len(bodies)} bodies, {len(leaps)} leap-second rows '
          f'(of {n_dat_rows} in dat.c), au {au_km} km, k {k_gauss:.13f}, eps0 {eps0}"')
    for kk, b in bodies.items():
        print(f'  {kk:10s} R {b["radii_km"][0]:9.2f}  obliquity {b.get("obliquity_deg")}  '
              f'rotation {b.get("sidereal_rotation_h")} h')
    import solar_credits
    solar_credits.write()


def orbit_normal(k, b, m, p, t):
    """Angular-momentum direction of moon m about planet p (both from barycentre b) at t."""
    dt = 1e-3
    r = lambda tt: k[b, m].compute(tt)[:3] - k[b, p].compute(tt)[:3]
    r0 = r(t)
    v = (r(t + dt) - r(t - dt)) / (2 * dt)
    return np.cross(r0, v)


def body_common(sp, name, bid, parent):
    radii = S.pool(sp, f'BODY{bid}_RADII')
    gm = S.pool(sp, f'BODY{bid}_GM')
    pole = pole_block(sp, bid)
    b = {'name': name, 'naif': bid, 'parent': parent, 'radii_km': radii,
         'gm_km3_s2': gm[0] if gm else None, 'pole': pole}
    if pole:
        w1 = pole['pm'][1]
        b['sidereal_rotation_h'] = round(360.0 / w1 * 24.0, 6)
    else:
        b['sidereal_rotation_h'] = None
        b['obliquity_deg'] = None
    return b


if __name__ == '__main__':
    main()
