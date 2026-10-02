# Where the weather comes from, what you may do with it, and what it costs

Global Weather draws five things, everywhere on Earth, every three hours for
five days, from **NOAA's Global Forecast System**:

| Layer | What it is | GFS field |
| --- | --- | --- |
| **Wind** | speed and direction 10 meters above the ground | `UGRD`/`VGRD` at 10 m |
| **Temperature** | air temperature 2 meters above the ground | `TMP` at 2 m |
| **Rain** | precipitation rate at the surface, in millimeters an hour | `PRATE` at the surface |
| **Cloud** | total cloud cover, top to bottom, as a percentage | `TCDC`, entire atmosphere |
| **Pressure** | pressure reduced to mean sea level | `PRMSL` |

No key, no account, no registration, no rate limit worth mentioning. The same
five ride the map and the globe; the app reads the list out of the snapshot, so
adding a sixth is a change to the puller alone.

The job reads the forecast straight out of the public AWS Open Data bucket
`noaa-gfs-bdp-pds`, which is a plain HTTPS endpoint anyone can read:

    GET .../gfs.20260922/06/atmos/gfs.t06z.pgrb2.0p25.f048.idx     # the index
    GET .../gfs.20260922/06/atmos/gfs.t06z.pgrb2.0p25.f048         # bytes 12345-67890

Each forecast file is about half a gigabyte and holds several hundred fields.
The `.idx` sidecar beside it lists the byte offset of every one of them, so
`scripts/global_weather.py` asks for just the six it needs with an HTTP range
request. That turns half a gigabyte a step into about 4.6 MB, and the whole
five-day pull into about 190 MB.

---

## The two views

**Map** is Web Mercator, pan and pinch, the world repeating sideways — the
projection every slippy map uses, and the one to read a coastline on.

**Globe** is orthographic: the planet as a sphere, dragged to turn it. It is
not a gimmick for a weather app. A jet stream, a cyclone track and the band of
rain round the equator are all *global* shapes, and a flat map cuts them at the
date line and stretches them at the poles. The globe shows the Southern Ocean
as the single unbroken storm belt it is.

Switching tabs carries the middle of the world across, so the globe opens
looking at whatever the map was looking at.

Both views draw the **night side** as a soft wash, worked out from the sun's
position at the forecast time — so playing the forecast forward walks the
terminator across the planet. It is the Night key in the map's key column (a
globe with its night side filled and its equator drawn on the day side), and it
is worth knowing what it costs: a color under the wash is a slightly darker
color, so if you are reading temperatures off the scale on the night side,
turn it off. The tapped readout is never shaded — it prints the number.

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
  the caption says so; on the globe streaks slow toward the edge. The color
  layer and a tap give the speed.
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

Reduce Motion turns the streaks off and draws the arrows in their place, and play
then moves a whole forecast step at a time. The page stops animating whenever it
is hidden, and About holds everything still while it is open. The math is
`js/flow-math.js`; `DESIGN.md` §1 is the whole design.

## The look

*Long Exposure* (`ART.md`): the screen is a flow photograph of the air with its
caption. The dark theme is the print (pale tracers), the light theme the
negative (ink tracers). Every color ramp is one hue path printed twice, its
lightness inverted between the themes, and all of them stay inside a tonal
budget so a one-point streak reads over any weather — at least 3.0:1 by day and
2.5:1 at night, which `tools/art/palette.py` checks. The one face is **Ysabeau
Office** by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a
subset is in `fonts/` with its license. From `Template/`:
`python global-weather/tools/art/font_subset.py` rebuilds it (fonttools and
Brotli), and `python3 global-weather/tools/art/palette.py --json` prints the
ramps `js/ramps.js` holds.

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
| `assets/world.json` | Coastlines and country borders, Natural Earth 1:10m, simplified and delta-encoded (1.5 MB; how, below) | **Natural Earth — public domain.** "All versions of Natural Earth raster + vector map data found on this website are in the public domain." No permission and no credit are required; the app says *Made with Natural Earth* anyway, which is the form Natural Earth suggests. |
| `fonts/ysabeau-office-gw.woff2` | The app's one face, a Latin subset (35 KB) | **Ysabeau Office, SIL Open Font License 1.1**, by Christian Thalmann (Catharsis Fonts), no Reserved Font Name. `fonts/OFL.txt` carries the license and says how the subset was cut. |
| `assets/places.json` | About 1 600 city labels, tiered so the map shows a few at world scale and more as you zoom in | **GeoNames — CC BY 4.0.** Attribution is a *condition*, not a courtesy: the credit line under the map and the *About this data* panel both name GeoNames and the license. Do not remove them. Editing the list is fine — add your own places, delete the ones you never look at; it stays the same data under the same license. |

