"""Helpers every pipeline step shares: pinned downloads, deterministic output, small numeric tools.

Every source the pipeline reads is fetched through fetch(), which knows the file's sha256 in advance
and refuses anything else. A file already in the cache is used as it is; a file present in the
EARTHHISTORY_SEED folder with the right hash is hard-linked instead of downloaded again. Nothing is
ever fetched twice, and a changed upstream file stops the build rather than silently changing it.

Copied from Template/milky-way/tools/common.py and adapted (the environment prefix, the retrieval
date, fetch_zip_member() for hosts that honour HTTP Range requests). Copied, never imported across
apps, so deleting one app cannot break another.

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
RETRIEVED = '2026-09-30'


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
    """Find a file in EARTHHISTORY_SEED with this sha256 (index built once, by size then hash)."""
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


def _range(url, start, end):
    """Bytes [start, end] (inclusive) of `url`; refuses a server that ignores the Range header."""
    r = subprocess.run(['curl', '-sSfL', '--retry', '4', '--retry-delay', '2', '-D', '-',
                        '-r', f'{start}-{end}', '-o', '-', url], check=True, capture_output=True)
    raw = r.stdout
    # -D - puts every response's headers first (one block per redirect); the body follows the last.
    blocks = raw.split(b'\r\n\r\n')
    i = 0
    while i < len(blocks) and blocks[i].startswith(b'HTTP/'):
        i += 1
    head = blocks[i - 1]
    body = b'\r\n\r\n'.join(blocks[i:])
    if b' 206' not in head.split(b'\r\n', 1)[0]:
        raise RuntimeError(f'{url}: server ignored the Range request ({head.splitlines()[0]!r})')
    if len(body) != end - start + 1:
        raise RuntimeError(f'{url}: asked for {end - start + 1} bytes, got {len(body)}')
    return body


def fetch_zip_member(url, zip_size, member, name, sha256):
    """One member of a remote ZIP, read with HTTP Range requests (central directory, then the
    member's local header and data) and cached as CACHE/name, verified against `sha256`.

    `zip_size` is the archive's byte length (from the pin), so the end-of-central-directory record
    can be read without a HEAD request. Only stored and deflated members are supported."""
    import struct
    import zlib
    dest = os.path.join(CACHE, name)
    if os.path.exists(dest):
        got = sha256_of(dest)
        if got != sha256:
            sys.exit(f'{dest}: sha256 {got} does not match the pin {sha256} — delete it and rerun')
        return dest
    if _from_seed(sha256, dest):
        print(f'  seeded {name}')
        return dest
    tail_len = min(zip_size, 65536 + 22)
    tail = _range(url, zip_size - tail_len, zip_size - 1)
    eocd = tail.rfind(b'PK\x05\x06')
    if eocd < 0:
        raise RuntimeError(f'{url}: no end-of-central-directory record')
    cd_size, cd_off = struct.unpack('<II', tail[eocd + 12:eocd + 20])
    if cd_off == 0xFFFFFFFF:                       # ZIP64: the locator sits just before the EOCD
        loc = tail.rfind(b'PK\x06\x07', 0, eocd)
        z64_off = struct.unpack('<Q', tail[loc + 8:loc + 16])[0]
        z64 = _range(url, z64_off, z64_off + 55)
        cd_size, cd_off = struct.unpack('<QQ', z64[40:56])
    cd = _range(url, cd_off, cd_off + cd_size - 1)
    p = 0
    while p < len(cd):
        (sig, _vm, _vn, _fl, method, _t, _d, _crc, csize, usize, nlen, xlen, clen,
         _dn, _ia, _ea, loff) = struct.unpack('<IHHHHHHIIIHHHHHII', cd[p:p + 46])
        assert sig == 0x02014b50, 'bad central directory entry'
        fname = cd[p + 46:p + 46 + nlen].decode('utf-8', 'replace')
        extra = cd[p + 46 + nlen:p + 46 + nlen + xlen]
        if fname == member:
            if 0xFFFFFFFF in (csize, usize, loff):  # ZIP64 extra field (id 1) holds the real values
                q = 0
                while q < len(extra):
                    hid, hlen = struct.unpack('<HH', extra[q:q + 4])
                    if hid == 1:
                        vals = list(struct.unpack('<' + 'Q' * (hlen // 8), extra[q + 4:q + 4 + hlen]))
                        if usize == 0xFFFFFFFF:
                            usize = vals.pop(0)
                        if csize == 0xFFFFFFFF:
                            csize = vals.pop(0)
                        if loff == 0xFFFFFFFF:
                            loff = vals.pop(0)
                    q += 4 + hlen
            lh = _range(url, loff, loff + 29)
            lnlen, lxlen = struct.unpack('<HH', lh[26:30])
            start = loff + 30 + lnlen + lxlen
            comp = _range(url, start, start + csize - 1) if csize else b''
            if method == 0:
                data = comp
            elif method == 8:
                data = zlib.decompress(comp, -15)
            else:
                raise RuntimeError(f'{member}: compression method {method} not supported')
            if len(data) != usize:
                raise RuntimeError(f'{member}: expected {usize} bytes, inflated {len(data)}')
            got = hashlib.sha256(data).hexdigest()
            if got != sha256:
                sys.exit(f'{url}!{member}: sha256 {got} does not match the pin {sha256}')
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest + '.part', 'wb') as f:
                f.write(data)
            os.replace(dest + '.part', dest)
            return dest
        p += 46 + nlen + xlen + clen
    raise FileNotFoundError(f'{member} is not in {url}')


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


def json_text(obj, ndigits=9, pretty=False):
    """The exact text write_json() writes: sorted keys, rounded floats, no NaN, trailing newline."""
    txt = json.dumps(_clean(obj, ndigits), sort_keys=True, ensure_ascii=False,
                     indent=1 if pretty else None, separators=(',', ':') if not pretty else (',', ': '))
    return txt + '\n'


def write_json(name, obj, ndigits=9, pretty=False):
    """Write DATA/name deterministically: sorted keys, rounded floats, no NaN, LF, trailing newline."""
    path = os.path.join(DATA, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json_text(obj, ndigits, pretty))
    return path


def write_bin(name, data: bytes):
    path = os.path.join(DATA, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)
    return path


def write_fragment(step, blocks):
    """tools/credits/fragments/<step>.json: the credits blocks a step contributes (CONTRACT §0),
    sorted keys, one-space indent, trailing newline — the format steps 10 and 20 write."""
    from paths import CREDITS
    fdir = os.path.join(CREDITS, 'fragments')
    os.makedirs(fdir, exist_ok=True)
    path = os.path.join(fdir, f'{step}.json')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(blocks, sort_keys=True, ensure_ascii=False, indent=1) + '\n')
    return path


def write_work(name, obj):
    """tools/work/<name>: an intermediate a later step reads (not shipped), written deterministically."""
    from paths import WORK
    path = os.path.join(WORK, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(_clean(obj, 9), sort_keys=True, ensure_ascii=False, indent=1) + '\n')
    return path
