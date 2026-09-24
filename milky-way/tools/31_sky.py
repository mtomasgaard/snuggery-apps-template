#!/usr/bin/env python3
"""Step 31 — the sky backdrop: Gaia DR3 source counts as an ICRS equirectangular texture.

    data/sky/gaia-dr3-counts.jpg   2048 x 1024 grayscale JPEG (quality 85)
    data/sky/sky.json              pixel <-> RA/Dec mapping, the stretch and what it measures

CONTRACT.md section 6. The source is the HATS point map of Gaia DR3 that STScI/MAST publish on AWS
Open Data (s3://stpubdata, point_map.fits: the number of gaia_source rows in every HEALPix pixel,
NSIDE 256 = order 8, NESTED, ICRS; 1,812,731,847 rows in total, exactly the catalogue's
hats_nrows). It is star COUNTS, not the sky's brightness: every source counts once whatever its
magnitude, so the bulge and the Magellanic Clouds are bright and bright stars do not stand out.

The duplicate-row fix. Two partitions of that HATS copy hold the same source up to three times
(research sky-backdrop, confirmed by its verifier: exact copies, every duplicate group repeated 3x):
Norder=4/Npix=115 (1,368,113 rows, 543,481 distinct source_id) and Norder=3/Npix=29 (1,616,125
rows, 1,418,703 distinct). Their pixels in the point map equal the raw row counts, so they show as
two square patches three times too bright near l = 154-160 deg, b = 2-7 deg. Here the source_id and
_healpix_29 columns of just those two partitions are read (texsky_sources.gaia_partition_columns),
each distinct source_id is counted once at the order-8 pixel of its _healpix_29, and those pixels of
the map are replaced. Total after the fix: 1,811,709,793 (checked below).

Resampling: the count per HEALPix pixel is divided by the pixel area (0.0524558 deg^2) to give
sources per square degree, and interpolated bilinearly (astropy-healpix) at the centre of every
output pixel: column x <-> RA = 360 (x + 0.5) / 2048, row y <-> Dec = 90 - 180 (y + 0.5) / 1024.
RA increases with the column (the app looks the texture up from the view direction, so there is no
mirroring to undo). 2048 x 1024 (0.176 deg per pixel at the equator) already samples the 0.229 deg
data pixels; a larger texture would add bytes, not information.

Stretch (a display choice, recorded in sky.json so the app can invert it):
    v = asinh(max(D - black, 0) / soft) / asinh((white - black) / soft),  clipped to [0, 1],
    pixel = round(255 v),  D in sources per deg^2.
black, soft and white are fixed round numbers chosen by looking at this map: black 2,500 is about
the sparsest 1 % of the sky (the Galactic poles hold ~3,000), white 1,200,000 sits just under the
densest pixels (Baade's window and the LMC, ~1.15-1.4 million), and soft 20,000 keeps the thin disc
and its dust lanes from saturating.

Licence of the data: ESA/Gaia/DPAC, CC BY-NC 3.0 IGO (see tools/credits/textures-sky.json).
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
import texsky_sources as T

W, H = 2048, 1024
QUALITY = 85
BLACK, SOFT, WHITE = 2500.0, 20000.0, 1200000.0      # sources per square degree
NSIDE = 256
TOTAL_RAW = 1812731847          # hats.properties hats_nrows (checked against the file below)
TOTAL_FIXED = 1811709793        # after the fix (research value, reproduced by the verifier)


def load_point_map():
    from astropy.io import fits
    with fits.open(T.gaia('point_map')) as f:
        hdr = f[1].header
        assert (hdr['PIXTYPE'], hdr['ORDERING'], hdr['COORDSYS'], hdr['NSIDE']) == ('HEALPIX', 'NESTED', 'CEL', NSIDE), hdr
        pm = np.asarray(f[1].data['T']).ravel().astype(np.int64)
    assert pm.size == 12 * NSIDE ** 2
    props = dict(l.split('=', 1) for l in open(T.gaia('properties'), encoding='utf-8').read().splitlines()
                 if '=' in l and not l.startswith('#'))
    assert int(props['hats_nrows']) == TOTAL_RAW == int(pm.sum()), (props['hats_nrows'], pm.sum())
    assert int(props['hats_skymap_order']) == 8
    return pm, props


def dedup(pm):
    """Replace the two duplicated partitions' order-8 pixels by counts of distinct source_id."""
    pm = pm.copy()
    report = []
    for (order, pix), meta in sorted(T.GAIA_PARTITIONS.items()):
        sid, h29, digest = T.gaia_partition_columns(order, pix)
        assert len(sid) == meta['rows'], (order, pix, len(sid))
        n = 4 ** (8 - order)
        sub0 = pix * n
        before = int(pm[sub0:sub0 + n].sum())
        assert before == meta['rows'], 'the point map should hold the raw row count of the partition'
        order_idx = np.argsort(sid, kind='stable')
        s, h = sid[order_idx], h29[order_idx]
        new = np.r_[True, s[1:] != s[:-1]]
        grp = np.cumsum(new) - 1
        # every copy of a source must sit in the same order-29 pixel (they are exact copies)
        first_h = h[new]
        assert np.array_equal(h, first_h[grp]), 'duplicate rows disagree on position'
        mult = np.bincount(grp)
        p8 = first_h >> (2 * (29 - 8))
        assert p8.min() >= sub0 and p8.max() < sub0 + n
        counts = np.bincount(p8 - sub0, minlength=n)
        pm[sub0:sub0 + n] = counts
        changed = int(np.count_nonzero(counts != (np.bincount((h >> (2 * (29 - 8))) - sub0, minlength=n))))
        report.append({'partition': f'Norder={order}/Npix={pix}', 's3_version_id': meta['version'],
                       'rows': int(len(sid)), 'distinct_source_id': int(new.sum()),
                       'multiplicity_counts': {str(k): int(v) for k, v in enumerate(np.bincount(mult)) if k and v},
                       'order8_pixels_changed': changed, 'columns_sha256': digest})
        assert int(new.sum()) == meta['unique']
        print(f'  Norder={order}/Npix={pix}: {len(sid):,} rows -> {int(new.sum()):,} distinct sources; '
              f'{changed} order-8 pixels corrected')
    assert int(pm.sum()) == TOTAL_FIXED, pm.sum()
    return pm, report


