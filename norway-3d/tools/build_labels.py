#!/usr/bin/env python3
"""Build data/labels.geojson from OpenStreetMap: the names the app floats over the terrain.

Three Overpass queries inside Norway's border, each cached in tools/.cache/ so a rebuild touches the
network only when the cache is gone:

  peaks    natural=peak with a name (ele kept when it is a number)
  places   place=city, town and village with a name (population kept when a number); hamlets were
           measured at 18 716 more names and left out
  areas    natural=glacier, and natural=water with water=lake or reservoir, with a name, at the
           center of their bounding box, with that box's area in km² (a rough size to rank by);
           boxes under 0.3 km² are left out

Short keys: n name, k kind (peak, city, town, village, hamlet, glacier, lake), e ele (m), p population,
a box area (km²), id the OSM element. Coordinates to five decimals (1 m). Standard library only.
Data (c) OpenStreetMap contributors, ODbL 1.0.

  python3 tools/build_labels.py            # uses the caches when present
  python3 tools/build_labels.py --fresh    # asks Overpass again
"""
import json, math, os, sys, urllib.parse, urllib.request, gzip

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.cache')
OUT = os.path.join(APP, 'data', 'labels.geojson')
ENDPOINT = 'https://overpass-api.de/api/interpreter'
AREA = 'area["ISO3166-1"="NO"][admin_level=2]->.no;'
QUERIES = {
    'peaks': f'[out:json][timeout:300];{AREA}node["natural"="peak"]["name"](area.no);out body;',
    'places': f'[out:json][timeout:300];{AREA}node["place"~"^(city|town|village)$"]["name"](area.no);out body;',
    'areas': f'[out:json][timeout:300];{AREA}(nwr["natural"="glacier"]["name"](area.no);nwr["natural"="water"]["water"~"^(lake|reservoir)$"]["name"](area.no););out tags bb;',
}


def post(query):
    # through curl: the system Python's TLS cannot reach the Overpass server
    import subprocess
    import time
    for attempt in range(5):
        r = subprocess.run(['curl', '-sS', '-m', '400', '-A', 'Snuggery template build (norway-3d/tools/build_labels.py)',
                            '--data-urlencode', 'data=' + query, ENDPOINT], capture_output=True, check=True)
        if r.stdout.lstrip().startswith(b'{'):
            return r.stdout
        time.sleep(30 * (attempt + 1))     # Overpass asks for patience between heavy queries
    raise SystemExit('Overpass did not answer with JSON after five tries')


def fetch(name):
    path = os.path.join(CACHE, f'labels-{name}.json')
    if '--fresh' not in sys.argv and os.path.exists(path):
        return json.load(open(path, encoding='utf-8'))
    body = post(QUERIES[name])
    d = json.loads(body)
    if 'remark' in d and not d.get('elements'):
        raise SystemExit(f'Overpass refused {name}: {d["remark"]}')
    os.makedirs(CACHE, exist_ok=True)
    with open(path, 'wb') as f:
        f.write(body)
    return d


def num(s):
    try:
        v = float(str(s).replace(',', '.').strip().split()[0])
        return v if v == v else None
    except (ValueError, IndexError):
        return None


def main():
    feats, bases = [], []
    for name in QUERIES:
        d = fetch(name)
        bases.append(d.get('osm3s', {}).get('timestamp_osm_base', ''))
        for e in d['elements']:
            t = e.get('tags', {})
            n = (t.get('name') or '').strip()
            if not n:
                continue
            if 'lat' in e:
                lat, lon = e['lat'], e['lon']
            elif 'center' in e:
                lat, lon = e['center']['lat'], e['center']['lon']
            elif 'bounds' in e:
                b = e['bounds']
                lat, lon = (b['minlat'] + b['maxlat']) / 2, (b['minlon'] + b['maxlon']) / 2
            else:
                continue
            if lat > 71.5:          # the mainland and its islands; Svalbard and Jan Mayen are outside the map
                continue
            p = {'n': n, 'id': f"{e['type']}/{e['id']}"}
            if name == 'peaks':
                p['k'] = 'peak'
                ele = num(t.get('ele'))
                if ele is not None and 0 < ele < 2500:
                    p['e'] = round(ele)
            elif name == 'places':
                p['k'] = t['place']
                pop = num(t.get('population'))
                if pop:
                    p['p'] = int(pop)
            else:
                p['k'] = 'glacier' if t.get('natural') == 'glacier' else 'lake'
                b = e.get('bounds')
                if b:
                    h = (b['maxlat'] - b['minlat']) * 111.2
                    w = (b['maxlon'] - b['minlon']) * 111.2 * math.cos(math.radians(lat))
                    p['a'] = round(w * h, 3)
                if p.get('a', 0) < 0.3:     # ponds and glacierets would be a cloud of names
                    continue
            feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(lon, 5), round(lat, 5)]}, 'properties': p})
    feats.sort(key=lambda f: f['properties']['id'])
    out = {'type': 'FeatureCollection', 'source': 'OpenStreetMap contributors, ODbL 1.0, through the Overpass API',
           'osmBase': max(bases), 'count': len(feats), 'features': feats}
    body = json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n'
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(body)
    kinds = {}
    for f_ in feats:
        kinds[f_['properties']['k']] = kinds.get(f_['properties']['k'], 0) + 1
    print(f"{len(feats)} labels, {len(body.encode())} bytes, {len(gzip.compress(body.encode()))} gzipped; {kinds}; OSM base {max(bases)}")


if __name__ == '__main__':
    main()
