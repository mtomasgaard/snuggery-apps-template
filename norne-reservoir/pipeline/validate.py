"""Compare our run with the Eclipse 2014.2 reference summary that OPM publishes in opm-tests.

The reference has field and well summaries only (no 3D results). Exits non-zero if field
totals drift more than --tolerance percent, so it can gate a data rebuild.
"""
import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
import opm.io.ecl as ecl

OPM_TESTS = "https://github.com/OPM/opm-tests.git"
PINNED_COMMIT = "2e1c5814197e17d167ca36b2eade49aa159b534f"
REF = "norne/ECL.2014.2/NORNE_ATW2013.SMSPEC"


def fetch_reference(work, commit):
    repo = work / "opm-tests"
    if not repo.exists():
        subprocess.run(["git", "clone", "--filter=blob:none", "--sparse", "--no-checkout", OPM_TESTS, str(repo)], check=True)
        subprocess.run(["git", "sparse-checkout", "set", "norne/ECL.2014.2"], cwd=repo, check=True)
    subprocess.run(["git", "fetch", "--depth", "1", "origin", commit], cwd=repo, check=True)
    subprocess.run(["git", "checkout", "--quiet", commit], cwd=repo, check=True)
    return repo / REF


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--results", default="work/results")
    ap.add_argument("--work", default="work")
    ap.add_argument("--commit", default=PINNED_COMMIT)
    ap.add_argument("--tolerance", type=float, default=1.0, help="max allowed difference in percent")
    args = ap.parse_args()

    ref_path = fetch_reference(Path(args.work).resolve(), args.commit)
    ours = ecl.ESmry(str(Path(args.results) / "NORNE_ATW2013.SMSPEC"))
    ref = ecl.ESmry(str(ref_path))
    ok = True
    print(f"end of run: ours {ours['TIME'][-1]:.0f} days, reference {ref['TIME'][-1]:.0f} days")
    for key, label in [("FOPT", "oil produced"), ("FWPT", "water produced"), ("FGPT", "gas produced"),
                       ("FWIT", "water injected"), ("FGIT", "gas injected")]:
        a, b = float(ours[key][-1]), float(ref[key][-1])
        diff = 100 * (a - b) / b
        hist = f", observed history {float(ref[key + 'H'][-1]):,.0f}" if key + "H" in ref.keys() else ""
        print(f"{label:15s} ours {a:,.0f}  reference {b:,.0f}  ({diff:+.2f}%){hist}")
        ok &= abs(diff) <= args.tolerance
    fpr = np.interp(np.array(ref["TIME"]), np.array(ours["TIME"]), np.array(ours["FPR"]))
    dp = float(np.mean(np.abs(fpr - np.array(ref["FPR"]))))
    print(f"field pressure: mean difference {dp:.2f} bar")
    ok &= dp < 2.0
    print("PASS" if ok else "FAIL: results differ from the reference more than allowed")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
