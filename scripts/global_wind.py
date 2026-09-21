#!/usr/bin/env python3
"""Write global-wind/data/snapshot.json — days of global 10 m wind, from GFS.

Source: NOAA's Global Forecast System, read straight from the public AWS Open
Data bucket `noaa-gfs-bdp-pds`. No account, no key, no token, no registration.
GFS output is a work of the United States Government and is in the public
domain; global-wind/NOTES.md states the terms and what the app must print.

Only the 0.25-degree GFS product has hourly output, so this reads those files
and keeps every SUB-th row and column to make the coarser grid the app draws.
Each forecast file is about half a gigabyte, but its `.idx` sidecar lists the
byte offset of every field inside it, so the job asks for just the two 10 m
wind messages per step with HTTP range requests: about 1.6 MB a step instead
of 500, fetched WORKERS at a time.

    python3 scripts/global_wind.py                  # the newest complete run
    python3 scripts/global_wind.py --demo           # the same, for the committed demo
    python3 scripts/global_wind.py --check          # is the committed demo still reproducible?
    python3 scripts/global_wind.py --skip-run 2026-09-21T06:00:00Z

--out        where to write (default global-wind/data/snapshot.json)
--skip-run   if the newest complete run is this one, write nothing and exit 0.
             The workflow passes the run already committed, so a second slot on
             the same model cycle costs one HEAD request instead of a rebuild.
--run        build a named run instead of the newest (ISO 8601 UTC, 00/06/12/18)
--demo       write the committed demo snapshot: a real pull, from whichever run
             is newest, with the run it used printed and stored in the file,
             plus data/snapshot.sha256 beside it as a fingerprint
--check      rebuild the run the committed demo names and compare (see below).
             0 matched, 1 differs or is missing, 2 the run has aged out of the
             bucket and nothing could be decided
--quiet      only errors on stderr

THE SIZE DIAL, which is the whole design of this file
-----------------------------------------------------
Three constants below decide everything: DEGREES (how coarse the grid is),
STEP_HOURS (how far apart the forecast steps are) and FORECAST_DAYS (how far
ahead). They trade file size against detail, and global-wind/NOTES.md has the
measured table. The demo committed to this repository is deliberately small
because every copy of the repository carries it; your own private copy can turn
all three up and get the field at full resolution.

IS THE OUTPUT DETERMINISTIC?
----------------------------
Yes, apart from `generatedAt`: for one GFS run the bucket serves fixed bytes,
the quantisation is integer rounding, and deflate at a fixed level is stable
for a given zlib. `--check` therefore rebuilds the run the committed file names
and compares everything except `generatedAt`; it reports separately whether the
compressed bytes also matched, because a different zlib build can pack the same
numbers differently without changing a single wind value. The bucket keeps
roughly ten days of runs, so a check run long after the demo was committed says
the run has aged out rather than claiming a mismatch — and exits **2**, not 0,
because "I could not tell" is not "it matched" and a script must be able to see
the difference.

What survives that is `data/snapshot.sha256`, written beside the snapshot by
`--demo`. It cannot prove the bytes came from NOAA, but it proves
the committed file is still the one this script wrote, which is the question
anybody reading the repository next year actually has.
`scripts/make_demo_global_wind.py --verify` compares it, offline, with no
numpy and no network.

WHAT HAPPENS WHEN THE PULL FAILS
--------------------------------
Nothing is written. There is no `lastGood` copy inside the snapshot the way the
smaller apps here keep one, because this file is megabytes and a spare copy
would double it for no gain: the committed snapshot IS the last good answer,
the workflow commits only on a successful build, and the app stamps whatever it
finds with its age. An outage leaves yesterday's forecast on screen with a
stale header, which is the behaviour the convention asks for.

The snapshot's shape is documented at the top of global-wind/app.js. Keep the
two in step.

Needs `numpy` and `eccodes` (`pip install eccodes numpy` — the eccodes wheel
carries the GRIB library, so there is nothing to apt-get).
"""

import argparse
import base64
import datetime as dt
import hashlib
import json
import math
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import eccodes as ec

try:                                        # Python 3.9+, needs the system tzdata
    from zoneinfo import ZoneInfo
