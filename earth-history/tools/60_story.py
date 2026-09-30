"""Step 60 — the words: tools/content/story.yaml → data/story.json (tools/CONTRACT.md §10).

The period cards, events, "look for" pins and their sources are written by hand in story.yaml. This
step validates them and converts them; it never writes a partial file:

  * story_check.check_story(): word and character limits, every source resolves and is used, every
    numeral in a text is mapped to a source the item cites, ICS-credited numerals equal a chart value,
    atlas-credited numerals are a map number or map age (or a listed measurement), every event age
    lies inside the ICS Period it is filed under, boundary and chart ages equal the chart's, no URL, no
    AI vendor, no wiki source;
  * each pin's present-day point is partitioned with Scotese's polygons valid at 0 Ma, exactly as
    places.json is (CONTRACT §5): the claimed plate must match, the crust must be carried back over
    the whole window, and the point must be on Natural Earth 1:50m land;
  * the map claims the cards make ("the 690 Ma map paints no ice", "almost all land lies south of
    the equator") are re-measured on the shipped maps and the pinned rotation file, and printed.

Output order: sources by id; periods in timescale.json card_periods order; events oldest first (then
id); pins by window start, oldest first (then id). `evidence` and `placement` stay in the YAML (they
are for reviewers); everything else ships.
"""
import json
import os
import sys

import numpy as np
import pygplates as g
import yaml
from PIL import Image

from common import RETRIEVED, json_text, write_json
from geo import POLY_NAME, ROT_NAME, even_odd, geojson_rings, load_geojson, plate_model_files
from paths import DATA, TOOLS
from story_check import as_list, check_story, unit_contains

YAML_PATH = os.path.join(TOOLS, 'content', 'story.yaml')
CAP = 60_000
NDIGITS = 4
YAML_ONLY = {'sources': ('evidence',), 'look_for': ('placement',)}

# Boxes for the Last Glacial Maximum claim, (lon0, lon1, lat0, lat1), present-day and unrotated:
# map 2 is 21 ka, when the plates sit where they are today to well under a pixel.
CANADA = (-120, -65, 50, 70)
N_EUROPE = (0, 30, 55, 68)


def load_yaml():
    with open(YAML_PATH, encoding='utf-8') as f:
        return yaml.safe_load(f)


