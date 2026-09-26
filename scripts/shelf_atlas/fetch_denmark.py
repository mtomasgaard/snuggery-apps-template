"""Denmark — the Danish Energy Agency (Energistyrelsen) and GEUS.

Production
  The yearly workbook "1972–<last year>" (one sheet; blocks in column A: "Oil, thousand cubic
  meters" / Production / one row per field, then "Gas, million normal cubic meters" / Production /
  rows) gives annual totals per field from 1972.
  The monthly reports ("Danish Production of Oil, Gas and Water for <Month> <Year>") give each
  field's monthly oil (thousand m³) and gas (million Nm³) — HTML pages from January 2018, PDFs from
  January 2024, both linked from the same page. Before 2018 the app gets the annual total spread
  evenly over the twelve months, and the field carries `monthlyFrom` so the app can say so.

Geometry
  Field delineations: the Agency's shapefile (ED50 / UTM 31N, shifted to WGS84 here).
  Platforms: GEUS's WFS layer `ens_platform` (WGS84), which is the Agency's installations list.
  Pipelines: the Agency publishes none as open data; the build takes Denmark's from EMODnet.

Licence: the Agency's data pages carry no licence statement. Danish public-sector data is
re-usable under the PSI Act (Lov om videreanvendelse af den offentlige sektors informationer);
this build treats it as free to reuse with attribution and says so on the attribution screen.
"""
from __future__ import annotations

import io
import json
import math
import re

from .common import (BuildError, Cache, ed50_to_wgs84, log, month_index, norm_name, shape_rings,
                     shapefile_records)

PAGE = "https://ens.dk/en/energy-sources/monthly-and-yearly-production"
SHAPE_PAGE = "https://ens.dk/en/energy-sources/oil-and-gas-related-data/shape-files-oil-and-gas-maps"
GEUS_PLATFORMS = ("https://data.geus.dk/geusmap/ows/4326.jsp?nocache=nocache&whoami=ul@geus.dk&SERVICE=WFS"
                  "&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=ens_platform&outputformat=geojson")
MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july",
                                      "august", "september", "october", "november", "december"], 1)}

SOURCE = {
    "id": "dea",
    "name": "Danish Energy Agency (Energistyrelsen) — monthly and yearly production, field delineations; GEUS — installations",
    "url": PAGE,
    "licence": "No licence stated on the data pages; Danish public-sector information, reusable under the PSI Act, attribution given",
    "attribution": "Danish field data: Danish Energy Agency (ens.dk); installations via GEUS",
    "cadence": "Monthly report about six weeks after month end; yearly workbook each spring",
}


# ---------------------------------------------------------------------------
# ED50 / UTM 31N -> geographic (International 1924), then to WGS84
# ---------------------------------------------------------------------------

def utm_to_geo(x: float, y: float, zone: int = 31, a: float = 6378388.0, f: float = 1 / 297.0):
    k0 = 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    n = f / (2 - f)
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    x = x - 500000.0
    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))
    sin1, cos1, tan1 = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    n1 = a / math.sqrt(1 - e2 * sin1 ** 2)
    t1 = tan1 ** 2
    c1 = ep2 * cos1 ** 2
    r1 = a * (1 - e2) / (1 - e2 * sin1 ** 2) ** 1.5
    d = x / (n1 * k0)
    lat = phi1 - (n1 * tan1 / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
                                     + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720)
    lon = lon0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6
                  + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120) / cos1
    return math.degrees(lat), math.degrees(lon)


# ---------------------------------------------------------------------------

