#!/usr/bin/env python3
"""Rewrite world-news/data/snapshot.json from public broadcasters' RSS feeds.

Standard library only — urllib for the fetch, xml.etree for the parse. Nothing
here needs a key, an account or a token, so the workflow that runs it needs no
secret and your own copy works the moment you fork it.

THE SHAPE IT WRITES  (the app reads exactly this; app.js documents it too)

  {
    "schema": 1,
    "generatedAt": "2026-09-21T05:20:11Z",      ISO 8601 UTC. Required.
    "regions": [                                 six, in a fixed order
      {"key": "europe", "name": "Europe",
       "stale": false,                           true when every item is cached
       "items": [                                5-8 of them, newest first
         {"title": "...",                        plain text, trimmed
          "source": "Global Voices",             who published it
          "feed": "gv-western-europe",           which feed it arrived on
          "link": "https://...",                 opens in the reader's browser
          "published": "2026-09-21T08:56:27Z",   ISO 8601 UTC
          "summary": "...",                      the feed's own line, when given
          "author": "...",                       when the feed names one
          "stale": false}                        true when kept from a failed run
       ]}
    ],
    "sources": [                                 attribution the terms ask for
      {"name": "Global Voices", "attribution": "...", "licence": "...",
       "terms": "https://..."}
    ],
    "feeds": [                                   one row per feed, this run
      {"id": "gv-western-europe", "source": "Global Voices",
       "region": "Europe", "ok": true, "items": 8, "note": null}
    ],
    "ask": [                                     one row per headline, <= 60
      {"region": "Europe", "source": "Global Voices", "title": "...",
       "published": "2026-09-21 08:56 UTC"}
    ]
  }

CACHING.  A feed that times out, 404s or answers with something that is not a
feed does not sink the run: its headlines from the previous snapshot are kept
and marked `stale`, so the app shows yesterday's Europe with a marker rather
than an empty section. If every feed in a region fails, the region says so.

TERMS.  Every feed here is public, keyless, and carries terms that allow a
headline, its link and - where the licence permits a trimmed line - the feed's
own summary to be shown with credit.  world-news/NOTES.md records each one and
what it asks for.  Read it before you add a feed: most large broadcasters' RSS
terms permit personal use only, or forbid taking the feed apart at all, which
is exactly what this script does and what a public repository's committed
snapshot publishes.  A feed marked `verbatim` in FEEDS is one whose licence
forbids derivative works: its headline is carried as written, never trimmed,
and its summary line is not carried at all.

LIMITS.  A feed is an untrusted answer from another machine, so this script
bounds what one can cost: at most MAX_FEED_BYTES is read, the same ceiling
applies to whatever a compressed body expands to, and a document that declares
its own XML entities is refused unparsed.  These are absolute limits, not
ratios - a small body that expands to gigabytes is the attack, and a ratio
would refuse ordinary files while still permitting it.
"""

import argparse
import datetime as dt
import email.utils
import gzip
import html
import io
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zlib

# --------------------------------------------------------------------------
# What is fetched
# --------------------------------------------------------------------------

# A feed operator running a free service is owed an honest, identifiable
# caller. Inside GitHub Actions the runner already knows which repository this
# is, so the agent names YOUR copy without anybody editing a constant - which
# is what a template wants, since a hard-coded owner would be wrong for every
# copy but one. Run by hand, it says so rather than inventing an address.
_REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "").strip()
USER_AGENT = (
    f"snuggery-live-apps/1.0 (+https://github.com/{_REPOSITORY})" if _REPOSITORY
    else "snuggery-live-apps/1.0 (personal dashboard, local run)"
)

FEED_TIMEOUT = 20          # seconds, per feed
MAX_FEED_BYTES = 8 * 1024 * 1024   # a feed is somebody else's machine answering
ITEMS_PER_REGION = 8       # 6 regions x 8 = 48 ask rows, under the 60 ceiling
SUMMARY_CHARS = 220
TITLE_CHARS = 180
AUTHOR_CHARS = 160         # a byline can carry an institution; that is credit

