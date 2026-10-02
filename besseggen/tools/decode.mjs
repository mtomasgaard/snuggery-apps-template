// An independent reading of Besseggen's data and sun, for tools/test_decode.mjs and tools/shoot.mjs.
// Nothing here imports js/: the terrain is decoded from NOTES.md's contract, the sun from the NOAA
// spreadsheet's formulas written out again, the clock from the EU rule, and direct sun on a point by a
// ray march of this file's own, so a bug in the app cannot agree with itself.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const manifest = JSON.parse(fs.readFileSync(path.join(APP, 'data/manifest.json'), 'utf8'));
const R = Math.PI / 180;

/** A level's tiles as integer decimeters: z_dm = dmin + round(q * (dmax - dmin) / 65535). */
export function decodeLevel(L) {
  const buf = fs.readFileSync(path.join(APP, 'data', L.file));
  const tiles = new Map();
  for (const t of L.tiles) {
    const dm = new Int32Array(65 * 65), span = t.dmax - t.dmin;
    for (let i = 0; i < 65 * 65; i++) dm[i] = t.dmin + (span ? Math.round((buf.readUInt16LE(t.o + 2 * i) * span) / 65535) : 0);
    tiles.set(`${t.tx}:${t.ty}`, { ...t, dm });
  }
  return tiles;
}

/** One flat grid (row 0 north) of a level in decimeters, every tile placed; null where none is. */
export function flat(L) {
  const tiles = decodeLevel(L), nx = L.grid.nx * 64 + 1, ny = L.grid.ny * 64 + 1, g = new Int32Array(nx * ny).fill(-1);
  for (const t of tiles.values()) {
    const r0 = (L.grid.ny - 1 - t.ty) * 64, c0 = t.tx * 64;
    for (let r = 0; r < 65; r++) for (let c = 0; c < 65; c++) g[(r0 + r) * nx + c0 + c] = t.dm[r * 65 + c];
  }
  return { nx, ny, res: L.res, x0: L.grid.x0, y1: L.grid.y0 + L.grid.ny * L.tileSpan, g };
}
/** Bilinear meters from a flat grid, clamped to its edge. */
export function at(G, x, y) {
  const u = Math.min(Math.max((x - G.x0) / G.res, 0), G.nx - 1.0001), v = Math.min(Math.max((G.y1 - y) / G.res, 0), G.ny - 1.0001);
  const c = Math.floor(u), r = Math.floor(v), fu = u - c, fv = v - r, i = r * G.nx + c, g = G.g;
  return ((g[i] * (1 - fu) + g[i + 1] * fu) * (1 - fv) + (g[i + G.nx] * (1 - fu) + g[i + G.nx + 1] * fu) * fv) / 10;
}

let grids = null;
/** The 16 m core and the 64 m shell, the two grids the app marches over. */
export function terrain() {
  if (!grids) {
    const core = flat(manifest.levels.find((L) => L.region === 'core' && L.res === 16));
    const shell = flat(manifest.levels.find((L) => L.region === 'shell'));
    const c = manifest.core;
    grids = { core, shell, h: (x, y) => (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1 ? at(core, x, y) : at(shell, x, y)) };
  }
  return grids;
}

/** Norway's offset from UTC in hours at a local wall-clock time: CEST from the last Sunday of March,
 *  02:00, to the last Sunday of October, 03:00. */
export function norwayOffset(y, mo, d, min) {
  const lastSun = (m) => { for (let dd = 31; ; dd--) { const t = new Date(Date.UTC(y, m - 1, dd)); if (t.getUTCMonth() === m - 1 && t.getUTCDay() === 0) return dd; } };
  const t = Date.UTC(y, mo - 1, d, 0, min);
  return t >= Date.UTC(y, 2, lastSun(3), 2) && t < Date.UTC(y, 9, lastSun(10), 3) ? 2 : 1;
}

/** The sun's declination (radians) and the equation of time (minutes) at a local Norwegian time. */
function solar(y, mo, d, min) {
  const utcMs = Date.UTC(y, mo - 1, d, 0, min) - norwayOffset(y, mo, d, min) * 3600e3;
  const T = (utcMs / 864e5 + 2440587.5 - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const ecc = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * R) * 0.000289;
  const omega = 125.04 - 1934.136 * T, lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * R);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * R);
  const yy = Math.tan((eps / 2) * R) ** 2;
  return {
    utcMin: ((utcMs / 60000) % 1440 + 1440) % 1440,
    decl: Math.asin(Math.sin(eps * R) * Math.sin(lambda * R)),
    eot: 4 / R * (yy * Math.sin(2 * L0 * R) - 2 * ecc * Math.sin(M * R) + 4 * ecc * yy * Math.sin(M * R) * Math.cos(2 * L0 * R)
      - 0.5 * yy * yy * Math.sin(4 * L0 * R) - 1.25 * ecc * ecc * Math.sin(2 * M * R)),
  };
}

