// The Reach's census worked out from the shipped files with formulas written here (tools/CONTRACT.md
// sections 1, 4, 7 and 8), for tools/test_decode.mjs and tools/shoot.mjs; not shipped. The planets
// are evaluated from ephem.bin by this file's own Clenshaw sum and the asteroids and comets by its own
// Kepler solve (only the distance is needed: |r| = a(1 - e cos E), a(e cosh F - 1) or q(1 + s^2)).
// Only the 21 fitted moons, and the giant planets' centers inside the moons' range, come from
// js/ephem.js, whose output tools/test_decode.mjs pins to values recorded before the art pass.
//
//   import { census, columns } from './census.mjs';
//   const c = census(jd);   // { lists: [solar, stars, clusters and satellites, streams] (log10 AU), farthest, starNear }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEphemeris } from '../js/ephem.js';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const json = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const bytes = (f) => { const b = fs.readFileSync(path.join(DATA, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
export const AU_KM = 149597870.7, PC_AU = 648000 / Math.PI, KPC_AU = PC_AU * 1000;
export const LO = -3, HI = 12;

/* ── the planets: ephem.bin's Chebyshev table (CONTRACT section 1) ── */
const EJ = json('ephem.json'), EB = new DataView(bytes('ephem.bin'));
function cheb(name, jd) {
  const b = EJ.bodies.find((x) => x.name === name), L = b.interval_days, n = b.degree + 1;
  const t = Math.min(Math.max(jd, EJ.jd_start), EJ.jd_end);
  const i = Math.min(Math.max(Math.floor((t - EJ.jd_start) / L), 0), b.intervals - 1);
  const x = 2 * (t - (EJ.jd_start + i * L)) / L - 1, out = [0, 0, 0];
  for (let ax = 0; ax < 3; ax++) {
    let b1 = 0, b2 = 0;
    for (let k = n - 1; k >= 1; k--) { const c = EB.getFloat32(b.offset + ((i * 3 + ax) * n + k) * 4, true); const b0 = 2 * x * b1 - b2 + c; b2 = b1; b1 = b0; }
    out[ax] = x * b1 - b2 + EB.getFloat32(b.offset + ((i * 3 + ax) * n) * 4, true);
  }
  return out;
}
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
/** A planet's (or the Earth's, or the Moon's) heliocentric position in km, from this file's sum. */
export function planetKm(name, jd) {
  if (name !== 'earth' && name !== 'moon') return cheb(name, jd);
  const geo = cheb('moon', jd), earth = add(cheb('emb', jd), geo, -1 / (1 + EJ.emrat));
  return name === 'earth' ? earth : add(earth, geo);
}

/* ── the asteroids and comets: their distance from the Sun (CONTRACT section 4) ── */
const SJ = json('smallbodies.json'), SB = bytes('smallbodies.bin');
const col = (name) => {
  const c = SJ.columns.find((x) => x.name === name), dv = new DataView(SB, c.offset), out = new Float64Array(c.length);
  for (let i = 0; i < c.length; i++) out[i] = c.type === 'f64' ? dv.getFloat64(i * 8, true) : c.type === 'f32' ? dv.getFloat32(i * 4, true) : dv.getUint8(i);
  return out;
};
const Q = col('q'), E = col('e'), TP = col('tp'), K = SJ.k_gauss_au15_day;
function smallDistance(i, jd) {
  const q = Q[i], e = E[i], dt = jd - 2451545.0 - TP[i];
  if (e < 1) {
    const a = q / (1 - e);
    let M = (K / a ** 1.5) * dt; M -= 2 * Math.PI * Math.round(M / (2 * Math.PI));
    let x = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
    for (let k = 0; k < 100; k++) { const d = (x - e * Math.sin(x) - M) / (1 - e * Math.cos(x)); x -= d; if (Math.abs(d) < 1e-15) break; }
    return a * (1 - e * Math.cos(x));
  }
  if (e > 1) {
    const a = q / (e - 1), M = (K / a ** 1.5) * dt;
    let F = Math.asinh(M / e);
    for (let k = 0; k < 200; k++) { const d = (e * Math.sinh(F) - F - M) / (e * Math.cosh(F) - 1); F -= d; if (Math.abs(d) < 1e-15) break; }
    return a * (e * Math.cosh(F) - 1);
  }
  const w = 1.5 * K * Math.sqrt(1 / (2 * q ** 3)) * Math.abs(dt), Y = Math.cbrt(w + Math.sqrt(w * w + 1)), s = Y - 1 / Y;
  return q * (1 + s * s);
}

