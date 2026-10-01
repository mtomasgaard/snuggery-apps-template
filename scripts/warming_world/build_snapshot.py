#!/usr/bin/env python3
"""Build warming-world/data/snapshot.json from NASA GISS's GISTEMP v4 grid and global-mean table,
exactly as warming-world/tools/CONTRACT.md §3 lays it out, check it (§8.1, V1–V13), and write it
only if every check passes. This is the monthly refresh's code: refresh.py (what the workflow runs)
is this file's main() under the contract's name.

    .venv/bin/python build_snapshot.py --source research --ref     # the demo snapshot on main, from the
                                                                   # Internet Archive pins (cache-first)
    .venv/bin/python build_snapshot.py --source research --offline # the same, never touching the network
    python3 refresh.py --out out/warming-world/data/snapshot.json --skip-release "$PUBLISHED"
                                                                   # the workflow: GISS's live files

Modes (CONTRACT §10):
  live      GET the table, then the grid, one at a time with a 2 s pause (GISS refused a second
            connection while the first streamed), into cache/live/ with their headers in
            cache/live/meta.json; a dropped grid transfer resumes. V7 asks the grid and the table
            to end in the same month, V8 that the newest month ended at most 60 days ago.
  research  the pinned Internet Archive copies (sources.GISTEMP_RESEARCH), sha256-checked: the
            August 2026 grid and the September 2026 table, read while data.giss.nasa.gov refused
            connections. release.mode says "research", sources[].via names the capture, V8 is
            skipped, and V7 lets the table be one month newer (only the grid's months are used).

Options: --skip-release ID (write nothing when this release is the one already published; V8 is
checked first, so a stale GISS still fails red), --force, --out PATH, --ref (also write
warming-world/tools/ref/snapshot_ref.json and the credits fragment credits/fragments/gistemp.json),
--generated-at ISO (fixed stamp, for byte-identical rebuilds), --offline.

Standard library + requests (common.py) only: no numpy. Measured on this Mac on 2026-10-01: a
research build from the cache, 1 759 months, takes about 2 s (`time`).
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import math
import os
import random
import re
import sys
import time
import unicodedata
import zlib

import gistemp as G
from common import BuildError, fetch_pinned, http_get, log, sha256_bytes, sha256_of, write_json
from paths import APP, CACHE, HERE
from sources import CITED, GISTEMP, GISTEMP_RESEARCH

DEFAULT_OUT = os.path.join(APP, 'data', 'snapshot.json')
REF_OUT = os.path.join(APP, 'tools', 'ref', 'snapshot_ref.json')
FRAGMENTS = os.path.join(HERE, 'credits', 'fragments')
LIVE = os.path.join(CACHE, 'live')
GRID_FILE = 'gistemp1200_GHCNv4_ERSSTv5.nc.gz'
TABLE_FILE = 'GLB.Ts+dSST.csv'

BUDGET = 1_500_000                # CONTRACT §7
ASK_ROWS, ASK_BYTES = 200, 70_000   # 60 000 in the contract's first draft: see its Builder's decisions
MAX_LAYERS = 256
REF_BUDGET = 20_000
FRESH_DAYS = 60                   # V8
SEED = 20260930                   # CONTRACT §9
TOP_KEYS = ['schema', 'app', 'generatedAt', 'source', 'release', 'grid', 'encoding', 'layers', 'annual',
            'steps', 'months', 'sources', 'ask']
VENDORS = re.compile(r'\b(Claude|Anthropic|OpenAI|ChatGPT|GPT-\d|Gemini|Copilot|Llama|Mistral|Bard)\b')
CONTROL = re.compile(r'[\x00-\x1f\x7f]')
# NASA's guidance for AI products (credits/nasa-media-guidelines.txt): Snuggery's Ask, an on-device model,
# answers from the ask rows, so no string may attribute a statement to NASA. Naming the data's source as a
# fact ("Data: NASA GISS …") is allowed.
ATTRIBUTED = re.compile(r'\baccording to (NASA|GISS)\b|\b(NASA|GISS)(\'s)? (says|said|states|stated|reports|'
                        r'reported|confirms|confirmed|finds|found|shows|showed)\b', re.I)
SI_GAP = re.compile(r'\d (°C|km|%)')   # a plain space where U+202F belongs (DESIGN §2); GISS's history is exempt
CAP_ROWS = 13                     # the pole readings: 13 rows of 2° from each pole (js/app.js CAP_ROWS)
CAP_EDGE = 90 - 2 * CAP_ROWS      # 64° N and 64° S
NNBSP = ' '

SOURCE = {
    'name': 'NASA GISS Surface Temperature Analysis, version 4 (GISTEMP v4)',
    'detail': 'Land-Ocean Temperature Index, 1\u202f200\u202fkm smoothing, GHCN-monthly v4 stations and ERSST v5 '
              'sea surface, 2° cells; annual means and 0.1\u202f°C rounding by this app',
    'licence': 'Public domain in the United States (US Government work, 17 U.S.C. §105); GISS asks for '
               'a citation',
    'attribution': GISTEMP['attribution'],
}
GRID = {'nx': 180, 'ny': 90, 'lon0': -179, 'lat0': 89, 'dlon': 2, 'dlat': -2, 'cells': True}
ENCODING = {
    'value': 'offset + step * byte, per plane, as `layers` says; byte 255 = no data',
    'order': 'row-major from lat0 southwards, lon0 eastwards, one byte per 2° cell',
    'compression': 'deflate',
    'delta': 'none',
    'none': 255,
}
PLANE = {'offset': -12.7, 'step': 0.1, 'power': 1, 'unit': '°C', 'none': 255}
ANNUAL = {'minMonths': G.MIN_MONTHS, 'partialMinMonths': G.PARTIAL_MIN_MONTHS,
          'partialCellShare': G.PARTIAL_SHARE, 'rounding': 'half away from zero, from integer hundredths'}


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def iso(moment: dt.datetime) -> str:
    return moment.strftime('%Y-%m-%dT%H:%M:%SZ')


def pct(x: float) -> str:
    """'82.7 %' with U+202F, the apps' SI rule (DESIGN §2)."""
    return f'{x * 100:.1f}{NNBSP}%'


