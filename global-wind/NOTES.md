# Where the wind comes from, what you may do with it, and what it costs

Global Wind draws one thing: the forecast **wind 10 metres above the ground**,
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

Both views can shade the **night side**, worked out from the sun's position at
the forecast time — so playing the forecast forward walks the terminator across
the planet. It is the moon button over the map, and it is worth knowing what it
costs: a colour under the wash is a slightly darker colour, so if you are
reading speeds off the scale on the night side, turn it off. The tapped readout
is never shaded — it prints the number.

**No third-party JavaScript draws the globe.** The sphere is the browser's own
2D canvas, a few lines of trigonometry and a land mask rasterised once from the
same `assets/world.json` the flat map uses — no WebGL library, no map engine,
no tiles. The globe, the land mask and the terminator are about three hundred
lines you can lift wholesale into another app — the author keeps a private
variant carrying four more fields that does exactly that.

---

## The terms

**The forecast is public domain.** GFS output is a work of the United States
Government. NOAA's own statement on the Open Data page the bucket is registered
under reads:

> NOAA data disseminated through NODD are open to the public and can be used as
> desired.

with two conditions attached, both of which this app honours on screen:

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

### The two things that travel inside the app

Both are spelled out beside the files themselves, in `assets/LICENSES.md`.

| File | What it is | Terms |
| --- | --- | --- |
| `assets/world.json` | Coastlines and country borders, simplified and delta-encoded | **Natural Earth — public domain.** "All versions of Natural Earth raster + vector map data found on this website are in the public domain." No permission and no credit are required; the app says *Made with Natural Earth* anyway, which is the form Natural Earth suggests. |
| `assets/places.json` | About 1,600 city labels, tiered so the map shows a few at world scale and more as you zoom in | **GeoNames — CC BY 4.0.** Attribution is a *condition*, not a courtesy: the credit line under the map and the *About this data* panel both name GeoNames and the licence. Do not remove them. Editing the list is fine — add your own places, delete the ones you never look at; it stays the same data under the same licence. |

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
| 1.0° | 65,160 | 6.74 MB | 11.12 MB | 2.84 MB | 4.62 MB | 1.62 MB | 2.61 MB |
| 1.5° | 29,040 | 3.11 MB | 5.12 MB | 1.31 MB | 2.12 MB | 0.75 MB | 1.20 MB |
| **2.0°** | **16,380** | 1.78 MB | 2.93 MB | 0.75 MB | **1.22 MB** | 0.43 MB | 0.69 MB |

**The demo committed here is the bold cell: 2°, 3-hourly, five days, about
1.2 MB.** That is a deliberate choice for a *template*, where every copy of the
repository carries the file and every phone downloads it twice a day. It is
coarse — a grid point every 200 km or so — and the map still reads as a
convincing wind field, because the app interpolates between points and the
colour layer is smooth. What you lose is the detail of a single fjord or valley.

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

Most apps here commit their snapshot to `main`. Global Wind does not, and the
reason is arithmetic: the file is megabytes, and every byte of it is
different every run — it is base64 of compressed data, so git can neither delta
it nor compress it. Twice a day at 1.2 MB is most of a gigabyte a year, in a
repository people clone.

So `.github/workflows/refresh-global-wind.yml` force-pushes a single parentless
commit to an orphan branch, **`data-global-wind`**. The branch is a mailbox, not
a log: it only ever holds the newest snapshot, and nothing accumulates. `main`
keeps the committed demo, which is what `zips/global-wind.zip` ships with. Any
other app of yours that outgrows `main` wants its own branch on the same
pattern; two such jobs never touch.

The only thing that changes for you is the branch name in the address your
Shortcut fetches — the path is the same. `PROMPT.md` has both forms.

If you would rather have everything on `main` like the other apps, turn the
dials down first: `2°, 6-hourly, three days` is 0.43 MB, which is 300 MB a year
at twice a day. It is still not nothing.

---

## What the numbers are, and what they are not

- **A forecast, not a measurement.** Everything on the map except the first step
  is a model's guess, and the further right the slider goes the more of a guess
  it is. The header says which model run it came from and how old that run is.
- **Wind 10 metres above the ground**, which is the standard height weather
  services report. It is not the wind at the top of a hill, at sea level in a
  harbour, or at the height of a sail.
- **Sustained wind, not gusts.** A gust is commonly half again as strong as the
  number shown here, sometimes more. Do not plan a crossing on this app.
- **A 2° grid point is an average over a couple of hundred kilometres.** Coasts,
  mountains and cities are all invisible at that scale. Turning `DEGREES` down
  helps; nothing gets you a street.
- **Rounded to a byte.** Speed is stored in steps of 0.25 m/s and direction in
  steps of about 1.4°, which is finer than the forecast's own uncertainty by a
  wide margin, but it does mean the numbers are not the model's to the last
  decimal.
- **The colours are a scale, not a category.** The legend runs cool to warm to
  violet with no hue cycling, so stronger always reads as further along it, and
  speed is drawn as arrow length and thickness too — nothing on the map is
  encoded by colour alone.

## What the `ask` table holds

The snapshot carries a top-level `ask` array, which is the only part of the file
Snuggery's *Ask About This Data* reads: one flat row per city per forecast day,
with the wind at **12:00 local time** in twelve well-known cities spread across
six continents. Sixty rows at most, plain keys, numbers and short strings.

It exists because a question in words — *where is it windiest on Thursday?* —
cannot be answered from three megabytes of base64. The app itself never reads
it; the map is drawn from the grid. Change the list at the top of
`scripts/global_wind.py` to the places you actually care about.

## Being a good guest

The bucket is a public, requester-pays-free AWS Open Data endpoint, and this job
is small by its standards: 41 index requests and 82 range requests per run,
six at a time, twice a day. It sends a User-Agent naming your repository. There
is no point running it more often than the model publishes — GFS runs four times
a day and takes about four hours to finish writing each run, which is why the
schedule sits at 04:23 and 10:23 UTC, twenty-odd minutes after the 00Z and 06Z
runs finish landing.

## Nothing here is anybody's

The committed `data/snapshot.json` is a real public pull of a real forecast. It
says nothing about any person: it is the weather over the whole planet, and the
twelve cities in the `ask` table are London, Tokyo, Sydney and nine others like
them. There is no account, no token, no address, no name and no location of
anybody's anywhere in this app or in the job that fills it.

## No network from the app

The app fetches `./data/snapshot.json`, `./assets/world.json` and
`./assets/places.json`, and nothing else. There is no external URL, font,
script, image or map tile anywhere in `index.html`, `app.js` or `style.css` —
mini-apps in Snuggery cannot reach the network, and this one does not try. The
coastlines, the city labels and the wind all travel inside the folder. The
refresh happens outside, in the GitHub Action, and a Shortcut carries the file
in.
