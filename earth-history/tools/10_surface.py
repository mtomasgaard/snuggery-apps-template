"""Step 10 — the painted maps: data/surface/mNN.webp, data/surface/proxy.webp, data/manifest.json.

Reads the 90 JPEGs of Scotese's PALEOMAP PaleoAtlas v3 (pinned zip) and tools/slices.csv (Table 1
of the atlas PDF). Each map is resized to 1024 x 512 with Lanczos and encoded as WebP q65; the proxy
sheet holds all 90 at 256 x 128 (each resized straight from the source) in a 10 x 9 grid at q70.
Layout and caps: tools/CONTRACT.md §2. The manifest written here carries the fields this step owns
(surface, proxy, axis and each slice's map, file, ages and Table 1 text); 80_manifest.py adds the
ICS, climate, elevation and tile fields later (CONTRACT §1).

    .venv/bin/python 10_surface.py
"""
import io
import json
import os

from PIL import Image, features

from common import RETRIEVED, write_bin, write_json
from geo import RASTER_DIR, atlas_zip, read_slices
from paths import DATA, TOOLS, WORK
from sources import SOURCES

W, H = 1024, 512
QUALITY = 65
PW, PH = 256, 128
PCOLS, PROWS = 10, 9
PQUALITY = 70
METHOD = 6
CAP_EACH, CAP_ALL, CAP_PROXY = 110_000, 5_000_000, 480_000

# The time overlays are rotated to: the file-name age (the time Scotese's own GPlates workflow pairs
# with each raster). verify_plates.py tests it against Table 1's age_ma by overlap (CONTRACT §14);
# changing it is a deliberate edit here, never automatic.
ROTATION_TIME = 'file_age_ma'

AXIS = {'break_ma': 550, 'compressed_fraction': 0.15,
        'knots': [[750, 0], [690, 0.05], [600, 0.1], [550, 0.15]]}


def encode(img, quality):
    # A fresh image from raw bytes: no ICC profile, EXIF or XMP survives into the WebP.
    clean = Image.frombytes('RGB', img.size, img.tobytes())
    buf = io.BytesIO()
    clean.save(buf, format='WEBP', quality=quality, method=METHOD)
    return buf.getvalue()


