"""Volve's palette under the house system (ART.md section 2): Norne Reservoir's, carried to a second
field (the chrome tokens, the signature (the Cut, on the player's track), the plate's ground, the data
scales printed twice (the light theme prints salience as darkness, the dark theme as light), the wells
on their casing, the labels on their halo and the ghost key), less what Volve's deck has no data for
(formations, net to gross), plus the fluid-in-place regions colored so no two that touch share a color,
and the seismic's two display ramps, each symmetric about zero, with every check ART.md quotes.
Standard library only. Run from Template/:  python3 volve/tools/art/palette.py [--json]

--json prints what config.json takes: "colormaps" (the light theme, evenly spaced stops, the shape
the app's lut() has always read), "colormapsDark" (the dark theme), "wellColors", and "chart" (the
rates chart's three series per theme, which style.css carries as tokens). The seismic ramps go in the
same two maps as seismicGray and seismicRedBlue: 21 stops over -1..1 of the clip, the 11th zero. The builder
pastes them; tools/check.mjs fails while config.json and this output differ.

Color math: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB, the same
functions as global-weather/tools/art/palette.py, copied so this folder stands alone.

The plate is lit (app.js GRID_FS): the shader multiplies the cell's sRGB color by a light factor,
0.42 + 0.5 lambert + 0.14 fill, so 0.42 on a face turned from both lights, about 0.83 on a top face
from the default camera and at most 1.06 (clamped); cell edges multiply by 0.55. Every plate check
runs over the base colors at FACTORS, and tools/shoot.mjs samples the rendered frames.
"""
import json, math, sys

# ── color math ───────────────────────────────────────────────────────────────
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
def gamut(lab):
    # keeps L and hue and lowers chroma until the color is inside sRGB
    L, a, b = lab; C = math.hypot(a, b); mapped = False
    while not in_gamut(lab2lin(L, a, b)) and C > 1e-4:
        C *= 0.98; h = math.atan2(b, a); a, b = C * math.cos(h), C * math.sin(h); mapped = True
    return rgb8(lab2lin(L, a, b)), not mapped
def oklch(L, C, h): return gamut(lch2lab(L, C, h))[0]
CVD = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
       'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
       'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
VISIONS = ('normal', 'deutan', 'protan', 'tritan')
def sim(rgb, kind):
    lin = [dec(c / 255) for c in rgb]
    if kind != 'normal': lin = [min(1, max(0, sum(CVD[kind][i][j] * lin[j] for j in range(3)))) for i in range(3)]
    return lin2lab(*lin)
def dE(a, b, kind='normal'): return math.dist(sim(a, kind), sim(b, kind))
def shade(rgb, f): return tuple(min(255, round(c * f)) for c in rgb)   # the shader's multiply, in the texture's sRGB numbers

# ── the house chrome tokens (HOUSE 3.1), copied exactly; the light page white (HOUSE 12, plan 0012 D6) ──
TOK = {
 'light': dict(page='#ffffff', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72',
               line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f',
               line='#2a373c', strong='#64757b'),
}

# ── the signature: the Cut, on the player's track (ART.md section 1) ─────────
# Each month's column is the liquid the wells lifted per day: oil from the baseline up in the cut's
# ink, water stacked on it as the same ink at WATER_A, and the liquid's top edge a 1 px --ink-3
# line. The ink is a near-neutral olive (crude, h 125) at the far end of each theme's range, beyond
# --ink, and not a hue of any data scale.
CUT = {'light': oklch(0.190, 0.020, 125), 'dark': oklch(0.962, 0.020, 125)}
WATER_A = {'light': 0.30, 'dark': 0.34}
OTHERS = {'Global Weather streak': {'light': '#0b171d', 'dark': '#f4f2ea'},
          'Milky Way reach': {'light': oklch(0.185, 0.020, 255), 'dark': oklch(0.965, 0.010, 255)},
          'Besseggen burn': {'light': '#1b110b', 'dark': '#fcf2e5'}}

