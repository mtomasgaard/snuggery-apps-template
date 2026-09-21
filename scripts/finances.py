#!/usr/bin/env python3
"""Rewrite finances/data/snapshot.json from your banks.

The data half of the Finances app. Reads accounts, balances and transactions
from Enable Banking (a licensed PSD2 account-information provider, free for
personal use), accrues the fund units that your standing transfers bought,
prices them at published NAV, values the home and vehicles that no bank
reports, amortises the loans against them, and writes one small JSON file the
app reads.

The parts nobody reports come from finances/assets.json: each is anchored to a
value on a date, then moved by Statistics Norway's used-dwelling price index
(open, unauthenticated, quarterly back to 1992), a flat assumed rate, or a
vehicle depreciation curve. Two of those three are deterministic functions of
the date, so the net worth HISTORY is recomputed from scratch on every run
rather than appended to — correct a wrong anchor and the past corrects itself.

Nothing here is specific to one bank: Enable Banking normalises the banks it
talks to, and the one place a national convention shows through is the account
type map (NO_ACCOUNT_KINDS) and the house-price index. Both are marked, and
both are a few lines to replace.

Run it with no arguments to do the whole job. The other modes exist because
this talks to an API that cannot be reached from most agent sessions, so when
something is shaped differently than expected you want the raw answer, not a
traceback:

    --no-banks    everything EXCEPT the banks, for real: your home indexed at
                  the live figure, your car depreciated, your loan amortised,
                  your fund and share prices fetched. No Enable Banking account
                  needed, so it is the fastest way to see your own numbers
                  before committing to the bank setup.
    --aspsps      list the banks Enable Banking can connect to in a country
    --connect     authorise ONE bank in a browser and print its session id
    --probe       fetch one session and print the RAW shapes, redacted
    --probe-nav   try every NAV source for every fund and report what answered
    --probe-assets  list the regions the index offers, and value every asset
    --probe-equity  price the employee shares and show the vesting schedule
    --push        commit and push the snapshot (what the workflow uses)

The example snapshot that ships with the app is NOT written by this script:
scripts/make_demo_finances.py invents a household and runs it through this
file's own assemble(), so the example exercises the same code the real pull
does. Your first real run replaces it.

Credentials, all from the environment:

    ENABLEBANKING_APP_ID        the application UUID from the control panel
    ENABLEBANKING_PRIVATE_KEY   the PEM private key downloaded with it
    ENABLEBANKING_SESSIONS      {"bank": "<session-id>", "card": "<session-id>"}
                                — one entry per `--connect` run
                                — the keys are yours to choose; they become the
                                source ids in the snapshot, and SOURCE_LABELS
                                below turns them into what the app prints.

Sessions are created once, interactively, by `--connect` — a strong customer
authentication step is a human step and no schedule can do it. PSD2
guarantees an unattended reader only FOUR accesses per 24 hours per account,
which is why the workflow runs once a day and not hourly: balances move daily,
and once leaves the allowance nowhere near its limit.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
from datetime import date, datetime, timedelta, timezone
from urllib import error, parse, request
from zoneinfo import ZoneInfo

API = "https://api.enablebanking.com"

# Every outbound request identifies the repository it is running for, which is
# what the open APIs below ask of an unauthenticated caller. On a runner
# GITHUB_REPOSITORY fills itself in; locally it falls back to the template name.
# ASCII only, and no em dash: an HTTP header is encoded latin-1, and a header
# value that cannot be is a UnicodeEncodeError at request time rather than a
# polite failure. Cost an afternoon once; worth the comment.
USER_AGENT = ("snuggery-live-apps finances refresh (+https://github.com/"
              + (os.environ.get("GITHUB_REPOSITORY") or "snuggery-apps-template") + ")")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "finances")
OUT = os.path.join(APP, "data", "snapshot.json")
HOLDINGS = os.path.join(APP, "holdings.json")
CATEGORIES = os.path.join(APP, "categories.json")
ASSETS = os.path.join(APP, "assets.json")

# Statistics Norway's used-dwelling price index: open, unauthenticated, and it
# carries the whole series back to 1992 — which is what lets a house contribute
# a real line to the net worth history instead of a flat one.
#
# 07221 is the QUARTERLY table and 07230 the annual one, with the same regions
# and dwelling types. The annual table was used here first, and its newest point
# is last December — so a house sat at the end-of-year index for up to fifteen
# months, and the history moved in twelve-month steps. Quarterly it is.
SSB_TABLE = "07221"
SSB_URL = "https://data.ssb.no/api/v0/no/table/{table}"

# Norges Bank's daily reference rates: open, no key, and the official figure for
# converting a foreign quote to kroner. Some currencies are quoted per 100 units
# (SEK, DKK, JPY) — UNIT_MULT says which, and ignoring it is a factor-of-100 bug.
NB_FX = ("https://data.norges-bank.no/api/data/EXR/B.{base}.{quote}.SP"
         "?format=csv&startPeriod={start}&endPeriod={end}&locale=en")

HISTORY_DAYS = 400      # ~13 months of daily net worth; a few tens of kB
CASHFLOW_MONTHS = 24
MAX_TXNS = 300          # what the app lists; the rest only feed the aggregates
TXN_WINDOW = 400        # days of transactions to ask each bank for

# The zone the snapshot's calendar dates are in — which month a transaction
# lands in, and what "today" means to every window below. Display only: every
# stored timestamp is UTC.
#
# SET THIS TO YOUR OWN ZONE. It ships as UTC because the example data belongs
# to nobody and should not say where anybody lives; "Europe/Berlin",
# "America/New_York" and the rest of the IANA names all work. A named zone
# rather than a fixed offset, so the daylight-saving change does not silently
# roll every month boundary an hour early for half the year — zoneinfo is the
# standard library, so this is still a stdlib script.
LOCAL_TZ_NAME = "UTC"
LOCAL_TZ = ZoneInfo(LOCAL_TZ_NAME)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today() -> date:
    return datetime.now(LOCAL_TZ).date()


# ── Auth ────────────────────────────────────────────────────────────────────
# Enable Banking authenticates with a short-lived RS256 JWT signed by the key
# that was downloaded with the application. Signing it by hand keeps the
# dependency list at one library instead of two.

def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def make_jwt(app_id: str, pem: str) -> str:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    key = serialization.load_pem_private_key(pem.encode(), password=None)
    now = int(time.time())
    header = {"typ": "JWT", "alg": "RS256", "kid": app_id}
    payload = {
        "iss": "enablebanking.com",
        "aud": "api.enablebanking.com",
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = f"{_b64(json.dumps(header).encode())}.{_b64(json.dumps(payload).encode())}"
    sig = key.sign(signing_input.encode(), padding.PKCS1v15(), hashes.SHA256())
    return f"{signing_input}.{_b64(sig)}"


class Api:
    """Thin client. Retries the transient failures and nothing else — a 401 is
    a dead credential and retrying it just wastes the run's time."""

    def __init__(self, app_id: str, pem: str):
        self.token = make_jwt(app_id, pem)

    def call(self, path: str, method: str = "GET", body: dict | None = None,
             query: dict | None = None, tries: int = 4):
        url = API + path
        if query:
            url += "?" + parse.urlencode({k: v for k, v in query.items() if v is not None})
        data = json.dumps(body).encode() if body is not None else None
        last = None
        for attempt in range(tries):
            req = request.Request(url, data=data, method=method)
            req.add_header("Authorization", f"Bearer {self.token}")
            req.add_header("Accept", "application/json")
            if data:
                req.add_header("Content-Type", "application/json")
            try:
                with request.urlopen(req, timeout=60) as r:
                    return json.loads(r.read().decode() or "{}")
            except error.HTTPError as e:
                detail = e.read().decode(errors="replace")[:600]
                last = ApiError(e.code, method, path, detail)
                # 401/403 = the credential or the consent. 4xx = our request.
                # Neither improves by being sent again.
                if e.code < 500 and e.code != 429:
                    raise last
            except (error.URLError, TimeoutError, OSError) as e:
                last = ApiError(0, method, path, str(e))
            if attempt < tries - 1:
                time.sleep(2 ** attempt)
        raise last


class ApiError(Exception):
    def __init__(self, status, method, path, detail):
        self.status = status
        super().__init__(f"{method} {path} -> {status or 'network'}: {detail}")


# ── Shapes ──────────────────────────────────────────────────────────────────
# Enable Banking normalises the banks it talks to, but not every bank fills
# every field, so read defensively: a missing name is not a reason to lose an
# account, and an amount arrives as a string more often than as a number.

def num(v, default=None):
    if v is None or v == "":
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def amount_of(node) -> float | None:
    """{"currency": "NOK", "amount": "412.50"} -> 412.5"""
    if not isinstance(node, dict):
        return num(node)
    return num(node.get("amount"))


def pick_balance(balances: list) -> tuple[float | None, float | None]:
    """(booked, available). CLBD is the closing booked balance; ITAV is what you
    can actually spend, which differs whenever something has not settled."""
    booked = available = None
    order = {"CLBD": 0, "XPCD": 1, "OTHR": 2}
    for b in sorted(balances or [], key=lambda x: order.get(x.get("balance_type"), 9)):
        amt = amount_of(b.get("balance_amount"))
        if amt is None:
            continue
        kind = b.get("balance_type")
        if kind in ("ITAV", "FWAV") and available is None:
            available = amt
        elif booked is None and kind in order:
            booked = amt
    if booked is None:                       # no recognised type; take the first
        for b in balances or []:
            amt = amount_of(b.get("balance_amount"))
            if amt is not None:
                booked = amt
                break
    return booked, available


# THE ONE PLACE A NATIONAL CONVENTION SHOWS THROUGH, and the first thing to
# change if your bank is elsewhere.
#
# Some banks put the account HOLDER in `name` — the same string on every
# account, so four accounts all come back with one person's name — and the
# account's own label in `details`, as "<what you called it>, <TYPE>". Where
# that is what arrives, the label is what to read, and its suffix is the most
# reliable type on offer: a bank that marks a savings account CACC, exactly like
# a current one, still writes the right word in the suffix.
#
# The keys below are the Norwegian words, because that is the bank this was
# written against. Add your own; account_type() falls back to the PSD2 fields
# when nothing here matches, so a wrong map costs a label, never an account.
# Keys are folded (accent-stripped, lower) to match fold().
ACCOUNT_KINDS = {
    "brukskonto": "current",
    "lønnskonto": "current",     # fold() strips combining accents, and Ø is not
    "lonnskonto": "current",     # one of them — so carry both spellings
    "driftskonto": "current",
    "sparekonto": "savings",
    "bsu": "savings",
    "kredittkort": "credit",
    "kredittkonto": "credit",
}


def account_label(acc: dict) -> tuple[str, str]:
    """-> (what the holder called the account, the bank's type suffix). Either
    may be empty: only some banks fill `details`, and only some of those end it
    with a type this recognises."""
    raw = acc.get("details")
    if not isinstance(raw, str) or not raw.strip():
        return "", ""
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    suffix = fold(parts[-1]).lower() if parts else ""
    if len(parts) > 1 and suffix in ACCOUNT_KINDS:
        return ", ".join(parts[:-1]), suffix
    return raw.strip(), ""


def account_type(acc: dict) -> str:
    kind = ACCOUNT_KINDS.get(account_label(acc)[1])
    if kind:
        return kind
    cash = (acc.get("cash_account_type") or "").upper()
    product = (acc.get("product") or "").lower()
    if cash == "CARD" or "kort" in product or "card" in product or "credit" in product:
        return "credit"
    if cash == "SVGS" or "spar" in product or "saving" in product:
        return "savings"
    if cash in ("CACC", "TRAN", "CASH"):
        return "current"
    return "other"


def account_name(acc: dict) -> str:
    nickname = account_label(acc)[0]
    if nickname:
        return nickname
    for key in ("product", "name"):
        v = acc.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    ident = acc.get("account_id") or {}
    iban = ident.get("iban") or ident.get("other", {}).get("identification") or ""
    return f"Account {iban[-4:]}" if iban else "Account"


def account_mask(acc: dict) -> str | None:
    ident = acc.get("account_id") or {}
    raw = ident.get("iban") or (ident.get("other") or {}).get("identification") or ""
    return f"•• {raw[-4:]}" if len(raw) >= 4 else None


def txn_text(t: dict) -> str:
    """The best human description the bank gave us, in the order that is usually
    most specific first."""
    for node in (t.get("creditor"), t.get("debtor")):
        if isinstance(node, dict) and (node.get("name") or "").strip():
            name = node["name"].strip()
            break
    else:
        name = ""
    rem = t.get("remittance_information")
    if isinstance(rem, list):
        rem = " ".join(str(x) for x in rem if x)
    rem = (rem or "").strip()
    extra = (t.get("merchant_category_code") or "")
    for candidate in (rem, name, t.get("note"), t.get("entry_reference"), extra):
        if isinstance(candidate, str) and candidate.strip():
            return re.sub(r"\s+", " ", candidate.strip())[:120]
    return "Transaction"


def txn_amount(t: dict) -> float | None:
    amt = amount_of(t.get("transaction_amount"))
    if amt is None:
        return None
    amt = abs(amt)
    ind = (t.get("credit_debit_indicator") or "").upper()
    return amt if ind == "CRDT" else -amt


