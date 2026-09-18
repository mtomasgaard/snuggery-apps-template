#!/usr/bin/env python3
"""Build the geometry of six famous marathon courses, resampled with real terrain.

Writes scripts/demo_courses.json: each course as a polyline resampled every ~50 m,
with a terrain elevation at every point. A demo-data generator (e.g.
make_demo_running_dashboard.py) cuts short synthetic training-run segments out of these
so a demo run sits somewhere recognisable -- never anyone's actual GPS trace.

Boston (OSM relation 11680552) exists in OpenStreetMap as a route relation
mapped from the certified course. One Overpass query
(`relation(id); out body; way(r); out geom;`) returns both the
relation's own ordered, role-tagged member list and every member way's geometry.
Two reconstructions are tried -- chain_by_order() walks the member list in OSM's
own order, flipping a way when its role says "backward" (and, uniquely, lets a
way the route reuses -- an out-and-back spur -- appear twice); chain_by_proximity()
ignores that order and greedily walks from whichever remaining way's nearest
endpoint is closest to the current chain end. Whichever leaves the smaller largest
gap between consecutive points wins, on the theory that a correctly reconstructed
path of ways sharing OSM nodes should have gaps near zero. The largest gap is kept
in the output so a reviewer can judge whether the OSM mapping itself has a hole.

Chicago, New York City, Berlin, London and Tokyo are approximated instead:
hand-placed waypoints along the known course, sent to OSRM's public demo
router (its only profile is `driving`) for one `overview=full&geometries=geojson`
request per course. Real streets, not the certified line, and the waypoints
were placed by hand from memory of the courses. (London's relation, 2086183,
carries more than one line — both reconstructions above left it at 48–55 km
with a gap of a kilometre or more — so it is routed like the others.)

Licensing -- this script's *output*, not just its code, is a derivative
database: route geometry is derived from OpenStreetMap data, (c) OpenStreetMap
contributors, Open Database License 1.0, so demo_courses.json should be
credited in this repository's TILES.md and LICENSE the same way (not done by
this script -- it only writes the data file). Elevation is the Mapzen terrain
merge through OpenTopoData's public API -- USGS NED in the United States,
EU-DEM in Europe, SRTM elsewhere: public domain or free with attribution, and
bare-earth in cities where plain SRTM reads rooftops. OpenTopoData asks for at
most one request a second, 100 locations each, 1000 a day.

    python3 scripts/make_demo_courses.py
    python3 scripts/make_demo_courses.py --cache-dir /tmp/course-cache

Stdlib plus `requests`. Responses are cached (a temp dir by default) so a
repeat run while iterating never re-hits the same request twice.
"""

import argparse
import bisect
import json
import math
import os
import tempfile
import time
from datetime import datetime, timezone

import requests

USER_AGENT = "snuggery-running-dashboard demo helper (github.com/mtomasgaard/snuggery-apps-template)"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving/{}"
ELEVATION_URL = "https://api.opentopodata.org/v1/mapzen"
STEP_M = 50.0
BATCH = 100
HERE = os.path.dirname(os.path.abspath(__file__))

