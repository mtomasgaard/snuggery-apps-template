"""Step 90 — the About panel (data/about.json) and ../CREDITS.txt (tools/CONTRACT.md §11, §12).

The credits fragments every step writes to tools/credits/fragments/<step>.json are the single source
for who owns each dataset, its licence and what this app changed: a dataset's block is written once,
by the step that uses it, and appears identically in the app and in CREDITS.txt. Blocks with the same
id (the atlas from steps 10 and 20, the climate model from steps 30 and 40) are merged here, parts
joined in step order. Gough (1981) comes from sources.CITED: a formula, cited, nothing downloaded.

The rest of the About text is kept here: how to read each lens, the honesty caveats DESIGN.md §3.8
asks for, and what the app does not show. Every number those texts quote is read from the shipped
data files into `numbers` and formatted from there, never typed.

Like every step: no clock, no environment; two runs from the same data give byte-identical files; a
file over its budget is not written.
"""
import json
import math
import os
import sys
import textwrap

from common import RETRIEVED, json_text, write_json
from paths import APP, CREDITS, DATA, TOOLS, WORK
from sources import CITED, SOURCES
from story_check import AI_NAMES

CAP_ABOUT = 40_000
CAP_CREDITS = 40_000
WRAP = 100

# CONTRACT §11: the source ids, in this order; nothing else may appear in a fragment.
ORDER = ['paleoatlas', 'paleodem', 'phanda', 'foster2017', 'vandermeer2022', 'ics', 'naturalearth',
         'gough1981']
# The steps in pipeline order, for joining the parts of a merged block.
STEP_ORDER = ['surface', 'plates', 'climate', 'elevation', 'curves', 'timescale', 'story', 'manifest']

# What this app did to each source, in a few words, for the attribution line CC BY asks for
# ("indicate if changes were made"). The long form is each block's `adaptations`.
CHANGES = {
    'paleoatlas': 'resized and recompressed the maps; rotated outlines, coastlines, cities and pins with the '
                  'plate model, rounded to 16 bits',
    'paleodem': ('computed land and shallow-sea shares from the elevation grids and sorted every second grid '
                 'point into Scotese’s elevation classes'),
    'phanda': 'averaged the model output into annual means, converted units and rounded each value to one byte',
    'foster2017': 'resampled the fit to whole millions of years and left out the 95% band',
    'vandermeer2022': 'rounded the published values to the millimeter and interpolated them to the map ages',
    'ics': 'used the names, ages and colors of the units younger than 1,000 million years',
}

# Papers the caveats cite that are not data sources. Checked against Crossref on 2026-09-30 (title,
# authors, journal, volume, pages) with the statement used read from the abstract or open full text.
REFERENCES = [
    {'id': 'domeier2014', 'access': 'open', 'doi': '10.1016/j.gsf.2014.01.002',
     'cite': 'Domeier, M. & Torsvik, T.H. (2014). Plate tectonics in the late Paleozoic. Geoscience '
             'Frontiers 5, 303–350.',
     'evidence': 'abstract: reconstruction becomes increasingly challenging with age, owing to the loss of '
                 'oceanic lithosphere through subduction'},
    {'id': 'vanhinsbergen2015', 'access': 'open', 'doi': '10.1371/journal.pone.0126946',
     'cite': 'van Hinsbergen, D.J.J., de Groot, L.V., van Schaik, S.J. et al. (2015). A Paleolatitude '
             'Calculator for Paleoclimate Studies. PLOS ONE 10, e0126946.',
     'evidence': "full text (CC BY, PMC4462584): 'Paleomagnetic data, however, do not constrain paleolongitude'"},
]


def load(name, base=DATA):
    with open(os.path.join(base, name), encoding='utf-8') as f:
        return json.load(f)


# --- the fragments ----------------------------------------------------------------------------------
def load_fragments():
    fdir = os.path.join(CREDITS, 'fragments')
    names = sorted(n[:-5] for n in os.listdir(fdir) if n.endswith('.json'))
    unknown = [n for n in names if n not in STEP_ORDER]
    if unknown:
        sys.exit(f'credits fragments from unknown steps {unknown}: add them to STEP_ORDER')
    blocks = []
    for step in sorted(names, key=STEP_ORDER.index):
        for b in load(f'{step}.json', fdir):
            if b['id'] not in ORDER:
                sys.exit(f"fragment {step}.json: source id {b['id']!r} is not one of {ORDER}")
            if b.get('retrieved') != RETRIEVED:
                sys.exit(f"fragment {step}.json, {b['id']}: retrieved {b.get('retrieved')} != {RETRIEVED}")
            blocks.append(dict(b, step=step))
    return names, blocks


