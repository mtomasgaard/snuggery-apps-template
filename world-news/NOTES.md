# World News — the feeds, and what their terms ask for

This app shows **headlines, the publisher's name, the time, a byline where the
feed gives one, a one-line summary where the licence allows it, and a link
out**. It never copies an article. Every story opens on the publisher's own
site in your browser — a Snuggery mini-app has no network access at all, so it
could not fetch one even if it wanted to.

Three things make a feed usable here:

1. **Keyless.** No account, no token, no secret in the workflow.
2. **Regional.** It answers for one part of the world, so a section is about
   that part of the world.
3. **Terms that allow a headline and a link to be *taken out of the feed* and
   shown with credit** — by somebody other than the person who fetched it.

The third is the one that eliminates most candidates, and it is worth
understanding before you add a feed of your own.

## The trap: an RSS feed is usually licensed to be *subscribed to*, not taken apart

`scripts/world_news.py` is not a feed reader. It pulls each feed apart — title,
link, publication time, the description line — throws the rest away, re-sorts
what is left, merges it with other publishers, and commits the result as JSON
in a public repository. That is a different act from putting a feed widget on a
page, and a great many terms permit the second while forbidding the first.

These were read on **2026-09-21** and **deliberately left out**:

| Feed | What its terms say |
| --- | --- |
| **BBC News** | "You're **not allowed to pluck metadata from our content or RSS feeds**. You can add the BBC News RSS feed to your website or social media account. Provided: **You don't change the RSS feed** …" — [Can I use BBC content?](https://www.bbc.co.uk/usingthebbc/terms/can-i-use-bbc-content/), updated 28 July 2025. The same page adds that "anything plucked from our services to develop or train artificial intelligence or to do computer analysis" needs permission, and this app's `ask` table exists to be read by a model. Both conditions are ones this script cannot meet: it does exactly the plucking and changing that sentence names. An older BBC page (bbc.co.uk/news/10628494, last updated 2011) reads much more permissively and is still findable; it ends "Please see our Terms of Use for full details", and those full details are the page above. |
| Channel NewsAsia / Mediacorp | "strictly for your personal and non-commercial uses only"; "You shall not under any circumstances whatsoever distribute, circulate, forward … the RSS Feeds to any other third party(s)" — [RSS terms](https://www.channelnewsasia.com/rss/rssterms) |
| RNZ | "These feeds are for personal use only. No audio or text may be posted to a website, distributed to a third party…"; "The RSS Feeds must not be used to aggregate content on other websites" — [legal](https://www.rnz.co.nz/about/legal) |
| France 24 / France Médias Monde | "any reproduction … or partial or complete representation … and/or transfer to another site … is prohibited"; also an explicit opt-out of automated collection — [legal notice](https://www.francemm.com/en/legal-notice) |
| AllAfrica | "All content and graphics on this site is protected by U.S. copyright … and may not be copied or reproduced without written [permission]" — [copyright](https://allafrica.com/misc/info/copyright.html) |
| Al Jazeera English | "you agree that you do so only for your own personal, non-commercial use"; no third party may copy, store or distribute the content — [terms](https://www.aljazeera.com/terms-and-conditions/) |
| Deutsche Welle | Its feeds answer, but DW licenses content through content partnerships rather than a public grant, and no page was found stating terms that cover this use. Left out for want of a clearance, not because one was refused. |
| CBC | The feed answers a browser but refuses a named script's User-Agent, so it cannot be fetched politely and honestly. Left out rather than fetched under a disguised agent. |
| Voice of America | The feeds still answer, but their newest item is from **March 2025**. A frozen feed is not a news source. |

None of that stops *you* reading any of them in a reader on your own phone.
It stops this repository from republishing them. If your own copy is
**private**, most of these become usable again — your snapshot is then a
personal copy, not a website — and adding one is a row in `FEEDS` in
`scripts/world_news.py`. Read the terms yourself before you do; they change,
and an old page that says something friendlier is not a licence.

**A consequence worth naming: there is no wire service here.** Once the
feeds that forbid this use are removed, what is left is not Reuters or the
BBC. It is a citizen-media network, a UN newsroom and an academic commentary
network — good, credited, freely licensed journalism that is slower and more
analytical than a wire. The app is honest about that; you should be too if you
show it to somebody.

## The feeds this app does use

Seventeen feeds across six regions. Each was fetched successfully on
2026-09-21 before being committed here.

### Global Voices — `globalvoices.org`

Western Europe, Eastern & Central Europe, Latin America, Sub-Saharan Africa,
West Asia & North Africa, East Asia, South Asia, Oceania.

Published under **Creative Commons Attribution 3.0** — the licence line is in
the app's footer, linking to
<https://creativecommons.org/licenses/by/3.0/>. Global Voices' attribution
policy asks that a republished story "give appropriate credit, provide a link
to the license, and **indicate if changes were made**". Changes *are* made
here: `clean()` strips the markup out of the feed's description, collapses the
whitespace and cuts the line at about 220 characters with an ellipsis. So the
licence line the app prints says so — *"the summaries here are the feed's own
line, shortened"* — rather than implying the text is untouched. The app also
prints the author when the feed names one (`dc:creator`), and every headline is
itself the link to the original.

Their note that *photographs in a story may be under other terms* does not
reach us: no image from any feed is fetched, stored or shown.
Policy: <https://globalvoices.org/about/global-voices-attribution-policy/>

One quirk of theirs to expect: Global Voices files a single story into several
regional feeds, so a piece about Indigenous land rights can appear under Europe,
the Middle East and Asia on the same day. That is their filing, not a bug here —
the app removes duplicates within a section, not across them.

### UN News — `news.un.org`

Europe, Americas, Africa, Middle East, Asia-Pacific.

> "News-related material can be used as long as the appropriate credit is given
> and the United Nations is advised."
> — <https://www.un.org/en/about-us/copyright>

That is one sentence with **two** conditions joined by "and", so the app's
footer line carries both: *"news-related material may be used as long as
appropriate credit is given and the United Nations is advised."* Credit is
given in the footer and under each headline. Advising the UN is the condition
whoever runs a copy has to satisfy for themselves; at the scale of one personal
dashboard nobody has ever been asked to, but the page says what it says, and it
is written down here so nobody has to rediscover it.

The **Asia-Pacific** desk backs the **Asia** section. It used to back Oceania,
which was wrong in a way that mattered: a review found "Nepal floods" and "UN
fact-finding mission on Iran" sitting in the committed snapshot as *Oceania*
headlines — including in the `ask` table, which is the one key Snuggery's Ask
reads, so "what is happening in Oceania?" was answered with a story about Iran.
Under Asia the desk's name is close to its content; the residual is the other
way round, an occasional Pacific story filed as Asia. Oceania is now covered by
three feeds that are actually Oceanian.

UN News publishes a handful of regional stories a week rather than a day, so
in practice it is a steady second voice in a section rather than a wire.

### The Conversation — `theconversation.com`

United States, Africa, Australia, New Zealand.

> "Creative Commons — Attribution/No derivatives licence": "Credit the
> author(s) and their institution(s), ideally in the byline"; "Credit The
> Conversation with a link to our homepage or the original article"; "You may
> only edit to provide accurate references to time and place, or to comply with
> an editorial style. Any other edits need the author's approval."
> — <https://theconversation.com/au/republishing-and-media>

**No derivatives** is why these four feeds are marked `verbatim` in `FEEDS`,
and the flag is a licence decision rather than a formatting one:

- the headline is carried **exactly as written** — never cut at `TITLE_CHARS`
  with an ellipsis, the way the other feeds' are;
- **no summary line is carried at all**, so nothing of theirs is shortened;
- the byline is carried whole, institution included, because that is the credit
  the licence asks for.

What is left is a headline and a link, which the same page allows explicitly:
"extracts are fine as long as they're followed by a link back". The app takes at
most three per region per day, so it is nowhere near the "systematically
republish all our articles" the terms forbid.

One more thing to be straight about. These are *editions* — where the
newsroom sits — not desks that cover only that place. The Australian edition
runs Australian authors writing about the oil market or the Middle East, so a
headline under **Oceania** is reliably *from* Oceania and only usually *about*
it. That is a weaker claim than the one Global Voices' and the UN's regional
feeds make, and it is the reason those two are in every section as well: a
region is never one publisher here.

Two things to know about these feeds. They are Atom, not RSS — which is why
`first_text()` insists on `rel="alternate"`; an Atom entry can carry a
`rel="self"` link pointing at the feed file, and taking the first link it finds
would give every headline in the feed the same address. And The Conversation
Africa publishes in **English and French**, with no per-item language tag, so a
French headline turns up in the Africa section now and then. Left as it is
rather than guessed at with a language heuristic.

## Why a section is never one publisher

Publishing rates differ by more than an order of magnitude — an academic
network posts fifty items a day, a citizen-media site a handful a week. Sorting
a region's candidates by recency alone therefore hands the whole section to
whoever posts most often, which is a quieter version of filing a feed under the
wrong region: the label says *Americas* and the rows are one newsroom's view of
it. So the feeds in a region **take turns** (`build()` in
`scripts/world_news.py`), newest first within each, and only then is what was
picked sorted for display. Every source that answered is on screen.

## What the app draws, and what it does not

- **Drawn:** title, source, publication time, the author when given, the link,
  and — for the feeds whose licence permits a shortened line — the feed's own
  `description` trimmed to about 220 characters.
- **Never fetched or stored:** images, enclosures, audio, video, full text.
- **No tracking of any kind**, because there is nothing to track with: the app
  makes no request except to `./data/snapshot.json` inside its own folder.

## What the script refuses before it parses

A feed is another machine's answer, and the job that fetches it runs with
`contents: write` on your repository. `PROMPT.md` invites you to add feeds of
your own, so the script bounds what one of them can cost:

- at most **8 MB** is read from a feed, and the same ceiling applies to
  whatever a gzip or deflate body expands to — a few kilobytes of zeros expand
  to as much memory as the runner will give them;
- a document that **declares its own XML entities** is refused unparsed, because
  `xml.etree` resolves them and nine levels of nesting turn a few hundred bytes
  into gigabytes.

These are absolute limits, never ratios of compressed to expanded size: a ratio
throws out ordinary files while still admitting the attack, because the
attacker picks the ratio. A refused feed falls back to its cached headlines
like any other failure. `python3 scripts/world_news.py --selftest` checks all
of this, and the Atom link rule, against fixed documents without fetching
anything.

## Nothing here is anybody's

Every headline in the committed snapshot is a public news headline. There is no
account, name, location, token or personal figure anywhere in this app or its
data — there is nothing for there to be.
