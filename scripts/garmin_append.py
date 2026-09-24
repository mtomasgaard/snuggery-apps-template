#!/usr/bin/env python3
"""Merge newly-fetched Garmin rows into the append-only files in running-dashboard/raw/.

Two things feed this: scripts/garmin_pull.py, which talks to Garmin Connect
directly on a cron and imports the merge functions below, and — as a fallback —
an agent session pulling through the Garmin connector and piping rows in on
stdin. Either way the rows go through here rather than being edited by hand, so
a refresh that runs twice, or overlaps a manual one, converges on the same
result instead of duplicating rows.

Every merge is keyed on the first field and is last-write-wins, so re-sending a
day you already have is a no-op rather than a duplicate.

    python3 scripts/garmin_append.py status
        Print what is already stored: newest activity, newest load day, newest
        sleep night, and which activity ids are still missing zone or gear rows.
        Run this FIRST — it tells you exactly what to fetch.

    python3 scripts/garmin_append.py activities < rows.json
        rows.json is the "activities" array from get_activities_by_date.

    python3 scripts/garmin_append.py zones  < rows.csv     # id,z1,z2,z3,z4,z5   (seconds)
    python3 scripts/garmin_append.py gear   < rows.csv     # id,CODE|CODE  or  id,-
    python3 scripts/garmin_append.py load   < rows.csv     # date,atl,ctl,status,vo2
    python3 scripts/garmin_append.py sleep  < rows.csv     # date,score,hours,deep%,rem%,hrv,stress
    python3 scripts/garmin_append.py daily  < rows.csv     # date,steps,stepGoal,floorsUp,floorsDown,kcal,activeKcal,activeMin,
                                                           # sedentaryMin,modMin,vigMin,rhr,minHr,maxHr,stressAvg,bbHigh,bbLow,
                                                           # spo2Avg,spo2Low,respAvg  (one daily wellness summary per day)
    python3 scripts/garmin_append.py weight < rows.csv     # date,kg,bmi,bodyFat%
    python3 scripts/garmin_append.py vo2    < rows.csv     # date,vo2max  (days Garmin recomputed the estimate)
    python3 scripts/garmin_append.py splits < rows.csv     # id,runSec,runM,runHr,walkSec,walkM,walkHr,standSec
                                                           # (run/walk detection from get_activity_split_summaries;
                                                           #  outdoor runs only, walkHr blank when no walking)

    python3 scripts/garmin_append.py details < rows.csv    # per-activity summary from get_activity (last ~6 months only):
        # id,movSec,minHr,cad,maxCad,strideCm,gctMs,voCm,pwr,maxPwr,normPwr,te,anTe,teLabel,load,
        #    modMin,vigMin,elevGain,elevLoss,maxElev,minElev,bodyBattery,feel,rpe,maxSpeedMps
    python3 scripts/garmin_append.py laps < rows.csv       # per-lap rows from get_activity_splits, keyed on id+lap:
        # id,lap,distM,durSec,movSec,avgHr,maxHr,cad,pwr,elevGain,elevLoss,maxSpeedMps,kind
        # kind: W warm-up, A work, R recovery, C cool-down (from intensity_type of a
        # structured workout); blank for a plain auto-lap

    python3 scripts/garmin_append.py notes < notes.json    # per-session evaluations, a JSON object keyed by
        # activity id: {"<id>": {"written": "YYYY-MM-DD", "verdict": "2-3 words",
        #   "tone": "good|warning|serious|critical|neutral", "body": ["para", ...]}}
        # Merged into running-dashboard/raw/notes.json; re-sending an id replaces its note.

Blank lines and lines starting with # are ignored, so you can paste a block with
a comment at the top.
"""

import csv
import io
import json
import os
import re
import sys

SAFE_ID = re.compile(r"[A-Za-z0-9_-]+")  # an activity id becomes a file name; nothing else may

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "running-dashboard", "raw")

# Rolling windows: an unbounded file makes every refresh push a bigger diff, and
# the app's longest window is the history of activities, about two years.
KEEP_SLEEP_NIGHTS = 900
KEEP_LOAD_DAYS = 900
KEEP_DAILY_DAYS = 900

