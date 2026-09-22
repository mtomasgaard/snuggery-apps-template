# Setting up Global Weather

Paste this whole file into a coding-agent session that has this repository open
— **your own copy**, made with *Use this template*, never the template itself.
The agent does the typing.

## What this app is

Global Weather is the whole planet's weather, five days ahead, on a map you can
pan, pinch and zoom — and on a globe you can turn. Five layers from one
forecast: **wind** (a colour layer and arrows), **temperature**, **rain**,
**cloud** and **pressure**. A player along the bottom walks the forecast
forward hour by hour with the night side moving across it, and a tap anywhere
gives all five numbers at that point. The data is NOAA's Global Forecast
System, read from a public bucket that needs no key and no account.

It ships working, with a real pull of a real forecast in it. If the default
resolution suits you there is nothing to set up but the Shortcut row.

**Global Wind is still here and still runs.** This is a second app, not a
replacement: its own folder, its own script, its own workflow, its own data
branch and its own ZIP. Nothing about the Global Wind loop changes when you
install this one, and you can keep both, or neither, or swap one for the other
later. The two share a lot of code — the globe, the map, the player, the
inflater — and they are deliberately separate anyway, because a mini-app ships
as one folder and one ZIP.

Global Wind has the same map and the same globe, drawn from one field. Come
here when you want the temperature, the rain, the cloud and the pressure with
it, and are willing to pay 2.9 MB a refresh instead of 1.2 MB.

## Before you start

- You are working in **your** copy of this repository. If
  `gh repo view --json nameWithOwner -q .nameWithOwner` shows
  `snuggery-apps-template`, stop and make your copy first.
- Python 3.10 or newer (`python3 --version`), and two packages:
  ```
  python3 -m pip install eccodes numpy
  ```
  The `eccodes` wheel carries the GRIB decoder, so there is nothing to
  `apt-get`. These are the only packages Global Weather needs; the workflow
  installs the same two.
- Set the repository once and reuse it:
  ```
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
  ```
- **Read `global-weather/NOTES.md` first.** It carries the terms the app must
  print on screen, the byte scales each layer is stored on, and the measured
  size table that step 1 is about.

## Step 1 — decide how much weather you want

This is the one real decision in this app, and it is four things at the top of
`scripts/global_weather.py`:

```python
DEGREES = 2.0          # how far apart the grid points are
STEP_HOURS = 3         # how far apart the forecast steps are
FORECAST_DAYS = 5      # how far ahead it goes
LAYERS = [...]         # wind, temp, rain, cloud, pressure
```

They move the file size by a factor of twenty-five, and the layer list moves it
again. The full tables are in `NOTES.md`; the corners of it are:

| setting | file | what it looks like |
| --- | --- | --- |
| `2.0°, 3 h, 5 days, 5 layers` | **2.9 MB** | what ships here — a convincing world, no local detail |
| `1.5°, 3 h, 5 days, 5 layers` | 5.0 MB | noticeably sharper fronts and coastlines of weather |
| `1.0°, 1 h, 5 days, 5 layers` | 26 MB | everything the source has inside five days, near the Shortcut's 32 MB ceiling |
| `2.0°, 6 h, 3 days, 5 layers` | 1.0 MB | small enough to live on `main` (see step 3) |
| `2.0°, 3 h, 5 days, wind + temp` | 1.6 MB | drop the three layers you never look at |

The demo here is deliberately at the small end, because a *template* is copied
and the file travels with it. Your own copy is yours: turn the dials up if your
phone and your patience allow. Three things to know before you do —

- The **phone** downloads the whole file on every refresh, and the Shortcut
  refuses anything over 32 MB. The app unpacks every plane of every step when it
  opens, yielding to the page as it goes — time it on your own phone before you
  settle on a setting rather than trusting a number from anybody's laptop.
- The **pull** grows with the step count. Hourly for five days is 121 forecast
  files and about 560 MB of range requests; 3-hourly is 41 files and 190 MB.
- **Deleting a layer saves both ends.** It is one entry out of `LAYERS`, and the
  app needs no edit at all: the chips, the legend, the units button and the
  tapped readout are built from whatever the snapshot declares. Keep `wind` if
  you want the arrows — they are the one thing that looks for a layer by name.

Measure before you commit to a setting — one download, the whole table:

```
python3 scripts/make_demo_global_weather.py --sizes --cache /tmp/gfs
python3 scripts/make_demo_global_weather.py --sizes --hourly --cache /tmp/gfs   # adds the hourly rows
```

Then write a new demo snapshot with whatever you chose, and look at what came
back:

```
python3 scripts/global_weather.py --demo
python3 scripts/make_demo_global_weather.py --verify
```