# ---------------------------------------------------------------------------------------------
# inputs
# ---------------------------------------------------------------------------------------------

def read_inputs(source: str, offline: bool) -> tuple[bytes, bytes, dict, dict]:
    """(grid gz bytes, table bytes, grid meta, table meta). meta: url, via, bytes, sha256,
    lastModified, readAt."""
    if source == 'research':
        metas, blobs = {}, {}
        for key in ('grid', 'table'):
            pin = GISTEMP_RESEARCH[key]
            path = os.path.join(CACHE, pin['name'])
            if offline and not os.path.exists(path):
                raise BuildError(f'offline and the research {key} is not cached ({path}); run once without --offline')
            path = fetch_pinned(pin['url'], pin['name'], pin['sha256'], pin['bytes'])
            with open(path, 'rb') as f:
                blobs[key] = f.read()
            metas[key] = {'url': GISTEMP['url'] if key == 'grid' else GISTEMP['table_url'], 'via': pin['via'],
                          'bytes': len(blobs[key]), 'sha256': sha256_bytes(blobs[key]),
                          'lastModified': None, 'readAt': pin['read_at'], 'path': path}
            log(f'  research {key}: {len(blobs[key]):,} B sha256 {metas[key]["sha256"][:16]}… ({pin["via"]})')
        return blobs['grid'], blobs['table'], metas['grid'], metas['table']

    meta_path = os.path.join(LIVE, 'meta.json')
    gpath, tpath = os.path.join(LIVE, GRID_FILE), os.path.join(LIVE, TABLE_FILE)
    if offline:
        if not (os.path.exists(meta_path) and os.path.exists(gpath) and os.path.exists(tpath)):
            raise BuildError('offline and cache/live/ holds no complete live read; run once without --offline')
        with open(meta_path, encoding='utf-8') as f:
            meta = json.load(f)
    else:
        os.makedirs(LIVE, exist_ok=True)
        meta = {}
        # A .part left by an earlier session may belong to an older release; resuming it against a
        # newer file would splice two files (gzip's CRC would catch it, but loudly and late).
        part = gpath + '.part'
        if os.path.exists(part) and time.time() - os.path.getmtime(part) > 6 * 3600:
            log(f'  removing a stale partial download ({os.path.getsize(part):,} B, over 6 h old)')
            os.remove(part)
        for key, url, path in (('table', GISTEMP['table_url'], tpath), ('grid', GISTEMP['url'], gpath)):
            headers = {}
            if key == 'table':
                body = http_get(url, headers_out=headers)
                with open(path + '.tmp', 'wb') as f:
                    f.write(body)
                os.replace(path + '.tmp', path)
            else:
                time.sleep(2)                       # one connection at a time (RESEARCH §3)
                http_get(url, stream_to=path, headers_out=headers)
            meta[key] = {'url': url, 'via': None, 'lastModified': headers.get('Last-Modified'),
                         'readAt': iso(utc_now())}
        with open(meta_path + '.tmp', 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=1, sort_keys=True)
        os.replace(meta_path + '.tmp', meta_path)
    out = []
    for key, path in (('grid', gpath), ('table', tpath)):
        with open(path, 'rb') as f:
            b = f.read()
        m = dict(meta[key], bytes=len(b), sha256=sha256_bytes(b), path=path)
        out += [b, m]
        log(f'  live {key}: {len(b):,} B sha256 {m["sha256"][:16]}… Last-Modified {m["lastModified"]}')
    return out[0], out[2], out[1], out[3]


