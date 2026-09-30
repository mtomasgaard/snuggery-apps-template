"""Step 35 — PaleoDEM elevation classes for the readout: data/elevation.bin + data/elevation.json.

Reads the 109 1-degree PaleoDEM grids of Scotese & Wright 2018 (pinned zip), keyed by the Plate Model
Age in the zip's interval CSV through geo.paleodem_grids() (never by the age in the file name: two are
fractional, 385.2 and 390.5). Each grid's nodes are sorted into the ten elevation classes of Scotese's
Table 2 (atlas PDF p. 42, after Ziegler et al. 1985); every second node ships, a 2-degree grid of one
byte per node. Land % and shelf % come from geo.paleodem_land_shelf() on the full 1-degree grid — the
same function 40_curves.py calls — so the curves, the tiles and this file cannot disagree.
Layout: tools/CONTRACT.md §7.

Provenance checked on every build, nothing typed from memory:
  - the class edges are parsed from Table 2 in the atlas PDF (pinned atlas zip) and must equal
    geo.DEM_EDGES;
  - the report Scotese_Wright2018_PALEOMAP_PaleoDEMs.pdf (pinned) must say "first draft" on p. 7,
    the page about.json's caveat quotes.

Also writes tools/work/elevation.json: which elevation slice each of the 90 maps uses (the nearest
Plate Age to the map's file_age_ma within 2.5 Myr, else none; CONTRACT §1), for step 80.

    .venv/bin/python 35_elevation.py
"""
import io
import logging
import os
import re
import zipfile

import numpy as np

from common import RETRIEVED, json_text, write_bin, write_fragment, write_json, write_work
from geo import (DEM_EDGES, atlas_zip, paleodem_grids, paleodem_land_shelf, paleodem_z, read_slices,
                 source)
from paths import TOOLS
from sources import SOURCES

NSLICE = 109
NX, NY = 180, 91                      # 2-degree nodes: lon -180..178, lat 90..-90
SLICE_BYTES = NX * NY                 # 16,380
BIN_BYTES = NSLICE * SLICE_BYTES      # 1,785,420 (CONTRACT §7)
CAP_JSON = 20_000
MATCH_MYR = 2.5
NODATA = 255
ATLAS_PDF = 'Scotese PaleoAtlas_v3/PALEOMAP PaleoAtlas for GPlates v3.pdf'
TABLE2_PAGE = 42                      # printed page number = PDF page index + 1
REPORT_DRAFT_PAGE = 7                 # the page about.json's "first draft" caveat quotes
M_PER_FT = 0.3048

# Scotese's Table 2 environments, named by depth or height (DESIGN §8), code order.
NAMES = ['ocean trench', 'deep ocean floor', 'deep sea', 'outer shelf sea', 'shallow sea', 'lowland',
         'hills and plateaus', 'highlands', 'mountains', 'high mountains']


def ft(m):
    """Metres to feet, rounded as the contract's table writes them: to 100 ft from 1,000 ft up,
    else to 10 ft."""
    f = abs(m) / M_PER_FT
    return int(round(f / 100.0) * 100) if f >= 1000 else int(round(f / 10.0) * 10)


def n(x):
    return f'{x:,}'


def code_names():
    """[{code, z_min, z_max, name, name_us, name_metric}] from DEM_EDGES (CONTRACT §7's table)."""
    e = DEM_EDGES
    out = []
    for c in range(len(e) + 1):
        lo = e[c - 1] if c > 0 else None          # z > lo
        hi = e[c] if c < len(e) else None         # z <= hi
        name = NAMES[c]
        if hi is not None and hi <= 0 and lo is None:
            us, me = f'deeper than {n(ft(hi))} ft', f'deeper than {n(-hi)} m'
        elif hi == 0:
            us, me = f'under {n(ft(lo))} ft deep', f'under {n(-lo)} m deep'
        elif hi is not None and hi < 0:
            us, me = f'{n(ft(hi))}–{n(ft(lo))} ft deep', f'{n(-hi)}–{n(-lo)} m deep'
        elif lo == 0:
            us, me = f'up to {n(ft(hi))} ft', f'up to {n(hi)} m'
        elif hi is None:
            us, me = f'above {n(ft(lo))} ft', f'above {n(lo)} m'
        else:
            us, me = f'{n(ft(lo))}–{n(ft(hi))} ft', f'{n(lo)}–{n(hi)} m'
        out.append({'code': c, 'z_min': lo, 'z_max': hi, 'name': name,
                    'name_us': f'{name} ({us})', 'name_metric': f'{name} ({me})'})
    return out


def pdf_page_text(raw, page_no):
    from pypdf import PdfReader
    logging.getLogger('pypdf').setLevel(logging.ERROR)      # the atlas PDF has harmless xref noise
    t = PdfReader(io.BytesIO(raw)).pages[page_no - 1].extract_text()
    t = t.replace('\xad', '').replace('\u2010', '').replace('\xa0', ' ')   # '-\xad\u2010' is one minus
    return re.sub(r'[ \t\r]+', ' ', t)