def txn_date(t: dict) -> str | None:
    for key in ("booking_date", "value_date", "transaction_date"):
        v = t.get(key)
        if isinstance(v, str) and len(v) >= 10:
            return v[:10]
    return None


# ── Categorising ────────────────────────────────────────────────────────────

def fold(s: str) -> str:
    """Upper-case and strip accents, so ELKJØP matches ELKJOP and vice versa —
    banks are not consistent about which one they send."""
    s = unicodedata.normalize("NFKD", s.upper())
    return "".join(c for c in s if not unicodedata.combining(c))


class Categoriser:
    def __init__(self, cfg: dict):
        self.income = [fold(x) for x in cfg.get("income", [])]
        self.rules = [(r["id"], r["label"], [fold(m) for m in r.get("match", [])])
                      for r in cfg.get("categories", [])]
        fb = cfg.get("fallback") or {"id": "other", "label": "Uncategorised"}
        self.fallback = (fb["id"], fb["label"])
        self.labels = {i: l for i, l, _ in self.rules}
        self.labels[self.fallback[0]] = self.fallback[1]
        self.labels["income"] = "Income"

    def of(self, text: str, amount: float) -> str:
        t = fold(text)
        if amount > 0 and any(m in t for m in self.income):
            return "income"
        for cid, _label, matches in self.rules:
            if any(m in t for m in matches):
                return cid
        return "income" if amount > 0 else self.fallback[0]


SHOUTED = {"AS", "ASA", "AB", "SA", "BA", "DA", "ANS", "UK", "USA", "NO", "IT"}


def titlecase(key: str) -> str:
    return " ".join(w if w in SHOUTED else w.capitalize() for w in key.split(" "))


def merchant_key(text: str) -> str:
    """Collapse 'REMA 1000 MAJORSTUA 12.09' down to something worth ranking."""
    t = re.sub(r"\d{2}[./-]\d{2}([./-]\d{2,4})?", " ", text)
    t = re.sub(r"\*+\d+", " ", t)
    t = re.sub(r"\b\d{4,}\b", " ", t)
    t = re.sub(r"[^\w\sÆØÅæøå&.-]", " ", t)
    words = [w for w in re.sub(r"\s+", " ", t).strip().split(" ") if w]
    return " ".join(words[:3]).upper()[:32] or "UNKNOWN"


# ── NAV ─────────────────────────────────────────────────────────────────────
# Your fund provider almost certainly has no API you can call — fund holdings
# are not payment accounts, so PSD2 does not reach them and no aggregator
# carries them. What is public is the daily NAV of the funds themselves, and
# that is enough: units come from the transfers that bought them, value comes
# from the price.

# A fund house's open fund-data endpoint, tried in order, keyed by ISIN. It is
# NOT the default, deliberately: when this was written it answered 404 for
# every ISIN put to it, and a default that silently fails is worse than one
# that says it is holding a price you typed. Name it explicitly with
# navSource: "isin" if it works for your funds, or point navSource at a quote
# symbol instead. Replace the list with your own provider's if you have one.
ISIN_NAV = [
    "https://api.fund.storebrand.no/open/funddata/navs?isin={isin}",
    "https://api.fund.storebrand.no/open/funddata/nav?isin={isin}",
    "https://api.fund.storebrand.no/open/funddata/fund?isin={isin}",
]

YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=5y&interval=1d"


def http_json(url: str, tries: int = 3):
    for attempt in range(tries):
        try:
            req = request.Request(url, headers={
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            })
            with request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode())
        except Exception as e:                 # noqa: BLE001 - any failure is "try the next source"
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)


def dig_nav_series(node, out: dict | None = None, depth: int = 0) -> dict:
    """Pull every (date, price) pair out of a document, wherever they sit.

    Worth more than the spot price: with a series, a purchase is valued at the
    NAV it actually settled at rather than at today\'s, and the portfolio has a
    real history instead of one point per run.
    """
    out = {} if out is None else out
    if depth > 7:
        return out
    if isinstance(node, dict):
        when = None
        for k in ("navDate", "date", "asOf", "asOfDate", "valuationDate", "dato"):
            v = node.get(k)
            if isinstance(v, str) and re.match(r"\d{4}-\d{2}-\d{2}", v):
                when = v[:10]
                break
        price = None
        for k in ("nav", "navValue", "value", "price", "unitPrice", "netAssetValue", "kurs"):
            price = num(node.get(k))
            if price:
                break
        if when and price and price > 0:
            out[when] = price
        for v in node.values():
            dig_nav_series(v, out, depth + 1)
    elif isinstance(node, list):
        for v in node:
            dig_nav_series(v, out, depth + 1)
    return out


def dig_nav(node, depth: int = 0):
    """Find a (nav, date) pair anywhere in a JSON document. The ISIN
    endpoint is not documented, so rather than hard-coding a path that may not
    exist, look for the shape: a plausible price beside a plausible date."""
    if depth > 6:
        return None
    if isinstance(node, dict):
        price = None
        for k in ("nav", "navValue", "value", "price", "unitPrice", "netAssetValue", "kurs"):
            if k in node:
                price = num(node[k])
                if price:
                    break
        when = None
        for k in ("navDate", "date", "asOf", "asOfDate", "valuationDate", "dato"):
            v = node.get(k)
            if isinstance(v, str) and re.match(r"\d{4}-\d{2}-\d{2}", v):
                when = v[:10]
                break
        if price and price > 0:
            return price, when
        for v in node.values():
            got = dig_nav(v, depth + 1)
            if got:
                return got
    elif isinstance(node, list):
        # Newest first if the list carries dates; otherwise last entry wins.
        for v in reversed(node):
            got = dig_nav(v, depth + 1)
            if got:
                return got
    return None


