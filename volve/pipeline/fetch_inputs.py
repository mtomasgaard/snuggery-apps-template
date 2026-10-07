"""Download every pinned input listed in sources.json and verify it (bytes, sha256, git blob id).

The deck and its includes are Equinor's files as first mirrored (tpp-grupo-166/opm-datasets at
1c323c2, before that repository's own OPM edits); check_provenance.py ties them to Equinor's run log.
The seismic cube is not downloaded here: seismic.py range-reads the traces it needs.
A file that does not match its pin stops the pipeline.

The two copies of Equinor's terms (group 'terms') are not needed to build anything: the text is
committed as data/TERMS-Volve-2026-10-07.txt. They are fetched only with --check-terms, a maintainer
check that the published terms have not changed; a change or an outage there is reported, never
fatal to a rebuild (exit status 3 if a terms file no longer matches its pin, after everything else).

    python3 fetch_inputs.py --inputs work/inputs
    python3 fetch_inputs.py --inputs work/inputs --check-terms
"""
import argparse
import sys
from pathlib import Path

import common

MAINTAINER_ONLY = {"terms"}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inputs", default="work/inputs")
    ap.add_argument("--check-terms", action="store_true",
                    help="also fetch Equinor's terms PDFs and report whether they still match their pins")
    args = ap.parse_args()
    src = common.load_sources()
    total, n, changed = 0, 0, []
    for e in src["files"]:
        group = e.get("group")
        if group in MAINTAINER_ONLY and not args.check_terms:
            print(f"{'skipped':10s} {e['bytes']:>12,}  {e['path']} (not needed to build; --check-terms fetches it)")
            continue
        try:
            how = common.fetch_pinned(e, Path(args.inputs) / e["path"])
        except (SystemExit, RuntimeError) as err:
            if group not in MAINTAINER_ONLY:
                raise
            changed.append(e["path"])
            print(f"WARNING    {e['path']}: {err}", file=sys.stderr)
            continue
        total += e["bytes"]
        n += 1
        print(f"{how:10s} {e['bytes']:>12,}  {e['path']}")
    print(f"{n} files, {total:,} B, all match their pins")
    if changed:
        print(f"Equinor's terms no longer match their pins ({', '.join(changed)}): read the new text against "
              "data/TERMS-Volve-2026-10-07.txt before anything else is published.", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()
