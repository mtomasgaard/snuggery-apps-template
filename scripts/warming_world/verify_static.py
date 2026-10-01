#!/usr/bin/env python3
"""Check every static file Warming World ships against warming-world/tools/CONTRACT.md §5 and §8.3,
independently of build_static.py: it decodes what was written and re-reads the sources itself.

    .venv/bin/python verify_static.py

Checks, in order, one printed line each; exits 1 on the first failure:
  1. world.json: keys in order, units, every ring ≥ 4 points and closed, every line ≥ 2 points,
     every decoded coordinate within ±180 / ±90; land polygon count against Natural Earth's; every
     lake ≥ 5 000 km² by its own area formula (the shoelace on an equal-area projection, not
     build_static's spherical excess).
  2. places.json: 1 251 entries in Natural Earth's order of tiers, the fields, the tier counts
     recomputed from the source's scalerank, sorted by tier then name.
  3. about.json: DESIGN §3.6's nine sections in order, no unknown placeholder, every quotation (“…”)
     found verbatim in credits/gistemp-page-and-faq.txt, the SI rule (no comma or plain space between
     digit groups or before a unit), and every number the prose types re-derived from the demo snapshot
     (CLAIMS below), so a sentence that stops being true fails the build.
  4. CREDITS.txt: the attribution line, both GISS citations as the demo snapshot carries them, the
     endorsement sentence, Natural Earth's credit and the font's licence.
  5. fonts/: exactly archivo-ww.woff2 and OFL.txt, matching sources.ARCHIVO.
  6. budgets (CONTRACT §7), nothing unclaimed in assets/, no AI vendor name and no control character
     in any file checked, no web address in about.json outside the static sources' url fields.
Standard library only.
"""
import base64
import json
import math
import os
import re
import sys
import unicodedata
import zlib

from common import sha256_of
from paths import APP, ASSETS, CACHE, HERE
from sources import ARCHIVO, GISTEMP, STATIC

CAPS = {'world.json': 420_000, 'places.json': 70_000, 'about.json': 40_000, 'CREDITS.txt': 30_000}
SECTIONS = ['colors', 'sources', 'coverage', 'partial', 'rounding', 'revisions', 'not-shown', 'citations', 'this-copy']
PLACEHOLDER = re.compile(r'\{([^{}]+)\}')
KNOWN = re.compile(r'^(coverage:(\d{4}|last)|lastComplete|partialLabel|newestMonth|releaseCreated|accessed|firstYear)$')
VENDORS = re.compile(r'\b(Claude|Anthropic|OpenAI|ChatGPT|GPT-\d|Gemini|Copilot|Llama|Mistral|Bard)\b')
NNBSP = ' '
# The on-screen credit, pinned verbatim (U+202F before °C, DESIGN §2): sources.GISTEMP['attribution'], the
# snapshot and CREDITS.txt must carry exactly these bytes, so a change to the wording is made here too.
ATTRIBUTION = ('Temperature: NASA GISS Surface Temperature Analysis (GISTEMP v4); annual means and '
               '0.1\u202f°C rounding by this app.')


class Fail(Exception):
    pass


def ok(msg):
    print(f'ok    {msg}', flush=True)


def check(cond, msg):
    if not cond:
        raise Fail(msg)


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def decode(e):
    pts, x, y = [], 0, 0
    for i in range(0, len(e), 2):
        x, y = (e[i], e[i + 1]) if i == 0 else (x + e[i], y + e[i + 1])
        pts.append((x / 100, y / 100))
    return pts


def area_km2(pts):
    """Shoelace on Lambert's cylindrical equal-area projection (x = R λ, y = R sin φ): exact for
    the polygon whose edges are straight in that projection, within a fraction of a percent of the
    spherical area for a lake."""
    R = 6371.0
    a = 0.0
    for (l1, p1), (l2, p2) in zip(pts, pts[1:] + pts[:1]):
        a += math.radians(l1) * R * math.sin(math.radians(p2)) * R - math.radians(l2) * R * math.sin(math.radians(p1)) * R
    return abs(a) / 2