REGIONS = [
    ("europe", "Europe"),
    ("americas", "Americas"),
    ("africa", "Africa"),
    ("middle-east", "Middle East"),
    ("asia", "Asia"),
    ("oceania", "Oceania"),
]

# id, region key, source name, url, verbatim
#
# `verbatim` is the licence flag, not a formatting preference. True means the
# source's licence forbids derivative works, so nothing of theirs is reshaped:
# the headline is carried exactly as written rather than cut at TITLE_CHARS,
# and the summary line is not carried at all. False means the licence permits
# a trimmed line, which is what the app shows under the headline.
#
# NOT HERE, DELIBERATELY: every large broadcaster read on 2026-09-21, including
# the BBC. world-news/NOTES.md names each one and quotes the sentence that
# rules it out. Read it before you add a row.
FEEDS = [
    ("gv-western-europe", "europe", "Global Voices",
     "https://globalvoices.org/-/world/western-europe/feed/", False),
    ("gv-eastern-europe", "europe", "Global Voices",
     "https://globalvoices.org/-/world/eastern-central-europe/feed/", False),
    ("un-europe", "europe", "UN News",
     "https://news.un.org/feed/subscribe/en/news/region/europe/feed/rss.xml", False),

    ("gv-latin-america", "americas", "Global Voices",
     "https://globalvoices.org/-/world/latin-america/feed/", False),
    ("un-americas", "americas", "UN News",
     "https://news.un.org/feed/subscribe/en/news/region/americas/feed/rss.xml", False),
    ("tc-us", "americas", "The Conversation",
     "https://theconversation.com/us/articles.atom", True),

    ("gv-africa", "africa", "Global Voices",
     "https://globalvoices.org/-/world/sub-saharan-africa/feed/", False),
    ("un-africa", "africa", "UN News",
     "https://news.un.org/feed/subscribe/en/news/region/africa/feed/rss.xml", False),
    ("tc-africa", "africa", "The Conversation",
     "https://theconversation.com/africa/articles.atom", True),

    ("gv-west-asia", "middle-east", "Global Voices",
     "https://globalvoices.org/-/world/middle-east-north-africa/feed/", False),
    ("un-middle-east", "middle-east", "UN News",
     "https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml", False),

    ("gv-east-asia", "asia", "Global Voices",
     "https://globalvoices.org/-/world/east-asia/feed/", False),
    ("gv-south-asia", "asia", "Global Voices",
     "https://globalvoices.org/-/world/south-asia/feed/", False),
    # The UN's regional desk here is "Asia-Pacific", so the occasional Pacific
    # story lands under Asia. It sat under Oceania until a review found Nepal
    # and Iran filed as Oceania headlines - and the ask table is what Snuggery
    # answers questions from, so a wrong region there is a wrong answer.
    ("un-asia-pacific", "asia", "UN News",
     "https://news.un.org/feed/subscribe/en/news/region/asia-pacific/feed/rss.xml", False),

    ("gv-oceania", "oceania", "Global Voices",
     "https://globalvoices.org/-/world/oceania/feed/", False),
    ("tc-au", "oceania", "The Conversation",
     "https://theconversation.com/au/articles.atom", True),
    ("tc-nz", "oceania", "The Conversation",
     "https://theconversation.com/nz/articles.atom", True),
]

# What each source's own terms ask to be shown. Kept short - the app prints
# these verbatim in its footer, and NOTES.md carries the long version.
SOURCES = {
    "Global Voices": {
        "attribution": "Headlines, summaries and links from Global Voices, "
                       "used under CC BY 3.0.",
        "licence": "Creative Commons Attribution 3.0 — credit the author, link "
                   "to the licence, and indicate changes: the summaries here "
                   "are the feed's own line, shortened.",
        "terms": "https://creativecommons.org/licenses/by/3.0/",
    },
    "UN News": {
        "attribution": "Headlines and links from UN News.",
        "licence": "UN terms of use: news-related material may be used as long "
                   "as appropriate credit is given and the United Nations is "
                   "advised.",
        "terms": "https://www.un.org/en/about-us/copyright",
    },
    "The Conversation": {
        "attribution": "Headlines, bylines and links from The Conversation.",
        "licence": "Creative Commons Attribution–NoDerivatives 4.0 — credit the "
                   "author and their institution and link back. Nothing of "
                   "theirs is changed here: the headline stands as written and "
                   "no article text is carried.",
        "terms": "https://theconversation.com/au/republishing-and-media",
    },
}

# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------

NS = {
    "rss1": "http://purl.org/rss/1.0/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "atom": "http://www.w3.org/2005/Atom",
}

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def clean(text, limit=None):
    """Feed text -> one plain-text line, trimmed only when a limit is given.

    Feeds put markup in <description> routinely, and some put a whole first
    paragraph there. Tags go, entities are resolved once, whitespace collapses,
    and the result is cut at a word boundary. Nothing here is a security
    control - the app escapes on the way in to the DOM - it is only tidiness.

    `limit=None` is the licence case: a source whose terms forbid derivative
    works gets its text carried as written, or not carried at all.
    """
    if not text:
        return ""
    out = html.unescape(TAG_RE.sub(" ", text))
    out = WS_RE.sub(" ", out).strip()
    if limit and len(out) > limit:
        cut = out[:limit].rsplit(" ", 1)[0].rstrip(" ,;:.—-")
        out = cut + "…"
    return out


def to_utc_iso(raw):
    """RFC 822 (pubDate) or ISO 8601 (dc:date, atom:updated) -> UTC ISO, or None."""
    if not raw:
        return None
    raw = raw.strip()
    try:
        when = email.utils.parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        when = None
    if when is None:
        try:
            when = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=dt.timezone.utc)
    return when.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def first_text(node, names):
    """The first usable value among several element paths.

    Atom links carry the address in an attribute rather than in text, and an
    entry may carry SEVERAL of them. Only rel="alternate" (or an unlabelled
    link, which Atom defines as alternate) is the story; rel="self" points at
    the feed file itself, and returning it would give every headline in that
    feed the same address. So a link element that declares some other rel is
    skipped rather than accepted.
    """
    for name in names:
        for found in node.findall(name, NS):
            href = found.get("href")
            if href:
                rel = (found.get("rel") or "alternate").strip().lower()
                if rel != "alternate":
                    continue
                return href
            if found.text and found.text.strip():
                return found.text.strip()
    return None


def http_link(value):
    """Only http(s) addresses are kept; anything else is dropped, not shown."""
    if not value:
        return None
    value = value.strip()
    return value if value.startswith(("http://", "https://")) else None


def link_key(url):
    """Two feeds carrying the same story with different tracking tails."""
    return url.split("?", 1)[0].split("#", 1)[0].rstrip("/").lower()


def title_key(title):
    return WS_RE.sub(" ", re.sub(r"[^\w\s]", "", title.lower())).strip()


# --------------------------------------------------------------------------
# Fetch and parse
# --------------------------------------------------------------------------

class FeedRefused(Exception):
    """The answer was rejected before it was parsed, and why."""


def _bounded(data, what):
    """MAX_FEED_BYTES + 1 bytes came back, so there was more. Refuse it.

    The ceiling is absolute, never a ratio of compressed to expanded size. A
    ratio would throw out ordinary files - 8 MB of repeated whitespace
    compresses about a thousandfold and is not an attack - while still letting
    through the thing it is meant to stop, because the attacker picks the
    ratio. What cannot be argued with is how many bytes this job will hold.
    """
    if len(data) > MAX_FEED_BYTES:
        raise FeedRefused(f"{what} over {MAX_FEED_BYTES // (1024 * 1024)} MB")
    return data


