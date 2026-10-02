"""Snug Kart's palette under the house system (ART.md section 2): the house's chrome tokens, the
eight racers' body colors fitted into each theme's band for the marks the chrome draws (the Lap
Chart's lines, the track map's dots, the rings around the faces), the Lap Chart's ink line on its
casing, the halo marks drawn over the 3D scene, and every contrast figure ART.md quotes. Standard
library only. Run from Template/:

    python3 snug-kart/tools/art/palette.py           the checks; ends ALL CHECKS PASS or SOME CHECKS FAIL
    python3 snug-kart/tools/art/palette.py --json    the fitted racer tones per theme, for js/palette.js
                                                     (pasted, never retyped; tools/check.mjs compares)

The racers' colors are read from data/racers.json and the tracks' scene colors from
data/tracks.json, never retyped, so an edit to either file is checked the next time this runs.

Color maths: OKLab (Ottosson 2020), WCAG 2 relative luminance, and the color-vision simulation of
Machado, Oliveira and Fernandes (2009, IEEE TVCG 15(6)) at severity 1.0 in linear sRGB: the same
functions as global-weather/tools/art/palette.py, copied so that this folder stands alone.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.normpath(os.path.join(HERE, '..', '..'))

# ── color maths (global-weather/tools/art/palette.py, unchanged) ─────────────
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
def de(a, b, kind='normal'): p, q = sim(a, kind), sim(b, kind); return math.dist(p, q)
def gamut_map(L, C, h):
    # Keeps L and hue and lowers chroma until the color is inside sRGB.
    while C > 1e-4 and not in_gamut(lab2lin(*lch2lab(L, C, h))): C *= 0.98
    return rgb8(lab2lin(*lch2lab(L, C, h)))

# ── the house's chrome tokens (HOUSE.md 3.1), copied as they are ─────────────
TOK = {
 'light': dict(page='#e8eef0', sheet='#f6f9fa', ink='#0f1c23', ink2='#45555d', ink3='#5b6a72',
               line='#c9d4d8', strong='#74858c'),
 'dark':  dict(page='#141d21', sheet='#1c272c', ink='#e6edee', ink2='#a3b1b6', ink3='#8b9a9f',
               line='#2a373c', strong='#64757b'),
}
# The halo marks drawn over the 3D scene (the reticle, the steering ring, the side words' plates are
# plates): the house ghost key's recipe, HOUSE.md 3.1, a 1.4 px stroke over a 3.4 px halo.
GHOST = {'light': dict(stroke='#0f1c23', halo=(246, 249, 250), halo_a=0.60),
         'dark': dict(stroke='#f2f4f1', halo=(10, 16, 19), halo_a=0.45)}

# ── the tonal budget (ART.md 2) ──────────────────────────────────────────────
# The racers' body colors keep their hue and chroma; only lightness is fitted to the theme's band. The light theme's band sits below the grounds, the dark theme's above them,
# and the signature (the player's line, --ink) keeps the far end of the range in both.
BAND = {'light': (0.380, 0.620), 'dark': (0.620, 0.860)}
# Where each racer sits in the band: eight even steps, 0 nearest the ground's far side (darkest in
# the light theme, dimmest in the dark one), 7 the lightest. Ines's charcoal stays at 0 and Wren's
# gold at 7, as in the data; the rest are spread so that every pair stands apart by dE >= 0.10. The
# data's own orange and gold (Pip #F28C28, Wren #D9A21B) are only 0.067 apart, and a straight map of
# their lightness put them at 0.057, so Pip's orange is printed darker than its kart (step 2): the
# one thing given up, said in ART.md. Every hue and, gamut permitting, every chroma is the data's.
# Found by trying all 5 040 orders with Wren held at 7 (ART.md 2); a racer this table does not name
# (an edited racers.json) is placed by its own lightness, as a straight map would place it.
STEP = {'ines': 0, 'otto': 1, 'pip': 2, 'soren': 3, 'tuck': 4, 'mabel': 5, 'juno': 6, 'wren': 7}
# The Lap Chart draws the player's line as a 2 px --ink stroke on a 6 px casing of the panel's own
# ground (--sheet), so the ink always reads against the ground, whatever line it crosses.
CHART_GROUND = 'sheet'

def racers():
    with open(os.path.join(APP, 'data', 'racers.json'), encoding='utf-8') as f: return json.load(f)['racers']
def tracks():
    with open(os.path.join(APP, 'data', 'tracks.json'), encoding='utf-8') as f: return json.load(f)['tracks']

def fitted():
    rs = racers(); Ls = [lch8(parse(r['body']))[0] for r in rs]; lo, hi = min(Ls), max(Ls)
    out = {}
    for th, (b0, b1) in BAND.items():
        out[th] = {}
        for r, L0 in zip(rs, Ls):
            _, C, h = lch8(parse(r['body']))
            k = STEP[r['id']] / 7 if r['id'] in STEP else (L0 - lo) / (hi - lo)
            L = b0 + (b1 - b0) * k
            out[th][r['id']] = hx(gamut_map(L, C, h))
    return out

def scene_bases():
    # Every base color a halo mark can sit on: each track's sky, fog, road, verges, ground, water,
    # walls and stone, and the lantern and window lights, as data/tracks.json gives them (base colors;
    # lighting moves the rendered ones, which shoot.mjs samples on frames).
    keys = ('skyTop', 'skyHorizon', 'fog', 'asphalt', 'verge', 'ground', 'stone', 'water', 'wall', 'rock', 'snow',
            'trees', 'windows', 'accent')
    out = []
    for t in tracks():
        p = t['palette']
        for k in keys:
            if isinstance(p.get(k), str): out.append((f"{t['id']}.{k}", p[k]))
        for k in ('houses', 'pines', 'lanterns'):
            for i, c in enumerate(p.get(k) or []): out.append((f"{t['id']}.{k}[{i}]", c))
    return out

def main():
    F = fitted()
    if '--json' in sys.argv:
        # "from" is each body color the tones were fitted from: the app uses a tone only while the
        # racer's color in data/racers.json still equals it, and the data's own color otherwise.
        print(json.dumps({'from': {r['id']: r['body'] for r in racers()}, **F})); return
    ok = True
    def check(cond, msg):
        nonlocal ok; ok &= bool(cond); print(('ok   ' if cond else 'FAIL ') + msg)

    print('== 1. chrome tokens: WCAG 2 contrast (text >= 4.5; --line-strong >= 3 on --page)')
    for th, t in TOK.items():
        for g in ('page', 'sheet'):
            for k in ('ink', 'ink2', 'ink3'):
                c = cr(parse(t[k]), parse(t[g])); check(c >= 4.5, f'{th}: {k} on {g} {c:.2f}')
        c = cr(parse(t['strong']), parse(t['page'])); check(c >= 3, f'{th}: line-strong on page {c:.2f}')
        c = cr(parse(t['strong']), parse(t['sheet'])); check(c >= 3, f'{th}: line-strong on sheet {c:.2f} (the map\'s road, the plates\' frames)')
        cmax = max(lch8(parse(v))[1] for v in t.values()); check(cmax <= 0.024, f'{th}: highest chroma of any chrome token {cmax:.4f} (<= 0.024)')
        on = over(parse(t['ink']), 0.12, parse(t['sheet']))
        check(cr(parse(t['ink']), on) >= 4.5, f'{th}: ink on the on-plate {hx(on)} {cr(parse(t["ink"]), on):.2f} (the chosen row, a key that is on)')
        check(cr(parse(t['ink2']), on) >= 4.5, f'{th}: ink-2 on the on-plate {cr(parse(t["ink2"]), on):.2f}')
        check(cr(parse(t['page']), parse(t['ink'])) >= 4.5, f'{th}: --page word on an --ink key {cr(parse(t["page"]), parse(t["ink"])):.2f} (Race, Resume, Race again, a charged Drift)')

    print('\n== 2. the racers\' tones, fitted per theme (hue and chroma kept, lightness in the band)')
    rs = racers()
    o = {r['id']: parse(r['body']) for r in rs}; ids0 = list(o)
    close = [(a, b, de(o[a], o[b])) for i, a in enumerate(ids0) for b in ids0[i + 1:] if de(o[a], o[b]) < 0.10]
    print('     the data\'s own body colors closer than dE 0.10: ' + (', '.join(f'{a}/{b} {d:.3f}' for a, b, d in close) or 'none'))
    for th in BAND:
        t = TOK[th]; lo_c = []
        for r in rs:
            c = F[th][r['id']]; L, C, h = lch8(parse(c)); L0, C0, h0 = lch8(parse(r['body']))
            cp, cs = cr(parse(c), parse(t['page'])), cr(parse(c), parse(t['sheet']))
            lo_c.append(min(cp, cs))
            inband = BAND[th][0] - 0.002 <= L <= BAND[th][1] + 0.002
            check(inband and cp >= 3 and cs >= 3,
                  f"{th}: {r['id']:5} {r['body']} -> {c}  L {L0:.3f} -> {L:.3f}, C {C0:.3f} -> {C:.3f}, h {h0:.0f} -> {h:.0f}; on page {cp:.2f}, on sheet {cs:.2f}")
        print(f'     {th}: the lowest tone-on-ground contrast {min(lo_c):.2f} (target 3.0, a mark)')

    print('\n== 3. the racers as categories: every pair apart by dE (OKLab) >= 0.10')
    ids = [r['id'] for r in rs]
    for th in BAND:
        for kind in ('normal', 'deutan', 'protan', 'tritan'):
            pairs = sorted(((de(parse(F[th][a]), parse(F[th][b]), kind), a, b) for i, a in enumerate(ids) for b in ids[i + 1:]))
            low = [p for p in pairs if p[0] < 0.10]
            msg = f'{th}, {kind}: the closest pair {pairs[0][1]}/{pairs[0][2]} dE {pairs[0][0]:.3f}; {len(low)} of {len(pairs)} pairs under 0.10'
            if kind == 'normal': check(not low, msg)
            else:
                print(('note ' if low else 'ok   ') + msg + (': ' + ', '.join(f'{a}/{b} {d:.3f}' for d, a, b in low) if low else ''))
    print('     Eight racers are more than five categories: the chart names every line at its end and the')
    print('     results name every row, so identity never rests on color alone (HOUSE.md 3.3).')

    print('\n== 4. the signature: the player\'s ink line on its casing, and what it would be without it')
    for th in BAND:
        t = TOK[th]; ink = parse(t['ink']); g = parse(t[CHART_GROUND])
        L, C, h = lch8(ink)
        check(C <= 0.024, f'{th}: the ink {t["ink"]} is a near-neutral (L {L:.3f}, C {C:.4f})')
        check(cr(ink, g) >= 3, f'{th}: ink on its {CHART_GROUND} casing {cr(ink, g):.2f} (target 3.0)')
        far = (L < BAND[th][0]) if th == 'light' else (L > BAND[th][1])
        check(far, f'{th}: the ink keeps the far end of the range (L {L:.3f}; band {BAND[th][0]:.3f}-{BAND[th][1]:.3f})')
        worst = min((cr(ink, parse(c)), rid) for rid, c in F[th].items())
        print(f'     {th}: without the casing, ink over the closest tone ({worst[1]}) would be {worst[0]:.2f}; the casing is why it holds')
        check(cr(parse(t['ink']), parse(t['sheet'])) >= 4.5, f'{th}: the player\'s name at its line end, ink on sheet {cr(ink, g):.2f}')

    print('\n== 5. the track map plate (a --sheet plate over the scene)')
    for th in BAND:
        t = TOK[th]
        check(cr(parse(t['strong']), parse(t['sheet'])) >= 3, f'{th}: the road, 4 px of --line-strong on the plate, {cr(parse(t["strong"]), parse(t["sheet"])):.2f}')
        worst = min((cr(parse(c), parse(t['sheet'])), rid) for rid, c in F[th].items())
        check(worst[0] >= 3, f'{th}: the dots, each tone on its 1 px sheet ring, lowest {worst[0]:.2f} ({worst[1]})')
        check(cr(parse(t['ink']), parse(t['sheet'])) >= 3, f'{th}: the player, the tracer head (--ink disc, --sheet ring), {cr(parse(t["ink"]), parse(t["sheet"])):.2f}')

    print('\n== 6. halo marks over the scene (the reticle, the steering ring): stroke against its own halo over every base')
    bases = scene_bases()
    for th, gk in GHOST.items():
        res = sorted((cr(parse(gk['stroke']), over(gk['halo'], gk['halo_a'], parse(c))), name, c) for name, c in bases)
        check(res[0][0] >= 3, f'{th}: lowest {res[0][0]:.2f} over {res[0][1]} {res[0][2]} ({len(bases)} base colors from data/tracks.json)')

    print('\nALL CHECKS PASS' if ok else '\nSOME CHECKS FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
