#!/usr/bin/env python3
"""Pull everything the Training Load app needs straight from Garmin Connect.

Runs on a plain cron, no agent involved, and leaves the reasoning (assessment,
session notes, race forecast, plan) to the optional daily agent routine, which then finds the
data already in the repository and never has to touch the Garmin connector.

    python3 scripts/garmin_pull.py --login          # once: sign in (handles MFA), store tokens
    python3 scripts/garmin_pull.py                  # pull what is missing, rebuild the snapshot
    python3 scripts/garmin_pull.py --push           # ...and commit + push to main
    python3 scripts/garmin_pull.py --streams 20     # also backfill up to 20 record streams
    python3 scripts/garmin_pull.py --full           # the two-week load/sleep window (hourly runs use two days)

Credentials: `--login` asks for the email, the password and the MFA code in
the terminal (GARMIN_EMAIL / GARMIN_PASSWORD are read if set); after that the
session tokens live in ~/.garminconnect. For GitHub Actions, `--export-tokens` prints them as one
line to store in a GARMINTOKENS secret, and the script accepts that JSON in
the GARMINTOKENS variable directly. Needs `pip install -r scripts/requirements.txt`.

What it writes, all through garmin_append.py so the rows are keyed and
idempotent: activities.json, zones.csv, gear.csv, splits.csv, details.csv,
laps.csv, weather.csv, zonekm.csv, streams/<id>.csv, maps.json (with the
street tiles under training-load/data/tiles), garmin_load.csv, sleep.csv, the
garminNow block of context.json, intraday.json (heart rate, body battery and
stress through the last 36 hours, replaced each pull), calendar.json
(upcoming events, once a day), and pull.json — a receipt with the time and the outcome of every step, which the
Routine reads to decide whether the data is fresh.

This talks to Garmin's web API through the open-source garminconnect library.
It is not an official API; when Garmin changes something the library catches
up within days and the app's stale-data warning shows the gap meanwhile.
"""
import argparse
import datetime as dt
import glob
import json
import math
import os
import re
import subprocess
import sys
import time
import traceback

SAFE_ID = re.compile(r"[A-Za-z0-9_-]+")  # an activity id becomes a file name; nothing else may

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, "garmin-raw")
sys.path.insert(0, HERE)
import garmin_append as ga  # noqa: E402
import fit_records as fr  # noqa: E402

LOAD_DAYS = 14          # full rolling window, once a day; the merge is keyed on date
SLEEP_DAYS = 14
QUICK_DAYS = 2          # the window on the other hourly runs
FULL_HOUR_UTC = 5       # the run in this UTC hour (or --full) re-pulls the full window
STREAMS_PER_RUN = 4     # record streams per run unless --streams says otherwise
CALENDAR_MONTHS = 7     # this month plus six ahead, for races

report = {"pulledAt": None, "steps": {}, "new": {}, "warnings": []}


def log(msg):
    # stderr, so `--export-tokens | gh secret set ...` carries only the token line
    print(f"[pull] {msg}", file=sys.stderr, flush=True)


def step(name):
    """Decorator: run a step, record ok/error in the receipt, never abort the run."""
    def wrap(fn):
        def run(*a, **k):
            try:
                out = fn(*a, **k)
                report["steps"][name] = "ok"
                return out
            except Exception as err:  # one failing endpoint must not cost the rest
                report["steps"][name] = f"error: {type(err).__name__}: {err}"
                log(f"{name} FAILED: {err}")
                traceback.print_exc()
                return None
        return run
    return wrap


def pick(*sources, keys=(), default=None):
    for src in sources:
        if not isinstance(src, dict):
            continue
        for k in keys:
            v = src.get(k)
            if v is not None:
                return v
    return default


def num(v, nd=None):
    if v is None or v == "":
        return ""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    if nd == 0:
        return str(int(round(f)))
    if nd is not None:
        return f"{f:.{nd}f}".rstrip("0").rstrip(".")
    return f"{f:g}"


def csv_line(*vals):
    return ",".join("" if v is None else str(v) for v in vals)


# ------------------------------------------------------------------ login

def connect(interactive=False):
    """Sign in. Order of preference: GARMINTOKENS holding the token JSON itself
    (a GitHub secret), GARMINTOKENS or ~/.garminconnect as a directory of stored
    tokens, then GARMIN_EMAIL / GARMIN_PASSWORD for a first login."""
    from garminconnect import Garmin
    env = os.environ.get("GARMINTOKENS")
    inline = bool(env) and env.lstrip().startswith("{")  # the token JSON itself, e.g. a GitHub secret
    # The directory the tokens live in. Never the JSON: a --login with the
    # secret exported would otherwise try to create a directory named after it.
    store = env if (env and not inline) else os.path.expanduser("~/.garminconnect")
    email, password = os.environ.get("GARMIN_EMAIL"), os.environ.get("GARMIN_PASSWORD")
    if not interactive:
        if inline:
            import tempfile
            d = tempfile.mkdtemp(prefix="garmin-tokens-")
            with open(os.path.join(d, "garmin_tokens.json"), "w") as fh:
                fh.write(env)
            api = Garmin()
            api.login(d)
            log("signed in with the tokens from GARMINTOKENS")
            return api
        if os.path.isdir(store) and os.listdir(store):
            api = Garmin()
            api.login(store)
            log(f"signed in with the stored tokens in {store}")
            return api
    if interactive and sys.stdin.isatty():
        # Asked for in the terminal, so the password is never on a command
        # line, in shell history, or in an agent's transcript.
        import getpass
        email = email or input("Garmin email: ")
        password = password or getpass.getpass("Garmin password (not shown): ")
    if not email or not password:
        raise SystemExit("no stored tokens; run `garmin_pull.py --login` in a terminal to sign in")
    api = Garmin(email, password, prompt_mfa=(lambda: input("Garmin MFA code: ")) if interactive else None)
    api.login()
    os.makedirs(store, exist_ok=True)
    api.client.dump(store)
    log(f"signed in and stored the tokens in {store}")
    return api


