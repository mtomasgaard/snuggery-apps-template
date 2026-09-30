"""Verify data/story.json (tools/CONTRACT.md §14): re-run step 60's checks on the shipped file — not on
the YAML — re-partition every pin with pygplates and compare plate, plate index and from_ma, re-measure
the map claims, and print the word counts. Exits non-zero on any failure.
"""
import importlib.util
import json
import os
import sys

import numpy as np

from paths import DATA, TOOLS
from story_check import check_story, numbers_in, words

CAP = 60_000


def step60():
    spec = importlib.util.spec_from_file_location('step60', os.path.join(TOOLS, '60_story.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


def main():
    s60 = step60()
    path = os.path.join(DATA, 'story.json')
    size = os.path.getsize(path)
    story, timescale, plates, manifest, places = (load(n) for n in (
        'story.json', 'timescale.json', 'plates.json', 'manifest.json', 'places.json'))
    errs, rep = check_story(story, timescale, plates['plates'], manifest['slices'])
    if size > CAP:
        errs.append(f'story.json is {size:,} bytes, over {CAP:,}')

    # derived fields: period cards carry the chart's numbers, events the period containing their age
    units = {u['id']: u for u in timescale['units']}
    for c in story['periods']:
        u = units[c['ics']]
        for k in ('name', 'begin_ma', 'begin_unc_ma', 'end_ma', 'end_unc_ma', 'colour'):
            if c.get(k) != u.get(k):
                errs.append(f"card {c['ics']}: {k} {c.get(k)!r} differs from timescale.json {u.get(k)!r}")
    ages = [float(e['age_ma']) for e in story['events']]
    if ages != sorted(ages, reverse=True):
        errs.append('events are not oldest first')

    # pins: the partition again, independently of step 60's run
    rm, pp = s60.partitioner()
    pindex = {pid: i for i, pid in enumerate(plates['plates'])}
    for x in story['look_for']:
        part = s60.partition(pp, x['lon'], x['lat'])
        if part is None:
            errs.append(f"pin {x['id']}: unclaimed")
            continue
        pid, begin = part
        want = (pid, pindex.get(pid), s60.fin(begin))
        got = (x['plate'], x['pi'], x['from_ma'])
        if want != got:
            errs.append(f"pin {x['id']}: (plate, pi, from_ma) {got} != partition {want}")
        if x['from_ma'] is not None and x['from_ma'] < x['window_ma'][0]:
            errs.append(f"pin {x['id']}: crust carried back only to {x['from_ma']} Ma, window {x['window_ma']}")
        # the pin rotated to each map in its window, with pygplates (printed for the reviewers)
        lat = [s60.paleolat(rm, x['lon'], x['lat'], pid, s['rotation_ma']) for s in manifest['slices']
               if x['window_ma'][1] <= s['age_ma'] <= x['window_ma'][0]]
        x['_lat'] = (min(lat), max(lat))

    claims = s60.map_claims(manifest['slices'], timescale, rm, places)
    for cid, card, text, value, ok in claims:
        if not ok:
            errs.append(f'map claim {cid}: {text}: {value}')

    print(f'story.json: {size:,} bytes (budget {CAP:,})')
    print(f"sources {len(story['sources'])}, cards {len(story['periods'])} + prologue, "
          f"events {len(story['events'])}, pins {len(story['look_for'])}")
    n_numbers = sum(len(numbers_in(i.get('text'), i.get('title'), i.get('label'), i.get('when')))
                    for i in story['periods'] + story['events'] + story['look_for'] + [story['prologue']])
    print(f'numerals in the texts: {n_numbers}, every one mapped to a cited source')
    print('word counts (limits: cards 90, events 45, pins 25):')
    for c in story['periods'] + [dict(story['prologue'], ics='prologue')]:
        print(f"  card  {c['ics']:22s} {words(c['text']):3d}")
    for e in story['events']:
        print(f"  event {e['id']:22s} {words(e['text']):3d}   title {len(e['title']):2d} chars")
    for x in story['look_for']:
        print(f"  pin   {x['id']:22s} {words(x['text']):3d}   label {len(x['label']):2d} chars   "
              f"plate {x['plate']}   paleolatitude {x['_lat'][0]:.0f}° to {x['_lat'][1]:.0f}° in its window")
    print('map claims:', ', '.join(f"{cid} {'ok' if ok else 'FAIL'}" for cid, _, _, _, ok in claims))
    if errs:
        print('FAILED:')
        for e in errs:
            print('  -', e)
        sys.exit(1)
    print('verify_story: all checks pass')


if __name__ == '__main__':
    main()
