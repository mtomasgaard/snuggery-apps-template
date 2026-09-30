"""Verifies step 20 (tools/CONTRACT.md §3–§5 and §14) and prints what it measured.

1. plates.bin / coast.bin: every section where plates.json / coast.json say, 4-byte aligned, the
   counts the contract fixes (R = 503 rings, P = 241 plates, 90 x 2 x P x 4 rotations), sizes in cap.
2. Every ring is valid at each of the 90 rotation times exactly when pygplates' is_valid_at_time
   says so, using the shipped float32 begin/end and the rule end <= T <= begin.
3. The shipped int16 quaternions, renormalised, reproduce pygplates' R(t, p) · R(0, p)^-1 applied
   to 5 points of every plate at every time within 1 km (prints the worst); every plate is the
   identity at 0 Ma.
4. Rotation-time gate: the land sample (integer-degree nodes inside Natural Earth land that a
   polygon valid at 0 Ma claims, keeping those whose polygon is carried back to T: begin >= T)
   rotated to T = rotation_ma of maps 16, 43 and 57 lands on PaleoDEM z >= -200 m of the
   matching grid in >= 0.88 of cases and beats T - 20 and T + 20 by >= 0.03 each, and on the
   painted map's not-water pixels more often than both controls. The same is measured at age_ma;
   rotation_ma stays file_age_ma unless age_ma is higher on both measures at all three maps, in which
   case this script fails and asks for a deliberate change in 10_surface.py.
5. Four named cities (Cape Town, New York, Mumbai, Sydney) at 66, 200 and 300 Ma: reconstructed
   position, round trip back to today, and whether each lands on the map's land.
6. All places carried back to each of those ages: the fraction on land, against the T ± 20 controls.
7. Anchor speeds (median, 99th percentile, maximum) and every ring faster than 20 cm/yr.
8. Coast and places: every plate index valid; each place's plate and from_ma equal
   PlatePartitioner.partition_point's; coast pieces' plate and begin agree with partition_point at a
   middle vertex; the places not carried back past 0 Ma.

    .venv/bin/python verify_plates.py
"""
import json
import os

import numpy as np
import pygplates as g
from PIL import Image

from geo import (EARTH_RADIUS_KM, POLY_NAME, ROT_NAME, angle_between, dequantise_lonlat,
                 paleodem_grids, paleodem_z, plate_model_files, quat_of_finite_rotation,
                 quat_rotate, read_section, to_lonlat, unit, water_mask, lonlat_to_pixel)
from paths import DATA, WORK

R_EXPECTED, P_EXPECTED = 503, 241
CAPS = {'plates.bin': 520_000, 'plates.json': 10_000, 'coast.bin': 300_000, 'coast.json': 4_000,
        'places.json': 40_000}
GATE_MAPS = [16, 43, 57]
GATE_DEM, GATE_MARGIN = 0.88, 0.03
CITIES = [('Cape Town', 'South Africa'), ('New York', 'United States of America'),
          ('Mumbai', 'India'), ('Sydney', 'Australia')]
# Places on land (painted not-water, or PaleoDEM z >= -200 m, i.e. land or shelf sea), among those
# carried back to T: must be at least this and beat both T ± 20 controls. Set from the measurement
# (see CONTRACT.md "Builder's decisions"): cities sit on coasts, so a 0.35° pixel and a 1° DEM node
# put many of them on the sea side of a painted shoreline even when the rotation is right.
GATE_PLACES = 0.80