# ------------------------------------------------------------------ activities

def shape_activity(a):
    """The connector's curated activity shape, which activities.json has always used."""
    typ = pick(a.get("activityType"), keys=("typeKey",), default=a.get("type"))
    ev = pick(a.get("eventType"), keys=("typeKey",), default=a.get("event_type") or "uncategorized")
    start = (a.get("startTimeLocal") or a.get("start_time") or "").replace("T", " ")[:19]
    return {
        "id": a.get("activityId", a.get("id")), "name": a.get("activityName", a.get("name")),
        "type": typ, "event_type": ev, "start_time": start,
        "distance_meters": a.get("distance", a.get("distance_meters")),
        "duration_seconds": a.get("duration", a.get("duration_seconds")),
        "moving_duration_seconds": a.get("movingDuration", a.get("moving_duration_seconds")),
        "calories": a.get("calories"), "avg_hr_bpm": a.get("averageHR", a.get("avg_hr_bpm")),
        "max_hr_bpm": a.get("maxHR", a.get("max_hr_bpm")), "steps": a.get("steps"),
        "elevation_gain_meters": a.get("elevationGain", a.get("elevation_gain_meters")),
    }


@step("activities")
def pull_activities(api, today):
    m = ga.missing()
    start = m["newest_activity"]  # re-fetching the newest stored day is deliberate: a late upload still lands
    raw = api.get_activities_by_date(start, today.isoformat()) or []
    rows = [shape_activity(a) for a in raw]
    before = m["activities"]
    ga.merge_activities(json.dumps(rows))
    report["new"]["activities"] = ga.missing()["activities"] - before
    return rows


# ------------------------------------------------------------------ per-activity rows

@step("zones")
def pull_zones(api, ids):
    lines = []
    for aid in ids:
        z = api.get_activity_hr_in_timezones(aid) or []
        secs = {int(x.get("zoneNumber", 0)): float(x.get("secsInZone") or 0) for x in z}
        lines.append(csv_line(aid, *[int(round(secs.get(n, 0))) for n in range(1, 6)]))
    if lines:
        ga.merge_csv("zones", "\n".join(lines))
    return len(lines)


def gear_code(item, ctx):
    """Match a gear item to the short codes in context.json; unknown gear gets a new code."""
    names = [str(item.get(k) or "") for k in ("customMakeModel", "displayName", "gearMakeName")]
    names = [n for n in names if n and n.lower() not in ("other", "none")]
    for g in ctx["gear"]:
        for n in names:
            if n.lower() in g["name"].lower() or g["name"].lower() in n.lower():
                return g["code"]
    label = names[0] if names else "Unknown gear"
    code = re.sub(r"[^A-Z]", "", label.upper())[:3] or "GR"
    taken = {g["code"] for g in ctx["gear"]}
    base, n = code, 2
    while code in taken:
        code, n = f"{base}{n}", n + 1
    ctx["gear"].append({"code": code, "name": label, "type": item.get("gearTypeName") or "Other",
                        "since": (item.get("dateBegin") or "")[:10] or None, "km": 0, "activities": 0, "maxKm": None})
    report["warnings"].append(f"new gear {label!r} added to context.json as {code}")
    return code


@step("gear")
def pull_gear(api, ids, ctx):
    lines = []
    for aid in ids:
        items = api.get_activity_gear(aid) or []
        codes = sorted({gear_code(it, ctx) for it in items})
        lines.append(csv_line(aid, "|".join(codes) if codes else "-"))
    if lines:
        ga.merge_csv("gear", "\n".join(lines))
    return len(lines)


@step("splits")
def pull_splits(api, ids):
    lines = []
    for aid in ids:
        summ = (api.get_activity_split_summaries(aid) or {}).get("splitSummaries", [])
        by = {s.get("splitType"): s for s in summ}
        run, walk, stand = by.get("RWD_RUN", {}), by.get("RWD_WALK", {}), by.get("RWD_STAND", {})
        if not run and not walk:
            continue  # no run/walk detection on this one
        lines.append(csv_line(aid, num(run.get("duration"), 0), num(run.get("distance"), 0), num(run.get("averageHR"), 0),
                              num(walk.get("duration"), 0) or 0, num(walk.get("distance"), 0) or 0, num(walk.get("averageHR"), 0),
                              num(stand.get("duration"), 0) or 0))
    if lines:
        ga.merge_csv("splits", "\n".join(lines))
    return len(lines)


