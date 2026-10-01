#!/usr/bin/env python3
"""Source probe for the Warming World pipeline, in Shelf Atlas's shape.

    .venv/bin/python probe.py [probe-urls.txt]   # print what every URL returns now
    .venv/bin/python probe.py --fetch            # also fill cache/ through fetch_pinned() and check
                                                 # every static pin (Natural Earth, the research
                                                 # copies of the GISTEMP grid and table); needs requests

For each URL: HTTP status, content type, bytes, sha256 (first 16 hex), Last-Modified, and a peek
suited to the type: a gzipped NetCDF's header (format, dimensions, the anomaly variable's type,
scale and fill, the first and last month), GISTEMP's table (the first and last year and how many
months the last one has), JSON keys, a page's title. It keeps nothing on disk. It exists because a
development machine may not reach a data host a GitHub runner can (data.giss.nasa.gov refused every
connection from here from about 00:00 UTC on 2026-10-01), so the same file runs in
probe-warming-world.yml. Standard library only.
"""
import datetime
import gzip
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

UA = 'warming-world-probe/1.0 (+https://github.com/mtomasgaard/snuggery-apps-template)'
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def fetch(url, timeout=300):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get('content-type', ''), r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('content-type', ''), e.read(4000), dict(e.headers)
    except Exception as e:  # noqa: BLE001 - a probe reports every failure and carries on
        return 0, repr(e), b'', {}


def peek_netcdf(buf):
    from netcdf3 import NetCDF3
    nc = NetCDF3(buf)
    out = [f'    netcdf {buf[:4]!r}, dims {nc.dims}, unlimited {nc.unlimited}']
    h = nc.attrs.get('history', '')
    out.append(f'    history: {h}')
    for n, v in nc.vars.items():
        if len(v.shape) == 3:
            out.append(f'    {n}{v.dims} type {v.typecode} scale {v.attrs.get("scale_factor")} '
                       f'fill {v.attrs.get("_FillValue")} units {v.attrs.get("units")}')
    if 'time' in nc.vars:
        t = nc.read('time')
        base = datetime.date(1800, 1, 1)
        out.append(f'    time: {len(t)} months, {base + datetime.timedelta(days=t[0])} .. '
                   f'{base + datetime.timedelta(days=t[-1])}')
    return out


def peek(ctype, body):
    if body[:2] == b'\x1f\x8b':
        try:
            buf = gzip.decompress(body)
        except (OSError, EOFError) as e:
            return [f'    gzip error {e}']
        if buf[:3] == b'CDF':
            return peek_netcdf(buf)
        return [f'    gzip of {len(buf):,} B, starts {buf[:8]!r}']
    txt = body.decode('utf-8-sig', 'replace')
    if txt.startswith('Land-Ocean'):
        rows = [ln.split(',') for ln in txt.splitlines()[2:] if ln[:1].isdigit()]
        last = rows[-1]
        n = sum(v != '***' for v in last[1:13])
        return [f'    table: {rows[0][0]} .. {last[0]}, {n} months in {last[0]}; '
                f'J-D {rows[-2][0]} = {rows[-2][13]}']
    if txt.lstrip()[:1] in '{[':
        try:
            j = json.loads(txt)
        except ValueError as e:
            return [f'    json error {e}']
        if isinstance(j, dict):
            return ['    json keys: ' + ', '.join(list(j)[:20]),
                    f'    license: {j.get("license")}' if 'license' in j else
                    f'    features: {len(j.get("features", []))}']
        return [f'    json list of {len(j)}']
    m = re.search(r'<title>(.*?)</title>', txt, re.S | re.I)
    if m:
        return ['    title: ' + ' '.join(m.group(1).split())[:160]]
    return ['    txt: ' + ln[:200] for ln in txt.splitlines()[:3]]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    path = args[0] if args else os.path.join(HERE, 'probe-urls.txt')
    urls = [ln.strip() for ln in open(path) if ln.strip() and not ln.lstrip().startswith('#')]
    for u in urls:
        status, ctype, body, headers = fetch(u)
        lm = headers.get('Last-Modified') or headers.get('last-modified') or ''
        print(f'\n=== {u}\n    -> {status} {ctype} {len(body):,} B sha256 {hashlib.sha256(body).hexdigest()[:16]}'
              + (f' last-modified {lm}' if lm else ''))
        if body:                                    # status is None for a file:// test URL
            for ln in peek(ctype, body):
                print(ln)
        sys.stdout.flush()
        time.sleep(1)
    if '--fetch' in sys.argv:
        from common import fetch_pinned
        from sources import GISTEMP_RESEARCH, STATIC
        print()
        for k, s in STATIC.items():
            fetch_pinned(s['url'], s['name'], s['sha256'], s['bytes'])
            print(f'{k:16s} ok  {s["bytes"]:>11,} B')
        for k in ('grid', 'table'):
            s = GISTEMP_RESEARCH[k]
            fetch_pinned(s['url'], s['name'], s['sha256'], s['bytes'])
            print(f'research {k:7s} ok  {s["bytes"]:>11,} B')


if __name__ == '__main__':
    main()
