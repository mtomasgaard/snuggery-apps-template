#!/usr/bin/env python3
"""Check a written warming-world/data/snapshot.json against tools/CONTRACT.md §3 and §8.2,
independently of build_snapshot.py and gistemp.py: its own data access (array + byteswap at the
variable's offset, where gistemp.py goes through netcdf3.frame and struct), its own rounding
(Decimal, ROUND_HALF_UP on the magnitude, where gistemp.py uses integer floor division), its own
table parser, its own decoder. It recomputes EVERY frame from the source and compares bytes.

    .venv/bin/python verify_snapshot.py                     # the committed demo, sources from the cache
    .venv/bin/python verify_snapshot.py out/…/snapshot.json # the workflow's file, before publishing
    .venv/bin/python verify_snapshot.py --grid G --table T  # explicit source files

The source files are found from the snapshot's release.mode: research → the pinned Internet Archive
copies in cache/wayback/, live → cache/live/ (which refresh.py leaves there), and each must match the
bytes and sha256 the snapshot's `sources` block records. Prints one line per check; exits 1 on the
first failure. Standard library only (netcdf3.py is used for the header's offsets and attributes).
"""
from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import math
import os
import random
import re
import sys
import unicodedata
import zlib
from array import array
from decimal import ROUND_HALF_UP, Decimal

import netcdf3
from paths import APP, CACHE
from sources import GISTEMP, GISTEMP_RESEARCH

BUDGET, ASK_ROWS, ASK_BYTES, MAX_LAYERS, FRESH_DAYS = 1_500_000, 200, 70_000, 256, 60
TOP = ['schema', 'app', 'generatedAt', 'source', 'release', 'grid', 'encoding', 'layers', 'annual', 'steps',
       'months', 'sources', 'ask']
STEP_KEYS = ['year', 'label', 'months', 'partial', 'globalMean', 'gridMean', 'coverage', 'beyondScale', 'planes']
MONTH_KEYS = ['month', 'label', 'globalMean', 'gridMean', 'coverage', 'beyondScale', 'planes']
YEAR_ROW = ['kind', 'year', 'months', 'partial', 'globalAnomalyC', 'north64AnomalyC', 'south64AnomalyC',
            'coveragePercentOfSurface', 'cellsWithData', 'cellsAbove4C', 'cellsBelowMinus4C', 'warmestCellC',
            'warmestCell', 'coldestCellC', 'coldestCell']
MONTH_ROW = ['kind', 'month', 'globalAnomalyC', 'north64AnomalyC', 'south64AnomalyC', 'coveragePercentOfSurface',
             'cellsAbove4C', 'cellsBelowMinus4C', 'warmestCellC', 'warmestCell', 'coldestCellC', 'coldestCell']
# NASA's guidance for AI products (credits/nasa-media-guidelines.txt): the ask rows feed Snuggery's Ask, so
# their source note says whose reading the answers are, and no string attributes a statement to NASA.
AI_CLAUSE = ('Answers drawn from these rows are this app\'s reading of GISS\'s published data; NASA has not '
             'reviewed them and is not responsible for their accuracy.')
ATTRIBUTED = re.compile(r'\baccording to (NASA|GISS)\b|\b(NASA|GISS)(\'s)? (says|said|states|stated|reports|'
                        r'reported|confirms|confirmed|finds|found|shows|showed)\b', re.I)
GRID = {'nx': 180, 'ny': 90, 'lon0': -179, 'lat0': 89, 'dlon': 2, 'dlat': -2, 'cells': True}
PLANE = {'offset': -12.7, 'step': 0.1, 'power': 1, 'unit': '°C', 'none': 255}
VENDORS = re.compile(r'\b(Claude|Anthropic|OpenAI|ChatGPT|GPT-\d|Gemini|Copilot|Llama|Mistral|Bard)\b')
MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
         'November', 'December']
FILL = 32767


class Fail(Exception):
    pass


def ok(msg):
    print(f'ok    {msg}', flush=True)


