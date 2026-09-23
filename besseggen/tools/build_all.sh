#!/bin/sh
# Rebuilds data/ from Kartverket's open data. Downloads about 365 MB once into a gitignored cache
# and then never touches the network again; a rebuild from a cold cache takes a few minutes,
# from a warm one about fifteen seconds.
#
# Env overrides:
#   PYTHON            the interpreter to use (default: an existing venv, else tools/venv)
#   BESSEGGEN_CACHE   where downloads live   (default: ../../cache if present, else tools/.cache)
#   OUT_DATA          where the shipped files go (default: ../data)
#   WORK_DIR          large intermediates    (default: <cache>/work)
set -eu
cd "$(dirname "$0")"

if [ -z "${PYTHON:-}" ]; then
  if   [ -x ./venv/bin/python ];      then PYTHON=./venv/bin/python
  elif [ -x ../../venv/bin/python ];  then PYTHON=../../venv/bin/python
  else
    echo "no venv found — creating tools/venv with python3.12"
    python3.12 -m venv ./venv
    ./venv/bin/python -m pip install --quiet --upgrade pip
    ./venv/bin/python -m pip install --quiet -r requirements.txt
    PYTHON=./venv/bin/python
  fi
fi
echo "python: $PYTHON"
"$PYTHON" -c "import numpy, rasterio, pyproj, shapely, pyogrio, requests" \
  || { echo "missing dependencies: $PYTHON -m pip install -r requirements.txt"; exit 1; }

echo
echo "1/6  elevation — Nasjonal hoydemodell DTM1, Kartverket"
"$PYTHON" 01_fetch_terrain.py
echo
echo "2/6  vectors — Turrutebasen, SSR, N50 Kartdata, Kartverket"
"$PYTHON" 02_fetch_vectors.py
echo
echo "3/6  the walk, assembled from the marked foot routes"
"$PYTHON" 03_route.py
echo
echo "4/6  terrain tiles and the manifest"
"$PYTHON" 04_terrain.py
echo
echo "5/6  the GeoJSON layers"
"$PYTHON" 05_vectors.py
echo
echo "6/6  the editable files"
"$PYTHON" 06_editable.py
echo
echo "verifying the contract"
"$PYTHON" verify_data.py

echo
echo "Done. Look at it with:  cd .. && python3 -m http.server 8000"
echo "Package it for Snuggery with:  $PYTHON package_snuggery.py"