CSV_FILES = {
    "zones": ("zones.csv", 6, None),
    "gear": ("gear.csv", 2, None),
    "load": ("garmin_load.csv", 5, KEEP_LOAD_DAYS),
    "sleep": ("sleep.csv", 7, KEEP_SLEEP_NIGHTS),
    "daily": ("daily.csv", 20, KEEP_DAILY_DAYS),
    "weight": ("weight.csv", 4, None),
    "vo2": ("vo2.csv", 2, None),
    "splits": ("splits.csv", 8, None),
    "details": ("details.csv", 26, None),
    "laps": ("laps.csv", 13, None),
    "zonekm": ("zonekm.csv", 7, None),
    "weather": ("weather.csv", 10, None),
}

# A stream CSV has nine columns, the last two latitude and longitude, for the
# wind adjustment and the route map. A stream in the older seven-column shape,
# without them, is re-pulled, newest first, a few per hour.
STREAM_COLUMNS = 9
OUTDOOR_TYPES = {"running", "trail_running", "cycling", "walking", "hiking", "rucking", "road_biking", "mountain_biking", "gravel_cycling"}

# Kilometres per zone and the per-second stream come from the FIT record
# stream, one large call per thousand seconds, asked for across the whole
# detail window, a few sessions per run.
STREAM_TYPES = {"running", "treadmill_running", "trail_running", "cycling", "indoor_cycling", "virtual_ride", "walking", "hiking", "rucking"}

# Files whose rows are keyed on more than the first field.
KEY_FIELDS = {"laps": 2}

# The activity pane keeps per-activity detail for this many days; older
# activities are summarised only. Fetching every lap of twenty months of
# history would be a lot of calls for a view nobody scrolls back to.
DETAIL_DAYS = 183
LAP_TYPES = {"running", "treadmill_running", "trail_running", "walking", "hiking", "rucking", "cycling"}


def read_lines(text):
    rows = []
    for row in csv.reader(io.StringIO(text)):
        if not row or not row[0].strip() or row[0].lstrip().startswith("#"):
            continue
        rows.append([c.strip() for c in row])
    return rows


def merge_csv(kind, incoming_text):
    name, width, keep = CSV_FILES[kind]
    path = os.path.join(RAW, name)
    nkey = KEY_FIELDS.get(kind, 1)
    key = lambda row: tuple(row[:nkey])
    store = {}
    if os.path.exists(path):
        for row in read_lines(open(path).read()):
            store[key(row)] = row
    added = updated = 0
    for row in read_lines(incoming_text):
        row = (row + [""] * width)[:width]
        if key(row) in store:
            if store[key(row)] != row:
                updated += 1
        else:
            added += 1
        store[key(row)] = row
    keys = sorted(store, key=lambda k: tuple(int(x) if x.isdigit() else x for x in k))
    if keep and len(keys) > keep:
        keys = keys[-keep:]
    with open(path, "w", newline="") as fh:
        w = csv.writer(fh)
        for k in keys:
            w.writerow(store[k])
    print(f"{name}: {added} new, {updated} changed, {len(keys)} rows total")


def load_activities():
    """activities.json, oldest first; [] until the first pull has written one.
    The template ships the store with context.json only, so a first pull
    starts here with nothing, and an empty file counts as nothing too."""
    path = os.path.join(RAW, "activities.json")
    if not os.path.exists(path):
        return []
    with open(path) as fh:
        text = fh.read()
    return json.loads(text) if text.strip() else []


def merge_activities(incoming_text):
    path = os.path.join(RAW, "activities.json")
    keep = ["id", "name", "type", "event_type", "start_time", "distance_meters",
            "duration_seconds", "moving_duration_seconds", "calories",
            "avg_hr_bpm", "max_hr_bpm", "steps", "elevation_gain_meters"]
    store = {}
    for a in load_activities():
        store[str(a["id"])] = a

    payload = json.loads(incoming_text)
    if isinstance(payload, dict):                      # a whole tool response
        payload = payload.get("activities", [])
    added = 0
    for a in payload:
        key = str(a.get("id"))
        # Merge field by field and never let a null overwrite a value we already
        # have: Garmin's list endpoint omits fields (moving duration, elevation)
        # that its detail endpoint returns, so a re-send must not hollow out a
        # record that was captured from a richer source.
        row = dict(store.get(key, {}))
        if not row:
            added += 1
            row = {k: None for k in keep}
        for k in keep:
            v = a.get(k)
            if v is not None:
                row[k] = v
        row["id"] = a.get("id", row.get("id"))
        store[key] = row

    out = sorted(store.values(), key=lambda r: (r.get("start_time") or "", str(r["id"])))
    with open(path, "w") as fh:
        json.dump(out, fh, indent=0)
        fh.write("\n")
    print(f"activities.json: {added} new, {len(out)} total, newest {out[-1]['start_time'][:10] if out else 'none'}")


