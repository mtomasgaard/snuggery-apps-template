// The streaming terrain: a quadtree of Web Mercator tiles over Norway, chosen every frame by the
// size a map pixel would have on screen, each drawn with one shared 32 x 32-cell grid whose heights
// come from the height store (js/heights.js), with the map, the trails and the normal map as its
// textures (js/material.js), and skirts hanging from every edge so that two neighbors at different
// levels never show a crack.
//
// Nothing waits on the network: a tile whose own map has not arrived shows its nearest ancestor's
// piece of one, a tile whose own heights have not arrived is shaped by its nearest ancestor's, and
// the finer one replaces it when it lands. Budgets (NOTES.md):
//   MAX_NODES tiles drawn at once, MAX_NODES x 2 178 triangles at most;
//   GPU_BUDGET bytes of textures held, the least recently drawn evicted first;
//   the height store's own CPU budget.
//
// Moving looks as sharp as standing still (1.2, the owner's rule): the tile choice is the same in
// motion and at rest, and three things keep detail from ever going backwards while the view moves.
//   Ahead: every frame also chooses tiles for a wider view (a ring around it) and, while the view
//     moves, for where its velocity will carry it; those are asked for after everything in view
//     (loader.js keeps two lanes for the view) and are kept from eviction like the drawn ones.
//   Eviction: a texture drawn this frame or the last is never evicted; one held for the ring ahead
//     goes only after everything else has.
//   Held detail stays: a tile whose four children's maps are held stays split until its texels are
//     half the size the threshold asks for, so backing away or panning past does not swap a finer
//     map that has arrived for a coarser one.

import * as THREE from '../vendor/three.module.js';
import { tileBox, tileSpan, tkey, cosLat, mercX, mercY, NORWAY, EARTH } from './geo.js';
import { HOSTS, mapUrl, trailUrl, MAP_MAX_Z, TRAIL_MIN_Z, TERRARIUM_MAX_Z, DTM_MIN_Z, DTM_MAX_Z } from './sources.js';
import { tileMaterial } from './material.js';
import { normals } from './hcore.js';
import { SNOW_HOST, SNOW_MAX_Z, snowUrl, decodeSnow } from './snow.js';

export const CELLS = 32;
const S = CELLS + 1, SURF = S * S, VERTS = SURF + 4 * S;
export const TRIS_PER_TILE = 2 * CELLS * CELLS + 4 * CELLS * 2;     // 2 304
export const MAX_NODES = 150;
export const GPU_BUDGET = 176 * 1024 * 1024;
export const AHEAD_PRIO = 100;         // everything ahead of the view goes after everything in it
const AHEAD_MAX = 32;                  // tiles asked for ahead of the view at once
const AHEAD_NODES = 240;               // the cap of a choice for a wider or a predicted view
const STICK = 0.5;                     // a split is kept down to this share of the threshold while its children's maps are held
const POOL = MAX_NODES + 50;
const ROOT_Z = 5;
const MAX_Z = MAP_MAX_Z;               // map tiles to z 17 (0.6 m a pixel at 61.5° N)
const OUTSIDE_MAX_Z = 8;               // beyond Norway's box, the sea and the neighbors stay coarse

// Norway's box in Mercator meters, and the root tiles that cover it.
const NB = { x0: mercX(NORWAY.lon0), x1: mercX(NORWAY.lon1), y0: mercY(NORWAY.lat0), y1: mercY(NORWAY.lat1) };
export const NORWAY_MERC = NB;