def _page_links(cache: Cache):
    """The production page: for every month, the first link (the SI-units list comes before the
    barrels list) and the yearly workbook ('1972-2025')."""
    html = cache.get("denmark/production-page.html", PAGE).decode("utf-8", "replace")
    monthly = {}
    yearly = None
    for m in re.finditer(r'<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, re.I | re.S):
        href, text = m.group(1).strip(), re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", m.group(2)).replace("&nbsp;", " ")).strip()
        if not href.startswith("http"):
            href = "https://ens.dk" + href
        mm = re.match(r"([A-Za-z]+)\s+(\d{4})$", text)
        if mm and mm.group(1).lower() in MONTHS:
            ym = (int(mm.group(2)), MONTHS[mm.group(1).lower()])
            monthly.setdefault(ym, href)      # first wins: the SI list precedes the barrels list
        elif re.match(r"19\d\d\s*[-–]\s*20\d\d$", text) and yearly is None:
            yearly = href
    if yearly is None or len(monthly) < 24:
        raise BuildError(f"DEA production page: yearly={yearly}, {len(monthly)} monthly links; the page layout changed")
    return yearly, monthly


def _read_yearly(cache: Cache, url: str):
    import openpyxl
    raw = cache.get("denmark/yearly.xlsx", url)
    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    blocks = {}       # "oil" | "gas" -> {field: {year: value}}
    block = None
    years = None
    for r in rows:
        a = str(r[0]).strip() if r and r[0] is not None else ""
        low = a.lower()
        if low.startswith("oil,"):
            block, years = "oil", None
            continue
        if low.startswith("gas,"):
            block, years = "gas", None
            continue
        if low.startswith("water") or low in ("export", "fuel", "flare", "injection"):
            block = None
            continue
        if block and years is None and a == "" and r and any(isinstance(v, (int, float)) and 1900 < v < 2100 for v in r[1:]):
            years = [int(v) if isinstance(v, (int, float)) else None for v in r[1:]]
            continue
        if block and years and a and low not in ("production", "total"):
            vals = {}
            for y, v in zip(years, r[1:]):
                if y and isinstance(v, (int, float)):
                    vals[y] = float(v)
            if vals:
                blocks.setdefault(block, {})[a] = vals
    if "oil" not in blocks or "gas" not in blocks or len(blocks["oil"]) < 10:
        raise BuildError(f"DEA yearly workbook: blocks {list(blocks)} with {len(blocks.get('oil', {}))} oil rows; layout changed")
    return blocks


def _monthly_values(text: str, names: list[str]):
    """Parse 'Oil, M m³ ... Field Monthly ... Dan 66.0 2.1 ...' into {field: monthly} for oil and gas."""
    t = re.sub(r"\s+", " ", text)
    out = {}
    alt = "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))
    for kind, head in (("oil", r"Oil,\s*M\s*m"), ("gas", r"Gas,\s*MM\s*Nm")):
        m = re.search(head, t)
        if not m:
            continue
        seg = t[m.end(): m.end() + 4000]
        end = re.search(r"\bTotal\b", seg)
        seg = seg[: end.start()] if end else seg
        vals = {}
        for mm in re.finditer(r"(?<![A-Za-z])(" + alt + r")\s+(-|\d[\d,]*\.?\d*)", seg):
            v = mm.group(2)
            vals[mm.group(1)] = 0.0 if v == "-" else float(v.replace(",", ""))
        out[kind] = vals
    return out


def _read_monthly(cache: Cache, ym, url: str, names: list[str]):
    y, m = ym
    key = f"denmark/monthly/{y}-{m:02d}" + (".pdf" if "/media/" in url else ".htm")
    raw = cache.get(key, url)
    if raw[:4] == b"%PDF":
        import pypdf
        r = pypdf.PdfReader(io.BytesIO(raw))
        text = " ".join((pg.extract_text() or "") for pg in r.pages)
    else:
        text = raw.decode("utf-8", "replace")
        text = re.sub(r"<[^>]+>", " ", text).replace("&nbsp;", " ")
    return _monthly_values(text, names)


# Names as the Agency's shapefile writes them -> as its production tables write them.
OUTLINE_ALIASES = {"SOUTHARNE": "SYDARNE", "TYRASOUTHEAST": "TYRASE", "TYRASOEST": "TYRASE",
                   "TYRASO": "TYRASE", "TYRASE": "TYRASE", "HALFDANNORDOST": "HALFDAN"}


def _outline_key(name: str) -> str:
    base = re.sub(r"\s*[-–]\s*.*\bpart\b.*$", "", name, flags=re.I)   # 'South Arne - western part'
    k = norm_name(base)
    return OUTLINE_ALIASES.get(k, k)


def load(cache: Cache):
    yearly_url, monthly_links = _page_links(cache)
    blocks = _read_yearly(cache, yearly_url)
    names = sorted(set(blocks["oil"]) | set(blocks["gas"]))
    fields = {}
    for name in names:
        key = norm_name(name)
        fields[key] = {
            "id": f"DK-{key}", "country": "DK", "name": name.upper(), "key": key, "hc": None,
            "status": None, "operator": None, "discYear": None, "prodStart": None, "url": PAGE,
            "statusHist": [], "operatorHist": [], "series": {}, "rings": [], "point": None,
            "source": "dea", "monthlyFrom": None,
        }
    # annual totals spread evenly, oil thousand m³ -> Sm³, gas million Nm³ -> Sm³
    first_monthly = min(monthly_links)
    first_mi = month_index(*first_monthly)
    for kind, factor, idx in (("oil", 1e3, 0), ("gas", 1e6, 1)):
        for name, vals in blocks[kind].items():
            f = fields[norm_name(name)]
            for y, v in vals.items():
                if v <= 0:
                    continue
                for mo in range(1, 13):
                    mi = month_index(y, mo)
                    if mi >= first_mi:
                        continue
                    cell = f["series"].setdefault(mi, [0.0, 0.0, 0.0])
                    cell[idx] += v * factor / 12.0
    for f in fields.values():
        if f["series"]:
            f["monthlyFrom"] = first_mi
    # monthly reports
    n_ok = 0
    for ym in sorted(monthly_links):
        try:
            vals = _read_monthly(cache, ym, monthly_links[ym], [n for n in names] + ["Tyra SE", "Syd Arne"])
        except Exception as e:  # noqa
            log(f"  dea: monthly {ym} unreadable: {e}")
            continue
        if not vals.get("oil") and not vals.get("gas"):
            log(f"  dea: monthly {ym}: no values parsed")
            continue
        mi = month_index(*ym)
        for kind, factor, idx in (("oil", 1e3, 0), ("gas", 1e6, 1)):
            for name, v in vals.get(kind, {}).items():
                key = norm_name(name)
                f = fields.get(key)
                if f is None:
                    continue
                cell = f["series"].setdefault(mi, [0.0, 0.0, 0.0])
                cell[idx] = v * factor
        n_ok += 1
    for f in fields.values():
        for cell in f["series"].values():
            cell[2] = cell[0] + cell[1] / 1000.0
        f["series"] = {mi: c for mi, c in f["series"].items() if c[0] > 0 or c[1] > 0}
    log(f"  dea: {len(fields)} fields, {n_ok}/{len(monthly_links)} monthly reports parsed, "
        f"annual spread before {first_monthly}")
    if n_ok < len(monthly_links) * 0.8:
        raise BuildError(f"DEA: only {n_ok} of {len(monthly_links)} monthly reports parsed")

    # --- field outlines ---
    html = cache.get("denmark/shape-page.html", SHAPE_PAGE).decode("utf-8", "replace")
    m = re.search(r'href=["\']\s*([^"\']+)["\'][^>]*>\s*Shape file with field delineations', html, re.I)
    if not m:
        raise BuildError("DEA shapefile page: no 'field delineations' link")
    href = m.group(1).strip()
    if not href.startswith("http"):
        href = "https://ens.dk" + href
    n_geom = 0
    unmatched = []
    seen_names = []
    for rec, shape in shapefile_records(cache.get("denmark/fields.zip", href)):
        name = str(rec.get("Field") or rec.get("Label") or "").strip()
        seen_names.append(name)
        f = fields.get(_outline_key(name))
        if f is None:
            unmatched.append(name)
            continue
        for ring in shape_rings(shape):
            pts = []
            for x, y in ring:
                lat, lon = utm_to_geo(x, y)
                lat, lon = ed50_to_wgs84(lat, lon)
                pts.append((lon, lat))
            f["rings"].append(pts)
        n_geom += 1
    log(f"  dea: outline names: {seen_names}")
    log(f"  dea: {n_geom} outlines matched; unmatched outline names: {unmatched}; "
        f"fields without outline: {[f['name'] for f in fields.values() if not f['rings']]}")

    # --- platforms (GEUS WFS) ---
    facilities = []
    gj = json.loads(cache.get("denmark/platforms.geojson", GEUS_PLATFORMS))
    for ft in gj.get("features", []):
        p = ft.get("properties", {})
        g = ft.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        lon, lat = g["coordinates"][:2]
        sy = p.get("start_using_year")
        facilities.append({
            "id": f"DK-F{p.get('id') or p.get('ogc_fid')}",
            "country": "DK",
            "name": (p.get("platform_name") or "").strip(),
            "kind": ((p.get("category_name") or "") + " " + (p.get("platform_type_name") or "")).strip(),
            "surface": True,
            "phase": (p.get("status_name") or "").strip(),
            "startYear": int(sy) if str(sy).isdigit() else None,
            "endYear": None,
            "field": None,
            "operator": (p.get("operator_name") or "").strip() or None,
            "lon": float(lon), "lat": float(lat), "source": "dea",
        })
    if len(facilities) < 30:
        raise BuildError(f"GEUS platforms: only {len(facilities)}")
    # operator and status: the Agency's tables carry neither, so the operator comes from the
    # nearest operational platform (within 12 km of the outline's centroid) and the status from
    # whether the field produced in the last three reported months.
    from .common import centroid as _centroid
    last_mi = max((mi for f in fields.values() for mi in f["series"]), default=None)
    for f in fields.values():
        if f["rings"]:
            cx, cy = _centroid(f["rings"])
            best = None
            for fa in facilities:
                d = math.hypot((fa["lon"] - cx) * 111.32 * math.cos(math.radians(cy)), (fa["lat"] - cy) * 110.57)
                if d < 12 and fa["operator"] and (best is None or d < best[0]):
                    best = (d, fa["operator"])
            if best:
                f["operator"] = best[1]
        if last_mi is not None and f["series"]:
            recent = any(mi >= last_mi - 2 for mi in f["series"])
            f["status"] = "Producing" if recent else "Not producing"
    log(f"  dea: {len(facilities)} platforms")
    return {"fields": list(fields.values()), "facilities": facilities, "pipelines": []}
