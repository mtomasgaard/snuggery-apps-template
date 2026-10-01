"""Shared paths for the Warming World pipeline. Override any of them with an environment variable.

Adapted from Template/scripts/us_quakes/paths.py, never imported across apps, so deleting one app
cannot break another.

    WARMINGWORLD_CACHE   downloads: the GISTEMP grid and table, Natural Earth
                         (gitignored as scripts/warming_world/cache/; kept between runs by actions/cache)
    WARMINGWORLD_APP     the app folder the build writes into          (default Template/warming-world)
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.dirname(os.path.dirname(HERE))

CACHE = os.environ.get('WARMINGWORLD_CACHE', os.path.join(HERE, 'cache'))
APP = os.environ.get('WARMINGWORLD_APP', os.path.join(TEMPLATE, 'warming-world'))
ASSETS = os.path.join(APP, 'assets')
DATA = os.path.join(APP, 'data')
CREDITS = os.path.join(HERE, 'credits')
