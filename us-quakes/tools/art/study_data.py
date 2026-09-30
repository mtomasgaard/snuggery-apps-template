"""Extracts the real catalogue rows the art study (tools/art/study.html) draws. Writes study-data.json.

Reads only the pipeline's cache through design_measure.earthquakes(); run from Template/scripts/us_quakes:
    .venv/bin/python ../../us-quakes/tools/art/study_data.py
"""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import design_measure as dm  # noqa: E402

R = 6371.0088
def unit(la, lo):
    la, lo = math.radians(la), math.radians(lo)
    return (math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la))
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def dot(a, b): return sum(x*y for x, y in zip(a, b))
def norm(a):
    n = math.sqrt(dot(a, a)); return tuple(x/n for x in a)

eq = dm.earthquakes()
mag = lambda r: float(r['mag']) if r['mag'] != '' else None
dep = lambda r: float(r['depth']) if r['depth'] != '' else None

years = {}
for r in eq:
    y = int(r['time'][:4]); m = mag(r)
    if y < 1900 or m is None: continue
    c = years.setdefault(y, [0, 0])
    if m >= 2.5: c[0] += 1
    if m >= 4: c[1] += 1
before = sum(1 for r in eq if int(r['time'][:4]) < 1900)

A, B = unit(59.0, -146.8), unit(63.2, -154.2)
n = norm(cross(A, B)); L = math.atan2(math.sqrt(dot(cross(A, B), cross(A, B))), dot(A, B)) * R
sec = []
for r in eq:
    m, d = mag(r), dep(r)
    if m is None or m < 2.5 or d is None: continue
    la, lo = float(r['latitude']), float(r['longitude'])
    if not (57 < la < 65 and -157 < lo < -144): continue
    p = unit(la, lo); xt = math.asin(max(-1, min(1, dot(p, n)))) * R
    if abs(xt) > 50: continue
    pp = norm(tuple(pi - dot(p, n) * ni for pi, ni in zip(p, n)))
    at = math.atan2(dot(cross(A, pp), n), dot(pp, A)) * R
    if 0 <= at <= L: sec.append([round(at, 1), round(d, 1), m, r['id'] if m >= 7 else ''])

month = [[r['time'][:16], mag(r), dep(r), r['place']] for r in eq
         if r['time'] >= '2025-12-01' and mag(r) is not None]
out = {'note': 'Real ComCat rows from the pipeline cache (retrieved 2026-09-30); M 2.5+ from 1900.',
       'years': years, 'before1900': before, 'cookInlet': {'lengthKm': round(L, 1), 'rows': sec},
       'dec2025': month}
p = os.path.join(HERE, 'study-data.json')
with open(p, 'w') as f: json.dump(out, f, separators=(',', ':'))
mx = max(years.items(), key=lambda kv: kv[1][0])
print(f'years {len(years)}; max M2.5+ {mx[1][0]} in {mx[0]}; max M4+ {max(v[1] for v in years.values())}; '
      f'before 1900 {before}; Cook Inlet {len(sec)} rows, length {L:.1f} km, deepest {max(s[1] for s in sec)}; '
      f'Dec 2025 {len(month)} rows; {os.path.getsize(p):,} B')
