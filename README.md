# Snuggery mini-apps

**Just want an app on your iPhone? There is nothing to copy or set up.** In Safari on the iPhone,
tap [**Install Milky Way**](https://mtomasgaard.github.io/snuggery-apps-template/zips/milky-way.zip) (6.5 MB) — or any app in
[the install table](#install-any-of-them-on-your-phone--three-taps) — tap **Download** if Safari
asks, then open the download and choose **Share → Snuggery**.

**This is a template. Nothing of yours goes here** — tap *Use this template* on GitHub to make
your own copy, and work in that. What follows describes the copy you will have.

One repository of mini-apps: the ones whose data refreshes on a schedule, with the
jobs that refresh them, and the ones that carry everything they need in the ZIP.

For the ones that refresh, the loop once it is running: a GitHub Action rewrites
a small JSON file here → the file reaches your phone → you open the app and see
today's numbers. It reaches the phone one of two ways, and which is your choice:
**Snuggery fetches it** from an address you gave it, or **a Shortcut delivers it**.
[Getting the data to the phone](#getting-the-data-to-the-phone-two-ways) has the
trade-offs. Either way, the apps themselves never go online.

**Click *Use this template* to make your own copy, and make it private** if any
app here will ever hold something personal. A repository is as private as its
most sensitive file, git history cannot be un-published, and it is easier to
start private than to remember to switch before the wrong commit.

---

## What is in here

Nineteen complete apps. All are examples — none holds anybody's real data. Copy
one, delete them all, or ignore them.

**Seven of them cost you nothing to run.** Hello Live, World News, Power Hours,
Global Wind, Global Weather, US Quakes and Warming World are refreshed by this repository's own workflows,
from sources that need no key and no account, so they work from the moment you install them
and keep working whether or not you ever copy this template. **Outdoor Window**
is free in the same way but cannot run on its own: the forecast is for wherever
*you* are, so your own Shortcut asks the phone and fetches it. **Running
Dashboard** and **Finances** are the two that need credentials — a Garmin
sign-in and a bank connection — and until you add them, both show made-up
data. Finances says so on screen; Running Dashboard is built to look like a
real copy, so its entry below and its own docs say so instead. **Anatomy** (25 MB), **Norne Reservoir** (15 MB), **Volve** (33 MB),
**Besseggen** (17 MB) and **Milky Way** (6.5 MB) are the big ones: a human body, two oil fields (one with its
seismic), a mountain ridge and our galaxy, each in 3D. They need
nothing at all, and they live here rather than in Snuggery's built-in starter
pack precisely because of that size — install any of them the same way as every app on this page:
three taps, just below.

## Install any of them on your phone — three taps

Open an app's **Install** link in Safari on the iPhone, then do the three steps under the table.

**Or get them all at once:** [**Get them all**](https://mtomasgaard.github.io/snuggery-apps-template/zips/more-examples.zip)
(about 120 MB) is every app below that Snuggery does not install itself, in one file that opens as
one folder, *More examples*. It needs Snuggery 1.2 or later; 1.1 opens it as a folder of ZIPs. The
seven live examples come with the app: Create → *Install the live examples*.

| App | Link | Size | Needs |
| --- | --- | --- | --- |
| Milky Way | [**Install Milky Way**](https://mtomasgaard.github.io/snuggery-apps-template/zips/milky-way.zip) | 6.5 MB | nothing |
| Hello Live | [**Install Hello Live**](https://mtomasgaard.github.io/snuggery-apps-template/zips/hello-live.zip) | tiny | nothing |
| Running Dashboard | [**Install Running Dashboard**](https://mtomasgaard.github.io/snuggery-apps-template/zips/running-dashboard.zip) | 1.1 MB | a Garmin sign-in |
| Finances | [**Install Finances**](https://mtomasgaard.github.io/snuggery-apps-template/zips/finances.zip) | 0.1 MB | a bank connection |
| World News | [**Install World News**](https://mtomasgaard.github.io/snuggery-apps-template/zips/world-news.zip) | tiny | nothing |
| Outdoor Window | [**Install Outdoor Window**](https://mtomasgaard.github.io/snuggery-apps-template/zips/outdoor-window.zip) | tiny | your own Shortcut |
| Power Hours | [**Install Power Hours**](https://mtomasgaard.github.io/snuggery-apps-template/zips/power-hours.zip) | tiny | nothing |
| Global Wind | [**Install Global Wind**](https://mtomasgaard.github.io/snuggery-apps-template/zips/global-wind.zip) | 1.5 MB | nothing |
| Global Weather | [**Install Global Weather**](https://mtomasgaard.github.io/snuggery-apps-template/zips/global-weather.zip) | 2.8 MB | nothing |
| Anatomy | [**Install Anatomy**](https://mtomasgaard.github.io/snuggery-apps-template/zips/anatomy.zip) | 25 MB | nothing |
| Besseggen | [**Install Besseggen**](https://mtomasgaard.github.io/snuggery-apps-template/zips/besseggen.zip) | 17 MB | nothing |
| Norne Reservoir | [**Install Norne Reservoir**](https://mtomasgaard.github.io/snuggery-apps-template/zips/norne-reservoir.zip) | 15 MB | nothing |
| Shelf Atlas | [**Install Shelf Atlas**](https://mtomasgaard.github.io/snuggery-apps-template/zips/shelf-atlas.zip) | ~2 MB | nothing |
| World Oil & Gas | [**Install World Oil & Gas**](https://mtomasgaard.github.io/snuggery-apps-template/zips/world-oil-gas.zip) | 2.5 MB | nothing (GOGET by hand) |
| Snug Kart | [**Install Snug Kart**](https://mtomasgaard.github.io/snuggery-apps-template/zips/snug-kart.zip) | 0.6 MB | nothing |
| Earth's History | [**Install Earth's History**](https://mtomasgaard.github.io/snuggery-apps-template/zips/earth-history.zip) | 7 MB | nothing |
| US Quakes | [**Install US Quakes**](https://mtomasgaard.github.io/snuggery-apps-template/zips/us-quakes.zip) | 6.8 MB | nothing (the feed refreshes here hourly) |
| Volve | [**Install Volve**](https://mtomasgaard.github.io/snuggery-apps-template/zips/volve.zip) | 33 MB | nothing |
| Warming World | [**Install Warming World**](https://mtomasgaard.github.io/snuggery-apps-template/zips/warming-world.zip) | 1.3 MB | nothing (NASA's monthly release refreshes here) |

1. **On the iPhone, in Safari**, tap an app's **Install …** link in the table above (or its
   **Get the ZIP** link further down). If Safari asks whether to download it, tap **Download**.
2. Tap the download arrow in Safari's address bar and tap the ZIP, then the **Share** button — or
   open **Files → Downloads**, touch and hold the ZIP, and tap **Share**.
3. Choose **Snuggery**. It appears in your Library and opens with one tap. Nothing else to set up.

Don't have Snuggery yet? [**Get it on the App Store**](https://apps.apple.com/app/id6805883209) — for
iPhone (iOS 18 and later), one purchase after a free week.

**Just want the galaxy?** On your iPhone, open [**Install Milky Way**](https://mtomasgaard.github.io/snuggery-apps-template/zips/milky-way.zip) in Safari
(a 6.5 MB download), then steps 2 and 3. That's it — it needs no account, no key and no network
once installed.

Every **Install** and **Get the ZIP** link here is the copy on this repository's web pages, packed
again after every refresh with the newest data published for the app, so a live app installs with its
latest numbers rather than those of its last code change. The repository's own `zips/` folder holds the
code build, rebuilt only when an app's code changes.

The same works from a Mac or PC: download the ZIP, AirDrop it to the phone, share it to Snuggery.
Inside Snuggery, *Keep This Up To Date* → **Every example, ready to download** brings you
back to this page.

### Hello Live

A UTC clock and three numbers rewritten about hourly by a GitHub Action. Depends on no outside service, so it proves your loop before anything real is built. Its drawing, the Time Card, is the loop itself: a week of days, one row each, with a punch at the minute each file was written and a tail to the minute this phone first read it.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/hello-live.zip) · It is the loop's proof, not a thing to personalize. To let Snuggery fetch it, paste `https://mtomasgaard.github.io/snuggery-apps-template/hello-live/data/snapshot.json` on its *Keep This Up To Date* screen ([the two ways](#getting-the-data-to-the-phone-two-ways)). Its `miniapp.json` also suggests that address, so a Snuggery that fetches data asks once, the first time you open it, whether it may ([an app can suggest its address](#or-let-the-app-suggest-its-address)).

### Running Dashboard

Five panes of running from a Garmin watch — Now, Plan, Training, Health, Sessions: weekly volume and load, heart-rate zones, sleep, HRV, steps and weight, per-session charts with a route map, and a coaching evaluation. Now opens on a table of the week's figures with the training block under it, and Plan on the block itself, drawn the way a coach draws one: twelve weeks back to race day, each run a block of ink at a fixed 0.8 px per kilometer, the plan's weeks still to run as outlines of their targets around a light tint; under Plan's goal, the weekly running chart in its stock colors, past and planned. On the panes with a time window, the window stays at the top while the pane scrolls. **Ships with made-up data — nine months of running with a half-marathon block in progress, its recent runs drawn along segments of famous marathon courses — and a coaching evaluation, plan and race forecast written for that runner, so the panes look the way a real copy's do.**

**Needs:** a Garmin sign-in · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/running-dashboard.zip) · Make it yours: [`running-dashboard/PROMPT.md`](running-dashboard/PROMPT.md) · How it works: [`running-dashboard/NOTES.md`](running-dashboard/NOTES.md)

### Finances

Net worth, accounts, spending and savings from bank data over PSD2 (Enable Banking), plus the house, cars and loans no bank reports. Overview opens on the Balance, the household's balance sheet drawn as an accountant's T-account to one printed scale: one block of ink per account, fund, car, home and loan, and the empty space under the debts is the net worth. **Static example: a generated fake household**, labeled as such.

**Needs:** a bank connection · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/finances.zip) · Make it yours: [`finances/PROMPT.md`](finances/PROMPT.md)

### World News

The latest headlines by region from newsrooms whose terms allow a credited headline and link, read from their RSS and Atom feeds, each story linking out to the publisher. Every pane opens on the Datelines: one tick of ink per headline, placed by how old it was when the file was made, on one fixed scale from an hour to sixty days, so a region's news reads at a glance as fresh or stale. **Live**: refreshed daily here.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/world-news.zip) · Make it yours: [`world-news/PROMPT.md`](world-news/PROMPT.md)

### Outdoor Window

Scores the next 48 hours of weather against rules you write yourself and shows when to go out. Its drawing, the Shutters, is one row per rule across the 48 hours: every hour a rule rules out is a block of ink, a small green mark shows how much of a rule's allowance an hour used, and where no row has ink a framed window stands open, with `now` marked above the rows. **Live through your Shortcut**: it sends the phone's location to Open-Meteo and hands the answer to the app; no server.

**Needs:** your own Shortcut · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/outdoor-window.zip) · Make it yours: [`outdoor-window/PROMPT.md`](outdoor-window/PROMPT.md)

### Power Hours

Tomorrow's electricity prices for one bidding zone and the cheapest hours to run each appliance. Its drawing, the Landing, is the day-ahead price as the market settles it, a staircase with one tread per quarter hour on one printed scale, and laid into it the chosen appliance's cheapest run as a level drawn where the stairs sit lowest for that long, at the run's mean price, with a dashed line for the mean of everything ahead so the drop between them is the saving. **Live**: refreshed here twice a day (NO2 in the demo).

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/power-hours.zip) · Make it yours: [`power-hours/PROMPT.md`](power-hours/PROMPT.md)

### Global Wind

Five days of global 10 m wind from NOAA's GFS forecast, drawn as a long exposure: thousands of tracers carried by the forecast's own wind over a color layer, with the exposure printed under the plate ("1 s = 24 h of wind"), arrows as the alternative — on a map you pan and zoom, or a globe you turn — with a five-day time player you can scrub at any speed, a moving night side, a focus mode that leaves only the picture and the player, and a table of twelve cities at local noon. **Live**: refreshed here after each GFS run, up to four times a day, to its own `data-global-wind` branch because the file is 1.2 MB.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/global-wind.zip) · Make it yours: [`global-wind/PROMPT.md`](global-wind/PROMPT.md)

### Global Weather

Global Wind with four more fields — temperature, rain, cloud and pressure beside it — on the same map and globe, the same tracers of the wind over any of them, and a tap anywhere giving all five numbers at that point, in SI units. A separate app; installing it changes nothing about Global Wind. **Live**: refreshed here after each GFS run, up to four times a day, to its own `data-global-weather` branch because the file is 2.9 MB. Not in Snuggery's built-in pack, for size.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/global-weather.zip) · Make it yours: [`global-weather/PROMPT.md`](global-weather/PROMPT.md)

### Anatomy

A full human body in 3D: 1,752 real anatomical structures from BodyParts3D in nine layers — skin, muscle, organs, arteries, veins, brain and nerves, cartilage, bone, teeth — with release 4.0's arteries and veins down to the fingers, toes and brain, and its finer eyes, larynx, heart valves and bronchial tree. Peel, fade, isolate, search and explode it. Along the picture's edge the body's own spine serves as its rule: one ink block per labeled vertebra at the height the camera draws it, and a bar beside it spanning the levels of whatever is selected. Three.js is vendored; nothing is fetched. **Static**, 35 MB unpacked.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/anatomy.zip) · Make it yours: [`anatomy/NOTES.md`](anatomy/NOTES.md)

### Besseggen

The Besseggen ridge in Jotunheimen in 3D, from Kartverket's 1 m elevation data: the marked trail from Gjendesheim over Veslfjellet to Memurubu draped on the terrain with a walking-time profile, real sun position and cast shadows for any date and hour, viewsheds and lines of sight with the visible peaks named, saved viewpoints and a fly-through. The time track is a sunshine recorder's card for the point under the marker: the sun's arc for the day, inked only where the ridges leave that spot in direct sun. A planning tool, not a navigation aid; it has no position fix. **Static**, 27 MB unpacked.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/besseggen.zip) · Make it yours: [`besseggen/NOTES.md`](besseggen/NOTES.md)

### Norne Reservoir

The open Norne oil-field reservoir simulation model in 3D: 44,431 cells colored by oil, water or gas saturation, pressure or rock property, played through 110 monthly frames of production history, with wells and their rates, explode and cut views. Open the section under the model to sweep it through the grid's rows and columns, pinch to zoom in on a well, and lock its axes to the whole field so every section keeps one scale. The time track is the field's own water-cut record: each month a column as tall as the liquid the wells lifted per day, oil in ink and water stacked on it as a tint, so the plateau and the water's rise are read off the track. A pure reservoir view: nothing above the seabed is drawn. Plain WebGL 2, no libraries. **Static**, 26 MB unpacked.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/norne-reservoir.zip) · Make it yours: [`norne-reservoir/NOTES.md`](norne-reservoir/NOTES.md)

### Volve

A second oil field in 3D, this time with its seismic: the open Volve field's reservoir simulation model, 183,545 cells colored by oil, water or gas saturation, pressure or rock property, played through 37 quarterly report dates of its production history, with each well's simulated rates beside the rates the field reported. Open the section under the model and sweep it across the field, inline by inline, crossline by crossline or along the grid: the seismic survey shows at its own depths with the model's cells over it and the reservoir's top and base as interpreted, on one depth axis below sea level, and nothing is shifted to make the two agree. Pinch the section to zoom in, and lock its axes to keep one scale through the sweep. The seismic is drawn the way interpretation software draws it, a smooth variable-density image with zero kept at zero and no automatic gain. Plain WebGL 2, no libraries. **Static**, 64 MB unpacked. The field data travels under its own terms, free and not for sale ([ATTRIBUTION.txt](volve/data/ATTRIBUTION.txt)).

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/volve.zip) (33 MB) · Make it yours: [`volve/NOTES.md`](volve/NOTES.md)

### Shelf Atlas

The North Sea's oil and gas on a map you pan and pinch: every field outline in the Norwegian, UK, Danish and Dutch sectors, the platforms and the pipelines, the median lines between the four shelves, and a month player from January 1971 to the newest month all four regulators have reported. Each field is a disc sized and colored by what it produced that month, drawn inside a thin ink ring at its best month so far: a rising field fills its ring, a declining one sits small inside it, and by 2026 the northern North Sea is a basin of near-empty rings. Tap a field for the month's figure, its best month and its operator; Details opens its history chart and, for a cross-border unit (Statfjord, Frigg, Murchison…), each side's share and the sum. **Live**: rebuilt weekly here from the four regulators' open data — Sodir, NSTA, the Danish Energy Agency and NLOG — plus Natural Earth and Marine Regions.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/shelf-atlas.zip) · Set it up: [`shelf-atlas/PROMPT.md`](shelf-atlas/PROMPT.md) · Make it yours: [`shelf-atlas/NOTES.md`](shelf-atlas/NOTES.md) · How it was built: [`shelf-atlas/RESEARCH.md`](shelf-atlas/RESEARCH.md) · Running it: [`shelf-atlas/HANDOFF.md`](shelf-atlas/HANDOFF.md)

### World Oil & Gas

Every country's oil and gas production from 1900 to the latest Energy Institute year, annual or cumulative, as a choropleth with a year player; and 7,055 fields from Global Energy Monitor's extraction tracker (March 2026), drawn as the tracker records them and sized, in the newest year, by the one output figure it reports for each. Under the map runs the Ledger, the year's world output as one strip of ink: a block per producing country, widest first, each as wide as its share, everything under 1 % hatched. Play the century and the United States' 68.7 % of 1920 thins to 21.6 % by 2024 with Russia and Saudi Arabia beside it; tap a block for that country's card. Filter by status, onshore/offshore and conventional/unconventional; search fields, companies, basins and countries and light up a company's or basin's fields; the tracker's own outlines appear at high zoom, and a country's details list its units against the national figure. **Live**: countries rebuilt here after each Statistical Review; fields by hand (the tracker sits behind a form).

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/world-oil-gas.zip) · Set it up: [`world-oil-gas/PROMPT.md`](world-oil-gas/PROMPT.md) · Make it yours: [`world-oil-gas/NOTES.md`](world-oil-gas/NOTES.md) · The manual step and the gaps: [`shelf-atlas/HANDOFF.md`](shelf-atlas/HANDOFF.md)

### Snug Kart

An original arcade kart racer for a phone held upright: eight racers from an imaginary seaside-and-mountain town, three tracks (a flat harbor loop, a 26 m climb through banked sweepers to summit hairpins, a figure of eight at night that crosses its own start straight), three laps against seven rubber-banded rivals that drift, pass and use items. Throttle is automatic; one thumb steers, the other drifts and throws household items — a kettle, a quilt, a yarn snare, a paper plane, a honey puddle. Every race is kept on a lap chart, the race officials' sheet: the order at each of ten timing lines a lap, joined into one line per driver, which the results open on, your line in ink from the grid to the flag. Every kart, face, track, tree, lantern and sound is generated in code at start-up; the only third-party code is three.js. Sound and tilt steering are off until you switch them on. **Static**, 0.6 MB.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/snug-kart.zip) · Make it yours: [`snug-kart/NOTES.md`](snug-kart/NOTES.md) · The design it was built from: [`snug-kart/DESIGN.md`](snug-kart/DESIGN.md)

### Earth's History

The Earth at 90 moments from 750 million years ago to today, on a globe and on a Mollweide map: the PALEOMAP atlas's painted reconstructions, a slider whose track is the geological timescale, the pieces of today's crust shown moving with their plates, a climate model's temperature and rain as lenses over the maps, curves of CO₂, sea level and temperature, and 300 cities carried back to where their rock was. Each period has a card and its events, every number with its source, and every caveat is on screen: one reconstruction among several, a model rather than measurements, and where the atlas's 2008 ages differ from today's chart. It opens with 750 million years played map by map, once. **Static**, 7 MB. The maps, plate model and elevation grids are C. R. Scotese's (CC BY 4.0); the climate fields, the CO₂ and sea-level curves and the timescale are CC BY 4.0; the coastlines and cities are Natural Earth, public domain.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/earth-history.zip) · Make it yours: [`earth-history/NOTES.md`](earth-history/NOTES.md) · The design and the look: [`earth-history/DESIGN.md`](earth-history/DESIGN.md), [`earth-history/ART.md`](earth-history/ART.md)

### US Quakes

Every earthquake USGS has cataloged around the United States since 1638 — 394 890 of them, magnitude 2.5 and up from 1900 — on a map drawn like a seismograph's drum record, with the last 30 days of the USGS feed on top, refreshed hourly by this repository. Scrub a timeline from 1900 to now and play a decade; the plate boundaries draw themselves as a trace. Drag a line across Alaska and read a true-scale cross-section of the Cook Inlet slab down to 250 km. Seven stories (1700 Cascadia, 1811–12 New Madrid, 1906 San Francisco, 1964 Alaska, Oklahoma since 2009, 2018 Kīlauea, 2019 Ridgecrest), three of them playable; the Quaternary faults and USGS volcano alert levels as layers; a focus mode that leaves only the map and the record strip. Every sentence about the data is USGS's own, quoted, and "Not a warning service" stays on screen. **Live**, 6.8 MB; the history is rebuilt each January. USGS data is public domain; Natural Earth likewise.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/us-quakes.zip) · Keep it current: let Snuggery fetch its Pages address, `https://<you>.github.io/<repo>/us-quakes/data/snapshot.json`, which the site takes from the `data-us-quakes` branch, or give your shortcut one row pointing at that branch (the address is in [`us-quakes/tools/HANDOFF.md`](us-quakes/tools/HANDOFF.md); [the two ways](#getting-the-data-to-the-phone-two-ways)) · Make it yours: [`us-quakes/NOTES.md`](us-quakes/NOTES.md) · The design and the look: [`us-quakes/DESIGN.md`](us-quakes/DESIGN.md), [`us-quakes/ART.md`](us-quakes/ART.md)

### Warming World

NASA's GISTEMP temperature record on a globe: every 2° cell's anomaly against its own 1951–1980 average, year by year from 1880 to now, with the last 24 months beside it. The year slider is the warming stripes themselves, drawn as an instrument with the base period bracketed; the globe sits on a gray card so the only color on screen is a departure from normal; tap any place and its own line draws itself from 1880 over the cell's stripes; turn to the Arctic and read the cap's mean. Every number comes from GISS's published grid and table, rounded to 0.1 °C by this app; anomalies are never called temperatures; cells with no data are hatched; the current year is marked partial; a copy's release and age are on screen. **Live**, 1.3 MB, refreshed monthly from NASA's release. GISTEMP is US Government work (public domain); Natural Earth likewise; Archivo under the OFL.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/warming-world.zip) · Keep it current: let Snuggery fetch its Pages address, `https://<you>.github.io/<repo>/warming-world/data/snapshot.json`, which the site takes from the `data-warming-world` branch, or give your shortcut one row pointing at that branch (the address is in [`warming-world/tools/HANDOFF.md`](warming-world/tools/HANDOFF.md); [the two ways](#getting-the-data-to-the-phone-two-ways)) · Make it yours: [`warming-world/NOTES.md`](warming-world/NOTES.md) · The design and the look: [`warming-world/DESIGN.md`](warming-world/DESIGN.md), [`warming-world/ART.md`](warming-world/ART.md)

### Milky Way

The Solar System, the Sun's neighborhood and the Milky Way in one continuous 3D zoom, built from real data only. Under the picture runs a ruler of distance from the Sun, 0.001 AU to 10¹² AU, inked wherever these catalogs hold an object on the day shown, with the gap between the farthest comet and the nearest star left blank. The planets and the Moon come from JPL's ephemerides for any date from 1900 to 2099, and 21 moons of Mars and the giant planets from 1950 to 2049. A time player runs the year forward, and each planet trails its real path. There are 9,989 asteroids and comets, and 220,000 stars in 3D, mostly at their Gaia distances; the constellations come apart as you leave the Sun. The galaxy is shown as it has actually been measured: globular clusters, satellite galaxies, stellar streams, where young stars crowd, and two published spiral-arm fits, each labeled as what it is. There is no artist's impression anywhere. **Static**, 9.9 MB unpacked. The Gaia-derived star, sky and young-star map files (`data/stars/deep.bin`, `data/stars/named.json`, `data/sky/gaia-dr3-counts.jpg`, `data/galaxy/young-*.png`) may be used only non-commercially; the young-star maps are redistributed under a permission their authors gave SpiralMap, and no grant to downstream redistributors was found.

**Needs:** nothing · [**Get the ZIP**](https://mtomasgaard.github.io/snuggery-apps-template/zips/milky-way.zip) (6.5 MB) · Make it yours: [`milky-way/NOTES.md`](milky-way/NOTES.md)


![Running Dashboard](running-dashboard/screenshots/app.png)
![Finances](finances/screenshots/app.png)
![World News](world-news/screenshots/app.png)
![Outdoor Window](outdoor-window/screenshots/app.png)
![Power Hours](power-hours/screenshots/app.png)
![Global Wind](global-wind/screenshots/app.png)
![Global Weather](global-weather/screenshots/app.png)
![Anatomy](anatomy/screenshots/app.png)
![Norne Reservoir](norne-reservoir/screenshots/app.png)
![Volve](volve/screenshots/app.png)
![Besseggen](besseggen/screenshots/app.png)
![Milky Way](milky-way/screenshots/app.png)
![Shelf Atlas](shelf-atlas/screenshots/app.png)
![World Oil & Gas](world-oil-gas/screenshots/app.png)
![Snug Kart](snug-kart/screenshots/app.png)
![Earth's History](earth-history/screenshots/app.png)
![US Quakes](us-quakes/screenshots/app.png)
![Warming World](warming-world/screenshots/app.png)

Deleting an example is deleting its folder, its workflow in `.github/workflows/`
and its scripts in `scripts/`, where it has them. Then take out its row, entry
and picture on this page, and its carve-out in `LICENSE` and in the licence line
at the foot of this page, if it has one, and any lines of its own in
`.gitignore`. Global Wind and Global Weather also keep their data on a branch of
their own (`data-global-wind`, `data-global-weather`), which goes too. The
pictures above, and whatever an app's pull keeps, live inside the app's folder
and go with it. Most live apps have one or two scripts; Running Dashboard has
several, and its [`NOTES.md`](running-dashboard/NOTES.md#what-belongs-to-this-app)
lists everything that belongs to it.

---

## Open them in a web browser

Every app also runs straight in a browser: no phone, no Snuggery, nothing to install. It is the
same app from the same folder, and it shows the data last published here. Open the
[**index of every app**](https://mtomasgaard.github.io/snuggery-apps-template/), or one directly:

| App | Open in a browser |
| --- | --- |
| Milky Way | [**Open Milky Way**](https://mtomasgaard.github.io/snuggery-apps-template/milky-way/) |
| Hello Live | [**Open Hello Live**](https://mtomasgaard.github.io/snuggery-apps-template/hello-live/) |
| Running Dashboard | [**Open Running Dashboard**](https://mtomasgaard.github.io/snuggery-apps-template/running-dashboard/) |
| Finances | [**Open Finances**](https://mtomasgaard.github.io/snuggery-apps-template/finances/) |
| World News | [**Open World News**](https://mtomasgaard.github.io/snuggery-apps-template/world-news/) |
| Outdoor Window | [**Open Outdoor Window**](https://mtomasgaard.github.io/snuggery-apps-template/outdoor-window/) |
| Power Hours | [**Open Power Hours**](https://mtomasgaard.github.io/snuggery-apps-template/power-hours/) |
| Global Wind | [**Open Global Wind**](https://mtomasgaard.github.io/snuggery-apps-template/global-wind/) |
| Global Weather | [**Open Global Weather**](https://mtomasgaard.github.io/snuggery-apps-template/global-weather/) |
| Anatomy | [**Open Anatomy**](https://mtomasgaard.github.io/snuggery-apps-template/anatomy/) |
| Besseggen | [**Open Besseggen**](https://mtomasgaard.github.io/snuggery-apps-template/besseggen/) |
| Norne Reservoir | [**Open Norne Reservoir**](https://mtomasgaard.github.io/snuggery-apps-template/norne-reservoir/) |
| Shelf Atlas | [**Open Shelf Atlas**](https://mtomasgaard.github.io/snuggery-apps-template/shelf-atlas/) |
| World Oil & Gas | [**Open World Oil & Gas**](https://mtomasgaard.github.io/snuggery-apps-template/world-oil-gas/) |
| Snug Kart | [**Open Snug Kart**](https://mtomasgaard.github.io/snuggery-apps-template/snug-kart/) |
| Earth's History | [**Open Earth's History**](https://mtomasgaard.github.io/snuggery-apps-template/earth-history/) |
| US Quakes | [**Open US Quakes**](https://mtomasgaard.github.io/snuggery-apps-template/us-quakes/) |
| Volve | [**Open Volve**](https://mtomasgaard.github.io/snuggery-apps-template/volve/) |
| Warming World | [**Open Warming World**](https://mtomasgaard.github.io/snuggery-apps-template/warming-world/) |

The big 3D apps download their whole size on first open, just as the ZIP does. What only Snuggery
has (*Ask*, editing an app's files, the Shortcut that refreshes Outdoor Window from where you are)
is not in the browser copy.

**It also publishes the ZIPs with the newest data.** [`publish-web.yml`](.github/workflows/publish-web.yml)
copies each app folder, leaving out what the ZIP leaves out (screenshots, build tools, `raw/`), packs
each one as `zips/<app-folder>.zip` with the same zip line as the ZIP builder, and publishes both with
GitHub Pages. It commits nothing and runs again after every refresh, so the web copy and its ZIP follow
the data; Global Wind, Global Weather, US Quakes and Warming World take theirs from their data branches.
That ZIP is what the install links above open. `zips/` on `main` stays the code build: rebuilt only
when an app's code changes, so its data is the data of that push (the demo, for the four apps with a
data branch), and it is the only ZIP a copy without Pages has.

**In your own copy it is off until you turn it on:** Settings → Pages → *Build and deployment* →
Source: **GitHub Actions**, then run *Publish apps to the web* once from the Actions tab. Your
addresses are `https://<you>.github.io/<repo>/<app-folder>/`. **A Pages site is public even when the
repository is private** (except on Enterprise plans), so leave it off in a copy that holds real
data. To try it without publishing anything: `python3 scripts/build_web.py`, then
`python3 -m http.server -d _site` and open `localhost:8000`.

---

## How the data flows

Every live app here is the same shape with a different pull, and the picture shows the fullest
form of it: a pull script merges what is new into raw files, a build turns them into
`data/snapshot.json`, and an optional agent session writes text back that the next build carries
into the snapshot. Running Dashboard uses all of it; most apps skip the raw files and the agent
and write the snapshot straight from the source. Two hops, deliberately separate: the **code hop**
happens once (the ZIP, imported into Snuggery), the **data hop** happens again and again (one small
JSON file, fetched by Snuggery or copied by a Shortcut). The picture draws the Shortcut.

![How the data flows](data-flow.svg)

The same picture with the data moving along the lines: [`data-flow.html`](data-flow.html) — open it
in a browser, or keep it in Snuggery beside the apps; it needs no script.

What never happens: the mini-app cannot reach the network or start a shortcut by itself. The jobs
run inside GitHub. On the phone, the fetch runs either inside the Shortcuts app with your own
accounts, or inside Snuggery for a connection you set up and approved, and only to that address.
Nothing goes to Snuggery's developer on either path. If you sign in to GitHub inside Snuggery,
GitHub shows the owner of Snuggery's GitHub App (its developer) that your account installed it,
and on which repositories; the developer keeps the App's key offline and never uses it.

## Setting up: once ever, then once per app

Most of the work happens exactly once. Keeping the two lists apart is the whole
point of this page, because the first app looks like an afternoon and the fifth
is genuinely one line.

### Once, ever

1. **This repository** — *Use this template*, private.
2. **Choose how data reaches your phone**: Snuggery fetches it, or a Shortcut delivers it
   ([the two ways](#getting-the-data-to-the-phone-two-ways)). You can use both, for different apps.
3. **If Snuggery fetches it** and the repository is private: in Snuggery, sign in to GitHub once
   and install Snuggery's GitHub App on this repository only. Or paste a fine-grained token there
   instead (this repository only, **Contents: Read-only**).
4. **If a Shortcut delivers it**:
   - **A token**, if the repo is private — github.com/settings/personal-access-tokens →
     fine-grained → this repository only → **Contents: Read-only**. Give it a long
     expiry and write the date at the bottom of this file.
   - **One shortcut** on your phone, holding a Dictionary of *app name → data
     address* and a *Repeat with Each*. The recipe is below.
   - **One automation** that runs it — Shortcuts → Automation → Time of Day →
     Run Immediately.

### Every new app

1. **Ask an agent to build it**, in a session attached to this repository.
2. **Install it once** — in Safari on the phone, open `github.com/<you>/<repo>/raw/main/zips/<app>.zip` (the raw address downloads; the normal page only shows it), then Share → Snuggery. That is the code build, with the data of the last code change; with Pages on, `https://<you>.github.io/<repo>/zips/<app>.zip` carries the newest data.
3. **Connect its data, one line either way:**
   - Snuggery fetches it: open the app → ⋯ → *Keep This Up To Date* → paste its data address and
     approve it.
   - A Shortcut delivers it: add one row to the Dictionary in your shortcut, display name → data
     address.

That is the whole per-app cost. Nothing else changes, ever.

## Getting the data to the phone: two ways

The job writes `data/snapshot.json` here. Something then has to bring that file to the phone, and
there are two ways. Both put the same file in the same place, and the app is identical either way.
Neither is the right one for everybody: pick by what you want, and plan it with your agent.

| | **Snuggery fetches it** | **A Shortcut delivers it** |
| --- | --- | --- |
| **Setup** | Paste one address on the app's *Keep This Up To Date* screen and approve it once. A private repository also needs a GitHub sign-in in Snuggery, once | A shortcut, a Dictionary row per app, and an automation ([the recipe](#the-shortcut)). Two field traps catch everyone once |
| **When it refreshes** | When you open the app, when you come back to it, and from ↻ → *Get New Data*. In the background only now and then, when iOS allows, and only if you turn that on for the app | At the times you set, for example 06:00 every day, whether or not you open the app. There is no hourly option |
| **Seeing what happened** | The app's status line says when it last checked, and why a fetch failed | Nothing in Snuggery. A failed run shows in Shortcuts, if you look |
| **A bad response** | Only a successful response is written, so a dead token never lands an error page over your data | Shortcuts cannot see a status code: a dead token's `404` page is written over your data ([Token expiry](#token-expiry)) |
| **Where the key lives** | In Snuggery, in this iPhone's Keychain, bound to the repository you chose. Never in a backup or a shortcut | In the shortcut, outside Snuggery. Sharing the shortcut publishes the key with it |
| **Who sees what** | The site at the address sees each time you open the app | The site sees each time the shortcut runs |
| **Starting the job on demand** | Set up once with your GitHub sign-in, *Rebuild Data* starts your workflow, follows the run, and fetches when it completes | *Rebuild Data* opens a rebuild shortcut ([below](#the-shortcut)), which waits and pulls |

**A middle way** if you want Snuggery to hold the key and also want an exact time: let Snuggery
fetch, and add a Shortcuts automation that runs Snuggery's **Refresh a Snuggery App** action at
that time. It takes only the app's name, carries no address and no token, and refreshes only an app
whose background refresh you turned on.

**Both at once is allowed**, for the same app. The newer write wins, and the app's status line says
which one delivered last. A Shortcut copying from Pages can then put a copy up to ten minutes old
over a fresher one Snuggery fetched, until Snuggery's next fetch.

### Which address to paste, if Snuggery fetches it

| Your repository | The address | Needs |
| --- | --- | --- |
| **Public, with Pages on** | `https://<you>.github.io/<repo>/<app-folder>/data/snapshot.json` | nothing. Pages can lag a new commit by up to about ten minutes |
| **Public, Pages off** | `https://raw.githubusercontent.com/<you>/<repo>/main/<app-folder>/data/snapshot.json` | nothing. Up to about five minutes behind |
| **Private** | `https://api.github.com/repos/<you>/<repo>/contents/<app-folder>/data/snapshot.json` | Snuggery signed in to GitHub with this repository chosen, or a fine-grained token with **Contents: Read-only** pasted into Snuggery. Snuggery asks GitHub for the raw file itself, so there is no `Accept` header to add. About a minute behind |

**The private default, and why it is not Pages.** A Pages site is public even when the repository
is private (except on Enterprise plans). In a private copy holding real data, such as Running
Dashboard or Finances, use the contents address with a sign-in, and leave Pages off. Global Wind,
Global Weather, US Quakes and Warming World keep their live data on a `data-<app>` branch, which
the contents address above does not read: use their Pages address. Their data is public anyway.

**Try it on Hello Live first.** The public template's own copy needs no account and no key:

```
https://mtomasgaard.github.io/snuggery-apps-template/hello-live/data/snapshot.json
```

Paste it on Hello Live's *Keep This Up To Date* screen. Its headline is the hour the job last ran,
in UTC, so a new value about hourly proves the loop.

### Or let the app suggest its address

An app whose data is published at a **public** address can name it in its own `miniapp.json`, so
nobody has to paste it:

```json
"dataSource": {
  "url": "https://<you>.github.io/<repo>/<app-folder>/data/snapshot.json",
  "file": "data/snapshot.json"
}
```

The first time the app is opened, Snuggery shows its usual approval sheet: *"Hello Live wants to
fetch its data from mtomasgaard.github.io. Allow?"* Nothing is fetched until you allow it. *Not
Now* is remembered, and you can still allow it later on *Keep This Up To Date*. Hello Live carries
one, as an example.

- **For:** whoever installs the app, you or someone you send the ZIP to, gets live data with one
  tap instead of an address to find and paste.
- **Against:** the address travels inside the app to everyone who gets the ZIP.
- **Only a public address works.** Snuggery ignores a suggestion that has a key, a password, a `?`
  part, a private-network host, or anything besides `url` and `file`, and the app imports as if it
  had none. `file` must be a `.json`, `.csv` or `.tsv` file already in the app. A **private**
  repository is never suggested by an app: add it on *Keep This Up To Date* with your own sign-in.
- **Your own choice wins.** An address you pasted or allowed is never changed by an app, including
  when you replace the app with a new version.

**What Snuggery does with a connection.** It goes online only for an address you set up and
approved, sends the key only to the repository you chose, and writes only data files (`.json`,
`.csv`, `.tsv`), never the app's code. *Disconnect* forgets the key on the phone. Revoking it for
good is done at GitHub, and Snuggery links to the page. Snuggery never asks you to enter a code
someone else sent you.

### Notifications from the data, if something deserves one

The job can ask for a notification by adding a top-level `snuggeryNotify` list to the data file it
already writes. The app's own code does nothing for it: after each new copy of the file arrives,
however it arrives, Snuggery reads the list and posts the notification itself.

```json
"snuggeryNotify": [
  {"id": "rain-2027-01-15", "title": "Rain from 15:00", "body": "4 mm expected", "at": "2027-01-15T14:00:00Z"}
]
```

- **Off until you turn it on**, per app: *Notifications*, on the app's *Keep This Up To Date*
  screen. The first time, iOS asks whether Snuggery may show notifications. A restored backup turns
  it off again.
- **Each `id` is shown once.** Make it name the event (`rain-2027-01-15`), not the kind (`rain`),
  or the second rain is never shown. Ids the file carried while it was off are not shown later.
- **`at` is optional**: an ISO 8601 time with a zone. Without it, or up to 12 hours past, it shows
  at once; up to 8 days ahead, it is scheduled; older or further ahead, it is skipped (a far one is
  scheduled by a later copy, once it is within 8 days).
- **Limits:** at most 10 entries read per file; `id` up to 64 characters, `title` 60, `body` 200;
  plain text, no line breaks. At most 3 are shown per new copy and 6 per app a day; the rest are
  dropped and counted in the app's Diagnostics. Each shows the app's name, and a tap opens the app.
- **The trade-off:** a notification arrives only when new data does. An hourly job can be up to an
  hour late, and background refresh runs only when iOS allows. For "tell me at exactly 07:00",
  schedule the job, or a Shortcuts automation, for then.
- **Nothing is sent anywhere.** These are local notifications, made on the phone from data already
  there. There is no push server.

Leave the key out when nothing in the data is worth interrupting someone for.

---

## Layout

```
<app-folder>/            one folder per app, named however you like — may hold several files
  index.html             the whole app: inline CSS and JS, no build step
  miniapp.json           display name and entry point; optionally its public data
                         address (dataSource, above)
  data/snapshot.json     THE ONLY FILE THAT CHANGES ON THE PHONE
  screenshots/           pictures for this README; left out of the ZIP, so they
                         cost the phone nothing
  tools/ or pipeline/    how an app's data was built (Anatomy, Norne Reservoir,
                         Besseggen, Milky Way); left out of the ZIP in the same way
  raw/                   what a pull keeps that the phone does not need (Running
                         Dashboard); left out of the ZIP, and no ZIP is rebuilt for it
scripts/                 one or more refresh scripts per app
data-flow.html           the picture of the loop above, animated; data-flow.svg for the README
.github/workflows/       one refresh workflow per app, plus the ZIP builder and the
                         web publisher (publish-web.yml, with scripts/build_web.py)
zips/<app-folder>.zip    built automatically on every code change: the code build, with the data of
                         that push. With Pages on, the site's zips/ carries the newest data
```

Every app folder is a complete working example. Install Hello Live first and
connect it, either way, before building anything real — if it updates, your
loop works, and any later problem is in the new app rather than in the setup.
Any folder can be deleted once you no longer need it as a reference, together
with its scripts and its workflow.

**An app is not always one file.** The smallest working app is a single `index.html` with its
CSS and JS inline. Hello Live is `index.html` plus `style.css`, `app.js`, two modules in `js/` and the
house face in `fonts/`. Running Dashboard is `index.html` plus `app.js`, `style.css`, three modules in
`js/`, the house face in `fonts/`, and a `data/` folder holding a snapshot, six session streams, and about a
megabyte of map tiles. The ZIP takes the app's folder whole either way, less
the folders marked above as left out — still no build step.

## Conventions worth keeping

- **Everything the app shows that changes lives in `data/snapshot.json`.** The HTML and JS
  should go untouched for months while the data is replaced daily.
- **Document the JSON's shape in a comment at the top of the app's script.**
  Whatever rewrites that file next year will not have read the conversation that
  created it.
- **Carry a `generatedAt` timestamp and show it.** A dashboard that cannot tell
  you how old it is will quietly show you last week.
- **Add a top-level `ask` array — flat rows, plain keys, at most a couple of hundred.**
  Snuggery's *Ask* reads exactly that key when someone asks a question about the app's
  data (counts, totals and extremes are worked out by the app, not guessed), and shows
  `generatedAt` beside the answer as *Data from 13:09*. Without it, a question about the
  data has only the raw JSON to go on. It is for reading, not for drawing: one row per
  city with today's numbers, one per activity for the last two months — whatever a person
  would ask about in words.
- **Keep `data/snapshot.json` small.** Hundreds of kilobytes is typical, a few megabytes is fine;
  Snuggery refuses a data file over 32 MB however it arrives, and a phone parses 20 MB of JSON in
  seconds on every open.
  Aggregate on the job side — a dashboard shows what a person can read, not everything measured.
- **Fail loudly.** If the file is missing, unparseable, or the wrong shape, say
  so on screen. Never draw an empty chart as though it were data — a plausible
  blank dashboard is worse than an error, because it gets believed.
- **Re-read on `visibilitychange`.** Reads are fresh from disk, so this one line
  is what makes an app opened this morning show this morning's numbers. Snuggery fires the
  same event when new data lands while the app is open — so re-render in place, keeping the
  selected tab and scroll position, rather than rebuilding the page.
- **No network from the app.** A mini-app cannot reach the network, so
  everything it draws — map tiles, fonts, textures — travels inside its ZIP, and
  it fetches nothing but files in its own folder.
- **A licence to fetch live is not a licence to redistribute.** A tile server or
  feed that lets your copy fetch from it may still forbid shipping what it
  returned inside a downloadable archive, or republishing it in a public
  repository. Whatever travels under terms of its own is named as a carve-out in
  `LICENSE` and in the app's own docs.
- **Credentials live in the repository's Actions secrets** — never in a file in
  the repository, the snapshot, a log or a commit message. A job reads them from
  its environment.
- **One writer per file.** The scheduled pull never writes a file an agent
  session writes, and the other way round, so neither can overwrite the other's
  work. When an optional file is missing, the app says it is not there yet;
  it never draws a blank that passes for data.
- **A store the pull keeps between runs goes in the app's `raw/`** (Running
  Dashboard's does). It
  never ships: the ZIP builder leaves it out, and a commit to it rebuilds no ZIP.
  Everything else in the folder, bar the screenshots and build tools, goes into
  the ZIP and onto every phone that installs it.

## Things that will cost you an afternoon if nobody says them

**`schedule:` only runs from the default branch.** A workflow on a pull-request
branch is inert however correct it is. Merge to `main` before expecting a run.

**GitHub cron is best-effort.** Late by 5–20 minutes is normal, longer under
load, and a newly added schedule often skips its first slot. Say "about hourly",
never "at 7 past".

**Triggering a workflow by hand proves the job, not the schedule.** They are
different things, and a manual run is misleading precisely because it exercises
every line of the workflow and goes green. The only evidence the *schedule*
works is a run whose trigger reads `schedule`:

    gh run list --repo <owner>/<repo>            # look at the trigger column
    gh api "repos/<owner>/<repo>/actions/runs?event=schedule" --jq .total_count

If that count is zero, your schedule has never run, however many green ticks the
Actions tab shows. Check it once, on the day you set this up — otherwise you
find out from a dashboard quietly showing yesterday's numbers.

**Which clock you use is a choice, and it is yours.** GitHub's own schedule costs nothing extra and,
measured on one account, delivered a few runs a day in batches with hours-long gaps and a nine-hour
wait for the first. An external trigger — a free web form or a small Cloudflare Worker sending the
same `workflow_dispatch` — delivers on the hour for one more account and a token scoped to
*Actions: write* only. A scheduled agent session can reach connectors a bare cron cannot. Each is
right for somebody. **`scheduler/README.md`** lays them out with what each is for and what it costs;
plan it with your agent.

---

## The shortcut

For the apps a Shortcut delivers. One shortcut refreshes every app here.

1. **Dictionary** — one row per app: key = the app's display name, value = the
   raw address of its `data/snapshot.json`.
2. **Repeat with Each**, over the Dictionary's **Keys** — tap the Dictionary pill in
   the Repeat and choose *Keys*. Not over the Dictionary itself: Shortcuts treats a
   dictionary as one item, runs once, and joins every name into a single string.
   That works with one row and breaks with two. Inside the loop, three actions:
   - **Get Dictionary Value** → key `Repeat Item`, in the Dictionary.
   - **Get Contents of URL** → the *Dictionary Value* from the step above.
     If the repo is private, add a header: `Authorization` = `Bearer <token>`,
     and `Accept` = `application/vnd.github.raw`.
   - **Update a File in a Snuggery App** → leave **App** empty, set
     **App name** to `Repeat Item`, set **Text instead of a file** to the
     output of *Get Contents of URL*, leave **Path in the app** empty.
3. **Test it with two rows.** One row cannot show the difference.

Two field traps, both of which everyone hits once:

- The fetched JSON goes in **Text instead of a file**, never **File**. A web
  address returning JSON hands Shortcuts a *dictionary*, and the File field
  refuses it.
- **App** is a picker and will not take a variable. That is exactly why
  **App name** exists — it is a text field, so a loop can fill it.

Shortcuts stops at the first action that fails, so a deleted app halts the rest
of the chain.

**Refreshing on demand.** Separate from the schedule, *Keep This Up To Date* in Snuggery has,
under *3 · Rebuild*, the name of **one rebuild shortcut** (suggested `Rebuild a Snuggery App`) and a
**Run it now** button — and the app's refresh button (↻) has **Rebuild Data**, the same thing one tap away; the dashboard
reloads by itself when the new file lands. Snuggery opens it with the app's name as the shortcut's input — on this path that is all Snuggery does,
and it makes no request itself. (If you set up *Rebuild Data* on that screen — your GitHub workflow,
with Snuggery signed in to GitHub — Snuggery starts the workflow itself instead, and no rebuild shortcut is needed.) The shortcut is built once (Snuggery offers a ready-made one) and holds a
Dictionary with one row per app: key = the app's exact name; value = a Dictionary with `job` =
`https://api.github.com/repos/OWNER/REPO/actions/workflows/<file>/dispatches` and `data` = the
published data address. It runs the row it was named: **Get Contents of URL** as a POST to `job`
(body `{"ref":"main"}`, header `Authorization: Bearer <token with Actions: write>`); **Open App** →
Snuggery, so you land back in the app while the rest runs behind it; **Wait** about a minute and a
half; **Get Contents of URL** of `data`; **Update a File in a Snuggery App** with *App name* =
the input and *Text* = that contents. Adding an app is adding its row.

**Data and code are two different hops.** The loop above refreshes `data/snapshot.json` and
nothing else. When an app's *code* changes, `zips/<app>.zip` is rebuilt automatically; to get it
onto the phone, either open the ZIP's address in Safari → Share → Snuggery → **Replace the app**
(it reloads in place, even while open), or keep a second, one-tap shortcut: **Get Contents of URL**
(the ZIP's address, with the same header if the repo is private) → **Replace a Snuggery App with a ZIP** → pick the
app. Do not put that in the hourly loop — it would replace and restart the app every hour.

---

## Token expiry

| Token | Scope | Expires |
| --- | --- | --- |
| _(name it here)_ | Contents: Read on this repo | _(write the date here)_ |

When it lapses, every app a Shortcut delivers takes a 404 body over its data on
the same run. This table is the cheapest possible defence against that. An app
Snuggery fetches keeps its data, and its status line says the fetch failed; a GitHub
sign-in in Snuggery renews itself until you revoke it at GitHub, or leave it
unused for about six months.

---

MIT licensed — see [LICENSE](LICENSE), whose carve-outs name everything that travels under its own
terms: the US Geological Survey map tiles (public domain), the OpenStreetMap-derived route shapes
(ODbL) in Running Dashboard, spelled out in
[TILES.md](running-dashboard/TILES.md); the BodyParts3D geometry in Anatomy (CC BY-SA 2.1 JP, also
CC BY 4.0 at source) with its BodyParts3D 4.0 structures (CC BY 4.0 —
[CREDITS.txt](anatomy/CREDITS.txt)) with its vendored three.js (MIT) and the
Ysabeau Office typeface (SIL OFL 1.1); the Norne benchmark model in Norne Reservoir (ODbL —
[ATTRIBUTION.txt](norne-reservoir/data/ATTRIBUTION.txt)); the Volve field data in Volve (© Equinor ASA and the former
Volve license partners, under Equinor's terms, not for sale — [ATTRIBUTION.txt](volve/data/ATTRIBUTION.txt)); Kartverket's DTM1 terrain (NLOD 2.0 / CC BY 4.0), Turrutebasen
(open), N50 (CC BY 4.0) and SSR (CC BY 4.0) in Besseggen ([CREDITS.txt](besseggen/CREDITS.txt)); in Milky Way, the
Gaia-derived star, sky and young-star map files (`deep.bin`, `named.json`, the sky JPEG and `young-*.png`; CC BY-NC
3.0 IGO, so non-commercial use only), the Stellarium files (`sun.jpg`, `moon.jpg`, `constellations.json`) and the
AT-HYG/HYG-derived star files (CC BY-SA 4.0), with its vendored three.js (MIT) and two SIL OFL fonts
([CREDITS.txt](milky-way/CREDITS.txt)); and, in Global Wind and Global Weather,
NOAA's forecast (public domain), Natural Earth coastlines (public domain) and GeoNames city labels
(CC BY 4.0, attribution required — [LICENSES.md](global-wind/assets/LICENSES.md)); and, in Shelf Atlas and World Oil & Gas,
the four North Sea regulators' open data (Sodir under NLOD; NSTA under its Open User Licence, non-commercial; the Danish
Energy Agency; NLOG), Marine Regions and EMODnet (CC BY 4.0), Our World in Data's energy dataset (CC BY 4.0), Global Energy
Monitor's extraction tracker (CC BY 4.0) and Natural Earth (public domain) — [RESEARCH.md](shelf-atlas/RESEARCH.md).