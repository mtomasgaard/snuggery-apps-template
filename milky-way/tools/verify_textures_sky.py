#!/usr/bin/env python3
"""Checks for steps 30 (planet maps, colours) and 31 (the Gaia sky): CONTRACT.md sections 5 and 6.

What the app relies on, measured on the shipped files:
  * files, sizes, JPEG modes and the textures.json / sky.json fields the contract names; budgets
    (planet textures <= 2.3 MB, sky <= 0.25 MB);
  * geometry of every map. For the USGS mosaics, an independent path: PROJ (through rasterio) turns
    a longitude/latitude into a pixel of the source GeoTIFF from its own CRS, and the source pixels
    under an output pixel must average to the shipped value — and must NOT under a longitude
    mirror or a 180-degree shift. Then named features, each also tested against its mirror image:
    Olympus Mons found by its scarp ring near 226.2 E / 18.65 N, Syrtis Major dark and Hellas bright;
    Tycho bright at 348.8 E / -43.3, Mare Humorum dark; Maxwell Montes and Beta Regio bright in the
    radar; Sputnik Planitia bright near 175 E / +20 with the dark equatorial belt west of it;
    Charon's dark north pole; Earth's land and sea around Greenwich and Africa; city lights on the
    right cities and the night map registered to the Blue Marble; the Great Red Spot at ~22 S;
  * the colours (Karkoschka / TSIS-1) against the illuminant-E computation and the research values;
  * the sky: the stretch inverts to the recomputed Gaia densities, the duplicated patch is gone, and
    the LMC, SMC, M31 and the Galactic centre are where the contract's pixel formula puts them.
"""
import io
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import texsky_sources as T
from paths import DATA

from PIL import Image

fails = []


def check(ok, msg):
    print(('  ok    ' if ok else '  FAIL  ') + msg)
    if not ok:
        fails.append(msg)


TEX = os.path.join(DATA, 'tex')
SKY = os.path.join(DATA, 'sky')
J = json.load(open(os.path.join(TEX, 'textures.json'), encoding='utf-8'))
S = json.load(open(os.path.join(SKY, 'sky.json'), encoding='utf-8'))

# ------------------------------------------------------------------ files, fields, budgets
print('textures: files and fields')
need = ['sun', 'mercury', 'venus', 'earth', 'earth_night', 'moon', 'mars', 'jupiter', 'pluto', 'charon']  # + optional moons
check(all(k in J['bodies'] for k in need), f'bodies present: {sorted(J["bodies"])}')
imgs = {}
total = 0
for k, m in sorted(J['bodies'].items()):
    for f in ('file', 'width', 'height', 'lon_left_deg', 'grayscale', 'kind', 'nodata_fill', 'source_id', 'note'):
        if f not in m:
            check(False, f'{k}: field {f} missing')
    p = os.path.join(TEX, m['file'])
    size = os.path.getsize(p)
    total += size
    im = Image.open(p)
    ok = im.format == 'JPEG' and im.size == (m['width'], m['height']) and im.mode == ('L' if m['grayscale'] else 'RGB')
    ok = ok and m['kind'] in ('visible', 'radar', 'albedo') and m['width'] == 2 * m['height']
    check(ok, f'{k}: {m["file"]} {im.format} {im.size[0]}x{im.size[1]} {im.mode}, {size:,} B, lon_left {m["lon_left_deg"]}, '
              f'kind {m["kind"]}, nodata {100 * m.get("nodata_fraction", 0):.2f} %')
    imgs[k] = np.asarray(im.convert('L' if m['grayscale'] else 'RGB'), np.float64)
tex_json = os.path.getsize(os.path.join(TEX, 'textures.json'))
check(total + tex_json <= 2_300_000, f'planet textures {total + tex_json:,} B (maps {total:,} + json {tex_json:,}) <= 2,300,000')
sky_bytes = sum(os.path.getsize(os.path.join(SKY, f)) for f in os.listdir(SKY))
check(sky_bytes <= 250_000, f'sky {sky_bytes:,} B <= 250,000')
check(J['bodies']['pluto']['lon_left_deg'] == 0.0, 'Pluto map starts at 0 E (its label: CenterLongitude 180, 0..360)')


