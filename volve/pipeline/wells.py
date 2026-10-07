"""Volve's real wells and reported production, from Equinor's files (fetched and verified by fetch_inputs.py).

  data/wellpaths.json   the 21 'ACTUAL' deviation surveys: MD, and x, y in ED50 / UTM 31N with depth
                        below mean sea level (the survey's TVD below the rotary Kelly bushing minus the
                        well's KB elevation, which Equinor's well picks give as TVD - TVDSS), plus every
                        formation pick Equinor made in the well.
  data/production.json  Equinor's monthly production and injection per wellbore (Sm3 per month,
                        on-stream hours), as reported in 'Volve production data.xlsx'.
No values are changed except the depth datum (stated) and rounding to 0.01 m and 0.1 Sm3.

    python3 wells.py --inputs work/inputs --data-dir ../data
"""
import argparse
import json
import re
from pathlib import Path

DECK_WELLS = ["P-F-1C", "P-F-5", "P-F-11B", "P-F-12", "P-F-14", "P-F-15C", "P-F-15D", "I-F-1B", "I-F-4", "I-F-5",
              "I-F4G"]  # the deck's wells that are real wellbores (PIL-N and PIL-NW are the model's pilots)


# The workbook reports slot F-11's producer as '15/9-F-11' (daily code 'NO 15/9-F-11 H'); the deck's well is
# P-F-11B. Their oil totals agree within 1.4 % (1,147,849 Sm3 reported, 1,164,088 in the deck's WOPTH).
PRODUCTION_ALIASES = {"15/9-F-11": "P-F-11B"}


def key(name):
    """'NO 15/9-F-1 C', '15/9-F-15 D', 'F-15D_ACTUAL', 'P-F-15D' -> 'F-15D'."""
    s = re.sub(r"[ _]ACTUAL.*$", "", name.replace("NO ", "").replace("15/9-", ""))
    s = re.sub(r"^[PI]-", "", s).replace(" ", "").upper()
    return s


def deck_name(k):
    for d in DECK_WELLS:
        if key(d) == k:
            return d
    return None


def read_picks(path):
    """Equinor's Well_picks_Volve_v1.dat: fixed-width blocks per well, columns set by the dashed line."""
    lines = Path(path).read_text(encoding="latin-1").splitlines()
    wells, cols, cur = {}, None, None
    for n, l in enumerate(lines):
        if l.startswith("Well "):
            cur = l[5:].strip(); cols = None; continue
        if cur and l.strip().startswith("---"):
            cols = [(m.start(), m.end()) for m in re.finditer(r"-+", l)]
            names = [lines[n - 1][a:b].strip() for a, b in cols]
            continue
        if cur and cols and l.strip():
            row = {nm: l[a:b].strip() for nm, (a, b) in zip(names, cols)}
            row["Surface name"] = l[cols[1][0]:cols[2][0]].strip()
            wells.setdefault(cur, []).append(row)
    return wells


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def wellpaths(inputs):
    picks = read_picks(Path(inputs) / "field" / "Well_picks_Volve_v1.dat")
    kb = {}
    for w, rows in picks.items():
        d = [num(r["TVD"]) + num(r["TVDSS"]) for r in rows if num(r["TVD"]) is not None and num(r["TVDSS"]) is not None]
        if d:
            kb[key(w)] = round(sum(d) / len(d), 2)
            if max(d) - min(d) > 0.05:
                raise SystemExit(f"{w}: picks disagree on the KB elevation ({min(d):.2f}-{max(d):.2f} m)")
    out = []
    for f in sorted((Path(inputs) / "field" / "wellpaths").iterdir()):
        k = key(f.name)
        rows = [l.split() for l in f.read_text(encoding="latin-1").splitlines()[2:] if l.strip()]
        md, tvd, x, y = ([float(r[i]) for r in rows] for i in (0, 3, 6, 7))
        kbk, src = (k, "picks") if k in kb else (re.sub(r"(T\d+|[A-Z])$", "", k), "picks of the parent wellbore (same slot)")
        if kbk not in kb:
            raise SystemExit(f"{f.name}: no KB elevation in Equinor's picks")
        wname = next((w for w in picks if key(w) == k), None)
        out.append({
            "wellbore": "15/9-" + re.sub(r"[ _]ACTUAL.*$", "", f.name),
            "file": f.name, "deckWell": deck_name(k), "kb": kb[kbk], "kbFrom": src,
            "md": [round(v, 2) for v in md], "x": [round(v, 2) for v in x], "y": [round(v, 2) for v in y],
            "tvdss": [round(v - kb[kbk], 2) for v in tvd],
            "picks": [{"surface": r["Surface name"], "obs": int(r["Obs#"] or 1), "qlf": r["Qlf"] or None,
                       "md": num(r["MD"]), "tvdss": None if num(r["TVDSS"]) is None else -num(r["TVDSS"]),
                       "x": num(r["Easting"]), "y": num(r["Northing"])} for r in picks.get(wname, [])],
        })
    return {"crs": "ED50 / UTM zone 31N (EPSG:23031), metres",
            "depth": "tvdss: metres below mean sea level, positive down (survey TVD below RKB minus kb). Pick depths "
                     "are Equinor's TVDSS with the sign turned positive down.",
            "source": "Equinor, Volve data set: 'ACTUAL' deviation surveys and Well_picks_Volve_v1.dat",
            "wells": out}


