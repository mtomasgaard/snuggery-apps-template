#!/usr/bin/env python3
"""Per-second stream and kilometres per heart-rate zone from an activity's FIT records.

The Garmin connector's get_activity_fit_messages(activity_id,
message_types=["record"], include_records=True, message_limit=1000) returns
one page of per-second records; the harness saves each page to a file because
it is far too large for the conversation. Point this script at every page file
for one or more activities (any order; pages are grouped by the id inside). It writes the stream itself to
garmin-raw/streams/<id>.csv (one row per second: sec,distM,hr,spdMps,cad,altM,
pwr,lat,lon; the Sessions pane draws its curves from it and the builder takes
the heading for the wind adjustment from the positions) and prints one CSV line for
`garmin_append.py zonekm`:

    id,z1,z2,z3,z4,z5,z0       kilometres, running records only

Each metre is credited to the zone of the heart rate at that second, using the
zone floors in garmin-raw/context.json — so a fast kilometre at 173 is a
zone 3 kilometre, however the laps were cut. Metres run with the heart rate
still under the zone 1 floor (the first minutes of a run, mostly) go in the
last column rather than being counted as zone 1. Seconds slower than 1.6 m/s
are counted as walking and left out, which matches the watch's own run/walk
split closely, so the total lines up with the running-only distance the app
shows everywhere else.

    python3 scripts/fit_records.py page1.txt page2.txt | python3 scripts/garmin_append.py zonekm
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(os.path.dirname(HERE), "garmin-raw")
WALK_MPS = 1.6      # running: slower than this is a walk break
STILL_MPS = 0.5     # cycling: slower than this is a standstill
BIKE_TYPES = {"cycling", "indoor_cycling", "virtual_ride", "road_biking", "mountain_biking", "gravel_cycling"}
WALK_TYPES = {"walking", "hiking", "rucking"}   # walking is the point: only a standstill is left out


def activity_type(aid):
    try:
        for a in json.load(open(os.path.join(RAW, "activities.json"))):
            if str(a.get("id")) == str(aid):
                return a.get("type") or ""
    except Exception:
        pass
    return ""


def load_page(path):
    with open(path) as fh:
        outer = json.load(fh)
    inner = outer["result"] if isinstance(outer, dict) and "result" in outer else outer
    if isinstance(inner, str):
        inner = json.loads(inner)
    return inner


def field(msg, name):
    for f in msg.get("fields", []):
        if f.get("name") == name:
            return f.get("value")
    return None


def write_stream(aid, records, bike=False):
    """One row per record: seconds from start, metres, bpm, m/s, cadence, metres
    altitude, watts, latitude, longitude. Cadence is steps per minute for a run
    (Garmin records it per foot) and rpm for a ride. Position is empty indoors."""
    import datetime as dt
    os.makedirs(os.path.join(RAW, "streams"), exist_ok=True)
    t0 = dt.datetime.fromisoformat(records[0][0])
    fmt = lambda v, nd: "" if v is None else (f"{v:.{nd}f}".rstrip("0").rstrip(".") if nd else str(int(round(v))))
    with open(os.path.join(RAW, "streams", f"{aid}.csv"), "w") as fh:
        for ts, dist, hr, _kind, spd, cad, alt, pwr, lat, lon in records:
            sec = int((dt.datetime.fromisoformat(ts) - t0).total_seconds())
            c = None if cad is None else (cad if bike else cad * 2)
            fh.write(f"{sec},{fmt(dist, 1)},{fmt(hr, 0)},{fmt(spd, 3)},{fmt(c, 0)},{fmt(alt, 1)},{fmt(pwr, 0)},{fmt(lat, 5)},{fmt(lon, 5)}\n")


def degrees(v):
    """FIT positions are semicircles (2^31 per 180°); the connector's pages may
    already carry degrees. Either way, degrees out."""
    if v is None:
        return None
    return v if abs(v) <= 180 else v * (180.0 / 2 ** 31)


def records_from_pages(pages):
    """Record tuples from the connector's page files, plus the count the file says it holds."""
    total = {p["record_stream"]["total_count"] for p in pages if p.get("record_stream")}
    records = []
    for p in pages:
        for m in p.get("messages", []):
            if m.get("type") != "record":
                continue
            records.append((field(m, "timestamp"), field(m, "distance"), field(m, "heart_rate"),
                            field(m, "activity_type"), field(m, "enhanced_speed"),
                            field(m, "cadence"), field(m, "enhanced_altitude"), field(m, "power"),
                            degrees(field(m, "position_lat")), degrees(field(m, "position_long"))))
    return records, (list(total)[0] if total else None)


