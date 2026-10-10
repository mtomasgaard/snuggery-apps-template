#!/usr/bin/env python3
"""Build every static file Warming World ships besides the snapshot (warming-world/tools/CONTRACT.md
§5), each step writing its credits fragment to credits/fragments/<step>.json first:

    assets/world.json    Natural Earth 1:50m land, land borders and lakes ≥ 5 000 km², in Global
                         Weather's delta-coded hundredths            -> fragments/basemap.json
    assets/places.json   all 1 251 Natural Earth populated places, four tiers -> fragments/places.json
    (fonts/ checked)     the vendored Archivo cut against its pins   -> fragments/archivo.json
    assets/about.json    About's eleven sections, placeholders filled by the app from the snapshot
    ../CREDITS.txt       assembled from the fragments, gistemp.json included (written by
                         build_snapshot.py --ref, which build_all.sh runs first)

    .venv/bin/python build_static.py [--offline]

Natural Earth comes from the cache through common.fetch_pinned (sha256-checked); --offline refuses
to download. No clock: the only date is common.RETRIEVED, plus the access date inside the GISTEMP
fragment, so two runs from the same cache are byte-identical (build_all.sh --twice proves it).
Standard library only (json, math, re, unicodedata) plus common.py.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import textwrap

from common import (RETRIEVED, BuildError, delta_encode, fetch_pinned, group, log, sha256_of, simplify,
                    write_json, zip_stored_size)
from paths import APP, ASSETS, CACHE, HERE
from sources import ARCHIVO, CITED, CREDIT, NE_COMMIT, NE_REPO, STATIC

FRAGMENTS = os.path.join(HERE, 'credits', 'fragments')
CREDITS_TXT = os.path.join(APP, 'CREDITS.txt')
CAPS = {'world.json': 420_000, 'places.json': 70_000, 'about.json': 40_000, 'CREDITS.txt': 30_000}
NNBSP = ' '
MINUS = '−'

# Visvalingam–Whyatt threshold for the basemap: 1e7 m² (10 km²). At the globe's largest size (radius
# 183 px × zoom 4 at DPR 2) one device pixel is about 4.4 km on a side, about 1.9e7 m², so every
# dropped vertex's triangle is under one device pixel. Measured (scratch run, 2026-10-01): land and
# borders 456 517 B unsimplified, 339 429 B at 1e7, 260 499 B at 3e7.
SIMPLIFY_M2 = 1e7
LAKE_MIN_KM2 = 5000.0
R_KM = 6371.0


def fragment(name: str, obj: dict):
    write_json(os.path.join(FRAGMENTS, f'{name}.json'), obj, max_bytes=10_000)


def load_ne(key: str, offline: bool) -> dict:
    pin = STATIC[key]
    path = os.path.join(CACHE, pin['name'])
    if offline and not os.path.exists(path):
        raise BuildError(f'offline and {pin["name"]} is not cached; run once without --offline')
    path = fetch_pinned(pin['url'], pin['name'], pin['sha256'], pin['bytes'])
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------------------------------------
# world.json
# ---------------------------------------------------------------------------------------------

def _polys(g):
    if g['type'] == 'Polygon':
        return [g['coordinates']]
    if g['type'] == 'MultiPolygon':
        return g['coordinates']
    raise BuildError(f'unexpected geometry {g["type"]}')


def _lines(g):
    if g['type'] == 'LineString':
        return [g['coordinates']]
    if g['type'] == 'MultiLineString':
        return g['coordinates']
    raise BuildError(f'unexpected geometry {g["type"]}')


def ring_area_km2(ring) -> float:
    """A ring's area on the sphere (R = 6 371 km) from its spherical excess: the tangent-half-angle
    sum d3-geo's areaRing uses, orientation-free (the smaller of the two areas it bounds)."""
    s = 0.0
    lon0, p0 = math.radians(ring[-1][0]), math.radians(ring[-1][1]) / 2 + math.pi / 4
    c0, s0 = math.cos(p0), math.sin(p0)
    for pt in ring:
        lon, p = math.radians(pt[0]), math.radians(pt[1]) / 2 + math.pi / 4
        c, sp = math.cos(p), math.sin(p)
        d = lon - lon0
        sd = 1.0 if d >= 0 else -1.0
        ad = sd * d
        k = s0 * sp
        s += math.atan2(k * sd * math.sin(ad), c0 * c + k * math.cos(ad))
        lon0, c0, s0 = lon, c, sp
    a = abs(2 * s)
    if a > 2 * math.pi:
        a = 4 * math.pi - a
    return a * R_KM * R_KM