`--demo` prints the GFS run it used, stores that run's stamp in the file, and
writes `global-weather/data/snapshot.sha256` beside it — so the snapshot always
says where it came from, and the fingerprint says the committed bytes are still
the ones the script wrote. Commit both.

```
python3 scripts/global_weather.py --check
```

`--check` rebuilds that exact run from the bucket and compares, which is the
stronger proof — and it is honest about its own limits. The bucket does not keep
runs for ever; once the demo's has gone, `--check` prints *the run has aged out*
and exits **2**, not 0, because "I could not tell" is not "it matched". The
fingerprint is what still works then, and `--verify` compares it offline, on
whatever `python3` you happen to have — no numpy, no network.

`DEGREES` must divide 0.25 evenly (0.25, 0.5, 1.0, 1.5, 2.0). Above five days
GFS only publishes 3-hourly, so `FORECAST_DAYS` over 5 needs `STEP_HOURS` of at
least 3.

## Step 2 — the clock

`.github/workflows/refresh-global-weather.yml` runs at **04:33 and 10:33 UTC**,
plus `workflow_dispatch`. Those are not arbitrary. GFS runs four times a day and
takes about four hours to finish writing each one, file by file; the 00Z run's
five-day file lands around 04:10 UTC and the 06Z run's around 10:10. Each slot
sits half an hour later, which still works when GitHub fires late — and it does.

The ten minutes between this and Global Wind's slots are deliberate: both jobs
read the same bucket for the same runs, and two of them pulling hundreds of
megabytes through it at the same minute is not neighbourly.

The job passes the run it already published to `--skip-run`, so a slot that
lands on a model cycle already on the branch costs one HEAD request and stops.
A new GFS run is the only thing that can change this file, so that check *is*
the "commit only if it changed" test.

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
gh workflow run refresh-global-weather.yml --repo "$REPO"
gh run watch
```

## Step 3 — the branch this one publishes to, and why

**Global Weather and Global Wind are the two apps here that do not commit their
snapshots to `main`.** The file is megabytes and every byte of it is different
every run, so git can neither delta it nor compress it; twice a day that is a
couple of gigabytes a year in a repository you clone.

Instead the job force-pushes one parentless commit to an orphan branch,
**`data-global-weather`**. The branch only ever holds the newest snapshot, at
the same path, and nothing accumulates. `main` keeps the committed demo, which
is what `zips/global-weather.zip` ships with.

For you that is one word different in the address:

- **Public repository** —
  `https://raw.githubusercontent.com/OWNER/REPO/data-global-weather/global-weather/data/snapshot.json`
- **Private repository** —
  `https://api.github.com/repos/OWNER/REPO/contents/global-weather/data/snapshot.json?ref=data-global-weather`
  with headers `Authorization: Bearer <your read token>` and
  `Accept: application/vnd.github.raw`

(`OWNER/REPO` is what `$REPO` printed.)

If you would rather have everything on `main` like the other apps, turn the
dials down in step 1 first — `2.0°, 6 h, 3 days` is 1.0 MB — and then replace
the workflow's last two steps with the commit-and-push block from
`.github/workflows/refresh-world-news.yml`, which commits one file to the
current branch only if it changed.

`data-global-wind` is a different branch for a different app, written by a
different workflow. The two never touch, and neither does anything else in this
repository: each refresh job force-pushes only its own orphan branch.

## Step 4 — onto the phone

1. Open the raw address of `zips/global-weather.zip` in Safari → Share →
   Snuggery, to install it.
2. In your loop shortcut's Dictionary, add one row: key `Global Weather`, value
   the data address from step 3.
3. In your rebuild shortcut's Dictionary, add the matching row:
   ```
   job  = https://api.github.com/repos/OWNER/REPO/actions/workflows/refresh-global-weather.yml/dispatches
   data = the same data address as above
   ```
4. Global Wind, if you have it, keeps its own rows and its own ZIP. Leave them
   alone — the two apps share nothing on the phone but the shortcut that
   carries their files in.

The map is heavier than the other apps here: the file is three megabytes or
more, and the phone unpacks every plane of every forecast step when the app
opens. Give the *Wait* step in the rebuild shortcut a little longer than you
would for a small app — the pull itself takes two or three minutes on a runner
at the shipped settings.

## Making it yours

In rough order of how often people want them:

- **The layers.** `LAYERS` at the top of `scripts/global_weather.py` is the
  whole list. Each entry names the GRIB messages to fetch, the scale its values
  are stored on and the words the app prints. Delete the ones you never look at;
  add one you do — the same forecast files hold gusts (`GUST` at the surface),
  humidity (`RH` at 2 m), snow depth, CAPE, and winds aloft, all listed in the
  same `.idx` sidecar the job already reads. A new layer draws on a plain colour
  scale with no edit to the app; give it a nicer one by adding an entry to
  `LOOKS` near the top of `app.js`, which is where the five shipped scales live.
