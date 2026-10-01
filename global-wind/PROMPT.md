# Setting up Global Wind

Paste this whole file into a coding-agent session that has this repository open
— **your own copy**, made with *Use this template*, never the template itself.
The agent does the typing.

## What this app is

Global Wind is the whole planet's wind, five days ahead, two ways: on a **map**
you can pan, pinch and zoom, and on a **globe** you can turn. The wind itself is
drawn as moving streaks — each one carried by the forecast's wind at its place
and hour, at a rate the caption prints — over speed colors you can switch off,
with arrows if you want them. A player along the bottom walks the forecast
forward hour by hour with the night side moving across it, and a tap anywhere
gives the exact wind at that point. The data is NOAA's Global Forecast System,
read from a public bucket that needs no key and no account.

**Global Weather** in this same repository is this app with four more fields —
temperature, rain, cloud and pressure — and the same map, globe, streaks and
look. It is a separate app with its own folder, workflow, data branch and ZIP;
installing one does nothing to the other. This one stays small: 1.2 MB a
refresh against 2.9.

It ships working, with a real pull of a real forecast in it. If the default
resolution suits you there is nothing to set up but the Shortcut row.

## Before you start

- You are working in **your** copy of this repository. If
  `gh repo view --json nameWithOwner -q .nameWithOwner` shows
  `snuggery-apps-template`, stop and make your copy first.
- Python 3.10 or newer (`python3 --version`), and two packages:
  ```
  python3 -m pip install eccodes numpy
  ```
  The `eccodes` wheel carries the GRIB decoder, so there is nothing to
  `apt-get`. These are the only packages Global Wind needs; the workflow
  installs the same two.
- Set the repository once and reuse it:
  ```
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
  ```
- **Read `global-wind/NOTES.md` first.** It carries the terms the app must
  print on screen, what the streaks are and are not, and the measured size
  table that step 1 is about.

## Step 1 — decide how much wind you want

This is the one real decision in this app, and it is three constants at the top
of `scripts/global_wind.py`:

```python
DEGREES = 2.0          # how far apart the grid points are
STEP_HOURS = 3         # how far apart the forecast steps are
FORECAST_DAYS = 5      # how far ahead it goes
```

They move the file size by a factor of twenty-five. The full table is in
`NOTES.md`; the corners of it are:

| setting | file | what it looks like |
| --- | --- | --- |
| `2.0°, 3 h, 5 days` | **1.2 MB** | what ships here — a convincing world field, no local detail |
| `1.5°, 3 h, 5 days` | 2.1 MB | noticeably sharper coastlines of wind |
| `1.0°, 1 h, 5 days` | 11 MB | everything the source has inside five days |
| `2.0°, 6 h, 3 days` | 0.4 MB | small enough to live on `main` (see step 3) |

The demo here is deliberately at the small end, because a *template* is copied
and the file travels with it. Your own copy is yours: turn the dials up if your
phone and your patience allow. Two things to know before you do —

- The **phone** downloads the whole file on every refresh, and the Shortcut
  refuses anything over 32 MB. The app unpacks every step when it opens, yielding
  to the page as it goes — time it on your own phone before you settle on a
  setting rather than trusting a number from anybody's laptop.
- The **pull** grows with the step count. Hourly for five days is 121 forecast
  files and about 200 MB of range requests; 3-hourly is 41 files and 65 MB.

Measure before you commit to a setting — one download, the whole table:

```
python3 scripts/make_demo_global_wind.py --sizes --cache /tmp/gfs
python3 scripts/make_demo_global_wind.py --sizes --hourly --cache /tmp/gfs   # adds the hourly rows
```

Then write a new demo snapshot with whatever you chose, and look at what came
back:

```
python3 scripts/global_wind.py --demo
python3 scripts/make_demo_global_wind.py --verify
```

`--demo` prints the GFS run it used, stores that run's stamp in the file, and
writes `global-wind/data/snapshot.sha256` beside it — so the snapshot always
says where it came from, and the fingerprint says the committed bytes are still
the ones the script wrote. Commit both.

```
python3 scripts/global_wind.py --check
```

`--check` rebuilds that exact run from the bucket and compares, which is the
stronger proof — and it is honest about its own limits. The bucket does not keep
runs forever; once the demo's has gone, `--check` prints *the run has aged out*
and exits **2**, not 0, because "I could not tell" is not "it matched". The
fingerprint is what still works then, and `--verify` compares it offline, on
whatever `python3` you happen to have — no numpy, no network.