### The coastlines

`assets/world.json` is Natural Earth v5.1.2 at **1:10m** — `ne_10m_land` for the land and its coast,
`ne_10m_admin_0_boundary_lines_land` for the borders — built by `scripts/world_json.py` from the
same pinned commit the other apps use, with every download checked against its sha256. The map
zooms to 80 points a degree of longitude, 0.7 km a point at 60° N, and at 1:50m a fjord was a few
kilometers of guesswork there: the Sognefjord one smooth inlet, Nordfjord and the outer islands
gone. Each line is simplified until a point would move it by less than one square point at that
zoom, and stored in hundredths of a degree (about a kilometer east to west at 60° N, under a point
on screen). From `Template/`, with any Python 3.10 or newer and nothing to install:

    python3 scripts/world_json.py            # fetch once, build, write both weather apps' copies
    python3 scripts/world_json.py --check    # a second build, compared byte for byte
    python3 scripts/world_json.py --verify   # decoded the way app.js decodes it

Three hundred thousand points are more than a small scale can show, so the app keeps the world at
four levels, built the first time a view needs one: each keeps a point only half a point from the
last one kept at the scale it serves, and is cut into tiles that a view draws only where it
touches them; the globe also skips a point under half a point from the last one drawn. The whole
world on a phone draws about 21 000 points; the closest zoom draws all of them, but only near the
screen. Natural Earth cuts Chukotka, Wrangel Island and Fiji in two at 180°, and that cut is not a
coast, so neither view strokes it. Lakes are land, as they were at 1:50m, except the Caspian.

**No third-party JavaScript ships with this app.** Not for the globe either:
the sphere is drawn with the browser's own 2D canvas, a few lines of
trigonometry and a land mask rasterized from the same `world.json` the flat map
uses — no WebGL library, no map engine, no tiles. The snapshot's byte planes
are zlib-compressed, and the app unpacks them with the browser's own
`DecompressionStream` where there is one — every major browser since mid-2023 —
falling back to a small decoder written out in full in `app.js`. That is
deliberate: a mini-app runs sandboxed with no way to reach the network, and the
fewer minified blobs inside it, the less there is to take on trust.

---

## How a value is stored

One byte per grid point per plane per step, and the byte means

    value = offset + step * byte ** power

The offset, the step and the power travel in the snapshot's own `layers` block,
so the app reads the scale rather than knowing it. What that buys, per layer:

| Layer | Range a byte covers | Resolution | Power |
| --- | --- | --- | --- |
| Wind speed | 0 to 63.75 m/s | 0.25 m/s | 1 |
| Wind direction | 0 to 360° | 1.4° | 1 (wraps) |
| Temperature | −90 to +63 °C | 0.6 °C | 1 |
| Rain | 0 to 65 mm/h | 0.03 mm/h at 1 mm/h, 0.2 at 10 | **2** |
| Cloud | 0 to 100 % | 0.5 % | 1 |
| Pressure | 870 to 1087 hPa | 0.85 hPa | 1 |

