"""Builds fonts/archivo-ww.woff2, the app's one font file, from Archivo's upstream variable font.

Archivo (Omnibus-Type, SIL OFL 1.1, no Reserved Font Name) as published in google/fonts at a
pinned commit. The cut keeps the weight axis 400-700 and the width axis 87.5-100 (normal to
semi-condensed), and the characters the app sets: Basic Latin, Latin-1, Latin Extended-A, the
comma-below letters, dashes, quotes, the ellipsis, primes, single guillemets, the thin space,
U+2212 minus and the two inequality signs (≤ ≥) the legend's end caps use. Natural Earth's place
names need only Latin-1 plus ă ġ İ ń Ō ō ş ș ț, all inside that set. U+202F is not in Archivo; the
browser takes that one space from the system face.

Needs fonttools==4.60.1 and Brotli==1.1.0 in any venv (not the pipeline's):
  python -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools==4.60.1 Brotli==1.1.0
  /tmp/ft/bin/python warming-world/tools/art/font_subset.py        (from Template/)
Prints the output's size and sha256. Two runs are byte-identical (`cmp` after two runs, 2026-09-30).
"""
import hashlib, os, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.normpath(os.path.join(HERE, '../..'))
WORK = os.path.join(APP, 'tools/.work/font')
COMMIT = '95f4904fc8bcf26d3420fe315560c96417c6dec7'          # google/fonts, 2026-03-03
BASE = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/archivo/'
PINS = {'Archivo%5Bwdth,wght%5D.ttf': ('Archivo-var.ttf', 658596, '0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053'),
        'OFL.txt': ('Archivo-OFL.txt', 4388, '108b4e57c9c796d3d38d0428ca7ee39de47ad93187302718d9b2d8864b9b716b')}
UNICODES = ('U+0020-007E,U+00A0-00FF,U+0100-017F,U+0218-021B,U+2009,U+2013-2014,U+2018-201E,'
            'U+2026,U+2032-2033,U+2039-203A,U+2212,U+2264-2265')
FEATURES = ['kern', 'tnum', 'lnum', 'pnum', 'case', 'frac', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']

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
    f = instancer.instantiateVariableFont(TTFont(src), {'wght': (400, 700), 'wdth': (87.5, 100)})
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = FEATURES
    opts.name_IDs = ['*']; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(unicodes=subset.parse_unicodes(UNICODES)); s.subset(f)
    f.recalcTimestamp = False                   # keep the source's head.modified: byte-identical rebuilds
    f.flavor = 'woff2'
    out = os.path.join(APP, 'fonts/archivo-ww.woff2'); os.makedirs(os.path.dirname(out), exist_ok=True)
    f.save(out)
    notice = ('fonts/archivo-ww.woff2 is a subset of Archivo, cut by tools/art/font_subset.py from\n'
              f'google/fonts commit {COMMIT}, ofl/archivo/Archivo[wdth,wght].ttf: weight 400-700,\n'
              'width 87.5-100, Latin characters only. Archivo declares no Reserved Font Name.\n\n')
    open(os.path.join(APP, 'fonts/OFL.txt'), 'w').write(notice + open(lic).read())
    data = open(out, 'rb').read()
    print(out, len(data), 'B sha256', hashlib.sha256(data).hexdigest())
    print('fonts/OFL.txt', os.path.getsize(os.path.join(APP, 'fonts/OFL.txt')), 'B')

if __name__ == '__main__':
    main()
