"""Writes tools/slices.csv: one row per map in Scotese's PaleoAtlas v3, joining the zip's 90 raster
file names to the ages in Table 1 of the PDF that ships inside the same zip
("PALEOMAP PaleoAtlas for GPlates v3.pdf", Scotese 2016, pages 37-41, "Table 1. Paleogeographic
Maps: Time Intervals in the PALEOMAP PaleoAtlas (Ogg et al., 2008)").

Run once by hand; slices.csv is committed and the pipeline reads it. Why not trust the file names:
the number at the end of each file name is the time GPlates assigns when the folder is imported as a
time-dependent raster, and it is a rounded bin (Map2a Last Glacial Maximum_001 is 21 ky in Table 1;
Map80a Darwillian_461 is 464.5 Ma). Both are kept: `age_ma` is Table 1's age, `file_age_ma` is the
file name's number.

Table 1 is parsed from the PDF's text layer with pypdf, then every row is checked against the
rules below; the fix-ups the text layer needs are listed in FIXUPS and nowhere else.
"""
import csv
import os
import re
import zipfile

from pypdf import PdfReader

from common import sha256_of
from paths import CACHE, TOOLS, WORK
from sources import SOURCES

ATLAS = SOURCES['paleoatlas']
ZIP = os.path.join(CACHE, ATLAS['name'])
assert sha256_of(ZIP) == ATLAS['sha256'], 'atlas zip does not match its pin'
PDF_MEMBER = 'Scotese PaleoAtlas_v3/PALEOMAP PaleoAtlas for GPlates v3.pdf'
RASTERS = 'Scotese PaleoAtlas_v3/PALEOMAP PaleoAtlas Rasters v3/'

z = zipfile.ZipFile(ZIP)
pdf_path = os.path.join(WORK, 'PALEOMAP PaleoAtlas for GPlates v3.pdf')
with open(pdf_path, 'wb') as f:
    f.write(z.read(PDF_MEMBER))
reader = PdfReader(pdf_path)
text = ''
for i in range(36, 41):                     # printed pages 37-41
    text += '\n' + (reader.pages[i].extract_text() or '')
text = re.sub(r'[^\S\n]+', ' ', text)        # tabs and no-break spaces separate every word

# Rows start with the map number at the beginning of a line; a row can wrap (map 14).
start = text.index('Cenozoic PaleoAtlas')
end = text.index('Map intervals that are')
rows = {}
cur = 0
HEADINGS = ('Cretaceous PaleoAtlas', 'Jurassic and Triassic', 'Late Paleozoic', 'Early Paleozoic',
            'Late Precambrian')
for line in text[start + len('Cenozoic PaleoAtlas'):end].splitlines():
    line = line.strip()
    if not line or line.startswith(HEADINGS):
        continue
    if re.fullmatch(r'\d{2}', line) and int(line) != cur + 1:   # a printed page number (37-41)
        assert 37 <= int(line) <= 41, line
        continue
    m = re.match(r'^(\d{1,3})(?:\s+(.*))?$', line)
    if m and int(m.group(1)) == cur + 1:
        cur = int(m.group(1))
        rows[cur] = m.group(2) or ''
    else:
        assert cur, line
        rows[cur] = (rows[cur] + ' ' + line).strip()
assert sorted(rows) == list(range(1, 104)), f'Table 1 rows found: {sorted(rows)}'

# The text layer's own oddities: stray quotes and a wrapped row. Every row is normalised the same
# way (quotes dropped, whitespace collapsed); the rows that needed it are pinned here so a changed
# PDF cannot slip through.
for n in rows:
    rows[n] = re.sub(r'\s+', ' ', re.sub(r'[\u201c\u201d"]', '', rows[n])).strip()
FIXUPS = {
    14: 'Paleocene/Eocene Boundary (Thanetian/Ypresian Boundary, 55.8 Ma) PETM',   # wraps over 2 lines
    40: 'Early Jurassic (Pliensbachian, 186.3 Ma)',                                 # stray opening quote
    49: 'Permo-Triassic Boundary (251 Ma)',                                         # stray quotes
}
for n, expected in FIXUPS.items():
    assert rows[n] == expected, (n, rows[n])


def parse(n, label):
    label = re.sub(r'\s+', ' ', label).strip()
    m = re.match(r'^(.*?)\s*\((.*)\)\s*(PETM)?$', label)
    assert m, (n, label)
    interval, inner = m.group(1).strip(), m.group(2).strip()
    am = re.search(r'([\d.]+)\s*(Ma|ky)?\s*$', inner)
    assert am, (n, inner)
    value = float(am.group(1))
    unit = am.group(2) or 'Ma'              # map 37 prints "169.7)" with no unit; Ma by context
    age = value / 1000.0 if unit == 'ky' else value
    stage = inner[:am.start()].rstrip(' ,').strip()
    return interval, stage, age, unit


members = [i.filename for i in z.infolist() if i.filename.startswith(RASTERS) and i.filename.endswith('.jpg')]
assert len(members) == 90, len(members)
out = []
for fn in members:
    base = fn[len(RASTERS):]
    m = re.match(r'^Map(\d+)a\s+(.*)_(\d{3})\.jpg$', base)
    assert m, base
    n, file_title, file_age = int(m.group(1)), m.group(2).strip(), int(m.group(3))
    interval, stage, age, unit = parse(n, rows[n])
    out.append({'map': n, 'age_ma': age, 'file_age_ma': file_age, 'interval': interval,
                'stage': stage, 'file_title': file_title, 'file': base,
                'table1_row': re.sub(r'\s+', ' ', rows[n]).strip()})
out.sort(key=lambda r: r['map'])

# Checks: ages increase with map number; Table 1 and file-name ages agree within 5 Myr (21 ky vs 1
# for the Last Glacial Maximum is the largest relative gap and is expected).
for a, b in zip(out, out[1:]):
    assert b['age_ma'] > a['age_ma'], (a, b)
for r in out:
    assert abs(r['age_ma'] - r['file_age_ma']) <= 5, r
missing = sorted(set(range(1, 94)) - {r['map'] for r in out})
print('maps in the zip:', len(out), '· Table 1 rows 1-93 without a raster in the zip:', missing)

path = os.path.join(TOOLS, 'slices.csv')
with open(path, 'w', newline='\n', encoding='utf-8') as f:
    w = csv.writer(f, lineterminator='\n')
    w.writerow(['map', 'age_ma', 'file_age_ma', 'interval', 'stage', 'file_title', 'file', 'table1_row'])
    for r in out:
        w.writerow([r['map'], f"{r['age_ma']:g}", r['file_age_ma'], r['interval'], r['stage'],
                    r['file_title'], r['file'], r['table1_row']])
print('wrote', path, len(out), 'rows')
