"""Fetch the static map layers and check every pin: the Quaternary Fault and Fold Database ZIP, the
sixteen Natural Earth files (sources.STATIC), and the committed volcano list
(samples/volcano-getUSVolcanoes.json, sources.VOLCANO_LIST_SAMPLE).

    .venv/bin/python fetch_layers.py                        # fetch what is missing, verify every sha256
    .venv/bin/python fetch_layers.py --offline              # verify the cache only
    .venv/bin/python fetch_layers.py --refresh-volcanoes    # re-save the volcano list from the HANS API,
                                                            # print its new pin, and stop (a deliberate act)

A changed upstream file stops the build (common.fetch_pinned); nothing is ever silently replaced.
Writes the credits fragment cache/work/credits/fetch_layers.json.
"""
import argparse
import os
import sys

from common import (group, BuildError, RETRIEVED, fetch_pinned, http_get, log, sha256_bytes, sha256_of,
                    write_credits_fragment)
from paths import CACHE, HERE
from sources import NE_COMMIT, STATIC, VOLCANO_LIST_SAMPLE, VOLCANOES


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--offline', action='store_true')
    ap.add_argument('--refresh-volcanoes', action='store_true')
    a = ap.parse_args(argv)

    if a.refresh_volcanoes:
        body = http_get(VOLCANOES['us_list'])
        p = os.path.join(HERE, VOLCANO_LIST_SAMPLE['path'])
        with open(p, 'wb') as f:
            f.write(body)
        print(f"re-saved {VOLCANO_LIST_SAMPLE['path']}: set sources.VOLCANO_LIST_SAMPLE to\n"
              f"    'sha256': '{sha256_bytes(body)}', 'bytes': {len(body)}, and 'retrieved' to today's date")
        sys.exit(1)

    for key, s in STATIC.items():
        if a.offline and not os.path.exists(os.path.join(CACHE, s['name'])):
            raise BuildError(f'offline and {s["name"]} is not cached')
        fetch_pinned(s['url'], s['name'], s['sha256'], s['bytes'])
        print(f'{key:16s} ok  {s["bytes"]:>11,} B  {s["name"]}')

    vp = os.path.join(HERE, VOLCANO_LIST_SAMPLE['path'])
    got = sha256_of(vp)
    if got != VOLCANO_LIST_SAMPLE['sha256'] or os.path.getsize(vp) != VOLCANO_LIST_SAMPLE['bytes']:
        raise BuildError(f'{VOLCANO_LIST_SAMPLE["path"]}: sha256 {got} does not match its pin '
                         f'{VOLCANO_LIST_SAMPLE["sha256"]}')
    print(f'{"volcano-list":16s} ok  {VOLCANO_LIST_SAMPLE["bytes"]:>11,} B  {VOLCANO_LIST_SAMPLE["path"]}')

    ne = [k for k in STATIC if k.startswith('ne_')]
    NOT_SHIPPED = {'ne_lakes': ', used only for the relief\'s lake mask and to choose the 1:10m lakes drawn, not shipped',
                   'ne_states': ', used only to choose the countries whose state lines are drawn, not shipped'}
    write_credits_fragment('fetch_layers', [
        {'id': 'qfaults',
         'source': [f'{os.path.basename(STATIC["qfaults"]["name"])} ({group(STATIC["qfaults"]["bytes"])} B, '
                    f'sha256 {STATIC["qfaults"]["sha256"]}), from {STATIC["qfaults"]["url"]}; read: '
                    + STATIC['qfaults']['read']],
         'retrieved': STATIC['qfaults']['retrieved'], 'adaptations': []},
        {'id': 'naturalearth',
         'source': [f'{STATIC[k]["name"].split("/")[-1]} ({group(STATIC[k]["bytes"])} B, sha256 {STATIC[k]["sha256"]})'
                    + NOT_SHIPPED.get(k, '')
                    for k in ne] + [f'from the natural-earth-vector repository at commit {NE_COMMIT} (tag v5.1.2)'],
         'retrieved': RETRIEVED, 'adaptations': []},
        {'id': 'volcano-list',
         'source': [f'getUSVolcanoes ({VOLCANOES["us_list"]}), saved as scripts/us_quakes/'
                    f'{VOLCANO_LIST_SAMPLE["path"]} ({group(VOLCANO_LIST_SAMPLE["bytes"])} B, sha256 '
                    f'{VOLCANO_LIST_SAMPLE["sha256"]})'],
         'retrieved': VOLCANO_LIST_SAMPLE['retrieved'], 'adaptations': []},
    ])


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        sys.exit(1)