`DEGREES` must divide 0.25 evenly (0.25, 0.5, 1.0, 1.5, 2.0). Above five days
GFS only publishes 3-hourly, so `FORECAST_DAYS` over 5 needs `STEP_HOURS` of at
least 3.

## Step 2 — the clock

`.github/workflows/refresh-global-wind.yml` has **eight slots, at 23 minutes
past 01, 04, 07, 10, 13, 16, 19 and 22 UTC**, plus `workflow_dispatch`. Those
are not arbitrary. GFS runs four times a day and takes about four hours to
finish writing each one, file by file; the 00Z run's five-day file lands around
04:10 UTC, the 06Z run's around 10:10, 12Z's around 16:10 and 18Z's around
22:10. One slot sits a few minutes after each, and a second slot three hours
later catches the ones GitHub fires late or drops — and it does both.

The job passes the run it already published to `--skip-run`, so a slot that
lands on a model cycle already on the branch costs one HEAD request and stops.
A new GFS run is the only thing that can change this file, so that check *is*
the "commit only if it changed" test. If up to four refreshes a day is more than
you want, comment out the slots after the runs you do not need: keeping `04:23`
and `10:23` alone gives the 00Z and 06Z runs, twice a day.

If you change `FORECAST_DAYS`, change the cron with it: a shorter forecast is
ready earlier, so you can move the slots an hour or two forward.

Two things that cost an afternoon if nobody says them:

- **`schedule:` only runs from the default branch.** A workflow on a
  pull-request branch is inert however correct it is. Merge to `main` first.
- **Triggering by hand proves the job, not the schedule.** The only evidence
  the *schedule* works is a run whose trigger reads `schedule`:
  ```
  gh api "repos/$REPO/actions/runs?event=schedule" --jq .total_count
  ```
  Check it once, on the day you set this up.

Prove the job now:

```
gh workflow run refresh-global-wind.yml --repo "$REPO"
gh run watch
```

## Step 3 — the branch this one publishes to, and why

**Global Wind and Global Weather are the two apps here that do not commit their
snapshots to `main`.** The file is megabytes and every byte of it is different
every run, so git can neither delta it nor compress it; up to four new runs a
day, that is close to two gigabytes a year in a repository you clone.

Instead the job force-pushes one parentless commit to an orphan branch,
**`data-global-wind`**. The branch only ever holds the newest snapshot, at the
same path, and nothing accumulates. `main` keeps the committed demo, which is
what `zips/global-wind.zip` ships with.

For you that is one word different in the address:

- **Public repository** —
  `https://raw.githubusercontent.com/OWNER/REPO/data-global-wind/global-wind/data/snapshot.json`
- **Private repository** —
  `https://api.github.com/repos/OWNER/REPO/contents/global-wind/data/snapshot.json?ref=data-global-wind`
  with headers `Authorization: Bearer <your read token>` and
  `Accept: application/vnd.github.raw`

(`OWNER/REPO` is what `$REPO` printed.)

If you would rather have everything on `main` like the other apps, turn the
dials down in step 1 first — `2.0°, 6 h, 3 days` is 0.4 MB — and then replace
the workflow's last two steps with the commit-and-push block from
`.github/workflows/refresh-world-news.yml`, which commits one file to the
current branch only if it changed.

## Step 4 — onto the phone

1. Open the raw address of `zips/global-wind.zip` in Safari → Share → Snuggery,
   to install it.
2. In your loop shortcut's Dictionary, add one row: key `Global Wind`, value the
   data address from step 3.
3. In your rebuild shortcut's Dictionary, add the matching row:
   ```
   job  = https://api.github.com/repos/OWNER/REPO/actions/workflows/refresh-global-wind.yml/dispatches
   data = the same data address as above
   ```

The map is heavier than the other apps here: the file is a megabyte or more, and
the phone unpacks every forecast step when the app opens. Give the *Wait* step
in the rebuild shortcut a little longer than you would for a small app — the pull
itself takes two or three minutes on a runner at the shipped settings.

## Making it yours

In rough order of how often people want them:

- **The twelve cities.** `CITIES` at the top of `scripts/global_wind.py` is the
  `ask` table — the rows Snuggery's *Ask About This Data* answers from, one per
  city per forecast day at 12:00 local. Put the places you actually care about
  in it. Each row is `(name, country, longitude, latitude, IANA time zone,
  fallback offset)`; keep the list to a dozen or so, because the table is meant
  to stay under a hundred rows.