def fetch_nav(fund: dict, probe: bool = False):
    """-> (nav, navDate, source, series). source is 'isin' | 'yahoo' | 'manual'
    | 'inline' | 'stale', and the app says which on screen so a frozen price
    cannot pass itself off as today's. series is {iso date: nav} when the source
    carries history, otherwise None.

    The default is 'manual' — hold the price in the file and label it — because
    a price nobody checked is the one failure this app must never hide."""
    want = (fund.get("navSource") or "manual").strip()
    isin = fund.get("isin") or ""

    if want == "inline":
        series = {k: float(v) for k, v in (fund.get("navSeries") or {}).items()
                  if num(v)}
        if series:
            newest = max(series)
            return series[newest], newest, "inline", series
        return num(fund.get("nav")), None, "manual", None

    if want == "manual" or want.startswith("manual"):
        return num(fund.get("nav")), None, "manual", None

    if want.startswith("yahoo:"):
        symbol = want.split(":", 1)[1]
        try:
            doc = http_json(YAHOO_CHART.format(symbol=parse.quote(symbol)))
            res = doc["chart"]["result"][0]
            price = num(res["meta"].get("regularMarketPrice"))
            stamp = res["meta"].get("regularMarketTime")
            when = datetime.fromtimestamp(stamp, timezone.utc).date().isoformat() if stamp else None
            series = {}
            stamps = res.get("timestamp") or []
            closes = ((res.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
            for t, c in zip(stamps, closes):
                if isinstance(c, (int, float)):
                    series[datetime.fromtimestamp(t, timezone.utc).date().isoformat()] = float(c)
            if probe:
                log(f"  yahoo {symbol}: {price} @ {when}, {len(series)} historical points")
            if price:
                return price, when, "yahoo", (series or None)
        except Exception as e:                 # noqa: BLE001
            log(f"  yahoo {symbol}: {e}")
        keep = num(fund.get("nav"))
        return keep, None, ("stale" if keep else "unavailable"), None

    for tmpl in ISIN_NAV:
        url = tmpl.format(isin=parse.quote(isin))
        try:
            doc = http_json(url, tries=1)
        except Exception as e:                 # noqa: BLE001
            if probe:
                log(f"  {url} -> {e}")
            continue
        if probe:
            log(f"  {url} -> {json.dumps(doc)[:400]}")
        series = dig_nav_series(doc)
        got = dig_nav(doc)
        if series:
            newest = max(series)
            return series[newest], newest, "isin", series
        if got:
            return got[0], got[1], "isin", None

    # Nothing answered. Keep the last known price and flag it rather than
    # silently valuing the portfolio at zero — and if there is no last known
    # price either, say that instead, because the two are not the same problem.
    keep = num(fund.get("nav"))
    return keep, None, ("stale" if keep else "unavailable"), None


# ── Fund units ──────────────────────────────────────────────────────────────

def business_days_after(d: date, n: int) -> date:
    out = d
    while n > 0:
        out += timedelta(days=1)
        if out.weekday() < 5:
            n -= 1
    return out


def find_purchases(txns: list, matches: list, after: date | None, amounts=None):
    """Money leaving the bank for a fund platform -> [(date, amount)].

    `amounts` exists because one platform can hold several pots and the bank
    text does not tell them apart: a bank will happily write the same line for
    the standing purchase into a fund account and the smaller one into a
    pension, and only the size separates them. Leave it out and every match counts. Anything paid in at
    another size — an ad-hoc deposit — is not accrued, which is what
    re-anchoring the unit counts is for.
    """
    wanted = [round(float(a), 2) for a in (amounts or []) if num(a) is not None]
    out = []
    for t in txns:
        if t["amount"] >= 0:
            continue
        if not any(m in fold(t["text"]) for m in matches):
            continue
        paid = round(-t["amount"], 2)
        if wanted and paid not in wanted:
            continue
        d = date.fromisoformat(t["date"])
        if after and d <= after:
            continue
        out.append((d, paid))
    out.sort()
    return out


def build_investments(cfg: dict, txns: list, probe: bool = False):
    """Units held = the anchor you copied from your provider, plus every
    purchase since, divided by the NAV it settled at.

    Where the price source carries history, that last number is the real NAV on
    the settlement day and the whole portfolio can be valued on any past date.
    Where it does not, today's NAV stands in for every purchase, which is the
    estimate the app labels — and the reason to re-anchor.
    """
    pot = (cfg or {}).get("investments") or {}
    if not pot.get("enabled") or not pot.get("funds"):
        return None, []

    funds = pot["funds"]
    matches = [fold(m) for m in pot.get("match", [])]
    anchor = pot.get("anchorDate")
    anchor_d = date.fromisoformat(anchor) if anchor else None
    settle = int(pot.get("settlementDays") or 0)

    total_alloc = sum(num(f.get("allocation"), 0) or 0 for f in funds)
    if total_alloc <= 0:
        log("holdings.json: allocations add up to zero — nothing can be accrued")
        total_alloc = 1.0

    purchases = find_purchases(txns, matches, anchor_d, pot.get("matchAmounts"))

    out_funds, priced = [], []
    for f in funds:
        nav, nav_date, src, series = fetch_nav(f, probe=probe)
        share = (num(f.get("allocation"), 0) or 0) / total_alloc
        base_units = num(f.get("units"), 0) or 0.0
        base_cost = num(f.get("costBasis"), 0) or 0.0

        # Units the anchor did not know about, each priced at its settlement day.
        accrued = []
        units = base_units
        for d, amount in purchases:
            paid = amount * share
            settled = business_days_after(d, settle)
            at = interpolate(series, settled) if series else nav
            if at and at > 0:
                units += paid / at
            accrued.append((settled, paid))

        cost = base_cost + sum(p for _d, p in accrued)
        value = (units * nav) if (nav and nav > 0) else 0.0
        priced.append({
            "share": share, "baseUnits": base_units, "accrued": accrued,
            "series": series, "nav": nav,
        })
        out_funds.append({
            "name": f.get("name") or f.get("isin") or "Fund",
            "isin": f.get("isin"),
            "units": round(units, 4),
            "nav": round(nav, 4) if nav else None,
            "navDate": nav_date,
            "value": round(value, 2),
            "costBasis": round(cost, 2),
            "allocation": round(share, 4),
            "navSource": src,
            "hasHistory": bool(series),
        })

    total = round(sum(f["value"] for f in out_funds), 2)
    cost = round(sum(f["costBasis"] for f in out_funds), 2)

    monthly = None
    if purchases:
        window = [(d, a) for d, a in purchases if d >= today() - timedelta(days=120)]
        months = len({(d.year, d.month) for d, _ in window})
        if window and months:
            monthly = round(sum(a for _d, a in window) / months, 2)

    unpriced = [f["name"] for f in out_funds if not f["nav"]]

    inv = {
        "total": total,
        "unpriced": unpriced,
        "costBasis": cost,
        "unrealised": round(total - cost, 2),
        "monthly": monthly,
        "anchoredAt": anchor,
        "accruedSince": len(purchases),
        "funds": out_funds,
    }

    # How much of the past line is the market and how much is just money going
    # in. With a NAV series it is both; with only a spot price the units still
    # move for real while the price is held flat, and the app says which.
    with_history = sum(1 for p in priced if p["series"])
    inv["historyBasis"] = ("market" if with_history == len(priced) and priced
                           else "contributions" if with_history == 0
                           else "mixed")

    def nav_at(p, when: date):
        return interpolate(p["series"], when) if p["series"] else p["nav"]

    def value_on(when: date) -> float:
        total_v = 0.0
        for p in priced:
            at = nav_at(p, when)
            if not at or at <= 0:
                continue
            units = p["baseUnits"]
            for settled, paid in p["accrued"]:
                if settled <= when:
                    bought_at = nav_at(p, settled)
                    if bought_at and bought_at > 0:
                        units += paid / bought_at
            total_v += units * at
        return total_v

    def contributed_on(when: date) -> float:
        base = sum((num(f.get("costBasis"), 0) or 0) for f in funds)
        return base + sum(a for d, a in purchases if d <= when)

    inv["_valueOn"] = value_on
    inv["_contributedOn"] = contributed_on

    days, values, contributed = [], [], []
    cursor = today() - timedelta(days=364)
    while cursor <= today():
        days.append(cursor.isoformat())
        values.append(round(value_on(cursor), 2))
        contributed.append(round(contributed_on(cursor), 2))
        cursor += timedelta(days=7)
    inv["series"] = {"days": days, "value": values, "contributed": contributed}

    return inv, purchases


# ── Pension ─────────────────────────────────────────────────────────────────
# Its own thing, deliberately: money you cannot touch for decades does not
# belong in the same figure as the balance of your current account, and a
# pension that quietly inflated net worth would flatter every other number on
# screen. So it is counted, broken out, and can be switched off.
#
# Two shapes, because the money arrives two ways. A personal pension is paid
# from your own bank account, so its purchases are in the bank feed and accrue
# exactly like a fund account's do. An employer's pension account never touches your bank at
# all — no transaction anywhere says it happened — so it is anchored to a value
# you read off once, and moved by a proxy fund until you re-anchor it. The app
# says which of the two any figure is, and how old the anchor is.

def build_pension(cfg: dict, txns: list, probe: bool = False):
    pen = (cfg or {}).get("pension") or {}
    if not pen.get("enabled") or not pen.get("accounts"):
        return None

    accounts, priced_accounts, notes = [], [], []
    for acc in pen["accounts"]:
        anchor = acc.get("anchorDate")
        anchor_d = date.fromisoformat(anchor) if anchor else None
        contrib = acc.get("contributions") or {}
        matches = [fold(m) for m in contrib.get("match") or []]
        purchases = (find_purchases(txns, matches, anchor_d, contrib.get("amounts"))
                     if matches else [])

        funds_cfg = acc.get("funds") or []
        if funds_cfg:
            # Unit-priced, like any other fund holding.
            total_alloc = sum(num(f.get("allocation"), 0) or 0 for f in funds_cfg) or 1.0
            out_funds, priced = [], []
            for f in funds_cfg:
                nav, nav_date, src, series = fetch_nav(f, probe=probe)
                share = (num(f.get("allocation"), 0) or 0) / total_alloc
                units = num(f.get("units"), 0) or 0.0
                accrued = []
                for d, amount in purchases:
                    paid = amount * share
                    at = interpolate(series, d) if series else nav
                    if at and at > 0:
                        units += paid / at
                    accrued.append((d, paid))
                value = units * nav if (nav and nav > 0) else 0.0
                cost = (num(f.get("costBasis"), 0) or 0.0) + sum(p for _d, p in accrued)
                out_funds.append({
                    "name": f.get("name"), "isin": f.get("isin"),
                    "units": round(units, 6), "nav": round(nav, 4) if nav else None,
                    "navDate": nav_date, "navSource": src,
                    "value": round(value, 2), "costBasis": round(cost, 2),
                    "allocation": round(share, 4),
                })
                priced.append({"series": series, "nav": nav, "baseUnits": num(f.get("units"), 0) or 0.0,
                               "accrued": accrued})
            value = round(sum(f["value"] for f in out_funds), 2)
            cost = round(sum(f["costBasis"] for f in out_funds), 2)
            basis = "units held, priced at published NAV"
            if any(f["nav"] is None for f in out_funds):
                notes.append(f"{acc.get('label')}: no price for "
                             + ", ".join(f["name"] for f in out_funds if f["nav"] is None))

            def value_on(when: date, priced=priced):
                out = 0.0
                for p in priced:
                    at = interpolate(p["series"], when) if p["series"] else p["nav"]
                    if not at or at <= 0:
                        continue
                    units = p["baseUnits"]
                    for d, paid in p["accrued"]:
                        if d <= when:
                            bought = interpolate(p["series"], d) if p["series"] else p["nav"]
                            if bought and bought > 0:
                                units += paid / bought
                    out += units * at
                return out
        else:
            # Value-anchored, because nothing here is readable: an employer's
            # pension account is not a payment account and its funds are not
            # quoted anywhere public. The anchor is what you last read off, and
            # a proxy fund carries it forward so it is not simply frozen — an
            # estimate, labelled as one, not a measurement.
            out_funds = []
            anchor_value = num(acc.get("anchorValue"), 0.0) or 0.0
            proxy = acc.get("proxy") or {}
            _nav, _d, _src, series = fetch_nav({"navSource": proxy.get("source") or "manual",
                                                "nav": None}, probe=probe)
            base_ix = interpolate(series, anchor_d) if (series and anchor_d) else None
            if base_ix and base_ix > 0:
                basis = f"anchored {anchor}, carried by {proxy.get('label') or 'a proxy fund'}"

                def value_on(when: date, series=series, base=base_ix, av=anchor_value,
                             start=anchor_d):
                    if when <= start:
                        return av           # before the anchor it is just the anchor
                    at = interpolate(series, when)
                    return av * (at / base) if at and at > 0 else av
            else:
                basis = f"held at the value read on {anchor}"
                notes.append(f"{acc.get('label')}: no proxy price, so it holds its anchor value")

                def value_on(when: date, av=anchor_value):
                    return av

            value = round(value_on(today()), 2)
            cost = round(num(acc.get("contributedTotal"), 0.0) or 0.0, 2)

        accounts.append({
            "id": acc.get("id"), "label": acc.get("label") or acc.get("id"),
            "provider": acc.get("provider"), "kind": acc.get("kind") or "pension",
            "value": value, "costBasis": cost,
            "anchoredAt": anchor, "accruedSince": len(purchases),
            "basis": basis, "funds": out_funds,
            "note": acc.get("note"),
        })
        priced_accounts.append(value_on)

    total = round(sum(a["value"] for a in accounts), 2)
    cost = round(sum(a["costBasis"] for a in accounts), 2)
    counted = total if pen.get("includeInNetWorth", True) else 0.0

    def all_on(when: date) -> float:
        if not pen.get("includeInNetWorth", True):
            return 0.0
        return sum(fn(when) for fn in priced_accounts)

    return {
        "provider": pen.get("provider") or "Pension",
        "total": total, "costBasis": cost, "counted": round(counted, 2),
        "includeInNetWorth": bool(pen.get("includeInNetWorth", True)),
        "accounts": accounts,
        "notes": notes,
        "_valueOn": all_on,
    }


# ── Employee shares ─────────────────────────────────────────────────────────
# A share-plan administrator usually cannot be read: its API is a partner
# integration sold to an employer's HR system, not something a participant can
# call, and a share plan is not a payment account so PSD2 does not reach it
# either. What IS public is the share price and the exchange rate — and vesting
# dates are known in advance, which makes the whole thing a function of the
# date. Copy the grants out of your plan's portal once and nothing needs
# touching again: tranches turn from unvested into vested as their dates pass,
# on their own.

def fetch_fx(base: str, quote: str = "NOK", probe: bool = False):
    """-> (rate, date, series, source). Norges Bank, daily, official."""
    base = (base or "").upper()
    if not base or base == quote.upper():
        return 1.0, None, None, "none"

    url = NB_FX.format(base=base, quote=quote.upper(),
                       start=(today() - timedelta(days=1500)).isoformat(),
                       end=today().isoformat())
    try:
        req = request.Request(url, headers={
            "Accept": "text/csv",
            "User-Agent": USER_AGENT,
        })
        with request.urlopen(req, timeout=45) as r:
            text = r.read().decode("utf-8-sig", errors="replace")
    except Exception as e:                        # noqa: BLE001
        log(f"  Norges Bank {base}/{quote}: {e}")
        return None, None, None, "unavailable"

    import csv as _csv
    rows = list(_csv.reader(io.StringIO(text), delimiter=";"))
    if len(rows) < 2 or len(rows[0]) < 2:
        rows = list(_csv.reader(io.StringIO(text)))
    if len(rows) < 2:
        log(f"  Norges Bank {base}/{quote}: no rows")
        return None, None, None, "unavailable"

    header = [h.strip().upper() for h in rows[0]]
    def col(*names, default=None):
        for n in names:
            if n in header:
                return header.index(n)
        return default

    i_time = col("TIME_PERIOD", "TIME", default=len(header) - 2)
    i_val = col("OBS_VALUE", "VALUE", default=len(header) - 1)
    i_mult = col("UNIT_MULT")

    series = {}
    for row in rows[1:]:
        if len(row) <= max(i_time, i_val):
            continue
        when, raw = row[i_time].strip(), num(row[i_val].strip().replace(",", "."))
        if not re.match(r"\d{4}-\d{2}-\d{2}", when) or raw is None:
            continue
        # A rate quoted per 100 units is 100x too big until this is applied.
        mult = 0
        if i_mult is not None and len(row) > i_mult:
            mult = int(num(row[i_mult].strip(), 0) or 0)
        series[when[:10]] = raw / (10 ** mult)

    if not series:
        log(f"  Norges Bank {base}/{quote}: parsed no observations")
        return None, None, None, "unavailable"
    newest = max(series)
    if probe:
        log(f"  Norges Bank {base}/{quote}: {len(series)} days, "
            f"latest {series[newest]:.4f} on {newest}")
    return series[newest], newest, series, "norges-bank"


def build_equity(cfg: dict, probe: bool = False):
    """Employee shares, valued from a public quote and an official FX rate, with
    vesting handled by the calendar rather than by anyone remembering."""
    eq = (cfg or {}).get("equity") or {}
    if not eq.get("enabled") or not eq.get("grants"):
        return None

    quote_cfg = eq.get("quote") or {}
    currency = (quote_cfg.get("currency") or "NOK").upper()

    # The quote reuses the fund price machinery, so "yahoo:ABB" and "manual"
    # behave exactly as they do for a fund, history included.
    price, price_date, price_src, price_series = fetch_nav({
        "navSource": quote_cfg.get("source") or "manual",
        "nav": quote_cfg.get("price"),
        "navSeries": quote_cfg.get("priceSeries") or quote_cfg.get("navSeries"),
        "isin": quote_cfg.get("symbol") or "",
    }, probe=probe)

    fx_series = None
    if quote_cfg.get("fxSeries"):
        fx_series = {k: float(v) for k, v in quote_cfg["fxSeries"].items() if num(v)}
        fx, fx_date, fx_src = fx_series[max(fx_series)], max(fx_series), "inline"
    else:
        fx, fx_date, fx_series, fx_src = fetch_fx(currency, probe=probe)

    if price is None or fx is None:
        log("equity: no usable price or exchange rate; leaving it out of net worth")
        return {"provider": eq.get("provider") or "Employee shares",
                "symbol": quote_cfg.get("symbol"), "currency": currency,
                "price": price, "fxRate": fx, "counted": 0.0, "vested": 0.0,
                "unvested": 0.0, "grants": [], "upcoming": [],
                "error": "no usable price or exchange rate"}

    include_unvested = bool(eq.get("includeUnvested"))
    tax = num(eq.get("unvestedTaxRate"), 0.0) or 0.0
    now = today()

    def per_share(at_price: float, grant: dict) -> float:
        if (grant.get("kind") or "").lower() == "option":
            strike = num(grant.get("strike"), 0.0) or 0.0
            return max(0.0, at_price - strike)      # under water is worth nothing
        return at_price

    grants, upcoming = [], []
    vested_shares = unvested_shares = 0.0
    vested_val = unvested_val = 0.0
    cost = 0.0

    for g in eq.get("grants") or []:
        tranches = g.get("tranches") or []
        gv_shares = gu_shares = 0.0
        for tr in tranches:
            n = num(tr.get("shares"), 0.0) or 0.0
            when = tr.get("vestDate")
            if when and date.fromisoformat(when) <= now:
                gv_shares += n
            else:
                gu_shares += n
                if when:
                    upcoming.append({
                        "date": when, "shares": n, "label": g.get("label") or g.get("id"),
                        "value": round(n * per_share(price, g) * fx, 2),
                    })
        unit = per_share(price, g) * fx
        gc = num(g.get("costBasis"), 0.0) or 0.0
        vested_shares += gv_shares
        unvested_shares += gu_shares
        vested_val += gv_shares * unit
        unvested_val += gu_shares * unit
        cost += gc
        grants.append({
            "id": g.get("id") or g.get("label"),
            "label": g.get("label") or g.get("id") or "Grant",
            "kind": (g.get("kind") or "rsu").lower(),
            "strike": num(g.get("strike")),
            "underWater": bool((g.get("kind") or "").lower() == "option"
                               and num(g.get("strike"), 0.0) and price
                               and price <= num(g.get("strike"), 0.0)),
            "vestedShares": round(gv_shares, 4),
            "unvestedShares": round(gu_shares, 4),
            "vested": round(gv_shares * unit, 2),
            "unvested": round(gu_shares * unit, 2),
            "costBasis": round(gc, 2),
            "nextVest": min((t.get("vestDate") for t in tranches
                             if t.get("vestDate") and date.fromisoformat(t["vestDate"]) > now),
                            default=None),
        })

    upcoming.sort(key=lambda u: u["date"])
    unvested_after_tax = unvested_val * (1.0 - tax)
    counted = vested_val + (unvested_after_tax if include_unvested else 0.0)

    out = {
        "provider": eq.get("provider") or "Employee shares",
        "symbol": quote_cfg.get("symbol"),
        "currency": currency,
        "price": round(price, 4),
        "priceDate": price_date,
        "priceSource": price_src,
        "fxRate": round(fx, 6),
        "fxDate": fx_date,
        "fxSource": fx_src,
        "vestedShares": round(vested_shares, 4),
        "unvestedShares": round(unvested_shares, 4),
        "vested": round(vested_val, 2),
        "unvested": round(unvested_val, 2),
        "unvestedAfterTax": round(unvested_after_tax, 2),
        "unvestedTaxRate": tax,
        "includeUnvested": include_unvested,
        "counted": round(counted, 2),
        "costBasis": round(cost, 2),
        "unrealised": round(counted - cost, 2),
        "grants": grants,
        "upcoming": upcoming[:6],
        "error": None,
    }

    # Shares vested on a past day, at that day's price and that day's rate — all
    # three are functions of the date, so the history is real wherever the price
    # and FX series reach.
    def value_on(when: date) -> float:
        p = interpolate(price_series, when) if price_series else price
        f = interpolate(fx_series, when) if fx_series else fx
        if not p or not f:
            return 0.0
        total = 0.0
        for g in eq.get("grants") or []:
            unit = per_share(p, g) * f
            held = 0.0
            for tr in g.get("tranches") or []:
                w = tr.get("vestDate")
                n = num(tr.get("shares"), 0.0) or 0.0
                if w and date.fromisoformat(w) <= when:
                    held += n
                elif include_unvested:
                    held += n * (1.0 - tax)
            total += held * unit
        return total

    out["_valueOn"] = value_on
    out["historyBasis"] = ("market" if price_series and fx_series
                           else "partial" if (price_series or fx_series)
                           else "flat")

    days, values = [], []
    cursor = today() - timedelta(days=364)
    while cursor <= today():
        days.append(cursor.isoformat())
        values.append(round(value_on(cursor), 2))
        cursor += timedelta(days=7)
    out["series"] = {"days": days, "value": values}
    return out


# ── Things no bank reports ──────────────────────────────────────────────────
# A house, a cabin, a car, and the loans against them. None of it is fetched
# from an account: each is anchored to a value on a date and then moved by a
# method chosen in assets.json. What makes this more than a guess is that two
# of the three methods are deterministic functions of the date — so the value
# on any past day is computable, and the net worth history covers the largest,
# slowest part of a balance sheet with real numbers rather than a flat line.

def http_post_json(url: str, body: dict, tries: int = 3):
    data = json.dumps(body).encode()
    for attempt in range(tries):
        try:
            req = request.Request(url, data=data, method="POST", headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            })
            with request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except Exception:                      # noqa: BLE001
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)


