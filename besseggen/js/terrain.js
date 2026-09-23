// The terrain: tile store, height sampling, the two flat analysis grids, and the LOD quadtree.
//
// Tile format (data contract, NOTES/DESIGN.md sections 3 and 6): 65 x 65 uint16 little-endian
// samples per tile, 8450 bytes, row 0 north, column 0 west, quantised per tile between dmin and
// dmax in integer decimetres. Decoding rounds to the integer decimetre BEFORE dividing, which is
// what makes two tiles that share an edge agree bit for bit — the flat analysis grids and the
// crack-free same-level joins both depend on that.

import * as THREE from '../vendor/three.module.js';
import { MaxHeap, clamp } from './util.js';

export const CELLS = 64;              // cells across a tile
export const SAMPLES = CELLS + 1;     // 65 samples, edges shared with the neighbour
const SURF_VERTS = SAMPLES * SAMPLES; // 4225
const SKIRT_VERTS = 4 * SAMPLES;      // 260
export const TILE_VERTS = SURF_VERTS + SKIRT_VERTS;   // 4485
export const TRIS_PER_TILE = 2 * CELLS * CELLS + 4 * CELLS * 2;  // 8704

// The selector never draws more than this. 160 x 8704 = 1.392 M triangles, inside the 1.5 M
// budget with 7 % of headroom. It is a constant, not a hope.
export const MAX_TILES = 160;
const POOL_SLOTS = 200;               // built geometries kept resident; churn above this rebuilds
const SKIRT_CELLS = 4;                // skirt depth = 4 cells, in metres, scaled by exaggeration

// ---------------------------------------------------------------- shared geometry template
// Every tile of every level shares one position buffer and one index buffer. Local coordinates
// are in CELLS (0..64); the mesh scale is (res, 1, res) and the height comes from the aHeight
// attribute in the vertex shader, so one 54 kB template serves all 2783 tiles.
let template = null;
function buildTemplate() {
  if (template) return template;
  const pos = new Float32Array(TILE_VERTS * 3);
  const skirt = new Uint8Array(TILE_VERTS);
  for (let r = 0, i = 0; r < SAMPLES; r++) {
    for (let c = 0; c < SAMPLES; c++, i++) { pos[i * 3] = c; pos[i * 3 + 2] = r; }
  }
  // Skirt bottom rings, in the order north, south, west, east.
  const rings = [
    (k) => [k, 0], (k) => [k, CELLS], (k) => [0, k], (k) => [CELLS, k],
  ];
  for (let e = 0; e < 4; e++) {
    for (let k = 0; k < SAMPLES; k++) {
      const i = SURF_VERTS + e * SAMPLES + k;
      const [c, r] = rings[e](k);
      pos[i * 3] = c; pos[i * 3 + 2] = r; skirt[i] = 255;
    }
  }

  const idx = new Uint16Array(TRIS_PER_TILE * 3);
  let n = 0;
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const A = r * SAMPLES + c, B = A + 1, C = A + SAMPLES, D = C + 1;
      idx[n++] = A; idx[n++] = C; idx[n++] = B;
      idx[n++] = B; idx[n++] = C; idx[n++] = D;
    }
  }
  const top = [
    (k) => k,                          // north row
    (k) => CELLS * SAMPLES + k,        // south row
    (k) => k * SAMPLES,                // west column
    (k) => k * SAMPLES + CELLS,        // east column
  ];
  // Winding chosen per edge so the apron faces outward: north and east one way, south and west
  // the other. Getting this wrong shows up as an invisible skirt from one side only.
  const flip = [false, true, true, false];
  for (let e = 0; e < 4; e++) {
    const base = SURF_VERTS + e * SAMPLES;
    for (let k = 0; k < CELLS; k++) {
      const T0 = top[e](k), T1 = top[e](k + 1), B0 = base + k, B1 = base + k + 1;
      if (flip[e]) { idx[n++] = T0; idx[n++] = B0; idx[n++] = T1; idx[n++] = T1; idx[n++] = B0; idx[n++] = B1; }
      else { idx[n++] = T0; idx[n++] = T1; idx[n++] = B0; idx[n++] = T1; idx[n++] = B1; idx[n++] = B0; }
    }
  }

  template = {
    position: new THREE.BufferAttribute(pos, 3),
    skirt: new THREE.BufferAttribute(skirt, 1, true),
    index: new THREE.BufferAttribute(idx, 1),
  };
  return template;
}

