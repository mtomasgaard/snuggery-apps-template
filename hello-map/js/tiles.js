// The map's tiles: which pictures the view needs, asking the site for them at most six at a time,
// keeping the ones already here, and drawing them on the canvas. A tile that has not arrived is
// drawn from a coarser one already here (or from finer ones), so a move or a zoom never blanks.
//
// Each tile is a plain <img> request to the site in js/sources.js. Snuggery lets an online app load
// pictures and fonts from the sites it lists, once the person allows them, and nothing else
// (miniapp.json). The canvas only draws the pictures; it never reads their pixels, so the tiles need
// no crossOrigin (an app that reads pixels sets img.crossOrigin = 'anonymous' before src, and the
// site must answer with Access-Control-Allow-Origin).

import { tileUrl, MAX_ZOOM, WORLD_MAX_ZOOM, covered } from './sources.js';
import { worldPx } from './mercator.js';

const MAX_IN_FLIGHT = 6;      // pictures asked for at once
const KEEP = 360;             // pictures kept in memory, the oldest out of view dropped first
const RETRY_MS = 8000;        // a tile that failed is asked for again after this, on the next draw
const MAX_TRIES = 3;
const FALLBACK_LEVELS = 6;    // how far up a missing tile looks for a coarser picture

const mod = (a, n) => ((a % n) + n) % n;

