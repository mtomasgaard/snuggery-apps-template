# Setting up Outdoor Window

Paste this whole file into a coding-agent session that has this repository open — **your own
copy**, made with *Use this template*, never the template itself. The agent does the typing; the
person sitting at the keyboard does the parts only they can do (building the shortcut, granting
the location permission). Read it together before starting.

## What this app is

Outdoor Window scores the next 48 hours against rules **you** write, and tells you when to go
out. Not "will it rain" — your phone already knows that. *When is there a two-hour stretch, in
daylight, under 35 km/h of gusts, with the dew point low enough that it will not feel like soup.*
The rules are a file you edit; the app is the part that does the arithmetic.

Three panes: **Windows** (the next good stretch, then the ones after it, then which rule is
costing you the most hours), **Hours** (all 48, each one either highlighted or labelled with the
rules it failed), **Rules** (what is currently being applied, and how to change it).

## What is different about this one

Every other app here is refreshed by a GitHub Action: a job rewrites a file in the repository, a
shortcut copies it to the phone. **This one has no job and no repository in the loop at all.** The
shortcut asks the phone where it is, asks the weather service for the forecast there, and hands
the reply straight to Snuggery. Which means:

- **No token, no secret, no workflow file, no Actions minutes.** Nothing to expire.
- **Your location never reaches this repository**, or any server of ours — there is no server of
  ours. It goes to the weather service, in one request, and nowhere else.
- It follows you. Away for a weekend, the app is about where you are.

The committed `data/snapshot.json` is a real 48-hour forecast for **Boston Common** — a public
park, deliberately nobody's home — so a freshly installed copy shows something real before you
have built anything. Your first refresh replaces it.

## Step 1 — decide what a good hour is

Open `outdoor-window/data/rules.json`. This is the whole configuration of the app:

| Key | What it means | Leave it out and… |
| --- | --- | --- |
| `activity` | the label shown in the header — "A walk outside", "Photographs", "Painting the fence" | it says *Outdoors* |
| `maxRainChancePct` | the forecast chance of any rain in the hour | rain chance is not checked |
| `maxPrecipMm` | how much is expected to fall in the hour | rainfall is not checked |
| `maxGustKmh` | gusts, not average wind — gusts are what you feel | gusts are not checked |
| `temperatureC` | `{ "min": 2, "max": 26 }` | temperature is not checked |
| `dewPointC` | `{ "min": -10, "max": 17 }` — above about 16 it feels muggy, below about −5 it feels sharp | dew point is not checked |
| `daylight` | `"any"`, `"daylight"`, or `"golden"` | any hour qualifies |
| `goldenHourMinutes` | how wide the golden band is at each end of the day | the golden-hour rule has no width |
| `minWindowHours` | a run of good hours shorter than this is not offered as a window | every single good hour is a window |

An hour passes only if it clears **every** rule you left in. Its score is how comfortably it
cleared them — 100 is the most comfortable value every rule allows, 0 is scraping every limit —
so a low-scoring pass reads as marginal rather than as a promise.

Two things worth knowing before you tune it:

- **Start loose.** Rules that are too tight give an app that says "no window in the next 48
  hours" for a week, which teaches you nothing. The *What ruled hours out* card on the Windows
  pane tells you which rule to relax first.
- **The numbers are in whatever units the forecast carries.** The address in Step 2 asks for
  Celsius and km/h, so `maxGustKmh` really is km/h. Change the units in the address and the key
  names will lie to you; change the numbers to match.

You can edit this file here in the repository, but the point of it is that you can also edit it
**on the phone**, with no computer and no agent: in Snuggery, the app's ⋯ menu → *App Files* →
`data/rules.json`. The app re-reads it every time you come back to it.

## Step 2 — the address

One address, with your latitude and longitude in it:

```
https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&hourly=temperature_2m,precipitation_probability,precipitation,wind_gusts_10m,dew_point_2m,cloud_cover,is_day&daily=sunrise,sunset&current=temperature_2m,is_day&timezone=auto&forecast_hours=48&forecast_days=3&wind_speed_unit=kmh
```

`python3 scripts/outdoor_window.py --url` prints exactly that, so it can be copied rather than
retyped. Every part of it is load-bearing:

- `hourly=` — the six variables the app scores, plus `cloud_cover`, which it only displays.
  Leave one out and the app says on screen which one is missing and that it belongs in this list.
