"""Milky Way's palette (ART.md, "Palette"): the house chrome tokens, the signature (the distance
rule in the caption band), and the night plate's own marks, with every check ART.md quotes.
Standard library only. Run from Template/:  python3 milky-way/tools/art/palette.py [--json]

--json prints the plate's colours as js/plate.js takes them ({name: '#rrggbb'} plus the alphas),
so the builder pastes numbers rather than retyping them, and tools/check.mjs fails while the two
differ.

The night plate keeps its one true appearance in both themes (HOUSE.md §3.2): space is dark, the
stars keep their catalogue colours (data/stars/colour.json, Planck chromaticity), the globes keep
their maps and measured colours, and the Gaia sky, the young-star maps and the disc-and-bar model
keep their display tints, all untouched by this file. What this file sets is everything else drawn
on the plate (orbits, trails, markers, labels, figures, the categories of the galaxy layers and the
small bodies) and the chrome around it, which follows the phone's theme.

Colour maths: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the colour-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB; the same
functions as global-weather/tools/art/palette.py, copied so that this folder stands alone.
"""
import json, math, sys

# ── colour maths (global-weather/tools/art/palette.py, unchanged) ─────────────
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
    # the most chroma sRGB has at this L and hue, if the stop asks for more (L and hue kept)
    a, b = lch2lab(L, C, h)[1:]
    while not in_gamut(lab2lin(L, a, b)) and C > 1e-4:
        C *= 0.98; a, b = lch2lab(L, C, h)[1:]
    return hx(rgb8(lab2lin(L, a, b)))
CVD = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
       'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
       'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
def sim(rgb, kind):
    lin = [dec(c / 255) for c in rgb]
    if kind != 'normal': lin = [min(1, max(0, sum(CVD[kind][i][j] * lin[j] for j in range(3)))) for i in range(3)]
    return lin2lab(*lin)
VISION = ('normal', 'deutan', 'protan', 'tritan')

# ── the house chrome tokens (HOUSE.md §3.1), copied as they are ──────────────
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72',
               line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f',
               line='#2a373c', strong='#64757b'),
}
# The ghost key sits on the night plate in both themes, so it is drawn one way in both: Global
# Weather's dark-theme stroke over a stronger halo of space (its 45 % halo failed over a white star).
GHOST = {'both themes': dict(stroke='#f2f4f1', halo=(2, 3, 8), halo_a=0.75)}

# ── the signature: the distance rule, on --page ──────────────────────────────
# The census strip (ink wherever the catalogues hold an object at that distance from the Sun) is
# the far end of the theme's lightness range, a cool near-neutral (starlight, h 255) that is not
# --ink and not Global Weather's streak (#0b171d / #f4f2ea, h 231 / 95). The cursor is a notch of
# --page cut through the strip, with a 1.5 px hairline of the strip's colour above and below it.
SIG = {'light': oklch(0.185, 0.020, 255), 'dark': oklch(0.965, 0.010, 255)}

# ── the night plate: one appearance in both themes ───────────────────────────
SPACE = '#020308'                                  # app.js setClearColor(0x020308)
# The bases a plate mark or label can sit on: bare space; the Gaia sky at full count, as gfx.js
# draws it (v^1.7 x tint (0.82, 0.86, 1.0)); the disc-and-bar model's five planes at full opacity
# (tint (1.0, 0.86, 0.66) x 1.1, clipped); a white star core, the Sun's disc or Earth's ice.
BASES = {'space': SPACE, 'gaia sky at full count': hx(tuple(round(255 * c) for c in (0.82, 0.86, 1.0))),
         'disc-and-bar model at full': hx(tuple(min(255, round(255 * c * 1.1)) for c in (1.0, 0.86, 0.66))),
         'white (a star core, the Sun, ice)': '#ffffff'}
