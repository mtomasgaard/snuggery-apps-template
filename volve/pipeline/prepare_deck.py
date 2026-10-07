"""Copy Equinor's Volve deck (fetched and verified by fetch_inputs.py) and make the stated edits.

Two kinds of edit, and nothing else:
  report  - when restart (3D result) files are written: once a month, from which extract.py takes
            the quarterly frames. Physics, wells and controls are untouched.
  eclipse - lines Eclipse 2015.1 itself discarded when Equinor ran the deck, each logged in Equinor's
            VOLVE_2016.PRT as "SPURIOUS DATA ... ", which OPM's parser rejects instead of skipping.
            Commenting them out gives OPM the input Eclipse actually used.
  opm     - what OPM Flow 2026.04 cannot run. ADDZCORN (fault throws, 100 records) is applied to the grid's
            ZCORN here, as Eclipse applied it, and the keyword commented out; check_static.py proves the
            result against the cell depths in Equinor's own INIT. PRIORITY and EQLOPTS' QUIESC and MOBILE
            have no OPM equivalent and are commented out; validate.py measures the run against Equinor's.
Each edit must match exactly the stated number of times, or the script stops. The list of edits is
written to <out>/EDITS.json and copied into data/ATTRIBUTION.txt (clause 3.2 of Equinor's terms).

    python3 prepare_deck.py --inputs work/inputs --out work/deck
"""
import argparse
import json
import re
import shutil
from pathlib import Path

import numpy as np

DECK = "VOLVE_2016.DATA"
SCH = "SCH_010916_10DAYS.SCH"
RSVD = "RSVD_input_new_combined_020610_perch_water_2914m.E100"
GRID = "GRID_postF1B_Nov2013_locupd_12112013.grdecl"
FAULT_FILES = ["FAULT_NW-15NOV13.GRDECL", "CONTACT_MAIN-NW-AP2014.GRDECL", "FAULT_MAIN-F14-AP2014.GRDECL",
               "FAULT_MAIN-F12-F14-AP2014.GRDECL"]  # in the order the deck includes them
NX, NY, NZ = 108, 100, 63
MONTHLY = " 'BASIC=5' 'FREQ=1' /"

EDITS = [
    dict(kind="report", file=DECK, count=1,
         find=r"^ 'BASIC=5' 'FREQ=4' 'FIP=3'  'FIPRESV'  'CONV'/ Each 4th month in history match period$",
         repl=MONTHLY + " -- Snuggery: restart every month (was every 4th month, with FIP and CONV arrays)",
         why="Restart files every month instead of every 4th; extract.py keeps the quarterly ones."),
    dict(kind="report", file=SCH, count=1,
         find=r"^ 'BASIC=5'  'FIP=3'  'PBPD'  'FREQ=3' 'FIPRESV'  / Each 3 month$",
         repl=MONTHLY + " -- Snuggery: restart every month (was every 3rd month from 30 Nov 2013)",
         why="The schedule's own RPTRST from 30 Nov 2013, made monthly like the first."),
    dict(kind="report", file=DECK, count=1,
         find=r"^ 'BASIC=5'  'FIP=3'  'PBPD'  'FREQ=3' 'FIPRESV'  / Each 3 month$",
         repl=MONTHLY + " -- Snuggery: restart every month (was every 3rd month)",
         why="The prediction section's RPTRST (it covers the last month, to 1 Oct 2016), made monthly."),
    dict(kind="report", file=DECK, count=1,
         find=r"^ 'WELSPECS'  'WELLS=2' 'FIP=3' ' RESTART=4' 'FIPRESV' 'NEWTON' /$",
         repl=" 'WELSPECS'  'WELLS=2' 'FIP=3' 'FIPRESV' 'NEWTON' / -- Snuggery: RESTART=4 removed (RPTRST alone sets restarts)",
         why="RPTSCHED's RESTART mnemonic removed so that RPTRST alone decides when restarts are written."),
    dict(kind="report", file=DECK, count=1,
         find=r"^(WLPTH\n/\n)",
         repl="\\1WGPT -- Snuggery: well gas produced, for the app's rates (summary output only)\n/\n",
         why="SUMMARY: WGPT (gas produced per well) added to the vectors written; the deck asks for WGPTH only."),
    dict(kind="opm", file=DECK, count=1,
         find=r"^'THPRES' 'QUIESC'    'MOBILE'   /$",
         repl="'THPRES' / -- Snuggery: QUIESC and MOBILE removed (not in OPM Flow; was 'THPRES' 'QUIESC' 'MOBILE')",
         why="EQLOPTS keeps THPRES; QUIESC (a quiescent initial state) and MOBILE (mobile-fluid correction of "
             "the initial end points) are not in OPM Flow 2026.04, which stops on them. The initial state can "
             "differ slightly from Equinor's."),
    dict(kind="opm", file=DECK, count=2,
         find=r"^(PRIORITY| 7  0\.0    1\.0    1\.0    0\.0  0\.0  0\.0  1\.0  0\.0 /)$",
         repl=r"-- \1 -- Snuggery: PRIORITY is not in OPM Flow",
         why="PRIORITY (group production priorities) is not in OPM Flow 2026.04, which stops on it. The "
             "history is run on WCONHIST well rates, so it only matters where a group target binds."),
    dict(kind="eclipse", file=DECK, count=1,
         find=r"^(    329        2\.0E-5    / #13)$", repl=r"-- \1 -- Snuggery: discarded by Eclipse",
         why="ROCK has 13 rows for TABDIMS' 12 PVT regions. Eclipse discarded the 13th (PRT: 'SPURIOUS DATA "
             "BEFORE INCLUDE KEYWORD  329 2.0E-5 / #13'); OPM rejects it."),
]