def pix(k, lon, lat):
    m = J['bodies'][k]
    x = int(np.floor(((lon - m['lon_left_deg']) % 360.0) / 360.0 * m['width'])) % m['width']
    y = int(np.clip(np.floor((90.0 - lat) / 180.0 * m['height']), 0, m['height'] - 1))
    return x, y


def val(k, lon, lat, r=1):
    a = imgs[k]
    x, y = pix(k, lon, lat)
    xs = np.arange(x - r, x + r + 1) % a.shape[1]
    ys = np.clip(np.arange(y - r, y + r + 1), 0, a.shape[0] - 1)
    v = a[np.ix_(ys, xs)]
    return v.reshape(-1, *v.shape[2:]).mean(0)


def lum(v):
    v = np.asarray(v, np.float64)
    return float(v.mean()) if v.ndim else float(v)


# ------------------------------------------------------------------ USGS maps against PROJ
print('USGS mosaics: output pixels against the source GeoTIFF located by PROJ')


def geog(ds):
    w = ds.crs.to_wkt()
    i = w.index('GEOGCS[')
    d = 0
    for j in range(i, len(w)):
        d += (w[j] == '[') - (w[j] == ']')
        if w[j] == ']' and d == 0:
            break
    from rasterio.crs import CRS
    return CRS.from_wkt(w[i:j + 1])


def proj_check(k, tif_key):
    import rasterio
    import rasterio.warp
    from rasterio.windows import Window
    m = J['bodies'][k]
    a = imgs[k]
    Wd, Hd = m['width'], m['height']
    rng = np.random.default_rng(20260923)
    diffs = {'as shipped': [], 'mirrored': [], 'shifted 180': []}
    with rasterio.open(T.usgs(tif_key)) as ds:
        g = geog(ds)
        n = 0
        while n < 40:
            lon = float(rng.uniform(-180, 180))
            lat = float(rng.uniform(-60, 60))
            x, y = pix(k, lon, lat)
            if x < 2 or x > Wd - 3:
                continue
            # footprint of the 3 x 3 output pixels around (x, y)
            lon0 = m['lon_left_deg'] + 360.0 * (x - 1) / Wd
            lon1 = m['lon_left_deg'] + 360.0 * (x + 2) / Wd
            lat1 = 90.0 - 180.0 * (y - 1) / Hd
            lat0 = 90.0 - 180.0 * (y + 2) / Hd
            xs, ys = rasterio.warp.transform(g, ds.crs, [lon0, lon1], [lat1, lat0])
            r0, c0 = ds.index(xs[0], ys[0])
            r1, c1 = ds.index(xs[1], ys[1])
            r0, r1 = max(r0, 0), min(r1, ds.height)
            if c0 < 0 or c1 > ds.width or c1 <= c0:
                continue                      # footprint straddles the source's own seam: skip
            src = ds.read(window=Window(c0, r0, c1 - c0, r1 - r0)).astype(np.float64)
            valid = (src != 0).any(axis=0)
            if valid.mean() < 0.999:
                continue
            ref = src.reshape(src.shape[0], -1).mean(axis=1)
            for name, lo in (('as shipped', lon), ('mirrored', -lon), ('shifted 180', lon + 180.0)):
                v = val(k, lo, lat, 1)
                diffs[name].append(float(np.abs(np.atleast_1d(v) - (ref if a.ndim == 3 else ref[0])).mean()))
            n += 1
    med = {k2: float(np.median(v)) for k2, v in diffs.items()}
    ok = med['as shipped'] < 4.0 and med['mirrored'] > 3 * med['as shipped'] and med['shifted 180'] > 3 * med['as shipped']
    check(ok, f'{k}: 40 random points, median |shipped - source| {med["as shipped"]:.2f} DN (max '
              f'{max(diffs["as shipped"]):.1f}); if mirrored {med["mirrored"]:.1f}, if shifted 180 deg {med["shifted 180"]:.1f}')


