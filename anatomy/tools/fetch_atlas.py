"""Step 6a: download the browser-ready BodyParts3D 4.0 and Human Reference Atlas (female) geometry
that build_vessels.py and build_female.py read (about 120 MB, fetched once into tools/.cache/human-atlas).

Source: https://github.com/slorksmo/Human-Atlas (MIT code; CC BY 4.0 data), pinned to the commit below.
Its public/models/ holds meshoptimizer-simplified copies of
  - isa_BP3D_4.0_obj_99 (BodyParts3D 4.0, DBCLS, CC BY 4.0): atlas.json + body-*.bin, and
  - the HuBMAP 3D Reference Organ Set for Female v1.10 (+ v1.5 pelvis), with 180 bones borrowed from
    BodyParts3D 4.0 and 76 lower-limb muscles from Andreassen et al. 2023: atlas-female.json + female-*.bin.
The DBCLS and humanatlas.io hosts are not reachable from every network; this GitHub copy is."""
import json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from paths import ATLAS
COMMIT = '5bb5713aab18d7fe9380c3339eb09f173491ea06'
BASE = f'https://raw.githubusercontent.com/slorksmo/Human-Atlas/{COMMIT}/'

def get(rel, expected=None):
    dst = os.path.join(ATLAS, os.path.basename(rel))
    if os.path.exists(dst) and (expected is None or os.path.getsize(dst) == expected): return 0
    tmp = dst + '.part'
    urllib.request.urlretrieve(BASE + rel, tmp)
    if expected is not None and os.path.getsize(tmp) != expected: sys.exit(f'{rel}: got {os.path.getsize(tmp)} bytes, expected {expected}')
    os.replace(tmp, dst); return 1

n = 0
for manifest in ('atlas.json', 'atlas-female.json'):
    n += get('public/models/' + manifest)
    m = json.load(open(os.path.join(ATLAS, manifest)))
    with ThreadPoolExecutor(6) as ex:
        n += sum(ex.map(lambda c: get('public/models/' + os.path.basename(c['url']), c['bytes']), m['chunks']))
n += get('public/ATTRIBUTION.md')
print(f'Human-Atlas package in {ATLAS} ({n} files downloaded)')
