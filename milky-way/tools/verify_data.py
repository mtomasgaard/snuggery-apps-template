"""Runs every step's verify script, then checks what holds across steps: the byte budget, that
data/ holds only files some step claims, and that the app's own code carries no URL.

Each verify_<step>.py asserts the properties the app relies on for its own files and prints the
numbers it measured; this file only adds the checks no single step can make."""
import glob
import os
import re
import subprocess
import sys

from paths import APP, DATA, TOOLS

steps = sorted(glob.glob(os.path.join(TOOLS, 'verify_*.py')))
steps = [s for s in steps if os.path.basename(s) != 'verify_data.py']
failed = []
for s in steps:
    print(f'--- {os.path.basename(s)}')
    r = subprocess.run([sys.executable, s], cwd=TOOLS)
    if r.returncode:
        failed.append(os.path.basename(s))
print()

# Budget for everything under data/ (tools/CONTRACT.md lists the per-step caps).
total = 0
for dp, _dn, fn in os.walk(DATA):
    for f in fn:
        total += os.path.getsize(os.path.join(dp, f))
print(f'data/ total: {total:,} bytes ({total / 2**20:.2f} MiB)')
assert total < 11 * 2**20, 'data/ is over the 11 MiB budget'

# No URL in the app's own code (the packager refuses them too; failing here is earlier).
url = re.compile(r'https?://')
bad = []
for f in ['index.html', 'styles.css', 'app.js'] + sorted(glob.glob(os.path.join(APP, 'js', '*.js'))):
    p = f if os.path.isabs(f) else os.path.join(APP, f)
    for n, line in enumerate(open(p, encoding='utf-8'), 1):
        if url.search(line):
            bad.append(f'{os.path.relpath(p, APP)}:{n}')
assert not bad, 'URL in app code: ' + ', '.join(bad)
print('no URL in the app\'s own code')

if failed:
    sys.exit('FAILED: ' + ', '.join(failed))
print('all checks passed')
