# What travels with this app, and under whose terms

Four things in Finances are not ours, and the MIT licence at the root of this
repository does not cover them. Three are data sources the app depends on — and
only one of the three states its terms at all. The fourth is an endpoint the app
can be pointed at but is not licensed to use.

## The house-price index: Statistics Norway table 07221 (NLOD)

The home's value is an anchor figure you set, moved by **Statistics Norway's
price index for existing dwellings**, table **07221** — quarterly, back to 1992,
fetched from SSB's open, unauthenticated API at `data.ssb.no`. No key, no
registration, no rate limit worth worrying about.

Statistics Norway publishes its statistics under the **Norwegian Licence for
Open Government Data (NLOD)**: free to use, share and adapt, including
commercially, provided the source is credited and it is not presented in a way
that implies SSB endorses what you did with it. The terms are at
[data.norge.no/nlod/en](https://data.norge.no/nlod/en/), and SSB's own
statement of them is at
[ssb.no](https://www.ssb.no/en/informasjon/copyright).

**The attribution the licence asks for is printed by the app**, under the
home's value on the Owned pane, as the basis line the refresh writes:

> SSB 07221 — Hele landet, Alle boligtyper, Prisindeks for brukte boliger, sesongjustert

The exact cut is whichever variant is selected, so the credit follows the number
rather than sitting in a footer nobody reads.

A copy of the index — the 2021-onwards quarters only — is cached inside
`scripts/make_demo_finances.py` so the example data can be rebuilt with no
network. That cache is the same public figures; refresh it with
`python3 scripts/finances.py --probe-assets`.

**This index is Norwegian.** Outside Norway, set the home's `method` to `rate`
with an assumption you can defend, or swap in your own country's published
index: the code needs a date-to-level series and `ssb_series()` in
`scripts/finances.py` is the one function to replace.

## The banks: Enable Banking (PSD2 account information)

Balances and transactions arrive through **Enable Banking**, a licensed PSD2
account-information provider. Their free tier is *restricted production*: real
data, from accounts you authorise yourself, with no contract and no eIDAS
certificate — which is exactly this use and nothing more. Their terms are their
own; read them at [enablebanking.com](https://enablebanking.com) before you sign
up, because you are the one agreeing to them.

Two things worth knowing before you build on it:

- **PSD2 guarantees an unattended reader four accesses per account per 24
  hours.** Once a day is the right rhythm. An hourly job will burn the
  allowance by breakfast and spend the rest of the day showing you yesterday.
- **Consent expires**, at 180 days at the outside and often sooner. When a
  refresh starts answering 401, run `--connect` again for that bank and replace
  its entry in the secret. The app keeps the last good balance and marks the
  source stale rather than dropping the account, so this shows up as a warning
  rather than as money vanishing.

Nothing about this app passes through anybody else's server except Enable
Banking's, which is the regulated party in the middle by design. Snuggery
itself never goes online; it only ever reads the file the Shortcut wrote.

## Fund prices, and the Yahoo endpoint in particular

`holdings.json` ships with `navSource: "manual"` and a made-up price, so the
example works offline. Two other settings fetch a real one, and they do not
stand on the same ground.

**`manual` is the supported path.** You read the NAV off your fund provider's
own page and type it into `holdings.json` with the date you read it, re-anchored
every few months. Slightly tedious, no terms but your provider's, and it never
breaks. `isin` is the same idea automated where a public ISIN lookup answers.

**`yahoo:<symbol>` calls an endpoint that is not licensed for this.**
`scripts/finances.py` fetches `query1.finance.yahoo.com/v8/finance/chart/…`,
which is the JSON that Yahoo Finance's own web pages call. It is undocumented
and carries no API terms of its own, and Yahoo's Terms of Service cover it:
§2.4(i) forbids using "any automated means, devices, programs, algorithms or
methodologies, including… robots, spiders, scrapers, data mining tools" to
"access or collect data… for any purpose without our express, prior
permission", and §2.5 rules out commercial reuse. Their licensed route is a
paid data product.

We say so rather than leaving you to find out. It is offered because for most
European funds it is the only thing that actually resolves, and a setting you
choose knowingly beats a default you did not — but it is your call to make, and
for anything beyond one person reading their own numbers the answer should be
`manual` or `isin`.

Whatever you point it at, the refresh sends a User-Agent naming your repository,
so the request is identifiable rather than anonymous. That is the least a
well-behaved unauthenticated caller can do, and it is not a substitute for
terms that permit the call.

## Exchange rates: Norges Bank

A fund or a share grant quoted in a currency other than the snapshot's is
converted at **Norges Bank's daily reference rates**, fetched from their open
API at `data.norges-bank.no` — no key, no registration, published by the
country's central bank as reference data. The snapshot records
`fxSource: "norges-bank"` next to the rate, and the app prints it under the
share price, so the credit sits with the number it produced.

**On the terms, the honest answer is that they are not published.** Norges
Bank's exchange-rate pages and its open-data API documentation carry no licence
statement, no terms of use and no stated attribution requirement — unlike SSB
above, which says NLOD plainly. So this app does not claim a licence it cannot
point at. It credits the source on screen regardless, which is what NLOD would
have asked for and what any reasonable reading of reference data published for
public use asks for anyway, and it calls the endpoint the way a well-behaved
caller should: once a day at most, with a User-Agent naming your repository. If
you are doing anything beyond one person reading their own numbers, ask them.

Two things about the figures themselves: a rate is quoted per unit for most
currencies but **per 100 units** for some (SEK, DKK, JPY among them), which the
script handles and a reimplementation must; and there is no rate on a weekend
or a Norwegian holiday, so the most recent published day is used and its date
travels with it.

## The example data is not data

Every account, balance, transaction, merchant, fund, car and loan in
`data/snapshot.json` was invented by `scripts/make_demo_finances.py` from a
fixed seed. There is no household. The app says so on screen, the file says so
in its `notes`, and `synthetic: true` is what puts the banner there. Prove it
for yourself:

```
python3 scripts/make_demo_finances.py --check
```

which regenerates the file into a temporary directory and compares it byte for
byte with the committed one.
