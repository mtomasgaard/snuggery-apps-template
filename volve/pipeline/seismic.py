"""Cut Volve's seismic for the app: a crop of the ST0202 PS PSDM full-offset stack in depth.

Industry convention throughout (plan 0012, D11):
  - The crop is the reservoir's top minus 500 m to its base plus 500 m, from the model's own depths,
    and the model's footprint plus 250 m laterally, both taken from the prepared grid (ZCORN with
    ADDZCORN applied) over Equinor's 183,545 active cells.
  - Only the traces the crop needs are read, by HTTP range requests on OSDU's public copy, plus a
    30-trace pad on each side so the filter below sees real data at the crop's edges. The object is
    pinned by size and ETag, and the bytes read by their sha256 (pipeline/sources.json).
  - The 12.5 m bins become 25 m traces through a 2-D anti-alias low-pass first (a separable
    Kaiser-windowed sinc on the inline and crossline axes, the right pass band for a 2 x 2
    rectangular decimation), then every second filtered trace is kept. Never a bare drop.
  - Depth keeps its original 5 m samples at their original depths: no resampling, no shift, no tie.
  - 8 bits: code = 128 + round(127 * a / clip), clipped to 1..255, so zero is 128 and the scale is
    symmetric; clip is the 99.9th percentile of |a| over the output, written to seismic.json.
  - The geometry is fitted exactly to every trace header read, and written with the corners.
The arithmetic is elementwise IEEE operations in a fixed order and the filter taps are constants,
so a re-run gives the same bytes on any machine.

    python3 seismic.py --deck work/deck --inputs work/inputs --data-dir ../data
"""
import argparse
import hashlib
import json
import re
import struct
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

import common

# The survey as its textual header states it (lines C11-C20), checked against the file below.
IL_FIRST, IL_LAST, XL_FIRST, XL_LAST = 9985, 10369, 1932, 2536
NXL_FILE = XL_LAST - XL_FIRST + 1
NS, DZ = 901, 5.0
TRACE = 240 + 4 * NS
BIN = 12.5
MARGIN_M, VMARGIN_M = 250.0, 500.0
STEP = 2               # 12.5 m bins -> 25 m traces
PAD = 30               # filter half-length in traces
NX, NY, NZ = 108, 100, 63
GRID = "GRID_postF1B_Nov2013_locupd_12112013.grdecl"
CLIP_PERCENTILE = 99.9
FIT_TOLERANCE_M = 0.25

# Anti-alias filter: 61-tap Kaiser-windowed sinc, cutoff 0.225 cycles per 12.5 m bin, beta 4.5335
# (Kaiser's formula for 50 dB). Pass band to 0.20 cycles/bin (wavelengths of 62.5 m and more) within
# 0.05 dB, at least 50 dB down from 0.25 cycles/bin (the 25 m grid's Nyquist, a 50 m wavelength).
# Constants, so that every machine filters with the same numbers; tools/test_seismic.py rebuilds
# them from the design and checks the response.
TAPS = np.array([
    -0.000589496102051095, -0.00013034013543948122, 0.0010694157694044611, 0.0006666882684277899,
    -0.0015136536102743595, -0.001653157303068276, 0.0016904097520105796, 0.0031115068917476696,
    -0.001296203337208818, -0.004930854263725873, 6.497955387745707e-18, 0.006831017439043731,
    0.0024932317490975963, -0.00834761241688769, -0.006370601884632172, 0.0088408624256488,
    0.01164612978164299, -0.007517591578668145, -0.018118237231489105, 0.003433535714404165,
    0.02536278217301076, 0.004607255640831044, -0.03276800732650798, -0.01849887839347225,
    0.03960910117737038, 0.04258572021489049, -0.04515117452942854, -0.09269540724711711,
    0.04876248380420179, 0.3137969999134883, 0.4501481492895007, 0.3137969999134883,
    0.04876248380420179, -0.09269540724711711, -0.04515117452942854, 0.04258572021489049,
    0.03960910117737038, -0.01849887839347225, -0.03276800732650798, 0.004607255640831044,
    0.02536278217301076, 0.003433535714404165, -0.018118237231489105, -0.007517591578668145,
    0.01164612978164299, 0.0088408624256488, -0.006370601884632172, -0.00834761241688769,
    0.0024932317490975963, 0.006831017439043731, 6.497955387745707e-18, -0.004930854263725873,
    -0.001296203337208818, 0.0031115068917476696, 0.0016904097520105796, -0.001653157303068276,
    -0.0015136536102743595, 0.0006666882684277899, 0.0010694157694044611, -0.00013034013543948122,
    -0.000589496102051095
])


