"""Shared paths for the Earth's History pipeline. Override any of them with an environment variable.

Copied from Template/milky-way/tools/paths.py and adapted, never imported across apps, so deleting
one app cannot break another.

    EARTHHISTORY_CACHE   downloaded sources (gitignored; never committed)   (default tools/.cache)
    EARTHHISTORY_DATA    where the data/ files are written                  (default ../data)
    EARTHHISTORY_WORK    large intermediates (gitignored)                   (default tools/work)
    EARTHHISTORY_SEED    an optional folder of earlier downloads; fetch() hard-links a file from
                         there instead of downloading it again when its sha256 matches the pin
"""
import os

TOOLS = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(TOOLS)

CACHE = os.environ.get('EARTHHISTORY_CACHE', os.path.join(TOOLS, '.cache'))
DATA = os.environ.get('EARTHHISTORY_DATA', os.path.join(APP, 'data'))
WORK = os.environ.get('EARTHHISTORY_WORK', os.path.join(TOOLS, 'work'))
SEED = os.environ.get('EARTHHISTORY_SEED', '')
CREDITS = os.path.join(TOOLS, 'credits')

for _d in (CACHE, DATA, WORK, CREDITS):
    os.makedirs(_d, exist_ok=True)
