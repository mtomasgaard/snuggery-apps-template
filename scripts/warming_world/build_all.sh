#!/usr/bin/env bash
# Build Warming World's data end to end and verify it (warming-world/tools/CONTRACT.md §5, §8, §9).
#
#   ./build_all.sh                    # the demo snapshot from the Internet Archive pins (cache-first), then static
#   ./build_all.sh --offline          # the same, never touching the network
#   ./build_all.sh --source live      # the demo snapshot from GISS's live files instead (when GISS answers)
#   ./build_all.sh --twice            # then rebuild everything and prove it byte-identical
#
# Steps: build_snapshot.py --ref (data/snapshot.json, tools/ref/snapshot_ref.json, the GISTEMP credits
# fragment) -> build_static.py (assets/*.json, CREDITS.txt from the fragments) -> verify_static.py ->
# verify_snapshot.py. Any failure stops the run; no step writes a partial file. The snapshot comes
# first because CREDITS.txt carries the demo's GISTEMP access date from its fragment.
#
# The monthly refresh on GitHub is refresh.py in refresh-warming-world.yml, not this script.
# PYTHON defaults to the pipeline's venv (.venv/bin/python); a runner sets PYTHON=python3.
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-.venv/bin/python}"
SOURCE=research
OFFLINE=""
TWICE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    --offline) OFFLINE="--offline"; shift ;;
    --twice) TWICE=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

echo "== build_snapshot ($SOURCE)"
"$PY" build_snapshot.py --source "$SOURCE" $OFFLINE --ref
echo "== build_static"
"$PY" build_static.py $OFFLINE
echo "== verify_static"
"$PY" verify_static.py
echo "== verify_snapshot"
"$PY" verify_snapshot.py

digest() {
  (cd ../../warming-world && shasum -a 256 assets/*.json CREDITS.txt data/snapshot.json tools/ref/*.json)
  shasum -a 256 credits/fragments/*.json
}
if [ "$TWICE" = 1 ]; then
  echo "== determinism: rebuild and compare"
  first="$(digest)"
  "$PY" build_snapshot.py --source "$SOURCE" --offline --ref > /dev/null 2>&1
  "$PY" build_static.py --offline > /dev/null 2>&1
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
