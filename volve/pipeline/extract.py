"""Turn OPM Flow's output for Volve into the viewer's data files, as Norne's pipeline does.

Same layout as norne-reservoir/data (see data/ATTRIBUTION.txt), with three differences:
  - coordinates are ED50 / UTM zone 31N: the grid's MAPAXES is applied (OPM's EGrid does it), so the
    model and data/seismic.json share one map frame and one depth axis (metres, positive down);
  - frames are quarterly: the first restart in each calendar quarter, plus the initial and final
    states (the run writes one a month; prepare_deck.py);
  - each well also carries its history targets per frame (the WCONHIST/WCONINJE rates the run is
    driven by) and the summary carries the history rates beside the simulated ones.
Neighbours follow Norne's rule (faces within 0.5 m are shared; the next active cell in a column is
the vertical neighbour), computed with arrays rather than a loop; the result is the same.

    python3 extract.py --deck work/deck/VOLVE_2016.DATA --results work/results --data-dir ../data
"""
import argparse
import datetime as dt
import json
from pathlib import Path

import numpy as np
import opm.io
import opm.io.ecl as ecl
from opm.io.ecl_state import EclipseState
from opm.io.parser import Parser, ParseContext
from opm.io.schedule import Schedule

BASE = "VOLVE_2016"
# corner indices per face: -I, +I, -J, +J, top (-K), bottom (+K)
FACE = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]]
OPP = [1, 0, 3, 2, 5, 4]
TOL = 0.5  # metres: faces closer than this count as shared (anything else is a fault face)
STATIC_ORDER = ["PORO", "PERMX", "PERMZ", "NTG", "FIPNUM", "DEPTH"]
RATE_VECTORS = {"oil": "OPT", "water": "WPT", "gas": "GPT", "winj": "WIT", "ginj": "GIT"}
HISTORY_VECTORS = {"oil": "OPTH", "water": "WPTH", "gas": "GPTH", "winj": "WITH"}
QUARTER_MONTHS = (1, 4, 7, 10)


def grid(results, out):
    g = ecl.EGrid(str(results / f"{BASE}.EGRID"))
    ni, nj, nk = g.dimension
    na = g.active_cells
    corn = np.zeros((na, 8, 3), dtype=np.float64)
    ijk = np.zeros((na, 3), dtype=np.int64)
    for a in range(na):
        x, y, z = g.xyz_from_active_index(a, True)  # True: MAPAXES applied, ED50 / UTM 31N
        corn[a, :, 0] = x; corn[a, :, 1] = y; corn[a, :, 2] = z
        ijk[a] = g.ijk_from_active_index(a)
    i, j, k = ijk[:, 0], ijk[:, 1], ijk[:, 2]
    gidx = -np.ones((ni, nj, nk), dtype=np.int64)
    gidx[i, j, k] = np.arange(na)

    def shared(a, fa, b, fb):
        return np.abs(corn[a][:, FACE[fa]] - corn[b][:, FACE[fb]]).max(axis=(1, 2)) < TOL

    nb = -np.ones((na, 6), dtype=np.int32)
    for f, (di, dj) in enumerate([(-1, 0), (1, 0), (0, -1), (0, 1)]):
        ii, jj = i + di, j + dj
        inside = (ii >= 0) & (ii < ni) & (jj >= 0) & (jj < nj)
        b = np.full(na, -1, dtype=np.int64)
        b[inside] = gidx[ii[inside], jj[inside], k[inside]]
        a = np.nonzero(b >= 0)[0]
        ok = shared(a, f, b[a], OPP[f])
        nb[a[ok], f] = b[a][ok]
    order = np.lexsort((k, j, i))  # by column, then down the column: the next active cell is the neighbour
    up, down = order[:-1], order[1:]
    same = (i[up] == i[down]) & (j[up] == j[down])
    up, down = up[same], down[same]
    ok = shared(up, 5, down, 4)
    nb[up[ok], 5] = down[ok]
    nb[down[ok], 4] = up[ok]
    print(f"grid {ni} x {nj} x {nk}, {na} active cells, {int((nb < 0).sum())} open faces")

    pts = corn.reshape(-1, 3)
    origin, cmax = pts.min(0), pts.max(0)
    center = (origin + cmax) / 2
    (corn - center).astype(np.float32).tofile(out / "geometry.bin")
    nb.astype(np.int32).tofile(out / "neighbours.bin")
    ijk.astype(np.uint8).tofile(out / "ijk.bin")
    mapaxes = [float(v) for v in g.export_mapaxes()] if hasattr(g, "export_mapaxes") else None
    return dict(ni=ni, nj=nj, nk=nk, na=na, corn=corn, ijk=ijk, gidx=gidx, center=center, extent=cmax - origin,
                mapaxes=mapaxes)


