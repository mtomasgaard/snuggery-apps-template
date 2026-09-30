// The Canvas 2D layer over the Earth (DESIGN §6): today's coasts, outlines of the pieces of today's
// crust, motion arrows, pins and their labels, and the map ellipse's edge. Colours are fixed: the
// overlay sits on the maps, which do not change with the theme. Everything is projected with the
// same formulas as the shader, forward, from the unit vectors plates.js rotated for this stop.

import { DEG, wrapPi } from './util.js';
import { orthoMatrix, SQ2, MOLL_K } from './proj.js';

const MIN_STEP2 = 0.75 * 0.75;          // decimation: skip a vertex closer than 0.75 CSS px to the last one
const ARROW_GAP = 46, ARROW_CAP_PX = 30, ARROW_MAX = 16;
const LABEL_FONT = '700 11.5px Atkinson, -apple-system, system-ui, sans-serif';
/* Plate outlines weighted by the ring's area (km², plates.bin): the big pieces read, the slivers
   recede (§19). [minimum area, line width, amber alpha, halo alpha] */
const RING_WEIGHTS = [[5e6, 1.15, 0.86, 0.38], [1e6, 0.9, 0.66, 0.28], [1e5, 0.7, 0.46, 0], [0, 0.5, 0.28, 0]];
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

