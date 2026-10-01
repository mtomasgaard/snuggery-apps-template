"""Pulls the numbers the art study draws from real files (not shipped, not the pipeline):
GISS's global-mean table (the pinned September 2026 copy) and the bench frames' coverage.
Writes study-data.json. Run from Template/: python3 warming-world/tools/art/study_data.py"""
import csv, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
TABLE = os.path.join(HERE, '../../../scripts/warming_world/cache/wayback/GLB.Ts+dSST.20260914.csv')
BENCH = os.path.join(HERE, '../.work/bench/bench.json')
rows = list(csv.reader(open(TABLE)))[2:]
years, means, partial = [], [], None
for r in rows:
    y = int(r[0]); months = [float(x) for x in r[1:13] if x != '***']
    if r[13] != '***': years.append(y); means.append(float(r[13]))
    elif len(months) >= 6: partial = {'year': y, 'months': len(months), 'mean': round(sum(months) / len(months), 3)}
cov = [round(c[2], 4) for c in json.load(open(BENCH))['years']]
last24 = []
for r in rows[-3:]:
    for i, x in enumerate(r[1:13]):
        if x != '***': last24.append([f'{r[0]}-{i+1:02d}', float(x)])
last24 = last24[-24:]
out = {'years': years, 'means': means, 'partial': partial, 'coverage': cov, 'months': last24,
       'source': os.path.basename(TABLE)}
json.dump(out, open(os.path.join(HERE, 'study-data.json'), 'w'), separators=(',', ':'))
print('years', years[0], '-', years[-1], len(years), '| min', min(means), years[means.index(min(means))],
      '| max', max(means), years[means.index(max(means))], '| partial', partial, '| coverage frames', len(cov),
      '| months', last24[0][0], '-', last24[-1][0])
