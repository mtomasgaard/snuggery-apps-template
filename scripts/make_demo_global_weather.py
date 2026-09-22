#!/usr/bin/env python3
"""Size the Global Weather demo, and check the one that is committed.

Two jobs, both about the trade-off that shapes this app: five global fields are
a lot of numbers, and every copy of this repository carries the committed demo.

    python3 scripts/make_demo_global_weather.py --sizes
    python3 scripts/make_demo_global_weather.py --verify

--sizes   Pulls ONE GFS run and prints what the snapshot would weigh at every
          combination of grid spacing, step spacing and forecast length, and
          what each LAYER of it costs. One download, the whole table — the
          numbers in global-weather/NOTES.md come from here, and if you are
          about to turn the dials up in your own copy this tells you what it
          costs before you commit it. About 200 MB of download; --hourly adds
          the hourly rows and about 600 MB. --cache keeps the GRIB in a scratch
          directory so a second run is free.
--verify  Reads the committed global-weather/data/snapshot.json and checks it
          is what the app expects: the schema, the grid, every layer's scale,
          every plane of every step unpacking to exactly one byte per grid
          point, the ask table flat and bounded, no address of any kind inside
          the file, and the sha256 recorded beside it by
          `global_weather.py --demo`. Needs no network.

          The fingerprint is the part that keeps working. `global_weather.py
          --check` rebuilds the demo's GFS run from NOAA and compares, which is
          a stronger proof — but the bucket only keeps about ten days of runs,
          so a few weeks after the demo was committed that check can no longer
          say anything. The sha256 still can: it proves the committed file is
          the one --demo wrote, offline, for as long as the repository exists.

The pull itself, and the demo the workflow commits, live in
scripts/global_weather.py; this file only measures and checks. `--sizes` needs
`numpy` and `eccodes`, and imports that module for them; `--verify` is standard
library only and must stay that way — it is what somebody with a fresh clone
and a system Python can run, which is the whole point of having it.
"""

# `X | None` in a signature is Python 3.10 syntax, and it is evaluated when the
# function is defined — which would make this whole file refuse to load on the
# 3.9 that ships with macOS. --verify is the command somebody runs on a fresh
# clone with whatever python3 they have, so the annotations are kept as text.
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import pathlib
import re
import sys
import zlib
from concurrent.futures import ThreadPoolExecutor

# Where the committed demo lives, worked out from this file rather than asked
# of global_weather — importing that module costs numpy and eccodes, and
# --verify has neither.
ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "global-weather" / "data" / "snapshot.json"


def load_global_weather():
    """Import the puller. Only --sizes needs it, and only --sizes pays for it.

    `import global_weather` pulls in numpy and eccodes. At the top of the file
    that would make --verify — the one command that is supposed to run on a
    bare system Python — fail with ModuleNotFoundError before it read a byte.
    """
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    import global_weather                                      # noqa: PLC0415
    return global_weather

# The matrix --sizes reports. Step spacings must all be multiples of the
# finest one, because one download at the finest spacing serves every row.
DEGREES_CHOICES = [1.0, 1.5, 2.0]
STEP_CHOICES = [3, 6]
DAY_CHOICES = [3, 5]
HOURLY_STEP = 1        # added by --hourly, which costs about 600 MB of download


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


# ------------------------------------------------------------------- --sizes