# ---------------------------------------------------------------------------------------------

def check_world():
    path = os.path.join(ASSETS, 'world.json')
    w = load(path)
    check(list(w) == ['v', 'source', 'units', 'land', 'borders', 'lakes'], f'world.json keys {list(w)}')
    check(w['v'] == 1 and w['units'] == 'hundredths of a degree, delta-encoded [lon0, lat0, dlon, dlat, ...]',
          'world.json v or units')
    check('Natural Earth 1:50m v5.1.2' in w['source'], 'world.json source')
    n_rings = n_pts = 0
    for group in ('land', 'lakes'):
        for poly in w[group]:
            check(poly, f'{group}: an empty polygon')
            for e in poly:
                check(len(e) % 2 == 0 and all(isinstance(v, int) for v in e), f'{group}: a ring is not int pairs')
                p = decode(e)
                check(len(p) >= 4, f'{group}: a ring of {len(p)} points')
                check(p[0] == p[-1], f'{group}: a ring that does not close')
                check(all(-180 <= x <= 180 and -90 <= y <= 90 for x, y in p), f'{group}: a point out of range')
                n_rings += 1
                n_pts += len(p)
    for e in w['borders']:
        p = decode(e)
        check(len(p) >= 2 and all(-180 <= x <= 180 and -90 <= y <= 90 for x, y in p), 'borders: a bad line')
        n_pts += len(p)
    src = load(os.path.join(CACHE, STATIC['ne_land']['name']))
    n_src = sum(1 if f['geometry']['type'] == 'Polygon' else len(f['geometry']['coordinates']) for f in src['features'])
    check(n_src - 5 <= len(w['land']) <= n_src, f'land: {len(w["land"])} polygons against {n_src} in Natural Earth')
    lake_areas = sorted(area_km2(decode(p[0])[:-1]) - sum(area_km2(decode(h)[:-1]) for h in p[1:]) for p in w['lakes'])
    check(lake_areas[0] >= 4900, f'lakes: the smallest is {lake_areas[0]:.0f} km² by the shoelace (want ≥ 5 000, 2 % slack)')
    size = os.path.getsize(path)
    ok(f'world.json: land {len(w["land"])} polygons (Natural Earth has {n_src}), borders {len(w["borders"])}, '
       f'lakes {len(w["lakes"])} (smallest {lake_areas[0]:,.0f} km², largest {lake_areas[-1]:,.0f} km² by the shoelace); '
       f'{n_rings} rings closed and ≥ 4 points, {n_pts:,} points in range; {size:,} B ≤ {CAPS["world.json"]:,}')
    check(size <= CAPS['world.json'], 'world.json over its cap')


def check_places():
    path = os.path.join(ASSETS, 'places.json')
    pl = load(path)
    src = load(os.path.join(CACHE, STATIC['ne_places']['name']))['features']
    check(len(pl) == len(src) == 1251, f'places: {len(pl)} entries, Natural Earth {len(src)}, contract 1 251')
    want = {}
    for f in src:
        lon, lat = f['geometry']['coordinates'][:2]
        sr = int(f['properties']['scalerank'])
        r = 1 if sr == 0 else 2 if sr <= 2 else 3 if (sr == 3 or abs(lat) >= 60) else 4
        want[r] = want.get(r, 0) + 1
    got = {}
    for d in pl:
        check(list(d) == ['n', 'lon', 'lat', 'r'], f'places: keys {list(d)}')
        check(isinstance(d['n'], str) and d['n'] == ' '.join(d['n'].split()) and d['n'], f'places: name {d["n"]!r}')
        check(-180 <= d['lon'] <= 180 and -90 <= d['lat'] <= 90 and round(d['lon'], 2) == d['lon'], f'places: {d}')
        got[d['r']] = got.get(d['r'], 0) + 1
    check(got == want, f'places: tiers {got}, recomputed {want}')
    check(got[1] == 27 and got[2] == 159, f'places: tiers 1 and 2 are {got[1]} and {got[2]}, the contract measured 27 and 159')
    check(pl == sorted(pl, key=lambda d: (d['r'], d['n'], d['lon'], d['lat'])), 'places: not sorted by tier, then name')
    names = {d['n'] for d in pl}
    check({'Fairbanks', 'Longyearbyen', 'McMurdo Station'} <= names, 'places: Fairbanks, Longyearbyen or McMurdo missing')
    size = os.path.getsize(path)
    check(size <= CAPS['places.json'], 'places.json over its cap')
    ok(f'places.json: {len(pl)} places, tiers {dict(sorted(got.items()))} (recomputed from scalerank), sorted; '
       f'{size:,} B ≤ {CAPS["places.json"]:,}')