except ImportError:                         # pragma: no cover - very old Python
    ZoneInfo = None


# --------------------------------------------------------------- the dials

DEGREES = 2.0          # output grid spacing. Must divide 0.25 evenly: 0.25, 0.5,
                       # 1.0, 1.5 or 2.0. Smaller is sharper and much bigger.
STEP_HOURS = 3         # hours between forecast steps. 1 is the finest GFS gives
                       # inside five days; 3 and 6 are the usual economies.
FORECAST_DAYS = 5      # how far ahead. GFS is hourly to +120 h (five days) and
                       # 3-hourly from there to +384 h, so days above 5 need
                       # STEP_HOURS of at least 3.

# Everything below follows from those three.
SOURCE_DEGREES = 0.25
SUB = round(DEGREES / SOURCE_DEGREES)
HOURS = list(range(0, FORECAST_DAYS * 24 + 1, STEP_HOURS))

BUCKET = "https://noaa-gfs-bdp-pds.s3.amazonaws.com"
PRODUCT = "pgrb2.0p25"                              # the only GFS grid with hourly steps
LEVEL = "10 m above ground"
SPEED_STEP = 0.25                                   # m/s per byte: 0 … 63.75 m/s
DIR_STEP = 360.0 / 256                              # degrees per byte
WORKERS = 6                                         # parallel range requests
TIMEOUT = 120
RETRIES = 4

# Identify the job. GitHub sets GITHUB_REPOSITORY in Actions; running it by hand
# falls back to the template's own name. Put your repository here if you would
# rather it were always named.
_repo = os.environ.get("GITHUB_REPOSITORY", "snuggery-apps-template")
USER_AGENT = f"global-wind snapshot job (+https://github.com/{_repo})"

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "global-wind"
DEFAULT_OUT = APP / "data" / "snapshot.json"

# nx, ny, lon0, lat0, dlon, dlat of the files in the bucket, checked on every
# message: if NOAA ever changes the product under us the job stops instead of
# quietly writing a shifted world.
SOURCE_GRID = (1440, 721, 0.0, 90.0, 0.25, -0.25)

QUIET = False


# ------------------------------------------------------------- the ask table
#
# Twelve well-known cities, one row per city per forecast day, wind at 12:00
# LOCAL time. Snuggery's "Ask About This Data" reads the snapshot's top-level
# `ask` array and nothing else, so these rows are the whole vocabulary a
# question in words has to work with: "where is it windiest on Thursday",
# "which way is the wind blowing in Tokyo". Sixty rows at most.
#
# The list is spread across six continents and both hemispheres on purpose, so
# the table says something about the world rather than about one corner of it.
# Nobody's home town is in it, and nothing here is anybody's — a city's wind is
# public weather. Edit the list freely; it is the app's only opinion.
#
# Each row: (name, country, longitude, latitude, IANA time zone, fallback
# offset in hours). The fallback is used only if the machine has no tz
# database; it is the zone's STANDARD offset, so a summer row could be an hour
# out in that case, and the snapshot says which of the two was used.
CITIES = [
    ("Auckland",       "New Zealand",    174.77, -36.85, "Pacific/Auckland",             12.0),
    ("Buenos Aires",   "Argentina",      -58.38, -34.60, "America/Argentina/Buenos_Aires", -3.0),
    ("Cairo",          "Egypt",           31.24,  30.04, "Africa/Cairo",                  2.0),
    ("Cape Town",      "South Africa",    18.42, -33.93, "Africa/Johannesburg",           2.0),
    ("Chicago",        "United States",  -87.62,  41.88, "America/Chicago",              -6.0),
    ("Delhi",          "India",           77.21,  28.61, "Asia/Kolkata",                  5.5),
    ("London",         "United Kingdom",  -0.13,  51.51, "Europe/London",                 0.0),
    ("Reykjavík",      "Iceland",        -21.94,  64.15, "Atlantic/Reykjavik",            0.0),
    ("Rio de Janeiro", "Brazil",         -43.20, -22.91, "America/Sao_Paulo",            -3.0),
    ("Singapore",      "Singapore",      103.82,   1.35, "Asia/Singapore",                8.0),
    ("Sydney",         "Australia",      151.21, -33.87, "Australia/Sydney",             10.0),
    ("Tokyo",          "Japan",          139.69,  35.69, "Asia/Tokyo",                    9.0),
]