def pack_kg(*sources):
    """The pack weight Garmin records for a rucking activity, in kg, if the
    response carries one. The field name is not documented, so any key with
    "ruck" or "load" and "weight" in it is taken; values over 500 are grams.
    Logs the candidate keys the first time so the name can be pinned down."""
    for src in sources:
        if not isinstance(src, dict):
            continue
        for k, v in src.items():
            kl = k.lower()
            if "weight" in kl and ("ruck" in kl or "load" in kl or "pack" in kl) and isinstance(v, (int, float)) and v > 0:
                log(f"pack weight from {k}={v}")
                return num(v / 1000 if v > 500 else v, 1)
    return ""


@step("details")
def pull_details(api, ids):
    lines = []
    for aid in ids:
        a = api.get_activity(aid) or {}
        s, m = a.get("summaryDTO") or {}, a.get("metadataDTO") or {}
        lines.append(csv_line(
            aid, num(s.get("movingDuration"), 0), num(s.get("minHR"), 0),
            num(pick(s, keys=("averageRunCadence", "averageBikingCadence", "averageBikeCadence")), 1),
            num(pick(s, keys=("maxRunCadence", "maxBikingCadence", "maxBikeCadence")), 0),
            num(s.get("avgStrideLength"), 1), num(s.get("avgGroundContactTime"), 0), num(s.get("avgVerticalOscillation"), 1),
            num(s.get("averagePower"), 0), num(s.get("maxPower"), 0), num(s.get("normalizedPower"), 0),
            num(pick(s, keys=("trainingEffect", "aerobicTrainingEffect")), 1), num(s.get("anaerobicTrainingEffect"), 1),
            s.get("trainingEffectLabel") or "", num(s.get("activityTrainingLoad"), 1),
            num(s.get("moderateIntensityMinutes"), 0), num(s.get("vigorousIntensityMinutes"), 0),
            num(s.get("elevationGain"), 0), num(s.get("elevationLoss"), 0), num(s.get("maxElevation"), 1), num(s.get("minElevation"), 1),
            num(s.get("differenceBodyBattery"), 0),
            num(pick(a, s, m, keys=("workoutFeel",)), 0), num(pick(a, s, m, keys=("workoutRpe",)), 0),
            num(s.get("maxSpeed"), 2), pack_kg(a, s, m)))
    if lines:
        ga.merge_csv("details", "\n".join(lines))
    return len(lines)


LAP_KIND = {"WARMUP": "W", "ACTIVE": "A", "RECOVERY": "R", "REST": "R", "COOLDOWN": "C"}


def f_to_c(v):
    """Garmin's activity weather comes from the METAR station in Fahrenheit,
    whatever the account's units say."""
    try:
        return round((float(v) - 32) * 5 / 9, 1)
    except (TypeError, ValueError):
        return ""


@step("weather")
def pull_weather(api, ids):
    """One station observation per outdoor activity, from the start time:
    temperature, humidity and wind, for the condition-adjusted pace."""
    lines = []
    for aid in ids:
        try:
            w = api.get_activity_weather(aid) or {}
        except Exception as err:  # no station near the route is a normal outcome
            log(f"weather {aid}: {err}")
            w = {}
        if not isinstance(w, dict) or w.get("temp") is None:
            lines.append(csv_line(aid, "", "", "", "", "", "", "", "", ""))  # remembered as "none", not re-asked
            continue
        lines.append(csv_line(
            aid, f_to_c(w.get("temp")), f_to_c(pick(w, keys=("apparentTemp",), default=w.get("temp"))),
            f_to_c(w.get("dewPoint")), num(w.get("relativeHumidity"), 0),
            num(w.get("windSpeed"), 0), num(w.get("windDirection"), 0),
            (w.get("windDirectionCompassPoint") or "").replace(",", ""),
            (pick(w.get("weatherTypeDTO"), keys=("desc",), default="") or "").replace(",", " "),
            (pick(w.get("weatherStationDTO"), keys=("name",), default="") or "").replace(",", " ")))
        time.sleep(0.3)
    if lines:
        ga.merge_csv("weather", "\n".join(lines))
    return len(lines)


@step("laps")
def pull_laps(api, ids):
    lines = []
    for aid in ids:
        laps = (api.get_activity_splits(aid) or {}).get("lapDTOs", [])
        n = 0
        for lap in laps:
            dist, dur = float(lap.get("distance") or 0), float(lap.get("duration") or 0)
            if dur < 5 and dist < 20:
                continue  # watch noise
            n += 1
            lines.append(csv_line(
                aid, n, num(dist, 0), num(dur, 0), num(lap.get("movingDuration"), 0),
                num(lap.get("averageHR"), 0), num(lap.get("maxHR"), 0),
                num(pick(lap, keys=("averageRunCadence", "averageBikingCadence", "averageBikeCadence")), 0),
                num(lap.get("averagePower"), 0), num(lap.get("elevationGain"), 0), num(lap.get("elevationLoss"), 0),
                num(lap.get("maxSpeed"), 2), LAP_KIND.get(str(lap.get("intensityType") or "").upper(), "")))
    if lines:
        ga.merge_csv("laps", "\n".join(lines))
    return len(lines)


