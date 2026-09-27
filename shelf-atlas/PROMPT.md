# Setting up Shelf Atlas

Paste this whole file into a coding-agent session that has this repository open
— **your own copy**, made with *Use this template*, never the template itself.
The agent does the typing.

## What this app is

Shelf Atlas is the North Sea and the Norwegian shelf as the four regulators
publish it: 1,200 field outlines, 2,100 platforms and subsea structures, 1,300
pipelines, the maritime boundaries and the seabed, with a monthly player from
1971 to the newest reported month. A circle on each producing field carries
its rate that month, or its volume to date in cumulative mode; tap it for the
operator, discovery year, status history and a sparkline of its whole life.
The data is fetched from Sodir, the NSTA, the Danish Energy Agency, GEUS and
NLOG, none of which needs a key or an account.

It ships working, with a real build in it. There is nothing to decide before
the Shortcut row; the choices below are for making it yours.

## Before you start

- You are working in **your** copy of this repository. If
  `gh repo view --json nameWithOwner -q .nameWithOwner` shows
  `snuggery-apps-template`, stop and make your copy first.
- Python 3.10 or newer and five packages, for a local build only (the
  workflow installs the same ones):
  ```
  python3 -m pip install 'pyshp>=2.3' 'openpyxl>=3.1' 'pypdf>=4' 'numpy>=2' 'tifffile>=2024'
  ```
- Set the repository once and reuse it:
  ```
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
  ```
- **Read `shelf-atlas/NOTES.md` first.** It carries the terms the app must
  print on screen, and one of them (the UK's) forbids commercial use of the
  app and its data.

## Step 1 — the clock

`.github/workflows/build-shelf-atlas.yml` runs **on Mondays** (`41 5 * * 1`,
early European morning) and on demand. The regulators publish monthly, so
weekly is already generous; the build fetches about 40 MB, takes 5–15 minutes,
and commits `shelf-atlas/data/*` only when the content changed, so a week
with no new month commits nothing.

Two things that cost an afternoon if nobody says them:

- **`schedule:` only runs from the default branch.** Merge to `main` first.
- **Triggering by hand proves the job, not the schedule.** The only evidence
  the *schedule* works is a run whose trigger reads `schedule`:
  ```
  gh api "repos/$REPO/actions/runs?event=schedule" --jq .total_count
  ```

If you run an external clock (`scheduler/README.md`), add
`build-shelf-atlas.yml` to its workflow list; a daily dispatch is fine, the
job stops early when nothing changed.

Prove the job now:

```
gh workflow run build-shelf-atlas.yml --repo "$REPO"
gh run watch
```

The workflow takes two inputs when run by hand: `countries` (default
`NO,UK,DK,NL`; fewer to debug one regulator) and `refresh` (ignore the week's
download cache).

## Step 2 — onto the phone

1. Open the raw address of `zips/shelf-atlas.zip` in Safari → Share →
   Snuggery, to install it.
2. In your loop shortcut's Dictionary, add one row: key `Shelf Atlas`, value
   `https://raw.githubusercontent.com/OWNER/REPO/main/shelf-atlas/data/snapshot.json`
   (`OWNER/REPO` is what `$REPO` printed; a private repository needs the
   `Authorization` and `Accept` headers the README describes).
3. In your rebuild shortcut's Dictionary, add the matching row:
   ```
   job  = https://api.github.com/repos/OWNER/REPO/actions/workflows/build-shelf-atlas.yml/dispatches
   data = the same data address as above
   ```
   Give its *Wait* step ten minutes rather than the usual minute and a half:
   this build fetches from four regulators.

**The loop refreshes `data/snapshot.json` only**, which is the file with the
figures. The outlines, pipelines and depth raster (`geo.json`, `bathy.png`)
change a few times a year; when the build commits a new `geo.json`, the ZIP
is rebuilt, and the app picks the new outlines up when you replace it (Safari
→ the ZIP's address → Share → Snuggery → **Replace the app**). Until then a
new field is drawn as a point at the regulator's field centre.

## Making it yours

In rough order of how often people want them:

- **Fewer countries.** `--countries NO` (or any subset) on the build, or the
  workflow's `countries` input. The app's country chips follow whatever the
  snapshot carries.
- **A different box.** `BBOX` in `scripts/shelf_atlas/build_north_sea.py`
  is `[-6, 50.5, 32, 73]`, the whole Norwegian shelf; `HOME` in `app.js` is
  the North Sea proper, where the map opens. Narrow the box to shrink the
  files; nothing outside it is fetched into `geo.json`.
- **Cross-border fields.** `CROSS_BORDER` in `build_north_sea.py` lists the
  units grouped across a median line with their published shares. Add a
  field there only when the split is published; otherwise it is listed under
  `snapshot.matching` and drawn twice, on purpose.
- **Simplification and budgets.** The Visvalingam thresholds and the file
  budgets are constants at the top of `build_north_sea.py`; the build fails
  rather than ship over budget.
- **What the sheet says.** Every honesty note (Danish delineations, series
  that start late, uneven newest month) is a string in `app.js`, next to the
  rule that triggers it.

If a regulator moves a file, the build stops with a `BUILD FAILED:` line
naming the table and what it found. `.github/workflows/probe-shelf-atlas.yml`
prints what any URL serves now; `RESEARCH.md` §3 lists what has already
moved once.
