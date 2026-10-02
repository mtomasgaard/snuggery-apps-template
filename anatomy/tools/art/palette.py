"""Anatomy's palette under the house system (ART.md section 2): the chrome tokens, the plate's ground
per theme, the body's own colors (read from data/anatomy.json, never retyped, and the same in both
themes: a body has one true appearance), the signature (the Levels: this model's vertebrae as a rule
beside the body), the selection, the swatches of the Layers sheet and the ghost key, with every
check ART.md quotes. Standard library only. Run from Template/:

    python3 anatomy/tools/art/palette.py [--json]

--json prints the CSS custom properties this app adds, per theme (`--plate`, `--level`,
`--level-halo`, `--select-halo`); style.css carries them and tools/check.mjs fails while the two differ.

Color math: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB, the same
functions as global-weather/tools/art/palette.py, copied so this folder stands alone.

The body is lit (app.js: MeshStandardMaterial under a room environment, a key and a rim light,
neutral tone mapping), so a base color reaches the screen at many lightnesses. FACTORS are the
rendered-to-base ratios measured on the stock app's bone, the most common light tissue
(tools/.work/lit.py over tools/.work/look/*-3-skeleton.png, headless Chromium, 390 x 844):
p1 0.59 to 0.70, p10 0.82 to 0.85, median 1.04, p90 1.08, highest 1.15. tools/shoot.mjs samples the
rendered frames of the pass; these factors are the palette's model of them, not a substitute.
"""
import json, math, os, sys, collections

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
def oklch(L, C, h):
    a, b = lch2lab(L, C, h)[1:]
    while not in_gamut(lab2lin(L, a, b)) and math.hypot(a, b) > 1e-4: a, b = a * 0.98, b * 0.98
    return rgb8(lab2lin(L, a, b))
CVD = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
       'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
       'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
VISIONS = ('normal', 'deutan', 'protan', 'tritan')
def sim(rgb, kind):
    lin = [dec(c / 255) for c in rgb]
    if kind != 'normal': lin = [min(1, max(0, sum(CVD[kind][i][j] * lin[j] for j in range(3)))) for i in range(3)]
    return lin2lab(*lin)
def dE(a, b, kind='normal'): return math.dist(sim(a, kind), sim(b, kind))
def shade(rgb, f): return tuple(min(255, round(c * f)) for c in rgb)   # the measured rendered-to-base ratio, in sRGB numbers

# ── the house chrome tokens (HOUSE 3.1), copied exactly ──────────────────────
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72',
               line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f',
               line='#2a373c', strong='#64757b'),
}

# ── the plate: the page itself in both themes (the plate's edge is the edge) ──
# The body keeps its colors in both themes; only the ground under it follows the theme.
PLATE = {th: parse(TOK[th]['page']) for th in TOK}
FACTORS = (0.60, 0.82, 1.04, 1.09, 1.15)          # see the docstring
SHADED, MEDIAN = 0.82, 1.04                       # a form's shaded side (p10) and its median face

# ── the body's colors, read from the data file (the resolution app.js applyLook() uses) ──
HERE = os.path.dirname(os.path.abspath(__file__))
ANAT = json.load(open(os.path.join(HERE, '..', '..', 'data', 'anatomy.json'), encoding='utf8'))
LAYERS = {l['id']: l for l in ANAT['layers']}
def part_color(p):
    t = ANAT['types'].get(p.get('type'), {}); lay = LAYERS.get(p['layer'], {})
    return p.get('color') or (p.get('tissue') == 'connective' and lay.get('connectiveColor')) or t.get('color') or lay.get('color') or '#e6d9bf'
USE = collections.Counter(part_color(p) for p in ANAT['parts'])          # color -> number of parts drawn in it
BODY = {c: parse(c) for c in USE}
SELECTED = {'light': parse(ANAT.get('colors', {}).get('selected', '#3552d6')),
            'dark': parse(ANAT.get('colors', {}).get('selectedDark', '#8ea2ff'))}

