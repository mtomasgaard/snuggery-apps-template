"""Checks data/timescale.json and tools/work/ics_slices.json (tools/CONTRACT.md §9, §1, §14) and
prints what it measured.

1. The Phanerozoic periods' begin ages against the reference list in the build brief. Each period
   is "equal" (the chart's value rounded to the reference's decimals equals it), "within" (the
   difference is inside the chart's own stated uncertainty), or a listed difference: the chart at the
   pinned commit gives another number, and this script pins that exact number so a parsing mistake
   still fails. The chart's numerals are also read straight from the Turtle text with a regular
   expression, independently of rdflib.
2. Structure: periods, eras, epochs and ages tile time without gaps or overlaps; every parent is
   shipped, coarser, and encloses its child.
3. Every map in data/manifest.json falls inside exactly one Period, the one work/ics_slices.json
   names. All 90 maps are printed with their ICS units and note, and the names made from ids.

    .venv/bin/python verify_timescale.py
"""
import json
import os
import re

from geo import source
from paths import DATA, WORK

# The build brief's list (Ma): the begin of each Phanerozoic period. Cambrian accepts either value
# the brief gives.
REFERENCE = {'Cambrian': ['541', '538.8'], 'Ordovician': ['485.4'], 'Silurian': ['443.8'],
             'Devonian': ['419.2'], 'Carboniferous': ['358.9'], 'Permian': ['298.9'],
             'Triassic': ['251.9'], 'Jurassic': ['201.4'], 'Cretaceous': ['145.0'],
             'Paleogene': ['66.0'], 'Neogene': ['23.03'], 'Quaternary': ['2.58']}
# Where the pinned chart (version 2026-06) disagrees with that list by more than its own stated
# uncertainty: the chart's exact numeral, asserted.
KNOWN_DIFFERENCES = {'Neogene': '23.04', 'Cretaceous': '143.1'}
RANKS = ['Eon', 'Era', 'Period', 'Sub-Period', 'Epoch', 'Age']


def decimals(s):
    return len(s.split('.')[1]) if '.' in s else 0


def ttl_numerals(text, uid):
    """(begin, begin_unc) numerals of gtsd:<uid> read from the Turtle text itself."""
    m = re.search(r'^gtsd:' + uid + r'\n(.*?)^\.$', text, re.S | re.M)
    assert m, uid
    b = re.search(r'time:hasBeginning\s*\[\s*gtsd:inMYA\s+([0-9.]+)\s*;\s*(?:schema:marginOfError\s+([0-9.]+)\s*;)?',
                  m.group(1))
    return b.group(1), b.group(2)


