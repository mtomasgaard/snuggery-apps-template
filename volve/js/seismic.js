// The seismic along the section (plan 0012 D11, D14): pure functions, no DOM, so
// tools/test_seismic_display.mjs runs them in Node against data/seismic.bin and synthetic cubes.
//
// The cube is data/seismic.json's: 144 inlines by 188 crosslines of traces 25 m apart, each 352 depth
// samples 5 m apart from 2 295 m, one byte a sample, zero at code 128 and the clip at code 1 and 255
// (amplitude = (code - 128) / 127 * clip). Model space is geometry.bin's (x east, y north, meters,
// relative to model.json's center), so a trace's map point is the survey's affine grid less the center
// and nothing else: no shift, no stretch, no tie. Depth is the cube's own: sample k is at
// z.first + k * z.step meters below sea level, drawn on the same axis as the model's cells.
//
// What happens between samples, and only there:
//   - across the survey (laterally): bilinear between the four traces around a point (D11). On a line of
//     the survey's own (an inline or a crossline) the point lies on the line's traces, so only the two
//     neighbors along it take part: the traces themselves are drawn as surveyed, and the display blends
//     between neighbors as a variable-density display's texture filter does. Where the screen's
//     columns lie farther apart than the traces, each column averages points across its own width
//     first, so the display never picks traces at a stride (which would alias);
//   - in depth: a windowed sinc (a Kaiser window, 6 samples either side, beta 6) evaluated at each
//     screen row's depth. Where the rows lie farther apart than the samples, the sinc is widened to
//     the rows' own Nyquist first, so the depth is band-limited before it is resampled, never decimated.
//   - the amplitude: times the display gain, over the clip, through a color ramp symmetric about zero;
//     no AGC, nothing else.

/** The cube's grid in model space. meta: seismic.json; center: model.json's center. */
export function grid(meta, center) {
  const [ax, ay] = meta.ilVector, [bx, by] = meta.xlVector;
  return {
    nu: meta.il.count, nv: meta.xl.count, nz: meta.z.count, z0: meta.z.first, dz: meta.z.step,
    il0: meta.il.first, ils: meta.il.step, xl0: meta.xl.first, xls: meta.xl.step,
    ox: meta.origin[0] - center[0], oy: meta.origin[1] - center[1], ax, ay, bx, by, det: ax * by - ay * bx,
    clip: meta.amplitude.clip, zero: meta.amplitude.zeroCode, datum: center[2], spacing: Math.hypot(ax, ay),
  };
}
/** A trace's map point (model meters) from its fractional indices u (inline) and v (crossline). */
export const xyOf = (g, u, v) => [g.ox + u * g.ax + v * g.bx, g.oy + u * g.ay + v * g.by];
/** The fractional trace indices of a map point. */
export function uvOf(g, x, y) {
  const dx = x - g.ox, dy = y - g.oy;
  return [(dx * g.by - dy * g.bx) / g.det, (g.ax * dy - g.ay * dx) / g.det];
}
export const ilAt = (g, u) => g.il0 + u * g.ils;
export const xlAt = (g, v) => g.xl0 + v * g.xls;
export const uOfIl = (g, il) => (il - g.il0) / g.ils;
export const vOfXl = (g, xl) => (xl - g.xl0) / g.xls;
/** One byte to amplitude: zero at the zero code exactly. */
export const amp = (g, code) => ((code - g.zero) / 127) * g.clip;
/** A sample's depth below sea level (meters), as delivered. */
export const depthOf = (g, k) => g.z0 + k * g.dz;

/** The line of one inline (every crossline along it) or one crossline, end to end, A at its west end
 *  (its north end on a line running north and south), as the field's own lines are. */
export function surveyLine(g, kind, n) {
  let a, b;
  if (kind === 'inline') { const u = uOfIl(g, n); a = xyOf(g, u, 0); b = xyOf(g, u, g.nv - 1); }
  else { const v = vOfXl(g, n); a = xyOf(g, 0, v); b = xyOf(g, g.nu - 1, v); }
  if (b[0] < a[0] - 1e-6 || (Math.abs(b[0] - a[0]) < 1e-6 && b[1] > a[1])) [a, b] = [b, a];
  return { a, b, kind, n };
}
/** Every inline or crossline number of the cube, in order. */
export function surveyNumbers(g, kind) {
  const out = [], count = kind === 'inline' ? g.nu : g.nv;
  for (let i = 0; i < count; i++) out.push(kind === 'inline' ? ilAt(g, i) : xlAt(g, i));
  return out;
}
/** The inline or crossline nearest a map point, inside the cube. */
export function nearestNumber(g, kind, x, y) {
  const [u, v] = uvOf(g, x, y);
  return kind === 'inline' ? ilAt(g, Math.max(0, Math.min(g.nu - 1, Math.round(u)))) : xlAt(g, Math.max(0, Math.min(g.nv - 1, Math.round(v))));
}