# ── the signature: the Levels (ART.md section 1) ─────────────────────────────
# One ink, a near-neutral at the far end of each theme's range, hue 300 (no data scale here uses it,
# and every other signature in the template sits elsewhere). It is drawn on a 3 px halo of the plate
# at LEVEL_HALO_A, because the body's highlights reach the far end in the dark theme (see below).
LEVEL = {'light': oklch(0.190, 0.020, 300), 'dark': oklch(0.965, 0.012, 300)}
LEVEL_HALO_A = 0.85
OTHERS = {'Global Weather streak': {'light': parse('#0b171d'), 'dark': parse('#f4f2ea')},
          'Milky Way Reach': {'light': parse('#0d131c'), 'dark': parse('#eff4fa')},
          'Besseggen Burn': {'light': parse('#1b110b'), 'dark': parse('#fcf2e5')},
          'Norne Cut': {'light': parse('#12150b'), 'dark': parse('#eff5e7')}}

# The selection: up to 60 parts, the house's selection mark alone, a 1.5 px --ink outline on a 1.5 px
# halo of the plate ground at SELECT_HALO_A, the structure keeping its own color; a larger group or
# region (no outline) takes the data's tint (colors.selected / selectedDark in anatomy.json), lerped at
# TINT in linear sRGB with no emissive (app.js applyLook()). The outline is checked over the lit body
# and over the tinted colors both, so a change of either rule cannot leave it unchecked.
TINT = 0.30
SELECT_HALO_A = 0.90
# The ghost key's halo: the house's in light; in dark at 0.70, not the house's 0.45, which measures
# 2.17 over the body's white highlights (the same change Norne Reservoir made, for the same reason).
GHOST = {'light': dict(stroke='#0f1c23', halo=(246, 249, 250), halo_a=0.60), 'dark': dict(stroke='#f2f4f1', halo=(10, 16, 19), halo_a=0.70)}

def tinted(base, th):
    b = [dec(c / 255) for c in base]; s = [dec(c / 255) for c in SELECTED[th]]
    return tuple(round(enc(min(1.0, bi + (si - bi) * TINT)) * 255) for bi, si in zip(b, s))

def css(th):
    p = PLATE[th]
    return {'--plate': hx(p), '--level': hx(LEVEL[th]),
            '--level-halo': 'rgba(%d, %d, %d, %.2f)' % (*p, LEVEL_HALO_A),
            '--select-halo': 'rgba(%d, %d, %d, %.2f)' % (*p, SELECT_HALO_A)}

def bases(th):
    return [shade(c, f) for c in BODY.values() for f in FACTORS] + [PLATE[th]]

