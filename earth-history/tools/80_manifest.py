"""Step 80 — the full manifest: data/manifest.json (tools/CONTRACT.md §1).

Step 10 writes a first manifest.json with the fields it owns (schema, count, retrieved, surface,
proxy, axis, and per slice i, map, file, age_ma, file_age_ma, rotation_ma, label, interval, stage).
This step rewrites the file with the rest, assembled from:

    tools/slices.csv            Table 1 (checked against every per-slice field below)
    tools/work/surface.json     step 10: per-slice fields (the manifest's own top-level blocks are
                                taken from data/manifest.json, step 10's output, keys it owns only)
    tools/work/ics_slices.json  step 50: `ics` (eon ... age, colour) and `ics_note`
    tools/work/climate.json     step 30: the climate slice per map
    tools/work/elevation.json   step 35: the elevation slice per map
    tools/work/tiles.json       step 40: the four tiles, full precision
    data/climate.json, data/elevation.json   the `units` block and the land tile

The tiles are rounded here to the precision the app shows (ROUND below), which is what keeps the
file under its 60,000-byte budget; every other number keeps write_json's 4 decimals. Re-running this
step reads only step 10's fields from data/manifest.json, so it gives the same file however many
times it runs.

    .venv/bin/python 80_manifest.py
"""
import csv
import json
import os

from common import RETRIEVED, json_text, write_json
from geo import read_slices
from paths import DATA, WORK

CAP = 60_000
STEP10_TOP = ('schema', 'count', 'retrieved', 'surface', 'proxy', 'axis')
STEP10_SLICE = ('i', 'map', 'file', 'age_ma', 'file_age_ma', 'rotation_ma', 'label', 'interval', 'stage')
ICS_KEYS = ('eon', 'era', 'period', 'subperiod', 'epoch', 'age', 'colour')
NOTE_KEYS = ('kind', 'unit', 'text', 'scotese_ma', 'ics_ma', 'ics_unc_ma')

# Decimals per tile value (CONTRACT §18): finer than the sheet prints (0.1 F, 1 ppm, 1 ft, 0.1 %),
# never finer than the source file. `units` (today) is rounded the same way, so a tile and the value
# it is compared with always have the same precision.
ROUND = {
    'temperature': {'c': 2},
    'co2': {'ppm': 1, 'lo68': 1, 'hi68': 1},
    'sea_level': {'m': 1, 'min_m': 1, 'max_m': 1},
    'land': {'land_pct': 2, 'shelf_pct': 2},
}
# Every tile field that repeats something the slice or `units` already says is written once, here
# (CONTRACT §18): the budget holds only without the 87-90 copies of each.
TILE_RULES = {
    'temperature': {'source': 'phanda', 'at': 'climate_age_ma', 'today': 'today_temperature_c'},
    'co2': {'source': {'proxy_fit': 'foster2017', 'model_input': 'phanda'},
            'at': {'proxy_fit': 'age_ma', 'model_input': 'climate_age_ma'},
            'today': {'proxy_fit': 'today_co2_fit_ppm', 'model_input': 'today_co2_model_ppm'},
            'rule': ("proxy_fit when age_ma <= Foster's last row (curves.json co2_ppm.last_ma), else "
                     'model_input when the map has a climate slice')},
    'sea_level': {'source': 'vandermeer2022', 'at': 'age_ma', 'today': 0,
                  'band': 'between the lower and the higher of min_m and max_m'},
    'land': {'source': 'paleodem', 'at': 'elevation_age_ma', 'today': ['today_land_pct', 'today_shelf_pct']},
    'null': 'no value this far back',
}
DROP = {'temperature': ('slice_age_ma', 'source'), 'co2': ('at_ma', 'source', 'today_ppm'),
        'sea_level': ('at_ma', 'source'), 'land': ('dem_age_ma', 'source')}


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def rounded(kind, tile):
    if tile is None:
        return None
    out = {}
    for k, v in tile.items():
        if k in DROP[kind]:
            continue
        if isinstance(v, float):
            assert k in ROUND[kind], f'tile {kind}.{k}: no rounding rule'
            v = round(v, ROUND[kind][k])
        out[k] = v
    return out


