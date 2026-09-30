"""Step 50 — ICS names, ages and colours: data/timescale.json, and tools/work/ics_slices.json.

Reads chart.ttl from i-c-stratigraphy/chart at the pinned commit (sources.py) with rdflib, and
tools/slices.csv. Layout and rules: tools/CONTRACT.md §9 (timescale.json) and §1 (`ics`, `ics_note`,
which step 80 copies into the manifest from work/ics_slices.json).

A unit is a subject with a gts:rank. Its begin and end are the gtsd:inMYA of its time:hasBeginning /
time:hasEnd nodes, their uncertainties schema:marginOfError (null when absent), its colour
schema:color, its parent skos:broader (null when the parent is not shipped: only Proterozoic's
parent, the Super-Eon Precambrian). Name: skos:prefLabel@en, else the id split before each capital
that follows a lower-case letter, marked name_from "id".

    .venv/bin/python 50_timescale.py
"""
import re

import rdflib
from rdflib.namespace import SKOS

from common import RETRIEVED, json_text, write_fragment, write_json, write_work
from geo import read_slices, source
from sources import ICS_COMMIT, SOURCES

GTS = rdflib.Namespace('http://resource.geosciml.org/ontology/timescale/gts#')
RANK = 'http://resource.geosciml.org/ontology/timescale/rank/'
TIME = rdflib.Namespace('http://www.w3.org/2006/time#')
GTSD = rdflib.Namespace('https://data.stratigraphy.org/data/gts/')
SCHEMA = rdflib.Namespace('https://schema.org/')
OWL = rdflib.Namespace('http://www.w3.org/2002/07/owl#')
CS = rdflib.URIRef('https://data.stratigraphy.org/def/chart')
DCT = rdflib.Namespace('http://purl.org/dc/terms/')
RANKS = ['Eon', 'Era', 'Period', 'Sub-Period', 'Epoch', 'Age']
KEEP_BEFORE = 1000.0
CAP = 40_000
BOUNDARY_TOL = 0.05

# Boundary maps (CONTRACT §1): Table 1's interval text -> the younger named unit, whose begin_ma is
# the boundary. KT = Cretaceous/Tertiary; its younger side in today's chart is the Paleogene.
BOUNDARY_UNIT = {
    'Paleocene/Eocene Boundary': 'Eocene',
    'KT Boundary': 'Paleogene',
    'Jurassic/Cretaceous Boundary': 'Cretaceous',
    'Triassic/Jurassic Boundary': 'Jurassic',
    'Permo-Triassic Boundary': 'Triassic',
    'Devono-Carboniferous Boundary': 'Carboniferous',
    'Cambro-Ordovician Boundary': 'Ordovician',
    'Cambrian/Precambrian boundary': 'Cambrian',
}
# Words in Table 1's interval / stage text -> the ICS Period or Sub-Period they name (CONTRACT §1).
KEYWORDS = [
    ('Holocene', 'Quaternary'), ('Pleistocene', 'Quaternary'), ('Glacial', 'Quaternary'),
    ('Pliocene', 'Neogene'), ('Miocene', 'Neogene'),
    ('Oligocene', 'Paleogene'), ('Eocene', 'Paleogene'), ('Paleocene', 'Paleogene'),
    ('PETM', 'Paleogene'),
    ('Cretaceous', 'Cretaceous'), ('Jurassic', 'Jurassic'), ('Triassic', 'Triassic'),
    ('Permian', 'Permian'), ('Permo', 'Permian'),
    ('Pennsylvanian', 'Pennsylvanian'), ('Mississippian', 'Mississippian'),
    ('Carboniferous', 'Carboniferous'),
    ('Devonian', 'Devonian'), ('Devono', 'Devonian'), ('Silurian', 'Silurian'),
    ('Ordovician', 'Ordovician'), ('Cambrian', 'Cambrian'), ('Cambro', 'Cambrian'),
    ('Ediacaran', 'Ediacaran'), ('Cryogenian', 'Cryogenian'), ('Tonian', 'Tonian'),
]
SUBPERIODS = {'Pennsylvanian', 'Mississippian'}


def local(iri):
    return str(iri).rstrip('/').rsplit('/', 1)[-1]


def split_id(i):
    return re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', i)


def num(lit):
    return float(lit.toPython()) if lit is not None else None


