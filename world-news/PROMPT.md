# Setting up World News

Paste this whole file into a coding-agent session that has this repository open
— **your own copy**, made with *Use this template*, never the template itself.
The agent does the typing; you decide which parts of the world you care about.

## What this app is

Six sections — Europe, Americas, Africa, Middle East, Asia, Oceania — each
holding eight of today's headlines, with the publisher, the time, a byline
where the feed gives one, and the feed's own summary line where its licence
allows one to be shortened. The feeds are the ones whose terms permit a
headline to be taken out of a feed and republished with credit: most large
broadcasters', including the BBC's, do not, and `world-news/NOTES.md` quotes
the sentence that rules each one out.
A GitHub Action rebuilds `world-news/data/snapshot.json` once a day; your loop
shortcut copies that file onto your phone; the app draws it.

**Every headline is a link out.** A Snuggery mini-app cannot reach the network
— it can read only the files inside its own folder — so tapping a headline
hands the address to your browser (`target="_blank"`) rather than opening the
story in the app. That is a property of the sandbox, not a shortcut taken here,
and it is why the app stores a summary line at all: the summary is the only
part of a story you can read without leaving.

**It already works.** Unlike most apps here, this one needs no account, no key
and no secret. The copy you installed holds real headlines from the day it was
built, and the workflow starts refreshing them the moment it lands on your
default branch.

## Before you start

- You are working in **your** copy, not the template. If `gh repo view` prints
  `snuggery-apps-template`, stop and make your copy first.
- Python 3.10 or newer (`python3 --version`). The script uses the standard
  library only — nothing to install.
- Set the repository once and reuse it:
  ```
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
  ```

## Step 1 — prove the pull works from your machine

```
python3 scripts/world_news.py
```

It prints one line per feed and then a summary. A feed or two failing is normal
and is the point of the design: a failed feed keeps its headlines from the last
snapshot and marks them **cached**, so a section shows yesterday with a marker
rather than an error. Only if *every* feed fails does the script refuse to
write, leaving the good snapshot alone.

To rehearse that outage path without touching your data:

```
python3 scripts/world_news.py --demo --out /tmp/world-news-demo.json
```

That fetches nothing, rebuilds from the committed snapshot with every headline
marked stale, and writes somewhere harmless. Point a local server at a copy of
the folder to see what the stale state looks like.

## Step 2 — make the regions yours

Everything you would want to change is in one list at the top of
`scripts/world_news.py`:

- **`REGIONS`** — the sections, and the order they are drawn in. Rename them,
  drop one, split "Americas" into North and South. The app draws whatever is
  in the file; nothing in `app.js` knows these names.
- **`FEEDS`** — `(id, region key, source name, url, verbatim)`. Add a feed by
  adding a row. The `id` is what the cache is keyed on, so keep it stable.
  `verbatim` is a **licence** flag, not a formatting one: `True` means the
  source forbids derivative works, so its headline is carried exactly as
  written rather than cut at `TITLE_CHARS`, and no summary line of theirs is
  carried at all. `False` means the licence permits a shortened line.
- **`SOURCES`** — one entry per source name, holding the attribution and
  licence line the app prints in its footer. **A new source needs a row here**,
  or its headlines appear with no credit.
- **`ITEMS_PER_REGION`** — 8 by default. Six regions × eight headlines is 48
  `ask` rows, comfortably under the ceiling the script enforces (60). Raising
  this past ten will trip that check, on purpose.

A region's feeds **take turns** rather than competing on recency, so a
publisher posting fifty items a day cannot fill a section a slower regional
source should be in. That is worth knowing before you wonder why your newest
feed contributes only three of the eight.

**Read `world-news/NOTES.md` before adding a feed.** It records the terms of
every feed used here, and — more usefully — the nine deliberately left out,
with the sentence that rules each one out. The point most people miss: this
script is not a feed reader. It pulls a feed apart, keeps four fields, re-sorts
them, merges them with other publishers and commits the result in a public
repository. A very large number of RSS terms permit a feed *widget* while
forbidding exactly that — the BBC's current terms say "you're not allowed to
pluck metadata from our content or RSS feeds" and "you don't change the RSS
feed", which is why the BBC is not in this app.

If your copy is **private**, most of those become usable again — your snapshot
is a personal copy rather than a website. If it is public, they are not. Either
way the licence line you add to `SOURCES` is what the app prints, so make it
true, and set `verbatim=True` if the licence says no derivatives.

A feed you add should be regional, keyless, and answer a plain
`curl -A "your-repo-url" <feed>` before it goes in the list. Run
`python3 scripts/world_news.py --selftest` afterwards: it checks, without
fetching anything, that Atom links resolve to the story rather than to the feed
file, that a `verbatim` source contributes no summary, and that the 8 MB read
ceiling and the XML-entity refusal still hold.

## Step 3 — the clock

`.github/workflows/refresh-world-news.yml` runs at **05:20 UTC** daily, plus
`workflow_dispatch`. Two things that will cost you an afternoon if nobody says
them:

- **`schedule:` only runs from the default branch.** A workflow on a pull
  request branch is inert however correct it is.
- **GitHub cron is best-effort.** Late by 5–20 minutes is normal, and a newly
  added schedule often skips its first slot entirely.

Prove the job (not the schedule) once by hand:

```
gh workflow run refresh-world-news.yml --repo "$REPO"
gh run watch
```

Then check, a day later, that the *schedule* has actually fired — a manual run
proves nothing about it:

```
gh api "repos/$REPO/actions/runs?event=schedule" --jq .total_count
```

If you would rather it landed at a time you chose, `scheduler/README.md` lays
out the alternatives and what each costs.

## Step 4 — onto the phone

1. Open the raw address of `zips/world-news.zip` in Safari → Share → Snuggery.
2. In your **loop** shortcut's Dictionary, add one row:
   key `World News`, value the raw address of
   `world-news/data/snapshot.json`. If your repository is private, the fetch
   needs headers `Authorization: Bearer <your read token>` and
   `Accept: application/vnd.github.raw`.
3. In your **rebuild** shortcut's Dictionary, add the matching row — key
   `World News`, value a Dictionary with:
   - `job` = `https://api.github.com/repos/OWNER/REPO/actions/workflows/refresh-world-news.yml/dispatches`
   - `data` = the same snapshot address as above.

That second row is what makes the app's ⋯ → *Rebuild Data Now* work: one tap
runs the job and pulls the result back.

## Step 5 — asking about it

The snapshot carries a top-level `ask` array: one flat row per headline, with
`region`, `source`, `title` and `published`. Snuggery's *Ask About This Data*
reads that key and nothing else, so questions like "how many headlines are
from Africa today?" or "which source appears most often?" are counted from the
rows rather than guessed. Adding a region or a source keeps working without
touching anything — the rows are built from whatever was drawn.

## Do not touch

- `world-news/app.js`, `style.css`, `index.html` — the app. Change the data and
  the feed list, not the code.
- The attribution and licence lines the app prints, and the `verbatim` flags
  in `FEEDS`. They are the condition on which the feeds may be shown at all.

## If something fails

Report the exact error text rather than working around it.

**The 404-not-401 trap.** If the token in your shortcut expires, the fetch
still returns a body, and that body is valid JSON — GitHub's error envelope.
The shortcut will write it over your good data without complaining. The app
notices: it says the file is not the shape it expects and names the missing
field, instead of drawing an empty page. If you see that message, look at
`data/snapshot.json` in Snuggery — Options ⋯ → App Files.
