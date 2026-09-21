# Setting up Power Hours

Paste this whole file into a coding-agent session that has this repository open
— **your own copy**, made with *Use this template*, never the template itself.
The agent does the typing.

## What this app is

Power Hours shows the day-ahead electricity price for one bidding zone, hour by
hour, for today and — from the early afternoon onwards — tomorrow. Under the
chart it lists your appliances and, for each one, the cheapest contiguous
window long enough to run it: start and end, the average price in that window,
and how much below the day's mean it is.

It ships working, pointed at **NO2** (southern Norway), with a real pull of
public prices. If that is your zone, there is nothing to set up but the
Shortcut row. If it is not, there is one line to change.

## Before you start

- You are working in **your** copy of this repository. If
  `gh repo view --json nameWithOwner -q .nameWithOwner` shows
  `snuggery-apps-template`, stop and make your copy first.
- Python 3.10 or newer (`python3 --version`). No packages to install — the
  script is standard library only.
- Set the repository once and reuse it:
  ```
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
  ```

## Step 1 — pick your bidding zone

**Read `power-hours/NOTES.md` first.** The licence is not the same for every
zone: sixteen are CC BY 4.0 and may be published, the other forty-one are
private and internal use only. The sixteen are

> AT, BE, CH, CZ, DE-LU, DE-AT-LU, DK1, DK2, FR, HU, IT-North, NL, **NO2**, PL,
> SE4, SI

and the full list of zones the API offers is in NOTES.md.

Change one line at the top of `scripts/power_hours.py`:

```python
ZONE = "NO2"        # ← your zone
```

If your zone is **not** on the CC BY list, the script refuses to run until you
pass `--private-use`, and that flag also makes the app print, on screen, that
the prices must not be republished. Only do this in a **private** repository —
the prices would otherwise be republished by the repository itself, which is
what the licence forbids. A repository is as private as its most sensitive
file, and git history cannot be un-published.

Zone codes like `DE-LU` and `IT-North` contain characters a shell will not like
unquoted; keep them quoted when you pass `--zone` on the command line.

Then run it and look at what came back:

```
python3 scripts/power_hours.py
```

It prints how many intervals it got for each day and how many `ask` rows it
wrote. `Tomorrow …: no prices published` before about 13:00 CET is the normal
state of the world, not a failure — the auction has not run yet.

## Step 2 — your appliances

Edit `power-hours/data/appliances.json`:

```json
{
  "schema": 1,
  "appliances": [
    { "name": "Dishwasher", "hours": 2 },
    { "name": "Heat pump top-up", "hours": 6 }
  ]
}
```

`hours` is how long the thing runs; fractions are fine (`1.5` is ninety
minutes). Anything from a 45-minute oven to an 8-hour car charge works, as long
as it is shorter than a day.

**You can also edit this on the phone** — in Snuggery, the app's ⋯ menu →
*App Files* → `data/appliances.json`. The refresh never overwrites it, so an
edit there survives every data refresh. The one thing to know: the app follows
the phone's copy at once, while the `ask` table (what Snuggery's *Ask About
This Data* reads) is written by the job from the repository's copy. Change it
in both if you want them to agree.

## Step 3 — the clock

`.github/workflows/refresh-power-hours.yml` runs at **13:30 and 16:30 UTC**,
plus `workflow_dispatch`. Both are after the day-ahead auction publishes
tomorrow's curve, at about 13:00 CET; the second run is a second chance,
because the service has had outages. There is no point running it hourly — the
auction only happens once a day.

Two things that cost an afternoon if nobody says them:

- **`schedule:` only runs from the default branch.** A workflow on a
  pull-request branch is inert however correct it is. Merge to `main` first.
- **Triggering by hand proves the job, not the schedule.** The only evidence
  the *schedule* works is a run whose trigger reads `schedule`:
  ```
  gh api "repos/$REPO/actions/runs?event=schedule" --jq .total_count
  ```
  Check it once, on the day you set this up.

Prove the job now:

```
gh workflow run refresh-power-hours.yml --repo "$REPO"
gh run watch
```

## Step 4 — onto the phone

1. Open the raw address of `zips/power-hours.zip` in Safari → Share → Snuggery,
   to install it.
2. In your loop shortcut's Dictionary, add one row: key `Power Hours`, value
   the raw address of `power-hours/data/snapshot.json`. If the repository is
   private, the fetch needs headers `Authorization: Bearer <your read token>`
   and `Accept: application/vnd.github.raw`.
3. In your rebuild shortcut's Dictionary, add the matching row:
   ```
   job  = https://api.github.com/repos/OWNER/REPO/actions/workflows/refresh-power-hours.yml/dispatches
   data = the same snapshot address as above
   ```
   (`OWNER/REPO` is what `$REPO` printed.)

## Making it yours

Some things worth changing, in rough order of how often people want them:

- **The appliances** — step 2. This is the whole point of the app.
- **The zone** — step 1, and mind the licence.
- **The unit.** The snapshot keeps the source's EUR/MWh; the app shows
  euro-cents per kWh. If your tariff is quoted in øre, kronor or something
  else, the conversion is one function — `units()` near the top of `app.js`.
  Whatever you do, keep the "spot price only, before grid rent and tax" line:
  the number is not the bill, and an app that implies it is will be believed.
- **More days.** The script asks for today and tomorrow. Energy-Charts serves
  history too (`start`/`end` accept plain dates), so a week back is a small
  change to the `wanted` list — the app groups by day and grows tabs by itself.
- **A second zone.** Two zones means two snapshots and two apps, which is
  simpler than it sounds: copy the folder, change `ZONE` and the `name` in
  `miniapp.json`, add a workflow.

## Do not touch

- The attribution line in the app's footer. CC BY 4.0 asks for it, and it comes
  out of the snapshot — removing it is removing the thing that makes the data
  usable.
- The rate-limiting in `scripts/power_hours.py`. Two requests a run, a second
  apart, honouring `Retry-After`. The service is free and run by a research
  institute.

## If something fails

Stop and report the exact error text rather than working around it.

**The 404-is-not-an-error trap.** `no prices published for <date>` on tomorrow
is normal before the afternoon auction. The app shows today only and says why.

**The written-over-by-an-error-page trap.** If a Shortcut's fetch returns an
error page — an expired token most often — that page is frequently valid JSON,
and the Shortcut writes it straight over `data/snapshot.json`. The app then
says *This app cannot read its data* and names what is missing. Open the file
in Snuggery (⋯ → App Files) and look at what is actually in it before changing
any code.

**A missed refresh does not break anything.** If a run fetches nothing at all,
the script keeps the previous curve in the snapshot's `lastGood` and the app
draws it with a stale stamp and a line saying so — never an error where a price
used to be.
