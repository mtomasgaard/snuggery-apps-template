# Volve

The data pipeline for a Volve app: Norne Reservoir's functionality on a second North Sea field, with
the field's seismic along the section. This folder holds part 1 of plan 0012's D10 (the pipeline and
the data); the app itself (part 2) is built from Norne Reservoir 2.2's code and is not here yet.

## What the data is

Equinor and the former Volve licence partners released the Volve field's data in 2018 under
Equinor's own terms (a CC BY 4.0 with "you may not sell the Licensed Material" added). This folder
uses:

- **The simulation model**: Equinor's Eclipse deck `VOLVE_2016.DATA` (108 × 100 × 63 cells, 183,545
  active; black oil; 31 Dec 2007 to 1 Oct 2016 on the field's well history), to be run by the
  workflow in OPM Flow 2026.04 and checked against Equinor's own Eclipse 2015.1 results. **Pending:
  no Flow run has been made yet**, so `data/` holds only the seismic, horizons, wells, production,
  attribution and terms until the workflow's artifact is committed (see "What the lead does").
- **The seismic**: survey ST0202 (2002 baseline, ocean-bottom cable), the PS PSDM full-offset stack
  in depth from the 2008 processing, the only depth stack anyone can reach without a Databricks
  account, cut to the model and decimated to 25 m traces by industry convention (D11).
- **Hugin Fm top and base horizons**, **21 well paths** with Equinor's formation picks, and the
  **monthly production** per wellbore.

No 4D: the 2010 monitor survey is only in Equinor's Databricks copy.

## Files in data/

| File | What | Built by |
| --- | --- | --- |
| `seismic.bin`, `seismic.json` | 144 × 188 traces at 25 m × 352 samples at 5 m (2,295–4,050 m), 8 bits | `seismic.py` (here) |
| `horizons.bin` | Hugin Fm top and base on the seismic's grid | `seismic.py` (here) |
| `wellpaths.json`, `production.json` | well paths below sea level with picks; monthly production | `wells.py` (here) |
| `model.json`, `geometry.bin`, `neighbours.bin`, `ijk.bin`, `static.bin`, `dynamic.bin` | the model as Norne's app reads it, in ED50 / UTM 31N, 37 quarterly frames | `extract.py` (the workflow) |
| `validation.json` | our run against Equinor's | `validate.py` (the workflow) |
| `ATTRIBUTION.txt`, `TERMS-Volve-2026-10-07.txt` | the credit, every adaptation, and Equinor's terms | by hand |

Formats are in `data/ATTRIBUTION.txt` and `data/seismic.json`. The model and the seismic share one
map frame (ED50 / UTM zone 31N) and one depth axis (metres below mean sea level, positive down), each
at its own original depths: nothing is shifted or tied (D11). Neither source states its datum: the
model's is measured as sea level (its completed cells lie on the surveyed well paths;
`tools/measure_datum.py`, DECISIONS §7), the seismic's is inferred as sea level (tidal statics in its
processing). The PS image is depth-converted with its own converted-wave velocities, so its
reflectors may sit off the well-adjusted horizons and the model; `seismic.json` says so
(`depthRelation`), and its polarity line is qualified for a PS image (`polarityNote`). The model
files appear only after the workflow has run.

## How it is built

`pipeline/build_data.sh` (see `pipeline/README.md`), in three stages:

1. **prepare**: fetch every input pinned by commit or URL and sha256 (`pipeline/sources.json`);
   prove the deck is the one Equinor ran (its run log and its INIT); make the stated edits; check
   every keyword against OPM Flow 2026.04; cut the seismic by HTTP range requests; write the wells;
   run the seismic tests. Runs on Linux x86_64 or macOS arm64 (`brew install cjson fmt` first).
2. **simulate**: OPM Flow 2026.04 in the official Docker image pinned by digest, 4 MPI processes
   (`mpirun --oversubscribe --bind-to none`, so a runner with 2 cores and 4 threads still starts 4
   ranks; the log prints `nproc` and `lscpu`).
3. **finish**: validate against Equinor's run (fails loudly), then extract.

Between prepare and simulate the workflow compares the files prepare wrote with the committed ones
(sha256 and `git diff --stat`, a warning if they differ, never fatal). The seismic test's seeded
fingerprint was measured on macOS arm64 only, so in the pipeline it is reported, not a gate.
Equinor's terms PDFs are not fetched by a rebuild; `fetch_inputs.py --check-terms` is the
maintainer's check that they still match their pins.

