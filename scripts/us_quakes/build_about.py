"""Build us-quakes/assets/about.json, us-quakes/assets/stories.json and us-quakes/CREDITS.txt
(tools/CONTRACT.md §6–8) from content/ (the words), the credits fragments every step wrote
(cache/work/credits/), sources.CREDIT and the shipped assets/history.bin.

    .venv/bin/python build_about.py

The words are in content/about.json and content/stories.json as templates: every {name} is a number
this script computes from the shipped history (decoded exactly as the app decodes it), from
history.json or geo.json, or a rule constant of the pipeline, and the result is written with its
`numbers`. Three refusals keep the text honest:
  - a numeral outside a quotation that is not one of the computed numbers stops the build;
  - a quotation (between curly quotes in a text, or any `quote` field) that is not verbatim in
    credits/usgs-statements.txt stops the build;
  - a story over 70 words, an anchor id not in the history's text table, or an anchor whose
    values disagree with the claim the numbers make stops the build.
"""
import json
import math
import os
import re
import sys
import textwrap
from collections import Counter, OrderedDict

import numpy as np

from common import (BuildError, RETRIEVED, iso_of_minutes, log, minutes_of_date, read_credits_fragments,
                    unwrap_lon, write_json)
from paths import APP, ASSETS, HERE
from sources import COMCAT, CREDIT, CREDIT_ORDER

BUDGET_ABOUT = 40_000
BUDGET_STORIES = 30_000
BUDGET_CREDITS = 40_000
MAX_WORDS = 70
NNBSP = ' '
STEPS = ['fetch_catalog', 'fetch_layers', 'build_history', 'build_relief', 'build_geo']
LIVE_DAYS = 30                  # the snapshot's every-magnitude window (CONTRACT §3.2)
RAMP_STOPS = [0, 10, 35, 70, 150, 300]    # DESIGN §6, ART.md
RIM_KM = 60                     # DESIGN §6: the rim switches from dark to light at 60 km
DOT_BASE_PX, DOT_MIN_PX = 2.2, 2.0   # DESIGN §6, js/ramp.js dotSize: clamp(2.2 · √2^(M − 2.5), 2, 40)
HOLLOW_MIN_M = 4                # js/ramp.js HOLLOW_MIN_M: a hollow ring is never drawn smaller than an M 4 dot
FOREIGN = (('Canada', 'Canada'), ('Mexico', 'Mexico'), ('Russia', 'Russia'), ('Dominican Republic', 'the Dominican Republic'),
           ('British Virgin Islands', 'the British Virgin Islands'), ('Bahamas', 'the Bahamas'), ('Cuba', 'Cuba'), ('Haiti', 'Haiti'))
FONT_FILES = ['atkinson-hyperlegible-latin-400-normal.woff2', 'atkinson-hyperlegible-latin-700-normal.woff2',
              'atkinson-hyperlegible-latin-ext-400-normal.woff2', 'atkinson-hyperlegible-latin-ext-700-normal.woff2',
              'red-hat-mono-latin-500-normal.woff2']


# ---------------------------------------------------------------------------------------------
# formatting: SI, thousands grouped with a narrow no-break space (DESIGN §2)
# ---------------------------------------------------------------------------------------------

def count(n: int) -> str:
    s = str(int(n))
    if len(s) <= 3:
        return s
    parts = []
    while s:
        parts.insert(0, s[-3:])
        s = s[:-3]
    return NNBSP.join(parts)


def deg(v: float) -> str:
    s = f'{v:.3f}'.rstrip('0').rstrip('.')
    return s


def km(v: float) -> str:
    """A depth as the catalog gives it: to the tenth, without a trailing .0 (the 1964 row is \"25\", not \"25.0\")."""
    return f'{v:.1f}'.removesuffix('.0')


def box_numbers(box):
    """(west, south, east, north), west longitudes negative, as the story text names it."""
    w, s, e, n = box
    if w >= 0 or e >= 0:
        raise BuildError(f'box {box}: the text names degrees west')
    return {'boxS': deg(s), 'boxN': deg(n), 'boxW': deg(-w), 'boxE': deg(-e)}


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------------------------------------
# the history, decoded the way the app decodes it
# ---------------------------------------------------------------------------------------------