for k in ('mercury', 'venus', 'mars', 'pluto', 'charon', 'io', 'ganymede', 'triton'):
    if k in J['bodies']:
        proj_check(k, f'{k}_tif')

# ------------------------------------------------------------------ named features
print('features (each against its mirror image)')


def ring_signature(k, lo, la, r_in, r_out, disc, chan=0):
    """Mean of an annulus minus mean of a central disc (degrees on the sphere), from a crop."""
    a = imgs[k][..., chan] if imgs[k].ndim == 3 else imgs[k]
    m = J['bodies'][k]
    H, W = a.shape
    lat = 90 - 180 * (np.arange(H) + 0.5) / H
    rows = np.nonzero(np.abs(lat - la) < r_out + 1)[0]
    lon = m['lon_left_deg'] + 360 * (np.arange(W) + 0.5) / W
    dl = (lon - lo + 180) % 360 - 180
    cols = np.nonzero(np.abs(dl) < (r_out + 1) / max(np.cos(np.radians(abs(la) + r_out + 1)), 0.1))[0]
    LON, LAT = np.meshgrid(lon[cols], lat[rows])
    c = np.sin(np.radians(la)) * np.sin(np.radians(LAT)) + np.cos(np.radians(la)) * np.cos(np.radians(LAT)) * np.cos(np.radians(LON - lo))
    d = np.degrees(np.arccos(np.clip(c, -1, 1)))
    sub = a[np.ix_(rows, cols)]
    return float(sub[(d > r_in) & (d < r_out)].mean() - sub[d < disc].mean())


# Mars — Olympus Mons: the bright basal scarp ring (radius ~4-5.5 deg) around darker flanks.
best = max((ring_signature('mars', lo, la, 4.0, 5.5, 3.0), lo, la)
           for lo in np.arange(-150.0, -117.0, 1.0) for la in np.arange(5.0, 33.0, 1.0))
mir = ring_signature('mars', 133.8, 18.65, 4.0, 5.5, 3.0)
check(abs(best[1] - (226.2 - 360)) <= 1.5 and abs(best[2] - 18.65) <= 1.5 and best[0] > 2 * max(mir, 1),
      f'Mars: Olympus Mons scarp ring found at {best[1] + 360:.1f} E {best[2]:.1f} N (expected 226.2 E 18.65 N), '
      f'ring - flank {best[0]:.1f} DN red; at the mirrored place {mir:.1f}')
sy, sym = lum(val('mars', 69.5, 8.4, 2)), lum(val('mars', -69.5, 8.4, 2))
he, hem = lum(val('mars', 70.0, -42.0, 2)), lum(val('mars', -70.0, -42.0, 2))
check(sy < 0.5 * sym and he > 1.3 * hem, f'Mars: Syrtis Major (69.5 E, 8.4 N) dark {sy:.0f} vs mirrored {sym:.0f}; '
                                          f'Hellas (70 E, 42 S) bright {he:.0f} vs mirrored {hem:.0f}')

# Moon
ty, tym = lum(val('moon', 348.8, -43.3, 1)), lum(val('moon', 11.2, -43.3, 1))
hu, hum = lum(val('moon', -38.6, -24.4, 2)), lum(val('moon', 38.6, -24.4, 2))
near = imgs['moon'][:, 512:1536].mean()
far = np.concatenate([imgs['moon'][:, :512], imgs['moon'][:, 1536:]], axis=1).mean()
check(ty > tym + 20 and hu < hum - 25 and near < far - 10,
      f'Moon: Tycho (348.8 E, 43.3 S) {ty:.0f} vs mirrored {tym:.0f}; Mare Humorum (38.6 W, 24.4 S) {hu:.0f} vs '
      f'mirrored {hum:.0f}; near side mean {near:.0f} < far side {far:.0f}')

