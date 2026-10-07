// The section A–A′: a vertical plane through the grid along a line drawn on the map, and what is drawn
// on it. Geometry is pure (no DOM), so tools/test_section.mjs runs it in Node against the data files.
//
// Model space is geometry.bin's: x east, y north, z depth, meters, relative to model.json's center, so
// a depth below the model's datum is z + center[2]. A section is cut from the cell geometry already
// loaded: each active cell's eight corners against the plane, the plane cutting the cell's twelve
// edges, the points ordered into one convex polygon in (s, z), s the distance from A along the line.
// Each polygon is one cell, drawn in one flat color: model cells are not samples, and nothing is
// interpolated between them (plan 0012 D11).
//
// The drawing is a stack of separate layers over one axis (sectionAxis): the ground, the gaps (no
// active cell), the cells, the formation tops, the wells, the frame and its labels. The axis maps
// (s, depth) to the canvas in meters on both sides and is the only place a scale lives, so a layer
// drawn from other data at its own depths (a seismic line along the same A–A′, for one) goes in at
// its true depth on the same axis, between the ground and the cells, without touching the others.

import * as U from './units.js';

/** Corner pairs of a cell's twelve edges (corner bits: 1 +I, 2 +J, 4 down), and its top face's four. */
export const EDGES = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const TOP_EDGES = [[0, 1], [1, 3], [3, 2], [2, 0]];

/** The line from a to b ([x, y] in model meters): its length, unit direction and unit normal. */
export function lineOf(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return { a, b, L, ux: dx / L, uy: dy / L, nx: -dy / L, ny: dx / L };
}

/** Clips a convex polygon (flat [s, z, s, z, …]) to s0 <= s <= s1. */
function clipS(p, s0, s1) {
  for (const [lim, keepAbove] of [[s0, true], [s1, false]]) {
    const out = [], n = p.length / 2;
    for (let i = 0; i < n; i++) {
      const sa = p[i * 2], za = p[i * 2 + 1], j = (i + 1) % n, sb = p[j * 2], zb = p[j * 2 + 1];
      const ina = keepAbove ? sa >= lim : sa <= lim, inb = keepAbove ? sb >= lim : sb <= lim;
      if (ina) out.push(sa, za);
      if (ina !== inb) { const t = (lim - sa) / (sb - sa); out.push(lim, za + (zb - za) * t); }
    }
    p = out;
    if (p.length < 6) return null;
  }
  return p;
}

/**
 * Cuts the grid along a line. geom: geometry.bin as a Float32Array (24 per cell); ijk: ijk.bin;
 * tops: a Uint8Array over 1-based K, 1 where a formation's first layer is (its top face is drawn).
 * Returns { line, n, cells (Int32Array of cell ids), offs (Int32Array, n + 1, into pts by point),
 * pts (Float32Array of s, z), tops (Float32Array of s0, z0, s1, z1 per formation top), z0, z1 (the
 * shallowest and deepest z cut), ms }.
 */