def collect(gw, run, hours, cache, degrees_choices):
    """Every step, quantised at every grid spacing the table reports.

    A step is downloaded, decoded ONCE at the source resolution, and then
    thinned to each output grid — decoding is the slow half, and three tables'
    worth of rows out of one decode is the difference between a minute and
    five. Only the byte planes are kept, which is about 80 MB for the whole
    hourly five-day matrix; keeping the GRIB instead would be half a gigabyte.

    Downloads run ahead of the decoding by a couple of workers' worth and no
    further, so the queue cannot quietly buffer the whole run into memory.
    """
    def one(hour):
        if cache is None:
            return gw.download(run, hour)
        got = {}
        missing = False
        names = [short for layer in gw.LAYERS for _, _, short in layer["grib"]]
        for short in names:
            path = cache / f"{run:%Y%m%d%H}-f{hour:03d}-{short}.grib2"
            if path.exists():
                got[short] = path.read_bytes()
            else:
                missing = True
        if not missing:
            return got
        got = gw.download(run, hour)
        cache.mkdir(parents=True, exist_ok=True)
        for short, body in got.items():
            (cache / f"{run:%Y%m%d%H}-f{hour:03d}-{short}.grib2").write_bytes(body)
        return got

    planes = {degrees: [] for degrees in degrees_choices}
    raw_bytes = 0
    with ThreadPoolExecutor(max_workers=gw.WORKERS) as pool:
        pending = {}
        submitted = 0
        for n, hour in enumerate(hours):
            while submitted < len(hours) and submitted < n + 2 * gw.WORKERS:
                pending[hours[submitted]] = pool.submit(one, hours[submitted])
                submitted += 1
            messages = pending.pop(hour).result()
            raw_bytes += sum(len(m) for m in messages.values())
            gw.DEGREES, gw.SUB = 0.25, 1
            full = {short: gw.decode(messages[short], short, run, hour)
                    for layer in gw.LAYERS for _, _, short in layer["grib"]}
            messages = None
            for degrees in degrees_choices:
                sub = round(degrees / gw.SOURCE_DEGREES)
                fields = {short: values[::sub, ::sub] for short, values in full.items()}
                step = {}
                for layer in gw.LAYERS:
                    for name, values in layer["make"](fields).items():
                        step[f"{layer['key']}.{name}"] = gw.quantize(values, layer["planes"][name])
                planes[degrees].append(step)
            if (n + 1) % 10 == 0:
                log(f"  {n + 1}/{len(hours)} steps")
    return planes, raw_bytes


def snapshot_bytes(gw, planes, hours, stride, days, base_step, only=None):
    """Exactly how many bytes the snapshot's steps[] would take, packed.

    The per-step overhead of the JSON and the fixed header are added as a flat
    allowance so the table compares like with like; the real file is within a
    few kilobytes of this, which the --demo run then prints for real. `only`
    limits it to one layer, which is how the per-layer table is made.
    """
    if stride % base_step:
        raise SystemExit(f"{stride} h steps cannot be made from a {base_step} h download")
    indices = [n for n, h in enumerate(hours) if h <= days * 24 and h % stride == 0]
    keys = [k for k in planes[0] if only is None or k.split(".")[0] == only]
    total = 0
    previous = {}
    for n in indices:
        for key in keys:
            plane = planes[n][key]
            total += len(gw.pack(plane if key not in previous else plane - previous[key]))
            total += 20                               # the plane's own key and quotes
            previous[key] = plane
        total += 50                                   # the step object's own JSON
    return total + (12_000 if only is None else 0)    # header, layers, ask table


