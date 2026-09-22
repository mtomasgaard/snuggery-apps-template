#!/usr/bin/env python3
"""Write global-weather/data/snapshot.json — days of global weather, from GFS.

Source: NOAA's Global Forecast System, read straight from the public AWS Open
Data bucket `noaa-gfs-bdp-pds`. No account, no key, no token, no registration.
GFS output is a work of the United States Government and is in the public
domain; global-weather/NOTES.md states the terms and what the app must print.

Five layers come out of the same forecast files: 10 m WIND (speed and
direction), 2 m TEMPERATURE, precipitation RATE, total CLOUD cover and
mean-sea-level PRESSURE. `LAYERS` below is the list, and it is the one place
to add a sixth or delete one you never look at — the app draws whatever the
snapshot declares and needs no edit to match.

Only the 0.25-degree GFS product has hourly output, so this reads those files
and keeps every SUB-th row and column to make the coarser grid the app draws.
Each forecast file is about half a gigabyte, but its `.idx` sidecar lists the
byte offset of every field inside it, so the job asks for just the six messages
per step with HTTP range requests: about 5 MB a step instead of 500, fetched
WORKERS at a time.

    python3 scripts/global_weather.py                  # the newest complete run
    python3 scripts/global_weather.py --demo           # the same, for the committed demo
    python3 scripts/global_weather.py --check          # is the committed demo still reproducible?
    python3 scripts/global_weather.py --skip-run 2026-09-21T06:00:00Z

--out        where to write (default global-weather/data/snapshot.json)
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
Four things decide everything: DEGREES (how coarse the grid is), STEP_HOURS
(how far apart the forecast steps are), FORECAST_DAYS (how far ahead) and the
length of LAYERS, because every layer is another byte per grid point per step.
They trade file size against detail, and global-weather/NOTES.md has the
measured table. The demo committed to this repository is deliberately small
because every copy of the repository carries it; your own private copy can turn
all of them up and get the fields at full resolution.

HOW A VALUE IS STORED, which the app has to agree with exactly
--------------------------------------------------------------
One byte a point a step, and the byte means

    value = offset + step * byte ** power

`power` is 1 for everything except rain, where 2 spends the bytes where the
weather is: a quadratic scale resolves drizzle to 0.03 mm/h and still reaches
65 mm/h at the top of the byte. Each plane's offset, step and power travel in
the snapshot's own `layers` block, so the app reads the scale rather than
knowing it, and changing one here changes both ends at once.

IS THE OUTPUT DETERMINISTIC?
----------------------------
Yes, apart from `generatedAt`: for one GFS run the bucket serves fixed bytes,
the quantisation is integer rounding, and deflate at a fixed level is stable
for a given zlib. `--check` therefore rebuilds the run the committed file names
and compares everything except `generatedAt`; it reports separately whether the
compressed bytes also matched, because a different zlib build can pack the same
numbers differently without changing a single value. The bucket keeps
roughly ten days of runs, so a check run long after the demo was committed says
the run has aged out rather than claiming a mismatch — and exits **2**, not 0,
because "I could not tell" is not "it matched" and a script must be able to see
the difference.

What survives that is `data/snapshot.sha256`, written beside the snapshot by
`--demo`. It cannot prove the bytes came from NOAA, but it proves
the committed file is still the one this script wrote, which is the question
anybody reading the repository next year actually has.
`scripts/make_demo_global_weather.py --verify` compares it, offline, with no
numpy and no network.

WHAT HAPPENS WHEN THE PULL FAILS
--------------------------------
Nothing is written. There is no `lastGood` copy inside the snapshot the way the
smaller apps here keep one, because this file is megabytes and a spare copy
would double it for no gain: the committed snapshot IS the last good answer,
the workflow commits only on a successful build, and the app stamps whatever it
finds with its age. An outage leaves yesterday's forecast on screen with a
stale header, which is the behaviour the convention asks for.

The snapshot's shape is documented at the top of global-weather/app.js. Keep
the two in step.

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

# Everything below follows from those three, and from the LAYERS list.
SOURCE_DEGREES = 0.25
SUB = round(DEGREES / SOURCE_DEGREES)
HOURS = list(range(0, FORECAST_DAYS * 24 + 1, STEP_HOURS))

BUCKET = "https://noaa-gfs-bdp-pds.s3.amazonaws.com"
PRODUCT = "pgrb2.0p25"                              # the only GFS grid with hourly steps
WORKERS = 6                                         # parallel range requests
TIMEOUT = 120
RETRIES = 4


# ------------------------------------------------------------------ the layers
#
# One entry per thing the map can colour. Each declares the GRIB messages it
# needs, how its values are turned into bytes, and the words the app puts on
# screen beside them. Adding a layer is adding an entry: the snapshot carries
# the whole block, and app.js reads it rather than knowing it.
#
#   grib     (variable, level, eccodes shortName) for every message to fetch.
#            The variable and level are matched against the `.idx` sidecar
#            exactly as they are written there; the shortName is what the
#            decoded message must call itself, which is the check that the
#            bytes in hand are the field that was asked for.
#   planes   what is stored, in order. Each is one byte a grid point:
#            offset/step/power as at the top of this file, `wrap` for an angle
#            that goes round rather than clipping at its ends.
#   make     decoded fields (by shortName, in GRIB units) -> the plane values,
#            in the unit the layer says it is in.
#
# COSTS, measured on the committed 2°/3 h/5-day settings — snapshot bytes and
# download bytes, because a layer costs both: wind 1.20 MB and about 75 MB,
# cloud 0.62/32, rain 0.43/23, temperature 0.34/19, pressure 0.28/38. Deleting
# an entry here saves both ends; `make_demo_global_weather.py --sizes` re-measures.

def _wind_planes(f):
    """Meteorological convention: the direction the wind blows FROM, clockwise
    from north, so a pure westerly (u > 0, v = 0) is 270."""
    u, v = f["10u"], f["10v"]
    return {"speed": np.hypot(u, v),
            "dir": np.degrees(np.arctan2(-u, -v)) % 360.0}


LAYERS = [
    {
        "key": "wind", "label": "Wind", "kind": "vector", "unit": "m/s",
        "level": "10 m above ground",
        "grib": [("UGRD", "10 m above ground", "10u"),
                 ("VGRD", "10 m above ground", "10v")],
        "planes": {
            # 0.25 m/s a byte reaches 63.75 m/s — above any wind on Earth at
            # 10 m, and finer than the forecast's own uncertainty by a mile.
            "speed": {"offset": 0.0, "step": 0.25, "power": 1, "unit": "m/s"},
            "dir": {"offset": 0.0, "step": 360.0 / 256, "power": 1, "wrap": True,
                    "unit": "degrees the wind blows FROM, clockwise from north"},
        },
        "make": _wind_planes,
    },
    {
        "key": "temp", "label": "Temperature", "kind": "scalar", "unit": "°C",
        "level": "2 m above ground",
        "grib": [("TMP", "2 m above ground", "2t")],
        # -90 °C is below the coldest place on the planet and +63 °C above the
        # hottest, at 0.6 °C a byte. Nothing on Earth clips.
        "planes": {"v": {"offset": -90.0, "step": 0.6, "power": 1, "unit": "°C"}},
        "make": lambda f: {"v": f["2t"] - 273.15},
    },
    {
        "key": "rain", "label": "Rain", "kind": "scalar", "unit": "mm/h",
        "level": "surface",
        "grib": [("PRATE", "surface", "prate")],
        # Quadratic, because rain is not linear to a reader: 0.001 × byte²
        # resolves drizzle to hundredths of a millimetre an hour and still
        # reaches 65 mm/h, which is heavier than GFS forecasts at this grid.
        "planes": {"v": {"offset": 0.0, "step": 0.001, "power": 2, "unit": "mm/h"}},
        "make": lambda f: {"v": f["prate"] * 3600.0},      # kg m-2 s-1 -> mm/h
    },
    {
        "key": "cloud", "label": "Cloud", "kind": "scalar", "unit": "%",
        "level": "entire atmosphere",
        "grib": [("TCDC", "entire atmosphere", "tcc")],
        "planes": {"v": {"offset": 0.0, "step": 0.5, "power": 1, "unit": "%"}},
        "make": lambda f: {"v": f["tcc"]},
    },
    {
        "key": "pressure", "label": "Pressure", "kind": "scalar", "unit": "hPa",
        "level": "mean sea level",
        "grib": [("PRMSL", "mean sea level", "prmsl")],
        # 870 hPa is under the lowest pressure ever measured in a typhoon and
        # the top of the byte is 1086 hPa, above the highest. 0.85 hPa a byte.
        "planes": {"v": {"offset": 870.0, "step": 0.85, "power": 1, "unit": "hPa"}},
        "make": lambda f: {"v": f["prmsl"] / 100.0},       # Pa -> hPa
    },
]

# Identify the job. GitHub sets GITHUB_REPOSITORY in Actions; running it by hand
# falls back to the template's own name. Put your repository here if you would
# rather it were always named.
_repo = os.environ.get("GITHUB_REPOSITORY", "snuggery-apps-template")
USER_AGENT = f"global-weather snapshot job (+https://github.com/{_repo})"

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "global-weather"
DEFAULT_OUT = APP / "data" / "snapshot.json"

# nx, ny, lon0, lat0, dlon, dlat of the files in the bucket, checked on every
# message: if NOAA ever changes the product under us the job stops instead of
# quietly writing a shifted world.
SOURCE_GRID = (1440, 721, 0.0, 90.0, 0.25, -0.25)

QUIET = False


# ------------------------------------------------------------- the ask table
#
# Twelve well-known cities, one row per city per forecast day, the weather at
# 12:00 LOCAL time. Snuggery's "Ask About This Data" reads the snapshot's
# top-level `ask` array and nothing else, so these rows are the whole
# vocabulary a question in words has to work with: "where is it windiest on
# Thursday", "how warm is Tokyo on Friday", "where is it raining". Seventy-odd
# rows at most.
#
# The list is spread across six continents and both hemispheres on purpose, so
# the table says something about the world rather than about one corner of it.
# Nobody's home town is in it, and nothing here is anybody's — a city's weather
# is public. Edit the list freely; it is the app's only opinion.
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

# Words for a number, so a question in words has words to find. The upper bound
# of each band and its name; the last one catches everything above.
SKY = [(10, "Clear"), (30, "Mostly clear"), (60, "Partly cloudy"),
       (85, "Cloudy"), (101, "Overcast")]
RAINFALL = [(0.05, "Dry"), (0.3, "Drizzle"), (1.5, "Light rain"),
            (5.0, "Rain"), (12.0, "Heavy rain")]


# --------------------------------------------------------------- small stuff


def log(message: str) -> None:
    if not QUIET:
        print(message, file=sys.stderr, flush=True)


def band(value: float, bands: list, above: str) -> str:
    for upper, name in bands:
        if value < upper:
            return name
    return above


def out_grid() -> dict:
    """The grid the app is handed, derived from DEGREES."""
    if 1440 % SUB or 720 % SUB:
        raise SystemExit(f"DEGREES = {DEGREES} does not divide the 0.25° grid evenly")
    return {"nx": 1440 // SUB, "ny": 720 // SUB + 1,
            "lon0": 0.0, "lat0": 90.0, "dlon": DEGREES, "dlat": -DEGREES}


def plane_names() -> list:
    """Every plane in the snapshot, as "<layer>.<plane>", in a fixed order."""
    return [f"{layer['key']}.{name}"
            for layer in LAYERS for name in layer["planes"]]


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


def field_ranges(idx_text: str) -> dict[str, tuple[int, int | None]]:
    """Byte ranges of every message LAYERS asks for, from a .idx sidecar.

    A sidecar line is `n:offset:date:VAR:level:forecast:`. A message runs from
    its own offset to the byte before the next one, which is how a range
    request can ask for six fields out of half a gigabyte. Keyed by shortName,
    because that is what the decoder checks the bytes against.
    """
    rows = []
    for line in idx_text.splitlines():
        parts = line.split(":")
        if len(parts) < 6:
            continue
        rows.append((int(parts[1]), parts[3], parts[4]))
    wanted = {(variable, level): short
              for layer in LAYERS for variable, level, short in layer["grib"]}
    found: dict[str, tuple[int, int | None]] = {}
    for n, (offset, variable, level) in enumerate(rows):
        short = wanted.get((variable, level))
        # A field can appear more than once in one file — an instant value and
        # an average over the step, say. The first is the instantaneous one and
        # the one the app draws, so later duplicates are left alone.
        if short is not None and short not in found:
            end = rows[n + 1][0] - 1 if n + 1 < len(rows) else None
            found[short] = (offset, end)
    missing = sorted(set(wanted.values()) - set(found))
    if missing:
        raise RuntimeError(f"the index does not hold {', '.join(missing)}")
    return found


def fetch_field(url: str, byte_range: tuple[int, int | None]) -> bytes:
    start, end = byte_range
    rng = f"bytes={start}-{end}" if end is not None else f"bytes={start}-"
    status, body = http(url, headers={"Range": rng})
    if status not in (200, 206) or not body:
        raise RuntimeError(f"range GET {url} -> {status}")
    return body


def download(run: dt.datetime, hour: int) -> dict[str, bytes]:
    """Every raw GRIB message of one step, by shortName. Pure I/O, thread-safe."""
    url = file_url(run, hour)
    status, index = http(url + ".idx")
    if status != 200:
        raise FileNotFoundError(f"{url}.idx -> {status}")
    ranges = field_ranges(index.decode("utf-8", "replace"))
    return {short: fetch_field(url, byte_range) for short, byte_range in ranges.items()}


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
        # Several of these fields appear TWICE in a forecast file: the value at
        # the step, and the average over the period leading up to it. The index
        # lists the instantaneous one first and that is the one asked for, but
        # "first in the file" is a habit of NOAA's rather than a promise — so
        # the message says which it is, and an average stops the job rather
        # than quietly becoming three hours of smeared rain on the map.
        kind = ec.codes_get(gid, "stepType")
        if kind != "instant":
            raise RuntimeError(f"{short} came back as a {kind!r} field, not the value at "
                               f"the step — the order of the .idx has changed")
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


def quantize(values: np.ndarray, spec: dict) -> np.ndarray:
    """Plane values -> one byte a point, by the scale the snapshot declares."""
    scaled = (np.asarray(values, dtype=np.float64) - spec["offset"]) / spec["step"]
    power = spec.get("power", 1)
    if power != 1:
        scaled = np.maximum(scaled, 0.0) ** (1.0 / power)
    if spec.get("wrap"):                        # an angle goes round, it does not clip
        return (np.rint(scaled).astype(np.int64) % 256).astype(np.uint8)
    return np.clip(np.rint(scaled), 0, 255).astype(np.uint8)


def dequantize(plane: np.ndarray, spec: dict) -> np.ndarray:
    """The bytes back to values — exactly what the app reconstructs.

    float32 on purpose: the values came out of a single byte to begin with, and
    the ask table is sampled from these so that a number in the table is the
    number the map shows.
    """
    values = plane.astype(np.float32)
    power = spec.get("power", 1)
    if power != 1:
        values = values ** np.float32(power)
    return np.float32(spec["offset"]) + np.float32(spec["step"]) * values


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


def bilinear(plane: np.ndarray, grid: dict, lon: float, lat: float) -> float:
    """One plane's value at an arbitrary point — the app's own interpolation.

    Longitude wraps, latitude clamps, and the four corners are weighted the way
    app.js weights them, so a city's number in the ask table is the number a tap
    on that city gives on the map.
    """
    nx, ny = grid["nx"], grid["ny"]
    fi = (lon - grid["lon0"]) / grid["dlon"]
    fi -= math.floor(fi / nx) * nx
    fj = max(0.0, min(ny - 1.0, (lat - grid["lat0"]) / grid["dlat"]))
    i0 = int(math.floor(fi)); i1 = (i0 + 1) % nx; tx = fi - i0
    j0 = int(math.floor(fj)); j1 = min(j0 + 1, ny - 1); ty = fj - j0
    top = plane[j0, i0] + (plane[j0, i1] - plane[j0, i0]) * tx
    bottom = plane[j1, i0] + (plane[j1, i1] - plane[j1, i0]) * tx
    return float(top + (bottom - top) * ty)


def city_samples(uv: dict, planes: dict, grid: dict) -> list[dict]:
    """One step's weather at each city, in the order CITIES is written.

    Sampling here, a step at a time, rather than keeping every plane of every
    step in memory: the table needs a dozen points out of a grid, and at the
    finer dials the planes would be hundreds of megabytes.

    Wind is kept as u and v rather than speed and direction because the table
    interpolates between two steps, and averaging 350° with 10° the obvious way
    gives 180° — the wind pointing exactly the wrong way. Every other layer is
    one plane called `v`, which is what `kind: scalar` means.
    """
    rows = []
    for _, _, lon, lat, _, _ in CITIES:
        row = {"u": bilinear(uv["u"], grid, lon, lat),
               "v": bilinear(uv["v"], grid, lon, lat)}
        for layer in LAYERS:
            if layer["key"] != "wind":
                row[layer["key"]] = bilinear(planes[f"{layer['key']}.v"], grid, lon, lat)
        rows.append(row)
    return rows


def beaufort(speed_ms: float) -> tuple[int, str]:
    for force, (upper, name) in enumerate(BEAUFORT):
        if speed_ms < upper:
            return force, name
    return 12, "Hurricane force"


def build_ask(samples: list[list[dict]], run: dt.datetime,
              hours: list[int]) -> tuple[list[dict], bool]:
    """One flat row per city per forecast day: the weather at 12:00 local.

    Flat keys, numbers and short strings, nothing nested, at most a hundred
    rows. A row exists only where noon local falls inside the forecast, so a
    city on the far side of the date line contributes four rows where London
    contributes five — which is honest, and better than inventing a step.
    """
    first = run + dt.timedelta(hours=hours[0])
    last = run + dt.timedelta(hours=hours[-1])
    spacing = hours[1] - hours[0] if len(hours) > 1 else 1
    rows: list[dict] = []
    real_tz = True

    def at(city: int, key: str, step_index: float) -> float:
        """One city's value at a fractional step: linear between two steps."""
        k0 = max(0, min(len(samples) - 1, int(math.floor(step_index))))
        k1 = min(k0 + 1, len(samples) - 1)
        f = max(0.0, min(1.0, step_index - k0))
        a = samples[k0][city][key]
        return a if k1 == k0 or f <= 0 else a + (samples[k1][city][key] - a) * f

    for city, (name, country, _, _, zone, fallback) in enumerate(CITIES):
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
            step_index = (lead - hours[0]) / spacing
            u = at(city, "u", step_index)
            v = at(city, "v", step_index)
            speed = math.hypot(u, v)
            from_degrees = (math.degrees(math.atan2(-u, -v)) + 360.0) % 360.0
            force, description = beaufort(speed)
            sign = "+" if offset >= dt.timedelta(0) else "-"
            total_minutes = int(abs(offset).total_seconds()) // 60
            row = {
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
                "wind": description,
            }
            # Every other layer, in the order LAYERS declares them, so deleting
            # a layer up there deletes its column here too.
            for layer in LAYERS:
                key = layer["key"]
                if key == "wind":
                    continue
                value = at(city, key, step_index)
                if key == "temp":
                    row["tempC"] = round(value, 1)
                    row["tempF"] = round(value * 9 / 5 + 32)
                elif key == "rain":
                    row["rainMmPerHour"] = round(value, 2)
                    row["rainfall"] = band(value, RAINFALL, "Downpour")
                elif key == "cloud":
                    row["cloudPercent"] = round(value)
                    row["sky"] = band(value, SKY, "Overcast")
                elif key == "pressure":
                    row["pressureHPa"] = round(value)
                else:                           # a layer somebody added below
                    row[key] = round(value, 2)
            rows.append(row)
    rows.sort(key=lambda r: (r["localNoon"], r["place"]))
    return rows, real_tz


