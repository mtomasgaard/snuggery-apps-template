"""Hello Map's palette under the house system (ART.md): the chrome tokens, and the marks the app draws
on its plate: the collar (the signature: ticks, crosses and degree labels), the tapped point's
marker and the ghost key, all in one style on a pale halo. The plate's map is the U.S. Geological
Survey's and is not this app's to color; it keeps one appearance in both themes, so every plate mark
has one style too.

Standard library only. Run from Template/:  python3 hello-map/tools/art/palette.py [--json]
--json prints the values tools/check.mjs pins in styles.css and app.js (so nothing is retyped).

Color math: WCAG 2 relative luminance and OKLab (Ottosson 2020), as in Norway in 3D's and Global
Weather's tools/art/palette.py, copied so this folder stands alone.
"""
import json, math, sys

# ── color math (Norway in 3D's, word for word) ─────────────────────────────────────────────────────
def lin2lab(r, g, b):
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b; m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(x) ** (1 / 3), x) for x in (l, m, s))
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)
def dec(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def parse(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def lum(rgb): r, g, b = (dec(c / 255) for c in rgb); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def cr(a, b): la, lb = sorted((lum(a), lum(b)), reverse=True); return (la + .05) / (lb + .05)
def over(fg, a, bg): return tuple(round(f * a + g * (1 - a)) for f, g in zip(fg, bg))
def lab8(rgb): return lin2lab(*(dec(c / 255) for c in rgb))
def lch8(rgb): L, a, b = lab8(rgb); return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360
P = lambda h: parse(h)

# ── the house chrome tokens (HOUSE.md section 3.1), copied exactly ─────────────────────────────────
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72', line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f', line='#2a373c', strong='#64757b'),
}
# ── the plate's marks: one style in both themes ────────────────────────────────────────────────────
COLLAR = dict(ink='#0f1c23', halo='#f6f9fa', halo_a=0.88)       # the signature, and the marker
GHOST = dict(rest=0.72)                                         # the ghost key: the collar's style at 72 %
PLATE = '#dfe5e3'                                               # the plate under the map while it loads
OTHERS = {'Global Weather streak, light': '#0b171d', 'Norway in 3D skyline, light': '#13151a', 'Besseggen burn, light': '#1b110b'}
# What the marks are drawn over: the two layers' pictures, read with Chromium on 2026-10-19 from
# tiles of basemap.nationalmap.gov (USGSTopo and USGSImageryTopo; Yosemite Valley at level 13, the
# Grand Canyon at 12, Denver at 11 and 14, the country at 4 and 5): each tile's darkest pixel, its
# 1st, 50th and 99th percentile by luminance, and its lightest; plus the empty plate.
TILES = {
 'topo yosemite 13': ['#260e0e', '#3e4f7d', '#ddc9a6', '#f8fddf', '#250e06', '#503e3c', '#c6c6c8', '#fef5f6'],
 'topo grand canyon 12': ['#2a2a2c', '#804e45', '#e3edd5', '#142342', '#6e6d69', '#d6dfde'],
 'topo denver 11': ['#000000', '#35383f', '#d9d8e8', '#fffeff', '#6b3e27', '#d0dcdc', '#fcffff'],
 'topo country 4': ['#11110f', '#656567', '#deebd7', '#fdfffc', '#000009', '#58585a', '#b6d7f8', '#eefae2'],
 'imagery yosemite 13': ['#28081f', '#4f2d45', '#7c7966', '#c5f678', '#2e0e13', '#2f343a', '#828364', '#e9e18c'],
 'imagery grand canyon 12': ['#000000', '#44293a', '#8a8f88', '#eacfd4', '#29150a', '#514022', '#a7ada9', '#e3d7bf'],
 'imagery denver 14': ['#0e0f01', '#303b1d', '#93917c', '#fef8f8', '#000005', '#272a23', '#7f7c75', '#f7f5e9'],
 'imagery country 5': ['#151a00', '#292b04', '#60522b', '#e0ded2', '#110f00', '#212701', '#404117', '#cee4ff'],
 'white': ['#ffffff'],
 'plate': [PLATE],
}
GROUNDS = {f'{k} {i}': P(h) for k, v in TILES.items() for i, h in enumerate(v)}

def main():
    if '--json' in sys.argv:
        print(json.dumps({'collar': COLLAR, 'ghost': GHOST, 'plate': PLATE}))
        return
    fails, rows = [], []
    def check(cond, msg):
        rows.append(('ok  ' if cond else 'FAIL') + ' ' + msg)
        if not cond: fails.append(msg)
    # 1. the chrome
    for th, t in TOK.items():
        for k in ('ink', 'ink2', 'ink3'):
            for g in ('page', 'sheet'):
                check(cr(P(t[k]), P(t[g])) >= 4.5, f'{th}: --{k} on --{g} {cr(P(t[k]), P(t[g])):.2f} (text, >= 4.5)')
        check(cr(P(t['strong']), P(t['page'])) >= 3, f"{th}: --line-strong on --page {cr(P(t['strong']), P(t['page'])):.2f} (>= 3)")
        hi = max(lch8(P(v))[1] for v in t.values())
        check(hi <= 0.025, f'{th}: chrome chroma at most {hi:.4f} (<= 0.025)')
    # 2. the signature: the collar's ink on its halo, over every ground the two layers give
    ink, halo = P(COLLAR['ink']), P(COLLAR['halo'])
    L, C, h = lch8(ink)
    check(C <= 0.025, f'the collar is a near-neutral ink, OKLCh ({L:.3f}, {C:.4f}, {h:.0f}) (chroma <= 0.025)')
    worst = min(((cr(over(halo, COLLAR['halo_a'], g), ink), n) for n, g in GROUNDS.items()))
    check(worst[0] >= 4.5, f'the collar: ink on its halo over every ground, worst {worst[0]:.2f} over {worst[1]} (text, >= 4.5)')
    best = max(cr(over(halo, COLLAR['halo_a'], g), ink) for g in GROUNDS.values())
    rows.append(f'     the collar: best {best:.2f}')
    for name, o in OTHERS.items():
        rows.append(f'     dE to {name} {math.dist(lab8(ink), lab8(P(o))):.3f} (the same ink family; the collar differs by its form, not its color)')
    # 3. the ghost key at rest: the whole key at 72 %, so the stroke and its halo both thin out
    wg = min(cr(over(ink, GHOST['rest'], over(halo, COLLAR['halo_a'] * GHOST['rest'], g)), over(halo, COLLAR['halo_a'] * GHOST['rest'], g)) for g in GROUNDS.values())
    check(wg >= 3, f'the ghost key at rest: stroke on its halo, worst {wg:.2f} (mark, >= 3)')
    # 4. the empty plate under the notice and the collar
    check(cr(ink, P(PLATE)) >= 4.5, f'the collar on the empty plate {cr(ink, P(PLATE)):.2f} (>= 4.5)')
    print('\n'.join(rows))
    print('SOME CHECKS FAIL' if fails else 'ALL CHECKS PASS')
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
