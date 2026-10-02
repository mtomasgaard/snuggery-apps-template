"""World Oil & Gas's palette under the house system (ART.md section 2; Template/HOUSE.md section 3): the
chrome tokens, the plate printed twice (the sea and its depth bands, plain land, the map's edge, the
borders), the countries' production ramp, the fields' four fuel categories, the details chart's two
series, the signature (the Ledger: the year's world output as one ink strip of national shares, on
--page under the plate) and the ghost key, with every check ART.md quotes. Standard library only.
Run from Template/:

    python3 world-oil-gas/tools/art/palette.py           # the checks; ends ALL CHECKS PASS or SOME CHECKS FAIL
    python3 world-oil-gas/tools/art/palette.py --json    # what app.js's THEMES takes, pasted, never retyped

Color math: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB: the same
functions as global-weather/tools/art/palette.py and shelf-atlas/tools/art/palette.py, copied so that
this folder stands alone.
"""
import json, math, sys

# -- color math (copied from shelf-atlas/tools/art/palette.py) ----------------------------------------
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
VISIONS = ('normal', 'deutan', 'protan', 'tritan')
def sim(rgb, kind):
    lin = [dec(c / 255) for c in rgb]
    if kind != 'normal': lin = [min(1, max(0, sum(CVD[kind][i][j] * lin[j] for j in range(3)))) for i in range(3)]
    return lin2lab(*lin)
def gamut_map(lab):
    # keeps L and hue and lowers chroma until inside sRGB: a color that asks for more chroma than the
    # screen has at that lightness is printed at the most the screen has
    L, a, b = lab; C = math.hypot(a, b); mapped = False
    while not in_gamut(lab2lin(L, a, b)) and C > 1e-4:
        C *= 0.98; h = math.atan2(b, a); a, b = C * math.cos(h), C * math.sin(h); mapped = True
    return rgb8(lab2lin(L, a, b)), not mapped
def lch(L, C, h): return gamut_map(lch2lab(L, C, h))[0]

# -- the house chrome tokens (HOUSE 3.1), exactly -----------------------------------------------------
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72', line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f', line='#2a373c', strong='#64757b'),
}

# -- the tonal budget ----------------------------------------------------------------------------------
# Every data color (the countries' ramp, the fields, the chart) lives in the band. The signature, the
# Ledger, is drawn on --page under the plate, at the far end of the range from the band: ink at L 0.20
# in the light theme (the negative), a warm white at L 0.955 in the dark (the print). It is never drawn
# over the data, so its legibility is measured on --page; the band keeps it the boldest thing on screen.
BAND = {'light': (0.50, 0.96), 'dark': (0.15, 0.72)}
LEDGER = {'light': (0.200, 0.016, 70), 'dark': (0.955, 0.012, 85)}   # OKLCh: a near-neutral, crude-oil warm
HATCH = dict(pitch=3, width=1)                                       # the hatched end: 1 px ink lines every 3 px at 45 degrees

# -- the plate, per theme, in OKLCh (L, C, h); hex printed by the run ---------------------------------
# Natural Earth's depth bands (200 m to 10 000 m) shade the sea when switched on: ground, not a data
# scale, so deeper is darker in both themes; stops at 200 m and at 6 000 m and deeper, linear between,
# as app.js's bathyStyle() reads them.
PLATE_LCH = {
 'light': dict(
     sea=(0.905, 0.016, 225), deep=[(0.885, 0.020, 230), (0.835, 0.028, 238)],
     land=(0.957, 0.004, 150),         # plain: no figure, or nothing produced (the card says which)
     outside=(0.932, 0.003, 230),      # beyond 85 degrees, where the map stops: a neutral of its own
     border=(0.420, 0.012, 230), border_a=0.50,
     label='ink', halo='sheet', halo_a=0.88,
     rim='sheet', rim_a=0.95,
     fuel=dict(oil=(0.730, 0.150, 52), gas=(0.670, 0.130, 230), both=(0.505, 0.120, 155), other=(0.600, 0.010, 230)),
     chart=dict(oil=(0.560, 0.140, 52), gas=(0.500, 0.120, 230)),
     pale_a=0.45, tint_a=0.16, edge_a=0.85),
 'dark': dict(
     sea=(0.215, 0.018, 230), deep=[(0.200, 0.019, 232), (0.150, 0.018, 240)],
     land=(0.275, 0.010, 225),
     outside=(0.180, 0.006, 230),
     border=(0.760, 0.010, 230), border_a=0.35,
     label='ink', halo='sheet', halo_a=0.88,
     rim='page', rim_a=0.90,
     fuel=dict(oil=(0.710, 0.140, 52), gas=(0.650, 0.120, 230), both=(0.500, 0.115, 155), other=(0.590, 0.010, 230)),
     chart=dict(oil=(0.740, 0.130, 52), gas=(0.700, 0.110, 230)),
     pale_a=0.45, tint_a=0.18, edge_a=0.85),
}
FUELS = ('oil', 'gas', 'both')
# The fuels keep the stock app's logic (oil warm, gas cool, both green; gas and condensate a neutral) and are
# told apart by lightness as well as hue, because blue and green collapse under tritan vision and orange and
# green under deutan: light theme oil L 0.73, gas 0.67, both 0.505; dark 0.71, 0.65, 0.50. Gas sits at hue
# 230, 60 degrees from the countries' violet, so a gas field on a big producer still stands apart from it.
# The details chart draws oil and gas as lines on --page, so it takes its own darker (light) or lighter
# (dark) pair at the same hues, at 3:1 or more.