let template = null;
function buildTemplate() {
  if (template) return template;
  const pos = new Float32Array(VERTS * 3), skirt = new Float32Array(VERTS);
  for (let r = 0, i = 0; r < S; r++) for (let c = 0; c < S; c++, i++) { pos[i * 3] = c / CELLS; pos[i * 3 + 2] = r / CELLS; }
  const ring = [(k) => [k, 0], (k) => [k, CELLS], (k) => [0, k], (k) => [CELLS, k]];
  for (let e = 0; e < 4; e++) for (let k = 0; k < S; k++) {
    const i = SURF + e * S + k, [c, r] = ring[e](k);
    pos[i * 3] = c / CELLS; pos[i * 3 + 2] = r / CELLS; skirt[i] = 1;
  }
  const idx = new Uint16Array(TRIS_PER_TILE * 3);
  let n = 0;
  for (let r = 0; r < CELLS; r++) for (let c = 0; c < CELLS; c++) {
    const A = r * S + c, B = A + 1, C = A + S, D = C + 1;
    idx[n++] = A; idx[n++] = C; idx[n++] = B; idx[n++] = B; idx[n++] = C; idx[n++] = D;
  }
  const top = [(k) => k, (k) => CELLS * S + k, (k) => k * S, (k) => k * S + CELLS];
  const flip = [false, true, true, false];
  for (let e = 0; e < 4; e++) {
    const base = SURF + e * S;
    for (let k = 0; k < CELLS; k++) {
      const T0 = top[e](k), T1 = top[e](k + 1), B0 = base + k, B1 = base + k + 1;
      if (flip[e]) { idx[n++] = T0; idx[n++] = B0; idx[n++] = T1; idx[n++] = T1; idx[n++] = B0; idx[n++] = B1; }
      else { idx[n++] = T0; idx[n++] = T1; idx[n++] = B0; idx[n++] = T1; idx[n++] = B1; idx[n++] = B0; }
    }
  }
  template = { position: new THREE.BufferAttribute(pos, 3), skirt: new THREE.BufferAttribute(skirt, 1), index: new THREE.BufferAttribute(idx, 1), top };
  return template;
}

/** The height tile a map tile at (z, x, y) is shaped by, when everything has arrived. */
export function heightSource(z, x, y) {
  if (z <= TERRARIUM_MAX_Z) return ['T', z, x, y];
  const hz = Math.min(DTM_MAX_Z, z - 1), k = z - hz;
  return ['D', Math.max(DTM_MIN_Z, hz), x >> k, y >> k];
}

export class Terrain {
  constructor({ renderer, frame, heights, loader, shared, onTexture }) {
    this.renderer = renderer;
    this.frame = frame;
    this.heights = heights;
    this.loader = loader;
    this.shared = shared;
    this.onTexture = onTexture;
    this.group = new THREE.Group();
    this.slots = new Map();          // node key -> slot
    this.pool = [];
    this.tex = new Map();            // texture key -> { tex, bytes, used }
    this.gpuBytes = 0;
    this.frameNo = 0;
    this.style = 'topo';
    this.trails = true;
    this.wantHeights = true;
    this.flat = 1;
    this.snowDate = null;          // a date string when the seNorge layer is on
    this.snowTiles = new Map();    // key -> decoded classes, for the card
    this.anis = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.stats = { drawn: 0, triangles: 0, capped: false, rebuilt: 0, gpuMB: 0, liveMB: 0, evicted: 0, evictedNear: 0, ahead: 0, sticky: 0, waitingMap: 0, waitingHeight: 0 };
    this._near = false;            // while choosing tiles ahead of the view: touches mark `near`, not `used`
    this.cover = { map: 0, height: 0, fine: 0 };
  }