def static_props(results, out, na):
    init = ecl.EclFile(str(results / f"{BASE}.INIT"))
    names = {a[0] for a in init.arrays}
    static, notes = {}, {}
    for kname in STATIC_ORDER:
        if kname in names:
            static[kname] = np.array(init[kname], dtype=np.float32)
        elif kname == "NTG":  # the deck has no NTG ('effective poro & perm'): net to gross is 1
            static[kname] = np.ones(na, dtype=np.float32); notes[kname] = "not in the deck: 1 everywhere"
        else:
            raise SystemExit(f"{kname} missing from {BASE}.INIT")
        if len(static[kname]) != na:
            raise SystemExit(f"{kname} has {len(static[kname])} values for {na} active cells")
    np.concatenate([static[kn] for kn in STATIC_ORDER]).astype(np.float32).tofile(out / "static.bin")
    return {kn: [float(np.nanmin(v)), float(np.nanmax(v))] for kn, v in static.items()}, notes


def schedule(deck_path):
    pc = ParseContext([("PARSE_EXTRA_RECORDS", opm.io.action.ignore), ("PARSE_RANDOM_SLASH", opm.io.action.ignore)])
    deck = Parser().parse(str(deck_path), pc)
    return Schedule(deck, EclipseState(deck))


def wells(sch, G):
    nsteps = len(sch.reportsteps)
    corn, gidx, center, nk = G["corn"], G["gidx"], G["center"], G["nk"]
    centers = corn.mean(1)
    top_depth = float(corn[:, :, 2].min())
    recs, codes, targets = {}, {}, {}
    for step in range(nsteps):
        for w in sch.get_wells(step):
            rec = recs.setdefault(w.name, {"conn": [], "head": list(w.pos()[:2])})
            for c in w.connections():
                if [c.i, c.j, c.k] not in rec["conn"]:
                    rec["conn"].append([c.i, c.j, c.k])
            code = 0  # 0 shut or not drilled, 1 producer, 2 water injector, 3 gas injector
            if w.status() == "OPEN":
                code = 1 if w.isproducer() else 3 if w.preferred_phase == "GAS" else 2
            codes.setdefault(w.name, [0] * nsteps)[step] = code
            t = targets.setdefault(w.name, [None] * nsteps)
            if w.isproducer():
                p = sch.get_production_properties(w.name, step)
                t[step] = [round(p["oil_rate"], 1), round(p["water_rate"], 1), round(p["gas_rate"], 1), 0.0]
            else:
                p = sch.get_injection_properties(w.name, step)
                t[step] = [0.0, 0.0, 0.0, round(p["surf_inj_rate"], 1)]

    def column_xy(i, j):
        ks = [gidx[i, j, k] for k in range(nk) if gidx[i, j, k] >= 0]
        return centers[ks[0], :2] if ks else None

    out = []
    for name, rec in recs.items():
        pts, cells = [], [-1]
        for (i, j, k) in rec["conn"]:
            a = gidx[i, j, k]
            if a >= 0:
                pts.append(centers[a]); cells.append(int(a))
        if not pts:
            continue
        hxy = column_xy(*rec["head"])
        if hxy is None:
            hxy = pts[0][:2]
        path = [np.array([hxy[0], hxy[1], top_depth - 120.0])] + pts
        out.append({
            "name": name,
            "path": [[round(float(p[d] - center[d]), 1) for d in range(3)] for p in path],
            "pathCells": cells,
            "cells": [[int(x) + 1 for x in c] for c in rec["conn"]],
            "codes": codes[name],
            "targets": targets[name],
        })
    print(f"{len(out)} wells")
    return out


