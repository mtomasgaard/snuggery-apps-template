"""Builds World Oil & Gas's shading layer: data/shade.webp, data/shade/*.webp and data/shade.json.

Two gray images of the whole world (4096 x 2048, plate carree), one per Map layers key:
- data/shade/land.webp, Natural Earth I's shaded relief as luminance on land (Terrain shading), as
  data/relief.jpg did;
- data/shade.webp, the GEBCO_2026 grid as sea-floor depth and hillshade in the sea (Depth shading),
  which replaces the eleven Natural Earth 1:10m depth bands world.json carried;
and finer sea tiles at 30 arc seconds over seven oil and gas regions. Land is masked by
data/world.json's own 1:10m rings, so each half stops at the coast the map draws. Each image carries
its own half a few pixels past that coast (the other half is never shown there), so the browser's
smoothing never blends land luminance into the sea or the sea's gray into the land; the rest is flat.
A tile's outer 128 pixels (about a degree) ramp from the whole-world level's own decoded values into
the tile's, so a region has no edge on the map.

Every input is pinned: the GEBCO subsets by the SHA-256 of their elevation values, Natural Earth I by
the SHA-256 of its zip. Run from Template/ with Python 3.12, numpy and Pillow (WebP):

    python3 world-oil-gas/tools/build_shade.py            # fetch what is missing, check, build
    python3 world-oil-gas/tools/build_shade.py --fetch    # fetch and check only
    python3 world-oil-gas/tools/build_shade.py --strip-world   # also drop world.json's depth bands and relief block,
                                                               # and the bands from snapshot.json's Natural Earth source

Downloads (about 560 MB) are cached in world-oil-gas/tools/.work/shade-cache/, which no ZIP carries.
The same inputs and the same Pillow and libwebp give the same bytes; data/shade.json records both,
and tools/check.mjs pins the output.

GEBCO terms (www.gebco.net/data-products/gridded-bathymetry/terms-of-use, read 2026-10-06): public
domain; free to copy, adapt and commercially exploit; acknowledge the source; no implied endorsement;
not for navigation.
"""
import argparse, hashlib, io, json, math, os, struct, sys, time, urllib.request, zipfile

import numpy as np
from PIL import Image, ImageDraw, features

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.work', 'shade-cache')

NCSS = ('https://dap.ceda.ac.uk/thredds/ncss/bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/'
        'GEBCO_2026.nc?var=elevation&accept=netcdf')
GEBCO_DATE = '2026-04-17'           # the grid's own date_created, checked on every subset
NE1_URLS = ('https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR_W.zip',
            'https://github.com/nvkelso/natural-earth-raster/raw/master/50m_rasters/NE1_50M_SR_W/NE1_50M_SR_W.zip')
NE1_CACHED = os.path.join(APP, '..', 'scripts', 'shelf_atlas', 'cache', 'global', 'NE1_50M_SR_W.zip')
NE1_SHA256 = '9e85417223414bbed425aea5dca0f0b4c5661fc94d4f14494140a21a08dfa450'