class History:
    def __init__(self):
        self.meta = load_json(os.path.join(ASSETS, 'history.json'))
        with open(os.path.join(ASSETS, 'history.bin'), 'rb') as f:
            buf = f.read()
        sec = self.meta['sections']
        dt = {'uint32': '<u4', 'uint16': '<u2', 'uint8': 'u1'}
        c = {k: np.frombuffer(buf, dt[sec[k]['type']], sec[k]['count'], sec[k]['offset'])
             for k in ('t', 'x', 'y', 'd', 'm', 'f', 'text_row')}
        self.t, self.x, self.y, self.d, self.m, self.f = (c[k] for k in 't x y d m f'.split())
        self.lon = 172.0 + self.x.astype(np.float64) * 0.002
        self.lat = 17.0 + self.y.astype(np.float64) * 0.001

        def text(k):
            return buf[sec[k]['offset']:sec[k]['offset'] + sec[k]['count']].decode('utf-8').split('\n')
        ids, places = text('id_text'), text('place_text')
        self.row = {i: int(r) for i, r in zip(ids, c['text_row'])}
        self.place = {int(r): p for r, p in zip(c['text_row'], places)}

    def rec(self, eid):
        if eid not in self.row:
            raise BuildError(f'anchor {eid} is not in the history\'s text table')
        i = self.row[eid]
        m, d, t = int(self.m[i]), int(self.d[i]), int(self.t[i])
        iso = iso_of_minutes(t)
        return {'row': i, 'mag': None if m == 255 else f'{(m - 20) / 10:.1f}', 'm': m,
                'depth': None if d == 65535 else km(d / 100 - 5),
                'lat': deg(self.lat[i]), 'lonW': deg(360 - self.lon[i]) if self.lon[i] > 180 else None,
                'date': iso[:10], 'time': iso[11:16], 'year': iso[:4], 't': t,
                'magType': self.meta['magTypes'][int(self.f[i]) >> 2] if int(self.f[i]) >> 2 != 63 else '',
                'status': self.meta['status'][int(self.f[i]) & 3], 'place': self.place[i]}

    def mask(self, box=None, t0=None, t1=None, mmin=None):
        """box = (west, south, east, north) in own longitudes; t0, t1 ISO dates [t0, t1)."""
        k = np.ones(len(self.t), bool)
        if box:
            w, s, e, n = box
            k &= (self.lon >= unwrap_lon(w)) & (self.lon <= unwrap_lon(e)) & (self.lat >= s) & (self.lat <= n)
        if t0:
            k &= self.t >= minutes_of_date(t0)
        if t1:
            k &= self.t < minutes_of_date(t1)
        if mmin is not None:
            k &= (self.m >= round(mmin * 10) + 20) & (self.m != 255)
        return k


def view_box(geo, key):
    for v in geo['views']:
        if v['key'] == key:
            return (v['west'] - 360 if v['west'] > 180 else v['west'], v['south'],
                    v['east'] - 360 if v['east'] > 180 else v['east'], v['north'])
    raise BuildError(f'no view {key} in geo.json')


def catalogue_box(key):
    b = COMCAT['regions'][key]['box']
    w, e = b['minlongitude'], b['maxlongitude']
    return (w - 360 if w > 180 else w, b['minlatitude'], e - 360 if e > 180 else e, b['maxlatitude'])


# ---------------------------------------------------------------------------------------------
# story numbers: each function returns {name: str}, and asserts what the text claims
# ---------------------------------------------------------------------------------------------

def _base(r):
    return {k: r[k] for k in ('mag', 'magType', 'depth', 'lat', 'lonW', 'date', 'time', 'year', 'status') if r[k]}


def n_cascadia(h, geo, s):
    r = h.rec(s['anchors'][0])
    if r['depth'] is not None:
        raise BuildError('cascadia-1700: the text says no depth')
    return _base(r)


