"""Shelf Atlas's palette under the house system (ART.md section 2; Template/HOUSE.md section 3): the
chrome tokens, the plate printed twice (the sea and its depth, the land, the lines), the circles'
production ramp, the pipelines' three media, the history chart's two series, the signature (the
Peaks: each field's best month so far, an ink ring) and the ghost key, with every check ART.md
quotes. Standard library only. Run from Template/:

    python3 shelf-atlas/tools/art/palette.py           # the checks; ends ALL CHECKS PASS or SOME CHECKS FAIL
    python3 shelf-atlas/tools/art/palette.py --json    # what app.js's THEMES takes, pasted, never retyped

Color math: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB: the same
functions as global-weather/tools/art/palette.py, copied so that this folder stands alone.
"""
import json, math, sys

# -- color math (copied from global-weather/tools/art/palette.py) --------------------------------
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

# -- the tonal budget: data lives in [L low, L high]; the signature keeps the far end to itself -------
# Light (the negative): the rings are ink at L 0.185, every data color at L 0.50 or more.
# Dark (the print): the rings are a cool white at L 0.962, every data color at L 0.64 or less.
BAND = {'light': (0.50, 0.96), 'dark': (0.15, 0.64)}

# -- the plate, per theme, in OKLCh (L, C, h); hex printed by the run ---------------------------------
# The sea is the EMODnet depth raster (gray value = 255 * sqrt(depth / 3000 m)), shaded by depth from the
# shallows to the deep: ground, not a data scale, so deeper is darker in both themes. Stops are keyed
# by the raster's gray value, as app.js's bathyCanvas() reads them.
DEPTH_GRAY = [1, 40, 80, 150, 255]                     # 0.1 m, 74 m, 295 m, 1 038 m, 3 000 m
PLATE_LCH = {
 'light': dict(
     depth=[(0.940, 0.010, 225), (0.922, 0.014, 228), (0.900, 0.019, 232), (0.874, 0.024, 236), (0.850, 0.028, 240)],
     sea=(0.922, 0.014, 228),          # the 200 m polygons' fallback and the sea under the raster
     land=(0.957, 0.004, 150), outside=(0.900, 0.004, 230),
     coast=(0.510, 0.020, 225), border=(0.520, 0.012, 230),
     outline=(0.525, 0.014, 230), shut=(0.720, 0.008, 230), shut_a=0.60,
     prod_a=0.22,
     fac=(0.505, 0.016, 230), sub=(0.560, 0.014, 230),
     rim=None, rim_a=0.90,
     pipe=[(0.515, 0.120, 150), (0.515, 0.140, 322), (0.525, 0.006, 230)], pipe_a=1.0,
     chart=[(0.540, 0.120, 150), (0.540, 0.140, 322)],
     ring=(0.185, 0.020, 250),
     label='ink', halo='sheet', halo_a=0.88),
 'dark': dict(
     depth=[(0.265, 0.016, 230), (0.245, 0.018, 232), (0.222, 0.020, 235), (0.194, 0.020, 238), (0.165, 0.018, 240)],
     sea=(0.245, 0.018, 232),
     land=(0.300, 0.010, 225), outside=(0.168, 0.008, 230),
     coast=(0.600, 0.018, 225), border=(0.580, 0.014, 230),
     outline=(0.575, 0.016, 230), shut=(0.420, 0.010, 230), shut_a=0.70,
     prod_a=0.26,
     fac=(0.625, 0.016, 230), sub=(0.560, 0.014, 230),
     rim=None, rim_a=0.90,
     pipe=[(0.620, 0.120, 150), (0.620, 0.140, 322), (0.540, 0.006, 230)], pipe_a=1.0,
     chart=[(0.700, 0.120, 150), (0.700, 0.140, 322)],
     ring=(0.962, 0.012, 250),
     label='ink', halo='sheet', halo_a=0.88),
}

