#!/usr/bin/env python3
"""Source probe for the US Quakes pipeline, in Shelf Atlas's shape.

    .venv/bin/python probe.py [probe-urls.txt]   # print what every URL returns now
    .venv/bin/python probe.py --fetch            # also fill cache/ through fetch_pinned() and
                                                 # check every static pin (faults, Natural Earth,
                                                 # relief); needs `requests`

For each URL: HTTP status, content type, bytes, sha256 (first 16 hex), and a peek suited to the
type: JSON keys, a feed's metadata and first feature's properties, a count, CSV header and first
row, ZIP members, an image's size. It keeps nothing on disk. It exists because a development sandbox
may not reach a data host that a GitHub runner can (Shelf Atlas's lesson), so the same file runs in
probe-us-quakes.yml. Standard library only for the probe itself.
"""
import hashlib
import io
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request
import zipfile

UA = 'us-quakes-probe/1.0 (+https://github.com/mtomasgaard/snuggery-apps-template)'
HERE = os.path.dirname(os.path.abspath(__file__))


def fetch(url, timeout=180):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get('content-type', ''), r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('content-type', ''), e.read(4000), dict(e.headers)
    except Exception as e:  # noqa: BLE001 - a probe reports every failure and carries on
        return 0, repr(e), b'', {}


def peek(ctype, body):
    out = []
    if body[:8] == b'\x89PNG\r\n\x1a\n':
        w, h = struct.unpack('>II', body[16:24])
        out.append(f'    png {w}x{h}, bit depth {body[24]}, colour type {body[25]}')
        return out
    if body[:4] in (b'II*\x00', b'MM\x00*'):
        out.append('    tiff')
        return out
    if body[:2] == b'PK':
        z = zipfile.ZipFile(io.BytesIO(body))
        infos = z.infolist()
        out.append(f'    zip: {len(infos)} members, {sum(i.file_size for i in infos):,} B unpacked')
        for i in infos:
            if i.filename.lower().endswith(('.shp', '.dbf', '.gdbtable')) and i.file_size > 1_000_000:
                out.append(f'    zip: {i.filename} {i.file_size:,} {i.date_time[:3]}')
        return out
    txt = body.decode('utf-8-sig', 'replace')
    if txt.lstrip()[:1] in '{[':
        try:
            j = json.loads(txt)
        except ValueError as e:
            return [f'    json error {e}']
        if isinstance(j, dict):
            out.append('    json keys: ' + ', '.join(list(j)[:30]))
            if 'metadata' in j:
                out.append('    metadata: ' + json.dumps(j['metadata']))
            if j.get('features'):
                f = j['features'][0]
                out.append(f'    features: {len(j["features"])}; first properties: '
                           + ', '.join(f.get('properties', {}).keys()))
            for k in ('count', 'maxAllowed', 'error', 'currentVersion', 'copyrightText', 'maxImageWidth'):
                if k in j:
                    out.append(f'    {k}: {str(j[k])[:200]}')
        else:
            out.append(f'    json list of {len(j)}; first keys: ' + ', '.join(j[0].keys() if j and isinstance(j[0], dict) else []))
        return out
    lines = txt.splitlines()
    for ln in lines[:3]:
        out.append('    txt: ' + ln[:300])
    out.append(f'    lines: {len(lines)}')
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    path = args[0] if args else os.path.join(HERE, 'probe-urls.txt')
    urls = [ln.strip() for ln in open(path) if ln.strip() and not ln.lstrip().startswith('#')]
    for u in urls:
        status, ctype, body, headers = fetch(u)
        lm = headers.get('Last-Modified') or headers.get('last-modified') or ''
        print(f'\n=== {u}\n    -> {status} {ctype} {len(body):,} B sha256 {hashlib.sha256(body).hexdigest()[:16]}'
              + (f' last-modified {lm}' if lm else ''))
        if status:
            for ln in peek(ctype, body):
                print(ln)
        sys.stdout.flush()
        time.sleep(1)
    if '--fetch' in sys.argv:
        sys.path.insert(0, HERE)
        from common import fetch_pinned
        from sources import RELIEF, RELIEF_DEM_PINS, RELIEF_PINS, STATIC, TDEP_EXPORT, tdep_dem_params, tdep_params
        print()
        for k, s in STATIC.items():
            fetch_pinned(s['url'], s['name'], s['sha256'], s['bytes'])
            print(f'{k:16s} ok  {s["bytes"]:>11,} B')
        for k, (bbox, size) in RELIEF.items():
            fetch_pinned(TDEP_EXPORT, f'relief/{k}.png', *RELIEF_PINS[k], params=tdep_params(bbox, size))
            fetch_pinned(TDEP_EXPORT, f'relief/{k}.tif', *RELIEF_DEM_PINS[k], params=tdep_dem_params(bbox, size))
            print(f'relief {k:9s} ok  {RELIEF_PINS[k][1]:>11,} B + {RELIEF_DEM_PINS[k][1]:>11,} B')


if __name__ == '__main__':
    main()
