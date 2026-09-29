#!/bin/sh
# Rebuilds data/ from the BodyParts3D source and data/female/ from the Human-Atlas package.
# Takes a few minutes and downloads about 1.4 GB once.
# Env overrides: BP3D_STL_DIR (STL cache), OUT_DATA (output folder, default ../data), WORK_DIR.
set -eu
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
python3 -c "import numpy, fast_simplification" 2>/dev/null || python3 -m pip install -r requirements.txt
python3 fetch_stl.py
node build_skeleton.mjs
python3 build_soft.py
python3 build_anatomy.py
python3 build_full.py
python3 fetch_atlas.py       # BodyParts3D 4.0 vessels and the female body, about 120 MB once
python3 build_vessels.py
python3 build_female.py
echo "Done. Check the app with: cd .. && python3 -m http.server 8000"
