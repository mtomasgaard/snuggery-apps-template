#!/usr/bin/env python3
"""Check us-quakes/data/snapshot.json against tools/CONTRACT.md §3 and §11.3, independently of
refresh.py: its own decoder, its own box test, its own reading of the sources.

    .venv/bin/python verify_snapshot.py                       # the committed snapshot, sources from cache/live/
    .venv/bin/python verify_snapshot.py out/snapshot.json     # another file (the workflow's, before publishing)
    .venv/bin/python verify_snapshot.py --no-sources          # structure only (no cached feed or FDSN answers)

With the sources (cache/live/all_month.geojson, live-marker.json and the fdsn-*.csv it names, which
refresh.py leaves there) it also proves that the live rows are exactly the feed's in-box earthquakes
from liveFrom, that the rows before them are exactly the FDSN answers' M2.5+ earthquakes before
liveFrom less those the feed replaced, and that every decoded value is within CONTRACT §1's bounds
of its source. Prints one line per check; exits 1 on the first failed group, 0 when all pass.
Standard library only (sources.py and paths.py for the constants).
"""
from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys
import unicodedata
import zlib
from array import array
from decimal import ROUND_HALF_UP, Decimal

from paths import APP, ASSETS, CACHE
from sources import COMCAT, FEEDS, VOLCANOES, same_major

BUDGET = 1_500_000
ASK_MAX = 200
LIVE = os.path.join(CACHE, 'live')
TOP_KEYS = ['schema', 'app', 'generatedAt', 'cutoff', 'feed', 'fdsn', 'rows', 'volcanoes', 'sources', 'ask']
WIDTH = {'uint8': 1, 'uint16': 2, 'uint32': 4}
ISO_S = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
VENDORS = re.compile(r'\b(Claude|Anthropic|OpenAI|ChatGPT|GPT-\d|Gemini|Copilot|Llama|Mistral)\b')
EPOCH = dt.datetime(1600, 1, 1, tzinfo=dt.timezone.utc)
Q = Decimal


class Fail(Exception):
    pass


def ok(msg):
    print(f'ok    {msg}', flush=True)


def check(cond, msg):
    if not cond:
        raise Fail(msg)


def minutes(moment: dt.datetime) -> int:
    return int((moment - EPOCH).total_seconds() // 60)


def parse_iso(text: str) -> dt.datetime:
    return dt.datetime.fromisoformat(text.replace('Z', '+00:00'))


def ms_since_epoch_of_unix(ms: int) -> int:
    return ms + int((dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc) - EPOCH).total_seconds()) * 1000


def csv_ms(text: str) -> int:
    """'2025-01-01T03:04:05.678Z' -> ms since 1600, integer arithmetic on the fields."""
    d = dt.date(int(text[0:4]), int(text[5:7]), int(text[8:10]))
    days = (d - dt.date(1600, 1, 1)).days
    h, mi, s = int(text[11:13]), int(text[14:16]), int(text[17:19])
    frac = text[20:-1] if text[19] == '.' else ''
    return ((days * 86400 + h * 3600 + mi * 60 + s) * 1000) + (int((frac + '000')[:3]) if frac else 0)


