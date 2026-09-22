"""Step 1: download the BodyParts3D 3.0 STL meshes listed in source/stl_names.json (about 1.3 GB).
Source: https://github.com/Kevin-Mattheus-Moerman/BodyParts3D (pinned commit below), a clone of
BodyParts3D release 3.0 from DBCLS converted from OBJ to binary STL. Existing files are skipped."""
import json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from paths import STL, SOURCE
COMMIT = 'f0eeb6e843380cfe6b83797cf8c3e1af74de5e61'
BASE = f'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/{COMMIT}/assets/BodyParts3D_data/stl/'
ids = list(json.load(open(os.path.join(SOURCE, 'stl_names.json'))))
def get(i):
    dst = os.path.join(STL, i + '.stl')
    if os.path.exists(dst) and os.path.getsize(dst) > 84: return 0
    tmp = dst + '.part'
    urllib.request.urlretrieve(BASE + i + '.stl', tmp)
    os.replace(tmp, dst); return 1
with ThreadPoolExecutor(16) as ex:
    n = sum(ex.map(get, ids))
bad = [i for i in ids if (os.path.getsize(os.path.join(STL, i + '.stl')) - 84) % 50]
if bad: sys.exit(f'Not binary STL: {bad[:5]}')
print(f'{len(ids)} meshes in {STL} ({n} downloaded)')