// ---------------------------------------------------------------- the store
export class Terrain {
  constructor(data, frame) {
    this.frame = frame;
    this.m = data.manifest;
    this.levels = this.m.levels.map((L, i) => {
      const map = new Map();
      for (const t of L.tiles) map.set(`${t.tx}:${t.ty}`, t);
      return {
        ...L, i, map,
        buf: data.levelBuffers[i],
        u16: new Uint16Array(data.levelBuffers[i]),
      };
    });
    this.maxLevel = this.levels.length - 1;
    this.minM = this.m.elevation.minM;
    this.maxM = this.m.elevation.maxM;
    this.exag = 1;

    this.pool = [];
    this.byKey = new Map();          // "li:tx:ty" -> slot
    this.clock = 0;
    this.buildBudgetMs = 9;
    this.stats = { tiles: 0, triangles: 0, built: 0, pending: 0, capped: false };

    this._pad = new Float32Array((SAMPLES + 2) * (SAMPLES + 2));
    this.group = new THREE.Group();
    this.group.name = 'terrain';

    this.analysis = { core: null, shell: null };
    this.material = null;
  }

  setMaterial(mat) {
    this.material = mat;
    for (const s of this.pool) s.mesh.material = mat;
  }

  // ---------- decoding ----------
  // The whole decode contract in one place. z_m = (dmin + round(q * (dmax-dmin)/65535)) * 0.1
  decodeTile(L, tile, out) {
    const base = tile.o >> 1;
    const u16 = L.u16, dmin = tile.dmin, span = tile.dmax - tile.dmin;
    const s = span / 65535;
    if (span === 0) { out.fill(dmin * 0.1); return out; }
    for (let i = 0; i < SURF_VERTS; i++) {
      out[i] = (dmin + Math.round(u16[base + i] * s)) * 0.1;
    }
    return out;
  }
  sampleTile(L, tile, r, c) {
    const span = tile.dmax - tile.dmin;
    const q = L.u16[(tile.o >> 1) + r * SAMPLES + c];
    return (tile.dmin + (span === 0 ? 0 : Math.round(q * span / 65535))) * 0.1;
  }

  tileAt(L, x, y) {
    const tx = Math.floor((x - L.grid.x0) / L.tileSpan);
    const ty = Math.floor((y - L.grid.y0) / L.tileSpan);
    if (tx < 0 || ty < 0 || tx >= L.grid.nx || ty >= L.grid.ny) return null;
    return L.map.get(`${tx}:${ty}`) || null;
  }

  // Bilinear height in metres from the deepest level that covers the point. Used by the route
  // drape check, the camera ground clamp, the marker and every readout.
  heightAt(x, y) {
    for (let li = this.maxLevel; li >= 0; li--) {
      const L = this.levels[li];
      const tile = this.tileAt(L, x, y);
      if (!tile) continue;
      const ox = L.grid.x0 + tile.tx * L.tileSpan;
      const oy = L.grid.y0 + (tile.ty + 1) * L.tileSpan;   // north edge
      const u = (x - ox) / L.res, v = (oy - y) / L.res;
      const c0 = clamp(Math.floor(u), 0, CELLS - 1), r0 = clamp(Math.floor(v), 0, CELLS - 1);
      const fu = clamp(u - c0, 0, 1), fv = clamp(v - r0, 0, 1);
      const h00 = this.sampleTile(L, tile, r0, c0), h01 = this.sampleTile(L, tile, r0, c0 + 1);
      const h10 = this.sampleTile(L, tile, r0 + 1, c0), h11 = this.sampleTile(L, tile, r0 + 1, c0 + 1);
      return (h00 * (1 - fu) + h01 * fu) * (1 - fv) + (h10 * (1 - fu) + h11 * fu) * fv;
    }
    return this.minM;
  }

