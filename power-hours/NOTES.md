# Where the prices come from, and what you may do with them

Power Hours draws one thing: the **day-ahead spot price** of electricity in one
bidding zone, from **Energy-Charts**, run by the Fraunhofer Institute for Solar
Energy Systems (ISE). No key, no account, no registration.

    GET https://api.energy-charts.info/price?bzn=NO2&start=2026-09-21&end=2026-09-21

`scripts/power_hours.py` calls it at most twice a run — today, then tomorrow —
and writes `data/snapshot.json`. The app reads that file and nothing else.

---

## The licence differs per bidding zone, and that is the thing to get right

The API offers 57 bidding zones. **Sixteen of them are CC BY 4.0 and may be
republished. The other forty-one are private and internal use only.** A public
repository is republication, so changing the zone in the script is also a
licence decision. This is the API's own wording, from the `/price` endpoint's
documentation at <https://api.energy-charts.info/>:

> **The data for the following bidding zones is licensed as CC BY 4.0 from
> Bundesnetzagentur | SMARD.de and is published without changes:**
> AT (Austria), BE (Belgium), CH (Switzerland), CZ (Czech Republic),
> DE-LU (Germany, Luxembourg), DE-AT-LU (Germany, Austria, Luxembourg),
> DK1 (Denmark 1), DK2 (Denmark 2), FR (France), HU (Hungary),
> IT-North (Italy North), NL (Netherlands), **NO2 (Norway 2)**, PL (Poland),
> SE4 (Sweden 4), SI (Slovenia)

and, for every other zone:

> **The data for the other bidding zones is for private and internal use only.
> The utilization of any data whether in its raw or derived form, for external
> or commercial purposes is expressly prohibited. Should you require licensing
> for market-related data, please direct your inquiries to the original data
> providers, including but not limited to EPEX SPOT SE.**

The API's general terms, on the same page, add the attribution condition:

> Unless stated otherwise, the data provided by the Energy-Charts API is
> licensed under the CC BY 4.0 license. Proper attribution to Energy-Charts.info
> as the source is required.

Every answer also carries the licence for the zone it just returned, in a
`license_info` field. For NO2 today that reads:

> CC BY 4.0 (creativecommons.org/licenses/by/4.0) from Bundesnetzagentur |
> SMARD.de

**This demo uses NO2 — southern Norway — which is on the CC BY list.** The app
prints the attribution in its footer on every screen, which is what CC BY 4.0
asks for. Keep that line.

The footer prints that `license_info` **verbatim**, licence address and all,
rather than a sentence typed into the app: the script stores the field as
`source.licenceInfo` in the snapshot and the app prefers it over its own
constant. The list in the script is a copy of a decision that belongs to
Energy-Charts, so the script also compares the two on every run — if a zone on
`CC_BY_ZONES` comes back saying anything other than CC BY, the run prints the
mismatch, writes nothing and exits non-zero, which fails the workflow instead
of quietly republishing under a licence that has changed.

### If you change the zone

`scripts/power_hours.py` holds the list as `CC_BY_ZONES` and **refuses to run
for any zone outside it** unless you pass `--private-use`. That flag also sets
`source.publishable: false` in the snapshot, and the app then prints a line
saying the prices must not be republished. Use it only in a **private**
repository, and remember that a repository is as private as its most sensitive
file — git history cannot be un-published.

The zones the API offers, at the time of writing, are: AT, BE, BG, CH, CZ,
DE-LU, DE-AT-LU, DK1, DK2, EE, ES, FI, FR, GR, HR, HU, IE(SEM), IT-Brindisi,
IT-Calabria, IT-Centre-North, IT-Centre-South, IT-Foggia, IT-GR, IT-North,
IT-North-AT, IT-North-CH, IT-North-FR, IT-North-SI, IT-Priolo, IT-Rossano,
IT-SACOAC, IT-SACODC, IT-Sardinia, IT-Sicily, IT-South, LT, LV, ME, NL, NO1,
NO2, NO2NSL, NO3, NO4, NO5, PL, PT, RO, RS, SE1, SE2, SE3, SE4, SI, SK, UA-BEI,
UA-IPS. Only the sixteen quoted above are CC BY.

---

## Be a good guest: the rate limit

From the API's own documentation:

> Requests are limited per client IP **and** per endpoint (token bucket, so
> short bursts are allowed). The default is 2 requests per minute with a burst
> of 4; `/signal` allows 20 per minute (burst 40), `/price` 2 per minute
> (burst 2) … Exceeding a limit returns **HTTP 429** with a `Retry-After`
> header giving the number of seconds to wait. Clients should honour that
> header instead of assuming fixed limits, and cache responses on their side.

`scripts/power_hours.py` makes two requests per run, waits a second between
them, and honours `Retry-After` on a 429. Twice a day is well inside the limit.
Do not put this script in a loop, and do not lower the workflow's cron to
hourly: the auction that sets these prices runs once a day, so there would be
nothing new to fetch.

---

## What the numbers are, and what they are not

- **Day-ahead spot price only.** Tomorrow's curve is fixed in a single auction
  each afternoon, for every settlement interval of the following day. It is
  not a forecast.
- **Not your bill.** Grid rent, energy tax and VAT are on top, and in most
  countries they are the larger half of what you pay. A tariff may also average
  the spot price over a month rather than follow it hourly — if yours does,
  this app tells you about the market, not about your money.
- **The source's unit is EUR/MWh**, and the snapshot keeps it that way. The app
  divides by ten to show euro-cents per kWh, because that is the unit a
  household tariff is quoted in. The conversion is stated on screen.
- **Fifteen minutes, not an hour.** The European day-ahead market settles in
  15-minute intervals, so a day is 96 prices. The chart draws hourly means
  because 96 bars on a phone is a texture rather than a chart; the cheapest
  window is searched at the market's own resolution, so it can start at a
  quarter past. An hourly zone gives 24 prices and everything still works —
  `resolutionMinutes` in the snapshot says which you have.
- **Negative prices are normal** and the app draws them below a zero line.
  Plenty of wind and little demand is all it takes.

## Nothing here is anybody's

The committed `data/snapshot.json` is a real public pull of NO2 prices. It says
nothing about any household: a bidding zone covers a few million people, and
the file holds no meter, no address, no consumption and no account. The
appliance list in `data/appliances.json` is four ordinary appliances with
ordinary run lengths, and it is yours to change.

## No network from the app

The app fetches `./data/snapshot.json` and `./data/appliances.json` and nothing
else. There is no external URL, font, script, image or tile anywhere in
`index.html`, `app.js` or `style.css` — mini-apps in Snuggery cannot reach the
network, and this one does not try. The refresh happens outside, in the GitHub
Action, and a Shortcut carries the file in.
