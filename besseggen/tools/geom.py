"""The file contract, in one place: the boxes, the levels, and the four operations that turn a
fetched elevation grid into the tiles the app reads.

`halve`, `quantise` and `cut_tiles` are the same functions the design's reference implementation
uses (NOTES/DESIGN.md sections 2-4). They are integer-exact and contain no randomness, so a clean
rebuild reproduces every shipped byte. `halve_banded` is the streaming form of `halve` used on the
2 m master, which is 84 million samples and must never be held in RAM as float64.
"""
from __future__ import annotations
import json
import os

import numpy as np

# --------------------------------------------------------------------------------- the two boxes
# Whole multiples of 4096 m (the coarsest tile span) so every level tiles its box exactly.
CORE = dict(x0=155904, y0=6826880, x1=176384, y1=6843264)      # 20480 x 16384 m
SHELL = dict(x0=139520, y0=6810496, x1=192768, y1=6859648)     # 53248 x 49152 m
ORIGIN = dict(x=166144, y=6835072)                             # the centre of the core

CELLS = 64                       # cells along a tile edge
SAMPLES = CELLS + 1              # 65 x 65 samples; the edge row/column is stored in both neighbours
TILE_BYTES = SAMPLES * SAMPLES * 2

MASTER_RES = 2                   # the core master grid, metres
SHELL_RES = 64                   # the shell master grid, metres
BLEND_RAMP = 8                   # shell samples over which the core delta relaxes to zero (512 m)

# level -> (cell size m, box, route buffer m, anchor buffer m).  None/None = the whole box.
LEVELS = [
    (0, 64, 'shell', None, None),
    (1, 32, 'core', None, None),
    (2, 16, 'core', None, None),
    (3, 8, 'core', 4000, 4000),
    (4, 4, 'core', 800, 1000),
    (5, 2, 'core', 400, 600),
]

# The six corridor anchors, EPSG:25833 (NOTES/DESIGN.md section 2). data/viewpoints.json ships the
# same six coordinates so the saved cameras and the corridor can never drift apart.
ANCHORS = [
    (170941, 6833494),   # Gjendesheim
    (161241, 6834048),   # Memurubu
    (165545, 6834977),   # Bandet, where the walk crosses the neck
    (167885, 6835038),   # Veslfjellet summit
    (165500, 6833900),   # mid-Gjende, the boat
    (168392, 6836871),   # Bessvatnet
]

# The route waypoint an anchor is named for, where there is one. `verify_data.py` checks that the
# anchor really is within ANCHOR_NEAR_M of it, because nothing else did: SSR puts "Bandet" on the
# slope above Gjende at 1123 m, 263 m from and 268 m below the neck the walk actually crosses, and
# for one build the saved viewpoint called "From Bandet" stood the user there.
ANCHOR_WAYPOINT = {0: 'gjendesheim', 1: 'memurubu', 2: 'bandet', 3: 'veslfjellet'}
ANCHOR_NEAR_M = 100.0

GENERATED = '2026-09-22'   # fixed, not today() — a rebuild must reproduce every byte
RETRIEVED = '2026-09-22'


