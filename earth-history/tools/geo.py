"""Small geometry helpers shared by steps 10 and 20 and their verify scripts.

Everything here is plain numpy: unit vectors, quaternions, an even-odd scanline rasteriser for
lon/lat rings, and the readers for the pinned inputs the two steps share (Natural Earth, the atlas
zip's plate model and rasters, the PaleoDEM grids). Frames follow tools/CONTRACT.md §0: longitude
east-positive in [-180, 180], latitude north-positive, unit vector (cos φ cos λ, cos φ sin λ, sin φ).
"""
import csv
import io
import json
import os
import re
import zipfile

import numpy as np

from common import fetch, git_file, sha256_of
from paths import WORK
from sources import SOURCES

EARTH_RADIUS_KM = 6371.0
ATLAS_ROOT = 'Scotese PaleoAtlas_v3/'
RASTER_DIR = ATLAS_ROOT + 'PALEOMAP PaleoAtlas Rasters v3/'
MODEL_DIR = ATLAS_ROOT + 'PALEOMAP Global Plate Model/'
ROT_NAME = 'PALEOMAP_PlateModel.rot'
POLY_NAME = 'PALEOMAP_PlatePolygons.gpml'


# --- pinned inputs --------------------------------------------------------------------------
def source(key):
    s = SOURCES[key]
    if 'git' in s:
        repo, commit, path = s['git']
        return git_file(repo, commit, path, s['name'], s['sha256'])
    return fetch(s['url'], s['name'], s['sha256'], s['bytes'])


def atlas_zip():
    return zipfile.ZipFile(source('paleoatlas'))


def plate_model_files():
    """Extract the rotation file and the plate polygons from the pinned atlas zip into WORK
    (byte for byte; rewritten only when missing or different) and return their paths and sha256s."""
    out = {}
    with atlas_zip() as z:
        for name in (ROT_NAME, POLY_NAME):
            data = z.read(MODEL_DIR + name)
            dest = os.path.join(WORK, 'plate_model', name)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if not (os.path.exists(dest) and open(dest, 'rb').read() == data):
                with open(dest, 'wb') as f:
                    f.write(data)
            out[name] = (dest, sha256_of(dest))
    return out


def read_slices():
    """tools/slices.csv as a list of dicts in manifest order (ascending age, map 1 first)."""
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'slices.csv'), encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r['map'] = int(r['map'])
        r['age_ma'] = float(r['age_ma'])
        r['file_age_ma'] = float(r['file_age_ma'])
    rows.sort(key=lambda r: (r['age_ma'], r['map']))
    assert [r['map'] for r in rows] == sorted(r['map'] for r in rows), 'age order != map order'
    return rows


def load_geojson(key):
    with open(source(key), encoding='utf-8') as f:
        return json.load(f)


def geojson_rings(gj):
    """Every ring (exterior and holes) of every Polygon/MultiPolygon, as float64 (n, 2) lon/lat."""
    rings = []
    for feat in gj['features']:
        geom = feat['geometry']
        polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
        for poly in polys:
            for ring in poly:
                rings.append(np.asarray(ring, dtype=np.float64)[:, :2])
    return rings


def geojson_lines(gj):
    """Every LineString part, in file order, as float64 (n, 2) lon/lat."""
    lines = []
    for feat in gj['features']:
        geom = feat['geometry']
        parts = [geom['coordinates']] if geom['type'] == 'LineString' else geom['coordinates']
        for part in parts:
            lines.append(np.asarray(part, dtype=np.float64)[:, :2])
    return lines


# --- rasterising -----------------------------------------------------------------------------
def even_odd(rings, lons, lats):
    """Boolean grid [len(lats), len(lons)]: True where the point (lon, lat) is inside the rings by
    the even-odd rule (so holes are cut). Rings are lon/lat degree arrays, treated as planar in
    lon/lat, which is how Natural Earth's polygons are drawn (split at the antimeridian)."""
    x0 = np.concatenate([r[:, 0] for r in rings])
    y0 = np.concatenate([r[:, 1] for r in rings])
    x1 = np.concatenate([np.roll(r[:, 0], -1) for r in rings])
    y1 = np.concatenate([np.roll(r[:, 1], -1) for r in rings])
    lons = np.asarray(lons, dtype=np.float64)
    out = np.zeros((len(lats), len(lons)), dtype=bool)
    for j, y in enumerate(lats):
        m = (y0 > y) != (y1 > y)
        if not m.any():
            continue
        xs = x0[m] + (y - y0[m]) * (x1[m] - x0[m]) / (y1[m] - y0[m])
        # parity of crossings strictly to the left of each point
        xs.sort()
        out[j] = (np.searchsorted(xs, lons, side='left') % 2) == 1
    return out


