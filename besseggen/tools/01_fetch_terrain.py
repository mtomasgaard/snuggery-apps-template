#!/usr/bin/env python3
"""Step 1 — fetch the elevation data and assemble the two master grids.

Source: Nasjonal hoydemodell DTM1 (1 m), Kartverket, open data (NLOD 2.0 / CC BY 4.0), through the
ArcGIS ImageServer behind the hoyde-dtm-nhm-25833 WCS. See CREDITS.txt and cache/SOURCES.md.

Two masters are fetched, and every level of the model is a local decimation of one of them:

  core  2 m   10241 x 8193 samples over the core box, in 18 requests of about 1707 x 2731
  shell 64 m    833 x  769 samples over the shell box, in one request

Fetching each level at its own resolution was measured and rejected: the service serves coarse
requests from its own pyramids, which disagree with a local decimation of the 2 m grid by an RMSE
of 1.6 m at 4 m and 4.6 m at 8 m, so every level-of-detail seam would carry a step of metres
(cache/SOURCES.md section 1). One master, decimated locally, is the whole reason the seams are
clean.

Everything is cached. A request whose GeoTIFF is already on disk is never repeated, and the
service returns byte-identical data for a repeated request, so a rebuild is reproducible.
Requests are sequential and paced: this is somebody else's public service.
"""
from __future__ import annotations
import os
import sys
import time

import numpy as np
import rasterio
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geom
from paths import DTM

EXPORT = 'https://hoydedata.no/arcgis/rest/services/NHM_DTM_25833/ImageServer/exportImage'
PAUSE_S = 1.0          # between requests, so a long run is polite
RETRIES = 4
# metres; anything outside the box's range is a nodata fill, not terrain. The core is all
# high Jotunheimen; the shell reaches down into Vagavatnet and Boverdalen.
PLAUSIBLE = {'core': (900.0, 2500.0), 'shell': (200.0, 2500.0)}


def split(n, k):
    """Split n samples into k contiguous chunks, as equal as possible. Deterministic."""
    base, rem = divmod(n, k)
    out = []
    start = 0
    for i in range(k):
        count = base + (1 if i < rem else 0)
        out.append((start, count))
        start += count
    return out


def fetch_block(path, x0, y_top, nx, ny, res):
    """Fetch a point grid of nx x ny samples whose north-west sample is at (x0, y_top), spaced
    `res` metres. The half-cell offset is what puts the returned CELL CENTRES exactly on the
    sample positions: a request for n samples spanning x0 .. x0+(n-1)*res asks for the bbox
    x0-res/2 .. x0+(n-1)*res+res/2 at n pixels."""
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        return path
    half = res / 2.0
    bx0 = x0 - half
    bx1 = x0 + (nx - 1) * res + half
    by1 = y_top + half
    by0 = y_top - (ny - 1) * res - half
    # Plain decimal, never %g: a northing of 6 810 464 in %g becomes 6.81046e+06, which is four
    # metres away and silently returns the wrong two rows of terrain.
    params = {
        'bbox': ','.join(f'{v:.3f}' for v in (bx0, by0, bx1, by1)),
        'bboxSR': '25833', 'imageSR': '25833',
        'size': f'{nx},{ny}',
        'format': 'tiff', 'pixelType': 'F32',
        'interpolation': 'RSP_BilinearInterpolation',
        'f': 'image',
    }
    last = None
    for attempt in range(RETRIES):
        try:
            t = time.time()
            r = requests.get(EXPORT, params=params, timeout=180)
            if r.status_code == 200 and r.content[:2] in (b'II', b'MM'):
                tmp = path + '.part'
                with open(tmp, 'wb') as f:
                    f.write(r.content)
                os.replace(tmp, path)
                print(f'    {os.path.basename(path)}  {len(r.content):,} B  {time.time()-t:.1f} s')
                time.sleep(PAUSE_S)
                return path
            last = f'HTTP {r.status_code}, {len(r.content)} B, starts {r.content[:16]!r}'
        except requests.RequestException as e:                    # noqa: PERF203
            last = repr(e)
        print(f'    retry {attempt + 1}/{RETRIES}: {last}')
        time.sleep(5 * (attempt + 1))
    raise SystemExit(f'giving up on {path}: {last}')


def read_block(path, x0, y_top, nx, ny, res, plausible):
    """Read a fetched block and prove it landed where it was asked to land."""
    with rasterio.open(path) as src:
        assert (src.width, src.height) == (nx, ny), (path, src.width, src.height, nx, ny)
        assert src.crs is not None and src.crs.to_epsg() == 25833, (path, src.crs)
        tr = src.transform
        assert abs(tr.a - res) < 1e-6 and abs(tr.e + res) < 1e-6, (path, tr)
        cx = tr.c + tr.a / 2.0          # centre of pixel (0, 0)
        cy = tr.f + tr.e / 2.0
        assert abs(cx - x0) < 1e-3 and abs(cy - y_top) < 1e-3, (path, cx, cy, x0, y_top)
        a = src.read(1).astype(np.float64)
    lo, hi = float(a.min()), float(a.max())
    if not (plausible[0] <= lo and hi <= plausible[1]):
        raise SystemExit(f'{path}: heights {lo:.2f}..{hi:.2f} m are outside {plausible} — '
                         'the service returned a nodata fill, not terrain')
    return a


def build_master(name, box, res, chunks_x, chunks_y):
    """Fetch a whole box as a grid of blocks and assemble it into a uint16-decimetre memmap."""
    ny, nx = geom.grid_shape(box, res)
    raw = os.path.join(DTM, f'{name}_{res}m_{nx}x{ny}_u16dm.raw')
    if os.path.exists(raw) and os.path.getsize(raw) == nx * ny * 2:
        print(f'  {name}: master already assembled ({os.path.getsize(raw):,} B)')
        return raw, (ny, nx)
    print(f'  {name}: {nx} x {ny} samples at {res} m, '
          f'{len(split(nx, chunks_x)) * len(split(ny, chunks_y))} requests')
    dst = np.memmap(raw + '.part', dtype=np.uint16, mode='w+', shape=(ny, nx))
    lo, hi = 1e9, -1e9
    for j0, nj in split(ny, chunks_y):
        for i0, ni in split(nx, chunks_x):
            tif = os.path.join(DTM, f'{name}_{res}m_i{i0}_{ni}_j{j0}_{nj}.tif')
            x0 = box['x0'] + res * i0
            y_top = box['y1'] - res * j0
            fetch_block(tif, x0, y_top, ni, nj, res)
            a = read_block(tif, x0, y_top, ni, nj, res, PLAUSIBLE[name])
            lo = min(lo, float(a.min()))
            hi = max(hi, float(a.max()))
            dst[j0:j0 + nj, i0:i0 + ni] = geom.to_decimetres(a).astype(np.uint16)
            del a
    dst.flush()
    del dst
    os.replace(raw + '.part', raw)
    print(f'  {name}: assembled {raw} ({nx * ny * 2:,} B), heights {lo:.2f}..{hi:.2f} m')
    return raw, (ny, nx)


def main():
    print('Nasjonal hoydemodell DTM1, Kartverket — fetching two master grids')
    build_master('core', geom.CORE, geom.MASTER_RES, 6, 3)
    build_master('shell', geom.SHELL, geom.SHELL_RES, 1, 1)
    print('  done')


if __name__ == '__main__':
    main()