# -- the circles' ramp: production, one hue path printed twice ----------------------------------------
# Salience s runs along the legend's log axis (DOMAIN_DECADES = 3.5 in app.js): s = 0 at the scale's low
# end, 1 at its top. Light prints s as darkness from the band's pale end, dark as light from its dark
# end, so in both themes a big producer stands furthest from the sea. Amber at the small end, through
# orange to a red-brown: warm against the cool sea, and never a hue of the pipelines (150, 300).
RAMP = [(0.00, 0.075, 75), (0.25, 0.115, 62), (0.50, 0.150, 48), (0.75, 0.155, 38), (1.00, 0.140, 30)]
RAMP_L = {'light': (0.880, 0.520), 'dark': (0.360, 0.640)}       # L at s = 0 and s = 1
CIRCLE_A = 0.82                                                  # app.js draws a disc at this alpha
N_DENSE = 17                                                     # evenly spaced stops for app.js's LUT

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
    out['depth'] = [hx(lch(*c)) for c in P['depth']]
    for k in ('sea', 'land', 'coast', 'border', 'outline', 'shut', 'fac', 'sub', 'ring'):
        out[k] = hx(lch(*P[k]))
    # beyond the data's box: a neutral tone of its own, never --page (the plate would melt into the chrome)
    # and never a sea or land tone, with a 1 px --line at the box's edge so the straight cut reads as the data's limit
    out['outside'] = hx(lch(*P['outside'])); out['edge'] = T['line']
    out['pipes'] = [hx(lch(*c)) for c in P['pipe']]
    out['chart'] = [hx(lch(*c)) for c in P['chart']]
    out['label'] = T['ink']; out['halo'] = T['sheet']; out['rim'] = T['sheet'] if theme == 'light' else T['page']
    out['prodFill'] = hx(ramp_rgb(theme, 0.5)[0])
    return out

GHOST = {'light': dict(stroke='#0f1c23', halo=(246, 249, 250), halo_a=0.60),
         'dark': dict(stroke='#f2f4f1', halo=(10, 16, 19), halo_a=0.45)}

def grounds(theme):
    """Every ground a ring or a mark can sit on: the sea at every depth stop and between them, the land,
    the outside of the data's box."""
    p = plate(theme); g = [('land', parse(p['land'])), ('outside', parse(p['outside'])), ('sea', parse(p['sea']))]
    d = [parse(h) for h in p['depth']]
    for i in range(len(d) - 1):
        for k in range(4):
            t = k / 4; g.append((f'sea at gray {DEPTH_GRAY[i] + (DEPTH_GRAY[i + 1] - DEPTH_GRAY[i]) * t:.0f}', tuple(round(a + (b - a) * t) for a, b in zip(d[i], d[i + 1]))))
    g.append(('sea at gray 255', d[-1]))
    return g

def bases(theme):
    """Every color the signature can be drawn over, composited as app.js draws it."""
    p = plate(theme); out = []
    for gname, g in grounds(theme):
        out.append((gname, g))
        for k in range(97):
            s = k / 96; out.append((f'circle s={s:.3f} over {gname}', over(lut_rgb(theme, s), CIRCLE_A, g)))
        out.append((f'producing tint over {gname}', over(parse(p['prodFill']), PLATE_LCH[theme]['prod_a'], g)))
        out.append((f'shut fill over {gname}', over(parse(p['shut']), PLATE_LCH[theme]['shut_a'], g)))
        for i, c in enumerate(p['pipes']):
            out.append((f'pipeline {["oil", "gas", "other"][i]} over {gname}', over(parse(c), PLATE_LCH[theme]['pipe_a'], g)))
        out.append((f'circle rim over {gname}', over(parse(p['rim']), PLATE_LCH[theme]['rim_a'], g)))
    for k in ('coast', 'border', 'outline', 'fac', 'sub'):
        out.append((k, parse(p[k])))
    return out