# Venus (radar)
mx, pl = lum(val('venus', 3.0, 65.0, 1)), float(np.median(imgs['venus'][200:312]))
be, bem = lum(val('venus', 282.8, 25.3, 1)), lum(val('venus', 77.2, 25.3, 1))
check(mx > pl + 40 and be > bem + 40, f'Venus: Maxwell Montes (3 E, 65 N) {mx:.0f} vs equatorial median {pl:.0f}; '
                                      f'Beta Regio (282.8 E, 25.3 N) {be:.0f} vs mirrored {bem:.0f}')

# Pluto
sp = lum(val('pluto', 175.0, 20.0, 2))
west = float(imgs['pluto'][pix('pluto', 0, -5)[1]:pix('pluto', 0, -15)[1], pix('pluto', 90, 0)[0]:pix('pluto', 150, 0)[0]].mean())
east = float(imgs['pluto'][pix('pluto', 0, -5)[1]:pix('pluto', 0, -15)[1], pix('pluto', 210, 0)[0]:pix('pluto', 270, 0)[0]].mean())
sp_rot = lum(val('pluto', 355.0, 20.0, 2))
check(sp > 140 and sp > sp_rot + 15 and west < east,
      f'Pluto: Sputnik Planitia (175 E, 20 N) {sp:.0f}, 180 deg away {sp_rot:.0f}; equatorial belt 5-15 S: '
      f'90-150 E (west of Sputnik, Cthulhu) {west:.0f} < 210-270 E {east:.0f}')

# Charon: the dark north polar spot (Mordor Macula) against mid-latitudes
npole = float(imgs['charon'][:pix('charon', 0, 78)[1]].mean())
mid = float(imgs['charon'][pix('charon', 0, 45)[1]:pix('charon', 0, 15)[1]].mean())
check(npole < 0.5 * mid, f'Charon: north of 78 N mean {npole:.0f} (dark polar spot) vs 15-45 N {mid:.0f}')

# Optional moons. Io and Ganymede are labelled PositiveWest: features at west longitude W must sit
# at east longitude -W.
if 'io' in J['bodies']:
    def ring_min(k, lo, la, r):
        m = J['bodies'][k]
        best = 1e9
        for dx in np.arange(-r, r + 0.01, 0.5):
            for dy in np.arange(-r, r + 0.01, 0.5):
                if dx * dx + dy * dy <= r * r:
                    best = min(best, lum(val(k, lo + dx / np.cos(np.radians(la)), la + dy, 0)))
        return best
    lk, lkm = ring_min('io', 51.2, 12.6, 3.0), ring_min('io', -51.2, 12.6, 3.0)
    pr, prm = lum(val('io', -153.0, -1.5, 1)), lum(val('io', 153.0, -1.5, 1))
    check(lk < lkm - 30 and pr < prm, f'Io: Loki Patera (12.6 N, 308.8 W = 51.2 E) dark ring {lk:.0f} vs the mirrored place '
                                      f'{lkm:.0f}; Prometheus (1.5 S, 153 W) {pr:.0f} vs mirrored {prm:.0f}')
if 'ganymede' in J['bodies']:
    gr, grm = lum(val('ganymede', -145.0, 35.0, 1)), lum(val('ganymede', 145.0, 35.0, 1))
    tr, trm = lum(val('ganymede', -27.0, 11.0, 1)), lum(val('ganymede', 27.0, 11.0, 1))
    os_, osm = lum(val('ganymede', -166.0, -38.0, 1)), lum(val('ganymede', 166.0, -38.0, 1))
    check(gr < grm - 15 and tr > trm + 40 and os_ > osm + 40,
          f'Ganymede: Galileo Regio (35 N, 145 W) dark {gr:.0f} vs mirrored {grm:.0f}; Tros (11 N, 27 W) bright '
          f'{tr:.0f} vs {trm:.0f}; Osiris (38 S, 166 W) bright {os_:.0f} vs {osm:.0f}')
