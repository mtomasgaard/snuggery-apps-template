# Setting up World Oil & Gas

Paste this whole file into a coding-agent session that has this repository open:
**your own copy**, made with *Use this template*, never the template itself.
The agent does the typing.

## What this app is

World Oil & Gas is every country's oil and gas production since 1900, annual
or cumulative, on a map with a year player; under the map, the year's world
output as shares, one ink block per producing country (the Ledger); and 7 055
fields from Global Energy Monitor's extraction tracker that appear at discovery
and fill at first production. The country data comes from Our World in Data (which carries the
Energy Institute Statistical Review), fetched by a job with no key or account.
The field data is a workbook that sits behind a form, so it is dropped in by
hand; the March 2026 release ships with the app.

It ships working. There is nothing to decide before the Shortcut row.

## Before you start

- You are working in **your** copy of this repository. If
  `gh repo view --json nameWithOwner -q .nameWithOwner` shows
  `snuggery-apps-template`, stop and make your copy first.
- Python 3.10 or newer and two packages, for a local build only (the
  workflow installs the same ones):
  ```
  python3 -m pip install 'openpyxl>=3.1' 'pillow>=10'
  ```
- Set the repository once and reuse it:
  ```
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
  ```
- **Read `world-oil-gas/NOTES.md` first.** It carries the attribution strings
  the app must print (all three sources are CC BY or public domain) and the
  estimate the moving field circles rest on.

## Step 1: the clock

`.github/workflows/build-world-oil-gas.yml` runs **on 1 July and 1 September**
(`17 6 1 7,9 *`) and on demand. The Energy Institute publishes its Statistical
Review in June and Our World in Data folds it in over the following weeks;
the two slots catch it. Any other day the build finds the same file and
commits nothing.

- **`schedule:` only runs from the default branch.** Merge to `main` first.
- **Triggering by hand proves the job, not the schedule.** A run whose trigger
  reads `schedule` is the only evidence the schedule works:
  ```
  gh api "repos/$REPO/actions/runs?event=schedule" --jq .total_count
  ```

Prove the job now:

```
gh workflow run build-world-oil-gas.yml --repo "$REPO"
gh run watch
```

## Step 2: onto the phone

1. Open the raw address of `zips/world-oil-gas.zip` in Safari, then Share, then
   Snuggery, to install it.
2. In your loop shortcut's Dictionary, add one row: key `World Oil & Gas`,
   value
   `https://raw.githubusercontent.com/OWNER/REPO/main/world-oil-gas/data/snapshot.json`
   (`OWNER/REPO` is what `$REPO` printed; a private repository needs the
   `Authorization` and `Accept` headers the README describes).
3. In your rebuild shortcut's Dictionary, add the matching row:
   ```
   job  = https://api.github.com/repos/OWNER/REPO/actions/workflows/build-world-oil-gas.yml/dispatches
   data = the same data address as above
   ```

**The loop refreshes `data/snapshot.json` only**: the country data, which is
what changes once a year. The fields (`fields.json`), the basemap
(`world.json`) and the shading (`shade.webp`, `shade/`) travel in the ZIP: when they
change, the ZIP is rebuilt, and the app picks them up when you replace it
(in Safari, the ZIP's address, then Share, then Snuggery, then **Replace the app**).

## Step 3: a newer tracker release, when there is one

Global Energy Monitor updates the tracker about twice a year. To load a new
release:

1. Download it from
   https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/download-data/
   (an `.xlsx` behind a form).
2. Put it in `world-oil-gas/raw/manual/`, keep GEM's file name, delete the
   old one.
3. Run the build (the workflow, or
   `python3 -m scripts.shelf_atlas.build_world --out world-oil-gas/data --manual world-oil-gas/raw/manual --no-relief`)
   and commit the workbook with the regenerated `fields.json`.
4. If the build stops with "GOGET main sheet lacks …", GEM renamed a column:
   add the new header to `GOGET_COLS` in `scripts/shelf_atlas/build_world.py`.

`raw/manual/README.md` says the same in more detail. The `raw/` folder never
ships: the ZIP builder leaves it out.

## Making it yours

- **Units.** The app opens in SI: countries in TWh/yr (PWh to date), the
  source's own unit, and fields in standard cubic meters (`Sm³/d`, and
  `Sm³ o.e./d` for oil and gas together). One press on the units key gives
  kboe/d (Gboe to date) and the tracker's barrels (`bbl/d`, `boe/d`).
- **The color domains.** The log scale's ends per unit are the `dom` pairs
  in `COUNTRY` and `COUNTRY_CUM` in `js/units.js` (TWh/yr, kboe/d, PWh,
  Gboe); widen or narrow them if your interest is small producers.
- **The estimate.** How a field's disc moves with the year is one function
  (`estimate` in `js/data.js`): the reported rate scaled by its country's
  series, the ratio held between 0 and 3. Switch "Fields follow the year" off
  in Map layers to draw the tracker as it is, one rate per field.
- **The Ledger.** The strip under the map is `ledgerAt` in `js/data.js`; its
  1 % floor is `LEDGER_FLOOR`, and its rule for former states (counted until
  their largest member has a figure of its own) is `counted`. The map draws a
  former state over its successors by the same rule (`formerUnions`).
- **Shading.** Terrain shading (the relief on land) and Depth shading (the sea
  floor) are optional layers, off by default, drawn in gray; the land is plain
  by design so the color encodings read. Both come from gray images built by
  `world-oil-gas/tools/build_shade.py` (GEBCO_2026 and Natural Earth I, about
  560 MB of downloads, pinned): widen its `REGIONS` for finer sea floor where
  you work, at about 0.3 kB per square degree of box in the ZIP (587 312 B
  for today's 2 017 square degrees). Keep
  `--no-relief` on the yearly build: the shading replaces `relief.jpg`.
- **Outlines.** The tracker's own field outlines are drawn at high zoom. The
  build drops the ones that are not in degrees (Poland's are in a projected
  grid) or sit a degree from their unit; the rule is in `goget_units_to_file`.