  // ---------- the two flat grids ----------
  // Viewshed, line of sight, first and last sun, the camera clamp and the terrain marker all want
  // a plain array, not a quadtree. Both are assembled from tiles already downloaded, so they cost
  // nothing on disk, and because the quantisation round-trips exactly they are bit-identical to
  // what the pipeline decimated.
  buildAnalysisGrids(onNote) {
    const core = this._flatten(this.levels.find((L) => L.region === 'core' && L.res === 16)
      || this.levels[Math.min(2, this.maxLevel)], onNote);
    const shell = this._flatten(this.levels.find((L) => L.region === 'shell') || this.levels[0], onNote);
    this.analysis.core = core;
    this.analysis.shell = shell;
    return this.analysis;
  }
  _flatten(L, onNote) {
    const nx = L.grid.nx * CELLS + 1, ny = L.grid.ny * CELLS + 1;
    const g = new Uint16Array(nx * ny);          // decimetres
    const cov = new Uint8Array(L.grid.nx * L.grid.ny);
    for (const tile of L.tiles) {
      cov[tile.ty * L.grid.nx + tile.tx] = 1;
      const base = tile.o >> 1, span = tile.dmax - tile.dmin, s = span / 65535;
      const rowBase = (L.grid.ny * CELLS) - (tile.ty * CELLS + CELLS);
      const colBase = tile.tx * CELLS;
      for (let r = 0; r < SAMPLES; r++) {
        const dst = (rowBase + r) * nx + colBase;
        const src = base + r * SAMPLES;
        for (let c = 0; c < SAMPLES; c++) {
          g[dst + c] = tile.dmin + (span === 0 ? 0 : Math.round(L.u16[src + c] * s));
        }
      }
    }
    let missing = 0;
    for (let i = 0; i < cov.length; i++) if (!cov[i]) missing++;
    if (missing) {
      if (onNote) onNote(`Level ${L.level} is missing ${missing} of ${cov.length} tiles; ` +
        'the analysis grid is filled from a coarser level there.');
      // Fill the holes from whatever coarser level covers them, so ray-marching never walks
      // into a pit of zeroes.
      for (let ty = 0; ty < L.grid.ny; ty++) {
        for (let tx = 0; tx < L.grid.nx; tx++) {
          if (cov[ty * L.grid.nx + tx]) continue;
          const rowBase = (L.grid.ny * CELLS) - (ty * CELLS + CELLS), colBase = tx * CELLS;
          for (let r = 0; r < SAMPLES; r++) {
            for (let c = 0; c < SAMPLES; c++) {
              const x = L.grid.x0 + tx * L.tileSpan + c * L.res;
              const y = L.grid.y0 + (ty + 1) * L.tileSpan - r * L.res;
              g[(rowBase + r) * nx + colBase + c] = Math.round(this.heightAt(x, y) * 10);
            }
          }
        }
      }
    }
    return {
      nx, ny, res: L.res, level: L.level,
      x0: L.grid.x0, y1: L.grid.y0 + L.grid.ny * L.tileSpan,
      x1: L.grid.x0 + L.grid.nx * L.tileSpan, y0: L.grid.y0,
      data: g,
    };
  }

  // Bilinear metres from a flat grid; outside it, the nearest edge.
  gridSample(g, x, y) {
    const u = clamp((x - g.x0) / g.res, 0, g.nx - 1.0001);
    const v = clamp((g.y1 - y) / g.res, 0, g.ny - 1.0001);
    const c0 = u | 0, r0 = v | 0, fu = u - c0, fv = v - r0;
    const d = g.data, i = r0 * g.nx + c0;
    const a = d[i], b = d[i + 1], c = d[i + g.nx], e = d[i + g.nx + 1];
    return ((a + (b - a) * fu) + ((c + (e - c) * fu) - (a + (b - a) * fu)) * fv) * 0.1;
  }
  inCore(x, y) {
    const k = this.analysis.core;
    return x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1;
  }
  // The height every ray-march uses: 16 m inside the core, 64 m outside it.
  analysisHeight(x, y) {
    return this.inCore(x, y)
      ? this.gridSample(this.analysis.core, x, y)
      : this.gridSample(this.analysis.shell, x, y);
  }