def table2_edges():
    """Class edges read from Table 2 of the atlas PDF: each row 'code  hi to lo m'; the edge between
    code c and c-1 is where their ranges meet. 'Sea Level' is 0."""
    with atlas_zip() as z:
        txt = pdf_page_text(z.read(ATLAS_PDF), TABLE2_PAGE)
    assert 'Table 2. Elevation ranges of environments shown on paleogeographic maps' in txt, \
        f'Table 2 is not on atlas PDF p. {TABLE2_PAGE}'
    assert 'from Ziegler et al., 1985' in txt
    num = r'(-?[0-9,]+|Sea Level)'
    rows = {}
    for line in txt.split('\n'):
        m = re.match(r'^\s*([0-9]) ' + num + r' ?m? to ' + num + r' ?m?\b', line.strip())
        if m:
            v = [0 if s == 'Sea Level' else int(s.replace(',', '')) for s in m.group(2, 3)]
            rows[int(m.group(1))] = (max(v), min(v))
    assert sorted(rows) == list(range(10)), f'Table 2 rows parsed: {sorted(rows)}'
    for c in range(1, 10):
        assert rows[c][1] == rows[c - 1][0], f'Table 2: codes {c - 1} and {c} do not meet'
    return [rows[c][1] for c in range(1, 10)], rows


def report_says_first_draft():
    with open(source('paleodem_report'), 'rb') as f:
        txt = pdf_page_text(f.read(), REPORT_DRAFT_PAGE)
    assert 'The paleoDEMS provided with this report are a “first draft”' in txt, \
        f'the report does not say "first draft" on p. {REPORT_DRAFT_PAGE}'


def classify(z):
    """Codes 0..9: the number of DEM_EDGES strictly below z (CONTRACT §7)."""
    return np.digitize(z, DEM_EDGES, right=True).astype(np.uint8)


def match_maps(plate_ages):
    rows = []
    pa = np.asarray(plate_ages)
    for i, s in enumerate(read_slices()):
        d = np.abs(pa - s['file_age_ma'])
        j = int(np.argmin(d))
        ok = d[j] <= MATCH_MYR
        rows.append({'i': i, 'map': s['map'], 'file_age_ma': s['file_age_ma'],
                     'elevation': j if ok else None, 'elevation_age_ma': float(pa[j]) if ok else None})
    return rows


