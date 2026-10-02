"""Besseggen's palette under the house system (ART.md section 2): the chrome tokens, the signature (the
sunshine card burnt into the time track), and the plate, which keeps one appearance in both themes and
takes its colors from the shipped data/colors.json ("light" block), read here, never retyped.
Standard library only. Run from Template/:  python3 besseggen/tools/art/palette.py [--json]

--json prints the values js/plate.js takes (the burn, the plate's label ink and halo, the trail's and
the marker's casing, the ghost key), so the builder pastes numbers rather than retyping them.

The terrain is lit in a shader (js/material.js), so its rendered colors are modeled here with the
shader's own light math, in linear light: the base (terrain, low terrain, glacier and water mixes,
contours, fog toward the sky, the optional layers), times the sky term (the palette's shadow color,
lifted to a luminance floor of 0.16) plus the sun term (sunlit color x k x 1.05, capped at 1.25),
then the hillshade mix. k runs 0 (cast shadow) to 1 (full sun); the hillshade term 0.32 to 1. The
rendered frames themselves are sampled by tools/shoot.mjs; this file checks the colors they come from.

Checks that fail the run are the ones this app's code controls: the chrome, the burn, the labels on
their halos, the trail and the marker on their casings, the ghost key, the viewshed's two states, the
measure and line-of-sight line, and the trail's red where the chrome draws it (the profile), which
reads each theme's own block of data/colors.json because it sits on the chrome's page, not the plate.
Pairs whose colors come only from data/colors.json were measured and reported, not failed, while the
house pass held that file byte-identical (ART.md owner call 10). The pipeline follow-up of 2026-10-01
gave the 40-degree class its own red and spread the middle elevation bands (tools/06_editable.py,
rebuilt), so those pairs fail the run too: the two slope classes and every pair of bands at 0.10 in all
four visions, and the 40-degree class against the trail's red as named colors (flat) at 0.10. The
40-degree class against the trail as rendered, and the lake tint against high ground, are reported.

Color math: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009) at severity 1.0 in linear sRGB, copied from
global-weather/tools/art/palette.py so this folder stands alone.
"""
import json, math, os, sys

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
CVD = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
       'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
       'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
def sim(rgb, kind):
    lin = [dec(c / 255) for c in rgb]
    if kind != 'normal': lin = [min(1, max(0, sum(CVD[kind][i][j] * lin[j] for j in range(3)))) for i in range(3)]
    return lin2lab(*lin)
def sep(a, b): return {k: math.dist(sim(a, k), sim(b, k)) for k in ('normal', 'deutan', 'protan', 'tritan')}

# ── the house chrome tokens (HOUSE.md section 3.1), copied exactly ─────────────────────────────────
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72',
               line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f',
               line='#2a373c', strong='#64757b'),
}

# ── the signature: the burn on the time track (ART.md section 1) ─────────────────────────────────
# A near-neutral at the far end of each theme's range: a scorch on the film base, sunlit paper on the
# print. Never a hue of any data color; chroma <= 0.021; further from the page than --ink.
BURN = {'light': '#1b110b', 'dark': '#fcf2e5'}          # OKLCh (0.190, 0.020, 55) and (0.965, 0.020, 75)
OTHERS = {'Global Weather streak, light': '#0b171d', 'Global Weather streak, dark': '#f4f2ea',
          'Milky Way Reach, light': '#0d131c', 'Milky Way Reach, dark': '#eff4fa'}