  // ---------- picking ----------
  // three.js cannot raycast this terrain: the height lives in the vertex shader, so the CPU-side
  // position attribute is flat. Marching the analysis grid is both correct and the same code the
  // sun and viewshed tools use.
  raycast(origin, dir, maxDist = 60000) {
    const sh = this.analysis.shell;
    const exag = this.exag;
    const top = this.maxM * exag + 10, bottom = this.minM * exag - 500;
    let t = 0, step = 8;
    const px = () => origin.x + dir.x * t, py = () => origin.y + dir.y * t, pz = () => origin.z + dir.z * t;
    // Skip forward to where the ray could possibly meet the model.
    if (origin.y > top && dir.y < 0) t = (origin.y - top) / -dir.y;
    let prevT = t, prevGap = this._gap(px(), py(), pz());
    if (prevGap <= 0) return null;                 // started underground
    const maxStep = 260;
    while (t < maxDist) {
      step = Math.min(maxStep, Math.max(6, prevGap * 0.7, t * 0.008));
      t += step;
      const y = py();
      if (y > top && dir.y >= 0) return null;
      if (y < bottom) return null;
      const gap = this._gap(px(), y, pz());
      if (gap <= 0) {
        let lo = prevT, hi = t;
        for (let k = 0; k < 24; k++) {
          const mid = (lo + hi) / 2;
          const g = this._gap(origin.x + dir.x * mid, origin.y + dir.y * mid, origin.z + dir.z * mid);
          if (g <= 0) hi = mid; else lo = mid;
        }
        const x = origin.x + dir.x * hi, z = origin.z + dir.z * hi;
        const wx = this.frame.wx(x), wy = this.frame.wy(z);
        return { x: wx, y: wy, elevM: this.heightAt(wx, wy), dist: hi };
      }
      prevT = t; prevGap = gap;
    }
    return null;
  }
  _gap(sx, sy, sz) {
    const wx = this.frame.wx(sx), wy = this.frame.wy(sz);
    return sy - this.analysisHeight(wx, wy) * this.exag;
  }

  // ---------- geometry ----------
  _slotFor(key) {
    let slot = this.byKey.get(key);
    if (slot) { slot.used = ++this.clock; return slot; }
    if (this.pool.length < POOL_SLOTS) {
      const tpl = buildTemplate();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', tpl.position);
      geo.setAttribute('aSkirt', tpl.skirt);
      geo.setIndex(tpl.index);
      const aHeight = new THREE.BufferAttribute(new Float32Array(TILE_VERTS), 1);
      const aGrad = new THREE.BufferAttribute(new Float32Array(TILE_VERTS * 2), 2);
      aHeight.setUsage(THREE.DynamicDrawUsage); aGrad.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aHeight', aHeight);
      geo.setAttribute('aGrad', aGrad);
      geo.boundingSphere = new THREE.Sphere();
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.frustumCulled = false;      // we cull the quadtree ourselves, in world units
      mesh.visible = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      slot = { geo, mesh, aHeight, aGrad, key: null, used: ++this.clock };
      this.pool.push(slot);
      return slot;
    }
    // Reuse the least recently drawn slot. Nothing is ever disposed, so the shared template
    // buffers can never be deleted out from under another tile.
    let oldest = this.pool[0];
    for (const s of this.pool) if (s.used < oldest.used) oldest = s;
    if (oldest.key) this.byKey.delete(oldest.key);
    oldest.used = ++this.clock;
    return oldest;
  }

