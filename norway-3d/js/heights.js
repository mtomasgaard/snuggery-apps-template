// The height store: every height tile the app holds, the way to the right one for any point, and
// the LRU that keeps it inside its budget (NOTES.md: Budgets).
//
// Two sources, one grid (js/sources.js):
//   'T'  Terrarium, z 0 to 12, 256 px: Kartverket's 10 m model over Norway, the far field;
//   'D'  hoydedata DTM1, z 12 to 15, 512 px: Kartverket's 1 m model, the near field (1.14 m a
//        pixel at z 15 and 61.5° N). Where DTM1 has no data (Sweden, Finland, Russia) its pixels
//        are filled from the deepest Terrarium tile held.
// heightAt() answers from the finest tile held, so a height is never a guess: it is the 1 m model
// where that has arrived, the 10 m model where only that has, and null where nothing has.

import { tileBox, tileOf, tkey, cosLat } from './geo.js';
import { HOSTS, terrariumUrl, dtmUrl, TERRARIUM_MAX_Z, DTM_MIN_Z, DTM_MAX_Z } from './sources.js';
import { decodeTile, normals, range, NODATA } from './hcore.js';

export const BUDGET = 72 * 1024 * 1024;       // CPU bytes of heights and normals held (NOTES.md: Budgets)

export class Heights {
  constructor(loader, onTile) {
    this.loader = loader;
    this.onTile = onTile;
    this.T = new Map();
    this.D = new Map();
    this.bytes = 0;
    this.frameNo = 0;
    this.last = null;
    this.stats = { decoded: 0, decodeMs: 0, filled: 0, evicted: 0, evictedNear: 0 };
    this.waiting = new Map();
    this.seq = 0;
    try {
      this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this._done(e.data);
      this.worker.onerror = () => { this.worker = null; };
    } catch { this.worker = null; }
  }

  map(kind) { return kind === 'D' ? this.D : this.T; }
  get(kind, z, x, y) { return this.map(kind).get(tkey(z, x, y)) || null; }

  /** Ask for a tile (a no-op when it is held). */
  want(kind, z, x, y, prio) {
    const m = this.map(kind), k = tkey(z, x, y);
    const rec = m.get(k);
    if (rec) { rec.used = this.frameNo; return rec; }
    const lk = `h${kind}${z}/${x}/${y}`;
    const url = kind === 'D' ? dtmUrl(z, x, y) : terrariumUrl(z, x, y);
    const host = kind === 'D' ? HOSTS.dtm : HOSTS.terrarium;
    this.loader.want(lk, url, host, prio, (img) => { if (img) this._decode(kind, z, x, y, img, lk); });
    return null;
  }

