"""Build us-quakes/assets/relief-{conus,ak,hi,pr}.jpg from the pinned 3DEP hillshade PNGs, masked by
the pinned elevation TIFFs and Natural Earth's lakes (tools/CONTRACT.md §5), and record what it did in
scripts/us_quakes/relief.json (committed): the bounds each image covers (from the server's reported
extents, relief-extents.json), the level stretch, the land-pixel counts, the registration gate and
each JPEG's sha256. build_geo.py copies the bounds into geo.json and refuses a JPEG whose sha256
differs from relief.json.

    .venv/bin/python build_relief.py            # rebuild the four JPEGs (a deliberate act; they are committed)
    .venv/bin/python build_relief.py --check    # no rebuild: check the committed JPEGs against relief.json

Per region: land = elevation neither 0 (sea inside a 3DEP tile) nor -32768 (NoData), minus Natural
Earth 1:50m lakes rasterised into the same Mercator grid; everything else is set to 242, the
hillshade's flat-ground grey, which the app's shader leaves unshaded. Levels are stretched from the
0.5th percentile of the land pixels (`lo`) to 255; `neutral` is where 242 lands after the stretch.
Alaska is two exports either side of 180°, and the server widened each to its own pixel size (1604.60
and 1603.78 m), so the western half is resampled onto the eastern half's grid (bilinear for the
shade, nearest for the elevation) before the two are joined, then the whole is scaled to 0.75
(Lanczos). JPEG, one grey channel, quality 75, optimised, no metadata.

Registration gate (CONTRACT §5.2, as amended in its Builder's decisions): the reported extent must
equal the elevation TIFF's own GeoTIFF tiepoint and pixel scale; Natural Earth 1:10m land, rasterised
into each image's grid by the bounds written to geo.json, must agree with the elevation mask on at
least 95 % of the pixels the 3DEP service covers (cos-latitude weighted); over shifts of -5..5 px
along each axis the best agreement must lie within 2 px of zero, and zero must beat ±5 px. (1:50m
land was the first reference and is too coarse for 326 m and 190 m pixels: its Ka Lae, Hawaii's
south point, is 5.8 km north of the DEM's, while the DEM's Ka Lae, 18.912°, and Upolu Point,
20.270°, sit within a pixel of the capes.)
"""
import argparse
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

from common import (BuildError, log, merc_lat, merc_lon, sha256_bytes, sha256_of, unwrap_lon,
                    write_credits_fragment)
from paths import ASSETS, CACHE, HERE
from sources import RELIEF_DEM_PINS, RELIEF_PINS, STATIC

QUALITY = 75
FLAT = 242                      # the multidirectional hillshade's grey for flat ground
NODATA = -32768
CAPS = {'conus': 1_050_000, 'ak': 720_000, 'hi': 60_000, 'pr': 100_000}
AK_SCALE = 0.75
WORLD = 2 * math.pi * 6378137.0     # the Web Mercator world width in metres
RELIEF_JSON = os.path.join(HERE, 'relief.json')


def _extents():
    with open(os.path.join(HERE, 'relief-extents.json'), encoding='utf-8') as f:
        return json.load(f)['regions']


def _load(key):
    """(hillshade float32, elevation int32) for one export, pins checked, sizes and GeoTIFF tags
    checked against the reported extent."""
    png, tif = os.path.join(CACHE, 'relief', key + '.png'), os.path.join(CACHE, 'relief', key + '.tif')
    for p, pin in ((png, RELIEF_PINS[key]), (tif, RELIEF_DEM_PINS[key])):
        if not os.path.exists(p):
            raise BuildError(f'{p} is not cached; run fetch_relief.py')
        if sha256_of(p) != pin[0]:
            raise BuildError(f'{p}: sha256 differs from its pin')
    h = Image.open(png).convert('L')
    e = Image.open(tif)
    ext = _extents()[key]
    if list(h.size) != ext['size'] or list(e.size) != ext['size']:
        raise BuildError(f'{key}: sizes {h.size} / {e.size}, extents say {ext["size"]}')
    tp, sc = e.tag_v2.get(33922), e.tag_v2.get(33550)
    x0, y0, x1, y1 = ext['extent']
    if not tp or abs(tp[3] - x0) > 0.01 or abs(tp[4] - y1) > 0.01 or abs(sc[0] - (x1 - x0) / e.size[0]) > 1e-6:
        raise BuildError(f'{key}: the TIFF georeferencing {tp} {sc} disagrees with the reported extent')
    return h, e, ext