def sizes(run_iso, cache, hourly):
    gw = load_global_weather()
    steps = ([HOURLY_STEP] if hourly else []) + STEP_CHOICES
    finest = min(steps)
    longest = max(DAY_CHOICES)
    hours = list(range(0, longest * 24 + 1, finest))

    if run_iso:
        run = dt.datetime.strptime(run_iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    else:
        gw.HOURS = hours
        run = gw.newest_complete_run(dt.datetime.now(dt.timezone.utc))
    log(f"GFS run {gw.iso(run)}, {len(hours)} steps every {finest} h to +{hours[-1]} h, "
        f"{len(gw.LAYERS)} layers")

    planes, raw = collect(gw, run, hours, cache, DEGREES_CHOICES)
    log(f"  {raw / 1e6:.0f} MB of GRIB")

    print(f"Snapshot size, GFS run {gw.iso(run)}, "
          f"{len(gw.LAYERS)} layers ({', '.join(l['key'] for l in gw.LAYERS)})")
    print(f"{'grid':>6}  {'points':>7}  " + "  ".join(
        f"{d}d/{s}h".rjust(9) for s in steps for d in DAY_CHOICES))
    for degrees in DEGREES_CHOICES:
        rows = planes[degrees]
        points = rows[0][next(iter(rows[0]))].size
        cells = []
        for step in steps:
            for days in DAY_CHOICES:
                size = snapshot_bytes(gw, rows, hours, step, days, finest)
                cells.append(f"{size / 1e6:7.2f} MB")
        print(f"{degrees:>5}°  {points:>7}  " + "  ".join(cells))
    print()
    print("Columns are <forecast days>/<hours between steps>. The dials are "
          "DEGREES, STEP_HOURS,\nFORECAST_DAYS and the LAYERS list at the top "
          "of scripts/global_weather.py.")

    # What each layer costs at the shipped settings, which is the number to look
    # at before deleting one — or adding a sixth.
    shipped = planes[gw.DEGREES] if gw.DEGREES in planes else planes[DEGREES_CHOICES[-1]]
    degrees = gw.DEGREES if gw.DEGREES in planes else DEGREES_CHOICES[-1]
    print()
    print(f"Per layer at {degrees:g}°, {gw.FORECAST_DAYS} days, every {gw.STEP_HOURS} h")
    for layer in gw.LAYERS:
        size = snapshot_bytes(gw, shipped, hours, gw.STEP_HOURS, gw.FORECAST_DAYS,
                              finest, only=layer["key"])
        print(f"  {layer['label']:<14} {size / 1e6:6.2f} MB  "
              f"({len(layer['planes'])} plane{'s' if len(layer['planes']) > 1 else ''}, "
              f"{'/'.join(v for v, _, _ in layer['grib'])})")
    return 0


# ------------------------------------------------------------------ --verify

ADDRESS = re.compile(r"https?://", re.IGNORECASE)


def verify(path):
    problems = []
    if not path.exists():
        log(f"{path} does not exist")
        return 1
    text = path.read_text(encoding="utf-8")
    size = len(text.encode("utf-8"))
    try:
        snapshot = json.loads(text)
    except json.JSONDecodeError as error:
        log(f"{path} is not valid JSON: {error}")
        return 1

    if snapshot.get("schema") != 2:
        problems.append(f"schema is {snapshot.get('schema')!r}, wanted 2")
    try:
        dt.datetime.strptime(snapshot["generatedAt"], "%Y-%m-%dT%H:%M:%SZ")
    except (KeyError, TypeError, ValueError):
        problems.append("generatedAt is missing or is not ISO 8601 UTC")

    grid = snapshot.get("grid") or {}
    points = grid.get("nx", 0) * grid.get("ny", 0)
    if points < 4:
        problems.append(f"the grid is {grid!r}")

    # Every plane the layers declare has to be in every step, and its scale has
    # to be one the app can read a value back through.
    layers = snapshot.get("layers")
    plane_keys = []
    if not isinstance(layers, list) or not layers:
        problems.append("there are no layers")
        layers = []
    for layer in layers:
        if not isinstance(layer, dict) or not isinstance(layer.get("key"), str):
            problems.append(f"a layer is not usable: {layer!r}")
            continue
        planes = layer.get("planes")
        if not isinstance(planes, dict) or not planes:
            problems.append(f"layer {layer['key']!r} declares no planes")
            continue
        for name, spec in planes.items():
            plane_keys.append(f"{layer['key']}.{name}")
            if not isinstance(spec, dict) or not isinstance(spec.get("step"), (int, float)) \
                    or not spec.get("step") or not isinstance(spec.get("offset"), (int, float)):
                problems.append(f"plane {layer['key']}.{name} has no usable scale")
        if layer.get("kind") == "vector" and not {"speed", "dir"} <= set(planes):
            problems.append(f"layer {layer['key']!r} is a vector without speed and dir")

    steps = snapshot.get("steps")
    if not isinstance(steps, list) or not steps:
        problems.append("there are no forecast steps")
        steps = []
    previous_time = ""
    for n, step in enumerate(steps):
        for key in ("hours", "validTime", "planes"):
            if key not in step:
                problems.append(f"step {n} has no {key}")
        if step.get("validTime", "") <= previous_time:
            problems.append(f"step {n} is not after the one before it")
        previous_time = step.get("validTime", "")
        packed = step.get("planes") or {}
        for key in plane_keys:
            if key not in packed:
                problems.append(f"step {n} has no {key}")
                continue
            try:
                plane = zlib.decompress(base64.b64decode(packed[key]))
            except Exception as error:                       # noqa: BLE001
                problems.append(f"step {n} {key} does not unpack: {error}")
                continue
            if len(plane) != points:
                problems.append(f"step {n} {key} unpacks to {len(plane)} bytes, "
                                f"the grid has {points} points")
        extra = sorted(set(packed) - set(plane_keys))
        if extra:
            problems.append(f"step {n} holds planes no layer declares: {', '.join(extra)}")

    ask = snapshot.get("ask")
    if not isinstance(ask, list) or not ask:
        problems.append("there is no ask table")
        ask = []
    if len(ask) > 200:
        problems.append(f"the ask table has {len(ask)} rows; keep it under a couple of hundred")
    for n, row in enumerate(ask):
        if not isinstance(row, dict):
            problems.append(f"ask row {n} is not an object")
            continue
        for key, value in row.items():
            if not isinstance(value, (int, float, str)) or isinstance(value, bool):
                problems.append(f"ask row {n} key {key!r} is not a number or a short string")
            if isinstance(value, str) and len(value) > 60:
                problems.append(f"ask row {n} key {key!r} is {len(value)} characters long")

    # The fingerprint --demo left beside the snapshot. This is the only check
    # here that still works once the GFS run has aged out of the bucket and
    # global_weather.py --check can no longer rebuild it.
    fingerprint = path.with_suffix(".sha256")
    if not fingerprint.exists():
        problems.append(f"{fingerprint.name} is missing — run "
                        f"scripts/global_weather.py --demo to write it")
    else:
        recorded = fingerprint.read_text(encoding="utf-8").split()
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if not recorded:
            problems.append(f"{fingerprint.name} is empty")
        elif recorded[0] != actual:
            problems.append(f"{fingerprint.name} says {recorded[0]}, the file is {actual} — "
                            "the snapshot has been edited since --demo wrote it")

    if ADDRESS.search(text):
        found = sorted({m.group(0) for m in ADDRESS.finditer(text)})
        problems.append(f"the snapshot holds a web address ({', '.join(found)}) — "
                        "the app must not be told to fetch anything")

    for problem in problems:
        log(f"  {problem}")
    log(f"{path.name}: {size / 1e6:.2f} MB, {len(steps)} steps, "
        f"{grid.get('nx')}x{grid.get('ny')} points, {len(layers)} layers "
        f"({', '.join(str(l.get('key')) for l in layers)}), {len(ask)} ask rows, "
        f"run {snapshot.get('run')}")
    log("looks like a Global Weather snapshot" if not problems
        else f"{len(problems)} problem(s) above")
    return 1 if problems else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sizes", action="store_true", help="measure the trade-off")
    parser.add_argument("--verify", action="store_true", help="check the committed demo")
    parser.add_argument("--run", default="", help="--sizes: measure this run, not the newest")
    parser.add_argument("--cache", type=pathlib.Path, default=None,
                        help="--sizes: scratch directory for the downloaded GRIB")
    parser.add_argument("--hourly", action="store_true",
                        help="--sizes: include the hourly rows (about 600 MB of download)")
    parser.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    if args.sizes:
        return sizes(args.run, args.cache, args.hourly)
    if args.verify:
        return verify(args.out)
    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