def n_new_madrid(h, geo, s):
    k = h.mask(view_box(geo, s['view']), '1811-12-01', '1812-03-01', 7.0)
    rows = np.nonzero(k)[0]
    anchors = [h.rec(e) for e in s['anchors']]
    if sorted(int(v) for v in rows) != sorted(a['row'] for a in anchors):
        raise BuildError(f'new-madrid: the M7+ rows in the view are {rows.tolist()}, not the anchors')
    if any(a['depth'] is not None for a in anchors):
        raise BuildError('new-madrid: the text says none has a depth')
    types = {a['magType'] for a in anchors}
    if len(types) != 1:
        raise BuildError(f'new-madrid: the text gives one magnitude type for all four, the catalog has {sorted(types)}')
    out = {'n7': count(len(rows)), 'seven': '7', 'first': anchors[0]['date'], 'last': anchors[-1]['date'], 'magType': types.pop(),
           **box_numbers(view_box(geo, s['view']))}
    for i, a in enumerate(anchors, 1):
        out[f'm{i}'] = a['mag']
    return out


def n_1906(h, geo, s):
    r = h.rec(s['anchors'][0])
    out = _base(r)
    out['n'] = count(h.mask(view_box(geo, s['view']), '1906-01-01', '1907-01-01', s['floor']).sum())
    out['floor'] = f'{s["floor"]:.1f}'
    out.update(box_numbers(view_box(geo, s['view'])))
    return out


def n_1964(h, geo, s):
    r = h.rec(s['anchors'][0])
    out = _base(r)
    k = h.mask(catalogue_box('ak'), '1964-01-01', '1965-01-01', s['floor'])
    out['n'] = count(k.sum())
    out['nAfter'] = count((k & (h.t >= minutes_of_date(r['date']))).sum())
    out['floor'] = str(s['floor'])
    if r['status'] != 'automatic':
        raise BuildError('alaska-1964: the text says the catalogue lists it as automatic')
    return out


def n_oklahoma(h, geo, s):
    box = view_box(geo, s['view'])
    k = h.mask(box, mmin=3.0)
    years = Counter(iso_of_minutes(int(t))[:4] for t in h.t[k])
    last = h.meta['last'][:4]
    peak = max((y for y in years if y >= '2009'), key=lambda y: (years[y], y))
    r = h.rec(s['anchors'][0])
    since = h.mask(box, '2009-01-01')
    top = int(h.m[since & (h.m != 255)].max())
    if r['m'] != top:
        raise BuildError(f'oklahoma: the anchor is not the largest since 2009 (code {top})')
    out = _base(r)
    out.update({'three': '3', 'c2008': count(years['2008']), 'y2008': '2008', 'cPeak': count(years[peak]),
                'yPeak': peak, 'cLast': count(years[last]), 'yLast': last, 'place': r['place'], **box_numbers(box)})
    return out


def n_kilauea(h, geo, s):
    k = h.mask(tuple(s['box']), s['play']['from'], s['play']['to'], s['floor'])
    r = h.rec(s['anchors'][0])
    if not k[r['row']] or r['m'] != int(h.m[k].max()):
        raise BuildError('kilauea: the anchor is not the largest in the story\'s box and span')
    out = _base(r)
    last = iso_of_minutes(minutes_of_date(s['play']['to']) - 1)[:10]
    out.update({'n': count(k.sum()), 'from': s['play']['from'], 'to': last, 'floor': f'{s["floor"]:.1f}'})
    return out


def n_ridgecrest(h, geo, s):
    a, b = (h.rec(e) for e in s['anchors'])
    k = h.mask(view_box(geo, s['view']), '2019-07-01', '2019-08-01', s['floor'])
    hours = (b['t'] - a['t']) / 60
    return {'m1': a['mag'], 'mt1': a['magType'], 't1': a['time'], 'd1': a['date'], 'm2': b['mag'], 'mt2': b['magType'],
            't2': b['time'], 'd2': b['date'], 'depth2': b['depth'], 'hours': f'{hours:.1f}', 'year': '2019', 'n': count(k.sum()),
            'floor': f'{s["floor"]:.1f}', **box_numbers(view_box(geo, s['view']))}


STORY_NUMBERS = {'cascadia-1700': n_cascadia, 'new-madrid-1811': n_new_madrid, 'san-francisco-1906': n_1906,
                 'alaska-1964': n_1964, 'oklahoma-2009': n_oklahoma, 'kilauea-2018': n_kilauea,
                 'ridgecrest-2019': n_ridgecrest}


# ---------------------------------------------------------------------------------------------
# about numbers
# ---------------------------------------------------------------------------------------------

