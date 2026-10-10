// What a cell's number is (plan 0012 package 3.3): a difference against a baseline, or an estimated
// temperature. Difference is GISS's anomaly against each place's 1951–1980 average, or, with a chosen
// baseline, against the cell's own mean over those years (a cell needs a value in two thirds of them,
// else it has none). Absolute is the 1951–1980 average 2 m air temperature of assets/climatology.json
// (ERA5, tools/climatology/) plus GISS's anomaly: an estimate, never a measured field. Everything is
// integer tenths of a degree, so the shader, the card and the counts agree to the digit. Single months
// stay against 1951–1980: the app holds only the last 24 months, so it cannot average a month over
// other years. No DOM: tools/test_decode.mjs imports this in Node.

import { CELLS, NONE, NX, NY, inflate, b64ToBytes } from './data.js';
import { roundDiv } from './units.js';

export const NIL = -32768;
export const PLANES = 14;                      // Jan … Dec, the year, the partial year's months
const ROW_W = Float64Array.from({ length: NY }, (_, r) => Math.cos(((89 - 2 * r) * Math.PI) / 180));

/** null when assets/climatology.json is what the app reads, else the first defect as a phrase. */
export function checkClim(j) {
  if (!j || j.v !== 1 || j.app !== 'Warming World') return 'it is not Warming World’s climatology';
  const g = j.grid || {}, p = j.plane || {}, e = j.encoding || {};
  if (g.nx !== NX || g.ny !== NY || g.lon0 !== -179 || g.lat0 !== 89) return 'its grid is not the app’s 2° cells';
  if (p.step !== 0.5 || typeof p.offset !== 'number' || p.none !== NONE || e.compression !== 'deflate' || e.delta !== 'row') return 'its planes are not 0.5\u202f°C bytes, row delta, deflate';
  if (!Array.isArray(j.planes) || j.planes.length !== 13 || j.planes.some((s) => typeof s !== 'string')) return 'it does not hold 13 planes';
  return null;
}

/** → Int16Array(14 × 16 200) of tenths (NIL for none): 12 months, the year, and the mean of the
 *  partial year's months (rounded half away from zero), plus each plane's global mean in tenths. */
export async function decodeClim(j, partialMonths) {
  const t = new Int16Array(PLANES * CELLS).fill(NIL);
  const o10 = Math.round(j.plane.offset * 10), s10 = Math.round(j.plane.step * 10);
  for (let p = 0; p < 13; p++) {
    const d = await inflate(b64ToBytes(j.planes[p]), CELLS);
    if (d.length !== CELLS) throw new Error(`plane ${p + 1} holds ${d.length} cells`);
    for (let r = 0; r < NY; r++) {
      let b = 0;
      for (let c = 0; c < NX; c++) {
        const k = r * NX + c;
        b = (b + d[k]) & 255;                             // the row delta, undone from 0 at 179° W
        if (b !== NONE) t[p * CELLS + k] = o10 + s10 * b;
      }
    }
  }
  const n = Math.max(1, partialMonths | 0);
  for (let k = 0; k < CELLS; k++) {
    let s = 0, ok = true;
    for (let m = 0; m < n; m++) { const v = t[m * CELLS + k]; if (v === NIL) { ok = false; break; } s += v; }
    if (ok) t[13 * CELLS + k] = roundDiv(s, n);
  }
  const gm = new Float64Array(PLANES);
  for (let p = 0; p < PLANES; p++) {
    let s = 0, w = 0;
    for (let k = 0; k < CELLS; k++) { const v = t[p * CELLS + k]; if (v !== NIL) { s += v * ROW_W[(k / NX) | 0]; w += ROW_W[(k / NX) | 0]; } }
    gm[p] = w ? s / w : NaN;
  }
  return { t, gm };
}

/** The measure: M.abs (Absolute on), M.span ([first, last] year of a chosen baseline, or null for
 *  GISS's own 1951–1980), and the numbers that follow from them for idx and frames. */