- `daily=sunrise,sunset` — only the golden-hour rule needs them, but they cost nothing.
- `current=` — this is what puts a **moment** in the file. The reply has no "generated at" field
  of its own; `current.time` is the service's own now, rounded to the quarter hour, and it is
  what the app's *About HH:MM* stamp is derived from. Drop it and the header falls back to the
  first hour of the forecast, which only tells you the file is *at least* that old.
- `timezone=auto` — hourly times come back as local wall clock for the forecast's own place,
  with `utc_offset_seconds` beside them so the app can put them on a clock. Without it, nothing
  can be placed.
- `forecast_hours=48` — start at the current hour, not at local midnight, so the app never has
  to throw away a morning that already happened. `forecast_days=3` is only there so sunrise and
  sunset cover every date those 48 hours touch.

There is **no key and no account**. It is free for non-commercial use; a personal shortcut is
several orders of magnitude below the free tier's limit.

## Step 3 — the shortcut

Two shapes. Build whichever suits you; they are not exclusive.

### A — it follows you (five actions, no token)

In Shortcuts, new shortcut, named something you will recognise — *Outdoor Window* will do:

1. **Get Current Location**
2. **Get Details of Location** — Detail **Latitude**, of *Current Location*
3. **Get Details of Location** — Detail **Longitude**, of *Current Location*
   **The trap:** this second one defaults its input to the previous action's output, which is a
   number, not a location. Tap the input and choose *Current Location* again.
4. **Get Contents of URL** — paste the address from Step 2 and replace `LAT` with the Latitude
   variable and `LON` with the Longitude variable. Method **GET**, no headers.
5. **Update a File in a Snuggery App**
   - **App** → *Outdoor Window* (the picker), or leave it empty and put `Outdoor Window` in
     **App name**
   - **Path in the app** → `data/snapshot.json`
   - **Text instead of a file** → *Contents of URL* from step 4

Two field traps, both of which everyone hits once:

- The reply goes in **Text instead of a file**, never **File**. An address returning JSON hands
  Shortcuts a *dictionary*, and the File field refuses it.
- **Path in the app** is written out rather than left empty. Left empty, Snuggery picks the app's
  data file by convention and does land on `data/snapshot.json` — but this app has *two* files
  under `data/`, and relying on a tie-break you cannot see is a bad habit to build in the one
  app where it happens to work.

The first run asks for location permission, once. Grant *While Using* (or *Always*, if you want
it to run from an automation while the phone is in a pocket).

### B — a place that does not move

If you only care about one spot — home, the allotment, the trailhead — you do not need a new
shortcut at all. Put your coordinates into the address from Step 2 and add **one row** to the
Dictionary in the loop shortcut you already have: key `Outdoor Window`, value that address. The
loop fetches it and writes it like any other app.

**One warning, and it matters.** If your repository is private, your loop's *Get Contents of URL*
carries an `Authorization: Bearer <token>` header — and a header set on that action is sent to
**every** address in the Dictionary. Adding a weather address to that loop hands your GitHub
token to a weather service. If your loop has that header, keep Outdoor Window out of it and use
shape A, or split the loop in two: one *Repeat* for repository addresses with the header, one for
open addresses without it.

### Running it on a schedule

Shape A is a plain shortcut, so every way of running a shortcut works: a Home Screen icon, *Hey
Siri*, the Action Button, or Shortcuts → Automation → Time of Day → *Run Immediately*. A forecast
is worth refreshing once or twice a day; it does not change by the minute, and neither should the
app you look at.

Snuggery's ⋯ → *Keep This Up To Date* also has a *Run now* row that opens **one** rebuild shortcut
by name, shared across all your apps, passing the app's name as its input. That shortcut's recipe
starts by POSTing to a workflow, which this app does not have — so unless you are willing to put
an *If* around that step, leave Outdoor Window out of it and run its own shortcut directly. The
app is written for it either way: when new data lands while the app is open, it redraws in place,
keeping the pane you were on.

## Step 4 — check it landed

Open the app. Three things say it worked:

- the header stamp is the current time, not the demo's,
- the place line under the title shows your own coordinates and time zone rather than *Boston
  Common*,
- the hours start at the current hour.

If instead you get a red card, read it — it names the specific thing that is wrong: a missing
hourly variable (and which), a reply that is not a forecast, a refusal from the service with its
own reason quoted, or a file that is not JSON at all. The last one is the common one: a fetch that
failed upstream still returns text, and the shortcut writes it over good data without complaint.