def zc_index(i, j, k, it, jt, kt):
    """Index into ZCORN (0-based cell i, j, k; it, jt, kt = 0 low side, 1 high side), Eclipse's order."""
    return ((2 * k + kt) * 2 * NY + 2 * j + jt) * 2 * NX + 2 * i + it


def addzcorn_records(text, name):
    """The ADDZCORN records of one include: (value, i-side, j-side, k1, k2) with 0-based cell and side.

    Every record in Volve's files names one pillar line by a zero: 'I1 I2' = '0 n' is the high-I side
    of cell n, 'n 0' its low-I side, and likewise for J; items 8-11 repeat items 2-5 and ACTION is
    defaulted. Anything else stops the script, because only this form was proved against Equinor."""
    lines = [l.split("--")[0] for l in text.split("\n")]
    out, on = [], False
    for l in lines:
        s = l.strip()
        if s.upper() == "ADDZCORN":
            on = True; continue
        if not on or not s:
            continue
        if s == "/":
            on = False; continue
        if not s.endswith("/"):
            raise SystemExit(f"{name}: unexpected ADDZCORN line {s!r}")
        v = s[:-1].split()
        if len(v) != 11:
            raise SystemExit(f"{name}: ADDZCORN record with {len(v)} items: {s!r}")
        val = float(v[0]); i1, i2, j1, j2, k1, k2, i1a, i2a, j1a, j2a = map(int, v[1:])
        if (i1a, i2a, j1a, j2a) != (i1, i2, j1, j2) or (i1 == 0) == (i2 == 0) or (j1 == 0) == (j2 == 0):
            raise SystemExit(f"{name}: ADDZCORN record outside the proved form: {s!r}")
        ci, it = (i2 - 1, 1) if i1 == 0 else (i1 - 1, 0)
        cj, jt = (j2 - 1, 1) if j1 == 0 else (j1 - 1, 0)
        out.append((val, ci, it, cj, jt, k1 - 1, k2 - 1))
    return out


def apply_addzcorn(grid_text, records):
    """Add each record's value to its cell corners (top and bottom, layers k1..k2), rewriting only the
    ZCORN numbers that change, in the file's own %11.3f format. Returns (text, corners changed)."""
    import re as _re
    start = _re.search(r"^ZCORN\s*$", grid_text, flags=_re.M).end()
    end = grid_text.index("/", start)
    body = grid_text[start:end]
    toks = list(_re.finditer(r"\S+", body))
    if len(toks) != 8 * NX * NY * NZ:
        raise SystemExit(f"ZCORN has {len(toks)} values, expected {8 * NX * NY * NZ}")
    shift = np.zeros(len(toks), dtype=np.float64)
    for val, ci, it, cj, jt, k1, k2 in records:
        for k in range(k1, k2 + 1):
            for kt in (0, 1):
                shift[zc_index(ci, cj, k, it, jt, kt)] += val
    changed = np.nonzero(shift)[0]
    parts, last = [], 0
    for n in changed:
        t = toks[n]
        old = t.group(0)
        if "%11.3f" % float(old) != body[t.start() - (11 - len(old)):t.end()]:
            raise SystemExit(f"ZCORN value {old!r} is not in the %11.3f layout")
        new = "%11.3f" % (float(old) + shift[n])
        a = t.start() - (11 - len(old))
        parts.append(body[last:a]); parts.append(new); last = t.end()
    parts.append(body[last:])
    return grid_text[:start] + "".join(parts) + grid_text[end:], len(changed)