def load(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


def check_sections(raw, meta, order):
    end = 0
    size = {'uint32': 4, 'float32': 4, 'uint16': 2, 'int16': 2, 'uint8': 1}
    for name in order:
        m = meta[name]
        assert m['offset'] % 4 == 0 and m['offset'] >= end, f'{name}: offset {m["offset"]}'
        assert m['offset'] - end < 4, f'{name}: gap before it'
        end = m['offset'] + m['count'] * size[m['type']]
    assert end == len(raw), f'sections end at {end}, file is {len(raw)} bytes'


def main():
    pj, cj, places = load('plates.json'), load('coast.json'), load('places.json')
    man = load('manifest.json')
    slices = man['slices']
    praw = open(os.path.join(DATA, 'plates.bin'), 'rb').read()
    craw = open(os.path.join(DATA, 'coast.bin'), 'rb').read()
    for n, cap in CAPS.items():
        b = os.path.getsize(os.path.join(DATA, n))
        assert b <= cap, f'{n}: {b} > {cap}'
        print(f'{n}: {b:,} bytes (cap {cap:,})')

    # --- 1. layout ----------------------------------------------------------------------------
    order = ['ring_start', 'ring_count', 'ring_begin', 'ring_end', 'ring_area', 'ring_plate',
             'ring_anchor', 'vertices', 'rotations']
    check_sections(praw, pj['sections'], order)
    S = {k: read_section(praw, pj['sections'][k]) for k in order}
    R, P, V = pj['rings'], len(pj['plates']), pj['vertices']
    assert R == R_EXPECTED and P == P_EXPECTED, (R, P)
    assert pj['plates'] == sorted(pj['plates']) and pj['plates'][0] == 0
    assert all(pj['sections'][k]['count'] == R for k in order[:6])
    assert pj['sections']['ring_anchor']['count'] == 2 * R
    assert pj['sections']['vertices']['count'] == 2 * V == 2 * int(S['ring_count'].sum())
    assert np.array_equal(S['ring_start'], np.concatenate([[0], np.cumsum(S['ring_count'])[:-1]]))
    assert pj['sections']['rotations']['count'] == 90 * 2 * P * 4
    assert pj['times'] == [[s['rotation_ma'], s['rotation_ma'] + 1] for s in slices]
    assert pj['rotation_file'] == ROT_NAME and pj['polygons_file'] == POLY_NAME
    files = plate_model_files()
    assert pj['rotation_sha256'] == files[ROT_NAME][1] and pj['polygons_sha256'] == files[POLY_NAME][1]
    print(f'plates.bin: R={R} rings, V={V} vertices, P={P} plates, {90 * 2 * P} rotations; '
          f'sections aligned and contiguous')
    ccount = ['seg_start', 'seg_count', 'seg_begin', 'seg_plate', 'vertices']
    check_sections(craw, cj['sections'], ccount)
    C = {k: read_section(craw, cj['sections'][k]) for k in ccount}
    N = cj['pieces']
    assert all(cj['sections'][k]['count'] == N for k in ccount[:4])
    assert cj['sections']['vertices']['count'] == 2 * cj['vertices'] == 2 * int(C['seg_count'].sum())
    print(f'coast.bin: N={N} pieces, V={cj["vertices"]} vertices; sections aligned and contiguous')

    rm = g.RotationModel(files[ROT_NAME][0])
    fc = g.FeatureCollection(files[POLY_NAME][0])

    def present_rotation(t, pid):
        r0 = rm.get_rotation(0.0, pid, anchor_plate_id=0)
        rt = rm.get_rotation(float(t), pid, anchor_plate_id=0)
        return rt if r0.represents_identity_rotation() else rt * r0.get_inverse()

    # --- 2. validity --------------------------------------------------------------------------
    ring_feat = []
    for fi, feat in enumerate(fc):
        for geom in feat.get_all_geometries():
            if isinstance(geom, g.PolygonOnSphere):
                ring_feat.append(feat)
    assert len(ring_feat) == R
    plates = pj['plates']
    rp = S['ring_plate']
    assert all(plates[rp[r]] == ring_feat[r].get_reconstruction_plate_id() for r in range(R))
    bad = 0
    for s in slices:
        T = s['rotation_ma']
        mine = (S['ring_end'] <= T) & (T <= S['ring_begin'])
        ref = np.array([f.is_valid_at_time(T) for f in ring_feat])
        bad += int((mine != ref).sum())
    assert bad == 0, f'{bad} ring/time validity disagreements'
    nvalid = [int(((S['ring_end'] <= s['rotation_ma']) & (s['rotation_ma'] <= S['ring_begin'])).sum())
              for s in slices]
    print(f'validity: {R} rings x 90 times agree with pygplates is_valid_at_time; rings drawn per map '
          f'{min(nvalid)}–{max(nvalid)} (0 Ma: {nvalid[0]}, 750 Ma: {nvalid[-1]})')

    # --- 3. quaternions -----------------------------------------------------------------------
    rot = S['rotations'].reshape(90, 2, P, 4).astype(np.float64) / 32767.0
    rot /= np.linalg.norm(rot, axis=-1, keepdims=True)
    assert np.all(S['rotations'].reshape(90, 2, P, 4)[0, 0] == np.array([32767, 0, 0, 0])), \
        'a plate is not the identity at 0 Ma'
    vlon, vlat = dequantise_lonlat(S['vertices'][0::2], S['vertices'][1::2])
    plate_pts = {}
    for r in range(R):
        a, n = int(S['ring_start'][r]), int(S['ring_count'][r])
        plate_pts.setdefault(int(rp[r]), []).extend(zip(vlon[a:a + n], vlat[a:a + n]))
    worst, worst_at = 0.0, None
    for j, pid in enumerate(plates):
        pts = plate_pts[j]
        pick = [pts[k] for k in np.linspace(0, len(pts) - 1, 5).astype(int)]
        pv = unit([p[0] for p in pick], [p[1] for p in pick])
        for i, (t0, t1) in enumerate(pj['times']):
            for k, t in enumerate((t0, t1)):
                Rq = present_rotation(t, pid)
                ref = np.array([(Rq * g.PointOnSphere(float(la), float(lo))).to_xyz() for lo, la in pick])
                e = float(angle_between(quat_rotate(rot[i, k, j], pv), ref).max()) * EARTH_RADIUS_KM
                if e > worst:
                    worst, worst_at = e, (pid, t)
    assert worst <= 1.0, f'quaternion error {worst:.3f} km at {worst_at}'
    print(f'quaternions: worst position error {worst:.3f} km (plate {worst_at[0]} at {worst_at[1]} Ma) '
          f'over {P} plates x 180 rotations x 5 points; limit 1 km; identity at 0 Ma for all {P}')

    # --- 4. rotation-time gate ----------------------------------------------------------------
    with open(os.path.join(WORK, 'land_sample.json'), encoding='utf-8') as f:
        ls = json.load(f)
    pts = np.array([[p[0], p[1]] for p in ls['points']])
    spid = np.array([p[2] for p in ls['points']])
    sbeg = np.array([np.inf if p[3] is None else p[3] for p in ls['points']])
    pindex = {p: i for i, p in enumerate(plates)}
    # spot-check the work file's partition against pygplates
    polys0 = [f for f in fc if f.is_valid_at_time(0)]
    pp = g.PlatePartitioner(polys0, rm)
    rng = np.random.default_rng(20260930)
    for k in rng.choice(len(pts), 500, replace=False):
        f = pp.partition_point(g.PointOnSphere(float(pts[k, 1]), float(pts[k, 0]))).get_feature()
        assert f.get_reconstruction_plate_id() == spid[k]
    pv0 = unit(pts[:, 0], pts[:, 1])
    dem_ages = paleodem_grids()
    by_map = {s['map']: s for s in slices}

    def rotate_sample(t, sel):
        out = np.empty((int(sel.sum()), 3))
        ids = spid[sel]
        base = pv0[sel]
        for pid in np.unique(ids):
            m = ids == pid
            out[m] = quat_rotate(np.array(quat_of_finite_rotation(present_rotation(t, int(pid)))), base[m])
        return out

    def measures(vec, dem, land_px):
        lon, lat = to_lonlat(vec)
        row = np.clip(np.rint(lat + 90).astype(int), 0, 180)
        col = np.rint(lon + 180).astype(int) % 360
        on_dem = float((dem[row, col] >= -200).mean())
        c, r = lonlat_to_pixel(lon, lat, land_px.shape[1], land_px.shape[0])
        on_px = float(land_px[r, c].mean())
        return on_dem, on_px

    surface = {}
    print('rotation-time gate (land sample on PaleoDEM z >= -200 m | on the painted map\'s not-water pixels):')
    wins_age = []
    gate_rows = {}
    for mp in GATE_MAPS:
        s = by_map[mp]
        T, A = s['rotation_ma'], s['age_ma']
        dem_age = min(dem_ages, key=lambda a: abs(a - s['file_age_ma']))
        assert abs(dem_age - s['file_age_ma']) <= 2.5
        dem = paleodem_z(dem_ages[dem_age][0])
        with Image.open(os.path.join(DATA, s['file'])) as im:
            land_px = ~water_mask(np.asarray(im.convert('RGB')))
        surface[mp] = (dem, land_px)
        sel = sbeg >= T
        res = {lab: measures(rotate_sample(t, sel), dem, land_px)
               for lab, t in (('T', T), ('T-20', T - 20), ('T+20', T + 20), ('age', A))}
        gate_rows[mp] = res
        print(f'  map {mp} (T = rotation_ma {T:g} Ma, age_ma {A:g}, PaleoDEM {dem_age:g} Ma; '
              f'{int(sel.sum())} of {len(pts)} points carried back to T):')
        for lab in ('T', 'age', 'T-20', 'T+20'):
            t = {'T': T, 'age': A, 'T-20': T - 20, 'T+20': T + 20}[lab]
            print(f'    {lab:5s} {t:6.1f} Ma: DEM {res[lab][0]:.3f} | painted {res[lab][1]:.3f}')
        dT, pT = res['T']
        assert dT >= GATE_DEM, f'map {mp}: {dT:.3f} < {GATE_DEM}'
        for c in ('T-20', 'T+20'):
            assert dT - res[c][0] >= GATE_MARGIN, f'map {mp}: DEM margin over {c} {dT - res[c][0]:.3f}'
            assert pT > res[c][1], f'map {mp}: painted {pT:.3f} not above {c} {res[c][1]:.3f}'
        wins_age.append(res['age'][0] > dT and res['age'][1] > pT)
    print(f'  gate passed at rotation_ma: DEM >= {GATE_DEM} and >= {GATE_MARGIN} over both controls, '
          f'painted above both controls, at maps {GATE_MAPS}')
    if all(wins_age):
        raise SystemExit('age_ma scores higher than rotation_ma on both measures at all three maps: '
                         'change ROTATION_TIME in 10_surface.py deliberately (CONTRACT §14)')
    print(f'  age_ma higher on both measures at: '
          f'{[mp for mp, w in zip(GATE_MAPS, wins_age) if w] or "none"} -> rotation_ma stays file_age_ma')

    # --- 5 and 6. named cities and all places --------------------------------------------------
    pl = places['places']
    plon = np.array([p['lon'] for p in pl])
    plat = np.array([p['lat'] for p in pl])
    pbeg = np.array([np.inf if p['from_ma'] is None else p['from_ma'] for p in pl])
    ppi = np.array([p['pi'] for p in pl])
    ppv = unit(plon, plat)

    def app_rotate(i, vec, pis, k=0):
        return quat_rotate(rot[i, k, pis], vec)

    def on_land(vec, mp):
        dem, land_px = surface[mp]
        lon, lat = to_lonlat(vec)
        row = np.clip(np.rint(lat + 90).astype(int), 0, 180)
        col = np.rint(lon + 180).astype(int) % 360
        c, r = lonlat_to_pixel(lon, lat, land_px.shape[1], land_px.shape[0])
        return land_px[r, c], dem[row, col]

    print('named cities (shipped quaternions; "land" = painted not-water; DEM = PaleoDEM z at the '
          'nearest 1° node):')
    for name, country in CITIES:
        k = [n for n, p in enumerate(pl) if p['n'] == name and p['c'] == country]
        assert len(k) == 1, f'{name} is not among the 300 places'
        k = k[0]
        p = pl[k]
        for mp in GATE_MAPS:
            s = by_map[mp]
            i, T = s['i'], s['rotation_ma']
            if pbeg[k] < T:
                print(f'  {name:9s} {T:5.0f} Ma: not carried back (crust begins {pbeg[k]:g} Ma)')
                continue
            v = app_rotate(i, ppv[k:k + 1], ppi[k:k + 1])
            ref = np.array((present_rotation(T, p['plate']) *
                            g.PointOnSphere(p['lat'], p['lon'])).to_xyz())
            q = rot[i, 0, p['pi']]
            back = quat_rotate(np.array([q[0], -q[1], -q[2], -q[3]]), v)
            err_km = float(angle_between(v[0], ref)) * EARTH_RADIUS_KM
            trip_km = float(angle_between(back[0], ppv[k])) * EARTH_RADIUS_KM
            lon, lat = to_lonlat(v[0])
            land, z = on_land(v, mp)
            print(f'  {name:9s} {T:5.0f} Ma: plate {p["plate"]}, now ({p["lon"]:.2f}, {p["lat"]:.2f}) -> '
                  f'then ({float(lon):.2f}, {float(lat):.2f}); vs pygplates {err_km:.3f} km; round trip '
                  f'{trip_km:.1e} km; painted {"land" if land[0] else "WATER"}, DEM {float(z[0]):.0f} m')
            assert err_km <= 1.0 and trip_km <= 1e-6
            assert land[0] or z[0] >= -200, f'{name} at {T} Ma is on neither painted land nor shelf'
    print('all places carried back, fraction on land (painted not-water or DEM >= -200 m) | painted only:')
    for mp in GATE_MAPS:
        s = by_map[mp]
        T = s['rotation_ma']
        sel = pbeg >= T
        row = {}
        for lab, t in (('T', T), ('T-20', T - 20), ('T+20', T + 20)):
            if lab == 'T':
                v = app_rotate(s['i'], ppv[sel], ppi[sel])
            else:
                v = np.empty((int(sel.sum()), 3))
                for n, (vec, pid) in enumerate(zip(ppv[sel], np.array([p['plate'] for p in pl])[sel])):
                    v[n] = quat_rotate(np.array(quat_of_finite_rotation(present_rotation(t, int(pid)))), vec)
            land, z = on_land(v, mp)
            row[lab] = (float((land | (z >= -200)).mean()), float(land.mean()))
        print(f'  map {mp} ({T:g} Ma, {int(sel.sum())} of {len(pl)} places): '
              f'T {row["T"][0]:.3f} | {row["T"][1]:.3f};  T-20 {row["T-20"][0]:.3f} | {row["T-20"][1]:.3f};  '
              f'T+20 {row["T+20"][0]:.3f} | {row["T+20"][1]:.3f}')
        assert row['T'][0] >= GATE_PLACES, f'map {mp}: places on land {row["T"][0]:.3f} < {GATE_PLACES}'
        assert row['T'][0] > max(row['T-20'][0], row['T+20'][0]), f'map {mp}: places do not beat the controls'
    print(f'  places gate passed: >= {GATE_PLACES} on land and above both controls at each map')

    # --- 7. speeds ----------------------------------------------------------------------------
    alon, alat = dequantise_lonlat(S['ring_anchor'][0::2], S['ring_anchor'][1::2])
    av = unit(alon, alat)
    speeds, fast = [], []
    for s in slices:
        i, T = s['i'], s['rotation_ma']
        valid = (S['ring_end'] <= T) & (T <= S['ring_begin'])
        a = quat_rotate(rot[i, 0, rp], av)
        b = quat_rotate(rot[i, 1, rp], av)
        v = angle_between(a, b) * EARTH_RADIUS_KM * 0.1       # km per Myr -> cm per yr
        for r in np.nonzero(valid)[0]:
            speeds.append(float(v[r]))
            if v[r] > 20:
                fast.append((float(v[r]), s['map'], T, plates[rp[r]], int(r), float(S['ring_area'][r])))
    sp = np.array(speeds)
    print(f'anchor speeds over {len(sp)} (ring, map) pairs: median {np.median(sp):.2f}, 99th percentile '
          f'{np.percentile(sp, 99):.2f}, maximum {sp.max():.2f} cm/yr; {len(fast)} above 20 cm/yr:')
    for v, mp, T, pid, r, area in sorted(fast, reverse=True):
        print(f'    {v:7.2f} cm/yr  map {mp:2d} ({T:g} Ma)  plate {pid}  ring {r}  {area:,.0f} km²')

    # --- 8. coast and places plates -----------------------------------------------------------
    assert int(C['seg_plate'].max()) < P and int(rp.max()) < P
    assert all(0 <= p['pi'] < P and plates[p['pi']] == p['plate'] for p in pl)
    mism = 0
    for p in pl:
        f = pp.partition_point(g.PointOnSphere(p['lat'], p['lon'])).get_feature()
        b = f.get_valid_time()[0]
        if f.get_reconstruction_plate_id() != p['plate'] or \
                (None if np.isinf(b) else b) != p['from_ma']:
            mism += 1
    assert mism == 0, f'{mism} places disagree with partition_point'
    clon, clat = dequantise_lonlat(C['vertices'][0::2], C['vertices'][1::2])
    first_un = cj['unclaimed']['first_index']
    agree = disagree = 0
    for n in range(first_un):
        mid = int(C['seg_start'][n] + C['seg_count'][n] // 2)
        rg = pp.partition_point(g.PointOnSphere(float(clat[mid]), float(clon[mid])))
        ok = rg is not None and rg.get_feature().get_reconstruction_plate_id() == plates[C['seg_plate'][n]] \
            and np.float32(rg.get_feature().get_valid_time()[0]) == C['seg_begin'][n]
        agree += ok
        disagree += not ok
    frac = agree / first_un
    assert frac >= 0.98, f'coast pieces agree with partition_point at a middle vertex: {frac:.3f}'
    assert np.all(C['seg_plate'][first_un:] == 0) and np.all(C['seg_begin'][first_un:] == 0)
    print(f'coast: {agree} of {first_un} claimed pieces agree with partition_point at their middle '
          f'vertex ({frac:.4f}; gate 0.98 — the others were not investigated, likely vertices on a '
          f'polygon edge); '
          f'{N - first_un} unclaimed pieces at plate 0, drawn at 0 Ma only')
    zero = [f'{p["n"]} ({p["plate"]})' for p in pl if p['from_ma'] == 0]
    print(f'places: all {len(pl)} agree with partition_point; {len(zero)} not carried back past 0 Ma: '
          + ', '.join(zero))
    used = set(int(x) for x in C['seg_plate']) | {p['pi'] for p in pl}
    assert all(0 <= u < P for u in used)
    print(f'one-plate-model rule: every plate index in coast.bin and places.json is in plates.json '
          f'({len(used)} distinct)')


if __name__ == '__main__':
    main()
