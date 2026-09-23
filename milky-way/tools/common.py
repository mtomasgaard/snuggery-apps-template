"""Helpers every pipeline step shares: pinned downloads, deterministic output, small numeric tools.

Every source the pipeline reads is fetched through fetch(), which knows the file's sha256 in advance
and refuses anything else. A file already in the cache is used as it is; a file present in the
MILKYWAY_SEED folder with the right hash is hard-linked instead of downloaded again. Nothing is
ever fetched twice, and a changed upstream file stops the build rather than silently changing it.

Outputs go through write_json() / write_bin(), which sort keys, fix float formatting and never
embed a date, so two builds from the same cache produce byte-identical files.
"""
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys

from paths import CACHE, DATA, SEED

# Fixed, not today(): the date every source listed in CREDITS.txt was retrieved. Keeping it a
# constant is what makes a later rebuild byte-identical.
RETRIEVED = '2026-09-23'

J2000 = 2451545.0          # JD of J2000.0 (TDB)


def sha256_of(path, bufsize=1 << 20):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            b = f.read(bufsize)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


_seed_index = None


def _seed_lookup(sha):
    """Find a file in MILKYWAY_SEED with this sha256 (index built once, by size then hash)."""
    global _seed_index
    if not SEED or not os.path.isdir(SEED):
        return None
    if _seed_index is None:
        _seed_index = {}
        for dp, _dn, fn in os.walk(SEED):
            for f in fn:
                p = os.path.join(dp, f)
                try:
                    if os.path.islink(p) or not os.path.isfile(p):
                        continue
                    _seed_index.setdefault(os.path.getsize(p), []).append(p)
                except OSError:
                    pass
    return _seed_index


def _from_seed(sha, dest, size_hint=None):
    idx = _seed_lookup(sha)
    if not idx:
        return False
    sizes = [size_hint] if size_hint else list(idx.keys())
    for s in sizes:
        for p in idx.get(s, []):
            try:
                if sha256_of(p) == sha:
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    try:
                        os.link(p, dest)
                    except OSError:
                        shutil.copyfile(p, dest)
                    return True
            except OSError:
                continue
    return False


def fetch(url, name, sha256, size=None):
    """Return the local path of `url`, cached as CACHE/name, verified against `sha256`.

    `size` (bytes), when given, lets the seed lookup skip hashing files of the wrong size."""
    dest = os.path.join(CACHE, name)
    if os.path.exists(dest):
        got = sha256_of(dest)
        if got != sha256:
            sys.exit(f'{dest}: sha256 {got} does not match the pin {sha256} — delete it and rerun')
        return dest
    if _from_seed(sha256, dest, size):
        print(f'  seeded {name}')
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.part'
    print(f'  fetching {url}')
    cmd = ['curl', '-sSfL', '--retry', '4', '--retry-delay', '2', '-o', tmp, url]
    subprocess.run(cmd, check=True)
    got = sha256_of(tmp)
    if got != sha256:
        os.remove(tmp)
        sys.exit(f'{url}: sha256 {got} does not match the pin {sha256}. The upstream file changed; '
                 'check it and update the pin deliberately.')
    os.replace(tmp, dest)
    return dest


def git_file(repo_url, commit, path, name, sha256):
    """One file from a git repository at a pinned commit, through raw.githubusercontent.com when the
    repo is on GitHub (the container's egress allows raw, not the GitHub web UI or API)."""
    if repo_url.startswith('https://github.com/'):
        slug = repo_url[len('https://github.com/'):].removesuffix('.git')
        return fetch(f'https://raw.githubusercontent.com/{slug}/{commit}/{path}', name, sha256)
    raise ValueError('only GitHub repositories are wired up')


def _clean(o, ndigits):
    if isinstance(o, float):
        if math.isnan(o) or math.isinf(o):
            raise ValueError('NaN/inf reached a JSON output')
        r = round(o, ndigits)
        return 0.0 if r == 0 else r
    if isinstance(o, dict):
        return {str(k): _clean(v, ndigits) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v, ndigits) for v in o]
    if hasattr(o, 'item'):             # numpy scalar
        return _clean(o.item(), ndigits)
    return o


def write_json(name, obj, ndigits=9, pretty=False):
    """Write DATA/name deterministically: sorted keys, rounded floats, no NaN, LF, trailing newline."""
    path = os.path.join(DATA, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    txt = json.dumps(_clean(obj, ndigits), sort_keys=True, ensure_ascii=False,
                     indent=1 if pretty else None, separators=(',', ':') if not pretty else (',', ': '))
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(txt + '\n')
    return path


def write_bin(name, data: bytes):
    path = os.path.join(DATA, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)
    return path