def period_to_date(label: str) -> str | None:
    """SSB writes quarters as 2026K2, months as 2026M06, years as 2026. Each maps
    to the LAST day it describes — an index published for Q2 is what the market
    did up to the end of June, not on the first of April."""
    label = str(label).strip()
    m = re.fullmatch(r"(\d{4})K([1-4])", label)
    if m:
        year, q = int(m.group(1)), int(m.group(2))
        month = q * 3
        return date(year, month, _month_len(year, month)).isoformat()
    m = re.fullmatch(r"(\d{4})M(\d{2})", label)
    if m:
        year, month = int(m.group(1)), int(m.group(2))
        if 1 <= month <= 12:
            return date(year, month, _month_len(year, month)).isoformat()
    m = re.fullmatch(r"(\d{4})", label)
    if m:
        return date(int(m.group(1)), 12, 31).isoformat()
    return None


def _month_len(year: int, month: int) -> int:
    nxt = date(year + (month == 12), (month % 12) + 1, 1)
    return (nxt - timedelta(days=1)).day


_ssb_meta_cache: dict[str, dict] = {}


def ssb_metadata(table: str = SSB_TABLE) -> dict:
    if table not in _ssb_meta_cache:
        _ssb_meta_cache[table] = http_json(SSB_URL.format(table=table))
    return _ssb_meta_cache[table]


def ssb_resolve(variable: dict, wanted: str) -> str | None:
    """Match a name from assets.json against what the table actually offers.
    Exact code, then exact label, then a substring — so "hele landet" finds
    "Hele landet" and "blokk" finds "Blokkleiligheter" without anyone copying
    numeric codes."""
    values = variable.get("values") or []
    texts = variable.get("valueTexts") or []
    want = fold(str(wanted))
    for code in values:
        if fold(code) == want:
            return code
    for code, text in zip(values, texts):
        if fold(text) == want:
            return code
    for code, text in zip(values, texts):
        if want in fold(text):
            return code
    return None


def ssb_contents_codes(meta: dict) -> list:
    """The table's index variants, SEASONALLY ADJUSTED FIRST.

    A house anchored in a weak quarter and valued in a strong one gains several
    points of pure calendar: in a single city's unadjusted detached-house
    series three consecutive quarters can read 123.8, then 117.8, then 135.0,
    and anchoring on that trough overstates every later ratio. The adjusted series exists for exactly
    this, but not for every region and dwelling type — so it is a preference,
    not a requirement, and the caller falls back to whatever does answer.
    """
    for var in meta.get("variables") or []:
        if (var.get("code") or "").lower() not in ("contentscode", "innhold"):
            continue
        values = var.get("values") or []
        texts = var.get("valueTexts") or []
        indices = [(v, t) for v, t in zip(values, texts) if "indeks" in fold(t).lower()]
        adjusted = [v for v, t in indices if "sesongjust" in fold(t).lower()]
        plain = [v for v, t in indices if "sesongjust" not in fold(t).lower()]
        return adjusted + plain or ([values[0]] if values else [])
    return [None]


def ssb_series(picks: dict, table: str = SSB_TABLE, probe: bool = False):
    """-> ({iso date: index value}, description, [unresolved picks]).

    Every dimension except time is pinned: the ones named in `picks` to what was
    asked for, and the rest to something sensible — the seasonally adjusted
    index where the table has one for this region and dwelling type, the plain
    one where it does not, and a level rather than a percentage change either
    way.
    """
    meta = ssb_metadata(table)
    variables = meta.get("variables") or []
    if not variables:
        raise RuntimeError(f"SSB table {table} returned no variables")

    contents = ssb_contents_codes(meta)
    for attempt, contents_code in enumerate(contents):
        series, described, missed = _ssb_query(meta, picks, contents_code, table, probe)
        if series:
            return series, described, missed
        # SSB answers an unpublished combination with nulls rather than an
        # error, so an empty series means "not published for this cut" — try
        # the next index variant before giving up.
        if probe:
            log(f"  SSB {table}: nothing published for {described}; trying the next variant")
    raise RuntimeError(f"SSB table {table} answered with no numeric periods")


def _ssb_query(meta: dict, picks: dict, contents_code, table: str, probe: bool):
    query, described, missed = [], [], []
    for var in meta.get("variables") or []:
        code = var.get("code") or ""
        text = (var.get("text") or code)
        if code.lower() in ("tid", "time"):
            continue                              # leave time open: we want it all

        chosen = None
        for key, wanted in picks.items():
            if fold(key) in (fold(code), fold(text)) and wanted:
                chosen = ssb_resolve(var, wanted)
                if chosen is None:
                    missed.append(f"{text}={wanted}")
                break

        if chosen is None and code.lower() in ("contentscode", "innhold"):
            chosen = contents_code

        if chosen is None:
            values = var.get("values") or []
            chosen = values[0] if values else None

        if chosen is None:
            continue
        label = dict(zip(var.get("values") or [], var.get("valueTexts") or [])).get(chosen, chosen)
        described.append(str(label))
        query.append({"code": code, "selection": {"filter": "item", "values": [chosen]}})

    doc = http_post_json(SSB_URL.format(table=table),
                         {"query": query, "response": {"format": "json-stat2"}})
    if probe:
        log(f"  SSB {table} query -> {json.dumps(query, ensure_ascii=False)}")

    values = doc.get("value") or []
    time_dim = None
    for name, dim in (doc.get("dimension") or {}).items():
        if name.lower() in ("tid", "time"):
            time_dim = dim
            break
    if time_dim is None or not values:
        raise RuntimeError(f"SSB table {table} answered without a usable time dimension")

    index = ((time_dim.get("category") or {}).get("index")) or {}
    labels = sorted(index, key=lambda k: index[k]) if isinstance(index, dict) else list(index)

    series = {}
    for label, value in zip(labels, values):
        iso = period_to_date(label)
        if iso is not None and isinstance(value, (int, float)) and value > 0:
            series[iso] = float(value)
    return series, ", ".join(described), missed


def interpolate(series: dict, when: date) -> float | None:
    """A quarterly index that steps once every three months makes net worth jump
    by six figures on publication day, which is an artefact of the calendar and
    not of the market. Straight-line between published points; hold flat outside
    them, because extrapolating a house price is inventing one."""
    if not series:
        return None
    days = sorted(series)
    target = when.isoformat()
    if target <= days[0]:
        return series[days[0]]
    if target >= days[-1]:
        return series[days[-1]]
    lo = max(d for d in days if d <= target)
    hi = min(d for d in days if d >= target)
    if lo == hi:
        return series[lo]
    span = (date.fromisoformat(hi) - date.fromisoformat(lo)).days or 1
    through = (when - date.fromisoformat(lo)).days
    return series[lo] + (series[hi] - series[lo]) * (through / span)


def curve_share(curve: list, tail_rate: float, age_years: float) -> float:
    """Share of value a vehicle still holds at a given age, piecewise-linear
    between the points given and continuing at tailRate a year past the last."""
    pts = sorted((float(a), float(s)) for a, s in curve if s is not None)
    if not pts:
        return 1.0
    if age_years <= pts[0][0]:
        return pts[0][1]
    for (a0, s0), (a1, s1) in zip(pts, pts[1:]):
        if age_years <= a1:
            span = (a1 - a0) or 1.0
            return s0 + (s1 - s0) * ((age_years - a0) / span)
    a_last, s_last = pts[-1]
    return s_last * ((1.0 - tail_rate) ** (age_years - a_last))


def asset_value_on(item: dict, when: date, ssb_cache: dict):
    """-> (value, basis). basis names the method AND what it resolved to, so a
    fallback never passes itself off as the thing that was asked for."""
    anchor = num(item.get("anchorValue"))
    if anchor is None:
        return None, "no anchorValue"
    a_date = item.get("anchorDate")
    a_day = date.fromisoformat(a_date) if a_date else when
    method = (item.get("method") or "fixed").strip()

    if method == "ssb-bolig":
        key = (item.get("region") or "", item.get("dwellingType") or "")
        entry = ssb_cache.get(key)
        if entry and entry[0]:
            series, described = entry
            now_ix = interpolate(series, when)
            base_ix = interpolate(series, a_day)
            if now_ix and base_ix:
                return anchor * (now_ix / base_ix), f"SSB {SSB_TABLE} — {described}"
        return anchor, "SSB index unavailable — holding the anchor value"

    if method == "rate":
        rate = num(item.get("annualRate"), 0.0) or 0.0
        years = (when - a_day).days / 365.25
        return anchor * ((1.0 + rate) ** years), f"assumed {rate * 100:.2f} %/yr"

    if method == "depreciation":
        reg = item.get("firstRegistered")
        born = date.fromisoformat(reg) if reg else a_day
        curve = item.get("curve") or [[0, 1.0]]
        tail = num(item.get("tailRate"), 0.10) or 0.10
        floor = num(item.get("floor"), 0.0) or 0.0
        share_now = curve_share(curve, tail, max(0.0, (when - born).days / 365.25))
        share_anchor = curve_share(curve, tail, max(0.0, (a_day - born).days / 365.25))
        if share_anchor <= 0:
            return anchor, "depreciation curve is degenerate — holding the anchor"
        value = max(floor, anchor * (share_now / share_anchor))
        age = (when - born).days / 365.25
        return value, f"depreciation curve, age {age:.1f} yr"

    return anchor, "held at the anchor value"


def loan_balance_on(loan: dict, when: date):
    """Remaining principal, as a NEGATIVE number, from the loan's own terms.
    PSD2 covers payment accounts and a mortgage usually is not one, so this is
    modelled rather than read — which is fine, because amortisation is
    arithmetic, and the one input that drifts (the rate) is in the config."""
    principal = num(loan.get("principal"))
    n = int(num(loan.get("termMonths"), 0) or 0)
    if principal is None or n <= 0:
        return None, None, "needs principal and termMonths"
    start = loan.get("startDate")
    if not start:
        return None, None, "needs startDate"
    s_day = date.fromisoformat(start)

    months = (when.year - s_day.year) * 12 + (when.month - s_day.month)
    if when.day < s_day.day:
        months -= 1
    k = max(0, min(n, months))

    r = (num(loan.get("nominalRate"), 0.0) or 0.0) / 12.0
    kind = (loan.get("kind") or "annuity").lower()

    if kind.startswith("serial"):
        remaining = principal * (1.0 - k / n)
        payment = principal / n + (principal - principal * (k / n)) * r
    elif r <= 0:
        remaining = principal * (1.0 - k / n)
        payment = principal / n
    else:
        growth = (1.0 + r) ** n
        remaining = principal * (growth - (1.0 + r) ** k) / (growth - 1.0)
        payment = principal * r / (1.0 - (1.0 + r) ** -n)

    return -max(0.0, remaining), payment, f"modelled {kind}, {k} of {n} payments made"