# The whole world at every 5th 15" cell (75"), fetched as nine 20-degree strips.
STRIPS = [(s, s + 20) for s in range(-90, 90, 20)]
# The oil and gas regions that get 30" tiles: (south, north, west, east), the researcher's boxes.
REGIONS = {
    'north_sea': (50, 72, -5, 16), 'gulf_of_mexico': (18, 31, -98, -80), 'persian_gulf': (23, 31, 47, 57),
    'west_africa': (-15, 8, -6, 15), 'brazil': (-28, -12, -49, -35), 'south_china_sea': (0, 23, 103, 121),
    'caspian': (36, 48, 46, 56),
}
# SHA-256 of each subset's elevation values (int16, big-endian, as served), pinned on the first fetch.
PINS = {
    'g26s5_-90': 'c6a25a1e3d8b4606b1f73ef7b819221bd3f61f67070344867f931d278310aa9d',
    'g26s5_-70': '0e38ff30cc445fbf565655d257d2c549aea8dc63b1ccad1b59dd6116f0991f0b',
    'g26s5_-50': '10fb284ce4732371fb8befe1bf00aa1c02cb30bb3b0e103606a00935ce093735',
    'g26s5_-30': '7d0b86a2ad06bbef16f3edde10baf1975944dc606d069a9be49aca67b2384825',
    'g26s5_-10': 'b2a582ee019a099f293808b9df81451b4d20eb4fc874a2b3c10a6d5f9774f17a',
    'g26s5_10': 'e30910f76adb40b170a3b36e5ef0214a2392e107a4a28c0e3024da1c743889a9',
    'g26s5_30': '5b47b408e88e3ac488a1996594cd82dca849cdd826e58a72e0283d219ae682fd',
    'g26s5_50': 'd19f35d29f124ac2f99d8f6b556c0382d275ec6b6640125f8de9ee5ed402093b',
    'g26s5_70': 'a0b1673f3826d88f133f8a3603b97f23d8bbe7cdf3e3dd5b5e9850ed95623862',
    'r_north_sea': 'af390a1ef07292fb237d9a7c6d0189c5020c741ad661ce6ea8126e2ff71b6350',
    'r_gulf_of_mexico': '4191f8cb2d1d70cc1c2a71d2305534610c2ce6af253df7c3dedc22daf5932227',
    'r_persian_gulf': 'da011a4dafbdae7d5862c66e8e28eb29125ead024a4e94efe2433595de0a2a78',
    'r_west_africa': 'a4f5de979bf2b505fb169cb5d381844ae88858793404fcf0b192d39f961d48b7',
    'r_brazil': '40fe18c2ab423759bfb129c73ce61401a75323671572657f4749df6fa0a17462',
    'r_south_china_sea': '7f17c245cfe74c3e46802c18935050bbee606e7ae638c0f7f0585f0c5d43fd11',
    'r_caspian': '41e6988ab1bf1548e5bb9036705101344b2a8ffb6aab9aeecadfae055b56bdb7',
}

GLOBAL_W, GLOBAL_H, GLOBAL_Q = 4096, 2048, 72
REACH = 4        # pixels each half is carried past the coast (bilinear smoothing reaches one)
FEATHER = 128    # a tile's outer ramp into the whole-world level, in 30" pixels (about 12 of the whole-world level's)
TILE, TILE_Q, TILE_STEP = 2048, 50, 2    # 30" = two 15" cells, averaged
DMAX = 11000.0
R_EARTH = 6371008.8


def log(*a):
    print(*a, flush=True)


# ── netCDF classic (CDF-1/CDF-2), non-record variables, numpy only ─────────────────────────────
TYPES = {1: ('i1', 1), 2: ('S1', 1), 3: ('>i2', 2), 4: ('>i4', 4), 5: ('>f4', 4), 6: ('>f8', 8)}


def read_nc(path):
    with open(path, 'rb') as f:
        b = f.read(1 << 20)
    if b[:3] != b'CDF':
        raise SystemExit(f'{path}: not a netCDF classic file')
    ver, p = b[3], 4

    def u32():
        nonlocal p
        v = struct.unpack('>I', b[p:p + 4])[0]; p += 4; return v

    def name():
        nonlocal p
        n = u32(); s = b[p:p + n].decode(); p += (n + 3) & ~3; return s

    def attrs():
        nonlocal p
        u32(); out = {}
        for _ in range(u32()):
            k = name(); t = u32(); cnt = u32(); dt, sz = TYPES[t]
            raw = b[p:p + cnt * sz]; p += (cnt * sz + 3) & ~3
            out[k] = raw.decode(errors='replace') if t == 2 else np.frombuffer(raw, dt).tolist()
        return out
    u32()
    u32(); dims = [(name(), u32()) for _ in range(u32())]
    gatt = attrs()
    u32(); out = {'_gatt': gatt}
    for _ in range(u32()):
        k = name(); ids = [u32() for _ in range(u32())]
        attrs(); t = u32(); u32()
        off = struct.unpack('>Q', b[p:p + 8])[0] if ver == 2 else struct.unpack('>I', b[p:p + 4])[0]
        p += 8 if ver == 2 else 4
        shape = tuple(dims[i][1] for i in ids)
        out[k] = np.fromfile(path, dtype=TYPES[t][0], count=int(np.prod(shape)) if shape else 1, offset=off).reshape(shape)
    return out


# ── fetching and pinning ──────────────────────────────────────────────────────────────────────

