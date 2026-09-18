#!/usr/bin/env python3
"""Make the demo data for the Training Load example — nobody's real training.

Writes a synthetic Garmin raw store (the same files garmin_pull.py writes)
into a temporary directory and then runs build_garmin_snapshot.py over it, so
the demo snapshot is produced by exactly the code that produces a real one and
cannot drift from the app's schema. Nothing here is copied from anyone's
account: every number is drawn from a seeded random generator, and the story
is a textbook one.

The story: a 16-week half-marathon block at 50–78 km a week — three base
weeks, eight build weeks with a down week every fourth, a tune-up week, a
last big week and a three-week taper — ending on a Sunday with the Copenhagen
Half Marathon. Six
runs a week (easy, tempo or intervals, recovery, steady, a long run growing
from 16 to 24 km, and one more easy run), strength once a week, one walk with
the stroller, two tune-up races (a 10 km and a 15 km) on the way.

The demo stops in the middle of the block: "today" is the Wednesday of the
tune-up week, eleven weeks in, so the sessions end there and the plan pane
runs forward — this week's 15 km tune-up, the second peak week, the taper and
the race — the way a live copy's does. The calendar is the generator's own:
today is the last Wednesday before the build and the race the Sunday 32 days
on, so regenerate before publishing and the plan is ahead of the reader.

The routes: six sessions carry a per-second record stream drawn on the
Sessions pane. Each follows a segment of a famous marathon course — Boston,
Chicago and New York City (with USGS map tiles, public domain), Berlin, London
and Tokyo (no basemap) — read from scripts/demo_courses.json, which
make_demo_courses.py derives from OpenStreetMap (ODbL) with bare-earth
terrain elevations; see training-load/TILES.md. A session runs its segment once, from
a chosen kilometre of the course. None is a GPS trace of anyone's run.

    python3 scripts/make_demo_training_load.py            # rebuild training-load/data/
    python3 scripts/make_demo_training_load.py --tiles    # ...and fetch the basemap tiles
    python3 scripts/make_demo_training_load.py --check    # regenerate to a temp dir; exit 1 on drift

Stdlib only. `requests` is needed only under --tiles and --probe-osm, and only
because garmin_pull.fetch_tile imports it.
"""

import argparse
import csv
import json
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP = "training-load"
SEED = 20260918
COURSES_FILE = os.path.join(HERE, "demo_courses.json")

# The demo's calendar: "today" is the Wednesday of week 12 — by default the
# last Wednesday on or before the day the generator runs, so a fresh build's
# plan lies ahead of the viewer's clock (the app marks a planned day that has
# passed without a session as missed) — and the race is the Sunday 32 days
# later. --check and --verify read the committed snapshot's own date, so they
# hold on any day.
DAYS_TO_RACE = 32


def demo_dates(today=None):
    if today is None:
        t = date.today()
        today = t - timedelta(days=(t.weekday() - 2) % 7)
    return today, today + timedelta(days=DAYS_TO_RACE)


def committed_today(snapshot_path):
    with open(snapshot_path) as fh:
        return date.fromisoformat(json.load(fh)["generatedAt"][:10])

# --------------------------------------------------------------------- athlete

ATHLETE = {
    "maxHr": 190,
    "lthr": 170,
    "restingHr": 48,
    "zoneFloors": [114, 133, 152, 162, 171],   # 60 / 70 / 80 / 85 / 90 % of maxHr
    "zoneMethod": "HR_MAX",
    "vo2maxRunning": 54.0,
    "weightKg": 70.0,
    "heightCm": 180,
}

# code, name, type, since (weeks before today), km already on it before the block, maxKm
GEAR = [
    ("RSA", "Road shoes A", "Shoes", 30, 210.0, 800),
    ("RSB", "Road shoes B", "Shoes", 12, 40.0, 800),
    ("RAC", "Race shoes", "Shoes", 20, 31.0, 400),
    ("TRL", "Trail shoes", "Shoes", 40, 180.0, 700),
    ("STROLLER", "Running stroller", "Other", 60, 95.0, None),
]

# ------------------------------------------------------------------ the block

# Running kilometres per week, Monday to Sunday. The race week's figure is the
# taper before the race; the race adds its 21.1 km on the Sunday.
WEEK_KM = [50, 54, 56,                     # base
           58, 62, 66, 40, 56, 74, 78, 46,  # build, a down week every fourth; week 8 sharpens for its 10 km
           62, 76,                          # the 15 km tune-up week, then the last big week
           62, 48, 28]                      # taper; week 16 ends with the race
WEEK_KIND = ["base"] * 3 + ["build", "build", "build", "down", "build", "build", "build", "down",
                            "peak", "peak", "taper", "taper", "race"]
TUNE_UPS = {8: ("10 km tune-up", 10.0), 12: ("15 km tune-up", 15.0)}
RACE = ("Copenhagen Half Marathon", 21.1)
GOAL_HALF = "1:37:30"

# Pace in min/km and mean heart rate by session kind; the HR series is walked
# per minute and the zone seconds are counted from it, so the zones a session
# shows are consistent with its average by construction.
KINDS = {
    "easy":      {"pace": 5.55, "hr": 143, "name": "Easy run"},
    "recovery":  {"pace": 6.05, "hr": 134, "name": "Recovery run"},
    "steady":    {"pace": 5.15, "hr": 152, "name": "Steady run"},
    "tempo":     {"pace": 4.68, "hr": 166, "name": "Tempo run"},
    "intervals": {"pace": 4.95, "hr": 158, "name": "Intervals"},
    "long":      {"pace": 5.35, "hr": 149, "name": "Long run"},
    "race":      {"pace": 4.62, "hr": 172, "name": "Race"},
}

# ------------------------------------------------------------------ the routes
#
# Which sessions carry a record stream: (week index from 0, weekday from Monday)
# → the course and the kilometre of it the session starts at. Four inside the
# last 21 days (embedded in the snapshot), two older (files only), so both of
# the app's loading paths are exercised. The three US courses get map tiles.
STREAMED = [
    ((11, 1), "chicago", 0.0),    # Tuesday's easy run, this week: Grant Park north
    ((10, 6), "boston", 16.0),    # last Sunday's long run: Wellesley, the Newton hills, into Boston
    ((10, 2), "nyc", 26.0),       # last week's tempo: Long Island City, the Queensboro Bridge, First Avenue
    ((9, 6), "berlin", 0.0),      # the 24 km long run, 17 days ago: the whole first half
    ((7, 6), "london", 0.0),      # the 10 km tune-up, week 8: Blackheath to the river
    ((5, 2), "tokyo", 8.0),       # an intervals day, week 6: Nihonbashi to Asakusa and back
]


def load_courses():
    with open(COURSES_FILE) as fh:
        return json.load(fh)["courses"]


# --------------------------------------------------------------------- helpers


def iso(d):
    return d.isoformat()


def haversine_km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


_geometry_cache = {}


