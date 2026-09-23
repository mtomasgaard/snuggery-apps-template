#!/usr/bin/env python3
"""Step 6 — the five files a person is expected to open and edit.

    waypoints.json   the named points on the walk, with a sentence each
    viewpoints.json  the saved cameras — and the six corridor anchors, so the cameras and the
                     level-of-detail corridor can never drift apart
    pace.json        the walking-speed model
    colors.json      the layer palette, light and dark
    about.json       the sources, the licences, and the honesty text

Every number in here is derived from the data built by steps 3 to 5 — waypoint heights from the
terrain, camera headings from the geometry — so nothing drifts if the model is rebuilt.

There is deliberately NO boat timetable, here or anywhere in data/ (NOTES/OWNER-DECISIONS.md,
2026-09-22). It is the one thing in the brief that cannot be built honestly: it changes every
season, has no open source with a licence and a date, and would ship as an unverified placeholder
for a boat people plan a mountain day around. about.json carries one sentence saying so, with no
times and no link.
"""
from __future__ import annotations
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geom
from paths import DATA, DTM, WORK

WAYPOINT_NOTES = {
    'gjendesheim': 'The boat quay and the DNT lodge at the east end of Gjende, on the road from '
                   'Randsverk. Most people start here and take the boat back, or take the boat '
                   'out to Memurubu first and walk back over the ridge.',
    'veslfjellet': 'The high point of the walk, and the top of the long pull up from Gjendesheim. '
                   'The place-name register spells it Veslefjell; the marker sits at the highest '
                   'point the trail crosses, read off the elevation model, which is 28 m from the '
                   'register\'s own point for the summit.',
    'besseggen': 'The ridge itself: Bessvatnet on one side about 390 m above Gjende on the other, '
                 'and a short scramble where the rock narrows. This is the part people come for '
                 'and the part that turns back parties in bad weather.',
    'bandet': 'The neck of land between Gjende and Bessvatnet, at the west end of the ridge. '
              'Walking east to west you drop to it off the egg; walking west to east this is '
              'where the climb starts.',
    'bjornboltjonne': 'A tarn on the high shelf west of the ridge, on the long open traverse '
                      'towards Memurubu.',
    'memurubu': 'The lodge and quay halfway along Gjende, reached by boat or on foot. The walk '
                'between here and Gjendesheim over the ridge is the classic day.',
}

VIEWPOINTS = [
    # id, name, anchor index (or None), look-at, eye height, above ground?, fov
    ('from-the-boat', 'From the boat on Gjende', 4, 'besseggen', 2.0, True, 55),
    ('from-the-col', 'From Bandet', 2, 'high-point', 1.7, True, 55),
    ('on-the-ridge', 'On top of Veslfjellet', 3, 'bandet', 1.7, True, 65),
    ('at-gjendesheim', 'At Gjendesheim', 0, 'boat', 1.7, True, 55),
    ('at-memurubu', 'At Memurubu', 1, 'besseggen', 1.7, True, 55),
    ('over-bessvatnet', 'Over Bessvatnet', 5, 'besshoe', 1900.0, False, 50),
]


def bearing(x0, y0, x1, y1):
    """Degrees clockwise from true north."""
    return round(math.degrees(math.atan2(x1 - x0, y1 - y0)) % 360.0)


def pitch(z0, x0, y0, z1, x1, y1):
    d = math.hypot(x1 - x0, y1 - y0)
    return round(math.degrees(math.atan2(z1 - z0, d))) if d > 0 else 0


