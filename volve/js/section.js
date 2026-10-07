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
// The drawing is a stack of separate layers over one axis (sectionAxis): the ground, the seismic
// (js/seismic.js, at its own depths), the gaps (no active cell), the cells, the horizons, the wells,
// the frame and its labels. The axis maps (s, depth) to the canvas in meters on both sides and is the
// only place a scale lives, so the seismic and the cells, each at its own depths as delivered, share
// it without either being moved.

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

/** The middles of the grid's columns on the map (each column the active cells of one I and J, its middle
 *  the mean of their corners), with their I and J (from 1), and the grid's two directions on the map:
 *  dI and dJ, the mean step from a column to its neighbor one I or one J on, as unit vectors, and step.I
 *  and step.J, those steps' mean lengths in meters. */
export function columns(geom, NA, ijk, NI, NJ) {
  const sx = new Float64Array(NI * NJ), sy = new Float64Array(NI * NJ), n = new Uint32Array(NI * NJ);
  for (let c = 0; c < NA; c++) {
    const q = ijk[c * 3] + ijk[c * 3 + 1] * NI;
    for (let k = 0; k < 8; k++) { sx[q] += geom[c * 24 + k * 3]; sy[q] += geom[c * 24 + k * 3 + 1]; }
    n[q] += 8;
  }
  const x = [], y = [], I = [], J = [], d = { I: [0, 0], J: [0, 0] }, cnt = { I: 0, J: 0 };
  for (let q = 0; q < n.length; q++) {
    if (!n[q]) continue;
    x.push(sx[q] / n[q]); y.push(sy[q] / n[q]); I.push(q % NI + 1); J.push(Math.floor(q / NI) + 1);
    for (const [key, r, ok] of [['I', q + 1, q % NI < NI - 1], ['J', q + NI, q + NI < n.length]]) if (ok && n[r]) { d[key][0] += sx[r] / n[r] - sx[q] / n[q]; d[key][1] += sy[r] / n[r] - sy[q] / n[q]; cnt[key]++; }
  }
  const unit = (v) => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };
  return { x, y, I, J, m: x.length, dI: unit(d.I), dJ: unit(d.J), step: { I: Math.hypot(...d.I) / (cnt.I || 1), J: Math.hypot(...d.J) / (cnt.J || 1) } };
}
/** A line trimmed to the cells it cuts: from the first to the last, in whole meters. */
export function trimLine(geom, NA, ijk, l) {
  const sec = cutGrid(geom, NA, ijk, l.a, l.b, null);
  if (!sec.n) return l;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < sec.pts.length; i += 2) { if (sec.pts[i] < lo) lo = sec.pts[i]; if (sec.pts[i] > hi) hi = sec.pts[i]; }
  const { ux, uy } = sec.line, at = (t) => [Math.round(l.a[0] + ux * t), Math.round(l.a[1] + uy * t)];
  return { ...l, a: at(lo), b: at(hi) };
}
/** The field's own two lines, from the cells themselves. Along: of the straight lines through the
 *  field (every whole degree, offsets every 50 m), the one that passes within `half` meters of the
 *  middles of the most grid columns; Across: of the lines square to it, the one that does. Each runs
 *  from the first cell it cuts to the last, A at its west end (its north end
 *  on a line running north and south). Columns, not cells: a line is judged by the field it crosses
 *  on the map, whatever the layers below. */
export function fieldLines(geom, NA, ijk, NI, NJ, half = 60, pad = 150) {
  const { x: xs, y: ys, m } = columns(geom, NA, ijk, NI, NJ);
  const mx = xs.reduce((a, b) => a + b, 0) / m, my = ys.reduce((a, b) => a + b, 0) / m;
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
  const along = trimLine(geom, NA, ijk, best(Array.from({ length: 180 }, (_, i) => i)));
  const across = trimLine(geom, NA, ijk, best([(along.deg + 90) % 180]));
  return { along, across, columns: m };
}

/* ── the sweep (plan 0012 D14): the line moved across the field, one of the grid's own slices at a time ── */

/** The family a line sweeps through: the grid's columns (I) or its rows (J), whichever family's step from
 *  one slice to the next lies most nearly square to the line. cols: columns() above. */
