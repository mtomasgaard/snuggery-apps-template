"""Power Hours' palette under the house system (ART.md section 2): the house's chrome tokens, the app's one
data color fitted into each theme's band (--price, the staircase of quarter-hour prices and, at 16 %, the
fill between the zero rule and a price below zero), the Landing's ink (the signature: the chosen
appliance's cheapest run, drawn as a level at its mean price), and every contrast figure ART.md quotes,
with the stock look's figures for the record. Standard library only. Run from Template/:

    python3 power-hours/tools/art/palette.py          the checks; ends ALL CHECKS PASS or SOME CHECKS FAIL
    python3 power-hours/tools/art/palette.py --json   the fitted tokens per theme, for style.css (pasted,
                                                      never retyped; tools/check.mjs compares)

The data's own color is the stock style.css's light --accent, #2f6df6: the one hue the stock chart spent,
on the bars of the chosen window. The stock drew every other price in a neutral gray (--bar), which under
the house would read as chrome; the window is now the Landing's ink, so the blue moves to the price itself
and the gray goes. Only lightness is fitted, per theme; hue and chroma are kept where sRGB allows (HOUSE.md
3.2). The stock's three semantic colors (--good, --warning, --critical: the cheap and dear badges, the
saving in green, the amber stale stamp, the red problem card) and its accent go: words carry them now.

Color maths: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB: the same
functions as global-weather/tools/art/palette.py (by way of outdoor-window/tools/art/palette.py), copied
so that this folder stands alone.
"""
import json, math, sys

# -- color maths (global-weather/tools/art/palette.py, unchanged) -----------------------------
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
def de(a, b, kind='normal'): return math.dist(sim(a, kind), sim(b, kind))
def gamut_map(L, C, h):
    # Keeps L and hue and lowers chroma until the color is inside sRGB.
    while C > 1e-4 and not in_gamut(lab2lin(*lch2lab(L, C, h))): C *= 0.98
    return rgb8(lab2lin(*lch2lab(L, C, h)))

# -- the house's chrome tokens (HOUSE.md 3.1), copied as they are -----------------------------
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72',
               line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f',
               line='#2a373c', strong='#64757b'),
}

# -- the data's own color: the stock style.css's light --accent ---------------------------------
SOURCE = {'price': '#2f6df6'}

# -- the tonal budget (ART.md 2) ---------------------------------------------------------------
# One data color, so the band is one point per theme, inside the pane apps' family band (Running
# Dashboard, Finances, Outdoor Window: light L 0.400-0.625, dark 0.560-0.860). Four constraints pin it,
# measured by a throwaway search in steps of 0.01 (the art pass's, 2026-10-03): the staircase is a mark
# at 3:1 or more on the page and on the chosen quarter's column (ink at 7 % over the page); the Landing's
# ink stands 3:1 or more from the staircase it lies across; and the staircase stands 3:1 from its own
# 16 % fill below zero. Light passes from L 0.53 to 0.59 and takes 0.56, the step where ink-on-price and
# price-on-page are nearest equal; dark passes from 0.57 to 0.63 and takes the middle, 0.60.
BAND = {'light': (0.400, 0.625), 'dark': (0.560, 0.860)}
L_PRICE = {'light': 0.560, 'dark': 0.600}
NEG_FILL = 0.16     # --price over --page between the zero rule and a price below zero
PAST = 0.40         # the opacity of quarters that have ended (still data, no longer a choice)
CHOSEN = 0.07       # --ink over --page behind the chosen quarter's column

def fit(th):
    _, C, h = lch8(parse(SOURCE['price']))
    return {'price': hx(gamut_map(L_PRICE[th], C, h))}

# The stock look, for the record (ART.md section 2): what its chart and small text measured.
STOCK = {
 'light': dict(ground='#eef0f4', card='#ffffff', bar='#7c8695', accent='#2f6df6', muted='#687080',
               good='#0b7233', warning='#8a5f00', critical='#b8302f'),
 'dark':  dict(ground='#0b0e13', card='#151a22', bar='#69737f', accent='#5b8eff', muted='#8b94a3',
               good='#34c467', warning='#f2b322', critical='#f06060'),
}

