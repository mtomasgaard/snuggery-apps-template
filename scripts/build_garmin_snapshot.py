#!/usr/bin/env python3
"""Build training-load/data/snapshot.json from the raw Garmin dumps.

scripts/garmin_pull.py pulls what is new from Garmin Connect into garmin-raw/
(append-only) and then runs this script. Keeping the aggregation here rather than
in whatever pulled the data means the numbers are reproducible: re-running on
unchanged raw files produces an identical snapshot apart from `generatedAt`.
The demo data shipped with the template is built the same way, by
scripts/make_demo_training_load.py, so it can never drift from this shape.

The snapshot also carries a top-level `ask` array — flat rows Snuggery's Ask reads
as a table (see ask_rows below); nothing in the app draws from it.

Raw inputs (all in garmin-raw/, all append-only):

  activities.json   list of activity summaries, oldest first. Fields come
                    straight from Garmin's activity list endpoint.
  zones.csv         id,z1,z2,z3,z4,z5   seconds in each HR zone
  gear.csv          id,codes            "|"-separated gear codes, or "-" for none
  garmin_load.csv   date,atl,ctl,status,vo2   Garmin's own acute/chronic load
  sleep.csv         date,score,hours,deep%,rem%,hrv,stress
  splits.csv        id,runSec,runM,runHr,walkSec,walkM,walkHr,standSec
                    Garmin's run/walk detection for outdoor runs: the seconds,
                    metres and average HR spent actually running versus walking
                    inside one session. Absent for treadmill runs and for
                    anything that is not a run.
  zonekm.csv        id,z1,z2,z3,z4,z5,z0   kilometres run in each HR zone, from
                    the per-second FIT record stream (scripts/fit_records.py),
                    the last value the kilometres run below the zone 1 floor;
                    attached as `zk` (six values).
  weather.csv       id,tempC,apparentC,dewC,humidity,windKmh,windDeg,compass,desc,station
                    the station observation Garmin attaches to an outdoor
                    activity; attached as `wx` and used for the wind and heat
                    part of the condition-adjusted pace.
  streams/<id>.csv  sec,distM,hr,spdMps,cad,altM,pwr,lat,lon   one row per second,
                    from the same record stream. Downsampled to at most 360
                    points and written to training-load/data/streams/<id>.json
                    for the Sessions pane (and embedded under `streams` in the
                    snapshot for the last three weeks of sessions, since the
                    Shortcut replaces only the snapshot), with `lat`/`lon` for the route map
                    (and `map`, the zoom and tile range bundled under
                    training-load/data/tiles from garmin-raw/maps.json),
                    `gap` (grade-adjusted pace, runs
                    with altitude) and `cap` (condition-adjusted pace: grade,
                    wind along the heading and heat, runs with position and
                    weather); the activity gets `stream: true`.
  details.csv       id,movSec,minHr,cad,maxCad,strideCm,gctMs,voCm,pwr,maxPwr,normPwr,te,anTe,
                    teLabel,load,modMin,vigMin,elevGain,elevLoss,maxElev,minElev,bodyBattery,
                    feel,rpe,maxSpeedMps,packKg   — per-activity summary from get_activity
                    (packKg: the pack weight Garmin records for a rucking session)
  laps.csv          id,lap,distM,durSec,movSec,avgHr,maxHr,cad,pwr,elevGain,elevLoss,
                    maxSpeedMps,kind      — one row per lap from get_activity_splits
                    (kind: W warm-up, A work, R recovery, C cool-down, blank = auto lap)
                    Both are only fetched for the last DETAIL_DAYS and only attached to
                    activities inside that window, so the snapshot does not grow with
                    the whole history.
  notes.json        {"<id>": {"written","verdict","tone","body":[...]}} — the
                    per-session evaluation the optional agent routine writes for every new
                    session; attached to the activity as `note`
  racecast.json     the agent's own race predictions with their anchors, basis
                    and update policy; attached as `racecast`
  plan.json         the agent's training plan for the rest of this week and the
                    next; attached as `plan`
  intraday.json     heart rate, body battery and stress samples through the last
                    36 hours, from the hourly pull; the last 24 h attached as
                    `intraday` {pulledAt, restingHr, hr:[[sec,bpm]], bb:[[sec,level]],
                    stress:[[sec,level]]}
  context.json      profile, gear catalogue, and today's Garmin readouts
  assessment.json   the coaching evaluation, rewritten by the agent each run

Everything the app plots is derived from `activities`, so a filter in the app
(date window, sport, gear) re-aggregates rather than asking for a new file.
"""

