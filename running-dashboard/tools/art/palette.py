"""Running Dashboard's palette under the house system (ART.md section 2) and its pane-app register (HOUSE.md
11, plan 0012): the house's chrome tokens, the register's four meaning colors (--done, --up, --watch,
--down, taken as HOUSE 11.2 measured them and checked by check 9), the app's data colors fitted into each
theme's band (the heart-rate zones in Garmin's own hues, the
eight series, Garmin's training statuses, the route's cool-to-warm ramp), the Block's ink (the
signature), the ink lines on their casings, and every contrast figure ART.md quotes. Standard
library only. Run from Template/:

    python3 running-dashboard/tools/art/palette.py          the checks; ends ALL CHECKS PASS or SOME CHECKS FAIL
    python3 running-dashboard/tools/art/palette.py --json   the fitted tokens and the route ramp per theme,
                                                            for style.css and js/palette.js (pasted, never
                                                            retyped; tools/check.mjs compares)

The app's data colors are not in a data file: they are the stock style.css's light tokens (the hue
and chroma each data category was given before this pass, Garmin's zone convention among them),
copied below as SOURCE. Only lightness is fitted, per theme; hue is kept and chroma is kept where
sRGB allows (HOUSE.md 3.2: a chart's series keep their identities).

Color maths: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB: the same
functions as global-weather/tools/art/palette.py, copied so that this folder stands alone.
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

# -- the data's own colors: the stock style.css's light tokens (hue and chroma are what is kept) --
SOURCE = {
    # Garmin Connect's zone convention: no zone pale gray, Z1 gray, Z2 blue, Z3 green, Z4 orange, Z5 red.
    'zone-0': '#d7dbe3', 'zone-1': '#a3a8b2', 'zone-2': '#3b8fe4', 'zone-3': '#52b043',
    'zone-4': '#f59a23', 'zone-5': '#e5443b',
    # The eight categorical slots: the sports (run 1, ride 2, strength 3, elliptical 4, other 5,
    # hike or walk 6), the shoes in catalog order, the stroller (with 2, without 1), the muscle work
    # (concentric 1, eccentric 6), the laps (work 1, warm-up and cool-down 4).
    'series-1': '#2f6df6', 'series-2': '#f0663a', 'series-3': '#17b07c', 'series-4': '#efa400',
    'series-5': '#e97ba8', 'series-6': '#7f62d6', 'series-7': '#16a9bd', 'series-8': '#a06c3d',
}
ZONES = ['zone-0', 'zone-1', 'zone-2', 'zone-3', 'zone-4', 'zone-5']
SERIES = ['series-%d' % i for i in range(1, 9)]
# Garmin's training statuses (the Training pane's status strip): ten families, each drawn in one of
# the fitted tokens above. More than five categories, so the legend names each with its day count and
# color never carries identity alone (HOUSE.md 3.3); the pairs are still checked.
STATUS = {'Detraining': 'series-8', 'Recovery': 'series-1', 'Maintaining': 'series-4', 'Productive': 'zone-3',
          'Peaking': 'series-6', 'Unproductive': 'zone-4', 'Strained': 'series-5', 'Overreaching': 'zone-5',
          'Paused': 'zone-1', 'No status': 'zone-0'}

# -- the tonal budget (ART.md 2) ---------------------------------------------------------------
# Every data color lives in the theme's band. The light theme's band sits below the page (darker), the
# dark theme's above it; the signature, --ink, keeps the far end of the range in both.
BAND = {'light': (0.400, 0.625), 'dark': (0.560, 0.860)}
# Where each token sits in the band, 0 nearest the ground (lightest in the light theme, dimmest in the
# dark one) to 1 the far edge. The two zone grays keep Garmin's order, "no zone" nearest the ground and
# Z1 a step further, so they stand apart by lightness (they share a hue). Every other step was found by
# a search over a grid of twentieths (a throwaway script in the art pass, 20 000 draws) for the
# widest closest pair across the zones, the series and the statuses in both themes, every token held at
# 3:1 or more on both grounds: the closest pair is 0.105 (series-4 and zone-4, the amber and the orange).
# The steps are therefore not a salience order: zones are Garmin's categories, named in every legend,
# not a scale (ART.md 2 says what that gives up).
STEP = {'zone-0': 0.00, 'zone-1': 0.52, 'zone-2': 0.60, 'zone-3': 1.00, 'zone-4': 0.45, 'zone-5': 0.20,
        'series-1': 0.80, 'series-2': 0.25, 'series-3': 0.55, 'series-4': 0.00, 'series-5': 0.50,
        'series-6': 0.30, 'series-7': 0.15, 'series-8': 1.00}
# A gray has no chroma to keep; the two zone grays take a whisper of the chrome's own cool hue so they
# never read as warm, and stay under the chrome's 0.024 (they are data, but read as "no color").
GRAY_C = 0.012

# The route's ramp (the Sessions pane's map, colored by pace, speed, cadence, power or elevation): the
# stock ramp ran cool to warm through a pale middle (a diverging map on sequential data). Kept: cool for
# low, warm for high. Changed: one path whose salience rises monotonically, printed twice, with every
# stop at least 3:1 against the route's casing (--sheet), so the line reads at both ends.
# Stops: (salience s, chroma C, hue h). L follows the band: L = L0 + (L1 - L0) * s.
# --amount, the tone of every chart of one quantity (weekly kilometers, sleep, steps, HRV, floors, VO2
# max, weight and the rest): a quiet slate in the running series' hue family, low in chroma, so a column
# of single-quantity charts reads as an instrument plate and the Block stays the one bold thing on the
# pane (the review of 2026-10-02 measured the stock blue, series-1, at C 0.215: the most saturated token
# spent on charts whose hue encodes nothing). (L, C, h) per theme, inside the band, 3:1 or more on both
# grounds (check 2). It is not a category, so it is not in check 3's pairs.
AMOUNT = {'light': (0.500, 0.065, 255), 'dark': (0.740, 0.050, 250)}

# The plan's tint (the owner, 2026-10-03: "fill inside the planned stuff (light) to make it possible to
# see"). Whatever the plan asks for is drawn as a 1.5 px outline of its token around that token at TINT
# over --page: the Block's weeks still to run (in --ink), the planned bars of the running, zone and day
# charts, the plan's zone bars and the legend's planned swatch. 0.20 is the largest round strength at
# which every token ever drawn planned stands at 3:1 or more against its own tint in both themes, so done
# (solid) and planned (tinted, outlined) stay apart; the tint itself stays under 2:1 on the page (light).
# Check 8 prints each. style.css carries it as `.tint { fill-opacity: 0.2; }` and `20%` in color-mix().
TINT = 0.20
# The register (HOUSE 11.2, plan 0012 D5): one meaning each in this app. --done a run done (the Block's runs,
# the week's bar on Now), --up on track, --watch watch, --down act now and stop (the tone word alone; the
# word always says it). Not fitted: HOUSE's values and its measured text contrasts, repeated by check 9.
REGISTER = {
 'light': {'done': '#1f5f99', 'up': '#17723e', 'watch': '#8a5a00', 'down': '#b42318'},
 'dark':  {'done': '#8cbcf0', 'up': '#6fd39a', 'watch': '#e0a340', 'down': '#ff9a8f'},
}
FIG = {  # text contrast on (page, sheet), HOUSE 11.2
 'light': {'done': (5.68, 6.29), 'up': (5.10, 5.65), 'watch': (5.06, 5.60), 'down': (5.61, 6.21)},
 'dark':  {'done': (8.61, 7.68), 'up': (9.34, 8.33), 'watch': (7.73, 6.89), 'down': (8.37, 7.46)},
}
# The register's planned fill (HOUSE 11.1 rule 7, 11.2): 14 % of the outline's color (--ink-2) over --sheet,
# in the Block, the week's bar and their keys. HOUSE: light #dde2e4 1.23:1 on --sheet, dark #2f3a3f 1.31:1.
PLAN_FILL = 0.14
PLANNED = ['zone-1', 'zone-2', 'zone-3', 'zone-4', 'zone-5', 'series-1', 'series-3', 'series-6']   # and --ink

RAMP = [(0.00, 0.120, 245), (0.25, 0.150, 285), (0.50, 0.170, 330), (0.75, 0.170, 15), (1.00, 0.160, 45)]
RAMP_BAND = {'light': (0.640, 0.420), 'dark': (0.580, 0.860)}
ROUTE_CASING = 'sheet'

def fit(th):
    b0, b1 = BAND[th]
    out = {}
    for k, src in SOURCE.items():
        _, C, h = lch8(parse(src))
        s = STEP[k]
        L = (b1 - (b1 - b0) * s) if th == 'light' else (b0 + (b1 - b0) * s)
        if k in ('zone-0', 'zone-1'): C, h = GRAY_C, 230
        out[k] = hx(gamut_map(L, C, h))
    out['amount'] = hx(gamut_map(*AMOUNT[th]))
    return out

def ramp(th, s):
    # Interpolates the stops in OKLCh (hue the short way round), lightness from RAMP_BAND.
    for (s0, c0, h0), (s1, c1, h1) in zip(RAMP, RAMP[1:]):
        if s0 <= s <= s1:
            f = (s - s0) / (s1 - s0); dh = ((h1 - h0 + 180) % 360) - 180
            C, h = c0 + (c1 - c0) * f, (h0 + dh * f) % 360
            break
    L0, L1 = RAMP_BAND[th]
    return gamut_map(L0 + (L1 - L0) * s, C, h)

def ramp_stops(th, n=9):
    return [hx(ramp(th, i / (n - 1))) for i in range(n)]

def main():
    F = {th: fit(th) for th in BAND}
    if '--json' in sys.argv:
        print(json.dumps({th: {**F[th], **REGISTER[th], 'ramp': ramp_stops(th), 'tint': TINT} for th in BAND}, indent=1)); return
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
        check(cr(parse(t['page']), parse(t['ink'])) >= 4.5, f'{th}: a --page word on an --ink key {cr(parse(t["page"]), parse(t["ink"])):.2f}')

    print('\n== 2. data tokens, fitted per theme: in the band, each a mark at >= 3:1 on --page and --sheet')
    for th in BAND:
        t = TOK[th]; lows = []
        for k in ZONES + SERIES:
            c = F[th][k]; L, C, h = lch8(parse(c)); L0, C0, h0 = lch8(parse(SOURCE[k]))
            cp, cs = cr(parse(c), parse(t['page'])), cr(parse(c), parse(t['sheet'])); lows.append((min(cp, cs), k))
            inband = BAND[th][0] - 0.002 <= L <= BAND[th][1] + 0.002
            check(inband and cp >= 3 and cs >= 3,
                  f'{th}: {k:8} {SOURCE[k]} -> {c}  L {L0:.3f} -> {L:.3f}, C {C0:.3f} -> {C:.3f}, h {h0:.0f} -> {h:.0f}; on page {cp:.2f}, on sheet {cs:.2f}')
        c = F[th]['amount']; L, C, h = lch8(parse(c)); cp, cs = cr(parse(c), parse(t['page'])), cr(parse(c), parse(t['sheet']))
        check(BAND[th][0] - 0.002 <= L <= BAND[th][1] + 0.002 and cp >= 3 and cs >= 3 and C <= 0.07,
              f'{th}: amount   {c}  L {L:.3f}, C {C:.3f} (<= 0.07, a slate), h {h:.0f}; on page {cp:.2f}, on sheet {cs:.2f}')
        lo = min(lows); print(f'     {th}: the lowest data-on-ground contrast {lo[0]:.2f} ({lo[1]}; target 3.0, a mark)')

    print('\n== 3. categories: every pair apart by dE (OKLab) >= 0.10 under normal vision; the simulations')
    print('     HOUSE.md 3.3 asks the same under deutan, protan and tritan vision. Where a pair falls short it is')
    print('     a stated departure (ART.md section 2, "The categories"), printed "dep": the zones keep Garmin\'s')
    print('     hues, and identity is carried by words and fixed order (every legend names its categories, every')
    print('     readout names the zone, sport, shoe or status, stacks keep one order), never by color alone.')
    groups = {'zones (6, Garmin\'s order)': ZONES, 'series (8)': SERIES,
              'easy / moderate / hard (zones 2, 3, 4)': ['zone-2', 'zone-3', 'zone-4'],
              'sports in the data (run, hike or walk, strength)': ['series-1', 'series-6', 'series-3'],
              'statuses (10)': list(STATUS.values())}
    for th in BAND:
        for name, keys in groups.items():
            for kind in ('normal', 'deutan', 'protan', 'tritan'):
                pairs = sorted((de(parse(F[th][a]), parse(F[th][b]), kind), a, b) for i, a in enumerate(keys) for b in keys[i + 1:])
                low = [p for p in pairs if p[0] < 0.10]
                msg = f'{th}, {name}, {kind}: closest {pairs[0][1]}/{pairs[0][2]} dE {pairs[0][0]:.3f}; {len(low)} of {len(pairs)} under 0.10'
                if kind == 'normal': check(not low, msg)
                elif low: print('dep  ' + msg + ': ' + ', '.join(f'{a}/{b} {d:.3f}' for d, a, b in low))
                else: print('ok   ' + msg)
    print('     Beyond five categories (zones, series, statuses) every legend and readout names its category,')
    print('     so identity never rests on color alone (HOUSE.md 3.3).')

    print('\n== 4. the signature: the Block on its plate (--sheet), its runs in --done, a planned week an --ink-2')
    print('     outline holding its 14 % fill (HOUSE 11.1 rule 7), and the far end of the range')
    for th in BAND:
        t = TOK[th]; ink = parse(t['ink']); L, C, h = lch8(ink); sh = parse(t['sheet']); done = parse(REGISTER[th]['done']); i2 = parse(t['ink2'])
        check(C <= 0.024, f'{th}: the ink {t["ink"]} is a near-neutral (L {L:.3f}, C {C:.4f})')
        check(cr(done, sh) >= 3, f'{th}: a run block, --done {REGISTER[th]["done"]} on the plate {cr(done, sh):.2f} (target 3.0, a mark)')
        check(cr(i2, sh) >= 3, f'{th}: a plan outline, --ink-2 on the plate {cr(i2, sh):.2f}')
        fill = over(i2, PLAN_FILL, sh)
        check(cr(done, fill) >= 3 and cr(i2, fill) >= 3, f'{th}: this week\'s runs inside its planned fill {hx(fill)}: --done against it {cr(done, fill):.2f}, the outline {cr(i2, fill):.2f}')
        far = (L < BAND[th][0]) if th == 'light' else (L > BAND[th][1])
        check(far, f'{th}: the ink keeps the far end (L {L:.3f}; band {BAND[th][0]:.3f}-{BAND[th][1]:.3f})')
        check(cr(done, sh) >= 3, f'{th}: the 1 px gap between two runs in a week is the plate, {cr(done, sh):.2f} against --done')
        check(cr(parse(t['ink3']), sh) >= 4.5, f'{th}: the Block\'s labels (now, the months), ink-3 on the plate {cr(parse(t["ink3"]), sh):.2f}')
        check(cr(parse(t['line']), sh) < 1.5, f'{th}: the 20 km hairlines, --line on the plate {cr(parse(t["line"]), sh):.2f} (quiet on purpose, under 1.5)')

    print('\n== 5. ink lines over the data (the averages, the cursor): on a 4 px --sheet casing, every chart on a plate')
    for th in BAND:
        t = TOK[th]; ink = parse(t['ink'])
        worst = min((cr(ink, parse(F[th][k])), k) for k in ZONES + SERIES + ['amount'])
        print(f'     {th}: without the casing, ink over the closest data color ({worst[1]}) would be {worst[0]:.2f}')
        check(cr(ink, parse(t['sheet'])) >= 3, f'{th}: ink on its --sheet casing {cr(ink, parse(t["sheet"])):.2f}')

    print('\n== 6. the route ramp: one path, salience monotone, every stop >= 3:1 on its --sheet casing')
    for th in BAND:
        t = TOK[th]; cas = parse(t[ROUTE_CASING])
        ss = [i / 96 for i in range(97)]
        cols = [ramp(th, s) for s in ss]
        Ls = [lch8(c)[0] for c in cols]
        mono = all(b < a for a, b in zip(Ls, Ls[1:])) if th == 'light' else all(b > a for a, b in zip(Ls, Ls[1:]))
        check(mono, f'{th}: lightness runs {Ls[0]:.3f} -> {Ls[-1]:.3f} without turning back ("more" further from the casing)')
        low = min(cr(c, cas) for c in cols)
        check(low >= 3, f'{th}: the lowest stop on the casing {low:.2f}')
        for kind in ('normal', 'deutan', 'protan', 'tritan'):
            d = de(cols[0], cols[-1], kind); check(d >= 0.10, f'{th}: the two ends apart, {kind}, dE {d:.3f}')
        eighths = [de(ramp(th, i / 8), ramp(th, (i + 1) / 8)) for i in range(8)]
        check(min(eighths) >= 0.02, f'{th}: every eighth steps by dE >= 0.02 (smallest {min(eighths):.3f})')
        print(f'     {th}: stops ' + ' '.join(ramp_stops(th)))
        stops = [ramp(th, i / 8) for i in range(9)]
        worst = 0
        for i in range(8):
            for q in range(1, 4):
                f = q / 4; a, b = stops[i], stops[i + 1]
                srgb = tuple(round(x + (y - x) * f) for x, y in zip(a, b))
                worst = max(worst, math.dist(lab8(srgb), lab8(ramp(th, (i + f) / 8))))
        check(worst <= 0.01, f'{th}: the nine stops, interpolated in sRGB, stay within dE {worst:.4f} of the OKLab path (<= 0.01)')

    print('\n== 7. the readout card and notices (--sheet, a 1 px --line-strong edge)')
    for th, t in TOK.items():
        check(cr(parse(t['strong']), parse(t['page'])) >= 3, f'{th}: the card\'s edge on the page {cr(parse(t["strong"]), parse(t["page"])):.2f}')
        check(cr(parse(t['ink2']), parse(t['sheet'])) >= 4.5, f'{th}: the card\'s labels, ink-2 on sheet {cr(parse(t["ink2"]), parse(t["sheet"])):.2f}')

    print(f'\n== 8. the plan\'s tint in the charts: each planned token at {TINT:.2f} over its plate (--sheet) inside its')
    print('     own 1.5 px outline; the tint seen (1.2:1 or more on the plate) and light (under 2:1), done and planned')
    print('     apart (the solid token at 3:1 or more against its tint, which is also its outline on the tint)')
    for th in BAND:
        t = TOK[th]; page = parse(t['sheet']); seen = []
        for k in PLANNED:
            c = parse(F[th][k]); tint = over(c, TINT, page)
            s, a = cr(tint, page), cr(c, tint); seen.append(s)
            check(1.2 <= s < 2 and a >= 3, f'{th}: {k:8} {hx(c)} tinted {hx(tint)}: on the plate {s:.2f}; the token against it {a:.2f}')
        print(f'     {th}: the tints stand {min(seen):.2f} to {max(seen):.2f} on the plate')

    print('\n== 9. the register (HOUSE 11.2): each meaning color as text >= 4.5 on --page and --sheet at the figures')
    print('     HOUSE measured; the planned fill at HOUSE\'s figures; the tone colors always beside their word')
    for th in BAND:
        t = TOK[th]; R = REGISTER[th]
        for k, (fp, fs) in FIG[th].items():
            cp, cs = cr(parse(R[k]), parse(t['page'])), cr(parse(R[k]), parse(t['sheet']))
            check(cp >= 4.5 and cs >= 4.5 and abs(cp - fp) < 0.006 and abs(cs - fs) < 0.006, f'{th}: --{k:5} {R[k]} as text on page {cp:.2f}, on sheet {cs:.2f} (HOUSE 11.2: {fp:.2f}, {fs:.2f})')
        fill = over(parse(t['ink2']), PLAN_FILL, parse(t['sheet']))
        want = {'light': ('#dde2e4', 1.23, 7.32), 'dark': ('#2f3a3f', 1.31, 6.92)}[th]
        check(hx(fill) == want[0] and abs(cr(fill, parse(t['sheet'])) - want[1]) < 0.006 and abs(cr(parse(t['ink2']), parse(t['sheet'])) - want[2]) < 0.006,
              f'{th}: the planned fill {hx(fill)} {cr(fill, parse(t["sheet"])):.2f}:1 on --sheet, its --ink-2 outline {cr(parse(t["ink2"]), parse(t["sheet"])):.2f}:1 (HOUSE 11.2: {want[0]}, {want[1]:.2f}, {want[2]:.2f})')
        for a, b in (('up', 'watch'), ('watch', 'down'), ('up', 'down')):
            got = [de(parse(R[a]), parse(R[b]), kind) for kind in ('normal', 'deutan', 'protan', 'tritan')]
            print(f'     {th}: --{a}/--{b} dE {" / ".join(f"{g:.3f}" for g in got)} (normal / deutan / protan / tritan){"; under 0.10, always beside its word" if min(got) < 0.10 else ""}')
        print(f'     {th}: a plate on the page {cr(parse(t["sheet"]), parse(t["page"])):.2f}:1, its --line edge against the page {cr(parse(t["line"]), parse(t["page"])):.2f}:1')

    print('\nALL CHECKS PASS' if ok else '\nSOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