# ----------------------------------------------------------------- the build


def build(run: dt.datetime) -> dict:
    """Fetch, decode, quantise and pack one GFS run into the app's snapshot."""
    grid = out_grid()
    steps = []
    samples: list[list[dict]] = []
    extremes = {name: [math.inf, -math.inf] for name in plane_names()}
    previous: dict[str, np.ndarray] = {}
    raw_bytes = 0
    started = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(download, run, hour) for hour in HOURS]
        for hour, future in zip(HOURS, futures):
            messages = future.result()
            raw_bytes += sum(len(m) for m in messages.values())
            fields = {short: decode(messages[short], short, run, hour)
                      for layer in LAYERS for _, _, short in layer["grib"]}
            messages = None                     # half a dozen megabytes a step

            # Quantise, then read the bytes back: the ask table and the map
            # must agree to the last decimal, so both come from the bytes.
            packed: dict[str, str] = {}
            restored: dict[str, np.ndarray] = {}
            for layer in LAYERS:
                for name, values in layer["make"](fields).items():
                    key = f"{layer['key']}.{name}"
                    spec = layer["planes"][name]
                    plane = quantize(values, spec)
                    restored[key] = dequantize(plane, spec)
                    if not spec.get("wrap"):
                        extremes[key][0] = min(extremes[key][0], float(values.min()))
                        extremes[key][1] = max(extremes[key][1], float(values.max()))
                    # Every step after the first stores the CHANGE from the one
                    # before it, mod 256. Weather moves smoothly, so the
                    # differences are small and nearly all zero over a calm
                    # ocean at night, which is exactly what deflate is good at:
                    # about a third of the size of raw planes.
                    packed[key] = pack(plane if key not in previous
                                       else plane - previous[key])   # uint8 wraps
                    previous[key] = plane

            if "wind.speed" in restored:
                speed = restored["wind.speed"]
                radians = np.radians(restored["wind.dir"])
                uv = {"u": -speed * np.sin(radians), "v": -speed * np.cos(radians)}
            else:                               # somebody deleted the wind layer
                calm = np.zeros_like(next(iter(restored.values())))
                uv = {"u": calm, "v": calm}
            samples.append(city_samples(uv, restored, grid))

            valid = run + dt.timedelta(hours=hour)
            steps.append({"hours": hour, "validTime": iso(valid), "planes": packed})
            if hour % 24 == 0:
                shown = ""
                if "wind.speed" in restored:
                    shown += f"  wind to {float(restored['wind.speed'].max()):5.1f} m/s"
                if "temp.v" in restored:
                    shown += f"  temp {float(restored['temp.v'].min()):6.1f} to " \
                             f"{float(restored['temp.v'].max()):5.1f} °C"
                log(f"  +{hour:3d} h  {valid:%a %d %b %H:%MZ}{shown}")

    log(f"  {raw_bytes / 1e6:.0f} MB of GRIB in {time.time() - started:.0f}s")
    ask, real_tz = build_ask(samples, run, HOURS)
    log(f"  {len(ask)} ask rows for {len(CITIES)} cities"
        + ("" if real_tz else " (no tz database — standard offsets used)"))

    layers = []
    for layer in LAYERS:
        described = {
            "key": layer["key"], "label": layer["label"], "kind": layer["kind"],
            "unit": layer["unit"], "level": layer["level"],
            "field": "/".join(variable for variable, _, _ in layer["grib"]),
            "planes": {name: {k: v for k, v in spec.items()}
                       for name, spec in layer["planes"].items()},
        }
        # What this layer actually reached in this forecast, before rounding:
        # the app puts it in About, and it is the honest answer to "is the
        # scale wide enough for today".
        lo, hi = extremes[f"{layer['key']}.{next(iter(layer['planes']))}"]
        if math.isfinite(lo) and math.isfinite(hi):
            described["range"] = [round(lo, 2), round(hi, 2)]
        layers.append(described)

    return {
        "schema": 2,
        "generatedAt": iso(dt.datetime.now(dt.timezone.utc)),
        "source": {
            "name": "NOAA Global Forecast System (GFS)",
            # {DEGREES:g} so a whole number prints as 2°, not 2.0°, which is
            # how the About panel writes the same figure from the grid.
            "detail": f"{len(LAYERS)} fields from the 0.25° product, sampled to "
                      f"{DEGREES:g}°, read from the noaa-gfs-bdp-pds AWS Open Data bucket",
            # NOAA asks for attribution, and asks that modified data is not
            # passed off as unaltered NOAA data. This is sampled and rounded to
            # one byte a point, so the attribution says so and the app prints it.
            "licence": "Public domain — NOAA data disseminated through NODD are "
                       "open to the public and can be used as desired",
            "attribution": f"Weather: NOAA Global Forecast System, sampled to {DEGREES:g}°",
        },
        "model": "GFS",
        "run": iso(run),
        "grid": grid,
        "encoding": {
            "value": "offset + step * byte ** power, per plane, as `layers` says",
            "order": "row-major from lat0 southwards, lon0 eastwards, one byte per point",
            "compression": "deflate",
            "delta": "previous-step",
        },
        "layers": layers,
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

    `generatedAt` is expected to differ and is ignored. The weather is compared
    as NUMBERS — the unpacked byte planes — not as base64, because a different
    zlib build can pack identical values into different bytes; whether the
    bytes also matched is reported separately by the caller.
    """
    problems: list[str] = []

    def unpack_steps(snapshot: dict) -> list[dict]:
        out = []
        previous: dict[str, bytes] = {}
        for step in snapshot["steps"]:
            planes = {}
            for key, packed in step["planes"].items():
                plane = zlib.decompress(base64.b64decode(packed))
                if key in previous:
                    plane = bytes((a + b) & 255 for a, b in zip(plane, previous[key]))
                previous[key] = plane
                planes[key] = plane
            out.append(planes)
        return out

    for key in ("schema", "run", "grid", "encoding", "layers", "model"):
        if committed.get(key) != rebuilt.get(key):
            problems.append(f"{key}: committed {committed.get(key)!r}, rebuilt {rebuilt.get(key)!r}")
    if len(committed["steps"]) != len(rebuilt["steps"]):
        problems.append(f"steps: committed {len(committed['steps'])}, rebuilt {len(rebuilt['steps'])}")
        return problems
    for a, b in zip(committed["steps"], rebuilt["steps"]):
        if a["hours"] != b["hours"] or a["validTime"] != b["validTime"]:
            problems.append(f"step +{a['hours']} h: times differ")
        if sorted(a["planes"]) != sorted(b["planes"]):
            problems.append(f"step +{a['hours']} h: different planes")
    if not problems:
        for n, (a, b) in enumerate(zip(unpack_steps(committed), unpack_steps(rebuilt))):
            differ = [key for key in sorted(a) if a[key] != b[key]]
            if differ:
                problems.append(f"step {n}: {', '.join(differ)} differ")
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
        log("check the fingerprint offline: make_demo_global_weather.py --verify.")
        return 2                       # 2 is "could not tell", never "matched"

    rebuilt = build(run)
    problems = compare(committed, rebuilt)
    if problems:
        log("the rebuild does NOT match the committed demo:")
        for problem in problems:
            log(f"  {problem}")
        return 1

    byte_exact = all(a["planes"] == b["planes"]
                     for a, b in zip(committed["steps"], rebuilt["steps"]))
    log("every value, every step time and every ask row matches the committed demo.")
    log("byte-for-byte identical too" if byte_exact else
        "the compressed bytes differ (a different zlib packs the same numbers "
        "differently) — the data is the same")
    return 0


# -------------------------------------------------------------------- main


def main() -> int:
    global QUIET
    parser = argparse.ArgumentParser(description="Write the Global Weather snapshot from NOAA GFS.")
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
        f"({out_grid()['nx']} x {out_grid()['ny']} points a step), "
        f"{len(plane_names())} planes: {', '.join(layer['key'] for layer in LAYERS)}")

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
        f"{len(snapshot['layers'])} layers, {len(snapshot['ask'])} ask rows, "
        f"{size / 1e6:.2f} MB")
    if args.demo:
        # The demo is committed, so say plainly which run it holds: --check
        # rebuilds exactly that one, and the bucket keeps about ten days. After
        # that the fingerprint is the only thing left that can be checked, so
        # it is written here rather than left to anybody's discipline.
        digest, fingerprint = write_fingerprint(args.out)
        print(f"demo snapshot: GFS run {snapshot['run']}, {DEGREES:g}° grid, "
              f"{len(snapshot['steps'])} steps every {STEP_HOURS} h to "
              f"+{HOURS[-1]} h, {len(snapshot['layers'])} layers, {size / 1e6:.2f} MB")
        print(f"fingerprint:   {digest}  ({fingerprint.name})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