def ibm_to_float64(raw):
    """IBM System/360 single floats (big-endian) to float64, exactly (integer arithmetic and ldexp)."""
    u = np.frombuffer(raw, dtype=">u4").astype(np.int64)
    sign = np.where(u >> 31, -1.0, 1.0)
    expo = ((u >> 24) & 0x7F) - 64
    frac = (u & 0x00FFFFFF).astype(np.float64)
    return sign * np.ldexp(frac, (4 * expo - 24).astype(np.int32))


def read_textual_header(url):
    raw, _ = common.http_get(url, headers={"Range": "bytes=0-3599"})
    if len(raw) != 3600:
        raise SystemExit("could not read the SEG-Y file header")
    text = raw[:3200].decode("cp500")
    lines = [text[i:i + 80].rstrip() for i in range(0, 3200, 80)]
    bh = raw[3200:3600]
    h = lambda off: struct.unpack(">h", bh[off - 3201:off - 3199])[0]
    binh = dict(sample_interval_us=h(3217), samples=h(3221), format=h(3225), measurement=h(3255),
                polarity=h(3257), revision=struct.unpack(">H", bh[300:302])[0])
    if (binh["sample_interval_us"], binh["samples"], binh["format"]) != (5000, NS, 1):
        raise SystemExit(f"unexpected binary header {binh}")
    corners = []
    for l in lines:
        m = re.search(r"CORNER\d:3D INLINE\s+(\d+), 3D XLINE\s+(\d+), UTM-X\s+([\d.]+), UTM-Y\s+([\d.]+)", l)
        if m:
            corners.append(dict(il=int(m.group(1)), xl=int(m.group(2)), x=float(m.group(3)), y=float(m.group(4))))
    if len(corners) != 4:
        raise SystemExit("the textual header does not give the four corners")
    pol = [l[4:].strip() for l in lines if "POSITIVE SAMPLE" in l or "POLARITY" in l.upper()]
    return dict(raw=raw, lines=lines, binary=binh, corners=corners, polarity=pol,
                sha256=hashlib.sha256(raw).hexdigest())


def header_transform(corners):
    """(il, xl) -> (x, y) from three of the textual header's corners (used only to choose the crop)."""
    c = {(k["il"], k["xl"]): np.array([k["x"], k["y"]]) for k in corners}
    o = c[(IL_FIRST, XL_FIRST)]
    vil = (c[(IL_LAST, XL_FIRST)] - o) / (IL_LAST - IL_FIRST)
    vxl = (c[(IL_FIRST, XL_LAST)] - o) / (XL_LAST - XL_FIRST)
    return o, vil, vxl


def to_ilxl(xy, o, vil, vxl):
    m = np.stack([vil, vxl], 1)
    s = np.linalg.solve(m, (np.asarray(xy) - o).T).T
    return s[:, 0] + IL_FIRST, s[:, 1] + XL_FIRST


def grdecl_block(text, kw):
    m = re.search(r"^" + kw + r"\s*$", text, flags=re.M)
    end = text.index("/", m.end())
    return np.array(text[m.end():end].split(), dtype=np.float64)