  // ---------- textures ----------
  _texture(key) { const t = this.tex.get(key); if (t) { if (this._near) t.near = this.frameNo; else t.used = this.frameNo; } return t || null; }
  _addTexture(key, tex, bytes) {
    // a tile that arrives is new in the view or just ahead of it: kept until the next frame says which
    this.tex.set(key, { tex, bytes, used: 0, near: this.frameNo });
    this.gpuBytes += bytes;
  }
  /** Over the budget, in this order: tiles loaded ahead that were never drawn and are no longer
   *  ahead; then tiles drawn before, the least recently drawn first, so ground already seen is kept
   *  as long as the budget allows; tiles held for the ring ahead (`near`) only after all of those
   *  (counted: evictedNear). Never one drawn this frame or the last. */
  _evict() {
    let live = 0;
    let ahead = 0;
    for (const t of this.tex.values()) { if (t.used >= this.frameNo - 1) live += t.bytes; else if (t.near >= this.frameNo - 1) ahead += t.bytes; }
    this.stats.aheadMB = ahead / 1048576;
    this.stats.liveMB = live / 1048576;
    if (this.gpuBytes <= GPU_BUDGET) return;
    const f = this.frameNo, rank = (t) => (t.near >= f - 1 ? 2 * f + t.near : t.used > 0 ? t.used : (t.near || 0) * 1e-9);
    const old = [...this.tex.entries()].filter(([, t]) => t.used < f - 1).sort((a, b) => rank(a[1]) - rank(b[1]));
    for (const [k, t] of old) {
      if (this.gpuBytes <= GPU_BUDGET * 0.9) break;
      t.tex.dispose();
      this.tex.delete(k);
      this.gpuBytes -= t.bytes;
      this.loader.forget(k);
      this.stats.evicted++;
      if (t.near >= f - 1) this.stats.evictedNear++;
    }
  }
  /** Ask for the map tile (z, x, y), or touch it when held; true when held. */
  _wantMap(z, x, y, prio) {
    const key = `m${this.style}${z}/${x}/${y}`;
    if (this._texture(key)) return true;
    this.loader.want(key, mapUrl(this.style, z, x, y), HOSTS.map, prio, (img) => {
      if (!img) return;
      this._addTexture(key, this._imageTexture(img, true), 256 * 256 * 4 * 4 / 3);
      if (this.onTexture) this.onTexture();
    });
    return false;
  }
  _wantTrail(z, x, y, prio) {
    const key = `t${z}/${x}/${y}`;
    if (this._texture(key)) return true;
    this.loader.want(key, trailUrl(z, x, y), HOSTS.trails, prio, (img) => {
      if (!img) return;
      // no mipmaps: thin lines, read near their own size; 256 KB a tile
      this._addTexture(key, this._imageTexture(img, false), 256 * 256 * 4);
      if (this.onTexture) this.onTexture();
    });
    return false;
  }
  _imageTexture(img, mip) {
    const t = new THREE.Texture(img);
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.anis;
    t.generateMipmaps = mip;
    t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }
  /** The map texture for (z, x, y), or its nearest ancestor's with the piece to read. */
  _mapFor(z, x, y, prio) {
    const key = `m${this.style}${z}/${x}/${y}`;
    let t = this._texture(key);
    if (!t) {
      this.stats.waitingMap++;
      this._wantMap(z, x, y, prio);
      for (let k = 1; k <= z; k++) {
        t = this._texture(`m${this.style}${z - k}/${x >> k}/${y >> k}`);
        if (t) return { tex: t.tex, xf: xform(x, y, k), exact: false };
      }
      return null;
    }
    return { tex: t.tex, xf: IDENT, exact: true };
  }
  _trailFor(z, x, y, prio) {
    // in 3D a far tile's trails would be a pixel wide: from z 12 there, from z 10 on the map
    if (z < (this.flat < 1 ? 12 : TRAIL_MIN_Z)) return null;
    const key = `t${z}/${x}/${y}`;
    let t = this._texture(key);
    if (!t) {
      this._wantTrail(z, x, y, prio);
      for (let k = 1; k <= 2 && z - k >= TRAIL_MIN_Z; k++) {
        t = this._texture(`t${z - k}/${x >> k}/${y >> k}`);
        if (t) return { tex: t.tex, xf: xform(x, y, k) };
      }
      return null;
    }
    return { tex: t.tex, xf: IDENT };
  }
  /** The seNorge snow texture for (z, x, y): its own z 9 ancestor's, or a coarser one's. */
  _snowFor(z, x, y, prio) {
    const zs = Math.min(z, SNOW_MAX_Z), k0 = z - zs, sx = x >> k0, sy = y >> k0;
    const key = `s${this.snowDate}/${zs}/${sx}/${sy}`;
    let t = this._texture(key);
    if (!t) {
      this.loader.want(key, snowUrl(this.snowDate, zs, sx, sy), SNOW_HOST, prio, (img) => {
        if (!img) return;
        const d = decodeSnow(img);
        const tex = new THREE.DataTexture(d.amount, 256, 256, THREE.RedFormat, THREE.UnsignedByteType);
        tex.flipY = false; tex.unpackAlignment = 1; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
        this._addTexture(key, tex, 256 * 256);
        this.snowTiles.set(key, { cls: d.cls, z: zs, x: sx, y: sy });
        if (this.snowTiles.size > 64) this.snowTiles.delete(this.snowTiles.keys().next().value);
        if (this.onTexture) this.onTexture();
      });
      for (let k = 1; k <= 4 && zs - k >= 4; k++) {
        t = this._texture(`s${this.snowDate}/${zs - k}/${sx >> k}/${sy >> k}`);
        if (t) return { tex: t.tex, xf: xform(x, y, k0 + k) };
      }
      return null;
    }
    return { tex: t.tex, xf: k0 ? xform(x, y, k0) : IDENT };
  }
  /** The modeled snow class at Mercator (X, Y), from the tiles held, or null. */
  snowAt(X, Y) {
    if (!this.snowDate) return null;
    for (let z = SNOW_MAX_Z; z >= 4; z--) {
      const s = tileSpan(z), x = Math.floor((X + Math.PI * 6378137) / s), y = Math.floor((Math.PI * 6378137 - Y) / s);
      const d = this.snowTiles.get(`s${this.snowDate}/${z}/${x}/${y}`);
      if (!d) continue;
      const b = tileBox(z, x, y), c = Math.min(255, Math.floor(((X - b.x0) / s) * 256)), r = Math.min(255, Math.floor(((b.y1 - Y) / s) * 256));
      const v = d.cls[r * 256 + c];
      return v === 255 ? null : v;
    }
    return null;
  }
  _normalFor(rec) {
    const key = `n${rec.key}`;
    let t = this._texture(key);
    if (t && t.ver === rec.ver) return t.tex;
    if (t) { t.tex.dispose(); this.tex.delete(key); this.gpuBytes -= t.bytes; }
    // the decoder's normals the first time; after the CPU copy has gone (below), the same function
    // over the same heights (js/hcore.js), so a rebuilt texture is the same texture
    const nrm = rec.nrm || normals(rec.h, rec.n, rec.z, rec.y, new Uint8Array(rec.n * rec.n * 2));
    const tex = new THREE.DataTexture(nrm, rec.n, rec.n, THREE.RGFormat, THREE.UnsignedByteType);
    tex.flipY = false;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.unpackAlignment = 2;
    tex.needsUpdate = true;
    // Once uploaded, the normals live on the GPU only: the CPU copy is let go (js/heights.js stops
    // counting it), which halves what a 1 m tile holds on the CPU, from 1 MB to 512 KB.
    tex.onUpdate = () => { tex.image = { data: null, width: rec.n, height: rec.n }; this.heights.dropNormals(rec); };
    this._addTexture(key, tex, rec.n * rec.n * 2 * 4 / 3);
    this.tex.get(key).ver = rec.ver;
    this._texture(key);
    return tex;
  }

