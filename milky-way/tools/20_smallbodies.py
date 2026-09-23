#!/usr/bin/env python3
"""Step 20 — asteroids and comets.

Writes (format: CONTRACT.md section 4)
    data/smallbodies.bin, smallbodies.json   one row per body: perihelion distance q, eccentricity
                                             e, time of perihelion tp and the orbit's orientation
                                             as two ICRF unit vectors P, Q; absolute magnitude H;
                                             a kind code and quality flags
    tools/credits/smallbodies.json           the credits fragment

Sources (all pinned in smallbodies_sources.py; the primary hosts are not reachable from here, so
each is a verbatim copy of JPL / MPC / ESA output committed to a public repository):
    JPL SBDB, every asteroid and TNO with H < 12 (Query API response in KStars, 2026-04-04):
        9,032 rows. Pluto is dropped (the app draws it from DE430), (2002 PD153) is dropped
        (e = 0 exactly and no mean anomaly: a placeholder orbit that cannot be placed), and
        A/2024 U2 is dropped here because the MPC comet list carries the same object at a newer
        epoch. The rest are kept.
    The MPC's CometEls.json (KStars, epoch 2026-04-03): every comet, A/ object and interstellar
        object in it (947 rows, less none).
    JPL SBDB comet export (KStars, October 2021): six famous comets the MPC list no longer carries,
        chosen by hand (HISTORIC below). The numbers are the file's.
    JPL SBDB lookup-API responses (adam_core fixtures): named near-Earth asteroids the H < 12 cut
        leaves out — Apophis, 2024 YR4, 2022 AP7, Itokawa, YORP — and the cited physical values
        (diameter, albedo, rotation, with SBDB's references) of Ceres, Pallas, Juno, Vesta, Eros
        and Bennu.
    JPL Horizons (a recorded response in adam_core): Bennu's osculating elements at 2024-01-01 TDB,
        from JPL's OSIRIS-REx trajectory. The SBDB fixture for Bennu is a 2011 epoch.
    ESA NEOCC orbit files (adam_core fixtures): 162173 Ryugu and 65803 Didymos (no JPL fixture);
        their names come from Stellarium's and Celestia's catalogues, the files carry numbers only.
    Celestia's dwarfplanets.ssc: which bodies are kind "dwarf" — the nine it groups as dwarf planets
        (Pluto, Ceres, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna; Pluto is not here).
        That is Celestia's grouping; Stellarium's ssystem_minor.ini types only Haumea, Eris and
        Makemake as "dwarf planet" (and Ceres as "asteroid"). The file says so.

Names: SBDB's full name, without the provisional designation for numbered asteroids that have a
name ("1 Ceres", not "1 Ceres (A801 AA)"; labelled rows keep it in info.desig) — that saves 26 KB
of the budget. Unnamed ones keep it: "32615 (2001 QU277)", "(2014 UU277)".

Frames and constants: ecliptic J2000 elements are turned into ICRF unit vectors with ERFA's
IAU 1976/1980 J2000 obliquity (obl80.c, 84381.448"), which is what JPL's own output states for
the ecliptic of its elements; k = sqrt(GM_sun) from gm_de440 and the IAU 2012 au, as physical.json.

Every orbit is a two-body (Kepler) orbit of the body's osculating elements at their epoch. The
error that grows away from the epoch is measured here, against real data, and written into the
file and the credits: Ceres, Pallas, Juno and Vesta against JPL Horizons' own osculating elements
for 1900-2100, Pluto's SBDB elements against DE430, Halley's 2026 elements against JPL's 1994
solution.
"""
import gzip
import json
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import smallbodies_sources as SB
import solar_sources as S
from common import J2000, RETRIEVED, write_bin, write_json
from paths import DATA, TOOLS

KINDS = ['dwarf', 'mba', 'trojan', 'centaur', 'tno', 'neo', 'marscrosser', 'comet', 'interstellar',
         'other']
KIND_LABELS = {
    'dwarf': 'Dwarf planet', 'mba': 'Main-belt asteroid', 'trojan': 'Jupiter trojan',
    'centaur': 'Centaur', 'tno': 'Trans-Neptunian object', 'neo': 'Near-Earth asteroid',
    'marscrosser': 'Mars-crossing asteroid', 'comet': 'Comet', 'interstellar': 'Interstellar object',
    'other': 'Other small body',
}
# JPL SBDB orbit class -> kind. MBA/IMB/OMB are JPL's main, inner and outer belt; SBDB has no
# Hungaria or Hilda group, and no pinned source defines one, so neither is a kind here.
SBDB_KIND = {'MBA': 'mba', 'IMB': 'mba', 'OMB': 'mba', 'TJN': 'trojan', 'CEN': 'centaur',
             'TNO': 'tno', 'AMO': 'neo', 'APO': 'neo', 'ATE': 'neo', 'IEO': 'neo',
             'MCA': 'marscrosser', 'AST': 'other', 'HYA': 'other', 'PAA': 'other'}

FLAG_WEAK = 1          # orbit poorly constrained (proxy, see flag_bits)
FLAG_NO_EPOCH = 2      # the source gives no osculation epoch
FLAG_BITS = {
    '0': ('weak orbit: e < 0.001 (an assumed near-circular orbit) or SBDB orbit solution 1 or 2 '
          '(orbit_id "JPL 1"/"JPL 2"), i.e. an orbit JPL has fitted at most twice. A proxy: the '
          'snapshot carries neither the data arc nor the condition code. Kept, and flagged, '
          'because the object is real and its distance and orbital plane are still roughly '
          'right; its place along the orbit may be far off.'),
    '1': 'no osculation epoch given by the source (MPC rows for four comet fragments)',
}

# The source groups, in row order.
SOURCES = [
    ('sbdb-h12', 'JPL Small-Body Database: asteroids and TNOs with H < 12 (snapshot of 2026-04-04)', 'jpl-sbdb-h12'),
    ('sbdb-lookup', 'JPL Small-Body Database lookup API (named near-Earth asteroids)', 'jpl-sbdb-lookup'),
    ('horizons', 'JPL Horizons osculating elements (2024-01-01 TDB)', 'jpl-horizons-bennu'),
    ('neocc', 'ESA NEO Coordination Centre orbit files', 'esa-neocc'),
    ('mpc', 'Minor Planet Center comet orbits, CometEls (epoch 2026-04-03)', 'mpc-cometels'),
    ('sbdb-comets', 'JPL Small-Body Database comet orbits (snapshot of 2021-10)', 'jpl-sbdb-comets'),
]

# Six famous comets missing from the MPC's current list, taken from the 2021 SBDB comet export.
# The selection is editorial; every number is the file's. Shoemaker-Levy 9 is not included: its
# fragments were orbiting Jupiter, so their heliocentric elements do not describe a path.
HISTORIC = ['109P/Swift-Tuttle', '55P/Tempel-Tuttle', 'C/1996 B2 (Hyakutake)', 'C/2020 F3 (NEOWISE)',
            'C/2006 P1 (McNaught)', 'C/1965 S1-A (Ikeya-Seki)']
# Named NEOs from the SBDB lookup fixtures (orbit at the fixture's epoch).
SBDB_NEOS = ['sbdb_99942', 'sbdb_2024YR4', 'sbdb_2022AP7', 'sbdb_25143', 'sbdb_54509']
# SBDB lookup fixtures used only for cited physical values of rows that come from elsewhere.
SBDB_PHYS = {'1': 'sbdb_1', '2': 'sbdb_2', '3': 'sbdb_3', '4': 'sbdb_4', '433': 'sbdb_433',
             '101955': 'sbdb_101955'}

# Labelled by default (only those present are used): asteroid numbers, provisional designations
# and comet designations. Editorial: dwarf planets and the largest TNOs, the biggest main-belt
# asteroids, spacecraft targets, famous comets and the three interstellar objects.
LABEL_NUMBERS = ['1', '2', '3', '4', '10', '16', '21', '243', '253', '433', '2060', '10199', '617',
                 '624', '3548', '20000', '28978', '50000', '90377', '90482', '120347', '136108',
                 '136199', '136472', '225088', '486958', '99942', '101955', '25143', '162173', '65803']
