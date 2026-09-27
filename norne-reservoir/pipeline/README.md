# pipeline

Rebuilds `data/model.json` and the five `.bin` files from the public Norne deck:
`fetch_model.py` → `run_simulation.py` → `validate.py` → `extract.py`. It needs OPM Flow, which
publishes Linux x86_64 wheels only, and takes hours; `build_data.sh` runs the whole chain, and the
GitHub Actions workflow *Rebuild Norne reservoir data* runs it on a Linux runner and uploads the
result as an artifact. Each script has `--help`.

`validate.py` compares the run with the Eclipse 2014.2 reference summary OPM publishes in
opm-tests and fails above `--tolerance` percent (default 1 %) on the field totals.