# ── the plate: one appearance in both themes ───────────────────────────────────────────────────────
# The terrain under the real sun has one true appearance (HOUSE.md 3.2), so the plate is drawn from
# colors.json's "light" block in both themes; the chrome around it follows the phone's theme.
HERE = os.path.dirname(os.path.abspath(__file__))
COLORS = json.load(open(os.path.join(HERE, '..', '..', 'data', 'colors.json'), encoding='utf-8'))
P = COLORS['light']
BANDS = [b['color'] for b in COLORS['elevationBands']]
# Theme-independent plate marks this pass adds (js/plate.js): the label ink and halo, the casing
# drawn under the trail and the marker, the ghost key.
LABEL = dict(ink='#0f1c23', ink2='#45555d', halo='#f6f9fa', halo_a=0.85)
CASING = dict(color='#f6f9fa', alpha=0.90, px=1.25)     # each side of the line
GHOST = dict(stroke='#0f1c23', halo=(246, 249, 250), halo_a=0.60, rest=0.72)
# The viewshed's two states, code-owned (js/material.js): ground the eye can see is tinted toward
# colors.json's viewshed color; ground it cannot see is veiled toward the plate's pale tone, the way
# haze veils far ground. The stock states (tint 0.42; hidden 22 % gray and x 0.88) separated by dE
# 0.001 under protan vision on sunlit glacier; these hold 0.10 in all four visions.
VIEWSHED = dict(tint=0.50, veil='#f6f9fa', veil_a=0.40)
STOCK_VIEWSHED = dict(tint=0.42, gray=0.22, dim=0.88)

def rgba(h):
    h = h.lstrip('#'); a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)), a
def lin(h): return [dec(c / 255) for c in parse(h)]
def mixl(a, b, t): return [x + (y - x) * t for x, y in zip(a, b)]
def out(l): return rgb8([max(0.0, x) for x in l])

def lit(base, k, hill):
    # js/material.js, sun layer and hillshade layer on (the defaults): linear light throughout
    hill_term = 0.32 + 0.68 * hill
    amb = [c * (0.75 + 0.85 * hill_term) for c in lin(P['shadow'])]
    lu = 0.299 * amb[0] + 0.587 * amb[1] + 0.114 * amb[2]
    amb = [c * max(1.0, 0.16 / max(lu, 0.01)) for c in amb]
    kk = max(0.0, min(1.0, k)) ** 0.75
    col = [b * min(a + s * kk * 1.05, 1.25) for b, a, s in zip(base, amb, lin(P['sunlit']))]
    return mixl(col, [c * (0.72 + 0.42 * hill_term) for c in col], 0.45)

def plate_bases(layers=()):
    """Every rendered color the plate can show at a near distance, plus the sky and fogged terrain."""
    out_ = {}
    lo, hi = lin(P['terrainLow']), lin(P['terrain'])
    grounds = {'low ground': lo, 'mid ground': mixl(lo, hi, 0.5), 'high ground': hi,
               'glacier': mixl(hi, lin(P['glacier']), 0.92), 'lake bed tint': mixl(mixl(lo, hi, 0.5), lin(P['water']), 0.85)}
    if 'bands' in layers:
        for i, b in enumerate(BANDS): grounds[f'band {i + 1}'] = lin(b)
    if 'slope' in layers:
        grounds['slope 30'] = mixl(hi, lin(P['slope30']), 0.75)
        grounds['slope 40'] = mixl(grounds['slope 30'], lin(P['slope40']), 0.85)   # over the 30, as the shader mixes
    c100 = rgba(P['contour100']); c100a = min(0.5, max(c100[1], 0.1) * 2.6)
    for name, g in grounds.items():
        for k in (0.0, 0.5, 1.0):
            for hill in (0.0, 0.5, 1.0):
                c = lit(g, k, hill)
                out_[f'{name}, sun {k:g}, hill {hill:g}'] = out(c)
                out_[f'{name}, sun {k:g}, hill {hill:g}, 100 m contour'] = out(mixl(c, [dec(x / 255) for x in c100[0]], c100a))
                out_[f'{name}, sun {k:g}, hill {hill:g}, far (fog 0.85)'] = out(mixl(c, lin(P['sky']), 0.85))
    out_['sky'] = parse(P['sky'])
    if 'viewshed' in layers:
        for n, c in list(out_.items()):
            if 'fog' in n or n == 'sky': continue
            seen, hid = viewshed_states(c)
            out_[n + ', seen'] = seen; out_[n + ', hidden'] = hid
    out_['water surface over mid ground'] = over(parse(P['water']), 0.62, out(lit(grounds['mid ground'], 1.0, 0.5)))
    return out_