export function cutGrid(geom, NA, ijk, a, b, tops) {
  const t0 = typeof performance === 'object' ? performance.now() : Date.now();
  const ln = lineOf(a, b), { L, ux, uy, nx, ny } = ln, ax = a[0], ay = a[1];
  const cells = [], offs = [0], pts = [], topSeg = [];
  const d = new Float64Array(8), s = new Float64Array(8);
  let z0 = Infinity, z1 = -Infinity;
  for (let c = 0; c < NA; c++) {
    const p = c * 24;
    let neg = false, pos = false, smin = Infinity, smax = -Infinity;
    for (let k = 0; k < 8; k++) {
      const x = geom[p + k * 3] - ax, y = geom[p + k * 3 + 1] - ay;
      d[k] = x * nx + y * ny; s[k] = x * ux + y * uy;
      if (d[k] < 0) neg = true; else if (d[k] > 0) pos = true;
      if (s[k] < smin) smin = s[k]; if (s[k] > smax) smax = s[k];
    }
    if (!(neg && pos) || smax <= 0 || smin >= L) continue;
    // the plane against the twelve edges: a point where an edge crosses it, or a corner on it
    const q = [];
    for (const [i, j] of EDGES) {
      if (d[i] === 0) q.push(s[i], geom[p + i * 3 + 2]);
      if ((d[i] < 0 && d[j] > 0) || (d[i] > 0 && d[j] < 0)) {
        const t = d[i] / (d[i] - d[j]);
        q.push(s[i] + (s[j] - s[i]) * t, geom[p + i * 3 + 2] + (geom[p + j * 3 + 2] - geom[p + i * 3 + 2]) * t);
      }
    }
    if (q.length < 6) continue;
    // one convex polygon: the points in order of angle about their middle
    const m = q.length / 2;
    let cs = 0, cz = 0;
    for (let i = 0; i < m; i++) { cs += q[i * 2]; cz += q[i * 2 + 1]; }
    cs /= m; cz /= m;
    const order = Array.from({ length: m }, (_, i) => i).sort((i, j) => Math.atan2(q[i * 2 + 1] - cz, q[i * 2] - cs) - Math.atan2(q[j * 2 + 1] - cz, q[j * 2] - cs));
    let poly = [];
    for (const i of order) {
      const ps = q[i * 2], pz = q[i * 2 + 1], n = poly.length;
      if (n && Math.abs(poly[n - 2] - ps) < 1e-6 && Math.abs(poly[n - 1] - pz) < 1e-6) continue;   // a corner met twice
      poly.push(ps, pz);
    }
    poly = clipS(poly, 0, L);
    if (!poly) continue;
    let area = 0;
    for (let i = 0, n = poly.length / 2; i < n; i++) { const j = (i + 1) % n; area += poly[i * 2] * poly[j * 2 + 1] - poly[j * 2] * poly[i * 2 + 1]; }
    if (Math.abs(area) < 1e-3) continue;   // a pinched-out cell: no area on the plane
    cells.push(c);
    for (let i = 0; i < poly.length; i += 2) { pts.push(poly[i], poly[i + 1]); if (poly[i + 1] < z0) z0 = poly[i + 1]; if (poly[i + 1] > z1) z1 = poly[i + 1]; }
    offs.push(pts.length / 2);
    // a formation's top: the plane against the cell's top face
    if (tops && tops[ijk[c * 3 + 2] + 1]) {
      const e = [];
      for (const [i, j] of TOP_EDGES) {
        if (d[i] === 0) e.push(s[i], geom[p + i * 3 + 2]);
        else if ((d[i] < 0 && d[j] > 0) || (d[i] > 0 && d[j] < 0)) {
          const t = d[i] / (d[i] - d[j]);
          e.push(s[i] + (s[j] - s[i]) * t, geom[p + i * 3 + 2] + (geom[p + j * 3 + 2] - geom[p + i * 3 + 2]) * t);
        }
      }
      if (e.length >= 4) {
        let [sa, za, sb, zb] = e;
        if (sa > sb) [sa, za, sb, zb] = [sb, zb, sa, za];
        if (sb > 0 && sa < L && sb - sa > 1e-6) {
          const cl = (v) => Math.max(0, Math.min(L, v)), f = (v) => za + (zb - za) * (v - sa) / (sb - sa);
          topSeg.push(cl(sa), f(cl(sa)), cl(sb), f(cl(sb)));
        }
      }
    }
  }
  const t1 = typeof performance === 'object' ? performance.now() : Date.now();
  return { line: ln, n: cells.length, cells: Int32Array.from(cells), offs: Int32Array.from(offs), pts: Float32Array.from(pts), tops: Float32Array.from(topSeg), z0, z1, ms: t1 - t0 };
}

/**
 * The wells near the line: every part of a well's path within `corridor` meters of the plane and
 * between A and A′, projected onto it as (s, z). paths: per well, its points [x, y, z]. Returns
 * [{ i, parts: [[s, z, s, z, …], …], dmin }] for the wells that come that near.
 */
export function wellsNear(paths, ln, corridor) {
  const out = [], { a, L, ux, uy, nx, ny } = ln;
  paths.forEach((path, i) => {
    const parts = []; let cur = null, dmin = Infinity;
    for (let k = 0; k + 1 < path.length; k++) {
      const P = path[k], Q = path[k + 1];
      const sp = (P[0] - a[0]) * ux + (P[1] - a[1]) * uy, dp = (P[0] - a[0]) * nx + (P[1] - a[1]) * ny;
      const sq = (Q[0] - a[0]) * ux + (Q[1] - a[1]) * uy, dq = (Q[0] - a[0]) * nx + (Q[1] - a[1]) * ny;
      // Liang–Barsky on the segment's parameter: -corridor <= d <= corridor and 0 <= s <= L
      let t0 = 0, t1 = 1;
      for (const [p0, p1, lo, hi] of [[dp, dq, -corridor, corridor], [sp, sq, 0, L]]) {
        const dv = p1 - p0;
        if (Math.abs(dv) < 1e-9) { if (p0 < lo || p0 > hi) { t0 = 1; t1 = 0; } continue; }
        let ta = (lo - p0) / dv, tb = (hi - p0) / dv;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      }
      if (t1 < t0) { cur = null; continue; }
      const at = (t) => [sp + (sq - sp) * t, P[2] + (Q[2] - P[2]) * t];
      dmin = Math.min(dmin, Math.abs(dp + (dq - dp) * t0), Math.abs(dp + (dq - dp) * t1));
      const A = at(t0), B = at(t1);
      if (!cur || t0 > 1e-9) { cur = [A[0], A[1]]; parts.push(cur); }
      cur.push(B[0], B[1]);
      if (t1 < 1 - 1e-9) cur = null;
    }
    if (parts.length) out.push({ i, parts, dmin });
  });
  return out;
}

