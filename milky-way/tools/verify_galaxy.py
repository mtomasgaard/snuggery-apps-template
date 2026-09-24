#!/usr/bin/env python3
"""Checks the galaxy files the app relies on (CONTRACT.md section 8) and prints what it measured.

Reads data/galaxy/* and, for the independent checks, the pinned sources (galaxy_sources.py; all
cached by 50_galaxy.py, so no network). Exits non-zero if any check fails. Also writes a fixture
(tools/.cache/work/galaxy_fixture.json) that tools/test_galaxy.mjs compares js/galaxydata.js with.

Independent checks (nothing from these sources is shipped):
  * astropy recomputes the frame matrix; every globular cluster and satellite goes back through the
    shipped to_icrs matrix to RA, Dec and distance and is compared with the LVDB rows.
  * galpy 1.12.0 named_objects.json: globular-cluster distances matched by position.
  * galstreams tracks re-read and re-converted; decimated points compared with the shipped ones.
  * Reid+2014 masers (galkin) placed with astropy against the shipped Reid arms and their mirror.
  * Skowron+2019 Cepheids against the shipped Drimmel arms: the ln R offset of the best fit.
  * UCC young open clusters and the Reid arms sampled on the shipped young-star PNGs under all 8
    flips/transposes: the documented orientation must win.
  * model.png decoded through the documented stretch and compared with the disc formula plus an
    independent scipy.integrate.quad of the bar density; the bar's major axis measured on the image.
"""
import csv
import gzip
import io
import json
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import galaxy_sources as S
from paths import APP, DATA, TOOLS, WORK

G = os.path.join(DATA, 'galaxy')
fails = []
EXPECTED_FILES = ['galaxy.json', 'model.png', 'young-gaiadr3-ob.png', 'young-poggio2021-ums.png']


def check(cond, msg):
    print(('  ok    ' if cond else '  FAIL  ') + msg, flush=True)
    if not cond:
        fails.append(msg)


def png(name):
    from PIL import Image
    im = Image.open(os.path.join(DATA, name))
    return np.array(im), im.mode