  buildTile(L, tile) {
    const key = `${L.i}:${tile.tx}:${tile.ty}`;
    const existing = this.byKey.get(key);
    if (existing) { existing.used = ++this.clock; return existing; }
    const slot = this._slotFor(key);
    slot.key = key;
    this.byKey.set(key, slot);

    // A padded 67 x 67 window, so the gradient at a tile edge uses the neighbour's real sample
    // rather than a one-sided difference. Same-level neighbours share the edge exactly, so this
    // is not an approximation: it is the true central difference.
    const P = SAMPLES + 2, pad = this._pad;
    for (let r = 0; r < SAMPLES; r++) {
      for (let c = 0; c < SAMPLES; c++) pad[(r + 1) * P + (c + 1)] = this.sampleTile(L, tile, r, c);
    }
    const nb = (dx, dy) => L.map.get(`${tile.tx + dx}:${tile.ty + dy}`) || null;
    const west = nb(-1, 0), east = nb(1, 0), north = nb(0, 1), south = nb(0, -1);
    for (let r = 0; r < SAMPLES; r++) {
      pad[(r + 1) * P] = west ? this.sampleTile(L, west, r, CELLS - 1) : pad[(r + 1) * P + 1];
      pad[(r + 1) * P + P - 1] = east ? this.sampleTile(L, east, r, 1) : pad[(r + 1) * P + P - 2];
    }
    for (let c = 0; c < SAMPLES; c++) {
      pad[c + 1] = north ? this.sampleTile(L, north, CELLS - 1, c) : pad[P + c + 1];
      pad[(P - 1) * P + c + 1] = south ? this.sampleTile(L, south, 1, c) : pad[(P - 2) * P + c + 1];
    }

    const H = slot.aHeight.array, G = slot.aGrad.array;
    const inv = 1 / (2 * L.res);
    for (let r = 0; r < SAMPLES; r++) {
      for (let c = 0; c < SAMPLES; c++) {
        const i = r * SAMPLES + c, p = (r + 1) * P + (c + 1);
        H[i] = pad[p];
        G[i * 2] = (pad[p + 1] - pad[p - 1]) * inv;        // dh/dx, east positive
        G[i * 2 + 1] = (pad[p - P] - pad[p + P]) * inv;    // dh/dy, north positive
      }
    }
    const floor = tile.dmin * 0.1 - SKIRT_CELLS * L.res;
    const tops = [
      (k) => k, (k) => CELLS * SAMPLES + k, (k) => k * SAMPLES, (k) => k * SAMPLES + CELLS,
    ];
    for (let e = 0; e < 4; e++) {
      for (let k = 0; k < SAMPLES; k++) {
        const i = SURF_VERTS + e * SAMPLES + k, t = tops[e](k);
        H[i] = floor;
        G[i * 2] = G[t * 2]; G[i * 2 + 1] = G[t * 2 + 1];   // the apron shades like its edge
      }
    }
    slot.aHeight.needsUpdate = true;
    slot.aGrad.needsUpdate = true;

    const S = L.tileSpan;
    const sx = L.grid.x0 + tile.tx * S - this.frame.ox;
    const sz = -((L.grid.y0 + (tile.ty + 1) * S) - this.frame.oy);
    slot.mesh.position.set(sx, 0, sz);
    slot.mesh.scale.set(L.res, 1, L.res);
    slot.mesh.updateMatrix();
    slot.tile = tile; slot.L = L; slot.floor = floor;
    this._sphere(slot);
    this.stats.built++;
    return slot;
  }
  _sphere(slot) {
    const L = slot.L, t = slot.tile, S = L.tileSpan, e = this.exag;
    const lo = slot.floor * e, hi = t.dmax * 0.1 * e;
    const s = slot.geo.boundingSphere;
    s.center.set(slot.mesh.position.x + S / 2, (lo + hi) / 2, slot.mesh.position.z + S / 2);
    s.radius = Math.hypot(S / 2, S / 2, (hi - lo) / 2);
  }
  setExaggeration(v) {
    this.exag = v;
    for (const s of this.pool) if (s.key) this._sphere(s);
  }

