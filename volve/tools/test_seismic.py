"""Tests for pipeline/seismic.py (plan 0012, D11). Needs numpy only (and data/ for the file checks).

    python3 tools/test_seismic.py          # from Template/volve; exits non-zero on any failure

1. The anti-alias filter: the constant taps are the stated design, and the response meets it.
2. Aliasing, measured through the pipeline's own antialias_decimate on synthetic data:
   a plane wave above the 25 m grid's Nyquist is suppressed (a bare drop of every second trace
   folds it back at full strength), and a steeply dipping Ricker event leaves no wrong-dip energy.
3. Zero is code 128, the scale is symmetric, and data/seismic.bin never uses code 0.
4. The geometry round trip: data/seismic.json's grid reproduces the coordinates in real trace
   headers (tools/fixtures/trace_headers.json) and the textual header's corners, and back.
5. A seeded fingerprint of filter + quantization, so a Linux run proves the same bytes as a Mac.
   Measured on macOS arm64 only. --fingerprint-report-only (the pipeline's setting) prints it without
   failing: the identity that matters, seismic.bin against the committed file, is checked separately.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import seismic as S  # noqa: E402

FAILS = []


def check(name, ok, detail=""):
    print(f"{'ok  ' if ok else 'FAIL'} {name}{': ' + detail if detail else ''}")
    if not ok:
        FAILS.append(name)


def response(h, f):
    n = np.arange(len(h)) - (len(h) - 1) / 2
    return np.abs((np.cos(2 * np.pi * np.outer(f, n)) * h).sum(1))  # symmetric taps: the response is real


def test_filter():
    m, fc, a = 60, 0.225, 50.0
    beta = 0.5842 * (a - 21) ** 0.4 + 0.07886 * (a - 21)
    n = np.arange(m + 1) - m / 2
    h = 2 * fc * np.sinc(2 * fc * n) * np.kaiser(m + 1, beta)
    h = h / h.sum()
    h = (h + h[::-1]) / 2
    check("taps are the stated design (61-tap Kaiser sinc, fc 0.225, beta 4.5335)",
          np.max(np.abs(h - S.TAPS)) < 1e-14, f"max |design - TAPS| {np.max(np.abs(h - S.TAPS)):.1e}")
    check("taps symmetric and sum to 1", np.array_equal(S.TAPS, S.TAPS[::-1]) and abs(S.TAPS.sum() - 1) < 1e-14)
    f = np.linspace(0, 0.5, 5001)
    r = response(S.TAPS, f)
    pb, sb = r[f <= 0.20], r[f >= 0.25]
    ripple = 20 * np.log10(pb.max() / pb.min())
    stop = 20 * np.log10(sb.max())
    check("pass band to 0.20 cycles/bin within 0.05 dB", ripple <= 0.05, f"{ripple:.4f} dB")
    check("stop band from 0.25 cycles/bin at least 50 dB down", stop <= -50, f"{stop:.1f} dB")


def run_pipeline_filter(cube_fn, nil=40, nxl=200, nz=8):
    """Synthetic cube on the 12.5 m bins with the pipeline's pad, through antialias_decimate."""
    pad = S.PAD
    il = np.arange(nil + 2 * pad + 1)
    xl = np.arange(nxl + 2 * pad + 1)
    cube = cube_fn(il[:, None, None] * S.BIN, xl[None, :, None] * S.BIN, np.arange(nz)[None, None, :] * S.DZ)
    box = dict(il=[0, len(il) - 1], xl=[0, len(xl) - 1])
    crop = dict(il=[pad, pad + nil], xl=[pad, pad + nxl])
    filt = S.antialias_decimate(cube.astype(np.float32), crop, box)
    naive = cube[pad:pad + nil + 1:S.STEP, pad:pad + nxl + 1:S.STEP, :]
    return filt, naive


def test_plane_waves():
    for k, kind in ((0.010, "pass"), (0.016, "pass"), (0.030, "stop"), (0.026, "stop")):
        fn = lambda x, y, z, k=k: np.cos(2 * np.pi * k * y + 0 * x + 0 * z)
        filt, naive = run_pipeline_filter(fn)
        amp_f, amp_n = np.abs(filt).max(), np.abs(naive).max()
        if kind == "pass":
            check(f"crossline wave {k} cycles/m ({1 / k:.0f} m) passes", abs(amp_f - 1) < 0.005,
                  f"amplitude {amp_f:.4f} (bare drop {amp_n:.4f})")
        else:
            alias = abs(0.04 - k)
            check(f"crossline wave {k} cycles/m ({1 / k:.1f} m) suppressed, not folded to {alias:.3f}",
                  amp_f < 10 ** (-48 / 20) and amp_n > 0.99,
                  f"filtered {20 * np.log10(amp_f):.1f} dB; a bare drop keeps it at {amp_n:.3f} as a false {1 / alias:.0f} m wave")
        fn2 = lambda x, y, z, k=k: np.cos(2 * np.pi * k * x + 0 * y + 0 * z)
        filt2, _ = run_pipeline_filter(fn2)
        a2 = np.abs(filt2).max()
        ok2 = abs(a2 - 1) < 0.005 if kind == "pass" else a2 < 10 ** (-48 / 20)
        check(f"inline wave {k} cycles/m the same", ok2, f"amplitude {a2:.4f}")