def asset_variants(item: dict) -> list:
    """The valuation bases one ssb-bolig asset offers, as
    [(id, label, region, dwellingType)]. Empty when the asset names none, and
    then the asset is valued the one way its own region and type describe.

    This exists because no single cut of the index is obviously right, and the
    table does not publish every combination: a given city may have a
    seasonally adjusted series for all dwellings while only the country has one
    for detached houses, so the choice is between a local figure and an
    exact-type one and it belongs to whoever owns the house. The file names the
    ones worth offering, the app puts them behind a switch, and the FIRST is
    what net worth uses until someone chooses otherwise.
    """
    out = []
    for v in item.get("variants") or []:
        region = v.get("region") or item.get("region") or ""
        kind = v.get("dwellingType") or item.get("dwellingType") or ""
        vid = v.get("id") or fold(f"{region}-{kind}").lower()
        out.append((vid, v.get("label") or vid, region, kind))
    return out


def variant_item(item: dict, region: str, kind: str) -> dict:
    """The same asset, valued against a different cut of the index."""
    out = dict(item)
    out["region"], out["dwellingType"] = region, kind
    return out


def build_assets(cfg: dict, when: date, accounts: list | None = None,
                 probe: bool = False, ssb_override: dict | None = None):
    """-> (items, loans, ssb_cache, notes). ssb_cache is handed back so the
    history can re-price every past day without re-fetching the index."""
    items_cfg = (cfg or {}).get("assets") or []
    loans_cfg = (cfg or {}).get("loans") or []
    notes: list[str] = []

    # One SSB request per distinct (region, dwelling type), not one per asset.
    ssb_cache: dict[tuple, tuple] = dict(ssb_override or {})
    wanted_keys = []
    for item in items_cfg:
        if (item.get("method") or "") != "ssb-bolig":
            continue
        variants = asset_variants(item)
        wanted_keys += [(r, k) for _id, _lbl, r, k in variants]
        if not variants:
            wanted_keys.append((item.get("region") or "", item.get("dwellingType") or ""))
    for key in wanted_keys:
        if key in ssb_cache:
            continue
        item = {"name": f"{key[0]} {key[1]}".strip()}
        try:
            series, described, missed = ssb_series(
                {"region": key[0], "boligtype": key[1]}, probe=probe)
            ssb_cache[key] = (series, described)
            if missed:
                notes.append(f"SSB: could not match {', '.join(missed)} — used {described}")
            log(f"SSB {SSB_TABLE}: {len(series)} periods for {described}")
        except Exception as e:                    # noqa: BLE001
            ssb_cache[key] = (None, "")
            notes.append(f"SSB index unavailable ({e}); {item.get('name')} held at its anchor")
            log(f"SSB {SSB_TABLE} failed for {key}: {e}")

    items = []
    for item in items_cfg:
        # With variants, the first one is what net worth is built from; the
        # others ride along so the app can offer them without another fetch.
        variants = asset_variants(item)
        priced = variant_item(item, variants[0][2], variants[0][3]) if variants else item

        value, basis = asset_value_on(priced, when, ssb_cache)
        if value is None:
            notes.append(f"{item.get('name') or item.get('id')}: {basis}")
            continue
        year_ago, _ = asset_value_on(priced, when - timedelta(days=365), ssb_cache)
        anchor = num(item.get("anchorValue"), 0.0) or 0.0
        entry = {
            "id": item.get("id") or item.get("name"),
            "name": item.get("name") or item.get("id") or "Asset",
            "kind": item.get("kind") or "other",
            "value": round(value, 2),
            "anchorValue": round(anchor, 2),
            "anchorDate": item.get("anchorDate"),
            "basis": basis,
            "note": item.get("note"),
            "changeSinceAnchor": round(value - anchor, 2),
            "change365d": round(value - year_ago, 2) if year_ago is not None else None,
        }
        if variants:
            entry["variants"] = []
            for vid, label, region, kind in variants:
                v_value, v_basis = asset_value_on(
                    variant_item(item, region, kind), when, ssb_cache)
                if v_value is None:
                    continue
                entry["variants"].append({
                    "id": vid, "label": label,
                    "value": round(v_value, 2), "basis": v_basis,
                    "_cfg": variant_item(item, region, kind),
                })
        items.append(entry)

    by_name = {fold(a.get("name") or ""): a for a in (accounts or [])}

    loans = []
    for loan in loans_cfg:
        # If the bank reports the loan, that figure is the truth and the model
        # is only ever the stand-in. Counting both would double the debt, so the
        # real one wins and the modelled one is marked as coming from the bank.
        prefer = loan.get("preferBankBalance")
        bank = by_name.get(fold(prefer)) if prefer else None
        if bank is None and prefer:
            bank = next((a for a in (accounts or [])
                         if fold(prefer) in fold(a.get("name") or "")), None)

        balance, payment, basis = loan_balance_on(loan, when)
        if bank is not None and isinstance(bank.get("balance"), (int, float)):
            balance = -abs(float(bank["balance"]))
            basis = f"reported by the bank as {bank.get('name')}"
        elif balance is None:
            notes.append(f"{loan.get('name') or loan.get('id')}: {basis}")
            continue

        principal = num(loan.get("principal"), 0.0) or 0.0
        loans.append({
            "id": loan.get("id") or loan.get("name"),
            "name": loan.get("name") or "Loan",
            "against": loan.get("against"),
            "balance": round(balance, 2),
            "principal": round(principal, 2),
            "paidOff": round(1.0 - (abs(balance) / principal), 4) if principal else None,
            "monthlyPayment": round(payment, 2) if payment else None,
            "nominalRate": num(loan.get("nominalRate")),
            "startDate": loan.get("startDate"),
            "termMonths": int(num(loan.get("termMonths"), 0) or 0),
            "kind": (loan.get("kind") or "annuity"),
            "basis": basis,
            "fromBank": bank is not None,
            "_cfg": loan,
        })

    return items, loans, ssb_cache, notes


# ── Aggregates ──────────────────────────────────────────────────────────────

def build_spending(txns: list, cat: Categoriser, window: int = 30):
    end = today()
    start = end - timedelta(days=window)
    prev_start = start - timedelta(days=window)

    def spend_in(a: date, b: date):
        out = {}
        for t in txns:
            d = date.fromisoformat(t["date"])
            if not (a < d <= b):
                continue
            # Money moving between your own accounts is not spending, and
            # neither is money you put into your own funds.
            if t["amount"] >= 0 or t["category"] in ("transfers", "savings", "income"):
                continue
            out.setdefault(t["category"], []).append(-t["amount"])
        return out

    now = spend_in(start, end)
    before = spend_in(prev_start, start)

    cats = []
    for cid, amounts in now.items():
        cats.append({
            "id": cid,
            "label": cat.labels.get(cid, cid.title()),
            "amount": round(sum(amounts), 2),
            "count": len(amounts),
            "previous": round(sum(before.get(cid, [])), 2),
        })
    cats.sort(key=lambda c: -c["amount"])

    merchants = {}
    for t in txns:
        d = date.fromisoformat(t["date"])
        if not (start < d <= end) or t["amount"] >= 0:
            continue
        if t["category"] in ("transfers", "savings", "income"):
            continue
        key = merchant_key(t["text"])
        m = merchants.setdefault(key, {"label": titlecase(key), "amount": 0.0, "count": 0})
        m["amount"] += -t["amount"]
        m["count"] += 1
    top = sorted(merchants.values(), key=lambda m: -m["amount"])[:12]
    for m in top:
        m["amount"] = round(m["amount"], 2)

    return {
        "windowDays": window,
        "from": start.isoformat(),
        "to": end.isoformat(),
        "total": round(sum(c["amount"] for c in cats), 2),
        "previousTotal": round(sum(sum(v) for v in before.values()), 2),
        "categories": cats,
        "merchants": top,
    }


def build_cashflow(txns: list, months: int = CASHFLOW_MONTHS):
    buckets = {}
    for t in txns:
        # Internal moves would appear as both income and spending in the same
        # month and double the size of both bars.
        if t["category"] == "transfers":
            continue
        ym = t["date"][:7]
        b = buckets.setdefault(ym, {"in": 0.0, "out": 0.0})
        if t["amount"] >= 0:
            b["in"] += t["amount"]
        else:
            b["out"] += -t["amount"]
    if not buckets:
        return None
    keys = sorted(buckets)[-months:]
    # The current month is still being written; showing it beside full months
    # makes a normal month look like a collapse.
    if keys and keys[-1] == today().strftime("%Y-%m") and len(keys) > 1:
        keys = keys[:-1]
    return {
        "months": keys,
        "in": [round(buckets[k]["in"], 2) for k in keys],
        "out": [round(buckets[k]["out"], 2) for k in keys],
    }


