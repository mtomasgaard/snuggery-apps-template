// Step 2: skeleton geometry -> data/geometry.bin + data/geometry.json (skeleton only; build_full.py merges)
// Welds each STL, converts mm Z-up to m Y-up (x, z, -y), simplifies with meshoptimizer
// (keep 45% of triangles or stop at 0.1% relative error, min 400 tris), centres the body
// (x/z centred, feet at y=0) and quantises positions to uint16 per part bounding box.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';
await MeshoptSimplifier.ready;
const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.OUT_DATA || path.join(TOOLS, '..', 'data');
const WORK = process.env.WORK_DIR || path.join(TOOLS, '.work');
const STL = process.env.BP3D_STL_DIR || path.join(TOOLS, '.cache', 'stl');
fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(WORK, { recursive: true });
const RATIO = 0.45, ERR = 0.001, MINTRI = 400;
const sel = JSON.parse(fs.readFileSync(path.join(TOOLS, 'source', 'skeleton_ids.json'), 'utf8'));

function readSTL(p) {
  const b = fs.readFileSync(p); const n = b.readUInt32LE(80);
  const map = new Map(), pos = [], idx = new Uint32Array(n * 3);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12;
    for (let k = 0; k < 3; k++) {
      const x = b.readFloatLE(o + k * 12), y = b.readFloatLE(o + k * 12 + 4), z = b.readFloatLE(o + k * 12 + 8);
      const key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
      let i = map.get(key);
      if (i === undefined) { i = pos.length / 3; map.set(key, i); pos.push(x * 0.001, z * 0.001, -y * 0.001); }
      idx[t * 3 + k] = i;
    }
  }
  const out = [];
  for (let t = 0; t < n; t++) { const a = idx[t * 3], b2 = idx[t * 3 + 1], c = idx[t * 3 + 2]; if (a !== b2 && b2 !== c && a !== c) out.push(a, b2, c); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(out) };
}

const parts = [];
for (const [id, name] of Object.entries(sel)) {
  const m = readSTL(path.join(STL, id + '.stl'));
  const tris = m.idx.length / 3;
  const target = Math.max(Math.min(tris, MINTRI), Math.floor(tris * RATIO)) * 3;
  const [simp] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, ERR, ['LockBorder']);
  const [remap, count] = MeshoptSimplifier.compactMesh(simp);
  const P = new Float32Array(count * 3);
  for (let o = 0; o < remap.length; o++) { const nn = remap[o]; if (nn === 0xffffffff) continue; P.set(m.pos.subarray(o * 3, o * 3 + 3), nn * 3); }
  parts.push({ id, name, pos: P, idx: simp });
}
const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const p of parts) for (let i = 0; i < p.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p.pos[i + k]); mx[k] = Math.max(mx[k], p.pos[i + k]); }
// Soft tissue is centred with the same offsets, so everything lines up.
fs.writeFileSync(path.join(WORK, 'skeleton_bounds.json'), JSON.stringify({ mn, mx }));
const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2, cy = mn[1];
const chunks = []; let off = 0; const out = [];
const push = buf => { const pad = (4 - off % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; } const o = off; chunks.push(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)); off += buf.byteLength; return o; };
for (const p of parts) {
  const n = p.pos.length / 3; const b0 = [1e9, 1e9, 1e9], b1 = [-1e9, -1e9, -1e9];
  for (let i = 0; i < n; i++) { p.pos[i * 3] -= cx; p.pos[i * 3 + 1] -= cy; p.pos[i * 3 + 2] -= cz; for (let k = 0; k < 3; k++) { b0[k] = Math.min(b0[k], p.pos[i * 3 + k]); b1[k] = Math.max(b1[k], p.pos[i * 3 + k]); } }
  const q = new Uint16Array(n * 3);
  for (let i = 0; i < n * 3; i++) { const k = i % 3, r = (b1[k] - b0[k]) || 1; q[i] = Math.round((p.pos[i] - b0[k]) / r * 65535); }
  const po = push(q);
  const I = n < 65536 ? Uint16Array.from(p.idx) : Uint32Array.from(p.idx);
  const io = push(I);
  out.push({ id: p.id, v: n, i: p.idx.length, p: po, x: io, t: n < 65536 ? 16 : 32, min: b0.map(v => +v.toFixed(6)), max: b1.map(v => +v.toFixed(6)) });
}
fs.writeFileSync(path.join(DATA, 'geometry.bin'), Buffer.concat(chunks));
const tris = out.reduce((s, p) => s + p.i / 3, 0);
fs.writeFileSync(path.join(DATA, 'geometry.json'), JSON.stringify({ format: 'uint16-quantized positions per part bbox; uint16/uint32 indices; meters, Y-up, +Z anterior, +X = body left', source: 'BodyParts3D 3.0 (DBCLS), simplified with meshoptimizer', triangles: tris, bytes: off, parts: out }));
console.log(`skeleton: ${out.length} parts, ${tris} triangles, ${(off / 1048576).toFixed(1)} MB`);
