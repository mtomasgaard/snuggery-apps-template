"""The last check of the pipeline (tools/CONTRACT.md §0, §13, §14): runs every step's verify script,
then the checks that span files.

    - data/ holds exactly the claimed files: a stray file (one no step claims, a .DS_Store included)
      or a missing one fails, naming the step that claims it;
    - every byte cap in §13, the data/ total and ../CREDITS.txt;
    - every .bin agrees with its sibling .json: sections 4-byte aligned, inside the file, the file
      exactly as long as its layout implies;
    - the one-plate-model rule: plates.json's two files are byte-for-byte the pinned atlas zip's, and
      every plate index and id in plates.bin, coast.bin, places.json and story.json's pins is in
      plates.json.plates (and index and id name the same plate);
    - land and shelf %: curves.json, elevation.json, manifest.json and about.json agree (one
      function, geo.paleodem_land_shelf(), made them all), and so do the temperatures;
    - CREDITS.txt and about.json credit the PaleoDEM report the About text quotes by page;
    - no URL in the app's own code (index.html, style.css, js/*.js, once they exist) and no AI vendor
      or product name in any shipped text file.

    .venv/bin/python verify_data.py              every verify script, then the cross-file checks
    .venv/bin/python verify_data.py --cross-only only the cross-file checks (build_all.sh has just
                                                 run each step's verify after its step)
"""
import json
import os
import re
import subprocess
import sys

from geo import POLY_NAME, ROT_NAME, plate_model_files, read_section
from paths import APP, DATA, TOOLS
from story_check import AI_NAMES

STEP_VERIFIES = ['verify_surface.py', 'verify_plates.py', 'verify_climate.py', 'verify_elevation.py',
                 'verify_curves.py', 'verify_timescale.py', 'verify_story.py', 'verify_manifest.py']

# CONTRACT §13: (cap, exact) per claimed file, and the step that writes it.
FILES = {
    'manifest.json': (60_000, False, '10_surface.py, 80_manifest.py'),
    'surface/proxy.webp': (480_000, False, '10_surface.py'),
    'plates.bin': (520_000, False, '20_plates.py'),
    'plates.json': (10_000, False, '20_plates.py'),
    'coast.bin': (300_000, False, '20_plates.py'),
    'coast.json': (4_000, False, '20_plates.py'),
    'places.json': (40_000, False, '20_plates.py'),
    'climate.bin': (1_527_744, True, '30_climate.py'),
    'climate.json': (30_000, False, '30_climate.py'),
    'elevation.bin': (1_785_420, True, '35_elevation.py'),
    'elevation.json': (20_000, False, '35_elevation.py'),
    'curves.json': (80_000, False, '40_curves.py'),
    'timescale.json': (40_000, False, '50_timescale.py'),
    'story.json': (60_000, False, '60_story.py'),
    'about.json': (40_000, False, '90_about.py'),
}
MAP_CAP, MAPS_CAP, TOTAL_CAP, CREDITS_CAP = 110_000, 5_000_000, 11_000_000, 40_000
SIZES = {'uint8': 1, 'int16': 2, 'uint16': 2, 'uint32': 4, 'float32': 4}
URL = re.compile(r'https?://', re.IGNORECASE)
ERRORS = []


def fail(msg):
    ERRORS.append(msg)
    print(f'  FAIL {msg}')


