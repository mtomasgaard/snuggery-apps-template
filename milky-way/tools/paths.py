"""Shared paths for the Milky Way pipeline. Override any of them with an environment variable.

    MILKYWAY_CACHE    downloaded sources (gitignored; never committed)
    OUT_DATA          where the data/ files are written     (default ../data); data/ only: CREDITS.txt
                      and credits/*.json are always rewritten in place
    WORK_DIR          large intermediates                   (default <cache>/work)
    MILKYWAY_SEED     an optional folder of earlier downloads; fetch() hard-links a file from there
                      instead of downloading it again when its sha256 matches the pin
"""
import os

TOOLS = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(TOOLS)

CACHE = os.environ.get('MILKYWAY_CACHE', os.path.join(TOOLS, '.cache'))
DATA = os.environ.get('OUT_DATA', os.path.join(APP, 'data'))
WORK = os.environ.get('WORK_DIR', os.path.join(CACHE, 'work'))
SEED = os.environ.get('MILKYWAY_SEED', '')

for _d in (CACHE, DATA, WORK):
    os.makedirs(_d, exist_ok=True)