def rnd(v: Decimal) -> int:
    return int(v.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def dcode(depth: Decimal) -> int:
    """CONTRACT §1's depth code, written here again: (depth + 5) x 100 half up, 1500 kept for an exact
    10 (a depth that only rounds to it is 1499 below 10 and 1501 above)."""
    c = rnd((depth + 5) * 100)
    return (1499 if depth < 10 else 1501) if c == 1500 and depth != 10 else c


def section(sec, n=None, name=''):
    check(isinstance(sec, dict) and set(sec) == {'type', 'bytes', 'data'}, f'{name}: not {{type, bytes, data}}')
    raw = zlib.decompress(base64.b64decode(sec['data'], validate=True))
    check(len(raw) == sec['bytes'], f'{name}: inflates to {len(raw)} B, declares {sec["bytes"]}')
    if sec['type'] == 'utf8':
        return raw
    check(sec['type'] in WIDTH, f'{name}: type {sec["type"]}')
    a = array({'uint8': 'B', 'uint16': 'H', 'uint32': 'I'}[sec['type']])
    a.frombytes(raw)
    if sys.byteorder == 'big':
        a.byteswap()
    if n is not None:
        check(len(a) == n, f'{name}: {len(a)} values, expected {n}')
    return a


def in_box(boxes: dict, lon: Decimal, lat: Decimal):
    """The first box (history.json's, on the axis, inclusive) that holds the point."""
    ax = lon + 360 if lon < 172 else lon
    for k, b in boxes.items():
        if Q(str(b['south'])) <= lat <= Q(str(b['north'])) and Q(str(b['west'])) <= ax <= Q(str(b['east'])):
            return k
    return None


def within(i, cols, lon: Decimal, lat: Decimal, depth: Decimal | None, mag: Decimal | None, ms: int):
    """Is decoded row i within CONTRACT §1's bounds of these source values?"""
    t, x, y, d, m = (cols[k][i] for k in 'txydm')
    ax = lon + 360 if lon < 172 else lon
    if t != ms // 60000:
        return 'time'
    if abs(Q(172) + Q('0.002') * x - ax) > Q('0.001') or abs(Q(17) + Q('0.001') * y - lat) > Q('0.0005'):
        return 'position'
    if depth is None:
        if d != 65535:
            return 'depth (none)'
    elif d == 65535:
        if Q(-5) <= depth <= Q('650.34'):
            return 'depth written as none'
    elif d != dcode(depth) or abs(Q(d) / 100 - 5 - depth) >= Q('0.01'):
        return 'depth'
    if mag is None:
        if m != 255:
            return 'magnitude (none)'
    elif m != 255 and m != rnd(mag * 10) + 20:
        return 'magnitude'
    elif m == 255 and 0 <= rnd(mag * 10) + 20 <= 254:
        return 'magnitude written as none'
    return None


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('snapshot', nargs='?', default=os.path.join(APP, 'data', 'snapshot.json'))
    ap.add_argument('--no-sources', action='store_true', help='structure only')
    a = ap.parse_args(argv)
    try:
        run(a)
    except Fail as e:
        print(f'FAIL  {e}', flush=True)
        print('verify_snapshot: FAILED')
        return 1
    print('verify_snapshot: all checks passed')
    return 0


def run(a):
    blob = open(a.snapshot, 'rb').read()
    check(len(blob) <= BUDGET, f'{len(blob):,} B exceeds {BUDGET:,} B')
    ok(f'size {len(blob):,} B ≤ {BUDGET:,} B')
    text = blob.decode('utf-8')
    check(unicodedata.normalize('NFC', text) == text, 'not NFC')
    check(not VENDORS.search(text), f'names an AI vendor or product: {VENDORS.search(text)}')
    s = json.loads(text)
    check(list(s) == TOP_KEYS, f'top-level keys {list(s)}')
    check(s['schema'] == 1 and s['app'] == 'US Quakes', 'schema/app')
    check(ISO_S.match(s['generatedAt']) is not None, 'generatedAt is not ISO UTC to the second')
    hist = json.load(open(os.path.join(ASSETS, 'history.json'), encoding='utf-8'))
    check(s['cutoff'] == hist['cutoff'], f'cutoff {s["cutoff"]} vs history.json {hist["cutoff"]}')
    ok(f'schema 1, app "US Quakes", keys in order, NFC, no vendor name; cutoff {s["cutoff"]} = history.json')

    # ---- feed / fdsn blocks
    feed, fdsn = s['feed'], s['fdsn']
    check(same_major(feed['api'], FEEDS['api_version']), f'feed api {feed["api"]} (the same major version as the contract\'s {FEEDS["api_version"]})')
    check(same_major(fdsn['api'], COMCAT['api_version']), f'FDSN api {fdsn["api"]} (the same major version as the contract\'s {COMCAT["api_version"]})')
    check(all(q['rows'] == q['count'] for q in fdsn['queries']), 'an FDSN query rows != count')
    gen = parse_iso(feed['generated'])
    newest = parse_iso(feed['newest'])
    age_h = (gen - newest).total_seconds() / 3600
    check(0 <= age_h < 6, f'newest in-box earthquake {age_h:.2f} h before the feed (must be < 6)')
    ok(f'feed api {feed["api"]}, FDSN api {fdsn["api"]}, {len(fdsn["queries"])} queries rows == count; '
       f'newest earthquake {feed["newest"]} is {age_h * 60:.0f} min before the feed ({feed["generated"]})')

    # ---- rows
    R = s['rows']
    n, lf = R['count'], R['liveFirst']
    check(list(R) == ['count', 'epoch', 'from', 'liveFrom', 'to', 'liveFirst', 'compression', 'encoding',
                      'status', 'magTypes', 'columns', 'text', 'live', 'outOfRange'], f'rows keys {list(R)}')
    check(R['epoch'] == '1600-01-01T00:00:00Z' and R['compression'] == 'zlib' and R['encoding'] == 'base64',
          'epoch/compression/encoding')
    frm = minutes(dt.datetime(int(s['cutoff'][:4]) - 1, 1, 1, tzinfo=dt.timezone.utc))
    check(R['from'] == frm, f'from {R["from"]} is not 1 January of the year before the cutoff ({frm})')
    check(R['to'] == minutes(gen), f'to {R["to"]} is not the feed minute {minutes(gen)}')
    check(R['to'] - R['liveFrom'] == 30 * 1440, 'liveFrom is not to − 30 days')
    check(R['status'] == ['reviewed', 'automatic', 'manual', 'other'], 'status list')
    check(R['magTypes'] == sorted(set(R['magTypes'])) and len(R['magTypes']) <= 63, 'magTypes not sorted/unique')
    cols = {k: section(R['columns'][k], n, k) for k in 'txydmf'}
    check(set(R['columns']) == set('txydmf'), 'columns')
    for k, typ in zip('txydmf', ['uint32', 'uint16', 'uint16', 'uint16', 'uint8', 'uint8']):
        check(R['columns'][k]['type'] == typ, f'{k} type')
    t, x, y, d, m, f = (cols[k] for k in 'txydmf')
    check(all(p <= q for p, q in zip(t, t[1:])), 't not sorted')
    check(n == 0 or (R['from'] <= t[0] and t[-1] <= R['to']), 't outside [from, to]')
    check(all(v < R['liveFrom'] for v in t[:lf]) and all(v >= R['liveFrom'] for v in t[lf:]), 'liveFirst split')
    check(all(45 <= v <= 254 for v in m[:lf]), 'a row before liveFirst below M2.5 (code 45)')
    check(max(x) <= 62000 and max(y) <= 55000, 'position code out of range')
    check(all(v <= 65534 or v == 65535 for v in d), 'depth code')
    check(all((v >> 2) == 63 or (v >> 2) < len(R['magTypes']) for v in f), 'magType index')
    oor = R['outOfRange']
    check(set(oor) == {'depth', 'magnitude'}, 'outOfRange keys')
    tr = section(R['text']['text_row'], R['text']['rows'], 'text_row')
    want = [i for i in range(n) if i >= lf or 65 <= m[i] <= 254]
    check(list(tr) == want, 'text_row is not every live row plus M4.5+ before liveFrom')
    ids = section(R['text']['id_text'], name='id_text').decode('utf-8').split('\n')
    places = section(R['text']['place_text'], name='place_text').decode('utf-8').split('\n')
    check(len(ids) == len(tr) == len(places), 'text line counts')
    check(len(set(ids)) == len(ids), 'an id twice')
    id_row = {ids[j]: i for j, i in enumerate(tr)}
    lv = {k: section(R['live'][k], n - lf, 'live.' + k) for k in ['felt', 'alert', 'tsunami', 'sig', 'updated']}
    check(list(R['live']) == ['felt', 'alert', 'tsunami', 'sig', 'updated'], 'live keys')
    check(all(v <= 4 for v in lv['alert']) and all(v in (0, 1) for v in lv['tsunami']), 'alert/tsunami codes')
    ok(f'{n:,} rows: codes in range, t sorted in [from, to], liveFirst {lf:,} splits at liveFrom, M2.5+ '
       f'before it, text table {len(tr):,} rows as the rule says, ids unique, live extras {n - lf:,} each')

    # ---- sources: the feed and the FDSN answers
    boxes = hist['boxes']
    box_of_row = {}
    if a.no_sources:
        print('skip  source comparison (--no-sources)')
    else:
        mk = json.load(open(os.path.join(LIVE, 'live-marker.json'), encoding='utf-8'))
        check(mk['queriedAt'] == fdsn['queriedAt'], 'the cached FDSN answers are not the ones this snapshot used')
        fdoc = json.loads(open(os.path.join(LIVE, 'all_month.geojson'), 'rb').read(), parse_float=Decimal)
        md = fdoc['metadata']
        gen_ms = ms_since_epoch_of_unix(int(md['generated']))
        check(gen_ms // 1000 == int((gen - EPOCH).total_seconds()), 'cached feed is not the one this snapshot used')
        check(same_major(md['api'], FEEDS['api_version']), 'cached feed api')
        want_props = set(FEEDS['properties'])
        for ft in fdoc['features']:
            check(set(ft['properties']) == want_props, f'feed feature {ft["id"]}: properties differ')
            c = ft['geometry']['coordinates']
            check(ft['geometry']['type'] == 'Point' and len(c) == 3, f'feed feature {ft["id"]}: geometry')
        ok(f'feed file: api {md["api"]}, {len(fdoc["features"]):,} features, each with the '
           f'{len(want_props)} contract properties and a 3-number Point')
        live_src = []
        feed_ids = set()
        for ft in fdoc['features']:
            p = ft['properties']
            lon, lat, dep = (None if v is None else Decimal(str(v)) for v in ft['geometry']['coordinates'])
            b = in_box(boxes, lon, lat)
            if b is None or p['type'] != 'earthquake':
                continue
            ms = ms_since_epoch_of_unix(int(p['time']))
            if ms // 60000 < R['liveFrom']:
                continue
            live_src.append((ms, ft['id'], lon, lat, dep, None if p['mag'] is None else Decimal(str(p['mag'])), p, b))
            feed_ids |= {i for i in (p['ids'] or '').split(',') if i} | {ft['id']}
        live_src.sort(key=lambda r: (r[0], r[1]))
        check(len(live_src) == n - lf, f'{len(live_src)} in-box feed earthquakes from liveFrom, snapshot has {n - lf}')
        pager = {None: 0, 'green': 1, 'yellow': 2, 'orange': 3, 'red': 4}
        for j, (ms, fid, lon, lat, dep, mag, p, b) in enumerate(live_src):
            i = lf + j
            check(ids[i - lf + (len(tr) - (n - lf))] == fid, f'live row {i}: id {fid} not at its place')
            why = within(i, cols, lon, lat, dep, mag, ms)
            check(why is None, f'live row {i} ({fid}): {why}')
            check(R['status'][f[i] & 3] == (p['status'] if p['status'] in ('reviewed', 'automatic', 'manual') else 'other'),
                  f'{fid}: status')
            mt = f[i] >> 2
            check((mt == 63 and not p['magType']) or R['magTypes'][mt] == p['magType'], f'{fid}: magType')
            check(lv['felt'][j] == (65535 if p['felt'] is None else min(p['felt'], 65534)), f'{fid}: felt')
            check(lv['alert'][j] == pager[p['alert']], f'{fid}: alert')
            check(lv['tsunami'][j] == p['tsunami'], f'{fid}: tsunami')
            check(lv['sig'][j] == (65535 if p['sig'] is None else min(p['sig'], 65534)), f'{fid}: sig')
            check(lv['updated'][j] == ms_since_epoch_of_unix(int(p['updated'])) // 60000, f'{fid}: updated')
            check(places[i - lf + (len(tr) - (n - lf))] == (p['place'] or ''), f'{fid}: place')
            box_of_row[i] = b
        ok(f'live part = the feed\'s {n - lf:,} in-box earthquakes from liveFrom, in (time, id) order; every '
           'value within CONTRACT §1 of the feed; status, magType, felt, alert, tsunami, sig, updated exact')
        older, seen = [], set()
        for q in mk['queries']:
            body = open(os.path.join(LIVE, q['file']), 'rb').read()
            check(hashlib.sha256(body).hexdigest() == q['sha256'], f'{q["file"]} differs from its pin')
            rows = list(csv.DictReader(io.StringIO(body.decode('utf-8')))) if body.strip() else []
            check(len(rows) == q['count'], f'{q["file"]}: {len(rows)} rows, count {q["count"]}')
            for r in rows:
                if r['id'] in seen:
                    continue
                seen.add(r['id'])
                lon, lat = Decimal(r['longitude']), Decimal(r['latitude'])
                b = in_box(boxes, lon, lat)
                if b is None or r['type'] != 'earthquake' or r['mag'] == '' or Decimal(r['mag']) < Decimal('2.5'):
                    continue
                ms = csv_ms(r['time'])
                if ms // 60000 >= R['liveFrom'] or r['id'] in feed_ids:
                    continue
                older.append((ms, r['id'], lon, lat, None if r['depth'] == '' else Decimal(r['depth']),
                              Decimal(r['mag']), r, b))
        older.sort(key=lambda r: (r[0], r[1]))
        check(len(older) == lf, f'{len(older)} FDSN rows before liveFrom, snapshot has {lf}')
        for i, (ms, rid, lon, lat, dep, mag, r, b) in enumerate(older):
            why = within(i, cols, lon, lat, dep, mag, ms)
            check(why is None, f'row {i} ({rid}): {why}')
            check(R['status'][f[i] & 3] == (r['status'] if r['status'] in ('reviewed', 'automatic', 'manual') else 'other'),
                  f'{rid}: status')
            mt = f[i] >> 2
            check((mt == 63 and not r['magType']) or R['magTypes'][mt] == r['magType'], f'{rid}: magType')
            if 65 <= m[i] <= 254:
                check(id_row.get(rid) == i, f'{rid}: M4.5+ row without its id in the text table')
                check(places[list(tr).index(i)] == r['place'], f'{rid}: place')
            box_of_row[i] = b
        ok(f'M2.5+ part = the FDSN answers\' {lf:,} in-box M2.5+ earthquakes before liveFrom (less those the '
           'feed replaced), in (time, id) order; every value within CONTRACT §1 of the CSV text')
        # the depth code 1500 is the sources' exact 10 and nothing else (CONTRACT §1)
        srcs = [r_[4] for r_ in older] + [r_[4] for r_ in live_src]
        e10 = sum(1 for v_ in srcs if v_ is not None and v_ == 10)
        near = sum(1 for v_ in srcs if v_ is not None and v_ != 10 and rnd((v_ + 5) * 100) == 1500)
        n1500 = sum(1 for v_ in d if v_ == 1500)
        check(n1500 == e10, f'{n1500} rows at depth code 1500, {e10} at exactly 10 km in their sources')
        ok(f'depth code 1500: {n1500:,} rows, exactly the sources\' depths of 10 km; {near} depths that round to '
           '10.00 km written as 9.99 or 10.01')

    # ---- volcanoes
    v = s['volcanoes']
    geo = json.load(open(os.path.join(ASSETS, 'geo.json'), encoding='utf-8'))
    vn = {g['vnum']: g for g in geo['volcanoes']}
    check(isinstance(v['ok'], bool) and ISO_S.match(v['readAt']) is not None, 'volcano ok/readAt')
    check(all(mv['alert'] in VOLCANOES['alert_levels'] and mv['color'] in VOLCANOES['color_codes']
              for mv in v['monitored']), 'an unknown volcano label')
    check(all(mv['vnum'] in vn for mv in v['monitored']), 'a monitored volcano not in geo.json')
    check([mv['vnum'] for mv in v['monitored']] == sorted({mv['vnum'] for mv in v['monitored']}), 'volcanoes not sorted/unique')
    check(v['ok'] or not v['monitored'], 'ok false with volcanoes listed')
    ok(f'volcanoes: ok {v["ok"]}, {len(v["monitored"])} monitored in the boxes, labels known, read {v["readAt"]}')

    # ---- sources block
    src = s['sources']
    check([x['id'] for x in src] == ['feed', 'comcat', 'volcanoes'], 'sources ids')
    check(src[0]['attribution'] == FEEDS['attribution'] and src[1]['attribution'] == COMCAT['attribution']
          and src[2]['attribution'] == VOLCANOES['attribution'], 'attribution strings differ from sources.py')
    check(src[0]['readAt'] == feed['generated'] and src[1]['readAt'] == fdsn['queriedAt']
          and src[2]['readAt'] == v['readAt'], 'sources readAt')
    ok('sources: feed, comcat, volcanoes with sources.py\'s attribution strings verbatim and their read times')

    # ---- ask
    ask = s['ask']
    check(len(ask) <= ASK_MAX, f'{len(ask)} ask rows')
    kinds = {'event': ['kind', 'timeUtc', 'box', 'within', 'magnitude', 'magType', 'depthKm', 'place', 'status',
                       'felt', 'tsunami', 'pagerAlert', 'id'],
             'summary': ['kind', 'box', 'window', 'earthquakes', 'm25Plus', 'm4Plus', 'largestMagnitude',
                         'largestPlace', 'largestTimeUtc'],
             'volcano': ['kind', 'name', 'vnum', 'alertLevel', 'aviationColor', 'noticeSentUtc',
                         'alertLevelMeaning', 'observatory', 'statusReadAt'],
             'volcanoSummary': ['kind', 'statusReadAt', 'statusAvailable', 'monitored', 'normal', 'advisory',
                                'watch', 'warning', 'notMonitored'],
             'note': ['kind', 'text']}
    for row in ask:
        check(isinstance(row, dict) and row.get('kind') in kinds, f'ask row kind {row!r:.80}')
        check(list(row) == kinds[row['kind']], f'ask {row["kind"]} keys {list(row)}')
        check(all(isinstance(val, (str, int, float, bool)) or val is None for val in row.values()), 'ask row not flat')
    count = {k: sum(1 for r in ask if r['kind'] == k) for k in kinds}
    check(count['summary'] == 15 and count['volcanoSummary'] == 1 and count['note'] >= 2, f'ask kinds {count}')
    names = {'conus': 'Lower 48', 'ak': 'Alaska', 'hi': 'Hawaii', 'pr': 'Puerto Rico'}
    for r in ask:
        if r['kind'] == 'event':
            i = id_row.get(r['id'])
            check(i is not None and i >= lf, f'ask event {r["id"]} not a live row')
            check(r['magnitude'] == (m[i] - 20) / 10, f'ask event {r["id"]}: magnitude')
            check(r['depthKm'] == (None if d[i] == 65535 else round(d[i] / 100 - 5, 2)), f'ask event {r["id"]}: depth')
            check(r['timeUtc'][:16] == iso_min(t[i]), f'ask event {r["id"]}: time')
            if box_of_row:
                check(r['box'] == names[box_of_row[i]], f'ask event {r["id"]}: box')
        elif r['kind'] == 'summary' and box_of_row:
            days = {'past day': 1, 'past 7 days': 7, 'past 30 days': 30}[r['window']]
            t0 = R['to'] - days * 1440
            rs = [i for i in range(lf, n) if t[i] >= t0 and (r['box'] == 'All four regions' or names[box_of_row[i]] == r['box'])]
            check(r['earthquakes'] == len(rs), f'ask summary {r["box"]} {r["window"]}: {r["earthquakes"]} vs {len(rs)}')
            check(r['m25Plus'] == sum(1 for i in rs if 45 <= m[i] <= 254), f'summary {r["box"]} {r["window"]} m25Plus')
            check(r['m4Plus'] == sum(1 for i in rs if 60 <= m[i] <= 254), f'summary {r["box"]} {r["window"]} m4Plus')
            big = max((m[i] for i in rs if m[i] <= 254), default=None)
            check(r['largestMagnitude'] == (None if big is None else (big - 20) / 10), f'summary {r["box"]} largest')
        elif r['kind'] == 'volcano':
            mv = next((x for x in v['monitored'] if x['vnum'] == r['vnum']), None)
            check(mv is not None and mv['alert'] == r['alertLevel'] and mv['color'] == r['aviationColor']
                  and (mv['alert'] != 'NORMAL' or mv['color'] != 'GREEN'), f'ask volcano {r["vnum"]}')
    above = sum(1 for x in v['monitored'] if x['alert'] != 'NORMAL' or x['color'] != 'GREEN')
    check(count['volcano'] == above, f'{count["volcano"]} volcano rows, {above} above Normal/Green')
    ok(f'ask: {len(ask)} flat rows ≤ {ASK_MAX} ({count}); events match their decoded rows'
       + (', summaries recount exactly' if box_of_row else ''))


def iso_min(tm: int) -> str:
    return (EPOCH + dt.timedelta(minutes=tm)).strftime('%Y-%m-%dT%H:%M')


if __name__ == '__main__':
    sys.exit(main())
