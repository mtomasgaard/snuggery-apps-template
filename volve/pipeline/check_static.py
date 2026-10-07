"""Check the prepared deck's static model against Equinor's own INIT (Eclipse 2015.1), before any run.

OPM's parser builds the model from work/deck (opm-common, the same library Flow uses) and every
property it shares with Equinor's VOLVE_2016.INIT is compared cell by cell over Equinor's 183,545
active cells: cell-centre depth (which proves the ZCORN with ADDZCORN applied), porosity,
permeabilities, pore volume, saturation end points and region numbers. A difference above the
stated tolerance fails the step. Runs wherever the opm wheel runs (Linux x86_64, macOS arm64).

    python3 check_static.py --deck work/deck/VOLVE_2016.DATA --inputs work/inputs
"""
import argparse
import re
import sys
from pathlib import Path

import numpy as np
import opm.io.ecl as ecl
from opm.io.ecl_state import EclipseState
from opm.io.parser import Parser

MD = 9.869233e-16  # m2 per millidarcy (OPM reports permeability in SI)
NX, NY, NZ = 108, 100, 63
# (OPM field property, Equinor INIT array, scale to Equinor's units, tolerance, absolute or relative)
DOUBLE = [("PORO", "PORO", 1.0, 1e-6, "abs"), ("PERMX", "PERMX", 1 / MD, 1e-5, "rel"),
          ("PERMY", "PERMY", 1 / MD, 1e-5, "rel"), ("PERMZ", "PERMZ", 1 / MD, 1e-5, "rel"),
          ("SWL", "SWL", 1.0, 1e-6, "abs"), ("SWCR", "SWCR", 1.0, 1e-6, "abs"), ("SGU", "SGU", 1.0, 1e-6, "abs"),
          ("SGCR", "SGCR", 1.0, 1e-6, "abs"), ("SWU", "SWU", 1.0, 1e-6, "abs"), ("SGL", "SGL", 1.0, 1e-6, "abs")]
# Equinor's run used EQLOPTS MOBILE (its PRT: "Mobile Fluid Endpoint Correction Required ... YES"), which
# rewrote SOWCR and SOGCR in 1,200 cells. OPM has no MOBILE (prepare_deck.py removes it), so OPM keeps the
# deck's values there. Exactly those cells may differ; any other count fails.
MOBILE = [("SOWCR", 1200), ("SOGCR", 1200)]
INT = ["FIPNUM", "PVTNUM", "SATNUM", "EQLNUM", "FLUXNUM"]


def read_grdecl(path, kw):
    txt = re.sub(r"--[^\n]*", "", Path(path).read_bytes().decode("latin-1"))
    m = re.search(r"^\s*" + kw + r"\s*$", txt, flags=re.M)
    vals = []
    for t in txt[m.end():txt.index("/", m.end())].split():
        n, _, v = t.rpartition("*")
        vals.extend([float(v)] * (int(n) if n else 1))
    return np.array(vals)


def opm_active(deck_dir):
    """OPM's active cells before MINPV: ACTNUM and porosity above zero, in natural order.
    The porosity-zero boxes are read from the deck's EQUALS 'PORO' 0.0 records."""
    act = read_grdecl(deck_dir / "ACTNUM_2013", "ACTNUM").reshape(NZ, NY, NX) > 0
    poro = read_grdecl(deck_dir / "PHIF_NW", "PORO").reshape(NZ, NY, NX)
    deck = (deck_dir / "VOLVE_2016.DATA").read_bytes().decode("latin-1")
    boxes = re.findall(r"^\s*'PORO'\s+0\.0\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*/", deck, flags=re.M)
    for i1, i2, j1, j2, k1, k2 in (map(int, b) for b in boxes):
        poro[k1 - 1:k2, j1 - 1:j2, i1 - 1:i2] = 0
    return np.nonzero((act & (poro > 0)).ravel())[0], len(boxes)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--deck", default="work/deck/VOLVE_2016.DATA")
    ap.add_argument("--inputs", default="work/inputs")
    args = ap.parse_args()
    deck_path = Path(args.deck)
    init = ecl.EclFile(str(Path(args.inputs) / "equinor" / "VOLVE_2016.INIT"))
    eq = np.nonzero(np.array(init["PORV"]) > 0)[0]
    st = EclipseState(Parser().parse(str(deck_path)))
    g, fp = st.grid(), st.field_props()
    glob, nbox = opm_active(deck_path.parent)
    ok = True
    print(f"Equinor's run: {len(eq):,} active cells (after MINPV 50 and PINCH). OPM before MINPV: {g.nactive:,}; "
          f"rebuilt from ACTNUM and {nbox} porosity-zero boxes: {len(glob):,}")
    if len(glob) != g.nactive:
        print("FAIL: cannot map OPM's active cells"); sys.exit(1)
    pos = np.searchsorted(glob, eq)
    if not np.all(glob[np.minimum(pos, len(glob) - 1)] == eq):
        print("FAIL: some of Equinor's active cells are inactive in OPM"); sys.exit(1)

    depth = np.array([g.getCellDepth(int(n)) for n in eq])
    d = np.abs(depth - np.array(init["DEPTH"], dtype=np.float64))
    good = d.max() <= 0.01
    print(f"{'DEPTH':8s} max |OPM - Equinor| {d.max():.4f} m over {len(eq):,} cells (tolerance 0.01 m)  "
          f"{'ok' if good else 'FAIL'}")
    ok &= good
    for name, eqname, scale, tol, how in DOUBLE:
        a = np.array(fp.get_double_array(name))[pos] * scale
        b = np.array(init[eqname], dtype=np.float64)
        diff = np.abs(a - b) / np.maximum(np.abs(b), 1e-30 if how == "rel" else 1.0) if how == "rel" else np.abs(a - b)
        if how == "rel":
            diff = np.where(np.abs(b) < 1e-6, np.abs(a - b), diff)  # zero permeability compares absolutely (mD)
        good = float(diff.max()) <= tol
        print(f"{name:8s} max {'relative' if how == 'rel' else 'absolute'} difference {diff.max():.2e} "
              f"(tolerance {tol:g})  {'ok' if good else 'FAIL'}")
        ok &= good
    for name, expected in MOBILE:
        a = np.array(fp.get_double_array(name))[pos]
        b = np.array(init[name], dtype=np.float64)
        n = int((np.abs(a - b) > 1e-6).sum())
        good = n == expected
        print(f"{name:8s} {n:,} cells differ, expected {expected:,} (Eclipse's MOBILE correction, not in OPM)  "
              f"{'ok' if good else 'FAIL'}")
        ok &= good
    for name in INT:
        a = np.array(fp.get_int_array(name))[pos]
        b = np.array(init[name])
        n = int((a != b).sum())
        print(f"{name:8s} {n} cells differ  {'ok' if n == 0 else 'FAIL'}")
        ok &= n == 0
    pv = np.array(fp.get_double_array("PORV"))[pos]
    r = np.abs(pv / np.array(init["PORV"])[eq] - 1)
    good = float(r.max()) <= 1e-4
    print(f"{'PORV':8s} max relative difference {r.max():.2e} (tolerance 1e-4; the EDIT section's multipliers)  "
          f"{'ok' if good else 'FAIL'}")
    ok &= good
    print("PASS: the prepared deck reproduces Equinor's static model" if ok else "FAIL: see the lines above")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
