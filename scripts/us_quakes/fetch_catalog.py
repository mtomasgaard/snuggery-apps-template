"""Download the ANSS Comprehensive Earthquake Catalog (ComCat) for the app's four map boxes as CSV,
from USGS's FDSN event service, and cache every window for good.

    .venv/bin/python fetch_catalog.py                        # the cutoff in sources.COMCAT (2026-01-01)
    .venv/bin/python fetch_catalog.py --cutoff 2027-01-01    # the January rebuild: only the new year is fetched
    .venv/bin/python fetch_catalog.py --offline              # use the cache and the manifest; never touch the network
    .venv/bin/python fetch_catalog.py --count-all            # also count every event since 1600 with no
                                                             # magnitude floor, per region, summed by decade

Rules (docs/plans/0010, Idea 4; tools/RESEARCH.md §1):
- Two eras per region. Before 1900 every event is kept, whatever its magnitude (some have none);
  from 1900 to the history cutoff, M2.5 and up. Every event type is downloaded (quarry blasts,
  explosions, ice quakes included); build_history.py decides what to draw, so the cache never has
  to be refetched to change that.
- The service refuses a query matching more than 20,000 events, so each era is split on a fixed
  calendar ladder — the whole era, then decades, then years, then months, then days — and a window
  is downloaded only when its count, asked first, is under the limit. The ladder, not a bisection,
  keeps the window edges stable between runs.
- Alaska's box runs 172..231 in longitude, across the date line in one query (the service accepts
  longitudes to ±360), so the Aleutians are never split.
- One request a second, always (count and download alike).
- Every window ends on or before the history cutoff, which must not be in the future, so every
  window is closed: once cached it is never refetched. When the cutoff moves (the January rebuild),
  the span from the old cutoff to the new one is planned on its own, so the cached windows stay
  exactly as they are. catalog-windows.json (committed) records each window's query, count, rows,
  bytes, sha256 and the date it was downloaded; a later run reuses any span the manifest already
  covers without asking the service anything, so a rerun makes no request at all and a new cutoff
  costs only the new year. Revisions USGS makes later to an old event are therefore not picked up
  until the cache and the manifest entry are deleted (RESEARCH.md §4 says so).
- Each downloaded CSV must hold exactly the number of rows the count endpoint reported a second
  earlier, and the columns sources.COMCAT lists, or the run stops.
- A window in the manifest whose file is missing from the cache (a fresh runner without the
  actions/cache entry) is fetched again: counted, downloaded, and its manifest entry replaced; the
  run prints whether the bytes matched the old pin. A cached file whose sha256 differs from its pin
  stops the run (a corrupt cache).

Writes catalog-windows.json (committed) and the credits fragment cache/work/credits/fetch_catalog.json.
"""
import argparse
import csv
import datetime as dt
import io
import json
import os
import sys
import time

from common import group, BuildError, Cache, RETRIEVED, http_get, log, sha256_of, write_credits_fragment
from paths import HERE
from sources import COMCAT

LIMIT = COMCAT['limit']
BASE = COMCAT['base']
MANIFEST = os.path.join(HERE, 'catalog-windows.json')
_last = [0.0]
_net = {'offline': False, 'requests': 0}