LABEL = dict(ink='#e6edee', ink2='#a3b1b6', halo=SPACE, halo_a=0.85)   # 3 px stroke under the glyphs
NEUTRAL = oklch(0.86, 0.012, 240)                  # orbits, trails, markers, moon orbits, figures, rings
GUIDE_A = dict(orbit=0.16, moon_orbit=0.30, figure=0.275, grid=0.18)   # guides: seen, never read alone
GUIDE_MIN = 1.3          # a guide is visible on the night plate and never the only carrier of a meaning
MARK_A = dict(trail=0.90, marker=1.0)
# Categories, each fitted inside the plate's data band (L 0.66-0.90) so the labels' ink (L 0.94 on a
# dark halo) keeps the far end. Hue logic kept from the stock app where it carried meaning: the two
# arm models in opposite hues (amber masers, violet Cepheids), the streams cool, the clusters warm,
# the satellites rose; small bodies by where their orbits lie; an exoplanet host's ring green, the
# one hue the Planck locus never reaches, so it cannot be read as a star's colour.
CAT = {
 'galaxy lines': {'reid': (oklch(0.82, 0.120, 65), 0.62),      # its band at 0.34 under its line at 0.42: 1 - 0.66 x 0.58
                  'drimmel': (oklch(0.64, 0.160, 300), 0.75),
                  'streams': (oklch(0.86, 0.075, 205), 0.26), 'streams, approximate': (oklch(0.86, 0.075, 205), 0.16)},
 'galaxy points': {'globulars': (oklch(0.90, 0.110, 92), 1.0), 'satellites': (oklch(0.72, 0.130, 0), 1.0)},
 'small bodies': {'inner': (oklch(0.74, 0.140, 45), 0.9), 'belt': (oklch(0.90, 0.070, 85), 0.9),
                  'outer': (oklch(0.60, 0.080, 265), 0.9), 'comet': (oklch(0.76, 0.120, 220), 0.9)},
 'neighborhood': {'host': (oklch(0.84, 0.150, 160), 0.35)},      # the exoplanet host's ring: a guide (the card names the planets)
}
# Single marks, each always labelled by name (the Sun, the frame's center): fitted to the band, not paired.
MARKS = {'sun': oklch(0.90, 0.040, 80), 'center': oklch(0.90, 0.0, 0)}
SMALL_GROUPS = {'inner': ['neo', 'marscrosser'], 'belt': ['mba', 'trojan', 'other'],
                'outer': ['centaur', 'tno', 'dwarf'], 'comet': ['comet', 'interstellar']}
GUIDES = {'streams', 'streams, approximate', 'host'}   # drawn faint on purpose (a hundred streams cross the view; 150 host rings
#   outshone the stars they mark at 0.60, review 2026-10-01): the guide target
# The approximate streams are told apart by a dash (3 on, 3 off, as today), by being fainter (0.16
# against 0.26) and by their card's word "approximate", never by hue: one colour, so no pair check.
SAME = {('streams', 'streams, approximate')}

