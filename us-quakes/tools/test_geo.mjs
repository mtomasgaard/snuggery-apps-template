// The map's geometry against independent arithmetic (CONTRACT §11.4, DESIGN §16):
//   Mercator forward/inverse round trips on a 0.5° grid of the basemap (168° E–55° W, 25° S–81° N) to < 1e−9;
//   the view's clamp: the panel above the sheet stays inside geo.json's basemap wherever it fits, and holds
//   the whole basemap where it does not, over a sweep of sizes, sheet heights, scales and requested centers;
//   js/section.js's along- and cross-track km for the four presets' first 200 events within 1 m of
//   tools/ref/section_ref.json (float64 in Python);
//   the scale bar's km per CSS px against the haversine at five latitudes.
//
//   node tools/test_geo.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wx, wy, lonOf, latOf, createMap } from '../js/map.js';
import { sectionOf, track } from '../js/section.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (c, msg) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fails.push(msg); };

const geo = JSON.parse(fs.readFileSync(path.join(APP, 'assets/geo.json'), 'utf8')), BM = geo.basemap;
let worst = 0, n = 0;
for (let lon = BM.west; lon <= BM.east; lon += 0.5) for (let lat = BM.south; lat <= BM.north; lat += 0.5) {
  worst = Math.max(worst, Math.abs(lonOf(wx(lon)) - lon), Math.abs(latOf(wy(lat)) - lat)); n++;
}
ok(worst < 1e-9, `Mercator: ${n} grid points of the basemap (${BM.west}..${BM.east} on the axis, ${BM.south}..${BM.north}°) round-trip, worst ${worst.toExponential(2)}°`);

// The clamp (js/map.js): the visible panel [0, w] × [0, h − sheet] against the basemap, in world units
{
  const el0 = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const Mc = createMap(el0, { onView() {}, onSettle() {} });
  Mc.setBounds(BM);
  const B = [wx(BM.west), wy(BM.north), wx(BM.east), wy(BM.south)], eps = 1e-9;
  let cases = 0, inside = 0, holds = 0, bad = [];
  for (const [w, h, bottom] of [[390, 800, 152], [390, 800, 400], [390, 844, 110], [464, 346, 0], [844, 390, 110], [1024, 724, 0]]) {
    Mc.resize(w, h, { top: 42, right: 0, bottom });
    for (const s of [1100, 1500, 2218, 5000, 40000]) for (let cx = -0.1; cx <= 0.5; cx += 0.05) for (let cy = -0.15; cy <= 0.45; cy += 0.05) {
      const v = Mc.clampV({ s, cx, cy }), X0 = v.cx - w / 2 / v.s, X1 = v.cx + w / 2 / v.s, Y0 = v.cy - h / 2 / v.s, Y1 = v.cy + (h - bottom - h / 2) / v.s;
      cases++;
      const okX = X1 - X0 <= B[2] - B[0] ? X0 >= B[0] - eps && X1 <= B[2] + eps : X0 <= B[0] + eps && X1 >= B[2] - eps;
      const okY = Y1 - Y0 <= B[3] - B[1] ? Y0 >= B[1] - eps && Y1 <= B[3] + eps : Y0 <= B[1] + eps && Y1 >= B[3] - eps;
      if (okX && okY) { if (X1 - X0 <= B[2] - B[0] && Y1 - Y0 <= B[3] - B[1]) inside++; else holds++; } else if (bad.length < 3) bad.push(JSON.stringify({ w, h, bottom, s, cx, cy, v }));
    }
  }
  ok(!bad.length, `the clamp: ${cases} requested views over six panel shapes; ${inside} keep the panel inside the basemap, ${holds} (wider or taller than it) hold all of it${bad.length ? ': ' + bad.join(' | ') : ''}`);
}

const ref = JSON.parse(fs.readFileSync(path.join(APP, 'tools/ref/section_ref.json'), 'utf8'));
for (const s of ref.sections) {
  const sec = sectionOf(s.a, s.b);
  let w = 0;
  for (const [, lon, lat, along, cross] of s.rows) { const [a, c] = track(sec, lon, lat); w = Math.max(w, Math.abs(a - along), Math.abs(c - cross)); }
  ok(w < 0.001 && Math.abs(sec.len - s.lengthKm) < 0.001, `section ${s.key}: ${s.rows.length} events, length ${sec.len.toFixed(3)} km (ref ${s.lengthKm.toFixed(3)}), worst |Δ| ${(w * 1000).toExponential(2)} m`);
}

// The scale bar: km per CSS px at the visible centre against the haversine over one px of longitude.
const el = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
const M = createMap(el, { onView() {}, onSettle() {} });
M.resize(390, 800, { top: 0, right: 0, bottom: 0 });
const R = 6371.0088, rad = Math.PI / 180;
let wk = 0;
for (const lat of [20, 35, 45, 61, 70]) {
  M.v = { s: 20000, cx: wx(240), cy: wy(lat) };
  const [px, label] = M.scale(), km = Number(label.split(' ')[0].replace(/ /g, ''));
  const lon0 = lonOf(M.X(0)), lon1 = lonOf(M.X(1)), hav = 2 * R * Math.asin(Math.cos(lat * rad) * Math.sin(((lon1 - lon0) * rad) / 2));
  wk = Math.max(wk, Math.abs(km / px - hav) / hav);
}
ok(wk < 1e-6, `scale bar: km per px within ${wk.toExponential(2)} of the haversine at 20, 35, 45, 61 and 70° N`);

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
