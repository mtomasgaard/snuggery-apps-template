#!/usr/bin/env python3
"""Step 30 — planet maps and measured disk colours.

    data/tex/<body>.jpg      equirectangular maps, JPEG quality 85
    data/tex/textures.json   per map: size, lon_left_deg, grayscale, kind, nodata fill, source, note;
                             and `colours`: disk colours computed from measured spectra

CONTRACT.md section 5. Every map is an agency or mission product (or, for the Sun and the Moon, a
disclosed processing of one) — nothing painted. The research pass (report planet-imagery and its
verifier) picked the products; the pins are in texsky_sources.py.

Geometry. Every output is equirectangular with row 0 at +90 deg latitude and EAST-POSITIVE longitude
increasing to the right; `lon_left_deg` is the longitude of the left edge of column 0. The
longitude convention of each source is read from the product's own metadata, never assumed:
  * USGS mosaics (Mercury, Venus, Mars, Pluto, Charon; optional Io, Ganymede, Triton): the ISIS
    label shipped next to each GeoTIFF (LongitudeDirection, CenterLongitude, UpperLeftCornerX/Y,
    PixelResolution, EquatorialRadius), cross-checked against the GeoTIFF's own CRS
    (central_meridian) and geotransform. Pluto: CenterLongitude = 180, MinimumLongitude 0,
    MaximumLongitude 360, so its left edge is 0 deg E (the research report's "-180..180" was wrong;
    its verifier caught it). Io and Ganymede are labelled PositiveWest; ISIS's own projection code
    (SimpleCylindrical.cpp, pinned and checked here) negates both the centre longitude and the
    longitude before forming x = R (lon - centre), so x still grows EASTWARD and no flip is needed —
    only the centre longitude changes sign (Ganymede's map therefore runs 0..360 E).
  * Earth (Blue Marble NG, 2048 x 1024 in NASA WebWorldWind): the layer that uses this very file,
    BMNGOneImageLayer.js, places it on Sector.FULL_SPHERE, which Sector.js defines as
    (-90, 90, -180, 180): left edge -180.
  * Earth at night (KDE Marble): Marble's dgml gives no bounds, so the placement is proved from the
    data — the map's own land/ocean base is registered against the Blue Marble above (shift and
    mirror search in verify_textures_sky.py) — plus city checks.
  * Jupiter (Cassini PIA07782, USGS copy): the web copy's world file only says 0.0879 deg/px from 0;
    it does not say which way longitude runs. USGS also holds the annotated original
    (jupiter_from_cassini.tif, "Jupiter Cylindrical Map - Dec 2000") whose x axis is labelled
    180, 150, 120, 90, 60, 30, 0, 330, 300, 270, 240, 210, 180 from left to right (read from the
    image; the map area is columns 201-3801, rows 400-2200 of that file). Longitudes that DECREASE
    to the right are planetographic WEST longitudes (System III is west-positive), so east longitude
    increases to the right and the map is not mirrored: no flip is needed, and the left edge is
    180 W = -180 E. This step checks that the web copy is the same picture as the annotated one
    (correlation at every circular shift, plain and mirrored: best is plain at zero shift).
  * Sun and Moon (Stellarium): Stellarium maps every sphere texture with the prime meridian at the
    centre, left edge -180; for the Moon the feature checks prove it. The Sun map is a generic
    texture (HMI data of Aug 2025 and Dec 2019 stitched together, per its commit message) with no
    Carrington registration, so its longitude carries no meaning beyond the convention.

Resampling. GeoTIFFs are area-averaged: every source pixel whose centre falls in an output pixel
contributes equally (exact integer sums, masked where the product's nodata value 0 is), so the
result does not depend on library resampling code. Pixels with no imaged source pixel get one flat
value (the mean of the imaged output pixels), recorded as `nodata_fill` with its fraction. The
8-bit sRGB JPEG/WebP sources are box-averaged (exact integer factors 2 and 8, or PIL's BOX filter
for the city lights' 2700 -> 2048). The Blue Marble file is already 2048 x 1024 and ships byte for
byte.

Colours. Karkoschka's full-disk albedo spectra (ESO, July 1995; PDS 1995LOW.TAB) for Jupiter,
Saturn, Uranus, Neptune and Titan, and the TSIS-1 solar spectrum for the Sun, integrated against the
CIE 1931 2-degree observer on a 1 nm grid 360-830 nm (colour-science 0.4.6's copy of the CIE
table). A planet's reflected light is albedo x sunlight; XYZ is normalised so a perfect white
reflector has Y = 1 (Y is then the albedo seen by the eye), adapted from the Sun's white to D65 with
the Bradford transform (an eye adapted to sunlight sees a white surface as white), converted with
the IEC 61966-2-1 sRGB matrix and transfer curve. The Sun's own colour is its spectrum through the
same matrix without adaptation, scaled so the largest channel is 1. The Sun map's colour comes from
this TSIS-1 colour (Stellarium's uniform tint is replaced; its intensity is kept).
"""
import io
import os
import sys
import zipfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
import texsky_sources as T