def grid_shape(box, res):
    """Samples in a point grid over `box` at `res` m: row 0 is the NORTH edge, column 0 the WEST."""
    return ((box['y1'] - box['y0']) // res + 1, (box['x1'] - box['x0']) // res + 1)


MASTER_SHAPE = grid_shape(CORE, MASTER_RES)     # (8193, 10241)
SHELL_SHAPE = grid_shape(SHELL, SHELL_RES)      # (769, 833)


# ------------------------------------------------------------------------------------ operations
def halve(a):
    """Halve a POINT grid: a separable [1,2,1]/4 binomial low-pass with edge clamping, then every
    second sample. A box mean would land half a cell off the coarser grid; this does not.

    Filter the whole array before cutting tiles. That is what makes a sample on a tile border come
    out bit-identical in both of the tiles that hold it."""
    def blur(x, axis):
        idx = np.clip(np.arange(-1, x.shape[axis] + 1), 0, x.shape[axis] - 1)
        p = np.take(x, idx, axis=axis)

        def sl(o):
            s = [slice(None)] * x.ndim
            s[axis] = slice(o, o + x.shape[axis])
            return tuple(s)
        return (p[sl(0)] + 2.0 * p[sl(1)] + p[sl(2)]) / 4.0
    return blur(blur(a, 0), 1)[::2, ::2]


def halve_banded(src_dm, dst_dm, band=256):
    """`halve` over a memory-mapped uint16 decimetre grid, in row bands with a one-row halo.

    Output row 2i depends only on input rows 2i-1, 2i, 2i+1 (clamped at the array edge), so a band
    plus one row above and below is enough and the result is bit-identical to halving the whole
    array: every output element is computed by the same float64 expression either way.
    `dst_dm` must already have shape ((h+1)//2, (w+1)//2)."""
    h, w = src_dm.shape
    oh, ow = dst_dm.shape
    assert (oh, ow) == ((h + 1) // 2, (w + 1) // 2), (src_dm.shape, dst_dm.shape)
    for r0 in range(0, oh, band):
        r1 = min(r0 + band, oh)
        lo = max(0, 2 * r0 - 1)
        hi = min(h, 2 * (r1 - 1) + 2)
        chunk = src_dm[lo:hi].astype(np.float64) / 10.0
        # re-create the clamped halo rows the whole-array filter would have used
        top = chunk[:1] if lo == 0 else src_dm[lo - 1:lo].astype(np.float64) / 10.0
        bot = chunk[-1:] if hi == h else src_dm[hi:hi + 1].astype(np.float64) / 10.0
        padded = np.concatenate([top, chunk, bot], axis=0)
        # blur along y over the padded rows, keeping only the rows the whole-array filter produces
        blurred_y = (padded[:-2] + 2.0 * padded[1:-1] + padded[2:]) / 4.0     # rows lo..hi-1
        take = np.arange(2 * r0, 2 * (r1 - 1) + 1, 2) - lo
        rows = blurred_y[take]
        idx = np.clip(np.arange(-1, w + 1), 0, w - 1)
        p = rows[:, idx]
        blurred = (p[:, :-2] + 2.0 * p[:, 1:-1] + p[:, 2:]) / 4.0
        dst_dm[r0:r1] = to_decimetres(blurred[:, ::2])
    return dst_dm


def to_decimetres(a):
    """Every grid in the pipeline lives as integer decimetres. Integers from here down are what
    make a clean rebuild reproduce every byte."""
    return np.rint(np.asarray(a, dtype=np.float64) * 10.0).astype(np.int32)


def quantise(tile_dm):
    """Per-tile linear uint16, lossless while (dmax - dmin) <= 65535 — the whole model spans about
    14 000 decimetres, so it always holds. The matching decode is

        z_m = (dmin + round(q * (dmax - dmin) / 65535)) * 0.1

    and rounding to the integer decimetre BEFORE dividing is what keeps a shared tile edge
    bit-identical on both sides (NOTES/DESIGN.md section 3)."""
    dmin = int(tile_dm.min())
    dmax = int(tile_dm.max())
    if dmax == dmin:
        return np.zeros(tile_dm.shape, dtype=np.uint16), dmin, dmax
    assert dmax - dmin <= 65535, f'tile relief {dmax - dmin} dm exceeds the uint16 range'
    q = np.rint((tile_dm.astype(np.float64) - dmin) * 65535.0 / (dmax - dmin))
    return q.astype(np.uint16), dmin, dmax


def cut_tiles(grid_dm, box, res, keep, out_path):
    """Cut a whole-box grid into 65x65 tiles, writing them straight to `out_path`.

    `keep(tx, ty)` decides which tiles exist. Tiles come out in row-major (ty, tx) ascending order,
    which is the order the manifest lists them in and the order their offsets run."""
    span = CELLS * res
    ny, nx = grid_shape(box, res)
    nxt = (box['x1'] - box['x0']) // span
    nyt = (box['y1'] - box['y0']) // span
    assert (box['x1'] - box['x0']) % span == 0 and (box['y1'] - box['y0']) % span == 0
    assert grid_dm.shape == (nyt * CELLS + 1, nxt * CELLS + 1), (grid_dm.shape, nyt, nxt)
    entries = []
    off = 0
    with open(out_path, 'wb') as f:
        for ty in range(nyt):                     # ty counts NORTH from box.y0
            for tx in range(nxt):
                if not keep(tx, ty):
                    continue
                # tile row 0 is the tile's north edge; the grid is indexed from its own north edge
                r0 = (nyt * CELLS) - (ty * CELLS + CELLS)
                c0 = tx * CELLS
                sub = np.asarray(grid_dm[r0:r0 + SAMPLES, c0:c0 + SAMPLES], dtype=np.int32)
                q, dmin, dmax = quantise(sub)
                entries.append(dict(tx=tx, ty=ty, o=off, dmin=dmin, dmax=dmax))
                f.write(q.astype('<u2').tobytes())
                off += TILE_BYTES
    return entries, nxt, nyt


def decode_tile(blob_u2, entry):
    """Decode one tile back to integer decimetres exactly the way the app will — float32 scale,
    round to the decimetre, then the caller divides by ten."""
    q = blob_u2[entry['o'] // 2: entry['o'] // 2 + SAMPLES * SAMPLES]
    q = q.reshape(SAMPLES, SAMPLES).astype(np.float64)
    if entry['dmax'] == entry['dmin']:
        return np.full((SAMPLES, SAMPLES), entry['dmin'], dtype=np.int64)
    scale = np.float32((entry['dmax'] - entry['dmin']) / 65535.0)
    return (entry['dmin'] + np.rint(q * np.float64(scale))).astype(np.int64)


# -------------------------------------------------------------------------------- sampling a grid
def sample_bilinear(grid_dm, box, res, xs, ys):
    """Bilinear sample of a decimetre point grid at EPSG:25833 coordinates, in metres.
    Row 0 of `grid_dm` is the box's north edge, column 0 its west edge."""
    ny, nx = grid_dm.shape
    fx = np.clip((np.asarray(xs, dtype=np.float64) - box['x0']) / res, 0.0, nx - 1.0)
    fy = np.clip((box['y1'] - np.asarray(ys, dtype=np.float64)) / res, 0.0, ny - 1.0)
    x0 = np.floor(fx).astype(np.int64)
    y0 = np.floor(fy).astype(np.int64)
    x1 = np.minimum(x0 + 1, nx - 1)
    y1 = np.minimum(y0 + 1, ny - 1)
    tx = fx - x0
    ty = fy - y0
    # index first, convert after — `grid_dm` may be a 168 MB memmap and must never be widened
    g00 = np.asarray(grid_dm[y0, x0], dtype=np.float64)
    g01 = np.asarray(grid_dm[y0, x1], dtype=np.float64)
    g10 = np.asarray(grid_dm[y1, x0], dtype=np.float64)
    g11 = np.asarray(grid_dm[y1, x1], dtype=np.float64)
    top = g00 * (1 - tx) + g01 * tx
    bot = g10 * (1 - tx) + g11 * tx
    return (top * (1 - ty) + bot * ty) / 10.0


# ------------------------------------------------------------------------------------- json, once
def write_json(path, obj, compact_keys=()):
    """Write JSON the app can read and a person can diff: indent 1, UTF-8, key order preserved, a
    trailing newline. Any list whose key is named in `compact_keys` is written one entry per line
    with no inner spacing — that is what keeps a 2783-tile manifest near 130 kB and still
    scannable. The file parses identically either way; only the whitespace differs."""
    subs = {}
    if compact_keys:
        obj = _compact(obj, set(compact_keys), subs)
    text = json.dumps(obj, ensure_ascii=False, indent=1, sort_keys=False)
    for token, replacement in subs.items():
        text = text.replace('"' + token + '"', replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
        f.write('\n')


def _compact(obj, keys, subs, parent=None):
    """Replace every list under a key in `keys` with one placeholder token per entry, so json.dumps
    still lays the list out a line at a time and the tokens can be swapped for the compact
    serialisation afterwards. A token contains nothing JSON escapes."""
    if isinstance(obj, dict):
        return {k: _compact(v, keys, subs, k) for k, v in obj.items()}
    if isinstance(obj, list):
        if parent in keys:
            out = []
            for v in obj:
                token = f'@@compact{len(subs)}@@'
                subs[token] = json.dumps(v, ensure_ascii=False, separators=(',', ':'))
                out.append(token)
            return out
        return [_compact(v, keys, subs, parent) for v in obj]
    return obj


def sha256(path):
    import hashlib
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def memmap(path, shape, dtype=np.uint16, mode='r+'):
    if mode in ('w+',) or not os.path.exists(path):
        mode = 'w+'
    return np.memmap(path, dtype=dtype, mode=mode, shape=shape)
