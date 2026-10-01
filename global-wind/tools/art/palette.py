"""Global Weather's "Long Exposure" palette (ART.md): the chrome tokens, the plate's grounds, the
streaks, the night wash and the five layer ramps, with every check ART.md quotes. Standard library
only. Run from Template/:  python3 global-wind/tools/art/palette.py [--json] (Global Wind uses its "wind" entry)

--json prints the per-theme ramp stops as sRGB (value -> [r, g, b]) and the alpha rules, in the
shape app.js's LOOKS takes, so the builder pastes numbers rather than retyping them.

Colour maths: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the colour-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB — the same
functions as warming-world/tools/art/ramp.py, copied so that this folder stands alone.
"""
import json, math, sys

# ── colour maths ─────────────────────────────────────────────────────────────
def lch2lab(L, C, h): r = math.radians(h); return (L, C * math.cos(r), C * math.sin(r))
def lab2lin(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b; m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b; l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
def lin2lab(r, g, b):
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b; m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(x) ** (1 / 3), x) for x in (l, m, s))
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)
def enc(x): x = min(1.0, max(0.0, x)); return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
def dec(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def rgb8(lin): return tuple(round(enc(c) * 255) for c in lin)
def hx(rgb): return '#' + ''.join('%02x' % c for c in rgb)
def parse(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def lum(rgb): r, g, b = (dec(c / 255) for c in rgb); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def cr(a, b): la, lb = sorted((lum(a), lum(b)), reverse=True); return (la + .05) / (lb + .05)
def over(fg, a, bg): return tuple(round(f * a + g * (1 - a)) for f, g in zip(fg, bg))
def lab8(rgb): return lin2lab(*(dec(c / 255) for c in rgb))
def lch8(rgb): L, a, b = lab8(rgb); return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360
def in_gamut(lin): return all(-1e-4 <= c <= 1 + 1e-4 for c in lin)
CVD = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
       'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
       'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
def sim(rgb, kind):
    lin = [dec(c / 255) for c in rgb]
    if kind != 'normal': lin = [min(1, max(0, sum(CVD[kind][i][j] * lin[j] for j in range(3)))) for i in range(3)]
    return lin2lab(*lin)

# ── chrome tokens (ART.md "Palette") ─────────────────────────────────────────
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72',
               line='#c9d4d8', strong='#74858c', focus='#0f1c23'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f',
               line='#2a373c', strong='#64757b', focus='#e6edee'),
}
# The plate: what is under the weather. Ocean, land, the outside of the globe, coast, borders.
PLATE = {
 'light': dict(ocean='#d3e0e4', land='#eef2ef', outside='#e8eef0', coast='#5f7079', border='#9fb0b7',
               night=(18, 33, 43), night_max=0.20, streak='#0b171d', streak_a=0.85, kappa=0.0,
               label='#0f1c23', halo='#f6f9fa'),
 'dark':  dict(ocean='#0c1518', land='#1a262a', outside='#0a1013', coast='#8a9ca3', border='#46565c',
               night=(2, 6, 9), night_max=0.42, streak='#f4f2ea', streak_a=0.95, kappa=0.30,
               label='#e6edee', halo='#0c1518'),
}

GHOST = {'light': dict(stroke='#0f1c23', halo=(246, 249, 250), halo_a=0.60),
         'dark': dict(stroke='#f2f4f1', halo=(10, 16, 19), halo_a=0.45)}

