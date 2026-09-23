#!/usr/bin/env python3
"""Step 50 — the galaxy: measured tracers and labelled model fits, in astropy's Galactocentric frame.

Writes (format: CONTRACT.md section 8)
    data/galaxy/galaxy.json               frame + to_icrs matrix, arm fits, globular clusters,
                                          satellite galaxies, stellar streams, texture metadata
    data/galaxy/young-poggio2021-ums.png  Gaia EDR3 upper-main-sequence overdensity (Poggio+2021)
    data/galaxy/young-gaiadr3-ob.png      Gaia DR3 OB-star overdensity (Gaia Collaboration,
                                          Drimmel+2023)
    data/galaxy/model.png                 face-on surface density of a MODEL: McMillan 2017 thin +
                                          thick stellar discs plus the Portail+2017 bar (Sormani+2022
                                          analytic fit)
    tools/credits/galaxy.json             the credits fragment

Sources (all pinned in galaxy_sources.py):
    astropy 7.1.0 (installed, pinned; module file hashed) - Galactocentric parameter set 'v4.0'.
    Local Volume Database v1.1.1 (A. B. Pace; CC0): gc_harris, gc_mw_new, dwarf_mw tables.
    galstreams 1.2.1 (C. Mateu; BSD-3): default ("On") stream tracks + summary InfoFlags.
    SpiralMap 0.27 (Prusty & Khanna; MIT): Reid+2019 Table 2 arm parameters, Drimmel+2024 Cepheid
        arm fits, the Poggio+2021 and Gaia DR3 overdensity grids (included in SpiralMap with the
        authors' permission; Gaia-derived, so non-commercial terms may apply - see credits).
    Agama @ f302756b (E. Vasiliev; BSD/MIT): data/McMillan17.ini, py/example_mw_bar_potential.py.
    Build-time check only (nothing shipped): galkin's Reid+2014 maser parallaxes (no licence) prove
        the sign convention of the Reid arms; the build stops if the mirrored convention fits better.

Decisions (all counted and printed):
  * Frame: astropy Galactocentric v4.0 (R0 8.122 kpc, z_sun 20.8 pc, the Galactic-centre direction
    galcen_coord at ICRS 266.4051, -28.936175 - Galactic l = b = 0, not the radio source Sgr A* -, roll 0), read from the installed astropy's registry. The 4x4 to_icrs matrix is found
    by transforming the origin and three points at 1000 kpc along the axes to ICRS with astropy,
    then checked by round trips.
  * Globular clusters: LVDB gc_harris (all confirmed) + gc_mw_new rows with confirmed_real == 1.
    gc_ambiguous (GC-or-dwarf systems) and unconfirmed candidates are left out and listed.
  * Satellites: LVDB dwarf_mw rows with confirmed_real == 1 (includes the LMC and SMC; SMC and
    the other LMC satellites have host 'lmc'). confirmed_galaxy is shipped as galaxy_confirmed.
  * Streams: galstreams default tracks. Tracks whose distance is 1.000 kpc everywhere (to 1e-9; the
    41 ibata2024 placeholders) are dropped. quality: 'track' (the distance varies and InfoFlags
    bit 1 = 1), 'constant-distance' (one value along the whole track), 'approximate-distance' (it
    varies but bit 1 is 0 or 2: interpolated end points, a mean Galactocentric distance, an orbit
    prediction, or parallaxes "to be taken with caution" - each explained in a note taken from
    galstreams' own track documentation). InfoFlags bit 0 = 0 ("great circle by construction") is
    shipped as great_circle = true. Every track decimated to <= 120 evenly indexed points.
  * Reid+2019 arms: sampled every 1 deg only over each arm's fitted beta range (plus the kink),
    x = -R cos(beta), y = +R sin(beta) (checked against the masers). Placed with their published
    Galactocentric radii (fitted with R0 = 8.15 kpc; this frame has 8.122).
  * Drimmel+2024 arms: variant '1' of SpiralMap's pickle (phi -90..0 deg, 1,331 Cepheids), pitch
    and ln R0 the mean of the 'strength' and 'prom' estimates - what SpiralMap does and labels its
    "best phi range". Drawn only over phi -90..0 deg.
  * Young-star maps: the 121 x 121 grids at their native 0.1 kpc cells, one pixel per grid node;
    cells that are exactly 0.0 (no data) get alpha 0.
  * model.png: 512 x 512 over +-20 kpc, Sigma = McMillan thin + thick disc surface density (Agama
    Disk: Sigma0 exp(-R/Rd)) + the bar's density integrated over z (Gauss-Legendre); McMillan's
    axisymmetric bulge and gas discs are not added (the bar model stands for the centre).
    log10 stretch, recorded in galaxy.json.
"""
import html
import io
import math
import os
import pickle
import re
import sys
import types
import warnings

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
import galaxy_sources as S
from paths import DATA, TOOLS

OUT = 'galaxy'
BUDGET = 600_000
MAX_STREAM_POINTS = 120
REID_STEP_DEG = 1.0
DRIMMEL_VARIANT = '1'
DRIMMEL_STEP_DEG = 1.0
YOUNG_LO, YOUNG_HI = -1.0, 1.5          # overdensity encoded linearly into 0..255
MODEL_N = 512
MODEL_HALF = 20.0                        # kpc
BAR_ANGLE_DEG = -25.0                    # example_mw_bar_potential.py: bar_angle, "w.r.t. the Sun"

report = {}


def log(*a):
    print(*a, flush=True)


def rnd(a, nd):
    """Round (array or scalar) to nd decimals, as plain Python floats; -0.0 becomes 0.0."""
    if isinstance(a, np.ndarray):
        return [rnd(v, nd) for v in a.tolist()]
    if isinstance(a, (list, tuple)):
        return [rnd(v, nd) for v in a]
    r = round(float(a), nd)
    return 0.0 if r == 0 else r


def fnum(s):
    s = (s or '').strip()
    return float(s) if s not in ('', 'nan', 'NaN') else None


def text_of(path_or_bytes):
    if isinstance(path_or_bytes, bytes):
        return path_or_bytes.decode('utf-8')
    with open(path_or_bytes, encoding='utf-8') as f:
        return f.read()


def quoted(src, *needles):
    """Return the needles joined, after asserting each occurs verbatim (whitespace-normalised) in src."""
    hay = ' '.join(text_of(src).split())
    for n in needles:
        if ' '.join(n.split()) not in hay:
            raise SystemExit(f'licence quote not found in its pinned file: {n[:80]!r}')
    return needles


# ---------------------------------------------------------------- bibliography (BibTeX from pinned files)
JOURNAL_MACROS = {'\\apj': 'ApJ', '\\apjl': 'ApJL', '\\apjs': 'ApJS', '\\aj': 'AJ', '\\mnras': 'MNRAS',
                  '\\aap': 'A&A', '\\nat': 'Nature', '\\pasj': 'PASJ', '\\pasp': 'PASP', '\\araa': 'ARA&A',
                  '\\actaa': 'AcA', '\\aaps': 'A&AS'}
JOURNAL_NAMES = {'The Astrophysical Journal': 'ApJ', 'The Astrophysical Journal Letters': 'ApJL',
                 'The Astronomical Journal': 'AJ', 'Monthly Notices of the Royal Astronomical Society': 'MNRAS',
                 'Astronomy & Astrophysics': 'A&A', 'Astronomy and Astrophysics': 'A&A'}


def parse_bib(text):
    """{key: {field: value}} from a BibTeX file (brace-balanced values, quotes or bare numbers)."""
    out = {}
    i = 0
    while True:
        m = re.compile(r'@(\w+)\s*\{\s*([^,\s]+)\s*,', re.S).search(text, i)
        if not m:
            break
        key = m.group(2)
        j = m.end()
        depth = 1
        k = j
        while depth and k < len(text):
            if text[k] == '{':
                depth += 1
            elif text[k] == '}':
                depth -= 1
            k += 1
        body = text[j:k - 1]
        fields = {}
        p = 0
        fre = re.compile(r'\s*(\w+)\s*=\s*', re.S)
        while True:
            fm = fre.match(body, p)
            if not fm:
                break
            name = fm.group(1).lower()
            q = fm.end()
            if q < len(body) and body[q] == '{':
                d, r = 1, q + 1
                while d and r < len(body):
                    d += {'{': 1, '}': -1}.get(body[r], 0)
                    r += 1
                val = body[q + 1:r - 1]
            elif q < len(body) and body[q] == '"':
                d, r = 0, q + 1                       # a quote inside braces ({\"o}) does not end it
                while r < len(body) and not (body[r] == '"' and d == 0):
                    d += {'{': 1, '}': -1}.get(body[r], 0)
                    r += 1
                val = body[q + 1:r]
                r += 1
            else:
                r = q
                while r < len(body) and body[r] not in ',\n':
                    r += 1
                val = body[q:r]
            fields[name] = ' '.join(val.split())
            p = r
            while p < len(body) and body[p] in ', \n\t\r':
                p += 1
        out[key] = fields
        i = k
    return out


def _clean_tex(s):
    s = html.unescape(s)
    s = re.sub(r"\{\\['`^\"~]\{?(\w)\}?\}", r'\1', s)     # {\'e} -> e (accents dropped, not invented)
    s = s.replace('{', '').replace('}', '').replace('~', ' ')
    return ' '.join(s.split())


def bib_ref(entry):
    """'Ibata et al. 2021, ApJ 914, 123' from a BibTeX entry."""
    authors = [a.strip() for a in re.split(r'\s+and\s+', entry.get('author', '')) if a.strip()]

    def surname(a):
        a = a.strip()
        if ',' in a:
            return _clean_tex(a.split(',')[0])
        return _clean_tex(a.split()[-1])
    if not authors:
        who = '?'
    elif len(authors) == 1:
        who = surname(authors[0])
    elif len(authors) == 2:
        who = f'{surname(authors[0])} & {surname(authors[1])}'
    else:
        who = f'{surname(authors[0])} et al.'
    year = entry.get('year', '').strip()
    j = (entry.get('journal') or entry.get('booktitle') or '').strip()
    j = JOURNAL_MACROS.get(j, _clean_tex(j))
    j = JOURNAL_NAMES.get(j, j)
    vol = entry.get('volume', '').strip()
    pages = entry.get('pages', '').strip().replace('--', '-')
    if j.lower().startswith('arxiv'):
        return f'{who} {year}, {pages or entry.get("eid", "")}'.strip(', ')
    tail = ', '.join(x for x in (' '.join(x for x in (j, vol) if x), pages) if x)
    return f'{who} {year}, {tail}' if tail else f'{who} {year}'