def build_recurring(txns: list):
    """A charge that landed in at least three different months at roughly the
    same size is something you are subscribed to, not something you bought."""
    groups = {}
    for t in txns:
        if t["amount"] >= 0 or t["category"] == "transfers":
            continue
        groups.setdefault(merchant_key(t["text"]), []).append(t)

    out = []
    for key, rows in groups.items():
        months = sorted({r["date"][:7] for r in rows})
        if len(months) < 3:
            continue
        amounts = sorted(-r["amount"] for r in rows)
        median = amounts[len(amounts) // 2]
        if median <= 0:
            continue
        spread = max(abs(a - median) / median for a in amounts)
        if spread > 0.25:
            continue
        rows.sort(key=lambda r: r["date"])
        last = date.fromisoformat(rows[-1]["date"])
        if last < today() - timedelta(days=70):
            continue
        nxt = last + timedelta(days=30)
        out.append({
            "label": rows[-1]["text"][:48],
            "amount": -round(median, 2),
            "cadence": "monthly",
            "lastSeen": last.isoformat(),
            "nextExpected": nxt.isoformat(),
        })
    out.sort(key=lambda r: r["amount"])
    return out[:14]


def build_history(point: dict, txns: list, compose, days_back: int = HISTORY_DAYS):
    """One point per day, RECOMPUTED from scratch every run rather than appended
    to.

    Everything except cash is a deterministic function of the date: a house is
    its anchor times an index published for that quarter, a car is its curve at
    that age, a loan is its amortisation schedule at that payment number, a fund
    is the units held then times the price then. Cash is the balance today minus
    every transaction since. So the whole line is computable, which means it is
    also self-correcting — fix a wrong anchor and the past fixes itself, instead
    of a bad number being frozen into the file forever.

    `compose(day, cash, card)` returns the five components for that day.
    """
    by_day: dict[str, float] = {}
    for t in txns:
        by_day[t["date"]] = by_day.get(t["date"], 0.0) + t["amount"]

    # How far back the transactions actually reach. Walking past that would be
    # inventing a cash balance, so the line stops where the evidence does.
    oldest = min((t["date"] for t in txns), default=None)
    limit = days_back
    if oldest:
        limit = min(days_back, (today() - date.fromisoformat(oldest)).days + 1)
    limit = max(1, limit)

    cash, card = point["cash"], point["cardDebt"]
    rows = []
    cursor = today()
    for _ in range(limit):
        rows.append((cursor, cash, card))
        # Walking backwards: that day's movements had not happened yet.
        cash -= by_day.get(cursor.isoformat(), 0.0)
        cursor -= timedelta(days=1)
    rows.reverse()

    out = {"days": [], "netWorth": [], "cash": [], "investments": [],
           "pension": [], "assets": [], "liabilities": []}
    for day, c, cd in rows:
        parts = compose(day, c, cd)
        out["days"].append(day.isoformat())
        out["cash"].append(round(parts["cash"], 2))
        out["investments"].append(round(parts["investments"], 2))
        out["pension"].append(round(parts.get("pension", 0.0), 2))
        out["assets"].append(round(parts["assets"], 2))
        out["liabilities"].append(round(parts["liabilities"], 2))
        out["netWorth"].append(round(
            parts["cash"] + parts["investments"] + parts.get("pension", 0.0)
            + parts["assets"] + parts["liabilities"], 2))
    return out


def change_over(history: dict, days: int):
    d = history["days"]
    v = history["netWorth"]
    if len(d) < 2:
        return None
    target = date.fromisoformat(d[-1]) - timedelta(days=days)
    for i in range(len(d) - 1, -1, -1):
        if date.fromisoformat(d[i]) <= target:
            return round(v[-1] - v[i], 2)
    # Not that far back yet; only claim a change if there is a decent run-up.
    if (date.fromisoformat(d[-1]) - date.fromisoformat(d[0])).days >= days * 0.6:
        return round(v[-1] - v[0], 2)
    return None


# ── Fetching ────────────────────────────────────────────────────────────────

def read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return default
    except json.JSONDecodeError as e:
        log(f"{path}: {e}")
        return default


def fetch_source(api: Api, sid: str, session_id: str, label: str, probe: bool = False,
                 prev_accounts: list | None = None):
    """Everything one bank connection knows. Returns (accounts, transactions,
    consent_expiry). Raises only if the whole connection is unusable — a single
    account that will not answer costs that account, not the bank."""
    session = api.call(f"/sessions/{session_id}")
    if probe:
        log(f"\n--- /sessions/{session_id} ---\n{redact(session)}")

    accounts = session.get("accounts") or []
    expires = ((session.get("access") or {}).get("valid_until") or "")[:10] or None

    out_accounts, out_txns, stale_names = [], [], []
    since = (today() - timedelta(days=TXN_WINDOW)).isoformat()

    # GET /sessions answers with account IDS — ["2166fa1c-…", …] — and nothing
    # else. It is POST /sessions, back in the one-off authorisation, that hands
    # over whole account objects, and those are gone by the time this runs. So
    # every run asks /accounts/{id}/details for the name, the type and the
    # credit limit. That is a third call per account per day, inside PSD2's
    # guaranteed four: a hand-triggered extra run on the same day can be refused
    # by the bank, which costs that bank a day and says so on screen.
    for entry in accounts:
        if isinstance(entry, str):
            uid = entry
            try:
                acc = api.call(f"/accounts/{uid}/details")
            except ApiError as e:
                log(f"{label}: details for account …{uid[-6:]} failed — {e}")
                continue
            if probe:
                log(f"\n--- /accounts/…/details ---\n{redact(acc)}")
        else:
            acc = entry
            uid = acc.get("uid") or acc.get("account_uid")
        if not uid:
            continue
        name = account_name(acc)
        # A card account tends to arrive with the card number where a name
        # should be, and no `details` to fall back on. A number is not a name:
        # use what this connection is called, which is the card's own name.
        if re.fullmatch(r"[\d\s•*·-]+", name or ""):
            name = label
        kind = account_type(acc)

        acc_id = f"{sid}-{(uid or '')[-6:]}"
        old = next((a for a in (prev_accounts or []) if a.get("id") == acc_id), None)

        try:
            bal = api.call(f"/accounts/{uid}/balances")
            if probe:
                log(f"\n--- /accounts/…/balances ({name}) ---\n{redact(bal)}")
            booked, available = pick_balance(bal.get("balances") or [])
        except ApiError as e:
            # PSD2 guarantees an unattended reader four looks per account per
            # day and banks count them exactly, so a second run in one afternoon
            # gets a 429 for SOME accounts and not others. An account dropping
            # out of the file entirely would read as money vanishing, so the
            # last good figure is carried and flagged instead.
            log(f"{label}: balances for {name} failed — {e}")
            if old:
                carried = dict(old)
                carried["stale"] = True
                out_accounts.append(carried)
                stale_names.append(name)
                log(f"{label}: carried {name} forward from the last good read")
            continue

        if booked is None:
            log(f"{label}: {name} returned no usable balance; skipping it")
            continue

        out_accounts.append({
            "id": f"{sid}-{(uid or '')[-6:]}",
            "name": name,
            "source": sid,
            "type": kind,
            "balance": round(booked, 2),
            "available": round(available, 2) if available is not None else None,
            "mask": account_mask(acc),
            "creditLimit": num((acc.get("credit_limit") or {}).get("amount")
                               if isinstance(acc.get("credit_limit"), dict) else acc.get("credit_limit")),
            "dueDate": None,
            "dueAmount": None,
        })

        try:
            key = None
            pages = 0
            while pages < 12:
                page = api.call(f"/accounts/{uid}/transactions",
                                query={"date_from": since, "continuation_key": key})
                if probe and pages == 0:
                    log(f"\n--- /accounts/…/transactions ({name}) ---\n{redact(page)}")
                for raw in page.get("transactions") or []:
                    d, a = txn_date(raw), txn_amount(raw)
                    if d is None or a is None:
                        continue
                    out_txns.append({
                        "date": d, "text": txn_text(raw), "amount": round(a, 2),
                        "account": name, "source": sid,
                    })
                key = page.get("continuation_key")
                pages += 1
                if not key:
                    break
        except ApiError as e:
            log(f"{label}: transactions for {name} failed — {e}")

    return out_accounts, out_txns, expires, stale_names


def redact(doc) -> str:
    """Enough of the shape to fix a parser against, none of the numbers."""
    def walk(n):
        if isinstance(n, dict):
            return {k: ("<redacted>" if k in ("iban", "identification", "name", "amount",
                                              "entry_reference", "identification_hash")
                        else walk(v)) for k, v in n.items()}
        if isinstance(n, list):
            return [walk(x) for x in n[:2]] + ([f"…{len(n) - 2} more"] if len(n) > 2 else [])
        return n
    return json.dumps(walk(doc), indent=2, ensure_ascii=False)[:3000]


# What the app prints for each source id. The ids are whatever you chose as the
# keys of ENABLEBANKING_SESSIONS, plus the derived ones this script adds itself
# ("funds", "owned", "equity"). An id with no entry here prints as its own id,
# so this map is a courtesy rather than a gate.
SOURCE_LABELS = {
    "bank": "Bank",
    "card": "Credit card",
    "funds": "Funds",
    "owned": "Property & vehicles",
    "equity": "Employee shares",
}


def r2(v):
    """Round for the ask table. A question is answered in whole kroner far more
    often than in øre, and a table of 123 rows is read by a small model with a
    finite context — so two decimals, and no long float tails."""
    return None if v is None else round(float(v), 2)


def build_ask(snap: dict, txns: list, cat: Categoriser, spend_rows: int = 60,
              spend_days: int = 90) -> list:
    """The one key Snuggery's *Ask About This Data* reads.

    Flat rows, plain keys, a number or a short string in every value, nothing
    nested, and a couple of hundred rows at the very most — this is a table for
    reading, not the file for drawing. The app never touches it; everything here
    is already somewhere else in the snapshot, cut into the shape a question
    arrives in ("how much did groceries cost last month", "what is the car
    worth", "which month did I spend most").

    `row` names the kind, because one flat list has to hold several tables and
    a reader — person or model — needs to know which row answers which
    question. Money is in the snapshot's own currency, the same as everywhere
    else in the file.
    """
    out = []
    nw = snap.get("netWorth") or {}
    hist = snap.get("history") or {}
    days = hist.get("days") or []

    out.append({
        "row": "networth",
        "date": days[-1] if days else (snap.get("generatedAt") or "")[:10],
        "currency": snap.get("currency"),
        "netWorth": r2(nw.get("total")),
        "cash": r2(nw.get("cash")),
        "investments": r2(nw.get("investments")),
        "pension": r2(nw.get("pension")),
        "assets": r2(nw.get("assets")),
        "liabilities": r2(nw.get("liabilities")),
        "change30d": r2(nw.get("change30d")),
        "change365d": r2(nw.get("change365d")),
    })

    labels = SOURCE_LABELS
    for a in snap.get("accounts") or []:
        row = {
            "row": "account",
            "name": a.get("name"),
            "kind": a.get("type"),
            "balance": r2(a.get("balance")),
            "available": r2(a.get("available")),
            "creditLimit": r2(a.get("creditLimit")),
            "source": labels.get(a.get("source"), a.get("source")),
        }
        out.append({k: v for k, v in row.items() if v is not None})   # a flat row carries no nulls

    for item in snap.get("assets") or []:
        out.append({
            "row": "owned",
            "name": item.get("name"),
            "kind": item.get("kind"),
            "value": r2(item.get("value")),
            "anchorValue": r2(item.get("anchorValue")),
            "anchorDate": item.get("anchorDate"),
            "changeSinceAnchor": r2(item.get("changeSinceAnchor")),
            "change365d": r2(item.get("change365d")),
            "basis": item.get("basis"),
        })

    for loan in snap.get("loans") or []:
        out.append({
            "row": "loan",
            "name": loan.get("name"),
            "balance": r2(loan.get("balance")),
            "principal": r2(loan.get("principal")),
            "monthlyPayment": r2(loan.get("monthlyPayment")),
            "ratePct": None if loan.get("nominalRate") is None
                       else round(float(loan["nominalRate"]) * 100, 3),
            "paidOffPct": None if loan.get("paidOff") is None
                          else round(float(loan["paidOff"]) * 100, 2),
            "termMonths": loan.get("termMonths"),
            "against": loan.get("against"),
        })

    inv = snap.get("investments") or {}
    for f in inv.get("funds") or []:
        value, cost = f.get("value"), f.get("costBasis")
        out.append({
            "row": "fund",
            "name": f.get("name"),
            "value": r2(value),
            "costBasis": r2(cost),
            "gain": r2(None if value is None or cost is None else value - cost),
            "units": r2(f.get("units")),
            "nav": r2(f.get("nav")),
            "navDate": f.get("navDate"),
        })

    for acct in (snap.get("pension") or {}).get("accounts") or []:
        out.append({
            "row": "pension",
            "name": acct.get("label"),
            "kind": acct.get("kind"),
            "value": r2(acct.get("value")),
            "costBasis": r2(acct.get("costBasis")),
            "anchoredAt": acct.get("anchoredAt"),
        })

    cf = snap.get("cashflow") or {}
    months, ins, outs = cf.get("months") or [], cf.get("in") or [], cf.get("out") or []
    for i, m in enumerate(months):
        got = float(ins[i]) if i < len(ins) else 0.0
        spent = float(outs[i]) if i < len(outs) else 0.0
        out.append({"row": "month", "month": m, "in": r2(got), "out": r2(spent),
                    "net": r2(got - spent)})

    sp = snap.get("spending") or {}
    window = sp.get("windowDays")
    for c in sp.get("categories") or []:
        out.append({"row": "category", "category": c.get("label") or c.get("id"),
                    "windowDays": window, "from": sp.get("from"), "to": sp.get("to"),
                    "amount": r2(c.get("amount")), "count": c.get("count"),
                    "previousAmount": r2(c.get("previous"))})
    for m in sp.get("merchants") or []:
        out.append({"row": "merchant", "merchant": m.get("label"),
                    "windowDays": window, "amount": r2(m.get("amount")),
                    "count": m.get("count")})

    for r in snap.get("recurring") or []:
        out.append({"row": "recurring", "label": r.get("label"),
                    "amount": r2(r.get("amount")), "cadence": r.get("cadence"),
                    "lastSeen": r.get("lastSeen"), "nextExpected": r.get("nextExpected")})

    # The largest single payments of the last quarter. Not every transaction:
    # three hundred rows of coffee would crowd out everything above, and "what
    # was my biggest bill" is the question this key exists to answer.
    cutoff = (today() - timedelta(days=spend_days)).isoformat()
    spends = sorted((t for t in txns
                     if (t.get("amount") or 0) < 0 and (t.get("date") or "") >= cutoff),
                    key=lambda t: t["amount"])[:spend_rows]
    for t in spends:
        out.append({"row": "spend", "date": t.get("date"),
                    "text": (t.get("text") or "")[:60],
                    "amount": r2(t.get("amount")),
                    "category": cat.labels.get(t.get("category"), t.get("category")),
                    "account": t.get("account")})
    return out


def assemble(accounts, txns, sources, investments, cat, *, assets=None, loans=None,
             assets_cfg=None, ssb_cache=None, notes=None, equity=None, pension=None,
             synthetic=False):
    for t in txns:
        t.setdefault("category", cat.of(t["text"], t["amount"]))
    txns.sort(key=lambda t: (t["date"], t["text"]), reverse=True)

    assets = assets or []
    loans = loans or []
    assets_cfg = assets_cfg or []
    ssb_cache = ssb_cache or {}

    cash = round(sum(a["balance"] for a in accounts if a["balance"] > 0), 2)
    card = round(sum(a["balance"] for a in accounts if a["balance"] < 0), 2)
    fund_total = round((investments or {}).get("total", 0.0), 2)
    equity_total = round((equity or {}).get("counted", 0.0), 2)
    inv_total = round(fund_total + equity_total, 2)
    asset_total = round(sum(a["value"] for a in assets), 2)
    loan_total = round(sum(l["balance"] for l in loans), 2)

    # Loans the bank actually reports are already in `accounts` as negative
    # balances; counting the model on top would double the debt.
    modelled_loans = [l for l in loans if not l.get("fromBank")]
    loan_total = round(sum(l["balance"] for l in modelled_loans), 2)

    pension_total = round((pension or {}).get("counted", 0.0), 2)

    value_on = (investments or {}).get("_valueOn")
    equity_on = (equity or {}).get("_valueOn")
    pension_on = (pension or {}).get("_valueOn")
    loan_cfg = [l["_cfg"] for l in loans if l.get("_cfg") and not l.get("fromBank")]

    # An asset that offers variants is valued on the first of them, here and in
    # the history, so the line and the switch agree about where they started.
    priced_cfg = []
    for item in assets_cfg:
        variants = asset_variants(item)
        priced_cfg.append(variant_item(item, variants[0][2], variants[0][3])
                          if variants else item)

    def compose(day: date, day_cash: float, day_card: float):
        inv = (value_on(day) if value_on else 0.0) + (equity_on(day) if equity_on else 0.0)
        own = 0.0
        for item in priced_cfg:
            v, _basis = asset_value_on(item, day, ssb_cache)
            own += v or 0.0
        owed = 0.0
        for cfg in loan_cfg:
            b, _p, _basis = loan_balance_on(cfg, day)
            owed += b or 0.0
        return {"cash": day_cash, "investments": inv, "assets": own,
                "pension": pension_on(day) if pension_on else 0.0,
                "liabilities": day_card + owed}

    point = {"cash": cash, "cardDebt": card}
    history = build_history(point, txns, compose)

    # Each variant carries its own value for every day the history covers, so
    # the app can switch basis and redraw the whole line — net worth included —
    # without asking anyone for anything. Three or four hundred numbers per
    # variant, which is a few kB against a file the phone reads once a day.
    days = [date.fromisoformat(d) for d in history["days"]]
    for entry in assets:
        for variant in entry.get("variants") or []:
            cfg = variant.pop("_cfg", None)
            if not cfg:
                continue
            variant["history"] = [round(asset_value_on(cfg, d, ssb_cache)[0] or 0.0, 2)
                                  for d in days]

    total = round(cash + inv_total + pension_total + asset_total + card + loan_total, 2)

    snapshot = {
        "schema": 2,
        "generatedAt": utcnow(),
        "currency": "NOK",
        "timezone": LOCAL_TZ_NAME,
        "synthetic": synthetic,
        "sources": sources,
        "notes": [n for n in (notes or []) if n],
        "categoryLabels": {cid: cat.labels.get(cid, cid.title())
                           for cid in sorted({t["category"] for t in txns})},
        "netWorth": {
            "total": total,
            "cash": cash,
            "investments": inv_total,
            "funds": fund_total,
            "equity": equity_total,
            "pension": pension_total,
            "assets": asset_total,
            "liabilities": round(card + loan_total, 2),
            "cardDebt": card,
            "loans": loan_total,
            "change30d": change_over(history, 30),
            "change365d": change_over(history, 365),
        },
        "accounts": accounts,
        "investments": {k: v for k, v in (investments or {}).items()
                        if not k.startswith("_")} or None,
        "equity": {k: v for k, v in (equity or {}).items()
                   if not k.startswith("_")} or None,
        "pension": {k: v for k, v in (pension or {}).items()
                    if not k.startswith("_")} or None,
        "assets": assets,
        "loans": [{k: v for k, v in l.items() if not k.startswith("_")} for l in loans],
        "history": history,
        "cashflow": build_cashflow(txns),
        "spending": build_spending(txns, cat),
        "recurring": build_recurring(txns),
        "transactions": txns[:MAX_TXNS],
    }
    # Built last, from the finished snapshot, so the ask table can never drift
    # away from what is on screen: every row in it is a cut of a number that is
    # already above.
    snapshot["ask"] = build_ask(snapshot, txns, cat)
    return snapshot


def run_no_banks(probe: bool = False):
    """Everything that needs no credential: the funds, the employee shares, the
    property and the loans, all priced for real. The bank half is simply absent
    rather than faked — no accounts, no transactions, no cash line — so what is
    on screen is either yours or missing, never invented."""
    cat = Categoriser(read_json(CATEGORIES, {}) or {})
    holdings_doc = read_json(HOLDINGS, {}) or {}
    assets_doc = read_json(ASSETS, {}) or {}

    # No transactions means no fund purchases to accrue, so the funds sit at
    # whatever the anchor says — which is the point: it tests the anchor.
    investments, _purchases = build_investments(holdings_doc, [], probe=probe)
    equity = build_equity(holdings_doc, probe=probe)
    assets, loans, ssb_cache, notes = build_assets(assets_doc, today(), probe=probe)

    sources = [{
        "id": "bank", "label": "Banks", "status": "error", "fetchedAt": None,
        "consentExpires": None,
        "message": "not connected yet — this snapshot was built with --no-banks, "
                   "so there are no accounts, no cash and no spending in it.",
    }]
    if investments:
        sources.append({"id": "funds", "label": "Funds", "status": "derived",
                        "fetchedAt": utcnow(), "consentExpires": None,
                        "message": "units from the anchor only; purchases accrue "
                                   "once the bank feed is connected"})
    if equity:
        sources.append({"id": "equity",
                        "label": equity.get("provider") or "Employee shares",
                        "status": "error" if equity.get("error") else "derived",
                        "fetchedAt": utcnow(), "consentExpires": None,
                        "message": equity.get("error") or "priced at the listed "
                                   "quote and Norges Bank's rate"})
    if assets or loans:
        sources.append({"id": "owned", "label": "Property & vehicles",
                        "status": "derived", "fetchedAt": utcnow(),
                        "consentExpires": None,
                        "message": "valued from assets.json, indexed and amortised by date"})

    notes = list(notes) + ["Built with --no-banks: no accounts, cash or spending. "
                           "Connect the banks and this fills in."]

    # No transactions, so nothing accrues — a pension anchored to a value still
    # shows, and one that accrues from the bank feed sits at its anchor.
    pension = build_pension(holdings_doc, [], probe=probe)
    if pension:
        sources.append({"id": "pension", "label": pension.get("provider") or "Pension",
                        "status": "derived", "fetchedAt": utcnow(), "consentExpires": None,
                        "message": "anchored; contributions accrue once the bank feed is connected"})

    return assemble([], [], sources, investments, cat,
                    assets=assets, loans=loans, equity=equity, pension=pension,
                    assets_cfg=assets_doc.get("assets") or [],
                    ssb_cache=ssb_cache, notes=notes, synthetic=False)


def run_live(probe: bool = False):
    app_id = os.environ.get("ENABLEBANKING_APP_ID", "").strip()
    pem = os.environ.get("ENABLEBANKING_PRIVATE_KEY", "").strip()
    raw_sessions = os.environ.get("ENABLEBANKING_SESSIONS", "").strip()
    missing = [n for n, v in (("ENABLEBANKING_APP_ID", app_id),
                              ("ENABLEBANKING_PRIVATE_KEY", pem),
                              ("ENABLEBANKING_SESSIONS", raw_sessions)) if not v]
    if missing:
        raise SystemExit(f"missing environment: {', '.join(missing)}")

    try:
        sessions = json.loads(raw_sessions)
        if not isinstance(sessions, dict) or not sessions:
            raise ValueError("expected a non-empty object of id -> session_id")
    except (json.JSONDecodeError, ValueError) as e:
        raise SystemExit(f"ENABLEBANKING_SESSIONS is not usable: {e}")

    api = Api(app_id, pem.replace("\\n", "\n"))
    prev = read_json(OUT)
    cat = Categoriser(read_json(CATEGORIES, {}) or {})

    accounts, txns, sources = [], [], []
    for sid, session_id in sessions.items():
        label = SOURCE_LABELS.get(sid, sid.upper())
        try:
            kept_before = [a for a in ((prev or {}).get("accounts") or []) if a.get("source") == sid]
            accs, tx, expires, stale = fetch_source(api, sid, session_id, label, probe=probe,
                                                    prev_accounts=kept_before)
            accounts += accs
            txns += tx
            # A bank that answered the session call but returned no account at
            # all is NOT fine, and must never read as fine: with every account
            # rate-limited and nothing to carry forward, "ok" next to an empty
            # list is the most misleading thing this file could say.
            if not accs:
                status, message = "error", (
                    "answered, but no account could be read — usually the four "
                    "unattended reads a day are spent. It recovers tomorrow.")
            elif stale:
                status, message = "stale", (
                    f"{', '.join(stale)} could not be read today — the bank allows four "
                    f"unattended reads a day and they are used up; showing the last good "
                    f"figure until tomorrow.")
            else:
                status, message = "ok", None
            sources.append({
                "id": sid, "label": label, "status": status,
                "fetchedAt": utcnow(), "consentExpires": expires, "message": message,
            })
            log(f"{label}: {len(accs)} accounts, {len(tx)} transactions")
        except ApiError as e:
            # One bank down must not make net worth look like it fell off a
            # cliff: carry its last known accounts forward and say they are old.
            log(f"{label}: FAILED — {e}")
            kept = [a for a in ((prev or {}).get("accounts") or []) if a.get("source") == sid]
            accounts += kept
            old = next((s for s in ((prev or {}).get("sources") or []) if s.get("id") == sid), {})
            reason = ("the consent has expired — re-authorise with BankID"
                      if e.status in (401, 403) else f"the last refresh failed ({e.status or 'network'}).")
            sources.append({
                "id": sid, "label": label,
                "status": "stale" if kept else "error",
                "fetchedAt": old.get("fetchedAt"),
                "consentExpires": old.get("consentExpires"),
                "message": reason,
            })

    if not accounts:
        raise SystemExit("no bank answered and there was nothing to carry forward; "
                         "leaving the last good snapshot in place")

    # Transactions carried forward from the previous file keep the long-window
    # aggregates honest when a bank has only just come back.
    #
    # Two things must never ride in on that. The example snapshot this app ships
    # with is a whole fake month — wages from ARBEIDSGIVER AS, groceries in
    # Bogstadveien — and the FIRST live run finds it sitting there as `prev`. And
    # an account that is no longer authorised leaves transactions behind that
    # belong to no account on screen. So: nothing from a synthetic file, and
    # nothing whose account is not in this snapshot.
    carried = [] if (prev or {}).get("synthetic") else ((prev or {}).get("transactions") or [])
    if (prev or {}).get("synthetic"):
        log("previous snapshot was the example data; not carrying anything forward")

    seen = {(t["date"], t["text"], t["amount"], t["account"]) for t in txns}
    for t in carried:
        key = (t.get("date"), t.get("text"), t.get("amount"), t.get("account"))
        if key in seen or any(k is None for k in key):
            continue
        txns.append({k: t.get(k) for k in ("date", "text", "amount", "account", "source")})

    investments, purchases = build_investments(read_json(HOLDINGS, {}) or {}, txns, probe=probe)  # noqa: E501
    if investments:
        basis = investments.get("historyBasis")
        sources.append({"id": "funds", "label": "Funds", "status": "derived",
                        "fetchedAt": utcnow(), "consentExpires": None,
                        "message": ("units accrued from the transfers that bought them"
                                    + ("; past values move with contributions only, not the market"
                                       if basis == "contributions" else ""))})

    holdings_doc = read_json(HOLDINGS, {}) or {}
    equity = build_equity(holdings_doc, probe=probe)
    if equity:
        sources.append({
            "id": "equity",
            "label": equity.get("provider") or "Employee shares",
            "status": "error" if equity.get("error") else "derived",
            "fetchedAt": utcnow(), "consentExpires": None,
            "message": equity.get("error")
            or "vesting is a calendar, not a feed — priced at the listed quote and Norges Bank's rate",
        })

    pension = build_pension(holdings_doc, txns, probe=probe)
    if pension:
        anchored = ", ".join(f"{a['label']} anchored {a['anchoredAt']}"
                             for a in pension["accounts"] if a.get("anchoredAt"))
        sources.append({
            "id": "pension", "label": pension.get("provider") or "Pension",
            "status": "error" if pension.get("notes") else "derived",
            "fetchedAt": utcnow(), "consentExpires": None,
            "message": "; ".join(pension["notes"]) or anchored or None,
        })

    assets_cfg_doc = read_json(ASSETS, {}) or {}
    assets, loans, ssb_cache, notes = build_assets(
        assets_cfg_doc, today(), accounts=accounts, probe=probe)
    if assets or loans:
        sources.append({"id": "owned", "label": "Property & vehicles", "status": "derived",
                        "fetchedAt": utcnow(), "consentExpires": None,
                        "message": "valued from assets.json, indexed and amortised by date"})

    return assemble(accounts, txns, sources, investments, cat,
                    assets=assets, loans=loans, equity=equity, pension=pension,
                    assets_cfg=assets_cfg_doc.get("assets") or [],
                    ssb_cache=ssb_cache, notes=notes, synthetic=False)


# ── Example data ────────────────────────────────────────────────────────────
# The snapshot that ships in finances/data/ is NOT written here. It is written
# by scripts/make_demo_finances.py, which invents a household from a fixed seed
# and then hands it to assemble() below — the same function the live run ends
# with, so the example exercises the real code path rather than a parallel one
# that could rot. Keeping it in its own file also keeps an invented balance out
# of the script that talks to your bank.


# ── Consent, once, by hand ──────────────────────────────────────────────────
# PSD2 account access starts with the account holder proving who they are to
# their own bank. That is a redirect into the bank's own strong-authentication
# page, so it is a human step by design and by regulation — no cron job, no
# GitHub Action and no agent can do it for you. --connect is the whole of that
# step: it opens the bank's page, catches the code the bank redirects back
# with, and turns it into the session id the daily job reads.

DEFAULT_REDIRECT = "http://localhost:8765/callback"


def catch_code(redirect: str, state: str, timeout: int = 300) -> str | None:
    """Sit on the redirect address until the bank sends the browser back.

    Returns None when the address is not a localhost one this can listen on —
    the caller then asks you to paste the address instead, which always works.
    Some providers refuse to register a plain-http redirect at all, in which
    case https://localhost/callback with nothing listening is the usual answer:
    the browser's "cannot connect" page IS the finish, and the address bar
    holds the code.

    `state` is the value sent to /auth, and it is the reason this is safe to
    run at all. While the listener is up it is an unauthenticated GET on
    localhost, so ANY page open in the browser can hit it — a one-pixel
    `<img src="http://localhost:8765/callback?code=...">` on an unrelated site
    is enough. Without the check below, that page chooses which accounts get
    linked. So a request whose `state` is not the one just sent is answered
    400 and IGNORED, and the listener keeps waiting for the real redirect.
    """
    import http.server
    import socketserver

    parts = parse.urlparse(redirect)
    if parts.hostname not in ("localhost", "127.0.0.1") or not parts.port:
        return None

    got: dict[str, str] = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):                                   # noqa: N802
            query = parse.parse_qs(parse.urlparse(self.path).query)
            if query.get("state") != [state]:
                body = (b"<meta charset='utf-8'><body style='font:16px system-ui;padding:3rem'>"
                        b"<h2>Not this one.</h2><p>That request did not come from the "
                        b"sign-in this script started. Ignored.</p>")
                self.send_response(400)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                log("ignored a callback whose state did not match — not the bank's redirect")
                return
            got.update({k: v[0] for k, v in query.items()})
            body = (b"<meta charset='utf-8'><body style='font:16px system-ui;padding:3rem'>"
                    b"<h2>Done.</h2><p>Close this tab and go back to the terminal.</p>")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):                          # keep the console clean
            pass

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", parts.port), Handler) as srv:
        # handle_request(), not serve_forever(): CPython's serve_forever
        # documents that it "Ignores self.timeout", so the five minutes below
        # would never have expired and a bank that never redirects would hang
        # this script — and the paste fallback, which is the path most people
        # end up on, would never be reached.
        srv.timeout = 1
        deadline = time.monotonic() + timeout
        log(f"listening on {redirect} — finish the sign-in in the browser")
        while "code" not in got and time.monotonic() < deadline:
            srv.handle_request()                            # returns after srv.timeout

    if "code" in got:
        return got["code"]
    if got:
        log(f"the bank came back without a code: {got}")
    else:
        log("nothing arrived on the redirect address within "
            + (f"{timeout // 60} minutes" if timeout >= 60 else f"{timeout} seconds"))
    return None