if 'triton' in J['bodies']:
    tt = imgs['triton']
    fillv = J['bodies']['triton']['fill_value']
    blk = tt.reshape(32, 8, 64, 8)
    flat = (blk.std(axis=(1, 3)) < 1.5) & (np.abs(blk.mean(axis=(1, 3)) - fillv) <= 3)   # 8 x 8 blocks
    north = float(flat[:8].mean())
    south = float(flat[24:].mean())
    check(north > 0.9 and south < 0.1, f'Triton: flat "not imaged" fill covers {100 * north:.0f} % of 8x8 blocks north of '
                                       f'45 N and {100 * south:.0f} % south of 45 S (Voyager 2 saw the southern hemisphere)')

# Earth: land and sea, and what a mirror or a 180 deg shift would put there
pts = [(20, 10, 'land', 'Chad'), (0.0, 51.5, 'land', 'Greenwich'), (25, -25, 'land', 'southern Africa'),
       (-30, 0, 'sea', 'mid-Atlantic'), (-150, 0, 'sea', 'central Pacific'), (-60, -10, 'land', 'Amazon'),
       (135, -25, 'land', 'Australia'), (80, -20, 'sea', 'Indian Ocean'), (100, 60, 'land', 'Siberia'),
       (-100, 40, 'land', 'Kansas'), (-40, 30, 'sea', 'North Atlantic'), (160, 30, 'sea', 'North Pacific')]


def is_sea(v):
    return v[2] > v[0] + 15


def score(f):
    return sum(is_sea(val('earth', f(lo), la, 1)) == (kind == 'sea') for lo, la, kind, _ in pts)


s0, s1, s2 = score(lambda l: l), score(lambda l: -l), score(lambda l: l + 180)
check(s0 == len(pts) and s1 < len(pts) - 3 and s2 < len(pts) - 3,
      f'Earth: land/sea right at {s0}/{len(pts)} places (Greenwich, Chad, southern Africa ...); mirrored {s1}, shifted 180 {s2}')

# Earth at night: cities, and registration of its own land/ocean base against the Blue Marble
cities = [(139.7, 35.7, 'Tokyo'), (-74.0, 40.7, 'New York'), (37.6, 55.75, 'Moscow'), (31.2, 30.0, 'Cairo'),
          (2.35, 48.85, 'Paris'), (-46.6, -23.55, 'Sao Paulo')]
cv = [lum(val('earth_night', lo, la, 1)) for lo, la, _ in cities]
cm = [lum(val('earth_night', -lo, la, 1)) for lo, la, _ in cities]
check(min(cv) > 100 and max(cm) < 60, 'Earth at night: ' + ', '.join(f'{n} {v:.0f}' for (_, _, n), v in zip(cities, cv))
      + f'; at the mirrored longitudes at most {max(cm):.0f}')
e = imgs['earth']
land = (e[..., 2] <= e[..., 0] + 15).astype(np.float64)
nl = np.log1p(imgs['earth_night'].mean(axis=2))
land_s = land.reshape(256, 4, 512, 4).mean(axis=(1, 3))
nl_s = nl.reshape(256, 4, 512, 4).mean(axis=(1, 3))
A = land_s[32:224] - land_s[32:224].mean()


def corr(b):
    b = b[32:224] - b[32:224].mean()
    return float((A * b).sum() / np.sqrt((A * A).sum() * (b * b).sum()))


cs = [corr(np.roll(nl_s, s, axis=1)) for s in range(512)]
cmir = max(corr(np.roll(nl_s[:, ::-1], s, axis=1)) for s in range(512))
bs = int(np.argmax(cs))
check(bs == 0 and cs[0] > cmir + 0.2, f'Earth at night vs Blue Marble land mask: best shift {bs} of 512 columns, '
                                      f'correlation {cs[0]:.3f}; best mirrored {cmir:.3f}')