import argparse
import csv
import json
import math
import os
import re
import sys
from datetime import datetime, timedelta, timezone

SAFE_ID = re.compile(r"[A-Za-z0-9_-]+")  # an activity id becomes a file name; nothing else may

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "garmin-raw")
OUT = os.path.join(ROOT, "training-load", "data", "snapshot.json")

# Garmin's activity types collapse to the handful of sports that actually get
# trained here. Anything unrecognised lands in "other" rather than vanishing.
SPORT = {
    "running": "run",
    "treadmill_running": "run",
    "trail_running": "run",
    "cycling": "bike",
    "indoor_cycling": "bike",
    "virtual_ride": "bike",
    "strength_training": "strength",
    "elliptical": "elliptical",
    "walking": "walk",
    "hiking": "walk",
    "rucking": "walk",   # a hike with a weighted pack
    "indoor_rowing": "row",
    "lap_swimming": "swim",
    "open_water_swimming": "swim",
}

INDOOR = {"treadmill_running", "indoor_cycling", "elliptical", "indoor_rowing", "strength_training"}

# Per-activity detail (summary stats and laps) is kept for this many days
# before the newest activity. Keep in step with garmin_append.DETAIL_DAYS.
DETAIL_DAYS = 183
DETAIL_KEYS = ["mov", "minHr", "cad", "maxCad", "stride", "gct", "vo", "pwr", "maxPwr", "np",
               "te", "anTe", "teLabel", "load", "modMin", "vigMin", "elevGain", "elevLoss",
               "maxElev", "minElev", "bb", "feel", "rpe", "maxSpd", "packKg"]


MAX_STREAM_POINTS = 360
RECENT_STREAM_DAYS = 21   # streams of sessions this recent are embedded in the snapshot as well
WALK_MPS = 1.6


def running_cost(grade):
    """Metabolic cost of running per metre at a grade (Minetti et al. 2002),
    J/kg/m; the ratio to the flat cost turns a pace into grade-adjusted pace."""
    i = max(-0.3, min(0.3, grade))
    return 155.4 * i**5 - 30.4 * i**4 - 43.3 * i**3 + 46.3 * i**2 + 19.5 * i + 3.6


def grades(d, alt):
    """Grade per bin from cumulative km and altitude (m). Altitude is smoothed
    over five bins first because the barometer jitters by a metre or two, which
    over 30 m is a 5% grade. None where there is no altitude or no distance."""
    n = len(d)
    if n < 5 or not any(a is not None for a in alt):
        return None
    sm = []
    for i in range(n):
        w = [alt[j] for j in range(max(0, i - 2), min(n, i + 3)) if alt[j] is not None]
        sm.append(sum(w) / len(w) if w else None)
    out = []
    for i in range(n):
        lo, hi = max(0, i - 1), min(n - 1, i + 1)
        dist = (d[hi] - d[lo]) * 1000
        out.append(None if sm[lo] is None or sm[hi] is None or dist < 5 else (sm[hi] - sm[lo]) / dist)
    return out


def grade_adjusted(pc, d, alt):
    """Grade-adjusted pace per bin from bin pace (min/km), cumulative km and
    altitude (m): the flat pace with the same metabolic cost per metre."""
    g = grades(d, alt)
    if not g:
        return None
    flat = running_cost(0.0)
    out = [None if pc[i] is None or g[i] is None else round(pc[i] * flat / running_cost(g[i]), 2) for i in range(len(pc))]
    return out if any(v is not None for v in out) else None


def headings(lat, lon):
    """Direction of travel per bin, degrees clockwise from north, from the
    positions one bin either side. None where the positions are missing."""
    n = len(lat)
    out = []
    for i in range(n):
        lo, hi = max(0, i - 1), min(n - 1, i + 1)
        if lo == hi or lat[lo] is None or lat[hi] is None or lon[lo] is None or lon[hi] is None:
            out.append(None)
            continue
        p1, p2 = math.radians(lat[lo]), math.radians(lat[hi])
        dl = math.radians(lon[hi] - lon[lo])
        y = math.sin(dl) * math.cos(p2)
        x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
        if abs(x) < 1e-12 and abs(y) < 1e-12:
            out.append(None)
            continue
        out.append(math.degrees(math.atan2(y, x)) % 360)
    return out


