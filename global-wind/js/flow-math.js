// The flow's mathematics, alone (DESIGN §1.2–§1.7): the step on the sphere, the sampler, the two
// projections, seeding, the rate ladder, the fade and the PRNG. Pure: no DOM, imported by
// tools/test_flow.mjs as well as js/flow.js.
//
// A particle is a unit vector p = (cos φ cos λ, cos φ sin λ, sin φ). The wind (u east, v north, m/s)
// moves it along local east e = (−sin λ, cos λ, 0) and north n = (−sin φ cos λ, −sin φ sin λ, cos φ):
//   p ← normalize(p + (u·e + v·n) · Δt / R)
// u and v are the app's own: u = −s·sin(dir), v = −s·cos(dir), because `dir` is where the wind comes
// FROM. So +u, +v is the way the air goes, and a streak moves toward it.

import { NNBSP } from './units.js';

export const R_EARTH = 6371008.8;                 // meters, the mean radius
export const MAX_LAT = 85.05112878;               // where Web Mercator ends
export const MAX_Z = Math.sin(MAX_LAT * Math.PI / 180);
export const HIDE_Z = 0.11;                        // behind this on the globe a particle respawns
export const HALF_LIFE = 0.18;                     // seconds: a trail's alpha halves
export const TRAIL_S = 0.6;                        // seconds: how long a trail stays visible
export const LADDER = [48, 24, 12, 6, 3, 1.5, 0.75];   // hours of wind per second of motion
export const HYSTERESIS = 1.6;
const TAU = 2 * Math.PI, DEG = Math.PI / 180;

/** p from degrees, written at P[o..o+2]. */
export function toVec(lon, lat, P, o = 0) {
  const c = Math.cos(lat * DEG);
  P[o] = c * Math.cos(lon * DEG); P[o + 1] = c * Math.sin(lon * DEG); P[o + 2] = Math.sin(lat * DEG);
  return P;
}
/** [lon, lat] in degrees of p. */
export function toLonLat(x, y, z, out) {
  out[0] = Math.atan2(y, x) / DEG;
  out[1] = Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG;
  return out;
}

/** One step: P[o..o+2] moved by the wind (u, v) for s = Δt_wind / R radians a m/s. In place. */
export function stepVec(P, o, u, v, s) {
  const x = P[o], y = P[o + 1], z = P[o + 2];
  const cl = Math.sqrt(x * x + y * y);
  let cL = 1, sL = 0;
  if (cl > 1e-12) { cL = x / cl; sL = y / cl; }
  const X = x + s * (-u * sL - v * z * cL);
  const Y = y + s * (u * cL - v * z * sL);
  const Z = z + s * (v * cl);
  const r = Math.sqrt(X * X + Y * Y + Z * Z);
  P[o] = X / r; P[o + 1] = Y / r; P[o + 2] = Z / r;
}

/** Bilinear on the grid (longitude wraps, latitude clamps), linear in time on u and v.
 *  g: { nx, ny, lon0, dlon, lat0, dlat }; U1/V1 null or f = 0 for one step. */
export function sampleUV(g, U0, V0, U1, V1, f, lon, lat, out) {
  const nx = g.nx, ny = g.ny;
  let fi = (lon - g.lon0) / g.dlon;
  fi -= Math.floor(fi / nx) * nx;
  let fj = (lat - g.lat0) / g.dlat;
  fj = fj < 0 ? 0 : fj > ny - 1 ? ny - 1 : fj;
  let i0 = Math.floor(fi); if (i0 >= nx) i0 = nx - 1;
  const j0 = Math.floor(fj), i1 = (i0 + 1) % nx, j1 = j0 + 1 < ny ? j0 + 1 : ny - 1;
  const tx = fi - i0, ty = fj - j0;
  const a0 = j0 * nx + i0, a1 = j0 * nx + i1, b0 = j1 * nx + i0, b1 = j1 * nx + i1;
  const w00 = (1 - tx) * (1 - ty), w01 = tx * (1 - ty), w10 = (1 - tx) * ty, w11 = tx * ty;
  let u = U0[a0] * w00 + U0[a1] * w01 + U0[b0] * w10 + U0[b1] * w11;
  let v = V0[a0] * w00 + V0[a1] * w01 + V0[b0] * w10 + V0[b1] * w11;
  if (f > 0 && U1) {
    u += (U1[a0] * w00 + U1[a1] * w01 + U1[b0] * w10 + U1[b1] * w11 - u) * f;
    v += (V1[a0] * w00 + V1[a1] * w01 + V1[b0] * w10 + V1[b1] * w11 - v) * f;
  }
  out[0] = u; out[1] = v;
  return out;
}

/** The map: Web Mercator on a unit square, the nearest world copy. m: { cx, cy, scale, W, H }. */
export function mapXY(x, y, z, m, out) {
  const wx = Math.atan2(y, x) / TAU + 0.5;
  const zz = z > MAX_Z ? MAX_Z : z < -MAX_Z ? -MAX_Z : z;
  const wy = 0.5 - Math.atanh(zz) / TAU;
  let dx = wx - m.cx;
  dx -= Math.round(dx);
  out[0] = dx * m.scale + m.W / 2;
  out[1] = (wy - m.cy) * m.scale + m.H / 2;
  return out;
}
/** The globe: orthographic, centered at (lon0, lat0). g: { sinLat, cosLat, sinLon, cosLon, r, cx, cy }.
 *  out[2] is the view z: 1 at the center, 0 on the limb, negative behind. */