# ---------------------------------------------------------------------------------------------
# the demo snapshot, decoded here with this file's own code, for the About claims
# ---------------------------------------------------------------------------------------------

def frames_of(snap):
    out = {}
    for s in snap['steps']:
        out[str(s['year'])] = zlib.decompress(base64.b64decode(s['planes']['anom.v']))
    for m in snap['months']:
        out[m['month']] = zlib.decompress(base64.b64decode(m['planes']['anom.v']))
    return out


def rows_share(b, j0, j1):
    cells = b[j0 * 180:(j1 + 1) * 180]
    return sum(x != 255 for x in cells) / len(cells)


def area_share(b, j0, j1):
    """The share of rows j0…j1's area that has a value: each cell weighted by cos of its row's centre
    latitude, as the app's pole reading weighs it (js/data.js capMean's share)."""
    have = every = 0.0
    for j in range(j0, j1 + 1):
        wt = math.cos(math.radians(89 - 2 * j))
        every += 180 * wt
        have += sum(x != 255 for x in b[j * 180:(j + 1) * 180]) * wt
    return have / every


def whole_percent(share):
    """js/units.js percent(): ten-thousandths rounded, then a whole percent half away from zero."""
    k = math.floor(share * 10000 + 0.5)
    return (2 * k + 100) // 200


SENTENCES = {
    # claim id -> the exact words of about.json the check stands behind (U+202F as written there)
    'arctic': 'every cell has a value in every year from 1946 on, and in some years from 1931',
    'antarctic': 'the share of the area with data jumps from 38\u202f% in 1955 to 93\u202f% in 1957',
    'antarctic-reading': 'The map’s Antarctic reading gives the same shares.',
    'gray2025': 'In 2025 nearly all the gray cells lie between 54° S and 70° S',
    'partial': 'In 2025, the January–July map differed from the full year’s by about 0.3\u202f°C per cell',
    'hundredths': 'can differ from them by a few hundredths of a degree',
    'rules': 'at least 9 of the 12 months',
    'six': 'once at least 6 are out',
    'quarters': 'at least three quarters of those months',
    'stations': 'about 26\u202f000 weather stations',
}