export function sweepAxis(cols, a, b) {
  const { ux, uy } = lineOf(a, b), dot = (d) => Math.abs(-uy * d[0] + ux * d[1]);
  return dot(cols.dI) >= dot(cols.dJ) ? 'I' : 'J';
}
/** The slices of one family that hold an active cell, in grid order: [{ k, mid }], k from 1, mid the
 *  middle of its columns' middles on the map. */
export function slices(cols, axis) {
  const by = new Map();
  for (let i = 0; i < cols.m; i++) { const k = cols[axis][i], v = by.get(k) || [0, 0, 0]; v[0] += cols.x[i]; v[1] += cols.y[i]; v[2]++; by.set(k, v); }
  return [...by.keys()].sort((p, q) => p - q).map((k) => { const v = by.get(k); return { k, mid: [v[0] / v[2], v[1] / v[2]] }; });
}
/** Where a line of the field's own (l) sits among a family's slices: the index of the first slice whose
 *  middle lies beyond the line's middle, going the way the family's index grows; the line takes that
 *  place in the sweep. */
export function slot(cols, axis, list, l) {
  const d = axis === 'I' ? cols.dI : cols.dJ, m = [(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2];
  const i = list.findIndex((s) => (s.mid[0] - m[0]) * d[0] + (s.mid[1] - m[1]) * d[1] > 0);
  return i < 0 ? list.length : i;
}
/**
 * One slice of the grid as a section (plan 0012 D14): the active cells of one column (axis 'I', one I) or
 * row ('J', one J), each drawn as the block it is, along the slice's own path rather than a straight line.
 * A cell's block is its face midway across the slice, from its corners: its back side (toward the lower
 * index along the slice) and its front, top and base. The path runs through the middles of the pillars
 * between one cell and the next (the mean over the slice's cells at each boundary, a gap in the slice
 * bridged straight); s is the distance along it from A, its west end. The shape is cutGrid's, so every
 * layer draws it alike; line.path holds the path on the map and line.s the distance at each point.
 */
export function sliceSection(geom, NA, ijk, axis, k, tops) {
  const t0 = typeof performance === 'object' ? performance.now() : Date.now();
  const own = axis === 'I' ? 0 : 1, run = 1 - own, along = axis === 'I' ? 2 : 1, across = axis === 'I' ? 1 : 2;
  const ids = [], bx = new Map();
  const mid = (p, i, j, c) => (geom[p + i * 3 + c] + geom[p + j * 3 + c]) / 2;
  const add = (b, x, y) => { const v = bx.get(b) || [0, 0, 0]; v[0] += x; v[1] += y; v[2]++; bx.set(b, v); };
  for (let c = 0; c < NA; c++) {
    if (ijk[c * 3 + own] !== k - 1) continue;
    const p = c * 24, j = ijk[c * 3 + run];
    ids.push(c);
    add(j, mid(p, 0, across, 0), mid(p, 0, across, 1));
    add(j + 1, mid(p, along, along | across, 0), mid(p, along, along | across, 1));
  }
  const bs = [...bx.keys()].sort((p, q) => p - q), j0 = bs[0] ?? 0, j1 = bs[bs.length - 1] ?? 0, path = [];
  for (let j = j0; j <= j1; j++) {
    if (bx.has(j)) { const v = bx.get(j); path.push([v[0] / v[2], v[1] / v[2]]); continue; }
    const lo = bs.filter((q) => q < j).pop(), hi = bs.find((q) => q > j), A = bx.get(lo), B = bx.get(hi), t = (j - lo) / (hi - lo);
    path.push([A[0] / A[2] + (B[0] / B[2] - A[0] / A[2]) * t, A[1] / A[2] + (B[1] / B[2] - A[1] / A[2]) * t]);
  }
  if (!path.length) path.push([0, 0], [1, 0]);
  const flip = path[path.length - 1][0] < path[0][0];
  if (flip) path.reverse();
  const sAt = [0];
  for (let i = 1; i < path.length; i++) sAt.push(sAt[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const L = sAt[sAt.length - 1] || 1, S = (j) => sAt[flip ? j1 - j : j - j0];
  const cells = [], offs = [0], pts = [], topSeg = [];
  let z0 = Infinity, z1 = -Infinity;
  for (const c of ids) {
    const p = c * 24, j = ijk[c * 3 + run], sb = S(j), sf = S(j + 1);
    const q = [sb, mid(p, 0, across, 2), sf, mid(p, along, along | across, 2), sf, mid(p, 4 | along, 4 | along | across, 2), sb, mid(p, 4, 4 | across, 2)];
    if (Math.max(q[7] - q[1], q[5] - q[3]) < 1e-3) continue;   // a pinched-out cell: no height
    cells.push(c);
    for (let i = 0; i < 8; i += 2) { pts.push(q[i], q[i + 1]); if (q[i + 1] < z0) z0 = q[i + 1]; if (q[i + 1] > z1) z1 = q[i + 1]; }
    offs.push(pts.length / 2);
    if (tops && tops[ijk[c * 3 + 2] + 1]) topSeg.push(...(sb < sf ? [sb, q[1], sf, q[3]] : [sf, q[3], sb, q[1]]));
  }
  const line = { ...lineOf(path[0], path[path.length - 1]), L, path, s: sAt, slice: { axis, k } };
  const t1 = typeof performance === 'object' ? performance.now() : Date.now();
  return { line, n: cells.length, cells: Int32Array.from(cells), offs: Int32Array.from(offs), pts: Float32Array.from(pts), tops: Float32Array.from(topSeg), z0, z1, ms: t1 - t0 };
}
/** The point at distance s along a section's line on the map: on its path where it has one. */
export function lineAt(ln, s) {
  if (!ln.path) return [ln.a[0] + ln.ux * s, ln.a[1] + ln.uy * s];
  const P = ln.path, D = ln.s;
  let i = 1;
  while (i < P.length - 1 && D[i] < s) i++;
  const t = (s - D[i - 1]) / ((D[i] - D[i - 1]) || 1);
  return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t];
}
/** wellsNear() for a section along a path: each well's path, in steps of 10 m or less, against the path's
 *  segments; a point within `corridor` of the path is drawn at the distance along it of its nearest point. */
export function wellsNearPath(paths, ln, corridor) {
  const out = [], P = ln.path, D = ln.s, box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const q of P) { box[0] = Math.min(box[0], q[0] - corridor); box[1] = Math.min(box[1], q[1] - corridor); box[2] = Math.max(box[2], q[0] + corridor); box[3] = Math.max(box[3], q[1] + corridor); }
  paths.forEach((path, i) => {
    if (!path.some((q) => q[0] >= box[0] && q[0] <= box[2] && q[1] >= box[1] && q[1] <= box[3]) && !path.some((q, k) => k && Math.min(q[0], path[k - 1][0]) <= box[2] && Math.max(q[0], path[k - 1][0]) >= box[0] && Math.min(q[1], path[k - 1][1]) <= box[3] && Math.max(q[1], path[k - 1][1]) >= box[1])) return;   // nowhere near
    const parts = []; let cur = null, dmin = Infinity;
    for (let k = 0; k + 1 < path.length; k++) {
      const A = path[k], B = path[k + 1], n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) / 10));
      for (let m = k ? 1 : 0; m <= n; m++) {
        const t = m / n, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t, z = A[2] + (B[2] - A[2]) * t;
        let best = Infinity, bs = 0;
        for (let g = 1; g < P.length; g++) {
          const ex = P[g][0] - P[g - 1][0], ey = P[g][1] - P[g - 1][1], e2 = ex * ex + ey * ey || 1;
          const u = Math.max(0, Math.min(1, ((x - P[g - 1][0]) * ex + (y - P[g - 1][1]) * ey) / e2)), dd = Math.hypot(x - P[g - 1][0] - ex * u, y - P[g - 1][1] - ey * u);
          if (dd < best) { best = dd; bs = D[g - 1] + (D[g] - D[g - 1]) * u; }
        }
        if (best > corridor) { cur = null; continue; }
        dmin = Math.min(dmin, best);
        if (!cur) { cur = []; parts.push(cur); }
        cur.push(bs, z);
      }
    }
    const kept = parts.filter((q) => q.length >= 4);
    if (kept.length) out.push({ i, parts: kept, dmin });
  });
  return out;
}
/** A drawn line's sweep, parallel to itself: steps of one slice of the family it crosses (the family's
 *  mean step, square to the line), over the field's columns. Returns { axis, step, lo, hi, nx, ny }: the
 *  line at step j is moved j * step meters along (nx, ny), j from lo to hi, 0 the line as drawn. */
