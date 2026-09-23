"""Gate a data rebuild: the simulation against OPM's published reference, and the topside layers
against the app's own model.

Two independent checks live here.

*The simulation* is compared with the Eclipse 2014.2 reference summary that OPM publishes in
opm-tests. The reference has field and well summaries only (no 3D results). Exits non-zero if
field totals drift more than --tolerance percent. This needs opm and numpy, which have
Linux x86_64 wheels only, so its imports are made inside the function -- the topside checks run
anywhere Python does.

*The topside layers* (data/topside.json and, if present, data/topside-network.json) are read back
and checked against data/model.json and data/geometry.bin: the frame count, the FPSO's offset,
every template inside the grid footprint and on the right frame, the tee's distance from the
Asgard trunk, the reported production series, and the rule that no drawn line joins Norne to a
refinery.

    python3 validate.py --results work/results --work work     # the simulation
    python3 validate.py --topside-only --data-dir ../data      # the topside layers
"""
import argparse
import array
import json
import math
import subprocess
import sys
from pathlib import Path

OPM_TESTS = "https://github.com/OPM/opm-tests.git"
PINNED_COMMIT = "2e1c5814197e17d167ca36b2eade49aa159b534f"
REF = "norne/ECL.2014.2/NORNE_ATW2013.SMSPEC"

# What the research established and the build must keep reproducing (NOTES/DESIGN.md 2.1-2.4).
FPSO_OFFSET = (-463, 316)
TEMPLATE_COUNTS = {0: 3, 1: 4, 9: 5, 108: 6}      # frame -> templates in service
TEE_MAX_OFFSET_M = 5.0
TOPSIDE_MAX_BYTES = 20_000
NETWORK_MAX_BYTES = 220_000


def fetch_reference(work, commit):
    repo = work / "opm-tests"
    if not repo.exists():
        subprocess.run(["git", "clone", "--filter=blob:none", "--sparse", "--no-checkout", OPM_TESTS, str(repo)], check=True)
        subprocess.run(["git", "sparse-checkout", "set", "norne/ECL.2014.2"], cwd=repo, check=True)
    subprocess.run(["git", "fetch", "--depth", "1", "origin", commit], cwd=repo, check=True)
    subprocess.run(["git", "checkout", "--quiet", commit], cwd=repo, check=True)
    return repo / REF


def check_simulation(args):
    import numpy as np
    import opm.io.ecl as ecl

    ref_path = fetch_reference(Path(args.work).resolve(), args.commit)
    ours = ecl.ESmry(str(Path(args.results) / "NORNE_ATW2013.SMSPEC"))
    ref = ecl.ESmry(str(ref_path))
    ok = True
    print(f"end of run: ours {ours['TIME'][-1]:.0f} days, reference {ref['TIME'][-1]:.0f} days")
    for key, label in [("FOPT", "oil produced"), ("FWPT", "water produced"), ("FGPT", "gas produced"),
                       ("FWIT", "water injected"), ("FGIT", "gas injected")]:
        a, b = float(ours[key][-1]), float(ref[key][-1])
        diff = 100 * (a - b) / b
        hist = f", observed history {float(ref[key + 'H'][-1]):,.0f}" if key + "H" in ref.keys() else ""
        print(f"{label:15s} ours {a:,.0f}  reference {b:,.0f}  ({diff:+.2f}%){hist}")
        ok &= abs(diff) <= args.tolerance
    fpr = np.interp(np.array(ref["TIME"]), np.array(ours["TIME"]), np.array(ours["FPR"]))
    dp = float(np.mean(np.abs(fpr - np.array(ref["FPR"]))))
    print(f"field pressure: mean difference {dp:.2f} bar")
    ok &= dp < 2.0
    return ok


# --------------------------------------------------------------------------------------------
# the topside layers
# --------------------------------------------------------------------------------------------

def grid_footprint(data_dir: Path):
    """min/max x and y of every drawn cell corner, in metres relative to the model centre."""
    raw = array.array("f")
    with (data_dir / "geometry.bin").open("rb") as fh:
        raw.frombytes(fh.read())
    if sys.byteorder != "little":                                  # pragma: no cover
        raw.byteswap()
    xs = raw[0::3]
    ys = raw[1::3]
    zs = raw[2::3]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs)), len(raw) // 24