/** The field's own two lines, from the cells themselves. Along: of the straight lines through the
 *  field (every whole degree, offsets every 50 m), the one that passes within `half` meters of the
 *  middles of the most grid columns; Across: of the lines square to it, the one that does. Each runs
 *  from the first cell it cuts to the last, A at its west end (its north end
 *  on a line running north and south). Columns, not cells: a line is judged by the field it crosses
 *  on the map, whatever the layers below. */
export function fieldLines(geom, NA, ijk, NI, NJ, half = 60, pad = 150) {
  const sx = new Float64Array(NI * NJ), sy = new Float64Array(NI * NJ), n = new Uint32Array(NI * NJ);
  for (let c = 0; c < NA; c++) {
    const q = ijk[c * 3] + ijk[c * 3 + 1] * NI;
    for (let k = 0; k < 8; k++) { sx[q] += geom[c * 24 + k * 3]; sy[q] += geom[c * 24 + k * 3 + 1]; }
    n[q] += 8;
  }
  const xs = [], ys = [];
  for (let q = 0; q < n.length; q++) if (n[q]) { xs.push(sx[q] / n[q]); ys.push(sy[q] / n[q]); }
  const m = xs.length, mx = xs.reduce((a, b) => a + b, 0) / m, my = ys.reduce((a, b) => a + b, 0) / m;
  const best = (angles) => {
    let top = null;
    for (const deg of angles) {
      const th = deg * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
      // the columns' offsets from the middle, counted in 10 m bins; a line at offset o takes the bins
      // within `half` of it (a window slid along the bins, every 50 m)
      let lo = Infinity, hi = -Infinity;
      const off = new Float64Array(m);
      for (let i = 0; i < m; i++) { off[i] = (xs[i] - mx) * nx + (ys[i] - my) * ny; if (off[i] < lo) lo = off[i]; if (off[i] > hi) hi = off[i]; }
      const b0 = Math.floor(lo / 10), bins = new Uint32Array(Math.floor(hi / 10) - b0 + 1);
      for (let i = 0; i < m; i++) bins[Math.floor(off[i] / 10) - b0]++;
      const cum = new Uint32Array(bins.length + 1);
      for (let i = 0; i < bins.length; i++) cum[i + 1] = cum[i] + bins[i];
      const w = Math.round(half / 10);
      for (let o = Math.ceil(lo / 50) * 50; o <= hi; o += 50) {
        const c = Math.floor(o / 10) - b0, cnt = cum[Math.min(bins.length, c + w + 1)] - cum[Math.max(0, c - w)];
        if (!top || cnt > top.cnt) top = { cnt, deg, o, ux, uy, nx, ny };
      }
    }
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < m; i++) {
      if (Math.abs((xs[i] - mx) * top.nx + (ys[i] - my) * top.ny - top.o) > half) continue;
      const t = (xs[i] - mx) * top.ux + (ys[i] - my) * top.uy;
      if (t < lo) lo = t; if (t > hi) hi = t;
    }
    const at = (t) => [mx + top.nx * top.o + top.ux * t, my + top.ny * top.o + top.uy * t];
    let a = at(lo - pad), b = at(hi + pad);
    if (b[0] < a[0] - 1e-6 || (Math.abs(b[0] - a[0]) < 1e-6 && b[1] > a[1])) [a, b] = [b, a];
    return { a: a.map((v) => Math.round(v)), b: b.map((v) => Math.round(v)), deg: top.deg, columns: top.cnt };
  };
  // each line ends where the cells it cuts end, so its ends lie on the field
  const trim = (l) => {
    const sec = cutGrid(geom, NA, ijk, l.a, l.b, null);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < sec.pts.length; i += 2) { if (sec.pts[i] < lo) lo = sec.pts[i]; if (sec.pts[i] > hi) hi = sec.pts[i]; }
    const { ux, uy } = sec.line, at = (t) => [Math.round(l.a[0] + ux * t), Math.round(l.a[1] + uy * t)];
    return { ...l, a: at(lo), b: at(hi) };
  };
  const along = trim(best(Array.from({ length: 180 }, (_, i) => i)));
  const across = trim(best([(along.deg + 90) % 180]));
  return { along, across, columns: m };
}