# ---------------------------------------------------------------------------------------------
# building
# ---------------------------------------------------------------------------------------------

def plane(frame_bytes: bytes) -> str:
    return base64.b64encode(zlib.compress(frame_bytes, 9)).decode('ascii')


def step_record(head: dict, f: G.Frame, st: dict, fb: bytes) -> dict:
    rec = dict(head)
    rec['gridMean'] = round(st['mean'], 3)
    rec['coverage'] = {'area': round(st['area'], 4), 'cells': round(st['cellShare'], 4)}
    rec['beyondScale'] = {'above': st['above'], 'below': st['below']}
    rec['planes'] = {'anom.v': plane(fb)}
    return rec


def cap_mean(tenths: list, north: bool) -> float | None:
    """The app's pole reading (js/data.js capMean), from the frame's own 0.1 °C values, so Ask and the
    pole chip agree to the hundredth: the cells with a value in the CAP_ROWS rows nearest the pole,
    weighted by cos latitude, summed in capMean's order with its weights, and rounded as it rounds
    (hundredths, half away from zero, a tie within 1e-9 counted as a tie: a cap with values in one row
    only has an exact half-hundredth mean that floating point lands a hair below, 1888 south of 64° S
    at 0.175 °C). None when no cell of the cap has a value. verify_snapshot.py recomputes it from the
    shipped frames."""
    s = w = 0.0
    for r in range(CAP_ROWS):
        row = r if north else G.NY - 1 - r
        wt = math.cos(((89 - 2 * row) * math.pi) / 180)          # capMean's expression, operation for operation
        base = row * G.NX
        for c in range(G.NX):
            q = tenths[base + c]
            if q is not None:
                s += wt * q
                w += wt
    if not w:
        return None
    x = abs(s) / w * 10
    h = math.floor(x)
    if x - h >= 0.5 - 1e-9:                                       # capMean's rule, on |s|: away from zero
        h += 1
    return (h if s > 0 else -h) / 100


def ask_figures(f: G.Frame, st: dict) -> dict:
    hi, lo = st['hi'], st['lo']
    return {
        'north64AnomalyC': cap_mean(f.tenths, True),               # the map's 0.1 °C cells, as the pole chip
        'south64AnomalyC': cap_mean(f.tenths, False),
        'coveragePercentOfSurface': round(round(st['area'], 4) * 100, 1),   # coverage.area × 100 (CONTRACT §3.8)
        'cellsWithData': st['cells'],
        'cellsAbove4C': st['above'], 'cellsBelowMinus4C': st['below'],
        'warmestCellC': None if hi is None else f.tenths[hi] / 10,
        'warmestCell': None if hi is None else G.cell_bounds(hi),
        'coldestCellC': None if lo is None else f.tenths[lo] / 10,
        'coldestCell': None if lo is None else G.cell_bounds(lo),
    }