  /** The height tile that shapes (z, x, y) now: its own when held, else the nearest that is. */
  _heightFor(z, x, y, prio, want, mark = true) {
    const [kind, hz, hx, hy] = heightSource(z, x, y);
    const touch = (r) => { if (!mark) return r; if (this._near) r.near = this.heights.frameNo; else r.used = this.heights.frameNo; return r; };
    let rec = this.heights.get(kind, hz, hx, hy);
    if (rec) return touch(rec);
    if (want) { this.heights.want(kind, hz, hx, hy, prio); if (!this._near) this.stats.waitingHeight++; }
    // nearest held: DTM1 from the wanted level down, then Terrarium
    if (kind === 'D') {
      for (let k = 1; hz - k >= DTM_MIN_Z; k++) {
        rec = this.heights.get('D', hz - k, hx >> k, hy >> k);
        if (rec) return touch(rec);
      }
    }
    const tz = Math.min(z, TERRARIUM_MAX_Z);
    for (let k = z - tz; k <= z; k++) {
      rec = this.heights.get('T', z - k, x >> k, y >> k);
      if (rec) return touch(rec);
    }
    return null;
  }

  // ---------- slots: one mesh and material per drawn tile ----------
  _slot(key) {
    let s = this.slots.get(key);
    if (s) return s;
    if (this.pool.length < POOL) {
      const tpl = buildTemplate();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', tpl.position);
      geo.setAttribute('aSkirt', tpl.skirt);
      geo.setIndex(tpl.index);
      const aHeight = new THREE.BufferAttribute(new Float32Array(VERTS), 1);
      aHeight.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aHeight', aHeight);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e12);
      const mat = tileMaterial(this.shared);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      mesh.visible = false;
      this.group.add(mesh);
      s = { mesh, mat, aHeight, key: null, hKey: null, used: 0 };
      this.pool.push(s);
    } else {
      s = null;
      for (const p of this.pool) if (p.used < this.frameNo && (!s || p.used < s.used)) s = p;
      if (!s) return null;
      this.slots.delete(s.key);
    }
    s.key = key; s.hKey = null;
    this.slots.set(key, s);
    return s;
  }
  _shape(s, node, rec) {
    const hk = rec ? `${rec.key}#${rec.ver}` : 'flat';
    if (s.hKey === hk) return;
    s.hKey = hk;
    const H = s.aHeight.array, b = node.box;
    if (!rec) H.fill(0);
    else {
      for (let r = 0; r < S; r++) {
        const Y = b.y1 - (r / CELLS) * b.s;
        for (let c = 0; c < S; c++) H[r * S + c] = this.heights.sample(rec, b.x0 + (c / CELLS) * b.s, Y);
      }
      const top = buildTemplate().top;
      for (let e = 0; e < 4; e++) for (let k = 0; k < S; k++) H[SURF + e * S + k] = H[top[e](k)];
    }
    s.aHeight.needsUpdate = true;
    this.stats.rebuilt++;
  }