def pixel_centres(width, height):
    """Longitudes and latitudes of the pixel centres of an equirectangular image whose column 0's
    west edge is 180° W and row 0's north edge is 90° N (tools/CONTRACT.md §2)."""
    lons = -180.0 + 360.0 * (np.arange(width) + 0.5) / width
    lats = 90.0 - 180.0 * (np.arange(height) + 0.5) / height
    return lons, lats


def lonlat_to_pixel(lon, lat, width, height):
    col = np.floor((np.asarray(lon) + 180.0) / 360.0 * width).astype(np.int64) % width
    row = np.clip(np.floor((90.0 - np.asarray(lat)) / 180.0 * height).astype(np.int64), 0, height - 1)
    return col, row


def water_mask(rgb):
    """Step 10's classifier for Scotese's painted maps: water iff blue > max(red, green)."""
    rgb = rgb.astype(np.int16)
    return rgb[..., 2] > np.maximum(rgb[..., 0], rgb[..., 1])


# --- vectors and rotations -----------------------------------------------------------------
def unit(lon, lat):
    lon = np.radians(np.asarray(lon, dtype=np.float64))
    lat = np.radians(np.asarray(lat, dtype=np.float64))
    c = np.cos(lat)
    return np.stack([c * np.cos(lon), c * np.sin(lon), np.sin(lat)], axis=-1)


def to_lonlat(v):
    v = np.asarray(v, dtype=np.float64)
    v = v / np.linalg.norm(v, axis=-1, keepdims=True)
    lon = np.degrees(np.arctan2(v[..., 1], v[..., 0]))
    lat = np.degrees(np.arcsin(np.clip(v[..., 2], -1.0, 1.0)))
    return lon, lat


def quat_rotate(q, p):
    """Rotate unit vectors p (..., 3) by unit quaternion q = (w, x, y, z) (broadcast):
    t = 2 (v × p), p' = p + w t + v × t (tools/CONTRACT.md §3)."""
    q = np.asarray(q, dtype=np.float64)
    w = q[..., :1]
    v = q[..., 1:]
    t = 2.0 * np.cross(v, p)
    return p + w * t + np.cross(v, t)


def quat_mul(a, b):
    """Hamilton product a·b (apply b first, then a)."""
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return (aw * bw - ax * bx - ay * by - az * bz,
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw)


def quat_of_finite_rotation(R):
    """(w, x, y, z) of a pygplates FiniteRotation, from its Euler pole and angle in degrees, with
    w >= 0 (tools/CONTRACT.md §3). The identity is (1, 0, 0, 0)."""
    if R.represents_identity_rotation():
        return (1.0, 0.0, 0.0, 0.0)
    plat, plon, ang = R.get_lat_lon_euler_pole_and_angle_degrees()
    a = unit(plon, plat)
    h = np.radians(ang) / 2.0
    q = (float(np.cos(h)), float(np.sin(h) * a[0]), float(np.sin(h) * a[1]), float(np.sin(h) * a[2]))
    return tuple(-c for c in q) if q[0] < 0 else q


def quat_conj(q):
    return (q[0], -q[1], -q[2], -q[3])


def angle_between(a, b):
    """Great-circle angle (radians) between unit vectors, stable for small angles."""
    return np.arctan2(np.linalg.norm(np.cross(a, b), axis=-1), np.sum(a * b, axis=-1))


def quantise_lonlat(lon, lat):
    lq = np.rint(np.asarray(lon) * 32767.0 / 180.0).astype(np.int64)
    aq = np.rint(np.asarray(lat) * 32767.0 / 90.0).astype(np.int64)
    assert lq.min() >= -32767 and lq.max() <= 32767 and aq.min() >= -32767 and aq.max() <= 32767
    return lq.astype(np.int16), aq.astype(np.int16)


def dequantise_lonlat(lq, aq):
    return lq.astype(np.float64) * 180.0 / 32767.0, aq.astype(np.float64) * 90.0 / 32767.0


