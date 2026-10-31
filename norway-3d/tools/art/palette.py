"""Norway in 3D's palette under the house system (ART.md section 2): the chrome tokens, the signature
(the skyline on the time track), and the marks the app draws on its plate: the floating names on
their halos, the cabins on their casing, the marker, the steepness classes, the snow key, the
viewshed's two states and the ghost key. The plate's map is Kartverket's and is not this app's to
color; it keeps one daylight appearance in both themes, so every plate mark has one style.

Standard library only. Run from Template/:  python3 norway-3d/tools/art/palette.py [--json]
--json prints the values tools/check.mjs pins in styles.css and js/ (so nothing is retyped).

Color math: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009) at severity 1.0 in linear sRGB, as in Besseggen's
tools/art/palette.py and Global Weather's, copied so this folder stands alone.
"""
import json, math, sys

# ── color math (Besseggen's, word for word) ─────────────────────────────────────────────────────
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
CVD = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
       'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
       'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
def sim(rgb, kind):
    lin = [dec(c / 255) for c in rgb]
    if kind != 'normal': lin = [min(1, max(0, sum(CVD[kind][i][j] * lin[j] for j in range(3)))) for i in range(3)]
    return lin2lab(*lin)
def sep(a, b): return {k: math.dist(sim(a, k), sim(b, k)) for k in ('normal', 'deutan', 'protan', 'tritan')}
P = lambda h: parse(h)

# ── the house chrome tokens (HOUSE.md section 3.1), copied exactly ─────────────────────────────────
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72', line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f', line='#2a373c', strong='#64757b'),
}
# ── the signature: the skyline on the time track (ART.md section 1) ───────────────────────────────
SKY = {'light': '#13151a', 'dark': '#f4efe6'}           # the terrain's horizon while the sun is up
NIGHT = {'light': '#b9c3c8', 'dark': '#3a474d'}         # the same horizon while the sun is down
OTHERS = {'Global Weather streak, light': '#0b171d', 'Global Weather streak, dark': '#f4f2ea',
          'Besseggen burn, light': '#1b110b', 'Besseggen burn, dark': '#fcf2e5',
          'Milky Way reach, light': '#132a5c', 'Milky Way reach, dark': '#c8d6f2'}
# ── the plate's own marks: one style in both themes (the plate is daylight in both) ────────────────
LABEL = dict(ink='#0f1c23', ink2='#45555d', halo='#f6f9fa', halo_a=0.88, lake='#1f5f8a', glacier='#3d5866')
CABIN = dict(ink='#0f1c23', casing='#f6f9fa', casing_a=0.92)
GHOST = dict(stroke='#0f1c23', halo='#f6f9fa', halo_a=0.60, rest=0.72)
SLOPE = ['#fff200', '#f29a1f', '#e0382d', '#8a3d9e', '#3a3a3a']        # 27-30, 30-35, 35-40, 40-45, 45+
SLOPE_A = 0.72                                                        # over the ground, before the light
SNOW = dict(white='#f6f9fb', ground='#9aa7ae', amounts=[0.5, 0.78, 1.0])
VIEWSHED = dict(seen='#3fa7a0', tint=0.5, veil='#f6f9fa', veil_a=0.40)
RELIEF = '#c2bdb2'; WATER = '#a9cfe0'
# What the marks are drawn over: Kartverket's topo (its land, forest, glacier, water and rock, read
# from tiles on 2026-10-16 at z 13 over Jotunheimen), the relief ground, each lit from deep shade (x 0.45)
# to full sun (x 1.15), as js/material.js lights them.
MAP = {'land': '#f3ede0', 'forest': '#cfe3b8', 'glacier': '#ecf3f8', 'water': '#c6ecfa', 'rock': '#d8d2c8', 'relief': RELIEF}
def lit(h, k):
    lin = [min(1.0, dec(c / 255) * k) for c in P(h)]
    return tuple(round((12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055) * 255) for x in lin)
GROUNDS = {f'{n} x{k}': lit(h, k) for n, h in MAP.items() for k in (0.45, 0.75, 1.0, 1.15)}

