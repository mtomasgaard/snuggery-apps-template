"""Prints what every pinned source URL returns now (HTTP status, Content-Length, whether it honours
a Range request), and with --fetch downloads anything missing through fetch() / git_file() and
checks every pin. Run it before a build when a source might have moved.

    .venv/bin/python probe.py            # status only, no downloads
    .venv/bin/python probe.py --fetch    # also fill tools/.cache and verify every sha256
"""
import subprocess
import sys

from common import fetch, git_file
from sources import SOURCES


def head(url):
    r = subprocess.run(['curl', '-sS', '-L', '-o', '/dev/null', '-r', '0-0', '--max-time', '60',
                        '-w', '%{http_code} %{size_download}', '-D', '-', url],
                       capture_output=True, text=True)
    lines = r.stdout.splitlines()
    code = lines[-1].split()[0] if lines else 'ERR'
    total = ''
    for ln in lines:
        if ln.lower().startswith('content-range:'):
            total = ln.split('/')[-1].strip()
    return code, total


for key, s in SOURCES.items():
    code, total = head(s['url'])
    rng = 'range ok' if code == '206' else 'no range'
    size_ok = '' if not total else ('size ok' if int(total) == s['bytes'] else f'SIZE CHANGED {total}')
    print(f'{key:16s} {code} {rng:8s} {size_ok:10s} {s["bytes"]:>11,d}  {s["url"]}')

if '--fetch' in sys.argv:
    print()
    for key, s in SOURCES.items():
        if 'git' in s:
            repo, commit, path = s['git']
            p = git_file(repo, commit, path, s['name'], s['sha256'])
        else:
            p = fetch(s['url'], s['name'], s['sha256'], s['bytes'])
        print(f'{key:16s} ok  {p}')
