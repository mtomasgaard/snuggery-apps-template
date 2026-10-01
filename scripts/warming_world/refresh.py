#!/usr/bin/env python3
"""The monthly refresh of Warming World's data/snapshot.json, under the name tools/CONTRACT.md §10
and .github/workflows/refresh-warming-world.yml use. The code is build_snapshot.py; this file only
runs it, with the live source as the default:

    python3 scripts/warming_world/refresh.py --out out/warming-world/data/snapshot.json --skip-release "$ID"

Every option of build_snapshot.py applies (--source, --offline, --force, --ref, --generated-at).
Standard library + requests only.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_snapshot  # noqa: E402

if __name__ == '__main__':
    sys.exit(build_snapshot.run())
