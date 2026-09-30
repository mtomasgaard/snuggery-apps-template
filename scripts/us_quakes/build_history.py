"""Pack the cached ComCat windows into us-quakes/assets/history.bin + history.json
(tools/CONTRACT.md §1–2), and write us-quakes/tools/ref/history_ref.json for the app's decoder test.

    .venv/bin/python build_history.py [--cutoff 2026-01-01]

Reads only the cache and catalog-windows.json (every window's sha256 is checked first); no network.
Rows: earthquakes only, every one before 1900 and M2.5 and up from 1900, time < cutoff, de-duplicated
by id (first box wins), sorted by (time to the millisecond, id). Every code is computed from the
catalogue's decimal text with Decimal arithmetic, rounded half up (away from zero), so a rebuild
is byte-identical and the app's decoder can be tested against the raw strings.
"""
import argparse
import csv
import json
import os
import sys
import unicodedata
from collections import Counter
from decimal import Decimal

import numpy as np

from common import (BuildError, DEPTH_FIXED_CODE, EPOCH_ISO, depth_code, half_up, iso_of_minutes, log,
                    minutes_of_date, parse_time_ms, sha256_of, unwrap_lon, write_bin, write_credits_fragment,
                    write_json)
from paths import APP, ASSETS, CACHE, HERE
from sources import COMCAT

BUDGET_BIN = 5_800_000
BUDGET_JSON = 16_000
BUDGET_REF = 250_000
REGIONS = ['conus', 'ak', 'hi', 'pr']
STATUS = ['reviewed', 'automatic', 'manual', 'other']
TEXT_MIN_CODE = 65                          # M4.5 and up keep their id and place text
REF_SEED = 20260930
REF_COLUMNS = ['row', 'time', 'latitude', 'longitude', 'depth', 'mag', 'magType', 'status', 'id', 'place']

# The six events the brief names (docs/plans/0010, Idea 4, Validation; CONTRACT §11.2), with the
# values measured in the cache on 2026-09-30. verify_static.py checks each survives the round trip.
KNOWN = [
    ('1700 Cascadia', 'official17000127050000000'),
    ('1811 New Madrid', 'official18111216081500000'),
    ('1906 San Francisco', 'official19060418131226300_12'),
    ('1964 Prince William Sound', 'official19640328033616_30'),
    ('2018 Anchorage', 'ak018fcnsk91'),
    ('2019 Ridgecrest', 'ci38457511'),
]

D0002, D0001, D172, D17, D5, D100, D10 = (Decimal(s) for s in ('0.002', '0.001', '172', '17', '5', '100', '10'))


def axis_boxes():
    out = {}
    for k in REGIONS:
        b = COMCAT['regions'][k]['box']
        out[k] = {'name': COMCAT['regions'][k]['name'], 'west': unwrap_lon(b['minlongitude']),
                  'east': unwrap_lon(b['maxlongitude']), 'south': b['minlatitude'], 'north': b['maxlatitude']}
    return out


def encode_row(r, types, oor):
    """The six codes of one CSV row (CONTRACT §1). `oor` counts values written as none because
    they are out of the column's range."""
    lon = Decimal(r['longitude'])
    if lon < D172:
        lon += 360
    x = half_up((lon - D172) / D0002)
    y = half_up((Decimal(r['latitude']) - D17) / D0001)
    if not (0 <= x <= 62000 and 0 <= y <= 55000):
        raise BuildError(f'{r["id"]}: position {r["longitude"]}, {r["latitude"]} is outside the axis box')
    if r['depth'] == '':
        d = 65535
    else:
        d = depth_code(Decimal(r['depth']))     # 1500 only for the catalog's exact 10 (CONTRACT §1)
        if not 0 <= d <= 65534:
            d = 65535
            oor['depth'] += 1
    if r['mag'] == '':
        m = 255
    else:
        m = half_up(Decimal(r['mag']) * D10) + 20
        if not 0 <= m <= 254:
            m = 255
            oor['magnitude'] += 1
    st = STATUS.index(r['status']) if r['status'] in STATUS[:3] else 3
    mt = types[r['magType']] if r['magType'] else 63
    return x, y, d, m, st | (mt << 2)


