# Where the wind comes from, what you may do with it, and what it costs

Global Wind draws one thing: the forecast **wind 10 meters above the ground**,
everywhere on Earth, every three hours for five days, from **NOAA's Global
Forecast System**. No key, no account, no registration, no rate limit worth
mentioning.

The job reads the forecast straight out of the public AWS Open Data bucket
`noaa-gfs-bdp-pds`, which is a plain HTTPS endpoint anyone can read:

    GET .../gfs.20260921/06/atmos/gfs.t06z.pgrb2.0p25.f048.idx     # the index
    GET .../gfs.20260921/06/atmos/gfs.t06z.pgrb2.0p25.f048         # bytes 12345-67890

Each forecast file is about half a gigabyte and holds several hundred fields.
The `.idx` sidecar beside it lists the byte offset of every one of them, so
`scripts/global_wind.py` asks for just the two it needs — eastward and
northward wind at 10 m — with an HTTP range request. That turns half a gigabyte
a step into about 1.6 MB, and the whole five-day pull into about 65 MB.

**Global Weather**, the sibling app in this repository, is this app with four
more fields — temperature, rain, cloud and pressure — and the same map, globe,
streaks and look. The two are separate apps, copied by hand, because a mini-app
ships as one folder; a fix to one belongs in both.

---

## The two views

**Map** is Web Mercator, pan and pinch, the world repeating sideways — the
projection every slippy map uses, and the one to read a coastline on.

**Globe** is orthographic: the planet as a sphere, dragged to turn it. It is
not a gimmick. A jet stream and the Southern Ocean's storm belt are *global*
shapes, and a flat map cuts them at the date line and stretches them at the
poles; the globe shows the belt as the single unbroken ring it is. Switching
tabs carries the middle of the world across, so the globe opens looking at
whatever the map was looking at.

Both views draw the **night side** as a soft wash, worked out from the sun's
position at the forecast time — so playing the forecast forward walks the
terminator across the planet. It is the Night key in the map's key column, and
it is worth knowing what it costs: a color under the wash is a slightly darker
color, so if you are reading speeds off the scale on the night side, turn it
off. The tapped readout is never shaded — it prints the number.

**Speed colors**, the word at the right of the header, colors the map by wind
speed on the scale under it. Off, the plate shows its bare ground and the wind
moving over it; the legend's bar steps aside but keeps its place, so nothing
on screen jumps.

**No third-party JavaScript draws the globe.** The sphere is the browser's own
2D canvas, a few lines of trigonometry and a land mask rasterized once from the
same `assets/world.json` the flat map uses — no WebGL library, no map engine,
no tiles.

## What the streaks are

The moving streaks on the map and the globe are the wind itself. Each is a
tracer carried by the forecast's wind at the place it is over, for the hour on
the slider: it moves the way that wind blows, at that wind's speed, times one
rate the caption prints — *Streaks: 1 s = 24 h of wind at the hour shown*. The
rate is a rung of a fixed ladder (2 days, 24 h, 12 h, 6 h, 3 h, 90 min, 45 min),
chosen so a typical wind moves about 18 points a second at the middle of the
screen, and it changes only when a zoom needs it.

What they are not:

- **Not strength by length.** On the flat map the same wind moves faster toward
  the poles, because Web Mercator stretches there (twice as fast at 60°), and
  the caption says so; on the globe streaks slow toward the edge. The speed
  colors and a tap give the speed.
- **Not invented, and not a density map.** Streaks start at random, evenly
  over the screen, live 1.5–3.5 s, and get no minimum speed. Where they gather
  is partly the air and partly the picture: they bunch where the forecast's air
  converges, but also where the picture shrinks the ground under them (toward
  the equator on the flat map, toward the edge on the globe), and otherwise
  their spacing is random. Their color and width encode nothing.
- **Not the air's path over five days.** They trace the wind of the hour shown
  as if it held still; play moves that hour on at 5 h a second while the
  streaks keep the printed rate.
- **No finer than the grid.** The flow reads one value every 2°, so it runs
  smoothly across coasts, straits and mountains smaller than that sampled grid
  can show.

