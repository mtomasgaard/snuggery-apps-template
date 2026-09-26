#!/usr/bin/env python3
"""Source probe for the Shelf Atlas / World Oil & Gas pipeline.

Fetches every URL in a list and prints what came back: status, content type,
size, and a peek suited to the type (zip members, CSV header and first rows,
JSON keys, ArcGIS Hub dataset listings, hrefs on an HTML page). It downloads
nothing to disk that the build would keep. It exists because the sources sit
behind hosts a development sandbox cannot reach, and a GitHub runner can.
"""
import io, json, re, sys, zipfile, urllib.request, urllib.error

UA = "shelf-atlas-probe/1.0 (+https://github.com/mtomasgaard/snuggery-apps-template)"

def fetch(url, timeout=90, method="GET", data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"User-Agent": UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(40_000_000)
            return r.status, r.headers.get("content-type", ""), body, r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("content-type", ""), e.read(4000), url
    except Exception as e:  # noqa
        return 0, repr(e), b"", url

def peek(url, ctype, body):
    out = []
    head = body[:4]
    if head[:2] == b"PK":
        try:
            z = zipfile.ZipFile(io.BytesIO(body))
            for i in z.infolist()[:80]:
                out.append(f"    zip: {i.filename} {i.file_size}")
            # peek a .csv/.dbf/.prj inside
            for i in z.infolist():
                if i.filename.lower().endswith(".dbf"):
                    d = z.read(i)
                    nf = (int.from_bytes(d[8:10], "little") - 33) // 32
                    names = []
                    for k in range(nf):
                        rec = d[32 + 32 * k: 64 + 32 * k]
                        names.append(rec[:11].split(b"\0")[0].decode("latin1") + ":" + chr(rec[11]) + str(rec[16]))
                    out.append(f"    dbf: {int.from_bytes(d[4:8], 'little')} records; " + ", ".join(names))
                if i.filename.lower().endswith(".prj"):
                    out.append("    prj: " + z.read(i).decode("latin1")[:300])
                if i.filename.lower().endswith(".csv"):
                    txt = z.read(i).decode("utf-8-sig", "replace")
                    for ln in txt.splitlines()[:3]:
                        out.append("    csv: " + ln[:600])
                    out.append(f"    csv rows: {txt.count(chr(10))}")
                    break
        except Exception as e:
            out.append(f"    zip error {e}")
        return out
    txt = body.decode("utf-8-sig", "replace")
    st = txt.lstrip()[:1]
    if st in "{[":
        try:
            j = json.loads(txt)
            if isinstance(j, dict):
                out.append("    json keys: " + ", ".join(list(j.keys())[:40]))
                # ArcGIS REST service listing
                for lyr in (j.get("layers") or [])[:400]:
                    out.append(f"    layer {lyr.get('id')}: {lyr.get('name')} ({lyr.get('geometryType', lyr.get('type'))})")
                for sv in (j.get("services") or [])[:400]:
                    out.append(f"    service: {sv.get('name')} ({sv.get('type')}) {sv.get('url','')}")
                for r in (j.get("results") or [])[:200]:
                    if isinstance(r, dict):
                        out.append(f"    item: {r.get('title')!r} type={r.get('type')} url={r.get('url')} lic={re.sub(r'<[^>]+>', ' ', str(r.get('licenseInfo') or ''))[:160]!r} access={r.get('accessInformation')}")
                # ArcGIS Hub v3
                for d in (j.get("data") or [])[:80]:
                    a = d.get("attributes", {}) if isinstance(d, dict) else {}
                    out.append(f"    dataset: {a.get('name')!r} id={d.get('id')} url={a.get('url')} lic={str(a.get('licenseInfo') or a.get('license'))[:80]!r} recs={a.get('recordCount')}")
                # WFS/GeoJSON
                if "features" in j:
                    fs = j["features"]
                    out.append(f"    features: {len(fs)} numberMatched={j.get('numberMatched')} totalFeatures={j.get('totalFeatures')}")
                    if fs:
                        p = fs[0].get("properties", {})
                        out.append("    props: " + json.dumps(p)[:900])
                        g = fs[0].get("geometry") or {}
                        out.append(f"    geom: {g.get('type')} {json.dumps(g.get('coordinates'))[:160]}")
                if "fields" in j and isinstance(j["fields"], list):
                    out.append("    fields: " + ", ".join(f"{f.get('name')}:{f.get('type')}" for f in j["fields"][:60]))
                for k in ("description", "copyrightText", "serviceDescription", "spatialReference", "count", "extent"):
                    if k in j:
                        out.append(f"    {k}: {str(j[k])[:300]}")
            else:
                out.append(f"    json list of {len(j)}: {json.dumps(j[:2])[:600]}")
        except Exception as e:
            out.append(f"    json error {e}: {txt[:300]!r}")
        return out
    if "<html" in txt[:3000].lower() or "<!doctype" in txt[:200].lower() or ctype.startswith("text/html"):
        hrefs = re.findall(r'href=["\']([^"\']+)["\']', txt, re.I)
        for m in re.finditer(r'<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', txt, re.I | re.S):
            h, t = m.group(1), re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(2))).strip()
            if re.search(r'\.(zip|xlsx|xls|csv|geojson|gpkg|json)(\?|$)|/media/|download|wfs|wms|arcgis|datacenter|data-center|productie|production|file', h, re.I):
                out.append(f"    a: {t[:80]!r} -> {h[:160]}")
        srcs = re.findall(r'(https?://[^\s"\'<>]+?\.(?:zip|xlsx|xls|csv|geojson|json|gpkg))', txt, re.I)
        keep = [h for h in hrefs if re.search(r'\.(zip|xlsx|xls|csv|geojson|gpkg|json)(\?|$)|wfs|wms|arcgis|download|produktion|production|felt|field|shape|kort|map', h, re.I)]
        seen = set()
        for h in keep + srcs:
            if h in seen: continue
            seen.add(h)
            out.append("    href: " + h[:200])
            if len(seen) > 120: break
        m = re.search(r'<title>(.*?)</title>', txt, re.I | re.S)
        out.append(f"    title: {m.group(1).strip()[:120] if m else '?'}")
        for kw in ("Open Government Licence", "NLOD", "CC BY", "Creative Commons", "licen", "Licen", "vilkår", "terms"):
            i = txt.find(kw)
            if i >= 0:
                out.append(f"    {kw!r} at {i}: " + re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', txt[max(0,i-200):i+300]))[:400])
        return out
    if txt[:200].lstrip().startswith("<?xml") or "<wfs:" in txt[:2000] or "<WFS_" in txt[:3000]:
        names = re.findall(r'<(?:wfs:)?Name>([^<]+)</(?:wfs:)?Name>', txt)
        out.append(f"    xml feature types ({len(names)}): " + ", ".join(names[:200]))
        out.append("    xml head: " + re.sub(r'\s+', ' ', txt[:500]))
        return out
    lines = txt.splitlines()
    for ln in lines[:4]:
        out.append("    txt: " + ln[:700])
    out.append(f"    lines: {len(lines)}")
    return out

def main():
    urls = [l.strip() for l in open(sys.argv[1]) if l.strip() and not l.startswith("#")]
    for u in urls:
        method, data, headers = "GET", None, None
        if u.startswith("POST "):
            u = u[5:]
            base, _, q = u.partition("?")
            u, data = base, q.encode()
            method, headers = "POST", {"Content-Type": "application/x-www-form-urlencoded"}
        status, ctype, body, final = fetch(u, method=method, data=data, headers=headers)
        print(f"\n=== {u}\n    -> {status} {ctype} {len(body)} bytes" + (f" (final {final})" if final != u else ""))
        if status == 0:
            continue
        for ln in peek(u, ctype, body):
            print(ln)
        sys.stdout.flush()

if __name__ == "__main__":
    main()