def course_geometry(courses, name):
    """The course as a polyline with the cumulative distance at each vertex."""
    if name not in _geometry_cache:
        pts = [(p[0], p[1]) for p in courses[name]["points"]]
        # A 90 m terrain model sampled every 50 m in a city is jagged; a
        # 250 m running mean is what a watch's barometer would have drawn.
        alts = smoothed([p[2] for p in courses[name]["points"]], 5)
        cum = [0.0]
        for i in range(len(pts) - 1):
            cum.append(cum[-1] + haversine_km(pts[i], pts[i + 1]))
        _geometry_cache[name] = (pts, cum, alts)
    return _geometry_cache[name]


def along(pts, cum, alts, km):
    """Position and altitude at km along the course, clamped to its ends."""
    k = max(0.0, min(cum[-1], km))
    lo, hi = 0, len(cum) - 1
    while hi - lo > 1:                    # cum is monotone; bisect
        mid = (lo + hi) // 2
        if cum[mid] <= k:
            lo = mid
        else:
            hi = mid
    i = lo
    f = 0 if cum[i + 1] == cum[i] else (k - cum[i]) / (cum[i + 1] - cum[i])
    lat = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f
    lon = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f
    alt = alts[i] + (alts[i + 1] - alts[i]) * f
    return lat, lon, alt


def segment(courses, name, start_km, km):
    """The vertices of the course between start_km and start_km + km, with
    their altitudes, for extents and elevation gain."""
    pts, cum, alts = course_geometry(courses, name)
    end_km = min(cum[-1], start_km + km)
    idx = [i for i, c in enumerate(cum) if start_km <= c <= end_km]
    return [pts[i] for i in idx], [alts[i] for i in idx]


def elevation_gain(alts):
    """Positive climb in metres, counting a rise only once it is 3 m above
    the last trough — the hysteresis a watch applies."""
    gain, base = 0.0, alts[0]
    for a in alts[1:]:
        if a < base:
            base = a
        elif a - base >= 3.0:
            gain += a - base
            base = a
    return int(round(gain))


def hms(seconds):
    seconds = int(round(seconds))
    h, m, s = seconds // 3600, seconds % 3600 // 60, seconds % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def race_pace(km):
    """Race pace by distance: a 10 km tune-up is faster than half pace."""
    return 4.40 if km <= 10.5 else 4.50 if km <= 16 else 4.62


def pace_of(session):
    return race_pace(session.km) if session.kind == "race" else KINDS[session.kind]["pace"]


def smoothed(vals, k):
    h = k // 2
    return [sum(vals[max(0, i - h):i + h + 1]) / len(vals[max(0, i - h):i + h + 1]) for i in range(len(vals))]


def pace_str(min_per_km):
    m = int(min_per_km)
    return f"{m}:{int(round((min_per_km - m) * 60)):02d}"


# ----------------------------------------------------------------- the sessions


class Session:
    def __init__(self, day, kind, km, name=None, sport="running", race=False, gear=("RSA",),
                 indoor=False, minutes=None):
        self.day, self.kind, self.km, self.race = day, kind, km, race
        self.name = name or KINDS.get(kind, {}).get("name", kind.title())
        self.sport, self.gear, self.indoor = sport, list(gear), indoor
        self.minutes = minutes   # for sessions without distance (strength)
        self.id = None
        self.hr_series = []      # per-minute HR
        self.course = None       # a streamed session: course name and the kilometre it starts at
        self.start_km = 0.0
        self.week = None         # 0-based week of the block


def plan_block(race_sunday, rng):
    """Every session of the sixteen weeks, ending on the race Sunday."""
    sessions = []
    first_monday = race_sunday - timedelta(days=6 + 7 * 15)
    for w, km in enumerate(WEEK_KM):
        monday = first_monday + timedelta(days=7 * w)
        week_no = w + 1
        kind = WEEK_KIND[w]
        long_km = {"base": 16 + w, "build": min(24, 18 + (w - 3)), "down": 16, "peak": 24, "taper": 16, "race": 0}[kind]
        tune = TUNE_UPS.get(week_no)
        race_week = kind == "race"
        weekday_km = {}
        if race_week:
            # 28 km of taper before the Sunday race: Tue easy, Wed strides, Thu recovery, Sat shake-out.
            weekday_km = {1: ("easy", 9.0), 2: ("tempo", 7.0), 3: ("recovery", 6.0), 5: ("easy", 4.0)}
        elif tune:
            # A sharpening week: shorter weekdays, a 4 km shake-out on Saturday,
            # the tune-up in the long run's place on Sunday.
            rest = km - tune[1] - 4.0
            quality = "tempo" if w % 2 == 0 else "intervals"
            weekday_km = {
                1: ("easy", round(rest * 0.30, 1)),
                2: (quality, round(rest * 0.26, 1)),
                3: ("recovery", round(rest * 0.22, 1)),
                4: ("easy", round(rest * 0.22, 1)),
                5: ("easy", 4.0),
                6: ("race", tune[1]),
            }
        else:
            rest = km - long_km
            quality = "tempo" if w % 2 == 0 else "intervals"
            weekday_km = {
                1: ("easy", round(rest * 0.26, 1)),
                2: (quality, round(rest * 0.30, 1)),
                3: ("recovery", round(rest * 0.18, 1)),
                4: ("easy", round(rest * 0.10, 1)),
                5: ("steady", round(rest * 0.16, 1)),
                6: ("long", float(long_km)),
            }
        if not race_week:
            # Nudge Tuesday and Thursday so the week lands on its number.
            total = sum(v for _, v in weekday_km.values())
            gap = round(km - total, 1)
            weekday_km[1] = ("easy", round(weekday_km[1][1] + gap / 2, 1))
            weekday_km[3] = (weekday_km[3][0], round(weekday_km[3][1] + gap - gap / 2, 1))
        week_sessions = []
        for wd in range(7):
            day = monday + timedelta(days=wd)
            if wd == 0:
                week_sessions.append(Session(day, "strength", 0.0, "Strength", sport="strength_training",
                                             gear=(), indoor=True, minutes=40))
                if kind != "race":
                    week_sessions.append(Session(day, "walk", round(rng.uniform(3.2, 4.8), 1), "Walk with the stroller",
                                                 sport="walking", gear=("STROLLER",)))
                continue
            if wd in weekday_km:
                k, dist = weekday_km[wd]
                if dist <= 0:
                    continue
                name = None
                race = k == "race"
                gear = ("RSA",)
                if k == "tempo":
                    gear = ("RSB",)
                if race:
                    name = tune[0]
                    gear = ("RAC",)
                    dist = tune[1]
                if k == "long" and kind in ("peak", "build") and w in (10, 11):
                    gear = ("TRL",)
                week_sessions.append(Session(day, k, dist, name, race=race, gear=gear))
        if race_week:
            week_sessions.append(Session(race_sunday, "race", RACE[1], RACE[0], race=True, gear=("RAC",)))
        for s in week_sessions:
            s.week = w
        sessions.extend(week_sessions)
    # A treadmill run when the weather turns: two of the recovery runs.
    for s in sessions:
        if s.kind == "recovery" and s.day.isocalendar()[1] % 5 == 0:
            s.sport, s.indoor, s.name = "treadmill_running", True, "Treadmill recovery"
    return sessions