# --- binary layout -------------------------------------------------------------------------
def pack_sections(sections):
    """[(name, numpy array)] -> (bytes, {name: {offset, type, count}}), little-endian, each section
    starting on a multiple of 4 bytes (zero padding), per tools/CONTRACT.md §0."""
    types = {'<u4': 'uint32', '<f4': 'float32', '<u2': 'uint16', '<i2': 'int16', '|u1': 'uint8'}
    buf = bytearray()
    meta = {}
    for name, arr in sections:
        buf += b'\0' * ((-len(buf)) % 4)
        a = np.ascontiguousarray(arr)
        assert a.dtype.str in types, f'{name}: dtype {a.dtype.str} is not a contract type'
        meta[name] = {'offset': len(buf), 'type': types[a.dtype.str], 'count': int(a.size)}
        buf += a.tobytes()
    return bytes(buf), meta


def read_section(raw, meta):
    dt = {'uint32': '<u4', 'float32': '<f4', 'uint16': '<u2', 'int16': '<i2', 'uint8': 'u1'}[meta['type']]
    return np.frombuffer(raw, dtype=dt, count=meta['count'], offset=meta['offset'])


# --- PaleoDEM grids (the 1-degree zip), keyed by Plate Model Age ------------------------------
def paleodem_grids():
    """{plate_age_ma: (member name, map id)} for the 109 grids, joined to the zip's interval CSV
    ('PaleoAtlasTimeIntervalsv22b copy.csv', old-Mac CR line endings) by the map id in the file
    name, never by the age in the file name (two are fractional). Asserts ages 0, 5, ... 540."""
    z = zipfile.ZipFile(source('paleodem_1deg'))
    names = z.namelist()
    csv_name = [n for n in names if n.endswith('PaleoAtlasTimeIntervalsv22b copy.csv')]
    assert len(csv_name) == 1
    txt = z.read(csv_name[0]).decode('latin-1').replace('\r\n', '\n').replace('\r', '\n')
    age_of = {}
    for row in list(csv.reader(io.StringIO(txt)))[2:]:
        if row and re.fullmatch(r'[0-9]+(\.[0-9]+)?', row[0].strip()):
            age_of[float(row[0].strip())] = float(row[2].strip())
    out = {}
    for n in names:
        m = re.match(r'.*/Map([0-9.]+)_PALEOMAP_1deg_.*\.nc$', n)
        if not m:
            continue
        mid = float(m.group(1))
        age = age_of[mid]
        assert age not in out, f'two grids for plate age {age}'
        out[age] = (n, m.group(1))
    assert sorted(out) == [5.0 * s for s in range(109)], 'PaleoDEM plate ages are not 0..540 by 5'
    z.close()
    return out


def paleodem_z(member):
    """z (181 lat -90..90, 361 lon -180..180) in metres, float32, from one member of the zip."""
    import h5py
    with zipfile.ZipFile(source('paleodem_1deg')) as z:
        raw = z.read(member)
    with h5py.File(io.BytesIO(raw), 'r') as f:
        lat = f['lat'][:]
        lon = f['lon'][:]
        zz = f['z'][:]
    assert lat.shape == (181,) and lon.shape == (361,) and lat[0] == -90 and lon[0] == -180
    return zz


# Scotese's Table 2 edges (atlas PDF p. 42, after Ziegler et al. 1985), CONTRACT §7.
DEM_EDGES = [-6000, -4000, -200, -50, 0, 200, 1000, 2000, 4000]


def paleodem_land_shelf(z):
    """(land %, shelf %) of one PaleoDEM grid (CONTRACT §7): land = z > 0, shelf (shallow sea) =
    -200 < z <= 0, weighted by cos(latitude) at the 1-degree nodes, the +180 column left out (it
    repeats -180). Shared by 35_elevation.py and 40_curves.py so the two can never disagree."""
    z = np.asarray(z, dtype=np.float64)
    assert z.shape == (181, 361) and np.isfinite(z).all()
    zz = z[:, :360]
    lat = np.radians(np.arange(-90, 91, dtype=np.float64))
    w = np.repeat(np.cos(lat)[:, None], 360, axis=1)
    w /= w.sum()
    land = float(w[zz > 0].sum()) * 100.0
    shelf = float(w[(zz > -200) & (zz <= 0)].sum()) * 100.0
    return land, shelf
