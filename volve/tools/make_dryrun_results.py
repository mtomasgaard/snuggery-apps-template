"""Write stand-in OPM results so extract.py and validate.py can be dry-run without Flow (macOS included).

    VOLVE_2016.EGRID   the prepared grid (COORD, ZCORN with ADDZCORN applied, MAPAXES) with Equinor's
                       active cells (PORV > 0 in Equinor's INIT), written with opm's EclOutput
    VOLVE_2016.INIT    Equinor's INIT, copied
    VOLVE_2016.SMSPEC  Equinor's summary, copied (so validate.py compares Equinor with itself)
    VOLVE_2016.UNSMRY
    VOLVE_2016.UNRST   SYNTHETIC: one restart per month on the deck's report dates, with made-up
                       saturations and pressures. It exercises the code; its numbers mean nothing.
Never publish anything extracted from these files.

    python3 tools/make_dryrun_results.py --deck pipeline/work/deck --inputs pipeline/work/inputs --out pipeline/work/dryrun
"""
import argparse
import re
import shutil
import sys
from pathlib import Path

import numpy as np
import opm.io.ecl as ecl

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import seismic  # noqa: E402  (its GRDECL reader)

NX, NY, NZ = 108, 100, 63


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--deck", default="pipeline/work/deck")
    ap.add_argument("--inputs", default="pipeline/work/inputs")
    ap.add_argument("--out", default="pipeline/work/dryrun")
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    eq = Path(args.inputs) / "equinor"
    for ext in ("INIT", "SMSPEC", "UNSMRY"):
        shutil.copyfile(eq / f"VOLVE_2016.{ext}", out / f"VOLVE_2016.{ext}")
    text = re.sub(r"--[^\n]*", "", (Path(args.deck) / seismic.GRID).read_bytes().decode("latin-1"))
    m = re.search(r"^MAPAXES\s*$", text, flags=re.M)
    ax = np.array(text[m.end():text.index("/", m.end())].split(), dtype=np.float32)
    coord = seismic.grdecl_block(text, "COORD").astype(np.float32)
    zcorn = seismic.grdecl_block(text, "ZCORN").astype(np.float32)
    init = ecl.EclFile(str(eq / "VOLVE_2016.INIT"))
    porv = np.array(init["PORV"])
    actnum = (porv > 0).astype(np.int32)
    g = ecl.EclOutput(str(out / "VOLVE_2016.EGRID"))
    fh = np.zeros(100, dtype=np.int32); fh[0], fh[1] = 3, 2007
    g.write("FILEHEAD", fh)
    g.write("MAPUNITS", ["METRES"])
    g.write("MAPAXES", ax)
    g.write("GRIDUNIT", ["METRES", ""])
    gh = np.zeros(100, dtype=np.int32); gh[0], gh[1], gh[2], gh[3] = 1, NX, NY, NZ
    g.write("GRIDHEAD", gh)
    g.write("COORD", coord)
    g.write("ZCORN", zcorn)
    g.write("ACTNUM", actnum)
    g.write("ENDGRID", np.zeros(0, dtype=np.int32))
    del g
    na = int(actnum.sum())
    # synthetic restarts: the first report date of each month, as RPTRST BASIC=5 writes them
    from opm.io.parser import Parser
    from opm.io.ecl_state import EclipseState
    from opm.io.schedule import Schedule
    deck = Parser().parse(str(Path(args.deck) / "VOLVE_2016.DATA"))
    sch = Schedule(deck, EclipseState(deck))
    dates = [d.date() if hasattr(d, "date") else d for d in sch.reportsteps]
    steps, seen = [0], {(dates[0].year, dates[0].month)}
    for n, d in enumerate(dates[1:], 1):
        if (d.year, d.month) not in seen:
            steps.append(n); seen.add((d.year, d.month))
    if steps[-1] != len(dates) - 1:
        steps.append(len(dates) - 1)
    swl = np.array(init["SWL"], dtype=np.float32)
    r = ecl.EclOutput(str(out / "VOLVE_2016.UNRST"))
    for n, s in enumerate(steps):
        d = dates[s]
        ih = np.zeros(411, dtype=np.int32); ih[64], ih[65], ih[66] = d.day, d.month, d.year
        r.write("SEQNUM", np.array([s], dtype=np.int32))
        r.write("INTEHEAD", ih)
        r.write("PRESSURE", np.full(na, 330.0 - 0.05 * n, dtype=np.float32))
        r.write("SWAT", np.clip(swl + 0.004 * n, 0, 1).astype(np.float32))
        r.write("SGAS", np.zeros(na, dtype=np.float32))
    del r
    print(f"stand-in results in {out}: EGRID with {na} active cells, {len(steps)} synthetic restarts "
          f"{dates[steps[0]]} to {dates[steps[-1]]} of {len(dates)} report dates")


if __name__ == "__main__":
    main()