def main():
    if '--json' in sys.argv:
        out = {}
        for th in ('light', 'dark'):
            p = plate(th)
            out[th] = dict(ramp=[hx(c) for c in dense(th)], circleAlpha=CIRCLE_A,
                           depth=[[g, h] for g, h in zip(DEPTH_GRAY, p['depth'])],
                           sea=p['sea'], land=p['land'], outside=p['outside'], edge=p['edge'], coast=p['coast'], border=p['border'],
                           idle=p['outline'], shutFill=p['shut'], shutAlpha=PLATE_LCH[th]['shut_a'],
                           prodFill=p['prodFill'], prodAlpha=PLATE_LCH[th]['prod_a'],
                           rim=p['rim'], rimAlpha=PLATE_LCH[th]['rim_a'],
                           pipes=p['pipes'], pipeAlpha=PLATE_LCH[th]['pipe_a'], chart=p['chart'],
                           fac=p['fac'], sub=p['sub'], ring=p['ring'], label=p['label'], halo=p['halo'], haloAlpha=PLATE_LCH[th]['halo_a'])
        print(json.dumps(out)); return
    ok = True
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
        p = plate(th)
        print(f'  {th}: sea {p["sea"]} land {p["land"]} outside {p["outside"]} (edge {p["edge"]}) depth ' + ' '.join(f'{g}:{h}' for g, h in zip(DEPTH_GRAY, p['depth'])))
        print(f'  {th}: coast {p["coast"]} border {p["border"]} outline {p["outline"]} shut {p["shut"]}@{PLATE_LCH[th]["shut_a"]} '
              f'producing tint {p["prodFill"]}@{PLATE_LCH[th]["prod_a"]} facility {p["fac"]} subsea {p["sub"]} rim {p["rim"]}@{PLATE_LCH[th]["rim_a"]}')
        print(f'  {th}: pipelines oil {p["pipes"][0]} gas {p["pipes"][1]} other {p["pipes"][2]} @{PLATE_LCH[th]["pipe_a"]}; history chart liquids {p["chart"][0]} gas {p["chart"][1]}')
        Ls = sorted(lch8(parse(c))[0] for c in [p['coast'], p['border'], p['outline'], p['shut'], p['fac'], p['sub']] + p['pipes'])
        print(f'  {th}: L of the plate\'s marks {Ls[0]:.3f}..{Ls[-1]:.3f}; land L {lch8(parse(p["land"]))[0]:.3f}; sea L {lch8(parse(p["depth"][-1]))[0]:.3f}..{lch8(parse(p["depth"][0]))[0]:.3f}')

    print('== the plate\'s own marks on their grounds (lines >= 3; labels on their halos >= 4.5)')
    for th in ('light', 'dark'):
        p = plate(th); T = TOK[th]; res = []
        halo = over(parse(T['sheet']), PLATE_LCH[th]['halo_a'], parse(p['sea']))
        c = cr(parse(T['ink']), halo); ok &= c >= 4.5; res.append(f'label on its halo {c:.2f}')
        for k in ('coast', 'border', 'outline', 'fac'):
            worst = min(cr(parse(p[k]), g) for n, g in grounds(th) if not (k == 'coast' and n == 'outside'))
            ok &= worst >= 3; res.append(f'{k} worst {worst:.2f}')
        for i, nm in enumerate(('oil', 'gas', 'other')):
            worst = min(cr(over(parse(p['pipes'][i]), PLATE_LCH[th]['pipe_a'], g), g) for n, g in grounds(th) if n.startswith('sea'))
            ok &= worst >= 3; res.append(f'pipeline {nm} worst {worst:.2f}')
        for i, nm in enumerate(('liquids', 'gas')):
            c = cr(parse(p['chart'][i]), parse(T['page'])); ok &= c >= 3; res.append(f'chart {nm} on page {c:.2f}')
        sel = min(cr(parse(T['ink']), b) for _, b in bases(th))
        res.append(f'selection ink on its halo {cr(parse(T["ink"]), over(parse(T["sheet"]), 0.9, parse(p["sea"]))):.2f}')
        print(f'  {th}: ' + ', '.join(res))

    print('== the circles\' ramp: gamut, lightness, color-vision separation, steps, the small end against the sea')
    for th in ('light', 'dark'):
        cols = [ramp_rgb(th, k / 96) for k in range(97)]
        gam = sum(1 for _, g in cols if not g)
        Ls = [lab8(c)[0] for c, _ in cols]
        ends = (cols[0][0], cols[-1][0])
        sep = {k: math.dist(sim(ends[0], k), sim(ends[1], k)) for k in ('normal', 'deutan', 'protan', 'tritan')}
        sea = parse(plate(th)['sea'])
        seen = [over(lut_rgb(th, k / 96), CIRCLE_A, sea) for k in range(97)]
        steps = [math.dist(lab8(a), lab8(b)) for a, b in zip(seen[::12], seen[12::12])]
        low = math.dist(lab8(seen[0]), lab8(sea))
        inband = BAND[th][0] - 1e-3 <= min(Ls) and max(Ls) <= BAND[th][1] + 1e-3
        ok &= min(sep.values()) >= 0.10 and min(steps) >= 0.02 and low >= 0.06 and inband
        print(f'  {th}: chroma-limited samples {gam}; L {min(Ls):.3f}..{max(Ls):.3f} (band {BAND[th][0]}..{BAND[th][1]}: {"inside" if inband else "OUTSIDE"}); ends dE ' +
              ' '.join(f'{k} {v:.3f}' for k, v in sep.items()) + f'; dE per eighth over the sea min {min(steps):.3f}; small end against the sea dE {low:.3f}')
        print(f'  {th}: stops (s 0, .25, .5, .75, 1) ' + ' '.join(hx(ramp_rgb(th, s)[0]) for s in (0, .25, .5, .75, 1)))
    worst = 0
    for th in ('light', 'dark'):
        for i in range(400):
            s = i / 399; worst = max(worst, math.dist(lab8(lut_rgb(th, s)), lab8(ramp_rgb(th, s)[0])))
    ok &= worst <= 0.01
    print(f'== --json stops, interpolated in sRGB as app.js buildPalette() does, against the OKLab path: max dE {worst:.4f} (<= 0.01)')

    print('== categories: every pair dE >= 0.10 under normal, deutan, protan and tritan vision')
    for th in ('light', 'dark'):
        p = plate(th)
        # "other or unknown" pipelines are told apart by their form (dotted, no hue), so the gated pair is
        # oil and gas; the gray's distances are printed beside it, not gated
        for title, names, cols in (('pipelines oil/gas', ('oil', 'gas'), p['pipes'][:2]), ('history chart', ('liquids', 'gas'), p['chart'])):
            low = 9; at = ''
            for i in range(len(cols)):
                for j in range(i + 1, len(cols)):
                    for k in ('normal', 'deutan', 'protan', 'tritan'):
                        d = math.dist(sim(parse(cols[i]), k), sim(parse(cols[j]), k))
                        if d < low: low, at = d, f'{names[i]}/{names[j]} {k}'
            ok &= low >= 0.10; print(f'  {th} {title}: min pairwise dE {low:.3f} ({at})')
        g = parse(p['pipes'][2])
        print(f'  {th} pipelines, the dotted gray against oil and gas (form carries it; not gated): ' + ', '.join(
            f'{n} min {min(math.dist(sim(g, k), sim(parse(c), k)) for k in ("normal", "deutan", "protan", "tritan")):.3f}' for n, c in zip(('oil', 'gas'), p['pipes'][:2])))
        # the circles' hues against the pipelines' (never the same hue path)
        h_ramp = [lch8(ramp_rgb(th, s)[0])[2] for s in (0, .5, 1)]
        print(f'  {th}: ramp hues {", ".join(f"{h:.0f}" for h in h_ramp)}; pipeline hues {", ".join(f"{lch8(parse(c))[2]:.0f}" for c in p["pipes"][:2])}')

    print('== the signature: a 1 px ring over every color under it (the target is 3.0 for a mark)')
    for th in ('light', 'dark'):
        ring = parse(plate(th)['ring']); low = 99; at = ''
        for name, b in bases(th):
            c = cr(ring, b)
            if c < low: low, at = c, f'{name} ({hx(b)})'
        ok &= low >= 3.0
        groups = {}
        for name, b in bases(th):
            k = ('circles' if name.startswith('circle s=') else 'producing tint' if name.startswith('producing') else 'shut fill' if name.startswith('shut')
                 else 'pipelines' if name.startswith('pipeline') else 'circle rim' if name.startswith('circle rim') else 'grounds' if name in dict(grounds(th)) else 'lines and marks')
            c = cr(ring, b)
            if k not in groups or c < groups[k][0]: groups[k] = (c, name)
        print(f'  {th}: worst by kind: ' + '; '.join(f'{k} {v[0]:.2f} ({v[1]})' for k, v in groups.items()))
        L, C, h = lch8(ring)
        print(f'  {th}: ring {hx(ring)} OKLCh {L:.3f} {C:.4f} {h:.0f}; worst {low:.2f} over {at}; on bare land {cr(ring, parse(plate(th)["land"])):.2f}, shallow sea {cr(ring, parse(plate(th)["depth"][0])):.2f}, deep sea {cr(ring, parse(plate(th)["depth"][-1])):.2f}')
    print('  distance to the template\'s other signature inks (OKLab dE): ' + '; '.join(
        f'{th}: ' + ', '.join(f'{n} {math.dist(lab8(parse(plate(th)["ring"])), lab8(parse(c))):.3f}' for n, c in others.items())
        for th, others in (('light', {'Global Weather streak': '#0b171d', 'Norne Cut': '#12150b'}), ('dark', {'Global Weather streak': '#f4f2ea', 'Norne Cut': '#eff5e7'}))))

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
