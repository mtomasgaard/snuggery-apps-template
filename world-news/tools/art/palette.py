"""World News' palette under the house system (ART.md section 2): the house's chrome tokens, the
Datelines (the signature) drawn in them, the story list's text and states, and every contrast figure
ART.md quotes. Standard library only. Run from Template/:

    python3 world-news/tools/art/palette.py          the checks; ends ALL CHECKS PASS or SOME CHECKS FAIL
    python3 world-news/tools/art/palette.py --json   the tokens per theme, as style.css declares them
                                                     (tools/check.mjs compares; pasted, never retyped)

Plan 0012's pane-app register (HOUSE.md 11, the owner's D5) gives it one meaning color, in three hues:
which source a headline came from, --src-1 to --src-3 by the order of the file's sources[] (HOUSE 11.2's
values, taken as measured there and repeated by check 7), on the chosen rows' ticks and the swatches. The
Datelines and the stories now sit on plates (--sheet), so checks 3 and 4 measure them there. Before the
register this app had no data color. Its data is text (headlines, sources, bylines, dates) and the one picture,
the Datelines, was drawn in ink: the stock look's only hues were an accent blue (the chosen tab, links,
hover), an amber for "cached" and "stale" and a red for errors, and none of them was data, so all three
go (HOUSE.md 3.1: no accent, no red or amber in the chrome; the words carry staleness). The tonal budget
is therefore stated over the Datelines' own marks: the chosen rows' ticks in --ink at the far end of
the range, the other rows' ticks in --ink-3 in the middle, the scale's hairlines in --line next to the
ground, so the ink always stands furthest from the page.

Color maths: OKLab (Ottosson 2020) and WCAG 2 relative luminance: the same functions as
global-weather/tools/art/palette.py (by way of finances/tools/art/palette.py), copied so that this
folder stands alone.
"""
import json, math, sys

# -- color maths (global-weather/tools/art/palette.py, unchanged) -----------------------------
def lin2lab(r, g, b):
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b; m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(x) ** (1 / 3), x) for x in (l, m, s))
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)
def dec(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def hx(rgb): return '#' + ''.join('%02x' % c for c in rgb)
def parse(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def lum(rgb): r, g, b = (dec(c / 255) for c in rgb); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def cr(a, b): la, lb = sorted((lum(a), lum(b)), reverse=True); return (la + .05) / (lb + .05)
def over(fg, a, bg): return tuple(round(f * a + g * (1 - a)) for f, g in zip(fg, bg))
def lch8(rgb):
    L, a, b = lin2lab(*(dec(c / 255) for c in rgb)); return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360
# color-vision simulation: Machado, Oliveira and Fernandes (2009) at severity 1.0, in linear sRGB (HOUSE 11.2's
# method, finances/tools/art/palette.py's matrices, copied)
CVD = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
       'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
       'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
def sim(rgb, kind):
    lin = [dec(c / 255) for c in rgb]
    if kind != 'normal': lin = [min(1, max(0, sum(CVD[kind][i][j] * lin[j] for j in range(3)))) for i in range(3)]
    return lin2lab(*lin)
def de(a, b, kind='normal'): return math.dist(sim(a, kind), sim(b, kind))

# -- the house's chrome tokens (HOUSE.md 3.1), copied as they are -----------------------------
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72',
               line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f',
               line='#2a373c', strong='#64757b'),
}
CSS_NAME = dict(page='--page', sheet='--sheet', ink='--ink', ink2='--ink-2', ink3='--ink-3', line='--line',
                strong='--line-strong', src1='--src-1', src2='--src-2', src3='--src-3')

# -- the register's meaning color (HOUSE 11.2, plan 0012 D5): the source, by the order of sources[]. Not fitted:
# taken as HOUSE measured them. --src-3 is the lead's wine / mauve, not the board's purple (HOUSE 11.2).
REGISTER = {
 'light': dict(src1='#1f5f99', src2='#a64a1a', src3='#6d2736'),
 'dark':  dict(src1='#8cbcf0', src2='#f0a070', src3='#ab8198'),
}
FIG = {  # text contrast on (page, sheet), HOUSE 11.2
 'light': dict(src1=(5.68, 6.29), src2=(4.96, 5.49), src3=(8.99, 9.96)),
 'dark':  dict(src1=(8.61, 7.68), src2=(8.12, 7.24), src3=(5.15, 4.60)),
}
PAIRS = {  # dE normal / deutan / protan / tritan, HOUSE 11.2
 ('src1', 'src2'): {'light': (0.246, 0.224, 0.188, 0.252), 'dark': (0.202, 0.185, 0.175, 0.225)},
 ('src1', 'src3'): {'light': (0.208, 0.159, 0.194, 0.230), 'dark': (0.171, 0.143, 0.180, 0.195)},
 ('src2', 'src3'): {'light': (0.160, 0.164, 0.154, 0.149), 'dark': (0.163, 0.170, 0.145, 0.143)},
}
# The stock look's tokens that leave (for the record, measured on the stock style.css as it was):
STOCK_GONE = {'light': dict(accent='#2f6df6', stale='#a87400', critical='#c23b34', ground='#eef0f4'),
              'dark':  dict(accent='#6f9bff', stale='#f2b322', critical='#f07a72', ground='#0b0e13')}