# Beaufort: the upper bound of each force, in m/s, and its name.
BEAUFORT = [
    (0.3, "Calm"), (1.6, "Light air"), (3.4, "Light breeze"), (5.5, "Gentle breeze"),
    (8.0, "Moderate breeze"), (10.8, "Fresh breeze"), (13.9, "Strong breeze"),
    (17.2, "Near gale"), (20.8, "Gale"), (24.5, "Strong gale"), (28.5, "Storm"),
    (32.7, "Violent storm"),
]
COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
           "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


# --------------------------------------------------------------- small stuff


def log(message: str) -> None:
    if not QUIET:
        print(message, file=sys.stderr, flush=True)


def out_grid() -> dict:
    """The grid the app is handed, derived from DEGREES."""
    if 1440 % SUB or 720 % SUB:
        raise SystemExit(f"DEGREES = {DEGREES} does not divide the 0.25° grid evenly")
    return {"nx": 1440 // SUB, "ny": 720 // SUB + 1,
            "lon0": 0.0, "lat0": 90.0, "dlon": DEGREES, "dlat": -DEGREES}


def http(url: str, method: str = "GET", headers: dict | None = None) -> tuple[int, bytes]:
    """GET or HEAD with retries. 403 and 404 come back as a status, not an exception."""
    last: Exception | None = None
    for attempt in range(RETRIES):
        request = urllib.request.Request(
            url, method=method, headers={"User-Agent": USER_AGENT, **(headers or {})})
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                return response.status, (b"" if method == "HEAD" else response.read())
        except urllib.error.HTTPError as error:
            if error.code in (403, 404):
                return error.code, b""
            last = error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last = error
        wait = 2 ** attempt
        log(f"  {method} {url.rsplit('/', 1)[-1]}: {last}; retry in {wait}s")
        time.sleep(wait)
    raise RuntimeError(f"{method} {url} failed after {RETRIES} tries: {last}")


def file_url(run: dt.datetime, hour: int) -> str:
    return (f"{BUCKET}/gfs.{run:%Y%m%d}/{run:%H}/atmos/"
            f"gfs.t{run:%H}z.{PRODUCT}.f{hour:03d}")