def main():
    F = {th: fit(th) for th in BAND}
    if '--json' in sys.argv:
        print(json.dumps(F, indent=1)); return
    ok = True
    def check(cond, msg):
        nonlocal ok; ok &= bool(cond); print(('ok   ' if cond else 'FAIL ') + msg)

    print('== 1. chrome tokens: WCAG 2 contrast (text >= 4.5; --line-strong >= 3), chroma <= 0.024')
    for th, t in TOK.items():
        for g in ('page', 'sheet'):
            for k in ('ink', 'ink2', 'ink3'):
                c = cr(parse(t[k]), parse(t[g])); check(c >= 4.5, f'{th}: {k} on {g} {c:.2f}')
            c = cr(parse(t['strong']), parse(t[g])); check(c >= 3, f'{th}: line-strong on {g} {c:.2f}')
        cmax = max(lch8(parse(v))[1] for v in t.values()); check(cmax <= 0.024, f'{th}: highest chroma of any chrome token {cmax:.4f}')
        held = over(parse(t['ink']), CHOSEN, parse(t['page']))
        check(cr(parse(t['ink2']), held) >= 4.5, f'{th}: ink-2 on a row held down ({hx(held)}, ink at 7 % on page) {cr(parse(t["ink2"]), held):.2f}')

    print('\n== 2. --price, fitted per theme: in the band, hue and chroma kept, a mark at >= 3:1')
    for th in BAND:
        t = {k: parse(v) for k, v in TOK[th].items()}; p = parse(F[th]['price'])
        L, C, h = lch8(p); L0, C0, h0 = lch8(parse(SOURCE['price']))
        inband = BAND[th][0] - 0.002 <= L <= BAND[th][1] + 0.002
        check(inband, f'{th}: price {SOURCE["price"]} -> {F[th]["price"]}  L {L0:.3f} -> {L:.3f} (band {BAND[th][0]:.3f}-{BAND[th][1]:.3f}), C {C0:.3f} -> {C:.3f}, h {h0:.0f} -> {h:.0f}')
        check(abs(h - h0) < 2 and C >= C0 - 0.005, f'{th}: hue and chroma kept (h {h:.0f}, C {C:.3f})')
        check(cr(p, t['page']) >= 3, f'{th}: the staircase on the page {cr(p, t["page"]):.2f}')
        col = over(t['ink'], CHOSEN, t['page'])
        check(cr(p, col) >= 3, f'{th}: the staircase on the chosen column ({hx(col)}) {cr(p, col):.2f}')
        check(cr(p, t['line']) >= 2, f'{th}: the staircase across a midnight hairline {cr(p, t["line"]):.2f} (>= 2)')
        neg = over(p, NEG_FILL, t['page'])
        check(cr(p, neg) >= 3, f'{th}: the staircase on its own fill below zero ({hx(neg)}, price at 16 %) {cr(p, neg):.2f}')
        check(cr(t['strong'], neg) >= 2, f'{th}: the zero rule (--line-strong) against that fill {cr(t["strong"], neg):.2f} (>= 2; it is also against the page, {cr(t["strong"], t["page"]):.2f})')
        past = over(p, PAST, t['page'])
        print(f'     {th}: a quarter that has ended, price at 40 % ({hx(past)}) on the page {cr(past, t["page"]):.2f}: faint on purpose, not held to 3:1 (the readout still reads it)')

    print('\n== 3. the signature: the Landing, --ink, at the far end of the range, apart from --price')
    for th in BAND:
        t = {k: parse(v) for k, v in TOK[th].items()}; ink = t['ink']; p = parse(F[th]['price'])
        L, C, h = lch8(ink)
        check(C <= 0.024, f'{th}: the ink {TOK[th]["ink"]} is a near-neutral (L {L:.3f}, C {C:.4f})')
        far = (L < BAND[th][0]) if th == 'light' else (L > BAND[th][1])
        check(far, f'{th}: the ink keeps the far end (L {L:.3f}; band {BAND[th][0]:.3f}-{BAND[th][1]:.3f})')
        check(cr(ink, t['page']) >= 3, f'{th}: the level, its posts and its bracket, ink on page {cr(ink, t["page"]):.2f}')
        check(cr(ink, p) >= 3, f'{th}: the level across the staircase, ink against price {cr(ink, p):.2f} (the lowest signature figure)')
        for kind in ('normal', 'deutan', 'protan', 'tritan'):
            d = de(ink, p, kind); check(d >= 0.10, f'{th}: ink against price, {kind}, dE {d:.3f}')
        past = over(p, PAST, t['page'])
        check(cr(ink, past) >= 3, f'{th}: the level across an ended quarter (history mode) {cr(ink, past):.2f}')
        neg = over(p, NEG_FILL, t['page'])
        check(cr(ink, neg) >= 3, f'{th}: the level inside the fill below zero {cr(ink, neg):.2f}')
        col = over(ink, CHOSEN, t['page'])
        check(cr(ink, col) >= 3, f'{th}: the level on the chosen column {cr(ink, col):.2f}')
        check(cr(t['page'], ink) >= 3, f'{th}: the tracer head\'s --page ring against its ink {cr(t["page"], ink):.2f}')
        check(cr(ink, t['line']) >= 3, f'{th}: a post across a midnight hairline {cr(ink, t["line"]):.2f}')
        # The mean ahead: a 1 px --ink-3 rule, dashed 3 on 3. A reference line, not the signature.
        print(f'     {th}: the mean-ahead rule, ink-3 on page {cr(t["ink3"], t["page"]):.2f}, against the level {cr(t["ink3"], ink):.2f} (told apart by weight, solid against dashed, and its label)')

    print('\n== 4. text on the plate and the pane (all >= 4.5)')
    for th in BAND:
        t = {k: parse(v) for k, v in TOK[th].items()}
        # Text that can sit over the chosen quarter's column (the plot's rows only) is --ink-2 or --ink:
        # --ink-3 on that column is 4.16 in the light theme, so `now` keeps its own row above the plot,
        # where the column's tint never reaches, and the mean-ahead label is --ink-2.
        col = over(t['ink'], CHOSEN, t['page'])
        c = cr(t['ink2'], t['page']); check(c >= 4.5, f'{th}: axis and day labels, the Landing\'s and the mean\'s labels, the readout\'s values, ink2 on page {c:.2f}')
        c = cr(t['ink2'], col); check(c >= 4.5, f'{th}: ink2 on the chosen column {c:.2f}')
        c = cr(t['ink3'], t['page']); check(c >= 4.5, f'{th}: `now` in its own row, ink3 on page {c:.2f}')
        print(f'     {th}: ink3 on the chosen column {cr(t["ink3"], col):.2f}: never set there (the reason `now` has its own row)')
        c = cr(t['ink'], t['page']); check(c >= 4.5, f'{th}: values, the large figure, ink on page {c:.2f}')

    print('\n== 5. notices and About (--sheet, a 1 px --line-strong edge)')
    for th in BAND:
        t = {k: parse(v) for k, v in TOK[th].items()}
        check(cr(t['strong'], t['page']) >= 3, f'{th}: a notice\'s edge on the page {cr(t["strong"], t["page"]):.2f}')
        check(cr(t['ink'], t['sheet']) >= 4.5 and cr(t['ink2'], t['sheet']) >= 4.5, f'{th}: About\'s text, ink {cr(t["ink"], t["sheet"]):.2f}, ink-2 {cr(t["ink2"], t["sheet"]):.2f} on sheet')

    print('\n== 6. the stock look, for the record (not checked: what this pass replaces)')
    for th, s in STOCK.items():
        P = lambda k: parse(s[k])
        print(f'     {th}: a price bar on its card {cr(P("bar"), P("card")):.2f}; the window\'s blue on the card {cr(P("accent"), P("card")):.2f}; bar against window blue {cr(P("bar"), P("accent")):.2f}')
        print(f'     {th}: muted text on the ground {cr(P("muted"), P("ground")):.2f}; the amber stale stamp {cr(P("warning"), P("ground")):.2f}; the saving in green {cr(P("good"), P("card")):.2f}; the problem red {cr(P("critical"), P("card")):.2f}')

    print('\nALL CHECKS PASS' if ok else '\nSOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
