# Setting up Running Dashboard

Paste this whole file into a coding-agent session that has this repository open — **your own
copy**, made with *Use this template*, never the template itself. The agent does the typing; the
person sitting at the keyboard does the parts only they can do (their password, their MFA code).
Read it together before starting.

## What this app is

Running Dashboard is five panes — Now, Plan, Training, Health, Sessions — built
from your Garmin Connect data. The copy you just installed still holds made-up demo data (the app
says so on screen, in a visible "example text" label). This guide replaces that with your own.

## Before you start

- You are working in **your** copy of this repository, not the template. If `gh repo view` shows
  the template's own name (`snuggery-apps-template`) rather than a repository you own, stop and
  make your copy first with *Use this template*.
- Python 3.10 or newer (`python3 --version`). A Mac's built-in Python is often too old;
  `brew install python@3.12` if so.
- `gh auth status` should show you signed in. If not, `gh auth login` first.
- Set the repository once, and reuse it below:
  ```
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
  ```

## Step 1 — your heart-rate zones

Open `garmin-raw/context.json` and edit `athlete` to your own numbers: `maxHr`, `restingHr`,
`lthr`, the five `zoneFloors`, `weightKg`, `heightCm`. Nothing pulls these for you — every zone
chart in the app depends on what you put here, so do this before the first pull. Leave `gear: []`
and `garminNow: {}` alone; the pull fills those in.

## Step 2 — sign in once

```
pip install -r scripts/requirements.txt
python3 scripts/garmin_pull.py --login
```

The script asks for the email, the password (not shown as it is typed) and the MFA code in the
terminal. **The person types all three.** Run this in the foreground and let them answer the
prompts directly — the agent must not automate the MFA step, and must never see, echo, log, or
store the password anywhere. Do not put the password on a command line or in an environment
variable the agent sets: it would land in shell history and in this session's transcript. If it
asks `Garmin MFA code:`, that is the person's phone, not yours. Success looks like a line saying
the tokens were stored (in `~/.garminconnect`, outside the repository).

## Step 3 — the secret

Store the session tokens as a GitHub Actions secret, in one pipe so the token itself never
touches a file, a terminal scrollback you keep, or a chat log:

```
python3 scripts/garmin_pull.py --export-tokens | grep '^{' | gh secret set GARMINTOKENS --repo "$REPO"
```

**Never print, log, commit or paste that token line anywhere except into this one command.** It is
a live Garmin session credential. `gh secret list --repo "$REPO"` should now show `GARMINTOKENS`.

## Step 4 — the first pull, with a backfill

Before this step, confirm the repository is private — `gh repo view "$REPO" --json visibility
-q .visibility` must print `PRIVATE`. The pull commits per-second GPS traces of every run (most
start at someone's front door), resting heart rate, sleep and HRV, and a public repository's
history cannot be unpublished.

```
gh workflow run pull-running-dashboard.yml --repo "$REPO" -f streams=20
gh run watch
```

This run replaces the demo data: it deletes the `demo-*.json` stream files and rewrites
`running-dashboard/data/snapshot.json` from your own activities. It takes a few minutes — the record
streams are the slow part. Success is every step reading `ok` (and `"ok": true` at the end) in the
receipt the last workflow step prints. If a step is not `ok`, stop and report its exact text
rather than re-running blind.

## Step 5 — the clock

This workflow only ever runs when something asks it to (`workflow_dispatch`); nothing here runs it
on a schedule by itself. Read `scheduler/README.md` and pick a clock — it lays out the options,
what each costs, and what was actually measured. Whichever you choose sends a `POST` to:

```
https://api.github.com/repos/OWNER/REPO/actions/workflows/pull-running-dashboard.yml/dispatches
```

with a token scoped to **Actions: Read and write** on this repository only, nothing more.

## Step 6 — onto the phone

1. Open the raw address of `zips/running-dashboard.zip` in Safari → Share → Snuggery, to install it.
2. In your loop shortcut's Dictionary, add one row: key `Running Dashboard`, value the raw address of
   `running-dashboard/data/snapshot.json`. If the repository is private, the shortcut's fetch needs
   headers `Authorization: Bearer <your read token>` and `Accept: application/vnd.github.raw`.
3. In your rebuild shortcut's Dictionary, add the matching row: `job` =
   `https://api.github.com/repos/$REPO/actions/workflows/pull-running-dashboard.yml/dispatches`,
   `data` = the same snapshot address as above.

## Step 7 — the map and your tile agent

Map tiles come from Kartverket (Norway), USGS The National Map (the United States) and
OpenStreetMap (everywhere else), chosen automatically per route: each source answers only inside
its coverage and the script falls through to the next. Before your first real pull, set
`TILE_AGENT` near the top of `scripts/garmin_pull.py` to your own repository's URL — OpenStreetMap's
tile usage policy asks for an identifying User-Agent, and a generic one is a bad neighbour to the
people who run those servers for free.

Tiles only reach your phone when `zips/running-dashboard.zip` is rebuilt (a code change, not a data
pull), so a very recent run may draw its route with no basemap underneath until the next rebuild —
that is expected, not a bug. If you pull a lot of routes, consider pointing `TILE_SOURCES` at your
own tile provider instead.

## Optional: the coaching text

Four files — `garmin-raw/assessment.json`, `plan.json`, `racecast.json`, `notes.json` — hold a
written evaluation of your training: what the recent block looks like, a plan for the next weeks,
a race forecast, notes per session. **The pull above never writes these.** They exist because a
separate, optional daily agent session reads what the pull just pushed and writes them itself —
that is a different job from this one, and you set it up separately if you want it. Until you do,
the panes that would show this text say so plainly instead of showing nothing. The shape each file
should take is documented in the header comment at the top of `running-dashboard/app.js`.

## Do not touch

- The four coaching files above — they belong to the optional daily session, not to this pull.
- `running-dashboard/app.js`, `style.css`, `index.html` — the app itself. Change the data, not the code.
- The `GARMINTOKENS` secret's value, once set, except by running Step 3 again.

## If something fails

Stop and report the exact error text rather than working around it — whoever set this up (or the
agent session that wrote the scripts) needs the real message, not a guess.

**The 404-not-401 trap.** If `GARMINTOKENS` has gone stale, a run can still print a `200` with a
body that looks like JSON but is actually GitHub's or Garmin's error page — not a clean `401`. The
shortcut on the phone will happily write that over good data if you are not watching the receipt.
Check `garmin-raw/pull.json` after any run you did not watch closely.

If sign-in starts failing, redo Steps 2 and 3: run `--login` again, then re-export and re-set the
secret. Session tokens expire; this is expected occasionally, not a sign anything is broken.
