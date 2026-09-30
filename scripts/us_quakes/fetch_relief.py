"""Fetch the 3DEP relief for each map region (sources.RELIEF): the multidirectional hillshade PNG and,
at the same box and size, the Int16 elevation TIFF that masks it to land. One exportImage per region,
Alaska in two either side of 180°. Both files are pinned by sha256 (sources.RELIEF_PINS,
RELIEF_DEM_PINS); without a pin it downloads, prints the pin to paste, and stops.

It also asks each hillshade export once more with f=json, because exportImage widens the requested
box to the requested pixel aspect: the extent the server reports (EPSG:3857 metres) is what the
image actually covers, and relief-extents.json (committed) records it, so the relief's bounds in
geo.json are measured, not assumed (tools/CONTRACT.md §5.2).

    .venv/bin/python fetch_relief.py              # fetch what is missing, check every pin, write the extents
    .venv/bin/python fetch_relief.py --offline    # check the cache and the committed extents only

Relief is a deliberate act (the shipped JPEGs are committed, and the yearly build never refetches
it), so build_all.sh runs this only with --relief.
"""
import argparse
import json
import os
import sys

from common import (BuildError, RETRIEVED, fetch_pinned, http_get, log, sha256_of,
                    write_credits_fragment)
from paths import CACHE, HERE
from sources import (RELIEF, RELIEF_DEM_PINS, RELIEF_PINS, TDEP_EXPORT, tdep_dem_params,
                     tdep_params)

EXTENTS = os.path.join(HERE, 'relief-extents.json')


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--offline', action='store_true')
    a = ap.parse_args(argv)
    missing = []
    for kind, pins, params_of, ext in (('shade', RELIEF_PINS, tdep_params, 'png'),
                                       ('dem', RELIEF_DEM_PINS, tdep_dem_params, 'tif')):
        for key, (bbox, size) in RELIEF.items():
            name = f'relief/{key}.{ext}'
            params = params_of(bbox, size)
            dest = os.path.join(CACHE, name)
            if a.offline and not os.path.exists(dest):
                raise BuildError(f'offline and {name} is not cached')
            if key in pins:
                sha, n = pins[key]
                p = fetch_pinned(TDEP_EXPORT, name, sha, n, params=params)
                print(f'{kind:5s} {key:8s} ok  {n:>10,} B  {os.path.relpath(p, HERE)}')
                continue
            if not os.path.exists(dest):
                http_get(TDEP_EXPORT, params=params, stream_to=dest)
            missing.append(f"{kind}: '{key}': ('{sha256_of(dest)}', {os.path.getsize(dest)}),")
    if missing:
        print('unpinned; add to sources.RELIEF_PINS / RELIEF_DEM_PINS:\n' + '\n'.join(missing))
        sys.exit(1)

    old = {}
    if os.path.exists(EXTENTS):
        with open(EXTENTS, encoding='utf-8') as f:
            old = json.load(f)
    out = {'service': TDEP_EXPORT, 'note': 'extent of each hillshade export as the server reports it '
           '(exportImage with f=json and the same parameters); EPSG:3857 metres', 'regions': {}}
    for key, (bbox, size) in RELIEF.items():
        prev = old.get('regions', {}).get(key)
        if prev and prev['requested'] == list(bbox) and prev['size'] == list(size):
            out['regions'][key] = prev
            continue
        if a.offline:
            raise BuildError(f'offline and relief-extents.json has no entry for {key}')
        params = dict(tdep_params(bbox, size), f='json')
        j = json.loads(http_get(TDEP_EXPORT, params=params))
        e = j['extent']
        if [j['width'], j['height']] != list(size) or e['spatialReference'].get('latestWkid') != 3857:
            raise BuildError(f'{key}: the export answered {j["width"]}x{j["height"]} in '
                             f'{e["spatialReference"]}; asked for {size} in EPSG:3857')
        out['regions'][key] = {'requested': list(bbox), 'size': list(size),
                               'extent': [e['xmin'], e['ymin'], e['xmax'], e['ymax']]}
    with open(EXTENTS + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
        f.write('\n')
    os.replace(EXTENTS + '.tmp', EXTENTS)
    for key, r in out['regions'].items():
        x0, y0, x1, y1 = r['extent']
        print(f'extent {key:8s} x {x0:.2f} .. {x1:.2f}  y {y0:.2f} .. {y1:.2f}  '
              f'px {(x1 - x0) / r["size"][0]:.4f} x {(y1 - y0) / r["size"][1]:.4f} m')
    write_credits_fragment('fetch_relief', [{
        'id': 'relief',
        'source': [f'exportImage from {TDEP_EXPORT}, rendering rule "Hillshade Multidirectional", '
                   'PNG U8, Web Mercator (imageSR 3857), five exports (conus, ak-west, ak-east, hi, pr), '
                   'each pinned by sha256 in scripts/us_quakes/sources.py (RELIEF_PINS)',
                   'the same boxes as elevation (Int16 LZW TIFF, NoData -32768), for the land mask '
                   '(RELIEF_DEM_PINS); the reported extents in scripts/us_quakes/relief-extents.json'],
        'retrieved': RETRIEVED,
        'adaptations': [],
    }])


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        sys.exit(1)
