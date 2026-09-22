"""Builds dist/anatomy.zip for importing into Snuggery: the app files inside one wrapping folder,
without tools/, docs or git files. Checks Snuggery's import rules before writing."""
import os, zipfile
from paths import APP, TOOLS
SKIP_DIRS = {'tools', 'dist', '.git'}
SKIP_FILES = {'README.md', 'HANDOFF.md', '.gitignore', '.gitattributes', '.DS_Store'}
out_dir = os.path.join(APP, 'dist'); os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'anatomy.zip')
files = []
for dp, dn, fn in os.walk(APP):
    dn[:] = [d for d in dn if not (os.path.relpath(os.path.join(dp, d), APP).split(os.sep)[0] in SKIP_DIRS)]
    for f in fn:
        rel = os.path.relpath(os.path.join(dp, f), APP)
        if rel in SKIP_FILES or os.path.islink(os.path.join(dp, f)): continue
        files.append(rel)
assert 'index.html' in files, 'index.html missing'
assert all(os.path.getsize(os.path.join(APP, f)) < 128 * 2**20 for f in files), 'a file exceeds 128 MB'
assert sum(os.path.getsize(os.path.join(APP, f)) for f in files) < 512 * 2**20, 'more than 512 MB'
assert len(files) <= 10000 and max(f.count(os.sep) for f in files) < 15
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in sorted(files):
        z.write(os.path.join(APP, f), 'anatomy/' + f.replace(os.sep, '/'))
print(f'{out}: {len(files)} files, {os.path.getsize(out) / 2**20:.1f} MB')