def main():
    raw = open(os.path.join(DATA, 'timescale.json'), 'rb').read()
    ts = json.loads(raw)
    print(f'timescale.json: {len(raw):,} bytes (cap 40,000); chart version {ts["version"]}, commit {ts["commit"][:12]}')
    assert len(raw) <= 40_000
    units = {u['id']: u for u in ts['units']}
    assert len(units) == len(ts['units']), 'duplicate unit ids'
    for u in ts['units']:
        assert re.fullmatch(r'#[0-9A-F]{6}', u['colour']), u
        assert u['end_ma'] < u['begin_ma'] and u['end_ma'] < 1000
    text = open(source('ics_chart'), encoding='utf-8').read()

    # 1. Phanerozoic period begins against the brief's list.
    print('\nPhanerozoic period begins (Ma): chart | reference | result')
    for pid, refs in REFERENCE.items():
        u = units[pid]
        num, unc = ttl_numerals(text, pid)
        assert float(num) == u['begin_ma'], (pid, num, u['begin_ma'])
        assert (float(unc) if unc else None) == u['begin_unc_ma'], (pid, unc, u['begin_unc_ma'])
        verdict = None
        for ref in refs:
            if round(u['begin_ma'], decimals(ref)) == float(ref):
                verdict = f'equal to {ref} at its precision'
                break
            if u['begin_unc_ma'] is not None and abs(u['begin_ma'] - float(ref)) <= u['begin_unc_ma']:
                verdict = f'within the chart\'s ± {unc} of {ref}'
                break
        if verdict is None:
            assert KNOWN_DIFFERENCES.get(pid) == num, \
                f'{pid}: chart {num} ± {unc} is not {refs} and not a listed difference'
            verdict = (f'DIFFERS: the pinned chart gives {num}{" ± " + unc if unc else ""}, '
                       f'{abs(u["begin_ma"] - float(refs[-1])):.2f} Myr from {refs[-1]} (listed difference)')
        else:
            assert pid not in KNOWN_DIFFERENCES, f'{pid} is listed as a difference but agrees'
        print(f'  {pid:13s} {num}{" ± " + unc if unc else "":9s} | {"/".join(refs):9s} | {verdict}')
    assert units['Phanerozoic']['begin_ma'] == units['Cambrian']['begin_ma']

    # 2. Structure: each rank tiles its span; parents enclose children.
    print()
    found = {}
    for rank, lo_hi in (('Period', (0, 1000)), ('Era', (0, 1000)), ('Epoch', (0, 538.8)), ('Age', (0, 538.8))):
        us = sorted((u for u in ts['units'] if u['rank'] == rank or rank in u.get('also_rank', ())),
                    key=lambda u: (u['begin_ma'], u['end_ma']))
        us = [u for u in us if u['end_ma'] < lo_hi[1]]
        assert us[0]['end_ma'] == lo_hi[0] and us[-1]['begin_ma'] >= lo_hi[1], (rank, us[0]['id'])
        bad = [(a['id'], a['begin_ma'], b['id'], b['end_ma']) for a, b in zip(us, us[1:])
               if a['begin_ma'] != b['end_ma']]
        found[rank] = bad
        print(f'{rank}: {len(us)} units over {us[0]["end_ma"]:g}..{us[-1]["begin_ma"]:g} Ma; '
              f'gaps or overlaps: {bad if bad else "none"}')
    # Two inconsistencies in the pinned chart data. First: Ludlow (Epoch) is given as 426.7-419.62 Ma,
    # overlapping Pridoli (Epoch and Age, 422.7-419.62); Ludlow's last Age, Ludfordian, ends 422.7.
    # Shipped as the chart gives it (timescale.json 'quirks'); no map age lies in 419.62-422.7.
    # And the Aquitanian begins 23.03 Ma while the Chattian ends at 23.04: a 0.01 Myr gap in the Ages.
    assert found == {'Period': [], 'Era': [], 'Age': [('Aquitanian', 23.03, 'Chattian', 23.04)],
                     'Epoch': [('Pridoli', 422.7, 'Ludlow', 419.62)]}, found
    assert units['Ludlow']['end_ma'] == 419.62 and units['Ludfordian']['end_ma'] == 422.7
    assert [q['units'] for q in ts['quirks']] == [['Ludlow', 'Pridoli'], ['Aquitanian', 'Chattian']]
    print('both are the chart data\'s own inconsistencies, listed in timescale.json "quirks"')
    orphans = []
    for u in ts['units']:
        if u['parent'] is None:
            orphans.append(u['id'])
            continue
        p = units[u['parent']]
        assert RANKS.index(p['rank']) < RANKS.index(u['rank']), (u['id'], p['id'])
        assert p['end_ma'] <= u['end_ma'] and u['begin_ma'] <= p['begin_ma'], (u['id'], p['id'])
    print(f'parents: all shipped, coarser and enclosing; units without a shipped parent: {orphans}')
    assert orphans == ['Proterozoic', 'Phanerozoic'] or sorted(orphans) == ['Phanerozoic', 'Proterozoic']

    # 3. Every map in exactly one Period; print them all.
    manifest = json.load(open(os.path.join(DATA, 'manifest.json'), encoding='utf-8'))
    ics = json.load(open(os.path.join(WORK, 'ics_slices.json'), encoding='utf-8'))['maps']
    periods = [u for u in ts['units'] if u['rank'] == 'Period']
    assert len(manifest['slices']) == len(ics) == 90
    print('\nmap  age_ma  period / sub-period / epoch / age  | note')
    for s, m in zip(manifest['slices'], ics):
        a = s['age_ma']
        assert m['map'] == s['map'] and m['age_ma'] == a
        hits = [p['id'] for p in periods
                if p['end_ma'] < a <= p['begin_ma'] or (a == 0 and p['end_ma'] == 0)]
        assert len(hits) == 1, f'map {s["map"]} ({a} Ma) is in {hits}'
        assert hits[0] == m['ics']['period']
        assert m['ics']['colour'] == units[hits[0]]['colour']
        names = ' / '.join(units[m['ics'][k]]['name'] if m['ics'][k] else '-'
                           for k in ('period', 'subperiod', 'epoch', 'age'))
        note = m['ics_note']['text'] if m['ics_note'] else ''
        print(f'{s["map"]:3d} {a:7g}  {names:50s} | {note}')
    print(f'every one of the 90 maps falls inside exactly one Period; card periods: {ts["card_periods"]}')
    assert ts['card_periods'] == list(dict.fromkeys(m['ics']['period'] for m in ics))
    made = [u['id'] + ' -> ' + u['name'] for u in ts['units'] if u['name_from'] == 'id']
    print(f'\n{len(made)} names made from ids: {made}')
    assert len(made) == 21
    notes = [m for m in ics if m['ics_note']]
    print(f'{len(notes)} maps carry a note: {[m["map"] for m in notes]}')
    print('verify_timescale: OK')


if __name__ == '__main__':
    main()