# Jupiter: the Great Red Spot — the reddest large oval, expected near 22 S
jr = imgs['jupiter']
red = jr[..., 0] - jr[..., 2]
k5 = np.ones(9) / 9
sm = np.apply_along_axis(lambda r: np.convolve(np.r_[r[-4:], r, r[:4]], k5, 'valid'), 1, red)
sm = np.apply_along_axis(lambda c: np.convolve(c, k5, 'same'), 0, sm)
band = sm[pix('jupiter', 0, 60)[1]:pix('jupiter', 0, -60)[1]]
yy, xx = np.unravel_index(np.argmax(band), band.shape)
yy += pix('jupiter', 0, 60)[1]
grs_lat = 90 - 180 * (yy + 0.5) / 1024
grs_lon = J['bodies']['jupiter']['lon_left_deg'] + 360 * (xx + 0.5) / 2048
check(-25.0 <= grs_lat <= -17.0, f'Jupiter: reddest spot (Great Red Spot) at {grs_lat:.1f} deg latitude, '
                                  f'{-grs_lon % 360:.1f} W (Dec 2000 snapshot)')
ann = Image.open(T.usgs('jupiter_annotated')).convert('L')
a = np.asarray(ann.crop((201, 400, 3801, 2200)).resize((720, 360), Image.BOX), np.float64)[60:300]
b = np.asarray(Image.fromarray(jr.astype(np.uint8)).convert('L').resize((720, 360), Image.BOX), np.float64)
a -= a.mean()


def corr2(bb):
    y = bb[60:300] - bb[60:300].mean()
    return float((a * y).sum() / np.sqrt((a * a).sum() * (y * y).sum()))


cj = [corr2(np.roll(b, s, axis=1)) for s in range(0, 720, 2)]
cjm = max(corr2(np.roll(b[:, ::-1], s, axis=1)) for s in range(0, 720, 2))
check(int(np.argmax(cj)) == 0 and cj[0] > 0.99, f'Jupiter: shipped map vs the annotated original (x axis labelled '
      f'180 ... 0 ... 180, west longitude decreasing to the right): best shift 0, correlation {cj[0]:.4f}; mirrored {cjm:.4f}')

# Sun: the colour is the TSIS-1 colour
sun = imgs['sun'].reshape(-1, 3)
lin = np.where(sun / 255 <= 0.04045, sun / 255 / 12.92, ((sun / 255 + 0.055) / 1.055) ** 2.4).mean(0)
want = np.array(J['colours']['sun']['linear'])
check(np.abs(lin / lin[0] - want / want[0]).max() < 0.01, f'Sun map: mean linear colour ratio {np.round(lin / lin[0], 3).tolist()} '
      f'vs TSIS-1 {np.round(want / want[0], 3).tolist()}')

# ------------------------------------------------------------------ colours
print('colours')
research = {'jupiter': (193, 193, 178), 'saturn': (197, 185, 155), 'uranus': (154, 195, 202), 'neptune': (135, 183, 203)}
for k, ref in research.items():
    c = J['colours'][k]
    dE = max(abs(p - q) for p, q in zip(c['srgb'], c['srgb_illuminant_E']))
    dR = max(abs(p - q) for p, q in zip(c['srgb_illuminant_E'], ref))
    check(dE <= 3 and dR <= 1, f'{k}: sRGB {c["srgb"]} (sunlight, Bradford to D65); illuminant E {c["srgb_illuminant_E"]} '
                               f'(research {list(ref)}), albedo Y {c["albedo_Y"]}')
check(J['colours']['uranus']['srgb'][2] > J['colours']['uranus']['srgb'][0] and
      J['colours']['neptune']['srgb'][0] < J['colours']['uranus']['srgb'][0], 'Uranus and Neptune blue-green, Neptune bluer')