# ---------------------------------------------------------------- 1. frame
def build_frame():
    import astropy.units as u
    from astropy.coordinates import (ICRS, CartesianRepresentation, Galactocentric, SkyCoord,
                                     galactocentric_frame_defaults)
    modfile = S.check_astropy()
    reg = galactocentric_frame_defaults.get_from_registry('v4.0')
    par = reg['parameters']
    GC = Galactocentric(**par)
    r0 = round(float(par['galcen_distance'].to_value(u.kpc)), 12)
    zsun = round(float(par['z_sun'].to_value(u.kpc)), 12)       # 20.8 pc -> 0.0208 kpc (not 0.020800000000000003)
    assert (r0, zsun, float(par['roll'].to_value(u.deg))) == (8.122, 0.0208, 0.0), (r0, zsun)

    scale = 1000.0
    pts = CartesianRepresentation(np.array([[0, scale, 0, 0], [0, 0, scale, 0], [0, 0, 0, scale]], float) * u.kpc)
    xyz = SkyCoord(GC.realize_frame(pts)).transform_to(ICRS()).cartesian.xyz.to_value(u.kpc)
    b = xyz[:, 0]
    A = (xyz[:, 1:] - b[:, None]) / scale
    orth = float(np.abs(A @ A.T - np.eye(3)).max())
    assert orth < 1e-12 and abs(np.linalg.det(A) - 1) < 1e-12, orth
    M = np.eye(4)
    M[:3, :3] = A
    M[:3, 3] = b

    # the Sun: the ICRS origin in the Galactocentric frame, two ways
    sun = -A.T @ b
    sun_ap = SkyCoord(ICRS(CartesianRepresentation([0.0], [0.0], [0.0], unit=u.kpc))).transform_to(GC)
    sun_ap = sun_ap.cartesian.xyz.to_value(u.kpc).ravel()
    assert np.abs(sun - sun_ap).max() < 1e-12, (sun, sun_ap)
    sun[1] = 0.0 if abs(sun[1]) < 1e-12 else sun[1]           # y_sun is 0 by construction (roll 0)

    # round trips: random heliocentric ICRS points out to 300 kpc, through astropy and through M
    rng = np.random.default_rng(50)
    n = 20000
    dirs = rng.normal(size=(n, 3))
    dirs /= np.linalg.norm(dirs, axis=1)[:, None]
    q = dirs * (10 ** rng.uniform(-3, np.log10(300), n))[:, None]
    g = SkyCoord(ICRS(CartesianRepresentation(q.T * u.kpc))).transform_to(GC).cartesian.xyz.to_value(u.kpc).T
    back = g @ A.T + b
    rt = float(np.abs(back - q).max())
    inv = (q - b) @ A                                        # the inverse (A orthonormal): A^T (q - b)
    rt_inv = float(np.abs(inv - g).max())
    assert rt < 1e-9 and rt_inv < 1e-9, (rt, rt_inv)
    report['frame'] = dict(roundtrip_max_kpc=rt, inverse_max_kpc=rt_inv, orthonormality=orth, n=n)
    log(f'frame: R0 {r0} kpc, z_sun {zsun * 1000:.1f} pc, Sun at {sun.round(9).tolist()} kpc; '
        f'to_icrs round trip over {n} points to 300 kpc: {rt:.2e} kpc (inverse {rt_inv:.2e})')

    refs = reg['references']

    def bibcode(url):
        from urllib.parse import unquote
        return unquote(url.rsplit('/', 1)[1])
    gc_coord = par['galcen_coord']
    # astropy documents galcen_coord as "The ICRS coordinates of the Galactic center"; it is the origin
    # of Galactic coordinates (l = b = 0), which is what the label below says
    gl = SkyCoord(gc_coord).galactic
    assert abs(((gl.l.deg + 180) % 360) - 180) < 1e-3 and abs(gl.b.deg) < 1e-3, (gl.l.deg, gl.b.deg)
    frame_refs = [
        f"R0 = {r0} kpc: {bibcode(refs['galcen_distance'])}",
        f"z_sun = {zsun * 1000:.1f} pc: {bibcode(refs['z_sun'])}",
        f"Galactic-centre direction (galcen_coord; Galactic l = b = 0 to 0.001 deg) at ICRS RA {gc_coord.ra.deg}, "
        f"Dec {gc_coord.dec.deg} deg: {bibcode(refs['galcen_coord'])}",
        f"astropy {S.ASTROPY_VERSION} Galactocentric frame, parameter set 'v4.0'",
    ]
    frame = {
        'name': 'astropy Galactocentric v4.0',
        'r0_kpc': r0, 'z_sun_kpc': zsun, 'roll_deg': 0.0,
        'galcen_icrs_deg': [float(gc_coord.ra.deg), float(gc_coord.dec.deg)],
        'sun_kpc': rnd(sun, 12),
        'to_icrs': [[float(v) for v in row] for row in M],
        'to_icrs_note': ('4x4 row-major, column vectors: [x_icrs, y_icrs, z_icrs, 1] = to_icrs . '
                         '[x_gc, y_gc, z_gc, 1], kpc in and out. The upper-left 3x3 is a rotation '
                         '(orthonormal), so the inverse is x_gc = R^T (x_icrs - t). ICRS here is '
                         'heliocentric: astropy puts it at the solar-system barycentre, < 1e-10 kpc '
                         'from the Sun.'),
        'axes': ('x from the Sun towards the Galactic centre (the Sun at x = -8.122 kpc), y towards '
                 'Galactic longitude 90 deg (the direction of the Sun\'s rotation), z towards the '
                 'North Galactic Pole; right-handed. The disc rotates clockwise seen from +z.'),
        'refs': frame_refs,
        'checks': {'roundtrip_max_kpc': float(f'{rt:.3g}'), 'points': n},
    }
    return GC, frame, dict(A=A, b=b, sun=sun, module=modfile)


def gc_xyz(GC, sc):
    import astropy.units as u
    c = sc.transform_to(GC)
    return np.column_stack([c.x.to_value(u.kpc), c.y.to_value(u.kpc), c.z.to_value(u.kpc)])


# ---------------------------------------------------------------- 2. LVDB globular clusters and satellites
def lvdb_ref(s):
    s = (s or '').strip()
    m = re.fullmatch(r"(.+?)(\d{4}[A-Za-z&.]{5}[\w.]{4}[\w.][\w.]{4}[A-Z.])", s)
    if not m:
        return s or None
    return f'{m.group(1)} {m.group(2)[:4]} ({m.group(2)})'