export function shifts(cols, a, b) {
  const { ux, uy } = lineOf(a, b), nx = -uy, ny = ux, axis = sweepAxis(cols, a, b), d = axis === 'I' ? cols.dI : cols.dJ;
  const step = Math.max(10, cols.step[axis] * Math.abs(d[0] * nx + d[1] * ny));
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < cols.m; i++) { const o = (cols.x[i] - a[0]) * nx + (cols.y[i] - a[1]) * ny; lo = Math.min(lo, o); hi = Math.max(hi, o); }
  return { axis, step, lo: Math.min(0, Math.floor(lo / step)), hi: Math.max(0, Math.ceil(hi / step)), nx, ny };
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
 * that fits both the line's length in the width and the depth range (stretched) in the height, and the
 * line is centered across. datum: model.json's center[2], so depth = z + datum. win: the depths to show,
 * { top, bot } in z (the cut's own range, padded, when it is not given): with the seismic shown, the
 * app widens it to show the seismic above and below the model.
 */
export function sectionAxis(sec, box, exag, datum, win) {
  const L = sec.line.L, pad = Math.max(10, (sec.z1 - sec.z0) * 0.04);
  const zTop = win ? win.top : sec.n ? sec.z0 - pad : -50, zBot = win ? win.bot : sec.n ? sec.z1 + pad : 50;
  const sx = Math.max(1e-6, Math.min(box.w / L, box.h / ((zBot - zTop) * exag))), sz = sx * exag;
  const x0 = box.x + (box.w - L * sx) / 2, y0 = box.y;
  return {
    sx, sz, exag, datum, L, zTop, zBot, x0, x1: x0 + L * sx, y0, y1: y0 + (zBot - zTop) * sz,
    X: (s) => x0 + s * sx, Y: (z) => y0 + (z - zTop) * sz,
    S: (x) => (x - x0) / sx, Z: (y) => zTop + (y - y0) / sz,
  };
}

/** Round stretches, for a section that has more room than the 3D view's stretch fills. */
export const STRETCHES = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
/**
 * The section's own vertical stretch in a box (plan 0012 D13): the largest round stretch at which the whole
 * section (or the depths win shows) still fits the box, where that is a fifth or more above the 3D view's (exag); else the 3D view's.
 * So a pane made taller fills with the section, and says by how much it is stretched.
 */
export function ownExag(sec, box, exag, win) {
  if (!sec.n && !win) return exag;
  const pad = Math.max(10, (sec.z1 - sec.z0) * 0.04), span = win ? win.bot - win.top : sec.z1 - sec.z0 + 2 * pad, fill = (box.h / span) / (box.w / sec.line.L);
  let e = 0;
  for (const s of STRETCHES) if (s <= fill) e = s;
  return e >= exag * 1.2 ? e : exag;
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
/** A cell's size on screen: its width and its mean thickness (its area over its width), in px. */
export function cellPx(sec, ax, i) {
  let lo = Infinity, hi = -Infinity, area = 0;
  for (let k = sec.offs[i], j = sec.offs[i + 1] - 1; k < sec.offs[i + 1]; j = k++) {
    const s = sec.pts[k * 2];
    if (s < lo) lo = s; if (s > hi) hi = s;
    area += (sec.pts[j * 2] * sec.pts[k * 2 + 1] - sec.pts[k * 2] * sec.pts[j * 2 + 1]);
  }
  const w = (hi - lo) * ax.sx;
  return [w, w > 0 ? (Math.abs(area / 2) * ax.sx * ax.sz) / w : 0];
}
/** The cells' size on screen, the median of the smaller of each one's width and thickness: edges fade
 *  where cells are too small to show them, across or down (Volve's layers are a few meters thick, so a
 *  section of them is a pixel or two a layer, and an edge on every one would darken every color). */
export function medianCellPx(sec, ax) {
  if (!sec.n) return 0;
  const w = [];
  for (let i = 0; i < sec.n; i += Math.max(1, Math.floor(sec.n / 400))) { const [cw, ct] = cellPx(sec, ax, i); w.push(Math.min(cw, ct)); }
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
  // (an inactive layer a few meters thick) stays a gap down to a pixel
  // and stroked 1 px wide: cells under a pixel thick (Volve's layers on a section) leave anti-aliased seams
  // between them that would read as gaps; a gap narrower than a pixel cannot be shown anyway
  c.fillStyle = c.strokeStyle = '#000'; c.lineWidth = 1; c.lineJoin = 'round';
  c.beginPath(); tracePolys(c, ax, sec, Array.from({ length: sec.n }, (_, i) => i)); c.fill(); c.stroke();
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
 *  one stroke where the cells are large enough to show them. colors: RGBA per cell id. Where the cells
 *  are under 3 px (Volve's layers, a pixel or less each on a section), each group is also stroked in its
 *  own color 0.6 px wide, so the seams that anti-aliasing leaves between separately filled neighbors do not
 *  let the ground show through and pale every block (seal). The caller draws this into a layer of its
 *  own and lays it on the plot at the cells' cover; the cut's outline is rimLayer's. */
export function drawCells(ctx, ax, sec, colors, edge) {
  const all = Array.from({ length: sec.n }, (_, i) => i), w = medianCellPx(sec, ax);
  const groups = new Map();
  for (let i = 0; i < sec.n; i++) {
    const a = sec.cells[i] * 4, key = (colors[a] << 16) | (colors[a + 1] << 8) | colors[a + 2];
    let g = groups.get(key); if (!g) groups.set(key, (g = [])); g.push(i);
  }
  for (const [key, list] of groups) {
    ctx.fillStyle = ctx.strokeStyle = `rgb(${key >> 16},${(key >> 8) & 255},${key & 255})`;
    ctx.beginPath(); tracePolys(ctx, ax, sec, list); ctx.fill();
    if (w < 3) { ctx.lineWidth = 0.6; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  if (edge && w >= 3) {
    ctx.strokeStyle = edge; ctx.lineWidth = 0.75; ctx.lineJoin = 'round';
    ctx.globalAlpha = Math.min(1, (w - 3) / 4);
    ctx.beginPath(); tracePolys(ctx, ax, sec, all); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  return groups.size;
}
/** The cut's outline and its gaps' (the outer half of a 1.5 px line, which a cell at the pale end of a
 *  scale needs on a white ground): every cell stroked, then every cell's inside erased in one path, so only
 *  what lies outside all of them stays, however thin the cells. Drawn once per line, size and stretch into a
 *  canvas of its own (make(w, h) gives one). */
export function rimLayer(sec, ax, W, H, dpr, color, make) {
  const out = make(Math.max(1, Math.round(W * dpr)), Math.max(1, Math.round(H * dpr))), c = out.getContext('2d'), all = Array.from({ length: sec.n }, (_, i) => i);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // a 2.5 px line, the cells' insides then erased in one path and 1 px wider (sealed as gapLayer's mask is),
  // so 0.75 px stays outside the cut, as Norne's 1.5 px line under the fills left, and nothing between cells
  c.strokeStyle = color; c.lineWidth = 2.5; c.lineJoin = 'round';
  c.beginPath(); tracePolys(c, ax, sec, all); c.stroke();
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = c.strokeStyle = '#000'; c.lineWidth = 1;
  c.fill(); c.stroke();
  return out;
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

/** Round depth ticks inside the axis, in the shown system: [{ y, v, text }]. The figures stand alone: the
 *  axis's one title, along it, carries the unit and the datum (Volve: "Depth, m below mean sea level"). */
export function depthTicks(ax, sys, n = 3) {
  const toSys = (z) => U.toSystem(z + ax.datum, 'm', sys), fromSys = (v) => v / U.toSystem(1, 'm', sys) - ax.datum;
  const lo = toSys(ax.zTop), hi = toSys(ax.zBot), step = niceStep(hi - lo, n), out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push({ y: ax.Y(fromSys(v)), v, text: U.int(v) });
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
