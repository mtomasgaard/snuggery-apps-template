#!/usr/bin/env python3
"""Step 2 — fetch the trail, the place names and check the map data is in the cache.

  Turrutebasen (Tur- og friluftsruter), Kartverket, open data — the marked foot routes, WFS 2.0.0,
      one bbox request over the core box.  GML 3.2.1 is the only output format the service offers.
  SSR (Sentralt stedsnavnregister), Kartverket, CC BY 4.0 — the place names, REST, a grid of
      5 km discs (the service caps `radius` at 5000 m).
  N50 Kartdata, Kartverket, CC BY 4.0 — lakes, rivers and glaciers.  Already in the cache as two
      kommune zips ordered through the Geonorge download API; this step only checks they are there
      and never re-downloads them.  cache/SOURCES.md section 3 records the exact order request.

Everything is written once and reused, so a rebuild neither re-fetches nor changes.
"""
from __future__ import annotations
import json
import math
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geom
from paths import N50, VECTORS

WFS = 'https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter'
SSR = 'https://ws.geonorge.no/stedsnavn/v1'
SSR_RADIUS = 5000          # the service's own cap; above it the API answers HTTP 422
DISC_STEP = 6000           # so every point of the core box is within 4243 m of a disc centre
PAUSE_S = 0.4

N50_ZIPS = ['Basisdata_3435_Vaga_25833_N50Kartdata_GML.zip',
            'Basisdata_3434_Lom_25833_N50Kartdata_GML.zip']


def get(url, params, path, binary=False):
    if os.path.exists(path) and os.path.getsize(path) > 64:
        return path
    for attempt in range(4):
        t = time.time()
        r = requests.get(url, params=params, timeout=180)
        if r.status_code == 200 and len(r.content) > 64:
            tmp = path + '.part'
            with open(tmp, 'wb') as f:
                f.write(r.content)
            os.replace(tmp, path)
            print(f'    {os.path.basename(path)}  {len(r.content):,} B  {time.time()-t:.1f} s')
            time.sleep(PAUSE_S)
            return path
        print(f'    retry {attempt + 1}/4: HTTP {r.status_code}, {len(r.content)} B')
        time.sleep(5 * (attempt + 1))
    raise SystemExit(f'giving up on {path}')


def fetch_trails():
    box = geom.CORE
    bbox = f"{box['x0']},{box['y0']},{box['x1']},{box['y1']},urn:ogc:def:crs:EPSG::25833"
    return get(WFS, {'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature',
                     'typeNames': 'app:Fotrute',
                     'srsName': 'urn:ogc:def:crs:EPSG::25833', 'bbox': bbox},
               os.path.join(VECTORS, 'fotrute_core.gml'))


def fetch_places():
    """A grid of 5 km discs over the core box, merged on stedsnummer and sorted, so the file is
    the same however the discs happen to overlap."""
    out = os.path.join(VECTORS, 'ssr_core.json')
    if os.path.exists(out):
        return out
    box = geom.CORE
    nx = math.ceil((box['x1'] - box['x0']) / DISC_STEP) + 1
    ny = math.ceil((box['y1'] - box['y0']) / DISC_STEP) + 1
    centres = [(box['x0'] + round(i * (box['x1'] - box['x0']) / (nx - 1)),
                box['y0'] + round(j * (box['y1'] - box['y0']) / (ny - 1)))
               for j in range(ny) for i in range(nx)]
    found = {}
    for k, (cx, cy) in enumerate(centres, 1):
        page = 1
        while True:
            tmp = os.path.join(VECTORS, f'.ssr_disc_{cx}_{cy}_p{page}.json')
            get(SSR + '/punkt', {'nord': cy, 'ost': cx, 'koordsys': 25833, 'utkoordsys': 25833,
                                 'radius': SSR_RADIUS, 'treffPerSide': 500, 'side': page}, tmp)
            d = json.load(open(tmp, encoding='utf-8'))
            for rec in d.get('navn', []):
                found[rec['stedsnummer']] = rec
            m = d['metadata']
            if m['viserTil'] >= m['totaltAntallTreff']:
                break
            page += 1
        print(f'    disc {k}/{len(centres)} at ({cx}, {cy}) — {len(found)} names so far')
    names = [found[k] for k in sorted(found)]
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'source': 'ws.geonorge.no/stedsnavn/v1/punkt',
                   'retrieved': geom.RETRIEVED,
                   'discs': [[int(a), int(b)] for a, b in centres],
                   'radiusM': SSR_RADIUS, 'count': len(names), 'navn': names},
                  f, ensure_ascii=False, indent=1, sort_keys=False)
    print(f'    ssr_core.json  {len(names)} unique place names')
    return out


def check_n50():
    missing = [z for z in N50_ZIPS if not os.path.exists(os.path.join(N50, z))]
    if missing:
        raise SystemExit(
            'N50 Kartdata is missing from the cache: ' + ', '.join(missing) + '\n'
            'Order it from the Geonorge download API — the exact POST body is in '
            'cache/SOURCES.md section 3 — and put the two zips in ' + N50)
    for z in N50_ZIPS:
        print(f'    {z}  {os.path.getsize(os.path.join(N50, z)):,} B  (cached, not re-fetched)')


def main():
    print('Turrutebasen (Tur- og friluftsruter), Kartverket — the marked foot routes')
    fetch_trails()
    print('SSR (Sentralt stedsnavnregister), Kartverket — place names over the core box')
    fetch_places()
    print('N50 Kartdata, Kartverket — lakes, rivers and glaciers')
    check_n50()
    print('  done')


if __name__ == '__main__':
    main()