def model_extent(deck_dir, inputs):
    """UTM corners and depths of the model's active cells (Equinor's active set, PORV > 0 in its INIT)."""
    text = (Path(deck_dir) / GRID).read_bytes().decode("latin-1")
    text = re.sub(r"--[^\n]*", "", text)
    m = re.search(r"^MAPAXES\s*$", text, flags=re.M)
    ax = np.array(text[m.end():text.index("/", m.end())].split(), dtype=np.float64).reshape(3, 2)
    coord = grdecl_block(text, "COORD").reshape(NY + 1, NX + 1, 2, 3)
    zcorn = grdecl_block(text, "ZCORN").reshape(NZ, 2, NY, 2, NX, 2)
    import opm.io.ecl as ecl  # Equinor's INIT is an Eclipse binary file
    porv = np.array(ecl.EclFile(str(Path(inputs) / "equinor" / "VOLVE_2016.INIT"))["PORV"])
    act = (porv > 0).reshape(NZ, NY, NX)
    k, j, i = np.nonzero(act)
    xs, ys, zs = [], [], []
    for kt in (0, 1):
        for jt in (0, 1):
            for it in (0, 1):
                z = zcorn[k, kt, j, jt, i, it]
                p = coord[j + jt, i + it]
                dz = p[:, 1, 2] - p[:, 0, 2]
                t = np.where(dz == 0, 0.0, (z - p[:, 0, 2]) / np.where(dz == 0, 1.0, dz))
                xs.append(p[:, 0, 0] + t * (p[:, 1, 0] - p[:, 0, 0]))
                ys.append(p[:, 0, 1] + t * (p[:, 1, 1] - p[:, 0, 1]))
                zs.append(z)
    x, y, z = np.concatenate(xs), np.concatenate(ys), np.concatenate(zs)
    # MAPAXES: a point on the Y axis, the origin, a point on the X axis (Eclipse's order)
    origin = ax[1]
    ex = (ax[2] - origin) / np.hypot(*(ax[2] - origin))
    ey = (ax[0] - origin) / np.hypot(*(ax[0] - origin))
    utm = origin + x[:, None] * ex + y[:, None] * ey
    return dict(utm=utm, top=float(z.min()), base=float(z.max()), nactive=int(act.sum()), mapaxes=ax.tolist())


def choose_crop(model, hdr):
    o, vil, vxl = header_transform(hdr["corners"])
    il, xl = to_ilxl(model["utm"], o, vil, vxl)
    mb = MARGIN_M / BIN
    il0, il1 = int(np.floor(il.min() - mb)), int(np.ceil(il.max() + mb))
    xl0, xl1 = int(np.floor(xl.min() - mb)), int(np.ceil(xl.max() + mb))
    il1 += (il1 - il0) % STEP   # whole 25 m steps, rounding outward, so both ends are output traces
    xl1 += (xl1 - xl0) % STEP
    z0 = np.floor((model["top"] - VMARGIN_M) / DZ) * DZ
    z1 = np.ceil((model["base"] + VMARGIN_M) / DZ) * DZ
    crop = dict(il=[il0, il1], xl=[xl0, xl1], z=[float(z0), float(z1)],
                footprint=dict(il=[float(il.min()), float(il.max())], xl=[float(xl.min()), float(xl.max())]))
    box = dict(il=[il0 - PAD, il1 + PAD], xl=[xl0 - PAD, xl1 + PAD])
    if box["il"][0] < IL_FIRST or box["il"][1] > IL_LAST or box["xl"][0] < XL_FIRST or box["xl"][1] > XL_LAST:
        raise SystemExit(f"the crop plus the filter's pad leaves the survey: {box}")
    return crop, box