def load_units(g):
    """{id: unit}. A subject may carry two ranks (Pridoli is both an Epoch and an Age in this
    chart): `rank` is the coarser, `also_rank` lists the others, and at() matches either."""
    ranks = {}
    for s, rank in g.subject_objects(GTS.rank):
        r = str(rank)
        assert r.startswith(RANK), r
        r = r[len(RANK):]
        if r in RANKS:
            ranks.setdefault(s, []).append(r)
    units = {}
    lexical = {}
    for s in sorted(ranks, key=str):
        rs = sorted(ranks[s], key=RANKS.index)
        r = rs[0]
        bs, es = list(g.objects(s, TIME.hasBeginning)), list(g.objects(s, TIME.hasEnd))
        assert len(bs) == 1 and len(es) == 1, local(s)
        b, e = bs[0], es[0]
        vals = {}
        for key, node in (('begin', b), ('end', e)):
            ma = list(g.objects(node, GTSD.inMYA))
            unc = list(g.objects(node, SCHEMA.marginOfError))
            assert len(ma) == 1 and len(unc) <= 1, (local(s), key)
            vals[key] = (num(ma[0]), num(unc[0]) if unc else None)
            lexical[(local(s), key)] = (str(ma[0]), str(unc[0]) if unc else None)
        cols = list(g.objects(s, SCHEMA.color))
        assert len(cols) == 1 and re.fullmatch(r'#[0-9A-Fa-f]{6}', str(cols[0])), local(s)
        en = [str(o) for o in g.objects(s, SKOS.prefLabel) if o.language == 'en']
        assert len(en) <= 1, local(s)
        br = list(g.objects(s, SKOS.broader))
        assert len(br) <= 1, local(s)
        uid = local(s)
        assert uid not in units, f'two subjects named {uid}'
        units[uid] = {
            'id': uid, 'name': en[0] if en else split_id(uid),
            'name_from': 'prefLabel' if en else 'id', 'rank': r,
            'begin_ma': vals['begin'][0], 'begin_unc_ma': vals['begin'][1],
            'end_ma': vals['end'][0], 'end_unc_ma': vals['end'][1],
            'colour': str(cols[0]).upper(), 'parent': local(br[0]) if br else None,
        }
        if len(rs) > 1:
            units[uid]['also_rank'] = rs[1:]
    return units, lexical


def contains(u, a):
    return u['end_ma'] < a <= u['begin_ma'] or (a == 0 and u['end_ma'] == 0)


def at(units, a, rank):
    hits = [u for u in units.values()
            if (u['rank'] == rank or rank in u.get('also_rank', ())) and contains(u, a)]
    assert len(hits) <= 1, (a, rank, [h['id'] for h in hits])
    return hits[0] if hits else None


def age_phrase(a):
    if a == 0:
        return 'today'
    if a < 0.1:
        return f'{int(round(a * 1e6, -3)):,} years ago'
    return f'{a:g} million years ago'


def named_units(text):
    return {unit for word, unit in KEYWORDS if word in text}