DRAG = 0.5 * 1.2 * 0.45   # ½ · air density · drag area of a runner, kg/m
HEAT_FROM_C = 15.0        # apparent temperature above which the heat penalty starts
HEAT_PER_C = 0.003        # pace penalty per °C above that
DEW_FROM_C = 12.0         # dew point above which humidity adds to it
DEW_PER_C = 0.0015


def heat_penalty(wx):
    """Fraction slower a steady effort runs in the session's heat and humidity:
    zero on a cool day, 0.3% per °C of apparent temperature above 15 °C plus
    0.15% per °C of dew point above 12 °C, capped at 15%. Coarse, from the
    marathon-slowdown literature, and applied evenly across the session."""
    if not wx or wx.get("at") is None:
        return 0.0
    h = HEAT_PER_C * max(0.0, wx["at"] - HEAT_FROM_C)
    if wx.get("dp") is not None:
        h += DEW_PER_C * max(0.0, wx["dp"] - DEW_FROM_C)
    return min(0.15, h)


def condition_adjusted(pc, d, alt, lat, lon, wx, mass):
    """Condition-adjusted pace per bin: the flat, still-air, cool-day pace with
    the same metabolic power as the pace actually run, given the grade, the
    wind along the direction of travel and the day's heat. Per metre the cost
    is the Minetti running cost at the grade plus air drag on the air speed
    (drag area 0.45 m², the athlete's mass); the equivalent pace solves the
    same power on the flat in still air, then the heat penalty is taken off.
    Returns (pace list, headwind list in m/s) or (None, None)."""
    g = grades(d, alt)
    if not g or not wx or wx.get("w") is None or wx.get("wd") is None:
        return None, None
    hd = headings(lat, lon)
    if not any(h is not None for h in hd):
        return None, None
    wind = wx["w"] / 3.6
    k = DRAG / mass
    flat = running_cost(0.0)
    heat = heat_penalty(wx)
    out, head = [], []
    for i in range(len(pc)):
        if pc[i] is None or g[i] is None or hd[i] is None:
            out.append(None)
            head.append(None)
            continue
        hw = wind * math.cos(math.radians(wx["wd"] - hd[i]))  # + against the runner
        v = 1000 / (pc[i] * 60)
        va = v + hw
        power = (running_cost(g[i]) + k * va * abs(va)) * v
        ve = v
        for _ in range(6):  # Newton on (flat + k·ve²)·ve = power; monotone, converges fast
            f = (flat + k * ve * ve) * ve - power
            ve -= f / (flat + 3 * k * ve * ve)
        ve *= 1 + heat
        out.append(round(1000 / ve / 60, 2) if ve > 0.3 else None)
        head.append(round(hw, 1))
    if not any(v is not None for v in out):
        return None, None
    return out, head