def region_grid(key):
    """(shade Image L, elevation int32 array, grid) where grid = (x0, y1, px, width, height) in
    Web Mercator metres, x on the unwrapped axis (x0 may exceed half the world for Alaska)."""
    if key != 'ak':
        h, e, ext = _load(key)
        x0, y0, x1, y1 = ext['extent']
        return h, np.array(e, dtype=np.int32), (x0, y1, (x1 - x0) / h.size[0], h.size[0], h.size[1])
    hw, ew, xw = _load('ak-west')
    he, ee, xe = _load('ak-east')
    wx0, wy0, wx1, wy1 = xw['extent']
    ex0, ey0, ex1, ey1 = xe['extent']
    ex0 += WORLD                                   # east of 180°, on the unwrapped axis
    ex1 += WORLD
    pe = (ex1 - ex0) / he.size[0]
    pw = (wx1 - wx0) / hw.size[0]
    ncol = hw.size[0]                              # 555 columns west of the eastern grid
    tx0 = ex0 - ncol * pe
    H = he.size[1]
    # output continuous (u, v) -> input (u', v'): x = tx0 + u*pe = wx0 + u'*pw ; y = ey1 - v*pe = wy1 - v'*pw
    coef = (pe / pw, 0.0, (tx0 - wx0) / pw, 0.0, pe / pw, (wy1 - ey1) / pw)
    west_shade = hw.transform((ncol, H), Image.AFFINE, coef, resample=Image.BILINEAR, fillcolor=FLAT)
    west_elev = ew.transform((ncol, H), Image.AFFINE, coef, resample=Image.NEAREST, fillcolor=NODATA)
    shade = Image.new('L', (ncol + he.size[0], H))
    shade.paste(west_shade, (0, 0))
    shade.paste(he, (ncol, 0))
    elev = np.concatenate([np.array(west_elev, dtype=np.int32), np.array(ee, dtype=np.int32)], 1)
    return shade, elev, (tx0, ey1, pe, ncol + he.size[0], H)


def _geo_rings(name):
    with open(os.path.join(CACHE, STATIC[name]['name']), encoding='utf-8') as f:
        gj = json.load(f)
    for ft in gj['features']:
        g = ft['geometry']
        polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates'] if g['type'] == 'MultiPolygon' else []
        for poly in polys:
            yield poly


def rasterise(name, grid, unwrap):
    """A boolean mask of Natural Earth polygons in the grid (exteriors filled, holes cleared)."""
    x0, y1, px, w, hgt = grid
    im = Image.new('1', (w, hgt), 0)
    dr = ImageDraw.Draw(im)
    lon_min, lon_max = merc_lon(x0), merc_lon(x0 + px * w)
    lat_min, lat_max = merc_lat(y1 - px * hgt), merc_lat(y1)
    for poly in _geo_rings(name):
        for k, ring in enumerate(poly):
            pts = [((unwrap_lon(lo) if unwrap else lo), la) for lo, la in ring]
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            if max(xs) < lon_min - 1 or min(xs) > lon_max + 1 or max(ys) < lat_min - 1 or min(ys) > lat_max + 1:
                continue
            if unwrap and max(xs) - min(xs) > 180:
                continue                           # a ring spanning the seam; none near Alaska's box
            pix = [((math.radians(lo) * 6378137.0 - x0) / px - 0.5,
                    (y1 - 6378137.0 * math.log(math.tan(math.pi / 4 + math.radians(max(-85.0, min(85.0, la))) / 2))) / px - 0.5)
                   for lo, la in pts]
            if len(pix) >= 3:
                dr.polygon(pix, fill=1 if k == 0 else 0)
    return np.array(im, dtype=bool)