## What Snuggery's Ask can and cannot see here

Snuggery's *Ask About This Data* reads **one key** of `data/snapshot.json`: a top-level `ask`
array of flat rows. It ignores the rest of the file.

- **The shipped demo has one** — 48 rows, one per hour, written by
  `scripts/outdoor_window.py --demo`: date, weekday, time, pass, score, temperature, rain
  chance, rainfall, gust, dew point, cloud, daylight, and which rules blocked it. Ask answers
  well from that.
- **A file your shortcut delivers does not.** The reply is the weather service's, and Shortcuts
  cannot build 48 scored rows out of it without a *Repeat with Each* — so after your first
  refresh, Ask has only the raw file to read: six parallel arrays of bare numbers with the times
  in a seventh. It will not answer well from that, and it is better to know than to discover.

**This costs the app nothing.** Outdoor Window never reads `ask`; it scores the hours itself,
which is why it works perfectly on a raw reply. The gap is only in Ask. Three honest choices:

1. **Leave it.** The app's own panes answer the questions the `ask` rows would.
2. **Add the timestamp only** — three actions, no loop, worth doing regardless: **Current Date** →
   **Format Date** (ISO 8601, with time) → **Set Dictionary Value**, key `generatedAt`, in
   *Contents of URL*, before the Update step. The header then reads *Updated HH:MM* rather than
   *About HH:MM*, from your clock rather than the service's.
3. **Build the rows in Shortcuts** — a *Repeat with Each* over `hourly.time` with a *Get Item
   from List* per variable, assembling one dictionary per hour. It is about a dozen actions, it
   cannot reproduce the scoring, and `outdoor-window/NOTES.md` sketches it. Worth it only if you
   ask questions of this app in words often.

## The licence line to keep

The app's footer prints this, word for word:

> Weather data by Open-Meteo.com, under CC BY 4.0. The free API is for non-commercial use. The
> forecast is Open-Meteo's, unmodified; the scores and the ask table beside it are this app's.

*If this ever disagrees with `index.html`, `index.html` is right* — do not normalise the footer
to match a quote in a document.

Two of those words are **links** in the markup: *Open-Meteo.com* points at `open-meteo.com`, and
*CC BY 4.0* at the licence deed. They are the only external addresses in the whole app, and
nothing is loaded from them; a tap is a link activation, which Snuggery names and offers to hand
to Safari. The licence asks for the credit as a link and for a link to the licence, so both
anchors are conditions, not decoration — keep them anchors.

The whole attribution is a condition of using the data, so it stays in `index.html` whatever else
you change, in the markup rather than in JavaScript so a broken data file cannot take it down.
`outdoor-window/NOTES.md` states the terms and where they are published. If you ever make
something commercial out of this, read them first — the free tier is for non-commercial use, and
there is a paid tier for the other kind.

## Do not touch

- `outdoor-window/app.js`, `style.css`, `index.html` — the app. Change `data/rules.json`, not the
  code. The shape of both data files is documented in the header comment at the top of `app.js`;
  read that before changing anything here.
- The attribution line in the footer.
- The scoring arithmetic in **one** place only: `app.js` and `scripts/outdoor_window.py` mirror
  each other deliberately, because the app must score a raw reply and the script must write the
  demo's `ask` rows. Change one, change the other — and know what the check can and cannot see.
  `python3 scripts/outdoor_window.py --check` recomputes the `ask` table from the committed
  snapshot and the committed rules and fails if the committed table no longer matches, so it
  catches a change to the Python scorer, to `rules.json`, or to the snapshot. **It never opens
  `app.js`**: an edit to the app's half of the arithmetic leaves `--check` green, and that half
  has to be checked by eye. If you want a real guard, the mode to add is a fourth one that loads
  `app.js`'s `scoreHours` in `node` and compares the two row sets.

## If something fails

Stop and report the exact error text rather than working around it. Three checks that usually
find it:

```
python3 scripts/outdoor_window.py --url      # the address, to compare with the shortcut's
python3 scripts/outdoor_window.py --demo     # a fresh real pull, to prove the service answers
python3 scripts/outdoor_window.py --check    # the committed files still hold to the contract
```

`--demo` overwrites the committed demo snapshot with a current forecast for Boston Common; that
is exactly what it is for, and `--check` will tell you if the result is not what the app expects.