def read_lvdb(table):
    import csv
    with open(S.lvdb(table), encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def build_lvdb(GC):
    import astropy.units as u
    from astropy.coordinates import SkyCoord
    tables = {t: read_lvdb(t) for t in ('gc_harris', 'gc_mw_new', 'gc_ambiguous', 'dwarf_mw')}
    sel = {
        'gc_harris': [r for r in tables['gc_harris'] if r['confirmed_real'] == '1' and fnum(r['distance'])],
        'gc_mw_new': [r for r in tables['gc_mw_new'] if r['confirmed_real'] == '1' and fnum(r['distance'])],
        'dwarf_mw': [r for r in tables['dwarf_mw'] if r['confirmed_real'] == '1' and fnum(r['distance'])],
    }
    left_out = {
        'gc_mw_new_candidates': sorted(r['name'] for r in tables['gc_mw_new'] if r['confirmed_real'] != '1'),
        'gc_ambiguous': sorted(r['name'] for r in tables['gc_ambiguous']),
        'dwarf_mw_unconfirmed': sorted(r['name'] for r in tables['dwarf_mw'] if r['confirmed_real'] != '1'),
    }
    counts = {t: (len(tables[t]), len(sel.get(t, []))) for t in tables}
    log('LVDB rows (in table, kept):', counts)

    out = {}
    dgc_diff, dm_dist = [], []
    for kind, tabs in (('globulars', ('gc_harris', 'gc_mw_new')), ('satellites', ('dwarf_mw',))):
        rows = [(t, r) for t in tabs for r in sel[t]]
        ra = np.array([float(r['ra']) for _, r in rows])
        dec = np.array([float(r['dec']) for _, r in rows])
        dist = np.array([float(r['distance']) for _, r in rows])
        xyz = gc_xyz(GC, SkyCoord(ra=ra * u.deg, dec=dec * u.deg, distance=dist * u.kpc, frame='icrs'))
        objs = []
        for (t, r), p in zip(rows, xyz):
            dgc = fnum(r['distance_gc'])
            if dgc is not None:
                dgc_diff.append(abs(float(np.linalg.norm(p)) - dgc))
            # LVDB's distance_em/ep are 0.0 for every gc_harris row; the distance-modulus errors are
            # the catalogued measurement errors, so the distance range is taken from those
            dm, dme, dmp = fnum(r['distance_modulus']), fnum(r['distance_modulus_em']), fnum(r['distance_modulus_ep'])
            dkpc = float(r['distance'])
            if dm is not None:
                dm_dist.append(abs(10 ** (dm / 5 + 1) / 1000 / dkpc - 1))
            if dm is not None and dme is not None and dmp is not None:
                em = dkpc - 10 ** ((dm - dme) / 5 + 1) / 1000
                ep = 10 ** ((dm + dmp) / 5 + 1) / 1000 - dkpc
                em, ep = rnd(em, 3), rnd(ep, 3)
            else:
                em = ep = None
            o = {
                'name': r['name'], 'key': r['key'], 'table': t, 'host': r['host'] or None,
                'xyz': rnd(p, 4),
                'dist_kpc': float(r['distance']),
                'dist_err_kpc': [em, ep] if em is not None and ep is not None else None,
                'rhalf_pc': fnum(r['rhalf_physical']),
                'mv': fnum(r['M_V']),
                'ref': lvdb_ref(r['ref_distance']),
            }
            if kind == 'satellites':
                o['ellipticity'] = fnum(r['ellipticity'])
                o['pa_deg'] = fnum(r['position_angle'])
                o['galaxy_confirmed'] = r['confirmed_galaxy'] == '1'
            objs.append(o)
        objs.sort(key=lambda o: o['key'])
        out[kind] = objs
    assert max(dm_dist) < 0.005, max(dm_dist)
    everyone = out['globulars'] + out['satellites']
    report['lvdb'] = dict(counts=counts, distance_gc_max_diff_kpc=max(dgc_diff), dm_distance_max_rel=max(dm_dist),
                          no_ref=sorted(o['name'] for o in everyone if not o['ref']),
                          n_baumgardt=sum(1 for o in out['globulars'] if (o['ref'] or '').endswith('(2021MNRAS.505.5957B)')),
                          distance_gc_median_diff_kpc=float(np.median(dgc_diff)), n_compared=len(dgc_diff))
    log(f"LVDB: {len(out['globulars'])} globular clusters, {len(out['satellites'])} satellites; "
        f"|r_gc| vs LVDB distance_gc: max {max(dgc_diff) * 1000:.1f} pc, median "
        f"{np.median(dgc_diff) * 1000:.1f} pc over {len(dgc_diff)}")
    assert max(dgc_diff) < 0.02, 'LVDB distance_gc should reproduce in the v4.0 frame to < 20 pc'
    assert len(out['globulars']) == 194 and len(out['satellites']) == 65, (len(out['globulars']), len(out['satellites']))
    return out, left_out, counts


# ---------------------------------------------------------------- 3. stellar streams (galstreams)
def build_streams(GC):
    import astropy.units as u
    from astropy.coordinates import SkyCoord
    from astropy.table import Table
    base = S.galstreams_members(['galstreams/lib/master_log.txt', 'galstreams/tracks/docs/gsrefs.bib',
                                 'LICENSE', 'galstreams/core.py'])
    core = base['galstreams/core.py'].decode('utf-8')
    assert 'bit 0: 0 = great circle by construction' in core
    assert 'bit 1: 0 = no distance track available (only mean or central value reported)' in core
    bib = parse_bib(base['galstreams/tracks/docs/gsrefs.bib'].decode('utf-8'))
    rows = []
    for line in base['galstreams/lib/master_log.txt'].decode('utf-8').splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        p = line.split()
        rows.append(dict(imp=p[0], on=p[1], track=p[2], name=p[3], refs=p[4], refs_latex=p[5]))
    on = [r for r in rows if r['on'] == '1']
    log(f'galstreams: {len(rows)} tracks in master_log, {len(on)} default (On)')
    files, docs = {}, {}
    for r in on:
        stem = f"galstreams/tracks/track.{r['imp']}.{r['name']}.{r['refs']}"
        files[r['track']] = (stem + '.ecsv', stem + '.summary.ecsv')
        docs[r['track']] = stem.replace('/tracks/', '/tracks/docs/') + '.tex'
    data = S.galstreams_members([f for pair in files.values() for f in pair])
    # galstreams' own description of how each track was built (5 kept tracks have none)
    texdocs = S.galstreams_members(list(docs.values()), optional=True)

    streams, dropped, flag_mismatch = [], [], []
    for r in on:
        tf, sf = files[r['track']]
        t = Table.read(data[tf].decode('utf-8'), format='ascii.ecsv')
        s = Table.read(data[sf].decode('utf-8'), format='ascii.ecsv')
        assert str(t['ra'].unit) == 'deg' and str(t['dec'].unit) == 'deg' and str(t['distance'].unit) == 'kpc'
        flags = str(s['InfoFlags'][0])
        assert re.fullmatch('[0-9]{4}', flags), flags        # a few carry an undocumented '2'
        ra = np.asarray(t['ra'], float)
        dec = np.asarray(t['dec'], float)
        d = np.asarray(t['distance'], float)
        assert np.all(np.isfinite(d)) and np.all(d > 0)
        # 1 kpc to rounding (the files hold 0.99999999999999... to 1.00000000000002)
        if np.all(np.abs(d - 1.0) < 1e-9):
            dropped.append(dict(track=r['track'], name=r['name'], ref=r['refs'], flags=flags))
            continue
        constant = bool(np.ptp(d) < 1e-9 * d.max())
        if constant != (flags[1] == '0'):
            flag_mismatch.append((r['track'], flags, 'constant' if constant else 'varying'))
        great_circle = flags[0] == '0'
        doc = ' '.join(texdocs.get(docs[r['track']], b'').decode('utf-8').split())
        # distance classes, from galstreams' own flag (bit 1: 1 = distance track, 0 = none, 2 = "to be
        # taken with caution") and whether the file's distance actually varies
        if constant:
            quality = 'constant-distance'
        elif flags[1] == '1':
            quality = 'track'
        else:
            quality = 'approximate-distance'
        n = len(d)
        idx = np.unique(np.round(np.linspace(0, n - 1, min(n, MAX_STREAM_POINTS))).astype(int))
        xyz = gc_xyz(GC, SkyCoord(ra=ra[idx] * u.deg, dec=dec[idx] * u.deg, distance=d[idx] * u.kpc, frame='icrs'))
        keys = [k.strip() for k in r['refs_latex'].split(',') if k.strip()]
        missing = [k for k in keys if k not in bib]
        assert not missing, (r['track'], missing)
        refs = [bib_ref(bib[k]) for k in keys]
        notes = []
        if great_circle:
            notes.append('Sky path: a great circle drawn by construction between the published end '
                         'points (galstreams InfoFlags bit 0 = 0), not traced from member stars.')
        if quality == 'constant-distance':
            notes.append(f'Distance: one published value ({d[0]:.3g} kpc) along the whole track, '
                         'not a measured distance gradient.')
        elif quality == 'approximate-distance':
            if flags[1] == '2':
                notes.append('Distance: from the reciprocal of member-star parallaxes, which galstreams '
                             'flags as an estimate to be taken with caution.')
            elif 'orbit prediction' in doc:
                notes.append('Distance: interpolated along an orbit prediction, not observed (galstreams).')
            elif 'mean galactocentric distance' in doc:
                notes.append('Distance: one published mean Galactocentric distance for the whole track, '
                             'not a measured distance track.')
            elif 'interpolat' in doc:
                notes.append('Distance: interpolated between the published end-point distances, not a '
                             'measured distance track.')
            else:
                raise SystemExit(f"{r['track']}: no galstreams note explains its approximate distance")
        elif 'interpolat' in doc:
            notes.append('Distance: interpolated between a few published reference distances.')
        if 'perturbed' in doc and 'disc' in doc:
            notes.append('galstreams notes that this is most likely a feature of the perturbed disc '
                         'rather than a tidal stream.')
        streams.append({
            'name': r['name'], 'track': r['track'], 'ref': '; '.join(refs),
            'quality': quality,
            'great_circle': great_circle,
            'approximate': bool(quality != 'track' or great_circle),
            'info_flags': flags,
            'dist_range_kpc': rnd([d.min(), d.max()], 3),
            'n_source_points': int(n),
            'points': [rnd(p, 3) for p in xyz],
            'note': ' '.join(notes) or 'Sky path and distances traced from the stream\'s member stars.',
        })
    streams.sort(key=lambda s: (s['name'].lower(), s['track']))
    n_gc = sum(s['great_circle'] for s in streams)
    n_const = sum(s['quality'] == 'constant-distance' for s in streams)
    n_track = sum(s['quality'] == 'track' for s in streams)
    n_approx = sum(s['quality'] == 'approximate-distance' for s in streams)
    n_both = sum(1 for s in streams if not s['approximate'])
    npts = sum(len(s['points']) for s in streams)
    log(f'streams: kept {len(streams)} ({n_track} with a distance track, {n_approx} with an interpolated or '
        f'cautioned distance, {n_const} with one distance; {n_gc} great circles by construction; {n_both} with '
        f'both a traced path and a distance track), dropped {len(dropped)} 1-kpc placeholders, {npts} points')
    assert len(dropped) == 41 and all(x['ref'] == 'ibata2024' for x in dropped), dropped
    assert len(streams) == 100 and n_gc == 23 and n_const == 39, (len(streams), n_gc, n_const)
    assert max(len(s['points']) for s in streams) <= MAX_STREAM_POINTS
    report['streams'] = dict(kept=len(streams), dropped=len(dropped), great_circle=n_gc, constant=n_const,
                             track=n_track, approx=n_approx, both=n_both, points=npts, flag_mismatch=flag_mismatch,
                             default=len(on), total=len(rows))
    if flag_mismatch:
        log(f'  note: {len(flag_mismatch)} tracks where InfoFlags bit 1 disagrees with the file '
            f'(constant vs varying distance): {flag_mismatch[:6]}')
    return streams, dropped


# ---------------------------------------------------------------- 4. spiral-arm fits (SpiralMap 0.27)
REID_NAMES = {'3-kpc': '3-kpc arm', 'Norma': 'Norma arm', 'Sct-Cen': 'Scutum–Centaurus arm',
              'Sgr-Car': 'Sagittarius–Carina arm', 'Local': 'Local arm', 'Perseus': 'Perseus arm',
              'Outer': 'Outer arm'}
DRIMMEL_NAMES = {'Scutum': 'Scutum arm', 'Sag-Car': 'Sagittarius–Carina arm', 'Orion': 'Orion (Local) arm',
                 'Perseus': 'Perseus arm'}


def reid_params():
    src = S.spiralmap('models').decode('utf-8')
    start = src.index('class reid_spiral(object):')
    end = src.index('class main_(object):', start)
    blk = src[start:end]
    arms = re.search(r"self\.arms = np\.array\(\[([^\]]*)\]\)", blk).group(1)
    arms = re.findall(r"'([^']+)'", arms)
    P = {}
    for arm, body in re.findall(r"if arm == '([^']+)':[^\n]*\n\s*params = \{(.*?)\}", blk, re.S):
        P[arm] = {k: float(v) for k, v in re.findall(r"'(\w+)':\s*([-\d.]+)", body)}
    assert list(P) == arms == list(REID_NAMES), (list(P), arms)
    r0 = float(re.search(r'Rreid = ([\d.]+)', blk).group(1))
    assert 'Model taken from their Table 2.' in text_of(S.spiralmap_docs())
    return P, r0


def reid_R(p, beta_deg):
    beta = np.radians(beta_deg)
    bk = np.radians(p['beta_kink'])
    psi = np.radians(np.where(beta_deg < p['beta_kink'], p['pitch_low'], p['pitch_high']))
    return p['R_kink'] * np.exp(-(beta - bk) * np.tan(psi))


def reid_betas(p):
    lo, hi, k = p['beta_min'], p['beta_max'], p['beta_kink']
    b = np.arange(lo, hi + 1e-9, REID_STEP_DEG)
    b = np.unique(np.concatenate([b, [hi, k] if lo <= k <= hi else [hi]]))
    return b


def maser_check(P, r0_fit):
    """Reid+2014 masers (galkin, no licence; build-time only): which sign of y fits the arms."""
    amap = {'Loc': 'Local', 'Per': 'Perseus', 'Sgr': 'Sgr-Car', 'Sct': 'Sct-Cen', 'Out': 'Outer',
            '3-k': '3-kpc', '4-k': 'Norma'}
    rows = []
    for line in text_of(S.galkin_reid14()).splitlines()[1:]:
        m = re.match(r'\s*\d\s+G(\d+\.\d+)([+-]\d+\.\d+)', line)
        mm = re.search(r'(\d\d \d\d \d\d\.\d+)\s+([+-]\d\d \d\d \d\d\.\d+)\s+(\S+)\s+(\S+)', line)
        if not m or not mm:
            continue
        rows.append((float(m.group(1)), float(m.group(2)), float(mm.group(3)), line.split()[-1]))
    assert len(rows) == 103, len(rows)
    res = {}
    for sign in (+1, -1):
        per = {}
        for l, b, plx, arm in rows:
            if arm not in amap:
                continue
            d = 1.0 / plx
            X = d * math.cos(math.radians(b)) * math.cos(math.radians(l))
            Y = d * math.cos(math.radians(b)) * math.sin(math.radians(l))
            x, y = X - r0_fit, Y
            beta = math.degrees(math.atan2(sign * y, -x))
            p = P[amap[arm]]
            per.setdefault(amap[arm], []).append(abs(math.hypot(x, y) - float(reid_R(p, np.array(beta)))))
        res[sign] = {a: (len(v), float(np.median(v))) for a, v in per.items()}
    main = ('Local', 'Perseus', 'Sgr-Car', 'Sct-Cen')
    for a in main:
        assert res[+1][a][1] < 0.4 and res[-1][a][1] > 0.7, (a, res[+1][a], res[-1][a])
    log('Reid arms vs Reid+2014 masers, median |R - R_fit| (kpc):  y = +R sin(beta): ' +
        ', '.join(f'{a} {res[+1][a][1]:.2f} (n={res[+1][a][0]})' for a in main) +
        ';  mirrored: ' + ', '.join(f'{a} {res[-1][a][1]:.2f}' for a in main))
    report['masers'] = {a: dict(n=res[+1][a][0], median_kpc=res[+1][a][1], mirrored_median_kpc=res[-1][a][1])
                        for a in res[+1]}
    return res


def build_reid(bibs):
    P, r0_fit = reid_params()
    maser_check(P, r0_fit)
    ref = bib_ref(bibs['Reid:2019'])
    arms = []
    for key, p in P.items():
        beta = reid_betas(p)
        R = reid_R(p, beta)
        x, y = -R * np.cos(np.radians(beta)), R * np.sin(np.radians(beta))
        arms.append({
            'name': REID_NAMES[key], 'key': key, 'ref': ref,
            'width_kpc': p['width'],
            'beta_range_deg': [p['beta_min'], p['beta_max']], 'beta_kink_deg': p['beta_kink'],
            'r_kink_kpc': p['R_kink'], 'pitch_deg': [p['pitch_low'], p['pitch_high']],
            'r0_fit_kpc': r0_fit,
            'points': [[rnd(a, 3), rnd(c, 3), 0.0] for a, c in zip(x, y)],
            'note': (f'A fit, not a picture: the Reid et al. 2019 (Table 2) log-spiral fitted to maser '
                     f'parallaxes, drawn only over the azimuths it was fitted to (beta '
                     f'{p["beta_min"]:g} to {p["beta_max"]:g} deg).'),
        })
    log(f'Reid+2019 arms: {len(arms)}, {sum(len(a["points"]) for a in arms)} points; fitted with R0 = {r0_fit} kpc')
    return arms, P, r0_fit


class _NumpyOnly(pickle.Unpickler):
    def find_class(self, module, name):
        if module.startswith('numpy'):
            return super().find_class(module, name)
        raise pickle.UnpicklingError(f'refusing {module}.{name}')


def build_drimmel(bibs, reid_P):
    D = _NumpyOnly(io.BytesIO(S.spiralmap('drimmel2024'))).load()
    models = S.spiralmap('models').decode('utf-8')
    # what SpiralMap itself draws: variant '1', mean of the 'strength' and 'prom' estimates
    assert "# best phi range:\n\t\tphi_range = np.deg2rad(np.sort(self.spirals['1']['phi_range'].copy()))" in models
    assert "pang = (spirals['1']['arm_attributes'][arm]['arm_pang_strength']+spirals['1']['arm_attributes'][arm]['arm_pang_prom'])/2." in models
    assert 'lgrarm = lnr0 - np.tan(np.deg2rad(pang))*phi' in models
    assert 'ygc = np.exp(lgrarm)*np.sin(phi)' in models and 'xgc = -np.exp(lgrarm)*np.cos(phi)' in models
    variants = {}
    for k in sorted(D, key=str):
        v = D[k]
        att = v['arm_attributes']
        variants[str(k)] = dict(phi_range_deg=[float(x) for x in np.sort(v['phi_range'])], n_cepheids=int(v['N_Cephs']),
                                arms_fitted=[str(a) for a in att if np.isfinite(att[a]['arm_pang_strength'])])
    v = D[DRIMMEL_VARIANT]
    phi_lo, phi_hi = [float(x) for x in np.sort(v['phi_range'])]
    ref = bib_ref(bibs['Drimmel_Ceph_2024'])
    arms = []
    for arm, at in v['arm_attributes'].items():
        pang = (float(at['arm_pang_strength']) + float(at['arm_pang_prom'])) / 2
        lnr0 = (float(at['arm_lgr0_strength']) + float(at['arm_lgr0_prom'])) / 2
        assert math.isfinite(pang) and math.isfinite(lnr0)
        phi = np.arange(phi_lo, phi_hi + 1e-9, DRIMMEL_STEP_DEG)
        R = np.exp(lnr0 - np.tan(np.radians(pang)) * np.radians(phi))
        x, y = -R * np.cos(np.radians(phi)), R * np.sin(np.radians(phi))
        arms.append({
            'name': DRIMMEL_NAMES[str(arm)], 'key': str(arm), 'ref': ref,
            'pitch_deg': rnd(pang, 3), 'ln_r0': rnd(lnr0, 6), 'r_at_phi0_kpc': rnd(math.exp(lnr0), 3),
            'phi_range_deg': [phi_lo, phi_hi],
            'points': [[rnd(a, 3), rnd(c, 3), 0.0] for a, c in zip(x, y)],
            'note': (f'A fit, not a picture: the Drimmel et al. 2024 log-spiral fitted to young classical '
                     f'Cepheids, drawn only over the azimuths it was fitted to (phi {phi_lo:g} to {phi_hi:g} deg, '
                     f'the side of the Sun towards Galactic longitudes 180-360 deg).'),
        })
    # where the two arm models sit at the Sun's azimuth (beta = phi = 0)
    reid_local0 = float(reid_R(reid_P['Local'], np.array(0.0)))
    orion0 = math.exp([a for a in arms if a['key'] == 'Orion'][0]['ln_r0'])
    report['drimmel'] = dict(variant=DRIMMEL_VARIANT, n_cepheids=int(v['N_Cephs']), reid_local_R0=reid_local0,
                             drimmel_orion_R0=orion0, offset=orion0 - reid_local0, variants=variants)
    log(f"Drimmel+2024 arms: variant '{DRIMMEL_VARIANT}' (phi {phi_lo:g}..{phi_hi:g} deg, {int(v['N_Cephs'])} "
        f"Cepheids), {len(arms)} arms; at the Sun's azimuth Orion R = {orion0:.3f} kpc vs Reid Local "
        f"{reid_local0:.3f} kpc ({orion0 - reid_local0:+.3f} kpc)")
    return arms, variants


# ---------------------------------------------------------------- 5. Gaia young-star overdensity maps
YOUNG = {
    'gaiadr3_ob': dict(file='young-gaiadr3-ob.png', grid='gaiadr3_grid', x='gaiadr3_x', y='gaiadr3_y',
                       bib='Gaia_2022', spiralmap_model='GaiaPVP_cont_2022',
                       title='OB stars, Gaia DR3 (Gaia Collaboration, Drimmel et al. 2023)',
                       tracer='OB stars selected with Gaia DR3 astrometry and astrophysical parameters'),
    'poggio2021_ums': dict(file='young-poggio2021-ums.png', grid='poggio_grid', x='poggio_x', y='poggio_y',
                           bib='Poggio_2021', spiralmap_model='Poggio_cont_2021',
                           title='Upper-main-sequence stars, Gaia EDR3 (Poggio et al. 2021)',
                           tracer='upper-main-sequence (young, hot) stars selected with Gaia EDR3 astrometry'),
}


def young_image(G):
    """121 x 121 grid G[ix, iy] (x towards the Galactic centre, y towards l = 90 deg) -> RGBA rows:
    row 0 = the largest y, column 0 = the smallest x (the view from the North Galactic Pole)."""
    img_v = G.T[::-1, :]
    mask = img_v == 0.0
    code = np.clip(np.round((img_v - YOUNG_LO) / (YOUNG_HI - YOUNG_LO) * 255.0), 0, 255).astype(np.uint8)
    code[mask] = 0
    rgba = np.zeros(img_v.shape + (4,), np.uint8)
    rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = code
    rgba[..., 3] = np.where(mask, 0, 255).astype(np.uint8)
    return rgba, mask


def png_bytes(arr, mode):
    from PIL import Image
    im = Image.fromarray(arr)                     # uint8 (H, W) -> 'L', (H, W, 4) -> 'RGBA'
    assert im.mode == mode, (im.mode, mode)
    buf = io.BytesIO()
    im.save(buf, format='PNG', optimize=False, compress_level=9)
    return buf.getvalue()


def build_young(GC, fr, bibs):
    import astropy.units as u
    from astropy.coordinates import CartesianRepresentation, Galactic, SkyCoord
    docs = text_of(S.spiralmap_docs())
    sun = fr['sun']
    files, placement = {}, {}
    extent = None
    for key, spec in YOUNG.items():
        G = S.spiralmap_npy(spec['grid'])
        xv = S.spiralmap_npy(spec['x'])
        yv = S.spiralmap_npy(spec['y'])
        n = G.shape[0]
        assert G.shape == (121, 121) and G.dtype == np.float64 and not np.isnan(G).any()
        assert np.allclose(xv, np.linspace(-6, 6, 121), atol=1e-12) and np.array_equal(xv, yv)
        dx = float(xv[1] - xv[0])
        # exact placement of every grid node: heliocentric Galactic Cartesian (x -> l = 0, y -> l = 90,
        # in the plane b = 0) into the Galactocentric frame, against the flat rectangle shipped
        X, Y = np.meshgrid(xv, yv, indexing='ij')
        g = SkyCoord(Galactic(CartesianRepresentation(X.ravel(), Y.ravel(), np.zeros(X.size), unit=u.kpc))).transform_to(GC)
        gx, gy, gz = (c.to_value(u.kpc) for c in (g.x, g.y, g.z))
        dev = float(np.hypot(gx - (sun[0] + X.ravel()), gy - (sun[1] + Y.ravel())).max())
        placement[key] = dict(max_offset_kpc=dev, z_min=float(gz.min()), z_max=float(gz.max()))
        ext = [sun[0] + xv[0] - dx / 2, sun[0] + xv[-1] + dx / 2, sun[1] + yv[0] - dx / 2, sun[1] + yv[-1] + dx / 2]
        ext = rnd(ext, 6)
        assert extent is None or extent == ext
        extent = ext
        rgba, mask = young_image(G)
        data = png_bytes(rgba, 'RGBA')
        common.write_bin(f'{OUT}/{spec["file"]}', data)
        R_h = np.hypot(X, Y)
        cover = {f'{a}-{b}_kpc': float(np.mean(G[(R_h >= a) & (R_h < b)] != 0.0)) for a, b in ((0, 3), (3, 4), (4, 5), (5, 6))}
        vals = G[~(G == 0.0)]
        clipped = int(np.sum(G == G.max()))
        # the SpiralMap docs line that states the permission, checked verbatim
        assert f'`{spec["spiralmap_model"]}`' in docs
        files[key] = {
            'file': f'{OUT}/{spec["file"]}', 'width': n, 'height': n, 'bytes': len(data),
            'title': spec['title'], 'ref': bib_ref(bibs[spec['bib']]), 'tracer': spec['tracer'],
            'extent_kpc': ext, 'z_kpc': rnd(sun[2], 4),
            'cell_kpc': rnd(dx, 6),
            'encoding': {'channels': 'R = G = B = code, A = 255 where measured, 0 where the grid has no data',
                         'lo': YOUNG_LO, 'hi': YOUNG_HI,
                         'formula': 'overdensity = lo + code / 255 * (hi - lo)   (only where A = 255)',
                         'step': rnd((YOUNG_HI - YOUNG_LO) / 255, 6)},
            'value_range': rnd([vals.min(), vals.max()], 4),
            'cells_with_data': int((~mask).sum()), 'cells': int(mask.size),
            'coverage_by_distance_from_sun': {k: rnd(v, 3) for k, v in cover.items()},
            'cells_at_max': clipped,
        }
        log(f'young map {key}: {int((~mask).sum())}/{mask.size} cells with data, values '
            f'{vals.min():.3f}..{vals.max():.3f} ({clipped} cells at the maximum), {len(data):,} B PNG; '
            f'coverage ' + ', '.join(f'{k} {v:.0%}' for k, v in cover.items()) +
            f'; flat placement vs astropy: {dev * 1e6:.0f} micro-kpc')
    young = {
        'files': files,
        'extent_kpc': extent,
        'what': ('How much young stars crowd together compared with their smooth large-scale density '
                 '(overdensity, dimensionless: 0 = average, > 0 more, < 0 fewer), measured from Gaia '
                 'parallaxes on 0.1 kpc cells within 6 kpc of the Sun. The maps are published data '
                 'products (kernel-smoothed), not star lists. Gaia measures young stars well only to '
                 'about 4 kpc: beyond that most cells hold no data and are transparent.'),
        'orientation': ('Face-on, seen from the North Galactic Pole (+z). Column c (0 = left) and row r '
                        '(0 = top) of the W x H image cover x = x0 + (c + 0.5)(x1 - x0)/W and '
                        'y = y1 - (r + 0.5)(y1 - y0)/H, with extent_kpc = [x0, x1, y0, y1] in this '
                        'frame: +x (right) towards the Galactic centre, +y (up) towards l = 90 deg. '
                        'Each pixel centre is one node of the published grid (heliocentric, 0.1 kpc). '
                        'In three.js a PlaneGeometry(x1 - x0, y1 - y0) centred on the extent, lying in '
                        'the x-y plane, with its default UVs and texture.flipY = true shows it the '
                        'right way round.'),
        'plane': ('The grids are projections onto the Galactic plane b = 0 through the Sun. That plane '
                  f'lies {placement["poggio2021_ums"]["z_min"] * 1000:.1f} to '
                  f'{placement["poggio2021_ums"]["z_max"] * 1000:.1f} pc above z = 0 across the map; '
                  'z_kpc places the image flat at the Sun\'s height. Placing the grid nodes exactly '
                  'with astropy instead of on the flat rectangle moves none of them by more than '
                  f'{max(p["max_offset_kpc"] for p in placement.values()) * 1e6:.0f} micro-kpc.'),
        'orientation_source': ('SpiralMap plots the grids as contourf(x, y, grid.T), i.e. grid[ix, iy] with '
                               'x heliocentric towards the Galactic centre (x_gc = x_hc + x_sun) and y towards '
                               'l = 90 deg. verify_galaxy.py confirms it on the shipped PNGs: young open '
                               'clusters (UCC, younger than 50 Myr) sit on about twice the mean overdensity in '
                               'this orientation than in any of the other 7 flips and transposes.'),
        'licence_note': ('Gaia-derived maps, included in SpiralMap 0.27 with the authors\' permission; '
                         'ESA/Gaia/DPAC data terms (CC BY-NC 3.0 IGO, non-commercial) are taken to apply.'),
        'refs': [files[k]['ref'] for k in sorted(files)],
    }
    report['young'] = placement
    return young


# ---------------------------------------------------------------- 6. disc + bar model image
def read_ini(path):
    sec, out = None, {}
    for line in text_of(path).splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('['):
            sec = line.strip('[]')
            out[sec] = {}
            continue
        k, v = [s.strip() for s in line.split('=', 1)]
        out[sec][k] = v
    return out


def bar_density_function():
    """makeBarDensity() from the pinned Agama script, run with agama.Density stubbed to return its
    density function (the script's own numpy code evaluates the model)."""
    src = text_of(S.agama('bar'))
    head, sep, _main = src.partition("if __name__ == '__main__':")
    assert sep, 'script layout changed'
    head = head.replace('import agama, numpy, matplotlib.pyplot as plt', 'import agama, numpy')
    stub = types.ModuleType('agama')
    stub.Density = lambda *a, **k: a[0] if a else None
    saved = sys.modules.get('agama')
    sys.modules['agama'] = stub
    try:
        ns = {'__name__': 'agama_example_mw_bar_potential'}
        exec(compile(head, 'example_mw_bar_potential.py', 'exec'), ns)
        rho = ns['makeBarDensity']()
    finally:
        if saved is None:
            sys.modules.pop('agama', None)
        else:
            sys.modules['agama'] = saved
    m = re.search(r'bar_angle = (-?[\d.]+) \* numpy\.pi/180  # orientation of the bar w\.r\.t\. the Sun', src)
    assert m and float(m.group(1)) == BAR_ANGLE_DEG, 'bar angle in the script differs'
    assert "ax[1].plot(o[:,0]*cosa-o[:,1]*sina, o[:,0]*sina+o[:,1]*cosa" in src
    assert "ax[1].plot(-8.2,0.0, 'ko', ms=5)  # Solar position" in src
    assert 'Omega = -39.0  # km/s/kpc - the value is negative since the potential rotates clockwise' in src
    return rho, src


def gauss_z_nodes(order):
    edges = [0.0, 0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0]
    t, w = np.polynomial.legendre.leggauss(order)
    zs, ws = [], []
    for a, b in zip(edges[:-1], edges[1:]):
        zs.append((b - a) / 2 * t + (a + b) / 2)
        ws.append((b - a) / 2 * w)
    return np.concatenate(zs), np.concatenate(ws)


def bar_surface_density(rho, xb, yb, order):
    """Sigma(x, y) = 2 * int_0^8kpc rho(x, y, z) dz (the model is symmetric in z)."""
    zs, ws = gauss_z_nodes(order)
    out = np.zeros(xb.size)
    chunk = max(1, 200000 // zs.size)
    with np.errstate(all='ignore'):
        for i in range(0, xb.size, chunk):
            xs, ys = xb[i:i + chunk], yb[i:i + chunk]
            m = xs.size
            P = np.column_stack([np.repeat(xs, zs.size), np.repeat(ys, zs.size), np.tile(zs, m)])
            r = rho(P).reshape(m, zs.size)
            assert np.all(np.isfinite(r)), 'bar density not finite'
            out[i:i + chunk] = 2.0 * (r @ ws)
    return out


def build_model():
    ini = read_ini(S.agama('mcmillan17'))
    assert text_of(S.agama('mcmillan17')).startswith('#best-fit potential from McMillan(2017)')
    thin, thick = ini['Potential thin disk'], ini['Potential thick disk']
    for d in (thin, thick):
        assert d['type'] == 'Disk' and 'innerCutoffRadius' not in d and float(d['scaleHeight']) > 0
    S0t, Rt, ht = (float(thin[k]) for k in ('surfaceDensity', 'scaleRadius', 'scaleHeight'))
    S0T, RT, hT = (float(thick[k]) for k in ('surfaceDensity', 'scaleRadius', 'scaleHeight'))
    rho, src = bar_density_function()

    N, H = MODEL_N, MODEL_HALF
    c = -H + (np.arange(N) + 0.5) * (2 * H / N)          # pixel centres, kpc
    x = np.tile(c, N)                                     # row-major: row r = y from the top
    y = np.repeat(c[::-1], N)
    R = np.hypot(x, y)
    sig_disc = S0t * np.exp(-R / Rt) + S0T * np.exp(-R / RT)

    a = math.radians(BAR_ANGLE_DEG)
    xb = x * math.cos(a) + y * math.sin(a)                # Galactocentric -> bar frame, R(-a)
    yb = -x * math.sin(a) + y * math.cos(a)
    sig_bar = bar_surface_density(rho, xb, yb, 24)        # the whole square (long bar 2 reaches far)
    # quadrature converged? (twice the nodes, on a sample of pixels)
    samp = np.arange(R.size)[::97]
    fine = bar_surface_density(rho, xb[samp], yb[samp], 48)
    qerr = float(np.max(np.abs(fine - sig_bar[samp]) / np.maximum(fine, 1e-300)))
    assert qerr < 1e-6, qerr
    # how much the bar still adds at R >= 10 kpc (reported)
    ring = R >= 10.0
    edge = float(np.max(sig_bar[ring] / sig_disc[ring]))
    sig = sig_disc + sig_bar

    # log10 stretch: white = the maximum (2 significant digits, rounded up), black = the disc's
    # surface density at R = 20 kpc (2 significant digits, rounded up), so the model fades to zero
    # just inside the +-20 kpc square instead of ending at its edge
    def up2(v):
        e = math.floor(math.log10(v)) - 1
        return math.ceil(v / 10 ** e) * 10 ** e
    white = up2(float(sig.max()))
    black = up2(S0t * math.exp(-H / Rt) + S0T * math.exp(-H / RT))
    v = (np.log10(sig) - math.log10(black)) / (math.log10(white) - math.log10(black))
    code = np.clip(np.round(v * 255), 0, 255).astype(np.uint8).reshape(N, N)
    data = png_bytes(code, 'L')
    common.write_bin(f'{OUT}/model.png', data)

    # measured: where the bar's major axis points in the image (second moments of the bar alone)
    w, xi, yi = sig_bar, x, y
    Ixx, Iyy, Ixy = (w * xi * xi).sum(), (w * yi * yi).sum(), (w * xi * yi).sum()
    pa = 0.5 * math.degrees(math.atan2(2 * Ixy, Ixx - Iyy))
    near_end_l = math.degrees(math.atan2(3 * math.sin(math.radians(pa + 180)),
                                         3 * math.cos(math.radians(pa + 180)) + 8.122))
    sig_sun = S0t * math.exp(-8.122 / Rt) + S0T * math.exp(-8.122 / RT)
    report['model'] = dict(bytes=len(data), white=white, black=black, max=float(sig.max()), qerr=qerr, edge=edge,
                           bar_pa=pa, bar_near_end_l=near_end_l, sigma_sun=sig_sun,
                           bar_mass=float(sig_bar.sum() * (2 * H / N) ** 2))
    log(f'model: {N}x{N} over +-{H:g} kpc, Sigma max {sig.max():.3e} Msun/kpc^2, black {black:.2g}, white '
        f'{white:.2g}; bar major axis at {pa:.2f} deg (script: {BAR_ANGLE_DEG:g}), a point 3 kpc out on its '
        f'near end is at l = {near_end_l:+.1f} deg; z-quadrature {qerr:.1e}; {len(data):,} B PNG')
    assert abs(pa - BAR_ANGLE_DEG) < 0.5, pa

    bar_head = src.split("'''")[1]
    model = {
        'file': f'{OUT}/model.png', 'width': N, 'height': N, 'bytes': len(data),
        'extent_kpc': [-H, H, -H, H], 'z_kpc': 0.0,
        'what': ('A MODEL, not an image: the face-on stellar surface density of two published mass '
                 'models added together - the McMillan (2017) thin and thick discs and the Portail et '
                 'al. (2017) bar in the analytic form of Sormani et al. (2022). Nothing here was '
                 'photographed; it shows where the models put the stars.'),
        'quantity': 'stellar surface density Sigma, Msun per kpc^2 (grayscale code, see stretch)',
        'orientation': ('Face-on from the North Galactic Pole, like the young-star maps: column c, row r '
                        '(row 0 = top) covers x = x0 + (c + 0.5)(x1 - x0)/W, y = y1 - (r + 0.5)(y1 - y0)/H; '
                        '+x right towards the Galactic centre from the Sun, +y up towards l = 90 deg.'),
        'stretch': {'type': 'log10', 'black_msun_kpc2': black, 'white_msun_kpc2': white,
                    'formula': 'code = round(255 * clip((log10 Sigma - log10 black) / (log10 white - log10 black), 0, 1))',
                    'inverse': 'Sigma = black * (white / black) ** (code / 255)   (code 0 means Sigma <= black)',
                    'why': ('white is the map maximum and black the disc surface density at R = 20 kpc, each '
                            'rounded up to 2 significant digits, so the disc fades to zero just inside the '
                            'square')},
        'components': [],
        'bar_angle_deg': BAR_ANGLE_DEG,
        'refs': [],
    }
    # scale heights and vertical profiles straight from the parameter arrays in the script
    parr = re.search(r'params = numpy\.array\(\s*(.*?)\n    \)', src, re.S).group(1)
    nums = [float(t) for t in re.findall(r'-?\d+\.\d+e[+-]\d+', parr)]
    assert len(nums) == 33, len(nums)
    xbar, lb1, lb2 = nums[:13], nums[13:23], nums[23:33]
    model['scale_heights_kpc'] = {
        'thin': ht, 'thick': hT,
        'bar_x_shaped': rnd(xbar[3], 6), 'long_bar_1': rnd(lb1[3], 6), 'long_bar_2': rnd(lb2[3], 6),
    }
    model['vertical_profiles'] = {
        'thin': 'exp(-|z| / h): Agama Disk with a positive scaleHeight',
        'thick': 'exp(-|z| / h): Agama Disk with a positive scaleHeight',
        'bar_x_shaped': 'z0 of the X-shaped bar (Coleman et al. 2020 form): 1/cosh(a^m) with a built from |x|/x0, |y|/y0, |z|/z0',
        'long_bar_1': 'sech^2(z / h)', 'long_bar_2': 'sech^2(z / h)',
    }
    model['components'] = [
        {'name': 'thin stellar disc', 'model': 'McMillan (2017), Agama data/McMillan17.ini',
         'surface_density_msun_kpc2': S0t, 'scale_radius_kpc': Rt, 'scale_height_kpc': ht,
         'sigma': 'Sigma0 exp(-R / Rd)'},
        {'name': 'thick stellar disc', 'model': 'McMillan (2017), Agama data/McMillan17.ini',
         'surface_density_msun_kpc2': S0T, 'scale_radius_kpc': RT, 'scale_height_kpc': hT,
         'sigma': 'Sigma0 exp(-R / Rd)'},
        {'name': 'bar (X-shaped short bar + two long bars)',
         'model': 'Portail et al. (2017) analytic approximation, Sormani et al. 2022; Agama py/example_mw_bar_potential.py makeBarDensity()',
         'parameters': 33, 'angle_deg': BAR_ANGLE_DEG,
         'angle_note': ('bar_angle = -25 deg "orientation of the bar w.r.t. the Sun" in the script (Sun '
                        'at x = -8.2 kpc there); its major axis points to -25 / 155 deg, the near end on '
                        'the l > 0 side (a point 3 kpc out along it lies at l = '
                        f'{near_end_l:+.1f} deg). The script says the model fits the central ~5 kpc and is '
                        '"not very realistic further out".'),
         'sigma': 'rho integrated over z by Gauss-Legendre quadrature (0-8 kpc, x2)',
         'measured_major_axis_deg': rnd(pa, 3)},
    ]
    model['not_included'] = ('McMillan\'s axisymmetric bulge and HI / H2 gas discs, the Sormani model\'s own '
                             'disc and central mass concentration, and every dark-matter halo: the image is '
                             'the two stellar discs plus the bar only.')
    model['refs'] = ['McMillan (2017): "#best-fit potential from McMillan(2017)" (Agama data/McMillan17.ini)',
                     'Portail et al. (2017) bar, analytic approximation of ' +
                     re.search(r'Reference: (Sormani et al\. 2022 \(MNRAS Letters/514/L5\))', bar_head).group(1) +
                     ' (Agama py/example_mw_bar_potential.py)']
    return model


# ---------------------------------------------------------------- 7. credits
def write_credits(counts, left_out, streams, dropped, drimmel_variants):
    import json
    L = report['lvdb']
    st = report['streams']
    ms = report['masers']
    dr = report['drimmel']
    mo = report['model']
    lic_lvdb = quoted(S.lvdb('LICENSE'), 'Creative Commons Legal Code', 'CC0 1.0 Universal')
    ack_lvdb = quoted(S.lvdb('README'), 'If you use this in your research please cite the overview paper and '
                      'include a link to the github repository (https://github.com/apace7/local_volume_database).')
    gs = S.galstreams_members(['LICENSE'])['LICENSE']
    lic_gs = quoted(gs, 'BSD 3-Clause License', 'Copyright (c) 2017, Cecilia Mateu')
    lic_sm = quoted(S.spiralmap('licence'), 'MIT License', 'Copyright (c) [2025] [Prusty & Khanna]',
                    'Permission is hereby granted, free of charge, to any person obtaining a copy')
    docs = S.spiralmap_docs()
    perm_maps = quoted(docs, 'Data is available publicly, and also included in the package with their permission.')
    perm_ceph = quoted(docs, 'Model is publicly available but also included in the package as a userfriendly '
                       'pickle file, with their permission.')
    lic_ag = quoted(S.agama('LICENSE'), 'the original source code of Agama itself is not subject to GPL and is '
                    'provided under the less restrictive BSD or MIT licenses.',
                    'Permission is granted to anyone to use this software for any purpose, and to alter it and '
                    'redistribute it freely. Acknowledgement of the original author is appreciated.')
    import astropy
    lic_ap = os.path.join(os.path.dirname(os.path.dirname(astropy.__file__)), 'astropy-7.1.0.dist-info', 'licenses', 'LICENSE.rst')
    lic_ap = quoted(lic_ap, 'Copyright (c) 2011-2024, Astropy Developers',
                    'Redistribution and use in source and binary forms, with or without modification, are '
                    'permitted provided that the following conditions are met:')
    lic_galpy = quoted(S.galpy('licence'), 'Copyright (c) 2010, Jo Bovy')
    lic_ucc = quoted(S.ucc('LICENSE'), 'GNU GENERAL PUBLIC LICENSE', 'Version 3, 29 June 2007')
    lic_sk = quoted(S.skowron('LICENSE'), 'This data is NOT licenced under the MIT or CC licenses.')
    lic_galkin = quoted(S.galkin_pkginfo(), 'License: UNKNOWN')
    q = lambda parts, where: ' / '.join(f'"{p}"' for p in parts) + f' ({where})'
    gaia_terms = ('ESA/Gaia/DPAC data terms: CC BY-NC 3.0 IGO (non-commercial). ESA\'s licence page could '
                  'not be read from the build network; a web-search summary of '
                  'cosmos.esa.int/web/gaia-users/license gives CC BY-NC 3.0 IGO, and CelestiaContent\'s '
                  'Gaia-derived data/stars.dat.license states the same (see the sky backdrop block).')
    n_gc = counts['gc_harris'][1] + counts['gc_mw_new'][1]
    blocks = [
        dict(id='galaxy-frame', title='Galactocentric frame: astropy parameter set "v4.0"',
             owner='The Astropy Developers (astropy 7.1.0); parameters from the papers cited in the frame',
             source=('astropy.coordinates.Galactocentric, galactocentric_frame_defaults "v4.0", read from the '
                     'pinned astropy 7.1.0 installed from PyPI (module file sha256 dfc1b53d...): R0 = 8.122 kpc '
                     '(2018A&A...615L..15G), z_sun = 20.8 pc (2019MNRAS.482.1417B), the Galactic-centre '
                     'direction galcen_coord at ICRS (266.4051, -28.936175) deg, i.e. Galactic l = b = 0 '
                     '(2004ApJ...616..872R), roll 0.'),
             url='https://pypi.org/project/astropy/7.1.0/',
             licence='BSD-3-Clause', licence_quote=q(lic_ap, 'astropy-7.1.0.dist-info/licenses/LICENSE.rst'),
             retrieved=common.RETRIEVED,
             adaptations=('Every galaxy layer is converted into this frame at build time; the 4x4 matrix to ICRS is '
                          'computed with astropy from transformed points and shipped in galaxy.json.'),
             accuracy=(f"The shipped matrix reproduces astropy's own transformation to "
                       f"{report['frame']['roundtrip_max_kpc']:.1e} kpc for {report['frame']['n']:,} points out to "
                       '300 kpc. R0 = 8.122 kpc is GRAVITY 2018, the value the pinned astropy cites; other pinned '
                       'sources use other values: the Reid+2019 arms were fitted with R0 = 8.15 kpc and the '
                       'Drimmel+2024 arms appear to use about 8.28 kpc (SpiralMap\'s default Rsun is 8.277 kpc); '
                       'both are placed with their own Galactocentric radii.')),
        dict(id='lvdb', title='Local Volume Database v1.1.1 (globular clusters and satellite galaxies)',
             owner=('Andrew B. Pace and contributors (Pace 2025, The Open Journal of Astrophysics 8, 142); '
                    'every distance is from the paper cited on its row' +
                    (f" (LVDB cites none for {', '.join(L['no_ref'])})" if L['no_ref'] else '')),
             source=('Tables gc_harris, gc_mw_new and dwarf_mw at tag v1.1.1 (commit 72dabf78), sha256-pinned. '
                     f"Globular-cluster distances are mostly Baumgardt & Vasiliev 2021 ({L['n_baumgardt']} of {n_gc}); "
                     'the other clusters and the satellites each cite the paper their distance comes from.'),
             url=f'https://github.com/apace7/local_volume_database/tree/{S.LVDB_COMMIT}',
             licence='CC0 1.0 Universal (public domain dedication); the README asks for a citation and a link',
             licence_quote=q(lic_lvdb, 'LICENSE') + '; ' + q(ack_lvdb, 'README.md'),
             retrieved=common.RETRIEVED,
             adaptations=(f'{n_gc} Milky Way globular clusters (gc_harris {counts["gc_harris"][1]} + gc_mw_new '
                          f'{counts["gc_mw_new"][1]} with confirmed_real = 1) and {counts["dwarf_mw"][1]} satellite '
                          'galaxies (dwarf_mw with confirmed_real = 1, including the LMC and SMC) converted from '
                          'RA, Dec and distance to Galactocentric kpc. Left out: the '
                          f'{len(left_out["gc_mw_new_candidates"])} unconfirmed cluster candidates, the '
                          f'{len(left_out["gc_ambiguous"])} systems LVDB classes as ambiguous (cluster or dwarf), '
                          f'and {len(left_out["dwarf_mw_unconfirmed"])} unconfirmed dwarfs. Distance, half-light '
                          'radius (LVDB rhalf_physical, major axis), ellipticity, position angle, M_V and the '
                          'distance reference are shipped as catalogued.'),
             accuracy=(f"Recomputing each object's Galactocentric distance reproduces LVDB's own distance_gc to "
                       f"{L['distance_gc_max_diff_kpc'] * 1000:.1f} pc at most (median "
                       f"{L['distance_gc_median_diff_kpc'] * 1000:.1f} pc, {L['n_compared']} objects), so LVDB used "
                       'the same frame. Distances equal 10^(DM/5 + 1) pc to '
                       f"{L['dm_distance_max_rel'] * 100:.2f} %; the shipped distance errors come from the "
                       'catalogued distance-modulus errors (LVDB leaves the kpc errors of the Harris clusters at '
                       '0). verify_galaxy.py cross-checks the cluster distances against galpy 1.12.0.')),
        dict(id='galstreams', title='galstreams 1.2.1: Milky Way stellar-stream tracks',
             owner='Cecilia Mateu (Mateu 2023, MNRAS 520, 5225) and the authors of each track, named per stream',
             source=('PyPI sdist galstreams-1.2.1.tar.gz (sha256 bb98b85f...): lib/master_log.txt, the default '
                     '("On") track of each stream and its summary file with InfoFlags.'),
             url=S.GALSTREAMS_URL, licence='BSD-3-Clause', licence_quote=q(lic_gs, 'LICENSE'),
             retrieved=common.RETRIEVED,
             adaptations=(f"{st['kept']} of the {st['default']} default tracks. Dropped: the {st['dropped']} "
                          "Ibata et al. 2024 tracks whose distance is 1.000 kpc everywhere - a placeholder, not a "
                          'measurement. Kept but marked approximate: '
                          f"{st['constant']} tracks with one published distance for the whole track, {st['approx']} "
                          'whose distance varies but is not a measured track (interpolated between published '
                          'end-point distances, one mean Galactocentric distance, an orbit prediction, or '
                          'reciprocal parallaxes galstreams flags "with caution"), and the '
                          f"{st['great_circle']} tracks whose sky path is a great circle by construction "
                          f"(InfoFlags bit 0 = 0; they overlap the others). {st['both']} tracks have both a traced "
                          'path and a measured distance track. Each track decimated to at most '
                          f'{MAX_STREAM_POINTS} evenly indexed points ({st["points"]:,} in all) and converted to '
                          'Galactocentric kpc; each carries a note saying what is approximate about it.'),
             accuracy=('These are smoothed tracks fitted to member stars by each paper, not the stars. Stream '
                       'widths (typically a fraction of a degree) are not drawn.')),
        dict(id='reid2019-arms', title='Spiral-arm fit to maser parallaxes (Reid et al. 2019, Table 2) - a model',
             owner='M. J. Reid, K. M. Menten, A. Brunthaler et al. (ApJ 885, 131); transcribed in SpiralMap by '
                   'A. Prusty and S. Khanna',
             source='SpiralMap 0.27 wheel (sha256 1688e0b0...), SpiralMap/models_.py reid_spiral.getparams',
             url=SPIRALMAP_PYPI, licence='MIT (SpiralMap)', licence_quote=q(lic_sm, 'LICENSE.md'),
             retrieved=common.RETRIEVED,
             adaptations=('Seven kinked log-spirals R = R_kink exp(-(beta - beta_kink) tan psi) sampled every '
                          f'{REID_STEP_DEG:g} deg only over each arm\'s fitted beta range, x = -R cos beta, '
                          'y = +R sin beta, z = 0; the table\'s arm widths are shipped as they are.'),
             accuracy=('A fit, labelled as one. The sign of y was checked at build time against the Reid et al. '
                       '2014 maser parallaxes (galkin; not shipped): median |R - R_fit| ' +
                       ', '.join(f'{a} {ms[a]["median_kpc"]:.2f} kpc (n={ms[a]["n"]})' for a in
                                 ('Local', 'Perseus', 'Sgr-Car', 'Sct-Cen')) +
                       '; the mirrored convention gives ' +
                       ', '.join(f'{ms[a]["mirrored_median_kpc"]:.2f}' for a in ('Local', 'Perseus', 'Sgr-Car', 'Sct-Cen')) +
                       ' kpc. Fitted with R0 = 8.15 kpc, drawn in a frame with 8.122 kpc.')),
        dict(id='drimmel2024-arms', title='Spiral-arm fit to classical Cepheids (Drimmel et al. 2024) - a model',
             owner='R. Drimmel, S. Khanna, E. Poggio and D. M. Skowron (arXiv:2406.09127)',
             source=('SpiralMap 0.27 wheel, SpiralMap/datafiles/Drimmel2024_cepheids/ArmAttributes_dyoungW1_bw025.pkl '
                     '(sha256 178a547d...), read with a numpy-only unpickler'),
             url=SPIRALMAP_PYPI, licence='MIT (SpiralMap); the fit parameters are included with the authors\' permission',
             licence_quote=q(lic_sm[:2], 'LICENSE.md') + '; ' + q(perm_ceph, 'SpiralMap docs models_available.rst.txt @3f0c3aa0'),
             retrieved=common.RETRIEVED,
             adaptations=(f"Variant '{DRIMMEL_VARIANT}' of the nine azimuth-range fits in the file (phi "
                          f"{dr['variants'][DRIMMEL_VARIANT]['phi_range_deg'][0]:g} to "
                          f"{dr['variants'][DRIMMEL_VARIANT]['phi_range_deg'][1]:g} deg, {dr['n_cepheids']:,} "
                          "Cepheids) - the one SpiralMap draws and labels its best phi range, and one of the two "
                          'variants that fit all four arms. Pitch angle and ln R0 are the mean of the "strength" and '
                          '"prom" estimates, as SpiralMap does; ln R = ln R0 - tan(pitch) phi, x = -R cos phi, '
                          f'y = R sin phi, sampled every {DRIMMEL_STEP_DEG:g} deg only over the fitted range. The '
                          'paper itself could not be read from the build network, so which variant it calls '
                          'primary was not checked there.'),
             accuracy=(f"A fit, labelled as one. It disagrees with the maser fit: at the Sun's azimuth the Orion "
                       f"arm lies at R = {dr['drimmel_orion_R0']:.2f} kpc, the Reid Local arm at "
                       f"{dr['reid_local_R0']:.2f} kpc ({dr['offset']:+.2f} kpc). The fits appear to assume R0 near "
                       '8.28 kpc: SpiralMap\'s default Rsun is 8.277, and in this frame the young Cepheids of '
                       'Skowron et al. 2019 peak about ln(8.122/8.277) = -0.019 in ln R inside the Scutum and '
                       'Sagittarius-Carina fits (verify_galaxy.py; Perseus -0.055, Orion shows no clear peak).')),
        dict(id='gaia-young-maps', title='Where young stars crowd: Gaia overdensity maps (Poggio et al. 2021; '
                                         'Gaia Collaboration, Drimmel et al. 2023)',
             owner=('E. Poggio, R. Drimmel, T. Cantat-Gaudin et al. (A&A 651, A104) and Gaia Collaboration, '
                    'R. Drimmel et al. (A&A 674, A37); Gaia data ESA/Gaia/DPAC'),
             source=('SpiralMap 0.27 wheel: datafiles/Poggio_cont_2021/overdens_grid_locscale03.npy (sha256 '
                     'a5e3388f...) and datafiles/GaiaPVP_cont_2022/over_dens_grid_threshold_0_003_dens.npy '
                     '(65a9b05d...) with their axis arrays'),
             url=SPIRALMAP_PYPI,
             licence=('Non-commercial: included in SpiralMap (MIT) with the authors\' permission; derived from Gaia, '
                      'so the ESA/Gaia/DPAC terms (CC BY-NC 3.0 IGO) are taken to apply. The permission was given '
                      'to SpiralMap; no separate grant to downstream redistributors was found.'),
             licence_quote=q(perm_maps, 'SpiralMap docs models_available.rst.txt @3f0c3aa0') + '; ' + gaia_terms,
             retrieved=common.RETRIEVED,
             adaptations=('Each 121 x 121 grid (0.1 kpc cells, 6 kpc around the Sun) written as an RGBA PNG at its '
                          f'native resolution: overdensity encoded linearly ({YOUNG_LO:g} to {YOUNG_HI:g} -> 0-255) '
                          'in R = G = B, alpha 0 on the cells that hold exactly 0.0 (no data). Placed around the '
                          'Sun in the Galactocentric frame; orientation checked against young open clusters '
                          '(UCC, build-time only).'),
             accuracy=('Kernel-smoothed overdensity maps, not star lists. Coverage falls off beyond about 4 kpc '
                       '(cells with data at 4-5 kpc: ' +
                       ', '.join(f"{k} {v:.0%}" for k, v in (
                           (k, report['young_cover'][k]) for k in sorted(report['young_cover']))) +
                       '). The Gaia DR3 map is clipped at 1.30 by its producers. 8-bit storage: +-0.005.')),
        dict(id='mw-disc-bar-model', title='Disc and bar glow: McMillan (2017) discs + Portail (2017) / '
                                           'Sormani (2022) bar - a model',
             owner=('P. J. McMillan (2017 best-fit Milky Way mass model); M. Portail et al. (2017) bar, analytic '
                    'fit by M. C. Sormani et al. (2022); both as distributed with Agama by E. Vasiliev'),
             source=(f'Agama commit {S.AGAMA_COMMIT[:8]}: data/McMillan17.ini (sha256 2fa000f9...) and '
                     'py/example_mw_bar_potential.py (sha256 a1c3f49e...), makeBarDensity() evaluated in numpy'),
             url=f'https://github.com/GalacticDynamics-Oxford/Agama/tree/{S.AGAMA_COMMIT}',
             licence='Agama licence: BSD or MIT for Agama\'s own source (GPL only when linked with GSL)',
             licence_quote=q(lic_ag, 'Agama LICENSE'),
             retrieved=common.RETRIEVED,
             adaptations=(f'Face-on surface density on {MODEL_N} x {MODEL_N} pixels over +-{MODEL_HALF:g} kpc: the '
                          'thin and thick stellar discs (Sigma0 exp(-R/Rd)) plus the bar density integrated over z, '
                          f'the bar turned to {BAR_ANGLE_DEG:g} deg as in the script; log10 stretch (black '
                          f'{mo["black"]:.2g}, white {mo["white"]:.2g} Msun/kpc^2) into an 8-bit grayscale PNG. '
                          "McMillan's bulge and gas discs are not added. The scale heights are shipped for "
                          'giving the glow its thickness.'),
             accuracy=('A model, not an observation, and labelled so: it shows where the fitted mass models put '
                       'the stars, with no spiral arms. The bar model is fitted to the central ~5 kpc; the '
                       f'measured major axis of the drawn bar is {mo["bar_pa"]:.2f} deg.')),
        dict(id='galaxy-checks', title='Used only to check the galaxy layer (build time, not shipped)',
             owner=('galpy 1.12.0 (Jo Bovy; BSD-3); galkin (M. Pato & F. Iocco) Reid et al. 2014 maser table; '
                    'Unified Cluster Catalogue (Perren et al. 2023); Skowron et al. 2019 Cepheids (J. Skowron)'),
             source=('galpy named_objects.json (globular-cluster distances), galkin data_Reid14.dat @ef9c4eab '
                     '(sign convention of the Reid arms), UCC clusters_26061511.csv.gz @20ce90ee (orientation of '
                     'the young-star maps), galactic_cepheids data/Data_Table_1.dat @e72dc56a (geometry of the '
                     'Drimmel arms). All sha256-pinned.'),
             url=S.GALPY_URL,
             licence='Not shipped. galpy BSD-3; galkin no licence; UCC GPL-3.0; Skowron data explicitly not licensed',
             licence_quote=(q(lic_galpy, 'galpy LICENSE') + '; ' + q(lic_galkin, 'galkin PKG-INFO') + '; ' +
                            q(lic_ucc, 'UCC LICENSE') + '; ' + q(lic_sk, 'galactic_cepheids data/LICENSE')),
             retrieved=common.RETRIEVED,
             adaptations='None: read at build time for the checks in 50_galaxy.py and verify_galaxy.py only.',
             accuracy=('The numbers these checks measure (galpy distance agreement, maser offsets from the Reid '
                       'arms, the orientation test of the young-star maps, the Cepheid offsets from the Drimmel '
                       'arms) are printed by verify_galaxy.py and quoted in the blocks above.')),
    ]
    os.makedirs(os.path.join(TOOLS, 'credits'), exist_ok=True)
    with open(os.path.join(TOOLS, 'credits', 'galaxy.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(blocks, indent=1, ensure_ascii=False, sort_keys=True) + '\n')


SPIRALMAP_PYPI = 'https://pypi.org/project/SpiralMap/0.27/'


# ---------------------------------------------------------------- main
def main():
    warnings.simplefilter('ignore', category=UserWarning)
    GC, frame, fr = build_frame()
    lv, left_out, counts = build_lvdb(GC)
    streams, dropped = build_streams(GC)
    bibs = parse_bib(S.spiralmap('bib').decode('utf-8'))
    reid, reid_P, r0_fit = build_reid(bibs)
    drimmel, variants = build_drimmel(bibs, reid_P)
    young = build_young(GC, fr, bibs)
    report['young_cover'] = {k: v['coverage_by_distance_from_sun']['4-5_kpc'] for k, v in young['files'].items()}
    model = build_model()

    dr = report['drimmel']
    for a in drimmel:
        a['r0_fit_note'] = ('SpiralMap draws these fits with its default Rsun = 8.277 kpc, and placed in this '
                            'frame the young Cepheids of Skowron et al. 2019 sit about ln(8.122/8.277) in ln R '
                            'inside the Scutum and Sagittarius-Carina fits (verify_galaxy.py), so the fits appear '
                            'to assume R0 near 8.28 kpc. Placed with their own Galactocentric radii.')
    out = {
        'format': 'Milky Way galaxy layer v1 (CONTRACT.md section 8)',
        'units': 'kpc, Galactocentric (see frame); angles in degrees',
        'frame': frame,
        'arms_reid2019': reid,
        'arms_drimmel2024': drimmel,
        'arms_note': ('Two published spiral-arm FITS, not pictures, drawn in different styles because they '
                      'disagree: the maser fit (Reid et al. 2019) covers mainly the l < 180 deg side of the Sun, '
                      'the Cepheid fit (Drimmel et al. 2024) the l > 180 deg side, and at the Sun\'s azimuth '
                      f"their Local/Orion arms are {dr['offset']:.2f} kpc apart. Each is drawn only where it was "
                      'fitted. width_kpc (Reid) is the arm width of Table 2 as SpiralMap transcribes it; SpiralMap '
                      'draws the band edges at (R_kink +- width/2) exp(-(beta - beta_kink) tan psi).'),
        'drimmel_variants': variants,
        'globulars': lv['globulars'],
        'satellites': lv['satellites'],
        'lvdb_selection': {
            'globulars': 'LVDB v1.1.1 gc_harris (all confirmed) + gc_mw_new with confirmed_real = 1',
            'satellites': 'LVDB v1.1.1 dwarf_mw with confirmed_real = 1 (host "lmc" = a satellite of the LMC)',
            'left_out': left_out,
            'fields': {'xyz': 'Galactocentric kpc (0.1 pc steps)', 'dist_kpc': 'heliocentric distance, kpc',
                       'dist_err_kpc': '[minus, plus] error, kpc, from the catalogued distance-modulus errors', 'rhalf_pc': 'major-axis half-light radius, pc',
                       'mv': 'absolute V magnitude', 'ellipticity': '1 - b/a', 'pa_deg': 'position angle on the '
                       'sky, degrees east of north', 'galaxy_confirmed': 'LVDB confirmed_galaxy (dark-matter '
                       'dominated galaxy confirmed); false = could still be a star cluster',
                       'ref': 'the paper the distance comes from (author year (ADS bibcode))'},
        },
        'streams': streams,
        'streams_note': ('galstreams 1.2.1 default tracks (Mateu 2023). quality "track": a published distance '
                         'track that varies along the stream; "approximate-distance": the distance varies but is not '
                         'a measured track (interpolated between end points, one mean Galactocentric distance, an '
                         'orbit prediction, or parallaxes galstreams flags "with caution" - see note); '
                         '"constant-distance": one published distance for the whole track. great_circle: the sky '
                         'path is a great circle constructed between published end points. approximate = quality is '
                         'not "track", or great_circle: draw these fainter or dashed and show note. Dropped: '
                         f'{len(dropped)} Ibata et al. 2024 tracks with a 1-kpc placeholder distance.'),
        'streams_dropped': sorted(d['track'] for d in dropped),
        'young': young,
        'model': model,
    }
    common.write_json(f'{OUT}/galaxy.json', out, ndigits=15)

    sizes = {n: os.path.getsize(os.path.join(DATA, OUT, n)) for n in sorted(os.listdir(os.path.join(DATA, OUT)))}
    total = sum(sizes.values())
    log('sizes: ' + ', '.join(f'{k} {v:,}' for k, v in sizes.items()) + f'; total {total:,} B of {BUDGET:,}')
    assert total <= BUDGET, total
    write_credits(counts, left_out, streams, dropped, variants)
    log('credits: tools/credits/galaxy.json')


if __name__ == '__main__':
    main()
