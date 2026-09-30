"""The checks on the story text that step 60 applies to tools/content/story.yaml and verify_story.py
re-applies to data/story.json (tools/CONTRACT.md §10). Pure functions over plain dicts: no pygplates,
no file writes. Every failure is collected and reported together, so one run lists all of them.

What a script can check is checked here: limits, sources, the number-to-source map, ages against the
ICS chart, and pins against the plate list. Whether a number says what its source says is the
reviewers' job; `evidence` in the YAML tells them where to look.
"""
import math
import re
import unicodedata

LIMITS = {
    'card_words': 90,          # period cards and the prologue
    'event_title_chars': 60,
    'event_words': 45,
    'label_chars': 24,         # a look-for pin's label
    'look_words': 25,
}
AGE_RANGE_MA = (0.0, 750.0)
BOUNDARY_TOLERANCE_MA = 0.05          # CONTRACT §10: when the unit's begin_unc_ma is null

# Numerals as written: 716.5, 26 500 (SI grouping with a narrow no-break space; a comma is also read), 0.07, 2.8. ASCII digits only, so a superscript (km²) or a
# subscript (CO₂) is never read as a number; not preceded by a letter or digit (so e.g. 'M5' is not).
NUM_RE = re.compile(r'(?<![0-9A-Za-z])[0-9](?:[0-9]|[,\u202f\u2009](?=[0-9]{3}))*(?:\.[0-9]+)?')

# AI vendors and products that must never appear in anything the app shows (CONTRACT §0).
AI_NAMES = re.compile(
    r'\b(openai|chat\s?gpt|gpt-?[0-9]|claude|anthropic|gemini|bard|copilot|llama|mistral\s?ai|'
    r'perplexity|grok|deepseek|midjourney|dall-?e|stable\s?diffusion|opus|sonnet|haiku|fable)\b', re.IGNORECASE)
FORBIDDEN_TEXT = ('http', 'www.')
WIKI = re.compile(r'wiki', re.IGNORECASE)


def words(s):
    """Whitespace-separated tokens (CONTRACT §10)."""
    return len(s.split())


def numbers_in(*texts):
    out = []
    for t in texts:
        if t:
            out += NUM_RE.findall(t)
    return out


def as_list(v):
    return list(v) if isinstance(v, (list, tuple)) else [v]


def decimals(tok):
    return len(tok.split('.')[1]) if '.' in tok else 0


def num_value(tok):
    return float(tok.replace(',', '').replace('\u202f', '').replace('\u2009', ''))


def unit_contains(u, a):
    """ICS rule (timescale.json `rule`): end < a <= begin, or a = 0 and end = 0."""
    return (u['end_ma'] < a <= u['begin_ma']) or (a == 0 and u['end_ma'] == 0)