LABEL_DESIGS = ['2024 YR4']
LABEL_COMETS = ['1P', '2P', '9P', '12P', '19P', '67P', '81P', '103P', '109P', '55P', 'C/1995 O1',
                'C/1996 B2', 'C/2020 F3', 'C/2023 A3', 'C/2006 P1', 'C/1965 S1-A', 'C/2014 UN271',
                '1I', '2I', '3I']

report = {}


# ---------------------------------------------------------------------------------------- parsing
def ast_number(full_name):
    m = re.match(r'^\s*(\d+)\s', full_name)
    return m.group(1) if m else None


def ast_desig(full_name):
    m = re.search(r'\(([^()]+)\)\s*$', full_name)
    return m.group(1) if m else None


def comet_key(name):
    """'1P', '332P-B', 'C/1995 O1', 'C/1965 S1-A', '3I' ... from an MPC or SBDB comet name."""
    name = name.strip()
    m = re.match(r'^(\d+[PDIX](?:-[A-Z]+)?)(?:/|$)', name)
    if m:
        return m.group(1)
    m = re.match(r'^([PCDXAI]/-?\d{1,4} [A-Z]{1,2}\d*(?:-[A-Z]+)?)', name)
    return m.group(1) if m else name


def sbdb_rows(key):
    with open(SB.path(key), encoding='utf-8') as f:
        d = json.load(f)
    sig = d['signature']['source']
    assert sig == 'NASA/JPL SBDB (Small-Body DataBase) Query API', sig
    rows = [dict(zip(d['fields'], r)) for r in d['data']]
    assert len(rows) == int(d['count'])
    return rows


def elements_to_pq(i_deg, om_deg, w_deg, rot):
    """Unit vectors to perihelion (P) and 90 deg ahead in the plane (Q), ecliptic -> ICRF."""
    i, om, w = (math.radians(v) for v in (i_deg, om_deg, w_deg))
    ci, si, co, so, cw, sw = math.cos(i), math.sin(i), math.cos(om), math.sin(om), math.cos(w), math.sin(w)
    p = np.array([co * cw - so * sw * ci, so * cw + co * sw * ci, sw * si])
    q = np.array([-co * sw - so * cw * ci, -so * sw + co * cw * ci, cw * si])
    r = np.array(rot)
    return r @ p, r @ q


def tp_from_mean_anomaly(epoch_jd, ma_deg, a, e, k):
    """Time of perihelion from the mean anomaly at the epoch; M wrapped to (-180, 180] for an
    ellipse so that tp is the perihelion nearest the epoch."""
    n = k / abs(a) ** 1.5
    m = ma_deg
    if e < 1:
        m = (m + 180.0) % 360.0 - 180.0
    return epoch_jd - math.radians(m) / n


def phys_block(d):
    """Diameter, albedo, rotation period and their SBDB references from a lookup-API response."""
    out, refs = {}, []
    for p in d.get('phys_par', []) or []:
        key = {'diameter': 'diameter_km', 'albedo': 'albedo', 'rot_per': 'rot_per_h'}.get(p['name'])
        if key and p.get('value') not in (None, ''):
            try:
                out[key] = float(p['value'])
            except ValueError:
                continue
            if p.get('ref'):
                refs.append(f"{p['title']}: {p['ref']}")
    if refs:
        out['phys_ref'] = '; '.join(refs)
    return out


def load_sbdb_lookup(key):
    with open(SB.path(key), encoding='utf-8') as f:
        d = json.load(f)
    assert d['signature']['source'] == 'NASA/JPL Small-Body Database (SBDB) API', d['signature']
    o = d['orbit']
    assert o['equinox'] == 'J2000', o['equinox']
    el = {x['name']: x['value'] for x in o['elements']}
    return d, o, el


def parse_oef(key):
    """An ESA NEOCC OEF 2.0 orbit file: Keplerian elements (ECLM J2000), epoch, H, orbit type."""
    txt = SB.text(key)
    assert "format  = 'OEF2.0'" in txt and 'refsys  = ECLM J2000' in txt, key
    return {
        'number': re.search(r'END_OF_HEADER\s*\n(\S+)', txt).group(1),
        'kep': [float(v) for v in re.search(r'^ KEP\s+(.*)$', txt, re.M).group(1).split()],
        'epoch': float(re.search(r'^ MJD\s+([\d.]+) TDT', txt, re.M).group(1)) + 2400000.5,
        'mag': float(re.search(r'^ MAG\s+([\d.]+)', txt, re.M).group(1)),
        'type': re.search(r'^! ORB_TYPE (\w+)', txt, re.M).group(1),
    }


def stellarium_minor():
    """Sections of Stellarium's ssystem_minor.ini as dicts."""
    secs, cur = [], None
    for line in SB.text('stellarium_minor').splitlines():
        line = line.strip()
        if line.startswith('[') and line.endswith(']'):
            cur = {'_section': line[1:-1]}
            secs.append(cur)
        elif cur is not None and '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            cur[k.strip()] = v.strip()
    return secs


# ---------------------------------------------------------------------------------------- model
def _series(x, sign):
    """x - sin x (sign -1) or sinh x - x (sign +1) without cancellation: series to x^17 for |x| <= 0.5."""
    x2 = x * x
    t = 1.0
    for d in (272, 210, 156, 110, 72, 42, 20):
        t = 1 + sign * x2 / d * t
    ser = x * x2 / 6 * t
    direct = (np.sinh(x) - x) if sign > 0 else (x - np.sin(x))
    return np.where(np.abs(x) > 0.5, direct, ser)


def kepler_e(m, e):
    """Solve E - e sin E = M for arrays, M in [0, pi] (use symmetry for negative M). Newton from
    E0 = min(M + e, pi), which lies at or above the root where f is convex: monotone convergence
    for every e < 1. f = (1-e) E + e (E - sin E) - M, cancellation-free near e = 1."""
    w = 1 - e
    E = np.minimum(m + e, np.pi)
    for _ in range(100):
        h = np.sin(E / 2)
        d = (w * E + e * _series(E, -1) - m) / (w + 2 * e * h * h)
        E = E - d
        if np.all(np.abs(d) <= 1e-15 * np.maximum(1.0, np.abs(E))):
            break
    return E


def kepler_h(m, e):
    """Solve e sinh F - F = M for M >= 0: Newton from F0 = ln(2M/e + 1.8), in the same form."""
    w = e - 1
    F = np.log(2 * m / e + 1.8)
    for _ in range(100):
        h = np.sinh(F / 2)
        d = (w * F + e * _series(F, 1) - m) / (w + 2 * e * h * h)
        F = F - d
        if np.all(np.abs(d) <= 1e-15 * np.maximum(1.0, np.abs(F))):
            break
    return F


def model_positions(q, e, tp, P, Q, jd, k):
    """Heliocentric ICRF positions (AU) of the shipped model at one epoch — exactly what
    js/smallbodies.js does, in float64. q, e, tp: (N,); P, Q: (N, 3); tp in days from J2000."""
    q = np.asarray(q, np.float64)
    e = np.asarray(e, np.float64)
    tp = np.asarray(tp, np.float64)
    dt = jd - J2000 - tp
    x = np.zeros_like(q)
    y = np.zeros_like(q)
    ell = e < 1
    hyp = e > 1
    par = e == 1
    if ell.any():
        qq, ee = q[ell], e[ell]
        a = qq / (1 - ee)
        m = (k / a ** 1.5) * dt[ell]
        m = m - 2 * np.pi * np.round(m / (2 * np.pi))    # into [-pi, pi]; exact when |m| < pi
        E = kepler_e(np.abs(m), ee) * np.sign(m)
        s = np.sin(E / 2)
        x[ell] = qq - 2 * a * s * s
        y[ell] = np.sqrt(a * qq * (1 + ee)) * np.sin(E)
    if hyp.any():
        qq, ee = q[hyp], e[hyp]
        a = qq / (ee - 1)
        m = (k / a ** 1.5) * dt[hyp]
        F = kepler_h(np.abs(m), ee) * np.sign(m)
        s = np.sinh(F / 2)
        x[hyp] = qq - 2 * a * s * s
        y[hyp] = np.sqrt(a * qq * (1 + ee)) * np.sinh(F)
    if par.any():
        qq = q[par]
        w = 1.5 * k * np.sqrt(1 / (2 * qq ** 3)) * np.abs(dt[par])
        yy = np.cbrt(w + np.sqrt(w * w + 1))
        s = (yy - 1 / yy) * np.where(dt[par] < 0, -1.0, 1.0)
        x[par] = qq * (1 - s * s)
        y[par] = 2 * qq * s
    return x[:, None] * np.asarray(P, np.float64) + y[:, None] * np.asarray(Q, np.float64)