def read_box(url, box, k0, k1, threads=6):
    """Range-read every trace of the box, inline by inline (one request per inline), in order."""
    ils = list(range(box["il"][0], box["il"][1] + 1))
    xa, xb = box["xl"]
    n = xb - xa + 1
    cube = np.empty((len(ils), n, k1 - k0 + 1), dtype=np.float32)
    heads = np.empty((len(ils), n, 7), dtype=np.int64)  # il, xl, cdpx, cdpy, scalco, ns, dt
    digest = hashlib.sha256()
    t0 = time.time()

    def get(il):
        first = (il - IL_FIRST) * NXL_FILE + (xa - XL_FIRST)
        start = 3600 + first * TRACE
        raw, _ = common.http_get(url, headers={"Range": f"bytes={start}-{start + n * TRACE - 1}"})
        if len(raw) != n * TRACE:
            raise SystemExit(f"short read on inline {il}")
        return raw

    nbytes = 0
    with ThreadPoolExecutor(threads) as ex:
        for row, raw in enumerate(ex.map(get, ils)):  # map keeps the order, so the hash is of the bytes in order
            digest.update(raw)
            nbytes += len(raw)
            a = np.frombuffer(raw, dtype=np.uint8).reshape(n, TRACE)
            hd = a[:, :240]
            be32 = lambda off: hd[:, off - 1:off + 3].copy().view(">i4").ravel().astype(np.int64)
            be16 = lambda off: hd[:, off - 1:off + 1].copy().view(">i2").ravel().astype(np.int64)
            heads[row] = np.stack([be32(189), be32(193), be32(181), be32(185), be16(71), be16(115), be16(117)], 1)
            if not (np.all(heads[row, :, 0] == ils[row]) and np.all(heads[row, :, 1] == np.arange(xa, xb + 1))):
                raise SystemExit(f"trace headers on inline {ils[row]} do not carry the expected numbers")
            if not (np.all(heads[row, :, 5] == NS) and np.all(heads[row, :, 6] == 5000)):
                raise SystemExit(f"trace headers on inline {ils[row]}: unexpected sample count or interval")
            samples = ibm_to_float64(a[:, 240:].tobytes()).reshape(n, NS)
            cube[row] = samples[:, k0:k1 + 1].astype(np.float32)
            if row % 50 == 0:
                print(f"  inline {ils[row]}: {nbytes / 1e6:,.0f} MB in {time.time() - t0:.0f} s", flush=True)
    return cube, heads, digest.hexdigest(), nbytes


def fit_geometry(heads):
    """Least-squares affine (il, xl) -> (x, y) over every trace header read, solved exactly.

    The headers hold integers (CDP X/Y in units of 1/|scalar| m, inline and crossline numbers), so the
    normal equations are summed in integers and solved in rationals: the same answer on every machine."""
    from fractions import Fraction
    h = heads.reshape(-1, 7)
    if len(set(h[:, 4].tolist())) != 1 or h[0, 4] >= 0:
        raise SystemExit(f"expected one negative coordinate scalar, got {sorted(set(h[:, 4].tolist()))}")
    div = int(-h[0, 4])
    u = (h[:, 0] - IL_FIRST).astype(np.int64)
    v = (h[:, 1] - XL_FIRST).astype(np.int64)
    s = lambda a: int(np.sum(a, dtype=np.int64))  # integer sums: exact in any order
    n = len(h)
    ata = [[n, s(u), s(v)], [s(u), s(u * u), s(u * v)], [s(v), s(u * v), s(v * v)]]

    def solve(b):
        m = [[Fraction(ata[r][c]) for c in range(3)] + [Fraction(b[r])] for r in range(3)]
        for c in range(3):  # Gauss-Jordan in rationals
            piv = next(r for r in range(c, 3) if m[r][c] != 0)
            m[c], m[piv] = m[piv], m[c]
            m[c] = [x / m[c][c] for x in m[c]]
            for r in range(3):
                if r != c:
                    m[r] = [a - m[r][c] * b_ for a, b_ in zip(m[r], m[c])]
        return [float(m[r][3] / div) for r in range(3)]

    cx = solve([s(h[:, 2]), s(u * h[:, 2]), s(v * h[:, 2])])
    cy = solve([s(h[:, 3]), s(u * h[:, 3]), s(v * h[:, 3])])
    px = cx[0] + u * cx[1] + v * cx[2]
    py = cy[0] + u * cy[1] + v * cy[2]
    res = np.hypot(px - h[:, 2] / div, py - h[:, 3] / div)
    return dict(origin_file=[cx[0], cy[0]], il_step=[cx[1], cy[1]], xl_step=[cx[2], cy[2]],
                residual_max=float(res.max()), residual_rms=float(np.sqrt(np.mean(res ** 2))), n=int(n), scalar=-div)