def _ring(coords, closed=True):
    pts = [(float(p[0]), float(p[1])) for p in coords]
    return delta_encode(simplify(pts, SIMPLIFY_M2, closed=closed))


def build_world(offline: bool) -> dict:
    land_src, border_src, lake_src = (load_ne(k, offline) for k in ('ne_land', 'ne_borders', 'ne_lakes'))
    stats = {'land_in': 0, 'land_rings_dropped': 0, 'border_in': 0, 'lake_in': 0}
    land = []
    for feat in land_src['features']:
        for poly in _polys(feat['geometry']):
            stats['land_in'] += 1
            rings = []
            for r in poly:
                e = _ring(r)
                if len(e) // 2 >= 4:
                    rings.append(e)
                else:
                    stats['land_rings_dropped'] += 1
            if rings:
                land.append(rings)
    borders = []
    for feat in border_src['features']:
        for line in _lines(feat['geometry']):
            stats['border_in'] += 1
            e = _ring(line, closed=False)
            if len(e) >= 4:
                borders.append(e)
    lakes, lake_names = [], []
    for feat in lake_src['features']:
        for poly in _polys(feat['geometry']):
            stats['lake_in'] += 1
            area = ring_area_km2(poly[0]) - sum(ring_area_km2(h) for h in poly[1:])
            if area < LAKE_MIN_KM2:
                continue
            rings = [e for e in (_ring(r) for r in poly) if len(e) // 2 >= 4]
            if rings:
                lakes.append(rings)
                lake_names.append((round(area), feat['properties'].get('name') or ''))
    world = {
        'v': 1,
        'source': f'Natural Earth 1:50m v5.1.2 (public domain), commit {NE_COMMIT[:8]}',
        'units': 'hundredths of a degree, delta-encoded [lon0, lat0, dlon, dlat, ...]',
        'land': land,
        'borders': borders,
        'lakes': lakes,
    }
    lake_names.sort(key=lambda t: (-t[0], t[1]))
    log(f'  world: land {len(land)} of {stats["land_in"]} polygons ({stats["land_rings_dropped"]} rings under 4 '
        f'points dropped), borders {len(borders)} of {stats["border_in"]} lines, lakes {len(lakes)} of '
        f'{stats["lake_in"]} at ≥ {LAKE_MIN_KM2:.0f} km² (largest {lake_names[0][1]} {lake_names[0][0]:,} km², '
        f'smallest {lake_names[-1][1]} {lake_names[-1][0]:,} km²)')
    write_json(os.path.join(ASSETS, 'world.json'), world, max_bytes=CAPS['world.json'])
    fragment('basemap', {
        'id': 'natural-earth-basemap',
        'title': 'Natural Earth 1:50m, version 5.1.2: land, land borders, lakes',
        'owner': 'Natural Earth (naturalearthdata.com), Nathaniel Vaughn Kelso, Tom Patterson and contributors',
        'what': 'The coastlines, lakes and country borders drawn over the globe and the map (assets/world.json).',
        'url': [f'{NE_REPO}/tree/{NE_COMMIT}', 'https://www.naturalearthdata.com/'],
        'files': {STATIC[k]['name'].split('/')[-1]: STATIC[k]['sha256'] for k in ('ne_land', 'ne_borders', 'ne_lakes')},
        'licence': STATIC['ne_land']['licence'],
        'licence_quote': '"All versions of Natural Earth raster + vector map data found on this website are in '
                         'the public domain." "No permission is needed to use Natural Earth. Crediting the '
                         'authors is unnecessary." (LICENSE.md at the pinned commit)',
        'attribution': CREDIT['basemap'],
        'changes': C(f'Simplified (Visvalingam–Whyatt, {SIMPLIFY_M2 / 1e6:.0f} km²), rounded to 0.01° and '
                     f'delta-coded; {len(lakes)} lakes of {group(LAKE_MIN_KM2)} km² and more kept, measured on '
                     'the sphere; rings under 4 points dropped.'),
        'retrieved': RETRIEVED,
    })
    return world


# ---------------------------------------------------------------------------------------------
# places.json
# ---------------------------------------------------------------------------------------------

def tier(scalerank: int, lat: float) -> int:
    """CONTRACT §5.2: 1 = scalerank 0; 2 = 1–2; 3 = 3, or any place at |lat| ≥ 60° (the pole views
    need names); 4 = the rest."""
    if scalerank == 0:
        return 1
    if scalerank <= 2:
        return 2
    if scalerank == 3 or abs(lat) >= 60:
        return 3
    return 4


def build_places(offline: bool) -> list:
    src = load_ne('ne_places', offline)
    out = []
    for feat in src['features']:
        p = feat['properties']
        lon, lat = feat['geometry']['coordinates'][:2]
        name = re.sub(r'\s+', ' ', p['name']).strip()
        if not name:
            raise BuildError(f'a populated place has no name: {p}')
        out.append({'n': name, 'lon': round(lon, 2), 'lat': round(lat, 2), 'r': tier(int(p['scalerank']), lat)})
    out.sort(key=lambda d: (d['r'], d['n'], d['lon'], d['lat']))
    counts = {r: sum(1 for d in out if d['r'] == r) for r in (1, 2, 3, 4)}
    log(f'  places: {len(out)} (tiers {counts}); polar promotions '
        f'{sum(1 for d in out if d["r"] == 3 and abs(d["lat"]) >= 60)}')
    write_json(os.path.join(ASSETS, 'places.json'), out, max_bytes=CAPS['places.json'])
    fragment('places', {
        'id': 'natural-earth-places',
        'title': 'Natural Earth 1:50m, version 5.1.2: populated places (simple)',
        'owner': 'Natural Earth (naturalearthdata.com)',
        'what': 'The city names on the globe and in the tap card (assets/places.json).',
        'url': [f'{NE_REPO}/tree/{NE_COMMIT}'],
        'files': {STATIC['ne_places']['name'].split('/')[-1]: STATIC['ne_places']['sha256']},
        'licence': STATIC['ne_places']['licence'],
        'attribution': CREDIT['basemap'],
        'changes': (f'All {group(len(out))} places kept, names with runs of spaces collapsed, positions rounded to '
                    '0.01°, ranked in four tiers from scalerank, places at 60° and beyond promoted to tier 3.'),
        'retrieved': RETRIEVED,
    })
    return out


# ---------------------------------------------------------------------------------------------
# the font: checked, not built (tools/art/font_subset.py builds it)
# ---------------------------------------------------------------------------------------------

def check_font():
    for rel, (size, sha) in ARCHIVO['files'].items():
        path = os.path.join(APP, rel)
        if not os.path.exists(path):
            raise BuildError(f'{rel} is missing; build it with warming-world/tools/art/font_subset.py')
        if os.path.getsize(path) != size or sha256_of(path) != sha:
            raise BuildError(f'{rel}: {os.path.getsize(path):,} B sha256 {sha256_of(path)[:16]}… does not match the '
                             f'pin in sources.ARCHIVO ({size:,} B {sha[:16]}…); update the pin deliberately')
    log(f'  fonts: {", ".join(ARCHIVO["files"])} match their pins')
    fragment('archivo', {
        'id': 'archivo',
        'title': 'Archivo (typeface)',
        'owner': ARCHIVO['owner'],
        'what': 'The only typeface the app sets (fonts/archivo-ww.woff2); the license is fonts/OFL.txt.',
        'url': [ARCHIVO['url']],
        'files': {rel: sha for rel, (_, sha) in ARCHIVO['files'].items()},
        'licence': ARCHIVO['licence'],
        'attribution': ARCHIVO['credit'],
        'changes': f'{ARCHIVO["adaptation"]}, from {ARCHIVO["upstream"]}.',
        'retrieved': RETRIEVED,
    })


# ---------------------------------------------------------------------------------------------
# about.json (DESIGN §3.6; placeholders CONTRACT §5.3)
# ---------------------------------------------------------------------------------------------

def C(x: str) -> str:
    """The apps' SI rule (DESIGN §2): a number and its unit joined by U+202F ('0.1 °C', '1 200 km',
    '29 %'), and thousands grouped with U+202F ('26 000'), never a comma or a plain space."""
    x = re.sub(r'(\d) (\d{3})\b', '\\1' + NNBSP + '\\2', x)
    return re.sub(r'(\d) (°C|km|%)', '\\1' + NNBSP + '\\2', x)


# Quotations are marked with “ ” and must be found verbatim in credits/gistemp-page-and-faq.txt
# (verify_static.py checks every one).
ABOUT_SECTIONS = [
    ('colors', 'What the colors mean', [
        'In Difference, each cell’s color is how much warmer or colder that 2° cell was than its own 1951–1980 '
        'average for the same months, or than its average over the years a chosen baseline names. It is a '
        'temperature anomaly, not a temperature: 0.0 °C means the normal, not freezing.',
        f'The map’s scale runs from {MINUS}4 to +4 °C and never changes, not with the year and not with a new '
        'release. Cells beyond it are drawn in the end colors, and a tap gives their true value. The stripes '
        'under the globe have their own fixed scale, ±1.5 °C, because the global mean never comes near 4 °C. A '
        'year or month beyond it is drawn in the end color, and the stripes’ caption says how many are.',
        'Hatched gray means no value: GISS makes no estimate for that cell, or, in a year, fewer than 9 of its '
        '12 months have one. It is not zero, and it is not “no change”.',
        'GISS: “Temperature anomalies indicate how much warmer or colder it is than normal for a particular place '
        'and time. For the GISS analysis, normal always means the average over the 30-year period 1951-1980 for '
        'that place and time of year.”',
    ]),
    # plan 0012 package 3.3: Absolute and the chosen baseline (warming-world/tools/DECISIONS.md)
    ('absolute', 'Absolute: an estimated temperature', [
        'Absolute shows an estimate of the temperature itself: each cell’s 1951–1980 average 2 m air '
        'temperature plus GISS’s anomaly for the year or month on screen. GISS measures change, not '
        'temperature, so the average comes from a second source, ERA5, the Copernicus Climate Change '
        'Service’s reanalysis of the world’s weather. It is an estimate, not a measured map of temperature.',
        'This app made the average from ERA5’s 2 m air temperature for 1990–2019, as WeatherBench 2’s '
        'climatology holds it: averaged onto GISS’s 2° cells, then moved back to 1951–1980 cell by cell and '
        'month by month by taking away GISS’s own mean anomaly for 1990–2019. That climatology is smoothed '
        'over 61 days; the app undoes the smoothing for the yearly cycle’s first three harmonics, which can '
        'still leave a month about 1.3 °C off over land. The average is kept in steps of 0.5 °C.',
        'A year is the average of its 12 months plus the year’s anomaly, a month is that month’s average plus '
        'its anomaly, and the partial year is the average of its months so far plus its anomaly so far.',
        'Over land and sea ice the value is air temperature throughout. Over open water GISS’s anomaly is the '
        'sea surface’s, standing in for the air’s, as GISS itself does: the value is an estimate of the air '
        'over the sea, not the temperature of the sea.',
        f'The scale runs from {MINUS}50 to +50 °C, centered on 0 °C, and never changes; cells beyond it are '
        'drawn in the end colors, and the legend counts them. Its colors are Global Weather’s temperature '
        f'colors, by value: violet at {MINUS}50 °C, then blue, slate at 0 °C, green, ochre and red, so a '
        'temperature takes the same color in both apps. Difference keeps its own blue-to-red scale; the switch and '
        'the legend say which map is on screen.',
        'How sure it is: GISS puts the uncertainty of the world’s absolute average at about 0.5 °C, and '
        'different sources can disagree by several degrees in a mountain cell. So the card gives a cell’s '
        'temperature to the whole degree, and its chart shows the change, the anomaly, to 0.1 °C. The year '
        'row’s global mean is the average’s area mean for that month or year plus GISS’s global mean, with '
        '±0.5 °C. A mean of the map’s own cells would depend on which cells have data, and the early years '
        'miss the poles. The Arctic and Antarctic readings in Absolute are made the same way: the average’s '
        'mean over the whole cap plus the mean anomaly of the cap’s cells with data.',
    ]),
    ('baseline', 'A baseline of your own', [
        'In Difference, Base chooses the years each place is compared with. Four common spans take one tap: '
        '1951–1980, GISS’s own base and where the app starts; 1961–1990; 1981–2010; and 1991–2020, the World '
        'Meteorological Organization’s current climate normal. The slider’s two ends choose any other span '
        'from {firstYear} to {lastComplete}, down to a single year where they meet.',
        'With another span, a cell’s value is its anomaly minus its own mean over those years, rounded to '
        '0.1 °C. A cell needs a value in at least two thirds of them, 20 of 30; one with fewer has no '
        'baseline and is drawn as no data, and the year row’s coverage counts only cells with both.',
        'The year row’s global mean and the stripes are GISS’s own global means minus their mean over the '
        'same years. The bracket under the stripes and every label name the span in use.',
        'The partial year is its months so far minus the cell’s mean over the span’s whole years, not over '
        'the same months, because the app keeps no monthly maps for those years. Where the span’s years '
        'departed from 1951–1980 more in some months than over the whole year, as the Arctic’s winters did, '
        'the partial year’s difference is off by that much.',
        'Single months stay against 1951–1980: the app holds GISS’s monthly maps for the last 24 months only, '
        'so it cannot average a month over other years. Absolute does not depend on the baseline; its card’s '
        'chart and the stripes do.',
    ]),
    ('sources', 'Where the numbers come from', [
        'Over land: about 26 000 weather stations of NOAA’s Global Historical Climatology Network monthly, '
        'version 4, adjusted. Over ice-free ocean: NOAA’s Extended Reconstructed Sea Surface Temperature, '
        'version 5 (ERSST v5), where the water’s anomaly stands in for the air’s. Over sea ice, land '
        'stations’ air temperatures are used.',
        'GISS spreads each station’s anomaly over every cell within 1 200 km, so a colored cell need not '
        'contain a thermometer. Much of the color over the Arctic Ocean and near Antarctica is this estimate.',
        'The ocean is estimated too. ERSST is a reconstruction, as its name says: where ships and buoys were '
        'few, as over the early oceans, NOAA estimates the sea surface statistically from the observations it '
        'has. So an early colored ocean cell is an estimate, not a measurement.',
        'GISS: “L-OTI maps show SAT anomalies over land and sea ice, and show SST anomalies over (ice-free) '
        'water.” SAT is surface air temperature, SST sea surface temperature. The method is Hansen and others '
        '(2010), with the uncertainty analysis of Lenssen and others (2024).',
    ]),
    ('coverage', 'How much of Earth is covered, era by era', [
        'Data cover {coverage:1880} of Earth’s surface in {firstYear}, {coverage:1900} in 1900, {coverage:1950} '
        'in 1950, {coverage:1980} in 1980 and {coverage:last} in {lastComplete}. The rest is gray on the map.',
        'North of 64° N every cell has a value in every year from 1946 on, and in some years from 1931. That '
        'comes from the 1 200 km smoothing of a few coastal and island stations, not from observations of the '
        'Arctic Ocean itself.',
        'South of 64° S, the share of the area with data jumps from 38 % in 1955 to 93 % in 1957, when the '
        'stations of the International Geophysical Year opened. The map’s Antarctic reading gives the same '
        'shares.',
        'In 2025 nearly all the gray cells lie between 54° S and 70° S, in the sea-ice zone of the Southern '
        'Ocean.',
    ]),
    ('partial', 'The current year is partial', [
        '{partialLabel}',
        'GISS publishes no annual figure for a year still under way. This app shows the newest year as the mean '
        'of the months published so far, once at least 6 are out, and marks it partial wherever it appears: '
        'its stripe is open and its point on a cell’s chart is hollow. A cell needs at least three quarters '
        'of those months.',
        'A partial map cannot be compared cell by cell with a full year. In 2025, the January–July map differed '
        'from the full year’s by about 0.3 °C per cell on average.',
    ]),
    ('rounding', 'Annual means and rounding are this app’s', [
        'GISS publishes monthly maps. The annual maps are this app’s: a cell’s year is the plain mean of its '
        'monthly values when it has at least 9 of the 12 months, and gray otherwise. Values are rounded to '
        '0.1 °C, half away from zero.',
        'The global mean in the year row, and the stripes, are GISS’s own numbers from its table of global '
        'means, which GISS calls definitive: “the number in the index files should be considered definitive”. '
        'A mean of the map can differ from them by a few hundredths of a degree.',
        'The Arctic and Antarctic readings are this app’s own: area-weighted means of the map’s cells, not '
        'GISS’s zonal means.',
        'The Last 24 months view shows GISS’s monthly values, rounded the same way. Single months swing much '
        'further than years.',
    ]),
    ('revisions', 'Revisions', [
        'GISS updates its analysis about the 10th of every month. Each release adds the newest month and can '
        'change earlier months slightly as late reports and corrections arrive: “monthly updates not only add '
        'e.g. global mean estimates for the new month, but may slightly change estimates for earlier months”. '
        'This app shows one release at a time and replaces it whole.',
        'This copy is the release created {releaseCreated}, with the newest month {newestMonth}. It was read on '
        '{accessed}.',
    ]),
    ('not-shown', 'What is not shown', [
        'Uncertainty: GISS publishes an ensemble of possible analyses; this app shows the central analysis only.',
        'Measured temperatures (Absolute’s are an estimate), sea ice and causes.',
        'Anything before {firstYear}. GISS: “The analysis is limited to the period since 1880 because of poor '
        'spatial coverage of stations and decreasing data quality prior to that time.”',
    ]),
    ('citations', 'Sources and citations', [
        'GISS asks that its data be cited with the date of access. The citations below are filled from this '
        'copy’s data file. Addresses are printed as text; nothing here is a link.',
    ]),
    ('this-copy', 'This copy', [
        'The app’s version, when this data file was made, and which GISS release it holds.',
    ]),
]
PLACEHOLDER = re.compile(r'\{([^{}]+)\}')
KNOWN = re.compile(r'^(coverage:(\d{4}|last)|lastComplete|partialLabel|newestMonth|releaseCreated|accessed|firstYear)$')


def build_about() -> dict:
    sections = []
    for sid, title, paras in ABOUT_SECTIONS:
        ps = [C(p) for p in paras]
        for p in ps:
            for m in PLACEHOLDER.finditer(p):
                if not KNOWN.match(m.group(1)):
                    raise BuildError(f'about.json: unknown placeholder {{{m.group(1)}}} in section {sid}')
        sections.append({'id': sid, 'title': title, 'paragraphs': ps})
    about = {
        'v': 1,
        'sections': sections,
        'static': [
            {'id': 'natural-earth', 'name': 'Natural Earth 1:50m v5.1.2', 'credit': CREDIT['basemap'],
             'licence': 'Public domain (Natural Earth’s own dedication)', 'url': 'https://www.naturalearthdata.com/'},
            {'id': 'archivo', 'name': 'Archivo', 'credit': ARCHIVO['credit'], 'licence': ARCHIVO['licence'],
             'url': ARCHIVO['url']},
        ],
        'endorsement': 'NASA does not endorse this app. It uses NASA’s published data, as NASA’s media guidelines '
                       'allow for factual use.',
    }
    write_json(os.path.join(ASSETS, 'about.json'), about, max_bytes=CAPS['about.json'])
    return about


# ---------------------------------------------------------------------------------------------
# CREDITS.txt, from the fragments
# ---------------------------------------------------------------------------------------------

ORDER = ['gistemp', 'basemap', 'places', 'archivo']
RULE = '-' * 100


def _field(label: str, value, width=100) -> list[str]:
    head = f'    {label}: '
    pad = ' ' * len(head)
    vals = value if isinstance(value, list) else [value]
    out = []
    for i, v in enumerate(vals):
        out += textwrap.wrap(str(v), width=width, initial_indent=head if i == 0 else pad, subsequent_indent=pad,
                             break_long_words=False, break_on_hyphens=False) or [head.rstrip()]
    return out


def build_credits() -> str:
    frags = {}
    for name in ORDER:
        path = os.path.join(FRAGMENTS, f'{name}.json')
        if not os.path.exists(path):
            raise BuildError(f'credits fragment {name}.json is missing'
                             + (' (build_snapshot.py --ref writes it; build_all.sh runs that first)'
                                if name == 'gistemp' else ''))
        with open(path, encoding='utf-8') as f:
            frags[name] = json.load(f)
    extra = sorted(set(os.path.splitext(n)[0] for n in os.listdir(FRAGMENTS) if n.endswith('.json')) - set(ORDER))
    if extra:
        raise BuildError(f'unclaimed credits fragments: {extra}')
    g = frags['gistemp']
    lines = ['Warming World: credits and licenses', '=' * 35, '']
    lines += textwrap.wrap(
        'Every number on the map is NASA GISS\'s, or this app\'s annual mean and rounding of GISS\'s monthly '
        'values; in Absolute, ERA5\'s 1951–1980 average (the last section below) is added to them. The data file (data/snapshot.json) is replaced about once a month from GISS\'s newest release '
        'and carries its own sources, access date and citations, which the About screen prints. Nothing is '
        'fetched at runtime: the app has no network. ' + g['endorsement'], 100)
    lines.append('')
    for name in ORDER:
        fr = frags[name]
        lines += [RULE, fr['title'].upper(), '']
        lines += _field('Owner', fr['owner'])
        lines += _field('Used for', fr['what'])
        lines += _field('URL', fr['url'])
        if fr.get('via'):
            lines += _field('Read via', fr['via'])
        if fr.get('release'):
            lines += _field('Release', fr['release'])
        if fr.get('files'):
            lines += _field('Files (sha256)', [f'{k} {v}' for k, v in fr['files'].items()])
        lines += _field('License', fr['licence'])
        if fr.get('licence_quote'):
            lines += _field('License text', fr['licence_quote'])
        lines += _field('Retrieved', fr.get('accessed') or fr['retrieved'])
        lines += _field('Changes', fr['changes'])
        if fr.get('citation'):
            lines += _field('Cite', fr['citation'])
        lines += _field('Attribution', fr['attribution'])
        if fr.get('inputs'):
            lines += _field('Inputs and method, cited', fr['inputs'])
        if fr.get('endorsement'):
            lines += _field('Endorsement', fr['endorsement'])
        lines.append('')
    # plan 0012 3.3: the climatology's section, from the file itself (warming-world/tools/climatology/)
    with open(os.path.join(ASSETS, 'climatology.json'), encoding='utf-8') as f:
        cl = json.load(f)['credits']
    lines += [RULE, cl['title'].upper(), '']
    for label, key in [('Owner', 'owner'), ('Used for', 'what'), ('URL', 'url'), ('License', 'licence'),
                       ('License text', 'licence_quote'), ('Retrieved', 'accessed'), ('Changes', 'changes'),
                       ('Cite', 'citation'), ('Attribution', 'attribution')]:
        lines += _field(label, cl[key])
    lines.append('')
    lines += [RULE, '']
    text = '\n'.join(lines)
    data = text.encode('utf-8')
    if len(data) > CAPS['CREDITS.txt']:
        raise BuildError(f'CREDITS.txt {len(data):,} B exceeds {CAPS["CREDITS.txt"]:,} B')
    tmp = CREDITS_TXT + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, CREDITS_TXT)
    log(f'  wrote {len(data):>11,} B  {CREDITS_TXT}')
    return text


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--offline', action='store_true')
    a = ap.parse_args(argv)
    log('== world.json')
    build_world(a.offline)
    log('== places.json')
    build_places(a.offline)
    log('== fonts')
    check_font()
    log('== about.json')
    build_about()
    log('== CREDITS.txt')
    build_credits()
    total = 0
    for name in ('world.json', 'places.json', 'about.json'):
        with open(os.path.join(ASSETS, name), 'rb') as f:
            b = f.read()
        z = zip_stored_size(b)
        total += z
        print(f'{name:12} {len(b):>9,} B  in the ZIP {z:>9,} B  cap {CAPS[name]:>9,} B')
    print(f'assets/ in the ZIP: {total:,} B')


if __name__ == '__main__':
    try:
        main()
    except BuildError as e:
        log(f'BUILD FAILED: {e}')
        sys.exit(1)