RELATION_COURSES = {
    "boston": {"relation": 11680552, "name": "Boston Marathon", "city": "Boston", "country": "US", "tiles": "usgs", "start": (42.2287, -71.5230)},
}
OSRM_COURSES = {
    "chicago": {"name": "Chicago Marathon", "city": "Chicago", "country": "US", "tiles": "usgs", "waypoints": [
        (41.8806, -87.6206), (41.8917, -87.6280), (41.8781, -87.6278), (41.8781, -87.6324), (41.9110, -87.6320),
        (41.9255, -87.6360), (41.9469, -87.6547), (41.9400, -87.6450), (41.8965, -87.6340), (41.8845, -87.6350),
        (41.8790, -87.6770), (41.8780, -87.6475), (41.8695, -87.6620), (41.8580, -87.6660), (41.8525, -87.6320),
        (41.8310, -87.6265), (41.8310, -87.6240), (41.8674, -87.6240), (41.8735, -87.6210)]},
    "nyc": {"name": "New York City Marathon", "city": "New York", "country": "US", "tiles": "usgs", "waypoints": [
        (40.6027, -74.0596), (40.6188, -74.0313), (40.6825, -73.9772), (40.6893, -73.9552), (40.7050, -73.9520),
        (40.7302, -73.9540), (40.7430, -73.9530), (40.7508, -73.9405), (40.7593, -73.9617), (40.7828, -73.9447),
        (40.8025, -73.9300), (40.8090, -73.9250), (40.8115, -73.9330), (40.8140, -73.9365), (40.7985, -73.9520),
        (40.7840, -73.9590), (40.7735, -73.9695), (40.7658, -73.9787), (40.7724, -73.9760)]},
    "berlin": {"name": "Berlin Marathon", "city": "Berlin", "country": "DE", "tiles": None, "waypoints": [
        (52.5145, 13.3500), (52.5125, 13.3220), (52.5245, 13.3410), (52.5300, 13.3880), (52.5215, 13.4110),
        (52.5175, 13.4290), (52.4990, 13.4180), (52.4865, 13.4245), (52.4905, 13.3880), (52.4925, 13.3620),
        (52.4830, 13.3440), (52.4835, 13.3260), (52.5000, 13.3070), (52.5046, 13.3350), (52.5096, 13.3760),
        (52.5100, 13.3900), (52.5137, 13.3925), (52.5170, 13.3890), (52.5162, 13.3777)]},
    "london": {"name": "London Marathon", "city": "London", "country": "GB", "tiles": None, "waypoints": [
        (51.4720, 0.0140), (51.4805, 0.0555), (51.4915, 0.0640), (51.4880, 0.0330), (51.4830, -0.0090),
        (51.4790, -0.0270), (51.4930, -0.0500), (51.4980, -0.0640), (51.5055, -0.0750), (51.5100, -0.0530),
        (51.5020, -0.0200), (51.4940, -0.0130), (51.5050, -0.0200), (51.5120, -0.0400), (51.5095, -0.0750),
        (51.5085, -0.1000), (51.5070, -0.1220), (51.5030, -0.1360)]},
    "tokyo": {"name": "Tokyo Marathon", "city": "Tokyo", "country": "JP", "tiles": None, "waypoints": [
        (35.6896, 139.6917), (35.7020, 139.7450), (35.6840, 139.7740), (35.7110, 139.7965), (35.7020, 139.7930),
        (35.6720, 139.7960), (35.6717, 139.7650), (35.6580, 139.7480), (35.6390, 139.7400), (35.6740, 139.7590),
        (35.6812, 139.7645)]},
}