def subset(key, s, n, w, e, stride):
    """One GEBCO_2026 subset from the cache, fetched once; checked against its pin."""
    path = os.path.join(CACHE, f'{key}.nc')
    if not os.path.exists(path):
        url = f'{NCSS}&south={s}&north={n}&west={w}&east={e}&horizStride={stride}'
        for attempt in range(4):
            try:
                t0 = time.time()
                req = urllib.request.Request(url, headers={'User-Agent': 'world-oil-gas build_shade.py'})
                with urllib.request.urlopen(req, timeout=3600) as r, open(path + '.part', 'wb') as f:
                    while True:
                        chunk = r.read(1 << 20)
                        if not chunk:
                            break
                        f.write(chunk)
                read_nc(path + '.part')['elevation']      # a cut-short file fails here
                os.replace(path + '.part', path)
                log(f'  fetched {key}: {os.path.getsize(path):,} B in {time.time() - t0:.0f} s')
                break
            except Exception as ex:   # noqa: BLE001 — retried, then reported
                log(f'  {key}: attempt {attempt + 1} failed: {ex}')
                time.sleep(10 * (attempt + 1))
        else:
            raise SystemExit(f'{key}: could not be fetched')
    d = read_nc(path)
    if not str(d['_gatt'].get('date_created', '')).startswith(GEBCO_DATE):
        raise SystemExit(f'{key}: not GEBCO_2026 (date_created {d["_gatt"].get("date_created")!r})')
    z = d['elevation'].astype('>i2')
    sha = hashlib.sha256(z.tobytes()).hexdigest()
    if key in PINS and PINS[key] != sha:
        raise SystemExit(f'{key}: elevation values changed (sha256 {sha}, pinned {PINS[key]}); review before repinning')
    if key not in PINS:
        log(f'  PIN {key!r}: {sha!r},')
    lat, lon = d['lat'].astype(np.float64), d['lon'].astype(np.float64)
    if z.ndim == 3:
        z = z[0]
    return z.astype(np.int16), lat, lon


def ne1_rgb():
    raw = None
    if os.path.exists(NE1_CACHED):
        raw = open(NE1_CACHED, 'rb').read()
    else:
        for url in NE1_URLS:
            try:
                raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'build_shade.py'}), timeout=600).read()
                break
            except Exception as ex:   # noqa: BLE001
                log(f'  {url}: {ex}')
    if raw is None:
        raise SystemExit('Natural Earth I could not be read')
    sha = hashlib.sha256(raw).hexdigest()
    if NE1_SHA256 != 'PIN' and sha != NE1_SHA256:
        raise SystemExit(f'NE1_50M_SR_W.zip changed (sha256 {sha}); review before repinning')
    if NE1_SHA256 == 'PIN':
        log(f'  PIN NE1_SHA256 = {sha!r}')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        tif = [n for n in z.namelist() if n.lower().endswith('.tif')][0]
        im = Image.open(io.BytesIO(z.read(tif)))
        im.load()
    return im.convert('RGB')


# ── the land mask: world.json's rings ─────────────────────────────────────────────────────────

def decode_polyline(s, factor):
    out, i, lon, lat, n = [], 0, 0, 0, len(s)

    def nxt():
        nonlocal i
        r = sh = 0
        while True:
            b = ord(s[i]) - 63; i += 1; r |= (b & 0x1f) << sh; sh += 5
            if b < 0x20:
                break
        return ~(r >> 1) if r & 1 else r >> 1
    while i < n:
        lon += nxt(); lat += nxt(); out.append((lon / factor, lat / factor))
    return out


_RINGS = None


def rings():
    global _RINGS
    if _RINGS is None:
        w = json.load(open(os.path.join(APP, 'data', 'world.json')))
        _RINGS = [decode_polyline(r, w['factor']) for c in w['countries'] for r in c['rings']]
    return _RINGS


def land_mask(W, H, w, e, s, n):
    """True on land, in plate carree over the box, as the app fills the countries."""
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    sx, sy = W / (e - w), H / (n - s)
    for r in rings():
        if len(r) < 3:
            continue
        xs = [p[0] for p in r]; ys = [p[1] for p in r]
        if max(xs) < w or min(xs) > e or max(ys) < s or min(ys) > n:
            continue
        d.polygon([((x - w) * sx, (n - y) * sy) for x, y in r], fill=255)
    return np.asarray(im) > 127


# ── the sea floor's shade ─────────────────────────────────────────────────────────────────────

def hillshade(dep, dx_m, dy_m, z=8.0, az=315, alt=45):
    """Lambert shade of the sea floor (elevation = -depth, exaggerated z times, the sun in the
    northwest at 45 degrees), 0..1; rows run north to south."""
    e = -dep.astype(np.float32) * z
    grow, gcol = np.gradient(e)
    nx = -gcol / dx_m
    ny = grow / dy_m
    a, h = math.radians(az), math.radians(alt)
    lx, ly, lz = math.sin(a) * math.cos(h), math.cos(a) * math.cos(h), math.sin(h)
    return np.clip((nx * lx + ny * ly + lz) / np.sqrt(nx * nx + ny * ny + 1), 0, 1)


