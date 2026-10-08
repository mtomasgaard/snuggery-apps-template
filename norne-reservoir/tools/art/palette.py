"""Norne Reservoir's palette under the house system (ART.md section 2): the chrome tokens, the
signature (the Cut, on the player's track), the plate's ground, the ten data scales printed twice
(the light theme prints salience as darkness, the dark theme as light), the two category sets, the
wells on their casing, the labels on their halo and the ghost key, with every check ART.md quotes.
Standard library only. Run from Template/:  python3 norne-reservoir/tools/art/palette.py [--json]

--json prints what config.json takes: "colormaps" (the light theme, evenly spaced stops, the shape
the app's lut() has always read), "colormapsDark" (the dark theme), "wellColors", and "chart" (the
rates chart's three series per theme, which style.css carries as tokens). The builder
pastes them; tools/check.mjs fails while config.json and this output differ.

Color math: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB, the same
functions as global-weather/tools/art/palette.py, copied so this folder stands alone.

The plate is lit (app.js GRID_FS): the shader multiplies the cell's sRGB color by a light factor,
0.42 + 0.5 lambert + 0.14 fill, so 0.42 on a face turned from both lights, about 0.83 on a top face
from the default camera and at most 1.06 (clamped); cell edges multiply by 0.55. Every plate check
runs over the base colors at FACTORS, and tools/shoot.mjs samples the rendered frames.

Plan 0012 D16 (the owner, 2026-10-07: "i dont like the colortables for pressure, porosity,
permeability etc"): pressure takes matplotlib's plasma and the rock (porosity, both permeabilities, depth and net to gross)
its viridis, the published 256-entry tables (PUBLISHED below), one table for both themes. This is the
owner's exception to the house's tonal budget for data colors (HOUSE 3.2), in this app and its sibling
only: these scales run dark to light in both themes, so they are not printed twice and do not live in
BAND. What the band guaranteed is measured on them directly instead: each table monotone in lightness,
its ends on each theme's ground (the dark end on the dark plate, the light end on white), and the
wells, the labels, the ghost key and the compass over every one of their stops. The saturations (oil,
water, gas), the categories and the layers keep the house's ramps exactly. Plan 0012 D17: the compass
back in the 3D view, checked here over every base like the ghost key.
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
# quality keeps viridis's hue path; net to gross becomes sand; depth blue as charted water depth;
# layers a stone path by K (ordered, so a sequence, not 22 categories).
RAMPS = {
 'oil':      [(0, 0, 0.010, 125), (0.25, 0.28, 0.060, 135), (0.5, 0.54, 0.100, 142), (0.75, 0.78, 0.120, 150), (1, 1, 0.120, 158)],
 'water':    [(0, 0, 0.010, 235), (0.25, 0.28, 0.050, 240), (0.5, 0.54, 0.090, 248), (0.75, 0.78, 0.120, 255), (1, 1, 0.130, 262)],
 'gas':      [(0, 0, 0.010, 45), (0.25, 0.28, 0.070, 40), (0.5, 0.54, 0.120, 33), (0.75, 0.78, 0.150, 28), (1, 1, 0.150, 24)],
 'layers':   [(0, 0.10, 0.030, 75), (0.5, 0.55, 0.060, 55), (1, 1, 0.080, 35)],
}
N_STOPS = 33                                     # evenly spaced stops in config.json, as lut() reads them

# ── plan 0012 D16: plasma and viridis, the owner's exception to the tonal budget ──
# The published tables: matplotlib 3.9.4, lib/matplotlib/_cm_listed.py, _plasma_data and _viridis_data
# (Nathaniel Smith and Stefan van der Walt's colormaps, viridis with Eric Firing; the file carries no
# license note of its own; matplotlib's is the PSF-style Matplotlib License), 256 sRGB entries each, rounded
# here to 8 bits. Read from the copy on the build machine (build/venv-decks/lib/python3.9/site-packages/
# matplotlib/_cm_listed.py, sha256 86980cc7b6e3c49c799e5d4f6d0bda0835011d07fc9e3691accda231a05e64e3).
# Low values at entry 0 (the dark end), high at entry 255 (the light end), in both themes.
MPL = {
 'plasma': ('0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f0596'
    '31059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a1'
    '4c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a7'
    '6600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a8'
    '7e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a2'
    '9511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296'
    'aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488'
    'bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679'
    'cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586a'
    'da5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5d'
    'e66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4f'
    'f0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441'
    'f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33'
    'fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328'
    'fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25'
    'f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921'),
 'viridis': ('44015444025645045745055946075a46085c460a5d460b5e470d60470e61471063471164471365481467481668481769'
    '48186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a'
    '472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f85'
    '4240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b'
    '3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d'
    '33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e'
    '2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e'
    '26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d'
    '21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f88'
    '1fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad81'
    '28ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc74'
    '3fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc863'
    '5ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d'
    '84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32'
    'addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21a'
    'd8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725'),
}
PUBLISHED = {'pressure': 'plasma', 'rock': 'viridis', 'sand': 'viridis', 'depth': 'viridis'}
SCALES = ('oil', 'water', 'gas', 'pressure', 'rock', 'sand', 'depth', 'layers')                     # config.json's order
def mpl(name, t):
    # the table at t, straight sRGB interpolation between its two nearest entries
    s = MPL[name]; x = max(0.0, min(1.0, t)) * 255; k = min(int(x), 254); f = x - k
    a, b = (tuple(int(s[6 * i + 2 * c:6 * i + 2 * c + 2], 16) for c in range(3)) for i in (k, k + 1))
    return tuple(round(a[c] * (1 - f) + b[c] * f) for c in range(3))

# The compass (plan 0012 D17): a 36 px disc of the plate's ground at DISC_A, the north arm --ink, the south
# arm --ink-3, the N --ink at 11 px 650, over any part of the model.
DISC_A = 0.80

# Categories: one set for both themes, inside both bands' overlap (L 0.42 to 0.88). Formations in
# the deck's order (Not is a shale with no active cell in this grid, so it is never drawn; it is
# checked anyway). Segments are FIPNUM's four fault segments (region = formation x segment).
CATS = {
 'formations': [('Garn', oklch(0.860, 0.120, 88)), ('Not', oklch(0.790, 0.000, 0)), ('Ile', oklch(0.640, 0.095, 195)),
                ('Tofte', oklch(0.580, 0.140, 35)), ('Tilje', oklch(0.460, 0.120, 285))],
 'segments':   [('1', oklch(0.840, 0.110, 95)), ('2', oklch(0.660, 0.100, 215)), ('3', oklch(0.570, 0.140, 30)),
                ('4', oklch(0.450, 0.110, 295))],
}

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
    if key in PUBLISHED: return mpl(PUBLISHED[key], t), True
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
    for key in SCALES:
        out['colormaps'][key] = stops(key, 'light'); out['colormapsDark'][key] = stops(key, 'dark')
    for key, cats in CATS.items():
        out['colormaps'][key] = out['colormapsDark'][key] = [hx(c) for _, c in cats]
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
    print('== the house ramps\' nothing end on the light ground (the D16 tables are measured in their own block below)')
    print(f'   {hx(GROUND["light"])}: unshaded, and lit at a top face ({TOP}) and at the brightest face ({brightest:.3f})')
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

    print('== the scales: gamut, lightness order, color-vision ends, steps per eighth as rendered on a top face')
    print('   (the house ramps: lightness falls with the value in the light theme and rises in the dark; the D16 tables rise in both)')
    for key in SCALES:
        for th in BAND:
            cols = [ramp_rgb(key, th, k / 96) for k in range(97)]
            gam = sum(1 for _, g in cols if not g); Ls = [lab8(c)[0] for c, _ in cols]
            mono = all((b <= a + 1e-3) if th == 'light' and key not in PUBLISHED else (b >= a - 1e-3) for a, b in zip(Ls, Ls[1:]))
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

    print('== D16: the published tables\' ends on each theme\'s ground (no band binds them; HOUSE 3.2, the owner\'s exception)')
    print(f'   unshaded (the legend\'s bar, the section\'s cells), and lit: a face from both lamps (0.42), a top face ({TOP}), the brightest ({brightest:.3f}); a cell edge multiplies by 0.55 more')
    for name in sorted(set(PUBLISHED.values())):
        lo, hi = mpl(name, 0), mpl(name, 1)
        for th, end, fs in (('dark', lo, (1.0, 0.42, 0.42 * 0.55, TOP)), ('light', hi, (1.0, TOP, brightest)), ('dark', hi, (1.0, TOP)), ('light', lo, (1.0, 0.42 * 0.55))):
            g = GROUND[th]; row = []; worst = 9
            for f in fs:
                c = end if f == 1.0 else shade(end, f); d = dE(c, g); worst = min(worst, d)
                row.append(f'{f:.3f} {hx(c)} dE {d:.3f} {cr(c, g):.2f}:1')
            which = 'dark end' if end == lo else 'light end'
            print(f'  {name:7s} {which:9s} on the {th:5s} ground {hx(g)}: ' + '; '.join(row) + need(worst >= 0.03, f'{name} {which} off the {th} ground'))
    for th in BAND:
        r = cr(parse(TOK[th]['strong']), GROUND[th])
        print(f'  {th}: where an end sits near the ground the legend\'s bar keeps its --line-strong frame at 60 % and the section its 1.5 px --line-strong rim ({r:.2f}:1 on the plate)')

    print('== categories: pairwise dE in four visions (>= 0.10), each off both grounds')
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

    print('== the wells: the core against its casing composited over every base (mark >= 3), and the roles apart')
    names = list(WELLS)
    for th in BAND:
        cas = over(parse(CASING[0]), CASING[1], GROUND[th])
        res = []
        for n in names:
            c = cr(WELLS[n], cas); res.append(f'{n} {hx(WELLS[n])} on casing {c:.2f}' + (need(c >= 3, n) if n in DRAWN_FULL else ' (faint on purpose)'))
        print(f'  {th}: ' + '; '.join(res))
        worst = (99, '')
        bases = [shade(ramp_rgb(k, th, i / 32)[0], f) for k in SCALES for i in range(33) for f in FACTORS]
        bases += [shade(c, f) for cats in CATS.values() for _, c in cats for f in FACTORS] + [GROUND[th]]
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
        bases = [shade(ramp_rgb(k, th, i / 32)[0], f) for k in SCALES for i in range(33) for f in FACTORS]
        bases += [shade(c, f) for cats in CATS.values() for _, c in cats for f in FACTORS] + [GROUND[th]]
        for b in bases:
            halo = over(parse(lb['halo']), lb['halo_a'], b); x = cr(parse(lb['ink']), halo)
            if x < worst[0]: worst = (x, hx(b))
        print(f'  {th}: ink {lb["ink"]} on halo {lb["halo"]}: worst {worst[0]:.2f} over {worst[1]}{need(worst[0] >= 4.5, "label")}')

    print('== the ghost key (focus mode): a 1.4 px stroke at rest (72 %) over a 3.4 px halo, over every base (>= 3)')
    for th in BAND:
        G = GHOST[th]; low = 99
        bases = [shade(ramp_rgb(k, th, i / 32)[0], f) for k in SCALES for i in range(33) for f in FACTORS] + [GROUND[th]]
        for b in bases:
            halo = over(G['halo'], G['halo_a'], b); stroke = over(parse(G['stroke']), 0.72, halo); low = min(low, cr(stroke, halo))
        print(f'  {th}: worst {low:.2f}{need(low >= 3, "ghost")}')

    print(f'== the compass (D17): a disc of the plate\'s ground at {DISC_A} under the needle, over every base the plate shows (arms >= 3, the N >= 4.5)')
    for th in BAND:
        t = TOK[th]; low = {'north arm (--ink)': 99, 'south arm (--ink-3)': 99, 'N (--ink)': 99}; at = {}
        bases = [shade(ramp_rgb(k, th, i / 32)[0], f) for k in SCALES for i in range(33) for f in FACTORS]
        bases += [shade(c, f) for cats in CATS.values() for _, c in cats for f in FACTORS] + [GROUND[th]]
        for b in bases:
            disc = over(GROUND[th], DISC_A, b)
            for n, tok in (('north arm (--ink)', 'ink'), ('south arm (--ink-3)', 'ink3'), ('N (--ink)', 'ink')):
                x = cr(parse(t[tok]), disc)
                if x < low[n]: low[n] = x; at[n] = hx(b)
        two = cr(parse(t['ink']), parse(t['ink3']))
        print(f'  {th}: ' + ', '.join(f'{n} worst {v:.2f} over {at[n]}' + need(v >= (4.5 if n.startswith('N') else 3), 'compass ' + n) for n, v in low.items())
              + f'; the arms apart, --ink against --ink-3, {two:.2f}:1 (the outline and the N tell them apart too)')

    print('== the scales as stops (sRGB), per theme: t 0, 0.25, 0.5, 0.75, 1')
    for key in SCALES:
        for th in BAND:
            print(f'  {key:8s} {th:5s} ' + ' '.join(hx(ramp_rgb(key, th, t)[0]) for t in (0, 0.25, 0.5, 0.75, 1)))
    print('ALL CHECKS PASS' if ok else 'SOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