def iso(moment: dt.datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


# ------------------------------------------------------------------ fetching


def candidate_runs(now: dt.datetime) -> list[dt.datetime]:
    """Newest first: the 6-hourly GFS cycles of the last two days."""
    base = now.replace(minute=0, second=0, microsecond=0)
    base = base.replace(hour=(base.hour // 6) * 6)
    return [base - dt.timedelta(hours=6 * k) for k in range(0, 9)]


def newest_complete_run(now: dt.datetime) -> dt.datetime:
    """The most recent run whose LAST step we need has already landed in the bucket.

    A run appears file by file over about four hours, so "the newest run" and
    "a run we can use" are different questions. One HEAD request on the last
    step's index answers the second one.
    """
    for run in candidate_runs(now):
        status, _ = http(file_url(run, HOURS[-1]) + ".idx", method="HEAD")
        if status == 200:
            return run
        log(f"  run {run:%Y-%m-%d %HZ}: +{HOURS[-1]} h not there yet ({status})")
    raise RuntimeError("no complete GFS run found in the last two days")


def wind_ranges(idx_text: str) -> dict[str, tuple[int, int | None]]:
    """Byte ranges of the 10 m UGRD and VGRD messages, from a .idx sidecar.

    A sidecar line is `n:offset:date:VAR:level:forecast:`. A message runs from
    its own offset to the byte before the next one, which is how a range
    request can ask for two fields out of half a gigabyte.
    """
    rows = []
    for line in idx_text.splitlines():
        parts = line.split(":")
        if len(parts) < 6:
            continue
        rows.append((int(parts[1]), parts[3], parts[4]))
    found: dict[str, tuple[int, int | None]] = {}
    for n, (offset, variable, level) in enumerate(rows):
        if level == LEVEL and variable in ("UGRD", "VGRD"):
            end = rows[n + 1][0] - 1 if n + 1 < len(rows) else None
            found[variable] = (offset, end)
    if set(found) != {"UGRD", "VGRD"}:
        raise RuntimeError(f"10 m wind is not in the index (found {sorted(found)})")
    return found


def fetch_field(url: str, byte_range: tuple[int, int | None]) -> bytes:
    start, end = byte_range
    rng = f"bytes={start}-{end}" if end is not None else f"bytes={start}-"
    status, body = http(url, headers={"Range": rng})
    if status not in (200, 206) or not body:
        raise RuntimeError(f"range GET {url} -> {status}")
    return body


def download(run: dt.datetime, hour: int) -> tuple[bytes, bytes]:
    """The two raw GRIB messages of one step. Pure I/O, safe to run in threads."""
    url = file_url(run, hour)
    status, index = http(url + ".idx")
    if status != 200:
        raise FileNotFoundError(f"{url}.idx -> {status}")
    ranges = wind_ranges(index.decode("utf-8", "replace"))
    return fetch_field(url, ranges["UGRD"]), fetch_field(url, ranges["VGRD"])


# ------------------------------------------------------------------ decoding


def decode(message: bytes, expect_short: str, run: dt.datetime, hour: int) -> np.ndarray:
    """One 0.25° GRIB2 message -> values on the output grid, north row first.

    Every assumption the app depends on is checked here rather than trusted:
    which field this is, which run and step it belongs to, the scanning order,
    and the grid itself. A surprise stops the job; it never reaches the app.
    """
    gid = ec.codes_new_from_message(message)
    try:
        short = ec.codes_get(gid, "shortName")
        if short != expect_short:
            raise RuntimeError(f"expected {expect_short}, the message is {short}")
        data_date = ec.codes_get(gid, "dataDate")
        data_time = ec.codes_get(gid, "dataTime")
        step = int(ec.codes_get(gid, "endStep"))
        if f"{data_date:08d}{data_time:04d}" != f"{run:%Y%m%d%H%M}" or step != hour:
            raise RuntimeError(f"the message is run {data_date} {data_time:04d} step {step}, "
                               f"wanted {run:%Y%m%d %H%M} step {hour}")
        grid = (int(ec.codes_get(gid, "Ni")), int(ec.codes_get(gid, "Nj")),
                float(ec.codes_get(gid, "longitudeOfFirstGridPointInDegrees")),
                float(ec.codes_get(gid, "latitudeOfFirstGridPointInDegrees")),
                float(ec.codes_get(gid, "iDirectionIncrementInDegrees")),
                -float(ec.codes_get(gid, "jDirectionIncrementInDegrees")))
        if ec.codes_get(gid, "jScansPositively") != 0 or ec.codes_get(gid, "iScansNegatively") != 0:
            raise RuntimeError("unexpected scanning mode")
        if grid != SOURCE_GRID:
            raise RuntimeError(f"unexpected grid {grid}, wanted {SOURCE_GRID}")
        values = np.asarray(ec.codes_get_values(gid), dtype=np.float64)
        if values.size != grid[0] * grid[1]:
            raise RuntimeError(f"{values.size} values for a {grid[0]}x{grid[1]} grid")
        wanted = out_grid()
        values = values.reshape(grid[1], grid[0])[::SUB, ::SUB]
        if values.shape != (wanted["ny"], wanted["nx"]):
            raise RuntimeError(f"subsampled to {values.shape}, wanted "
                               f"({wanted['ny']}, {wanted['nx']})")
        return values
    finally:
        ec.codes_release(gid)


def quantize(u: np.ndarray, v: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    """m/s components -> (speed byte plane, direction byte plane, the step's fastest wind).

    Meteorological convention: direction is the one the wind blows FROM,
    clockwise from north, so a pure westerly (u > 0, v = 0) is 270.
    """
    speed = np.hypot(u, v)
    direction = np.degrees(np.arctan2(-u, -v)) % 360.0
    s = np.clip(np.rint(speed / SPEED_STEP), 0, 255).astype(np.uint8)
    d = (np.rint(direction / DIR_STEP).astype(np.int64) % 256).astype(np.uint8)
    return s, d, float(speed.max())


def dequantize(s: np.ndarray, d: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The byte planes back to u/v in m/s — exactly what the app reconstructs.

    float32 on purpose: a hundred-odd steps of a fine grid is a lot of array to
    hold at once, and the values came out of a single byte to begin with.
    """
    speed = s.astype(np.float32) * np.float32(SPEED_STEP)
    radians = np.radians(d.astype(np.float32) * np.float32(DIR_STEP))
    return -speed * np.sin(radians), -speed * np.cos(radians)


def pack(plane: np.ndarray) -> str:
    return base64.b64encode(zlib.compress(plane.tobytes(), 9)).decode("ascii")


# ----------------------------------------------------------------- the table


def zone_offset(zone: str, fallback_hours: float, moment: dt.datetime) -> tuple[dt.timedelta, bool]:
    """(offset from UTC at `moment`, whether a real tz database answered)."""
    if ZoneInfo is not None:
        try:
            tz = ZoneInfo(zone)
            return moment.replace(tzinfo=dt.timezone.utc).astimezone(tz).utcoffset(), True
        except Exception:
            pass
    return dt.timedelta(hours=fallback_hours), False


def sample(planes: list[tuple[np.ndarray, np.ndarray]], grid: dict,
           step_index: float, lon: float, lat: float) -> tuple[float, float]:
    """(u, v) at a fractional step index and an arbitrary point.

    Bilinear across the grid and linear in time between two steps — the same
    two interpolations the app does, on the same quantised bytes, so a number
    in the ask table is the number the map shows.
    """
    nx, ny = grid["nx"], grid["ny"]
    k0 = max(0, min(len(planes) - 1, int(math.floor(step_index))))
    k1 = min(k0 + 1, len(planes) - 1)
    ft = max(0.0, min(1.0, step_index - k0))

    fi = (lon - grid["lon0"]) / grid["dlon"]
    fi -= math.floor(fi / nx) * nx
    fj = max(0.0, min(ny - 1.0, (lat - grid["lat0"]) / grid["dlat"]))
    i0 = int(math.floor(fi)); i1 = (i0 + 1) % nx; tx = fi - i0
    j0 = int(math.floor(fj)); j1 = min(j0 + 1, ny - 1); ty = fj - j0

    def at(k: int) -> tuple[float, float]:
        u, v = planes[k]
        top_u = u[j0, i0] + (u[j0, i1] - u[j0, i0]) * tx
        bot_u = u[j1, i0] + (u[j1, i1] - u[j1, i0]) * tx
        top_v = v[j0, i0] + (v[j0, i1] - v[j0, i0]) * tx
        bot_v = v[j1, i0] + (v[j1, i1] - v[j1, i0]) * tx
        return top_u + (bot_u - top_u) * ty, top_v + (bot_v - top_v) * ty

    u0, v0 = at(k0)
    if ft <= 0 or k1 == k0:
        return u0, v0
    u1, v1 = at(k1)
    return u0 + (u1 - u0) * ft, v0 + (v1 - v0) * ft


def beaufort(speed_ms: float) -> tuple[int, str]:
    for force, (upper, name) in enumerate(BEAUFORT):
        if speed_ms < upper:
            return force, name
    return 12, "Hurricane force"


def build_ask(planes: list[tuple[np.ndarray, np.ndarray]], grid: dict,
              run: dt.datetime, hours: list[int]) -> tuple[list[dict], bool]:
    """One flat row per city per forecast day: the wind at 12:00 local.

    Flat keys, numbers and short strings, nothing nested, at most a hundred
    rows. A row exists only where noon local falls inside the forecast, so a
    city on the far side of the date line contributes four rows where London
    contributes five — which is honest, and better than inventing a step.
    """
    first = run + dt.timedelta(hours=hours[0])
    last = run + dt.timedelta(hours=hours[-1])
    rows: list[dict] = []
    real_tz = True

    for name, country, lon, lat, zone, fallback in CITIES:
        offset, found = zone_offset(zone, fallback, run)
        real_tz = real_tz and found
        # Local midnight on the day the run starts, then noon on each following
        # day. The offset is the one in force at the run, which is right except
        # across a clock change inside the forecast window — an hour, once or
        # twice a year, on a value that is a forecast anyway.
        local_run = run + offset
        day0 = local_run.date()
        for day_number in range(0, FORECAST_DAYS + 1):
            local_noon = dt.datetime.combine(
                day0 + dt.timedelta(days=day_number), dt.time(12, 0))
            utc_noon = (local_noon - offset).replace(tzinfo=dt.timezone.utc)
            if utc_noon < first or utc_noon > last:
                continue
            lead = (utc_noon - run).total_seconds() / 3600.0
            spacing = hours[1] - hours[0] if len(hours) > 1 else 1
            step_index = (lead - hours[0]) / spacing
            u, v = sample(planes, grid, step_index, lon, lat)
            speed = math.hypot(u, v)
            from_degrees = (math.degrees(math.atan2(-u, -v)) + 360.0) % 360.0
            force, description = beaufort(speed)
            sign = "+" if offset >= dt.timedelta(0) else "-"
            total_minutes = int(abs(offset).total_seconds()) // 60
            rows.append({
                "place": name,
                "country": country,
                "day": local_noon.strftime("%a %d %b"),
                "localNoon": local_noon.strftime("%Y-%m-%dT12:00:00")
                             + f"{sign}{total_minutes // 60:02d}:{total_minutes % 60:02d}",
                "leadHours": round(lead, 1),
                "speedMs": round(speed, 1),
                "speedKmh": round(speed * 3.6),
                "fromDirection": COMPASS[round(from_degrees / 22.5) % 16] if speed >= 0.5 else "variable",
                "fromDegrees": round(from_degrees) if speed >= 0.5 else 0,
                "beaufort": force,
                "description": description,
            })
    rows.sort(key=lambda r: (r["localNoon"], r["place"]))
    return rows, real_tz


# ----------------------------------------------------------------- the build


def build(run: dt.datetime) -> dict:
    """Fetch, decode, quantise and pack one GFS run into the app's snapshot."""
    grid = out_grid()
    steps = []
    planes: list[tuple[np.ndarray, np.ndarray]] = []
    fastest = 0.0
    previous_s = previous_d = None
    raw_bytes = 0
    started = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(download, run, hour) for hour in HOURS]
        for hour, future in zip(HOURS, futures):
            u_message, v_message = future.result()
            raw_bytes += len(u_message) + len(v_message)
            u = decode(u_message, "10u", run, hour)
            v = decode(v_message, "10v", run, hour)
            s, d, step_max = quantize(u, v)
            fastest = max(fastest, step_max)
            planes.append(dequantize(s, d))
            # Every step after the first stores the CHANGE from the one before
            # it, mod 256. Wind moves smoothly, so the differences are small
            # and nearly all zero over land at night, which is exactly what
            # deflate is good at: about a third of the size of raw planes.
            if previous_s is None:
                packed_s, packed_d = s, d
            else:
                packed_s, packed_d = s - previous_s, d - previous_d      # uint8 wraps
            previous_s, previous_d = s, d
            valid = run + dt.timedelta(hours=hour)
            steps.append({"hours": hour, "validTime": iso(valid),
                          "speed": pack(packed_s), "dir": pack(packed_d)})
            if hour % 24 == 0:
                log(f"  +{hour:3d} h  {valid:%a %d %b %H:%MZ}  fastest {step_max:5.1f} m/s")

    log(f"  {raw_bytes / 1e6:.0f} MB of GRIB in {time.time() - started:.0f}s")
    ask, real_tz = build_ask(planes, grid, run, HOURS)
    log(f"  {len(ask)} ask rows for {len(CITIES)} cities"
        + ("" if real_tz else " (no tz database — standard offsets used)"))

    return {
        "schema": 1,
        "generatedAt": iso(dt.datetime.now(dt.timezone.utc)),
        "source": {
            "name": "NOAA Global Forecast System (GFS)",
            # {DEGREES:g} so a whole number prints as 2°, not 2.0°, which is
            # how the About panel writes the same figure from the grid.
            "detail": f"10 m wind from the 0.25° product, sampled to {DEGREES:g}°, "
                      f"read from the noaa-gfs-bdp-pds AWS Open Data bucket",
            # NOAA asks for attribution, and asks that modified data is not
            # passed off as unaltered NOAA data. This is sampled and rounded to
            # one byte a point, so the attribution says so and the app prints it.
            "licence": "Public domain — NOAA data disseminated through NODD are "
                       "open to the public and can be used as desired",
            "attribution": f"Wind: NOAA Global Forecast System, sampled to {DEGREES:g}°",
        },
        "model": "GFS",
        "run": iso(run),
        "level": LEVEL,
        "grid": grid,
        "encoding": {
            "speedStep": SPEED_STEP, "speedUnit": "m/s",
            "dirStep": DIR_STEP,
            "dirConvention": "degrees the wind blows FROM, clockwise from north",
            "order": "row-major from lat0 southwards, lon0 eastwards, one byte per point",
            "compression": "deflate",
            "delta": "previous-step",
        },
        "maxSpeed": round(fastest, 1),
        "localTimesFrom": "tzdata" if real_tz else "fixed standard offsets",
        "steps": steps,
        "ask": ask,
    }


def write(snapshot: dict, out: pathlib.Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = out.with_suffix(out.suffix + ".tmp")
    temporary.write_text(json.dumps(snapshot, separators=(",", ":")), encoding="utf-8")
    temporary.replace(out)


def write_fingerprint(out: pathlib.Path) -> tuple[str, pathlib.Path]:
    """Record the demo's sha256 beside it; return the hex and the path.

    `sha256sum -c` format, so the file is useful without this script.
    """
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    path = out.with_suffix(".sha256")
    path.write_text(f"{digest}  {out.name}\n", encoding="utf-8")
    return digest, path


def newest_usable_run(now: dt.datetime, skip_run: str) -> dt.datetime | None:
    """The newest complete run, or None when it is the one already published."""
    run = newest_complete_run(now)
    if skip_run and iso(run) == skip_run:
        log(f"run {iso(run)} is already published; nothing to do")
        return None
    return run


def build_with_fallback(run: dt.datetime) -> dict:
    """Build `run`, dropping back a cycle if a file disappears mid-pull."""
    tried: set[dt.datetime] = set()
    while True:
        log(f"using GFS run {run:%Y-%m-%d %HZ}")
        try:
            return build(run)
        except FileNotFoundError as error:
            if run in tried:
                raise RuntimeError(f"run {iso(run)} is incomplete; giving up") from error
            tried.add(run)
            log(f"  {error}; trying the previous run")
            run = newest_complete_run(run - dt.timedelta(hours=1))


# ------------------------------------------------------------------- --check


def compare(committed: dict, rebuilt: dict) -> list[str]:
    """What differs between the committed demo and a fresh build of its run.

    `generatedAt` is expected to differ and is ignored. The wind is compared as
    NUMBERS — the unpacked byte planes — not as base64, because a different
    zlib build can pack identical values into different bytes; whether the
    bytes also matched is reported separately by the caller.
    """
    problems: list[str] = []

    def unpack_steps(snapshot: dict) -> list[tuple[bytes, bytes]]:
        planes = []
        previous = None
        for step in snapshot["steps"]:
            s = zlib.decompress(base64.b64decode(step["speed"]))
            d = zlib.decompress(base64.b64decode(step["dir"]))
            if previous is not None:
                s = bytes((a + b) & 255 for a, b in zip(s, previous[0]))
                d = bytes((a + b) & 255 for a, b in zip(d, previous[1]))
            previous = (s, d)
            planes.append((s, d))
        return planes

    for key in ("schema", "run", "grid", "encoding", "level", "model", "maxSpeed"):
        if committed.get(key) != rebuilt.get(key):
            problems.append(f"{key}: committed {committed.get(key)!r}, rebuilt {rebuilt.get(key)!r}")
    if len(committed["steps"]) != len(rebuilt["steps"]):
        problems.append(f"steps: committed {len(committed['steps'])}, rebuilt {len(rebuilt['steps'])}")
        return problems
    for a, b in zip(committed["steps"], rebuilt["steps"]):
        if a["hours"] != b["hours"] or a["validTime"] != b["validTime"]:
            problems.append(f"step +{a['hours']} h: times differ")
    if not problems:
        for n, (a, b) in enumerate(zip(unpack_steps(committed), unpack_steps(rebuilt))):
            if a != b:
                problems.append(f"step {n}: the wind values differ")
                break
    if committed.get("ask") != rebuilt.get("ask"):
        problems.append("the ask table differs")
    return problems


def check(out: pathlib.Path) -> int:
    if not out.exists():
        log(f"{out} does not exist — run --demo first")
        return 1
    committed = json.loads(out.read_text(encoding="utf-8"))
    run_iso = committed.get("run")
    if not isinstance(run_iso, str):
        log(f"{out} does not name the GFS run it came from")
        return 1
    run = dt.datetime.strptime(run_iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    age_days = (dt.datetime.now(dt.timezone.utc) - run).total_seconds() / 86400
    log(f"the committed demo is GFS run {run_iso} ({age_days:.1f} days old)")

    status, _ = http(file_url(run, HOURS[-1]) + ".idx", method="HEAD")
    if status != 200:
        log("that run is no longer in the bucket — it keeps about ten days of history,")
        log("so this says nothing about the demo. Run --demo to make a fresh one, or")
        log("check the fingerprint offline: make_demo_global_wind.py --verify.")
        return 2                       # 2 is "could not tell", never "matched"

    rebuilt = build(run)
    problems = compare(committed, rebuilt)
    if problems:
        log("the rebuild does NOT match the committed demo:")
        for problem in problems:
            log(f"  {problem}")
        return 1

    byte_exact = all(a["speed"] == b["speed"] and a["dir"] == b["dir"]
                     for a, b in zip(committed["steps"], rebuilt["steps"]))
    log("every wind value, every step time and every ask row matches the committed demo.")
    log("byte-for-byte identical too" if byte_exact else
        "the compressed bytes differ (a different zlib packs the same numbers "
        "differently) — the data is the same")
    return 0


# -------------------------------------------------------------------- main


def main() -> int:
    global QUIET
    parser = argparse.ArgumentParser(description="Write the Global Wind snapshot from NOAA GFS.")
    parser.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    parser.add_argument("--skip-run", default="",
                        help="write nothing if the newest complete run is this one")
    parser.add_argument("--run", default="", help="build this run instead of the newest")
    parser.add_argument("--demo", action="store_true",
                        help="write the committed demo snapshot from a real pull")
    parser.add_argument("--check", action="store_true",
                        help="rebuild the run the committed demo names and compare")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    QUIET = args.quiet

    if args.check:
        return check(args.out)

    log(f"grid {DEGREES:g}°, {len(HOURS)} steps every {STEP_HOURS} h to +{HOURS[-1]} h "
        f"({out_grid()['nx']} x {out_grid()['ny']} points a step)")

    if args.run:
        run = dt.datetime.strptime(args.run, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    else:
        now = dt.datetime.now(dt.timezone.utc)
        log(f"looking for the newest complete GFS run at {now:%Y-%m-%d %H:%MZ}")
        run = newest_usable_run(now, args.skip_run)
        if run is None:
            return 0

    snapshot = build_with_fallback(run)
    write(snapshot, args.out)
    size = args.out.stat().st_size
    log(f"wrote {args.out}: run {snapshot['run']}, {len(snapshot['steps'])} steps, "
        f"fastest {snapshot['maxSpeed']} m/s, {len(snapshot['ask'])} ask rows, "
        f"{size / 1e6:.2f} MB")
    if args.demo:
        # The demo is committed, so say plainly which run it holds: --check
        # rebuilds exactly that one, and the bucket keeps about ten days. After
        # that the fingerprint is the only thing left that can be checked, so
        # it is written here rather than left to anybody's discipline.
        digest, fingerprint = write_fingerprint(args.out)
        print(f"demo snapshot: GFS run {snapshot['run']}, {DEGREES:g}° grid, "
              f"{len(snapshot['steps'])} steps every {STEP_HOURS} h to "
              f"+{HOURS[-1]} h, {size / 1e6:.2f} MB")
        print(f"fingerprint:   {digest}  ({fingerprint.name})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