export function createOverlay(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, dpr = 1;
  const M = new Float64Array(9);
  let stats = { vertices: 0, emitted: 0, arrows: 0 };

  function resize(w, h, d) {
    W = w; H = h; dpr = d;
    const cw = Math.max(1, Math.round(w * d)), ch = Math.max(1, Math.round(h * d));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  }

  /* One polyline or ring on the globe, cut where it crosses the horizon (§6 "Clipping"). */
  function globeLine(path, xyz, start, count, closed, cx, cy, r) {
    const n = closed ? count + 1 : count;
    let pX = 0, pY = 0, pZ = 0, pVis = false, pen = false, lx = 0, ly = 0;
    for (let j = 0; j < n; j++) {
      const o = 3 * (start + (j % count));
      const x = xyz[o], y = xyz[o + 1], z = xyz[o + 2];
      const X = M[0] * x + M[1] * y + M[2] * z, Y = M[3] * x + M[4] * y + M[5] * z, Z = M[6] * x + M[7] * y + M[8] * z;
      const vis = Z >= 0;
      if (j > 0 && vis !== pVis) {
        // The crossing on the great circle: interpolate the view-space vectors to Z = 0, normalise.
        const t = pZ / (pZ - Z);
        let cxv = pX + t * (X - pX), cyv = pY + t * (Y - pY);
        const k = 1 / (Math.hypot(cxv, cyv) || 1); cxv *= k; cyv *= k;
        const sx = cx + r * cxv, sy = cy - r * cyv;
        if (vis) { path.moveTo(sx, sy); pen = true; lx = sx; ly = sy; } else { if (pen) path.lineTo(sx, sy); pen = false; }
      }
      if (vis) {
        stats.vertices++;
        const sx = cx + r * X, sy = cy - r * Y;
        if (!pen) { path.moveTo(sx, sy); pen = true; lx = sx; ly = sy; stats.emitted++; }
        else if (j === n - 1 || (sx - lx) ** 2 + (sy - ly) ** 2 >= MIN_STEP2) { path.lineTo(sx, sy); lx = sx; ly = sy; stats.emitted++; }
      }
      pX = X; pY = Y; pZ = Z; pVis = vis;
    }
  }

  /* One polyline or ring on the Mollweide map, broken where Δλ jumps by more than π. */
  function mapLine(path, lam, th, start, count, closed, cx, cy, s, lam0, panY) {
    const n = closed ? count + 1 : count;
    let pdl = 0, lx = 0, ly = 0;
    for (let j = 0; j < n; j++) {
      const v = start + (j % count);
      const dl = wrapPi(lam[v] - lam0), t = th[v];
      const sx = cx + s * MOLL_K * dl * Math.cos(t), sy = cy - s * (SQ2 * Math.sin(t) - panY);
      stats.vertices++;
      if (j === 0 || Math.abs(dl - pdl) > Math.PI) { path.moveTo(sx, sy); lx = sx; ly = sy; stats.emitted++; }
      else if (j === n - 1 || (sx - lx) ** 2 + (sy - ly) ** 2 >= MIN_STEP2) { path.lineTo(sx, sy); lx = sx; ly = sy; stats.emitted++; }
      pdl = dl;
    }
  }

  function strokeTwice(path, halo, haloW, ink, inkW) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = halo; ctx.lineWidth = haloW; ctx.stroke(path);
    ctx.strokeStyle = ink; ctx.lineWidth = inkW; ctx.stroke(path);
  }

  /**
   * s: { view, plates (createPlates), coasts, outlines, arrows: [] | null, pins: [{lon, lat, kind, label}] }
   * Returns the ms it took.
   */
  function draw(s) {
    const t0 = performance.now();
    stats = { vertices: 0, emitted: 0, arrows: 0 };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = s.view, globe = v.mode === 'globe';
    const cx = v.cx, cy = v.cy;
    const r = globe ? v.radius() : 0, sc = globe ? 0 : v.mapScale();
    const lam0 = (globe ? v.globe.lon : v.map.lon0) * DEG, panY = v.map.panY;
    if (globe) orthoMatrix(v.globe.lon * DEG, v.globe.lat * DEG, M);
    const P = s.plates;
    if (P && !globe && (s.coasts || s.outlines)) stats.mapCacheMs = P.needMap();

    const layer = (geo, starts, counts, validArr, n, closed, keep) => {
      const path = new Path2D();
      for (let k = 0; k < n; k++) {
        if (!validArr[k] || (keep && !keep(k))) continue;
        if (globe) globeLine(path, geo.xyz, starts[k], counts[k], closed, cx, cy, r);
        else mapLine(path, geo.lam, geo.th, starts[k], counts[k], closed, cx, cy, sc, lam0, panY);
      }
      return path;
    };

    if (s.hidden) return performance.now() - t0;
    // Today's coasts: a fine light line with a dark halo, so it reads on any colour of any map.
    if (P && s.coasts) strokeTwice(layer(P.coasts, P.coast.segStart, P.coast.segCount, P.coasts.valid, P.coast.N, false), 'rgba(0,0,0,0.5)', 2.25, 'rgba(255,255,255,0.88)', 0.8);
    if (P && s.outlines) {
      const area = P.pl.ringArea;
      RING_WEIGHTS.forEach(([min, w, a, halo], j) => {
        const max = j ? RING_WEIGHTS[j - 1][0] : Infinity;
        const path = layer(P.rings, P.pl.ringStart, P.pl.ringCount, P.rings.valid, P.pl.R, true, (k) => area[k] >= min && area[k] < max);
        if (halo) strokeTwice(path, `rgba(0,0,0,${halo})`, w + 1.8, `rgba(255,194,71,${a})`, w);
        else { ctx.lineJoin = 'round'; ctx.strokeStyle = `rgba(255,194,71,${a})`; ctx.lineWidth = w; ctx.stroke(path); }
      });
    }
    if (P && s.arrows) drawArrows(s.arrows, v);
    for (const pin of s.pins || []) drawPin(pin, v);
    if (!globe) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + sc * panY, 2 * SQ2 * sc, SQ2 * sc, 0, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 0.75; ctx.stroke();
    }
    return performance.now() - t0;
  }

  function screenOf(vec, v) {
    const lon = Math.atan2(vec[1], vec[0]) / DEG, lat = Math.asin(Math.max(-1, Math.min(1, vec[2]))) / DEG;
    return v.project(lon, lat);
  }
  function drawArrows(list, v) {
    const placed = [];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const a of list) {
      if (placed.length >= ARROW_MAX) break;
      const p = screenOf(a.a, v);
      if (!p[2] || p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H) continue;
      if (placed.some((q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < ARROW_GAP * ARROW_GAP)) continue;
      // Screen direction: the anchor and a point a short way along the motion, both projected.
      const d = [a.a[0] - a.b[0], a.a[1] - a.b[1], a.a[2] - a.b[2]];
      const dn = Math.hypot(d[0], d[1], d[2]);
      if (dn < 1e-9) continue;
      const e = 0.005 / dn, a2 = [a.a[0] + d[0] * e, a.a[1] + d[1] * e, a.a[2] + d[2] * e];
      const n2 = Math.hypot(a2[0], a2[1], a2[2]); a2[0] /= n2; a2[1] /= n2; a2[2] /= n2;
      const p2 = screenOf(a2, v);
      let ux = p2[0] - p[0], uy = p2[1] - p[1];
      const un = Math.hypot(ux, uy);
      if (!(un > 1e-6)) continue;
      ux /= un; uy /= un;
      // Length grows with speed (capped); a filled head; one dark halo under shaft and head.
      const len = Math.min(ARROW_CAP_PX, 9 + 2.2 * a.speed);
      const x0 = p[0] - ux * len / 2, y0 = p[1] - uy * len / 2, x1 = p[0] + ux * len / 2, y1 = p[1] + uy * len / 2;
      const hx = -uy, hy = ux, hl = Math.min(6.5, 3 + len * 0.2);
      const bx = x1 - ux * hl, by = y1 - uy * hl;
      const head = new Path2D();
      head.moveTo(x1, y1); head.lineTo(bx + hx * hl * 0.55, by + hy * hl * 0.55); head.lineTo(bx - hx * hl * 0.55, by - hy * hl * 0.55); head.closePath();
      const shaft = new Path2D();
      shaft.moveTo(x0, y0); shaft.lineTo(bx + ux * 0.5, by + uy * 0.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3.6; ctx.stroke(shaft); ctx.lineWidth = 2.6; ctx.stroke(head);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(head);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.stroke(shaft);
      ctx.fillStyle = '#ffffff'; ctx.fill(head);
      placed.push(p);
      stats.arrows++;
    }
  }

  /* A pin drops onto the Earth and settles (pin.drop 0 → 1; 1 is at rest): its shadow firms up
     under it as it lands. */
  function drawPin(pin, v) {
    const p = v.project(pin.lon, pin.lat);
    if (!p[2]) return;
    const t = pin.drop == null ? 1 : Math.max(0, Math.min(1, pin.drop));
    const lift = (1 - easeOutBack(t)) * 18;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 3);
    ctx.beginPath();
    ctx.ellipse(p[0], p[1] + 1.5, 5.5, 2.2, 0, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(0,0,0,${0.4 * t})`; ctx.fill();
    ctx.beginPath();
    ctx.arc(p[0], p[1] - lift, 5, 0, 2 * Math.PI);
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
    ctx.fillStyle = pin.kind === 'look' ? '#ffc247' : '#e8483b';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.75; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.restore();
    if (!pin.label || t < 1) return;
    ctx.font = LABEL_FONT;
    const w = ctx.measureText(pin.label).width;
    const left = p[0] + 10 + w > W - 4;
    const x = left ? p[0] - 10 - w : p[0] + 10, y = p[1] + 4;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.72)'; ctx.lineJoin = 'round';
    ctx.strokeText(pin.label, x, y);
    ctx.fillStyle = '#ffffff'; ctx.fillText(pin.label, x, y);
  }

  return { resize, draw, stats: () => stats };
}
