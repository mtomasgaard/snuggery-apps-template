# raw — Running Dashboard's raw store

What the pull keeps that the phone does not need. `scripts/garmin_pull.py` merges what it pulls
from Garmin Connect into the files here, and `scripts/build_garmin_snapshot.py` builds
`running-dashboard/data/` from them.

**This folder never ships.** The ZIP builder leaves every app's `raw/` out of the ZIP, and a push
that touches only `raw/` rebuilds no ZIP. In your own copy it holds per-second GPS traces, heart
rate, sleep and weight, so none of that may travel inside an app somebody installs.

**In the template it is an empty starting point**: this README and `context.json`, which holds
the made-up demo runner's numbers. The demo in `running-dashboard/data/` is not built from here;
`scripts/make_demo_running_dashboard.py` writes a synthetic store into a temporary folder and
builds from that.

`context.json` is the one file you edit by hand: put **your** heart-rate zones and physiology in
`athlete`, then commit and push it before the first pull (`running-dashboard/PROMPT.md`, Steps 1
and 3). Nothing pulls them, and every zone chart depends on them, so the pull stops if the file is
missing. Leave `gear` and `garminNow` as they are; the pull fills them, and adds `backfill`.

The pull creates the rest as it finds data for each (no weigh-ins, no `weight.csv`) and merges into
it on every later run:
`activities.json`, `zones.csv`, `gear.csv`, `splits.csv`, `details.csv`, `laps.csv`,
`weather.csv`, `zonekm.csv`, `streams/<id>.csv`, `maps.json`, `garmin_load.csv`, `sleep.csv`,
`daily.csv`, `weight.csv`, `vo2.csv`, `intraday.json` (replaced every run) and `calendar.json`
(once a day, and read only by the coaching routine). `pull.json`, the receipt of the last run, is
gitignored.

The optional coaching routine writes four more files here: `assessment.json`, `plan.json`,
`racecast.json` and `notes.json`. The pull never touches those.

What each file holds is in `running-dashboard/NOTES.md`; the exact columns are in the docstrings of
`scripts/build_garmin_snapshot.py` and `scripts/garmin_append.py`.
