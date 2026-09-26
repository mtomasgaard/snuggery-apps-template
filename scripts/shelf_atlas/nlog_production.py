"""Netherlands — monthly production per field from the NLOG datacenter's API.

The datacenter (https://www.nlog.nl/datacenter/) is an Angular app; its bundle calls

    POST https://www.nlog.nl/nlog-mapviewer/rest/prodfigures/field
    Content-Type: application/json
    {"yearStart": 2024, "yearEnd": 2024, "product": "Gas", "production": "Produced"}

and gets a list of rows, one per field and year, with the twelve months and a total.
Products: Gas, Oil, Condensate (also Water, Brine, Salt, N2, Diesel). Production types: Produced
(also Injected, Stored, Discharged for some products). The datacenter's year picker starts at
2003, and so does the data. An unknown key in the body is rejected with HTTP 400 naming it —
useful: a renamed field fails loudly.

Units, as the datacenter's own column headers label them: gas in **1000 Nm³** (the app's
DEFAULT_GAS_UNIT; it converts to 1000 Sm³ client-side by a fixed factor), oil and condensate in
**Sm³**. Nm³ (0 °C) → Sm³ (15 °C) is ×1.05493 here. The first row's keys are logged on every
run and the month keys are found by name, so a change of casing does not break the build.
"""
from __future__ import annotations

import datetime as dt
import json
import re

from .common import BuildError, Cache, log, month_index, norm_name

API = "https://www.nlog.nl/nlog-mapviewer/rest/prodfigures/field"
FIRST_YEAR = 2003
NM3_TO_SM3 = 288.15 / 273.15
MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def _post(cache: Cache, key: str, body: dict):
    raw = cache.get(key, API, method="POST", data=json.dumps(body).encode(),
                    headers={"Content-Type": "application/json", "Accept": "application/json"})
    txt = raw.decode("utf-8", "replace").strip()
    if not txt.startswith("["):
        raise BuildError(f"NLOG prodfigures {body}: not a JSON list: {txt[:200]}")
    return json.loads(txt)


def _month_keys(row: dict):
    keys = {}
    for k in row:
        lk = k.lower()
        for i, m in enumerate(MONTHS):
            if lk == m or lk.startswith(m) and len(lk) <= 5 or lk in (f"m{i+1}", f"month{i+1}"):
                keys[i + 1] = k
    return keys if len(keys) == 12 else None


def _num(v):
    if v in (None, "", "-"):
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def attach_production(cache: Cache, fields: dict):
    """fields: {normalised name: field record} from the WFS; adds series in Sm³ per month."""
    by_key = dict(fields)
    by_code = {norm_name(f.get("code") or ""): f for f in fields.values() if f.get("code")}
    this_year = dt.date.today().year
    unmatched = {}
    n_cells = 0
    shown = False
    for product, idx, factor in (("Gas", 1, 1000.0 * NM3_TO_SM3), ("Oil", 0, 1.0), ("Condensate", 0, 1.0)):
        for year in range(FIRST_YEAR, this_year + 1):
            body = {"yearStart": year, "yearEnd": year, "product": product, "production": "Produced"}
            # the current and previous year change monthly; older years are cached for good
            key = f"netherlands/prod/{product.lower()}-{year}.json"
            if year >= this_year - 1:
                cache_key_path = cache.path(key)
                import os
                if os.path.exists(cache_key_path) and not cache.refresh:
                    age = dt.datetime.now().timestamp() - os.path.getmtime(cache_key_path)
                    if age > 3 * 86400:
                        os.remove(cache_key_path)
            rows = _post(cache, key, body)
            if not rows:
                continue
            if not shown:
                log(f"  nlog: prodfigures row keys: {sorted(rows[0].keys())}")
                shown = True
            mk = _month_keys(rows[0])
            if mk is None:
                raise BuildError(f"NLOG prodfigures: no month columns in {sorted(rows[0].keys())}")
            for r in rows:
                name = str(r.get("name") or r.get("fieldName") or "").strip()
                code = str(r.get("code") or r.get("fieldCode") or "").strip()
                f = by_code.get(norm_name(code)) if code else None
                if f is None:
                    f = by_key.get(norm_name(name))
                if f is None:
                    unmatched[name or code] = unmatched.get(name or code, 0) + 1
                    continue
                for m in range(1, 13):
                    v = _num(r.get(mk[m]))
                    if v <= 0:
                        continue
                    mi = month_index(year, m)
                    cell = f["series"].setdefault(mi, [0.0, 0.0, 0.0])
                    cell[idx] += v * factor
                    n_cells += 1
    for f in fields.values():
        for cell in f["series"].values():
            cell[2] = cell[0] + cell[1] / 1000.0
    n_fields = sum(1 for f in fields.values() if f["series"])
    log(f"  nlog: {n_cells} field-month values for {n_fields} fields since {FIRST_YEAR}; "
        f"{len(unmatched)} row names without a WFS field: {sorted(unmatched)[:15]}")
    # sanity: the Netherlands produced 10-80 bcm/yr of gas in every year since 2003
    y = this_year - 2
    gas = sum(v[1] for f in fields.values() for mi, v in f["series"].items() if (mi // 12) + 1971 == y)
    log(f"  nlog: total gas {y}: {gas / 1e9:.1f} bcm")
    if not (2e9 < gas < 120e9):
        raise BuildError(f"NLOG gas total for {y} is {gas / 1e9:.1f} bcm; the unit assumption is wrong")
    if n_fields < 100:
        raise BuildError(f"NLOG: only {n_fields} fields matched a series")
