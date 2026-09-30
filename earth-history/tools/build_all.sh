#!/bin/sh
# Rebuilds data/ from pinned open data. The first run downloads about 860 MB into a gitignored
# cache (tools/.cache) — mostly the two PhanDA climate zips — and then never touches the network
# again; a warm rebuild reads the cache only. Every download is checked against its sha256 in
# sources.py, and two runs from the same cache write byte-identical files.
#
# Env overrides:
#   PYTHON               the interpreter to use (default: tools/.venv, created if missing from
#                        python3.12 — pygplates 1.0.0 ships a cp312 wheel)
#   EARTHHISTORY_CACHE   where downloads live      (default: tools/.cache)
#   EARTHHISTORY_SEED    a folder of earlier downloads to hard-link from instead of downloading
#   EARTHHISTORY_DATA    where the data/ files go  (default: ../data)
#   EARTHHISTORY_WORK    intermediates             (default: tools/work)
set -eu
cd "$(dirname "$0")"

if [ -z "${PYTHON:-}" ]; then
  if [ -x ./.venv/bin/python ]; then PYTHON=./.venv/bin/python
  else
    PY312=""
    for c in /opt/homebrew/bin/python3.12 python3.12; do
      if command -v "$c" >/dev/null 2>&1; then PY312="$c"; break; fi
    done
    if [ -z "$PY312" ]; then echo "python3.12 not found (pygplates 1.0.0 needs CPython 3.12)"; exit 1; fi
    echo "no venv found — creating tools/.venv from $PY312"
    "$PY312" -m venv ./.venv
    ./.venv/bin/python -m pip install --quiet --upgrade pip
    ./.venv/bin/python -m pip install --quiet -r requirements.txt
    PYTHON=./.venv/bin/python
  fi
fi
echo "python: $PYTHON"

step() { echo; echo "== $1"; shift; "$PYTHON" "$@"; }
step "painted maps — Scotese PALEOMAP PaleoAtlas v3"               10_surface.py
step "verify: maps, sizes, registration against Natural Earth"      verify_surface.py
step "plate model, coasts, places — PALEOMAP rotations, Natural Earth" 20_plates.py
step "verify: layout, validity, quaternions, rotation-time gate"    verify_plates.py
step "climate model annual means — PhanDA HadCM3L scotese_07"       30_climate.py
step "verify: size, encoding, raw re-read, 0 Ma mean, the sheet"     verify_climate.py
step "elevation classes — Scotese & Wright 2018 PaleoDEMs, Table 2"   35_elevation.py
step "verify: size, every byte from the raw grids, land and shelf %"  verify_elevation.py
step "curves and tiles — Foster 2017, van der Meer 2022, PaleoDEMs"  40_curves.py
step "verify: grid, coverage, ranges, spot values, tiles"            verify_curves.py
step "timescale — ICS chart.ttl at the pinned commit"                50_timescale.py
step "verify: period boundaries, tiling, one period per map"         verify_timescale.py
step "the words — period cards, events, look-for pins (content/story.yaml)" 60_story.py
step "verify: limits, sources, numbers, ages, pins, map claims"      verify_story.py
step "the full manifest — ICS, climate and elevation slices, tiles"   80_manifest.py
step "verify: ICS re-found, matches recomputed, tiles from the sheets" verify_manifest.py
step "About panel and CREDITS.txt — from the credits fragments"      90_about.py
# Each step's verify has just run; verify_data.py alone runs them all again before these checks.
step "verify: claimed files, caps, layouts, one plate model, cross-file" verify_data.py --cross-only
echo
echo "Done. Look at it with:  cd .. && python3 -m http.server 8000"
