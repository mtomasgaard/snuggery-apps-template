"""Shared paths for the Besseggen pipeline. Override any of them with an environment variable.

    BESSEGGEN_CACHE   downloaded sources (gitignored; never committed, never re-fetched)
    OUT_DATA          where the shipped files are written   (default ../data)
    WORK_DIR          large intermediates                   (default <cache>/work)

The cache defaults to ../../cache when that folder exists — that is the shared source cache this
app was built from, with cache/SOURCES.md recording every URL and the date it was fetched. In a
fresh clone that folder is absent and the cache falls back to tools/.cache, which .gitignore
already excludes.
"""
import os

TOOLS = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(TOOLS)


def _default_cache():
    shared = os.path.join(os.path.dirname(APP), 'cache')
    return shared if os.path.isdir(shared) else os.path.join(TOOLS, '.cache')


CACHE = os.environ.get('BESSEGGEN_CACHE', _default_cache())
DATA = os.environ.get('OUT_DATA', os.path.join(APP, 'data'))
WORK = os.environ.get('WORK_DIR', os.path.join(CACHE, 'work'))

DTM = os.path.join(CACHE, 'dtm')          # fetched elevation rasters + the assembled masters
VECTORS = os.path.join(CACHE, 'vectors')  # fetched trail and place-name responses
N50 = os.path.join(CACHE, 'n50')          # the N50 Kartdata zips (already present; never re-fetched)

for _d in (CACHE, DATA, WORK, DTM, VECTORS):
    os.makedirs(_d, exist_ok=True)
