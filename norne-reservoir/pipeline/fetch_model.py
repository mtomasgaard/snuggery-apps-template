"""Download the public Norne deck from OPM's opm-data repository and prepare it for the run.

The only edits are report settings, so restart (3D result) files are written once a month
all the way to the end of the schedule. Physics and well controls are untouched.
"""
import argparse
import re
import shutil
import subprocess
from pathlib import Path

OPM_DATA = "https://github.com/OPM/opm-data.git"
PINNED_COMMIT = "eaa2261683a97027e057c2bc49612ad1c86390b3"  # commit the app's data was built from


def git(*args, cwd=None):
    subprocess.run(["git", *args], cwd=cwd, check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--work", default="work", help="working folder (default: work)")
    ap.add_argument("--commit", default=PINNED_COMMIT, help="opm-data commit to use, or 'latest'")
    args = ap.parse_args()

    work = Path(args.work).resolve()
    src = work / "opm-data"
    if not src.exists():
        git("clone", "--filter=blob:none", "--sparse", "--no-checkout", OPM_DATA, str(src))
        git("sparse-checkout", "set", "norne", cwd=src)
    if args.commit == "latest":
        git("fetch", "--depth", "1", "origin", "HEAD", cwd=src)
        git("checkout", "--quiet", "FETCH_HEAD", cwd=src)
    else:
        git("fetch", "--depth", "1", "origin", args.commit, cwd=src)
        git("checkout", "--quiet", args.commit, cwd=src)

    deck_dir = work / "norne"
    if deck_dir.exists():
        shutil.rmtree(deck_dir)
    shutil.copytree(src / "norne", deck_dir)

    data = deck_dir / "NORNE_ATW2013.DATA"
    text = data.read_bytes().decode("latin-1")
    text, n = re.subn(r"^BASIC=2 KRO KRW KRG /", "BASIC=5 /", text, flags=re.M)
    if n != 1:
        raise SystemExit("Could not find the RPTRST line to change in NORNE_ATW2013.DATA")
    data.write_bytes(text.encode("latin-1"))

    sch = deck_dir / "INCLUDE" / "BC0407_HIST01122006.SCH"
    raw = sch.read_bytes().decode("latin-1")
    stripped, n = re.subn(r"^RPTSCHED[^\n]*\n(?:(?!.*/).*\n)*.*/.*\n", "", raw, flags=re.M)
    sch.write_bytes(stripped.encode("latin-1"))
    print(f"Deck ready in {deck_dir} (monthly restarts, removed {n} RPTSCHED blocks)")


if __name__ == "__main__":
    main()