/* ── the axis: one scale for every layer ── */

/** A round step for about n ticks over span. */
export function niceStep(span, n) {
  const raw = span / n, e = 10 ** Math.floor(Math.log10(raw)), f = raw / e;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
}
/**
 * The section's axis in the box { x, y, w, h } (CSS px): distance along the line across, depth down,
 * the vertical stretched by exag, as the 3D view is. The whole section fits: the scale is the larger
 * that fits both the line's length in the width and the cut's depth range (stretched) in the height,
 * and the line is centered across. datum: model.json's center[2], so depth = z + datum.
 */
export function sectionAxis(sec, box, exag, datum) {
  const L = sec.line.L, pad = Math.max(10, (sec.z1 - sec.z0) * 0.04);
  const zTop = sec.n ? sec.z0 - pad : -50, zBot = sec.n ? sec.z1 + pad : 50;
  const sx = Math.max(1e-6, Math.min(box.w / L, box.h / ((zBot - zTop) * exag))), sz = sx * exag;
  const x0 = box.x + (box.w - L * sx) / 2, y0 = box.y;
  return {
    sx, sz, exag, datum, L, zTop, zBot, x0, x1: x0 + L * sx, y0, y1: y0 + (zBot - zTop) * sz,
    X: (s) => x0 + s * sx, Y: (z) => y0 + (z - zTop) * sz,
    S: (x) => (x - x0) / sx, Z: (y) => zTop + (y - y0) / sz,
  };
}

/* ── the layers, bottom to top; each draws on ctx in CSS px (the caller scales for the DPR) ── */

/** The cells' outlines traced into ctx's current path, each polygon closed. */
function tracePolys(ctx, ax, sec, list) {
  const { pts, offs } = sec;
  for (const i of list) {
    const o0 = offs[i], o1 = offs[i + 1];
    ctx.moveTo(ax.X(pts[o0 * 2]), ax.Y(pts[o0 * 2 + 1]));
    for (let k = o0 + 1; k < o1; k++) ctx.lineTo(ax.X(pts[k * 2]), ax.Y(pts[k * 2 + 1]));
    ctx.closePath();
  }
}
/** Each cell's width on screen, the median: edges fade where cells are too small to show them. */
export function medianCellPx(sec, ax) {
  if (!sec.n) return 0;
  const w = [];
  for (let i = 0; i < sec.n; i += Math.max(1, Math.floor(sec.n / 400))) {
    let lo = Infinity, hi = -Infinity;
    for (let k = sec.offs[i]; k < sec.offs[i + 1]; k++) { const s = sec.pts[k * 2]; if (s < lo) lo = s; if (s > hi) hi = s; }
    w.push((hi - lo) * ax.sx);
  }
  w.sort((p, q) => p - q);
  return w[w.length >> 1];
}

/**
 * Where no active cell is: inside the cut, between the shallowest and deepest cell in each pixel
 * column, the parts no cell covers (an inactive layer, an inactive cell, a gap in the grid). Drawn
 * once per line, size and stretch into a canvas of its own (make(w, h) gives one), as a hatch.
 */
