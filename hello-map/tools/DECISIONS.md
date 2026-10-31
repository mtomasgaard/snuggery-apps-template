# Hello Map: decisions and the record of the build

Not shipped (the ZIP leaves `tools/` out). The plan is OA-11 of the 1.4 design (online apps as the
owner sees them): "a small online starter app: the online equivalent of Hello Live".

## Calls made in the build, for the owner to confirm

1. **The name.** The plan's working name was `topo-map` and left the name to the owner. Built as
   **Hello Map** (`Template/hello-map/`), so it sits beside Hello Live in the list as the starter for
   online apps, as Hello Live is for live data. The name is cheap to change until the app is
   published (`miniapp.json`, `<h1>`, `<title>`, `check.mjs` item 3, `js/util.js`'s prefix,
   `docs/test-apps/Hello-Map.zip`), and never after (HOUSE.md 4.2: the camera opens an app by name).
2. **The site and the layers** are the plan's: `basemap.nationalmap.gov`, `USGSTopo` (Map) and
   `USGSImageryTopo` (Imagery). Public domain, no key, `Access-Control-Allow-Origin: *`, and the
   owner's decision of 2026-10-19 that the prompt's example site be a public mapping agency.
3. **The signature** is the quadrangle collar (ART.md 2). The plan named "a metric scale bar, a
   latitude and longitude readout on tap, and focus mode" as the house parts; the collar is what
   makes the app memorable, and it is made of the view's own geography, so it also gives the
   offline face something true to show.
4. **No `crossOrigin`.** The canvas only draws the tiles, so the tiles load as plain pictures and the
   app works with any picture site, CORS or not. NOTES.md says when an app needs `crossOrigin`.
5. **Not in the app's starter pack** (`IN_APP`) and not in the 1.2/1.3 More-examples bundle: the
   plan's step 4, and the owner's rule for Norway in 3D (online apps reach the public template at
   1.4's submission and the bundle only once 1.4 is live). `publish-web.yml` packs every app folder
   into `more-examples.zip` today; OA-06's gate (skip apps with `network.resourceHosts` until
   `ONLINE_APPS_IN_BUNDLE` is true) must land before the template is mirrored with this folder in it.

## As built (2026-10-19)

- The coverage was measured with curl from the build machine (NOTES.md: The site). Everything to
  level 8; from 9, only the United States and its territories, unevenly at the borders. Hence the
  coverage boxes and the enlarged level-8 picture with its sentence outside them.
- The grid steps: 120 px between ticks at least (96 px first, which put a tick every 1′ at level 13
  and crowded the map with crosses); 2′ and 20″ were added to the quadrangle family so every level
  lands between 120 and 250 px.
- The collar keeps one style in both themes: a dark-theme version (pale ink on a dark halo) read as
  a smudge over the pale topographic map, so the plate and its marks keep their daylight, as Norway
  in 3D's do.
- Labels are placed before the strokes are drawn, so a cross never sits on a label.
- `retryFailed()` first reset a failure's time to 0, which a page younger than eight seconds read as
  "failed just now": the map stayed blank after the network came back. It now resets to −∞; the
  shoot's network-cut scene caught it.

## The record of the checks (2026-10-19, build machine, headless; not phone evidence)

- `node tools/check.mjs`: 49 checks, all pass. App code 71 015 B, fonts 40 075 B, the ZIP 75 112 B.
  Both policies equal Snuggery's `MiniAppNetworkPolicy.swift` on `wp22-online-apps` (c3925e6).
  Negative controls: a second host added to `js/sources.js` only fails item 8; an inline `<script>`
  appended to `index.html` fails item 19.
- `docs/test-apps/Hello-Map.zip` in the Snuggery repository: built with `build-zips.yml`'s command,
  75 112 B, sha256 `69ca527822bc89cb29555a1f0934f729d10c53bc5135b029822dd6ee0b54f368`, 18 entries;
  unzipped, it is identical to this folder less `tools/`, `screenshots/` and `.gitignore`.
- `PLAYWRIGHT_MODULE=… node tools/shoot.mjs` (Playwright 1.63.0, Chromium 153.0.8010.12): 248 checks,
  all pass; one named skip (hidden: headless browsers keep `document.hidden` false).
- `ENGINE=webkit PLAYWRIGHT_MODULE=… node tools/shoot.mjs` (Playwright's WebKit 26.6): 78 checks, all
  pass (boot, kept offline, network cut, both themes); the other scenes need CDP touch and run under
  Chromium only.
- `python3 hello-map/tools/art/palette.py` from the template's root: ALL CHECKS PASS (the collar
  12.46:1 at worst on its halo, the ghost key 3.95:1 at rest).

## Left for others

- **Hosted test** (plan OA-11): add Hello Map to `MiniAppRealAppsRegressionTests` as an online run
  with no script errors, from `docs/test-apps/Hello-Map.zip`. A build lane's job: this lane does not
  build the app.
- **Device matrix row** (plan OA-11): the nine phone checks in NOTES.md, on the owner's iPhone 16 Pro
  with iOS 26 and a 1.4 build. Row numbers are given at merge.
- **README and HOUSE.md** (OA-10, another lane): Hello Map belongs in the README's list of apps, and
  HOUSE.md's 4.16 (an online app) can cite it beside Norway in 3D.
- **Reviews the plan names**: accessibility-reviewer, dependency-license-researcher (USGS terms;
  this build read the FAQ on 2026-10-19 and found no stated request rate), spec-compliance-auditor.