def main():
    if '--json' in sys.argv:
        out = {'space': SPACE, 'label': LABEL['ink'], 'label2': LABEL['ink2'], 'halo': LABEL['halo'], 'haloA': LABEL['halo_a'],
               'neutral': NEUTRAL, 'alpha': {**GUIDE_A, **MARK_A}, 'signature': SIG,
               'cat': {k: {'color': c, 'alpha': a} for g in CAT.values() for k, (c, a) in g.items() if k != 'streams, approximate'},
               'reidBand': 0.34, 'reidLine': 0.42, 'streamsApprox': CAT['galaxy lines']['streams, approximate'][1], 'marks': MARKS,
               'ghost': {'stroke': GHOST['both themes']['stroke'], 'halo': hx(GHOST['both themes']['halo']), 'haloA': GHOST['both themes']['halo_a']},
               'smallGroups': SMALL_GROUPS}
        print(json.dumps(out)); return
    ok = True
    print('== chrome tokens: WCAG 2 contrast (text >= 4.5, line-strong >= 3), the house values')
    for th, t in TOK.items():
        res = []
        for n, a, b in [('ink on page', 'ink', 'page'), ('ink-2 on page', 'ink2', 'page'), ('ink-3 on page', 'ink3', 'page'),
                        ('ink on sheet', 'ink', 'sheet'), ('ink-2 on sheet', 'ink2', 'sheet'), ('ink-3 on sheet', 'ink3', 'sheet')]:
            c = cr(parse(t[a]), parse(t[b])); ok &= c >= 4.5; res.append(f'{n} {c:.2f}')
        e = cr(parse(t['strong']), parse(t['page'])); ok &= e >= 3; res.append(f'line-strong on page {e:.2f}')
        print(f'  {th}: ' + ', '.join(res))
    print(f'  highest chroma of any chrome token: {max(lch8(parse(h))[1] for t in TOK.values() for h in t.values()):.4f} (<= 0.024)')
    print('== the signature: the distance rule on --page')
    for th, t in TOK.items():
        s = parse(SIG[th]); L, C, h = lch8(s); pg = parse(t['page'])
        strip = cr(s, pg); notch = cr(pg, s); ticks = cr(parse(t['ink3']), pg); labels = cr(parse(t['ink2']), pg)
        beyond = (L < lch8(parse(t['ink']))[0]) if th == 'light' else (L > lch8(parse(t['ink']))[0])
        page_L = lch8(pg)[0]
        ok &= strip >= 3 and notch >= 3 and ticks >= 3 and labels >= 4.5 and beyond and C <= 0.024
        print(f'  {th}: strip {SIG[th]} OKLCh {L:.3f} {C:.4f} {h:.0f} (page L {page_L:.3f}; --ink L {lch8(parse(t["ink"]))[0]:.3f}: '
              f'{"further from the page than --ink" if beyond else "NOT beyond --ink"}); strip on page {strip:.2f} (>= 3); '
              f'the cursor notch (page) in the strip {notch:.2f} (>= 3); decade ticks (ink-3) {ticks:.2f} (>= 3); labels (ink-2) {labels:.2f} (>= 4.5)')
    print('== the plate: labels on their halo, over every base (text >= 4.5)')
    low = (99, '')
    for name, b in BASES.items():
        halo = over(parse(LABEL['halo']), LABEL['halo_a'], parse(b))
        for k in ('ink', 'ink2'):
            c = cr(parse(LABEL[k]), halo); low = min(low, (c, f'{k} over {name}'))
            print(f'  label {k} {LABEL[k]} on its halo over {name} ({b} -> halo {hx(halo)}): {c:.2f}')
    ok &= low[0] >= 4.5; print(f'  worst {low[0]:.2f} ({low[1]})')
    print('== the plate: the data band (categories and neutral marks, base colours) and the far end')
    Lband = []
    for g, items in CAT.items():
        for k, (c, a) in items.items():
            Lband.append(lch8(parse(c))[0])
    Lband += [lch8(parse(c))[0] for c in (*MARKS.values(), NEUTRAL)]
    lab_L = lch8(parse(LABEL['ink']))[0]
    ok &= max(Lband) < lab_L
    print(f'  plate data band L {min(Lband):.3f}..{max(Lband):.3f}; label ink L {lab_L:.3f} keeps the far end; space L {lch8(parse(SPACE))[0]:.3f}')
    print('== the plate: each category against bare space at its drawn alpha (marks >= 3, guides >= GUIDE_MIN)')
    for g, items in CAT.items():
        for k, (c, a) in items.items():
            seen = over(parse(c), a, parse(SPACE)); x = cr(seen, parse(SPACE)); need = GUIDE_MIN if k in GUIDES else 3.0
            ok &= x >= need
            print(f'  {g:13s} {k:10s} {c} at {a:.2f}: {x:5.2f} (>= {need})  {"ok" if x >= need else "LOW"}')
    for k, a in {**GUIDE_A, **MARK_A}.items():
        x = cr(over(parse(NEUTRAL), a, parse(SPACE)), parse(SPACE)); need = 3.0 if k in MARK_A else GUIDE_MIN; ok &= x >= need
        print(f'  neutral {NEUTRAL} {k:10s} at {a:.2f}: {x:5.2f} (>= {need})')
    print('== categories that share a scale: every pair separates by dE (OKLab) >= 0.10, normal and simulated deutan, protan, tritan')
    for g, items in CAT.items():
        keys = list(items)
        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                if (keys[i], keys[j]) in SAME: continue
                a, b = (over(parse(items[k][0]), max(items[k][1], 0.6), parse(SPACE)) for k in (keys[i], keys[j]))
                d = {v: math.dist(sim(a, v), sim(b, v)) for v in VISION}
                m = min(d.values()); ok &= m >= 0.10
                print(f'  {g:13s} {keys[i]:10s} / {keys[j]:10s} min dE {m:.3f} ({min(d, key=d.get)})  {"ok" if m >= 0.10 else "LOW"}')
    print('== the ghost key (focus mode) over every plate base: a 1.4 px stroke over a 3.4 px halo, at rest (72 %)')
    for th, G in GHOST.items():
        low = 99
        for b in BASES.values():
            halo = over(G['halo'], G['halo_a'], parse(b)); stroke = over(parse(G['stroke']), 0.72, halo); low = min(low, cr(stroke, halo))
        ok &= low >= 3; print(f'  {th}: stroke against its own halo, worst {low:.2f} (>= 3)')
    print('== the key plates and the card sit on --sheet over the plate: their marks and text are the token pairs above')
    print('ALL CHECKS PASS' if ok else 'SOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
