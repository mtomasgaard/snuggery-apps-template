"""Check the fetched deck against Equinor's own run log, VOLVE_2016.PRT (Eclipse 2015.1).

Eclipse echoes the input it reads into the PRT file, prefixed with the include depth ("  0: " for
the main deck, "  1: " for an included file), except where the deck says NOECHO. Every echoed line
must appear, in the same order and with the same text (trailing blanks aside), in the files we
fetched. Equinor's PRT comes from a different mirror (f0nzie/volve_eclipse_reservoir) than the deck
(tpp-grupo-166/opm-datasets), so a match ties the deck to the run Equinor published.
Standard library only.

    python3 check_provenance.py --inputs work/inputs
"""
import argparse
import re
import sys
import zipfile
from pathlib import Path

ECHO = re.compile(r"^ +(\d+): ?(.*)$")
INCLUDE = re.compile(r"^\s*INCLUDE\b", re.I)
TRUNC = 128  # shortest echo seen cut at the 132-column limit (the prefix takes the rest)


def lines_of(path):
    return [l.rstrip() for l in Path(path).read_bytes().decode("latin-1").replace("\r", "").split("\n")]


def include_order(deck_lines):
    """File names in the order the main deck INCLUDEs them (quoted name on a following line)."""
    out, want = [], False
    for l in deck_lines:
        s = l.split("--")[0].strip()
        if INCLUDE.match(s):
            want = True
            s = s[len("INCLUDE"):].strip()
        if want and s:
            m = re.match(r"'([^']+)'", s)
            if m:
                out.append(m.group(1)); want = False
    return out


# The grid file starts with its own NOECHO, so Eclipse never echoed its body; it is checked against
# Equinor's INIT instead (check_static.py).
UNECHOED_FILES = {"GRID_postF1B_Nov2013_locupd_12112013.grdecl"}


# Three main-deck lines that the rules below do not cover, each read by hand in Equinor's PRT:
KNOWN_UNECHOED = {
    182: "INCLUDE",                  # ACTNUM's INCLUDE is echoed, but the greedy match gives it to the grid's
                                     # INCLUDE (line 178, under NOECHO); the grid file ends with ECHO
    525: "--      mul  Reg  Flux",   # a comment between MULTIREG and its records; the PRT shows the records only
    700: " 'YES'  /",                # SCALECRS's record; the PRT echoes the keyword alone, as for TUNING
}


def unechoed_deck_lines(deck, echoed):
    """Main-deck lines Eclipse did not echo and that no known rule explains. Known rules: the block
    between the first NOECHO and GRID (RUNSPEC), the file-name line of an INCLUDE (Eclipse prints
    names differently), and the records of TUNING (Eclipse echoes the keyword only). A NOECHO block runs
    from the NOECHO keyword to the next line Eclipse is seen to echo."""
    out, noecho, tuning, include = [], False, False, False
    for n, l in enumerate(deck):
        s = l.split("--")[0].strip()
        word = s.split()[0] if s else ""
        if n in echoed and s not in ("", "/"):  # an echoed keyword or record ("/" and comments match anywhere)
            noecho = False
        if word == "NOECHO":  # Eclipse echoes the NOECHO line itself, then stops
            noecho = True
        if word.isalpha() and word.isupper() and word not in ("TUNING",):
            tuning = False
        if word == "TUNING":
            tuning = True
        explained = noecho or include or (tuning and word != "TUNING") or not l.strip()
        if word == "INCLUDE":
            include = True
        elif s.startswith("'"):
            include = False
        if n not in echoed and not explained and KNOWN_UNECHOED.get(n + 1) != l:
            out.append(n)
    return out


def subsequence(echo, ref):
    """Match echoed lines in order against ref; return (unmatched echoed lines, matched ref indices)."""
    i, miss, hit = 0, [], []
    pos = {}
    for n, l in enumerate(ref):
        pos.setdefault(l, []).append(n)
    import bisect
    cut = 0
    for e in echo:
        cand = pos.get(e.rstrip(), [])
        k = bisect.bisect_left(cand, i)
        if k < len(cand):
            hit.append(cand[k]); i = cand[k] + 1; continue
        # Eclipse truncates echoed lines at 132 columns: accept a long echo that starts a longer line nearby
        j = next((n for n in range(i, min(i + 50, len(ref))) if len(e) >= TRUNC and len(ref[n]) > len(e)
                  and ref[n].startswith(e)), None)
        if j is None:
            miss.append(e); continue
        hit.append(j); i = j + 1; cut += 1
    subsequence.truncated = cut
    return miss, hit


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inputs", default="work/inputs")
    args = ap.parse_args()
    inp = Path(args.inputs)
    with zipfile.ZipFile(inp / "equinor" / "VOLVE_2016.zip") as z:
        prt = z.read("VOLVE_2016.PRT").decode("latin-1").split("\n")
    head = "\n".join(prt[:200])
    m = re.search(r"Version =\s+(\S+)", head)
    print(f"Equinor's PRT: Eclipse {m.group(1) if m else '?'}, {len(prt):,} lines")
    echo = {}
    for l in prt:
        mm = ECHO.match(l)
        if mm:
            echo.setdefault(int(mm.group(1)), []).append(mm.group(2).rstrip())
    deck = lines_of(inp / "deck" / "VOLVE_2016.DATA")
    ok = True
    miss, hit = subsequence(echo.get(0, []), deck)
    print(f"VOLVE_2016.DATA: {len(echo.get(0, [])):,} echoed lines, {len(miss)} not found in order "
          f"({len(set(hit)):,} of {len(deck):,} deck lines echoed)")
    ok &= not miss
    for l in miss[:10]:
        print("   not in the deck:", l)
    unexplained = [(n + 1, deck[n]) for n in unechoed_deck_lines(deck, set(hit))]
    print(f"   {len(unexplained)} deck lines neither echoed nor explained (NOECHO block, INCLUDE names, TUNING records)")
    ok &= not unexplained
    for n, l in unexplained[:10]:
        print(f"   line {n} not echoed by Eclipse: {l}")
    names = include_order(deck)
    ref, owner = [], []
    for n in names:
        f = inp / "deck" / n
        if not f.exists():
            print(f"   missing include {n}"); ok = False; continue
        ls = lines_of(f)
        ref += ls; owner += [n] * len(ls)
    miss, hit = subsequence(echo.get(1, []), ref)
    print(f"{len(names)} included files: {len(echo.get(1, [])):,} echoed lines, {len(miss)} not found in order "
          f"({subsequence.truncated} matched as truncated at 132 columns)")
    ok &= not miss
    for l in miss[:10]:
        print("   not in the includes:", l)
    counts = {}
    for h in hit:
        counts[owner[h]] = counts.get(owner[h], 0) + 1
    hs = set(hit)
    extra = [(owner[k], l) for k, l in enumerate(ref) if k not in hs and l.strip() and owner[k] not in UNECHOED_FILES]
    print(f"   {len(extra)} non-blank lines in the includes that Eclipse did not echo")
    ok &= not extra
    for o, l in extra[:10]:
        print(f"   {o}: {l}")
    for n in names:
        total = sum(1 for o in owner if o == n)
        print(f"   {counts.get(n, 0):>9,} of {total:>9,} lines echoed  {n}")
    if 2 in echo:
        print(f"note: {len(echo[2]):,} lines echoed at include depth 2 (not checked)")
    print("PASS: the deck is the one Equinor ran" if ok else "FAIL: the fetched deck differs from Equinor's run")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
