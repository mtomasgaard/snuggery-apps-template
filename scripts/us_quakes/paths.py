"""Shared paths for the US Quakes pipeline. Override any of them with an environment variable.

Adapted from Template/earth-history/tools/paths.py, never imported across apps, so deleting one app
cannot break another.

    USQUAKES_CACHE   downloads: pinned static files and closed catalogue windows
                     (gitignored as scripts/us_quakes/cache/; kept between runs by actions/cache)
    USQUAKES_APP     the app folder the build writes into              (default Template/us-quakes)
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.dirname(os.path.dirname(HERE))

CACHE = os.environ.get('USQUAKES_CACHE', os.path.join(HERE, 'cache'))
APP = os.environ.get('USQUAKES_APP', os.path.join(TEMPLATE, 'us-quakes'))
ASSETS = os.path.join(APP, 'assets')
DATA = os.path.join(APP, 'data')
CREDITS = os.path.join(HERE, 'credits')