/* ── the stars (section 7), the clusters, satellites and streams (section 8) ── */
const deepMeta = json('stars/deep.json'), DV = new DataView(bytes('stars/deep.bin')), named = json('stars/named.json'), G = json('galaxy/galaxy.json');
export const QUANT = deepMeta.quantisation_pc;
const L10 = Math.log10;
const stars = [];
for (let k = 0; k < named.count; k++) if (!(named.flags[k] & 16)) stars.push(L10(Math.hypot(named.x[k], named.y[k], named.z[k]) * PC_AU));
for (let o = 0; o + 8 <= DV.byteLength; o += 8) stars.push(L10(Math.hypot(DV.getInt16(o, true), DV.getInt16(o + 2, true), DV.getInt16(o + 4, true)) / 64 * PC_AU));
const sun = G.frame.sun_kpc;
const halo = [...G.globulars, ...G.satellites].map((o) => L10(o.dist_kpc * KPC_AU));
const streams = G.streams.flatMap((s) => s.points.map((p) => L10(Math.hypot(p[0] - sun[0], p[1] - sun[1], p[2] - sun[2]) * KPC_AU)));
export const counts = { named: stars.length - DV.byteLength / 8, deep: DV.byteLength / 8, globulars: G.globulars.length, satellites: G.satellites.length, streams: G.streams.length, streamPoints: streams.length, small: SJ.count };

/* ── the moons, and the giant planets' centers, from the pinned decoder ── */
const eph = buildEphemeris(EJ, bytes('ephem.bin'), json('moons.json'), bytes('moons.bin'), json('physical.json'));
const GIANTS = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

/** The census at a TDB Julian Date: four lists of log10 distances from the Sun in AU. */
export function census(jd) {
  const d = [];
  const emb = cheb('emb', jd), geo = cheb('moon', jd), earth = add(emb, geo, -1 / (1 + EJ.emrat));
  d.push(len(earth), len(add(earth, geo)));
  const inMoons = jd >= eph.moonRange.jdStart && jd <= eph.moonRange.jdEnd;
  for (const p of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) {
    let r = cheb(p, jd);
    if (GIANTS.includes(p) && inMoons && eph.moons(p).length) r = add(r, eph.planetCentre(p, jd));
    d.push(len(r));
    for (const m of eph.moons(p)) { const out = new Float64Array(3); if (eph.moon(m.name, jd, out)) d.push(len(add(cheb(p, jd), out))); }
  }
  const solar = d.map((km) => km / AU_KM);
  for (let i = 0; i < SJ.count; i++) solar.push(smallDistance(i, jd));
  let farthest = 0, near = Infinity;
  for (const v of solar) if (v > farthest) farthest = v;
  for (const v of stars) if (v < near) near = v;
  return { lists: [solar.map(L10), stars, halo, streams], farthest, starNear: 10 ** near, solarCount: solar.length };
}

/** The columns a list of log10 distances inks, worked out this file's own way: each value's column
 *  by its fraction of the span, and the columns whose edge a value sits within `edge` of. */
export function columns(lists, cols, edge = 2e-5) {
  const ink = new Uint8Array(cols), near = new Uint8Array(cols), per = cols / (HI - LO);
  for (const list of lists) for (const l of list) {
    const u = (l - LO) * per, c = Math.floor(u);
    if (c >= 0 && c < cols) ink[c] = 1;
    const f = u - c;
    if (f < edge || f > 1 - edge) { for (const k of [c - 1, c, c + 1]) if (k >= 0 && k < cols) near[k] = 1; }
  }
  return { ink, near };
}