# -- the countries' ramp: production on a log scale, one hue path printed twice -----------------------
# Salience s runs along the legend's log axis (app.js lutIndex(): the unit's domain, three to four
# decades). Violet, as the stock app chose it, so it is neither the sea's blue nor a fuel's hue; light
# prints s as darkness from L 0.90 to 0.50, dark as light from L 0.34 to 0.72.
RAMP = [(0.00, 0.040, 300), (0.25, 0.075, 298), (0.50, 0.105, 295), (0.75, 0.120, 292), (1.00, 0.125, 290)]
RAMP_L = {'light': (0.900, 0.500), 'dark': (0.340, 0.720)}
N_DENSE = 17                                                     # evenly spaced stops for app.js's 256-step LUT

def ramp_lab(theme, s):
    s = max(0.0, min(1.0, s)); L0, L1 = RAMP_L[theme]
    for (s0, c0, h0), (s1, c1, h1) in zip(RAMP, RAMP[1:]):
        if s0 <= s <= s1:
            t = 0 if s1 == s0 else (s - s0) / (s1 - s0)
            p = lch2lab(L0 + (L1 - L0) * s0, c0, h0); q = lch2lab(L0 + (L1 - L0) * s1, c1, h1)
            return tuple(p[i] + (q[i] - p[i]) * t for i in range(3))
def ramp_rgb(theme, s): return gamut_map(ramp_lab(theme, s))
def dense(theme): return [ramp_rgb(theme, k / (N_DENSE - 1))[0] for k in range(N_DENSE)]
def lut_rgb(theme, s):
    # app.js buildPalette(): straight sRGB interpolation between N_DENSE evenly spaced stops
    st = dense(theme); t = max(0, min(1, s)) * (len(st) - 1); j = min(len(st) - 2, int(t)); f = t - j
    return tuple(round(a + (b - a) * f) for a, b in zip(st[j], st[j + 1]))

def plate(theme):
    P = PLATE_LCH[theme]; T = TOK[theme]; out = {}
    for k in ('sea', 'land', 'outside', 'border'):
        out[k] = hx(lch(*P[k]))
    out['deep'] = [hx(lch(*c)) for c in P['deep']]
    out['fuel'] = {k: hx(lch(*c)) for k, c in P['fuel'].items()}
    out['chart'] = {k: hx(lch(*c)) for k, c in P['chart'].items()}
    out['label'] = T['ink']; out['halo'] = T['sheet']; out['sel'] = T['ink']
    out['rim'] = T[P['rim']]; out['edge'] = T['line']
    out['ledger'] = hx(lch(*LEDGER[theme]))
    return out

GHOST = {'light': dict(stroke='#0f1c23', halo=(246, 249, 250), halo_a=0.60),
         'dark': dict(stroke='#f2f4f1', halo=(10, 16, 19), halo_a=0.45)}

