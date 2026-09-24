# Running Dashboard — where the data comes from, where it is kept, and on what terms

Running Dashboard draws what a Garmin watch records — every session, heart-rate
zones, Garmin's own training load, sleep, HRV, daily steps, weight — from
**Garmin Connect**, signed in as you.

`scripts/garmin_pull.py`, run by `.github/workflows/pull-running-dashboard.yml`,
merges what is new into the raw store, `raw/`, and fetches map tiles into
`data/tiles/`. It then runs `scripts/build_garmin_snapshot.py`, which builds
`data/snapshot.json` and the session streams under `data/streams/` from the raw
store. The app reads those three and nothing else.

[`PROMPT.md`](PROMPT.md) sets it up, step by step. [`TILES.md`](TILES.md) gives
the terms of the map tiles, routes and typeface the demo ships with. This file
is how the pieces fit together.

---

## The Garmin connection

`scripts/garmin_pull.py` uses the open-source `garminconnect` library, which
reaches the same web API Garmin's own apps use. **It is not an official API** —
Garmin can change it without notice. The library usually catches up within
days. Until it does, the workflow's runs fail or report failed steps, and once
no snapshot has been built for two days the time stamp in the app's header
turns into a warning. `scripts/requirements.txt` asks for a minimum version
rather than a pinned one for the same reason: the fix arrives as a new release.

You sign in with your own account, once, on your own machine (`--login`,
`PROMPT.md` Step 4). From then on the session tokens live in `~/.garminconnect`
on that machine and, for the workflow, in the repository's `GARMINTOKENS`
Actions secret — never in a file in the repository, the snapshot or a log.
Nothing passes through anybody else's server: the job runs in GitHub Actions and
talks to Garmin directly. No agent is involved either; the pull is a plain
script on a clock of your choosing (`scheduler/README.md`).

Each run asks only for what is new. The first reaches back two years of
activities, and it is the long one: a call per activity for its heart-rate
zones, and for its gear and run/walk split where those apply, then details, laps
and weather for the last six months, and four record streams (the workflow's
`streams` input asks for more). Expect several minutes. A step keeps what it
fetched only when it finishes, so one that Garmin cuts short — by rate-limiting,
say — starts again on the next run, and the receipt names it.

The rest reaches back at its own pace. Sleep and daily summaries fill in
backwards, sixty days a run, until they reach the oldest activity. Weigh-ins and
VO₂ max go back as far on the day's full run (the one in the 05:00 UTC hour, or
any run with the workflow's `full` input). Garmin's own load is never
backfilled: it starts two weeks before the first full run and grows from there.

Until the store holds at least one activity, the pull does not rebuild the
snapshot. The app turns away a snapshot with no sessions in it, so the one
already there stays — in a fresh copy, the demo — and the receipt warns *no
activities stored yet, so the snapshot was not rebuilt*. That is an account with
no activity in the last two years, or a first run whose activities step failed.
Whatever else the run fetched is committed all the same.

## The raw store, `raw/`

Everything the pull keeps sits in `raw/`, inside the app's folder, so the app
is one folder: delete `running-dashboard/` and its data goes with it. **None of
it ever ships.** The ZIP builder packs an app's folder whole, and this folder
must not travel: in your own copy it holds a per-second GPS trace of every run
(most of them start at your front door), with heart rate, sleep, HRV and
weight. So `.github/workflows/build-zips.yml` leaves every app's `raw/` out of
the ZIP, and a push that touches nothing but `raw/` and `data/` rebuilds no ZIP,
which is what lets the pull commit here every hour without rebuilding anything.
What reaches the phone is `data/`: the snapshot, the downsampled session
streams and the tiles.

Copies made from the template before this move keep the store at `garmin-raw/`,
at the repository root. The pull refuses to run while that folder exists and
says how to move it: `git mv garmin-raw running-dashboard/raw` keeps every file
and its history, and `.github/workflows/build-zips.yml` and `.gitignore` come
from the template in the same commit. A pull that pushes also checks that those
two files keep `raw/` out of the ZIP, and stops before committing anything if
they do not.