xy = J['colours']['sun']['xy']
check(abs(xy[0] - 0.3216) < 0.001 and abs(xy[1] - 0.3321) < 0.001, f'Sun (TSIS-1): xy {xy}, CCT {J["colours"]["sun"]["cct_k_mccamy"]} K, '
                                                                    f'sRGB {J["colours"]["sun"]["srgb"]}')
jm = imgs['jupiter'].reshape(-1, 3).mean(0)
print(f'  info  Jupiter map mean sRGB {np.round(jm, 1).tolist()} vs Karkoschka disk colour {J["colours"]["jupiter"]["srgb"]}')

# ------------------------------------------------------------------ the sky
print('sky: Gaia DR3 counts')
sk = Image.open(os.path.join(SKY, S['file']))
check(sk.format == 'JPEG' and sk.mode == 'L' and sk.size == (2048, 1024) and S['frame'] == 'ICRS',
      f'{S["file"]}: {sk.format} {sk.mode} {sk.size[0]}x{sk.size[1]}, frame {S["frame"]}')
v = np.asarray(sk, np.float64) / 255.0
st = S['stretch']
b0, s0_, w0 = st['black_per_deg2'], st['soft_per_deg2'], st['white_per_deg2']
D_ship = np.where(v > 0, b0 + s0_ * np.sinh(v * np.arcsinh((w0 - b0) / s0_)), np.nan)

# recompute the corrected map independently of 31_sky.py's code path
import astropy.units as u
from astropy.io import fits
from astropy_healpix import HEALPix
import hashlib
pm = np.asarray(fits.open(T.gaia('point_map'))[1].data['T']).ravel().astype(np.int64)
raw = pm.copy()
for (o, p) in T.GAIA_PARTITIONS:
    sid, h29, _ = T.gaia_partition_columns(o, p)
    _, first = np.unique(sid, return_index=True)
    p8 = h29[first] >> (2 * (29 - 8))
    n = 4 ** (8 - o)
    pm[p * n:(p + 1) * n] = np.bincount(p8 - p * n, minlength=n)
dig = hashlib.sha256(pm.astype('<i8').tobytes()).hexdigest()
check(int(pm.sum()) == S['dedup']['total_after_fix'] == 1811709793 and
      dig == '4c56bc5364ee36041c16349d40b0c400f99e73d3b42c5d3961b1fe4255376eca',
      f'corrected map: {int(pm.sum()):,} sources; identical to the research and verifier arrays (sha256 {dig[:12]}...)')
ratio = raw[pm != raw] / pm[pm != raw]
n3 = int(np.sum(np.abs(ratio - 3.0) < 1e-9))
check(len(ratio) == 257 and n3 >= 225 and ratio.min() > 1.0 and ratio.max() <= 3.0,
      f'{len(ratio)} order-8 pixels were too high before the fix: {n3} exactly 3x, the rest (edge of the duplicated '
      f'block) {ratio.min():.3f}-3x')
hp = HEALPix(nside=256, order='nested')
area = hp.pixel_area.to_value(u.deg ** 2)
ra = 360.0 * (np.arange(2048) + 0.5) / 2048
dec = 90.0 - 180.0 * (np.arange(1024) + 0.5) / 1024
RA, DEC = np.meshgrid(ra, dec)
D = hp.interpolate_bilinear_lonlat(RA.ravel() * u.deg, DEC.ravel() * u.deg, pm.astype(float)).reshape(1024, 2048) / area
mid = (D > b0 * 1.5) & (D < w0 * 0.9) & (v > 0)
rel = np.abs(D_ship[mid] / D[mid] - 1)
check(np.median(rel) < 0.02 and np.percentile(rel, 99) < 0.15,
      f'shipped pixels invert (sky.json stretch) to the recomputed densities: median {100 * np.median(rel):.2f} %, '
      f'99th percentile {100 * np.percentile(rel, 99):.1f} % (8-bit and JPEG quantisation)')