def antialias_decimate(cube, crop, box, chunk=32):
    """Filter along crossline, then inline, evaluated only at the kept traces; float64, a fixed order of
    elementwise operations, in depth chunks (depth is untouched, so chunks are independent)."""
    m = (len(TAPS) - 1) // 2
    xo = np.arange(crop["xl"][0], crop["xl"][1] + 1, STEP) - box["xl"][0]
    io = np.arange(crop["il"][0], crop["il"][1] + 1, STEP) - box["il"][0]
    out = np.zeros((len(io), len(xo), cube.shape[2]))
    for z0 in range(0, cube.shape[2], chunk):
        x = cube[:, :, z0:z0 + chunk].astype(np.float64)
        acc = np.zeros((x.shape[0], len(xo), x.shape[2]))
        for t in range(len(TAPS)):
            acc = acc + TAPS[t] * x[:, xo + t - m, :]
        o = np.zeros((len(io), len(xo), x.shape[2]))
        for t in range(len(TAPS)):
            o = o + TAPS[t] * acc[io + t - m, :, :]
        out[:, :, z0:z0 + chunk] = o
    return out


def quantize(a, clip):
    return (128 + np.rint(127.0 * np.clip(a / clip, -1.0, 1.0))).astype(np.uint8)


def horizons_on_grid(inputs, ils, xls, geo):
    out, info = [], {}
    for name in ("Hugin_Fm_Top", "Hugin_Fm_Base"):
        text = (Path(inputs) / "horizons" / f"{name}.dat").read_text(encoding="latin-1").splitlines()
        rows = np.array([[float(v) for v in l.split(",")] for l in text if l[:1].isdigit()], dtype=np.float64)
        if rows.shape[1] != 5:
            raise SystemExit(f"{name}: expected IL, XL, X, Y, Z rows")
        il, xl = rows[:, 0].astype(np.int64), rows[:, 1].astype(np.int64)
        px = geo["origin_file"][0] + (il - IL_FIRST) * geo["il_step"][0] + (xl - XL_FIRST) * geo["xl_step"][0]
        py = geo["origin_file"][1] + (il - IL_FIRST) * geo["il_step"][1] + (xl - XL_FIRST) * geo["xl_step"][1]
        off = np.hypot(px - rows[:, 2], py - rows[:, 3])
        grid = np.full((len(ils), len(xls)), np.nan, dtype=np.float32)
        lut = {(a, b): v for a, b, v in zip(il.tolist(), xl.tolist(), rows[:, 4].tolist())}
        for r, a in enumerate(ils):
            for c, b in enumerate(xls):
                v = lut.get((int(a), int(b)))
                if v is not None:
                    grid[r, c] = v
        out.append(grid)
        info[name] = dict(points=int(len(rows)), onGrid=int(np.isfinite(grid).sum()),
                          xyOffsetFromTraceGridMax=round(float(off.max()), 3),
                          depthRange=[round(float(np.nanmin(grid)), 1), round(float(np.nanmax(grid)), 1)])
    return np.stack(out), info


