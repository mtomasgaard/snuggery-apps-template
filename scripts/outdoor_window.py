#!/usr/bin/env python3
"""Outdoor Window — fetch the demo forecast, and check the committed one.

WHAT THIS SCRIPT IS FOR, AND WHAT IT IS NOT FOR
-----------------------------------------------
Outdoor Window is the one app in this repository with **no GitHub Action**.
Its data comes from the phone: a Shortcut asks for the phone's own location,
fetches the forecast for that spot from Open-Meteo, and hands the reply
straight to Snuggery's *Update a File in a Snuggery App* action, which writes
it over ``outdoor-window/data/snapshot.json`` inside the installed app. The
location never leaves the phone except to Open-Meteo, and nothing of it is
ever committed here. The recipe is in ``outdoor-window/PROMPT.md``.

So this script exists for two smaller jobs:

  --demo    Fetch a real 48-hour forecast for a public place (Boston Common by
            default) and write it to outdoor-window/data/snapshot.json, in
            exactly the shape the Shortcut delivers. This is the data a freshly
            installed copy shows before anyone builds the Shortcut.
  --check   Read the committed snapshot and rules and prove they still hold to
            the contract the app expects: required hourly variables present,
            arrays the same length, a derivable timestamp, and an `ask` table
            that is what the scorer below makes from those two files.
  --url     Print the exact Open-Meteo address the Shortcut should fetch, with
            the latitude and longitude left as placeholders.

Why there is no byte-for-byte ``--check`` like the running dashboard's: that
demo is generated from a seed, so its bytes are reproducible. This one is a
**live pull of real weather**, and running it twice five minutes apart gives
two different, equally correct files. What is checkable is the shape and the
derived table, and that is what --check checks.

Standard library only. No third-party imports, by design: this has to run on a
bare GitHub runner and on a stranger's laptop with nothing installed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "outdoor-window"
SNAPSHOT = APP / "data" / "snapshot.json"
RULES = APP / "data" / "rules.json"

# Named so the people running Open-Meteo's free service can see who is calling.
# GitHub sets GITHUB_REPOSITORY in Actions; running it by hand falls back to the
# template's own name. Change it to your own repository when you copy this
# template, if you would rather it were always named.
_repo = os.environ.get("GITHUB_REPOSITORY", "snuggery-apps-template")
USER_AGENT = f"outdoor-window demo pull (+https://github.com/{_repo})"

# Boston Common: a public park, chosen for the demo precisely because it is
# nobody's home. Never put your own coordinates here — this file is committed.
DEMO_PLACE = "Boston Common"
DEMO_LAT = 42.355
DEMO_LON = -71.066

# The hourly variables the app scores. Keep this list and the one in app.js in
# step; the app names any that are missing rather than drawing a blank strip.
HOURLY_VARS = [
    "temperature_2m",
    "precipitation_probability",
    "precipitation",
    "wind_gusts_10m",
    "dew_point_2m",
    "cloud_cover",
    "is_day",
]

FORECAST_HOURS = 48

API_HOST = "https://api.open-meteo.com/v1/forecast"


def forecast_url(lat: str, lon: str) -> str:
    """The one address the Shortcut fetches, and the one this script fetches.

    ``forecast_hours=48`` starts the hourly arrays at the **current** hour
    rather than at local midnight, so the app never has to throw away a
    morning that has already happened. ``forecast_days=3`` is only there to
    make the daily sunrise/sunset arrays cover every date those 48 hours touch.
    ``timezone=auto`` returns local wall-clock times for the forecast's own
    place, with ``utc_offset_seconds`` beside them so the app can turn them
    back into instants.
    """
    query = [
        ("latitude", lat),
        ("longitude", lon),
        ("hourly", ",".join(HOURLY_VARS)),
        ("daily", "sunrise,sunset"),
        ("current", "temperature_2m,is_day"),
        ("timezone", "auto"),
        ("forecast_hours", str(FORECAST_HOURS)),
        ("forecast_days", "3"),
        ("wind_speed_unit", "kmh"),
    ]
    return API_HOST + "?" + "&".join(f"{k}={v}" for k, v in query)


def fetch(lat: float, lon: float, timeout: int = 30) -> dict:
    url = forecast_url(f"{lat}", f"{lon}")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    # Open-Meteo answers a bad request with HTTP 400 and a JSON body that is
    # perfectly valid JSON — exactly the trap the app warns about on screen.
    if isinstance(payload, dict) and payload.get("error"):
        raise SystemExit(f"Open-Meteo refused the request: {payload.get('reason')}")
    return payload


# ---------------------------------------------------------------------------
# Scoring — the mirror of the same logic in outdoor-window/app.js
# ---------------------------------------------------------------------------
# The app has to score whatever the phone delivers, which is the raw reply with
# no `ask` table in it, so the scoring cannot live only here. This copy exists
# to write the demo's `ask` rows, and its numbers must match the app's. If you
# change a formula, change both, and run --check.


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _local_to_epoch(stamp: str, offset_seconds: int) -> float:
    """'2026-09-21T05:00' plus an offset -> epoch seconds."""
    naive = dt.datetime.strptime(stamp[:16], "%Y-%m-%dT%H:%M")
    return naive.replace(tzinfo=dt.timezone.utc).timestamp() - offset_seconds


def _is_number(value) -> bool:
    """app.js's isNumber(), exactly: a real number, and `true` is not one.

    The script has to agree with the app on what counts as a usable value,
    because a rules.json edited by hand on a phone can hold `"35"` where a
    number was meant, and Open-Meteo returns nulls for a variable the chosen
    model does not produce. app.js shows "not used" for such a rule; without
    this the script raised a TypeError instead.
    """
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _max_rule(value, limit):
    """A 'no more than' rule: (passes, comfort 0..1).

    The order of these two guards is load-bearing and mirrors app.js's
    `maxRule` (which returns null — rule not in use — before it looks at the
    value). Test the value first and a rule the person deliberately left out of
    rules.json turns into a phantom blocker whenever the forecast has a null in
    that column.
    """
    if not _is_number(limit):
        return True, None
    if not _is_number(value):
        return False, 0.0
    if limit <= 0:
        return value <= 0, 1.0 if value <= 0 else 0.0
    return value <= limit, _clamp((limit - value) / limit)


def _band_rule(value, band):
    """A 'between these two' rule: (passes, comfort 0..1)."""
    if not isinstance(band, dict):
        return True, None
    low, high = band.get("min"), band.get("max")
    if not _is_number(low) or not _is_number(high):
        return True, None
    if not _is_number(value):
        return False, 0.0
    if high <= low:
        return value == low, 1.0 if value == low else 0.0
    half = (high - low) / 2.0
    middle = (high + low) / 2.0
    return low <= value <= high, _clamp((half - abs(value - middle)) / half)


def score_hours(snapshot: dict, rules: dict) -> list[dict]:
    """One scored row per hourly step, oldest first."""
    hourly = snapshot.get("hourly") or {}
    times = hourly.get("time") or []
    offset = int(snapshot.get("utc_offset_seconds") or 0)
    daily = snapshot.get("daily") or {}
    sun = {}
    for index, day in enumerate(daily.get("time") or []):
        rise = (daily.get("sunrise") or [None] * (index + 1))[index]
        set_ = (daily.get("sunset") or [None] * (index + 1))[index]
        sun[day] = (rise, set_)

    daylight_rule = (rules.get("daylight") or "any").lower()
    golden = rules.get("goldenHourMinutes")
    golden_minutes = float(golden) if _is_number(golden) else 0.0

    rows = []
    for i, stamp in enumerate(times):

        def at(name):
            series = hourly.get(name)
            if not isinstance(series, list) or i >= len(series):
                return None
            return series[i]

        temp = at("temperature_2m")
        rain_pct = at("precipitation_probability")
        precip = at("precipitation")
        gust = at("wind_gusts_10m")
        dew = at("dew_point_2m")
        cloud = at("cloud_cover")
        is_day = at("is_day")

        checks = []  # (key, label, passes, comfort, detail)
        ok, comfort = _max_rule(rain_pct, rules.get("maxRainChancePct"))
        checks.append(("rain", "rain chance", ok, comfort))
        ok, comfort = _max_rule(precip, rules.get("maxPrecipMm"))
        checks.append(("rainfall", "rainfall", ok, comfort))
        ok, comfort = _max_rule(gust, rules.get("maxGustKmh"))
        checks.append(("gust", "gusts", ok, comfort))
        ok, comfort = _band_rule(temp, rules.get("temperatureC"))
        checks.append(("temp", "temperature", ok, comfort))
        ok, comfort = _band_rule(dew, rules.get("dewPointC"))
        checks.append(("dew", "dew point", ok, comfort))

        # Daylight, and its narrower cousin, the golden hour.
        daylight_label = "night"
        if is_day == 1:
            daylight_label = "day"
        golden = False
        day_key = stamp[:10]
        rise, set_ = sun.get(day_key, (None, None))
        if rise and set_ and golden_minutes > 0:
            here = _local_to_epoch(stamp, offset)
            rise_at = _local_to_epoch(rise, offset)
            set_at = _local_to_epoch(set_, offset)
            span = golden_minutes * 60
            golden = (rise_at <= here <= rise_at + span) or (set_at - span <= here <= set_at)
        if golden:
            daylight_label = "golden"

        if daylight_rule == "daylight":
            checks.append(("light", "daylight", is_day == 1, 1.0 if is_day == 1 else 0.0))
        elif daylight_rule == "golden":
            checks.append(("light", "golden hour", golden, 1.0 if golden else 0.0))

        comforts = [c for (_, _, _, c) in checks if c is not None]
        passes = all(p for (_, _, p, _) in checks)
        blocked = [label for (_, label, p, _) in checks if not p]
        score = int(round(100 * (sum(comforts) / len(comforts)))) if comforts else 0

        rows.append(
            {
                "index": i,
                "time": stamp,
                "epoch": _local_to_epoch(stamp, offset),
                "pass": passes,
                "score": score,
                "blocked": blocked,
                "temp": temp,
                "rainPct": rain_pct,
                "precip": precip,
                "gust": gust,
                "dew": dew,
                "cloud": cloud,
                "daylight": daylight_label,
            }
        )
    return rows


WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def ask_rows(snapshot: dict, rules: dict) -> list[dict]:
    """The flat table Snuggery's *Ask About This Data* reads: one row per hour.

    Flat objects, plain keys, numbers or short strings, 48 rows. No nested
    objects, because the reader is a table, not a parser.
    """
    rows = []
    for row in score_hours(snapshot, rules):
        stamp = row["time"]
        date = stamp[:10]
        weekday = WEEKDAYS[dt.date.fromisoformat(date).weekday()]
        rows.append(
            {
                "date": date,
                "weekday": weekday,
                "time": stamp[11:16],
                "pass": "yes" if row["pass"] else "no",
                "score": row["score"],
                "tempC": row["temp"],
                "rainChancePct": row["rainPct"],
                "rainMm": row["precip"],
                "gustKmh": row["gust"],
                "dewPointC": row["dew"],
                "cloudPct": row["cloud"],
                "daylight": row["daylight"],
                "blockedBy": ", ".join(row["blocked"]) if row["blocked"] else "",
            }
        )
    return rows


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def load_rules() -> dict:
    return json.loads(RULES.read_text(encoding="utf-8"))


def write_demo(lat: float, lon: float, place: str) -> None:
    payload = fetch(lat, lon)
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)

    # These three keys are the whole difference between what this script writes
    # and what the Shortcut writes. The app needs none of them — it derives the
    # stamp from `current.time` and scores the hours itself — but a committed
    # demo should carry the table Ask reads, and a stamp that does not depend
    # on the reader's clock agreeing with Open-Meteo's.
    payload["schema"] = 1
    payload["generatedAt"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    payload["demoPlace"] = place
    payload["ask"] = ask_rows(payload, load_rules())

    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")
    hours = len(payload.get("hourly", {}).get("time", []))
    size = SNAPSHOT.stat().st_size
    good = sum(1 for r in payload["ask"] if r["pass"] == "yes")
    print(f"wrote {SNAPSHOT} — {place}, {hours} hours, {good} of them good, {size:,} bytes")


def check() -> int:
    problems: list[str] = []
    try:
        snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    except Exception as error:  # noqa: BLE001 - the message is the point
        print(f"FAIL  {SNAPSHOT}: {error}")
        return 1
    try:
        rules = load_rules()
    except Exception as error:  # noqa: BLE001
        print(f"FAIL  {RULES}: {error}")
        return 1

    hourly = snapshot.get("hourly")
    if not isinstance(hourly, dict) or not isinstance(hourly.get("time"), list):
        problems.append("hourly.time is missing — this is not an Open-Meteo forecast reply")
    else:
        hours = len(hourly["time"])
        if hours < 24:
            problems.append(f"only {hours} hourly steps; the app expects about {FORECAST_HOURS}")
        for name in HOURLY_VARS:
            series = hourly.get(name)
            if not isinstance(series, list):
                problems.append(f"hourly.{name} is missing")
            elif len(series) != hours:
                problems.append(f"hourly.{name} has {len(series)} values for {hours} hours")

    if not isinstance(snapshot.get("utc_offset_seconds"), (int, float)):
        problems.append("utc_offset_seconds is missing — local times cannot be placed on a clock")

    daily = snapshot.get("daily") or {}
    for name in ("time", "sunrise", "sunset"):
        if not isinstance(daily.get(name), list):
            problems.append(f"daily.{name} is missing — the golden-hour rule cannot be scored")

    # A rules.json edited by hand — on the phone, in App Files, which is the
    # point of the file — can easily hold "35" where 35 was meant. The app
    # shows such a rule as "not used"; this says so in words instead of the
    # TypeError the scorer used to raise.
    for key in ("maxRainChancePct", "maxPrecipMm", "maxGustKmh", "goldenHourMinutes", "minWindowHours"):
        value = rules.get(key)
        if value is not None and not _is_number(value):
            problems.append(
                f"rules.json: {key} is {value!r}, not a number, so that rule is not being applied"
            )
    for key in ("temperatureC", "dewPointC"):
        band = rules.get(key)
        if band is None:
            continue
        if not isinstance(band, dict):
            problems.append(f"rules.json: {key} is {band!r}, not a {{min, max}} object, so that rule is not being applied")
            continue
        for edge in ("min", "max"):
            value = band.get(edge)
            if value is not None and not _is_number(value):
                problems.append(
                    f"rules.json: {key}.{edge} is {value!r}, not a number, so that rule is not being applied"
                )

    stamp = snapshot.get("generatedAt")
    current = (snapshot.get("current") or {}).get("time")
    if not isinstance(stamp, str) and not isinstance(current, str):
        problems.append("neither generatedAt nor current.time is present; the app cannot date this file")

    expected = ask_rows(snapshot, rules)
    got = snapshot.get("ask")
    if not isinstance(got, list):
        problems.append("no top-level ask array — Snuggery's Ask would have only the raw file to read")
    elif got != expected:
        problems.append(
            f"the committed ask table is not what the scorer makes from this snapshot and these rules "
            f"({len(got)} rows committed, {len(expected)} recomputed)"
        )
    elif len(got) > 200:
        problems.append(f"{len(got)} ask rows — keep it to a couple of hundred")

    for row in got if isinstance(got, list) else []:
        for key, value in row.items():
            if isinstance(value, (dict, list)):
                problems.append(f"ask row key {key!r} holds a nested value; rows must be flat")
                break

    size = SNAPSHOT.stat().st_size + RULES.stat().st_size
    if size > 400_000:
        problems.append(f"data/ is {size:,} bytes; this app's should stay well under 400 kB")

    if problems:
        for problem in problems:
            print(f"FAIL  {problem}")
        return 1
    print(
        f"ok  {SNAPSHOT.name}: {len(hourly['time'])} hours, {len(got)} ask rows, "
        f"{size:,} bytes of data/, every required variable present"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--demo", action="store_true", help="fetch a real forecast for a public place and write the demo snapshot")
    parser.add_argument("--check", action="store_true", help="prove the committed snapshot and rules hold to the app's contract")
    parser.add_argument("--url", action="store_true", help="print the address the Shortcut should fetch")
    parser.add_argument("--lat", type=float, default=DEMO_LAT, help=f"latitude for --demo (default {DEMO_LAT}, {DEMO_PLACE})")
    parser.add_argument("--lon", type=float, default=DEMO_LON, help=f"longitude for --demo (default {DEMO_LON})")
    parser.add_argument("--place", default=DEMO_PLACE, help="the name shown on the demo's header")
    args = parser.parse_args()

    if args.url:
        print(forecast_url("<latitude>", "<longitude>"))
        return 0
    if args.check:
        return check()
    if args.demo:
        try:
            write_demo(args.lat, args.lon, args.place)
        except urllib.error.URLError as error:
            print(f"could not reach Open-Meteo: {error}", file=sys.stderr)
            return 1
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