Rain is the one that is not linear, and it is the reason `power` exists.
Precipitation is read on a logarithmic sort of scale by everybody who reads it:
the difference between 0.1 and 0.5 mm/h matters as much as the difference
between 10 and 50. A linear byte over 0–65 mm/h would put all of drizzle into
the first two values. Squaring spends the bytes where the weather is.

Every range above is wider than anything on Earth, so nothing clips — except
rain above 65 mm/h, which GFS does not forecast at a 0.25° grid box.

---

## The size dial, which is the whole design of this app

Five global fields are a lot of numbers: a grid of points, six planes (wind is
two), once per forecast step. Four things decide how many, all at the top of
`scripts/global_weather.py`:

```python
DEGREES = 2.0          # how far apart the grid points are
STEP_HOURS = 3         # how far apart the forecast steps are
FORECAST_DAYS = 5      # how far ahead it goes
LAYERS = [...]         # and how many fields there are
```

The file is packed hard before any of that matters — every step after the first
holds the *change* from the step before it, which is mostly zeroes, and each
plane is deflated and base64'd. That is worth about three times. Even so, the
dials move the answer by a factor of twenty-five, measured on one real GFS run
(2026-09-22 06Z) with `scripts/make_demo_global_weather.py --sizes --hourly`:

| grid | points per step | 3 days, hourly | 5 days, hourly | 3 days, 3-hourly | **5 days, 3-hourly** | 3 days, 6-hourly | 5 days, 6-hourly |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0° | 65 160 | 15.77 MB | 25.98 MB | 6.58 MB | 10.74 MB | 3.76 MB | 6.05 MB |
| 1.5° | 29 040 | 7.30 MB | 12.02 MB | 3.07 MB | 4.99 MB | 1.76 MB | 2.83 MB |
| **2.0°** | **16 380** | 4.21 MB | 6.93 MB | 1.78 MB | **2.89 MB** | 1.03 MB | 1.64 MB |

**The demo committed here is the bold cell: 2°, 3-hourly, five days, five
layers, about 2.9 MB.** That is a deliberate choice for a *template*, where
every copy of the repository carries the file and every phone downloads it on
every refresh. It is coarse — a grid point every 220 km or so — and the map still reads
as a convincing weather field, because the app interpolates between points and
the color layer is smooth. What you lose is the detail of a single fjord or
valley, and a shower that falls on one town rather than a county.

And what each layer costs of that 2.9 MB, at those settings:

| Layer | Snapshot | Download | Why |
| --- | --- | --- | --- |
| Wind | 1.20 MB | ~75 MB | two planes, and direction is the noisiest field here: deflate can do little with an angle that jumps from 359° to 1° |
| Cloud | 0.62 MB | ~32 MB | ragged edges everywhere and it moves fast — the least compressible single plane |
| Rain | 0.43 MB | ~23 MB | mostly a dry planet, and a dry point is a zero byte; where it does rain the field is all edges |
| Temperature | 0.34 MB | ~19 MB | smooth in space and slow in time, so the deltas are nearly all zero |
| Pressure | 0.28 MB | ~38 MB | the smoothest field of the five, and the biggest GRIB message of the five |

**Delete a layer and you save both ends**: its bytes in the file and its
share of the download. Deleting is removing its entry from `LAYERS`; the app
needs no edit, because the layer words, the legend, the units key and the tapped
readout are all built from whatever the snapshot declares. (Wind is the one
exception worth knowing: the streaks and the arrows look for a layer whose key
is `wind`, and simply do not draw if there is not one.)

**Your own copy can turn all of them up.** `1.0°, hourly, five days` is the full
resolution the source can give inside five days, and it is 25.98 MB — which is
under the Shortcut's 32 MB ceiling, but not by much, and not at all if you add a
sixth layer. That is a perfectly good private dashboard; be honest about what it
costs:

- The **phone** downloads all of it on every refresh, and the Shortcut refuses
  anything over 32 MB.
- The app **unpacks every plane of every step** when it opens, and it yields to
  the page while it does, so nothing freezes. It is still that many megabytes of
  JSON to parse before the first frame; time it on your own phone before you
  decide.