def records_from_fit(data):
    """Record tuples straight from a FIT file (bytes, or the zip Garmin wraps it
    in), for the script-based pull. Needs the fitdecode package."""
    import fitdecode
    import io
    import zipfile
    if data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".fit")]
            if not names:
                raise ValueError("no .fit inside the archive")
            data = z.read(names[0])
    records = []
    with fitdecode.FitReader(io.BytesIO(data)) as fit:
        for frame in fit:
            if not isinstance(frame, fitdecode.FitDataMessage) or frame.name != "record":
                continue
            g = lambda *names: next((frame.get_value(n) for n in names if frame.has_field(n) and frame.get_value(n) is not None), None)
            ts = g("timestamp")
            if ts is None:
                continue
            records.append((ts.strftime("%Y-%m-%dT%H:%M:%S"), g("distance"), g("heart_rate"),
                            g("activity_type"), g("enhanced_speed", "speed"),
                            g("cadence"), g("enhanced_altitude", "altitude"), g("power"),
                            degrees(g("position_lat")), degrees(g("position_long"))))
    return records


def process(aid, records, floors, want=None):
    """Zone kilometres and the stream file for one activity from its record
    tuples. Returns the zonekm CSV line, or None if the records are incomplete."""
    records = sorted({r for r in records if r[0] is not None and r[1] is not None})
    if want and len(records) < want * 0.98:
        sys.stderr.write(f"{aid}: only {len(records)} of {want} records present — skipped, fetch the missing pages\n")
        return None
    if len(records) < 10:
        sys.stderr.write(f"{aid}: only {len(records)} records — skipped\n")
        return None
    kind_of = activity_type(aid)
    bike = kind_of in BIKE_TYPES
    slow = STILL_MPS if bike or kind_of in WALK_TYPES else WALK_MPS
    km = [0.0] * 6  # zones 1–5, then below zone 1
    walk_m = 0.0
    prev = None
    for ts, dist, hr, kind, spd, *_rest in records:
        if prev is not None:
            step = dist - prev[1]
            if step > 0:
                # The record stream does not carry the watch's run/walk verdict
                # (activity_type reads "running" throughout); slower than 1.6 m/s
                # reproduces Garmin's RWD_WALK distance to within a few percent.
                if kind == "walking" or (spd is not None and spd < slow):
                    walk_m += step
                else:
                    bpm = hr if hr is not None else prev[2]
                    z = 0
                    if bpm is not None:
                        for i, floor in enumerate(floors):
                            if bpm >= floor:
                                z = i + 1
                    km[z - 1 if z else 5] += step / 1000.0
        prev = (ts, dist, hr, kind, spd)
    write_stream(aid, records, bike)
    sys.stderr.write(f"{aid}: {len(records)} records, {'riding' if bike else 'running'} {sum(km):.2f} km, {'still' if bike else 'walking'} {walk_m / 1000:.2f} km\n")
    return f"{aid}," + ",".join(f"{v:.3f}" for v in km)


def main(paths):
    """Any number of page files for any number of activities: pages are grouped
    by the activity id inside them, so a whole batch of downloads can be handed
    over at once."""
    floors = json.load(open(os.path.join(RAW, "context.json")))["athlete"]["zoneFloors"]
    by_act = {}
    for path in paths:
        try:
            page = load_page(path)
        except Exception as err:  # a truncated or non-record file in the batch
            sys.stderr.write(f"{path}: unreadable ({err}), skipped\n")
            continue
        if not isinstance(page, dict) or not page.get("activity_id"):
            continue
        by_act.setdefault(str(page["activity_id"]), []).append(page)
    for aid in sorted(by_act):
        records, want = records_from_pages(by_act[aid])
        line = process(aid, records, floors, want)
        if line:
            print(line)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