# ── the plate ────────────────────────────────────────────────────────────────
# Light: white, the page itself (plan 0012 D6; the film base #e8eef0 before it). Dark: a darker
# slate under the print, so the dark page (L 0.224) frames it.
GROUND = {'light': parse('#ffffff'), 'dark': oklch(0.180, 0.012, 225)}
FACTORS = (0.42, 0.62, 0.83, 1.0, 1.06)
TOP = 0.83                                       # a top face from the default camera
# The data band: L at salience 0 and at salience 1, per theme. Salience 0 is the pale (light) or
# dark (dark) body that stands just off the ground; salience 1 is the far end the data may reach.
BAND = {'light': (0.975, 0.420), 'dark': (0.330, 0.880)}

# One hue path per scale, (t, s, C, h): t along the scale's own axis (linear or log, as config.json
# says), s the salience, C and h OKLCh. Hue logic kept: oil green, water blue, gas red (the
# reservoir-display convention the stock app used); pressure keeps magma's violet-to-orange; rock
# quality keeps viridis's hue path; depth blue as charted water depth; layers a stone path by K
# (ordered, so a sequence, not 63 categories). Volve's deck has no net to gross (its NTG is 1
# everywhere), so Norne's sand scale is not carried.
RAMPS = {
 'oil':      [(0, 0, 0.010, 125), (0.25, 0.28, 0.060, 135), (0.5, 0.54, 0.100, 142), (0.75, 0.78, 0.120, 150), (1, 1, 0.120, 158)],
 'water':    [(0, 0, 0.010, 235), (0.25, 0.28, 0.050, 240), (0.5, 0.54, 0.090, 248), (0.75, 0.78, 0.120, 255), (1, 1, 0.130, 262)],
 'gas':      [(0, 0, 0.010, 45), (0.25, 0.28, 0.070, 40), (0.5, 0.54, 0.120, 33), (0.75, 0.78, 0.150, 28), (1, 1, 0.150, 24)],
 'pressure': [(0, 0, 0.030, 300), (0.25, 0.28, 0.080, 320), (0.5, 0.54, 0.120, 350), (0.75, 0.78, 0.140, 25), (1, 1, 0.130, 55)],
 'rock':     [(0, 0, 0.030, 295), (0.25, 0.28, 0.070, 275), (0.5, 0.54, 0.090, 225), (0.75, 0.78, 0.100, 175), (1, 1, 0.110, 135)],
 'depth':    [(0, 0, 0.030, 195), (0.5, 0.54, 0.080, 230), (1, 1, 0.120, 268)],
 'layers':   [(0, 0.10, 0.030, 75), (0.5, 0.55, 0.060, 55), (1, 1, 0.080, 35)],
}
N_STOPS = 33                                     # evenly spaced stops in config.json, as lut() reads them

# Categories: one set for both themes, inside both bands' overlap (L 0.42 to 0.88). Volve's eleven
# fluid-in-place regions (FIPNUM 1 to 11, lateral blocks through every layer) take four colors, Norne's
# four segment colors, assigned so that no two regions whose columns touch on the map share one (the
# map's adjacency, measured from ijk.bin and static.bin: 21 touching pairs). The card and the legend
# name each region by its number, so a color shared by two regions apart never stands for both.
CATS = {
 'regions': [('A', oklch(0.840, 0.110, 95)), ('B', oklch(0.660, 0.100, 215)), ('C', oklch(0.570, 0.140, 30)),
             ('D', oklch(0.450, 0.110, 295))],
}
REGION_COLOR = 'ABCACABBDCC'                     # region n (from 1) takes CATS['regions'][that letter]
REGION_TOUCH = ['1-11', '1-2', '1-3', '1-8', '1-9', '2-10', '2-3', '2-4', '2-5', '2-6', '3-4', '4-5', '5-6', '5-7',
                '5-9', '6-10', '6-7', '6-9', '7-9', '8-11', '8-9']