def grounds(theme):
    """Every ground a field or a label can sit on: the sea (flat and at every depth step), plain land, the
    map's outside, and every country fill of the ramp."""
    p = plate(theme)
    g = [('sea', parse(p['sea'])), ('land', parse(p['land'])), ('outside', parse(p['outside']))]
    a, b = (parse(h) for h in p['deep'])
    for k in range(5):
        t = k / 4; g.append((f'sea at depth step {t:.2f}', tuple(round(x + (y - x) * t) for x, y in zip(a, b))))
    for k in range(33):
        s = k / 32; g.append((f'country s={s:.3f}', lut_rgb(theme, s)))
    return g

def bases(theme):
    """Every color on the plate, composited as app.js draws it: the grounds, the fields (full, pale, the
    outline tint) over each, the rim, the borders."""
    p = plate(theme); P = PLATE_LCH[theme]; out = []
    for gname, gr in grounds(theme):
        out.append((gname, gr))
        for f, c in p['fuel'].items():
            out.append((f'{f} disc over {gname}', parse(c)))
            out.append((f'{f} pale over {gname}', over(parse(c), P['pale_a'], gr)))
            out.append((f'{f} outline tint over {gname}', over(parse(c), P['tint_a'], gr)))
        out.append((f'rim over {gname}', over(parse(p['rim']), P['rim_a'], gr)))
        out.append((f'border over {gname}', over(parse(p['border']), P['border_a'], gr)))
    return out

