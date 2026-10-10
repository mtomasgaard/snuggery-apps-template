#!/usr/bin/env python3
"""Write us-quakes/data/snapshot.json: the last 30 days of earthquakes in the app's four map boxes at
every magnitude, M2.5 and up from a year before the history cutoff, and the monitored volcanoes'
status (tools/CONTRACT.md §3). Standard library and `requests` only: a bare GitHub runner runs this
every hour after `pip install requests==2.34.2` and nothing else.

    .venv/bin/python refresh.py                          # write ../../us-quakes/data/snapshot.json
    .venv/bin/python refresh.py --out out/snap.json      # somewhere else (the workflow publishes that)
    .venv/bin/python refresh.py --prev old.json          # the published snapshot: its volcano block is
                                                         # kept if the volcano API fails this hour
    .venv/bin/python refresh.py --ref                    # also write us-quakes/tools/ref/snapshot_ref.json
    .venv/bin/python refresh.py --requery                # ignore the day's cached M2.5+ query

Three sources (sources.py has each one's terms and attribution):

1. The GeoJSON summary feed `all_month.geojson` (USGS regenerates it every minute): every earthquake
   of the last 30 days, worldwide; kept are those of type "earthquake" inside the four boxes, from
   `liveFrom` (the feed's own generation minute minus 30 days) to `to` (that minute). Checked on
   every run: metadata.api is 2.7.0, every feature carries the 26 properties sources.FEEDS lists, and
   every geometry is a Point of three numbers.
2. The FDSN event service, once a day: M2.5 and up, type earthquake, per box, from `from` (1 January
   of the year before the history cutoff) to the feed's time, count first, one request a second,
   rows == count or the run stops. A box whose count reaches 18,000 is split by calendar year, then
   month (the service refuses more than 20,000 at once). The answers are kept in cache/live/ with a
   marker (live-marker.json: when, from, to, each query's count and sha256); the workflow's
   actions/cache carries that directory from one hour to the next, so the other 23 runs of a day
   read it instead of asking USGS again. It is re-queried when the marker is 24 hours old, when the
   history cutoff (and with it `from`) moves, when a cached file does not match its pin, or with
   --requery. The rows kept from it are those before `liveFrom`; the feed covers the rest.
3. The Volcano Hazards Program's getMonitoredVolcanoes: the alert level and aviation colour code of
   each monitored volcano, kept for the volcanoes in geo.json's static list (the four boxes). If
   the API fails or answers in a shape or with a label this script does not know, the previous
   snapshot's block is kept unchanged (its `readAt` stays old, so the app says "as of"); with no
   previous block, `ok` is false and the app draws every volcano hollow with its sentence.

Merging: rows sorted by (time to the millisecond, id); de-duplicated by id, a feed row winning over
an FDSN row that shares any of its `ids` (the feed lists every id an event has had). An FDSN row
whose preferred magnitude is below 2.5 (the service matched it on another magnitude) is dropped and
counted, the history's rule (CONTRACT, Builder's decisions).

Every code is computed from the source's decimal text (the feed is parsed with Decimal, never
float), rounded half up away from zero, exactly as build_history.py codes the history, so one
decoder serves both and the app's tests can compare against the raw values. The depth code 1500 is
kept for a depth of exactly 10: one that only rounds to 10.00 km is written 1499 or 1501
(common.depth_code, CONTRACT §1), in the history and here alike.

Validation (CONTRACT §11.3) runs on the snapshot as it will be written, decoded back from its
base64: any failure exits non-zero and writes nothing, so the workflow publishes nothing and the
last good snapshot stays on the data branch. verify_snapshot.py repeats the checks independently
from the cached sources.
"""
from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import io
import json
import os
import re
import sys
import time
import zlib
from array import array
from decimal import Decimal

from common import (EPOCH_ISO, BuildError, depth_code, half_up, http_get, iso_of_minutes, log, minutes_of_date,
                    parse_time_ms, sha256_bytes, sha256_of, unwrap_lon, write_json)
from paths import APP, ASSETS, CACHE, DATA
from sources import COMCAT, CREDIT, FEEDS, VOLCANOES, same_major

SCHEMA = 1
APP_NAME = 'US Quakes'
BUDGET = 1_500_000                              # CONTRACT §3.8
ASK_MAX = 200
REGIONS = ['conus', 'ak', 'hi', 'pr']
STATUS = ['reviewed', 'automatic', 'manual', 'other']
PAGER = {'green': 1, 'yellow': 2, 'orange': 3, 'red': 4}
LIVE_DAYS = 30
FRESH_HOURS = 6                                 # the newest in-box earthquake, against feed.generated
FDSN_REUSE_HOURS = 24
SPLIT_AT = 18_000                               # split a box's query below the service's 20,000
FLOOR = Decimal('2.5')
TEXT_MIN_CODE = 65                              # M4.5 and up keep their id and place before liveFrom
LIVE_DIR = os.path.join(CACHE, 'live')
MARKER = os.path.join(LIVE_DIR, 'live-marker.json')
FEED_FILE = os.path.join(LIVE_DIR, 'all_month.geojson')
DEFAULT_OUT = os.path.join(DATA, 'snapshot.json')
REF_OUT = os.path.join(APP, 'tools', 'ref', 'snapshot_ref.json')
REF_EACH_END = 250                              # snapshot_ref: the first 250 rows and the last 250
REF_COLUMNS = ['row', 'time', 'latitude', 'longitude', 'depth', 'mag', 'magType', 'status', 'id', 'place',
               'felt', 'alert', 'tsunami', 'sig', 'updated']

D0002, D0001, D172, D17, D5, D100, D10 = (Decimal(s) for s in ('0.002', '0.001', '172', '17', '5', '100', '10'))
MS_1970 = (dt.date(1970, 1, 1).toordinal() - dt.date(1600, 1, 1).toordinal()) * 86_400_000
BOX_NAMES = {k: COMCAT['regions'][k]['name'] for k in REGIONS}
WINDOWS = [('day', 'past day', 1), ('week', 'past 7 days', 7), ('month', 'past 30 days', 30)]

