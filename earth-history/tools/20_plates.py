"""Step 20 — the plate model: data/plates.bin + plates.json, data/coast.bin + coast.json,
data/places.json, and tools/work/plates_ref.json + tools/work/land_sample.json (not shipped).

Everything comes from one plate model: PALEOMAP_PlateModel.rot and PALEOMAP_PlatePolygons.gpml
from the pinned atlas zip (Scotese 2016), read with pygplates 1.0.0, anchor plate 0
(tools/CONTRACT.md §0, "the one-plate-model rule"). Present-day coastlines and cities come from
Natural Earth 1:50m v5.1.2 and get their plate ids by partitioning with the polygons valid at 0 Ma.

"Present-day" means the model's own 0 Ma reconstruction. For 240 of the 241 plates the rotation at
0 Ma is the identity, but plate 198 (the rotation file's "PCT PRECORDILLERA TERRANE") carries a
non-zero pole at 0 Ma relative to plate 201: its polygon is stored in a restored frame (in Mexico)
and the model places it at 0 Ma in Argentina. So rings are stored as reconstructed at 0 Ma, and every
shipped rotation is Q(t, p) = R(t, p) · R(0, p)^-1 — the rotation from the present-day position to
the position at t. For every plate but 198 that equals R(t, p). (Builder's decision, CONTRACT §3.)

    .venv/bin/python 20_plates.py
"""
import json
import os

import numpy as np
import pygplates as g

from common import RETRIEVED, json_text, write_bin, write_json
from geo import (EARTH_RADIUS_KM, POLY_NAME, ROT_NAME, even_odd, geojson_lines, geojson_rings,
                 load_geojson, pack_sections, plate_model_files, quantise_lonlat,
                 quat_of_finite_rotation, quat_rotate, dequantise_lonlat, unit)
from paths import DATA, TOOLS, WORK
from sources import SOURCES

CAP_PLATES_BIN, CAP_PLATES_JSON = 520_000, 10_000
CAP_COAST_BIN, CAP_COAST_JSON = 300_000, 4_000
CAP_PLACES = 40_000
N_PLACES = 300
ARROW_MIN_AREA_KM2 = 1_000_000
N_REF = 1000
REF_SLICES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 89]
SEED = 20260930
MODEL = 'PALEOMAP Plate Model m15g60_v2d3 (Scotese 2016)'


def load_model():
    files = plate_model_files()
    rot_path, rot_sha = files[ROT_NAME]
    poly_path, poly_sha = files[POLY_NAME]
    rm = g.RotationModel(rot_path)
    fc = g.FeatureCollection(poly_path)
    return rm, fc, rot_sha, poly_sha


def present_rotation(rm, t, pid):
    """Q(t, p) = R(t, p) · R(0, p)^-1 as a pygplates FiniteRotation."""
    r0 = rm.get_rotation(0.0, pid, anchor_plate_id=0)
    rt = rm.get_rotation(float(t), pid, anchor_plate_id=0)
    if r0.represents_identity_rotation():
        return rt
    return rt * r0.get_inverse()


def land_sample_grid():
    """The land sample (CONTRACT §3, §14): integer-degree nodes, longitude -180 ... 179, latitude
    90 ... -90, inside Natural Earth 1:50m land by the even-odd rule. Row-major, north first."""
    lons = np.arange(-180.0, 180.0)
    lats = np.arange(90.0, -91.0, -1.0)
    inside = even_odd(geojson_rings(load_geojson('ne_land')), lons, lats)
    jj, ii = np.nonzero(inside)
    return lons[ii], lats[jj]


def fin(x):
    """float for JSON: None for ±infinity (distant past / future)."""
    return None if np.isinf(x) else float(x)