def gate(key, grid, elev):
    """Registration gate: Natural Earth 1:10m land vs the elevation mask on the pixels 3DEP covers,
    cos-latitude weighted, at zero shift and at every shift of 1 to 5 px along each axis."""
    x0, y1, px, w, hgt = grid
    ne = rasterise('ne_land_10m', grid, key == 'ak')
    covered = elev != NODATA
    land = covered & (elev != 0)
    lat = np.array([merc_lat(y1 - (r + 0.5) * px) for r in range(hgt)])
    b = 6
    wgt = np.cos(np.radians(lat))[b:hgt - b, None]
    inner = (slice(b, hgt - b), slice(b, w - b))
    c = covered[inner]
    total = float((c * wgt).sum())

    def agree(dx, dy):
        sh = np.roll(np.roll(ne, dy, 0), dx, 1)
        return float((((sh[inner] == land[inner]) & c) * wgt).sum() / total)
    zero = agree(0, 0)
    prof_x = {d: (zero if d == 0 else agree(d, 0)) for d in range(-5, 6)}
    prof_y = {d: (zero if d == 0 else agree(0, d)) for d in range(-5, 6)}
    bx = max(prof_x, key=lambda d: (prof_x[d], -abs(d)))
    by = max(prof_y, key=lambda d: (prof_y[d], -abs(d)))
    passed = (zero >= 0.95 and abs(bx) <= 2 and abs(by) <= 2
              and all(zero > prof_x[d] for d in (-5, 5)) and all(zero > prof_y[d] for d in (-5, 5)))
    return {'reference': 'Natural Earth 1:10m land', 'agreement': round(zero, 5),
            'dx': [round(prof_x[d], 5) for d in range(-5, 6)],
            'dy': [round(prof_y[d], 5) for d in range(-5, 6)],
            'best': [bx, by], 'bestKm': [round(bx * px / 1000, 2), round(by * px / 1000, 2)],
            'passed': passed}


