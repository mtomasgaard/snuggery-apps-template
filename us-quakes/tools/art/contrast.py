"""WCAG 2 contrast of ART.md's tokens (both themes), the rims, the ramp against the grounds, and the
volcano color codes. Computed from the hex values; tools/shoot.mjs re-measures the rendered text styles.
    python3 tools/art/contrast.py
"""
def rl(h):
    h = h.lstrip('#'); v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    v = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in v]
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
def cr(a, b):
    x, y = sorted([rl(a), rl(b)], reverse=True); return round((x + 0.05) / (y + 0.05), 2)
def over(rgba, bg):
    b = [int(bg.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(round(c * rgba[3] + d * (1 - rgba[3])) for c, d in zip(rgba[:3], b))
T = {'light': dict(bg='#f1f3f4', panel='#fafbfb', ink='#15191c', ink2='#4d5760', ink3='#646e76',
                   land='#ebedeb', sea='#d5dfe5', sea7000='#a8b8c6', fault='#3a4146', glass=(250, 251, 251, 0.9)),
     'dark': dict(bg='#0c0e10', panel='#15181b', ink='#e7e9e7', ink2='#9ba3a9', ink3='#848d94',
                  land='#1c2023', sea='#0f1418', sea7000='#05070a', fault='#c3c9cd', glass=(21, 24, 27, 0.9))}
RAMP = ['#fde28d', '#f5a231', '#dc6673', '#9a6299', '#5d47ad', '#2a3b6b']
DARK_RIM, LIGHT_RIM = (16, 20, 24, 0.55), (255, 255, 255, 0.5)
VOL = {'GREEN': '#4f9a5a', 'YELLOW': '#f2cc38', 'ORANGE': '#ee8a2a', 'RED': '#d0342c'}
for n, t in T.items():
    print(f'== {n}')
    for fg in ('ink', 'ink2', 'ink3'):
        print(f'  {fg:4s} on bg {cr(t[fg], t["bg"])}  on panel {cr(t[fg], t["panel"])}')
    for g in ('land', 'sea', 'sea7000', '#000000', '#ffffff'):
        gl = over(t['glass'], t.get(g, g))
        print(f'  glass over {g:8s} ink2 {cr(t["ink2"], gl)}  ink {cr(t["ink"], gl)}')
    print(f'  fault on land {cr(t["fault"], t["land"])}  on sea {cr(t["fault"], t["sea"])}')
    for name, rim in (('dark rim', DARK_RIM), ('light rim', LIGHT_RIM)):
        print(f'  {name} vs land {cr(over(rim, t["land"]), t["land"])}  vs sea {cr(over(rim, t["sea"]), t["sea"])}')
    print('  ramp vs land', [cr(c, t['land']) for c in RAMP])
    print('  ramp vs sea ', [cr(c, t['sea']) for c in RAMP])
    print('  volcano codes vs land', {k: cr(v, t['land']) for k, v in VOL.items()})
# The rim switches with depth (ART.md "Rims"): dark below 60 km (and for no depth), light from 60 km.
print('== the 60 km switch, fill #ad648f')
for n, t in T.items():
    print(f'  {n}: fill vs land {cr("#ad648f", t["land"])} sea {cr("#ad648f", t["sea"])} sea7000 {cr("#ad648f", t["sea7000"])}; '
          f'dark rim vs sea7000 {cr(over(DARK_RIM, t["sea7000"]), t["sea7000"])}; light rim vs sea7000 {cr(over(LIGHT_RIM, t["sea7000"]), t["sea7000"])}')
print('  no-depth grey #8a9099 vs land', {n: cr('#8a9099', t['land']) for n, t in T.items()})