def main():
    with open(os.path.join(WORK, 'surface.json'), encoding='utf-8') as f:
        surf = json.load(f)
    slices = surf['slices']
    assert len(slices) == 90 and [s['i'] for s in slices] == list(range(90))
    rm, fc, rot_sha, poly_sha = load_model()

    # --- rings -------------------------------------------------------------------------------
    ring_pts, ring_plate_id, ring_begin, ring_end, ring_area, ring_anchor, ring_feature = \
        [], [], [], [], [], [], []
    dropped, closing_dups = [], 0
    for fi, feat in enumerate(fc):
        pid = feat.get_reconstruction_plate_id()
        begin, end = feat.get_valid_time()
        r0 = rm.get_rotation(0.0, pid, anchor_plate_id=0)
        for geom in feat.get_all_geometries():
            if isinstance(geom, g.PolygonOnSphere):
                assert geom.get_number_of_interior_rings() == 0, f'feature {fi} has a hole'
                present = geom if r0.represents_identity_rotation() else r0 * geom
                ll = np.array(present.to_lat_lon_list(), dtype=np.float64)   # (lat, lon)
                if len(ll) > 1 and ll[0, 0] == ll[-1, 0] and ll[0, 1] == ll[-1, 1]:
                    ll = ll[:-1]
                    closing_dups += 1
                assert len(ll) >= 3
                ring_pts.append(ll)
                ring_plate_id.append(pid)
                ring_begin.append(begin)
                ring_end.append(end)
                ring_area.append(present.get_area() * EARTH_RADIUS_KM ** 2)
                ring_anchor.append(present.get_interior_centroid().to_lat_lon())
                ring_feature.append(fi)
            elif isinstance(geom, g.PolylineOnSphere):
                dropped.append({'plate': pid, 'vertices': len(geom.get_points())})
            else:
                raise SystemExit(f'feature {fi}: unexpected geometry {type(geom).__name__}')
    R = len(ring_pts)
    plates = sorted(set(ring_plate_id))
    P = len(plates)
    pindex = {p: i for i, p in enumerate(plates)}
    V = sum(len(p) for p in ring_pts)
    all_ll = np.concatenate(ring_pts)
    vlon, vlat = quantise_lonlat(all_ll[:, 1], all_ll[:, 0])
    anc = np.array(ring_anchor)
    alon, alat = quantise_lonlat(anc[:, 1], anc[:, 0])
    starts = np.concatenate([[0], np.cumsum([len(p) for p in ring_pts])[:-1]]).astype('<u4')

    # --- rotations ---------------------------------------------------------------------------
    times = [[float(s['rotation_ma']), float(s['rotation_ma']) + 1.0] for s in slices]
    rot = np.zeros((90, 2, P, 4), dtype=np.float64)
    # Quantisation error, measured as verify_plates.py measures it: 5 evenly spaced shipped (16-bit)
    # vertices of each plate's rings, rotated by the decoded quaternion and by pygplates.
    dlon, dlat = dequantise_lonlat(vlon, vlat)
    test = {}
    for r in range(R):
        a, n = int(starts[r]), len(ring_pts[r])
        test.setdefault(ring_plate_id[r], []).extend(zip(dlon[a:a + n], dlat[a:a + n]))
    for pid in plates:
        pts = test[pid]
        test[pid] = [pts[k] for k in np.linspace(0, len(pts) - 1, 5).astype(int)]
    worst_km = 0.0
    for i, (t0, t1) in enumerate(times):
        for k, t in enumerate((t0, t1)):
            for j, pid in enumerate(plates):
                Rq = present_rotation(rm, t, pid)
                q = quat_of_finite_rotation(Rq)
                rot[i, k, j] = q
                qi = np.rint(np.array(q) * 32767.0) / 32767.0
                qi /= np.linalg.norm(qi)
                tp = unit([p[0] for p in test[pid]], [p[1] for p in test[pid]])
                mine = quat_rotate(qi, tp)
                ref = np.array([(Rq * g.PointOnSphere(float(la), float(lo))).to_xyz()
                                for lo, la in test[pid]])
                err = np.max(np.arctan2(np.linalg.norm(np.cross(mine, ref), axis=1),
                                        np.sum(mine * ref, axis=1))) * EARTH_RADIUS_KM
                worst_km = max(worst_km, float(err))
    rot_q = np.rint(rot * 32767.0).astype('<i2')
    assert np.all(rot[..., 0] >= 0)

    sections = [
        ('ring_start', starts),
        ('ring_count', np.array([len(p) for p in ring_pts], dtype='<u4')),
        ('ring_begin', np.array(ring_begin, dtype='<f4')),
        ('ring_end', np.array(ring_end, dtype='<f4')),
        ('ring_area', np.array(ring_area, dtype='<f4')),
        ('ring_plate', np.array([pindex[p] for p in ring_plate_id], dtype='<u2')),
        ('ring_anchor', np.stack([alon, alat], axis=1).astype('<i2').ravel()),
        ('vertices', np.stack([vlon, vlat], axis=1).astype('<i2').ravel()),
        ('rotations', rot_q.ravel()),
    ]
    plates_bin, plates_sections = pack_sections(sections)
    assert len(plates_bin) <= CAP_PLATES_BIN, f'plates.bin {len(plates_bin)} > {CAP_PLATES_BIN}'
    plates_json = {
        'model': MODEL,
        'rotation_file': ROT_NAME, 'rotation_sha256': rot_sha,
        'polygons_file': POLY_NAME, 'polygons_sha256': poly_sha,
        'anchor_plate': 0, 'plates': plates, 'times': times,
        'rings': R, 'vertices': V, 'slices': 90,
        'sections': plates_sections,
        'vertex_scale': {'lon': 180, 'lat': 90, 'q': 32767},
        'quaternion': {'order': ['w', 'x', 'y', 'z'], 'scale': 32767, 'w_nonnegative': True,
                       'renormalise': True, 'rotate': "p' = p + w t + v x t, t = 2 v x p",
                       'relative_to': 'present day: R(t) * R(0)^-1, the model reconstructed at 0 Ma'},
        'present_day': 'rings are the polygons reconstructed at 0 Ma (differs from the file only for plate 198)',
        'valid_rule': 'ring_end <= T <= ring_begin',
        'arrow_min_area_km2': ARROW_MIN_AREA_KM2,
        'max_quantisation_error_km': worst_km,
        'dropped_polylines': dropped,
    }

    # --- coasts ------------------------------------------------------------------------------
    polys0 = [f for f in fc if f.is_valid_at_time(0)]
    coast_feats = []
    for ln in geojson_lines(load_geojson('ne_coastline')):
        cf = g.Feature()
        cf.set_geometry(g.PolylineOnSphere([(float(la), float(lo)) for lo, la in ln]))
        coast_feats.append(cf)
    parted, unparted = g.partition_into_plates(
        polys0, rm, coast_feats,
        properties_to_copy=[g.PartitionProperty.reconstruction_plate_id,
                            g.PartitionProperty.valid_time_begin],
        reconstruction_time=0,
        partition_method=g.PartitionMethod.split_into_plates,
        partition_return=g.PartitionReturn.separate_partitioned_and_unpartitioned)
    # Pieces no polygon claims (slivers in gaps between polygons — along the antimeridian, in a few
    # straits, and where plate 198's polygon sat before its 0 Ma rotation) keep plate 0 and a begin
    # of 0 Ma: drawn today, where they are, and on no past map. More than a sliver fails the step.
    seg_pts, seg_plate, seg_begin = [], [], []
    for pf in parted:
        pid = pf.get_reconstruction_plate_id()
        begin = pf.get_valid_time()[0]
        assert pid in pindex, f'coast plate {pid} not in plates'
        for geom in pf.get_all_geometries():
            ll = np.array(geom.to_lat_lon_list(), dtype=np.float64)
            if len(ll) < 2:
                continue
            seg_pts.append(ll)
            seg_plate.append(pid)
            seg_begin.append(begin)
    n_claimed = len(seg_pts)
    for uf in unparted:
        for geom in uf.get_all_geometries():
            ll = np.array(geom.to_lat_lon_list(), dtype=np.float64)
            if len(ll) < 2:
                continue
            seg_pts.append(ll)
            seg_plate.append(0)
            seg_begin.append(0.0)
    un_pieces = len(seg_pts) - n_claimed
    un_vertices = sum(len(p) for p in seg_pts[n_claimed:])
    assert un_vertices <= 0.005 * sum(len(p) for p in seg_pts), \
        f'{un_vertices} coast vertices are claimed by no polygon (over 0.5 %)'
    N = len(seg_pts)
    cV = sum(len(p) for p in seg_pts)
    call = np.concatenate(seg_pts)
    clon, clat = quantise_lonlat(call[:, 1], call[:, 0])
    cstarts = np.concatenate([[0], np.cumsum([len(p) for p in seg_pts])[:-1]]).astype('<u4')
    coast_bin, coast_sections = pack_sections([
        ('seg_start', cstarts),
        ('seg_count', np.array([len(p) for p in seg_pts], dtype='<u4')),
        ('seg_begin', np.array(seg_begin, dtype='<f4')),
        ('seg_plate', np.array([pindex[p] for p in seg_plate], dtype='<u2')),
        ('vertices', np.stack([clon, clat], axis=1).astype('<i2').ravel()),
    ])
    assert len(coast_bin) <= CAP_COAST_BIN, f'coast.bin {len(coast_bin)} > {CAP_COAST_BIN}'
    coast_json = {
        'source': 'naturalearth', 'file': SOURCES['ne_coastline']['name'],
        'pieces': N, 'vertices': cV, 'plates_used': len(set(seg_plate)),
        'unclaimed': {'pieces': un_pieces, 'vertices': un_vertices, 'first_index': n_claimed,
                      'rule': 'claimed by no polygon valid at 0 Ma: plate 0, seg_begin 0, drawn today only'},
        'sections': coast_sections,
        'vertex_scale': {'lon': 180, 'lat': 90, 'q': 32767},
        'draw_rule': 'T <= seg_begin',
        'partition': ('Natural Earth 1:50m coastline lines, each split where it crosses a plate '
                      'polygon edge (pygplates partition_into_plates, split_into_plates, at 0 Ma, '
                      'with the PALEOMAP polygons valid at 0 Ma); each piece takes the plate id and '
                      'valid-time begin of the polygon it lies in'),
    }

    # --- places ------------------------------------------------------------------------------
    pp = g.PlatePartitioner(polys0, rm)

    def partition(lon, lat):
        rg = pp.partition_point(g.PointOnSphere(float(lat), float(lon)))
        if rg is None:
            return None
        f = rg.get_feature()
        return f.get_reconstruction_plate_id(), f.get_valid_time()[0]

    feats = load_geojson('ne_places')['features']
    assert len(feats) == 1251, len(feats)

    def clean(s):
        return ' '.join(str(s).split())
    feats.sort(key=lambda f: (f['properties']['scalerank'], -f['properties']['pop_max'],
                              clean(f['properties']['name'])))
    taken, places = set(), []
    for f in feats:
        pr = f['properties']
        key = (clean(pr['name']), clean(pr['adm0name']))
        if key in taken:
            continue
        taken.add(key)
        lon, lat = f['geometry']['coordinates'][:2]
        part = partition(lon, lat)
        assert part is not None, f'{key}: no polygon claims it'
        pid, begin = part
        places.append({'n': key[0], 'a': clean(pr['nameascii']), 'c': key[1],
                       'lon': float(lon), 'lat': float(lat), 'plate': pid, 'pi': pindex[pid],
                       'from_ma': fin(begin), 'r': int(pr['scalerank'])})
        if len(places) == N_PLACES:
            break
    places_json = {'source': 'naturalearth', 'count': len(places),
                   'selection': ('first 300 unique (name, country) by scalerank, then pop_max '
                                 'descending, then name'),
                   'places': places}

    # --- work files: the land sample and the reference points for test_plates.mjs -------------
    slon, slat = land_sample_grid()
    sample = []
    for lon, lat in zip(slon, slat):
        part = partition(lon, lat)
        if part is not None:
            sample.append((float(lon), float(lat), part[0], part[1]))
    rng = np.random.default_rng(SEED)
    pick = np.sort(rng.choice(len(sample), size=N_REF, replace=False))
    ref = []
    for k in pick:
        lon, lat, pid, begin = sample[k]
        pos = []
        for i in REF_SLICES:
            Rq = present_rotation(rm, times[i][0], pid)
            la, lo = (Rq * g.PointOnSphere(lat, lon)).to_lat_lon()
            pos.append([i, la, lo])
        ref.append({'lon': lon, 'lat': lat, 'plate': pid, 'pi': pindex[pid], 'at': pos})
    with open(os.path.join(WORK, 'plates_ref.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps({'seed': SEED, 'slices': REF_SLICES, 'points': ref,
                            'at_order': ['slice', 'lat', 'lon']}, sort_keys=True) + '\n')
    with open(os.path.join(WORK, 'land_sample.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps({'grid': 'integer degrees, lon -180..179, lat 90..-90, inside Natural '
                                    'Earth 1:50m land (even-odd)',
                            'nodes_on_land': int(len(slon)),
                            'points': [[lo, la, p, fin(b)] for lo, la, p, b in sample],
                            'order': ['lon', 'lat', 'plate', 'from_ma']}, sort_keys=True) + '\n')

    # --- write (every cap checked before anything is written) --------------------------------
    pj = len(json_text(plates_json, 6).encode('utf-8'))
    cj = len(json_text(coast_json, 6).encode('utf-8'))
    lj = len(json_text(places_json, 4).encode('utf-8'))
    assert pj <= CAP_PLATES_JSON and cj <= CAP_COAST_JSON and lj <= CAP_PLACES, (pj, cj, lj)
    write_bin('plates.bin', plates_bin)
    write_json('plates.json', plates_json, ndigits=6)
    write_bin('coast.bin', coast_bin)
    write_json('coast.json', coast_json, ndigits=6)
    write_json('places.json', places_json, ndigits=4)

    # --- credits fragment ----------------------------------------------------------------------
    s = SOURCES['paleoatlas']
    with open(os.path.join(TOOLS, 'credits', 'PaleoAtlas_v3_License.txt'), encoding='utf-8') as f:
        atlas_licence = ' '.join(f.read().split())
    ne_quote = ('"All versions of Natural Earth raster + vector map data found on this website are in '
                'the public domain. ... No permission is needed to use Natural Earth. Crediting the '
                'authors is unnecessary." (Natural Earth LICENSE.md)')
    with open(os.path.join(TOOLS, 'credits', 'natural-earth-LICENSE.md'), encoding='utf-8') as f:
        ne_text = ' '.join(f.read().split())
    assert 'are in the public domain' in ne_text and 'Crediting the authors is unnecessary' in ne_text
    frag = [
        {
            'id': 'paleoatlas', 'part': 'plate model',
            'title': 'PALEOMAP PaleoAtlas for GPlates v3: paleogeographic maps and plate model',
            'owner': 'C. R. Scotese, PALEOMAP Project',
            'source': (f'{s["name"]} (sha256 {s["sha256"]}): "{ROT_NAME}" (sha256 {rot_sha}; '
                       f'{MODEL}) and "{POLY_NAME}" (sha256 {poly_sha}), read with pygplates 1.0.0.'),
            'url': s['url'],
            'licence': 'CC BY 4.0', 'licence_uri': 'http://creativecommons.org/licenses/by/4.0/',
            'licence_quote': atlas_licence,
            'retrieved': RETRIEVED,
            'adaptations': (f'Plate model: the {R} polygon outlines stored at their 0 Ma positions with '
                            f'coordinates rounded to 16 bits; the rotation of each of the {P} plates at '
                            'each map\'s time and one million years earlier, as 16-bit quaternions; the '
                            f'{len(dropped)} line features in the polygon file left out.'),
            'accuracy': (f'Rotations reproduce pygplates within {worst_km:.2f} km after 16-bit rounding. '
                         'Rotations are one model\'s reconstruction; beyond each plate\'s last pole the '
                         'rotation file holds the pole constant.'),
            'cite': ('Scotese, C.R., 2016. PALEOMAP PaleoAtlas for GPlates and the PaleoData Plotter '
                     'Program, PALEOMAP Project. Via Scotese, C.R. & Wright, N.M., 2018, Zenodo, '
                     'doi:10.5281/zenodo.5460860.'),
        },
        {
            'id': 'naturalearth', 'title': 'Natural Earth 1:50m coastline and populated places',
            'owner': 'Natural Earth (naturalearthdata.com)',
            'source': (f'{SOURCES["ne_coastline"]["name"]} (sha256 {SOURCES["ne_coastline"]["sha256"]}), '
                       f'{SOURCES["ne_places"]["name"]} (sha256 {SOURCES["ne_places"]["sha256"]}) and '
                       f'{SOURCES["ne_land"]["name"]} (sha256 {SOURCES["ne_land"]["sha256"]}, build-time '
                       'checks only), version 5.1.2, github.com/nvkelso/natural-earth-vector at commit '
                       'f1890d9f152c.'),
            'url': SOURCES['ne_coastline']['url'],
            'licence': 'public domain', 'licence_uri': None,
            'licence_quote': ne_quote,
            'retrieved': RETRIEVED,
            'adaptations': (f'Coastlines split into {N} pieces where they cross a plate outline and '
                            'given the plate they lie on; coordinates rounded to 16 bits. The first '
                            f'{len(places)} populated places by scalerank and population, names with '
                            'runs of spaces collapsed, each given the plate it lies on.'),
            'accuracy': 'Made with Natural Earth. Today\'s coastlines at 1:50 million scale.',
            'cite': 'Made with Natural Earth.',
        },
    ]
    fdir = os.path.join(TOOLS, 'credits', 'fragments')
    os.makedirs(fdir, exist_ok=True)
    with open(os.path.join(fdir, 'plates.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(frag, sort_keys=True, ensure_ascii=False, indent=1) + '\n')

    sizes = {n: os.path.getsize(os.path.join(DATA, n))
             for n in ('plates.bin', 'plates.json', 'coast.bin', 'coast.json', 'places.json')}
    print(f'rings R={R} (closing duplicates dropped: {closing_dups}), vertices V={V}, plates P={P}, '
          f'polylines left out: {dropped}')
    print(f'rotations: 90 x 2 x {P} x 4 int16; worst position error after quantisation {worst_km:.3f} km')
    print(f'coast: N={N} pieces, V={cV} vertices, {len(set(seg_plate))} plates; claimed by no polygon: '
          f'{un_pieces} pieces, {un_vertices} vertices (kept at 0 Ma only)')
    print(f'places: {len(places)}; land sample: {len(slon)} nodes on land, {len(sample)} in a polygon; '
          f'reference points: {N_REF}')
    for n, b in sizes.items():
        print(f'  {n}: {b:,} bytes')


if __name__ == '__main__':
    main()
