"""Build every static file US Quakes ships, in order (tools/CONTRACT.md §2, §4–8):

    assets/history.bin + history.json   build_history.py   (+ tools/ref/history_ref.json)
    assets/relief-*.jpg                  build_relief.py    (only with --relief; otherwise the committed
                                                             JPEGs are checked against relief.json)
    assets/geo.json                      build_geo.py       (+ tools/ref/section_ref.json)
    assets/about.json, stories.json,     build_about.py
    CREDITS.txt

    .venv/bin/python build_static.py [--cutoff 2026-01-01] [--relief]

Reads only the cache and the committed files; no network (fetch_catalog.py, fetch_layers.py and,
for --relief, fetch_relief.py fill the cache first; build_all.sh runs them). Every step asserts its
budgets before writing and writes nothing on failure; a failure here stops the rest.
"""
import argparse
import sys

import build_about
import build_geo
import build_history
import build_relief
from common import BuildError, log
from sources import COMCAT


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--cutoff', default=COMCAT['cutoff'], help='history cutoff, YYYY-01-01 (exclusive)')
    ap.add_argument('--relief', action='store_true', help='rebuild the relief JPEGs (a deliberate act)')
    a = ap.parse_args(argv)
    log('== history')
    build_history.build(a.cutoff)
    log('== relief' + (' (rebuild)' if a.relief else ' (check the committed JPEGs)'))
    build_relief.main([] if a.relief else ['--check'])
    log('== geo')
    build_geo.build()
    log('== about, stories, credits')
    build_about.build()


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        sys.exit(1)