def connect_bank(api: Api, aspsp: str, sid: str, country: str, redirect: str, days: int):
    """Authorise one bank and print `<id> = <session id>` on standard output.

    Everything else goes to stderr, so `--connect … > bank.sid` captures the
    session id and nothing else — a session id is a credential and has no
    business in a scrollback you keep.
    """
    import webbrowser

    valid_until = (datetime.now(timezone.utc) + timedelta(days=days)) \
        .strftime("%Y-%m-%dT%H:%M:%S.000+00:00")
    try:
        auth = api.call("/auth", method="POST", body={
            "access": {"valid_until": valid_until},
            "aspsp": {"name": aspsp, "country": country},
            "state": sid,
            "redirect_url": redirect,
            "psu_type": "personal",
        })
    except ApiError as e:
        raise SystemExit(f"could not start the authorisation: {e}\n"
                         "A 4xx here is almost always the bank name (it must match "
                         "--aspsps exactly) or a redirect address that is not registered "
                         "on the application in the control panel.")

    url = auth.get("url")
    if not url:
        raise SystemExit(f"no authorisation URL came back: {json.dumps(auth)[:400]}")

    log(f"\nOpen this and sign in with your bank:\n\n  {url}\n")
    try:
        webbrowser.open(url)
    except Exception:                                       # noqa: BLE001
        pass

    code = catch_code(redirect, sid)
    if not code:
        log("\nPaste the address the browser ended up at (the whole thing, ?code= and all).")
        log("Paste it HERE, into this script, not into the shell — a shell eats the ? and &.")
        landed = input("> ").strip()
        query = parse.parse_qs(parse.urlparse(landed).query)
        # Same check as the listener's: the address must carry back the state
        # this run sent, or it is not the page this run opened.
        if query.get("state") != [sid]:
            raise SystemExit(
                "that address does not carry this sign-in's state back — it is from "
                "another attempt or another page. Start over with --connect.")
        code = (query.get("code") or [""])[0]
        if not code:
            raise SystemExit("that address carries no ?code= — the sign-in did not complete")

    try:
        session = api.call("/sessions", method="POST", body={"code": code})
    except ApiError as e:
        raise SystemExit(f"could not exchange the code: {e}\n"
                         "Codes are single-use and expire in minutes — start over.")

    session_id = session.get("session_id")
    if not session_id:
        raise SystemExit(f"no session_id came back: {json.dumps(session)[:400]}")

    accounts = session.get("accounts") or []
    log(f"\n{len(accounts)} account(s) authorised"
        + (f", access valid until {(session.get('access') or {}).get('valid_until', '?')[:10]}"
           if session.get("access") else ""))
    for a in accounts:
        ident = a.get("account_id") or {}
        tail = (ident.get("iban") or "")[-4:]
        log(f"  · {a.get('name') or a.get('product') or 'account'}"
            + (f" (•• {tail})" if tail else ""))

    print(f"{sid} = {session_id}")