def fetch(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
    )
    with urllib.request.urlopen(request, timeout=FEED_TIMEOUT) as response:
        # read(n) and not read(): a feed is another machine's answer, and
        # Content-Length is that machine's claim rather than a promise.
        body = _bounded(response.read(MAX_FEED_BYTES + 1), "feed")
        encoding = (response.headers.get("Content-Encoding") or "").lower()
    # Some feeds answer gzipped whether or not it was asked for - news.un.org
    # did exactly that on one run here while its sibling feeds did not - and an
    # unhandled gzip body reads as "answer was not a feed". Trust the header
    # when it is there, and the magic bytes when it is not. Either way the
    # expansion is read through the same ceiling, because a few kilobytes of
    # zeros expand to as much memory as the runner will give them.
    if "gzip" in encoding or body[:2] == b"\x1f\x8b":
        with gzip.GzipFile(fileobj=io.BytesIO(body)) as unzipped:
            body = _bounded(unzipped.read(MAX_FEED_BYTES + 1), "gzip answer")
    elif "deflate" in encoding:
        body = _bounded(
            zlib.decompressobj(-zlib.MAX_WBITS)
                .decompress(body, MAX_FEED_BYTES + 1),
            "deflate answer")
    return body


# A document that defines its own entities can expand a few hundred bytes into
# gigabytes once a parser resolves them, and xml.etree resolves them. Python's
# own documentation lists it as vulnerable. Nothing legitimate in an RSS or
# Atom feed needs a custom entity, so the whole declaration block is refused
# rather than bounded - the cheapest decisive check, and one more absolute
# limit rather than a ratio.
DECLARATION_SCAN = 2048
ENTITY_MARKERS = (b"<!ENTITY", b"<!entity", b"<!DOCTYPE", b"<!doctype")


def parse(raw, feed_id, source, verbatim=False):
    """Bytes of RSS 2.0, RSS 1.0/RDF or Atom -> a list of item dicts.

    `verbatim` carries the source's licence into the parse: a source whose
    terms forbid derivative works keeps its headline exactly as written and
    contributes no summary line at all.
    """
    head = raw[:DECLARATION_SCAN]
    if any(marker in head for marker in ENTITY_MARKERS):
        raise FeedRefused("answer declared XML entities")
    root = ET.fromstring(raw)
    nodes = root.findall(".//item") or root.findall(".//rss1:item", NS) \
        or root.findall(".//atom:entry", NS)

    items = []
    for node in nodes:
        title = clean(first_text(node, ["title", "rss1:title", "atom:title"]),
                      None if verbatim else TITLE_CHARS)
        link = http_link(first_text(node, ["link", "rss1:link", "atom:link"]))
        if not title or not link:
            continue
        published = to_utc_iso(first_text(
            node, ["pubDate", "dc:date", "atom:updated", "atom:published"]))
        if not published:
            continue
        summary = "" if verbatim else clean(first_text(
            node, ["description", "rss1:description", "atom:summary"]),
            SUMMARY_CHARS)
        item = {
            "title": title,
            "source": source,
            "feed": feed_id,
            "link": link,
            "published": published,
            "summary": summary,
            "stale": False,
        }
        author = clean(first_text(node, ["dc:creator", "atom:author/atom:name"]),
                       AUTHOR_CHARS)
        if author:
            item["author"] = author
        items.append(item)
    return items


# --------------------------------------------------------------------------
# Building the snapshot
# --------------------------------------------------------------------------

def cached_items(previous):
    """feed id -> the items that feed contributed to the previous snapshot."""
    by_feed = {}
    for region in (previous or {}).get("regions", []):
        for item in region.get("items", []):
            by_feed.setdefault(item.get("feed"), []).append(item)
    return by_feed