_last = [0.0]
_requests = {'fdsn': 0, 'feed': 0, 'volcano': 0}


# ---------------------------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------------------------

def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def iso(moment: dt.datetime) -> str:
    return moment.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def iso_ms(ms_1600: int) -> str:
    """Milliseconds since the 1600 epoch -> '2026-09-30T13:58:12.345Z' (the raw form for the ref)."""
    m, rest = divmod(ms_1600, 60000)
    base = iso_of_minutes(m)[:-3]
    return f'{base}{rest // 1000:02d}.{rest % 1000:03d}Z'


def iso_s(ms_1600: int) -> str:
    """Milliseconds since the 1600 epoch -> ISO UTC to the second (truncated)."""
    return iso_ms(ms_1600)[:19] + 'Z'


def ms_of_unix(ms: int) -> int:
    return int(ms) + MS_1970


def unix_of_iso(text: str) -> float:
    return dt.datetime.fromisoformat(text.replace('Z', '+00:00')).timestamp()


def pace():
    """USGS asks for gentle use: one FDSN request a second, measured from the previous start."""
    wait = 1.0 - (time.monotonic() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.monotonic()
    _requests['fdsn'] += 1


def box_of(lon: Decimal, lat: Decimal):
    """The first of conus, ak, hi, pr whose inclusive bounds (on the 172..296 axis) hold the point,
    or None (CONTRACT §1, "Region")."""
    ax = lon + 360 if lon < D172 else lon
    for k in REGIONS:
        b = COMCAT['regions'][k]['box']
        if b['minlatitude'] <= lat <= b['maxlatitude'] and \
                unwrap_lon(b['minlongitude']) <= ax <= unwrap_lon(b['maxlongitude']):
            return k
    return None


def dec(v) -> Decimal | None:
    """A JSON number (parsed as Decimal or int) or CSV text -> Decimal, '' / None -> None."""
    if v is None or v == '':
        return None
    if isinstance(v, bool):
        raise BuildError(f'a boolean where a number belongs: {v!r}')
    return v if isinstance(v, Decimal) else Decimal(str(v))


def encode(lon: Decimal, lat: Decimal, depth: Decimal | None, mag: Decimal | None, status: str,
           oor: dict):
    """(x, y, d, m, status index) by CONTRACT §1, exactly as build_history.encode_row computes them."""
    ax = lon + 360 if lon < D172 else lon
    x = half_up((ax - D172) / D0002)
    y = half_up((lat - D17) / D0001)
    if not (0 <= x <= 62000 and 0 <= y <= 55000):
        raise BuildError(f'position {lon}, {lat} is outside the axis box')
    if depth is None:
        d = 65535
    else:
        d = depth_code(depth)                   # 1500 only for the feed's exact 10 (CONTRACT §1)
        if not 0 <= d <= 65534:
            d, oor['depth'] = 65535, oor['depth'] + 1
    if mag is None:
        m = 255
    else:
        m = half_up(mag * D10) + 20
        if not 0 <= m <= 254:
            m, oor['magnitude'] = 255, oor['magnitude'] + 1
    st = STATUS.index(status) if status in STATUS[:3] else 3
    return x, y, d, m, st


def pack_section(typ: str, values) -> dict:
    """{type, bytes, data}: little-endian bytes, zlib (RFC 1950) at level 9, base64 (CONTRACT §3.2)."""
    if typ == 'utf8':
        raw = values
    else:
        code = {'uint8': 'B', 'uint16': 'H', 'uint32': 'I'}[typ]
        a = array(code, values)
        if a.itemsize != {'B': 1, 'H': 2, 'I': 4}[code]:
            raise BuildError(f'array {code} has itemsize {a.itemsize} on this machine')
        if sys.byteorder == 'big':
            a.byteswap()
        raw = a.tobytes()
    return {'type': typ, 'bytes': len(raw), 'data': base64.b64encode(zlib.compress(raw, 9)).decode('ascii')}


def unpack_section(sec: dict):
    """The inverse, used by the validation on the snapshot about to be written."""
    raw = zlib.decompress(base64.b64decode(sec['data'], validate=True))
    if len(raw) != sec['bytes']:
        raise BuildError(f'a section inflates to {len(raw)} B, it declares {sec["bytes"]}')
    if sec['type'] == 'utf8':
        return raw
    code = {'uint8': 'B', 'uint16': 'H', 'uint32': 'I'}[sec['type']]
    a = array(code)
    a.frombytes(raw)
    if sys.byteorder == 'big':
        a.byteswap()
    return a


# ---------------------------------------------------------------------------------------------
# 1. the feed
# ---------------------------------------------------------------------------------------------

def read_feed():
    body = http_get(FEEDS['base'] + 'all_month.geojson', timeout=120)
    _requests['feed'] += 1
    os.makedirs(LIVE_DIR, exist_ok=True)
    with open(FEED_FILE + '.part', 'wb') as f:          # kept for verify_snapshot.py, never shipped
        f.write(body)
    os.replace(FEED_FILE + '.part', FEED_FILE)
    return parse_feed(body)


def parse_feed(body: bytes):
    try:
        doc = json.loads(body, parse_float=Decimal)
    except ValueError as e:
        raise BuildError(f'all_month.geojson is not JSON: {e}')
    meta = doc.get('metadata') or {}
    if not same_major(meta.get('api'), FEEDS['api_version']):
        raise BuildError(f'feed metadata.api is {meta.get("api")!r}; the contract is {FEEDS["api_version"]}')
    if meta.get('api') != FEEDS['api_version']:
        print(f'::notice::USGS summary feed metadata.api is {meta.get("api")}; the contract was written for {FEEDS["api_version"]}, and its checks still hold')
    feats = doc.get('features')
    if not isinstance(feats, list) or not feats:
        raise BuildError('feed has no features')
    if meta.get('count') != len(feats):
        raise BuildError(f'feed metadata.count {meta.get("count")} but {len(feats)} features')
    want = set(FEEDS['properties'])
    for f in feats:
        p = f.get('properties')
        if not isinstance(p, dict) or set(p) != want:
            got = set(p) if isinstance(p, dict) else set()
            raise BuildError(f'feed feature {f.get("id")}: properties differ from the contract: '
                             f'missing {sorted(want - got)}, extra {sorted(got - want)}')
        g = f.get('geometry') or {}
        c = g.get('coordinates')
        if g.get('type') != 'Point' or not isinstance(c, list) or len(c) != 3 \
                or any(v is not None and not isinstance(v, (int, Decimal)) for v in c) \
                or c[0] is None or c[1] is None:
            raise BuildError(f'feed feature {f.get("id")}: geometry is not a Point of three numbers: {g!r}')
    return meta, feats


def feed_rows(meta, feats, live_from: int, to: int, oor: dict):
    """The feed's earthquakes in the boxes from liveFrom to `to`, as rows (every magnitude)."""
    rows, in_boxes, other_types = [], 0, {}
    before = 0
    for f in feats:
        p = f['properties']
        lon, lat, depth = (dec(v) for v in f['geometry']['coordinates'])
        box = box_of(lon, lat)
        if box is None:
            continue
        in_boxes += 1
        if p['type'] != 'earthquake':
            other_types[p['type']] = other_types.get(p['type'], 0) + 1
            continue
        ms = ms_of_unix(p['time'])
        t = ms // 60000
        if t > to:
            raise BuildError(f'{f["id"]}: event time {iso_ms(ms)} is after the feed was generated')
        if t < live_from:
            before += 1                    # older than the 30-day boundary: the FDSN part holds it
            continue
        mag = dec(p['mag'])
        x, y, d, m, st = encode(lon, lat, depth, mag, p['status'] or '', oor)
        fid = f.get('id') or ''
        place = p['place'] or ''
        for k, v in (('id', fid), ('place', place)):
            if '\n' in v or '\r' in v:
                raise BuildError(f'{fid}: a newline in {k}')
        if not fid:
            raise BuildError('a feed feature without an id')
        alert = p['alert']
        if alert is not None and alert not in PAGER:
            raise BuildError(f'{fid}: PAGER alert {alert!r} is not one of {list(PAGER)}')
        if p['updated'] is None:
            raise BuildError(f'{fid}: no `updated` time (the contract has no "none" for it)')
        tsu = p['tsunami']
        if tsu not in (0, 1):
            raise BuildError(f'{fid}: tsunami flag {tsu!r} is not 0 or 1')
        ids = {s for s in (p['ids'] or '').split(',') if s} | {fid}
        rows.append({
            'src': 'feed', 'ms': ms, 'id': fid, 'ids': ids, 'box': box, 'place': place,
            't': t, 'x': x, 'y': y, 'd': d, 'm': m, 'st': st, 'mt': p['magType'] or '',
            'felt': p['felt'], 'alert': alert, 'tsunami': tsu, 'sig': p['sig'],
            'updated': ms_of_unix(p['updated']) // 60000,
            'raw': [iso_ms(ms), str(lat), str(lon), '' if depth is None else str(depth),
                    '' if mag is None else str(mag), p['magType'] or '', p['status'] or '', fid, place],
        })
    return rows, {'inBoxes': in_boxes, 'otherTypes': dict(sorted(other_types.items())), 'beforeLiveFrom': before}


# ---------------------------------------------------------------------------------------------
# 2. the FDSN M2.5+ part, once a day
# ---------------------------------------------------------------------------------------------

def _fdsn_params(box: str, start: str, end: str) -> dict:
    p = dict(COMCAT['regions'][box]['box'])
    p.update(starttime=start, endtime=end, minmagnitude=float(FLOOR), eventtype='earthquake')
    return p


def fdsn_count(box, start, end) -> int:
    pace()
    body = http_get(COMCAT['base'] + '/count', params=dict(_fdsn_params(box, start, end), format='geojson'),
                    timeout=120)
    return int(json.loads(body)['count'])


def fdsn_split(start: dt.datetime, end: dt.datetime, level: int):
    """Children of [start, end) one rung down: calendar years, then months, then days."""
    out, cur = [], start
    while cur < end:
        if level == 0:
            nxt = dt.datetime(cur.year + 1, 1, 1, tzinfo=dt.timezone.utc)
        elif level == 1:
            nxt = dt.datetime(cur.year + (cur.month == 12), cur.month % 12 + 1, 1, tzinfo=dt.timezone.utc)
        else:
            nxt = dt.datetime.combine(cur.date() + dt.timedelta(days=1), dt.time(), tzinfo=dt.timezone.utc)
        nxt = min(nxt, end)
        out.append((cur, nxt))
        cur = nxt
    return out


def fdsn_plan(box, start: dt.datetime, end: dt.datetime, level=-1):
    n = fdsn_count(box, iso(start), iso(end))
    if n < SPLIT_AT:
        return [(start, end, n)]
    if level >= 2:
        raise BuildError(f'{box} {iso(start)}..{iso(end)}: {n} M2.5+ earthquakes in one day')
    out = []
    for a, b in fdsn_split(start, end, level + 1):
        out += fdsn_plan(box, a, b, level + 1)
    return out


def fdsn_query(from_date: str, to_iso: str) -> dict:
    """Query every box, cache each answer in cache/live/, write the marker; return the marker."""
    pace()
    version = http_get(COMCAT['base'] + '/version', timeout=60).decode().strip()
    if not same_major(version, COMCAT['api_version']):
        raise BuildError(f'FDSN event service version {version}; the contract is {COMCAT["api_version"]}')
    if version != COMCAT['api_version']:
        print(f'::notice::FDSN event service version {version}; the contract was written for {COMCAT["api_version"]}, and its column and count checks still hold')
    start = dt.datetime.fromisoformat(from_date).replace(tzinfo=dt.timezone.utc)
    end = dt.datetime.fromisoformat(to_iso.replace('Z', '+00:00'))
    queried_at = iso(utc_now())
    os.makedirs(LIVE_DIR, exist_ok=True)
    for old in os.listdir(LIVE_DIR):
        if old.startswith('fdsn-') and old.endswith('.csv'):
            os.remove(os.path.join(LIVE_DIR, old))
    queries = []
    for box in REGIONS:
        for i, (a, b, n) in enumerate(fdsn_plan(box, start, end)):
            s, e = iso(a), iso(b)
            for attempt in range(3):
                if attempt:
                    n = fdsn_count(box, s, e)           # an event arrived or went between the two asks
                pace()
                body = http_get(COMCAT['base'] + '/query', timeout=300, accept_status=(200, 204),
                                params=dict(_fdsn_params(box, s, e), format='csv', orderby='time-asc'))
                lines = list(csv.reader(io.StringIO(body.decode('utf-8'))))
                if n == 0 and not body.strip():
                    lines = [COMCAT['csv_columns']]     # the service answers an empty CSV with no header
                if not lines or lines[0] != COMCAT['csv_columns']:
                    raise BuildError(f'FDSN {box} {s}..{e}: columns changed: {lines[0] if lines else "(empty)"}')
                if len(lines) - 1 == n:
                    break
                log(f'  FDSN {box} {s}..{e}: {len(lines) - 1} rows, count said {n}; asking again')
            else:
                raise BuildError(f'FDSN {box} {s}..{e}: rows never matched the count after 3 attempts')
            name = f'fdsn-{box}-{i:02d}.csv'
            with open(os.path.join(LIVE_DIR, name), 'wb') as f:
                f.write(body)
            queries.append({'box': box, 'start': s, 'end': e, 'count': n, 'rows': len(lines) - 1,
                            'file': name, 'sha256': sha256_bytes(body)})
            log(f'  FDSN {box:5s} {s}..{e}  {n:>6,} M2.5+ earthquakes')
    marker = {'schema': 1, 'queriedAt': queried_at, 'api': version, 'minMagnitude': float(FLOOR),
              'from': from_date, 'to': to_iso, 'queries': queries}
    with open(MARKER + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(marker, f, indent=1)
        f.write('\n')
    os.replace(MARKER + '.tmp', MARKER)
    return marker


def cached_marker(from_date: str, live_from: int):
    """The marker of a usable cached query, or None with the reason printed."""
    if not os.path.exists(MARKER):
        log('  FDSN: no cached query (first run, or actions/cache had none)')
        return None
    try:
        with open(MARKER, encoding='utf-8') as f:
            mk = json.load(f)
        age_h = (time.time() - unix_of_iso(mk['queriedAt'])) / 3600
        if mk.get('schema') != 1 or mk['from'] != from_date or mk['minMagnitude'] != float(FLOOR):
            log(f'  FDSN: the cached query is for from={mk.get("from")}; this run needs {from_date}')
            return None
        if not 0 <= age_h < FDSN_REUSE_HOURS:
            log(f'  FDSN: the cached query is {age_h:.1f} h old')
            return None
        if minutes_of_iso(mk['to']) < live_from:
            log('  FDSN: the cached query ends before this run\'s 30-day boundary')
            return None
        for q in mk['queries']:
            p = os.path.join(LIVE_DIR, q['file'])
            if not os.path.exists(p) or sha256_of(p) != q['sha256']:
                log(f'  FDSN: cached {q["file"]} is missing or differs from its pin')
                return None
    except (OSError, ValueError, KeyError, TypeError) as e:
        log(f'  FDSN: the cached marker is unreadable ({e!r})')
        return None
    log(f'  FDSN: reusing the query of {mk["queriedAt"]} ({age_h:.1f} h old)')
    return mk


def minutes_of_iso(text: str) -> int:
    return parse_time_ms(text if '.' in text else text[:-1] + '.000Z') // 60000


def fdsn_rows(marker: dict, live_from: int, oor: dict):
    """Rows from the cached answers with t < liveFrom, M2.5 and up by the preferred magnitude."""
    rows, seen = [], set()
    stats = {'belowFloor': [], 'duplicates': 0, 'outsideBox': 0, 'atOrAfterLiveFrom': 0, 'otherType': 0}
    for q in marker['queries']:
        with open(os.path.join(LIVE_DIR, q['file']), encoding='utf-8', newline='') as f:
            text = f.read()
        rd = csv.DictReader(io.StringIO(text)) if text.strip() else []
        for r in rd:
            if r['id'] in seen:
                stats['duplicates'] += 1          # the Lower 48 and Alaska boxes share a strip at 50°N
                continue
            seen.add(r['id'])
            if r['type'] != 'earthquake':
                stats['otherType'] += 1
                continue
            lon, lat = Decimal(r['longitude']), Decimal(r['latitude'])
            box = box_of(lon, lat)
            if box is None:
                stats['outsideBox'] += 1
                continue
            if r['mag'] == '' or Decimal(r['mag']) < FLOOR:
                stats['belowFloor'].append(r['id'])
                continue
            ms = parse_time_ms(r['time'])
            t = ms // 60000
            if t >= live_from:
                stats['atOrAfterLiveFrom'] += 1   # the feed holds these
                continue
            for k in ('id', 'place'):
                if '\n' in r[k] or '\r' in r[k]:
                    raise BuildError(f'{r["id"]}: a newline in {k}')
            x, y, d, m, st = encode(lon, lat, dec(r['depth']), Decimal(r['mag']), r['status'], oor)
            rows.append({'src': 'fdsn', 'ms': ms, 'id': r['id'], 'ids': {r['id']}, 'box': box,
                         'place': r['place'], 't': t, 'x': x, 'y': y, 'd': d, 'm': m, 'st': st,
                         'mt': r['magType'],
                         'raw': [r['time'], r['latitude'], r['longitude'], r['depth'], r['mag'], r['magType'],
                                 r['status'], r['id'], r['place']]})
    stats['belowFloor'] = sorted(stats['belowFloor'])
    return rows, stats


# ---------------------------------------------------------------------------------------------
# 3. volcanoes
# ---------------------------------------------------------------------------------------------

SENT_RE = re.compile(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$')


def static_volcanoes():
    with open(os.path.join(ASSETS, 'geo.json'), encoding='utf-8') as f:
        vols = json.load(f)['volcanoes']
    return {v['vnum']: v for v in vols if v['vnum'] not in ('', '0')}, len(vols)


def valid_volcano_block(b) -> bool:
    try:
        return (isinstance(b, dict) and isinstance(b['monitored'], list) and isinstance(b['readAt'], str)
                and all(m['alert'] in VOLCANOES['alert_levels'] and m['color'] in VOLCANOES['color_codes']
                        for m in b['monitored']))
    except (KeyError, TypeError):
        return False


def read_volcanoes(prev: dict | None, known: dict):
    """(block, why): the live block, or the previous snapshot's unchanged, or ok:false."""
    read_at = iso(utc_now())
    try:
        _requests['volcano'] += 1
        body = http_get(VOLCANOES['monitored'], timeout=60, retries=3)
        items = json.loads(body)
        if not isinstance(items, list) or not items:
            raise BuildError('getMonitoredVolcanoes did not answer with a list')
        mon = []
        for it in items:
            missing = [k for k in VOLCANOES['monitored_fields'] if k not in it]
            if missing:
                raise BuildError(f'getMonitoredVolcanoes entry lacks {missing}')
            if it['vnum'] not in known:
                continue                            # a regional notice, or outside the four boxes
            if it['alert_level'] not in VOLCANOES['alert_levels'] or it['color_code'] not in VOLCANOES['color_codes']:
                raise BuildError(f'volcano {it["vnum"]}: unknown level {it["alert_level"]!r} / {it["color_code"]!r}')
            sent = it['sent_utc']
            if sent is not None and not SENT_RE.match(sent):
                raise BuildError(f'volcano {it["vnum"]}: sent_utc {sent!r} is not "YYYY-MM-DD HH:MM:SS"')
            mon.append({'vnum': it['vnum'], 'alert': it['alert_level'], 'color': it['color_code'],
                        'sent': sent.replace(' ', 'T') + 'Z' if sent else None,
                        'noticeType': it['notice_type_cd'] or ''})
        if not mon:
            raise BuildError('no monitored volcano inside the four boxes')
        vnums = [m['vnum'] for m in mon]
        if len(set(vnums)) != len(vnums):
            raise BuildError('a volcano listed twice')
        mon.sort(key=lambda m: m['vnum'])
        return {'readAt': read_at, 'ok': True, 'endpoint': 'getMonitoredVolcanoes', 'monitored': mon}, 'live'
    except (BuildError, ValueError, TypeError, AttributeError) as e:
        log(f'  volcanoes: {e}')
        if prev is not None and valid_volcano_block(prev.get('volcanoes')):
            log(f'  volcanoes: keeping the previous snapshot\'s block, read {prev["volcanoes"]["readAt"]}')
            return prev['volcanoes'], f'kept from the previous snapshot ({e})'
        return {'readAt': read_at, 'ok': False, 'endpoint': 'getMonitoredVolcanoes', 'monitored': [],
                'error': str(e)[:200]}, f'unavailable ({e})'


# ---------------------------------------------------------------------------------------------
# the snapshot
# ---------------------------------------------------------------------------------------------

def mag_of(m: int):
    return None if m == 255 else (m - 20) / 10


def depth_of(d: int):
    return None if d == 65535 else round(d / 100 - 5, 2)


def build_ask(live: list, to: int, volc: dict, known: dict, n_static: int, levels: dict,
              tsunami_quote: str | None) -> list:
    """≤ 200 flat rows for Snuggery's Ask (CONTRACT §3.6): 15 summaries, the volcanoes above
    Normal and a count of the rest, notes, then the largest earthquakes of the 30 days, taken
    round-robin across the four boxes so every region's largest are there."""
    summary = []
    for key, label, days in WINDOWS:
        t0 = to - days * 1440
        for box in REGIONS + ['all']:
            rs = [r for r in live if r['t'] >= t0 and (box == 'all' or r['box'] == box)]
            big = max((r for r in rs if r['m'] != 255), key=lambda r: (r['m'], r['ms']), default=None)
            summary.append({
                'kind': 'summary', 'box': BOX_NAMES.get(box, 'All four regions'), 'window': label,
                'earthquakes': len(rs),
                'm25Plus': sum(1 for r in rs if 45 <= r['m'] != 255),
                'm4Plus': sum(1 for r in rs if 60 <= r['m'] != 255),
                'largestMagnitude': mag_of(big['m']) if big else None,
                'largestPlace': big['place'] if big else None,
                'largestTimeUtc': iso_s(big['ms']) if big else None})
    vrows = []
    counts = {k: 0 for k in VOLCANOES['alert_levels']}
    for m in volc['monitored']:
        counts[m['alert']] += 1
        if m['alert'] != 'NORMAL' or m['color'] != 'GREEN':
            v = known.get(m['vnum'], {})
            vrows.append({'kind': 'volcano', 'name': v.get('name', m['vnum']), 'vnum': m['vnum'],
                          'alertLevel': m['alert'], 'aviationColor': m['color'], 'noticeSentUtc': m['sent'],
                          'alertLevelMeaning': (levels.get(m['alert']) or {}).get('quote'),
                          'observatory': (v.get('obs') or '').upper(), 'statusReadAt': volc['readAt']})
    known_status = bool(volc['ok'])            # without a status, every count is unknown, not zero
    vsum = {'kind': 'volcanoSummary', 'statusReadAt': volc['readAt'], 'statusAvailable': known_status,
            'monitored': len(volc['monitored']) if known_status else None,
            'normal': counts['NORMAL'] if known_status else None,
            'advisory': counts['ADVISORY'] if known_status else None,
            'watch': counts['WATCH'] if known_status else None,
            'warning': counts['WARNING'] if known_status else None,
            'notMonitored': n_static - len(volc['monitored']) if known_status else None}
    notes = [
        {'kind': 'note', 'text': 'US Quakes is not an earthquake, tsunami or volcano warning service. These rows '
                                 'are only as new as the snapshot\'s generatedAt time, and automatic solutions can '
                                 'change or be deleted after they appear.'},
        {'kind': 'note', 'text': 'The four regions are latitude-longitude boxes, not borders: Lower 48 '
                                 '(24–50° N, 130–65° W, so it takes in offshore Cascadia and parts of Canada and '
                                 'Mexico), Alaska (50–72° N, 172° E–129° W, with the Aleutians), Hawaii (18–23° N, '
                                 '161–154° W) and Puerto Rico (17–20° N, 68–64° W, with the Virgin Islands).'},
    ]
    if tsunami_quote:
        notes.append({'kind': 'note', 'text': 'The tsunami value in the event rows (0 or 1) is a flag USGS '
                                              'describes this way: “' + tsunami_quote + '”'})
    room = ASK_MAX - len(summary) - len(vrows) - 1 - len(notes)
    per_box = {b: sorted((r for r in live if r['box'] == b and r['m'] != 255),
                         key=lambda r: (-r['m'], -r['ms'], r['id'])) for b in REGIONS}
    picked, i = [], 0
    while len(picked) < room and any(i < len(v) for v in per_box.values()):
        for b in REGIONS:
            if i < len(per_box[b]) and len(picked) < room:
                picked.append(per_box[b][i])
        i += 1
    picked.sort(key=lambda r: (-r['m'], -r['ms'], r['id']))
    events = []
    for r in picked:
        age = to - r['t']
        events.append({
            'kind': 'event', 'timeUtc': iso_s(r['ms']), 'box': BOX_NAMES[r['box']],
            'within': next(label for _, label, days in WINDOWS if age < days * 1440 or days == 30),
            'magnitude': mag_of(r['m']), 'magType': r['mt'] or None, 'depthKm': depth_of(r['d']),
            'place': r['place'], 'status': STATUS[r['st']],
            'felt': r['felt'], 'tsunami': r['tsunami'],
            'pagerAlert': r['alert'], 'id': r['id']})
    return summary + events + vrows + [vsum] + notes


def build(args) -> tuple[dict, list, dict]:
    with open(os.path.join(ASSETS, 'history.json'), encoding='utf-8') as f:
        hist = json.load(f)
    cutoff = hist['cutoff']
    if not re.match(r'^\d{4}-01-01$', cutoff):
        raise BuildError(f'history.json cutoff {cutoff!r} is not YYYY-01-01')
    from_date = f'{int(cutoff[:4]) - 1}-01-01'
    t_from = minutes_of_date(from_date)
    prev = None
    if args.prev:
        try:
            with open(args.prev, encoding='utf-8') as f:
                prev = json.load(f)
            if not isinstance(prev, dict) or prev.get('app') != APP_NAME:
                log('  --prev is not a US Quakes snapshot; ignored')
                prev = None
        except (OSError, ValueError) as e:
            log(f'  --prev unreadable ({e!r}); ignored')

    oor = {'depth': 0, 'magnitude': 0}
    meta, feats = read_feed() if not args.feed else parse_feed(open(args.feed, 'rb').read())
    gen_ms = ms_of_unix(meta['generated'])
    to = gen_ms // 60000
    live_from = to - LIVE_DAYS * 1440
    if live_from <= t_from:
        raise BuildError('the 30-day boundary is before the snapshot\'s start')
    live, fstats = feed_rows(meta, feats, live_from, to, oor)
    log(f'  feed {iso_s(gen_ms)}: {len(feats):,} features, {fstats["inBoxes"]:,} in the boxes, '
        f'{len(live):,} earthquakes from liveFrom')

    marker = None if args.requery else cached_marker(from_date, live_from)
    queried = marker is None
    if queried:
        marker = fdsn_query(from_date, iso_s(gen_ms))
    older, qstats = fdsn_rows(marker, live_from, oor)
    feed_ids = set().union(*(r['ids'] for r in live)) if live else set()
    replaced = [r['id'] for r in older if r['id'] in feed_ids]
    older = [r for r in older if r['id'] not in feed_ids]
    rows = sorted(older, key=lambda r: (r['ms'], r['id'])) + sorted(live, key=lambda r: (r['ms'], r['id']))
    live_first = len(older)
    ids = [r['id'] for r in rows]
    if len(set(ids)) != len(ids):
        raise BuildError('an id appears twice after merging')
    log(f'  FDSN part: {len(older):,} M2.5+ rows before liveFrom ({len(replaced)} replaced by the feed, '
        f'{len(qstats["belowFloor"])} below the floor)')

    types = sorted({r['mt'] for r in rows if r['mt']})
    if len(types) > 63:
        raise BuildError(f'{len(types)} magnitude-type labels; the flags byte holds 63')
    tix = {k: i for i, k in enumerate(types)}
    text_rows = [i for i, r in enumerate(rows) if i >= live_first or (TEXT_MIN_CODE <= r['m'] != 255)]
    n = len(rows)
    lv = rows[live_first:]
    columns = {
        't': pack_section('uint32', [r['t'] for r in rows]),
        'x': pack_section('uint16', [r['x'] for r in rows]),
        'y': pack_section('uint16', [r['y'] for r in rows]),
        'd': pack_section('uint16', [r['d'] for r in rows]),
        'm': pack_section('uint8', [r['m'] for r in rows]),
        'f': pack_section('uint8', [r['st'] | ((tix[r['mt']] if r['mt'] else 63) << 2) for r in rows]),
    }
    text = {
        'rule': 'every row at or after liveFrom, and magnitude 4.5 and up before it', 'rows': len(text_rows),
        'text_row': pack_section('uint32', text_rows),
        'id_text': pack_section('utf8', '\n'.join(rows[i]['id'] for i in text_rows).encode('utf-8')),
        'place_text': pack_section('utf8', '\n'.join(rows[i]['place'] for i in text_rows).encode('utf-8')),
    }
    live_sec = {
        'felt': pack_section('uint16', [65535 if r['felt'] is None else min(int(r['felt']), 65534) for r in lv]),
        'alert': pack_section('uint8', [PAGER.get(r['alert'], 0) for r in lv]),
        'tsunami': pack_section('uint8', [int(r['tsunami']) for r in lv]),
        'sig': pack_section('uint16', [65535 if r['sig'] is None else min(int(r['sig']), 65534) for r in lv]),
        'updated': pack_section('uint32', [r['updated'] for r in lv]),
    }
    newest = max((r['ms'] for r in live), default=None)
    known, n_static = static_volcanoes()
    volc, vwhy = read_volcanoes(prev, known)
    with open(os.path.join(ASSETS, 'about.json'), encoding='utf-8') as f:
        about = json.load(f)
    levels = about.get('volcanoLevels') or {}
    tsq = ((about.get('fields') or {}).get('tsunami') or {}).get('quote')
    ask = build_ask(lv, to, volc, known, n_static, levels, tsq)
    now = iso(utc_now())

    def source(key, name, url, read_at):
        c = CREDIT['comcat' if key != 'volcanoes' else 'volcano-list']
        return {'id': key, 'name': name, 'owner': 'U.S. Geological Survey', 'licence': c['licence'],
                'attribution': (FEEDS if key == 'feed' else COMCAT if key == 'comcat' else VOLCANOES)['attribution'],
                'url': url, 'readAt': read_at}

    snap = {
        'schema': SCHEMA, 'app': APP_NAME, 'generatedAt': now, 'cutoff': cutoff,
        'feed': {'file': 'all_month.geojson', 'generated': iso_s(gen_ms), 'api': meta['api'],
                 'features': len(feats), 'inBoxes': fstats['inBoxes'], 'earthquakes': len(live),
                 'otherTypes': fstats['otherTypes'],
                 'newest': iso_s(newest) if newest is not None else None},
        'fdsn': {'queriedAt': marker['queriedAt'], 'api': marker['api'], 'minMagnitude': marker['minMagnitude'],
                 'from': marker['from'] + 'T00:00:00Z', 'to': marker['to'],
                 'queries': [{k: q[k] for k in ('box', 'start', 'end', 'count', 'rows')} for q in marker['queries']],
                 'kept': len(older), 'replacedByFeed': len(replaced), 'belowFloor': qstats['belowFloor']},
        'rows': {
            'count': n, 'epoch': EPOCH_ISO, 'from': t_from, 'liveFrom': live_from, 'to': to,
            'liveFirst': live_first, 'compression': 'zlib', 'encoding': 'base64',
            'status': STATUS, 'magTypes': types, 'columns': columns, 'text': text,
            'live': live_sec, 'outOfRange': oor},
        'volcanoes': volc,
        'sources': [
            source('feed', 'USGS earthquake feed (all_month, GeoJSON summary)',
                   FEEDS['base'] + 'all_month.geojson', iso_s(gen_ms)),
            source('comcat', 'ANSS Comprehensive Earthquake Catalog (ComCat), FDSN event service',
                   COMCAT['base'], marker['queriedAt']),
            source('volcanoes', 'USGS Volcano Hazards Program, monitored volcanoes (HANS public API)',
                   VOLCANOES['monitored'], volc['readAt']),
        ],
        'ask': ask,
    }
    report = {'queried': queried, 'volcanoes': vwhy, 'requests': dict(_requests), 'fstats': fstats,
              'qstats': qstats}
    return snap, rows, report


# ---------------------------------------------------------------------------------------------
# validation (CONTRACT §11.3), on the snapshot as written
# ---------------------------------------------------------------------------------------------

def validate(snap: dict, rows: list, data: bytes):
    fail = []
    R = snap['rows']
    n = R['count']
    if len(data) > BUDGET:
        fail.append(f'{len(data):,} B exceeds the {BUDGET:,} B budget')
    col = {k: unpack_section(v) for k, v in R['columns'].items()}
    for k, v in col.items():
        if len(v) != n:
            fail.append(f'column {k}: {len(v)} values for {n} rows')
    t, x, y, d, m, fl = (col[k] for k in 'txydmf')
    lf = R['liveFirst']
    if any(a > b for a, b in zip(t, t[1:])):
        fail.append('t is not sorted')
    if n and not (R['from'] <= t[0] and t[-1] <= R['to']):
        fail.append(f't outside [from, to]: {t[0]}..{t[-1]}')
    if any(v < R['liveFrom'] for v in t[lf:]) or any(v >= R['liveFrom'] for v in t[:lf]):
        fail.append('liveFirst does not split the rows at liveFrom')
    if any(not (45 <= v <= 254) for v in m[:lf]):
        fail.append('a row before liveFirst is below M2.5 (code 45) or has no magnitude')
    if any(v > 62000 for v in x) or any(v > 55000 for v in y):
        fail.append('a position code out of range')
    ntypes = len(R['magTypes'])
    if any((v >> 2) != 63 and (v >> 2) >= ntypes for v in fl):
        fail.append('a magnitude-type index past the list')
    keyed = [(r['ms'], r['id']) for r in rows[:lf]], [(r['ms'], r['id']) for r in rows[lf:]]
    for part in keyed:
        if any(a >= b for a, b in zip(part, part[1:])):
            fail.append('rows not strictly ordered by (time, id)')
    # every row decoded against its source value, within CONTRACT §1's bounds
    bad = 0
    for i, r in enumerate(rows):
        lon, lat = Decimal(r['raw'][2]), Decimal(r['raw'][1])
        lon = lon + 360 if lon < D172 else lon
        raw_d, raw_m = r['raw'][3], r['raw'][4]
        if raw_d == '':
            d_ok = d[i] == 65535
        elif d[i] == 65535:
            d_ok = not (Decimal('-5') <= Decimal(raw_d) <= Decimal('650.34'))
        else:
            # the code exactly, 1500 kept for an exact 10 (so within 0.005 km, or 0.01 km for a 1499 or 1501)
            d_ok = d[i] == depth_code(Decimal(raw_d)) and abs(Decimal(d[i]) / D100 - D5 - Decimal(raw_d)) < Decimal('0.01')
        if raw_m == '':
            m_ok = m[i] == 255
        elif m[i] == 255:
            m_ok = not (0 <= half_up(Decimal(raw_m) * D10) + 20 <= 254)
        else:
            m_ok = m[i] == half_up(Decimal(raw_m) * D10) + 20
        mt = fl[i] >> 2
        ok = (t[i] == r['ms'] // 60000
              and abs(D172 + D0002 * x[i] - lon) <= D0001
              and abs(D17 + D0001 * y[i] - lat) <= Decimal('0.0005')
              and d_ok and m_ok
              and (fl[i] & 3) == r['st']
              and ((mt == 63 and not r['mt']) or (mt < ntypes and R['magTypes'][mt] == r['mt'])))
        if not ok:
            bad += 1
            if bad <= 5:
                fail.append(f'row {i} ({r["id"]}) does not decode to its source values')
    tr = unpack_section(R['text']['text_row'])
    want = [i for i in range(n) if i >= lf or 65 <= m[i] != 255]
    if list(tr) != want:
        fail.append('text_row is not exactly the rows at or after liveFirst and M4.5+ before it')
    idt = unpack_section(R['text']['id_text']).decode('utf-8').split('\n') if tr else []
    plt = unpack_section(R['text']['place_text']).decode('utf-8').split('\n') if tr else []
    if len(idt) != len(tr) or len(plt) != len(tr):
        fail.append('id_text / place_text line counts differ from text_row')
    elif any(idt[j] != rows[i]['id'] or plt[j] != rows[i]['place'] for j, i in enumerate(tr)):
        fail.append('an id or a place in the text table differs from its row')
    if len(set(idt)) != len(idt):
        fail.append('an id twice in the text table')
    for k, v in R['live'].items():
        if len(unpack_section(v)) != n - lf:
            fail.append(f'live.{k}: wrong length')
    # freshness: the newest in-box earthquake against the feed's time
    feed = snap['feed']
    if not feed['newest']:
        fail.append('no in-box earthquake in the feed')
    else:
        age_h = (unix_of_iso(feed['generated']) - unix_of_iso(feed['newest'])) / 3600
        if age_h >= FRESH_HOURS:
            fail.append(f'the newest in-box earthquake is {age_h:.1f} h older than the feed (≥ {FRESH_HOURS} h)')
    if not same_major(feed['api'], FEEDS['api_version']):
        fail.append(f'feed api {feed["api"]}')
    if not same_major(snap['fdsn']['api'], COMCAT['api_version']):
        fail.append(f'FDSN api {snap["fdsn"]["api"]}')
    if any(q['rows'] != q['count'] for q in snap['fdsn']['queries']):
        fail.append('an FDSN query\'s rows differ from its count')
    if not valid_volcano_block(snap['volcanoes']):
        fail.append('the volcano block has an unknown label or shape')
    ask = snap['ask']
    if len(ask) > ASK_MAX:
        fail.append(f'{len(ask)} ask rows (> {ASK_MAX})')
    for a in ask:
        if not isinstance(a, dict) or 'kind' not in a or any(isinstance(v, (dict, list)) for v in a.values()):
            fail.append(f'ask row not flat: {a!r:.120}')
            break
    if fail:
        raise BuildError('validation failed:\n  - ' + '\n  - '.join(fail))
    log(f'  validated: {n:,} rows decode to their sources, text table {len(tr):,}, '
        f'{len(ask)} ask rows, {len(data):,} B')


def write_ref(snap: dict, rows: list):
    lf = snap['rows']['liveFirst']
    n = len(rows)
    pick = sorted(set(range(min(REF_EACH_END, n))) | set(range(max(0, n - REF_EACH_END), n)))
    out = []
    for i in pick:
        r = rows[i]
        extra = [r['felt'], r['alert'], r['tsunami'], r['sig'],
                 iso_of_minutes(r['updated']) if r.get('updated') is not None else None] if i >= lf \
            else [None] * 5
        out.append([i] + r['raw'] + extra)
    refj = {'schema': 1, 'file': 'data/snapshot.json', 'generatedAt': snap['generatedAt'],
            'count': n, 'liveFirst': lf,
            'method': f'the first {REF_EACH_END} rows and the last {REF_EACH_END}, with the source values as '
                      'the FDSN CSV or the feed gave them (the feed\'s numbers as their JSON text); '
                      'felt, alert, tsunami, sig, updated for live rows only; id and place are in the '
                      'snapshot\'s text table only for rows at or after liveFirst and M4.5+ before it',
            'columns': REF_COLUMNS, 'rows': out}
    write_json(REF_OUT, refj, 250_000)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('--prev', default='', help='the currently published snapshot (for the volcano fallback)')
    ap.add_argument('--feed', default='', help='read all_month.geojson from this file instead (testing)')
    ap.add_argument('--requery', action='store_true', help='query FDSN even if the cached query is fresh')
    ap.add_argument('--ref', action='store_true', help='also write us-quakes/tools/ref/snapshot_ref.json')
    a = ap.parse_args(argv)
    t0 = time.monotonic()
    snap, rows, rep = build(a)
    data = (json.dumps(snap, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
    validate(snap, rows, data)
    write_json(a.out, snap, BUDGET)
    if a.ref:
        write_ref(snap, rows)
    R = snap['rows']
    log(f'refresh: {R["count"]:,} rows ({R["liveFirst"]:,} M2.5+ from {snap["fdsn"]["from"][:10]}, '
        f'{R["count"] - R["liveFirst"]:,} from the feed of {snap["feed"]["generated"]}), '
        f'newest {snap["feed"]["newest"]}; FDSN {"queried" if rep["queried"] else "reused"} '
        f'({snap["fdsn"]["queriedAt"]}); volcanoes {rep["volcanoes"]}; requests {rep["requests"]}; '
        f'{time.monotonic() - t0:.1f} s')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except BuildError as e:
        log(f'REFRESH FAILED: {e}')
        sys.exit(1)
