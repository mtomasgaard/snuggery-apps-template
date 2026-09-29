"""Shared code for build_vessels.py and build_extras.py: reads the Human-Atlas chunk format
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
    return compact(uq * grid, F[keep])

def compact(P, F):
    """Drop vertices no triangle uses (some source meshes carry stray ones far from the surface)."""
    used, F2 = np.unique(F.reshape(-1), return_inverse=True)
    return P[used], F2.reshape(-1, 3)

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

# ---------- placing BodyParts3D 4.0 meshes on the 3.0 body ----------
# The releases share a frame only roughly: 4.0 moved the head 10-16 mm back and the heart about 4 mm,
# and remodelled the legs, whose bones sit up to 56 mm lower below the knee. BodyMap measures that from
# every structure present in both releases as one mesh: each pair gives a per-axis scale and offset
# (box to box), sampled at the box corners and centre. Any other 4.0 point is moved by a Gaussian-weighted
# blend of the nearest samples, vertex by vertex, so a new mesh follows the structures around it and a
# long vessel bends smoothly from one region's correction to the next.
# 3.0 structures whose 4.0 counterparts are several meshes not listed under the same concept.
COMPOSITES = {'FMA7274': r'^wall of (ventricle|left atrium|right atrium)$',      # heart wall
              'FMA7409': r'bronch',                                              # bronchial tree
              'FMA71704': r'nasal cartilage$|major alar cartilage$',             # nasal cartilages
              'FMA12513': r'^(left|right) (sclera|cornea)$'}                     # the two eyeballs

def bodymap_pairs(geometry, anatomy, atlas, ratio=(0.8, 1.25)):
    """(id, 3.0 box, 4.0 box) for every structure present in both releases: one mesh under the same concept,
    or a 3.0 structure that 4.0 splits into several meshes (its concept's elements, or COMPOSITES), when
    the boxes are of similar size."""
    import collections, re
    parts = {p['id']: p for p in atlas['parts']}
    concepts = {c['id']: c['elements'] for c in atlas['concepts']}
    byc = collections.defaultdict(list)
    for p in atlas['parts']: byc[p['conceptId']].append(p)
    out = []
    for g in geometry['parts']:
        if g['id'].startswith('FJ'): continue                          # our own 4.0 output
        fid = g['id'].replace('nsn', '')
        if fid in COMPOSITES:
            t = [p for p in atlas['parts'] if p['system'] not in ('arterial', 'venous') and re.search(COMPOSITES[fid], p['name'].lower())]
        else:
            t = byc.get(fid) or [parts[e] for e in concepts.get(fid, []) if e in parts]
        if not t: continue
        g0, g1 = np.array(g['min']), np.array(g['max'])
        t0 = np.min([p['bounds'][0] for p in t], 0); t1 = np.max([p['bounds'][1] for p in t], 0)
        gs, ts = g1 - g0, t1 - t0
        if (ts < 0.004).any() or not ((gs / ts > ratio[0]) & (gs / ts < ratio[1])).all(): continue
        out.append((g['id'], g0.tolist(), g1.tolist(), t0.tolist(), t1.tolist()))
    return out

def load_bodymap(geometry, anatomy, atlas, path):
    """The map is measured on the untouched 3.0 body, straight after build_full.py, and kept in
    tools/source/bodymap_pairs.json, so later steps that replace 3.0 structures do not change it."""
    import os, json
    fresh = not any(p['id'].startswith('FJ') for p in geometry['parts'])
    if fresh: json.dump(bodymap_pairs(geometry, anatomy, atlas), open(path, 'w'), indent=0)
    elif not os.path.exists(path): raise SystemExit(f'{path} is missing: run build_full.py, then this step, to measure it')
    return BodyMap(json.load(open(path)))

class BodyMap:
    def __init__(self, pairs, sigma=0.02):
        import itertools
        corners = np.array(list(itertools.product([0, 1], repeat=3)) + [(0.5, 0.5, 0.5)])
        src, dst, owner = [], [], []
        self.names = [p[0] for p in pairs]
        for k, (pid, g0, g1, t0, t1) in enumerate(pairs):
            g0, g1, t0, t1 = map(np.array, (g0, g1, t0, t1))
            src.append(t0 + corners * (t1 - t0)); dst.append(g0 + corners * (g1 - g0)); owner += [k] * len(corners)
        self.src = np.vstack(src); self.d = np.vstack(dst) - self.src; self.owner = np.array(owner); self.sigma = sigma
    def disp(self, X, exclude=None):
        X = np.atleast_2d(X); out = np.empty_like(X)
        for i in range(0, len(X), 2048):
            x = X[i:i + 2048]
            d2 = ((x[:, None, :] - self.src[None]) ** 2).sum(2)
            if exclude is not None: d2[:, self.owner == exclude] = np.inf
            w = np.exp(-(d2 - d2.min(1, keepdims=True)) / (2 * self.sigma ** 2))
            out[i:i + 2048] = (w @ self.d) / w.sum(1, keepdims=True)
        return out
    def place(self, P):
        """4.0 vertex positions (4.0 frame, metres) -> 3.0 frame."""
        return P + self.disp(P)
    def report(self):
        errs, flat = [], []
        med = np.median(self.d, 0)
        for k in range(len(self.names)):
            m = self.owner == k
            e = np.linalg.norm(self.disp(self.src[m], exclude=k) - self.d[m], axis=1)
            errs.append(np.median(e)); flat.append(np.median(np.linalg.norm(self.d[m] - med, axis=1)))
        errs, flat = np.array(errs), np.array(flat)
        return (f'{len(self.names)} structures in both releases; leave-one-out error median {np.median(errs) * 1000:.1f} mm, 90% {np.percentile(errs, 90) * 1000:.1f} mm '
                f'(one fixed offset: median {np.median(flat) * 1000:.1f}, 90% {np.percentile(flat, 90) * 1000:.1f} mm)')

def drop_strays(P, F, frac=0.1, dist=0.02):
    """Remove small disconnected pieces lying away from the main body of a mesh (source defects)."""
    n = len(P); parent = np.arange(n)
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for a, b, c in F:
        ra, rb, rc = find(a), find(b), find(c)
        parent[rb] = ra; parent[find(rc)] = ra
    roots = np.array([find(i) for i in range(n)])
    froot = roots[F[:, 0]]
    labels, counts = np.unique(froot, return_counts=True)
    if len(labels) == 1: return P, F, 0
    main = labels[np.argmax(counts)]
    mv = np.unique(F[froot == main]); c0, c1 = P[mv].min(0), P[mv].max(0)
    keep = np.ones(len(F), bool)
    for lab, cnt in zip(labels, counts):
        if lab == main or cnt > frac * len(F): continue
        v = np.unique(F[froot == lab]); c = P[v].mean(0)
        gap = np.linalg.norm(np.maximum(0, np.maximum(c0 - c, c - c1)))
        if gap > dist: keep &= froot != lab
    P2, F2 = compact(P, F[keep])
    return P2, F2, int((~keep).sum())

def repack(data_dir, geometry, additions):
    """Rewrite each layer's .bin from the kept parts (copied as stored) plus `additions`
    ({layer: [(id, P, F)]}); returns the new geometry manifest. Parts not in geometry['parts'] are dropped."""
    import os
    files = geometry['files']; by_file = {}
    for p in geometry['parts']: by_file.setdefault(p['f'], []).append(p)
    layer_file = {f['layer']: i for i, f in enumerate(files)}
    new_parts = []
    for i, f in enumerate(files):
        src = open(os.path.join(os.path.dirname(data_dir.rstrip('/')), f['url']), 'rb').read()
        blobs, off = [], 0
        def push(bb):
            nonlocal off
            pad = (-off) % 4
            if pad: blobs.append(b'\0' * pad); off += pad
            o = off; blobs.append(bb); off += len(bb); return o
        for p in by_file.get(i, []):
            q = dict(p)
            q['p'] = push(src[p['p']:p['p'] + p['v'] * 6])
            q['x'] = push(src[p['x']:p['x'] + p['i'] * (2 if p['t'] == 16 else 4)])
            new_parts.append(q)
        for pid, P, F in additions.get(f['layer'], []):
            P = np.asarray(P, dtype=np.float64); b0 = P.min(0); b1 = P.max(0); rng = np.where(b1 - b0 > 0, b1 - b0, 1)
            qv = np.round((P - b0) / rng * 65535).astype(np.uint16)
            nv = len(P); I = np.asarray(F).astype(np.uint16 if nv < 65536 else np.uint32).reshape(-1)
            new_parts.append(dict(id=pid, f=i, v=nv, i=int(I.size), p=push(qv.tobytes()), x=push(I.tobytes()), t=16 if nv < 65536 else 32,
                                  min=[round(float(v), 6) for v in b0], max=[round(float(v), 6) for v in b1]))
        open(os.path.join(os.path.dirname(data_dir.rstrip('/')), f['url']), 'wb').write(b''.join(blobs))
        f['bytes'] = off
    missing = set(additions) - set(layer_file)
    assert not missing, f'no .bin for layers {missing}'
    geometry['parts'] = new_parts
    geometry['triangles'] = sum(p['i'] // 3 for p in new_parts)
    return geometry
