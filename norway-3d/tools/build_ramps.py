#!/usr/bin/env python3
"""Build js/ramps.js: the elevation surface's color tables, 64 stops each, from their pinned sources.

  batlow, oleron  Fabio Crameri's Scientific colour maps (version 8), through the cmcrameri package's
                  copy of the tables (MIT License, as the package and Crameri's release state);
                  oleron is the topographic one (sea blue, land from green to white), used here for
                  its land half only, since the sea is drawn at its surface.
  viridis         matplotlib's (CC0, by Stéfan van der Walt and Nathaniel Smith).

Each table is cut to 64 evenly spaced stops (the shader interpolates between them) and written as
hex. Sources and their pins are in the header of the written file and in CREDITS.txt.

  python3 tools/build_ramps.py
"""
import os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.cache')
PINS = {
    'cmcrameri': 'https://raw.githubusercontent.com/callumrollo/cmcrameri/v1.9/cmcrameri/cmaps/{}.txt',
    'matplotlib': 'https://raw.githubusercontent.com/matplotlib/matplotlib/v3.9.2/lib/matplotlib/_cm_listed.py',
}


def get(url, name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        subprocess.run(['curl', '-sSf', '-m', '60', '-o', path, url], check=True)
    return open(path, encoding='utf-8').read()


def cut(rows, n=64, lo=0.0, hi=1.0):
    out = []
    for i in range(n):
        f = lo + (hi - lo) * i / (n - 1)
        x = f * (len(rows) - 1)
        a, b = int(x), min(len(rows) - 1, int(x) + 1)
        k = x - a
        c = [rows[a][j] * (1 - k) + rows[b][j] * k for j in range(3)]
        out.append('%02x%02x%02x' % tuple(round(max(0, min(1, v)) * 255) for v in c))
    return out


def main():
    tables = {}
    for name in ('batlow', 'oleron'):
        txt = get(PINS['cmcrameri'].format(name), f'ramp-{name}.txt')
        rows = [[float(v) for v in line.split()] for line in txt.strip().splitlines() if line.strip()]
        # oleron: the first half is its sea; this app draws the sea at its surface, so the land half
        tables[name] = cut(rows, lo=0.5 if name == 'oleron' else 0.0)
    src = get(PINS['matplotlib'], 'ramp-mpl-cm-listed.py')
    m = re.search(r'_viridis_data = (\[.*?\]\])', src, re.S)
    rows = eval(m.group(1), {'__builtins__': {}})   # a literal list of lists, from a pinned file
    tables['viridis'] = cut(rows)
    lines = ['// The elevation surface\'s color tables, written by tools/build_ramps.py (do not edit by hand):',
             '// 64 stops each, low to high. batlow and oleron (its land half): Fabio Crameri\'s',
             '// Scientific colour maps, MIT License, through the cmcrameri package (v1.9). viridis: matplotlib 3.9.2, CC0.',
             'export const RAMPS = {']
    for k, v in tables.items():
        lines.append(f"  {k}: '{''.join(v)}',")
    lines.append('};')
    with open(os.path.join(APP, 'js', 'ramps.js'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print({k: (v[0], v[-1]) for k, v in tables.items()})


if __name__ == '__main__':
    main()