# The seismic's two display ramps (plan 0012 D11): over -1..1 of the clip, symmetric about zero. Gray is
# a straight lightness ramp, negative pale and positive dark in the light theme (a negative print, as
# the plate is) and the other way in the dark; red and blue keeps zero near the ground and lets
# salience grow with |amplitude| alike on both sides, positive red and negative blue.
SEIS_N = 21
SEIS = {
 'seismicGray': {'light': lambda t: (0.585 - 0.395 * t, 0.0, 230), 'dark': lambda t: (0.560 + 0.390 * t, 0.0, 230)},
 'seismicRedBlue': {'light': lambda t: (0.975 - 0.555 * abs(t), 0.155 * abs(t), 27 if t >= 0 else 258),
                    'dark': lambda t: (0.260 + 0.560 * abs(t), 0.150 * abs(t), 27 if t >= 0 else 258)},
}
def seis_rgb(key, th, t): return gamut(lch2lab(*SEIS[key][th](t)))
def seis_stops(key, th): return [hx(seis_rgb(key, th, -1 + 2 * k / (SEIS_N - 1))[0]) for k in range(SEIS_N)]

# The wells: a role color on a casing, drawn as today (a see-through pass, then the casing grown
# 1.25 px each side at 0.85, then the core). Injectors are also dashed and a shut well is thin and
# half see-through, so color is never the role's only carrier. One set for both themes.
WELLS = {'producer': oklch(0.900, 0.150, 150), 'waterInjector': oklch(0.790, 0.110, 245),
         'gasInjector': oklch(0.720, 0.140, 30), 'shut': oklch(0.55, 0.005, 230)}
DRAWN_FULL = ('producer', 'waterInjector', 'gasInjector')   # a shut well is thin and half see-through on purpose
CASING = ('#0f1c23', 0.85)

# The rates chart in the controls sheet, on --page: each fluid's own scale at CHART_T, produced
# solid and injected dashed (the dash, not the color, says injected). Oil and water share a panel,
# so they also differ in lightness: oil at its scale's far end, water a step nearer the page.
CHART_T = {'oil': 1.0, 'water': 0.70, 'gas': 0.85}
CHART = ('oil', 'water', 'gas')

LABEL = {'light': dict(ink='#0f1c23', halo='#ffffff', halo_a=0.85), 'dark': dict(ink='#e6edee', halo=None, halo_a=0.85)}
GHOST = {'light': dict(stroke='#0f1c23', halo=(246, 249, 250), halo_a=0.60), 'dark': dict(stroke='#f2f4f1', halo=(10, 16, 19), halo_a=0.70)}

def nrm3(v): l = math.sqrt(sum(x * x for x in v)); return tuple(x / l for x in v)
def ramp_rgb(key, th, t):
    st = RAMPS[key]; t = max(0.0, min(1.0, t))
    for (t0, s0, c0, h0), (t1, s1, c1, h1) in zip(st, st[1:]):
        if t0 <= t <= t1:
            u = 0 if t1 == t0 else (t - t0) / (t1 - t0)
            L0, L1 = BAND[th]; p = lch2lab(L0 + (L1 - L0) * s0, c0, h0); q = lch2lab(L0 + (L1 - L0) * s1, c1, h1)
            return gamut(tuple(p[i] + (q[i] - p[i]) * u for i in range(3)))
def stops(key, th): return [hx(ramp_rgb(key, th, k / (N_STOPS - 1))[0]) for k in range(N_STOPS)]
def lut(hexes):
    # app.js lut(): 256 entries, straight sRGB interpolation between evenly spaced stops, rounded
    s = [parse(h) for h in hexes]; out = []
    for i in range(256):
        t = i / 255 * (len(s) - 1); k = min(int(t), len(s) - 2); f = t - k
        out.append(tuple(round(s[k][c] * (1 - f) + s[k + 1][c] * f) for c in range(3)))
    return out

