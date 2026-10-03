"""Finances' palette under the house system (ART.md section 2): the house's chrome tokens, the app's
data colors fitted into each theme's band (the six categorical slots: every two-series chart's pair
and the funds of the allocation strip; --amount, the tone of every chart of one quantity), the
Balance's ink (the signature), the ink marks over data on their casings, and every contrast figure
ART.md quotes. Standard library only. Run from Template/:

    python3 finances/tools/art/palette.py          the checks; ends ALL CHECKS PASS or SOME CHECKS FAIL
    python3 finances/tools/art/palette.py --json   the fitted tokens per theme, for style.css (pasted,
                                                   never retyped; tools/check.mjs compares)

The app's data colors are not in a data file: they are the stock style.css's light tokens (the hue and
chroma each categorical slot was given before this pass), copied below as SOURCE. Only lightness is
fitted, per theme; hue is kept and chroma is kept where sRGB allows (HOUSE.md 3.2: a chart's series
keep their identities). One slot changes hue, and says so at SOURCE.

Color maths: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB: the same
functions as global-weather/tools/art/palette.py (by way of running-dashboard/tools/art/palette.py),
copied so that this folder stands alone.
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

# -- the data's own colors: the stock style.css's light categorical slots ----------------------
# Hue and chroma are what is kept. Slot 1 is the first series of every two-series chart (In, Owned,
# Value) and the largest fund; slot 2 the second series (Out, Owed, Paid in) and the second fund;
# slots 3 to 6 the third to sixth funds of the allocation strip (the sixth is "Other" when there are
# more than six). Slot 6 was a second green in the stock file (#008300, h 142, against slot 3's
# #1baf7a, h 162: dE 0.156 as the stock drew them), so a portfolio of six funds showed two greens a
# reader takes for kin; it takes a violet here (Running Dashboard's slot 6 hue), the one slot whose
# hue changes. Measured, not assumed: the same search with the stock green kept finds a closest pair
# of 0.164 and must put slot 1 in the middle of the band; with the violet, 0.173 and slot 1 at its edge.
SOURCE = {
    'series-1': '#2a78d6', 'series-2': '#eb6834', 'series-3': '#1baf7a',
    'series-4': '#eda100', 'series-5': '#e87ba4', 'series-6': '#7f62d6',
}
SERIES = ['series-%d' % i for i in range(1, 7)]
PAIR = ['series-1', 'series-2']

# -- the tonal budget (ART.md 2) ---------------------------------------------------------------
# Every data color lives in the theme's band: in the light theme below the page (darker), in the dark
# theme above it; the signature, --ink, keeps the far end of the range in both. The band is the widest
# that keeps every token at 3:1 on both --page and --sheet and clear of the ink: the same constraint,
# and so the same band, as Running Dashboard's.
BAND = {'light': (0.400, 0.625), 'dark': (0.560, 0.860)}
# Where each token sits in the band, 0 nearest the ground to 1 the far edge. Found by a search over a
# grid of twentieths (a throwaway script of the art pass, 40 000 draws, seed 7) for the widest closest
# pair across the six slots in both themes, every token at 3:1 or more on both grounds, the pair
# (slots 1 and 2) at 0.10 or more under deutan, protan and tritan vision as well, and slot 1 at least
# 0.3 of the band further from the ground than slot 2, so the first series of a pair (In, Owned, Value)
# is the stronger line and the one it is read against (Out, Owed, Paid in) the quieter. The closest
# pair it found: 0.173. Apart from that one order the steps are not a salience order: the slots are
# categories, named in every legend.
STEP = {'series-1': 0.95, 'series-2': 0.00, 'series-3': 0.25, 'series-4': 0.95, 'series-5': 0.55,
        'series-6': 0.15}
# --amount, the tone of every chart of one quantity (net worth over time, spending by category, a loan's
# share repaid): a quiet slate, low in chroma, so a quantity's hue encodes nothing and the Balance stays
# the one bold thing. The house's pane-app slate, Running Dashboard's values, so the pane apps read as
# one family. (L, C, h) per theme, inside the band, 3:1 or more on both grounds (check 2).
AMOUNT = {'light': (0.500, 0.065, 255), 'dark': (0.740, 0.050, 250)}

def fit(th):
    b0, b1 = BAND[th]
    out = {}
    for k, src in SOURCE.items():
        _, C, h = lch8(parse(src))
        s = STEP[k]
        L = (b1 - (b1 - b0) * s) if th == 'light' else (b0 + (b1 - b0) * s)
        out[k] = hx(gamut_map(L, C, h))
    out['amount'] = hx(gamut_map(*AMOUNT[th]))
    return out

def main():
    F = {th: fit(th) for th in BAND}
    if '--json' in sys.argv:
        print(json.dumps(F, indent=1)); return
    ok = True
    def check(cond, msg):
        nonlocal ok; ok &= bool(cond); print(('ok   ' if cond else 'FAIL ') + msg)

    print('== 1. chrome tokens: WCAG 2 contrast (text >= 4.5; --line-strong >= 3)')
    for th, t in TOK.items():
        for g in ('page', 'sheet'):
            for k in ('ink', 'ink2', 'ink3'):
                c = cr(parse(t[k]), parse(t[g])); check(c >= 4.5, f'{th}: {k} on {g} {c:.2f}')
            c = cr(parse(t['strong']), parse(t[g])); check(c >= 3, f'{th}: line-strong on {g} {c:.2f}')
        cmax = max(lch8(parse(v))[1] for v in t.values()); check(cmax <= 0.024, f'{th}: highest chroma of any chrome token {cmax:.4f} (<= 0.024)')
        on = over(parse(t['ink']), 0.12, parse(t['sheet']))
        check(cr(parse(t['ink']), on) >= 4.5, f'{th}: ink on the on-plate {hx(on)} {cr(parse(t["ink"]), on):.2f}')
        check(cr(parse(t['ink2']), on) >= 4.5, f'{th}: ink-2 on the on-plate {cr(parse(t["ink2"]), on):.2f}')

    print('\n== 2. data tokens, fitted per theme: in the band, each a mark at >= 3:1 on --page and --sheet')
    for th in BAND:
        t = TOK[th]; lows = []
        for k in SERIES:
            c = F[th][k]; L, C, h = lch8(parse(c)); L0, C0, h0 = lch8(parse(SOURCE[k]))
            cp, cs = cr(parse(c), parse(t['page'])), cr(parse(c), parse(t['sheet'])); lows.append((min(cp, cs), k))
            inband = BAND[th][0] - 0.002 <= L <= BAND[th][1] + 0.002
            check(inband and cp >= 3 and cs >= 3,
                  f'{th}: {k} {SOURCE[k]} -> {c}  L {L0:.3f} -> {L:.3f}, C {C0:.3f} -> {C:.3f}, h {h0:.0f} -> {h:.0f}; on page {cp:.2f}, on sheet {cs:.2f}')
        c = F[th]['amount']; L, C, h = lch8(parse(c)); cp, cs = cr(parse(c), parse(t['page'])), cr(parse(c), parse(t['sheet']))
        lows.append((min(cp, cs), 'amount'))
        check(BAND[th][0] - 0.002 <= L <= BAND[th][1] + 0.002 and cp >= 3 and cs >= 3 and C <= 0.07,
              f'{th}: amount   {c}  L {L:.3f}, C {C:.3f} (<= 0.07, a slate), h {h:.0f}; on page {cp:.2f}, on sheet {cs:.2f}')
        # The bars of one quantity (spending by category, a loan's share repaid) run on a --line track.
        tr = cr(parse(c), parse(t['line'])); check(tr >= 2, f'{th}: amount on its --line track {tr:.2f} (the track is a hairline ground, >= 2)')
        lo = min(lows); print(f'     {th}: the lowest data-on-ground contrast {lo[0]:.2f} ({lo[1]}; target 3.0, a mark)')

    print('\n== 3. categories: every pair apart by dE (OKLab) >= 0.10 under normal vision; the pair under all three')
    print('     simulations too, because every two-series chart (In and Out, Owned and Owed, Value and Paid in)')
    print('     draws it. The six together are the funds of the allocation strip: where a pair of them falls')
    print('     short under a simulation it is a stated departure (ART.md section 2), printed "dep", and the')
    print('     strip\'s legend and its readout name every fund, so color never carries identity alone.')
    for th in BAND:
        for kind in ('normal', 'deutan', 'protan', 'tritan'):
            d = de(parse(F[th]['series-1']), parse(F[th]['series-2']), kind)
            check(d >= 0.10, f'{th}: the pair series-1/series-2, {kind}, dE {d:.3f}')
        for kind in ('normal', 'deutan', 'protan', 'tritan'):
            pairs = sorted((de(parse(F[th][a]), parse(F[th][b]), kind), a, b) for i, a in enumerate(SERIES) for b in SERIES[i + 1:])
            low = [p for p in pairs if p[0] < 0.10]
            msg = f'{th}, the six slots, {kind}: closest {pairs[0][1]}/{pairs[0][2]} dE {pairs[0][0]:.3f}; {len(low)} of {len(pairs)} under 0.10'
            if kind == 'normal': check(not low, msg)
            elif low: print('dep  ' + msg + ': ' + ', '.join(f'{a}/{b} {d:.3f}' for d, a, b in low))
            else: print('ok   ' + msg)
        d = min(de(parse(F[th]['amount']), parse(F[th][k])) for k in SERIES)
        print(f'     {th}: --amount against the nearest slot dE {d:.3f} (never on one chart with a slot; printed for the record)')

    print('\n== 4. the signature: the Balance, --ink on --page, at the far end of the range')
    for th in BAND:
        t = TOK[th]; ink = parse(t['ink']); L, C, h = lch8(ink)
        check(C <= 0.024, f'{th}: the ink {t["ink"]} is a near-neutral (L {L:.3f}, C {C:.4f})')
        check(cr(ink, parse(t['page'])) >= 3, f'{th}: a block of what is owned or owed, ink on page {cr(ink, parse(t["page"])):.2f} (target 3.0, a mark)')
        far = (L < BAND[th][0]) if th == 'light' else (L > BAND[th][1])
        check(far, f'{th}: the ink keeps the far end (L {L:.3f}; band {BAND[th][0]:.3f}-{BAND[th][1]:.3f})')
        check(cr(ink, parse(t['page'])) >= 3, f'{th}: the 1 px gap between two blocks, and the empty balancing space, are the page itself: {cr(ink, parse(t["page"])):.2f} against the ink')
        check(cr(parse(t['ink2']), parse(t['page'])) >= 4.5, f'{th}: the blocks\' names and the depth values, ink-2 on page {cr(parse(t["ink2"]), parse(t["page"])):.2f}')
        check(cr(parse(t['ink3']), parse(t['page'])) >= 4.5, f'{th}: the scale\'s values, ink-3 on page {cr(parse(t["ink3"]), parse(t["page"])):.2f}')
        check(cr(parse(t['line']), parse(t['page'])) < 1.5, f'{th}: the depth hairlines, --line on page {cr(parse(t["line"]), parse(t["page"])):.2f} (quiet on purpose, under 1.5)')
        # The tapped block is marked by a 1 px --page ring inset inside its ink (the house's selection
        # is ink, never a hue): the ring against the ink it is cut into.
        check(cr(parse(t['page']), ink) >= 3, f'{th}: the tapped block\'s inset --page ring against its ink {cr(parse(t["page"]), ink):.2f}')

    print('\n== 5. ink over the data (a cursor\'s discs, the net-worth line\'s end dot): on a 2 px --page ring')
    for th in BAND:
        t = TOK[th]; ink = parse(t['ink'])
        worst = min((cr(ink, parse(F[th][k])), k) for k in SERIES + ['amount'])
        print(f'     {th}: without the ring, ink over the closest data color ({worst[1]}) would be {worst[0]:.2f}')
        check(cr(ink, parse(t['page'])) >= 3, f'{th}: ink on its --page ring {cr(ink, parse(t["page"])):.2f}')

    print('\n== 6. the readout card and notices (--sheet, a 1 px --line-strong edge)')
    for th, t in TOK.items():
        check(cr(parse(t['strong']), parse(t['page'])) >= 3, f'{th}: the card\'s edge on the page {cr(parse(t["strong"]), parse(t["page"])):.2f}')
        check(cr(parse(t['ink2']), parse(t['sheet'])) >= 4.5, f'{th}: the card\'s labels, ink-2 on sheet {cr(parse(t["ink2"]), parse(t["sheet"])):.2f}')

    print('\nALL CHECKS PASS' if ok else '\nSOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
