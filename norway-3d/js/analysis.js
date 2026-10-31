// What the terrain does with the sun and with sight: the grids the shadows are swept over, the
// viewshed from a point, the profile along a line, and the skyline from the marker.
//
// Every grid is a square in a TANGENT PLANE at its center: cells are Mercator cells (square on the
// ground, since Mercator is conformal), measured in ground meters at the center's latitude, and
// every height is lowered by the earth's curvature from the center, d² / 2R (times 1 − k for the
// sight lines, with k = 0.13, the usual refraction coefficient). In that plane the sun's rays and
// a line of sight are straight lines, so the line sweeps of js/sun.js (Besseggen's) apply as they
// are; heights are in decimeters, as there. They are built from the heights the app holds
// (js/heights.js), whatever their source: the 1 m model near the view, the 10 m model beyond it.

import { mercX, mercY, lonOf, latOf, cosLat, EARTH } from './geo.js';
import { clamp, DEG, RAD } from './util.js';

export const REFRACTION = 0.13;

/** A grid of n x n cells, `side` ground meters across, centered on Mercator (cX, cY). */
export function buildGrid(sample, cX, cY, side, n, k = 0) {
  const c = cosLat(cY), resM = side / c / n, res = side / n;
  const data = new Float32Array(n * n);
  const half = n / 2, drop = (1 - k) / (2 * EARTH);
  let missing = 0, maxH = -1e9;
  for (let r = 0; r < n; r++) {
    const Y = cY + (half - r - 0.5) * resM, dy = (half - r - 0.5) * res;
    for (let col = 0; col < n; col++) {
      const X = cX + (col + 0.5 - half) * resM, dx = (col + 0.5 - half) * res;
      let h = sample(X, Y);
      if (h == null) { h = 0; missing++; }
      h = Math.max(0, h);
      if (h > maxH) maxH = h;
      data[r * n + col] = (h - (dx * dx + dy * dy) * drop) * 10;
    }
  }
  // local ground meters, x east and y north, with the center at 0, 0 (js/sun.js's frame: x0 is the
  // west edge's cell center, y1 the north edge's)
  return { nx: n, ny: n, res, data, cX, cY, side, resM, c, maxH, missing,
    x0: (0.5 - half) * res, x1: (half - 0.5) * res, y0: (0.5 - half) * res, y1: (half - 0.5) * res };
}

/** Bilinear meters from a grid at local ground (x, y); outside it, its nearest edge. */
export function gridSample(g, x, y) {
  const u = clamp((x - g.x0) / g.res, 0, g.nx - 1.0001), v = clamp((g.y1 - y) / g.res, 0, g.ny - 1.0001);
  const c0 = u | 0, r0 = v | 0, fu = u - c0, fv = v - r0, d = g.data, i = r0 * g.nx + c0;
  const a = d[i] + (d[i + 1] - d[i]) * fu, b = d[i + g.nx] + (d[i + g.nx + 1] - d[i + g.nx]) * fu;
  return (a + (b - a) * fv) * 0.1;
}
/** Local ground (x, y) of a grid to Mercator, and back. */
export const toMerc = (g, x, y) => [g.cX + x / g.c, g.cY + y / g.c];
export const toLocal = (g, X, Y) => [(X - g.cX) * g.c, (Y - g.cY) * g.c];

/** Where a grid lies in the scene, for the shader: west and north edges, width and depth. */
export function sceneRect(g, frame, out) {
  const w = g.side / g.c;
  return out.set(frame.sx(g.cX - w / 2), frame.sz(g.cY + w / 2), w * frame.c0, w * frame.c0);
}

// ---------------------------------------------------------------- the viewshed
// Besseggen's radial sweep (js/analysis.js there): for each azimuth, march outward keeping the
// largest elevation angle seen so far; a sample is seen when it rises above it. The eye is at the
// grid's center; the target is a person standing there (1.7 m), the standard second offset.
export function viewshed(g, eyeAbove, radius, targetAbove = 1.7) {
  const n = g.nx, res = g.res, out = new Uint8Array(n * n);
  const eyeGround = gridSample(g, 0, 0), eyeZ = eyeGround + eyeAbove;
  const nAz = clamp(Math.round((2 * Math.PI * radius) / (res * 4)), 720, 2880), dTh = (2 * Math.PI) / nAz;
  const put = (x, y, rad) => {
    const c0 = Math.round((x - g.x0) / res), r0 = Math.round((g.y1 - y) / res);
    for (let dr = -rad; dr <= rad; dr++) {
      const r = r0 + dr; if (r < 0 || r >= n) continue;
      for (let dc = -rad; dc <= rad; dc++) { const c = c0 + dc; if (c >= 0 && c < n) out[r * n + c] = 255; }
    }
  };
  put(0, 0, 1);
  let seen = 0, all = 0;
  for (let a = 0; a < nAz; a++) {
    const ux = Math.sin(a * dTh), uy = Math.cos(a * dTh);
    let maxAng = -Infinity;
    for (let t = res; t <= radius; t += res) {
      const x = ux * t, y = uy * t;
      const h = gridSample(g, x, y), ground = (h - eyeZ) / t;
      if ((h + targetAbove - eyeZ) / t >= maxAng) put(x, y, t * dTh > res * 2 ? Math.min(3, Math.round((t * dTh) / (2 * res))) : 0);
      if (ground > maxAng) maxAng = ground;
    }
  }
  // the share of the disc that is seen, cell by cell
  const rc = radius / res;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const dx = c + 0.5 - n / 2, dy = r + 0.5 - n / 2;
    if (dx * dx + dy * dy > rc * rc) { out[r * n + c] = 0; continue; }
    all++; if (out[r * n + c]) seen++;
  }
  return { mask: out, eyeGround, eyeZ, seenM2: seen * res * res, allM2: all * res * res, radius };
}