def shade(dep, hs):
    """One byte: 235 at sea level, darker with depth (square root to 11 000 m), lighter or darker with
    the slope's light. The app multiplies it over its own sea color."""
    flat = math.sin(math.radians(45))
    v = 235 - 90 * np.sqrt(np.clip(dep, 0, DMAX) / DMAX) + 120 * (hs - flat)
    return np.clip(np.round(np.where(dep <= 0, 235, v)), 0, 255).astype(np.uint8)


def carry(v, known, n, fill, wrap):
    """v where known; outside it, each of n rings of pixels the mean of its known 8-neighbors; the rest
    fill. wrap: the columns wrap round, as the whole world's do."""
    v = np.where(known, v, 0).astype(np.float32)
    k = known.astype(np.float32)

    def shift(a, dy, dx):
        if wrap:
            a = np.roll(a, dx, axis=1)
        else:
            a = np.pad(a, ((0, 0), (1, 1)))[:, 1 - dx:a.shape[1] + 1 - dx]
        return np.pad(a, ((1, 1), (0, 0)))[1 - dy:a.shape[0] + 1 - dy]
    for _ in range(n):
        sv = np.zeros_like(v); sk = np.zeros_like(v)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    sv += shift(v * k, dy, dx); sk += shift(k, dy, dx)
        new = (k == 0) & (sk > 0)
        v[new] = sv[new] / sk[new]
        k[new] = 1
    v[k == 0] = fill
    return np.clip(np.round(v), 0, 255).astype(np.uint8)


def webp(a, q):
    b = io.BytesIO()
    Image.fromarray(np.ascontiguousarray(a), 'L').save(b, 'WEBP', quality=q, method=6)
    return b.getvalue()


def north_up(z, lat):
    o = np.argsort(-lat)
    return z[o], lat[o]


def build_global():
    log('the whole-world level')
    zs, las = [], []
    for s, n in STRIPS:
        z, la, lo = subset(f'g26s5_{s}', s, n, -180, 180, 5)
        zs.append(z); las.append(la)
    Z = np.concatenate(zs); LA = np.concatenate(las)
    keep = np.concatenate([[True], np.diff(LA) > 1e-9]) if np.all(np.diff(LA) >= 0) else None
    if keep is None:
        o = np.argsort(LA); Z, LA = Z[o], LA[o]; keep = np.concatenate([[True], np.diff(LA) > 1e-9])
    Z, LA = north_up(Z[keep], LA[keep])
    dep = np.maximum(0, -Z.astype(np.float32))
    d = np.asarray(Image.fromarray(dep, 'F').resize((GLOBAL_W, GLOBAL_H), Image.BOX), dtype=np.float32).copy()
    land = land_mask(GLOBAL_W, GLOBAL_H, -180, 180, -90, 90)
    d[land] = 0
    lat = 90 - (np.arange(GLOBAL_H) + 0.5) * 180 / GLOBAL_H
    dx = (2 * np.pi * R_EARTH / GLOBAL_W) * np.maximum(np.cos(np.radians(lat)), 0.01)[:, None]
    sea = shade(d, hillshade(d, dx, np.pi * R_EARTH / GLOBAL_H))
    rgb = ne1_rgb().resize((GLOBAL_W, GLOBAL_H), Image.LANCZOS)
    a = np.asarray(rgb, dtype=np.float32)
    # the luminosity a canvas 'saturation' composite keeps, which is how the app grayed relief.jpg
    lum = np.clip(np.round(0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]), 0, 255)
    sb = webp(carry(sea, ~land, REACH, 235, True), GLOBAL_Q)
    lb = webp(carry(lum, land, REACH, 200, True), GLOBAL_Q)
    return sb, lb, float(1 - land.mean())


