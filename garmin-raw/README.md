# garmin-raw — Training Load's raw store

Append-only. `scripts/garmin_pull.py` merges what it pulls from Garmin Connect into the files
here (activities, zones, gear, load, sleep, splits, streams, weather, laps, details, intraday),
and `scripts/build_garmin_snapshot.py` builds `training-load/data/snapshot.json` from them.

`context.json` is the one file you edit by hand: put **your** heart-rate zones and physiology in
`athlete` before the first pull (nothing pulls them, and every zone chart depends on them).
Leave `gear` and `garminNow` as they are — the pull fills them.

The optional coaching routine writes four more files here (`assessment.json`, `plan.json`,
`racecast.json`, `notes.json`); the pull never touches those. `pull.json`, the receipt of the
last run, is gitignored.