def ricker(z, fpk):
    a = (np.pi * fpk * z) ** 2
    return (1 - 2 * a) * np.exp(-a)


def quadrant_energy(sec, dx, dz):
    """Energy of a section (traces x depth) in the two dip quadrants of its f-k spectrum."""
    w = np.hanning(sec.shape[0])[:, None] * np.hanning(sec.shape[1])[None, :]
    f = np.fft.fftshift(np.abs(np.fft.fft2(sec * w)) ** 2)
    kx = np.fft.fftshift(np.fft.fftfreq(sec.shape[0], dx))[:, None]
    kz = np.fft.fftshift(np.fft.fftfreq(sec.shape[1], dz))[None, :]
    pos = ((kx * kz) > 0) & (np.abs(kx) > 1e-9)
    neg = ((kx * kz) < 0) & (np.abs(kx) > 1e-9)
    return float(f[pos].sum()), float(f[neg].sum())


def test_dipping_event():
    """A reflector dipping 45 degrees along the crossline axis, a Ricker wavelet peaking at 0.012 cycles/m:
    its lateral wavenumbers reach 0.03 cycles/m, above the 25 m grid's Nyquist (0.02). Energy that a
    decimation folds over shows with the opposite dip; measured as the wrong-dip share of the f-k energy."""
    nz, dip = 256, np.tan(np.radians(45))
    fn = lambda x, y, z: ricker(z - 600.0 - dip * (y - 1250.0) + 0 * x, 0.012)
    filt, naive = run_pipeline_filter(fn, nil=4, nxl=200, nz=nz)
    full = fn(np.zeros((1, 1, 1)), (np.arange(201)[None, :, None] + S.PAD) * S.BIN, np.arange(nz)[None, None, :] * S.DZ)[0]
    r0, w0 = quadrant_energy(full, S.BIN, S.DZ)
    rf, wf = quadrant_energy(filt[1], 2 * S.BIN, S.DZ)
    rn, wn = quadrant_energy(naive[1], 2 * S.BIN, S.DZ)
    right = (lambda r, w: (r, w)) if r0 > w0 else (lambda r, w: (w, r))
    db = lambda r, w: 10 * np.log10(right(r, w)[1] / right(r, w)[0])
    check("12.5 m original: the event's energy has one dip", db(r0, w0) < -40, f"wrong-dip share {db(r0, w0):.1f} dB")
    check("bare drop of every second trace aliases it", db(rn, wn) > -15, f"wrong-dip share {db(rn, wn):.1f} dB")
    check("anti-alias then decimate leaves no aliased energy", db(rf, wf) < -40, f"wrong-dip share {db(rf, wf):.1f} dB")
    gentle = lambda x, y, z: ricker(z - 600.0 - np.tan(np.radians(10)) * (y - 1250.0) + 0 * x, 0.012)
    gf, gn = run_pipeline_filter(gentle, nil=4, nxl=200, nz=nz)
    err = np.abs(gf[1] - gn[1]).max() / np.abs(gn[1]).max()
    check("a gentle 10 degree dip is kept as it was", err < 0.01, f"max difference {100 * err:.2f} % of peak")


def test_quantize():
    clip = 0.1
    a = np.array([0.0, -0.0, clip, -clip, 2 * clip, -2 * clip, clip / 254, -clip / 254, 1e-9, -1e-9])
    q = S.quantize(a, clip)
    check("zero is code 128, +clip 255, -clip 1, beyond clip held at 1 and 255",
          q.tolist()[:6] == [128, 128, 255, 1, 255, 1], str(q.tolist()))
    x = np.random.default_rng(1).standard_normal(100000) * clip
    qa, qb = S.quantize(x, clip).astype(int), S.quantize(-x, clip).astype(int)
    check("symmetric: code(-a) = 256 - code(a)", np.array_equal(qb, 256 - qa))
    inside = np.abs(x) <= clip
    err = np.abs((qa[inside] - 128) / 127 * clip - x[inside]).max()
    check("decode within half a step inside the clip", err <= clip / 254 + 1e-12, f"max error {err:.2e} (half step {clip / 254:.2e})")
    data = ROOT / "data" / "seismic.bin"
    if data.exists():
        m = json.loads((ROOT / "data" / "seismic.json").read_text())
        q = np.fromfile(data, dtype=np.uint8)
        check("seismic.bin has il x xl x z bytes", q.size == m["il"]["count"] * m["xl"]["count"] * m["z"]["count"], f"{q.size:,}")
        check("seismic.bin never uses code 0", int((q == 0).sum()) == 0)
        clipped = float(np.mean((q == 1) | (q == 255)))
        check("about 0.1 % of samples at the clip (the 99.9th percentile)", 0.0005 < clipped < 0.002, f"{100 * clipped:.3f} %")
        check("codes centred on 128", abs(float(q.mean()) - 128) < 0.5, f"mean {q.mean():.3f}")


