"""Turn OPM Flow output for Norne into the viewer's data files (see data/ATTRIBUTION.txt for the layout)."""
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

BASE = "NORNE_ATW2013"
# corner indices per face: -I, +I, -J, +J, top (-K), bottom (+K)
FACE = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]]
OPP = [1, 0, 3, 2, 5, 4]
TOL = 0.5  # metres: faces closer than this count as shared (anything else is a fault face)
STATIC_ORDER = ["PORO", "PERMX", "PERMZ", "NTG", "FIPNUM", "DEPTH"]
RATE_VECTORS = {"oil": "OPT", "water": "WPT", "gas": "GPT", "winj": "WIT", "ginj": "GIT"}
SOURCE = ("Data: Norne benchmark case from Equinor and the Norne partners, published by the Open Porous Media "
          "initiative under the Open Database License (ODbL) 1.0. Saturations and pressures come from an OPM Flow "
          "2026.04 run of the public deck from 6 Nov 1997 to 1 Dec 2006. Field oil, water and gas totals from that "
          "run are within 0.4% of the published Eclipse 2014.2 reference results for the same deck. Rates are "
          "monthly averages from the simulation, which is driven by the field's historical well controls.")


def grid(results, out):
    g = ecl.EGrid(str(results / f"{BASE}.EGRID"))
    ni, nj, nk = g.dimension
    na = g.active_cells
    corn = np.zeros((na, 8, 3), dtype=np.float64)
    ijk = np.zeros((na, 3), dtype=np.int32)
    for a in range(na):
        x, y, z = g.xyz_from_active_index(a)
        corn[a, :, 0] = x; corn[a, :, 1] = y; corn[a, :, 2] = z
        ijk[a] = g.ijk_from_active_index(a)
    gidx = -np.ones((ni, nj, nk), dtype=np.int64)
    gidx[ijk[:, 0], ijk[:, 1], ijk[:, 2]] = np.arange(na)

    def match(a, fa, b, fb):
        return np.max(np.abs(corn[a, FACE[fa]] - corn[b, FACE[fb]])) < TOL

    nb = -np.ones((na, 6), dtype=np.int32)
    for a in range(na):
        i, j, k = ijk[a]
        for f, (di, dj) in enumerate([(-1, 0), (1, 0), (0, -1), (0, 1)]):
            ii, jj = i + di, j + dj
            if 0 <= ii < ni and 0 <= jj < nj:
                b = gidx[ii, jj, k]
                if b >= 0 and match(a, f, b, OPP[f]):
                    nb[a, f] = b
        for f, dk in ((4, -1), (5, 1)):  # next active cell in the column (handles pinch-outs)
            kk = k + dk
            while 0 <= kk < nk and gidx[i, j, kk] < 0:
                kk += dk
            if 0 <= kk < nk and match(a, f, gidx[i, j, kk], OPP[f]):
                nb[a, f] = gidx[i, j, kk]
    print(f"grid {ni} x {nj} x {nk}, {na} active cells, {int((nb < 0).sum())} open faces")

    origin = corn.reshape(-1, 3).min(0)
    cmax = corn.reshape(-1, 3).max(0)
    center = (origin + cmax) / 2
    (corn - center).astype(np.float32).tofile(out / "geometry.bin")
    nb.astype(np.int32).tofile(out / "neighbours.bin")
    ijk.astype(np.uint8).tofile(out / "ijk.bin")
    return dict(ni=ni, nj=nj, nk=nk, na=na, corn=corn, ijk=ijk, gidx=gidx, center=center, extent=cmax - origin)


def static_props(results, out):
    init = ecl.EclFile(str(results / f"{BASE}.INIT"))
    static = {k: np.array(init[k], dtype=np.float32) for k in STATIC_ORDER}
    np.concatenate([static[k] for k in STATIC_ORDER]).astype(np.float32).tofile(out / "static.bin")
    return {k: [float(np.nanmin(v)), float(np.nanmax(v))] for k, v in static.items()}


def wells(deck_path, G):
    pc = ParseContext([("PARSE_EXTRA_RECORDS", opm.io.action.ignore), ("PARSE_RANDOM_SLASH", opm.io.action.ignore)])
    deck = Parser().parse(str(deck_path), pc)
    sch = Schedule(deck, EclipseState(deck))
    nsteps = len(sch.reportsteps)
    corn, gidx, center, nk = G["corn"], G["gidx"], G["center"], G["nk"]
    centers = corn.mean(1)
    top_depth = float(corn[:, :, 2].min())

    recs, codes = {}, {}
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
        })
    print(f"{len(out)} wells")
    return out