def uniq(xs):
    out = []
    for x in xs:
        if x and x not in out:
            out.append(x)
    return out


def merge(blocks):
    """One block per source id: the first block's title and owner; licence fields must agree;
    sources, URLs and accuracy notes joined without repeats; adaptations joined in step order, each
    labelled with its part when the source has several; the longest cite (the most complete)."""
    by = {}
    for b in blocks:
        by.setdefault(b['id'], []).append(b)
    def flat(bs, k):
        # A fragment may give `source` or `url` as a list: each item is merged on its own, so a
        # sentence or URL two steps share appears once.
        vals = []
        for b in bs:
            v = b.get(k)
            vals += v if isinstance(v, list) else [v]
        return uniq(vals)

    out = {}
    for sid, bs in by.items():
        for k in ('licence', 'licence_uri'):
            vals = uniq(b.get(k) for b in bs)
            if len(vals) > 1:
                sys.exit(f'{sid}: the fragments disagree on {k}: {vals}')
        several = len(bs) > 1

        def labelled(b):
            a = b.get('adaptations') or ''
            part = b.get('part')
            if several and part and not a.lower().startswith(part.lower()):
                a = f'{part[0].upper()}{part[1:]}: {a}'
            return a
        out[sid] = {
            'id': sid, 'title': bs[0]['title'], 'owner': bs[0]['owner'], 'licence': bs[0]['licence'],
            'licence_uri': bs[0].get('licence_uri'), 'licence_quote': bs[0].get('licence_quote'),
            'source': ' '.join(flat(bs, 'source')),
            'url': ' ; '.join(flat(bs, 'url')),
            'retrieved': RETRIEVED,
            'adaptations': ' '.join(uniq(labelled(b) for b in bs)),
            'accuracy': ' '.join(uniq(b.get('accuracy') for b in bs)),
            'cite': max((b.get('cite') or '' for b in bs), key=len),
            'steps': uniq(b['step'] for b in bs),
        }
    return out


def gough_block():
    c = CITED['gough1981']
    return {
        'id': 'gough1981', 'title': "The Sun's brightness in the past (a published formula)",
        'owner': 'D. O. Gough', 'licence': 'publisher copyright; the formula is used, no text or figure is copied',
        'licence_uri': None, 'licence_quote': None,
        'source': c['used'], 'url': 'https://articles.adsabs.harvard.edu/pdf/1981SoPh...74...21G',
        'retrieved': RETRIEVED,
        'adaptations': 'The app evaluates equation (1) with the Sun\'s main-sequence age of 4.7 billion years '
                       'at each map\'s age; nothing is stored.',
        'accuracy': 'A model of the Sun\'s slow brightening, not a measurement.',
        'cite': c['citation'], 'steps': [],
    }


# The copyright notices the licensors supplied with the material (CC BY 4.0 §3(a)(1)(A)(ii) asks for
# them to be kept): Foster 2017's page metadata (tools/credits/foster2017-licence.txt) and van der
# Meer 2022's article notice (tools/credits/vandermeer2022-licence.txt).
COPYRIGHT = {
    'foster2017': '© The Author(s) 2017',
    'vandermeer2022': '© 2022 The Authors, published by Elsevier B.V. on behalf of the International '
                      'Association for Gondwana Research',
}


def attribution(b):
    """The credit line each licence asks for, as the app prints it."""
    sid = b['id']
    if sid == 'naturalearth':
        return 'Made with Natural Earth. Public domain.'
    if sid == 'gough1981':
        return 'Formula from ' + b['cite']
    if sid == 'ics':
        return ('International Chronostratigraphic Chart data, © International Commission on Stratigraphy, '
                f"2026, licensed under CC BY 4.0 ({b['licence_uri']}). This app {CHANGES[sid]}.")
    if b['licence'] == 'CC BY 4.0':
        notice = f"{COPYRIGHT[sid]}. " if sid in COPYRIGHT else ''
        return (f"{b['title']}, by {b['owner']}. {notice}Licensed under CC BY 4.0 ({b['licence_uri']}). "
                f"This app {CHANGES[sid]}.")
    sys.exit(f"{sid}: no attribution rule for licence {b['licence']!r}")