def rsvd_edit(text):
    """RSVD carries 13 tables for 12 PVT regions; Eclipse discarded the 13th (PRT: 'SPURIOUS DATA BEFORE
    RPTSOL KEYWORD  2950.0 128.8 ...'). Comment out everything after the 12th table's closing slash."""
    lines = text.split("\n")
    k = next(n for n, l in enumerate(lines) if l.strip().upper().startswith("RSVD"))
    seen = 0
    for n in range(k + 1, len(lines)):
        body = lines[n].split("--")[0]
        if "/" in body:
            seen += 1
            if seen == 12:
                break
    tail = [n for n in range(n + 1, len(lines)) if lines[n].strip()]
    if not tail or "2950.0" not in lines[tail[0]] and not any("2950.0" in lines[m] for m in tail[:3]):
        raise SystemExit("RSVD: the 13th table is not where Equinor's PRT says it was")
    for m in tail:
        if not lines[m].lstrip().startswith("--"):
            lines[m] = "-- " + lines[m] + " -- Snuggery: discarded by Eclipse"
    return "\n".join(lines), len(tail)


def sch_edit(text):
    """At 1 Jan 2015 five producer records follow DATES with no keyword ('-- put data manullay' above them).
    Eclipse discarded them (PRT: 'SPURIOUS DATA BEFORE DATES KEYWORD  'P-F-14' 'OPEN' 'ORAT' 298.200 ...')."""
    pat = re.compile(r"(DATES\n 1 'JAN' 2015 /\n/\n\n)((?:\s+'P-F-[0-9A-Z]+'\s+'OPEN'\s+'ORAT'[^\n]*\n){5})")
    m = list(pat.finditer(text))
    if len(m) != 1:
        raise SystemExit(f"SCH: expected the 1 Jan 2015 records once, found {len(m)}")
    block = "".join("-- " + l + " -- Snuggery: discarded by Eclipse\n" for l in m[0].group(2).rstrip("\n").split("\n"))
    return text[:m[0].start(2)] + block + text[m[0].end(2):], 5


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inputs", default="work/inputs")
    ap.add_argument("--out", default="work/deck")
    args = ap.parse_args()
    src, out = Path(args.inputs) / "deck", Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(src, out)

    def read(name):
        return (out / name).read_bytes().decode("latin-1").replace("\r\n", "\n")

    def write(name, text):
        (out / name).write_bytes(text.encode("latin-1"))

    log = []
    for e in EDITS:
        text = read(e["file"])
        new, n = re.subn(e["find"], e["repl"], text, flags=re.M)
        if n != e["count"]:
            raise SystemExit(f"{e['file']}: expected {e['count']} match(es) of {e['find']!r}, found {n}")
        write(e["file"], new)
        log.append(dict(kind=e["kind"], file=e["file"], lines=n, what=e["why"]))
    records = []
    for name in FAULT_FILES:
        text = read(name)
        rec = addzcorn_records(text, name)
        records += rec
        lines = text.split("\n"); on = False
        for n, l in enumerate(lines):
            s = l.split("--")[0].strip()
            if s.upper() == "ADDZCORN":
                on = True
            if on and s:
                lines[n] = "-- " + l
                if s == "/":
                    on = False
        lines.insert(0, "-- Snuggery: ADDZCORN below is applied to ZCORN in " + GRID + " (OPM Flow has no ADDZCORN)")
        write(name, "\n".join(lines))
        log.append(dict(kind="opm", file=name, lines=len(rec), what=f"ADDZCORN commented out: its {len(rec)} records "
                        f"are applied to the grid's ZCORN instead (OPM Flow 2026.04 stops on ADDZCORN)."))
    grid_text, nchanged = apply_addzcorn(read(GRID), records)
    write(GRID, grid_text)
    log.append(dict(kind="opm", file=GRID, lines=nchanged, what=f"ZCORN: the {len(records)} ADDZCORN records "
                    f"(fault throws of -20 to +90 m) added to {nchanged} corner depths, as Eclipse applied "
                    "them; every other byte of the file is unchanged. check_static.py compares the result "
                    "with the cell depths in Equinor's INIT."))
    text, n = rsvd_edit(read(RSVD))
    write(RSVD, text)
    log.append(dict(kind="eclipse", file=RSVD, lines=n, what=rsvd_edit.__doc__.split("\n")[0].strip() + " "
                    + rsvd_edit.__doc__.split("\n")[1].strip()))
    text, n = sch_edit(read(SCH))
    write(SCH, text)
    log.append(dict(kind="eclipse", file=SCH, lines=n, what=" ".join(l.strip() for l in sch_edit.__doc__.split("\n"))))
    (out / "EDITS.json").write_text(json.dumps(log, indent=1) + "\n")
    for e in log:
        print(f"[{e['kind']}] {e['file']}: {e['lines']} line(s). {e['what']}")
    print(f"Deck ready in {out}")


if __name__ == "__main__":
    main()