def check(cond, msg):
    if not cond:
        raise Fail(msg)


def pole_mean(b: bytes, north: bool):
    """js/data.js capMean on a shipped frame, written again here: the 13 rows nearest the pole (to 64°),
    each cell with a value weighted by cos of its row's centre latitude in capMean's own expression and
    order, the mean rounded to hundredths half away from zero, a tie within 1e-9 counted as a tie (the
    exact half-hundredth of a cap with values in one row only). Returns (°C to the hundredth, or None
    when no cell has a value; how far |s| / w * 10 lies from a rounding tie)."""
    s = w = 0.0
    for r in range(13):
        j = r if north else 89 - r
        wt = math.cos(((89 - 2 * j) * math.pi) / 180)
        for x in b[j * 180:(j + 1) * 180]:
            if x != 255:
                s += wt * (x - 127)
                w += wt
    if not w:
        return None, None
    v = abs(s) / w * 10
    fl = math.floor(v)
    h = fl + 1 if v - fl >= 0.5 - 1e-9 else fl
    return (h if s > 0 else -h) / 100, abs(v - fl - 0.5)


def tenths(total: int, count: int) -> int:
    """Hundredths summed over `count` months, as tenths, half away from zero (Decimal)."""
    q = (Decimal(abs(total)) / Decimal(10 * count)).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return int(q) * (1 if total >= 0 else -1)


# ---------------------------------------------------------------------------------------------

class Source:
    """The grid, read with array('h') at the variable's begin offset; every month north-first."""

    def __init__(self, gz: bytes):
        raw = gzip.decompress(gz)
        nc = netcdf3.NetCDF3(raw)
        v = nc.vars['tempanomaly']
        check(v.typecode == 'h' and v.dims == ('time', 'lat', 'lon') and not v.is_record,
              'the grid\'s tempanomaly is not a fixed int16 (time, lat, lon) variable')
        self.T = nc.dims['time']
        data = array('h')
        data.frombytes(raw[v.begin:v.begin + self.T * 16200 * 2])
        if sys.byteorder == 'little':
            data.byteswap()
        self.data = data
        tv = nc.vars['time']
        times = array('i')
        times.frombytes(raw[tv.begin:tv.begin + 4 * self.T])
        if sys.byteorder == 'little':
            times.byteswap()
        base = dt.date(1800, 1, 1)
        self.months = [(base + dt.timedelta(days=d)).strftime('%Y-%m') for d in times]
        lv = nc.vars['lat']
        lats = array('f')
        lats.frombytes(raw[lv.begin:lv.begin + 4 * 90])
        if sys.byteorder == 'little':
            lats.byteswap()
        self.lat_first, self.lat_last = lats[0], lats[-1]
        self.history = re.sub(r'[\x00-\x1f\x7f]', '', str(nc.attrs.get('history', '')))

    def value(self, t: int, k: int) -> int:
        """Snapshot cell k (north-first) of month t, in hundredths; source row = 89 − row."""
        j, i = divmod(k, 180)
        return self.data[t * 16200 + (89 - j) * 180 + i]


def parse_table(body: bytes):
    rows = list(csv.reader(io.StringIO(body.decode('utf-8'))))[2:]
    months, jd = {}, {}
    for r in rows:
        if not r or not r[0].strip():
            continue
        y = int(r[0])
        vals = [None if v.strip() == '***' else int((Decimal(v.strip()) * 100).to_integral_exact()) for v in r[1:14]]
        months[y], jd[y] = vals[:12], vals[12]
    return months, jd


def find_sources(snap, args):
    mode = snap['release']['mode']
    if args.grid and args.table:
        return args.grid, args.table
    if mode == 'research':
        return (os.path.join(CACHE, GISTEMP_RESEARCH['grid']['name']), os.path.join(CACHE, GISTEMP_RESEARCH['table']['name']))
    return os.path.join(CACHE, 'live', 'gistemp1200_GHCNv4_ERSSTv5.nc.gz'), os.path.join(CACHE, 'live', 'GLB.Ts+dSST.csv')