def load_step():
    """50_galaxy.py as a module (its bib parser and bar-density loader)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('step50', os.path.join(TOOLS, '50_galaxy.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def pixel_centres(meta):
    x0, x1, y0, y1 = meta['extent_kpc']
    W, H = meta['width'], meta['height']
    xs = x0 + (np.arange(W) + 0.5) * (x1 - x0) / W
    ys = y1 - (np.arange(H) + 0.5) * (y1 - y0) / H
    return xs, ys


def sample(img, meta, x, y):
    """Nearest pixel of img (rows, cols[, ...]) at Galactocentric (x, y); NaN outside."""
    x0, x1, y0, y1 = meta['extent_kpc']
    W, H = meta['width'], meta['height']
    c = np.floor((x - x0) / (x1 - x0) * W).astype(int)
    r = np.floor((y1 - y) / (y1 - y0) * H).astype(int)
    ok = (c >= 0) & (c < W) & (r >= 0) & (r < H)
    out = np.full(x.shape, np.nan)
    out[ok] = img[r[ok], c[ok]]
    return out


def main():
    import astropy.units as u
    from astropy.coordinates import (ICRS, CartesianRepresentation, Galactic, Galactocentric, SkyCoord,
                                     galactocentric_frame_defaults)
    print('verify_galaxy')
    files = sorted(os.listdir(G))
    sizes = {f: os.path.getsize(os.path.join(G, f)) for f in files}
    for f, b in sizes.items():
        print(f'  {f:26s} {b:>9,d} B')
    total = sum(sizes.values())
    check(files == EXPECTED_FILES, f'data/galaxy holds exactly {EXPECTED_FILES}')
    check(total <= 600_000, f'galaxy total {total:,} B <= 600,000')
    with open(os.path.join(G, 'galaxy.json'), encoding='utf-8') as f:
        g = json.load(f)
    for k in ('frame', 'arms_reid2019', 'arms_drimmel2024', 'globulars', 'satellites', 'streams', 'young', 'model'):
        check(k in g, f'galaxy.json has "{k}"')
    fx = {}                                        # fixture for the node test

    # ------------------------------------------------------------ frame
    S.check_astropy()
    fr = g['frame']
    M = np.array(fr['to_icrs'], float)
    A, b = M[:3, :3], M[:3, 3]
    check(M.shape == (4, 4) and np.array_equal(M[3], [0, 0, 0, 1]), 'to_icrs is a 4x4 affine matrix')
    orth = float(np.abs(A @ A.T - np.eye(3)).max())
    check(orth < 1e-12 and abs(np.linalg.det(A) - 1) < 1e-12, f'rotation part orthonormal, det +1 ({orth:.1e})')
    GC = Galactocentric(**galactocentric_frame_defaults.get_from_registry('v4.0')['parameters'])
    rng = np.random.default_rng(7)
    q = rng.normal(size=(5000, 3)) * rng.uniform(0.001, 300, (5000, 1))
    gq = SkyCoord(ICRS(CartesianRepresentation(q.T * u.kpc))).transform_to(GC).cartesian.xyz.to_value(u.kpc).T
    err = float(np.abs(gq @ A.T + b - q).max())
    check(err < 1e-9, f'to_icrs reproduces astropy Galactocentric v4.0 -> ICRS to {err:.1e} kpc (5,000 points to 300 kpc)')
    sun = np.array(fr['sun_kpc'])
    s_icrs = A @ sun + b
    check(np.abs(s_icrs).max() < 1e-9, f'sun_kpc maps to the ICRS origin ({np.abs(s_icrs).max():.1e} kpc)')
    gcd = SkyCoord(ICRS(CartesianRepresentation(*b, unit=u.kpc)))
    sep = gcd.separation(SkyCoord(ra=fr['galcen_icrs_deg'][0] * u.deg, dec=fr['galcen_icrs_deg'][1] * u.deg)).arcsec
    check(abs(np.linalg.norm(b) - 8.122) < 1e-9 and sep < 1e-6,
          f'the Galactic centre lies 8.122 kpc from the Sun towards ICRS (266.4051, -28.936175) ({sep:.1e}")')
    lg = SkyCoord(ICRS(CartesianRepresentation(*(A @ np.array([0, 1.0, 0])), unit=u.kpc))).galactic
    check(abs(((lg.l.deg - 90 + 180) % 360) - 180) < 0.01 and abs(lg.b.deg) < 0.01,
          f'+y points to Galactic l = {lg.l.deg:.4f}, b = {lg.b.deg:.4f} deg')
    fx['frame_points'] = {'icrs': q[:200].tolist(), 'gc': gq[:200].tolist()}

    # ------------------------------------------------------------ LVDB back through the matrix
    lv = {}
    for t in ('gc_harris', 'gc_mw_new', 'dwarf_mw'):
        with open(S.lvdb(t), encoding='utf-8', newline='') as f:
            for r in csv.DictReader(f):
                lv[r['key']] = r
    objs = g['globulars'] + g['satellites']
    xyz = np.array([o['xyz'] for o in objs])
    hel = xyz @ A.T + b
    c = SkyCoord(ICRS(CartesianRepresentation(hel.T * u.kpc)))
    ra0 = np.array([float(lv[o['key']]['ra']) for o in objs])
    de0 = np.array([float(lv[o['key']]['dec']) for o in objs])
    d0 = np.array([float(lv[o['key']]['distance']) for o in objs])
    sep = c.separation(SkyCoord(ra=ra0 * u.deg, dec=de0 * u.deg)).arcsec
    rel = np.abs(np.linalg.norm(hel, axis=1) / d0 - 1)
    lim = 0.00005 * math.sqrt(3) / d0 * 206265 * 1.01         # 0.05 pc rounding per axis, in arcsec
    check(np.all(sep <= lim), f'{len(objs)} clusters and satellites return to their LVDB RA/Dec within the 0.1-pc '
          f'rounding (max {sep.max():.2f}", median {np.median(sep):.3f}")')
    check(rel.max() < 0.00005 * math.sqrt(3) / d0.min() * 1.01 + 1e-12,
          f'... and to their LVDB distance (max relative {rel.max():.1e})')
    check(len(g['globulars']) == 194 and len(g['satellites']) == 65,
          f"{len(g['globulars'])} globular clusters, {len(g['satellites'])} satellites")
    names = {o['name'] for o in g['satellites']}
    check({'LMC', 'SMC'} <= names, 'LMC and SMC present')
    check(all(o['host'] in ('mw', 'lmc') for o in g['satellites']), 'satellite hosts are mw or lmc')
    fx['lvdb'] = [{'key': o['key'], 'ra': float(lv[o['key']]['ra']), 'dec': float(lv[o['key']]['dec']),
                   'dist': float(lv[o['key']]['distance'])} for o in objs]

    # ------------------------------------------------------------ galpy cross-check of the GC distances
    no = json.loads(S.galpy('named_objects'))
    gp = [(k, v) for k, v in no.items() if not k.startswith('_') and isinstance(v, dict) and 'distance' in v
          and (k in no['_collections']['MWglobularclusters'] or
               (k.endswith('-missingvlos') and k[:-12] not in no['_collections']['MWsatellitegalaxies']))]
    gpc = SkyCoord(ra=[v['ra'] for _, v in gp] * u.deg, dec=[v['dec'] for _, v in gp] * u.deg)
    lg_ = g['globulars']
    lc = SkyCoord(ra=[float(lv[o['key']]['ra']) for o in lg_] * u.deg, dec=[float(lv[o['key']]['dec']) for o in lg_] * u.deg)
    idx, d2, _ = lc.match_to_catalog_sky(gpc)
    m = d2.arcmin < 1.0
    dl = np.array([o['dist_kpc'] for o in lg_])[m]
    dg = np.array([gp[i][1]['distance'] for i in idx[m]])
    rr = dg / dl - 1
    outl = sorted([(lg_[i]['name'], round(float(dg[j] / dl[j] - 1), 3)) for j, i in enumerate(np.flatnonzero(m))
                   if abs(dg[j] / dl[j] - 1) > 0.05], key=lambda t: -abs(t[1]))
    check(m.sum() >= 130 and abs(np.median(rr)) < 0.005,
          f'galpy 1.12.0: {int(m.sum())} clusters matched within 1\', median distance difference '
          f'{np.median(rr) * 100:+.2f} %, {int((np.abs(rr) < 0.01).sum())} within 1 %, > 5 %: {outl}')

    # ------------------------------------------------------------ streams
    st = g['streams']
    q_ = {k: sum(s['quality'] == k for s in st) for k in ('track', 'approximate-distance', 'constant-distance')}
    check(len(st) == 100 and sum(q_.values()) == 100, f'100 streams: {q_}')
    check(sum(s['great_circle'] for s in st) == 23, f"{sum(s['great_circle'] for s in st)} great circles flagged")
    check(len(g['streams_dropped']) == 41 and all(t.endswith('-I24') for t in g['streams_dropped']),
          f"{len(g['streams_dropped'])} dropped, all Ibata 2024 placeholders")
    check(all(2 <= len(s['points']) <= 120 for s in st), f"<= 120 points per stream (max {max(len(s['points']) for s in st)}, "
          f"{sum(len(s['points']) for s in st):,} in all)")
    check(all(s['approximate'] == (s['quality'] != 'track' or s['great_circle']) for s in st),
          'approximate = quality != track or great_circle')
    # re-read the galstreams files and re-convert
    step = load_step()
    wanted = {}
    ml = S.galstreams_members(['galstreams/lib/master_log.txt'])['galstreams/lib/master_log.txt'].decode()
    for line in ml.splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            p = line.split()
            wanted[p[2]] = f'galstreams/tracks/track.{p[0]}.{p[3]}.{p[4]}.ecsv'
    data = S.galstreams_members([wanted[s['track']] for s in st])
    from astropy.table import Table
    worst, worst_d = 0.0, 0.0
    for s in st:
        t = Table.read(data[wanted[s['track']]].decode(), format='ascii.ecsv')
        n = len(t)
        idx = np.unique(np.round(np.linspace(0, n - 1, min(n, 120))).astype(int))
        c = SkyCoord(ra=np.asarray(t['ra'])[idx] * u.deg, dec=np.asarray(t['dec'])[idx] * u.deg,
                     distance=np.asarray(t['distance'])[idx] * u.kpc).transform_to(GC)
        ref = np.column_stack([c.x.to_value(u.kpc), c.y.to_value(u.kpc), c.z.to_value(u.kpc)])
        worst = max(worst, float(np.abs(ref - np.array(s['points'])).max()))
        hd = np.linalg.norm(np.array(s['points']) @ A.T + b, axis=1)
        lo, hi = s['dist_range_kpc']
        worst_d = max(worst_d, float(max(lo - hd.min(), hd.max() - hi, 0)))
    check(worst <= 0.0005 + 1e-9, f'stream points equal a fresh astropy conversion of the galstreams tracks to {worst * 1000:.2f} pc')
    check(worst_d < 0.002, f'stream points lie within their dist_range_kpc (worst excursion {worst_d * 1000:.2f} pc)')

    # ------------------------------------------------------------ Reid arms: formula, range, masers
    P, r0fit = step.reid_params()
    bad = 0
    for a in g['arms_reid2019']:
        p = P[a['key']]
        pts = np.array(a['points'])
        beta = np.degrees(np.arctan2(pts[:, 1], -pts[:, 0]))
        R = np.hypot(pts[:, 0], pts[:, 1])
        inr = (beta >= p['beta_min'] - 0.02) & (beta <= p['beta_max'] + 0.02)     # 0.02 deg: the 1-pc rounding
        bad += int((~inr).sum()) + int((np.abs(R - step.reid_R(p, beta)) > 0.002).sum())
    check(bad == 0, f"Reid arms: every point inside its fitted beta range and on R(beta) ({sum(len(a['points']) for a in g['arms_reid2019'])} points)")
    amap = {'Loc': 'Local', 'Per': 'Perseus', 'Sgr': 'Sgr-Car', 'Sct': 'Sct-Cen'}
    ms = []
    for line in open(S.galkin_reid14(), encoding='utf-8').read().splitlines()[1:]:
        mm = re.match(r'\s*\d\s+G(\d+\.\d+)([+-]\d+\.\d+)', line)
        pp = re.search(r'(\d\d \d\d \d\d\.\d+)\s+([+-]\d\d \d\d \d\d\.\d+)\s+(\S+)\s+(\S+)', line)
        if mm and pp and line.split()[-1] in amap:
            ms.append((float(mm.group(1)), float(mm.group(2)), 1 / float(pp.group(3)), amap[line.split()[-1]]))
    mc = SkyCoord(Galactic(l=[m_[0] for m_ in ms] * u.deg, b=[m_[1] for m_ in ms] * u.deg,
                           distance=[m_[2] for m_ in ms] * u.kpc)).transform_to(GC)
    mxy = np.column_stack([mc.x.to_value(u.kpc), mc.y.to_value(u.kpc)])
    arms = {a['key']: np.array(a['points'])[:, :2] for a in g['arms_reid2019']}
    res = {}
    for sign in (1, -1):
        per = {}
        for (l_, b_, d_, arm), xy in zip(ms, mxy):
            pts = arms[arm] * [1, sign]
            per.setdefault(arm, []).append(float(np.min(np.hypot(*(pts - xy).T))))
        res[sign] = {k: float(np.median(v)) for k, v in per.items()}
    check(all(res[1][k] < 0.4 and res[1][k] < res[-1][k] for k in res[1]),
          'Reid+2014 masers (build-time only) sit on the shipped Reid arms, median distance to the arm: ' +
          ', '.join(f'{k} {v:.2f} kpc' for k, v in res[1].items()) + '; mirrored arms: ' +
          ', '.join(f'{k} {v:.2f}' for k, v in res[-1].items()))

    # ------------------------------------------------------------ Drimmel arms vs Skowron Cepheids
    for a in g['arms_drimmel2024']:
        pts = np.array(a['points'])
        phi = np.degrees(np.arctan2(pts[:, 1], -pts[:, 0]))
        R = np.hypot(pts[:, 0], pts[:, 1])
        Rf = np.exp(a['ln_r0'] - math.tan(math.radians(a['pitch_deg'])) * np.radians(phi))
        ok = np.all((phi >= -90 - 0.02) & (phi <= 0.02)) and np.abs(R - Rf).max() < 0.002
        check(ok, f"Drimmel {a['key']}: points on ln R = ln R0 - tan(pitch) phi within phi -90..0 deg")
    rows = [ln.split() for ln in open(S.skowron('table'), encoding='utf-8') if ln.strip() and not ln.startswith('#')]
    L_ = np.array([float(r[2]) for r in rows])
    B_ = np.array([float(r[3]) for r in rows])
    D_ = np.array([float(r[4]) for r in rows])
    AGE = np.array([float(r[6]) for r in rows])
    k = (D_ > 0) & (AGE < 150)
    cc = SkyCoord(Galactic(l=L_[k] * u.deg, b=B_[k] * u.deg, distance=D_[k] / 1000 * u.kpc)).transform_to(GC)
    cx, cy = cc.x.to_value(u.kpc), cc.y.to_value(u.kpc)
    R = np.hypot(cx, cy)
    phi = np.arctan2(cy, -cx)
    sel = (phi > np.radians(-90)) & (phi < 0) & (R < 16)
    lnR, ph = np.log(R[sel]), phi[sel]
    from scipy.stats import gaussian_kde
    offs = {}
    for a in g['arms_drimmel2024']:
        uu = lnR + math.tan(math.radians(a['pitch_deg'])) * ph
        kde = gaussian_kde(uu, bw_method=0.04 / np.std(uu))
        grid = np.linspace(a['ln_r0'] - 0.15, a['ln_r0'] + 0.15, 601)
        dens = kde(grid)
        peaks = [grid[i] - a['ln_r0'] for i in range(1, 600) if dens[i] > dens[i - 1] and dens[i] > dens[i + 1]]
        offs[a['key']] = min(peaks, key=abs) if peaks else float('nan')
    target = math.log(8.122 / 8.277)
    found = {k: v for k, v in offs.items() if np.isfinite(v)}
    check(len(found) >= 3 and all(abs(v) < 0.07 for v in found.values()) and np.median(list(found.values())) < 0,
          f'Skowron+2019 Cepheids younger than 150 Myr (build-time only, n={int(sel.sum())}): nearest density peak '
          'of ln R + tan(pitch) phi from each arm\'s ln R0: ' + ', '.join(f'{k} {v:+.3f}' if np.isfinite(v) else f'{k} none within 0.15' for k, v in offs.items()) +
          f' (ln(8.122/8.277) = {target:+.3f})')

    # ------------------------------------------------------------ young-star maps
    yg = g['young']
    fx['young'] = {}
    ucc_rows = list(csv.DictReader(io.TextIOWrapper(gzip.open(S.ucc('clusters')), encoding='utf-8')))
    yc = [r for r in ucc_rows if r['bad_oc'] == 'n' and r['dist'] not in ('', 'nan') and r['age'] not in ('', 'nan')
          and float(r['age']) < 50]
    uc = SkyCoord(Galactic(l=[float(r['GLON']) for r in yc] * u.deg, b=[float(r['GLAT']) for r in yc] * u.deg,
                           distance=[float(r['dist']) for r in yc] * u.kpc)).transform_to(GC)
    ux, uy = uc.x.to_value(u.kpc), uc.y.to_value(u.kpc)
    for key, meta in sorted(yg['files'].items()):
        arr, mode = png(meta['file'])
        check(mode == 'RGBA' and arr.shape == (meta['height'], meta['width'], 4), f'{key}: RGBA {arr.shape[1]}x{arr.shape[0]}')
        grid = S.spiralmap_npy(step.YOUNG[key]['grid'])
        img_v = grid.T[::-1, :]                                   # documented: row 0 = max y, col 0 = min x
        enc = meta['encoding']
        a = arr[..., 3]
        check(np.array_equal(a == 0, img_v == 0.0) and set(np.unique(a)) <= {0, 255},
              f'{key}: alpha 0 exactly on the {int((a == 0).sum())} no-data cells (grid == 0.0), 255 elsewhere')
        check(np.array_equal(arr[..., 0], arr[..., 1]) and np.array_equal(arr[..., 0], arr[..., 2]), f'{key}: R = G = B')
        dec = enc['lo'] + arr[..., 0] / 255 * (enc['hi'] - enc['lo'])
        e = float(np.abs(dec - img_v)[a == 255].max())
        check(e <= (enc['hi'] - enc['lo']) / 255 / 2 + 1e-12, f'{key}: decoded overdensity within half a step of the grid (max {e:.4f})')
        xs, ys = pixel_centres(meta)
        sun_x = g['frame']['sun_kpc'][0]
        check(np.allclose(xs - sun_x, np.linspace(-6, 6, 121), atol=1e-6) and np.allclose(ys, np.linspace(6, -6, 121), atol=1e-6),
              f'{key}: pixel centres are the grid nodes (heliocentric -6..6 kpc every 0.1)')
        # orientation: 8 flips / transposes of the decoded image, sampled (nearest pixel) at young open
        # clusters from UCC - the decisive test - and, for information only, along the Reid arms and at
        # the Reid+2014 masers (both too sparse or too symmetric to tell the flips apart)
        val = np.where(a == 255, dec, np.nan)
        variants = {}
        for T in (False, True):
            for fxp in (False, True):
                for fyp in (False, True):
                    v = val.T if T else val
                    v = v[:, ::-1] if fxp else v
                    v = v[::-1, :] if fyp else v
                    variants[('T' if T else '') + ('fx' if fxp else '') + ('fy' if fyp else '') or 'as shipped'] = v
        apts = np.vstack([np.array(aa['points'])[:, :2] for aa in g['arms_reid2019'] if aa['key'] in ('Local', 'Sgr-Car', 'Perseus')])
        near = np.hypot(apts[:, 0] - sun_x, apts[:, 1]) < 4
        score = {k: float(np.nanmean(sample(v, meta, ux, uy))) for k, v in variants.items()}
        arm_score = {k: float(np.nanmean(sample(v, meta, apts[near, 0], apts[near, 1]))) for k, v in variants.items()}
        maser_score = {k: float(np.nanmean(sample(v, meta, mxy[:, 0], mxy[:, 1]))) for k, v in variants.items()}
        others = max(v for k, v in score.items() if k != 'as shipped')
        rank = lambda d: 1 + sorted(d.values(), reverse=True).index(d['as shipped'])
        check(score['as shipped'] >= 1.5 * others,
              f'{key}: orientation - mean overdensity at {len(yc):,} UCC open clusters younger than 50 Myr (build-time '
              f'only): as shipped {score["as shipped"]:+.3f}, best of the other 7 flips/transposes {others:+.3f}')
        print(f'        (information: along the Reid arms within 4 kpc the shipped orientation ranks {rank(arm_score)} of 8 '
              f'({arm_score["as shipped"]:+.3f}), at the {len(mxy)} labelled masers {rank(maser_score)} of 8 '
              f'({maser_score["as shipped"]:+.3f}): too few or too symmetric to decide)')
        fx['young'][key] = {'grid_rows_top_first': np.round(img_v, 12).tolist()}

    # ------------------------------------------------------------ model.png
    mo = g['model']
    img, mode = png(mo['file'])
    check(mode == 'L' and img.shape == (mo['height'], mo['width']), f"model.png: 8-bit gray {img.shape[1]}x{img.shape[0]}")
    st_ = mo['stretch']
    blk, wht = st_['black_msun_kpc2'], st_['white_msun_kpc2']
    sig_img = blk * (wht / blk) ** (img / 255.0)
    comp = {c['name']: c for c in mo['components']}
    thin, thick = comp['thin stellar disc'], comp['thick stellar disc']
    xs, ys = pixel_centres(mo)
    X, Y = np.meshgrid(xs, ys)
    Rr = np.hypot(X, Y)
    disc = (thin['surface_density_msun_kpc2'] * np.exp(-Rr / thin['scale_radius_kpc']) +
            thick['surface_density_msun_kpc2'] * np.exp(-Rr / thick['scale_radius_kpc']))
    rho, _src = step.bar_density_function()
    from scipy.integrate import quad
    a_ = math.radians(mo['bar_angle_deg'])
    rs = np.random.default_rng(3)
    picks = [(int(r), int(c)) for r, c in zip(rs.integers(0, mo['height'], 400), rs.integers(0, mo['width'], 400))]
    picks += [(mo['height'] // 2 - 1 + i, mo['width'] // 2 - 1 + j) for i in range(2) for j in range(2)]
    worst_rel, fixture_pix, zero_bad = 0.0, [], 0
    for r_, c_ in picks:
        x, y = xs[c_], ys[r_]
        xb, yb = x * math.cos(a_) + y * math.sin(a_), -x * math.sin(a_) + y * math.cos(a_)
        f = lambda z: float(rho(np.array([[xb, yb, z]]))[0])
        with np.errstate(all='ignore'):
            sb = 2 * sum(quad(f, lo, hi, limit=200, epsabs=0, epsrel=1e-9)[0] for lo, hi in ((0, 0.5), (0.5, 2), (2, 8)))
        true = disc[r_, c_] + sb
        fixture_pix.append([r_, c_, true])
        if img[r_, c_] > 0:
            worst_rel = max(worst_rel, abs(sig_img[r_, c_] / true - 1))
        elif true > blk * (wht / blk) ** (0.5 / 255):
            zero_bad += 1
    half = (wht / blk) ** (0.5 / 255) - 1
    check(zero_bad == 0, f'model.png: code 0 only where Sigma is below black ({zero_bad} exceptions)')
    check(worst_rel <= half + 1e-6, f'model.png decodes to the disc formula + an independent quad() of the bar to '
          f'{worst_rel * 100:.2f} % over {len(picks)} pixels (half a code step = {half * 100:.2f} %)')
    resid = np.clip(sig_img - disc, 0, None) * (Rr < 5)
    Ixx, Iyy, Ixy = (resid * X * X).sum(), (resid * Y * Y).sum(), (resid * X * Y).sum()
    pa = 0.5 * math.degrees(math.atan2(2 * Ixy, Ixx - Iyy))
    check(abs(pa - mo['bar_angle_deg']) < 2, f'bar measured on the decoded image (image minus disc, R < 5 kpc): major axis '
          f'{pa:.2f} deg (model {mo["bar_angle_deg"]:g})')
    far = np.array([3 * math.cos(math.radians(pa + 180)), 3 * math.sin(math.radians(pa + 180))])
    lnear = math.degrees(math.atan2(far[1], far[0] - g['frame']['sun_kpc'][0]))
    check(lnear > 0 and far[0] < 0, f'the near end of the bar (x < 0) is at positive longitude (l = {lnear:+.1f} deg at 3 kpc)')
    corner = img[0, 0], img[0, -1], img[-1, 0], img[-1, -1]
    check(max(corner) == 0, 'the model fades to 0 before the corners of the square')
    fx['model_pixels'] = fixture_pix

    # ------------------------------------------------------------ credits and app code
    with open(os.path.join(TOOLS, 'credits', 'galaxy.json'), encoding='utf-8') as f:
        cr = json.load(f)
    need = {'id', 'title', 'owner', 'source', 'url', 'licence', 'licence_quote', 'retrieved', 'adaptations', 'accuracy'}
    check(all(need <= set(bk) for bk in cr), f'credits/galaxy.json: {len(cr)} blocks with all fields')
    js = os.path.join(APP, 'js', 'galaxydata.js')
    check(os.path.exists(js) and not re.search(r'https?://', open(js, encoding='utf-8').read()), 'js/galaxydata.js has no URL')

    os.makedirs(WORK, exist_ok=True)
    with open(os.path.join(WORK, 'galaxy_fixture.json'), 'w', encoding='utf-8') as f:
        json.dump(fx, f)
    print(f'  fixture: {os.path.relpath(os.path.join(WORK, "galaxy_fixture.json"), TOOLS)}')
    if fails:
        sys.exit(f'verify_galaxy: {len(fails)} check(s) failed')
    print('verify_galaxy: all checks passed')


if __name__ == '__main__':
    main()