def _pace():
    """One request a second, measured from the previous request's start."""
    if _net['offline']:
        raise BuildError('offline, and this step needs the network (a window the manifest does not cover)')
    wait = 1.0 - (time.monotonic() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.monotonic()
    _net['requests'] += 1


def eras(cutoff):
    first, second = COMCAT['eras']
    return [(first[0], first[1], first[2]), (second[0], cutoff, second[2])]


def _params(region, start, end, minmag):
    p = dict(COMCAT['regions'][region]['box'])
    p.update(starttime=start, endtime=end)
    if minmag is not None:
        p['minmagnitude'] = minmag
    return p


def count(region, start, end, minmag):
    _pace()
    body = http_get(BASE + '/count', params=dict(_params(region, start, end, minmag), format='geojson'))
    return json.loads(body)['count']


def _ladder(start: str, end: str, level: int):
    """Children of [start, end) one rung down: decades, years, months, days (UTC, ISO dates)."""
    s = dt.datetime.fromisoformat(start).replace(tzinfo=dt.timezone.utc)
    e = dt.datetime.fromisoformat(end).replace(tzinfo=dt.timezone.utc)
    out = []
    cur = s
    while cur < e:
        if level == 0:
            nxt = dt.datetime((cur.year // 10 + 1) * 10, 1, 1, tzinfo=dt.timezone.utc)
        elif level == 1:
            nxt = dt.datetime(cur.year + 1, 1, 1, tzinfo=dt.timezone.utc)
        elif level == 2:
            nxt = dt.datetime(cur.year + (cur.month == 12), cur.month % 12 + 1, 1, tzinfo=dt.timezone.utc)
        else:
            nxt = dt.datetime.fromordinal(cur.toordinal() + 1).replace(tzinfo=dt.timezone.utc)
        nxt = min(nxt, e)
        out.append((cur.strftime('%Y-%m-%d'), nxt.strftime('%Y-%m-%d')))
        cur = nxt
    return out


def _known_cover(known, start, end):
    """The manifest's windows that tile [start, end) exactly, in order, or None."""
    inside = sorted((w for w in known if w['start'] >= start and w['end'] <= end), key=lambda w: w['start'])
    cur, out = start, []
    for w in inside:
        if w['start'] != cur:
            return None
        out.append(w)
        cur = w['end']
    return out if cur == end and out else None


def plan(region, start, end, minmag, known, level=-1):
    """Yield ('known', window) for spans the manifest covers, ('new', (start, end, count)) for the
    rest, split on the ladder until every new window is under the limit."""
    cover = _known_cover(known, start, end)
    if cover is not None:
        for w in cover:
            yield 'known', w
        return
    n = count(region, start, end, minmag)
    if n < LIMIT:
        yield 'new', (start, end, n)
        return
    if level >= 3:
        raise BuildError(f'{region} {start}..{end}: {n} events in one day; cannot split further')
    for a, b in _ladder(start, end, level + 1):
        yield from plan(region, a, b, minmag, known, level + 1)


def _key(region, start, end, minmag):
    return f'comcat/{region}/{start}_{end}_m{minmag if minmag is not None else "all"}.csv'


def download(cache, region, start, end, minmag, expect):
    """Fetch one window, check its columns and row count against the count asked a second earlier."""
    key = _key(region, start, end, minmag)
    _pace()
    params = dict(_params(region, start, end, minmag), format='csv', orderby='time-asc')
    body = http_get(BASE + '/query', params=params)
    rows = list(csv.reader(io.StringIO(body.decode('utf-8'))))
    if not rows or rows[0] != COMCAT['csv_columns']:
        raise BuildError(f'{key}: columns changed: {rows[0] if rows else "(empty)"}')
    if len(rows) - 1 != expect:
        raise BuildError(f'{key}: {len(rows) - 1} rows, the count endpoint said {expect}')
    p = cache.path(key)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p + '.part', 'wb') as f:
        f.write(body)
    os.replace(p + '.part', p)
    return {'start': start, 'end': end, 'minmagnitude': minmag, 'count': expect, 'rows': len(rows) - 1,
            'bytes': len(body), 'sha256': sha256_of(p), 'cache': key,
            'retrieved': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d')}


def check_cached(cache, w):
    p = cache.path(w['cache'])
    got = sha256_of(p)
    if got != w['sha256']:
        raise BuildError(f'{w["cache"]}: sha256 {got} does not match the manifest pin {w["sha256"]}; the '
                         'cache is corrupt. Delete the file (it will be refetched and re-pinned).')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--cutoff', default=COMCAT['cutoff'], help='history cutoff, YYYY-01-01 (exclusive)')
    ap.add_argument('--offline', action='store_true', help='never use the network')
    ap.add_argument('--count-all', action='store_true', help='count every event since 1600 per region')
    a = ap.parse_args(argv)
    if not a.cutoff.endswith('-01-01'):
        raise BuildError(f'--cutoff must be the first day of a year, got {a.cutoff}')
    today = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d')
    if a.cutoff > today:
        raise BuildError(f'--cutoff {a.cutoff} is in the future: a window ending there would not be closed')
    _net['offline'] = a.offline
    cache = Cache()
    old = {}
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding='utf-8') as f:
            old = json.load(f)
    version = old.get('apiVersion', COMCAT['api_version'])
    version_checked = False
    manifest = {'service': BASE, 'apiVersion': version, 'cutoff': a.cutoff, 'limit': LIMIT,
                'columns': COMCAT['csv_columns'], 'regions': {}}
    new_windows = refetched = 0
    for region, spec in COMCAT['regions'].items():
        prev = old.get('regions', {}).get(region, {})
        out = []
        spans = []
        for era_start, era_end, minmag in eras(a.cutoff):
            # A moved cutoff adds a span of its own, so the windows already cached stay exactly as
            # they are and only the new year is counted and fetched.
            old_cut = old.get('cutoff')
            if old_cut and era_start < old_cut < era_end:
                spans += [(era_start, old_cut, minmag), (old_cut, era_end, minmag)]
            else:
                spans.append((era_start, era_end, minmag))
        for span_start, span_end, minmag in spans:
            known = [dict(w, retrieved=w.get('retrieved', RETRIEVED)) for w in prev.get('windows', [])
                     if w['minmagnitude'] == minmag and w['start'] >= span_start and w['end'] <= span_end]
            for kind, item in plan(region, span_start, span_end, minmag, known):
                if not version_checked and kind == 'new':
                    version = _version()
                    version_checked = True
                if kind == 'known':
                    w = item
                    if cache.has(w['cache']):
                        check_cached(cache, w)
                    else:
                        if not version_checked:
                            version = _version()
                            version_checked = True
                        n = count(region, w['start'], w['end'], minmag)
                        nw = download(cache, region, w['start'], w['end'], minmag, n)
                        log(f'  {region:5s} {w["start"]}..{w["end"]} refetched (not in the cache): '
                            f'{"same bytes as the pin" if nw["sha256"] == w["sha256"] else "CHANGED since pinned"}')
                        w = nw
                        refetched += 1
                    out.append(w)
                else:
                    s, e, n = item
                    w = download(cache, region, s, e, minmag, n)
                    new_windows += 1
                    log(f'  {region:5s} {s}..{e} m{minmag}  {n:>6,} events  {w["bytes"]:>10,} B  (new)')
                    out.append(w)
        total = sum(w['rows'] for w in out)
        entry = {'box': spec['box'], 'windows': out, 'events': total, 'bytes': sum(w['bytes'] for w in out)}
        for k in ('allEventsSince1600', 'allEventsByDecade'):
            if k in prev and old.get('cutoff') == a.cutoff:
                entry[k] = prev[k]
        manifest['regions'][region] = entry
        log(f'{region}: {len(out)} windows, {total:,} events')
    manifest['apiVersion'] = version
    if a.count_all:
        for region in COMCAT['regions']:
            total, parts = 0, []
            for s, e in _ladder('1600-01-01', a.cutoff, 0):
                try:
                    n = count(region, s, e, None)
                except BuildError:
                    n = sum(count(region, c, d, None) for c, d in _ladder(s, e, 1))
                total += n
                parts.append([s, e, n])
            manifest['regions'][region]['allEventsSince1600'] = total
            manifest['regions'][region]['allEventsByDecade'] = parts
            log(f'{region}: every event 1600..{a.cutoff}, no magnitude floor: {total:,}')
    text = json.dumps(manifest, indent=1) + '\n'
    with open(MANIFEST + '.tmp', 'w', encoding='utf-8') as f:
        f.write(text)
    os.replace(MANIFEST + '.tmp', MANIFEST)
    wins = [w for r in manifest['regions'].values() for w in r['windows']]
    dates = sorted({w['retrieved'] for w in wins})
    write_credits_fragment('fetch_catalog', [{
        'id': 'comcat',
        'source': [f'FDSN event web service {BASE}/query, API version {version}, CSV, '
                   f'{len(wins)} closed windows ({group(sum(w["rows"] for w in wins))} rows of every event type, '
                   f'{group(sum(w["bytes"] for w in wins))} B), each pinned by sha256 in '
                   'scripts/us_quakes/catalog-windows.json'],
        'retrieved': dates[0] if len(dates) == 1 else f'{dates[0]} to {dates[-1]}',
        'adaptations': [],
    }])
    print(json.dumps({r: [m['events'], len(m['windows']), m['bytes'], m.get('allEventsSince1600')]
                      for r, m in manifest['regions'].items()}))
    log(f'requests made: {_net["requests"]}; new windows {new_windows}; refetched {refetched}')


def _version():
    _pace()
    v = http_get(BASE + '/version').decode().strip()
    if v != COMCAT['api_version']:
        log(f'  NOTE: FDSN event service version is {v}; sources.COMCAT recorded {COMCAT["api_version"]}')
    return v


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        sys.exit(1)