The Arrows key draws the same wind as arrows on a fixed grid instead, their
length and weight growing with speed up to 25 m/s; Flow and Arrows can be on
together or alone. Reduce Motion turns the streaks off and draws the arrows in
their place, and play then moves a whole forecast step at a time. The page
stops animating whenever it is hidden, and About holds everything still while
it is open. The math is `js/flow-math.js`; `DESIGN.md` says where the design
lives.

## The look

*Long Exposure*, Global Weather's direction, by copy (`ART.md` says how this app
differs): the screen is a flow photograph of the air with its caption. The dark
theme is the print (pale tracers), the light theme the negative (ink tracers).
The wind's color ramp is one hue path printed twice, its lightness inverted
between the themes, and it stays inside a tonal budget so a one-point streak
reads over any of it — at least 3.0:1 by day and 2.5:1 at night, which
`tools/art/palette.py` checks. The one face is **Ysabeau Office** by Christian
Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in `fonts/`
with its license. It is a byte-for-byte copy of Global Weather's, and the
script that cut it is there: `python global-weather/tools/art/font_subset.py`
from `Template/`. `python3 global-wind/tools/art/palette.py --json` prints the
ramps; `js/ramps.js` holds its `wind` entry.

---

## The terms

**The forecast is public domain.** GFS output is a work of the United States
Government. NOAA's own statement on the Open Data page the bucket is registered
under reads:

> NOAA data disseminated through NODD are open to the public and can be used as
> desired.

with two conditions attached, both of which this app honors on screen:

> NOAA requests attribution for the use or dissemination of unaltered NOAA data.

and that nobody may claim NOAA's endorsement, or present **modified** data as
though it were unaltered NOAA data. This app's data *is* modified — the
0.25-degree forecast is sampled down to a coarser grid and each value is rounded
to one byte — so the line under the map and the *About this data* panel both say
so, in those words. **Keep them.** They are what makes the picture honest as
well as legal.

NOAA's suggested citation, for anywhere you write about this:

> NOAA Global Forecast System (GFS) was accessed on *DATE* from
> `registry.opendata.aws/noaa-gfs-bdp-pds`.

### The three things that travel inside the app

The two data files' terms are spelled out in `assets/LICENSES.md`, and the
face's in `fonts/OFL.txt`.

| File | What it is | Terms |
| --- | --- | --- |
| `assets/world.json` | Coastlines and country borders, simplified and delta-encoded | **Natural Earth — public domain.** "All versions of Natural Earth raster + vector map data found on this website are in the public domain." No permission and no credit are required; the app says *Made with Natural Earth* anyway, which is the form Natural Earth suggests. |
| `fonts/ysabeau-office-gw.woff2` | The app's one face, a Latin subset (35 KB) | **Ysabeau Office, SIL Open Font License 1.1**, by Christian Thalmann (Catharsis Fonts), no Reserved Font Name. `fonts/OFL.txt` carries the license and says how the subset was cut. |
| `assets/places.json` | About 1 600 city labels, tiered so the map shows a few at world scale and more as you zoom in | **GeoNames — CC BY 4.0.** Attribution is a *condition*, not a courtesy: the credit line under the map and the *About this data* panel both name GeoNames and the license. Do not remove them. Editing the list is fine — add your own places, delete the ones you never look at; it stays the same data under the same license. |

**No third-party JavaScript ships with this app.** The snapshot's byte planes
are zlib-compressed, and the app unpacks them with the browser's own
`DecompressionStream` where there is one — every major browser since mid-2023 —
falling back to a small decoder written out in full in `app.js`. That is
deliberate: a mini-app runs sandboxed with no way to reach the network, and the
fewer minified blobs inside it, the less there is to take on trust.

---

## The size dial, which is the whole design of this app

A global wind field is a lot of numbers: a grid of points, twice (speed and
direction), once per forecast step. Three constants at the top of
`scripts/global_wind.py` decide how many:

```python
DEGREES = 2.0          # how far apart the grid points are
STEP_HOURS = 3         # how far apart the forecast steps are
FORECAST_DAYS = 5      # how far ahead it goes
```

The file is packed hard before any of that matters — every step after the first
holds the *change* from the step before it, which is mostly zeroes, and each
plane is deflated and base64'd. That is worth about three times. Even so, the
dials move the answer by a factor of twenty-five, measured on one real GFS run
(2026-09-21 06Z) with `scripts/make_demo_global_wind.py --sizes --hourly`:

| grid | points per step | 3 days, hourly | 5 days, hourly | 3 days, 3-hourly | **5 days, 3-hourly** | 3 days, 6-hourly | 5 days, 6-hourly |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0° | 65 160 | 6.74 MB | 11.12 MB | 2.84 MB | 4.62 MB | 1.62 MB | 2.61 MB |
| 1.5° | 29 040 | 3.11 MB | 5.12 MB | 1.31 MB | 2.12 MB | 0.75 MB | 1.20 MB |
| **2.0°** | **16 380** | 1.78 MB | 2.93 MB | 0.75 MB | **1.22 MB** | 0.43 MB | 0.69 MB |

**The demo committed here is the bold cell: 2°, 3-hourly, five days, about
1.2 MB.** That is a deliberate choice for a *template*, where every copy of the
repository carries the file and every phone downloads it on every refresh. It
is coarse — a grid point every 220 km or so — and the map still reads as a
convincing wind field, because the app interpolates between points and the
colors and the streaks are smooth. What you lose is the detail of a single
fjord or valley.

**Your own copy can turn all three up.** `1.0°, hourly, five days` is the full
resolution the source can give inside five days, and it is 11 MB. That is a
perfectly good private dashboard — but be honest about what it costs:

- The **phone** downloads all of it on every refresh, and the Shortcut refuses
  anything over 32 MB.
- The app **unpacks every step** when it opens, and it yields to the page while
  it does, so nothing freezes. It is still eleven megabytes of JSON to parse
  before the first frame; time it on your own phone before you decide.
- The **pull** grows with the step count, not the grid: hourly for five days is
  121 forecast files and about 200 MB of range requests, against 41 files and
  65 MB at 3-hourly. Both finish inside a few minutes on a runner.

Re-measure before you commit to a setting:

```
python3 scripts/make_demo_global_wind.py --sizes            # about 65 MB of download
python3 scripts/make_demo_global_wind.py --sizes --hourly   # adds the hourly rows, ~200 MB
python3 scripts/make_demo_global_wind.py --sizes --cache /tmp/gfs   # a second run is free
```

`--sizes` needs numpy and eccodes. `--verify` deliberately does not: it reads
the committed snapshot, checks its shape, and compares it against
`data/snapshot.sha256`, which `global_wind.py --demo` writes beside it. That
fingerprint is the part that still works once the GFS run has aged out of the
bucket and `--check` can no longer rebuild it — at which point
`--check` exits 2 rather than 0, so nothing mistakes *could not tell* for
*matched*.

`DEGREES` must divide 0.25 evenly (0.25, 0.5, 1.0, 1.5, 2.0). Above five days
GFS only publishes 3-hourly, so `FORECAST_DAYS` over 5 needs `STEP_HOURS` of at
least 3.

---

## Why the refresh publishes to its own branch

Most apps here commit their snapshot to `main`. Global Wind does not, and
neither does Global Weather, and the reason is arithmetic: the file is
megabytes, and every byte of it is different every run — it is base64 of
compressed data, so git can neither delta it nor compress it. Up to four new
runs a day at 1.2 MB is close to two gigabytes a year, in a repository people
clone.

So `.github/workflows/refresh-global-wind.yml` force-pushes a single parentless
commit to an orphan branch, **`data-global-wind`**. The branch is a mailbox, not
a log: it only ever holds the newest snapshot, and nothing accumulates. `main`
keeps the committed demo, which is what `zips/global-wind.zip` ships with.
Global Weather does the same on `data-global-weather`; the two branches and the
two jobs never touch.

The only thing that changes for you is the branch name in the address your
Shortcut fetches — the path is the same. `PROMPT.md` has both forms.

If you would rather have everything on `main` like the other apps, turn the
dials down first: `2°, 6-hourly, three days` is 0.43 MB. It is still not
nothing.

---

## What the numbers are, and what they are not

- **A forecast, not a measurement.** Everything on the map except the first step
  is a model's guess, and the further right the slider goes the more of a guess
  it is. The header says which model run it came from and how old that run is.
- **Wind 10 meters above the ground**, which is the standard height weather
  services report. It is not the wind at the top of a hill, at sea level in a
  harbor, or at the height of a sail.
- **Sustained wind, not gusts.** A gust is commonly half again as strong as the
  number shown here, sometimes more. Do not plan a crossing on this app.