def merge_notes(incoming_text):
    path = os.path.join(RAW, "notes.json")
    store = json.load(open(path)) if os.path.exists(path) else {}
    payload = json.loads(incoming_text)
    if not isinstance(payload, dict):
        raise SystemExit("notes: expected a JSON object keyed by activity id")
    added = updated = 0
    for key, note in payload.items():
        for field in ("verdict", "tone", "body"):
            if field not in note:
                raise SystemExit(f"notes: {key} is missing {field!r}")
        if not isinstance(note["body"], list) or not all(isinstance(x, str) for x in note["body"]):
            raise SystemExit(f"notes: {key} body must be a list of strings")
        if str(key) in store:
            if store[str(key)] != note:
                updated += 1
        else:
            added += 1
        store[str(key)] = note
    with open(path, "w") as fh:
        json.dump(dict(sorted(store.items())), fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print(f"notes.json: {added} new, {updated} changed, {len(store)} total")


def missing():
    """What the store still lacks, as lists of ids, plus the newest stored dates.
    Used by status() for printing and by garmin_pull.py to decide what to fetch.
    On a store with no activities yet every list is empty and newest_activity
    is None, which garmin_pull.py reads as "start from the history's floor"."""
    acts = load_activities()
    ids = [str(a["id"]) for a in acts]
    have = {}
    for kind in ("zones", "gear", "splits", "details", "laps", "zonekm", "weather"):
        name = CSV_FILES[kind][0]
        p = os.path.join(RAW, name)
        have[kind] = {r[0] for r in read_lines(open(p).read())} if os.path.exists(p) else set()

    runish = {"running", "treadmill_running", "trail_running", "walking", "hiking", "rucking"}
    missing_zones = [i for i in ids if i not in have["zones"]]
    missing_gear = [str(a["id"]) for a in acts
                    if a.get("type") in runish and str(a["id"]) not in have["gear"]]
    # Run/walk splits only exist for outdoor runs — the treadmill has no
    # run-walk detection, so asking for it there is a wasted call.
    outdoor_runs = {"running", "trail_running"}
    missing_splits = [str(a["id"]) for a in acts
                      if a.get("type") in outdoor_runs and str(a["id"]) not in have["splits"]]

    import datetime as dt
    newest_activity = acts[-1]["start_time"][:10] if acts else None
    recent = []
    if newest_activity:
        cutoff = (dt.date.fromisoformat(newest_activity) - dt.timedelta(days=DETAIL_DAYS)).isoformat()
        recent = [a for a in acts if a["start_time"][:10] >= cutoff]
    missing_details = [str(a["id"]) for a in recent if str(a["id"]) not in have["details"]]
    missing_laps = [str(a["id"]) for a in recent
                    if a.get("type") in LAP_TYPES and str(a["id"]) not in have["laps"]]
    missing_zonekm = [str(a["id"]) for a in recent
                      if a.get("type") in STREAM_TYPES and str(a["id"]) not in have["zonekm"]]
    for a in recent:
        aid = str(a["id"])
        if not SAFE_ID.fullmatch(aid):
            continue
        p = os.path.join(RAW, "streams", f"{aid}.csv")
        if aid in have["zonekm"] and os.path.exists(p):
            with open(p) as fh:
                first = fh.readline()
            if first and first.count(",") < STREAM_COLUMNS - 1:
                missing_zonekm.append(aid)  # old shape: no position columns yet
    maps_path = os.path.join(RAW, "maps.json")
    maps = json.load(open(maps_path)) if os.path.exists(maps_path) else {}
    missing_maps = []
    for a in recent:
        aid = str(a["id"])
        if not SAFE_ID.fullmatch(aid):
            continue
        p = os.path.join(RAW, "streams", f"{aid}.csv")
        if aid in maps or not os.path.exists(p):
            continue
        with open(p) as fh:
            head = [fh.readline() for _ in range(30)]
        if any(len(l.split(",")) >= STREAM_COLUMNS and l.split(",")[7].strip() for l in head):
            missing_maps.append(aid)  # has positions, no tiles yet
    missing_weather = [str(a["id"]) for a in recent
                       if a.get("type") in OUTDOOR_TYPES and str(a["id"]) not in have["weather"]]
    notes_path = os.path.join(RAW, "notes.json")
    notes = json.load(open(notes_path)) if os.path.exists(notes_path) else {}
    # Notes are only expected from the day the first one was written; older
    # sessions inside the window are deliberately left without one.
    first_note_day = min((a["start_time"][:10] for a in acts if str(a["id"]) in notes), default=None)
    missing_notes = [str(a["id"]) for a in recent
                     if first_note_day and a["start_time"][:10] >= first_note_day and str(a["id"]) not in notes]

    def newest(kind):
        p = os.path.join(RAW, CSV_FILES[kind][0])
        rows = read_lines(open(p).read()) if os.path.exists(p) else []
        return rows[-1][0] if rows else "none"

    return {
        "activities": len(acts), "newest_activity": newest_activity,
        "newest_load": newest("load"), "newest_sleep": newest("sleep"), "newest_daily": newest("daily"),
        "zones": missing_zones, "gear": missing_gear, "splits": missing_splits,
        "details": missing_details, "laps": missing_laps, "zonekm": missing_zonekm,
        "notes": missing_notes, "first_note_day": first_note_day, "weather": missing_weather, "maps": missing_maps,
        "types": {str(a["id"]): a.get("type") for a in acts},
        "dates": {str(a["id"]): a["start_time"][:10] for a in acts},
    }


def status():
    m = missing()
    acts, newest = m["activities"], m["newest_activity"]
    missing_zones, missing_gear, missing_splits = m["zones"], m["gear"], m["splits"]
    missing_details, missing_laps, missing_zonekm, missing_notes = m["details"], m["laps"], m["zonekm"], m["notes"]
    first_note_day = m["first_note_day"]
    print(f"activities : {acts} stored, newest {newest or 'none'}")
    print(f"garmin_load: newest {m['newest_load']}")
    print(f"daily      : newest {m['newest_daily']}")
    print(f"sleep      : newest {m['newest_sleep']}")
    print(f"missing zone rows ({len(missing_zones)}): {' '.join(missing_zones) or '-'}")
    print(f"missing gear rows ({len(missing_gear)}): {' '.join(missing_gear) or '-'}")
    print(f"missing split rows ({len(missing_splits)}): {' '.join(missing_splits) or '-'}")
    print(f"missing detail rows, last {DETAIL_DAYS} days ({len(missing_details)}): {' '.join(missing_details) or '-'}")
    print(f"missing lap rows, last {DETAIL_DAYS} days ({len(missing_laps)}): {' '.join(missing_laps) or '-'}")
    print(f"missing zone-km / stream rows, last {DETAIL_DAYS} days ({len(missing_zonekm)}): {' '.join(missing_zonekm) or '-'}")
    print(f"missing map tiles, last {DETAIL_DAYS} days ({len(m['maps'])}): {' '.join(m['maps']) or '-'}")
    print(f"missing weather rows, last {DETAIL_DAYS} days ({len(m['weather'])}): {' '.join(m['weather']) or '-'}")
    print(f"missing session notes since {first_note_day or 'never'} ({len(missing_notes)}): {' '.join(missing_notes) or '-'}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    cmd = sys.argv[1]
    if cmd == "status":
        status()
        return 0
    text = sys.stdin.read()
    if not text.strip():
        print("nothing on stdin — nothing to do")
        return 0
    if cmd == "activities":
        merge_activities(text)
    elif cmd == "notes":
        merge_notes(text)
    elif cmd in CSV_FILES:
        merge_csv(cmd, text)
    else:
        print(f"unknown command {cmd!r}")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