def frame_expected(src: Source, ts: list[int], need: int | None):
    """need None: one month, no rule. Otherwise the annual rule with `need` months. Rows are taken
    north-first by slicing the source's south-first rows in reverse."""
    north = []
    for t in ts:
        base = t * 16200
        f = []
        for j in range(90):
            f.extend(src.data[base + (89 - j) * 180: base + (90 - j) * 180])
        north.append(f)
    out = bytearray(16200)
    exact = [None] * 16200
    for k, cell in enumerate(zip(*north)):
        vals = [v for v in cell if v != FILL]
        if need is None:
            if vals:
                out[k] = tenths(vals[0], 1) + 127
                exact[k] = vals[0] / 100
            else:
                out[k] = 255
        elif len(vals) >= need:
            out[k] = tenths(sum(vals), len(vals)) + 127
            exact[k] = sum(vals) / len(vals) / 100
        else:
            out[k] = 255
    return bytes(out), exact


def strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from strings(v)


def run(args):
    path = args.snapshot
    with open(path, 'rb') as f:
        data = f.read()
    snap = json.loads(data.decode('utf-8'))
    # ---- structure
    check(list(snap) == TOP, f'top-level keys {list(snap)}')
    check(snap['schema'] == 1 and snap['app'] == 'Warming World', 'schema or app')
    check(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', snap['generatedAt']), 'generatedAt format')
    check(snap['grid'] == GRID, f'grid {snap["grid"]}')
    e = snap['encoding']
    check(e['compression'] == 'deflate' and e['delta'] == 'none' and e['none'] == 255, f'encoding {e}')
    check(len(snap['layers']) == 1 and snap['layers'][0]['key'] == 'anom' and snap['layers'][0]['planes'] == {'v': PLANE},
          'layers')
    check(snap['source']['attribution'] == GISTEMP['attribution'], 'source.attribution is not sources.GISTEMP\'s')
    steps, months = snap['steps'], snap['months']
    for s in steps:
        check(list(s) == STEP_KEYS, f'step {s.get("year")} keys {list(s)}')
    for m in months:
        check(list(m) == MONTH_KEYS, f'month {m.get("month")} keys {list(m)}')
    ok(f'structure: keys in the contract\'s order, grid {GRID}, one plane −12.7 + 0.1·b, 255 none, no delta')
    # ---- the sources it was built from
    gpath, tpath = find_sources(snap, args)
    with open(gpath, 'rb') as f:
        gz = f.read()
    with open(tpath, 'rb') as f:
        tb = f.read()
    for blob, src_rec, p in ((gz, snap['sources'][0], gpath), (tb, snap['sources'][1], tpath)):
        check(len(blob) == src_rec['bytes'] and hashlib.sha256(blob).hexdigest() == src_rec['sha256'],
              f'{p} is not the file the snapshot names ({src_rec["bytes"]:,} B {src_rec["sha256"][:16]}…)')
    check([s['id'] for s in snap['sources']] == ['gistemp-grid', 'gistemp-table'], 'sources ids')
    check(len(snap['sources'][0]['citation']) == 2 and snap['release']['retrieved'] in snap['sources'][0]['citation'][0],
          'the GISTEMP citation does not carry the access date')
    ok(f'sources: {os.path.basename(gpath)} {len(gz):,} B and {os.path.basename(tpath)} {len(tb):,} B match the '
       f'snapshot\'s sha256 ({snap["release"]["mode"]} mode)')
    src = Source(gz)
    tmonths, tjd = parse_table(tb)
    rel = snap['release']
    created = re.search(r'Created (\S+) (\S+)', src.history)
    check(created and rel['created'] == f'{created.group(1)}T{created.group(2)}', f'release.created {rel["created"]}')
    check(rel['id'] == f'{src.months[-1]}/{rel["created"]}' and rel['newestMonth'] == src.months[-1]
          and rel['monthCount'] == src.T and rel['firstMonth'] == src.months[0] == '1880-01'
          and rel['history'] == src.history, f'release {rel["id"]} does not match the grid')
    ty = max(tmonths)
    tnew = f'{ty}-{sum(v is not None for v in tmonths[ty]):02d}'
    check(rel['tableNewestMonth'] == tnew, f'tableNewestMonth {rel["tableNewestMonth"]} vs the table\'s {tnew}')
    if rel['mode'] == 'live':
        check(tnew == src.months[-1], f'V7 live: the table ends {tnew} and the grid {src.months[-1]}')
    else:
        check(rel['mode'] == 'research', f'release.mode {rel["mode"]!r}')
    ok(f'release {rel["id"]}: newest month, month count {src.T}, created and history equal the grid\'s; table ends {tnew}')
    # ---- V3 shape, the partial year
    years = [s['year'] for s in steps]
    ny = int(src.months[-1][:4])
    n_new = sum(1 for m in src.months if m.startswith(f'{ny}-'))
    last_complete = ny if n_new == 12 else ny - 1
    want = list(range(1880, last_complete + 1)) + ([ny] if 6 <= n_new <= 11 else [])
    check(years == want, f'steps {years[0]}…{years[-1]}, expected {want[0]}…{want[-1]}')
    for s in steps:
        n = 12 if s['year'] <= last_complete else n_new
        check(s['months'] == n and s['partial'] == (n != 12), f'step {s["year"]}: months {s["months"]}, partial {s["partial"]}')
        lab = str(s['year']) if n == 12 else f'{s["year"]}, Jan–{MONS[n - 1]} (partial)'
        check(s['label'] == lab, f'step {s["year"]} label {s["label"]!r}, expected {lab!r}')
    ms = [m['month'] for m in months]
    check(ms == src.months[-24:], f'months {ms[0]}…{ms[-1]} are not the grid\'s 24 newest')
    for m in months:
        check(m['label'] == f'{NAMES[int(m["month"][5:]) - 1]} {m["month"][:4]}', f'month label {m["label"]}')
    check(len(steps) + len(months) <= MAX_LAYERS, 'too many layers')
    part = (f'the current year {ny} marked partial ({steps[-1]["label"]})' if steps[-1]['partial']
            else f'no partial step ({ny} has {n_new} months in the grid)')
    ok(f'V3 shape: {len(steps)} steps {years[0]}–{years[-1]}, 24 months {ms[0]}–{ms[-1]}, {len(steps) + len(months)} '
       f'layers ≤ {MAX_LAYERS}; {part}')
    # ---- every frame, recomputed
    by_year = {}
    for t, ym in enumerate(src.months):
        by_year.setdefault(int(ym[:4]), []).append(t)
    W = [math.cos(math.radians(89 - 2 * j)) for j in range(90)]
    WALL = 180 * sum(W)
    decoded, exacts, labels = [], [], []
    mism = 0
    vmin, vmax, amin, amax = 999, -999, 999, -999
    for li, rec in enumerate(steps + months):
        b = zlib.decompress(base64.b64decode(rec['planes']['anom.v'], validate=True))
        check(len(b) == 16200, f'{rec.get("year") or rec.get("month")}: {len(b)} B, expected 16 200')
        if li < len(steps):
            ts = by_year[rec['year']]
            need = 9 if len(ts) == 12 else math.ceil(0.75 * len(ts))
            exp, exact = frame_expected(src, ts, need)
        else:
            exp, exact = frame_expected(src, [src.months.index(rec['month'])], None)
        if b != exp:
            mism += 1
            k = next(k for k in range(16200) if b[k] != exp[k])
            raise Fail(f'{rec.get("year") or rec.get("month")}: cell {k} is byte {b[k]}, recomputed {exp[k]}')
        decoded.append(b)
        exacts.append(exact)
        labels.append(str(rec.get('year') or rec.get('month')))
        vals = [x for x in b if x != 255]
        vmin, vmax = min(vmin, min(vals)), max(vmax, max(vals))
        if li < len(steps):
            amin, amax = min(amin, min(vals)), max(amax, max(vals))
        # coverage, beyond, gridMean
        cells = len(vals)
        area = sum(W[k // 180] for k in range(16200) if b[k] != 255) / WALL
        above = sum(1 for x in vals if x - 127 > 40)
        below = sum(1 for x in vals if x - 127 < -40)
        gm = sum(W[k // 180] * exact[k] for k in range(16200) if exact[k] is not None) / (area * WALL)
        check(rec['coverage'] == {'area': round(area, 4), 'cells': round(cells / 16200, 4)},
              f'{labels[-1]}: coverage {rec["coverage"]}, recomputed area {area:.4f} cells {cells / 16200:.4f}')
        check(rec['beyondScale'] == {'above': above, 'below': below}, f'{labels[-1]}: beyondScale')
        check(abs(rec['gridMean'] - gm) <= 0.0005 + 1e-9, f'{labels[-1]}: gridMean {rec["gridMean"]}, recomputed {gm:.4f}')
    ok(f'every frame recomputed from the grid with this file\'s own code: {len(decoded)} of {len(decoded)} '
       f'byte-identical ({mism} differ); coverage, beyondScale and gridMean equal on every one')
    # V4 orientation, said separately
    check(abs(src.lat_last - 89) < 1e-4 and abs(src.lat_first + 89) < 1e-4, 'the source latitudes are not −89 … 89')
    lc_i = last_complete - 1880
    row0 = decoded[lc_i][:180]
    srow = bytearray()
    for i in range(180):
        vals = [src.data[t * 16200 + 89 * 180 + i] for t in by_year[last_complete]]
        vals = [v for v in vals if v != FILL]
        srow.append(tenths(sum(vals), len(vals)) + 127 if len(vals) >= 9 else 255)
    check(row0 == bytes(srow) and row0.count(255) < 180, f'V4: row 0 of {last_complete} is not the source\'s lat 89 row')
    ok(f'V4 orientation: row 0 of {last_complete} equals the source\'s lat {src.lat_last:.0f} row '
       f'({180 - row0.count(255)} cells with data); the source runs south ({src.lat_first:.0f}) to north')
    # V5 range
    rng = snap['layers'][0]['range']
    check(rng == [round((amin - 127) / 10, 1), round((amax - 127) / 10, 1)], f'layers.range {rng}')
    ok(f'V5 byte range: every value byte in 0…254 ({(vmin - 127) / 10:+.1f} … {(vmax - 127) / 10:+.1f} °C over all '
       f'frames, inside ±12.7), no byte means a clipped value; annual range {rng} as layers.range says')
    # ---- GISS's own table: global means
    worst, wy = 0.0, None
    for s, b, ex in zip(steps, decoded, exacts):
        if s['partial']:
            n = s['months']
            h = sum(tmonths[s['year']][:n])
            q = (Decimal(abs(h)) / n).quantize(Decimal(1), rounding=ROUND_HALF_UP) * (1 if h >= 0 else -1)
            check(s['globalMean'] == float(q) / 100, f'{s["year"]}: partial globalMean {s["globalMean"]}, table {q}')
            continue
        check(s['globalMean'] == tjd[s['year']] / 100, f'{s["year"]}: globalMean {s["globalMean"]} vs J-D {tjd[s["year"]]}')
        gm = sum(W[k // 180] * (b[k] - 127) / 10 for k in range(16200) if b[k] != 255) / \
            sum(W[k // 180] for k in range(16200) if b[k] != 255)
        d = gm - tjd[s['year']] / 100
        if abs(d) > abs(worst):
            worst, wy = d, s['year']
    check(abs(worst) <= 0.05, f'the decoded map\'s {wy} global mean is {worst:+.3f} °C from GISS\'s J-D (limit 0.05)')
    for m in months:
        y, mo = int(m['month'][:4]), int(m['month'][5:])
        check(m['globalMean'] == tmonths[y][mo - 1] / 100, f'{m["month"]}: globalMean vs the table')
    ok(f'GISS\'s table: every globalMean is the table\'s (J-D, the month, or the partial mean); the decoded map\'s '
       f'area-weighted mean is within ±0.05 °C of J-D for all {sum(not s["partial"] for s in steps)} complete years '
       f'(max {abs(worst):.3f} in {wy})')
    # ---- 1 000 random cells against the exact source mean
    rnd = random.Random(1000)
    worst_c = 0.0
    nones = 0
    for _ in range(1000):
        li, k = rnd.randrange(len(decoded)), rnd.randrange(16200)
        b, ex = decoded[li][k], exacts[li][k]
        if ex is None:
            check(b == 255, f'{labels[li]} cell {k}: byte {b} where the source fails the rule')
            nones += 1
            continue
        d = abs(-12.7 + 0.1 * b - ex)
        check(d <= 0.05 + 1e-9, f'{labels[li]} cell {k}: decoded {-12.7 + 0.1 * b:.2f} vs source {ex:.4f}')
        worst_c = max(worst_c, d)
    ok(f'1 000 random cells (seed 1000): {1000 - nones} decode within {worst_c:.4f} °C of the source\'s exact mean '
       f'(limit 0.05, half a step), {nones} are none where the source fails its rule')
    # ---- freshness
    today = dt.date.fromisoformat(args.now) if args.now else dt.datetime.now(dt.timezone.utc).date()
    y, m = int(rel['newestMonth'][:4]), int(rel['newestMonth'][5:])
    age = (today - dt.date(y + (m == 12), m % 12 + 1, 1)).days
    if rel['mode'] == 'live':
        check(age <= FRESH_DAYS, f'the newest month {rel["newestMonth"]} ended {age} days ago (limit {FRESH_DAYS})')
        ok(f'freshness: {rel["newestMonth"]} ended {age} days before {today} (limit {FRESH_DAYS})')
    else:
        print(f'skip  freshness: research mode (the Internet Archive copy of the August release); '
              f'{rel["newestMonth"]} ended {age} days before {today}, the live limit is {FRESH_DAYS}', flush=True)
    # ---- ask
    ask = snap['ask']
    kinds = [r['kind'] for r in ask]
    n_notes = kinds.count('note')
    check(kinds == ['note'] * 6 + ['year'] * len(steps) + ['month'] * (len(ask) - 6 - len(steps)), 'ask order')
    check([r['topic'] for r in ask[:6]] == ['anomaly', 'source', 'smoothing', 'coverage', 'partial', 'figures'], 'note topics')
    for r, s, b in zip(ask[6:6 + len(steps)], steps, decoded):
        check(list(r) == YEAR_ROW and r['year'] == s['year'] and r['globalAnomalyC'] == s['globalMean']
              and r['coveragePercentOfSurface'] == round(s['coverage']['area'] * 100, 1)
              and r['cellsWithData'] == 16200 - b.count(255)
              and r['cellsAbove4C'] == s['beyondScale']['above'] and r['cellsBelowMinus4C'] == s['beyondScale']['below']
              and r['warmestCellC'] == round((max(x for x in b if x != 255) - 127) / 10, 1)
              and r['coldestCellC'] == round((min(b) - 127) / 10, 1), f'ask year row {r.get("year")}')
    for r in ask[6 + len(steps):]:
        check(list(r) == MONTH_ROW and r['month'] in ms, f'ask month row {r.get("month")}')
    # the pole means: what the app's pole chip prints for the same frame, to the hundredth, every row
    by_label = dict(zip(labels, decoded))
    n_pole, n_null, n_tie, tie = 0, 0, 0, 9.0
    for r in ask[6:]:
        b = by_label[str(r['year']) if r['kind'] == 'year' else r['month']]
        for key, north in (('north64AnomalyC', True), ('south64AnomalyC', False)):
            v, gap = pole_mean(b, north)
            check(r[key] == v, f'ask {r.get("year") or r.get("month")}: {key} {r[key]}, the shipped frame gives {v} '
                               '(js/data.js capMean, recomputed here)')
            n_pole += 1
            if v is None:
                n_null += 1
            elif gap < 1e-9:
                n_tie += 1                                     # an exact tie, rounded away from zero
            else:
                tie = min(tie, gap)
    ok(f'ask pole means: all {n_pole} north64AnomalyC and south64AnomalyC values ({len(ask) - 6} rows) equal the '
       f'app\'s capMean recomputed from the shipped frames ({n_null} null); {n_tie} exact ties (a cap with values '
       f'in one row) rounded away from zero; every other mean lies at least {tie:.2e} of a hundredth from a tie')
    # the notes: whose reading the answers are (NASA's AI guidance), and a newer table said with its month
    note = ask[1]['text']
    check(AI_CLAUSE in note, 'the ask source note lacks the clause NASA\'s AI guidance asks for')
    tm = rel['tableNewestMonth']
    mixed = tm > rel['newestMonth']
    if mixed:
        tm_long = f'{NAMES[int(tm[5:]) - 1]} {tm[:4]}'
        check(f'The global means come from GISS\'s table through {tm_long}' in note,
              f'the ask source note does not say the global means come from GISS\'s table through {tm_long}')
    else:
        check('come from GISS\'s table through' not in note, 'the ask source note names a newer table, but there is none')
    said = [t for t in strings(ask) if ATTRIBUTED.search(t)]
    check(not said, f'an ask string attributes a statement to NASA: {said[0][:60]!r}' if said else '')
    ok(f'ask notes: the source note carries NASA\'s AI clause{" and the newer table (" + tm + ")" if mixed else ""}; '
       'no string attributes a statement to NASA')
    ab = len(json.dumps(ask, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
    check(len(ask) <= ASK_ROWS and ab <= ASK_BYTES, f'ask {len(ask)} rows {ab:,} B')
    ok(f'ask: {n_notes} notes, {len(steps)} year rows matching their steps, {len(ask) - 6 - len(steps)} month rows; '
       f'{len(ask)} rows ≤ {ASK_ROWS}, {ab:,} B ≤ {ASK_BYTES:,}')
    # ---- text, sizes, nothing unclaimed
    n = 0
    for s in strings([snap['source'], snap['release'], snap['layers'], [x['label'] for x in steps + months],
                      snap['sources'], ask]):
        n += 1
        check(unicodedata.normalize('NFC', s) == s and not re.search(r'[\x00-\x1f\x7f]', s) and not VENDORS.search(s)
              and not ATTRIBUTED.search(s) and (s == rel['history'] or not re.search(r'\d (°C|km|%)', s)), f'text {s[:60]!r}')
    check(len(data) <= BUDGET, f'{len(data):,} B over {BUDGET:,}')
    if os.path.abspath(path) == os.path.abspath(os.path.join(APP, 'data', 'snapshot.json')):
        others = sorted(set(os.listdir(os.path.dirname(path))) - {'snapshot.json'})
        check(not others, f'data/ holds unclaimed files: {others}')
    ok(f'text: {n} strings NFC, no control characters, no AI vendor names, U+202F before every °C, km and % (GISS\'s '
       f'history attribute verbatim); size {len(data):,} B ≤ {BUDGET:,} '
       f'({len(zlib.compress(data, 6)):,} B deflated); nothing else in data/')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('snapshot', nargs='?', default=os.path.join(APP, 'data', 'snapshot.json'))
    ap.add_argument('--grid', default='')
    ap.add_argument('--table', default='')
    ap.add_argument('--now', default='', help='the date for the freshness check (YYYY-MM-DD; tests only)')
    a = ap.parse_args(argv)
    try:
        run(a)
    except Fail as e:
        print(f'FAIL  {e}', flush=True)
        return 1
    print('verify_snapshot: all checks passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