def read_rows(cutoff):
    with open(os.path.join(HERE, 'catalog-windows.json'), encoding='utf-8') as f:
        manifest = json.load(f)
    if manifest['cutoff'] < cutoff:
        raise BuildError(f'catalog-windows.json covers to {manifest["cutoff"]}; the build asks for {cutoff}. '
                         f'Run fetch_catalog.py --cutoff {cutoff} first.')
    if manifest['columns'] != COMCAT['csv_columns']:
        raise BuildError('catalog-windows.json columns differ from sources.COMCAT')
    cutoff_ms = minutes_of_date(cutoff) * 60000
    seen, rows = set(), []
    dropped, dups, after, below = Counter(), 0, 0, []
    nwin, dates = 0, set()
    cached = Counter()                                          # earthquake rows per box, before packing
    for region in REGIONS:
        for w in manifest['regions'][region]['windows']:
            if w['start'] >= cutoff:
                continue
            p = os.path.join(CACHE, w['cache'])
            if not os.path.exists(p):
                raise BuildError(f'{w["cache"]} is not cached; run fetch_catalog.py')
            got = sha256_of(p)
            if got != w['sha256']:
                raise BuildError(f'{w["cache"]}: sha256 {got} differs from its pin in catalog-windows.json')
            nwin += 1
            dates.add(w.get('retrieved', ''))
            second_era = w['minmagnitude'] is not None
            with open(p, encoding='utf-8', newline='') as f:
                rd = csv.DictReader(f)
                if rd.fieldnames != COMCAT['csv_columns']:
                    raise BuildError(f'{w["cache"]}: columns {rd.fieldnames}')
                n = 0
                for r in rd:
                    n += 1
                    if r['id'] in seen:
                        dups += 1
                        continue
                    seen.add(r['id'])
                    if r['type'] != 'earthquake':
                        dropped[r['type']] += 1
                        continue
                    ms = parse_time_ms(r['time'])
                    if ms >= cutoff_ms:
                        after += 1
                        continue
                    if second_era and (r['mag'] == '' or Decimal(r['mag']) < Decimal('2.5')):
                        # The service matched these on a magnitude other than the preferred one
                        # the CSV reports (5 rows on 2026-09-30, all ml, 0.7 to 2.46). The history's
                        # rule is on the preferred magnitude, so they are dropped and counted.
                        below.append(r['id'])
                        continue
                    for k in ('id', 'place'):
                        if '\n' in r[k] or '\r' in r[k]:
                            raise BuildError(f'{r["id"]}: a newline in {k}')
                    r['_ms'] = ms
                    r['_box'] = region
                    cached[region] += 1
                    rows.append(r)
                if n != w['rows']:
                    raise BuildError(f'{w["cache"]}: {n} rows, the manifest says {w["rows"]}')
    rows.sort(key=lambda r: (r['_ms'], r['id']))
    for a, b in zip(rows, rows[1:]):
        if (a['_ms'], a['id']) >= (b['_ms'], b['id']):
            raise BuildError(f'rows not strictly ordered at {a["id"]} / {b["id"]}')
    info = {'manifest': manifest, 'dropped': dropped, 'duplicates': dups, 'afterCutoff': after,
            'belowFloor': sorted(below),
            'windows': nwin, 'dates': sorted(d for d in dates if d), 'cached': cached}
    return rows, info


def pack(rows, sections):
    """Lay the sections end to end, each on a 4-byte boundary; return (bytes, {name: meta})."""
    out, meta, off = bytearray(), {}, 0
    for name, typ, count, data in sections:
        pad = (-len(out)) % 4
        out += b'\0' * pad
        meta[name] = {'offset': len(out), 'type': typ, 'count': count}
        out += data
    return bytes(out), meta