DEPTH_RELATION = ("This PS image is positioned in depth by its own converted-wave velocity model, so its reflectors "
                  "can sit at different depths from the well paths and the well-adjusted horizons, which agree with "
                  "each other, and from the simulation model, whose completed cells lie on those well paths. Nothing "
                  "is shifted to hide the difference.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--deck", default="work/deck", help="the prepared deck (prepare_deck.py)")
    ap.add_argument("--inputs", default="work/inputs")
    ap.add_argument("--data-dir", default=str(common.HERE.parent / "data"))
    ap.add_argument("--cache", help="development only: keep the traces read in this folder and reuse them; a cached "
                    "read is trusted by the sha256 stored with it, not re-hashed, so never build data/ for a commit from it")
    ap.add_argument("--pin", action="store_true", help="record the read's sha256 in sources.json (maintainers)")
    args = ap.parse_args()
    src = common.load_sources()
    pin = src["seismic"]
    head = common.http_head(pin["url"])
    if int(head["Content-Length"]) != pin["bytes"] or head["ETag"].strip('"') != pin["etag"]:
        raise SystemExit(f"PIN MISMATCH: the seismic object changed (size {head['Content-Length']}, ETag {head['ETag']})")
    hdr = read_textual_header(pin["url"])
    if pin.get("readHeaderSha256") and hdr["sha256"] != pin["readHeaderSha256"]:
        raise SystemExit("PIN MISMATCH: the SEG-Y file header changed")
    model = model_extent(args.deck, args.inputs)
    crop, box = choose_crop(model, hdr)
    k0, k1 = int(round(crop["z"][0] / DZ)), int(round(crop["z"][1] / DZ))
    print(f"model: {model['nactive']:,} active cells, depths {model['top']:.1f}-{model['base']:.1f} m; "
          f"crop IL {crop['il']}, XL {crop['xl']}, depth {crop['z']} m; read box IL {box['il']}, XL {box['xl']}")

    cache = Path(args.cache) / "seismic_box.npz" if args.cache else None
    if cache and cache.exists():
        z = np.load(cache)
        cube, heads, read_sha, nbytes = z["cube"], z["heads"], str(z["sha"]), int(z["nbytes"])
        print(f"traces from the cache {cache}")
    else:
        cube, heads, read_sha, nbytes = read_box(pin["url"], box, k0, k1)
        if cache:
            cache.parent.mkdir(parents=True, exist_ok=True)
            np.savez(cache, cube=cube, heads=heads, sha=read_sha, nbytes=nbytes)
    print(f"read {nbytes:,} B, sha256 {read_sha}")
    want = dict(readBox=box, readK=[k0, k1], readBytes=nbytes, readSha256=read_sha, readHeaderSha256=hdr["sha256"])
    if args.pin:
        src["seismic"].update(want)
        common.SOURCES.write_text(json.dumps(src, indent=1) + "\n")
        print("pinned the read in sources.json")
    else:
        for key, val in want.items():
            if pin.get(key) != val:
                raise SystemExit(f"PIN MISMATCH on {key}: got {val}, pinned {pin.get(key)}")

    geo = fit_geometry(heads)
    # The headers' coordinates are rounded in the contractor's export: they scatter up to about 0.17 m
    # (rms 0.08 m) around one exact grid. More than 2 % of a bin would mean they are not one grid.
    if geo["residual_max"] > FIT_TOLERANCE_M:
        raise SystemExit(f"trace coordinates do not fit one grid (max residual {geo['residual_max']:.3f} m)")
    # the crop again, with the grid fitted to the traces instead of the header's corners: it must not move
    fitted = [dict(il=a, xl=b, x=geo["origin_file"][0] + (a - IL_FIRST) * geo["il_step"][0] + (b - XL_FIRST) * geo["xl_step"][0],
                   y=geo["origin_file"][1] + (a - IL_FIRST) * geo["il_step"][1] + (b - XL_FIRST) * geo["xl_step"][1])
              for a, b in ((IL_FIRST, XL_FIRST), (IL_LAST, XL_FIRST), (IL_FIRST, XL_LAST))]
    again, _ = choose_crop(model, dict(corners=fitted + [dict(il=IL_LAST, xl=XL_LAST, x=0.0, y=0.0)]))
    if (again["il"], again["xl"]) != (crop["il"], crop["xl"]):
        raise SystemExit(f"the fitted grid moves the crop: {again['il']} {again['xl']} against {crop['il']} {crop['xl']}")

    out = antialias_decimate(cube, crop, box)
    clip = float(np.percentile(np.abs(out), CLIP_PERCENTILE))
    q = quantize(out, clip)
    ils = np.arange(crop["il"][0], crop["il"][1] + 1, STEP)
    xls = np.arange(crop["xl"][0], crop["xl"][1] + 1, STEP)
    data = Path(args.data_dir)
    data.mkdir(parents=True, exist_ok=True)
    q.tofile(data / "seismic.bin")
    hz, hinfo = horizons_on_grid(args.inputs, ils, xls, geo)
    hz.astype("<f4").tofile(data / "horizons.bin")

    def xy(i, x):
        return [round(geo["origin_file"][0] + (i - IL_FIRST) * geo["il_step"][0] + (x - XL_FIRST) * geo["xl_step"][0], 3),
                round(geo["origin_file"][1] + (i - IL_FIRST) * geo["il_step"][1] + (x - XL_FIRST) * geo["xl_step"][1], 3)]

    az = lambda v: round(float(np.degrees(np.arctan2(v[0], v[1])) % 360), 4)
    text = " ".join(hdr["lines"])
    # The header names no datum. Tidal statics in its processing list reference the data to mean sea
    # level, so that is stated, as an inference, only when the header carries them.
    datum = ("mean sea level (inferred: the header's processing list includes tidal statics; the header does not "
             "state a datum). As delivered: first sample 0 m, 5 m interval, 901 samples; not shifted, stretched or "
             "tied to the model." if "TIDAL STATICS" in text else
             "as delivered: the stack's own depth (first sample 0 m, 5 m interval, 901 samples); the header does not "
             "name the datum. Not shifted, stretched or tied to the model.")
    polarity_note = ("Stated for a converted-wave (PS) image: PS amplitudes respond mainly to shear-impedance and "
                     "density contrasts, so read this as the SEG sign convention the contractor used, not as an "
                     "acoustic-impedance polarity." if " PS " in f" {text} " else "")
    meta = {
        "survey": "ST0202 (2002 baseline, 4C ocean-bottom cable; GECO Angler)",
        "product": "ST0202R08 PS PSDM full-offset stack in depth (converted-wave image, WesternGeco 2008 processing)",
        "textualHeader": [l for l in hdr["lines"] if l.strip()],
        "crs": "ED50 / UTM zone 31N (EPSG:23031), metres",
        "file": "seismic.bin",
        "dtype": "uint8",
        "order": "inline-major: for each inline (il.count), each crossline (xl.count), the depth samples (z.count)",
        "il": {"first": int(ils[0]), "last": int(ils[-1]), "step": STEP, "count": int(len(ils))},
        "xl": {"first": int(xls[0]), "last": int(xls[-1]), "step": STEP, "count": int(len(xls))},
        "z": {"first": crop["z"][0], "step": DZ, "count": int(k1 - k0 + 1), "unit": "m", "positive": "down",
              "datum": datum},
        "origin": xy(ils[0], xls[0]),
        "ilVector": [round(STEP * geo["il_step"][0], 6), round(STEP * geo["il_step"][1], 6)],
        "xlVector": [round(STEP * geo["xl_step"][0], 6), round(STEP * geo["xl_step"][1], 6)],
        "spacing": {"il": round(STEP * float(np.hypot(*geo["il_step"])), 4), "xl": round(STEP * float(np.hypot(*geo["xl_step"])), 4),
                    "binIl": round(float(np.hypot(*geo["il_step"])), 4), "binXl": round(float(np.hypot(*geo["xl_step"])), 4)},
        "azimuth": {"inlineIncreasing": az(geo["il_step"]), "crosslineIncreasing": az(geo["xl_step"]),
                    "convention": "degrees clockwise from grid north. The header's 'INLINE DIRECTION' (284 degrees) "
                                  "runs along an inline, the direction crossline numbers increase."},
        "position": "x = origin.x + (il - il.first) / il.step * ilVector.x + (xl - xl.first) / xl.step * xlVector.x; same for y",
        "corners": [dict(il=int(a), xl=int(b), x=xy(a, b)[0], y=xy(a, b)[1])
                    for a, b in ((ils[0], xls[0]), (ils[0], xls[-1]), (ils[-1], xls[-1]), (ils[-1], xls[0]))],
        "fit": {"traces": geo["n"], "residualMaxM": round(geo["residual_max"], 4), "residualRmsM": round(geo["residual_rms"], 4),
                "coordinateScalar": geo["scalar"],
                "axesAngleDeg": round(float(np.degrees(np.arccos(np.dot(geo["il_step"], geo["xl_step"]) /
                                      (np.hypot(*geo["il_step"]) * np.hypot(*geo["xl_step"]))))), 5),
                "note": "one affine grid fitted (exactly, in integers and rationals) to the CDP X/Y (bytes 181-188, scalar "
                        "bytes 71-72) of every trace read; the headers scatter around it by their export rounding"},
        "amplitude": {"decode": "a = (code - 128) / 127 * clip", "clip": clip, "clipPercentile": CLIP_PERCENTILE,
                      "zeroCode": 128, "codeRange": [1, 255],
                      "clippedFraction": round(float(np.mean(np.abs(out) > clip)), 6),
                      "absMax": float(np.abs(out).max()),
                      "unit": "as delivered (stack amplitude, no unit stated); no AGC or other gain added here",
                      "note": "the header lists '2DB EXP. GAIN CORRECTION' in the contractor's own processing"},
        "polarity": hdr["polarity"][0] if hdr["polarity"] else "not stated",
        "polaritySource": "what the contractor's textual header states, line C39, verbatim" if hdr["polarity"] else "",
        "polarityNote": polarity_note,
        "depthRelation": DEPTH_RELATION,
        "antiAlias": {"filter": f"separable Kaiser-windowed sinc, {len(TAPS)} taps, cutoff 0.225 cycles per bin, beta 4.5335",
                      "passBand": "to 0.20 cycles per 12.5 m bin (0.016 cycles/m, wavelengths of 62.5 m and more) within 0.05 dB",
                      "stopBand": "at least 50 dB down from 0.25 cycles per bin (0.02 cycles/m, the 25 m grid's Nyquist)",
                      "applied": "on the inline and crossline axes before keeping every second trace; depth untouched"},
        "crop": {"rule": "reservoir top - 500 m to base + 500 m (the model's own depths), footprint + 250 m",
                 "modelTop": round(model["top"], 2), "modelBase": round(model["base"], 2),
                 "modelActiveCells": model["nactive"], "footprintIl": [round(v, 2) for v in crop["footprint"]["il"]],
                 "footprintXl": [round(v, 2) for v in crop["footprint"]["xl"]], "lateralMarginM": MARGIN_M,
                 "verticalMarginM": VMARGIN_M, "readPadTraces": PAD},
        "horizons": {"file": "horizons.bin", "dtype": "float32 little-endian, NaN where not picked",
                     "order": "Hugin_Fm_Top then Hugin_Fm_Base, each inline-major on this grid (il.count x xl.count)",
                     "unit": "m depth below mean sea level",
                     "source": "OSDU volve/horizons, interpreted on ST10010ZC11 Near (2011 PZ processing), depth-converted "
                               "and adjusted to the wells (the file names carry '_adj' and '_adj2'); they agree with "
                               "Equinor's Hugin top well picks to a median 0.1 m (tools/DECISIONS.md section 7). Not "
                               "picks on this PS cube, and not tied to it", **hinfo},
        "source": {"url": pin["url"], "bytes": pin["bytes"], "etag": pin["etag"], "readBytes": nbytes,
                   "readSha256": read_sha, "headerSha256": hdr["sha256"]},
    }
    (data / "seismic.json").write_text(json.dumps(meta, indent=1) + "\n")
    print(f"seismic.bin {q.size:,} B ({len(ils)} x {len(xls)} x {k1 - k0 + 1}), clip {clip:.6g}, "
          f"fit residual max {geo['residual_max']:.4f} m; horizons.bin {hz.size * 4:,} B")


if __name__ == "__main__":
    main()
