"""Prints every contrast figure in ART.md from the hex values (WCAG 2 relative luminance), plus the
OKLab lightness of the grounds DESIGN §7.4 constrains. Standard library. Run: python3 contrast.py"""
import math
from ramp import color_hex, lin2lab, dec

T = {
 'light': dict(page='#f5f5f5', card='#bebebe', sheet='#f5f5f5', ink='#161616', ink2='#4f4f4f', ink3='#666666',
               line='#d9d9d9', strong='#8a8a8a', cink='#121212', cink2='#333333'),
 'dark':  dict(page='#1f1f1f', card='#303030', sheet='#262626', ink='#ededed', ink2='#ababab', ink3='#8e8e8e',
               line='#393939', strong='#6b6b6b', cink='#f0f0f0', cink2='#c4c4c4'),
}
def rgb(h): return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
def lum(h): r, g, b = (dec(c) for c in rgb(h)); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def cr(a, b): la, lb = sorted((lum(a), lum(b)), reverse=True); return (la + .05) / (lb + .05)
def over(fg, a, bg): return '#' + ''.join('%02x' % round(255 * (x * a + y * (1 - a))) for x, y in zip(rgb(fg), rgb(bg)))
def L(h): return lin2lab(*(dec(c) for c in rgb(h)))[0]
def chroma(h): _, a, b = lin2lab(*(dec(c) for c in rgb(h))); return math.hypot(a, b)

worst = 99
for th, t in T.items():
    print(f'== {th}')
    rows = [('ink on page', t['ink'], t['page']), ('ink-2 on page', t['ink2'], t['page']), ('ink-3 on page', t['ink3'], t['page']),
            ('ink on sheet (tap card)', t['ink'], t['sheet']), ('ink-2 on sheet', t['ink2'], t['sheet']), ('ink-3 on sheet', t['ink3'], t['sheet']),
            ('card-ink on card', t['cink'], t['card']), ('card-ink-2 on card', t['cink2'], t['card'])]
    for n, a, b in rows:
        c = cr(a, b); worst = min(worst, c); print(f'  {n:28s} {c:5.2f}')
    print(f'  line-strong on page (track frame, non-text) {cr(t["strong"], t["page"]):.2f}')
    print(f'  OKLab L: page {L(t["page"]):.3f} card {L(t["card"]):.3f}; card vs 0 °C {abs(L(t["card"]) - L(color_hex(0))):.3f} (>= 0.15);'
          f' vs hatch 0.60/0.68 {min(abs(L(t["card"]) - .60), abs(L(t["card"]) - .68)):.3f} (>= 0.10)')
    print(f'  max chrome chroma {max(chroma(v) for v in t.values()):.4f}')
print(f'lowest text contrast: {worst:.2f}')
print('== overlay (same in both themes): coast #101010 at .74 over a white .40 halo')
for v in (-4, -2, 0, 2, 4):
    g = color_hex(v); halo = over('#ffffff', .40, g); line = over('#101010', .74, halo)
    print(f'  {v:+d} °C ground {g}: line vs ground {cr(line, g):.2f}, halo vs ground {cr(halo, g):.2f}')
for h in ('#989898', '#808080'):
    halo = over('#ffffff', .40, h); line = over('#101010', .74, halo); print(f'  hatch {h}: line vs ground {cr(line, h):.2f}')
print('== place labels: #121212 on a #f5f5f5 .85 halo, over the darkest ground (+4 °C)')
print(f'  {cr("#121212", over("#f5f5f5", .85, color_hex(4))):.2f}')