def main():
    g = rdflib.Graph()
    g.parse(source('ics_chart'), format='turtle')
    version = str(next(g.objects(CS, OWL.versionInfo)))
    cite = [str(o) for o in g.objects(DCT.bibliographicCitation, SKOS.prefLabel) if o.language == 'en']
    assert len(cite) == 1
    units, lexical = load_units(g)
    ship = {k: u for k, u in units.items() if u['end_ma'] < KEEP_BEFORE}
    for u in ship.values():
        if u['parent'] is not None and u['parent'] not in ship:
            u['parent_unshipped'] = u['parent']
            u['parent'] = None
    order = {r: i for i, r in enumerate(RANKS)}
    ulist = sorted(ship.values(), key=lambda u: (-u['begin_ma'], order[u['rank']], u['id']))

    maps = []
    for i, s in enumerate(read_slices()):
        a = s['age_ma']
        per, sub, epo, age = (at(ship, a, r) for r in ('Period', 'Sub-Period', 'Epoch', 'Age'))
        eon, era = at(ship, a, 'Eon'), at(ship, a, 'Era')
        assert per is not None, f'map {s["map"]} at {a} Ma is in no Period'
        ics = {'eon': eon and eon['id'], 'era': era and era['id'], 'period': per['id'],
               'subperiod': sub and sub['id'], 'epoch': epo and epo['id'], 'age': age and age['id'],
               'colour': per['colour']}
        note = None
        interval, stage = s['interval'], s['stage'] or ''
        if interval in BOUNDARY_UNIT:
            b = ship[BOUNDARY_UNIT[interval]]
            if abs(a - b['begin_ma']) >= BOUNDARY_TOL:
                # The chart's own numerals ("66.00", "143.1", "0.6"), so its precision is kept.
                ma_txt, unc_txt = lexical[(b['id'], 'begin')]
                unc = f' ± {unc_txt}' if unc_txt is not None else ''
                note = {'kind': 'boundary', 'unit': b['id'], 'scotese_ma': a, 'ics_ma': b['begin_ma'],
                        'ics_unc_ma': b['begin_unc_ma'],
                        'text': (f'Scotese dates this boundary {a:g} Ma, on the 2008 timescale his '
                                 f"atlas uses; today's chart puts it at {ma_txt}{unc} Ma.")}
        else:
            assert 'oundary' not in interval, f'map {s["map"]}: boundary interval {interval!r} not in the table'
            named = named_units(interval)
            if not named:                                   # "Neoproterozoic" names no period
                named = named_units(stage)
            assert named, f'map {s["map"]}: no period named in {interval!r} / {stage!r}'
            unit = sub if (named & SUBPERIODS) else per
            if unit is None or unit['id'] not in named:
                u = unit or per
                note = {'kind': 'period', 'unit': u['id'], 'scotese_ma': a, 'ics_ma': None,
                        'ics_unc_ma': None,
                        'text': f"By today's chart, {age_phrase(a)} is in the {u['name']}."}
        maps.append({'i': i, 'map': s['map'], 'age_ma': a, 'interval': interval, 'stage': s['stage'],
                     'ics': ics, 'ics_note': note})

    card = []
    for m in maps:                                     # manifest order is youngest first
        if m['ics']['period'] not in card:
            card.append(m['ics']['period'])

    # Inconsistencies in the chart data, shipped as given and named here so the app never tiles a
    # rank blindly. Found by verify_timescale.py's tiling check; asserted so a new chart must be looked at.
    lud, pri = ship['Ludlow'], ship['Pridoli']
    assert (lud['end_ma'], pri['begin_ma'], ship['Ludfordian']['end_ma']) == (419.62, 422.7, 422.7)
    quirks = [{'units': ['Ludlow', 'Pridoli'],
               'text': ('The chart data gives the Ludlow epoch as 426.7-419.62 Ma, so it overlaps the '
                        'Pridoli (422.7-419.62 Ma); its last age, the Ludfordian, ends at 422.7 Ma. '
                        'Shipped as given; no map age falls in 419.62-422.7 Ma.')}]
    aq = ship['Aquitanian']
    assert (aq['begin_ma'], ship['Chattian']['end_ma'], ship['Miocene']['begin_ma'],
            ship['Neogene']['begin_ma']) == (23.03, 23.04, 23.04, 23.04)
    quirks.append({'units': ['Aquitanian', 'Chattian'],
                   'text': ('The chart data gives the Aquitanian age as beginning 23.03 Ma while the '
                            'Chattian, Oligocene and Paleogene end, and the Miocene and Neogene begin, '
                            'at 23.04 Ma: a 0.01-million-year gap between ages. Shipped as given; no '
                            'map age falls in it.')})
    for m in maps:
        assert not (419.62 < m['age_ma'] <= 422.7) and not (23.03 < m['age_ma'] <= 23.04), m['map']

    out = {'source': 'ics', 'commit': ICS_COMMIT, 'version': version, 'quirks': quirks,
           # The chart's own citation line, its DOI link written as "doi:" (no URL in data/ JSON
           # beyond about.json and story.json, CONTRACT §0).
           'cite': cite[0].removeprefix('Cite: ').replace('https://doi.org/', 'doi:'),
           'rule': 'a unit contains age a when end < a <= begin, or a = 0 and end = 0',
           'ranks': RANKS, 'units': ulist, 'card_periods': card}
    txt = json_text(out, ndigits=4)
    assert len(txt.encode('utf-8')) <= CAP, f'timescale.json {len(txt.encode())} bytes > {CAP}'
    write_json('timescale.json', out, ndigits=4)
    write_work('ics_slices.json', {'rule': out['rule'], 'boundary_tolerance_ma': BOUNDARY_TOL,
                                   'maps': maps})

    s = SOURCES['ics_chart']
    write_fragment('timescale', [{
        'id': 'ics', 'title': 'International Chronostratigraphic Chart (data)',
        'owner': 'International Commission on Stratigraphy',
        'source': (f'{s["name"]} (sha256 {s["sha256"]}), chart.ttl at commit {ICS_COMMIT} of '
                   f'github.com/i-c-stratigraphy/chart (chart version {version}).'),
        'url': s['url'], 'licence': 'CC BY 4.0',
        'licence_uri': 'https://creativecommons.org/licenses/by/4.0/',
        'licence_quote': ('"This data is copyrighted as follows: (c) International Commission on '
                          'Stratigraphy, 2026. This data is licensed for use with the Creative '
                          'Commons Attribution 4.0 license." (the repository\'s README.adoc)'),
        'retrieved': RETRIEVED,
        'adaptations': (f'The eons, eras, periods, sub-periods, epochs and ages ending less than '
                        f'{KEEP_BEFORE:g} million years ago: English names (or the identifier split '
                        'into words where the data has no English name), begin and end ages with '
                        'their uncertainties, colors and parents. No chart image is used.'),
        'accuracy': 'Ages and uncertainties as the chart data gives them.',
        'cite': s['attribution'],
    }])

    by_id = sum(1 for u in ulist if u['name_from'] == 'id')
    counts = {r: sum(1 for u in ulist if u['rank'] == r or r in u.get('also_rank', ())) for r in RANKS}
    notes = [m for m in maps if m['ics_note']]
    print(f'timescale.json: {len(txt.encode()):,} bytes; chart version {version}; {len(ulist)} units '
          f'{counts}; {by_id} names made from ids; {len(card)} card periods')
    print(f'ics notes: {len(notes)} maps ({sum(1 for m in notes if m["ics_note"]["kind"] == "boundary")} '
          f'boundary, {sum(1 for m in notes if m["ics_note"]["kind"] == "period")} period)')


if __name__ == '__main__':
    main()