A re-run from the pins gives byte-identical files: measured for everything `prepare` writes (two
complete builds, the seismic read twice from the network) and for `extract.py` on the same run.

The deck needs more than report-setting edits to run in OPM, and every one is stated in
`data/ATTRIBUTION.txt`; `tools/DECISIONS.md` gives the evidence for each, and every other decision.

## What the lead does

1. Review this folder and `.github/workflows/rebuild-volve.yml`. Decide on the deck edits
   (`tools/DECISIONS.md` §2): they go beyond "report settings only", because OPM cannot otherwise run
   the deck.
2. **Before publishing**, add the data carve-out to `Template/LICENSE`, as for the other apps' data.
   Without it the repository's licence file would on its face put Equinor's material under MIT
   (against clause 3.3). Suggested paragraph: "`volve/data` is adapted from the Volve data set,
   © Equinor ASA and the former Volve licence partners, under Equinor's 'Terms and conditions for
   licence to data - Volve'. It is not under the MIT licence and is not for sale; see
   `volve/data/ATTRIBUTION.txt` and `volve/data/TERMS-Volve-2026-10-07.txt`."
3. Commit, then publish `Template/` to `mtomasgaard/snuggery-apps-template` by MANUAL_STEPS §32,
   mirroring `volve/data/` on purpose (the habitual mirror leaves `*/data/` out) and with
   `--exclude 'pipeline/work/'` (the pipeline's working folder; `volve/.gitignore` ignores it too).
4. Dispatch the workflow in the public repository and wait for it (expected 1 to 2 hours, not
   measured; the simulate step may take 280 minutes and the job 345, each step has its own budget so
   the logs are uploaded even when the simulation times out):
   ```
   gh workflow run rebuild-volve.yml -R mtomasgaard/snuggery-apps-template -f processes=4
   gh run list -R mtomasgaard/snuggery-apps-template -w rebuild-volve.yml -L 1
   gh run watch <run-id> -R mtomasgaard/snuggery-apps-template
   ```
5. Download and check the artifact:
   ```
   gh run download <run-id> -R mtomasgaard/snuggery-apps-template -n volve-data -D /tmp/volve-data
   python3 -m json.tool /tmp/volve-data/validation.json | head -60     # "pass": true, and the numbers
   shasum -a 256 /tmp/volve-data/seismic.bin Template/volve/data/seismic.bin   # identical (built in both)
   ```
   Then copy the model files and `validation.json` into `Template/volve/data/`, put the measured
   comparison into `ATTRIBUTION.txt` item 2 if wanted, commit, and mirror `volve/data/` again.
6. If the run fails: download `volve-run-logs` (the OPM PRT and DBG, the edit list, validation.json).
   If MPI is the problem, dispatch again with `-f processes=2` or `-f processes=1` (one process; the
   only serial time found is an unattributed 7,451 s, about 124 minutes, inside the 280-minute step). If `validate.py` fails, read which check and by how much before touching a
   tolerance: the tolerances are in `pipeline/validate.py` with their reasons.

## For part 2 (the app)

Volve's frames are **quarterly**, and every rate in `model.json` is an average over the interval to
its frame (about three months). Norne's app hard-codes "month" (for example "averaged over the month
to each date", "in the month to", "peak month", "months left", and track.js's "every month drawn").
Every such string must be reworded from `model.frames`, or About and the readouts would misstate the
data (clause 3.2). About should show `seismic.json`'s `polarity` with its `polarityNote`, its
`z.datum` and its `depthRelation`.

## Sizes

Measured: `seismic.bin` 9,529,344 B raw, **7,297,212 B zipped**; horizons, seismic.json, wells,
production, attribution and terms together about 217 KB zipped; the static model (from the real grid,
Equinor's active cells and INIT) 10.64 MB zipped. Estimated: the 37 dynamic frames, 27.2 MB raw,
about 17.3 MB zipped at Norne's compression ratio. About 35.5 MB zipped for `data/` in all, against
Norne's 15.3 MB.

## Credits and licence

The data in `data/` comes from the Volve field data set, © Equinor ASA and the former Volve licence
partners, under Equinor's terms (`data/TERMS-Volve-2026-10-07.txt`); keep `data/ATTRIBUTION.txt`
with it. It is free, not for sale, and not endorsed by Equinor or the partners. Their names belong in
the app's About and in ATTRIBUTION only, never in anything that markets Snuggery (clause 4).
