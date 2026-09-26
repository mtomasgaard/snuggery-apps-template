"""Bathymetry for the North Sea app — EMODnet Bathymetry DTM via WCS, packed as an 8-bit PNG.

    GET https://ows.emodnet-bathymetry.eu/wcs?service=WCS&version=1.0.0&request=GetCoverage
        &coverage=emodnet:mean&crs=EPSG:4326&BBOX=lon0,lat0,lon1,lat1&format=image/tiff
        &interpolation=nearest&resx=0.03&resy=0.015

returns a float32 GeoTIFF of mean depth (negative metres; NaN or a huge value where there is no
data, e.g. on land). This module turns it into what a phone can draw in one call:

  * rows are RESAMPLED TO WEB MERCATOR (uniform in Mercator y between lat0 and lat1), so the
    app draws the image with a single drawImage between the projected corners, no warping;
  * depth is encoded as one byte per pixel, v = round(255 × sqrt(depth / 3000)), so the
    shallow North Sea keeps ~2 m steps and everything below 3000 m saturates; 0 is land or no
    data (transparent in the app). The app colours the byte through a lookup table per theme;
  * written as a greyscale PNG with the standard library (zlib + struct), no Pillow.

EMODnet Bathymetry: DTM 2024, CC BY 4.0; attribution "EMODnet Bathymetry Consortium (2024):
EMODnet Digital Bathymetry (DTM)". The world app uses Natural Earth's bathymetry polygons instead
(build_world.py): a 15 arc-second global grid would be tens of megabytes for a tint.
"""
from __future__ import annotations

import io
import math
import struct
import urllib.parse
import zlib

from .common import BuildError, Cache, log

WCS = "https://ows.emodnet-bathymetry.eu/wcs"
MAX_DEPTH = 3000.0
RES_X, RES_Y = 0.03, 0.015          # degrees; ~2 km at 58°N, ~1.7 km north-south

SOURCE = {
    "id": "emodnet-bathymetry",
    "name": "EMODnet Bathymetry — Digital Terrain Model (mean depth)",
    "url": "https://emodnet.ec.europa.eu/en/bathymetry",
    "licence": "CC BY 4.0",
    "attribution": "Bathymetry: EMODnet Bathymetry Consortium, EMODnet Digital Bathymetry (DTM)",
    "cadence": "with the build; the DTM is re-released every two years",
}


def _merc_y(lat_deg: float) -> float:
    lat = math.radians(max(-85.0, min(85.0, lat_deg)))
    return math.log(math.tan(math.pi / 4 + lat / 2))


def _png_grey(width: int, height: int, rows) -> bytes:
    """Greyscale 8-bit PNG from an iterable of `height` byte rows of length `width`."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    raw = bytearray()
    for r in rows:
        raw.append(0)          # filter type 0 (none); PNG deflate does well enough on smooth depth
        raw.extend(r)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


TILE_X, TILE_Y = 6.0, 3.0     # degrees; the server reads the source at full resolution per
                              # request and refuses more than ~98 MB, which a 6°×3° tile stays under


def _tile(cache: Cache, x0, y0, x1, y1):
    import numpy as np
    import tifffile
    url = WCS + "?" + urllib.parse.urlencode({
        "service": "WCS", "version": "1.0.0", "request": "GetCoverage", "coverage": "emodnet:mean",
        "crs": "EPSG:4326", "BBOX": f"{x0},{y0},{x1},{y1}", "format": "image/tiff",
        "interpolation": "nearest", "resx": RES_X, "resy": RES_Y})
    raw = cache.get(f"global/emodnet/mean_{x0}_{y0}_{x1}_{y1}_{RES_X}_{RES_Y}.tif", url, timeout=600)
    if raw[:4] not in (b"II*\x00", b"MM\x00*"):
        raise BuildError(f"EMODnet WCS tile {x0},{y0},{x1},{y1} is not a TIFF: {raw[:300]!r}")
    a = tifffile.imread(io.BytesIO(raw)).astype("float32")
    if a.ndim == 3:
        a = a[..., 0]
    return a


def build(cache: Cache, bbox, out_png: str):
    import numpy as np
    x0, y0, x1, y1 = bbox
    w = int(round((x1 - x0) / RES_X))
    h = int(round((y1 - y0) / RES_Y))
    a = np.full((h, w), np.nan, dtype="float32")
    ty = y1
    n_tiles = 0
    while ty > y0 + 1e-9:
        by0 = max(y0, ty - TILE_Y)
        tx = x0
        while tx < x1 - 1e-9:
            bx1 = min(x1, tx + TILE_X)
            t = _tile(cache, tx, by0, bx1, ty)
            r0 = int(round((y1 - ty) / RES_Y))
            c0 = int(round((tx - x0) / RES_X))
            th = min(t.shape[0], h - r0)
            tw = min(t.shape[1], w - c0)
            a[r0:r0 + th, c0:c0 + tw] = t[:th, :tw]
            n_tiles += 1
            tx = bx1
        ty = by0
    log(f"  emodnet bathymetry: {n_tiles} tiles mosaicked into {w}x{h}")
    if h < 100 or w < 100:
        raise BuildError(f"EMODnet grid is only {w}x{h}")
    depth = -a
    depth[~np.isfinite(depth)] = 0
    depth[depth > 12000] = 0            # nodata sentinels
    depth[depth < 0] = 0                # land
    v = np.round(255.0 * np.sqrt(np.clip(depth, 0, MAX_DEPTH) / MAX_DEPTH)).astype("uint8")
    v[(depth > 0) & (v == 0)] = 1       # anything under water is at least 1, so 0 means land

    # rows: source row 0 is the northern edge (lat y1). Output rows uniform in Mercator y.
    my0, my1 = _merc_y(y0), _merc_y(y1)
    out_h = int(round(h * 1.15))        # a little taller: Mercator stretches the north
    src_rows = np.empty(out_h, dtype="int64")
    for i in range(out_h):
        my = my1 - (my1 - my0) * (i + 0.5) / out_h
        lat = math.degrees(2 * math.atan(math.exp(my)) - math.pi / 2)
        r = int((y1 - lat) / (y1 - y0) * h)
        src_rows[i] = min(h - 1, max(0, r))
    img = v[src_rows, :]
    png = _png_grey(w, out_h, (bytes(img[i].tobytes()) for i in range(out_h)))
    with open(out_png, "wb") as f:
        f.write(png)
    wet = int((v > 0).sum())
    log(f"  emodnet bathymetry: grid {w}x{h} -> png {w}x{out_h}, {len(png):,} B, "
        f"max depth {float(depth.max()):.0f} m, {wet * 100 // (w * h)}% water")
    return {
        "file": out_png.rsplit("/", 1)[-1],
        "bounds": [x0, y0, x1, y1],
        "width": w, "height": out_h,
        "rows": "uniform in Web Mercator y between bounds[1] and bounds[3]; columns uniform in longitude",
        "encoding": f"8-bit grey; 0 = land or no data; depth_m = {MAX_DEPTH:.0f} × (v/255)²",
        "maxDepth": MAX_DEPTH,
        "source": SOURCE["id"],
    }