def main():
    route = json.load(open(os.path.join(WORK, 'route2d.json'), encoding='utf-8'))
    stats = json.load(open(os.path.join(WORK, 'route_stats.json'), encoding='utf-8'))
    z = np.array(stats['z'], dtype=np.float64)
    rx = np.array(route['x'], dtype=np.float64)
    ry = np.array(route['y'], dtype=np.float64)

    ny, nx = geom.MASTER_SHAPE
    g5 = np.memmap(os.path.join(DTM, f'core_2m_{nx}x{ny}_u16dm.raw'),
                   dtype=np.uint16, mode='r', shape=(ny, nx))

    def ground(x, y):
        return float(geom.sample_bilinear(g5, geom.CORE, 2, np.array([x]), np.array([y]))[0])

    places = json.load(open(os.path.join(DATA, 'places.geojson'), encoding='utf-8'))['features']
    by_name = {}
    for f in places:
        by_name.setdefault(f['properties']['name'], f)

    # ------------------------------------------------------------------ waypoints.json
    hi = stats['highIndex']
    wps = []
    for w in route['waypoints']:
        i = hi if w['i'] is None else w['i']
        entry = {
            'id': w['id'], 'name': w['name'],
            'i': i,
            'x': round(float(rx[i])), 'y': round(float(ry[i])),
            'elevM': round(float(z[i])),
            'kmFromGjendesheim': round(route['cumM'][i] / 1000.0, 2),
            'ssrId': w['ssrId'],
            'note': WAYPOINT_NOTES[w['id']],
            'source': w['source'],
            'ssrName': w['ssrName'],
            'ssrX': round(w['ssrX']),
            'ssrY': round(w['ssrY']),
            'ssrElevM': round(ground(w['ssrX'], w['ssrY']), 1),
            'offRouteM': w['offRouteM'],
        }
        wps.append(entry)
    geom.write_json(os.path.join(DATA, 'waypoints.json'), {
        'note': 'x, y and elevM are the point ON THE ROUTE the waypoint is pinned to — index i in '
                'route.geojson — so a marker always sits on the trail. ssrX/ssrY are the '
                'place-name register\'s own point, which for Bandet and Bjørnbøltjønne is a few '
                'hundred metres off the path. Edit the names and notes freely.',
        'waypoints': wps})

    # ------------------------------------------------------------------ viewpoints.json
    def place_xyz(name):
        c = by_name[name]['geometry']['coordinates']
        return (float(c[0]), float(c[1]), float(c[2]))

    def route_xyz(wid):
        i = next(w['i'] for w in route['waypoints'] if w['id'] == wid)
        return (float(rx[i]), float(ry[i]), float(z[i]))

    targets = {
        'besseggen': place_xyz('Besseggen'),
        'besshoe': place_xyz('Besshøe'),
        'bandet': route_xyz('bandet'),
        'high-point': (float(rx[hi]), float(ry[hi]), float(z[hi])),
        'boat': (float(geom.ANCHORS[4][0]), float(geom.ANCHORS[4][1]), ground(*geom.ANCHORS[4])),
    }
    vps = []
    for vid, name, ai, target, eye, above, fov in VIEWPOINTS:
        ax, ay = geom.ANCHORS[ai]
        gz = ground(ax, ay)
        eye_abs = gz + eye if above else eye
        tx, ty, tz = targets[target]
        vps.append({'id': vid, 'name': name,
                    'x': int(ax), 'y': int(ay),
                    'eyeM': eye, 'aboveGround': above,
                    'headingDeg': bearing(ax, ay, tx, ty),
                    'pitchDeg': pitch(eye_abs, ax, ay, tz, tx, ty),
                    'fovDeg': fov,
                    'groundM': round(gz, 1), 'anchor': True,
                    'looksAt': target})
    ovx, ovy = geom.ORIGIN['x'], geom.CORE['y0'] + 512     # just inside the detailed box
    vps.append({'id': 'overview', 'name': 'Overview from the south',
                'x': ovx, 'y': ovy,
                'eyeM': 5200.0, 'aboveGround': False,
                'headingDeg': 0, 'pitchDeg': -22, 'fovDeg': 50,
                'groundM': round(ground(ovx, ovy), 1),
                'anchor': False, 'looksAt': 'the whole model'})
    geom.write_json(os.path.join(DATA, 'viewpoints.json'), {
        'note': 'headingDeg is degrees clockwise from true north; pitchDeg is degrees above the '
                'horizon, so a negative value looks down. aboveGround true means eyeM is added to '
                'the terrain height at x, y; false means eyeM is an absolute elevation. The six '
                'entries marked "anchor" are also the points the fine levels of terrain are built '
                'around (manifest.corridor.anchors) — move one and it will be outside its own '
                'high-resolution patch.',
        'viewpoints': vps}, compact_keys=())

    # ------------------------------------------------------------------ pace.json
    geom.write_json(os.path.join(DATA, 'pace.json'), {
        'model': 'tobler',
        'models': {
            'tobler': {'baseKmh': 6.0,
                       'note': '6*exp(-3.5*abs(slope+0.05)), Tobler 1993'},
            'naismith': {'flatKmh': 4.8, 'ascentMPerHour': 600,
                         # Langmuir's corrections are ten minutes per 300 m of descent, which is
                         # 1800 m per hour of correction in both directions.
                         'langmuir': {'gentleDescentBonusMPerHour': 1800,
                                      'steepDescentPenaltyMPerHour': 1800}}},
        'fitnessFactor': 1.0,
        'restMinutesPerHour': 0,
        'note': 'fitnessFactor scales the result: 0.8 is a fast party, 1.3 a slow one. '
                'restMinutesPerHour adds stops. Neither model knows about queues on the scramble, '
                'which on a July Saturday is the thing that actually decides the day.'})

    # ------------------------------------------------------------------ colors.json
    geom.write_json(os.path.join(DATA, 'colors.json'), {
        'note': 'One palette per colour scheme; the keys match the layer switches. Elevation bands '
                'run from Gjende at 984 m to Surtningssue at 2367 m.',
        'light': {'sky': '#dfe7ef', 'terrain': '#cfc6b4', 'terrainLow': '#9db183',
                  'water': '#9fb9cf', 'glacier': '#e8eef2', 'route': '#c0392b',
                  'routeAlt': '#2c3e50', 'marker': '#111418',
                  'contour20': '#00000018', 'contour100': '#00000038',
                  'slope30': '#e67e22', 'slope40': '#c0392b',
                  'sunlit': '#fffaf0', 'shadow': '#5a6b80', 'viewshed': '#3fa7a0'},
        'dark': {'sky': '#0d1218', 'terrain': '#565043', 'terrainLow': '#3c4a33',
                 'water': '#2d4257', 'glacier': '#7f8f9b', 'route': '#e8705f',
                 'routeAlt': '#9fb2c6', 'marker': '#f2f4f7',
                 'contour20': '#ffffff14', 'contour100': '#ffffff2e',
                 'slope30': '#d98a3a', 'slope40': '#e06a54',
                 'sunlit': '#e9e3d4', 'shadow': '#1b2531', 'viewshed': '#4fd0c6'},
        'elevationBands': [{'toM': 1000, 'color': '#4a6b3f'},
                           {'toM': 1400, 'color': '#8a8158'},
                           {'toM': 1800, 'color': '#9b9182'},
                           {'toM': 2400, 'color': '#f2f2f4'}]})

    # ------------------------------------------------------------------ about.json
    manifest = json.load(open(os.path.join(DATA, 'manifest.json'), encoding='utf-8'))
    geom.write_json(os.path.join(DATA, 'about.json'), {
        'boat': 'Most people take the MS Gjende boat one way along the lake. The timetable '
                'changes every season and is deliberately not in this app — check the current one '
                'with the operator before you plan the day.',
        'notNavigation': 'This is a planning tool. It has no position fix, no compass and no live '
                         'weather. Besseggen is exposed, the scramble is real, and the weather '
                         'turns fast — carry a map and compass and check conditions before you go.',
        'fixtureWarning': None,
        'terrain': {
            'name': 'Nasjonal høydemodell DTM1',
            'owner': 'Kartverket',
            'resolutionM': 1,
            'modelResolutionM': geom.MASTER_RES,
            'licence': 'Open data — NLOD 2.0 / CC BY 4.0',
            'retrieved': geom.RETRIEVED,
            'projects': manifest['source']['projects'],
            'accuracy': f"The source is a 1 m lidar terrain model. This app holds it resampled to "
                        f"{geom.MASTER_RES} m along the route, 4 m for 800 m either side, 8 m out "
                        f"to 4 km, 16 m across the rest of the detailed box and 64 m for the "
                        f"horizon ring. Heights carry the source's own error, which on open "
                        f"mountain is a few decimetres and on a cliff or under water is worse: "
                        f"lidar reads the water surface, so the ground under Gjende sits at "
                        f"the lake's own level.",
            'elevationRangeM': [manifest['elevation']['core']['minM'],
                                manifest['elevation']['core']['maxM']],
        },
        'trails': {
            'name': 'Turrutebasen (Tur- og friluftsruter)',
            'owner': 'Kartverket',
            'licence': 'Open data — no conditions apply to access and use',
            'retrieved': geom.RETRIEVED,
            'sourceUpdated': route['sourceUpdated'],
            'accuracy': 'Route geometry is generalised and largely contributed by clubs, '
                        'associations and individuals, so quality varies by route. The Besseggen '
                        'line is not labelled "Besseggen" in the source; it was assembled as the '
                        'shortest marked path from Gjendesheim to Memurubu.',
        },
        'route': {
            'lengthKm': round(stats['lengthM'] / 1000.0, 2),
            'pathLengthKm': round(route['pathLengthM'] / 1000.0, 2),
            'ascentM': round(stats['ascentM']),
            'descentM': round(stats['descentM']),
            'highPointM': round(stats['highElevM']),
            'sampleStepM': route['stepM'],
            'howMeasured': f"The line is resampled every {route['stepM']:.0f} m and its heights "
                           f"are read off the {geom.MASTER_RES} m terrain, then smoothed with a "
                           f"three-sample box. Without that smoothing the same line gives "
                           f"{round(stats['unsmoothedAscentM'])} m of ascent, and read at the "
                           f"source's own vertex spacing it gives "
                           f"{round(stats['rawAscentM'])} m — a 1 m model counts boulders as "
                           f"climbing. The figure shown is the smoothed one.",
        },
        'mapData': {'name': 'N50 Kartdata', 'owner': 'Kartverket', 'licence': 'CC BY 4.0',
                    'retrieved': geom.RETRIEVED,
                    'note': 'Lakes, rivers and glaciers, for kommunes 3434 Lom and 3435 Vågå. '
                            'Gjende arrives cut at the kommune border and is rejoined here. '
                            'N50 states a lake\'s height as a whole metre; the surface drawn in '
                            'the app is the water level the lidar reads, floored at that integer '
                            'and lifted a decimetre, and each lake carries both figures.'},
        'placeNames': {'name': 'Sentralt stedsnavnregister (SSR)', 'owner': 'Kartverket',
                       'licence': 'CC BY 4.0', 'retrieved': geom.RETRIEVED,
                       'note': 'Heights are sampled from the terrain: SSR carries none.'},
        'app': {'crs': 'EPSG:25833 (ETRS89 / UTM zone 33N)',
                'built': geom.GENERATED,
                'offline': 'Everything is bundled. The app makes no network requests of any kind '
                           'and reads no device sensor.'},
    })

    for n in ('waypoints.json', 'viewpoints.json', 'pace.json', 'colors.json', 'about.json'):
        print(f'  {n:18s} {os.path.getsize(os.path.join(DATA, n)):6,d} B')


if __name__ == '__main__':
    main()