# the formerly triplicated patch (l 154-160, b 2-7) must look like its surroundings
from astropy.coordinates import SkyCoord
g = SkyCoord(ra=RA.ravel() * u.deg, dec=DEC.ravel() * u.deg, frame='icrs').galactic
L, B = g.l.deg.reshape(RA.shape), g.b.deg.reshape(RA.shape)
inside = (L > 154.5) & (L < 159.7) & (B > 2.4) & (B < 7.1)
around = (L > 150) & (L < 164) & (B > 1) & (B < 9) & ~((L > 153.5) & (L < 160.7) & (B > 1.5) & (B < 8))
pr = float(np.median(D_ship[inside]) / np.median(D_ship[around]))
check(0.6 < pr < 1.6, f'old duplicate patch: median density inside / around = {pr:.2f} (was ~3 before the fix)')


def sky_xy(ra_, dec_):
    return int(np.floor(ra_ / 360 * 2048)) % 2048, int(np.floor((90 - dec_) / 180 * 1024))


def local(ra_, dec_, r_in=4.0, r_out=8.0, core=1.0):
    c = np.sin(np.radians(dec_)) * np.sin(np.radians(DEC)) + np.cos(np.radians(dec_)) * np.cos(np.radians(DEC)) * np.cos(np.radians(RA - ra_))
    d = np.degrees(np.arccos(np.clip(c, -1, 1)))
    return float(v[d < core].mean() * 255), float(v[(d > r_in) & (d < r_out)].mean() * 255)


for name, ra_, dec_, rin, rout, core in (('LMC', 80.894, -69.756, 7, 12, 1.5), ('SMC', 13.187, -72.829, 4, 8, 1.0),
                                          ('M31', 10.68, 41.27, 1.5, 4, 0.4)):
    c_, r_ = local(ra_, dec_, rin, rout, core)
    cmr, rmr = local(360 - ra_, dec_, rin, rout, core)
    x, y = sky_xy(ra_, dec_)
    check(c_ > r_ + 15 and c_ > cmr + 15, f'{name} at RA {ra_} Dec {dec_} (pixel {x}, {y}): core {c_:.0f} vs ring {r_:.0f}; '
                                          f'at the mirrored RA {cmr:.0f}')
# the Galactic centre: brightest 10-degree cap of the whole sky
wgt = np.cos(np.radians(DEC))
best = (-1, 0, 0)
for dc in np.arange(-80, 81, 4.0):
    for rc in np.arange(0, 360, 4.0 / max(np.cos(np.radians(dc)), 0.2)):
        c = np.sin(np.radians(dc)) * np.sin(np.radians(DEC[::4, ::4])) + np.cos(np.radians(dc)) * np.cos(np.radians(DEC[::4, ::4])) * np.cos(np.radians(RA[::4, ::4] - rc))
        msk = c > np.cos(np.radians(10))
        mval = float((v[::4, ::4][msk] * wgt[::4, ::4][msk]).sum() / wgt[::4, ::4][msk].sum())
        if mval > best[0]:
            best = (mval, rc, dc)
sep = np.degrees(np.arccos(np.sin(np.radians(best[2])) * np.sin(np.radians(-28.936)) +
                           np.cos(np.radians(best[2])) * np.cos(np.radians(-28.936)) * np.cos(np.radians(best[1] - 266.405))))
check(sep < 8, f'brightest 10 deg cap of the sky centred at RA {best[1]:.0f} Dec {best[2]:.0f}, {sep:.1f} deg from the '
               f'Galactic centre (266.4, -28.9); mean {255 * best[0]:.0f}')
plane = float(np.median(v[np.abs(B) < 5])) * 255
caps = float(np.median(v[np.abs(B) > 60])) * 255
check(plane > caps + 80, f'|b| < 5 deg median {plane:.0f} vs |b| > 60 deg median {caps:.0f}')

print()
if fails:
    print(f'verify_textures_sky: {len(fails)} FAILED')
    sys.exit(1)
print('verify_textures_sky: all checks passed')
