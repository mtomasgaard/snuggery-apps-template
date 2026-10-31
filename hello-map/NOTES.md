# Hello Map

The smallest online app in the template: a live topographic map of the United States from the U.S.
Geological Survey's The National Map, with a quadrangle's collar over it (ticks and degrees on the
edges, small crosses inside), a scale bar, the coordinates of any point you tap, and one calm
sentence when the map cannot load. It is to online apps what Hello Live is to live data: copy it,
change one site, and you have your own.

**It is an online app.** Nothing of the map travels inside it. The map is pictures from one site,
`basemap.nationalmap.gov`, which Snuggery shows only after you allow that site. Offline, or before you
allow it, the app opens, draws its collar and scale, and says it cannot reach the map.

**It is not a navigation tool.** It does not know where you are.

---

## What an online app is

An app becomes online by naming the sites it shows pictures from, in `miniapp.json`:

```json
"network": { "resourceHosts": ["basemap.nationalmap.gov"] }
```

When you import it, Snuggery lists every site and asks: Allow, or Keep Offline. After that, the app's
menu in Snuggery (Sites This App Uses) changes it.

- **What it can do once allowed:** show pictures (map tiles, photos) and web fonts from those sites,
  over HTTPS.
- **What it still cannot do:** `fetch()`, XHR, WebSockets, `EventSource` or `sendBeacon` to any site;
  scripts, stylesheets, audio or video from the web; any site it did not list. Its own data still
  comes from files inside its folder.
- **What each site sees:** an ordinary request for every picture, with your IP address and the time.
  The app decides the address of each picture, so the site learns which area and scale is on
  screen. A site you allow should be one you are content to tell that much.
- **What it costs the code:** the page runs under a strict content security policy. Every script is
  a `.js` file loaded with `<script src>` or `type="module"`; no inline `<script>`, no `onclick="…"`
  or other `on…=` attribute, no `eval` or `new Function`, no strings passed to `setTimeout`; a worker
  only from a `.js` file in the folder. Inline `<style>` and `style="…"` are fine.
- **Reading a picture's pixels** (heights packed into a PNG, say) needs `img.crossOrigin =
  'anonymous'` before `src`, and works only with sites that answer with
  `Access-Control-Allow-Origin`. Hello Map only draws its pictures and never reads them, so it does
  without.

## What is in the folder

```
index.html, app.js, styles.css     the app; index.html at the folder root, no inline script
js/sources.js                      THE ONE LIST OF SITES: the host, the tile address, the coverage
js/mercator.js                     Web Mercator, the projection the tiles are cut in
js/tiles.js                        which pictures the view needs, six at a time, drawn on a canvas
js/collar.js                       the signature: the quadrangle's ticks, crosses and degrees
js/units.js                        every number, length and coordinate written (SI first)
js/focus.js, js/util.js            focus mode; small helpers and the stored settings
miniapp.json                       name, entry point, version, and network.resourceHosts
CREDITS.txt                        the source, its terms and the credits
fonts/                             the template's house face, Ysabeau Office, with fonts/OFL.txt
ART.md                             the look: the house system and this app's signature, the collar
tools/                             serve.mjs, check.mjs, shoot.mjs, art/palette.py, DECISIONS.md
                                   (the ZIP leaves tools/ out)
```

## Run it the way Snuggery runs it

A plain file server is not enough: it would let the page do what the phone forbids. `tools/serve.mjs`
adds Snuggery's policy to every response, so the browser enforces the same rules:

```
node tools/serve.mjs              # http://127.0.0.1:8018/, the site allowed
node tools/serve.mjs --offline    # the same app kept offline: every tile refused
```

Open the address in a browser and watch its console: under the online policy it should be silent.

## The site

| Host | What | Terms |
| --- | --- | --- |
| `basemap.nationalmap.gov` | USGS The National Map's cached map services `USGSTopo` (Map) and `USGSImageryTopo` (Imagery): 256 px JPEG and PNG tiles in Web Mercator, levels 0 to 16, `…/arcgis/rest/services/{service}/MapServer/tile/{level}/{row}/{column}`; `Access-Control-Allow-Origin: *`; `Cache-Control: max-age=86400` | public domain; USGS asks for an acknowledgment (below) |

**Coverage, measured 2026-10-19 with curl from the build machine**, both services alike: every place
answers to level 8 (the whole world, at country scale). From level 9, only the United States and its
territories answer; Paris, Sydney and the mid-Atlantic answer 404. Near the borders it is uneven
(Toronto and Vancouver answer to level 12 and not at 14; Mexico City answers the map to 16 and the
imagery to 12; the Gulf of Mexico off Texas stops at 9). So `js/sources.js` keeps a few generous
longitude and latitude boxes (the 48 states, Alaska, Hawaii, Puerto Rico and the Virgin Islands,
Guam and the Northern Marianas, American Samoa). A picture outside every box is never asked for
beyond level 8: the app shows the level-8 picture enlarged, and when the middle of the view is
outside, it says so in one sentence, "The National Map shows detail only in the United States. Zoom
out, or show the whole country." A picture inside a box that the site still does not have (a coast,
a border) is drawn from a coarser one, and the status line counts it.

**Rate.** USGS states no request rate for these services that this pass could find (2026-10-19). The
app asks for what is on screen and nothing ahead, six at a time, keeps up to 360 pictures while it is
open, and the site's own `Cache-Control` lets the phone's web view keep them a day.

**Terms**, read 2026-10-19 at `www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map`:
*"Map services and data downloaded from The National Map are free and in the public domain. There
are no restrictions; however, we request that the following acknowledgment statement of the
originating agency be included in products and data derived from our map services when citing,
copying, or reprinting: "Map services and data available from U.S. Geological Survey, National
Geospatial Program.""* The request names no place on the screen, so About prints the statement word
for word (HOUSE.md 4.15: map tiles whose terms do not require a credit beside the map are credited
in About only). Nothing on the front names USGS, and the app says it is not made or endorsed by
USGS (HOUSE.md 6.5: no borrowed authority).

## Make your own online app from this one

1. **Choose a site** whose terms allow use from an app and that needs no key: a public map service
   run by a government mapping agency is the usual answer. Read its terms, and its usage policy if
   it has one; a request that works is not permission. Never put a key or a token in the app or in
   a picture's address: anyone with the ZIP can read it.
2. **List the site** in `miniapp.json` under `network.resourceHosts`: the host name only, no
   `https://`, no path, no port, no `*`, no IP address, no `xn--` name, at most eight sites.