# ── the ramps: one hue path per layer, printed twice ────────────────────────
# Each stop is (value, s, C, h): s is salience, 0 = the plate's own tone, 1 = as far from the plate
# as the theme's band allows. The light theme prints salience as darkness (the negative), the dark
# theme as light (the print), so in both "more" stands further from the ground and the streaks
# keep the far end of the lightness range to themselves.
BAND = {'light': (0.955, 0.625), 'dark': (0.255, 0.650)}     # L at s = 0 and s = 1
RAMPS = {
 'wind': dict(unit='m/s', legend=(0, 36), stops=[
     (0, 0.00, 0.010, 200), (3, 0.18, 0.045, 205), (6, 0.36, 0.075, 220), (10, 0.55, 0.100, 245),
     (15, 0.72, 0.120, 275), (20, 0.82, 0.140, 305), (26, 0.90, 0.150, 330), (36, 1.00, 0.150, 358), (60, 1.00, 0.150, 358)],
     alpha=dict(at=(0, 8), frm=0.40, to=0.92)),
 'temp': dict(unit='°C', legend=(-40, 45), stops=[
     (-50, 1.00, 0.130, 290), (-35, 0.90, 0.140, 272), (-20, 0.74, 0.120, 252), (-8, 0.52, 0.085, 232),
     (0, 0.30, 0.030, 205), (6, 0.42, 0.075, 150), (14, 0.56, 0.105, 115), (22, 0.70, 0.130, 80),
     (30, 0.84, 0.150, 52), (38, 0.94, 0.155, 32), (48, 1.00, 0.150, 15)],
     alpha=dict(at=(0, 1), frm=0.90, to=0.90)),
 'rain': dict(unit='mm/h', legend=(0, 40), stops=[
     (0.02, 0.10, 0.040, 165), (0.3, 0.30, 0.080, 170), (1, 0.48, 0.100, 190), (3, 0.64, 0.115, 225),
     (8, 0.78, 0.130, 260), (18, 0.89, 0.145, 292), (40, 1.00, 0.150, 325), (60, 1.00, 0.150, 325)],
     alpha=dict(at=(0.02, 1.2), frm=0.0, to=0.92)),
 'cloud': dict(unit='%', legend=(0, 100), stops=[(0, 0.60, 0.012, 240), (100, 1.00, 0.016, 240)],
     alpha=dict(at=(0, 100), frm=0.0, to=0.82)),
 'pressure': dict(unit='hPa', legend=(955, 1050), stops=[
     (950, 1.00, 0.140, 300), (975, 0.78, 0.120, 285), (995, 0.45, 0.080, 260), (1008, 0.15, 0.030, 240),
     (1013, 0.04, 0.010, 200), (1020, 0.30, 0.060, 95), (1032, 0.62, 0.110, 80), (1045, 0.86, 0.130, 65), (1060, 1.00, 0.135, 55)],
     alpha=dict(at=(0, 1), frm=0.88, to=0.88)),
}
def ramp_rgb(key, theme, v):
    st = RAMPS[key]['stops']; v = max(st[0][0], min(st[-1][0], v))
    for (v0, s0, c0, h0), (v1, s1, c1, h1) in zip(st, st[1:]):
        if v0 <= v <= v1:
            t = 0 if v1 == v0 else (v - v0) / (v1 - v0)
            L0, L1 = BAND[theme]; p = lch2lab(L0 + (L1 - L0) * s0, c0, h0); q = lch2lab(L0 + (L1 - L0) * s1, c1, h1)
            lab = tuple(p[i] + (q[i] - p[i]) * t for i in range(3)); return gamut_map(lab)
def gamut_map(lab):
    # Keeps L and hue and lowers chroma until the colour is inside sRGB: a stop that asks for more
    # chroma than the screen has at that lightness is printed at the most the screen has.
    L, a, b = lab; C = math.hypot(a, b); mapped = False
    while not in_gamut(lab2lin(L, a, b)) and C > 1e-4:
        C *= 0.98; h = math.atan2(b, a); a, b = C * math.cos(h), C * math.sin(h); mapped = True
    return rgb8(lab2lin(L, a, b)), not mapped
def alpha(key, v):
    a = RAMPS[key]['alpha']; lo, hi = a['at']
    if a['frm'] == 0 and v < lo: return 0.0
    t = 0 if hi == lo else max(0, min(1, (v - lo) / (hi - lo))); return a['frm'] + (a['to'] - a['frm']) * t
def samples(key, n=97):
    # in the legend's own spacing: rain's bar is drawn on the byte's square-root scale (power 2)
    lo, hi = RAMPS[key]['legend']
    if key == 'rain': return [hi * (k / (n - 1)) ** 2 for k in range(n)]
    return [lo + (hi - lo) * k / (n - 1) for k in range(n)]