// ---------------------------------------------------------------- the profile
/** Heights along a polyline of Mercator points, every `step` ground meters at most, `max` samples. */
export function profile(sample, pts, max = 600) {
  const legs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [aX, aY] = pts[i - 1], [bX, bY] = pts[i];
    const d = haversineM(aX, aY, bX, bY);
    legs.push({ aX, aY, bX, bY, d, from: total });
    total += d;
  }
  const n = Math.max(2, Math.min(max, Math.ceil(total / 2) + 1));
  const dist = new Float64Array(n), h = new Float64Array(n), X = new Float64Array(n), Y = new Float64Array(n);
  let missing = 0, li = 0;
  for (let i = 0; i < n; i++) {
    const s = (total * i) / (n - 1);
    while (li < legs.length - 1 && s > legs[li].from + legs[li].d) li++;
    const L = legs[li], f = L.d ? clamp((s - L.from) / L.d, 0, 1) : 0;
    X[i] = L.aX + (L.bX - L.aX) * f; Y[i] = L.aY + (L.bY - L.aY) * f;
    const v = sample(X[i], Y[i]);
    if (v == null) missing++;
    dist[i] = s; h[i] = v == null ? NaN : Math.max(0, v);
  }
  let up = 0, down = 0, hi = -Infinity, lo = Infinity, hiAt = 0;
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(h[i])) continue;
    if (h[i] > hi) { hi = h[i]; hiAt = i; }
    if (h[i] < lo) lo = h[i];
    if (i && !Number.isNaN(h[i - 1])) { const d = h[i] - h[i - 1]; if (d > 0) up += d; else down -= d; }
  }
  return { n, total, dist, h, X, Y, up, down, hi, lo, hiAt, missing, step: total / (n - 1) };
}
function haversineM(aX, aY, bX, bY) {
  const p1 = latOf(aY) * DEG, p2 = latOf(bY) * DEG, dl = (lonOf(bX) - lonOf(aX)) * DEG;
  const s = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

// ---------------------------------------------------------------- the skyline
/** The horizon from Mercator (X, Y): for each half degree of true azimuth, the highest elevation
 *  angle of the terrain out to `reach` ground meters, with curvature and refraction, from an eye
 *  `eye` meters above the ground. The march's step grows with distance (2 %, at least 10 m). */
export const SKY_AZ = 720;
export function skyline(sample, X, Y, eye = 1.7, reach = 60000) {
  const c = cosLat(Y), h0 = sample(X, Y);
  const z0 = (h0 == null ? 0 : Math.max(0, h0)) + eye;
  const ang = new Float32Array(SKY_AZ), drop = (1 - REFRACTION) / (2 * EARTH);
  let samples = 0;
  for (let a = 0; a < SKY_AZ; a++) {
    const th = (a * 360 / SKY_AZ) * DEG, ux = Math.sin(th) / c, uy = Math.cos(th) / c;
    let best = -Math.PI / 2;
    for (let t = 15; t < reach; t += Math.max(10, t * 0.02)) {
      const h = sample(X + ux * t, Y + uy * t);
      samples++;
      if (h == null) continue;
      const e = Math.atan2(Math.max(0, h) - z0 - t * t * drop, t);
      if (e > best) best = e;
    }
    ang[a] = best * RAD;
  }
  return { ang, z0, ground: h0, samples };
}
/** The horizon's altitude at a true azimuth, interpolated. */
export function horizonAt(sky, az) {
  const f = ((((az % 360) + 360) % 360) / 360) * SKY_AZ, i = Math.floor(f) % SKY_AZ, j = (i + 1) % SKY_AZ, k = f - Math.floor(f);
  return sky.ang[i] * (1 - k) + sky.ang[j] * k;
}
export { mercX, mercY };