  async _decode(kind, z, x, y, img, lk) {
    if (this.worker && typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(img);
        const id = ++this.seq;
        this.waiting.set(id, { kind, z, x, y, lk });
        this.worker.postMessage({ id, kind, z, y, bitmap }, [bitmap]);
        return;
      } catch { /* fall through to the main thread */ }
    }
    const n = img.naturalWidth;
    const c = this._canvas || (this._canvas = document.createElement('canvas'));
    c.width = n; c.height = n;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, n, n);
    ctx.drawImage(img, 0, 0);
    const t0 = performance.now();
    const r = decodeTile(kind, z, y, ctx.getImageData(0, 0, n, n).data, n);
    this._store(kind, z, x, y, lk, { ...r, n, ms: performance.now() - t0 });
  }
  _done(msg) {
    const w = this.waiting.get(msg.id);
    this.waiting.delete(msg.id);
    if (!w) return;
    if (!msg.ok) { console.warn(`A height tile could not be decoded: ${msg.error}`); return; }
    this._store(w.kind, w.z, w.x, w.y, w.lk, msg);
  }
  _store(kind, z, x, y, lk, r) {
    const { n } = r;
    let { h, nrm, lo, hi } = r;
    if (r.nodata) {
      // Outside DTM1's coverage: the deepest Terrarium tile held answers instead.
      const b = tileBox(z, x, y), s = b.s / n;
      for (let i = 0; i < n * n; i++) {
        if (h[i] !== NODATA) continue;
        const X = b.x0 + ((i % n) + 0.5) * s, Y = b.y1 - (Math.floor(i / n) + 0.5) * s;
        const v = this.heightAt(X, Y, 'T');
        h[i] = v == null ? 0 : Math.round(v * 10);
      }
      nrm = normals(h, n, z, y, new Uint8Array(n * n * 2));
      [lo, hi] = range(h);
      this.stats.filled++;
    }
    const rec = { kind, z, x, y, n, h, nrm, lo: lo * 0.1, hi: hi * 0.1, box: tileBox(z, x, y), used: 0, near: this.frameNo, lk, key: `${kind}${z}/${x}/${y}`, ver: 1 };
    rec.bytes = h.byteLength + nrm.byteLength;          // the normals until the GPU has them (dropNormals)
    this.map(kind).set(tkey(z, x, y), rec);
    this.bytes += rec.bytes;
    this.stats.decoded++; this.stats.decodeMs += r.ms || 0;
    this._evict();
    if (this.onTile) this.onTile(rec);
  }
  /** Over the budget, in the terrain's order (js/terrain.js, _evict): tiles loaded ahead and never
   *  drawn first, then the least recently drawn, then those held for the ring ahead of the view
   *  (`near`). Never one drawn this frame or the last, nor a tile of z 6 or coarser. */
  _evict() {
    if (this.bytes <= BUDGET) return;
    const f = this.frameNo, rank = (r) => (r.near >= f - 1 ? 2 * f + r.near : r.used > 0 ? r.used : (r.near || 0) * 1e-9);
    const all = [...this.T.values(), ...this.D.values()].filter((r) => r.used < f - 1 && r.z > 6);
    all.sort((a, b) => rank(a) - rank(b));
    for (const r of all) {
      if (this.bytes <= BUDGET * 0.9) break;
      if (r.near >= f - 1) this.stats.evictedNear = (this.stats.evictedNear || 0) + 1;
      this.map(r.kind).delete(tkey(r.z, r.x, r.y));
      this.bytes -= r.bytes;
      this.loader.forget(r.lk);
      if (this.last === r) this.last = null;
      this.stats.evicted++;
      if (this.onEvict) this.onEvict(r);
    }
  }

  /** The finest tile held that covers (X, Y): DTM1 from z 15 down, then Terrarium. */
  best(X, Y, only, zmax = DTM_MAX_Z) {
    if (only !== 'T') {
      for (let z = Math.min(zmax, DTM_MAX_Z); z >= DTM_MIN_Z; z--) {
        const [x, y] = tileOf(X, Y, z);
        const r = this.D.get(tkey(z, x, y));
        if (r) return r;
      }
    }
    for (let z = Math.min(zmax, TERRARIUM_MAX_Z); z >= 0; z--) {
      const [x, y] = tileOf(X, Y, z);
      const r = this.T.get(tkey(z, x, y));
      if (r) return r;
    }
    return null;
  }
  /** Bilinear meters from one tile, pixel centers on its grid, clamped at its edges. */
  sample(r, X, Y) {
    const n = r.n, b = r.box;
    let u = ((X - b.x0) / b.s) * n - 0.5, v = ((b.y1 - Y) / b.s) * n - 0.5;
    u = u < 0 ? 0 : u > n - 1 ? n - 1 : u;
    v = v < 0 ? 0 : v > n - 1 ? n - 1 : v;
    const c0 = Math.min(n - 2, u | 0), r0 = Math.min(n - 2, v | 0), fu = u - c0, fv = v - r0;
    const h = r.h, i = r0 * n + c0;
    const a = h[i], bb = h[i + 1], c = h[i + n], d = h[i + n + 1];
    return ((a + (bb - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv) * 0.1;
  }
  /** Meters at (X, Y) from the finest tile held, or null. `only` = 'T' keeps to Terrarium. */
  heightAt(X, Y, only) {
    const l = this.last;
    if (l && !only && X >= l.box.x0 && X < l.box.x1 && Y > l.box.y0 && Y <= l.box.y1 && this._finest(l, X, Y)) return this.sample(l, X, Y);
    const r = this.best(X, Y, only);
    if (!r) return null;
    if (!only) this.last = r;
    return this.sample(r, X, Y);
  }
  // `last` is reused only when nothing finer can exist: a z 15 DTM1 tile.
  _finest(r) { return r.kind === 'D' && r.z === DTM_MAX_Z; }
  /** What the height at (X, Y) is read from: the model and its ground meters a pixel there. */
  sourceAt(X, Y) {
    const r = this.best(X, Y);
    if (!r) return null;
    return { rec: r, model: r.kind === 'D' ? 1 : 10, mpp: (r.box.s / r.n) * cosLat(Y) };
  }
  /** A sampler for many points close together (a grid, a profile, a skyline): it remembers which
   *  tile answered for each z 15 cell, so a quarter of a million samples cost a few lookups each.
   *  Make a new one when tiles arrive. */
  sampler() {
    const memo = new Map();
    return (X, Y) => {
      const [x, y] = tileOf(X, Y, DTM_MAX_Z);
      const k = x * 1048576 + y;
      let r = memo.get(k);
      if (r === undefined) { r = this.best(X, Y); memo.set(k, r); }
      return r ? this.sample(r, X, Y) : null;
    };
  }
  get count() { return this.T.size + this.D.size; }
  /** The GPU has a tile's normals (js/terrain.js): the CPU copy goes, and out of the budget. */
  dropNormals(rec) {
    if (!rec.nrm) return;
    const b = rec.nrm.byteLength;
    rec.nrm = null; rec.bytes -= b;
    if (this.map(rec.kind).get(tkey(rec.z, rec.x, rec.y)) === rec) this.bytes -= b;
  }
  /** Bytes held for the view (drawn this frame or the last) and for the ring ahead of it. */
  audit() {
    let live = 0, near = 0;
    for (const m of [this.T, this.D]) for (const r of m.values()) { if (r.used >= this.frameNo - 1) live += r.bytes; else if (r.near >= this.frameNo - 1) near += r.bytes; }
    this.stats.liveMB = live / 1048576; this.stats.aheadMB = near / 1048576;
  }
}