def main():
    if '--json' in sys.argv:
        out = {}
        for th in ('light', 'dark'):
            p = plate(th); P = PLATE_LCH[th]
            out[th] = dict(ramp=[hx(c) for c in dense(th)], sea=p['sea'], deep=p['deep'], land=p['land'], outside=p['outside'],
                           edge=p['edge'], border=p['border'], borderAlpha=P['border_a'],
                           fuel=p['fuel'], paleAlpha=P['pale_a'], tintAlpha=P['tint_a'], edgeAlpha=P['edge_a'],
                           rim=p['rim'], rimAlpha=P['rim_a'], label=p['label'], halo=p['halo'], haloAlpha=P['halo_a'],
                           sel=p['sel'], chart=p['chart'], ledger=p['ledger'], hatchPitch=HATCH['pitch'], hatchWidth=HATCH['width'])
        print(json.dumps(out)); return
    ok = True
    def gate(cond, label):
        nonlocal ok
        ok &= bool(cond)
        return '' if cond else f'  <- FAIL ({label})'

    print('== chrome tokens (HOUSE 3.1): WCAG 2 contrast (text >= 4.5, line-strong >= 3)')
    for th, t in TOK.items():
        res = []
        for n, a, b in [('ink on page', 'ink', 'page'), ('ink-2 on page', 'ink2', 'page'), ('ink-3 on page', 'ink3', 'page'),
                        ('ink on sheet', 'ink', 'sheet'), ('ink-2 on sheet', 'ink2', 'sheet'), ('ink-3 on sheet', 'ink3', 'sheet')]:
            c = cr(parse(t[a]), parse(t[b])); ok &= c >= 4.5; res.append(f'{n} {c:.2f}')
        e = cr(parse(t['strong']), parse(t['page'])); ok &= e >= 3; res.append(f'line-strong on page {e:.2f}')
        print(f'  {th}: ' + ', '.join(res))
    print(f'  highest chroma of any chrome token: {max(lch8(parse(h))[1] for t in TOK.values() for h in t.values()):.4f}')

    print('== the plate, per theme (hex from the OKLCh above)')
    for th in ('light', 'dark'):
        p = plate(th); P = PLATE_LCH[th]
        print(f'  {th}: sea {p["sea"]} (L {lch8(parse(p["sea"]))[0]:.3f}), depth bands {p["deep"][0]} at 200 m to {p["deep"][1]} at 6 000 m, '
              f'land {p["land"]} (L {lch8(parse(p["land"]))[0]:.3f}), outside {p["outside"]} (edge {p["edge"]}), border {p["border"]} at {P["border_a"]}')
        print(f'  {th}: fuels ' + ', '.join(f'{k} {v} (L {lch8(parse(v))[0]:.3f})' for k, v in p['fuel'].items()) +
              f'; pale at {P["pale_a"]}, outline tint at {P["tint_a"]}, outline at {P["edge_a"]}; rim {p["rim"]} at {P["rim_a"]}')
        print(f'  {th}: the Ledger {p["ledger"]}; labels {p["label"]} on a {p["halo"]} halo at {P["halo_a"]}; selection {p["sel"]} on the same halo')

    print('== the plate\'s own marks (labels on their halos >= 4.5; the selection on its halo >= 4.5; borders printed)')
    for th in ('light', 'dark'):
        p = plate(th); P = PLATE_LCH[th]; res = []
        worst_label = min(cr(parse(p['label']), over(parse(p['halo']), P['halo_a'], g)) for _, g in grounds(th))
        res.append(f'label on its halo, worst over every ground {worst_label:.2f}' + gate(worst_label >= 4.5, 'label'))
        worst_sel = min(cr(parse(p['sel']), over(parse(p['halo']), 0.90, b)) for _, b in bases(th))
        res.append(f'selection on its halo, worst over every base {worst_sel:.2f}' + gate(worst_sel >= 4.5, 'selection'))
        bl = cr(over(parse(p['border']), P['border_a'], parse(p['land'])), parse(p['land']))
        bs = cr(over(parse(p['border']), P['border_a'], parse(p['sea'])), parse(p['sea']))
        res.append(f'border on plain land {bl:.2f}, on the sea {bs:.2f} (a separator, gated at 1.8 on land)' + gate(bl >= 1.8, 'border'))
        oe = cr(parse(p['edge']), parse(p['outside']))
        res.append(f'the map\'s edge on the outside {oe:.2f}')
        print(f'  {th}: ' + '; '.join(res))

    print('== the countries\' ramp: gamut, the band, color-vision separation, steps, the small end against plain land')
    for th in ('light', 'dark'):
        cols = [ramp_rgb(th, k / 96) for k in range(97)]
        gam = sum(1 for _, g in cols if not g)
        Ls = [lab8(c)[0] for c, _ in cols]
        ends = (cols[0][0], cols[-1][0])
        sep = {k: math.dist(sim(ends[0], k), sim(ends[1], k)) for k in VISIONS}
        steps = [math.dist(lab8(lut_rgb(th, a / 8)), lab8(lut_rgb(th, (a + 1) / 8))) for a in range(8)]
        land = parse(plate(th)['land'])
        low = min(math.dist(sim(lut_rgb(th, 0), k), sim(land, k)) for k in VISIONS)
        inband = BAND[th][0] - 1e-3 <= min(Ls) and max(Ls) <= BAND[th][1] + 1e-3
        ok &= min(sep.values()) >= 0.10 and min(steps) >= 0.02 and low >= 0.05 and inband
        print(f'  {th}: chroma-limited samples {gam}; L {min(Ls):.3f}..{max(Ls):.3f} (band {BAND[th][0]}..{BAND[th][1]}: {"inside" if inband else "OUTSIDE"}); ends dE ' +
              ' '.join(f'{k} {v:.3f}' for k, v in sep.items()) + f'; dE per eighth min {min(steps):.3f}; small end against plain land, worst of four visions, dE {low:.3f}')
        print(f'  {th}: stops (s 0, .25, .5, .75, 1) ' + ' '.join(hx(ramp_rgb(th, s)[0]) for s in (0, .25, .5, .75, 1)))
    worst = 0
    for th in ('light', 'dark'):
        for i in range(400):
            s = i / 399; worst = max(worst, math.dist(lab8(lut_rgb(th, s)), lab8(ramp_rgb(th, s)[0])))
    ok &= worst <= 0.01
    print(f'== --json stops, interpolated in sRGB as app.js buildPalette() does, against the OKLab path: max dE {worst:.4f} (<= 0.01)')

    print('== the fields: four fuels in the band; oil, gas, oil and gas pairwise dE >= 0.10 in all four visions; every fuel apart from every country fill')
    for th in ('light', 'dark'):
        p = plate(th); fu = p['fuel']
        Ls = [lch8(parse(fu[k]))[0] for k in fu]
        inband = BAND[th][0] - 1e-3 <= min(Ls) and max(Ls) <= BAND[th][1] + 1e-3
        ok &= inband
        low = 9; at = ''
        for i, a in enumerate(FUELS):
            for b in FUELS[i + 1:]:
                for k in VISIONS:
                    d = math.dist(sim(parse(fu[a]), k), sim(parse(fu[b]), k))
                    if d < low: low, at = d, f'{a}/{b} {k}'
        ok &= low >= 0.10
        g = parse(fu['other'])
        oth = min(math.dist(sim(g, k), sim(parse(fu[f]), k)) for f in FUELS for k in VISIONS)
        ok &= oth >= 0.06
        print(f'  {th}: L {min(Ls):.3f}..{max(Ls):.3f} ({"inside" if inband else "OUTSIDE"} the band); min pairwise dE {low:.3f} ({at}); '
              f'"other" (gas and condensate, a gray) from the three, worst {oth:.3f} (gated at 0.06; the card names it)')
        rows = []
        for f in FUELS + ('other',):
            dn = min(math.dist(lab8(parse(fu[f])), lab8(lut_rgb(th, k / 64))) for k in range(65))
            dc = min(math.dist(sim(parse(fu[f]), v), sim(lut_rgb(th, k / 64), v)) for k in range(65) for v in VISIONS)
            dg = min(math.dist(lab8(parse(fu[f])), lab8(parse(p[x]))) for x in ('sea', 'land'))
            gated = f in FUELS
            if gated: ok &= dn >= 0.10 and dg >= 0.10
            rows.append(f'{f}: from every country fill dE {dn:.3f} (worst vision {dc:.3f}), from sea and land {dg:.3f}')
        print(f'  {th}: ' + '; '.join(rows))
        ch = p['chart']
        chart = [cr(parse(ch[k]), parse(TOK[th]['page'])) for k in ('oil', 'gas')]
        cpair = min(math.dist(sim(parse(ch['oil']), k), sim(parse(ch['gas']), k)) for k in VISIONS)
        ok &= min(chart) >= 3 and cpair >= 0.10
        print(f'  {th}: the details chart\'s lines, oil {ch["oil"]} and gas {ch["gas"]}: on --page {chart[0]:.2f}, {chart[1]:.2f} (>= 3); apart, worst of four visions, dE {cpair:.3f}')

    print('== the signature: the Ledger, ink on --page under the plate (a mark: >= 3), at the far end of the range from the band')
    for th in ('light', 'dark'):
        p = plate(th); T = TOK[th]
        led = parse(p['ledger']); page = parse(T['page'])
        c = cr(led, page)
        # the hatched end, seen as a tone at the strip's height: 1 px of ink in every 3 px
        hat = over(led, HATCH['width'] / HATCH['pitch'], page)
        ch = cr(led, page)
        L, C, h = lch8(led)
        data_L = [lab8(lut_rgb(th, k / 64))[0] for k in range(65)] + [lch8(parse(v))[0] for v in p['fuel'].values()]
        gap = (min(data_L) - L) if th == 'light' else (L - max(data_L))
        ok &= c >= 3 and gap >= 0.20 and C <= 0.021
        print(f'  {th}: {p["ledger"]} OKLCh {L:.3f} {C:.4f} {h:.0f}; on --page {c:.2f}; on --sheet {cr(led, parse(T["sheet"])):.2f}; '
              f'the hatched end reads as {hx(hat)} ({cr(hat, page):.2f} on --page, each line {ch:.2f}); '
              f'lightness gap to the nearest data color {gap:.3f} (>= 0.20); the block gap is --page')
        lab_t = cr(parse(T['ink2']), page); lab_s = cr(parse(T['ink']), page)
        print(f'  {th}: its labels --ink-2 on --page {lab_t:.2f}; the chosen country\'s label --ink {lab_s:.2f}; the tracer under its block is the Ledger\'s ink')
    print('  distance to the template\'s other signature inks (OKLab dE): ' + '; '.join(
        f'{th}: ' + ', '.join(f'{n} {math.dist(lab8(parse(plate(th)["ledger"])), lab8(parse(c))):.3f}' for n, c in others.items())
        for th, others in (('light', {'Global Weather streak': '#0b171d', 'Norne Cut': '#12150b', 'Shelf Atlas ring': '#0c131b'}),
                           ('dark', {'Global Weather streak': '#f4f2ea', 'Norne Cut': '#eff5e7', 'Shelf Atlas ring': '#edf3fa'}))))

    print('== the ghost key (focus mode) over every base: a 1.4 px stroke over a 3.4 px halo, at rest (72 %)')
    for th in ('light', 'dark'):
        G = GHOST[th]; low = 99
        for _, b in bases(th):
            halo = over(G['halo'], G['halo_a'], b); stroke = over(parse(G['stroke']), 0.72, halo); low = min(low, cr(stroke, halo))
        ok &= low >= 3; print(f'  {th}: stroke against its own halo, worst {low:.2f} (>= 3)')

    print('ALL CHECKS PASS' if ok else 'SOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