def json_out():
    out = {'colormaps': {}, 'colormapsDark': {}}
    for key in RAMPS:
        out['colormaps'][key] = stops(key, 'light'); out['colormapsDark'][key] = stops(key, 'dark')
    col = dict(CATS['regions'])
    out['colormaps']['regions'] = out['colormapsDark']['regions'] = [hx(col[c]) for c in REGION_COLOR]
    for key in SEIS:
        out['colormaps'][key] = seis_stops(key, 'light'); out['colormapsDark'][key] = seis_stops(key, 'dark')
    out['wellColors'] = {k: hx(v) for k, v in WELLS.items()}; out['wellColors']['outline'] = CASING[0]
    out['chart'] = {th: {k: hx(ramp_rgb(k, th, CHART_T[k])[0]) for k in CHART} for th in BAND}
    return out

def main():
    if '--json' in sys.argv: print(json.dumps(json_out(), indent=2)); return
    ok = True
    def need(cond, label):
        nonlocal ok
        ok &= bool(cond)
        return '' if cond else f'  <-- FAIL {label}'
    LABEL['dark']['halo'] = hx(GROUND['dark'])
    print('== chrome tokens: WCAG 2 contrast (text >= 4.5, control edges >= 3)')
    for th, t in TOK.items():
        res = []
        for a in ('ink', 'ink2', 'ink3'):
            for b in ('page', 'sheet'):
                c = cr(parse(t[a]), parse(t[b])); res.append(f'{a} on {b} {c:.2f}{need(c >= 4.5, a)}')
        e = cr(parse(t['strong']), parse(t['page'])); res.append(f'line-strong on page {e:.2f}{need(e >= 3, "strong")}')
        print(f'  {th}: ' + ', '.join(res))
    hc = max(lch8(parse(h))[1] for t in TOK.values() for h in t.values())
    print(f'  highest chroma of any chrome token: {hc:.4f}{need(hc <= 0.024, "chroma")}')

    print('== the signature: the Cut on the track, over the player\'s ground (--page)')
    for th, t in TOK.items():
        ink, page = CUT[th], parse(t['page']); water = over(ink, WATER_A[th], page)
        L, C, h = lch8(ink); Li = lch8(parse(t['ink']))[0]
        far = L < Li if th == 'light' else L > Li
        c_ink = cr(ink, page); c_water = cr(water, page); c_iw = cr(ink, water)
        c_top = cr(parse(t['ink3']), page); c_top_w = cr(parse(t['ink3']), water)
        ring = cr(page, ink); thumb = cr(parse(t['ink']), page)
        print(f'  {th}: ink {hx(ink)} OKLCh ({L:.3f}, {C:.4f}, {h:.0f}), beyond --ink (L {Li:.3f}): {far}{need(far and C <= 0.021, "far end")}')
        print(f'         oil (ink) on page {c_ink:.2f}{need(c_ink >= 3, "ink")}; water (ink at {WATER_A[th]}) {hx(water)} on page {c_water:.2f}{need(c_water >= 1.4, "water seen")}; '
              f'oil against water {c_iw:.2f}{need(c_iw >= 3, "oil/water")}')
        print(f'         liquid line (--ink-3) on page {c_top:.2f}{need(c_top >= 3, "line")}, on the water {c_top_w:.2f}; thumb ring (--page) on the ink {ring:.2f}{need(ring >= 3, "ring")}; thumb (--ink) on page {thumb:.2f}')
        for n, sig in OTHERS.items():
            o = sig[th] if isinstance(sig[th], tuple) else parse(sig[th])
            print(f'         dE to {n} ({th}) {dE(ink, o):.3f}, hue {lch8(o)[2]:.0f}')

    print('== the plate: its ground and the body standing off it')
    for th in BAND:
        g = GROUND[th]; L, C, h = lch8(g)
        body = shade(ramp_rgb('oil', th, 0)[0], TOP)
        sep = dE(body, g); con = cr(body, g)
        print(f'  {th}: ground {hx(g)} OKLCh ({L:.3f}, {C:.4f}, {h:.0f}); band L {BAND[th][0]}..{BAND[th][1]}; '
              f'a salience-0 top face {hx(body)} against the ground dE {sep:.3f}, {con:.2f}:1{need(sep >= 0.03, "body off ground")}')

    # The scales' "nothing" end (salience 0) was tuned to fade into the gray ground; on white it is
    # measured where it is drawn: unshaded (the legend's bar, the section's cells) and lit (a face of the
    # 3D view at the brightest factor the shader reaches, and at a top face from the default camera).
    # The view's cell edges and the section's 1.5 px --line-strong rim carry the body's edge.
    L1, L2 = nrm3((0.35, 0.75, 0.55)), nrm3((-0.6, -0.2, 0.8))
    brightest = 0.42 + math.sqrt(0.5 ** 2 + 0.14 ** 2 + 2 * 0.5 * 0.14 * abs(sum(a * b for a, b in zip(L1, L2))))
    print(f'== the scales\' nothing end on the light ground {hx(GROUND["light"])}: unshaded, and lit at a top face ({TOP}) and at the brightest face ({brightest:.3f})')
    worst = (9, '')
    for key in RAMPS:
        c0 = ramp_rgb(key, 'light', 0)[0]
        row = []
        for f in (1.0, TOP, brightest):
            c = c0 if f == 1.0 else shade(c0, f)
            row.append(f'{hx(c)} dE {dE(c, GROUND["light"]):.3f} {cr(c, GROUND["light"]):.2f}:1')
            if f != 1.0 and dE(c, GROUND['light']) < worst[0]: worst = (dE(c, GROUND['light']), f'{key} lit at {f:.2f}')
        print(f'  {key:8s} unshaded {row[0]}; top face {row[1]}; brightest {row[2]}')
    rim = cr(parse(TOK['light']['strong']), GROUND['light'])
    print(f'    worst lit: {worst[0]:.3f} ({worst[1]}){need(worst[0] >= 0.03, "nothing end lit, off the ground")}; '
          f'unshaded, the section\'s rim (--line-strong) on the ground {rim:.2f}:1{need(rim >= 3, "section rim")}')

    print('== the scales: gamut, salience order, color-vision ends, steps per eighth as rendered on a top face')
    for key in RAMPS:
        for th in BAND:
            cols = [ramp_rgb(key, th, k / 96) for k in range(97)]
            gam = sum(1 for _, g in cols if not g); Ls = [lab8(c)[0] for c, _ in cols]
            mono = all((b <= a + 1e-3) if th == 'light' else (b >= a - 1e-3) for a, b in zip(Ls, Ls[1:]))
            e0, e1 = cols[0][0], cols[-1][0]
            sep = {k: dE(e0, e1, k) for k in VISIONS}
            seen = [shade(c, TOP) for c, _ in cols]
            steps = [math.dist(lab8(a), lab8(b)) for a, b in zip(seen[::12], seen[12::12])]
            body = steps
            # the stored stops, interpolated as lut() does, against the OKLab path
            L256 = lut(stops(key, th)); worst = max(math.dist(lab8(L256[i]), lab8(ramp_rgb(key, th, i / 255)[0])) for i in range(256))
            print(f'  {key:8s} {th:5s} chroma-limited {gam:2d}  L {min(Ls):.3f}..{max(Ls):.3f} monotone {mono}  ends dE ' +
                  ' '.join(f'{k} {v:.3f}' for k, v in sep.items()) + f'  min step per 1/8 {min(body):.3f}  lut vs path {worst:.4f}'
                  + need(mono and min(sep.values()) >= 0.10 and min(body) >= 0.02 and worst <= 0.01, key))

    print('== categories: the four region colors, pairwise dE in four visions (>= 0.10), each off both grounds')
    for key, cats in CATS.items():
        low = (9, '')
        for i in range(len(cats)):
            for j in range(i + 1, len(cats)):
                for k in VISIONS:
                    d = dE(cats[i][1], cats[j][1], k)
                    if d < low[0]: low = (d, f'{cats[i][0]} / {cats[j][0]} {k}')
        offs = min(dE(shade(c, TOP), GROUND[th]) for _, c in cats for th in BAND)
        Ls = ', '.join(f'{n} {hx(c)} L {lch8(c)[0]:.2f}' for n, c in cats)
        print(f'  {key}: {Ls}')
        print(f'    worst pair {low[0]:.3f} ({low[1]}){need(low[0] >= 0.10, key)}; nearest a ground {offs:.3f}{need(offs >= 0.10, key + " off ground")}')

    print('== the regions: no two that touch on the map share a color')
    same = [p for p in REGION_TOUCH if REGION_COLOR[int(p.split('-')[0]) - 1] == REGION_COLOR[int(p.split('-')[1]) - 1]]
    print(f'  {len(REGION_TOUCH)} touching pairs, {len(same)} sharing a color{need(not same and len(REGION_COLOR) == 11, "regions")}' + (': ' + ', '.join(same) if same else ''))

    print('== the seismic ramps: symmetric about zero, monotone in lightness on each side, the ends apart in four visions')
    for key in SEIS:
        for th in BAND:
            st = [seis_rgb(key, th, -1 + 2 * k / 200)[0] for k in range(201)]
            Ls = [lab8(c)[0] for c in st]
            gam = sum(1 for k in range(201) if not seis_rgb(key, th, -1 + 2 * k / 200)[1])
            if key == 'seismicGray':
                mono = all((b <= a + 1e-3) if th == 'light' else (b >= a - 1e-3) for a, b in zip(Ls, Ls[1:]))
                sym = max(abs((Ls[100 + k] - Ls[100]) + (Ls[100 - k] - Ls[100])) for k in range(101))
                ends = min(dE(st[0], st[-1], v) for v in VISIONS)
                ok_ = mono and sym <= 0.01 and ends >= 0.5
                print(f'  {key:15s} {th:5s} L {min(Ls):.3f}..{max(Ls):.3f}, zero L {Ls[100]:.3f}, monotone {mono}, |L(t) - L(0)| against |L(-t) - L(0)| within {sym:.4f}, '
                      f'ends dE {ends:.3f}, chroma-limited {gam}{need(ok_, key)}')
            else:
                mono = all((Ls[100 + k + 1] <= Ls[100 + k] + 1e-3) if th == 'light' else (Ls[100 + k + 1] >= Ls[100 + k] - 1e-3) for k in range(100)) \
                    and all((Ls[100 - k - 1] <= Ls[100 - k] + 1e-3) if th == 'light' else (Ls[100 - k - 1] >= Ls[100 - k] - 1e-3) for k in range(100))
                sym = max(abs(Ls[100 + k] - Ls[100 - k]) for k in range(101))
                sides = min(dE(st[100 + k], st[100 - k], v) for k in (50, 100) for v in VISIONS)
                zero = dE(st[100], GROUND[th])
                ok_ = mono and sym <= 0.02 and sides >= 0.10
                print(f'  {key:15s} {th:5s} L {min(Ls):.3f}..{max(Ls):.3f}, zero {hx(st[100])} (dE {zero:.3f} off the plate), monotone away from zero {mono}, '
                      f'L(t) against L(-t) within {sym:.4f}, + against - at 0.5 and 1 worst dE {sides:.3f}, chroma-limited {gam}{need(ok_, key)}')

    print('== the wells: the core against its casing composited over every base (mark >= 3), and the roles apart')
    names = list(WELLS)
    for th in BAND:
        cas = over(parse(CASING[0]), CASING[1], GROUND[th])
        res = []
        for n in names:
            c = cr(WELLS[n], cas); res.append(f'{n} {hx(WELLS[n])} on casing {c:.2f}' + (need(c >= 3, n) if n in DRAWN_FULL else ' (faint on purpose)'))
        print(f'  {th}: ' + '; '.join(res))
        worst = (99, '')
        bases = [shade(ramp_rgb(k, th, i / 32)[0], f) for k in RAMPS for i in range(33) for f in FACTORS]
        bases += [shade(c, f) for cats in CATS.values() for _, c in cats for f in FACTORS] + [GROUND[th]]
        bases += [parse(h) for k in SEIS for h in seis_stops(k, th)]   # the section draws the wells over the seismic
        for b in bases:
            cs = over(parse(CASING[0]), CASING[1], b)
            for n in DRAWN_FULL:
                x = cr(WELLS[n], cs)
                if x < worst[0]: worst = (x, f'{n} over {hx(b)}')
        print(f'    worst core against its casing over any base, producers and injectors: {worst[0]:.2f} ({worst[1]}){need(worst[0] >= 3, "well vs base")}; '
              'a shut well is drawn at 60 % of the width and half see-through, so its weight carries its role')
    low = (9, '')
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            for k in VISIONS:
                d = dE(WELLS[names[i]], WELLS[names[j]], k)
                if d < low[0]: low = (d, f'{names[i]} / {names[j]} {k}')
    print(f'  roles, worst pair {low[0]:.3f} ({low[1]}){need(low[0] >= 0.10, "roles")} (the dash and the shut well\'s weight carry the role too)')

    print('== the rates chart on --page: each series against the page (mark >= 3), oil and water apart (>= 0.10)')
    for th, t in TOK.items():
        cols = {k: ramp_rgb(k, th, CHART_T[k])[0] for k in CHART}
        res = []
        for k, c in cols.items():
            x = cr(c, parse(t['page'])); res.append(f'{k} {hx(c)} {x:.2f}{need(x >= 3, "chart " + k)}')
        # oil and water share the liquids panel; gas has a panel of its own, so it is never told apart by color
        low = min(dE(cols['oil'], cols['water'], v) for v in VISIONS)
        print(f'  {th}: ' + ', '.join(res) + f'; oil against water, the one pair sharing a panel, worst {low:.3f}{need(low >= 0.10, "chart pair")}')
    print('== labels on the plate (well and formation names): ink on a 3 px halo at 0.85, over every base (text >= 4.5)')
    for th in BAND:
        lb = LABEL[th]; worst = (99, '')
        bases = [shade(ramp_rgb(k, th, i / 32)[0], f) for k in RAMPS for i in range(33) for f in FACTORS]
        bases += [shade(c, f) for cats in CATS.values() for _, c in cats for f in FACTORS] + [GROUND[th]]
        bases += [parse(h) for k in SEIS for h in seis_stops(k, th)]   # names on the section stand over the seismic
        for b in bases:
            halo = over(parse(lb['halo']), lb['halo_a'], b); x = cr(parse(lb['ink']), halo)
            if x < worst[0]: worst = (x, hx(b))
        print(f'  {th}: ink {lb["ink"]} on halo {lb["halo"]}: worst {worst[0]:.2f} over {worst[1]}{need(worst[0] >= 4.5, "label")}')

    print('== the ghost key (focus mode): a 1.4 px stroke at rest (72 %) over a 3.4 px halo, over every base (>= 3)')
    for th in BAND:
        G = GHOST[th]; low = 99
        bases = [shade(ramp_rgb(k, th, i / 32)[0], f) for k in RAMPS for i in range(33) for f in FACTORS] + [GROUND[th]]
        for b in bases:
            halo = over(G['halo'], G['halo_a'], b); stroke = over(parse(G['stroke']), 0.72, halo); low = min(low, cr(stroke, halo))
        print(f'  {th}: worst {low:.2f}{need(low >= 3, "ghost")}')

    print('== the scales as stops (sRGB), per theme: t 0, 0.25, 0.5, 0.75, 1')
    for key in RAMPS:
        for th in BAND:
            print(f'  {key:8s} {th:5s} ' + ' '.join(hx(ramp_rgb(key, th, t)[0]) for t in (0, 0.25, 0.5, 0.75, 1)))
    print('ALL CHECKS PASS' if ok else 'SOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