def production(inputs):
    import openpyxl
    wb = openpyxl.load_workbook(Path(inputs) / "field" / "Volve production data.xlsx", read_only=True, data_only=True)
    rows = list(wb["Monthly Production Data"].iter_rows(values_only=True))
    head = rows[0]  # rows[1] holds the units (hrs, Sm3)
    if list(head) != ["Wellbore name", "NPDCode", "Year", "Month", "On Stream", "Oil", "Gas", "Water", "GI", "WI"]:
        raise SystemExit(f"unexpected monthly sheet header {head}")
    recs = [r for r in rows[2:] if r[0]]
    months = sorted({(int(r[2]), int(r[3])) for r in recs})
    first, last = months[0], months[-1]
    allm, (yy, mm) = [], first
    while (yy, mm) <= last:
        allm.append((yy, mm)); mm += 1
        if mm == 13:
            yy, mm = yy + 1, 1
    idx = {m: n for n, m in enumerate(allm)}
    wells = {}
    for r in recs:
        w = wells.setdefault(r[0], {"npdCode": r[1], "deckWell": PRODUCTION_ALIASES.get(r[0]) or deck_name(key(r[0])),
                                    **{f: [None] * len(allm) for f in ("hours", "oil", "gas", "water", "gi", "wi")}})
        for f, v in zip(("hours", "oil", "gas", "water", "gi", "wi"), r[4:10]):
            v = num(v)
            w[f][idx[(int(r[2]), int(r[3]))]] = None if v is None else round(v, 1)
    return {"months": [f"{y:04d}-{m:02d}" for y, m in allm], "unit": "Sm3 per month; hours on stream per month",
            "source": "Equinor, Volve data set: 'Volve production data.xlsx', sheet 'Monthly Production Data' "
                      "(null where the sheet has no value)",
            "wells": dict(sorted(wells.items()))}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inputs", default="work/inputs")
    ap.add_argument("--data-dir", default=str(Path(__file__).resolve().parent.parent / "data"))
    args = ap.parse_args()
    out = Path(args.data_dir)
    wp = wellpaths(args.inputs)
    (out / "wellpaths.json").write_text(json.dumps(wp, separators=(",", ":"), ensure_ascii=False) + "\n")
    pr = production(args.inputs)
    (out / "production.json").write_text(json.dumps(pr, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"wellpaths.json: {len(wp['wells'])} wells, {sum(len(w['md']) for w in wp['wells'])} survey stations, "
          f"KB {sorted({w['kb'] for w in wp['wells']})} m; production.json: {len(pr['wells'])} wellbores, "
          f"{pr['months'][0]} to {pr['months'][-1]}")


if __name__ == "__main__":
    main()