| File | Written by | What it holds |
| --- | --- | --- |
| `context.json` | you, then the pull | `athlete` — maximum, resting and threshold heart rate, the five zone floors, VO₂ max, weight, height — is yours to fill in, and nothing pulls it. The pull adds `gear` (the gear catalogue), `garminNow` (today's training status, readiness and race predictions, as Garmin gives them) and `backfill` (how far back the history has been filled). |
| `activities.json` | the pull | every session's summary from Garmin's activity list, oldest first |
| `zones.csv` | the pull | seconds in each heart-rate zone, per session |
| `gear.csv` | the pull | the gear each session used — shoes, mostly |
| `splits.csv` | the pull | Garmin's run/walk split of each outdoor run |
| `details.csv` | the pull | cadence, stride, ground contact, power, training effect, elevation, feel and effort, per session, for the last six months |
| `laps.csv` | the pull | one row per lap, for the last six months |
| `weather.csv` | the pull | the weather-station observation Garmin attaches to an outdoor session |
| `zonekm.csv` | the pull | kilometres run in each zone, counted second by second from the record stream with the zone floors in `context.json` as they were at the time |
| `streams/<id>.csv` | the pull | the per-second record of a session: time, distance, heart rate, speed, cadence, altitude, power, latitude, longitude |
| `maps.json` | the pull | each session's map extent, and every tile on disk with the source it came from |
| `garmin_load.csv` | the pull | Garmin's acute and chronic load, training status and VO₂ max, per day; 900 days kept |
| `sleep.csv` | the pull | sleep score, hours, deep and REM share, HRV and stress, per night; 900 nights kept |
| `daily.csv` | the pull | steps, floors, calories, intensity minutes, resting, lowest and highest heart rate, stress, body battery, blood oxygen and breathing rate, per day; 900 days kept |
| `weight.csv` | the pull | weigh-ins: weight, BMI, body fat |
| `vo2.csv` | the pull | the VO₂ max estimate on each day Garmin recomputed it |
| `intraday.json` | the pull, replaced every run | heart rate, body battery and stress through the last 36 hours |
| `calendar.json` | the pull, once a day | races and events in your Garmin calendar, this month and the six after it. The builder does not read it; it is there for the coaching routine. |
| `pull.json` | the pull, never committed | the receipt of the last run: when it ran, and each step's outcome. It is gitignored because it changes on every run; the builder reads it in the same job, so its time lands in the snapshot as `pulledAt`, and the workflow's last step prints it. |
| `assessment.json`, `plan.json`, `racecast.json`, `notes.json` | the coaching routine | see [*The coaching text*](#the-coaching-text) below |

Every CSV is headerless and keyed on its first field (`laps.csv` on the first
two). The last write wins, so a run that repeats a day, or overlaps another,
converges rather than duplicating rows, and when two runs do collide on a push
the pull merges both sides by content. The exact columns are in the docstrings
of `scripts/build_garmin_snapshot.py` and `scripts/garmin_append.py`.

`zonekm.csv` is the one file that remembers your settings: it is written once
per session, with the zone floors in `context.json` on the day of the pull, and
never recomputed. That is why `PROMPT.md` has you set your zones and push them
before the first pull.

**In the template, `raw/` is an empty starting point**: its README and a
`context.json` holding the made-up demo runner's numbers. The demo in `data/`
is not built from it — `scripts/make_demo_running_dashboard.py` writes a
synthetic store into a temporary folder and builds from that. Your first pull
creates the pull's files as it finds data for them (no weigh-ins, no
`weight.csv`). To see what a full store looks like without touching
yours:

```
python3 scripts/make_demo_running_dashboard.py --out-root /tmp/demo --keep-raw /tmp/demo/raw
```

## The map under the route

The Sessions pane draws each run over a topographic basemap. The tiles travel
inside the app's ZIP, under `data/tiles/`, because the app cannot fetch anything
(see the last section below).

`scripts/garmin_pull.py` fetches them, trying three sources in order
(`TILE_SOURCES`). Each answers only inside its own coverage, so a route falls
through to the first that has it, and the app credits whichever drew. What the
terms mean for your own copy:

- **Kartverket** (the Norwegian Mapping Authority), Norway — open data under
  **CC BY 4.0**, credited "© Kartverket". Its terms add that the detail at
  zoom 12–20 comes from the Geovekst partnership and may be used as is in a
  service, while *copying* it needs the rights holders' permission. That is why
  the demo ships no Kartverket tiles, although your own private copy fetching
  them for your own runs is exactly the use the terms describe. Keep the copy
  private and its tiles go no further than your own repository and phone.
- **USGS The National Map**, the United States — **public domain**, no
  restrictions; the USGS asks for an acknowledgment (`TILES.md` quotes it). The
  demo's tiles come from here.
- **OpenStreetMap**, everywhere else — credited "© OpenStreetMap
  contributors". OSM's tile usage policy asks for requests that say who is
  making them, so `PROMPT.md` Step 2 has you put your own repository's URL in
  `TILE_AGENT`. The policy covers live fetching, not redistribution inside a
  downloadable archive, so **no OpenStreetMap tile ships in this repository**;
  your own copy fetches its own.

The script fetches a session's own map once, when the session's stream first
arrives, and builds a standing coverage around every route you have run (zoom
13 to 15), at most 300 tiles a run. It never fetches a tile already on disk,
and the builder deletes tiles that no session and no coverage refers to any
more. At about one run an hour, that keeps a personal dashboard inside fair use.
If you run a lot of routes, point `TILE_SOURCES` at a tile provider of your own.

A new tile reaches the phone only with the next ZIP. A change to the app's code
rebuilds the ZIP, and so does running `.github/workflows/build-zips.yml` by hand
(`PROMPT.md` Step 8 does, before the first install); a data pull does not. The
standing coverage exists for that gap: a new run in an area you have run before
already has a map on the phone.

Do not want a basemap? In the demo, delete `data/tiles/`, and the route card
draws the coloured track on its own background, as the demo's Berlin, London
and Tokyo sessions do. In your own copy the next pull would fetch the tiles
again, so also remove the two map steps, `pull_maps` and `pull_coverage`, from
`main()` in `scripts/garmin_pull.py`.

## The coaching text

The Now, Plan and Sessions panes can show an evaluation, a plan, race
predictions and per-session notes. They come from four files in `raw/` —
`assessment.json`, `plan.json`, `racecast.json` and `notes.json` — written by a
separate, optional agent session, once a day. That session reads what the pull
committed — the store, with `calendar.json` for the races ahead — and can tell
from the snapshot's `pulledAt` whether that data is fresh. **The pull never
writes these four files, and the routine writes nothing else**, so neither can
overwrite the other's work. Without the assessment or the plan, the Now and
Plan panes say there is none in this snapshot and that the routine, not the
pull, writes it; without the race forecast, the race card shows Garmin's
predictions alone; a session without a note says it has none. Every number
still works.

`notes.json` goes in through `garmin_append.py`, which merges by activity id
and replaces a note sent again; the routine writes the other three whole:

```
python3 scripts/garmin_append.py notes < notes.json
```

The shapes of the assessment, the plan and the race forecast are in the
header comment of `app.js`; the notes' shape is in the docstring of
`scripts/garmin_append.py`. This repository has no recipe for the routine
itself. What it writes, and how, is yours to decide.

The demo's evaluation, plan, race forecast and session notes were written for
the demo runner from the demo's own numbers, to show what the routine's output
looks like when it is there. Nothing on screen calls it an example, because the
demo's job is to look like a real copy; this file, `PROMPT.md` and the caption
under Snuggery's *Install the live examples* button are where that is said.

## Nothing here is anybody's

Every session, heart rate, night's sleep and weigh-in in the committed `data/`
was invented by `scripts/make_demo_running_dashboard.py` from a fixed seed.
There is no runner. The six routes are segments of famous marathon courses, not
anybody's GPS trace (`TILES.md`), and `raw/context.json` holds the same made-up
runner's numbers. To check that the committed data is exactly what the
generator makes:

```
python3 scripts/make_demo_running_dashboard.py --check
```

This regenerates the demo into a temporary folder and compares it with the
committed files.

Your own copy is the opposite. From the first pull it holds your runs, where
they start, and your body's numbers, which is why it must be private.

## What belongs to this app

Deleting Running Dashboard means deleting:

- `running-dashboard/`, raw store included;
- `.github/workflows/pull-running-dashboard.yml`;
- in `scripts/`: `garmin_pull.py`, `garmin_append.py`, `fit_records.py`,
  `build_garmin_snapshot.py`, `make_demo_running_dashboard.py`,
  `make_demo_courses.py` and `demo_courses.json`, plus `requirements.txt`,
  which only this app's workflow installs;
- the line in `.gitignore` that keeps the receipt out of git, the first three
  carve-outs in `LICENSE`, and the app's row, entry, picture and licence line
  in the root `README.md`.

## No network from the app

The app fetches `./data/snapshot.json`, `./data/streams/<id>.json` and
`./data/tiles/<z>/<x>/<y>.png`, and nothing else; its one typeface is
`fonts/Geist.woff2`. There is no external URL, font, script, image or tile
anywhere in `index.html`, `app.js` or `style.css`. Mini-apps in Snuggery cannot
reach the network, and this one does not try. The pull happens outside, in the
GitHub Action. A Shortcut carries the snapshot in, and the tiles and older
session streams arrive with the ZIP.