def main():
    if '--json' in sys.argv: print(json.dumps({th: css(th) for th in TOK}, indent=2)); return
    ok = True
    def need(cond, label):
        nonlocal ok
        ok &= bool(cond)
        return '' if cond else f'  <-- FAIL {label}'

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

    print(f'== the body: {len(BODY)} colors over {sum(USE.values())} parts, read from data/anatomy.json; the same in both themes')
    Ls = sorted((lab8(c)[0], h) for h, c in BODY.items())
    lit = sorted(lab8(shade(c, f))[0] for c in BODY.values() for f in FACTORS)
    print(f'  base colors L {Ls[0][0]:.3f} ({Ls[0][1]}) to {Ls[-1][0]:.3f} ({Ls[-1][1]}); lit by the factors {FACTORS}: L {lit[0]:.3f} to {lit[-1]:.3f}')
    top = USE.most_common(6)
    print('  most used: ' + ', '.join(f'{h} x {n} (L {lab8(parse(h))[0]:.3f})' for h, n in top))

    print('== the plate: the page in both themes; every body color\'s shaded side (x 0.82) or median face (x 1.04) stands off the ground by dE >= 0.05')
    for th in TOK:
        g = PLATE[th]; L, C, h = lch8(g); worst = (9, ''); near = 0
        for hx_, c in BODY.items():
            best = max(math.dist(lab8(shade(c, f)), lab8(g)) for f in (SHADED, MEDIAN))
            if best < worst[0]: worst = (best, hx_)
            if math.dist(lab8(shade(c, MEDIAN)), lab8(g)) < 0.06: near += USE[hx_]
        print(f'  {th}: ground {hx(g)} OKLCh ({L:.3f}, {C:.4f}, {h:.0f}); worst best-face dE {worst[0]:.3f} ({worst[1]}){need(worst[0] >= 0.05, "body off ground")}; '
              f'parts whose median face is within dE 0.06 of the ground: {near} of {sum(USE.values())}')

    print('== the signature: the Levels, ink on its halo (blocks and the selection bar are marks, >= 3; labels are text, >= 4.5)')
    for th in TOK:
        ink = LEVEL[th]; L, C, h = lch8(ink); Li = lch8(parse(TOK[th]['ink']))[0]
        far = L < Li if th == 'light' else L > Li
        bare = cr(ink, PLATE[th])
        worst = (99, '')
        for b in bases(th):
            halo = over(PLATE[th], LEVEL_HALO_A, b); x = cr(ink, halo)
            if x < worst[0]: worst = (x, hx(b))
        print(f'  {th}: ink {hx(ink)} OKLCh ({L:.3f}, {C:.4f}, {h:.0f}), beyond --ink (L {Li:.3f}): {far}{need(far and C <= 0.021, "far end")}; '
              f'on the bare plate {bare:.2f}; worst on its halo over any lit body color {worst[0]:.2f} (over {worst[1]}){need(worst[0] >= 4.5, "level")}')
        unhaloed = min(cr(ink, b) for b in bases(th))
        print(f'         without the halo it would fall to {unhaloed:.2f} over the body, which is why the halo is a must')
        for n, o in OTHERS.items():
            print(f'         dE to {n} ({th}) {dE(ink, o[th]):.3f}, its hue {lch8(o[th])[2]:.0f}')

    print('== the selection: the ink outline on its halo (up to 60 parts); the data\'s tint at %.2f for larger selections (dE between a color and its tinted self, >= 0.10 reads; reported, not a check)' % TINT)
    for th in TOK:
        weak = sorted((dE(c, tinted(c, th)), h) for h, c in BODY.items())
        nweak = sum(USE[h] for d, h in weak if d < 0.10)
        print(f'  {th}: tint {hx(SELECTED[th])}; weakest {weak[0][0]:.3f} ({weak[0][1]}), {weak[1][0]:.3f} ({weak[1][1]}), {weak[2][0]:.3f} ({weak[2][1]}); '
              f'parts whose tint reads under 0.10: {nweak}')
        ink = parse(TOK[th]['ink']); worst = 99
        for b in bases(th) + [tinted(c, th) for c in BODY.values()]:
            halo = over(PLATE[th], SELECT_HALO_A, b); worst = min(worst, cr(ink, halo))
        print(f'         outline --ink on its halo over any lit or tinted body color: worst {worst:.2f}{need(worst >= 3, "outline")}')

    print('== the Layers sheet: each layer\'s swatch (data color) on --page and --sheet, framed by a 1 px --line-strong edge (>= 3)')
    for th, t in TOK.items():
        res = []; low = 99
        for l in ANAT['layers']:
            c = parse(l['color']); low = min(low, cr(c, parse(t['page'])), cr(c, parse(t['sheet'])))
        edge = min(cr(parse(t['strong']), parse(t['page'])), cr(parse(t['strong']), parse(t['sheet'])))
        print(f'  {th}: the weakest swatch on its ground {low:.2f} (identity is carried by the name beside it); the edge {edge:.2f}{need(edge >= 3, "swatch edge")}')
    names = [l['id'] for l in ANAT['layers']]; low = (9, '')
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            for k in VISIONS:
                d = dE(parse(LAYERS[names[i]]['color']), parse(LAYERS[names[j]]['color']), k)
                if d < low[0]: low = (d, f'{names[i]} / {names[j]} {k}')
    print(f'  nine layers, closest pair {low[0]:.3f} ({low[1]}): more than five categories, so words carry identity (HOUSE 3.3); reported, not a check')

    print('== the ghost key (focus mode): a 1.4 px stroke at rest (72 %) over a 3.4 px halo, over every lit body color and the plate (>= 3)')
    for th in TOK:
        G = GHOST[th]; low = 99
        for b in bases(th):
            halo = over(G['halo'], G['halo_a'], b); stroke = over(parse(G['stroke']), 0.72, halo); low = min(low, cr(stroke, halo))
        print(f'  {th}: worst {low:.2f}{need(low >= 3, "ghost")}')

    print('== CSS custom properties (paste from --json)')
    for th in TOK: print(f'  {th}: ' + ', '.join(f'{k} {v}' for k, v in css(th).items()))
    print('ALL CHECKS PASS' if ok else 'SOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