def dynamic(results, out, na):
    rst = ecl.ERst(str(results / f"{BASE}.UNRST"))
    all_steps = list(rst.report_steps)
    steps, seen = [], set()
    for n, s in enumerate(all_steps):  # first restart in each month, plus the final state
        ih = rst["INTEHEAD", s]
        ym = (int(ih[66]), int(ih[65]))
        if ym not in seen or n == len(all_steps) - 1:
            seen.add(ym); steps.append(s)
    frames, sw, sg, pr = [], [], [], []
    for s in steps:
        ih = rst["INTEHEAD", s]
        frames.append({"step": int(s), "date": dt.date(int(ih[66]), int(ih[65]), int(ih[64])).isoformat()})
        sw.append(np.array(rst["SWAT", s], dtype=np.float32))
        sg.append(np.array(rst["SGAS", s], dtype=np.float32))
        pr.append(np.array(rst["PRESSURE", s], dtype=np.float32))
    pmin = np.floor(float(min(p.min() for p in pr)))
    pmax = np.ceil(float(max(p.max() for p in pr)))
    with open(out / "dynamic.bin", "wb") as f:
        for a, b, p in zip(sw, sg, pr):
            f.write(np.clip(np.rint(a * 255), 0, 255).astype(np.uint8).tobytes())
            f.write(np.clip(np.rint(b * 255), 0, 255).astype(np.uint8).tobytes())
            f.write(np.clip(np.rint((p - pmin) / (pmax - pmin) * 65535), 0, 65535).astype(np.uint16).tobytes())
    print(f"{len(frames)} frames, {frames[0]['date']} to {frames[-1]['date']}, pressure {pmin}-{pmax} bar")
    return frames, [pmin, pmax]


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

    summary = {"field": {}, "wells": {}}
    for k, v in RATE_VECTORS.items():
        r = avg_rate("F" + v)
        if r is not None:
            summary["field"][k] = [round(float(x), 1) for x in r]
    for name in well_names:
        rec = {}
        for k, v in RATE_VECTORS.items():
            r = avg_rate(f"W{v}:{name}")
            if r is not None and np.any(r > 0):
                rec[k] = [round(float(x), 1) for x in r]
        summary["wells"][name] = rec
    return summary


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--deck", default="work/norne/NORNE_ATW2013.DATA")
    ap.add_argument("--results", default="work/results", help="folder with the OPM Flow output")
    ap.add_argument("--data-dir", default=str(Path(__file__).resolve().parent.parent / "data"))
    args = ap.parse_args()
    results, out = Path(args.results), Path(args.data_dir)
    out.mkdir(parents=True, exist_ok=True)

    G = grid(results, out)
    ranges = static_props(results, out)
    well_list = wells(Path(args.deck), G)
    frames, prange = dynamic(results, out, G["na"])
    summary = rates(results, frames, [w["name"] for w in well_list])

    for w in well_list:
        codes = w.pop("codes")
        w["state"] = [int(codes[min(fr["step"], len(codes) - 1)]) for fr in frames]
    model = {
        "name": "Norne",
        "source": SOURCE,
        "NI": int(G["ni"]), "NJ": int(G["nj"]), "NK": int(G["nk"]), "NA": int(G["na"]),
        "center": [float(c) for c in G["center"]], "extent": [float(v) for v in G["extent"]],
        "files": {"geometry": "geometry.bin", "neighbours": "neighbours.bin", "ijk": "ijk.bin",
                  "static": "static.bin", "dynamic": "dynamic.bin"},
        "static": {"order": STATIC_ORDER, "ranges": ranges},
        "dynamic": {"order": ["SWAT", "SGAS", "PRESSURE"], "frameBytes": 4 * int(G["na"]), "pressureRange": prange},
        "frames": [fr["date"] for fr in frames],
        "wells": [{k: w[k] for k in ("name", "path", "pathCells", "cells", "state")} for w in well_list],
        "summary": summary,
    }
    (out / "model.json").write_text(json.dumps(model, separators=(",", ":")))
    print(f"Wrote data files to {out}")


if __name__ == "__main__":
    main()