def main():
    fails, rows = [], []
    def check(cond, msg):
        rows.append(('ok  ' if cond else 'FAIL') + ' ' + msg)
        if not cond: fails.append(msg)
    if '--json' in sys.argv:
        print(json.dumps({'sky': SKY, 'night': NIGHT, 'label': LABEL, 'cabin': CABIN, 'ghost': GHOST, 'slope': SLOPE, 'snow': SNOW, 'viewshed': VIEWSHED, 'relief': RELIEF, 'water': WATER}))
        return
    # 1. the chrome
    for th, t in TOK.items():
        for k in ('ink', 'ink2', 'ink3'):
            for g in ('page', 'sheet'):
                check(cr(P(t[k]), P(t[g])) >= 4.5, f'{th}: --{k} on --{g} {cr(P(t[k]), P(t[g])):.2f} (text, >= 4.5)')
        check(cr(P(t['strong']), P(t['page'])) >= 3, f"{th}: --line-strong on --page {cr(P(t['strong']), P(t['page'])):.2f} (>= 3)")
        hi = max(lch8(P(v))[1] for v in t.values())
        check(hi <= 0.025, f'{th}: chrome chroma at most {hi:.4f} (<= 0.025)')
    # 2. the signature
    for th in ('light', 'dark'):
        t = TOK[th]; s = P(SKY[th]); n = P(NIGHT[th])
        L, C, h = lch8(s); Li = lch8(P(t['ink']))[0]
        check(C <= 0.021, f'{th}: the skyline is a near-neutral, OKLCh ({L:.3f}, {C:.4f}, {h:.0f}) (chroma <= 0.021)')
        check((L < Li) if th == 'light' else (L > Li), f'{th}: the skyline stands beyond --ink (L {L:.3f} against {Li:.3f})')
        for g in ('page', 'sheet'):
            check(cr(s, P(t[g])) >= 4.5, f'{th}: the skyline on --{g} {cr(s, P(t[g])):.2f} (>= 4.5: it carries the reading)')
        check(cr(s, P(t['page'])) >= 3 and cr(P(t['ink3']), s) >= 1.6, f"{th}: the sun's hairline (--ink-3) over the skyline {cr(P(t['ink3']), s):.2f} (>= 1.6; a hidden sun is drawn faint on purpose)")
        cn = cr(n, P(t['page']))
        check(1.25 <= cn <= 2.2, f'{th}: the night skyline on --page {cn:.2f} (a faint context, 1.25 to 2.2)')
        check(cr(s, n) >= 3, f'{th}: the skyline against the night skyline {cr(s, n):.2f} (>= 3: day stands out of night)')
        for name, o in OTHERS.items():
            rows.append(f'     {th}: dE to {name} {math.dist(lab8(s), lab8(P(o))):.3f}')
    # 3. the plate's marks, over every ground the map and the relief give, lit
    worst = min(cr(over(P(LABEL['halo']), LABEL['halo_a'], g), P(LABEL['ink'])) for g in GROUNDS.values())
    check(worst >= 4.5, f'names: ink on its halo over every ground, worst {worst:.2f} (>= 4.5)')
    for k in ('ink2', 'lake', 'glacier'):
        w = min(cr(over(P(LABEL['halo']), LABEL['halo_a'], g), P(LABEL[k])) for g in GROUNDS.values())
        check(w >= 4.5, f'names: {k} on the halo, worst {w:.2f} (>= 4.5)')
    w = min(cr(over(P(CABIN['casing']), CABIN['casing_a'], g), P(CABIN['ink'])) for g in GROUNDS.values())
    check(w >= 3, f'cabins: the glyph on its casing, worst {w:.2f} (mark, >= 3)')
    w = min(cr(over(P(GHOST['halo']), GHOST['halo_a'], g), P(GHOST['stroke'])) for g in GROUNDS.values())
    check(w >= 3, f'ghost key: stroke on its halo, worst {w:.2f} (>= 3)')
    # 4. the steepness classes: every pair apart in all four visions, as drawn over the relief
    drawn = [over(P(c), SLOPE_A, P(RELIEF)) for c in SLOPE]
    for i in range(len(SLOPE)):
        for j in range(i + 1, len(SLOPE)):
            d = sep(drawn[i], drawn[j]); m = min(d.values())
            check(m >= 0.10 if j == i + 1 else m >= 0.08, f'steepness {i}/{j}: dE {d["normal"]:.3f} normal, {d["deutan"]:.3f} deutan, {d["protan"]:.3f} protan, {d["tritan"]:.3f} tritan (adjacent >= 0.10)')
        d = min(sep(drawn[i], P(RELIEF)).values())
        check(d >= 0.08, f'steepness {i}: dE {d:.3f} from the bare relief (>= 0.08)')
    # 5. the snow key's three steps, apart from each other and from the bare ground
    keys = [over(P(SNOW['white']), a, P(SNOW['ground'])) for a in SNOW['amounts']]
    for i in range(len(keys) - 1):
        d = min(sep(keys[i], keys[i + 1]).values())
        check(d >= 0.04, f'snow key {i}/{i + 1}: dE {d:.3f} (>= 0.04)')
    # 6. the viewshed: seen and hidden apart over every ground, in all four visions
    wv = 9
    for g in GROUNDS.values():
        seen = over(P(VIEWSHED['seen']), VIEWSHED['tint'], g); hid = over(P(VIEWSHED['veil']), VIEWSHED['veil_a'], g)
        wv = min(wv, min(sep(seen, hid).values()))
    check(wv >= 0.06, f'viewshed: seen against hidden, worst dE {wv:.3f} over every ground and vision (>= 0.06)')
    print('\n'.join(rows))
    print('SOME CHECKS FAIL' if fails else 'ALL CHECKS PASS')
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