/* ── in depth: the windowed sinc ── */

const HALF = 6, BETA = 6;
function i0(x) { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (x / (2 * k)) ** 2; s += t; if (t < 1e-12 * s) break; } return s; }
const I0B = i0(BETA);
const kaiser = (r) => (Math.abs(r) >= 1 ? 0 : i0(BETA * Math.sqrt(1 - r * r)) / I0B);
const sinc = (x) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
/** The kernel's weight at x samples from the point, for cutoff fc (1 at the samples' own Nyquist). */
export const sincWeight = (x, fc) => fc * sinc(fc * x) * kaiser((x * fc) / HALF);

/**
 * The rows' plan: for each row's depth (meters), the samples it takes and their weights, normalized to sum
 * to 1, so a constant trace stays constant and zero stays zero. step: the rows' spacing in meters (the
 * kernel widens to its Nyquist where it is coarser than the samples). A row outside the cube's depths
 * takes nothing (n 0): no data is drawn there.
 * Returns { start: Int32Array, n: Uint8Array, w: Float32Array (rows x width), width, fc }.
 */
export function rowPlan(g, depths, step) {
  const fc = Math.min(1, g.dz / Math.max(1e-9, Math.abs(step))), reach = Math.ceil(HALF / fc), width = 2 * reach + 1;
  const R = depths.length, start = new Int32Array(R), n = new Uint8Array(R), w = new Float32Array(R * width);
  for (let r = 0; r < R; r++) {
    const t = (depths[r] - g.z0) / g.dz;
    if (!(t >= -0.5 && t <= g.nz - 0.5)) continue;
    const k0 = Math.max(0, Math.ceil(t - reach)), k1 = Math.min(g.nz - 1, Math.floor(t + reach));
    let s = 0;
    for (let k = k0; k <= k1; k++) { const v = sincWeight(k - t, fc); w[r * width + k - k0] = v; s += v; }
    if (Math.abs(s) < 1e-9) continue;
    for (let k = k0; k <= k1; k++) w[r * width + k - k0] /= s;
    start[r] = k0; n[r] = k1 - k0 + 1;
  }
  return { start, n, w, width, fc };
}
/** One trace resampled to the rows, in code units about zero ((code - 128), so * clip / 127 is the
 *  amplitude); NaN where a row takes nothing. bytes: seismic.bin; t: the trace's index (u * nv + v). */
export function traceRows(g, bytes, t, plan, out) {
  const base = t * g.nz, { start, n, w, width } = plan;
  for (let r = 0; r < out.length; r++) {
    const m = n[r];
    if (!m) { out[r] = NaN; continue; }
    let s = 0;
    const o = r * width, k0 = base + start[r];
    for (let j = 0; j < m; j++) s += w[o + j] * (bytes[k0 + j] - g.zero);
    out[r] = s;
  }
  return out;
}

/* ── across the survey: bilinear, with a box over a column's own width where columns outrun traces ── */

/**
 * The columns' plan: for each column, the map points it samples (one, or several across its width where
 * the columns lie more than half a trace apart) and, per point, its four traces and bilinear weights;
 * a point outside the cube takes nothing. pointsOf(c) gives a column's points as [x, y] (model meters).
 * Returns { taps: per column an array of [traceIndex, weight] (weights summing to 1 over the column's
 * points inside the cube), inside: Uint8Array (1 where the column holds data) }.
 */
export function colPlan(g, cols, pointsOf) {
  const taps = new Array(cols), inside = new Uint8Array(cols);
  for (let c = 0; c < cols; c++) {
    const pts = pointsOf(c), acc = new Map();
    let used = 0;
    for (const [x, y] of pts) {
      let [u, v] = uvOf(g, x, y);
      // on the survey's own lines a point lies on a trace's line to within rounding: kept exact there
      if (Math.abs(u - Math.round(u)) < 1e-6) u = Math.round(u);
      if (Math.abs(v - Math.round(v)) < 1e-6) v = Math.round(v);
      if (u < -1e-6 || v < -1e-6 || u > g.nu - 1 + 1e-6 || v > g.nv - 1 + 1e-6) continue;
      u = Math.max(0, Math.min(g.nu - 1, u)); v = Math.max(0, Math.min(g.nv - 1, v));
      const u0 = Math.min(g.nu - 2, Math.floor(u)), v0 = Math.min(g.nv - 2, Math.floor(v)), fu = u - u0, fv = v - v0;
      for (const [du, dv, wt] of [[0, 0, (1 - fu) * (1 - fv)], [1, 0, fu * (1 - fv)], [0, 1, (1 - fu) * fv], [1, 1, fu * fv]]) {
        if (wt <= 1e-9) continue;
        const t = (u0 + du) * g.nv + v0 + dv;
        acc.set(t, (acc.get(t) || 0) + wt);
      }
      used++;
    }
    if (!used) { taps[c] = []; continue; }
    inside[c] = 1;
    taps[c] = [...acc].map(([t, wt]) => [t, wt / used]);
  }
  return { taps, inside };
}