def build_tiles(gsea):
    """gsea: the whole-world sea level as the app decodes it, float, north up."""
    GH, GW = gsea.shape
    tiles, seams = [], []
    for name, (s, n, w, e) in REGIONS.items():
        log(f'tiles: {name}')
        z, la, lo = subset(f'r_{name}', s, n, w, e, 1)
        z, la = north_up(z, la)
        # the box as the cells cover it: 15" cells centred on their coordinates
        dep = np.maximum(0, -z.astype(np.float32))
        H2, W2 = dep.shape[0] // TILE_STEP * TILE_STEP, dep.shape[1] // TILE_STEP * TILE_STEP
        dep = dep[:H2, :W2].reshape(H2 // 2, 2, W2 // 2, 2).mean(axis=(1, 3))
        lat = la[:H2].reshape(-1, 2).mean(1)
        lon = lo[:W2].reshape(-1, 2).mean(1)
        cell = 1 / 120
        bw, be = float(lon[0] - cell / 2), float(lon[-1] + cell / 2)
        bn, bs = float(lat[0] + cell / 2), float(lat[-1] - cell / 2)
        H, W = dep.shape
        land = land_mask(W, H, bw, be, bs, bn)
        dep[land] = 0
        dx = (np.radians(cell) * R_EARTH * np.maximum(np.cos(np.radians(lat)), 0.01))[:, None]
        g = carry(shade(dep, hillshade(dep, dx, np.radians(cell) * R_EARTH)), ~land, REACH, 235, False).astype(np.float32)
        # the outer ramp: the whole-world level, bilinear at each tile pixel's centre, eased into the tile's
        gx = (lon + 180) / 360 * GW - 0.5; gy = (90 - lat) / 180 * GH - 0.5
        x0i = np.floor(gx).astype(int); y0i = np.clip(np.floor(gy).astype(int), 0, GH - 2)
        fx = (gx - x0i)[None, :]; fy = np.clip(gy - y0i, 0, 1)[:, None]
        xa, xb = x0i % GW, (x0i + 1) % GW
        r0, r1 = gsea[y0i], gsea[y0i + 1]
        gl = (r0[:, xa] * (1 - fx) + r0[:, xb] * fx) * (1 - fy) + (r1[:, xa] * (1 - fx) + r1[:, xb] * fx) * fy
        d = np.minimum(np.minimum(np.arange(H), np.arange(H)[::-1])[:, None], np.minimum(np.arange(W), np.arange(W)[::-1])[None, :])
        t = np.clip((d + 0.5) / FEATHER, 0, 1)
        t = t * t * (3 - 2 * t)
        g = np.clip(np.round(gl * (1 - t) + g * t), 0, 255).astype(np.uint8)
        for y0 in range(0, H, TILE):
            for x0 in range(0, W, TILE):
                ga = g[y0:y0 + TILE, x0:x0 + TILE]
                if land[y0:y0 + TILE, x0:x0 + TILE].all():
                    continue                         # all land: nothing to shade
                h, wd = ga.shape
                tw = bw + x0 * cell; tn = bn - y0 * cell
                b = webp(ga, TILE_Q)
                # the seam, as the phone decodes it: where the box's own edge runs through this tile, its
                # outer pixel against the whole-world level there
                dec = np.asarray(Image.open(io.BytesIO(b)).convert('L'), dtype=np.float32)
                ed = d[y0:y0 + TILE, x0:x0 + TILE] == 0
                if ed.any():
                    seams.append(np.abs(dec[ed] - gl[y0:y0 + TILE, x0:x0 + TILE][ed]))
                tiles.append({'file': f'shade/{name}-{y0 // TILE}-{x0 // TILE}.webp', 'width': wd, 'height': h,
                              'bounds': [round(tw, 6), round(tn - h * cell, 6), round(tw + wd * cell, 6), round(tn, 6)],
                              'bytes': b})
    sd = np.concatenate(seams)
    log(f"  the seam: a tile's edge pixel differs from the whole-world level by {sd.mean():.1f} of 255 on average,"
        f' {np.percentile(sd, 99):.0f} at the 99th percentile, {sd.max():.0f} at most (WebP q{TILE_Q})')
    if sd.max() > 16:
        raise SystemExit('a tile edge does not meet the whole-world level')
    return tiles


def strip_world():
    """data/world.json without the Natural Earth depth bands and the relief block: the shading layer
    replaces both. Written in the pipeline's own separators."""
    path = os.path.join(APP, 'data', 'world.json')
    text = open(path, encoding='utf-8').read()
    w = json.loads(text)
    w.pop('bathymetry', None)
    w.pop('relief', None)
    if isinstance(w.get('source'), str):
        w['source'] = w['source'].replace(' and 1:10m bathymetry', '')
    out = json.dumps(w, separators=(',', ':'), ensure_ascii=False)
    if out != text:
        open(path, 'w', encoding='utf-8').write(out)
        log(f'  world.json: {len(text.encode()):,} -> {len(out.encode()):,} B')
    # snapshot.json names its Natural Earth source as the pipeline wrote it, bands included, and About
    # prints that name: the bands are gone, so the words go too (one string, every other byte kept)
    snap = os.path.join(APP, 'data', 'snapshot.json')
    t = open(snap, encoding='utf-8').read()
    u = t.replace('"Natural Earth 1:10m admin-0 countries, 1:10m bathymetry and Natural Earth I shaded relief"',
                  '"Natural Earth 1:10m admin-0 countries and Natural Earth I shaded relief"')
    if u != t:
        open(snap, 'w', encoding='utf-8').write(u)
        log("  snapshot.json: the Natural Earth source no longer names the 1:10m bathymetry")
    rel = os.path.join(APP, 'data', 'relief.jpg')
    if os.path.exists(rel):
        os.remove(rel)
        log('  data/relief.jpg removed (its relief is the land half of data/shade.webp)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--fetch', action='store_true', help='fetch and check the inputs only')
    ap.add_argument('--strip-world', action='store_true', help="drop world.json's depth bands and relief block, data/relief.jpg, and the bands from snapshot.json's source name")
    args = ap.parse_args()
    if not features.check('webp'):
        raise SystemExit('Pillow has no WebP')
    os.makedirs(CACHE, exist_ok=True)
    if args.fetch:
        from concurrent.futures import ThreadPoolExecutor
        jobs = [(f'g26s5_{s}', s, n, -180, 180, 5) for s, n in STRIPS]
        jobs += [(f'r_{k}', s, n, w, e, 1) for k, (s, n, w, e) in REGIONS.items()]
        with ThreadPoolExecutor(4) as ex:
            for f in [ex.submit(subset, *j) for j in jobs]:
                f.result()
        ne1_rgb()
        return
    if args.strip_world:
        strip_world()
    gb, lb, sea = build_global()
    tiles = build_tiles(np.asarray(Image.open(io.BytesIO(gb)).convert('L'), dtype=np.float32))
    data = os.path.join(APP, 'data')
    os.makedirs(os.path.join(data, 'shade'), exist_ok=True)
    for f in os.listdir(os.path.join(data, 'shade')):
        if f.endswith('.webp') and f != 'land.webp' and not any(t['file'] == f'shade/{f}' for t in tiles):
            os.remove(os.path.join(data, 'shade', f))
    open(os.path.join(data, 'shade.webp'), 'wb').write(gb)
    open(os.path.join(data, 'shade', 'land.webp'), 'wb').write(lb)
    for t in tiles:
        open(os.path.join(data, t['file']), 'wb').write(t.pop('bytes'))
    import PIL
    manifest = {
        'schema': 1,
        'global': {'file': 'shade.webp', 'land': 'shade/land.webp', 'width': GLOBAL_W, 'height': GLOBAL_H, 'bounds': [-180, -90, 180, 90]},
        'tiles': tiles,
        'projection': 'plate carree (equirectangular), WGS84',
        'land': "Natural Earth I shaded relief, 1:50m, as luminance (public domain); masked by data/world.json's countries",
        'sea': 'GEBCO_2026 Grid, resampled (every 5th 15" cell, area-averaged, for the whole world; 30" averages of the 15" cells in the tiles), shaded by depth and hillshaded (sun in the northwest, 8x vertical exaggeration) by this app\'s build',
        'attribution': 'GEBCO Bathymetric Compilation Group 2026(2026). The GEBCO_2026 Grid - a continuous terrain model for oceans and land at 15 arc-second intervals. NERC EDS British Oceanographic Data Centre NOC. doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa',
        'build': f'world-oil-gas/tools/build_shade.py; Pillow {PIL.__version__}, libwebp {features.version("webp")}',
    }
    open(os.path.join(data, 'shade.json'), 'w', encoding='utf-8').write(json.dumps(manifest, separators=(',', ':'), ensure_ascii=False))
    total = len(gb) + len(lb) + sum(os.path.getsize(os.path.join(data, t['file'])) for t in tiles)
    log(f'shade.webp {len(gb):,} B (sea {sea:.3f} of the world), shade/land.webp {len(lb):,} B; {len(tiles)} tiles; {total:,} B in all')


if __name__ == '__main__':
    main()