# ── Writing and pushing ─────────────────────────────────────────────────────

def write(snapshot: dict, replace_example: bool = False):
    # The file on disk in a fresh copy of the template is the invented example
    # household, and it is also what the ZIP build packs and what the starter
    # pack installs. One curious `workflow_dispatch` here would otherwise
    # replace that story with an empty real snapshot — no accounts, no
    # transactions — and nobody would notice until a stranger imported it.
    # So a synthetic file is not overwritten unless you say so.
    if not replace_example and os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as fh:
                if json.load(fh).get("synthetic"):
                    raise SystemExit(
                        f"{os.path.relpath(OUT, ROOT)} is still the example data that ships "
                        "with this app.\n"
                        "Pass --replace-example once to write your own over it. To put the "
                        "example back afterwards: python3 scripts/make_demo_finances.py")
        except (OSError, ValueError):
            pass                                            # unreadable: treat it as ours to write

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    size = os.path.getsize(OUT)
    log(f"wrote {os.path.relpath(OUT, ROOT)} — {size / 1024:.1f} kB, "
        f"{len(snapshot['accounts'])} accounts, {len(snapshot['transactions'])} transactions, "
        f"{len(snapshot['history']['days'])} days of history")
    if size > 2_000_000:
        log("WARNING: the snapshot is over 2 MB; a phone will feel that on every open")


def git(*args, check=True):
    return subprocess.run(["git", "-C", ROOT, *args], check=check,
                          capture_output=True, text=True).stdout.strip()


def push():
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    git("add", os.path.relpath(OUT, ROOT))
    if not subprocess.run(["git", "-C", ROOT, "diff", "--staged", "--quiet"]).returncode:
        log("snapshot unchanged - nothing to commit")
        return
    git("commit", "-m", f"finance: refresh snapshot {datetime.now(timezone.utc):%Y-%m-%dT%H:%MZ}")
    branch = os.environ.get("GITHUB_REF_NAME") or git("rev-parse", "--abbrev-ref", "HEAD")
    for i in range(1, 5):
        if subprocess.run(["git", "-C", ROOT, "push", "origin", f"HEAD:{branch}"]).returncode == 0:
            log("pushed")
            return
        wait = 2 ** i
        log(f"push failed, rebasing and retrying in {wait}s")
        time.sleep(wait)
        # -X theirs: the other refresh jobs push to this branch too, and two
        # runs regenerating a file seconds apart are both right.
        if subprocess.run(["git", "-C", ROOT, "pull", "--rebase", "-X", "theirs",
                           "origin", branch]).returncode != 0:
            subprocess.run(["git", "-C", ROOT, "rebase", "--abort"])
            log("another run refreshed it seconds ago; nothing left to do")
            return
    raise SystemExit("could not push after four attempts")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-banks", action="store_true",
                    help="everything except the banks, for real — no credentials needed")
    ap.add_argument("--aspsps", action="store_true", help="list the banks on offer in --country")
    ap.add_argument("--connect", action="store_true",
                    help="authorise ONE bank interactively and print its session id")
    ap.add_argument("--aspsp", help="with --connect: the bank's name, exactly as --aspsps prints it")
    ap.add_argument("--id", help="with --connect: the key this bank takes in ENABLEBANKING_SESSIONS")
    ap.add_argument("--country", default="NO", help="two-letter country code for --aspsps/--connect")
    ap.add_argument("--redirect", default=os.environ.get("ENABLEBANKING_REDIRECT", DEFAULT_REDIRECT),
                    help="the redirect address registered on the application")
    ap.add_argument("--key", help="path to the PEM private key, instead of the environment")
    ap.add_argument("--days", type=int, default=180,
                    help="how long to ask access for; PSD2 caps it at 180 and banks may give less")
    ap.add_argument("--probe", action="store_true", help="print the raw API shapes, redacted")
    ap.add_argument("--probe-nav", action="store_true", help="try every NAV source and report")
    ap.add_argument("--probe-assets", action="store_true",
                    help="list the regions and dwelling types SSB offers, and value every asset")
    ap.add_argument("--probe-equity", action="store_true",
                    help="price the employee shares and show the vesting schedule")
    ap.add_argument("--push", action="store_true", help="commit and push the result")
    ap.add_argument("--replace-example", action="store_true",
                    help="write over the example data this app ships with (needed once)")
    args = ap.parse_args()

    if args.aspsps or args.connect:
        app_id = os.environ.get("ENABLEBANKING_APP_ID", "").strip()
        if args.key:
            pem = open(args.key, encoding="utf-8").read()
        else:
            pem = os.environ.get("ENABLEBANKING_PRIVATE_KEY", "").replace("\\n", "\n").strip()
        if not app_id or not pem:
            raise SystemExit("set ENABLEBANKING_APP_ID and ENABLEBANKING_PRIVATE_KEY "
                             "(or pass --key path/to/key.pem)")
        api = Api(app_id, pem)

        if args.aspsps:
            aspsps = api.call("/aspsps", query={"country": args.country}).get("aspsps", [])
            if not aspsps:
                raise SystemExit(f"no banks listed for {args.country}")
            log(f"{len(aspsps)} banks in {args.country}:\n")
            for a in sorted(aspsps, key=lambda x: (x.get("name") or "")):
                flags = " ".join(f for f, on in (("sandbox", a.get("sandbox")),
                                                 ("beta", a.get("beta"))) if on)
                print(f"  {a.get('name'):<38} {','.join(a.get('psu_types') or [])} {flags}")
            if not args.connect:
                log("\nPick one and run again with "
                    "--connect --aspsp '<name>' --id <short-id>")
            return

        if not args.aspsp or not args.id:
            raise SystemExit("--connect needs --aspsp '<bank name>' and --id <short-id>")
        connect_bank(api, args.aspsp, args.id, args.country, args.redirect, args.days)
        return

    if args.probe_assets:
        meta = ssb_metadata()
        log(f"SSB table {SSB_TABLE}: {meta.get('title')}\n")
        for var in meta.get("variables") or []:
            texts = var.get("valueTexts") or []
            log(f"  {var.get('text')} ({var.get('code')}) — {len(texts)} options")
            if (var.get("code") or "").lower() not in ("tid", "time"):
                for t in texts:
                    log(f"      {t}")
        doc = read_json(ASSETS, {}) or {}
        items, loans, _cache, notes = build_assets(doc, today(), probe=True)
        log("")
        for i in items:
            log(f"  {i['name']:<12} {i['value']:>14,.0f}  ({i['basis']})")
        for l in loans:
            log(f"  {l['name']:<12} {l['balance']:>14,.0f}  ({l['basis']})")
        for n in notes:
            log(f"  ! {n}")
        return

    if args.probe_equity:
        eq = build_equity(read_json(HOLDINGS, {}) or {}, probe=True)
        if not eq:
            log("no equity section in holdings.json, or it is disabled")
            return
        if eq.get("error"):
            # The probe exists to diagnose exactly this, so say what went wrong
            # and stop: with no price there is no vesting table to print.
            log(f"\n{eq['provider']} — {eq.get('symbol')}: {eq['error']}")
            log("  set quote.source to \"yahoo:<ticker>\" for a symbol that resolves, "
                "or to \"manual\" with a price you type.")
            return
        log(f"\n{eq['provider']} — {eq.get('symbol')} at {eq.get('price')} {eq.get('currency')}"
            f" ({eq.get('priceSource')}), FX {eq.get('fxRate')} ({eq.get('fxSource')})")
        log(f"  vested   {eq['vestedShares']:>9,.0f} shares  {eq['vested']:>14,.0f} kr")
        log(f"  unvested {eq['unvestedShares']:>9,.0f} shares  {eq['unvested']:>14,.0f} kr"
            f"  ({eq['unvestedAfterTax']:,.0f} after {eq['unvestedTaxRate'] * 100:.0f} % tax)")
        log(f"  counted in net worth: {eq['counted']:,.0f} kr"
            f"  (history basis: {eq.get('historyBasis')})")
        for u in eq["upcoming"]:
            log(f"    vests {u['date']}  {u['shares']:>6,.0f} shares  ~{u['value']:>12,.0f} kr  {u['label']}")
        return

    if args.probe_nav:
        holdings = read_json(HOLDINGS, {}) or {}
        for f in ((holdings.get("investments") or {}).get("funds") or []):
            log(f"\n{f.get('name')} ({f.get('isin')}) — navSource={f.get('navSource')}")
            log(f"  -> {fetch_nav(f, probe=True)}")
        return

    if args.no_banks:
        snapshot = run_no_banks(probe=args.probe)
    else:
        snapshot = run_live(probe=args.probe)
    write(snapshot, replace_example=args.replace_example)
    if args.push:
        push()


if __name__ == "__main__":
    main()
