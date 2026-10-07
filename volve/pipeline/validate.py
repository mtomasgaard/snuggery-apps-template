"""Gate a data rebuild: our OPM Flow run of Volve against Equinor's own run of the same deck.

The reference is Equinor's Eclipse 2015.1 summary, VOLVE_2016.SMSPEC and .UNSMRY (fetched and
verified by fetch_inputs.py). Equinor published no 3D results we can reach, so the run is judged
on field and well totals and field pressure, plus the static model from OPM's own INIT. Anything
outside the tolerances below fails the step loudly, and extract.py refuses to run after a failure.
The comparison is written to data/validation.json, so the app can state it.

Why these tolerances: the injectors are rate controlled, so water injected should match closely;
producers follow the observed reservoir-volume rates (WHISTCTL RESV), so their oil-water-gas split
depends on the simulator, and prepare_deck.py removes two initialisation options OPM lacks (QUIESC,
MOBILE). Norne's run came within 0.4 % of its Eclipse reference on field totals.

    python3 validate.py --results work/results --inputs work/inputs --data-dir ../data --opm 2026.04
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

BASE = "VOLVE_2016"
TOL = {
    "fieldTotalPct": 5.0,        # FOPT, FWPT, FGPT at the end of the run
    "fieldInjectedPct": 2.0,     # FWIT at the end (rate-controlled injectors)
    "fieldPathPct": 10.0,        # the same totals at every reference date after 10 % of the final total
    "pressureMeanBar": 5.0,      # FPR, mean absolute difference over the reference dates
    "pressureMaxBar": 15.0,      # FPR, largest difference
    "wellOilPct": 15.0,          # WOPT at the end, wells with at least 2 % of the field's oil
    "wellWaterPct": 25.0,        # WWPT at the end, wells with at least 2 % of the field's water
    "wellInjectedPct": 2.0,      # WWIT at the end, injectors with at least 2 % of the field's injection
    "activeCellsPct": 0.5,       # OPM's active cells against Equinor's 183,545 (MINPV and PINCH)
}
SHARE = 0.02


class Scaled:
    """An ESmry-like view with chosen vectors scaled (for tests of this gate)."""
    def __init__(self, base, factors):
        self.base, self.factors = base, factors
        self.start_date = base.start_date

    def keys(self):
        return self.base.keys()

    def __getitem__(self, k):
        return np.array(self.base[k]) * self.factors.get(k, 1.0)


def pct(a, b):
    return 100.0 * (a - b) / b if b else (0.0 if a == 0 else float("inf"))


def compare(ours, ref):
    """Return (ok, report). ours and ref behave like opm.io.ecl.ESmry."""
    rep, ok = {"field": {}, "wells": {}, "pressure": {}, "messages": []}, True
    t_o, t_r = np.array(ours["TIME"], dtype=np.float64), np.array(ref["TIME"], dtype=np.float64)
    so, sr = ours.start_date, ref.start_date
    rep["start"] = str(sr)[:10]
    end_ref = (np.datetime64(str(sr)[:10]) + np.timedelta64(int(round(t_r[-1])), "D")).astype(str)
    end_ours = (np.datetime64(str(so)[:10]) + np.timedelta64(int(round(t_o[-1])), "D")).astype(str)
    rep["end"] = end_ref
    if str(so)[:10] != str(sr)[:10] or abs(t_o[-1] - t_r[-1]) > 0.5:
        rep["messages"].append(f"run incomplete or shifted: ours {str(so)[:10]} to {end_ours}, Equinor {str(sr)[:10]} to {end_ref}")
        return False, rep
    keys_o = set(ours.keys())
    for key, tol in (("FOPT", TOL["fieldTotalPct"]), ("FWPT", TOL["fieldTotalPct"]), ("FGPT", TOL["fieldTotalPct"]),
                     ("FWIT", TOL["fieldInjectedPct"])):
        if key not in keys_o:
            rep["messages"].append(f"{key} missing from our summary"); ok = False; continue
        a, b = float(ours[key][-1]), float(ref[key][-1])
        d = pct(a, b)
        o_at = np.interp(t_r, t_o, np.array(ours[key], dtype=np.float64))
        r_all = np.array(ref[key], dtype=np.float64)
        sel = r_all >= 0.1 * r_all[-1]
        path = float(np.max(np.abs(o_at[sel] - r_all[sel]) / r_all[sel]) * 100) if sel.any() else 0.0
        good = abs(d) <= tol and path <= TOL["fieldPathPct"]
        hist = float(ref[key + "H"][-1]) if key + "H" in set(ref.keys()) else None
        rep["field"][key] = dict(ours=round(a, 1), equinor=round(b, 1), diffPct=round(d, 3), pathMaxPct=round(path, 3),
                                 observed=None if hist is None else round(hist, 1), ok=bool(good))
        ok &= good
    fo = np.interp(t_r, t_o, np.array(ours["FPR"], dtype=np.float64))
    dp = np.abs(fo - np.array(ref["FPR"], dtype=np.float64))
    good = float(dp.mean()) <= TOL["pressureMeanBar"] and float(dp.max()) <= TOL["pressureMaxBar"]
    rep["pressure"] = dict(meanAbsBar=round(float(dp.mean()), 3), maxAbsBar=round(float(dp.max()), 3), ok=bool(good))
    ok &= good
    fopt, fwpt, fwit = (float(ref[k][-1]) for k in ("FOPT", "FWPT", "FWIT"))
    wells = sorted({k.split(":", 1)[1] for k in ref.keys() if k.startswith("WOPT:")})
    for w in wells:
        r = {}
        for key, total, tol in (("WOPT", fopt, TOL["wellOilPct"]), ("WWPT", fwpt, TOL["wellWaterPct"]),
                                ("WWIT", fwit, TOL["wellInjectedPct"])):
            k = f"{key}:{w}"
            b = float(ref[k][-1]) if k in set(ref.keys()) else 0.0
            if b < SHARE * total:
                continue
            if k not in keys_o:
                r[key] = dict(equinor=round(b, 1), ok=False, note="missing from our summary"); ok = False; continue
            a = float(ours[k][-1])
            d = pct(a, b)
            r[key] = dict(ours=round(a, 1), equinor=round(b, 1), diffPct=round(d, 3), ok=bool(abs(d) <= tol))
            ok &= abs(d) <= tol
        if r:
            rep["wells"][w] = r
    return bool(ok), rep


def check_static(results, inputs):
    """OPM's INIT and EGRID against Equinor's INIT: active cells, depth and porosity where both are active
    (gates); TRANX/TRANY/TRANZ over the same cells (reported only)."""
    import opm.io.ecl as ecl
    out, ok = {}, True
    eq_init = ecl.EclFile(str(Path(inputs) / "equinor" / f"{BASE}.INIT"))
    eq_act = np.nonzero(np.array(eq_init["PORV"]) > 0)[0]
    egrid = ecl.EclFile(str(Path(results) / f"{BASE}.EGRID"))
    act = np.nonzero(np.array(egrid["ACTNUM"]) > 0)[0]
    init = ecl.EclFile(str(Path(results) / f"{BASE}.INIT"))
    d = pct(len(act), len(eq_act))
    out["activeCells"] = dict(ours=int(len(act)), equinor=int(len(eq_act)), diffPct=round(d, 3),
                              ok=bool(abs(d) <= TOL["activeCellsPct"]))
    ok &= abs(d) <= TOL["activeCellsPct"]
    common, io, ie = np.intersect1d(act, eq_act, return_indices=True)
    for key, tol in (("DEPTH", 0.01), ("PORO", 1e-5)):
        a = np.array(init[key], dtype=np.float64)[io]
        b = np.array(eq_init[key], dtype=np.float64)[ie]
        m = float(np.abs(a - b).max())
        out[key] = dict(maxAbsDiff=m, cells=int(len(common)), ok=bool(m <= tol))
        ok &= m <= tol
    # Connectivity (the 100 ADDZCORN fault throws, MULTFLT, MULTX/Y/Z): reported, not a gate. OPM and
    # Eclipse need not compute every face's transmissibility the same way, and no OPM run of Volve has
    # been measured yet; read these numbers before making them a gate.
    names_o, names_e = {a[0] for a in init.arrays}, {a[0] for a in eq_init.arrays}
    for key in ("TRANX", "TRANY", "TRANZ"):
        if key not in names_o or key not in names_e:
            out[key] = "not compared: missing from " + ("our" if key not in names_o else "Equinor's") + " INIT"
            continue
        a = np.array(init[key], dtype=np.float64)[io]
        b = np.array(eq_init[key], dtype=np.float64)[ie]
        both = (a > 0) | (b > 0)
        rel = np.abs(a[both] - b[both]) / np.maximum(np.maximum(a[both], b[both]), 1e-30)
        out[key] = dict(faces=int(both.sum()), relDiffMedian=round(float(np.median(rel)), 6) if both.any() else 0.0,
                        within1Pct=round(float(np.mean(rel <= 0.01)), 6) if both.any() else 1.0,
                        openHereOnly=int(((a > 0) & (b <= 0)).sum()), openInEquinorOnly=int(((b > 0) & (a <= 0)).sum()),
                        gate=False)
    return ok, out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--results", default="work/results")
    ap.add_argument("--inputs", default="work/inputs")
    ap.add_argument("--data-dir", default=str(Path(__file__).resolve().parent.parent / "data"))
    ap.add_argument("--opm", default="2026.04", help="the OPM Flow release that made the run")
    args = ap.parse_args()
    import opm.io.ecl as ecl
    ours = ecl.ESmry(str(Path(args.results) / f"{BASE}.SMSPEC"))
    ref = ecl.ESmry(str(Path(args.inputs) / "equinor" / f"{BASE}.SMSPEC"))
    ok, rep = compare(ours, ref)
    if (Path(args.results) / f"{BASE}.EGRID").exists():
        sok, rep["static"] = check_static(args.results, args.inputs)
        ok &= sok
    else:
        rep["static"] = "not checked: no EGRID in the results"
        ok = False
    out = {"pass": bool(ok), "opm": args.opm,
           "reference": "Equinor's Eclipse 2015.1 run of VOLVE_2016.DATA (summary vectors, mirrored at f0nzie/rEcl)",
           "tolerances": TOL, **rep}
    Path(args.data_dir).mkdir(parents=True, exist_ok=True)
    (Path(args.data_dir) / "validation.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"run {rep.get('start')} to {rep.get('end')}")
    for k, v in rep["field"].items():
        obs = f", observed history {v['observed']:,.0f}" if v.get("observed") is not None else ""
        print(f"{k:5s} ours {v['ours']:>16,.0f}  Equinor {v['equinor']:>16,.0f}  ({v['diffPct']:+.2f}%, worst along the "
              f"way {v['pathMaxPct']:.2f}%){obs}  {'ok' if v['ok'] else 'FAIL'}")
    if rep["pressure"]:
        p = rep["pressure"]
        print(f"FPR   mean difference {p['meanAbsBar']:.2f} bar, largest {p['maxAbsBar']:.2f} bar  {'ok' if p['ok'] else 'FAIL'}")
    for w, r in rep["wells"].items():
        print(f"  {w:8s} " + "  ".join(f"{k} {v.get('diffPct', float('nan')):+.1f}%{'' if v['ok'] else ' FAIL'}" for k, v in r.items()))
    print(f"static: {json.dumps(rep['static'])}")
    for m in rep["messages"]:
        print("  ", m)
    print("PASS" if ok else "FAIL: the run does not meet the checks above; nothing is extracted")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
