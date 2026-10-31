// Floating names: peaks, towns and villages, lakes and glaciers from OpenStreetMap
// (data/labels.geojson, built by tools/build_labels.py), set upright over the 3D terrain in the
// house face, each on a short stem from a dot on the ground, so a name never lies smeared across a
// slope the way the map's own names do when they are draped.
//
// Each frame: the names near enough to the view (by a coarse grid of buckets), ranked by importance
// (a city over a village, a high peak over a low one, a large lake over a small one) and by
// distance; then placed greedily, the most important first, each only where its box overlaps no
// placed box, the keys and the card, and only where the terrain does not hide its point (a short
// march along the sight line). At most MAX on screen. A name is a <button>: a tap opens its card.

import { mercX, mercY, cosLat, tileOf } from './geo.js';
import * as U from './units.js';

const MAX = 34, BZ = 8;               // at most 34 names; buckets are z 8 tiles (78 km at the equator)
const RANK = { city: 6, town: 5, village: 3, peak: 2, lake: 2, glacier: 2.5 };
export const LABEL_KIND = { city: 'City', town: 'Town', village: 'Village', peak: 'Peak', lake: 'Lake', glacier: 'Glacier' };

export class Labels {
  constructor(geojson, layer, onTap) {
    this.layer = layer;
    this.onTap = onTap;
    this.items = ((geojson && geojson.features) || []).map((f, i) => {
      const [lon, lat] = f.geometry.coordinates, p = f.properties;
      const imp = RANK[p.k] + (p.k === 'peak' ? (p.e || 300) / 600 : 0) + (p.p ? Math.log10(p.p) / 2 : 0) + (p.a ? Math.log10(1 + p.a) : 0);
      return { i, lon, lat, X: mercX(lon), Y: mercY(lat), p, imp, h: null, el: null };
    });
    this.buckets = new Map();
    for (const it of this.items) {
      const [x, y] = tileOf(it.X, it.Y, BZ), k = x * 4096 + y;
      if (!this.buckets.has(k)) this.buckets.set(k, []);
      this.buckets.get(k).push(it);
    }
    this.pool = [];
    this.shown = [];
    this.stats = { candidates: 0, placed: 0, hidden: 0, ms: 0 };
  }

  _el(it) {
    let e = this.pool.find((x) => !x.used);
    if (!e) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'flab';
      const t = document.createElement('span'); t.className = 't';
      const s = document.createElement('small');
      b.append(t, s);
      b.addEventListener('click', (ev) => { ev.stopPropagation(); if (b._it) this.onTap(b._it); });
      this.layer.append(b);
      e = { b, t, s, used: false };
      this.pool.push(e);
    }
    e.used = true;
    e.b._it = it;
    // a peak's height is OpenStreetMap's surveyed figure; only a peak without one shows the
    // terrain's, rounded and marked "about" (the terrain held may still be the 10 m model's)
    const about = it.p.k === 'peak' && !it.p.e && it.h != null ? Math.round(it.h / 10) * 10 : null;
    const small = it.p.k !== 'peak' ? '' : it.p.e ? U.m(it.p.e) : about != null ? `about ${U.m(about)}` : '';
    if (e.b.dataset.id !== String(it.i) || e.s.textContent !== small) {
      e.b.dataset.id = String(it.i);
      e.t.textContent = it.p.n;
      e.s.textContent = small;
      e.b.className = `flab ${it.p.k}`;
      e.b.setAttribute('aria-label', `${it.p.n}, ${LABEL_KIND[it.p.k].toLowerCase()}${it.p.e ? `, ${it.p.e} meters` : about != null ? `, about ${about} meters` : ''}`);
    }
    return e;
  }

  /** Place the names for this view. `ctx`: { camera, rect, frame, project(X, Y, h), heightAt,
   *  occluded(X, Y, h), mPerPx, blocks: [rects to keep clear] }. */
  update(ctx) {
    const t0 = performance.now();
    for (const e of this.pool) e.used = false;
    const { frame, camera, rect } = ctx;
    // the buckets around the view's center, as far as the camera can usefully name
    const tX = frame.X(ctx.target.x), tY = frame.Y(ctx.target.z);
    const reach = Math.min(400000, Math.max(8000, ctx.distG * 5));
    const r = reach / cosLat(tY);
    const [x0, y0] = tileOf(tX - r, tY + r, BZ), [x1, y1] = tileOf(tX + r, tY - r, BZ);
    const cand = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const b = this.buckets.get(x * 4096 + y);
      if (b) for (const it of b) cand.push(it);
    }
    // what is small for this scale: a village from about 1:500 000, a peak's importance by height
    const minImp = ctx.mPerPx > 400 ? 5 : ctx.mPerPx > 150 ? 4 : ctx.mPerPx > 60 ? 3.2 : ctx.mPerPx > 20 ? 2.9 : 0;
    const scored = [];
    for (const it of cand) {
      if (it.imp < minImp) continue;
      const g = Math.hypot((it.X - tX) * cosLat(tY), (it.Y - tY) * cosLat(tY));
      if (g > reach) continue;
      scored.push({ it, s: it.imp - Math.log10(1 + g / Math.max(500, ctx.distG)) * 1.6 });
    }
    scored.sort((a, b) => b.s - a.s);
    this.stats.candidates = scored.length;
    const placed = [...ctx.blocks];
    let n = 0, hidden = 0;
    for (const { it } of scored) {
      if (n >= MAX) break;
      // the dot stands on the ground as drawn now: the height is read again every frame, so a
      // first coarse tile's smoothed summit never sticks under the name
      const hNow = ctx.heightAt(it.X, it.Y);
      it.h = hNow != null ? hNow : null;
      const h = it.h != null ? it.h : (it.p.e || 0);
      const p = ctx.project(it.X, it.Y, h);
      if (!p || p.x < rect.left - 40 || p.x > rect.right + 40 || p.y < rect.top || p.y > rect.bottom) continue;
      const w = 7 + 6.2 * it.p.n.length, hh = it.p.k === 'peak' ? 30 : 17;
      const box = { l: p.x - w / 2 - 3, r: p.x + w / 2 + 3, t: p.y - 14 - hh, b: p.y + 3 };
      if (box.l < rect.left || box.r > rect.right || box.t < rect.top) continue;
      if (placed.some((q) => box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t)) continue;
      if (ctx.occluded(it.X, it.Y, h)) { hidden++; continue; }
      placed.push(box);
      const e = this._el(it);
      e.b.style.transform = `translate(${(p.x - rect.left).toFixed(1)}px, ${(p.y - rect.top).toFixed(1)}px)`;
      e.b.hidden = false;
      it.at = { x: p.x, y: p.y, h };
      n++;
    }
    for (const e of this.pool) if (!e.used && !e.b.hidden) e.b.hidden = true;
    this.stats.placed = n; this.stats.hidden = hidden; this.stats.ms = performance.now() - t0;
    return n;
  }
  hide() { for (const e of this.pool) e.b.hidden = true; this.stats.placed = 0; }
}