- The **pull** grows with the step count, not the grid: hourly for five days is
  121 forecast files and about 560 MB of range requests, against 41 files and
  190 MB at 3-hourly. Both finish inside a few minutes on a runner.

Re-measure before you commit to a setting:

```
python3 scripts/make_demo_global_weather.py --sizes            # about 190 MB of download
python3 scripts/make_demo_global_weather.py --sizes --hourly   # adds the hourly rows, ~560 MB
python3 scripts/make_demo_global_weather.py --sizes --cache /tmp/gfs   # a second run is free
```

`--sizes` needs numpy and eccodes. `--verify` deliberately does not: it reads
the committed snapshot, checks its shape, and compares it against
`data/snapshot.sha256`, which `global_weather.py --demo` writes beside it. That
fingerprint is the part that still works once the GFS run has aged out of the
bucket and `--check` can no longer rebuild it — at which point
`--check` exits 2 rather than 0, so nothing mistakes *could not tell* for
*matched*.

`DEGREES` must divide 0.25 evenly (0.25, 0.5, 1.0, 1.5, 2.0). Above five days
GFS only publishes 3-hourly, so `FORECAST_DAYS` over 5 needs `STEP_HOURS` of at
least 3.

---

## Why the refresh publishes to its own branch

Most apps here commit their snapshot to `main`. Global Weather does not, and
neither does Global Wind, and the reason is arithmetic: the file is megabytes,
and every byte of it is different every run — it is base64 of compressed data,
so git can neither delta it nor compress it. Up to four new runs a day at
2.9 MB is about four gigabytes a year, in a repository people clone.

So `.github/workflows/refresh-global-weather.yml` force-pushes a single
parentless commit to an orphan branch, **`data-global-weather`**. The branch is
a mailbox, not a log: it only ever holds the newest snapshot, and nothing
accumulates. `main` keeps the committed demo, which is what
`zips/global-weather.zip` ships with.

The only thing that changes for you is the branch name in the address your
Shortcut fetches — the path is the same. `PROMPT.md` has both forms.

If you would rather have everything on `main` like the other apps, turn the
dials down first, or cut the layer list to the two or three you actually read.

---

## What the numbers are, and what they are not

- **A forecast, not a measurement.** Everything on the map except the first step
  is a model's guess, and the further right the slider goes the more of a guess
  it is. The header says which model run it came from and how old that run is.
- **Wind 10 meters above the ground, temperature at 2 meters**, which are the
  standard heights weather services report. Wind here is not the wind at the top
  of a hill, at sea level in a harbor, or at the height of a sail.
- **Sustained wind, not gusts.** A gust is commonly half again as strong as the
  number shown here, sometimes more. Do not plan a crossing on this app.
- **Rain is a rate at an instant, not an accumulation.** "2 mm/h at noon" is not
  "2 mm of rain today"; it is how hard it is falling at that moment in the
  model. A shower that lasts twenty minutes shows up as a rate, not a total.
- **Cloud is the total column.** A hundred percent can be high cirrus you can
  read a newspaper under, or a stratus deck at three hundred feet.
- **Pressure is reduced to sea level**, which is what a weather chart shows and
  what a barometer at home should be set to — not the pressure where you are
  standing, if where you are standing is up a mountain.
- **A 2° grid point is the 0.25° model's value at that one point**, sampled
  every 2° (about 220 km), not an average of the area around it. A point that
  lands on a peak or a coast carries that spot's weather, and everything
  between two points is interpolated. Turning `DEGREES` down helps; nothing
  gets you a street.
- **Rounded to a byte**, on the scales in the table above, which are finer than
  the forecast's own uncertainty by a wide margin but do mean the numbers are
  not the model's to the last decimal.
- **The colors are a scale, not a category.** Each layer's ramp is a single
  progression, so "more" always stands further from the ground; the legend
  under the map is painted from the same numbers, and a tap gives the figure —
  nothing on the map is encoded by color alone.