# ---------------------------------------------------------------------------------------- build
def build():
    C = SB.constants()
    k = C['k_gauss_au15_day']
    rot = SB.ecl_to_icrf(C['obliquity_arcsec'])
    print(f"  k = {k!r} au^1.5/day (GM_sun {C['gm_sun_km3_s2']} km^3/s^2, au {C['au_km']} km); "
          f"J2000 ecliptic obliquity {C['obliquity_arcsec']}\" (ERFA obl80.c, as JPL states)")
    report['constants'] = C

    rows = []
    dropped = {}

    def drop(reason, name):
        dropped.setdefault(reason, []).append(name)

    def add(**r):
        r.setdefault('flags', 0)
        r.setdefault('info', {})
        rows.append(r)

    # --- the MPC comet list (read first: the asteroid list is deduplicated against it)
    with gzip.open(SB.path('cometels'), 'rt', encoding='utf-8') as f:
        mpc = json.load(f)
    mpc_keys = {comet_key(c['Designation_and_name']) for c in mpc}

    # --- JPL SBDB, H < 12
    ast = sbdb_rows('asteroids')
    report['sbdb_rows'] = len(ast)
    minor = stellarium_minor()
    dwarf_numbers = sorted({m.group(1) for m in re.finditer(r'^"[^"]*?:(\d+) [^":]+[^"]*" "Sol"',
                                                             SB.text('celestia_dwarfs'), re.M)}, key=int)
    report['dwarf_numbers'] = dwarf_numbers
    report['stellarium_dwarf_type'] = sorted(s['name'] for s in minor if s.get('type') == 'dwarf planet')
    class_counts = {}
    for r in ast:
        name = r['full_name'].strip()
        number, desig = ast_number(r['full_name']), ast_desig(r['full_name'])
        e, a, ma = SB.num(r['e']), SB.num(r['a']), SB.num(r['ma'])
        if number == '134340':
            drop('Pluto (drawn from DE430 instead)', name)
            report['pluto_sbdb'] = r
            continue
        if ma is None:
            assert e == 0.0, name
            drop('e = 0 placeholder orbit with no mean anomaly', name)
            continue
        if desig and desig in mpc_keys:
            drop('in the MPC comet list at a newer epoch (kept from there)', name)
            continue
        m = re.match(r'^(\d+) ([^(].*) \(([^()]+)\)$', name)
        if m:                                   # numbered and named: "1 Ceres (A801 AA)" -> "1 Ceres"
            name = f'{m.group(1)} {m.group(2)}'
        epoch = float(SB.field(r, 'epoch_mjd')) + 2400000.5
        tp = tp_from_mean_anomaly(epoch, ma, a, e, k)
        P, Q = elements_to_pq(SB.num(r['i']), SB.num(r['om']), SB.num(r['w']), rot)
        cls = r['class']
        kind = 'dwarf' if number in dwarf_numbers else SBDB_KIND[cls]
        class_counts[cls] = class_counts.get(cls, 0) + 1
        flags = 0
        if e < 0.001 or r['orbit_id'] in ('JPL 1', 'JPL 2'):
            flags |= FLAG_WEAK
        info = {'class': cls, 'orbit_id': r['orbit_id']}
        for fld, key in (('diameter', 'diameter_km'), ('albedo', 'albedo'), ('rot_per', 'rot_per_h')):
            v = SB.num(r[fld])
            if v is not None:
                info[key] = v
        if r.get('extent'):
            info['extent_km'] = r['extent'].strip()
        add(src='sbdb-h12', name=name, number=number, desig=desig, kind=kind, q=a * (1 - e), e=e,
            tp=tp, epoch=epoch, P=P, Q=Q, H=SB.num(r['H']), flags=flags, info=info,
            el=dict(a=a, e=e, i=SB.num(r['i']), om=SB.num(r['om']), w=SB.num(r['w']), ma=ma))
    report['sbdb_class_counts'] = class_counts
    known = {r['number'] for r in rows if r.get('number')} | {r['desig'] for r in rows if r.get('desig')}

    # --- named NEOs from JPL SBDB lookup responses
    for key in SBDB_NEOS:
        d, o, el = load_sbdb_lookup(key)
        ob = d['object']
        name = ob['fullname'].strip()
        number, desig = ast_number(name), ast_desig(name) or ob['des']
        m = re.match(r'^(\d+) ([^(].*) \(([^()]+)\)$', name)
        if m:
            name = f'{m.group(1)} {m.group(2)}'
        assert number not in known and desig not in known, name
        e, a, ma = float(el['e']), float(el['a']), float(el['ma'])
        epoch = float(o['epoch'])
        tp = tp_from_mean_anomaly(epoch, ma, a, e, k)
        if el.get('tp'):          # the response's own tp agrees (checked, not used)
            report.setdefault('lookup_tp_check_days', {})[name] = tp - float(el['tp'])
        P, Q = elements_to_pq(float(el['i']), float(el['om']), float(el['w']), rot)
        H = next((float(p['value']) for p in d.get('phys_par', []) or [] if p['name'] == 'H'), math.nan)
        info = {'class': ob['orbit_class']['code'], 'orbit_id': o['orbit_id']}
        info.update(phys_block(d))
        add(src='sbdb-lookup', name=name, number=number, desig=desig, kind=SBDB_KIND[ob['orbit_class']['code']],
            q=a * (1 - e), e=e, tp=tp, epoch=epoch, P=P, Q=Q, H=H, info=info,
            el=dict(a=a, e=e, i=float(el['i']), om=float(el['om']), w=float(el['w']), ma=ma))

    # --- Bennu: JPL Horizons osculating elements at 2024-01-01 TDB (recorded response)
    hz = SB.text('horizons_bennu')
    assert 'Output type     : GEOMETRIC osculating elements' in hz, 'not an elements response'
    soe = hz[hz.index('$$SOE') + 5:hz.index('$$EOE')].strip().split(',')
    vals = [v.strip() for v in soe]
    jd_hz = float(vals[0])
    ec, qr, inc, om, w, tp_hz = (float(v) for v in vals[2:8])
    assert '101955 Bennu (1999 RQ36)' in hz
    bennu_d, bennu_o, _ = load_sbdb_lookup('sbdb_101955')
    P, Q = elements_to_pq(inc, om, w, rot)
    info = {'class': bennu_d['object']['orbit_class']['code'], 'orbit_id': 'JPL 118 (Horizons trajectory sb-101955-118_long)'}
    info.update(phys_block(bennu_d))
    Hb = next(float(p['value']) for p in bennu_d['phys_par'] if p['name'] == 'H')
    assert '101955' not in known
    add(src='horizons', name='101955 Bennu', number='101955', desig='1999 RQ36', kind='neo',
        q=qr, e=ec, tp=tp_hz, epoch=jd_hz, P=P, Q=Q, H=Hb, info=info,
        el=dict(q=qr, e=ec, i=inc, om=om, w=w, tp=tp_hz))

    # --- Ryugu and Didymos: ESA NEOCC orbit files; names from Stellarium / Celestia. First, NEOCC's
    # Eros against JPL's Eros at the same epoch: the two ecliptic frames and element sets agree.
    ne = parse_oef('neocc_433')
    d433, o433, el433 = load_sbdb_lookup('sbdb_433')
    assert ne['epoch'] == float(o433['epoch'])
    pos = []
    for a, e, inc, om, w, ma in ([*ne['kep']], [float(el433[x]) for x in ('a', 'e', 'i', 'om', 'w', 'ma')]):
        P, Q = elements_to_pq(inc, om, w, rot)
        tp = tp_from_mean_anomaly(ne['epoch'], ma, a, e, k)
        pos.append(model_positions([a * (1 - e)], [e], [tp - J2000], [P], [Q], ne['epoch'], k)[0])
    report['neocc_vs_sbdb_eros_au'] = float(np.linalg.norm(pos[0] - pos[1]))
    ryugu = next(s for s in minor if s.get('minor_planet_number') == '162173')
    didy = re.search(r'^"65803 (\w+):\1:([^"]+)" "Sol"', SB.text('celestia_asteroids'), re.M)
    names = {'162173': (f"162173 {ryugu['name']}", ryugu['iau_designation']),
             '65803': (f'65803 {didy.group(1)}', didy.group(2))}
    for key in ('neocc_162173', 'neocc_65803'):
        oef = parse_oef(key)
        number, mag, otype, epoch = oef['number'], oef['mag'], oef['type'], oef['epoch']
        a, e, inc, om, w, ma = oef['kep']
        assert number not in known
        P, Q = elements_to_pq(inc, om, w, rot)
        name, desig = names[number]
        add(src='neocc', name=name, number=number, desig=desig, kind='neo', q=a * (1 - e), e=e,
            tp=tp_from_mean_anomaly(epoch, ma, a, e, k), epoch=epoch, P=P, Q=Q, H=mag,
            info={'class': otype}, el=dict(a=a, e=e, i=inc, om=om, w=w, ma=ma))

    # --- MPC comets
    comets_dat = sbdb_rows('comets')
    cdat = {}
    for r in comets_dat:
        cdat.setdefault(comet_key(r['full_name']), r)
    for c in mpc:
        name = c['Designation_and_name'].replace('`', 'ʻ')     # MPC writes the okina as `
        tpk = SB.jd_from_calendar(c['Year_of_perihelion'], c['Month_of_perihelion'], c['Day_of_perihelion'])
        flags = 0
        if 'Epoch_year' in c:
            epoch = SB.jd_from_calendar(c['Epoch_year'], c['Epoch_month'], c['Epoch_day'])
        else:
            epoch, flags = None, FLAG_NO_EPOCH
        P, Q = elements_to_pq(c['i'], c['Node'], c['Peri'], rot)
        kind = {'I': 'interstellar', 'A': 'other'}.get(c['Orbit_type'], 'comet')
        info = {'orbit_ref': c['Ref']}
        ckey = comet_key(c['Designation_and_name'])
        add(src='mpc', name=name, ckey=ckey, kind=kind, q=float(c['Perihelion_dist']), e=float(c['e']),
            tp=tpk, epoch=epoch, P=P, Q=Q, H=float(c['H']) if c.get('H') is not None else math.nan,
            flags=flags, info=info,
            el=dict(q=float(c['Perihelion_dist']), e=float(c['e']), i=c['i'], om=c['Node'], w=c['Peri'], tp=tpk))

    # --- historic comets from the SBDB comet export
    for want in HISTORIC:
        r = next(x for x in comets_dat if x['full_name'].strip() == want)
        ckey = comet_key(want)
        assert ckey not in mpc_keys, want
        e, q = SB.num(r['e']), SB.num(r['q'])
        epoch = float(SB.field(r, 'epoch_mjd')) + 2400000.5
        tpk = float(r['tp'])
        P, Q = elements_to_pq(SB.num(r['i']), SB.num(r['om']), SB.num(r['w']), rot)
        info = {'class': r['class'], 'orbit_id': r['orbit_id']}
        add(src='sbdb-comets', name=want, ckey=ckey, kind='comet', q=q, e=e, tp=tpk, epoch=epoch,
            P=P, Q=Q, H=SB.num(r['M1']) if r['M1'] is not None else math.nan, info=info,
            el=dict(q=q, e=e, i=SB.num(r['i']), om=SB.num(r['om']), w=SB.num(r['w']), tp=tpk))

    # Physical values for labelled comets from the SBDB comet export (same designation).
    for r in rows:
        if r['src'] in ('mpc', 'sbdb-comets') and r['ckey'] in cdat:
            s = cdat[r['ckey']]
            for fld, key in (('diameter', 'diameter_km'), ('albedo', 'albedo'), ('rot_per', 'rot_per_h')):
                v = SB.num(s[fld])
                if v is not None:
                    r['info'][key] = v
                    r['info']['phys_from'] = f"JPL SBDB comet export (2021), {s['full_name'].strip()}"
            if s.get('extent'):
                r['info']['extent_km'] = s['extent'].strip()
            if r['src'] == 'mpc':
                r['info'].setdefault('class', s['class'])

    # Cited physical values from the SBDB lookup fixtures (replace the snapshot's uncited ones).
    for number, key in SBDB_PHYS.items():
        with open(SB.path(key), encoding='utf-8') as f:
            d = json.load(f)
        r = next(x for x in rows if x.get('number') == number)
        ph = phys_block(d)
        for kk in ('diameter_km', 'albedo', 'rot_per_h'):
            r['info'].pop(kk, None)
        r['info'].update(ph)

    report['dropped'] = dropped
    return rows, C


