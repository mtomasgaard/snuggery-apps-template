"""Measure the model's depth datum: its completed cells against the surveyed well paths below sea level.

The deck states no datum. For every cell a deck well is completed in (OPM's connection depth, the
prepared grid's pillars and MAPAXES for x and y), the 3D distance to that well's surveyed path in
data/wellpaths.json (TVDSS) is measured with the model's depths taken as sea level, and shifted by
the 54.9 m KB elevation either way. Result and reading: tools/DECISIONS.md section 7.

    python3 tools/measure_datum.py pipeline/work/deck/VOLVE_2016.DATA \
        pipeline/work/deck/GRID_postF1B_Nov2013_locupd_12112013.grdecl data/wellpaths.json
"""
import json, re, sys
import numpy as np
import opm.io
from opm.io.parser import Parser, ParseContext
from opm.io.ecl_state import EclipseState
from opm.io.schedule import Schedule

deckp, gridp, wpp = sys.argv[1:4]
txt = open(gridp).read()
def kw(name):
    m = re.search(r"^" + name + r"\s*\n(.*?)/", txt, re.S | re.M)
    vals = []
    for t in m.group(1).split():
        if "*" in t:
            n, v = t.split("*"); vals += [float(v)] * int(n)
        else:
            vals.append(float(t))
    return np.array(vals)
ma = kw("MAPAXES").reshape(3, 2)
coord = kw("COORD").reshape(-1, 6)
nx, ny = 108, 100
P = coord.reshape(ny + 1, nx + 1, 6)
yaxis, origin, xaxis = ma
ex = (xaxis - origin) / np.linalg.norm(xaxis - origin); ey = (yaxis - origin) / np.linalg.norm(yaxis - origin)
def cell_xy(i, j, z):
    pts = []
    for dj in (0, 1):
        for di in (0, 1):
            x1, y1, z1, x2, y2, z2 = P[j + dj, i + di]
            t = (z - z1) / (z2 - z1) if z2 != z1 else 0.0
            pts.append((x1 + t * (x2 - x1), y1 + t * (y2 - y1)))
    lx, ly = np.mean(pts, axis=0)
    return origin + lx * ex + ly * ey

pc = ParseContext([("PARSE_EXTRA_RECORDS", opm.io.action.ignore), ("PARSE_RANDOM_SLASH", opm.io.action.ignore)])
deck = Parser().parse(deckp, pc); st = EclipseState(deck); sch = Schedule(deck, st)
conns = {}
for step in range(len(sch.reportsteps)):
    for w in sch.get_wells(step):
        for c in w.connections():
            conns.setdefault(w.name, {})[(c.i, c.j, c.k)] = c.center_depth
wp = {w["deckWell"]: w for w in json.load(open(wpp))["wells"] if w["deckWell"]}
cells = []
for name, cs in sorted(conns.items()):
    if name not in wp:
        continue
    w = wp[name]
    md = np.array(w["md"]); mdd = np.arange(md[0], md[-1], 0.5)
    path = np.stack([np.interp(mdd, md, np.array(w[a])) for a in ("x", "y", "tvdss")], 1)
    for (i, j, k), cz in cs.items():
        cx, cy = cell_xy(i, j, cz)
        cells.append((name, np.array([cx, cy, cz]), path))
print(f"{len(cells)} completed cells in {len({c[0] for c in cells})} wells with surveyed paths")
def miss(off):
    return np.array([np.min(np.linalg.norm(p - (c - [0, 0, off]), axis=1)) for _, c, p in cells])
for off in (0.0, 54.9, -54.9):
    m = miss(off)
    print(f"  model depth = path TVDSS + {off:+.1f} m: 3D distance from cell centre to path median {np.median(m):.2f} m, 90% {np.percentile(m,90):.2f} m")
offs = np.arange(-30, 30.5, 1.0)
med = [np.median(miss(o)) for o in offs]
b = offs[int(np.argmin(med))]
print(f"  best vertical shift (1 m steps, -30..30): {b:+.0f} m, median distance {min(med):.2f} m")
names = sorted({c[0] for c in cells}); m0 = miss(0.0)
for n in names:
    s_ = np.array([c[0] == n for c in cells]); print(f"    {n:8s} {s_.sum():3d} cells  median distance {np.median(m0[s_]):6.2f} m")
