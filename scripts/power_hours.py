#!/usr/bin/env python3
"""Power Hours — day-ahead electricity prices for one bidding zone.

Writes power-hours/data/snapshot.json. Standard library only; no key, no
account, no registration.

WHAT IT FETCHES
---------------
    GET https://api.energy-charts.info/price?bzn=<ZONE>&start=<date>&end=<date>

Energy-Charts, run by Fraunhofer ISE, answers with the day-ahead spot curve for
one local calendar day:

    {"license_info": str, "unix_seconds": [int], "price": [float],
     "unit": "EUR / MWh", "deprecated": bool}

`unix_seconds[i]` is the START of the interval `price[i]` applies to. The
European day-ahead market settles in 15-minute intervals now, so a day is 96
points rather than 24; the script derives the step from the data and never
assumes either.

LICENCE — READ THIS BEFORE CHANGING THE ZONE
--------------------------------------------
Sixteen bidding zones are CC BY 4.0 and may be republished; every other zone is
private and internal use only, so its numbers must not be committed to a public
repository. `CC_BY_ZONES` below is the list, and the script refuses to write a
snapshot for any other zone unless you pass --private-use, which also marks the
snapshot so the app prints the restriction on screen. power-hours/NOTES.md
quotes the operative sentences.

THE SHAPE IT WRITES
-------------------
    {
      "schema": 1,
      "generatedAt": "2026-09-21T09:40:00Z",   ISO 8601 UTC — when this ran
      "zone": "NO2", "zoneName": "...", "timezone": "Europe/Oslo",
      "unit": "EUR/MWh",                        the source's unit, unconverted
      "resolutionMinutes": 15,                  length of one entry in hours[]
      "source": {"name","endpoint","licence","publishable","attribution",
                 "licenceInfo"},             what the API said about THIS answer

      "days": [                                 today first, then tomorrow
        {"date":"2026-09-21","label":"Today","source":"fetched",
         "intervals":96,"min":7.73,"max":152.67,"mean":41.2}
      ],                                        source: fetched | carried
                                                        | pending | failed

      "hours": [{"start":"2026-09-21T00:00:00+02:00","price":18.71}],
                                                local ISO with offset, ascending

      "lastGood": null,                         or {"generatedAt","days","hours"}
                                                when THIS run fetched nothing at
                                                all: the app draws that curve and
                                                stamps it stale rather than
                                                showing an error

      "ask": [ ... ]                            flat rows — see below
    }

`hours` is the curve to draw. It is empty only when this run fetched nothing and
there was a previous curve to fall back to, which is what `lastGood` carries.
`days[].source` says where each day came from when a run got one day and not the
other: `carried` is a day kept from the previous snapshot, `pending` is
tomorrow before the auction publishes it (~13:00 CET), `failed` is an outage.

The `ask` array is the only part Snuggery reads when someone asks a question
about this app's data. Flat rows, plain keys, short values:

    {"row":"hour","day":"Today","date":"2026-09-21","time":"14:00",
     "price":22.4,"unit":"EUR/MWh","rank":3,"ofHours":24,"vsMeanPct":-46}
    {"row":"appliance","day":"Today","date":"2026-09-21","appliance":"Dishwasher",
     "runHours":2,"windowScope":"whole day","cheapestStart":"03:00",
     "cheapestEnd":"05:00","avgPrice":11.3,"dayMean":41.2,"savingPct":73,
     "unit":"EUR/MWh"}

One hour row per clock hour per day (the mean of the intervals inside it, so a
question in words gets an answer in hours), and one appliance row per appliance
per scope: the whole day, plus — for the day this job ran on — the stretch that
was still ahead when it ran, which is what the app itself plans over.
`windowScope` says which of the two a row is, because the two genuinely differ
and an unlabelled mixture answers "when should I run the dishwasher?" with a
time that has already passed. About 60 rows for two days and four appliances.

`vsMeanPct` and `savingPct` are ABSENT on a day whose mean is zero or below: a
percentage against a negative denominator inverts, so cheaper would read as
dearer. `dayMean` is in every appliance row to compare against directly.

RUNNING IT
----------
    python3 scripts/power_hours.py                 # the real pull
    python3 scripts/power_hours.py --demo          # no network, a made-up curve
    python3 scripts/power_hours.py --out /tmp/s.json   # write somewhere else
    python3 scripts/power_hours.py --zone DK1      # another CC BY zone

RATE LIMIT
----------
Energy-Charts limits /price to 2 requests per minute per IP, burst 2, lowered
further when its servers are busy. This script makes at most two requests per
run and honours the Retry-After header on a 429. Do not run it in a loop.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

# --------------------------------------------------------------------------
# The zone set. Change ZONE to your own bidding zone — and read CC_BY_ZONES
# first, because the licence differs per zone.
# --------------------------------------------------------------------------

ZONE = "NO2"

# The sixteen zones Energy-Charts publishes under CC BY 4.0 (from
# Bundesnetzagentur | SMARD.de). Every other zone the API offers is private and
# internal use only — fine on your own machine, not fine in a public repository.
CC_BY_ZONES = [
    "AT", "BE", "CH", "CZ", "DE-LU", "DE-AT-LU", "DK1", "DK2", "FR", "HU",
    "IT-North", "NL", "NO2", "PL", "SE4", "SI",
]

# Human names for the zones this script knows about. A zone missing from here
# still works; it just shows its code.
ZONE_NAMES = {
    "AT": "Austria", "BE": "Belgium", "CH": "Switzerland", "CZ": "Czechia",
    "DE-LU": "Germany and Luxembourg", "DE-AT-LU": "Germany, Austria and Luxembourg",
    "DK1": "Denmark west", "DK2": "Denmark east", "FR": "France", "HU": "Hungary",
    "IT-North": "Northern Italy", "NL": "Netherlands", "NO1": "Norway east",
    "NO2": "Norway south-west", "NO3": "Norway mid", "NO4": "Norway north",
    "NO5": "Norway west", "PL": "Poland", "SE1": "Sweden north",
    "SE2": "Sweden north-central", "SE3": "Sweden south-central",
    "SE4": "Sweden south", "SI": "Slovenia", "ES": "Spain", "PT": "Portugal",
    "FI": "Finland", "EE": "Estonia", "LV": "Latvia", "LT": "Lithuania",
    "GR": "Greece", "BG": "Bulgaria", "RO": "Romania", "IE(SEM)": "Ireland and Northern Ireland",
}

# The local calendar the market settles on. Every zone above except the three
# listed here keeps Central European Time, which is why Europe/Berlin is the
# fallback: it is the right answer for most of the list and one hour out at
# worst.
ZONE_TIMEZONES = {
    "NO1": "Europe/Oslo", "NO2": "Europe/Oslo", "NO3": "Europe/Oslo",
    "NO4": "Europe/Oslo", "NO5": "Europe/Oslo",
    "SE1": "Europe/Stockholm", "SE2": "Europe/Stockholm",
    "SE3": "Europe/Stockholm", "SE4": "Europe/Stockholm",
    "DK1": "Europe/Copenhagen", "DK2": "Europe/Copenhagen",
    "FI": "Europe/Helsinki", "EE": "Europe/Tallinn", "LV": "Europe/Riga",
    "LT": "Europe/Vilnius", "PT": "Europe/Lisbon",
    # Eastern European and Western European time — the zones whose calendar day
    # genuinely differs from CET. Everything not listed keeps CET, which is the
    # right answer for the rest of the list.
    "GR": "Europe/Athens", "BG": "Europe/Sofia", "RO": "Europe/Bucharest",
    "UA-IPS": "Europe/Kyiv", "UA-BEI": "Europe/Kyiv", "IE(SEM)": "Europe/Dublin",
}
DEFAULT_TIMEZONE = "Europe/Berlin"

ENDPOINT = "https://api.energy-charts.info/price"

# Identify the job. GitHub sets GITHUB_REPOSITORY in Actions; running it by hand
# falls back to the template's own name. Put your repository here if you would
# rather it were always named.
_repo = os.environ.get("GITHUB_REPOSITORY", "snuggery-apps-template")
USER_AGENT = f"power-hours snapshot job (+https://github.com/{_repo})"

TIMEOUT = 30
RETRIES = 3

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "power-hours"
DEFAULT_OUT = APP / "data" / "snapshot.json"
APPLIANCES = APP / "data" / "appliances.json"

# Used only when data/appliances.json is missing — the file is the real list,
# and a person edits it in Snuggery's App Files.
FALLBACK_APPLIANCES = [
    {"name": "Dishwasher", "hours": 2},
    {"name": "Washing machine", "hours": 1.5},
    {"name": "Car charging", "hours": 4},
    {"name": "Tumble dryer", "hours": 2},
]


# ------------------------------------------------------------------ fetching


class FetchError(Exception):
    """The API did not answer with a usable curve."""

    def __init__(self, message: str, pending: bool = False):
        super().__init__(message)
        self.pending = pending  # tomorrow simply has not been published yet


def fetch_day(zone: str, day: dt.date) -> tuple[list[tuple[int, float]], str]:
    """One day's curve and its licence: ([(unix start, price), ...], licence).

    The second value is the answer's own `license_info` — the API's
    authoritative, per-response statement of what may be done with the numbers
    it just returned. CC_BY_ZONES above is a copy of a decision that is the
    API's to change, so the caller compares the two and stops rather than
    republishing on the strength of a stale list.

    Raises FetchError(pending=True) on the 404 the API returns before an
    auction has published — that is the normal state of tomorrow all morning,
    not a fault.
    """
    url = f"{ENDPOINT}?bzn={urllib.parse.quote(zone)}&start={day}&end={day}"
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    })

    last = ""
    for attempt in range(RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as error:
            if error.code == 404:
                raise FetchError(f"no prices published for {day}", pending=True)
            if error.code == 429:
                # The API asks clients to honour Retry-After rather than guess.
                wait = error.headers.get("Retry-After")
                # Honoured, but not unbounded: a header of 999999 — wrong or
                # hostile — would park this job until the runner's own timeout
                # killed it, and the concurrency group would hold the second
                # chance behind it for the rest of the day. Two minutes is
                # longer than any honest /price backoff.
                delay = min(int(wait), 120) if wait and wait.isdigit() else 30 * (attempt + 1)
                last = f"rate limited, waiting {delay}s"
                print(f"  {last}", file=sys.stderr)
                time.sleep(delay)
                continue
            last = f"HTTP {error.code} {error.reason}"
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last = f"{type(error).__name__}: {error}"
        if attempt < RETRIES - 1:
            time.sleep(5 * (attempt + 1))
    else:
        raise FetchError(last or "no answer")

    seconds = payload.get("unix_seconds")
    prices = payload.get("price")
    if not isinstance(seconds, list) or not isinstance(prices, list):
        raise FetchError("answer has no unix_seconds/price arrays")
    if len(seconds) != len(prices) or not seconds:
        raise FetchError(f"answer has {len(seconds)} timestamps and {len(prices)} prices")
    if payload.get("deprecated"):
        print("  note: the API marks this endpoint deprecated", file=sys.stderr)

    pairs = []
    for stamp, price in zip(seconds, prices):
        if price is None:
            continue  # a gap in the auction; drop the interval rather than draw a zero
        pairs.append((int(stamp), float(price)))
    if not pairs:
        raise FetchError(f"every price for {day} was null")
    return sorted(pairs), str(payload.get("license_info") or "").strip()


def demo_curve(zone: str, tz: ZoneInfo, day: dt.date) -> list[tuple[int, float]]:
    """A believable made-up day, for testing with no network.

    Deterministic from the date, so two runs on the same day agree. Shaped like
    a real Nordic day: a night trough, a morning peak, an afternoon dip, an
    evening peak, and one negative quarter-hour in the middle of the day so the
    app's below-zero drawing gets exercised.
    """
    midnight = dt.datetime.combine(day, dt.time(0, 0), tzinfo=tz)
    start = int(midnight.timestamp())
    pairs = []
    for i in range(96):
        hour = i / 4
        shape = (
            42
            + 34 * math.sin((hour - 3.5) * math.pi / 12) ** 3
            + 26 * math.exp(-((hour - 8.0) ** 2) / 4.0)
            + 38 * math.exp(-((hour - 18.5) ** 2) / 5.0)
            - 78 * math.exp(-((hour - 13.0) ** 2) / 2.2)
        )
        wobble = 4.0 * math.sin((day.toordinal() * 7 + i) * 1.7)
        pairs.append((start + i * 900, round(shape + wobble, 2)))
    return pairs


# ------------------------------------------------------------------ shaping


def local_iso(stamp: int, tz: ZoneInfo) -> str:
    return dt.datetime.fromtimestamp(stamp, tz).isoformat(timespec="seconds")


def step_of(curve: list[tuple[int, float]]) -> int:
    """Seconds per interval, read from the data rather than assumed."""
    if len(curve) < 2:
        return 3600
    gaps = sorted(b - a for (a, _), (b, _) in zip(curve, curve[1:]))
    return gaps[len(gaps) // 2] or 3600


def day_of(stamp: int, tz: ZoneInfo) -> dt.date:
    return dt.datetime.fromtimestamp(stamp, tz).date()


def summarise(curve: list[tuple[int, float]]) -> dict:
    prices = [p for _, p in curve]
    return {
        "intervals": len(prices),
        "min": round(min(prices), 2),
        "max": round(max(prices), 2),
        "mean": round(sum(prices) / len(prices), 2),
    }


def hourly(curve: list[tuple[int, float]], tz: ZoneInfo) -> list[tuple[str, float]]:
    """Mean price per clock hour, as [("14:00", 22.4), ...], in order.

    A question asked in words is asked about hours, not about quarter-hours,
    so the ask table is built from these even when the market settles finer.
    """
    buckets: dict[str, list[float]] = {}
    order: list[str] = []
    for stamp, price in curve:
        label = dt.datetime.fromtimestamp(stamp, tz).strftime("%H:00")
        if label not in buckets:
            buckets[label] = []
            order.append(label)
        buckets[label].append(price)
    return [(label, round(sum(buckets[label]) / len(buckets[label]), 2)) for label in order]


def cheapest_window(curve: list[tuple[int, float]], step: int, run_hours: float):
    """The cheapest contiguous run of `run_hours` inside one day's curve.

    Returns (start unix, end unix, mean price) or None when the day is shorter
    than the run. The window is searched at the market's own resolution, so a
    90-minute wash can start at a quarter past.
    """
    need = max(1, math.ceil(run_hours * 3600 / step))
    if len(curve) < need:
        return None
    prices = [p for _, p in curve]
    running = sum(prices[:need])
    best_total, best_at = running, 0
    for i in range(1, len(prices) - need + 1):
        running += prices[i + need - 1] - prices[i - 1]
        if running < best_total - 1e-9:
            best_total, best_at = running, i
    return (curve[best_at][0], curve[best_at][0] + need * step, best_total / need)


def read_appliances(path: pathlib.Path) -> list[dict]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"  note: {path.name} unreadable ({error}); using the built-in list", file=sys.stderr)
        return list(FALLBACK_APPLIANCES)
    rows = payload.get("appliances") if isinstance(payload, dict) else payload
    clean = []
    for row in rows or []:
        name = str(row.get("name", "")).strip()
        try:
            hours = float(row.get("hours"))
        except (TypeError, ValueError):
            continue
        if name and 0 < hours <= 24:
            clean.append({"name": name[:40], "hours": hours})
    return clean or list(FALLBACK_APPLIANCES)


def build_ask(days: list[dict], by_day: dict, step: int, tz: ZoneInfo,
              appliances: list[dict], unit: str, now_local: dt.datetime) -> list[dict]:
    """The flat rows Snuggery reads when someone asks a question in words.

    Two things here are easy to get wrong, and both have been got wrong:

    SCOPE. The app searches today's windows from the interval it is inside
    onwards — the cheapest two hours of the morning are no help at tea time —
    while this table is written once, hours earlier. So every appliance row
    says which question it answers: `windowScope` is "whole day", and for the
    day this job ran on there is a second row, "from HH:MM", holding the window
    the app would have drawn at the moment of the run. Without the label the
    table and the screen give different times for the same appliance and
    neither says why.

    NEGATIVE MEANS. A percentage measured against a mean of zero or below
    inverts: an hour CHEAPER than the mean comes out positive, and the cheapest
    window of a negative day reads as a loss. Negative day-ahead prices are
    ordinary, so rather than publish a number that reads backwards, the
    percentage keys are simply absent on such a day. `dayMean` is in every
    appliance row to be compared directly instead.
    """
    rows = []
    for day in days:
        curve = by_day.get(day["date"])
        if not curve:
            continue
        label = day["label"]
        hours = hourly(curve, tz)
        mean = sum(p for _, p in hours) / len(hours)
        order = sorted(range(len(hours)), key=lambda i: hours[i][1])
        rank = {i: n + 1 for n, i in enumerate(order)}
        for i, (time_label, price) in enumerate(hours):
            row = {
                "row": "hour",
                "day": label,
                "date": day["date"],
                "time": time_label,
                "price": price,
                "unit": unit,
                "rank": rank[i],
                "ofHours": len(hours),
            }
            if mean > 0:
                row["vsMeanPct"] = round((price - mean) / mean * 100)
            rows.append(row)

        # The whole day, and — on the day this ran — the stretch that was still
        # ahead of it, which is what the app itself plans over.
        scopes = [(curve, "whole day")]
        if day["date"] == now_local.date().isoformat():
            now_stamp = int(now_local.timestamp())
            rest = [point for point in curve if point[0] + step > now_stamp]
            if rest:
                scopes.append((
                    rest,
                    "from " + dt.datetime.fromtimestamp(rest[0][0], tz).strftime("%H:%M"),
                ))

        for appliance in appliances:
            for scope_curve, scope in scopes:
                window = cheapest_window(scope_curve, step, appliance["hours"])
                if not window:
                    continue
                start, end, avg = window
                row = {
                    "row": "appliance",
                    "day": label,
                    "date": day["date"],
                    "appliance": appliance["name"],
                    "runHours": appliance["hours"],
                    "windowScope": scope,
                    "cheapestStart": dt.datetime.fromtimestamp(start, tz).strftime("%H:%M"),
                    "cheapestEnd": dt.datetime.fromtimestamp(end, tz).strftime("%H:%M"),
                    "avgPrice": round(avg, 2),
                    "dayMean": round(mean, 2),
                    "unit": unit,
                }
                if mean > 0:
                    row["savingPct"] = round((mean - avg) / mean * 100)
                rows.append(row)
    return rows


# --------------------------------------------------------------------- main


def previous(path: pathlib.Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--zone", default=ZONE, help=f"bidding zone (default {ZONE})")
    parser.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    parser.add_argument("--demo", action="store_true",
                        help="make up a curve instead of fetching one")
    parser.add_argument("--private-use", action="store_true",
                        help="allow a zone whose data may not be republished")
    args = parser.parse_args()

    zone = args.zone
    publishable = zone in CC_BY_ZONES
    if not publishable and not args.private_use:
        print(
            f"error: {zone} is not one of the sixteen CC BY 4.0 zones, so its prices\n"
            f"       are licensed for private and internal use only and must not be\n"
            f"       committed to a public repository. The CC BY zones are:\n"
            f"       {', '.join(CC_BY_ZONES)}\n"
            f"       Pass --private-use if this repository is private and you have read\n"
            f"       power-hours/NOTES.md.",
            file=sys.stderr,
        )
        return 2

    tz = ZoneInfo(ZONE_TIMEZONES.get(zone, DEFAULT_TIMEZONE))
    now_local = dt.datetime.now(tz)
    today = now_local.date()
    wanted = [(today, "Today"), (today + dt.timedelta(days=1), "Tomorrow")]

    fetched: dict[str, list[tuple[int, float]]] = {}
    states: dict[str, tuple[str, str]] = {}
    licence_info = ""     # what the API itself said about the last answer
    for index, (day, label) in enumerate(wanted):
        key = day.isoformat()
        try:
            if args.demo:
                curve = demo_curve(zone, tz, day)
            else:
                if index:
                    time.sleep(1)  # two requests a minute is the published limit
                curve, said = fetch_day(zone, day)
                licence_info = said or licence_info
            fetched[key] = curve
            states[key] = ("fetched", "")
            print(f"  {label} {key}: {len(curve)} intervals")
        except FetchError as error:
            states[key] = ("pending" if error.pending else "failed", str(error))
            print(f"  {label} {key}: {error}", file=sys.stderr)

    # Anything this run could not fetch may still be on disk from the last one.
    old = previous(args.out)
    old_hours = old.get("hours") or (old.get("lastGood") or {}).get("hours") or []
    carried: dict[str, list[tuple[int, float]]] = {}
    for entry in old_hours:
        try:
            stamp = int(dt.datetime.fromisoformat(entry["start"]).timestamp())
            price = float(entry["price"])
        except (KeyError, TypeError, ValueError):
            continue
        key = day_of(stamp, tz).isoformat()
        if key in fetched or key not in {d.isoformat() for d, _ in wanted}:
            continue  # this run has it, or it is yesterday and no longer wanted
        carried.setdefault(key, []).append((stamp, price))

    by_day = dict(fetched)
    for key, curve in carried.items():
        if states.get(key, ("", ""))[0] != "pending":
            by_day[key] = sorted(curve)
            states[key] = ("carried", "kept from the previous run")

    curve_all = sorted(p for day_curve in by_day.values() for p in day_curve)
    step = step_of(curve_all) if curve_all else 900

    days = []
    for day, label in wanted:
        key = day.isoformat()
        state, note = states.get(key, ("failed", "not attempted"))
        entry = {"date": key, "label": label, "source": state}
        if key in by_day:
            entry.update(summarise(by_day[key]))
        else:
            entry["intervals"] = 0
        if note and state != "fetched":
            entry["note"] = note
        days.append(entry)

    appliances = read_appliances(APPLIANCES)
    generated = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    snapshot = {
        "schema": 1,
        "generatedAt": generated,
        "zone": zone,
        "zoneName": ZONE_NAMES.get(zone, zone),
        "timezone": str(tz),
        "unit": "EUR/MWh",
        "resolutionMinutes": step // 60,
        "source": {
            "name": "Energy-Charts, Fraunhofer ISE",
            "endpoint": ENDPOINT,
            "licence": (
                "CC BY 4.0 from Bundesnetzagentur | SMARD.de" if publishable
                else "private and internal use only — do not republish"
            ),
            "publishable": publishable,
            "attribution": "Day-ahead prices: Energy-Charts (Fraunhofer ISE)",
        },
        "days": days,
        "hours": [],
        "lastGood": None,
        "ask": [],
    }

    if licence_info:
        # The per-answer licence, kept beside the constant so the app can print
        # what the source actually said rather than what this file believes.
        snapshot["source"]["licenceInfo"] = licence_info[:200]
    if publishable and licence_info and "CC BY" not in licence_info:
        print(
            f"error: {zone} is on this script's CC BY list, but the API answered\n"
            f"       license_info: {licence_info[:200]}\n"
            f"       That is a licence change, not a glitch: nothing is written and\n"
            f"       nothing is committed. Check https://api.energy-charts.info/ and\n"
            f"       update CC_BY_ZONES and power-hours/NOTES.md before publishing again.",
            file=sys.stderr,
        )
        return 1

    if not fetched and curve_all:
        # Nothing new today. The app draws the old curve and stamps it stale,
        # which is far better than an error where a price used to be.
        snapshot["lastGood"] = {
            "generatedAt": old.get("generatedAt", generated),
            "days": [d for d in days if d["source"] == "carried"],
            "hours": [{"start": local_iso(s, tz), "price": round(p, 2)} for s, p in curve_all],
        }
    else:
        snapshot["hours"] = [
            {"start": local_iso(s, tz), "price": round(p, 2)} for s, p in curve_all
        ]

    snapshot["ask"] = build_ask(days, by_day, step, tz, appliances, snapshot["unit"], now_local)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(snapshot, indent=1, ensure_ascii=False) + "\n",
                        encoding="utf-8")

    drawn = snapshot["hours"] or (snapshot["lastGood"] or {}).get("hours") or []
    print(f"wrote {args.out}: {len(drawn)} intervals, {len(snapshot['ask'])} ask rows, "
          f"{snapshot['resolutionMinutes']} min steps"
          + (" (stale — nothing fetched)" if not snapshot["hours"] else ""))
    if not drawn:
        print("error: no curve, new or old, to draw", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