export function createMeasure() {
  const M = { abs: false, span: null, clim: null, base: new Int16Array(CELLS), baseH: 0, need: 0, lacking: 0, n: 0 };
  let I = null, F = null, R = null, cache = new Map();

  /** idx, the decoded frames and their residency (a layer not yet decoded is never counted). */
  M.bind = (idx, frames, resident) => { I = idx; F = frames; R = resident; cache = new Map(); M.setSpan(M.span); };
  /** A chosen span is custom only when it is not the data's own base period. */
  M.custom = () => !!(M.span && I && !(M.span[0] === I.base[0] && M.span[1] === I.base[1]));
  M.text = () => (M.custom() ? (M.span[0] === M.span[1] ? String(M.span[0]) : `${M.span[0]}–${M.span[1]}`) : I ? I.baseText : '1951–1980');
  /** Whether layer k is re-expressed against the chosen baseline (complete or partial years only). */
  M.on = (k) => M.custom() && k < I.ny;
  M.baseFor = (k) => (k < I.ny ? M.text() : I.baseText);
  M.plane = (k) => (k < I.ny ? (k === I.partial ? 13 : 12) : +I.monthKeys[k - I.ny].slice(5) - 1);

  /** Set the baseline: each cell's mean over the span's complete years, in tenths, when it has a
   *  value in at least two thirds of them (rounded up); GISS's global means' mean over the same years. */
  M.setSpan = (span) => {
    cache = new Map();
    M.span = span && I ? [Math.max(I.years[0], span[0]), Math.min(I.years[I.lastComplete], span[1])] : span;
    M.base = new Int16Array(CELLS); M.baseH = 0; M.lacking = 0;
    if (!F) M.span = null;                                // no frames yet: GISS's own base until they are
    if (!M.custom()) { M.n = I ? I.base[1] - I.base[0] + 1 : 30; M.need = 0; return; }
    const i0 = I.years.indexOf(M.span[0]), i1 = I.years.indexOf(M.span[1]), n = i1 - i0 + 1, need = Math.ceil((2 * n) / 3 - 1e-9);
    M.n = n; M.need = need;
    let h = 0;
    for (let i = i0; i <= i1; i++) h += I.meanH[i];
    M.baseH = roundDiv(h, n);
    const sum = new Int32Array(CELLS), cnt = new Int16Array(CELLS);
    for (let i = i0; i <= i1; i++) {
      const o = i * CELLS;
      for (let k = 0; k < CELLS; k++) { const b = F[o + k]; if (b !== NONE) { sum[k] += I.tenths[b]; cnt[k]++; } }
    }
    for (let k = 0; k < CELLS; k++) if (cnt[k] >= need) M.base[k] = roundDiv(sum[k], cnt[k]); else { M.base[k] = NIL; M.lacking++; }
  };

  /** The cell's number on layer k in tenths: the difference, or the estimated temperature; null for none. */
  M.value = (k, cell) => {
    const b = F[k * CELLS + cell];
    if (b === NONE) return null;
    const a = I.tenths[b];
    if (M.abs) { const c = M.clim ? M.clim.t[M.plane(k) * CELLS + cell] : NIL; return c === NIL ? null : c + a; }
    if (!M.on(k)) return a;
    const s = M.base[cell];
    return s === NIL ? null : a - s;
  };
  /** The difference on layer k in tenths, whatever the measure (the card's chart, the stripes). */
  M.diff = (k, cell) => { const b = F[k * CELLS + cell]; if (b === NONE) return null; if (!M.on(k)) return I.tenths[b]; const s = M.base[cell]; return s === NIL ? null : I.tenths[b] - s; };
  /** GISS's global mean as a difference against the baseline in use, hundredths. */
  M.meanH = (k) => I.meanH[k] - (M.on(k) ? M.baseH : 0);
  /** The global temperature estimate for layer k in tenths: the climatology's area mean (every cell
   *  has one) plus GISS's global mean anomaly against 1951–1980. */
  M.absMean = (k) => roundDiv(Math.round(M.clim.gm[M.plane(k)] * 10) + I.meanH[k], 10);

  /** Counts beyond the scale and the share of the area with a number, for layer k in this measure. */
  M.stats = (k) => {
    if (!M.abs && !M.on(k)) return { above: I.above[k], below: I.below[k], area: I.area[k] };
    if (!F || (R && !R[k])) return { above: 0, below: 0, area: I.area[k] };   // not decoded yet: no count to print
    const key = `${M.abs}|${M.text()}|${k}`;
    if (cache.has(key)) return cache.get(key);
    const hi = M.abs ? 500 : 40, lo = M.abs ? -500 : -40;
    let above = 0, below = 0, w = 0, all = 0;
    for (let k2 = 0; k2 < CELLS; k2++) {
      const rw = ROW_W[(k2 / NX) | 0]; all += rw;
      const v = M.value(k, k2);
      if (v == null) continue;
      w += rw;
      if (v > hi) above++; else if (v < lo) below++;
    }
    const r = { above, below, area: M.abs ? I.area[k] : Math.round((w / all) * 10000) / 10000 };
    cache.set(key, r);
    return r;
  };
  return M;
}