  // ---------- the quadtree ----------
  /** The tiles a camera would draw: split while a map pixel would cover more than `thr` screen
   *  pixels (kPix: screen pixels per scene unit at distance 1), at most `maxNodes`. A tile whose
   *  children's maps are all held stays split down to STICK x thr, so held detail is kept. */
  _select(camera, kPix, thr, tgt, maxNodes) {
    const f = this.frame, c0 = f.c0;
    camera.updateMatrixWorld();
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _fr.setFromProjectionMatrix(_m);
    const cam = camera.position;
    const flat = this.flat >= 0.999;

    const node = (z, x, y) => {
      const b = tileBox(z, x, y);
      const sx0 = f.sx(b.x0), sx1 = f.sx(b.x1), szN = f.sz(b.y1), szS = f.sz(b.y0);
      let y0 = 0, y1 = 0;
      if (!flat) {
        const rec = this._heightFor(z, x, y, 0, false, !this._near);   // a wider view's bounds protect nothing
        const vs = f.vs((b.y0 + b.y1) / 2);
        const lo = rec ? Math.max(0, rec.lo) : 0, hi = rec ? Math.max(0, rec.hi) : 2500;
        const dx = Math.max(Math.abs(sx0 - tgt.x), Math.abs(sx1 - tgt.x)), dz = Math.max(Math.abs(szN - tgt.z), Math.abs(szS - tgt.z));
        const g = cosLat((b.y0 + b.y1) / 2) / c0;
        const drop = ((dx * dx + dz * dz) * g * g) / (2 * EARTH);
        y0 = (lo - drop - 0.06 * b.s * cosLat(b.y0)) * vs * (1 - this.flat); y1 = (hi + 30) * vs * (1 - this.flat);
      }
      _box.min.set(sx0, Math.min(y0, y1) - 1, szN); _box.max.set(sx1, Math.max(y0, y1) + 1, szS);
      if (!_fr.intersectsBox(_box)) return null;
      _box.clampPoint(cam, _v);
      const dist = Math.max(1, _v.distanceTo(cam));
      const texel = (b.s * c0) / 256;
      const inNorway = b.x1 > NB.x0 && b.x0 < NB.x1 && b.y1 > NB.y0 && b.y0 < NB.y1;
      return { z, x, y, b, box: b, dist, err: (texel * kPix) / dist, maxZ: inNorway ? MAX_Z : OUTSIDE_MAX_Z, key: tkey(z, x, y) };
    };
    const kidsOf = (n) => {
      const kids = [];
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const k = node(n.z + 1, n.x * 2 + i, n.y * 2 + j); if (k) kids.push(k); }
      return kids;
    };
    const held = (k) => this.tex.has(`m${this.style}${k.z}/${k.x}/${k.y}`);

