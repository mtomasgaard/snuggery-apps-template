// The heights, decoded: shared by the worker (js/worker.js) and the main thread's fallback, so the
// two can never decode differently. Pure functions over pixel arrays; no DOM.
//
// A height tile is kept as Int16 DECIMETERS, row 0 its northern edge, pixel centers on the tile's
// grid (a 512 px tile's pixel i covers [i, i+1) / 512 of the tile). NODATA marks a pixel the source
// did not cover. Beside it, a normal map in two bytes a pixel (east and north components of the
// unit normal, 0..255 for -1..1), computed here at the tile's full resolution: the shader lights
// every fragment from it, which is how a 32-cell mesh shows the 1 m model's relief.

import { tileSpan, HALF, cosLat } from './geo.js';

export const NODATA = -32768;

/** Terrarium: h = R*256 + G + B/256 - 32768 meters. Bathymetry is kept down to -3000 m. */
export function decodeTerrarium(px, n, out) {
  for (let i = 0, p = 0; i < n * n; i++, p += 4) {
    const h = px[p] * 256 + px[p + 1] + px[p + 2] / 256 - 32768;
    out[i] = Math.max(-30000, Math.min(32000, Math.round(h * 10)));
  }
  return out;
}

/** DTM1 in three scales (js/sources.js): R = round(v/256), G = round(v/16) mod 256,
 *  B = round(v) mod 256, v = 10 h + 1000. B is v exactly modulo 256; G places it modulo 4096,
 *  because 16 G is within 8.5 of v; R places that, because 256 R is within 128.5 of v. The result
 *  is v rounded to the decimeter, so the height is exact to 0.1 m (measured against the service's
 *  own float output on 2026-10-16: 0.06 % of pixels one decimeter off, at rounding ties, none more).
 *  A transparent pixel (the service's 253, 253, 253) or a value no Norwegian height can have is
 *  NODATA; the caller fills it from the 10 m tiles. Returns the count of NODATA pixels. */
export function decodeDtm(px, n, out) {
  let nod = 0;
  for (let i = 0, p = 0; i < n * n; i++, p += 4) {
    if (px[p + 3] < 255) { out[i] = NODATA; nod++; continue; }
    const r = px[p], g = px[p + 1], b = px[p + 2];
    const j = (((Math.round((16 * g - b) / 256)) % 16) + 16) % 16;
    const vm = b + 256 * j;
    const v = vm + 4096 * Math.round((256 * r - vm) / 4096);
    const dm = v - 1000;
    if (dm < -1000 || dm > 26000) { out[i] = NODATA; nod++; continue; }
    out[i] = dm;
  }
  return nod;
}

/** The normal map of a height tile at (z, y), n pixels a side: central differences in ground meters
 *  (each row's own cos(latitude)), edges one-sided, encoded east and north. */
export function normals(h, n, z, ty, out) {
  const span = tileSpan(z), y1 = HALF - ty * span, mpp = span / n;
  for (let r = 0; r < n; r++) {
    const g = mpp * cosLat(y1 - (r + 0.5) * mpp);   // ground meters per pixel on this row
    const rn = r > 0 ? r - 1 : 0, rs = r < n - 1 ? r + 1 : n - 1;
    for (let c = 0; c < n; c++) {
      const cw = c > 0 ? c - 1 : 0, ce = c < n - 1 ? c + 1 : n - 1;
      // the sea is drawn at its surface, so the seabed under it is flat here too
      const dx = (Math.max(0, h[r * n + ce]) - Math.max(0, h[r * n + cw])) * 0.1 / ((ce - cw) * g);   // dh/d(east)
      const dy = (Math.max(0, h[rn * n + c]) - Math.max(0, h[rs * n + c])) * 0.1 / ((rs - rn) * g);   // dh/d(north)
      const k = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (r * n + c) * 2;
      out[i] = Math.round((-dx * k * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((-dy * k * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

export function range(h) {
  let lo = 32767, hi = -32768;
  for (let i = 0; i < h.length; i++) { const v = h[i]; if (v === NODATA) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
  return lo > hi ? [0, 0] : [lo, hi];
}

/** Decode one tile's RGBA pixels. Returns the arrays and the NODATA count; normals only when there
 *  is no hole to fill first. */
export function decodeTile(kind, z, y, px, n) {
  const h = new Int16Array(n * n);
  const nodata = kind === 'D' ? decodeDtm(px, n, h) : (decodeTerrarium(px, n, h), 0);
  const nrm = nodata ? null : normals(h, n, z, y, new Uint8Array(n * n * 2));
  const [lo, hi] = range(h);
  return { h, nrm, nodata, lo, hi };
}
