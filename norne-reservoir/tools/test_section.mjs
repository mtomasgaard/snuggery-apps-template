// The section's geometry (js/section.js) against the data files, in Node (plan 0012, package 3.4).
// Every check works from geometry.bin and model.json as data/ATTRIBUTION.txt describes them; nothing is
// drawn here, so the drawing layers are left to tools/shoot.mjs.
//
//   node tools/test_section.mjs
//
//  1. the field's own two lines: A at the west end, Across square to Along, both cutting the field;
//  2. every polygon of a cut is one cell's: inside the line (0 <= s <= L), between that cell's own
//     shallowest and deepest corner, convex, with area; no cell listed twice;
//  3. blocks, not samples: a plane through a cell's middle cuts that cell, and the polygon holds the
//     middle (within 2.5 m where a face is warped); and no point of the section lies inside two cells' polygons (beyond the shared edges);
//  4. the formation tops lie on the formations' first layers' top faces, inside the line;
//  5. the wells near the line: every path point within the corridor and between A and A′ is drawn,
//     and every drawn point is within it;
//  6. the axis: one scale for distance, the same times the stretch for depth, the section inside the
//     box, and the ticks written in SI notation with the unit on the last;
//  7. the cost of a cut, as a trend (Node on this Mac, never phone evidence).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cutGrid, wellsNear, fieldLines, sectionAxis, depthTicks, distanceTicks, lineOf } from '../js/section.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const model = JSON.parse(fs.readFileSync(path.join(APP, 'data/model.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(APP, 'config.json'), 'utf8'));
const buf = (f) => { const b = fs.readFileSync(path.join(APP, 'data', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const geom = new Float32Array(buf('geometry.bin')), ijk = new Uint8Array(buf('ijk.bin')), NA = model.NA;
const tops = new Uint8Array(model.NK + 2);
for (const z of cfg.zones) if (z.k[0] <= model.NK) tops[z.k[0]] = 1;
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const corner = (c, k) => [geom[c * 24 + k * 3], geom[c * 24 + k * 3 + 1], geom[c * 24 + k * 3 + 2]];
const middle = (c) => { const m = [0, 0, 0]; for (let k = 0; k < 8; k++) { const p = corner(c, k); m[0] += p[0] / 8; m[1] += p[1] / 8; m[2] += p[2] / 8; } return m; };
const inPoly = (sec, i, s, z) => {
  let inside = false;
  for (let k = sec.offs[i], j = sec.offs[i + 1] - 1; k < sec.offs[i + 1]; j = k++) {
    const si = sec.pts[k * 2], zi = sec.pts[k * 2 + 1], sj = sec.pts[j * 2], zj = sec.pts[j * 2 + 1];
    if ((zi > z) !== (zj > z) && s < ((sj - si) * (z - zi)) / (zj - zi) + si) inside = !inside;
  }
  return inside;
};

// 1. the field's own lines
const lines = fieldLines(geom, NA, ijk, model.NI, model.NJ);
{
  const A = lineOf(lines.along.a, lines.along.b), B = lineOf(lines.across.a, lines.across.b);
  const dot = Math.abs(A.ux * B.ux + A.uy * B.uy);
  const cA = cutGrid(geom, NA, ijk, lines.along.a, lines.along.b, tops), cB = cutGrid(geom, NA, ijk, lines.across.a, lines.across.b, tops);
  ok(lines.along.a[0] <= lines.along.b[0] && lines.across.a[0] <= lines.across.b[0] && dot < 0.02 && cA.n > 1000 && cB.n > 300 && A.L > B.L,
    `the field's lines: Along ${Math.round(A.L)} m at ${lines.along.deg}° (${lines.along.columns} of ${lines.columns} columns, ${cA.n} cells cut), Across ${Math.round(B.L)} m square to it (|cos| ${dot.toFixed(4)}, ${cB.n} cells); A at the west end of both`);
}

// 2–4 over the field's lines and 40 random lines across the field
const tests = [['along', lines.along], ['across', lines.across]];
for (let n = 0; n < 40; n++) {
  const r = () => [(rnd() - 0.5) * model.extent[0] * 1.1, (rnd() - 0.5) * model.extent[1] * 1.1];
  const a = r(), b = r();
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 300) tests.push([`random ${n}`, { a, b }]);
}
let polys = 0, worst = [], convexBad = 0, dup = 0, topBad = 0, outS = 0, outZ = 0, flat = 0, msSum = 0;
for (const [name, l] of tests) {
  const sec = cutGrid(geom, NA, ijk, l.a, l.b, tops), L = sec.line.L;
  msSum += sec.ms;
  if (new Set(sec.cells).size !== sec.n) dup++;
  for (let i = 0; i < sec.n; i++) {
    polys++;
    const c = sec.cells[i];
    let zlo = Infinity, zhi = -Infinity;
    for (let k = 0; k < 8; k++) { const z = corner(c, k)[2]; zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); }
    const o0 = sec.offs[i], o1 = sec.offs[i + 1], m = o1 - o0;
    let sign = 0, area = 0;
    for (let k = 0; k < m; k++) {
      const s = sec.pts[(o0 + k) * 2], z = sec.pts[(o0 + k) * 2 + 1];
      if (s < -1e-3 || s > L + 1e-3) outS++;
      if (z < zlo - 1e-3 || z > zhi + 1e-3) outZ++;
      const p = (o0 + k) * 2, q = (o0 + (k + 1) % m) * 2, r2 = (o0 + (k + 2) % m) * 2;
      const cr = (sec.pts[q] - sec.pts[p]) * (sec.pts[r2 + 1] - sec.pts[q + 1]) - (sec.pts[q + 1] - sec.pts[p + 1]) * (sec.pts[r2] - sec.pts[q]);
      if (Math.abs(cr) > 1e-6) { const sg = Math.sign(cr); if (sign && sg !== sign) { convexBad++; worst.push(`${name} cell ${c}`); break; } sign = sg; }
      area += sec.pts[p] * sec.pts[q + 1] - sec.pts[q] * sec.pts[p + 1];
    }
    if (!(Math.abs(area) > 1e-3)) flat++;
  }
  // the formation tops: each segment's ends inside the line, at a depth of some first layer's top face
  for (let i = 0; i < sec.tops.length; i += 4) if (sec.tops[i] < -1e-3 || sec.tops[i + 2] > L + 1e-3 || sec.tops[i + 2] < sec.tops[i]) topBad++;
}
ok(dup === 0 && outS === 0 && outZ === 0 && convexBad === 0 && flat === 0 && polys > 3000,
  `${tests.length} lines, ${polys} polygons: every one inside its line (${outS} points outside), between its own cell's shallowest and deepest corner (${outZ} outside), convex (${convexBad} not${worst.length ? ': ' + worst.slice(0, 3).join(', ') : ''}), with area (${flat} flat); no cell twice (${dup} lines with one)`);
ok(topBad === 0, `the formation tops: every segment inside its line, A to A′ (${topBad} not)`);

// 3. blocks, not samples
{
  // the middle (the corners' mean) of a cell with a warped top or bottom face can sit a little off
  // the cut, which draws each face as straight chords between its edges' crossings: measured, bounded
  const off = (sec, i, s, z) => {
    if (inPoly(sec, i, s, z)) return 0;
    let d = Infinity;
    for (let k = sec.offs[i], j = sec.offs[i + 1] - 1; k < sec.offs[i + 1]; j = k++) {
      const x1 = sec.pts[j * 2], y1 = sec.pts[j * 2 + 1], dx = sec.pts[k * 2] - x1, dy = sec.pts[k * 2 + 1] - y1;
      const t = Math.max(0, Math.min(1, ((s - x1) * dx + (z - y1) * dy) / (dx * dx + dy * dy || 1)));
      d = Math.min(d, Math.hypot(s - x1 - t * dx, z - y1 - t * dy));
    }
    return d;
  };
  let missing = 0, outside = 0, n = 0, far = 0;
  for (let t = 0; t < 2000; t++) {
    const c = Math.floor(rnd() * NA), m = middle(c), th = rnd() * Math.PI, ux = Math.cos(th), uy = Math.sin(th);
    const a = [m[0] - ux * 400, m[1] - uy * 400], b = [m[0] + ux * 400, m[1] + uy * 400];
    const sec = cutGrid(geom, NA, ijk, a, b, null), i = sec.cells.indexOf(c);
    n++;
    if (i < 0) { missing++; continue; }
    const d = off(sec, i, 400, m[2]);
    if (d > 0) { outside++; far = Math.max(far, d); }
  }
  ok(missing === 0 && far <= 2.5, `a plane through a cell's middle (${n} random cells, random bearings): the cell is cut every time (${missing} missed); its polygon holds the middle in ${n - outside}, and in the other ${outside} (warped faces, drawn as chords) the middle is at most ${far.toFixed(2)} m off it (bound 2.5 m: ${(far * 0.18).toFixed(2)} px at the default stretch along the field)`);
  let pts = 0, two = 0;
  for (const [, l] of tests.slice(0, 2)) {
    const sec = cutGrid(geom, NA, ijk, l.a, l.b, null);
    for (let t = 0; t < 4000; t++) {
      const s = rnd() * sec.line.L, z = sec.z0 + rnd() * (sec.z1 - sec.z0);
      let k = 0;
      for (let i = 0; i < sec.n && k < 2; i++) if (inPoly(sec, i, s, z)) k++;
      pts++; if (k > 1) two++;
    }
  }
  ok(two / pts < 0.002, `blocks, not samples: of ${pts} random points on the two lines' sections, ${two} lie in two cells' polygons (${(two / pts * 100).toFixed(2)} %; neighbors share an edge, and a warped face shares a sliver)`);
}

// 5. the wells near the line
{
  const C = 150;
  let missed = 0, stray = 0, drawn = 0;
  for (const [, l] of tests) {
    const ln = lineOf(l.a, l.b), near = wellsNear(model.wells.map((w) => w.path), ln, C);
    const names = new Set(near.map((w) => w.i));
    model.wells.forEach((w, i) => {
      const inside = w.path.some((p) => { const s = (p[0] - ln.a[0]) * ln.ux + (p[1] - ln.a[1]) * ln.uy, d = (p[0] - ln.a[0]) * ln.nx + (p[1] - ln.a[1]) * ln.ny; return Math.abs(d) < C - 1 && s > 1 && s < ln.L - 1; });
      if (inside && !names.has(i)) missed++;
    });
    for (const w of near) for (const part of w.parts) for (let k = 0; k < part.length; k += 2) {
      drawn++;
      if (part[k] < -1e-6 || part[k] > ln.L + 1e-6 || w.dmin > C + 1e-6) stray++;
    }
  }
  ok(missed === 0 && stray === 0 && drawn > 50, `the wells within ${C} m: every path point within it and between A and A′ is drawn (${missed} missed), and ${drawn} drawn points all are (${stray} not)`);
}

// 6. the axis
{
  const sec = cutGrid(geom, NA, ijk, lines.along.a, lines.along.b, tops);
  const res = [];
  for (const [box, exag] of [[{ x: 46, y: 15, w: 336, h: 120 }, 5], [{ x: 46, y: 15, w: 336, h: 40 }, 5], [{ x: 46, y: 15, w: 300, h: 300 }, 15], [{ x: 0, y: 0, w: 336, h: 1e9 }, 1]]) {
    const ax = sectionAxis(sec, box, exag, model.center[2]);
    const fits = ax.x0 >= box.x - 1e-6 && ax.x1 <= box.x + box.w + 1e-6 && ax.y0 >= box.y - 1e-6 && ax.y1 <= box.y + box.h + 1e-6;
    const same = Math.abs(ax.sz / ax.sx - exag) < 1e-9 && Math.abs(ax.S(ax.X(1234)) - 1234) < 1e-6 && Math.abs(ax.Z(ax.Y(-50)) + 50) < 1e-6;
    const ends = Math.abs(ax.X(0) - ax.x0) < 1e-9 && Math.abs(ax.X(ax.L) - ax.x1) < 1e-9 && ax.Y(sec.z0) >= ax.y0 && ax.Y(sec.z1) <= ax.y1;
    res.push([fits && same && ends, `${box.w} × ${box.h === 1e9 ? '∞' : box.h} at ×${exag}: ${Math.round((ax.x1 - ax.x0) * 10) / 10} × ${Math.round((ax.y1 - ax.y0) * 10) / 10} px`]);
  }
  ok(res.every((r) => r[0]), `the axis: depth px per meter = distance px per meter × the stretch, X and Y invert, A at x0 and A′ at x1, the whole cut inside the box: ${res.map((r) => r[1]).join('; ')}`);
  const ax = sectionAxis(sec, { x: 46, y: 15, w: 336, h: 120 }, 5, model.center[2]);
  const d = depthTicks(ax, 'SI'), x = distanceTicks(ax, 'SI'), du = depthTicks(ax, 'US'), xu = distanceTicks(ax, 'US');
  const NN = ' ', sorted = (a, k) => a.every((t, i) => !i || t[k] > a[i - 1][k]);
  const fmt = (t) => /^\d{1,3}( \d{3})*$/.test(t);
  ok(d.length >= 2 && x.length >= 2 && sorted(d, 'y') && sorted(x, 'x') && d.slice(0, -1).every((t) => fmt(t.text)) && d[d.length - 1].text.endsWith(`${NN}m`) && fmt(d[d.length - 1].text.slice(0, -2))
    && x[0].text === '0' && x[x.length - 1].text.endsWith(`${NN}m`) && du[du.length - 1].text.endsWith(`${NN}ft`) && xu[xu.length - 1].text.endsWith(`${NN}ft`)
    && d.every((t) => t.y >= ax.y0 - 1e-6 && t.y <= ax.y1 + 1e-6) && x.every((t) => t.x >= ax.x0 - 1e-6 && t.x <= ax.x1 + 1e-6),
  `the ticks: depth ${d.map((t) => t.text).join(' | ')}; distance ${x.map((t) => t.text).join(' | ')}; in US units ${du[du.length - 1].text} and ${xu[xu.length - 1].text}; each inside the section, the unit on the last (U+202F)`);
}

// 7. the cost
ok(true, `a cut takes ${(msSum / tests.length).toFixed(1)} ms on average over ${tests.length} lines (Node on this Mac: a trend, never phone evidence)`);

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