# --- numbers the texts quote, read from the shipped data ----------------------------------------------
def read_numbers():
    man, cl, cur, pl, ts = (load(n) for n in ('manifest.json', 'climate.json', 'curves.json',
                                              'plates.json', 'timescale.json'))
    story = load('story.json')
    ics_work = load('ics_slices.json', WORK)
    clim_work = load('climate.json', WORK)
    tiles = load('tiles.json', WORK)
    sl = man['slices']
    ages = [s['age_ma'] for s in sl]
    old = [a for a in ages if a > 545]
    regular = [a for a in ages if a <= 545]
    gaps = sorted(b - a for a, b in zip(regular, regular[1:]))
    co2 = cur['series']['co2_ppm']
    plate_ages = [s['plate_age_ma'] for s in cl['slices']]
    steps = sorted(set(round(b - a, 6) for a, b in zip(plate_ages, plate_ages[1:])))
    if len(steps) != 1:
        sys.exit(f'climate slices are not evenly spaced: {steps}')
    no_climate = [m['map'] for m in clim_work['maps'] if m['climate'] is None]
    no_climate_ages = [s['age_ma'] for s in sl if s['map'] in no_climate]
    today_only, today_only_ocean = today_only_share()
    today_c = cl['slices'][0]['global_mean_c']
    land0 = tiles['maps'][0]['tiles']['land']['land_pct']
    notes = sum(1 for m in ics_work['maps'] if m['ics_note'] is not None)
    rot_gap = max(abs(s['rotation_ma'] - s['age_ma']) for s in sl)
    sun = lambda a: 100 / (1 + 0.4 * a / 4700)                 # Gough (1981) eq. (1), t_sun 4.7 Gyr
    return {
        'n_maps': len(sl), 'oldest_map_ma': max(ages), 'old_maps_ma': old,
        'regular_back_to_ma': max(regular), 'median_gap_ma': gaps[len(gaps) // 2],
        'max_rotation_minus_age_ma': round(rot_gap, 3),
        'climate_runs': cl['count'], 'climate_step_ma': steps[0], 'climate_oldest_ma': max(plate_ages),
        'maps_without_climate_ma': no_climate_ages,
        'today_temperature_c': today_c, 'today_temperature_f': today_c * 9 / 5 + 32,
        'today_co2_model_ppm': cl['slices'][0]['co2_ppm'],
        'today_land_pct': land0,
        'co2_fit_last_ma': co2['last_ma'], 'lo95_negative_rows': co2['lo95_negative_rows'],
        'lo95_negative_from_ma': co2['lo95_negative_from_ma'], 'lo95_negative_to_ma': co2['lo95_negative_to_ma'],
        'sea_level_last_ma': max(i for i, v in enumerate(cur['series']['sea_level_m']['values']) if v is not None),
        'n_plates': len(pl['plates']), 'n_rings': pl['rings'], 'today_only_area_pct': today_only,
        'today_only_ocean_pct': today_only_ocean,
        'ics_version': ts['version'], 'ics_notes': notes,
        'sun_pct_oldest': sun(max(ages)), 'story_sources': len(story['sources']),
        'dem_first_draft_page': 7,        # "The paleoDEMS provided with this report are a “first draft”" (report p. 7)
    }


def today_only_share():
    """Share of the globe whose crust the model holds only for today, and how much of that lies under
    today's oceans: the centres of the 1° cells, cos-latitude weighted, partitioned exactly as places and
    pins are (polygons valid at 0 Ma, PlatePartitioner.partition_point); "only today" = the claiming
    polygon's valid time begins at 0 Ma. Ocean = outside Natural Earth 1:50m land (even-odd rule)."""
    import numpy as np
    import pygplates as g
    from geo import POLY_NAME, ROT_NAME, even_odd, geojson_rings, load_geojson, plate_model_files
    files = plate_model_files()
    rm = g.RotationModel(files[ROT_NAME][0])
    fc = g.FeatureCollection(files[POLY_NAME][0])
    pp = g.PlatePartitioner([f for f in fc if f.is_valid_at_time(0)], rm)
    lons, lats = np.arange(-179.5, 180, 1.0), np.arange(89.5, -90, -1.0)
    land = even_odd(geojson_rings(load_geojson('ne_land')), lons, lats)
    total = only = only_ocean = 0.0
    for j, la in enumerate(lats):
        w = math.cos(math.radians(la))
        for i, lo in enumerate(lons):
            total += w
            r = pp.partition_point(g.PointOnSphere(float(la), float(lo)))
            if r is not None and r.get_feature().get_valid_time()[0] == 0:
                only += w
                if not land[j, i]:
                    only_ocean += w
    return only / total * 100, only_ocean / only * 100


def fmt(x, nd=1):
    s = f'{x:,.{nd}f}'
    return s[:-2] if nd == 1 and s.endswith('.0') else s


def texts(N):
    ages_old = ', '.join(fmt(a, 0) for a in N['old_maps_ma'][:-1]) + f" and {fmt(N['old_maps_ma'][-1], 0)}"
    no_clim = ', '.join(fmt(a, 0) for a in N['maps_without_climate_ma'][:-1]) + \
        f" and {fmt(N['maps_without_climate_ma'][-1], 0)}"
    intro = ('Earth’s History shows the planet at {n} moments from {oldest} million years ago to today, one per '
             'map in C. R. Scotese’s PALEOMAP PaleoAtlas. The maps are a reconstruction, the temperature and '
             'rain a climate model, the curves published fits; each is labeled as what it is. The cards and '
             'events were written for this app from {ns} published sources, cited beside the text. Nothing '
             'is fetched: every file ships inside the app.').format(
        n=N['n_maps'], oldest=fmt(N['oldest_map_ma'], 0), ns=N['story_sources'])
    reading = [
        {'id': 'reading-surface', 'title': 'The painted maps',
         'sources': ['paleoatlas'],
         'text': ('The Surface lens shows Scotese’s {n} maps, about {gap} million years apart back to {reg} '
                  'million years ago and then only at {old} million years ago. Each was drawn from the rock '
                  'record where it survives and inferred from the region’s tectonic history where it does not (atlas pp. 4–5). '
                  'His color key (pp. 7–8): dark blue deep ocean, light blue shelves and flooded continents, '
                  'green lowlands, tan plateaus and foothills, brown mountains, white the highest peaks.').format(
             n=N['n_maps'], gap=fmt(N['median_gap_ma'], 0), reg=fmt(N['regular_back_to_ma'], 0), old=ages_old)},
        {'id': 'reading-climate', 'title': 'Temperature and Rain',
         'sources': ['phanda'],
         'text': ('These lenses show a climate model’s annual means from {runs} runs, one every {step} million '
                  'years back to {oldest} million years ago, each on Scotese’s geography; a map uses the run '
                  'nearest its age. The maps at {nc} million years ago have no run, and the lenses say so.').format(
             runs=N['climate_runs'], step=fmt(N['climate_step_ma'], 0), oldest=fmt(N['climate_oldest_ma'], 0),
             nc=no_clim)},
        {'id': 'reading-plates', 'title': 'Plates',
         'sources': ['paleoatlas'],
         'text': ('Plates outlines pieces of today’s crust in Scotese’s plate model, {rings} outlines on {plates} '
                  'plates, where the model puts them at each map’s time; arrows show how they moved over the '
                  'million years before it. These are pieces of today’s crust, not plate boundaries.').format(
             rings=N['n_rings'], plates=N['n_plates'])},
        {'id': 'reading-coasts', 'title': 'Today’s coasts, cities and pins',
         'sources': ['naturalearth', 'paleoatlas'],
         'text': ('Today’s coastlines, the cities in Find and the Look-for pins are stored where they are now and '
                  'carried back with the plate they sit on. Where the model does not carry that crust back to a '
                  'map’s age, nothing is drawn and the readout says so.')},
        {'id': 'reading-curves', 'title': 'Curves and tiles',
         'sources': ['phanda', 'foster2017', 'vandermeer2022', 'paleodem'],
         'text': ('The strip under the slider shows the climate model’s global mean temperature, carbon dioxide '
                  '(Foster and colleagues’ fit to proxy measurements back to {co2} million years ago, then the '
                  'model’s input, dashed) and sea level relative to today (back to {sl} million years ago). The '
                  'tiles compare each map with today in the same source: the model’s own pre-industrial world at '
                  '{tf} °F ({tc} °C), the same curve at 0 Ma, and the same elevation model’s {land}% land.').format(
             co2=fmt(N['co2_fit_last_ma']), sl=N['sea_level_last_ma'], tf=fmt(N['today_temperature_f']),
             tc=fmt(N['today_temperature_c']), land=fmt(N['today_land_pct']))},
    ]
    caveats = [
        {'id': 'one-reconstruction', 'title': 'One reconstruction among several',
         'sources': ['paleoatlas', 'domeier2014'],
         'text': ('Every map, outline and rotation here comes from one reconstruction, Scotese’s PALEOMAP '
                  'atlas (2016). Other published reconstructions place the continents differently, and the '
                  'uncertainty grows with age, because the ocean floor that recorded older plate motions has '
                  'mostly been lost to subduction.')},
        {'id': 'first-draft', 'title': 'Elevations are a first draft',
         'sources': ['paleodem'],
         'text': ('The land and shallow-sea figures and the readout’s “what was there” come from Scotese and '
                  'Wright’s elevation models, which their report calls a “first draft” (p. {p}).').format(
             p=N['dem_first_draft_page'])},
        {'id': 'longitude', 'title': 'Longitude is the weak coordinate',
         'sources': ['vanhinsbergen2015'],
         'text': ('Magnetism frozen in rocks records how far from the pole they formed, not their longitude, so '
                  'east–west positions on the older maps are less certain than north–south ones.')},
        {'id': 'climate-model', 'title': 'Temperature and rain are a model',
         'sources': ['phanda'],
         'text': ('Temperature and rain come from a climate model (HadCM3L), not from measurements: one run per '
                  '{step} million years, each averaged over its last 100 model years and driven by a carbon '
                  'dioxide history. Temperature is the air’s, 1.5 m (5 ft) above the surface, over land and sea '
                  'alike; rain includes snow. Its pre-industrial world averages {tf} °F ({tc} °C); the tiles compare with '
                  'that, not with a thermometer record.').format(
             step=fmt(N['climate_step_ma'], 0), tf=fmt(N['today_temperature_f']), tc=fmt(N['today_temperature_c']))},
        {'id': 'co2', 'title': 'Carbon dioxide before {0} million years'.format(fmt(N['co2_fit_last_ma'])),
         'sources': ['foster2017', 'phanda'],
         'text': ('Older than {last} million years ago the curve is the carbon dioxide the climate model was run '
                  'with, a model input, not a fit to measurements. The band drawn is Foster’s 68% band; his '
                  '95% band is left out because its lower edge falls below zero in {rows} rows between {a} and '
                  '{b} million years ago.').format(
             last=fmt(N['co2_fit_last_ma']), rows=N['lo95_negative_rows'], a=fmt(N['lo95_negative_from_ma']),
             b=fmt(N['lo95_negative_to_ma']))},
        {'id': 'timescale', 'title': 'Two timescales',
         'sources': ['paleoatlas', 'ics'],
         'text': ('Map ages are Scotese’s, on the 2008 timescale his atlas uses. Names and colors come from '
                  'today’s ICS chart (version {v}); for {k} maps Scotese’s label and today’s chart disagree on '
                  'a boundary or a period, and the sheet says so for each.').format(v=N['ics_version'], k=N['ics_notes'])},
        {'id': 'motion', 'title': 'Motion and fades',
         'sources': ['paleoatlas'],
         'text': ('Arrows and speeds are the rotation model’s motion over the million years before each map. '
                  'Overlays are rotated to the map’s own time, which differs from its printed age by up to {g} '
                  'million years. Between maps the app cross-fades; it never draws an Earth between two of the '
                  '{n} maps.').format(g=fmt(N['max_rotation_minus_age_ma']), n=N['n_maps'])},
        {'id': 'ocean-floor', 'title': 'Today’s ocean floor has no past here',
         'sources': ['paleoatlas'],
         'text': ('Crust the model holds only for today covers {p}% of the globe, {o}% of it under today’s '
                  'oceans. A city or a tap on it has no position on older maps.').format(
             p=fmt(N['today_only_area_pct']), o=fmt(N['today_only_ocean_pct']))},
        {'id': 'sun', 'title': 'The Sun',
         'sources': ['gough1981'],
         'text': ('The Sun tile evaluates Gough’s (1981) formula for the young Sun’s slow brightening; at '
                  '{a} million years ago it gives {s}% of today’s brightness.').format(
             a=fmt(N['oldest_map_ma'], 0), s=fmt(N['sun_pct_oldest']))},
        {'id': 'display', 'title': 'Display choices',
         'sources': [],
         'text': ('The colors of the Temperature and Rain lenses, the globe’s shading, the bright rim at its '
                  'edge, its glow, the night behind it and the frame around the view are display choices, not data.')},
    ]
    not_shown = {
        'title': 'What this app does not show, and why',
        'text': ('Plate boundaries: no open set exists for Scotese’s model, and other models’ ridges and trenches '
                 'belong with their own continents, so drawing them here would mix two reconstructions. Anything '
                 'older than {oldest} million years beyond a short text: no map exists. The continents between '
                 'maps: that would be invented geography. Seasons, sea temperature and salinity: the app shows '
                 'annual air temperature and rain. Oxygen and biodiversity curves: no openly licensed series was '
                 'found. Climate for the maps at {nc} million years ago: no model run. Plate names: the model has '
                 'codes, not names. Ocean names: an ocean is not a plate, so there is nothing to pin a name to. '
                 'Relief in 3D, and zoom beyond the maps’ detail.').format(
            oldest=fmt(N['oldest_map_ma'], 0), nc=no_clim),
    }
    return intro, reading, caveats, not_shown


def software():
    req = []
    with open(os.path.join(TOOLS, 'requirements.txt'), encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and not line.startswith('pygplates'):
                req.append(line.replace('==', ' '))
    return ('No third-party code ships with this app. '
            # The two typefaces ship in fonts/; their credit is Template/anatomy/CREDITS.txt's, word for word.
            'Fonts: Atkinson Hyperlegible, Copyright 2020 Braille Institute of America, Inc.; Newsreader, '
            'Copyright 2020 The Newsreader Project Authors (github.com/productiontype/Newsreader). Both under the '
            'SIL Open Font License 1.1, whose text is fonts/OFL.txt, as clause 2 of that license requires. '
            'The build pipeline in tools/ runs at build time only, '
            'with pygplates (GPL-2.0), which reconstructs the plate model, and these Python packages: '
            + ', '.join(req) + '.')


# --- CREDITS.txt ----------------------------------------------------------------------------------------
def credits_text(blocks, story, soft):
    w = lambda s: textwrap.fill(s, WRAP, break_long_words=False, break_on_hyphens=False)
    L = ['Earth’s History — credits and licenses', '',
         w('Every dataset below was downloaded by the pipeline in tools/ from a pinned source and checked '
           f'against its sha256; the retrieval date is {RETRIEVED}. Licenses are quoted from the files and '
           'record pages kept in tools/credits/. The maps, plate model and elevation grids are C. R. '
           'Scotese’s; the climate fields are a climate model’s; every change this app made is listed under '
           'Adaptations. Nothing is fetched at run time.'), '']
    for b in blocks:
        L += ['', b['title'].upper()]
        for key, label in (('owner', 'Owner'), ('source', 'Source'), ('url', 'URL'), ('licence', 'License'),
                           ('licence_uri', 'License URI'), ('licence_quote', 'License text'),
                           ('retrieved', 'Retrieved'), ('adaptations', 'Adaptations'),
                           ('accuracy', 'Accuracy'), ('cite', 'Cite'), ('attribution', 'Attribution')):
            if b.get(key):
                L.append(w(f'{label}: {b[key]}'))
    L += ['', '', 'REFERENCES FOR THE TEXT',
          w('The period cards, events and pins were written for this app. They quote no text from these '
            'works; each number in them is mapped to one of them in data/story.json. Citations were checked '
            'against Crossref.'), '']
    for s in story['sources']:
        if s['id'] in ('ics', 'paleoatlas'):
            continue
        L.append(w(f"{s['cite']} doi:{s['doi']}" if s.get('doi') else s['cite']))
    for r in REFERENCES:
        if not any(s['id'] == r['id'] for s in story['sources']):
            L.append(w(f"{r['cite']} doi:{r['doi']}"))
    L += ['', '', 'SOFTWARE', w(soft), '']
    return '\n'.join(L).rstrip() + '\n'


def main():
    steps, frags = load_fragments()
    merged = merge(frags)
    merged['gough1981'] = gough_block()
    missing = [i for i in ORDER if i not in merged]
    if missing:
        sys.exit(f'no credits block for {missing}')
    blocks = [merged[i] for i in ORDER]
    for b in blocks:
        b['attribution'] = attribution(b)
        if b['licence'] == 'CC BY 4.0':
            for k in ('licence_uri', 'licence_quote', 'owner', 'adaptations'):
                if not b.get(k):
                    sys.exit(f"{b['id']}: a CC BY 4.0 block needs {k}")
    N = read_numbers()
    intro, reading, caveats, not_shown = texts(N)
    story = load('story.json')
    ids = set(ORDER) | {r['id'] for r in REFERENCES}
    for item in reading + caveats:
        for sid in item['sources']:
            if sid not in ids:
                sys.exit(f"{item['id']}: source {sid} does not resolve")
    soft = software()
    about = {
        'title': 'About Earth’s History', 'retrieved': RETRIEVED, 'version': '1.0',
        'intro': intro, 'reading': reading, 'caveats': caveats, 'not_shown': not_shown,
        'numbers': N,
        'sources': [{k: b[k] for k in ('id', 'title', 'owner', 'licence', 'licence_uri', 'source', 'url',
                                       'retrieved', 'adaptations', 'accuracy', 'cite', 'attribution')}
                    for b in blocks],
        'references': [{k: r[k] for k in ('id', 'cite', 'doi', 'access')} for r in REFERENCES],
        'software': {'text': soft},
    }
    shown = json.dumps([intro, reading, caveats, not_shown], ensure_ascii=False)
    if AI_NAMES.search(shown):
        sys.exit(f'about.json names an AI vendor or product: {AI_NAMES.search(shown).group(0)}')
    for bad in ('http', 'www.'):
        if bad in shown:
            sys.exit(f'about.json prose contains {bad!r}; URLs belong in the sources block only')
    atxt = json_text(about, 4)
    ctxt = credits_text(blocks, story, soft)
    na, nc = len(atxt.encode('utf-8')), len(ctxt.encode('utf-8'))
    if na > CAP_ABOUT:
        sys.exit(f'about.json would be {na:,} bytes, over {CAP_ABOUT:,} — nothing written')
    if nc > CAP_CREDITS:
        sys.exit(f'CREDITS.txt would be {nc:,} bytes, over {CAP_CREDITS:,} — nothing written')
    for sid, must in (('naturalearth', 'Made with Natural Earth.'),
                      ('ics', '© International Commission on Stratigraphy, 2026')):
        if must not in ' '.join(ctxt.split()) or must not in atxt:
            sys.exit(f'{sid}: the required attribution {must!r} is missing')
    if ctxt.count('CC BY 4.0') < 6:
        sys.exit('CREDITS.txt: fewer CC BY 4.0 mentions than CC BY sources')
    write_json('about.json', about, ndigits=4)
    with open(os.path.join(APP, 'CREDITS.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(ctxt)

    print(f'fragments read: {", ".join(steps)} ({len(frags)} blocks) → {len(blocks)} sources: {", ".join(ORDER)}')
    for b in blocks:
        print(f"  {b['id']:15s} {b['licence'][:40]:40s} parts from {b['steps'] or ['sources.CITED']}")
    print(f'about.json: {na:,} bytes (budget {CAP_ABOUT:,}); reading {len(reading)}, caveats {len(caveats)}, '
          f'references {len(REFERENCES)}')
    print(f'CREDITS.txt: {nc:,} bytes (budget {CAP_CREDITS:,}), {ctxt.count(chr(10)):,} lines, '
          f'{len(story["sources"]) - 2 + sum(1 for r in REFERENCES if not any(s["id"] == r["id"] for s in story["sources"]))} text references')
    print('numbers quoted by the About text, read from data/:')
    for k, v in N.items():
        print(f'  {k:28s} {v}')


if __name__ == '__main__':
    main()