@step("streams")
def pull_streams(api, ids, limit):
    from garminconnect import Garmin
    floors = json.load(open(os.path.join(RAW, "context.json")))["athlete"]["zoneFloors"]
    lines = []
    for aid in ids[:limit]:
        data = api.download_activity(aid, dl_fmt=Garmin.ActivityDownloadFormat.ORIGINAL)
        records = fr.records_from_fit(data)
        line = fr.process(aid, records, floors)
        if line:
            lines.append(line)
        time.sleep(1)  # be polite: these are the heaviest calls
    if lines:
        ga.merge_csv("zonekm", "\n".join(lines))
    report["new"]["streams"] = len(lines)
    return len(lines)


# ------------------------------------------------------------------ map tiles

# Tile sources, tried in order for every tile. A source answers only inside
# its coverage, so a route falls through to the first one that has it.
# Kartverket's grey-tone topographic map covers Norway in crisp detail and lets
# the coloured route stand out; USGS does the same for the United States;
# OpenStreetMap fills in everywhere else. Name, URL, deepest zoom.
#   kartverket  Norway, CC BY 4.0 ("© Kartverket"), grey topographic
#   usgs        United States, public domain (USGS The National Map), topographic
#   osm         everywhere, live use only — see README "Maps"
TILE_SOURCES = [
    ("kartverket", "https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png", 18),
    ("kartverket", "https://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo4graatone&zoom={z}&x={x}&y={y}", 18),
    ("usgs", "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}", 16),
    ("osm", "https://tile.openstreetmap.org/{z}/{x}/{y}.png", 19),
]
# OpenStreetMap's tile usage policy asks for a User-Agent that identifies the
# application and gives a way to reach its operator: put your repository's
# address here before the first pull.
TILE_AGENT = "snuggery-training-load/1.0 (personal dashboard; put your own repository URL here)"
TILES_DIR = os.path.join(os.path.dirname(HERE), "training-load", "data", "tiles")
TILE_TIMEOUT = 15
KARTVERKET_EMPTY_TILE_MD5 = "41ad1e3d34ec92311b20acb1a37ccef7"   # the tile Kartverket's cache returns outside its coverage
_unreachable = set()                                           # tile sources that failed to connect this run
MAP_W, MAP_H_MIN, MAP_H_MAX = 324, 200, 0.95   # the Route card's canvas on a phone, as app.js sizes it
MAP_PAD = 0.12                                  # extra map around the visible box, so a wider screen still has tiles
# Standing coverage around every route ever run, so a new session in a known
# area has a map before any ZIP is rebuilt: (zoom, buffer in km). The app
# scales a coarser zoom up when the exact one is not on the phone.
COVERAGE = [(13, 2.0), (14, 1.0), (15, 0.5)]
COVERAGE_PER_RUN = 300
COVERAGE_MAX_SPAN = 0.5      # degrees; a stream wider than this is not a run, it is a broken file
COVERAGE_MAX_WANTED = 5000   # tiles; the census stops here rather than enumerate a continent                          # tiles per run at most; the rest follow next hour