def haversine(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dphi, dlambda = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def http(method, url, cache_dir, cache_key, **kwargs):
    """GET/POST with a cache file; sleeps 0.5s only on an actual network call.

    A 429 or 5xx (the public Overpass/OSRM/OpenTopoData servers are shared and
    occasionally busy) backs off and retries a few times before giving up.
    """
    path = os.path.join(cache_dir, cache_key)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    for backoff in (15, 30, 60, 60, 90, 120, None):
        resp = getattr(requests, method)(url, headers={"User-Agent": USER_AGENT}, timeout=120, **kwargs)
        if resp.status_code == 429 or resp.status_code >= 500:
            if backoff is None:
                resp.raise_for_status()
            print(f"  ({resp.status_code} from {url.split('/')[2]}, retrying in {backoff}s)")
            time.sleep(backoff)
            continue
        resp.raise_for_status()
        break
    data = resp.json()
    # OpenTopoData asks for at most one request a second; the other two servers
    # get 0.5 s.
    time.sleep(1.2 if url == ELEVATION_URL else 0.5)
    os.makedirs(cache_dir, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return data


def fetch_relation(course, relation_id, cache_dir):
    """One Overpass call: the relation's own ordered, role-tagged member list (`out body;`)
    plus every member way's full geometry (`way(r); out geom;`), deduplicated by way id."""
    query = f"[out:json][timeout:180];relation({relation_id});out body;way(r);out geom;"
    data = http("post", OVERPASS_URL, cache_dir, f"overpass-{course}.json", data={"data": query})
    elements = data.get("elements", [])
    members = next((el["members"] for el in elements if el.get("type") == "relation"), [])
    ways_by_id = {el["id"]: [(pt["lat"], pt["lon"]) for pt in el["geometry"]]
                  for el in elements if el.get("type") == "way" and el.get("geometry")}
    return [m for m in members if m.get("type") == "way"], ways_by_id


def orient(chain, start):
    if chain and haversine(chain[-1], start) < haversine(chain[0], start):
        chain = chain[::-1]
    return chain


def chain_by_order(members, ways_by_id, start):
    """OSM's own member order, honouring each way's forward/backward role -- lets a way that
    the route uses twice (an out-and-back) appear twice, which a deduplicated set can't."""
    chain, max_gap = [], 0.0
    for m in members:
        pts = ways_by_id.get(m["ref"])
        if pts is None:
            continue
        if m.get("role") == "backward":
            pts = pts[::-1]
        if chain:
            max_gap = max(max_gap, haversine(chain[-1], pts[0]))
        chain.extend(pts)
    return orient(chain, start), max_gap


def chain_by_proximity(ways_by_id, start):
    """Greedy nearest-endpoint chaining over the deduplicated way set, ignoring OSM's member
    order entirely -- the fallback for a relation whose member order isn't the path order."""
    remaining = list(ways_by_id.values())
    remaining.sort(key=lambda p: min(haversine(p[0], start), haversine(p[-1], start)))
    first = remaining.pop(0)
    if haversine(first[-1], start) < haversine(first[0], start):
        first = first[::-1]
    chain, max_gap = list(first), 0.0
    while remaining:
        tail = chain[-1]
        i = min(range(len(remaining)),
                key=lambda i: min(haversine(remaining[i][0], tail), haversine(remaining[i][-1], tail)))
        pts = remaining.pop(i)
        d_start, d_end = haversine(pts[0], tail), haversine(pts[-1], tail)
        if d_end < d_start:
            pts = pts[::-1]
        max_gap = max(max_gap, min(d_start, d_end))
        chain.extend(pts)
    return chain, max_gap


def chain_ways(course, members, ways_by_id, start):
    """Try both reconstructions and keep whichever leaves the smaller largest gap -- a stand-in
    for "which one is actually one connected path", since a correct chaining of ways that share
    OSM nodes should have gaps near zero except at genuine holes in the mapping."""
    order_chain, order_gap = chain_by_order(members, ways_by_id, start)
    prox_chain, prox_gap = chain_by_proximity(ways_by_id, start)
    if order_chain and order_gap <= prox_gap:
        print(f"  {course}: used OSM member order (gap {order_gap:.0f} m vs {prox_gap:.0f} m by proximity)")
        return order_chain, order_gap
    print(f"  {course}: used nearest-endpoint chaining (gap {prox_gap:.0f} m vs {order_gap:.0f} m by member order)")
    return prox_chain, prox_gap


def fetch_osrm(course, waypoints, cache_dir):
    coords = ";".join(f"{lon:.5f},{lat:.5f}" for lat, lon in waypoints)
    url, key = OSRM_URL.format(coords), f"osrm-{course}.json"
    params = {"overview": "full", "geometries": "geojson"}
    data = None
    if os.path.exists(os.path.join(cache_dir, key)):
        data = http("get", url, cache_dir, key, params=params)
    else:
        for attempt in (1, 2):
            try:
                candidate = http("get", url, cache_dir, key, params=params)
                if candidate.get("code") == "Ok":
                    data = candidate
                    break
                print(f"  {course}: OSRM returned {candidate.get('code')}")
            except requests.RequestException as exc:
                print(f"  {course}: OSRM request failed ({exc})")
            if attempt == 1:
                time.sleep(5)
    if not data or data.get("code") != "Ok":
        return None
    route = data["routes"][0]
    return [(lat, lon) for lon, lat in route["geometry"]["coordinates"]], route["distance"]


def resample(points, step=STEP_M):
    dists = [0.0]
    for a, b in zip(points, points[1:]):
        dists.append(dists[-1] + haversine(a, b))
    total = dists[-1]
    out, d = [], 0.0
    while d < total:
        i = min(bisect.bisect_right(dists, d) - 1, len(points) - 2)
        a, b = points[i], points[i + 1]
        seg = dists[i + 1] - dists[i]
        t = 0.0 if seg == 0 else (d - dists[i]) / seg
        out.append((round(a[0] + (b[0] - a[0]) * t, 5), round(a[1] + (b[1] - a[1]) * t, 5)))
        d += step
    out.append((round(points[-1][0], 5), round(points[-1][1], 5)))
    return out, total


def fetch_elevations(course, points, cache_dir):
    elevs = []
    for start in range(0, len(points), BATCH):
        batch = points[start:start + BATCH]
        params = {"locations": "|".join(f"{p[0]:.5f},{p[1]:.5f}" for p in batch)}
        data = http("get", ELEVATION_URL, cache_dir, f"mapzen-{course}-{start}.json", params=params)
        results = data.get("results") or []
        elevs.extend([r.get("elevation") for r in results] + [None] * (len(batch) - len(results)))
    for i, e in enumerate(elevs):
        if e is not None:
            continue
        prev_i = next((j for j in range(i - 1, -1, -1) if elevs[j] is not None), None)
        next_i = next((j for j in range(i + 1, len(elevs)) if elevs[j] is not None), None)
        if prev_i is not None and next_i is not None:
            elevs[i] = elevs[prev_i] + (elevs[next_i] - elevs[prev_i]) * (i - prev_i) / (next_i - prev_i)
        else:
            elevs[i] = elevs[prev_i] if prev_i is not None else (elevs[next_i] if next_i is not None else 0.0)
    return [round(e, 1) for e in elevs]


def make_entry(meta, source, points, elevs, total_m, **extra):
    entry = {"name": meta["name"], "city": meta["city"], "country": meta["country"], "tiles": meta["tiles"],
             "source": source, "km": round(total_m / 1000, 2),
             "points": [[p[0], p[1], e] for p, e in zip(points, elevs)]}
    entry.update(extra)
    return entry


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--cache-dir", default=os.path.join(tempfile.gettempdir(), "snuggery-demo-courses-cache"))
    ap.add_argument("--out", default=os.path.join(HERE, "demo_courses.json"))
    args = ap.parse_args()
    courses = {}

    for key, meta in RELATION_COURSES.items():
        print(f"{key}: fetching OSM relation {meta['relation']}...")
        members, ways_by_id = fetch_relation(key, meta["relation"], args.cache_dir)
        if not ways_by_id:
            print(f"  {key}: Overpass returned no ways, dropping course")
            continue
        chain, gap = chain_ways(key, members, ways_by_id, meta["start"])
        points, total_m = resample(chain)
        elevs = fetch_elevations(key, points, args.cache_dir)
        courses[key] = make_entry(meta, f"OpenStreetMap relation {meta['relation']}", points, elevs, total_m,
                                   largestGapM=round(gap, 1))
        flag = " -- OUTSIDE 40-48km" if not 40 <= total_m / 1000 <= 48 else ""
        print(f"  {key}: {total_m/1000:.2f} km, {len(points)} points, largest gap {gap:.0f} m,"
              f" elevation {min(elevs):.1f}-{max(elevs):.1f} m{flag}")

    for key, meta in OSRM_COURSES.items():
        print(f"{key}: routing {len(meta['waypoints'])} waypoints with OSRM...")
        result = fetch_osrm(key, meta["waypoints"], args.cache_dir)
        if result is None:
            print(f"  {key}: OSRM failed twice, dropping course")
            continue
        chain, osrm_m = result
        points, total_m = resample(chain)
        elevs = fetch_elevations(key, points, args.cache_dir)
        courses[key] = make_entry(meta, "OSRM through waypoints", points, elevs, total_m)
        flag = " -- OUTSIDE 40-48km" if not 40 <= total_m / 1000 <= 48 else ""
        print(f"  {key}: {total_m/1000:.2f} km resampled (OSRM reported {osrm_m/1000:.2f} km),"
              f" {len(points)} points, elevation {min(elevs):.1f}-{max(elevs):.1f} m{flag}")

    about = ("Geometry and terrain for six marathon courses, resampled every ~50 m, for cutting "
             "synthetic training-run segments out of somewhere recognisable. Boston comes from an "
             "OpenStreetMap route relation mapped from the certified course; Chicago, New York City, "
             "Berlin, London and Tokyo are approximated by routing street-by-street through "
             "hand-placed waypoints with OSRM -- close to the real course, "
             "not the certified line. Elevation is bare-earth terrain (Mapzen merge), not a runner's "
             "barometer. Nothing here is anyone's recorded run.")
    osm_source = ("route shapes: (c) OpenStreetMap contributors, ODbL 1.0 -- relation 11680552 for "
                  "Boston; the other five routed along OpenStreetMap streets through hand-placed "
                  "waypoints with OSRM")
    out = {
        "about": about,
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "sources": {"osm": osm_source, "elevation": "Mapzen terrain merge via api.opentopodata.org: USGS NED (US, public domain), EU-DEM (Europe, Copernicus), SRTM elsewhere"},
        "courses": courses,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=0)
    print(f"\nwrote {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB), {len(courses)}/6 courses")


if __name__ == "__main__":
    main()
