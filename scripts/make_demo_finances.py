#!/usr/bin/env python3
"""Invent a household, and write finances/data/snapshot.json from it.

The Finances app ships with data so that it works the moment it is imported,
and that data cannot be anybody's. So this file makes a household up: four
accounts, a year of ordinary transactions, one fund bought by a standing
monthly transfer, a home, two cars, and the two loans against them. Every
figure below is invented. No name, no address, no account number, no merchant
that exists — the shops are called "Grocery store" and "Petrol station"
because a real chain in a demo is a claim about somebody's week.

ONE THING IS REAL, deliberately: the house-price index. The home is anchored
to a round figure and then moved by Statistics Norway's published used-dwelling
index, cached at the bottom of this file so `--check` is deterministic with no
network. That is public data about a market, not data about a person, and it is
what makes the net-worth line bend the way a real one does instead of drifting
along a formula.

It is NOT a second implementation of the app's data format. Everything here
ends in `assemble()` from scripts/finances.py — the same function the real pull
finishes with — so the example exercises the code the live run uses, and a
change to the snapshot's shape cannot leave the demo behind.

    python3 scripts/make_demo_finances.py            # rewrite the committed data
    python3 scripts/make_demo_finances.py --check    # prove the committed bytes
                                                     # are this script's output
    python3 scripts/make_demo_finances.py --today 2026-09-21    # pin the calendar

`--check` reads the committed snapshot's own generatedAt and regenerates with
that as the demo's "today", so it holds on any later day. Regenerate before
publishing, or the example arrives showing last month.

Stdlib only, no network, no credentials.
"""

from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import os
import random
import shutil
import sys
import tempfile
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP = "finances"
SEED = 20260921

# The stamp written into the file, rather than the moment the script ran — so
# the output is a pure function of this file plus the demo's date, and --check
# can compare whole files byte for byte.
STAMP_TIME = "T05:12:00Z"