export function createTiles({ onArrive }) {
  const cache = new Map();          // key -> { img, state: 'loading' | 'ok' | 'err', tries, t, used }
  const queue = [];                 // { key, layer, z, x, y, pri }
  let inFlight = 0;
  let wanted = new Set();
  const stats = { asked: 0, loaded: 0, failed: 0, everLoaded: 0 };
  let frame = 0;

  const keyOf = (layer, z, x, y) => `${layer}/${z}/${x}/${y}`;

  function pump() {
    while (inFlight < MAX_IN_FLIGHT && queue.length) {
      queue.sort((a, b) => a.pri - b.pri);
      const job = queue.shift();
      const rec = cache.get(job.key);
      if (!rec || rec.state !== 'queued') continue;
      if (!wanted.has(job.key)) { cache.delete(job.key); continue; }
      start(job, rec);
    }
  }

  function start(job, rec) {
    rec.state = 'loading';
    rec.tries++;
    inFlight++;
    stats.asked++;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      inFlight--;
      rec.state = 'ok'; rec.img = img; rec.t = performance.now();
      stats.loaded++; stats.everLoaded++;
      onArrive();
      pump();
    };
    img.onerror = () => {
      inFlight--;
      rec.state = 'err'; rec.img = null; rec.t = performance.now();
      stats.failed++;
      onArrive();
      pump();
    };
    img.src = tileUrl(job.layer, job.z, job.x, job.y);
  }

  /** Ask for a tile if it is not here, not on its way and not failed recently. */
  function want(layer, z, x, y, pri) {
    const key = keyOf(layer, z, x, y);
    wanted.add(key);
    let rec = cache.get(key);
    const now = performance.now();
    if (rec) {
      rec.used = frame;
      if (rec.state === 'err' && rec.tries < MAX_TRIES && now - rec.t > RETRY_MS) { rec.state = 'queued'; queue.push({ key, layer, z, x, y, pri }); }
      else if (rec.state === 'queued') { const q = queue.find((j) => j.key === key); if (q) q.pri = pri; }
      return rec;
    }
    rec = { img: null, state: 'queued', tries: 0, t: 0, used: frame };
    cache.set(key, rec);
    queue.push({ key, layer, z, x, y, pri });
    return rec;
  }

  function evict() {
    if (cache.size <= KEEP) return;
    const old = [...cache.entries()].filter(([k, r]) => !wanted.has(k) && r.state !== 'loading').sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < old.length && cache.size > KEEP; i++) cache.delete(old[i][0]);
  }

  /** A coarser tile already here that covers (z, x, y): the source square to cut from it. */
  function ancestor(layer, z, x, y) {
    for (let d = 1; d <= FALLBACK_LEVELS && z - d >= 0; d++) {
      const r = cache.get(keyOf(layer, z - d, x >> d, y >> d));
      if (r && r.state === 'ok') {
        const sub = 256 / 2 ** d;
        return { img: r.img, sx: (x - ((x >> d) << d)) * sub, sy: (y - ((y >> d) << d)) * sub, s: sub };
      }
    }
    return null;
  }

  /**
   * Draw the view. view: { layer, cx, cy (world units), z (fractional zoom), w, h (CSS px), dpr }.
   * Returns what the status line and the notice need.
   */
  function draw(ctx, view) {
    frame++;
    const { layer, cx, cy, z, w, h, dpr } = view;
    const tz = Math.max(0, Math.min(MAX_ZOOM, Math.round(z)));
    const n = 2 ** tz, scale = 2 ** (z - tz), Wt = worldPx(tz);
    const left = cx * Wt - w / 2 / scale, top = cy * Wt - h / 2 / scale;
    const x0 = Math.floor(left / 256), x1 = Math.floor((left + w / scale) / 256);
    const y0 = Math.max(0, Math.floor(top / 256)), y1 = Math.min(n - 1, Math.floor((top + h / scale) / 256));
    wanted = new Set();
    const info = { level: tz, inView: 0, loaded: 0, pending: 0, failed: 0, outside: 0, tiles: [] };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const midX = (x0 + x1 + 1) / 2, midY = (y0 + y1 + 1) / 2;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const xw = mod(x, n);
        // where the tile lands, in device pixels, rounded so neighbors meet without a seam
        const ax = Math.round(((x * 256 - left) * scale) * dpr), bx = Math.round((((x + 1) * 256 - left) * scale) * dpr);
        const ay = Math.round(((y * 256 - top) * scale) * dpr), by = Math.round((((y + 1) * 256 - top) * scale) * dpr);
        const pri = (x + 0.5 - midX) ** 2 + (y + 0.5 - midY) ** 2;
        info.inView++;
        // beyond level 8, a tile outside every coverage box is drawn from its level-8 picture
        let rec = null, src = null;
        const lonW = (x / n) * 360 - 180, lonE = ((x + 1) / n) * 360 - 180;
        const latN = tileLat(y, n), latS = tileLat(y + 1, n);
        const wrapW = ((lonW + 540) % 360) - 180, wrapE = wrapW + (lonE - lonW);
        if (tz > WORLD_MAX_ZOOM && !covered(wrapW, latS, wrapE, latN) && !covered(wrapW - 360, latS, wrapE - 360, latN)) {
          info.outside++;
          const d = tz - WORLD_MAX_ZOOM;
          const r = want(layer, WORLD_MAX_ZOOM, xw >> d, y >> d, pri);
          if (r.state === 'ok') { const sub = 256 / 2 ** d; src = { img: r.img, sx: (xw - ((xw >> d) << d)) * sub, sy: (y - ((y >> d) << d)) * sub, s: sub }; info.loaded++; }
          else if (r.state === 'err') info.failed++; else info.pending++;
        } else {
          rec = want(layer, tz, xw, y, pri);
          info.tiles.push({ z: tz, x: xw, y });
          if (rec.state === 'ok') { src = { img: rec.img, sx: 0, sy: 0, s: 256 }; info.loaded++; }
          else {
            if (rec.state === 'err') info.failed++; else info.pending++;
            src = ancestor(layer, tz, xw, y);
            if (!src) drawChildren(ctx, layer, tz, xw, y, ax, ay, bx, by);
          }
        }
        if (src) ctx.drawImage(src.img, src.sx, src.sy, src.s, src.s, ax, ay, bx - ax, by - ay);
      }
    }
    pump();
    evict();
    return info;
  }

  function drawChildren(ctx, layer, z, x, y, ax, ay, bx, by) {
    if (z + 1 > MAX_ZOOM) return;
    const mx = Math.round((ax + bx) / 2), my = Math.round((ay + by) / 2);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const r = cache.get(keyOf(layer, z + 1, 2 * x + i, 2 * y + j));
      if (r && r.state === 'ok') ctx.drawImage(r.img, i ? mx : ax, j ? my : ay, (i ? bx : mx) - (i ? mx : ax), (j ? by : my) - (j ? my : ay));
    }
  }

  /** Forget every failure, so the next draw asks again (the phone came back online). */
  function retryFailed() {
    for (const r of cache.values()) if (r.state === 'err') { r.tries = 0; r.t = -Infinity; }
  }

  return { draw, retryFailed, stats, inFlight: () => inFlight, queued: () => queue.length };
}

function tileLat(y, n) {
  const k = Math.PI * (1 - (2 * y) / n);
  return (Math.atan(Math.sinh(k)) * 180) / Math.PI;
}