def dense(key, th):
    # each interval split in four, so that LOOKS' straight sRGB interpolation between stops (app.js
    # rampAt) stays within a hair of the OKLab path the checks below were run on
    st = RAMPS[key]['stops']; vs = []
    for (v0, *_), (v1, *_) in zip(st, st[1:]): vs += [v0 + (v1 - v0) * k / 4 for k in range(4)]
    vs.append(st[-1][0])
    return [[round(v, 4), list(ramp_rgb(key, th, v)[0])] for v in vs]

def main():
    if '--json' in sys.argv:
        out = {}
        for key, r in RAMPS.items():
            out[key] = {th: dense(key, th) for th in BAND}
            out[key]['alpha'] = {'at': list(r['alpha']['at']), 'from': r['alpha']['frm'], 'to': r['alpha']['to']}
        print(json.dumps(out)); return
    ok = True
    print('== chrome tokens: WCAG 2 contrast (text >= 4.5, control edges >= 3)')
    for th, t in TOK.items():
        rows = [('ink on page', 'ink', 'page'), ('ink-2 on page', 'ink2', 'page'), ('ink-3 on page', 'ink3', 'page'),
                ('ink on sheet', 'ink', 'sheet'), ('ink-2 on sheet', 'ink2', 'sheet'), ('ink-3 on sheet', 'ink3', 'sheet')]
        res = []
        for n, a, b in rows:
            c = cr(parse(t[a]), parse(t[b])); ok &= c >= 4.5; res.append(f'{n} {c:.2f}')
        e = cr(parse(t['strong']), parse(t['page'])); ok &= e >= 3; res.append(f'line-strong on page {e:.2f}')
        L, C, h = lch8(parse(t['page']))
        print(f'  {th}: ' + ', '.join(res) + f' | page OKLCh {L:.3f} {C:.4f} {h:.0f}')
    print('== the plate: labels, coasts, keys')
    for th, p in PLATE.items():
        lab_halo = cr(parse(p['label']), parse(p['halo']))
        co = [cr(parse(p['coast']), parse(p[g])) for g in ('ocean', 'land')]
        sk = [cr(parse(p['streak']), parse(p[g])) for g in ('ocean', 'land')]
        print(f'  {th}: label on its halo {lab_halo:.2f}; coast on ocean {co[0]:.2f} on land {co[1]:.2f}; streak on bare ocean {sk[0]:.2f} land {sk[1]:.2f}; '
              f'ocean L {lch8(parse(p["ocean"]))[0]:.3f} land L {lch8(parse(p["land"]))[0]:.3f}')
    print('== ramps: gamut, salience order, colour-vision separation')
    for key, r in RAMPS.items():
        for th in BAND:
            cols = [ramp_rgb(key, th, v) for v in samples(key)]
            gam = sum(1 for _, g in cols if not g)
            Ls = [lab8(c)[0] for c, _ in cols]
            lo, hi = r['legend']; ends = (ramp_rgb(key, th, lo)[0], ramp_rgb(key, th, hi)[0])
            sep = {k: math.dist(sim(ends[0], k), sim(ends[1], k)) for k in ('normal', 'deutan', 'protan', 'tritan')}
            seen = [over(c, alpha(key, v), parse(PLATE[th]['ocean'])) for (c, _), v in zip(cols, samples(key))]
            steps = [math.dist(lab8(a), lab8(b)) for a, b in zip(seen[::12], seen[12::12])]
            print(f'  {key:8s} {th:5s} chroma-limited samples {gam:2d}  L {min(Ls):.3f}..{max(Ls):.3f}  ends dE ' +
                  ' '.join(f'{k} {v:.3f}' for k, v in sep.items()) + f'  dE per 1/8 of the legend, as seen over the ocean, min {min(steps[1:] if key in ("wind", "rain", "cloud") else steps):.3f}')
            # the first eighth of wind, rain and cloud is "nothing" fading into the plate, on purpose
            body = steps[1:] if key in ('wind', 'rain', 'cloud') else steps
            ok &= min(sep.values()) >= 0.10 and min(body) >= 0.02
    print('== streak head against the base under it (every layer, every value of the legend, ocean and land, day and night)')
    worst = {}
    for th, p in PLATE.items():
        sk = parse(p['streak'])
        for key in RAMPS:
            for v in samples(key):
                c, _ = ramp_rgb(key, th, v); a = alpha(key, v)
                for g in ('ocean', 'land'):
                    base = over(c, a, parse(p[g]))
                    for night in (0, 1):
                        b = over(p['night'], p['night_max'], base) if night else base
                        head = over(sk, p['streak_a'] * (1 - p['kappa'] * night), b)
                        k = (th, key, night); x = cr(head, b)
                        if k not in worst or x < worst[k][0]: worst[k] = (x, v, g, hx(b), hx(head))
    for (th, key, night), (x, v, g, b, h) in sorted(worst.items()):
        need = 2.5 if night else 3.0; flag = 'ok' if x >= need else 'LOW'; ok &= x >= need
        print(f'  {th:5s} {key:8s} {"night" if night else "day  "} min {x:5.2f} (>= {need}) at {v:g} over {g}: base {b} head {h}  {flag}')
    worst = 0
    for key in RAMPS:
        for th in BAND:
            st = dense(key, th)
            for i in range(400):
                v = st[0][0] + (st[-1][0] - st[0][0]) * i / 399
                j = min(len(st) - 2, max(n for n in range(len(st) - 1) if st[n][0] <= v))
                (v0, c0), (v1, c1) = st[j], st[j + 1]; t = (v - v0) / (v1 - v0)
                app = tuple(round(a + (b - a) * t) for a, b in zip(c0, c1))
                worst = max(worst, math.dist(lab8(app), lab8(ramp_rgb(key, th, v)[0])))
    ok &= worst <= 0.01
    print(f'== --json stops, interpolated in sRGB as app.js rampAt does, against the OKLab path: max dE {worst:.4f} (<= 0.01)')
    print('== the ghost key (focus mode) over every base: a 1.4 px stroke over a 3.4 px halo of the other tone, at rest (72 %)')
    for th, p in PLATE.items():
        low = 99
        for key in RAMPS:
            for v in samples(key):
                c, _ = ramp_rgb(key, th, v)
                for g in ('ocean', 'land', 'outside'):
                    b = over(c, alpha(key, v), parse(p[g])); G = GHOST[th]; halo = over(G['halo'], G['halo_a'], b)
                    stroke = over(parse(G['stroke']), 0.72, halo); low = min(low, cr(stroke, halo))
        ok &= low >= 3; print(f'  {th}: stroke against its own halo, worst {low:.2f} (>= 3)')
    print('== why the light theme does not dim streaks at night: the same worst case with kappa 0.5')
    p = PLATE['light']; low = 99
    for key in RAMPS:
        for v in samples(key):
            c, _ = ramp_rgb(key, 'light', v)
            for g in ('ocean', 'land'):
                b = over(p['night'], p['night_max'], over(c, alpha(key, v), parse(p[g])))
                low = min(low, cr(over(parse(p['streak']), p['streak_a'] * 0.5, b), b))
    print(f'  light, night, kappa 0.5: worst {low:.2f} (below the 2.5 night target, so kappa stays 0)')
    print(f'  highest chroma of any chrome token: {max(lch8(parse(h))[1] for t in TOK.values() for h in t.values()):.4f}')
    print('== streak and tracer colours')
    for th, p in PLATE.items():
        L, C, h = lch8(parse(p['streak'])); print(f'  {th}: streak {p["streak"]} OKLCh {L:.3f} {C:.4f} {h:.0f}; head alpha {p["streak_a"]}; night dimming {p["kappa"]}')
    print('== the ramps as stops (sRGB), per theme')
    for key, r in RAMPS.items():
        for th in BAND:
            print(f'  {key:8s} {th:5s} ' + ' '.join(f'{v:g}:{hx(ramp_rgb(key, th, v)[0])}' for v, *_ in r['stops']))
    print('ALL CHECKS PASS' if ok else 'SOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