export function gapLayer(sec, ax, W, H, dpr, color, make) {
  const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
  const cov = make(cw, ch), c = cov.getContext('2d', { willReadFrequently: true });
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // every cell in one path, filled once: neighbors that share an edge leave no seam, and a real gap
  // (the Not shale between Garn and Ile, 3 to 10 m thick) stays a gap however thin it is drawn
  c.fillStyle = '#000';
  c.beginPath(); tracePolys(c, ax, sec, Array.from({ length: sec.n }, (_, i) => i)); c.fill();
  const px = c.getImageData(0, 0, cw, ch).data;
  const out = make(cw, ch), o = out.getContext('2d'), img = o.createImageData(cw, ch), d = img.data;
  const rgb = color.match(/[\d.]+/g).map(Number);
  let gapPx = 0;
  const x0 = Math.max(0, Math.floor(ax.x0 * dpr)), x1 = Math.min(cw, Math.ceil(ax.x1 * dpr));
  for (let x = x0; x < x1; x++) {
    let top = -1, bot = -1;
    for (let y = 0; y < ch; y++) if (px[(y * cw + x) * 4 + 3] > 127) { if (top < 0) top = y; bot = y; }
    if (top < 0) continue;
    for (let y = top; y <= bot; y++) {
      if (px[(y * cw + x) * 4 + 3] > 127) continue;
      gapPx++;
      if ((x + y) % Math.round(4 * dpr) < dpr) { const i = (y * cw + x) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; }
    }
  }
  o.putImageData(img, 0, 0);
  out.gapPx = gapPx;
  return out;
}

/** The cells, each in its one color: polygons grouped by color, one fill per color, then the edges in
 *  one stroke where the cells are wide enough to show them. colors: RGBA per cell id. rim: a 1.5 px
 *  line stroked under the fills, so only its outer half shows: the outline of the cut and of its gaps,
 *  which a cell at the pale end of a scale needs on a white ground. */
export function drawCells(ctx, ax, sec, colors, edge, rim, alpha = 1) {
  const all = Array.from({ length: sec.n }, (_, i) => i);
  if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.beginPath(); tracePolys(ctx, ax, sec, all); ctx.stroke(); }
  const groups = new Map();
  for (let i = 0; i < sec.n; i++) {
    const a = sec.cells[i] * 4, key = (colors[a] << 16) | (colors[a + 1] << 8) | colors[a + 2];
    let g = groups.get(key); if (!g) groups.set(key, (g = [])); g.push(i);
  }
  ctx.globalAlpha = alpha;
  for (const [key, list] of groups) {
    ctx.fillStyle = `rgb(${key >> 16},${(key >> 8) & 255},${key & 255})`;
    ctx.beginPath(); tracePolys(ctx, ax, sec, list); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const w = medianCellPx(sec, ax);
  if (edge && w >= 3) {
    ctx.strokeStyle = edge; ctx.lineWidth = 0.75; ctx.lineJoin = 'round';
    ctx.globalAlpha = Math.min(1, (w - 3) / 4);
    ctx.beginPath(); tracePolys(ctx, ax, sec, all); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  return groups.size;
}
/** The formation tops: the plane against each formation's first layer's top faces. */
export function drawTops(ctx, ax, sec, color) {
  const t = sec.tops;
  ctx.strokeStyle = color; ctx.lineWidth = 1.25; ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let i = 0; i < t.length; i += 4) { ctx.moveTo(ax.X(t[i]), ax.Y(t[i + 1])); ctx.lineTo(ax.X(t[i + 2]), ax.Y(t[i + 3])); }
  ctx.stroke();
}
/** One cell's outline, for the tapped cell. */
export function drawOutline(ctx, ax, sec, idx, color, halo) {
  ctx.lineJoin = 'round';
  for (const [c, w] of [[halo, 4], [color, 1.75]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); tracePolys(ctx, ax, sec, [idx]); ctx.stroke(); }
}
/** The index in sec of the cell under (x, y), or -1. */
export function cellAt(sec, ax, x, y) {
  const s = ax.S(x), z = ax.Z(y), { pts, offs } = sec;
  for (let i = 0; i < sec.n; i++) {
    let inside = false;
    for (let k = offs[i], j = offs[i + 1] - 1; k < offs[i + 1]; j = k++) {
      const si = pts[k * 2], zi = pts[k * 2 + 1], sj = pts[j * 2], zj = pts[j * 2 + 1];
      if ((zi > z) !== (zj > z) && s < ((sj - si) * (z - zi)) / (zj - zi) + si) inside = !inside;
    }
    if (inside) return i;
  }
  return -1;
}