def build_region(key):
    shade, elev, grid = region_grid(key)
    x0, y1, px, w, hgt = grid
    land = (elev != 0) & (elev != NODATA)
    land_px = int(land.sum())
    lakes = rasterise('ne_lakes', grid, key == 'ak')
    land &= ~lakes
    g = gate(key, grid, elev)
    h = np.asarray(shade, dtype=np.float32)
    lo = int(np.percentile(h[land], 0.5, method='lower'))
    v = np.where(land, h, float(FLAT))
    s = np.clip(np.rint((v - lo) / (255.0 - lo) * 255.0), 0, 255).astype(np.uint8)
    neutral = round((FLAT - lo) / (255.0 - lo) * 255.0, 1)
    im = Image.fromarray(s, 'L')
    if key == 'ak':
        im = im.resize((round(w * AK_SCALE), round(hgt * AK_SCALE)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=QUALITY, optimize=True)
    data = buf.getvalue()
    if len(data) > CAPS[key]:
        raise BuildError(f'relief-{key}.jpg: {len(data):,} B exceeds its cap {CAPS[key]:,} B; nothing written')
    west, east = unwrap_lon(merc_lon(x0)), unwrap_lon(merc_lon(x0 + px * w))
    if key == 'ak':
        west, east = merc_lon(x0), merc_lon(x0 + px * w)     # already on the unwrapped axis
    meta = {'file': f'relief-{key}.jpg', 'width': im.size[0], 'height': im.size[1],
            'west': round(west, 6), 'east': round(east, 6),
            'south': round(merc_lat(y1 - px * hgt), 6), 'north': round(merc_lat(y1), 6),
            'neutral': neutral, 'lo': lo, 'quality': QUALITY,
            'grid': {'x0': round(x0, 3), 'y1': round(y1, 3), 'px': round(px, 6), 'width': w, 'height': hgt},
            'landPixels': land_px, 'lakePixels': int((lakes & (elev != 0) & (elev != NODATA)).sum()),
            'gate': g, 'bytes': len(data), 'sha256': sha256_bytes(data)}
    return meta, data


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='check the committed JPEGs against relief.json')
    a = ap.parse_args(argv)
    if a.check:
        check()
        return
    out = {'note': 'written by build_relief.py; the bounds are the server-reported extents (relief-extents.json), '
                   'in degrees on the 172..296 axis', 'regions': {}}
    blobs = {}
    for key in ('conus', 'ak', 'hi', 'pr'):
        meta, data = build_region(key)
        g = meta['gate']
        log(f'relief {key:5s} {meta["width"]}x{meta["height"]} land {meta["landPixels"]:,} (lakes '
            f'{meta["lakePixels"]:,}) lo {meta["lo"]} neutral {meta["neutral"]} {meta["bytes"]:,} B  '
            f'gate {g["agreement"]:.4f} best shift {g["best"]} px ({g["bestKm"]} km) {"PASS" if g["passed"] else "FAIL"}')
        if not g['passed']:
            raise BuildError(f'relief {key}: registration gate failed ({g}); nothing written')
        out['regions'][key] = meta
        blobs[key] = data
    os.makedirs(ASSETS, exist_ok=True)
    for key, data in blobs.items():
        p = os.path.join(ASSETS, f'relief-{key}.jpg')
        with open(p + '.tmp', 'wb') as f:
            f.write(data)
        os.replace(p + '.tmp', p)
        log(f'  wrote {len(data):>11,} B  {p}')
    with open(RELIEF_JSON + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
        f.write('\n')
    os.replace(RELIEF_JSON + '.tmp', RELIEF_JSON)
    check()


def check():
    """The committed JPEGs are the ones relief.json describes; write the credits fragment."""
    with open(RELIEF_JSON, encoding='utf-8') as f:
        rj = json.load(f)
    for key, m in rj['regions'].items():
        p = os.path.join(ASSETS, m['file'])
        if not os.path.exists(p) or sha256_of(p) != m['sha256']:
            raise BuildError(f'{m["file"]} differs from relief.json; rebuild with build_relief.py')
        with Image.open(p) as im:
            if im.size != (m['width'], m['height']) or im.mode != 'L':
                raise BuildError(f'{m["file"]}: {im.size} {im.mode}, relief.json says {m["width"]}x{m["height"]} L')
    write_credits_fragment('build_relief', [{
        'id': 'relief',
        'source': ['exportImage from the 3DEPElevation ImageServer, rendering rule "Hillshade Multidirectional", '
                   'PNG, Web Mercator; five exports (conus, ak-west, ak-east, hi, pr) pinned by sha256 in '
                   'scripts/us_quakes/sources.py (RELIEF_PINS)',
                   'the same boxes as Int16 elevation for the land mask (RELIEF_DEM_PINS); the extents the '
                   'server reported, in scripts/us_quakes/relief-extents.json'],
        'retrieved': '2026-09-30',
        'adaptations': ['masked to land by the 3DEP elevation of the same box (sea and NoData left '
                        'unshaded) and by Natural Earth 1:50m lakes',
                        'hillshade levels stretched from the 0.5th percentile of land pixels; Alaska\'s '
                        'two exports joined on one grid and scaled to 0.75',
                        're-encoded as grey JPEG, quality 75 (assets/relief-*.jpg)']}])
    log('relief: the four JPEGs match relief.json')


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        sys.exit(1)