def main():
    if '--json' in sys.argv:
        print(json.dumps({th: {CSS_NAME[k]: v for k, v in {**t, **REGISTER[th]}.items()} for th, t in TOK.items()}, indent=1)); return
    ok = True
    def check(cond, msg):
        nonlocal ok; ok &= bool(cond); print(('ok   ' if cond else 'FAIL ') + msg)

    print('== 1. chrome tokens: WCAG 2 contrast (text >= 4.5; --line-strong >= 3); every token a near-neutral')
    for th, t in TOK.items():
        for g in ('page', 'sheet'):
            for k in ('ink', 'ink2', 'ink3'):
                c = cr(parse(t[k]), parse(t[g])); check(c >= 4.5, f'{th}: {k} on {g} {c:.2f}')
            c = cr(parse(t['strong']), parse(t[g])); check(c >= 3, f'{th}: line-strong on {g} {c:.2f}')
        cmax = max(lch8(parse(v))[1] for v in t.values())
        check(cmax <= 0.024, f'{th}: highest chroma of any token {cmax:.4f} (<= 0.024): every mark in this app is gray, so no hue needs a color-vision check')

    print('\n== 2. the tonal budget over the Datelines: ground, middle, far end (OKLab L)')
    for th, t in TOK.items():
        Lp = lch8(parse(t['page']))[0]; Lg = lch8(parse(t['line']))[0]; L3 = lch8(parse(t['ink3']))[0]; Li = lch8(parse(t['ink']))[0]
        print(f'     {th}: page L {Lp:.3f}; scale hairlines (--line) L {Lg:.3f}; other rows\' ticks (--ink-3) L {L3:.3f}; chosen ticks (--ink) L {Li:.3f}')
        order = (Lp > Lg > L3 > Li) if th == 'light' else (Lp < Lg < L3 < Li)
        check(order, f'{th}: each mark stands further from the page than the one before it, the ink furthest')

    print('\n== 3. the Datelines (the signature) on their plate, --sheet: marks >= 3 (WCAG non-text), labels >= 4.5')
    for th, t in TOK.items():
        P, I, I2, I3, G, S = (parse(t[k]) for k in ('sheet', 'ink', 'ink2', 'ink3', 'line', 'strong'))
        check(cr(I, P) >= 3, f'{th}: a tick, 2 px of --ink on the plate {cr(I, P):.2f}')
        check(cr(I, P) >= 3, f'{th}: a hollow tick (kept from an earlier run), a 1 px --ink outline on the plate {cr(I, P):.2f}')
        check(cr(P, I) >= 3, f'{th}: the 1 px plate gap that divides a tick shared by two headlines, against its ink {cr(P, I):.2f}')
        check(cr(I3, P) >= 3, f'{th}: a tick of a row not chosen, --ink-3 on the plate {cr(I3, P):.2f}')
        check(cr(I3, P) >= 3 and cr(I, I3) >= 1.8, f'{th}: chosen ink against a row not chosen, {cr(I, I3):.2f} (the rows read apart; the names carry it too)')
        check(cr(I, G) >= 3 and cr(I3, G) >= 3, f'{th}: a tick crossing a scale hairline: ink on --line {cr(I, G):.2f}, ink-3 on --line {cr(I3, G):.2f}')
        check(cr(G, P) < 1.5, f'{th}: the scale hairlines through the rows, --line on the plate {cr(G, P):.2f} (quiet on purpose, under 1.5)')
        check(cr(S, P) >= 3, f'{th}: the scale\'s baseline and its 4 px ticks, --line-strong on the plate {cr(S, P):.2f}')
        check(cr(I2, P) >= 4.5, f'{th}: the scale\'s labels (1 h, 6 h, 1 d, 7 d, 60 d) and the other rows\' names, --ink-2 on the plate {cr(I2, P):.2f}')
        check(cr(I, P) >= 4.5, f'{th}: the chosen row\'s name (620), --ink on the plate {cr(I, P):.2f}')
        check(cr(I, P) >= 3, f'{th}: the 4 px ink disc over a tapped tick, and the 2 px ink rule beside its story {cr(I, P):.2f}')

    print('\n== 4. the story list: text on its plate (--sheet), and the pressed row')
    for th, t in TOK.items():
        P, I, I2 = parse(t['sheet']), parse(t['ink']), parse(t['ink2'])
        check(cr(I, P) >= 4.5, f'{th}: a headline, --ink on the plate {cr(I, P):.2f}')
        check(cr(I2, P) >= 4.5, f'{th}: source and date, byline, summary, --ink-2 on the plate {cr(I2, P):.2f}')
        held = over(I, 0.07, P)
        check(cr(I, held) >= 4.5 and cr(I2, held) >= 4.5, f'{th}: a row held down ({hx(held)}, --ink at 7 %): headline {cr(I, held):.2f}, meta {cr(I2, held):.2f}')
        on = over(I, 0.12, parse(t['sheet']))
        check(cr(I, on) >= 4.5, f'{th}: the on-plate of a key (--ink at 12 % over --sheet, {hx(on)}): ink {cr(I, on):.2f}')

    print('\n== 5. notices and About (--sheet, a 1 px --line-strong edge)')
    for th, t in TOK.items():
        Sh, I, I2, S, P = (parse(t[k]) for k in ('sheet', 'ink', 'ink2', 'strong', 'page'))
        check(cr(I, Sh) >= 4.5, f'{th}: a notice\'s sentence and About\'s prose, --ink on sheet {cr(I, Sh):.2f}')
        check(cr(I2, Sh) >= 4.5, f'{th}: About\'s terms (label: value), --ink-2 on sheet {cr(I2, Sh):.2f}')
        check(cr(S, P) >= 3, f'{th}: the notice plate\'s edge on the page {cr(S, P):.2f}')

    print('\n== 6. the register (HOUSE 11.2): each source\'s color as text >= 4.5 on --page and --sheet at the figures')
    print('     HOUSE measured; as a tick (a 2 px mark) >= 3 on the plate and on a scale hairline; the three apart at dE >=')
    print('     0.10 under normal vision and the three simulations; each at least 0.15 from --ink')
    for th, t in TOK.items():
        F = REGISTER[th]
        for k, (fp, fs) in FIG[th].items():
            cp, cs = cr(parse(F[k]), parse(t['page'])), cr(parse(F[k]), parse(t['sheet']))
            check(cp >= 4.5 and cs >= 4.5 and abs(cp - fp) < 0.006 and abs(cs - fs) < 0.006, f'{th}: --src-{k[-1]} {F[k]} as text on page {cp:.2f}, on sheet {cs:.2f} (HOUSE 11.2: {fp:.2f}, {fs:.2f})')
            cl = cr(parse(F[k]), parse(t['line']))
            check(cs >= 3 and cl >= 3, f'{th}: a --src-{k[-1]} tick on the plate {cs:.2f}, and where it crosses a scale hairline (--line) {cl:.2f} (WCAG non-text, 3)')
            d = de(parse(F[k]), parse(t['ink']))
            check(d >= 0.15, f'{th}: --src-{k[-1]} against --ink dE {d:.3f} (a colored tick reads apart from an ink one)')
        for (a, b), want in PAIRS.items():
            got = tuple(round(de(parse(F[a]), parse(F[b]), kind), 3) for kind in ('normal', 'deutan', 'protan', 'tritan'))
            same = all(abs(g - w) <= 0.001 for g, w in zip(got, want[th]))
            check(same and min(got) >= 0.10, f'{th}: --src-{a[-1]}/--src-{b[-1]} dE {" / ".join(f"{g:.3f}" for g in got)} (normal / deutan / protan / tritan; HOUSE 11.2 the same, each >= 0.10)')
        print(f'     {th}: a plate on the page {cr(parse(t["sheet"]), parse(t["page"])):.2f}:1, its --line edge against the page {cr(parse(t["line"]), parse(t["page"])):.2f}:1')

    print('\n== 7. for the record: the stock look this pass replaces (measured, not checked)')
    for th, g in STOCK_GONE.items():
        acc = lch8(parse(g['accent'])); st = lch8(parse(g['stale'])); cri = lch8(parse(g['critical']))
        print(f'     {th}: accent {g["accent"]} C {acc[1]:.3f}; stale {g["stale"]} C {st[1]:.3f}; critical {g["critical"]} C {cri[1]:.3f} (all leave)')
    print(f'     light: the stock stamp and footer, #687080 on #eef0f4, {cr(parse("#687080"), parse("#eef0f4")):.2f} (under 4.5); '
          f'"Terms" links, #2f6df6 on #eef0f4, {cr(parse("#2f6df6"), parse("#eef0f4")):.2f}; "cached" badge #a87400 on #fdf3dc, {cr(parse("#a87400"), parse("#fdf3dc")):.2f}')

    print('\nALL CHECKS PASS' if ok else '\nSOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