export function globeXY(x, y, z, g, out) {
  const c = x * g.cosLon + y * g.sinLon;
  const X = y * g.cosLon - x * g.sinLon;
  const Y = g.cosLat * z - g.sinLat * c;
  out[0] = g.cx + g.r * X;
  out[1] = g.cy - g.r * Y;
  out[2] = g.sinLat * z + g.cosLat * c;
  return out;
}

/** The map's drawable rows: where the Mercator square is on screen. */
export function mapRows(m) {
  return [Math.max(0, -m.cy * m.scale + m.H / 2), Math.min(m.H, (1 - m.cy) * m.scale + m.H / 2)];
}
/** A uniform point on the map's drawable screen, as p at P[o]. */
export function seedMap(rand, m, P, o) {
  const [top, bottom] = mapRows(m);
  const sx = rand() * m.W, sy = top + rand() * (bottom - top);
  const wx = m.cx + (sx - m.W / 2) / m.scale, wy = m.cy + (sy - m.H / 2) / m.scale;
  const lon = (wx - Math.floor(wx)) * TAU - Math.PI;
  const z = Math.tanh((0.5 - wy) * TAU), c = Math.sqrt(1 - z * z);
  P[o] = c * Math.cos(lon); P[o + 1] = c * Math.sin(lon); P[o + 2] = z;
}
/** Back from the globe's screen to p at P[o] (the inverse of globeXY on the near side); false off the disc. */
export function unGlobe(sx, sy, g, P, o) {
  const X = (sx - g.cx) / g.r, Y = (g.cy - sy) / g.r, r2 = X * X + Y * Y;
  if (r2 > 1) return false;
  const Z = Math.sqrt(1 - r2);
  // p = X·east0 + Y·north0 + Z·up0
  P[o] = -X * g.sinLon - Y * g.sinLat * g.cosLon + Z * g.cosLat * g.cosLon;
  P[o + 1] = X * g.cosLon - Y * g.sinLat * g.sinLon + Z * g.cosLat * g.sinLon;
  P[o + 2] = Y * g.cosLat + Z * g.sinLat;
  return true;
}
/** A uniform point on the globe's visible disc (view z ≥ HIDE_Z) inside the W × H screen; false if
 *  the disc is not on screen. */
export function seedGlobe(rand, g, W, H, P, o) {
  const x0 = Math.max(0, g.cx - g.r), x1 = Math.min(W, g.cx + g.r);
  const y0 = Math.max(0, g.cy - g.r), y1 = Math.min(H, g.cy + g.r);
  if (x1 <= x0 || y1 <= y0) return false;
  const lim = (1 - HIDE_Z * HIDE_Z) * g.r * g.r;
  for (let k = 0; k < 64; k++) {
    const sx = x0 + rand() * (x1 - x0), sy = y0 + rand() * (y1 - y0);
    if ((sx - g.cx) ** 2 + (sy - g.cy) ** 2 > lim) continue;
    return unGlobe(sx, sy, g, P, o);
  }
  return false;
}
/** A segment that jumps more than half the screen crossed a world copy's seam: not drawn. */
export const seamJump = (xa, xb, W) => Math.abs(xb - xa) > W / 2;
/** The drawable area in CSS px²: the map's rows, or the visible disc clipped to the screen. */
export function drawableArea(tab, m, g, W, H) {
  if (tab === 'map') { const [t, b] = mapRows(m); return W * Math.max(0, b - t); }
  const lim = 1 - HIDE_Z * HIDE_Z, n = 48;
  let inside = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const X = ((i + 0.5) / n * W - g.cx) / g.r, Y = (g.cy - (j + 0.5) / n * H) / g.r;
    if (X * X + Y * Y <= lim) inside++;
  }
  return (inside / (n * n)) * W * H;
}
/** DESIGN §1.7: one particle per 100 CSS px², 400 to 4 000. */
export const particleCount = (area) => Math.max(400, Math.min(4000, Math.round(area / 100)));

/** Screen px per meter of ground at the view's center. */
export function pxPerMetre(tab, m, g) {
  if (tab === 'globe') return g.r / R_EARTH;
  const lat = 2 * Math.atan(Math.exp((0.5 - m.cy) * TAU)) - Math.PI / 2;
  return m.scale / (TAU * R_EARTH) / Math.cos(lat);
}
/** The rate that would move a 6 m/s wind 18 CSS px a second at the center, in hours a second. */
export const rateStar = (pxPerM) => 18 / (6 * 3600 * pxPerM);
/** The rung for that rate: the nearest on a log scale, kept while within 1.6× of the current one. */
export function pickRung(star, current) {
  if (current && star / current < HYSTERESIS && current / star < HYSTERESIS) return current;
  let best = LADDER[0], bd = Infinity;
  for (const h of LADDER) { const d = Math.abs(Math.log(star / h)); if (d < bd) { bd = d; best = h; } }
  return best;
}
/** A rung in words: "24 h", "2 days", "90 min". */
export function rungWords(h) {
  if (h >= 48) return `${h / 24} days`;
  if (h >= 3) return `${h}${NNBSP}h`;
  return `${Math.round(h * 60)}${NNBSP}min`;
}
/** The exposure line (ART "The caption band"). */
export const exposure = (h) => `Streaks: 1${NNBSP}s = ${rungWords(h)} of wind at the hour shown`;

/** The trail's fade for a frame of dt seconds: a 0.18 s half-life, whatever the frame rate. */
export const fade = (dt) => Math.pow(2, -dt / HALF_LIFE);

/** The base's own twilight ramp (app.js nightFade): 0 by day, 1 at night. */
export function nightFade(cosZenith) {
  if (cosZenith > 0.02) return 0;
  if (cosZenith < -0.12) return 1;
  return (0.02 - cosZenith) / 0.14;
}

/** mulberry32: a seeded PRNG, so a test can fix the particles. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