QUALITY = 85
report = {}


# ------------------------------------------------------------------ helpers
def jpeg(arr):
    """uint8 H x W (grayscale) or H x W x 3 array -> JPEG bytes, deterministic settings."""
    from PIL import Image
    img = Image.fromarray(np.ascontiguousarray(arr))
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    return buf.getvalue()


def rint(x):
    """Round half up to uint8 (numpy's round is half-to-even; either is deterministic)."""
    return np.clip(np.floor(np.asarray(x, np.float64) + 0.5), 0, 255).astype(np.uint8)


def srgb_to_linear(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(np.asarray(c, np.float64), 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def box(a, f):
    """Exact box average of an (H, W[, C]) uint8 array by an integer factor, as float64."""
    h, w = a.shape[0] // f, a.shape[1] // f
    s = a[:h * f, :w * f].astype(np.int64).reshape(h, f, w, f, *a.shape[2:]).sum(axis=(1, 3))
    return s / (f * f)


def geo_grid(lbl, ds):
    """Longitude (east-positive, deg) of every column centre and latitude of every row centre of a
    USGS GeoTIFF, from its ISIS label; cross-checked against the GeoTIFF's CRS and transform."""
    m = T.isis_mapping(lbl)
    R = m['EquatorialRadius']
    res = m['PixelResolution']
    assert m['ProjectionName'] in ('Equirectangular', 'SimpleCylindrical'), m['ProjectionName']
    assert m.get('CenterLatitude', 0.0) == 0.0
    assert (int(m['Samples']), int(m['Lines'])) == (ds.width, ds.height), (m['Samples'], m['Lines'], ds.shape)
    # the GeoTIFF must agree with the label
    t = ds.transform
    assert abs(t.a - res) < 1e-6 * res and abs(t.e + res) < 1e-6 * res, (t, res)
    assert abs(t.c - m['UpperLeftCornerX']) < 1e-3 * res and abs(t.f - m['UpperLeftCornerY']) < 1e-3 * res, t
    wkt = ds.crs.to_wkt()
    cm_wkt = float(wkt.split('"central_meridian",')[1].split(']')[0])
    sgn = {'PositiveEast': 1.0, 'PositiveWest': -1.0}[m['LongitudeDirection']]
    assert (cm_wkt - sgn * m['CenterLongitude']) % 360.0 == 0.0, (cm_wkt, m['CenterLongitude'], m['LongitudeDirection'])
    scale = res / R * 180 / np.pi                      # degrees per pixel
    if 'Scale' in m:
        assert abs(1 / scale - m['Scale']) < 1e-4 * m['Scale'], (1 / scale, m['Scale'])
    # ISIS (SimpleCylindrical.cpp / Equirectangular.cpp, pinned): for PositiveWest both the centre
    # longitude and the longitude are negated before x = R (lon - centre) is formed, so x always
    # grows eastward and east longitude = sign * CenterLongitude + x / R.
    sign = {'PositiveEast': 1.0, 'PositiveWest': -1.0}[m['LongitudeDirection']]
    x = m['UpperLeftCornerX'] + (np.arange(ds.width) + 0.5) * res
    y = m['UpperLeftCornerY'] - (np.arange(ds.height) + 0.5) * res
    lon = sign * m['CenterLongitude'] + np.degrees(x / R)
    lat = np.degrees(y / R)
    left = sign * m['CenterLongitude'] + np.degrees(m['UpperLeftCornerX'] / R)
    return lon, lat, m, left


def bin_average(tif_key, lbl_key, W, H, lon_left, gray, bands=None):
    """Area-average a USGS GeoTIFF into a W x H east-positive equirectangular grid starting at
    lon_left. Returns (float mean array, valid-count array, mapping info)."""
    import rasterio
    from rasterio.windows import Window
    path, lbl = T.usgs(tif_key), T.usgs(lbl_key)
    with rasterio.open(path) as ds:
        lon, lat, m, left = geo_grid(lbl, ds)
        bands = bands or list(range(1, ds.count + 1))
        nb = len(bands)
        assert (nb == 1) == gray
        nodata = ds.nodata
        assert nodata in (0, 0.0), nodata
        bx = np.floor(np.mod(lon - lon_left, 360.0) * W / 360.0).astype(np.int64)
        bx = np.minimum(bx, W - 1)
        by = np.clip(np.floor((90.0 - lat) * H / 180.0).astype(np.int64), 0, H - 1)
        order = np.argsort(bx, kind='stable')
        bxs = bx[order]
        starts = np.searchsorted(bxs, np.arange(W))
        assert np.all(np.diff(np.r_[starts, len(bxs)]) > 0), 'every output column needs a source column'
        identity = np.array_equal(order, np.arange(len(order)))
        S = np.zeros((H, W, nb), np.int64)
        N = np.zeros((H, W), np.int64)
        step = 256
        for r0 in range(0, ds.height, step):
            h = min(step, ds.height - r0)
            a = ds.read(bands, window=Window(0, r0, ds.width, h))   # (bands, h, width) uint8
            if not identity:
                a = a[:, :, order]
            valid = (a != 0).any(axis=0) if nb > 1 else (a[0] != 0)
            v32 = valid.astype(np.int32)
            cnt = np.add.reduceat(v32, starts, axis=1)               # (h, W)
            rows = by[r0:r0 + h]
            np.add.at(N, rows, cnt)
            for b in range(nb):
                sb = np.add.reduceat(np.where(valid, a[b], 0).astype(np.int32), starts, axis=1)
                np.add.at(S[:, :, b], rows, sb)
    mean = np.where(N[..., None] > 0, S / np.maximum(N, 1)[..., None], np.nan)
    return (mean[..., 0] if gray else mean), N, {'mapping': m, 'source_left_edge': left}


def fill_nodata(mean, N):
    """Flat fill where no source pixel was imaged; returns uint8 image, fill value, fraction."""
    empty = N == 0
    frac = float(empty.mean())
    if mean.ndim == 2:
        fill = int(np.floor(np.nanmean(mean) + 0.5)) if frac else None
        out = np.where(empty, fill if fill is not None else 0, mean)
    else:
        fill = [int(np.floor(v + 0.5)) for v in np.nanmean(mean.reshape(-1, mean.shape[2]), axis=0)] if frac else None
        out = np.where(empty[..., None], np.array(fill if fill else [0, 0, 0]), mean)
    return rint(out), fill, frac


# ------------------------------------------------------------------ colours from spectra
def read_karkoschka():
    tab = T.git('karkoschka_tab')
    rows = [l for l in open(tab, encoding='ascii').read().splitlines() if l.strip()]
    a = np.array([[float(v) for v in l.split()] for l in rows])
    assert a.shape == (1875, 8), a.shape
    cols = {'vac_nm': 0, 'air_nm': 1, 'ch4': 2, 'jupiter': 3, 'saturn': 4, 'uranus': 5, 'neptune': 6, 'titan': 7}
    lbl = open(T.git('karkoschka_lbl'), encoding='ascii').read()
    assert 'Full disk albedo of Jupiter at phase angle 6.8 deg' in lbl and 'Geometric albedo of Uranus' in lbl
    return a, cols


def read_tsis():
    rows = [l for l in open(T.git('tsis_csv'), encoding='ascii').read().splitlines()
            if l and not l.startswith('#') and not l.startswith('wavelength')]
    a = np.array([[float(v) for v in l.split(',')[:2]] for l in rows])
    return a[:, 0] + 0.5, a[:, 1]           # 1 nm box means labelled by their lower edge


def colours():
    import colour
    cmfs = colour.MSDS_CMFS['CIE 1931 2 Degree Standard Observer']
    wl = np.asarray(cmfs.wavelengths, np.float64)
    assert wl[0] == 360 and wl[-1] == 830 and np.all(np.diff(wl) == 1)
    cmf = np.asarray(cmfs.values, np.float64)
    M = np.asarray(colour.RGB_COLOURSPACES['sRGB'].matrix_XYZ_to_RGB, np.float64)
    d65 = colour.xy_to_XYZ(colour.CCS_ILLUMINANTS['CIE 1931 2 Degree Standard Observer']['D65'])
    tw, ts = read_tsis()
    S = np.interp(wl, tw, ts)
    k, cols = read_karkoschka()
    air = k[:, cols['air_nm']]
    white_sun = (S[:, None] * cmf).sum(0) / (S * cmf[:, 1]).sum()
    white_e = cmf.sum(0) / cmf[:, 1].sum()
    brad = lambda src: np.asarray(colour.adaptation.matrix_chromatic_adaptation_VonKries(src, d65, transform='Bradford'))

    def to_srgb(xyz, src_white):
        lin = M @ (brad(src_white) @ xyz)
        clipped = bool((lin < 0).any() or (lin > 1).any())
        return lin, rint(255 * linear_to_srgb(lin)).tolist(), clipped

    out = {}
    notes = {
        'jupiter': ('full-disk albedo at 6.8 deg phase', 'Karkoschka 1998: measured disk spectrum, ESO 1995'),
        'saturn': ('full-disk albedo at 5.7 deg phase, rings edge-on (zero tilt)',
                   'Karkoschka 1998: measured disk spectrum, ESO 1995 (globe; rings edge-on)'),
        'uranus': ('geometric albedo', 'Karkoschka 1998: measured disk spectrum (ESO, July 1995) — no real map exists'),
        'neptune': ('geometric albedo', 'Karkoschka 1998: measured disk spectrum (ESO, July 1995) — no real map exists'),
        'titan': ('full-disk albedo at 5.7 deg phase', 'Karkoschka 1998: measured disk spectrum of the haze, ESO 1995'),
    }
    for body, (what, note) in notes.items():
        A = np.interp(wl, air, k[:, cols[body]])
        xyz = (A * S)[:, None] * cmf
        xyz = xyz.sum(0) / (S * cmf[:, 1]).sum()
        lin, srgb, clipped = to_srgb(xyz, white_sun)
        xyz_e = (A[:, None] * cmf).sum(0) / cmf[:, 1].sum()
        _, srgb_e, _ = to_srgb(xyz_e, white_e)
        out[body] = {'srgb': srgb, 'linear': [round(float(v), 5) for v in np.clip(lin, 0, 1)],
                     'albedo_Y': round(float(xyz[1]), 4),
                     'xy': [round(float(xyz[0] / xyz.sum()), 4), round(float(xyz[1] / xyz.sum()), 4)],
                     'srgb_illuminant_E': srgb_e, 'out_of_gamut': clipped,
                     'spectrum': f'Karkoschka (1998) 1995LOW.TAB column "{body.upper()} ALBEDO": {what}',
                     'source': 'Karkoschka 1998, Icarus 133, ESO spectrophotometry 1995-07-06..10 (PDS ESO-J/S/N/U-SPECTROPHOTOMETER-4-V2.0)',
                     'note': note}
    # The Sun: its spectrum through the sRGB matrix, no adaptation, largest channel = 1.
    xyz_sun = (S[:, None] * cmf).sum(0)
    lin = M @ (xyz_sun / xyz_sun[1])
    lin_n = lin / lin.max()
    xy = xyz_sun[:2] / xyz_sun.sum()
    cct = float(colour.temperature.xy_to_CCT(xy, method='McCamy 1992'))
    out['sun'] = {'srgb': rint(255 * linear_to_srgb(lin_n)).tolist(),
                  'linear': [round(float(v), 5) for v in lin_n], 'xy': [round(float(v), 4) for v in xy],
                  'cct_k_mccamy': round(cct), 'out_of_gamut': bool((lin < 0).any()),
                  'spectrum': 'TSIS-1 Hybrid Solar Reference Spectrum v2, 1 nm box means (solar irradiance at 1 AU)',
                  'source': 'TSIS-1 HSRS v2, Coddington et al. 2023 (LASP), as resampled in OrbitalCommons/starfield',
                  'note': 'TSIS-1 solar spectrum (sunlight above the atmosphere)'}
    method = ('CIE 1931 2-degree observer (colour-science 0.4.6 table), 1 nm grid 360-830 nm, linear interpolation '
              'of each spectrum (Karkoschka air wavelengths; TSIS 1 nm bins at their centres). Planets and Titan: '
              'XYZ of albedo x TSIS-1 sunlight, normalised so a perfect white reflector has Y = 1, Bradford-adapted '
              'from the Sun\'s white to D65, IEC 61966-2-1 sRGB matrix and transfer curve, x 255, rounded; '
              'srgb_illuminant_E is the same with an equal-energy illuminant, as a cross-check. Sun: XYZ of the '
              'TSIS-1 spectrum through the same matrix without adaptation, largest channel scaled to 1. '
              'Disk-averaged colours of July 1995 (Uranus changes with season); no limb darkening or banding.')
    return out, method


# ------------------------------------------------------------------ the maps
def sun_map(sun_lin):
    from PIL import Image
    im = Image.open(T.git('sun_webp'))
    assert im.size == (8192, 4096), im.size
    rgb = np.asarray(im.convert('RGB'))
    H = 512
    Y = np.empty((H, 1024))
    f = 8
    for r in range(0, 4096, 512):                      # strips, to bound memory
        lin = srgb_to_linear(rgb[r:r + 512] / 255.0)
        y = lin @ np.array([0.2126, 0.7152, 0.0722])
        Y[r // f:(r + 512) // f] = y.reshape(512 // f, f, 1024, f).mean(axis=(1, 3))
    out = rint(255 * linear_to_srgb(Y[..., None] * np.asarray(sun_lin)[None, None, :]))
    g = rgb[::64, ::64].astype(np.float64)
    report['sun'] = {'source_mean_rgb': [round(float(v), 1) for v in g.reshape(-1, 3).mean(0)],
                     'tint_source_g_over_r': round(float(g[..., 1].sum() / g[..., 0].sum()), 4)}
    return out


def moon_map():
    from PIL import Image
    im = Image.open(T.git('moon_jpg'))
    assert im.size == (4096, 2048)
    return rint(box(np.asarray(im.convert('RGB')), 2))


def jupiter_map():
    from PIL import Image
    web = Image.open(T.usgs('jupiter_jpg')).convert('RGB')
    assert web.size == (4096, 2048)
    jgw = [float(v) for v in open(T.usgs('jupiter_jgw')).read().split()]
    assert abs(jgw[0] - 360 / 4096) < 1e-9 and abs(jgw[3] + 180 / 2048) < 1e-9, jgw
    # The annotated original states the longitude labels; prove the web copy is that same picture.
    ann = Image.open(T.usgs('jupiter_annotated')).convert('L')
    assert ann.size == (4000, 2400)
    a = np.asarray(ann.crop((201, 400, 3801, 2200)).resize((720, 360), Image.BOX), np.float64)[60:300]
    b = np.asarray(web.convert('L').resize((720, 360), Image.BOX), np.float64)
    a = a - a.mean()
    best = {}
    for name, bb in (('plain', b), ('mirrored', b[:, ::-1])):
        cs = []
        for s in range(720):
            y = np.roll(bb, s, axis=1)[60:300]
            y = y - y.mean()
            cs.append(float((a * y).sum() / np.sqrt((a * a).sum() * (y * y).sum())))
        i = int(np.argmax(cs))
        best[name] = (i if i <= 360 else i - 720, cs[i])
    assert best['plain'][0] == 0 and best['plain'][1] > 0.99 and best['mirrored'][1] < best['plain'][1] - 0.1, best
    report['jupiter'] = {'annotated_vs_web': {k: {'shift_px_of_720': v[0], 'correlation': round(v[1], 4)}
                                              for k, v in best.items()}}
    # The source map is itself filled flat around the south pole (Cassini did not see it; the annotated
    # original shows the same uniform band): find the source rows, counted up from the bottom edge, that are
    # one colour across all longitudes (JPEG noise < 0.6 DN), and record them as not imaged.
    rgb = np.asarray(web)
    flat = rgb.astype(np.float64).std(axis=1).max(axis=1) < 0.6
    n_src = int(np.argmin(flat[::-1])) if not flat.all() else len(flat)
    out = rint(box(rgb, 2))
    n_out = n_src // 2
    fill = [int(v) for v in np.floor(out[out.shape[0] - n_out:].reshape(-1, 3).mean(0) + 0.5)] if n_out else None
    assert n_out == 0 or np.abs(out[out.shape[0] - n_out:].astype(np.int64) - np.array(fill)).max() <= 2
    south_edge = -90.0 + 180.0 * n_src / rgb.shape[0]
    report['jupiter'].update({'flat_south_rows_source': n_src, 'flat_south_edge_deg': round(south_edge, 2), 'fill': fill})
    return out, fill, n_out / out.shape[0], south_edge


def night_map():
    from PIL import Image
    im = Image.open(T.git('night_jpg')).convert('RGB')
    assert im.size == (2700, 1350)
    return np.asarray(im.resize((2048, 1024), Image.BOX))


def earth_bytes():
    from PIL import Image
    p = T.git('earth_jpg')
    im = Image.open(p)
    assert im.size == (2048, 1024) and im.mode == 'RGB'
    layer = open(T.git('earth_layer'), encoding='utf-8').read()
    sector = open(T.git('wwd_sector'), encoding='utf-8').read()
    assert 'new SurfaceImage(Sector.FULL_SPHERE' in layer and 'BMNG_world.topo.bathy.200405.3.2048x1024.jpg' in layer
    assert 'Sector.FULL_SPHERE = new Sector(-90, 90, -180, 180);' in sector
    return open(p, 'rb').read()


def usgs_map(body, W, H, lon_left, gray, bands=None):
    mean, N, info = bin_average(f'{body}_tif', f'{body}_lbl', W, H, lon_left, gray, bands)
    img, fill, frac = fill_nodata(mean, N)
    m = info['mapping']
    report[body] = {'source_pixels_per_output_pixel': round(float(N[N > 0].mean()), 1),
                    'nodata_fraction': round(frac, 5), 'fill': fill,
                    'source_left_edge_deg': round(float(info['source_left_edge']), 4),
                    'label': {k: m.get(k) for k in ('LongitudeDirection', 'LongitudeDomain', 'CenterLongitude',
                                                     'MinimumLongitude', 'MaximumLongitude', 'LatitudeType')}}
    return img, fill, frac, m


# ------------------------------------------------------------------ main
def main():
    for tif, side in T.MD5:
        print(f'  md5 {tif}: {T.md5_check(tif, side)} (matches the USGS sidecar)')
    for key in ('isis_simplecyl', 'isis_equirect'):
        src = open(T.git(key), encoding='utf-8').read()
        assert 'if (m_longitudeDirection == PositiveWest) m_centerLongitude *= -1.0;' in src
        assert 'if (m_longitudeDirection == PositiveWest) lonRadians *= -1.0;' in src
        assert 'double deltaLon = (lonRadians - m_centerLongitude);' in src
    lic = {k: T.fgdc(k) for k in ('mercury_fgdc', 'venus_fgdc', 'mars_fgdc', 'pluto_fgdc', 'charon_fgdc',
                                  'io_fgdc', 'ganymede_fgdc', 'triton_fgdc')}
    for k in ('io_fgdc', 'ganymede_fgdc', 'triton_fgdc'):       # optional moons: public domain only
        assert [v.lower() for v in lic[k]['accconst']] == ['public domain'], (k, lic[k]['accconst'])
    assert lic['mercury_fgdc']['accconst'] == ['Public domain'] and lic['mercury_fgdc']['edition'] == ['May 2013']
    assert lic['venus_fgdc']['accconst'] == ['public domain'] and lic['mars_fgdc']['accconst'] == ['public domain']
    assert lic['pluto_fgdc']['useconst'] == ['Please cite authors']

    cols, method = colours()
    bodies = {}

    def put(key, data, w, h, lon_left, gray, kind, source_id, note, evidence, lat_type, fill=None, frac=0.0,
            fill_note=None, raw=False):
        name = f'tex/{key}.jpg'
        b = data if raw else jpeg(data)
        common.write_bin(name, b)
        bodies[key] = {'file': f'{key}.jpg', 'width': w, 'height': h, 'lon_left_deg': lon_left, 'grayscale': gray,
                       'kind': kind, 'source_id': source_id, 'note': note, 'lon_evidence': evidence,
                       'lat_type': lat_type, 'nodata_fraction': round(frac, 5),
                       'nodata_fill': fill_note if frac > 0 else 'none: every pixel imaged'}
        if frac > 0:
            bodies[key]['fill_value'] = fill
        print(f'  {name}: {w}x{h} {"gray" if gray else "RGB"}, {len(b):,} bytes'
              + (f', {100 * frac:.2f} % filled' if frac else ''))

    print('Sun')
    put('sun', sun_map(cols['sun']['linear']), 1024, 512, -180.0, False, 'visible', 'stellarium-sun-hmi',
        'SDO HMI continuum (Stellarium map by R. Kabatsayev), coloured by the TSIS-1 spectrum',
        'Stellarium sphere-texture convention (prime meridian at the centre); a generic texture of HMI data '
        'from Aug 2025 and Dec 2019 with no Carrington registration', 'not stated (sphere)')

    print('Mercury')
    img, fill, frac, m = usgs_map('mercury', 1024, 512, -180.0, True)
    assert m['LongitudeDirection'] == 'PositiveEast' and m['CenterLongitude'] == 0.0
    put('mercury', img, 1024, 512, -180.0, True, 'visible', 'usgs-mercury-messenger-2013',
        'MESSENGER MDIS 750 nm global mosaic, May 2013 (NASA/JHUAPL/ASU, USGS)',
        'ISIS label: PositiveEast, CenterLongitude 0, -180..180; GeoTIFF central_meridian 0',
        m['LatitudeType'], fill, frac, f'flat DN {fill} (mean of the imaged pixels) where the mosaic has no data')

    print('Venus')
    img, fill, frac, m = usgs_map('venus', 1024, 512, -180.0, True)
    assert m['LongitudeDirection'] == 'PositiveEast' and m['CenterLongitude'] == 0.0
    put('venus', img, 1024, 512, -180.0, True, 'radar', 'usgs-venus-magellan-c3mdir',
        'Magellan radar (C3-MIDR mosaic, NASA/JPL, USGS) — radar brightness under the clouds, not what an eye sees',
        'ISIS label: PositiveEast, CenterLongitude 0, -180..180; GeoTIFF central_meridian 0',
        m['LatitudeType'], fill, frac,
        f'flat DN {fill} (mean of the imaged pixels) in Magellan\'s swath gaps and polar holes')

    print('Earth')
    put('earth', earth_bytes(), 2048, 1024, -180.0, False, 'visible', 'nasa-bmng-200405',
        'NASA Blue Marble Next Generation, May 2004 (topography and bathymetry shading)',
        'WebWorldWind BMNGOneImageLayer.js drapes this file on Sector.FULL_SPHERE = (-90, 90, -180, 180)',
        'geodetic (WGS84 geographic)', raw=True)

    print('Earth at night')
    put('earth_night', night_map(), 2048, 1024, -180.0, False, 'visible', 'nasa-noaa-citylights-dmsp',
        'City lights from DMSP-OLS (NASA GSFC / NOAA NGDC), over a dark land and ocean base',
        'no bounds in the Marble dgml; registered against the Blue Marble (land/ocean base, best shift 0, not '
        'mirrored) and city positions in verify_textures_sky.py', 'geodetic (WGS84 geographic)')

    print('Moon')
    put('moon', moon_map(), 2048, 1024, -180.0, False, 'albedo', 'stellarium-moon-lroc-albedo',
        'LRO LROC WAC Hapke-normalised albedo (Stellarium map by R. Kabatsayev)',
        'Stellarium sphere-texture convention (prime meridian at the centre); proved by maria and craters '
        '(Tycho, Mare Crisium, Mare Humorum) in verify_textures_sky.py', 'not stated (sphere)')

    print('Mars')
    img, fill, frac, m = usgs_map('mars', 2048, 1024, -180.0, False)
    assert m['LongitudeDirection'] == 'PositiveEast' and m['CenterLongitude'] == 0.0
    put('mars', img, 2048, 1024, -180.0, False, 'albedo', 'usgs-mars-viking-color-925m',
        'Viking Orbiter colour mosaic, red and violet filters (NASA, PDS, USGS)',
        'ISIS label: PositiveEast, planetocentric, CenterLongitude 0, -180..180; GeoTIFF central_meridian 0',
        m['LatitudeType'], fill, frac, f'flat RGB {fill} (mean) where the mosaic has no data')

    print('Jupiter')
    img, fill, frac, south_edge = jupiter_map()
    put('jupiter', img, 2048, 1024, -180.0, False, 'visible', 'cassini-pia07782',
        'Cassini ISS colour map PIA07782, Dec 2000 (NASA/JPL/Space Science Institute)',
        'annotated original (USGS jupiter_from_cassini.tif) labels 180 ... 0 ... 180 decreasing to the right, i.e. '
        'west longitudes: east increases to the right, left edge 180 W; the web copy is the same picture '
        '(correlation 0.999 at zero shift, not mirrored); no flip applied. The web copy\'s world file '
        '(jupiter_rgb_cyl_www.jgw) instead puts the left edge at longitude 0, 180 deg from the annotation; the '
        'annotation, made with the map, is followed. Longitude system not stated in the file (the Great Red Spot '
        'drifts, so its position is a Dec 2000 snapshot)', 'not stated', fill, frac,
        f'flat RGB {fill} south of {-south_edge:.1f} S, already in the source map (the south polar region was not '
        'observed; the map maker\'s fill, not the mean of the imaged pixels): not imaged, not terrain')

    print('Pluto')
    img, fill, frac, m = usgs_map('pluto', 1024, 512, 0.0, True)
    assert m['LongitudeDirection'] == 'PositiveEast' and m['CenterLongitude'] == 180.0 and m['MinimumLongitude'] == 0.0
    put('pluto', img, 1024, 512, 0.0, True, 'visible', 'usgs-pluto-new-horizons-2017',
        'New Horizons LORRI/MVIC global mosaic, 2017 (NASA/JHUAPL/SwRI/LPI, USGS); the south was in darkness',
        'ISIS label: PositiveEast, CenterLongitude 180, 0..360 (left edge 0 E); GeoTIFF central_meridian 180',
        m['LatitudeType'], fill, frac,
        f'flat DN {fill} (mean of the imaged pixels) where New Horizons saw nothing (mostly south of ~30 S, '
        'in polar night during the 2015 flyby): not imaged, not terrain')

    print('Charon')
    img, fill, frac, m = usgs_map('charon', 1024, 512, -180.0, True)
    assert m['LongitudeDirection'] == 'PositiveEast' and m['CenterLongitude'] == 0.0
    put('charon', img, 1024, 512, -180.0, True, 'visible', 'usgs-charon-new-horizons-2017',
        'New Horizons LORRI/MVIC global mosaic, 2017 (NASA/JHUAPL/SwRI/LPI, USGS); the south was in darkness',
        'ISIS label: PositiveEast, CenterLongitude 0, -180..180; GeoTIFF central_meridian 0',
        m['LatitudeType'], fill, frac,
        f'flat DN {fill} (mean of the imaged pixels) where New Horizons saw nothing (mostly south of ~30 S): '
        'not imaged, not terrain')

    # ---- optional: grayscale maps of three major moons whose USGS FGDC record says "public domain"
    # (Europa: accconst None; Callisto: no FGDC record; Titan: accconst None — left out).
    print('Io')
    img, fill, frac, m = usgs_map('io', 512, 256, -180.0, True)
    assert m['LongitudeDirection'] == 'PositiveWest' and m['CenterLongitude'] == 0.0
    put('io', img, 512, 256, -180.0, True, 'visible', 'usgs-io-galileo-voyager-1km',
        'Galileo SSI and Voyager 1 global mosaic (NASA/JPL, USGS)',
        'ISIS label: PositiveWest, CenterLongitude 0 W; ISIS x grows eastward, so east longitude runs '
        '-180..180 left to right; checked against Loki Patera in verify_textures_sky.py',
        m['LatitudeType'], fill, frac, f'flat DN {fill} (mean) where the mosaic has no data')
    print('Ganymede')
    img, fill, frac, m = usgs_map('ganymede', 512, 256, 0.0, True)
    assert m['LongitudeDirection'] == 'PositiveWest' and m['CenterLongitude'] == 180.0
    put('ganymede', img, 512, 256, 0.0, True, 'visible', 'usgs-ganymede-voyager-galileo-1km',
        'Voyager and Galileo SSI global mosaic (NASA/JPL, USGS)',
        'ISIS label: PositiveWest, CenterLongitude 180 W (= 180 E); ISIS x grows eastward, so the map runs '
        '0..360 E left to right (360 W .. 0 W); checked against Galileo Regio in verify_textures_sky.py',
        m['LatitudeType'], fill, frac, f'flat DN {fill} (mean of the imaged pixels) at the unmapped poles')
    print('Triton')
    img, fill, frac, m = usgs_map('triton', 512, 256, -180.0, True, bands=[1])
    assert m['LongitudeDirection'] == 'PositiveEast' and m['CenterLongitude'] == 0.0
    put('triton', img, 512, 256, -180.0, True, 'visible', 'usgs-triton-voyager2-600m',
        'Voyager 2 mosaic, orange filter only (NASA/JPL, P. Schenk; USGS); the north was in darkness in 1989',
        'ISIS label: PositiveEast, CenterLongitude 0, -180..180; GeoTIFF central_meridian 0',
        m['LatitudeType'], fill, frac,
        f'flat DN {fill} (mean of the imaged pixels) where Voyager 2 saw nothing (the north, in winter '
        'darkness in 1989): not imaged, not terrain')

    total = sum(os.path.getsize(os.path.join(common.DATA, 'tex', b['file'])) for b in bodies.values())
    out = {
        'convention': 'Equirectangular; row 0 = +90 deg latitude; longitude east-positive and increasing to the '
                      'right; column x covers longitudes lon_left_deg + 360 x / width .. + 360 (x + 1) / width.',
        'bodies': bodies, 'colours': cols, 'colour_method': method,
        'resampling': 'USGS GeoTIFFs: exact area average of the source pixels whose centres fall in each output '
                      'pixel, nodata (0) excluded. Stellarium and Cassini maps: exact 2x2 (Moon, Jupiter) or 8x8 '
                      '(Sun, in linear light) box average. City lights: PIL BOX filter 2700 -> 2048. Blue Marble: '
                      'shipped byte for byte. JPEG quality 85 (Pillow 11.3.0).',
        'total_bytes': total,
    }
    common.write_json('tex/textures.json', out, pretty=True)
    print(f'  textures total {total:,} bytes')
    for k, v in cols.items():
        print(f'  colour {k}: sRGB {v["srgb"]}' + (f' (illuminant E {v["srgb_illuminant_E"]}, Y {v["albedo_Y"]})'
                                                  if 'albedo_Y' in v else f' xy {v["xy"]} CCT {v["cct_k_mccamy"]} K'))
    for k, v in report.items():
        print(f'  {k}: {v}')
    # the licence quotes 30 relies on (credits fragment) — read here so a changed file stops the build
    zf = zipfile.ZipFile(T.usgs('usgs_mapfiles'))
    jmap = zf.read('maps/jupiter/jupiter_simp_cyl.map').decode('latin-1')
    assert 'PIA07782' in jmap and 'Image credit by NASA/JPL/Space Science Institute.' in jmap
    import texsky_credits
    texsky_credits.write()


if __name__ == '__main__':
    main()
