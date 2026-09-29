"""Shared code for build_vessels.py and build_female.py: reads the Human-Atlas chunk format
(float32 positions, int16 normals, uint32 indices, offsets per part), welds, decimates, quantises
and writes this app's per-layer .bin files (see NOTES.md, "geometry.json and the .bin files")."""
import json, os, re
import numpy as np
import fast_simplification as fsimp
from paths import ATLAS

def load_atlas(name):
    """Manifest plus the raw bytes of every chunk, keyed by chunk index."""
    m = json.load(open(os.path.join(ATLAS, name)))
    chunks = [open(os.path.join(ATLAS, os.path.basename(c['url'])), 'rb').read() for c in m['chunks']]
    return m, chunks

def read_part(chunks, p):
    b = chunks[p['chunk']]
    P = np.frombuffer(b, dtype='<f4', count=p['vertexCount'] * 3, offset=p['positions']).reshape(-1, 3).astype(np.float64)
    F = np.frombuffer(b, dtype='<u4', count=p['indexCount'], offset=p['indices']).reshape(-1, 3).astype(np.int64)
    return P, F

def weld(P, F, grid=1e-5):
    """Merge vertices that coincide to within `grid` metres and drop degenerate triangles."""
    q = np.round(P / grid).astype(np.int64)
    uq, inv = np.unique(q, axis=0, return_inverse=True)
    F = inv.reshape(-1)[F.reshape(-1)].reshape(-1, 3)
    keep = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
    return uq * grid, F[keep]

def merge(pieces):
    """Concatenate several (P, F) meshes into one."""
    Ps, Fs, off = [], [], 0
    for P, F in pieces:
        Ps.append(P); Fs.append(F + off); off += len(P)
    return np.vstack(Ps), np.vstack(Fs)

def decimate(P, F, target, floor=160):
    """Quadric decimation to about `target` triangles, never below `floor`, never up."""
    target = max(min(len(F), floor), int(target))
    if target >= len(F) * 0.98 or len(F) <= 200: return P.astype(np.float32), F.astype(np.int32)
    P2, F2 = fsimp.simplify(P.astype(np.float32), F.astype(np.int32), target_count=target, agg=6)
    return P2, F2

def write_layer(path, url, layer, parts, file_index):
    """parts: list of (id, P, F). Writes the .bin and returns (file entry, manifest part entries)."""
    blobs, off, entries = [], 0, []
    def push(a):
        nonlocal off
        pad = (-off) % 4
        if pad: blobs.append(b'\0' * pad); off += pad
        o = off; bb = a.tobytes(); blobs.append(bb); off += len(bb); return o
    for pid, P, F in parts:
        P = np.asarray(P, dtype=np.float64); F = np.asarray(F)
        b0 = P.min(0); b1 = P.max(0); rng = np.where(b1 - b0 > 0, b1 - b0, 1)
        q = np.round((P - b0) / rng * 65535).astype(np.uint16)
        po = push(q.reshape(-1))
        nv = len(P); I = F.astype(np.uint16 if nv < 65536 else np.uint32).reshape(-1)
        io = push(I)
        entries.append(dict(id=pid, f=file_index, v=nv, i=int(I.size), p=po, x=io, t=16 if nv < 65536 else 32,
                            min=[round(float(v), 6) for v in b0], max=[round(float(v), 6) for v in b1]))
    open(path, 'wb').write(b''.join(blobs))
    return dict(url=url, bytes=off, layer=layer), entries

def side_of(name):
    l = name.lower()
    if re.search(r'\bleft\b|\(left\)', l): return 'left'
    if re.search(r'\bright\b|\(right\)', l): return 'right'
    return None

def cap(s): return s[:1].upper() + s[1:]
