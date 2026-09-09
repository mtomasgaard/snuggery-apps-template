# Snuggery live apps

One repository holding every mini-app whose data refreshes on a schedule, and the
jobs that refresh them.

The loop, once it is running: a GitHub Action rewrites a small JSON file here →
a Shortcut on your phone copies that file into the app → you open the app and
see today's numbers. Snuggery itself never goes online.

**Click *Use this template* to make your own copy, and make it private** if any
app here will ever hold something personal. A repository is as private as its
most sensitive file, git history cannot be un-published, and it is easier to
start private than to remember to switch before the wrong commit.

---

## Setting up: once ever, then once per app

Most of the work happens exactly once. Keeping the two lists apart is the whole
point of this page, because the first app looks like an afternoon and the fifth
is genuinely one line.

### Once, ever

1. **This repository** — *Use this template*, private.
2. **A token**, if the repo is private — github.com/settings/personal-access-tokens →
   fine-grained → this repository only → **Contents: Read-only**. Give it a long
   expiry and write the date at the bottom of this file.
3. **One shortcut** on your phone, holding a Dictionary of *app name → data
   address* and a *Repeat with Each*. The recipe is below.
4. **One automation** that runs it — Shortcuts → Automation → Time of Day →
   Run Immediately.

### Every new app

1. **Ask an agent to build it**, in a session attached to this repository.
2. **Install it once** — open its `zips/<app>.zip` address in Safari → Share → Snuggery.
3. **Add one row** to the Dictionary in your shortcut: display name → data address.

That is the whole per-app cost. Nothing else changes, ever.

---

## Layout

```
<app-folder>/            one folder per app, named however you like
  index.html             the whole app: inline CSS and JS, no build step
  miniapp.json           display name and entry point
  data/snapshot.json     THE ONLY FILE THAT CHANGES
scripts/                 one refresh script per app
.github/workflows/       one refresh workflow per app, plus the ZIP builder
zips/<app-folder>.zip    built automatically; this is what you install from
```

`hello-live/` is a complete working example that depends on no external service.
Install it and run your shortcut against it before building anything real — if it
updates, your loop works, and any later problem is in the new app rather than in
the setup.

## Conventions worth keeping

- **Everything that changes lives in `data/snapshot.json`.** The HTML and JS
  should go untouched for months while the data is replaced daily.
- **Document the JSON's shape in a comment at the top of the app's script.**
  Whatever rewrites that file next year will not have read the conversation that
  created it.
- **Carry a `generatedAt` timestamp and show it.** A dashboard that cannot tell
  you how old it is will quietly show you last week.
- **Fail loudly.** If the file is missing, unparseable, or the wrong shape, say
  so on screen. Never draw an empty chart as though it were data — a plausible
  blank dashboard is worse than an error, because it gets believed.
- **Re-read on `visibilitychange`.** Reads are fresh from disk, so this one line
  is what makes an app opened this morning show this morning's numbers.

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

One shortcut refreshes every app here.

1. **Dictionary** — one row per app: key = the app's display name, value = the
   raw address of its `data/snapshot.json`.
2. **Repeat with Each**, over that dictionary. Inside it, two actions:
   - **Get Contents of URL** → `Repeat Item ▸ Value`.
     If the repo is private, add a header: `Authorization` = `Bearer <token>`,
     and `Accept` = `application/vnd.github.raw`.
   - **Update a File in a Snuggery App** → leave **App** empty, set
     **App name** to `Repeat Item ▸ Key`, set **Text instead of a file** to the
     output of *Get Contents of URL*, leave **Path in the app** empty.

Two field traps, both of which everyone hits once:

- The fetched JSON goes in **Text instead of a file**, never **File**. A web
  address returning JSON hands Shortcuts a *dictionary*, and the File field
  refuses it.
- **App** is a picker and will not take a variable. That is exactly why
  **App name** exists — it is a text field, so a loop can fill it.

Shortcuts stops at the first action that fails, so a deleted app halts the rest
of the chain.

---

## Token expiry

| Token | Scope | Expires |
| --- | --- | --- |
| _(name it here)_ | Contents: Read on this repo | _(write the date here)_ |

When it lapses, every app in this repository takes a 404 body over its data on
the same run. This table is the cheapest possible defence against that.