/** The display ramp: 511 RGBA entries over -1..1 (index 255 is zero), from stops evenly spaced over the
 *  same range. The ramp is checked symmetric about zero by tools/art/palette.py. */
export function ramp(stops) {
  const s = stops.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const out = new Uint8ClampedArray(511 * 4);
  for (let i = 0; i < 511; i++) {
    const t = (i / 510) * (s.length - 1), k = Math.min(Math.floor(t), s.length - 2), f = t - k;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(s[k][c] * (1 - f) + s[k + 1][c] * f);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * The section's seismic as pixels: cols x rows RGBA (row-major, top first), transparent where the cube
 * holds nothing. cp: colPlan; rp: rowPlan; lut: ramp(); gain: the display gain (1 shows the clip at the
 * ramp's ends). Returns { px, traces (how many distinct traces were read), ms }.
 */
export function render(g, bytes, cp, rp, lut, gain, cols, rows, px = new Uint8ClampedArray(cols * rows * 4)) {
  const t0 = typeof performance === 'object' ? performance.now() : Date.now();
  const cache = new Map(), k = gain / 127;   // code units to the ramp's -1..1
  const rowsOf = (t) => { let r = cache.get(t); if (!r) { r = traceRows(g, bytes, t, rp, new Float32Array(rows)); cache.set(t, r); } return r; };
  px.fill(0);
  const col = new Float32Array(rows);
  for (let c = 0; c < cols; c++) {
    if (!cp.inside[c]) continue;
    col.fill(0);
    for (const [t, wt] of cp.taps[c]) { const r = rowsOf(t); for (let y = 0; y < rows; y++) col[y] += wt * r[y]; }
    for (let y = 0; y < rows; y++) {
      const v = col[y];
      if (v !== v) continue;
      let i = Math.round(v * k * 255) + 255;
      if (i < 0) i = 0; else if (i > 510) i = 510;
      const o = (y * cols + c) * 4, l = i * 4;
      px[o] = lut[l]; px[o + 1] = lut[l + 1]; px[o + 2] = lut[l + 2]; px[o + 3] = 255;
    }
  }
  const t1 = typeof performance === 'object' ? performance.now() : Date.now();
  return { px, traces: cache.size, ms: t1 - t0 };
}
/** The same columns' amplitudes (not colors), for the tests: rows x cols Float32Array of amplitude. */
export function amplitudes(g, bytes, cp, rp, cols, rows) {
  const out = new Float32Array(cols * rows).fill(NaN), cache = new Map();
  for (let c = 0; c < cols; c++) {
    if (!cp.inside[c]) continue;
    const col = new Float32Array(rows);
    for (const [t, wt] of cp.taps[c]) {
      let r = cache.get(t); if (!r) { r = traceRows(g, bytes, t, rp, new Float32Array(rows)); cache.set(t, r); }
      for (let y = 0; y < rows; y++) col[y] += wt * r[y];
    }
    for (let y = 0; y < rows; y++) out[y * cols + c] = (col[y] * g.clip) / 127;
  }
  return out;
}

/* ── the horizons: Hugin Fm top and base, on the cube's grid, bilinear along the line ── */

/** A horizon's depth at a map point: bilinear between the four grid nodes around it, NaN where a node
 *  around it holds no pick (an interpretation is not extended past its own picks). which: 0 top, 1 base. */
export function horizonAt(g, hz, which, x, y) {
  let [u, v] = uvOf(g, x, y);
  if (Math.abs(u - Math.round(u)) < 1e-6) u = Math.round(u);
  if (Math.abs(v - Math.round(v)) < 1e-6) v = Math.round(v);
  if (u < 0 || v < 0 || u > g.nu - 1 || v > g.nv - 1) return NaN;
  const u0 = Math.min(g.nu - 2, Math.floor(u)), v0 = Math.min(g.nv - 2, Math.floor(v)), fu = u - u0, fv = v - v0, base = which * g.nu * g.nv;
  let s = 0;
  for (const [du, dv, w] of [[0, 0, (1 - fu) * (1 - fv)], [1, 0, fu * (1 - fv)], [0, 1, (1 - fu) * fv], [1, 1, fu * fv]]) {
    if (w <= 1e-9) continue;   // a node with no weight is not around the point, picked or not
    const h = hz[base + (u0 + du) * g.nv + v0 + dv];
    if (h !== h) return NaN;
    s += w * h;
  }
  return s;
}