    // roots: the z 5 tiles over Norway's box
    const heap = [];
    const s5 = tileSpan(ROOT_Z), H = Math.PI * 6378137;
    const rx0 = Math.floor((NB.x0 + H) / s5), rx1 = Math.floor((NB.x1 + H) / s5);
    const ry0 = Math.floor((H - NB.y1) / s5), ry1 = Math.floor((H - NB.y0) / s5);
    for (let x = rx0; x <= rx1; x++) for (let y = ry0; y <= ry1; y++) { const n = node(ROOT_Z, x, y); if (n) heap.push(n); }
    let count = heap.length, capped = false, sticky = 0;
    const kept = [];
    while (heap.length) {
      // the largest error first, so a cap leaves the far field coarse, never the near one
      let bi = 0;
      for (let i = 1; i < heap.length; i++) if (heap[i].err > heap[bi].err) bi = i;
      const n = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
      if (n.z >= n.maxZ) { kept.push(n); continue; }
      let kids = null;
      if (n.err <= thr) {
        // fine enough: split anyway only where the children's own maps are already held
        if (n.err <= thr * STICK) { kept.push(n); continue; }
        kids = kidsOf(n);
        if (!kids.length || !kids.every(held) || count - 1 + kids.length > maxNodes) { kept.push(n); continue; }
        sticky++;
      } else kids = kidsOf(n);
      if (count - 1 + kids.length > maxNodes) { kept.push(n); capped = true; continue; }
      count += kids.length - 1;
      heap.push(...kids);
    }
    return { kept, capped, sticky };
  }

  /** Ask, after everything in view, for the tiles of the wider and the predicted views that are not
   *  drawn now: their maps, trails and heights, and keep what is held of them from eviction. */
  _ahead(cams, kPix, thr, tgt, drawn) {
    const seen = new Set(drawn), list = [];
    this._near = true;
    for (const c of cams) {
      if (list.length >= AHEAD_MAX) break;
      const { kept } = this._select(c, kPix, thr, tgt, AHEAD_NODES);
      kept.sort((a, b) => a.dist - b.dist);
      for (const n of kept) {
        if (list.length >= AHEAD_MAX) break;
        if (seen.has(n.key)) continue;
        seen.add(n.key);
        list.push(n);
      }
    }
    let i = 0;
    for (const n of list) {
      const prio = AHEAD_PRIO + i++;
      this._wantMap(n.z, n.x, n.y, prio);
      if (this.trails && n.z >= (this.flat < 1 ? 12 : TRAIL_MIN_Z)) this._wantTrail(n.z, n.x, n.y, prio + 0.5);
      if (this.wantHeights) {
        const rec = this._heightFor(n.z, n.x, n.y, prio + 0.25, true);
        if (rec) this._texture(`n${rec.key}`);
      }
    }
    this._near = false;
    this.stats.ahead = list.length;
    this.aheadList = list;
  }

  /** Choose and prepare the tiles for this camera. `thr` is the most screen pixels a map pixel may
   *  cover before its tile is split. `ahead`: cameras whose tiles are asked for after the view's. */
  update(camera, viewportPx, { thr = 1.25, target, want = true, ahead = null } = {}) {
    this.frameNo++;
    this.heights.frameNo = this.frameNo;
    this.stats.waitingMap = 0; this.stats.waitingHeight = 0;
    const f = this.frame;
    const kPix = (viewportPx / 2) / Math.tan((camera.fov * Math.PI / 180) / 2);
    const tgt = target || { x: 0, z: 0 };
    const { kept, capped, sticky } = this._select(camera, kPix, thr, tgt, MAX_NODES);
    this.stats.sticky = sticky;

    // prepare what is drawn; ask for what is missing, the nearest and coarsest first
    for (const s of this.pool) s.mesh.visible = false;
    let tris = 0, mapExact = 0, hExact = 0, fine = 0, hLo = Infinity, hHi = -Infinity;
    kept.sort((a, b) => a.dist - b.dist);
    const near = kept.length ? kept[0].dist : 1;
    for (const n of kept) {
      const prio = n.z * 0.25 + Math.log2(1 + n.dist / near);
      const s = this._slot(n.key);
      if (!s) continue;
      s.used = this.frameNo;
      const u = s.mat.uniforms;
      u.uTile.value.set(f.sx(n.b.x0), f.sx(n.b.x1), f.sz(n.b.y1), f.sz(n.b.y0));
      u.uSkirt.value = Math.max(15, 0.04 * n.b.s * cosLat(n.b.y0));
      const m = want ? this._mapFor(n.z, n.x, n.y, prio) : null;
      if (m) { u.uMap.value = m.tex; u.uMapXf.value.copy(m.xf); u.uMapOn.value = 1; if (m.exact) mapExact++; } else { u.uMapOn.value = 0; u.uMap.value = this.shared._dummy; }
      const t = this.trails && want ? this._trailFor(n.z, n.x, n.y, prio + 1) : null;
      if (t) { u.uTrail.value = t.tex; u.uTrailXf.value.copy(t.xf); u.uTrailOn.value = 1; } else { u.uTrailOn.value = 0; u.uTrail.value = this.shared._dummy; }
      const sn = this.snowDate && want ? this._snowFor(n.z, n.x, n.y, prio + 1.5) : null;
      if (sn) { u.uSnow.value = sn.tex; u.uSnowXf.value.copy(sn.xf); u.uSnowTexOn.value = 1; } else { u.uSnowTexOn.value = 0; u.uSnow.value = this.shared._dummy; }
      const rec = this.wantHeights ? this._heightFor(n.z, n.x, n.y, prio + 0.5, want) : null;
      this._shape(s, n, rec);
      if (rec) {
        if (s.lo == null || s.hKeyRange !== s.hKey) { const H = s.aHeight.array; let lo = Infinity, hi = -Infinity; for (let i = 0; i < SURF; i++) { if (H[i] < lo) lo = H[i]; if (H[i] > hi) hi = H[i]; } s.lo = lo; s.hi = hi; s.hKeyRange = s.hKey; }
        hLo = Math.min(hLo, Math.max(0, s.lo)); hHi = Math.max(hHi, s.hi);
        u.uNorm.value = this._normalFor(rec);
        u.uNormXf.value.copy(heightXf(n, rec));
        u.uNormOn.value = 1;
        const [k, hz, hx, hy] = heightSource(n.z, n.x, n.y);
        if (rec.kind === k && rec.z === hz && rec.x === hx && rec.y === hy) hExact++;
        if (rec.kind === 'D') fine++;
      } else { u.uNormOn.value = 0; u.uNorm.value = this.shared._dummy; }   // never a disposed texture, which WebGL would upload again
      s.mesh.visible = true;
      tris += TRIS_PER_TILE;
    }
    if (want && ahead && ahead.length) this._ahead(ahead, kPix, thr, tgt, kept.map((n) => n.key));
    else { this.stats.ahead = 0; this.aheadList = []; }
    this._evict();
    this.heights.audit();
    this.kept = kept;
    this.stats.drawn = kept.length;
    this.stats.triangles = tris;
    this.stats.capped = capped;
    this.stats.gpuMB = this.gpuBytes / 1048576;
    this.stats.hLo = hLo; this.stats.hHi = hHi;
    this.cover = { map: kept.length ? mapExact / kept.length : 0, height: kept.length ? hExact / kept.length : 0, fine: kept.length ? fine / kept.length : 0 };
    return this.stats;
  }

  /** After a lost WebGL context comes back: the normal maps kept no CPU copy, so they are made again
   *  from the heights as they are drawn. */
  resetNormals() {
    for (const [k, t] of [...this.tex.entries()]) if (k[0] === 'n') { t.tex.dispose(); this.tex.delete(k); this.gpuBytes -= t.bytes; }
  }
  setStyle(style) { this.style = style; }
  dispose() { for (const t of this.tex.values()) t.tex.dispose(); this.tex.clear(); this.gpuBytes = 0; }
}

const IDENT = new THREE.Vector4(0, 0, 1, 1);
function xform(x, y, k) {
  const n = 2 ** k;
  return new THREE.Vector4((x % n) / n, (y % n) / n, 1 / n, 1 / n);
}
/** Where the node lies inside its height tile, as an offset and a scale of the tile's UV. */
function heightXf(n, rec) {
  const s = rec.box.s;
  return _xf.set((n.b.x0 - rec.box.x0) / s, (rec.box.y1 - n.b.y1) / s, n.b.s / s, n.b.s / s);
}
const _xf = new THREE.Vector4();
const _m = new THREE.Matrix4();
const _fr = new THREE.Frustum();
const _box = new THREE.Box3();
const _v = new THREE.Vector3();
