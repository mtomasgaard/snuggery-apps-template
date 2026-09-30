#!/usr/bin/env bash
# Build US Quakes' static data, end to end, and verify it (tools/CONTRACT.md §9–11).
#
#   ./build_all.sh                        # cutoff 2026-01-01; fetches only what the cache lacks
#   ./build_all.sh --cutoff 2027-01-01    # the January rebuild: only the new year is downloaded
#   ./build_all.sh --offline              # never touch the network (also skips the USGS count check)
#   ./build_all.sh --relief               # also rebuild the relief JPEGs (a deliberate act; they are committed)
#   ./build_all.sh --twice                # then rebuild and prove assets/ and CREDITS.txt are byte-identical
#
# Steps: fetch_catalog.py -> fetch_layers.py -> [fetch_relief.py] -> build_static.py -> verify_static.py.
# Any failure stops the run; no step writes a partial file. The live snapshot (data/snapshot.json)
# is refresh.py's, not this script's.
#
# PYTHON defaults to the pipeline's venv (.venv/bin/python); a runner sets PYTHON=python3.
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-.venv/bin/python}"
CUTOFF=2026-01-01
OFFLINE=""
RELIEF=""
TWICE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --cutoff) CUTOFF="$2"; shift 2 ;;
    --offline) OFFLINE="--offline"; shift ;;
    --relief) RELIEF="--relief"; shift ;;
    --twice) TWICE=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

echo "== fetch_catalog (cutoff $CUTOFF)"
"$PY" fetch_catalog.py --cutoff "$CUTOFF" $OFFLINE
echo "== fetch_layers"
"$PY" fetch_layers.py $OFFLINE
if [ -n "$RELIEF" ]; then
  echo "== fetch_relief"
  "$PY" fetch_relief.py $OFFLINE
fi
echo "== build_static"
"$PY" build_static.py --cutoff "$CUTOFF" $RELIEF
echo "== verify_static"
"$PY" verify_static.py $OFFLINE

digest() { (cd ../../us-quakes && shasum -a 256 assets/* CREDITS.txt tools/ref/*.json); }
if [ "$TWICE" = 1 ]; then
  echo "== determinism: rebuild and compare"
  first="$(digest)"
  "$PY" build_static.py --cutoff "$CUTOFF" $RELIEF > /dev/null 2>&1
  second="$(digest)"
  echo "$second"
  if [ "$first" != "$second" ]; then
    diff <(echo "$first") <(echo "$second") || true
    echo "NOT byte-identical" >&2
    exit 1
  fi
  echo "byte-identical: $(echo "$second" | wc -l | tr -d ' ') files"
fi
echo "build_all: done"