def viewshed_states(c, v=None):
    v = v or VIEWSHED
    bl = [dec(x / 255) for x in c]
    if 'veil' in v:
        return out(mixl(bl, lin(P['viewshed']), v['tint'])), out(mixl(bl, lin(v['veil']), v['veil_a']))
    gy = 0.2126 * bl[0] + 0.7152 * bl[1] + 0.0722 * bl[2]
    return out(mixl(bl, lin(P['viewshed']), v['tint'])), out([x * v['dim'] for x in mixl(bl, [gy] * 3, v['gray'])])

def main():
    if '--json' in sys.argv:
        print(json.dumps({'burn': BURN, 'label': LABEL, 'casing': CASING, 'viewshed': VIEWSHED,
                          'ghost': {'stroke': GHOST['stroke'], 'halo': list(GHOST['halo']), 'haloAlpha': GHOST['halo_a'], 'rest': GHOST['rest']}}))
        return
    ok = True
    def need(cond, label):
        nonlocal ok
        ok &= bool(cond)
        return 'ok' if cond else 'LOW'

    print('== chrome tokens (HOUSE 3.1): WCAG 2 contrast (text >= 4.5, line-strong >= 3)')
    for th, t in TOK.items():
        res = []
        for n, a, b in [('ink/page', 'ink', 'page'), ('ink-2/page', 'ink2', 'page'), ('ink-3/page', 'ink3', 'page'),
                        ('ink/sheet', 'ink', 'sheet'), ('ink-2/sheet', 'ink2', 'sheet'), ('ink-3/sheet', 'ink3', 'sheet')]:
            c = cr(parse(t[a]), parse(t[b])); need(c >= 4.5, n); res.append(f'{n} {c:.2f}')
        e = cr(parse(t['strong']), parse(t['page'])); need(e >= 3, 'strong'); res.append(f'line-strong/page {e:.2f}')
        print(f'  {th}: ' + ', '.join(res))
    cmax = max(lch8(parse(h))[1] for t in TOK.values() for h in t.values())
    print(f'  highest chroma of any chrome token: {cmax:.4f} (<= 0.024) {need(cmax <= 0.024, "chroma")}')

    print('== the signature: the burn on the time track, over the player\'s ground (--page)')
    for th in ('light', 'dark'):
        b, t = parse(BURN[th]), TOK[th]
        L, C, h = lch8(b); Li = lch8(parse(t['ink']))[0]; Lp = lch8(parse(t['page']))[0]
        beyond = (L < Li) if th == 'light' else (L > Li)
        on_page = cr(b, parse(t['page']))
        ring = cr(parse(t['page']), b)        # the thumb's --page ring where it stands on the burn
        outline = cr(parse(t['ink3']), parse(t['page']))
        print(f'  {th}: burn {BURN[th]} OKLCh {L:.3f} {C:.4f} {h:.0f}; page L {Lp:.3f}, ink L {Li:.3f}; '
              f'beyond --ink: {beyond} {need(beyond, "beyond")}; chroma <= 0.021 {need(C <= 0.021, "c")}')
        print(f'         burn on page {on_page:.2f} (mark, >= 3) {need(on_page >= 3, "burn")}; thumb ring on burn {ring:.2f} (>= 3) {need(ring >= 3, "ring")}; '
              f'sun-up outline (--ink-3, 1 px) on page {outline:.2f} (>= 3) {need(outline >= 3, "outline")}')
    for name, h in OTHERS.items():
        th = 'light' if name.endswith('light') else 'dark'
        d = math.dist(lab8(parse(BURN[th])), lab8(parse(h)))
        print(f'  burn ({th}) against {name} {h}: dE {d:.3f} (a different mark; hue {lch8(parse(BURN[th]))[2]:.0f} against {lch8(parse(h))[2]:.0f})')

    print('== the trail\'s red in the chrome (the profile\'s steep stretches, 3 px, on --page): each theme reads its own block of data/colors.json')
    for th, t in TOK.items():
        r = parse(COLORS[th]['route'])
        a = cr(r, parse(t['page']))
        print(f'  {th}: "route" {COLORS[th]["route"]} on page {a:.2f} (mark, >= 3) {need(a >= 3, "red")}')

    bases = plate_bases()
    allb = {**plate_bases(('bands', 'slope', 'viewshed')), **bases}
    Ls = [lch8(c)[0] for c in bases.values()]
    print('== the plate (one appearance, data/colors.json "light" in both themes), modeled from the shader')
    print(f'  ground: sky {P["sky"]} L {lch8(parse(P["sky"]))[0]:.3f}; default layers\' rendered terrain L {min(Ls):.3f} .. {max(Ls):.3f} '
          f'({len(bases)} cases: low, mid, high ground, glacier, lake tint; sun 0, 0.5, 1; hillshade 0, 0.5, 1; with a 100 m contour; fogged)')
    def worst(fg_over):
        w = (99, None)
        for n, b in allb.items():
            x = fg_over(b)
            if x < w[0]: w = (x, n)
        return w
    halo = lambda b: over(parse(LABEL['halo']), LABEL['halo_a'], b)
    w1 = worst(lambda b: cr(parse(LABEL['ink']), halo(b)))
    w2 = worst(lambda b: cr(parse(LABEL['ink2']), halo(b)))
    print(f'  labels: ink {LABEL["ink"]} on a 3 px halo {LABEL["halo"]} at {LABEL["halo_a"]}, worst {w1[0]:.2f} over "{w1[1]}" (text, >= 4.5) {need(w1[0] >= 4.5, "lab")}')
    print(f'          second line {LABEL["ink2"]} on the same halo, worst {w2[0]:.2f} over "{w2[1]}" (text, >= 4.5) {need(w2[0] >= 4.5, "lab2")}')
    case = lambda b: over(parse(CASING['color']), CASING['alpha'], b)
    for name, key in (('trail', 'route'), ('marker', 'marker')):
        c = parse(P[key])
        bare = worst(lambda b: cr(c, b))
        cased = worst(lambda b: cr(c, case(b)))
        print(f'  {name} {P[key]} (data/colors.json "{key}"): bare on the terrain, worst {bare[0]:.2f} over "{bare[1]}"; '
              f'on its casing ({CASING["color"]} at {CASING["alpha"]}, {CASING["px"]} px each side), worst {cased[0]:.2f} (mark, >= 3) {need(cased[0] >= 3, name)}')
    g = worst(lambda b: cr(over(parse(GHOST['stroke']), GHOST['rest'], over(GHOST['halo'], GHOST['halo_a'], b)), over(GHOST['halo'], GHOST['halo_a'], b)))
    print(f'  ghost key, one style in both themes (the plate is one appearance): stroke {GHOST["stroke"]} at rest {GHOST["rest"]} over a halo '
          f'{hx(GHOST["halo"])} at {GHOST["halo_a"]}, worst {g[0]:.2f} over "{g[1]}" (>= 3) {need(g[0] >= 3, "ghost")}')

    print(f'== the viewshed\'s two states (js/material.js): seen = mix toward {P["viewshed"]} at {VIEWSHED["tint"]}; '
          f'hidden = veiled toward {VIEWSHED["veil"]} at {VIEWSHED["veil_a"]}')
    for label, v, must in (('as built by this pass', VIEWSHED, True), ('stock, for the record', STOCK_VIEWSHED, False)):
        low = (99, None)
        for n, b in bases.items():
            if 'fog' in n or n == 'sky' or 'water' in n: continue
            s = min(sep(*viewshed_states(b, v)).values())
            if s < low[0]: low = (s, n)
        flag = need(low[0] >= 0.10, 'vs') if must else 'reported'
        print(f'  {label}: seen against hidden over the same ground, worst dE {low[0]:.3f} over "{low[1]}" (all four visions, >= 0.10) {flag}')

    print('== the measure and line-of-sight line (js/overlays.js): the marker ink on the casing, solid where the sight is clear and dashed '
          'where the terrain blocks it, so no color carries "blocked" (stock: "viewshed" teal, then the trail\'s own red past the block)')
    wl = worst(lambda b: cr(parse(P['marker']), case(b)))
    st = worst(lambda b: cr(parse(P['viewshed']), case(b)))
    print(f'  {P["marker"]} on its casing, worst {wl[0]:.2f} (mark, >= 3) {need(wl[0] >= 3, "tool")}; the stock clear color {P["viewshed"]} on the same casing would be {st[0]:.2f}')

    print('== data-owned pairs (data/colors.json, written by tools/06_editable.py): checked at the pair target since the pipeline follow-up, two reported')
    hi_lit = out(lit(lin(P['terrain']), 1.0, 0.5))
    s30 = out(lit(mixl(lin(P['terrain']), lin(P['slope30']), 0.75), 1.0, 0.5))
    s40 = out(lit(mixl(mixl(lin(P['terrain']), lin(P['slope30']), 0.75), lin(P['slope40']), 0.85), 1.0, 0.5))
    vis = lambda d: ', '.join(f'{k} {v:.3f}' for k, v in d.items())
    sc = sep(s30, s40)
    print(f'  slope classes {P["slope30"]} and {P["slope40"]} (the 40 drawn over the 30, as the shader mixes them), rendered in full sun over high ground: '
          f'{vis(sc)} (pair target 0.10) {need(min(sc.values()) >= 0.10, "slopes")}')
    same = P['slope40'].lower() == P['route'].lower()
    tf, tr = sep(parse(P['slope40']), parse(P['route'])), sep(s40, parse(P['route']))
    print(f'  slope 40 class against the trail: {"the same color" if same else "different colors"}, {P["slope40"]} and {P["route"]}; as named colors (flat) '
          f'{vis(tf)} (pair target 0.10) {need(not same and min(tf.values()) >= 0.10, "slope40")}')
    print(f'      the class as rendered in full sun over high ground ({hx(s40)}) against the trail\'s line color: {vis(tr)} (reported: the trail is a line on its casing, the class an area)')
    D = COLORS['dark']
    print(f'      the dark block, which the plate never draws (owner call 2): slope 40 {D["slope40"]} against "route" {D["route"]}, flat, worst {min(sep(parse(D["slope40"]), parse(D["route"])).values()):.3f}')
    worst_b = (99, None)
    for i in range(len(BANDS)):
        for j in range(i + 1, len(BANDS)):
            s = min(sep(out(lit(lin(BANDS[i]), 1.0, 0.5)), out(lit(lin(BANDS[j]), 1.0, 0.5))).values())
            if s < worst_b[0]: worst_b = (s, f'{BANDS[i]} and {BANDS[j]}')
    print(f'  elevation bands {", ".join(BANDS)} (toM {", ".join(str(b["toM"]) for b in COLORS["elevationBands"])}), rendered in full sun: '
          f'closest pair {worst_b[1]}, dE {worst_b[0]:.3f} in the worst of the four visions (pair target 0.10) {need(worst_b[0] >= 0.10, "bands")}')
    w = min(sep(out(lit(lin(P['water']), 1.0, 0.5)), hi_lit).values())
    print(f'  lake tint {P["water"]} against high ground in full sun: dE {w:.3f} in the worst vision (reported: lakes also have their surface mesh and their names)')

    print('ALL CHECKS PASS' if ok else 'SOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