def main():
    assert features.check('webp'), 'this Pillow has no WebP support'
    slices = read_slices()
    assert len(slices) == 90

    maps = []
    proxy = Image.new('RGB', (PW * PCOLS, PH * PROWS))
    with atlas_zip() as z:
        members = {n[len(RASTER_DIR):]: n for n in z.namelist()
                   if n.startswith(RASTER_DIR) and n.endswith('.jpg')}
        assert len(members) == 90, f'{len(members)} JPEGs in the atlas zip, expected 90'
        assert sorted(members) == sorted(s['file'] for s in slices), 'slices.csv and the zip disagree'
        licence_zip = z.read('License.txt')
        for i, s in enumerate(slices):
            with Image.open(io.BytesIO(z.read(members[s['file']]))) as src:
                assert src.size == (3600, 1800), f'{s["file"]}: {src.size}'
                rgb = src.convert('RGB')
            big = encode(rgb.resize((W, H), Image.LANCZOS), QUALITY)
            assert len(big) <= CAP_EACH, f'map {s["map"]}: {len(big)} bytes > {CAP_EACH}'
            cell = rgb.resize((PW, PH), Image.LANCZOS)
            proxy.paste(cell, ((i % PCOLS) * PW, (i // PCOLS) * PH))
            maps.append((f'surface/m{s["map"]:02d}.webp', big))
    total = sum(len(b) for _n, b in maps)
    assert total <= CAP_ALL, f'the 90 maps are {total} bytes > {CAP_ALL}'
    proxy_bytes = encode(proxy, PQUALITY)
    assert len(proxy_bytes) <= CAP_PROXY, f'proxy {len(proxy_bytes)} bytes > {CAP_PROXY}'

    with open(os.path.join(TOOLS, 'credits', 'PaleoAtlas_v3_License.txt'), 'rb') as f:
        licence_kept = f.read()
    assert licence_zip == licence_kept, \
        "the atlas zip's License.txt differs from credits/PaleoAtlas_v3_License.txt"

    # Only after every cap and the licence check passed: write, and remove any map file no slice claims.
    claimed = {n for n, _b in maps} | {'surface/proxy.webp'}
    sdir = os.path.join(DATA, 'surface')
    if os.path.isdir(sdir):
        for f in os.listdir(sdir):
            if 'surface/' + f not in claimed:
                os.remove(os.path.join(sdir, f))
    for n, b in maps:
        write_bin(n, b)
    write_bin('surface/proxy.webp', proxy_bytes)

    rows = []
    for i, s in enumerate(slices):
        rows.append({
            'i': i, 'map': s['map'], 'file': maps[i][0],
            'age_ma': s['age_ma'], 'file_age_ma': s['file_age_ma'],
            'rotation_ma': s[ROTATION_TIME],
            'label': s['table1_row'], 'interval': s['interval'], 'stage': s['stage'] or None,
        })
    manifest = {
        'schema': 1, 'count': len(rows), 'retrieved': RETRIEVED,
        'surface': {'dir': 'surface/', 'width': W, 'height': H, 'format': 'webp', 'quality': QUALITY,
                    'projection': 'equirectangular', 'west_lon': -180, 'north_lat': 90},
        'proxy': {'file': 'surface/proxy.webp', 'cols': PCOLS, 'rows': PROWS, 'cell_width': PW,
                  'cell_height': PH, 'quality': PQUALITY},
        'axis': AXIS,
        'slices': rows,
    }
    write_json('manifest.json', manifest, ndigits=4)

    # The work file 80_manifest.py assembles from (CONTRACT §12), with each output's size and hash.
    work = {'rotation_time': ROTATION_TIME, 'slices': [
        dict(r, source_jpeg=slices[r['i']]['file'], bytes=len(maps[r['i']][1]))
        for r in rows], 'proxy_bytes': len(proxy_bytes), 'maps_bytes': total}
    with open(os.path.join(WORK, 'surface.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(work, sort_keys=True, ensure_ascii=False, indent=1) + '\n')

    # Credits fragment: the atlas maps (CONTRACT §0; 90_about.py merges blocks sharing an id).
    s = SOURCES['paleoatlas']
    frag = [{
        'id': 'paleoatlas', 'part': 'maps',
        'title': 'PALEOMAP PaleoAtlas for GPlates v3: paleogeographic maps and plate model',
        'owner': 'C. R. Scotese, PALEOMAP Project',
        'source': (f'{s["name"]} (sha256 {s["sha256"]}), Zenodo record 5460860 '
                   '(doi:10.5281/zenodo.5460860): the 90 JPEG maps in "PALEOMAP PaleoAtlas Rasters v3", '
                   'each 3600 x 1800 px, equirectangular; ages from Table 1 of the PDF in the same zip.'),
        'url': s['url'],
        'licence': 'CC BY 4.0', 'licence_uri': 'http://creativecommons.org/licenses/by/4.0/',
        'licence_quote': ' '.join(licence_kept.decode('utf-8').split()),
        'retrieved': RETRIEVED,
        'adaptations': ('Maps: resized from 3600 x 1800 to 1024 x 512 (Lanczos) and re-encoded as WebP '
                        f'quality {QUALITY}; a 256 x 128 preview of each, combined into one sheet at '
                        f'quality {PQUALITY}. No colors or content changed.'),
        'accuracy': ('A painted reconstruction by one author: one interpretation among several. Map '
                     "ages are Scotese's Table 1 ages on the 2008 timescale his atlas uses."),
        'cite': ('Scotese, C.R., 2016. PALEOMAP PaleoAtlas for GPlates and the PaleoData Plotter '
                 'Program, PALEOMAP Project. Via Scotese, C.R. & Wright, N.M., 2018, Zenodo, '
                 'doi:10.5281/zenodo.5460860.'),
    }]
    fdir = os.path.join(TOOLS, 'credits', 'fragments')
    os.makedirs(fdir, exist_ok=True)
    with open(os.path.join(fdir, 'surface.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(frag, sort_keys=True, ensure_ascii=False, indent=1) + '\n')

    sizes = [len(b) for _n, b in maps]
    print(f'maps: 90 x {W}x{H} WebP q{QUALITY}: {total:,} bytes ({min(sizes):,}–{max(sizes):,} each)')
    print(f'proxy: {PW * PCOLS}x{PH * PROWS} q{PQUALITY}: {len(proxy_bytes):,} bytes')
    print(f'manifest.json: {os.path.getsize(os.path.join(DATA, "manifest.json")):,} bytes; '
          f'rotation_ma = {ROTATION_TIME}')


if __name__ == '__main__':
    main()
