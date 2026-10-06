"""Hello Live's palette under the house system (ART.md section 2): the house's chrome tokens, the signature's
ink (the Time Card: one punch per file this app has read, at the minute the job wrote it, and a tail to its
first reading here), and every contrast figure ART.md quotes, with the stock look's figures for the record.
Standard library only (Python 3.9 or later). Run from Template/:

    python3 hello-live/tools/art/palette.py          the checks; ends ALL CHECKS PASS or SOME CHECKS FAIL
    python3 hello-live/tools/art/palette.py --json   the tokens per theme, for style.css (pasted, never
                                                     retyped; tools/check.mjs compares)

This app has no data color. Its data is three numbers and a clock time, and the picture of its loop is drawn
in ink alone: there is no quantity that color could carry, so the data band of HOUSE.md 3.2 is empty here
and every hue of the stock look goes: --accent (#2f6f4f / #7ec79b, the green "ago" words), --warn (#8a3324 /
#e5907f, the red "stale" words and the problem card's edge and title). Words carry what they carried. The
--json output is therefore the chrome tokens themselves, so check.mjs can hold style.css to them the way
every other app's check holds its ramps.

Color maths: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of Machado,
Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB: the same functions as
global-weather/tools/art/palette.py (by way of power-hours/tools/art/palette.py), copied so that this folder
stands alone.
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
# The Time Card's drawn states (ART.md section 1): a row that holds the present (today) carries --ink at 4 % over
# the page behind it, so today's row is told from the six before it by tone as well as by its `now` notch; the
# hour ticks on the axis are --ink-3 at 50 %, as the house track's step ticks (HOUSE 3.1).
TODAY = 0.04
TICK = 0.50

# The stock look, for the record (ART.md section 2): what its words and card measured.
STOCK = {
 'light': dict(bg='#f6f6f4', card='#ffffff', ink='#16161a', dim='#6b6b73', line='#e3e3df', accent='#2f6f4f', warn='#8a3324'),
 'dark':  dict(bg='#131316', card='#1d1d21', ink='#f2f2f0', dim='#9a9aa2', line='#2e2e34', accent='#7ec79b', warn='#e5907f'),
}

def main():
    if '--json' in sys.argv:
        print(json.dumps(TOK, indent=1)); return
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
        L, C, h = lch8(parse(t['page'])); print(f'     {th}: the page in OKLCh L {L:.3f}, C {C:.3f}, h {h:.0f}')

    print('\n== 2. the data band: empty. No quantity in this app is carried by color; every mark is ink or chrome')
    for th, t in TOK.items():
        L = lch8(parse(t['ink']))[0]
        print(f'     {th}: the signature keeps the whole range to itself; ink at L {L:.3f} on a page at L {lch8(parse(t["page"]))[0]:.3f}')
        check(all(lch8(parse(v))[1] <= 0.024 for v in t.values()), f'{th}: no hue on the screen but the chrome\'s near-neutrals')

    print('\n== 3. the signature: the Time Card, --ink on --page (a mark: >= 3; the day labels are text: >= 4.5)')
    for th, t in TOK.items():
        P = {k: parse(v) for k, v in t.items()}; ink = P['ink']
        L, C, h = lch8(ink)
        check(C <= 0.024, f'{th}: the ink {t["ink"]} is a near-neutral (L {L:.3f}, C {C:.4f})')
        check(cr(ink, P['page']) >= 3, f'{th}: a punch and its tail, ink on page {cr(ink, P["page"]):.2f}')
        today = over(ink, TODAY, P['page'])
        check(cr(ink, today) >= 3, f'{th}: a punch on today\'s row (ink at 4 % over the page, {hx(today)}) {cr(ink, today):.2f}')
        check(cr(ink, P['line']) >= 3, f'{th}: a punch across a row\'s hairline or an hour hairline (--line) {cr(ink, P["line"]):.2f}')
        check(cr(ink, P['strong']) >= 3, f'{th}: a punch across the axis baseline (--line-strong) {cr(ink, P["strong"]):.2f}')
        for kind in ('normal', 'deutan', 'protan', 'tritan'):
            d = de(ink, P['page'], kind); check(d >= 0.10, f'{th}: ink against the page, {kind}, dE {d:.3f}')
        check(cr(P['ink2'], P['page']) >= 3, f'{th}: the `now` notch (--ink-2, a mark) on the page {cr(P["ink2"], P["page"]):.2f}')
        check(cr(P['ink2'], today) >= 3, f'{th}: the `now` notch on today\'s row {cr(P["ink2"], today):.2f}')
        tick = over(P['ink3'], TICK, P['page'])
        print(f'     {th}: an hour tick, ink-3 at 50 % ({hx(tick)}) on the page {cr(tick, P["page"]):.2f}: faint on purpose, as the house track\'s step ticks')
        print(f'     {th}: a row hairline (--line) on the page {cr(P["line"], P["page"]):.2f}; on today\'s row {cr(P["line"], today):.2f}: separators, never a control\'s edge')
        print(f'     {th}: today\'s row against the page {cr(today, P["page"]):.2f}: told by its `now` notch and label too, never by tone alone')

    print('\n== 4. text on the page, the card and About (all >= 4.5)')
    for th, t in TOK.items():
        P = {k: parse(v) for k, v in t.items()}; today = over(P['ink'], TODAY, P['page'])
        c = cr(P['ink2'], P['page']); check(c >= 4.5, f'{th}: day labels, axis hours, the stamp, the lead, the caption line, the credits, ink-2 on page {c:.2f}')
        c = cr(P['ink2'], today); check(c >= 4.5, f'{th}: today\'s day label, ink-2 on today\'s row {c:.2f}')
        c = cr(P['ink3'], P['page']); check(c >= 4.5, f'{th}: `now` in its own row, ink-3 on page {c:.2f}')
        c = cr(P['ink'], P['page']); check(c >= 4.5, f'{th}: the headline, the row values, a stale sentence, ink on page {c:.2f}')
        check(cr(P['ink'], P['sheet']) >= 4.5 and cr(P['ink2'], P['sheet']) >= 4.5, f'{th}: About and a notice, ink {cr(P["ink"], P["sheet"]):.2f}, ink-2 {cr(P["ink2"], P["sheet"]):.2f} on sheet')
        check(cr(P['strong'], P['page']) >= 3, f'{th}: a notice\'s edge on the page {cr(P["strong"], P["page"]):.2f}')

    print('\n== 5. the stock look, for the record (not checked: what this pass replaces)')
    for th, s in STOCK.items():
        P = lambda k: parse(s[k])
        la, ca, ha = lch8(P('accent')); lw, cw, hw = lch8(P('warn'))
        print(f'     {th}: the green "ago" words on the page {cr(P("accent"), P("bg")):.2f} (OKLCh C {ca:.3f}, h {ha:.0f}); the red "stale" words {cr(P("warn"), P("bg")):.2f} (C {cw:.3f}, h {hw:.0f}); red against green {cr(P("warn"), P("accent")):.2f}, dE deutan {de(P("warn"), P("accent"), "deutan"):.3f}')
        print(f'     {th}: the dim labels on the card {cr(P("dim"), P("card")):.2f}, on the page {cr(P("dim"), P("bg")):.2f}; the card\'s edge on the page {cr(P("line"), P("bg")):.2f}; card against page {cr(P("card"), P("bg")):.2f}')

    print('\nALL CHECKS PASS' if ok else '\nSOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
