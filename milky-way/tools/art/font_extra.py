"""Builds fonts/ysabeau-office-milky-way-extra.woff2: the characters Milky Way's data writes that the
house face (fonts/ysabeau-office-gw.woff2, copied byte for byte from global-weather/fonts/) lacks
(HOUSE.md section 2.3; ART.md section 4):

  U+02BB          the okina of 'Oumuamua (data/smallbodies.json)
  U+03B1-03C9     the Greek small letters of the Bayer designations (data/stars/named.json)
  U+2074-2079     the superscript figures 4 to 9 of indices such as alpha-1 Cen (1, 2 and 3 are in the cut)

The recipe is Global Weather's tools/art/font_subset.py, unchanged but for the code points: the
same pinned upstream (google/fonts commit 9710da1e..., YsabeauOffice[wght].ttf, 401 964 B, sha256
0f305c84...), the same features and options, the weight axis cut to 400-650, recalcTimestamp off, so
a rebuild is byte-identical. It writes only the supplement, never fonts/OFL.txt: the house's license
file covers both files.

Needs fonttools==4.60.x and Brotli in any venv (not the pipeline's). From Template/:
  /tmp/ft/bin/python milky-way/tools/art/font_extra.py
The upstream is read from global-weather/tools/.work/font/ when it is there, else fetched to this
app's tools/.work/font/. Prints the output's size and sha256.
"""
import hashlib, os, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.normpath(os.path.join(HERE, '../..'))
CACHED = os.path.normpath(os.path.join(APP, '../global-weather/tools/.work/font/YsabeauOffice-var.ttf'))
WORK = os.path.join(APP, 'tools/.work/font')
COMMIT = '9710da1eacb3be272583c3224dcb70f9da6eadbb'
URL = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/ysabeauoffice/YsabeauOffice%5Bwght%5D.ttf'
SIZE, SHA = 401964, '0f305c8451c1566f0ae62dca9921831fa59f09f6468b012fd6c9161362b5d360'
UNICODES = 'U+02BB,U+03B1-03C9,U+2074-2079'
FEATURES = ['kern', 'tnum', 'lnum', 'pnum', 'case', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']
OUT = 'fonts/ysabeau-office-milky-way-extra.woff2'

def upstream():
    path = CACHED if os.path.exists(CACHED) else os.path.join(WORK, 'YsabeauOffice-var.ttf')
    if not os.path.exists(path):
        os.makedirs(WORK, exist_ok=True)
        urllib.request.urlretrieve(URL, path)
    data = open(path, 'rb').read()
    assert len(data) == SIZE and hashlib.sha256(data).hexdigest() == SHA, f'{path}: pin mismatch'
    return path

def main(out=None):
    f = TTFont(upstream(), lazy=False)
    opts = subset.Options(); opts.layout_features = FEATURES
    opts.name_IDs = ['*']; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(unicodes=subset.parse_unicodes(UNICODES)); s.subset(f)
    f = instancer.instantiateVariableFont(f, {'wght': (400, 650)})
    f.recalcTimestamp = False
    f.flavor = 'woff2'
    out = out or os.path.join(APP, OUT)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    f.save(out)
    data = open(out, 'rb').read()
    print(os.path.relpath(out, APP), len(data), 'B sha256', hashlib.sha256(data).hexdigest())

if __name__ == '__main__':
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else None)