def map_extent(lat, lon):
    """The tile zoom and range the Route card needs for these positions,
    mirroring the fit in app.js: bounds into 84% of a 324 px wide canvas. The
    tiles are one zoom deeper than the fit, so they draw at about half size
    and stay crisp on a phone screen; the app scales by the zoom it is told."""
    mx = lambda o: (o + 180) / 360 * 256
    my = lambda a: (1 - math.log(math.tan(math.radians(a)) + 1 / math.cos(math.radians(a))) / math.pi) / 2 * 256
    xs, ys = [mx(o) for o in lon], [my(a) for a in lat]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    span_x, span_y = max(x1 - x0, 1e-6), max(y1 - y0, 1e-6)
    h = max(MAP_H_MIN, min(MAP_W * MAP_H_MAX, MAP_W * span_y / span_x + 40))
    zoom = min(17.5, math.log2(min(MAP_W * 0.84 / span_x, (h - 24) * 0.84 / span_y)))
    z = min(18, int(math.floor(zoom)) + 1)
    sc = 2 ** z
    scale = 2 ** (zoom - z)
    cx, cy = (x0 + x1) / 2 * sc, (y0 + y1) / 2 * sc
    hw, hh = MAP_W / scale * (0.5 + MAP_PAD), h / scale * (0.5 + MAP_PAD)
    n = 2 ** z
    return {"z": z,
            "x0": max(0, int((cx - hw) // 256)), "x1": min(n - 1, int((cx + hw) // 256)),
            "y0": max(0, int((cy - hh) // 256)), "y1": min(n - 1, int((cy + hh) // 256))}


def fetch_tile(z, x, y, fetch=None):
    """Store one tile; returns the source it came from, or None when it was
    already on disk. Raises if no source has it."""
    path = os.path.join(TILES_DIR, str(z), str(x), f"{y}.png")
    if os.path.exists(path):
        return None
    if fetch is not None:
        data, src = fetch(z, x, y), "test"
    else:
        import hashlib
        import requests
        data = src = None
        for name, url, deepest in TILE_SOURCES:
            if url in _unreachable or z > deepest:
                continue
            try:
                r = requests.get(url.format(z=z, x=x, y=y), headers={"User-Agent": TILE_AGENT}, timeout=TILE_TIMEOUT)
            except requests.RequestException as err:
                # One failed connection is enough: a source that is down costs
                # a timeout per tile otherwise, and a run wants 300 tiles.
                log(f"tile {z}/{x}/{y} from {name}: {err} — not asking {url.split('/')[2]} again this run")
                _unreachable.add(url)
                continue
            # Outside its coverage a server answers 404, a blank that is not an
            # image — or, Kartverket's cache, a 200 with the same 854-byte empty
            # tile everywhere (measured 2026-09-18). That one is no coverage
            # too, so a route outside Norway falls through to the next source.
            # USGS serves JPEG; the file keeps the .png name the app asks for,
            # and browsers read an image by its bytes, not its name.
            image = r.content[:8] == b"\x89PNG\r\n\x1a\n" or r.content[:3] == b"\xff\xd8\xff"
            if (r.status_code == 200 and image and len(r.content) > 200
                    and hashlib.md5(r.content).hexdigest() != KARTVERKET_EMPTY_TILE_MD5):
                data, src = r.content, name
                break
        if data is None:
            raise RuntimeError(f"tile {z}/{x}/{y}: no source had it")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(data)
    return src


@step("maps")
def pull_maps(ids, fetch=None):
    """Street tiles for each session's Route card, bundled into the app's data
    folder so the map needs no network on the phone. Fetched once per
    session; the extent is remembered in garmin-raw/maps.json and the builder
    prunes tiles no stream refers to any more."""
    maps_path = os.path.join(RAW, "maps.json")
    maps = json.load(open(maps_path)) if os.path.exists(maps_path) else {}
    sources = maps.setdefault("_tiles", {})  # "z/x/y" -> source, so a shared tile credits the right map
    fetched = 0
    for aid in ids:
        if not SAFE_ID.fullmatch(str(aid)):
            continue
        lat, lon = [], []
        with open(os.path.join(RAW, "streams", f"{aid}.csv")) as fh:
            for line in fh:
                r = line.rstrip("\n").split(",")
                if len(r) >= 9 and r[7] and r[8]:
                    lat.append(float(r[7]))
                    lon.append(float(r[8]))
        if len(lat) < 5:
            maps[aid] = None
            continue
        ext = map_extent(lat, lon)
        srcs = set()
        for x in range(ext["x0"], ext["x1"] + 1):
            for y in range(ext["y0"], ext["y1"] + 1):
                key = f"{ext['z']}/{x}/{y}"
                src = fetch_tile(ext["z"], x, y, fetch)
                if src:
                    sources[key] = src
                    fetched += 1
                    time.sleep(0.2)  # a few hundred tiles once, then a handful per new session: light use
                if sources.get(key):
                    srcs.add(sources[key])
        if srcs:
            ext["src"] = sorted(srcs)
        maps[aid] = ext
    with open(maps_path, "w") as fh:
        json.dump(maps, fh, indent=0, sort_keys=True)
        fh.write("\n")
    report["new"]["tiles"] = fetched
    return fetched


def tile_range(lat, lon, z, buffer_km):
    """Tile indices at zoom z covering these positions plus a buffer."""
    dlat = buffer_km / 111.0
    dlon = buffer_km / (111.0 * math.cos(math.radians(sum(lat) / len(lat))))
    lo0, lo1 = min(lon) - dlon, max(lon) + dlon
    la0, la1 = min(lat) - dlat, max(lat) + dlat
    n = 2 ** z
    ty = lambda a: int((1 - math.log(math.tan(math.radians(a)) + 1 / math.cos(math.radians(a))) / math.pi) / 2 * n)
    return range(max(0, int((lo0 + 180) / 360 * n)), min(n - 1, int((lo1 + 180) / 360 * n)) + 1), range(max(0, ty(la1)), min(n - 1, ty(la0)) + 1)


@step("coverage")
def pull_coverage(fetch=None):
    """Fill in the standing coverage around every stored route (see COVERAGE).
    Idempotent: only tiles not yet on disk are fetched, a bounded number per
    run, and every tile is recorded in maps.json so nothing prunes it."""
    maps_path = os.path.join(RAW, "maps.json")
    maps = json.load(open(maps_path)) if os.path.exists(maps_path) else {}
    sources = maps.setdefault("_tiles", {})
    wanted = {}
    for path in glob.glob(os.path.join(RAW, "streams", "*.csv")):
        lat, lon = [], []
        with open(path) as fh:
            for line in fh:
                r = line.rstrip("\n").split(",")
                if len(r) >= 9 and r[7] and r[8]:
                    lat.append(float(r[7]))
                    lon.append(float(r[8]))
        if len(lat) < 5:
            continue
        if max(lat) - min(lat) > COVERAGE_MAX_SPAN or max(lon) - min(lon) > COVERAGE_MAX_SPAN:
            log(f"coverage: {os.path.basename(path)} spans more than {COVERAGE_MAX_SPAN}°, skipped")
            continue
        for z, buf in COVERAGE:
            xs, ys = tile_range(lat, lon, z, buf)
            for x in xs:
                for y in ys:
                    wanted[f"{z}/{x}/{y}"] = (z, x, y)
        if len(wanted) > COVERAGE_MAX_WANTED:
            log(f"coverage: more than {COVERAGE_MAX_WANTED} tiles wanted, census stopped")
            break
    fetched = 0
    missing = [k for k in sorted(wanted) if not os.path.exists(os.path.join(TILES_DIR, *k.split("/")[:2], k.split("/")[2] + ".png"))]
    for key in missing[:COVERAGE_PER_RUN]:
        z, x, y = wanted[key]
        src = fetch_tile(z, x, y, fetch)
        if src:
            sources[key] = src
            fetched += 1
            time.sleep(0.2)
    # Tiles already on disk from a session fit join the inventory too, credited
    # to the source that session's map recorded.
    fit_src = {}
    for aid, m in maps.items():
        if aid != "_tiles" and isinstance(m, dict) and m.get("src"):
            for x in range(m["x0"], m["x1"] + 1):
                for y in range(m["y0"], m["y1"] + 1):
                    fit_src[f"{m['z']}/{x}/{y}"] = m["src"][0]
    for key, (z, x, y) in wanted.items():
        if key not in sources and os.path.exists(os.path.join(TILES_DIR, str(z), str(x), f"{y}.png")):
            sources[key] = fit_src.get(key, "kartverket")
    with open(maps_path, "w") as fh:
        json.dump(maps, fh, indent=0, sort_keys=True)
        fh.write("\n")
    report["new"]["coverage"] = fetched
    if len(missing) > COVERAGE_PER_RUN:
        log(f"coverage: {len(missing) - COVERAGE_PER_RUN} tiles still to fetch on later runs")
    return fetched


# ------------------------------------------------------------------ daily rows

def status_bits(j):
    """The pieces of a training-status response the app uses."""
    ts = ((j or {}).get("mostRecentTrainingStatus") or {}).get("latestTrainingStatusData") or {}
    ts = next(iter(ts.values()), {}) if isinstance(ts, dict) else {}
    acute = ts.get("acuteTrainingLoadDTO") or {}
    vo2 = ((j or {}).get("mostRecentVO2Max") or {}).get("generic") or {}
    bal = ((j or {}).get("mostRecentTrainingLoadBalance") or {}).get("metricsTrainingLoadBalanceDTOMap") or {}
    bal = next(iter(bal.values()), {}) if isinstance(bal, dict) else {}
    return ts, acute, vo2, bal


@step("load")
def pull_load(api, today, days):
    lines = []
    for back in range(days, -1, -1):
        d = (today - dt.timedelta(days=back)).isoformat()
        ts, acute, vo2, _ = status_bits(api.get_training_status(d))
        if not acute:
            continue
        lines.append(csv_line(d, num(acute.get("dailyTrainingLoadAcute"), 0), num(acute.get("dailyTrainingLoadChronic"), 0),
                              ts.get("trainingStatusFeedbackPhrase") or "", num(vo2.get("vo2MaxValue"), 0)))
        time.sleep(0.3)
    if lines:
        ga.merge_csv("load", "\n".join(lines))
    return len(lines)


@step("sleep")
def pull_sleep(api, today, days):
    lines = []
    for back in range(days, -1, -1):
        d = (today - dt.timedelta(days=back)).isoformat()
        j = api.get_sleep_data(d) or {}
        s = j.get("dailySleepDTO") or {}
        secs = s.get("sleepTimeSeconds")
        if not secs:
            continue
        score = ((s.get("sleepScores") or {}).get("overall") or {}).get("value")
        deep, rem = float(s.get("deepSleepSeconds") or 0), float(s.get("remSleepSeconds") or 0)
        hrv = pick(j, s, keys=("avgOvernightHrv",))
        lines.append(csv_line(d, num(score, 0), num(secs / 3600, 2), num(100 * deep / secs, 1), num(100 * rem / secs, 1),
                              num(hrv, 0), num(s.get("avgSleepStress"), 0)))
        time.sleep(0.3)
    if lines:
        ga.merge_csv("sleep", "\n".join(lines))
    return len(lines)


def hms(seconds):
    if seconds is None:
        return None
    seconds = int(round(float(seconds)))
    h, m, s = seconds // 3600, (seconds % 3600) // 60, seconds % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


@step("garminNow")
def pull_now(api, ctx, today):
    d = today.isoformat()
    ts, acute, vo2, bal = status_bits(api.get_training_status(d))
    ready = api.get_training_readiness(d) or []
    if isinstance(ready, dict):
        ready = [ready]
    ready = sorted(ready, key=lambda r: r.get("timestamp") or "")
    r = ready[-1] if ready else {}
    preds = api.get_race_predictions() or {}
    if isinstance(preds, list):
        preds = preds[-1] if preds else {}
    g = ctx.setdefault("garminNow", {})
    g.update({
        "date": d, "trainingStatus": ts.get("trainingStatusFeedbackPhrase") or g.get("trainingStatus"),
        "sport": ts.get("sport") or g.get("sport"),
        "acuteLoad": acute.get("dailyTrainingLoadAcute", g.get("acuteLoad")),
        "chronicLoad": acute.get("dailyTrainingLoadChronic", g.get("chronicLoad")),
        "optimalMin": acute.get("minTrainingLoadChronic", g.get("optimalMin")),
        "optimalMax": acute.get("maxTrainingLoadChronic", g.get("optimalMax")),
        "loadRatio": acute.get("dailyAcuteChronicWorkloadRatio", g.get("loadRatio")),
        "acwrStatus": acute.get("acwrStatus", g.get("acwrStatus")),
        "vo2max": vo2.get("vo2MaxPreciseValue", vo2.get("vo2MaxValue", g.get("vo2max"))),
        "monthlyLoadAerobicLow": round(float(bal.get("monthlyLoadAerobicLow") or 0), 1) or g.get("monthlyLoadAerobicLow"),
        "monthlyLoadAerobicHigh": round(float(bal.get("monthlyLoadAerobicHigh") or 0), 1) or g.get("monthlyLoadAerobicHigh"),
        "monthlyLoadAnaerobic": round(float(bal.get("monthlyLoadAnaerobic") or 0), 1) or g.get("monthlyLoadAnaerobic"),
        "balanceFeedback": bal.get("trainingBalanceFeedbackPhrase") or g.get("balanceFeedback"),
    })
    if r:
        rec = r.get("recoveryTime")
        g["readiness"] = {
            "score": r.get("score"), "level": r.get("level"), "feedback": r.get("feedbackShort"),
            "sleepScore": r.get("sleepScore"),
            "recoveryHours": round(float(rec) / 60, 1) if rec is not None and float(rec) > 100 else rec,
            "hrvWeeklyAvg": r.get("hrvWeeklyAverage"), "hrvFeedback": r.get("hrvFactorFeedback"),
            "stressHistoryPercent": r.get("stressHistoryFactorPercent"), "sleepHistoryPercent": r.get("sleepHistoryFactorPercent"),
        }
    if preds:
        g["racePredictions"] = {
            "5K": hms(preds.get("time5K")), "10K": hms(preds.get("time10K")),
            "half": hms(preds.get("timeHalfMarathon")), "marathon": hms(preds.get("timeMarathon")),
        }
    try:
        lt = api.get_lactate_threshold() or {}

        def find_bpm(node):  # the shape of this response is not documented; look for any heart-rate key
            if isinstance(node, dict):
                for k, v in node.items():
                    if isinstance(v, (int, float)) and 100 < v < 220 and re.search(r"heart.?rate|bpm", k, re.I):
                        return v
                for v in node.values():
                    hit = find_bpm(v)
                    if hit:
                        return hit
            elif isinstance(node, list):
                for v in node:
                    hit = find_bpm(v)
                    if hit:
                        return hit
            return None
        bpm = find_bpm(lt)
        if bpm:
            g["lthr"] = int(round(float(bpm)))
        else:
            report["warnings"].append("lactate threshold: no heart-rate field found in the response")
    except Exception as err:
        report["warnings"].append(f"lactate threshold: {err}")
    return g


@step("calendar")
def pull_calendar(api, today):
    events = []
    y, m = today.year, today.month
    for k in range(CALENDAR_MONTHS):
        yy, mm = y + (m - 1 + k) // 12, (m - 1 + k) % 12 + 1
        j = api.connectapi(f"/calendar-service/year/{yy}/month/{mm - 1}") or {}
        for it in j.get("calendarItems") or []:
            if it.get("itemType") not in ("event", "race"):
                continue
            events.append({k2: it.get(k2) for k2 in ("title", "date", "itemType", "eventType", "isRace", "raceType",
                                                       "distance", "distanceMeters", "startTimeLocal", "location", "primaryEvent") if it.get(k2) is not None})
    seen, unique = set(), []
    for e in events:
        key = (e.get("title"), e.get("date"))
        if key not in seen and (e.get("date") or "") >= today.isoformat():
            seen.add(key)
            unique.append(e)
    events = unique
    with open(os.path.join(RAW, "calendar.json"), "w") as fh:
        json.dump({"pulledAt": today.isoformat(), "events": events}, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    return len(events)


INTRADAY_HOURS = 36     # what is kept; the app shows the last 24


@step("intraday")
def pull_intraday(api, today):
    """Heart rate, body battery and stress through the day, every few minutes.
    Kept as a rolling window in garmin-raw/intraday.json — replaced on every
    pull, never appended — because it is a live readout, not history."""
    now = dt.datetime.now(dt.timezone.utc)
    keep_from = int((now - dt.timedelta(hours=INTRADAY_HOURS)).timestamp())
    hr, bb, stress = {}, {}, {}
    resting = None
    for back in (1, 0):
        d = (today - dt.timedelta(days=back)).isoformat()
        j = api.get_heart_rates(d) or {}
        for pt in j.get("heartRateValues") or []:
            if pt and len(pt) >= 2 and pt[0] and pt[1] is not None:
                hr[int(pt[0] // 1000)] = int(pt[1])
        if back == 0:
            resting = j.get("restingHeartRate")
        st = api.get_stress_data(d) or {}
        for pt in st.get("stressValuesArray") or []:
            if pt and len(pt) >= 2 and pt[0] and pt[1] is not None and pt[1] >= 0:
                stress[int(pt[0] // 1000)] = int(pt[1])
        for pt in st.get("bodyBatteryValuesArray") or []:
            # [ts, "MEASURED", level, version] on the stress endpoint; [ts, level] elsewhere
            if not pt or not pt[0]:
                continue
            level = pt[2] if len(pt) >= 3 and isinstance(pt[2], (int, float)) else (pt[1] if len(pt) >= 2 and isinstance(pt[1], (int, float)) else None)
            if level is not None:
                bb[int(pt[0] // 1000)] = int(level)
        time.sleep(0.3)
    if not bb:
        for day in api.get_body_battery((today - dt.timedelta(days=1)).isoformat(), today.isoformat()) or []:
            for pt in day.get("bodyBatteryValuesArray") or []:
                if pt and len(pt) >= 2 and pt[0] and pt[1] is not None:
                    bb[int(pt[0] // 1000)] = int(pt[1])
    trim = lambda series: [[t, v] for t, v in sorted(series.items()) if t >= keep_from]
    out = {"pulledAt": report["pulledAt"], "restingHr": resting, "hr": trim(hr), "bb": trim(bb), "stress": trim(stress)}
    with open(os.path.join(RAW, "intraday.json"), "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
        fh.write("\n")
    report["new"]["intradayPoints"] = len(out["hr"])
    return out


# ------------------------------------------------------------------ build, commit, push

def build():
    out = subprocess.run([sys.executable, os.path.join(HERE, "build_garmin_snapshot.py")], capture_output=True, text=True)
    log(out.stdout.strip().splitlines()[-1] if out.stdout.strip() else "build produced no output")
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip()[-500:])
    return "assessment=yes" in out.stdout


def git(*args, check=True):
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True, check=check)


def push():
    git("add", "garmin-raw", "training-load/data")
    if not git("diff", "--staged", "--quiet", check=False).returncode:
        log("nothing changed — nothing to commit")
        return
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    git("commit", "-q", "-m", f"training: data pull {stamp}")
    for i in range(1, 5):
        if git("push", "origin", "HEAD:main", check=False).returncode == 0:
            log("pushed to main")
            return
        time.sleep(2 ** i)
        if git("pull", "--rebase", "-X", "theirs", "origin", "main", check=False).returncode != 0:
            git("rebase", "--abort", check=False)
            raise RuntimeError("push rejected and the rebase failed; left the commit local")
    raise RuntimeError("push failed four times")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--login", action="store_true", help="interactive first sign-in (handles MFA) and store the tokens")
    ap.add_argument("--export-tokens", action="store_true", help="print the stored tokens as one line, to paste into a GARMINTOKENS secret")
    ap.add_argument("--push", action="store_true", help="commit garmin-raw and the snapshot and push to main")
    ap.add_argument("--streams", type=int, default=STREAMS_PER_RUN, help="record streams to pull this run (newest first)")
    ap.add_argument("--full", action="store_true", help="re-pull the full two-week load and sleep window (otherwise only in the %d:00 UTC hour)" % FULL_HOUR_UTC)
    ap.add_argument("--no-build", action="store_true")
    args = ap.parse_args()

    api = connect(interactive=args.login)
    if args.login:
        log("login stored; run again without --login to pull, or --export-tokens for a GitHub secret")
        return 0
    if args.export_tokens:
        print(api.client.dumps())
        return 0

    today = dt.date.today()
    report["pulledAt"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    ctx_path = os.path.join(RAW, "context.json")
    ctx = json.load(open(ctx_path))

    pull_activities(api, today)
    m = ga.missing()
    pull_zones(api, m["zones"])
    pull_gear(api, m["gear"], ctx)
    pull_splits(api, m["splits"])
    pull_details(api, m["details"])
    pull_laps(api, m["laps"])
    pull_weather(api, m["weather"])
    newest_first = sorted(m["zonekm"], key=lambda i: m["dates"].get(i, ""), reverse=True)
    pull_streams(api, newest_first, args.streams)
    pull_maps(ga.missing()["maps"])
    pull_coverage()
    full = args.full or dt.datetime.now(dt.timezone.utc).hour == FULL_HOUR_UTC
    report["window"] = "full" if full else "quick"
    pull_load(api, today, LOAD_DAYS if full else QUICK_DAYS)
    pull_sleep(api, today, SLEEP_DAYS if full else QUICK_DAYS)
    pull_now(api, ctx, today)
    pull_intraday(api, today)
    if full or not os.path.exists(os.path.join(RAW, "calendar.json")):
        pull_calendar(api, today)  # seven monthly calls; once a day is plenty for a race list

    with open(ctx_path, "w") as fh:
        json.dump(ctx, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    report["ok"] = all(v == "ok" for k, v in report["steps"].items() if k in ("activities", "load", "sleep", "garminNow"))
    with open(os.path.join(RAW, "pull.json"), "w") as fh:
        json.dump(report, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    log("steps: " + ", ".join(f"{k}={v if v == 'ok' else 'ERROR'}" for k, v in report["steps"].items()))

    if not args.no_build:
        build()
    if args.push:
        push()
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
