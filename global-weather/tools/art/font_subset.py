"""Builds fonts/ysabeau-office-gw.woff2, the app's one font file, from Ysabeau Office's upstream
variable font (ART.md, "Type").

Ysabeau Office (Christian Thalmann, Catharsis Fonts; SIL OFL 1.1, no Reserved Font Name: the
copyright line of google/fonts' OFL.txt names none) as published in google/fonts at a pinned
commit. The cut keeps the weight axis 400-650 and the characters the app sets:
  Basic Latin, Latin-1, Latin Extended-A, o-horn and u-horn (U+01A0-01A1, U+01AF-01B0), the comma-below
  letters (U+0218-021B), the combining macron and dot above (U+0304, U+0307), Latin Extended
  Additional (U+1E00-1EFF: GeoNames writes Vietnamese and transliterated names with it),
  the thin and narrow no-break spaces (U+2009, U+202F), dashes, quotes, the ellipsis, primes,
  single guillemets, U+2212 minus and the inequality signs (U+2264-2265).
places.json's 1 612 names then lack only three letters (U+1E11, U+1E28, U+1E29: d-cedilla and
h-cedilla, which the upstream font does not draw); the browser takes those from the system face.

Needs fonttools==4.60.x and Brotli in any venv (not the pipeline's):
  python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools==4.60.2 Brotli
  /tmp/ft/bin/python global-weather/tools/art/font_subset.py       (from Template/)
Prints the output's size and sha256. Global Wind takes a byte-identical copy (ART.md change list).
"""
import hashlib, os, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.normpath(os.path.join(HERE, '../..'))
WORK = os.path.join(APP, 'tools/.work/font')
COMMIT = '9710da1eacb3be272583c3224dcb70f9da6eadbb'          # google/fonts main, 2026-09-30
BASE = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/ysabeauoffice/'
PINS = {'YsabeauOffice%5Bwght%5D.ttf': ('YsabeauOffice-var.ttf', 401964, '0f305c8451c1566f0ae62dca9921831fa59f09f6468b012fd6c9161362b5d360'),
        'OFL.txt': ('YsabeauOffice-OFL.txt', 4391, '1343b9162a2d24f685767766ea23a75a80b88ba13ba421244e65b72210578b78')}
UNICODES = ('U+0020-007E,U+00A0-00FF,U+0100-017F,U+01A0-01A1,U+01AF-01B0,U+0218-021B,U+0304,U+0307,'
            'U+1E00-1EFF,U+2009,U+202F,U+2013-2014,U+2018-201E,U+2026,U+2032-2033,U+2039-203A,'
            'U+2212,U+2264-2265')
FEATURES = ['kern', 'tnum', 'lnum', 'pnum', 'case', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']
OUT = 'fonts/ysabeau-office-gw.woff2'

def fetch(remote, local, size, sha):
    path = os.path.join(WORK, local)
    if not os.path.exists(path):
        os.makedirs(WORK, exist_ok=True)
        urllib.request.urlretrieve(BASE + remote, path)
    data = open(path, 'rb').read()
    assert len(data) == size and hashlib.sha256(data).hexdigest() == sha, f'{local}: pin mismatch'
    return path

def main():
    src, lic = (fetch(r, *p) for r, p in PINS.items())
    f = TTFont(src, lazy=False)
    opts = subset.Options(); opts.layout_features = FEATURES
    opts.name_IDs = ['*']; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(unicodes=subset.parse_unicodes(UNICODES)); s.subset(f)
    f = instancer.instantiateVariableFont(f, {'wght': (400, 650)})   # subset first, then cut the axis
    f.recalcTimestamp = False                   # keep the source's head.modified: byte-identical rebuilds
    f.flavor = 'woff2'
    out = os.path.join(APP, OUT); os.makedirs(os.path.dirname(out), exist_ok=True)
    f.save(out)
    notice = (f'{OUT} is a subset of Ysabeau Office by Christian Thalmann, cut by\n'
              f'tools/art/font_subset.py from google/fonts commit {COMMIT},\n'
              'ofl/ysabeauoffice/YsabeauOffice[wght].ttf: weight 400-650, Latin characters only.\n'
              'Ysabeau Office declares no Reserved Font Name.\n\n')
    open(os.path.join(APP, 'fonts/OFL.txt'), 'w').write(notice + open(lic).read())
    data = open(out, 'rb').read()
    print(OUT, len(data), 'B sha256', hashlib.sha256(data).hexdigest())
    print('fonts/OFL.txt', os.path.getsize(os.path.join(APP, 'fonts/OFL.txt')), 'B')

if __name__ == '__main__':
    main()