def about_numbers(h, geo):
    hm = h.meta
    c = hm['counts']
    pre = h.t < minutes_of_date('1900-01-01')
    if int(((h.m == 255) & ~pre).sum()):
        raise BuildError('the text says every row without a magnitude is before 1900')
    lat_n, lat_s = 61, 40
    ratio = math.cos(math.radians(lat_s)) / math.cos(math.radians(lat_n))
    by = hm['dropped']['byType']
    last_pre = iso_of_minutes(int(h.t[pre][-1]))[:4]
    size_floor = max(t / 10 for t in range(0, 100) if DOT_BASE_PX * math.sqrt(2) ** (t / 10 - 2.5) <= DOT_MIN_PX)
    # the places outside the United States the history's place table names (M 4.5+ and the live rows' text)
    suffix = Counter(p.rsplit(', ', 1)[-1] for p in h.place.values() if p)
    found = [name for key, name in sorted(FOREIGN, key=lambda f: -suffix[f[0]]) if suffix[key]]
    if len(found) < 2:
        raise BuildError(f'boxes note: only {found} found outside the United States')
    return {
        'negDepth': count(int((h.d < 500).sum())), 'zeroKm': '0',
        'sizeFloor': f'{size_floor:.1f}', 'hollowMinMag': str(HOLLOW_MIN_M),
        'countries': ', '.join(found[:-1]) + ' and ' + found[-1],
        'history': count(hm['count']), 'firstYear': hm['first'][:4], 'lastYear': hm['last'][:4],
        'liveDays': str(LIVE_DAYS), 'rampDeepKm': str(RAMP_STOPS[-1]),
        'rampStops': ', '.join(str(v) for v in RAMP_STOPS[:-1]) + ' and ' + str(RAMP_STOPS[-1]),
        'noDepth': count(c['noDepth']), 'noDepthBefore1900': count(int(((h.d == 65535) & pre).sum())),
        'noMagnitude': count(c['noMagnitude']), 'eraYear': COMCAT['eras'][0][1][:4], 'rimKm': str(RIM_KM),
        'pre1950': count(int((h.t < minutes_of_date('1950-01-01')).sum())), 'midYear': '1950',
        'post2000': count(int((h.t >= minutes_of_date('2000-01-01')).sum())), 'recentYear': '2000',
        'floor': f'{COMCAT["eras"][1][2]:.1f}', 'magTypeCount': count(len(hm['magTypes'])),
        'depth10km': count(c['depth10km']), 'fixedDepthKm': '10',
        'latN': str(lat_n), 'latS': str(lat_s), 'ratioLen': f'{ratio:.1f}', 'ratioArea': f'{ratio * ratio:.1f}',
        'before1900': count(c['before1900']), 'lastPreYear': last_pre, 'retrieved': hm['retrieved'],
        'droppedOther': count(sum(by.values())), 'nuclear': count(by.get('nuclear explosion', 0)),
        'quarry': count(by.get('quarry blast', 0)), 'explosions': count(by.get('explosion', 0)),
        'cascadiaYear': h.rec('official17000127050000000')['year'],
    }


# ---------------------------------------------------------------------------------------------
# checks
# ---------------------------------------------------------------------------------------------

QUOTED = re.compile(r'“[^”]*”')
# a numeral standing on its own (so the 3 of "3DEP" is part of a name, not a number)
NUMERAL = re.compile(r'(?<![A-Za-z])(?:\d{4}-\d{2}-\d{2}|\d{2}:\d{2}|\d+(?:\u202f\d{3})*(?:\.\d+)?)(?![A-Za-z\d])')
_statements = None


def _norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def statements():
    global _statements
    if _statements is None:
        with open(os.path.join(HERE, 'credits', 'usgs-statements.txt'), encoding='utf-8') as f:
            _statements = _norm(f.read())
    return _statements


def check_quote(q, where):
    if _norm(q) not in statements():
        raise BuildError(f'{where}: quotation not verbatim in credits/usgs-statements.txt: {q[:90]!r}')


NAME_NUMERALS = ('48',)          # part of a name: "Lower 48"