3. **Point `js/sources.js` at it**: the host in `HOSTS`, the address of one tile in `tileUrl`, its
   levels in `MIN_ZOOM` and `MAX_ZOOM`, and its coverage in `COVERAGE` (measure it as above).
4. **Credit it** the way its terms ask: in About under *Sources and credits*, word for word, and in
   `CREDITS.txt`. If the terms ask for the credit beside the map, it goes at the map's foot instead
   (HOUSE.md 4.15, exception 1).
5. **Keep the offline face**: one calm sentence where the map would be, never a grid of broken
   pictures. Change the sentence in `app.js` if the site's name or the request changes.
6. **Test under the policy**: `node tools/serve.mjs` and `node tools/serve.mjs --offline`, then
   `node tools/check.mjs` (it fails if `js/sources.js` and `miniapp.json` disagree, if an address
   names a site not listed, or if any code is inline).
7. **Rename it** in `miniapp.json`, `index.html`'s `<h1>` and `<title>`, and the storage prefix in
   `js/util.js`, so your copy keeps its own settings.

An app with a private data source (a keyed `dataSource`) stays offline in Snuggery whatever it lists:
a key and outside sites never share an app.

## Code map

| File | Owns |
| --- | --- |
| `app.js` | the state and what is remembered, the canvases, the frame scheduler, gestures, the keys, the card, About, the status line and the notice, the test hook `window.__hellomap` |
| `js/sources.js` | the site, the two layers, the levels, the coverage boxes, the home view |
| `js/tiles.js` | the picture cache (360), the queue (six in flight, nearest the middle first), retries (three, eight seconds apart), drawing with a coarser picture until the right one arrives |
| `js/collar.js` | the grid step, the ticks, crosses and labels, the tapped point's marker |
| `js/mercator.js` | longitude and latitude to and from the tiles' Web Mercator, meters per pixel |
| `js/units.js` | lengths in meters and kilometers or feet and miles, coordinates in decimal degrees and in degrees and minutes, the collar's labels |

**Stored settings**, under `hellomap:` in the web view's storage: `lon`, `lat`, `zoom`, `layer`,
`units`, `focus`.

## Tests

```
node tools/check.mjs                                   # static: the site list, the policy, the house rules
PLAYWRIGHT_MODULE=…/playwright/index.mjs node tools/shoot.mjs   # the app driven in headless Chromium
SCREENSHOTS=1 PLAYWRIGHT_MODULE=… node tools/shoot.mjs           # also writes screenshots/
ENGINE=webkit PLAYWRIGHT_MODULE=… node tools/shoot.mjs           # the same boot checks in Playwright's WebKit
```

`shoot.mjs` serves the folder with `tools/serve.mjs` and fails on any console error or warning, page
error, request to a host outside `miniapp.json`, or HTTP error from the folder, under the online
policy; then it runs the app kept offline and with the network cut, where the only messages allowed
are the refused pictures. It needs the network for the online part. Headless Chromium is not a
phone: what only a phone can show is listed below.

## Budgets

App code at most 80 000 B, fonts at most 160 000 B, the ZIP at most 200 000 B; `tools/check.mjs`
prints today's figures.

## What is unverified on a phone

Checked only in headless Chromium and Playwright's WebKit on the build machine (2026-10-19), never in
Snuggery's web view on a phone. For the device matrix, on the owner's iPhone 16 Pro with iOS 26 and
a Snuggery build that carries online apps:

1. Import: the Allow sheet lists exactly `basemap.nationalmap.gov`, and no inline-script warning shows.
2. After Allow: the map loads at Yosemite Valley in both themes, the collar and its labels in the
   house face, and the status line says every tile has loaded.
3. After Keep Offline (and from Sites This App Uses, turned back to offline): the sentence "No map
   tiles could be loaded. If this app is offline in Snuggery, allow its site to see the map.", the
   collar and the scale still drawn, no broken pictures.
4. Airplane mode with the site allowed: the same sentence; it goes away by itself once the phone is
   back online and the map is moved.
5. Gestures in Snuggery's full screen: drag, pinch toward the fingers, double-tap to zoom in, a tap
   for the card, and the card never covering its own point.
6. Focus mode in Snuggery's full screen: the ghost key and Snuggery's own exit control both reachable,
   the layer switch kept, the setting remembered after a relaunch.
7. VoiceOver: the map's name and help, the keys' names, the layer switch as a radio group, the card's
   sentence when a point is tapped, About's sheet.
8. Outside the United States (zoom into Europe past level 8): the enlarged world picture and the
   sentence, with no request beyond level 8 (Safari's Web Inspector on a Mac, if available).
9. Memory after five minutes of panning and zooming: the web content process stays steady (360
   pictures at most are kept).

## Credits

Map services and data available from U.S. Geological Survey, National Geospatial Program.

Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.
