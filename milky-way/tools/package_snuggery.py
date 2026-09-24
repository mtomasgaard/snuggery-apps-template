"""Builds dist/milky-way.zip for importing into Snuggery the way the repository's workflow
(.github/workflows/build-zips.yml) builds zips/milky-way.zip: the app folder's git-tracked files at
the root of the ZIP, with no wrapping folder, leaving out tools/, screenshots/, dist/ and dotfiles;
NOTES.md goes in, as it does there. Tracked files are read from the working tree, so uncommitted
edits are included. Checks Snuggery's import rules, and the app's own offline rule, before writing
anything."""
import os
import re
import subprocess
import zipfile

from paths import APP

# The workflow's exclusions: zip -x '.*' '*/.*' 'screenshots/*' 'tools/*' 'pipeline/*' 'scripts/*' 'dist/*'
SKIP_DIRS = {'screenshots', 'tools', 'pipeline', 'scripts', 'dist'}

# No network, ever: Snuggery runs mini-apps in an offline sandboxed web view, and a URL in the app's
# own code is a request that will be blocked rather than merely discouraged. vendor/ is exempt —
# three.js carries URLs in its comments and never fetches anything.
URL_RE = re.compile(r'https?://')
SCAN_EXT = {'.html', '.css', '.js', '.mjs'}
SCAN_EXEMPT_DIRS = {'vendor'}

out_dir = os.path.join(APP, 'dist')
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'milky-way.zip')

# CI zips a fresh checkout, so only what git tracks: an untracked scratch file stays out here too.
try:
    tracked = subprocess.run(['git', 'ls-files', '-z'], cwd=APP, check=True, capture_output=True).stdout
except (OSError, subprocess.CalledProcessError) as e:
    raise SystemExit(f'git ls-files failed ({e}); this packs what git tracks, so run it in a git checkout')
files = []
for rel in tracked.decode('utf-8').split('\0'):
    parts = rel.split('/')
    if not rel or parts[0] in SKIP_DIRS or any(x.startswith('.') for x in parts):
        continue
    p = os.path.join(APP, *parts)
    if os.path.islink(p) or not os.path.isfile(p):      # deleted in the working tree, or a link
        continue
    files.append(os.path.join(*parts))
files.sort()

assert 'index.html' in files, 'index.html missing'
assert 'miniapp.json' in files, 'miniapp.json missing'
assert 'CREDITS.txt' in files, 'CREDITS.txt missing'
assert os.path.isdir(os.path.join(APP, 'data')), 'data/ missing — run tools/build_all.sh'

offenders = []
for rel in files:
    if os.path.splitext(rel)[1].lower() not in SCAN_EXT:
        continue
    if rel.split(os.sep)[0] in SCAN_EXEMPT_DIRS:
        continue
    with open(os.path.join(APP, rel), encoding='utf-8', errors='replace') as fh:
        for n, line in enumerate(fh, 1):
            if URL_RE.search(line):
                offenders.append(f'{rel}:{n}: {line.strip()[:90]}')
assert not offenders, ('a URL in the app\'s own code — Snuggery blocks every network request, so '
                       'this must go (licence links belong in CREDITS.txt, NOTES.md or '
                       'data/about.json):\n  ' + '\n  '.join(offenders[:10]))

sizes = {f: os.path.getsize(os.path.join(APP, f)) for f in files}
assert all(v < 128 * 2**20 for v in sizes.values()), 'a file exceeds 128 MB'
assert sum(sizes.values()) < 512 * 2**20, 'more than 512 MB'
assert len(files) <= 10000, 'more than 10000 files'
assert max(f.count(os.sep) for f in files) < 15, 'nested more than 15 deep'

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in files:
        z.write(os.path.join(APP, f), f.replace(os.sep, '/'))

print(f'{out}: {len(files)} files, {sum(sizes.values())/2**20:.2f} MB unpacked, '
      f'{os.path.getsize(out)/2**20:.2f} MB zipped')
for group in ('data', 'vendor', 'fonts', 'js'):
    n = [f for f in files if f.split(os.sep)[0] == group]
    if n:
        print(f'  {group + "/":10s} {len(n):4d} files  {sum(sizes[f] for f in n)/2**20:6.2f} MB')
loose = [f for f in files if os.sep not in f]
print(f'  {"root":10s} {len(loose):4d} files  {sum(sizes[f] for f in loose)/2**20:6.2f} MB  '
      + ', '.join(loose))
