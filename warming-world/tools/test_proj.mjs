// The projections (DESIGN §16): js/proj.js against the design's formulas, run in Node.
//   1. orthographic forward → inverse on a 1° grid, for six view centres, < 1e−9 rad;
//   2. Equal Earth forward → inverse on a 1° grid < 1e−9 rad, and proj.js's forward equal to the
//      formulas written out here from Šavrič, Patterson and Jenny (2018) as d3-geo 3.1.1 has them;
//   3. Equal Earth's extent: x max 2.70663, y max 1.31736 (DESIGN §5.4);
//   4. the shader's float32 6-step Newton (Math.fround at every operation) against float64 12 steps,
//      < 1e−5 rad on the grid;
//   5. the cell index of 1 000 seeded points — data.js's cellOf and the shader's float32 arithmetic —
//      against a direct floor of lat and lon;
//   6. the view: unproject(project(p)) on both projections at three zooms, < 1e−6°.
//
//   node tools/test_proj.mjs

import { orthoForward, orthoInverse, eeForward, eeInverse, eeNewton, EE_XMAX, EE_YMAX, A1, A2, A3, A4, M, createView } from '../js/proj.js';
import { cellOf } from '../js/data.js';

const D = Math.PI / 180;
const fails = [];
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const dAng = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// 1. orthographic
let worst = 0, n = 0;
for (const [l0, p0] of [[0, 0], [-150, 20], [30, 72], [100, -72], [179, 45], [-60, -89]]) {
  for (let lat = -89; lat <= 89; lat++) for (let lon = -180; lon < 180; lon++) {
    const f = orthoForward(lon * D, lat * D, l0 * D, p0 * D);
    if (f.Z < 1e-6) continue;
    const g = orthoInverse(f.X, f.Y, l0 * D, p0 * D);
    worst = Math.max(worst, dAng(g.lam, lon * D), Math.abs(g.phi - lat * D)); n++;
  }
}
ok(worst < 1e-9, `orthographic round trip: ${n} facing points of a 1° grid over 6 view centres, worst ${worst.toExponential(2)} rad (< 1e−9)`);

// 2. Equal Earth
const design = (lam, phi) => {                       // the formulas, written out again here
  const l = Math.asin(M * Math.sin(phi)), l2 = l * l, l6 = l2 * l2 * l2;
  return { x: (lam * Math.cos(l)) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))), y: l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) };
};
let wr = 0, wf = 0; n = 0;
for (let lat = -90; lat <= 90; lat++) for (let lon = -180; lon <= 180; lon++) {
  const f = eeForward(lon * D, lat * D), d = design(lon * D, lat * D);
  wf = Math.max(wf, Math.abs(f.x - d.x), Math.abs(f.y - d.y));
  const g = eeInverse(f.x, f.y, 0);
  if (!g) { wr = Infinity; continue; }
  wr = Math.max(wr, Math.abs(g.phi - lat * D), Math.abs(lat) === 90 ? 0 : dAng(g.lam, lon * D)); n++;
}
ok(wr < 1e-9 && wf < 1e-12, `Equal Earth: ${n} points of a 1° grid round trip within ${wr.toExponential(2)} rad (< 1e−9); forward = the design's formulas within ${wf.toExponential(2)}`);

// 3. extent
const xm = design(Math.PI, 0).x, ym = design(0, Math.PI / 2).y;
ok(Math.abs(EE_XMAX - xm) < 1e-12 && Math.abs(EE_YMAX - ym) < 1e-12 && EE_XMAX.toFixed(5) === '2.70663' && EE_YMAX.toFixed(5) === '1.31736',
  `Equal Earth extent: x max ${EE_XMAX.toFixed(7)}, y max ${EE_YMAX.toFixed(7)} (DESIGN: 2.70663, 1.31736)`);

// 4. float32 6-step Newton (the shader) against float64 12 steps
let w32 = 0;
for (let lat = -90; lat <= 90; lat += 0.25) {
  const y = design(0, lat * D).y;
  w32 = Math.max(w32, Math.abs(eeNewton(Math.fround(y), 6, Math.fround) - eeNewton(y, 12)));
}
ok(w32 < 1e-5, `the shader's float32 6-step Newton against float64 12 steps, 721 latitudes: worst ${w32.toExponential(2)} rad (< 1e−5)`);

// 5. the cell index
let seed = 20260930;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const f = Math.fround;
const shaderCell = (lam, phi) => {                   // GLSL: degrees, wrap, floor, min/clamp — in float32
  let lond = f(lam * f(180 / Math.PI));
  lond = f(lond - f(Math.floor(f(f(lond + 180) / 360)) * 360));
  const col = Math.min(179, Math.floor(f(f(lond + 180) / 2)));
  const row = Math.max(0, Math.min(89, Math.floor(f(f(90 - f(phi * f(180 / Math.PI))) / 2))));
  return row * 180 + col;
};
let cellBad = 0, shBad = 0;
for (let k = 0; k < 1000; k++) {
  const lon = -180 + 360 * rnd(), lat = -90 + 180 * rnd();
  const want = Math.min(89, Math.floor((90 - lat) / 2)) * 180 + Math.floor((lon + 180) / 2);
  if (cellOf(lon, lat).k !== want) cellBad++;
  // the shader may differ only within float32 rounding of a cell edge
  const cx = (lon + 180) / 2, cy = (90 - lat) / 2;
  const nearEdge = Math.abs(cx - Math.round(cx)) < 1e-4 || Math.abs(cy - Math.round(cy)) < 1e-4;
  if (!nearEdge && shaderCell(lon * D, lat * D) !== want) shBad++;
}
ok(cellBad === 0 && shBad === 0, `cell index of 1 000 seeded points: data.js cellOf ${cellBad} differ; the shader's float32 arithmetic ${shBad} differ (points within 1e−4 of a cell edge excused)`);

// 6. the view
const v = createView();
v.W = 390; v.H = 632; v.top = 44; v.bottom = 76;
let wv = 0;
for (const mode of ['globe', 'map']) for (const z of [1, 2, 4]) {
  v.mode = mode; v.globe = { lon: -150, lat: 50, zoom: z }; v.map = { lon0: -150, panY: 0.3, zoom: z }; v.clamp();
  for (let lat = -80; lat <= 80; lat += 5) for (let lon = -175; lon <= 175; lon += 5) {
    const p = v.project(lon, lat);
    if (!p[2]) continue;
    const q = v.unproject(p[0], p[1]);
    if (!q) continue;
    wv = Math.max(wv, Math.abs(q[1] - lat), Math.abs(((q[0] - lon + 540) % 360) - 180));
  }
}
ok(wv < 1e-6, `the view: unproject(project(p)) on the globe and the map at zoom 1, 2 and 4, worst ${wv.toExponential(2)}°`);
v.mode = 'globe'; v.globe = { lon: -150, lat: 50, zoom: 1 }; v.clamp();
v.setMode('map'); const carried = v.map.lon0;
v.map.lon0 = 30; v.setMode('globe');
ok(carried === -150 && v.globe.lon === 30 && v.globe.lat === 50, `Globe → Map carries the centre longitude (${carried}); Map → Globe carries λ0 (${v.globe.lon}) and keeps the latitude at zoom 1 (${v.globe.lat})`);

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
