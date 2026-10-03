"""Outdoor Window's palette under the house system (ART.md section 2): the house's chrome tokens, the
app's one data color fitted into each theme's band (--used, the share of a rule's allowance an hour uses,
drawn as the short bars inside the Shutters' rows), the Shutters' ink (the signature: the hours a rule
rules out), and every contrast figure ART.md quotes, with the stock look's figures for the record.
Standard library only. Run from Template/:

    python3 outdoor-window/tools/art/palette.py          the checks; ends ALL CHECKS PASS or SOME CHECKS FAIL
    python3 outdoor-window/tools/art/palette.py --json   the fitted tokens per theme, for style.css (pasted,
                                                         never retyped; tools/check.mjs compares)

The data's own color is the stock style.css's light --bar-good, #17916c: green for an hour inside the
rules. Only lightness is fitted, per theme; hue and chroma are kept where sRGB allows (HOUSE.md 3.2: an
app keeps its data's own color logic, inside the band). The stock's other bar colors (--bar-near,
--bar-bad) and its accent (--accent, --accent-soft) go: a failing hour is ink now, not a pale gray, and
the house has no accent.

Color maths: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB: the same
functions as global-weather/tools/art/palette.py (by way of finances/tools/art/palette.py), copied so
that this folder stands alone.
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

# -- the data's own color: the stock style.css's light --bar-good ------------------------------
SOURCE = {'used': '#17916c'}

# -- the tonal budget (ART.md 2) ---------------------------------------------------------------
# The data band is one point per theme, because the app has one data color, inside the pane apps'
# family band (Running Dashboard, Finances: light L 0.400-0.625, dark 0.560-0.860). Two constraints
# pin it, measured by a throwaway search in steps of 0.01: the bar is a mark at 3:1 or more on the page
# and on the chosen hour's column (ink at 7 % over the page), and a bar at its full 12 px stands 3:1 or
# more from a block of ink beside it (check 3), so a rule at its limit never reads as a rule broken.
# Light: 0.57 is the middle of the passing span 0.54-0.58. Dark: 0.60 is the lightest step that keeps
# 3:1 against the ink (0.61 gives 3.01, 0.62 fails).
BAND = {'light': (0.400, 0.625), 'dark': (0.560, 0.860)}
L_USED = {'light': 0.570, 'dark': 0.600}

def fit(th):
    _, C, h = lch8(parse(SOURCE['used']))
    return {'used': hx(gamut_map(L_USED[th], C, h))}

# The stock look, for the record (ART.md section 2): what its bars and small text measured.
STOCK = {
 'light': dict(ground='#f2f4f6', card='#ffffff', good='#17916c', near='#b9c2cc', bad='#d7dde3',
               muted='#69707e', soft='#dcefe7', accent='#0f7a5a', warn='#a35a12'),
 'dark':  dict(ground='#0c0f13', card='#161b21', good='#3fbd92', near='#4a545f', bad='#2a323b',
               muted='#8a939f', soft='#14312a', accent='#4fc79b', warn='#e0a35f'),
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
        on = over(parse(t['ink']), 0.12, parse(t['sheet']))
        check(cr(parse(t['ink']), on) >= 4.5, f'{th}: ink on the on-plate {hx(on)} {cr(parse(t["ink"]), on):.2f}')
        held = over(parse(t['ink']), 0.07, parse(t['page']))
        check(cr(parse(t['ink2']), held) >= 4.5, f'{th}: ink-2 on a row held down ({hx(held)}, ink at 7 % on page) {cr(parse(t["ink2"]), held):.2f}')

    print('\n== 2. --used, fitted per theme: in the band, a mark at >= 3:1 on --page (the bars are drawn on the page)')
    for th in BAND:
        t = TOK[th]; c = F[th]['used']; L, C, h = lch8(parse(c)); L0, C0, h0 = lch8(parse(SOURCE['used']))
        cp = cr(parse(c), parse(t['page']))
        inband = BAND[th][0] - 0.002 <= L <= BAND[th][1] + 0.002
        check(inband and cp >= 3, f'{th}: used {SOURCE["used"]} -> {c}  L {L0:.3f} -> {L:.3f}, C {C0:.3f} -> {C:.3f}, h {h0:.0f} -> {h:.0f}; on page {cp:.2f}')
        check(abs(h - h0) < 2 and C >= C0 - 0.005, f'{th}: hue and chroma kept (h {h:.0f}, C {C:.3f})')
        # A bar crosses no hairline (the rows have no grid), but the axis' --line hairlines at local
        # midnight run through the stack: a bar against one.
        cl = cr(parse(c), parse(t['line'])); check(cl >= 2, f'{th}: used against a --line hairline {cl:.2f} (>= 2)')

    print('\n== 3. the signature: the Shutters, --ink on --page, at the far end of the range, apart from --used')
    for th in BAND:
        t = TOK[th]; ink = parse(t['ink']); L, C, h = lch8(ink); u = parse(F[th]['used'])
        check(C <= 0.024, f'{th}: the ink {t["ink"]} is a near-neutral (L {L:.3f}, C {C:.4f})')
        far = (L < BAND[th][0]) if th == 'light' else (L > BAND[th][1])
        check(far, f'{th}: the ink keeps the far end (L {L:.3f}; band {BAND[th][0]:.3f}-{BAND[th][1]:.3f})')
        check(cr(ink, parse(t['page'])) >= 3, f'{th}: a block (an hour a rule rules out), ink on page {cr(ink, parse(t["page"])):.2f} (target 3.0, a mark)')
        check(cr(ink, u) >= 3, f'{th}: a block beside a full-height bar, ink against used {cr(ink, u):.2f} (>= 3: at the limit never reads as past it)')
        for kind in ('normal', 'deutan', 'protan', 'tritan'):
            d = de(ink, u, kind); check(d >= 0.10, f'{th}: ink against used, {kind}, dE {d:.3f}')
        check(cr(ink, parse(t['line'])) >= 3, f'{th}: a block across a midnight hairline {cr(ink, parse(t["line"])):.2f}')
        # A hollow block (no value in the file for that rule and hour): a 1 px ink outline on the page.
        check(cr(ink, parse(t['page'])) >= 3, f'{th}: a hollow block\'s 1 px outline on page {cr(ink, parse(t["page"])):.2f}')
        # The window brackets and the tracer head on the axis: ink on page; the head's ring is --page.
        check(cr(parse(t['page']), ink) >= 3, f'{th}: the tracer head\'s --page ring against its ink {cr(parse(t["page"]), ink):.2f}')
        # The chosen hour's column: --ink at 7 % over the page under the stack; the bars and blocks on it.
        col = over(ink, 0.07, parse(t['page']))
        check(cr(u, col) >= 3 and cr(ink, col) >= 3, f'{th}: on the chosen column ({hx(col)}): used {cr(u, col):.2f}, ink {cr(ink, col):.2f}')
        # A window, drawn as one (after review): its opening lit with --sheet from the stack's top to the sill,
        # framed by 1 px ink jambs and a 2 px ink sill. The bars in it stand on --sheet, and on the chosen
        # column over it; the jambs read against the opening and the page; the lit tone itself is a ground,
        # not a mark (the frame carries the edge), so its step from the page is printed, not held to 3:1.
        sh = parse(t['sheet']); lcol = over(ink, 0.07, sh)
        check(cr(u, sh) >= 3 and cr(u, lcol) >= 3, f'{th}: a bar in a window, used on the lit opening {cr(u, sh):.2f}, on the chosen column there ({hx(lcol)}) {cr(u, lcol):.2f}')
        check(cr(ink, sh) >= 3 and cr(ink, parse(t['page'])) >= 3, f'{th}: a jamb or sill, ink on the opening {cr(ink, sh):.2f}, on the page {cr(ink, parse(t["page"])):.2f}')
        print(f'     {th}: the lit opening against the page {cr(sh, parse(t["page"])):.2f} (a ground: --sheet, L {lch8(sh)[0]:.3f} against L {lch8(parse(t["page"]))[0]:.3f}); a midnight hairline across it {cr(parse(t["line"]), sh):.2f}')

    print('\n== 4. text on the Shutters and the panes (all >= 4.5)')
    for th in BAND:
        t = TOK[th]
        for k, what in (('ink2', 'row labels, hour counts, axis labels, a failed hour\'s rules'), ('ink3', '`now`, the head of the hours table')):
            c = cr(parse(t[k]), parse(t['page'])); check(c >= 4.5, f'{th}: {what}, {k} on page {c:.2f}')
        c = cr(parse(t['ink']), parse(t['page'])); check(c >= 4.5, f'{th}: values and a passing hour\'s time, ink on page {c:.2f}')

    print('\n== 5. the readout card and notices (--sheet, a 1 px --line-strong edge)')
    for th, t in TOK.items():
        check(cr(parse(t['strong']), parse(t['page'])) >= 3, f'{th}: the card\'s edge on the page {cr(parse(t["strong"]), parse(t["page"])):.2f}')
        check(cr(parse(t['ink2']), parse(t['sheet'])) >= 4.5, f'{th}: the card\'s labels, ink-2 on sheet {cr(parse(t["ink2"]), parse(t["sheet"])):.2f}')

    print('\n== 6. the stock look, for the record (not checked: what this pass replaces)')
    for th, s in STOCK.items():
        P = lambda k: parse(s[k])
        print(f'     {th}: a failing hour\'s bar on its card {cr(P("bad"), P("card")):.2f}; a "near" bar {cr(P("near"), P("card")):.2f}; a good bar {cr(P("good"), P("card")):.2f}')
        print(f'     {th}: muted text on the ground {cr(P("muted"), P("ground")):.2f}; on a good hour\'s tint {cr(P("muted"), P("soft")):.2f}; the stale amber stamp {cr(P("warn"), P("ground")):.2f}')

    print('\nALL CHECKS PASS' if ok else '\nSOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
