"""Verifies step 10 (tools/CONTRACT.md §2 and §14) and prints what it measured.

- every manifest slice has its file, 1024 x 512 RGB WebP, within the per-map cap; the 90 within the
  total cap; the proxy 2560 x 1152 within its cap; no other file in data/surface/;
- manifest order: ascending age, index = position, maps 1 ... 93 without 20, 89, 91;
- registration gate: map 1 (today) classified "water iff blue > max(red, green)" against Natural
  Earth 1:50m land rasterised at the same pixel centres (even-odd, so holes are cut), weighted by
  cos(latitude): agreement >= 0.95 at zero shift, and strictly highest at zero among horizontal
  shifts of ±3, ±5, ±10, ±14 (≈ ±5°) and ±20 px. A wrongly registered raster (off by half a
  width, or flipped) fails here.

    .venv/bin/python verify_surface.py
"""
import io
import json
import os

import numpy as np
from PIL import Image

from geo import even_odd, geojson_rings, load_geojson, pixel_centres, water_mask
from paths import DATA

CAP_EACH, CAP_ALL, CAP_PROXY = 110_000, 5_000_000, 480_000
GATE = 0.95
SHIFTS = [3, 5, 10, 14, 20]


def main():
    with open(os.path.join(DATA, 'manifest.json'), encoding='utf-8') as f:
        man = json.load(f)
    sl = man['slices']
    assert man['count'] == len(sl) == 90
    assert [s['i'] for s in sl] == list(range(90))
    assert all(a['age_ma'] <= b['age_ma'] for a, b in zip(sl, sl[1:])), 'not ascending age'
    assert sl[0]['map'] == 1 and sl[-1]['map'] == 93
    assert not {20, 89, 91} & {s['map'] for s in sl}
    W, H = man['surface']['width'], man['surface']['height']
    assert (W, H) == (1024, 512)

    total, sizes = 0, []
    for s in sl:
        p = os.path.join(DATA, s['file'])
        assert os.path.exists(p), f'missing {s["file"]}'
        b = open(p, 'rb').read()
        with Image.open(io.BytesIO(b)) as im:
            assert im.format == 'WEBP' and im.size == (W, H) and im.mode == 'RGB', \
                f'{s["file"]}: {im.format} {im.size} {im.mode}'
        assert len(b) <= CAP_EACH, f'{s["file"]}: {len(b)} > {CAP_EACH}'
        total += len(b)
        sizes.append(len(b))
    assert total <= CAP_ALL, f'maps total {total} > {CAP_ALL}'
    pp = os.path.join(DATA, man['proxy']['file'])
    pb = open(pp, 'rb').read()
    with Image.open(io.BytesIO(pb)) as im:
        assert im.format == 'WEBP' and im.size == (2560, 1152) and im.mode == 'RGB'
    assert len(pb) <= CAP_PROXY
    extra = set(os.listdir(os.path.join(DATA, 'surface'))) - \
        {os.path.basename(s['file']) for s in sl} - {'proxy.webp'}
    assert not extra, f'unclaimed files in data/surface: {sorted(extra)}'
    print(f'maps: 90 files, {total:,} bytes (cap {CAP_ALL:,}), {min(sizes):,}–{max(sizes):,} each '
          f'(cap {CAP_EACH:,})')
    print(f'proxy: 2560x1152, {len(pb):,} bytes (cap {CAP_PROXY:,})')

    # Registration gate on map 1.
    with Image.open(os.path.join(DATA, sl[0]['file'])) as im:
        rgb = np.asarray(im.convert('RGB'))
    painted_land = ~water_mask(rgb)
    lons, lats = pixel_centres(W, H)
    ne_land = even_odd(geojson_rings(load_geojson('ne_land')), lons, lats)
    w = np.repeat(np.cos(np.radians(lats))[:, None], W, axis=1)
    w /= w.sum()

    def agree(shift):
        return float((w * (np.roll(painted_land, shift, axis=1) == ne_land)).sum())

    a0 = agree(0)
    print(f'registration, map 1 vs Natural Earth 1:50m land, cos-latitude weighted '
          f'(1 px = {360 / W:.4f}° lon):')
    print(f'  shift    0 px (  0.00°): {a0:.4f}')
    worst_margin = 1.0
    for s in SHIFTS:
        for sgn in (-1, 1):
            a = agree(sgn * s)
            worst_margin = min(worst_margin, a0 - a)
            print(f'  shift {sgn * s:+4d} px ({sgn * s * 360 / W:+6.2f}°): {a:.4f}')
    half = agree(W // 2)
    flip = float((w * (painted_land[::-1] == ne_land)).sum())
    print(f'  shift half a width (180°): {half:.4f}; flipped north-south: {flip:.4f}')
    worst_margin = min(worst_margin, a0 - half, a0 - flip)
    assert a0 >= GATE, f'map 1 agrees with Natural Earth on {a0:.4f} < {GATE}'
    assert worst_margin > 0, 'agreement is not strictly highest at zero shift'
    print(f'registration gate passed: {a0:.4f} >= {GATE}, highest at zero shift '
          f'(smallest margin {worst_margin:.4f})')


if __name__ == '__main__':
    main()
