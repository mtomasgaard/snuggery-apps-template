"""Shared helpers for the Volve pipeline: pinned downloads, hashes, the source manifest.

Every input is listed in sources.json with its URL, byte count and sha256 (GitHub files also with
the git blob id of the pinned commit's tree). A download that does not match stops the pipeline.
Standard library only, so the fetch runs anywhere Python 3.9+ runs.
"""
import hashlib
import json
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "sources.json"
UA = {"User-Agent": "snuggery-volve-pipeline/1.0"}


def load_sources():
    return json.loads(SOURCES.read_text())


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git_blob_sha1(path):
    """The id git gives a file's content (sha1 of 'blob <size>\\0' + bytes)."""
    p = Path(path)
    h = hashlib.sha1(b"blob %d\0" % p.stat().st_size)
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def http_get(url, headers=None, tries=6, timeout=120):
    last = None
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(), dict(r.headers)
        except Exception as e:  # network hiccups: retry with backoff, then give up loudly
            last = e
            time.sleep(min(30, 2 ** n))
    raise RuntimeError(f"GET {url} failed after {tries} tries: {last}")


def http_head(url):
    req = urllib.request.Request(url, method="HEAD", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return dict(r.headers)


def fetch_pinned(entry, dest):
    """Download entry['url'] to dest unless a verified copy is there; verify bytes, sha256, git blob."""
    dest = Path(dest)
    if dest.exists() and dest.stat().st_size == entry["bytes"] and sha256_file(dest) == entry["sha256"]:
        return "cached"
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    req = urllib.request.Request(entry["url"], headers=UA)
    for n in range(6):
        try:
            with urllib.request.urlopen(req, timeout=300) as r, open(part, "wb") as f:
                for chunk in iter(lambda: r.read(1 << 20), b""):
                    f.write(chunk)
            break
        except Exception as e:
            if n == 5:
                raise RuntimeError(f"download failed: {entry['url']}: {e}")
            time.sleep(min(30, 2 ** n))
    size, digest = part.stat().st_size, sha256_file(part)
    if size != entry["bytes"] or digest != entry["sha256"]:
        part.unlink()
        raise SystemExit(f"PIN MISMATCH for {entry['url']}\n  expected {entry['bytes']} B sha256 {entry['sha256']}\n"
                         f"  got      {size} B sha256 {digest}\nThe mirror changed. Do not re-pin without reading the new file.")
    if entry.get("gitBlob") and git_blob_sha1(part) != entry["gitBlob"]:
        part.unlink()
        raise SystemExit(f"GIT BLOB MISMATCH for {entry['url']}")
    part.replace(dest)
    return "downloaded"
