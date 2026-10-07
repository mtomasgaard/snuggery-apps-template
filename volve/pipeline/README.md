# pipeline

Rebuilds `volve/data` from pinned public copies of Equinor's Volve files. `build_data.sh` runs it in
three stages; the GitHub Actions workflow *Rebuild Volve data* (`.github/workflows/rebuild-volve.yml`,
manual only) runs them on an ubuntu-24.04 runner and uploads `data/` as one artifact. Each script has
`--help`.

| Stage | Script | What it does |
| --- | --- | --- |
| prepare | `fetch_inputs.py` | every file in `sources.json`, checked by size, sha256 and git blob id (the terms PDFs only with `--check-terms`) |
| | `check_provenance.py` | the deck against Equinor's own run log (`VOLVE_2016.PRT`) |
| | `prepare_deck.py` | the stated edits, nothing else; the list goes to `work/deck/EDITS.json` |
| | `check_static.py` | the model OPM builds against Equinor's `VOLVE_2016.INIT`, cell by cell |
| | `../tools/check_keywords.py` | every keyword against OPM Flow 2026.04's own support tables; the summary vectors |
| | `seismic.py` | the cropped, anti-aliased, 25 m, 8-bit seismic and its grid (`seismic.bin`, `.json`), the horizons |
| | `wells.py` | well paths below sea level with Equinor's picks, monthly production |
| | `../tools/test_seismic.py` | aliasing, zero at 128, the geometry round trip, a cross-machine fingerprint (reported, not a gate) |
| simulate | `run_flow.sh` | OPM Flow 2026.04 in the official Docker image, pinned by digest, MPI (`--oversubscribe`) |
| finish | `validate.py` | the run against Equinor's Eclipse summary; fails outside the stated tolerances |
| | `extract.py` | the model files, as Norne's pipeline makes them, in ED50 / UTM 31N |

`prepare` runs anywhere the `opm` wheel runs (Linux x86_64; macOS arm64 after `brew install cjson fmt`).
`simulate` needs Linux x86_64 and Docker. Decisions and measurements: `../tools/DECISIONS.md`.
