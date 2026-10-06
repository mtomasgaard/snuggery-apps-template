#!/usr/bin/env python3
"""Write the daylight-saving fixtures that tools/test_dst.mjs and scripts/tests/ read.

What Open-Meteo does across a change of the clocks, measured on 2026-10-06 (tools/DECISIONS.md, D-DST):
with timezone=auto (or a named zone) every hourly and daily time in one reply is written on ONE offset,
utc_offset_seconds, which is the place's offset at the moment of the request. No hour is repeated or skipped,
and the values are the UTC series shifted by that constant offset. So a file fetched in Oslo on Saturday
24 October 2026 labels the hours after 03:00 on the 25th in UTC+2, while Oslo's clocks read UTC+1.

Each fixture is the reply the Shortcut's address (scripts/outdoor_window.py --url) would have delivered at
noon on the day before a change: 48 hours from 12:00, three days of sunrise and sunset. The values are real
ones from Open-Meteo's historical-forecast API, asked for on the fetch-time offset (timezone=auto when that
is still today's offset, Etc/GMT-1 for Oslo's winter time), then given the place's own zone name as the
live reply carries it. The 2026 autumn files move the 2025 replies forward 364 days, weekday for weekday,
because the forecasts for those nights do not exist yet; the offsets are the same on both nights.

    python3 tools/dst/make_fixtures.py      # needs the network; rewrites the five files here
"""

import datetime as dt
import json
import pathlib
import urllib.parse
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
API = "https://historical-forecast-api.open-meteo.com/v1/forecast"
HOURLY = "temperature_2m,precipitation_probability,precipitation,wind_gusts_10m,dew_point_2m,cloud_cover,is_day"

# name, lat, lon, zone, fetch-time zone for the API, abbreviation, first day, days to move forward
CASES = [
    ("oslo-fall-2025", 59.91, 10.75, "Europe/Oslo", "auto", "GMT+2", "2025-10-25", 0),
    ("oslo-fall-2026", 59.91, 10.75, "Europe/Oslo", "auto", "GMT+2", "2025-10-25", 364),
    ("oslo-spring-2026", 59.91, 10.75, "Europe/Oslo", "Etc/GMT-1", "GMT+1", "2026-03-28", 0),
    ("boston-fall-2025", 42.355, -71.066, "America/New_York", "auto", "GMT-4", "2025-11-01", 0),
    ("boston-fall-2026", 42.355, -71.066, "America/New_York", "auto", "GMT-4", "2025-11-01", 364),
]


def get(lat, lon, zone, first):
    last = (dt.date.fromisoformat(first) + dt.timedelta(days=2)).isoformat()
    url = (f"{API}?latitude={lat}&longitude={lon}&hourly={HOURLY}&daily=sunrise,sunset&wind_speed_unit=kmh"
           f"&timezone={urllib.parse.quote(zone, safe='')}&start_date={first}&end_date={last}")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "outdoor-window fixtures"}), timeout=60) as r:
        return json.loads(r.read())


def move(stamp, days):
    if not days:
        return stamp
    fmt = "%Y-%m-%dT%H:%M" if "T" in stamp else "%Y-%m-%d"
    return (dt.datetime.strptime(stamp, fmt) + dt.timedelta(days=days)).strftime(fmt)


def main():
    for name, lat, lon, zone, ask_zone, abbr, first, days in CASES:
        d = get(lat, lon, ask_zone, first)
        start = d["hourly"]["time"].index(f"{first}T12:00")
        hourly = {k: v[start:start + 48] for k, v in d["hourly"].items()}
        hourly["time"] = [move(t, days) for t in hourly["time"]]
        daily = {k: [move(t, days) for t in v] for k, v in d["daily"].items()}
        out = {
            "latitude": d["latitude"], "longitude": d["longitude"], "generationtime_ms": 0.1,
            "utc_offset_seconds": d["utc_offset_seconds"], "timezone": zone, "timezone_abbreviation": abbr,
            "elevation": d["elevation"],
            "current_units": {"time": "iso8601", "interval": "seconds", "temperature_2m": "°C", "is_day": ""},
            "current": {"time": hourly["time"][0], "interval": 900,
                        "temperature_2m": hourly["temperature_2m"][0], "is_day": hourly["is_day"][0]},
            "hourly_units": d["hourly_units"], "hourly": hourly,
            "daily_units": d["daily_units"], "daily": daily,
        }
        (HERE / f"{name}.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{name}.json: {hourly['time'][0]} to {hourly['time'][-1]} on UTC{out['utc_offset_seconds'] / 3600:+g}")


if __name__ == "__main__":
    main()