/** Round depth ticks inside the axis, in the shown system: [{ y, text }], the unit on the deepest. */
export function depthTicks(ax, sys, n = 3) {
  const toSys = (z) => U.toSystem(z + ax.datum, 'm', sys), fromSys = (v) => v / U.toSystem(1, 'm', sys) - ax.datum;
  const lo = toSys(ax.zTop), hi = toSys(ax.zBot), step = niceStep(hi - lo, n), out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push({ y: ax.Y(fromSys(v)), v, text: U.int(v) });
  if (out.length) out[out.length - 1].text = U.withUnit(out[out.length - 1].text, U.unitOf('m', sys));
  return out;
}
/** Round distance ticks along the line from A, in meters (feet in US units), the unit on the last. */
export function distanceTicks(ax, sys, n = 3) {
  const k = U.toSystem(1, 'm', sys), span = ax.L * k, step = niceStep(span, n), out = [];
  for (let v = 0; v <= span + 1e-9; v += step) out.push({ x: ax.X(v / k), v, text: U.int(v) });
  if (out.length) out[out.length - 1].text = U.withUnit(out[out.length - 1].text, U.unitOf('m', sys));
  return out;
}

/* ── the field's top and base as height fields: where a finger on the 3D view meets the reservoir ── */

/**
 * The top and the base of the active cells as two rasters over the map (`res` meters a pixel): the
 * shallowest top face and the deepest bottom face over each pixel, NaN off the field. Each face is
 * drawn as its two triangles (corners 0-1-3 and 0-3-2, as the 3D view draws it), its depth taken
 * across each triangle. Built once, from geometry.bin as loaded.
 */
export function surfaces(geom, NA, res = 40) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < NA * 8; i++) { const x = geom[i * 3], y = geom[i * 3 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const nx = Math.ceil((x1 - x0) / res) + 1, ny = Math.ceil((y1 - y0) / res) + 1;
  const top = new Float32Array(nx * ny).fill(NaN), base = new Float32Array(nx * ny).fill(NaN);
  const tri = (P, out, deeper) => {
    const [ax, ay, az] = P[0], [bx, by, bz] = P[1], [cx, cy, cz] = P[2];
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-9) return;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / res)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - x0) / res));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - y0) / res)), j1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by, cy) - y0) / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + i * res, py = y0 + j * res;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const z = l1 * az + l2 * bz + l3 * cz, q = j * nx + i, v = out[q];
      if (v !== v || (deeper ? z > v : z < v)) out[q] = z;
    }
  };
  const c = (a, k) => [geom[a * 24 + k * 3], geom[a * 24 + k * 3 + 1], geom[a * 24 + k * 3 + 2]];
  for (let a = 0; a < NA; a++) {
    tri([c(a, 0), c(a, 1), c(a, 3)], top, false); tri([c(a, 0), c(a, 3), c(a, 2)], top, false);
    tri([c(a, 4), c(a, 5), c(a, 7)], base, true); tri([c(a, 4), c(a, 7), c(a, 6)], base, true);
  }
  let sum = 0, n = 0;
  for (const v of top) if (v === v) { sum += v; n++; }
  return { x0, y0, res, nx, ny, top, base, topMean: sum / n, x1, y1 };
}
/** The raster's value at a map point, bilinear between the four pixels around it (those on the
 *  field), so the surface has no steps for a ray to catch on; NaN off the field. */
export function surfAt(sf, which, x, y) {
  const u = (x - sf.x0) / sf.res, v = (y - sf.y0) / sf.res, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, r = sf[which];
  let s = 0, w = 0;
  for (const [di, dj, k] of [[0, 0, (1 - fu) * (1 - fv)], [1, 0, fu * (1 - fv)], [0, 1, (1 - fu) * fv], [1, 1, fu * fv]]) {
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= sf.nx || jj >= sf.ny || k <= 0) continue;
    const z = r[jj * sf.nx + ii];
    if (z === z) { s += z * k; w += k; }
  }
  return w > 0.25 ? s / w : NaN;   // a quarter of the weight on the field at least: the field's edge stays where its cells end
}
/**
 * Where a ray first meets the field's top: o and d in model space (x, y, z depth stretched by exag
 * already undone), marched in steps of about half a raster pixel across the map, then refined. Null
 * when it passes the field by.
 */
export function rayToTop(sf, o, d) {
  const h = Math.hypot(d[0], d[1]), step = h > 1e-9 ? (sf.res * 0.5) / h : 50 / Math.max(1e-9, Math.abs(d[2]));
  const under = (t) => { const z = surfAt(sf, 'top', o[0] + d[0] * t, o[1] + d[1] * t); return z === z && o[2] + d[2] * t >= z; };
  for (let t = 0, k = 0; k < 20000; t += step, k++) {
    if (!under(t)) continue;
    let lo = Math.max(0, t - step), hi = t;
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (under(m)) hi = m; else lo = m; }
    return [o[0] + d[0] * hi, o[1] + d[1] * hi, o[2] + d[2] * hi];
  }
  return null;
}