- **The map's labels.** `global-wind/assets/places.json` is a plain list of
  `{"n", "lon", "lat", "r"}` — `r` is the tier, 1 shown first, 4 only when you
  zoom right in. Add your own harbor, delete a continent's worth of cities you
  never look at. The app reads the file exactly as it finds it.
- **Units.** The key in the header cycles m/s, km/h, knots and mph, SI first,
  and remembers. If you only ever want one, delete the others from `UNITS` near
  the top of `app.js`.
- **The color scale.** `LOOK` in `app.js` sets where the legend starts and
  stops; the ramp itself is `js/ramps.js`, the `wind` entry that
  `python3 global-wind/tools/art/palette.py --json` prints, which also checks
  that a streak reads over every value. Change the stops in `palette.py`, rerun
  it, and replace the entry in `js/ramps.js` with its output
  (`node tools/check.mjs` fails while the two differ). Keep it a single
  progression: on a map, "further along the scale" has to mean "stronger", and
  nothing may depend on color alone.
- **The streaks.** `js/flow.js` draws them and `js/flow-math.js` holds their
  math; they read the wind's u and v and nothing else. Never color them, or tie
  their width or length to anything: the speed colors are the speed, and the
  caption prints the one rate they run at. Both files are byte-for-byte copies
  of Global Weather's, and `node tools/check.mjs` says so while they still are:
  a fix to one belongs in both.
- **The night wash.** `nightRgb` and `nightMax` in `buildPalette()`. Set
  `nightMax` to 0 in both palettes if you would rather it never shaded at all,
  or just leave the Night key off — the app remembers.
- **Where it opens.** Both views open on the reader's own longitude, worked out
  from the clock's offset from UTC (`CLOCK_LON` in `app.js`), so a phone in
  Chicago opens on the Americas; the map fits 70°S to 70°N. After that each
  remembers where you left it. `MAP_VIEW.fit()` and `GLOBE_VIEW.fit()` in
  `app.js` are where the defaults live.
- **A different level or field.** The script asks for `UGRD`/`VGRD` at
  `10 m above ground`. The same files hold gusts, pressure, temperature and
  winds aloft, all listed in the same `.idx` sidecar — `LEVEL` and the two field
  names in `wind_ranges()` are the whole change. Mind the size table: another
  field is another plane per step. (Global Weather is the app to start from if
  you want several fields at once.)

## Do not touch

- **The credit line under the map, and the source paragraph in *About this
  data*.** The city labels are CC BY 4.0 and attribution is a condition of using
  them, not a courtesy. The sentence saying the wind is sampled and rounded is
  there because NOAA asks that modified data is not presented as unaltered NOAA
  data. Both are in `NOTES.md` in full.
- **The `.idx` range requests.** It would be simpler to download the whole
  forecast file and throw 99.7 % of it away. Do not: that is half a gigabyte a
  step from a free public service, for two fields.

## If something fails

Stop and report the exact error text rather than working around it.

**`no complete GFS run found in the last two days`** — the script checks whether
a run's *last* step is in the bucket before using any of it, so this means the
bucket is genuinely behind, not that anything is broken. Re-run in an hour; the
catch-up slot three hours after each run's slot exists for exactly this.

**A step disappears mid-pull.** NOAA occasionally republishes a run while it is
being read. The script catches that, drops back a cycle and builds the previous
run instead; you will see `trying the previous run` in the log and a slightly
older `run` stamp in the file.

**The written-over-by-an-error-page trap.** If a Shortcut's fetch returns an
error page — an expired token most often — that page is frequently valid JSON,
and the Shortcut writes it straight over `data/snapshot.json`. The app then says
*data/snapshot.json is not a Global Wind snapshot* and names what is missing;
if the reply came from the code-hosting service it quotes its message back at
you. Open the file in Snuggery (⋯ → App Files) and look at what is actually in
it before changing any code.

**`it is a schema 2 snapshot`** means this app's Shortcut row is pointed at
Global Weather's branch, `data-global-weather`, which holds five fields in a
different shape. The two apps have one data address each; step 3 has this
one's.

**`data/snapshot.json is not a Global Wind snapshot: unknown compression "…"`**
means the file's `encoding.compression` is something other than `deflate` or
`none`, so the job and the app have drifted apart. Nothing is wrong with the
browser: the app carries its own decoder and never needs one from outside. The
contract is written out at the top of `app.js`.

**A missed refresh does not break anything.** The branch keeps the last good
snapshot, the app reads whatever it finds, and the header stamps it: *Stale*
while the forecast still covers now, *Forecast ran out N d ago* once it does
not. Never an error where a forecast used to be.
