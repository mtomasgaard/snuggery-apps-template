"""Warming World's anomaly ramp: the stops ART.md fixes, interpolated in OKLab, and the checks
DESIGN.md §7.1 asks for. Standard library only. Run: python3 tools/art/ramp.py [--lut]

Colour-vision simulation: Machado, Oliveira and Fernandes (2009), "A Physiologically-based Model
for Simulation of Color Vision Deficiency", IEEE TVCG 15(6):1291-1298, severity 1.0 matrices,
applied in linear sRGB.
"""
import math, sys

# value °C -> (L, C, h) in OKLCh. Symmetric in L by construction; hues chosen so the warm side
# runs rose -> brick and never passes through orange (danger) or terracotta.
STOPS = [
    (-4.0, 0.440, 0.120, 262.0),
    (-2.0, 0.640, 0.105, 251.0),
    (-1.0, 0.800, 0.062, 245.0),
    (-0.5, 0.890, 0.030, 240.0),
    ( 0.0, 0.965, 0.004, 95.0),
    ( 0.5, 0.890, 0.032, 30.0),
    ( 1.0, 0.800, 0.068, 28.0),
    ( 2.0, 0.640, 0.125, 27.0),
    ( 4.0, 0.440, 0.125, 24.0),
]
HATCH = [(0.60, 0.0, 0.0), (0.68, 0.0, 0.0)]

def lch2lab(L, C, h):
    r = math.radians(h); return (L, C * math.cos(r), C * math.sin(r))
def lab2lin(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
def lin2lab(r, g, b):
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(x) ** (1 / 3), x) for x in (l, m, s))
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)
def enc(x):
    x = min(1.0, max(0.0, x)); return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
def dec(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def hexs(rgb): return '#' + ''.join('%02x' % round(enc(c) * 255) for c in rgb)
def in_gamut(rgb): return all(-1e-4 <= c <= 1 + 1e-4 for c in rgb)

LABS = [(v, lch2lab(L, C, h)) for v, L, C, h in STOPS]
def color_lab(v):
    v = max(-4.0, min(4.0, v))
    for (v0, p), (v1, q) in zip(LABS, LABS[1:]):
        if v0 <= v <= v1:
            t = (v - v0) / (v1 - v0); return tuple(p[i] + (q[i] - p[i]) * t for i in range(3))
def color_hex(v): return hexs(lab2lin(*color_lab(v)))

M = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
     'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
     'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
def sim(lab, kind):
    rgb = [dec(enc(c)) for c in lab2lin(*lab)]          # through 8-bit-like clamp
    if kind != 'normal':
        rgb = [sum(M[kind][i][j] * rgb[j] for j in range(3)) for i in range(3)]
        rgb = [min(1, max(0, c)) for c in rgb]
    return lin2lab(*rgb)
def dE(p, q): return math.dist(p, q)

def main():
    ok = True
    print('stops (value, OKLCh, sRGB, in gamut):')
    for v, L, C, h in STOPS:
        lin = lab2lin(*lch2lab(L, C, h)); g = in_gamut(lin); ok &= g
        print(f'  {v:+.1f} °C  L {L:.3f} C {C:.3f} h {h:5.1f}  {hexs(lin)}  {"ok" if g else "OUT OF GAMUT"}')
    worst_sym = max(abs(color_lab(k / 10)[0] - color_lab(-k / 10)[0]) for k in range(41))
    mono = all(color_lab(k / 10)[0] < color_lab((k - 1) / 10)[0] for k in range(1, 41)) and \
           all(color_lab(-k / 10)[0] < color_lab(-(k - 1) / 10)[0] for k in range(1, 41))
    c0 = math.hypot(*color_lab(0)[1:])
    print(f'symmetry max |L(+v)-L(-v)| {worst_sym:.4f} (<= 0.02)  monotonic {mono}  chroma at 0 {c0:.4f} (<= 0.02)')
    ok &= worst_sym <= 0.02 and mono and c0 <= 0.02
    for kind in ('normal', 'deutan', 'protan', 'tritan'):
        e = dE(sim(color_lab(-4), kind), sim(color_lab(4), kind))
        n1 = dE(sim(color_lab(-1), kind), sim(color_lab(0), kind)); p1 = dE(sim(color_lab(1), kind), sim(color_lab(0), kind))
        pm = dE(sim(color_lab(-2), kind), sim(color_lab(2), kind))
        hz = min(dE(sim(color_lab(v), kind), sim(lch2lab(*hc), kind)) for v in (-4, 4) for hc in HATCH)
        print(f'  {kind:6s} dE(-4,+4) {e:.3f}  dE(-2,+2) {pm:.3f}  dE(-1,0) {n1:.3f}  dE(+1,0) {p1:.3f}  min dE(end, hatch) {hz:.3f}')
        if kind in ('normal', 'deutan', 'protan'):
            ok &= e >= 0.15 and n1 >= 0.08 and p1 >= 0.08 and hz >= 0.08
    print('hatch greys', [hexs(lab2lin(*lch2lab(*h))) for h in HATCH])
    print('legend ticks', {v: color_hex(v) for v in (-4, -3, -2, -1, 0, 1, 2, 3, 4)})
    if '--lut' in sys.argv:
        print('LUT byte b -> value -12.7+0.1b, clamped to ±4:')
        print(' '.join(color_hex(-12.7 + 0.1 * b) for b in range(255)))
    print('ALL CHECKS PASS' if ok else 'A CHECK FAILED'); return 0 if ok else 1

if __name__ == '__main__': sys.exit(main())