def fill(template, numbers, where, allowed_extra=NAME_NUMERALS):
    def rep(m):
        k = m.group(1)
        if k not in numbers:
            raise BuildError(f'{where}: no number {{{k}}}')
        return numbers[k]
    text = re.sub(r'\{(\w+)\}', rep, template)
    values = set()
    for v in numbers.values():
        values.add(v)
        values.update(NUMERAL.findall(v))
    for q in QUOTED.findall(text):
        check_quote(q[1:-1], where)
    bare = QUOTED.sub('', text)
    for tok in NUMERAL.findall(bare):
        if tok not in values and tok not in allowed_extra:
            raise BuildError(f'{where}: the numeral {tok!r} is not one of the computed numbers')
    return text


# ---------------------------------------------------------------------------------------------

# The steps' credits fragments (written by build_history.py and build_relief.py) spell two of their
# adaptations the British way ("the catalogue's type", "grey JPEG"). An adaptation is this app's own
# account of what it changed, never a quotation, and the app speaks US English, so it is respelled here;
# titles, licence quotes, citations and attributions are copied as published and never touched.
US_SPELLING = (('catalogue', 'catalog'), ('Catalogue', 'Catalog'), ('grey', 'gray'), ('Grey', 'Gray'),
               ('colour', 'color'), ('Colour', 'Color'))


def us_spelling(s):
    for a, b in US_SPELLING:
        s = re.sub(r'\b' + a, b, s)
    return s


def grouped(s):
    """'112,944 lines' → '112 944 lines' (DESIGN §2); only digit groups, never a URL or a title."""
    return re.sub(r'(?<=\d),(?=\d{3}(?!\d))', NNBSP, s)


def merged_sources():
    frags = read_credits_fragments(STEPS)
    missing = [s for s in STEPS if s not in frags]
    if missing:
        raise BuildError(f'credits fragments missing for {missing}; run those steps first')
    out = []
    for sid in CREDIT_ORDER:
        rec = OrderedDict(id=sid)
        base = CREDIT[sid]
        rec.update(title=base['title'], owner=base['owner'], licence=base['licence'],
                   licence_quote=base['licence_quote'])
        src, adapt, retrieved = [], [], []
        for step in STEPS:
            for e in frags[step]['sources']:
                if e['id'] != sid:
                    continue
                src += [grouped(s) for s in e.get('source', []) if grouped(s) not in src]
                adapt += [grouped(us_spelling(a)) for a in e.get('adaptations', []) if grouped(us_spelling(a)) not in adapt]
                if e.get('retrieved') and e['retrieved'] not in retrieved:
                    retrieved.append(e['retrieved'])
        if not src:
            raise BuildError(f'no step named its source files for {sid}')
        rec.update(source=src, url=base['url'], retrieved=' / '.join(retrieved), adaptations=adapt,
                   cite=base['cite'], attribution=base['attribution'])
        out.append(rec)
    return out


