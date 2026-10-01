# Global Wind — design

What this app does is Global Weather's `DESIGN.md`, in `global-weather/` beside
this folder in the template repository: §1 the flow, §2 the scrub, §3 focus
mode, §4 SI notation, §5 the tools and §6 the budgets. Global Wind is that app
with one field, copied by hand because a mini-app is one folder. This file says
only where the two differ.

## The data half: schema 1

The snapshot holds `speed` and `dir` straight in each step, with
`encoding.speedStep` (0.25 m/s a byte) and `encoding.dirStep` (1.40625° a byte,
the direction the wind blows FROM); `maxSpeed` is printed in About and decides
whether the legend's top end reads `≥ 36 m/s`. The contract is at the top of
`app.js`. After unpacking, the app builds u = −s·sin(dir) and v = −s·cos(dir)
for every step once (41 × 16 380 × 2 floats, 5.4 MB) and lets the bytes go, so
a step change, a scrub and every frame of the flow are a lookup. The flow, the
speed colors, the arrows and the tapped readout all read those same u and v.

`js/flow-math.js`, `js/flow.js`, `js/track.js` and `js/units.js` are Global
Weather's files byte for byte; `tools/check.mjs` fails the day one of them
differs, so a fix lands in both.

## What the reader can change

| Control | Stored as | Default |
| --- | --- | --- |
| Map / Globe | `gw.tab` | Map |
| the map's view, the globe's | `gw.view`, `gw.globe` | the reader's own longitude, from the clock |
| units (m/s, km/h, kt, mph) | `gw.units` | m/s |
| Speed colors | `gw.heat` | on |
| Night | `gw.night` | on |
| the tapped place | `gw.marker` | none |
| Flow, new | `gw.flow` | on |
| Arrows, new | `gw.arrows` | off |
| focus mode, new | `gw.focus` | off |

The seven keys Global Wind 1.0 wrote keep their names and their shapes, so a
library that has this app already keeps its view, units, colors, night and
marker. Every access is inside `try`/`catch`.

**The marketing camera** waits for the visible word *Updated* in the stamp and
taps the buttons named *Zoom in* and *Zoom out*; zooming in twice and out twice
from the plate's center puts the map back where it was. All of these survive.
In focus mode they are hidden; the one button named *Show the controls* brings
them back.

## The tools

From `global-wind/` (none of them ships):

- `node tools/check.mjs`: Global Weather's checks for this app, plus the shared
  files compared byte for byte with `../global-weather/`, and US spelling with
  the two words Global Weather's sweep missed.
- `node tools/test_flow.mjs`: the flow's math against formulas written in the
  test, and against this app's own snapshot and `ask` rows.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs`: the app in headless Chromium at
  390 × 844, by real touch, both themes and Reduce Motion, with what is new
  here: the Speed colors key, a library left by 1.0, the camera's zoom round
  trip, the whole-world map's bottom edge, and the place names under a card a
  tap has just opened. The test hook is `window.__gw`.

Headless Chromium is not a phone. The flow's frame time and step-down on map
and globe, the three-speed scrub, the ghost key below the status bar in
Snuggery's full screen, VoiceOver on *Forecast time*, landscape, and battery and
memory over ten minutes are measured on a phone, by the owner.
