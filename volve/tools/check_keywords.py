"""Check every keyword of the prepared Volve deck against OPM Flow 2026.04's own support tables.

opm-common's parser (the opm wheel, the library Flow uses) parses work/deck with the default,
strict parse context, so an unknown keyword or stray text fails here. Every keyword it returns is
then looked up in opm-simulators' UnsupportedFlowKeywords.cpp and PartiallySupportedFlowKeywords.cpp
at the release/2026.04/final commit: an unsupported keyword marked critical, or an item value a
critical partial-support rule forbids, would stop Flow, so it fails this check. Non-critical ones
are listed as the warnings Flow will print. Last, OPM builds the deck's SUMMARY configuration (which
stops on an unknown well or group) and every vector validate.py and extract.py read must be in it.

    python3 tools/check_keywords.py --deck pipeline/work/deck/VOLVE_2016.DATA --cache pipeline/work/opm-src
"""
import argparse
import hashlib
import re
import sys
import urllib.request
from collections import Counter
from pathlib import Path

SIM_COMMIT = "b82f21dba405286c4c4446614dd3bf9cdebf7a2c"  # OPM/opm-simulators tag release/2026.04/final
URL = "https://raw.githubusercontent.com/OPM/opm-simulators/{c}/opm/simulators/utils/{f}"


def source(cache, name):
    p = Path(cache) / name
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(URL.format(c=SIM_COMMIT, f=name), timeout=60) as r:
            p.write_bytes(r.read())
    digest = hashlib.sha256(p.read_bytes()).hexdigest()
    if PINS.get(name) and digest != PINS[name]:
        raise SystemExit(f"{name}: sha256 {digest} is not the pinned {PINS[name]}")
    return p.read_text()


NEEDED_VECTORS = ["FOPT", "FWPT", "FGPT", "FWIT", "FPR", "FOPTH", "WOPT", "WWPT", "WGPT", "WWIT", "WGIT",
                  "WOPTH", "WWPTH", "WGPTH", "WWITH"]
PINS = {"UnsupportedFlowKeywords.cpp": "5dff9b52265ec69048443d7ea4f9ced187fe17d6c637896a2c5f6e9a074a8207",
        "PartiallySupportedFlowKeywords.cpp": "703239d6647967368c8ed3a954c2cd91d28180a9bfd4b8449ab6d12ccd93d7fb"}


def unsupported_table(text):
    return {m.group(1): m.group(2) == "true" for m in re.finditer(r'\{"(\w+)",\s*\{(true|false),', text)}


def partial_table(text):
    """{keyword: [(item 1-based, critical, kind, values or (lo, hi), message)]}."""
    out = {}
    for m in re.finditer(r'\{\s*"(\w+)",\s*\{((?:\s*\{\d+,\{.*?\}\},?(?:\s*//[^\n]*)?)+)\s*\},?\s*\}', text, flags=re.S):
        rules = []
        for r in re.finditer(r'\{(\d+),\{(true|false),\s*(.*?),\s*"([^"]*)"\}\}', m.group(2), flags=re.S):
            item, crit, rule, msg = int(r.group(1)), r.group(2) == "true", r.group(3), r.group(4)
            a = re.match(r"allow_values<([\w:]+)>\s*\{(.*)\}", rule, flags=re.S)
            if a:
                vals = [v.strip().strip('"') for v in a.group(2).split(",") if v.strip()]
                rules.append((item, crit, "allow", (a.group(1), vals), msg))
                continue
            b = re.search(r"return x >= (-?[\d.]+) && x <= (-?[\d.]+);", rule)
            if b:
                rules.append((item, crit, "range", (float(b.group(1)), float(b.group(2))), msg))
                continue
            c = re.search(r"return x == (-?[\d.]+);", rule)
            if c:
                rules.append((item, crit, "range", (float(c.group(1)), float(c.group(1))), msg))
                continue
            rules.append((item, crit, "other", rule.strip(), msg))
        out[m.group(1)] = rules
    return out


def item_values(kw, item):
    vals = []
    for rec in kw:
        if len(rec) < item:
            continue
        it = rec[item - 1]
        try:
            v = it.get_str(0) if it.is_string() else it.get_int(0) if it.is_int() else it.get_raw(0)
        except Exception:
            continue  # defaulted
        vals.append(v.strip("'").strip() if isinstance(v, str) else v)
    return vals


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--deck", default="pipeline/work/deck/VOLVE_2016.DATA")
    ap.add_argument("--cache", default="pipeline/work/opm-src")
    args = ap.parse_args()
    from opm.io.parser import Parser
    deck = Parser().parse(args.deck)  # default ParseContext: unknown keywords and stray text are errors
    names = Counter(kw.name for kw in deck)
    unsup = unsupported_table(source(args.cache, "UnsupportedFlowKeywords.cpp"))
    part = partial_table(source(args.cache, "PartiallySupportedFlowKeywords.cpp"))
    print(f"deck parsed by opm-common: {sum(names.values())} keywords, {len(names)} distinct; Flow tables at "
          f"opm-simulators {SIM_COMMIT[:12]}: {len(unsup)} unsupported, {len(part)} partially supported")
    fatal, warn = [], []
    for name in sorted(names):
        if name in unsup:
            (fatal if unsup[name] else warn).append(f"{name}: not supported by Flow"
                                                    f"{' (critical)' if unsup[name] else ' (ignored, warning)'}")
        for item, crit, kind, rule, msg in part.get(name, []):
            vals = [v for kw in deck if kw.name == name for v in item_values(kw, item)]
            if kind == "allow":
                typ, allowed = rule
                conv = (lambda v: str(v).upper()) if typ == "std::string" else (lambda v: float(v))
                allowed_c = [conv(a) for a in allowed]
                bad = [v for v in vals if conv(v) not in allowed_c]
            elif kind == "range":
                bad = [v for v in vals if not (rule[0] <= float(v) <= rule[1])]
            else:
                bad = vals if vals else []
            if bad:
                (fatal if crit else warn).append(f"{name} item {item}: {msg} (deck has {sorted(set(map(str, bad)))})"
                                                 + ("" if kind != "other" else " [rule not evaluated]"))
    for w in warn:
        print("  warning:", w)
    for f in fatal:
        print("  STOPS FLOW:", f)
    from opm.io.ecl_state import EclipseState
    from opm.io.schedule import Schedule
    from opm.io.summary import SummaryConfig
    state = EclipseState(deck)
    summary = SummaryConfig(deck, state, Schedule(deck, state))
    missing = [v for v in NEEDED_VECTORS if v not in summary]
    print(f"summary output: {len(NEEDED_VECTORS) - len(missing)} of the {len(NEEDED_VECTORS)} vectors the pipeline reads"
          + (f"; missing {missing}" if missing else ""))
    fatal += [f"summary vector {v} is not written" for v in missing]
    print("PASS: nothing in the deck stops OPM Flow 2026.04, and the summary has what the pipeline reads"
          if not fatal else "FAIL: see the lines above")
    sys.exit(1 if fatal else 0)


if __name__ == "__main__":
    main()