def build(previous, offline=False):
    cache = cached_items(previous)
    by_region = {key: [] for key, _ in REGIONS}
    reports = []

    for feed_id, region_key, source, url, verbatim in FEEDS:
        items, note, ok = [], None, False
        if offline:
            note = "not fetched (--demo)"
        else:
            try:
                items = parse(fetch(url), feed_id, source, verbatim)
                if items:
                    ok = True
                else:
                    note = "answered, but held no usable items"
            except urllib.error.HTTPError as error:
                note = f"HTTP {error.code}"
            except FeedRefused as error:
                note = f"refused: {error}"
            except ET.ParseError:
                note = "answer was not a feed"
            except Exception as error:                     # noqa: BLE001
                # One bad feed must not sink the run. Anything at all - DNS,
                # TLS, a socket timeout, a redirect loop - falls back to cache.
                note = f"{type(error).__name__}: {error}"[:120]

        if not ok:
            items = [dict(item, stale=True) for item in cache.get(feed_id, [])]
            note = (note or "no answer") + (
                f"; kept {len(items)} cached" if items else "; nothing cached")

        by_region[region_key].extend(items)
        reports.append({
            "id": feed_id, "source": source,
            "region": dict(REGIONS)[region_key],
            "ok": ok, "items": len(items), "note": note,
        })
        print(f"  {'ok  ' if ok else 'FAIL'} {feed_id:<20} {len(items):>3} item(s)"
              + (f"  [{note}]" if note else ""), file=sys.stderr)

    # A region's feeds take turns rather than competing on recency alone.
    # Publishing rates here differ by more than an order of magnitude - an
    # academic network posts fifty items a day, a citizen-media site a handful
    # a week, a UN desk somewhere between - so a plain newest-first sort hands
    # a whole section to whoever posts most often. Then the section is about
    # one newsroom instead of about a place, which is the same defect as
    # filing a feed under the wrong region: the ask table says "Americas" and
    # the rows are one publisher's view of it.
    feed_order = {row[0]: n for n, row in enumerate(FEEDS)}

    regions, ask = [], []
    for key, name in REGIONS:
        queues = {}
        for item in by_region[key]:
            queues.setdefault(item["feed"], []).append(item)
        for queue in queues.values():
            queue.sort(key=lambda i: i["published"], reverse=True)
        turns = [queues[feed_id] for feed_id
                 in sorted(queues, key=lambda f: feed_order.get(f, len(FEEDS)))]

        seen_links, seen_titles, picked = set(), set(), []
        while turns and len(picked) < ITEMS_PER_REGION:
            for queue in list(turns):
                while queue:                       # skip past anything already
                    item = queue.pop(0)            # shown from another feed
                    lk, tk = link_key(item["link"]), title_key(item["title"])
                    if lk in seen_links or tk in seen_titles:
                        continue
                    seen_links.add(lk)
                    seen_titles.add(tk)
                    picked.append(item)
                    break
                if not queue:
                    turns.remove(queue)            # that feed is spent
                if len(picked) == ITEMS_PER_REGION:
                    break
        picked.sort(key=lambda i: i["published"], reverse=True)
        regions.append({
            "key": key,
            "name": name,
            "stale": bool(picked) and all(i["stale"] for i in picked),
            "items": picked,
        })
        for item in picked:
            ask.append({
                "region": name,
                "source": item["source"],
                "title": item["title"],
                # A person asks in words, so the row carries a readable
                # minute rather than the item's ISO string.
                "published": item["published"][:16].replace("T", " ") + " UTC",
            })

    used = sorted({item["source"] for r in regions for item in r["items"]}
                  or SOURCES.keys())
    sources = [dict(SOURCES[name], name=name) for name in used if name in SOURCES]

    if len(ask) > 60:                                    # the brief's ceiling
        raise SystemExit(f"ask array has {len(ask)} rows; the ceiling is 60")

    return {
        "schema": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc)
                         .strftime("%Y-%m-%dT%H:%M:%SZ"),
        "regions": regions,
        "sources": sources,
        "feeds": reports,
        "ask": ask,
    }


# --------------------------------------------------------------------------
# Self-test
# --------------------------------------------------------------------------

# Four behaviours that a passing run does not exercise, because the live feeds
# happen not to trip them. Each was a real defect or a real exposure; each
# costs nothing to keep pinned. `python3 scripts/world_news.py --selftest`.

ATOM_SELF_FIRST = b"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
 <entry>
  <title>A story</title>
  <link rel="self" href="https://example.org/feed.atom"/>
  <link rel="alternate" href="https://example.org/a-story"/>
  <updated>2026-09-21T08:00:00Z</updated>
  <summary>The publisher's own line.</summary>
 </entry>