def load(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


def run_step_verifies():
    for v in STEP_VERIFIES:
        print(f'\n== {v}')
        r = subprocess.run([sys.executable, v], cwd=TOOLS)
        if r.returncode != 0:
            sys.exit(f'{v} failed (exit {r.returncode})')


def claimed_files():
    man = load('manifest.json')
    maps = [s['file'] for s in man['slices']]
    assert len(maps) == len(set(maps)) == 90
    return maps


def check_files(maps):
    present = set()
    for dp, _dn, fn in os.walk(DATA):
        for f in fn:
            present.add(os.path.relpath(os.path.join(dp, f), DATA).replace(os.sep, '/'))
    claimed = set(FILES) | set(maps)
    for f in sorted(present - claimed):
        fail(f'data/{f} is claimed by no step (CONTRACT §0) — delete it or add it to the contract')
    for f in sorted(claimed - present):
        who = FILES[f][2] if f in FILES else '10_surface.py'
        fail(f'data/{f} is missing (written by {who})')
    total = 0
    for f in sorted(present & claimed):
        nb = os.path.getsize(os.path.join(DATA, f))
        total += nb
        if f in FILES:
            cap, exact, _who = FILES[f]
            if (exact and nb != cap) or nb > cap:
                fail(f'data/{f}: {nb:,} bytes, {"must be exactly" if exact else "cap"} {cap:,}')
        elif nb > MAP_CAP:
            fail(f'data/{f}: {nb:,} bytes > {MAP_CAP:,}')
    maps_total = sum(os.path.getsize(os.path.join(DATA, f)) for f in maps if f in present)
    if maps_total > MAPS_CAP:
        fail(f'the 90 maps are {maps_total:,} bytes > {MAPS_CAP:,}')
    if total > TOTAL_CAP:
        fail(f'data/ is {total:,} bytes > {TOTAL_CAP:,}')
    cr = os.path.getsize(os.path.join(APP, 'CREDITS.txt'))
    if cr > CREDITS_CAP:
        fail(f'CREDITS.txt {cr:,} bytes > {CREDITS_CAP:,}')
    print(f'files: {len(present)} in data/ = {len(FILES)} fixed names + {len(maps)} maps, none stray, none '
          f'missing; every cap in §13 held')
    print(f'sizes: data/ {total:,} bytes (cap {TOTAL_CAP:,}); the 90 maps {maps_total:,}; '
          f'CREDITS.txt {cr:,}')
    for f in sorted(FILES):
        if f in present:
            print(f'  {f:20s} {os.path.getsize(os.path.join(DATA, f)):>11,}  (cap {FILES[f][0]:,}'
                  f'{", exact" if FILES[f][1] else ""})')
    return total


def check_layouts():
    for name in ('plates', 'coast'):
        raw = open(os.path.join(DATA, f'{name}.bin'), 'rb').read()
        secs = load(f'{name}.json')['sections']
        end = 0
        for k, s in sorted(secs.items(), key=lambda kv: kv[1]['offset']):
            if s['offset'] % 4 or s['offset'] < end:
                fail(f'{name}.bin section {k} at {s["offset"]} is misaligned or overlaps')
            end = s['offset'] + s['count'] * SIZES[s['type']]
        if end != len(raw):
            fail(f'{name}.bin is {len(raw):,} bytes, its layout ends at {end:,}')
    cl, el = load('climate.json'), load('elevation.json')
    if 2 * cl['count'] * cl['slice_bytes'] != os.path.getsize(os.path.join(DATA, 'climate.bin')):
        fail('climate.bin size != 2 fields x count x slice_bytes')
    if el['count'] * el['slice_bytes'] != os.path.getsize(os.path.join(DATA, 'elevation.bin')):
        fail('elevation.bin size != count x slice_bytes')
    print('layouts: plates.bin and coast.bin end exactly where their sections say, every section '
          '4-byte aligned; climate.bin and elevation.bin exactly count x slice bytes')


def check_one_plate_model():
    pl = load('plates.json')
    files = plate_model_files()
    if pl['rotation_file'] != ROT_NAME or pl['rotation_sha256'] != files[ROT_NAME][1]:
        fail('plates.json rotation file is not the pinned atlas zip\'s PALEOMAP_PlateModel.rot')
    if pl['polygons_file'] != POLY_NAME or pl['polygons_sha256'] != files[POLY_NAME][1]:
        fail('plates.json polygons are not the pinned atlas zip\'s PALEOMAP_PlatePolygons.gpml')
    ids = pl['plates']
    P = len(ids)
    if ids != sorted(set(ids)):
        fail('plates.json.plates is not sorted and unique')
    raw = open(os.path.join(DATA, 'plates.bin'), 'rb').read()
    rp = read_section(raw, pl['sections']['ring_plate'])
    craw = open(os.path.join(DATA, 'coast.bin'), 'rb').read()
    cj = load('coast.json')
    sp = read_section(craw, cj['sections']['seg_plate'])
    if int(rp.max()) >= P or int(sp.max()) >= P:
        fail('a plate index in plates.bin or coast.bin is outside plates.json.plates')
    if len(set(int(x) for x in sp)) != cj['plates_used']:
        fail('coast.json plates_used disagrees with coast.bin')
    n_ids = 0
    places = load('places.json')['places']
    pins = load('story.json')['look_for']
    for kind, xs in (('place', places), ('pin', pins)):
        for x in xs:
            n_ids += 1
            if x['plate'] not in ids or not (0 <= x['pi'] < P) or ids[x['pi']] != x['plate']:
                fail(f'{kind} {x.get("n") or x.get("id")}: plate {x["plate"]} / index {x["pi"]} is not '
                     'one plate of plates.json')
    print(f'one plate model: plates.json names the pinned zip\'s rotation file ({pl["rotation_sha256"][:12]}…) '
          f'and polygons ({pl["polygons_sha256"][:12]}…); {len(rp)} rings, {len(sp):,} coast pieces, '
          f'{len(places)} places and {len(pins)} pins all on its {P} plates')


def check_land_and_climate():
    cur = load('curves.json')['series']
    el, cl, man, ab = load('elevation.json'), load('climate.json'), load('manifest.json'), load('about.json')
    worst_c = worst_t = 0.0
    for s in el['slices']:
        a = int(s['plate_age_ma'])
        worst_c = max(worst_c, abs(cur['land_pct']['values'][a] - s['land_pct']),
                      abs(cur['shelf_pct']['values'][a] - s['shelf_pct']))
    for s in cl['slices']:
        a = int(s['plate_age_ma'])
        worst_t = max(worst_t, abs(cur['temperature_c']['values'][a] - s['global_mean_c']))
    # curves.json has 3 decimals, elevation.json and climate.json 4: at most 0.0005 + 0.00005 apart.
    if worst_c > 0.00055 + 1e-9:
        fail(f'curves.json land/shelf % differ from elevation.json by {worst_c}')
    if worst_t > 0.00055 + 1e-9:
        fail(f'curves.json temperature differs from climate.json by {worst_t}')
    u = man['units']
    e0 = el['slices'][0]
    if (u['today_land_pct'], u['today_shelf_pct']) != (round(e0['land_pct'], 2), round(e0['shelf_pct'], 2)):
        fail('manifest.json units disagree with elevation.json slice 0')
    worst_m = 0.0
    for s in man['slices']:
        if s['elevation'] is not None:
            ev = el['slices'][s['elevation']]
            worst_m = max(worst_m, abs(s['tiles']['land']['land_pct'] - ev['land_pct']),
                          abs(s['tiles']['land']['shelf_pct'] - ev['shelf_pct']))
    if worst_m > 0.005 + 1e-9:
        fail(f'manifest land tiles differ from elevation.json by {worst_m}')
    if abs(ab['numbers']['today_land_pct'] - e0['land_pct']) > 1e-9:
        fail('about.json today_land_pct differs from elevation.json slice 0')
    if abs(ab['numbers']['today_temperature_c'] - cl['slices'][0]['global_mean_c']) > 1e-9:
        fail('about.json today_temperature_c differs from climate.json slice 0')
    print(f'land/shelf %: curves.json within {worst_c:.5f} of elevation.json at all 109 plate ages '
          f'(3 vs 4 decimals); manifest tiles within {worst_m:.5f} (2 decimals); units and about.json equal '
          f'at 0 Ma ({e0["land_pct"]} % land, {e0["shelf_pct"]} % shelf)')
    print(f'temperature: curves.json within {worst_t:.5f} of climate.json at all 109 plate ages')


def check_credits():
    ctxt = open(os.path.join(APP, 'CREDITS.txt'), encoding='utf-8').read()
    ab = load('about.json')
    dem = next(s for s in ab['sources'] if s['id'] == 'paleodem')
    report = 'Scotese_Wright2018_PALEOMAP_PaleoDEMs.pdf'
    flat = ' '.join(ctxt.split())
    if report not in flat or report not in dem['source']:
        fail(f'CREDITS.txt or about.json does not name {report}, which the "first draft" caveat quotes')
    zipname = 'Scotese_Wright_2018_Maps_1-88_1degX1deg_PaleoDEMS_nc.zip'
    urls = dem['url'].split(' ; ')
    if dem['source'].count(zipname + ' (sha256') != 1 or len(urls) != len(set(urls)):
        fail('the merged paleodem block repeats its zip or a URL')
    if 'Elevation classes:' not in dem['adaptations']:
        fail('the paleodem credits block lacks step 35\'s adaptations (rerun 90_about.py after 35_elevation.py)')
    cav = next(c for c in ab['caveats'] if c['id'] == 'first-draft')
    page = ab['numbers']['dem_first_draft_page']
    if f'(p. {page})' not in cav['text'] or f'p. {page})' not in dem['source']:
        fail('the "first draft" caveat and the paleodem source disagree on the page')
    print(f'credits: the paleodem block names {report} and p. {page}, and carries step 35\'s adaptations')


def check_text():
    code = []
    for dp, dn, fn in os.walk(APP):
        rel = os.path.relpath(dp, APP)
        dn[:] = [d for d in dn if not (rel == '.' and d in ('tools', 'data', 'screenshots', 'dist'))
                 and not d.startswith('.') and d != 'node_modules']
        for f in fn:
            if f.endswith(('.html', '.css', '.js', '.mjs')):
                code.append(os.path.join(dp, f))
    for p in code:
        t = open(p, encoding='utf-8').read()
        if URL.search(t):
            fail(f'{os.path.relpath(p, APP)} contains a URL (CONTRACT §0: none in the app\'s own code)')
    shipped = [os.path.join(APP, 'CREDITS.txt')] + [os.path.join(DATA, f) for f in FILES if f.endswith('.json')]
    shipped += code
    for p in shipped:
        m = AI_NAMES.search(open(p, encoding='utf-8').read())
        if m:
            fail(f'{os.path.relpath(p, APP)} names an AI vendor or product ({m.group(0)!r})')
    print(f'text: {len(code)} app code files scanned for URLs (none yet exist before the app is built)'
          if not code else f'text: {len(code)} app code files, no URL')
    print(f'text: {len(shipped)} shipped text files, no AI vendor or product name')


def main():
    if '--cross-only' not in sys.argv[1:]:
        run_step_verifies()
        print('\n== verify_data: cross-file checks')
    maps = claimed_files()
    check_files(maps)
    check_layouts()
    check_one_plate_model()
    check_land_and_climate()
    check_credits()
    check_text()
    if ERRORS:
        sys.exit(f'verify_data: {len(ERRORS)} failure(s)')
    print('verify_data: OK')


if __name__ == '__main__':
    main()