# ---------------------------------------------------------------------------------------- accuracy
def horizons_elements_pos(el, rot, k, jd):
    """Position of an osculating element set at its own epoch (a, e, i, node, peri, M; ecliptic)."""
    a, e = el['semi_major_axis'], el['eccentricity']
    P, Q = elements_to_pq(el['inclination'], el['ascending_node'], el['arg_of_pericenter'], rot)
    q = a * (1 - e)
    tp = tp_from_mean_anomaly(el['epoch_jde'], el['mean_anomaly'], a, e, k)
    return model_positions([q], [e], [tp - J2000], [P], [Q], jd, k)[0]


def measure_drift(rows, C, stored):
    """Two-body drift of the shipped orbits against real perturbed positions."""
    k = C['k_gauss_au15_day']
    rot = SB.ecl_to_icrf(C['obliquity_arcsec'])
    q32, e32, tp64, P32, Q32 = stored
    out = {}
    lo, hi = S.PLANET_JD
    bins = [1, 5, 10, 25, 50, 75, 125]

    def binned(dts, errs, r_au):
        tab = {}
        for b0, b1 in zip([0] + bins[:-1], bins):
            sel = (np.abs(dts) > b0 - (1e-9 if b0 == 0 else 0)) & (np.abs(dts) <= b1)
            if sel.any():
                tab[f'{b0}-{b1} yr'] = {'max_au': float(errs[sel].max()),
                                        'max_deg': float(np.degrees((errs[sel] / r_au[sel]).max())),
                                        'n': int(sel.sum())}
        return tab

    # (a) Ceres, Pallas, Juno, Vesta vs JPL Horizons' own yearly osculating elements
    with open(SB.path('horizons_big4'), encoding='utf-8') as f:
        big4 = json.load(f)
    assert big4['generator'] == 'fetch_asteroid_elements.py (Horizons)'
    horizons = {}
    for ast in big4['asteroids']:
        i = next(j for j, r in enumerate(rows) if r.get('number') == str(ast['number']) and r['src'] == 'sbdb-h12')
        dts, errs, rr = [], [], []
        for el in ast['elements']:
            jd = el['epoch_jde']
            if not (lo <= jd <= hi):
                continue
            ref = horizons_elements_pos(el, rot, k, jd)
            mod = model_positions(q32[i:i + 1], e32[i:i + 1], tp64[i:i + 1], P32[i:i + 1], Q32[i:i + 1], jd, k)[0]
            dts.append((jd - rows[i]['epoch']) / 365.25)
            errs.append(float(np.linalg.norm(mod - ref)))
            rr.append(float(np.linalg.norm(ref)))
        dts, errs, rr = np.array(dts), np.array(errs), np.array(rr)
        horizons[rows[i]['name']] = {'epochs': len(dts), 'bins': binned(dts, errs, rr),
                                     'nearest_epoch_err_au': float(errs[np.argmin(np.abs(dts))]),
                                     'nearest_epoch_dt_days': float(dts[np.argmin(np.abs(dts))] * 365.25)}
    out['horizons_big4'] = horizons

    # (b) Pluto: its SBDB elements (epoch 2016-07-19; the row is not shipped) against DE430
    from jplephem.spk import SPK
    pr = report['pluto_sbdb']
    a, e = SB.num(pr['a']), SB.num(pr['e'])
    ep = float(SB.field(pr, 'epoch_mjd')) + 2400000.5
    P, Q = elements_to_pq(SB.num(pr['i']), SB.num(pr['om']), SB.num(pr['w']), rot)
    tpp = tp_from_mean_anomaly(ep, SB.num(pr['ma']), a, e, k)
    de = SPK.open(S.spk_path('de430'))
    jds = np.arange(lo, hi + 1, 365.25 / 4)
    ref = (de[0, 9].compute(jds) - de[0, 10].compute(jds)).T / C['au_km']
    mod = np.array([model_positions([a * (1 - e)], [e], [tpp - J2000], [P], [Q], jd, k)[0] for jd in jds])
    de.close()
    errs = np.linalg.norm(mod - ref, axis=1)
    out['pluto_vs_de430'] = {'epoch_jd': ep, 'epochs': len(jds),
                             'bins': binned((jds - ep) / 365.25, errs, np.linalg.norm(ref, axis=1)),
                             'note': ('SBDB 134340 Pluto elements (epoch 2016-07-19), two-body, against '
                                      'DE430 Pluto-system barycentre; includes the ~2,100 km '
                                      'Pluto-barycentre offset, negligible here.')}

    # (c) Halley: the shipped MPC 2026 elements, back to JPL's 1994 solution (SBDB comet export)
    i = next(j for j, r in enumerate(rows) if r['src'] == 'mpc' and r['ckey'] == '1P')
    hr = next(x for x in sbdb_rows('comets') if x['full_name'].strip() == '1P/Halley')
    ep = float(SB.field(hr, 'epoch_mjd')) + 2400000.5
    Pj, Qj = elements_to_pq(SB.num(hr['i']), SB.num(hr['om']), SB.num(hr['w']), rot)
    tpj = float(hr['tp'])
    ref = model_positions([SB.num(hr['q'])], [SB.num(hr['e'])], [tpj - J2000], [Pj], [Qj], ep, k)[0]
    mod = model_positions(q32[i:i + 1], e32[i:i + 1], tp64[i:i + 1], P32[i:i + 1], Q32[i:i + 1], ep, k)[0]
    a_m = float(q32[i]) / (1 - float(e32[i]))
    period = 2 * math.pi / (k / a_m ** 1.5)
    tp_prev = tp64[i] + J2000 - period
    out['halley'] = {
        'jpl_epoch_jd': ep, 'shipped_epoch_jd': rows[i]['epoch'],
        'dt_years': (ep - rows[i]['epoch']) / 365.25,
        'err_au': float(np.linalg.norm(mod - ref)), 'r_au': float(np.linalg.norm(ref)),
        'previous_perihelion_model_jd': float(tp_prev), 'previous_perihelion_jpl_jd': tpj,
        'perihelion_shift_days': float(tp_prev - tpj),
        'note': ('1P/Halley: the shipped MPC elements (epoch 2026-04-03) propagated back to the epoch '
                 'of JPL solution J863/77 (1994-02-17) and compared with that solution; and the '
                 'previous perihelion they imply against JPL\'s 1986 perihelion time.'),
    }
    return out