def hr_series(session, rng):
    """One HR value per minute, from a warm-up ramp into the kind's mean with
    a slow wobble; intervals alternate hard and easy after the warm-up; a
    long run drifts upward and its last three kilometres go to goal pace."""
    minutes = session_minutes(session)
    target = KINDS[session.kind]["hr"] if session.kind in KINDS else 118
    series = []
    level = ATHLETE["restingHr"] + 40
    for m in range(minutes):
        if session.kind == "intervals" and 10 <= m < minutes - 8:
            phase = (m - 10) % 5
            goal = 179 if phase < 3 else 141
        elif session.kind == "long":
            goal = target + (m / minutes) * 8
            if m >= minutes - 16:
                goal = 167
        elif session.kind == "race":
            goal = target - 4 + (m / minutes) * 8
        elif session.kind == "walk":
            goal = 96
        elif session.kind == "strength":
            goal = 112
        else:
            goal = target
        if m < 8:
            goal = level + (goal - level) * (m / 8)
        level = level + (goal - level) * 0.35 + rng.gauss(0, 2.2)
        series.append(int(round(max(ATHLETE["restingHr"] + 20, min(ATHLETE["maxHr"] - 2, level)))))
    return series


def session_minutes(session):
    if session.minutes:
        return session.minutes
    if session.kind == "walk":
        return int(round(session.km * 11.5))
    return int(round(session.km * pace_of(session)))


def zone_seconds(series):
    floors = ATHLETE["zoneFloors"]
    z = [0] * 5
    for hr in series:
        zi = sum(1 for f in floors if hr >= f)   # 0..5; below Z1 counts as zone 1
        z[max(0, zi - 1)] += 60
    return z


def zone_km(series, km):
    """Kilometres per zone at an even pace; zk[5] is the distance below the
    Z1 floor (the first warm-up minute, at most)."""
    floors = ATHLETE["zoneFloors"]
    per_min = km / max(1, len(series))
    zk = [0.0] * 6
    for hr in series:
        zi = sum(1 for f in floors if hr >= f)
        zk[5 if zi == 0 else zi - 1] += per_min
    return [round(v, 3) for v in zk]


# ------------------------------------------------------------------ the streams