def build():
    h = History()
    geo = load_json(os.path.join(ASSETS, 'geo.json'))
    content = os.path.join(HERE, 'content')
    qdoc = load_json(os.path.join(content, 'quotes.json'))
    quotes = {q['id']: q for q in qdoc['quotes']}
    extra = {s['id']: s for s in qdoc.get('sources', [])}
    for q in quotes.values():
        check_quote(q['quote'], f'quotes.json {q["id"]}')
    cited = OrderedDict()

    def cite(qid):
        if qid in quotes:
            cited[qid] = quotes[qid]
        elif qid in extra:
            cited[qid] = extra[qid]
        else:
            raise BuildError(f'unknown source {qid}')

    def resolve(qid):
        cite(qid)
        return quotes[qid]['quote']

    # ------------------------------------------------------------------ about.json
    a = load_json(os.path.join(content, 'about.json'))
    nums = about_numbers(h, geo)
    about = OrderedDict()
    about['title'] = a['title']
    about['version'] = a['version']
    about['retrieved'] = RETRIEVED
    about['intro'] = fill(a['intro'], nums, 'about intro')
    about['reading'] = [dict(r, text=fill(r['text'], nums, f'about reading {r["id"]}')) for r in a['reading']]
    notes = []
    for n in a['notes']:
        e = OrderedDict(id=n['id'], title=n['title'], text=fill(n['text'], nums, f'about note {n["id"]}'))
        if 'quoteId' in n:
            e['quote'] = resolve(n['quoteId'])
            e['source'] = n['quoteId']
        notes.append(e)
    about['notes'] = notes
    about['notShown'] = dict(a['notShown'], text=fill(a['notShown']['text'], nums, 'about notShown'))
    fields = OrderedDict()
    for k, v in a['fields'].items():
        e = OrderedDict(label=v['label'], quote=resolve(v['quoteId']), source=v['quoteId'])
        if 'more' in v:
            e['more'] = {'quote': resolve(v['more']), 'source': v['more']}
        fields[k] = e
    about['fields'] = fields
    mtn = OrderedDict()
    for k, v in a['magTypeNames'].items():
        check_quote(v['header'], f'magTypeNames {k}')
        if v['quote'] is not None:                   # mw: the table's only line for it is its header
            check_quote(v['quote'], f'magTypeNames {k}')
        cite(v['source'])
        mtn[k] = v
    about['magTypeNames'] = mtn
    about['magTypeRule'] = a['magTypeRule']
    about['faultScope'] = {'quote': resolve(a['faultScope']['quoteId']), 'source': a['faultScope']['quoteId']}
    for age in a['faultAges']:
        if age not in geo['faults']['ages']:
            raise BuildError(f'faultAges: {age!r} is not a label in geo.json')
    about['faultAges'] = a['faultAges']
    about['faultAgesNote'] = a['faultAgesNote']
    about['faultClasses'] = {k: {'quote': resolve(v['quoteId']), 'source': v['quoteId']}
                             for k, v in a['faultClasses'].items()}
    for k, v in a['volcanoLevels'].items():
        check_quote(v['quote'], f'volcanoLevels {k}')
        cite(v['source'])
    about['volcanoLevels'] = a['volcanoLevels']
    about['eventPage'] = a['eventPage']
    about['eventPageEvidence'] = a['eventPageEvidence']
    about['numbers'] = nums

    # ------------------------------------------------------------------ stories.json
    sdoc = load_json(os.path.join(content, 'stories.json'))
    views = {v['key'] for v in geo['views']}
    stories = []
    for s in sdoc['stories']:
        if s['view'] not in views:
            raise BuildError(f'story {s["id"]}: no view {s["view"]}')
        numbers = STORY_NUMBERS[s['id']](h, geo, s)
        # the card prints `when` as its date line: an anchor's catalog date, or a bare year or span of years
        if not (s['when'] in {h.rec(e)['date'] for e in s['anchors']} or re.fullmatch(r'\d{4}(–\d{4})?', s['when'])):
            raise BuildError(f'story {s["id"]}: when {s["when"]!r} is neither an anchor\'s catalog date nor a year or a span')
        text = fill(s['text'], numbers, f'story {s["id"]}')
        words = len(text.split())
        if words > MAX_WORDS:
            raise BuildError(f'story {s["id"]}: {words} words, more than {MAX_WORDS}')
        for sid in s['sources']:
            if sid != 'comcat':
                cite(sid)
        if 'play' in s:
            p = s['play']
            span = (minutes_of_date(p['to']) - minutes_of_date(p['from'])) // 1440
            steps = math.ceil(span / (1 if p['step'] == 'day' else 7))
            if not (p['from'] < p['to'] and p['step'] in ('day', 'week') and steps <= 62):
                raise BuildError(f'story {s["id"]}: play block {p} ({steps} steps)')
        e = OrderedDict((k, s[k]) for k in ('id', 'title', 'when', 'view', 'window', 'floor', 'anchors'))
        if 'box' in s:
            e['box'] = [round(unwrap_lon(s['box'][0]), 4), s['box'][1], round(unwrap_lon(s['box'][2]), 4), s['box'][3]]
        e['text'] = text
        e['numbers'] = numbers
        e['sources'] = s['sources']
        if 'play' in s:
            e['play'] = s['play']
        stories.append(e)
        log(f'  story {s["id"]}: {words} words')
    story_sources = [dict(id=q, **{k: cited[q][k] for k in ('title', 'owner', 'url', 'retrieved')},
                          quote=cited[q].get('quote')) for q in cited
                     if any(q in s['sources'] for s in stories)]
    story_sources.append({'id': 'comcat', 'title': CREDIT['comcat']['title'], 'owner': CREDIT['comcat']['owner'],
                          'url': CREDIT['comcat']['url'], 'retrieved': h.meta['retrieved'], 'quote': None})

    sources = merged_sources()
    about['cited'] = [OrderedDict((k, v) for k, v in q.items() if k in ('id', 'title', 'owner', 'url', 'retrieved', 'note'))
                      for q in cited.values()]
    about['sources'] = sources
    about['software'] = a['software']

    write_json(os.path.join(ASSETS, 'about.json'), about, BUDGET_ABOUT)
    write_json(os.path.join(ASSETS, 'stories.json'), {'schema': 1, 'stories': stories, 'sources': story_sources},
               BUDGET_STORIES)
    credits = credits_txt(sources, about['cited'], h.meta)
    data = credits.encode('utf-8')
    if len(data) > BUDGET_CREDITS:
        raise BuildError(f'CREDITS.txt: {len(data):,} B exceeds {BUDGET_CREDITS:,} B; nothing written')
    p = os.path.join(APP, 'CREDITS.txt')
    with open(p + '.tmp', 'wb') as f:
        f.write(data)
    os.replace(p + '.tmp', p)
    log(f'  wrote {len(data):>11,} B  {p}')


