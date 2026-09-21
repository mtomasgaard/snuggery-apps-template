#!/usr/bin/env python3
"""Size the Global Wind demo, and check the one that is committed.

Two jobs, both about the trade-off that shapes this app: a wind field is big,
and every copy of this repository carries the committed demo.

    python3 scripts/make_demo_global_wind.py --sizes
    python3 scripts/make_demo_global_wind.py --verify

--sizes   Pulls ONE GFS run and prints what the snapshot would weigh at every
          combination of grid spacing, step spacing and forecast length. One
          download, the whole table — the numbers in global-wind/NOTES.md come
          from here, and if you are about to turn the dials up in your own copy
          this tells you what it costs before you commit it. About 65 MB of
          download; --hourly adds the hourly rows and about 200 MB. --cache
          keeps the GRIB in a scratch directory so a second run is free.
--verify  Reads the committed global-wind/data/snapshot.json and checks it is
          what the app expects: the schema, the grid, every step unpacking to
          exactly one byte per grid point, the ask table flat and bounded, no
          address of any kind inside the file, and the sha256 recorded beside
          it by `global_wind.py --demo`. Needs no network.

          The fingerprint is the part that keeps working. `global_wind.py
          --check` rebuilds the demo's GFS run from NOAA and compares, which is
          a stronger proof — but the bucket only keeps about ten days of runs,
          so a few weeks after the demo was committed that check can no longer
          say anything. The sha256 still can: it proves the committed file is
          the one --demo wrote, offline, for as long as the repository exists.

The pull itself, and the demo the workflow commits, live in
scripts/global_wind.py; this file only measures and checks. `--sizes` needs
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
# of global_wind — importing that module costs numpy and eccodes, and --verify
# has neither.
ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "global-wind" / "data" / "snapshot.json"


def load_global_wind():
    """Import the puller. Only --sizes needs it, and only --sizes pays for it.

    `import global_wind` pulls in numpy and eccodes. At the top of the file
    that would make --verify — the one command that is supposed to run on a
    bare system Python — fail with ModuleNotFoundError before it read a byte.
    """
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    import global_wind                                          # noqa: PLC0415
    return global_wind

# The matrix --sizes reports. Step spacings must all be multiples of the
# finest one, because one download at the finest spacing serves every row.
DEGREES_CHOICES = [1.0, 1.5, 2.0]
STEP_CHOICES = [3, 6]
DAY_CHOICES = [3, 5]
HOURLY_STEP = 1        # added by --hourly, which costs about 200 MB of download


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


# ------------------------------------------------------------------- --sizes


def download_all(gw, run: dt.datetime, hours: list[int],
                 cache: pathlib.Path | None) -> dict[int, tuple[bytes, bytes]]:
    """Every step's two GRIB messages, from the bucket or from a local cache.

    The cache exists so that measuring a dozen settings costs one download
    rather than a dozen. It is a scratch directory, never committed.
    """
    def one(hour: int) -> tuple[int, tuple[bytes, bytes]]:
        if cache is not None:
            u_path = cache / f"{run:%Y%m%d%H}-f{hour:03d}-u.grib2"
            v_path = cache / f"{run:%Y%m%d%H}-f{hour:03d}-v.grib2"
            if u_path.exists() and v_path.exists():
                return hour, (u_path.read_bytes(), v_path.read_bytes())
            u, v = gw.download(run, hour)
            cache.mkdir(parents=True, exist_ok=True)
            u_path.write_bytes(u)
            v_path.write_bytes(v)
            return hour, (u, v)
        return hour, gw.download(run, hour)

    messages: dict[int, tuple[bytes, bytes]] = {}
    with ThreadPoolExecutor(max_workers=gw.WORKERS) as pool:
        for hour, pair in pool.map(one, hours):
            messages[hour] = pair
            if len(messages) % 10 == 0:
                log(f"  {len(messages)}/{len(hours)} steps")
    return messages


def planes_at(gw, messages: dict[int, tuple[bytes, bytes]], hours: list[int],
              run: dt.datetime, degrees: float) -> list[tuple]:
    """Quantised (speed, direction) byte planes for every step, at one spacing."""
    gw.DEGREES = degrees
    gw.SUB = round(degrees / gw.SOURCE_DEGREES)
    planes = []
    for hour in hours:
        u_message, v_message = messages[hour]
        u = gw.decode(u_message, "10u", run, hour)
        v = gw.decode(v_message, "10v", run, hour)
        s, d, _ = gw.quantize(u, v)
        planes.append((s, d))
    return planes


def snapshot_bytes(gw, planes: list[tuple], hours: list[int], stride: int,
                   days: int, base_step: int) -> int:
    """Exactly how many bytes the snapshot's steps[] would take, packed.

    The per-step overhead of the JSON and the fixed header are added as a flat
    allowance so the table compares like with like; the real file is within a
    few kilobytes of this, which the --demo run then prints for real.
    """
    if stride % base_step:
        raise SystemExit(f"{stride} h steps cannot be made from a {base_step} h download")
    indices = [n for n, h in enumerate(hours) if h <= days * 24 and h % stride == 0]
    total = 0
    previous = None
    for n in indices:
        s, d = planes[n]
        if previous is None:
            packed_s, packed_d = s, d
        else:
            packed_s, packed_d = s - previous[0], d - previous[1]
        previous = (s, d)
        total += len(gw.pack(packed_s)) + len(gw.pack(packed_d))
        total += 70                                   # the step object's own JSON
    return total + 12_000                             # header, encoding, ask table


def sizes(run_iso: str, cache: pathlib.Path | None, hourly: bool) -> int:
    gw = load_global_wind()
    steps = ([HOURLY_STEP] if hourly else []) + STEP_CHOICES
    finest = min(steps)
    longest = max(DAY_CHOICES)
    hours = list(range(0, longest * 24 + 1, finest))

    if run_iso:
        run = dt.datetime.strptime(run_iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    else:
        gw.HOURS = hours
        run = gw.newest_complete_run(dt.datetime.now(dt.timezone.utc))
    log(f"GFS run {gw.iso(run)}, {len(hours)} steps every {finest} h to +{hours[-1]} h")

    messages = download_all(gw, run, hours, cache)
    raw = sum(len(u) + len(v) for u, v in messages.values())
    log(f"  {raw / 1e6:.0f} MB of GRIB")

    print(f"Snapshot size, GFS run {gw.iso(run)}")
    print(f"{'grid':>6}  {'points':>7}  " + "  ".join(
        f"{d}d/{s}h".rjust(9) for s in steps for d in DAY_CHOICES))
    for degrees in DEGREES_CHOICES:
        planes = planes_at(gw, messages, hours, run, degrees)
        points = planes[0][0].size
        cells = []
        for step in steps:
            for days in DAY_CHOICES:
                size = snapshot_bytes(gw, planes, hours, step, days, finest)
                cells.append(f"{size / 1e6:7.2f} MB")
        print(f"{degrees:>5}°  {points:>7}  " + "  ".join(cells))
    print()
    print("Columns are <forecast days>/<hours between steps>. The dials are "
          "DEGREES, STEP_HOURS\nand FORECAST_DAYS at the top of "
          "scripts/global_wind.py.")
    return 0


# ------------------------------------------------------------------ --verify

ADDRESS = re.compile(r"https?://", re.IGNORECASE)


def verify(path: pathlib.Path) -> int:
    problems: list[str] = []
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

    if snapshot.get("schema") != 1:
        problems.append(f"schema is {snapshot.get('schema')!r}, wanted 1")
    try:
        dt.datetime.strptime(snapshot["generatedAt"], "%Y-%m-%dT%H:%M:%SZ")
    except (KeyError, TypeError, ValueError):
        problems.append("generatedAt is missing or is not ISO 8601 UTC")

    grid = snapshot.get("grid") or {}
    points = grid.get("nx", 0) * grid.get("ny", 0)
    if points < 4:
        problems.append(f"the grid is {grid!r}")

    steps = snapshot.get("steps")
    if not isinstance(steps, list) or not steps:
        problems.append("there are no forecast steps")
        steps = []
    previous_time = ""
    for n, step in enumerate(steps):
        for key in ("hours", "validTime", "speed", "dir"):
            if key not in step:
                problems.append(f"step {n} has no {key}")
        if step.get("validTime", "") <= previous_time:
            problems.append(f"step {n} is not after the one before it")
        previous_time = step.get("validTime", "")
        for key in ("speed", "dir"):
            try:
                plane = zlib.decompress(base64.b64decode(step[key]))
            except Exception as error:                       # noqa: BLE001
                problems.append(f"step {n} {key} does not unpack: {error}")
                continue
            if len(plane) != points:
                problems.append(f"step {n} {key} unpacks to {len(plane)} bytes, "
                                f"the grid has {points} points")

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
    # global_wind.py --check can no longer rebuild it.
    fingerprint = path.with_suffix(".sha256")
    if not fingerprint.exists():
        problems.append(f"{fingerprint.name} is missing — run "
                        f"scripts/global_wind.py --demo to write it")
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
        f"{grid.get('nx')}x{grid.get('ny')} points, {len(ask)} ask rows, "
        f"run {snapshot.get('run')}")
    log("looks like a Global Wind snapshot" if not problems
        else f"{len(problems)} problem(s) above")
    return 1 if problems else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sizes", action="store_true", help="measure the trade-off")
    parser.add_argument("--verify", action="store_true", help="check the committed demo")
    parser.add_argument("--run", default="", help="--sizes: measure this run, not the newest")
    parser.add_argument("--cache", type=pathlib.Path, default=None,
                        help="--sizes: scratch directory for the downloaded GRIB")
    parser.add_argument("--hourly", action="store_true",
                        help="--sizes: include the hourly rows (about 200 MB of download)")
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