- **The twelve cities.** `CITIES` in the same file is the `ask` table — the rows
  Snuggery's *Ask About This Data* answers from, one per city per forecast day
  at 12:00 local, now with temperature, rain, cloud and pressure beside the
  wind. Put the places you actually care about in it. Each row is `(name,
  country, longitude, latitude, IANA time zone, fallback offset)`; keep the list
  to a dozen or so, because the table is meant to stay under a hundred rows.
- **The map's labels.** `global-weather/assets/places.json` is a plain list of
  `{"n", "lon", "lat", "r"}` — `r` is the tier, 1 shown first, 4 only when you
  zoom right in. Add your own harbour, delete a continent's worth of cities you
  never look at. The app reads the file exactly as it finds it.
- **Units.** The header button cycles the units of whichever layer is on
  screen — m/s, km/h, knots, mph for wind; °C and °F; mm/h and in/h; hPa and
  inHg — and each layer remembers its own. The lists are `UNITS` near the top of
  `app.js`.
- **The colour scales.** `LOOKS` in `app.js` is one entry per layer: `stops` is
  value → colour, `alpha` is value → opacity, `legend` is where the bar starts
  and stops. The legend and the chips are painted from the same arrays as the
  map, so changing one changes all three. Keep each one a single progression
  with no hue cycling: on a map, "further along the scale" has to mean "more",
  and nothing may depend on colour alone.
- **The night wash.** `nightRgb` and `nightMax` in `buildPalette()`. Set
  `nightMax` to 0 in both palettes if you would rather it never shaded at all,
  or just leave the moon button off — the app remembers.
- **Where it opens.** The map fits 70°S to 70°N on first launch; the globe opens
  on the reader's own longitude, worked out from the clock's offset from UTC.
  After that each remembers where you left it. `MAP_VIEW.fit()` and
  `GLOBE_VIEW.fit()` in `app.js` are where the defaults live.

## Do not touch

- **The credit line under the map, and the source paragraph in *About this
  data*.** The city labels are CC BY 4.0 and attribution is a condition of using
  them, not a courtesy. The sentence saying the weather is sampled and rounded is
  there because NOAA asks that modified data is not presented as unaltered NOAA
  data. Both are in `NOTES.md` in full.
- **The `.idx` range requests.** It would be simpler to download the whole
  forecast file and throw 99 % of it away. Do not: that is half a gigabyte a
  step from a free public service, for six fields.

## If something fails

Stop and report the exact error text rather than working around it.

**`no complete GFS run found in the last two days`** — the script checks whether
a run's *last* step is in the bucket before using any of it, so this means the
bucket is genuinely behind, not that anything is broken. Re-run in an hour; the
schedule's second slot exists for exactly this.

**`the index does not hold <field>`** — a layer is asking for a GRIB message
that is not in the file under that name. The variable and level in a `LAYERS`
entry are matched against the `.idx` sidecar exactly as they are written there;
fetch one and look:
`curl -s .../gfs.t06z.pgrb2.0p25.f003.idx | grep TMP`.

**A step disappears mid-pull.** NOAA occasionally republishes a run while it is
being read. The script catches that, drops back a cycle and builds the previous
run instead; you will see `trying the previous run` in the log and a slightly
older `run` stamp in the file.

**The written-over-by-an-error-page trap.** If a Shortcut's fetch returns an
error page — an expired token most often — that page is frequently valid JSON,
and the Shortcut writes it straight over `data/snapshot.json`. The app then says
*data/snapshot.json is not a Global Weather snapshot* and names what is missing;
if the reply came from the code-hosting service it quotes its message back at
you. Open the file in Snuggery (⋯ → App Files) and look at what is actually in
it before changing any code.

**`it is a schema 1 snapshot`** means this app's Shortcut row is pointed at
Global Wind's branch, `data-global-wind`, which holds wind and nothing else.
The two apps have one data address each; step 3 has this one's.

**`data/snapshot.json is not a Global Weather snapshot: unknown compression "…"`**
means the file's `encoding.compression` is something other than `deflate` or
`none`, so the job and the app have drifted apart. Nothing is wrong with the
browser: the app carries its own decoder and never needs one from outside. The
contract is written out at the top of `app.js`.

**A missed refresh does not break anything.** The branch keeps the last good
snapshot, the app reads whatever it finds, and the header stamps it: *Stale*
while the forecast still covers now, *Forecast ran out N d ago* once it does
not. Never an error where a forecast used to be.