def load_finances():
    """Import scripts/finances.py as a module. It is a script, not a package,
    and renaming it would break the workflow that calls it, so this is the
    least surprising way to reuse its builders."""
    spec = importlib.util.spec_from_file_location("finances", os.path.join(HERE, "finances.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ── The household ───────────────────────────────────────────────────────────
# Names are deliberately what a thing IS, never who runs it. A bank feed writes
# in capitals, so these do too, and categories.json matches them.

# (times a week, smallest, largest, what the bank prints, which card)
SPEND = [
    (4.0, 180, 980, ["GROCERY STORE", "SUPERMARKET", "CORNER SHOP", "BAKERY"], "current"),
    (1.2, 45, 220, ["COFFEE SHOP", "LUNCH BAR"], "current"),
    (0.8, 180, 950, ["TAKEAWAY", "RESTAURANT", "PIZZA PLACE"], "credit"),
    (0.5, 240, 760, ["PETROL STATION", "CHARGING POINT"], "credit"),
    (0.9, 40, 120, ["PUBLIC TRANSPORT", "TOLL ROAD", "PARKING"], "current"),
    (0.35, 390, 2900, ["CLOTHING SHOP", "ELECTRONICS SHOP", "HOME GOODS STORE",
                       "SPORTS SHOP", "BOOKSHOP"], "credit"),
    (0.2, 180, 890, ["PHARMACY", "DENTIST", "OPTICIAN"], "current"),
]

# (day of month, amount, what the bank prints, which account, does it vary)
MONTHLY = [
    # The two loan payments are the figures assets.json's own terms amortise
    # to, so the feed and the modelled balance tell the same story.
    (2, -18520.92, "MORTGAGE PAYMENT", "current", False),
    (2, -3700.27, "CAR LOAN INSTALMENT", "current", False),
    (3, -1289.00, "ELECTRICITY SUPPLIER", "current", True),
    (4, -2400.00, "HOUSING COSTS SHARED", "current", False),
    (5, -3000.00, "MONTHLY FUND PURCHASE", "current", False),
    (8, -549.00, "MOBILE PHONE PLAN", "current", False),
    (12, -199.00, "STREAMING VIDEO", "credit", False),
    (12, -129.00, "STREAMING MUSIC", "credit", False),
    (14, -449.00, "GYM MEMBERSHIP", "credit", False),
    (18, -1420.00, "HOME INSURANCE", "current", True),
    (20, -279.00, "APP STORE SUBSCRIPTION", "credit", False),
    (26, -2000.00, "TRANSFER TO SAVINGS", "current", False),
]

SALARY_DAY = 25
SALARY = 58000
BENEFIT_DAY = 20
BENEFIT = 1766.00

CURRENT_ACCOUNT = "Everyday account"
CREDIT_ACCOUNT = "Credit card"

# Today's balances. The history walks backwards from these through the
# transactions above, so any plausible figure here is self-consistent.
EVERYDAY_TODAY = 58200.00
SAVINGS_TODAY = 185000.00
HOLIDAY_TODAY = 42000.00
CREDIT_LIMIT = 60000.00

# The fund price the demo's own NAV series ends on, and how much it wanders.
FUND_SPOT = 232.51
FUND_DAYS = 430


def build(fin, when: date):
    """Everything the live run would have fetched, invented — then handed to the
    real builders."""
    rnd = random.Random(SEED)
    end = when
    # Start on the first of a month, thirteen months back, so the oldest bar on
    # the cash-flow chart is a whole month rather than a stub that reads as a
    # month with no bills in it.
    first = (end.replace(day=1) - timedelta(days=370)).replace(day=1)
    start = first
    txns: list[dict] = []

    def add(d: date, text: str, amount: float, where: str):
        txns.append({
            "date": d.isoformat(), "text": text, "amount": round(amount, 2),
            "account": CURRENT_ACCOUNT if where == "current" else CREDIT_ACCOUNT,
            "source": "bank" if where == "current" else "card",
        })

    paid_through = [start.isoformat()]
    d = start
    while d <= end:
        # Pay day, shifted off a weekend the way payroll does.
        if d.day == SALARY_DAY:
            pay = d
            while pay.weekday() > 4:
                pay -= timedelta(days=1)
            add(pay, "SALARY", SALARY + rnd.randint(-900, 2600), "current")
        if d.day == BENEFIT_DAY:
            add(d, "CHILD BENEFIT", BENEFIT, "current")

        for day_of_month, amount, text, where, varies in MONTHLY:
            if d.day == day_of_month:
                add(d, text, amount * (rnd.uniform(0.9, 1.12) if varies else 1.0), where)

        for per_week, lo, hi, texts, where in SPEND:
            if rnd.random() < per_week / 7.0:
                add(d, rnd.choice(texts), -rnd.uniform(lo, hi), where)

        # The card bill is paid in full on the 6th, covering everything charged
        # up to the 1st and never a krone of it twice.
        if d.day == 6:
            cutoff = d.replace(day=1).isoformat()
            owed = sum(-t["amount"] for t in txns
                       if t["source"] == "card" and t["amount"] < 0
                       and paid_through[0] <= t["date"] < cutoff)
            if owed > 0:
                add(d, "CARD BILL PAYMENT", -owed, "current")
                add(d, "CARD BILL RECEIVED", owed, "credit")
            paid_through[0] = cutoff
        d += timedelta(days=1)

    card = sum(t["amount"] for t in txns if t["account"] == CREDIT_ACCOUNT)
    accounts = [
        {"id": "bank-1", "name": CURRENT_ACCOUNT, "source": "bank", "type": "current",
         "balance": EVERYDAY_TODAY, "available": EVERYDAY_TODAY, "mask": "•• 4417",
         "creditLimit": None, "dueDate": None, "dueAmount": None},
        {"id": "bank-2", "name": "Savings account", "source": "bank", "type": "savings",
         "balance": SAVINGS_TODAY, "available": SAVINGS_TODAY, "mask": "•• 9062",
         "creditLimit": None, "dueDate": None, "dueAmount": None},
        {"id": "bank-3", "name": "Holiday fund", "source": "bank", "type": "savings",
         "balance": HOLIDAY_TODAY, "available": HOLIDAY_TODAY, "mask": "•• 5530",
         "creditLimit": None, "dueDate": None, "dueAmount": None},
        {"id": "card-1", "name": CREDIT_ACCOUNT, "source": "card", "type": "credit",
         "balance": round(card, 2), "available": round(CREDIT_LIMIT + card, 2),
         "mask": "•• 3388", "creditLimit": CREDIT_LIMIT,
         "dueDate": (end.replace(day=1) + timedelta(days=35)).replace(day=6).isoformat(),
         "dueAmount": round(card, 2)},
    ]

    # The two fetched series stood in for, so the generator needs no network.
    # Everything downstream — accrual, indexing, amortisation, the history walk
    # — is the same code the live run uses.
    holdings = copy.deepcopy(fin.read_json(fin.HOLDINGS, {}) or {})
    for f in ((holdings.get("investments") or {}).get("funds") or []):
        series, price, cursor = {}, FUND_SPOT, end
        for _ in range(FUND_DAYS):                 # backwards, so today is exact
            series[cursor.isoformat()] = round(price, 4)
            price /= (1 + rnd.uniform(-0.0034, 0.0049))
            cursor -= timedelta(days=1)
        f["navSource"] = "inline"
        f["navSeries"] = series
        f["nav"] = FUND_SPOT

    assets_doc = copy.deepcopy(fin.read_json(fin.ASSETS, {}) or {})
    ssb_override = {k: (dict(v[0]), v[1]) for k, v in SSB_INDEX.items()}

    cat = fin.Categoriser(fin.read_json(fin.CATEGORIES, {}) or {})
    for t in txns:
        t["category"] = cat.of(t["text"], t["amount"])

    investments, _purchases = fin.build_investments(holdings, txns)
    equity = fin.build_equity(holdings)
    pension = fin.build_pension(holdings, txns)
    assets, loans, ssb_cache, notes = fin.build_assets(
        assets_doc, end, accounts=accounts, ssb_override=ssb_override)

    stamp = end.isoformat() + STAMP_TIME
    sources = [
        {"id": "bank", "label": "Bank", "status": "ok", "fetchedAt": stamp,
         "consentExpires": (end + timedelta(days=156)).isoformat(), "message": None},
        {"id": "card", "label": "Credit card", "status": "ok", "fetchedAt": stamp,
         "consentExpires": (end + timedelta(days=151)).isoformat(), "message": None},
        {"id": "funds", "label": "Funds", "status": "derived", "fetchedAt": stamp,
         "consentExpires": None,
         "message": "units accrued from the transfers that bought them"},
        {"id": "owned", "label": "Property & vehicles", "status": "derived",
         "fetchedAt": stamp, "consentExpires": None,
         "message": "valued from assets.json, indexed and amortised by date"},
    ]

    notes = list(notes) + [
        "Example text — every account, balance, transaction and holding in this "
        "file was invented by scripts/make_demo_finances.py. Nobody's money is "
        "in here. The house-price index that moves the home is the real public "
        "one; everything it is applied to is made up.",
    ]

    snapshot = fin.assemble(accounts, txns, sources, investments, cat,
                            assets=assets, loans=loans, equity=equity, pension=pension,
                            assets_cfg=assets_doc.get("assets") or [],
                            ssb_cache=ssb_cache, notes=notes, synthetic=True)
    snapshot["generatedAt"] = stamp
    return snapshot


def validate(snapshot: dict) -> list:
    """The checks a reviewer would make by hand, made once and kept. Named
    problems, not a boolean: a demo that is wrong should say how."""
    bad = []
    nw = snapshot.get("netWorth") or {}
    parts = ["cash", "investments", "pension", "assets", "liabilities"]
    total = sum(float(nw.get(k) or 0) for k in parts)
    if abs(total - float(nw.get("total") or 0)) > 1.0:
        bad.append(f"netWorth.total {nw.get('total')} != the parts summed ({total:.2f})")
    hist = snapshot.get("history") or {}
    lengths = {k: len(v) for k, v in hist.items() if isinstance(v, list)}
    if len(set(lengths.values())) != 1:
        bad.append(f"history arrays are different lengths: {lengths}")
    days = hist.get("days") or []
    if days and days[-1] != snapshot["generatedAt"][:10]:
        bad.append(f"history ends {days[-1]}, snapshot says {snapshot['generatedAt'][:10]}")
    ask = snapshot.get("ask")
    if not isinstance(ask, list) or not ask:
        bad.append("no ask table")
    else:
        if len(ask) > 250:
            bad.append(f"ask has {len(ask)} rows; keep it to a couple of hundred")
        for row in ask:
            if not isinstance(row, dict):
                bad.append("ask holds something that is not a row")
                break
            for k, v in row.items():
                if isinstance(v, (dict, list)):
                    bad.append(f"ask row {row.get('row')} has a nested value at {k}")
                    break
    for t in snapshot.get("transactions") or []:
        if t.get("category") in (None, ""):
            bad.append(f"transaction with no category: {t.get('text')}")
            break
    uncategorised = sum(1 for t in snapshot.get("transactions") or []
                        if t.get("category") == "other")
    if uncategorised:
        bad.append(f"{uncategorised} demo transactions fell through to Uncategorised; "
                   f"the example should match its own categories.json")
    if not snapshot.get("synthetic"):
        bad.append("the example must be marked synthetic")
    return bad


def write(snapshot: dict, root: str) -> str:
    out = os.path.join(root, APP, "data", "snapshot.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    return out


def committed_today(path: str) -> date:
    with open(path, encoding="utf-8") as fh:
        return date.fromisoformat(json.load(fh)["generatedAt"][:10])


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--today", help="the demo's last day of data (default: today)")
    ap.add_argument("--out-root", default=ROOT, help="the repository root to write under")
    ap.add_argument("--check", action="store_true",
                    help="regenerate to a temp directory and diff against the committed file")
    args = ap.parse_args()

    fin = load_finances()
    committed = os.path.join(args.out_root, APP, "data", "snapshot.json")

    if args.check:
        when = committed_today(committed)
    elif args.today:
        when = date.fromisoformat(args.today)
    else:
        when = date.today()

    # Every builder in finances.py asks the module what day it is. Pinning it
    # here is what makes a rebuild on a later day reproduce the committed file
    # rather than quietly moving every window.
    fin.today = lambda: when

    snapshot = build(fin, when)
    problems = validate(snapshot)

    if args.check:
        tmp = tempfile.mkdtemp(prefix="finances-check-")
        try:
            fresh = write(snapshot, tmp)
            same = (os.path.exists(committed)
                    and open(committed, "rb").read() == open(fresh, "rb").read())
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        if problems or not same:
            print("check: problems", problems, "| bytes match:", same)
            sys.exit(1)
        print("check: the committed data is what the generator makes")
        return

    out = write(snapshot, args.out_root)
    size = os.path.getsize(out)
    nw = snapshot["netWorth"]
    print(f"wrote {os.path.relpath(out, args.out_root)} — {size / 1024:.1f} kB, "
          f"{len(snapshot['accounts'])} accounts, {len(snapshot['transactions'])} transactions, "
          f"{len(snapshot['history']['days'])} days of history, "
          f"{len(snapshot['ask'])} ask rows, net worth {nw['total']:,.0f}")
    if problems:
        print("validate:", problems)
        sys.exit(1)
    print("validate: ok")


# ── The one real thing in this file ─────────────────────────────────────────
# Statistics Norway table 07221, "Prisindeks for brukte boliger" (price index
# for existing dwellings), seasonally adjusted, quarterly, for the country as a
# whole. Fetched from SSB's open, unauthenticated API — https://data.ssb.no —
# and cached here so this generator needs no network and --check is
# deterministic. Trimmed to 2021 onwards, which is everything the demo's anchor
# date and history reach back to.
#
# Statistics Norway publishes its statistics under the Norwegian Licence for
# Open Government Data (NLOD) and asks to be credited as the source; the app's
# NOTES.md carries the attribution, and the snapshot prints the table and cut
# under the home's value on screen. Refresh these numbers with:
#
#     python3 scripts/finances.py --probe-assets
#
# The live pull fetches the index itself — this cache is only for the demo.
SSB_INDEX = {
    ('Hele landet', 'Alle boligtyper'): (
        {
            "2021-03-31": 131.0, "2021-06-30": 133.8, "2021-09-30": 135.8, "2021-12-31": 137.6,
            "2022-03-31": 140.4, "2022-06-30": 142.2, "2022-09-30": 142.4, "2022-12-31": 141.3,
            "2023-03-31": 140.3, "2023-06-30": 141.9, "2023-09-30": 140.7, "2023-12-31": 140.4,
            "2024-03-31": 141.9, "2024-06-30": 144.0, "2024-09-30": 145.4, "2024-12-31": 147.1,
            "2025-03-31": 151.0, "2025-06-30": 150.6, "2025-09-30": 152.7, "2025-12-31": 155.8,
            "2026-03-31": 156.7, "2026-06-30": 157.3,
        },
        'Hele landet, Alle boligtyper, Prisindeks for brukte boliger, sesongjustert',
    ),
    ('Hele landet', 'Eneboliger'): (
        {
            "2021-03-31": 128.4, "2021-06-30": 131.8, "2021-09-30": 133.9, "2021-12-31": 135.6,
            "2022-03-31": 137.5, "2022-06-30": 139.7, "2022-09-30": 139.8, "2022-12-31": 139.0,
            "2023-03-31": 137.4, "2023-06-30": 138.6, "2023-09-30": 137.0, "2023-12-31": 136.5,
            "2024-03-31": 138.3, "2024-06-30": 139.7, "2024-09-30": 141.0, "2024-12-31": 142.0,
            "2025-03-31": 146.1, "2025-06-30": 145.3, "2025-09-30": 147.9, "2025-12-31": 150.9,
            "2026-03-31": 152.3, "2026-06-30": 152.8,
        },
        'Hele landet, Eneboliger, Prisindeks for brukte boliger, sesongjustert',
    ),
    ('Hele landet', 'Blokkleiligheter'): (
        {
            "2021-03-31": 137.7, "2021-06-30": 138.3, "2021-09-30": 139.4, "2021-12-31": 141.9,
            "2022-03-31": 145.7, "2022-06-30": 147.1, "2022-09-30": 148.5, "2022-12-31": 146.3,
            "2023-03-31": 146.4, "2023-06-30": 149.7, "2023-09-30": 148.2, "2023-12-31": 148.7,
            "2024-03-31": 149.5, "2024-06-30": 153.5, "2024-09-30": 154.9, "2024-12-31": 157.7,
            "2025-03-31": 162.4, "2025-06-30": 161.4, "2025-09-30": 163.2, "2025-12-31": 165.6,
            "2026-03-31": 165.9, "2026-06-30": 166.0,
        },
        'Hele landet, Blokkleiligheter, Prisindeks for brukte boliger, sesongjustert',
    ),}


if __name__ == "__main__":
    main()
