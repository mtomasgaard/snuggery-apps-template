// The Canvas 2D layer over the Earth (DESIGN §5.5, ART "Layers"): the graticule, borders, coastlines
// and lakes, the limb or the map's outline, places, the selected cell and the keyboard crosshair.
// The line styles are the same in both themes because they sit on the data; only the limb takes the
// theme's --card-ink. Paths are rebuilt only when the view changes (one Path2D per layer, cached by
// the view's key); a step change never touches this canvas.

import { DEG, wrapPi } from './util.js';
import { eeFactors } from './proj.js';

const MIN_STEP2 = 0.6 * 0.6;            // decimation: skip a vertex closer than 0.6 CSS px to the last one
const LABEL_FONT = '500 11px Archivo, system-ui, -apple-system, sans-serif';
const FRAME_MIN = 4;                    // CSS px: a cell narrower than this gets the ring, not the frame
const RING_R = 9;                       // CSS px: the ring's radius, a mark to find again after the finger lifts

/** Per-vertex trigonometry and Equal Earth factors, computed once per geometry. */
function prepare(g) {
  const n = g.lon.length, t = new Float64Array(n * 4), kx = new Float64Array(n), ey = new Float64Array(n), lam = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const l = g.lon[i] * DEG, p = g.lat[i] * DEG;
    t[4 * i] = Math.sin(p); t[4 * i + 1] = Math.cos(p); t[4 * i + 2] = Math.sin(l); t[4 * i + 3] = Math.cos(l);
    const f = eeFactors(p); kx[i] = f[0]; ey[i] = f[1]; lam[i] = l;
  }
  return { ...g, t, kx, ey, lam };
}