def stream_rows(session, courses, rng):
    """Per-second rows in the pull's shape: sec,distM,hr,spdMps,cad,altM,pwr,lat,lon,
    following the session's course segment from its start kilometre."""
    pts, cum, alts = course_geometry(courses, session.course)
    total_s = session_minutes(session) * 60
    base_pace = pace_of(session)
    rows = []
    dist = 0.0
    hr_per_min = session.hr_series
    start = session.start_km
    for sec in range(total_s):
        m = min(len(hr_per_min) - 1, sec // 60)
        hr = hr_per_min[m] + rng.gauss(0, 1.2)
        pace = base_pace
        if session.kind == "intervals" and 600 <= sec < total_s - 480:
            pace = 4.05 if ((sec - 600) // 60) % 5 < 3 else 6.0
        elif session.kind == "long" and sec >= total_s - 16 * 60:
            pace = 4.68
        elif session.kind == "race":
            pace = base_pace - 0.05 + 0.10 * (sec / total_s)
        pace *= 1 + rng.gauss(0, 0.035)
        spd = 1000.0 / (pace * 60.0)
        _, _, alt0 = along(pts, cum, alts, start + dist / 1000)
        _, _, alt1 = along(pts, cum, alts, start + dist / 1000 + 0.05)
        spd *= 1 - max(-0.15, min(0.25, (alt1 - alt0) / 50.0)) * 0.6   # slower uphill, a little faster down
        dist += spd
        lat, lon, alt = along(pts, cum, alts, start + dist / 1000)
        lat += rng.gauss(0, 0.000025)
        lon += rng.gauss(0, 0.00005)
        cad = 178 + rng.gauss(0, 2.5) if spd > 2.2 else 168 + rng.gauss(0, 2)
        rows.append([sec, round(dist, 1), int(round(hr)), round(spd, 3), int(round(cad)),
                     round(alt + rng.gauss(0, 0.3), 1), "", round(lat, 6), round(lon, 6)])
    # Scale so the stream's distance is the session's distance exactly.
    scale = session.km * 1000 / rows[-1][1]
    for r in rows:
        r[1] = round(r[1] * scale, 1)
        r[3] = round(r[3] * scale, 3)
    return rows


# --------------------------------------------------------------- daily series


def daily_series(sessions, end, rng):
    """Garmin-style acute/chronic load per day and a night's sleep per day,
    both driven by the block's load so the curves tell the same story."""
    by_day = {}
    for s in sessions:
        z = zone_seconds(s.hr_series)
        trimp = sum(z[i] / 60 * (i + 1) for i in range(5))
        by_day[s.day] = by_day.get(s.day, 0) + trimp
    first = min(by_day)
    days = (end - first).days + 1
    atl = ctl = 180.0
    load_rows, sleep_rows = [], []
    for i in range(days):
        d = first + timedelta(days=i)
        t = by_day.get(d, 0)
        atl += (t - atl) / 7 * 2.4
        ctl += (t - ctl) / 28 * 2.4
        ratio = atl / max(ctl, 1)
        w = min(15, (d - first).days // 7)
        if WEEK_KIND[w] == "down":
            status = "RECOVERY"
        elif ratio > 1.25:
            status = "PRODUCTIVE_2"
        elif ratio > 1.05:
            status = "PRODUCTIVE"
        else:
            status = "MAINTAINING"
        vo2 = round(52.0 + 2.0 * i / max(days - 1, 1), 1)
        load_rows.append([iso(d), int(round(atl)), int(round(ctl)), status, vo2])
        # Sleep: HRV dips a little as the peak weeks begin.
        peak = 1.0 if w >= 11 else 0.0
        hrv = 66 - 5 * peak + rng.gauss(0, 3)
        score = int(round(max(55, min(90, 76 - 4 * peak + rng.gauss(0, 6)))))
        hours = round(max(6.0, min(8.6, 7.4 - 0.2 * peak + rng.gauss(0, 0.45))), 2)
        deep = round(max(13, min(25, 19 + rng.gauss(0, 2.2))), 1)
        rem = round(max(15, min(26, 20 + rng.gauss(0, 2.0))), 1)
        stress = int(round(max(12, min(36, 22 + 4 * peak + rng.gauss(0, 4)))))
        sleep_rows.append([iso(d), score, hours, deep, rem, int(round(hrv)), stress])
    return load_rows, sleep_rows


def intraday(end, rng):
    """36 hours of heart rate, body battery and stress ending this evening,
    with this morning's intervals in them; the builder keeps the last 24."""
    t_end = int(datetime(end.year, end.month, end.day, 18, 0, tzinfo=timezone.utc).timestamp())
    t0 = t_end - 36 * 3600
    hr, bb, stress = [], [], []

    def running(t):
        d = datetime.fromtimestamp(t, tz=timezone.utc)
        return d.date() == end and 6 <= d.hour < 8
    for t in range(t0, t_end + 1, 120):
        h = datetime.fromtimestamp(t, tz=timezone.utc).hour
        base = 52 if 0 <= h < 6 else 66
        v = 160 + rng.gauss(0, 12) if running(t) else base + rng.gauss(0, 5)
        hr.append([t, int(round(max(45, min(185, v))))])
    level = 40.0
    for t in range(t0, t_end + 1, 180):
        h = datetime.fromtimestamp(t, tz=timezone.utc).hour
        level += (1.1 if 0 <= h < 7 else -0.35) - (2.0 if running(t) else 0)
        level = max(5, min(100, level))
        bb.append([t, int(round(level))])
    for t in range(t0, t_end + 1, 222):
        h = datetime.fromtimestamp(t, tz=timezone.utc).hour
        if 0 <= h < 6 and rng.random() < 0.5:
            continue
        stress.append([t, int(round(max(3, min(80, (14 if h < 7 else 26) + rng.gauss(0, 9)))))])
    return {"pulledAt": datetime.fromtimestamp(t_end, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
            "restingHr": ATHLETE["restingHr"], "hr": hr, "bb": bb, "stress": stress}


# ------------------------------------------------------------ the coaching text

EXAMPLE = "Example text, shipped with the template."

PLAN_KIND = {"easy": "easy", "recovery": "easy", "steady": "easy", "tempo": "quality", "intervals": "quality",
             "long": "long", "race": "race", "strength": "strength"}
PLAN_ZONES = {"easy": [55, 45, 0, 0, 0], "recovery": [70, 30, 0, 0, 0], "steady": [30, 60, 10, 0, 0],
              "tempo": [30, 25, 15, 25, 5], "intervals": [35, 20, 10, 15, 20], "long": [40, 50, 10, 0, 0],
              "race": [5, 10, 25, 40, 20], "strength": [90, 10, 0, 0, 0]}
PLAN_WHY = {"easy": "Easy means easy; the quality days need it.", "recovery": "Legs only. Heart rate under 140.",
            "steady": "Comfortably hard, not a tempo.", "tempo": "Twenty minutes at goal-half pace inside an easy run.",
            "intervals": "3-minute reps at 5 km effort, 2-minute floats; the last as fast as the first.",
            "long": "The last three kilometres at goal pace, the rest conversational.",
            "race": "Even pace; a check on the goal, not a target in itself.",
            "strength": "Squats, single-leg deadlifts, calf raises, planks."}
PLAN_ALT = {"easy": "Tired: shorter, not slower than 6:00.", "recovery": "A walk is fine.", "steady": "Flat: easy instead.",
            "tempo": "Flat: 2 × 10 min.", "intervals": "Flat: 4 reps and go home.", "long": "Skip the fast finish if the legs say so.",
            "race": "Warm: start 5 s/km slower.", "strength": "Half the load in a heavy week."}


def plan_week(sessions, label, target_km, intensity):
    items = []
    for s in sorted(sessions, key=lambda s: (s.day, s.kind)):
        if s.kind == "walk":
            continue
        pace = KINDS[s.kind]["pace"] if s.kind in KINDS else None
        what = {"strength": "Strength, 40 min", "race": f"{s.name}, {s.km:g} km"}.get(
            s.kind, f"{s.km:g} km {KINDS[s.kind]['name'].lower()}" if s.kind in KINDS else s.name)
        items.append({"date": iso(s.day), "kind": PLAN_KIND.get(s.kind, "easy"), "what": what,
                      "km": f"{s.km:g}" if s.km else "0",
                      "pace": f"~{pace_str(pace)}" if pace else "",
                      "hr": {"race": "168–176", "tempo": "<170", "intervals": "<180"}.get(s.kind, "<150" if s.km else ""),
                      "zones": PLAN_ZONES.get(s.kind, [60, 40, 0, 0, 0]),
                      "why": PLAN_WHY.get(s.kind, ""), "alt": PLAN_ALT.get(s.kind, "")})
    monday = min(s.day for s in sessions)
    return {"start": iso(monday - timedelta(days=monday.weekday())), "label": label, "targetKm": target_km,
            "intensity": intensity, "sessions": items}


def coaching(done, planned, today, race, weekly):
    """assessment.json, plan.json and racecast.json as the optional routine
    would write them on this Wednesday, eleven weeks into the block."""
    tune_10k = next(s for s in done if s.race and s.km == 10.0)
    tune_15k = next(s for s in planned if s.race and s.km == 15.0)
    t10 = tune_10k.km * race_pace(10.0) * 60
    this_week = [s for s in planned if s.week == 11]
    next_week = [s for s in planned if s.week == 12]
    biggest = max(weekly, key=lambda w: w["km"])
    weeks_done = 11
    assessment = {
        "updated": iso(today),
        "verdict": "Example text",
        "tone": "good",
        "headline": "Example text: this evaluation was written once for the template, not generated from anybody's training.",
        "summary": ("In a real copy this pane is written by an optional agent routine that reads what the pull "
                    "committed and rewrites four files in garmin-raw/ once a day. The refresh never writes it; "
                    "without the routine the pane says so and every number still works. What follows reads the "
                    "demo block so far the way that routine would."),
        "metrics": [
            {"label": "Coaching text", "value": "Example", "note": "not from real data"},
            {"label": "Weeks done", "value": f"{weeks_done} of 16", "note": "the tune-up week in progress"},
            {"label": "Biggest week", "value": f"{biggest['km']:.0f} km", "note": f"week of {biggest['monday']}"},
            {"label": "Goal", "value": GOAL_HALF, "note": f"{RACE[0]}, {iso(race)}"},
        ],
        "sections": [
            {"title": "Volume", "tone": "good",
             "body": ["Eleven weeks from 50 to 78 km with a down week every fourth, and the down weeks were "
                      "respected: the two lowest weeks sit at 40 and 46 km, which is what let the weeks after "
                      "them go higher. This week sharpens around Sunday's 15 km; next week is the last big one at "
                      "76 km, then a three-week taper.", EXAMPLE],
             "bullets": ["Six runs a week, one strength session, one walk.", "Long run up to 24 km, last three at goal pace."]},
            {"title": "Intensity", "tone": "neutral",
             "body": ["About four fifths of the time is easy or steady, one fifth is hard. The tempo runs have held "
                      "goal-half pace and the interval days stayed short. Nothing in the zones suggests the "
                      "easy days are creeping up.", EXAMPLE],
             "bullets": []},
            {"title": "Signals", "tone": "good",
             "body": ["HRV has dipped a little this week, which is what the first peak week does; sleep holds near "
                      f"seven and a half hours and resting heart rate has not moved. The 10 km tune-up in week 8 "
                      f"({hms(t10)}) landed where a {GOAL_HALF} half would put it.", EXAMPLE],
             "bullets": []},
            {"title": "Next", "tone": "neutral",
             "body": [f"Sunday's 15 km tune-up is the last check before the last big week. Then the taper: "
                      f"62, 48 and 28 km, and {RACE[0]} on {race.strftime('%-d %B')}.", EXAMPLE],
             "bullets": []},
        ],
    }
    horizon_km = WEEK_KM[11:] + [22, 34, 44, 50, 54, 58, 40, 62, 66, 70, 46, 72, 76, 80, 50, 82, 84, 60, 86, 70, 52]
    horizon_kind = WEEK_KIND[11:] + ["down", "down", "build", "build", "build", "build", "down", "build", "build",
                                     "build", "down", "build", "build", "build", "down", "build", "build", "down",
                                     "build", "hold", "down"]
    this_monday = today - timedelta(days=today.weekday())
    plan = {
        "updated": iso(today),
        "tone": "good",
        "headline": "Example plan — a 16-week half-marathon block, illustrative, not coaching.",
        "why": ("The block is textbook: base, build with a down week every fourth, two peak weeks, a three-week "
                "taper. In a real copy the routine writes this pane from your own load, recovery and calendar; "
                "the demo's version is fixed. " + EXAMPLE),
        "goal": {
            "kind": "race",
            "text": f"Run {RACE[0]} in {GOAL_HALF}.",
            "race": {"name": RACE[0], "date": iso(race), "distanceKm": 21.1, "start": "09:30",
                     "expect": GOAL_HALF, "source": "example"},
            "preferences": ["Nothing new on race day — the shoes, the breakfast and the gels are the ones the long runs used."],
            "strength": {"from": iso(planned[0].day), "perWeek": 1, "day": "Monday",
                         "programme": ["Squats, single-leg deadlifts, calf raises, planks — 40 minutes."],
                         "notes": "Kept through the taper at half the load."},
        },
        "weeks": [
            plan_week(this_week, "This week", f"{WEEK_KM[11]} km", "sharpening; the 15 km tune-up on Sunday"),
            plan_week(next_week, "Next week", f"{WEEK_KM[12]} km", "the last big week; the last 24 km long run"),
        ],
        "horizon": [
            {"w": iso(this_monday + timedelta(days=7 * i)),
             "km": horizon_km[i] + (21 if horizon_kind[i] == "race" else 0),
             "mix": {"peak": [78, 12, 10], "taper": [85, 10, 5], "race": [70, 10, 20], "down": [92, 8, 0],
                     "build": [80, 12, 8], "hold": [82, 12, 6]}[horizon_kind[i]],
             "kind": horizon_kind[i],
             "note": {0: "Tune-up Sunday.", 1: "The last big week.", 4: f"{RACE[0]}.", 5: "Recovery, then a base for the spring."}.get(i, "")}
            for i in range(26)
        ],
        "after": "After the race, two recovery weeks and a longer base block; the next race is a spring marathon, if the winter allows. " + EXAMPLE,
        "guardrails": ["Nothing new on race day.", "Easy means easy: under 150 on the easy days, every time.",
                       "A down week every fourth week, no exceptions.", EXAMPLE],
    }
    racecast = {
        "updated": iso(today),
        "kind": "full",
        "basis": {"vo2": ATHLETE["vo2maxRunning"], "weeksOfData": weeks_done, "races": 1},
        "anchors": [
            {"date": iso(tune_10k.day), "event": "10 km tune-up", "time": hms(t10), "pace": pace_str(t10 / 60 / 10),
             "note": "Flat road race, cool morning; the Blackheath start of the London course."},
        ],
        "predictions": [
            {"key": "5K", "label": "5 km", "mine": "21:05", "low": "20:45", "high": "21:30", "confidence": "moderate",
             "why": "Extrapolated down from the tune-up; no 5 km raced in the block."},
            {"key": "10K", "label": "10 km", "mine": hms(t10 - 25), "low": hms(t10 - 50), "high": hms(t10 + 10), "confidence": "moderate",
             "why": "Raced in week 8; the four weeks since were the biggest of the block."},
            {"key": "half", "label": "Half marathon", "mine": "1:37:10", "low": "1:35:45", "high": "1:38:40", "confidence": "moderate",
             "why": f"One tune-up and the long runs' goal-pace finishes point here; Sunday's 15 km ({iso(tune_15k.day)}) will narrow it."},
            {"key": "marathon", "label": "Marathon", "mine": None, "low": None, "high": None, "confidence": "none",
             "why": "No long run past 24 km; nothing to anchor a marathon on."},
        ],
        "summary": "Example text. " + "One tune-up anchors the half so far; the long runs' goal-pace finishes agree with it, and Sunday's 15 km is the next fix.",
        "outlook": {"horizon": "race day", "condition": "on plan, not yet rested", "5K": "21:05", "10K": hms(t10 - 25), "half": "1:37:10"},
        "method": ["Riegel from the tune-up, shaded by the block's volume and the taper still to come.", EXAMPLE],
        "analysed": iso(today),
    }
    return assessment, plan, racecast


def session_note(session, courses):
    verdicts = {"easy": ("Easy", "good"), "recovery": ("Recovered", "good"), "tempo": ("On pace", "good"),
                "intervals": ("Sharp", "good"), "long": ("Strong", "good"), "race": ("Raced", "good"),
                "steady": ("Steady", "neutral")}
    verdict, tone = verdicts.get(session.kind, ("Done", "neutral"))
    where = ""
    if session.course:
        c = courses[session.course]
        where = f" Route: km {session.start_km:g}–{session.start_km + session.km:g} of the {c['name']} course, approximately."
    bodies = {
        "long": [f"{session.km:.0f} km with the last three at goal pace.{where}",
                 "Heart rate drifted up through the run and stayed under threshold in the fast finish, which is the point of the session."],
        "race": [f"{session.name}: even splits, {hms(session.km * race_pace(session.km) * 60)}.{where}",
                 "A fair check on the goal with eight weeks to go; the half prediction moved by nothing."],
        "intervals": [f"Three-minute reps at 5 km effort with two-minute floats; the last rep as fast as the first.{where}",
                      "Cadence stayed up through the reps."],
        "tempo": [f"Twenty minutes at goal-half pace inside an easy run. Heart rate settled just under threshold.{where}",
                  "One of the sessions that tells you the goal is right."],
        "easy": [f"{session.km:.1f} km easy, by feel.{where}", "Nothing to note, which is what an easy day is for."],
    }
    body = bodies.get(session.kind, [f"{session.name}, {session.km:.1f} km, by feel.", "Nothing to note."])
    return {"written": iso(session.day), "verdict": verdict, "tone": tone, "body": body + [f"({EXAMPLE})"]}


# ---------------------------------------------------------------- the raw store


def assign_streams(sessions, courses):
    for (week, wd), course, start_km in STREAMED:
        s = next((s for s in sessions if s.week == week and s.day.weekday() == wd and s.sport == "running"), None)
        if s is None:
            raise SystemExit(f"no running session in week {week + 1} on weekday {wd} to carry the {course} stream")
        pts, cum, _ = course_geometry(courses, course)
        if start_km + s.km > cum[-1] + 0.1:
            raise SystemExit(f"{course} is {cum[-1]:.1f} km; km {start_km}–{start_km + s.km} does not fit")
        s.course, s.start_km = course, start_km


def write_raw(raw, done, planned, today, race, courses, rng, tiles_dir):
    os.makedirs(os.path.join(raw, "streams"), exist_ok=True)
    gear_km = {code: km for code, _, _, _, km, _ in GEAR}
    gear_n = {code: 0 for code, *_ in GEAR}
    activities = []
    zones, gearcsv, splits, zonekm, weather, details, laps = [], [], [], [], [], [], []
    notes = {}
    for i, s in enumerate(done):
        s.id = f"demo-{i + 1:04d}"
        s.hr_series = hr_series(s, rng)
        minutes = len(s.hr_series)
        moving = minutes * 60
        secs = moving + (0 if s.indoor else int(rng.uniform(20, 95)))
        hr_avg = int(round(sum(s.hr_series) / minutes))
        hr_max = max(s.hr_series)
        elev = 0
        if s.course:
            _, alts = segment(courses, s.course, s.start_km, s.km)
            elev = elevation_gain(alts)
        elif s.sport == "running":
            elev = int(round(s.km * rng.uniform(4, 14)))
        for g in s.gear:
            gear_km[g] = gear_km.get(g, 0) + s.km
            gear_n[g] = gear_n.get(g, 0) + 1
        cal = int(round((s.km * 68) if s.km else minutes * 6.5))
        start_h = {"long": "08:10", "race": "09:30", "walk": "16:30", "strength": "18:00"}.get(s.kind, "06:50")
        activities.append({
            "id": s.id, "name": s.name, "type": s.sport,
            "event_type": "race" if s.race else "training",
            "start_time": f"{iso(s.day)} {start_h}:{int(rng.uniform(0, 59)):02d}",
            "distance_meters": round(s.km * 1000, 1), "duration_seconds": secs,
            "moving_duration_seconds": moving, "calories": cal,
            "avg_hr_bpm": hr_avg, "max_hr_bpm": hr_max,
            "steps": int(round(s.km * 1000 / (1.25 if s.sport != "walking" else 0.75))) if s.km else None,
            "elevation_gain_meters": elev,
        })
        z = zone_seconds(s.hr_series)
        zones.append([s.id] + z)
        gearcsv.append([s.id, "|".join(s.gear) if s.gear else "-"])
        if s.sport == "running":
            walk_s = int(rng.uniform(0, 40))
            splits.append([s.id, moving - walk_s, int(round(s.km * 1000)) - walk_s * 1, hr_avg, walk_s, walk_s, 120, 0])
            zonekm.append([s.id] + zone_km(s.hr_series, s.km))
            weather.append([s.id, round(rng.uniform(6, 15), 1), round(rng.uniform(5, 14), 1), round(rng.uniform(2, 10), 1),
                            int(rng.uniform(55, 92)), round(rng.uniform(2, 18), 1), int(rng.uniform(0, 359)),
                            rng.choice(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]),
                            rng.choice(["Clear", "Partly cloudy", "Overcast", "Light rain", "Fog"]), "demo station"])
            te = round(min(5.0, 1.5 + (z[2] + 2 * z[3] + 3 * z[4]) / max(1, moving) * 2.6), 1)
            details.append([s.id, moving, min(s.hr_series), 176, 188, 118, 246, 8.4, "", "", "",
                            te, round(min(4.0, te * 0.6), 1),
                            {"easy": "Base", "recovery": "Recovery", "steady": "Aerobic", "tempo": "Tempo",
                             "intervals": "VO2 max", "long": "Base", "race": "Threshold"}.get(s.kind, "Base"),
                            int(round(sum(z[k] / 60 * (k + 1) for k in range(5)) * 1.1)),
                            int(round((z[1] + z[2]) / 60)), int(round((z[3] + z[4]) / 60)),
                            elev, elev, 30 + elev, 30, int(rng.uniform(55, 95)), "", "", round(1000 / (pace_of(s) * 60) * 1.25, 2), ""])
            if s.course or s.race:
                n = int(math.ceil(s.km))
                for lap in range(1, n + 1):
                    dist = 1000 if lap < n else int(round((s.km - (n - 1)) * 1000))
                    dur = int(round(pace_of(s) * 60 * dist / 1000 * (1 + rng.gauss(0, 0.03))))
                    laps.append([s.id, lap, dist, dur, dur - int(rng.uniform(0, 4)), hr_avg + int(rng.gauss(0, 4)),
                                 hr_max - int(rng.uniform(0, 8)), 178, "", int(round(elev / n)), int(round(elev / n)),
                                 round(1000 / (pace_of(s) * 60) * 1.2, 2), ""])
        if s.course:
            with open(os.path.join(raw, "streams", f"{s.id}.csv"), "w", newline="") as fh:
                csv.writer(fh).writerows(stream_rows(s, courses, rng))
        if s.course or s.race or (s.kind in ("tempo", "long") and i % 3 == 0):
            notes[s.id] = session_note(s, courses)
    with open(os.path.join(raw, "activities.json"), "w") as fh:
        json.dump(activities, fh, indent=1)
    for name, rows in [("zones.csv", zones), ("gear.csv", gearcsv), ("splits.csv", splits), ("zonekm.csv", zonekm),
                       ("weather.csv", weather), ("details.csv", details), ("laps.csv", laps)]:
        with open(os.path.join(raw, name), "w", newline="") as fh:
            csv.writer(fh).writerows(rows)
    load_rows, sleep_rows = daily_series(done, today, rng)
    with open(os.path.join(raw, "garmin_load.csv"), "w", newline="") as fh:
        csv.writer(fh).writerows(load_rows)
    with open(os.path.join(raw, "sleep.csv"), "w", newline="") as fh:
        csv.writer(fh).writerows(sleep_rows)
    with open(os.path.join(raw, "intraday.json"), "w") as fh:
        json.dump(intraday(today, rng), fh)
    with open(os.path.join(raw, "notes.json"), "w") as fh:
        json.dump(notes, fh, indent=1)
    weekly = weekly_summary(done)
    assessment, plan, racecast = coaching(done, planned, today, race, weekly)
    for name, blob in [("assessment.json", assessment), ("plan.json", plan), ("racecast.json", racecast)]:
        with open(os.path.join(raw, name), "w") as fh:
            json.dump(blob, fh, indent=1)
    last_load = load_rows[-1]
    context = {
        "athlete": dict(ATHLETE),
        "gear": [{"code": code, "name": name, "type": typ, "since": iso(today - timedelta(days=7 * since)),
                  "km": round(gear_km[code], 1), "activities": gear_n[code], "maxKm": max_km}
                 for code, name, typ, since, _, max_km in GEAR],
        "garminNow": {
            "date": iso(today), "trainingStatus": "PRODUCTIVE", "sport": "running",
            "acuteLoad": last_load[1], "chronicLoad": last_load[2],
            "optimalMin": int(round(last_load[2] * 0.8)), "optimalMax": int(round(last_load[2] * 1.3)),
            "loadRatio": round(last_load[1] / max(1, last_load[2]), 2), "acwrStatus": "OPTIMAL",
            "vo2max": ATHLETE["vo2maxRunning"],
            "monthlyLoadAerobicLow": 1180, "monthlyLoadAerobicHigh": 420, "monthlyLoadAnaerobic": 160,
            "balanceFeedback": "BALANCED",
            "readiness": {"score": 74, "level": "MODERATE", "feedback": "Recovered from this morning's reps; keep tomorrow easy.",
                          "sleepScore": sleep_rows[-1][1], "recoveryHours": 14, "hrvWeeklyAvg": 63,
                          "hrvFeedback": "BALANCED", "stressHistoryPercent": 22, "sleepHistoryPercent": 82},
            "racePredictions": {"5K": "21:10", "10K": "43:50", "half": "1:36:50", "marathon": "3:25:30"},
            "lthr": ATHLETE["lthr"],
        },
    }
    with open(os.path.join(raw, "context.json"), "w") as fh:
        json.dump(context, fh, indent=1)
    # maps.json: the extent of every streamed session on a tiled course, and
    # the tiles that exist on disk for it. A session whose tiles are not all
    # present gets no map, so the app never asks for a tile the ZIP does not hold.
    maps = {"_tiles": {}}
    for s in done:
        if not s.course:
            continue
        src = courses[s.course].get("tiles")
        if not src:
            maps[s.id] = None
            continue
        ext = segment_extent(courses, s)
        keys = [f"{ext['z']}/{x}/{y}" for x in range(ext["x0"], ext["x1"] + 1) for y in range(ext["y0"], ext["y1"] + 1)]
        present = [k for k in keys if os.path.exists(os.path.join(tiles_dir, k + ".png"))]
        if len(present) == len(keys):
            for k in keys:
                maps["_tiles"][k] = src
            maps[s.id] = dict(ext, src=[src])
        else:
            maps[s.id] = None
    with open(os.path.join(raw, "maps.json"), "w") as fh:
        json.dump(maps, fh, indent=0, sort_keys=True)
    return activities, maps


def weekly_summary(sessions):
    weeks = {}
    for s in sessions:
        if s.sport in ("running", "treadmill_running", "trail_running"):
            monday = s.day - timedelta(days=s.day.weekday())
            weeks.setdefault(monday, 0.0)
            weeks[monday] += s.km
    return [{"monday": iso(m), "km": km} for m, km in sorted(weeks.items())]


def segment_extent(courses, session):
    """The tile extent the app fits to this session's route — garmin_pull.map_extent
    over the segment's own coordinates, so it is what a real pull would fetch."""
    sys.path.insert(0, HERE)
    import garmin_pull as gp  # stdlib at import time; requests only inside fetch_tile
    pts, _ = segment(courses, session.course, session.start_km, session.km)
    return gp.map_extent([p[0] for p in pts], [p[1] for p in pts])


# ------------------------------------------------------------------- the tiles


def fetch_tiles(tiles_dir, done, courses, budget, byte_cap):
    """The basemap for every streamed session on a tiled course, through
    garmin_pull.fetch_tile — the same code and the same sources a real pull
    uses. Only a public-domain USGS tile is kept: if any other source answers
    (Kartverket cannot here; OpenStreetMap's tiles may not be redistributed),
    the run stops rather than commit it."""
    import time
    sys.path.insert(0, HERE)
    import garmin_pull as gp
    gp.TILES_DIR = tiles_dir
    wanted = {}
    for s in done:
        if not s.course or not courses[s.course].get("tiles"):
            continue
        ext = segment_extent(courses, s)
        for x in range(ext["x0"], ext["x1"] + 1):
            for y in range(ext["y0"], ext["y1"] + 1):
                wanted[(ext["z"], x, y)] = (s.course, courses[s.course]["tiles"])
    if len(wanted) > budget:
        raise SystemExit(f"{len(wanted)} tiles wanted, budget {budget}: shorten a segment or raise --tile-budget")
    fetched, total = 0, 0
    for (z, x, y), (name, expect) in sorted(wanted.items()):
        src = gp.fetch_tile(z, x, y)
        path = os.path.join(tiles_dir, str(z), str(x), f"{y}.png")
        total += os.path.getsize(path)
        if src:
            fetched += 1
            if src != expect:
                os.remove(path)
                raise SystemExit(f"tile {z}/{x}/{y} for {name} came from {src}, not {expect} — not shipping it")
            time.sleep(0.2)
        if total > byte_cap:
            raise SystemExit(f"tiles exceed {byte_cap} bytes at {z}/{x}/{y}; stop and trim")
    # Anything on disk that no session needs any more goes: the builder prunes
    # by inventory too, but only after maps.json says what is wanted.
    keep = {os.path.join(tiles_dir, str(z), str(x), f"{y}.png") for (z, x, y) in wanted}
    for root, _, files in os.walk(tiles_dir):
        for f in files:
            p = os.path.join(root, f)
            if p not in keep:
                os.remove(p)
    for root, dirs, files in list(os.walk(tiles_dir, topdown=False)):
        if root != tiles_dir and not dirs and not files:
            os.rmdir(root)
    print(f"tiles: {len(wanted)} wanted, {fetched} fetched now, {total / 1e6:.2f} MB on disk")


def probe_osm(courses):
    """Prove the OpenStreetMap fallback without keeping anything: one tile over
    Berlin into a temp dir, asserted to have come from osm, then deleted."""
    sys.path.insert(0, HERE)
    import garmin_pull as gp
    tmp = tempfile.mkdtemp(prefix="osm-probe-")
    gp.TILES_DIR = tmp
    pts, _ = segment(courses, "berlin", 0.0, 5.0)
    ext = gp.map_extent([p[0] for p in pts], [p[1] for p in pts])
    src = gp.fetch_tile(ext["z"], ext["x0"], ext["y0"])
    path = os.path.join(tmp, str(ext["z"]), str(ext["x0"]), f"{ext['y0']}.png")
    size = os.path.getsize(path)
    shutil.rmtree(tmp)
    print(f"probe: tile {ext['z']}/{ext['x0']}/{ext['y0']} over Berlin came from {src}, {size} bytes, deleted")
    if src != "osm":
        raise SystemExit("expected the OpenStreetMap fallback")


# --------------------------------------------------------------- verification


def verify(snapshot_path, streams_dir, tiles_dir, courses, today, race):
    """app.js validate() (lines 360–384), rule for rule, plus the demo's own
    invariants and the privacy rules the routes are meant to guarantee."""
    with open(snapshot_path) as fh:
        j = json.load(fh)
    problems = []
    if j.get("schema") != 1:
        problems.append("schema")
    try:
        datetime.fromisoformat(j["generatedAt"].replace("Z", "+00:00"))
    except Exception:
        problems.append("generatedAt")
    acts = j.get("activities")
    if not isinstance(acts, list) or not acts:
        problems.append("activities empty")
    else:
        for i, a in enumerate(acts):
            if not (isinstance(a.get("d"), str) and len(a["d"]) == 10 and isinstance(a.get("km"), (int, float))
                    and isinstance(a.get("min"), (int, float)) and isinstance(a.get("z"), list) and len(a["z"]) == 5):
                problems.append(f"activities[{i}]")
                break
            if abs(sum(a["z"]) - round(a["movMin"] * 60)) > 1:
                problems.append(f"activities[{i}] zones {sum(a['z'])} vs {a['movMin'] * 60}")
                break
            if "zk" in a and a.get("runKm") and abs(sum(a["zk"]) - a["runKm"]) > 0.05 + a["runKm"] * 0.02:
                problems.append(f"activities[{i}] zk {sum(a['zk'])} vs runKm {a['runKm']}")
                break
        if max(a["d"] for a in acts) > iso(today):
            problems.append("an activity after today")
    if not (isinstance(j.get("athlete"), dict) and len(j["athlete"].get("zoneFloors") or []) == 5):
        problems.append("athlete.zoneFloors")
    for k in ("garminLoad", "sleep", "gear"):
        if not isinstance(j.get(k), list):
            problems.append(k)
    if not isinstance(j.get("ask"), list) or not j["ask"]:
        problems.append("ask")
    if (j.get("plan") or {}).get("goal", {}).get("race", {}).get("date") != iso(race):
        problems.append("plan.goal.race.date")
    # Privacy: every coordinate inside a course's box, every id ours.
    boxes = {}
    for name, c in courses.items():
        lats = [p[0] for p in c["points"]]
        lons = [p[1] for p in c["points"]]
        boxes[name] = (min(lats) - 0.004, max(lats) + 0.004, min(lons) - 0.008, max(lons) + 0.008)
    streams = dict(j.get("streams") or {})
    for name in os.listdir(streams_dir) if os.path.isdir(streams_dir) else []:
        if name.endswith(".json"):
            with open(os.path.join(streams_dir, name)) as fh:
                streams[name[:-5]] = json.load(fh)
    for sid, s in streams.items():
        if not sid.startswith("demo-"):
            problems.append(f"stream id {sid}")
        for la, lo in zip(s.get("lat") or [], s.get("lon") or []):
            if la is None or lo is None:
                continue
            if not any(b[0] <= la <= b[1] and b[2] <= lo <= b[3] for b in boxes.values()):
                problems.append(f"stream {sid} has a coordinate outside every course box: {la},{lo}")
                break
    for a in acts or []:
        if not str(a["id"]).startswith("demo-"):
            problems.append(f"activity id {a['id']}")
            break
    for key in j.get("tiles") or []:
        if not os.path.exists(os.path.join(tiles_dir, key + ".png")):
            problems.append(f"tile {key} listed but missing")
            break
    if os.path.isdir(tiles_dir):
        for z in os.listdir(tiles_dir):
            if not os.path.isdir(os.path.join(tiles_dir, z)):
                problems.append(f"a file under data/tiles: {z} (prune_tiles would crash)")
    return problems


# ---------------------------------------------------------------------- main


def generate(out_root, today, race, seed, courses, keep_raw=None, tiles=False, tile_budget=64, tile_bytes=3_000_000):
    rng = random.Random(seed)
    app_dir = os.path.join(out_root, APP)
    data_dir = os.path.join(app_dir, "data")
    tiles_dir = os.path.join(data_dir, "tiles")
    os.makedirs(data_dir, exist_ok=True)
    planned = plan_block(race, rng)
    done = [s for s in planned if s.day <= today]
    assign_streams(done, courses)
    if tiles:
        fetch_tiles(tiles_dir, done, courses, tile_budget, tile_bytes)
    raw = keep_raw or tempfile.mkdtemp(prefix="demo-raw-")
    os.makedirs(raw, exist_ok=True)
    write_raw(raw, done, planned, today, race, courses, rng, tiles_dir)
    snapshot = os.path.join(data_dir, "snapshot.json")
    subprocess.run([sys.executable, os.path.join(HERE, "build_garmin_snapshot.py"), "--raw", raw, "--out", snapshot], check=True)
    # generatedAt is the demo's afternoon, not the build time, so the output is
    # a pure function of this file and --check can compare whole files.
    with open(snapshot) as fh:
        j = json.load(fh)
    j["generatedAt"] = f"{iso(today)}T14:20:00Z"
    with open(snapshot, "w") as fh:
        json.dump(j, fh, separators=(",", ":"))
        fh.write("\n")
    problems = verify(snapshot, os.path.join(data_dir, "streams"), tiles_dir, courses, today, race)
    if not keep_raw:
        shutil.rmtree(raw, ignore_errors=True)
    return done, problems


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--today", help="the demo's last day of data, a Wednesday (default: the last one on or before today)")
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--out-root", default=ROOT, help="the repository root to write under")
    ap.add_argument("--keep-raw", help="write the synthetic raw store here and keep it")
    ap.add_argument("--tiles", action="store_true", help="fetch the USGS basemap for the US courses")
    ap.add_argument("--tile-budget", type=int, default=64)
    ap.add_argument("--tile-bytes", type=int, default=3_000_000)
    ap.add_argument("--check", action="store_true", help="regenerate to a temp dir and diff against the committed data")
    ap.add_argument("--probe-osm", action="store_true", help="prove the OpenStreetMap fallback; keeps nothing")
    ap.add_argument("--verify", action="store_true", help="run the checks over the committed data and exit")
    args = ap.parse_args()
    courses = load_courses()
    if args.probe_osm:
        probe_osm(courses)
        return
    data_dir = os.path.join(args.out_root, APP, "data")
    if args.check or args.verify:
        today, race = demo_dates(committed_today(os.path.join(data_dir, "snapshot.json")))
    else:
        today, race = demo_dates(date.fromisoformat(args.today) if args.today else None)
    if today.weekday() != 2:
        raise SystemExit("--today must be a Wednesday, the demo's day in week 12")
    if args.verify:
        problems = verify(os.path.join(data_dir, "snapshot.json"), os.path.join(data_dir, "streams"),
                          os.path.join(data_dir, "tiles"), courses, today, race)
        print("verify:", "ok" if not problems else problems)
        sys.exit(1 if problems else 0)
    if args.check:
        tmp = tempfile.mkdtemp(prefix="demo-check-")
        # The committed tiles are inputs (they decide which sessions get a map),
        # so the check builds against a copy of them. Copied, never linked: the
        # builder prunes under its own data/tiles, and a link would let a check
        # delete the committed tiles.
        os.makedirs(os.path.join(tmp, APP, "data"), exist_ok=True)
        real_tiles = os.path.join(data_dir, "tiles")
        if os.path.isdir(real_tiles):
            shutil.copytree(real_tiles, os.path.join(tmp, APP, "data", "tiles"))
        _, problems = generate(tmp, today, race, args.seed, courses)
        drift = []
        for name in ["snapshot.json"] + sorted(f"streams/{n}" for n in os.listdir(os.path.join(tmp, APP, "data", "streams"))):
            a, b = os.path.join(data_dir, name), os.path.join(tmp, APP, "data", name)
            if not os.path.exists(a) or open(a, "rb").read() != open(b, "rb").read():
                drift.append(name)
        shutil.rmtree(tmp, ignore_errors=True)
        if problems or drift:
            print("check: problems", problems, "drift", drift)
            sys.exit(1)
        print("check: the committed data is what the generator makes")
        return
    done, problems = generate(args.out_root, today, race, args.seed, courses, keep_raw=args.keep_raw, tiles=args.tiles,
                              tile_budget=args.tile_budget, tile_bytes=args.tile_bytes)
    runs = [s for s in done if s.sport in ("running", "treadmill_running")]
    print(f"demo: {len(done)} sessions through {iso(today)}, {len(runs)} runs, {sum(s.km for s in runs):.0f} km, "
          f"{sum(1 for s in done if s.course)} with streams, race on {iso(race)}")
    if problems:
        print("verify:", problems)
        sys.exit(1)
    print("verify: ok")


if __name__ == "__main__":
    main()