  // ---------- the quadtree ----------
  // Start from the shell's level-0 tiles and split, always the tile with the largest screen-space
  // error first, until nothing exceeds the pixel threshold or the hard tile cap is reached. The
  // cap is what keeps the triangle budget: refinement stops, it does not overspend.
  select(camera, viewportHeight, errPx = 1.6) {
    const frustum = _frustum;
    // The renderer is what normally refreshes matrixWorldInverse, and it has not run yet this
    // frame. Without this line the first selection is made against an identity view matrix and
    // culls almost the whole model — and because the app renders on change, it then stays that
    // way.
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    _mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(_mat);
    const camPos = camera.position;
    const halfTan = Math.tan((camera.fov * Math.PI / 180) / 2);
    const kPix = (viewportHeight / 2) / halfTan;

    const heap = new MaxHeap();
    const L0 = this.levels[0];
    for (const tile of L0.tiles) {
      const node = this._node(0, tile, camPos, kPix, frustum);
      if (node) heap.push(node);
    }
    let count = heap.size;
    let capped = false;
    const kept = [];
    while (heap.size) {
      const node = heap.pop();
      const children = node.err > errPx ? this._children(node) : null;
      if (!children) { kept.push(node); continue; }
      if (count + 3 > MAX_TILES) { kept.push(node); capped = true; continue; }
      count += children.length - 1;
      for (const t of children) {
        const cn = this._node(node.li + 1, t, camPos, kPix, frustum);
        if (cn) heap.push(cn); else count--;
      }
    }
    this.stats.capped = capped;
    this.stats.pending = 0;
    const t0 = performance.now();
    const draw = [];
    const seen = new Set();
    for (const node of kept) {
      const L = this.levels[node.li];
      const key = `${node.li}:${node.tile.tx}:${node.tile.ty}`;
      let slot = this.byKey.get(key);
      if (!slot) {
        if (performance.now() - t0 < this.buildBudgetMs) slot = this.buildTile(L, node.tile);
        else { this.stats.pending++; slot = this._ancestor(node); }
      } else slot.used = ++this.clock;
      if (!slot) continue;
      if (seen.has(slot.key)) continue;
      seen.add(slot.key);
      draw.push(slot);
    }
    for (const s of this.pool) s.mesh.visible = false;
    for (const s of draw) s.mesh.visible = true;
    this.stats.tiles = draw.length;
    this.stats.triangles = draw.length * TRIS_PER_TILE;
    return { drawn: draw.length, pending: this.stats.pending };
  }
  // A tile not yet built falls back to the deepest ancestor that is, so the ground is never a
  // hole while the budget catches up.
  _ancestor(node) {
    let li = node.li, tx = node.tile.tx, ty = node.tile.ty;
    while (li > 0) {
      const L = this.levels[li], PL = this.levels[li - 1];
      const x = L.grid.x0 + tx * L.tileSpan + 1, y = L.grid.y0 + ty * L.tileSpan + 1;
      const ptx = Math.floor((x - PL.grid.x0) / PL.tileSpan);
      const pty = Math.floor((y - PL.grid.y0) / PL.tileSpan);
      li--; tx = ptx; ty = pty;
      const slot = this.byKey.get(`${li}:${tx}:${ty}`);
      if (slot) { slot.used = ++this.clock; return slot; }
    }
    return null;
  }
  _node(li, tile, camPos, kPix, frustum) {
    const L = this.levels[li], S = L.tileSpan, e = this.exag;
    const x0 = L.grid.x0 + tile.tx * S - this.frame.ox;
    const z1 = -((L.grid.y0 + tile.ty * S) - this.frame.oy);
    const z0 = z1 - S;
    // Pad the box: a coarse parent's dmin/dmax can be narrower than a sharp child's, and a
    // child culled because its parent's box missed it would be a hole in the ground.
    const padY = Math.max(40, L.res * 2) * e;
    const y0 = (tile.dmin * 0.1 - SKIRT_CELLS * L.res) * e - padY, y1 = tile.dmax * 0.1 * e + padY;
    _box.min.set(x0, y0, z0); _box.max.set(x0 + S, y1, z1);
    if (!frustum.intersectsBox(_box)) return null;
    _box.clampPoint(camPos, _v);
    const dist = Math.max(1, _v.distanceTo(camPos));
    return { li, tile, err: L.res * kPix / dist, key: L.res * kPix / dist, dist };
  }
  _children(node) {
    const li = node.li;
    if (li >= this.maxLevel) return null;
    const L = this.levels[li], C = this.levels[li + 1];
    const S = L.tileSpan;
    const x0 = L.grid.x0 + node.tile.tx * S, y0 = L.grid.y0 + node.tile.ty * S;
    // Levels 1..5 share the core's grid origin so the children are (2tx+i, 2ty+j); level 0 is
    // anchored on the shell instead, so between 0 and 1 we go through world coordinates. Doing
    // it through world coordinates always is one code path and costs nothing.
    const out = [];
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        const cx = Math.floor((x0 + (i + 0.5) * S / 2 - C.grid.x0) / C.tileSpan);
        const cy = Math.floor((y0 + (j + 0.5) * S / 2 - C.grid.y0) / C.tileSpan);
        const t = C.map.get(`${cx}:${cy}`);
        if (t) out.push(t);
      }
    }
    return out.length === 4 ? out : null;   // refine only where the full quad exists
  }
}

const _mat = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _box = new THREE.Box3();
const _v = new THREE.Vector3();