</feed>"""

BILLION_LAUGHS = b"""<?xml version="1.0"?>
<!DOCTYPE feed [
 <!ENTITY a "aaaaaaaaaa">
 <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
 <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
]>
<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>&c;</title></entry></feed>"""


def selftest():
    checks = []

    # 1. An Atom entry whose self link comes first must still link to the
    #    story. Getting this wrong points every headline in the feed at the
    #    feed file, which looks like working software.
    item = parse(ATOM_SELF_FIRST, "t", "Test")[0]
    checks.append(("atom rel=alternate wins",
                   item["link"] == "https://example.org/a-story", item["link"]))

    # 2. A verbatim source carries no summary and no trimmed headline.
    plain = parse(ATOM_SELF_FIRST, "t", "Test")[0]
    strict = parse(ATOM_SELF_FIRST, "t", "Test", verbatim=True)[0]
    checks.append(("verbatim drops the summary",
                   plain["summary"] != "" and strict["summary"] == "",
                   repr(strict["summary"])))

    # 3. A document that declares entities is refused before the parser sees
    #    it, so nine levels of nesting cannot expand into the runner's memory.
    try:
        parse(BILLION_LAUGHS, "t", "Test")
        refused = "parsed it"
    except FeedRefused as error:
        refused = str(error)
    checks.append(("entity declaration refused",
                   refused == "answer declared XML entities", refused))

    # 4. The ceiling is absolute: a body one byte over is refused whatever it
    #    compressed from.
    try:
        _bounded(b"x" * (MAX_FEED_BYTES + 1), "feed")
        capped = "accepted it"
    except FeedRefused as error:
        capped = str(error)
    checks.append(("oversized body refused", capped.startswith("feed over"),
                   capped))

    bad = 0
    for name, passed, got in checks:
        print(f"  {'ok  ' if passed else 'FAIL'} {name:<34} {got}")
        bad += 0 if passed else 1
    if bad:
        raise SystemExit(f"{bad} self-test(s) failed")
    print(f"{len(checks)} self-tests passed")


DEFAULT_OUT = (pathlib.Path(__file__).resolve().parent.parent
               / "world-news" / "data" / "snapshot.json")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--demo", action="store_true",
                        help="fetch nothing: rehearse the outage path offline. "
                             "Reads the committed snapshot, marks every headline "
                             "stale and writes it to --out, which is required so "
                             "that a rehearsal can never overwrite live data.")
    parser.add_argument("--out", type=pathlib.Path, default=None,
                        help="where to write (default: the app's data folder)")
    parser.add_argument("--selftest", action="store_true",
                        help="check the parser's licence and safety rules "
                             "against fixed documents; fetch nothing, write "
                             "nothing")
    args = parser.parse_args()

    if args.selftest:
        return selftest()

    if args.demo and args.out is None:
        raise SystemExit("--demo needs --out; it must not overwrite the app's "
                         "own snapshot with an all-stale one")
    out = args.out or DEFAULT_OUT

    # The cache is the committed snapshot unless the target itself already
    # holds one, so a rehearsal writing elsewhere still has yesterday to keep.
    source = out if out.exists() else DEFAULT_OUT
    previous = None
    if source.exists():
        try:
            previous = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            print(f"previous snapshot unreadable ({error}); starting empty",
                  file=sys.stderr)

    snapshot = build(previous, offline=args.demo)

    live = sum(1 for report in snapshot["feeds"] if report["ok"])
    if not args.demo and live == 0:
        raise SystemExit("no feed answered; leaving the snapshot alone")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snapshot, indent=1, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    headlines = sum(len(region["items"]) for region in snapshot["regions"])
    print(f"wrote {out} - {headlines} headlines, {len(snapshot['ask'])} ask "
          f"rows, {live}/{len(FEEDS)} feeds live, "
          f"{out.stat().st_size / 1024:.0f} kB")


if __name__ == "__main__":
    main()