def build(grid: G.Grid, table: G.Table, gmeta: dict, tmeta: dict, mode: str, generated_at: str):
    """Returns (snapshot dict, frames list aligned with steps + months, Frame objects, report)."""
    T = len(grid.months)
    by_year: dict[int, list[int]] = {}
    for t, ym in enumerate(grid.months):
        by_year.setdefault(int(ym[:4]), []).append(t)
    newest_year = int(grid.newest[:4])
    n_new = len(by_year[newest_year])
    last_complete = newest_year if n_new == 12 else newest_year - 1
    partial = n_new if G.PARTIAL_MIN_MONTHS <= n_new <= 11 else 0
    month_ts = list(range(max(0, T - 24), T))
    grid.keep(month_ts)

    steps, frames, objs = [], [], []
    t0 = time.time()
    years = list(range(1880, last_complete + 1)) + ([newest_year] if partial else [])
    for y in years:
        ts = by_year[y]
        n = len(ts)
        f = G.annual_frame([grid.frame(t) for t in ts], G.min_months(n))
        st = G.stats(f)
        fb = f.bytes()
        if n == 12:
            jd = table.jd.get(y)
            if jd is None:
                raise BuildError(f'V7 the table has no J-D for {y}, a complete year in the grid')
            gm, label = jd / 100, str(y)
        else:
            hs = table.months.get(y, [None] * 12)[:n]
            if any(h is None for h in hs):
                raise BuildError(f'V7 the table lacks one of {y}\'s first {n} months')
            gm = G.round_div(sum(hs), n) / 100
            label = f'{y}, Jan–{G.MON[n - 1]} (partial)'
        head = {'year': y, 'label': label, 'months': n, 'partial': n != 12, 'globalMean': round(gm, 2)}
        steps.append(step_record(head, f, st, fb))
        frames.append(fb)
        objs.append((f, st))
    log(f'  annual: {len(steps)} steps ({years[0]}–{years[-1]}{", partial " + str(newest_year) if partial else ""}) '
        f'in {time.time() - t0:.1f} s')

    months = []
    for t in month_ts:
        ym = grid.months[t]
        h = table.month(ym)
        if h is None:
            raise BuildError(f'V7 the table has no value for {ym}, a month in the grid')
        f = G.month_frame(grid.frame(t))
        st = G.stats(f)
        fb = f.bytes()
        head = {'month': ym, 'label': G.month_label(ym), 'globalMean': round(h / 100, 2)}
        months.append(step_record(head, f, st, fb))
        frames.append(fb)
        objs.append((f, st))

    lo = min(q for f, _ in objs[:len(steps)] for q in f.tenths if q is not None)
    hi = max(q for f, _ in objs[:len(steps)] for q in f.tenths if q is not None)
    layers = [{
        'key': 'anom', 'label': 'Temperature anomaly', 'kind': 'scalar', 'unit': '°C', 'base': '1951-1980',
        'level': 'surface: air over land and sea ice, sea surface over open water',
        'field': 'tempanomaly',
        'range': [round(lo / 10, 1), round(hi / 10, 1)],
        'planes': {'v': dict(PLANE)},
    }]

    retrieved = gmeta['readAt'][:10]
    created = grid.created
    release = {
        'id': f'{grid.newest}/{created}',
        'created': created,
        'history': grid.history,
        'firstMonth': grid.months[0], 'newestMonth': grid.newest, 'monthCount': T,
        'tableNewestMonth': table.newest,
        'base': '1951-1980',
        'mode': mode,
        'retrieved': retrieved,
    }
    citation = [c.format(year=retrieved[:4], accessed=retrieved) for c in GISTEMP['citation']]
    sources = [
        {'id': 'gistemp-grid',
         'name': f'GISTEMP v4 Land-Ocean Temperature Index, 1{NNBSP}200{NNBSP}km smoothing ({GRID_FILE})',
         'owner': 'NASA Goddard Institute for Space Studies',
         'licence': GISTEMP['licence'], 'attribution': GISTEMP['attribution'],
         'citation': citation,
         'url': gmeta['url'], 'via': gmeta['via'], 'bytes': gmeta['bytes'], 'sha256': gmeta['sha256'],
         'lastModified': gmeta['lastModified'], 'readAt': gmeta['readAt'],
         'note': 'NASA does not endorse this app.'},
        {'id': 'gistemp-table',
         'name': f'GISTEMP v4 global means ({TABLE_FILE})',
         'owner': 'NASA Goddard Institute for Space Studies',
         'licence': GISTEMP['licence'], 'attribution': GISTEMP['attribution'],
         'use': 'the stripes and the global-mean figures',
         'url': tmeta['url'], 'via': tmeta['via'], 'bytes': tmeta['bytes'], 'sha256': tmeta['sha256'],
         'lastModified': tmeta['lastModified'], 'readAt': tmeta['readAt']},
    ]

    # ask (CONTRACT §3.8): notes, then years, then months; months trimmed from the oldest
    first_cov = steps[0]['coverage']['area']
    lc = next(s for s in steps if s['year'] == last_complete)
    via_note = ' Read from the Internet Archive\'s copies of GISS\'s files.' if mode == 'research' else ''
    # a research build's table is a release newer than its map (V7): said, with the month computed
    table_note = (f' The global means come from GISS\'s table through {G.month_label(table.newest)}, a newer '
                  'release than the map\'s; only the map\'s months are used.' if table.newest > grid.newest else '')
    # NASA's guidance for AI products: outputs are the product's, never NASA's (credits/nasa-media-guidelines.txt)
    ai_note = (' Answers drawn from these rows are this app\'s reading of GISS\'s published data; NASA has not '
               'reviewed them and is not responsible for their accuracy.')
    if partial:
        ps = steps[-1]
        partial_text = (f'{ps["year"]} is partial: the mean of {ps["months"]} published months '
                        f'(Jan–{G.MON[ps["months"] - 1]}), not comparable cell by cell with full years.')
    else:
        partial_text = (f'No partial year is included; {newest_year}\'s months so far are in the month rows.')
    notes = [
        ('anomaly', 'Every value is a temperature anomaly: the difference from the same place\'s 1951–1980 '
                    'average for the same months, in °C. It is not a temperature.'),
        ('source', f'Data: NASA GISS Surface Temperature Analysis (GISTEMP v4), 1{NNBSP}200{NNBSP}km Land-Ocean grid, '
                   f'2° cells, release created {created[:10]}, newest month {G.month_label(grid.newest)}.{table_note} '
                   f'Annual means and 0.1{NNBSP}°C rounding are this app\'s. NASA does not endorse this app.'
                   f'{via_note}{ai_note}'),
        ('smoothing', f'A weather station\'s anomaly is spread over every cell within 1{NNBSP}200{NNBSP}km, and over '
                      'ice-free ocean the value is a sea-surface anomaly (NOAA ERSST v5). A colored cell need '
                      'not contain a thermometer.'),
        ('coverage', f'Cells with no estimate are null, not zero. Data covered {pct(first_cov)} of Earth\'s '
                     f'surface in {steps[0]["year"]} and {pct(lc["coverage"]["area"])} in {last_complete}.'),
        ('partial', partial_text),
        ('figures', f'globalAnomalyC is GISS\'s own global mean (GLB.Ts+dSST.csv). north64AnomalyC and '
                    f'south64AnomalyC are this app\'s area-weighted means of the map\'s cells with data north of '
                    f'{CAP_EDGE}° N and south of {CAP_EDGE}° S, as its Arctic and Antarctic readings show them, not '
                    'GISS\'s zonal means. The warmest and coldest cells are this app\'s too, from the map\'s cells.'),
    ]
    ask = [{'kind': 'note', 'topic': tp, 'text': tx} for tp, tx in notes]
    for s, (f, st) in zip(steps, objs[:len(steps)]):
        row = {'kind': 'year', 'year': s['year'], 'months': s['months'], 'partial': s['partial'],
               'globalAnomalyC': s['globalMean']}
        row.update(ask_figures(f, st))
        ask.append(row)
    month_rows = []
    for m, (f, st) in zip(months, objs[len(steps):]):
        row = {'kind': 'month', 'month': m['month'], 'globalAnomalyC': m['globalMean']}
        fig = ask_figures(f, st)
        fig.pop('cellsWithData')
        row.update(fig)
        month_rows.append(row)
    room = ASK_ROWS - len(ask)
    ask += month_rows[max(0, len(month_rows) - room):] if room > 0 else []

    snap = {
        'schema': 1, 'app': 'Warming World', 'generatedAt': generated_at,
        'source': dict(SOURCE), 'release': release, 'grid': dict(GRID), 'encoding': dict(ENCODING),
        'layers': layers, 'annual': dict(ANNUAL), 'steps': steps, 'months': months,
        'sources': sources, 'ask': ask,
    }
    report = {'objs': objs, 'last_complete': last_complete, 'partial': partial, 'newest_year': newest_year,
              'n_new': n_new}
    return snap, frames, report