## What the `ask` table holds

The snapshot carries a top-level `ask` array, which is the only part of the file
Snuggery's *Ask About This Data* reads: one flat row per city per forecast day,
with the weather at **12:00 local time** in twelve well-known cities spread
across six continents. Sixty-odd rows, plain keys, numbers and short strings —
and now the whole weather rather than only the wind, so *how warm is Tokyo on
Friday* and *where is it raining on Thursday* both have somewhere to land.

It exists because a question in words cannot be answered from three megabytes of
base64. The app itself never reads it; the map is drawn from the grid. Change
the list at the top of `scripts/global_weather.py` to the places you actually
care about.

The words in it — *Drizzle*, *Overcast*, *Gentle breeze* — come from the same
bands the app puts under a tapped point, so the table and the map agree about
what they mean.

## Being a good guest

The bucket is a public, requester-pays-free AWS Open Data endpoint, and this job
is small by its standards: 41 index requests and 246 range requests per new run,
six at a time, for about 190 MB. It sends a User-Agent naming your repository.
There is no point running it more often than the model publishes — GFS runs four
times a day and takes about four hours to finish writing each run. So the
workflow has eight slots, at 33 minutes past 01, 04, 07, 10, 13, 16, 19 and
22 UTC: one half an hour after each run's last file lands, and a catch-up three
hours later for the slots GitHub fires late or drops. A slot that finds the
newest run already published costs one HEAD request and stops. The slots sit
ten minutes behind Global Wind's, so the two jobs do not pull from the same
bucket at the same minute.

If up to four pulls of 190 MB a day feels like more than you want to take from
a free service — a fair thought — cut the `LAYERS` list, or comment out some of
the slots. Each layer you drop takes its share of the download with it.

## Nothing here is anybody's

The committed `data/snapshot.json` is a real public pull of a real forecast. It
says nothing about any person: it is the weather over the whole planet, and the
twelve cities in the `ask` table are London, Tokyo, Sydney and nine others like
them. There is no account, no token, no address, no name and no location of
anybody's anywhere in this app or in the job that fills it.

The one thing the app asks the device is the clock's offset from UTC, once, to
decide which side of the planet to show when the map or the globe is first opened. It is
not stored and it goes nowhere.

## No network from the app

The app fetches `./data/snapshot.json`, `./assets/world.json` and
`./assets/places.json`, and nothing else. There is no external URL, font,
script, image or map tile anywhere in `index.html`, `app.js`, `js/` or
`style.css` (the face is in `fonts/`) —
mini-apps in Snuggery cannot reach the network, and this one does not try. The
coastlines, the city labels and the weather all travel inside the folder. The
refresh happens outside, in the GitHub Action, and a Shortcut carries the file
in.

## Size, and the checks

| measured 2026-10-01 by `node tools/check.mjs` | bytes | budget |
| --- | --: | --: |
| app code: `index.html`, `style.css`, `app.js`, `js/` | 202 560 | 203 000 |
| `fonts/` | 40 075 | 160 000 |
| `assets/world.json` (stored in the ZIP: 431 665) | 1 538 738 | 1 600 000 |
| the ZIP, packed as `build-zips.yml` packs it | 2 788 186 | 2 800 000 |

`tools/` is not in the ZIP. From `global-weather/`:

- `node tools/check.mjs`: the runtime rules, the budgets, the vendor-name grep,
  the three credits, the camera's strings, the ramps against `palette.py`, and
  the ZIP built exactly as the workflow builds it.
- `node tools/test_flow.mjs`: the flow's math alone, against formulas written
  in the test and the snapshot's own `ask` rows.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: the app in headless Chromium at
  390 × 844, by real touch, both themes and Reduce Motion (`SCREENSHOTS=1`
  writes `screenshots/*-light.png` and `*-dark.png`, never `app.png`). Its frame
  times are headless Chromium's, a trend only: how the flow runs on a phone is
  measured on a phone.