def main():
    edges, table = table2_edges()
    assert edges == DEM_EDGES, f'Table 2 edges {edges} != geo.DEM_EDGES {DEM_EDGES}'
    report_says_first_draft()
    # Sanity of the classifier at every edge: z == edge falls in the lower class.
    for c, e in enumerate(DEM_EDGES):
        assert classify(np.array([e]))[0] == c and classify(np.array([e + 0.5]))[0] == c + 1

    grids = paleodem_grids()
    ages = sorted(grids)
    assert ages == [5.0 * s for s in range(NSLICE)]
    rows_src = 180 - 2 * np.arange(NY)         # source row of shipped row r: latitude 90 - 2r
    cols_src = 2 * np.arange(NX)               # source column of shipped column c: longitude -180 + 2c
    blobs, slices, counts = [], [], np.zeros(10, dtype=np.int64)
    for s, age in enumerate(ages):
        member, mid = grids[age]
        z = paleodem_z(member)
        land, shelf = paleodem_land_shelf(z)
        codes = classify(z[np.ix_(rows_src, cols_src)])
        assert codes.shape == (NY, NX) and codes.max() <= 9
        counts += np.bincount(codes.ravel(), minlength=10)
        blobs.append(codes.tobytes())
        slices.append({'s': s, 'plate_age_ma': age, 'map_id': f'{float(mid):g}',
                       'file': member.rsplit('/', 1)[-1], 'land_pct': land, 'shelf_pct': shelf})
    raw = b''.join(blobs)
    assert len(raw) == BIN_BYTES, f'elevation.bin {len(raw)} bytes, expected {BIN_BYTES}'
    assert NODATA not in raw, 'a no-data byte (255) reached elevation.bin'

    meta = {
        'source': 'paleodem',
        'grid': {'nx': NX, 'ny': NY, 'lon0': -180, 'dlon': 2, 'lat0': 90, 'dlat': -2,
                 'order': 'row-major, north row first', 'at': 'nodes of the 1-degree grid'},
        'layout': '[slice][row][col]', 'slice_bytes': SLICE_BYTES, 'count': NSLICE, 'nodata': NODATA,
        'classes_source': ('Scotese 2016, PALEOMAP PaleoAtlas for GPlates v3, Table 2 (after Ziegler et '
                           f'al. 1985), p. {TABLE2_PAGE}'),
        'class_rule': 'code = number of edges e with e < z (a z equal to an edge takes the lower code)',
        'edges_m': DEM_EDGES,
        'codes': code_names(),
        'land_rule': ('land_pct: z > 0; shelf_pct: -200 < z <= 0; on the full 1-degree grid, '
                      'cos(latitude) node weights, the +180 column left out'),
        'slices': slices,
    }
    txt = json_text(meta, ndigits=4)
    assert len(txt.encode('utf-8')) <= CAP_JSON, f'elevation.json {len(txt.encode())} bytes > {CAP_JSON}'
    match = match_maps(ages)

    # Only after every check: write.
    write_bin('elevation.bin', raw)
    write_json('elevation.json', meta, ndigits=4)
    write_work('elevation.json', {'rule': f'nearest plate age to file_age_ma within {MATCH_MYR} Myr',
                                  'maps': match})

    ds, rp = SOURCES['paleodem_1deg'], SOURCES['paleodem_report']
    with zipfile.ZipFile(source('paleodem_1deg')) as zf:
        dem_licence = zf.read('License.txt')
    with open(os.path.join(TOOLS, 'credits', 'PaleoAtlas_v3_License.txt'), 'rb') as fh:
        kept = fh.read()
    assert dem_licence == kept, "the PaleoDEM zip's License.txt differs from the atlas's"
    write_fragment('elevation', [{
        'id': 'paleodem', 'part': 'elevation classes',
        'title': 'PALEOMAP Paleodigital Elevation Models (PaleoDEMs), 1 degree',
        'owner': 'C. R. Scotese & N. M. Wright, PALEOMAP Project',
        # A list: 90_about.py merges item by item, and the first item is word for word the sentence
        # 40_curves.py writes for the same zip, so CREDITS.txt names the zip once.
        'source': [(f'{ds["name"]} (sha256 {ds["sha256"]}), Zenodo record 5460860: the 109 NetCDF grids, '
                    "keyed by the Plate Model Age in the zip's interval CSV."),
                   (f'The accompanying report {rp["name"]} (sha256 {rp["sha256"]}, same record) was read '
                    'for the method and for its statement that the grids are a "first draft" '
                    f'(p. {REPORT_DRAFT_PAGE}); nothing of it ships.')],
        'url': [ds['url'], rp['url']],
        'licence': 'CC BY 4.0', 'licence_uri': 'http://creativecommons.org/licenses/by/4.0/',
        'licence_quote': ' '.join(kept.decode('utf-8').split()),
        'retrieved': RETRIEVED,
        'adaptations': ('Every second node of each 1-degree grid (a 2-degree grid) sorted into the ten '
                        "elevation classes of Scotese's Table 2 (after Ziegler et al. 1985) and stored as "
                        'one byte per node; the elevations themselves are not shipped.'),
        'accuracy': ('The readout names the class of the nearest 2-degree node, which can be up to about '
                     '1.4 degrees of arc from the point tapped.'),
        'cite': ('Scotese, C.R. & Wright, N.M., 2018. PALEOMAP Paleodigital Elevation Models (PaleoDEMS) '
                 'for the Phanerozoic. Zenodo, doi:10.5281/zenodo.5460860. CC BY 4.0. Classes from Table 2 '
                 'of Scotese, C.R., 2016, PALEOMAP PaleoAtlas for GPlates and the PaleoData Plotter '
                 'Program, PALEOMAP Project.'),
    }])

    exact = sum(1 for m in match if m['elevation'] is not None and m['elevation_age_ma'] == m['file_age_ma'])
    near = [(m['file_age_ma'], m['elevation_age_ma']) for m in match
            if m['elevation'] is not None and m['elevation_age_ma'] != m['file_age_ma']]
    none = [m['map'] for m in match if m['elevation'] is None]
    L = [x['land_pct'] for x in slices]
    S = [x['shelf_pct'] for x in slices]
    print(f'Table 2 (atlas PDF p. {TABLE2_PAGE}) edges {edges} = geo.DEM_EDGES; report p. '
          f'{REPORT_DRAFT_PAGE} says "first draft"')
    print(f'elevation.bin: {len(raw):,} bytes ({NSLICE} slices x {NY} rows x {NX} cols); '
          f'elevation.json: {len(txt.encode()):,} bytes')
    tot = counts.sum()
    print('  node share per code over all slices: ' +
          ', '.join(f'{c}:{counts[c] / tot * 100:.2f}%' for c in range(10)))
    print(f'  0 Ma ({slices[0]["file"]}): land {L[0]:.3f} %, shelf {S[0]:.3f} %')
    print(f'  land {min(L):.3f}..{max(L):.3f} %, shelf {min(S):.3f}..{max(S):.3f} % over the {NSLICE}')
    print(f'maps -> elevation slice: {exact} exact, nearest {near}, none for maps {none}')


if __name__ == '__main__':
    main()