export function createOverlay(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, dpr = 1, geo = null, cache = { key: '' };
  let stats = { vertices: 0, emitted: 0, labels: 0, ms: 0, mark: null };

  function resize(w, h, d) {
    W = w; H = h; dpr = d;
    const cw = Math.max(1, Math.round(w * d)), ch = Math.max(1, Math.round(h * d));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    cache.key = '';
  }
  /** world: data.js's decodeWorld(); places: decodePlaces(). */
  function setWorld(world, places) {
    geo = { land: prepare(world.land), lakes: prepare(world.lakes), borders: prepare(world.borders), places };
    cache.key = '';
  }

  /* One polyline or ring on the globe, cut where it crosses the horizon (Earth's History's
     globeLine, on per-vertex sines and cosines as Global Weather's sphereRings). */
  function globeLines(path, g, P) {
    const { sp0, cp0, sl0, cl0, cx, cy, r } = P, t = g.t;
    for (let k = 0; k < g.n; k++) {
      const s = g.start[k], n = g.count[k];
      let pX = 0, pY = 0, pZ = 0, pVis = false, pen = false, lx = 0, ly = 0;
      for (let j = 0; j < n; j++) {
        const v = s + j, o = 4 * v;
        const sp = t[o], cp = t[o + 1], sl = t[o + 2], cl = t[o + 3];
        const cd = cl * cl0 + sl * sl0, sd = sl * cl0 - cl * sl0;
        const X = cp * sd, Y = cp0 * sp - sp0 * cp * cd, Z = sp0 * sp + cp0 * cp * cd;
        const vis = Z >= 0;
        stats.vertices++;
        if (j > 0 && g.cut[v]) pen = false;            // a polygon seam (±180°, the pole line), not a coast
        else if (j > 0 && vis !== pVis) {               // the crossing on the great circle, at Z = 0
          const f = pZ / (pZ - Z);
          let ux = pX + f * (X - pX), uy = pY + f * (Y - pY);
          const q = 1 / (Math.hypot(ux, uy) || 1); ux *= q; uy *= q;
          const sx = cx + r * ux, sy = cy - r * uy;
          if (vis) { path.moveTo(sx, sy); pen = true; lx = sx; ly = sy; } else { if (pen) path.lineTo(sx, sy); pen = false; }
        }
        if (vis) {
          const sx = cx + r * X, sy = cy - r * Y;
          if (!pen) { path.moveTo(sx, sy); pen = true; lx = sx; ly = sy; stats.emitted++; }
          else if (j === n - 1 || (sx - lx) ** 2 + (sy - ly) ** 2 >= MIN_STEP2) { path.lineTo(sx, sy); lx = sx; ly = sy; stats.emitted++; }
        }
        pX = X; pY = Y; pZ = Z; pVis = vis;
      }
    }
  }
  /* One polyline or ring on the Equal Earth map, broken where Δλ jumps by more than π (the wrap). */
  function mapLines(path, g, P) {
    const { lam0, cx, cy, s, panY } = P;
    for (let k = 0; k < g.n; k++) {
      const st = g.start[k], n = g.count[k];
      let pdl = 0, lx = 0, ly = 0, pen = false;
      for (let j = 0; j < n; j++) {
        const v = st + j, dl = wrapPi(g.lam[v] - lam0);
        const sx = cx + s * g.kx[v] * dl, sy = cy - s * (g.ey[v] - panY);
        stats.vertices++;
        if (!pen || g.cut[v] || Math.abs(dl - pdl) > Math.PI) { path.moveTo(sx, sy); pen = true; lx = sx; ly = sy; stats.emitted++; }
        else if (j === n - 1 || (sx - lx) ** 2 + (sy - ly) ** 2 >= MIN_STEP2) { path.lineTo(sx, sy); lx = sx; ly = sy; stats.emitted++; }
        pdl = dl;
      }
    }
  }
  /** A polyline of [lon, lat] samples through the view (graticule, the selected cell). */
  function sampled(path, pts, view) {
    let pen = false, px = 0;
    for (const [lon, lat] of pts) {
      const p = view.project(lon, lat);
      if (!p[2] || (pen && view.mode === 'map' && Math.abs(p[0] - px) > W * 0.5 * view.map.zoom)) { pen = false; if (!p[2]) continue; }
      if (pen) path.lineTo(p[0], p[1]); else { path.moveTo(p[0], p[1]); pen = true; }
      px = p[0];
    }
  }
  function graticule(view) {
    const minor = new Path2D(), eq = new Path2D(), g = view.mode === 'globe';
    for (let lon = -180; lon < 180; lon += 30) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 2) pts.push([lon, lat]);
      sampled(minor, pts, view);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      for (let k = 0; k <= 180; k++) pts.push([g ? -180 + 2 * k : view.map.lon0 - 179.999 + k * (359.998 / 180), lat]);
      sampled(lat ? minor : eq, pts, view);
    }
    return { minor, eq };
  }

  function build(view) {
    const t0 = performance.now();
    stats.vertices = 0; stats.emitted = 0;
    const globe = view.mode === 'globe';
    const P = globe
      ? { sp0: Math.sin(view.globe.lat * DEG), cp0: Math.cos(view.globe.lat * DEG), sl0: Math.sin(view.globe.lon * DEG), cl0: Math.cos(view.globe.lon * DEG), cx: view.cx, cy: view.cy, r: view.radius() }
      : { lam0: view.map.lon0 * DEG, cx: view.cx, cy: view.cy, s: view.mapScale(), panY: view.map.panY };
    const lines = globe ? globeLines : mapLines;
    const coast = new Path2D(), borders = new Path2D();
    if (geo) { lines(coast, geo.land, P); lines(coast, geo.lakes, P); lines(borders, geo.borders, P); }
    const edge = new Path2D();
    if (globe) edge.arc(view.cx, view.cy, view.radius(), 0, 2 * Math.PI);
    else {
      for (let k = 0; k <= 360; k++) {                  // the outline: dλ = +π down, then −π up
        const p = k <= 180 ? view.project(view.map.lon0 + 179.9999, 90 - k) : view.project(view.map.lon0 - 179.9999, -90 + (k - 180));
        if (k) edge.lineTo(p[0], p[1]); else edge.moveTo(p[0], p[1]);
      }
      edge.closePath();
    }
    cache = { key: view.key(), coast, borders, edge, grat: graticule(view), buildMs: performance.now() - t0 };
  }

  function stroke(path, style, width) { ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke(path); }

  /**
   * The selected cell's mark (DESIGN §5.5, §20 Q-1), from its true projected quadrilateral: the four
   * edges sampled every 0.5°, on the map unwrapped about the cell's own centre so a cell on the ±180°
   * seam stays whole. Its on-screen size m is the smaller of the distances between the midpoints of
   * opposite edges (a 2° cell is 6.4 px at the globe's centre at zoom 1, 2.7 px wide at Fairbanks,
   * 1.1 px at 80°, and about 2 px on the map at zoom 1).
   * - m ≥ FRAME_MIN: a frame drawn only outside the cell (clipped to its exterior), so not one pixel of
   *   the cell's own color is covered: a pale gap, the ink line and a pale halo, 0.5 + 1.5 + 1.5 px at
   *   m ≥ 6 (ART's 1.5 px ink over a 3.5 px halo, moved outside) and scaled with m below that, never
   *   wider than 0.6 m.
   * - smaller: an open ring centred on the cell, radius RING_R (or wider than the cell's half diagonal
   *   by 3 px), the cell and its neighbours visible inside it.
   * Returns { kind, m, path, box, x, y, r } or null when the cell is not on the facing Earth.
   */
  function cellMark(sel, view) {
    const n = 90 - 2 * sel.row, s = n - 2, w = -180 + 2 * sel.col, e = w + 2, lonc = w + 1, latc = n - 1;
    let pt;
    if (view.mode === 'globe') pt = (lon, lat) => view.project(lon, lat);
    else {
      const sc = view.mapScale(), dlc = wrapPi((lonc - view.map.lon0) * DEG);
      pt = (lon, lat) => { const f = eeFactors(lat * DEG); return [view.cx + sc * f[0] * (dlc + (lon - lonc) * DEG), view.cy - sc * (f[1] - view.map.panY), true]; };
    }
    const c = pt(lonc, latc);
    if (!c[2]) return null;
    const ring = [];
    for (let k = 0; k < 4; k++) ring.push(pt(w + k / 2, n));
    for (let k = 0; k < 4; k++) ring.push(pt(e, n - k / 2));
    for (let k = 0; k < 4; k++) ring.push(pt(e - k / 2, s));
    for (let k = 0; k < 4; k++) ring.push(pt(w, s + k / 2));
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const m = Math.min(d(pt(w, latc), pt(e, latc)), d(pt(lonc, n), pt(lonc, s)));
    const whole = ring.every((q) => q[2]);
    if (whole && m >= FRAME_MIN) {
      const path = new Path2D();
      ring.forEach((q, i) => (i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
      path.closePath();
      const band = Math.min(3.5, 0.6 * m);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of ring) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      return { kind: 'frame', m, path, band, x: c[0], y: c[1], box: [x0 - band - 1, y0 - band - 1, x1 + band + 1, y1 + band + 1] };
    }
    const r = Math.max(RING_R, Math.max(...ring.filter((q) => q[2]).map((q) => d(q, c))) + 3);
    const path = new Path2D();
    path.arc(c[0], c[1], r, 0, 2 * Math.PI);
    return { kind: 'ring', m, path, r, x: c[0], y: c[1], box: [c[0] - r - 3, c[1] - r - 3, c[0] + r + 3, c[1] + r + 3] };
  }
  function drawMark(k) {
    if (k.kind === 'ring') { stroke(k.path, 'rgba(245,245,245,0.95)', 3.5); stroke(k.path, '#121212', 1.5); return; }
    // the frame: every stroke centred on the cell's edge and clipped to its outside, so each one shows
    // its outer half: pale 0 … band, ink 0 … 4/7 band, pale 0 … 1/7 band
    const f = k.band / 3.5, out = new Path2D();
    out.rect(-4, -4, W + 8, H + 8); out.addPath(k.path);
    ctx.save();
    ctx.clip(out, 'evenodd');
    ctx.lineJoin = 'miter';
    stroke(k.path, 'rgba(245,245,245,0.95)', 2 * k.band);
    stroke(k.path, '#121212', 4 * f);
    stroke(k.path, 'rgba(245,245,245,0.95)', 1 * f);
    ctx.restore();
  }

  /** Places, facing, unclipped, no collisions; never tier 4. Tier 3 from zoom 2, tier 2 from zoom 1.5.
   *  Below 1.5, a phone-sized Earth (seat under 600 px across) shows tier 1 only: tiers 1–2 drew 10–28
   *  names on the 390 px globe and 16–19 on the map at zoom 1 (§20 Q-9); a larger Earth keeps tier 2. */
  function labels(view, avoid) {
    if (!geo || !geo.places) return;
    const z = view.zoom(), tier = z >= 2 ? 3 : z >= 1.5 || Math.min(view.seatW, view.seatH) >= 600 ? 2 : 1, placed = [...avoid];
    ctx.font = LABEL_FONT; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const globe = view.mode === 'globe', r = globe ? view.radius() : 0;
    for (const q of geo.places) {
      if (q.r > tier) break;
      const p = view.project(q.lon, q.lat);
      if (!p[2] || p[0] < 4 || p[0] > W - 4 || p[1] < 0 || p[1] > H) continue;   // the place itself on screen
      if (globe && Math.hypot(p[0] - view.cx, p[1] - view.cy) > 0.92 * r) continue;
      const w = ctx.measureText(q.n).width;
      let x = p[0] + 5, box = [p[0] - 2, p[1] - 7, x + w + 2, p[1] + 7];
      if (box[2] > W - 4) { x = p[0] - 5 - w; box = [x - 2, p[1] - 7, p[0] + 2, p[1] + 7]; }
      if (box[0] < 4 || box[1] < 0 || box[3] > H) continue;
      if (placed.some((b) => box[0] < b[2] + 4 && box[2] + 4 > b[0] && box[1] < b[3] + 2 && box[3] + 2 > b[1])) continue;
      placed.push(box);
      ctx.fillStyle = '#121212';
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.6, 0, 2 * Math.PI); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(245,245,245,0.85)'; ctx.strokeText(q.n, x, p[1]);
      ctx.fillStyle = '#121212'; ctx.fillText(q.n, x, p[1]);
      stats.labels++;
    }
  }

  /**
   * s: { view, limbInk ('#rrggbb'), selection: {row, col} | null, crosshair: bool,
   *      avoid: [[x0, y0, x1, y1], …] (the top strip, the legend) }. Returns the ms it took.
   */
  function draw(s) {
    const t0 = performance.now();
    const v = s.view;
    if (cache.key !== v.key()) build(v);
    stats.labels = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.save();
    ctx.clip(cache.edge);                               // nothing is drawn off the Earth
    stroke(cache.grat.minor, 'rgba(16,16,16,0.13)', 0.6);
    stroke(cache.grat.eq, 'rgba(16,16,16,0.24)', 0.6);
    stroke(cache.borders, 'rgba(16,16,16,0.30)', 0.5);
    stroke(cache.coast, 'rgba(255,255,255,0.40)', 2.2);
    stroke(cache.coast, 'rgba(16,16,16,0.74)', 0.8);
    ctx.restore();
    ctx.globalAlpha = 0.55; stroke(cache.edge, s.limbInk || '#121212', 1); ctx.globalAlpha = 1;
    const avoid = [...(s.avoid || [])];
    const mark = s.selection ? cellMark(s.selection, v) : null;
    if (mark) avoid.push(mark.box);
    labels(v, avoid);
    if (mark) drawMark(mark);
    stats.mark = mark && { kind: mark.kind, m: +mark.m.toFixed(2), x: +mark.x.toFixed(2), y: +mark.y.toFixed(2), size: +(mark.kind === 'ring' ? mark.r : mark.band).toFixed(2) };
    if (s.crosshair) {
      const c = new Path2D(), x = v.cx, y = v.cy;
      c.moveTo(x - 7, y); c.lineTo(x + 7, y); c.moveTo(x, y - 7); c.lineTo(x, y + 7);
      stroke(c, 'rgba(245,245,245,0.95)', 3.5); stroke(c, '#121212', 1.5);
    }
    stats.ms = performance.now() - t0;
    return stats.ms;
  }

  return { resize, setWorld, draw, stats: () => ({ ...stats, buildMs: cache.buildMs }), invalidate: () => { cache.key = ''; } };
}
