// Node test for js/smallbodies.js.
//
// Loads the shipped files with fs (not fetch) through buildSmallBodies(), then compares against the
// references verify_smallbodies.py exports into tools/.cache/smallbodies/ (not shipped):
//   ref_smallbodies.bin   every row at eight epochs 1900-2100, propagated in Python by an
//                         independent method (universal variables from the perihelion state,
//                         Stumpff functions, safeguarded Newton) from the same stored numbers;
//   ref_smallbodies.json  the epochs; JPL Horizons positions of Ceres, Pallas, Juno and Vesta
//                         (their own osculating elements at yearly epochs, from Stellarium's
//                         Horizons export) for the drift table; synthetic orbits that exercise
//                         every branch of the solver, e == 1 exactly included (test inputs, not
//                         data).
// Prints the worst error per check and the drift of two-body propagation against Horizons by
// years from the epoch; exits non-zero if anything is out of bounds.
//
//   node tools/test_smallbodies.mjs          (after 20_smallbodies.py and verify_smallbodies.py)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSmallBodies, keplerElliptic, keplerHyperbolic } from '../js/smallbodies.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.OUT_DATA || path.join(here, '..', 'data');
const CACHE = path.join(process.env.MILKYWAY_CACHE || path.join(here, '.cache'), 'smallbodies');
const readBuf = (p) => { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const meta = json(path.join(DATA, 'smallbodies.json'));
const sb = buildSmallBodies(meta, readBuf(path.join(DATA, 'smallbodies.bin')));
const ref = json(path.join(CACHE, 'ref_smallbodies.json'));
const refPos = new Float64Array(readBuf(path.join(CACHE, 'ref_smallbodies.bin')));

let failures = 0;
function report(label, value, limit, unit = '') {
  const ok = value <= limit;
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label.padEnd(58)} ${value.toExponential(2).padStart(9)} ${unit} (limit ${limit.toExponential(1)})`);
}
const norm = (v) => Math.hypot(v[0], v[1], v[2]);

console.log(`smallbodies.js: ${sb.count} rows, ${sb.labelled.length} labelled`);
if (sb.count !== ref.count) { console.log('  FAIL row count differs from the reference'); process.exit(1); }

// ---- every row, eight epochs, against the independent propagation
console.log('every row against universal-variable propagation (Python) of the same stored numbers');
const p = new Float64Array(3);
const f32 = new Float32Array(sb.count * 3);
let worstAll = 0;
ref.epochs.forEach((jd, k) => {
  let wAbs = 0, wRel = 0, wRow = -1, w32 = 0;
  sb.positionsAt(jd, f32);
  for (let i = 0; i < sb.count; i++) {
    const o = (k * sb.count + i) * 3;
    const r = [refPos[o], refPos[o + 1], refPos[o + 2]];
    sb.position(i, jd, p);
    const d = Math.hypot(p[0] - r[0], p[1] - r[1], p[2] - r[2]), rr = norm(r);
    if (d / rr > wRel) { wRel = d / rr; wRow = i; }
    wAbs = Math.max(wAbs, d);
    w32 = Math.max(w32, Math.hypot(f32[3 * i] - r[0], f32[3 * i + 1] - r[1], f32[3 * i + 2] - r[2]) / rr);
  }
  worstAll = Math.max(worstAll, wRel);
  console.log(`    ${ref.labels[k].padEnd(13)} float64 max ${wAbs.toExponential(1)} au, rel ${wRel.toExponential(1)} (${sb.name(wRow)}); `
    + `positionsAt float32 rel ${w32.toExponential(1)}`);
  if (w32 > 2e-7) { failures++; console.log('  FAIL float32 output worse than float32 rounding'); }
});
report('position() vs independent propagation, worst relative', worstAll, 1e-10);

// ---- synthetic orbits: every branch, e == 1 exactly, near-parabolic, circular, hyperbolic
{
  const s = ref.synthetic, n = s.q.length;
  const cols = [['q', 'f32', s.q], ['e', 'f32', s.e], ['tp', 'f64', s.tp], ['P', 'f32', s.P.flat()],
    ['Q', 'f32', s.Q.flat()], ['H', 'f32', s.q.map(() => NaN)], ['kind', 'u8', s.q.map(() => 0)], ['flags', 'u8', s.q.map(() => 0)]];
  const size = { f32: 4, f64: 8, u8: 1 }, Ctor = { f32: Float32Array, f64: Float64Array, u8: Uint8Array };
  let off = 0; const columns = [];
  for (const [name, type, vals] of cols) { columns.push({ name, type, offset: off, length: vals.length }); off += vals.length * size[type]; }
  const buf = new ArrayBuffer(off);
  cols.forEach(([, type, vals], j) => new Ctor[type](buf, columns[j].offset, vals.length).set(vals));
  const synth = buildSmallBodies({
    count: n, columns, kinds: { 0: 'other' }, names: s.q.map((_, i) => `synthetic ${i}`), labelled: [],
    sources: [{ id: 'test', label: 'test', first: 0, count: n, epoch_jd: 2451545.0 }], epochs: {},
    k_gauss_au15_day: meta.k_gauss_au15_day,
  }, buf);
  let w = 0, wi = '';
  s.dt.forEach((dt, k) => {
    for (let i = 0; i < n; i++) {
      synth.position(i, 2451545.0 + dt, p);
      const r = s.pos[k][i], d = Math.hypot(p[0] - r[0], p[1] - r[1], p[2] - r[2]) / norm(r);
      if (d > w) { w = d; wi = `e=${synth.e[i]} dt=${dt}`; }
    }
  });
  report(`synthetic orbits, ${n} x ${s.dt.length} dates (worst: ${wi})`, w, 1e-10);
}

// ---- the solvers on their own: residuals over a grid, e up to 1 - 1e-12 and up to 50
{
  let w = 0;
  for (const e of [0, 1e-6, 0.1, 0.5, 0.9, 0.99, 0.999999, 1 - 1e-12]) {
    for (let j = 0; j <= 400; j++) {
      const M = Math.PI * (j / 400) ** 3;
      const E = keplerElliptic(M, e);
      w = Math.max(w, Math.abs(E - e * Math.sin(E) - M) / Math.max(M, 1e-300) * (M > 1e-12 ? 1 : 0));
    }
  }
  report('keplerElliptic residual |E - e sin E - M| / M', w, 1e-9);
  let wh = 0;
  for (const e of [1 + 1e-9, 1.0001, 1.2, 3.3, 6.14, 50]) {
    for (let j = 0; j <= 400; j++) {
      const M = 1e-6 * Math.pow(1e12, j / 400);
      const F = keplerHyperbolic(M, e);
      wh = Math.max(wh, Math.abs(e * Math.sinh(F) - F - M) / M);
    }
  }
  report('keplerHyperbolic residual |e sinh F - F - M| / M (M 1e-6..1e6)', wh, 1e-9);
}

// ---- orbitPath: on the conic, closed ellipses through the body, open arcs through it too
{
  const jd = 2461306.5;
  const rows = new Set(sb.labelled);
  for (let i = 0; i < sb.count; i += 97) rows.add(i);
  for (let i = 0; i < sb.count; i++) if (sb.e[i] >= 1) rows.add(i);
  let wConic = 0, wStart = 0, wClose = 0, wOnArc = 0, nOpen = 0;
  for (const i of rows) {
    const el = sb.elements(i), q = el.q, e = el.e;
    const path = sb.orbitPath(i, jd, 512);
    if (path.length !== 3 * 513) { failures++; console.log(`  FAIL orbitPath length for ${sb.name(i)}`); continue; }
    sb.position(i, jd, p);
    const scale = norm(p) + q;
    let best = Infinity;
    for (let s = 0; s <= 512; s++) {
      const v = [path[3 * s], path[3 * s + 1], path[3 * s + 2]];
      const x = v[0] * el.P[0] + v[1] * el.P[1] + v[2] * el.P[2];
      const y = v[0] * el.Q[0] + v[1] * el.Q[1] + v[2] * el.Q[2];
      const r = norm(v);
      // focus-directrix form of every conic: r = q (1 + e) - e x
      wConic = Math.max(wConic, Math.abs(r - (q * (1 + e) - e * x)) / r);
      wConic = Math.max(wConic, Math.abs(Math.hypot(x, y) - r) / r);     // and in the orbit's plane
      best = Math.min(best, Math.hypot(v[0] - p[0], v[1] - p[1], v[2] - p[2]));
    }
    if (e < 1) {
      wStart = Math.max(wStart, Math.hypot(path[0] - p[0], path[1] - p[1], path[2] - p[2]) / scale);
      wClose = Math.max(wClose, Math.hypot(path[0] - path[1536], path[1] - path[1537], path[2] - path[1538]) / scale);
    } else {
      nOpen++;
      // the body lies on the arc: nearest vertex within one segment length
      let seg = 0;
      for (let s = 0; s < 512; s++) seg = Math.max(seg, Math.hypot(path[3 * s + 3] - path[3 * s], path[3 * s + 4] - path[3 * s + 1], path[3 * s + 5] - path[3 * s + 2]));
      wOnArc = Math.max(wOnArc, best / seg);
    }
  }
  report(`orbitPath points on the conic (${rows.size} rows), relative`, wConic, 1e-5);
  report('orbitPath ellipse starts at the body (fraction of r + q)', wStart, 1e-6);
  report('orbitPath ellipse closed (first = last)', wClose, 1e-6);
  report(`orbitPath open arcs (${nOpen}) pass the body (nearest vertex / longest segment)`, wOnArc, 1.0);
}

// ---- elements(), info(), kinds: what the app reads
{
  let bad = 0;
  for (let i = 0; i < sb.count; i++) {
    const k = sb.kind(i);
    if (!k || !sb.kindLabel(i) || !sb.name(i)) bad++;
  }
  report('rows without a kind, a kind label or a name', bad, 0);
  let wPer = 0;
  for (const i of sb.labelled) {
    const el = sb.elements(i), inf = sb.info(i);
    if (!inf.source || !inf.note || inf.kind !== sb.kind(i)) bad++;
    if (el.e < 1) {
      // one period later the body is back where it was
      const a0 = sb.position(i, 2461306.5, new Float64Array(3)), a1 = sb.position(i, 2461306.5 + el.period, new Float64Array(3));
      wPer = Math.max(wPer, Math.hypot(a0[0] - a1[0], a0[1] - a1[1], a0[2] - a1[2]) / norm(a0));
    }
  }
  report('labelled rows missing info.source / info.note', bad, 0);
  report('elements().period: position repeats after one period (relative)', wPer, 1e-9);
  const ceres = sb.names.indexOf('1 Ceres');
  const inf = sb.info(ceres);
  console.log(`    info(1 Ceres): ${inf.kindLabel}, H ${inf.H}, D ${inf.diameter_km} km, epoch ${inf.epoch}; "${inf.source.slice(0, 90)}…"`);
  const weak = sb.weakOrbit(sb.names.indexOf('(2013 TU227)'));
  if (!weak) { failures++; console.log('  FAIL (2013 TU227) (orbit JPL 1) not flagged weak'); }
}

// ---- drift of two-body propagation against JPL Horizons (the honesty note)
console.log('two-body drift against JPL Horizons\' own osculating elements (Ceres, Pallas, Juno, Vesta)');
console.log('    ' + 'date'.padEnd(12) + 'years from epoch'.padStart(17) + ref.horizons.map((h) => h.name.padStart(12)).join(''));
const nPts = ref.horizons[0].points.length;
let nearWorst = 0;
for (let k = 0; k < nPts; k++) {
  const jd = ref.horizons[0].points[k].jd;
  const yrs = (jd - ref.horizons[0].epoch) / 365.25;
  const cells = ref.horizons.map((h) => {
    const pt = h.points[k];
    sb.position(h.row, pt.jd, p);
    const d = Math.hypot(p[0] - pt.pos[0], p[1] - pt.pos[1], p[2] - pt.pos[2]);
    if (Math.abs((pt.jd - h.epoch) / 365.25) < 0.2) nearWorst = Math.max(nearWorst, d);
    return `${d.toFixed(4)} au`.padStart(12);
  });
  const y = 2000 + (jd - 2451545.0) / 365.25;                        // decimal year, for the label
  console.log(`    ${y.toFixed(1).padEnd(12)}${yrs.toFixed(1).padStart(17)}${cells.join('')}`);
}
report('Horizons within 0.2 yr of the epoch (frame and constants check)', nearWorst, 2e-5, 'au');

if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
{
  const t0 = performance.now();
  for (let r = 0; r < 20; r++) sb.positionsAt(2461306.5 + r * 10, f32);
  console.log(`positionsAt: ${((performance.now() - t0) / 20).toFixed(2)} ms for ${sb.count} rows (node)`);
}
console.log('all small-body checks passed');