# ---------------------------------------------------------------------------------------- output
def rounded(o, nd):
    """Measured figures (floats, nested in dicts and lists) rounded to nd decimals for the file."""
    if isinstance(o, float):
        return round(o, nd)
    if isinstance(o, dict):
        return {k_: rounded(v, nd) for k_, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [rounded(v, nd) for v in o]
    return o


def main():
    rows, C = build()
    n = len(rows)
    order = {s[0]: i for i, s in enumerate(SOURCES)}
    rows.sort(key=lambda r: order[r['src']])            # stable: each group keeps its file order
    k = C['k_gauss_au15_day']

    q = np.array([r['q'] for r in rows], np.float64)
    e = np.array([r['e'] for r in rows], np.float64)
    tp = np.array([r['tp'] - J2000 for r in rows], np.float64)
    P = np.array([r['P'] for r in rows], np.float64)
    Q = np.array([r['Q'] for r in rows], np.float64)
    H = np.array([r['H'] if r['H'] is not None else math.nan for r in rows], np.float64)
    kind = np.array([KINDS.index(r['kind']) for r in rows], np.uint8)
    flags = np.array([r['flags'] for r in rows], np.uint8)
    assert np.all(q > 0) and np.all(e >= 0) and np.all(np.isfinite(tp))

    cols = [('q', 'f32', q.astype('<f4')), ('e', 'f32', e.astype('<f4')), ('tp', 'f64', tp.astype('<f8')),
            ('P', 'f32', P.astype('<f4').ravel()), ('Q', 'f32', Q.astype('<f4').ravel()),
            ('H', 'f32', H.astype('<f4')), ('kind', 'u8', kind), ('flags', 'u8', flags)]
    blob, columns, off = bytearray(), [], 0
    for name, typ, arr in cols:
        size = {'f32': 4, 'f64': 8, 'u8': 1}[typ]
        assert off % size == 0, name
        columns.append({'name': name, 'type': typ, 'offset': off, 'length': int(arr.size),
                        'per_row': int(arr.size // n)})
        blob += arr.tobytes()
        off += arr.nbytes
    stored = (q.astype(np.float32).astype(np.float64), e.astype(np.float32).astype(np.float64), tp,
              P.astype(np.float32).astype(np.float64), Q.astype(np.float32).astype(np.float64))

    # Row indices per source, and epochs: each source's most common epoch, and the rows that differ
    # grouped by their epoch (JD TDB as the key). Rows without an epoch carry flag bit 1.
    sources, by_epoch = [], {}
    for sid, label, credit in SOURCES:
        idx = [i for i, r in enumerate(rows) if r['src'] == sid]
        assert idx == list(range(idx[0], idx[-1] + 1)), sid
        eps = [rows[i]['epoch'] for i in idx]
        common_epoch = max(set(e_ for e_ in eps if e_ is not None), key=lambda v: (eps.count(v), -v))
        sources.append({'id': sid, 'label': label, 'credit': credit, 'first': idx[0], 'count': len(idx),
                        'epoch_jd': common_epoch})
        for i in idx:
            ep = rows[i]['epoch']
            if ep is None:
                assert rows[i]['flags'] & FLAG_NO_EPOCH
            elif ep != common_epoch:
                by_epoch.setdefault(ep, []).append(i)
    epochs = {repr(float(ep)): by_epoch[ep] for ep in sorted(by_epoch)}

    # Labelled rows.
    labelled = []
    for i, r in enumerate(rows):
        if (r.get('number') in LABEL_NUMBERS or r.get('desig') in LABEL_DESIGS
                or (r['src'] in ('mpc', 'sbdb-comets') and r['ckey'] in LABEL_COMETS)
                or r['kind'] == 'dwarf'):
            labelled.append(i)
    got = {rows[i].get('number') for i in labelled} | {rows[i].get('ckey') for i in labelled} | \
          {rows[i].get('desig') for i in labelled}
    missing = [x for x in LABEL_NUMBERS + LABEL_DESIGS + LABEL_COMETS if x not in got]
    report['label_missing'] = missing

    # Per-row extras: full info for labelled rows; diameters for every row that has one.
    info, diam = {}, {}
    for i, r in enumerate(rows):
        if i in labelled:
            d = dict(r['info'])
            if r.get('desig') and r['desig'] not in r['name']:
                d['desig'] = r['desig']
            info[str(i)] = d
        elif 'diameter_km' in r['info']:
            diam[str(i)] = r['info']['diameter_km']

    drift = measure_drift(rows, C, stored)
    report['drift'] = drift

    hz = drift['horizons_big4']

    def worst(label):
        return max(v['bins'][label]['max_au'] for v in hz.values() if label in v['bins'])
    near = max(v['nearest_epoch_err_au'] for v in hz.values())
    pl = drift['pluto_vs_de430']['bins']
    ha = drift['halley']
    epoch_note = (
        'Every orbit is a two-body (Kepler) ellipse, hyperbola or parabola of the body\'s osculating '
        'elements at their epoch (most asteroids 2025-11-21, most comets 2026-04-03; per row in '
        'epochs / sources). Planetary perturbations are ignored, so positions drift away from the '
        f'epoch. Measured: Ceres, Pallas, Juno and Vesta agree with JPL Horizons\' own osculating '
        f'elements to {near:.1e} AU 49 days from the epoch and drift by up to {worst("5-10 yr"):.3f} AU '
        f'5-10 years away, {worst("10-25 yr"):.3f} AU at 10-25 years and {worst("50-75 yr"):.2f} AU at '
        f'50-75 years. Pluto from its SBDB elements against DE430: {pl["5-10 yr"]["max_au"]:.3f} AU at '
        f'5-10 years, {pl["50-75 yr"]["max_au"]:.2f} AU at 50-75 years. Halley\'s 2026 elements put its '
        f'1986 perihelion {abs(ha["perihelion_shift_days"]):.0f} days '
        f'{"late" if ha["perihelion_shift_days"] > 0 else "early"}. Orbits flagged weak (flag bit 0) '
        'and comets with old epochs can be much further off.')

    meta = {
        'format': 'milky-way smallbodies 1',
        'count': n,
        'asteroid_count': sum(1 for r in rows if r['src'] == 'sbdb-h12'),
        'columns': columns,
        'kinds': {str(i): kk for i, kk in enumerate(KINDS)},
        'kind_labels': KIND_LABELS,
        'names': [r['name'] for r in rows],
        'sources': sources,
        'epochs': epochs,
        'labelled': labelled,
        'info': info,
        'diameter_km': diam,
        'flag_bits': FLAG_BITS,
        'units': {'q': 'au', 'tp': 'days from J2000.0 (JD 2451545.0) TDB', 'P': 'unit vector, ICRF',
                  'Q': 'unit vector, ICRF', 'epoch': 'JD TDB (the MPC gives TT; TT = TDB within 2 ms)'},
        'frame': ('ICRF (equatorial) heliocentric; the sources\' J2000 ecliptic elements rotated by '
                  f'{C["obliquity_arcsec"]}" (IAU 1976/1980, ERFA obl80.c at J2000), the obliquity '
                  'JPL states for its ecliptic frame'),
        'k_gauss_au15_day': k,
        'gm_sun_km3_s2': C['gm_sun_km3_s2'],
        'au_km': C['au_km'],
        'obliquity_arcsec': C['obliquity_arcsec'],
        'h_note': ('H is the asteroid absolute magnitude (H, G system) for asteroid rows; for comets '
                   'and interstellar objects it is the comet total-magnitude parameter (the MPC\'s H, '
                   'the SBDB export\'s M1), which is not comparable. NaN when unknown.'),
        'epoch_note': epoch_note,
        'accuracy': rounded(drift, 9),
        'dropped': {k_: v for k_, v in sorted(report['dropped'].items())},
        'dwarf_note': ('kind "dwarf" is the grouping of Celestia\'s dwarfplanets.ssc (Ceres, Orcus, '
                       'Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna here; Pluto comes from DE430). '
                       'Stellarium\'s ssystem_minor.ini types only '
                       + ', '.join(report['stellarium_dwarf_type']) + ' as "dwarf planet" and Ceres as '
                       '"asteroid".'),
        'names_note': ('SBDB full names; numbered asteroids that have a name are written without their '
                       'provisional designation ("1 Ceres"); labelled rows keep it in info.desig.'),
        'selection': ('JPL SBDB asteroids and TNOs with H < 12 (a brightness-limited sample: the main '
                      'belt is sparse and near-Earth asteroids are absent apart from named ones), '
                      'named near-Earth asteroids, every comet in the MPC\'s CometEls list and six '
                      'famous comets from JPL\'s 2021 comet export.'),
    }
    for c in columns:
        c['bytes'] = c['length'] * {'f32': 4, 'f64': 8, 'u8': 1}[c['type']]
    write_bin('smallbodies.bin', bytes(blob))
    # ndigits=30: every float is written as it is (k above all: the JS propagates with it, and
    # write_json's default 9 decimals would cut it to 0.017202099, 2.9e-9 off the tp computed
    # here); only the measured accuracy figures are rounded, above.
    write_json('smallbodies.json', meta, ndigits=30)
    jb = os.path.getsize(os.path.join(DATA, 'smallbodies.json'))
    bb = len(blob)
    report['bytes'] = (jb, bb)
    write_credits(rows, C, drift, meta)

    kinds_count = {kk: int((kind == i).sum()) for i, kk in enumerate(KINDS)}
    print(f'  rows {n}: ' + ', '.join(f'{kk} {v}' for kk, v in kinds_count.items()))
    print('  sources: ' + ', '.join(f"{s['id']} {s['count']}" for s in sources))
    print(f"  dropped: {report['dropped']}")
    print(f"  weak-orbit flag: {int((flags & FLAG_WEAK).astype(bool).sum())} rows; no epoch: "
          f"{int((flags & FLAG_NO_EPOCH).astype(bool).sum())}")
    print(f'  labelled {len(labelled)}; label targets not present: {missing}')
    print(f'  open orbits (e >= 1): {int((e >= 1).sum())}; e == 1 exactly: {int((e == 1).sum())}')
    print(f'  smallbodies.json {jb:,} B + smallbodies.bin {bb:,} B = {jb + bb:,} B (budget 700,000)')
    print('  drift vs Horizons (max AU per |t - epoch| bin): ' +
          '; '.join(f"{lab} {worst(lab):.2e}" for lab in ['0-1 yr', '1-5 yr', '5-10 yr', '10-25 yr', '25-50 yr', '50-75 yr', '75-125 yr']))
    print('  Pluto two-body vs DE430: ' + '; '.join(f"{lab} {v['max_au']:.3f} AU" for lab, v in pl.items()))
    print(f"  Halley 2026 elements at the 1994 JPL epoch: {ha['err_au']:.3f} AU off (r = {ha['r_au']:.1f} AU); "
          f"1986 perihelion {ha['perihelion_shift_days']:+.1f} d")
    assert jb + bb <= 700_000, 'over the 0.7 MB budget'


# ---------------------------------------------------------------------------------------- credits
def ymd_of(jd):
    """'YYYY-MM-DD' of a JD (Gregorian; Meeus ch. 7), for credit text."""
    z = math.floor(jd + 0.5)
    f = jd + 0.5 - z
    al = math.floor((z - 1867216.25) / 36524.25)
    a = z + 1 + al - math.floor(al / 4) if z >= 2299161 else z
    b = a + 1524
    c = math.floor((b - 122.1) / 365.25)
    d = math.floor(365.25 * c)
    e = math.floor((b - d) / 30.6001)
    day = math.floor(b - d - math.floor(30.6001 * e) + f)
    month = e - 1 if e < 14 else e - 13
    year = c - 4716 if month > 2 else c - 4715
    return f'{year:04d}-{month:02d}-{day:02d}'


def write_credits(rows, C, drift, meta):
    src = {s['id']: s for s in meta['sources']}
    kst = f'KDE KStars repository at commit {SB.KSTARS[1]}'
    adam = f'B612 Asteroid Institute adam_core repository at commit {SB.ADAM[1]}'
    readme_eph = SB.quote('kstars_readme_eph', 'KStars keeps track of thousands of comets and asteroids. '
                          'It uses orbital data published by NASA\'s Jet Propulsion Laboratory (JPL); '
                          'these data are known as "orbital elements".')
    gpl = SB.quote('kstars_readme', 'KStars is Free Software, released under the GNU Public License.')
    mpc_free = SB.quote('mpc_faqs', 'Data from the MPC\'s database is made freely available to the public.')
    mpc_cite = SB.quote('mpc_lists', 'Users of any of these lists are reminded that the source of the data '
                        'is the Minor Planet Center. The relevant URL should be cited, along with a '
                        'reference to the MPC itself.')
    mit = SB.quote('adam_license', 'Permission is hereby granted, free of charge, to any person obtaining a copy')
    neocc_readme = SB.quote('neocc_readme', 'Sample OEF files from ESA NEOCC (per-object orbit download).')
    sbdb_readme = SB.quote('sbdb_readme', 'Sample JSON responses from the JPL SBDB lookup API.')
    hz_readme = SB.quote('horizons_readme', 'These verbatim service responses gate deterministic Rust parsing')
    stel_gpl = SB.quote('stellarium_copying', 'GNU GENERAL PUBLIC LICENSE Version 2, June 1991')
    celestia_spdx = SB.quote('celestia_asteroids', 'SPDX-License-Identifier: GPL-2.0-or-later')
    SB.quote('celestia_dwarfs', celestia_spdx)
    jpl_terms = ('No licence could be read: ssd.jpl.nasa.gov is not reachable from the build machine, and '
                 'the research pass found only a web-search summary of catalog.data.gov ("No license '
                 'information was provided"). JPL is operated by Caltech, so this is not claimed to be a '
                 'US-Government public-domain work. Credited as NASA/JPL Solar System Dynamics with the '
                 'retrieval date. The copy read here sits in KStars (GPL-2.0-or-later at project level; '
                 'kstars/data/ has no file-level licence); only the numbers are used, in a new format.')
    hz = drift['horizons_big4']
    pl = drift['pluto_vs_de430']['bins']
    ha = drift['halley']
    labs = list(next(iter(hz.values()))['bins'])
    acc_h = ', '.join(f"{lab} {max(b['bins'][lab]['max_au'] for b in hz.values()):.2g} AU" for lab in labs)
    vesta = next(b for name, b in hz.items() if 'Vesta' in name)
    near = max(b['nearest_epoch_err_au'] for b in hz.values())
    s0 = src['sbdb-h12']
    n_weak = sum(1 for r in rows if r['flags'] & FLAG_WEAK)
    n_main_epoch = sum(1 for r in rows if r['src'] == 'sbdb-h12' and r['epoch'] == src['sbdb-h12']['epoch_jd'])
    hist_years = sorted(int(ymd_of(r['epoch'])[:4]) for r in rows if r['src'] == 'sbdb-comets')
    blocks = [
        {
            'id': 'jpl-sbdb-h12',
            'title': 'JPL Small-Body Database: every asteroid and TNO with H < 12',
            'owner': 'NASA Jet Propulsion Laboratory, Solar System Dynamics group (Small-Body Database)',
            'source': (f'kstars/data/asteroids.dat in the {kst} (2026-04-04), sha256 {SB.FILES["asteroids"][3]}: '
                       'a verbatim response of JPL\'s SBDB Query API ("NASA/JPL SBDB (Small-Body DataBase) '
                       'Query API" v1.0) to KStars\' query for H < 12 with full-precision elements. '
                       f'KStars\' README.ephemerides: "{readme_eph}"'),
            'url': SB.url('asteroids'),
            'licence': jpl_terms,
            'licence_quote': f'KStars README.md: "{gpl}" The data file itself carries no licence.',
            'retrieved': RETRIEVED,
            'adaptations': (f'{report["sbdb_rows"]:,} rows read; {s0["count"]:,} kept. Dropped: '
                            + '; '.join(f'{", ".join(v)} — {k_}' for k_, v in sorted(report['dropped'].items()))
                            + '. Heliocentric ecliptic J2000 elements (a, e, i, node, peri, M at the epoch) '
                            'turned into perihelion distance, time of perihelion (from M and the mean motion '
                            'k/a^1.5) and two ICRF unit vectors; stored as float32 (time as float64). Kinds '
                            'from SBDB\'s orbit class (MBA/IMB/OMB shown as main belt; SBDB has no Hungaria '
                            'or Hilda group); the bodies Celestia\'s dwarfplanets.ssc groups as dwarf planets '
                            '(Ceres, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna) as kind dwarf. '
                            'Names without the provisional designation for named numbered asteroids. '
                            f'{n_weak:,} orbits are flagged weak (e < 0.001, or orbit solution '
                            'JPL 1/JPL 2 — a proxy, the snapshot has no arc length or condition code) and '
                            'kept. Diameters, albedos and rotation periods as given.'),
            'accuracy': (f'Two-body propagation of osculating elements, epoch {ymd_of(src["sbdb-h12"]["epoch_jd"])} '
                         f'for {n_main_epoch:,} rows, '
                         'older for the rest (per row in the file). Against JPL Horizons\' own osculating '
                         f'elements of Ceres, Pallas, Juno and Vesta, 1900-2100: {near:.1e} AU 49 days from '
                         f'the epoch; worst of the four by years from the epoch: {acc_h} (Vesta, the least '
                         f'perturbed, within {max(v["max_au"] for v in vesta["bins"].values()):.2g} AU). '
                         'Pluto\'s SBDB elements against DE430: '
                         + ', '.join(f'{lab} {v["max_au"]:.3f} AU' for lab, v in pl.items()) + '.'),
        },
        {
            'id': 'jpl-sbdb-lookup',
            'title': 'JPL Small-Body Database lookup responses: named near-Earth asteroids and cited sizes',
            'owner': 'NASA Jet Propulsion Laboratory, Solar System Dynamics group (SBDB); physical values '
                     'as referenced per value in each response',
            'source': (f'JSON responses of the SBDB lookup API ("NASA/JPL Small-Body Database (SBDB) API" v1.3) '
                       f'kept as test fixtures in the {adam} (src/adam_core/orbits/query/tests/testdata/sbdb/). '
                       f'Their README: "{sbdb_readme}" Files: '
                       + ', '.join(SB.FILES[k_][1].split('/')[-1] + ' ' + SB.FILES[k_][3][:16] + '…'
                                   for k_ in SBDB_NEOS + sorted(SBDB_PHYS.values()))),
            'url': SB.url('sbdb_99942'),
            'licence': ('JPL terms as above (not readable from here). The container repository is MIT: '
                        f'"{mit}"'),
            'licence_quote': f'adam_core LICENSE.md: "The MIT License (MIT) … {mit} …"',
            'retrieved': RETRIEVED,
            'adaptations': ('Orbits of 99942 Apophis, 2024 YR4, 2022 AP7, 25143 Itokawa and 54509 YORP at '
                            'each response\'s epoch, converted as above. Diameter, albedo and rotation period '
                            'with SBDB\'s per-value references for those and for Ceres, Pallas, Juno, Vesta, '
                            'Eros and Bennu (replacing the snapshot\'s uncited values for those six).'),
            'accuracy': 'Elements copied at full precision; the time of perihelion each response gives '
                        'and the one computed here from its mean anomaly and k '
                        + ('are the same float64 number for all five.'
                           if max(abs(v) for v in report['lookup_tp_check_days'].values()) == 0 else
                           f"agree to {max(abs(v) for v in report['lookup_tp_check_days'].values()) * 86400:.1e} s."),
        },
        {
            'id': 'jpl-horizons-bennu',
            'title': 'JPL Horizons: osculating elements of 101955 Bennu at 2024-01-01 TDB',
            'owner': 'NASA Jet Propulsion Laboratory, Solar System Dynamics group (Horizons); trajectory '
                     'sb-101955-118_long, Farnocchia et al. (2021), doi:10.1016/j.icarus.2021.114594 (as the response cites it)',
            'source': (f'A recorded Horizons API response in the {adam} '
                       '(src/adam_core/orbits/query/tests/data/horizons/elements_bennu_20240101.txt, sha256 '
                       f'{SB.FILES["horizons_bennu"][3]}). Its README: "{hz_readme}". The response states '
                       'its frame: "IAU76 obliquity of 84381.448 arcseconds wrt ICRF X-Y plane".'),
            'url': SB.url('horizons_bennu'),
            'licence': 'JPL terms as above (not readable from here); container repository MIT.',
            'licence_quote': f'adam_core LICENSE.md: "{mit}"',
            'retrieved': RETRIEVED,
            'adaptations': ('Used instead of the SBDB lookup fixture for Bennu, whose elements are at a 2011 '
                            'epoch. Also the source of the obliquity used for every row.'),
            'accuracy': 'Elements copied at full precision (osculating at 2024-01-01).',
        },
        {
            'id': 'esa-neocc',
            'title': 'ESA NEO Coordination Centre orbits of 162173 Ryugu and 65803 Didymos',
            'owner': 'European Space Agency, NEO Coordination Centre (Planetary Defence Office)',
            'source': (f'OEF 2.0 orbit files 162173.ke1 and 65803.ke1 (present-day epoch, ECLM J2000) kept '
                       f'as test fixtures in the {adam}. Their README: "{neocc_readme}" The files give '
                       'numbers only; the names are from Stellarium\'s ssystem_minor.ini (Ryugu, 1999 JU3) '
                       'and Celestia\'s asteroids.ssc (Didymos, 1996 GT) — see the planetarium block.'),
            'url': SB.url('neocc_162173'),
            'licence': ('ESA NEOCC\'s data-use terms could not be read (neo.ssa.esa.int is not reachable from '
                        'the build machine; a web-search summary said the NEOCC "encourages you to make '
                        'use of these data"). Credited as ESA NEOCC. Container repository MIT.'),
            'licence_quote': f'adam_core LICENSE.md: "{mit}"',
            'retrieved': RETRIEVED,
            'adaptations': 'Elements at MJD 61000 TDT converted as above; H is NEOCC\'s MAG value.',
            'accuracy': ('NEOCC\'s own 433 Eros file (433.ke1, same fixtures) and JPL\'s Eros response at the '
                         f'same epoch put Eros {report["neocc_vs_sbdb_eros_au"]:.1e} AU apart: the same '
                         'ecliptic frame. Two-body propagation from MJD 61000 (2025-11-21).'),
        },
        {
            'id': 'mpc-cometels',
            'title': 'Minor Planet Center comet orbits (CometEls.json)',
            'owner': 'Minor Planet Center, Smithsonian Astrophysical Observatory (IAU)',
            'source': (f'kstars/data/cometels.json.gz in the {kst}, sha256 {SB.FILES["cometels"][3]}: the '
                       'MPC\'s Extended_Files/cometels.json.gz as downloaded by KStars (cometscomponent.cpp). '
                       'Each row carries its MPC reference (MPC/MPEC).'),
            'url': 'https://www.minorplanetcenter.net/Extended_Files/cometels.json.gz',
            'licence': (f'"{mpc_free}" (MPC FAQ). Citation policy: "{mpc_cite}" (MPC Lists and Plots page; '
                        'stated for those lists, applied here to the comet file too). Both read from the '
                        f'MPC\'s own documentation repository Smithsonian/mpc-public at commit {SB.MPC_PUBLIC[1]}. '
                        'The copy read here sits in KStars (GPL-2.0-or-later at project level).'),
            'licence_quote': f'"{mpc_free}"',
            'retrieved': RETRIEVED,
            'adaptations': (f'All {src["mpc"]["count"]} comets, A/ objects and interstellar objects; perihelion '
                            'time and epoch from calendar dates (TT); the backtick the MPC uses for the '
                            'okina in 1I/ʻOumuamua shown as ʻ. H is the MPC\'s comet magnitude '
                            'parameter. Diameters (and albedo, rotation, extent where given) joined from '
                            'JPL\'s 2021 comet export by designation, for the comets it lists them for.'),
            'accuracy': (f'Two-body propagation from epoch 2026-04-03. Halley\'s elements propagated back to '
                         f'JPL\'s 1994 solution are {ha["err_au"]:.2f} AU off at r = {ha["r_au"]:.1f} AU and '
                         f'put the 1986 perihelion {ha["perihelion_shift_days"]:+.0f} days from JPL\'s.'),
        },
        {
            'id': 'jpl-sbdb-comets',
            'title': 'JPL Small-Body Database comet export (six famous comets and comet sizes)',
            'owner': 'NASA Jet Propulsion Laboratory, Solar System Dynamics group (Small-Body Database)',
            'source': (f'kstars/data/comets.dat in the {kst}, sha256 {SB.FILES["comets"][3]}: an SBDB Query '
                       'API response last updated in KStars in October 2021.'),
            'url': SB.url('comets'),
            'licence': jpl_terms,
            'licence_quote': f'KStars README.md: "{gpl}" The data file itself carries no licence.',
            'retrieved': RETRIEVED,
            'adaptations': ('Orbits of ' + ', '.join(HISTORIC) + ' — famous comets the MPC list no longer '
                            'carries (an editorial choice; the numbers are the file\'s). Shoemaker-Levy 9 is '
                            'left out: its fragments orbited Jupiter, so heliocentric elements do not '
                            'describe their path. Also the diameter, extent, albedo and rotation period of '
                            'MPC comets, joined by designation.'),
            'accuracy': (f'Two-body propagation from each comet\'s own epoch ({hist_years[0]}-{hist_years[-1]}); far '
                         'from it they are approximate.'),
        },
        {
            'id': 'planetarium-catalogues',
            'title': 'Stellarium and Celestia catalogues (dwarf-planet grouping, two names; accuracy checks)',
            'owner': 'The Stellarium developers; the Celestia project (CelestiaContent contributors)',
            'source': (f'Stellarium data/ssystem_minor.ini at commit {SB.STELLARIUM[1]} (the name of 162173 '
                       'Ryugu) and data/asteroid_elements.json '
                       '(JPL Horizons yearly osculating elements of Ceres, Pallas, Juno and Vesta, '
                       '1800-2100, generated by Stellarium\'s fetch_asteroid_elements.py — used only to '
                       'measure the accuracy above, not shipped); CelestiaContent data/dwarfplanets.ssc '
                       '(which bodies are grouped as dwarf planets) and data/asteroids.ssc (the name of '
                       f'65803 Didymos) at commit {SB.CELESTIA[1]}.'),
            'url': SB.url('stellarium_minor'),
            'licence': ('GNU GPL (Stellarium\'s COPYING is "' + stel_gpl + '"; Celestia\'s dwarfplanets.ssc '
                        'and asteroids.ssc: "' + celestia_spdx + '"). Only facts are taken (a grouping '
                        'and two names); no file is redistributed.'),
            'licence_quote': f'"{stel_gpl}"; "{celestia_spdx}"',
            'retrieved': RETRIEVED,
            'adaptations': ('Nothing shipped beyond the kind of eight rows and two names. Stellarium types only '
                            + ', '.join(report['stellarium_dwarf_type']) + ' as "dwarf planet" and Ceres as '
                            '"asteroid"; Celestia\'s grouping is the one used, and the file says so '
                            '(dwarf_note).'),
            'accuracy': 'Horizons elements used as the reference for the drift figures in the JPL SBDB block.',
        },
    ]
    os.makedirs(os.path.join(TOOLS, 'credits'), exist_ok=True)
    with open(os.path.join(TOOLS, 'credits', 'smallbodies.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(blocks, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