/** The sun at a local Norwegian time: true azimuth and apparent altitude in degrees (NOAA). */
export function sun(y, mo, d, min, lat, lon) {
  const { utcMin, decl, eot } = solar(y, mo, d, min);
  const H = ((utcMin + eot + 4 * lon) / 4 - 180) * R;
  const cz = Math.sin(lat * R) * Math.sin(decl) + Math.cos(lat * R) * Math.cos(decl) * Math.cos(H);
  const alt = 90 - Math.acos(Math.max(-1, Math.min(1, cz))) / R;
  const az = (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat * R) - Math.tan(decl) * Math.cos(lat * R)) / R + 180 + 360) % 360;
  // NOAA's refraction, in arc seconds
  const t = Math.tan(alt * R);
  const ref = alt > 85 ? 0 : alt > 5 ? 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5 : alt > -0.575 ? 1735 + alt * (-518.2 + alt * (103.4 + alt * (-12.79 + alt * 0.711))) : -20.772 / t;
  return { az, alt: alt + ref / 3600, geo: alt };
}

/** Sunrise and sunset (minutes of local time) by the closed-form hour angle at −0.833°, iterated. */
export function riseSet(y, mo, d, lat, lon) {
  return [-1, 1].map((sign) => {
    let m = 720;
    for (let k = 0; k < 6; k++) {
      const { decl, eot } = solar(y, mo, d, m);
      const cosH = (Math.sin(-0.833 * R) - Math.sin(lat * R) * Math.sin(decl)) / (Math.cos(lat * R) * Math.cos(decl));
      m = 720 - 4 * lon - eot + norwayOffset(y, mo, d, m) * 60 + sign * 4 * Math.acos(Math.max(-1, Math.min(1, cosH))) / R;
    }
    return m;
  });
}

/** Grid convergence (true north from grid north, degrees) at a longitude and latitude in UTM 33. */
export const convergence = (lon, lat) => Math.atan(Math.tan((lon - 15) * R) * Math.sin(lat * R)) / R;

/** Direct sun on a point for a day: every 2 minutes, a march toward the sun from 0.5 m above the
 *  ground over the core and shell grids, in fixed 8 m steps to 2 km and 32 m steps beyond. */
export function directSun(x, y, yr, mo, d, lat, lon) {
  const { h } = terrain(), z0 = h(x, y) + 0.5, conv = convergence(lon, lat), top = manifest.elevation.maxM + 5;
  const lit = [];
  for (let m = 0; m <= 1440; m += 2) {
    const s = sun(yr, mo, d, m, lat, lon);
    let ok = s.alt > 0;
    if (ok) {
      const a = (s.az - conv) * R, ux = Math.sin(a), uy = Math.cos(a), tn = Math.tan(s.alt * R);
      for (let t = 8; t < 42000; t += t < 2000 ? 8 : 32) {
        const rz = z0 + t * tn;
        if (rz > top) break;
        if (h(x + ux * t, y + uy * t) > rz) { ok = false; break; }
      }
    }
    lit.push(ok);
  }
  const spans = [];
  for (let i = 0, s = -1; i <= lit.length; i++) {
    if (lit[i] && s < 0) s = i;
    if (!lit[i] && s >= 0) { spans.push([s * 2, (i - 1) * 2]); s = -1; }
  }
  return { lit, spans, total: lit.filter(Boolean).length * 2 };
}

let levels = null;
/** Bilinear meters from the finest level that holds the point, as the card reads its height. */
export function heightAt(x, y) {
  if (!levels) levels = manifest.levels.map((L) => ({ L, tiles: decodeLevel(L) }));
  for (let i = levels.length - 1; i >= 0; i--) {
    const { L, tiles } = levels[i];
    const tx = Math.floor((x - L.grid.x0) / L.tileSpan), ty = Math.floor((y - L.grid.y0) / L.tileSpan), t = tiles.get(`${tx}:${ty}`);
    if (!t) continue;
    const u = (x - L.grid.x0 - tx * L.tileSpan) / L.res, v = (L.grid.y0 + (ty + 1) * L.tileSpan - y) / L.res;
    const c = Math.min(63, Math.floor(u)), r = Math.min(63, Math.floor(v)), fu = u - c, fv = v - r, h = (rr, cc) => t.dm[rr * 65 + cc] / 10;
    return (h(r, c) * (1 - fu) + h(r, c + 1) * fu) * (1 - fv) + (h(r + 1, c) * (1 - fu) + h(r + 1, c + 1) * fu) * fv;
  }
  return NaN;
}