def test_geometry():
    m = json.loads((ROOT / "data" / "seismic.json").read_text())
    fx = json.loads((ROOT / "tools" / "fixtures" / "trace_headers.json").read_text())["traces"]

    def xy(il, xl):
        u = (il - m["il"]["first"]) / m["il"]["step"]
        v = (xl - m["xl"]["first"]) / m["xl"]["step"]
        return (m["origin"][0] + u * m["ilVector"][0] + v * m["xlVector"][0],
                m["origin"][1] + u * m["ilVector"][1] + v * m["xlVector"][1])

    def ilxl(x, y):
        a = np.array([[m["ilVector"][0], m["xlVector"][0]], [m["ilVector"][1], m["xlVector"][1]]])
        u, v = np.linalg.solve(a, [x - m["origin"][0], y - m["origin"][1]])
        return m["il"]["first"] + u * m["il"]["step"], m["xl"]["first"] + v * m["xl"]["step"]

    d, back = [], []
    for t in fx:
        s = 1.0 / -t["scalar"] if t["scalar"] < 0 else float(t["scalar"] or 1)
        hx, hy = t["cdpx"] * s, t["cdpy"] * s
        px, py = xy(t["il"], t["xl"])
        d.append(np.hypot(px - hx, py - hy))
        i, x = ilxl(hx, hy)
        back.append(max(abs(i - t["il"]), abs(x - t["xl"])))
    check(f"{len(fx)} real trace headers: the grid gives their X/Y", max(d) <= S.FIT_TOLERANCE_M,
          f"max {max(d):.3f} m (header rounding; tolerance {S.FIT_TOLERANCE_M} m)")
    check("and their X/Y give back their inline and crossline", max(back) < 0.02, f"max {max(back):.4f} of a bin")
    corners = {(c["il"], c["xl"]): (c["x"], c["y"]) for c in m["corners"]}
    for (il, xl), (cx, cy) in corners.items():
        px, py = xy(il, xl)
        check(f"corner ({il}, {xl}) consistent with the vectors", np.hypot(px - cx, py - cy) < 0.002)
    txt = {(9985, 1932): (438727.0, 6475514.4), (9985, 2536): (431401.3, 6477341.0),
           (10369, 2536): (432562.5, 6481998.4), (10369, 1932): (439888.3, 6480171.9)}  # header lines C17-C20
    dd = max(np.hypot(xy(*k)[0] - v[0], xy(*k)[1] - v[1]) for k, v in txt.items())
    check("the textual header's four survey corners (C17-C20, given to 0.1 m)", dd < 0.2, f"max {dd:.3f} m")
    check("25 m spacing both ways", abs(m["spacing"]["il"] - 25) < 0.001 and abs(m["spacing"]["xl"] - 25) < 0.001)
    check("survey azimuth: inline direction 284 degrees, crossline 14 (header C13-C14)",
          abs(m["azimuth"]["crosslineIncreasing"] - 284) < 0.01 and abs(m["azimuth"]["inlineIncreasing"] - 14) < 0.01)
    check("original depths: first sample a multiple of 5 m, step 5 m",
          m["z"]["step"] == 5.0 and m["z"]["first"] % 5 == 0, f"{m['z']['first']} m")


FINGERPRINT = "b593685201b9100555522287b7bbf96b37cd6a5b945d05d4fb5effb636c59d00"  # measured on macOS arm64, numpy 2.1.3


def test_fingerprint(report_only=False):
    rng = np.random.default_rng(20261007)
    cube = rng.standard_normal((2 * S.PAD + 9, 2 * S.PAD + 11, 7)).astype(np.float32)
    box = dict(il=[0, cube.shape[0] - 1], xl=[0, cube.shape[1] - 1])
    crop = dict(il=[S.PAD, S.PAD + 8], xl=[S.PAD, S.PAD + 10])
    out = S.antialias_decimate(cube, crop, box)
    clip = float(np.percentile(np.abs(out), S.CLIP_PERCENTILE))
    h = hashlib.sha256(S.quantize(out, clip).tobytes() + repr(clip).encode()).hexdigest()
    name = "seeded fingerprint of filter, clip and quantization (same on every machine)"
    if report_only and h != FINGERPRINT:
        print(f"WARN {name}: {h} differs from the macOS arm64 value {FINGERPRINT} (reported, not failed)")
        return
    check(name, h == FINGERPRINT, h)


if __name__ == "__main__":
    test_filter()
    test_plane_waves()
    test_dipping_event()
    test_quantize()
    if (ROOT / "data" / "seismic.json").exists():
        test_geometry()
    test_fingerprint(report_only="--fingerprint-report-only" in sys.argv[1:])
    print("PASS" if not FAILS else f"FAIL: {len(FAILS)} check(s)")
    sys.exit(1 if FAILS else 0)