def quarterly(dates):
    """Indices of the first restart in each calendar quarter, plus the first and last restart."""
    keep, seen = [0], set()
    for n, d in enumerate(dates):
        q = (d.year, (d.month - 1) // 3)
        if n > 0 and q not in seen and d.month in QUARTER_MONTHS:
            keep.append(n)
        seen.add(q)
    if keep[-1] != len(dates) - 1:
        keep.append(len(dates) - 1)
    return sorted(set(keep))


def dynamic(results, out, na):
    rst = ecl.ERst(str(results / f"{BASE}.UNRST"))
    all_steps = list(rst.report_steps)
    dates = []
    for s in all_steps:
        ih = rst["INTEHEAD", s]
        dates.append(dt.date(int(ih[66]), int(ih[65]), int(ih[64])))
    steps = [all_steps[n] for n in quarterly(dates)]
    frames, sw, sg, pr = [], [], [], []
    for s in steps:
        ih = rst["INTEHEAD", s]
        frames.append({"step": int(s), "date": dt.date(int(ih[66]), int(ih[65]), int(ih[64])).isoformat()})
        for arr, key in ((sw, "SWAT"), (sg, "SGAS"), (pr, "PRESSURE")):
            v = np.array(rst[key, s], dtype=np.float32)
            if len(v) != na:
                raise SystemExit(f"{key} at step {s} has {len(v)} values for {na} active cells")
            arr.append(v)
    pmin = np.floor(float(min(p.min() for p in pr)))
    pmax = np.ceil(float(max(p.max() for p in pr)))
    with open(out / "dynamic.bin", "wb") as f:
        for a, b, p in zip(sw, sg, pr):
            f.write(np.clip(np.rint(a * 255), 0, 255).astype(np.uint8).tobytes())
            f.write(np.clip(np.rint(b * 255), 0, 255).astype(np.uint8).tobytes())
            f.write(np.clip(np.rint((p - pmin) / (pmax - pmin) * 65535), 0, 65535).astype(np.uint16).tobytes())
    print(f"{len(frames)} frames of {len(all_steps)} restarts, {frames[0]['date']} to {frames[-1]['date']}, "
          f"pressure {pmin}-{pmax} bar")
    return frames, [pmin, pmax], len(all_steps)


def rates(results, frames, well_names):
    sm = ecl.ESmry(str(results / f"{BASE}.SMSPEC"))
    keys = set(sm.keys())
    start = dt.date.fromisoformat(frames[0]["date"])
    tday = np.array(sm["TIME"], dtype=np.float64)
    fday = np.array([(dt.date.fromisoformat(fr["date"]) - start).days for fr in frames], dtype=np.float64)

    def avg_rate(key):  # average rate over each frame interval, from cumulative totals
        if key not in keys:
            return None
        tot = np.interp(fday, tday, np.array(sm[key], dtype=np.float64), left=0.0)
        r = np.zeros_like(tot)
        dd = np.diff(fday); dd[dd == 0] = 1
        r[1:] = np.diff(tot) / dd
        return r

    def block(vectors, prefix_field, wells_fmt):
        res = {"field": {}, "wells": {}}
        for k, v in vectors.items():
            r = avg_rate(prefix_field + v)
            if r is not None:
                res["field"][k] = [round(float(x), 1) for x in r]
        for name in well_names:
            rec = {}
            for k, v in vectors.items():
                r = avg_rate(wells_fmt.format(v=v, w=name))
                if r is not None and np.any(r > 0):
                    rec[k] = [round(float(x), 1) for x in r]
            res["wells"][name] = rec
        return res

    summary = block(RATE_VECTORS, "F", "W{v}:{w}")
    summary["history"] = block(HISTORY_VECTORS, "F", "W{v}:{w}")
    return summary


def source_sentence(val):
    """What the app shows as the data's source: only what validate.py measured, in its own terms."""
    f, p = val["field"], val["pressure"]
    keys = ("FOPT", "FWPT", "FGPT", "FWIT")
    end = max(abs(f[k]["diffPct"]) for k in keys)
    path = max(f[k]["pathMaxPct"] for k in keys)
    return ("Data: the Volve field's simulation model (deck VOLVE_2016.DATA) from Equinor and the former Volve licence "
            "partners, under Equinor's Terms and conditions for licence to data - Volve (see ATTRIBUTION.txt). "
            f"Saturations and pressures come from our own OPM Flow {val['opm']} run of that deck, with the edits "
            f"ATTRIBUTION.txt lists, from {val['start']} to {val['end']}; they are not Equinor's figures. Compared with "
            "Equinor's Eclipse 2015.1 run of the same deck: field oil, water and gas produced and water injected are "
            f"within {end:.1f}% at the end of the run (largest difference along the way {path:.1f}%, counted once a total "
            f"reaches 10% of its final value); field pressure is within {p['meanAbsBar']:.1f} bar on average "
            f"(largest {p['maxAbsBar']:.1f} bar). Rates are averages between frames, from the simulation, which is "
            "driven by the field's historical well rates.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--deck", default="work/deck/VOLVE_2016.DATA")
    ap.add_argument("--results", default="work/results", help="folder with the OPM Flow output")
    ap.add_argument("--data-dir", default=str(Path(__file__).resolve().parent.parent / "data"))
    args = ap.parse_args()
    results, out = Path(args.results), Path(args.data_dir)
    out.mkdir(parents=True, exist_ok=True)
    val = json.loads((out / "validation.json").read_text())  # written by validate.py, which must pass first
    if not val.get("pass"):
        raise SystemExit("validate.py did not pass: no data is extracted from this run")

    G = grid(results, out)
    ranges, notes = static_props(results, out, G["na"])
    sch = schedule(Path(args.deck))
    well_list = wells(sch, G)
    frames, prange, nrst = dynamic(results, out, G["na"])
    summary = rates(results, frames, [w["name"] for w in well_list])

    for w in well_list:
        codes, targets = w.pop("codes"), w.pop("targets")
        w["state"] = [int(codes[min(fr["step"], len(codes) - 1)]) for fr in frames]
        w["targets"] = [targets[min(fr["step"], len(targets) - 1)] or [0.0, 0.0, 0.0, 0.0] for fr in frames]
    model = {
        "name": "Volve",
        "source": source_sentence(val),
        "NI": int(G["ni"]), "NJ": int(G["nj"]), "NK": int(G["nk"]), "NA": int(G["na"]),
        "crs": "ED50 / UTM zone 31N (EPSG:23031); depth in metres below mean sea level, positive down (the "
               "deck states no datum; measured: its completed cells lie on the surveyed well paths below sea "
               "level, tools/DECISIONS.md section 7)",
        "mapaxes": G["mapaxes"],
        "center": [float(c) for c in G["center"]], "extent": [float(v) for v in G["extent"]],
        "files": {"geometry": "geometry.bin", "neighbours": "neighbours.bin", "ijk": "ijk.bin",
                  "static": "static.bin", "dynamic": "dynamic.bin"},
        "static": {"order": STATIC_ORDER, "ranges": ranges, "notes": notes},
        "dynamic": {"order": ["SWAT", "SGAS", "PRESSURE"], "frameBytes": 4 * int(G["na"]), "pressureRange": prange},
        "frames": [fr["date"] for fr in frames],
        "frameSteps": [fr["step"] for fr in frames],
        "reportSteps": len(sch.reportsteps), "restartsWritten": nrst,
        "wells": [{k: w[k] for k in ("name", "path", "pathCells", "cells", "state", "targets")} for w in well_list],
        "targetsOrder": ["oil", "water", "gas", "injected"],
        "targetsUnit": "Sm3/day, the deck's WCONHIST and WCONINJE rates in force from each frame's date",
        "summary": summary,
        "validation": {k: val[k] for k in ("reference", "field", "pressure", "tolerances")},
    }
    (out / "model.json").write_text(json.dumps(model, separators=(",", ":")))
    print(f"Wrote data files to {out}")


if __name__ == "__main__":
    main()