def build(cutoff, write=True):
    rows, info = read_rows(cutoff)
    n = len(rows)
    if n == 0:
        raise BuildError('no rows')
    types = {k: i for i, k in enumerate(sorted({r['magType'] for r in rows if r['magType']}))}
    if len(types) > 63:
        raise BuildError(f'{len(types)} magnitude-type labels; the flags byte holds 63')
    oor = Counter({'depth': 0, 'magnitude': 0})
    t = np.empty(n, '<u4')
    x = np.empty(n, '<u2')
    y = np.empty(n, '<u2')
    d = np.empty(n, '<u2')
    m = np.empty(n, 'u1')
    fl = np.empty(n, 'u1')
    nfc_changed = 0
    for i, r in enumerate(rows):
        t[i] = r['_ms'] // 60000
        x[i], y[i], d[i], m[i], fl[i] = encode_row(r, types, oor)
        if unicodedata.normalize('NFC', r['place']) != r['place']:
            nfc_changed += 1
    if nfc_changed:
        raise BuildError(f'{nfc_changed} place strings are not in NFC; decide how to ship them')
    text_rows = np.nonzero((m >= TEXT_MIN_CODE) & (m != 255))[0].astype('<u4')
    ids = '\n'.join(rows[i]['id'] for i in text_rows).encode('utf-8')
    places = '\n'.join(rows[i]['place'] for i in text_rows).encode('utf-8')
    data, sections = pack(rows, [
        ('t', 'uint32', n, t.tobytes()), ('x', 'uint16', n, x.tobytes()), ('y', 'uint16', n, y.tobytes()),
        ('d', 'uint16', n, d.tobytes()), ('m', 'uint8', n, m.tobytes()), ('f', 'uint8', n, fl.tobytes()),
        ('text_row', 'uint32', len(text_rows), text_rows.tobytes()),
        ('id_text', 'utf8', len(ids), ids), ('place_text', 'utf8', len(places), places)])

    by_box = Counter(r['_box'] for r in rows)
    first_era_end = minutes_of_date(COMCAT['eras'][0][1]) * 60000
    manifest = info['manifest']
    dates = info['dates']
    retrieved = dates[0] if len(dates) == 1 else f'{dates[0]} to {dates[-1]}'
    # code 1500 is the catalog's 10 and nothing else: a depth that only rounds to it went to 1499 or 1501
    exact10 = sum(1 for r in rows if r['depth'] != '' and Decimal(r['depth']) == D10)
    near10 = sum(1 for r in rows if r['depth'] != '' and Decimal(r['depth']) != D10
                 and half_up((Decimal(r['depth']) + D5) * D100) == DEPTH_FIXED_CODE)
    if int((d == DEPTH_FIXED_CODE).sum()) != exact10:
        raise BuildError(f'{int((d == DEPTH_FIXED_CODE).sum())} rows at code 1500, {exact10} at the catalog\'s exact 10 km')
    counts = {
        'byBox': {k: by_box[k] for k in REGIONS},
        'before1900': sum(1 for r in rows if r['_ms'] < first_era_end),
        'noDepth': int((d == 65535).sum()),
        'noMagnitude': int((m == 255).sum()),
        'depth10km': exact10,
        'automatic': int(((fl & 3) == 1).sum()),
        'outOfRange': {'depth': oor['depth'], 'magnitude': oor['magnitude']},
    }
    hj = {
        'schema': 1, 'file': 'history.bin', 'bytes': len(data),
        'source': 'comcat', 'api': manifest['apiVersion'], 'retrieved': retrieved,
        'cutoff': cutoff, 'epoch': EPOCH_ISO,
        'eras': [{'from': COMCAT['eras'][0][0], 'to': COMCAT['eras'][0][1], 'minMagnitude': None},
                 {'from': COMCAT['eras'][1][0], 'to': cutoff, 'minMagnitude': COMCAT['eras'][1][2]}],
        'type': 'earthquake',
        'axis': {'lon0': 172, 'dlon': 0.002, 'lat0': 17, 'dlat': 0.001, 'unwrapBelow': 172},
        'boxes': axis_boxes(),
        'codes': {'t': 'minutes since epoch, truncated',
                  'x': '(lon on the axis - 172) / 0.002, rounded half up',
                  'y': '(lat - 17) / 0.001, rounded half up',
                  'd': '(depth_km + 5) x 100, rounded half up; 1500 only for a depth of exactly 10, a depth that '
                       'rounds to it written 1499 (below 10) or 1501 (above); 65535 none',
                  'm': 'magnitude text x 10 rounded half up (away from zero), + 20; 255 none',
                  'f': 'bits 0-1 status index, bits 2-7 magTypes index (63 blank)'},
        'status': STATUS,
        'magTypes': sorted(types, key=types.get),
        'text': {'rule': 'magnitude 4.5 and up', 'rows': int(len(text_rows))},
        'count': n, 'first': iso_of_minutes(int(t[0])), 'last': iso_of_minutes(int(t[-1])),
        'counts': counts,
        'dropped': {'byType': dict(sorted(info['dropped'].items())), 'duplicates': info['duplicates'],
                    'belowFloor': info['belowFloor']},
        'provenance': {'catalog-windows.json': sha256_of(os.path.join(HERE, 'catalog-windows.json')),
                       'windows': info['windows']},
        'sections': sections,
    }
    # packing loses nothing: every cached earthquake row before the cutoff (and at or above its
    # era's floor) is shipped, per box
    for k in REGIONS:
        if by_box[k] != info['cached'][k]:
            raise BuildError(f'{k}: {by_box[k]} rows shipped, {info["cached"][k]} earthquake rows cached')

    # the decoder test's reference: six known events and 1,000 seeded rows, raw CSV strings
    ix = {r['id']: i for i, r in enumerate(rows)}
    missing = [e for _, e in KNOWN if e not in ix]
    if missing:
        raise BuildError(f'known events missing from the history: {missing}')
    pick = sorted(int(v) for v in np.random.default_rng(REF_SEED).choice(n, 1000, replace=False))

    def ref(i):
        r = rows[i]
        return [i] + [r[k] for k in REF_COLUMNS[1:]]
    refj = {'schema': 1, 'file': 'history.bin', 'count': n, 'cutoff': cutoff,
            'seed': REF_SEED, 'method': 'numpy.random.default_rng(seed).choice(count, 1000, replace=False), sorted',
            'columns': REF_COLUMNS,
            'known': [[name] + ref(ix[e]) for name, e in KNOWN],
            'rows': [ref(i) for i in pick]}

    if write:
        write_bin(os.path.join(ASSETS, 'history.bin'), data, BUDGET_BIN)
        write_json(os.path.join(ASSETS, 'history.json'), hj, BUDGET_JSON)
        write_json(os.path.join(APP, 'tools', 'ref', 'history_ref.json'), refj, BUDGET_REF)
        write_credits_fragment('build_history', [{
            'id': 'comcat', 'source': [], 'retrieved': retrieved,
            'adaptations': [
                f'earthquakes only (the catalogue\'s type "earthquake"): every one before 1900 and magnitude '
                f'2.5 and up from 1900 to {cutoff}, in four map boxes, de-duplicated by id',
                'rounded: time to the minute (truncated), longitude to 0.002°, latitude to 0.001°, depth '
                'to 10 m (10.00 km kept for the catalog\'s exact 10; a depth that only rounds to it is written '
                '9.99 or 10.01 km), magnitude to a tenth (half up); ids and place names kept for magnitude 4.5 and up',
                'repacked as little-endian binary columns (assets/history.bin, described by history.json)'],
        }])
    log(f'history: depth code 1500 holds the {exact10:,} rows at exactly 10 km; {near10} measured depths that '
        f'round to 10.00 km written as 9.99 or 10.01')
    log(f'history: {n:,} rows, {len(text_rows):,} with text, {len(types)} magnitude types, '
        f'{len(data):,} B; dropped {sum(info["dropped"].values()):,} other-type rows, '
        f'{info["duplicates"]} duplicates, {info["afterCutoff"]} after the cutoff, '
        f'{len(info["belowFloor"])} below the M2.5 floor {info["belowFloor"]}')
    return hj


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--cutoff', default=COMCAT['cutoff'])
    a = ap.parse_args(argv)
    build(a.cutoff)


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        sys.exit(1)