def point_segment_distance(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dx == 0 and dy == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def check_topside(data_dir: Path) -> bool:
    fail, note = [], []
    path = data_dir / "topside.json"
    if not path.exists():
        print(f"topside: {path} is missing -- nothing to check")
        return True
    doc = json.loads(path.read_text(encoding="utf-8"))
    model = json.loads((data_dir / "model.json").read_text())
    size = path.stat().st_size
    print(f"topside.json: {size:,} B")
    if size > TOPSIDE_MAX_BYTES:
        fail.append(f"topside.json is {size:,} B, over the {TOPSIDE_MAX_BYTES:,} B budget")

    # -- the contract the app asserts on load
    if doc.get("schemaVersion") != 1:
        fail.append(f"schemaVersion is {doc.get('schemaVersion')}, not 1")
    if doc.get("kind") != "norne-topside":
        fail.append(f"kind is {doc.get('kind')!r}")
    if "fixture" in doc:
        fail.append("the shipped file carries the fixture flag")
    if doc["frameCount"] != len(model["frames"]):
        fail.append(f"frameCount {doc['frameCount']} != {len(model['frames'])} frames")
    for a, b, axis in zip(doc["modelCentre"], model["center"], "xyz"):
        if abs(a - b) > 0.01:
            fail.append(f"modelCentre {axis} {a} is more than 0.01 m from model.json's {b}")
    for k in ("oil", "gasSold", "water"):
        n = len(doc["production"][k])
        if n != len(model["frames"]):
            fail.append(f"production.{k} has {n} values, not {len(model['frames'])}")

    # -- the FPSO
    fac = {f["id"]: f for f in doc["facilities"]}
    fpso = fac["fpso"]
    if (fpso["x"], fpso["y"]) != FPSO_OFFSET:
        fail.append(f"the FPSO is at {(fpso['x'], fpso['y'])}, not {FPSO_OFFSET}")
    else:
        note.append(f"FPSO at {fpso['x']:+d}, {fpso['y']:+d} m, {fpso['depth']} m of water, "
                    f"{math.hypot(*FPSO_OFFSET):.0f} m from the model centre")

    # -- every template inside the grid footprint
    (x0, x1), (y0, y1), (z0, z1), cells = grid_footprint(data_dir)
    note.append(f"grid footprint {x1 - x0:,.0f} x {y1 - y0:,.0f} m over {cells:,} cells, "
                f"depth {z0 + model['center'][2]:,.1f}-{z1 + model['center'][2]:,.1f} m TVD")
    for f in doc["facilities"]:
        if f["kind"] != "template":
            continue
        if not (x0 <= f["x"] <= x1 and y0 <= f["y"] <= y1):
            fail.append(f"{f['name']} at ({f['x']}, {f['y']}) is outside the grid footprint")

    # -- the templates appear on their own dates
    counts = {}
    for frame in sorted(set(list(TEMPLATE_COUNTS) + [len(model["frames"]) - 1])):
        counts[frame] = sum(1 for f in doc["facilities"]
                            if f["kind"] == "template" and 0 <= f["firstFrame"] <= frame)
    for frame, want in TEMPLATE_COUNTS.items():
        if counts[frame] != want:
            fail.append(f"frame {frame} shows {counts[frame]} templates, not {want}")
    note.append("templates in service per frame: " +
                ", ".join(f"{k}:{v}" for k, v in sorted(counts.items())))
    if fac["tpl-M"]["firstFrame"] != -1:
        fail.append("template M must never appear inside this history")

    # -- the export line switches on with the reported gas
    export = next(l for l in doc["lines"] if l["id"] == "export-16")
    first_gas = next((i for i, v in enumerate(doc["production"]["gasSold"]) if v > 0), -1)
    if export["firstFrame"] != first_gas:
        fail.append(f"the export line appears at frame {export['firstFrame']} but the reported "
                    f"gas starts at frame {first_gas}")
    else:
        note.append(f"the export line and the first reported gas share frame {first_gas} "
                    f"({model['frames'][first_gas]})")

    # -- the well -> template map comes from the deck, and covers every well
    wells = {w["name"] for w in model["wells"]}
    if set(doc["wellTemplates"]) != wells:
        fail.append("wellTemplates does not cover exactly the wells in model.json")
    letters = {f["id"].split("-")[-1] for f in doc["facilities"] if f["kind"] == "template"}
    stray = sorted(set(doc["wellTemplates"].values()) - letters)
    if stray:
        fail.append(f"wellTemplates names templates that do not exist: {stray}")
    if "WELSPECS" not in doc["wellTemplateSource"]:
        note.append(f"well->template map is NOT from the deck: {doc['wellTemplateSource']}")

    # -- everything schematic says so, and nothing claims a surveyed route it does not have
    for f in doc["facilities"] + doc["lines"]:
        for aspect in f.get("schematic", []):
            if aspect not in ("route", "shape", "heading", "depth", "destination"):
                fail.append(f"{f['id']} declares an unknown schematic aspect {aspect!r}")
    if export["schematic"] != ["depth"]:
        fail.append(f"the export line's schematic aspects are {export['schematic']}, not ['depth']")
    for lid in ("fl-B", "fl-C", "fl-D", "fl-E", "fl-F", "fl-K", "riser-fpso", "erb-connector"):
        line = next(l for l in doc["lines"] if l["id"] == lid)
        if "route" not in line["schematic"]:
            fail.append(f"{lid} is drawn from unpublished geometry but is not marked schematic")

    # -- no URL may reach a runtime file
    text = path.read_text(encoding="utf-8")
    for bad in ("http://", "https://"):
        if bad in text:
            fail.append(f"topside.json contains {bad}")

    ok = check_network(data_dir, doc, fail, note)
    for line in note:
        print(f"  {line}")
    for line in fail:
        print(f"  FAIL {line}")
    return ok and not fail


def check_network(data_dir: Path, stage1: dict, fail: list, note: list) -> bool:
    path = data_dir / "topside-network.json"
    if not path.exists():
        note.append("topside-network.json is absent; stage 1 must run without it")
        return True
    doc = json.loads(path.read_text(encoding="utf-8"))
    size = path.stat().st_size
    print(f"topside-network.json: {size:,} B")
    if size > NETWORK_MAX_BYTES:
        fail.append(f"topside-network.json is {size:,} B, over the {NETWORK_MAX_BYTES:,} B budget")
    if doc.get("kind") != "norne-topside-network":
        fail.append(f"network kind is {doc.get('kind')!r}")

    by_id = {p["id"]: p for p in doc["pipelines"]}
    for rid in doc["norneRoute"]:
        if rid not in by_id:
            fail.append(f"norneRoute names {rid}, which the file does not carry")

    # -- the tee sits on the Asgard trunk
    tee = next((n for n in doc["nodes"] if n["name"] == "NORNE/HEIDRUN T"), None)
    trunk = by_id.get(doc["norneRoute"][-1])
    if tee is None or trunk is None:
        fail.append("the tee or the Asgard trunk is missing from the network file")
    else:
        sx = 111320.0 * math.cos(math.radians(tee["lat"]))
        sy = 110540.0
        p = (tee["lon"] * sx, tee["lat"] * sy)
        best = min(
            point_segment_distance(p, (a[0] * sx, a[1] * sy), (b[0] * sx, b[1] * sy))
            for part in trunk["parts"] for a, b in zip(part, part[1:]))
        note.append(f"the tee is {best:.1f} m from the Asgard Transport trunk")
        if best > TEE_MAX_OFFSET_M:
            fail.append(f"the tee is {best:.1f} m from the trunk, over {TEE_MAX_OFFSET_M} m")

    # -- no drawn line joins Norne to a refinery
    refineries = [t for t in doc["terminals"] if t.get("refinery")]
    if not refineries:
        fail.append("no refinery is labelled, so the 'not connected to Norne' note is missing")
    for t in doc["terminals"]:
        if t.get("connectedToNorne"):
            fail.append(f"{t['name']} is marked as connected to Norne")
    route = doc["norneRoutePath"]["points"]
    for t in refineries:
        sx = 111320.0 * math.cos(math.radians(t["lat"]))
        near = min(math.hypot((q[0] - t["lon"]) * sx, (q[1] - t["lat"]) * 110540.0) for q in route)
        if near < 5000:
            fail.append(f"the highlighted Norne route passes {near:,.0f} m from {t['name']}")
    note.append(f"refineries drawn with no line to Norne: "
                f"{', '.join(sorted(t['name'] for t in refineries))}")

    landfall = next((t for t in doc["terminals"] if t["name"] == "KALSTØ"), None)
    if landfall:
        sx = 111320.0 * math.cos(math.radians(landfall["lat"]))
        d = math.hypot((route[-1][0] - landfall["lon"]) * sx,
                       (route[-1][1] - landfall["lat"]) * 110540.0)
        note.append(f"the highlighted route is {doc['norneRoutePath']['lengthKm']} km and ends "
                    f"{d:,.0f} m from the Kalstø landfall")
        if d > 1000:
            fail.append(f"the highlighted route ends {d:,.0f} m from the Kalstø landfall")
    else:
        fail.append("the Kalstø landfall is missing from the terminals")

    if doc["modelCentre"][:2] != stage1["modelCentre"][:2]:
        fail.append("the two topside files disagree about the model centre")

    text = path.read_text(encoding="utf-8")
    for bad in ("http://", "https://"):
        if bad in text:
            fail.append(f"topside-network.json contains {bad}")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--results", default="work/results")
    ap.add_argument("--work", default="work")
    ap.add_argument("--commit", default=PINNED_COMMIT)
    ap.add_argument("--tolerance", type=float, default=1.0, help="max allowed difference in percent")
    ap.add_argument("--data-dir", default=str(Path(__file__).resolve().parent.parent / "data"))
    ap.add_argument("--topside-only", action="store_true",
                    help="check only the topside layers (no opm, no numpy, runs anywhere)")
    ap.add_argument("--skip-topside", action="store_true")
    args = ap.parse_args()

    ok = True
    if not args.topside_only:
        ok &= check_simulation(args)
    if not args.skip_topside:
        ok &= check_topside(Path(args.data_dir).resolve())
    print("PASS" if ok else "FAIL: the data does not meet the checks above")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
