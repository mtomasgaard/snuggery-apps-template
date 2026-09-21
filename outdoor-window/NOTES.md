# Outdoor Window — where the data comes from, and on what terms

The MIT licence at the root of this repository covers the app's own code. The **weather data**
that travels inside `zips/outdoor-window.zip` is not ours, and this file states whose it is and
what its terms say.

## The data: Open-Meteo (CC BY 4.0, free tier non-commercial)

`data/snapshot.json` is a forecast from **Open-Meteo** — `api.open-meteo.com/v1/forecast`. No
account, no key, no sign-up.

**The terms, read from the source on 2026-09-21** (`open-meteo.com/en/licence` and
`open-meteo.com/en/terms`):

- **Licence.** *"API data are offered under Attribution 4.0 International (CC BY 4.0)."* Free to
  share and adapt, with credit.
- **The attribution they ask for, in their own words.** *"You must include a link next to any
  location Open-Meteo data are displayed, for example: `Weather data by Open-Meteo.com`."* CC BY's
  own clause, quoted on the same page, asks for three things: *"You must give appropriate credit,
  provide a link to the licence, and indicate if changes were made."*
- **Changes were made, and the footer says so.** The committed demo is not Open-Meteo's reply as
  it arrived: `scripts/outdoor_window.py --demo` adds `schema`, `generatedAt`, `demoPlace` and a
  48-row `ask` table of scores this app worked out. The forecast numbers themselves are untouched,
  which is what the footer's last clause states — *the forecast is Open-Meteo's, unmodified; the
  scores and the ask table beside it are this app's*.
- **The free tier is non-commercial.** *"You may only use the free API services for
  non-commercial purposes"*, with *"less than 10'000 API calls per day, 5'000 per hour and 600
  per minute."* The tier table on the same page also caps the free tier at **300'000 calls per
  month**. A shortcut fetching twice a day is five calls short of nothing; a product that
  charges money is a different conversation, and there is a paid customer API for it.
- **No warranty and no uptime guarantee.** Open-Meteo disclaims liability for the data's
  accuracy and availability. This is a forecast about the weather, being used to decide when to
  go for a walk; that is the right amount of reliance to place on it.
