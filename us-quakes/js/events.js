// Indexes built once per load (DESIGN §11.4) over the joined rows: per-floor time arrays, per-year counts
// for the History strip, the four map boxes, a lon/lat grid for hit tests and "in view", the largest
// events of a window and the magnitude-ordered draw index the GPU walks.

import { lowerBound } from './util.js';
import { minOfYMD } from './units.js';

export const FLOOR_CODES = [0, 45, 60, 70, 80];   // 0: every magnitude (Live's All sizes)
const CELL = 256, GX = Math.ceil(62001 / CELL), GY = Math.ceil(55001 / CELL);
export const BOX_KEYS = ['conus', 'ak', 'hi', 'pr'];

export function buildIndex(C, boxes) {
  const { n, t, x, y, m } = C;
  const I = { C, floorT: [], years: [], y0: 1900 };
  for (const code of FLOOR_CODES) {
    let k = 0;
    for (let i = 0; i < n; i++) if (m[i] >= code && m[i] !== 255) k++;
    const a = new Uint32Array(k);
    for (let i = 0, j = 0; i < n; i++) if (m[i] >= code && m[i] !== 255) a[j++] = t[i];
    I.floorT.push(a);
  }
  const nm = []; for (let i = 0; i < n; i++) if (m[i] === 255) nm.push(t[i]);
  I.noMagT = Uint32Array.from(nm);
  const yLast = new Date(Date.UTC(1600, 0, 1) + (n ? t[n - 1] : 0) * 60000).getUTCFullYear();
  I.y1 = Math.max(yLast, 1900);
  I.yearStart = new Float64Array(I.y1 - 1900 + 2);
  for (let yy = 1900; yy <= I.y1 + 1; yy++) I.yearStart[yy - 1900] = minOfYMD(yy);
  for (let f = 0; f < FLOOR_CODES.length; f++) {
    const c = new Int32Array(I.y1 - 1900 + 1), a = I.floorT[f];
    for (let k = 0; k < c.length; k++) c[k] = lowerBound(a, I.yearStart[k + 1]) - lowerBound(a, I.yearStart[k]);
    I.years.push(c);
  }
  const B = BOX_KEYS.map((k) => boxes[k]);
  I.box = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const lon = 172 + 0.002 * x[i], lat = 17 + 0.001 * y[i];
    let b = 255;
    for (let k = 0; k < 4; k++) { const q = B[k]; if (lon >= q.west && lon <= q.east && lat >= q.south && lat <= q.north) { b = k; break; } }
    I.box[i] = b;
  }
  const start = new Int32Array(GX * GY + 1);
  for (let i = 0; i < n; i++) start[((y[i] / CELL) | 0) * GX + ((x[i] / CELL) | 0) + 1]++;
  for (let k = 1; k < start.length; k++) start[k] += start[k - 1];
  const fill = start.slice(0, -1), rows = new Uint32Array(n);
  for (let i = 0; i < n; i++) rows[fill[((y[i] / CELL) | 0) * GX + ((x[i] / CELL) | 0)]++] = i;
  I.cellStart = start; I.cellRows = rows;
  const cnt = new Int32Array(257);
  for (let i = 0; i < n; i++) cnt[m[i] + 1]++;
  for (let k = 1; k < 257; k++) cnt[k] += cnt[k - 1];
  I.order = new Uint32Array(n);
  for (let i = 0; i < n; i++) I.order[cnt[m[i]]++] = i;
  return I;
}

export const visible = (C, F, i) => {
  const t = C.t[i];
  if (t < F.t0 || t >= F.t1) return false;
  const m = C.m[i];
  return m === 255 ? F.noMag : m >= F.floor;
};

export function count(I, F) {
  const a = I.floorT[FLOOR_CODES.indexOf(F.floor)];
  return lowerBound(a, F.t1) - lowerBound(a, F.t0);
}
export const countNoMag = (I, F) => (F.noMag ? lowerBound(I.noMagT, F.t1) - lowerBound(I.noMagT, F.t0) : 0);

export function largest(I, F, k = 10) {
  const C = I.C, lo = lowerBound(C.t, F.t0), hi = lowerBound(C.t, F.t1), out = [];
  for (let i = hi - 1; i >= lo; i--) {
    const m = C.m[i];
    if (m === 255 || m < F.floor) continue;
    if (out.length === k && m <= C.m[out[k - 1]]) continue;
    let j = out.length < k ? out.length : k - 1;
    while (j > 0 && C.m[out[j - 1]] < m) { out[j] = out[j - 1]; j--; }
    out[j] = i;
  }
  return out;
}

export function perBox(I, F) {
  const C = I.C, lo = lowerBound(C.t, F.t0), hi = lowerBound(C.t, F.t1), n = [0, 0, 0, 0];
  let hollow = 0;
  for (let i = lo; i < hi; i++) {
    if (!visible(C, F, i)) continue;
    if (I.box[i] < 4) n[I.box[i]]++;
    if ((C.f[i] & 3) === 1 && C.t[i] >= C.liveFrom) hollow++;
  }
  return { n, hollow };
}

export function inBox(I, F, lon0, lat0, lon1, lat1, cb) {
  const C = I.C;
  const x0 = Math.max(0, Math.floor((lon0 - 172) / 0.002)), x1 = Math.min(62000, Math.ceil((lon1 - 172) / 0.002));
  const y0 = Math.max(0, Math.floor((lat0 - 17) / 0.001)), y1 = Math.min(55000, Math.ceil((lat1 - 17) / 0.001));
  if (x0 > x1 || y0 > y1) return;
  for (let gy = (y0 / CELL) | 0; gy <= ((y1 / CELL) | 0); gy++) {
    for (let gx = (x0 / CELL) | 0; gx <= ((x1 / CELL) | 0); gx++) {
      const c = gy * GX + gx;
      for (let k = I.cellStart[c], e = I.cellStart[c + 1]; k < e; k++) {
        const i = I.cellRows[k], xi = C.x[i], yi = C.y[i];
        if (xi < x0 || xi > x1 || yi < y0 || yi > y1 || !visible(C, F, i)) continue;
        cb(i);
      }
    }
  }
}