def claims(snap, prose):
    """Every number the About prose types, re-derived from the demo snapshot, and the sentence that
    states it found word for word. Returns printable lines; raises Fail."""
    for cid, words in SENTENCES.items():
        check(words in prose, f'about.json no longer says, word for word, what claim "{cid}" checks: {words!r}')
    F = frames_of(snap)
    out = []
    complete = [s['year'] for s in snap['steps'] if not s['partial']]
    # Arctic: rows 0–12 (90–64° N) all with data in every complete year from 1946, first in 1931
    sh = {y: rows_share(F[str(y)], 0, 12) for y in complete}
    first_full = min(y for y in complete if sh[y] == 1.0)
    always_from = min(y for y in complete if all(sh[z] == 1.0 for z in complete if z >= y))
    check(first_full == 1931 and always_from == 1946,
          f'claim "every cell … in every year from 1946 on, and in some years from 1931": first full year '
          f'{first_full}, full every year from {always_from}')
    gaps = [y for y in complete if first_full <= y < always_from and sh[y] < 1.0]
    out.append(f'north of 64° N: every cell has data first in {first_full}, in every complete year from {always_from}; '
               f'gaps between in {gaps}; 1880 {sh[1880]:.1%}')
    # Antarctic: rows 77–89 (64–90° S), by area as the Antarctic reading measures it: 38 % in 1955, 93 % in
    # 1957. The cell shares (29 % and 96 %) stay in RESEARCH.md as the research record.
    a55, a57 = area_share(F['1955'], 77, 89), area_share(F['1957'], 77, 89)
    c55, c57 = rows_share(F['1955'], 77, 89), rows_share(F['1957'], 77, 89)
    check(whole_percent(a55) == 38 and whole_percent(a57) == 93,
          f'claim "the share of the area with data jumps from 38 % in 1955 to 93 % in 1957": measured {a55:.4f} '
          f'and {a57:.4f}')
    out.append(f'south of 64° S: the area with data {a55:.4f} in 1955, {a57:.4f} in 1957 (prose: 38 % and 93 %, '
               f'as the Antarctic reading prints them); by cells {c55:.3f} and {c57:.3f} (RESEARCH.md: 29 % and 96 %)')
    # 2025's gray cells between 54° S and 70° S (rows 72–79)
    b = F['2025']
    gray = [k for k, x in enumerate(b) if x == 255]
    inside = sum(1 for k in gray if 72 <= k // 180 <= 79)
    check(gray and inside / len(gray) >= 0.95, f'claim "nearly all the gray cells lie between 54° S and 70° S": '
                                                f'{inside} of {len(gray)}')
    out.append(f'2025: {inside} of {len(gray)} gray cells lie in 54–70° S ({inside / len(gray):.1%}; prose: nearly all)')
    # 2025 January–July against the full year, from the month frames, ≥ 6 of 7 months
    months = [F.get(f'2025-{m:02d}') for m in range(1, 8)]
    check(all(months), 'the demo snapshot no longer holds January–July 2025: re-measure the partial-year sentence')
    diffs = []
    for k in range(16200):
        vs = [mb[k] - 127 for mb in months if mb[k] != 255]
        if len(vs) >= 6 and b[k] != 255:
            diffs.append(abs(sum(vs) / len(vs) / 10 - (b[k] - 127) / 10))
    mean_d = sum(diffs) / len(diffs)
    check(0.25 <= mean_d < 0.35, f'claim "about 0.3 °C per cell": measured {mean_d:.3f}')
    out.append(f'2025 Jan–Jul against the full year: mean |difference| {mean_d:.3f} °C over {len(diffs):,} cells '
               f'(from 0.1 °C months; prose: about 0.3)')
    # a mean of the map against GISS's table: "a few hundredths"
    worst = max(abs(s['gridMean'] - s['globalMean']) for s in snap['steps'] if not s['partial'])
    check(worst < 0.05, f'claim "a few hundredths": the largest difference is {worst:.3f} °C')
    out.append(f'gridMean against GISS\'s J-D: at most {worst:.3f} °C (prose: a few hundredths)')
    # the rules the prose states
    a = snap['annual']
    check(a['minMonths'] == 9 and a['partialMinMonths'] == 6 and a['partialCellShare'] == 0.75,
          f'the annual rules in the snapshot {a} differ from the prose (9 of 12, at least 6, three quarters)')
    out.append('rules: 9 of 12 months, at least 6 published, three quarters (the snapshot\'s "annual" block)')
    # about 26 000 stations: NCEI's own words
    with open(os.path.join(HERE, 'credits', 'ncei-ersst-ghcn.txt'), encoding='utf-8') as f:
        check('a total 26,000 monthly temperature stations' in f.read(), 'claim "about 26 000 stations" not in NCEI\'s text')
    out.append('about 26 000 stations: NCEI\'s "a total 26,000 monthly temperature stations" (credits/ncei-ersst-ghcn.txt)')
    return out


EXPECTED_NUMBERS = {
    # Every numeral the prose types outside a placeholder, and why it is there. A new number in the
    # prose fails until it is listed here and, if it is about the data, checked in claims().
    '2', '1951', '1980', '0.0', '4', '1.5', '30', '26 000', '5', '1 200', '64', '38', '1955',
    '93', '1957', '2025', '1946', '1931', '54', '70', '6', '0.3', '9', '12', '0.1', '24', '10', '2010', '2024', '1880', '1900',
    '1950',
}


def check_about(snap):
    path = os.path.join(ASSETS, 'about.json')
    ab = load(path)
    check(list(ab) == ['v', 'sections', 'static', 'endorsement'] and ab['v'] == 1, f'about.json keys {list(ab)}')
    check([s['id'] for s in ab['sections']] == SECTIONS, f'about.json sections {[s["id"] for s in ab["sections"]]}')
    with open(os.path.join(HERE, 'credits', 'gistemp-page-and-faq.txt'), encoding='utf-8') as f:
        evidence = ' '.join(f.read().split())
    n_quotes, n_ph = 0, 0
    numbers = set()
    for s in ab['sections']:
        check(list(s) == ['id', 'title', 'paragraphs'] and s['title'] and s['paragraphs'], f'section {s.get("id")}')
        for p in s['paragraphs'] + [s['title']]:
            for m in PLACEHOLDER.finditer(p):
                check(KNOWN.match(m.group(1)), f'unknown placeholder {{{m.group(1)}}} in {s["id"]}')
                n_ph += 1
            for q in re.findall(r'“([^”]+)”', p):
                if q == 'no change':
                    continue                               # the app's own phrase, not a quotation
                check(' '.join(q.split()) in evidence, f'quotation not found verbatim in the GISS evidence: {q[:60]!r}')
                n_quotes += 1
            bare = PLACEHOLDER.sub('', p)
            check(not re.search(r'\d,\d{3}\b', bare), f'a comma between digit groups in {s["id"]}: {bare[:80]!r}')
            check(not re.search(r'\d (\d{3}\b|°C|km|%)', bare), f'a plain space in a number or before a unit in {s["id"]}')
            check('http' not in bare, f'a web address in about.json prose ({s["id"]})')
            for q in re.findall(r'“[^”]+”', bare):
                bare = bare.replace(q, '')                 # numbers inside quotations are GISS's
            numbers |= set(re.findall(r'\d+(?:[. ]\d+)*', bare))
    unknown = numbers - EXPECTED_NUMBERS
    check(not unknown, f'about.json types numbers no check covers: {sorted(unknown)}')
    for st in ab['static']:
        check(list(st) == ['id', 'name', 'credit', 'licence', 'url'], f'static source keys {list(st)}')
    check([st['id'] for st in ab['static']] == ['natural-earth', 'archivo'], 'static sources')
    check(ab['endorsement'].startswith('NASA does not endorse this app.'), 'the endorsement sentence')
    size = os.path.getsize(path)
    check(size <= CAPS['about.json'], 'about.json over its cap')
    ok(f'about.json: {len(SECTIONS)} sections in DESIGN §3.6\'s order, {n_ph} placeholders all known, {n_quotes} '
       f'quotations verbatim in GISS\'s FAQ and page, SI spacing, {len(numbers)} distinct numerals all accounted for; '
       f'{size:,} B ≤ {CAPS["about.json"]:,}')
    prose = ' '.join(p for s in ab['sections'] for p in s['paragraphs'])
    for line in claims(snap, prose):
        ok(f'claim: {line}')


def check_credits(snap):
    path = os.path.join(APP, 'CREDITS.txt')
    with open(path, encoding='utf-8') as f:
        text = f.read()
    check(GISTEMP['attribution'] == ATTRIBUTION and snap['source']['attribution'] == ATTRIBUTION,
          f'the attribution is not the pinned sentence: sources.py {GISTEMP["attribution"]!r}, the snapshot '
          f'{snap["source"]["attribution"]!r}')
    # Wrapped lines joined with one space. U+202F is kept as it is (str.split() would turn it into a plain
    # space): textwrap breaks only at ASCII spaces, so a number and its unit are never split.
    flat = re.sub(r' *\n *', ' ', text)
    unspaced = re.findall(r'\d[ \n]+(?:°C|km|%)', text)
    check(not unspaced, f'CREDITS.txt has a plain space or a line break before a unit: {unspaced[:3]}')
    for need, what in [(ATTRIBUTION, 'the attribution line, verbatim with its U+202F'),
                       (snap['sources'][0]['citation'][0], 'the GISTEMP Team citation'),
                       (snap['sources'][0]['citation'][1], 'the Lenssen et al. 2024 citation'),
                       ('NASA does not endorse this app.', 'the endorsement sentence'),
                       ('Made with Natural Earth', 'Natural Earth\'s credit'),
                       ('SIL Open Font License 1.1', 'the font\'s licence'),
                       ('doi:10.1029/2010RG000345', 'Hansen et al. 2010'),
                       ('doi:10.1175/JCLI-D-18-0094.1', 'GHCNm v4'),
                       ('doi:10.7289/V5T72FNM', 'ERSST v5')]:
        check(need in flat, f'CREDITS.txt lacks {what}: {need[:60]!r}')
    if snap['release']['mode'] == 'research':
        check('Internet Archive capture' in flat, 'CREDITS.txt does not say the demo was read from the Internet Archive')
    size = len(text.encode('utf-8'))
    check(size <= CAPS['CREDITS.txt'], 'CREDITS.txt over its cap')
    ok(f'CREDITS.txt: the pinned attribution verbatim (U+202F before °C, as sources.py and the snapshot carry it), '
       f'both GISS citations (accessed {snap["release"]["retrieved"]}), the endorsement, the three inputs\' '
       f'citations, Natural Earth, Archivo; no plain space before °C, km or %; {size:,} B ≤ {CAPS["CREDITS.txt"]:,}')


def check_fonts():
    names = sorted(os.listdir(os.path.join(APP, 'fonts')))
    check(names == ['OFL.txt', 'archivo-ww.woff2'], f'fonts/ holds {names}')
    for rel, (size, sha) in ARCHIVO['files'].items():
        p = os.path.join(APP, rel)
        check(os.path.getsize(p) == size and sha256_of(p) == sha, f'{rel} does not match sources.ARCHIVO')
    ok(f'fonts/: exactly {names}, both matching their size and sha256 pins')


def check_shipped_text():
    names = sorted(n for n in os.listdir(ASSETS) if not n.startswith('.'))
    check(names == ['about.json', 'places.json', 'world.json'], f'assets/ holds {names}: something unclaimed')
    total = 0
    for p in [os.path.join(ASSETS, n) for n in names] + [os.path.join(APP, 'CREDITS.txt')]:
        with open(p, encoding='utf-8') as f:
            t = f.read()
        total += len(t.encode('utf-8'))
        check(not VENDORS.search(t), f'{os.path.basename(p)} names an AI vendor')
        check(unicodedata.normalize('NFC', t) == t, f'{os.path.basename(p)} is not NFC')
        check(not re.search(r'[\x00-\x09\x0b-\x1f\x7f]', t), f'{os.path.basename(p)} has a control character')
    ok(f'assets/ holds exactly {names}; with CREDITS.txt {total:,} B of text, NFC, no control characters, '
       'no AI vendor names')


def main():
    snap = load(os.path.join(APP, 'data', 'snapshot.json'))
    try:
        check_world()
        check_places()
        check_about(snap)
        check_credits(snap)
        check_fonts()
        check_shipped_text()
    except Fail as e:
        print(f'FAIL  {e}', flush=True)
        return 1
    print('verify_static: all checks passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