def resample(pm):
    """Sources per square degree at the centre of every output pixel (bilinear on the sphere)."""
    import astropy.units as u
    from astropy_healpix import HEALPix
    hp = HEALPix(nside=NSIDE, order='nested')
    area = hp.pixel_area.to_value(u.deg ** 2)
    ra = 360.0 * (np.arange(W) + 0.5) / W
    dec = 90.0 - 180.0 * (np.arange(H) + 0.5) / H
    RA, DEC = np.meshgrid(ra, dec)
    d = hp.interpolate_bilinear_lonlat(RA.ravel() * u.deg, DEC.ravel() * u.deg, pm.astype(np.float64))
    return d.reshape(H, W) / area, area


def stretch(D):
    v = np.arcsinh(np.clip(D - BLACK, 0, None) / SOFT) / np.arcsinh((WHITE - BLACK) / SOFT)
    return np.clip(v, 0.0, 1.0)


def encode(v):
    import io
    from PIL import Image
    img = Image.fromarray(np.floor(v * 255.0 + 0.5).astype(np.uint8))  # 2-D uint8 -> mode L
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    return buf.getvalue()


def main():
    print('Gaia DR3 point map (MAST HATS)')
    pm_raw, props = load_point_map()
    print(f'  {int(pm_raw.sum()):,} rows in {pm_raw.size:,} pixels (hats_nrows {int(props["hats_nrows"]):,})')
    pm, report = dedup(pm_raw)
    print(f'  {int(pm.sum()):,} sources after the fix')
    D, area = resample(pm)
    v = stretch(D)
    jpg = encode(v)
    common.write_bin('sky/gaia-dr3-counts.jpg', jpg)
    per_deg2 = pm / area
    meta = {
        'file': 'gaia-dr3-counts.jpg', 'width': W, 'height': H, 'grayscale': True, 'jpeg_quality': QUALITY,
        'frame': 'ICRS', 'projection': 'equirectangular',
        'pixel_to_sky': {'ra_deg': 'RA = 360 * (x + 0.5) / width', 'dec_deg': 'Dec = 90 - 180 * (y + 0.5) / height',
                         'note': 'x = column from the left, y = row from the top; RA increases to the right'},
        'quantity': 'Gaia DR3 sources per square degree (catalogue counts, not surface brightness)',
        'stretch': {'type': 'asinh', 'black_per_deg2': BLACK, 'soft_per_deg2': SOFT, 'white_per_deg2': WHITE,
                    'formula': 'v = asinh(max(D - black, 0) / soft) / asinh((white - black) / soft), clipped '
                               'to [0, 1]; pixel = round(255 v)',
                    'inverse': 'D = black + soft * sinh(v * asinh((white - black) / soft)) (for v > 0)',
                    'black_per_pixel': BLACK * area, 'white_per_pixel': WHITE * area},
        'resampling': 'bilinear interpolation of the NSIDE 256 map (per deg^2) at each pixel centre, '
                      'astropy-healpix 1.1.2',
        'source': {'catalogue': 'Gaia DR3 gaia_source', 'product': 'HATS point_map.fits (STScI/MAST, AWS Open '
                   'Data bucket stpubdata, gaia/gaia_dr3/public/hats/gaia)',
                   's3_version_id': T.GAIA_FILES['point_map'][1], 'sha256': T.GAIA_FILES['point_map'][2],
                   'nside': NSIDE, 'ordering': 'NESTED', 'coordsys': 'CEL (ICRS)',
                   'hats_builder': props.get('hats_builder'), 'hats_creation_date': props.get('hats_creation_date'),
                   'rows_raw': int(pm_raw.sum())},
        'dedup': {'note': 'Two partitions of the MAST HATS copy repeat rows (same source_id up to 3 times); their '
                          'order-8 pixels are recounted from distinct source_id.',
                  'partitions': report, 'total_after_fix': int(pm.sum())},
        'stats_per_deg2': {'min': float(per_deg2.min()), 'median': float(np.median(per_deg2)),
                           'max': float(per_deg2.max()),
                           'fraction_of_sky_below_black': float(np.mean(per_deg2 < BLACK)),
                           'fraction_of_sky_above_white': float(np.mean(per_deg2 > WHITE))},
        'caption': 'Density of stars measured by Gaia (ESA), from Gaia DR3. The view from the Sun.',
        'credit': 'ESA/Gaia/DPAC', 'licence': 'CC BY-NC 3.0 IGO',
    }
    common.write_json('sky/sky.json', meta, pretty=True)
    print(f'  wrote sky/gaia-dr3-counts.jpg ({len(jpg):,} bytes) and sky/sky.json')
    print(f'  sources/deg^2: min {per_deg2.min():,.0f}, median {np.median(per_deg2):,.0f}, max {per_deg2.max():,.0f}; '
          f'{100 * np.mean(per_deg2 < BLACK):.2f} % of the sky below black, '
          f'{100 * np.mean(per_deg2 > WHITE):.4f} % above white')
    import texsky_credits
    texsky_credits.write()


if __name__ == '__main__':
    main()