- **A 2° grid point is the 0.25° model's value at that one point**, sampled
  every 2° (about 220 km), not an average of the area around it. A point that
  lands on a peak or a coast carries that spot's wind, and everything between
  two points is interpolated. Turning `DEGREES` down helps; nothing gets you a
  street.
- **Rounded to a byte.** Speed is stored in steps of 0.25 m/s and direction in
  steps of about 1.4°, which is finer than the forecast's own uncertainty by a
  wide margin, but it does mean the numbers are not the model's to the last
  decimal.
- **The colors are a scale, not a category.** The ramp is a single progression,
  so "more" always stands further from the ground; the legend under the map is
  painted from the same numbers, and a tap gives the figure — nothing on the
  map is encoded by color alone.

## What the `ask` table holds

The snapshot carries a top-level `ask` array, which is the only part of the file
Snuggery's *Ask About This Data* reads: one flat row per city per forecast day,
with the wind at **12:00 local time** in twelve well-known cities spread across
six continents. Sixty rows at most, plain keys, numbers and short strings.

It exists because a question in words — *where is it windiest on Thursday?* —
cannot be answered from a megabyte of base64. The app itself never reads it;
the map is drawn from the grid. Change the list at the top of
`scripts/global_wind.py` to the places you actually care about.

The words in it — *Gentle breeze*, *Near gale* — come from the same Beaufort
bands the app puts under a tapped point, so the table and the map agree about
what they mean.

## Being a good guest

The bucket is a public, requester-pays-free AWS Open Data endpoint, and this job
is small by its standards: 41 index requests and 82 range requests per new run,
six at a time, for about 65 MB. It sends a User-Agent naming your repository.
There is no point running it more often than the model publishes — GFS runs four
times a day and takes about four hours to finish writing each run. So the
workflow has eight slots, at 23 minutes past 01, 04, 07, 10, 13, 16, 19 and
22 UTC: one a few minutes after each run's last file lands, and a catch-up three
hours later for the slots GitHub fires late or drops. A slot that finds the
newest run already published costs one HEAD request and stops. Global Weather's
slots sit ten minutes later, so the two jobs do not pull from the same bucket at
the same minute.

## Nothing here is anybody's

The committed `data/snapshot.json` is a real public pull of a real forecast. It
says nothing about any person: it is the wind over the whole planet, and the
twelve cities in the `ask` table are London, Tokyo, Sydney and nine others like
them. There is no account, no token, no address, no name and no location of
anybody's anywhere in this app or in the job that fills it.

The one thing the app asks the device is the clock's offset from UTC, once, to
decide which side of the planet to show when the map or the globe is first
opened. It is not stored and it goes nowhere.

## No network from the app

The app fetches `./data/snapshot.json`, `./assets/world.json` and
`./assets/places.json`, and nothing else. There is no external URL, font,
script, image or map tile anywhere in `index.html`, `app.js`, `js/` or
`style.css` (the face is in `fonts/`) — mini-apps in Snuggery cannot reach the
network, and this one does not try. The coastlines, the city labels and the
wind all travel inside the folder. The refresh happens outside, in the GitHub
Action, and a Shortcut carries the file in.

## Size, and the checks

| measured 2026-10-01 by `node tools/check.mjs` | bytes | budget |
| --- | --: | --: |
| app code: `index.html`, `style.css`, `app.js`, `js/` | 180 486 | 200 000 |
| `fonts/` | 40 075 | 160 000 |
| the ZIP, packed as `build-zips.yml` packs it | 1 177 963 | 1 600 000 |

`tools/` is not in the ZIP. From `global-wind/`:

- `node tools/check.mjs`: the runtime rules, the budgets, the vendor-name grep,
  the three credits, the camera's strings, the ramp against `palette.py`, the
  files this app shares with Global Weather byte for byte, and the ZIP built
  exactly as the workflow builds it.
- `node tools/test_flow.mjs`: the flow's math alone, against formulas written
  in the test and the snapshot's own `ask` rows.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: the app in headless Chromium at
  390 × 844, by real touch, both themes and Reduce Motion (`SCREENSHOTS=1`
  writes `screenshots/*-light.png` and `*-dark.png`, never `app.png`). Its frame
  times are headless Chromium's, a trend only: how the flow runs on a phone is
  measured on a phone.
