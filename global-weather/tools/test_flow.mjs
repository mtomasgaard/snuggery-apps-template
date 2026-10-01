// The flow's mathematics alone (DESIGN §5.3): js/flow-math.js checked against formulas written here,
// and against the snapshot decoded here with Node's own zlib. Node, no dependencies.
//
//   node tools/test_flow.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as F from '../js/flow-math.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (c, msg) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fails.push(msg); };
const D = Math.PI / 180, R = 6371008.8;
const wrap180 = (a) => ((a % 360) + 540) % 360 - 180;

/* Great-circle geometry, written here (haversine distance and initial bearing). */
const ll = (p) => [Math.atan2(p[1], p[0]) / D, Math.atan2(p[2], Math.hypot(p[0], p[1])) / D];
const vec = (lon, lat) => [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
function dist(a, b) {
  const [l1, p1] = ll(a), [l2, p2] = ll(b), dl = (l2 - l1) * D;
  const h = Math.sin((p2 - p1) * D / 2) ** 2 + Math.cos(p1 * D) * Math.cos(p2 * D) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(a, b) {
  const [l1, p1] = ll(a), [l2, p2] = ll(b), dl = (l2 - l1) * D;
  return (Math.atan2(Math.sin(dl) * Math.cos(p2 * D), Math.cos(p1 * D) * Math.sin(p2 * D) - Math.sin(p1 * D) * Math.cos(p2 * D) * Math.cos(dl)) / D + 360) % 360;
}
const step = (p, u, v, dtWind) => { const P = Float64Array.from(p); F.stepVec(P, 0, u, v, dtWind / R); return [...P]; };

/* 1. The direction convention: u, v as the app builds them, and the step goes the other way. */
{
  let worstAngle = 0, worstBearing = 0;
  for (let b = 0; b < 256; b++) {
    const dir = b * 1.40625;
    for (const s of [0.25, 1, 5, 12.5, 25, 40]) {
      const u = -s * Math.sin(dir * D), v = -s * Math.cos(dir * D);            // app.js values()
      worstAngle = Math.max(worstAngle, Math.abs(wrap180((Math.atan2(-u, -v) / D) - dir)));
      const p0 = vec(17.3, 31.7), p1 = step(p0, u, v, 60);
      worstBearing = Math.max(worstBearing, Math.abs(wrap180(bearing(p0, p1) - (dir + 180))));
    }
  }
  ok(worstAngle < 1e-9, `direction: for every direction byte and speeds 0.25–40 m/s, atan2(−u, −v) gives the byte's angle back (worst ${worstAngle.toExponential(1)}°)`);
  ok(worstBearing < 1e-6, `direction: one step moves TOWARD the byte's angle + 180° — where the wind goes, not where it comes from (worst ${worstBearing.toExponential(1)}°)`);
}

/* The snapshot, decoded here: zlib, then the previous-step delta, then the layer's scale. */
const snap = JSON.parse(fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'));
const G = snap.grid, N = G.nx * G.ny;
const wind = snap.layers.find((l) => l.key === 'wind');
const sp = wind.planes.speed, dp = wind.planes.dir;
const UV = [];
{
  let prevS = null, prevD = null;
  for (const st of snap.steps) {
    const S = zlib.inflateSync(Buffer.from(st.planes['wind.speed'], 'base64'));
    const Dd = zlib.inflateSync(Buffer.from(st.planes['wind.dir'], 'base64'));
    if (prevS) for (let i = 0; i < N; i++) { S[i] = (S[i] + prevS[i]) & 255; Dd[i] = (Dd[i] + prevD[i]) & 255; }
    prevS = S; prevD = Dd;
    const u = new Float64Array(N), v = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const s = sp.offset + sp.step * S[i], a = (dp.offset + dp.step * Dd[i]) * D;
      u[i] = -s * Math.sin(a); v[i] = -s * Math.cos(a);
    }
    UV.push({ u, v });
  }
}
const grid = { nx: G.nx, ny: G.ny, lon0: G.lon0, dlon: G.dlon, lat0: G.lat0, dlat: G.dlat };
const tAt = (h) => { const s = snap.steps; let k = 0; while (k < s.length - 2 && s[k + 1].hours <= h) k++; return k + (h - s[k].hours) / (s[k + 1].hours - s[k].hours); };
const sampleAt = (tt, lon, lat) => {
  const k0 = Math.min(Math.floor(tt), UV.length - 1), k1 = Math.min(k0 + 1, UV.length - 1), f = Math.max(0, Math.min(1, tt - k0));
  return F.sampleUV(grid, UV[k0].u, UV[k0].v, UV[k1].u, UV[k1].v, f, lon, lat, [0, 0]);
};

/* 2. The ask rows: the pipeline's own numbers, recomputed through the sampler; then a particle. */
{
  const src = fs.readFileSync(path.join(APP, '..', 'scripts', 'global_weather.py'), 'utf8');
  const cities = new Map([...src.matchAll(/\("([^"]+)",\s*"[^"]+",\s*(-?[\d.]+),\s*(-?[\d.]+),/g)].map((m) => [m[1], [+m[2], +m[3]]]));
  let worstS = 0, worstDir = 0, worstB = 0, worstL = 0, n = 0;
  const rate = 24, dt = 1 / 60, dtWind = dt * rate * 3600;
  for (const row of snap.ask) {
    const at = cities.get(row.place);
    if (!at) continue;
    n++;
    const [u, v] = sampleAt(tAt(row.leadHours), at[0], at[1]);
    const s = Math.hypot(u, v);
    worstS = Math.max(worstS, Math.abs(s - row.speedMs));
    if (s > 0.5) worstDir = Math.max(worstDir, Math.abs(wrap180((Math.atan2(-u, -v) / D + 360) % 360 - row.fromDegrees)));
    const p0 = vec(at[0], at[1]), p1 = step(p0, u, v, dtWind);
    if (s > 0.5) worstB = Math.max(worstB, Math.abs(wrap180(bearing(p0, p1) - (row.fromDegrees + 180))));
    worstL = Math.max(worstL, Math.abs(dist(p0, p1) / (s * dtWind) - 1));
  }
  ok(n === snap.ask.length && n >= 60, `ask rows: ${n} of ${snap.ask.length} matched to their city's coordinates in scripts/global_weather.py`);
  ok(worstS <= 0.05 && worstDir <= 0.5, `ask rows: speed recomputed through the sampler within ${worstS.toFixed(3)} m/s (≤ 0.05), from-direction within ${worstDir.toFixed(2)}° (≤ 0.5, above 0.5 m/s)`);
  // the bearing tolerance is the row's own rounding to whole degrees plus 0.5°
  ok(worstB <= 1.0 && worstL <= 1e-5, `ask rows: a particle stepped from each city moves toward fromDegrees + 180° (worst ${worstB.toFixed(2)}°, ≤ 0.5° + the row's whole-degree rounding) by speed × Δt × rate (worst ${worstL.toExponential(1)} relative, ≤ 1e-5)`);
}

/* 3. The kernel on the sphere. */
{
  let wb = 0, wd = 0;
  for (const lat of [0, 45, 60, 80, 89, 89.9, -45, -60, -80, -89, -89.9]) for (let f = 0; f < 360; f += 5) {
    const u = -10 * Math.sin(f * D), v = -10 * Math.cos(f * D), a = vec(-40, lat), b = step(a, u, v, 1440);
    wb = Math.max(wb, Math.abs(wrap180(bearing(a, b) - (f + 180)))); wd = Math.max(wd, Math.abs(dist(a, b) / (10 * 1440) - 1));
  }
  ok(wb < 1e-6 && wd < 1e-5, `kernel: every from-direction at 0, ±45, ±60, ±80, ±89, ±89.9° — bearing error ${wb.toExponential(1)}° (< 1e-6), distance error ${wd.toExponential(1)} (< 1e-5)`);
  const P = Float64Array.from(vec(10, 20));
  for (let i = 0; i < 10000; i++) F.stepVec(P, 0, 7, -3, 1440 / R);
  const P2 = Float64Array.from(vec(0, 89.99));
  for (let i = 0; i < 2000; i++) F.stepVec(P2, 0, 0, 15, 1440 / R);
  ok(Math.abs(Math.hypot(...P) - 1) < 1e-12 && Math.abs(Math.hypot(...P2) - 1) < 1e-12 && [...P2].every(Number.isFinite),
    `kernel: unit length after 10 000 steps (|p| − 1 = ${(Math.hypot(...P) - 1).toExponential(1)}); 2 000 steps due north through the pole stay finite`);
}

/* 4. Bilinear and the wrap. */
{
  const U = UV[5].u, V = UV[5].v, out = [0, 0];
  let worst = 0;
  for (const [i, j] of [[0, 0], [17, 33], [179, 45], [90, 90], [3, 1]]) {
    F.sampleUV(grid, U, V, null, null, 0, G.lon0 + i * G.dlon, G.lat0 + j * G.dlat, out);
    worst = Math.max(worst, Math.abs(out[0] - U[j * G.nx + i]), Math.abs(out[1] - V[j * G.nx + i]));
  }
  const at359 = F.sampleUV(grid, U, V, null, null, 0, 359.9, 10, [0, 0]);
  const atNeg = F.sampleUV(grid, U, V, null, null, 0, -0.1, 10, [0, 0]);
  const j = (G.lat0 - 10) / -G.dlat, tx = (359.9 - 358) / 2;           // between columns 179 and 0, row 40
  const want = U[j * G.nx + 179] * (1 - tx) + U[j * G.nx] * tx;
  const n90 = F.sampleUV(grid, U, V, null, null, 0, 33, 95, [0, 0]), s90 = F.sampleUV(grid, U, V, null, null, 0, 33, -95, [0, 0]);
  const n90w = F.sampleUV(grid, U, V, null, null, 0, 33, 90, [0, 0]), s90w = F.sampleUV(grid, U, V, null, null, 0, 33, -90, [0, 0]);
  ok(worst === 0 && Math.abs(at359[0] - want) < 1e-12 && Math.abs(at359[0] - atNeg[0]) < 1e-12 && n90[0] === n90w[0] && s90[0] === s90w[0],
    `bilinear: a grid node returns its value exactly; 359.9° E blends columns 179 and 0 (${at359[0].toFixed(4)} = ${want.toFixed(4)}) and equals −0.1° E; latitude clamps at ±90°`);
}

/* 5. Time, on u and v. */
{
  const tt = 7.3, a = sampleAt(7, 100, -20), b = sampleAt(8, 100, -20), m = sampleAt(tt, 100, -20);
  const lin = Math.max(Math.abs(m[0] - (0.7 * a[0] + 0.3 * b[0])), Math.abs(m[1] - (0.7 * a[1] + 0.3 * b[1])));
  const s = 8, d1 = 350 * D, d2 = 10 * D;
  const one = { nx: 2, ny: 2, lon0: 0, dlon: 1, lat0: 1, dlat: -1 };
  const U1 = new Float64Array(4).fill(-s * Math.sin(d1)), V1 = new Float64Array(4).fill(-s * Math.cos(d1));
  const U2 = new Float64Array(4).fill(-s * Math.sin(d2)), V2 = new Float64Array(4).fill(-s * Math.cos(d2));
  const mid = F.sampleUV(one, U1, V1, U2, V2, 0.5, 0.5, 0.5, [0, 0]);
  const from = (Math.atan2(-mid[0], -mid[1]) / D + 360) % 360;
  ok(lin < 1e-12 && Math.abs(wrap180(from)) < 1e-9, `time: at t = k + 0.3 the sample is 0.7·A + 0.3·B on u and v (${lin.toExponential(1)}); a 350° and a 10° wind interpolate to ${from.toFixed(6)}°, not 180°`);
}

/* 6. Mercator. */
{
  const m = { cx: 0.5, cy: 0.5, scale: 4000, W: 390, H: 612 };
  const screenStep = (lat, u, v) => {
    const a = vec(0, lat), b = step(a, u, v, 1);                     // a 1 m step
    const A = F.mapXY(...a, m, [0, 0]), B = F.mapXY(...b, m, [0, 0]);
    return Math.hypot(B[0] - A[0], B[1] - A[1]);
  };
  let worst = 0;
  for (const lat of [10, 30, 45, 60, 70, 80]) for (const [u, v] of [[1, 0], [0, 1]]) {
    worst = Math.max(worst, Math.abs(screenStep(lat, u, v) / screenStep(0, u, v) / (1 / Math.cos(lat * D)) - 1));
  }
  ok(worst < 0.005, `Mercator: an east or north step at 10–80° moves sec φ times as far on the map as at the equator (worst ${(worst * 100).toFixed(4)} %, ≤ 0.5 %)`);
  // a particle crossing 180°: continuous on the sphere, and the one segment across the seam is not drawn
  const m1 = { cx: 0.5, cy: 0.5, scale: 390, W: 390, H: 612 };
  const P = Float64Array.from(vec(179.5, 10));
  let prev = F.mapXY(...P, m1, [0, 0]), seams = 0, maxStep = 0;
  for (let i = 0; i < 40; i++) {
    const q = [...P];
    F.stepVec(P, 0, 20, 0, 3600 / R);
    maxStep = Math.max(maxStep, dist(q, [...P]));
    const now = F.mapXY(...P, m1, [0, 0]);
    if (F.seamJump(prev[0], now[0], m1.W)) seams++;
    prev = now;
  }
  ok(seams === 1 && Math.abs(maxStep / 72000 - 1) < 1e-4, `Mercator: a particle crossing 180° moves a steady ${(maxStep / 1000).toFixed(3)} km a step on the sphere (72 km asked; the kernel's chord error at so long a step is s²/3 ≈ 4e-5), and exactly ${seams} segment (the seam's) is not drawn`);
}

/* 7. Orthographic. */
{
  const view = (lon0, lat0, r = 187) => ({ sinLat: Math.sin(lat0 * D), cosLat: Math.cos(lat0 * D), sinLon: Math.sin(lon0 * D), cosLon: Math.cos(lon0 * D), r, cx: 195, cy: 306 });
  let worstRT = 0, hiddenOK = true;
  for (const [l0, p0] of [[0, 20], [-120, 45], [170, -60], [30, 89], [-75, -89.5], [100, 0]]) {
    const g = view(l0, p0);
    for (let k = 0; k < 50; k++) {
      const sx = 195 + 180 * Math.cos(k * 1.7) * Math.sqrt(k / 50), sy = 306 + 180 * Math.sin(k * 1.7) * Math.sqrt(k / 50);
      const P = new Float64Array(3);
      F.unGlobe(sx, sy, g, P, 0);
      const o = F.globeXY(P[0], P[1], P[2], g, [0, 0, 0]);
      worstRT = Math.max(worstRT, Math.hypot(o[0] - sx, o[1] - sy));
    }
    // the far side, and the rim the arrows skip
    const P = Float64Array.from(vec(l0 + 180, -p0));
    hiddenOK = hiddenOK && F.globeXY(...P, g, [0, 0, 0])[2] < F.HIDE_Z;
  }
  // the screen direction of a streak equals drawGlobeArrows' formula (written here again)
  const rand = F.mulberry32(7);
  let worstDir = 0, n = 0;
  for (let k = 0; k < 400 && n < 200; k++) {
    const g = view(rand() * 360 - 180, rand() * 140 - 70);
    const P = new Float64Array(3);
    if (!F.seedGlobe(rand, g, 390, 612, P, 0)) continue;
    const [lon, lat] = ll(P), u = rand() * 30 - 15, v = rand() * 30 - 15;
    if (Math.hypot(u, v) < 1) continue;
    const a = F.globeXY(...P, g, [0, 0, 0]);
    const Q = Float64Array.from(P); F.stepVec(Q, 0, u, v, 1 / R);
    const b = F.globeXY(...Q, g, [0, 0, 0]);
    const flowAngle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const lat0 = Math.asin(g.sinLat), dlon = (lon * D) - Math.atan2(g.sinLon, g.cosLon);
    const sinLat = Math.sin(lat * D), cosLat = Math.cos(lat * D), sinD = Math.sin(dlon), cosD = Math.cos(dlon);
    const ex = cosD, ey = Math.sin(lat0) * sinD;
    const nxx = -sinLat * sinD, nyy = Math.cos(lat0) * cosLat + Math.sin(lat0) * sinLat * cosD;
    const arrowAngle = Math.atan2(-(u * ey + v * nyy), u * ex + v * nxx);
    worstDir = Math.max(worstDir, Math.abs(wrap180((flowAngle - arrowAngle) / D)));
    n++;
  }
  ok(worstRT < 1e-9 && hiddenOK, `orthographic: screen → sphere → screen round-trips within ${worstRT.toExponential(1)} px for six centres (< 1e-9); the antipode is hidden (view z < ${F.HIDE_Z})`);
  ok(n === 200 && worstDir < 0.5, `orthographic: at ${n} seeded points a streak's screen direction equals the arrow's (drawGlobeArrows' formula) within ${worstDir.toExponential(1)}° (≤ 0.5°)`);
}

/* 8. The rate. */
{
  const want = { 48: '2 days', 24: '24 h', 12: '12 h', 6: '6 h', 3: '3 h', 1.5: '90 min', 0.75: '45 min' };
  const words = F.LADDER.every((h) => F.rungWords(h) === want[h]);
  let bad = 0, cases = 0;
  for (let scale = 390; scale <= 360 * 80; scale *= 1.07) for (const cy of [0.5, 0.3, 0.2]) {
    const m = { cx: 0.5, cy, scale, W: 390, H: 612 }, star = F.rateStar(F.pxPerMetre('map', m, null));
    const nearest = F.LADDER.reduce((b, h) => (Math.abs(Math.log(star / h)) < Math.abs(Math.log(star / b)) ? h : b), F.LADDER[0]);
    if (F.pickRung(star, 0) !== nearest) bad++;
    cases++;
  }
  // hysteresis: from 24 h, a rate* of 15 h (1.6× away) stays, 14.9 h moves
  const hyst = F.pickRung(24 / 1.59, 24) === 24 && F.pickRung(24 / 1.61, 24) === 12 && F.pickRung(24 * 1.59, 24) === 24 && F.pickRung(24 * 1.61, 24) === 48;
  // the opening views of DESIGN §1.5: map scale ≈ 1 193 px at the equator, globe r ≈ 187 px, the deepest zoom
  const open = F.pickRung(F.rateStar(F.pxPerMetre('map', { cy: 0.5, scale: 1193 }, null)), 0);
  const glob = F.pickRung(F.rateStar(F.pxPerMetre('globe', null, { r: 187 })), 0);
  const deep = F.pickRung(F.rateStar(F.pxPerMetre('map', { cy: 0.5, scale: 360 * 80 }, null)), 0);
  // a 10 m/s wind's screen speed = 10 × rate × 3 600 × px/m (one second of frames, at the equator)
  const m = { cx: 0.5, cy: 0.5, scale: 1193, W: 390, H: 612 }, rate = 24, ppm = F.pxPerMetre('map', m, null);
  const P = Float64Array.from(vec(0, 0)), a = F.mapXY(...P, m, [0, 0]);
  for (let i = 0; i < 60; i++) F.stepVec(P, 0, 10, 0, (1 / 60) * rate * 3600 / R);
  const b = F.mapXY(...P, m, [0, 0]), screenSpeed = Math.hypot(b[0] - a[0], b[1] - a[1]), wantSpeed = 10 * rate * 3600 * ppm;
  ok(words && F.exposure(24) === 'Streaks: 1 s = 24 h of wind at the hour shown', `rate: each rung's words are DESIGN §1.5's table (${F.LADDER.map(F.rungWords).join(', ')}); the exposure line "${F.exposure(24)}"`);
  ok(bad === 0 && hyst, `rate: over ${cases} zooms and centres the rung is the nearest on a log scale (${bad} differ); the 1.6× hysteresis holds both ways`);
  ok(open === 24 && glob === 24 && deep === 1.5, `rate: the opening map is ${open} h, the opening globe ${glob} h, the deepest map zoom ${deep} h (DESIGN §1.5: 24, 24, 1.5)`);
  ok(Math.abs(screenSpeed / wantSpeed - 1) < 1e-5, `rate: a 10 m/s wind at the equator moves ${screenSpeed.toFixed(4)} px in one second of frames = 10 × 24 × 3 600 × px/m = ${wantSpeed.toFixed(4)} (${Math.abs(screenSpeed / wantSpeed - 1).toExponential(1)}, ≤ 1e-5: the step's own chord error at 24 h a second is 1.7e-6, item 3)`);
}

/* 9. The fade. */
{
  const a = F.fade(0.013), b = F.fade(0.029), ab = F.fade(0.042);
  ok(Math.abs(a * b - ab) < 1e-15 && F.fade(F.TRAIL_S) <= 0.1 && Math.abs(F.fade(1 / 60) - 0.938) < 0.001,
    `fade: f(Δt₁)·f(Δt₂) = f(Δt₁ + Δt₂) (${Math.abs(a * b - ab).toExponential(1)}); 0.6 s leaves ${(F.fade(0.6) * 100).toFixed(1)} % (≤ 10 %); a 60 Hz frame fades by ${F.fade(1 / 60).toFixed(3)}`);
}

/* 10. Seeding is uniform on screen and inside the drawable area. */
{
  const chi = (counts) => { const e = counts.reduce((s, c) => s + c, 0) / counts.length; return counts.reduce((s, c) => s + (c - e) ** 2 / e, 0); };
  const CRIT_63 = 92.01, rand = F.mulberry32(42), m = { cx: 0.31, cy: 0.42, scale: 1193, W: 390, H: 612 };
  const [top, bottom] = F.mapRows(m), cells = new Array(64).fill(0), P = new Float64Array(3), o = [0, 0];
  let outside = 0;
  for (let k = 0; k < 10000; k++) {
    F.seedMap(rand, m, P, 0);
    F.mapXY(P[0], P[1], P[2], m, o);
    if (o[0] < -1e-6 || o[0] > m.W + 1e-6 || o[1] < top - 1e-6 || o[1] > bottom + 1e-6) { outside++; continue; }
    cells[Math.min(7, Math.floor(o[0] / m.W * 8)) * 8 + Math.min(7, Math.floor((o[1] - top) / (bottom - top) * 8))]++;
  }
  const xm = chi(cells);
  // the globe: inside the visible disc, and uniform over the 8 × 8 cells wholly inside it
  const g = { sinLat: Math.sin(20 * D), cosLat: Math.cos(20 * D), sinLon: 0, cosLon: 1, r: 187, cx: 195, cy: 306 };
  const gc = new Map(); let gOut = 0;
  const x0 = g.cx - g.r, y0 = g.cy - g.r, cw = (2 * g.r) / 8, lim = Math.sqrt(1 - F.HIDE_Z ** 2) * g.r;
  for (let k = 0; k < 10000; k++) {
    F.seedGlobe(rand, g, 390, 612, P, 0);
    const s = F.globeXY(P[0], P[1], P[2], g, [0, 0, 0]);
    if (s[2] < F.HIDE_Z - 1e-9) { gOut++; continue; }
    const ci = Math.floor((s[0] - x0) / cw), cj = Math.floor((s[1] - y0) / cw);
    const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => Math.hypot(x0 + (ci + a) * cw - g.cx, y0 + (cj + b) * cw - g.cy) <= lim);
    if (corners) gc.set(ci * 8 + cj, (gc.get(ci * 8 + cj) || 0) + 1);
  }
  const xg = chi([...gc.values()]), dof = gc.size - 1;
  // χ² critical values at p = 0.01 (Wilson–Hilferty, written here)
  const crit = (k) => k * (1 - 2 / (9 * k) + 2.326 * Math.sqrt(2 / (9 * k))) ** 3;
  ok(outside === 0 && xm < CRIT_63, `seeding: 10 000 map points all inside the drawable rows; χ² over 8 × 8 cells ${xm.toFixed(1)} (< ${CRIT_63}, p > 0.01)`);
  ok(gOut === 0 && xg < crit(dof), `seeding: 10 000 globe points all on the visible disc; χ² over the ${gc.size} cells wholly inside it ${xg.toFixed(1)} (< ${crit(dof).toFixed(1)}, p > 0.01)`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
