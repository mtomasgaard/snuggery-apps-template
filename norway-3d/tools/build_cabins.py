#!/usr/bin/env python3
"""Build data/cabins.geojson from OpenStreetMap: Norway's mountain cabins and huts.

One Overpass query (tourism=wilderness_hut or alpine_hut inside Norway's border), cached in
tools/.cache/huts-overpass.json so a rebuild touches the network only when the cache is gone. The
GeoJSON keeps only what the app shows, under short keys, coordinates to six decimals (11 cm):

  n    name (OSM name)                     k    kind, from dnt:classification or the tourism tag:
  op   operator                                 staffed, self, none, closed, emergency, alpine, wild
  dnt  1 when network=DNT or the operator  cap  beds (capacity), when a whole number
       is a DNT member association          ele  OSM's ele in meters, when a number
  url  the ut.no page (https://ut.no/...), only that host
  id   the OSM element, "node/123"

Standard library only. Data (c) OpenStreetMap contributors, ODbL 1.0; the app credits it beside the
map while the cabins are shown and in About, and NOTES.md says how to get the extract.

  python3 tools/build_cabins.py            # uses the cache when present
  python3 tools/build_cabins.py --fresh    # asks Overpass again
"""
import json, os, re, sys, urllib.parse, urllib.request, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.cache', 'huts-overpass.json')
OUT = os.path.join(APP, 'data', 'cabins.geojson')
QUERY = ('[out:json][timeout:120];area["ISO3166-1"="NO"][admin_level=2]->.no;'
         '(nwr["tourism"~"^(wilderness_hut|alpine_hut)$"](area.no););out center tags;')
ENDPOINT = 'https://overpass-api.de/api/interpreter'

KIND = {'betjent': 'staffed', 'selvbetjent': 'self', 'ubetjent': 'none', 'stengt': 'closed', 'nødbu': 'emergency'}


def post(query):
    # through curl: the system Python's TLS cannot reach the Overpass server
    import subprocess
    r = subprocess.run(['curl', '-sS', '-m', '400', '-A', 'Snuggery template build (norway-3d/tools/build_cabins.py)',
                        '--data-urlencode', 'data=' + query, ENDPOINT], capture_output=True, check=True)
    return r.stdout


def fetch():
    body = post(QUERY)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, 'wb') as f:
        f.write(body)


def num(s):
    try:
        v = float(str(s).replace(',', '.').strip().split()[0])
        return v if v == v else None
    except (ValueError, IndexError):
        return None


def main():
    if '--fresh' in sys.argv or not os.path.exists(CACHE):
        fetch()
    d = json.load(open(CACHE, encoding='utf-8'))
    feats = []
    for e in d['elements']:
        t = e.get('tags', {})
        if 'lat' in e:
            lat, lon = e['lat'], e['lon']
        elif 'center' in e:
            lat, lon = e['center']['lat'], e['center']['lon']
        else:
            continue
        name = (t.get('name') or '').strip()
        cls = t.get('dnt:classification')
        kind = KIND.get(cls) or ('alpine' if t.get('tourism') == 'alpine_hut' else 'wild')
        op = (t.get('operator') or '').strip()
        net = (t.get('network') or '').strip()
        dnt = 1 if (net.upper() == 'DNT' or re.search(r'\bDNT\b|Turistforening|Turlag', op)) else 0
        p = {'k': kind}
        if name: p['n'] = name
        if op: p['op'] = op
        if dnt: p['dnt'] = 1
        cap = num(t.get('capacity'))
        if cap is not None and cap == int(cap) and 0 < cap < 1000: p['cap'] = int(cap)
        ele = num(t.get('ele'))
        if ele is not None and -50 < ele < 2500: p['ele'] = round(ele)
        url = (t.get('website') or '').strip()
        u = urllib.parse.urlparse(url)
        if u.scheme in ('http', 'https') and u.hostname in ('ut.no', 'www.ut.no'):
            p['url'] = 'https://ut.no' + u.path + (('?' + u.query) if u.query else '')
        p['id'] = f"{e['type']}/{e['id']}"
        feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(lon, 6), round(lat, 6)]}, 'properties': p})
    feats.sort(key=lambda f: f['properties']['id'])
    stamp = d.get('osm3s', {}).get('timestamp_osm_base', '')
    out = {'type': 'FeatureCollection',
           'source': 'OpenStreetMap contributors, ODbL 1.0, through the Overpass API',
           'osmBase': stamp, 'count': len(feats), 'features': feats}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    kinds = {}
    for f_ in feats:
        kinds[f_['properties']['k']] = kinds.get(f_['properties']['k'], 0) + 1
    print(f"{len(feats)} cabins, OSM base {stamp}, {os.path.getsize(OUT)} bytes; kinds {kinds}")


if __name__ == '__main__':
    main()