def write_streams(ids, sports, weather, mass):
    """Downsample each per-second stream to at most MAX_STREAM_POINTS bins and
    write it as compact JSON arrays for the Sessions pane. Stale files for
    sessions that left the detail window are removed."""
    out_dir = os.path.join(os.path.dirname(OUT), "streams")
    os.makedirs(out_dir, exist_ok=True)
    keep = set()
    maps_path = os.path.join(RAW, "maps.json")
    maps = json.load(open(maps_path)) if os.path.exists(maps_path) else {}
    inventory = maps.pop("_tiles", {})  # every tile on disk, with its source
    used = set()
    for aid in ids:
        if not SAFE_ID.fullmatch(str(aid)):
            continue  # an id is a file name below; nothing but a plain token may become one
        rows = []
        with open(os.path.join(RAW, "streams", f"{aid}.csv"), newline="") as fh:
            for r in csv.reader(fh):
                if len(r) < 6 or not r[0]:
                    continue
                f = lambda v: float(v) if v not in ("", None) else None
                r = r + [""] * (9 - len(r))
                rows.append((int(r[0]), f(r[1]), f(r[2]), f(r[3]), f(r[4]), f(r[5]), f(r[6]), f(r[7]), f(r[8])))
        if len(rows) < 10:
            continue
        k = -(-len(rows) // MAX_STREAM_POINTS)  # ceil
        bike = sports.get(aid) == "bike"
        walk = sports.get(aid) == "walk"   # a hike: pace is walking pace, and no run-cost adjustment
        slow = 0.5 if bike or walk else WALK_MPS
        t, d, hr, pc, cad, alt, spd_kmh, pw, lat, lon = [], [], [], [], [], [], [], [], [], []
        mean = lambda xs: sum(xs) / len(xs) if xs else None
        for i in range(0, len(rows), k):
            b = rows[i:i + k]
            sec0, sec1 = b[0][0], b[-1][0]
            d0, d1 = b[0][1], b[-1][1]
            t.append(sec0)
            d.append(round((d1 or 0) / 1000, 3))
            hrs = [x[2] for x in b if x[2]]
            hr.append(round(sum(hrs) / len(hrs)) if hrs else None)
            # The watch's own smoothed speed, averaged over the bin. Pace only where
            # it would call it running; a walk break or a standstill would
            # otherwise pull the axis to 20 min/km.
            spds = [x[3] for x in b if x[3] is not None]
            spd = sum(spds) / len(spds) if spds else None
            pc.append(round(1000 / spd / 60, 2) if spd and spd >= slow and not bike else None)
            spd_kmh.append(round(spd * 3.6, 1) if spd and spd >= slow else None)
            pws = [x[6] for x in b if x[6]]
            pw.append(round(sum(pws) / len(pws)) if pws else None)
            cads = [x[4] for x in b if x[4]]
            cad.append(round(sum(cads) / len(cads)) if cads else None)
            alts = [x[5] for x in b if x[5] is not None]
            alt.append(round(sum(alts) / len(alts), 1) if alts else None)
            lat.append(mean([x[7] for x in b if x[7] is not None]))
            lon.append(mean([x[8] for x in b if x[8] is not None]))
        with open(os.path.join(out_dir, f"{aid}.json"), "w") as fh:
            out = {"id": aid, "n": len(rows), "t": t, "d": d, "hr": hr, "p": pc, "v": spd_kmh, "cad": cad, "alt": alt}
            if any(pw):
                out["pw"] = pw
            if any(v is not None for v in lat):
                out["lat"] = [None if v is None else round(v, 5) for v in lat]
                out["lon"] = [None if v is None else round(v, 5) for v in lon]
                if maps.get(aid):
                    out["map"] = maps[aid]
                    used.add(aid)
            if not bike and not walk:
                gap = grade_adjusted(pc, d, alt)
                if gap:
                    out["gap"] = gap
                wx = weather.get(aid)
                cap, head = condition_adjusted(pc, d, alt, lat, lon, wx, mass)
                if cap:
                    out["cap"] = cap
                    out["head"] = head
                    hws = [h for h in head if h is not None]
                    out["cond"] = {"heat": round(heat_penalty(wx) * 100, 1), "head": round(sum(hws) / len(hws), 1)}
            json.dump(out, fh, separators=(",", ":"))
        keep.add(f"{aid}.json")
    for name in os.listdir(out_dir):
        if name.endswith(".json") and name not in keep:
            os.remove(os.path.join(out_dir, name))
    prune_tiles({aid: maps[aid] for aid in used}, inventory)
    return sorted(inventory)


def prune_tiles(maps, inventory):
    """Drop tiles under data/tiles that neither a current stream's map nor the
    standing coverage (the inventory in maps.json) refers to."""
    tiles_dir = os.path.join(os.path.dirname(OUT), "tiles")
    if not os.path.isdir(tiles_dir):
        return
    wanted = {tuple(k.split("/")[:2]) + (k.split("/")[2] + ".png",) for k in inventory}
    for m in maps.values():
        for x in range(m["x0"], m["x1"] + 1):
            for y in range(m["y0"], m["y1"] + 1):
                wanted.add((str(m["z"]), str(x), f"{y}.png"))
    for z in os.listdir(tiles_dir):
        for x in os.listdir(os.path.join(tiles_dir, z)):
            for y in os.listdir(os.path.join(tiles_dir, z, x)):
                if (z, x, y) not in wanted:
                    os.remove(os.path.join(tiles_dir, z, x, y))
            if not os.listdir(os.path.join(tiles_dir, z, x)):
                os.rmdir(os.path.join(tiles_dir, z, x))
        if not os.listdir(os.path.join(tiles_dir, z)):
            os.rmdir(os.path.join(tiles_dir, z))


def weather_row(r):
    """weather.csv: id,tempC,apparentC,dewC,humidity%,windKmh,windDeg,compass,description,station.
    An empty row means Garmin had no station for that session."""
    r = (r + [""] * 10)[:10]
    if r[1] == "":
        return r[0], None
    wx = {"t": num(r[1]), "at": num(r[2]), "dp": num(r[3]), "h": num(r[4]), "w": num(r[5]), "wd": num(r[6])}
    if r[7]:
        wx["wc"] = r[7]
    if r[8]:
        wx["desc"] = r[8]
    return r[0], {k: v for k, v in wx.items() if v is not None}


def athlete_mass():
    try:
        return float(json.load(open(os.path.join(RAW, "context.json")))["athlete"].get("weightKg") or 75)
    except Exception:
        return 75.0


def read_csv(name, cast):
    path = os.path.join(RAW, name)
    if not os.path.exists(path):
        return {}
    out = {}
    with open(path, newline="") as fh:
        for row in csv.reader(fh):
            if not row or not row[0].strip():
                continue
            key, value = cast(row)
            out[key] = value
    return out


def num(value, default=None):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


ASK_SESSION_DAYS = 60   # one row per session for the last two months
ASK_WEEK_LIMIT = 52     # one row per ISO week, newest 52


def ask_rows(activities, load, sleep, context):
    """The flat table Snuggery's Ask reads — the top-level `ask` array.

    Not for drawing: for a person's question in words ("how far did I run
    last week", "what was my longest run", "what is my training status").
    Counts, totals and extremes are worked out by the app from these rows,
    never guessed from the raw snapshot. Three kinds of row, told apart by
    `row`: one `session` per activity in the last ASK_SESSION_DAYS, one
    `week` per ISO week (newest ASK_WEEK_LIMIT), and one `status` row from
    today's Garmin readouts. Every value is a number or a short string.
    """
    names = {g.get("code"): g.get("name") for g in context.get("gear") or []}
    weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    rows = []
    if activities:
        newest = datetime.fromisoformat(activities[-1]["d"]).date()
        cutoff = (newest - timedelta(days=ASK_SESSION_DAYS)).isoformat()
        for a in activities:
            if a["d"] < cutoff:
                continue
            z = a.get("z") or [0, 0, 0, 0, 0]
            km = a.get("runKm") if a.get("runKm") else a["km"]
            minutes = a.get("runMin") if a.get("runMin") else a.get("movMin") or a["min"]
            pace = None
            if a["sport"] == "run" and km and minutes:
                p = minutes / km
                pace = f"{int(p)}:{int(round((p - int(p)) * 60)):02d}"
            rows.append({
                "row": "session",
                "date": a["d"],
                "weekday": weekday[datetime.fromisoformat(a["d"]).weekday()],
                "sport": a["sport"],
                "type": a["type"],
                "name": a.get("name") or "",
                "km": round(a["km"], 2),
                "minutes": round(a.get("movMin") or a["min"], 1),
                "avgHr": a.get("hr"),
                "maxHr": a.get("hrMax"),
                "pace": pace,
                "elevM": a.get("elev", 0),
                "easyMin": round((z[0] + z[1]) / 60, 1),
                "moderateMin": round(z[2] / 60, 1),
                "hardMin": round((z[3] + z[4]) / 60, 1),
                "load": round(sum(z[i] / 60 * (i + 1) for i in range(5))),
                "gear": " + ".join(names.get(c, c) for c in a.get("g") or []),
                "indoor": bool(a.get("indoor")),
                "race": bool(a.get("race")),
            })
    # Weeks, Monday to Sunday, newest last.
    by_week = {}
    for a in activities:
        d = datetime.fromisoformat(a["d"]).date()
        monday = (d - timedelta(days=d.weekday())).isoformat()
        by_week.setdefault(monday, []).append(a)
    sleep_by_week, load_by_week = {}, {}
    for r in sleep:
        d = datetime.fromisoformat(r["d"]).date()
        sleep_by_week.setdefault((d - timedelta(days=d.weekday())).isoformat(), []).append(r)
    for r in load:
        d = datetime.fromisoformat(r["d"]).date()
        load_by_week.setdefault((d - timedelta(days=d.weekday())).isoformat(), []).append(r)
    weeks = []
    for monday in sorted(by_week)[-ASK_WEEK_LIMIT:]:
        acts = by_week[monday]
        runs = [a for a in acts if a["sport"] == "run"]
        walks = [a for a in acts if a["sport"] == "walk"]
        z = [sum((a.get("z") or [0] * 5)[i] for a in acts) for i in range(5)]
        total = sum(z) or 1
        hrs = [a["hr"] for a in runs if a.get("hr")]
        sl = sleep_by_week.get(monday, [])
        ld = load_by_week.get(monday, [])
        hrv = [r["hrv"] for r in sl if r.get("hrv")]
        weeks.append({
            "row": "week",
            "weekStart": monday,
            "runs": len(runs),
            "km": round(sum(a["km"] for a in runs), 1),
            "minutes": round(sum(a.get("movMin") or a["min"] for a in runs)),
            "longestKm": round(max((a["km"] for a in runs), default=0), 1),
            "avgHr": round(sum(hrs) / len(hrs)) if hrs else None,
            "load": round(sum(z[i] / 60 * (i + 1) for i in range(5))),
            "easyPct": round((z[0] + z[1]) / total * 100),
            "hardPct": round((z[3] + z[4]) / total * 100),
            "walkKm": round(sum(a["km"] for a in walks), 1),
            "sleepHours": round(sum(r["h"] for r in sl if r.get("h")) / max(1, len([r for r in sl if r.get("h")])), 1) if sl else None,
            "hrv": round(sum(hrv) / len(hrv)) if hrv else None,
            "acuteLoad": ld[-1]["atl"] if ld else None,
            "chronicLoad": ld[-1]["ctl"] if ld else None,
        })
    rows.extend(weeks)
    now = context.get("garminNow") or {}
    athlete = context.get("athlete") or {}
    if now:
        rp = now.get("racePredictions") or {}
        rd = now.get("readiness") or {}
        rows.append({
            "row": "status",
            "date": now.get("date"),
            "trainingStatus": now.get("trainingStatus"),
            "acuteLoad": now.get("acuteLoad"),
            "chronicLoad": now.get("chronicLoad"),
            "loadRatio": now.get("loadRatio"),
            "vo2max": now.get("vo2max"),
            "readiness": rd.get("score"),
            "restingHr": athlete.get("restingHr"),
            "lthr": athlete.get("lthr"),
            "maxHr": athlete.get("maxHr"),
            "predict5K": rp.get("5K"),
            "predict10K": rp.get("10K"),
            "predictHalf": rp.get("half"),
            "predictMarathon": rp.get("marathon"),
        })
    return rows


def main(argv=None):
    global RAW, OUT
    ap = argparse.ArgumentParser(description="Build the Training Load snapshot from a raw Garmin store.")
    ap.add_argument("--raw", default=RAW, help="the raw store to read (default garmin-raw/)")
    ap.add_argument("--out", default=OUT, help="the snapshot to write (default training-load/data/snapshot.json)")
    args = ap.parse_args(argv)
    RAW, OUT = os.path.abspath(args.raw), os.path.abspath(args.out)

    with open(os.path.join(RAW, "activities.json")) as fh:
        raw_activities = json.load(fh)
    with open(os.path.join(RAW, "context.json")) as fh:
        context = json.load(fh)

    zones = read_csv("zones.csv", lambda r: (r[0], [int(float(x)) for x in r[1:6]]))
    gear = read_csv(
        "gear.csv",
        lambda r: (r[0], [] if r[1].strip() in ("-", "") else r[1].strip().split("|")),
    )
    splits = read_csv("splits.csv", lambda r: (r[0], (r + [""] * 8)[1:8]))
    details = read_csv("details.csv", lambda r: (r[0], (r + [""] * 26)[1:26]))
    zonekm = read_csv("zonekm.csv", lambda r: (r[0], [round(float(x or 0), 3) for x in (r + [""] * 7)[1:7]]))
    weather = {k: v for k, v in read_csv("weather.csv", weather_row).items() if v}
    laps = {}
    laps_path = os.path.join(RAW, "laps.csv")
    if os.path.exists(laps_path):
        with open(laps_path, newline="") as fh:
            for r in csv.reader(fh):
                if not r or not r[0].strip():
                    continue
                r = (r + [""] * 13)[:13]
                laps.setdefault(r[0], []).append((int(r[1]), r[2:13]))
    notes_path = os.path.join(RAW, "notes.json")
    notes = json.load(open(notes_path)) if os.path.exists(notes_path) else {}
    newest_day = max((a.get("start_time") or "")[:10] for a in raw_activities)
    detail_cutoff = (datetime.fromisoformat(newest_day) - timedelta(days=DETAIL_DAYS)).date().isoformat()

    stream_ids = []
    activities = []
    for a in raw_activities:
        aid = str(a["id"])
        gtype = a.get("type") or "other"
        secs = num(a.get("duration_seconds"), 0) or 0
        moving = num(a.get("moving_duration_seconds"), secs) or secs
        metres = num(a.get("distance_meters"), 0) or 0
        row = {
            "id": aid,
            "d": (a.get("start_time") or "")[:10],
            "t": (a.get("start_time") or "")[11:16] or None,
            "type": gtype,
            "sport": SPORT.get(gtype, "other"),
            "indoor": gtype in INDOOR,
            "name": a.get("name") or "",
            "km": round(metres / 1000.0, 3),
            "min": round(secs / 60.0, 2),
            "movMin": round(moving / 60.0, 2),
            "hr": int(num(a.get("avg_hr_bpm"), 0) or 0) or None,
            "hrMax": int(num(a.get("max_hr_bpm"), 0) or 0) or None,
            "elev": int(num(a.get("elevation_gain_meters"), 0) or 0),
            "cal": int(num(a.get("calories"), 0) or 0),
            "z": zones.get(aid, [0, 0, 0, 0, 0]),
            "g": gear.get(aid, []),
            "race": (a.get("event_type") == "race"),
        }
        sp = splits.get(aid)
        if sp:
            run_s, run_m, run_hr, walk_s, walk_m, walk_hr, stand_s = [num(x) for x in sp]
            # Running-only figures. The app prefers these over the session
            # totals for pace, HR and distance, so a run with walk breaks is
            # judged on the running it contained.
            row["runKm"] = round((run_m or 0) / 1000.0, 3)
            row["runMin"] = round((run_s or 0) / 60.0, 2)
            row["runHr"] = int(run_hr) if run_hr else None
            row["walkKm"] = round((walk_m or 0) / 1000.0, 3)
            row["walkMin"] = round((walk_s or 0) / 60.0, 2)
            row["walkHr"] = int(walk_hr) if walk_hr else None
            row["standMin"] = round((stand_s or 0) / 60.0, 2)
        if aid in notes:
            row["note"] = notes[aid]
        if row["d"] >= detail_cutoff:
            det = details.get(aid)
            if det:
                dt = {}
                for key, val in zip(DETAIL_KEYS, det):
                    if val == "":
                        continue
                    if key == "teLabel":
                        dt[key] = val
                    else:
                        v = num(val)
                        dt[key] = int(v) if v is not None and float(v).is_integer() else v
                row["dt"] = dt
            if aid in zonekm:
                row["zk"] = zonekm[aid]
            if aid in weather:
                row["wx"] = weather[aid]
            if os.path.exists(os.path.join(RAW, "streams", f"{aid}.csv")):
                row["stream"] = True
                stream_ids.append(aid)
            lp = laps.get(aid)
            if lp:
                out = []
                for _, r in sorted(lp):
                    vals = [num(x) for x in r[:10]]
                    vals = [int(v) if v is not None and float(v).is_integer() else v for v in vals]
                    out.append(vals + [r[10] or None])
                row["laps"] = out
        activities.append(row)
    activities.sort(key=lambda r: (r["d"], r["id"]))
    tile_inventory = write_streams(stream_ids, {r["id"]: r["sport"] for r in activities}, weather, athlete_mass())

    load = []
    with open(os.path.join(RAW, "garmin_load.csv"), newline="") as fh:
        for r in csv.reader(fh):
            if not r or not r[0].strip():
                continue
            load.append(
                {
                    "d": r[0],
                    "atl": int(float(r[1])),
                    "ctl": int(float(r[2])),
                    "status": r[3],
                    "vo2": num(r[4]) if len(r) > 4 else None,
                }
            )
    load.sort(key=lambda r: r["d"])

    sleep = []
    with open(os.path.join(RAW, "sleep.csv"), newline="") as fh:
        for r in csv.reader(fh):
            if not r or not r[0].strip():
                continue
            sleep.append(
                {
                    "d": r[0],
                    "score": num(r[1]),
                    "h": num(r[2]),
                    "deep": num(r[3]),
                    "rem": num(r[4]),
                    "hrv": num(r[5]),
                    "stress": num(r[6]),
                }
            )
    sleep.sort(key=lambda r: r["d"])

    racecast_path = os.path.join(RAW, "racecast.json")
    racecast = json.load(open(racecast_path)) if os.path.exists(racecast_path) else None
    plan_path = os.path.join(RAW, "plan.json")
    plan = json.load(open(plan_path)) if os.path.exists(plan_path) else None
    intraday = None
    intraday_path = os.path.join(RAW, "intraday.json")
    if os.path.exists(intraday_path):
        raw = json.load(open(intraday_path))
        newest = max([pt[0] for k in ("hr", "bb", "stress") for pt in raw.get(k) or []] or [0])
        cut = newest - 24 * 3600
        intraday = {"pulledAt": raw.get("pulledAt"), "restingHr": raw.get("restingHr"),
                    **{k: [pt for pt in raw.get(k) or [] if pt[0] >= cut] for k in ("hr", "bb", "stress")}}

    # The Shortcut replaces only snapshot.json on the phone; the per-session
    # stream files travel in the app ZIP, which is rebuilt only when the app
    # itself changes. So the newest sessions' streams ride inside the snapshot
    # too, and the app reads them from there first.
    recent_cut = (datetime.fromisoformat(activities[-1]["d"]) - timedelta(days=RECENT_STREAM_DAYS)).date().isoformat() if activities else None
    embedded = {}
    for row in activities:
        if row.get("stream") and recent_cut and row["d"] >= recent_cut:
            path = os.path.join(os.path.dirname(OUT), "streams", f"{row['id']}.json")
            if os.path.exists(path):
                embedded[row["id"]] = json.load(open(path))

    assessment_path = os.path.join(RAW, "assessment.json")
    assessment = None
    if os.path.exists(assessment_path):
        with open(assessment_path) as fh:
            assessment = json.load(fh)

    pull_path = os.path.join(RAW, "pull.json")
    pulled_at = json.load(open(pull_path)).get("pulledAt") if os.path.exists(pull_path) else None

    snapshot = {
        "schema": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "pulledAt": pulled_at,  # when the data pull last ran; the daily evaluation has its own dates in plan/assessment
        "dataThrough": activities[-1]["d"] if activities else None,
        "detailSince": detail_cutoff,
        "athlete": context["athlete"],
        "gear": context["gear"],
        "garminNow": context["garminNow"],
        "activities": activities,
        "garminLoad": load,
        "sleep": sleep,
        "ask": ask_rows(activities, load, sleep, context),
        "assessment": assessment,
        "racecast": racecast,
        "plan": plan,
        "streams": embedded,
        "tiles": tile_inventory,  # "z/x/y" of every tile in the app ZIP, so the map can fall back to a coarser zoom it has
        "intraday": intraday,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(snapshot, fh, separators=(",", ":"))
        fh.write("\n")

    size = os.path.getsize(OUT)
    print(
        f"wrote {OUT} ({size / 1024:.0f} kB): "
        f"{len(activities)} activities {activities[0]['d']}..{activities[-1]['d']}, "
        f"{sum(1 for a in activities if 'dt' in a)} with detail, {sum(1 for a in activities if 'laps' in a)} with laps, "
        f"{sum(1 for a in activities if 'note' in a)} with notes, "
        f"{len(snapshot['ask'])} ask rows, "
        f"{len(stream_ids)} with streams, {len(load)} load days, {len(sleep)} sleep nights, "
        f"assessment={'yes' if assessment else 'MISSING'}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