def check_story(story, timescale, plate_ids, slices=None):
    """Return (errors, report). `story` has the YAML's structure (or story.json's, a superset).
    `plate_ids` is plates.json's `plates`; `slices` is the manifest's slice list (for map numbers)."""
    errs, rep = [], {'cards': [], 'events': [], 'look_for': []}
    units = {u['id']: u for u in timescale['units']}
    periods = {u['id']: u for u in timescale['units'] if u['rank'] == 'Period'}
    src_ids = [s['id'] for s in story['sources']]
    used = set()

    # --- sources ---------------------------------------------------------------------------------
    if len(set(src_ids)) != len(src_ids):
        errs.append('duplicate source ids')
    for s in story['sources']:
        if not s.get('cite'):
            errs.append(f"source {s['id']}: no cite")
        if not (s.get('doi') or s.get('url')):
            errs.append(f"source {s['id']}: neither doi nor url")
        if s.get('access') not in ('open', 'closed'):
            errs.append(f"source {s['id']}: access must be open or closed")
        for k in ('cite', 'doi', 'url'):
            if s.get(k) and WIKI.search(s[k]):
                errs.append(f"source {s['id']}: {k} points at a wiki")
        if AI_NAMES.search(s.get('cite', '')):
            errs.append(f"source {s['id']}: names an AI vendor or product")

    def text_rules(where, *texts):
        for t in texts:
            if t is None:
                continue
            if unicodedata.normalize('NFC', t) != t:
                errs.append(f'{where}: text is not NFC')
            low = t.lower()
            for bad in FORBIDDEN_TEXT:
                if bad in low:
                    errs.append(f'{where}: contains "{bad}"')
            if AI_NAMES.search(t):
                errs.append(f'{where}: names an AI vendor or product ({AI_NAMES.search(t).group(0)})')

    def item_sources(where, item):
        srcs = item.get('sources') or []
        if not srcs:
            errs.append(f'{where}: no source')
        for sid in srcs:
            if sid not in src_ids:
                errs.append(f'{where}: source {sid} does not resolve')
            used.add(sid)
        return srcs

    def number_rules(where, item, *texts):
        """Every numeral in the texts is a key of item['numbers']; every key occurs; every source a
        key names is one the item cites; ICS numbers equal a chart value at their precision."""
        srcs = set(item.get('sources') or [])
        nums = item.get('numbers') or {}
        toks = numbers_in(*texts)
        for tok in toks:
            if tok not in nums:
                errs.append(f'{where}: number {tok} has no source in `numbers`')
        for key, ids in nums.items():
            if key not in toks:
                errs.append(f'{where}: `numbers` key {key!r} does not occur in the text')
            for sid in as_list(ids):
                if sid not in srcs:
                    errs.append(f'{where}: number {key} cites {sid}, which the item does not list in sources')
                if sid == 'ics' and not ics_numeral(key):
                    errs.append(f'{where}: {key} is credited to the ICS chart but equals no chart age '
                                f'or uncertainty at that precision')
                if sid == 'paleoatlas' and slices is not None and not atlas_numeral(key, item):
                    errs.append(f'{where}: {key} is credited to the atlas but is no map number or map '
                                f'age, and no `measured` entry explains it')
        return toks

    ics_values = set()
    for u in timescale['units']:
        for k in ('begin_ma', 'begin_unc_ma', 'end_ma', 'end_unc_ma'):
            if u.get(k) is not None:
                ics_values.add(float(u[k]))

    def ics_numeral(tok):
        v, d = num_value(tok), decimals(tok)
        return any(abs(round(x, d) - v) < 1e-9 for x in ics_values)

    def atlas_numeral(tok, item):
        v = num_value(tok)
        if tok in (item.get('measured') or {}):
            return True
        for s in slices:
            if v == s['map'] or abs(v - s['age_ma']) < 1e-9 or abs(v - s['age_ma'] * 1e6) < 1e-6:
                return True
        return False

    # --- period cards ----------------------------------------------------------------------------
    want = list(timescale['card_periods'])
    have = [c['ics'] for c in story['periods']]
    if have != want:
        errs.append(f'period cards {have} must be exactly card_periods {want}, in that order')
    for c in story['periods']:
        where = f"card {c['ics']}"
        n = words(c['text'])
        if n > LIMITS['card_words']:
            errs.append(f"{where}: {n} words > {LIMITS['card_words']}")
        text_rules(where, c['text'])
        item_sources(where, c)
        number_rules(where, c, c['text'])
        rep['cards'].append((c['ics'], n, len(numbers_in(c['text']))))
    pro = story['prologue']
    n = words(pro['text'])
    if n > LIMITS['card_words']:
        errs.append(f"prologue: {n} words > {LIMITS['card_words']}")
    text_rules('prologue', pro['title'], pro['text'])
    item_sources('prologue', pro)
    number_rules('prologue', pro, pro['title'], pro['text'])
    rep['cards'].append(('prologue', n, len(numbers_in(pro['text']))))

    # --- events ----------------------------------------------------------------------------------
    ids = [e['id'] for e in story['events']]
    if len(set(ids)) != len(ids):
        errs.append('duplicate event ids')
    for e in story['events']:
        where = f"event {e['id']}"
        a = float(e['age_ma'])
        if len(e['title']) > LIMITS['event_title_chars']:
            errs.append(f"{where}: title {len(e['title'])} characters > {LIMITS['event_title_chars']}")
        n = words(e['text'])
        if n > LIMITS['event_words']:
            errs.append(f"{where}: {n} words > {LIMITS['event_words']}")
        text_rules(where, e['title'], e['text'], e.get('when'))
        srcs = item_sources(where, e)
        number_rules(where, e, e['title'], e['text'], e.get('when'))
        if not (AGE_RANGE_MA[0] <= a <= AGE_RANGE_MA[1]):
            errs.append(f'{where}: age {a} outside {AGE_RANGE_MA}')
        if e.get('age_source') not in srcs:
            errs.append(f"{where}: age_source {e.get('age_source')} is not among its sources")
        # the period it is filed under must contain the age (ICS rule)
        p = periods.get(e.get('period'))
        if p is None:
            errs.append(f"{where}: period {e.get('period')} is not an ICS Period")
        elif not unit_contains(p, a):
            errs.append(f"{where}: age {a} Ma is not inside the {p['id']} ({p['begin_ma']}-{p['end_ma']} Ma)")
        # a range: age is its midpoint, the uncertainty its half-width
        if e.get('range_ma') is not None:
            o, y = map(float, e['range_ma'])
            if not o > y:
                errs.append(f'{where}: range_ma must be [older, younger]')
            if abs(a - (o + y) / 2) > 1e-9 or abs(float(e.get('age_unc_ma', -1)) - (o - y) / 2) > 1e-9:
                errs.append(f'{where}: with range_ma {e["range_ma"]}, age_ma must be its midpoint and '
                            f'age_unc_ma its half-width')
        # a boundary: the age is that unit's begin, within its uncertainty (or the contract's 0.05)
        if e.get('boundary'):
            u = units.get(e['boundary'])
            if u is None:
                errs.append(f"{where}: boundary {e['boundary']} is not an ICS unit")
            else:
                tol = u['begin_unc_ma'] if u.get('begin_unc_ma') is not None else BOUNDARY_TOLERANCE_MA
                if abs(a - u['begin_ma']) > tol + 1e-9 and not e.get('boundary_source'):
                    errs.append(f"{where}: age {a} differs from the {u['id']} base {u['begin_ma']} by more "
                                f'than {tol} and no boundary_source is given')
                if e.get('boundary_source') and e['boundary_source'] not in srcs:
                    errs.append(f'{where}: boundary_source is not among its sources')
        # an age taken from the chart must be a chart age, exactly, with the chart's uncertainty
        if e.get('age_source') == 'ics':
            uid = e.get('boundary') or e.get('ics_unit')
            u = units.get(uid)
            if u is None:
                errs.append(f'{where}: an ICS age needs `boundary` or `ics_unit` naming the unit')
            else:
                if abs(a - u['begin_ma']) > 1e-9:
                    errs.append(f"{where}: age {a} is not the {uid} base {u['begin_ma']}")
                unc = e.get('age_unc_ma')
                if (unc is None) != (u.get('begin_unc_ma') is None) or (
                        unc is not None and abs(float(unc) - u['begin_unc_ma']) > 1e-9):
                    errs.append(f"{where}: age_unc_ma {unc} is not the chart's {u.get('begin_unc_ma')}")
        rep['events'].append((e['id'], a, n, len(e['title'])))

    # --- look-for pins ---------------------------------------------------------------------------
    ids = [x['id'] for x in story['look_for']]
    if len(set(ids)) != len(ids):
        errs.append('duplicate look_for ids')
    for x in story['look_for']:
        where = f"look_for {x['id']}"
        if len(x['label']) > LIMITS['label_chars']:
            errs.append(f"{where}: label {len(x['label'])} characters > {LIMITS['label_chars']}")
        n = words(x['text'])
        if n > LIMITS['look_words']:
            errs.append(f"{where}: {n} words > {LIMITS['look_words']}")
        text_rules(where, x['label'], x['text'])
        item_sources(where, x)
        number_rules(where, x, x['label'], x['text'])
        lon, lat = float(x['lon']), float(x['lat'])
        if not (-180 <= lon <= 180 and -90 <= lat <= 90) or math.isnan(lon) or math.isnan(lat):
            errs.append(f'{where}: lon/lat out of range')
        w = x['window_ma']
        if not (len(w) == 2 and float(w[0]) > float(w[1]) >= 0 and float(w[0]) <= AGE_RANGE_MA[1]):
            errs.append(f'{where}: window_ma must be [older, younger] inside 0-750')
        if x.get('plate') is not None and x['plate'] not in plate_ids:
            errs.append(f"{where}: plate {x['plate']} is not in plates.json")
        if slices is not None and not any(float(w[1]) <= s['age_ma'] <= float(w[0]) for s in slices):
            errs.append(f'{where}: no map falls inside window {w}')
        rep['look_for'].append((x['id'], n, len(x['label'])))

    unused = [s for s in src_ids if s not in used]
    if unused:
        errs.append(f'sources never cited: {unused}')
    return errs, rep
