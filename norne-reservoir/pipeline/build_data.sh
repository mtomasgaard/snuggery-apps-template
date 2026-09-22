#!/usr/bin/env bash
# Rebuild the viewer's data files from the public Norne model. Linux x86_64, Python 3.12, git.
# Usage: pipeline/build_data.sh            (from the norne-reservoir folder)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p work
if [ ! -d work/venv ]; then python3 -m venv work/venv; fi
# shellcheck disable=SC1091
. work/venv/bin/activate
python3 -m pip install --quiet --upgrade pip
python3 -m pip install --quiet -r requirements.txt
python3 fetch_model.py --work work
python3 run_simulation.py --deck work/norne/NORNE_ATW2013.DATA --output-dir work/results
python3 validate.py --results work/results --work work
python3 extract.py --deck work/norne/NORNE_ATW2013.DATA --results work/results --data-dir ../data
echo "Data rebuilt in $(cd .. && pwd)/data"