# ---------------------------------------------------------------------------------------------
# validation (CONTRACT §8.1)
# ---------------------------------------------------------------------------------------------

def _strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from _strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from _strings(v)


def validate(snap: dict, frames: list[bytes], report: dict, table: G.Table, grid: G.Grid, data: bytes):
    steps, months = snap['steps'], snap['months']
    # V3 shape
    if any(len(b) != G.N for b in frames):
        raise BuildError('V3 a frame is not 16 200 bytes')
    years = [s['year'] for s in steps]
    want = list(range(1880, report['last_complete'] + 1)) + ([report['newest_year']] if report['partial'] else [])
    if years != want:
        raise BuildError(f'V3 steps run {years[0]}…{years[-1]} ({len(years)}), expected {want[0]}…{want[-1]}')
    if [s['partial'] for s in steps] != [False] * (len(steps) - bool(report['partial'])) + [True] * bool(report['partial']):
        raise BuildError('V3 only the last step may be partial, exactly when the newest year has 6–11 months')
    ms = [m['month'] for m in months]
    if len(ms) != 24 or ms[-1] != snap['release']['newestMonth'] or any(
            b != G._next_month(a) for a, b in zip(ms, ms[1:])):
        raise BuildError(f'V3 months are not the 24 consecutive months ending at the newest: {ms[:2]}…{ms[-1:]}')
    if len(steps) + len(months) > MAX_LAYERS:
        raise BuildError(f'V3 {len(steps) + len(months)} layers exceed {MAX_LAYERS}')
    print(f'V3 shape: {len(steps)} steps {years[0]}–{years[-1]}, {len(months)} months {ms[0]}–{ms[-1]}, '
          f'{len(frames)} frames of {G.N} B, layers {len(frames)} ≤ {MAX_LAYERS}')
    # V4 orientation: snapshot row 0 is the source's last row (lat 89), after the rule
    src_lat = grid.nc.read('lat')
    if abs(src_lat[-1] - 89) > 1e-4 or abs(src_lat[0] + 89) > 1e-4:
        raise BuildError('V4 the source latitudes are not −89 … 89')
    # Row 0 against the source's last row, for 1880 and for the newest complete year (whose
    # Arctic row has data, so the test cannot pass on two rows of nothing).
    lc_i = report['last_complete'] - 1880
    msg = []
    for li, t0 in ((0, 0), (lc_i, 12 * lc_i)):
        src = [grid.source_frame(t) for t in range(t0, t0 + 12)]
        expect = []
        for i in range(G.NX):
            vs = [src[t][(G.NY - 1) * G.NX + i] for t in range(12)]
            vs = [v for v in vs if v != G.FILL]
            expect.append(G.round_div(sum(vs), 10 * len(vs)) if len(vs) >= G.MIN_MONTHS else None)
        if report['objs'][li][0].tenths[:G.NX] != expect:
            raise BuildError(f'V4 the {1880 + li} frame\'s row 0 is not the source\'s northernmost row (lat 89)')
        msg.append(f'{1880 + li} ({sum(v is not None for v in expect)} of 180 cells with data)')
    print(f'V4 orientation: row 0 equals source row 89 (lat {src_lat[-1]:.0f}) under the rule in ' + ' and '.join(msg))
    # V5 no clipping (frame.bytes() already raised on any value beyond ±12.7)
    allq = [q for f, _ in report['objs'] for q in f.tenths if q is not None]
    print(f'V5 no clipping: every tenth within −127…127 (min {min(allq) / 10:+.1f}, max {max(allq) / 10:+.1f} °C '
          f'over all {len(frames)} frames); annual range {snap["layers"][0]["range"]}')
    # V6 GISS's own table
    worst, worst_y, sq, n = 0.0, None, 0.0, 0
    for s, (f, st) in zip(steps, report['objs']):
        if s['partial']:
            continue
        d = st['mean'] - table.jd[s['year']] / 100
        sq += d * d
        n += 1
        if abs(d) > abs(worst):
            worst, worst_y = d, s['year']
    rms = (sq / n) ** 0.5
    if abs(worst) > 0.05:
        raise BuildError(f'V6 the grid\'s {worst_y} global mean differs from GISS\'s J-D by {worst:+.3f} °C (> 0.05)')
    mworst, mworst_m = 0.0, None
    for m, (f, st) in zip(months, report['objs'][len(steps):]):
        d = st['mean'] - m['globalMean']
        if abs(d) > abs(mworst):
            mworst, mworst_m = d, m['month']
    print(f'V6 GISS\'s table: {n} complete years, max |gridMean − J-D| {abs(worst):.3f} °C ({worst_y}), '
          f'RMS {rms:.4f} (limit 0.05); the 24 months, printed only: max {abs(mworst):.3f} ({mworst_m})')
    # V7 and V8 ran before the build (main)
    # V9 coverage sanity
    cov = {s['year']: s['coverage']['area'] for s in steps}
    lc = cov[report['last_complete']]
    if lc < 0.98 or not 0.70 <= cov[1880] <= 0.95 or min(cov.values()) < 0.60:
        raise BuildError(f'V9 coverage: {report["last_complete"]} {lc}, 1880 {cov[1880]}, minimum {min(cov.values())}')
    print(f'V9 coverage (area): 1880 {cov[1880]:.4f}, {report["last_complete"]} {lc:.4f}, minimum '
          f'{min(cov.values()):.4f} ({min(cov, key=cov.get)})')
    # V10 none means none
    for b, (f, _) in zip(frames, report['objs']):
        nones = sum(q is None for q in f.tenths)
        if b.count(G.NONE) != nones or any((x == G.NONE) != (q is None) for x, q in zip(b, f.tenths)):
            raise BuildError('V10 a frame\'s 255 bytes are not exactly its cells without data')
    print('V10 none means none: in every frame the 255 bytes are exactly the cells failing their rule')
    # V11 sizes
    ask_bytes = len(json.dumps(snap['ask'], ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
    if len(data) > BUDGET or len(snap['ask']) > ASK_ROWS or ask_bytes > ASK_BYTES:
        raise BuildError(f'V11 sizes: snapshot {len(data):,} B (cap {BUDGET:,}), ask {len(snap["ask"])} rows '
                         f'(cap {ASK_ROWS}) {ask_bytes:,} B (cap {ASK_BYTES:,})')
    print(f'V11 sizes: snapshot {len(data):,} B ≤ {BUDGET:,}; deflated (zlib 6) {len(zlib.compress(data, 6)):,} B; '
          f'ask {len(snap["ask"])} rows ≤ {ASK_ROWS}, {ask_bytes:,} B ≤ {ASK_BYTES:,}')
    # V12 round trip
    back = json.loads(data.decode('utf-8'))
    if list(back) != TOP_KEYS:
        raise BuildError(f'V12 top-level keys {list(back)}, expected {TOP_KEYS}')
    for i, s in enumerate(back['steps'] + back['months']):
        if zlib.decompress(base64.b64decode(s['planes']['anom.v'])) != frames[i]:
            raise BuildError(f'V12 plane {i} does not round-trip')
    print(f'V12 round trip: the serialized file parses, keys in order, all {len(frames)} planes inflate to '
          'the frames in memory')
    # V13 text
    count = 0
    for s in _strings([snap['source'], snap['release'], snap['layers'], [x['label'] for x in steps + months],
                       snap['sources'], snap['ask']]):
        count += 1
        if unicodedata.normalize('NFC', s) != s or CONTROL.search(s) or VENDORS.search(s):
            raise BuildError(f'V13 text not NFC, with a control character, or naming a vendor: {s[:80]!r}')
        if ATTRIBUTED.search(s):
            raise BuildError(f'V13 a string attributes a statement to NASA (NASA\'s AI guidance): {s[:80]!r}')
        if s != snap['release']['history'] and SI_GAP.search(s):
            raise BuildError(f'V13 a plain space between a number and its unit, where U+202F belongs: {s[:80]!r}')
    print(f'V13 text: {count} strings NFC, no control characters, no AI vendor names, no statement attributed '
          'to NASA, U+202F before every °C, km and %')


# ---------------------------------------------------------------------------------------------
# the decoder reference (CONTRACT §9) and the credits fragment
# ---------------------------------------------------------------------------------------------

def write_ref(snap: dict, report: dict):
    names = [str(s['year']) for s in snap['steps']] + [m['month'] for m in snap['months']]
    objs = report['objs']

    def cell(li, j, i):
        q = objs[li][0].tenths[j * G.NX + i]
        return {'step': names[li], 'row': j, 'col': i, 'c': None if q is None else q / 10}

    rng = random.Random(SEED)
    cells = [cell(rng.randrange(len(names)), rng.randrange(G.NY), rng.randrange(G.NX)) for _ in range(60)]
    lc = names.index(str(report['last_complete']))
    f = objs[lc][0]
    warm = max(range(G.N), key=lambda k: (-1e9 if f.tenths[k] is None else f.tenths[k], -k))
    for li, j, i in ((lc, 12, 16), (0, 12, 16),            # the Fairbanks cell, 64–66° N, 148–146° W
                     (lc, 89, 90), (0, 89, 90),            # 88–90° S, 0–2° E
                     (lc, 44, 0),                          # 0–2° N, 180–178° W
                     (lc, warm // G.NX, warm % G.NX)):     # the warmest cell of the newest complete year
        cells.append(cell(li, j, i))
    ref = {'release': snap['release']['id'], 'generatedAt': snap['generatedAt'], 'cells': cells,
           'partialLabel': snap['steps'][-1]['label'] if snap['steps'][-1]['partial'] else None,
           'counts': {'steps': len(snap['steps']), 'months': len(snap['months'])}}
    write_json(REF_OUT, ref, max_bytes=REF_BUDGET, keep_stamp=False)   # the demo's stamp (CONTRACT §9), never an older one


def write_fragment(snap: dict):
    """credits/fragments/gistemp.json: the GISTEMP block of CREDITS.txt, written by the step that
    reads GISTEMP (Milky Way's fragment rule), so the demo's access date and release are the ones
    the demo snapshot carries. build_static.py assembles CREDITS.txt from the fragments."""
    g = snap['sources'][0]
    frag = {
        'id': 'gistemp',
        'title': 'NASA GISS Surface Temperature Analysis, version 4 (GISTEMP v4)',
        'owner': g['owner'],
        'what': (f'The map, the tap card and the year row: the 1{NNBSP}200{NNBSP}km Land-Ocean Temperature Index on a 2° grid '
                 f'({GRID_FILE}). The stripes and the global means: GISS\'s own table ({TABLE_FILE}).'),
        'url': [GISTEMP['url'], GISTEMP['table_url'], GISTEMP['page']],
        'via': ([f'the grid: {g["via"].replace("the URL above", g["url"])}',
                 f'the table: {snap["sources"][1]["via"].replace("the URL above", snap["sources"][1]["url"])}']
                if g['via'] else None),
        'release': snap['release']['id'],
        'accessed': snap['release']['retrieved'],
        'licence': g['licence'],
        'attribution': g['attribution'],
        'citation': g['citation'],
        'changes': (f'Annual means of each 2° cell (a year needs 9 of its 12 months; the partial year three '
                    f'quarters of its published months), rounded to 0.1{NNBSP}°C half away from zero; rows reordered '
                    f'north first; the newest 24 months rounded to 0.1{NNBSP}°C. Nothing interpolated or filled.'),
        'endorsement': 'NASA does not endorse this app. It uses NASA\'s published data, as NASA\'s media '
                       'guidelines allow for factual use. No NASA insignia or logotype is used.',
        'inputs': [CITED['ghcnm_v4']['citation'], CITED['ersst_v5']['citation'], CITED['hansen2010']['citation']],
    }
    write_json(os.path.join(FRAGMENTS, 'gistemp.json'), frag, max_bytes=10_000)


# ---------------------------------------------------------------------------------------------

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--source', choices=['live', 'research'], default='live')
    ap.add_argument('--offline', action='store_true', help='never touch the network; use the cache')
    ap.add_argument('--skip-release', default='', help='write nothing when this release id is the newest')
    ap.add_argument('--force', action='store_true', help='ignore --skip-release')
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('--ref', action='store_true', help='also write tools/ref/snapshot_ref.json and the credits fragment')
    ap.add_argument('--generated-at', default='', help='a fixed generatedAt (ISO, Z), for byte-identical rebuilds')
    ap.add_argument('--now', default='', help='the run\'s UTC date for V8 (YYYY-MM-DD; tests only)')
    a = ap.parse_args(argv)
    t0 = time.time()
    gz, csvb, gmeta, tmeta = read_inputs(a.source, a.offline)
    grid = G.read_grid(gz)
    print(f'V1 the file\'s contract: CDF-1, tempanomaly int16 ×0.01 fill 32767 K, 90 × 180 cells south-first, '
          f'{len(grid.months)} months {grid.months[0]}–{grid.newest}; {grid.history}')
    table = G.read_table(csvb)
    print(f'V2 the table: 1880–{max(table.months)}, newest month {table.newest}')
    # V7 the same release
    if a.source == 'live':
        if table.newest != grid.newest:
            raise BuildError(f'V7 the table ends {table.newest} and the grid {grid.newest}: not the same release')
    elif table.newest not in (grid.newest, G._next_month(grid.newest)):
        raise BuildError(f'V7 (research) the table ends {table.newest}, the grid {grid.newest}')
    print(f'V7 same release: grid {grid.newest}, table {table.newest}'
          + (' (research mode: the table may be one month newer; only the grid\'s months are used)'
             if a.source == 'research' else ''))
    # V8 freshness, before the skip, so a GISS that stopped publishing fails red
    today = dt.date.fromisoformat(a.now) if a.now else utc_now().date()
    nm = G._next_month(grid.newest)
    age = (today - dt.date(int(nm[:4]), int(nm[5:7]), 1)).days
    if a.source == 'live':
        if age > FRESH_DAYS:
            raise BuildError(f'V8 the newest month {grid.newest} ended {age} days before {today} (limit {FRESH_DAYS}): '
                             'GISS has missed releases; nothing is published')
        print(f'V8 freshness: {grid.newest} ended {age} days before {today} (limit {FRESH_DAYS})')
    else:
        print(f'V8 freshness: skipped in research mode ({grid.newest} ended {age} days before {today})')
    rid = f'{grid.newest}/{grid.created}'
    if a.skip_release and a.skip_release == rid and not a.force:
        print(f'release {rid} is already published; nothing written')
        return 0
    generated_at = a.generated_at or iso(utc_now())
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', generated_at):
        raise BuildError(f'--generated-at {generated_at!r} is not YYYY-MM-DDTHH:MM:SSZ')
    snap, frames, report = build(grid, table, gmeta, tmeta, a.source, generated_at)
    data = (json.dumps(snap, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
    validate(snap, frames, report, table, grid, data)
    write_json(a.out, snap, max_bytes=BUDGET)
    with open(a.out, encoding='utf-8') as f:            # write_json keeps an unchanged file's stamp
        snap['generatedAt'] = json.load(f)['generatedAt']
    if a.ref:
        write_ref(snap, report)
        write_fragment(snap)
    print(f'release {rid} ({a.source}); {os.path.getsize(a.out):,} B written to {a.out} in {time.time() - t0:.1f} s')
    return 0


def run(argv=None) -> int:
    try:
        return main(argv)
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        return 1


if __name__ == '__main__':
    sys.exit(run())
