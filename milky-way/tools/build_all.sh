#!/bin/sh
# Rebuilds data/ from pinned open data. The first run downloads about 3 GB into a gitignored cache
# (tools/.cache) — mostly JPL's satellite ephemerides and one USGS Mars mosaic — and then never
# touches the network again; a warm rebuild reads the cache only.
#
# Env overrides:
#   PYTHON           the interpreter to use (default: tools/venv, created if missing)
#   MILKYWAY_CACHE   where downloads live   (default: tools/.cache)
#   MILKYWAY_SEED    a folder of earlier downloads to hard-link from instead of downloading
#   OUT_DATA         where the shipped files go (default: ../data)
set -eu
cd "$(dirname "$0")"

if [ -z "${PYTHON:-}" ]; then
  if [ -x ./venv/bin/python ]; then PYTHON=./venv/bin/python
  else
    echo "no venv found — creating tools/venv"
    python3 -m venv ./venv
    ./venv/bin/python -m pip install --quiet --upgrade pip
    ./venv/bin/python -m pip install --quiet -r requirements.txt
    PYTHON=./venv/bin/python
  fi
fi
echo "python: $PYTHON"

step() { echo; echo "== $1"; shift; "$PYTHON" "$@"; }
step "planets and the Moon — JPL DE430"                  10_ephemeris.py
step "major moons — JPL satellite ephemerides"           11_moons.py
step "sizes, shapes and rotation — NAIF PCK, IAU"        12_physical.py
step "asteroids and comets — JPL SBDB, Minor Planet Center" 20_smallbodies.py
step "planet maps — NASA, USGS"                          30_textures.py
step "the sky — Gaia DR3 source counts"                  31_sky.py
step "stars — AT-HYG, HYG, Stellarium, OEC"              40_stars.py
step "the galaxy — LVDB, galstreams, SpiralMap, Agama"   50_galaxy.py
step "credits and the About panel"                       90_about.py
echo
echo "== verifying the contract"
"$PYTHON" verify_data.py
echo
echo "Done. Look at it with:  cd .. && python3 -m http.server 8000"
echo "Package it for Snuggery with:  $PYTHON package_snuggery.py"
