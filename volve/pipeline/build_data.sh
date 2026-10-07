#!/usr/bin/env bash
# Rebuild Volve's data/ from pinned sources: Equinor's deck run in OPM Flow, and the cropped seismic.
#   build_data.sh            everything (Linux x86_64 with Docker, Python 3.12)
#   build_data.sh prepare    fetch, provenance, deck, checks, seismic, wells, tests (any machine with the
#                            opm wheel: Linux x86_64, or macOS arm64 with 'brew install cjson fmt')
#   build_data.sh simulate   OPM Flow in Docker (VOLVE_FLOW_NP sets the MPI ranks; 1 runs without MPI)
#   build_data.sh finish     validate the run against Equinor's, then extract the model files
# Working files go to $VOLVE_WORK (default pipeline/work). Outputs go to ../data.
set -euo pipefail
cd "$(dirname "$0")"
WORK=${VOLVE_WORK:-work}
STAGE=${1:-all}
mkdir -p "$WORK"
if [ ! -d "$WORK/venv" ]; then python3 -m venv "$WORK/venv"; fi
# shellcheck disable=SC1091
. "$WORK/venv/bin/activate"
if [ "$STAGE" = all ] || [ "$STAGE" = prepare ]; then
  python3 -m pip install --quiet --require-hashes --only-binary=:all: -r requirements.txt
  python3 fetch_inputs.py --inputs "$WORK/inputs"
  python3 check_provenance.py --inputs "$WORK/inputs"
  python3 prepare_deck.py --inputs "$WORK/inputs" --out "$WORK/deck"
  python3 check_static.py --deck "$WORK/deck/VOLVE_2016.DATA" --inputs "$WORK/inputs"
  python3 ../tools/check_keywords.py --deck "$WORK/deck/VOLVE_2016.DATA" --cache "$WORK/opm-src"
  python3 seismic.py --deck "$WORK/deck" --inputs "$WORK/inputs" --data-dir ../data
  python3 wells.py --inputs "$WORK/inputs" --data-dir ../data
  # The seeded fingerprint was measured on macOS arm64; here it is reported, not a gate (a libm
  # difference in one tail draw must not stop the run). The identity that matters, seismic.bin's
  # bytes against the committed file, is checked by the workflow after this stage.
  python3 ../tools/test_seismic.py --fingerprint-report-only
fi
if [ "$STAGE" = all ] || [ "$STAGE" = simulate ]; then
  ./run_flow.sh "$WORK/deck" "$WORK/results" "${VOLVE_FLOW_NP:-$(nproc)}"
fi
if [ "$STAGE" = all ] || [ "$STAGE" = finish ]; then
  python3 validate.py --results "$WORK/results" --inputs "$WORK/inputs" --data-dir ../data --opm 2026.04
  python3 extract.py --deck "$WORK/deck/VOLVE_2016.DATA" --results "$WORK/results" --data-dir ../data
fi
echo "Stage '$STAGE' done; data in $(cd .. && pwd)/data"
ls -l ../data