def main():
    rows = read_slices()
    assert len(rows) == 90
    old = load(os.path.join(DATA, 'manifest.json'))
    surface = load(os.path.join(WORK, 'surface.json'))['slices']
    ics = load(os.path.join(WORK, 'ics_slices.json'))['maps']
    cmatch = load(os.path.join(WORK, 'climate.json'))['maps']
    ematch = load(os.path.join(WORK, 'elevation.json'))['maps']
    tiles = load(os.path.join(WORK, 'tiles.json'))['maps']
    climate = load(os.path.join(DATA, 'climate.json'))
    elevation = load(os.path.join(DATA, 'elevation.json'))
    # Foster's last row is 419.5039 Ma; curves.json keeps 3 decimals (419.504). No map age lies between.
    switch_ma = load(os.path.join(DATA, 'curves.json'))['series']['co2_ppm']['last_ma']
    today_fit = tiles[0]['tiles']['co2']['today_ppm']       # Foster's first row (0.0039 Ma)
    today_model = climate['slices'][0]['co2_ppm']
    for name, xs in (('surface', surface), ('ics_slices', ics), ('climate', cmatch),
                     ('elevation', ematch), ('tiles', tiles), ('manifest', old['slices'])):
        assert [x['i'] for x in xs] == list(range(90)), f'{name}: not the 90 slices in order'
        assert [x['map'] for x in xs] == [r['map'] for r in rows], f'{name}: map numbers differ'

    # slices.csv (Table 1) is where the step-10 fields come from; prove nothing drifted.
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'slices.csv'),
              encoding='utf-8', newline='') as f:
        assert sum(1 for _ in csv.DictReader(f)) == 90
    slices = []
    for i, r in enumerate(rows):
        s10 = {k: surface[i][k] for k in STEP10_SLICE}
        assert {k: old['slices'][i].get(k) for k in STEP10_SLICE} == s10, f'slice {i}: manifest != surface.json'
        assert s10['age_ma'] == r['age_ma'] and s10['file_age_ma'] == r['file_age_ma']
        assert s10['label'] == r['table1_row'] and s10['interval'] == r['interval']
        assert s10['stage'] == (r['stage'] or None)
        assert ics[i]['age_ma'] == r['age_ma']

        c, e, t = cmatch[i], ematch[i], tiles[i]
        assert c['file_age_ma'] == e['file_age_ma'] == r['file_age_ma'] and t['age_ma'] == r['age_ma']
        # One match rule, one set of plate ages (0, 5, ... 540 for both): the two must agree.
        assert (c['climate'], c['climate_age_ma']) == (e['elevation'], e['elevation_age_ma']), (c, e)

        tt = t['tiles']
        assert set(tt) == {'temperature', 'co2', 'sea_level', 'land'}
        land = tt['land']
        if e['elevation'] is None:
            assert land is None and tt['temperature'] is None
        else:
            ev = elevation['slices'][e['elevation']]
            assert ev['plate_age_ma'] == e['elevation_age_ma'] == land['dem_age_ma']
            # CONTRACT §1: the land tile is elevation.json's; step 40 computed it with the same
            # function, so the two agree to elevation.json's 4 decimals.
            assert abs(land['land_pct'] - ev['land_pct']) <= 5e-5 + 1e-9, (i, land, ev)
            assert abs(land['shelf_pct'] - ev['shelf_pct']) <= 5e-5 + 1e-9, (i, land, ev)
            land = dict(land, land_pct=ev['land_pct'], shelf_pct=ev['shelf_pct'])
            cv = climate['slices'][c['climate']]
            assert tt['temperature']['c'] == cv['global_mean_c']
            assert tt['temperature']['slice_age_ma'] == cv['plate_age_ma'] == c['climate_age_ma']

        # Every dropped field must say exactly what TILE_RULES and `units` say instead.
        if tt['temperature'] is not None:
            assert tt['temperature']['source'] == TILE_RULES['temperature']['source']
        if tt['land'] is not None:
            assert tt['land']['source'] == TILE_RULES['land']['source']
            assert tt['land']['dem_age_ma'] == e['elevation_age_ma']
        co = tt['co2']
        if co is not None:
            k = co['kind']
            assert k == ('proxy_fit' if r['age_ma'] <= switch_ma else 'model_input'), (i, k)
            assert co['source'] == TILE_RULES['co2']['source'][k]
            assert co['at_ma'] == (r['age_ma'] if k == 'proxy_fit' else c['climate_age_ma'])
            assert co['today_ppm'] == (today_fit if k == 'proxy_fit' else today_model)
            assert (co['lo68'] is None) == (co['hi68'] is None) == (k == 'model_input')
        else:
            assert r['age_ma'] > switch_ma and c['climate'] is None
        sl = tt['sea_level']
        if sl is not None:
            assert sl['source'] == TILE_RULES['sea_level']['source'] and sl['at_ma'] == r['age_ma']

        note = ics[i]['ics_note']
        slices.append(dict(
            s10,
            ics={k: ics[i]['ics'][k] for k in ICS_KEYS},
            ics_note=None if note is None else {k: note[k] for k in NOTE_KEYS},
            climate=c['climate'], climate_age_ma=c['climate_age_ma'],
            elevation=e['elevation'], elevation_age_ma=e['elevation_age_ma'],
            tiles={'temperature': rounded('temperature', tt['temperature']),
                   'co2': rounded('co2', tt['co2']),
                   'sea_level': rounded('sea_level', tt['sea_level']),
                   'land': rounded('land', land)},
        ))

    assert old['retrieved'] == RETRIEVED and old['count'] == 90
    manifest = {k: old[k] for k in STEP10_TOP}
    manifest['units'] = {'today_temperature_c': round(climate['slices'][0]['global_mean_c'], ROUND['temperature']['c']),
                         'today_land_pct': round(elevation['slices'][0]['land_pct'], ROUND['land']['land_pct']),
                         'today_shelf_pct': round(elevation['slices'][0]['shelf_pct'], ROUND['land']['shelf_pct']),
                         'today_co2_fit_ppm': round(today_fit, ROUND['co2']['ppm']),
                         'today_co2_model_ppm': today_model}
    assert not any(419.5039 < r['age_ma'] <= switch_ma for r in rows)
    manifest['tile_rules'] = TILE_RULES
    assert climate['slices'][0]['plate_age_ma'] == elevation['slices'][0]['plate_age_ma'] == 0
    manifest['slices'] = slices

    txt = json_text(manifest, ndigits=4)
    nb = len(txt.encode('utf-8'))
    assert nb <= CAP, f'manifest.json would be {nb:,} bytes > {CAP:,} — nothing written'
    write_json('manifest.json', manifest, ndigits=4)

    kinds = {}
    for s in slices:
        k = None if s['tiles']['co2'] is None else s['tiles']['co2']['kind']
        kinds[k] = kinds.get(k, 0) + 1
    print(f'manifest.json: {nb:,} bytes (budget {CAP:,}); {len(slices)} slices, '
          f'{sum(1 for s in slices if s["ics_note"])} ics notes, '
          f'{sum(1 for s in slices if s["climate"] is None)} without climate/elevation '
          f'(maps {[s["map"] for s in slices if s["climate"] is None]})')
    print(f'  units: {manifest["units"]}')
    print(f'  co2 tile kinds: {kinds}; sea-level tiles: {sum(1 for s in slices if s["tiles"]["sea_level"])}')
    print(f'  top-level keys: {sorted(manifest)}')
    print(f'  slice keys: {sorted(slices[0])}')
    for mp in (1, 49, 88, 93):
        s = next(x for x in slices if x['map'] == mp)
        print(f'  map {mp}: {json.dumps({k: s[k] for k in ("age_ma", "ics", "ics_note", "climate", "elevation", "tiles")}, sort_keys=True, ensure_ascii=False)}')


if __name__ == '__main__':
    main()