def credits_txt(sources, cited, hmeta):
    W = 100

    def para(label, text, indent=4):
        return textwrap.fill(text, W, initial_indent=' ' * indent + (label + ': ' if label else ''),
                             subsequent_indent=' ' * (indent + 2), break_on_hyphens=False, break_long_words=False)
    out = ['US Quakes — credits and licenses', '=' * 34, '',
           textwrap.fill('Every map layer and every earthquake in this app is public-domain data, credited below with what '
                         'this app changed. The history of earthquakes was downloaded from the USGS event service for '
                         f'four map boxes and packed to {hmeta["cutoff"]}; the live file (data/snapshot.json) is '
                         'refreshed from the USGS feed and carries its own list of sources and times. Nothing here is '
                         'fetched at runtime: the app has no network.', W), '']
    def field(label, items):
        """label: first item, later items aligned under the first; each item wrapped on its own."""
        head = ' ' * 4 + label + ': '
        lines = []
        for i, it in enumerate(items):
            lead = head if i == 0 else ' ' * len(head)
            lines.append(textwrap.fill(it, W, initial_indent=lead, subsequent_indent=' ' * len(head),
                                       break_on_hyphens=False, break_long_words=False))
        return lines
    for s in sources:
        out += ['-' * W, s['title'].upper(), '']
        out += field('Owner', [s['owner']])
        out += field('Source', s['source'])
        out += field('URL', [s['url']])
        out += field('License', [s['licence'], s['licence_quote']])
        out += field('Retrieved', [s['retrieved']])
        if s['adaptations']:
            out += field('Adaptations', s['adaptations'])
        out += field('Cite', [s['cite']])
        out += field('Attribution', [s['attribution']])
        out.append('')
    out += ['-' * W, 'TEXT QUOTED IN ABOUT AND THE STORIES', '',
            textwrap.fill('Every explanation of a USGS field and every claim in the stories beyond the catalog\'s own '
                          'numbers is quoted verbatim from these USGS pages (public domain); the quotes are kept in '
                          'scripts/us_quakes/credits/usgs-statements.txt in the template repository.', W,
                          initial_indent='    ', subsequent_indent='    '), '']
    seen = set()
    for c in cited:
        if (c['title'], c['url']) in seen:
            continue
        seen.add((c['title'], c['url']))
        out.append(para('', f'{c["title"]}. {c["owner"]}. {c["url"]} (retrieved {c["retrieved"]})'
                        + (f'. {c["note"]}.' if c.get('note') else '')))
    out += ['', '-' * W, 'FONTS', '',
            para('', 'Atkinson Hyperlegible: Copyright 2020 Braille Institute of America, Inc.'),
            para('', 'Red Hat Mono: Copyright 2024 The Red Hat Project Authors (github.com/RedHatOfficial/RedHatFont)'),
            para('', 'Both under the SIL Open Font License 1.1, whose text ships as fonts/OFL.txt. Files: '
                 + ', '.join(FONT_FILES) + '; unchanged from the Fontsource packages '
                 '@fontsource/atkinson-hyperlegible@5.2.8 and @fontsource/red-hat-mono@5.3.0.'),
            '', '-' * W,
            textwrap.fill('This app is not an earthquake or tsunami warning service.', W), '']
    return '\n'.join(out)


def main():
    build()


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        sys.exit(1)