def load_data(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


# --- plates ------------------------------------------------------------------------------------------
def partitioner():
    files = plate_model_files()
    rm = g.RotationModel(files[ROT_NAME][0])
    fc = g.FeatureCollection(files[POLY_NAME][0])
    polys0 = [f for f in fc if f.is_valid_at_time(0)]
    return rm, g.PlatePartitioner(polys0, rm)


def partition(pp, lon, lat):
    """(plate id, polygon begin) exactly as 20_plates.py does for places; None when unclaimed."""
    rg = pp.partition_point(g.PointOnSphere(float(lat), float(lon)))
    if rg is None:
        return None
    f = rg.get_feature()
    return f.get_reconstruction_plate_id(), f.get_valid_time()[0]


def fin(x):
    return None if np.isinf(x) else float(x)


def paleolat(rm, lon, lat, pid, t):
    """Latitude at time t of a present-day point on plate pid: R(t) · R(0)⁻¹ (CONTRACT §3)."""
    r = rm.get_rotation(float(t), pid, anchor_plate_id=0) * rm.get_rotation(0.0, pid, anchor_plate_id=0).get_inverse()
    return (r * g.PointOnSphere(float(lat), float(lon))).to_lat_lon()[0]


# --- the maps ----------------------------------------------------------------------------------------
_maps = {}


def map_rgb(slice_):
    f = slice_['file']
    if f not in _maps:
        _maps[f] = np.asarray(Image.open(os.path.join(DATA, f)).convert('RGB')).astype(np.int16)
    return _maps[f]


def lat_centres(h):
    return 90 - (np.arange(h) + 0.5) * 180 / h


def shares(slice_):
    """Cos-latitude weighted shares on one shipped map: land (not "blue > max(red, green)", the
    classifier verify_surface.py uses), land within 30° of the equator, land south of it, and white
    paint (every channel above 200) in each hemisphere."""
    a = map_rgb(slice_)
    h, w, _ = a.shape
    lat = lat_centres(h)
    wt = np.cos(np.radians(lat))[:, None] * np.ones((1, w))
    land = ~(a[:, :, 2] > np.maximum(a[:, :, 0], a[:, :, 1]))
    white = a.min(axis=2) > 200
    lw = wt * land
    n, s = lat > 0, lat < 0
    return {
        'land_tropics': lw[np.abs(lat) <= 30].sum() / lw.sum(),
        'land_south': lw[s].sum() / lw.sum(),
        'white_n': (wt * white)[n].sum() / wt[n].sum(),
        'white_s': (wt * white)[s].sum() / wt[s].sum(),
    }


def white_in_box(slice_, box):
    a = map_rgb(slice_)
    h, w, _ = a.shape
    lon0, lon1, lat0, lat1 = box
    i0, i1 = int((lon0 + 180) / 360 * w), int((lon1 + 180) / 360 * w)
    j0, j1 = int((90 - lat1) / 180 * h), int((90 - lat0) / 180 * h)
    return float((a[j0:j1, i0:i1].min(axis=2) > 200).mean())


def map_claims(slices, timescale, rm, places):
    """Re-measure every map statement a card makes. Returns [(id, card, statement, measured, ok)]."""
    by_map = {s['map']: s for s in slices}
    periods = [u for u in timescale['units'] if u['rank'] == 'Period']

    def period_of(s):
        return next(u['id'] for u in periods if unit_contains(u, s['age_ma']))

    def in_period(pid):
        return [s for s in slices if period_of(s) == pid]

    city = {p['n']: p for p in places['places']}

    def plat(name, mapno):
        p, s = city[name], by_map[mapno]
        return paleolat(rm, p['lon'], p['lat'], p['plate'], s['rotation_ma'])

    out = []

    def claim(cid, card, text, value, ok):
        out.append((cid, card, text, value, bool(ok)))

    sh = {m: shares(by_map[m]) for m in by_map}
    v = sh[93]['land_tropics']
    claim('tonian-land-tropics', 'Tonian', 'map 93: most land within 30° of the equator', f'{v:.3f}', v > 0.5)
    v = sh[92]['white_n'] + sh[92]['white_s']
    claim('cryogenian-no-ice', 'Cryogenian', 'map 92 (690 Ma) paints no ice', f'{v:.4f}', v == 0)
    n, s = sh[90]['white_n'], sh[90]['white_s']
    claim('ediacaran-ice', 'Ediacaran', 'map 90 (600 Ma): ice at high latitudes, most in the south',
          f'N {n:.3f} S {s:.3f}', s > n > 0)
    cam = in_period('Cambrian')
    vals = [sh[x['map']]['land_south'] for x in cam]
    claim('cambrian-land-south', 'Cambrian', f'maps {[x["map"] for x in cam]}: almost all land south of the equator',
          ' '.join(f'{x:.3f}' for x in vals), min(vals) >= 0.85)
    ordo = sorted(in_period('Ordovician'), key=lambda x: x['age_ma'])[:2]
    vals = [sh[x['map']]['white_s'] for x in ordo]
    claim('ordovician-ice', 'Ordovician', f'the last two Ordovician maps {[x["map"] for x in ordo]} carry ice',
          ' '.join(f'{x:.3f}' for x in vals), min(vals) > 0.05)
    a, b = sh[62]['white_s'], sh[63]['white_s']
    claim('carboniferous-ice', 'Carboniferous', 'southern ice from map 62 (332.5 Ma), none on map 63 (341.1 Ma)',
          f'{a:.3f} / {b:.3f}', a > 0.01 and b < 0.005)
    young_perm = [x for x in in_period('Permian') if x['age_ma'] <= 280]
    vals = [sh[x['map']]['white_s'] for x in young_perm]
    claim('permian-ice-shrunk', 'Permian', f'the great southern sheet (map 55, 289.5 Ma) shrunk to a small patch by '
          f'280 Ma (maps {[x["map"] for x in young_perm]})', ' '.join(f'{x:.4f}' for x in vals) + f' / {sh[55]["white_s"]:.3f}',
          max(vals) < 0.01 and sh[55]['white_s'] > 0.05)
    # The Paleogene card and the East Antarctica pin: Scotese paints ice from map 12 (44.6 Ma), growing
    # through maps 11 and 10, before the ~34 Ma onset the rocks give; map 13 (52.2 Ma) is bare.
    seq = [sh[m]['white_s'] for m in (13, 12, 11, 10, 9)]
    claim('paleogene-antarctic-ice', 'Paleogene', 'southern ice: none on map 13 (52.2 Ma), then growing on maps '
          '12, 11, 10 and 9 (44.6, 38.8, 35.6, 31.1 Ma)', ' '.join(f'{x:.4f}' for x in seq),
          seq[0] < 0.001 and seq[1] > 0.005 and all(seq[j] < seq[j + 1] for j in range(1, 4)))
    neo = in_period('Neogene')
    vals = [sh[x['map']]['white_s'] for x in neo]
    claim('neogene-antarctica', 'Neogene', f'southern ice on every Neogene map {[x["map"] for x in neo]}',
          ' '.join(f'{x:.3f}' for x in vals), min(vals) > 0.02)
    c2, e2 = white_in_box(by_map[2], CANADA), white_in_box(by_map[2], N_EUROPE)
    c1, e1 = white_in_box(by_map[1], CANADA), white_in_box(by_map[1], N_EUROPE)
    claim('quaternary-lgm-ice', 'Quaternary', 'map 2: ice over Canada and northern Europe; map 1: none there',
          f'map 2 {c2:.2f} / {e2:.2f}; map 1 {c1:.2f} / {e1:.2f}', c2 > 0.5 and e2 > 0.1 and c1 < 0.01 and e1 < 0.01)
    # paleolatitudes, from the pinned rotation file (the cities' plates come from places.json)
    k, br = plat('Kinshasa', 68), plat('Brasília', 68)
    claim('devonian-gondwana-pole', 'Devonian', 'map 68 (388.2 Ma): Gondwana (Kinshasa, Brasília) over the South Pole',
          f'{k:.1f} / {br:.1f}', k < -70 and br < -70)
    k, br, ch, mo = plat('Kinshasa', 74), plat('Brasília', 74), plat('Chicago', 74), plat('Moscow', 74)
    claim('silurian-latitudes', 'Silurian', 'map 74 (425.6 Ma): Africa and South America at high southern '
          'latitudes; North America and northern Europe south of the equator',
          f'{k:.1f} {br:.1f} / {ch:.1f} {mo:.1f}', k < -45 and br < -45 and ch < 0 and mo < 0)
    s49 = by_map[49]
    lat = lat_centres(map_rgb(s49).shape[0])
    a = map_rgb(s49)
    land_rows = lat[(~(a[:, :, 2] > np.maximum(a[:, :, 0], a[:, :, 1]))).any(axis=1)]
    claim('triassic-pole', 'Triassic', 'map 49 (251 Ma): land reaches the South Pole',
          f'southernmost land row {land_rows.min():.1f}°', land_rows.min() < -89)
    return out


# Map statements checked by eye on the shipped maps, not by script (printed for the reviewers).
BY_EYE = [
    ('Permian', 'map 49 (251 Ma): Pangaea curves around a great bay of ocean to the east'),
    ('Jurassic', 'map 33 (148.2 Ma): a narrow sea opens between North America and Africa'),
    ('Cretaceous', 'maps 26 to 17: South America and Africa pull apart; the South Atlantic opens'),
    ('Cretaceous', 'map 19 (80.3 Ma): a shallow sea splits North America in two'),
    ('Cretaceous', 'maps 19 to 16: India is an island'),
    ('Devonian', 'map 68 (388.2 Ma): North America and northern Europe side by side'),
]


def main():
    y = load_yaml()
    timescale = load_data('timescale.json')
    plates = load_data('plates.json')
    manifest = load_data('manifest.json')
    places = load_data('places.json')
    slices = manifest['slices']
    pindex = {pid: i for i, pid in enumerate(plates['plates'])}

    errs, rep = check_story(y, timescale, plates['plates'], slices)

    # --- pins: partition, claimed plate, carried back over the window, on today's land ---------------
    rm, pp = partitioner()
    land_rings = geojson_rings(load_geojson('ne_land'))
    pins = []
    for x in y['look_for']:
        part = partition(pp, x['lon'], x['lat'])
        if part is None:
            errs.append(f"look_for {x['id']}: no polygon valid at 0 Ma claims ({x['lon']}, {x['lat']})")
            continue
        pid, begin = part
        if x.get('plate') is not None and x['plate'] != pid:
            errs.append(f"look_for {x['id']}: claims plate {x['plate']}, the partition gives {pid}")
        if begin < float(x['window_ma'][0]):
            errs.append(f"look_for {x['id']}: its crust is carried back only to {begin} Ma, "
                        f"not over the window {x['window_ma']}")
        on_land = bool(even_odd(land_rings, np.array([float(x['lon'])]), np.array([float(x['lat'])]))[0, 0])
        if not on_land:
            errs.append(f"look_for {x['id']}: ({x['lon']}, {x['lat']}) is not on Natural Earth 1:50m land")
        pins.append((x, pid, begin))

    claims = map_claims(slices, timescale, rm, places)
    for cid, card, text, value, ok in claims:
        if not ok:
            errs.append(f'map claim {cid} ({card}) fails: {text}: measured {value}')

    if errs:
        print('story.yaml fails:')
        for e in errs:
            print('  -', e)
        sys.exit(1)

    # --- story.json ---------------------------------------------------------------------------------
    units = {u['id']: u for u in timescale['units']}
    periods = [u for u in timescale['units'] if u['rank'] == 'Period']

    def nums(item):
        return {k: sorted(as_list(v)) for k, v in (item.get('numbers') or {}).items()}

    def clean(item, drop=()):
        out = {k: v for k, v in item.items() if k not in drop}
        out['numbers'] = nums(item)
        return out

    sources = sorted((clean(s, YAML_ONLY['sources']) for s in y['sources']), key=lambda s: s['id'])
    for s in sources:
        s.pop('numbers')
    cards = []
    for c in y['periods']:
        u = units[c['ics']]
        cards.append(dict(clean(c), name=u['name'], begin_ma=u['begin_ma'], begin_unc_ma=u['begin_unc_ma'],
                          end_ma=u['end_ma'], end_unc_ma=u['end_unc_ma'], colour=u['colour']))
    events = []
    for e in y['events']:
        ev = clean(e)
        ev['period'] = next(u['id'] for u in periods if unit_contains(u, float(e['age_ma'])))
        events.append(ev)
    events.sort(key=lambda e: (-float(e['age_ma']), e['id']))
    look = []
    for x, pid, begin in pins:
        lf = clean(x, YAML_ONLY['look_for'])
        lf.update(plate=pid, pi=pindex[pid], from_ma=fin(begin))
        look.append(lf)
    look.sort(key=lambda x: (-float(x['window_ma'][0]), x['id']))
    story = {
        'schema': 1, 'retrieved': RETRIEVED,
        'note': ('Written for this app. Every number in a text is mapped in `numbers` to the source it '
                 'comes from; ages named as ICS ages are from timescale.json, map ages from Scotese\'s '
                 'Table 1. Pins are present-day positions, rotated with the PALEOMAP plate given.'),
        'sources': sources, 'prologue': clean(y['prologue']), 'periods': cards,
        'events': events, 'look_for': look,
    }
    # the output must pass the same checks (it is the YAML plus derived fields)
    errs2, _ = check_story(story, timescale, plates['plates'], slices)
    if errs2:
        sys.exit('story.json would fail its own checks: ' + '; '.join(errs2))
    txt = json_text(story, NDIGITS)
    n = len(txt.encode('utf-8'))
    if n > CAP:
        sys.exit(f'story.json would be {n:,} bytes, over the {CAP:,} budget — nothing written')
    write_json('story.json', story, ndigits=NDIGITS)

    # --- report -------------------------------------------------------------------------------------
    print(f'story.json: {n:,} bytes (budget {CAP:,})')
    print(f"sources {len(sources)} ({sum(s['access'] == 'open' for s in sources)} open access) · "
          f"cards {len(cards)} + prologue · events {len(events)} · pins {len(look)}")
    cw = [r[1] for r in rep['cards']]
    print(f'card words: max {max(cw)}, mean {sum(cw) / len(cw):.1f} (limit 90)')
    for name, nw, nn in rep['cards']:
        print(f'  {name:14s} {nw:3d} words, {nn:2d} numbers')
    ew = [r[2] for r in rep['events']]
    print(f'event words: max {max(ew)} (limit 45); titles max {max(r[3] for r in rep["events"])} characters (limit 60)')
    for e in events:
        print(f"  {float(e['age_ma']):>9.4f} Ma  {e['period']:13s} {e['id']:22s} {len(e['text'].split()):2d} words"
              + (f"  boundary {e['boundary']}" if e.get('boundary') else ''))
    lw = [r[1] for r in rep['look_for']]
    print(f'pin words: max {max(lw)} (limit 25); labels max {max(r[2] for r in rep["look_for"])} characters (limit 24)')
    for x in look:
        print(f"  {x['id']:16s} plate {x['plate']:4d} (index {x['pi']:3d}) from {x['from_ma']} Ma, "
              f"window {x['window_ma']}")
    print('map claims, re-measured on the shipped maps and the rotation file:')
    for cid, card, text, value, ok in claims:
        print(f"  {'ok  ' if ok else 'FAIL'} {cid:26s} {text} — {value}")
    print('map statements checked by eye, not by script:')
    for card, text in BY_EYE:
        print(f'  {card}: {text}')


if __name__ == '__main__':
    main()