- **Upstream sources.** Open-Meteo aggregates national weather services — DWD, ECMWF, NOAA NCEP,
  Météo-France, JMA, MET Norway, the UK Met Office and others — each under its own open licence
  (mostly CC BY, the UK Met Office's CC BY-SA). Crediting Open-Meteo is the credit their licence
  asks of us; the full list is on their licence page.

**How the credit is printed.** The licence asks for the credit as a *link*, with a link to the
licence beside it, so the footer carries two real anchors — `open-meteo.com` and the CC BY 4.0
deed — on every screen, in `index.html` as static markup rather than in JavaScript, so that a
broken data file cannot take the attribution down with it. Those two addresses are the only
external URLs anywhere in the app, and nothing is ever *fetched* from them: the convention this
repository follows forbids external **resources** (fonts, scripts, images, tiles), not links out.
A tap on one is a link activation, which Snuggery does not follow in place — it names the
address and offers to hand it to Safari. `world-news` does the same with its headlines.

## What is in the app, and what is not

- **No fonts, no images, no icons, no map tiles, no third-party code.** The type is the system's,
  the strip is `<div>`s with a height, and everything else is CSS. There is nothing here under
  anybody else's licence except the data above.
- **No network.** The app fetches `./data/snapshot.json` and `./data/rules.json` and nothing
  else, ever. The only `http` addresses in `index.html`, `app.js` or `style.css` are the two
  attribution anchors in the footer, and an anchor is not a fetch: nothing is loaded from them
  unless the reader taps one and Snuggery hands it to Safari.
- **No `innerHTML` with data.** Every value from either file goes in through `textContent`. The
  only `innerHTML` in the app is `main.innerHTML = ''`, which clears.

## The demo data

`data/snapshot.json` is a **real** 48-hour forecast for **Boston Common** (42.355, −71.066) — a
public park in the middle of a city, chosen because it is nobody's home and nobody's commute.
Nothing in it belongs to anyone. Regenerate it with:

```
python3 scripts/outdoor_window.py --demo
```

It cannot have a byte-for-byte `--check` like the running dashboard's seeded demo, because it is
a live pull: two runs five minutes apart give two different, equally correct files. What is
checkable is the contract, and `--check` checks that — required hourly variables present, arrays
the same length, a derivable timestamp, and an `ask` table that is exactly what the scorer makes
from the committed snapshot and the committed rules.

## Units, and a trap in the rule names

The address the app is built around asks for **Celsius** and **km/h**, so `temperatureC`,
`dewPointC` and `maxGustKmh` in `data/rules.json` mean what they say. Change `wind_speed_unit` or
add `temperature_unit=fahrenheit` to the address and the *keys keep their names while the numbers
change meaning* — the app reads the unit strings out of `hourly_units` and labels the screen
correctly, but it cannot know that `maxGustKmh: 35` was meant to stay 35 km/h. If you switch
units, convert the numbers in `rules.json` in the same edit.

## The `ask` table, and the one thing the Shortcut cannot do neatly

Snuggery's *Ask About This Data* reads a top-level `ask` array and nothing else. The committed
demo carries 48 flat rows (one per hour: date, weekday, time, pass, score, tempC,
rainChancePct, rainMm, gustKmh, dewPointC, cloudPct, daylight, blockedBy). A file delivered by
the phone's shortcut does not, because the reply is the weather service's and Shortcuts cannot
build 48 rows without a loop. The app itself never reads `ask` — it scores the hours from the raw
arrays — so this costs the app nothing and costs Ask everything. `PROMPT.md` says so plainly.

If someone does want the rows on the phone, the outline is: after *Get Contents of URL*, a
**Repeat with Each** over `hourly.time`, and inside it a **Get Item from List** at *Repeat Index*
for each of the six variables, a **Dictionary** built from them, added to a list; then one **Set
Dictionary Value** putting that list at key `ask`. About a dozen actions. It produces *facts* —
time, temperature, rain, gust, dew point, daylight — not scores: reproducing the comfort
arithmetic in Shortcuts is not worth anybody's evening, and the app already shows it.

## Extension point, documented rather than built: air quality

Open-Meteo has a second endpoint, `air-quality-api.open-meteo.com/v1/air-quality`, with the same
shape of reply — `hourly` arrays with `pm2_5`, `pm10`, `european_aqi`, `us_aqi`, and grass, birch
and ragweed pollen. It is an obvious second rule group: *"and the air is clean enough"*, or, for
somebody with hay fever, *"and the birch count is low"*.

It is left out on purpose, so that the app stays **one fetch and one file**. Adding it would take
three things, in this order:

1. A second fetch in the shortcut, and a decision about where its reply goes — a second file
   (`data/air.json`, a second *Update a File in a Snuggery App* step) is cleaner than merging two
   dictionaries in Shortcuts, which cannot be done without more actions than it is worth.
2. A rule group in `data/rules.json` — something like
   `"air": { "maxPm25": 15, "maxEuropeanAqi": 40, "maxBirchPollen": 10 }` — with the same
   "leave a key out and it is not applied" rule as everything else.
3. Three more checks in the scorer, in **both** `app.js` and `scripts/outdoor_window.py`, and the
   hourly times of the two files aligned by timestamp rather than by index, because the two
   endpoints do not have to start at the same hour.

The same pattern fits marine forecasts (`marine-api.open-meteo.com`, wave height and period) for
anyone scoring a swim or a paddle.

## What leaves the phone

One HTTPS request per refresh, from the phone to Open-Meteo, carrying a latitude and a longitude
rounded to whatever precision the shortcut passes. Nothing goes to this repository — there is no
workflow for this app — and nothing goes to Snuggery, which never makes a network request of any
kind. If the coordinates themselves matter to you, note that Open-Meteo snaps them to its model
grid anyway (the reply's `latitude` and `longitude` are the grid point, not what you asked for),
and that passing a deliberately rounded pair — two decimal places is about a kilometre — costs
the forecast nothing.
